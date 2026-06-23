import dotenv from 'dotenv';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

function normalizeSupabaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim();

  if (!value) return '';

  if (value.startsWith('postgres://') || value.startsWith('postgresql://')) {
    throw new Error('SUPABASE_URL must be the Project URL, not the database connection string.');
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

export function normalizeSmmUrl(rawUrl = '') {
  const input = String(rawUrl || '').trim();

  if (!input) throw new Error('URL is required');

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProtocol);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are supported');
  }

  url.hash = '';
  url.search = '';

  return url.toString().replace(/\/$/, '');
}

export async function listSmmTargets() {
  const { data, error } = await supabase
    .from('smm_targets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSmmTargetById(id) {
  const { data, error } = await supabase
    .from('smm_targets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function createSmmTarget(rawUrl) {
  const normalizedUrl = normalizeSmmUrl(rawUrl);

  const { data, error } = await supabase
    .from('smm_targets')
    .insert({
      url: normalizedUrl,
      normalized_url: normalizedUrl,
      analysis_status: 'pending',
      send_status: 'not_sent'
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateSmmTarget(id, patch = {}) {
  const allowed = [
    'url',
    'normalized_url',
    'company_name',
    'business_type',
    'description',
    'telegram_contacts',
    'emails',
    'phones',
    'socials',
    'offer_summary',
    'message_uk',
    'analysis_status',
    'send_enabled',
    'send_status',
    'sent_count',
    'last_sent_at',
    'error_message',
    'meta_json'
  ];

  const update = {
    updated_at: new Date().toISOString()
  };

  for (const key of allowed) {
    if (patch[key] !== undefined) {
      update[key] = patch[key];
    }
  }

  const { data, error } = await supabase
    .from('smm_targets')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSmmTarget(id) {
  const { error } = await supabase
    .from('smm_targets')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function addSmmSendLog({ targetId, channel = 'telegram', contact = '', status, message = '', errorMessage = '', sentBy = null }) {
  const { data, error } = await supabase
    .from('smm_send_logs')
    .insert({
      target_id: targetId,
      channel,
      contact,
      status,
      message: String(message || '').slice(0, 4000),
      error_message: String(errorMessage || '').slice(0, 1200),
      sent_by: sentBy
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function listSmmSendLogs(targetId, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);

  const { data, error } = await supabase
    .from('smm_send_logs')
    .select('*')
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return data || [];
}
