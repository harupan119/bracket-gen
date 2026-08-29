import { layoutBracketSheet, helperCols } from './layout.js';
import { layoutProgressSheet, layoutMobileSheet, layoutControlSheet, TABS } from './sheets.js';
import { COLORS, toRgb } from './palette.js';
import { THEME, ROLES } from './theme.js';
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
    requests.push(commonFormatRequest(sheetId, grid));
    requests.push(...boxBorderRequests(sheetId, grid));
    for (const [col, width] of grid.columns) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: col - 1, endIndex: col },
          properties: { pixelSize: Math.round(width * 7.5) },
          fields: 'pixelSize',
        },
      });
    }
    if (grid.frozenRows) {
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: grid.frozenRows } },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }
    for (const b of grid.borders) {
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: b.r1 - 1, endRowIndex: b.r2,
            startColumnIndex: b.c1 - 1, endColumnIndex: b.c2,
          },
          [b.side]: { style: 'SOLID', color: toRgb(COLORS.line) },
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
  const hc = helperCols(tournament);
  for (const col of [hc.winner, hc.loser]) {
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
  const fmt = {};

  const v = cell.value;
  const value =
    v !== '' && v != null
      ? String(v).startsWith('=')
        ? { formulaValue: String(v) }
        : { stringValue: String(v) }
      : null;

  // 役割から書式を決める。個別指定（bold/size）は役割より優先する。
  const role = ROLES[style.role] ?? null;
  // fontFamily と verticalAlignment は全セル共通なので、後段の repeatCell でまとめて当てる。
  // 1セルずつ持たせるとペイロードが数倍に膨らみ、Apps Script の実行時間を無駄に食う。
  const text = {};
  if (role) {
    if (role.bold) text.bold = true;
    if (role.size) text.fontSize = THEME.sizes[role.size];
    if (role.color) text.foregroundColor = toRgb(THEME.colors[role.color]);
    if (role.fill) fmt.backgroundColor = toRgb(THEME.colors[role.fill]);
    if (role.align) fmt.horizontalAlignment = role.align;
  }
  if (style.bold) text.bold = true;
  if (style.size) text.fontSize = style.size;
  if (Object.keys(text).length) fmt.textFormat = text;

  if (style.input) {
    fmt.backgroundColor = toRgb(THEME.colors.inputFill);
    // 必須。TEXT にしないと "2-1" や "1-2" が日付として解釈され（46054 等のシリアル値になる）、
    // 勝敗判定の文字列比較が黙って外れる。3-0 / 0-3 は不正な日付なので文字列のまま残り、
    // 症状がまだらに出るため気づきにくい。
    fmt.numberFormat = { type: 'TEXT' };
  }

  const out = { userEnteredFormat: fmt };
  if (value) out.userEnteredValue = value;
  return out;
}

/** 全セルに共通する書式を1リクエストで当てる。updateCells の後に、絞ったfieldsで重ねる。 */
function commonFormatRequest(sheetId, grid) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: grid.maxRow, startColumnIndex: 0, endColumnIndex: grid.maxCol },
      cell: { userEnteredFormat: { textFormat: { fontFamily: THEME.font }, verticalAlignment: 'MIDDLE' } },
      fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.verticalAlignment',
    },
  };
}

/**
 * 格子の罫線を、行方向に連続する範囲ごとにまとめて発行する。
 * 1セルずつ borders を持たせると、表1行で6個の罫線オブジェクトが並んでペイロードが膨れる。
 */
function boxBorderRequests(sheetId, grid) {
  const boxed = new Set();
  for (const c of grid.cells.values()) {
    if (ROLES[c.style?.role]?.box) boxed.add(`${c.row},${c.col}`);
  }
  const line = { style: 'SOLID', color: toRgb(THEME.colors.grid) };
  const out = [];
  const taken = new Set();

  // 罫線は矩形単位でまとめる。表の5行×6列を1リクエストにできると、
  // セル単位で出すより1桁小さくなる（色オブジェクトの繰り返しが効くため）。
  const key = (r, c) => `${r},${c}`;
  const cells = [...boxed].map((k) => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [r0, c0] of cells) {
    if (taken.has(key(r0, c0))) continue;
    // 右へ伸ばす
    let c1 = c0;
    while (boxed.has(key(r0, c1 + 1)) && !taken.has(key(r0, c1 + 1))) c1 += 1;
    // 同じ幅で下へ伸ばす
    let r1 = r0;
    for (;;) {
      const nr = r1 + 1;
      let ok = true;
      for (let c = c0; c <= c1; c++) {
        if (!boxed.has(key(nr, c)) || taken.has(key(nr, c))) { ok = false; break; }
      }
      if (!ok) break;
      r1 = nr;
    }
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) taken.add(key(r, c));
    out.push({
      updateBorders: {
        range: { sheetId, startRowIndex: r0 - 1, endRowIndex: r1, startColumnIndex: c0 - 1, endColumnIndex: c1 },
        top: line, bottom: line, left: line, right: line,
        innerVertical: line, innerHorizontal: line,
      },
    });
  }
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
