import { Grid, a1 } from './grid.js';
import { liveRefFormula, controlCell } from './sheets.js';

// 実物 8team_volleyball_base.xlsx と同じ列構成
export const COLUMNS = [
  { col: 1, width: 7 },   // A: 試合番号
  { col: 2, width: 20 },  // B: 左チーム / ブラケット第1列
  { col: 3, width: 5 },   // C: vs / 連結線
  { col: 4, width: 20 },  // D: 右チーム / ブラケット第2列
  { col: 5, width: 5 },   // E: 連結線
  { col: 6, width: 26 },  // F: 説明 / ブラケット第3列
];

/**
 * ブラケット図の座標。
 *   行 = base + 2^(j+1) * i + 2^j
 *   列 = 2 + 2*j            （j = 0 が最初のエントラント列）
 * 実物の B13/B15/B17/B19 → D14/D18 → F16 (base=12) がこの式に一致する。
 */
export function bracketCell(base, round, index) {
  return {
    row: base + 2 ** (round + 1) * index + 2 ** round,
    col: 2 + 2 * round,
  };
}

export function bracketHeight(entrants) {
  return entrants * 2;
}


/**
 * トーナメント表タブのグリッドを組む。
 *
 * 構成は実物と同じ:
 *   1. タイトル
 *   2. 最終2ラウンドより前の各ラウンドを試合リストで
 *   3. 終端グループ（4チームずつ）を標準ブラケット図で
 *   4. 最終順位表
 */
// 条件付き書式の数式は他シートを参照できないため、勝者・敗者を同一シートへ写す隠し列を置く。
// INDIRECT でも回避できるが、再計算が遅れて色が残る既知の問題があるので使わない。
export const HELPER_COL = { winner: 8, loser: 9 };
export const helperRow = (matchIndex) => matchIndex + 2;

export function helperCell(tournament, matchId, kind) {
  const i = tournament.matches.findIndex((m) => m.id === matchId);
  return `$${a1(1, HELPER_COL[kind]).replace(/\d+$/, '')}$${helperRow(i)}`;
}

