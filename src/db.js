import crypto from 'node:crypto';
import dotenv from 'dotenv';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

function normalizeSupabaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim();

  if (!value) return '';

  if (value.startsWith('postgres://') || value.startsWith('postgresql://')) {
    throw new Error('SUPABASE_URL must be the Project URL, not the database connection string. Use a value like https://your-project.supabase.co');
  }

  return value
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/rest$/i, '');
}

function getSupabaseClient() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error('Supabase config is missing. Set SUPABASE_URL and SUPABASE_KEY.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: WebSocket
    }
  });
}

const supabase = getSupabaseClient();

export function initDb() {
  return true;
}

export function createPublicId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `A-${date}-${random}`;
}

export async function insertLead(payload) {
  const publicId = createPublicId();

  const record = {
    public_id: publicId,
    name: payload.name,
    contact: payload.contact,
    niche: payload.niche,
    message: payload.message,
    language: payload.language || 'uk',
    page: payload.page || 'contact',
    source: payload.source || 'website',
    meta_json: payload.meta || {}
  };

  const { data, error } = await supabase
    .from('leads')
    .insert(record)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getLeadById(id) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function listLeads({ limit = 100, status = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateLeadIntegrationStatus(id, field, value) {
  const allowed = new Set(['sheet_status', 'telegram_status']);
  if (!allowed.has(field)) throw new Error(`Unsupported status field: ${field}`);

  const { data, error } = await supabase
    .from('leads')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateLeadStatus(id, status) {
  const allowed = new Set(['new', 'in_progress', 'closed', 'cancelled']);
  if (!allowed.has(status)) throw new Error('Unsupported lead status');

  const { data, error } = await supabase
    .from('leads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function addIntegrationLog(leadId, channel, status, message = '') {
  const { error } = await supabase
    .from('integration_logs')
    .insert({
      lead_id: leadId,
      channel,
      status,
      message: String(message).slice(0, 1200)
    });

  if (error) throw error;
}

export async function getStats() {
  const { data, error } = await supabase
    .from('leads')
    .select('status, created_at')
    .limit(10000);

  if (error) throw error;

  const rows = data || [];
  const today = new Date().toISOString().slice(0, 10);
  const byStatusMap = rows.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  return {
    total: rows.length,
    today: rows.filter((lead) => String(lead.created_at || '').slice(0, 10) === today).length,
    byStatus: Object.entries(byStatusMap).map(([status, count]) => ({ status, count }))
  };
}

initDb();
