/**
 * シート上の行位置だけを集めた場所。
 *
 * 同じ行を「書き込む側」と「参照する側」が別々に計算すると必ずずれる。
 * 実際にじゃんけん欄で1行ずれ、別チームの入力欄を指す不具合を出している。
 *
 * ここは他のモジュールを読まない。sheets.js と standings.js の双方から読むため、
 * どちらかに依存させると循環参照になる。
 */

// 進行表のチーム名記入欄の開始行
export const TEAM_INPUT_ROW = 6;
// 入力用の結果入力欄の開始行（実物の C5:C23 と同じ起点）
export const MOBILE_ROW = 5;
// 試合管理の1件目の行
export const CONTROL_ROW = 2;

export const controlRow = (i) => CONTROL_ROW + i;

const GAP = 2;

// base は「3段の判定だけで出した点」。同着の検出に使う。
// janken は入力用タブに入れる、じゃんけんの順位（1が勝ち）。
export const STANDINGS_COLS = {
  team: 1, wins: 2, got: 3, lost: 4, h2h: 5,
  base: 6, janken: 7, tie: 8, score: 9, rank: 10, beat: 12,
};

/**
 * 順位表の配置を、グリッドを作らずに算出する。
 * ブラケットの出場者（「A組1位」）も順位表を参照するので、
 * 書き込む側と参照する側で同じ計算を使う必要がある。
 */
export function standingsLayout(tournament) {
  // 試合行の直後から始める
  let row = controlRow(tournament.matches.length) + GAP;
  return tournament.groups.map((group) => {
    const block = {
      group: group.index, label: group.label,
      head: row, top: row + 1, size: group.teams.length,
      cols: STANDINGS_COLS,
    };
    row = block.top + block.size + GAP;
    return block;
  });
}

/**
 * 入力用タブのじゃんけん欄の先頭行。
 * 試合一覧の下に「空行・見出し・表ヘッダ」の3行を挟んで始める。
 */
export function jankenBase(tournament) {
  return MOBILE_ROW + tournament.matches.length + 3;
}

/** 入力用タブで、その組・その順番のチームのじゃんけん欄が何行目か。 */
export function jankenRow(tournament, groupIndex, memberIndex) {
  let row = jankenBase(tournament);
  for (const group of tournament.groups) {
    if (group.index === groupIndex) return row + memberIndex;
    row += group.teams.length;
  }
  throw new Error(`組が見つかりません: ${groupIndex}`);
}
