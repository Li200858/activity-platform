import React, { useState, useEffect } from 'react';
import { api, downloadExport } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { TranslatableContent } from '../components/TranslatableContent';

function ClubMatters({ user }) {
  const { t, isEn } = useLanguage();
  const [view, setView] = useState('menu'); // menu, rotation, registration, creation, members, attendance, venue
  const [clubs, setClubs] = useState([]);
  const [myClub, setMyClub] = useState(null); // 周三社团第一个（兼容）
  const [myWednesdayClubs, setMyWednesdayClubs] = useState([]); // 周三社团列表（最多4时段，至少2个）
  const [myDailyClubs, setMyDailyClubs] = useState([]); // 日常社团（可多个）
  const [selectedClubDetail, setSelectedClubDetail] = useState(null);
  const [members, setMembers] = useState(null); // { clubName, members: [] }
  const [membersClubId, setMembersClubId] = useState(null); // 当前查看成员列表的社团ID
  const [attendanceClub, setAttendanceClub] = useState(null);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [selectedAttendanceSession, setSelectedAttendanceSession] = useState(null);
  const [attendanceMembers, setAttendanceMembers] = useState([]);
  const [venueClub, setVenueClub] = useState(null);
  const [venueRequests, setVenueRequests] = useState([]);
  const [venueSchedules, setVenueSchedules] = useState([]);
  const [venueForm, setVenueForm] = useState({ semester: '', blocks: [], note: '' });
  const [newAttendanceDate, setNewAttendanceDate] = useState('');
  const [newAttendanceNote, setNewAttendanceNote] = useState('');
  const [formData, setFormData] = useState({
    name: '', intro: '', content: '', location: '', time: '', duration: '', weeks: '', capacity: '', contact: '',
    actualLeaderName: '', // 实际负责人（代老师创建时填写）
    type: 'activity', blocks: [], category: 'wednesday', dailyTime: '' // dailyTime 仅周三+日常使用
  });
  const [file, setFile] = useState(null);
  const [nameStatus, setNameStatus] = useState(null);
  const [nameError, setNameError] = useState('');
  const [coreMemberSearchQuery, setCoreMemberSearchQuery] = useState('');
  const [coreMemberSearchResults, setCoreMemberSearchResults] = useState([]);
  const [coreMemberSearching, setCoreMemberSearching] = useState(false);
  const [rotationQuota, setRotationQuota] = useState(null); // { semester, used, limit }
  const [editingCategoryType, setEditingCategoryType] = useState(false);
  const [editCategoryTypeForm, setEditCategoryTypeForm] = useState({ category: '', type: 'activity', blocks: [], intro: '' });
  const [editingInfo, setEditingInfo] = useState(false);
  const [editInfoForm, setEditInfoForm] = useState({ content: '', location: '', time: '', duration: '', capacity: '', contact: '', actualLeaderName: '' });
  const [clubSearchQuery, setClubSearchQuery] = useState(''); // 社团报名/轮换 搜索
  const [clubSearchFocused, setClubSearchFocused] = useState(false);
  const [rotateTargetClubId, setRotateTargetClubId] = useState(null); // 轮换时选择要替换成的社团，再选要替换的
  const [wednesdayCollapsed, setWednesdayCollapsed] = useState(false); // 我的社团状态 - 周三社团折叠
  const [dailyCollapsed, setDailyCollapsed] = useState(false); // 我的社团状态 - 日常社团折叠
  const [wednesdayConfirmed, setWednesdayConfirmed] = useState(false); // 周三社团是否已最终确认
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false); // 最终确认弹窗
  const [managedClubs, setManagedClubs] = useState([]); // 我管理的社团（社长或核心成员）

  useEffect(() => {
    fetchClubs();
    fetchMyClub();
    if (user?.userID) fetchManagedClubs();
  }, [user?.userID]);

  const fetchManagedClubs = async () => {
    if (!user?.userID) return;
    try {
      const res = await api.get(`/clubs/managed/${user.userID}?operatorID=${encodeURIComponent(user.userID)}`);
      setManagedClubs(res.data || []);
    } catch (e) {
      setManagedClubs([]);
    }
  };

  useEffect(() => {
    if (view === 'rotation' && user?.userID) {
      api.get(`/clubs/rotation-quota?userID=${user.userID}`)
        .then(res => setRotationQuota(res.data))
        .catch(() => setRotationQuota(null));
    }
  }, [view, user?.userID]);

  const fetchClubs = async () => {
    const res = await api.get('/clubs/approved');
    setClubs(res.data);
  };

  const fetchMyClub = async () => {
    try {
      const res = await api.get(`/clubs/my/${user.userID}?operatorID=${encodeURIComponent(user.userID)}`);
      const wedList = res.data?.wednesdayClubs ?? (res.data?.wednesday ? [res.data.wednesday] : []);
      setMyWednesdayClubs(wedList);
      setMyClub(res.data?.wednesday ?? wedList[0] ?? null);
      setMyDailyClubs(res.data?.daily ?? []);
      setWednesdayConfirmed(res.data?.wednesdayConfirmed ?? false);
    } catch (e) {
      console.error("无法获取个人社团状态", e);
      setMyClub(null);
      setMyWednesdayClubs([]);
      setMyDailyClubs([]);
      setWednesdayConfirmed(false);
    }
  };

  const handleLeaveClub = async (clubID) => {
    if (!clubID) return;
    if (!window.confirm('确定要退出该社团吗？')) return;
    try {
      await api.post('/clubs/leave', { userID: user.userID, clubID, operatorID: user.userID });
      alert('已退出社团');
      fetchMyClub();
      fetchClubs();
    } catch (e) {
      alert(e.response?.data?.error || '退出失败');
    }
  };

  const handleWednesdayFinalConfirm = async () => {
    try {
      await api.post('/clubs/wednesday-confirm', { userID: user.userID, operatorID: user.userID });
      setShowFinalConfirmModal(false);
      setWednesdayConfirmed(true);
      fetchMyClub();
    } catch (e) {
      alert(e.response?.data?.error || '确认失败');
    }
  };

  // 检查社团名称是否可用
  const checkNameAvailability = async (name) => {
    if (!name || name.trim() === '') {
      setNameStatus(null);
      setNameError('');
      return;
    }
    
    setNameStatus('checking');
    setNameError('');
    
    try {
      const res = await api.post('/clubs/check-name', { name });
      if (res.data.available) {
        setNameStatus('available');
        setNameError('');
      } else {
        setNameStatus('taken');
        setNameError(res.data.error || '该社团名称不可用');
      }
    } catch (err) {
      setNameStatus('taken');
      setNameError(err.response?.data?.error || '检查失败，请稍后重试');
    }
  };

  const BLOCK_TIME_LABELS = { block1: '13:40-14:30', block2: '14:30-15:00', block3: '15:10-15:50', block4: '15:50-16:30' };
  const wednesdayTimeFromBlocks = (blocks) => {
    const order = ['block1', 'block2', 'block3', 'block4'];
    const range = BLOCK_TIME_LABELS;
    if (!blocks || blocks.length === 0) return '周三下午（从日历选择）';
    const sorted = [...blocks].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const first = range[sorted[0]], last = range[sorted[sorted.length - 1]];
    const start = first?.split('-')[0] || ''; const end = last?.split('-')[1] || '';
    return start && end ? `周三下午 ${start}–${end}` : '周三下午（从日历选择）';
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    
    if (nameStatus === 'taken') {
      alert(nameError || '该社团名称不可用，请使用其他名称');
      return;
    }
    if (nameStatus === 'checking') {
      alert('正在检查社团名称，请稍候...');
      return;
    }
    
    const needsBlocks = formData.category === 'wednesday' || formData.category === 'both';
    if (needsBlocks) {
      if (!formData.blocks || formData.blocks.length < 1) {
        alert('请至少选择 1 个活动板块');
        return;
      }
      if (formData.blocks.length > 3) {
        alert('最多选择 3 个活动板块');
        return;
      }
    }

    try {
      const data = new FormData();
      const payload = { ...formData };
      if (needsBlocks && formData.blocks?.length > 0) {
        payload.time = wednesdayTimeFromBlocks(formData.blocks);
        if (formData.category === 'both' && formData.dailyTime?.trim()) payload.time += '；日常：' + formData.dailyTime.trim();
      }
      Object.keys(payload).filter(k => k !== 'blocks').forEach(key => data.append(key, payload[key]));
      data.append('blocks', needsBlocks ? JSON.stringify(formData.blocks) : '[]');
      data.append('founderID', user.userID);
      data.append('operatorID', user.userID);
      if (formData.actualLeaderName?.trim()) data.append('actualLeaderName', formData.actualLeaderName.trim());
      if (file) data.append('file', file);
      await api.post('/clubs', data);
      alert('社团申请已提交，请等待管理员审核');
      setView('menu');
      // 重置表单
      setFormData({ name: '', intro: '', content: '', location: '', time: '', duration: '', weeks: '', capacity: '', contact: '', actualLeaderName: '', type: 'activity', blocks: [], category: 'wednesday', dailyTime: '' });
      setFile(null);
      setNameStatus(null);
      setNameError('');
    } catch (err) {
      alert(err.response?.data?.error || '创建失败，请稍后重试');
    }
  };

  const handleRegister = async (clubID) => {
    try {
      await api.post('/clubs/register', { userID: user.userID, clubID, operatorID: user.userID });
      alert('报名成功');
      fetchMyClub();
      fetchClubs();
      // 留在报名页，方便继续报日常社团
    } catch (err) {
      alert(err.response?.data?.error || '报名失败');
    }
  };

  const handleRotate = async (newClubID, oldClubID) => {
    try {
      const payload = { userID: user.userID, newClubID, operatorID: user.userID };
      if (oldClubID) payload.oldClubID = oldClubID;
      await api.post('/clubs/rotate', payload);
      alert('社团轮换成功');
      setRotateTargetClubId(null);
      fetchMyClub();
      fetchClubs();
      const res = await api.get(`/clubs/rotation-quota?userID=${user.userID}`);
      setRotationQuota(res.data);
    } catch (err) {
      alert(err.response?.data?.error || '轮换失败');
    }
  };

  const fetchMembers = async (clubId) => {
    try {
      const res = await api.get(`/clubs/${clubId}/members?userID=${user.userID}`);
      setMembers(res.data);
      setMembersClubId(clubId);
      setView('members');
    } catch (err) {
      alert(err.response?.data?.error || '获取成员列表失败');
    }
  };

  const handleKickMember = async (targetUserID) => {
    if (!membersClubId || !window.confirm('确定要将该成员踢出社团吗？')) return;
    try {
      await api.post(`/clubs/${membersClubId}/kick-member`, { targetUserID, operatorID: user.userID });
      alert('已踢出');
      fetchMembers(membersClubId);
    } catch (err) {
      alert(err.response?.data?.error || '踢出失败');
    }
  };

  const searchUsersForCore = async () => {
    if (!coreMemberSearchQuery.trim() || !selectedClubDetail?.id) return;
    setCoreMemberSearching(true);
    try {
      const res = await api.get(`/clubs/${selectedClubDetail.id}/search-users?q=${encodeURIComponent(coreMemberSearchQuery.trim())}&operatorID=${user.userID}`);
      setCoreMemberSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setCoreMemberSearchResults([]);
    } finally {
      setCoreMemberSearching(false);
    }
  };

  const addCoreMember = async (targetUserID) => {
    if (!selectedClubDetail?.id) return;
    try {
      await api.put(`/clubs/${selectedClubDetail.id}/core-members`, {
        userID: user.userID,
        targetUserID,
        action: 'add'
      });
      const updated = clubs.find(c => c.id === selectedClubDetail.id);
      if (updated) {
        const res = await api.get('/clubs/approved');
        const next = res.data.find(c => c.id === selectedClubDetail.id);
        setSelectedClubDetail(next || selectedClubDetail);
        setClubs(res.data);
      }
      setCoreMemberSearchQuery('');
      setCoreMemberSearchResults([]);
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  const removeCoreMember = async (targetUserID) => {
    if (!selectedClubDetail?.id || selectedClubDetail.founderID === targetUserID) return;
    try {
      await api.put(`/clubs/${selectedClubDetail.id}/core-members`, {
        userID: user.userID,
        targetUserID,
        action: 'remove'
      });
      const res = await api.get('/clubs/approved');
      const next = res.data.find(c => c.id === selectedClubDetail.id);
      setSelectedClubDetail(next || selectedClubDetail);
      setClubs(res.data);
    } catch (err) {
      alert(err.response?.data?.error || '移除失败');
    }
  };

  const canManageClub = (club) => {
    if (!club || !user) return false;
    if (club.founderID === user.userID) return true;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return (club.coreMembers || []).some(m => m.userID === user.userID);
  };

  const handleUpdateCategoryType = async () => {
    if (!selectedClubDetail?.id) return;
    const needsBlocks = editCategoryTypeForm.category === 'wednesday' || editCategoryTypeForm.category === 'both';
    if (needsBlocks) {
      if (!editCategoryTypeForm.blocks || editCategoryTypeForm.blocks.length < 1) {
        alert('请至少选择 1 个活动板块');
        return;
      }
      if (editCategoryTypeForm.blocks.length > 3) {
        alert('最多选择 3 个活动板块');
        return;
      }
    }
    try {
      await api.put(`/clubs/${selectedClubDetail.id}/update-category-type`, {
        userID: user.userID,
        category: editCategoryTypeForm.category,
        type: editCategoryTypeForm.type,
        blocks: JSON.stringify(editCategoryTypeForm.blocks),
        intro: editCategoryTypeForm.intro
      });
      alert('更新成功');
      setEditingCategoryType(false);
      // 刷新社团列表和详情
      const res = await api.get('/clubs/approved');
      setClubs(res.data);
      const updated = res.data.find(c => c.id === selectedClubDetail.id);
      if (updated) setSelectedClubDetail(updated);
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const handleUpdateInfo = async () => {
    if (!selectedClubDetail?.id) return;
    try {
      await api.put(`/clubs/${selectedClubDetail.id}/update-info`, {
        userID: user.userID,
        content: editInfoForm.content,
        location: editInfoForm.location,
        time: editInfoForm.time,
        duration: editInfoForm.duration,
        capacity: editInfoForm.capacity === '' ? null : editInfoForm.capacity,
        contact: editInfoForm.contact,
        actualLeaderName: editInfoForm.actualLeaderName
      });
      alert('更新成功');
      setEditingInfo(false);
      const res = await api.get('/clubs/approved');
      setClubs(res.data);
      const updated = res.data.find(c => c.id === selectedClubDetail.id);
      if (updated) setSelectedClubDetail(updated);
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const fetchAttendanceSessions = async (clubId) => {
    try {
      const res = await api.get(`/clubs/${clubId}/attendance-sessions?userID=${user.userID}`);
      setAttendanceSessions(res.data || []);
    } catch (e) {
      setAttendanceSessions([]);
    }
  };

  const createAttendanceSession = async () => {
    if (!attendanceClub?.id || !newAttendanceDate.trim()) return alert('请选择日期');
    try {
      await api.post(`/clubs/${attendanceClub.id}/attendance-sessions`, {
        userID: user.userID,
        date: newAttendanceDate,
        note: newAttendanceNote
      });
      setNewAttendanceDate('');
      setNewAttendanceNote('');
      fetchAttendanceSessions(attendanceClub.id);
    } catch (err) {
      alert(err.response?.data?.error || '发起点名失败');
    }
  };

  const loadAttendanceSession = async (sessionId) => {
    if (!attendanceClub?.id) return;
    try {
      const res = await api.get(`/clubs/${attendanceClub.id}/attendance-sessions/${sessionId}?userID=${user.userID}`);
      setSelectedAttendanceSession(res.data);
      setAttendanceMembers(res.data.members || []);
    } catch (e) {
      alert('加载失败');
    }
  };

  const saveAttendance = async () => {
    if (!attendanceClub?.id || !selectedAttendanceSession?.id) return;
    const presentUserIDs = attendanceMembers.filter(m => m.present).map(m => m.userID);
    try {
      await api.put(`/clubs/${attendanceClub.id}/attendance-sessions/${selectedAttendanceSession.id}`, {
        userID: user.userID,
        presentUserIDs
      });
      alert('已保存');
      loadAttendanceSession(selectedAttendanceSession.id);
    } catch (err) {
      alert(err.response?.data?.error || '保存失败');
    }
  };

  const exportAttendanceForSession = async (sessionId, sessionDate, type) => {
    try {
      const path = `/api/clubs/${attendanceClub.id}/attendance-sessions/${sessionId}/export?userID=${user.userID}&type=${type}`;
      const filename = `${attendanceClub.name}_${sessionDate}_${type === 'absent' ? 'absent' : 'attendance'}.xlsx`;
      await downloadExport(path, filename);
    } catch (e) {
      alert(e.message || '导出失败');
    }
  };

  const fetchVenueRequests = async (clubId) => {
    try {
      const res = await api.get(`/clubs/${clubId}/venue-requests?userID=${user.userID}`);
      setVenueRequests(res.data || []);
    } catch (e) {
      setVenueRequests([]);
    }
  };

  const fetchVenueSchedules = async (clubId) => {
    try {
      const res = await api.get(`/clubs/venue-schedule?clubID=${clubId}`);
      setVenueSchedules(res.data || []);
    } catch (e) {
      setVenueSchedules([]);
    }
  };

  const submitVenueRequest = async () => {
    if (!venueClub?.id || !venueForm.semester) return alert('请选择学期');
    try {
      await api.post(`/clubs/${venueClub.id}/venue-requests`, {
        userID: user.userID,
        semester: venueForm.semester,
        blocks: venueForm.blocks,
        note: venueForm.note
      });
      setVenueForm({ semester: '', blocks: [], note: '' });
      fetchVenueRequests(venueClub.id);
    } catch (err) {
      alert(err.response?.data?.error || '提交失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 周三社团最终确认弹窗 */}
      {showFinalConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowFinalConfirmModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <p className="text-gray-800 font-medium mb-4">{t('club.finalConfirmMessage')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinalConfirmModal(false)} className="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">{t('common.cancel')}</button>
              <button onClick={handleWednesdayFinalConfirm} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600">{t('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}
      {/* 当前社团状态卡片：周三社团（一个）+ 日常社团（多个），可折叠 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">{t('club.menu')}</h2>
        <div className="space-y-2">
          {/* 周三社团 - 可折叠 */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setWednesdayCollapsed(c => !c)}
              className="w-full flex justify-between items-center px-4 py-3 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-xs font-bold text-gray-600">{t('club.wednesday')}</span>
              <span className="text-gray-400 text-xs">
                {myWednesdayClubs.length === 0
                  ? (isEn ? 'Not joined' : '未加入')
                  : `${myWednesdayClubs.length} ${t('common.clubs')}`}
              </span>
              <span className={`text-gray-400 transition-transform ${wednesdayCollapsed ? '' : 'rotate-180'}`}>▼</span>
            </button>
            {!wednesdayCollapsed && (
              <div className="px-4 py-3 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">{t('club.wednesdayHint')}</span>
                {myWednesdayClubs.length === 0 ? (
                  <p className="text-gray-400 text-sm italic mt-1">{t('club.notJoined')}</p>
                ) : (
                  <>
                    <p className="text-xs text-blue-600 font-bold mt-1">{t('club.usedSlots')} {(() => {
                      const used = new Set();
                      myWednesdayClubs.forEach(m => { const c = m.Club || m.clubID; (c?.blocks || []).forEach(b => used.add(b)); });
                      return used.size;
                    })()} / {t('club.slotsTotal')}</p>
                    <ul className="mt-2 space-y-2">
                      {myWednesdayClubs.map(m => {
                        const c = m.Club || m.clubID;
                        return (
                          <li key={c?.id || m.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-2">
                            <span className="font-bold text-gray-800"><TranslatableContent>{c?.name || (isEn ? 'Unknown' : '未知')}</TranslatableContent></span>
                            <span className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                m.status === 'approved' ? 'bg-green-50 text-green-600' :
                                m.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                              }`}>
                                {m.status === 'approved' ? (isEn ? 'Joined' : '已加入') : m.status === 'rejected' ? (isEn ? 'Rejected' : '被拒绝') : (isEn ? 'Pending' : '审核中')}
                              </span>
                              {!wednesdayConfirmed && (
                                <button onClick={() => handleLeaveClub(c?.id)} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-black hover:bg-red-600 hover:text-white">{t('club.leave')}</button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {myWednesdayClubs.length < 2 && (
                      <p className="text-amber-600 text-xs font-medium mt-2">{t('club.needTwo')}</p>
                    )}
                    {!wednesdayConfirmed && myWednesdayClubs.filter(m => m.status === 'approved').length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setShowFinalConfirmModal(true)}
                        className="mt-3 w-full py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors"
                      >
                        {t('club.finalConfirm')}
                      </button>
                    )}
                    {wednesdayConfirmed && (
                      <p className="mt-2 text-xs text-amber-600 font-medium">{t('club.finalConfirmDone')}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {/* 日常社团 - 可折叠 */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setDailyCollapsed(c => !c)}
              className="w-full flex justify-between items-center px-4 py-3 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-xs font-bold text-gray-600">{t('club.daily')}</span>
              <span className="text-gray-400 text-xs">
                {myDailyClubs.length === 0
                  ? (isEn ? 'Not joined' : '未加入')
                  : `${myDailyClubs.length} ${t('common.clubs')}`}
              </span>
              <span className={`text-gray-400 transition-transform ${dailyCollapsed ? '' : 'rotate-180'}`}>▼</span>
            </button>
            {!dailyCollapsed && (
              <div className="px-4 py-3 border-t border-gray-100">
                {myDailyClubs.length === 0 ? (
                  <p className="text-gray-400 text-sm italic mt-1">{t('club.notJoined')}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {myDailyClubs.map(m => (
                      <li key={m.Club?.id || m.clubID} className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-2">
                        <span className="font-bold text-gray-800"><TranslatableContent>{m.Club?.name || (isEn ? 'Unknown' : '未知')}</TranslatableContent></span>
                        <button onClick={() => handleLeaveClub(m.Club?.id || m.clubID)} className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-black hover:bg-red-600 hover:text-white">{t('club.leave')}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {view === 'menu' && (
          <>
            {/* 我管理的社团（社长或核心成员） */}
            {managedClubs.length > 0 && (
              <div className="mb-8 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <h3 className="text-sm font-bold text-amber-800 mb-3">{isEn ? 'Clubs I Manage' : '我管理的社团'}</h3>
                <div className="flex flex-wrap gap-2">
                  {managedClubs.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClubDetail(c)}
                      className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl font-bold text-sm transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <button 
                onClick={() => {
                  if (myWednesdayClubs.length === 0) return alert(t('club.needOneWednesday'));
                  setView('rotation');
                }} 
                className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-105 active:scale-95 ${
                  myWednesdayClubs.length === 0 ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                }`}
              >
                <span className="font-black">{t('club.rotation')}</span>
                <span className="text-xs opacity-80">{t('club.rotationHint')}</span>
              </button>
              
              <button 
                onClick={() => setView('registration')} 
                className="p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-105 active:scale-95 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white"
              >
                <span className="font-black">{t('club.registration')}</span>
                <span className="text-xs opacity-80">{t('club.registrationHint')}</span>
              </button>

              <button onClick={() => setView('creation')} className="bg-purple-50 text-purple-600 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-purple-600 hover:text-white transition-all hover:scale-105 active:scale-95">
                <span className="font-black">{t('club.creation')}</span>
              </button>
            </div>

            {/* 显示所有社团列表：日常（含周三+日常）/ 周三（含周三+日常） */}
            <div className="border-t pt-6 space-y-6">
              {['daily', 'wednesday'].map(cat => {
                const list = cat === 'daily'
                  ? clubs.filter(c => c.category === 'daily' || c.category === 'both')
                  : clubs.filter(c => c.category === 'wednesday' || c.category === 'both');
                const title = cat === 'daily' ? t('club.daily') : t('club.wednesday');
                return (
                  <div key={cat}>
                    <h3 className="text-lg font-black text-gray-800 mb-4">{title}</h3>
                    {list.length === 0 ? (
                      <p className="text-center py-6 text-gray-400 italic">{cat === 'daily' ? t('club.noDaily') : t('club.noWednesday')}</p>
                    ) : (
                      <div className="grid gap-4">
                        {list.map(club => (
                    <div key={club.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-black text-gray-800 text-lg mb-2"><TranslatableContent>{club.name}</TranslatableContent></h4>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2 flex-wrap">
                            <span>
                              {club.actualLeaderName ? (
                                <>{t('club.actualLeader')}: {club.actualLeaderName} <span className="text-gray-400 text-xs">（{t('club.proxyCreated')}: {club.founderName || (isEn ? 'Unknown' : '未知')}）</span></>
                              ) : (
                                <>{t('club.creator')}: {club.founderName || (isEn ? 'Unknown' : '未知')}{club.founderEnglishName && ` / ${club.founderEnglishName}`}</>
                              )}
                            </span>
                            {!club.actualLeaderName && club.founderClass && <span>({club.founderClass})</span>}
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                              {club.memberCount} / {club.capacity} {t('common.people')}
                            </span>
                            {(club.type || club.blocks?.length) ? (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">
                                {club.type === 'academic' ? t('club.academic') : t('club.activityType')}
                                {club.blocks?.length ? ` · ${club.blocks.map(b => b.replace('block', 'B')).join('、')}` : ''}
                              </span>
                            ) : null}
                          </div>
                          {club.intro && (
                            <p className="text-xs text-gray-500 line-clamp-2 mt-2">{club.intro}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button 
                          onClick={() => setSelectedClubDetail(club)}
                          className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all"
                        >
                          {t('club.viewDetail')}
                        </button>
                        {/* 参与人员按钮 - 社长/核心成员/管理员可见 */}
                        {canManageClub(club) && (
                          <button 
                            onClick={() => fetchMembers(club.id)}
                            className="bg-purple-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition-all"
                          >
                            {t('club.participants')}
                          </button>
                        )}
                        {/* 下载Excel按钮 - 社长/核心成员/管理员可见 */}
                        {canManageClub(club) && (
                          <button 
                            onClick={async () => {
                              try {
                                await downloadExport(`/api/clubs/${club.id}/export?userID=${user.userID}`, `${club.name || 'club'}_members.xlsx`);
                              } catch (e) { alert(e.message || '导出失败'); }
                            }}
                            className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-all"
                          >
                            {t('club.downloadExcel')}
                          </button>
                        )}
                        {/* 解散社团按钮 - 仅创建者可见（super_admin 也只能解散自己创建的） */}
                        {club.founderID === user.userID && (
                          <button 
                            onClick={async () => {
                              if (!window.confirm('确定要解散此社团吗？所有成员将回到自由人身份。')) return;
                              try {
                                await api.delete(`/clubs/${club.id}?userID=${user.userID}`);
                                alert('社团已解散');
                                fetchClubs();
                                fetchMyClub();
                              } catch (err) {
                                alert(err.response?.data?.error || '解散失败');
                              }
                            }}
                            className="bg-red-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition-all"
                          >
                            {t('club.dissolve')}
                          </button>
                        )}
                      </div>
                    </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === 'registration' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800">{t('club.registration')}</h2>
              <button onClick={() => setView('menu')} className="text-xs font-bold text-gray-400 hover:text-blue-600">{t('club.backMenu')}</button>
            </div>
            {/* 搜索社团 */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder={t('club.searchClub')}
                value={clubSearchQuery}
                onChange={e => setClubSearchQuery(e.target.value)}
                onFocus={() => setClubSearchFocused(true)}
                onBlur={() => setTimeout(() => setClubSearchFocused(false), 200)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />
              {clubSearchQuery.trim() && clubSearchFocused && (() => {
                const q = clubSearchQuery.trim().toLowerCase();
                const dailyClubs = clubs.filter(c => (c.category === 'daily' || c.category === 'both') && c.name.toLowerCase().includes(q));
                const wednesdayClubs = clubs.filter(c => (c.category === 'wednesday' || c.category === 'both') && c.name.toLowerCase().includes(q));
                const list = [...dailyClubs, ...wednesdayClubs.filter(c => !dailyClubs.find(d => d.id === c.id))];
                if (list.length === 0) return <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-2 text-sm text-gray-500 text-center">无匹配社团</div>;
                return (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    {list.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedClubDetail(c); setClubSearchQuery(''); }}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <span className="font-bold text-gray-800">{c.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{c.memberCount} / {c.capacity} 人</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {(() => {
              const dailyClubs = clubs.filter(c => c.category === 'daily' || c.category === 'both');
              const wednesdayClubs = clubs.filter(c => c.category === 'wednesday' || c.category === 'both');
              const wednesdayUsedBlocks = () => {
                const used = new Set();
                myWednesdayClubs.forEach(m => { const c = m.Club || m.clubID; (c?.blocks || []).forEach(b => used.add(b)); });
                return used;
              };
              const canJoinWednesday = (club) => {
                const alreadyIn = myWednesdayClubs.some(m => (m.Club?.id || m.clubID) === club.id);
                if (alreadyIn) return false;
                const used = wednesdayUsedBlocks();
                const blocks = club.blocks || [];
                if (blocks.some(b => used.has(b))) return false;
                return used.size + blocks.length <= 4;
              };
              const renderClubRow = (club, canJoin) => (
                <div key={club.id} className="bg-gray-50 p-5 rounded-2xl flex justify-between items-center border border-gray-100 hover:border-green-200 transition-colors">
                  <button onClick={() => setSelectedClubDetail(club)} className="text-left group flex-1">
                    <h3 className="font-black text-gray-800 text-lg group-hover:text-blue-600 transition-colors"><TranslatableContent>{club.name}</TranslatableContent></h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500 line-clamp-1"><TranslatableContent>{club.intro || ''}</TranslatableContent></p>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                        {club.memberCount} / {club.capacity} 人
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRegister(club.id)}
                    disabled={!canJoin || (club.capacity && club.memberCount >= club.capacity)}
                    className={`px-6 py-2 rounded-xl font-black shadow-lg transition-all ${
                      !canJoin || (club.capacity && club.memberCount >= club.capacity)
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-green-600 text-white hover:scale-105 active:scale-95 shadow-green-100'
                    }`}
                  >
                    {club.capacity && club.memberCount >= club.capacity ? t('common.full') : !canJoin ? t('club.alreadyOrConflict') : t('club.join')}
                  </button>
                </div>
              );
              return (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-2">{t('club.dailyClubs')}</h3>
                    {dailyClubs.length === 0 ? <p className="text-center py-6 text-gray-400 italic">{t('club.noDaily')}</p> : (
                      <div className="grid gap-4">{dailyClubs.map(c => renderClubRow(c, true))}</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-2">{t('club.wednesdayClubs')}</h3>
                    {wednesdayClubs.length === 0 ? <p className="text-center py-6 text-gray-400 italic">{t('club.noWednesday')}</p> : (
                      <div className="grid gap-4">{wednesdayClubs.map(c => renderClubRow(c, canJoinWednesday(c)))}</div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {view === 'rotation' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-black text-gray-800">{t('club.rotation')}</h2>
                <p className="text-[10px] text-orange-500 font-bold mt-1 uppercase tracking-widest">{t('club.rotationTime')}</p>
                {rotationQuota != null && (
                  <p className={`text-sm font-bold mt-2 ${rotationQuota.used >= rotationQuota.limit ? 'text-red-600' : 'text-gray-600'}`}>
                    {rotationQuota.semesterLabel || (isEn ? 'This semester' : '本学期')} {t('club.semesterUsed')} {rotationQuota.used} / {rotationQuota.limit} {t('club.times')}
                    {rotationQuota.used >= rotationQuota.limit && (isEn ? ' (used up)' : '（已用完）')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {user.role === 'super_admin' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('确定重置本账号本学期轮换次数为 0？')) return;
                      try {
                        await api.post('/clubs/rotation-quota/reset', { operatorID: user.userID });
                        alert('已重置');
                        const res = await api.get(`/clubs/rotation-quota?userID=${user.userID}`);
                        setRotationQuota(res.data);
                      } catch (e) {
                        alert(e.response?.data?.error || '重置失败');
                      }
                    }}
                    className="text-xs font-bold text-amber-600 hover:text-amber-800 border border-amber-300 rounded-lg px-3 py-1.5"
                  >
                    {t('club.resetQuota')}
                  </button>
                )}
                <button onClick={() => setView('menu')} className="text-xs font-bold text-gray-400 hover:text-blue-600">返回菜单</button>
              </div>
            </div>
            {rotationQuota != null && rotationQuota.used >= rotationQuota.limit && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                {t('club.quotaExhausted')}
              </div>
            )}
            {/* 搜索社团：输入后弹出可轮换的社团列表，点击选择 */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder={t('club.searchRotation')}
                value={clubSearchQuery}
                onChange={e => setClubSearchQuery(e.target.value)}
                onFocus={() => setClubSearchFocused(true)}
                onBlur={() => setTimeout(() => setClubSearchFocused(false), 200)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {clubSearchQuery.trim() && clubSearchFocused && (() => {
                const q = clubSearchQuery.trim().toLowerCase();
                const myWedIds = new Set(myWednesdayClubs.map(m => (m.Club || m.clubID)?.id).filter(Boolean));
                const rotationList = clubs.filter(c => (c.category === 'wednesday' || c.category === 'both') && !myWedIds.has(c.id));
                const list = rotationList.filter(c => c.name.toLowerCase().includes(q));
                if (list.length === 0) return <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-2 text-sm text-gray-500 text-center">无匹配社团</div>;
                return (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                    {list.map(c => {
                      const quotaUsed = rotationQuota ? rotationQuota.used >= rotationQuota.limit : false;
                      return (
<button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedClubDetail(c); setClubSearchQuery(''); }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors flex justify-between items-center"
                    >
                      <span className="font-bold text-gray-800">{c.name}</span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">{c.memberCount} / {c.capacity}</span>
                    </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="grid gap-4">
              {clubs.filter(c => (c.category === 'wednesday' || c.category === 'both') && !(myWednesdayClubs.map(m => (m.Club || m.clubID)?.id).filter(Boolean).includes(c.id))).map(club => {
                const quotaUsed = rotationQuota ? rotationQuota.used >= rotationQuota.limit : false;
                return (
                  <div key={club.id} className="bg-gray-50 p-5 rounded-2xl flex justify-between items-center border border-gray-100 hover:border-blue-200 transition-colors">
                    <button onClick={() => setSelectedClubDetail(club)} className="text-left group flex-1">
                      <h3 className="font-black text-gray-800 text-lg group-hover:text-blue-600">{club.name}</h3>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold mt-1 inline-block">
                        当前人数: {club.memberCount} / {club.capacity}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (myWednesdayClubs.length === 1) handleRotate(club.id, (myWednesdayClubs[0].Club || myWednesdayClubs[0].clubID)?.id);
                        else setRotateTargetClubId(club.id);
                      }}
                      disabled={quotaUsed}
                      className={quotaUsed ? 'bg-gray-400 text-white px-6 py-2 rounded-xl font-black cursor-not-allowed' : 'bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all'}
                    >
                      {quotaUsed ? t('club.quotaUsed') : t('club.replaceWith')}
                    </button>
                  </div>
                );
              })}
            </div>
            {/* 轮换时选择要替换的社团（多个周三社团时） */}
            {rotateTargetClubId && myWednesdayClubs.length > 1 && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRotateTargetClubId(null)}>
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="font-black text-gray-800 mb-4">{t('club.replaceWhich')}</h3>
                  <p className="text-sm text-gray-500 mb-4">{t('club.replaceHint')}</p>
                  <ul className="space-y-2">
                    {myWednesdayClubs.map(m => {
                      const c = m.Club || m.clubID;
                      return (
                        <li key={c?.id}>
                          <button
                            type="button"
                            onClick={() => handleRotate(rotateTargetClubId, c?.id)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
                          >
                            {c?.name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={() => setRotateTargetClubId(null)} className="mt-4 w-full py-2 text-gray-500 font-bold">取消</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'creation' && (
          <form onSubmit={handleCreateClub} className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800">发起社团创建申请</h2>
              <button onClick={() => setView('menu')} type="button" className="text-xs font-bold text-gray-400 hover:text-purple-600">返回菜单</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">社团分类</label>
                  <div className="flex flex-wrap gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="category" checked={formData.category === 'daily'} onChange={() => setFormData({ ...formData, category: 'daily' })} className="rounded-full border-gray-300" />
                      <span className="text-sm font-medium">日常社团</span>
                      <span className="text-[10px] text-gray-400">（非周三，可报多个）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="category" checked={formData.category === 'wednesday'} onChange={() => setFormData({ ...formData, category: 'wednesday' })} className="rounded-full border-gray-300" />
                      <span className="text-sm font-medium">周三社团</span>
                      <span className="text-[10px] text-gray-400">（从下方日历选时段）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="category" checked={formData.category === 'both'} onChange={() => setFormData({ ...formData, category: 'both' })} className="rounded-full border-gray-300" />
                      <span className="text-sm font-medium">周三+日常</span>
                      <span className="text-[10px] text-gray-400">（周三日历 + 日常）</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">选「周三」或「周三+日常」时，右侧会出现周三下午时间日历，直接点选时段即可；选「日常」无固定 block。</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">社团基本信息</label>
                  <div>
                    <input 
                      placeholder="社团名称" 
                      className={`bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 transition-all w-full ${
                        nameStatus === 'taken' 
                          ? 'focus:ring-red-500 ring-2 ring-red-300' 
                          : nameStatus === 'available' 
                          ? 'focus:ring-green-500 ring-2 ring-green-300' 
                          : 'focus:ring-purple-500'
                      }`} 
                      required 
                      value={formData.name}
                      onChange={e => {
                        const newName = e.target.value;
                        setFormData({...formData, name: newName});
                        // 延迟检查，避免频繁请求
                        clearTimeout(window.nameCheckTimeout);
                        window.nameCheckTimeout = setTimeout(() => {
                          checkNameAvailability(newName);
                        }, 500);
                      }} 
                    />
                    {nameStatus === 'checking' && (
                      <p className="text-xs text-gray-500 mt-1 ml-1">正在检查名称...</p>
                    )}
                    {nameStatus === 'available' && (
                      <p className="text-xs text-green-600 mt-1 ml-1">✓ 该名称可用</p>
                    )}
                    {nameStatus === 'taken' && nameError && (
                      <p className="text-xs text-red-600 mt-1 ml-1">✗ {nameError}</p>
                    )}
                  </div>
                  <textarea placeholder="一句话介绍社团..." className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all h-24" required onChange={e => setFormData({...formData, intro: e.target.value})} />
                  <textarea placeholder="主要活动内容..." className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all h-24" required onChange={e => setFormData({...formData, content: e.target.value})} />
                  <input placeholder="联系方式（如微信号、手机号等，便于线下联系）" value={formData.contact} className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all" required onChange={e => setFormData({...formData, contact: e.target.value})} />
                  <input placeholder="实际负责人（若为代老师创建，请填写老师姓名，如：张老师）" value={formData.actualLeaderName} className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all" onChange={e => setFormData({...formData, actualLeaderName: e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-4">
                {(formData.category === 'wednesday' || formData.category === 'both') && (
                <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-blue-100 bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">周三下午 · 从日历选择时段</span>
                  </div>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="clubType"
                        checked={formData.type === 'academic'}
                        onChange={() => setFormData({ ...formData, type: 'academic' })}
                        className="rounded-full border-gray-300"
                      />
                      <span className="text-sm font-medium">学术</span>
                      <span className="text-[10px] text-gray-500">（可选 Block1～4，选 1～3 个）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="clubType"
                        checked={formData.type === 'activity'}
                        onChange={() => setFormData({ ...formData, type: 'activity', blocks: formData.blocks.filter(b => b !== 'block1') })}
                        className="rounded-full border-gray-300"
                      />
                      <span className="text-sm font-medium">活动</span>
                      <span className="text-[10px] text-gray-500">（不可选 Block1，选 1～3 个）</span>
                    </label>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600">周三下午时间</div>
                    <div className="flex">
                      <div className="flex flex-col text-[10px] font-mono text-gray-500 border-r border-gray-100 bg-gray-50/50 shrink-0">
                        <div className="h-11 flex items-end pb-1 pr-2">13:40</div>
                        <div className="h-11 flex items-end pb-1 pr-2">14:30</div>
                        <div className="h-11 flex items-end pb-1 pr-2">15:00</div>
                        <div className="h-11 flex items-end pb-1 pr-2">15:10</div>
                        <div className="h-11 flex items-end pb-1 pr-2">15:50</div>
                        <div className="h-3 flex items-end pb-1 pr-2">16:30</div>
                      </div>
                      <div className="flex-1 flex flex-col min-w-0">
                        {[
                          { id: 'block1', start: '13:40', end: '14:30', label: 'Block1', sub: '学术 50min' },
                          { id: 'block2', start: '14:30', end: '15:00', label: 'Block2', sub: '30min' },
                          { id: 'block3', start: '15:10', end: '15:50', label: 'Block3', sub: '40min' },
                          { id: 'block4', start: '15:50', end: '16:30', label: 'Block4', sub: '40min' }
                        ].map(({ id, start, end, label, sub }) => {
                          const isActivity = formData.type === 'activity';
                          const block1Disabled = isActivity && id === 'block1';
                          const checked = formData.blocks.includes(id);
                          const canAdd = checked || formData.blocks.length < 3;
                          const disabled = block1Disabled || !canAdd;
                          return (
                            <label
                              key={id}
                              className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-100 last:border-b-0 transition-all ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-purple-50 ' + (checked ? 'bg-purple-100 border-l-4 border-l-purple-500' : '')}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-bold text-gray-700 tabular-nums shrink-0">{start} – {end}</span>
                                <span className="font-medium text-gray-800 truncate">{label}</span>
                                <span className="text-[10px] text-gray-500 shrink-0">{sub}</span>
                              </div>
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={checked}
                                onChange={() => {
                                  if (disabled) return;
                                  const next = checked ? formData.blocks.filter(b => b !== id) : [...formData.blocks, id].slice(-3);
                                  setFormData({ ...formData, blocks: next });
                                }}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 shrink-0"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-50/80 border-t border-gray-100 text-[10px] text-gray-600">
                      日常不设 block；仅周三下午在此选择。
                    </div>
                  </div>
                  {formData.blocks.length < 1 && <p className="text-xs text-red-500">请至少选择 1 个时段</p>}
                </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">活动安排详情</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="地点" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all" required onChange={e => setFormData({...formData, location: e.target.value})} />
                    {(formData.category === 'wednesday' || formData.category === 'both') ? (
                      <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-600 border border-gray-200">
                        周三时间由上方日历所选 block 确定
                        {formData.blocks.length > 0 && (
                          <span className="block mt-1 font-mono text-xs text-gray-700">{wednesdayTimeFromBlocks(formData.blocks)}</span>
                        )}
                      </div>
                    ) : (
                      <input placeholder="具体时间（如周一/五下午）" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all" required onChange={e => setFormData({...formData, time: e.target.value})} />
                    )}
                  </div>
                  {formData.category === 'both' && (
                    <div className="mt-2">
                      <label className="text-[10px] font-bold text-amber-600 uppercase ml-1 block mb-1">日常时间（除周三外的其他天）</label>
                      <input
                        placeholder="如：周一、五下午 4:00；或任意描述"
                        value={formData.dailyTime}
                        onChange={e => setFormData({ ...formData, dailyTime: e.target.value })}
                        className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="单次时长" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all text-xs" required onChange={e => setFormData({...formData, duration: e.target.value})} />
                    <input placeholder="持续周数" type="number" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all text-xs" required onChange={e => setFormData({...formData, weeks: e.target.value})} />
                    <input placeholder="容量限制" type="number" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all text-xs" required onChange={e => setFormData({...formData, capacity: e.target.value})} />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">附件资料 (可选)</label>
                  <input type="file" className="text-sm file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 transition-all cursor-pointer" onChange={e => setFile(e.target.files[0])} />
                </div>
              </div>
            </div>
            
            <button type="submit" className="w-full mt-8 bg-purple-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-purple-100 hover:bg-purple-700 hover:scale-[1.01] active:scale-[0.99] transition-all">提交社团创建申请</button>
          </form>
        )}

        {view === 'attendance' && attendanceClub && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800">点名记录 · {attendanceClub.name}</h2>
              <button onClick={() => { setView('menu'); setAttendanceClub(null); setSelectedAttendanceSession(null); }} className="text-xs font-bold text-gray-400 hover:text-amber-600">返回菜单</button>
            </div>
            <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-bold text-amber-800 mb-2">发起点名</p>
              <div className="flex gap-2 flex-wrap items-end">
                <input type="date" value={newAttendanceDate} onChange={e => setNewAttendanceDate(e.target.value)} className="bg-white border rounded-lg px-3 py-2 text-sm" />
                <input type="text" placeholder="备注（可选）" value={newAttendanceNote} onChange={e => setNewAttendanceNote(e.target.value)} className="bg-white border rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px]" />
                <button onClick={createAttendanceSession} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm">发起</button>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {attendanceSessions.map(s => (
                <div key={s.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="font-medium">{s.date} {s.note && `· ${s.note}`}</span>
                  <div className="flex gap-2">
                    <button onClick={() => loadAttendanceSession(s.id)} className="text-amber-600 text-xs font-bold">编辑</button>
                    <button type="button" onClick={() => exportAttendanceForSession(s.id, s.date, 'all')} className="text-green-600 text-xs font-bold hover:underline">导出出勤</button>
                    <button type="button" onClick={() => exportAttendanceForSession(s.id, s.date, 'absent')} className="text-red-600 text-xs font-bold hover:underline">导出缺席</button>
                  </div>
                </div>
              ))}
            </div>
            {selectedAttendanceSession && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-bold text-gray-700 mb-2">勾选出勤 · {selectedAttendanceSession.date}</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {attendanceMembers.map(m => (
                    <label key={m.userID} className="flex items-center gap-3 p-2 bg-white rounded-lg border">
                      <input type="checkbox" checked={!!m.present} onChange={e => setAttendanceMembers(prev => prev.map(x => x.userID === m.userID ? { ...x, present: e.target.checked } : x))} />
                      <span>
                        {m.name}
                        {m.englishName && ` / ${m.englishName}`}
                      </span>
                      <span className="text-gray-400 text-xs">{m.class}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveAttendance} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm">保存</button>
                  <button onClick={() => setSelectedAttendanceSession(null)} className="text-gray-500 text-sm">关闭</button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'venue' && venueClub && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800">场地申请与排期 · {venueClub.name}</h2>
              <button onClick={() => { setView('menu'); setVenueClub(null); }} className="text-xs font-bold text-gray-400 hover:text-teal-600">返回菜单</button>
            </div>
            <div className="mb-6 p-4 bg-teal-50 rounded-xl border border-teal-200">
              <p className="text-xs font-bold text-teal-800 mb-2">提交场地申请</p>
              <div className="space-y-2">
                <select value={venueForm.semester} onChange={e => setVenueForm(f => ({ ...f, semester: e.target.value }))} className="w-full bg-white border rounded-lg px-3 py-2 text-sm">
                  <option value="">选择学期</option>
                  <option value="2026-spring">2026年春季</option>
                  <option value="2026-fall">2026年秋季</option>
                  <option value="2025-fall">2025年秋季</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  {['block1', 'block2', 'block3', 'block4'].map(b => (
                    <label key={b} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={venueForm.blocks.includes(b)} onChange={e => setVenueForm(f => ({ ...f, blocks: e.target.checked ? [...f.blocks, b] : f.blocks.filter(x => x !== b) }))} />
                      {b}
                    </label>
                  ))}
                </div>
                <input type="text" placeholder="备注（可选）" value={venueForm.note} onChange={e => setVenueForm(f => ({ ...f, note: e.target.value }))} className="w-full bg-white border rounded-lg px-3 py-2 text-sm" />
                <button onClick={submitVenueRequest} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm">提交申请</button>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-700 mb-2">我的申请</h3>
              {venueRequests.length === 0 ? <p className="text-gray-400 text-sm">暂无</p> : (
                <ul className="space-y-1 text-sm">
                  {venueRequests.map(r => (
                    <li key={r.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span>{r.semester} · {r.blocks?.join(',') || '-'}</span>
                      <span className={`text-xs font-bold ${r.status === 'approved' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-600' : 'text-orange-600'}`}>{r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已拒绝'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">本学期排期</h3>
              {venueSchedules.length === 0 ? <p className="text-gray-400 text-sm">暂无排期</p> : (
                <ul className="space-y-1 text-sm">
                  {venueSchedules.map(s => (
                    <li key={s.id} className="p-2 bg-teal-50 rounded-lg border border-teal-100">{s.date} · {s.block} · {s.venueName}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 社团详情模态框 */}
      {selectedClubDetail && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-3xl font-black text-gray-800">{t('club.detail')}</h3>
              <p className="text-gray-400 text-sm mt-2"><TranslatableContent>{selectedClubDetail.name}</TranslatableContent></p>
              <p className="text-gray-600 text-sm mt-1">
                {selectedClubDetail.actualLeaderName ? (
                  <>{t('club.actualLeader')}：{selectedClubDetail.actualLeaderName} <span className="text-gray-400">（{t('club.proxyCreated')}：{selectedClubDetail.founderName || '—'}）</span></>
                ) : (
                  <>{t('club.creator')}：{selectedClubDetail.founderName || (isEn ? 'Unknown' : '未知')}{selectedClubDetail.founderEnglishName && ` / ${selectedClubDetail.founderEnglishName}`}</>
                )}
              </p>
            </div>
            
            <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {/* 社团分类与类型区块（可编辑） */}
              {canManageClub(selectedClubDetail) && (
                <div className="border-l-4 border-indigo-100 pl-4 py-2">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{t('club.categoryTypeIntro')}</label>
                    {!editingCategoryType && (
                      <button 
                        onClick={() => {
                          setEditingCategoryType(true);
                          setEditCategoryTypeForm({
                            category: selectedClubDetail.category || 'wednesday',
                            type: selectedClubDetail.type || 'activity',
                            blocks: selectedClubDetail.blocks || [],
                            intro: selectedClubDetail.intro || ''
                          });
                        }}
                        className="text-indigo-600 text-xs font-bold hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                    )}
                  </div>
                  {!editingCategoryType ? (
                    <div className="mt-2 space-y-2 text-sm">
                      {selectedClubDetail.intro && (
                        <p className="text-gray-700">
                          <span className="font-medium">{t('club.introLabel')}:</span>
                          <span className="whitespace-pre-wrap"><TranslatableContent>{selectedClubDetail.intro}</TranslatableContent></span>
                        </p>
                      )}
                      <p className="text-gray-700">
                        <span className="font-medium">{t('club.categoryLabel')}:</span>
                        {selectedClubDetail.category === 'daily' ? t('club.dailyClub') : 
                         selectedClubDetail.category === 'both' ? t('club.both') : t('club.wednesdayClub')}
                      </p>
                      {(selectedClubDetail.category === 'wednesday' || selectedClubDetail.category === 'both') && (
                        <>
                          <p className="text-gray-700">
                            <span className="font-medium">{t('club.typeLabel')}:</span>
                            {selectedClubDetail.type === 'academic' ? t('club.academic') : t('club.activityType')}
                          </p>
                          {selectedClubDetail.blocks && selectedClubDetail.blocks.length > 0 && (
                            <div className="text-gray-700">
                              <span className="font-medium">{t('club.blocksAndTime')}:</span>
                              <ul className="mt-1 space-y-0.5 text-sm">
                                {selectedClubDetail.blocks.map(b => (
                                  <li key={b} className="font-mono text-gray-800">
                                    {b.replace('block', 'Block')} 周三下午 {BLOCK_TIME_LABELS[b] || '—'}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">社团介绍</label>
                        <textarea
                          placeholder="一句话介绍社团..."
                          value={editCategoryTypeForm.intro}
                          onChange={e => setEditCategoryTypeForm({ ...editCategoryTypeForm, intro: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[72px] resize-y focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">社团分类</label>
                        <div className="flex flex-wrap gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="editCategory" checked={editCategoryTypeForm.category === 'daily'} onChange={() => setEditCategoryTypeForm({ ...editCategoryTypeForm, category: 'daily', type: 'activity', blocks: [] })} className="rounded-full border-gray-300" />
                            <span className="text-sm">日常</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="editCategory" checked={editCategoryTypeForm.category === 'wednesday'} onChange={() => setEditCategoryTypeForm({ ...editCategoryTypeForm, category: 'wednesday' })} className="rounded-full border-gray-300" />
                            <span className="text-sm">周三</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="editCategory" checked={editCategoryTypeForm.category === 'both'} onChange={() => setEditCategoryTypeForm({ ...editCategoryTypeForm, category: 'both' })} className="rounded-full border-gray-300" />
                            <span className="text-sm">周三+日常</span>
                          </label>
                        </div>
                      </div>
                      {(editCategoryTypeForm.category === 'wednesday' || editCategoryTypeForm.category === 'both') && (
                        <>
                          <div>
                            <label className="text-xs font-bold text-gray-600 mb-1 block">社团类型</label>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="editType" checked={editCategoryTypeForm.type === 'academic'} onChange={() => setEditCategoryTypeForm({ ...editCategoryTypeForm, type: 'academic' })} className="rounded-full border-gray-300" />
                                <span className="text-sm">学术</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="editType" checked={editCategoryTypeForm.type === 'activity'} onChange={() => setEditCategoryTypeForm({ ...editCategoryTypeForm, type: 'activity', blocks: editCategoryTypeForm.blocks.filter(b => b !== 'block1') })} className="rounded-full border-gray-300" />
                                <span className="text-sm">活动</span>
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-600 mb-1 block">活动板块（1～3个）</label>
                            <div className="flex flex-wrap gap-2">
                              {['block1', 'block2', 'block3', 'block4'].map(block => {
                                const disabled = editCategoryTypeForm.type === 'activity' && block === 'block1';
                                const checked = editCategoryTypeForm.blocks.includes(block);
                                const canAdd = checked || editCategoryTypeForm.blocks.length < 3;
                                return (
                                  <label key={block} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : canAdd ? 'cursor-pointer border-indigo-200 hover:bg-indigo-50 ' + (checked ? 'bg-indigo-100 text-indigo-700 border-indigo-400' : 'bg-gray-50 text-gray-600') : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'}`}>
                                    <input
                                      type="checkbox"
                                      disabled={disabled || !canAdd}
                                      checked={checked}
                                      onChange={() => {
                                        if (disabled) return;
                                        const next = checked ? editCategoryTypeForm.blocks.filter(b => b !== block) : [...editCategoryTypeForm.blocks, block].slice(-3);
                                        setEditCategoryTypeForm({ ...editCategoryTypeForm, blocks: next });
                                      }}
                                      className="rounded border-gray-300"
                                    />
                                    <span>{block === 'block1' ? 'Block1' : block.replace('block', 'Block')}</span>
                                    <span className="text-gray-500 font-mono">{(BLOCK_TIME_LABELS[block] || '').replace('-', '～')}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button onClick={handleUpdateCategoryType} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">保存</button>
                        <button onClick={() => setEditingCategoryType(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300">取消</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* 核心人员区块 */}
              <div className="border-l-4 border-amber-100 pl-4 py-2">
                <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{t('club.coreMembers')}</label>
                <div className="mt-2 space-y-1.5">
                  {(selectedClubDetail.coreMembers || []).length === 0 ? (
                    <p className="text-gray-500 text-sm">暂无</p>
                  ) : (
                    (selectedClubDetail.coreMembers || []).map((m) => (
                      <div key={m.userID} className="flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-700">
                          {m.name}
                          {m.englishName && ` / ${m.englishName}`}
                        </span>
                        {canManageClub(selectedClubDetail) && selectedClubDetail.founderID !== m.userID && (
                          <button type="button" onClick={() => removeCoreMember(m.userID)} className="text-red-500 text-xs font-bold hover:underline">移除</button>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {canManageClub(selectedClubDetail) && (
                  <div className="mt-3 pt-3 border-t border-amber-100">
                    <input
                      placeholder={t('club.searchCoreMember')}
                      value={coreMemberSearchQuery}
                      onChange={e => setCoreMemberSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchUsersForCore()}
                      className="w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm mb-2"
                    />
                    <button type="button" onClick={searchUsersForCore} disabled={coreMemberSearching} className="text-amber-600 text-xs font-bold hover:underline mr-2">
                      {coreMemberSearching ? '搜索中...' : '搜索'}
                    </button>
                    {coreMemberSearchResults.length > 0 && (
                      <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {coreMemberSearchResults
                          .filter(u => !(selectedClubDetail.coreMembers || []).some(m => m.userID === u.userID))
                          .slice(0, 10)
                          .map(u => (
                            <li key={u.userID} className="flex justify-between items-center text-sm py-1">
                              <span>{u.name}</span>
                              <button type="button" onClick={() => addCoreMember(u.userID)} className="text-amber-600 text-xs font-bold">添加</button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* 活动信息区块（活动内容、活动地点、活动时间、活动时长 - 创建者/管理员可编辑） */}
              <div className="border-l-4 border-blue-100 pl-4 py-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">活动信息</label>
                  {canManageClub(selectedClubDetail) && !editingInfo && (
                      <button
                        onClick={() => {
                          setEditingInfo(true);
                          setEditInfoForm({
                            content: selectedClubDetail.content || '',
                            location: selectedClubDetail.location || '',
                            time: selectedClubDetail.time || '',
                            duration: selectedClubDetail.duration || '',
                            capacity: selectedClubDetail.capacity != null ? String(selectedClubDetail.capacity) : '',
                            contact: selectedClubDetail.contact || '',
                            actualLeaderName: selectedClubDetail.actualLeaderName || ''
                          });
                        }}
                        className="text-blue-600 text-xs font-bold hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                    )}
                  </div>
                  {!editingInfo ? (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="text-gray-700">
                        <span className="font-medium">活动内容：</span>
                        <span className="whitespace-pre-wrap"><TranslatableContent>{selectedClubDetail.content || '（未填写）'}</TranslatableContent></span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">活动地点：</span>
                        <span><TranslatableContent>{selectedClubDetail.location || '（未填写）'}</TranslatableContent></span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">活动时间：</span>
                        <span><TranslatableContent>{selectedClubDetail.time || '（未填写）'}</TranslatableContent></span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">活动时长：</span>
                        <span><TranslatableContent>{selectedClubDetail.duration || '（未填写）'}</TranslatableContent></span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">人数上限：</span>
                        <span>{selectedClubDetail.capacity != null ? selectedClubDetail.capacity + ' 人' : '（不限制）'}</span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">联系方式：</span>
                        <span><TranslatableContent>{selectedClubDetail.contact || '（未填写）'}</TranslatableContent></span>
                      </p>
                      <p className="text-gray-700">
                        <span className="font-medium">{t('club.actualLeader')}：</span>
                        <span>{selectedClubDetail.actualLeaderName || '（未填写，创建者即负责人）'}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">活动内容</label>
                        <textarea
                          placeholder="如：制作香氛产品、创立香氛品牌"
                          value={editInfoForm.content}
                          onChange={e => setEditInfoForm({ ...editInfoForm, content: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[72px] resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">活动地点</label>
                        <input
                          type="text"
                          placeholder="如：待定"
                          value={editInfoForm.location}
                          onChange={e => setEditInfoForm({ ...editInfoForm, location: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">活动时间</label>
                        <input
                          type="text"
                          placeholder="如：周五中午"
                          value={editInfoForm.time}
                          onChange={e => setEditInfoForm({ ...editInfoForm, time: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">活动时长</label>
                        <input
                          type="text"
                          placeholder="如：50分钟"
                          value={editInfoForm.duration}
                          onChange={e => setEditInfoForm({ ...editInfoForm, duration: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">人数上限（留空表示不限制）</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="如：30"
                          value={editInfoForm.capacity}
                          onChange={e => setEditInfoForm({ ...editInfoForm, capacity: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">联系方式</label>
                        <input
                          type="text"
                          placeholder="如：微信号、手机号等，便于线下联系"
                          value={editInfoForm.contact}
                          onChange={e => setEditInfoForm({ ...editInfoForm, contact: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">实际负责人（代老师创建时填写，留空表示创建者即负责人）</label>
                        <input
                          type="text"
                          placeholder="如：张老师"
                          value={editInfoForm.actualLeaderName}
                          onChange={e => setEditInfoForm({ ...editInfoForm, actualLeaderName: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={handleUpdateInfo} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">保存</button>
                        <button onClick={() => setEditingInfo(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300">取消</button>
                      </div>
                    </div>
                  )}
                </div>

              {Object.entries(selectedClubDetail).map(([key, value]) => {
                if (['id', 'founderID', 'status', 'memberCount', 'createdAt', 'updatedAt', 'coreMembers', 'coreMemberIDs'].includes(key)) return null;
                
                const labels = {
                  name: '社团名称', intro: '社团介绍', content: '活动内容', location: '活动地点',
                  time: '活动时间', duration: '活动时长', weeks: '持续周数', capacity: '人数限制',
                  file: '附件', type: '社团类型', blocks: '活动板块', category: '社团分类'
                };
                
                // 跳过 category、type、blocks、intro（已在顶部编辑区域显示）、content/location/time/duration/capacity/contact（已在活动信息区块显示）
                if (['category', 'type', 'blocks', 'intro', 'content', 'location', 'time', 'duration', 'capacity', 'contact'].includes(key)) return null;

                if (key === 'type') {
                  return (
                    <div key={key} className="border-l-4 border-blue-100 pl-4 py-1">
                      <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{labels[key]}</label>
                      <p className="text-gray-700 mt-1.5 font-medium">{value === 'academic' ? '学术社团' : value === 'activity' ? '活动社团' : value || '（未填写）'}</p>
                    </div>
                  );
                }
                if (key === 'blocks' && Array.isArray(value) && value.length > 0) {
                  return (
                    <div key={key} className="border-l-4 border-blue-100 pl-4 py-1">
                      <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{labels[key]}</label>
                      <p className="text-gray-700 mt-1.5 font-medium">{value.map(b => b.replace('block', 'Block')).join('、')}</p>
                    </div>
                  );
                }
                if (key === 'blocks') return null;

                if (key === 'file' && value) {
                  return (
                    <div key={key} className="border-l-4 border-blue-100 pl-4 py-1">
                      <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{labels[key]}</label>
                      <div className="mt-1.5">
                        <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${value}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black hover:bg-blue-100 transition-all">
                          查看附件
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={key} className="border-l-4 border-blue-100 pl-4 py-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{labels[key] || key}</label>
                    <p className="text-gray-700 mt-1.5 leading-relaxed font-medium whitespace-pre-wrap">{value || '（未填写）'}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-8 bg-gray-50 flex justify-between items-center flex-wrap gap-2">
              <div className="flex gap-2 flex-wrap">
                {/* 报名按钮 - 从社团报名页打开详情时显示 */}
                {view === 'registration' && (() => {
                  const isWednesday = selectedClubDetail.category === 'wednesday' || selectedClubDetail.category === 'both';
                  const usedBlocks = new Set();
                  myWednesdayClubs.forEach(m => { const c = m.Club || m.clubID; (c?.blocks || []).forEach(b => usedBlocks.add(b)); });
                  const alreadyIn = myWednesdayClubs.some(m => (m.Club || m.clubID)?.id === selectedClubDetail.id);
                  const blocks = selectedClubDetail.blocks || [];
                  const noOverlap = !blocks.some(b => usedBlocks.has(b));
                  const canAdd = usedBlocks.size + blocks.length <= 4;
                  const canJoin = isWednesday ? !alreadyIn && noOverlap && canAdd : true;
                  const full = selectedClubDetail.capacity && selectedClubDetail.memberCount >= selectedClubDetail.capacity;
                  const disabled = !canJoin || full;
                  return (
                    <button
                      onClick={() => { if (!disabled) handleRegister(selectedClubDetail.id); }}
                      disabled={disabled}
                      className={`px-6 py-3 rounded-2xl font-black transition-all ${
                        disabled ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {full ? t('common.full') : !canJoin ? t('club.alreadyOrConflict') : t('club.join')}
                    </button>
                  );
                })()}
                {/* 更换为此社团 - 从社团轮换页打开详情时显示 */}
                {view === 'rotation' && !myWednesdayClubs.some(m => (m.Club || m.clubID)?.id === selectedClubDetail.id) && (selectedClubDetail.category === 'wednesday' || selectedClubDetail.category === 'both') && (() => {
                  const quotaUsed = rotationQuota != null && rotationQuota.used >= rotationQuota.limit;
                  return (
                    <button
                      onClick={() => {
                        if (quotaUsed) return;
                        if (myWednesdayClubs.length === 1) {
                          handleRotate(selectedClubDetail.id, (myWednesdayClubs[0].Club || myWednesdayClubs[0].clubID)?.id);
                          setSelectedClubDetail(null);
                        } else {
                          setRotateTargetClubId(selectedClubDetail.id);
                          setSelectedClubDetail(null);
                        }
                      }}
                      disabled={quotaUsed}
                      className={`px-6 py-3 rounded-2xl font-black transition-all ${
                        quotaUsed ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {quotaUsed ? t('club.quotaExhausted') : t('club.replaceWith')}
                    </button>
                  );
                })()}
                {/* 参与人员按钮 - 仅创建者和管理员可见 */}
                {canManageClub(selectedClubDetail) && (
                  <button 
                    onClick={() => {
                      setSelectedClubDetail(null);
                      fetchMembers(selectedClubDetail.id);
                    }}
                    className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 transition-all"
                  >
                    {t('club.participants')}
                  </button>
                )}
                {/* 点名记录 - 核心人员/创建者/管理员 */}
                {canManageClub(selectedClubDetail) && (
                  <button 
                    onClick={() => {
                      setAttendanceClub(selectedClubDetail);
                      setSelectedClubDetail(null);
                      setView('attendance');
                      fetchAttendanceSessions(selectedClubDetail.id);
                    }}
                    className="px-6 py-3 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all"
                  >
                    {t('club.rollCall')}
                  </button>
                )}
                {/* 场地申请与排期 - 创建者/管理员 */}
                {canManageClub(selectedClubDetail) && (
                  <button 
                    onClick={() => {
                      setVenueClub(selectedClubDetail);
                      setSelectedClubDetail(null);
                      setView('venue');
                      fetchVenueRequests(selectedClubDetail.id);
                      fetchVenueSchedules(selectedClubDetail.id);
                    }}
                    className="px-6 py-3 bg-teal-600 text-white rounded-2xl font-black hover:bg-teal-700 transition-all"
                  >
                    {t('club.venue')}
                  </button>
                )}
                {/* 下载Excel按钮 - 仅创建者和管理员可见 */}
                {canManageClub(selectedClubDetail) && (
                  <button 
                    onClick={async () => {
                      try {
                        await downloadExport(`/api/clubs/${selectedClubDetail.id}/export?userID=${user.userID}`, `${selectedClubDetail.name || 'club'}_members.xlsx`);
                      } catch (e) { alert(e.message || '导出失败'); }
                    }}
                    className="px-6 py-3 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 transition-all"
                  >
                    {t('club.downloadExcel')}
                  </button>
                )}
                {/* 解散社团按钮 - 仅创建者可见（super_admin 也只能解散自己创建的） */}
                {selectedClubDetail.founderID === user.userID && (
                  <button 
                    onClick={async () => {
                      if (!window.confirm('确定要解散此社团吗？所有成员将回到自由人身份。')) return;
                      try {
                        await api.delete(`/clubs/${selectedClubDetail.id}?userID=${user.userID}`);
                        alert('社团已解散');
                        setSelectedClubDetail(null);
                        fetchMyClub();
                        fetchClubs();
                      } catch (err) {
                        alert(err.response?.data?.error || '解散失败');
                      }
                    }}
                    className="px-6 py-3 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all"
                  >
                    {t('club.dissolve')}
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedClubDetail(null)} className="px-8 py-3 bg-gray-800 text-white rounded-2xl font-black hover:bg-black transition-all">{t('club.closeDetail')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 成员列表视图 */}
      {view === 'members' && members && (() => {
        const membersClub = (managedClubs || []).find(c => c.id === membersClubId) || (myWednesdayClubs || []).find(m => m.Club?.id === membersClubId)?.Club || (myDailyClubs || []).find(m => m.Club?.id === membersClubId)?.Club || (clubs || []).find(c => c.id === membersClubId) || (selectedClubDetail?.id === membersClubId ? selectedClubDetail : null);
        return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-800">{t('club.participants')} - {members.clubName}</h2>
            <button 
              onClick={() => setView('menu')} 
              className="text-gray-500 underline text-sm font-bold hover:text-blue-600"
            >
              {t('common.back')}
            </button>
          </div>
          
          {members.members.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic">
              <p>{t('club.noMembers')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">序号</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">姓名</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">班级</th>
                    {canManageClub(membersClub) && (
                      <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {members.members.map((m) => (
                    <tr key={m.userID} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{m.index}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {m.name}
                        {m.englishName && ` / ${m.englishName}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.class}</td>
                      {canManageClub(membersClub) && (
                        <td className="px-4 py-3 text-right">
                          {m.userID !== members.founderID && (
                            <button
                              onClick={() => handleKickMember(m.userID)}
                              className="text-red-600 text-xs font-bold hover:underline"
                            >
                              踢出
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="text-sm text-gray-500 text-center mt-4">
            共 {members.members.length} 位成员
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default ClubMatters;




