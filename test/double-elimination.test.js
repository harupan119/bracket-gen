import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDoubleElimination, seedOrder } from '../core/formats/double-elimination.js';
import { buildTournament } from '../core/index.js';
import { scheduleMatches } from '../core/schedule.js';
import { simulate } from './simulate.js';

test('標準のシード順を作る', () => {
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.equal(seedOrder(16).length, 16);
  assert.deepEqual([...seedOrder(16)].sort((a, b) => a - b), [...Array(16).keys()].map((i) => i + 1));
});

test('試合数が 勝者側N-1 / 敗者側N-2 / 決勝2 になる', () => {
  for (const n of [4, 5, 8, 10, 12, 16, 20]) {
    const t = buildDoubleElimination({ teams: n });
    const w = t.matches.filter((m) => m.bracket === 'W').length;
    const l = t.matches.filter((m) => m.bracket === 'L').length;
    assert.equal(w, n - 1, `${n}チーム: 勝者側`);
    assert.equal(l, n - 2, `${n}チーム: 敗者側`);
    assert.equal(t.matches.length, 2 * n - 1, `${n}チーム: 総数（2N-2 ＋ 決勝R）`);
  }
});

test('10チームの試合数が実物 10team_double_auto.xlsx と一致する', () => {
  // 実物: 表①〜⑨(9) ＋ 裏①〜⑧(8) ＋ 決勝 ＋ 決勝R = 19
  const t = buildDoubleElimination({ teams: 10 });
  assert.equal(t.matches.filter((m) => m.bracket === 'W').length, 9);
  assert.equal(t.matches.filter((m) => m.bracket === 'L').length, 8);
  assert.equal(t.matches.length, 19);
  assert.deepEqual(
    t.matches.filter((m) => m.bracket === 'F').map((m) => m.label),
    ['決勝', '決勝R']
  );
});

test('優勝以外の全チームがちょうど2敗して終わる', () => {
  for (const [n, iters] of [[4, 128], [8, 3000], [10, 3000], [16, 1500]]) {
    const t = buildDoubleElimination({ teams: n });
    const total = 2 ** t.matches.length;
    for (let k = 0; k < iters; k++) {
      const bits = n === 4 ? k : Math.floor(Math.random() * Math.min(total, 2 ** 30));
      const { ranks, lossCount } = simulate(t, bits);
      const champion = ranks.get(1);
      assert.ok(champion != null, `${n}チーム bits=${bits}: 優勝が決まらない`);
      for (let i = 0; i < n; i++) {
        const losses = lossCount.get(i) ?? 0;
        if (i === champion) {
          assert.ok(losses <= 1, `${n}チーム bits=${bits}: 優勝 ${i} が ${losses} 敗`);
        } else {
          assert.equal(losses, 2, `${n}チーム bits=${bits}: チーム${i} が ${losses} 敗`);
        }
      }
    }
  }
});

test('1位・2位・3位が重複なく決まる', () => {
  for (const n of [4, 8, 10, 16]) {
    const t = buildDoubleElimination({ teams: n });
    for (let k = 0; k < 500; k++) {
      const bits = Math.floor(Math.random() * 2 ** Math.min(t.matches.length, 30));
      const { ranks } = simulate(t, bits);
      const got = [1, 2, 3].map((r) => ranks.get(r));
      assert.ok(got.every((x) => x != null), `${n}チーム bits=${bits}: 順位が欠けた`);
      assert.equal(new Set(got).size, 3, `${n}チーム bits=${bits}: 順位が重複 ${got}`);
    }
  }
});

test('決勝リセットは敗者側代表が決勝に勝ったときだけ実施される', () => {
  const t = buildDoubleElimination({ teams: 8 });
  const gf = t.matches.find((m) => m.label === '決勝');
  const reset = t.matches.find((m) => m.label === '決勝R');
  assert.deepEqual(reset.playedIf, { match: gf.id, side: 'right' });

  let played = 0, skippedCount = 0;
  for (let k = 0; k < 400; k++) {
    const bits = Math.floor(Math.random() * 2 ** t.matches.length);
    const { skipped, winner } = simulate(t, bits);
    if (skipped.has(reset.id)) {
      skippedCount++;
      // 勝者側代表が決勝を制したので、リセットは不要
      assert.equal(winner.get(gf.id), winner.get(t.matches.find((m) => m.id === gf.left.match).id));
    } else {
      played++;
    }
  }
  assert.ok(played > 0 && skippedCount > 0, `両方の分岐が出るはず: 実施${played} / 省略${skippedCount}`);
});

test('bracketReset を切ると決勝リセットが作られない', () => {
  const t = buildDoubleElimination({ teams: 8, bracketReset: false });
  assert.equal(t.matches.filter((m) => m.label === '決勝R').length, 0);
  assert.equal(t.matches.length, 2 * 8 - 2);
  assert.deepEqual(t.matches.at(-1).decides, { winner: 1, loser: 2 });
});

test('同じ枠に同じチームが2回出ない', () => {
  for (const n of [8, 10, 16]) {
    const t = buildTournament({ format: 'double-elimination', teams: n, courts: 4 });
    const byId = new Map(t.matches.map((m) => [m.id, m]));
    for (let k = 0; k < 20; k++) {
      const bits = Math.floor(Math.random() * 2 ** Math.min(t.matches.length, 30));
      const { winner, loser, skipped } = simulate(t, bits);
      const teamOf = (ref) =>
        ref.type === 'team' ? ref.index : (ref.type === 'winner' ? winner : loser).get(ref.match);
      for (const slot of t.slots) {
        const playing = slot.matches
          .filter((e) => !skipped.has(e.matchId))
          .flatMap((e) => [teamOf(byId.get(e.matchId).left), teamOf(byId.get(e.matchId).right)])
          .filter((x) => x != null);
        assert.equal(new Set(playing).size, playing.length, `${n}チーム ${slot.label}`);
      }
    }
  }
});
