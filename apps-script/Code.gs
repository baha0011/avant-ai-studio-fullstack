const SHEET_NAME = 'Leads';

function doGet() {
  return jsonResponse({
    ok: true,
    service: 'Avant AI Studio Google Sheets bridge',
    sheet: SHEET_NAME
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const lead = body.lead || body;
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME);

    ensureHeader(sheet);

    sheet.appendRow([
      lead.created_at || new Date().toISOString(),
      lead.public_id || lead.publicId || '',
      lead.name || '',
      lead.contact || '',
      lead.niche || '',
      lead.message || '',
      lead.language || '',
      lead.source || '',
      lead.status || 'new',
      lead.page || '',
      lead.id || ''
    ]);

    return jsonResponse({
      ok: true,
      row: sheet.getLastRow(),
      publicId: lead.public_id || lead.publicId || ''
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function getOrCreateSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'Created At',
    'Lead ID',
    'Name',
    'Contact',
    'Niche',
    'Message',
    'Language',
    'Source',
    'Status',
    'Page',
    'Internal ID'
  ]);

  sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
