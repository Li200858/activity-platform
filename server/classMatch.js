/**
 * 班级字符串宽松匹配（如系统登记 1.5 与用户填写 一五）
 * 依赖：User.name 全局唯一，每人至多一条用户记录。
 */

const CN_DIGIT = {
  〇: '0', 零: '0',
  一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 两: '2'
};

function normalizeFullWidthDigits(s) {
  return s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
}

function chineseDigitsToAscii(s) {
  let out = '';
  for (const ch of s) {
    out += CN_DIGIT[ch] !== undefined ? CN_DIGIT[ch] : ch;
  }
  return out;
}

/** 两位中文数字连写（如 一五）按「年级.班」记法转为 1.5 */
function twoChineseDigitsToDecimalForm(str) {
  const s = String(str).normalize('NFKC').trim().replace(/\s+/g, '');
  const m = /^([一二三四五六七八九两])([一二三四五六七八九])$/.exec(s);
  if (!m) return null;
  const a = CN_DIGIT[m[1]];
  const b = CN_DIGIT[m[2]];
  if (!a || !b) return null;
  return `${a}.${b}`;
}

function canonicalizeClass(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.normalize('NFKC').trim().replace(/\s+/g, '');
  s = normalizeFullWidthDigits(s);
  s = s.replace(/[．。]/g, '.');
  s = chineseDigitsToAscii(s);
  return s.toLowerCase();
}

function classesMatch(stored, input) {
  const a = String(stored).trim();
  const b = String(input).trim();
  if (a === b) return true;
  const ca = canonicalizeClass(a);
  const cb = canonicalizeClass(b);
  if (ca && ca === cb) return true;
  const ta = twoChineseDigitsToDecimalForm(a);
  const tb = twoChineseDigitsToDecimalForm(b);
  if (ta && cb === ta) return true;
  if (tb && ca === tb) return true;
  if (ta && tb && ta === tb) return true;
  return false;
}

/**
 * @param {import('mongoose').Model} User
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function findUserByNameAndClassLoose(User, name, classInput) {
  const n = (name || '').trim();
  const c = (classInput || '').trim();
  if (!n) return null;
  const user = await User.findOne({ name: n });
  if (!user) return null;
  if (classesMatch(user.class, c)) return user;
  return null;
}

module.exports = {
  classesMatch,
  canonicalizeClass,
  findUserByNameAndClassLoose
};
