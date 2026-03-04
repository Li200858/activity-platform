import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { TranslatableContent } from '../components/TranslatableContent';

function ActivityMatters({ user }) {
  const { t, isEn } = useLanguage();
  const [view, setView] = useState('menu'); // menu, organize, register, detail, participants, regForm
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [participants, setParticipants] = useState(null); // { activityName, participants: [] }
  const [formData, setFormData] = useState({
    name: '', capacity: '', time: '', location: '', description: '', flow: '', requirements: '',
    phaseTimePreparation: '', phaseTimeStart: '', phaseTimeInProgress: '', phaseTimeEnd: '',
    phaseTimePreparationStart: '', phaseTimePreparationEnd: '',
    phaseTimeStartStart: '', phaseTimeStartEnd: '',
    phaseTimeInProgressStart: '', phaseTimeInProgressEnd: '',
    phaseTimeEndStart: '', phaseTimeEndEnd: '',
    hasFee: false, feeAmount: ''
  });
  const [file, setFile] = useState(null);
  const [paymentQRCode, setPaymentQRCode] = useState(null);
  const [regForm, setRegForm] = useState({
    name: user.name, class: user.class, reason: '', contact: ''
  });
  const [paymentProof, setPaymentProof] = useState(null);
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activitySearchFocused, setActivitySearchFocused] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await api.get('/activities/approved');
      setActivities(res.data);
    } catch (e) {
      console.error("获取活动列表失败", e);
    }
  };

  const handleOrganize = async (e) => {
    e.preventDefault();
    try {
      // 如果选择了付费但未上传二维码，提示错误
      if (formData.hasFee && !paymentQRCode) {
        alert('选择了报名费功能，必须上传支付二维码');
        return;
      }
      
      // 格式化时间字段
      const formatDateTime = (start, end) => {
        if (!start && !end) return null;
        if (start && end) {
          const startDate = new Date(start);
          const endDate = new Date(end);
          return `${startDate.toLocaleString('zh-CN')} - ${endDate.toLocaleString('zh-CN')}`;
        }
        return start ? new Date(start).toLocaleString('zh-CN') : new Date(end).toLocaleString('zh-CN');
      };
      
      const data = new FormData();
      data.append('name', formData.name);
      data.append('capacity', formData.capacity);
      data.append('time', formData.time);
      data.append('location', formData.location);
      data.append('description', formData.description);
      data.append('flow', formData.flow);
      data.append('requirements', formData.requirements);
      data.append('hasFee', formData.hasFee.toString());
      if (formData.feeAmount) data.append('feeAmount', formData.feeAmount);
      
      // 格式化阶段时间
      data.append('phaseTimePreparation', formatDateTime(formData.phaseTimePreparationStart, formData.phaseTimePreparationEnd) || '');
      data.append('phaseTimeStart', formatDateTime(formData.phaseTimeStartStart, formData.phaseTimeStartEnd) || '');
      data.append('phaseTimeInProgress', formatDateTime(formData.phaseTimeInProgressStart, formData.phaseTimeInProgressEnd) || '');
      data.append('phaseTimeEnd', formatDateTime(formData.phaseTimeEndStart, formData.phaseTimeEndEnd) || '');
      
      data.append('organizerID', user.userID);
      if (file) data.append('file', file);
      if (paymentQRCode) data.append('paymentQRCode', paymentQRCode);

      await api.post('/activities', data);
      alert('活动申请已提交，请等待审核');
      setView('menu');
      // 重置表单
      setFormData({
        name: '', capacity: '', time: '', location: '', description: '', flow: '', requirements: '',
        phaseTimePreparation: '', phaseTimeStart: '', phaseTimeInProgress: '', phaseTimeEnd: '',
        phaseTimePreparationStart: '', phaseTimePreparationEnd: '',
        phaseTimeStartStart: '', phaseTimeStartEnd: '',
        phaseTimeInProgressStart: '', phaseTimeInProgressEnd: '',
        phaseTimeEndStart: '', phaseTimeEndEnd: '',
        hasFee: false, feeAmount: ''
      });
      setFile(null);
      setPaymentQRCode(null);
    } catch (err) {
      alert(err.response?.data?.error || '提交失败');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // 如果活动有费用但未上传支付截图，提示错误
      if (selectedActivity.hasFee && !paymentProof) {
        alert('该活动需要支付报名费，请上传支付截图');
        return;
      }
      
      const formData = new FormData();
      formData.append('activityID', selectedActivity.id);
      formData.append('userID', user.userID);
      formData.append('name', regForm.name);
      formData.append('class', regForm.class);
      formData.append('reason', regForm.reason);
      formData.append('contact', regForm.contact);
      if (paymentProof) {
        formData.append('paymentProof', paymentProof);
      }
      
      const API_BASE = process.env.REACT_APP_API_URL 
        ? `${process.env.REACT_APP_API_URL}/api`
        : 'http://localhost:5001/api';
      
      await axios.post(`${API_BASE}/activities/register`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('报名申请已提交，请等待组织者审核');
      setView('menu');
      // 重置表单
      setRegForm({
        name: user.name, class: user.class, reason: '', contact: ''
      });
      setPaymentProof(null);
      fetchActivities(); // 刷新活动列表以更新人数显示
    } catch (err) {
      alert(err.response?.data?.error || '报名失败');
    }
  };

  const updatePhase = async (actID, phase) => {
    try {
      await api.put(`/activities/${actID}/phase`, { phase });
      fetchActivities();
    } catch (err) {
      alert('更新状态失败');
    }
  };

  const fetchParticipants = async (activityId) => {
    try {
      const res = await api.get(`/activities/${activityId}/participants?userID=${user.userID}`);
      setParticipants(res.data);
      setView('participants');
    } catch (err) {
      alert(err.response?.data?.error || '获取参与者列表失败');
    }
  };

  const phases = ['活动准备', '活动开始', '活动中', '活动结束'];

  return (
    <div className="bg-white p-6 rounded shadow">
      {view === 'menu' && (
        <>
          <div className="flex flex-col gap-4 mb-8">
            <button onClick={() => setView('organize')} className="bg-orange-500 text-white p-4 rounded text-xl">1. 活动组织</button>
            <button onClick={() => setView('register')} className="bg-blue-500 text-white p-4 rounded text-xl">2. 活动报名</button>
          </div>
          
          {/* 显示所有活动列表 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-bold mb-4">所有活动列表</h3>
            {activities.length === 0 ? (
              <p className="text-center py-10 text-gray-400 italic">暂无活动</p>
            ) : (
              <div className="grid gap-4">
                {activities.map(act => (
                  <div 
                    key={act.id} 
                    className="border p-4 rounded flex flex-col gap-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                    onClick={() => {
                      setSelectedActivity(act);
                      setView('detail');
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-blue-600 hover:text-blue-800">{act.name}</h3>
                        <p className="text-sm text-gray-500">
                          {act.location}{act.time ? ' | ' + act.time : ''}
                          {act.organizerName && (
                            <span className="ml-2">组织者: {act.organizerName}{act.organizerEnglishName ? ` / ${act.organizerEnglishName}` : ''}{act.organizerClass ? ` (${act.organizerClass})` : ''}</span>
                          )}
                        </p>
                        {act.capacity && (
                          <p className="text-xs text-gray-500 mt-1">
                            人数: {act.currentRegCount || 0} / {act.capacity}
                          </p>
                        )}
                        {/* 显示付费信息 */}
                        {act.hasFee && (
                          <p className="text-xs text-orange-600 font-medium mt-1">
                            💰 报名费: {act.feeAmount || '未设置'}
                          </p>
                        )}
                      </div>
                      {act.organizerID === user.userID ? (
                        <span className="text-xs text-blue-500 font-bold">您是组织者</span>
                      ) : null}
                    </div>
                    
                    {/* 活动阶段显示 */}
                    <div className="relative pt-6 pb-2">
                      <div className="flex justify-between relative">
                        {/* 背景线条 */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2"></div>
                        {/* 高亮进度线条 */}
                        <div 
                          className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 transition-all duration-500" 
                          style={{ width: `${(phases.indexOf(act.currentPhase || '活动准备') / (phases.length - 1)) * 100}%` }}
                        ></div>
                        
                        {phases.map((p, idx) => (
                          <div key={p} className="flex flex-col items-center relative z-10">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              phases.indexOf(act.currentPhase || '活动准备') >= idx 
                              ? 'bg-blue-500 border-blue-500' 
                              : 'bg-white border-gray-300'
                            } ${(act.currentPhase || '活动准备') === p ? 'ring-4 ring-blue-100' : ''}`}></div>
                            <span className={`text-[10px] mt-2 font-medium ${(act.currentPhase || '活动准备') === p ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                              {p}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* 显示当前阶段时间信息 */}
                    {act.currentPhase === '活动准备' && act.phaseTimePreparation && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        准备时间: {act.phaseTimePreparation}
                      </div>
                    )}
                    {act.currentPhase === '活动开始' && act.phaseTimeStart && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        开始时间: {act.phaseTimeStart}
                      </div>
                    )}
                    {act.currentPhase === '活动中' && act.phaseTimeInProgress && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        进行时间: {act.phaseTimeInProgress}
                      </div>
                    )}
                    {act.currentPhase === '活动结束' && act.phaseTimeEnd && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        结束时间: {act.phaseTimeEnd}
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      <strong>简介:</strong> {act.description}
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          setSelectedActivity(act);
                          setView('regForm');
                        }}
                        disabled={act.capacity && act.currentRegCount >= act.capacity}
                        className={`text-xs px-4 py-2 rounded font-bold ${
                          act.capacity && act.currentRegCount >= act.capacity
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {act.capacity && act.currentRegCount >= act.capacity ? '人数已满' : '去报名'}
                      </button>
                      {/* 参与人员按钮 - 仅组织者和管理员可见 */}
                      {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchParticipants(act.id);
                          }}
                          className="bg-purple-600 text-white text-xs px-4 py-2 rounded font-bold hover:bg-purple-700"
                        >
                          参与人员
                        </button>
                      )}
                      {/* 下载Excel按钮 - 仅组织者和管理员可见 */}
                      {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement('a');
                            const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                            link.href = `${apiBase}/api/activities/${act.id}/export?userID=${user.userID}`;
                            link.click();
                          }}
                          className="bg-green-600 text-white text-xs px-4 py-2 rounded font-bold hover:bg-green-700"
                        >
                          下载参与者Excel
                        </button>
                      )}
                      {/* 删除按钮 - 仅组织者和管理员可见 */}
                      {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm('确定要删除此活动吗？所有参与者将自动解散。')) return;
                            try {
                              await api.delete(`/activities/${act.id}?userID=${user.userID}`);
                              alert('活动已删除');
                              fetchActivities();
                            } catch (err) {
                              alert(err.response?.data?.error || '删除失败');
                            }
                          }}
                          className="bg-red-600 text-white text-xs px-4 py-2 rounded font-bold hover:bg-red-700"
                        >
                          删除活动
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

      {view === 'organize' && (
        <form onSubmit={handleOrganize} className="grid gap-4">
          <h2 className="text-xl font-bold">组织活动</h2>
          <input placeholder="活动名称" className="border p-2 rounded" required onChange={e => setFormData({...formData, name: e.target.value})} />
          <input placeholder="人数" type="number" className="border p-2 rounded" required onChange={e => setFormData({...formData, capacity: e.target.value})} />
          <input placeholder="地点" className="border p-2 rounded" required onChange={e => setFormData({...formData, location: e.target.value})} />
          <textarea placeholder="简要描述" className="border p-2 rounded" required onChange={e => setFormData({...formData, description: e.target.value})} />
          <textarea placeholder="活动流程（不需要填写具体时间）" className="border p-2 rounded" required onChange={e => setFormData({...formData, flow: e.target.value})} />
          <textarea placeholder="活动需求" className="border p-2 rounded" required onChange={e => setFormData({...formData, requirements: e.target.value})} />
          
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-bold mb-3">活动阶段时间设置</h3>
            <p className="text-xs text-gray-500 mb-3">请选择每个阶段的开始和结束时间，系统会自动判断当前处于哪个阶段</p>
            <div className="grid gap-4">
              <div className="border p-3 rounded bg-blue-50">
                <label className="block text-sm font-medium mb-2">活动准备阶段</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">开始时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimePreparationStart: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">结束时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimePreparationEnd: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              <div className="border p-3 rounded bg-green-50">
                <label className="block text-sm font-medium mb-2">活动开始阶段</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">开始时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimeStartStart: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">结束时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimeStartEnd: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              <div className="border p-3 rounded bg-yellow-50">
                <label className="block text-sm font-medium mb-2">活动中阶段</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">开始时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimeInProgressStart: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">结束时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimeInProgressEnd: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
              <div className="border p-3 rounded bg-red-50">
                <label className="block text-sm font-medium mb-2">活动结束阶段</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">开始时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimeEndStart: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">结束时间</label>
                    <input 
                      type="datetime-local" 
                      className="border p-2 rounded w-full text-sm" 
                      onChange={e => setFormData({...formData, phaseTimeEndEnd: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 报名费功能 */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <input 
                type="checkbox" 
                id="hasFee"
                checked={formData.hasFee}
                onChange={(e) => setFormData({...formData, hasFee: e.target.checked})}
                className="w-4 h-4"
              />
              <label htmlFor="hasFee" className="text-lg font-bold cursor-pointer">报名费（可选）</label>
            </div>
            
            {formData.hasFee && (
              <div className="ml-6 grid gap-3 bg-yellow-50 p-4 rounded border border-yellow-200">
                <div>
                  <label className="block text-sm font-medium mb-1">费用金额</label>
                  <input 
                    type="text" 
                    placeholder="例如：50元 或 100元" 
                    className="border p-2 rounded w-full" 
                    value={formData.feeAmount}
                    onChange={e => setFormData({...formData, feeAmount: e.target.value})}
                    required={formData.hasFee}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    上传支付二维码 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">（微信/支付宝二维码）</span>
                  </label>
                  <input 
                    type="file" 
                    accept="image/*"
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all w-full" 
                    onChange={(e) => setPaymentQRCode(e.target.files[0])}
                    required={formData.hasFee}
                  />
                  {!paymentQRCode && formData.hasFee && (
                    <p className="text-xs text-red-500 mt-1">⚠️ 请上传支付二维码</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">上传活动附件 (可选)</label>
            <input type="file" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-all" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <button type="submit" className="bg-orange-600 text-white p-2 rounded">提交活动申请</button>
          <button onClick={() => setView('menu')} type="button" className="text-gray-500 underline text-center">返回</button>
        </form>
      )}

      {view === 'register' && (
        <div>
          <h2 className="text-xl font-bold mb-4">{t('activity.ongoing')}</h2>
          <div className="relative mb-6">
            <input
              type="text"
              placeholder={t('activity.searchActivity')}
              value={activitySearchQuery}
              onChange={e => setActivitySearchQuery(e.target.value)}
              onFocus={() => setActivitySearchFocused(true)}
              onBlur={() => setTimeout(() => setActivitySearchFocused(false), 200)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {activitySearchQuery.trim() && activitySearchFocused && (() => {
              const q = activitySearchQuery.trim().toLowerCase();
              const list = activities.filter(act => act.name && act.name.toLowerCase().includes(q));
              if (list.length === 0) return <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-2 text-sm text-gray-500 text-center">{t('activity.noMatch')}</div>;
              return (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                  {list.map(act => {
                    const full = act.capacity && act.currentRegCount >= act.capacity;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          if (full) return;
                          setSelectedActivity(act);
                          setView('regForm');
                          setActivitySearchQuery('');
                        }}
                        disabled={full}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 transition-colors flex justify-between items-center ${full ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50'}`}
                      >
                        <span className="font-bold text-gray-800"><TranslatableContent>{act.name}</TranslatableContent></span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{act.location}{act.time ? ` · ${act.time}` : ''}</span>
                        {full && <span className="text-xs text-red-600 font-medium">人数已满</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div className="grid gap-4">
            {activities.map(act => (
              <div key={act.id} className="border p-4 rounded flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{act.name}</h3>
                    <p className="text-sm text-gray-500">
                      {act.location}{act.time ? ' | ' + act.time : ''}
                      {act.organizerName && (
                        <span className="ml-2">组织者: {act.organizerName}{act.organizerEnglishName ? ` / ${act.organizerEnglishName}` : ''}{act.organizerClass ? ` (${act.organizerClass})` : ''}</span>
                      )}
                    </p>
                  </div>
                  {act.organizerID === user.userID ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-blue-500 font-bold">您是组织者</span>
                      <select 
                        className="text-xs border rounded p-1"
                        value={act.currentPhase}
                        onChange={(e) => updatePhase(act.id, e.target.value)}
                      >
                        {phases.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setSelectedActivity(act); setView('regForm'); }} 
                      disabled={act.capacity && act.currentRegCount >= act.capacity}
                      className={`px-4 py-2 rounded ${
                        act.capacity && act.currentRegCount >= act.capacity
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {act.capacity && act.currentRegCount >= act.capacity ? '人数已满' : '去报名'}
                    </button>
                  )}
                </div>

                {/* 时间轴可视化 */}
                <div className="relative pt-6 pb-2">
                  <div className="flex justify-between relative">
                    {/* 背景线条 */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2"></div>
                    {/* 高亮进度线条 */}
                    <div 
                      className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 transition-all duration-500" 
                      style={{ width: `${(phases.indexOf(act.currentPhase) / (phases.length - 1)) * 100}%` }}
                    ></div>
                    
                    {phases.map((p, idx) => (
                      <div key={p} className="flex flex-col items-center relative z-10">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          phases.indexOf(act.currentPhase) >= idx 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'bg-white border-gray-300'
                        } ${act.currentPhase === p ? 'ring-4 ring-blue-100' : ''}`}></div>
                        <span className={`text-[10px] mt-2 font-medium ${act.currentPhase === p ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <strong>简介:</strong> {act.description}
                </div>
                
                {/* 显示人数信息 */}
                {act.capacity && (
                  <div className="text-xs text-gray-500">
                    人数: {act.currentRegCount || 0} / {act.capacity}
                  </div>
                )}
                
                {/* 显示阶段时间信息 */}
                {act.currentPhase === '活动准备' && act.phaseTimePreparation && (
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                    准备时间: {act.phaseTimePreparation}
                  </div>
                )}
                {act.currentPhase === '活动开始' && act.phaseTimeStart && (
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                    开始时间: {act.phaseTimeStart}
                  </div>
                )}
                {act.currentPhase === '活动中' && act.phaseTimeInProgress && (
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                    进行时间: {act.phaseTimeInProgress}
                  </div>
                )}
                {act.currentPhase === '活动结束' && act.phaseTimeEnd && (
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                    结束时间: {act.phaseTimeEnd}
                  </div>
                )}
                
                {/* 参与人员按钮 - 仅组织者和管理员可见 */}
                {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <button 
                    onClick={() => fetchParticipants(act.id)}
                    className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded font-bold mt-2 ml-2 hover:bg-purple-700"
                  >
                    参与人员
                  </button>
                )}
                {/* 删除按钮 - 仅组织者和管理员可见 */}
                {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <button 
                    onClick={async () => {
                      if (!window.confirm('确定要删除此活动吗？所有参与者将自动解散。')) return;
                      try {
                        await api.delete(`/activities/${act.id}?userID=${user.userID}`);
                        alert('活动已删除');
                        fetchActivities();
                      } catch (err) {
                        alert(err.response?.data?.error || '删除失败');
                      }
                    }}
                    className="bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold mt-2 ml-2"
                  >
                    删除活动
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setView('menu')} className="mt-4 text-gray-500 underline">返回</button>
        </div>
      )}

      {view === 'regForm' && selectedActivity && (
        <form onSubmit={handleRegister} className="grid gap-4">
          <h2 className="text-xl font-bold">活动报名: {selectedActivity.name}</h2>
          <input placeholder="姓名" value={regForm.name} className="border p-2 rounded bg-gray-100" readOnly />
          <input placeholder="班级" value={regForm.class} className="border p-2 rounded bg-gray-100" readOnly />
          <textarea placeholder="申请原因" className="border p-2 rounded" required onChange={e => setRegForm({...regForm, reason: e.target.value})} />
          <input placeholder="联系方式" className="border p-2 rounded" required onChange={e => setRegForm({...regForm, contact: e.target.value})} />
          
          {/* 显示支付信息 */}
          {selectedActivity.hasFee && (
            <div className="border-2 border-yellow-400 bg-yellow-50 p-4 rounded">
              <h3 className="font-bold text-lg mb-2 text-yellow-800">💰 报名费信息</h3>
              <p className="text-yellow-700 mb-3">
                <strong>费用金额：</strong>{selectedActivity.feeAmount || '未设置'}
              </p>
              {selectedActivity.paymentQRCode && (
                <div className="mb-4">
                  <p className="text-yellow-700 mb-2 font-medium">请扫描下方二维码完成支付：</p>
                  <div className="flex justify-center mb-2">
                    <img 
                      src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${selectedActivity.paymentQRCode}`}
                      alt="支付二维码"
                      className="max-w-xs border-2 border-yellow-300 rounded"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                </div>
              )}
              
              {/* 上传支付截图 */}
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2 text-yellow-800">
                  付款截图 <span className="text-red-500">*</span>
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all w-full" 
                  onChange={(e) => setPaymentProof(e.target.files[0])}
                  required={selectedActivity.hasFee}
                />
                {!paymentProof && selectedActivity.hasFee && (
                  <p className="text-xs text-red-500 mt-1">⚠️ 请上传支付截图</p>
                )}
                {paymentProof && (
                  <p className="text-xs text-green-600 mt-1">✅ 已选择文件: {paymentProof.name}</p>
                )}
              </div>
            </div>
          )}
          
          <button type="submit" className="bg-blue-600 text-white p-2 rounded">提交报名</button>
          <button onClick={() => setView('register')} type="button" className="text-gray-500 underline text-center">返回</button>
        </form>
      )}

      {view === 'detail' && selectedActivity && (
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">活动详情 - {selectedActivity.name}</h2>
            <button 
              onClick={() => setView('menu')} 
              className="text-gray-500 underline text-sm"
            >
              返回
            </button>
          </div>
          
          <div className="border p-4 rounded bg-white">
            <div className="grid gap-4">
              <div>
                <h3 className="font-bold text-lg mb-2">{selectedActivity.name}</h3>
                <p className="text-sm text-gray-600">
                  <strong>地点：</strong>{selectedActivity.location}
                </p>
                {selectedActivity.time && (
                  <p className="text-sm text-gray-600">
                    <strong>时间：</strong>{selectedActivity.time}
                  </p>
                )}
                {selectedActivity.organizerName && (
                  <p className="text-sm text-gray-600">
                    <strong>组织者：</strong>{selectedActivity.organizerName}{selectedActivity.organizerEnglishName ? ` / ${selectedActivity.organizerEnglishName}` : ''}{selectedActivity.organizerClass ? ` (${selectedActivity.organizerClass})` : ''}
                  </p>
                )}
                {selectedActivity.capacity && (
                  <p className="text-sm text-gray-600">
                    <strong>人数：</strong>{selectedActivity.currentRegCount || 0} / {selectedActivity.capacity}
                  </p>
                )}
                {selectedActivity.hasFee && (
                  <p className="text-sm text-orange-600 font-medium">
                    <strong>💰 报名费：</strong>{selectedActivity.feeAmount || '未设置'}
                  </p>
                )}
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">活动简介</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.description}</p>
              </div>
              
              {selectedActivity.flow && (
                <div className="border-t pt-4">
                  <h4 className="font-bold mb-2">活动流程</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.flow}</p>
                </div>
              )}
              
              {selectedActivity.requirements && (
                <div className="border-t pt-4">
                  <h4 className="font-bold mb-2">活动需求</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.requirements}</p>
                </div>
              )}
              
              {/* 活动阶段显示 */}
              <div className="border-t pt-4">
                <h4 className="font-bold mb-3">活动进度</h4>
                <div className="relative pt-6 pb-2">
                  <div className="flex justify-between relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2"></div>
                    <div 
                      className="absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 transition-all duration-500" 
                      style={{ width: `${(phases.indexOf(selectedActivity.currentPhase || '活动准备') / (phases.length - 1)) * 100}%` }}
                    ></div>
                    
                    {phases.map((p, idx) => (
                      <div key={p} className="flex flex-col items-center relative z-10">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          phases.indexOf(selectedActivity.currentPhase || '活动准备') >= idx 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'bg-white border-gray-300'
                        } ${(selectedActivity.currentPhase || '活动准备') === p ? 'ring-4 ring-blue-100' : ''}`}></div>
                        <span className={`text-[10px] mt-2 font-medium ${(selectedActivity.currentPhase || '活动准备') === p ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 显示当前阶段时间信息 */}
                <div className="mt-4 space-y-2">
                  {selectedActivity.currentPhase === '活动准备' && selectedActivity.phaseTimePreparation && (
                    <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                      准备时间: {selectedActivity.phaseTimePreparation}
                    </div>
                  )}
                  {selectedActivity.currentPhase === '活动开始' && selectedActivity.phaseTimeStart && (
                    <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                      开始时间: {selectedActivity.phaseTimeStart}
                    </div>
                  )}
                  {selectedActivity.currentPhase === '活动中' && selectedActivity.phaseTimeInProgress && (
                    <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                      进行时间: {selectedActivity.phaseTimeInProgress}
                    </div>
                  )}
                  {selectedActivity.currentPhase === '活动结束' && selectedActivity.phaseTimeEnd && (
                    <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                      结束时间: {selectedActivity.phaseTimeEnd}
                    </div>
                  )}
                  
                  {/* 显示所有阶段时间 */}
                  <div className="text-xs text-gray-600 space-y-1 mt-3">
                    {selectedActivity.phaseTimePreparation && (
                      <p>准备阶段: {selectedActivity.phaseTimePreparation}</p>
                    )}
                    {selectedActivity.phaseTimeStart && (
                      <p>开始阶段: {selectedActivity.phaseTimeStart}</p>
                    )}
                    {selectedActivity.phaseTimeInProgress && (
                      <p>进行阶段: {selectedActivity.phaseTimeInProgress}</p>
                    )}
                    {selectedActivity.phaseTimeEnd && (
                      <p>结束阶段: {selectedActivity.phaseTimeEnd}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4 flex gap-2">
                {selectedActivity.organizerID !== user.userID && (
                  <button 
                    onClick={() => {
                      setView('regForm');
                    }}
                    disabled={selectedActivity.capacity && selectedActivity.currentRegCount >= selectedActivity.capacity}
                    className={`px-4 py-2 rounded font-bold ${
                      selectedActivity.capacity && selectedActivity.currentRegCount >= selectedActivity.capacity
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {selectedActivity.capacity && selectedActivity.currentRegCount >= selectedActivity.capacity ? '人数已满' : '去报名'}
                  </button>
                )}
                {(selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <>
                    <button 
                      onClick={() => fetchParticipants(selectedActivity.id)}
                      className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700"
                    >
                      参与人员
                    </button>
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001';
                        link.href = `${apiBase}/api/activities/${selectedActivity.id}/export?userID=${user.userID}`;
                        link.click();
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700"
                    >
                      下载参与者Excel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'participants' && participants && (
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">参与人员 - {participants.activityName}</h2>
            <button 
              onClick={() => setView('menu')} 
              className="text-gray-500 underline text-sm"
            >
              返回
            </button>
          </div>
          
          {participants.participants.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic">
              <p>暂无参与者</p>
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
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">联系方式</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">申请原因</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">支付凭证</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {participants.participants.map((p) => (
                    <tr key={p.userID} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">{p.index}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {p.name}
                        {p.englishName && ` / ${p.englishName}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.class}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{p.userID}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.contact || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.reason || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {p.paymentProof ? (
                          <button
                            onClick={() => {
                              const imgUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${p.paymentProof}`;
                              window.open(imgUrl, '_blank');
                            }}
                            className="text-blue-600 hover:text-blue-800 underline text-xs"
                          >
                            查看截图
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="text-sm text-gray-500 text-center">
            共 {participants.participants.length} 位参与者
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityMatters;


