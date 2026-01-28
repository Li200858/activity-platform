# 🚀 快速解决方案：使用Cloudflare Workers（无需域名）

如果你**没有域名**，这是最快的解决方案，5分钟搞定！

## 步骤1：创建Cloudflare账户（1分钟）

1. 访问：https://dash.cloudflare.com/sign-up
2. 注册免费账户（完全免费，无需信用卡）

## 步骤2：创建Worker（2分钟）

1. 登录后，点击左侧菜单 "Workers & Pages"
2. 点击 "Create application" → "Create Worker"
3. 给Worker起个名字，例如：`api-proxy`
4. 点击 "Deploy"

## 步骤3：复制代理代码（1分钟）

1. 在Worker编辑器中，删除默认代码
2. 复制 `cloudflare-worker-proxy.js` 文件中的代码
3. 粘贴到Worker编辑器
4. **重要**：修改第5行的 `BACKEND_URL` 为你的实际Render后端地址
   ```javascript
   const BACKEND_URL = 'https://你的后端地址.onrender.com';
   ```
5. 点击 "Save and deploy"

## 步骤4：获取Worker URL（30秒）

部署成功后，你会看到一个URL，例如：
```
https://api-proxy.你的用户名.workers.dev
```

复制这个URL！

## 步骤5：更新前端配置（1分钟）

1. 登录Render Dashboard
2. 找到你的前端服务（Static Site）
3. 进入 "Environment" 设置
4. 更新环境变量：
   ```
   REACT_APP_API_URL=https://api-proxy.你的用户名.workers.dev
   ```
5. 保存并等待重新部署

## 步骤6：测试（30秒）

等待前端重新部署完成后：
1. 访问你的前端网站
2. 打开浏览器开发者工具（F12）
3. 查看Network标签，确认API请求都通过Worker代理

## ✅ 完成！

现在你的网站应该可以正常访问了，无需VPN！

---

## 🔍 如果还有问题

### 检查清单：
- [ ] Worker已成功部署
- [ ] Worker URL可以访问（应该返回404或错误，但能连接）
- [ ] 前端环境变量已更新
- [ ] 前端已重新部署
- [ ] 清除浏览器缓存后重试

### 常见问题：

**Q: Worker返回502错误**
A: 检查BACKEND_URL是否正确，确保是完整的HTTPS URL

**Q: 仍然需要VPN**
A: 等待几分钟让DNS传播，或尝试清除DNS缓存：
   - Windows: `ipconfig /flushdns`
   - Mac: `sudo dscacheutil -flushcache`

**Q: CORS错误**
A: Worker代码已经处理了CORS，如果还有问题，检查后端CORS配置

---

## 💡 进阶：使用自定义域名（可选）

如果你有域名，可以：
1. 在Cloudflare中添加域名
2. 配置DNS指向Worker
3. 使用自定义域名访问（更专业）

详见 `CLOUDFLARE_SETUP.md`



