function clean(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
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

export function parseLeadDetails(message = '') {
  const details = {};
  const descriptionLines = [];

  const labels = {
    'Результат квизу': 'quiz',
    'AI Audit Report': 'audit',
    'Формат': 'format',
    'Бюджет': 'budget',
    'Основний канал': 'channel',
    'Автоматизувати': 'automation',
    'Опис': 'description'
  };

  String(message || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (!match) {
        descriptionLines.push(line);
        return;
      }

      const key = labels[match[1].trim()];
      const value = match[2].trim();

      if (!key || !value) {
        descriptionLines.push(line);
        return;
      }

      if (key === 'description') descriptionLines.push(value);
      else details[key] = value;
    });

  details.description = descriptionLines.join('\n').trim() || String(message || '').trim();
  return details;
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

  if (clean(details.description).length >= 80) {
    score += 12;
    reasons.push('детальний опис');
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
