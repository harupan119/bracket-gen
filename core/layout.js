import { Grid, a1 } from './grid.js';
import { liveRefFormula, controlCell } from './sheets.js';
import { standingsLayout } from './standings.js';
import { BOX_COL_UNITS } from './util.js';
import { TABS } from './sheets.js';

// 実物 8team_volleyball_base.xlsx と同じ列構成
export const COLUMNS = [
  { col: 1, width: 9 },   // A: 試合番号（決勝R のような3文字ラベルまで収める）
  { col: 2, width: BOX_COL_UNITS },  // B: 左チーム / ブラケット第1列
  { col: 3, width: 4 },   // C: vs / 連結線（実物と同じ30px。ここを塗って経路の帯にする）
  { col: 4, width: BOX_COL_UNITS },  // D: 右チーム / ブラケット第2列
  { col: 5, width: 4 },   // E: 連結線
  // F は下の表の「行き先」「決定方法」にも使うが、幅はブラケットの箱に合わせる。
  // ここだけ広くすると、ブラケットの3ラウンド目の箱だけが横に伸び、
  // 経路を塗ったときに1箇所だけ赤い板になる。表側は 5〜6列の結合で幅を確保する。
  { col: 6, width: BOX_COL_UNITS },  // F: 説明 / ブラケット第3列
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
export const helperRow = (matchIndex) => matchIndex + 2;

/** ブラケット図の右端の列。ツリーが無い形式（完全順位決定）は既定の6列構成。 */
/**
 * ブラケット図が使う一番右の列。
 *
 * 敗者側は勝者側より多くのラウンドを持つことがあり、勝者側だけで判断すると
 * 右側の列に幅が当たらず、隠し補助列を敗者側のセルの上に置いてしまう
 * （実シートで「裏⑦の勝者」が非表示列に埋まって消えていた）。
 */
export function lastBracketCol(tournament) {
  const cols = [6];
  if (tournament.tree) cols.push(2 + 2 * (tournament.tree.levels.length - 1));
  if (tournament.loserTree?.levels?.length) cols.push(loserBracketCol(tournament));
  return Math.max(...cols);
}

/** 補助列はブラケットの右端より外に置く。図の列数はチーム数で変わるので固定できない。 */
export function helperCols(tournament) {
  const last = lastBracketCol(tournament);
  return { winner: last + 2, loser: last + 3 };
}

export function helperCell(tournament, matchId, kind) {
  const i = tournament.matches.findIndex((m) => m.id === matchId);
  const col = helperCols(tournament)[kind];
  return `$${a1(1, col).replace(/\d+$/, '')}$${helperRow(i)}`;
}

export function layoutBracketSheet(tournament) {
  const g = new Grid('トーナメント表');
  for (const { col, width } of COLUMNS) g.setColumnWidth(col, width);

  // 隠し補助列。表示はしないが、条件付き書式がここを見る。
  const hc = helperCols(tournament);
  g.set(1, hc.winner, '（内部）勝者', { helper: true });
  g.set(1, hc.loser, '（内部）敗者', { helper: true });
  tournament.matches.forEach((m, i) => {
    g.set(helperRow(i), hc.winner, `=${controlCell(tournament, m.id, 'winner')}`, { helper: true });
    g.set(helperRow(i), hc.loser, `=${controlCell(tournament, m.id, 'loser')}`, { helper: true });
  });
  // 列幅は実物の実測値に合わせる: 試合番号7 / チーム名20 / 連結線3 / 説明26。
  // 連結線は条件付き書式で塗って経路を示すため、太いと線ではなく矩形に見える。
  // 偶数列がチーム名、奇数列が連結線という並びは、そのままブラケット図の列構成になる。
  for (let c = 7; c <= lastBracketCol(tournament); c++) {
    g.setColumnWidth(c, c % 2 === 0 ? BOX_COL_UNITS : 4);
  }

  let row = 1;
  g.set(row, 1, tournament.title || `トーナメント表（${tournament.teams}チーム・全${tournament.matches.length}試合）`, { role: 'title' });
  row += 1;
  g.set(row, 1, subtitle(tournament), { role: 'note' });
  row += 2;

  // ツリーを持つ形式（シングル／ダブルの勝者側）はブラケット図として描く。
  // 完全順位決定はツリーではなく再帰的な二分割なので、終端グループ方式で描く。
  // 予選がある形式は、順位表を決勝トーナメントの前に出す
  if (tournament.groups) row = renderGroupStandings(g, tournament, row);

  const inBracket = new Set();
  if (tournament.tree) {
    row = renderTree(g, tournament, row, inBracket);
  }
  if (tournament.loserTree) {
    row = renderLoserTree(g, tournament, row, inBracket);
  }
  const groups = tournament.tree ? [] : terminalGroups(tournament);
  for (const gr of groups) {
    for (const id of [...gr.semis.map((s) => s.id), gr.final.id, gr.consolation.id]) inBracket.add(id);
  }
  // 勝者側と敗者側でラウンド番号が衝突するため、区切りには系統も含める
  const keyOf = (m) => `${m.bracket ?? '-'}/${m.roundNo}/${m.roundName}`;
  // 予選は順位表で見せるので、対戦カードのリストは出さない。
  // 対戦カード自体は進行表が持っているので、ここに並べると二重になる。
  const listed = (m) => !inBracket.has(m.id) && m.stage !== 'group';
  const listKeys = [];
  for (const m of tournament.matches) {
    if (!listed(m)) continue;
    if (!listKeys.includes(keyOf(m))) listKeys.push(keyOf(m));
  }

  for (const key of listKeys) {
    const ms = tournament.matches.filter((m) => listed(m) && keyOf(m) === key);
    const span = ms.length > 1 ? `（${ms[0].label}〜${ms[ms.length - 1].label}）` : '';
    const note = ms[0].roundNo === 1 && ms[0].bracket !== 'L' && !tournament.tree ? '　※ここだけ抽選で決める' : '';
    g.set(row, 1, `■ ${ms[0].roundName}${span}${note}`, { role: 'section' });
    g.merge(row, 1, row, 6);
    row += 1;
    // 対戦カードは 左/vs/右 の3列、行き先は残り2列にまたがる。
    // 空きセルに枠線だけ引くと、意味のない小箱が並んで見えるため結合する。
    for (const c of [1, 2, 3, 4, 5, 6]) g.set(row, c, '', { role: 'tableHeader' });
    g.cells.get(`${row},1`).value = '試合';
    g.cells.get(`${row},2`).value = '対戦カード';
    g.cells.get(`${row},5`).value = '行き先';
    g.merge(row, 2, row, 4);
    g.merge(row, 5, row, 6);
    row += 1;
    for (const m of ms) {
      g.set(row, 1, m.label, { role: 'label' });
      g.set(row, 2, liveRefFormula(tournament, m.left), { role: 'slot', winnerOf: m.id });
      g.set(row, 3, 'vs', { role: 'body' });
      g.set(row, 4, liveRefFormula(tournament, m.right), { role: 'slot', winnerOf: m.id });
      g.set(row, 5, destinationText(tournament, m), { role: 'note' });
      g.set(row, 6, '', { role: 'note' });
      g.merge(row, 5, row, 6);
      row += 1;
    }
    row += 1;
  }

  // 終端グループ = 最終2ラウンドに入る4チームずつのまとまり
  for (const group of groups) {
    g.set(row, 1, `■ ${group.title}`, { role: 'section' });
    g.merge(row, 1, row, 6);
    row += 1;
    const base = row;
    const semiLabels = group.semis.map((x) => x.label).join('・');
    // ラウンド名から括弧書きを落とす。「■ 1〜4位 ブラケット（上山）」がすぐ上にあり
    // 二重に書くと 150px の列に収まらず、右隣も見出しなので文字が切れる。
    const shortRound = (name) => name.replace(/（[^）]*）/g, '');
    g.set(base, 2, '進出チーム', { role: 'tableHeader' })
      .set(base, 3, '', { role: 'tableHeader' })
      .set(base, 4, `${shortRound(group.semis[0].roundName)} ${semiLabels} の勝者`, { role: 'tableHeader' })
      .set(base, 5, '', { role: 'tableHeader' })
      .set(base, 6, `${shortRound(group.final.roundName)} ${group.final.label}`, { role: 'tableHeader' });
    for (let i = 0; i < group.entrants.length; i++) {
      const { row: r, col: c } = bracketCell(base, 0, i);
      // このチームが進む先は、自分が入る準決勝
      const nextId = group.semis[Math.floor(i / 2)].id;
      g.set(r, c, liveRefFormula(tournament, group.entrants[i]), { role: 'team', winnerOf: nextId });
      const up = bracketCell(base, 1, Math.floor(i / 2));
      g.path(r, up.row, c + 1, a1(r, c), nextId);
    }
    for (let i = 0; i < group.semis.length; i++) {
      const { row: r, col: c } = bracketCell(base, 1, i);
      // role を付け忘れると枠線も地色も折り返しも当たらず、ここだけ素のセルになる。
      // チーム名が入る枠なので、実名が長いと隣の連結列の罫線の上へ溢れる。
      g.set(r, c, liveRefFormula(tournament, { type: 'winner', match: group.semis[i].id, matchLabel: group.semis[i].label }), {
        role: 'slot',
        winnerOf: group.final.id,
      });
    }
    drawBranches(g, base, [group.entrants.length, group.semis.length, 1]);
    {
      const { row: r, col: c } = bracketCell(base, 2, 0);
      g.set(r, c, `=IF(${controlCell(tournament, group.final.id, 'winner')}="","★ ${group.final.decides.winner}位","★ "&${controlCell(tournament, group.final.id, 'winner')})`, { role: 'slot', championOf: group.final.id });
    }
    row = base + bracketHeight(group.entrants.length);
    // 下位決定戦は図にせずリスト1行で置く（実物と同じ）
    g.set(row, 1, group.consolation.label, { role: 'label' });
    g.set(row, 2, liveRefFormula(tournament, group.consolation.left), { role: 'slot', winnerOf: group.consolation.id });
    g.set(row, 3, 'vs', { role: 'body' });
    g.set(row, 4, liveRefFormula(tournament, group.consolation.right), { role: 'slot', winnerOf: group.consolation.id });
    g.set(row, 5, `${group.consolation.roundName}（勝者＝${group.consolation.decides.winner}位／敗者＝${group.consolation.decides.loser}位）`, { role: 'note' });
    g.set(row, 6, '', { role: 'note' });
    g.merge(row, 5, row, 6);
    row += 2;
  }

  g.set(row, 1, '■ 最終順位', { role: 'section' });
  g.merge(row, 1, row, 6);
  row += 1;
  for (const c of [1, 2, 3, 4, 5, 6]) g.set(row, c, '', { role: 'tableHeader' });
  g.cells.get(`${row},1`).value = '順位';
  g.cells.get(`${row},2`).value = 'チーム名';
  g.cells.get(`${row},5`).value = '決定方法';
  g.merge(row, 2, row, 4);
  g.merge(row, 5, row, 6);
  row += 1;
  const placements = tournament.matches
    .filter((x) => x.decides)
    .flatMap((m) => [
      m.decides.winner != null && { rank: m.decides.winner, text: matchDesc(m, '勝者'), cell: controlCell(tournament, m.id, 'winner'), matchId: m.id },
      m.decides.loser != null && { rank: m.decides.loser, text: matchDesc(m, '敗者'), cell: controlCell(tournament, m.id, 'loser'), matchId: m.id },
    ])
    .filter(Boolean);
  const byRank = new Map();
  for (const p of placements) {
    if (!byRank.has(p.rank)) byRank.set(p.rank, []);
    byRank.get(p.rank).push(p);
  }
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    const cands = byRank.get(rank);
    // 後の試合（決勝リセット）が決まっていればそちらを優先する
    const formula = cands
      .slice()
      .reverse()
      .reduceRight((acc, c) => `IF(${c.cell}<>"",${c.cell},${acc})`, '""');
    g.set(row, 1, `${rank}位`, { role: 'label' });
    g.set(row, 2, `=${formula}`, rank === 1 ? { role: 'slot', championOf: cands.at(-1).matchId } : { role: 'slot' });
    for (const c of [3, 4]) g.set(row, c, '', { role: 'slot' });
    g.merge(row, 2, row, 4);
    g.set(row, 5, cands.map((c) => c.text).join(' ／ '), { role: 'note' });
    g.set(row, 6, '', { role: 'note' });
    g.merge(row, 5, row, 6);
    row += 1;
  }
  return g;
}

