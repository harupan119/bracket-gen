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
  // 罫線リクエストを (row,col,side) で引けるようにする
  const edge = new Map();
  for (const r of payload.requests) {
    const b = r.updateBorders;
    if (!b || b.range.sheetId !== sheetId) continue;
    const side = ['top', 'bottom', 'left', 'right'].find((s) => b[s]);
    for (let rr = b.range.startRowIndex; rr < b.range.endRowIndex; rr++) {
      for (let cc = b.range.startColumnIndex; cc < b.range.endColumnIndex; cc++) {
        edge.set(`${rr},${cc},${side}`, rgb(b[side].color));
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
      const f = cell?.userEnteredFormat ?? {};
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
      ];
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const box = f.borders?.[side];
        const line = edge.get(`${rr},${cc},${side}`);
        if (line) st.push(`border-${side}:2px solid ${line}`);
        else if (box) st.push(`border-${side}:1px solid ${rgb(box.color)}`);
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
