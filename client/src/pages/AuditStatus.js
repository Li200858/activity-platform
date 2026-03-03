import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

function AuditStatus({ user }) {
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

  useEffect(() => {
    fetchAuditStatus();
  }, []);

  useEffect(() => {
    if (data && (user.role === 'admin' || user.role === 'super_admin')) {
      api.get(`/clubs/venue-requests/all?userID=${user.userID}`).then(r => setVenueRequestsAll(r.data || [])).catch(() => setVenueRequestsAll([]));
      api.get('/clubs/venue-schedule').then(r => setVenueSchedulesAll(r.data || [])).catch(() => setVenueSchedulesAll([]));
      api.get('/clubs/approved').then(r => setClubsForVenue(r.data || [])).catch(() => setClubsForVenue([]));
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
      const res = await api.get(`/audit/status/${user.userID}`);
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
      await api.post('/audit/approve', { type, id, status });
      await fetchAuditStatus(); // 等待刷新完成
      setSelectedDetail(null); // 审核后关闭弹窗
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
      const res = await api.get(`/admin/users/search?query=${encodeURIComponent(searchQuery.trim())}`);
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

  const handleVenueRequestStatus = async (rid, status) => {
    try {
      await api.put(`/clubs/venue-requests/${rid}`, { userID: user.userID, status });
      const res = await api.get(`/clubs/venue-requests/all?userID=${user.userID}`);
      setVenueRequestsAll(res.data || []);
    } catch (err) {
      alert(err.response?.data?.error || '操作失败');
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
        <p className="text-gray-500 italic">正在连接服务器...</p>
        <p className="text-xs text-gray-400 mt-2">如果长时间无响应，请检查网络连接</p>
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
          <h3 className="text-lg font-black text-red-600 mb-2">加载失败</h3>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button 
            onClick={fetchAuditStatus}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 数据为空（不应该发生，但作为安全措施）
  if (!data) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-500 italic mb-4">暂无数据</p>
        <button 
          onClick={fetchAuditStatus}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black hover:bg-blue-700 transition-all"
        >
          刷新
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* 管理员管理面板 */}
      {(user.role === 'admin' || user.role === 'super_admin') && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-red-50">
          <h2 className="text-xl font-black text-red-600 mb-6 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
            管理员审核控制台
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* 社团审核列表 */}
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">待审批社团</h3>
              <div className="space-y-3">
                {data.clubCreations.length === 0 && <p className="text-gray-300 text-sm py-4">暂无申请</p>}
                {data.clubCreations.map(c => (
                  <div key={c.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center hover:bg-red-50/50 transition-colors border border-gray-100">
                    <button 
                      onClick={() => setSelectedDetail({ ...c, type: 'club' })}
                      className="text-left group"
                    >
                      <p className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{c.name}</p>
                      <p className="text-[10px] text-gray-400">点击查看详情并审核</p>
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove('club', c.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">通过</button>
                      <button onClick={() => handleApprove('club', c.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">拒绝</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 活动审核列表 */}
            <section>
              <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">待审批活动</h3>
              <div className="space-y-3">
                {data.activityCreations.length === 0 && <p className="text-gray-300 text-sm py-4">暂无申请</p>}
                {data.activityCreations.map(a => (
                  <div key={a.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center hover:bg-red-50/50 transition-colors border border-gray-100">
                    <button 
                      onClick={() => setSelectedDetail({ ...a, type: 'activity' })}
                      className="text-left group"
                    >
                      <p className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{a.name}</p>
                      <p className="text-[10px] text-gray-400">点击查看详情并审核</p>
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove('activity', a.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">通过</button>
                      <button onClick={() => handleApprove('activity', a.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">拒绝</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 超级管理员特有的用户管理 */}
          {user.role === 'super_admin' && (
            <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                管理员权限分配
              </h3>
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  placeholder="输入用户姓名或 ID..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <button onClick={handleSearchUser} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">搜索</button>
              </div>
              
              <div className="grid gap-2">
                {searchResults.length === 0 && searchQuery && (
                  <p className="text-center py-4 text-gray-400 italic">未找到匹配的用户</p>
                )}
                {searchResults.length === 0 && !searchQuery && (
                  <p className="text-center py-4 text-gray-400 italic">请输入姓名或用户ID进行搜索</p>
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
                    <div>
                      {u.role === 'user' && (
                        <button onClick={() => handleSetRole(u.userID, 'admin')} className="text-xs bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-all">设为管理员</button>
                      )}
                      {u.role === 'admin' && (
                        <button onClick={() => handleSetRole(u.userID, 'user')} className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-600 hover:text-white transition-all">取消权限</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 场地管理：申请审核 + 排期（管理员） */}
          <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">场地管理</h3>
            <section className="mb-6">
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">场地申请审核</h4>
              {venueRequestsAll.length === 0 ? <p className="text-gray-400 text-sm">暂无申请</p> : (
                <div className="space-y-2">
                  {venueRequestsAll.map(r => (
                    <div key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border">
                      <span className="font-medium">{r.clubName || r.clubID?.name} · {r.semester} · {r.blocks?.join(',') || '-'}</span>
                      <div className="flex gap-2">
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => handleVenueRequestStatus(r.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">通过</button>
                            <button onClick={() => handleVenueRequestStatus(r.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">拒绝</button>
                          </>
                        )}
                        <span className={`text-xs font-bold ${r.status === 'approved' ? 'text-green-600' : r.status === 'rejected' ? 'text-red-600' : 'text-orange-600'}`}>
                          {r.status === 'pending' ? '待审核' : r.status === 'approved' ? '已通过' : '已拒绝'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">添加排期</h4>
              <form onSubmit={handleAddVenueSchedule} className="flex flex-wrap gap-2 items-end">
                <div className="relative min-w-[180px]">
                  <input
                    type="text"
                    placeholder="搜索社团名称，点击选择"
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
                    <button type="button" onClick={() => { setVenueScheduleForm(f => ({ ...f, clubID: '' })); setVenueClubSearchQuery(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs">清除</button>
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
                        <div className="px-3 py-2 text-gray-500 text-sm">无匹配社团</div>
                      )}
                    </div>
                  )}
                </div>
                <select value={venueScheduleForm.semester} onChange={e => setVenueScheduleForm(f => ({ ...f, semester: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm" required>
                  <option value="">学期</option>
                  <option value="2026-spring">2026春</option>
                  <option value="2026-fall">2026秋</option>
                  <option value="2025-fall">2025秋</option>
                </select>
                <input type="date" value={venueScheduleForm.date} onChange={e => setVenueScheduleForm(f => ({ ...f, date: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm" required />
                <select value={venueScheduleForm.block} onChange={e => setVenueScheduleForm(f => ({ ...f, block: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm" required>
                  <option value="">板块</option>
                  <option value="block1">Block1</option>
                  <option value="block2">Block2</option>
                  <option value="block3">Block3</option>
                  <option value="block4">Block4</option>
                </select>
                <input type="text" placeholder="场地名称" value={venueScheduleForm.venueName} onChange={e => setVenueScheduleForm(f => ({ ...f, venueName: e.target.value }))} className="bg-gray-50 border rounded-lg px-3 py-2 text-sm min-w-[100px]" required />
                <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm">添加</button>
              </form>
            </section>
            <section className="mt-4">
              <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">全部排期</h4>
              {venueSchedulesAll.length === 0 ? <p className="text-gray-400 text-sm">暂无</p> : (
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

      {/* 用户自己的申请进度 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
          我的申请进度反馈
        </h2>
        
        <div className="grid md:grid-cols-2 gap-10">
          {/* 我收到的报名申请 (作为活动组织者) */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">收到的活动报名申请</h3>
            <div className="space-y-3">
              {data.myActivityRegApprovals.length === 0 && <p className="text-gray-300 text-sm">暂无活动报名</p>}
              {data.myActivityRegApprovals.map(r => (
                <div key={r.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{r.name}</p>
                      <p className="text-[10px] text-gray-400">{r.class}</p>
                      {r.paymentProof && (
                        <div className="mt-2">
                          <p className="text-xs text-yellow-600 font-medium mb-1">💰 已上传支付凭证</p>
                          <button 
                            onClick={() => setSelectedDetail({ ...r, type: 'activityReg' })}
                            className="text-xs text-blue-600 underline hover:text-blue-800"
                          >
                            查看支付截图
                          </button>
                        </div>
                      )}
                      {r.paymentStatus === 'unpaid' && (
                        <p className="text-xs text-red-600 font-medium mt-1">⚠️ 未上传支付凭证</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove('activityReg', r.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">通过</button>
                      <button onClick={() => handleApprove('activityReg', r.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">拒绝</button>
                    </div>
                  </div>
                  {r.reason && (
                    <p className="text-xs text-gray-600 mt-2">申请原因: {r.reason}</p>
                  )}
                  {r.contact && (
                    <p className="text-xs text-gray-600">联系方式: {r.contact}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 我收到的社团加入申请 (作为社团创建者) */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">收到的社团加入申请</h3>
            <div className="space-y-3">
              {data.myClubJoinApprovals.length === 0 && <p className="text-gray-300 text-sm">暂无社团申请</p>}
              {data.myClubJoinApprovals.map(j => (
                <div key={j.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border border-gray-100">
                  <div>
                    <p className="font-bold text-gray-800">{j.User?.name}</p>
                    <p className="text-[10px] text-gray-400">{j.User?.class} · 申请加入您的社团</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove('clubJoin', j.id, 'approved')} className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">通过</button>
                    <button onClick={() => handleApprove('clubJoin', j.id, 'rejected')} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold">拒绝</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 我的各项申请状态 */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">历史进度追踪</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[...data.myClubStatus, ...data.myActivityStatus, ...data.myActivityRegStatus, ...data.myOwnClubJoinStatus].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50/50 rounded-lg">
                <span className="text-sm font-medium text-gray-600 truncate mr-2">
                  {item.name || (item.Club ? `加入: ${item.Club.name}` : `报名活动 ID: ${item.activityID}`)}
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
              <h3 className="text-3xl font-black text-gray-800">申请详情</h3>
              <p className="text-gray-400 text-sm mt-2">请审阅提交的详细信息以做出决策</p>
            </div>
            
            <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {Object.entries(selectedDetail).map(([key, value]) => {
                // 排除不需要显示的字段
                if (['id', 'founderID', 'organizerID', 'status', 'type', 'createdAt', 'updatedAt', '_id', '__v'].includes(key)) return null;
                // 跳过空值（除了支付凭证和支付状态）
                if (!value && key !== 'paymentProof' && key !== 'paymentStatus') return null;
                
                // 将字段名翻译为中文显示
                const labels = {
                  name: '申请人姓名', class: '班级', reason: '申请理由', contact: '联系方式',
                  intro: '社团介绍', content: '活动内容', location: '举办地点',
                  time: '举办时间', duration: '时长', weeks: '持续周数', capacity: '人数限制',
                  description: '简要描述', flow: '活动流程', requirements: '活动需求', file: '附件',
                  activityID: '活动 ID', paymentProof: '支付凭证', paymentStatus: '支付状态'
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
                          点击查看/下载附件
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
                          alt="支付凭证"
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
                    'unpaid': '未支付',
                    'pending_verification': '待审核',
                    'paid': '已支付'
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
                    <p className="text-gray-700 mt-1.5 leading-relaxed font-medium whitespace-pre-wrap">{value || '（未填写）'}</p>
                  </div>
                );
              })}
            </div>

            <div className="p-8 bg-gray-50 flex gap-4">
              <button 
                onClick={() => handleApprove(selectedDetail.type, selectedDetail.id, 'approved')}
                className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-green-100"
              >
                批准申请
              </button>
              <button 
                onClick={() => handleApprove(selectedDetail.type, selectedDetail.id, 'rejected')}
                className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-red-100"
              >
                拒绝申请
              </button>
              <button 
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditStatus;









