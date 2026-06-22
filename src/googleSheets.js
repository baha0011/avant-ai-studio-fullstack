import { google } from 'googleapis';

function normalizePrivateKey(key = '') {
  return key.replace(/\\n/g, '\n');
}

export function isSheetsEnabled() {
  return String(process.env.GOOGLE_SHEETS_ENABLED || '').toLowerCase() === 'true';
}

export async function appendLeadToSheet(lead) {
  if (!isSheetsEnabled()) {
    return { skipped: true, reason: 'GOOGLE_SHEETS_ENABLED=false' };
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || '');
  const tab = process.env.GOOGLE_SHEET_TAB || 'Leads';

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error('Google Sheets credentials are incomplete');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const values = [[
    lead.created_at,
    lead.public_id,
    lead.name,
    lead.contact,
    lead.niche,
    lead.message,
    lead.language,
    lead.source,
    lead.status
  ]];

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });

  return {
    skipped: false,
    updatedRange: result.data.updates?.updatedRange || null
  };
}
