export function isSheetsEnabled() {
  return String(process.env.GOOGLE_SHEETS_ENABLED || '').toLowerCase() === 'true';
}

function getAppsScriptUrl() {
  return String(process.env.GOOGLE_APPS_SCRIPT_URL || '').trim();
}

function normalizeLead(lead) {
  return {
    id: lead.id,
    public_id: lead.public_id,
    publicId: lead.public_id,
    created_at: lead.created_at,
    name: lead.name,
    contact: lead.contact,
    niche: lead.niche,
    message: lead.message,
    language: lead.language,
    page: lead.page,
    source: lead.source,
    status: lead.status,
    sheet_status: lead.sheet_status,
    telegram_status: lead.telegram_status,
    lead_score: lead.lead_score,
    lead_score_label: lead.lead_score_label,
    lead_score_title: lead.lead_score_title,
    source_details: lead.source_details || {}
  };
}

async function postToAppsScript(payload) {
  if (!isSheetsEnabled()) {
    return { skipped: true, reason: 'GOOGLE_SHEETS_ENABLED=false' };
  }

  const url = getAppsScriptUrl();

  if (!url) {
    throw new Error('GOOGLE_APPS_SCRIPT_URL is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      secret: process.env.GOOGLE_APPS_SCRIPT_SECRET || '',
      ...payload
    })
  });

  const raw = await response.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(`Apps Script returned non-JSON response: ${raw.slice(0, 160)}`);
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Apps Script request failed with HTTP ${response.status}`);
  }

  return data;
}

export async function appendLeadToSheet(lead) {
  const data = await postToAppsScript({
    action: 'appendLead',
    lead: normalizeLead(lead)
  });

  if (data.skipped) return data;

  return {
    skipped: false,
    row: data.row || null,
    publicId: data.publicId || lead.public_id,
    appsScript: true
  };
}

export async function updateLeadStatusInSheet(lead, status) {
  const data = await postToAppsScript({
    action: 'updateStatus',
    publicId: lead.public_id,
    status,
    lead: normalizeLead({ ...lead, status })
  });

  if (data.skipped) return data;

  return {
    skipped: false,
    row: data.row || null,
    publicId: data.publicId || lead.public_id,
    status,
    appsScript: true
  };
}
