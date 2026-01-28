# Render部署检查清单

## ✅ 部署前准备

### 1. MongoDB Atlas设置
- [ ] 创建MongoDB Atlas账户
- [ ] 创建免费集群（M0 Sandbox）
- [ ] 创建数据库用户（用户名和密码）
- [ ] 配置网络访问（允许0.0.0.0/0或Render IP）
- [ ] 获取连接字符串
- [ ] 在连接字符串末尾添加数据库名称

### 2. 代码准备
- [ ] 确认所有代码已推送到GitHub
- [ ] 检查.gitignore是否正确
- [ ] 确认没有敏感信息（密码、密钥）在代码中

### 3. 本地测试
- [ ] 测试MongoDB连接
- [ ] 测试所有功能
- [ ] 检查环境变量配置

---

## 🚀 Render部署步骤

### 第一步：部署后端

1. **创建Web Service**
   - [ ] 访问 https://dashboard.render.com
   - [ ] 点击 "New" → "Web Service"
   - [ ] 连接GitHub仓库：`Li200858/-`
   - [ ] 配置如下：
     - Name: `activity-registration-backend`
     - Environment: `Node`
     - Region: 选择最近的区域
     - Branch: `main`
     - Root Directory: `server`
     - Build Command: `npm install`
     - Start Command: `npm start`
     - Plan: `Free`

2. **配置环境变量**
   - [ ] `NODE_ENV` = `production`
   - [ ] `PORT` = `10000`（Render自动设置，但可以显式设置）
   - [ ] `MONGODB_URI` = 你的MongoDB连接字符串
   - [ ] `CORS_ORIGIN` = `https://你的前端域名.onrender.com`

3. **添加持久化磁盘**
   - [ ] Settings → Persistent Disk
   - [ ] Name: `uploads-disk`
   - [ ] Mount Path: `/opt/render/project/src/uploads`
   - [ ] Size: `1 GB`

4. **部署**
   - [ ] 点击 "Create Web Service"
   - [ ] 等待构建完成
   - [ ] 记录后端URL（例如：`https://activity-registration-backend.onrender.com`）

### 第二步：部署前端

1. **创建Static Site**
   - [ ] Dashboard → "New" → "Static Site"
   - [ ] 连接GitHub仓库：`Li200858/-`
   - [ ] 配置如下：
     - Name: `activity-registration-frontend`
     - Branch: `main`
     - Root Directory: `client`
     - Build Command: `npm install && npm run build`
     - Publish Directory: `build`
     - Plan: `Free`

2. **配置环境变量**
   - [ ] `REACT_APP_API_URL` = 你的后端URL（例如：`https://activity-registration-backend.onrender.com`）

3. **部署**
   - [ ] 点击 "Create Static Site"
   - [ ] 等待构建完成
   - [ ] 记录前端URL

### 第三步：更新配置

1. **更新后端CORS**
   - [ ] 回到后端服务设置
   - [ ] 更新 `CORS_ORIGIN` 为实际的前端URL

2. **验证连接**
   - [ ] 访问前端URL
   - [ ] 测试注册/登录功能
   - [ ] 检查浏览器控制台是否有错误

---

## 🔧 代码迁移步骤

### 步骤1：备份当前代码
```bash
cd /Users/lichangxuan/Desktop/活动报名网站
git add .
git commit -m "备份：迁移到MongoDB前的代码"
git push
```

### 步骤2：安装MongoDB依赖
```bash
cd server
npm install mongoose
npm uninstall sqlite3 sequelize
```

### 步骤3：重命名数据库文件
```bash
cd server
mv db.js db.sqlite.js  # 备份原文件
mv db.mongodb.js db.js  # 使用MongoDB版本
```

### 步骤4：更新server/index.js
- 检查所有Sequelize查询是否需要修改
- 注意：MongoDB使用ObjectId，不是整数ID

### 步骤5：测试本地
```bash
# 创建.env文件
cp .env.example .env
# 编辑.env，填入MongoDB连接字符串

# 启动服务器
npm run dev
```

### 步骤6：提交更改
```bash
git add .
git commit -m "迁移到MongoDB"
git push
```

---

## ⚠️ 重要注意事项

### MongoDB查询差异

1. **ID类型**：
   - SQLite: 整数 `1, 2, 3...`
   - MongoDB: ObjectId `507f1f77bcf86cd799439011`

2. **查询语法**：
   ```javascript
   // Sequelize (SQLite)
   Club.findByPk(1)
   
   // Mongoose (MongoDB)
   Club.findById('507f1f77bcf86cd799439011')
   ```

3. **关联查询**：
   ```javascript
   // Sequelize
   ClubMember.findAll({ include: [User] })
   
   // Mongoose
   ClubMember.find().populate('userID', 'name class')
   ```

### 需要修改的代码位置

检查 `server/index.js` 中以下方法：
- `findByPk()` → `findById()`
- `findAll({ where: { id: ... } })` → `find({ _id: ... })`
- `create()` → 基本兼容
- `destroy()` → `deleteOne()` 或 `deleteMany()`
- `update()` → `updateOne()` 或 `updateMany()`

---

## 🐛 故障排查

### 后端无法启动
- 检查MongoDB连接字符串
- 查看Render日志
- 确认环境变量已设置

### 前端无法连接后端
- 检查CORS_ORIGIN配置
- 验证REACT_APP_API_URL
- 检查浏览器控制台错误

### 数据库查询失败
- 确认MongoDB网络访问已配置
- 检查数据库用户权限
- 验证连接字符串格式

---

## 📝 部署后验证

- [ ] 前端可以访问
- [ ] 用户可以注册
- [ ] 用户可以登录
- [ ] 可以创建社团
- [ ] 可以创建活动
- [ ] 文件上传功能正常
- [ ] 实时通知功能正常

---

## 🎉 完成！

部署成功后，你的网站将在以下地址可用：
- 前端：`https://activity-registration-frontend.onrender.com`
- 后端：`https://activity-registration-backend.onrender.com`



