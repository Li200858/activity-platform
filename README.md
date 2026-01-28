# 活动报名与设计系统

这是一个专为活动设计和报名制作的系统，采用 Node.js (Express) + React + SQLite 构建。

## 功能特性

### 1. 社团事宜
- **社团报名**：用户必须先报名社团。
- **社团轮换**：仅在规定时间内（周日 17:00 - 周四 21:50）允许更换社团。
- **社团创建**：由创始人设置信息，提交后需管理员审核。
- **在线文档**：实时生成的社团及成员名单。

### 2. 活动事宜
- **活动组织**：填写详细信息（名称、人数、流程、需求等），管理员审核后发布。
- **活动报名**：用户填写申请表，由活动组织者审核。
- **阶段管理**：
  - 标准化流程：准备阶段 -> 开始 -> 结束。
  - 可视化时间轴：自动高亮当前阶段。
  - 灵活自定义：支持插入自定义阶段。
  - 统一时间同步：采用服务器基准时间。

### 3. 审核系统
- **管理员**：管理所有社团创建、活动创建、活动报名。
- **普通用户**：查看自己的各项状态。
- **组织者**：审核自己活动的报名。

### 4. 身份系统
- 基于 Unique ID 的身份同步逻辑，支持 ID 复制。

## 部署说明 (Render)

1. **后端部署**：
   - 运行环境：Node.js
   - 构建命令：`cd server && npm install`
   - 启动命令：`cd server && npm start`
   - **持久化存储**：在 Render 控制面板添加一个 Disk，挂载路径设为 `/opt/render/project/src/db`，并将 `NODE_ENV` 设为 `production`。

2. **前端部署**：
   - 运行环境：Static Site 或 Node.js
   - 构建命令：`cd client && npm install && npm run build`
   - 启动命令：`serve -s build`

## 本地开发

1. **启动后端**：
   ```bash
   cd server
   npm install
   npm run dev
   ```

2. **启动前端**：
   ```bash
   cd client
   npm install
   npm start
   ```

## 数据库
使用 SQLite3 存储在 `server/db/database.sqlite` 中。








