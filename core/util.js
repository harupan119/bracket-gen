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

/** 列幅1単位あたりのピクセル数。実物の列幅（文字数指定）を px へ写すときの係数。 */
export const COL_UNIT_PX = 7.5;

/**
 * 文字列の表示幅（px）のおおよそ。
 *
 * THEME.sizes はポイント値なので px へ直す（1pt = 4/3px）。ここを取り違えると
 * 幅を3割ほど過小に見積もり、「収まっている」と判断したまま実物では見切れる。
 * 全角は 1em、半角はその 0.55 倍で見積もる。列幅を決めるためのざっくり値。
 */
export function textPx(text, sizePt) {
  const em = sizePt * (4 / 3);
  let w = 0;
  for (const ch of String(text ?? '')) w += /[\x20-\x7E]/.test(ch) ? em * 0.55 : em;
  return w;
}

/** px を列幅の単位へ。切り上げるので、返り値の幅には必ず収まる。 */
export function colUnits(px) {
  return Math.ceil(px / COL_UNIT_PX);
}

/**
 * セルの左右の余白（px、両側の合計）。
 * Sheets は列幅いっぱいまで文字を描かず、左右に約3pxずつ空ける。
 * これを見ずに幅を判定すると、計算上は収まっているのに実物では右端が切れる。
 */
export const CELL_PAD_PX = 10;

/** その列幅に文字が収まるか。余白を引いた実効幅で判定する。 */
export function fitsInColumn(text, sizePt, units) {
  return textPx(text, sizePt) <= units * COL_UNIT_PX - CELL_PAD_PX;
}

/** ブラケットの箱とチーム名欄の列幅（列幅単位）。実物の実測値。 */
export const BOX_COL_UNITS = 20;

/**
 * その列幅に1行で収まる全角文字数。
 * 溢れたぶんは折り返して枠が縦に伸びるので、記入する人に上限を伝えるために使う。
 */
export function fullWidthFit(sizePt, units = BOX_COL_UNITS) {
  return Math.floor((units * COL_UNIT_PX) / textPx('あ', sizePt));
}
