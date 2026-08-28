import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asDir = path.join(root, 'apps-script');
const read = (f) => fs.readFileSync(path.join(asDir, f), 'utf8');

test('.gs とダイアログのスクリプトが構文として通る', () => {
  for (const f of ['main.gs', 'probe.gs']) {
    assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
  }
  const inline = read('dialog.html').match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, 'dialog.html に <script> が無い');
  assert.doesNotThrow(() => new vm.Script('var google={};' + inline[1], { filename: 'dialog.html' }));
});

test('マニフェストが Advanced Sheets Service を宣言している', () => {
  // ここが欠けるとコピー先で Sheets.Spreadsheets.batchUpdate が動かず、
  // 条件付き書式の一括生成が丸ごと失敗する。
  const m = JSON.parse(read('appsscript.json'));
  const svc = m.dependencies.enabledAdvancedServices;
  assert.ok(Array.isArray(svc) && svc.length > 0);
  assert.deepEqual(svc[0], { userSymbol: 'Sheets', serviceId: 'sheets', version: 'v4' });
  assert.equal(m.runtimeVersion, 'V8');
});

test('main.gs が参照する BracketGen の要素がバンドルに実在する', () => {
  // ここが乖離すると、ブラウザで実行するまで気づけない。
  const src = read('main.gs');
  const used = new Set([...src.matchAll(/BracketGen\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  assert.ok(used.size > 0, '参照が検出できていない');

  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(read('core.bundle.gs'), ctx);
  for (const name of used) {
    assert.ok(name in ctx.BracketGen, `BracketGen.${name} がバンドルに無い`);
  }
});

test('remapSheetIds が入れ子の sheetId をすべて差し替える', () => {
  const ctx = { Object, Array, JSON };
  vm.createContext(ctx);
  vm.runInContext(read('main.gs'), ctx);
  const input = {
    requests: [
      { updateCells: { range: { sheetId: 0, startRowIndex: 0 } } },
      { addConditionalFormatRule: { rule: { ranges: [{ sheetId: 2 }, { sheetId: 3 }] } } },
      { other: { nested: { deep: { sheetId: 1 } } } },
    ],
  };
  const out = ctx.remapSheetIds(input, { 0: 100, 1: 101, 2: 102, 3: 103 });
  assert.equal(out.requests[0].updateCells.range.sheetId, 100);
  assert.deepEqual(out.requests[1].addConditionalFormatRule.rule.ranges.map((r) => r.sheetId), [102, 103]);
  assert.equal(out.requests[2].other.nested.deep.sheetId, 101);
  // 元は壊さない
  assert.equal(input.requests[0].updateCells.range.sheetId, 0);
  // 対応表に無い値はそのまま
  assert.equal(ctx.remapSheetIds({ sheetId: 999 }, { 0: 1 }).sheetId, 999);
});

test('ダイアログが送る options のキーが core の受け口と一致する', () => {
  // README のスネークケース表記と実装のキャメルケースが食い違っていた事故がある。
  const html = read('dialog.html');
  const found = [...html.matchAll(/options:\s*\{([\s\S]*?)\}/g)];
  assert.equal(found.length, 1, 'options ブロックが1つ見つかるはず');
  const keys = found[0][1];
  for (const k of ['thirdPlace', 'bracketReset']) {
    assert.ok(keys.includes(k), `dialog.html の options に ${k} が無い`);
  }
});
