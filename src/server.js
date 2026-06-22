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
import { appendLeadToSheet, isSheetsEnabled } from './googleSheets.js';
import { isTelegramEnabled, sendTelegramLead } from './telegram.js';
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

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Avant AI Studio API',
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

  const lead = insertLead({
    ...validation.lead,
    meta: {
      userAgent: req.get('user-agent'),
      ip: req.ip,
      referrer: req.get('referer'),
      ...validation.lead.meta
    }
  });

  const integration = {
    googleSheets: 'pending',
    telegram: 'pending'
  };

  try {
    const result = await appendLeadToSheet(lead);
    integration.googleSheets = result.skipped ? 'skipped' : 'sent';
    updateLeadIntegrationStatus(lead.id, 'sheet_status', integration.googleSheets);
    addIntegrationLog(lead.id, 'google_sheets', integration.googleSheets, JSON.stringify(result));
  } catch (error) {
    integration.googleSheets = 'failed';
    updateLeadIntegrationStatus(lead.id, 'sheet_status', 'failed');
    addIntegrationLog(lead.id, 'google_sheets', 'failed', error.message);
    console.error('[Google Sheets]', error);
  }

  try {
    const result = await sendTelegramLead(lead);
    integration.telegram = result.skipped ? 'skipped' : 'sent';
    updateLeadIntegrationStatus(lead.id, 'telegram_status', integration.telegram);
    addIntegrationLog(lead.id, 'telegram', integration.telegram, JSON.stringify(result));
  } catch (error) {
    integration.telegram = 'failed';
    updateLeadIntegrationStatus(lead.id, 'telegram_status', 'failed');
    addIntegrationLog(lead.id, 'telegram', 'failed', error.message);
    console.error('[Telegram]', error);
  }

  const savedLead = getLeadById(lead.id);

  res.status(201).json({
    ok: true,
    lead: {
      id: savedLead.id,
      publicId: savedLead.public_id,
      status: savedLead.status,
      createdAt: savedLead.created_at
    },
    integration
  });
});

app.get('/api/leads', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    stats: getStats(),
    leads: listLeads({
      limit: req.query.limit || 100,
      status: req.query.status || null
    })
  });
});

app.patch('/api/leads/:id/status', requireAdmin, (req, res) => {
  try {
    const lead = updateLeadStatus(req.params.id, req.body.status);
    res.json({ ok: true, lead });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.listen(port, () => {
  console.log(`Avant AI Studio running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
});
