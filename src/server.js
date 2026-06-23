import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import {
  clearSessionCookie,
  createSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  safeAdminUser,
  sessionCookie,
  verifyPassword
} from './auth.js';

import {
  addIntegrationLog,
  assignLeadToAdmin,
  countAdminUsers,
  createAdminSession,
  createAdminUser,
  deleteAdminSessionByTokenHash,
  deleteAdminUser,
  deleteExpiredAdminSessions,
  getAdminSessionByTokenHash,
  getAdminUserByEmail,
  getAdminUserById,
  getLeadById,
  getLeadLogs,
  getStats,
  listAdminUsers,
  insertLead,
  listLeads,
  updateAdminUser,
  updateLeadIntegrationStatus,
  updateLeadSalesStage,
  updateLeadStatus
} from './db.js';
import { appendLeadToSheet, isSheetsEnabled, updateLeadStatusInSheet } from './googleSheets.js';
import {
  answerTelegramCallback,
  editTelegramLeadMessage,
  isTelegramEnabled,
  sendTelegramLead
} from './telegram.js';
import { cleanText, validateLead } from './validators.js';
import {
  addSmmSendLog,
  createSmmTarget,
  deleteSmmTarget,
  getSmmTargetById,
  listSmmSendLogs,
  listSmmTargets,
  updateSmmTarget
} from './smmDb.js';
import { analyzeWebsiteTarget } from './smmAnalyzer.js';
import { buildLeadAiInsights, SALES_STAGE_META } from './crmAi.js';

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

const ADMIN_SESSION_DAYS = 14;
const ADMIN_SESSION_MAX_AGE_SECONDS = ADMIN_SESSION_DAYS * 24 * 60 * 60;

async function getAdminUserFromRequest(req) {
  const token = getSessionTokenFromRequest(req);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const result = await getAdminSessionByTokenHash(tokenHash);

  if (!result) return null;
  return result.user;
}

async function requireAdminSession(req, res, next) {
  try {
    const user = await getAdminUserFromRequest(req);

    if (user) {
      req.adminUser = user;
      return next();
    }

    // Legacy fallback. Можно оставить на время миграции.
    const configuredToken = process.env.ADMIN_TOKEN;
    const providedToken = req.get('X-Admin-Token') || req.query.token;

    if (configuredToken && providedToken && providedToken === configuredToken) {
      req.adminUser = {
        id: 0,
        email: 'legacy-token',
        name: 'Legacy token',
        role: 'super_admin',
        is_active: true
      };
      return next();
    }

    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  } catch (error) {
    console.error('[Admin auth]', error);
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.adminUser?.role !== 'super_admin') {
    return res.status(403).json({ ok: false, error: 'Super admin access required' });
  }

  next();
}

function requireUserManagerAccess(req, res, next) {
  if (!['super_admin', 'admin'].includes(req.adminUser?.role)) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  next();
}

async function ensureBootstrapSuperAdmin() {
  try {
    await deleteExpiredAdminSessions().catch(() => null);

    const total = await countAdminUsers();
    if (total > 0) return;

    const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL || '');
    const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || '');

    if (!email || !password) {
      console.warn('No admin users found. Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD to create first super admin.');
      return;
    }

    await createAdminUser({
      email,
      name: 'Super Admin',
      role: 'super_admin',
      passwordHash: hashPassword(password),
      isActive: true
    });

    console.log(`Bootstrap super admin created: ${email}`);
  } catch (error) {
    console.error('[Bootstrap admin]', error.message);
  }
}



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


app.post('/api/admin/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || '');
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' });
    }

    const user = await getAdminUserByEmail(email);

    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000).toISOString();

    await createAdminSession(user.id, tokenHash, expiresAt);

    res.setHeader('Set-Cookie', sessionCookie(token, ADMIN_SESSION_MAX_AGE_SECONDS));
    res.json({ ok: true, user: safeAdminUser(user) });
  } catch (error) {
    console.error('[Admin login]', error);
    res.status(500).json({ ok: false, error: 'Login failed' });
  }
});

app.post('/api/admin/logout', async (req, res) => {
  try {
    const token = getSessionTokenFromRequest(req);

    if (token) {
      await deleteAdminSessionByTokenHash(hashSessionToken(token)).catch(() => null);
    }

    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
  } catch (error) {
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
  }
});

