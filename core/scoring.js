/**
 * 結果入力のプリセット。
 *
 * どのプリセットも「入力値から左右どちらが勝ったかを一意に判定できる」ことを条件にする。
 * 自由記入は勝者を機械判定できず、勝者・次戦・着色の自動化が成立しないため用意しない。
 */
export const SCORING = {
  'win-loss': {
    label: '勝敗のみ',
    options: ['左の勝ち', '右の勝ち'],
    leftWins: (cell) => `${cell}="左の勝ち"`,
  },
  'sets-of-3': {
    label: '3本勝負（既存のバレー・団体戦と同じ）',
    options: ['3-0', '2-1', '1-2', '0-3'],
    leftWins: (cell) => `OR(${cell}="3-0",${cell}="2-1")`,
  },
  'sets-of-5': {
    label: '5セットマッチ',
    options: ['3-0', '3-1', '3-2', '2-3', '1-3', '0-3'],
    leftWins: (cell) => `OR(${cell}="3-0",${cell}="3-1",${cell}="3-2")`,
  },
};

/** 入力値が選択肢のどれかであることを確かめる式。想定外の値を「確定」にしないため。 */
export function validScore(sc, cell) {
  return `OR(${sc.options.map((o) => `${cell}="${o}"`).join(',')})`;
}

export function getScoring(name) {
  const s = SCORING[name];
  if (!s) {
    throw new Error(`未対応の scoring です: ${name}（対応: ${Object.keys(SCORING).join(' / ')}）`);
  }
  return s;
}
