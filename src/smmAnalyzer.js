const MAX_HTML_BYTES = 1500000;
const FETCH_TIMEOUT_MS = 15000;

function clean(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values = []) {
  return [...new Set(values.map((item) => clean(item)).filter(Boolean))];
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(html = '') {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

function getTagContent(html, tag) {
  const match = String(html || '').match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return clean(stripTags(match?.[1] || ''));
}

function getMetaDescription(html = '') {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);

  return clean(decodeHtml(match?.[1] || ''));
}

function isBlockedHostname(hostname = '') {
  const host = hostname.toLowerCase();

  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::1') return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

  return false;
}

export function normalizeWebsiteUrl(rawUrl = '') {
  const input = String(rawUrl || '').trim();

  if (!input) throw new Error('URL is required');

  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const url = new URL(withProtocol);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are supported');
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('Blocked hostname');
  }

  url.hash = '';
  url.search = '';

  return url.toString().replace(/\/$/, '');
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'AvantAIStudio-SMM-Analyzer/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Website returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unsupported content type: ${contentType || 'unknown'}`);
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_HTML_BYTES) {
      throw new Error('HTML is too large');
    }

    return Buffer.from(buffer).toString('utf8');
  } finally {
    clearTimeout(timeout);
  }
}

function extractTelegramContacts(html = '', text = '') {
  const contacts = [];
  const raw = `${html}\n${text}`;

  for (const match of raw.matchAll(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,32})/gi)) {
    const username = match[1];

    if (!['share', 'joinchat', 'addstickers', 'proxy'].includes(username.toLowerCase())) {
      contacts.push(`@${username}`);
    }
  }

  for (const match of raw.matchAll(/(?:telegram|телеграм|tg|тг)[^@\n]{0,80}@([a-zA-Z0-9_]{5,32})/gi)) {
    contacts.push(`@${match[1]}`);
  }

  return unique(contacts).slice(0, 8);
}

function extractEmails(text = '') {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];

  return unique(matches)
    .filter((email) => !/\.(png|jpg|jpeg|webp|svg|gif)$/i.test(email))
    .slice(0, 10);
}

function extractPhones(text = '') {
  const matches = text.match(/(?:\+?38)?\s?\(?0\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g) || [];
  return unique(matches).slice(0, 10);
}

function extractSocials(html = '') {
  const socials = {};

  const patterns = {
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi,
    facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+/gi,
    linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+/gi
  };

  for (const [key, regex] of Object.entries(patterns)) {
    socials[key] = unique(html.match(regex) || []).slice(0, 4);
  }

  return socials;
}

function detectBusinessType(text = '') {
  const lower = text.toLowerCase();

  const rules = [
    ['Стоматологія / клініка', /стомат|зуб|лікар|доктор|клінік|медиц|dent|clinic|doctor/],
    ['Салон краси / beauty', /салон|краси|beauty|космет|манікюр|hair|barber|перукар/],
    ['Освіта / курси', /курс|навчан|школ|освіт|academy|school|education/],
    ['Нерухомість', /нерухом|ріелтор|квартира|будинок|real estate|property/],
    ['Юридичні послуги', /юрист|адвокат|право|legal|law/],
    ['Автосервіс / авто', /авто|сто|car|auto|service station|шиномонтаж/],
    ['Ресторан / доставка', /ресторан|кафе|доставка|menu|меню|food|pizza|sushi/],
    ['E-commerce / магазин', /магазин|купити|товар|shop|store|cart|basket|доставка/],
    ['B2B / сервісна компанія', /послуги|service|agency|агенц|компанія|consulting/]
  ];

  const found = rules.find(([, regex]) => regex.test(lower));
  return found ? found[0] : 'Бізнес / послуги';
}

function buildOffer({ businessType, title, description }) {
  const lower = `${businessType} ${title} ${description}`.toLowerCase();

  if (/стомат|клінік|медиц|doctor|clinic/.test(lower)) {
    return 'AI-асистент для консультацій, запису пацієнтів, відповідей на часті питання та передачі заявок адміністратору в Telegram/CRM.';
  }

  if (/салон|beauty|космет|манікюр|hair|barber/.test(lower)) {
    return 'AI-асистент для запису клієнтів, консультацій по послугах, нагадувань і швидкої передачі заявок адміністратору.';
  }

  if (/курс|освіт|school|academy|education/.test(lower)) {
    return 'AI-асистент для консультацій майбутніх студентів, збору заявок, кваліфікації лідів і автоматичної передачі менеджеру.';
  }

  if (/магазин|shop|store|e-commerce|товар/.test(lower)) {
    return 'AI-асистент для консультацій по товарах, збору контактів, обробки заявок і передачі теплих покупців менеджеру.';
  }

  return 'AI-асистент для прийому заявок, відповідей на типові питання, кваліфікації клієнтів і збереження звернень у CRM/Google Sheets.';
}

function buildMessageUk({ companyName, businessType, offerSummary }) {
  const name = companyName || 'вашу компанію';

  return [
    `Вітаю! Побачив сайт ${name} і вирішив написати з короткою ідеєю для автоматизації.`,
    '',
    'Ми в Avant AI Studio робимо AI-асистентів для бізнесу: заявки, консультації, Telegram, CRM, Google Sheets і автоматичну передачу звернень менеджеру.',
    '',
    `Для вашої сфери (${businessType}) можна зробити:`,
    `— ${offerSummary}`,
    '— автоматичний збір заявок із сайту або Telegram;',
    '— швидкі відповіді на часті питання клієнтів;',
    '— повідомлення адміну в Telegram і збереження всіх звернень у CRM.',
    '',
    'Якщо актуально, можу коротко показати приклад, як це виглядає для вашої ніші.',
    '',
    'Якщо неактуально — не турбуватиму.'
  ].join('\n');
}

export async function analyzeWebsiteTarget(url) {
  const normalizedUrl = normalizeWebsiteUrl(url);
  const html = await fetchHtml(normalizedUrl);
  const text = stripTags(html).slice(0, 12000);

  const title = getTagContent(html, 'title');
  const h1 = getTagContent(html, 'h1');
  const metaDescription = getMetaDescription(html);
  const companyName = clean(h1 || title || new URL(normalizedUrl).hostname.replace(/^www\./, ''));
  const description = clean(metaDescription || text.slice(0, 280));
  const businessType = detectBusinessType(`${title} ${h1} ${description} ${text.slice(0, 3000)}`);
  const telegramContacts = extractTelegramContacts(html, text);
  const emails = extractEmails(`${html} ${text}`);
  const phones = extractPhones(text);
  const socials = extractSocials(html);
  const offerSummary = buildOffer({ businessType, title, description });
  const messageUk = buildMessageUk({ companyName, businessType, offerSummary });

  return {
    url: normalizedUrl,
    normalized_url: normalizedUrl,
    company_name: companyName.slice(0, 180),
    business_type: businessType,
    description: description.slice(0, 900),
    telegram_contacts: telegramContacts,
    emails,
    phones,
    socials,
    offer_summary: offerSummary,
    message_uk: messageUk,
    analysis_status: 'analyzed',
    send_status: telegramContacts.length ? 'prepared' : 'no_telegram',
    error_message: '',
    meta_json: {
      title,
      h1,
      metaDescription,
      analyzedAt: new Date().toISOString(),
      textSample: text.slice(0, 1200)
    }
  };
}
