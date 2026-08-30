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

/**
 * 生成後に出す警告。エラーではないが、当日の運営に効く事実。
 *
 * 枠数は開催の長さに直結する。枠は「同時に進む試合のまとまり」なので、
 * 1試合の所要時間 × 枠数 が実質の開催時間になる（コート数を増やしても枠は減るが、
 * 減り方は依存関係で頭打ちになる）。
 */
export function warningsFor({ format, teams, courts, matches, slots }) {
  const w = [];

  if (format === 'full-placement' && matches >= 32) {
    w.push(
      `${teams}チームの完全順位決定は全${matches}試合になります。` +
        `全員が同じ試合数を戦う形式なので、試合数はチーム数に対して急に増えます。`
    );
  }

  if (slots >= 12) {
    // 1試合20分・転換5分をざっくりの目安にする
    const hours = Math.round((slots * 25) / 60 * 10) / 10;
    w.push(
      `全${slots}枠になります。1試合20分＋転換5分なら約${hours}時間かかる見込みです。` +
        `半日で終わらせたい場合はコート数を増やすか、チーム数か形式を見直してください。`
    );
  }

  if (courts >= teams / 2) {
    w.push(
      `コート${courts}面はチーム数（${teams}）に対して多いため、全チームが同時に動きます。` +
        `連戦を避けにくくなります。`
    );
  }

  return w;
}
