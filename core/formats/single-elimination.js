import { circled, teamLabel, seedOrder } from '../util.js';
import { validateTeams } from '../validate.js';

const BYE = { type: 'bye' };
const isBye = (r) => r.type === 'bye';

/**
 * シングルエリミネーション。
 *
 * 構造はダブルエリミネーションの勝者側と同じ標準シードブラケット（N-1試合）。
 * 2の冪でないぶんは上位シードが1回戦を免除される。
 * 3位決定戦を入れると準決勝の敗者同士が戦い、3位と4位まで決まる。
 * 入れない場合は3位が2チーム出るため、既定では入れる。
 */
export function buildSingleElimination({ teams, thirdPlace = true }) {
  validateTeams(teams);

  const size = 2 ** Math.ceil(Math.log2(teams));
  const raw = [];
  let seq = 0;

  const play = (left, right, meta) => {
    if (isBye(left) && isBye(right)) return BYE;
    if (isBye(left)) return right;
    if (isBye(right)) return left;
    const m = { ...meta, seq: seq++, left, right };
    raw.push(m);
    return { type: 'winner', of: m };
  };

  let cur = seedOrder(size).map((s) =>
    s <= teams ? { type: 'team', index: s - 1, label: teamLabel(s - 1) } : BYE
  );
  let roundNo = 1;
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(play(cur[i], cur[i + 1], { roundNo }));
    }
    cur = next;
    roundNo += 1;
  }
  const rounds = roundNo - 1;

  const finalMatch = raw[raw.length - 1];
  const semis = raw.filter((m) => m.roundNo === rounds - 1);

  let thirdMatch = null;
  if (thirdPlace && semis.length === 2) {
    thirdMatch = {
      roundNo: rounds,
      seq: seq++,
      left: { type: 'loser', of: semis[0] },
      right: { type: 'loser', of: semis[1] },
      isThirdPlace: true,
    };
    raw.push(thirdMatch);
  }

  // 3位決定戦は決勝と同じラウンドだが、先に並べる（実物の慣習に合わせる）
  const ordered = [...raw].sort(
    (a, b) => a.roundNo - b.roundNo || Number(Boolean(b.isThirdPlace)) - Number(Boolean(a.isThirdPlace)) || a.seq - b.seq
  );

  ordered.forEach((m, i) => {
    m.id = `M${i + 1}`;
    m.no = i + 1;
    m.label = m.isThirdPlace ? '3位決定戦' : circled(i + 1);
    m.roundName = m.isThirdPlace
      ? '3位決定戦'
      : m === finalMatch
        ? '決勝'
        : m.roundNo === rounds - 1
          ? '準決勝'
          : `${m.roundNo}回戦`;
  });
  // 3位決定戦に番号を振らないぶん、他の試合の丸数字を詰め直す
  let n = 0;
  for (const m of ordered) {
    if (m.isThirdPlace) continue;
    n += 1;
    m.no = n;
    m.label = circled(n);
  }

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

  return {
    format: 'single-elimination',
    teams,
    teamLabels: Array.from({ length: teams }, (_, i) => teamLabel(i)),
    rounds,
    placements: thirdMatch ? 4 : 2,
    matches: ordered.map((m) => ({
      id: m.id, no: m.no, label: m.label,
      roundNo: m.roundNo, roundName: m.roundName,
      left: m.leftRef, right: m.rightRef,
      winnerTo: m.winnerTo, loserTo: m.loserTo,
      decides:
        m === finalMatch ? { winner: 1, loser: 2 }
        : m === thirdMatch ? { winner: 3, loser: 4 }
        : null,
      rankStart: 1, rankSpan: teams,
    })),
  };
}
