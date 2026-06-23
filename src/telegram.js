import { enrichLead } from './leadScoring.js';

export function isTelegramEnabled() {
  return String(process.env.TELEGRAM_ENABLED || '').toLowerCase() === 'true';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function clean(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function truncate(value = '', max = 1400) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function normalizeNiche(niche = '') {
  const map = {
    clinic: 'Клініка / стоматологія',
    beauty: 'Салон краси',
    education: 'Онлайн-школа',
    service: 'Сервісна компанія',
    sales: 'Відділ продажів',
    other: 'Інший бізнес'
  };

  return map[niche] || niche || 'Не вказано';
}

function formatStatus(status = '') {
  const map = {
    new: '🆕 new',
    in_progress: '🔄 in_progress',
    closed: '✅ closed',
    cancelled: '❌ cancelled'
  };

  return map[status] || status || 'new';
}

function formatDate(value) {
  if (!value) return 'Не вказано';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getPublicUrl() {
  return String(process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
}

function getClientTelegramUrl(contact = '') {
  const value = clean(contact);

  if (/^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
    return `https://t.me/${value.slice(1)}`;
  }

  const match = value.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})/i);
  if (match) return `https://t.me/${match[1]}`;

  return '';
}

function formatContact(contact = '') {
  const value = clean(contact);
  if (!value) return 'Не вказано';

  const url = getClientTelegramUrl(value);
  if (url) {
    return `<a href="${escapeHtml(url)}">${escapeHtml(value)}</a>`;
  }

  return `<code>${escapeHtml(value)}</code>`;
}

function row(label, value, { code = false } = {}) {
  const safeValue = clean(value) || 'Не вказано';
  return `├ <b>${escapeHtml(label)}:</b> ${code ? `<code>${escapeHtml(safeValue)}</code>` : escapeHtml(safeValue)}`;
}

function finalRow(label, value, { code = false } = {}) {
  const safeValue = clean(value) || 'Не вказано';
  return `└ <b>${escapeHtml(label)}:</b> ${code ? `<code>${escapeHtml(safeValue)}</code>` : escapeHtml(safeValue)}`;
}

function optionalProjectRows(details) {
  const rows = [];

  if (details.quiz) rows.push(row('Квиз', details.quiz));
  if (details.audit) rows.push(row('AI Audit', details.audit));
  if (details.format) rows.push(row('Формат', details.format));
  if (details.budget) rows.push(row('Бюджет', details.budget));
  if (details.channel) rows.push(row('Канал', details.channel));
  if (details.automation) rows.push(row('Автоматизація', details.automation));

  if (!rows.length) {
    return [
      '⚙️ <b>ДЕТАЛІ ПРОЄКТУ</b>',
      '└ Поки що без додаткових параметрів'
    ];
  }

  rows[rows.length - 1] = rows[rows.length - 1].replace(/^├/, '└');

  return [
    '⚙️ <b>ДЕТАЛІ ПРОЄКТУ</b>',
    ...rows
  ];
}

function formatSourceRows(source = {}) {
  const rows = [];
  if (source.utm_source) rows.push(row('UTM source', source.utm_source));
  if (source.utm_campaign) rows.push(row('Campaign', source.utm_campaign));
  if (source.utm_medium) rows.push(row('Medium', source.utm_medium));
  if (source.page) rows.push(row('Page', source.page));
  if (source.referrer) rows.push(row('Referrer', truncate(source.referrer, 120)));

  if (!rows.length) return [];

  rows[rows.length - 1] = rows[rows.length - 1].replace(/^├/, '└');

  return [
    '',
    '📍 <b>ДЖЕРЕЛО</b>',
    ...rows
  ];
}

function formatDescription(description = '') {
  const safe = escapeHtml(truncate(description || 'Без опису'));
  return [
    '📝 <b>ОПИС ЗАДАЧІ</b>',
    '┌────────────────',
    safe
      .split('\n')
      .map((line) => `│ ${line}`)
      .join('\n'),
    '└────────────────'
  ];
}

export function buildLeadMessage(rawLead) {
  const lead = enrichLead(rawLead);
  const details = lead.lead_details || {};
  const source = lead.source_details || {};

  return [
    '🟦 <b>AVANT AI STUDIO</b>',
    '┏━━━━━━━━━━━━━━━━━━━━',
    '┃ 🆕 <b>ЗАЯВКА</b>',
    `┃ ID: <code>${escapeHtml(lead.public_id || '—')}</code>`,
    `┃ ${lead.lead_score_emoji} <b>${escapeHtml(lead.lead_score_title)}</b> · ${lead.lead_score}/100`,
    '┗━━━━━━━━━━━━━━━━━━━━',
    '',
    '👤 <b>КЛІЄНТ</b>',
    row('Імʼя', lead.name),
    `├ <b>Контакт:</b> ${formatContact(lead.contact)}`,
    row('Ніша', normalizeNiche(lead.niche)),
    row('Статус', formatStatus(lead.status)),
    finalRow('Мова', lead.language || 'uk'),
    '',
    ...optionalProjectRows(details),
    ...formatSourceRows(source),
    '',
    ...formatDescription(details.description),
    '',
    '⏱ <b>СТВОРЕНО</b>',
    `└ ${escapeHtml(formatDate(lead.created_at))}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    lead.lead_score_reasons?.length
      ? `📌 <i>Score: ${escapeHtml(lead.lead_score_reasons.join(', '))}</i>`
      : '📌 <i>Score буде точнішим, якщо клієнт заповнить більше деталей.</i>'
  ].join('\n');
}

function getLeadActions(status = 'new') {
  const normalized = String(status || 'new');

  if (normalized === 'new') {
    return [
      { text: '🔄 Взяти в роботу', status: 'in_progress' },
      { text: '✅ Закрити', status: 'closed' }
    ];
  }

  if (normalized === 'in_progress') {
    return [
      { text: '✅ Закрити', status: 'closed' },
      { text: '🆕 Повернути в new', status: 'new' }
    ];
  }

  if (normalized === 'closed') {
    return [
      { text: '🔄 Повернути в роботу', status: 'in_progress' }
    ];
  }

  if (normalized === 'cancelled') {
    return [
      { text: '🔄 Повернути в роботу', status: 'in_progress' },
      { text: '🆕 Повернути в new', status: 'new' }
    ];
  }

  return [
    { text: '🔄 Взяти в роботу', status: 'in_progress' }
  ];
}

function buildKeyboard(lead) {
  const publicUrl = getPublicUrl();
  const keyboard = [];

  const actions = getLeadActions(lead.status).map((action) => ({
    text: action.text,
    callback_data: `lead_status:${lead.id}:${action.status}`
  }));

  if (actions.length) {
    keyboard.push(actions);
  }

  const clientUrl = getClientTelegramUrl(lead.contact);
  if (clientUrl) {
    keyboard.push([{ text: '💬 Написати клієнту', url: clientUrl }]);
  }

  if (publicUrl) {
    keyboard.push([{ text: '📊 Відкрити admin', url: `${publicUrl}/admin.html` }]);
  }

  return { inline_keyboard: keyboard };
}

export async function sendTelegramLead(lead) {
  if (!isTelegramEnabled()) {
    return { skipped: true, reason: 'TELEGRAM_ENABLED=false' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('Telegram credentials are incomplete');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildLeadMessage(lead),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: buildKeyboard(lead)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram API error: ${response.status}`);
  }

  return { skipped: false, messageId: data.result?.message_id || null };
}

export async function answerTelegramCallback(callbackQueryId, text, showAlert = false) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !callbackQueryId) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    })
  }).catch(() => null);
}

export async function editTelegramLeadMessage(lead, message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = message?.chat?.id;
  const messageId = message?.message_id;

  if (!token || !chatId || !messageId) return;

  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: buildLeadMessage(lead),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: buildKeyboard(lead)
    })
  }).catch(() => null);
}