app.get('/api/admin/me', requireAdminSession, async (req, res) => {
  res.json({ ok: true, user: safeAdminUser(req.adminUser) });
});

app.get('/api/admin/users', requireAdminSession, requireUserManagerAccess, async (req, res) => {
  try {
    const users = await listAdminUsers();
    res.json({ ok: true, users });
  } catch (error) {
    console.error('[Admin users]', error);
    res.status(500).json({ ok: false, error: 'Failed to load users' });
  }
});

app.post('/api/admin/users', requireAdminSession, requireUserManagerAccess, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || '');
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim().slice(0, 120);
    const role = ['super_admin', 'admin', 'manager'].includes(req.body.role) ? req.body.role : 'admin';

    if (role === 'super_admin' && req.adminUser?.role !== 'super_admin') {
      return res.status(403).json({ ok: false, error: 'Only super admin can create another super admin' });
    }

    if (!email || !password || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Email and password min 8 chars are required' });
    }

    const user = await createAdminUser({
      email,
      name,
      role,
      passwordHash: hashPassword(password),
      isActive: true
    });

    res.status(201).json({ ok: true, user: safeAdminUser(user) });
  } catch (error) {
    console.error('[Create admin user]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to create user' });
  }
});

app.patch('/api/admin/users/:id', requireAdminSession, requireUserManagerAccess, async (req, res) => {
  try {
    const targetUser = await getAdminUserById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    const actorIsSuperAdmin = req.adminUser?.role === 'super_admin';
    const targetIsSuperAdmin = targetUser.role === 'super_admin';
    const isSelf = Number(req.adminUser?.id) === Number(targetUser.id);

    // Admin can manage admin/manager, but cannot change any super_admin field.
    if (targetIsSuperAdmin && !actorIsSuperAdmin) {
      return res.status(403).json({ ok: false, error: 'Only super admin can edit a super admin' });
    }

    // Only super_admin can assign/promote someone to super_admin.
    if (req.body.role === 'super_admin' && !actorIsSuperAdmin) {
      return res.status(403).json({ ok: false, error: 'Only super admin can assign super admin role' });
    }

    // Protect current super_admin from accidentally locking themselves out.
    if (isSelf && actorIsSuperAdmin && req.body.role && req.body.role !== 'super_admin') {
      return res.status(400).json({ ok: false, error: 'You cannot demote your own super admin account' });
    }

    if (isSelf && req.body.is_active === false) {
      return res.status(400).json({ ok: false, error: 'You cannot deactivate your own account' });
    }

    const patch = {};

    if (req.body.email !== undefined) patch.email = normalizeEmail(req.body.email);
    if (req.body.name !== undefined) patch.name = String(req.body.name || '').trim().slice(0, 120);
    if (req.body.role !== undefined) patch.role = ['super_admin', 'admin', 'manager'].includes(req.body.role) ? req.body.role : 'admin';
    if (req.body.is_active !== undefined) patch.isActive = Boolean(req.body.is_active);

    if (req.body.password) {
      const password = String(req.body.password);
      if (password.length < 8) {
        return res.status(400).json({ ok: false, error: 'Password must be at least 8 chars' });
      }
      patch.passwordHash = hashPassword(password);
    }

    const user = await updateAdminUser(req.params.id, patch);
    res.json({ ok: true, user });
  } catch (error) {
    console.error('[Update admin user]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid user id' });
    }

    if (id === Number(req.adminUser.id)) {
      return res.status(400).json({ ok: false, error: 'You cannot delete yourself' });
    }

    await deleteAdminUser(id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[Delete admin user]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to delete user' });
  }
});


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

app.get('/api/leads', requireAdminSession, async (req, res) => {
  try {
    const isManager = req.adminUser?.role === 'manager';

    const [stats, allLeads] = await Promise.all([
      isManager ? Promise.resolve(null) : getStats(),
      listLeads({
        limit: req.query.limit || 100,
        status: req.query.status || null,
        q: req.query.q || ''
      })
    ]);

    const leads = isManager
      ? allLeads.filter((lead) => {
          const crm = lead.meta_json?.crm || {};
          const assignee = crm.assigned_to || {};
          const isOwn = String(assignee.id || '') === String(req.adminUser.id || '');
          const isOpenPool = lead.status === 'new' && !assignee.id;
          return isOwn || isOpenPool;
        })
      : allLeads;

    res.json({ ok: true, stats, leads });
  } catch (error) {
    console.error('[Admin leads]', error);
    res.status(500).json({ ok: false, error: 'Failed to load leads' });
  }
});

