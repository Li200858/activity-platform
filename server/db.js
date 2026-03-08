const mongoose = require('mongoose');

// MongoDB连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/activity-registration';

// 连接选项
const connectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

// 连接MongoDB
mongoose.connect(MONGODB_URI, connectOptions)
  .then(() => console.log('✅ MongoDB连接成功'))
  .catch(err => {
    console.error('❌ MongoDB连接失败:', err);
    process.exit(1);
  });

// 用户模型
const UserSchema = new mongoose.Schema({
  userID: { type: String, unique: true, required: true },
  name: { type: String, required: true, unique: true },
  class: { type: String, required: true },
  // 英文名（可选，给外教查看）
  englishName: { type: String },
  role: { type: String, enum: ['user', 'admin', 'super_admin'], default: 'user' },
  pinHash: { type: String }, // 可选 4-6 位 PIN 的哈希，用于防冒充
  lastLoginAt: { type: Date } // 上次登录时间
}, { timestamps: true });

// 社团模型
const ClubSchema = new mongoose.Schema({
  name: { type: String, required: true },
  intro: { type: String },
  content: { type: String },
  location: { type: String },
  time: { type: String },
  duration: { type: String },
  weeks: { type: Number },
  capacity: { type: Number },
  contact: { type: String }, // 联系方式，用于线下联系
  file: { type: String },
  founderID: { type: String },
  actualLeaderName: { type: String }, // 实际负责人（代老师创建时填写，如「张老师」）
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  // 社团分类：日常 | 周三 | both（既是周三也有日常，占周三名额且出现在两个列表）
  category: { type: String, enum: ['daily', 'wednesday', 'both'], default: 'wednesday' },
  // 改革方案：社团类型与时间板块（仅周三社团使用）
  type: { type: String, enum: ['academic', 'activity'], default: 'activity' },
  blocks: { type: [String], default: [] }, // block1~block4，最多选3个
  coreMemberIDs: { type: [String], default: [] }
}, { timestamps: true });

// 活动模型
const ActivitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  capacity: { type: Number },
  time: { type: String },
  location: { type: String },
  description: { type: String },
  flow: { type: String },
  requirements: { type: String },
  file: { type: String },
  organizerID: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  currentPhase: { type: String, default: '活动准备' },
  phaseTimePreparation: { type: String },
  phaseTimeStart: { type: String },
  phaseTimeInProgress: { type: String },
  phaseTimeEnd: { type: String },
  // 付费相关字段
  hasFee: { type: Boolean, default: false },
  feeAmount: { type: String }, // 费用金额（字符串，支持如"50元"这样的格式）
  paymentQRCode: { type: String } // 支付二维码文件名（微信/支付宝）
}, { timestamps: true });

// 社团成员模型（同一用户对同一社团只能有一条记录，被拒绝后可再次申请会更新该记录）
const ClubMemberSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  clubID: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });
ClubMemberSchema.index({ userID: 1, clubID: 1 }, { unique: true });

// 活动报名模型
const ActivityRegistrationSchema = new mongoose.Schema({
  activityID: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  userID: { type: String, required: true },
  name: { type: String, required: true },
  class: { type: String, required: true },
  reason: { type: String },
  contact: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  // 付费相关字段
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'pending_verification'], default: 'unpaid' }, // 支付状态
  paymentProof: { type: String } // 支付凭证（截图文件名，可选）
}, { timestamps: true });

// 通知模型
const NotificationSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  type: { type: String, required: true },
  relatedID: { type: String },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

// 反馈模型
const FeedbackSchema = new mongoose.Schema({
  content: { type: String, required: true },
  authorID: { type: String, required: true },
  authorName: { type: String },
  authorClass: { type: String },
  media: { type: String }, // JSON string
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  adminReply: { type: String }
}, { timestamps: true });

// 每学期轮换次数记录（非核心成员一学期 5 次轮换限制）
const SemesterRotationSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  semester: { type: String, required: true }, // 如 "2025-spring" / "2025-fall"
  count: { type: Number, default: 0 }
}, { timestamps: true });
SemesterRotationSchema.index({ userID: 1, semester: 1 }, { unique: true });

