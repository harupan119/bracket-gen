/**
 * セルを書き込むグリッド。二重書き込みと結合範囲の重なりを検出する。
 * 目視でしか見つからなかったレイアウト崩れを、機械で先に落とすのが目的。
 */
export class Grid {
  constructor(name) {
    this.name = name;
    this.cells = new Map();   // "r,c" -> { row, col, value, style }
    this.merges = [];         // { r1, c1, r2, c2 }
    this.borders = [];        // { r1, c1, r2, c2, side } side: 'bottom' | 'left'
    this.columns = new Map(); // col -> width
  }

  key(row, col) {
    return `${row},${col}`;
  }

  set(row, col, value, style = {}) {
    if (!Number.isInteger(row) || row < 1 || !Number.isInteger(col) || col < 1) {
      throw new Error(`${this.name}: 不正なセル位置 (${row}, ${col})`);
    }
    const k = this.key(row, col);
    if (this.cells.has(k)) {
      throw new Error(
        `${this.name}: セル ${a1(row, col)} への二重書き込み。` +
          `既存="${this.cells.get(k).value}" 新規="${value}"`
      );
    }
    this.cells.set(k, { row, col, value, style });
    return this;
  }

  merge(r1, c1, r2, c2) {
    const box = { r1, c1, r2, c2 };
    for (const m of this.merges) {
      if (r1 <= m.r2 && m.r1 <= r2 && c1 <= m.c2 && m.c1 <= c2) {
        throw new Error(
          `${this.name}: 結合範囲の重なり ${a1(r1, c1)}:${a1(r2, c2)} と ${a1(m.r1, m.c1)}:${a1(m.r2, m.c2)}`
        );
      }
    }
    // 結合範囲の左上以外に値があるとGoogle Sheets側で値が消える。
    // 書式を載せるためだけの空セルは、結合で吸収されるので許容する。
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        const cell = this.cells.get(this.key(r, c));
        if (cell && cell.value !== '' && cell.value != null) {
          throw new Error(`${this.name}: 結合範囲 ${a1(r1, c1)}:${a1(r2, c2)} の内側 ${a1(r, c)} に値があります`);
        }
      }
    }
    this.merges.push(box);
    return this;
  }

  /** 範囲の片側に罫線を引く。ブラケットの枝を描くのに使う。 */
  border(r1, c1, r2, c2, side) {
    this.borders.push({ r1, c1, r2, c2, side });
    return this;
  }

  setColumnWidth(col, width) {
    this.columns.set(col, width);
    return this;
  }

  get maxRow() {
    let m = 0;
    for (const c of this.cells.values()) m = Math.max(m, c.row);
    for (const b of this.merges) m = Math.max(m, b.r2);
    return m;
  }

  get maxCol() {
    let m = 0;
    for (const c of this.cells.values()) m = Math.max(m, c.col);
    for (const b of this.merges) m = Math.max(m, b.c2);
    return m;
  }
}

export function a1(row, col) {
  let s = '';
  let n = col;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s + row;
}