function destinationText(tournament, m) {
  const label = (id) => tournament.matches.find((x) => x.id === id).label;
  const parts = [];
  if (m.winnerTo) parts.push(`勝者→${label(m.winnerTo)}`);
  if (m.loserTo) parts.push(`敗者→${label(m.loserTo)}`);
  // 終端の試合は行き先が無い。代わりに、その試合が決める順位を書く。
  if (!parts.length && m.decides) {
    if (m.decides.winner != null) parts.push(`勝者＝${m.decides.winner}位`);
    if (m.decides.loser != null) parts.push(`敗者＝${m.decides.loser}位`);
  }
  return parts.join('　／　');
}

/** 試合ラベルとラウンド名が同じときは繰り返さない（「3位決定戦 3位決定戦の勝者」を避ける）。 */
function matchDesc(m, kind) {
  return m.label === m.roundName ? `${m.label}の${kind}` : `${m.label} ${m.roundName}の${kind}`;
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

/**
 * ブラケットの枝を引く。チーム名セルの下線が横線、連結列の左罫線が縦線。
 * levelSizes は各ラウンドのスロット数（例: 4チームのブラケットなら [4, 2, 1]）。
 * filled(j, i) が false のスロットは不戦勝なので下線を引かない。
 */
function drawBranches(g, base, levelSizes, filled) {
  const has = filled ?? (() => true);
  for (let j = 0; j < levelSizes.length - 1; j++) {
    for (let p = 0; p < levelSizes[j + 1]; p++) {
      if (!has(j + 1, p)) continue;
      const top = bracketCell(base, j, p * 2);
      const bottom = bracketCell(base, j, p * 2 + 1);
      const parent = bracketCell(base, j + 1, p);
      const conn = top.col + 1;
      const bothPlay = has(j, p * 2) && has(j, p * 2 + 1);
      if (!bothPlay) {
        // シード。対戦相手がいないので枝を組まず、親の高さをそのまま横切る直線にする。
        // 枝を1本だけ描くと「片腕のないΛ」になり、試合があるように見えてしまう。
        g.border(parent.row, top.col, parent.row, conn, 'bottom');
        continue;
      }
      g.border(top.row, top.col, top.row, top.col, 'bottom');
      g.border(bottom.row, bottom.col, bottom.row, bottom.col, 'bottom');
      g.border(top.row + 1, conn, bottom.row, conn, 'left');
      g.border(parent.row, conn, parent.row, conn, 'bottom');
    }
  }
  const last = levelSizes.length - 1;
  if (has(last, 0)) {
    const root = bracketCell(base, last, 0);
    g.border(root.row, root.col, root.row, root.col, 'bottom');
  }
}

/**
 * 敗退の規則。完全順位決定だけは全員が同じ試合数を戦うので、そう書ける。
 * シングル／ダブルでは試合数が一定にならないため「各チームN試合」とは書けない。
 */
export function eliminationRule(t) {
  if (t.format === 'full-placement') return `各チーム${t.rounds}試合`;
  if (t.format === 'double-elimination') return '2敗で敗退';
  if (t.format === 'group-stage') {
    // 予選は総当たりなので1敗しても続く。決勝トーナメントに入ってから一発勝負。
    const per = t.groups[0].teams.length - 1;
    return `予選は各チーム${per}試合／決勝Tは1敗で敗退`;
  }
  return '1敗で敗退';
}

export /**
 * そのスロットが表示しているチームの「次の試合」を返す。
 * 図の中に親がいればそれ。図の頂点なら、模型上の勝ち上がり先（決勝など）を見る。
 * どこへも進まないなら null（＝そのブラケットの優勝）。
 */
function nextMatchOf(tournament, ref, parentRef) {
  if (parentRef && parentRef.type === 'winner') return parentRef.match;
  if (ref && ref.type === 'winner') {
    return tournament.matches.find((m) => m.id === ref.match)?.winnerTo ?? null;
  }
  // 敗者側の入口。親が試合として引けない位置に来ることがあるので、模型の行き先を使う。
  if (ref && ref.type === 'loser') {
    return tournament.matches.find((m) => m.id === ref.match)?.loserTo ?? null;
  }
  // シードは次のラウンドの枠が「同じ出場者の通過」なので、親を見ても試合が分からない。
  // 親が試合でないときは、その出場者が実際に出る試合を模型から引く。
  // ここを null で返していたため、シードだけ着色ルールが1本も出ていなかった。
  // 予選リーグの決勝トーナメントは出場者が groupRank 型なので、team と同じ扱いが要る。
  const same = (a, b) => {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'team') return a.index === b.index;
    if (a.type === 'groupRank') return a.group === b.group && a.rank === b.rank;
    return false;
  };
  if (ref && (ref.type === 'team' || ref.type === 'groupRank')) {
    const m = tournament.matches.find((x) => same(x.left, ref) || same(x.right, ref));
    return m?.id ?? null;
  }
  return null;
}

