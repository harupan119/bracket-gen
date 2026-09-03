/**
 * 見た目の規則。実物 8team_volleyball_base.xlsx から抽出した配色・字送りをそのまま採る。
 *
 * 「素朴に見える」の正体は、罫線・地色・フォント指定が無いこと。
 * セルに役割（role）を持たせ、ここで一括して装飾を決める。
 */
export const THEME = {
  font: 'Hiragino Sans',
  colors: {
    grid: '#9CA3AF',        // 細い格子罫線
    line: '#202124',        // ブラケットの枝線（格子より濃くして経路を目立たせる）
    accent: '#1F4E79',      // 見出しの文字・強調罫線
    headerFill: '#4472C4',  // 表ヘッダの帯
    headerText: '#FFFFFF',
    sectionFill: '#DCE6F1', // セクション見出しの地
    teamFill: '#DEEBF7',    // チーム名セルの地
    inputFill: '#FFF2CC',   // 入力欄（黄）
    doneFill: '#E2F0D9',    // 入力済み（緑）
    muted: '#6B7280',       // 補足テキスト
    disabledFill: '#F2F3F5', // 使わない枠の地。白のままだと記入できる欄に見える
    text: '#000000',
    white: '#FFFFFF',
  },
  sizes: { title: 14, section: 12, body: 11, header: 10, note: 9 },
};

/** 役割ごとの書式。payload がこれを userEnteredFormat へ写す。 */
/** 色成分は4桁で丸める。19桁の浮動小数を持つとペイロードが無駄に膨らむ。見た目は変わらない。 */
export function toRgb(hex) {
  const h = hex.replace('#', '');
  const at = (i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 10000) / 10000;
  return { red: at(0), green: at(2), blue: at(4) };
}

export const ROLES = {
  title:       { size: 'title',   bold: true },
  note:        { size: 'note',    color: 'muted' },
  section:     { size: 'section', bold: true, color: 'accent', fill: 'sectionFill' },
  tableHeader: { size: 'header',  bold: true, color: 'white', fill: 'headerFill', box: true, align: 'CENTER' },
  // wrap: 長いチーム名を枠の中で折り返す。既定の OVERFLOW_CELL のままだと、
  // 実名が列幅（150px ＝ 全角10文字ぶん）を超えたとき、隣の連結列へ文字が溢れて
  // ブラケットの罫線の上に重なる。CLIP だと名前が切れてどのチームか分からなくなる。
  team:        { size: 'body',    bold: true, fill: 'teamFill', box: true, align: 'CENTER', wrap: true },
  slot:        { size: 'body',    box: true, align: 'CENTER', wrap: true },
  // TEXT書式は必須。無いと "2-1" が日付として解釈され、勝敗判定の文字列比較が黙って外れる。
  input:       { size: 'body',    bold: true, fill: 'inputFill', box: true, align: 'CENTER', text: true, wrap: true },
  body:        { size: 'body',    box: true },
  label:       { size: 'body',    bold: true, box: true, align: 'CENTER' },
  // 平常時は白。同着が起きたときだけ条件付き書式で黄色くする。
  // 常時黄色だと「入力必須」に見えてしまう。
  optional:    { size: 'body',    bold: true, box: true, align: 'CENTER', text: true },
  // 進行表の行の意味（試合／対戦／結果／勝者）。表ヘッダの濃紺を使うと、
  // 全枠ぶん縦に続いて太い柱になり、肝心の対戦カードより目立ってしまう。
  rowLabel:    { size: 'header',  bold: true, color: 'accent', box: true, align: 'CENTER' },
  // その枠で使わないコート。白い空欄のままだと記入できる欄に見える。
  unused:      { size: 'body',    color: 'muted', fill: 'disabledFill', box: true, align: 'CENTER' },
  // 試合番号。連結列のひとつ左に右寄せで置き、線と勝者の箱へ視線をつなぐ。
  // 箱の役割ではないので地色も枠線も付けない。字は実物と同じ 11pt 太字のアクセント色。
  // 9pt のグレーにしていたときは、離れて見ると番号だけ沈んで読めなかった。
  matchNo:     { size: 'body',    bold: true, color: 'accent', align: 'RIGHT' },
  // シード印。チーム名の文字列に足すと勝ち上がり判定の文字列比較が外れるので、左隣に置く。
  // 中央寄せだと 67px の列の真ん中に浮き、どの箱に付いた印か離れて見ると分からない。
  seed:        { size: 'body',    bold: true, color: 'accent', align: 'RIGHT' },
};
