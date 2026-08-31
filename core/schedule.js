/**
 * 試合を「枠」へ割り当てる。
 *
 * 枠 = 同時に走らせる試合のまとまり。コート数が枠の上限。
 * 時刻は出さない（開始時刻・所要時間は運営が現場で決める）。
 *
 * ★拡張ポイント: strategy を差し替えると割当規則を変えられる。
 *   初版は dependencyOnly（依存関係だけを見る）。
 *   連戦回避が必要になったら avoidBackToBack を実装して渡す。
 */

/**
 * その試合を組むために先に終わっていなければならない試合のID。
 *
 * 勝者/敗者の参照はその試合そのもの。
 * 「A組1位」のような順位参照は、その組の予選が全部終わらないと確定しないので、
 * 組の全試合を依存として返す。ここを取りこぼすと、順位参照が
 * 「依存の無い試合」と誤解され、予選より前に組まれてしまう。
 */
export function dependenciesOf(match, allMatches) {
  const out = [];
  for (const ref of [match.left, match.right]) {
    if (ref.type === 'winner' || ref.type === 'loser') out.push(ref.match);
    else if (ref.type === 'groupRank') {
      for (const m of allMatches) {
        if (m.stage === 'group' && m.group === ref.group) out.push(m.id);
      }
    }
  }
  return out;
}

/**
 * 割当時点で誰が出るか分かっている出場者。
 *
 * 勝者/敗者の参照は結果次第なので分からないが、その試合は依存関係で必ず
 * 別の枠へ回るため、同じ枠での重複は起きない。
 * 一方で予選の総当たりは、同じチームの試合どうしに依存関係が無い。
 * ここを見ないと「1チームが同時刻に2コート」という割当が通ってしまう。
 */
function knownPlayers(match) {
  const out = [];
  for (const ref of [match.left, match.right]) {
    if (ref?.type === 'team') out.push(`T${ref.index}`);
    else if (ref?.type === 'groupRank') out.push(`G${ref.group}-${ref.rank}`);
  }
  return out;
}

/** 同じ枠に入れられるか。出場者が1人でも重なったら不可。 */
function fits(match, taken) {
  return knownPlayers(match).every((p) => !taken.has(p));
}

const claim = (match, taken) => knownPlayers(match).forEach((p) => taken.add(p));

/** 依存関係のみを見る。準備できた試合を出現順にコート数ぶんずつ束ねる。 */
export function dependencyOnly(matches, { courts }) {
  const placed = new Set();
  const remaining = [...matches];
  const slots = [];

  const ready = (m) => dependenciesOf(m, matches).every((id) => placed.has(id));

  while (remaining.length > 0) {
    const batch = [];
    const taken = new Set();
    for (let i = 0; i < remaining.length && batch.length < courts; i++) {
      const m = remaining[i];
      if (!ready(m) || !fits(m, taken)) continue;
      batch.push(m);
      claim(m, taken);
    }
    if (batch.length === 0) {
      throw new Error('枠割当が進みません。試合の依存関係が循環しています。');
    }
    for (const m of batch) {
      remaining.splice(remaining.indexOf(m), 1);
      placed.add(m.id);
    }
    slots.push(batch);
  }
  return slots;
}

/** その割当で「直前の枠に依存元がある（＝連戦）」試合が何本あるか。 */
export function countBackToBack(matches, slots) {
  const at = new Map();
  slots.forEach((batch, i) => batch.forEach((m) => at.set(m.id, i)));
  let tight = 0;
  for (const m of matches) {
    const deps = dependenciesOf(m, matches).map((id) => at.get(id));
    if (deps.length && at.get(m.id) - Math.max(...deps) === 1) tight += 1;
  }
  return tight;
}

/** 依存元から minGap 枠あけることを優先して詰める。満たせない枠だけ緩める。 */
function greedy(matches, courts, minGap) {
  const placed = new Map();
  const remaining = [...matches];
  const slots = [];
  const gapOf = (m, k) => {
    const deps = dependenciesOf(m, matches).map((id) => placed.get(id));
    if (deps.some((d) => d === undefined)) return -1;
    return deps.length ? k - Math.max(...deps) : Infinity;
  };
  while (remaining.length > 0) {
    const k = slots.length;
    const pick = (need) => {
      const batch = [];
      const taken = new Set();
      for (const m of remaining) {
        if (batch.length >= courts) break;
        if (gapOf(m, k) < need || !fits(m, taken)) continue;
        batch.push(m);
        claim(m, taken);
      }
      return batch;
    };
    let batch = pick(minGap);
    if (batch.length === 0) batch = pick(1); // 空の枠を作らないための緩和
    if (batch.length === 0) throw new Error('枠割当が進みません。試合の依存関係が循環しています。');
    for (const m of batch) {
      remaining.splice(remaining.indexOf(m), 1);
      placed.set(m.id, k);
    }
    slots.push(batch);
  }
  return slots;
}

/**
 * 連戦を避ける。
 *
 * スケジュールを組む時点では、1回戦以外は誰が出るか分からない（結果依存）。
 * ただし「この試合の出場者は、あの試合の勝者/敗者」という関係は分かるので、
 * 「依存元の枠から何枠あいているか」を連戦の代理指標として使う。
 *
 * 単純な貪欲法は兄弟試合を引き離して下流を圧迫し、かえって連戦を増やすことがある
 * （実測: 完全順位決定8チーム2コートで 1本 → 2本 に悪化した）。
 * そこで複数の間隔で組んで、連戦が最も少ないものを選ぶ。
 * minGap=1 は依存関係のみの割当と同じなので、この方式は決して悪化しない。
 *
 * ただし連戦を減らすほど枠が増える＝開催が長くなる。
 * 実測でダブル20チーム3コートは 枠17→21（+4）で連戦12→7 になった。
 * 1枠20分なら80分の延長で、黙って受け入れられる差ではない。
 * そこで枠の増加を maxExtraSlots までに制限し、その範囲で連戦が最少のものを採る。
 */
export function avoidBackToBack(matches, { courts, gaps = [1, 2, 3], maxExtraSlots = 2 }) {
  const candidates = gaps
    .map((g) => greedy(matches, courts, g))
    .map((slots) => ({ slots, tight: countBackToBack(matches, slots) }));
  const shortest = Math.min(...candidates.map((c) => c.slots.length));
  const affordable = candidates.filter((c) => c.slots.length - shortest <= maxExtraSlots);
  return affordable.sort((a, b) => a.tight - b.tight || a.slots.length - b.slots.length)[0].slots;
}

export function scheduleMatches(tournament, { courts, strategy = dependencyOnly }) {
  if (!Number.isInteger(courts) || courts < 1) {
    throw new Error(`courts は1以上の整数で指定してください: ${courts}`);
  }
  const slots = strategy(tournament.matches, { courts });
  return slots.map((batch, i) => ({
    no: i + 1,
    label: `枠 ${i + 1}`,
    matches: batch.map((m, c) => ({ court: c + 1, matchId: m.id, matchLabel: m.label })),
  }));
}