function subtitle(t) {
  return `全${t.matches.length}試合／${eliminationRule(t)}／1位〜${t.placements}位まで確定`;
}

/**
 * スロット構造をブラケット図として描く。
 *
 *   行 = base + 2^(j+1)·i + 2^j 、列 = 2 + 2j   （j はラウンド、i はその中の位置）
 *
 * 不戦勝の枠は空欄のまま残す。枠を詰めるとこの式が成立しなくなり、
 * チーム数ごとに座標を作り直すことになるため。
 */
function renderTree(g, tournament, startRow, inBracket) {
  const { levels } = tournament.tree;
  let row = startRow;
  const hasSeed = levels[0].some((x) => !x);
  const seedNote = hasSeed ? '　（★＝シードで1回戦なし）' : '';
  g.set(row, 1, `■ ${tournament.tree.title ?? '本戦'}${seedNote}`, { role: 'section' });
  g.merge(row, 1, row, 6);
  row += 1;
  const base = row;

  drawBranches(
    g,
    base,
    levels.map((lv) => lv.length),
    (j, i) => Boolean(levels[j] && levels[j][i])
  );

  // どのセルがそのスロットのチームを表示しているか。
  // 通過スロットは箱を描かないので、帯を塗る条件を子スロットから引き継ぐ必要がある。
  const shownAt = new Map();

  levels.forEach((level, j) => {
    level.forEach((ref, i) => {
      if (!ref) return; // 空きスロット。シードは直線で示すので、ここには何も置かない。
      const { row: slotRow, col: c } = bracketCell(base, j, i);
      const up = levels[j + 1] ? bracketCell(base, j + 1, Math.floor(i / 2)) : null;
      // このスロットの勝ち上がり先は、ひとつ上のラウンドの対応スロット
      const parent = levels[j + 1] ? levels[j + 1][Math.floor(i / 2)] : null;
      const next = nextMatchOf(tournament, ref, parent);

      // 2列目以降で試合を経ていない枠は、シードがそのまま通過しただけ。
      // ここに箱を描くと同じチーム名が2度並ぶ。ただし塗りを飛ばすと帯がここで切れる。
      if (j > 0 && ref.type !== 'winner') {
        const from = [i * 2, i * 2 + 1]
          .map((k) => shownAt.get(`${j - 1},${k}`))
          .find(Boolean);
        shownAt.set(`${j},${i}`, from);
        if (from && next && up) {
          g.path(slotRow, slotRow, c, from, next); // 箱の無い枠自体
          g.path(slotRow, up.row, c + 1, from, next); // その先の連結列
        }
        return;
      }

      // 対戦相手がいないスロットはシード。枠を次ラウンドの高さへ移し、そこから真横に線を引く。
      // 自分の行に置いたままだと、線が親の行まで折れて試合があるように見える。
      const seeded = up && !level[i % 2 === 0 ? i + 1 : i - 1];
      const r = seeded ? up.row : slotRow;
      const style = { role: j === 0 ? 'team' : 'slot' };
      if (next) style.winnerOf = next;
      else if (ref.type === 'winner') style.championOf = ref.match;
      g.set(r, c, liveRefFormula(tournament, ref), style);
      shownAt.set(`${j},${i}`, a1(r, c));
      // シード印はチーム名の左隣へ。名前の文字列に足すと、勝ち上がりの条件付き書式が
      // 「表示中の文字列＝勝者セル」で比較しているため一致しなくなる。
      if (seeded && j === 0) g.set(r, c - 1, '★', { role: 'seed' });
      // 試合番号。実物は連結列に置くが、そこは勝ち上がりの帯で塗る列で、
      // 塗られると濃い赤地に文字が乗って読めない。入力の列（連結列のひとつ左）に
      // 右寄せで置くと「番号 → 線 → 勝者の箱」の順に読め、帯とも重ならない。
      if (ref.type === 'winner') {
        const m = tournament.matches.find((x) => x.id === ref.match);
        if (m && c - 2 >= 1 && !g.cells.has(`${r},${c - 2}`)) {
          g.set(r, c - 2, m.label, { role: 'matchNo' });
        }
      }
      if (ref.type === 'winner') inBracket.add(ref.match);
      // 勝ち上がったら、次のラウンドへ向かう連結列を塗ってマーカー線にする
      if (style.winnerOf && up) {
        g.path(r, up.row, c + 1, a1(r, c), style.winnerOf);
      }
    });
  });

  return base + bracketHeight(levels[0].length) + 1;
}

