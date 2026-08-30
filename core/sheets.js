import { Grid } from './grid.js';
import { getScoring } from './scoring.js';
import { eliminationRule } from './layout.js';
import { writeStandings, groupRankFormula } from './standings.js';

export const TABS = {
  bracket: 'トーナメント表',
  progress: '進行表',
  mobile: 'スマホ用',
  control: '試合管理',
};

// 進行表のチーム名記入欄の開始行
const TEAM_INPUT_ROW = 6;
// スマホ用の結果入力欄の開始行（実物の C5:C23 と同じ起点）
const MOBILE_ROW = 5;
// 試合管理の1件目の行
const CONTROL_ROW = 2;

export const cellRefs = {
  teamName: (i) => `'${TABS.progress}'!$B$${TEAM_INPUT_ROW + i}`,
  mobileInput: (i) => `'${TABS.mobile}'!$C$${MOBILE_ROW + i}`,
  controlRow: (i) => CONTROL_ROW + i,
};

const matchIndex = (t, id) => t.matches.findIndex((m) => m.id === id);

/** 試合管理の勝者/敗者セルを指すA1参照。 */
export function controlCell(tournament, matchId, kind) {
  const col = kind === 'winner' ? 'E' : 'F';
  return `'${TABS.control}'!$${col}$${cellRefs.controlRow(matchIndex(tournament, matchId))}`;
}

/**
 * 表示用セルの数式。未確定なら進み方の目印（「①の勝者」等）を出し、
 * 確定したら実際のチーム名に変わる。
 */
export function liveRefFormula(tournament, ref) {
  if (ref.type === 'team') {
    const c = cellRefs.teamName(ref.index);
    return `=IF(${c}="","（${ref.label}チーム）",${c})`;
  }
  if (ref.type === 'groupRank') {
    // 予選が終わるまで誰か分からない。順位表から引き、未確定なら組と順位を目印に出す。
    const f = groupRankFormula(tournament, ref.group, ref.rank);
    return `=IF(${f}="","${ref.label}",${f})`;
  }
  const cell = controlCell(tournament, ref.match, ref.type);
  const placeholder = `${ref.matchLabel}の${ref.type === 'winner' ? '勝者' : '敗者'}`;
  return `=IF(${cell}="","${placeholder}",${cell})`;
}

/** 試合管理タブ（非表示）。依存関係の解決と勝敗判定をここに集約する。 */
export function layoutControlSheet(tournament) {
  const g = new Grid(TABS.control);
  const sc = getScoring(tournament.scoring);

  const head = ['試合', '左チーム', '右チーム', '結果', '勝者', '敗者', '状態'];
  head.forEach((h, i) => g.set(1, i + 1, h, { bold: true }));

  tournament.matches.forEach((m, i) => {
    const r = cellRefs.controlRow(i);
    const side = (ref) => {
      if (ref.type === 'team' || ref.type === 'groupRank') return liveRefFormula(tournament, ref);
      const src = cellRefs.controlRow(matchIndex(tournament, ref.match));
      const col = ref.type === 'winner' ? 'E' : 'F';
      return `=IF($${col}$${src}="","",$${col}$${src})`;
    };
    const won = sc.leftWins(`$D${r}`);
    g.set(r, 1, m.label);
    if (m.playedIf) {
      // 条件付きの試合（決勝リセット）。条件を満たすまで対戦カードを出さない。
      const src = cellRefs.controlRow(matchIndex(tournament, m.playedIf.match));
      const side2 = m.playedIf.side === 'left' ? 'B' : 'C';
      const cond = `AND($E$${src}<>"",$E$${src}=$${side2}$${src})`;
      // 左右はモデルの参照どおり（左＝元試合の勝者 E列 / 右＝敗者 F列）に並べる。
      // ここを元試合の B/C（当初の左右）にすると、同じ "2-1" がモデルと逆の勝者を指す。
      g.set(r, 2, `=IF(${cond},$E$${src},"")`);
      g.set(r, 3, `=IF(${cond},$F$${src},"")`);
    } else {
      g.set(r, 2, side(m.left));
      g.set(r, 3, side(m.right));
    }
    g.set(r, 4, `=${cellRefs.mobileInput(i)}`);
    g.set(r, 5, `=IF($D${r}="","",IF(${won},$B${r},$C${r}))`);
    g.set(r, 6, `=IF($D${r}="","",IF(${won},$C${r},$B${r}))`);
    g.set(r, 7, `=IF($D${r}="","未入力","確定")`);
  });
  // 予選がある形式は、順位表も同じ非表示タブに置く
  if (tournament.groups) writeStandings(g, tournament);
  return g;
}

