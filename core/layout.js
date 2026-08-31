import { Grid, a1 } from './grid.js';
import { liveRefFormula, controlCell } from './sheets.js';
import { standingsLayout } from './standings.js';
import { TABS } from './sheets.js';

// 実物 8team_volleyball_base.xlsx と同じ列構成
export const COLUMNS = [
  { col: 1, width: 9 },   // A: 試合番号（決勝R のような3文字ラベルまで収める）
  { col: 2, width: 20 },  // B: 左チーム / ブラケット第1列
  { col: 3, width: 4 },   // C: vs / 連結線（実物と同じ30px。ここを塗って経路の帯にする）
  { col: 4, width: 20 },  // D: 右チーム / ブラケット第2列
  { col: 5, width: 4 },   // E: 連結線
  // F は下の表の「行き先」「決定方法」にも使うが、幅はブラケットの箱に合わせる。
  // ここだけ広くすると、ブラケットの3ラウンド目の箱だけが横に伸び、
  // 経路を塗ったときに1箇所だけ赤い板になる。表側は 5〜6列の結合で幅を確保する。
  { col: 6, width: 20 },  // F: 説明 / ブラケット第3列
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
export function lastBracketCol(tournament) {
  return tournament.tree ? 2 + 2 * (tournament.tree.levels.length - 1) : 6;
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
    g.setColumnWidth(c, c % 2 === 0 ? 20 : 4);
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
    g.set(base, 2, '進出チーム', { role: 'tableHeader' })
      .set(base, 3, '', { role: 'tableHeader' })
      .set(base, 4, `${group.semis[0].roundName} ${semiLabels} の勝者`, { role: 'tableHeader' })
      .set(base, 5, '', { role: 'tableHeader' })
      .set(base, 6, `${group.final.roundName} ${group.final.label}`, { role: 'tableHeader' });
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
      g.set(r, c, liveRefFormula(tournament, { type: 'winner', match: group.semis[i].id, matchLabel: group.semis[i].label }), {
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

  levels.forEach((level, j) => {
    level.forEach((ref, i) => {
      if (!ref) return; // 空きスロット。シードは直線で示すので、ここには何も置かない。
      // 2列目以降で試合を経ていない枠は、シードがそのまま通過しただけ。
      // ここに箱を描くと同じチーム名が2度並ぶので、枝線だけで通過を示す。
      if (j > 0 && ref.type !== 'winner') return;
      const { row: slotRow, col: c } = bracketCell(base, j, i);
      const up = levels[j + 1] ? bracketCell(base, j + 1, Math.floor(i / 2)) : null;
      // 対戦相手がいないスロットはシード。枠を次ラウンドの高さへ移し、そこから真横に線を引く。
      // 自分の行に置いたままだと、線が親の行まで折れて試合があるように見える。
      const seeded = up && !level[i % 2 === 0 ? i + 1 : i - 1];
      const r = seeded ? up.row : slotRow;
      // このスロットの勝ち上がり先は、ひとつ上のラウンドの対応スロット
      const parent = levels[j + 1] ? levels[j + 1][Math.floor(i / 2)] : null;
      const style = { role: j === 0 ? 'team' : 'slot' };
      const next = nextMatchOf(tournament, ref, parent);
      if (next) style.winnerOf = next;
      else if (ref.type === 'winner') style.championOf = ref.match;
      g.set(r, c, liveRefFormula(tournament, ref), style);
      // シード印はチーム名の左隣へ。名前の文字列に足すと、勝ち上がりの条件付き書式が
      // 「表示中の文字列＝勝者セル」で比較しているため一致しなくなる。
      if (seeded && j === 0) g.set(r, c - 1, '★', { role: 'seed' });
      if (ref.type === 'winner') inBracket.add(ref.match);
      // 勝ち上がったら、次のラウンドへ向かう連結列を塗ってマーカー線にする
      if (style.winnerOf && up) {
        g.path(r, up.row, c + 1, a1(r, c), style.winnerOf);
      }
    });
  });

  return base + bracketHeight(levels[0].length) + 1;
}

/**
 * 敗者側を図として描く。
 *
 * 勝者側と違って木構造にならない。小ラウンド（敗者同士）でスロットが半分になり、
 * 大ラウンド（勝者側の脱落者と対戦）では数が変わらないため、行間隔が倍々にならない。
 * そこで行位置を反復で追う: 小ラウンドでは対になる2つの中点へ寄せ、大ラウンドでは動かさない。
 */
function renderLoserTree(g, tournament, startRow, inBracket) {
  const { levels, title } = tournament.loserTree;
  if (!levels.length) return startRow;

  let row = startRow;
  g.set(row, 1, `■ ${title}`, { role: 'section' });
  g.merge(row, 1, row, 6);
  row += 1;
  const base = row;

  let rows = levels[0].refs.map((_, i) => base + 2 * i + 1);
  const placed = [{ rows, level: levels[0], col: 2 }];

  for (let j = 1; j < levels.length; j++) {
    if (levels[j].kind === 'minor') {
      const next = [];
      for (let i = 0; i < levels[j].refs.length; i++) {
        next.push(Math.round((rows[i * 2] + rows[i * 2 + 1]) / 2));
      }
      rows = next;
    }
    placed.push({ rows: rows.slice(), level: levels[j], col: 2 + 2 * j });
  }

  placed.forEach((p, j) => {
    p.level.refs.forEach((ref, i) => {
      if (!ref) return;
      // 勝者側と同じ理由で、試合を経ていない通過枠には箱を描かない
      if (j > 0 && ref.type !== 'winner') return;
      const parent = placed[j + 1];
      const parentRef = parent
        ? parent.level.refs[parent.level.kind === 'minor' ? Math.floor(i / 2) : i]
        : null;
      const style = { role: j === 0 ? 'team' : 'slot' };
      const next = nextMatchOf(tournament, ref, parentRef);
      if (next) style.winnerOf = next;
      else if (ref.type === 'winner') style.championOf = ref.match;
      g.set(p.rows[i], p.col, liveRefFormula(tournament, ref), style);
      if (ref.type === 'winner') inBracket.add(ref.match);
      if (style.winnerOf && parent) {
        const idx = parent.level.kind === 'minor' ? Math.floor(i / 2) : i;
        g.path(p.rows[i], parent.rows[idx], p.col + 1, a1(p.rows[i], p.col), style.winnerOf);
      }
      // 横線。小ラウンドの合流は下で縦線もつなぐ
      g.border(p.rows[i], p.col, p.rows[i], p.col, 'bottom');
      // 大ラウンドは合流の縦線が無いので、前の列から横線でつなぐ
      if (j > 0 && p.level.kind === 'major') {
        g.border(p.rows[i], p.col - 1, p.rows[i], p.col - 1, 'bottom');
      }
    });

    const next = placed[j + 1];
    if (next && next.level.kind === 'minor') {
      for (let k = 0; k < next.level.refs.length; k++) {
        if (!next.level.refs[k]) continue;
        const top = p.rows[k * 2];
        const bottom = p.rows[k * 2 + 1];
        const conn = p.col + 1;
        g.border(top + 1, conn, bottom, conn, 'left');
        g.border(next.rows[k], conn, next.rows[k], conn, 'bottom');
      }
    }
  });

  return base + levels[0].refs.length * 2 + 1;
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
    // 幅の広い4列目にセット（「12-9」のような2桁同士が入る）、狭い5列目に直対（1桁）を置く。
    // 列幅はブラケット図と共有していて、順位表だけ変えることはできない。
    g.cells.get(`${row},4`).value = 'セット';
    g.cells.get(`${row},5`).value = '直対';
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

  g.set(row, 1, '※ 上位の色付きが決勝トーナメント進出。順位は 勝数 → 直接対決 → セット率 の順で決めます。すべて並んだ組は「じゃんけん」欄が黄色くなるので、入力用タブの下部にある「じゃんけん」欄に、代表者のじゃんけんで決めた順位（1が勝ち）を入れてください。', { role: 'note' });
  g.merge(row, 1, row, 6);
  return row + 2;
}
