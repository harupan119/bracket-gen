import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullPlacement } from '../core/index.js';
import { layoutBracketSheet, bracketCell, terminalGroups } from '../core/layout.js';
import { Grid, a1 } from '../core/grid.js';

test('座標式が実物の B13/B15/B17/B19 → D14/D18 → F16 (base=12) を再現する', () => {
  const base = 12;
  const at = (round, i) => {
    const { row, col } = bracketCell(base, round, i);
    return a1(row, col);
  };
  assert.deepEqual([0, 1, 2, 3].map((i) => at(0, i)), ['B13', 'B15', 'B17', 'B19']);
  assert.deepEqual([0, 1].map((i) => at(1, i)), ['D14', 'D18']);
  assert.equal(at(2, 0), 'F16');
});

test('Grid が二重書き込みを検出する', () => {
  const g = new Grid('t');
  g.set(1, 1, 'a');
  assert.throws(() => g.set(1, 1, 'b'), /二重書き込み/);
});

test('Grid が結合範囲の重なりを検出する', () => {
  const g = new Grid('t');
  g.merge(1, 1, 2, 3);
  assert.throws(() => g.merge(2, 3, 4, 5), /結合範囲の重なり/);
});

test('Grid が結合範囲内側の値を検出する', () => {
  const g = new Grid('t');
  g.set(2, 2, 'x');
  assert.throws(() => g.merge(1, 1, 3, 3), /内側 B2 に値があります/);
});

test('4 / 8 / 16 チームでレイアウト衝突が起きない', () => {
  for (const n of [4, 8, 16]) {
    const t = buildFullPlacement({ teams: n });
    const g = layoutBracketSheet(t);
    assert.ok(g.cells.size > 0, `${n}チーム: セルが空`);
    assert.ok(g.maxCol <= 6, `${n}チーム: 列が A〜F を超えた (maxCol=${g.maxCol})`);
  }
});

test('終端グループはチーム数に応じて 1 / 2 / 4 個になる', () => {
  assert.equal(terminalGroups(buildFullPlacement({ teams: 4 })).length, 1);
  assert.equal(terminalGroups(buildFullPlacement({ teams: 8 })).length, 2);
  assert.equal(terminalGroups(buildFullPlacement({ teams: 16 })).length, 4);
});

test('最終順位表に 1位〜N位が漏れなく並ぶ', () => {
  for (const n of [4, 8, 16]) {
    const t = buildFullPlacement({ teams: n });
    const g = layoutBracketSheet(t);
    const ranks = [...g.cells.values()].filter((c) => c.col === 1 && /^\d+位$/.test(String(c.value)))
      .map((c) => parseInt(c.value, 10)).sort((a, b) => a - b);
    assert.deepEqual(ranks, [...Array(n).keys()].map((i) => i + 1), `${n}チーム`);
  }
});

test('最終順位は1位から昇順に並ぶ', () => {
  for (const n of [4, 8, 16]) {
    const g = layoutBracketSheet(buildFullPlacement({ teams: n }));
    const ranks = [...g.cells.values()]
      .filter((c) => c.col === 1 && /^\d+位$/.test(String(c.value)))
      .sort((a, b) => a.row - b.row)
      .map((c) => parseInt(c.value, 10));
    assert.deepEqual(ranks, [...Array(n).keys()].map((i) => i + 1), `${n}チーム: 表示順`);
  }
});

test('最初の終端グループが優勝を決めるブラケットになる', () => {
  for (const n of [4, 8, 16]) {
    const groups = terminalGroups(buildFullPlacement({ teams: n }));
    assert.equal(groups[0].final.decides.winner, 1, `${n}チーム`);
  }
});
