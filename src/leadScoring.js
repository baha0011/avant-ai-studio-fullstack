function clean(value = '') {
  return String(value || '').trim().replace(/[ \t]+/g, ' ');
}

function safeMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

const DETAIL_LABELS = [
  'Результат квизу',
  'AI Audit Report',
  'Формат',
  'Бюджет',
  'Основний канал',
  'Автоматизувати',
  'Опис'
];

const DETAIL_KEYS = {
  'Результат квизу': 'quiz',
  'AI Audit Report': 'audit',
  'Формат': 'format',
  'Бюджет': 'budget',
  'Основний канал': 'channel',
  'Автоматизувати': 'automation',
  'Опис': 'description'
};

function normalizeText(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function findDetailMatches(text) {
  const escaped = DETAIL_LABELS.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|');

  const regex = new RegExp(`(?:^|\\n|\\s)(${escaped}):\\s*`, 'g');
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      label: match[1],
      key: DETAIL_KEYS[match[1]],
      start: match.index,
      valueStart: match.index + match[0].length
    });
  }

  return matches;
}

export function parseLeadDetails(message = '') {
  const text = normalizeText(message);
  const details = {};

  if (!text) {
    return { description: '' };
  }

  const matches = findDetailMatches(text);

  if (!matches.length) {
    return { description: text };
  }

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];

    const rawValue = text
      .slice(current.valueStart, next ? next.start : text.length)
      .trim();

    if (!rawValue) continue;

    if (current.key === 'description') {
      details.description = rawValue;
    } else {
      details[current.key] = rawValue;
    }
  }

  if (!details.description) {
    const firstLabelStart = matches[0]?.start || 0;
    const beforeLabels = text.slice(0, firstLabelStart).trim();
    details.description = beforeLabels || '';
  }

  return {
    quiz: details.quiz || '',
    audit: details.audit || '',
    format: details.format || '',
    budget: details.budget || '',
    channel: details.channel || '',
    automation: details.automation || '',
    description: details.description || text
  };
}

export function computeLeadScore(lead = {}) {
  const details = parseLeadDetails(lead.message);
  const meta = safeMeta(lead.meta_json || lead.meta);
  let score = 0;
  const reasons = [];

  if (clean(lead.contact).length >= 5) {
    score += 10;
    reasons.push('є контакт');
  }

  if (details.quiz || details.audit || meta.auditReport) {
    score += 18;
    reasons.push('є квиз / аудит');
  }

  if (details.format) {
    score += 16;
    reasons.push('обрано формат');
  }

  if (details.budget && !/обговорити|ще не знаю/i.test(details.budget)) {
    score += 16;
    reasons.push('вказано бюджет');
  }

  if (details.channel) {
    score += 12;
    reasons.push('вказано канал');
  }

  if (details.automation) {
    score += 16;
    reasons.push('є задачі автоматизації');
  }

  if (clean(details.description).length >= 30) {
    score += 12;
    reasons.push('є опис задачі');
  }

  score = Math.min(score, 100);

  const label = score >= 75 ? 'hot' : score >= 45 ? 'warm' : 'cold';
  const emoji = label === 'hot' ? '🔥' : label === 'warm' ? '🟡' : '⚪';
  const title = label === 'hot' ? 'Hot lead' : label === 'warm' ? 'Warm lead' : 'Cold lead';

  return {
    score,
    label,
    emoji,
    title,
    reasons,
    details
  };
}

export function getSourceDetails(lead = {}) {
  const meta = safeMeta(lead.meta_json || lead.meta);

  return {
    source: clean(lead.source || meta.utm_source || 'website'),
    page: clean(lead.page || meta.landingPage || ''),
    landingPage: clean(meta.landingPage || ''),
    referrer: clean(meta.referrer || ''),
    utm_source: clean(meta.utm_source || ''),
    utm_medium: clean(meta.utm_medium || ''),
    utm_campaign: clean(meta.utm_campaign || ''),
    utm_content: clean(meta.utm_content || ''),
    utm_term: clean(meta.utm_term || '')
  };
}

export function enrichLead(lead = {}) {
  const scoring = computeLeadScore(lead);
  const sourceDetails = getSourceDetails(lead);

  return {
    ...lead,
    lead_score: scoring.score,
    lead_score_label: scoring.label,
    lead_score_title: scoring.title,
    lead_score_emoji: scoring.emoji,
    lead_score_reasons: scoring.reasons,
    lead_details: scoring.details,
    source_details: sourceDetails
  };
}
