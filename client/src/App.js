import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth, api } from './utils/api';
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
  const { user, login, register, logout, copyID } = useAuth();
  const [activeTab, setActiveTab] = useState('社团事宜');
  const [hasNotification, setHasNotification] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

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
      axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/notifications/read`, { userID: user.userID });
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
      alert('权限设置成功');
      const res = await api.get(`/search?q=${searchQuery}&operatorID=${user.userID}`);
      setSearchResults(res.data);
    } catch (err) {
      alert(err.response?.data?.error || '设置失败');
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
              <button onClick={() => handleTabChange('社团事宜')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '社团事宜' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>社团事宜</button>
              <button onClick={() => handleTabChange('活动事宜')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '活动事宜' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>活动事宜</button>
              <button onClick={() => handleTabChange('意见反馈')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all ${activeTab === '意见反馈' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>意见反馈</button>
              
              {isAdmin && (
                <button onClick={() => handleTabChange('反馈收集')} className={`whitespace-nowrap px-4 py-2 rounded-full transition-all relative ${activeTab === '反馈收集' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}>
                  反馈收集
                  {hasNotification && activeTab !== '反馈收集' && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6">
              <button 
                onClick={() => handleTabChange('审核状态')} 
                className={`text-sm font-bold transition-colors relative flex items-center gap-1 ${activeTab === '审核状态' ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
              >
                <span>审核状态</span>
                {hasNotification && activeTab !== '审核状态' && activeTab !== '反馈收集' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="flex flex-col items-end">
                <p className="text-xs font-black text-gray-800 leading-tight">{user.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">ID: {user.userID}</p>
              </div>
              <button onClick={logout} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative group">
            <input 
              type="text" 
              placeholder="快速搜索用户 ID、社团或活动..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 border-none rounded-2xl px-12 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-blue-100">搜索</button>
          </form>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-5xl mx-auto">
        {/* Google Calendar 链接提示 */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <a 
              href="https://calendar.google.com/calendar/u/0?cid=NmRiZDhmM2M4MWFjMGU5MjIwMDdmZDhmNGM2OGQwMTQ5ODM2ZTk5NjcyODJhOGY1ZDc2NzUzNzZmY2UyNThhZUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              选择社团
            </a>
            <p className="text-sm text-gray-600 font-medium flex-1">
              点击此链接来选择社团，此功能等待网站更新
            </p>
          </div>
        </div>

        {activeTab === '搜索结果' && searchResults && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black text-gray-800">搜索结果: <span className="text-blue-600">"{searchQuery}"</span></h2>
              <button onClick={() => { setSearchResults(null); setActiveTab('社团事宜'); }} className="text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors">返回主页</button>
            </div>
            
            <section>
              <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">用户</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {searchResults.users.length === 0 && <p className="text-gray-400 italic text-sm">未找到匹配用户</p>}
                {searchResults.users.map((u, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm flex justify-between items-center border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all">
                    <div>
                      <p className="font-black text-gray-800 text-lg">{u.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{u.class}</p>
                      {u.userID && <p className="text-[10px] text-blue-500 font-mono mt-2 bg-blue-50 inline-block px-2 py-0.5 rounded-md">ID: {u.userID}</p>}
                    </div>
                    {user.role === 'super_admin' && u.name !== user.name && (
                      <button 
                        onClick={() => handleSetRole(u.userID, u.role === 'user' ? 'admin' : 'user')} 
                        className={`text-[10px] px-4 py-2 rounded-xl font-black transition-all ${u.role === 'user' ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {u.role === 'user' ? '设为管理员' : '取消权限'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
              <section>
                <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">社团</h3>
                <div className="space-y-3">
                  {searchResults.clubs.length === 0 && <p className="text-gray-400 italic text-sm">无相关社团</p>}
                  {searchResults.clubs.map(c => (
                    <div key={c.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="font-black text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">{c.intro}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em] border-b border-gray-200 pb-2">活动</h3>
                <div className="space-y-3">
                  {searchResults.activities.length === 0 && <p className="text-gray-400 italic text-sm">无相关活动</p>}
                  {searchResults.activities.map(a => (
                    <div key={a.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="font-black text-gray-800">{a.name}</p>
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
    </div>
  );
}

export default App;









