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
    hasFee: false, feeAmount: '',
    isPerformance: false
  });
  const [showSeatEditor, setShowSeatEditor] = useState(false);
  const [seatEditorZones, setSeatEditorZones] = useState([]);
  const [seatEditorRows, setSeatEditorRows] = useState([]);
  const [seatMapData, setSeatMapData] = useState(null);
  const [perfBookLoading, setPerfBookLoading] = useState(false);
  const [perfConfirmSeat, setPerfConfirmSeat] = useState(null);
  const [perfPaymentFile, setPerfPaymentFile] = useState(null);
  const [file, setFile] = useState(null);
  const [paymentQRCode, setPaymentQRCode] = useState(null);
  const [regForm, setRegForm] = useState({
    name: user.name, class: user.class, reason: '', contact: ''
  });
  const [paymentProof, setPaymentProof] = useState(null);
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const [activitySearchFocused, setActivitySearchFocused] = useState(false);
  const [editingActivity, setEditingActivity] = useState(false);
  const [editActivityForm, setEditActivityForm] = useState({ name: '', capacity: '', time: '', location: '', description: '', flow: '', requirements: '', hasFee: false, feeAmount: '' });

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

  const loadSeatState = async (act) => {
    if (!act?.id) return;
    setPerfBookLoading(true);
    setSeatMapData(null);
    try {
      const res = await api.get(`/activities/${act.id}/seat-state?userID=${encodeURIComponent(user.userID)}`);
      setSeatMapData(res.data);
    } catch (e) {
      alert(e.response?.data?.error || '加载座位失败');
      setSeatMapData(null);
    } finally {
      setPerfBookLoading(false);
    }
  };

  const openPerformanceBook = (act) => {
    setSelectedActivity(act);
    setView('performanceBook');
    setPerfConfirmSeat(null);
    setPerfPaymentFile(null);
    loadSeatState(act);
  };

  /** 组织者/管理员编辑座位图（列表与详情共用） */
  const openSeatEditorForActivity = (act) => {
    if (!act?.id) return;
    const lay = act.seatLayout;
    const zones = Array.isArray(lay?.zones) && lay.zones.length
      ? lay.zones.map(z => ({ ...z }))
      : [{ id: `z_${Date.now()}`, name: '一楼', price: 5 }];
    const zid = zones[0].id;
    const rows = Array.isArray(lay?.rows) && lay.rows.length
      ? lay.rows.map(r => ({ ...r, zoneId: r.zoneId || zid }))
      : [{ zoneId: zid, rowLabel: '1', seatCount: 10 }];
    setSelectedActivity(act);
    setSeatEditorZones(zones);
    setSeatEditorRows(rows);
    setShowSeatEditor(true);
  };

  const saveSeatLayout = async () => {
    if (!selectedActivity?.id) return;
    const zones = seatEditorZones
      .filter(z => z.name && String(z.name).trim())
      .map(z => ({ ...z, name: String(z.name).trim(), price: Number(z.price) || 0 }));
    const rows = seatEditorRows
      .filter(r => r.zoneId && r.rowLabel && (parseInt(r.seatCount, 10) || 0) > 0)
      .map(r => ({ zoneId: r.zoneId, rowLabel: String(r.rowLabel).trim(), seatCount: parseInt(r.seatCount, 10) || 0 }));
    if (zones.length === 0 || rows.length === 0) {
      alert('请至少添加一个区域和一行座位');
      return;
    }
    try {
      await api.put(`/activities/${selectedActivity.id}/seat-layout`, {
        userID: user.userID,
        seatLayout: { zones, rows }
      });
      alert('座位已保存');
      setShowSeatEditor(false);
      await fetchActivities();
      const updated = (await api.get('/activities/approved')).data?.find(a => a.id === selectedActivity.id);
      if (updated) setSelectedActivity({ ...selectedActivity, ...updated });
    } catch (e) {
      alert(e.response?.data?.error || '保存失败');
    }
  };

  const submitPerformanceReserve = async () => {
    if (!perfConfirmSeat || !selectedActivity?.id) return;
    const needPay = selectedActivity.hasFee || (Number(perfConfirmSeat.price) > 0);
    if (needPay && !perfPaymentFile) {
      alert('请先上传付款截图');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('userID', user.userID);
      fd.append('operatorID', user.userID);
      fd.append('seatKey', perfConfirmSeat.seatKey);
      if (perfPaymentFile) fd.append('paymentProof', perfPaymentFile);
      const API_BASE = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : 'http://localhost:5001/api';
      await axios.post(`${API_BASE}/activities/${selectedActivity.id}/seat-reserve`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert('选座申请已提交，请等待组织者确认收款');
      setPerfConfirmSeat(null);
      setPerfPaymentFile(null);
      await loadSeatState(selectedActivity);
      fetchActivities();
    } catch (e) {
      alert(e.response?.data?.error || '提交失败');
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
      data.append('operatorID', user.userID);
      data.append('isPerformance', String(!!formData.isPerformance));
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
        hasFee: false, feeAmount: '',
        isPerformance: false
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
      formData.append('operatorID', user.userID);
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

  const handleUpdateActivity = async () => {
    if (!selectedActivity?.id) return;
    try {
      const res = await api.put(`/activities/${selectedActivity.id}/update-info`, {
        userID: user.userID,
        name: editActivityForm.name,
        capacity: editActivityForm.capacity === '' ? null : editActivityForm.capacity,
        time: editActivityForm.time,
        location: editActivityForm.location,
        description: editActivityForm.description,
        flow: editActivityForm.flow,
        requirements: editActivityForm.requirements,
        hasFee: editActivityForm.hasFee,
        feeAmount: editActivityForm.feeAmount
      });
      setEditingActivity(false);
      const updated = res.data?.activity;
      if (updated) setSelectedActivity({ ...selectedActivity, ...updated, currentRegCount: selectedActivity.currentRegCount });
      fetchActivities();
      alert('更新成功');
    } catch (err) {
      alert(err.response?.data?.error || '更新失败');
    }
  };

  const phases = ['活动准备', '活动开始', '活动中', '活动结束'];
  const phaseDisplay = (p) => ({ '活动准备': t('activity.phasePrep'), '活动开始': t('activity.phaseStart'), '活动中': t('activity.phaseInProgress'), '活动结束': t('activity.phaseEnd') }[p] || p);

  return (
    <div className="bg-white p-6 rounded shadow">
      {view === 'menu' && (
        <>
          <div className="flex flex-col gap-4 mb-8">
            <button onClick={() => setView('organize')} className="bg-orange-500 text-white p-4 rounded text-xl">{t('activity.organizeBtn')}</button>
            <button onClick={() => setView('register')} className="bg-blue-500 text-white p-4 rounded text-xl">{t('activity.registerBtn')}</button>
          </div>
          
          {/* 显示所有活动列表 */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-bold mb-4">{t('activity.allActivitiesList')}</h3>
            {activities.length === 0 ? (
              <p className="text-center py-10 text-gray-400 italic">{t('activity.noActivities')}</p>
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
                            <span className="ml-2">{t('activity.organizer')}: {act.organizerName}{act.organizerEnglishName ? ` / ${act.organizerEnglishName}` : ''}{act.organizerClass ? ` (${act.organizerClass})` : ''}</span>
                          )}
                        </p>
                        {act.isPerformance && act.totalSeatCount > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            已确认座位: {act.currentRegCount || 0} / {act.totalSeatCount}
                          </p>
                        )}
                        {!act.isPerformance && act.capacity && (
                          <p className="text-xs text-gray-500 mt-1">
                            {t('common.capacity')}: {act.currentRegCount || 0} / {act.capacity}
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
                        <span className="text-xs text-blue-500 font-bold">{t('activity.youAreOrganizer')}</span>
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
                              {phaseDisplay(p)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* 显示当前阶段时间信息 */}
                    {act.currentPhase === '活动准备' && act.phaseTimePreparation && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        {t('activity.prepTime')}: {act.phaseTimePreparation}
                      </div>
                    )}
                    {act.currentPhase === '活动开始' && act.phaseTimeStart && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        {t('activity.startTime')}: {act.phaseTimeStart}
                      </div>
                    )}
                    {act.currentPhase === '活动中' && act.phaseTimeInProgress && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        {t('activity.inProgressTime')}: {act.phaseTimeInProgress}
                      </div>
                    )}
                    {act.currentPhase === '活动结束' && act.phaseTimeEnd && (
                      <div className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                        {t('activity.endTime')}: {act.phaseTimeEnd}
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      <strong>{t('activity.description')}:</strong> {act.description}
                    </div>
                    <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {act.isPerformance && (act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                        <button
                          type="button"
                          onClick={() => openSeatEditorForActivity(act)}
                          className="text-xs px-4 py-2 rounded font-bold bg-amber-600 text-white hover:bg-amber-700"
                        >
                          编辑演出座位
                        </button>
                      )}
                      {act.isPerformance && !(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                        <span
                          className="text-[10px] text-amber-900 border border-dashed border-amber-400 bg-amber-50 px-2 py-1 rounded font-medium self-center"
                          title="本活动为演出，请使用右侧「选座报名」"
                        >
                          演出 · 选座
                        </span>
                      )}
                      <button 
                        onClick={() => {
                          if (act.isPerformance) openPerformanceBook(act);
                          else { setSelectedActivity(act); setView('regForm'); }
                        }}
                        disabled={
                          act.isPerformance
                            ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                            : !!(act.capacity && act.currentRegCount >= act.capacity)
                        }
                        className={`text-xs px-4 py-2 rounded font-bold ${
                          (act.isPerformance
                            ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                            : (act.capacity && act.currentRegCount >= act.capacity))
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {(act.isPerformance
                          ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                          : (act.capacity && act.currentRegCount >= act.capacity))
                          ? t('common.full')
                          : (act.isPerformance ? '选座报名' : t('activity.register'))}
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
                          {t('activity.participants')}
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
                          {t('activity.downloadParticipantsExcel')}
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
                          {t('activity.deleteActivity')}
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
          
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <input 
                type="checkbox" 
                id="isPerformance"
                checked={formData.isPerformance}
                onChange={(e) => setFormData({ ...formData, isPerformance: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="isPerformance" className="text-lg font-bold cursor-pointer">本活动为演出（参与者选座购票）</label>
            </div>
            <p className="text-xs text-gray-500 mb-3 ml-7">开启后活动审核通过，请在「活动详情」中编辑座位区域、排数、座位数与分区票价。若分区票价或全局报名费需线上收款，请勾选下方报名费并上传收款码。</p>
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
                    const full = act.isPerformance
                      ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                      : !!(act.capacity && act.currentRegCount >= act.capacity);
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => {
                          if (full) return;
                          if (act.isPerformance) openPerformanceBook(act);
                          else { setSelectedActivity(act); setView('regForm'); }
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
                        {phases.map(p => <option key={p} value={p}>{phaseDisplay(p)}</option>)}
                      </select>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        if (act.isPerformance) openPerformanceBook(act);
                        else { setSelectedActivity(act); setView('regForm'); }
                      }} 
                      disabled={
                        act.isPerformance
                          ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                          : !!(act.capacity && act.currentRegCount >= act.capacity)
                      }
                      className={`px-4 py-2 rounded ${
                        (act.isPerformance
                          ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                          : (act.capacity && act.currentRegCount >= act.capacity))
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {(act.isPerformance
                        ? (act.totalSeatCount > 0 && act.currentRegCount >= act.totalSeatCount)
                        : (act.capacity && act.currentRegCount >= act.capacity))
                        ? '人数已满' : (act.isPerformance ? '选座报名' : '去报名')}
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

      {view === 'performanceBook' && selectedActivity && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-bold">选座 · {selectedActivity.name}</h2>
            <button type="button" onClick={() => { setView('menu'); setSeatMapData(null); setPerfConfirmSeat(null); }} className="text-gray-500 underline text-sm">返回列表</button>
          </div>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            每位用户仅限选择一个座位；提交后不可再选其他座（待审或已确认均算已占用）。
          </p>
          {seatMapData?.myReservation && (
            <p className="text-sm text-gray-800">
              您当前选座：
              <span className="font-bold">
                {' '}
                {seatMapData.myReservation.zoneName} {seatMapData.myReservation.rowLabel}排 {seatMapData.myReservation.seatLabel}号
              </span>
              {seatMapData.myReservation.status === 'pending' ? '（审核中）' : '（已确认）'}
            </p>
          )}
          <p className="text-xs text-gray-600">绿色：可选｜橙色：他人待审｜深黄：我的待审｜蓝色：我已确认｜灰色：已售</p>
          {perfBookLoading && <p className="text-gray-500">加载座位中…</p>}
          {seatMapData && !perfBookLoading && (
            <div className="space-y-6 border rounded-xl p-4 bg-gray-50">
              {seatMapData.zones.map(zone => (
                <div key={zone.id}>
                  <h4 className="font-bold text-gray-800 mb-2">{zone.name} · ¥{zone.price}</h4>
                  {seatMapData.rows.filter(r => r.zoneId === zone.id).map(row => (
                    <div key={`${zone.id}_${row.rowLabel}`} className="flex flex-wrap items-center gap-1 mb-2">
                      <span className="text-xs text-gray-500 w-14 shrink-0">{row.rowLabel}排</span>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: row.seatCount }, (_, i) => {
                          const num = i + 1;
                          const seatKey = `${zone.id}||${row.rowLabel}||${String(num)}`;
                          const st = seatMapData.seats[seatKey];
                          const state = st?.state || 'available';
                          const label = state === 'available' ? String(num)
                            : state === 'held' ? '占'
                            : state === 'pending_mine' ? '审'
                            : state === 'confirmed_mine' ? '✓'
                            : '—';
                          const cls =
                            state === 'available' ? 'bg-green-200 text-green-900 hover:bg-green-300'
                            : state === 'held' ? 'bg-orange-200 text-orange-900 cursor-not-allowed'
                            : state === 'pending_mine' ? 'bg-yellow-300 text-yellow-900'
                            : state === 'confirmed_mine' ? 'bg-blue-400 text-white'
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed';
                          return (
                            <button
                              key={seatKey}
                              type="button"
                              disabled={state !== 'available'}
                              title={`${zone.name} ${row.rowLabel}-${num} ¥${st?.price != null ? st.price : zone.price}`}
                              onClick={() => {
                                if (state !== 'available') return;
                                setPerfConfirmSeat({ seatKey, price: st?.price != null ? st.price : zone.price, zoneName: zone.name, rowLabel: row.rowLabel, seatLabel: String(num) });
                                setPerfPaymentFile(null);
                              }}
                              className={`w-8 h-8 text-[10px] rounded font-bold ${cls}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {perfConfirmSeat && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
                <h3 className="font-bold text-lg">确认选座</h3>
                <p className="text-sm">座位：{perfConfirmSeat.zoneName} {perfConfirmSeat.rowLabel}排 {perfConfirmSeat.seatLabel}号</p>
                <p className="text-sm">金额：¥{perfConfirmSeat.price}</p>
                {(selectedActivity.hasFee || Number(perfConfirmSeat.price) > 0) && seatMapData?.paymentQRCode && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">请扫码支付后上传截图</p>
                    <img src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${seatMapData.paymentQRCode}`} alt="qr" className="max-w-[200px] border rounded mx-auto" />
                  </div>
                )}
                {(selectedActivity.hasFee || Number(perfConfirmSeat.price) > 0) && (
                  <input type="file" accept="image/*" onChange={e => setPerfPaymentFile(e.target.files?.[0] || null)} className="text-sm w-full" />
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" className="px-4 py-2 rounded-lg bg-gray-200" onClick={() => setPerfConfirmSeat(null)}>取消</button>
                  <button type="button" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold" onClick={submitPerformanceReserve}>提交申请</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'regForm' && selectedActivity && !selectedActivity.isPerformance && (
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
            <div className="flex items-center gap-2">
              {(selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && !editingActivity && (
                <button
                  onClick={() => {
                    setEditingActivity(true);
                    setEditActivityForm({
                      name: selectedActivity.name || '',
                      capacity: selectedActivity.capacity != null ? String(selectedActivity.capacity) : '',
                      time: selectedActivity.time || '',
                      location: selectedActivity.location || '',
                      description: selectedActivity.description || '',
                      flow: selectedActivity.flow || '',
                      requirements: selectedActivity.requirements || '',
                      hasFee: selectedActivity.hasFee || false,
                      feeAmount: selectedActivity.feeAmount || ''
                    });
                  }}
                  className="text-blue-600 text-sm font-bold hover:underline"
                >
                  编辑
                </button>
              )}
              <button 
                onClick={() => setView('menu')} 
                className="text-gray-500 underline text-sm"
              >
                返回
              </button>
            </div>
          </div>
          
          <div className="border p-4 rounded bg-white">
            <div className="grid gap-4">
              {!editingActivity ? (
                <>
              <div>
                <h3 className="font-bold text-lg mb-2">{selectedActivity.name}</h3>
                {selectedActivity.isPerformance && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 inline-block px-2 py-1 rounded mb-2">演出 · 选座</p>
                )}
                {selectedActivity.isPerformance && selectedActivity.totalSeatCount > 0 && (
                  <p className="text-sm text-gray-600 mb-1">已确认座位：{selectedActivity.currentRegCount || 0} / {selectedActivity.totalSeatCount}</p>
                )}
                <p className="text-sm text-gray-600">
                  <strong>地点：</strong>{selectedActivity.location || '（未填写）'}
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
                {(selectedActivity.capacity != null || selectedActivity.currentRegCount != null) && (
                  <p className="text-sm text-gray-600">
                    <strong>人数：</strong>{selectedActivity.currentRegCount || 0} / {selectedActivity.capacity ?? '（不限制）'}
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
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.description || '（未填写）'}</p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">活动流程</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.flow || '（未填写）'}</p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">活动需求</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.requirements || '（未填写）'}</p>
              </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">活动名称</label>
                    <input value={editActivityForm.name} onChange={e => setEditActivityForm({ ...editActivityForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">地点</label>
                    <input value={editActivityForm.location} onChange={e => setEditActivityForm({ ...editActivityForm, location: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">时间</label>
                    <input value={editActivityForm.time} onChange={e => setEditActivityForm({ ...editActivityForm, time: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">人数上限（留空表示不限制）</label>
                    <input type="number" min="0" value={editActivityForm.capacity} onChange={e => setEditActivityForm({ ...editActivityForm, capacity: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">活动简介</label>
                    <textarea value={editActivityForm.description} onChange={e => setEditActivityForm({ ...editActivityForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" rows={4} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">活动流程</label>
                    <textarea value={editActivityForm.flow} onChange={e => setEditActivityForm({ ...editActivityForm, flow: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" rows={4} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">活动需求</label>
                    <textarea value={editActivityForm.requirements} onChange={e => setEditActivityForm({ ...editActivityForm, requirements: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" rows={4} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editActivityForm.hasFee} onChange={e => setEditActivityForm({ ...editActivityForm, hasFee: e.target.checked })} className="rounded" />
                      <span className="text-sm">收取报名费</span>
                    </label>
                  </div>
                  {editActivityForm.hasFee && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">报名费金额</label>
                      <input value={editActivityForm.feeAmount} onChange={e => setEditActivityForm({ ...editActivityForm, feeAmount: e.target.value })} placeholder="如：50元" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleUpdateActivity} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">保存</button>
                    <button onClick={() => setEditingActivity(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300">取消</button>
                  </div>
                </div>
              )}

              {!editingActivity && (
              <>
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
                      if (selectedActivity.isPerformance) openPerformanceBook(selectedActivity);
                      else setView('regForm');
                    }}
                    disabled={
                      selectedActivity.isPerformance
                        ? (selectedActivity.totalSeatCount > 0 && selectedActivity.currentRegCount >= selectedActivity.totalSeatCount)
                        : !!(selectedActivity.capacity && selectedActivity.currentRegCount >= selectedActivity.capacity)
                    }
                    className={`px-4 py-2 rounded font-bold ${
                      (selectedActivity.isPerformance
                        ? (selectedActivity.totalSeatCount > 0 && selectedActivity.currentRegCount >= selectedActivity.totalSeatCount)
                        : (selectedActivity.capacity && selectedActivity.currentRegCount >= selectedActivity.capacity))
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {(selectedActivity.isPerformance
                      ? (selectedActivity.totalSeatCount > 0 && selectedActivity.currentRegCount >= selectedActivity.totalSeatCount)
                      : (selectedActivity.capacity && selectedActivity.currentRegCount >= selectedActivity.capacity))
                      ? '人数已满' : (selectedActivity.isPerformance ? '选座报名' : '去报名')}
                  </button>
                )}
                {(selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && selectedActivity.isPerformance && (
                  <button
                    type="button"
                    onClick={() => openSeatEditorForActivity(selectedActivity)}
                    className="bg-amber-600 text-white px-4 py-2 rounded font-bold hover:bg-amber-700 text-sm"
                  >
                    编辑演出座位
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
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSeatEditor && selectedActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4 my-8">
            <h3 className="font-bold text-lg">编辑演出座位 · {selectedActivity.name}</h3>
            <div className="text-xs text-gray-700 space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50 leading-relaxed">
              <p className="font-semibold text-gray-800">怎么用（按顺序填）：</p>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>
                  <strong>分区</strong>：先列出场地里的区域（如一楼、二楼）。每行填「区名」和「票价」——表示<strong>该区域内每个座位</strong>的价格（元）；票价为 0 即免费区。
                </li>
                <li>
                  <strong>排 · 座位数</strong>：用「+ 一排」增加一行，表示<strong>一排座位</strong>。每行从左到右：先选这排属于哪个分区，再填<strong>排号</strong>（会在选座图上显示，如 1、10、A），最后填<strong>这一排有几个座位</strong>。需要多排就多加几行。
                </li>
                <li>
                  <strong>总座位数</strong>＝下面每一排「座位数」相加。点「保存座位图」后，系统会把活动<strong>人数上限</strong>改成这个总数（与可售票数一致）。
                </li>
              </ol>
            </div>
            <div className="space-y-2 border rounded-lg p-3 bg-amber-50/50">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">分区</span>
                <button type="button" className="text-xs text-blue-600 font-bold" onClick={() => setSeatEditorZones(z => [...z, { id: `z_${Date.now()}`, name: '新区', price: 0 }])}>+ 分区</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center text-[10px] text-gray-500 font-medium pl-0.5">
                <span className="flex-1 min-w-[100px]">分区名称</span>
                <span className="w-24">单价（元/座）</span>
              </div>
              {seatEditorZones.map((z, zi) => (
                <div key={z.id || zi} className="flex flex-wrap gap-2 items-center">
                  <input className="border rounded px-2 py-1 text-sm flex-1 min-w-[100px]" placeholder="区名 如一楼" value={z.name} onChange={e => setSeatEditorZones(list => list.map((x, i) => i === zi ? { ...x, name: e.target.value } : x))} />
                  <input type="number" min="0" className="border rounded px-2 py-1 w-24 text-sm" placeholder="票价" value={z.price} onChange={e => setSeatEditorZones(list => list.map((x, i) => i === zi ? { ...x, price: e.target.value } : x))} />
                </div>
              ))}
            </div>
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">排 · 座位数</span>
                <button type="button" className="text-xs text-blue-600 font-bold" onClick={() => {
                  const zid = seatEditorZones[0]?.id || '';
                  setSeatEditorRows(r => [...r, { zoneId: zid, rowLabel: String(r.length + 1), seatCount: 8 }]);
                }}>+ 一排</button>
              </div>
              <div className="flex flex-wrap gap-2 items-center text-[10px] text-gray-500 font-medium pl-0.5">
                <span className="min-w-[5.5rem]">所属分区</span>
                <span className="w-20">排号</span>
                <span className="w-20">本排座位数</span>
              </div>
              {seatEditorRows.map((row, ri) => (
                <div key={ri} className="flex flex-wrap gap-2 items-center">
                  <select className="border rounded px-2 py-1 text-sm min-w-[5.5rem]" title="这排属于哪个分区（票价沿用该分区）" value={row.zoneId} onChange={e => setSeatEditorRows(list => list.map((x, i) => i === ri ? { ...x, zoneId: e.target.value } : x))}>
                    {seatEditorZones.map(z => <option key={z.id} value={z.id}>{z.name || z.id}</option>)}
                  </select>
                  <input className="border rounded px-2 py-1 w-20 text-sm" placeholder="如 1、A" title="选座图上这一排的标识" value={row.rowLabel} onChange={e => setSeatEditorRows(list => list.map((x, i) => i === ri ? { ...x, rowLabel: e.target.value } : x))} />
                  <input type="number" min="1" className="border rounded px-2 py-1 w-20 text-sm" placeholder="几座" title="这一排连续有多少个座位" value={row.seatCount} onChange={e => setSeatEditorRows(list => list.map((x, i) => i === ri ? { ...x, seatCount: e.target.value } : x))} />
                  <button type="button" className="text-red-500 text-xs shrink-0" onClick={() => setSeatEditorRows(list => list.filter((_, i) => i !== ri))}>删</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end flex-wrap">
              <button type="button" className="px-4 py-2 rounded-lg bg-gray-200" onClick={() => setShowSeatEditor(false)}>关闭</button>
              <button type="button" className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold" onClick={saveSeatLayout}>保存座位图</button>
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


