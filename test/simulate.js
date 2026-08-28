/** 勝敗パターンを1つ与えて、順位が確定するかを最後まで解く。 */
export function simulate(tournament, outcomeBits) {
  const winner = new Map();
  const loser = new Map();
  const playCount = new Map();
  const lossCount = new Map();
  const ranks = new Map();

  // 参照が指すチームを、その試合の時点で解決する
  const resolveIn = (ref) => resolve(ref);

  const resolve = (ref) => {
    if (ref.type === 'team') return ref.index;
    const m = ref.type === 'winner' ? winner : loser;
    if (!m.has(ref.match)) throw new Error(`未解決の参照: ${ref.match} の${ref.type}`);
    return m.get(ref.match);
  };

  const skipped = new Set();
  tournament.matches.forEach((match, i) => {
    // 条件付きの試合（決勝リセット）は、条件を満たさなければ実施しない
    if (match.playedIf) {
      const src = tournament.matches.find((m) => m.id === match.playedIf.match);
      const side = match.playedIf.side === 'left' ? src.left : src.right;
      if (winner.get(src.id) !== resolveIn(side, src)) {
        skipped.add(match.id);
        return;
      }
    }
    const l = resolve(match.left);
    const r = resolve(match.right);
    if (l === r) throw new Error(`${match.label}: 同じチームが両側に入りました (${l})`);
    const rightWins = (outcomeBits >> i) & 1;
    const w = rightWins ? r : l;
    const lo = rightWins ? l : r;
    winner.set(match.id, w);
    loser.set(match.id, lo);
    playCount.set(l, (playCount.get(l) ?? 0) + 1);
    playCount.set(r, (playCount.get(r) ?? 0) + 1);
    lossCount.set(lo, (lossCount.get(lo) ?? 0) + 1);
    if (match.decides) {
      ranks.set(match.decides.winner, w);
      ranks.set(match.decides.loser, lo);
    }
  });

  return { ranks, playCount, lossCount, winner, loser, skipped };
}
