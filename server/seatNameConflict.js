/**
 * 演出选座：防止同一真人用多个账号刷票。
 * 规则：若两名用户姓名存在「至少 3 个连续相同字符」的子串（任一方姓名中包含另一方的连续 3 字），则视为冲突。
 * 不比较「编辑距离」，避免把仅差一字的不同人误判在一起；3 字连续重叠对「李昌轩」vs「李昌轩111」有效，
 * 对「王小明」vs「王小亮」通常无 3 字公共子串。
 */
function normalizeName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '');
}

function seatBookingNamesConflict(nameA, nameB) {
  const a = normalizeName(nameA);
  const b = normalizeName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 3) return false;
  for (let i = 0; i <= shorter.length - 3; i++) {
    const sub = shorter.slice(i, i + 3);
    if (longer.includes(sub)) return true;
  }
  return false;
}

module.exports = { seatBookingNamesConflict, normalizeName };
