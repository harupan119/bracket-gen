import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';
import { buildSpreadsheetPayload } from '../core/payload.js';
import { THEME } from '../core/theme.js';

const make = (o = {}) =>
  buildTournament({ format: 'single-elimination', teams: 8, courts: 2, scoring: 'sets-of-3', ...o });

const cellsOf = (payload, sheetId) =>
  payload.requests.find((r) => r.updateCells?.range.sheetId === sheetId)
    .updateCells.rows.flatMap((r) => r.values)
    .filter((v) => v && Object.keys(v).length);

const hex = (c) =>
  '#' + [c.red, c.green, c.blue].map((x) => Math.round((x ?? 0) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

test('全セルが実物と同じフォントを指定する', () => {
  // 指定が無いと環境依存の既定フォントになり、実物のゴシック体と揃わない。
  for (const format of ['single-elimination', 'double-elimination', 'full-placement']) {
    const p = buildSpreadsheetPayload(make({ format, teams: 8 }));
    for (const sheetId of [0, 1, 2]) {
      for (const c of cellsOf(p, sheetId)) {
        assert.equal(c.userEnteredFormat.textFormat.fontFamily, THEME.font, `${format} sheet${sheetId}`);
      }
    }
  }
});

test('表ヘッダが紺地に白の太字になる', () => {
  const p = buildSpreadsheetPayload(make());
  const headers = cellsOf(p, 0).filter(
    (c) => hex(c.userEnteredFormat.backgroundColor ?? {}) === THEME.colors.headerFill
  );
  assert.ok(headers.length > 0, 'ヘッダ帯が無い');
  for (const c of headers) {
    assert.equal(c.userEnteredFormat.textFormat.bold, true);
    assert.equal(hex(c.userEnteredFormat.textFormat.foregroundColor), THEME.colors.headerText);
    assert.equal(c.userEnteredFormat.textFormat.fontSize, THEME.sizes.header);
  }
});

test('セクション見出しが淡青地に紺文字になる', () => {
  const p = buildSpreadsheetPayload(make());
  const sections = cellsOf(p, 0).filter(
    (c) => hex(c.userEnteredFormat.backgroundColor ?? {}) === THEME.colors.sectionFill
  );
  assert.ok(sections.length > 0, 'セクション見出しが無い');
  for (const c of sections) {
    assert.equal(hex(c.userEnteredFormat.textFormat.foregroundColor), THEME.colors.accent);
  }
});

test('枠のあるセルは四辺すべてに細いグレー罫線が付く', () => {
  // 実物は全内容セルが格子で囲われている。これが無いと「素朴」に見える。
  const p = buildSpreadsheetPayload(make());
  const boxed = cellsOf(p, 0).filter((c) => c.userEnteredFormat.borders);
  assert.ok(boxed.length > 10, `枠付きセルが少なすぎる: ${boxed.length}`);
  for (const c of boxed) {
    const b = c.userEnteredFormat.borders;
    for (const side of ['top', 'bottom', 'left', 'right']) {
      assert.equal(b[side].style, 'SOLID', side);
      assert.equal(hex(b[side].color), THEME.colors.grid, side);
    }
  }
});

test('入力欄が黄色地・太字・TEXT書式になる', () => {
  const t = make();
  const p = buildSpreadsheetPayload(t);
  const inputs = cellsOf(p, 2).filter((c) => c.userEnteredFormat.numberFormat);
  assert.equal(inputs.length, t.matches.length);
  for (const c of inputs) {
    assert.equal(hex(c.userEnteredFormat.backgroundColor), THEME.colors.inputFill);
    assert.equal(c.userEnteredFormat.textFormat.bold, true);
    assert.deepEqual(c.userEnteredFormat.numberFormat, { type: 'TEXT' });
  }
});

test('列幅が実物の実測値と一致する', () => {
  // 試合番号7 / チーム名20 / 連結線5 / 説明26
  const p = buildSpreadsheetPayload(make());
  const widths = new Map();
  for (const r of p.requests) {
    const d = r.updateDimensionProperties;
    if (!d || d.range.sheetId !== 0 || d.properties.pixelSize == null) continue;
    widths.set(d.range.startIndex + 1, Math.round(d.properties.pixelSize / 7.5));
  }
  assert.equal(widths.get(1), 7, '試合番号');
  assert.equal(widths.get(2), 20, 'チーム名');
  assert.equal(widths.get(3), 5, '連結線');
  assert.equal(widths.get(6), 26, '説明');
});

test('スマホ用は見出し行が固定される', () => {
  const p = buildSpreadsheetPayload(make());
  const frozen = p.requests.find(
    (r) => r.updateSheetProperties?.properties.sheetId === 2
  );
  assert.ok(frozen, '固定行の指定が無い');
  assert.equal(frozen.updateSheetProperties.properties.gridProperties.frozenRowCount, 4);
});