/** 敗者側の枠の間隔（行）。実物と同じ4行。詰めると縦の連結線が短くなり経路を追えない。 */
const LOSER_ROW_STEP = 4;

/**
 * 敗者側の合流をそのまま木にする。
 *
 * 小ラウンド（敗者同士）は隣り合う2枠が組み、大ラウンドは生き残り枠と
 * 勝者側から落ちてくる枠が組む。片側が不戦勝の段は試合ではないので節を作らず、
 * 生きている側をそのまま上へ送る。こうすると木の深さが実際に戦う試合数と一致し、
 * 深さをそのまま列に写すだけで「1試合の2枠が必ず同じ列に並ぶ」形になる。
 * 段の番号をそのまま列にしていた頃は、不戦勝で素通りした枠だけが列に取り残され、
 * 同じ試合の2枠が2列離れて並んでいた。
 */
function loserTreeNodes(levels) {
  let nodes = levels[0].refs.map((ref) => (ref ? { kind: 'leaf', ref } : null));
  for (let j = 1; j < levels.length; j++) {
    const lv = levels[j];
    const minor = lv.kind === 'minor';
    const next = [];
    for (let i = 0; i < lv.refs.length; i++) {
      const a = minor ? nodes[2 * i] : nodes[i];
      const dropRef = minor ? null : lv.drops?.[i] ?? null;
      const b = minor ? nodes[2 * i + 1] : dropRef ? { kind: 'leaf', ref: dropRef } : null;
      next.push(a && b ? { kind: 'match', ref: lv.refs[i], a, b, drop: !minor } : a ?? b ?? null);
    }
    nodes = next;
  }
  return nodes[0] ?? null;
}