app.get('/api/leads/:id/logs', requireAdminSession, async (req, res) => {
  try {
    const logs = await getLeadLogs(req.params.id);
    res.json({ ok: true, logs });
  } catch (error) {
    console.error('[Lead logs]', error);
    res.status(500).json({ ok: false, error: 'Failed to load lead logs' });
  }
});

app.post('/api/leads/:id/notes', requireAdminSession, async (req, res) => {
  try {
    const comment = cleanText(req.body.comment, 1400);

    if (comment.length < 2) {
      return res.status(400).json({ ok: false, error: 'Comment is too short' });
    }

    const lead = await getLeadById(req.params.id);
    const author = req.adminUser?.name || req.adminUser?.email || 'CRM user';
    const authorEmail = req.adminUser?.email || '';

    const log = await addIntegrationLog(
      lead.id,
      'manager_note',
      'created',
      JSON.stringify({
        author,
        authorEmail,
        role: req.adminUser?.role || '',
        comment
      })
    );

    res.status(201).json({ ok: true, log });
  } catch (error) {
    console.error('[Manager note]', error);
    res.status(500).json({ ok: false, error: 'Failed to save manager note' });
  }
});


app.post('/api/leads/:id/assign', requireAdminSession, async (req, res) => {
  try {
    const before = await getLeadById(req.params.id);
    const actor = req.adminUser;
    const requestedUserId = req.body.user_id || req.body.userId || req.body.assignee_id || req.body.assigneeId;

    let targetUser = actor;

    if (requestedUserId) {
      const canAssignOthers = ['super_admin', 'admin'].includes(actor?.role);

      if (!canAssignOthers) {
        return res.status(403).json({ ok: false, error: 'Only admin can assign leads to another user' });
      }

      const foundUser = await getAdminUserById(requestedUserId);

      if (!foundUser || !foundUser.is_active) {
        return res.status(404).json({ ok: false, error: 'Assignee not found or inactive' });
      }

      targetUser = foundUser;
    }

    const lead = await assignLeadToAdmin(req.params.id, targetUser);

    if (before.status !== lead.status) {
      await syncSheetStatus(lead, lead.status).catch(() => null);
    }

    await addIntegrationLog(
      lead.id,
      'crm_action',
      'assigned',
      `Assigned to ${targetUser.name || targetUser.email || 'CRM user'} by ${actor.name || actor.email || 'CRM user'}`
    ).catch(() => null);

    res.json({ ok: true, lead });
  } catch (error) {
    console.error('[Assign lead]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to assign lead' });
  }
});

app.patch('/api/leads/:id/stage', requireAdminSession, async (req, res) => {
  try {
    const stage = String(req.body.stage || '').trim();

    if (!Object.prototype.hasOwnProperty.call(SALES_STAGE_META, stage)) {
      return res.status(400).json({ ok: false, error: 'Unsupported sales stage' });
    }

    const lead = await updateLeadSalesStage(req.params.id, stage);

    await addIntegrationLog(
      lead.id,
      'crm_action',
      'stage_changed',
      `Sales stage changed to: ${SALES_STAGE_META[stage]}`
    ).catch(() => null);

    res.json({ ok: true, lead });
  } catch (error) {
    console.error('[Lead stage]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update stage' });
  }
});

app.get('/api/leads/:id/ai', requireAdminSession, async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    const insights = buildLeadAiInsights(lead);
    res.json({ ok: true, insights });
  } catch (error) {
    console.error('[Lead AI insights]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to build AI insights' });
  }
});


