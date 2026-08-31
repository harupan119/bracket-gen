import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupStage, splitGroups, defaultGroups, groupLabel } from '../core/formats/group-stage.js';
import { Grid } from '../core/grid.js';
import { writeStandings, groupRankFormula, groupMatchRows } from '../core/standings.js';

test('組分けは1組4チームを基準に決まる', () => {
  // 1組5チームにすると総当たりが10試合になり、予選だけで他形式の総試合数を超える。
  assert.equal(defaultGroups(8), 2);
  assert.equal(defaultGroups(12), 3);
  assert.equal(defaultGroups(16), 4);
  assert.equal(defaultGroups(20), 4);
});

test('蛇行で配るので同じ組に強いチームが偏らない', () => {
  const g = splitGroups(8, 2);
  assert.deepEqual(g, [[0, 3, 4, 7], [1, 2, 5, 6]]);
  // 全チームがどこかの組に1回だけ入る
  const all = g.flat().sort((a, b) => a - b);
  assert.deepEqual(all, [...Array(8).keys()]);
});

test('予選は組ごとの総当たりになる', () => {
  for (const [teams, groups] of [[8, 2], [12, 3], [16, 4]]) {
    const t = buildGroupStage({ teams, groups });
    for (const group of t.groups) {
      const n = group.teams.length;
      const ms = t.matches.filter((m) => m.stage === 'group' && m.group === group.index);
      assert.equal(ms.length, (n * (n - 1)) / 2, `${teams}人${groups}組 ${group.label}`);
      // 同じ組み合わせが2回出ない
      const pairs = ms.map((m) => [m.left.index, m.right.index].sort((a, b) => a - b).join('-'));
      assert.equal(new Set(pairs).size, pairs.length, '対戦の重複');
      // 各チームが n-1 試合
      for (const ti of group.teams) {
        const count = ms.filter((m) => m.left.index === ti || m.right.index === ti).length;
        assert.equal(count, n - 1, `${group.label} チーム${ti}の試合数`);
      }
    }
  }
});

test('決勝トーナメントの初戦で同組も1位同士も当たらない', () => {
  // 同組: 予選で当たった相手といきなり再戦するのは組み合わせとして良くない。
  // 1位同士: 予選1位の利点が消える。同組だけを見て直すとこちらが壊れる。
  let checked = 0;
  for (let teams = 8; teams <= 20; teams++) {
    for (let groups = 2; groups <= Math.floor(teams / 3); groups++) {
      let t;
      try { t = buildGroupStage({ teams, groups }); } catch { continue; }
      checked += 1;
      for (const m of t.matches.filter((x) => x.stage === 'knockout' && x.roundNo === 1)) {
        if (m.left.type !== 'groupRank' || m.right.type !== 'groupRank') continue;
        assert.notEqual(m.left.group, m.right.group, `${teams}人${groups}組 ${m.label}: 同じ組同士`);
        assert.ok(!(m.left.rank === 1 && m.right.rank === 1), `${teams}人${groups}組 ${m.label}: 1位同士`);
      }
    }
  }
  assert.ok(checked > 30, `検査した構成が少なすぎる: ${checked}`);
});

test('不戦勝が入る構成では1位が初戦を免除される', () => {
  // 12人3組は6チーム進出で8枠。余る2枠は1位に回す。
  const t = buildGroupStage({ teams: 12, groups: 3 });
  const first = t.matches.filter((m) => m.stage === 'knockout' && m.roundNo === 1);
  const playing = first.flatMap((m) => [m.left, m.right]).filter((r) => r.type === 'groupRank');
  const topsPlaying = playing.filter((r) => r.rank === 1).length;
  assert.ok(topsPlaying < 3, `1位が${topsPlaying}チーム初戦に出ている（免除されていない）`);
});

test('1組3チーム未満や進出過多は拒否する', () => {
  assert.throws(() => buildGroupStage({ teams: 8, groups: 4 }), /1組2チーム/);
  assert.throws(() => buildGroupStage({ teams: 8, groups: 2, advancePerGroup: 4 }), /予選で落ちるチームがほとんど出ません/);
});

test('順位表の数式が組ごとに独立した範囲を見る', () => {
  const t = buildGroupStage({ teams: 8, groups: 2 });
  t.scoring = 'sets-of-3';
  const g = new Grid('試合管理');
  const blocks = writeStandings(g, t);
  assert.equal(blocks.length, 2);
  const a = groupMatchRows(t, 0);
  const b = groupMatchRows(t, 1);
  assert.ok(a.last < b.first, '組の試合行が混ざっている');
  // 勝数の集計が自分の組の範囲だけを見る
  const winsA = g.cells.get(`${blocks[0].top},2`).value;
  assert.ok(winsA.includes(`$E$${a.first}:$E$${a.last}`), `A組の集計範囲が違う: ${winsA}`);
  const winsB = g.cells.get(`${blocks[1].top},2`).value;
  assert.ok(winsB.includes(`$E$${b.first}:$E$${b.last}`), `B組の集計範囲が違う: ${winsB}`);
});

