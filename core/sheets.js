import { Grid } from './grid.js';
import { getScoring, validScore } from './scoring.js';
import { eliminationRule } from './layout.js';
import { writeStandings, groupRankFormula } from './standings.js';
import { TEAM_INPUT_ROW, MOBILE_ROW, controlRow, standingsLayout, jankenRow } from './rows.js';
import { teamLabel, textPx, colUnits, fullWidthFit, CELL_PAD_PX, BOX_COL_UNITS } from './util.js';
import { THEME } from './theme.js';

export const TABS = {
  bracket: 'トーナメント表',
  progress: '進行表',
  mobile: '入力用',
  control: '試合管理',
};

export const cellRefs = {
  teamName: (i) => `'${TABS.progress}'!$B$${TEAM_INPUT_ROW + i}`,
  mobileInput: (i) => `'${TABS.mobile}'!$C$${MOBILE_ROW + i}`,
  controlRow,
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
/** 未確定のときにセルへ出す目印。列幅を決めるときの基準にもなる。 */
export function refPlaceholder(ref) {
  if (ref.type === 'team') return `（${ref.label}チーム）`;
  if (ref.type === 'groupRank') return ref.label;
  return `${ref.matchLabel}の${ref.type === 'winner' ? '勝者' : '敗者'}`;
}

export function liveRefFormula(tournament, ref) {
  const placeholder = refPlaceholder(ref);
  if (ref.type === 'team') {
    const c = cellRefs.teamName(ref.index);
    return `=IF(${c}="","${placeholder}",${c})`;
  }
  if (ref.type === 'groupRank') {
    // 予選が終わるまで誰か分からない。順位表から引き、未確定なら組と順位を目印に出す。
    const f = groupRankFormula(tournament, ref.group, ref.rank);
    return `=IF(${f}="","${placeholder}",${f})`;
  }
  const cell = controlCell(tournament, ref.match, ref.type);
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
    const valid = validScore(sc, `$D${r}`);
    g.set(r, 5, `=IF(NOT(${valid}),"",IF(${won},$B${r},$C${r}))`);
    g.set(r, 6, `=IF(NOT(${valid}),"",IF(${won},$C${r},$B${r}))`);
    // 想定外の値を「確定」にしない。貼り付けや手打ちで選択肢にない値が入ると、
    // 勝敗判定が「左の勝ちではない＝右の勝ち」と黙って解釈してしまう。
    g.set(r, 7, `=IF($D${r}="","未入力",IF(${validScore(sc, `$D${r}`)},"確定","入力エラー"))`);
  });
  // 予選がある形式は、順位表も同じ非表示タブに置く
  if (tournament.groups) writeStandings(g, tournament);
  return g;
}

/** 入力用タブ。結果もじゃんけんも、記入はすべてこのタブに集める。 */
export function layoutMobileSheet(tournament) {
  const g = new Grid(TABS.mobile);
  g.frozenRows = MOBILE_ROW - 1; // 見出し行までを固定。スクロールしても列の意味が分かる
  const sc = getScoring(tournament.scoring);
  // 対戦カードの列は「左の目印 vs 右の目印」が並ぶ。実際に出る文字列から幅を決める。
  // 22（165px）固定だと「（Hチーム） vs （Iチーム）」（195px）が両端で見切れる。
  const cardPx = Math.max(
    ...tournament.matches.map((m) =>
      textPx(`${refPlaceholder(m.left)} vs ${refPlaceholder(m.right)}`, THEME.sizes.body)
    )
  );
  g.setColumnWidth(1, 8)
    .setColumnWidth(2, Math.max(22, colUnits(cardPx + CELL_PAD_PX)))
    .setColumnWidth(3, 12)
    .setColumnWidth(4, 14);

  g.set(1, 1, tournament.title || '結果入力', { role: 'title' });
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

  if (tournament.groups) renderJankenInput(g, tournament);
  return g;
}

/**
 * じゃんけんの記入欄。結果入力と同じタブに置く。
 *
 * 記入場所が2タブに割れると当日に迷うので、入力はこのタブだけに集める。
 * 規定（勝数→直接対決→セット率）で決まる組は白のままで、記入は要らない。
 */
function renderJankenInput(g, tournament) {
  let row = MOBILE_ROW + tournament.matches.length + 1;
  g.set(row, 1, '■ じゃんけん（規定で順位が決まらない組だけ記入）', { role: 'section' });
  g.merge(row, 1, row, 4);
  row += 1;
  ['組', 'チーム名', '順位', '状態'].forEach((h, i) => g.set(row, i + 1, h, { role: 'tableHeader' }));
  row += 1;

  const blocks = standingsLayout(tournament);
  for (const block of blocks) {
    const group = tournament.groups[block.group];
    group.teams.forEach((teamIndex, i) => {
      // 書き込む行と、試合管理から参照される行がずれると別チームの欄を指す。
      const expected = jankenRow(tournament, group.index, i);
      if (row !== expected) {
        throw new Error(`じゃんけん入力欄の行がずれています: 表示=${row} 参照=${expected}`);
      }
      const name = cellRefs.teamName(teamIndex);
      g.set(row, 1, group.label, { role: 'body' });
      g.set(row, 2, `=IF(${name}="","（${teamLabel(teamIndex)}チーム）",${name})`, { role: 'slot' });
      // 状態列は「要じゃんけん」の表示であると同時に、条件付き書式が見る同一シート内の参照でもある。
      // 条件付き書式は他シートを参照できないため、ここに写しておく必要がある。
      g.set(row, 4, `=IFERROR('${TABS.control}'!$H$${block.top + i},"")`, { role: 'body' });
      g.set(row, 3, '', { role: 'optional', jankenOf: `$D$${row}` });
      row += 1;
    });
  }
}

