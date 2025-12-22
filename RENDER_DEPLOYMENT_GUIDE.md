# Render部署完整指南

## ✅ 代码迁移已完成

代码已经从SQLite迁移到MongoDB，所有查询已更新为Mongoose语法。

---

## 🚀 Render部署步骤

### 第一步：部署后端服务

1. **访问Render并登录**
   - 访问：https://dashboard.render.com
   - 使用GitHub账户登录（推荐）

2. **创建Web Service**
   - 点击 "New" → "Web Service"
   - 连接GitHub仓库：选择 `Li200858/-`
   - 配置如下：
     ```
     Name: activity-registration-backend
     Environment: Node
     Region: 选择最近的区域（如Singapore）
     Branch: main
     Root Directory: server
     Build Command: npm install
     Start Command: npm start
     Plan: Free
     ```

3. **配置环境变量**
   在 "Environment" 部分添加以下变量：
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://admin:Lcx200858~@cluster0.rmhqy7z.mongodb.net/activity-registration?retryWrites=true&w=majority
   CORS_ORIGIN=https://activity-registration-frontend.onrender.com
   ```
   ⚠️ **重要**：`CORS_ORIGIN` 需要等前端部署完成后，用实际的前端URL替换

4. **添加持久化磁盘（用于文件上传）**
   - Settings → Persistent Disk
   - Name: `uploads-disk`
   - Mount Path: `/opt/render/project/src/uploads`
   - Size: `1 GB`

5. **部署**
   - 点击 "Create Web Service"
   - 等待构建完成（约2-3分钟）
   - 记录后端URL（例如：`https://activity-registration-backend.onrender.com`）

---

### 第二步：部署前端

1. **创建Static Site**
   - Dashboard → "New" → "Static Site"
   - 连接GitHub仓库：`Li200858/-`
   - 配置如下：
     ```
     Name: activity-registration-frontend
     Branch: main
     Root Directory: client
     Build Command: npm install && npm run build
     Publish Directory: build
     Plan: Free
     ```

2. **配置环境变量**
   ```
   REACT_APP_API_URL=https://activity-registration-backend.onrender.com
   ```
   ⚠️ **重要**：将 `activity-registration-backend.onrender.com` 替换为你的实际后端URL

3. **部署**
   - 点击 "Create Static Site"
   - 等待构建完成（约3-5分钟）
   - 记录前端URL（例如：`https://activity-registration-frontend.onrender.com`）

---

### 第三步：更新后端CORS配置

1. **回到后端服务设置**
   - 进入后端服务的 "Environment" 设置
   - 更新 `CORS_ORIGIN` 为实际的前端URL：
     ```
     CORS_ORIGIN=https://你的前端URL.onrender.com
     ```
   - 保存更改（会自动重新部署）

---

### 第四步：更新前端硬编码URL（如果需要）

检查前端代码中是否还有硬编码的 `localhost:5001` URL，如果有需要更新为环境变量。

---

## 📋 部署检查清单

### 后端
- [ ] Web Service已创建
- [ ] 环境变量已设置（NODE_ENV, PORT, MONGODB_URI, CORS_ORIGIN）
- [ ] 持久化磁盘已添加
- [ ] 构建成功
- [ ] 服务运行正常

### 前端
- [ ] Static Site已创建
- [ ] 环境变量已设置（REACT_APP_API_URL）
- [ ] 构建成功
- [ ] 网站可以访问

### 连接测试
- [ ] 前端可以访问
- [ ] 前端可以连接到后端API
- [ ] 用户注册功能正常
- [ ] 用户登录功能正常
- [ ] 创建社团功能正常
- [ ] 创建活动功能正常

---

## 🔧 环境变量参考

### 后端环境变量
```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://admin:Lcx200858~@cluster0.rmhqy7z.mongodb.net/activity-registration?retryWrites=true&w=majority
CORS_ORIGIN=https://activity-registration-frontend.onrender.com
```

### 前端环境变量
```
REACT_APP_API_URL=https://activity-registration-backend.onrender.com
```

---

## ⚠️ 重要提示

1. **MongoDB连接字符串**：确保密码中的特殊字符 `~` 已正确编码（如果需要）
2. **CORS设置**：前后端URL必须匹配，否则会出现跨域错误
3. **环境变量**：Render中设置环境变量后需要重新部署
4. **免费限制**：Render免费版会在15分钟无活动后休眠，首次访问需要等待启动

---

## 🐛 故障排查

### 后端无法启动
- 检查MongoDB连接字符串是否正确
- 查看Render日志中的错误信息
- 确认环境变量已正确设置

### 前端无法连接后端
- 检查 `REACT_APP_API_URL` 是否正确
- 检查后端 `CORS_ORIGIN` 是否包含前端URL
- 查看浏览器控制台的错误信息

### MongoDB连接失败
- 确认MongoDB Atlas网络访问已配置（0.0.0.0/0）
- 验证连接字符串中的用户名和密码
- 检查数据库名称是否正确

---

## 🎉 完成！

部署成功后，你的网站将在以下地址可用：
- 前端：`https://activity-registration-frontend.onrender.com`
- 后端：`https://activity-registration-backend.onrender.com`

