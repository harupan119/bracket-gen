// 既存の自動進行版（Code.gs）と同じ配色を踏襲する
export const COLORS = {
  line: '#202124',        // ブラケットの枝
  header: '#F1F3F4',
  winner: '#D93025',      // 勝ち上がり経路の線（連結列を塗る）
  winnerBox: '#FCE8E6',   // 経路上のチーム枠の地。線より淡くしないと箱が潰れて帯に見える
  winnerText: '#B31412',  // 経路上のチーム名。淡い地に白文字は読めないので濃い赤にする
  loser: '#9AA0A6',
  resultPending: '#FFF2CC', // 未入力の結果セル（黄）
  resultDone: '#E2F0D9',    // 入力済みの結果セル（緑）
  advance: '#D9EAD3',       // 予選通過ラインの行。入力済みの緑より一段濃くして区別する
};

export { toRgb } from './theme.js';
