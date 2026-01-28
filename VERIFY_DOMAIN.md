# ✅ 验证域名配置指南

## 📋 根据你的Render配置，需要添加以下DNS记录

从你的Render界面可以看到：
- 前端服务：`activity-platform`
- 需要验证的域名：
  1. `www.activityplatform.org` → 需要 CNAME 记录
  2. `activityplatform.org` → 需要 ANAME/ALIAS 或 A 记录

---

## 🚀 在Cloudflare中配置DNS记录

### 步骤1：进入Cloudflare DNS设置

1. 登录 Cloudflare Dashboard
2. 点击你的域名 `activityplatform.org`
3. 点击左侧菜单的 **"DNS"** 标签页

### 步骤2：添加 www 子域名（CNAME记录）

1. 点击 **"Add record"**（添加记录）按钮
2. 配置如下：

```
类型: CNAME
名称: www
目标: activity-platform.onrender.com
代理状态: 🟠 已代理（橙色云朵）← 必须打开！
TTL: 自动
```

3. 点击 **"Save"**（保存）

**重要**：确保代理状态是**橙色云朵**（已代理），不是灰色！

### 步骤3：添加根域名（ANAME/ALIAS记录）

Cloudflare支持ANAME/ALIAS类型的记录，但显示为CNAME。对于根域名，Cloudflare会自动处理。

1. 点击 **"Add record"**（添加记录）按钮
2. 配置如下：

```
类型: CNAME
名称: @
目标: activity-platform.onrender.com
代理状态: 🟠 已代理（橙色云朵）← 必须打开！
TTL: 自动
```

**注意**：
- Cloudflare会自动将根域名的CNAME转换为ANAME/ALIAS
- 如果Cloudflare不允许根域名使用CNAME，则使用下面的A记录方案

### 步骤3（备选）：如果CNAME不行，使用A记录

如果Cloudflare不允许根域名使用CNAME，则添加A记录：

1. 点击 **"Add record"**（添加记录）
2. 配置如下：

```
类型: A
名称: @
IPv4地址: 216.24.57.1
代理状态: 🟠 已代理（橙色云朵）← 必须打开！
TTL: 自动
```

3. 点击 **"Save"**（保存）

---

## ⏱️ 等待DNS传播

配置完成后：
1. **等待5-30分钟**让DNS记录传播
2. 可以使用 https://www.whatsmydns.net 检查DNS是否已传播
   - 输入 `www.activityplatform.org` 检查
   - 输入 `activityplatform.org` 检查

---

## ✅ 在Render中验证域名

DNS记录添加并传播后：

1. 回到 Render Dashboard
2. 进入你的 `activity-platform` 服务
3. 点击 **"Custom Domains"** 标签
4. 点击每个域名旁边的 **"Verify"**（验证）按钮
5. 等待几秒钟，应该会显示绿色的勾号 ✅

**如果验证失败**：
- 确认DNS记录已正确添加
- 确认代理状态是橙色云朵
- 等待更长时间（最多24小时）
- 检查DNS记录的目标地址是否正确

---

## 🔧 配置后端API域名（重要！）

验证完前端域名后，还需要配置后端API域名：

### 在Cloudflare中添加后端API DNS记录

1. 在Cloudflare DNS页面，点击 **"Add record"**
2. 配置后端API记录：

```
类型: CNAME
名称: api
目标: activity-registration-backend.onrender.com
代理状态: 🟠 已代理（橙色云朵）← 必须打开！
TTL: 自动
```

**注意**：请将 `activity-registration-backend.onrender.com` 替换为你实际的后端服务地址。

3. 点击 **"Save"**（保存）

### 在Render后端服务中添加自定义域名（可选）

如果你想为后端也添加自定义域名：

1. 在Render Dashboard找到你的后端服务
2. 进入 **"Custom Domains"** 设置
3. 添加 `api.activityplatform.org`
4. 在Cloudflare中添加相应的DNS记录

---

## 📝 更新Render环境变量

### 更新前端环境变量

1. 在Render Dashboard，进入 `activity-platform` 服务
2. 点击 **"Environment"**（环境变量）
3. 添加或更新：

```
REACT_APP_API_URL=https://api.activityplatform.org
```

（如果后端也配置了自定义域名）
或者：

```
REACT_APP_API_URL=https://activity-registration-backend.onrender.com
```

（如果后端使用Render默认域名）

### 更新后端环境变量

1. 在Render Dashboard，进入你的后端服务
2. 点击 **"Environment"**（环境变量）
3. 添加或更新：

```
CORS_ORIGIN=https://www.activityplatform.org,https://activityplatform.org
```

---

## ✅ 完成检查清单

配置完成后，确认：

- [ ] Cloudflare中已添加 `www` CNAME记录（指向 `activity-platform.onrender.com`）
- [ ] Cloudflare中已添加 `@` CNAME或A记录（指向 `activity-platform.onrender.com` 或 `216.24.57.1`）
- [ ] 所有DNS记录的代理状态都是**橙色云朵**（已代理）
- [ ] 等待DNS传播（使用whatsmydns.net检查）
- [ ] 在Render中点击"Verify"按钮验证域名
- [ ] 两个域名都显示绿色勾号 ✅
- [ ] 配置了后端API的DNS记录（api子域名）
- [ ] 更新了Render环境变量（前端API地址和后端CORS）

---

## 🎉 完成！

验证完成后：
- ✅ 前端可以通过 `https://www.activityplatform.org` 访问
- ✅ 前端可以通过 `https://activityplatform.org` 访问
- ✅ API通过 `https://api.activityplatform.org` 访问
- ✅ 用户无需VPN即可访问

如果验证过程中遇到任何问题，告诉我！



