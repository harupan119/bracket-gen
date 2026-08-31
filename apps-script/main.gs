/**
 * bracket-gen の入口。
 *
 * 使う側の操作は「テンプレのコピーを作る → メニュー → 条件を入力」の3ステップに閉じる。
 * clasp を触るのは開発者だけで、大会を運営する人はスクリプトエディタを開かない。
 *
 * 条件付き書式の一括生成に Advanced Sheets Service を使う。
 * これは appsscript.json のマニフェストで有効化しており、
 * スプレッドシートをコピーしても引き継がれることを実測で確認済み。
 */

var SHEET_ORDER = ['bracket', 'progress', 'mobile', 'control'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('bracket-gen')
    .addItem('大会を作成', 'showDialog')
    .addSeparator()
    .addItem('接続テスト', 'probe')
    .addToUi();
}

function showDialog() {
  var html = HtmlService.createHtmlOutputFromFile('dialog')
    .setWidth(440)
    .setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, '大会を作成');
}

/** ダイアログの選択肢を、core の定義から作る（二重管理を避ける）。 */
function getOptions() {
  return {
    scoring: Object.keys(BracketGen.SCORING).map(function (k) {
      return { value: k, label: BracketGen.SCORING[k].label };
    }),
    minTeams: BracketGen.MIN_TEAMS,
    maxTeams: BracketGen.MAX_TEAMS,
    fullPlacementSizes: BracketGen.FULL_PLACEMENT_SIZES
  };
}

/**
 * ダイアログから呼ばれる本体。
 * 生成物は、いま開いているスプレッドシート（テンプレのコピー）へ直接書き込む。
 */
function generate(config) {
  var tournament = BracketGen.buildTournament(config);
  var payload = BracketGen.buildSpreadsheetPayload(tournament);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 旧版が作った「スマホ用」タブは名前を引き継ぐ。
  // 放置すると、中身の無いタブが1枚余ったまま配られてしまう。
  var legacy = ss.getSheetByName('スマホ用');
  if (legacy && !ss.getSheetByName(BracketGen.TABS.mobile)) {
    legacy.setName(BracketGen.TABS.mobile);
  }

  // 4タブを用意して中身を空にする。前回の条件付き書式が残ると累積するので明示的に消す。
  var map = {};
  payload.sheets.forEach(function (s, i) {
    var sheet = ss.getSheetByName(s.title);
    if (!sheet) {
      sheet = ss.insertSheet(s.title, i);
    } else {
      sheet.showSheet();
      sheet.clear();
      sheet.setConditionalFormatRules([]);
      var merges = sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).getMergedRanges();
      merges.forEach(function (r) { r.breakApart(); });
    }
    map[s.sheetId] = sheet.getSheetId();
  });

  Sheets.Spreadsheets.batchUpdate({ requests: remapSheetIds(payload.requests, map) }, ss.getId());

  // 試合管理タブは運営に見せない
  var control = ss.getSheetByName(BracketGen.TABS.control);
  if (control && ss.getSheets().length > 1) control.hideSheet();

  var bracket = ss.getSheetByName(BracketGen.TABS.bracket);
  if (bracket) ss.setActiveSheet(bracket);

  return {
    matches: tournament.matches.length,
    slots: tournament.slots.length,
    placements: tournament.placements,
    warnings: tournament.warnings || []
  };
}

/** payload の仮 sheetId（0〜3）を、実際のタブIDへ差し替える。 */
function remapSheetIds(value, map) {
  if (Array.isArray(value)) {
    return value.map(function (v) { return remapSheetIds(v, map); });
  }
  if (value && typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (k) {
      if (k === 'sheetId' && typeof value[k] === 'number' && map.hasOwnProperty(value[k])) {
        out[k] = map[value[k]];
      } else {
        out[k] = remapSheetIds(value[k], map);
      }
    });
    return out;
  }
  return value;
}
