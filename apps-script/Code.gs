// Paste the ID of the exact Google Sheet where leads must be saved.
// Example: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'Leads';

function doGet() {
  const spreadsheet = getTargetSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME);
  ensureHeader(sheet);

  return jsonResponse({
    ok: true,
    service: 'Avant AI Studio Google Sheets bridge',
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheet: sheet.getName(),
    lastRow: sheet.getLastRow()
  });
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const lead = body.lead || body;
    const spreadsheet = getTargetSpreadsheet();
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
      publicId: lead.public_id || lead.publicId || '',
      spreadsheetName: spreadsheet.getName(),
      spreadsheetUrl: spreadsheet.getUrl(),
      sheet: sheet.getName()
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function getTargetSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Spreadsheet is not configured. Set SPREADSHEET_ID in Apps Script.');
  }

  return spreadsheet;
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
