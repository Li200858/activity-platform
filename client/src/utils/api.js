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

  // 注册逻辑：仅姓名和班级
  const register = async (name, userClass) => {
    const res = await axios.post(`${API_BASE}/user/register`, { name, class: userClass });
    const userData = res.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  // 登录逻辑：姓名、班级、ID
  const login = async (name, userClass, userID) => {
    const res = await axios.post(`${API_BASE}/user/login`, { name, class: userClass, userID });
    const userData = res.data;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const copyID = () => {
    if (user && user.userID) {
      navigator.clipboard.writeText(user.userID);
      alert('ID已复制到剪贴板: ' + user.userID);
    }
  };

  return { user, login, register, logout, copyID };
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




