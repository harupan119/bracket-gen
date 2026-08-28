/**
 * 配布方式の可否を確かめるプローブ。
 *
 * bracket-gen は条件付き書式を一括生成するため Advanced Sheets Service
 * （Sheets.Spreadsheets.batchUpdate）に依存する。Q14/Q30 で決めた
 * 「テンプレSheetsをコピーして配る」方式が成立するかは、
 * このサービスがコピー先でも有効かどうかで決まる。
 *
 * 成功すると batchUpdate 自身が Z1 に ADVANCED_OK を書き込む。
 * 失敗したら SpreadsheetApp 経由で ADVANCED_NG と例外メッセージを残す。
 * どちらもセルに残るので、あとから API で読み取って判定できる。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('bracket-gen')
    .addItem('接続テスト', 'probe')
    .addToUi();
}

function probe() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  try {
    Sheets.Spreadsheets.batchUpdate(
      {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: sheet.getSheetId(),
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 25,
                endColumnIndex: 26
              },
              rows: [{ values: [{ userEnteredValue: { stringValue: 'ADVANCED_OK ' + stamp } }] }],
              fields: 'userEnteredValue'
            }
          }
        ]
      },
      ss.getId()
    );
  } catch (e) {
    sheet.getRange('Z1').setValue('ADVANCED_NG ' + stamp + ' / ' + e.message);
  }
}
