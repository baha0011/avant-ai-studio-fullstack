export function isSmmTelegramEnabled() {
  return String(process.env.SMM_TELEGRAM_ENABLED || '').toLowerCase() === 'true'
    && Boolean(process.env.SMM_TELEGRAM_BOT_TOKEN);
}

export function getManualTelegramUrl(contact = '') {
  const value = String(contact || '').trim();

  if (/^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
    return `https://t.me/${value.slice(1)}`;
  }

  const match = value.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})/i);
  if (match) return `https://t.me/${match[1]}`;

  return '';
}

function resolveBotChatId(contact = '') {
  const value = String(contact || '').trim();

  if (/^-?\d+$/.test(value)) return value;
  if (value.startsWith('chat_id:')) return value.replace('chat_id:', '').trim();

  return '';
}

export async function sendSmmTelegramMessage(contact, message) {
  const text = String(message || '').trim();
  const rawContact = String(contact || '').trim();
  const manualUrl = getManualTelegramUrl(rawContact);

  if (!text) {
    return { status: 'skipped', skipped: true, reason: 'empty_message', manualUrl };
  }

  if (!rawContact) {
    return { status: 'skipped', skipped: true, reason: 'empty_contact', manualUrl };
  }

  const chatId = resolveBotChatId(rawContact);

  if (!chatId) {
    return {
      status: 'manual_required',
      manualRequired: true,
      reason: 'bot_cannot_dm_private_username',
      manualUrl
    };
  }

  if (!isSmmTelegramEnabled()) {
    return {
      status: 'manual_required',
      manualRequired: true,
      reason: 'smm_telegram_disabled',
      manualUrl
    };
  }

  const token = process.env.SMM_TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    return {
      status: 'failed',
      failed: true,
      error: data.description || `Telegram HTTP ${response.status}`,
      manualUrl
    };
  }

  return {
    status: 'sent',
    sent: true,
    telegramMessageId: data.result?.message_id,
    manualUrl
  };
}
