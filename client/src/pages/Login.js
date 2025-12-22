import React, { useState } from 'react';

function Login({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [name, setName] = useState('');
  const [userClass, setUserClass] = useState('');
  const [userID, setUserID] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'register') {
        if (name && userClass) {
          await onRegister(name, userClass);
        }
      } else {
        if (name && userClass && userID) {
          await onLogin(name, userClass, userID);
        } else {
          setError('请填写完整登录信息（包含ID）');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || '操作失败，请检查输入');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="flex mb-8 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 rounded-md transition-all ${mode === 'login' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            登录
          </button>
          <button 
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 rounded-md transition-all ${mode === 'register' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            注册
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {mode === 'login' ? '欢迎回来' : '创建新账号'}
        </h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="请输入姓名"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
            <input 
              type="text" 
              value={userClass} 
              onChange={(e) => setUserClass(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="请输入班级"
              required
            />
          </div>
          {mode === 'login' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">唯一 ID</label>
              <input 
                type="text" 
                value={userID} 
                onChange={(e) => setUserID(e.target.value)} 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="请输入您的 8 位 ID"
                required
              />
            </div>
          )}
          
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors mt-6">
            {mode === 'login' ? '立即登录' : '提交注册'}
          </button>
        </form>

        {mode === 'register' && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            注册成功后系统将为您分配一个专属 ID，请务必妥善保存。
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;






