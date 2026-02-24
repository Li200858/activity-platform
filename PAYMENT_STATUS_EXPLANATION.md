# 💰 支付状态记录机制说明

## 📊 支付状态字段

在 `ActivityRegistration`（活动报名）模型中，有一个 `paymentStatus` 字段，用于记录支付状态：

```javascript
paymentStatus: {
  type: String,
  enum: ['unpaid', 'paid', 'pending_verification'],
  default: 'unpaid'
}
```

### 三种状态：

1. **`unpaid`** - 未支付
   - 活动有费用但用户未上传支付凭证
   - 或活动没有费用

2. **`pending_verification`** - 待审核
   - 用户已上传支付截图
   - 等待创建者审核支付凭证

3. **`paid`** - 已支付
   - 创建者审核通过报名申请
   - 系统自动将状态更新为"已支付"

---

## 🔄 支付状态流转过程

### 1. 用户报名时（`/api/activities/register`）

```javascript
// 如果活动有费用
if (activity.hasFee) {
  if (上传了支付凭证) {
    paymentStatus = 'pending_verification'  // 待审核
  } else {
    paymentStatus = 'unpaid'  // 未支付（会报错，不允许提交）
  }
} else {
  paymentStatus = 'unpaid'  // 活动没有费用
}
```

**代码位置**：`server/index.js` 第 373 行

---

### 2. 创建者审核时（`/api/audit/approve`）

```javascript
// 当审核通过时
if (status === 'approved') {
  if (activity.hasFee && item.paymentProof) {
    paymentStatus = 'paid'  // 审核通过，标记为已支付
  }
}
// 当审核拒绝时，paymentStatus 保持不变
```

**代码位置**：`server/index.js` 第 617-640 行

---

## 📝 完整流程示例

### 场景：用户报名一个需要付费的活动

1. **用户提交报名**
   - 上传支付截图
   - `paymentStatus` = `'pending_verification'` ✅
   - `status` = `'pending'`（报名状态：待审核）

2. **创建者查看申请**
   - 在审核页面看到"已上传支付凭证"
   - 点击查看支付截图
   - 验证支付是否正确

3. **创建者审核通过**
   - 点击"通过"按钮
   - 系统自动更新：
     - `status` = `'approved'`（报名状态：已通过）
     - `paymentStatus` = `'paid'`（支付状态：已支付）✅

4. **创建者审核拒绝**
   - 点击"拒绝"按钮
   - 系统更新：
     - `status` = `'rejected'`（报名状态：已拒绝）
     - `paymentStatus` = 保持不变（仍然是 `'pending_verification'`）

---

## 🔍 如何查看支付状态

### 1. 在审核页面
- 显示在报名申请列表中
- 显示在详情模态框中

### 2. 在参与者列表
- 显示支付凭证列
- 可以查看支付截图

### 3. 在数据库查询
```javascript
// 查询所有已支付的报名
ActivityRegistration.find({ 
  paymentStatus: 'paid',
  status: 'approved'
})

// 查询待审核支付的报名
ActivityRegistration.find({ 
  paymentStatus: 'pending_verification',
  status: 'pending'
})
```

---

## ⚠️ 注意事项

1. **支付状态是自动更新的**
   - 用户上传支付凭证后 → `pending_verification`
   - 创建者审核通过后 → `paid`
   - 不需要手动设置

2. **支付状态与报名状态是分开的**
   - `status`：报名状态（pending/approved/rejected）
   - `paymentStatus`：支付状态（unpaid/pending_verification/paid）

3. **只有审核通过才会标记为已支付**
   - 如果创建者拒绝申请，支付状态不会更新
   - 这样可以保留记录，方便后续处理

---

## 💡 总结

**系统记录支付状态的方式：**

1. ✅ **报名时**：根据是否上传支付凭证，设置为 `unpaid` 或 `pending_verification`
2. ✅ **审核通过时**：自动更新为 `paid`
3. ✅ **审核拒绝时**：保持原状态不变

**所有状态都保存在数据库中**，可以随时查询和统计。




