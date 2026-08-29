import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';
import { buildSpreadsheetPayload } from '../core/payload.js';

const make = (o = {}) =>
  buildTournament({ format: 'full-placement', teams: 8, courts: 2, scoring: 'sets-of-3', ...o });
const rules = (t) =>
  buildSpreadsheetPayload(t).requests.filter((r) => r.addConditionalFormatRule)
    .map((r) => r.addConditionalFormatRule.rule);

test('チーム数に応じて条件付き書式が増える', () => {
  const counts = [4, 8, 16].map((teams) => rules(make({ teams })).length);
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], `単調増加でない: ${counts}`);
  assert.equal(counts[1], 38, '8チームは38ルール（うち8本が勝ち上がり経路）');
});

test('全ルールが実在シートIDの範囲を指す', () => {
  for (const teams of [4, 8, 16]) {
    for (const r of rules(make({ teams }))) {
      for (const g of r.ranges) {
        assert.ok([0, 1, 2].includes(g.sheetId), `${teams}チーム: 未知のsheetId ${g.sheetId}`);
        assert.ok(g.endRowIndex > g.startRowIndex, `${teams}チーム: 空の行範囲`);
        assert.ok(g.endColumnIndex > g.startColumnIndex, `${teams}チーム: 空の列範囲`);
      }
    }
  }
});

test('CUSTOM_FORMULA は他シートを参照せず、同一シートの補助列を見る', () => {
  // Google Sheets は条件付き書式の数式に他シート参照を許さない（APIが 400 で拒否する）。
  // INDIRECT で回避もできるが、再計算が遅れて色が残る既知の問題があるため使わない。
  for (const teams of [4, 8, 16]) {
    for (const r of rules(make({ teams }))) {
      const c = r.booleanRule.condition;
      if (c.type !== 'CUSTOM_FORMULA') continue;
      const f = c.values[0].userEnteredValue;
      assert.match(f, /^=/, f);
      assert.doesNotMatch(f, /!/, `他シート参照が混ざっている: ${f}`);
      assert.doesNotMatch(f, /INDIRECT/i, `INDIRECT は使わない: ${f}`);
      assert.match(f, /\$[HI]\$\d+/, `補助列を参照していない: ${f}`);
    }
  }
});

test('勝者の着色は赤背景＋白太字、結果済みは緑背景', () => {
  const rs = rules(make());
  const red = rs.filter((r) => r.booleanRule.format.textFormat?.bold);
  const green = rs.filter((r) => !r.booleanRule.format.textFormat);
  assert.ok(red.length > 0 && green.length > 0);
  for (const r of red) {
    assert.deepEqual(r.booleanRule.format.textFormat.foregroundColor, { red: 1, green: 1, blue: 1 });
    assert.ok(r.booleanRule.format.backgroundColor.red > 0.8, '赤背景');
  }
  for (const r of green) {
    assert.ok(r.booleanRule.format.backgroundColor.green > 0.8, '緑背景');
  }
});

test('スマホ用の結果列と勝者列に範囲ルールが1本ずつ付く', () => {
  const t = make();
  const mobile = rules(t).filter((r) => r.ranges[0].sheetId === 2);
  assert.equal(mobile.length, 2);
  const cols = mobile.map((r) => r.ranges[0].startColumnIndex).sort();
  assert.deepEqual(cols, [2, 3], '結果列(C)と勝者列(D)');
  for (const r of mobile) {
    assert.equal(r.ranges[0].endRowIndex - r.ranges[0].startRowIndex, t.matches.length);
  }
});

test('勝ち上がり経路が連結列に引かれる', () => {
  // 条件付き書式は罫線に触れないので、枝線そのものは色を変えられない。
  // 代わりに連結列（幅の狭い空セル）を勝者の色で塗り、マーカーでなぞったように見せる。
  for (const format of ['single-elimination', 'double-elimination', 'full-placement']) {
    const t = buildTournament({ format, teams: 8, courts: 2, scoring: 'win-loss' });
    const rs = rules(t);
    // 経路は連結列（奇数列）にかかる、複数行にまたがる範囲
    const paths = rs.filter((r) => {
      const g = r.ranges[0];
      return g.sheetId === 0 && g.endColumnIndex - g.startColumnIndex === 1 && (g.startColumnIndex + 1) % 2 === 1;
    });
    assert.ok(paths.length > 0, `${format}: 経路のルールが無い`);
    for (const r of paths) {
      const g = r.ranges[0];
      assert.equal(g.endColumnIndex - g.startColumnIndex, 1, '経路は1列ぶん');
      assert.equal(r.booleanRule.condition.type, 'CUSTOM_FORMULA');
      assert.doesNotMatch(r.booleanRule.condition.values[0].userEnteredValue, /!/, '他シート参照は使えない');
    }
  }
});

test('経路の本数がブラケットのスロット数と釣り合う', async () => {
  const { layoutBracketSheet } = await import('../core/layout.js');
  // 8チームなら 1回戦8 + 準決勝4 + 決勝2 = 14本
  const cases = [
    ['single-elimination', 8, 14],
    ['full-placement', 8, 8],
    ['double-elimination', 10, 19],
  ];
  for (const [format, teams, expected] of cases) {
    const g = layoutBracketSheet(buildTournament({ format, teams, courts: 2, scoring: 'win-loss' }));
    assert.equal(g.paths.length, expected, `${format} ${teams}チーム`);
    for (const p of g.paths) {
      // 敗者側の大ラウンドは親と子が同じ行なので、経路は1セル（横方向の区間）になる
      assert.ok(p.r2 >= p.r1, `経路の範囲が逆転: ${p.r1}-${p.r2}`);
      assert.ok(p.col % 2 === 1, '経路は連結列（奇数列）に引く');
    }
  }
});
