// 丸数字。①〜⑳ (U+2460..) と ㉑〜㉟ (U+3251..) を使い、超えたら素の数字。
export function circled(n) {
  if (n >= 1 && n <= 20) return String.fromCodePoint(0x2460 + n - 1);
  if (n >= 21 && n <= 35) return String.fromCodePoint(0x3251 + n - 21);
  return String(n);
}

// チーム記号。A, B, C ... Z。
export function teamLabel(i) {
  return String.fromCharCode(65 + i);
}

export function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/**
 * 標準のブラケットシード順。1位と最下位が最も遠い位置になるよう再帰的に折り返す。
 * size は2の冪。返り値は各スロットに入るシード番号。
 */
export function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    const next = [];
    for (const s of order) next.push(s, n + 1 - s);
    order = next;
  }
  return order;
}
