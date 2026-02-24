# MongoDB迁移和Render部署指南

## 📋 迁移概览

本指南将帮助你：
1. 从 SQLite 迁移到 MongoDB
2. 在 Render 上部署后端和前端
3. 配置生产环境

---

## 第一步：准备MongoDB数据库

### 1.1 创建MongoDB Atlas账户（免费）

1. 访问 https://www.mongodb.com/cloud/atlas/register
2. 注册账户（使用Google账户或邮箱）
3. 选择免费套餐（M0 Sandbox）

### 1.2 创建集群

1. 选择云服务商和区域（推荐选择离你最近的）
2. 集群名称：`活动报名网站` 或 `activity-registration`
3. 点击 "Create Cluster"

### 1.3 配置数据库访问

1. **创建数据库用户**：
   - 左侧菜单 → Database Access → Add New Database User
   - 用户名：`activity-admin`（或自定义）
   - 密码：生成强密码（保存好！）
   - 权限：Atlas admin 或 Read and write to any database

2. **配置网络访问**：
   - 左侧菜单 → Network Access → Add IP Address
   - 选择 "Allow Access from Anywhere" (0.0.0.0/0) - 用于Render部署
   - 或添加特定IP地址（更安全）

### 1.4 获取连接字符串

1. 左侧菜单 → Database → Connect
2. 选择 "Connect your application"
3. 选择 Driver: Node.js, Version: 5.5 or later
4. 复制连接字符串，格式如下：
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. 替换 `<username>` 和 `<password>` 为你的数据库用户名和密码
6. 在末尾添加数据库名称：
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/activity-registration?retryWrites=true&w=majority
   ```

---

## 第二步：本地迁移代码

### 2.1 安装MongoDB依赖

```bash
cd server
npm install mongoose
npm uninstall sqlite3 sequelize
```

### 2.2 更新数据库配置

代码已经准备好迁移，按照后续步骤操作即可。

### 2.3 测试本地连接

1. 创建 `.env` 文件（见下方配置）
2. 运行 `npm run dev` 测试连接

---

## 第三步：Render部署配置

### 3.1 创建Render账户

1. 访问 https://render.com
2. 使用GitHub账户登录（推荐）

### 3.2 部署后端服务

1. **创建Web Service**：
   - Dashboard → New → Web Service
   - 连接你的GitHub仓库：`Li200858/-`
   - 名称：`activity-registration-backend`
   - 环境：Node
   - 根目录：`server`
   - 构建命令：`npm install`
   - 启动命令：`npm start`
   - 计划：选择免费计划（Free）

2. **配置环境变量**：
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=你的MongoDB连接字符串
   CORS_ORIGIN=https://你的前端域名.onrender.com
   ```

3. **添加持久化磁盘**（用于文件上传）：
   - Settings → Persistent Disk
   - 挂载路径：`/opt/render/project/src/uploads`
   - 大小：1GB（免费）

### 3.3 部署前端

1. **创建Static Site**：
   - Dashboard → New → Static Site
   - 连接你的GitHub仓库：`Li200858/-`
   - 名称：`activity-registration-frontend`
   - 根目录：`client`
   - 构建命令：`npm install && npm run build`
   - 发布目录：`build`

2. **配置环境变量**：
   ```
   REACT_APP_API_URL=https://你的后端域名.onrender.com
   ```

---

## 第四步：环境变量配置

### 后端环境变量（Render）

在Render的Web Service设置中添加：

```
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/activity-registration?retryWrites=true&w=majority
CORS_ORIGIN=https://activity-registration-frontend.onrender.com
```

### 前端环境变量（Render）

在Render的Static Site设置中添加：

```
REACT_APP_API_URL=https://activity-registration-backend.onrender.com
```

---

## 第五步：验证部署

1. 访问前端URL：`https://activity-registration-frontend.onrender.com`
2. 测试功能：
   - 用户注册/登录
   - 创建社团/活动
   - 文件上传
   - 实时通知

---

## 注意事项

### MongoDB Atlas免费限制
- 512MB存储空间
- 共享CPU和RAM
- 适合中小型应用

### Render免费限制
- 服务会在15分钟无活动后休眠
- 首次访问需要等待启动（约30秒）
- 可以升级到付费计划避免休眠

### 安全建议
1. 使用强密码
2. 限制MongoDB网络访问（如果可能）
3. 定期备份数据库
4. 使用环境变量存储敏感信息

---

## 故障排查

### 后端无法连接MongoDB
- 检查MongoDB Atlas网络访问设置
- 验证连接字符串中的用户名和密码
- 确认数据库名称正确

### 前端无法连接后端
- 检查CORS_ORIGIN配置
- 验证REACT_APP_API_URL是否正确
- 检查后端服务是否运行

### 文件上传失败
- 确认持久化磁盘已正确挂载
- 检查uploads目录权限

---

## 下一步

完成迁移后，你可以：
1. 设置自定义域名
2. 配置SSL证书（Render自动提供）
3. 设置自动备份
4. 监控服务状态




