const SHEET_NAME = 'Leads';
const TIMEZONE = 'Europe/Kyiv';
const DATE_FORMAT = 'dd.MM.yyyy HH:mm';
const MESSAGE_COLUMN_WIDTH = 273;
const MESSAGE_ROW_HEIGHT = 28;

const HEADERS = [
  'Created At',
  'Public ID',
  'Lead ID',
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
    return json({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    ss.setSpreadsheetTimeZone(TIMEZONE);
  } catch (error) {
    // Not critical. Formatting still works even if timezone cannot be changed.
  }

  let sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  ensureHeaders(sheet);
  formatSheet(sheet);

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
    sheet
      .getRange(1, current.filter(Boolean).length + 1, 1, missing.length)
      .setValues([missing]);
  }

  sheet.setFrozenRows(1);
}

function getHeaderMap(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);

  return headers.reduce((acc, header, index) => {
    acc[header] = index + 1;
    return acc;
  }, {});
}

function displayNiche(value) {
  const map = {
    clinic: 'Клініка / стоматологія',
    beauty: 'Салон краси',
    education: 'Онлайн-школа',
    service: 'Сервісна компанія',
    sales: 'Відділ продажів',
    other: 'Інший бізнес'
  };

  return map[value] || value || '';
}

function displayStatus(value) {
  const map = {
    new: 'Нова',
    in_progress: 'В роботі',
    closed: 'Закрита',
    cancelled: 'Скасована'
  };

  return map[value] || value || '';
}

function displayQuality(value) {
  const map = {
    hot: 'Hot lead',
    warm: 'Warm lead',
    cold: 'Cold lead'
  };

  return map[value] || value || '';
}

function normalizeIsoDate(value) {
  if (!value) return new Date();

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }

  const raw = String(value).trim();

  // Supabase может вернуть microseconds:
  // 2026-06-23T08:31:11.837616+00:00
  // JS Date нормально читает milliseconds, поэтому лишние цифры убираем.
  const normalized = raw.replace(/(\.\d{3})\d+/, '$1');
  const parsed = new Date(normalized);

  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date();
}

function prepareMessageForSheet(value) {
  return String(value || '')
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getValue(lead, keys, fallback) {
  for (const key of keys) {
    if (
      lead &&
      lead[key] !== undefined &&
      lead[key] !== null &&
      String(lead[key]).trim() !== ''
    ) {
      return lead[key];
    }
  }

  return fallback || '';
}

function formatSheet(sheet) {
  const map = getHeaderMap(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastColumn >= 1) {
    sheet
      .getRange(1, 1, 1, lastColumn)
      .setFontWeight('bold')
      .setBackground('#111827')
      .setFontColor('#ffffff')
      .setVerticalAlignment('middle');
  }

  sheet.autoResizeColumns(1, Math.min(lastColumn, HEADERS.length));

  if (map['Created At'] && lastRow >= 2) {
    sheet
      .getRange(2, map['Created At'], lastRow - 1, 1)
      .setNumberFormat(DATE_FORMAT)
      .setVerticalAlignment('middle');
  }

  if (map['Status'] && lastRow >= 2) {
    sheet
      .getRange(2, map['Status'], lastRow - 1, 1)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }

  if (map['Lead Score'] && lastRow >= 2) {
    sheet
      .getRange(2, map['Lead Score'], lastRow - 1, 1)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }

  if (map['Message']) {
    sheet.setColumnWidth(map['Message'], MESSAGE_COLUMN_WIDTH);

    if (lastRow >= 2) {
      sheet
        .getRange(2, map['Message'], lastRow - 1, 1)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
        .setVerticalAlignment('middle');

      sheet.setRowHeights(2, lastRow - 1, MESSAGE_ROW_HEIGHT);
    }
  }
}

function appendLead(lead) {
  const sheet = getSheet();
  const map = getHeaderMap(sheet);
  const source = lead.source_details || {};

  const createdAt = normalizeIsoDate(
    getValue(lead, ['created_at', 'createdAt'], new Date())
  );

  const row = [];

  row[map['Created At'] - 1] = createdAt;
  row[map['Public ID'] - 1] = getValue(lead, ['public_id', 'publicId'], '');
  row[map['Lead ID'] - 1] = getValue(lead, ['id'], '');
  row[map['Name'] - 1] = getValue(lead, ['name'], '');
  row[map['Contact'] - 1] = getValue(lead, ['contact'], '');
  row[map['Niche'] - 1] = displayNiche(getValue(lead, ['niche'], ''));
  row[map['Status'] - 1] = displayStatus(getValue(lead, ['status'], 'new'));
  row[map['Lead Score'] - 1] = getValue(lead, ['lead_score'], '');
  row[map['Lead Quality'] - 1] = displayQuality(
    getValue(lead, ['lead_score_label', 'lead_score_title'], '')
  );
  row[map['Source'] - 1] = source.utm_source || getValue(lead, ['source'], 'website');
  row[map['Page'] - 1] = source.page || getValue(lead, ['page'], '');
  row[map['Message'] - 1] = prepareMessageForSheet(getValue(lead, ['message'], ''));
  row[map['Language'] - 1] = getValue(lead, ['language'], 'uk');
  row[map['Sheet Status'] - 1] = getValue(lead, ['sheet_status'], '');
  row[map['Telegram Status'] - 1] = getValue(lead, ['telegram_status'], '');

  sheet.appendRow(row);

  const appendedRow = sheet.getLastRow();

  if (map['Created At']) {
    sheet
      .getRange(appendedRow, map['Created At'])
      .setNumberFormat(DATE_FORMAT);
  }

  formatSheet(sheet);

  return {
    ok: true,
    action: 'appendLead',
    row: appendedRow,
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

  const ids = sheet
    .getRange(2, publicIdColumn, lastRow - 1, 1)
    .getValues();

  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(publicId)) {
      const row = i + 2;

      sheet
        .getRange(row, statusColumn)
        .setValue(displayStatus(status));

      formatSheet(sheet);

      return {
        ok: true,
        action: 'updateStatus',
        row,
        publicId,
        status
      };
    }
  }

  return {
    ok: false,
    error: `Lead ${publicId} not found in sheet`
  };
}

