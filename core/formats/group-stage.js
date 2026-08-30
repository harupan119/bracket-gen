import { circled, teamLabel, seedOrder } from '../util.js';
import { validateTeams } from '../validate.js';

/**
 * 1回戦で同じ組同士が当たらないよう入れ替える。
 *
 * 標準のシード配置は、進出者数がちょうど2の冪なら同組を分けてくれる
 * （4組8チームなら A1-D2 / D1-A2 / B1-C2 / C1-B2）。
 * ただし不戦勝が入ると配置がずれて隣り合うことがある
 * （3組6チームを8枠に入れると C1-C2 が発生した）。
 * 一般則で書くより、組んでから衝突を直す方が確実なのでこの形にする。
 *
 * 避けるのは2つ。同じ組同士と、1位同士。
 * 同組だけを見て直すと1位同士が当たる配置になり、予選1位の利点が消える
 * （実測: 12チーム3組で C組1位 vs A組1位 が発生した）。
 */
function separateSameGroup(slots) {
  const info = (x) => (x && x.type === 'groupRank' ? x : null);
  const bad = (a, b) => {
    const [x, y] = [info(a), info(b)];
    if (!x || !y) return false;
    return x.group === y.group || (x.rank === 1 && y.rank === 1);
  };

  for (let i = 0; i < slots.length; i += 2) {
    if (!bad(slots[i], slots[i + 1])) continue;
    let fixed = false;
    for (let j = 0; j < slots.length && !fixed; j += 2) {
      if (j === i) continue;
      for (const k of [0, 1]) {
        const cand = slots[j + k];
        const partner = slots[j + (1 - k)];
        // 入れ替えた先でも成立することを確かめてから動かす
        if (!bad(slots[i], cand) && !bad(slots[i + 1], partner)) {
          slots[j + k] = slots[i + 1];
          slots[i + 1] = cand;
          fixed = true;
          break;
        }
      }
    }
  }
  return slots;
}

/** 組の記号。A組・B組…。 */
export const groupLabel = (i) => `${String.fromCharCode(65 + i)}組`;

/**
 * チームを組に分ける。実力が偏らないよう蛇行（スネーク）で配る。
 * 1..N のシード順で 0,1,2,2,1,0,0,1,2... と折り返す。
 */
export function splitGroups(teams, groups) {
  const out = Array.from({ length: groups }, () => []);
  for (let i = 0; i < teams; i++) {
    const round = Math.floor(i / groups);
    const pos = round % 2 === 0 ? i % groups : groups - 1 - (i % groups);
    out[pos].push(i);
  }
  return out;
}

/** 組の数の既定値。1組4〜5チームになるように決める。 */
export function defaultGroups(teams) {
  return Math.max(2, Math.round(teams / 4.5));
}

/**
 * 予選リーグ → 決勝トーナメント。
 *
 * 予選は組ごとの総当たり。各組の上位が決勝トーナメントへ進む。
 * 決勝トーナメントの出場者は「A組1位」のように順位で決まるため、
 * 誰が出るかは予選が終わるまで確定しない。
 * そこで参照の型に groupRank を足し、シート側では順位表から引く。
 */
