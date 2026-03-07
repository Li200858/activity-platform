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
const { pinyin } = require('pinyin-pro');
const { 
  mongoose, sequelize, User, Club, Activity, ClubMember, ActivityRegistration, Feedback, Notification, SemesterRotation,
  WednesdayConfirmation, ClubAttendanceSession, ClubAttendanceRecord, ClubVenueRequest, ClubVenueSchedule, IDRecoveryRequest
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// 配置上传目录 - 支持Render持久化磁盘
const uploadsDir = process.env.NODE_ENV === 'production' 
  ? (process.env.UPLOAD_DIR || '/opt/render/project/src/uploads')
  : path.join(__dirname, 'uploads');

console.log('📁 文件上传目录:', uploadsDir);
console.log('📁 目录是否存在:', fs.existsSync(uploadsDir));

// 确保上传目录存在
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ 已创建上传目录:', uploadsDir);
}

// 配置静态文件服务 - 使用持久化磁盘路径
app.use('/uploads', express.static(uploadsDir));

// 文件上传配置 - 使用持久化磁盘
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 确保目录存在
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
});

// 支持多个文件上传（用于支付二维码）
const uploadMultiple = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  }
}).fields([
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

// 更新用户英文名（登录后在前端右上角填写）
app.put('/api/user/english-name', async (req, res) => {
  try {
    const { userID, englishName } = req.body;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: '用户不存在' });
    user.englishName = (englishName || '').trim();
    await user.save();
    const userObj = user.toObject();
    userObj.id = user._id.toString();
    res.json(userObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 提交找回ID请求（登录页使用）
app.post('/api/id-recovery', async (req, res) => {
  try {
    const { name, class: userClass, email } = req.body;
    if (!name || !userClass || !email) return res.status(400).json({ error: '缺少姓名、班级或邮箱' });
    const user = await User.findOne({ name, class: userClass });
    const userIDFound = user ? user.userID : null;
    const reqDoc = await IDRecoveryRequest.create({
      name,
      class: userClass,
      email,
      userIDFound,
      status: 'pending'
    });
    res.json({ success: true, id: reqDoc._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 管理员查看找回ID请求列表
app.get('/api/admin/id-recovery', async (req, res) => {
  try {
    const { operatorID } = req.query;
    if (!operatorID) return res.status(400).json({ error: '缺少 operatorID' });
    const op = await User.findOne({ userID: operatorID });
    if (!op || (op.role !== 'admin' && op.role !== 'super_admin')) return res.status(403).json({ error: '仅管理员可查看' });
    const list = await IDRecoveryRequest.find().sort({ createdAt: -1 }).lean();
    res.json(list.map(r => ({ ...r, id: r._id.toString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 管理员标记找回ID请求已处理
app.post('/api/admin/id-recovery/:id/resolve', async (req, res) => {
  try {
    const { operatorID, note } = req.body;
    const { id } = req.params;
    if (!operatorID) return res.status(400).json({ error: '缺少 operatorID' });
    const op = await User.findOne({ userID: operatorID });
    if (!op || (op.role !== 'admin' && op.role !== 'super_admin')) return res.status(403).json({ error: '仅管理员可操作' });
    const doc = await IDRecoveryRequest.findById(id);
    if (!doc) return res.status(404).json({ error: '请求不存在' });
    doc.status = 'resolved';
    doc.operatorID = operatorID;
    doc.note = note || '';
    doc.resolvedAt = new Date();
    await doc.save();
    const plain = doc.toObject();
    plain.id = doc._id.toString();
    res.json(plain);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 翻译接口（用于语言切换时翻译用户发表内容，如社团名、介绍等）
const translateCache = new Map();
const TRANSLATE_CACHE_MAX = 500;
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang = 'en' } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });
    const trimmed = text.trim();
    if (!trimmed) return res.json({ translatedText: '' });
    const cacheKey = `${targetLang}:${trimmed}`;
    if (translateCache.has(cacheKey)) return res.json({ translatedText: translateCache.get(cacheKey) });
    const langpair = targetLang === 'en' ? 'zh-CN|en' : 'en|zh-CN';
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${langpair}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.responseStatus !== 200 || !data.responseData) {
      return res.status(500).json({ error: 'Translation failed' });
    }
    const translated = data.responseData.translatedText || trimmed;
    if (translateCache.size >= TRANSLATE_CACHE_MAX) {
      const first = translateCache.keys().next().value;
      if (first) translateCache.delete(first);
    }
    translateCache.set(cacheKey, translated);
    res.json({ translatedText: translated });
  } catch (e) {
    console.error('Translate error:', e);
    res.status(500).json({ error: e.message || 'Translation failed' });
  }
});

// 统一搜索：用户姓名/ID、社团名、活动名，以及「该用户创建的社团/活动」
app.get('/api/search', async (req, res) => {
  try {
    const { q, operatorID } = req.query;
    if (!q || !String(q).trim()) return res.json({ users: [], clubs: [], activities: [] });
    const operator = await User.findOne({ userID: operatorID });
    const isAdmin = operator && (operator.role === 'admin' || operator.role === 'super_admin');
    const users = await User.find({ 
      $or: [
        { name: { $regex: q, $options: 'i' } }, 
        { userID: { $regex: q, $options: 'i' } }
      ] 
    }).select('name englishName class role userID').lean();
    const matchedUserIDs = users.map(u => u.userID);
    const formattedUsers = users.map(u => ({
      name: u.name,
      englishName: u.englishName || '',
      class: u.class,
      role: u.role,
      userID: isAdmin ? u.userID : null,
      id: u._id ? u._id.toString() : null
    }));
    // 社团：按社团名 或 创建者属于匹配用户
    const clubsByName = await Club.find({ name: { $regex: q, $options: 'i' }, status: 'approved' }).lean();
    const clubsByFounder = matchedUserIDs.length ? await Club.find({ founderID: { $in: matchedUserIDs }, status: 'approved' }).lean() : [];
    const clubIds = new Set(clubsByName.map(c => c._id.toString()));
    clubsByFounder.forEach(c => { clubIds.add(c._id.toString()); });
    const clubs = await Club.find({ _id: { $in: Array.from(clubIds) }, status: 'approved' }).lean();
    const clubsWithId = clubs.map(c => ({ ...c, id: c._id.toString() }));
    clubsWithId.sort((a, b) => getClubSortKey(a.name).localeCompare(getClubSortKey(b.name)));
    // 活动：按活动名 或 组织者属于匹配用户
    const actsByName = await Activity.find({ name: { $regex: q, $options: 'i' }, status: 'approved' }).lean();
    const actsByOrganizer = matchedUserIDs.length ? await Activity.find({ organizerID: { $in: matchedUserIDs }, status: 'approved' }).lean() : [];
    const actIds = new Set(actsByName.map(a => a._id.toString()));
    actsByOrganizer.forEach(a => { actIds.add(a._id.toString()); });
    const activities = await Activity.find({ _id: { $in: Array.from(actIds) }, status: 'approved' }).lean();
    const activitiesWithId = activities.map(a => ({ ...a, id: a._id.toString() }));
    res.json({ 
      users: formattedUsers, 
      clubs: clubsWithId, 
      activities: activitiesWithId
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 检查社团名称是否可用
app.post('/api/clubs/check-name', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '缺少社团名称参数' });
    }
    
    // 检查社团名称是否与已有社团重复（包括pending和approved状态）
    const existingClub = await Club.findOne({ name });
    if (existingClub) {
      return res.json({ 
        available: false, 
        error: '该社团名称已被使用，请使用其他名称' 
      });
    }
    
    // 检查社团名称是否与任何用户名重复
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.json({ 
        available: false, 
        error: '该社团名称与已有用户名重复，请使用其他名称' 
      });
    }
    
    // 名称可用
    return res.json({ available: true });
  } catch (error) {
    console.error('检查社团名称失败:', error);
    res.status(500).json({ error: '检查社团名称失败' });
  }
});

// 社团
app.post('/api/clubs', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    
    // 检查社团名称是否与已有社团重复（包括pending和approved状态）
    const existingClub = await Club.findOne({ name });
    if (existingClub) {
      return res.status(400).json({ error: '该社团名称已被使用，请使用其他名称' });
    }
    
    // 检查社团名称是否与任何用户名重复
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ error: '该社团名称与已有用户名重复，请使用其他名称' });
    }
    
    const category = ['daily', 'wednesday', 'both'].includes(req.body.category) ? req.body.category : 'wednesday';
    let type = (req.body.type === 'academic' || req.body.type === 'activity') ? req.body.type : 'activity';
    let blocks = req.body.blocks;
    if (typeof blocks === 'string') {
      try { blocks = JSON.parse(blocks); } catch (e) { blocks = []; }
    }
    if (!Array.isArray(blocks)) blocks = [];
    blocks = blocks.filter(b => ['block1', 'block2', 'block3', 'block4'].includes(b));
    const hasWednesday = (c) => c === 'wednesday' || c === 'both';
    if (hasWednesday(category)) {
      if (blocks.length < 1 || blocks.length > 3) return res.status(400).json({ error: '周三/周三+日常社团请选择 1～3 个活动板块' });
      if (type === 'activity' && blocks.includes('block1')) return res.status(400).json({ error: '活动社团不能选择 Block1（学术固定时段）' });
    } else {
      type = 'activity';
      blocks = [];
    }
    
    const founderID = req.body.founderID || '';
    const contact = String(req.body.contact || '').trim();
    if (!contact) return res.status(400).json({ error: '请填写联系方式，便于线下联系' });
    const actualLeaderName = String(req.body.actualLeaderName || '').trim() || undefined;
    const club = await Club.create({
      ...req.body,
      contact,
      actualLeaderName,
      category,
      type,
      blocks,
      coreMemberIDs: founderID ? [founderID] : [],
      file: req.file ? req.file.filename : null,
      status: 'pending'
    });
    io.emit('notification_update', { type: 'new_audit' });
    const clubObj = club.toObject();
    clubObj.id = club._id.toString();
    res.json(clubObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 社团名称排序用：中文取拼音首字母串，英文取原串（转小写）
function getClubSortKey(name) {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const first = trimmed.charAt(0);
  if (/^[A-Za-z]/.test(first)) {
    return trimmed.toLowerCase();
  }
  try {
    const initials = pinyin(trimmed, { pattern: 'initial' });
    return (initials || '').replace(/\s/g, '').toLowerCase();
  } catch (e) {
    return trimmed;
  }
}

app.get('/api/clubs/approved', async (req, res) => {
  try {
    const clubs = await Club.find({ status: 'approved' });
    // 批量获取所有核心人员 userID 对应的用户信息
    const allCoreIDs = [...new Set(clubs.flatMap(c => (c.coreMemberIDs || []).concat(c.founderID ? [c.founderID] : [])))];
    const coreUsers = allCoreIDs.length ? await User.find({ userID: { $in: allCoreIDs } }).select('userID name englishName class').lean() : [];
    const userMap = new Map(coreUsers.map(u => [u.userID, u]));
    
    const result = await Promise.all(clubs.map(async (club) => {
      const plain = club.toObject();
      const memberCount = await ClubMember.countDocuments({ clubID: club._id, status: 'approved' });
      plain.memberCount = memberCount;
      plain.id = club._id.toString();
      
      let founderName = null;
      let founderEnglishName = null;
      let founderClass = null;
      if (plain.founderID) {
        const founder = userMap.get(plain.founderID) || await User.findOne({ userID: plain.founderID }).select('name englishName class').lean();
        if (founder) {
          founderName = founder.name;
          founderEnglishName = founder.englishName || null;
          founderClass = founder.class;
        }
      }
      plain.founderName = founderName;
      plain.founderEnglishName = founderEnglishName;
      plain.founderClass = founderClass;
      
      // 核心人员列表（含姓名）
      const ids = [...new Set((plain.coreMemberIDs || []).concat(plain.founderID ? [plain.founderID] : []))];
      plain.coreMembers = ids.map(uid => {
        const u = userMap.get(uid);
        return {
          userID: uid,
          name: u?.name || '未知',
          englishName: u?.englishName || ''
        };
      });
      
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
        contact: plain.contact || '',
        file: plain.file || null,
        founderID: plain.founderID || '',
        actualLeaderName: plain.actualLeaderName || '',
        status: plain.status || 'pending',
        type: plain.type || 'activity',
        blocks: Array.isArray(plain.blocks) ? plain.blocks : [],
        category: plain.category || 'wednesday',
        coreMemberIDs: Array.isArray(plain.coreMemberIDs) ? plain.coreMemberIDs : [],
        coreMembers: plain.coreMembers || []
      };
    }));
    result.sort((a, b) => getClubSortKey(a.name).localeCompare(getClubSortKey(b.name)));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const clubHasWednesday = (c) => (c || 'wednesday') === 'wednesday' || (c === 'both');

app.get('/api/clubs/my/:userID', async (req, res) => {
  try {
    const userID = req.params.userID;
    const members = await ClubMember.find({ userID, status: { $ne: 'rejected' } }).populate('clubID');
    const wednesdayList = members.filter(m => m.clubID && clubHasWednesday(m.clubID.category));
    const daily = members.filter(m => m.clubID && m.clubID.category === 'daily');
    const format = (m) => {
      const result = m.toObject();
      result.Club = result.clubID;
      result.id = m._id.toString();
      if (result.Club) result.Club.id = result.Club._id.toString();
      return result;
    };
    const wednesdayClubs = wednesdayList.map(format);
    const semester = getCurrentSemester();
    const confirmed = await WednesdayConfirmation.findOne({ userID, semester }).lean();
    res.json({
      wednesday: wednesdayClubs[0] || null,
      wednesdayClubs,
      daily: daily.map(format),
      wednesdayConfirmed: !!confirmed
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/leave', async (req, res) => {
  try {
    const { userID, clubID } = req.body;
    if (!userID || !clubID) return res.status(400).json({ error: '缺少 userID 或 clubID' });
    const club = await Club.findById(clubID);
    if (club && clubHasWednesday(club.category)) {
      const semester = getCurrentSemester();
      const confirmed = await WednesdayConfirmation.findOne({ userID, semester }).lean();
      if (confirmed) return res.status(400).json({ error: '已最终确认周三社团，无法直接退出，请通过社团轮换更改' });
      // 未确认前可自由退出，不限制数量
    }
    await ClubMember.deleteOne({ userID, clubID });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 周三社团最终确认（确认后无法直接退出，只能通过轮换更改）
app.post('/api/clubs/wednesday-confirm', async (req, res) => {
  try {
    const { userID } = req.body;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const wednesdayMembers = await ClubMember.find({ userID, status: 'approved' }).populate('clubID');
    const wedCount = wednesdayMembers.filter(m => m.clubID && clubHasWednesday(m.clubID.category)).length;
    if (wedCount < 2) return res.status(400).json({ error: '至少需有 2 个已通过的周三社团才能最终确认' });
    const semester = getCurrentSemester();
    await WednesdayConfirmation.findOneAndUpdate(
      { userID, semester },
      { $set: { userID, semester } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 社团内搜索用户（用于添加核心人员，仅创建者或管理员可调，返回 userID）
app.get('/api/clubs/:id/search-users', async (req, res) => {
  try {
    const { id } = req.params;
    const { q, operatorID } = req.query;
    if (!q || !operatorID) return res.json([]);
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const operator = await User.findOne({ userID: operatorID });
    if (!operator) return res.status(401).json({ error: '用户不存在' });
    const isFounder = club.founderID === operatorID;
    const isAdmin = operator.role === 'admin' || operator.role === 'super_admin';
    if (!isFounder && !isAdmin) return res.status(403).json({ error: '无权限' });
    const users = await User.find({
      $or: [
        { name: { $regex: q.trim(), $options: 'i' } },
        { userID: { $regex: q.trim(), $options: 'i' } }
      ]
    })
      .select('name class userID')
      .lean()
      .limit(20);
    res.json(users.map(u => ({ name: u.name, class: u.class, userID: u.userID })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 添加/移除社团核心人员（仅创建者或管理员）
app.put('/api/clubs/:id/core-members', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID: operatorID, targetUserID, action } = req.body;
    if (!operatorID || !targetUserID || !action || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: '参数错误' });
    }
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const operator = await User.findOne({ userID: operatorID });
    if (!operator) return res.status(401).json({ error: '用户不存在' });
    const isFounder = club.founderID === operatorID;
    const isAdmin = operator.role === 'admin' || operator.role === 'super_admin';
    if (!isFounder && !isAdmin) return res.status(403).json({ error: '仅社团创建者或管理员可管理核心人员' });
    
    const list = Array.isArray(club.coreMemberIDs) ? [...club.coreMemberIDs] : [];
    if (club.founderID && !list.includes(club.founderID)) list.unshift(club.founderID);
    
    if (action === 'add') {
      if (list.includes(targetUserID)) return res.status(400).json({ error: '已是核心人员' });
      list.push(targetUserID);
    } else {
      if (club.founderID === targetUserID) return res.status(400).json({ error: '不能移除创建者' });
      club.coreMemberIDs = list.filter(uid => uid !== targetUserID);
      await club.save();
      return res.json({ success: true, coreMemberIDs: club.coreMemberIDs });
    }
    
    club.coreMemberIDs = list;
    await club.save();
    res.json({ success: true, coreMemberIDs: club.coreMemberIDs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 更新社团分类、类型与介绍（仅创建者或管理员）
app.put('/api/clubs/:id/update-category-type', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID: operatorID, category, type, blocks, intro } = req.body;
    if (!operatorID) return res.status(400).json({ error: '缺少 userID' });
    
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    const operator = await User.findOne({ userID: operatorID });
    if (!operator) return res.status(401).json({ error: '用户不存在' });
    const isFounder = club.founderID === operatorID;
    const isAdmin = operator.role === 'admin' || operator.role === 'super_admin';
    if (!isFounder && !isAdmin) return res.status(403).json({ error: '仅社团创建者或管理员可修改' });
    
    // 验证 category
    if (category !== undefined) {
      if (!['daily', 'wednesday', 'both'].includes(category)) {
        return res.status(400).json({ error: 'category 必须是 daily、wednesday 或 both' });
      }
      club.category = category;
    }
    
    // 验证 type 和 blocks（如果 category 是 wednesday 或 both）
    const hasWed = clubHasWednesday(club.category);
    if (hasWed) {
      if (type !== undefined) {
        if (!['academic', 'activity'].includes(type)) {
          return res.status(400).json({ error: 'type 必须是 academic 或 activity' });
        }
        club.type = type;
      }
      
      if (blocks !== undefined) {
        let blocksArray = blocks;
        if (typeof blocks === 'string') {
          try { blocksArray = JSON.parse(blocks); } catch (e) { blocksArray = []; }
        }
        if (!Array.isArray(blocksArray)) blocksArray = [];
        blocksArray = blocksArray.filter(b => ['block1', 'block2', 'block3', 'block4'].includes(b));
        
        if (blocksArray.length < 1 || blocksArray.length > 3) {
          return res.status(400).json({ error: '周三/周三+日常社团请选择 1～3 个活动板块' });
        }
        if (club.type === 'activity' && blocksArray.includes('block1')) {
          return res.status(400).json({ error: '活动社团不能选择 Block1（学术固定时段）' });
        }
        club.blocks = blocksArray;
      }
    } else {
      // 日常社团：type 固定为 activity，blocks 为空
      club.type = 'activity';
      club.blocks = [];
    }
    
    if (intro !== undefined) club.intro = String(intro || '').trim();
    
    await club.save();
    
    const clubObj = club.toObject();
    clubObj.id = club._id.toString();
    res.json({ success: true, club: clubObj });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 更新社团活动信息：活动内容、活动地点、活动时间、活动时长、人数上限（仅创建者或管理员）
app.put('/api/clubs/:id/update-info', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID: operatorID, content, location, time, duration, capacity, contact, actualLeaderName } = req.body;
    if (!operatorID) return res.status(400).json({ error: '缺少 userID' });

    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });

    const operator = await User.findOne({ userID: operatorID });
    if (!operator) return res.status(401).json({ error: '用户不存在' });
    const isFounder = club.founderID === operatorID;
    const isAdmin = operator.role === 'admin' || operator.role === 'super_admin';
    if (!isFounder && !isAdmin) return res.status(403).json({ error: '仅社团创建者或管理员可修改' });

    if (content !== undefined) club.content = String(content || '').trim();
    if (contact !== undefined) club.contact = String(contact || '').trim();
    if (actualLeaderName !== undefined) club.actualLeaderName = String(actualLeaderName || '').trim() || undefined;
    if (location !== undefined) club.location = String(location || '').trim();
    if (time !== undefined) club.time = String(time || '').trim();
    if (duration !== undefined) club.duration = String(duration || '').trim();
    if (capacity !== undefined) {
      const val = capacity === '' || capacity == null ? null : Number(capacity);
      if (val != null && (isNaN(val) || val < 0)) return res.status(400).json({ error: '人数上限必须为非负整数' });
      if (val != null) {
        const currentCount = await ClubMember.countDocuments({ clubID: club._id, status: 'approved' });
        if (val < currentCount) return res.status(400).json({ error: `人数上限不能小于当前成员数（${currentCount}人）` });
      }
      club.capacity = val;
    }

    await club.save();

    const clubObj = club.toObject();
    clubObj.id = club._id.toString();
    res.json({ success: true, club: clubObj });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const WEDNESDAY_BLOCK_LIMIT = 4;

app.post('/api/clubs/register', async (req, res) => {
  try {
    const { userID, clubID } = req.body;
    const club = await Club.findById(clubID);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    
    const isWednesdayOrBoth = clubHasWednesday(club.category);
    if (isWednesdayOrBoth) {
      const alreadyIn = await ClubMember.findOne({ userID, clubID: club._id, status: { $ne: 'rejected' } });
      if (alreadyIn) return res.status(400).json({ error: '您已报名该社团' });
      const wednesdayMembers = await ClubMember.find({ userID, status: { $ne: 'rejected' } }).populate('clubID');
      const usedBlocks = new Set();
      for (const m of wednesdayMembers) {
        if (!m.clubID || !clubHasWednesday(m.clubID.category)) continue;
        const blocks = Array.isArray(m.clubID.blocks) ? m.clubID.blocks : [];
        blocks.forEach(b => usedBlocks.add(b));
      }
      const newBlocks = Array.isArray(club.blocks) ? club.blocks : [];
      const overlap = newBlocks.some(b => usedBlocks.has(b));
      if (overlap) return res.status(400).json({ error: '该社团与您已选的周三社团时间重叠，每个时段只能选一个社团' });
      if (usedBlocks.size + newBlocks.length > WEDNESDAY_BLOCK_LIMIT) {
        return res.status(400).json({ error: `周三最多选 ${WEDNESDAY_BLOCK_LIMIT} 个时段，您已占 ${usedBlocks.size} 个，该社团占 ${newBlocks.length} 个` });
      }
    } else {
      const alreadyIn = await ClubMember.findOne({ userID, clubID: club._id, status: { $ne: 'rejected' } });
      if (alreadyIn) return res.status(400).json({ error: '您已报名该日常社团' });
    }
    
    if (club.capacity) {
      const currentMemberCount = await ClubMember.countDocuments({ clubID: club._id, status: 'approved' });
      if (currentMemberCount >= club.capacity) return res.status(400).json({ error: '该社团人数已满，无法报名' });
    }
    
    const member = await ClubMember.create({ userID, clubID: club._id, status: 'pending' });
    
    if (club) io.emit('notification_update', { userID: club.founderID });
    
    const memberObj = member.toObject();
    memberObj.id = member._id.toString();
    memberObj.Club = club.toObject();
    memberObj.Club.id = club._id.toString();
    res.json(memberObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 当前学期：春季 3月1日-7月15日，秋季 9月1日-次年1月31日
function getCurrentSemester() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12
  if (m >= 9) return `${y}-fall`;      // 9月1日-12月31日 → 当年秋季
  if (m === 1) return `${y - 1}-fall`; // 1月1日-1月31日 → 上年秋季
  // 2月-8月 → 当年春季（含 3/1-7/15 春季 + 2月与 7/16-8/31 沿用春季计数）
  return `${y}-spring`;
}

const ROTATION_LIMIT_PER_SEMESTER = 5;

function getSemesterLabel(semester) {
  if (!semester) return '本学期';
  const [y, type] = String(semester).split('-');
  return type === 'fall' ? `${y}年秋季` : `${y}年春季`;
}

app.get('/api/clubs/rotation-quota', async (req, res) => {
  try {
    const { userID } = req.query;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const semester = getCurrentSemester();
    const record = await SemesterRotation.findOne({ userID, semester }).lean();
    const used = record ? record.count : 0;
    res.json({
      semester,
      semesterLabel: getSemesterLabel(semester),
      used,
      limit: ROTATION_LIMIT_PER_SEMESTER
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 重置社团轮换次数（仅 super_admin）
app.post('/api/clubs/rotation-quota/reset', async (req, res) => {
  try {
    const { operatorID, targetUserID } = req.body;
    if (!operatorID) return res.status(400).json({ error: '缺少 operatorID' });
    const operator = await User.findOne({ userID: operatorID });
    if (!operator) return res.status(401).json({ error: '用户不存在' });
    if (operator.role !== 'super_admin') return res.status(403).json({ error: '仅超级管理员可重置轮换次数' });
    const userIDToReset = targetUserID || operatorID;
    const semester = getCurrentSemester();
    await SemesterRotation.findOneAndUpdate(
      { userID: userIDToReset, semester },
      { $set: { count: 0 } },
      { upsert: true, new: true }
    );
    res.json({
      success: true,
      message: `已重置${userIDToReset === operatorID ? '本账号' : '该用户'}本学期轮换次数`,
      semester,
      semesterLabel: getSemesterLabel(semester)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/rotate', async (req, res) => {
  try {
    if (!isRotationAllowed()) return res.status(403).json({ error: '不在轮换时间' });
    const { userID, newClubID, oldClubID } = req.body;
    const members = await ClubMember.find({ userID }).populate('clubID');
    const wednesdayMembers = members.filter(m => m.clubID && clubHasWednesday(m.clubID.category));
    if (wednesdayMembers.length === 0) return res.status(400).json({ error: '请先报名周三社团' });
    let member = null;
    if (oldClubID) {
      member = wednesdayMembers.find(m => m.clubID && m.clubID._id.toString() === oldClubID);
      if (!member) return res.status(400).json({ error: '未找到要替换的周三社团' });
    } else {
      member = wednesdayMembers[0];
    }
    const newClub = await Club.findById(newClubID);
    if (!newClub) return res.status(404).json({ error: '新社团不存在' });
    if (!clubHasWednesday(newClub.category)) return res.status(400).json({ error: '只能轮换到周三或周三+日常社团' });
    if (member.clubID && member.clubID._id.toString() === newClubID) return res.status(400).json({ error: '已是该社团' });
    const otherWed = wednesdayMembers.filter(m => m !== member);
    const usedBlocks = new Set();
    for (const m of otherWed) {
      if (!m.clubID || !m.clubID.blocks) continue;
      m.clubID.blocks.forEach(b => usedBlocks.add(b));
    }
    const newBlocks = Array.isArray(newClub.blocks) ? newClub.blocks : [];
    const overlap = newBlocks.some(b => usedBlocks.has(b));
    if (overlap) return res.status(400).json({ error: '该社团与您其他周三社团时间重叠' });
    if (usedBlocks.size + newBlocks.length > WEDNESDAY_BLOCK_LIMIT) {
      return res.status(400).json({ error: `周三最多 ${WEDNESDAY_BLOCK_LIMIT} 个时段，无法再选该社团` });
    }

    const semester = getCurrentSemester();
    let record = await SemesterRotation.findOne({ userID, semester });
    if (!record) record = await SemesterRotation.create({ userID, semester, count: 0 });
    if (record.count >= ROTATION_LIMIT_PER_SEMESTER) {
      return res.status(400).json({ error: `本学期轮换次数已用完（${ROTATION_LIMIT_PER_SEMESTER} 次），无法继续轮换` });
    }

    member.clubID = newClub._id;
    member.status = 'pending';
    await member.save();
    record.count += 1;
    await record.save();
    io.emit('notification_update', { userID: newClub.founderID });
    const result = member.toObject();
    result.Club = newClub;
    result.Club.id = newClub._id.toString();
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 自动判断活动当前阶段的辅助函数
const determineCurrentPhase = (activity) => {
  const now = moment();
  
  // 解析时间字符串（格式：开始时间 - 结束时间 或 单个时间）
  const parseTimeRange = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(' - ');
    if (parts.length === 2) {
      // 尝试多种时间格式
      let start = moment(parts[0].trim(), 'YYYY年MM月DD日 HH:mm:ss');
      let end = moment(parts[1].trim(), 'YYYY年MM月DD日 HH:mm:ss');
      
      // 如果解析失败，尝试其他格式
      if (!start.isValid()) {
        start = moment(parts[0].trim());
      }
      if (!end.isValid()) {
        end = moment(parts[1].trim());
      }
      
      if (start.isValid() && end.isValid()) {
        return { start, end };
      }
    }
    // 尝试解析单个时间
    let singleTime = moment(timeStr.trim(), 'YYYY年MM月DD日 HH:mm:ss');
    if (!singleTime.isValid()) {
      singleTime = moment(timeStr.trim());
    }
    return singleTime.isValid() ? { start: singleTime, end: null } : null;
  };
  
  const prepTime = parseTimeRange(activity.phaseTimePreparation);
  const startTime = parseTimeRange(activity.phaseTimeStart);
  const inProgressTime = parseTimeRange(activity.phaseTimeInProgress);
  const endTime = parseTimeRange(activity.phaseTimeEnd);
  
  // 按时间顺序判断当前处于哪个阶段
  // 先检查是否已经过了结束阶段
  if (endTime && endTime.start && now.isAfter(endTime.start)) {
    return '活动结束';
  }
  // 检查是否在活动进行中
  if (inProgressTime && inProgressTime.start && now.isAfter(inProgressTime.start)) {
    if (!inProgressTime.end || now.isBefore(inProgressTime.end)) {
      return '活动中';
    }
  }
  // 检查是否在活动开始阶段
  if (startTime && startTime.start && now.isAfter(startTime.start)) {
    if (!startTime.end || now.isBefore(startTime.end)) {
      return '活动开始';
    }
  }
  // 检查是否在准备阶段
  if (prepTime && prepTime.start && now.isAfter(prepTime.start)) {
    if (!prepTime.end || now.isBefore(prepTime.end)) {
      return '活动准备';
    }
  }
  
  // 如果所有时间都还没到，返回准备阶段
  return '活动准备';
};

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
      paymentQRCode: req.files && req.files['paymentQRCode'] ? req.files['paymentQRCode'][0].filename : null,
      currentPhase: '活动准备' // 默认阶段
    };
    
    // 如果选择了付费但未上传二维码，返回错误
    if (activityData.hasFee && !activityData.paymentQRCode) {
      return res.status(400).json({ error: '选择了报名费功能，必须上传支付二维码' });
    }
    
    const activity = await Activity.create(activityData);
    
    // 自动判断当前阶段
    activity.currentPhase = determineCurrentPhase(activity);
    await activity.save();
    
    io.emit('notification_update', { type: 'new_audit' });
    const actObj = activity.toObject();
    actObj.id = activity._id.toString();
    res.json(actObj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/activities/approved', async (req, res) => {
  try { 
    const activities = await Activity.find({ status: 'approved' });
    
    // 为每个活动添加当前报名人数和组织者信息，并自动更新阶段
    const activitiesWithCount = await Promise.all(activities.map(async (act) => {
      const plain = act.toObject();
      plain.id = act._id.toString();
      const count = await ActivityRegistration.countDocuments({ activityID: act._id, status: 'approved' });
      
      // 自动判断并更新当前阶段
      const newPhase = determineCurrentPhase(plain);
      if (newPhase !== plain.currentPhase) {
        act.currentPhase = newPhase;
        await act.save();
        plain.currentPhase = newPhase;
      }
      
      // 获取组织者信息（含英文名）
      let organizerName = null;
      let organizerClass = null;
      let organizerEnglishName = null;
      if (plain.organizerID) {
        const organizer = await User.findOne({ userID: plain.organizerID }).select('name englishName class').lean();
        if (organizer) {
          organizerName = organizer.name;
          organizerClass = organizer.class;
          organizerEnglishName = organizer.englishName || null;
        }
      }
      
      return { 
        ...plain, 
        currentRegCount: count,
        organizerName,
        organizerClass,
        organizerEnglishName,
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

// 更新活动详情：名称、人数、时间、地点、简介、流程、需求、报名费（仅组织者或管理员）
app.put('/api/activities/:id/update-info', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID: operatorID, name, capacity, time, location, description, flow, requirements, hasFee, feeAmount } = req.body;
    if (!operatorID) return res.status(400).json({ error: '缺少 userID' });

    const act = await Activity.findById(id);
    if (!act) return res.status(404).json({ error: '活动不存在' });

    const operator = await User.findOne({ userID: operatorID });
    if (!operator) return res.status(401).json({ error: '用户不存在' });
    const isOrganizer = act.organizerID === operatorID;
    const isAdmin = operator.role === 'admin' || operator.role === 'super_admin';
    if (!isOrganizer && !isAdmin) return res.status(403).json({ error: '仅活动组织者或管理员可修改' });

    if (name !== undefined && String(name || '').trim()) act.name = String(name).trim();
    if (time !== undefined) act.time = String(time || '').trim();
    if (location !== undefined) act.location = String(location || '').trim();
    if (description !== undefined) act.description = String(description || '').trim();
    if (flow !== undefined) act.flow = String(flow || '').trim();
    if (requirements !== undefined) act.requirements = String(requirements || '').trim();
    if (hasFee !== undefined) act.hasFee = hasFee === true || hasFee === 'true';
    if (feeAmount !== undefined) act.feeAmount = String(feeAmount || '').trim() || null;

    if (capacity !== undefined) {
      const val = capacity === '' || capacity == null ? null : Number(capacity);
      if (val != null && (isNaN(val) || val < 0)) return res.status(400).json({ error: '人数上限必须为非负整数' });
      if (val != null) {
        const currentCount = await ActivityRegistration.countDocuments({ activityID: act._id, status: 'approved' });
        if (val < currentCount) return res.status(400).json({ error: `人数上限不能小于当前报名人数（${currentCount}人）` });
      }
      act.capacity = val;
    }

    await act.save();

    const actObj = act.toObject();
    actObj.id = act._id.toString();
    res.json({ success: true, activity: actObj });
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
    }).sort({ createdAt: 1 }).lean();
    
    const userIDs = [...new Set(registrations.map(r => r.userID).filter(Boolean))];
    const users = userIDs.length ? await User.find({ userID: { $in: userIDs } }).select('userID name englishName class').lean() : [];
    const userMap = Object.fromEntries(users.map(u => [u.userID, u]));
    
    const participants = registrations.map((reg, index) => {
      const u = reg.userID ? userMap[reg.userID] : null;
      return {
        index: index + 1,
        name: u ? u.name : (reg.name || ''),
        class: u ? u.class : (reg.class || ''),
        englishName: u ? (u.englishName || '') : '',
        userID: reg.userID || '',
        contact: reg.contact || '',
        reason: reg.reason || '',
        registeredAt: reg.createdAt,
        paymentStatus: reg.paymentStatus || 'unpaid',
        paymentProof: reg.paymentProof || null
      };
    });
    
    res.json({
      activityName: activity.name,
      participants
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
    const user = await User.findOne({ userID }).select('role userID'); // 只查询必要字段
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    
    // 优化：只查询必要字段，移除populate（减少查询时间）
    // 并行执行所有基础查询，大幅提升性能
    const [
      myClubStatus,
      myActivityStatus,
      myActivityRegStatus,
      myOwnClubJoinStatus,
      myActs,
      myClubs,
      ...adminData
    ] = await Promise.all([
      Club.find({ founderID: userID }).select('name status founderID createdAt').lean(), // lean()返回普通对象，更快
      Activity.find({ organizerID: userID }).select('name status organizerID createdAt').lean(),
      ActivityRegistration.find({ userID }).select('name class userID status activityID createdAt').lean(), // 移除populate，只查ID
      ClubMember.find({ userID }).select('userID clubID status createdAt').lean(), // 移除populate
      Activity.find({ organizerID: userID }).select('_id').lean(), // 只需要ID
      Club.find({ founderID: userID }).select('_id').lean(), // 只需要ID
      // 管理员数据：只查询必要字段
      isAdmin ? Club.find({ status: 'pending' }).select('name status founderID actualLeaderName createdAt type blocks intro content location time duration weeks capacity contact file').lean() : Promise.resolve([]),
      isAdmin ? Activity.find({ status: 'pending' }).select('name status organizerID createdAt').lean() : Promise.resolve([]),
      isAdmin ? ActivityRegistration.find({ status: 'pending' }).select('name class userID status activityID createdAt').lean() : Promise.resolve([])
    ]);
    
    const clubCreations = adminData[0] || [];
    const activityCreations = adminData[1] || [];
    const allActivityRegs = adminData[2] || [];
    
    const myActIDs = myActs.map(a => a._id);
    const myClubIDs = myClubs.map(c => c._id);
    
    // 并行查询活动报名申请和社团加入申请（只查询必要字段）
    const [myActivityRegApprovals, joinApprovals] = await Promise.all([
      myActIDs.length > 0 
        ? ActivityRegistration.find({ activityID: { $in: myActIDs }, status: 'pending' })
          .select('name class userID status activityID reason contact paymentProof paymentStatus createdAt')
          .lean()
        : Promise.resolve([]),
      myClubIDs.length > 0
        ? ClubMember.find({ clubID: { $in: myClubIDs }, status: 'pending' })
          .select('userID clubID status createdAt')
          .lean()
        : Promise.resolve([])
    ]);
    
    // 批量查询所有申请者的用户信息（避免N+1查询，只查询必要字段）
    const approvalUserIDs = [...new Set(joinApprovals.map(a => a.userID))];
    const approvalUsers = approvalUserIDs.length > 0
      ? await User.find({ userID: { $in: approvalUserIDs } }).select('name class userID').lean()
      : [];
    const userMap = new Map(approvalUsers.map(u => [u.userID, u]));
    
    // 构建社团加入申请结果
    const myClubJoinApprovals = joinApprovals.map((approval) => {
      const approvalUser = userMap.get(approval.userID);
      return {
        ...approval,
        id: approval._id.toString(),
        User: approvalUser ? {
          name: approvalUser.name,
          class: approvalUser.class,
          userID: approvalUser.userID
        } : null
      };
    });
    
    const result = {
      clubCreations,
      activityCreations,
      allActivityRegs,
      myClubStatus,
      myActivityStatus,
      myActivityRegStatus,
      myActivityRegApprovals,
      myClubJoinApprovals,
      myOwnClubJoinStatus
    };

    // 转换_id为id（优化：因为使用了lean()，已经是普通对象，直接转换）
    const convertId = (item) => {
      if (Array.isArray(item)) {
        return item.map(i => ({ ...i, id: i._id ? i._id.toString() : i.id }));
      }
      return { ...item, id: item._id ? item._id.toString() : item.id };
    };

    result.myClubStatus = convertId(result.myClubStatus);
    result.myActivityStatus = convertId(result.myActivityStatus);
    result.myActivityRegStatus = convertId(result.myActivityRegStatus);
    result.myOwnClubJoinStatus = convertId(result.myOwnClubJoinStatus);
    if (isAdmin) {
      result.clubCreations = convertId(result.clubCreations);
      result.activityCreations = convertId(result.activityCreations);
      result.allActivityRegs = convertId(result.allActivityRegs);
    }
    result.myActivityRegApprovals = convertId(result.myActivityRegApprovals);
    // myClubJoinApprovals已经在上面转换过了

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

// 管理员搜索用户（用于权限分配，仅 super_admin）
app.get('/api/admin/users/search', async (req, res) => {
  try {
    const { query, operatorID } = req.query;
    if (!operatorID) return res.status(400).json({ error: '缺少 operatorID' });
    const op = await User.findOne({ userID: operatorID });
    if (!op || op.role !== 'super_admin') return res.status(403).json({ error: '仅超级管理员可搜索用户' });
    if (!query || query.trim() === '') {
      return res.json([]);
    }
    
    // 搜索用户：按姓名或userID搜索
    const users = await User.find({
      $or: [
        { name: { $regex: query.trim(), $options: 'i' } },
        { userID: { $regex: query.trim(), $options: 'i' } }
      ]
    })
    .select('name englishName class role userID')
    .lean()
    .limit(50); // 限制返回50条，避免数据过多
    
    // 格式化返回数据
    const formattedUsers = users.map(u => ({
      name: u.name,
      englishName: u.englishName || '',
      class: u.class,
      role: u.role,
      userID: u.userID
    }));
    
    res.json(formattedUsers);
  } catch (e) {
    console.error('搜索用户失败:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/set-role', async (req, res) => {
  try {
    const { operatorID, targetUserID, role } = req.body;
    if (!operatorID || !targetUserID || !role) return res.status(400).json({ error: '缺少参数' });
    const op = await User.findOne({ userID: operatorID });
    if (!op || op.role !== 'super_admin') return res.status(403).json({ error: '权限不足' });
    const target = await User.findOne({ userID: targetUserID });
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: '角色只能是 user 或 admin' });
    target.role = role;
    await target.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 管理员删除普通用户账户（仅能删除 role 为 user 的账户，防止无用 ID 占用）
app.delete('/api/admin/users/:userID', async (req, res) => {
  try {
    const { userID: targetUserID } = req.params;
    const operatorID = req.query.operatorID;
    if (!operatorID) return res.status(400).json({ error: '缺少 operatorID' });
    const op = await User.findOne({ userID: operatorID });
    if (!op || op.role !== 'super_admin') return res.status(403).json({ error: '仅超级管理员可删除用户' });
    const target = await User.findOne({ userID: targetUserID });
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.role !== 'user') return res.status(403).json({ error: '只能删除普通用户账户，不能删除管理员或超级管理员' });
    if (operatorID === targetUserID) return res.status(400).json({ error: '不能删除自己的账户' });
    const foundedClubs = await Club.countDocuments({ founderID: targetUserID });
    if (foundedClubs > 0) return res.status(400).json({ error: '该用户创建了社团，请先解散或转移后再删除账户' });
    await ClubMember.deleteMany({ userID: targetUserID });
    await ActivityRegistration.deleteMany({ userID: targetUserID });
    await Feedback.deleteMany({ authorID: targetUserID });
    await Notification.deleteMany({ userID: targetUserID });
    await SemesterRotation.deleteMany({ userID: targetUserID });
    await User.deleteOne({ userID: targetUserID });
    res.json({ success: true, message: '账户已删除' });
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
      const user = await User.findOne({ userID: member.userID }).select('name englishName class userID');
      return {
        index: 0, // 稍后设置
        name: user ? user.name : '',
        englishName: user ? (user.englishName || '') : '',
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

// ---------- 点名/出勤 ----------
function isClubCoreOrAdmin(club, userID, user) {
  if (!club || !user) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (club.founderID === userID) return true;
  const coreIDs = club.coreMemberIDs || [];
  return coreIDs.includes(userID);
}

app.get('/api/clubs/:id/attendance-sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (!isClubCoreOrAdmin(club, userID, user)) return res.status(403).json({ error: '仅核心人员或管理员可查看' });
    const sessions = await ClubAttendanceSession.find({ clubID: club._id }).sort({ date: -1 }).lean();
    const list = sessions.map(s => ({ ...s, id: s._id.toString() }));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/:id/attendance-sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID, date, note } = req.body;
    if (!userID || !date) return res.status(400).json({ error: '缺少 date 或 userID' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (!isClubCoreOrAdmin(club, userID, user)) return res.status(403).json({ error: '仅核心人员或管理员可发起点名' });
    const session = await ClubAttendanceSession.create({ clubID: club._id, date, note: note || '', recordedByUserID: userID });
    res.json({ ...session.toObject(), id: session._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/:id/attendance-sessions/:sessionId', async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const { userID } = req.query;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (!isClubCoreOrAdmin(club, userID, user)) return res.status(403).json({ error: '无权限' });
    const session = await ClubAttendanceSession.findById(sessionId);
    if (!session || session.clubID.toString() !== id) return res.status(404).json({ error: '点名场次不存在' });
    const presentUserIDs = (await ClubAttendanceRecord.find({ sessionID: session._id }).lean()).map(r => r.userID);
    const members = await ClubMember.find({ clubID: club._id, status: 'approved' });
    const memberUserIDs = members.map(m => m.userID);
    const users = await User.find({ userID: { $in: memberUserIDs } }).select('name englishName class userID').lean();
    const userMap = new Map(users.map(u => [u.userID, u]));
    const list = memberUserIDs.map(uid => ({
      userID: uid,
      name: userMap.get(uid)?.name || '',
      englishName: userMap.get(uid)?.englishName || '',
      class: userMap.get(uid)?.class || '',
      present: presentUserIDs.includes(uid)
    }));
    res.json({ ...session.toObject(), id: session._id.toString(), presentUserIDs, members: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clubs/:id/attendance-sessions/:sessionId', async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const { userID, presentUserIDs } = req.body;
    if (!userID || !Array.isArray(presentUserIDs)) return res.status(400).json({ error: '缺少 userID 或 presentUserIDs' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (!isClubCoreOrAdmin(club, userID, user)) return res.status(403).json({ error: '无权限' });
    const session = await ClubAttendanceSession.findById(sessionId);
    if (!session || session.clubID.toString() !== id) return res.status(404).json({ error: '点名场次不存在' });
    await ClubAttendanceRecord.deleteMany({ sessionID: session._id });
    for (const uid of presentUserIDs) {
      await ClubAttendanceRecord.create({ sessionID: session._id, userID: uid });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/:id/attendance-sessions/:sessionId/export', async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const { userID, type } = req.query; // type: all | absent
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (!isClubCoreOrAdmin(club, userID, user)) return res.status(403).json({ error: '无权限' });
    const session = await ClubAttendanceSession.findById(sessionId);
    if (!session || session.clubID.toString() !== id) return res.status(404).json({ error: '点名场次不存在' });
    const presentUserIDs = (await ClubAttendanceRecord.find({ sessionID: session._id }).lean()).map(r => r.userID);
    const members = await ClubMember.find({ clubID: club._id, status: 'approved' });
    const memberUserIDs = members.map(m => m.userID);
    const users = await User.find({ userID: { $in: memberUserIDs } }).select('name class userID').lean();
    const userMap = new Map(users.map(u => [u.userID, u]));
    let rows = memberUserIDs.map(uid => ({
      '姓名': userMap.get(uid)?.name || '',
      '班级': userMap.get(uid)?.class || '',
      '用户ID': uid,
      '出勤': presentUserIDs.includes(uid) ? '出勤' : '缺席'
    }));
    if (type === 'absent') rows = rows.filter(r => r['出勤'] === '缺席');
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '姓名': '无', '班级': '', '用户ID': '', '出勤': '' }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, type === 'absent' ? '缺席名单' : '出勤名单');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(club.name)}_${session.date}_${type === 'absent' ? '缺席' : '出勤'}.xlsx"`);
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- 场地申请与排期 ----------
function getCurrentSemesterForVenue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 9) return `${y}-fall`;
  if (m === 1) return `${y - 1}-fall`;
  return `${y}-spring`;
}

app.get('/api/clubs/:id/venue-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID } = req.query;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const list = await ClubVenueRequest.find({ clubID: club._id }).sort({ createdAt: -1 }).lean();
    res.json(list.map(r => ({ ...r, id: r._id.toString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/:id/venue-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const { userID, semester, blocks, note } = req.body;
    if (!userID || !semester) return res.status(400).json({ error: '请选择学期' });
    const club = await Club.findById(id);
    if (!club) return res.status(404).json({ error: '社团不存在' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (club.founderID !== userID && user.role !== 'admin' && user.role !== 'super_admin') return res.status(403).json({ error: '仅社团创建者或管理员可提交' });
    const reqDoc = await ClubVenueRequest.create({
      clubID: club._id,
      semester,
      blocks: Array.isArray(blocks) ? blocks : [],
      note: note || '',
      status: 'pending'
    });
    res.json({ ...reqDoc.toObject(), id: reqDoc._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/venue-requests/all', async (req, res) => {
  try {
    const { userID } = req.query;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (user.role !== 'admin' && user.role !== 'super_admin') return res.status(403).json({ error: '仅管理员可查看' });
    const list = await ClubVenueRequest.find().populate('clubID', 'name').sort({ createdAt: -1 }).lean();
    res.json(list.map(r => ({ ...r, id: r._id.toString(), clubName: r.clubID?.name })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clubs/venue-requests/:rid', async (req, res) => {
  try {
    const { rid } = req.params;
    const { userID, status } = req.body;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (user.role !== 'admin' && user.role !== 'super_admin') return res.status(403).json({ error: '仅管理员可操作' });
    const r = await ClubVenueRequest.findById(rid);
    if (!r) return res.status(404).json({ error: '申请不存在' });
    r.status = status;
    await r.save();
    res.json({ ...r.toObject(), id: r._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clubs/venue-schedule', async (req, res) => {
  try {
    const { semester, clubID } = req.query;
    const filter = {};
    if (semester) filter.semester = semester;
    if (clubID) filter.clubID = clubID;
    const list = await ClubVenueSchedule.find(filter).populate('clubID', 'name').sort({ date: 1, block: 1 }).lean();
    res.json(list.map(s => ({
      ...s,
      id: s._id.toString(),
      clubName: s.clubID?.name,
      clubID: s.clubID?._id?.toString()
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clubs/venue-schedule', async (req, res) => {
  try {
    const { userID, clubID, semester, date, block, venueName } = req.body;
    if (!userID || !clubID || !semester || !date || !block || !venueName) return res.status(400).json({ error: '缺少参数' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (user.role !== 'admin' && user.role !== 'super_admin') return res.status(403).json({ error: '仅管理员可排期' });
    const schedule = await ClubVenueSchedule.create({ clubID, semester, date, block, venueName });
    res.json({ ...schedule.toObject(), id: schedule._id.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clubs/venue-schedule/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const { userID } = req.query;
    if (!userID) return res.status(400).json({ error: '缺少 userID' });
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    if (user.role !== 'admin' && user.role !== 'super_admin') return res.status(403).json({ error: '仅管理员可删除' });
    await ClubVenueSchedule.findByIdAndDelete(sid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    
    // 检查权限：社团创建者或 super_admin 可解散（admin 不能解散）
    const user = await User.findOne({ userID });
    if (!user) return res.status(401).json({ error: '用户不存在' });
    
    const isFounder = club.founderID === userID;
    const isSuperAdmin = user.role === 'super_admin';
    
    if (!isFounder && !isSuperAdmin) {
      return res.status(403).json({ error: '只有社团创建者或超级管理员可以解散此社团' });
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


