import { circled, teamLabel, seedOrder } from '../util.js';

export { seedOrder };
import { validateTeams } from '../validate.js';

const BYE = { type: 'bye' };
const isBye = (r) => r.type === 'bye';

/**
 * ダブルエリミネーション。
 *
 * 勝者側は標準のシードブラケット（size = 2^ceil(log2 N)、余りはシード＝不戦勝）。
 * 敗者側は「小ラウンド（敗者同士）→ 大ラウンド（勝者側の脱落者と対戦）」の交互構成。
 * 総試合数は 2N-2（＋決勝リセット1）。
 *
 * 実物 10team_double_auto.xlsx の勝者側は手作りの独自形状（1回戦4試合・シード2つ）で、
 * 一般則が立たないため再現しない。試合数 9 / 8 という構造不変量は標準と一致する。
 */
export function buildDoubleElimination({ teams, bracketReset = true }) {
  validateTeams(teams);
  if (teams < 4) throw new Error(`ダブルエリミネーションは4チーム以上で使ってください: ${teams}`);

  const size = 2 ** Math.ceil(Math.log2(teams));
  const order = seedOrder(size);
  const raw = [];
  let seq = 0;

  const play = (left, right, meta) => {
    if (isBye(left) && isBye(right)) return { win: BYE, lose: BYE };
    if (isBye(left)) return { win: right, lose: BYE };
    if (isBye(right)) return { win: left, lose: BYE };
    const m = { ...meta, seq: seq++, left, right };
    raw.push(m);
    return { win: { type: 'winner', of: m }, lose: { type: 'loser', of: m } };
  };

  // ---- 勝者側 ----
  let cur = order.map((s) =>
    s <= teams ? { type: 'team', index: s - 1, label: teamLabel(s - 1) } : BYE
  );
  const wbLosers = [];
  let wr = 1;
  // 勝者側のスロット列を保存する。敗者側は木構造にならないのでリストで描く。
  const levels = [cur.slice()];
  while (cur.length > 1) {
    const next = [], losers = [];
    for (let i = 0; i < cur.length; i += 2) {
      const { win, lose } = play(cur[i], cur[i + 1], { bracket: 'W', roundNo: wr });
      next.push(win);
      losers.push(lose);
    }
    wbLosers.push(losers);
    cur = next;
    levels.push(cur.slice());
    wr += 1;
  }
  const wbChampion = cur[0];
  const wbRounds = wr - 1;

  // ---- 敗者側 ----
  let pool = wbLosers[0] ?? [];
  let lr = 1;
  for (let r = 1; r < wbLosers.length; r++) {
    const minor = [];
    for (let i = 0; i < pool.length; i += 2) {
      minor.push(play(pool[i], pool[i + 1] ?? BYE, { bracket: 'L', roundNo: lr }).win);
    }
    lr += 1;
    pool = minor;

    const drop = wbLosers[r];
    const major = [];
    for (let i = 0; i < pool.length; i++) {
      major.push(play(pool[i], drop[i] ?? BYE, { bracket: 'L', roundNo: lr }).win);
    }
    lr += 1;
    pool = major;
  }
  const lbChampion = pool[0] ?? BYE;

  // ---- 決勝 ----
  const grand = play(wbChampion, lbChampion, { bracket: 'F', roundNo: 1 });
  const grandMatch = raw[raw.length - 1];

  let resetMatch = null;
  if (bracketReset && grandMatch) {
    // 敗者側代表が決勝で勝った場合のみ実施する。1敗の重みを釣り合わせるための一戦。
    resetMatch = {
      bracket: 'F', roundNo: 2, seq: seq++,
      left: { type: 'winner', of: grandMatch },
      right: { type: 'loser', of: grandMatch },
      conditional: true,
      // 決勝で敗者側代表（右側）が勝ったときだけ実施する
      playedIf: { match: grandMatch, side: 'right' },
    };
    raw.push(resetMatch);
  }

  // ---- 並べ替えと採番 ----
  const depth = new Map();
  const depthOf = (m) => {
    if (depth.has(m)) return depth.get(m);
    const d = 1 + Math.max(
      ...[m.left, m.right].map((r) => (r.type === 'team' || isBye(r) ? 0 : depthOf(r.of)))
    );
    depth.set(m, d);
    return d;
  };
  raw.forEach(depthOf);
  const rank = { W: 0, L: 1, F: 2 };
  const ordered = [...raw].sort(
    (a, b) => depthOf(a) - depthOf(b) || rank[a.bracket] - rank[b.bracket] || a.seq - b.seq
  );

  const counters = { W: 0, L: 0 };
  ordered.forEach((m, i) => {
    m.id = `M${i + 1}`;
    m.no = i + 1;
    if (m.bracket === 'F') {
      m.label = m.conditional ? '決勝R' : '決勝';
      m.roundName = m.conditional ? '決勝リセット' : '決勝';
    } else {
      counters[m.bracket] += 1;
      const mark = circled(counters[m.bracket]);
      m.label = (m.bracket === 'W' ? '表' : '裏') + mark;
      m.roundName = m.bracket === 'W' ? `勝者側 ${m.roundNo}回戦` : `敗者側 ${m.roundNo}回戦`;
    }
  });

  const resolve = (ref) =>
    ref.type === 'team'
      ? { type: 'team', index: ref.index, label: ref.label }
      : { type: ref.type, match: ref.of.id, matchLabel: ref.of.label };

  for (const m of ordered) {
    m.leftRef = resolve(m.left);
    m.rightRef = resolve(m.right);
    m.winnerTo = null;
    m.loserTo = null;
  }
  for (const m of ordered) {
    for (const ref of [m.left, m.right]) {
      if (ref.type === 'winner') ref.of.winnerTo = m.id;
      if (ref.type === 'loser') ref.of.loserTo = m.id;
    }
  }

  const lbFinal = [...ordered].reverse().find((m) => m.bracket === 'L');

  return {
    format: 'double-elimination',
    teams,
    tree: {
      size,
      levels: levels.map((lv) => lv.map((r) => (isBye(r) ? null : resolve(r)))),
      title: '勝者側ブラケット'
    },
    teamLabels: Array.from({ length: teams }, (_, i) => teamLabel(i)),
    rounds: wbRounds,
    placements: 3,
    bracketReset: Boolean(resetMatch),
    matches: ordered.map((m) => ({
      id: m.id, no: m.no, label: m.label,
      roundNo: m.roundNo, roundName: m.roundName,
      bracket: m.bracket,
      conditional: Boolean(m.conditional),
      left: m.leftRef, right: m.rightRef,
      winnerTo: m.winnerTo, loserTo: m.loserTo,
      // 決勝リセットが実施された場合は、そちらが1位・2位を上書きする
      decides:
        m === grandMatch || m === resetMatch ? { winner: 1, loser: 2 }
        : m === lbFinal ? { loser: 3 }
        : null,
      playedIf: m.playedIf ? { match: m.playedIf.match.id, side: m.playedIf.side } : null,
      rankStart: 1, rankSpan: teams,
    })),
  };
}
