/**
 * 生成ペイロードをHTMLとして描き出す開発用ツール。
 *
 * Sheets へ往復しなくてもレイアウトを目で確認できるようにするのが目的。
 * payload が持つ書式をそのまま読むので、生成器の意図と食い違わない。
 * 条件付き書式は結果データに依存するため描かない（静的な意匠の確認用）。
 *
 *   node tools/preview.mjs '{"format":"single-elimination","teams":8,"courts":2}' > preview.html
 */
import { buildTournament } from '../core/index.js';
import { buildSpreadsheetPayload } from '../core/payload.js';

const config = JSON.parse(process.argv[2] ?? '{}');
const tournament = buildTournament({ scoring: 'sets-of-3', courts: 2, ...config });
const payload = buildSpreadsheetPayload(tournament);

const rgb = (c) =>
  c ? `rgb(${[c.red, c.green, c.blue].map((x) => Math.round((x ?? 0) * 255)).join(',')})` : null;

function sheetHtml(sheetId, title) {
  const cellsReq = payload.requests.find((r) => r.updateCells?.range.sheetId === sheetId);
  if (!cellsReq) return '';
  const rows = cellsReq.updateCells.rows;

  const widths = new Map();
  for (const r of payload.requests) {
    const d = r.updateDimensionProperties;
    if (d?.range.sheetId === sheetId && d.properties.pixelSize) {
      widths.set(d.range.startIndex, d.properties.pixelSize);
    }
  }
  // 罫線リクエストを (row,col,side) で引けるようにする。
  // 外周（top/bottom/left/right）は範囲の縁だけ、内側（innerVertical/innerHorizontal）は
  // セル間に引かれるので、それぞれ対象セルを分けて展開する。
  const edge = new Map();
  const put = (rr, cc, side, color, weight) => {
    const k = `${rr},${cc},${side}`;
    const cur = edge.get(k);
    if (!cur || cur.weight < weight) edge.set(k, { color, weight });
  };
  for (const r of payload.requests) {
    const b = r.updateBorders;
    if (!b || b.range.sheetId !== sheetId) continue;
    const { startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 } = b.range;
    const isGrid = Boolean(b.innerVertical || b.innerHorizontal);
    const w = isGrid ? 1 : 2; // 枝線は格子より優先して太く描く
    for (let rr = r0; rr < r1; rr++) {
      for (let cc = c0; cc < c1; cc++) {
        if (b.top && rr === r0) put(rr, cc, 'top', rgb(b.top.color), w);
        if (b.bottom && rr === r1 - 1) put(rr, cc, 'bottom', rgb(b.bottom.color), w);
        if (b.left && cc === c0) put(rr, cc, 'left', rgb(b.left.color), w);
        if (b.right && cc === c1 - 1) put(rr, cc, 'right', rgb(b.right.color), w);
        if (b.innerVertical && cc < c1 - 1) put(rr, cc, 'right', rgb(b.innerVertical.color), w);
        if (b.innerHorizontal && rr < r1 - 1) put(rr, cc, 'bottom', rgb(b.innerHorizontal.color), w);
      }
    }
  }
  // 書式は repeatCell で範囲ごとに当たるので、セル単位へ展開してから描く。
  // updateCells に書式が入っていた頃の作りのままだと、地色も罫線も出ない。
  const fmt = new Map();
  for (const r of payload.requests) {
    const rc = r.repeatCell;
    if (!rc || rc.range.sheetId !== sheetId) continue;
    const f = rc.cell.userEnteredFormat ?? {};
    for (let rr = rc.range.startRowIndex; rr < rc.range.endRowIndex; rr++) {
      for (let cc = rc.range.startColumnIndex; cc < rc.range.endColumnIndex; cc++) {
        const k = `${rr},${cc}`;
        const cur = fmt.get(k) ?? {};
        // 後から当たるものが勝つ（fields で絞った上書きと同じ順序）
        fmt.set(k, {
          ...cur,
          ...f,
          textFormat: { ...(cur.textFormat ?? {}), ...(f.textFormat ?? {}) },
        });
      }
    }
  }

  const merges = payload.requests
    .filter((r) => r.mergeCells?.range.sheetId === sheetId)
    .map((r) => r.mergeCells.range);
  const covered = new Set();
  for (const m of merges) {
    for (let rr = m.startRowIndex; rr < m.endRowIndex; rr++) {
      for (let cc = m.startColumnIndex; cc < m.endColumnIndex; cc++) {
        if (rr !== m.startRowIndex || cc !== m.startColumnIndex) covered.add(`${rr},${cc}`);
      }
    }
  }
  const spanOf = (rr, cc) => merges.find((m) => m.startRowIndex === rr && m.startColumnIndex === cc);

  let html = `<h2>${title}</h2><table>`;
  rows.forEach((row, rr) => {
    html += '<tr>';
    (row.values ?? []).forEach((cell, cc) => {
      if (covered.has(`${rr},${cc}`)) return;
      const f = fmt.get(`${rr},${cc}`) ?? {};
      const t = f.textFormat ?? {};
      const v = cell?.userEnteredValue ?? {};
      const text = v.stringValue ?? (v.formulaValue ? formulaLabel(v.formulaValue) : '');
      const st = [
        `width:${widths.get(cc) ?? 60}px`,
        f.backgroundColor ? `background:${rgb(f.backgroundColor)}` : '',
        t.bold ? 'font-weight:700' : '',
        t.fontSize ? `font-size:${t.fontSize}px` : '',
        t.foregroundColor ? `color:${rgb(t.foregroundColor)}` : '',
        f.horizontalAlignment === 'CENTER' ? 'text-align:center' : '',
        f.horizontalAlignment === 'RIGHT' ? 'text-align:right' : '',
      ];
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const e = edge.get(`${rr},${cc},${side}`);
        if (e) st.push(`border-${side}:${e.weight}px solid ${e.color}`);
      }
      const sp = spanOf(rr, cc);
      const attrs = sp ? ` colspan="${sp.endColumnIndex - sp.startColumnIndex}"` : '';
      html += `<td${attrs} style="${st.filter(Boolean).join(';')}">${escape(text)}</td>`;
    });
    html += '</tr>';
  });
  return html + '</table>';
}

/** 数式は評価できないので、未確定時に出る目印だけ拾って表示する。 */
function formulaLabel(f) {
  const q = [...f.matchAll(/,"([^"]+)"/g)];
  return q.length ? q[0][1] : '';
}
const escape = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const names = ['トーナメント表', '進行表', 'スマホ用'];
console.log(`<!doctype html><meta charset="utf-8">
<style>
  body { font-family: "Hiragino Sans", sans-serif; background:#fff; margin:24px; }
  h1 { font-size:16px; } h2 { font-size:14px; margin-top:28px; }
  table { border-collapse:collapse; }
  td { height:22px; padding:1px 4px; font-size:11px; vertical-align:middle; white-space:nowrap; overflow:hidden; }
</style>
<h1>${tournament.format} / ${tournament.teams}チーム / コート${tournament.courts}</h1>
${names.map((n, i) => sheetHtml(i, n)).join('')}`);
