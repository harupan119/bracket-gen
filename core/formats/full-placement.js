import { circled, teamLabel } from '../util.js';
import { validateFullPlacement } from '../validate.js';

/**
 * 完全順位決定トーナメント（N = 2^k 限定）
 *
 * 構造は再帰的な二分割。ある 2^m チームの集合を m 回戦で完全に順位づける:
 *   1. 総当たりせず 2^(m-1) 試合で二分する
 *   2. 勝者側 2^(m-1) チームを再帰的に順位づけ → 上位半分の順位
 *   3. 敗者側 2^(m-1) チームを再帰的に順位づけ → 下位半分の順位
 *
 * 結果として全チームがちょうど m 試合を戦い、1位から 2^m 位まで全部決まる。
 * 総試合数は N * log2(N) / 2。
 *
 * 試合番号は「ラウンド優先、同一ラウンド内は下位の順位帯を先」に振る。
 * これは 8チーム版の実物（⑤⑥=下山、⑦⑧=上山、⑨=7位決定 … ⑫=決勝）と一致する規則。
 */
export function buildFullPlacement({ teams }) {
  validateFullPlacement(teams);

  const entrants = [];
  for (let i = 0; i < teams; i++) {
    entrants.push({ type: 'team', index: i, label: teamLabel(i) });
  }

  const raw = [];
  let seq = 0;

  function build(list, rankStart, roundNo) {
    if (list.length === 1) return;
    const n = list.length;
    const created = [];
    for (let i = 0; i < n; i += 2) {
      const m = {
        seq: seq++,
        roundNo,
        rankStart,          // この試合の勝敗が関わる順位帯の先頭
        rankSpan: n,        // 順位帯の広さ
        left: list[i],
        right: list[i + 1],
      };
      raw.push(m);
      created.push(m);
    }
    build(created.map((m) => ({ type: 'winner', of: m })), rankStart, roundNo + 1);
    build(created.map((m) => ({ type: 'loser', of: m })), rankStart + n / 2, roundNo + 1);
  }

  build(entrants, 1, 1);

  const ordered = [...raw].sort(
    (a, b) => a.roundNo - b.roundNo || b.rankStart - a.rankStart || a.seq - b.seq
  );

  ordered.forEach((m, i) => {
    m.no = i + 1;
    m.id = `M${i + 1}`;
    m.label = circled(i + 1);
  });

  const resolveRef = (ref) =>
    ref.type === 'team'
      ? { type: 'team', index: ref.index, label: ref.label }
      : { type: ref.type, match: ref.of.id, matchLabel: ref.of.label };

  for (const m of ordered) {
    m.leftRef = resolveRef(m.left);
    m.rightRef = resolveRef(m.right);
    m.winnerTo = null;
    m.loserTo = null;
  }
  // 各試合の勝者・敗者がどの試合へ送られるかを、参照元から逆算して埋める
  for (const m of ordered) {
    for (const [ref, side] of [[m.left, 'left'], [m.right, 'right']]) {
      if (ref.type === 'winner') ref.of.winnerTo = m.id;
      if (ref.type === 'loser') ref.of.loserTo = m.id;
    }
  }

  const rounds = Math.log2(teams);

  return {
    format: 'full-placement',
    teams,
    teamLabels: entrants.map((e) => e.label),
    rounds,
    placements: teams,
    matches: ordered.map((m) => ({
      id: m.id,
      no: m.no,
      label: m.label,
      roundNo: m.roundNo,
      roundName: roundName(m, rounds),
      rankStart: m.rankStart,
      rankSpan: m.rankSpan,
      left: m.leftRef,
      right: m.rightRef,
      winnerTo: m.winnerTo,
      loserTo: m.loserTo,
      // 順位帯が2まで狭まった試合が、そのまま順位を確定させる
      decides: m.rankSpan === 2 ? { winner: m.rankStart, loser: m.rankStart + 1 } : null,
    })),
  };
}

function roundName(m, rounds) {
  if (m.roundNo === 1) return '1回戦';
  if (m.rankSpan === 2) {
    return m.rankStart === 1 ? '決勝' : `${m.rankStart}位決定戦`;
  }
  // 2回戦はちょうど上半分/下半分の分割になるので、実物と同じ「上山／下山」で呼ぶ。
  // 3回戦以降はその呼び分けが成立しないため順位帯で示す。
  const band =
    m.roundNo === 2
      ? m.rankStart === 1
        ? '（上山）'
        : '（下山）'
      : `（${m.rankStart}〜${m.rankStart + m.rankSpan - 1}位）`;
  if (m.rankSpan === 4 && m.rankStart === 1) return `準決勝${band}`;
  return `${m.roundNo}回戦${band}`;
}
