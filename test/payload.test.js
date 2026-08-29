import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';
import { buildSpreadsheetPayload } from '../core/payload.js';
import { getScoring } from '../core/scoring.js';
import { TABS } from '../core/sheets.js';

const make = (o = {}) =>
  buildTournament({ format: 'full-placement', teams: 8, courts: 2, title: 'T', scoring: 'sets-of-3', ...o });

test('4タブが作られ、試合管理だけが非表示になる', () => {
  const p = buildSpreadsheetPayload(make());
  assert.deepEqual(
    p.create.sheets.map((s) => s.properties.title),
    [TABS.bracket, TABS.progress, TABS.mobile, TABS.control]
  );
  assert.deepEqual(p.create.sheets.map((s) => s.properties.hidden), [false, false, false, true]);
});

test('全リクエストが実在するシートIDを指す', () => {
  for (const teams of [4, 8, 16]) {
    const p = buildSpreadsheetPayload(make({ teams }));
    const ids = new Set(p.create.sheets.map((s) => s.properties.sheetId));
    for (const r of p.requests) {
      const body = r[Object.keys(r)[0]];
      // リクエストによって sheetId の置き場所が違う:
      //   range を1つ持つ形 / rule.ranges を複数持つ形（条件付き書式） / properties に持つ形（シート属性）
      const targets = body.range
        ? [body.range]
        : body.rule?.ranges ?? (body.properties?.sheetId != null ? [body.properties] : []);
      assert.ok(targets.length > 0, `${teams}チーム: 範囲を持たないリクエスト ${Object.keys(r)[0]}`);
      for (const g of targets) {
        assert.ok(ids.has(g.sheetId), `${teams}チーム: 未知のsheetId ${g.sheetId}`);
      }
    }
  }
});

test('書き込み範囲がシートの行数・列数に収まる', () => {
  for (const teams of [4, 8, 16]) {
    const p = buildSpreadsheetPayload(make({ teams }));
    const dims = new Map(p.create.sheets.map((s) => [s.properties.sheetId, s.properties.gridProperties]));
    for (const r of p.requests) {
      const body = r[Object.keys(r)[0]];
      const targets = body.range
        ? [body.range]
        : body.rule?.ranges ?? (body.properties?.sheetId != null ? [body.properties] : []);
      for (const g of targets) {
        const d = dims.get(g.sheetId);
        if (g.endRowIndex != null) assert.ok(g.endRowIndex <= d.rowCount, `${teams}チーム: 行あふれ`);
        if (g.endColumnIndex != null) assert.ok(g.endColumnIndex <= d.columnCount, `${teams}チーム: 列あふれ`);
      }
    }
  }
});

test('数式は formulaValue、文字列は stringValue で出る', () => {
  const p = buildSpreadsheetPayload(make());
  const control = p.requests.find((r) => r.updateCells?.range.sheetId === 3).updateCells;
  const b2 = control.rows[1].values[1];
  assert.ok(b2.userEnteredValue.formulaValue.startsWith('=IF('), '数式');
  const a2 = control.rows[1].values[0];
  assert.equal(a2.userEnteredValue.stringValue, '①', '文字列');
  // updateCells は値だけを運ぶ（書式は repeatCell でまとめて当てる）
  assert.equal(control.fields, 'userEnteredValue');
  const empty = control.rows[0].values[7];
  assert.deepEqual(empty ?? {}, {});
});

test('入力規則が全試合ぶん出て、選択肢がプリセットと一致する', () => {
  for (const name of ['win-loss', 'sets-of-3', 'sets-of-5']) {
    const t = make({ scoring: name });
    const p = buildSpreadsheetPayload(t);
    const vs = p.requests.filter((r) => r.setDataValidation);
    assert.equal(vs.length, t.matches.length, name);
    for (const v of vs) {
      assert.equal(v.setDataValidation.range.sheetId, 2, `${name}: 入力規則はスマホ用タブに置く`);
      assert.deepEqual(
        v.setDataValidation.rule.condition.values.map((x) => x.userEnteredValue),
        getScoring(name).options, name
      );
      assert.equal(v.setDataValidation.rule.strict, true, name);
    }
  }
});

test('入力欄は進行表のチーム名記入欄とスマホ用の結果欄だけ', () => {
  const t = make();
  const p = buildSpreadsheetPayload(t);
  const byTab = new Map();
  for (const r of p.requests) {
    if (!r.repeatCell?.cell.userEnteredFormat.numberFormat) continue;
    const g = r.repeatCell.range;
    const n = (g.endRowIndex - g.startRowIndex) * (g.endColumnIndex - g.startColumnIndex);
    byTab.set(g.sheetId, (byTab.get(g.sheetId) ?? 0) + n);
  }
  assert.deepEqual([...byTab.keys()].sort(), [1, 2], '進行表(1)とスマホ用(2)だけ');
  assert.equal(byTab.get(1), t.teams, '進行表のチーム名記入欄');
  assert.equal(byTab.get(2), t.matches.length, 'スマホ用の結果欄');
});

test('16チーム4コートでも payload が壊れずに出る', () => {
  const p = buildSpreadsheetPayload(make({ teams: 16, courts: 4 }));
  assert.equal(p.requests.filter((r) => r.updateCells).length, 4);
  assert.equal(p.requests.filter((r) => r.setDataValidation).length, 32);
});

test('入力欄に TEXT 書式が付く（"2-1" が日付に化けるのを防ぐ）', () => {
  for (const name of ['win-loss', 'sets-of-3', 'sets-of-5']) {
    const t = make({ scoring: name });
    const p = buildSpreadsheetPayload(t);
    const reqs = p.requests.filter((r) => r.repeatCell?.cell.userEnteredFormat.numberFormat);
    let covered = 0;
    for (const r of reqs) {
      assert.deepEqual(r.repeatCell.cell.userEnteredFormat.numberFormat, { type: 'TEXT' }, name);
      const g = r.repeatCell.range;
      covered += (g.endRowIndex - g.startRowIndex) * (g.endColumnIndex - g.startColumnIndex);
    }
    // 結果欄に加えて、進行表のチーム名記入欄も入力欄
    assert.equal(covered, t.matches.length + t.teams, name);
  }
});

test('日付に化けうる選択肢を持つプリセットを検出できる', () => {
  // Sheets が日付として解釈しうる形 "M-D" を含むプリセットは TEXT 書式が必須になる
  const risky = (o) => /^\d{1,2}-\d{1,2}$/.test(o) && Number(o.split('-')[0]) >= 1 && Number(o.split('-')[0]) <= 12 && Number(o.split('-')[1]) >= 1;
  assert.ok(getScoring('sets-of-3').options.some(risky), 'sets-of-3 は危険な選択肢を含む');
  assert.ok(getScoring('sets-of-5').options.some(risky), 'sets-of-5 は危険な選択肢を含む');
  assert.ok(!getScoring('win-loss').options.some(risky), 'win-loss は含まない');
});
