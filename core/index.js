import { buildFullPlacement } from './formats/full-placement.js';
import { buildDoubleElimination } from './formats/double-elimination.js';
import { buildSingleElimination } from './formats/single-elimination.js';
import { buildGroupStage } from './formats/group-stage.js';
import { scheduleMatches, dependencyOnly, avoidBackToBack } from './schedule.js';
import { warningsFor } from './validate.js';
import { getScoring } from './scoring.js';

const BUILDERS = {
  'full-placement': buildFullPlacement,
  'double-elimination': buildDoubleElimination,
  'single-elimination': buildSingleElimination,
  'group-stage': buildGroupStage,
};

export function buildTournament(config) {
  const { format, teams, courts = 1 } = config;
  const build = BUILDERS[format];
  if (!build) {
    throw new Error(`未対応の形式です: ${format}（対応: ${Object.keys(BUILDERS).join(' / ')}）`);
  }
  const scoring = config.scoring ?? 'win-loss';
  getScoring(scoring); // 未対応なら生成の入口で落とす
  const tournament = build({ teams, ...(config.options ?? {}) });
  tournament.title = config.title ?? '';
  tournament.scoring = scoring;
  tournament.courts = courts;
  // 連戦回避は枠数（＝開催の長さ）と引き換えになるので、運営が選べるようにする。
  // 連戦が増えることは無いが、枠が1〜2増えることがある。
  tournament.avoidBackToBack = config.avoidBackToBack ?? true;
  tournament.slots = scheduleMatches(tournament, {
    courts,
    strategy: tournament.avoidBackToBack ? avoidBackToBack : dependencyOnly,
  });
  // 枠数が決まってからでないと開催時間の見積もりが出せない
  tournament.warnings = warningsFor({
    format, teams, courts,
    matches: tournament.matches.length,
    slots: tournament.slots.length,
  });
  return tournament;
}

export {
  buildFullPlacement, buildDoubleElimination, buildSingleElimination, buildGroupStage,
  scheduleMatches, dependencyOnly, avoidBackToBack,
};
