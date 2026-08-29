import { a1 } from './grid.js';
import { helperCell } from './layout.js';
import { COLORS, toRgb } from './palette.js';

const WINNER_FORMAT = {
  backgroundColor: toRgb(COLORS.winner),
  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
};
const DONE_FORMAT = { backgroundColor: toRgb(COLORS.resultDone) };

const oneCell = (sheetId, row, col) => ({
  sheetId,
  startRowIndex: row - 1, endRowIndex: row,
  startColumnIndex: col - 1, endColumnIndex: col,
});

const rule = (ranges, condition, format) => ({
  addConditionalFormatRule: { rule: { ranges, booleanRule: { condition, format } }, index: 0 },
});

const customFormula = (f) => ({ type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: f }] });

/**
 * 条件付き書式のルールを組む。
 *
 * Q26の判断により onEdit トリガーは使わない。条件付き書式はシートに焼き込まれるため、
 * コピーした後輩の環境でも承認なしにそのまま動く。
 * 代償として罫線の色・太さは動かせないので、勝ち上がりはセル背景で示す。
 */
export function buildConditionalFormatRules(tournament, grids, sheetIds) {
  const out = [];

  // トーナメント表: タグの付いたセルごとに1ルール
  for (const cell of grids.bracket.cells.values()) {
    const { winnerOf, championOf } = cell.style ?? {};
    const range = oneCell(sheetIds.bracket, cell.row, cell.col);
    const self = a1(cell.row, cell.col).replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2');

    if (cell.style?.helper) continue;

    if (winnerOf) {
      const w = helperCell(tournament, winnerOf, 'winner');
      // 勝者が確定していて、かつこのセルの表示がその勝者と一致するときだけ着色する。
      // 未確定のときはセルに「①の勝者」等の目印が入っているので、一致しない。
      out.push(rule([range], customFormula(`=AND(${w}<>"",${self}=${w})`), WINNER_FORMAT));
    } else if (championOf) {
      const w = helperCell(tournament, championOf, 'winner');
      out.push(rule([range], customFormula(`=${w}<>""`), WINNER_FORMAT));
    }
  }

  // 勝ち上がり経路。連結列を勝者と同じ色で塗り、マーカーでなぞったように見せる。
  // 条件はセル本体と同じ（表示中のチームが次の試合にも勝ったか）。
  for (const p of grids.bracket.paths ?? []) {
    const w = helperCell(tournament, p.winnerOf, 'winner');
    out.push(
      rule(
        [{
          sheetId: sheetIds.bracket,
          startRowIndex: p.r1 - 1, endRowIndex: p.r2,
          startColumnIndex: p.col - 1, endColumnIndex: p.col,
        }],
        customFormula(`=AND(${w}<>"",${p.cellRef}=${w})`),
        WINNER_FORMAT
      )
    );
  }

  const n = tournament.matches.length;
  const mobileStart = 5;

  // スマホ用: 結果が入ったら緑、勝者が出たら赤
  out.push(
    rule(
      [{ sheetId: sheetIds.mobile, startRowIndex: mobileStart - 1, endRowIndex: mobileStart - 1 + n, startColumnIndex: 2, endColumnIndex: 3 }],
      { type: 'NOT_BLANK' },
      DONE_FORMAT
    )
  );
  out.push(
    rule(
      [{ sheetId: sheetIds.mobile, startRowIndex: mobileStart - 1, endRowIndex: mobileStart - 1 + n, startColumnIndex: 3, endColumnIndex: 4 }],
      { type: 'NOT_BLANK' },
      WINNER_FORMAT
    )
  );

  // 進行表: 勝者列
  const pg = grids.progress;
  const winnerRows = [...pg.cells.values()].filter((c) => c.col === 6 && String(c.value).startsWith('='));
  if (winnerRows.length) {
    const r1 = Math.min(...winnerRows.map((c) => c.row));
    const r2 = Math.max(...winnerRows.map((c) => c.row));
    out.push(
      rule(
        [{ sheetId: sheetIds.progress, startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: 5, endColumnIndex: 6 }],
        { type: 'NOT_BLANK' },
        WINNER_FORMAT
      )
    );
  }

  return out;
}
