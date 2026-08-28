import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';
import { layoutControlSheet, layoutMobileSheet, layoutProgressSheet, cellRefs, TABS } from '../core/sheets.js';
import { getScoring, SCORING } from '../core/scoring.js';

const make = (opts = {}) =>
  buildTournament({ format: 'full-placement', teams: 8, courts: 2, title: 'T', scoring: 'sets-of-3', ...opts });

test('生成した数式から依存グラフを逆算するとモデルと一致する', () => {
  for (const teams of [4, 8, 16]) {
    const t = make({ teams });
    const g = layoutControlSheet(t);
    const rowToId = new Map(t.matches.map((m, i) => [cellRefs.controlRow(i), m.id]));

    t.matches.forEach((m, i) => {
      const r = cellRefs.controlRow(i);
      for (const [col, ref] of [[2, m.left], [3, m.right]]) {
        const f = g.cells.get(`${r},${col}`).value;
        if (ref.type === 'team') {
          // チーム名記入欄を直接参照している
          assert.ok(f.includes(cellRefs.teamName(ref.index)), `${teams}人 ${m.label}: チーム参照`);
          assert.ok(!/\$[EF]\$\d+/.test(f), `${teams}人 ${m.label}: 余計な試合参照が混ざっている`);
        } else {
          const hit = f.match(/\$([EF])\$(\d+)/);
          assert.ok(hit, `${teams}人 ${m.label}: 試合参照が無い`);
          const [, col2, srcRow] = hit;
          assert.equal(col2, ref.type === 'winner' ? 'E' : 'F', `${teams}人 ${m.label}: 勝者/敗者の列`);
          assert.equal(rowToId.get(Number(srcRow)), ref.match, `${teams}人 ${m.label}: 参照先の試合`);
        }
      }
    });
  }
});

test('試合管理は自分より後ろの行を参照しない（循環参照が起きない）', () => {
  for (const teams of [4, 8, 16]) {
    const t = make({ teams });
    const g = layoutControlSheet(t);
    t.matches.forEach((m, i) => {
      const r = cellRefs.controlRow(i);
      for (const col of [2, 3]) {
        for (const hit of g.cells.get(`${r},${col}`).value.matchAll(/\$[EF]\$(\d+)/g)) {
          assert.ok(Number(hit[1]) < r, `${teams}人 ${m.label}: 行${hit[1]} を参照（自分は行${r}）`);
        }
      }
    });
  }
});

test('結果欄は全試合ぶんスマホ用の1列に一本化されている', () => {
  const t = make();
  const g = layoutControlSheet(t);
  const seen = new Set();
  t.matches.forEach((m, i) => {
    const f = g.cells.get(`${cellRefs.controlRow(i)},4`).value;
    assert.equal(f, `=${cellRefs.mobileInput(i)}`, `${m.label}`);
    assert.ok(!seen.has(f), `${m.label}: 入力セルの重複`);
    seen.add(f);
  });
  assert.equal(seen.size, t.matches.length);
});

test('スマホ用の入力欄が全試合ぶんあり、選択肢がプリセットと一致する', () => {
  for (const name of Object.keys(SCORING)) {
    const t = make({ scoring: name });
    const g = layoutMobileSheet(t);
    const inputs = [...g.cells.values()].filter((c) => c.style.input);
    assert.equal(inputs.length, t.matches.length, name);
    for (const c of inputs) {
      assert.deepEqual(c.style.validation, getScoring(name).options, name);
    }
  }
});

test('進行表のチーム名記入欄がチーム数ぶんあり、試合管理の参照先と一致する', () => {
  for (const teams of [4, 8, 16]) {
    const t = make({ teams });
    const g = layoutProgressSheet(t);
    const inputs = [...g.cells.values()].filter((c) => c.style.input).sort((a, b) => a.row - b.row);
    assert.equal(inputs.length, teams);
    inputs.forEach((c, i) => {
      assert.equal(`'${TABS.progress}'!$B$${c.row}`, cellRefs.teamName(i), `${teams}人 ${i}番目`);
    });
  }
});

test('進行表の進行順が枠→コートの順に全試合を1回ずつ並べる', () => {
  const t = make({ courts: 2 });
  const g = layoutProgressSheet(t);
  const labels = [...g.cells.values()].filter((c) => c.col === 3 && c.value !== '試合')
    .sort((a, b) => a.row - b.row).map((c) => c.value);
  assert.deepEqual(labels, t.slots.flatMap((s) => s.matches.map((m) => m.matchLabel)));
  assert.equal(new Set(labels).size, t.matches.length);
});

test('未対応の scoring はエラーになる', () => {
  assert.throws(() => make({ scoring: 'free' }), /未対応の scoring/);
});

test('4タブすべてでセル衝突が起きない', async () => {
  const { layoutBracketSheet } = await import('../core/layout.js');
  for (const teams of [4, 8, 16]) {
    for (const courts of [1, 2, 4]) {
      const t = make({ teams, courts });
      for (const fn of [layoutBracketSheet, layoutProgressSheet, layoutMobileSheet, layoutControlSheet]) {
        assert.doesNotThrow(() => fn(t), `${teams}チーム/${courts}コート ${fn.name}`);
      }
    }
  }
});
