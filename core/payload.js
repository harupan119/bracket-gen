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
          hideGridlines: true,
        },
      },
    })),
  };

  const requests = [];
  for (const { sheetId, grid } of sheets) {
    requests.push(updateCellsRequest(sheetId, grid));
    requests.push(commonFormatRequest(sheetId, grid));
    requests.push(...roleFormatRequests(sheetId, grid));
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
    // 既定の格子は自前で引く罫線と二重に見えるので消す。テンプレ側だけで消しても、
    // そこから作られていないシートでは再発するため、生成のたびに指定する。
    const gridProps = { hideGridlines: true };
    const gridFields = ['gridProperties.hideGridlines'];
    if (grid.frozenRows) {
      gridProps.frozenRowCount = grid.frozenRows;
      gridFields.push('gridProperties.frozenRowCount');
    }
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: gridProps },
        fields: gridFields.join(','),
      },
    });
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
      { bracket: sheets[0].grid, progress: sheets[1].grid, mobile: sheets[2].grid },
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
      fields: 'userEnteredValue',
    },
  };
}

function cellData(cell) {
  if (!cell) return {};
  const v = cell.value;
  if (v === '' || v == null) return {};
  return {
    userEnteredValue: String(v).startsWith('=')
      ? { formulaValue: String(v) }
      : { stringValue: String(v) },
  };
}

function unusedCellFormat(cell) {
  const style = cell.style ?? {};
  const fmt = {};

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

/**
 * 役割ごとの書式を、同じ役割が並ぶ矩形単位で当てる。
 * セル1つずつ userEnteredFormat を持たせると、地色や文字色のオブジェクトが
 * 何百回も繰り返されてペイロードが膨れる。表は矩形になるのでよくまとまる。
 */
function roleFormatRequests(sheetId, grid) {
  const byRole = new Map();
  for (const c of grid.cells.values()) {
    const r = c.style?.role;
    if (!r || !ROLES[r]) continue;
    if (!byRole.has(r)) byRole.set(r, new Set());
    byRole.get(r).add(`${c.row},${c.col}`);
  }
  const out = [];
  for (const [roleName, cells] of byRole) {
    const role = ROLES[roleName];
    const fmt = {};
    const text = {};
    if (role.bold) text.bold = true;
    if (role.size) text.fontSize = THEME.sizes[role.size];
    if (role.color) text.foregroundColor = toRgb(THEME.colors[role.color]);
    if (Object.keys(text).length) fmt.textFormat = text;
    fmt.backgroundColor = toRgb(THEME.colors[role.fill ?? 'white']);
    fmt.horizontalAlignment = role.align ?? 'LEFT';
    if (role.text) fmt.numberFormat = { type: 'TEXT' };
    if (role.wrap) fmt.wrapStrategy = 'WRAP';
    const fields = [
      'userEnteredFormat.backgroundColor',
      'userEnteredFormat.horizontalAlignment',
      'userEnteredFormat.textFormat.bold',
      'userEnteredFormat.textFormat.fontSize',
      'userEnteredFormat.textFormat.foregroundColor',
      ...(role.text ? ['userEnteredFormat.numberFormat'] : []),
      ...(role.wrap ? ['userEnteredFormat.wrapStrategy'] : []),
    ].join(',');
    for (const box of rectangles(cells)) {
      out.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: box.r0 - 1, endRowIndex: box.r1,
            startColumnIndex: box.c0 - 1, endColumnIndex: box.c1,
          },
          cell: { userEnteredFormat: fmt },
          fields,
        },
      });
    }
  }
  return out;
}

/** セル集合を、なるべく大きな矩形に分割する。罫線と役割書式で共用する。 */
function rectangles(cells) {
  const has = (r, c) => cells.has(`${r},${c}`);
  const taken = new Set();
  const out = [];
  const sorted = [...cells].map((k) => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [r0, c0] of sorted) {
    if (taken.has(`${r0},${c0}`)) continue;
    let c1 = c0;
    while (has(r0, c1 + 1) && !taken.has(`${r0},${c1 + 1}`)) c1 += 1;
    let r1 = r0;
    for (;;) {
      const nr = r1 + 1;
      let ok = true;
      for (let c = c0; c <= c1; c++) {
        if (!has(nr, c) || taken.has(`${nr},${c}`)) { ok = false; break; }
      }
      if (!ok) break;
      r1 = nr;
    }
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) taken.add(`${r},${c}`);
    out.push({ r0, c0, r1, c1 });
  }
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
  return rectangles(boxed).map((b) => ({
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: b.r0 - 1, endRowIndex: b.r1,
        startColumnIndex: b.c0 - 1, endColumnIndex: b.c1,
      },
      top: line, bottom: line, left: line, right: line,
      // 内側罫線は範囲が2セル以上あるときだけ意味がある
      ...(b.c1 > b.c0 ? { innerVertical: line } : {}),
      ...(b.r1 > b.r0 ? { innerHorizontal: line } : {}),
    },
  }));
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
