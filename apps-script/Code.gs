const SHEET_NAME = 'Leads';

const HEADERS = [
  'Created At',
  'Public ID',
  'Name',
  'Contact',
  'Niche',
  'Status',
  'Lead Score',
  'Lead Quality',
  'Source',
  'Page',
  'Message',
  'Language',
  'Sheet Status',
  'Telegram Status'
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action || (payload.lead ? 'appendLead' : '');

    if (action === 'updateStatus') {
      return json(updateStatus(payload.publicId, payload.status));
    }

    if (action === 'appendLead') {
      return json(appendLead(payload.lead));
    }

    return json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return json({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  if (existing.filter(Boolean).length === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const current = existing.map(String);
  const missing = HEADERS.filter((header) => !current.includes(header));

  if (missing.length) {
    sheet.getRange(1, current.filter(Boolean).length + 1, 1, missing.length).setValues([missing]);
  }

  sheet.setFrozenRows(1);
}

function getHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  return headers.reduce((acc, header, index) => {
    acc[header] = index + 1;
    return acc;
  }, {});
}

function getValue(lead, keys, fallback) {
  for (const key of keys) {
    if (lead && lead[key] !== undefined && lead[key] !== null && String(lead[key]).trim() !== '') {
      return lead[key];
    }
  }
  return fallback || '';
}

function appendLead(lead) {
  const sheet = getSheet();
  const map = getHeaderMap(sheet);
  const source = lead.source_details || {};

  const row = [];
  row[map['Created At'] - 1] = getValue(lead, ['created_at', 'createdAt'], new Date());
  row[map['Public ID'] - 1] = getValue(lead, ['public_id', 'publicId'], '');
  row[map['Name'] - 1] = getValue(lead, ['name'], '');
  row[map['Contact'] - 1] = getValue(lead, ['contact'], '');
  row[map['Niche'] - 1] = getValue(lead, ['niche'], '');
  row[map['Status'] - 1] = getValue(lead, ['status'], 'new');
  row[map['Lead Score'] - 1] = getValue(lead, ['lead_score'], '');
  row[map['Lead Quality'] - 1] = getValue(lead, ['lead_score_label', 'lead_score_title'], '');
  row[map['Source'] - 1] = source.utm_source || getValue(lead, ['source'], 'website');
  row[map['Page'] - 1] = source.page || getValue(lead, ['page'], '');
  row[map['Message'] - 1] = getValue(lead, ['message'], '');
  row[map['Language'] - 1] = getValue(lead, ['language'], 'uk');
  row[map['Sheet Status'] - 1] = getValue(lead, ['sheet_status'], '');
  row[map['Telegram Status'] - 1] = getValue(lead, ['telegram_status'], '');

  sheet.appendRow(row);

  return {
    ok: true,
    action: 'appendLead',
    row: sheet.getLastRow(),
    publicId: row[map['Public ID'] - 1]
  };
}

function updateStatus(publicId, status) {
  const sheet = getSheet();
  const map = getHeaderMap(sheet);

  if (!publicId) {
    return { ok: false, error: 'publicId is required' };
  }

  const publicIdColumn = map['Public ID'];
  const statusColumn = map['Status'];

  if (!publicIdColumn || !statusColumn) {
    return { ok: false, error: 'Public ID or Status column not found' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { ok: false, error: 'No leads found' };
  }

  const ids = sheet.getRange(2, publicIdColumn, lastRow - 1, 1).getValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(publicId)) {
      const row = i + 2;
      sheet.getRange(row, statusColumn).setValue(status);
      return { ok: true, action: 'updateStatus', row, publicId, status };
    }
  }

  return { ok: false, error: `Lead ${publicId} not found in sheet` };
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
