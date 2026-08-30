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

/** 依存関係のみを見る。準備できた試合を出現順にコート数ぶんずつ束ねる。 */
export function dependencyOnly(matches, { courts }) {
  const placed = new Set();
  const remaining = [...matches];
  const slots = [];

  const ready = (m) =>
    [m.left, m.right].every((r) => r.type === 'team' || placed.has(r.match));

  while (remaining.length > 0) {
    const batch = [];
    for (let i = 0; i < remaining.length && batch.length < courts; i++) {
      if (ready(remaining[i])) batch.push(remaining[i]);
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
    const deps = [m.left, m.right].filter((r) => r.type !== 'team').map((r) => at.get(r.match));
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
    const deps = [m.left, m.right].filter((r) => r.type !== 'team').map((r) => placed.get(r.match));
    if (deps.some((d) => d === undefined)) return -1;
    return deps.length ? k - Math.max(...deps) : Infinity;
  };
  while (remaining.length > 0) {
    const k = slots.length;
    const pick = (need) => {
      const batch = [];
      for (const m of remaining) {
        if (batch.length >= courts) break;
        if (gapOf(m, k) >= need) batch.push(m);
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
