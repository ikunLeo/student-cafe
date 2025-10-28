import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));
app.use(express.static('public'));

// 👇加这一段
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 便捷路由重定向
app.get('/register', (req, res) => {
  res.redirect('/register.html');
});

app.get('/topup', (req, res) => {
  res.redirect('/topup.html');
});

app.get('/cashier', (req, res) => {
  res.redirect('/cashier.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});


const PORT = process.env.PORT || 3000;
const DATABASE_FILE = process.env.DATABASE_FILE || './data/data.db';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change_me_admin_secret';
const DAILY_LIMIT_CENTS = parseInt(process.env.DAILY_LIMIT_CENTS || '20000', 10);

fs.mkdirSync(path.dirname(DATABASE_FILE), { recursive: true });
const db = new Database(DATABASE_FILE);

// --- DB INIT ---
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT UNIQUE NOT NULL,
  student_id TEXT,
  name TEXT,
  phone TEXT,
  pin_hash TEXT,
  balance_cents INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  registered_by TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  uid TEXT,
  type TEXT,
  amount_cents INTEGER NOT NULL,
  balance_after INTEGER,
  terminal_id TEXT,
  nonce TEXT UNIQUE,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER,
  reason TEXT,
  handled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_tx_uid ON transactions(uid);
`);

// helpers
function ok(res, data) { res.json({ ok: true, data }); }
function err(res, code, message) { res.status(code).json({ ok: false, error: message }); }

async function hashPin(pin) {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

// --- API ---

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { uid, student_id, name, phone, pin, registered_by } = req.body || {};
    if (!uid || !name) return err(res, 400, 'uid and name required');
    const pin_hash = pin ? (await hashPin(pin)) : null;
    const stmt = db.prepare(`INSERT INTO users(uid, student_id, name, phone, pin_hash, registered_by) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(uid.trim().toUpperCase(), student_id || null, name, phone || null, pin_hash, registered_by || null);
    const user = db.prepare(`SELECT * FROM users WHERE uid=?`).get(uid.trim().toUpperCase());
    ok(res, user);
  } catch (e) {
    if (String(e).includes('UNIQUE constraint failed: users.uid')) return err(res, 409, 'UID already registered');
    console.error(e);
    err(res, 500, 'register failed');
  }
});

// Get user
app.get('/api/user/:uid', (req, res) => {
  try {
    const uid = String(req.params.uid || '').toUpperCase();
    const user = db.prepare(`SELECT * FROM users WHERE uid=?`).get(uid);
    if (!user) return err(res, 404, 'user not found');
    ok(res, user);
  } catch (e) {
    console.error(e);
    err(res, 500, 'query failed');
  }
});

// Topup
app.post('/api/topup', (req, res) => {
  try {
    const { uid, amount_cents, method, operator, note } = req.body || {};
    if (!uid || !Number.isInteger(amount_cents) || amount_cents <= 0) return err(res, 400, 'invalid topup payload');
    const user = db.prepare(`SELECT * FROM users WHERE uid=?`).get(uid.trim().toUpperCase());
    if (!user) return err(res, 404, 'user not found');
    const tx = db.transaction(() => {
      const newBal = user.balance_cents + amount_cents;
      db.prepare(`UPDATE users SET balance_cents=? WHERE id=?`).run(newBal, user.id);
      db.prepare(`INSERT INTO transactions(user_id, uid, type, amount_cents, balance_after, terminal_id, nonce, note) VALUES (?, ?, 'topup', ?, ?, ?, ?, ?)`)
        .run(user.id, user.uid, amount_cents, newBal, method || 'manual', nanoid(), note || `topup by ${operator || 'n/a'}`);
      return newBal;
    });
    const balance_after = tx();
    ok(res, { uid: user.uid, balance_after });
  } catch (e) {
    console.error(e);
    err(res, 500, 'topup failed');
  }
});

// Pay (idempotent with nonce)
app.post('/api/pay', async (req, res) => {
  try {
    const { uid, amount_cents, nonce, terminal_id, pin } = req.body || {};
    if (!uid || !Number.isInteger(amount_cents) || amount_cents <= 0) return err(res, 400, 'invalid pay payload');
    const _uid = uid.trim().toUpperCase();
    if (!nonce) return err(res, 400, 'nonce required');
    const user = db.prepare(`SELECT * FROM users WHERE uid=?`).get(_uid);
    if (!user) return err(res, 404, 'user not found');

    // optional PIN check
    if (user.pin_hash) {
      if (!pin) return err(res, 401, 'PIN required');
      const candidate = await hashPin(pin);
      if (candidate != user.pin_hash) return err(res, 401, 'PIN incorrect');
    }

    // daily limit
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayISO = todayStart.toISOString().slice(0,19).replace('T',' ');
    const spentRow = db.prepare(`SELECT COALESCE(ABS(SUM(amount_cents)),0) AS spent FROM transactions WHERE uid=? AND type='purchase' AND created_at >= ?`).get(_uid, todayISO);
    if (spentRow && (spentRow.spent + amount_cents) > DAILY_LIMIT_CENTS) {
      return err(res, 403, `daily limit exceeded (${(DAILY_LIMIT_CENTS/100).toFixed(2)})`);
    }

    // idempotency check
    const existing = db.prepare(`SELECT * FROM transactions WHERE nonce=?`).get(nonce);
    if (existing) return ok(res, { uid: _uid, balance_after: existing.balance_after, reused_nonce: true });

    const result = db.transaction(() => {
      const fresh = db.prepare(`SELECT * FROM users WHERE uid=?`).get(_uid);
      if (fresh.balance_cents < amount_cents) throw new Error('INSUFFICIENT');
      const newBal = fresh.balance_cents - amount_cents;
      db.prepare(`UPDATE users SET balance_cents=? WHERE id=?`).run(newBal, fresh.id);
      db.prepare(`INSERT INTO transactions(user_id, uid, type, amount_cents, balance_after, terminal_id, nonce) VALUES (?, ?, 'purchase', ?, ?, ?, ?)`)
        .run(fresh.id, fresh.uid, -amount_cents, newBal, terminal_id || 'T1', nonce);
      return newBal;
    })();

    ok(res, { uid: _uid, balance_after: result });
  } catch (e) {
    if (String(e).includes('INSUFFICIENT')) return err(res, 402, 'insufficient funds');
    if (String(e).includes('UNIQUE constraint failed: transactions.nonce')) {
      const ex = db.prepare(`SELECT * FROM transactions WHERE nonce=?`).get(req.body.nonce);
      return ok(res, { uid: req.body.uid?.toUpperCase(), balance_after: ex?.balance_after || null, reused_nonce: true });
    }
    console.error(e);
    err(res, 500, 'pay failed');
  }
});

// Export transactions (admin)
app.get('/api/transactions', (req, res) => {
  try {
    const { start, end, admin_secret } = req.query;
    if ((admin_secret || '') !== ADMIN_SECRET) return err(res, 401, 'forbidden');
    let sql = `SELECT * FROM transactions WHERE 1=1`;
    const params = [];
    if (start) { sql += ` AND created_at >= ?`; params.push(start); }
    if (end) { sql += ` AND created_at <= ?`; params.push(end); }
    sql += ` ORDER BY id DESC LIMIT 1000`;
    const rows = db.prepare(sql).all(...params);
    ok(res, rows);
  } catch (e) {
    console.error(e);
    err(res, 500, 'export failed');
  }
});

app.listen(PORT, () => {
  console.log(`student-cafe-basic running on http://localhost:${PORT}`);
});
