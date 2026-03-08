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
  const [hasNotification, setHasNotification] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [englishDraft, setEnglishDraft] = useState('');
  const [hideID, setHideID] = useState(() => localStorage.getItem('hideID') === '1');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalValue, setPinModalValue] = useState('');

  useEffect(() => {
    if (user) {
      checkNotifications();
      socket.on('notification_update', (data) => {
        // 管理员接收所有新申请或新反馈的提醒
        if (user.role === 'admin' || user.role === 'super_admin') {
          setHasNotification(true);
        } else if (data.userID === user.userID) {
          // 用户只接收针对自己的通知
          setHasNotification(true);
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
      setHasNotification(res.data.hasUnread);
    } catch (e) {}
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchResults(null);
    if (tab === '审核状态' || tab === '反馈收集') {
      setHasNotification(false);
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
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
              <button onClick={() => handleTabChange('社团事宜')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '社团事宜' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t('app.tabs.club')}</button>
              <button onClick={() => handleTabChange('活动事宜')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '活动事宜' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t('app.tabs.activity')}</button>
              <button onClick={() => handleTabChange('意见反馈')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '意见反馈' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>{t('app.tabs.feedback')}</button>
              
              {isAdmin && (
                <button onClick={() => handleTabChange('反馈收集')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all relative ${activeTab === '反馈收集' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {t('app.tabs.feedbackCollection')}
                  {hasNotification && activeTab !== '反馈收集' && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                type="button"
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {t('app.langSwitch')}
              </button>
              <button 
                onClick={() => handleTabChange('审核状态')} 
                className={`text-sm font-bold transition-colors relative flex items-center gap-1 ${activeTab === '审核状态' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
              >
                <span>{t('app.tabs.audit')}</span>
                {hasNotification && activeTab !== '审核状态' && activeTab !== '反馈收集' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="flex flex-col items-end gap-1">
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
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={englishDraft}
                    placeholder={t('app.englishName')}
                    onChange={e => setEnglishDraft(e.target.value)}
                    className="w-32 sm:w-40 bg-white border border-gray-200 rounded-full px-3 py-1 text-[10px] text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
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
              <button onClick={logout} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative group">
            <input 
              type="text" 
              placeholder={t('app.search.placeholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-2xl px-12 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-blue-100">{t('app.search.button')}</button>
          </form>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-5xl mx-auto">
        {activeTab === '搜索结果' && searchResults && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-gray-800">{t('app.search.resultTitle')}: <span className="text-blue-600">"{searchQuery}"</span></h2>
              <button onClick={() => { setSearchResults(null); setActiveTab('社团事宜'); }} className="text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors">{t('app.search.backHome')}</button>
            </div>
            
            <section>
              <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">{t('app.users')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {searchResults.users.length === 0 && <p className="text-gray-400 italic text-sm">{t('app.noUsers')}</p>}
                {searchResults.users.map((u, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all">
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
        {activeTab === '审核状态' && <AuditStatus user={user} />}
        {activeTab === '反馈收集' && <FeedbackCollection user={user} />}
      </main>

      {/* PIN 设置弹窗 */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 mb-3">{user?.hasPin ? (isEn ? 'Change PIN' : '修改 PIN') : (isEn ? 'Set PIN' : '设置 PIN')}</h3>
            <p className="text-xs text-gray-500 mb-3">{isEn ? '4-6 digits, leave empty to remove' : '4-6 位数字，留空则移除'}</p>
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