/** 木の深さ。そのまま「敗者側の右端の列 ＝ 2 + 2·深さ」になる。 */
function loserDepth(node) {
  return node && node.kind === 'match' ? Math.max(loserDepth(node.a), loserDepth(node.b)) + 1 : 0;
}

/**
 * 敗者側が使う一番右の列。
 * 列幅と隠し補助列の位置は図を描く前に決まっている必要があるので、ここだけ先に計算する。
 */
export function loserBracketCol(tournament) {
  const levels = tournament.loserTree?.levels;
  if (!levels?.length) return 0;
  const root = loserTreeNodes(levels);
  return root ? 2 + 2 * loserDepth(root) : 0;
}

/**
 * 敗者側を図として描く。
 *
 * 勝者側と違って段の数がそのまま木の深さにならない。小ラウンド（敗者同士）は
 * 枠が半分になるが、大ラウンドでは勝者側から落ちてきた枠が新しく合流するので
 * 枠数が変わらない。つまり大ラウンドの入力の片方は、図の左から流れてくるのではなく
 * その列で新しく現れる。この入口を描かないと、敗者側の全試合が
 * 「対戦相手のいない箱」に見える。
 *
 * 配置は実物（10team_double_auto.xlsx の裏ブロック）と同じ規則で決める:
 *   - 1試合の2枠は必ず同じ列に置き、勝者を隣の列の中点に出す
 *   - 勝者側から落ちてくる枠は、生き残り枠の真下（+4行・同じ列）に置く
 */
