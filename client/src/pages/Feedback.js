import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

function Feedback({ user }) {
  const [content, setContent] = useState('');
  const [myFeedbacks, setMyFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMyFeedbacks();
  }, []);

  const fetchMyFeedbacks = async () => {
    try {
      const res = await api.get(`/feedback/my/${user.userID}`);
      setMyFeedbacks(res.data);
    } catch (e) {
      console.error("加载我的反馈失败", e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await api.post('/feedback', { content, authorID: user.userID });
      alert('反馈已提交，管理员将尽快处理！');
      setContent('');
      fetchMyFeedbacks();
    } catch (e) {
      alert('提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
        <h2 className="text-3xl font-black text-gray-800 mb-6 flex items-center gap-3">
          意见反馈
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <textarea 
              placeholder="在这里输入您的建议、反馈或遇到的问题..." 
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-3xl px-6 py-5 min-h-[180px] outline-none focus:ring-4 focus:ring-blue-100 transition-all text-gray-700 leading-relaxed"
              required
            />
            <div className="absolute bottom-4 right-6 text-[10px] font-black text-gray-300 uppercase tracking-widest pointer-events-none">
              Your feedback matters
            </div>
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 hover:scale-[1.01] active:scale-95 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '提交中...' : '发送反馈'}
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-4">我的反馈历史</h3>
        <div className="grid gap-4">
          {myFeedbacks.length === 0 && (
            <div className="p-12 text-center text-gray-400 bg-white/50 rounded-3xl border border-dashed border-gray-300 italic">
              您还没有提交过反馈
            </div>
          )}
          {myFeedbacks.map(f => (
            <div key={f.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${f.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                  {f.status === 'pending' ? '待回复' : '已回复'}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4 bg-gray-50 p-4 rounded-2xl">
                {f.content}
              </p>
              {f.adminReply && (
                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 relative">
                  <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md tracking-tighter">
                    Admin Reply
                  </div>
                  <p className="text-blue-800 font-medium italic">“ {f.adminReply} ”</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Feedback;








