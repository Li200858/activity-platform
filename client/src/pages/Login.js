import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

function Login({ onLogin, onRegister }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState('login');
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
          setError(t('login.error'));
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || (t('common.fail') + ', ' + (t('login.error') || '')));
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
            {t('login.login')}
          </button>
          <button 
            onClick={() => { setMode('register'); setError(''); }}
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
          )}
          
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors mt-6">
            {mode === 'login' ? t('login.submitLogin') : t('login.submitRegister')}
          </button>
        </form>

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









