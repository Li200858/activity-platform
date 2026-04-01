const nodemailer = require('nodemailer');

let transporter = null;

function isMailConfigured() {
  const u = (process.env.SMTP_USER || '').trim();
  const p = (process.env.SMTP_PASS || '').trim();
  return !!(process.env.SMTP_HOST && u && p);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure =
      String(process.env.SMTP_SECURE).toLowerCase() === 'true' ||
      port === 465;
    transporter = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || '').trim(),
      port,
      secure,
      auth: {
        user: (process.env.SMTP_USER || '').trim(),
        pass: (process.env.SMTP_PASS || '').trim()
      },
      connectionTimeout: 20000
    });
  }
  return transporter;
}

function getFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

/**
 * 找回 ID：您好，下面是您的用户ID，此次请用ID登录：
 */
async function sendRecoveryIdEmail(to, userID) {
  const t = getTransporter();
  if (!t) throw new Error('邮件未配置');
  const text = `您好，下面是您的用户ID，此次请用ID登陆：\n\n${userID}\n`;
  await t.sendMail({
    from: getFrom(),
    to,
    subject: process.env.MAIL_SUBJECT_ID || '【活动报名】用户ID找回',
    text
  });
}

/**
 * 找回 PIN：PIN 已清除 + ID
 */
async function sendRecoveryPinEmail(to, userID) {
  const t = getTransporter();
  if (!t) throw new Error('邮件未配置');
  const text = `您好，您的PIN已被清除，下面是您的ID：\n\n${userID}\n\n此次请用ID登陆，然后重新设置PIN。\n`;
  await t.sendMail({
    from: getFrom(),
    to,
    subject: process.env.MAIL_SUBJECT_PIN || '【活动报名】PIN已清除',
    text
  });
}

module.exports = {
  isMailConfigured,
  sendRecoveryIdEmail,
  sendRecoveryPinEmail
};