// Запусти вручную один раз после замены Code.gs.
// Исправляет старые технические значения в существующих строках.
function fixExistingDisplayValues() {
  const sheet = getSheet();
  const map = getHeaderMap(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  if (map['Message']) {
    const messageRange = sheet.getRange(2, map['Message'], lastRow - 1, 1);
    const messages = messageRange
      .getValues()
      .map(([value]) => [prepareMessageForSheet(value)]);

    messageRange.setValues(messages);
  }

  if (map['Status']) {
    const statusRange = sheet.getRange(2, map['Status'], lastRow - 1, 1);
    const statuses = statusRange
      .getValues()
      .map(([value]) => [displayStatus(value)]);

    statusRange.setValues(statuses);
  }

  if (map['Niche']) {
    const nicheRange = sheet.getRange(2, map['Niche'], lastRow - 1, 1);
    const niches = nicheRange
      .getValues()
      .map(([value]) => [displayNiche(value)]);

    nicheRange.setValues(niches);
  }

  if (map['Lead Quality']) {
    const qualityRange = sheet.getRange(2, map['Lead Quality'], lastRow - 1, 1);
    const qualities = qualityRange
      .getValues()
      .map(([value]) => [displayQuality(value)]);

    qualityRange.setValues(qualities);
  }

  formatSheet(sheet);
}

// Запусти вручную, если старые даты ещё отображаются как ISO.
function fixExistingCreatedAtDates() {
  const sheet = getSheet();
  const map = getHeaderMap(sheet);

  if (!map['Created At']) {
    throw new Error('Created At column not found');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const range = sheet.getRange(2, map['Created At'], lastRow - 1, 1);
  const values = range.getValues();
  const fixed = values.map(([value]) => [normalizeIsoDate(value)]);

  range.setValues(fixed);
  range.setNumberFormat(DATE_FORMAT);

  formatSheet(sheet);
}

// Запусти вручную, чтобы Message был одной строкой и обрезался.
function fixMessageColumnView() {
  const sheet = getSheet();
  const map = getHeaderMap(sheet);

  if (!map['Message']) {
    throw new Error('Message column not found');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const range = sheet.getRange(2, map['Message'], lastRow - 1, 1);
  const values = range.getValues();
  const fixed = values.map(([value]) => [prepareMessageForSheet(value)]);

  range.setValues(fixed);

  range
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
    .setVerticalAlignment('middle');

  sheet.setColumnWidth(map['Message'], MESSAGE_COLUMN_WIDTH);
  sheet.setRowHeights(2, lastRow - 1, MESSAGE_ROW_HEIGHT);

  formatSheet(sheet);
}

// Можно запускать вручную в любой момент, если формат таблицы сломался.
function applySheetFormattingOnly() {
  const sheet = getSheet();
  formatSheet(sheet);
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
