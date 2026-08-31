import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';
import { scheduleMatches, dependencyOnly, avoidBackToBack, countBackToBack } from '../core/schedule.js';
import { simulate } from './simulate.js';

const CASES = [];
for (const format of ['single-elimination', 'double-elimination', 'full-placement']) {
  for (const teams of [4, 8, 10, 16, 20]) {
    for (const courts of [1, 2, 3, 4]) {
      try {
        CASES.push({ format, teams, courts, t: buildTournament({ format, teams, courts, scoring: 'win-loss' }) });
      } catch { /* 成立しない組み合わせは飛ばす */ }
    }
  }
}

const slotsOf = (c, strategy) =>
  scheduleMatches(c.t, { courts: c.courts, strategy })
    .map((s) => s.matches.map((x) => c.t.matches.find((m) => m.id === x.matchId)));

test('連戦回避は依存関係のみの割当より悪くならない', () => {
  // 単純な貪欲法は兄弟試合を引き離して下流を圧迫し、かえって連戦を増やすことがある。
  // 複数の間隔で組んで良い方を選ぶ方式にしてあるので、悪化してはいけない。
  for (const c of CASES) {
    const base = countBackToBack(c.t.matches, slotsOf(c, dependencyOnly));
    const avoid = countBackToBack(c.t.matches, slotsOf(c, avoidBackToBack));
    assert.ok(avoid <= base, `${c.format} ${c.teams}人/${c.courts}面: ${base} → ${avoid} と悪化`);
  }
});

test('連戦回避でも依存関係を壊さない', () => {
  for (const c of CASES) {
    const slots = slotsOf(c, avoidBackToBack);
    const at = new Map();
    slots.forEach((batch, i) => batch.forEach((m) => at.set(m.id, i)));
    assert.equal(at.size, c.t.matches.length, `${c.format} ${c.teams}人: 割当漏れ`);
    for (const m of c.t.matches) {
      for (const r of [m.left, m.right]) {
        if (r.type === 'team') continue;
        assert.ok(at.get(r.match) < at.get(m.id), `${c.format} ${c.teams}人: ${m.label} の依存が同じか後の枠`);
      }
    }
  }
});

test('連戦回避でも同じ枠に同じチームが2回出ない', () => {
  for (const c of CASES) {
    const slots = slotsOf(c, avoidBackToBack);
    for (let k = 0; k < 20; k++) {
      const bits = Math.floor(Math.random() * 2 ** Math.min(c.t.matches.length, 30));
      const { winner, loser, skipped } = simulate(c.t, bits);
      const teamOf = (ref) =>
        ref.type === 'team' ? ref.index : (ref.type === 'winner' ? winner : loser).get(ref.match);
      for (const batch of slots) {
        const playing = batch
          .filter((m) => !skipped.has(m.id))
          .flatMap((m) => [teamOf(m.left), teamOf(m.right)])
          .filter((x) => x != null);
        assert.equal(new Set(playing).size, playing.length, `${c.format} ${c.teams}人/${c.courts}面`);
      }
    }
  }
});

test('枠数の増加は2枠までに収まる', () => {
  // 連戦を減らす代償は開催の長さ。大きく伸びるなら運営が受け入れられない。
  for (const c of CASES) {
    const base = slotsOf(c, dependencyOnly).length;
    const avoid = slotsOf(c, avoidBackToBack).length;
    assert.ok(avoid - base <= 2, `${c.format} ${c.teams}人/${c.courts}面: 枠が ${base} → ${avoid}`);
  }
});

test('設定で切り替えられ、既定は連戦回避が有効', () => {
  const on = buildTournament({ format: 'double-elimination', teams: 16, courts: 4, scoring: 'win-loss' });
  const off = buildTournament({ format: 'double-elimination', teams: 16, courts: 4, scoring: 'win-loss', avoidBackToBack: false });
  assert.equal(on.avoidBackToBack, true, '既定で有効');
  assert.equal(off.avoidBackToBack, false);
  const tightOn = countBackToBack(on.matches, on.slots.map((s) => s.matches.map((x) => on.matches.find((m) => m.id === x.matchId))));
  const tightOff = countBackToBack(off.matches, off.slots.map((s) => s.matches.map((x) => off.matches.find((m) => m.id === x.matchId))));
  assert.ok(tightOn < tightOff, `切り替えが効いていない: ${tightOn} vs ${tightOff}`);
});

test('コート数が多いほど連戦は避けにくい（構造上のトレードオフ）', () => {
  // 全チームが同時に動くほど休みが取れない。これは並べ替えでは解けない。
  const t1 = buildTournament({ format: 'double-elimination', teams: 16, courts: 2, scoring: 'win-loss' });
  const t4 = buildTournament({ format: 'double-elimination', teams: 16, courts: 8, scoring: 'win-loss' });
  const tight = (t) => countBackToBack(t.matches, t.slots.map((s) => s.matches.map((x) => t.matches.find((m) => m.id === x.matchId))));
  assert.ok(tight(t1) < tight(t4), 'コートが多い方が連戦が少ないのは不自然');
});

test('同じ枠に同じチームの試合が2つ入らない', () => {
  // 予選の総当たりは、同じチームの試合どうしに依存関係が無い。
  // 依存だけを見る割当だと「1チームが同時刻に2コート」が通ってしまう
  // （予選リーグ6〜7チームで実際に発生していた）。
  for (const format of ['group-stage', 'single-elimination', 'double-elimination', 'full-placement']) {
    for (let teams = 4; teams <= 20; teams++) {
      for (const courts of [1, 2, 3, 4]) {
        let t;
        try {
          t = buildTournament({ format, teams, courts, scoring: 'win-loss' });
        } catch {
          continue;
        }
        for (const slot of t.slots) {
          const seen = new Set();
          for (const entry of slot.matches) {
            const m = t.matches.find((x) => x.id === entry.matchId);
            for (const ref of [m.left, m.right]) {
              const key = ref?.type === 'team' ? `T${ref.index}`
                : ref?.type === 'groupRank' ? `G${ref.group}-${ref.rank}` : null;
              if (!key) continue;
              assert.ok(!seen.has(key), `${format} ${teams}人 コート${courts} ${slot.label}: ${key} が2試合`);
              seen.add(key);
            }
          }
        }
      }
    }
  }
});
