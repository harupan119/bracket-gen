import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFullPlacement, buildTournament } from '../core/index.js';
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
    // A〜F が表示列、H:I が条件付き書式用の隠し補助列
    assert.ok(g.maxCol <= 9, `${n}チーム: 列が I を超えた (maxCol=${g.maxCol})`);
    const visible = [...g.cells.values()].filter((c) => !c.style.helper);
    assert.ok(Math.max(...visible.map((c) => c.col)) <= 6, `${n}チーム: 表示列が F を超えた`);
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

test('最終順位表にチーム名を引く数式が全順位ぶん入る', () => {
  for (const n of [4, 8, 16]) {
    const g = layoutBracketSheet(buildFullPlacement({ teams: n }));
    const rankRows = [...g.cells.values()]
      .filter((c) => c.col === 1 && /^\d+位$/.test(String(c.value)))
      .map((c) => c.row);
    assert.equal(rankRows.length, n);
    for (const r of rankRows) {
      const cell = g.cells.get(`${r},2`);
      assert.ok(cell, `${n}チーム: ${r}行にチーム名セルが無い`);
      // 同一順位を決める試合が複数ある場合（決勝と決勝R）は、後のものを優先する連結式になる
      assert.match(String(cell.value), /^=IF\('試合管理'!\$[EF]\$\d+<>"",/, `${n}チーム: ${r}行`);
    }
  }
});

test('隠し補助列が全試合ぶんの勝者・敗者を同一シートへ写す', () => {
  for (const n of [4, 8, 16]) {
    const t = buildFullPlacement({ teams: n });
    const g = layoutBracketSheet(t);
    const helpers = [...g.cells.values()].filter((c) => c.style.helper && c.row > 1);
    assert.equal(helpers.length, t.matches.length * 2, `${n}チーム`);
    for (const c of helpers) {
      assert.match(String(c.value), /^='試合管理'!\$[EF]\$\d+$/, `${c.row},${c.col}`);
    }
  }
});

test('ブラケット図のセルが試合管理を参照する生きた数式になる', () => {
  const g = layoutBracketSheet(buildFullPlacement({ teams: 8 }));
  const live = [...g.cells.values()]
    .filter((c) => !c.style.helper && String(c.value).includes("'試合管理'!"));
  // 進出チーム4×2グループ + 準決勝勝者2×2 + 決勝1×2 + 順位表8 + 下位決定戦の左右2×2
  assert.ok(live.length >= 20, `生きた数式が少なすぎる: ${live.length}`);
  for (const c of live) {
    assert.match(String(c.value), /^=IF\(/, `${c.row},${c.col}`);
  }
});

test('ツリーを持つ形式はブラケット図として描かれる', () => {
  for (const format of ['single-elimination', 'double-elimination']) {
    for (const teams of [4, 8, 10, 16]) {
      const t = buildTournament({ format, teams, courts: 2, scoring: 'win-loss' });
      assert.ok(t.tree, `${format} ${teams}: tree が無い`);
      const g = layoutBracketSheet(t);
      // 各ラウンドのスロットが式どおりの位置に置かれている
      const base = [...g.cells.values()].find((c) => String(c.value).startsWith('■'))?.row + 1;
      assert.ok(base > 0);
      const filled = t.tree.levels[0].filter(Boolean).length;
      assert.equal(filled, teams, `${format} ${teams}: 1列目に並ぶチーム数`);
      assert.ok(g.borders.length > 0, `${format} ${teams}: 枝の罫線が無い`);
    }
  }
});

test('枝の罫線が実物と同じ組み方になる（8チーム・シングル）', () => {
  const t = buildTournament({ format: 'single-elimination', teams: 8, courts: 2, scoring: 'win-loss' });
  const g = layoutBracketSheet(t);
  const key = (b) => `${a1(b.r1, b.c1)}:${a1(b.r2, b.c2)}/${b.side}`;
  const got = new Set(g.borders.map(key));
  // 1試合目: 上下のチーム名に下線、連結列に縦線、親へ横線
  for (const expected of ['B6:B6/bottom', 'B8:B8/bottom', 'C7:C8/left', 'C7:C7/bottom']) {
    assert.ok(got.has(expected), `${expected} が無い`);
  }
  // 準決勝の縦線は倍の高さになる
  assert.ok(got.has('E8:E11/left'), '準決勝の縦線');
  // 優勝セルにも下線が付く
  assert.ok(got.has('H13:H13/bottom'), '優勝セルの下線');
});

test('補助列はブラケットの右端より外に置かれる', () => {
  for (const teams of [4, 8, 16]) {
    const t = buildTournament({ format: 'single-elimination', teams, courts: 2 });
    const g = layoutBracketSheet(t);
    const helpers = [...g.cells.values()].filter((c) => c.style.helper);
    const visible = [...g.cells.values()].filter((c) => !c.style.helper);
    const maxVisible = Math.max(...visible.map((c) => c.col));
    const minHelper = Math.min(...helpers.map((c) => c.col));
    assert.ok(minHelper > maxVisible, `${teams}チーム: 補助列(${minHelper})が表示列(${maxVisible})と衝突`);
  }
});

test('ダブルは敗者側も図として描かれる', () => {
  for (const teams of [8, 10, 16]) {
    const t = buildTournament({ format: 'double-elimination', teams, courts: 2, scoring: 'win-loss' });
    assert.ok(t.loserTree, `${teams}: loserTree が無い`);
    const kinds = t.loserTree.levels.map((l) => l.kind);
    assert.equal(kinds[0], 'drop', '最初は勝者側1回戦の敗者');
    // 以降は小ラウンドと大ラウンドの交互
    for (let i = 1; i < kinds.length; i++) {
      assert.equal(kinds[i], i % 2 === 1 ? 'minor' : 'major', `${teams}: ${i}番目`);
    }
    const g = layoutBracketSheet(t);
    const heads = [...g.cells.values()]
      .filter((c) => c.col === 1 && String(c.value).startsWith('■'))
      .map((c) => String(c.value));
    assert.ok(heads.some((h) => h.includes('勝者側ブラケット')), `${teams}: 勝者側の図が無い`);
    assert.ok(heads.some((h) => h.includes('敗者側ブラケット')), `${teams}: 敗者側の図が無い`);
    // 敗者側がリストに落ちていないこと
    assert.ok(!heads.some((h) => /敗者側 \d+回戦/.test(h)), `${teams}: 敗者側がリスト表示のまま`);
  }
});

test('敗者側は小ラウンドで行が寄り、大ラウンドで動かない', () => {
  const t = buildTournament({ format: 'double-elimination', teams: 16, courts: 4, scoring: 'win-loss' });
  const g = layoutBracketSheet(t);
  const head = [...g.cells.values()].find((c) => c.col === 1 && String(c.value).includes('敗者側ブラケット'));
  const base = head.row + 1;
  // 敗者側の区画だけを見る。下には決勝や最終順位が続くので範囲を区切る。
  const end = base + t.loserTree.levels[0].refs.length * 2;
  const at = (col) => [...g.cells.values()]
    .filter((c) => c.col === col && c.row > base && c.row <= end && !c.style.helper)
    .map((c) => c.row).sort((a, b) => a - b);
  const drop = at(2);   // 8スロット
  const minor = at(4);  // 小ラウンド: 4スロット、対の中点へ
  const major = at(6);  // 大ラウンド: 4スロット、行は動かない
  assert.equal(drop.length, 8);
  assert.equal(minor.length, 4);
  assert.equal(major.length, 4);
  assert.deepEqual(minor, [0, 1, 2, 3].map((i) => Math.round((drop[i * 2] + drop[i * 2 + 1]) / 2)));
  assert.deepEqual(major, minor, '大ラウンドは行を動かさない');
});

test('ブラケットの頂点は優勝でなく「次の試合」を指す', () => {
  // 敗者側の頂点は決勝へ進むだけで優勝ではない。
  const t = buildTournament({ format: 'double-elimination', teams: 10, courts: 4, scoring: 'win-loss' });
  const g = layoutBracketSheet(t);
  const label = (id) => t.matches.find((m) => m.id === id)?.label;
  const champs = [...g.cells.values()].filter((c) => c.style.championOf);
  // 優勝タグは最終順位の1位だけ
  assert.equal(champs.length, 1, `championOf が多すぎる: ${champs.length}`);
  assert.equal(label(champs[0].style.championOf), '決勝R');
  // 勝者側と敗者側の頂点は決勝を指す
  const toFinal = [...g.cells.values()].filter((c) => c.style.winnerOf && label(c.style.winnerOf) === '決勝');
  assert.ok(toFinal.length >= 2, '両ブラケットの頂点が決勝を指していない');
});