export function layoutBracketSheet(tournament) {
  const g = new Grid('トーナメント表');
  for (const { col, width } of COLUMNS) g.setColumnWidth(col, width);

  // 隠し補助列（H:I）。表示はしないが、条件付き書式がここを見る。
  g.set(1, HELPER_COL.winner, '（内部）勝者', { helper: true });
  g.set(1, HELPER_COL.loser, '（内部）敗者', { helper: true });
  tournament.matches.forEach((m, i) => {
    g.set(helperRow(i), HELPER_COL.winner, `=${controlCell(tournament, m.id, 'winner')}`, { helper: true });
    g.set(helperRow(i), HELPER_COL.loser, `=${controlCell(tournament, m.id, 'loser')}`, { helper: true });
  });

  let row = 1;
  g.set(row, 1, tournament.title || `トーナメント表（${tournament.teams}チーム・全${tournament.matches.length}試合）`, { bold: true, size: 14 });
  row += 1;
  g.set(row, 1, `全${tournament.matches.length}試合／各チーム${tournament.rounds}試合／1位〜${tournament.placements}位まで確定`);
  row += 2;

  const lastTwo = new Set([tournament.rounds - 1, tournament.rounds]);
  const listRounds = [...new Set(tournament.matches.map((m) => m.roundNo))]
    .filter((r) => !lastTwo.has(r))
    .sort((a, b) => a - b);

  for (const r of listRounds) {
    const ms = tournament.matches.filter((m) => m.roundNo === r);
    g.set(row, 1, `■ ${ms[0].roundName}（${ms[0].label}〜${ms[ms.length - 1].label}）${r === 1 ? '　※ここだけ抽選で決める' : ''}`, { bold: true });
    row += 1;
    g.set(row, 1, '試合').set(row, 2, '対戦カード').set(row, 6, '行き先');
    row += 1;
    for (const m of ms) {
      g.set(row, 1, m.label);
      g.set(row, 2, liveRefFormula(tournament, m.left), { winnerOf: m.id });
      g.set(row, 3, 'vs');
      g.set(row, 4, liveRefFormula(tournament, m.right), { winnerOf: m.id });
      g.set(row, 6, destinationText(tournament, m));
      row += 1;
    }
    row += 1;
  }

  // 終端グループ = 最終2ラウンドに入る4チームずつのまとまり
  for (const group of terminalGroups(tournament)) {
    g.set(row, 1, `■ ${group.title}`, { bold: true });
    row += 1;
    const base = row;
    const semiLabels = group.semis.map((x) => x.label).join('・');
    g.set(base, 2, '進出チーム')
      .set(base, 4, `${group.semis[0].roundName} ${semiLabels} の勝者`)
      .set(base, 6, `${group.final.roundName} ${group.final.label}`);
    for (let i = 0; i < group.entrants.length; i++) {
      const { row: r, col: c } = bracketCell(base, 0, i);
      // このチームが進む先は、自分が入る準決勝
      g.set(r, c, liveRefFormula(tournament, group.entrants[i]), {
        winnerOf: group.semis[Math.floor(i / 2)].id,
      });
    }
    for (let i = 0; i < group.semis.length; i++) {
      const { row: r, col: c } = bracketCell(base, 1, i);
      g.set(r, c, liveRefFormula(tournament, { type: 'winner', match: group.semis[i].id, matchLabel: group.semis[i].label }), {
        winnerOf: group.final.id,
      });
    }
    {
      const { row: r, col: c } = bracketCell(base, 2, 0);
      g.set(r, c, `=IF(${controlCell(tournament, group.final.id, 'winner')}="","★ ${group.final.decides.winner}位","★ "&${controlCell(tournament, group.final.id, 'winner')})`, { championOf: group.final.id });
    }
    row = base + bracketHeight(group.entrants.length);
    // 下位決定戦は図にせずリスト1行で置く（実物と同じ）
    g.set(row, 1, group.consolation.label);
    g.set(row, 2, liveRefFormula(tournament, group.consolation.left), { winnerOf: group.consolation.id });
    g.set(row, 3, 'vs');
    g.set(row, 4, liveRefFormula(tournament, group.consolation.right), { winnerOf: group.consolation.id });
    g.set(row, 6, `${group.consolation.roundName}（勝者＝${group.consolation.decides.winner}位／敗者＝${group.consolation.decides.loser}位）`);
    row += 2;
  }

  g.set(row, 1, '■ 最終順位', { bold: true });
  row += 1;
  g.set(row, 1, '順位').set(row, 2, 'チーム名').set(row, 6, '決定方法');
  row += 1;
  const placements = tournament.matches
    .filter((x) => x.decides)
    .flatMap((m) => [
      { rank: m.decides.winner, text: `${m.label} ${m.roundName}の勝者`, cell: controlCell(tournament, m.id, 'winner'), matchId: m.id },
      { rank: m.decides.loser, text: `${m.label} ${m.roundName}の敗者`, cell: controlCell(tournament, m.id, 'loser'), matchId: m.id },
    ])
    .sort((a, b) => a.rank - b.rank);
  for (const p of placements) {
    g.set(row, 1, `${p.rank}位`);
    g.set(row, 2, `=IF(${p.cell}="","",${p.cell})`, p.rank === 1 ? { championOf: p.matchId } : {});
    g.set(row, 6, p.text);
    row += 1;
  }
  return g;
}

function destinationText(tournament, m) {
  const label = (id) => tournament.matches.find((x) => x.id === id).label;
  const parts = [];
  if (m.winnerTo) parts.push(`勝者→${label(m.winnerTo)}`);
  if (m.loserTo) parts.push(`敗者→${label(m.loserTo)}`);
  return parts.join('　／　');
}

/** 最終2ラウンドを構成する、4チームずつのまとまりを取り出す。 */
export function terminalGroups(tournament) {
  const semis = tournament.matches.filter(
    (m) => m.roundNo === tournament.rounds - 1 && m.rankSpan === 4
  );
  const groups = [];
  const seen = new Set();
  for (const s of semis) {
    if (seen.has(s.rankStart)) continue;
    seen.add(s.rankStart);
    const pair = semis.filter((x) => x.rankStart === s.rankStart);
    const final = tournament.matches.find((m) => m.id === pair[0].winnerTo);
    const consolation = tournament.matches.find((m) => m.id === pair[0].loserTo);
    groups.push({
      title: `${s.rankStart}〜${s.rankStart + 3}位 ブラケット${s.rankStart === 1 ? '（上山）' : ''}`,
      entrants: pair.flatMap((p) => [p.left, p.right]),
      semis: pair,
      final,
      consolation,
    });
  }
  return groups.sort((a, b) => a.semis[0].rankStart - b.semis[0].rankStart);
}
