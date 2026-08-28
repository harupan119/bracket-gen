import { buildFullPlacement } from './formats/full-placement.js';
import { buildDoubleElimination } from './formats/double-elimination.js';
import { scheduleMatches } from './schedule.js';
import { warningsFor } from './validate.js';
import { getScoring } from './scoring.js';

const BUILDERS = {
  'full-placement': buildFullPlacement,
  'double-elimination': buildDoubleElimination,
  // single は3周目
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
  tournament.slots = scheduleMatches(tournament, { courts });
  tournament.warnings = warningsFor({ format, teams, courts });
  return tournament;
}

export { buildFullPlacement, buildDoubleElimination, scheduleMatches };
