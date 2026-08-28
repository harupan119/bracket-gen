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
      // range を1つ持つ形と、rule.ranges を複数持つ形（条件付き書式）の両方がある
      const targets = body.range ? [body.range] : (body.rule?.ranges ?? []);
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
      const targets = body.range ? [body.range] : (body.rule?.ranges ?? []);
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
  // 空セルに値を持たせない
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

test('入力セルに未入力色が付く', () => {
  const p = buildSpreadsheetPayload(make());
  const mobile = p.requests.find((r) => r.updateCells?.range.sheetId === 2).updateCells;
  const colored = mobile.rows.flatMap((r) => r.values).filter((v) => v?.userEnteredFormat?.backgroundColor);
  assert.equal(colored.length, make().matches.length);
});

test('16チーム4コートでも payload が壊れずに出る', () => {
  const p = buildSpreadsheetPayload(make({ teams: 16, courts: 4 }));
  assert.equal(p.requests.filter((r) => r.updateCells).length, 4);
  assert.equal(p.requests.filter((r) => r.setDataValidation).length, 32);
});

test('入力セルに TEXT 書式が付く（"2-1" が日付に化けるのを防ぐ）', () => {
  for (const name of ['win-loss', 'sets-of-3', 'sets-of-5']) {
    const t = make({ scoring: name });
    const p = buildSpreadsheetPayload(t);
    const mobile = p.requests.find((r) => r.updateCells?.range.sheetId === 2).updateCells;
    const inputs = mobile.rows.flatMap((r) => r.values)
      .filter((v) => v?.userEnteredFormat?.backgroundColor);
    assert.equal(inputs.length, t.matches.length, name);
    for (const c of inputs) {
      assert.deepEqual(c.userEnteredFormat.numberFormat, { type: 'TEXT' }, name);
    }
  }
});

test('日付に化けうる選択肢を持つプリセットを検出できる', () => {
  // Sheets が日付として解釈しうる形 "M-D" を含むプリセットは TEXT 書式が必須になる
  const risky = (o) => /^\d{1,2}-\d{1,2}$/.test(o) && Number(o.split('-')[0]) >= 1 && Number(o.split('-')[0]) <= 12 && Number(o.split('-')[1]) >= 1;
  assert.ok(getScoring('sets-of-3').options.some(risky), 'sets-of-3 は危険な選択肢を含む');
  assert.ok(getScoring('sets-of-5').options.some(risky), 'sets-of-5 は危険な選択肢を含む');
  assert.ok(!getScoring('win-loss').options.some(risky), 'win-loss は含まない');
});
