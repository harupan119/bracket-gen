import { isPowerOfTwo } from './util.js';

export const MIN_TEAMS = 4;
export const MAX_TEAMS = 20;

// 完全順位決定が成立するチーム数。2の冪でないと「全員同じ試合数・全順位確定」が壊れる。
export const FULL_PLACEMENT_SIZES = [4, 8, 16];

export function validateTeams(teams) {
  if (!Number.isInteger(teams)) {
    throw new Error(`teams は整数で指定してください: ${teams}`);
  }
  if (teams < MIN_TEAMS || teams > MAX_TEAMS) {
    throw new Error(`teams は ${MIN_TEAMS}〜${MAX_TEAMS} の範囲で指定してください: ${teams}`);
  }
}

export function validateFullPlacement(teams) {
  validateTeams(teams);
  if (!isPowerOfTwo(teams) || !FULL_PLACEMENT_SIZES.includes(teams)) {
    throw new Error(
      `完全順位決定トーナメントは ${FULL_PLACEMENT_SIZES.join(' / ')} チームでのみ成立します（指定: ${teams}）。\n` +
      `この形式は「全チームが同じ試合数を戦い、1位から最下位まで全順位が決まる」ことが前提で、\n` +
      `2の冪でないチーム数ではシードが必要になり、試合数が不均等になります。\n` +
      `${teams} チームなら format: single または double を選んでください。`
    );
  }
}

// 生成前に出す警告。エラーではないが運営に影響する事実。
export function warningsFor({ format, teams, courts }) {
  const w = [];
  if (format === 'full-placement') {
    const total = (teams * Math.log2(teams)) / 2;
    if (total >= 32) {
      w.push(`${teams}チームの完全順位決定は全${total}試合になります。コート${courts}面では枠数が多くなるため、開催時間を確認してください。`);
    }
  }
  return w;
}
