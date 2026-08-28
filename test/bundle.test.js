import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundlePath = path.join(root, 'apps-script', 'core.bundle.gs');

/**
 * Apps Script の V8 ランタイムはモジュールを解釈せず、.gs を素のグローバルスコープで
 * 連結して実行する。ここでは同じ条件（bare な vm コンテキスト）で読み込み、
 * バンドルが実際に動くことを確かめる。
 */
function loadBundle() {
  const src = fs.readFileSync(bundlePath, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, src };
}

// vm コンテキストの値は別realmなので prototype が一致せず deepEqual が通らない。
// 比較する前にこちら側の値へ写す。
const local = (v) => JSON.parse(JSON.stringify(v));

test('バンドルに import / export が残っていない', () => {
  const { src } = loadBundle();
  const leftovers = src.split('\n').filter((l) => /^\s*(import|export)\s/.test(l));
  assert.deepEqual(leftovers, [], 'Apps Script はモジュール構文を解釈しない');
});

test('素のグローバルスコープで BracketGen が定義される', () => {
  const { ctx } = loadBundle();
  assert.equal(typeof ctx.BracketGen, 'object');
  for (const name of ['buildTournament', 'buildSpreadsheetPayload', 'getScoring', 'warningsFor']) {
    assert.equal(typeof ctx.BracketGen[name], 'function', name);
  }
  assert.deepEqual(local(ctx.BracketGen.FULL_PLACEMENT_SIZES), [4, 8, 16]);
});

test('バンドル経由でも3形式が同じ試合数を出す', async () => {
  const { ctx } = loadBundle();
  const { buildTournament } = await import('../core/index.js');
  const cases = [
    { format: 'full-placement', teams: 8, courts: 2 },
    { format: 'double-elimination', teams: 10, courts: 4 },
    { format: 'single-elimination', teams: 16, courts: 2 },
  ];
  for (const c of cases) {
    const viaBundle = ctx.BracketGen.buildTournament({ ...c, scoring: 'sets-of-3' });
    const viaSource = buildTournament({ ...c, scoring: 'sets-of-3' });
    assert.equal(viaBundle.matches.length, viaSource.matches.length, c.format);
    assert.deepEqual(
      local(viaBundle.matches.map((m) => m.label)),
      viaSource.matches.map((m) => m.label),
      `${c.format}: 試合ラベル`
    );
  }
});

test('バンドル経由でもバリデーションが効く', () => {
  const { ctx } = loadBundle();
  assert.throws(
    () => ctx.BracketGen.buildTournament({ format: 'full-placement', teams: 10 }),
    /完全順位決定トーナメントは 4 \/ 8 \/ 16 チームでのみ成立します/
  );
});

test('バンドルが core/ の変更に追随している（陳腐化していない）', async () => {
  const { ctx } = loadBundle();
  const { SCORING } = await import('../core/scoring.js');
  assert.deepEqual([...Object.keys(ctx.BracketGen.SCORING)].sort(), Object.keys(SCORING).sort(),
    'core/scoring.js を変えたら npm run build でバンドルを作り直す');
  const { TABS } = await import('../core/sheets.js');
  assert.deepEqual(local(ctx.BracketGen.TABS), TABS);
});
