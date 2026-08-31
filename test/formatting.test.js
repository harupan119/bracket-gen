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

test('経路は枠も線も同じ濃い赤で塗られる（帯が途切れない）', () => {
  // 実物のスプレッドシートは経路を1色の濃い赤で塗っている。
  // 枠と線で色を変えると、境目で色が切り替わって帯が分断されて見える。
  const rs = rules(make());
  const red = rs.filter((r) => {
    const bg = r.booleanRule.format.backgroundColor;
    return bg.red > 0.8 && bg.green < 0.3;
  });
  // 入力済みの緑 #E2F0D9 は赤成分も 0.89 あるので、赤成分だけでは経路と分けられない。
  const done = rs.filter((r) => r.booleanRule.format.backgroundColor.green > 0.8
    && !r.booleanRule.format.textFormat);
  assert.ok(red.length > 0, '経路のルール');
  assert.ok(done.length > 0, '入力済みのルール');

  // 枠も連結列も同じ書式であること。ここが分かれると帯が途切れる。
  for (const r of red) {
    assert.deepEqual(
      r.booleanRule.format.textFormat.foregroundColor,
      { red: 1, green: 1, blue: 1 },
      '経路の文字は白'
    );
    assert.equal(r.booleanRule.format.textFormat.bold, true, '経路は太字');
  }

  // 経路はチーム枠（偶数列）と連結列（奇数列）の両方を覆う
  const cols = new Set();
  for (const r of red) for (const g of r.ranges) if (g.sheetId === 0) cols.add(g.startColumnIndex + 1);
  assert.ok([...cols].some((c) => c % 2 === 0), 'チーム枠の列が塗られていない');
  assert.ok([...cols].some((c) => c % 2 === 1), '連結列が塗られていない');

  for (const r of done) {
    assert.ok(r.booleanRule.format.backgroundColor.green > 0.8, '緑背景');
  }
});

test('入力用の結果列と勝者列に範囲ルールが1本ずつ付く', () => {
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
  // 8チームなら 1回戦8 + 準決勝4 + 決勝2 = 14本。
  // シードのある構成では、箱を描かない通過スロットにも帯を通すため本数が増える
  // （通さないと、シードのチームの経路がそのラウンドで途切れる）。
  const cases = [
    ['single-elimination', 8, 14],
    ['full-placement', 8, 8],
    ['double-elimination', 10, 39],
  ];
  for (const [format, teams, expected] of cases) {
    const g = layoutBracketSheet(buildTournament({ format, teams, courts: 2, scoring: 'win-loss' }));
    assert.equal(g.paths.length, expected, `${format} ${teams}チーム`);
    for (const p of g.paths) {
      // 敗者側の大ラウンドは親と子が同じ行なので、経路は1セル（横方向の区間）になる
      assert.ok(p.r2 >= p.r1, `経路の範囲が逆転: ${p.r1}-${p.r2}`);
      // 通過スロット（シードが素通りする枠）は箱を描かないので、その枠自体も塗る。
      // 実物のスプレッドシートも、経路が通る空の内容列を塗って帯をつないでいる。
      assert.ok(p.col >= 2, `経路の列が不正: ${p.col}`);
    }
  }
});

test('シードのチームにも着色ルールが付く', async () => {
  // シードは次のラウンドの枠が「同じチームの通過」なので、親スロットからは試合を引けない。
  // ここを取りこぼすと、シードのチームだけ何回勝っても赤くならない（実シートで発覚）。
  const { layoutBracketSheet } = await import('../core/layout.js');
  for (const [format, teams] of [['double-elimination', 20], ['single-elimination', 10], ['single-elimination', 12]]) {
    const g = layoutBracketSheet(buildTournament({ format, teams, courts: 2, scoring: 'sets-of-3' }));
    const dark = [...g.cells.values()].filter(
      (c) =>
        ['team', 'slot'].includes(c.style?.role) &&
        String(c.value).startsWith('=') &&
        String(c.value).includes('チーム）') &&
        !c.style.winnerOf &&
        !c.style.championOf
    );
    assert.equal(dark.length, 0, `${format} ${teams}チーム: 着色ルールの無いチーム枠 ${dark.map((c) => `${c.row},${c.col}`).join(' ')}`);
  }
});

