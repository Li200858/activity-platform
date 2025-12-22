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
  mongoose, sequelize, User, Club, Activity, ClubMember, ActivityRegistration, Feedback, Notification 
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5001;

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
// 支持多个文件上传（用于支付二维码）
const uploadMultiple = multer({ storage }).fields([
  { name: 'file', maxCount: 1 },
  { name: 'paymentQRCode', maxCount: 1 }
]);

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

// 服务器时间API（用于检查时间同步）
app.get('/api/time', (req, res) => {
  const now = moment();
  res.json({
    serverTime: now.format('YYYY-MM-DD HH:mm:ss'),
    serverTimeISO: now.toISOString(),
    timestamp: Date.now(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    day: now.day(),
    hour: now.hour(),
    minute: now.minute()
  });
});

// 用户注册与登录
app.post('/api/user/register', async (req, res) => {
  try {
    const { name, class: userClass } = req.body;
    const existing = await User.findOne({ name });
    if (existing) return res.status(400).json({ error: '该姓名已被注册' });
    const userID = uuidv4().substring(0, 8).toUpperCase();
    const role = (name === '管理员' || (name === '李昌轩' && userClass === 'NEE4')) ? 'super_admin' : 'user';
    const user = await User.create({ userID, name, class: userClass, role });
    const userObj = user.toObject();
    userObj.id = user._id.toString();
    res.json(userObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/user/login', async (req, res) => {
  try {
    const { userID, name, class: userClass } = req.body;
    const user = await User.findOne({ userID });
    if (!user || user.name !== name || user.class !== userClass) return res.status(401).json({ error: '信息不匹配' });
    const userObj = user.toObject();
    userObj.id = user._id.toString();
    res.json(userObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 统一搜索
app.get('/api/search', async (req, res) => {
  try {
    const { q, operatorID } = req.query;
    const operator = await User.findOne({ userID: operatorID });
    const isAdmin = operator && (operator.role === 'admin' || operator.role === 'super_admin');
    const users = await User.find({ 
      $or: [
        { name: { $regex: q, $options: 'i' } }, 
        { userID: { $regex: q, $options: 'i' } }
      ] 
    });
    const formattedUsers = users.map(u => {
      const uObj = u.toObject ? u.toObject() : u;
      return { 
        name: uObj.name, 
        class: uObj.class, 
        role: uObj.role, 
        userID: isAdmin ? uObj.userID : null,
        id: uObj._id ? uObj._id.toString() : null
      };
    });
    const clubs = await Club.find({ name: { $regex: q, $options: 'i' }, status: 'approved' });
    const activities = await Activity.find({ name: { $regex: q, $options: 'i' }, status: 'approved' });
    res.json({ 
      users: formattedUsers, 
      clubs: clubs.map(c => ({ ...c.toObject(), id: c._id.toString() })), 
      activities: activities.map(a => ({ ...a.toObject(), id: a._id.toString() }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 社团
app.post('/api/clubs', upload.single('file'), async (req, res) => {
  try {
    const club = await Club.create({ ...req.body, file: req.file ? req.file.filename : null, status: 'pending' });
    io.emit('notification_update', { type: 'new_audit' });
    const clubObj = club.toObject();
    clubObj.id = club._id.toString();
    res.json(clubObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/approved', async (req, res) => {
  try {
    const clubs = await Club.find({ status: 'approved' });
    // 计算每个社团的当前人数并添加创建者信息
    const result = await Promise.all(clubs.map(async (club) => {
      const plain = club.toObject();
      const memberCount = await ClubMember.countDocuments({ clubID: club._id, status: 'approved' });
      plain.memberCount = memberCount;
      plain.id = club._id.toString();
      
      // 获取创建者信息
      let founderName = null;
      let founderClass = null;
      if (plain.founderID) {
        const founder = await User.findOne({ userID: plain.founderID });
        if (founder) {
          founderName = founder.name;
          founderClass = founder.class;
        }
      }
      plain.founderName = founderName;
      plain.founderClass = founderClass;
      
      // 确保所有字段都存在
      return {
        ...plain,
        name: plain.name || '',
        intro: plain.intro || '',
        content: plain.content || '',
        location: plain.location || '',
        time: plain.time || '',
        duration: plain.duration || '',
        weeks: plain.weeks || null,
        capacity: plain.capacity || null,
        file: plain.file || null,
        founderID: plain.founderID || '',
        status: plain.status || 'pending'
      };
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/my/:userID', async (req, res) => {
  try {
    const member = await ClubMember.findOne({ userID: req.params.userID }).populate('clubID');
    if (member) {
      const result = member.toObject();
      result.Club = result.clubID;
      result.id = member._id.toString();
      if (result.Club) {
        result.Club.id = result.Club._id.toString();
      }
      res.json(result);
    } else {
      res.json(null);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/leave', async (req, res) => {
  try {
    await ClubMember.deleteMany({ userID: req.body.userID });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/register', async (req, res) => {
  try {
    const { userID, clubID } = req.body;
    const existing = await ClubMember.findOne({ 
      userID, 
      status: { $ne: 'rejected' } 
    });
    if (existing) return res.status(400).json({ error: '您已有正在审核中或已加入的社团' });
    
    // 检查人数是否已满
    const club = await Club.findById(clubID);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    if (club.capacity) {
      const currentMemberCount = await ClubMember.countDocuments({ clubID: club._id, status: 'approved' });
      if (currentMemberCount >= club.capacity) {
        return res.status(400).json({ error: '该社团人数已满，无法报名' });
      }
    }
    
    const member = await ClubMember.create({ userID, clubID: club._id, status: 'pending' });
    
    // 通知社团创建者
    if (club) {
      io.emit('notification_update', { userID: club.founderID });
    }
    
    const memberObj = member.toObject();
    memberObj.id = member._id.toString();
    memberObj.Club = club.toObject();
    memberObj.Club.id = club._id.toString();
    res.json(memberObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/rotate', async (req, res) => {
  try {
    if (!isRotationAllowed()) return res.status(403).json({ error: '不在轮换时间' });
    const member = await ClubMember.findOne({ userID: req.body.userID });
    if (!member) return res.status(400).json({ error: '请先报名社团' });
    const newClub = await Club.findById(req.body.newClubID);
    if (!newClub) return res.status(404).json({ error: '新社团不存在' });
    member.clubID = newClub._id;
    member.status = 'pending'; // 轮换也需要新社团创建者审核
    await member.save();
    
    // 通知新社团的创建者
    const club = newClub;
    if (club) {
      io.emit('notification_update', { userID: club.founderID });
    }
    
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 活动
app.post('/api/activities', uploadMultiple, async (req, res) => {
  try {
    const activityData = {
      ...req.body,
      file: req.files && req.files['file'] ? req.files['file'][0].filename : null,
      status: 'pending',
      phaseTimePreparation: req.body.phaseTimePreparation || null,
      phaseTimeStart: req.body.phaseTimeStart || null,
      phaseTimeInProgress: req.body.phaseTimeInProgress || null,
      phaseTimeEnd: req.body.phaseTimeEnd || null,
      // 付费相关字段
      hasFee: req.body.hasFee === 'true' || req.body.hasFee === true,
      feeAmount: req.body.feeAmount || null,
      paymentQRCode: req.files && req.files['paymentQRCode'] ? req.files['paymentQRCode'][0].filename : null
    };
    
    // 如果选择了付费但未上传二维码，返回错误
    if (activityData.hasFee && !activityData.paymentQRCode) {
      return res.status(400).json({ error: '选择了报名费功能，必须上传支付二维码' });
    }
    
    const activity = await Activity.create(activityData);
    io.emit('notification_update', { type: 'new_audit' });
    const actObj = activity.toObject();
    actObj.id = activity._id.toString();
    res.json(actObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activities/approved', async (req, res) => {
  try { 
    const activities = await Activity.find({ status: 'approved' });
    
    // 为每个活动添加当前报名人数和组织者信息
    const activitiesWithCount = await Promise.all(activities.map(async (act) => {
      const plain = act.toObject();
      plain.id = act._id.toString();
      const count = await ActivityRegistration.countDocuments({ activityID: act._id, status: 'approved' });
      
      // 获取组织者信息
      let organizerName = null;
      let organizerClass = null;
      if (plain.organizerID) {
        const organizer = await User.findOne({ userID: plain.organizerID });
        if (organizer) {
          organizerName = organizer.name;
          organizerClass = organizer.class;
        }
      }
      
      return { 
        ...plain, 
        currentRegCount: count,
        organizerName,
        organizerClass,
        name: plain.name || '',
        capacity: plain.capacity || null,
        time: plain.time || '',
        location: plain.location || '',
        description: plain.description || '',
        flow: plain.flow || '',
        requirements: plain.requirements || '',
        file: plain.file || null,
        organizerID: plain.organizerID || '',
        status: plain.status || 'pending',
        currentPhase: plain.currentPhase || '活动准备',
        phaseTimePreparation: plain.phaseTimePreparation || null,
        phaseTimeStart: plain.phaseTimeStart || null,
        phaseTimeInProgress: plain.phaseTimeInProgress || null,
        phaseTimeEnd: plain.phaseTimeEnd || null,
        // 付费相关字段
        hasFee: plain.hasFee || false,
        feeAmount: plain.feeAmount || null,
        paymentQRCode: plain.paymentQRCode || null
      };
    }));
    
    res.json(activitiesWithCount || []); 
  } catch (e) { 
    console.error('获取活动列表错误:', e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/activities/register', upload.single('paymentProof'), async (req, res) => {
  try {
    const { activityID } = req.body;
    
    // 检查人数是否已满
    const activity = await Activity.findById(activityID);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    if (activity.capacity) {
      const currentRegCount = await ActivityRegistration.countDocuments({ activityID: activity._id, status: 'approved' });
      if (currentRegCount >= activity.capacity) {
        return res.status(400).json({ error: '该活动人数已满，无法报名' });
      }
    }
    
    // 如果活动有费用，检查是否上传了支付凭证
    if (activity.hasFee && !req.file) {
      return res.status(400).json({ error: '该活动需要支付报名费，请上传支付截图' });
    }
    
    const regData = {
      ...req.body,
      activityID: activity._id,
      status: 'pending',
      paymentStatus: activity.hasFee ? (req.file ? 'pending_verification' : 'unpaid') : 'unpaid',
      paymentProof: req.file ? req.file.filename : null
    };
    
    const reg = await ActivityRegistration.create(regData);
    const regObj = reg.toObject();
    regObj.id = reg._id.toString();
    res.json(regObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/activities/:id/phase', async (req, res) => {
  try {
    const act = await Activity.findById(req.params.id);
    if (!act) return res.status(404).json({ error: '活动不存在' });
    act.currentPhase = req.body.phase;
    await act.save();
    io.emit('activity_phase_updated', { activityID: req.params.id, phase: req.body.phase });
    const actObj = act.toObject();
    actObj.id = act._id.toString();
    res.json(actObj);
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
    
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    // 检查权限：只有管理员或活动创建者可以下载
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOrganizer = activity.organizerID === userID;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: '没有权限下载' });
    }
    
    // 获取所有审核通过的报名者
    const registrations = await ActivityRegistration.find({
      activityID: activity._id,
      status: 'approved'
    });
    
    // 构建Excel数据
    const data = registrations.length > 0 
      ? registrations.map((reg, index) => {
          const regObj = reg.toObject ? reg.toObject() : reg;
          return {
            '序号': index + 1,
            '姓名': regObj.name || '',
            '班级': regObj.class || '',
            '用户ID': regObj.userID || '',
            '联系方式': regObj.contact || '',
            '申请原因': regObj.reason || ''
          };
        })
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
    
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    // 检查权限：只有管理员或活动创建者可以查看
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOrganizer = activity.organizerID === userID;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: '没有权限查看参与者' });
    }
    
    // 获取所有审核通过的报名者
    const registrations = await ActivityRegistration.find({
      activityID: activity._id,
      status: 'approved'
    }).sort({ createdAt: 1 });
    
    res.json({
      activityName: activity.name,
      participants: registrations.map((reg, index) => {
        const regObj = reg.toObject ? reg.toObject() : reg;
        return {
          index: index + 1,
          name: regObj.name || '',
          class: regObj.class || '',
          userID: regObj.userID || '',
          contact: regObj.contact || '',
          reason: regObj.reason || '',
          registeredAt: regObj.createdAt,
          // 支付相关字段
          paymentStatus: regObj.paymentStatus || 'unpaid',
          paymentProof: regObj.paymentProof || null
        };
      })
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
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const result = {
      clubCreations: [], activityCreations: [], allActivityRegs: [],
      myClubStatus: await Club.find({ founderID: userID }),
      myActivityStatus: await Activity.find({ organizerID: userID }),
      myActivityRegStatus: await ActivityRegistration.find({ userID }).populate('activityID'),
      myActivityRegApprovals: [],
      myClubJoinApprovals: [],
      myOwnClubJoinStatus: await ClubMember.find({ userID }).populate('clubID')
    };
    if (user.role === 'admin' || user.role === 'super_admin') {
      result.clubCreations = await Club.find({ status: 'pending' });
      result.activityCreations = await Activity.find({ status: 'pending' });
      result.allActivityRegs = await ActivityRegistration.find({ status: 'pending' });
    }
    const myActs = await Activity.find({ organizerID: userID });
    const myActIDs = myActs.map(a => a._id);
    if (myActIDs.length > 0) {
      result.myActivityRegApprovals = await ActivityRegistration.find({ activityID: { $in: myActIDs }, status: 'pending' });
    }
    
    // 获取我创建的社团收到的加入申请
    const myClubs = await Club.find({ founderID: userID });
    const myClubIDs = myClubs.map(c => c._id);
    if (myClubIDs.length > 0) {
      const joinApprovals = await ClubMember.find({ 
        clubID: { $in: myClubIDs },
        status: 'pending'
      });
      // 手动查询每个申请者的用户信息
      result.myClubJoinApprovals = await Promise.all(joinApprovals.map(async (approval) => {
        const approvalUser = await User.findOne({ userID: approval.userID });
        const approvalObj = approval.toObject();
        approvalObj.id = approval._id.toString();
        approvalObj.User = approvalUser ? {
          name: approvalUser.name,
          class: approvalUser.class,
          userID: approvalUser.userID
        } : null;
        return approvalObj;
      }));
    }

    // 转换_id为id
    const convertId = (item) => {
      if (Array.isArray(item)) {
        return item.map(i => ({ ...i.toObject(), id: i._id.toString() }));
      }
      return { ...item.toObject(), id: item._id.toString() };
    };

    result.myClubStatus = convertId(result.myClubStatus);
    result.myActivityStatus = convertId(result.myActivityStatus);
    result.myActivityRegStatus = convertId(result.myActivityRegStatus);
    result.myOwnClubJoinStatus = convertId(result.myOwnClubJoinStatus);
    if (user.role === 'admin' || user.role === 'super_admin') {
      result.clubCreations = convertId(result.clubCreations);
      result.activityCreations = convertId(result.activityCreations);
      result.allActivityRegs = convertId(result.allActivityRegs);
    }
    result.myActivityRegApprovals = convertId(result.myActivityRegApprovals);
    result.myClubJoinApprovals = convertId(result.myClubJoinApprovals);

    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/audit/approve', async (req, res) => {
  try {
    const { type, id, status } = req.body;
    let targetUserID = '';
    if (type === 'club') { 
      const item = await Club.findById(id); 
      if (!item) return res.status(404).json({ error: '社团不存在' });
      item.status = status; 
      await item.save(); 
      targetUserID = item.founderID; 
      // 如果审核通过，创始人自动加入社团
      if (status === 'approved') {
        await ClubMember.findOneAndUpdate(
          { userID: item.founderID, clubID: item._id },
          { userID: item.founderID, clubID: item._id, status: 'approved' },
          { upsert: true, new: true }
        );
      }
    }
    else if (type === 'activity') { 
      const item = await Activity.findById(id);
      if (!item) return res.status(404).json({ error: '活动不存在' });
      item.status = status; 
      await item.save(); 
      targetUserID = item.organizerID; 
    }
    else if (type === 'activityReg') { 
      const item = await ActivityRegistration.findById(id);
      if (!item) return res.status(404).json({ error: '报名不存在' });
      
      // 获取活动信息，检查是否有费用
      const activity = await Activity.findById(item.activityID);
      
      item.status = status;
      
      // 如果活动有费用，更新支付状态
      if (activity && activity.hasFee) {
        if (status === 'approved') {
          // 审核通过时，如果已上传支付凭证，标记为已支付
          if (item.paymentProof) {
            item.paymentStatus = 'paid';
          }
          // 如果没有支付凭证但审核通过了（不应该发生，但以防万一）
          else {
            item.paymentStatus = 'unpaid';
          }
        } else if (status === 'rejected') {
          // 审核拒绝时，保持支付状态不变（可能是支付凭证不对）
          // paymentStatus保持原样
        }
      }
      
      await item.save(); 
      targetUserID = item.userID; 
    }
    else if (type === 'clubJoin') { 
      const item = await ClubMember.findById(id);
      if (!item) return res.status(404).json({ error: '申请不存在' });
      item.status = status; 
      await item.save(); 
      targetUserID = item.userID; 
    }
    await Notification.create({ userID: targetUserID, type: 'status_update', relatedID: id.toString() });
    io.emit('notification_update', { userID: targetUserID });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const user = await User.findOne({ userID: req.body.authorID });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const fb = await Feedback.create({ ...req.body, authorName: user.name, authorClass: user.class, status: 'pending' });
    io.emit('notification_update', { type: 'new_feedback' });
    const fbObj = fb.toObject();
    fbObj.id = fb._id.toString();
    res.json(fbObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/feedback/my/:userID', async (req, res) => {
  try { 
    const feedbacks = await Feedback.find({ authorID: req.params.userID }).sort({ createdAt: -1 });
    res.json(feedbacks.map(f => ({ ...f.toObject(), id: f._id.toString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/feedback', async (req, res) => {
  try { 
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json(feedbacks.map(f => ({ ...f.toObject(), id: f._id.toString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/feedback/reply', async (req, res) => {
  try {
    const fb = await Feedback.findById(req.body.feedbackID);
    if (!fb) return res.status(404).json({ error: '反馈不存在' });
    fb.adminReply = req.body.reply; 
    fb.status = 'resolved';
    await fb.save();
    await Notification.create({ userID: fb.authorID, type: 'feedback_reply', relatedID: fb._id.toString() });
    io.emit('notification_update', { userID: fb.authorID });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 通知与权限
app.get('/api/notifications/:userID', async (req, res) => {
  try {
    const user = await User.findOne({ userID: req.params.userID });
    if (!user) return res.json({ hasUnread: false });
    const count = await Notification.countDocuments({ userID: req.params.userID, isRead: false });
    let hasTasks = false;
    
    // 管理员任务
    if (user.role === 'admin' || user.role === 'super_admin') {
      const c = await Club.countDocuments({ status: 'pending' });
      const a = await Activity.countDocuments({ status: 'pending' });
      const f = await Feedback.countDocuments({ status: 'pending' });
      if (c > 0 || a > 0 || f > 0) hasTasks = true;
    }

    // 活动组织者任务 (活动报名审核)
    const myActs = await Activity.find({ organizerID: user.userID });
    const myActIDs = myActs.map(a => a._id);
    if (myActIDs.length > 0) {
      const regCount = await ActivityRegistration.countDocuments({ activityID: { $in: myActIDs }, status: 'pending' });
      if (regCount > 0) hasTasks = true;
    }

    // 社团创建者任务 (成员加入审核)
    const myClubs = await Club.find({ founderID: user.userID });
    const myClubIDs = myClubs.map(c => c._id);
    if (myClubIDs.length > 0) {
      const joinCount = await ClubMember.countDocuments({ clubID: { $in: myClubIDs }, status: 'pending' });
      if (joinCount > 0) hasTasks = true;
    }

    res.json({ hasUnread: count > 0 || hasTasks });
  } catch (e) { res.json({ hasUnread: false }); }
});

app.post('/api/notifications/read', async (req, res) => {
  try { 
    await Notification.updateMany({ userID: req.body.userID }, { isRead: true }); 
    res.json({ success: true }); 
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/set-role', async (req, res) => {
  try {
    const op = await User.findOne({ userID: req.body.operatorID });
    if (!op || op.role !== 'super_admin') return res.status(403).json({ error: '权限不足' });
    const target = await User.findOne({ userID: req.body.targetUserID });
    if (!target) return res.status(404).json({ error: '用户不存在' });
    target.role = req.body.role; 
    await target.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/document', async (req, res) => {
  try { 
    const clubs = await Club.find({ status: 'approved' });
    const result = await Promise.all(clubs.map(async (club) => {
      const members = await ClubMember.find({ 
        clubID: club._id, 
        status: 'approved' 
      }).populate('userID', 'name class');
      return {
        ...club.toObject(),
        id: club._id.toString(),
        members: members.map(m => ({
          ...m.toObject(),
          id: m._id.toString(),
          User: m.userID
        }))
      };
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    // 检查权限：只有管理员或社团创建者可以查看
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isFounder = club.founderID === userID;
    
    if (!isAdmin && !isFounder) {
      return res.status(403).json({ error: '没有权限查看成员' });
    }
    
    // 获取所有审核通过的成员
    const members = await ClubMember.find({
      clubID: club._id,
      status: 'approved'
    }).sort({ createdAt: 1 });
    
    // 手动查询每个成员的用户信息
    const membersWithUserInfo = await Promise.all(members.map(async (member) => {
      const user = await User.findOne({ userID: member.userID });
      return {
        index: 0, // 稍后设置
        name: user ? user.name : '',
        class: user ? user.class : '',
        userID: member.userID || '',
        joinedAt: member.createdAt
      };
    }));
    
    res.json({
      clubName: club.name,
      members: membersWithUserInfo.map((member, index) => ({
        ...member,
        index: index + 1
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
    
    const activity = await Activity.findById(id);
    if (!activity) return res.status(404).json({ error: '活动不存在' });
    
    // 检查权限：只有管理员或活动创建者可以删除
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isOrganizer = activity.organizerID === userID;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: '没有权限删除此活动' });
    }
    
    // 删除所有相关的报名记录
    await ActivityRegistration.deleteMany({ activityID: activity._id });
    
    // 删除活动
    await activity.deleteOne();
    
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
    
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    // 检查权限：只有社团创建者可以解散（管理员不能解散）
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isFounder = club.founderID === userID;
    
    if (!isFounder) {
      return res.status(403).json({ error: '只有社团创建者可以解散此社团' });
    }
    
    // 删除所有成员记录（成员回到自由人身份）
    await ClubMember.deleteMany({ clubID: club._id });
    
    // 删除社团
    await club.deleteOne();
    
    io.emit('club_deleted', { clubID: id });
    res.json({ success: true, message: '社团已解散' });
  } catch (e) {
    console.error('解散社团失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// MongoDB连接已在db.js中处理，直接启动服务器
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Environment PORT: ${process.env.PORT || 'not set'}`);
  console.log(`MongoDB连接状态: ${mongoose.connection.readyState === 1 ? '已连接' : '连接中...'}`);
});


