const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.NODE_ENV === 'production' 
  ? '/opt/render/project/src/db/database.sqlite' 
  : path.join(dbDir, 'database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false
});

const User = sequelize.define('User', {
  userID: { type: DataTypes.STRING, unique: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  class: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'admin', 'super_admin'), defaultValue: 'user' }
});

const Club = sequelize.define('Club', {
  name: { type: DataTypes.STRING, allowNull: false },
  intro: { type: DataTypes.TEXT },
  content: { type: DataTypes.TEXT },
  location: { type: DataTypes.STRING },
  time: { type: DataTypes.STRING },
  duration: { type: DataTypes.STRING },
  weeks: { type: DataTypes.INTEGER },
  capacity: { type: DataTypes.INTEGER },
  file: { type: DataTypes.STRING },
  founderID: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' }
});

const Activity = sequelize.define('Activity', {
  name: { type: DataTypes.STRING, allowNull: false },
  capacity: { type: DataTypes.INTEGER },
  time: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  flow: { type: DataTypes.TEXT },
  requirements: { type: DataTypes.TEXT },
  file: { type: DataTypes.STRING },
  organizerID: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  currentPhase: { type: DataTypes.STRING, defaultValue: '活动准备' },
  phaseTimePreparation: { type: DataTypes.STRING }, // 活动准备阶段时间
  phaseTimeStart: { type: DataTypes.STRING }, // 活动开始阶段时间
  phaseTimeInProgress: { type: DataTypes.STRING }, // 活动中阶段时间
  phaseTimeEnd: { type: DataTypes.STRING } // 活动结束阶段时间
});

const ClubMember = sequelize.define('ClubMember', {
  userID: { type: DataTypes.STRING },
  clubID: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' }
});

const ActivityRegistration = sequelize.define('ActivityRegistration', {
  activityID: { type: DataTypes.INTEGER },
  userID: { type: DataTypes.STRING },
  name: { type: DataTypes.STRING },
  class: { type: DataTypes.STRING },
  reason: { type: DataTypes.TEXT },
  contact: { type: DataTypes.STRING },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' }
});

const Notification = sequelize.define('Notification', {
  userID: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  relatedID: { type: DataTypes.STRING },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const Feedback = sequelize.define('Feedback', {
  content: { type: DataTypes.TEXT, allowNull: false },
  authorID: { type: DataTypes.STRING },
  authorName: { type: DataTypes.STRING },
  authorClass: { type: DataTypes.STRING },
  media: { type: DataTypes.TEXT }, // JSON string
  status: { type: DataTypes.ENUM('pending', 'resolved'), defaultValue: 'pending' },
  adminReply: { type: DataTypes.TEXT }
});

// 建立关系
Club.hasMany(ClubMember, { foreignKey: 'clubID' });
ClubMember.belongsTo(Club, { foreignKey: 'clubID' });
ClubMember.belongsTo(User, { foreignKey: 'userID' });
Activity.hasMany(ActivityRegistration, { foreignKey: 'activityID' });
ActivityRegistration.belongsTo(Activity, { foreignKey: 'activityID' });

module.exports = { sequelize, User, Club, Activity, ClubMember, ActivityRegistration, Feedback, Notification };


