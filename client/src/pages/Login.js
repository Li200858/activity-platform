import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../utils/api';

function Login({ onLogin, onRegister }) {
  const { t, isEn } = useLanguage();
  const [loginMode, setLoginMode] = useState('pin'); // 'pin' | 'id'
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState('');
  const [userClass, setUserClass] = useState('');
  const [userID, setUserID] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerPin, setRegisterPin] = useState('');
  const [error, setError] = useState('');
  const [redirectMessage, setRedirectMessage] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [recovery, setRecovery] = useState({ name: '', class: '', email: '' });
  const [recoveryMessage, setRecoveryMessage] = useState('');

  const resetForm = () => {
    setError('');
    setRedirectMessage('');
    setShowPassword(false);
    setPassword('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRedirectMessage('');
    try {
      if (loginMode === 'pin') {
        if (!name.trim() || !userClass.trim() || !pin.trim()) {
          setError(t('login.errorPin'));
          return;
        }
        await onLogin(name.trim(), userClass.trim(), null, showPassword ? password : undefined, pin.trim(), 'pin');
      } else {
        if (!name.trim() || !userClass.trim() || !userID.trim()) {
          setError(t('login.errorId'));
          return;
        }
        await onLogin(name.trim(), userClass.trim(), userID.trim(), showPassword ? password : undefined, undefined, 'id');
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.requirePassword) {
        setShowPassword(true);
        setError(data.error || (isEn ? 'Super admin requires password' : '超级管理员需要输入密码'));
      } else if (data?.requirePinLogin) {
        setLoginMode('pin');
        setRedirectMessage(t('login.usePinLoginHint'));
        setError('');
      } else {
        setError(data?.error || (t('common.fail') + ', ' + (t('login.error') || '')));
      }
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !userClass.trim()) {
      setError(t('login.error'));
      return;
    }
    try {
      const pinVal = registerPin.trim();
      await onRegister(name.trim(), userClass.trim(), (pinVal && /^\d{4,6}$/.test(pinVal)) ? pinVal : undefined);
      setShowRegister(false);
      setName('');
      setUserClass('');
      setRegisterPin('');
    } catch (err) {
      setError(err.response?.data?.error || t('login.recoveryFail'));
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
      const endpoint = loginMode === 'pin' ? '/pin-recovery' : '/id-recovery';
      const { data } = await api.post(endpoint, {
        name: recovery.name.trim(),
        class: recovery.class.trim(),
        email: recovery.email.trim()
      });
      if (data?.auto) {
        setRecoveryMessage(t('login.recoverySuccessAuto'));
      } else {
        const manualKey =
          data?.manualReason === 'user_not_matched'
            ? 'login.recoveryManualUserNotMatched'
            : data?.manualReason === 'smtp_not_configured'
              ? 'login.recoveryManualSmtp'
              : data?.manualReason === 'mail_send_failed'
                ? 'login.recoveryManualMailFail'
                : null;
        setRecoveryMessage(manualKey ? t(manualKey) : t('login.recoverySuccess'));
      }
    } catch (err) {
      setRecoveryMessage(err.response?.data?.error || t('login.recoveryFail'));
    }
  };

  if (showRegister) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gray-50 p-4 max-md:landscape:items-start max-md:landscape:py-6">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-md max-h-[calc(100dvh-2rem)] max-md:landscape:max-h-none overflow-y-auto">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">{t('login.createAccount')}</h2>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.name')}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('login.namePlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.class')}</label>
              <input type="text" value={userClass} onChange={e => setUserClass(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('login.classPlaceholder')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN（可选，4-6 位）</label>
              <input type="password" inputMode="numeric" maxLength={6} value={registerPin} onChange={e => setRegisterPin(e.target.value.replace(/\D/g, ''))} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder={isEn ? 'Leave empty to skip' : '留空则不设置'} />
              <p className="mt-1 text-xs text-amber-600">{t('login.registerPinHint')}</p>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">{t('login.submitRegister')}</button>
          </form>
          <p className="mt-4 text-xs text-gray-500 text-center">{t('login.registerTip')}</p>
          <button type="button" onClick={() => { setShowRegister(false); setError(''); }} className="mt-4 w-full text-xs text-blue-600 hover:underline">
            {isEn ? 'Back to login' : '返回登录'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gray-50 p-4 max-md:landscape:items-start max-md:landscape:py-6">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-md max-h-[calc(100dvh-2rem)] max-md:landscape:max-h-none overflow-y-auto">
        <div className="flex mb-6 sm:mb-8 bg-gray-100 p-1 rounded-lg max-md:landscape:mb-4">
          <button
            onClick={() => { setLoginMode('pin'); resetForm(); setPin(''); setUserID(''); setShowRecovery(false); }}
            className={`flex-1 py-2 rounded-md transition-all ${loginMode === 'pin' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            {t('login.loginWithPin')}
          </button>
          <button
            onClick={() => { setLoginMode('id'); resetForm(); setPin(''); setUserID(''); setShowRecovery(false); }}
            className={`flex-1 py-2 rounded-md transition-all ${loginMode === 'id' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-gray-500'}`}
          >
            {t('login.loginWithId')}
          </button>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">{t('login.welcomeBack')}</h2>

        {redirectMessage && <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200">{redirectMessage}</div>}
        {error && <div className="mb-4 p-3 bg-red-100 text-red-600 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.name')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('login.namePlaceholder')} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.class')}</label>
            <input type="text" value={userClass} onChange={e => setUserClass(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={t('login.classPlaceholder')} required />
          </div>
          {loginMode === 'pin' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.pinLabel')}</label>
              <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder={t('login.pinPlaceholder')} required />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('login.idLabel')}</label>
              <input type="text" value={userID} onChange={e => setUserID(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder={t('login.idPlaceholder')} required />
            </div>
          )}
          {showPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isEn ? 'Super admin password' : '超级管理员密码'}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder={isEn ? 'Enter password' : '请输入密码'} required />
            </div>
          )}
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors mt-6">{t('login.submitLogin')}</button>
        </form>

        <div className="mt-6 pt-4 border-t flex justify-between items-center">
          <button type="button" onClick={() => setShowRecovery(v => !v)} className="text-xs text-blue-600 hover:text-blue-800 underline font-bold">
            {loginMode === 'pin' ? t('login.forgotPin') : t('login.forgotId')}
          </button>
          <button type="button" onClick={() => { setShowRegister(true); setError(''); }} className="text-xs text-blue-600 hover:text-blue-800 underline font-bold">
            {t('login.register')}
          </button>
        </div>

        {showRecovery && (
          <form onSubmit={handleRecoverySubmit} className="mt-3 space-y-3 text-xs">
            <p className="text-amber-600 font-medium mb-1">⚠️ {loginMode === 'pin' ? t('login.forgotPinHint') : t('login.forgotIdHint')}</p>
            <p className="text-gray-500 mb-1">{loginMode === 'pin' ? t('login.forgotPinDesc') : t('login.forgotIdDesc')}</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder={t('login.namePlaceholder')} value={recovery.name} onChange={e => setRecovery(r => ({ ...r, name: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-1" required />
              <input type="text" placeholder={t('login.classPlaceholder')} value={recovery.class} onChange={e => setRecovery(r => ({ ...r, class: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-1" required />
            </div>
            <input type="email" placeholder={t('login.emailPlaceholder')} value={recovery.email} onChange={e => setRecovery(r => ({ ...r, email: e.target.value }))} className="border border-gray-300 rounded-lg px-2 py-1 w-full" required />
            <button type="submit" className="w-full bg-gray-900 text-white py-2 rounded-lg font-bold hover:bg-black transition-colors">{t('login.submitRecovery')}</button>
            {recoveryMessage && <p className="mt-1 text-[11px] text-gray-600">{recoveryMessage}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
