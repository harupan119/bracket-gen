import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournament } from '../core/index.js';
import { layoutControlSheet, layoutMobileSheet, layoutProgressSheet, cellRefs, TABS, refPlaceholder } from '../core/sheets.js';
import { textPx, COL_UNIT_PX } from '../core/util.js';
import { THEME } from '../core/theme.js';
import { getScoring, SCORING } from '../core/scoring.js';

const make = (opts = {}) =>
  buildTournament({ format: 'full-placement', teams: 8, courts: 2, title: 'T', scoring: 'sets-of-3', ...opts });

const CASES = [
  { format: 'full-placement', sizes: [4, 8, 16] },
  { format: 'double-elimination', sizes: [4, 8, 10, 16] },
  { format: 'single-elimination', sizes: [4, 8, 10, 16] },
];

test('条件付き試合の対戦カードがモデルの左右（勝者E列／敗者F列）と一致する', () => {
  // 元試合の B/C（当初の左右）を出すと、同じ "2-1" がモデルと逆の勝者を指す。
  for (const teams of [4, 8, 10, 16]) {
    const t = buildTournament({ format: 'double-elimination', teams, courts: 2, scoring: 'sets-of-3' });
    const g = layoutControlSheet(t);
    const idx = t.matches.findIndex((m) => m.playedIf);
    if (idx < 0) continue;
    const m = t.matches[idx];
    const r = cellRefs.controlRow(idx);
    const src = cellRefs.controlRow(t.matches.findIndex((x) => x.id === m.playedIf.match));
    assert.equal(m.left.type, 'winner');
    assert.equal(m.right.type, 'loser');
    assert.match(g.cells.get(`${r},2`).value, new RegExp(`,\\$E\\$${src},""\\)$`), `${teams}チーム: 左`);
    assert.match(g.cells.get(`${r},3`).value, new RegExp(`,\\$F\\$${src},""\\)$`), `${teams}チーム: 右`);
  }
});

