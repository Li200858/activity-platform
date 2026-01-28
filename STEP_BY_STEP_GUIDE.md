# 🎯 操作步骤指南（基于你的Cloudflare界面）

## 方案选择

你有两个选择：

### 方案A：购买新域名（推荐，更专业）
为活动报名网站购买一个独立的域名，比如 `activity-registration.com` 或 `huodong.com`

### 方案B：使用子域名（免费，快速）
如果你拥有 `hwartplatform.org`，可以使用子域名，比如：
- `activity.hwartplatform.org`（前端）
- `api-activity.hwartplatform.org`（后端）

---

## 🚀 方案A：购买新域名（推荐）

### 步骤1：购买域名

1. 在你当前的Cloudflare界面，点击 **"Buy a domain"**（购买域名）按钮
2. 搜索你想要的域名，例如：
   - `activity-registration.com`
   - `huodong.org`
   - `activity-platform.com`
   - 或其他你喜欢的名字
3. 选择价格合适的域名并购买
4. 购买完成后，域名会自动添加到你的Cloudflare账户

### 步骤2：配置DNS记录

域名购买后，会自动进入域名管理页面。如果没有，点击域名进入设置。

在 **"DNS"** 标签页中，添加以下记录：

#### 2.1 添加前端DNS记录

点击 **"Add record"**（添加记录），配置：

```
类型: CNAME
名称: www
目标: activity-registration-frontend.onrender.com
代理状态: 🟠 已代理（橙色云朵）← 必须打开！
TTL: 自动
```

点击保存。

#### 2.2 添加后端API DNS记录

再次点击 **"Add record"**，配置：

```
类型: CNAME
名称: api
目标: activity-registration-backend.onrender.com
代理状态: 🟠 已代理（橙色云朵）← 必须打开！
TTL: 自动
```

点击保存。

**重要**：确保两个记录的代理状态都是**橙色云朵**（已代理），不是灰色云朵！

### 步骤3：配置SSL/TLS

1. 点击左侧菜单的 **"SSL/TLS"**
2. 加密模式选择：**完全（Full）**
3. 确保 **"Always Use HTTPS"** 已开启

### 步骤4：更新Render配置

#### 4.1 更新后端CORS

1. 登录 Render Dashboard
2. 找到你的后端服务（`activity-registration-backend`）
3. 进入 **"Environment"** 设置
4. 添加或更新环境变量：
   ```
   CORS_ORIGIN=https://www.你的新域名.com
   ```
   例如：`CORS_ORIGIN=https://www.activity-registration.com`

#### 4.2 更新前端API地址

1. 在Render Dashboard找到你的前端服务（`activity-registration-frontend`）
2. 进入 **"Environment"** 设置
3. 添加或更新环境变量：
   ```
   REACT_APP_API_URL=https://api.你的新域名.com
   ```
   例如：`REACT_APP_API_URL=https://api.activity-registration.com`
4. 保存后，前端会自动重新部署

### 步骤5：等待生效

- DNS传播：通常5-30分钟
- SSL证书生成：通常5-10分钟
- 前端重新部署：通常3-5分钟

### 步骤6：测试

1. 访问 `https://www.你的新域名.com`
2. 打开浏览器开发者工具（F12）→ Network标签
3. 测试登录/注册功能
4. 确认API请求都通过 `api.你的新域名.com`

---

## 🚀 方案B：使用子域名（免费快速）

如果你不想买新域名，可以使用 `hwartplatform.org` 的子域名。

### 步骤1：添加子域名DNS记录

1. 在Cloudflare Dashboard，点击 **"hwartplatform.org"** 域名
2. 进入 **"DNS"** 标签页
3. 点击 **"Add record"**（添加记录）

#### 添加前端子域名：

```
类型: CNAME
名称: activity（或你喜欢的名字）
目标: activity-registration-frontend.onrender.com
代理状态: 🟠 已代理（橙色云朵）
TTL: 自动
```

保存后，前端访问地址将是：`https://activity.hwartplatform.org`

#### 添加后端API子域名：

```
类型: CNAME
名称: api-activity（或你喜欢的名字）
目标: activity-registration-backend.onrender.com
代理状态: 🟠 已代理（橙色云朵）
TTL: 自动
```

保存后，API地址将是：`https://api-activity.hwartplatform.org`

### 步骤2：配置SSL/TLS

1. 点击左侧 **"SSL/TLS"**
2. 加密模式：**完全（Full）**
3. 开启 **"Always Use HTTPS"**

### 步骤3：更新Render配置

#### 后端CORS：
```
CORS_ORIGIN=https://activity.hwartplatform.org
```

#### 前端API地址：
```
REACT_APP_API_URL=https://api-activity.hwartplatform.org
```

### 步骤4：等待并测试

等待DNS传播（5-30分钟），然后访问 `https://activity.hwartplatform.org` 测试。

---

## ⚠️ 重要提示

### 必须确保的事项：

1. ✅ **DNS记录的代理状态必须是橙色云朵**（已代理）
   - 如果是灰色云朵，点击它切换为橙色
   - 这是解决问题的关键！

2. ✅ **SSL/TLS模式必须是"完全（Full）"**
   - 不是"灵活"或"关闭"

3. ✅ **等待DNS传播完成**
   - 可以使用 https://www.whatsmydns.net 检查
   - 输入你的域名，查看全球DNS状态

4. ✅ **清除浏览器缓存**
   - 配置完成后，清除缓存或使用无痕模式测试

---

## 🔍 如何确认配置正确？

### 检查DNS记录：

1. 在Cloudflare DNS页面，确认：
   - ✅ 记录类型是 CNAME
   - ✅ 目标地址正确（指向你的Render服务）
   - ✅ 代理状态是**橙色云朵**（不是灰色）

### 检查SSL：

1. 在SSL/TLS页面，确认：
   - ✅ 加密模式是"完全（Full）"
   - ✅ "Always Use HTTPS"已开启
   - ✅ SSL证书状态是"有效"

### 测试访问：

1. 访问你的域名（应该自动跳转到HTTPS）
2. 打开开发者工具（F12）→ Network
3. 查看请求是否都通过你的域名
4. 确认没有CORS错误

---

## 💡 推荐方案

**如果你预算允许**：推荐方案A（购买新域名）
- 更专业
- 独立品牌
- 不影响现有网站

**如果想快速免费解决**：推荐方案B（使用子域名）
- 完全免费
- 设置快速
- 5分钟搞定

---

## 🆘 如果遇到问题

### DNS未生效？
- 等待更长时间（最多24小时）
- 清除本地DNS缓存
- 使用不同网络测试

### 502错误？
- 检查DNS目标地址是否正确
- 确认Render服务正常运行
- 检查SSL/TLS模式

### 仍然需要VPN？
- 确认代理状态是橙色云朵
- 等待DNS完全传播
- 清除浏览器缓存

---

## ✅ 完成检查清单

- [ ] DNS记录已添加（www和api）
- [ ] DNS代理状态是橙色云朵
- [ ] SSL/TLS模式是"完全"
- [ ] Render后端CORS已更新
- [ ] Render前端API地址已更新
- [ ] 等待DNS传播（检查whatsmydns.net）
- [ ] 测试访问成功（无需VPN）

完成这些步骤后，你的网站就可以正常访问了！🎉