function renderLoserTree(g, tournament, startRow, inBracket) {
  const { levels, title } = tournament.loserTree;
  if (!levels.length) return startRow;
  const root = loserTreeNodes(levels);
  if (!root) return startRow;

  let row = startRow;
  g.set(row, 1, `■ ${title}`, { role: 'section' });
  g.merge(row, 1, row, 6);
  row += 1;
  const base = row;

  const entries = [];  // 箱を描く入口。敗者側1回戦の枠と、勝者側から落ちてくる枠。
  const merges = [];   // { a, b, out } 合流する2枠と、その勝者が入る枠
  let cursor = base + 1;

  const place = (node, col) => {
    if (node.kind === 'leaf') {
      const slot = { ref: node.ref, row: cursor, col };
      cursor += LOSER_ROW_STEP;
      entries.push(slot);
      return slot;
    }
    const a = place(node.a, col - 2);
    let b;
    if (node.drop) {
      // 落ちてくる枠は木の下端ではなく、生き残り枠の真下に置く。
      // 下端まで送ると中点が大きく下がり、合流だけが縦に間延びする。
      b = { ref: node.b.ref, row: a.row + LOSER_ROW_STEP, col: col - 2 };
      entries.push(b);
      cursor = Math.max(cursor, b.row + LOSER_ROW_STEP);
    } else {
      b = place(node.b, col - 2);
    }
    const out = { ref: node.ref, row: Math.round((a.row + b.row) / 2), col };
    merges.push({ a, b, out });
    return out;
  };
  const top = place(root, 2 + 2 * loserDepth(root));

  const boxOf = new Map();
  const draw = (slot, role) => {
    const style = { role };
    const next = nextMatchOf(tournament, slot.ref, null);
    if (next) style.winnerOf = next;
    else if (slot.ref.type === 'winner') style.championOf = slot.ref.match;
    g.set(slot.row, slot.col, liveRefFormula(tournament, slot.ref), style);
    if (slot.ref.type === 'winner') inBracket.add(slot.ref.match);
    boxOf.set(slot, a1(slot.row, slot.col));
  };
  for (const s of entries) draw(s, 'team');
  for (const m of merges) draw(m.out, 'slot');

  for (const { a, b, out } of merges) {
    // a.col と b.col は必ず out.col - 2 なので、連結列は両方の箱のすぐ隣になる。
    const conn = out.col - 1;
    const played = out.ref.type === 'winner' ? out.ref.match : nextMatchOf(tournament, a.ref, null);
    for (const side of [a, b]) {
      g.border(side.row, side.col, side.row, side.col, 'bottom');
      g.path(side.row, out.row, conn, boxOf.get(side), played);
    }
    g.border(Math.min(a.row, b.row) + 1, conn, Math.max(a.row, b.row), conn, 'left');
    g.border(out.row, conn, out.row, conn, 'bottom');
    // 試合番号。実物は連結列に置くが、そこは勝ち上がりの帯で塗る列なので、
    // 塗られると濃い赤地に文字が乗って読めなくなる。連結列のひとつ左・勝者と同じ行に
    // 右寄せで置くと、読む順が「番号 → 線 → 勝者の箱」になり帯とも重ならない。
    if (out.ref.type === 'winner') {
      const m = tournament.matches.find((x) => x.id === out.ref.match);
      if (m) g.set(out.row, out.col - 2, m.label, { role: 'matchNo' });
    }
  }

  // 敗者側の頂点。この先は決勝なので合流が無く、下線だけ引く。
  g.border(top.row, top.col, top.row, top.col, 'bottom');

  let bottom = base;
  for (const s of [...entries, ...merges.map((m) => m.out)]) bottom = Math.max(bottom, s.row + 1);
  return bottom + 1;
}

