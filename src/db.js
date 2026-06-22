import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './data/avant.sqlite';
const resolvedPath = path.resolve(process.cwd(), dbPath);
fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      niche TEXT NOT NULL,
      message TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'uk',
      page TEXT,
      source TEXT NOT NULL DEFAULT 'website',
      status TEXT NOT NULL DEFAULT 'new',
      sheet_status TEXT NOT NULL DEFAULT 'pending',
      telegram_status TEXT NOT NULL DEFAULT 'pending',
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS integration_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  `);
}

export function createPublicId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `A-${date}-${random}`;
}

export function insertLead(payload) {
  const publicId = createPublicId();
  const stmt = db.prepare(`
    INSERT INTO leads (
      public_id, name, contact, niche, message, language, page, source, meta_json
    ) VALUES (
      @public_id, @name, @contact, @niche, @message, @language, @page, @source, @meta_json
    )
  `);

  const info = stmt.run({
    public_id: publicId,
    name: payload.name,
    contact: payload.contact,
    niche: payload.niche,
    message: payload.message,
    language: payload.language || 'uk',
    page: payload.page || 'contact',
    source: payload.source || 'website',
    meta_json: JSON.stringify(payload.meta || {})
  });

  return getLeadById(info.lastInsertRowid);
}

export function getLeadById(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

export function listLeads({ limit = 100, status = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (status) {
    return db.prepare('SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, safeLimit);
  }
  return db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT ?').all(safeLimit);
}

export function updateLeadIntegrationStatus(id, field, value) {
  const allowed = new Set(['sheet_status', 'telegram_status']);
  if (!allowed.has(field)) throw new Error(`Unsupported status field: ${field}`);
  db.prepare(`UPDATE leads SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(value, id);
  return getLeadById(id);
}

export function updateLeadStatus(id, status) {
  const allowed = new Set(['new', 'in_progress', 'closed', 'cancelled']);
  if (!allowed.has(status)) throw new Error('Unsupported lead status');
  db.prepare('UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  return getLeadById(id);
}

export function addIntegrationLog(leadId, channel, status, message = '') {
  db.prepare(`
    INSERT INTO integration_logs (lead_id, channel, status, message)
    VALUES (?, ?, ?, ?)
  `).run(leadId, channel, status, String(message).slice(0, 1200));
}

export function getStats() {
  const total = db.prepare('SELECT COUNT(*) AS count FROM leads').get().count;
  const today = db.prepare("SELECT COUNT(*) AS count FROM leads WHERE date(created_at) = date('now')").get().count;
  const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM leads GROUP BY status').all();
  return { total, today, byStatus };
}

initDb();

if (process.argv.includes('--reset')) {
  db.exec('DROP TABLE IF EXISTS integration_logs; DROP TABLE IF EXISTS leads;');
  initDb();
  console.log('Database reset complete:', resolvedPath);
}
