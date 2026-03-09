import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

function AuditStatus({ user, onAnnouncementsChange }) {
  const { t, isEn } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null); // 控制弹窗显示
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [venueRequestsAll, setVenueRequestsAll] = useState([]);
  const [venueSchedulesAll, setVenueSchedulesAll] = useState([]);
  const [venueScheduleForm, setVenueScheduleForm] = useState({ clubID: '', semester: '', date: '', block: '', venueName: '' });
  const [clubsForVenue, setClubsForVenue] = useState([]);
  const [venueClubSearchQuery, setVenueClubSearchQuery] = useState('');
  const [venueClubSearchFocused, setVenueClubSearchFocused] = useState(false);
  const [idRecoveryRequests, setIdRecoveryRequests] = useState([]);
  const [pinRecoveryRequests, setPinRecoveryRequests] = useState([]);
  const [usersClubSelections, setUsersClubSelections] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [showClubSelections, setShowClubSelections] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementsFetching, setAnnouncementsFetching] = useState(false);

  const fetchAnnouncements = async () => {
    setAnnouncementsFetching(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data || []);
    } catch (e) { setAnnouncements([]); }
    finally { setAnnouncementsFetching(false); }
  };

  useEffect(() => {
    fetchAuditStatus();
  }, []);

  useEffect(() => {
    if (user.role === 'admin' || user.role === 'super_admin') {
      fetchAnnouncements();
    }
  }, [user?.role]);

  useEffect(() => {
    if (data && (user.role === 'admin' || user.role === 'super_admin')) {
      api.get(`/clubs/venue-requests/all?userID=${user.userID}`).then(r => setVenueRequestsAll(r.data || [])).catch(() => setVenueRequestsAll([]));
      api.get('/clubs/venue-schedule').then(r => setVenueSchedulesAll(r.data || [])).catch(() => setVenueSchedulesAll([]));
      api.get('/clubs/approved').then(r => setClubsForVenue(r.data || [])).catch(() => setClubsForVenue([]));
      api.get(`/admin/id-recovery?operatorID=${user.userID}`).then(r => setIdRecoveryRequests(r.data || [])).catch(() => setIdRecoveryRequests([]));
      api.get(`/admin/pin-recovery?operatorID=${user.userID}`).then(r => setPinRecoveryRequests(r.data || [])).catch(() => setPinRecoveryRequests([]));
    }
  }, [data, user?.userID, user?.role]);

  // 添加键盘快捷键：按R键刷新
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          fetchAuditStatus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const fetchAuditStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/audit/status/${user.userID}?operatorID=${encodeURIComponent(user.userID)}`);
      setData(res.data);
      setError(null);
    } catch (e) {
      console.error("获取审核状态失败", e);
      const errorMessage = e.response?.data?.error || e.message || '网络连接失败，请检查网络后重试';
      setError(errorMessage);
      setData(null); // 确保data为null，显示错误界面
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (type, id, status) => {
    try {
      await api.post('/audit/approve', { type, id, status, operatorID: user.userID });
      await fetchAuditStatus(); // 等待刷新完成
      setSelectedDetail(null); // 审核后关闭弹窗
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message || '操作失败，请稍后重试';
      alert(errorMsg);
    }
  };

  const handleApproveAll = async (type) => {
    const list = type === 'clubJoin' ? data.myClubJoinApprovals : data.myActivityRegApprovals;
    const ids = (list || []).map(x => x.id).filter(Boolean);
    if (ids.length === 0) {
      alert(t('audit.noApplications'));
      return;
    }
    const confirmMsg = type === 'clubJoin'
      ? (t('audit.approveAllConfirm') || '确定一键通过全部 {n} 条申请？人数已满的社团将自动拒绝。').replace('{n}', ids.length)
      : '确定一键通过全部 ' + ids.length + ' 条申请？';
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await api.post('/audit/approve-batch', { type, ids, status: 'approved', operatorID: user.userID });
      await fetchAuditStatus();
      setSelectedDetail(null);
      const approved = res.data?.count ?? 0;
      const rejectedFull = res.data?.rejectedFull ?? 0;
      const msg = rejectedFull > 0
        ? `已通过 ${approved} 条，因人数已满自动拒绝 ${rejectedFull} 条`
        : `已通过 ${approved} 条申请`;
      alert(msg);
    } catch (e) {
      const errorMsg = e.response?.data?.error || e.message || '操作失败，请稍后重试';
      alert(errorMsg);
    }
  };

  const handleSearchUser = async () => {
    if (!searchQuery || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/admin/users/search?query=${encodeURIComponent(searchQuery.trim())}&operatorID=${encodeURIComponent(user.userID)}`);
      setSearchResults(res.data || []);
    } catch (e) {
      console.error("搜索用户失败:", e);
      const errorMsg = e.response?.data?.error || e.message || '搜索失败，请稍后重试';
      alert(errorMsg);
      setSearchResults([]);
    }
  };

  const handleSetRole = async (targetUserID, role) => {
    try {
      await api.post('/admin/set-role', { targetUserID, role, operatorID: user.userID });
      alert('权限设置成功');
      handleSearchUser();
    } catch (err) {
      alert(err.response?.data?.error || '设置失败');
    }
  };

  const handleDeleteUser = async (targetUserID, targetName) => {
    if (!window.confirm(`确定删除用户「${targetName}」的账户？此操作不可恢复。`)) return;
    try {
      await api.delete(`/admin/users/${targetUserID}?operatorID=${encodeURIComponent(user.userID)}`);
      alert('账户已删除');
      handleSearchUser();
    } catch (err) {
      alert(err.response?.data?.error || '删除失败');
    }
  };

  const handleResetPin = async (targetUserID, targetName) => {
    if (!window.confirm(`确定清除「${targetName}」的 PIN？清除后该用户可凭姓名+班级+ID 登录。`)) return;
    try {
      await api.post('/admin/reset-pin', { targetUserID, operatorID: user.userID });
      alert('已清除 PIN');
      handleSearchUser();
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleVenueRequestStatus = async (rid, status) => {
    try {
      await api.put(`/clubs/venue-requests/${rid}`, { userID: user.userID, status });
      const res = await api.get(`/clubs/venue-requests/all?userID=${user.userID}`);
      setVenueRequestsAll(res.data || []);
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const fetchUsersClubSelections = async () => {
    try {
      const res = await api.get(`/admin/users-club-selections?operatorID=${encodeURIComponent(user.userID)}`);
      setUsersClubSelections(res.data || []);
      setShowClubSelections(true);
    } catch (e) {
      alert(e.response?.data?.error || '加载失败');
    }
  };

  const fetchAllUsersList = async () => {
    try {
      const res = await api.get(`/admin/users/list?operatorID=${encodeURIComponent(user.userID)}`);
      setAllUsersList(res.data || []);
      setShowAllUsers(true);
    } catch (e) {
      alert(e.response?.data?.error || '加载失败');
    }
  };

  const handleAddVenueSchedule = async (e) => {
    e.preventDefault();
    if (!venueScheduleForm.clubID || !venueScheduleForm.semester || !venueScheduleForm.date || !venueScheduleForm.block || !venueScheduleForm.venueName.trim()) {
      alert('请填写完整');
      return;
    }
    try {
      await api.post('/clubs/venue-schedule', { ...venueScheduleForm, userID: user.userID });
      setVenueScheduleForm({ clubID: '', semester: '', date: '', block: '', venueName: '' });
      setVenueClubSearchQuery('');
      const res = await api.get('/clubs/venue-schedule');
      setVenueSchedulesAll(res.data || []);
    } catch (err) {
      alert(err.response?.data?.error || '添加失败');
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="p-10 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 italic">{t('audit.loadingServer')}</p>
        <p className="text-xs text-gray-400 mt-2">{t('audit.checkNetwork')}</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="p-10 text-center">
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 max-w-md mx-auto">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-red-600 mb-2">{t('audit.loadFailed')}</h3>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button 
            onClick={fetchAuditStatus}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            {t('audit.retry')}
          </button>
        </div>
      </div>
    );
  }

  // 数据为空（不应该发生，但作为安全措施）
  if (!data) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-500 italic mb-4">{t('audit.noData')}</p>
        <button 
          onClick={fetchAuditStatus}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black hover:bg-blue-700 transition-all"
        >
          {t('audit.refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* 管理员管理面板 */}
      {(user.role === 'admin' || user.role === 'super_admin') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-red-50">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <h2 className="text-xl font-black text-red-600 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
              {t('audit.adminConsole')}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const base = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                  window.open(`${base}/api/admin/clubs/export-all?operatorID=${encodeURIComponent(user.userID)}&category=wednesday`, '_blank', 'noopener');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {isEn ? 'Export Wed. clubs' : '一键导出周三社团人员'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const base = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                  window.open(`${base}/api/admin/clubs/export-all?operatorID=${encodeURIComponent(user.userID)}&category=daily`, '_blank', 'noopener');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {isEn ? 'Export daily clubs' : '一键导出日常社团人员'}
              </button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* 社团审核列表 */}
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">{t('audit.pendingClubs')}</h3>
              <div className="space-y-3">
                {data.clubCreations.length === 0 && <p className="text-gray-300 text-sm py-4">{t('audit.noApplications')}</p>}
                {data.clubCreations.map(c => (
                  <div key={c.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center hover:bg-red-50/50 transition-colors border border-gray-100">
                    <button 
                      onClick={() => setSelectedDetail({ ...c, type: 'club' })}
                      className="text-left group"
                    >
                      <p className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{t('audit.clickToReview')}</p>
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove('club', c.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.approve')}</button>
                      <button onClick={() => handleApprove('club', c.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.reject')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 活动审核列表 */}
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">{t('audit.pendingActivities')}</h3>
              <div className="space-y-3">
                {data.activityCreations.length === 0 && <p className="text-gray-300 text-sm py-4">{t('audit.noApplications')}</p>}
                {data.activityCreations.map(a => (
                  <div key={a.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center hover:bg-red-50/50 transition-colors border border-gray-100">
                    <button 
                      onClick={() => setSelectedDetail({ ...a, type: 'activity' })}
                      className="text-left group"
                    >
                      <p className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{a.name}</p>
                      <p className="text-[10px] text-gray-400">{t('audit.clickToReview')}</p>
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove('activity', a.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.approve')}</button>
                      <button onClick={() => handleApprove('activity', a.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.reject')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 管理员：公告管理 */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3">{isEn ? 'Announcements' : '公告管理'}</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder={isEn ? 'Title' : '标题'}
                  value={announcementForm.title}
                  onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <textarea
                    placeholder={isEn ? 'Content' : '内容'}
                    value={announcementForm.content}
                    onChange={e => setAnnouncementForm(f => ({ ...f, content: e.target.value }))}
                    rows={2}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none"
                  />
                  <button
                    disabled={announcementLoading}
                    onClick={async () => {
                      if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
                        alert(isEn ? 'Please fill title and content' : '请填写标题和内容');
                        return;
                      }
                      setAnnouncementLoading(true);
                      try {
                        await api.post('/announcements', { operatorID: user.userID, title: announcementForm.title.trim(), content: announcementForm.content.trim() });
                        setAnnouncementForm({ title: '', content: '' });
                        await fetchAnnouncements();
                        onAnnouncementsChange?.();
                        alert(isEn ? 'Published' : '已发布');
                      } catch (e) {
                        alert(e.response?.data?.error || (isEn ? 'Failed' : '发布失败'));
                      } finally {
                        setAnnouncementLoading(false);
                      }
                    }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 self-start disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {announcementLoading ? (isEn ? 'Publishing...' : '发布中...') : (isEn ? 'Publish' : '发布')}
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {announcementsFetching ? (
                  <p className="text-gray-400 text-sm py-4">{isEn ? 'Loading...' : '加载中...'}</p>
                ) : announcements.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-xl border border-amber-100 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-amber-800 truncate">{a.title}</p>
                      <p className="text-xs text-amber-600 truncate mt-0.5">{a.content}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <button onClick={() => setEditingAnnouncement(a)} className="text-xs px-3 py-1.5 bg-white border border-amber-200 text-amber-600 rounded-lg font-bold hover:bg-amber-50">
                        {isEn ? 'Edit' : '编辑'}
                      </button>
                      <button
                        disabled={announcementLoading}
                        onClick={async () => {
                          if (!window.confirm(isEn ? 'Delete this announcement?' : '确定删除该公告？')) return;
                          setAnnouncementLoading(true);
                          try {
                            await api.delete(`/announcements/${a.id}?operatorID=${user.userID}`);
                            await fetchAnnouncements();
                            onAnnouncementsChange?.();
                            alert(isEn ? 'Deleted' : '已删除');
                          } catch (e) {
                            alert(e.response?.data?.error || (isEn ? 'Failed' : '删除失败'));
                          } finally {
                            setAnnouncementLoading(false);
                          }
                        }}
                        className="text-xs px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isEn ? 'Delete' : '删除'}
                      </button>
                    </div>
                  </div>
                ))}
                {!announcementsFetching && announcements.length === 0 && <p className="text-gray-400 text-sm py-2">{isEn ? 'No announcements yet' : '暂无公告'}</p>}
              </div>
            </div>
          </div>

          {/* 管理员：查看所有用户社团选择 */}
          {(user.role === 'admin' || user.role === 'super_admin') && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-3">用户社团选择</h3>
              {!showClubSelections ? (
                <button onClick={fetchUsersClubSelections} className="px-4 py-2 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700">加载全部用户社团选择</button>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {usersClubSelections.map(u => (
                    <div key={u.userID} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                      <div className="font-bold text-gray-800">{u.name} <span className="text-gray-500 font-normal">· {u.class}</span></div>
                      <div className="mt-1 text-xs text-gray-600">
                        {u.wednesdayClubs?.length > 0 && <span>周三：{u.wednesdayClubs.map(c => c.name).join('、')}</span>}
                        {u.wednesdayClubs?.length > 0 && u.dailyClubs?.length > 0 && ' · '}
                        {u.dailyClubs?.length > 0 && <span>日常：{u.dailyClubs.map(c => c.name).join('、')}</span>}
                        {(!u.wednesdayClubs?.length && !u.dailyClubs?.length) && <span className="text-gray-400">暂无社团</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 超级管理员特有的用户管理 */}
          {user.role === 'super_admin' && (
            <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                {t('audit.adminRoleAssign')}
              </h3>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder={t('audit.searchUserPlaceholder')} 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button onClick={handleSearchUser} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">{t('app.search.button')}</button>
              </div>
              
              <div className="grid gap-2">
                {searchResults.length === 0 && searchQuery && (
                  <p className="text-center py-4 text-gray-400 italic">{t('audit.noUserFound')}</p>
                )}
                {searchResults.length === 0 && !searchQuery && (
                  <p className="text-center py-4 text-gray-400 italic">{t('audit.searchUserHint')}</p>
                )}
                {searchResults.map(u => (
                  <div key={u.userID} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <span className="font-bold text-gray-800">
                        {u.name}
                        {u.englishName && ` / ${u.englishName}`}
                      </span>
                      <span className="text-gray-400 text-xs ml-2">({u.class} · ID: {u.userID})</span>
                      <span className={`ml-3 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        u.role === 'super_admin' ? 'bg-purple-100 text-purple-600' : 
                        u.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.userID !== user.userID && (
                        <button onClick={() => handleResetPin(u.userID, u.name)} className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-4 py-2 rounded-lg font-bold hover:bg-amber-100 transition-all">清除PIN</button>
                      )}
                      {u.role === 'user' && (
                        <>
                          <button onClick={() => handleSetRole(u.userID, 'admin')} className="text-xs bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all">{t('app.setAdmin')}</button>
                          <button onClick={() => handleDeleteUser(u.userID, u.name)} className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 transition-all">删除账户</button>
                        </>
                      )}
                      {u.role === 'admin' && (
                        <button onClick={() => handleSetRole(u.userID, 'user')} className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-600 hover:text-white transition-all">{t('app.cancelRole')}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* super_admin：全部用户列表（姓名、班级、ID） */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 mb-3">全部用户列表</h4>
                {!showAllUsers ? (
                  <button onClick={fetchAllUsersList} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700">加载全部用户</button>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-4 gap-2 text-xs font-bold text-gray-500 pb-2 border-b">
                      <span>姓名</span>
                      <span>班级</span>
                      <span>用户ID</span>
                      <span>角色</span>
                    </div>
                    {allUsersList.map(u => (
                      <div key={u.userID} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-gray-50 items-center">
                        <span className="font-medium">{u.name}</span>
                        <span className="text-gray-600">{u.class}</span>
                        <span className="font-mono text-blue-600">{u.userID}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          u.role === 'super_admin' ? 'bg-purple-100 text-purple-600' :
                          u.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                        }`}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 场地管理：申请审核 + 排期（管理员） */}
          <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">{t('audit.venueManage')}</h3>
            <section className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.venueRequestReview')}</h4>
              {venueRequestsAll.length === 0 ? <p className="text-gray-400 text-sm">{t('audit.noApplications')}</p> : (
                <div className="space-y-2">
                  {venueRequestsAll.map(r => (
                    <div key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border">
                      <span className="font-medium">{r.clubName || r.clubID?.name} · {r.semester} · {r.blocks?.join(',') || '-'}</span>
                      <div className="flex gap-2">
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => handleVenueRequestStatus(r.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.approve')}</button>
                            <button onClick={() => handleVenueRequestStatus(r.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.reject')}</button>
                          </>
                        )}
                        <span className={`text-xs font-bold ${r.status === 'approved' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-600' : 'text-orange-600'}`}>
                          {r.status === 'pending' ? t('audit.statusPending') : r.status === 'approved' ? t('audit.statusApproved') : t('audit.statusRejected')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.addSchedule')}</h4>
              <form onSubmit={handleAddVenueSchedule} className="flex flex-wrap gap-2 items-end">
                <div className="relative min-w-[180px]">
                  <input
                    type="text"
                    placeholder={t('audit.selectClub')}
                    value={venueScheduleForm.clubID ? (clubsForVenue.find(c => c.id === venueScheduleForm.clubID)?.name ?? '') : venueClubSearchQuery}
                    onChange={e => {
                      setVenueClubSearchQuery(e.target.value);
                      if (venueScheduleForm.clubID) setVenueScheduleForm(f => ({ ...f, clubID: '' }));
                    }}
                    onFocus={() => setVenueClubSearchFocused(true)}
                    onBlur={() => setTimeout(() => setVenueClubSearchFocused(false), 200)}
                    className="bg-gray-50 border rounded-lg px-3 py-2 text-sm w-full"
                  />
                  {venueScheduleForm.clubID && (
                    <button type="button" onClick={() => { setVenueScheduleForm(f => ({ ...f, clubID: '' })); setVenueClubSearchQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs">{t('audit.clear')}</button>
                  )}
                  {venueClubSearchFocused && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                      {(venueClubSearchQuery.trim() ? clubsForVenue.filter(c => c.name && c.name.toLowerCase().includes(venueClubSearchQuery.trim().toLowerCase())) : clubsForVenue).slice(0, 20).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setVenueScheduleForm(f => ({ ...f, clubID: c.id })); setVenueClubSearchQuery(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm border-b border-gray-50 last:border-0"
                        >
                          {c.name}
                        </button>
                      ))}
                      {venueClubSearchQuery.trim() && clubsForVenue.filter(c => c.name && c.name.toLowerCase().includes(venueClubSearchQuery.trim().toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">{t('audit.noMatchClub')}</div>
                      )}
                    </div>
                  )}
                </div>
                <select value={venueScheduleForm.semester} onChange={e => setVenueScheduleForm(f => ({ ...f, semester: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm" required>
                  <option value="">{t('audit.semester')}</option>
                  <option value="2026-spring">2026春</option>
                  <option value="2026-fall">2026秋</option>
                  <option value="2025-fall">2025秋</option>
                </select>
                <input type="date" value={venueScheduleForm.date} onChange={e => setVenueScheduleForm(f => ({ ...f, date: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm" required />
                <select value={venueScheduleForm.block} onChange={e => setVenueScheduleForm(f => ({ ...f, block: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm" required>
                  <option value="">{t('audit.block')}</option>
                  <option value="block1">Block1</option>
                  <option value="block2">Block2</option>
                  <option value="block3">Block3</option>
                  <option value="block4">Block4</option>
                </select>
                <input type="text" placeholder={t('audit.venueName')} value={venueScheduleForm.venueName} onChange={e => setVenueScheduleForm(f => ({ ...f, venueName: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm min-w-[100px]" required />
                <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm">{t('audit.add')}</button>
              </form>
            </section>
            <section className="mt-4">
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.allSchedule')}</h4>
              {venueSchedulesAll.length === 0 ? <p className="text-gray-400 text-sm">{t('audit.noSchedule')}</p> : (
                <ul className="space-y-1 text-sm">
                  {venueSchedulesAll.map(s => (
                    <li key={s.id} className="p-2 bg-teal-50 rounded-lg border border-teal-100">{s.clubName} · {s.date} · {s.block} · {s.venueName}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {/* 管理员：处理找回ID请求 */}
      {(user.role === 'admin' || user.role === 'super_admin') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
            {t('audit.idRecoveryTitle')}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.idRecoveryPending')}</h3>
              {idRecoveryRequests.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-gray-300 text-sm">{t('audit.idRecoveryNoPending')}</p>
              ) : (
                <div className="space-y-2">
                  {idRecoveryRequests.filter(r => r.status === 'pending').map(r => (
                    <div key={r.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-gray-800">{r.name} <span className="text-gray-400">· {r.class}</span></p>
                        <p className="text-gray-600">{t('audit.idRecoveryEmail')}: {r.email}</p>
                        {r.userIDFound && (
                          <p className="text-gray-600">
                            {t('audit.idRecoveryUserID')}: <span className="font-mono text-blue-600">{r.userIDFound}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {r.userIDFound && (
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(r.userIDFound); alert(t('audit.idRecoveryCopied')); }}
                            className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-600 hover:text-white"
                          >
                            {t('audit.idRecoveryCopy')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.post(`/admin/id-recovery/${r.id}/resolve`, { operatorID: user.userID, note: '' });
                              const res = await api.get(`/admin/id-recovery?operatorID=${user.userID}`);
                              setIdRecoveryRequests(res.data || []);
                            } catch (e) {
                              alert(e.response?.data?.error || '操作失败');
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-gray-900 text-white font-bold hover:bg-black"
                        >
                          {t('audit.idRecoveryMarkDone')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.idRecoveryResolved')}</h3>
              {idRecoveryRequests.filter(r => r.status === 'resolved').length === 0 ? (
                <p className="text-gray-300 text-sm">{t('audit.idRecoveryNoResolved')}</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {idRecoveryRequests.filter(r => r.status === 'resolved').map(r => (
                    <div key={r.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-[11px]">
                      <p className="font-bold text-gray-800">{r.name} <span className="text-gray-400">· {r.class}</span></p>
                      <p className="text-gray-500">{t('audit.idRecoveryEmail')}: {r.email}</p>
                      {r.userIDFound && (
                        <p className="text-gray-500">
                          {t('audit.idRecoveryUserID')}: <span className="font-mono text-blue-600">{r.userIDFound}</span>
                        </p>
                      )}
                      {r.operatorID && (
                        <p className="text-gray-400 mt-1">
                          {t('audit.idRecoveryHandledBy')}: {r.operatorID}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* 管理员：处理找回PIN请求 */}
      {(user.role === 'admin' || user.role === 'super_admin') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-amber-600 rounded-full"></span>
            {t('audit.pinRecoveryTitle')}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.pinRecoveryPending')}</h3>
              {pinRecoveryRequests.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-gray-300 text-sm">{t('audit.pinRecoveryNoPending')}</p>
              ) : (
                <div className="space-y-2">
                  {pinRecoveryRequests.filter(r => r.status === 'pending').map(r => (
                    <div key={r.id} className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-gray-800">{r.name} <span className="text-gray-400">· {r.class}</span></p>
                        <p className="text-gray-600">{t('audit.idRecoveryEmail')}: {r.email}</p>
                        {r.userIDFound && (
                          <p className="text-gray-600">
                            {t('audit.idRecoveryUserID')}: <span className="font-mono text-blue-600">{r.userIDFound}</span>
                          </p>
                        )}
                        {r.hasPin && <p className="text-amber-600 font-medium">{t('audit.pinRecoveryHasPin')}</p>}
                      </div>
                      <div className="flex flex-col gap-1">
                        {r.userIDFound && (
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(r.userIDFound); alert(t('audit.idRecoveryCopied')); }}
                            className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-600 hover:text-white"
                          >
                            {t('audit.idRecoveryCopy')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.post(`/admin/pin-recovery/${r.id}/resolve`, { operatorID: user.userID, note: '', clearPin: true });
                              const res = await api.get(`/admin/pin-recovery?operatorID=${user.userID}`);
                              setPinRecoveryRequests(res.data || []);
                              alert(isEn ? 'PIN cleared. User can login with ID and set new PIN.' : '已清除 PIN，用户可用 ID 登录后重新设置');
                            } catch (e) {
                              alert(e.response?.data?.error || '操作失败');
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700"
                        >
                          {t('audit.pinRecoveryClearPin')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">{t('audit.pinRecoveryResolved')}</h3>
              {pinRecoveryRequests.filter(r => r.status === 'resolved').length === 0 ? (
                <p className="text-gray-300 text-sm">{t('audit.pinRecoveryNoResolved')}</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto pr-1">
                  {pinRecoveryRequests.filter(r => r.status === 'resolved').map(r => (
                    <div key={r.id} className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-[11px] flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-gray-800">{r.name} <span className="text-gray-400">· {r.class}</span></p>
                        <p className="text-gray-500">{t('audit.idRecoveryEmail')}: {r.email}</p>
                        {r.userIDFound && (
                          <p className="text-gray-500">
                            {t('audit.idRecoveryUserID')}: <span className="font-mono text-blue-600">{r.userIDFound}</span>
                          </p>
                        )}
                        {r.operatorID && (
                          <p className="text-gray-400 mt-1">
                            {t('audit.idRecoveryHandledBy')}: {r.operatorID}
                          </p>
                        )}
                      </div>
                      {r.userIDFound && (
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(r.userIDFound); alert(t('audit.idRecoveryCopied')); }}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 font-bold hover:bg-blue-600 hover:text-white text-[10px] flex-shrink-0"
                        >
                          {t('audit.idRecoveryCopy')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* 用户自己的申请进度 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          {t('audit.myApplicationFeedback')}
        </h2>
        
        <div className="grid md:grid-cols-2 gap-10">
          {/* 我收到的报名申请 (作为活动组织者) */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('audit.receivedActivityReg')}</h3>
              {data.myActivityRegApprovals.length > 0 && (
                <button onClick={() => handleApproveAll('activityReg')} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-green-700">{t('audit.approveAll')}</button>
              )}
            </div>
            <div className="space-y-3">
              {data.myActivityRegApprovals.length === 0 && <p className="text-gray-300 text-sm">{t('audit.noActivityReg')}</p>}
              {data.myActivityRegApprovals.map(r => (
                <div key={r.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{r.name}</p>
                      <p className="text-[10px] text-gray-400">{r.class}</p>
                      {r.paymentProof && (
                        <div className="mt-2">
                          <p className="text-xs text-yellow-600 font-medium mb-1">💰 {t('audit.uploadedPaymentProof')}</p>
                          <button 
                            onClick={() => setSelectedDetail({ ...r, type: 'activityReg' })}
                            className="text-xs text-blue-600 underline hover:text-blue-800"
                          >
                            {t('audit.viewPaymentScreenshot')}
                          </button>
                        </div>
                      )}
                      {r.paymentStatus === 'unpaid' && (
                        <p className="text-xs text-red-600 font-medium mt-1">⚠️ {t('audit.noPaymentProof')}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove('activityReg', r.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.approve')}</button>
                      <button onClick={() => handleApprove('activityReg', r.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.reject')}</button>
                    </div>
                  </div>
                  {r.reason && (
                    <p className="text-xs text-gray-600 mt-2">{t('audit.reasonLabel')}: {r.reason}</p>
                  )}
                  {r.contact && (
                    <p className="text-xs text-gray-600">{t('audit.contactLabel')}: {r.contact}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 我收到的社团加入申请 (作为社团创建者) */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('audit.receivedClubJoin')}</h3>
              {data.myClubJoinApprovals.length > 0 && (
                <button onClick={() => handleApproveAll('clubJoin')} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-green-700">{t('audit.approveAll')}</button>
              )}
            </div>
            <div className="space-y-3">
              {data.myClubJoinApprovals.length === 0 && <p className="text-gray-300 text-sm">{t('audit.noClubJoin')}</p>}
              {data.myClubJoinApprovals.map(j => (
                <div key={j.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800">{j.User?.name}</p>
                    <p className="text-[10px] text-gray-400">{j.User?.class} · {j.Club?.name ? `申请加入「${j.Club.name}」` : t('audit.applyJoinClub')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove('clubJoin', j.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.approve')}</button>
                    <button onClick={() => handleApprove('clubJoin', j.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">{t('audit.reject')}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 我的各项申请状态 */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">{t('audit.historyProgress')}</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[...data.myClubStatus, ...data.myActivityStatus, ...data.myActivityRegStatus, ...data.myOwnClubJoinStatus].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50/50 rounded-lg">
                <span className="text-sm font-medium text-gray-600 truncate mr-2">
                  {item.name || (item.Club ? `${t('activity.joinClub')}: ${item.Club.name}` : `${t('activity.regActivity')} ID: ${item.activityID}`)}
                </span>
                <span className={`text-[10px] px-2 py-1 rounded-full font-black uppercase flex-shrink-0 ${
                  item.status === 'approved' ? 'bg-green-100 text-green-600' : 
                  item.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  {item.status === 'approved' ? 'PASS' : item.status === 'rejected' ? 'FAIL' : 'WAIT'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 详情模态框 (Modal) */}
      {selectedDetail && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-3xl font-black text-gray-800">{t('audit.applicationDetail')}</h3>
              <p className="text-gray-400 text-sm mt-2">{t('audit.reviewDetailHint')}</p>
            </div>
            
            <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {Object.entries(selectedDetail).map(([key, value]) => {
                // 排除不需要显示的字段
                if (['id', 'founderID', 'organizerID', 'status', 'type', 'createdAt', 'updatedAt', '_id', '__v'].includes(key)) return null;
                // 跳过空值（除了支付凭证和支付状态）
                if (!value && key !== 'paymentProof' && key !== 'paymentStatus') return null;
                
                // 将字段名翻译显示
                const labels = {
                  name: t('audit.applicantName'), class: t('app.class'), reason: t('audit.reason'), contact: t('audit.contact'),
                  intro: t('audit.clubIntro'), content: t('audit.activityContent'), location: t('audit.venue'),
                  time: t('audit.venueTime'), duration: t('audit.duration'), weeks: t('audit.weeks'), capacity: t('audit.capacity'),
                  description: t('audit.briefDesc'), flow: t('audit.flow'), requirements: t('audit.requirements'), file: t('audit.attachment'),
                  activityID: t('audit.activityID'), paymentProof: t('audit.paymentProof'), paymentStatus: t('audit.paymentStatus')
                };

                if (key === 'file' && value) {
                  return (
                    <div key={key} className="border-l-4 border-blue-100 pl-4 py-1">
                          <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{labels[key]}</label>
                      <div className="mt-1.5">
                        <a 
                          href={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${value}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black hover:bg-blue-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {t('audit.viewAttachment')}
                        </a>
                      </div>
                    </div>
                  );
                }

                // 显示支付凭证
                if (key === 'paymentProof' && value) {
                  return (
                    <div key={key} className="border-l-4 border-yellow-100 pl-4 py-1">
                      <label className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">{labels[key]}</label>
                      <div className="mt-1.5">
                        <img 
                          src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${value}`}
                          alt={t('audit.paymentProof')}
                          className="max-w-full rounded-lg border-2 border-yellow-200 cursor-pointer hover:border-yellow-400 transition-all"
                          onClick={() => window.open(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${value}`, '_blank')}
                        />
                        <a 
                          href={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${value}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-600 rounded-xl text-xs font-black hover:bg-yellow-100 transition-all mt-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          查看大图
                        </a>
                      </div>
                    </div>
                  );
                }

                // 显示支付状态
                if (key === 'paymentStatus') {
                  const statusLabels = {
                    'unpaid': t('audit.unpaid'),
                    'pending_verification': t('audit.pendingVerification'),
                    'paid': t('audit.paid')
                  };
                  const statusColors = {
                    'unpaid': 'text-red-600 bg-red-50',
                    'pending_verification': 'text-yellow-600 bg-yellow-50',
                    'paid': 'text-green-600 bg-green-50'
                  };
                  return (
                    <div key={key} className="border-l-4 border-yellow-100 pl-4 py-1">
                      <label className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">{labels[key]}</label>
                      <p className={`text-xs mt-1.5 px-3 py-1 rounded-full font-bold inline-block ${statusColors[value] || 'text-gray-600 bg-gray-50'}`}>
                        {statusLabels[value] || value}
                      </p>
                    </div>
                  );
                }

                return (
                  <div key={key} className="border-l-4 border-blue-100 pl-4 py-1">
                    <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{labels[key] || key}</label>
                    <p className="text-gray-700 mt-1.5 leading-relaxed font-medium whitespace-pre-wrap">{value || t('audit.notFilled')}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-8 bg-gray-50 flex gap-4">
              <button 
                onClick={() => handleApprove(selectedDetail.type, selectedDetail.id, 'approved')}
                className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-100"
              >
                {t('audit.approveApplication')}
              </button>
              <button 
                onClick={() => handleApprove(selectedDetail.type, selectedDetail.id, 'rejected')}
                className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-100"
              >
                {t('audit.rejectApplication')}
              </button>
              <button 
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 公告编辑弹窗 */}
      {editingAnnouncement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingAnnouncement(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-4">{isEn ? 'Edit announcement' : '编辑公告'}</h3>
            <input
              type="text"
              placeholder={isEn ? 'Title' : '标题'}
              value={editingAnnouncement.title}
              onChange={e => setEditingAnnouncement(a => ({ ...a, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-3"
            />
            <textarea
              placeholder={isEn ? 'Content' : '内容'}
              value={editingAnnouncement.content}
              onChange={e => setEditingAnnouncement(a => ({ ...a, content: e.target.value }))}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4"
            />
            <div className="flex gap-2">
              <button disabled={announcementLoading} onClick={() => setEditingAnnouncement(null)} className="flex-1 py-2 rounded-lg border border-gray-300 font-bold text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {isEn ? 'Cancel' : '取消'}
              </button>
              <button
                disabled={announcementLoading}
                onClick={async () => {
                  setAnnouncementLoading(true);
                  try {
                    await api.put(`/announcements/${editingAnnouncement.id}`, {
                      operatorID: user.userID,
                      title: editingAnnouncement.title.trim(),
                      content: editingAnnouncement.content.trim()
                    });
                    setEditingAnnouncement(null);
                    await fetchAnnouncements();
                    onAnnouncementsChange?.();
                    alert(isEn ? 'Saved' : '已保存');
                  } catch (e) {
                    alert(e.response?.data?.error || (isEn ? 'Failed' : '保存失败'));
                  } finally {
                    setAnnouncementLoading(false);
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {announcementLoading ? (isEn ? 'Saving...' : '保存中...') : (isEn ? 'Save' : '保存')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditStatus;









