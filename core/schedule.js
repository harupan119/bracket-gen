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
