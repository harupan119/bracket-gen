// 既存の自動進行版（Code.gs）と同じ配色を踏襲する
export const COLORS = {
  line: '#202124',        // ブラケットの枝
  header: '#F1F3F4',
  winner: '#D93025',      // 勝者セル・勝ち上がり経路
  loser: '#9AA0A6',
  resultPending: '#FFF2CC', // 未入力の結果セル（黄）
  resultDone: '#E2F0D9',    // 入力済みの結果セル（緑）
};

export function toRgb(hex) {
  const h = hex.replace('#', '');
  return {
    red: parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue: parseInt(h.slice(4, 6), 16) / 255,
  };
}
