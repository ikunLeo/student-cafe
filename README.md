# Student Cafe (Basic)

最小可运行版本（Node.js + Express + SQLite via better-sqlite3）。
**本系统与学校余额不互通**，用于学生自治小店。务必合规：现场注册、同意书、风险提示。

## 运行
```bash
npm install
cp .env.example .env
npm start
```
打开：/register.html /topup.html /cashier.html /admin.html

## API
- POST /api/register  { uid, student_id?, name, phone?, pin? }
- POST /api/topup     { uid, amount_cents, method?, operator?, note? }
- POST /api/pay       { uid, amount_cents, nonce, terminal_id?, pin? }
- GET  /api/user/:uid
- GET  /api/transactions?start=&end=&admin_secret=...

