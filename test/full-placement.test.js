import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullPlacement } from '../core/index.js';
import { scheduleMatches } from '../core/schedule.js';
import { validateFullPlacement } from '../core/validate.js';
import { simulate } from './simulate.js';

test('8チーム: 試合数と各チームの試合数が実物と一致する', () => {
  const t = buildFullPlacement({ teams: 8 });
  assert.equal(t.matches.length, 12);
  assert.equal(t.rounds, 3);
  assert.equal(t.placements, 8);
});

test('8チーム: 依存関係が参照実物（進行表G列）と完全一致する', () => {
  const t = buildFullPlacement({ teams: 8 });
  const by = Object.fromEntries(t.matches.map((m) => [m.label, m]));
  // 実物 8team_volleyball_base.xlsx 進行表 G13:G24 の記述をそのまま期待値にする
  const expected = {
    '①': ['⑦', '⑤'], '②': ['⑦', '⑤'], '③': ['⑧', '⑥'], '④': ['⑧', '⑥'],
    '⑤': ['⑩', '⑨'], '⑥': ['⑩', '⑨'], '⑦': ['⑫', '⑪'], '⑧': ['⑫', '⑪'],
  };
  const labelOf = (id) => (id === null ? null : t.matches.find((m) => m.id === id).label);
  for (const [label, [w, l]] of Object.entries(expected)) {
    assert.equal(labelOf(by[label].winnerTo), w, `${label} の勝者の行き先`);
    assert.equal(labelOf(by[label].loserTo), l, `${label} の敗者の行き先`);
  }
  assert.deepEqual(by['⑨'].decides, { winner: 7, loser: 8 });
  assert.deepEqual(by['⑩'].decides, { winner: 5, loser: 6 });
  assert.deepEqual(by['⑪'].decides, { winner: 3, loser: 4 });
  assert.deepEqual(by['⑫'].decides, { winner: 1, loser: 2 });
});

test('8チーム: 1回戦の組み合わせが A-B / C-D / E-F / G-H', () => {
  const t = buildFullPlacement({ teams: 8 });
  const r1 = t.matches.filter((m) => m.roundNo === 1);
  assert.deepEqual(
    r1.map((m) => `${m.left.label}-${m.right.label}`),
    ['A-B', 'C-D', 'E-F', 'G-H']
  );
});

test('8チーム: 全4096通りの勝敗で順位1〜8位が重複も欠けもなく確定する', () => {
  const t = buildFullPlacement({ teams: 8 });
  const total = 1 << t.matches.length;
  assert.equal(total, 4096);
  for (let bits = 0; bits < total; bits++) {
    const { ranks, playCount } = simulate(t, bits);
    assert.equal(ranks.size, 8, `bits=${bits}: 確定した順位の数`);
    const teamsAtRanks = [...ranks.values()].sort((a, b) => a - b);
    assert.deepEqual(teamsAtRanks, [0, 1, 2, 3, 4, 5, 6, 7], `bits=${bits}: 順位に入るチーム`);
    for (let i = 0; i < 8; i++) {
      assert.equal(playCount.get(i), 3, `bits=${bits}: チーム${i}の試合数`);
    }
  }
});

test('4チーム / 16チーム: 全パターンで順位が確定する（16は無作為2000通り）', () => {
  for (const n of [4, 16]) {
    const t = buildFullPlacement({ teams: n });
    assert.equal(t.matches.length, (n * Math.log2(n)) / 2);
    const total = 2 ** t.matches.length;
    const iters = n === 4 ? total : 2000;
    for (let k = 0; k < iters; k++) {
      const bits = n === 4 ? k : Math.floor(Math.random() * total);
      const { ranks, playCount } = simulate(t, bits);
      assert.equal(ranks.size, n);
      assert.deepEqual([...ranks.values()].sort((a, b) => a - b), [...Array(n).keys()]);
      for (let i = 0; i < n; i++) assert.equal(playCount.get(i), Math.log2(n));
    }
  }
});

test('2の冪でないチーム数は明確なエラーで拒否する', () => {
  for (const n of [5, 6, 10, 12, 20]) {
    assert.throws(() => validateFullPlacement(n), /完全順位決定トーナメントは 4 \/ 8 \/ 16 チームでのみ成立します/);
  }
  assert.throws(() => validateFullPlacement(2), /4〜20 の範囲/);
  assert.throws(() => validateFullPlacement(32), /4〜20 の範囲/);
});

test('コート1面の枠割当が実物の進行順①〜⑫と一致する', () => {
  const t = buildFullPlacement({ teams: 8 });
  const slots = scheduleMatches(t, { courts: 1 });
  assert.equal(slots.length, 12);
  assert.deepEqual(
    slots.map((s) => s.matches[0].matchLabel),
    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫']
  );
});

test('コート2面なら6枠になり、同じ枠に依存関係が入らない', () => {
  const t = buildFullPlacement({ teams: 8 });
  const slots = scheduleMatches(t, { courts: 2 });
  assert.equal(slots.length, 6);
  const placed = new Set();
  for (const slot of slots) {
    const ids = slot.matches.map((x) => x.matchId);
    for (const id of ids) {
      const m = t.matches.find((x) => x.id === id);
      for (const ref of [m.left, m.right]) {
        if (ref.type !== 'team') {
          assert.ok(placed.has(ref.match), `${m.label} の依存 ${ref.match} が同じ枠か後ろにある`);
        }
      }
    }
    ids.forEach((id) => placed.add(id));
  }
});
