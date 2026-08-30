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
// base は「3段の判定だけで出した点」。同着の検出に使う。
// janken は運営がトーナメント表側で入れる、じゃんけんの順位（1が勝ち）。
const COLS = { team: 1, wins: 2, got: 3, lost: 4, h2h: 5, base: 6, janken: 7, tie: 8, score: 9, rank: 10, beat: 12 };

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

      // 3段を1つの数値へ畳む。ここまでが「規定で決まる分」。
      const ratio = `IFERROR(${col(cols.got)}${r}/MAX(${col(cols.lost)}${r},1),0)`;
      g.set(r, cols.base,
        `=${col(cols.wins)}${r}*${W_WEIGHT}+${col(cols.h2h)}${r}*${H2H_WEIGHT}+${ratio}*10`,
        { helper: true });

      // 3段すべてで並んだら規定では決まらない。運営がじゃんけんで決める。
      const baseRange = `${col(cols.base)}$${top}:${col(cols.base)}$${top + n - 1}`;
      g.set(r, cols.tie,
        `=IF(COUNTIF(${baseRange},${col(cols.base)}${r})>1,"要じゃんけん","")`,
        { helper: true });

      // じゃんけんの結果はトーナメント表の入力欄から引く（運営が見て入れる場所）
      g.set(r, cols.janken, `=IFERROR(${jankenInput(tournament, block.group, i)},"")`, { helper: true });

      // 入力があればそれで分ける。無ければ記号順で仮に分ける（順位が空になるのを避けるため）。
      const jk = `IF(${col(cols.janken)}${r}="",0,(${n + 1}-${col(cols.janken)}${r})*0.01)`;
      g.set(r, cols.score, `=${col(cols.base)}${r}+${jk}-${i}*0.0001`, { helper: true });

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

/** じゃんけん入力欄の位置。トーナメント表の予選順位表に置く。 */
export function jankenInput(tournament, groupIndex, memberIndex) {
  const row = jankenRow(tournament, groupIndex, memberIndex);
  return `'${TABS.bracket}'!$F$${row}`;
}

/**
 * トーナメント表側の順位表は「見出し2行 + チーム行」で組み、組ごとに1行あけて並べる。
 * 入力欄を試合管理から参照するので、双方で同じ行計算を使う必要がある。
 */
export function jankenRow(tournament, groupIndex, memberIndex) {
  let row = STANDINGS_DISPLAY_START;
  for (const group of tournament.groups) {
    row += 2; // 見出しと表ヘッダ
    if (group.index === groupIndex) return row + memberIndex;
    row += group.teams.length + 1;
  }
  throw new Error(`組が見つかりません: ${groupIndex}`);
}

/**
 * トーナメント表で順位表が始まる行。
 * タイトル・説明の2行を書いたあと1行あけるので4行目から。
 * ここを定数で持つと表示側とずれるため、レイアウト側と同じ根拠を1箇所に置く。
 */
export const STANDINGS_DISPLAY_START = 4;

function col(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
