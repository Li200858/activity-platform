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
  role: { type: String, enum: ['user', 'admin', 'super_admin'], default: 'user' }
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
  file: { type: String },
  founderID: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
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
  phaseTimeEnd: { type: String }
}, { timestamps: true });

// 社团成员模型
const ClubMemberSchema = new mongoose.Schema({
  userID: { type: String, required: true },
  clubID: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

// 活动报名模型
const ActivityRegistrationSchema = new mongoose.Schema({
  activityID: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  userID: { type: String, required: true },
  name: { type: String, required: true },
  class: { type: String, required: true },
  reason: { type: String },
  contact: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
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

// 创建模型
const User = mongoose.model('User', UserSchema);
const Club = mongoose.model('Club', ClubSchema);
const Activity = mongoose.model('Activity', ActivitySchema);
const ClubMember = mongoose.model('ClubMember', ClubMemberSchema);
const ActivityRegistration = mongoose.model('ActivityRegistration', ActivityRegistrationSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);

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
  Notification
};

