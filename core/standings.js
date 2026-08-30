import { TABS, cellRefs } from './sheets.js';
import { getScoring } from './scoring.js';

/**
 * 予選の順位表を組み立てる。
 *
 * 順位は 勝数 → 直接対決 → セット率 の3段で決める。
 * 直接対決は「自分と同じ勝数のチームに何勝したか」で測る。
 * 総当たりの結果から、誰が誰に勝ったかの表（勝敗行列）を先に作り、
 * そこから「並んでいる相手だけ」を抜き出して数える。
 * この作り方なら3チーム以上が並んでも破綻しない（巴戦なら全員同数になり、次のセット率へ落ちる）。
 *
 * 順位は RANK ではなく、3段をひとつの数値へ畳んだ得点で決める。
 * 数値ひとつなら順位付けも「n位のチーム」の逆引きも素直に書ける。
 */

// 得点の桁割り。勝数が最優先、次に直接対決、最後にセット率。
const W_WEIGHT = 1e6;
const H2H_WEIGHT = 1e3;

const GAP = 2;
const COLS = { team: 1, wins: 2, got: 3, lost: 4, h2h: 5, score: 6, rank: 7, beat: 9 };

/**
 * 順位表の配置を、グリッドを作らずに算出する。
 * ブラケットの出場者（「A組1位」）も順位表を参照するので、
 * 書き込む側と参照する側で同じ計算を使う必要がある。
 */
export function standingsLayout(tournament) {
  // 試合行の直後から始める
  let row = cellRefs.controlRow(tournament.matches.length) + GAP;
  return tournament.groups.map((group) => {
    const block = { group: group.index, label: group.label, head: row, top: row + 1, size: group.teams.length, cols: COLS };
    row = block.top + block.size + GAP;
    return block;
  });
}

/** 組の予選試合が試合管理タブの何行目から何行目までにあるか。 */
export function groupMatchRows(tournament, groupIndex) {
  const idx = tournament.matches
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.stage === 'group' && m.group === groupIndex)
    .map(({ i }) => cellRefs.controlRow(i));
  return { first: Math.min(...idx), last: Math.max(...idx) };
}

/**
 * 順位表のブロックを試合管理タブへ書く。非表示タブなので見た目は問わない。
 * 返り値は、各組の先頭行と列の対応。トーナメント表側はここを参照する。
 */
export function writeStandings(g, tournament) {
  const sc = getScoring(tournament.scoring);
  const hasSets = sc.options.some((o) => /^\d+-\d+$/.test(o));
  const blocks = standingsLayout(tournament);

  for (const block of blocks) {
    const group = tournament.groups[block.group];
    const { first, last } = groupMatchRows(tournament, group.index);
    const n = block.size;
    const { head, top, cols } = block;

    g.set(head, cols.team, `${group.label} 順位表`, { helper: true });

    group.teams.forEach((teamIndex, i) => {
      const r = top + i;
      const me = `$A$${r}`;
      const name = cellRefs.teamName(teamIndex);
      g.set(r, cols.team, `=${name}`, { helper: true });

      // 勝数
      g.set(r, cols.wins, `=COUNTIF($E$${first}:$E$${last},${col(cols.team)}${r})`, { helper: true });

      if (hasSets) {
        // 取得セット: 自分が左なら結果の左側、右なら右側を足す
        g.set(r, cols.got,
          `=SUMPRODUCT(($B$${first}:$B$${last}=${col(cols.team)}${r})*IFERROR(VALUE(LEFT($D$${first}:$D$${last},1)),0))` +
          `+SUMPRODUCT(($C$${first}:$C$${last}=${col(cols.team)}${r})*IFERROR(VALUE(RIGHT($D$${first}:$D$${last},1)),0))`,
          { helper: true });
        g.set(r, cols.lost,
          `=SUMPRODUCT(($B$${first}:$B$${last}=${col(cols.team)}${r})*IFERROR(VALUE(RIGHT($D$${first}:$D$${last},1)),0))` +
          `+SUMPRODUCT(($C$${first}:$C$${last}=${col(cols.team)}${r})*IFERROR(VALUE(LEFT($D$${first}:$D$${last},1)),0))`,
          { helper: true });
      } else {
        g.set(r, cols.got, '=0', { helper: true });
        g.set(r, cols.lost, '=0', { helper: true });
      }

      // 勝敗行列: この行のチームが、各列のチームに勝った数
      for (let j = 0; j < n; j++) {
        const opp = `${col(cols.team)}${top + j}`;
        g.set(r, cols.beat + j,
          i === j ? '=0'
            : `=SUMPRODUCT(($E$${first}:$E$${last}=${col(cols.team)}${r})*` +
              `(($B$${first}:$B$${last}=${opp})+($C$${first}:$C$${last}=${opp})))`,
          { helper: true });
      }

      // 直接対決: 自分と同じ勝数の相手にいくつ勝ったか
      const beatRange = `${col(cols.beat)}${r}:${col(cols.beat + n - 1)}${r}`;
      const winsRange = `${col(cols.wins)}$${top}:${col(cols.wins)}$${top + n - 1}`;
      g.set(r, cols.h2h,
        `=SUMPRODUCT(${beatRange},TRANSPOSE(N(${winsRange}=${col(cols.wins)}${r})))`,
        { helper: true });

      // 3段を1つの数値へ畳む。末尾の微小項は完全同着を記号順で分けるため。
      const ratio = `IFERROR(${col(cols.got)}${r}/MAX(${col(cols.lost)}${r},1),0)`;
      g.set(r, cols.score,
        `=${col(cols.wins)}${r}*${W_WEIGHT}+${col(cols.h2h)}${r}*${H2H_WEIGHT}+${ratio}-${i}*0.0001`,
        { helper: true });

      const scoreRange = `${col(cols.score)}$${top}:${col(cols.score)}$${top + n - 1}`;
      g.set(r, cols.rank, `=RANK(${col(cols.score)}${r},${scoreRange})`, { helper: true });
    });

  }
  return blocks;
}

/** 「A組1位」のチーム名を引く数式。 */
export function groupRankFormula(tournament, groupIndex, rank) {
  const b = standingsLayout(tournament).find((x) => x.group === groupIndex);
  const teams = `'${TABS.control}'!${col(b.cols.team)}$${b.top}:${col(b.cols.team)}$${b.top + b.size - 1}`;
  const ranks = `'${TABS.control}'!${col(b.cols.rank)}$${b.top}:${col(b.cols.rank)}$${b.top + b.size - 1}`;
  return `IFERROR(INDEX(${teams},MATCH(${rank},${ranks},0)),"")`;
}

function col(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
