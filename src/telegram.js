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

export function buildLeadMessage(lead) {
  return [
    '🚀 <b>New request — Avant AI Studio</b>',
    '',
    `🆔 <b>ID:</b> ${escapeHtml(lead.public_id)}`,
    `👤 <b>Name:</b> ${escapeHtml(lead.name)}`,
    `📞 <b>Contact:</b> ${escapeHtml(lead.contact)}`,
    `🏷 <b>Niche:</b> ${escapeHtml(lead.niche)}`,
    `🌐 <b>Language:</b> ${escapeHtml(lead.language)}`,
    '',
    `📝 <b>Task:</b>\n${escapeHtml(lead.message)}`,
    '',
    `⏱ <b>Created:</b> ${escapeHtml(lead.created_at)}`
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
