import { buildFullPlacement } from './formats/full-placement.js';
import { scheduleMatches } from './schedule.js';
import { warningsFor } from './validate.js';

const BUILDERS = {
  'full-placement': buildFullPlacement,
  // single / double は2周目以降
};

export function buildTournament(config) {
  const { format, teams, courts = 1 } = config;
  const build = BUILDERS[format];
  if (!build) {
    throw new Error(`未対応の形式です: ${format}（対応: ${Object.keys(BUILDERS).join(' / ')}）`);
  }
  const tournament = build({ teams });
  tournament.title = config.title ?? '';
  tournament.scoring = config.scoring ?? 'win-loss';
  tournament.courts = courts;
  tournament.slots = scheduleMatches(tournament, { courts });
  tournament.warnings = warningsFor({ format, teams, courts });
  return tournament;
}

export { buildFullPlacement, scheduleMatches };
