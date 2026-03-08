import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../utils/api';

function Login({ onLogin, onRegister }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [userClass, setUserClass] = useState('');
  const [userID, setUserID] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [registerPin, setRegisterPin] = useState(''); // 注册时可选 PIN
  const [showRecovery, setShowRecovery] = useState(false);
  const [recovery, setRecovery] = useState({ name: '', class: '', email: '' });
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'register') {
        if (name && userClass) {
          const pinVal = registerPin.trim();
          await onRegister(name, userClass, (pinVal && /^\d{4,6}$/.test(pinVal)) ? pinVal : undefined);
        }
      } else {
        if (name && userClass && userID) {
          await onLogin(name, userClass, userID, showPassword ? password : undefined, showPin ? pin : undefined);
        } else {
          setError(t('login.error'));
        }
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.requirePassword) {
        setShowPassword(true);
        setError(data.error || '超级管理员需要输入密码');
      } else if (data?.requirePin) {
        setShowPin(true);
        setError(data.error || '请输入 4-6 位 PIN');
      } else {
        setError(data?.error || (t('common.fail') + ', ' + (t('login.error') || '')));
      }
    }
  };

  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setRecoveryMessage('');
    if (!recovery.name.trim() || !recovery.class.trim() || !recovery.email.trim()) {
      setRecoveryMessage(t('login.recoveryFail'));
      return;
    }
    try {
      await api.post('/id-recovery', { 
        name: recovery.name.trim(),
        class: recovery.class.trim(),
        email: recovery.email.trim()
      });
      setRecoveryMessage(t('login.recoverySuccess'));
    } catch (err) {
      setRecoveryMessage(err.response?.data?.error || t('login.recoveryFail'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="flex mb-8 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => { setMode('login'); setError(''); setShowPassword(false); setPassword(''); setShowPin(false); setPin(''); }}
            className={`flex-1 py-2 rounded-md transition-all ${mode === 'login' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            {t('login.login')}
          </button>
          <button 
            onClick={() => { setMode('register'); setError(''); setShowPassword(false); setPassword(''); setRegisterPin(''); }}
            className={`flex-1 py-2 rounded-md transition-all ${mode === 'register' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            {t('login.register')}
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {mode === 'login' ? t('login.welcomeBack') : t('login.createAccount')}
        </h2>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.name')}</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={t('login.namePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.class')}</label>
            <input 
              type="text" 
              value={userClass} 
              onChange={(e) => setUserClass(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={t('login.classPlaceholder')}
              required
            />
          </div>
          {mode === 'login' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.idLabel')}</label>
                <input 
                  type="text" 
                  value={userID} 
                  onChange={(e) => setUserID(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  placeholder={t('login.idPlaceholder')}
                  required
                />
              </div>
              {showPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">超级管理员密码</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="请输入密码"
                    required
                  />
                </div>
              )}
              {showPin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN（4-6 位数字）</label>
                  <input 
                    type="password" 
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin} 
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="请输入 4-6 位 PIN"
                    required
                  />
                </div>
              )}
            </>
          )}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN（可选，4-6 位防冒充）</label>
              <input 
                type="password" 
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={registerPin} 
                onChange={(e) => setRegisterPin(e.target.value.replace(/\D/g, ''))} 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="留空则不设置"
              />
            </div>
          )}
          
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors mt-6">
            {mode === 'login' ? t('login.submitLogin') : t('login.submitRegister')}
          </button>
        </form>

        {/* 找回ID */}
        <div className="mt-6 border-t pt-4">
          <button
            type="button"
            onClick={() => setShowRecovery(v => !v)}
            className="text-xs text-blue-600 hover:text-blue-800 underline font-bold"
          >
            {t('login.forgotId')}
          </button>
          {showRecovery && (
            <form onSubmit={handleRecoverySubmit} className="mt-3 space-y-3 text-xs">
              <p className="text-amber-600 font-medium mb-1">⚠️ {t('login.forgotIdHint')}</p>
              <p className="text-gray-500 mb-1">{t('login.forgotIdDesc')}</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t('login.namePlaceholder')}
                  value={recovery.name}
                  onChange={e => setRecovery(r => ({ ...r, name: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-2 py-1"
                  required
                />
                <input
                  type="text"
                  placeholder={t('login.classPlaceholder')}
                  value={recovery.class}
                  onChange={e => setRecovery(r => ({ ...r, class: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-2 py-1"
                  required
                />
              </div>
              <input
                type="email"
                placeholder={t('login.emailPlaceholder')}
                value={recovery.email}
                onChange={e => setRecovery(r => ({ ...r, email: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-1 w-full"
                required
              />
              <button
                type="submit"
                className="w-full bg-gray-900 text-white py-2 rounded-lg font-bold hover:bg-black transition-colors"
              >
                {t('login.submitRecovery')}
              </button>
              {recoveryMessage && (
                <p className="mt-1 text-[11px] text-gray-600">{recoveryMessage}</p>
              )}
            </form>
          )}
        </div>

        {mode === 'register' && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            {t('login.registerTip')}
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;









