import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';

const make = (format, teams, courts) =>
  buildTournament({ format, teams, courts, scoring: 'win-loss' });

test('枠数が多い構成には開催時間の見込みを出す', () => {
  // 当日「終わらない」と気づくのでは遅い。生成時点で分かるようにする。
  const long = make('double-elimination', 20, 2); // 39試合 / 24枠
  const hours = long.warnings.find((w) => w.includes('時間'));
  assert.ok(hours, `長時間の警告が無い: ${JSON.stringify(long.warnings)}`);
  assert.match(hours, /全24枠/);
  assert.match(hours, /約10時間/);
});

test('短く終わる構成には時間の警告を出さない', () => {
  const short = make('single-elimination', 8, 2); // 8試合 / 5枠
  assert.deepEqual(short.warnings, [], `余計な警告: ${JSON.stringify(short.warnings)}`);
});

test('完全順位決定の試合数の増え方を伝える', () => {
  const fp = make('full-placement', 16, 4);
  assert.ok(fp.warnings.some((w) => w.includes('全32試合')));
  // 8チームなら12試合なので出さない
  assert.ok(!make('full-placement', 8, 2).warnings.some((w) => w.includes('試合になります')));
});

test('コートがチーム数に対して多いと連戦を避けにくいと伝える', () => {
  // 連戦回避を有効にしても構造上避けられない。期待とのずれを先に伝える。
  const dense = make('single-elimination', 4, 4);
  assert.ok(dense.warnings.some((w) => w.includes('連戦を避けにくく')));
  assert.ok(!make('single-elimination', 16, 2).warnings.some((w) => w.includes('連戦を避けにくく')));
});

test('警告は生成を止めない', () => {
  for (const [f, n, c] of [['double-elimination', 20, 2], ['full-placement', 16, 2], ['single-elimination', 4, 4]]) {
    const t = make(f, n, c);
    assert.ok(t.warnings.length > 0, `${f} ${n}人${c}面: 警告が出ていない`);
    assert.ok(t.matches.length > 0, '生成が止まっている');
    assert.ok(t.slots.length > 0);
  }
});

test('警告は枠数が確定してから作られる', () => {
  // コート数を変えると枠数が変わり、時間の見込みも変わる。
  const a = make('double-elimination', 20, 2);
  const b = make('double-elimination', 20, 4);
  const hoursOf = (t) => t.warnings.find((w) => w.includes('時間'));
  assert.notEqual(hoursOf(a), hoursOf(b), 'コート数を変えても見込みが同じ');
});