/**
 * 予選の順位表。集計そのものは試合管理タブの隠しブロックが持っているので、
 * ここはそれを引いて見せるだけにする。同じ計算を2箇所に置かないため。
 */
function renderGroupStandings(g, tournament, startRow) {
  const blocks = standingsLayout(tournament);
  const ctrl = (col, row) => `'${TABS.control}'!${col}$${row}`;
  let row = startRow;

  for (const block of blocks) {
    const group = tournament.groups[block.group];
    g.set(row, 1, `■ 予選 ${group.label}（上位${group.advance}チームが決勝トーナメントへ）`, { role: 'section' });
    g.merge(row, 1, row, 6);
    row += 1;

    for (const c of [1, 2, 3, 4, 5, 6]) g.set(row, c, '', { role: 'tableHeader' });
    g.cells.get(`${row},1`).value = '順位';
    g.cells.get(`${row},2`).value = 'チーム名';
    g.cells.get(`${row},3`).value = '勝';
    // 幅の広い4列目にセット（「12-9」のような2桁同士が入る）、狭い5列目に直接対決（1桁）を置く。
    // 列幅はブラケット図と共有していて、順位表だけ変えることはできない。5列目は連結列でもあり、
    // 広げると勝ち上がりの帯が線ではなく矩形に見えるので、見出しを1文字に縮めて収める。
    // 30px の列で使えるのは余白（CELL_PAD_PX）を引いた 20px。10pt の全角は1文字 13.3px なので
    // 「直対」（26.7px）は入らず、右端が切れる。読み方は下の凡例で補う。
    g.cells.get(`${row},4`).value = 'セット';
    g.cells.get(`${row},5`).value = '直';
    g.cells.get(`${row},6`).value = 'じゃんけん';
    row += 1;

    const bandTop = row;
    for (let i = 0; i < block.size; i++) {
      const r = block.top + i;
      g.set(row, 1, `=${ctrl('J', r)}`, { role: 'label' });
      g.set(row, 2, `=${ctrl('A', r)}`, { role: 'slot' });
      g.set(row, 3, `=${ctrl('B', r)}`, { role: 'body' });
      g.set(row, 4, `=${ctrl('C', r)}&"-"&${ctrl('D', r)}`, { role: 'body' });
      g.set(row, 5, `=${ctrl('E', r)}`, { role: 'body' });
      // 入力欄ではなく表示。記入は入力用タブに集めてある。
      // 規定で決まらない組はここが黄色くなるので、入力用タブへ行く合図になる。
      g.set(row, 6, `=IFERROR(${ctrl('G', r)},"")`, { role: 'body', jankenOf: ctrl('H', r) });
      // 条件付き書式は他シートを見られないので、「要じゃんけん」の印を隣の隠し列へ写す
      g.set(row, 7, `=${ctrl('H', r)}`, { helper: true });
      row += 1;
    }
    // 通過ラインを色で示す。当日「誰が上がったか」を順位の数字を読まずに掴めるようにする。
    // じゃんけん欄（6列目）は別の色で光るので、帯からは外す。
    g.advances.push({ r1: bandTop, r2: row - 1, c1: 1, c2: 5, rankCol: 1, cutoff: group.advance });
    row += 1;
  }

  g.set(row, 1, '※ 上位の色付きが決勝トーナメント進出。順位は 勝数（勝） → 直接対決（直） → セット率（セット） の順で決めます。すべて並んだ組は「じゃんけん」欄が黄色くなるので、入力用タブの下部にある「じゃんけん」欄に、代表者のじゃんけんで決めた順位（1が勝ち）を入れてください。', { role: 'note' });
  g.merge(row, 1, row, 6);
  return row + 2;
}
