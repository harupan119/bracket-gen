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
    accent: '#1F4E79',      // 見出しの文字・強調罫線
    headerFill: '#4472C4',  // 表ヘッダの帯
    headerText: '#FFFFFF',
    sectionFill: '#DCE6F1', // セクション見出しの地
    teamFill: '#DEEBF7',    // チーム名セルの地
    inputFill: '#FFF2CC',   // 入力欄（黄）
    doneFill: '#E2F0D9',    // 入力済み（緑）
    muted: '#6B7280',       // 補足テキスト
    text: '#000000',
    white: '#FFFFFF',
  },
  sizes: { title: 14, section: 12, body: 11, header: 10, note: 9 },
};

/** 役割ごとの書式。payload がこれを userEnteredFormat へ写す。 */
export const ROLES = {
  title:       { size: 'title',   bold: true },
  note:        { size: 'note',    color: 'muted' },
  section:     { size: 'section', bold: true, color: 'accent', fill: 'sectionFill' },
  tableHeader: { size: 'header',  bold: true, color: 'white', fill: 'headerFill', box: true, align: 'CENTER' },
  team:        { size: 'body',    bold: true, fill: 'teamFill', box: true, align: 'CENTER' },
  slot:        { size: 'body',    box: true, align: 'CENTER' },
  input:       { size: 'body',    bold: true, fill: 'inputFill', box: true, align: 'CENTER' },
  body:        { size: 'body',    box: true },
  label:       { size: 'body',    bold: true, box: true, align: 'CENTER' },
};
