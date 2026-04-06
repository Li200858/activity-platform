import React, { useState, useEffect } from 'react';
import { api, downloadExport } from '../utils/api';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import { TranslatableContent } from '../components/TranslatableContent';

/** 与 server buildSeatCatalog 一致，用于编辑页本地预览 */
function buildSeatCatalogClient(layout) {
  if (!layout || !Array.isArray(layout.zones) || !Array.isArray(layout.rows)) return [];
  const zoneMap = new Map(layout.zones.map((z) => [z.id, z]));
  const out = [];
  for (const row of layout.rows) {
    const z = zoneMap.get(row.zoneId);
    if (!z) continue;
    const cnt = Math.max(0, parseInt(row.seatCount, 10) || 0);
    for (let i = 1; i <= cnt; i++) {
      const seatLabel = String(i);
      const seatKey = `${row.zoneId}||${row.rowLabel}||${seatLabel}`;
      out.push({
        seatKey,
        zoneId: row.zoneId,
        zoneName: z.name || '',
        rowLabel: row.rowLabel,
        seatLabel,
        price: Number(z.price) || 0
      });
    }
  }
  return out;
}

function ActivityMatters({ user }) {
  const { t, isEn } = useLanguage();
  const [view, setView] = useState('menu'); // menu, organize, register, detail, participants, regForm
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [participants, setParticipants] = useState(null); // { activityName, participants: [] }
  const [formData, setFormData] = useState({
    name: '', capacity: '', location: '', description: '', flow: '', requirements: '',
    activityTimeStart: '',
    activityTimeEnd: '',
    hasFee: false, feeAmount: '',
    isPerformance: false
  });
  const [showSeatEditor, setShowSeatEditor] = useState(false);
  const [seatEditorStep, setSeatEditorStep] = useState(1);
  const [seatPreviewLocks, setSeatPreviewLocks] = useState([]);
  const [bulkZoneId, setBulkZoneId] = useState('');
  const [bulkRowFrom, setBulkRowFrom] = useState('1');
  const [bulkRowTo, setBulkRowTo] = useState('10');
  const [bulkSeatCount, setBulkSeatCount] = useState('20');
  const [seatEditorZones, setSeatEditorZones] = useState([]);
  const [seatEditorRows, setSeatEditorRows] = useState([]);
  const [seatMapData, setSeatMapData] = useState(null);
  const [perfBookLoading, setPerfBookLoading] = useState(false);
  const [perfBookMode, setPerfBookMode] = useState('book'); // 'book' | 'lock'
  const [lockedKeysDraft, setLockedKeysDraft] = useState([]);
  const [perfConfirmSeat, setPerfConfirmSeat] = useState(null);
  const [perfPaymentFile, setPerfPaymentFile] = useState(null);
  /** 组织者/管理员查看已占座位的选座人信息 */
  const [seatHolderModal, setSeatHolderModal] = useState(null);
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
      const res = await api.get(`/activities/approved?userID=${encodeURIComponent(user.userID)}`);
      setActivities(res.data);
      setSelectedActivity((prev) => {
        if (!prev?.id) return prev;
        const next = res.data.find((a) => a.id === prev.id);
        return next ? { ...prev, ...next } : prev;
      });
    } catch (e) {
      console.error("获取活动列表失败", e);
    }
  };

  const loadSeatState = async (act, initLockDraft = false) => {
    if (!act?.id) return;
    setPerfBookLoading(true);
    setSeatMapData(null);
    try {
      const res = await api.get(`/activities/${act.id}/seat-state?userID=${encodeURIComponent(user.userID)}`);
      setSeatMapData(res.data);
      if (initLockDraft) {
        setLockedKeysDraft([...(res.data.lockedSeatKeys || [])]);
      }
    } catch (e) {
      alert(e.response?.data?.error || t('activity.errLoadSeat'));
      setSeatMapData(null);
    } finally {
      setPerfBookLoading(false);
    }
  };

  const openPerformanceBook = (act) => {
    setSelectedActivity(act);
    setView('performanceBook');
    setPerfBookMode('book');
    setLockedKeysDraft([]);
    setPerfConfirmSeat(null);
    setPerfPaymentFile(null);
    setSeatHolderModal(null);
    loadSeatState(act, false);
  };

  const openSeatLockEditor = (act) => {
    if (!act?.id) return;
    setSelectedActivity(act);
    setView('performanceBook');
    setPerfBookMode('lock');
    setPerfConfirmSeat(null);
    setPerfPaymentFile(null);
    setSeatHolderModal(null);
    loadSeatState(act, true);
  };

  const saveSeatLocks = async () => {
    if (!selectedActivity?.id) return;
    try {
      await api.put(`/activities/${selectedActivity.id}/seat-locks`, {
        userID: user.userID,
        lockedSeatKeys: lockedKeysDraft
      });
      alert(t('activity.successLocksSaved'));
      await loadSeatState(selectedActivity, true);
      fetchActivities();
    } catch (e) {
      alert(e.response?.data?.error || t('activity.errSaveLocks'));
    }
  };

  const isPerfOrg = selectedActivity && (selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin');

  /** 与社团导出一致：fetch 拉取二进制再触发本地下载，避免 <a href> 跨域/无法保存 */
  const downloadActivityParticipantsExcel = async (activityId, activityName) => {
    try {
      const safe = String(activityName || t('activity.excelNameFallback')).replace(/[/\\?%*:|"<>]/g, '_');
      await downloadExport(
        `/api/activities/${activityId}/export?userID=${encodeURIComponent(user.userID)}`,
        `${safe}_${t('activity.participantsExcelSuffix')}`
      );
    } catch (e) {
      alert(e.message || t('activity.errDownload'));
    }
  };

  /** 组织者/管理员编辑座位图（列表与详情共用） */
  const openSeatEditorForActivity = (act) => {
    if (!act?.id) return;
    const lay = act.seatLayout;
    const zones = Array.isArray(lay?.zones) && lay.zones.length
      ? lay.zones.map(z => ({ ...z }))
      : [{ id: `z_${Date.now()}`, name: t('activity.defaultZoneFloor'), price: 5 }];
    const zid = zones[0].id;
    const rows = Array.isArray(lay?.rows) && lay.rows.length
      ? lay.rows.map(r => ({ ...r, zoneId: r.zoneId || zid }))
      : [{ zoneId: zid, rowLabel: '1', seatCount: 10 }];
    setSelectedActivity(act);
    setSeatEditorZones(zones);
    setSeatEditorRows(rows);
    setSeatEditorStep(1);
    setSeatPreviewLocks([]);
    setBulkZoneId(zones[0]?.id || '');
    setBulkRowFrom('1');
    setBulkRowTo('10');
    setBulkSeatCount('20');
    setShowSeatEditor(true);
  };

  const getNormalizedSeatEditorPayload = () => {
    const zones = seatEditorZones
      .filter(z => z.name && String(z.name).trim())
      .map(z => ({ ...z, name: String(z.name).trim(), price: Number(z.price) || 0 }));
    const rows = seatEditorRows
      .filter(r => r.zoneId && r.rowLabel && (parseInt(r.seatCount, 10) || 0) > 0)
      .map(r => ({ zoneId: r.zoneId, rowLabel: String(r.rowLabel).trim(), seatCount: parseInt(r.seatCount, 10) || 0 }));
    return { zones, rows };
  };

  const goToSeatPreview = () => {
    const { zones, rows } = getNormalizedSeatEditorPayload();
    if (zones.length === 0 || rows.length === 0) {
      alert(t('activity.errMinZoneRow'));
      return;
    }
    const cat = buildSeatCatalogClient({ zones, rows });
    if (cat.length === 0) {
      alert(t('activity.errSeatZero'));
      return;
    }
    const valid = new Set(cat.map((c) => c.seatKey));
    const pre = (selectedActivity?.lockedSeatKeys || []).filter((k) => valid.has(k));
    setSeatPreviewLocks(pre);
    setSeatEditorStep(2);
  };

  const bulkAddRows = () => {
    const zid = bulkZoneId || seatEditorZones[0]?.id;
    const from = parseInt(bulkRowFrom, 10);
    const to = parseInt(bulkRowTo, 10);
    const n = parseInt(bulkSeatCount, 10);
    if (!zid) {
      alert(t('activity.errBulkZone'));
      return;
    }
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || !Number.isFinite(n) || n < 1) {
      alert(t('activity.errBulkRange'));
      return;
    }
    const newRows = [];
    for (let r = from; r <= to; r++) {
      newRows.push({ zoneId: zid, rowLabel: String(r), seatCount: n });
    }
    setSeatEditorRows((prev) => [...prev, ...newRows]);
  };

  const saveSeatLayout = async () => {
    if (!selectedActivity?.id) return;
    const { zones, rows } = getNormalizedSeatEditorPayload();
    if (zones.length === 0 || rows.length === 0) {
      alert(t('activity.errMinZoneRow'));
      return;
    }
    try {
      await api.put(`/activities/${selectedActivity.id}/seat-layout`, {
        userID: user.userID,
        seatLayout: { zones, rows },
        lockedSeatKeys: seatPreviewLocks
      });
      alert(t('activity.errSaveLayoutOk'));
      setShowSeatEditor(false);
      setSeatEditorStep(1);
      setSeatPreviewLocks([]);
      await fetchActivities();
      const updated = (await api.get(`/activities/approved?userID=${encodeURIComponent(user.userID)}`)).data?.find(a => a.id === selectedActivity.id);
      if (updated) setSelectedActivity({ ...selectedActivity, ...updated });
    } catch (e) {
      alert(e.response?.data?.error || t('activity.errSaveLayout'));
    }
  };

  const submitPerformanceReserve = async () => {
    if (!perfConfirmSeat || !selectedActivity?.id) return;
    const needPay = selectedActivity.hasFee || (Number(perfConfirmSeat.price) > 0);
    if (needPay && !perfPaymentFile) {
      alert(t('activity.errUploadProofFirst'));
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
      alert(t('activity.reserveSubmitted'));
      setPerfConfirmSeat(null);
      setPerfPaymentFile(null);
      await loadSeatState(selectedActivity);
      fetchActivities();
    } catch (e) {
      alert(e.response?.data?.error || t('activity.reserveFail'));
    }
  };

  const handleOrganize = async (e) => {
    e.preventDefault();
    try {
      const missing = [];
      if (!String(formData.name || '').trim()) missing.push(t('activity.missingFieldActivityName'));
      if (!String(formData.capacity || '').trim()) missing.push(t('activity.missingFieldCapacity'));
      else {
        const capN = Number(formData.capacity);
        if (!Number.isFinite(capN) || capN < 1) {
          alert(t('activity.errCapacityInt'));
          return;
        }
      }
      if (!String(formData.location || '').trim()) missing.push(t('activity.missingFieldLocation'));
      if (!String(formData.description || '').trim()) missing.push(t('activity.missingFieldDesc'));
      if (!String(formData.flow || '').trim()) missing.push(t('activity.missingFieldFlow'));
      if (!String(formData.requirements || '').trim()) missing.push(t('activity.missingFieldReq'));
      if (missing.length) {
        alert(`${t('activity.errMissingPrefix')}${missing.join('、')}`);
        return;
      }

      // 如果选择了付费但未上传二维码，提示错误
      if (formData.hasFee && !paymentQRCode) {
        alert(t('activity.errNeedQRIfFee'));
        return;
      }
      if (!String(formData.activityTimeStart || '').trim() || !String(formData.activityTimeEnd || '').trim()) {
        alert(t('activity.errFillTime'));
        return;
      }
      const _startMs = new Date(formData.activityTimeStart).getTime();
      const _endMs = new Date(formData.activityTimeEnd).getTime();
      if (!Number.isFinite(_startMs) || !Number.isFinite(_endMs)) {
        alert(t('activity.errInvalidTime'));
        return;
      }
      if (_endMs <= _startMs) {
        alert(t('activity.errEndAfterStart'));
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
      const activityTimeStr = formatDateTime(formData.activityTimeStart, formData.activityTimeEnd) || '';
      data.append('time', activityTimeStr);
      data.append('location', formData.location);
      data.append('description', formData.description);
      data.append('flow', formData.flow);
      data.append('requirements', formData.requirements);
      data.append('hasFee', formData.hasFee.toString());
      if (formData.feeAmount) data.append('feeAmount', formData.feeAmount);
      
      data.append('organizerID', user.userID);
      data.append('operatorID', user.userID);
      data.append('isPerformance', String(!!formData.isPerformance));
      if (file) data.append('file', file);
      if (paymentQRCode) data.append('paymentQRCode', paymentQRCode);

      await api.post('/activities', data);
      alert(t('activity.activitySubmitted'));
      setView('menu');
      // 重置表单
      setFormData({
        name: '', capacity: '', location: '', description: '', flow: '', requirements: '',
        activityTimeStart: '',
        activityTimeEnd: '',
        hasFee: false, feeAmount: '',
        isPerformance: false
      });
      setFile(null);
      setPaymentQRCode(null);
    } catch (err) {
      alert(err.response?.data?.error || t('activity.submitFail'));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      // 如果活动有费用但未上传支付截图，提示错误
      if (selectedActivity.hasFee && !paymentProof) {
        alert(t('activity.errNeedFeeProof'));
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
      alert(t('activity.regSubmitted'));
      setView('menu');
      // 重置表单
      setRegForm({
        name: user.name, class: user.class, reason: '', contact: ''
      });
      setPaymentProof(null);
      fetchActivities(); // 刷新活动列表以更新人数显示
    } catch (err) {
      alert(err.response?.data?.error || t('activity.regFail'));
    }
  };

  const fetchParticipants = async (activityId) => {
    try {
      const res = await api.get(`/activities/${activityId}/participants?userID=${user.userID}`);
      setParticipants(res.data);
      setView('participants');
    } catch (err) {
      alert(err.response?.data?.error || t('activity.participantsLoadFail'));
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
      alert(t('activity.updated'));
    } catch (err) {
      alert(err.response?.data?.error || t('activity.updateFail'));
    }
  };

  /** 活动时间：优先 time；旧数据无 time 时拼接各阶段字段 */
  const displayActivityTime = (act) => {
    if (!act) return '';
    if (act.time && String(act.time).trim()) return act.time;
    const legacy = [act.phaseTimePreparation, act.phaseTimeStart, act.phaseTimeInProgress, act.phaseTimeEnd].filter(Boolean);
    return legacy.length ? legacy.join('；') : '';
  };

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
                          {act.location}{displayActivityTime(act) ? ` | ${displayActivityTime(act)}` : ''}
                          {act.organizerName && (
                            <span className="ml-2">{t('activity.organizer')}: {act.organizerName}{act.organizerEnglishName ? ` / ${act.organizerEnglishName}` : ''}{act.organizerClass ? ` (${act.organizerClass})` : ''}</span>
                          )}
                        </p>
                        {act.isPerformance && act.totalSeatCount > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {t('activity.confirmedSeats')}: {act.currentRegCount || 0} / {act.totalSeatCount}
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
                            {t('activity.feeInfoPrefix')} {act.feeAmount || t('activity.feeNotSet')}
                          </p>
                        )}
                        {act.isPerformance && act.myPerformanceSeat && (
                          <p className="text-xs text-emerald-800 font-bold mt-2 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 max-w-md">
                            {t('activity.mySeatPrefix')}{isEn
                              ? `${act.myPerformanceSeat.zoneName} Row ${act.myPerformanceSeat.rowLabel} No.${act.myPerformanceSeat.seatLabel}`
                              : `${act.myPerformanceSeat.zoneName} ${act.myPerformanceSeat.rowLabel}排 ${act.myPerformanceSeat.seatLabel}号`}
                            <span className="font-normal text-emerald-700">
                              {act.myPerformanceSeat.status === 'approved' ? t('activity.mySeatApproved') : t('activity.mySeatPending')}
                            </span>
                          </p>
                        )}
                      </div>
                      {act.organizerID === user.userID ? (
                        <span className="text-xs text-blue-500 font-bold">{t('activity.youAreOrganizer')}</span>
                      ) : null}
                    </div>
                    
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
                          {t('activity.editPerformanceSeats')}
                        </button>
                      )}
                      {act.isPerformance && !(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                        <span
                          className="text-[10px] text-amber-900 border border-dashed border-amber-400 bg-amber-50 px-2 py-1 rounded font-medium self-center"
                          title={t('activity.perfChooseSeatTitle')}
                        >
                          {t('activity.perfSeatTag')}
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
                          : (act.isPerformance ? t('activity.chooseSeatRegister') : t('activity.register'))}
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
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await downloadActivityParticipantsExcel(act.id, act.name);
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
                            if (!window.confirm(t('activity.deleteConfirm'))) return;
                            try {
                              await api.delete(`/activities/${act.id}?userID=${user.userID}`);
                              alert(t('activity.deleted'));
                              fetchActivities();
                            } catch (err) {
                              alert(err.response?.data?.error || t('activity.deleteFail'));
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
          <h2 className="text-xl font-bold">{t('activity.organizeTitle')}</h2>
          <p className="text-xs text-gray-500">{t('activity.requiredStarHint')}</p>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('activity.activityNameLabel')} <span className="text-red-600">*</span></label>
            <input placeholder={t('activity.activityNamePlaceholder')} className="border p-2 rounded w-full mt-1" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('activity.capacityLabel')} <span className="text-red-600">*</span></label>
            <input placeholder={t('activity.capacityPlaceholder')} type="number" min={1} step={1} className="border p-2 rounded w-full mt-1" required value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('activity.locationLabel')} <span className="text-red-600">*</span></label>
            <input placeholder={t('activity.locationPlaceholder')} className="border p-2 rounded w-full mt-1" required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('activity.shortDescLabel')} <span className="text-red-600">*</span></label>
            <textarea placeholder={t('activity.shortDescPlaceholder')} className="border p-2 rounded w-full mt-1 min-h-[72px]" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('activity.flowLabel')} <span className="text-red-600">*</span></label>
            <textarea placeholder={t('activity.flowPlaceholder')} className="border p-2 rounded w-full mt-1 min-h-[72px]" required value={formData.flow} onChange={e => setFormData({...formData, flow: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">{t('activity.requirementsLabel')} <span className="text-red-600">*</span></label>
            <textarea placeholder={t('activity.requirementsPlaceholder')} className="border p-2 rounded w-full mt-1 min-h-[72px]" required value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})} />
          </div>
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-bold mb-2">{t('activity.timeSectionTitle')} <span className="text-red-600 text-sm">*</span></h3>
            <p className="text-xs text-gray-500 mb-3">{t('activity.timeSectionHint')}</p>
            <div className="border p-3 rounded bg-blue-50 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">{t('activity.startLabel')}</label>
                <input
                  type="datetime-local"
                  required
                  className="border p-2 rounded w-full text-sm"
                  value={formData.activityTimeStart}
                  onChange={(e) => setFormData({ ...formData, activityTimeStart: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">{t('activity.endLabel')}</label>
                <input
                  type="datetime-local"
                  required
                  className="border p-2 rounded w-full text-sm"
                  value={formData.activityTimeEnd}
                  onChange={(e) => setFormData({ ...formData, activityTimeEnd: e.target.value })}
                />
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
              <label htmlFor="isPerformance" className="text-lg font-bold cursor-pointer">{t('activity.perfCheckboxLabel')}</label>
            </div>
            <p className="text-xs text-gray-500 mb-3 ml-7">{t('activity.perfCheckboxHint')}</p>
          </div>
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="hasFee"
                checked={formData.hasFee}
                onChange={(e) => setFormData({...formData, hasFee: e.target.checked})}
                className="w-4 h-4"
              />
              <label htmlFor="hasFee" className="text-lg font-bold cursor-pointer">{t('activity.feeOptionalLabel')}</label>
            </div>
            {formData.hasFee && (
              <div className="ml-6 grid gap-3 bg-yellow-50 p-4 rounded border border-yellow-200">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('activity.feeAmountLabel')}</label>
                  <input
                    type="text"
                    placeholder={t('activity.feeAmountPlaceholder')}
                    className="border p-2 rounded w-full"
                    value={formData.feeAmount}
                    onChange={e => setFormData({...formData, feeAmount: e.target.value})}
                    required={formData.hasFee}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('activity.uploadQRLabel')} <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 ml-2">{t('activity.uploadQRHint')}</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all w-full"
                    onChange={(e) => setPaymentQRCode(e.target.files[0])}
                    required={formData.hasFee}
                  />
                  {!paymentQRCode && formData.hasFee && (
                    <p className="text-xs text-red-500 mt-1">{t('activity.uploadQRWarn')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">{t('activity.attachmentOptional')}</label>
            <input type="file" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition-all" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          <button type="submit" className="bg-orange-600 text-white p-2 rounded">{t('activity.submitActivityApply')}</button>
          <button onClick={() => setView('menu')} type="button" className="text-gray-500 underline text-center">{t('activity.back')}</button>
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
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{act.location}{displayActivityTime(act) ? ` · ${displayActivityTime(act)}` : ''}</span>
                        {full && <span className="text-xs text-red-600 font-medium">{t('common.full')}</span>}
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
                      {act.location}{displayActivityTime(act) ? ` | ${displayActivityTime(act)}` : ''}
                      {act.organizerName && (
                        <span className="ml-2">{t('activity.organizerColon')} {act.organizerName}{act.organizerEnglishName ? ` / ${act.organizerEnglishName}` : ''}{act.organizerClass ? ` (${act.organizerClass})` : ''}</span>
                      )}
                    </p>
                  </div>
                  {act.organizerID === user.userID ? (
                    <span className="text-xs text-blue-500 font-bold">{t('activity.youAreOrganizerShort')}</span>
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
                        ? t('common.full') : (act.isPerformance ? t('activity.chooseSeatRegister') : t('activity.register'))}
                    </button>
                  )}
                </div>

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <strong>{t('activity.introColon')}</strong> {act.description}
                </div>
                
                {/* 显示人数信息 */}
                {act.capacity && (
                  <div className="text-xs text-gray-500">
                    {t('common.capacity')}: {act.currentRegCount || 0} / {act.capacity}
                  </div>
                )}
                
                {/* 参与人员按钮 - 仅组织者和管理员可见 */}
                {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <button 
                    onClick={() => fetchParticipants(act.id)}
                    className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded font-bold mt-2 ml-2 hover:bg-purple-700"
                  >
                    {t('activity.participants')}
                  </button>
                )}
                {/* 删除按钮 - 仅组织者和管理员可见 */}
                {(act.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <button 
                    onClick={async () => {
                      if (!window.confirm(t('activity.deleteConfirm'))) return;
                      try {
                        await api.delete(`/activities/${act.id}?userID=${user.userID}`);
                        alert(t('activity.deleted'));
                        fetchActivities();
                      } catch (err) {
                        alert(err.response?.data?.error || t('activity.deleteFail'));
                      }
                    }}
                    className="bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold mt-2 ml-2"
                  >
                    {t('activity.deleteActivity')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => setView('menu')} className="mt-4 text-gray-500 underline">{t('activity.back')}</button>
        </div>
      )}

      {view === 'performanceBook' && selectedActivity && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-xl font-bold">
              {perfBookMode === 'lock' ? t('activity.performanceLockTitle') : t('activity.performanceBookTitle')}
              {selectedActivity.name}
            </h2>
            <button
              type="button"
              onClick={() => {
                setView('menu');
                setSeatMapData(null);
                setPerfConfirmSeat(null);
                setPerfBookMode('book');
                setSeatHolderModal(null);
              }}
              className="text-gray-500 underline text-sm"
            >
              {t('activity.backToList')}
            </button>
          </div>
          {perfBookMode === 'lock' && isPerfOrg && (
            <p className="text-xs text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              {t('activity.lockHelp')}
            </p>
          )}
          {perfBookMode === 'book' && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t('activity.bookHelp')}
            </p>
          )}
          {perfBookMode === 'book' && seatMapData?.myReservation && (
            <p className="text-sm text-gray-800">
              {t('activity.myCurrentPick')}
              <span className="font-bold">
                {' '}
                {isEn
                  ? `${seatMapData.myReservation.zoneName} Row ${seatMapData.myReservation.rowLabel} No.${seatMapData.myReservation.seatLabel}`
                  : `${seatMapData.myReservation.zoneName} ${seatMapData.myReservation.rowLabel}排 ${seatMapData.myReservation.seatLabel}号`}
              </span>
              {seatMapData.myReservation.status === 'pending' ? t('activity.pendingReview') : t('activity.confirmed')}
            </p>
          )}
          <p className="text-xs text-gray-600">
            {perfBookMode === 'lock'
              ? t('activity.legendLock')
              : t('activity.legendBook')}
            {isPerfOrg && seatMapData?.canViewSeatHolders && (
              <span className="block mt-1 text-sky-800">
                {t('activity.legendOrg')}
              </span>
            )}
          </p>
          {perfBookLoading && <p className="text-gray-500">{t('activity.loadingSeats')}</p>}
          {seatMapData && !perfBookLoading && (
            <div className="space-y-6 border rounded-xl p-4 bg-gray-50">
              {seatMapData.zones.map(zone => (
                <div key={zone.id}>
                  <h4 className="font-bold text-gray-800 mb-2">{zone.name} · ¥{zone.price}</h4>
                  {seatMapData.rows.filter(r => r.zoneId === zone.id).map(row => (
                    <div key={`${zone.id}_${row.rowLabel}`} className="flex flex-wrap items-center gap-1 mb-2">
                      <span className="text-xs text-gray-500 w-14 shrink-0">
                        {isEn ? `${t('activity.rowSuffix')}${row.rowLabel}` : `${row.rowLabel}${t('activity.rowSuffix')}`}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {Array.from({ length: row.seatCount }, (_, i) => {
                          const num = i + 1;
                          const seatKey = `${zone.id}||${row.rowLabel}||${String(num)}`;
                          const st = seatMapData.seats[seatKey];
                          const raw = st?.state || 'available';
                          let state = raw;
                          if (perfBookMode === 'lock') {
                            const inD = lockedKeysDraft.includes(seatKey);
                            if (inD && raw === 'available') state = 'locked';
                            if (!inD && raw === 'locked') state = 'available';
                          }
                          const label = state === 'available' ? String(num)
                            : state === 'held' ? t('activity.seatCellHeld')
                            : state === 'pending_mine' ? t('activity.seatCellPending')
                            : state === 'confirmed_mine' ? '✓'
                            : state === 'locked' ? (perfBookMode === 'lock' ? t('activity.seatCellReserved') : t('activity.seatCellSold'))
                            : '—';
                          const holderClickable =
                            isPerfOrg &&
                            seatMapData?.canViewSeatHolders &&
                            (st?.holderName || st?.holderClass) &&
                            ['held', 'sold', 'pending_mine', 'confirmed_mine'].includes(raw);
                          const cls =
                            state === 'available'
                              ? (perfBookMode === 'lock' ? 'bg-green-200 text-green-900 hover:bg-green-300 cursor-pointer' : 'bg-green-200 text-green-900 hover:bg-green-300')
                              : state === 'locked'
                                ? (perfBookMode === 'lock' ? 'bg-violet-400 text-white hover:bg-violet-500 cursor-pointer' : 'bg-gray-300 text-gray-600 cursor-not-allowed')
                                : state === 'held'
                                  ? `bg-orange-200 text-orange-900 ${holderClickable ? 'ring-1 ring-sky-500 cursor-pointer hover:opacity-90' : 'cursor-not-allowed'}`
                                  : state === 'pending_mine'
                                    ? `bg-yellow-300 text-yellow-900 ${holderClickable ? 'ring-1 ring-sky-500 cursor-pointer hover:opacity-90' : ''}`
                                    : state === 'confirmed_mine'
                                      ? `bg-blue-400 text-white ${holderClickable ? 'ring-1 ring-sky-500 cursor-pointer hover:opacity-90' : ''}`
                                      : `bg-gray-300 text-gray-600 ${holderClickable ? 'ring-1 ring-sky-500 cursor-pointer hover:opacity-90' : 'cursor-not-allowed'}`;
                          const rawBlocked = ['held', 'pending_mine', 'confirmed_mine', 'sold'].includes(raw);
                          const lockClickable = perfBookMode === 'lock' && isPerfOrg && !rawBlocked;
                          const bookClickable = perfBookMode === 'book' && state === 'available';
                          return (
                            <button
                              key={seatKey}
                              type="button"
                              disabled={!lockClickable && !bookClickable && !holderClickable}
                              title={
                                holderClickable
                                  ? t('activity.clickHolder')
                                  : `${zone.name} ${row.rowLabel}-${num} ¥${st?.price != null ? st.price : zone.price}`
                              }
                              onClick={() => {
                                if (holderClickable) {
                                  setSeatHolderModal({
                                    seatKey,
                                    zoneName: zone.name,
                                    rowLabel: row.rowLabel,
                                    seatLabel: String(num),
                                    holderName: st.holderName || '—',
                                    holderClass: st.holderClass || '—',
                                    holderEnglishName: st.holderEnglishName || '',
                                    reservationStatus: st.reservationStatus || (raw === 'sold' || raw === 'confirmed_mine' ? 'approved' : 'pending')
                                  });
                                  return;
                                }
                                if (perfBookMode === 'lock' && lockClickable) {
                                  setLockedKeysDraft((d) => (d.includes(seatKey) ? d.filter((k) => k !== seatKey) : [...d, seatKey]));
                                  return;
                                }
                                if (perfBookMode === 'book' && state === 'available') {
                                  setPerfConfirmSeat({ seatKey, price: st?.price != null ? st.price : zone.price, zoneName: zone.name, rowLabel: row.rowLabel, seatLabel: String(num) });
                                  setPerfPaymentFile(null);
                                }
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
          {perfBookMode === 'lock' && isPerfOrg && seatMapData && !perfBookLoading && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={saveSeatLocks}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-700"
              >
                {t('activity.saveLocksBtn')}
              </button>
              <span className="text-xs text-gray-500">
                {t('activity.currentReserved').replace('{n}', String(lockedKeysDraft.length))}
              </span>
            </div>
          )}
          {perfConfirmSeat && perfBookMode === 'book' && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
                <h3 className="font-bold text-lg">{t('activity.confirmSeatTitle')}</h3>
                <p className="text-sm">
                  {t('activity.seatLine')
                    .replace('{z}', perfConfirmSeat.zoneName)
                    .replace('{r}', perfConfirmSeat.rowLabel)
                    .replace('{s}', perfConfirmSeat.seatLabel)}
                </p>
                <p className="text-sm">{t('activity.amountLine').replace('{p}', String(perfConfirmSeat.price))}</p>
                {(selectedActivity.hasFee || Number(perfConfirmSeat.price) > 0) && seatMapData?.paymentQRCode && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">{t('activity.scanPayThenUpload')}</p>
                    <img src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${seatMapData.paymentQRCode}`} alt="qr" className="max-w-[200px] border rounded mx-auto" />
                  </div>
                )}
                {(selectedActivity.hasFee || Number(perfConfirmSeat.price) > 0) && (
                  <input type="file" accept="image/*" onChange={e => setPerfPaymentFile(e.target.files?.[0] || null)} className="text-sm w-full" />
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" className="px-4 py-2 rounded-lg bg-gray-200" onClick={() => setPerfConfirmSeat(null)}>
                    {t('common.cancel')}
                  </button>
                  <button type="button" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold" onClick={submitPerformanceReserve}>
                    {t('activity.submitRequest')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {seatHolderModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-3">
                <h3 className="font-bold text-lg">{t('activity.holderTitle')}</h3>
                <p className="text-sm text-gray-700">
                  {t('activity.seatLine')
                    .replace('{z}', seatHolderModal.zoneName)
                    .replace('{r}', seatHolderModal.rowLabel)
                    .replace('{s}', seatHolderModal.seatLabel)}
                </p>
                <p className="text-sm">
                  <span className="text-gray-500">{t('activity.reviewStatusLabel')}</span>
                  <strong>
                    {seatHolderModal.reservationStatus === 'approved' ? t('activity.statusApproved') : t('activity.statusPending')}
                  </strong>
                </p>
                <p className="text-sm">
                  <span className="text-gray-500">{t('activity.nameLabelPlain')}</span>
                  <strong>{seatHolderModal.holderName}</strong>
                  {seatHolderModal.holderEnglishName ? (
                    <span className="text-gray-600"> / {seatHolderModal.holderEnglishName}</span>
                  ) : null}
                </p>
                <p className="text-sm">
                  <span className="text-gray-500">{t('activity.classLabelPlain')}</span>
                  <strong>{seatHolderModal.holderClass}</strong>
                </p>
                <div className="flex justify-end pt-2">
                  <button type="button" className="px-4 py-2 rounded-lg bg-gray-200 font-medium" onClick={() => setSeatHolderModal(null)}>
                    {t('common.close')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'regForm' && selectedActivity && !selectedActivity.isPerformance && (
        <form onSubmit={handleRegister} className="grid gap-4">
          <h2 className="text-xl font-bold">{t('activity.regFormTitle').replace('{name}', selectedActivity.name)}</h2>
          <input placeholder={t('login.name')} value={regForm.name} className="border p-2 rounded bg-gray-100" readOnly />
          <input placeholder={t('login.class')} value={regForm.class} className="border p-2 rounded bg-gray-100" readOnly />
          <textarea placeholder={t('activity.reason')} className="border p-2 rounded" required onChange={e => setRegForm({...regForm, reason: e.target.value})} />
          <input placeholder={t('activity.contact')} className="border p-2 rounded" required onChange={e => setRegForm({...regForm, contact: e.target.value})} />
          
          {/* 显示支付信息 */}
          {selectedActivity.hasFee && (
            <div className="border-2 border-yellow-400 bg-yellow-50 p-4 rounded">
              <h3 className="font-bold text-lg mb-2 text-yellow-800">{t('activity.feeInfoTitle')}</h3>
              <p className="text-yellow-700 mb-3">
                <strong>{t('activity.feeAmountStrong')}</strong>{selectedActivity.feeAmount || t('activity.feeNotSet')}
              </p>
              {selectedActivity.paymentQRCode && (
                <div className="mb-4">
                  <p className="text-yellow-700 mb-2 font-medium">{t('activity.payScanLine')}</p>
                  <div className="flex justify-center mb-2">
                    <img 
                      src={`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/uploads/${selectedActivity.paymentQRCode}`}
                      alt={t('activity.paymentQRAlt')}
                      className="max-w-xs border-2 border-yellow-300 rounded"
                      style={{ maxHeight: '300px' }}
                    />
                  </div>
                </div>
              )}
              
              {/* 上传支付截图 */}
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2 text-yellow-800">
                  {t('activity.paymentScreenshot')} <span className="text-red-500">*</span>
                </label>
                <input 
                  type="file" 
                  accept="image/*"
                  className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-all w-full" 
                  onChange={(e) => setPaymentProof(e.target.files[0])}
                  required={selectedActivity.hasFee}
                />
                {!paymentProof && selectedActivity.hasFee && (
                  <p className="text-xs text-red-500 mt-1">{t('activity.uploadProofRequiredWarn')}</p>
                )}
                {paymentProof && (
                  <p className="text-xs text-green-600 mt-1">{t('activity.fileSelected').replace('{name}', paymentProof.name)}</p>
                )}
              </div>
            </div>
          )}
          
          <button type="submit" className="bg-blue-600 text-white p-2 rounded">{t('activity.submitRegister')}</button>
          <button onClick={() => setView('register')} type="button" className="text-gray-500 underline text-center">{t('activity.back')}</button>
        </form>
      )}

      {view === 'detail' && selectedActivity && (
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{t('activity.detailTitle').replace('{name}', selectedActivity.name)}</h2>
            <div className="flex items-center gap-2">
              {(selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && !editingActivity && (
                <button
                  onClick={() => {
                    setEditingActivity(true);
                    setEditActivityForm({
                      name: selectedActivity.name || '',
                      capacity: selectedActivity.capacity != null ? String(selectedActivity.capacity) : '',
                      time: displayActivityTime(selectedActivity) || '',
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
                  {t('activity.edit')}
                </button>
              )}
              <button 
                onClick={() => setView('menu')} 
                className="text-gray-500 underline text-sm"
              >
                {t('activity.back')}
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
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 inline-block px-2 py-1 rounded mb-2">{t('activity.perfSeatTagDetail')}</p>
                )}
                {selectedActivity.isPerformance && selectedActivity.myPerformanceSeat && (
                  <div className="text-sm border border-emerald-200 bg-emerald-50 text-emerald-900 rounded-lg px-3 py-2 mb-2">
                    <strong>{t('activity.mySeatDetail')}</strong>
                    {isEn
                      ? `${selectedActivity.myPerformanceSeat.zoneName} Row ${selectedActivity.myPerformanceSeat.rowLabel} No.${selectedActivity.myPerformanceSeat.seatLabel}`
                      : `${selectedActivity.myPerformanceSeat.zoneName} ${selectedActivity.myPerformanceSeat.rowLabel}排 ${selectedActivity.myPerformanceSeat.seatLabel}号`}
                    <span className="ml-2 text-emerald-700">
                      {selectedActivity.myPerformanceSeat.status === 'approved' ? t('activity.mySeatApproved') : t('activity.mySeatPending')}
                    </span>
                    <p className="text-xs text-emerald-800 mt-1">{t('activity.hintMapSeat')}</p>
                  </div>
                )}
                {selectedActivity.isPerformance && selectedActivity.totalSeatCount > 0 && (
                  <p className="text-sm text-gray-600 mb-1">
                    {t('activity.confirmedSeats')}：{selectedActivity.currentRegCount || 0} / {selectedActivity.totalSeatCount}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  <strong>{t('activity.locationStrong')}</strong>{selectedActivity.location || t('activity.notFilled')}
                </p>
                {displayActivityTime(selectedActivity) && (
                  <p className="text-sm text-gray-600">
                    <strong>{t('activity.timeStrong')}</strong>{displayActivityTime(selectedActivity)}
                  </p>
                )}
                {selectedActivity.organizerName && (
                  <p className="text-sm text-gray-600">
                    <strong>{t('activity.organizerStrong')}</strong>{selectedActivity.organizerName}{selectedActivity.organizerEnglishName ? ` / ${selectedActivity.organizerEnglishName}` : ''}{selectedActivity.organizerClass ? ` (${selectedActivity.organizerClass})` : ''}
                  </p>
                )}
                {(selectedActivity.capacity != null || selectedActivity.currentRegCount != null) && (
                  <p className="text-sm text-gray-600">
                    <strong>{t('activity.peopleStrong')}</strong>{selectedActivity.currentRegCount || 0} / {selectedActivity.capacity ?? t('activity.capacityUnlimited')}
                  </p>
                )}
                {selectedActivity.hasFee && (
                  <p className="text-sm text-orange-600 font-medium">
                    <strong>{t('activity.feeStrong')}</strong>{selectedActivity.feeAmount || t('activity.feeNotSet')}
                  </p>
                )}
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">{t('activity.introHeading')}</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.description || t('activity.notFilled')}</p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">{t('activity.flowHeading')}</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.flow || t('activity.notFilled')}</p>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">{t('activity.reqHeading')}</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedActivity.requirements || t('activity.notFilled')}</p>
              </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editName')}</label>
                    <input value={editActivityForm.name} onChange={e => setEditActivityForm({ ...editActivityForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editLoc')}</label>
                    <input value={editActivityForm.location} onChange={e => setEditActivityForm({ ...editActivityForm, location: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editTime')}</label>
                    <input value={editActivityForm.time} onChange={e => setEditActivityForm({ ...editActivityForm, time: e.target.value })} placeholder={t('activity.editTimePlaceholder')} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editCapHint')}</label>
                    <input type="number" min="0" value={editActivityForm.capacity} onChange={e => setEditActivityForm({ ...editActivityForm, capacity: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editDesc')}</label>
                    <textarea value={editActivityForm.description} onChange={e => setEditActivityForm({ ...editActivityForm, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" rows={4} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editFlow')}</label>
                    <textarea value={editActivityForm.flow} onChange={e => setEditActivityForm({ ...editActivityForm, flow: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" rows={4} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.editReq')}</label>
                    <textarea value={editActivityForm.requirements} onChange={e => setEditActivityForm({ ...editActivityForm, requirements: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]" rows={4} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editActivityForm.hasFee} onChange={e => setEditActivityForm({ ...editActivityForm, hasFee: e.target.checked })} className="rounded" />
                      <span className="text-sm">{t('activity.feeCheckboxEdit')}</span>
                    </label>
                  </div>
                  {editActivityForm.hasFee && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">{t('activity.feeAmountEdit')}</label>
                      <input value={editActivityForm.feeAmount} onChange={e => setEditActivityForm({ ...editActivityForm, feeAmount: e.target.value })} placeholder={t('activity.feeExamplePlaceholder')} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleUpdateActivity} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">{t('common.save')}</button>
                    <button onClick={() => setEditingActivity(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-300">{t('common.cancel')}</button>
                  </div>
                </div>
              )}

              {!editingActivity && (
              <>
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
                      ? t('common.full')
                      : (selectedActivity.isPerformance ? t('activity.selectSeatToRegister') : t('activity.register'))}
                  </button>
                )}
                {(selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && selectedActivity.isPerformance && (
                  <>
                    <button
                      type="button"
                      onClick={() => openSeatEditorForActivity(selectedActivity)}
                      className="bg-amber-600 text-white px-4 py-2 rounded font-bold hover:bg-amber-700 text-sm"
                    >
                      {t('activity.editPerformanceSeats')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSeatLockEditor(selectedActivity)}
                      className="bg-violet-600 text-white px-4 py-2 rounded font-bold hover:bg-violet-700 text-sm"
                    >
                      {t('activity.reserveSeatsInternal')}
                    </button>
                  </>
                )}
                {(selectedActivity.organizerID === user.userID || user.role === 'admin' || user.role === 'super_admin') && (
                  <>
                    <button 
                      onClick={() => fetchParticipants(selectedActivity.id)}
                      className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700"
                    >
                      {t('activity.participantsTitle')}
                    </button>
                    <button 
                      type="button"
                      onClick={() => downloadActivityParticipantsExcel(selectedActivity.id, selectedActivity.name)}
                      className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700"
                    >
                      {t('activity.downloadParticipantsExcel')}
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
          <div className={`bg-white rounded-2xl p-6 shadow-xl space-y-4 my-8 ${seatEditorStep === 2 ? 'max-w-4xl w-full' : 'max-w-lg w-full'}`}>
            <h3 className="font-bold text-lg">
              {t('activity.seatEditorTitle').replace('{name}', selectedActivity.name)}
              <span className="text-sm font-normal text-gray-500 ml-2">
                {seatEditorStep === 1 ? t('activity.seatStepLayout') : t('activity.seatStepPreview')}
              </span>
            </h3>

            {seatEditorStep === 1 && (
              <>
                <div className="text-xs text-gray-700 space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50 leading-relaxed">
                  <p className="font-semibold text-gray-800">{t('activity.seatHowToTitle')}</p>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>{t('activity.seatHowTo1')}</li>
                    <li>{t('activity.seatHowTo2')}</li>
                    <li>{t('activity.seatHowTo3')}</li>
                    <li>{t('activity.seatHowTo4')}</li>
                  </ol>
                </div>
                <div className="space-y-2 border rounded-lg p-3 bg-amber-50/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{t('activity.zoneHeading')}</span>
                    <button type="button" className="text-xs text-blue-600 font-bold" onClick={() => setSeatEditorZones(z => [...z, { id: `z_${Date.now()}`, name: t('activity.newZoneDefault'), price: 0 }])}>{t('activity.addZone')}</button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center text-[10px] text-gray-500 font-medium pl-0.5">
                    <span className="flex-1 min-w-[100px]">{t('activity.zoneNameCol')}</span>
                    <span className="w-24">{t('activity.pricePerSeat')}</span>
                  </div>
                  {seatEditorZones.map((z, zi) => (
                    <div key={z.id || zi} className="flex flex-wrap gap-2 items-center">
                      <input className="border rounded px-2 py-1 text-sm flex-1 min-w-[100px]" placeholder={t('activity.zoneNamePlaceholder')} value={z.name} onChange={e => setSeatEditorZones(list => list.map((x, i) => i === zi ? { ...x, name: e.target.value } : x))} />
                      <input type="number" min="0" className="border rounded px-2 py-1 w-24 text-sm" placeholder={t('activity.pricePlaceholder')} value={z.price} onChange={e => setSeatEditorZones(list => list.map((x, i) => i === zi ? { ...x, price: e.target.value } : x))} />
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border rounded-lg p-3 bg-violet-50/50 border-violet-100">
                  <p className="font-bold text-sm text-violet-900">{t('activity.bulkTitle')}</p>
                  <p className="text-[10px] text-violet-800">{t('activity.bulkHint')}</p>
                  <div className="flex flex-wrap gap-2 items-end text-sm">
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">{t('activity.bulkZone')}</label>
                      <select className="border rounded px-2 py-1 min-w-[6rem]" value={bulkZoneId || seatEditorZones[0]?.id || ''} onChange={e => setBulkZoneId(e.target.value)}>
                        {seatEditorZones.map(z => <option key={z.id} value={z.id}>{z.name || z.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">{t('activity.rowFrom')}</label>
                      <input type="number" className="border rounded px-2 py-1 w-16" value={bulkRowFrom} onChange={e => setBulkRowFrom(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">{t('activity.rowTo')}</label>
                      <input type="number" className="border rounded px-2 py-1 w-16" value={bulkRowTo} onChange={e => setBulkRowTo(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600 mb-0.5">{t('activity.seatsPerRow')}</label>
                      <input type="number" min="1" className="border rounded px-2 py-1 w-16" value={bulkSeatCount} onChange={e => setBulkSeatCount(e.target.value)} />
                    </div>
                    <button type="button" className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700" onClick={bulkAddRows}>{t('activity.bulkAddBtn')}</button>
                  </div>
                </div>
                <div className="space-y-2 border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{t('activity.rowsManualTitle')}</span>
                    <button type="button" className="text-xs text-blue-600 font-bold" onClick={() => {
                      const zid = seatEditorZones[0]?.id || '';
                      setSeatEditorRows(r => [...r, { zoneId: zid, rowLabel: String(r.length + 1), seatCount: 8 }]);
                    }}>{t('activity.addOneRow')}</button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center text-[10px] text-gray-500 font-medium pl-0.5">
                    <span className="min-w-[5.5rem]">{t('activity.colBelongZone')}</span>
                    <span className="w-20">{t('activity.colRowLabel')}</span>
                    <span className="w-20">{t('activity.colSeatCount')}</span>
                  </div>
                  {seatEditorRows.map((row, ri) => (
                    <div key={ri} className="flex flex-wrap gap-2 items-center">
                      <select className="border rounded px-2 py-1 text-sm min-w-[5.5rem]" title={t('activity.selectZoneTitle')} value={row.zoneId} onChange={e => setSeatEditorRows(list => list.map((x, i) => i === ri ? { ...x, zoneId: e.target.value } : x))}>
                        {seatEditorZones.map(z => <option key={z.id} value={z.id}>{z.name || z.id}</option>)}
                      </select>
                      <input className="border rounded px-2 py-1 w-20 text-sm" placeholder={t('activity.rowPlaceholder')} title={t('activity.rowLabelTitle')} value={row.rowLabel} onChange={e => setSeatEditorRows(list => list.map((x, i) => i === ri ? { ...x, rowLabel: e.target.value } : x))} />
                      <input type="number" min="1" className="border rounded px-2 py-1 w-20 text-sm" placeholder={t('activity.seatCountPlaceholder')} title={t('activity.seatCountTitle')} value={row.seatCount} onChange={e => setSeatEditorRows(list => list.map((x, i) => i === ri ? { ...x, seatCount: e.target.value } : x))} />
                      <button type="button" className="text-red-500 text-xs shrink-0" onClick={() => setSeatEditorRows(list => list.filter((_, i) => i !== ri))}>{t('activity.delete')}</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <button type="button" className="px-4 py-2 rounded-lg bg-gray-200" onClick={() => { setShowSeatEditor(false); setSeatEditorStep(1); }}>{t('common.close')}</button>
                  <button type="button" className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold" onClick={goToSeatPreview}>{t('activity.nextPreview')}</button>
                </div>
              </>
            )}

            {seatEditorStep === 2 && (() => {
              const { zones, rows } = getNormalizedSeatEditorPayload();
              return (
                <>
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t('activity.previewHint')}
                  </p>
                  <div className="text-xs text-gray-500">
                    {t('activity.lockedCount').replace('{n}', String(seatPreviewLocks.length))}
                  </div>
                  <div className="space-y-4 border rounded-xl p-4 bg-gray-50 max-h-[50vh] overflow-y-auto">
                    {zones.map((zone) => (
                      <div key={zone.id}>
                        <h4 className="font-bold text-gray-800 mb-2">{zone.name} · ¥{Number(zone.price) || 0}</h4>
                        {rows.filter((r) => r.zoneId === zone.id).map((row) => (
                          <div key={`${zone.id}_${row.rowLabel}`} className="flex flex-wrap items-center gap-1 mb-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">
                              {isEn ? `${t('activity.rowSuffix')}${row.rowLabel}` : `${row.rowLabel}${t('activity.rowSuffix')}`}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: row.seatCount }, (_, i) => {
                                const num = i + 1;
                                const seatKey = `${zone.id}||${row.rowLabel}||${String(num)}`;
                                const locked = seatPreviewLocks.includes(seatKey);
                                return (
                                  <button
                                    key={seatKey}
                                    type="button"
                                    title={locked ? t('activity.seatToggleOpenTitle') : t('activity.seatToggleLockTitle')}
                                    onClick={() => {
                                      setSeatPreviewLocks((d) => (d.includes(seatKey) ? d.filter((k) => k !== seatKey) : [...d, seatKey]));
                                    }}
                                    className={`w-8 h-8 text-[10px] rounded font-bold ${locked ? 'bg-violet-500 text-white hover:bg-violet-600' : 'bg-green-200 text-green-900 hover:bg-green-300'}`}
                                  >
                                    {locked ? t('activity.seatCellReserved') : String(num)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end flex-wrap">
                    <button type="button" className="px-4 py-2 rounded-lg bg-gray-200" onClick={() => setSeatEditorStep(1)}>{t('activity.prevStep')}</button>
                    <button type="button" className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold" onClick={saveSeatLayout}>{t('activity.savePublish')}</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {view === 'participants' && participants && (
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{t('activity.participantsPageTitle').replace('{name}', participants.activityName)}</h2>
            <button 
              onClick={() => setView('menu')} 
              className="text-gray-500 underline text-sm"
            >
              {t('activity.back')}
            </button>
          </div>
          
          {participants.participants.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic">
              <p>{t('activity.noParticipants')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('activity.serialNo')}</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('login.name')}</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('login.class')}</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('activity.userIdCol')}</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('activity.contact')}</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('activity.reason')}</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">{t('activity.paymentProofCol')}</th>
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
                            {t('activity.viewScreenshot')}
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
            {t('activity.totalParticipantsLine').replace('{n}', String(participants.participants.length))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityMatters;


