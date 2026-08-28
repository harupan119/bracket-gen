import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSingleElimination } from '../core/formats/single-elimination.js';
import { buildTournament } from '../core/index.js';
import { simulate } from './simulate.js';

test('試合数が N-1（3位決定戦ありなら N）になる', () => {
  for (const n of [4, 5, 8, 10, 12, 16, 20]) {
    assert.equal(buildSingleElimination({ teams: n, thirdPlace: false }).matches.length, n - 1, `${n}チーム`);
    assert.equal(buildSingleElimination({ teams: n }).matches.length, n, `${n}チーム 3位決定戦あり`);
  }
});

test('優勝は無敗、それ以外はちょうど1敗（3位決定戦なし）', () => {
  for (const [n, iters] of [[4, 8], [8, 2000], [10, 2000], [16, 1000]]) {
    const t = buildSingleElimination({ teams: n, thirdPlace: false });
    for (let k = 0; k < iters; k++) {
      const bits = n === 4 ? k : Math.floor(Math.random() * 2 ** Math.min(t.matches.length, 30));
      const { ranks, lossCount } = simulate(t, bits);
      const champion = ranks.get(1);
      assert.ok(champion != null, `${n}チーム bits=${bits}`);
      for (let i = 0; i < n; i++) {
        const losses = lossCount.get(i) ?? 0;
        assert.equal(losses, i === champion ? 0 : 1, `${n}チーム bits=${bits}: チーム${i}`);
      }
    }
  }
});

test('3位決定戦を入れると1位〜4位が重複なく決まる', () => {
  for (const n of [4, 8, 10, 16]) {
    const t = buildSingleElimination({ teams: n });
    for (let k = 0; k < 500; k++) {
      const bits = Math.floor(Math.random() * 2 ** Math.min(t.matches.length, 30));
      const { ranks } = simulate(t, bits);
      const got = [1, 2, 3, 4].map((r) => ranks.get(r));
      assert.ok(got.every((x) => x != null), `${n}チーム bits=${bits}: 順位が欠けた`);
      assert.equal(new Set(got).size, 4, `${n}チーム bits=${bits}: 順位が重複 ${got}`);
    }
    assert.equal(t.placements, 4);
  }
});

test('3位決定戦は準決勝の敗者同士で行われる', () => {
  const t = buildSingleElimination({ teams: 8 });
  const third = t.matches.find((m) => m.label === '3位決定戦');
  const semis = t.matches.filter((m) => m.roundName === '準決勝');
  assert.equal(semis.length, 2);
  assert.deepEqual(
    [third.left, third.right].map((r) => ({ type: r.type, match: r.match })),
    semis.map((s) => ({ type: 'loser', match: s.id }))
  );
});

test('3位決定戦に丸数字を使わず、他の試合の番号が詰まっている', () => {
  const t = buildSingleElimination({ teams: 10 });
  const numbered = t.matches.filter((m) => m.label !== '3位決定戦');
  assert.deepEqual(numbered.map((m) => m.no), [...Array(numbered.length).keys()].map((i) => i + 1));
  assert.equal(new Set(numbered.map((m) => m.label)).size, numbered.length, '丸数字の重複');
});

test('同じ枠に同じチームが2回出ない', () => {
  for (const n of [8, 10, 16]) {
    const t = buildTournament({ format: 'single-elimination', teams: n, courts: 3 });
    const byId = new Map(t.matches.map((m) => [m.id, m]));
    for (let k = 0; k < 20; k++) {
      const bits = Math.floor(Math.random() * 2 ** Math.min(t.matches.length, 30));
      const { winner, loser } = simulate(t, bits);
      const teamOf = (ref) =>
        ref.type === 'team' ? ref.index : (ref.type === 'winner' ? winner : loser).get(ref.match);
      for (const slot of t.slots) {
        const playing = slot.matches
          .flatMap((e) => [teamOf(byId.get(e.matchId).left), teamOf(byId.get(e.matchId).right)])
          .filter((x) => x != null);
        assert.equal(new Set(playing).size, playing.length, `${n}チーム ${slot.label}`);
      }
    }
  }
});

test('4タブすべてが生成でき、セル衝突が起きない', async () => {
  const { layoutBracketSheet } = await import('../core/layout.js');
  const { layoutProgressSheet, layoutMobileSheet, layoutControlSheet } = await import('../core/sheets.js');
  for (const n of [4, 8, 10, 16]) {
    const t = buildTournament({ format: 'single-elimination', teams: n, courts: 2, scoring: 'sets-of-3' });
    for (const fn of [layoutBracketSheet, layoutProgressSheet, layoutMobileSheet, layoutControlSheet]) {
      assert.doesNotThrow(() => fn(t), `${n}チーム ${fn.name}`);
    }
  }
});