// 周三社团最终确认（每学期一次，确认后无法直接退出，只能通过轮换更改）
const WednesdayConfirmationSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  semester: { type: String, required: true } // 如 "2025-spring" / "2025-fall"
}, { timestamps: true });
WednesdayConfirmationSchema.index({ userID: 1, semester: 1 }, { unique: true });

// 点名场次（核心人员发起的某次点名）
const ClubAttendanceSessionSchema = new mongoose.Schema({
  clubID: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  note: { type: String },
  recordedByUserID: { type: String, required: true }
}, { timestamps: true });

// 出勤记录（只存出席的；未在此列表的成员视为缺席）
const ClubAttendanceRecordSchema = new mongoose.Schema({
  sessionID: { type: mongoose.Schema.Types.ObjectId, ref: 'ClubAttendanceSession', required: true },
  userID: { type: String, required: true }
}, { timestamps: true });
ClubAttendanceRecordSchema.index({ sessionID: 1, userID: 1 }, { unique: true });

// 场地申请（社团提交）
const ClubVenueRequestSchema = new mongoose.Schema({
  clubID: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  semester: { type: String, required: true }, // 2026-spring
  blocks: { type: [String], default: [] },   // ['block2','block3']
  note: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

// 场地排期（管理员排期后的结果）
const ClubVenueScheduleSchema = new mongoose.Schema({
  clubID: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  semester: { type: String, required: true },
  date: { type: String, required: true },   // YYYY-MM-DD
  block: { type: String, required: true },  // block1~block4
  venueName: { type: String, required: true }
}, { timestamps: true });

// 用户找回ID请求
const IDRecoveryRequestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  class: { type: String, required: true },
  email: { type: String, required: true },
  userIDFound: { type: String }, // 系统根据姓名+班级预匹配到的 userID（如有）
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  note: { type: String },
  operatorID: { type: String }, // 处理该请求的管理员ID
  resolvedAt: { type: Date }
}, { timestamps: true });

// 创建模型
const User = mongoose.model('User', UserSchema);
const Club = mongoose.model('Club', ClubSchema);
const Activity = mongoose.model('Activity', ActivitySchema);
const ClubMember = mongoose.model('ClubMember', ClubMemberSchema);
const ActivityRegistration = mongoose.model('ActivityRegistration', ActivityRegistrationSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);
const SemesterRotation = mongoose.model('SemesterRotation', SemesterRotationSchema);
const WednesdayConfirmation = mongoose.model('WednesdayConfirmation', WednesdayConfirmationSchema);
const ClubAttendanceSession = mongoose.model('ClubAttendanceSession', ClubAttendanceSessionSchema);
const ClubAttendanceRecord = mongoose.model('ClubAttendanceRecord', ClubAttendanceRecordSchema);
const ClubVenueRequest = mongoose.model('ClubVenueRequest', ClubVenueRequestSchema);
const ClubVenueSchedule = mongoose.model('ClubVenueSchedule', ClubVenueScheduleSchema);
const IDRecoveryRequest = mongoose.model('IDRecoveryRequest', IDRecoveryRequestSchema);

// 为了兼容Sequelize的API，创建一些包装方法
const sequelize = {
  sync: () => Promise.resolve(), // MongoDB不需要sync
  Sequelize: {
    Op: {
      or: '$or',
      like: { $regex: '', $options: 'i' },
      ne: '$ne'
    },
    QueryTypes: {
      SELECT: 'SELECT'
    }
  },
  query: (query, options) => {
    // 简单的查询转换（如果需要）
    return Promise.resolve([]);
  }
};

module.exports = {
  mongoose,
  sequelize,
  User,
  Club,
  Activity,
  ClubMember,
  ActivityRegistration,
  Feedback,
  Notification,
  SemesterRotation,
  WednesdayConfirmation,
  ClubAttendanceSession,
  ClubAttendanceRecord,
  ClubVenueRequest,
  ClubVenueSchedule,
  IDRecoveryRequest
};
