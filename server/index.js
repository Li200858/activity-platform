const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const { 
  sequelize, User, Club, Activity, ClubMember, ActivityRegistration, Feedback, Notification 
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

const PORT = 5001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// 轮换时间检查
const isRotationAllowed = () => {
  const now = moment();
  const day = now.day(); 
  const hour = now.hour();
  const minute = now.minute();
  if (day === 0 && (hour >= 17)) return true;
  if (day >= 1 && day <= 3) return true;
  if (day === 4 && (hour < 21 || (hour === 21 && minute <= 50))) return true;
  return false;
};

// --- API 路由 ---

// 用户注册与登录
app.post('/api/user/register', async (req, res) => {
  try {
    const { name, class: userClass } = req.body;
    const existing = await User.findOne({ where: { name } });
    if (existing) return res.status(400).json({ error: '该姓名已被注册' });
    const userID = uuidv4().substring(0, 8).toUpperCase();
    const role = (name === '管理员' || (name === '李昌轩' && userClass === 'NEE4')) ? 'super_admin' : 'user';
    const user = await User.create({ userID, name, class: userClass, role });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/login', async (req, res) => {
  try {
    const { userID, name, class: userClass } = req.body;
    const user = await User.findByPk(userID);
    if (!user || user.name !== name || user.class !== userClass) return res.status(401).json({ error: '信息不匹配' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 统一搜索
app.get('/api/search', async (req, res) => {
  try {
    const { q, operatorID } = req.query;
    const operator = await User.findByPk(operatorID);
    const isAdmin = operator && (operator.role === 'admin' || operator.role === 'super_admin');
    const users = await User.findAll({ where: { [sequelize.Sequelize.Op.or]: [{ name: { [sequelize.Sequelize.Op.like]: `%${q}%` } }, { userID: { [sequelize.Sequelize.Op.like]: `%${q}%` } }] } });
    const formattedUsers = users.map(u => ({ name: u.name, class: u.class, role: u.role, userID: isAdmin ? u.userID : null }));
    const clubs = await Club.findAll({ where: { name: { [sequelize.Sequelize.Op.like]: `%${q}%` }, status: 'approved' } });
    const activities = await Activity.findAll({ where: { name: { [sequelize.Sequelize.Op.like]: `%${q}%` }, status: 'approved' } });
    res.json({ users: formattedUsers, clubs, activities });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 社团
app.post('/api/clubs', upload.single('file'), async (req, res) => {
  try {
    const club = await Club.create({ ...req.body, file: req.file ? req.file.filename : null, status: 'pending' });
    io.emit('notification_update', { type: 'new_audit' });
    res.json(club);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/approved', async (req, res) => {
  try {
    const clubs = await Club.findAll({ 
      where: { status: 'approved' },
      include: [{
        model: ClubMember,
        where: { status: 'approved' },
        required: false
      }]
    });
    // 计算每个社团的当前人数并添加创建者信息
    const result = await Promise.all(clubs.map(async (club) => {
      const plain = club.get({ plain: true });
      plain.memberCount = plain.ClubMembers ? plain.ClubMembers.length : 0;
      delete plain.ClubMembers;
      
      // 获取创建者信息
      let founderName = null;
      let founderClass = null;
      if (plain.founderID) {
        const founder = await User.findByPk(plain.founderID);
        if (founder) {
          founderName = founder.name;
          founderClass = founder.class;
        }
      }
      plain.founderName = founderName;
      plain.founderClass = founderClass;
      
      return plain;
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/my/:userID', async (req, res) => {
  try {
    const member = await ClubMember.findOne({ 
      where: { userID: req.params.userID },
      include: [Club]
    });
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/leave', async (req, res) => {
  try {
    await ClubMember.destroy({ where: { userID: req.body.userID } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/register', async (req, res) => {
  try {
    const { userID, clubID } = req.body;
    const existing = await ClubMember.findOne({ 
      where: { 
        userID, 
        status: { [sequelize.Sequelize.Op.ne]: 'rejected' } 
      } 
    });
    if (existing) return res.status(400).json({ error: '您已有正在审核中或已加入的社团' });
    
    // 检查人数是否已满
    const club = await Club.findByPk(clubID);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    if (club.capacity) {
      const currentMemberCount = await ClubMember.count({
        where: { clubID, status: 'approved' }
      });
      if (currentMemberCount >= club.capacity) {
        return res.status(400).json({ error: '该社团人数已满，无法报名' });
      }
    }
    
    const member = await ClubMember.create({ userID, clubID, status: 'pending' });
    
    // 通知社团创建者
    if (club) {
      io.emit('notification_update', { userID: club.founderID });
    }
    
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/rotate', async (req, res) => {
  try {
    if (!isRotationAllowed()) return res.status(403).json({ error: '不在轮换时间' });
    const member = await ClubMember.findOne({ where: { userID: req.body.userID } });
    if (!member) return res.status(400).json({ error: '请先报名社团' });
    member.clubID = req.body.newClubID;
    member.status = 'pending'; // 轮换也需要新社团创建者审核
    await member.save();
    
    // 通知新社团的创建者
    const club = await Club.findByPk(req.body.newClubID);
    if (club) {
      io.emit('notification_update', { userID: club.founderID });
    }
    
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 活动
app.post('/api/activities', upload.single('file'), async (req, res) => {
  try {
    const activityData = {
      ...req.body,
      file: req.file ? req.file.filename : null,
      status: 'pending',
      phaseTimePreparation: req.body.phaseTimePreparation || null,
      phaseTimeStart: req.body.phaseTimeStart || null,
      phaseTimeInProgress: req.body.phaseTimeInProgress || null,
      phaseTimeEnd: req.body.phaseTimeEnd || null
    };
    const activity = await Activity.create(activityData);
    io.emit('notification_update', { type: 'new_audit' });
    res.json(activity);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activities/approved', async (req, res) => {
  try { 
    // 使用Sequelize模型查询，自动处理字段映射
    const activities = await Activity.findAll({
      where: { status: 'approved' },
      attributes: ['id', 'name', 'capacity', 'time', 'location', 'description', 'flow', 'requirements', 'file', 'organizerID', 'status', 'currentPhase', 'phaseTimePreparation', 'phaseTimeStart', 'phaseTimeInProgress', 'phaseTimeEnd', 'createdAt', 'updatedAt']
    });
    
    // 为每个活动添加当前报名人数和组织者信息
    const activitiesWithCount = await Promise.all(activities.map(async (act) => {
      const plain = act.get({ plain: true });
      const count = await ActivityRegistration.count({
        where: { activityID: plain.id, status: 'approved' }
      });
      
      // 获取组织者信息
      let organizerName = null;
      let organizerClass = null;
      if (plain.organizerID) {
        const organizer = await User.findByPk(plain.organizerID);
        if (organizer) {
          organizerName = organizer.name;
          organizerClass = organizer.class;
        }
      }
      
      return { 
        ...plain, 
        currentRegCount: count,
        organizerName,
        organizerClass
      };
    }));
    
    res.json(activitiesWithCount || []); 
  } catch (e) { 
    console.error('获取活动列表错误:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/activities/register', async (req, res) => {
  try {
    const { activityID } = req.body;
    
    // 检查人数是否已满
    const activity = await Activity.findByPk(activityID);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    if (activity.capacity) {
      const currentRegCount = await ActivityRegistration.count({
        where: { activityID, status: 'approved' }
      });
      if (currentRegCount >= activity.capacity) {
        return res.status(400).json({ error: '该活动人数已满，无法报名' });
      }
    }
    
    const reg = await ActivityRegistration.create({ ...req.body, status: 'pending' });
    res.json(reg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/activities/:id/phase', async (req, res) => {
  try {
    const act = await Activity.findByPk(req.params.id);
    if (!act) return res.status(404).json({ error: '活动不存在' });
    act.currentPhase = req.body.phase;
    await act.save();
    io.emit('activity_phase_updated', { activityID: req.params.id, phase: req.body.phase });
    res.json(act);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 下载活动参与者Excel - 必须在 /api/activities/:id 之前定义
app.get('/api/activities/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    
    if (!userID) {
      return res.status(400).json({ error: '缺少userID参数' });
    }
    
    const activityId = parseInt(id, 10);
    if (isNaN(activityId)) {
      return res.status(400).json({ error: '无效的活动ID' });
    }
    
    const activity = await Activity.findByPk(activityId);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    // 检查权限：只有管理员或活动创建者可以下载
    const user = await User.findByPk(userID);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOrganizer = activity.organizerID === userID;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: '没有权限下载' });
    }
    
    // 获取所有审核通过的报名者
    const registrations = await ActivityRegistration.findAll({
      where: { activityID: activityId, status: 'approved' }
    });
    
    // 构建Excel数据
    const data = registrations.length > 0 
      ? registrations.map((reg, index) => ({
          '序号': index + 1,
          '姓名': reg.name || '',
          '班级': reg.class || '',
          '用户ID': reg.userID || '',
          '联系方式': reg.contact || '',
          '申请原因': reg.reason || ''
        }))
      : [{
          '序号': '',
          '姓名': '暂无参与者',
          '班级': '',
          '用户ID': '',
          '联系方式': '',
          '申请原因': ''
        }];
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '活动参与者');
    
    // 生成Excel文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(activity.name)}_参与者名单.xlsx"`);
    res.send(buffer);
  } catch (e) {
    console.error('导出Excel失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// 获取活动参与者列表
app.get('/api/activities/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    
    if (!userID) {
      return res.status(400).json({ error: '缺少userID参数' });
    }
    
    const activityId = parseInt(id, 10);
    if (isNaN(activityId)) {
      return res.status(400).json({ error: '无效的活动ID' });
    }
    
    const activity = await Activity.findByPk(activityId);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    // 检查权限：只有管理员或活动创建者可以查看
    const user = await User.findByPk(userID);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOrganizer = activity.organizerID === userID;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: '没有权限查看参与者' });
    }
    
    // 获取所有审核通过的报名者
    const registrations = await ActivityRegistration.findAll({
      where: { activityID: activityId, status: 'approved' },
      order: [['createdAt', 'ASC']]
    });
    
    res.json({
      activityName: activity.name,
      participants: registrations.map((reg, index) => ({
        index: index + 1,
        name: reg.name || '',
        class: reg.class || '',
        userID: reg.userID || '',
        contact: reg.contact || '',
        reason: reg.reason || '',
        registeredAt: reg.createdAt
      }))
    });
  } catch (e) {
    console.error('获取参与者列表失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// 审核与反馈
app.get('/api/audit/status/:userID', async (req, res) => {
  try {
    const { userID } = req.params;
    const user = await User.findByPk(userID);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const result = {
      clubCreations: [], activityCreations: [], allActivityRegs: [],
      myClubStatus: await Club.findAll({ where: { founderID: userID } }),
      myActivityStatus: await Activity.findAll({ where: { organizerID: userID } }),
      myActivityRegStatus: await ActivityRegistration.findAll({ where: { userID }, include: [Activity] }),
      myActivityRegApprovals: [],
      myClubJoinApprovals: [], // 新增：我收到的社团加入申请
      myOwnClubJoinStatus: await ClubMember.findAll({ where: { userID }, include: [Club] }) // 新增：我申请加入社团的状态
    };
    if (user.role === 'admin' || user.role === 'super_admin') {
      result.clubCreations = await Club.findAll({ where: { status: 'pending' } });
      result.activityCreations = await Activity.findAll({ where: { status: 'pending' } });
      result.allActivityRegs = await ActivityRegistration.findAll({ where: { status: 'pending' } });
    }
    const myActs = await Activity.findAll({ where: { organizerID: userID } });
    const myActIDs = myActs.map(a => a.id);
    if (myActIDs.length > 0) {
      result.myActivityRegApprovals = await ActivityRegistration.findAll({ where: { activityID: myActIDs, status: 'pending' } });
    }
    
    // 获取我创建的社团收到的加入申请
    const myClubs = await Club.findAll({ where: { founderID: userID } });
    const myClubIDs = myClubs.map(c => c.id);
    if (myClubIDs.length > 0) {
      result.myClubJoinApprovals = await ClubMember.findAll({ 
        where: { clubID: myClubIDs, status: 'pending' },
        include: [User]
      });
    }

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/audit/approve', async (req, res) => {
  try {
    const { type, id, status } = req.body;
    let targetUserID = '';
    if (type === 'club') { 
      const item = await Club.findByPk(id); 
      item.status = status; 
      await item.save(); 
      targetUserID = item.founderID; 
      // 如果审核通过，创始人自动加入社团
      if (status === 'approved') {
        await ClubMember.findOrCreate({
          where: { userID: item.founderID, clubID: item.id },
          defaults: { status: 'approved' }
        });
      }
    }
    else if (type === 'activity') { const item = await Activity.findByPk(id); item.status = status; await item.save(); targetUserID = item.organizerID; }
    else if (type === 'activityReg') { const item = await ActivityRegistration.findByPk(id); item.status = status; await item.save(); targetUserID = item.userID; }
    else if (type === 'clubJoin') { const item = await ClubMember.findByPk(id); item.status = status; await item.save(); targetUserID = item.userID; }
    await Notification.create({ userID: targetUserID, type: 'status_update', relatedID: id.toString() });
    io.emit('notification_update', { userID: targetUserID });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const user = await User.findByPk(req.body.authorID);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const fb = await Feedback.create({ ...req.body, authorName: user.name, authorClass: user.class, status: 'pending' });
    io.emit('notification_update', { type: 'new_feedback' });
    res.json(fb);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/feedback/my/:userID', async (req, res) => {
  try { res.json(await Feedback.findAll({ where: { authorID: req.params.userID }, order: [['createdAt', 'DESC']] })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/feedback', async (req, res) => {
  try { res.json(await Feedback.findAll({ order: [['createdAt', 'DESC']] })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/feedback/reply', async (req, res) => {
  try {
    const fb = await Feedback.findByPk(req.body.feedbackID);
    fb.adminReply = req.body.reply; fb.status = 'resolved';
    await fb.save();
    await Notification.create({ userID: fb.authorID, type: 'feedback_reply', relatedID: fb.id.toString() });
    io.emit('notification_update', { userID: fb.authorID });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 通知与权限
app.get('/api/notifications/:userID', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userID);
    if (!user) return res.json({ hasUnread: false });
    const count = await Notification.count({ where: { userID: req.params.userID, isRead: false } });
    let hasTasks = false;
    
    // 管理员任务
    if (user.role === 'admin' || user.role === 'super_admin') {
      const c = await Club.count({ where: { status: 'pending' } });
      const a = await Activity.count({ where: { status: 'pending' } });
      const f = await Feedback.count({ where: { status: 'pending' } });
      if (c > 0 || a > 0 || f > 0) hasTasks = true;
    }

    // 活动组织者任务 (活动报名审核)
    const myActs = await Activity.findAll({ where: { organizerID: user.userID } });
    const myActIDs = myActs.map(a => a.id);
    if (myActIDs.length > 0) {
      const regCount = await ActivityRegistration.count({ where: { activityID: myActIDs, status: 'pending' } });
      if (regCount > 0) hasTasks = true;
    }

    // 社团创建者任务 (成员加入审核)
    const myClubs = await Club.findAll({ where: { founderID: user.userID } });
    const myClubIDs = myClubs.map(c => c.id);
    if (myClubIDs.length > 0) {
      const joinCount = await ClubMember.count({ where: { clubID: myClubIDs, status: 'pending' } });
      if (joinCount > 0) hasTasks = true;
    }

    res.json({ hasUnread: count > 0 || hasTasks });
  } catch (e) { res.json({ hasUnread: false }); }
});

app.post('/api/notifications/read', async (req, res) => {
  try { await Notification.update({ isRead: true }, { where: { userID: req.body.userID } }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/set-role', async (req, res) => {
  try {
    const op = await User.findByPk(req.body.operatorID);
    if (op.role !== 'super_admin') return res.status(403).json({ error: '权限不足' });
    const target = await User.findByPk(req.body.targetUserID);
    target.role = req.body.role; await target.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/document', async (req, res) => {
  try { res.json(await Club.findAll({ 
    where: { status: 'approved' }, 
    include: [{ 
      model: ClubMember, 
      where: { status: 'approved' }, // 只显示审核通过的成员
      required: false, // 即使没成员也显示社团
      include: [User] 
    }] 
  })); } catch (e) { res.status(500).json({ error: e.message }); }
});

// 获取社团成员列表
app.get('/api/clubs/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    
    console.log('收到获取成员列表请求:', { id, userID });
    
    if (!userID) {
      return res.status(400).json({ error: '缺少userID参数' });
    }
    
    const clubId = parseInt(id, 10);
    if (isNaN(clubId)) {
      return res.status(400).json({ error: '无效的社团ID' });
    }
    
    const club = await Club.findByPk(clubId);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    // 检查权限：只有管理员或社团创建者可以查看
    const user = await User.findByPk(userID);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isFounder = club.founderID === userID;
    
    if (!isAdmin && !isFounder) {
      return res.status(403).json({ error: '没有权限查看成员' });
    }
    
    // 获取所有审核通过的成员
    const members = await ClubMember.findAll({
      where: { clubID: clubId, status: 'approved' },
      include: [User],
      order: [['createdAt', 'ASC']]
    });
    
    res.json({
      clubName: club.name,
      members: members.map((member, index) => ({
        index: index + 1,
        name: member.User ? member.User.name : '',
        class: member.User ? member.User.class : '',
        userID: member.userID || '',
        joinedAt: member.createdAt
      }))
    });
  } catch (e) {
    console.error('获取成员列表失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// 删除活动
app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    
    const activity = await Activity.findByPk(id);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    // 检查权限：只有管理员或活动创建者可以删除
    const user = await User.findByPk(userID);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOrganizer = activity.organizerID === userID;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: '没有权限删除此活动' });
    }
    
    // 删除所有相关的报名记录
    await ActivityRegistration.destroy({ where: { activityID: id } });
    
    // 删除活动
    await activity.destroy();
    
    io.emit('activity_deleted', { activityID: id });
    res.json({ success: true, message: '活动已删除' });
  } catch (e) {
    console.error('删除活动失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// 解散社团
app.delete('/api/clubs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    
    const club = await Club.findByPk(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    // 检查权限：只有社团创建者可以解散（管理员不能解散）
    const user = await User.findByPk(userID);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isFounder = club.founderID === userID;
    
    if (!isFounder) {
      return res.status(403).json({ error: '只有社团创建者可以解散此社团' });
    }
    
    // 删除所有成员记录（成员回到自由人身份）
    await ClubMember.destroy({ where: { clubID: id } });
    
    // 删除社团
    await club.destroy();
    
    io.emit('club_deleted', { clubID: id });
    res.json({ success: true, message: '社团已解散' });
  } catch (e) {
    console.error('解散社团失败:', e);
    res.status(500).json({ error: e.message });
  }
});

sequelize.sync().then(() => {
  server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});