/** スマホ用タブ。結果入力の唯一の入口。 */
export function layoutMobileSheet(tournament) {
  const g = new Grid(TABS.mobile);
  g.frozenRows = MOBILE_ROW - 1; // 見出し行までを固定。スクロールしても列の意味が分かる
  const sc = getScoring(tournament.scoring);
  g.setColumnWidth(1, 8).setColumnWidth(2, 22).setColumnWidth(3, 12).setColumnWidth(4, 14);

  g.set(1, 1, tournament.title || 'スマホ用 結果入力', { role: 'title' });
  g.set(2, 1, `黄色いセルに結果（${sc.options.join(' / ')}）を入れると、全タブの勝者・次戦・色が自動で更新されます。`, { role: 'note' });
  ['試合', '対戦', '結果', '勝者'].forEach((h, i) => g.set(4, i + 1, h, { role: 'tableHeader' }));

  tournament.matches.forEach((m, i) => {
    const r = MOBILE_ROW + i;
    const c = cellRefs.controlRow(i);
    g.set(r, 1, m.label, { role: 'label' });
    g.set(r, 2, `='${TABS.control}'!$B$${c}&" vs "&'${TABS.control}'!$C$${c}`, { role: 'slot' });
    g.set(r, 3, '', { role: 'input', input: true, validation: sc.options });
    g.set(r, 4, `=IF('${TABS.control}'!$E$${c}="","",'${TABS.control}'!$E$${c})`, { role: 'slot' });
  });
  return g;
}

/** 進行表タブ。チーム名の記入欄と、枠ごとの進行一覧。 */
export function layoutProgressSheet(tournament) {
  const g = new Grid(TABS.progress);
  g.frozenRows = 2;
  g.setColumnWidth(1, 8).setColumnWidth(2, 20).setColumnWidth(3, 8)
    .setColumnWidth(4, 26).setColumnWidth(5, 12).setColumnWidth(6, 16);

  g.set(1, 1, tournament.title || `進行表（${tournament.teams}チーム・全${tournament.matches.length}試合）`, { role: 'title' });
  g.set(2, 1, `コート${tournament.courts}面／全${tournament.slots.length}枠／全${tournament.matches.length}試合／${eliminationRule(tournament)}`, { role: 'note' });

  g.set(4, 1, '■ 出場チーム（ここに記入すると全タブの対戦カードに反映されます）', { role: 'section' });
  g.merge(4, 1, 4, 6);
  g.set(5, 1, '記号', { role: 'tableHeader' });
  g.set(5, 2, 'チーム名', { role: 'tableHeader' });
  tournament.teamLabels.forEach((label, i) => {
    g.set(TEAM_INPUT_ROW + i, 1, label, { role: 'label' });
    g.set(TEAM_INPUT_ROW + i, 2, '', { role: 'input', input: true });
  });

  let row = TEAM_INPUT_ROW + tournament.teams + 1;
  g.set(row, 1, `■ 進行順（枠の中の試合は同時に進行。枠が終わったら次の枠へ）${tournament.avoidBackToBack ? '　※連戦をなるべく避けて並べています' : ''}`, { role: 'section' });
  g.merge(row, 1, row, 6);
  row += 1;
  ['枠', 'コート', '試合', '対戦カード', '結果', '勝者'].forEach((h, i) => g.set(row, i + 1, h, { role: 'tableHeader' }));
  row += 1;

  for (const slot of tournament.slots) {
    for (const [n, entry] of slot.matches.entries()) {
      const i = matchIndex(tournament, entry.matchId);
      const c = cellRefs.controlRow(i);
      g.set(row, 1, n === 0 ? slot.label : '', { role: 'label' });
      g.set(row, 2, `コート${entry.court}`, { role: 'body' });
      g.set(row, 3, entry.matchLabel, { role: 'label' });
      g.set(row, 4, `='${TABS.control}'!$B$${c}&" vs "&'${TABS.control}'!$C$${c}`, { role: 'slot' });
      g.set(row, 5, `=IF('${TABS.control}'!$D$${c}="","",'${TABS.control}'!$D$${c})`, { role: 'body' });
      g.set(row, 6, `=IF('${TABS.control}'!$E$${c}="","",'${TABS.control}'!$E$${c})`, { role: 'slot' });
      row += 1;
    }
  }
  return g;
}