/**
 * 進行表タブ。チーム名の記入欄と、枠ごとの進行表。
 *
 * 進行は「枠が行・コートが列」の行列にする。1試合1行の縦並びだと、同時に走る試合が
 * 縦に散り、当日どのコートで何が動いているかが読めない。実物のタイムテーブルと同じく
 * 1枠を3行（試合／対戦／結果）に組み、コートを列に並べる。
 */
export function layoutProgressSheet(tournament) {
  const g = new Grid(TABS.progress);
  g.frozenRows = 2;

  // コートが列になるので、表の右端はコート数で決まる。
  const courtCol = (n) => 2 + n;
  const lastCol = courtCol(tournament.courts);
  // コートの列には「左の目印 vs 右の目印」と「表①　勝者側 1回戦」が入る。
  // 実際に出る文字列から幅を決める。既定の150pxだと前者が収まらない。
  const courtPx = Math.max(
    ...tournament.matches.map((m) =>
      Math.max(
        textPx(`${refPlaceholder(m.left)} vs ${refPlaceholder(m.right)}`, THEME.sizes.body),
        textPx(`${m.label}　${m.roundName}`, THEME.sizes.body)
      )
    )
  );
  g.setColumnWidth(1, 8).setColumnWidth(2, BOX_COL_UNITS);
  for (let n = 1; n <= tournament.courts; n++) {
    g.setColumnWidth(courtCol(n), colUnits(courtPx + CELL_PAD_PX));
  }

  g.set(1, 1, tournament.title || `進行表（${tournament.teams}チーム・全${tournament.matches.length}試合）`, { role: 'title' });
  g.set(2, 1, `コート${tournament.courts}面／全${tournament.slots.length}枠／全${tournament.matches.length}試合／${eliminationRule(tournament)}`, { role: 'note' });

  g.set(4, 1, '■ 出場チーム（ここに記入すると全タブの対戦カードに反映されます）', { role: 'section' });
  g.merge(4, 1, 4, lastCol);
  g.set(5, 1, '記号', { role: 'tableHeader' });
  g.set(5, 2, 'チーム名', { role: 'tableHeader' });
  tournament.teamLabels.forEach((label, i) => {
    g.set(TEAM_INPUT_ROW + i, 1, label, { role: 'label' });
    g.set(TEAM_INPUT_ROW + i, 2, '', { role: 'input', input: true });
  });

  // 記入欄のすぐ下の空き行に、名前の長さの目安を出す。見出しに足すと表示幅を200px超える。
  // 上限は列幅とフォントから出す。数字を直に書くと、どちらかを変えたときに実際の折り返しと食い違う。
  g.set(TEAM_INPUT_ROW + tournament.teams, 1,
    `※ 全角${fullWidthFit(THEME.sizes.body)}文字を超えると、ブラケットの枠の中で折り返します`, { role: 'note' });

  let row = TEAM_INPUT_ROW + tournament.teams + 1;
  g.set(row, 1, `■ 進行順（同じ行の試合は同時に進行。行が終わったら次の行へ）${tournament.avoidBackToBack ? '　※連戦をなるべく避けて並べています' : ''}`, { role: 'section' });
  g.merge(row, 1, row, lastCol);
  row += 1;

  g.set(row, 1, '枠', { role: 'tableHeader' });
  g.set(row, 2, '', { role: 'tableHeader' });
  for (let n = 1; n <= tournament.courts; n++) {
    g.set(row, courtCol(n), `コート${n}`, { role: 'tableHeader' });
  }
  row += 1;

  // 1枠 = 3行。左端に枠の番号を縦に結合して置き、その右に行の意味を書く。
  const ROWS = [
    { label: '試合', role: 'label' },
    { label: '対戦', role: 'slot' },
    { label: '結果', role: 'body' },
    { label: '勝者', role: 'slot' },
  ];
  for (const slot of tournament.slots) {
    const byCourt = new Map(slot.matches.map((e) => [e.court, e]));
    ROWS.forEach((kind, k) => {
      if (k === 0) g.set(row + k, 1, slot.label, { role: 'label' });
      g.set(row + k, 2, kind.label, { role: 'tableHeader' });
      for (let n = 1; n <= tournament.courts; n++) {
        const entry = byCourt.get(n);
        if (!entry) {
          // その枠で使わないコート。空欄のままだと表の升目が途切れるので、印だけ置く。
          g.set(row + k, courtCol(n), k === 0 ? '―' : '', { role: 'body' });
          continue;
        }
        const m = tournament.matches.find((x) => x.id === entry.matchId);
        const c = cellRefs.controlRow(matchIndex(tournament, entry.matchId));
        const value =
          k === 0 ? `${entry.matchLabel}　${m.roundName}`
          : k === 1 ? `='${TABS.control}'!$B$${c}&" vs "&'${TABS.control}'!$C$${c}`
          : k === 2 ? `=IF('${TABS.control}'!$D$${c}="","",'${TABS.control}'!$D$${c})`
          : `=IF('${TABS.control}'!$E$${c}="","",'${TABS.control}'!$E$${c})`;
        // 勝者のセルは列が固定でなくなった（コートが列になったため）。
        // 条件付き書式が列番号で拾えないので、印を付けてそちらから探せるようにする。
        const style = { role: kind.role };
        if (k === 3) style.progressWinner = true;
        g.set(row + k, courtCol(n), value, style);
      }
    });
    // 枠の番号は3行ぶんの高さで1つ。行ごとに繰り返すと、どこからどこまでが1枠か読めない。
    g.merge(row, 1, row + ROWS.length - 1, 1);
    row += ROWS.length;
  }
  return g;
}
