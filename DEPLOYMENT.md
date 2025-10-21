# 部署指南

本指南将帮助你将 student-cafe-basic 项目部署到 Railway 或 Render 平台。

## 准备工作

1. 确保项目已上传到 GitHub 仓库
2. 在 Railway 或 Render 平台注册账号

## 方案一：Railway 部署

### 1. 创建新项目
1. 访问 [Railway](https://railway.app)
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择你的 student-cafe-basic 仓库

### 2. 配置环境变量
在 Railway 项目设置中添加以下环境变量：

```
PORT=3000
ADMIN_SECRET=你的复杂管理员密码
DAILY_LIMIT_CENTS=20000
DATABASE_FILE=/data/data.db
```

### 3. 添加持久化存储
1. 在 Railway 项目中点击 "Add Service"
2. 选择 "Volume"
3. 设置挂载路径为 `/data`
4. 设置大小为 1GB

### 4. 部署
Railway 会自动检测到 `package.json` 并开始构建部署。

## 方案二：Render 部署

### 1. 创建新服务
1. 访问 [Render](https://render.com)
2. 点击 "New +"
3. 选择 "Web Service"
4. 连接你的 GitHub 仓库

### 2. 配置服务
- **Name**: student-cafe-basic
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free（或根据需要选择付费计划）

### 3. 设置环境变量
在 Environment Variables 部分添加：

```
NODE_ENV=production
PORT=3000
ADMIN_SECRET=你的复杂管理员密码
DAILY_LIMIT_CENTS=20000
DATABASE_FILE=/data/data.db
```

### 4. 添加持久化磁盘
1. 在服务设置中找到 "Disk" 部分
2. 点击 "Add Disk"
3. 设置：
   - **Name**: data-disk
   - **Mount Path**: /data
   - **Size**: 1GB

### 5. 部署
点击 "Create Web Service" 开始部署。

## 自定义域名设置

### 1. 获取默认域名
部署完成后，平台会提供一个默认域名，例如：
- Railway: `your-app-name.railway.app`
- Render: `your-app-name.onrender.com`

### 2. 配置 DNS
在你的域名注册商（阿里云、腾讯云、Namecheap 等）的 DNS 设置中添加：

```
类型: CNAME
名称: www
值: 你的默认域名（如 your-app-name.onrender.com）
TTL: 300（或默认值）
```

### 3. 在平台添加自定义域名
- **Railway**: 在项目设置中找到 "Domains" 部分，添加 `www.yourdomain.com`
- **Render**: 在服务设置中找到 "Custom Domains" 部分，添加 `www.yourdomain.com`

### 4. 启用 HTTPS
平台会自动为自定义域名配置 SSL 证书，通常需要几分钟到几小时。

## 验证部署

1. 访问你的默认域名或自定义域名
2. 测试以下页面：
   - `/register.html` - 用户注册
   - `/topup.html` - 充值
   - `/cashier.html` - 收银
   - `/admin.html` - 管理后台

## 安全建议

1. **修改 ADMIN_SECRET**: 使用强密码，建议包含大小写字母、数字和特殊字符
2. **设置合理的每日限额**: 根据实际情况调整 `DAILY_LIMIT_CENTS`
3. **定期备份**: 虽然使用了持久化存储，建议定期备份数据库文件
4. **监控日志**: 定期检查应用日志，关注异常情况

## 故障排除

### 常见问题

1. **数据库文件权限问题**
   - 确保挂载路径 `/data` 有正确的写入权限
   - 检查环境变量 `DATABASE_FILE` 是否正确设置

2. **端口问题**
   - 确保 `PORT` 环境变量设置为 3000
   - 平台会自动处理端口映射

3. **构建失败**
   - 检查 `package.json` 中的依赖是否正确
   - 确保 Node.js 版本兼容

4. **域名解析问题**
   - DNS 更改可能需要 24-48 小时生效
   - 使用 `nslookup` 或 `dig` 命令检查 DNS 解析

### 联系支持
如果遇到问题，可以：
- 查看平台提供的日志和错误信息
- 联系平台技术支持
- 检查项目的 GitHub Issues

## 维护

1. **更新代码**: 推送新代码到 GitHub，平台会自动重新部署
2. **数据库备份**: 定期下载 `/data/data.db` 文件进行备份
3. **监控资源使用**: 关注 CPU、内存和磁盘使用情况
4. **安全更新**: 定期更新依赖包以修复安全漏洞