test('条件付き書式の参照はすべて絶対参照', async () => {
  // 式は範囲の左上を基準に行・列がずれて評価される。相対参照だと範囲の先頭行しか
  // 一致せず、経路の帯が1セルで途切れる（実シートの effectiveFormat で発覚）。
  const { buildSpreadsheetPayload } = await import('../core/payload.js');
  for (const [format, teams] of [['double-elimination', 10], ['double-elimination', 20], ['single-elimination', 12], ['group-stage', 8]]) {
    const rules = buildSpreadsheetPayload(buildTournament({ format, teams, courts: 2, scoring: 'sets-of-3' }))
      .requests.filter((r) => r.addConditionalFormatRule)
      .map((r) => r.addConditionalFormatRule.rule);
    for (const r of rules) {
      const f = r.booleanRule.condition.values?.[0]?.userEnteredValue ?? '';
      // 引用符の中（プレースホルダの文言）は参照ではないので外す
      const bare = f.replace(/"[^"]*"/g, '""');
      const relative = bare.match(/(?<![$A-Z0-9])[A-Z]{1,2}\d+/g) ?? [];
      assert.deepEqual(relative, [], `${format} ${teams}チーム: 相対参照 ${relative.join(',')} in ${f}`);
    }
  }
});

test('隠し補助列と列幅がブラケット図の右端まで届く', async () => {
  // 敗者側は勝者側より右まで伸びる。勝者側だけで右端を決めると、
  // 右側の列に幅が当たらず、隠し補助列が敗者側のセルの上に来て表示が消える
  // （実シートで「裏⑦の勝者」が非表示列に埋まっていた）。
  const { layoutBracketSheet } = await import('../core/layout.js');
  const { buildSpreadsheetPayload } = await import('../core/payload.js');
  for (const [format, teams] of [['double-elimination', 6], ['double-elimination', 10], ['double-elimination', 14], ['double-elimination', 20], ['single-elimination', 16]]) {
    const t = buildTournament({ format, teams, courts: 2, scoring: 'win-loss' });
    const g = layoutBracketSheet(t);
    const hidden = buildSpreadsheetPayload(t)
      .requests.filter((r) => r.updateDimensionProperties?.properties?.hiddenByUser
        && r.updateDimensionProperties.range.sheetId === 0)
      .map((r) => r.updateDimensionProperties.range.startIndex + 1);
    const shown = [...g.cells.values()].filter((c) => !c.style?.helper);
    const buried = shown.filter((c) => hidden.includes(c.col));
    assert.deepEqual(
      buried.map((c) => `${c.row},${c.col}`), [],
      `${format} ${teams}チーム: 非表示列に表示セルがある`
    );
    const noWidth = [...new Set(shown.filter((c) => c.col >= 2).map((c) => c.col))]
      .filter((c) => !g.columns.has(c));
    assert.deepEqual(noWidth, [], `${format} ${teams}チーム: 幅未設定の列 ${noWidth.join(',')}`);
  }
});

test('決勝トーナメントのシード出場枠にも着色ルールが付く', async () => {
  // 予選リーグの出場者は groupRank 型。シードで直行する枠は親が「同じ出場者の通過」に
  // なるため、親から次戦を引けず着色ルールが出ていなかった（team 型と同じ穴）。
  const { layoutBracketSheet } = await import('../core/layout.js');
  for (const teams of [10, 12, 13, 16, 20]) {
    const g = layoutBracketSheet(buildTournament({ format: 'group-stage', teams, courts: 2, scoring: 'sets-of-3' }));
    const dark = [...g.cells.values()].filter(
      (c) => ['team', 'slot'].includes(c.style?.role)
        && /"[A-Z]組\d位"/.test(String(c.value))
        && !c.style.winnerOf && !c.style.championOf
    );
    assert.equal(dark.length, 0, `${teams}チーム: 着色ルールの無い出場枠 ${dark.map((c) => `${c.row},${c.col}`).join(' ')}`);
  }
});

test('経路の塗りが起点から途切れず続く', async () => {
  // 同じ起点を条件にする塗りは、起点の列から右へ連続していなければ帯が切れる。
  const { layoutBracketSheet } = await import('../core/layout.js');
  for (const [format, teams] of [['group-stage', 12], ['group-stage', 13], ['double-elimination', 10], ['single-elimination', 10], ['double-elimination', 20]]) {
    const g = layoutBracketSheet(buildTournament({ format, teams, courts: 2, scoring: 'sets-of-3' }));
    const byRef = new Map();
    for (const p of g.paths ?? []) {
      if (!byRef.has(p.cellRef)) byRef.set(p.cellRef, new Set());
      byRef.get(p.cellRef).add(p.col);
    }
    for (const [ref, cols] of byRef) {
      const m = String(ref).replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/);
      let sc = 0;
      for (const ch of m[1]) sc = sc * 26 + ch.charCodeAt(0) - 64;
      const all = [sc, ...cols].sort((a, b) => a - b);
      const gaps = all.filter((c, i) => i > 0 && c !== all[i - 1] + 1);
      assert.deepEqual(gaps, [], `${format} ${teams}チーム: 起点${ref} 列${all.join(',')} に隙間`);
    }
  }
});