export function buildGroupStage({ teams, groups, advancePerGroup = 2, thirdPlace = true }) {
  validateTeams(teams);
  const groupCount = groups ?? defaultGroups(teams);
  if (groupCount < 2) throw new Error(`組数は2以上にしてください: ${groupCount}`);
  const members = splitGroups(teams, groupCount);
  const smallest = Math.min(...members.map((g) => g.length));
  if (smallest < 3) {
    throw new Error(
      `${teams}チームを${groupCount}組に分けると1組${smallest}チームになります。\n` +
        `総当たりの意味が薄いので、組数を減らすかチーム数を増やしてください。`
    );
  }
  if (advancePerGroup >= smallest) {
    throw new Error(
      `1組${smallest}チームから${advancePerGroup}チーム進出では、予選で落ちるチームがほとんど出ません。`
    );
  }

  const raw = [];
  let seq = 0;

  // ---- 予選: 組ごとの総当たり ----
  members.forEach((team, g) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        raw.push({
          seq: seq++, stage: 'group', group: g, roundNo: 1,
          left: { type: 'team', index: team[i], label: teamLabel(team[i]) },
          right: { type: 'team', index: team[j], label: teamLabel(team[j]) },
        });
      }
    }
  });

  // ---- 決勝トーナメント: 各組の上位が進出 ----
  // 同じ組の1位と2位が1回戦で当たらないよう、順位ごとにまとめて並べる
  const qualifiers = [];
  for (let r = 1; r <= advancePerGroup; r++) {
    for (let g = 0; g < groupCount; g++) {
      qualifiers.push({ type: 'groupRank', group: g, rank: r, label: `${groupLabel(g)}${r}位` });
    }
  }
  const size = 2 ** Math.ceil(Math.log2(qualifiers.length));
  const BYE = { type: 'bye' };
  const slots = seedOrder(size).map((s) => (s <= qualifiers.length ? qualifiers[s - 1] : BYE));
  separateSameGroup(slots);

  const play = (left, right, meta) => {
    if (left.type === 'bye' && right.type === 'bye') return { win: BYE, lose: BYE };
    if (left.type === 'bye') return { win: right, lose: BYE };
    if (right.type === 'bye') return { win: left, lose: BYE };
    const m = { ...meta, seq: seq++, left, right };
    raw.push(m);
    return { win: { type: 'winner', of: m }, lose: { type: 'loser', of: m } };
  };

  let cur = slots;
  let round = 1;
  const levels = [cur.slice()];
  while (cur.length > 1) {
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(play(cur[i], cur[i + 1], { stage: 'knockout', roundNo: round }).win);
    }
    cur = next;
    levels.push(cur.slice());
    round += 1;
  }
  const koRounds = round - 1;
  const finalMatch = raw[raw.length - 1];
  const semis = raw.filter((m) => m.stage === 'knockout' && m.roundNo === koRounds - 1);

  let thirdMatch = null;
  if (thirdPlace && semis.length === 2) {
    thirdMatch = {
      stage: 'knockout', roundNo: koRounds, seq: seq++,
      left: { type: 'loser', of: semis[0] },
      right: { type: 'loser', of: semis[1] },
      isThirdPlace: true,
    };
    raw.push(thirdMatch);
  }

  // ---- 並べ替えと採番 ----
  const stageRank = { group: 0, knockout: 1 };
  const ordered = [...raw].sort(
    (a, b) =>
      stageRank[a.stage] - stageRank[b.stage] ||
      (a.stage === 'group' ? a.group - b.group : a.roundNo - b.roundNo) ||
      Number(Boolean(b.isThirdPlace)) - Number(Boolean(a.isThirdPlace)) ||
      a.seq - b.seq
  );
  ordered.forEach((m, i) => {
    m.id = `M${i + 1}`;
    m.no = i + 1;
    m.label = circled(i + 1);
    m.roundName =
      m.stage === 'group'
        ? `予選 ${groupLabel(m.group)}`
        : m.isThirdPlace
          ? '3位決定戦'
          : m === finalMatch
            ? '決勝'
            : m.roundNo === koRounds - 1
              ? '準決勝'
              : `決勝T ${m.roundNo}回戦`;
  });

  const resolve = (ref) =>
    ref.type === 'team'
      ? { type: 'team', index: ref.index, label: ref.label }
      : ref.type === 'groupRank'
        ? { type: 'groupRank', group: ref.group, rank: ref.rank, label: ref.label }
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
    format: 'group-stage',
    teams,
    teamLabels: Array.from({ length: teams }, (_, i) => teamLabel(i)),
    groups: members.map((team, g) => ({
      index: g,
      label: groupLabel(g),
      teams: team,
      advance: advancePerGroup,
    })),
    advancePerGroup,
    rounds: koRounds,
    placements: thirdMatch ? 4 : 2,
    tree: {
      title: '決勝トーナメント',
      size,
      levels: levels.map((lv) => lv.map((r) => (r.type === 'bye' ? null : resolve(r)))),
    },
    matches: ordered.map((m) => ({
      id: m.id, no: m.no, label: m.label,
      stage: m.stage, group: m.group ?? null,
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
