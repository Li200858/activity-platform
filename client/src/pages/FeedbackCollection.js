import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

function FeedbackCollection({ user }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const res = await api.get('/admin/feedback');
      setFeedbacks(res.data);
    } catch (e) {
      console.error("加载反馈失败", e);
    }
  };

  const handleReply = async (feedbackID) => {
    if (!replyText.trim()) return;
    try {
      await api.post('/admin/feedback/reply', {
        feedbackID,
        reply: replyText,
        operatorID: user.userID
      });
      alert('回复成功');
      setReplyText('');
      setSelectedFeedback(null);
      fetchFeedbacks();
    } catch (e) {
      alert('回复失败');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
        反馈收集箱
      </h2>

      <div className="grid gap-4">
        {feedbacks.length === 0 && <div className="p-20 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">暂无任何反馈内容</div>}
        {feedbacks.map(f => (
          <div key={f.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${f.status === 'pending' ? 'border-orange-200 ring-4 ring-orange-50' : 'border-gray-100'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-400 uppercase">
                  {f.authorName.charAt(0)}
                </div>
                <div>
                  <p className="font-black text-gray-800">{f.authorName}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">{f.authorClass} · {new Date(f.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${f.status === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                {f.status === 'pending' ? '待处理' : '已解决'}
              </span>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl mb-4">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{f.content}</p>
            </div>

            {f.adminReply && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4">
                <div className="flex items-center gap-2 mb-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                  <span>官方回复</span>
                </div>
                <p className="text-blue-800 italic">{f.adminReply}</p>
              </div>
            )}

            {!f.adminReply && (
              <div className="flex gap-2">
                <textarea
                  placeholder="输入回复内容..."
                  value={selectedFeedback === f.id ? replyText : ''}
                  onChange={(e) => {
                    setSelectedFeedback(f.id);
                    setReplyText(e.target.value);
                  }}
                  onFocus={() => setSelectedFeedback(f.id)}
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  rows="1"
                />
                <button 
                  onClick={() => handleReply(f.id)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black hover:bg-blue-700 disabled:opacity-50"
                  disabled={selectedFeedback !== f.id || !replyText.trim()}
                >
                  发送回复
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FeedbackCollection;






