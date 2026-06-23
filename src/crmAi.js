const NICHE_LABELS = {
  clinic: 'клініки / стоматології',
  beauty: 'салону краси',
  education: 'онлайн-школи',
  service: 'сервісної компанії',
  sales: 'відділу продажів',
  other: 'бізнесу'
};

export const SALES_STAGE_META = {
  new: 'Нова',
  contacted: 'Звʼязались',
  diagnostics: 'Діагностика',
  proposal: 'Пропозиція',
  decision: 'Очікує рішення',
  paid: 'Оплачено',
  closed: 'Закрито',
  rejected: 'Відмова'
};

function clean(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function shortText(value = '', max = 220) {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function getNicheLabel(lead = {}) {
  return NICHE_LABELS[lead.niche] || 'бізнесу';
}

function getLeadNeed(lead = {}) {
  const details = lead.lead_details || {};
  return clean(details.automation || details.format || details.description || lead.message || '');
}

function getPriority(lead = {}) {
  const score = Number(lead.lead_score || 0);

  if (score >= 75) {
    return {
      level: 'hot',
      label: 'Hot lead',
      action: 'звʼязатися протягом 15 хвилин',
      reason: 'лід виглядає готовим до предметної розмови'
    };
  }

  if (score >= 45) {
    return {
      level: 'warm',
      label: 'Warm lead',
      action: 'звʼязатися сьогодні',
      reason: 'є інтерес, але потрібно уточнити задачу, бюджет або канал'
    };
  }

  return {
    level: 'cold',
    label: 'Cold lead',
    action: 'відправити коротке уточнення',
    reason: 'даних поки мало, потрібно виявити потребу'
  };
}

export function buildLeadAiInsights(lead = {}) {
  const details = lead.lead_details || {};
  const reasons = Array.isArray(lead.lead_score_reasons) ? lead.lead_score_reasons : [];
  const priority = getPriority(lead);
  const nicheLabel = getNicheLabel(lead);
  const need = getLeadNeed(lead);
  const contact = clean(lead.contact || '');
  const clientName = clean(lead.name || 'клієнт');
  const budget = clean(details.budget || '');
  const channel = clean(details.channel || '');
  const automation = clean(details.automation || '');

  const summaryParts = [
    `Клієнт із ніші ${nicheLabel}.`,
    need ? `Запит: ${shortText(need, 180)}.` : 'Запит описаний коротко, потрібно уточнити задачу.',
    budget ? `Бюджет: ${budget}.` : 'Бюджет не зафіксований.',
    channel ? `Основний канал: ${channel}.` : 'Канал комунікації потрібно уточнити.',
    `Пріоритет: ${priority.label}, ${Number(lead.lead_score || 0)}/100.`
  ];

  const nextAction = [
    `Рекомендація: ${priority.action}.`,
    priority.reason,
    automation ? `Почати з уточнення: “Які саме процеси хочете автоматизувати в першу чергу: ${automation}?”` : 'Почати з питання: “Куди зараз приходять заявки і хто їх обробляє?”'
  ].join(' ');

  const suggestedReply = [
    `Вітаю, ${clientName}! Дякуємо за заявку в Avant AI Studio.`,
    '',
    `Бачу, що вам цікава автоматизація для ${nicheLabel}. Ми можемо зібрати AI-асистента, який прийматиме заявки, відповідатиме на часті питання, передаватиме звернення менеджеру та зберігатиме все в CRM / Google Sheets.`,
    '',
    'Щоб запропонувати точне рішення, підкажіть, будь ласка:',
    '1. Куди зараз приходять заявки: Telegram, Instagram, сайт чи телефон?',
    '2. Хто зараз відповідає клієнтам?',
    '3. Які питання клієнти ставлять найчастіше?',
    budget ? `4. Бюджет бачу: ${budget}. Він актуальний?` : '4. Чи є орієнтир по бюджету, чи поки потрібно оцінити варіанти?',
    '',
    'Після цього я зможу запропонувати структуру MVP, логіку асистента та орієнтовні строки запуску.'
  ].join('\n');

  return {
    summary: summaryParts.join(' '),
    nextAction,
    suggestedReply,
    priority,
    reasons,
    checklist: [
      contact ? 'Контакт есть' : 'Нужно получить контакт',
      budget ? 'Бюджет указан' : 'Нужно уточнить бюджет',
      channel ? 'Канал указан' : 'Нужно уточнить основной канал',
      automation ? 'Задачи автоматизации описаны' : 'Нужно уточнить процессы для автоматизации'
    ]
  };
}
