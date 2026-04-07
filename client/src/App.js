import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth, api } from './utils/api';
import { useLanguage } from './context/LanguageContext';
import { TranslatableContent } from './components/TranslatableContent';
import ClubMatters from './pages/ClubMatters';
import ActivityMatters from './pages/ActivityMatters';
import Feedback from './pages/Feedback';
import AuditStatus from './pages/AuditStatus';
import FeedbackCollection from './pages/FeedbackCollection';
import Login from './pages/Login';
import { io } from 'socket.io-client';

// 支持生产环境和开发环境
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const socket = io(SOCKET_URL);

function App() {
  const { user, login, register, logout, copyID, updateEnglishName, setPin } = useAuth();
  const { lang, setLang, t, isEn } = useLanguage();
  const [activeTab, setActiveTab] = useState('社团事宜');
  const [hasAuditUnread, setHasAuditUnread] = useState(false);
  const [hasFeedbackUnread, setHasFeedbackUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [englishDraft, setEnglishDraft] = useState('');
  const [hideID, setHideID] = useState(() => localStorage.getItem('hideID') === '1');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalValue, setPinModalValue] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const fetchAnnouncements = async (showLoading = true) => {
    if (showLoading) setAnnouncementsLoading(true);
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data || []);
    } catch (e) { setAnnouncements([]); }
    finally { if (showLoading) setAnnouncementsLoading(false); }
  };

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
      checkNotifications();
      socket.on('notification_update', (data) => {
        const isAdmin = user.role === 'admin' || user.role === 'super_admin';
        if (data.type === 'new_feedback') {
          if (isAdmin) setHasFeedbackUnread(true);
        } else if (data.type === 'new_audit') {
          if (isAdmin) setHasAuditUnread(true);
        } else if (data.userID === user.userID) {
          // 用户自己的通知（审核结果、反馈回复）-> 审核状态
          setHasAuditUnread(true);
        }
      });
      
      const timer = setInterval(checkNotifications, 30000);
      return () => {
        socket.off('notification_update');
        clearInterval(timer);
      };
    }
  }, [user]);

  // 同步当前用户英文名到右上角输入框草稿
  useEffect(() => {
    setEnglishDraft(user?.englishName || '');
  }, [user?.englishName]);

  const checkNotifications = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/notifications/${user.userID}`);
      setHasAuditUnread(res.data.hasAuditUnread ?? false);
      setHasFeedbackUnread(res.data.hasFeedbackUnread ?? false);
    } catch (e) {}
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchResults(null);
    if (tab === '审核状态') {
      setHasAuditUnread(false);
      axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/notifications/read`, { userID: user.userID, operatorID: user.userID });
    } else if (tab === '反馈收集') {
      setHasFeedbackUnread(false);
      axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/notifications/read`, { userID: user.userID, operatorID: user.userID });
    }
  };

  const handleSaveEnglishName = async () => {
    if (!user) return;
    const val = englishDraft.trim();
    if (val === (user.englishName || '')) return;
    try {
      await updateEnglishName(val);
      alert(isEn ? 'English name saved' : '英文名已保存');
    } catch (e) {
      alert(isEn ? 'Failed to save' : '保存英文名失败，请重试');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await api.get(`/search?q=${searchQuery}&operatorID=${user.userID}`);
      setSearchResults(res.data);
      setActiveTab('搜索结果');
    } catch (err) {
      console.error("搜索失败", err);
    }
  };

  const handleSetRole = async (targetUserID, role) => {
    try {
      await api.post('/admin/set-role', { targetUserID, role, operatorID: user.userID });
      alert(isEn ? 'Role updated' : '权限设置成功');
      const res = await api.get(`/search?q=${searchQuery}&operatorID=${user.userID}`);
      setSearchResults(res.data);
    } catch (err) {
      alert(err.response?.data?.error || (isEn ? 'Failed' : '设置失败'));
    }
  };

  const handleDeleteUser = async (targetUserID, targetName) => {
    if (!window.confirm(isEn ? `Delete account "${targetName}"? This cannot be undone.` : `确定删除用户「${targetName}」的账户？此操作不可恢复。`)) return;
    try {
      await api.delete(`/admin/users/${targetUserID}?operatorID=${encodeURIComponent(user.userID)}`);
      alert(isEn ? 'Account deleted' : '账户已删除');
      const res = await api.get(`/search?q=${searchQuery}&operatorID=${user.userID}`);
      setSearchResults(res.data);
    } catch (err) {
      alert(err.response?.data?.error || (isEn ? 'Delete failed' : '删除失败'));
    }
  };

  const handleResetPin = async (targetUserID, targetName) => {
    if (!window.confirm(isEn ? `Clear PIN for "${targetName}"? They can then login with name+class+ID only.` : `确定清除「${targetName}」的 PIN？清除后该用户可凭姓名+班级+ID 登录。`)) return;
    try {
      await api.post('/admin/reset-pin', { targetUserID, operatorID: user.userID });
      alert(isEn ? 'PIN cleared' : '已清除 PIN');
      const res = await api.get(`/search?q=${searchQuery}&operatorID=${user.userID}`);
      setSearchResults(res.data);
    } catch (err) {
      alert(err.response?.data?.error || (isEn ? 'Failed' : '操作失败'));
    }
  };

  if (!user) {
    return <Login onLogin={login} onRegister={register} />;
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-100 font-sans overflow-x-hidden">
      <header className="bg-white shadow-sm sticky top-0 z-20 app-header-sticky compact-landscape-header">
        <div className="max-w-6xl mx-auto p-3 sm:p-4 landscape-tight-y max-md:landscape:p-2 flex flex-col gap-3 sm:gap-4 max-md:landscape:gap-2 w-full min-w-0 box-border">
          <div className="flex flex-col gap-3 min-w-0 xl:flex-row xl:justify-between xl:items-center">
            <div className="flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1 min-w-0 w-full xl:w-auto">
              <button onClick={() => handleTabChange('社团事宜')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '社团事宜' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t('app.tabs.club')}</button>
              <button onClick={() => handleTabChange('活动事宜')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '活动事宜' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t('app.tabs.activity')}</button>
              <button onClick={() => handleTabChange('意见反馈')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '意见反馈' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t('app.tabs.feedback')}</button>
              
              {isAdmin && (
                <button onClick={() => handleTabChange('反馈收集')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all relative ${activeTab === '反馈收集' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {t('app.tabs.feedbackCollection')}
                  {hasFeedbackUnread && activeTab !== '反馈收集' && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 xl:gap-6 justify-start xl:justify-end w-full xl:w-auto min-w-0">
              <button
                type="button"
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shrink-0"
              >
                {t('app.langSwitch')}
              </button>
              <button 
                onClick={() => handleTabChange('审核状态')} 
                className={`text-sm font-bold transition-colors relative flex items-center gap-1 shrink-0 ${activeTab === '审核状态' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
              >
                <span>{t('app.tabs.audit')}</span>
                {hasAuditUnread && activeTab !== '审核状态' && activeTab !== '反馈收集' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>
              <div className="hidden xl:block h-8 w-px bg-gray-200 shrink-0" aria-hidden="true" />
              <div className="flex flex-col items-stretch sm:items-end gap-1 min-w-0 flex-1 xl:flex-initial">
                <div className="flex flex-col items-end">
                  <p className="text-xs font-black text-gray-800 leading-tight">
                    {user.name}
                    {user.englishName && ` / ${user.englishName}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-gray-400 font-mono">ID: {hideID ? '••••••••' : user.userID}</p>
                    <button
                      type="button"
                      onClick={() => { const v = !hideID; setHideID(v); localStorage.setItem('hideID', v ? '1' : '0'); }}
                      className="text-gray-400 hover:text-blue-600 p-0.5"
                      title={hideID ? '显示ID' : '隐藏ID'}
                    >
                      {hideID ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      )}
                    </button>
                  </div>
                  {user.lastLoginAt && (() => {
                    try {
                      const d = new Date(user.lastLoginAt);
                      if (!isNaN(d.getTime())) {
                        return <p className="text-[9px] text-gray-400 mt-0.5">{isEn ? 'Last login: ' : '上次登录: '}{d.toLocaleString('zh-CN')}</p>;
                      }
                    } catch (_) {}
                    return null;
                  })()}
                  <button type="button" onClick={() => { setShowPinModal(true); setPinModalValue(''); }} className="text-[9px] text-blue-500 hover:underline mt-0.5">
                    {(user.hasPin === true) ? (isEn ? 'Change PIN' : '修改PIN') : (isEn ? 'Set PIN' : '设置PIN')}
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto min-w-0 justify-end">
                  <input
                    type="text"
                    value={englishDraft}
                    placeholder={t('app.englishName')}
                    onChange={e => setEnglishDraft(e.target.value)}
                    className="min-w-0 flex-1 sm:flex-initial w-full sm:w-40 max-w-full bg-white border border-gray-200 rounded-full px-3 py-1 text-[10px] text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEnglishName}
                    className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all"
                  >
                    {t('app.save')}
                  </button>
                </div>
              </div>
              <button type="button" onClick={logout} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative group w-full min-w-0 max-md:landscape:pt-0">
            <input 
              type="text" 
              placeholder={t('app.search.placeholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-0 box-border bg-gray-100 border-none rounded-2xl pl-11 pr-[5.25rem] sm:pl-12 sm:pr-28 py-2.5 sm:py-3 max-md:landscape:py-2 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
            <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button type="submit" className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1.5 sm:px-5 rounded-xl text-[10px] sm:text-xs font-black shadow-lg shadow-blue-100 shrink-0 max-w-[calc(100%-3rem)] truncate">{t('app.search.button')}</button>
          </form>
        </div>
      </header>

      <main className="p-3 sm:p-4 md:p-8 max-md:landscape:py-3 max-md:landscape:px-3 max-w-5xl mx-auto w-full min-w-0 box-border">
        {/* 公告栏：所有用户可见，点击查看完整内容 */}
        {announcementsLoading ? (
          <div className="mb-6 p-4 rounded-xl bg-amber-50/50 border border-amber-100 animate-pulse">
            <div className="h-4 bg-amber-200/50 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-amber-200/30 rounded w-full"></div>
          </div>
        ) : announcements.length > 0 && (
          <div className="mb-6 space-y-2">
            {announcements.slice(0, 3).map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAnnouncement(a)}
                className="w-full text-left p-4 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <p className="font-bold text-amber-800">{a.title}</p>
                <p className="text-xs text-amber-600 mt-1 line-clamp-2">{a.content}</p>
              </button>
            ))}
          </div>
        )}

        {activeTab === '搜索结果' && searchResults && (
          <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-500 min-w-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start min-w-0">
              <h2 className="text-xl sm:text-2xl xl:text-3xl font-black text-gray-800 break-words min-w-0">{t('app.search.resultTitle')}: <span className="text-blue-600 break-all">"{searchQuery}"</span></h2>
              <button onClick={() => { setSearchResults(null); setActiveTab('社团事宜'); }} className="text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors shrink-0 text-left sm:text-right">{t('app.search.backHome')}</button>
            </div>
            
            <section>
              <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">{t('app.users')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {searchResults.users.length === 0 && <p className="text-gray-400 italic text-sm">{t('app.noUsers')}</p>}
                {searchResults.users.map((u, idx) => (
                  <div key={idx} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border border-gray-100 hover:shadow-xl xl:hover:scale-[1.02] transition-all min-w-0">
                    <div>
                      <p className="font-black text-gray-800 text-lg">
                        {u.name}
                        {u.englishName && ` / ${u.englishName}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{u.class}</p>
                      {u.userID && <p className="text-[10px] text-blue-500 font-mono mt-2 bg-blue-50 inline-block px-2 py-0.5 rounded-md">ID: {u.userID}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                    {user.role === 'super_admin' && u.name !== user.name && (
                      <button 
                        onClick={() => handleSetRole(u.userID, u.role === 'user' ? 'admin' : 'user')} 
                        className={`text-[10px] px-4 py-2 rounded-xl font-black transition-all ${u.role === 'user' ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {u.role === 'user' ? t('app.setAdmin') : t('app.cancelRole')}
                      </button>
                    )}
                    {user.role === 'super_admin' && u.userID !== user.userID && (
                      <button 
                        onClick={() => handleResetPin(u.userID, u.name)} 
                        className="text-[10px] px-4 py-2 rounded-xl font-black bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all"
                      >
                        {isEn ? 'Clear PIN' : '清除PIN'}
                      </button>
                    )}
                    {user.role === 'super_admin' && u.role === 'user' && u.userID !== user.userID && (
                      <button 
                        onClick={() => handleDeleteUser(u.userID, u.name)} 
                        className="text-[10px] px-4 py-2 rounded-xl font-black bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
                      >
                        {isEn ? 'Delete account' : '删除账户'}
                      </button>
                    )}
                  </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
              <section>
                <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">{t('app.clubs')}</h3>
                <div className="space-y-3">
                  {searchResults.clubs.length === 0 && <p className="text-gray-400 italic text-sm">{t('app.noClubs')}</p>}
                  {searchResults.clubs.map(c => (
                    <div key={c.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="font-black text-gray-800"><TranslatableContent>{c.name}</TranslatableContent></p>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed"><TranslatableContent>{c.intro || ''}</TranslatableContent></p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">{t('app.activities')}</h3>
                <div className="space-y-3">
                  {searchResults.activities.length === 0 && <p className="text-gray-400 italic text-sm">{t('app.noActivities')}</p>}
                  {searchResults.activities.map(a => (
                    <div key={a.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="font-black text-gray-800"><TranslatableContent>{a.name}</TranslatableContent></p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold">{a.location}</span>
                        <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md font-bold">{a.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === '社团事宜' && <ClubMatters user={user} />}
        {activeTab === '活动事宜' && <ActivityMatters user={user} />}
        {activeTab === '意见反馈' && <Feedback user={user} />}
        {activeTab === '审核状态' && <AuditStatus user={user} onAnnouncementsChange={() => fetchAnnouncements(false)} />}
        {activeTab === '反馈收集' && <FeedbackCollection user={user} />}
      </main>

      {/* 公告详情弹窗 */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 max-md:landscape:items-end overscroll-contain" onClick={() => setSelectedAnnouncement(null)}>
          <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[min(85dvh,85svh)] max-md:landscape:max-h-[75dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 text-lg mb-3">{selectedAnnouncement.title}</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedAnnouncement.content}</p>
            <button onClick={() => setSelectedAnnouncement(null)} className="mt-4 w-full py-2 rounded-lg border border-gray-300 font-bold text-gray-600">
              {isEn ? 'Close' : '关闭'}
            </button>
          </div>
        </div>
      )}

      {/* PIN 设置弹窗 */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 max-md:landscape:items-end overscroll-contain">
          <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-sm max-h-[min(90dvh,90svh)] max-md:landscape:max-h-[80dvh] overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-3">{user?.hasPin ? (isEn ? 'Change PIN' : '修改 PIN') : (isEn ? 'Set PIN' : '设置 PIN')}</h3>
            <p className="text-xs text-gray-500 mb-1">{isEn ? '4-6 digits, leave empty to remove' : '4-6 位数字，留空则移除'}</p>
            <p className="text-xs text-amber-600 mb-3">{isEn ? 'If set, next login only needs PIN (no ID required); if left empty, ID required.' : '如设置 PIN 则下次登录只需填写 PIN，不需要 ID；留空则需用 ID 登录。'}</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinModalValue}
              onChange={e => setPinModalValue(e.target.value.replace(/\D/g, ''))}
              placeholder="4-6 位数字"
              className="w-full border rounded-lg px-4 py-3 mb-4 font-mono"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowPinModal(false)} className="flex-1 py-2 rounded-lg border border-gray-300 font-bold text-gray-600">{isEn ? 'Cancel' : '取消'}</button>
              <button
                onClick={async () => {
                  const val = pinModalValue.trim();
                  if (val && (val.length < 4 || val.length > 6)) {
                    alert(isEn ? 'PIN must be 4-6 digits' : 'PIN 须为 4-6 位数字');
                    return;
                  }
                  try {
                    await setPin(val || null);
                    setShowPinModal(false);
                    alert(isEn ? 'Done' : '已保存');
                  } catch (e) {
                    alert(e.response?.data?.error || (isEn ? 'Failed' : '操作失败'));
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-bold"
              >
                {isEn ? 'Save' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;









