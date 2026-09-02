import { a1 } from './grid.js';
import { helperCell } from './layout.js';
import { COLORS, toRgb } from './palette.js';

// 経路は枠も連結列も同じ濃い赤で塗る。実物（バトミントン団体戦）がこの方式で、
// 1色でつなぐことで帯が途切れず、勝ち上がりが1本の道に見える。
// 枠だけ淡くすると、枠と連結列の境目で色が変わって帯が分断される。
const WINNER_FORMAT = {
  backgroundColor: toRgb(COLORS.winner),
  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
};
const PATH_FORMAT = WINNER_FORMAT;
const DONE_FORMAT = { backgroundColor: toRgb(COLORS.resultDone) };
// 予選通過ラインの行。太字を足して、色が見えにくい環境でも判別できるようにする。
const ADVANCE_FORMAT = {
  backgroundColor: toRgb(COLORS.advance),
  textFormat: { bold: true },
};

/** 列番号を列名へ。a1() は行番号込みなので、列だけ要るときはこちらを使う。 */
function colName(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * A1参照を絶対参照へ。
 *
 * 条件付き書式の式は範囲の左上を基準に、行ごと・列ごとにずれて評価される。
 * 経路は範囲のどの行でも「同じ1セルが勝者と一致するか」を見たいので、
 * 相対参照のままだと先頭行しか塗られず、帯が1セルで途切れる（実シートで発覚）。
 */
const absolute = (ref) =>
  String(ref).replace(/\$/g, '').replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2');

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
        customFormula(`=AND(${w}<>"",${absolute(p.cellRef)}=${w})`),
        PATH_FORMAT
      )
    );
  }

  // 予選の通過ライン。順位が定員以内の行を塗る。
  // 順位はこのシート内（1列目）に出ているので、他シートを見に行かずに済む。
  for (const a of grids.bracket.advances ?? []) {
    out.push(
      rule(
        [{
          sheetId: sheetIds.bracket,
          startRowIndex: a.r1 - 1, endRowIndex: a.r2,
          startColumnIndex: a.c1 - 1, endColumnIndex: a.c2,
        }],
        customFormula(`=AND($${colName(a.rankCol)}${a.r1}<>"",$${colName(a.rankCol)}${a.r1}<=${a.cutoff})`),
        ADVANCE_FORMAT
      )
    );
  }

  // じゃんけん欄は常に置いてあるが、規定で決まらない組だけ黄色くして気づけるようにする。
  // Sheets は列を条件で出し入れできないので、色で「今これが要る」を伝える。
  //
  // 入力用タブは記入欄そのもの、トーナメント表は「入力用へ行け」という合図。
  // どちらも判定は同じで、すぐ右の列に写した「要じゃんけん」の印を見る。
  // 条件付き書式は他シートを参照できないため、この写しが要る。
  for (const [key, grid] of [['bracket', grids.bracket], ['mobile', grids.mobile]]) {
    for (const cell of grid.cells.values()) {
      if (!cell.style?.jankenOf) continue;
      out.push(
        rule(
          [{
            sheetId: sheetIds[key],
            startRowIndex: cell.row - 1, endRowIndex: cell.row,
            startColumnIndex: cell.col - 1, endColumnIndex: cell.col,
          }],
          // a1() は行番号を含むので、列名だけを取り出す。
          customFormula(`=$${colName(cell.col + 1)}$${cell.row}<>""`),
          { backgroundColor: toRgb(COLORS.resultPending), textFormat: { bold: true } }
        )
      );
    }
  }

  const n = tournament.matches.length;
  const mobileStart = 5;

  // 入力用: 結果が入ったら緑、勝者が出たら赤
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

  // 進行表: 勝者のセル。コートが列になったので位置が固定でなく、行も飛び飛びになる。
  // 列番号で拾うと試合名や結果の行まで巻き込むため、グリッドが付けた印から探す。
  // 1本のルールに複数の範囲を持たせるので、ルール数は増えない。
  const winnerCells = [...grids.progress.cells.values()]
    .filter((c) => c.style?.progressWinner)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  if (winnerCells.length) {
    out.push(
      rule(
        winnerCells.map((c) => ({
          sheetId: sheetIds.progress,
          startRowIndex: c.row - 1, endRowIndex: c.row,
          startColumnIndex: c.col - 1, endColumnIndex: c.col,
        })),
        { type: 'NOT_BLANK' },
        WINNER_FORMAT
      )
    );
  }

  return out;
}
