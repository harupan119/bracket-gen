// Apps Script 用バンドルの入口。ここに出したものが `BracketGen.*` として使える。
export { buildTournament } from './index.js';
export { countBackToBack } from './schedule.js';
export { buildSpreadsheetPayload } from './payload.js';
export { SCORING, getScoring } from './scoring.js';
export { MIN_TEAMS, MAX_TEAMS, FULL_PLACEMENT_SIZES, warningsFor } from './validate.js';
export { TABS } from './sheets.js';