app.patch('/api/leads/:id/status', requireAdminSession, async (req, res) => {
  try {
    const before = await getLeadById(req.params.id);
    const lead = await updateLeadStatus(req.params.id, req.body.status);
    const sheet = await syncSheetStatus(lead, req.body.status);

    await addIntegrationLog(
      lead.id,
      'crm_action',
      'status_changed',
      `Status changed: ${before.status} → ${lead.status}`
    ).catch(() => null);

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
    const before = await getLeadById(leadId);
    const lead = await updateLeadStatus(leadId, status);
    await syncSheetStatus(lead, status);

    await addIntegrationLog(
      lead.id,
      'telegram_action',
      'status_changed',
      `Telegram button: ${before.status} → ${lead.status}`
    ).catch(() => null);

    await answerTelegramCallback(callback.id, `Статус оновлено: ${status}`);
    await editTelegramLeadMessage(lead, callback.message);
    return res.json({ ok: true, leadId, status });
  } catch (error) {
    console.error('[Telegram webhook]', error);
    await answerTelegramCallback(callback.id, `Помилка: ${error.message}`, true);
    return res.status(400).json({ ok: false, error: error.message });
  }
});


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSmmEditableList(value, maxItems = 5, maxLength = 120) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,;]+/);

  const items = [];

  for (const item of rawItems) {
    const cleaned = cleanText(item, maxLength).trim();

    if (cleaned && !items.includes(cleaned)) {
      items.push(cleaned);
    }

    if (items.length >= maxItems) break;
  }

  return items;
}

function normalizeSmmTelegramContact(value = '') {
  let contact = cleanText(value, 90).trim();

  if (!contact) return '';

  const urlMatch = contact.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,32})\/?$/i);
  if (urlMatch) {
    contact = `@${urlMatch[1]}`;
  }

  if (/^[a-zA-Z0-9_]{5,32}$/.test(contact)) {
    contact = `@${contact}`;
  }

  if (!/^@[a-zA-Z0-9_]{5,32}$/.test(contact)) {
    throw new Error('Telegram must be @username or https://t.me/username');
  }

  return contact;
}

function normalizeSmmPhoneContact(value = '') {
  const phone = cleanText(value, 90).trim();

  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');

  if (digits.length < 5) {
    throw new Error('Phone number is too short');
  }

  return phone;
}

app.get('/api/smm/targets', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const targets = await listSmmTargets();
    res.json({ ok: true, targets });
  } catch (error) {
    console.error('[SMM targets]', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to load SMM targets' });
  }
});

app.post('/api/smm/targets', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const target = await createSmmTarget(req.body.url);
    res.status(201).json({ ok: true, target });
  } catch (error) {
    console.error('[SMM create target]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to add website' });
  }
});

app.delete('/api/smm/targets/:id', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    await deleteSmmTarget(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('[SMM delete target]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to delete website' });
  }
});

app.post('/api/smm/targets/:id/analyze', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const target = await getSmmTargetById(req.params.id);

    if (!target) {
      return res.status(404).json({ ok: false, error: 'Target not found' });
    }

    await updateSmmTarget(target.id, {
      analysis_status: 'analyzing',
      error_message: ''
    });

    const analysis = await analyzeWebsiteTarget(target.url);
    const updated = await updateSmmTarget(target.id, analysis);

    res.json({ ok: true, target: updated });
  } catch (error) {
    console.error('[SMM analyze target]', error);

    await updateSmmTarget(req.params.id, {
      analysis_status: 'failed',
      send_status: 'failed',
      error_message: error.message || 'Analyze failed'
    }).catch(() => null);

    res.status(400).json({ ok: false, error: error.message || 'Analyze failed' });
  }
});

app.post('/api/smm/analyze-all', requireAdminSession, requireSuperAdmin, async (req, res) => {
  const summary = {
    analyzed: 0,
    failed: 0,
    skipped: 0
  };

  try {
    const targets = await listSmmTargets();
    const queue = targets.filter((target) => ['pending', 'failed'].includes(target.analysis_status));

    for (const target of queue) {
      try {
        await updateSmmTarget(target.id, {
          analysis_status: 'analyzing',
          error_message: ''
        });

        const analysis = await analyzeWebsiteTarget(target.url);
        await updateSmmTarget(target.id, analysis);
        summary.analyzed += 1;
      } catch (error) {
        summary.failed += 1;

        await updateSmmTarget(target.id, {
          analysis_status: 'failed',
          send_status: 'failed',
          error_message: error.message || 'Analyze failed'
        }).catch(() => null);
      }

      await sleep(900);
    }

    res.json({ ok: true, summary });
  } catch (error) {
    console.error('[SMM analyze all]', error);
    res.status(500).json({ ok: false, error: error.message || 'Analyze all failed', summary });
  }
});

