# MongoDB迁移步骤 - 快速指南

## 🎯 你需要做的事情（按顺序）

### 第一步：创建MongoDB Atlas数据库（15分钟）

1. **注册账户**
   - 访问：https://www.mongodb.com/cloud/atlas/register
   - 使用Google账户或邮箱注册

2. **创建免费集群**
   - 选择云服务商和区域
   - 集群名称：`activity-registration`
   - 点击 "Create Cluster"（需要几分钟）

3. **创建数据库用户**
   - Database Access → Add New Database User
   - 用户名：`activity-admin`
   - 密码：生成并保存（重要！）
   - 权限：Atlas admin

4. **配置网络访问**
   - Network Access → Add IP Address
   - 选择 "Allow Access from Anywhere" (0.0.0.0/0)

5. **获取连接字符串**
   - Database → Connect → Connect your application
   - 复制连接字符串
   - 格式：`mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   - **重要**：在末尾添加数据库名：`/activity-registration`

---

### 第二步：更新代码（我会帮你完成）

需要我帮你：
1. ✅ 更新package.json（添加mongoose，移除sqlite3）
2. ✅ 替换db.js为MongoDB版本
3. ✅ 更新所有硬编码的localhost URL
4. ✅ 修复MongoDB查询语法

**告诉我"开始迁移代码"，我会帮你完成！**

---

### 第三步：本地测试（5分钟）

```bash
cd server
# 创建.env文件
echo "MONGODB_URI=你的连接字符串" > .env
echo "PORT=5001" >> .env
echo "NODE_ENV=development" >> .env

# 安装依赖
npm install mongoose
npm uninstall sqlite3 sequelize

# 测试运行
npm run dev
```

---

### 第四步：部署到Render（20分钟）

#### 4.1 部署后端

1. 访问 https://dashboard.render.com
2. New → Web Service
3. 连接GitHub仓库：`Li200858/-`
4. 配置：
   - Name: `activity-registration-backend`
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

5. **环境变量**：
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=你的MongoDB连接字符串
   CORS_ORIGIN=https://activity-registration-frontend.onrender.com
   ```

6. **持久化磁盘**：
   - Settings → Persistent Disk
   - Mount Path: `/opt/render/project/src/uploads`
   - Size: 1GB

#### 4.2 部署前端

1. New → Static Site
2. 连接GitHub仓库：`Li200858/-`
3. 配置：
   - Name: `activity-registration-frontend`
   - Root Directory: `client`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`

4. **环境变量**：
   ```
   REACT_APP_API_URL=https://activity-registration-backend.onrender.com
   ```

---

## 📋 检查清单

### MongoDB设置
- [ ] Atlas账户已创建
- [ ] 集群已创建
- [ ] 数据库用户已创建
- [ ] 网络访问已配置
- [ ] 连接字符串已获取

### 代码迁移
- [ ] package.json已更新
- [ ] db.js已替换为MongoDB版本
- [ ] 所有查询已更新
- [ ] 环境变量已配置

### Render部署
- [ ] 后端服务已创建
- [ ] 环境变量已设置
- [ ] 持久化磁盘已添加
- [ ] 前端已创建
- [ ] 前端环境变量已设置

### 测试
- [ ] 前端可以访问
- [ ] 注册功能正常
- [ ] 登录功能正常
- [ ] 创建社团功能正常
- [ ] 创建活动功能正常

---

## ⚠️ 重要提示

1. **MongoDB连接字符串**：确保包含数据库名称
2. **CORS设置**：前后端URL必须匹配
3. **环境变量**：Render中设置后需要重新部署
4. **免费限制**：Render免费版会在15分钟无活动后休眠

---

## 🆘 需要帮助？

如果遇到问题：
1. 检查Render日志
2. 检查MongoDB Atlas连接
3. 查看浏览器控制台错误
4. 告诉我具体错误信息

