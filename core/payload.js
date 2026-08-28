import { layoutBracketSheet, HELPER_COL } from './layout.js';
import { layoutProgressSheet, layoutMobileSheet, layoutControlSheet, TABS } from './sheets.js';
import { COLORS, toRgb } from './palette.js';
import { buildConditionalFormatRules } from './formatting.js';

/**
 * グリッドを Google Sheets の API リクエストへ変換する。
 *
 * 出力は生のリクエストデータなので、適用経路を選ばない:
 *   - Apps Script  : Sheets.Spreadsheets.batchUpdate（Advanced Sheets Service）
 *   - Node CLI     : googleapis の sheets.spreadsheets.batchUpdate
 *   - 開発時       : MCP 経由
 * 3経路で同じ payload を使えるようにするのが狙い。
 */
export function buildSpreadsheetPayload(tournament) {
  const sheets = [
    { sheetId: 0, title: TABS.bracket, grid: layoutBracketSheet(tournament), hidden: false },
    { sheetId: 1, title: TABS.progress, grid: layoutProgressSheet(tournament), hidden: false },
    { sheetId: 2, title: TABS.mobile, grid: layoutMobileSheet(tournament), hidden: false },
    { sheetId: 3, title: TABS.control, grid: layoutControlSheet(tournament), hidden: true },
  ];

  const create = {
    properties: { title: tournament.title || `トーナメント（${tournament.teams}チーム）` },
    sheets: sheets.map(({ sheetId, title, grid, hidden }) => ({
      properties: {
        sheetId,
        title,
        hidden,
        gridProperties: {
          rowCount: Math.max(grid.maxRow + 5, 20),
          columnCount: Math.max(grid.maxCol + 2, 8),
        },
      },
    })),
  };

  const requests = [];
  for (const { sheetId, grid } of sheets) {
    requests.push(updateCellsRequest(sheetId, grid));
    for (const [col, width] of grid.columns) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: col - 1, endIndex: col },
          properties: { pixelSize: Math.round(width * 7.5) },
          fields: 'pixelSize',
        },
      });
    }
    for (const m of grid.merges) {
      requests.push({
        mergeCells: {
          range: { sheetId, startRowIndex: m.r1 - 1, endRowIndex: m.r2, startColumnIndex: m.c1 - 1, endColumnIndex: m.c2 },
          mergeType: 'MERGE_ALL',
        },
      });
    }
    requests.push(...validationRequests(sheetId, grid));
  }

  // 補助列は運営に見せない
  for (const col of [HELPER_COL.winner, HELPER_COL.loser]) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: 0, dimension: 'COLUMNS', startIndex: col - 1, endIndex: col },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });
  }

  // 条件付き書式はグリッドに付けたタグから起こす
  requests.push(
    ...buildConditionalFormatRules(
      tournament,
      { bracket: sheets[0].grid, progress: sheets[1].grid },
      { bracket: 0, progress: 1, mobile: 2, control: 3 }
    )
  );

  return { create, requests, sheets: sheets.map(({ sheetId, title }) => ({ sheetId, title })) };
}

function updateCellsRequest(sheetId, grid) {
  const rows = [];
  for (let r = 1; r <= grid.maxRow; r++) {
    const values = [];
    for (let c = 1; c <= grid.maxCol; c++) {
      values.push(cellData(grid.cells.get(`${r},${c}`)));
    }
    rows.push({ values });
  }
  return {
    updateCells: {
      range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endRowIndex: grid.maxRow, endColumnIndex: grid.maxCol },
      rows,
      fields: 'userEnteredValue,userEnteredFormat',
    },
  };
}

function cellData(cell) {
  if (!cell) return {};
  const style = cell.style ?? {};
  const out = { userEnteredFormat: {} };

  const v = cell.value;
  if (v !== '' && v != null) {
    out.userEnteredValue = String(v).startsWith('=')
      ? { formulaValue: String(v) }
      : { stringValue: String(v) };
  }
  const textFormat = {};
  if (style.bold) textFormat.bold = true;
  if (style.size) textFormat.fontSize = style.size;
  if (Object.keys(textFormat).length) out.userEnteredFormat.textFormat = textFormat;

  if (style.input) {
    out.userEnteredFormat.backgroundColor = toRgb(COLORS.resultPending);
    // 必須。TEXT にしないと "2-1" や "1-2" が日付として解釈され（46054 等のシリアル値になる）、
    // 勝敗判定の文字列比較が黙って外れる。3-0 / 0-3 は不正な日付なので文字列のまま残り、
    // 症状がまだらに出るため気づきにくい。
    out.userEnteredFormat.numberFormat = { type: 'TEXT' };
  }
  if (!out.userEnteredValue && !Object.keys(out.userEnteredFormat).length) return {};
  return out;
}

function validationRequests(sheetId, grid) {
  const out = [];
  for (const cell of grid.cells.values()) {
    const opts = cell.style?.validation;
    if (!opts) continue;
    out.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: cell.row - 1, endRowIndex: cell.row,
          startColumnIndex: cell.col - 1, endColumnIndex: cell.col,
        },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: opts.map((v) => ({ userEnteredValue: v })) },
          strict: true,
          showCustomUi: true,
        },
      },
    });
  }
  return out;
}
