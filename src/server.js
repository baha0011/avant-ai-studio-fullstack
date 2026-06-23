import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import {
  addIntegrationLog,
  getLeadById,
  getStats,
  insertLead,
  listLeads,
  updateLeadIntegrationStatus,
  updateLeadStatus
} from './db.js';
import { appendLeadToSheet, isSheetsEnabled, updateLeadStatusInSheet } from './googleSheets.js';
import {
  answerTelegramCallback,
  editTelegramLeadMessage,
  isTelegramEnabled,
  sendTelegramLead
} from './telegram.js';
import { requireAdmin, validateLead } from './validators.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

function getWebhookSecret() {
  return String(process.env.TELEGRAM_WEBHOOK_SECRET || process.env.ADMIN_TOKEN || '').trim();
}

async function syncSheetStatus(lead, status) {
  try {
    const result = await updateLeadStatusInSheet(lead, status);
    await addIntegrationLog(lead.id, 'google_sheets_status', result.skipped ? 'skipped' : 'sent', JSON.stringify(result)).catch(() => null);
    return result;
  } catch (error) {
    await addIntegrationLog(lead.id, 'google_sheets_status', 'failed', error.message).catch(() => null);
    console.error('[Google Sheets status update]', error);
    return { skipped: false, failed: true, error: error.message };
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Avant AI Studio API',
    database: 'supabase',
    integrations: {
      googleSheets: isSheetsEnabled(),
      telegram: isTelegramEnabled()
    }
  });
});

app.post('/api/leads', async (req, res) => {
  const validation = validateLead(req.body);

  if (!validation.ok) {
    return res.status(400).json({ ok: false, errors: validation.errors });
  }

  let lead;

  try {
    lead = await insertLead({
      ...validation.lead,
      meta: {
        userAgent: req.get('user-agent'),
        ip: req.ip,
        referrer: req.get('referer'),
        ...validation.lead.meta
      }
    });
  } catch (error) {
    console.error('[Database]', error);
    return res.status(500).json({ ok: false, error: 'Failed to save lead' });
  }

  const integration = {
    googleSheets: 'pending',
    telegram: 'pending'
  };

  try {
    const result = await appendLeadToSheet(lead);
    integration.googleSheets = result.skipped ? 'skipped' : 'sent';
    await updateLeadIntegrationStatus(lead.id, 'sheet_status', integration.googleSheets);
    await addIntegrationLog(lead.id, 'google_sheets', integration.googleSheets, JSON.stringify(result));
  } catch (error) {
    integration.googleSheets = 'failed';
    await updateLeadIntegrationStatus(lead.id, 'sheet_status', 'failed').catch(() => null);
    await addIntegrationLog(lead.id, 'google_sheets', 'failed', error.message).catch(() => null);
    console.error('[Google Sheets]', error);
  }

  try {
    const result = await sendTelegramLead(lead);
    integration.telegram = result.skipped ? 'skipped' : 'sent';
    await updateLeadIntegrationStatus(lead.id, 'telegram_status', integration.telegram);
    await addIntegrationLog(lead.id, 'telegram', integration.telegram, JSON.stringify(result));
  } catch (error) {
    integration.telegram = 'failed';
    await updateLeadIntegrationStatus(lead.id, 'telegram_status', 'failed').catch(() => null);
    await addIntegrationLog(lead.id, 'telegram', 'failed', error.message).catch(() => null);
    console.error('[Telegram]', error);
  }

  const savedLead = await getLeadById(lead.id);

  res.status(201).json({
    ok: true,
    lead: {
      id: savedLead.id,
      publicId: savedLead.public_id,
      status: savedLead.status,
      leadScore: savedLead.lead_score,
      leadScoreLabel: savedLead.lead_score_label,
      createdAt: savedLead.created_at
    },
    integration
  });
});

app.get('/api/leads', requireAdmin, async (req, res) => {
  try {
    const [stats, leads] = await Promise.all([
      getStats(),
      listLeads({
        limit: req.query.limit || 100,
        status: req.query.status || null,
        q: req.query.q || ''
      })
    ]);

    res.json({ ok: true, stats, leads });
  } catch (error) {
    console.error('[Admin leads]', error);
    res.status(500).json({ ok: false, error: 'Failed to load leads' });
  }
});

app.patch('/api/leads/:id/status', requireAdmin, async (req, res) => {
  try {
    const lead = await updateLeadStatus(req.params.id, req.body.status);
    const sheet = await syncSheetStatus(lead, req.body.status);
    res.json({ ok: true, lead, sheet });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.post('/api/telegram/webhook/:secret', async (req, res) => {
  const expectedSecret = getWebhookSecret();

  if (!expectedSecret || req.params.secret !== expectedSecret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized webhook' });
  }

  const callback = req.body?.callback_query;
  if (!callback?.data) {
    return res.json({ ok: true, ignored: true });
  }

  const match = String(callback.data).match(/^lead_status:([^:]+):(new|in_progress|closed|cancelled)$/);
  if (!match) {
    await answerTelegramCallback(callback.id, 'Невідома дія', true);
    return res.json({ ok: true, ignored: true });
  }

  const [, leadId, status] = match;

  try {
    const lead = await updateLeadStatus(leadId, status);
    await syncSheetStatus(lead, status);
    await answerTelegramCallback(callback.id, `Статус оновлено: ${status}`);
    await editTelegramLeadMessage(lead, callback.message);
    return res.json({ ok: true, leadId, status });
  } catch (error) {
    console.error('[Telegram webhook]', error);
    await answerTelegramCallback(callback.id, `Помилка: ${error.message}`, true);
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.listen(port, () => {
  console.log(`Avant AI Studio running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
});
