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
    `Здравствуйте, ${clientName}! Спасибо за заявку в Avant AI Studio.`,
    '',
    `Вижу, что вам интересна автоматизация для ${nicheLabel}. Мы можем собрать AI-ассистента, который будет принимать заявки, отвечать на частые вопросы, передавать обращения менеджеру и сохранять всё в CRM/Google Sheets.`,
    '',
    'Чтобы предложить точное решение, подскажите, пожалуйста:',
    '1. Куда сейчас приходят заявки: Telegram, Instagram, сайт или телефон?',
    '2. Кто сейчас отвечает клиентам?',
    '3. Какие вопросы клиенты чаще всего задают?',
    budget ? `4. Бюджет я вижу: ${budget}. Он актуален?` : '4. Есть ли ориентир по бюджету или пока нужно оценить варианты?',
    '',
    'После этого я смогу предложить структуру MVP и сроки запуска.'
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
