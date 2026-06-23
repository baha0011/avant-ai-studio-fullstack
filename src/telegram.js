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

function parseLeadDetails(message = '') {
  const details = {};
  const descriptionLines = [];

  const labels = {
    'Результат квизу': 'quiz',
    'Формат': 'format',
    'Бюджет': 'budget',
    'Основний канал': 'channel',
    'Автоматизувати': 'automation',
    'Опис': 'description'
  };

  const lines = String(message || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      descriptionLines.push(line);
      continue;
    }

    const rawKey = match[1].trim();
    const value = match[2].trim();
    const key = labels[rawKey];

    if (key && value) {
      if (key === 'description') {
        descriptionLines.push(value);
      } else {
        details[key] = value;
      }
    } else {
      descriptionLines.push(line);
    }
  }

  return {
    ...details,
    description: descriptionLines.join('\n').trim() || String(message || '').trim()
  };
}

function formatContact(contact = '') {
  const value = clean(contact);
  if (!value) return 'Не вказано';

  if (value.startsWith('@') && /^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
    const username = value.slice(1);
    return `<a href="https://t.me/${escapeHtml(username)}">${escapeHtml(value)}</a>`;
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

export function buildLeadMessage(lead) {
  const details = parseLeadDetails(lead.message);

  return [
    '🟦 <b>AVANT AI STUDIO</b>',
    '┏━━━━━━━━━━━━━━━━━━━━',
    '┃ 🆕 <b>НОВА ЗАЯВКА</b>',
    `┃ ID: <code>${escapeHtml(lead.public_id || '—')}</code>`,
    '┗━━━━━━━━━━━━━━━━━━━━',
    '',
    '👤 <b>КЛІЄНТ</b>',
    row('Імʼя', lead.name),
    `├ <b>Контакт:</b> ${formatContact(lead.contact)}`,
    row('Ніша', normalizeNiche(lead.niche)),
    finalRow('Мова', lead.language || 'uk'),
    '',
    ...optionalProjectRows(details),
    '',
    ...formatDescription(details.description),
    '',
    '⏱ <b>СТВОРЕНО</b>',
    `└ ${escapeHtml(formatDate(lead.created_at))}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '💬 <i>Відповісти клієнту бажано якнайшвидше.</i>'
  ].join('\n');
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
      disable_web_page_preview: true
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `Telegram API error: ${response.status}`);
  }

  return { skipped: false, messageId: data.result?.message_id || null };
}