app.patch('/api/smm/targets/:id/send-enabled', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const target = await updateSmmTarget(req.params.id, {
      send_enabled: Boolean(req.body.send_enabled)
    });

    res.json({ ok: true, target });
  } catch (error) {
    console.error('[SMM send enabled]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update send toggle' });
  }
});


app.patch('/api/smm/targets/:id/details', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const target = await getSmmTargetById(req.params.id);

    if (!target) {
      return res.status(404).json({ ok: false, error: 'Target not found' });
    }

    const telegramContacts = parseSmmEditableList(
      req.body.telegram_contacts ?? req.body.telegram_contact ?? req.body.telegram ?? '',
      5,
      90
    )
      .map(normalizeSmmTelegramContact)
      .filter(Boolean);

    const phones = parseSmmEditableList(
      req.body.phones ?? req.body.phone ?? '',
      5,
      90
    )
      .map(normalizeSmmPhoneContact)
      .filter(Boolean);

    const patch = {
      company_name: cleanText(req.body.company_name || '', 160),
      business_type: cleanText(req.body.business_type || '', 140),
      telegram_contacts: telegramContacts,
      phones
    };

    if (req.body.description !== undefined) {
      patch.description = cleanText(req.body.description || '', 1200);
    }

    if (req.body.offer_summary !== undefined) {
      patch.offer_summary = cleanText(req.body.offer_summary || '', 1600);
    }

    if (req.body.message_uk !== undefined || req.body.message !== undefined) {
      patch.message_uk = cleanText(req.body.message_uk || req.body.message || '', 4000);
    }

    const hasAnyContact = telegramContacts.length > 0 || phones.length > 0;

    if (hasAnyContact && ['no_telegram', 'manual_required', 'skipped'].includes(target.send_status)) {
      patch.send_status = 'not_sent';

      if (target.analysis_status !== 'failed') {
        patch.error_message = '';
      }
    }

    const updated = await updateSmmTarget(target.id, patch);

    res.json({ ok: true, target: updated });
  } catch (error) {
    console.error('[SMM details update]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update SMM target' });
  }
});

app.patch('/api/smm/targets/:id/message', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const message = cleanText(req.body.message_uk || req.body.message || '', 4000);

    if (message.length < 10) {
      return res.status(400).json({ ok: false, error: 'Message is too short' });
    }

    const target = await updateSmmTarget(req.params.id, {
      message_uk: message
    });

    res.json({ ok: true, target });
  } catch (error) {
    console.error('[SMM message update]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to update message' });
  }
});

app.post('/api/smm/targets/:id/manual-sent', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const target = await getSmmTargetById(req.params.id);

    if (!target) {
      return res.status(404).json({ ok: false, error: 'Target not found' });
    }

    const contacts = Array.isArray(target.telegram_contacts) ? target.telegram_contacts : [];
    const contact = contacts[0] || '';

    const updated = await updateSmmTarget(target.id, {
      send_status: 'sent',
      sent_count: Number(target.sent_count || 0) + 1,
      last_sent_at: new Date().toISOString(),
      error_message: ''
    });

    await addSmmSendLog({
      targetId: target.id,
      contact,
      status: 'manual_sent',
      message: target.message_uk || '',
      errorMessage: '',
      sentBy: req.adminUser.id
    }).catch(() => null);

    res.json({ ok: true, target: updated });
  } catch (error) {
    console.error('[SMM manual sent]', error);
    res.status(400).json({ ok: false, error: error.message || 'Failed to mark as sent' });
  }
});

app.get('/api/smm/targets/:id/logs', requireAdminSession, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await listSmmSendLogs(req.params.id);
    res.json({ ok: true, logs });
  } catch (error) {
    console.error('[SMM logs]', error);
    res.status(500).json({ ok: false, error: error.message || 'Failed to load logs' });
  }
});


app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.listen(port, () => {
  console.log(`Avant AI Studio running at http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
  ensureBootstrapSuperAdmin();
});