test('順位は 勝数 → 直接対決 → セット率 の重みで決まる', () => {
  const t = buildGroupStage({ teams: 8, groups: 2 });
  t.scoring = 'sets-of-3';
  const g = new Grid('試合管理');
  const blocks = writeStandings(g, t);
  const score = g.cells.get(`${blocks[0].top},6`).value;
  // 勝数の重みが直接対決より3桁大きく、直接対決はセット率より効く
  assert.match(score, /\*1000000\+/, '勝数の重み');
  assert.match(score, /\*1000\+/, '直接対決の重み');
  assert.match(score, /IFERROR\(C\d+\/MAX\(D\d+,1\),0\)/, 'セット率');
});

test('勝敗のみの方式ではセット率を計算しない', () => {
  const t = buildGroupStage({ teams: 8, groups: 2 });
  t.scoring = 'win-loss';
  const g = new Grid('試合管理');
  const blocks = writeStandings(g, t);
  // 取得・失セットは 0 のまま（比較に効かない）
  assert.equal(g.cells.get(`${blocks[0].top},3`).value, '=0');
  assert.equal(g.cells.get(`${blocks[0].top},4`).value, '=0');
});

test('n位のチームを逆引きする数式が出る', () => {
  const t = buildGroupStage({ teams: 8, groups: 2 });
  t.scoring = 'sets-of-3';
  for (const [group, rank] of [[0, 1], [0, 2], [1, 1], [1, 2]]) {
    const f = groupRankFormula(t, group, rank);
    assert.match(f, /INDEX\('試合管理'!/);
    assert.match(f, new RegExp(`MATCH\\(${rank},`));
    assert.match(f, /^IFERROR\(/, '未確定のときは空にする');
  }
});

test('予選がある形式では「1敗で敗退」と書かない', async () => {
  // 予選は総当たりなので1敗しても続く。決勝Tに入ってから一発勝負になる。
  const { layoutBracketSheet, eliminationRule } = await import('../core/layout.js');
  const { buildTournament } = await import('../core/index.js');
  const t = buildTournament({ format: 'group-stage', teams: 8, courts: 2, scoring: 'sets-of-3' });
  assert.match(eliminationRule(t), /予選は各チーム3試合／決勝Tは1敗で敗退/);
  const texts = [...layoutBracketSheet(t).cells.values()].map((c) => String(c.value));
  assert.ok(!texts.some((x) => /^全\d+試合／1敗で敗退/.test(x)), '予選を無視した説明が残っている');
});

test('予選の対戦カードをトーナメント表に重複して出さない', async () => {
  // 対戦カードは進行表が持っている。順位表の下にリストを並べると二重になる。
  const { layoutBracketSheet } = await import('../core/layout.js');
  const { buildTournament } = await import('../core/index.js');
  const t = buildTournament({ format: 'group-stage', teams: 8, courts: 2, scoring: 'sets-of-3' });
  const heads = [...layoutBracketSheet(t).cells.values()]
    .filter((c) => c.col === 1 && String(c.value).startsWith('■'))
    .map((c) => String(c.value));
  const groupSections = heads.filter((h) => h.includes('予選'));
  assert.equal(groupSections.length, t.groups.length, `予選の見出しが重複: ${JSON.stringify(heads)}`);
  for (const h of groupSections) assert.match(h, /決勝トーナメントへ/, '順位表ではなく試合リストが出ている');
});

test('決勝トーナメントは予選が全部終わってから始まる', async () => {
  const { buildTournament } = await import('../core/index.js');
  for (const [teams, groups] of [[8, 2], [12, 3], [16, 4]]) {
    const t = buildTournament({ format: 'group-stage', teams, groups, courts: 2, scoring: 'sets-of-3' });
    const at = new Map();
    t.slots.forEach((s, i) => s.matches.forEach((m) => at.set(m.matchId, i)));
    const lastGroup = Math.max(...t.matches.filter((m) => m.stage === 'group').map((m) => at.get(m.id)));
    const firstKo = Math.min(...t.matches.filter((m) => m.stage === 'knockout').map((m) => at.get(m.id)));
    assert.ok(lastGroup < firstKo, `${teams}人${groups}組: 予選(${lastGroup})より前に決勝T(${firstKo})が始まる`);
  }
});

test('規定で決まらないときのためのじゃんけん欄が全チームぶん出る', async () => {
  // 入力は入力用タブに集める。順位表側は表示だけで、記入欄は持たない。
  const { layoutMobileSheet, layoutBracketSheet } = await import('../core/sheets.js');
  const { buildTournament } = await import('../core/index.js');
  for (const [teams, groups] of [[8, 2], [12, 3], [16, 4], [20, 5]]) {
    const t = buildTournament({ format: 'group-stage', teams, groups, courts: 2, scoring: 'sets-of-3' });
    const g = layoutMobileSheet(t);
    const inputs = [...g.cells.values()].filter((c) => c.style.jankenOf);
    assert.equal(inputs.length, teams, `${teams}人${groups}組`);
    // 平常時は白。同着のときだけ条件付き書式で黄色くする。
    // 常時黄色だと「入力必須」に見え、規定で決まる組でも埋めたくなってしまう。
    for (const c of inputs) {
      assert.equal(c.style.role, 'optional', '常時入力欄の扱いになっている');
      assert.ok(!c.style.input, '静的な入力色が付いている');
    }
  }
});

test('じゃんけん欄の位置が表示側と参照側で一致する', async () => {
  // ここがずれると、試合管理が別のセルを読んで順位が変わってしまう。
  const { layoutMobileSheet } = await import('../core/sheets.js');
  const { buildTournament } = await import('../core/index.js');
  const { jankenRow } = await import('../core/rows.js');
  for (const [teams, groups] of [[8, 2], [12, 3], [20, 5]]) {
    const t = buildTournament({ format: 'group-stage', teams, groups, courts: 2, scoring: 'sets-of-3' });
    // レイアウト側に不一致を検出する番人が入っているので、例外なく組めれば一致している
    assert.doesNotThrow(() => layoutMobileSheet(t), `${teams}人${groups}組`);
    const g = layoutMobileSheet(t);
    const rows = [...g.cells.values()].filter((c) => c.style.jankenOf).map((c) => c.row).sort((a, b) => a - b);
    const expected = [];
    for (const group of t.groups) {
      for (let i = 0; i < group.teams.length; i++) expected.push(jankenRow(t, group.index, i));
    }
    assert.deepEqual(rows, expected.sort((a, b) => a - b));
  }
});

test('同着のときだけじゃんけん欄が色づく', async () => {
  const { buildTournament } = await import('../core/index.js');
  const { buildSpreadsheetPayload } = await import('../core/payload.js');
  const t = buildTournament({ format: 'group-stage', teams: 8, courts: 2, scoring: 'sets-of-3' });
  const rules = buildSpreadsheetPayload(t).requests
    .filter((r) => r.addConditionalFormatRule)
    .map((r) => r.addConditionalFormatRule.rule)
    .filter((r) => {
      const f = r.booleanRule.format;
      return f.backgroundColor?.red > 0.95 && f.backgroundColor?.blue < 0.9 && !f.textFormat?.foregroundColor;
    });
  // 入力用タブの記入欄と、トーナメント表側の「入力用へ行け」という合図の2箇所に出る。
  assert.equal(rules.length, t.teams * 2, 'じゃんけん欄のルール数がチーム数の2倍と合わない');
  const sheetIds = new Set(rules.map((r) => r.ranges[0].sheetId));
  assert.deepEqual([...sheetIds].sort(), [0, 2], 'トーナメント表と入力用の両方に出ていない');
  for (const r of rules) {
    const f = r.booleanRule.condition.values[0].userEnteredValue;
    // 隣の隠し列（要じゃんけんの印）を見る。条件付き書式は他シートを見られない。
    assert.doesNotMatch(f, /!/, `他シート参照が混ざっている: ${f}`);
    assert.match(f, /^=\$[A-Z]+\$\d+<>""$/, f);
  }
});

test('じゃんけんの入力が順位に効く', async () => {
  const { buildTournament } = await import('../core/index.js');
  const { Grid } = await import('../core/grid.js');
  const { writeStandings, standingsLayout } = await import('../core/standings.js');
  const t = buildTournament({ format: 'group-stage', teams: 8, courts: 2, scoring: 'sets-of-3' });
  const g = new Grid('試合管理');
  writeStandings(g, t);
  const b = standingsLayout(t)[0];
  const score = g.cells.get(`${b.top},${b.cols.score}`).value;
  // 規定分（base）に、じゃんけんの分を足して順位を出す
  assert.match(score, /^=F\d+\+IF\(G\d+="",0,\(5-G\d+\)\*0\.01\)/, score);
  const tie = g.cells.get(`${b.top},${b.cols.tie}`).value;
  assert.match(tie, /要じゃんけん/, '同着の検出が無い');
  assert.match(tie, /COUNTIF/, '同じ規定点のチーム数を数えていない');
});