test('生成した数式から依存グラフを逆算するとモデルと一致する（3形式）', () => {
  for (const { format, sizes } of CASES) {
  for (const teams of sizes) {
    const t = buildTournament({ format, teams, courts: 2, scoring: 'sets-of-3' });
    const g = layoutControlSheet(t);
    const rowToId = new Map(t.matches.map((m, i) => [cellRefs.controlRow(i), m.id]));

    t.matches.forEach((m, i) => {
      if (m.playedIf) return; // 条件付き試合は専用テストで検査する
      const r = cellRefs.controlRow(i);
      for (const [col, ref] of [[2, m.left], [3, m.right]]) {
        const f = g.cells.get(`${r},${col}`).value;
        if (ref.type === 'team') {
          // チーム名記入欄を直接参照している
          assert.ok(f.includes(cellRefs.teamName(ref.index)), `${teams}人 ${m.label}: チーム参照`);
          assert.ok(!/\$[EF]\$\d+/.test(f), `${format} ${teams}人 ${m.label}: 余計な試合参照が混ざっている`);
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

test('結果欄は全試合ぶん入力用の1列に一本化されている', () => {
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

test('入力用の入力欄が全試合ぶんあり、選択肢がプリセットと一致する', () => {
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

test('進行表が枠を行・コートを列にした行列になる', () => {
  // 1試合1行の縦並びだと、同時に走る試合が縦に散って当日どのコートで何が動いているか
  // 読めない。枠とコートの対応が座標そのものになっていることを固定する。
  for (const courts of [1, 2, 4]) {
    const t = make({ courts });
    const g = layoutProgressSheet(t);
    const head = [...g.cells.values()].find((c) => c.col === 1 && c.value === '枠');
    assert.ok(head, `${courts}コート: 見出しが無い`);
    // 見出し行にコートが横に並ぶ
    const courtHeads = [...g.cells.values()]
      .filter((c) => c.row === head.row && c.col > 2)
      .sort((a, b) => a.col - b.col)
      .map((c) => c.value);
    assert.deepEqual(
      courtHeads,
      Array.from({ length: courts }, (_, i) => `コート${i + 1}`),
      `${courts}コート: 見出しの並び`
    );
    // 各試合が「その枠の行・そのコートの列」に1回だけ出る
    const seen = new Map();
    for (const c of g.cells.values()) {
      const m = t.matches.find((x) => String(c.value).startsWith(`${x.label}　`));
      if (m) seen.set(m.label, c);
    }
    assert.equal(seen.size, t.matches.length, `${courts}コート: 試合が漏れている`);
    for (const slot of t.slots) {
      const rows = new Set();
      for (const e of slot.matches) {
        const cell = seen.get(e.matchLabel);
        assert.equal(cell.col, 2 + e.court, `${courts}コート: ${e.matchLabel} の列がコート${e.court}と違う`);
        rows.add(cell.row);
      }
      assert.equal(rows.size <= 1, true, `${courts}コート: ${slot.label} の試合が同じ行に並んでいない`);
    }
  }
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

test('シングル／ダブルで「各チームN試合」と書かない', async () => {
  // 1敗（2敗）で敗退する形式では試合数が一定にならないので、この表現は誤り。
  const { layoutBracketSheet } = await import('../core/layout.js');
  for (const format of ['single-elimination', 'double-elimination']) {
    for (const teams of [8, 10, 16]) {
      const t = buildTournament({ format, teams, courts: 2, scoring: 'win-loss' });
      for (const fn of [layoutBracketSheet, layoutProgressSheet]) {
        const texts = [...fn(t).cells.values()].map((c) => String(c.value));
        assert.ok(!texts.some((x) => /各チーム\d+試合/.test(x)), `${format} ${teams} ${fn.name}`);
      }
    }
  }
  // 完全順位決定は全員同じ試合数なので、書いてよい
  const fp = buildTournament({ format: 'full-placement', teams: 8, courts: 2, scoring: 'win-loss' });
  const t2 = [...layoutProgressSheet(fp).cells.values()].map((c) => String(c.value));
  assert.ok(t2.some((x) => /各チーム3試合/.test(x)), '完全順位決定では明記する');
});

test('選択肢にない値は「入力エラー」にし、勝敗を判定しない', async () => {
  // 実シートで発覚: 3本勝負のシートに 5セットマッチの "3-1" を入れると、
  // 「左の勝ちではない＝右の勝ち」と黙って解釈され、状態は「確定」のままだった。
  // 日付に化けた値（46082 のようなシリアル）も同じ経路で通ってしまう。
  const { getScoring } = await import('../core/scoring.js');
  for (const name of ['win-loss', 'sets-of-3', 'sets-of-5']) {
    const t = make({ scoring: name });
    const g = layoutControlSheet(t);
    const r = cellRefs.controlRow(0);
    const opts = getScoring(name).options;
    for (const col of [5, 6]) {
      const f = g.cells.get(`${r},${col}`).value;
      assert.match(f, /^=IF\(NOT\(OR\(/, `${name}: 妥当性を先に見ていない`);
      for (const o of opts) assert.ok(f.includes(`="${o}"`), `${name}: 選択肢 ${o} が条件に無い`);
    }
    const state = g.cells.get(`${r},7`).value;
    assert.match(state, /"入力エラー"/, `${name}: エラー状態が無い`);
    assert.match(state, /"未入力"/, `${name}: 未入力と区別していない`);
  }
});


test('入力用の対戦カード列に、実際に出る文字列が収まる', () => {
  // 「（Hチーム） vs （Iチーム）」は 195px あり、以前の固定幅 22（165px）では両端が切れていた。
  // 数式がセル参照の連結なので、表示テキストを数式から測ることはできない。模型から組み立てて測る。
  for (const [format, teams] of [
    ['single-elimination', 8],
    ['double-elimination', 10],
    ['full-placement', 16],
    ['group-stage', 12],
  ]) {
    const t = buildTournament({ format, teams, courts: 2, scoring: 'sets-of-3' });
    const g = layoutMobileSheet(t);
    const avail = g.columns.get(2) * COL_UNIT_PX;
    for (const m of t.matches) {
      const txt = `${refPlaceholder(m.left)} vs ${refPlaceholder(m.right)}`;
      const need = textPx(txt, THEME.sizes.body);
      assert.ok(need <= avail, `${format}/${teams}: "${txt}" は ${Math.ceil(need)}px 必要だが ${avail}px しかない`);
    }
  }
});

test('進行表の試合名がラウンド名と重複しない', () => {
  // 決勝は label も roundName も「決勝」なので、素で連結すると「決勝　決勝」になる。
  for (const format of ['single-elimination', 'double-elimination', 'full-placement']) {
    for (const teams of [8, 10, 16]) {
      let t;
      try {
        t = buildTournament({ format, teams, courts: 2, scoring: 'sets-of-3' });
      } catch {
        continue;
      }
      for (const c of layoutProgressSheet(t).cells.values()) {
        const v = String(c.value);
        assert.equal(/^(.+)　\1$/.test(v), false, `${format} ${teams}チーム: 「${v}」が重複している`);
      }
    }
  }
});
