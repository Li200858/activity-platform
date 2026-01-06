import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

function ClubMatters({ user }) {
  const [view, setView] = useState('menu'); // menu, rotation, registration, creation, members
  const [clubs, setClubs] = useState([]);
  const [myClub, setMyClub] = useState(null);
  const [selectedClubDetail, setSelectedClubDetail] = useState(null);
  const [members, setMembers] = useState(null); // { clubName, members: [] }
  const [formData, setFormData] = useState({
    name: '', intro: '', content: '', location: '', time: '', duration: '', weeks: '', capacity: ''
  });
  const [file, setFile] = useState(null);
  const [nameStatus, setNameStatus] = useState(null); // null, 'checking', 'available', 'taken'
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    fetchClubs();
    fetchMyClub();
  }, []);

  const fetchClubs = async () => {
    const res = await api.get('/clubs/approved');
    setClubs(res.data);
  };

  const fetchMyClub = async () => {
    try {
      const res = await api.get(`/clubs/my/${user.userID}`);
      setMyClub(res.data);
    } catch (e) {
      console.error("无法获取个人社团状态", e);
    }
  };

  const handleLeaveClub = async () => {
    if (!window.confirm('确定要退出当前社团吗？')) return;
    try {
      await api.post('/clubs/leave', { userID: user.userID });
      alert('已退出社团');
      setMyClub(null);
      fetchClubs();
    } catch (e) {
      alert('退出失败');
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

  const handleCreateClub = async (e) => {
    e.preventDefault();
    
    // 如果名称已被占用，阻止提交
    if (nameStatus === 'taken') {
      alert(nameError || '该社团名称不可用，请使用其他名称');
      return;
    }
    
    // 如果正在检查，等待检查完成
    if (nameStatus === 'checking') {
      alert('正在检查社团名称，请稍候...');
      return;
    }
    
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      data.append('founderID', user.userID);
      if (file) data.append('file', file);

      await api.post('/clubs', data);
      alert('社团申请已提交，请等待管理员审核');
      setView('menu');
      // 重置表单
      setFormData({ name: '', intro: '', content: '', location: '', time: '', duration: '', weeks: '', capacity: '' });
      setFile(null);
      setNameStatus(null);
      setNameError('');
    } catch (err) {
      alert(err.response?.data?.error || '创建失败，请稍后重试');
    }
  };

  const handleRegister = async (clubID) => {
    try {
      await api.post('/clubs/register', { userID: user.userID, clubID });
      alert('报名成功');
      fetchMyClub();
      fetchClubs(); // 刷新社团列表以更新人数显示
      setView('menu');
    } catch (err) {
      alert(err.response?.data?.error || '报名失败');
    }
  };

  const handleRotate = async (clubID) => {
    try {
      await api.post('/clubs/rotate', { userID: user.userID, newClubID: clubID });
      alert('社团轮换成功');
      fetchMyClub();
      fetchClubs(); // 刷新社团列表以更新人数显示
      setView('menu');
    } catch (err) {
      alert(err.response?.data?.error || '轮换失败');
    }
  };

  const fetchMembers = async (clubId) => {
    try {
      const res = await api.get(`/clubs/${clubId}/members?userID=${user.userID}`);
      setMembers(res.data);
      setView('members');
    } catch (err) {
      alert(err.response?.data?.error || '获取成员列表失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 当前社团状态卡片 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">我的社团状态</h2>
            {myClub ? (
              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-gray-800">{myClub.Club?.name || '未知社团'}</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                  myClub.status === 'approved' ? 'bg-green-50 text-green-600' : 
                  myClub.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  {myClub.status === 'approved' ? '已加入' : myClub.status === 'rejected' ? '被拒绝' : '审核中'}
                </span>
              </div>
            ) : (
              <p className="text-gray-400 text-sm italic">暂未加入任何社团</p>
            )}
          </div>
          {myClub && (
            <button 
              onClick={handleLeaveClub}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
            >
              退出社团
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {view === 'menu' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <button 
                onClick={() => {
                  if (!myClub) return alert('请先报名一个社团才能进行轮换');
                  setView('rotation');
                }} 
                className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-105 active:scale-95 ${
                  !myClub ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'
                }`}
              >
                <span className="font-black">社团轮换</span>
              </button>
              
              <button 
                onClick={() => {
                  if (myClub) return alert('您已加入社团，如需更换请使用轮换功能或先退出当前社团');
                  setView('registration');
                }} 
                className={`p-6 rounded-2xl flex flex-col items-center gap-3 transition-all hover:scale-105 active:scale-95 ${
                  myClub ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                }`}
              >
                <span className="font-black">社团报名</span>
              </button>

              <button onClick={() => setView('creation')} className="bg-purple-50 text-purple-600 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-purple-600 hover:text-white transition-all hover:scale-105 active:scale-95">
                <span className="font-black">社团创建</span>
              </button>
            </div>

            {/* 显示所有社团列表 */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-black text-gray-800 mb-4">所有社团列表</h3>
              {clubs.length === 0 ? (
                <p className="text-center py-10 text-gray-400 italic">暂无社团</p>
              ) : (
                <div className="grid gap-4">
                  {clubs.map(club => (
                    <div key={club.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-black text-gray-800 text-lg mb-2">{club.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                            <span>创建者: {club.founderName || '未知'}</span>
                            {club.founderClass && <span>({club.founderClass})</span>}
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                              {club.memberCount} / {club.capacity} 人
                            </span>
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
                          查看详情
                        </button>
                        {/* 参与人员按钮 - 仅创建者和管理员可见 */}
                        {(club.founderID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                          <button 
                            onClick={() => fetchMembers(club.id)}
                            className="bg-purple-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition-all"
                          >
                            参与人员
                          </button>
                        )}
                        {/* 下载Excel按钮 - 仅创建者和管理员可见 */}
                        {(club.founderID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                          <button 
                            onClick={() => {
                              const link = document.createElement('a');
                              const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                              link.href = `${apiBase}/api/clubs/${club.id}/export?userID=${user.userID}`;
                              link.click();
                            }}
                            className="bg-green-600 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition-all"
                          >
                            下载成员Excel
                          </button>
                        )}
                        {/* 解散社团按钮 - 仅创建者可见（管理员不行） */}
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
                            解散社团
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'registration' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-800">可选社团列表</h2>
              <button onClick={() => setView('menu')} className="text-xs font-bold text-gray-400 hover:text-blue-600">返回菜单</button>
            </div>
            <div className="grid gap-4">
              {clubs.length === 0 && <p className="text-center py-10 text-gray-400 italic">暂无可选社团</p>}
              {clubs.map(club => (
                <div key={club.id} className="bg-gray-50 p-5 rounded-2xl flex justify-between items-center border border-gray-100 hover:border-green-200 transition-colors">
                  <button onClick={() => setSelectedClubDetail(club)} className="text-left group flex-1">
                    <h3 className="font-black text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{club.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500 line-clamp-1">{club.intro}</p>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">
                        {club.memberCount} / {club.capacity} 人
                      </span>
                    </div>
                  </button>
                  <button 
                    onClick={() => handleRegister(club.id)} 
                    disabled={club.capacity && club.memberCount >= club.capacity}
                    className={`px-6 py-2 rounded-xl font-black shadow-lg transition-all ${
                      club.capacity && club.memberCount >= club.capacity
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-green-600 text-white hover:scale-105 active:scale-95 shadow-green-100'
                    }`}
                  >
                    {club.capacity && club.memberCount >= club.capacity ? '人数已满' : '立即报名'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'rotation' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-gray-800">社团轮换</h2>
                <p className="text-[10px] text-orange-500 font-bold mt-1 uppercase tracking-widest">开放时间：周日 17:00 - 周四 21:50</p>
              </div>
              <button onClick={() => setView('menu')} className="text-xs font-bold text-gray-400 hover:text-blue-600">返回菜单</button>
            </div>
            <div className="grid gap-4">
              {clubs.filter(c => c.id !== myClub?.clubID).map(club => (
                <div key={club.id} className="bg-gray-50 p-5 rounded-2xl flex justify-between items-center border border-gray-100 hover:border-blue-200 transition-colors">
                  <button onClick={() => setSelectedClubDetail(club)} className="text-left group flex-1">
                    <h3 className="font-black text-gray-800 text-lg group-hover:text-blue-600">{club.name}</h3>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold mt-1 inline-block">
                      当前人数: {club.memberCount} / {club.capacity}
                    </span>
                  </button>
                  <button onClick={() => handleRotate(club.id)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all">更换为此社团</button>
                </div>
              ))}
            </div>
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
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">活动安排详情</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="地点" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all" required onChange={e => setFormData({...formData, location: e.target.value})} />
                    <input placeholder="具体时间" className="bg-gray-50 border-none rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 transition-all" required onChange={e => setFormData({...formData, time: e.target.value})} />
                  </div>
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
      </div>

      {/* 社团详情模态框 */}
      {selectedClubDetail && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-3xl font-black text-gray-800">社团详情</h3>
              <p className="text-gray-400 text-sm mt-2">{selectedClubDetail.name}</p>
            </div>
            
            <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {Object.entries(selectedClubDetail).map(([key, value]) => {
                if (['id', 'founderID', 'status', 'memberCount', 'createdAt', 'updatedAt'].includes(key)) return null;
                
                const labels = {
                  name: '社团名称', intro: '社团介绍', content: '活动内容', location: '活动地点',
                  time: '活动时间', duration: '活动时长', weeks: '持续周数', capacity: '人数限制',
                  file: '附件'
                };

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

            <div className="p-8 bg-gray-50 flex justify-between items-center">
              <div className="flex gap-2">
                {/* 参与人员按钮 - 仅创建者和管理员可见 */}
                {(selectedClubDetail.founderID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <button 
                    onClick={() => {
                      setSelectedClubDetail(null);
                      fetchMembers(selectedClubDetail.id);
                    }}
                    className="px-6 py-3 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 transition-all"
                  >
                    参与人员
                  </button>
                )}
                {/* 下载Excel按钮 - 仅创建者和管理员可见 */}
                {(selectedClubDetail.founderID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                      link.href = `${apiBase}/api/clubs/${selectedClubDetail.id}/export?userID=${user.userID}`;
                      link.click();
                    }}
                    className="px-6 py-3 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 transition-all"
                  >
                    下载成员Excel
                  </button>
                )}
                {/* 解散社团按钮 - 仅创建者可见（管理员不行） */}
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
                    解散社团
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedClubDetail(null)} className="px-8 py-3 bg-gray-800 text-white rounded-2xl font-black hover:bg-black transition-all">关闭详情</button>
            </div>
          </div>
        </div>
      )}

      {/* 成员列表视图 */}
      {view === 'members' && members && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-gray-800">参与人员 - {members.clubName}</h2>
            <button 
              onClick={() => setView('menu')} 
              className="text-gray-500 underline text-sm font-bold hover:text-blue-600"
            >
              返回
            </button>
          </div>
          
          {members.members.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic">
              <p>暂无成员</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">序号</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">姓名</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">班级</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">用户ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {members.members.map((m) => (
                    <tr key={m.userID} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{m.index}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.class}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{m.userID}</td>
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
      )}
    </div>
  );
}

export default ClubMatters;




