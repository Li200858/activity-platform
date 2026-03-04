import React from 'react';

/**
 * 仅展示用户发布的原文，不再调用翻译接口（避免网站变慢）。
 * 界面语言仍由 LanguageContext + t() 控制，用户内容始终显示原文。
 */
export function TranslatableContent({ children, as: Tag = 'span', className }) {
  const raw = typeof children === 'string' ? children : (children?.props?.children ?? '');
  const text = raw != null ? String(raw) : '';
  return <Tag className={className}>{text}</Tag>;
}
