import axios from 'axios';
import { useState, useEffect } from 'react';

// 支持生产环境和开发环境
const API_BASE = process.env.REACT_APP_API_URL 
  ? `${process.env.REACT_APP_API_URL}/api`
  : 'http://localhost:5001/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // 注册逻辑：姓名、班级，可选 PIN（4-6 位防冒充）
  const register = async (name, userClass, pin) => {
    const res = await axios.post(`${API_BASE}/user/register`, { name, class: userClass, pin: pin || undefined });
    const userData = res.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  // 登录逻辑：loginMode='pin' 时只需 name+class+pin；loginMode='id' 时需 name+class+userID
  const login = async (name, userClass, userID, password, pin, loginMode = 'id') => {
    const payload = { name, class: userClass, loginMode };
    if (loginMode === 'pin') {
      payload.pin = pin;
      if (password) payload.password = password; // super_admin 需密码
    } else {
      payload.userID = userID;
      if (password) payload.password = password;
      if (pin) payload.pin = pin;
    }
    const res = await axios.post(`${API_BASE}/user/login`, payload);
    const userData = res.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const updateEnglishName = async (englishName) => {
    if (!user || !user.userID) return;
    const res = await axios.put(`${API_BASE}/user/english-name`, { userID: user.userID, englishName, operatorID: user.userID });
    const userData = res.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const setPin = async (pin) => {
    if (!user || !user.userID) return;
    const res = await axios.put(`${API_BASE}/user/set-pin`, { userID: user.userID, operatorID: user.userID, pin: pin || null });
    const userData = res.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const copyID = () => {
    if (user && user.userID) {
      navigator.clipboard.writeText(user.userID);
      alert('ID已复制到剪贴板: ' + user.userID);
    }
  };

  return { user, login, register, logout, copyID, updateEnglishName, setPin };
};

// 创建axios实例，配置超时时间
const axiosInstance = axios.create({
  timeout: 30000, // 30秒超时
});

export const api = {
  get: (url) => axiosInstance.get(`${API_BASE}${url}`),
  post: (url, data) => axiosInstance.post(`${API_BASE}${url}`, data),
  put: (url, data) => axiosInstance.put(`${API_BASE}${url}`, data),
  delete: (url) => axiosInstance.delete(`${API_BASE}${url}`),
};

// 通过 fetch 下载文件并触发保存（避免 window.open 导致的 ERR_INVALID_RESPONSE）
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
export const downloadExport = async (path, filename) => {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '下载失败');
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'export.xlsx';
  a.click();
  URL.revokeObjectURL(a.href);
};




