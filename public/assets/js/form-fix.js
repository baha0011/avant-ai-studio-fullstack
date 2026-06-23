// Robust contact form handler.
// This file intentionally runs after app.js and overrides the old generic handler.
(function () {
  const form = document.getElementById('leadForm');
  if (!form) return;

  const message = document.getElementById('formMessage');
  const submitButton = form.querySelector('[type="submit"]');

  const messages = {
    uk: {
      success: 'Дякуємо! Заявку створено.',
      required: 'Заповніть усі поля форми.',
      shortName: 'Ім’я має містити мінімум 2 символи.',
      shortContact: 'Телефон або Telegram має містити мінімум 3 символи.',
      shortMessage: 'Опис задачі має містити мінімум 8 символів.',
      sending: 'Відправляємо заявку...',
      submit: 'Надіслати заявку',
      backend: 'Не вдалося відправити заявку.',
      details: 'Деталі'
    },
    en: {
      success: 'Thank you! Your request has been created.',
      required: 'Please complete all form fields.',
      shortName: 'Name must contain at least 2 characters.',
      shortContact: 'Phone or Telegram must contain at least 3 characters.',
      shortMessage: 'Task description must contain at least 8 characters.',
      sending: 'Sending request...',
      submit: 'Send request',
      backend: 'Could not send the request.',
      details: 'Details'
    }
  };

  function getLang() {
    const lang = document.documentElement.lang || localStorage.getItem('avantLang') || 'uk';
    return lang.startsWith('en') ? 'en' : 'uk';
  }

  function t(key) {
    return messages[getLang()][key] || messages.uk[key] || key;
  }

  function normalizeApiBase(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function getApiBaseUrl() {
    const saved = normalizeApiBase(localStorage.getItem('avantApiBase'));
    if (saved) return saved;

    const { protocol, hostname, port } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);

    if (protocol === 'file:' || (isLocalHost && port && port !== '3000')) {
      return 'http://localhost:3000';
    }

    return '';
  }

  function apiUrl(path) {
    return `${getApiBaseUrl()}${path}`;
  }

  function showMessage(text, isError = false) {
    if (!message) return;
    message.textContent = text;
    message.className = `form-message show${isError ? ' error' : ''}`;
  }

  function clean(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function validate(payload) {
    if (!payload.name || !payload.contact || !payload.niche || !payload.message) {
      return t('required');
    }
    if (payload.name.length < 2) return t('shortName');
    if (payload.contact.length < 3) return t('shortContact');
    if (payload.message.length < 8) return t('shortMessage');
    return null;
  }

  function captureAttribution() {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const current = {};

    utmKeys.forEach((key) => {
      const value = clean(params.get(key));
      if (value) current[key] = value;
    });

    if (Object.keys(current).length) {
      localStorage.setItem('avantAttribution', JSON.stringify({
        ...current,
        landingPage: window.location.pathname,
        capturedAt: new Date().toISOString()
      }));
    }

    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem('avantAttribution') || '{}');
    } catch {
      saved = {};
    }

    return {
      ...saved,
      referrer: document.referrer || saved.referrer || '',
      landingPage: saved.landingPage || window.location.pathname,
      currentPage: window.location.pathname,
      currentUrl: window.location.href
    };
  }

  async function readApiResponse(response) {
    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (error) {
      throw new Error('Backend returned a non-JSON response. Open the site through http://localhost:3000.');
    }

    if (!response.ok || !data.ok) {
      const validationErrors = data.errors ? Object.values(data.errors).join(', ') : '';
      throw new Error(data.error || validationErrors || `HTTP ${response.status}`);
    }

    return data;
  }

  async function submitLead(payload) {
    const response = await fetch(apiUrl('/api/leads'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return readApiResponse(response);
  }

  form.setAttribute('novalidate', 'true');

  form.addEventListener('submit', async function fixedSubmitHandler(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const formData = new FormData(form);

    const automationNeeds = formData.getAll('automationNeeds').map(clean).filter(Boolean);
    const quizResult = clean(localStorage.getItem('avantQuizResult'));
    const auditReport = clean(localStorage.getItem('avantAuditReport'));
    const projectFormat = clean(formData.get('projectFormat'));
    const budget = clean(formData.get('budget'));
    const mainChannel = clean(formData.get('mainChannel'));
    const baseMessage = clean(formData.get('message'));

    const details = [
      quizResult ? `Результат квизу: ${quizResult}` : '',
      auditReport ? `AI Audit Report: ${auditReport}` : '',
      projectFormat ? `Формат: ${projectFormat}` : '',
      budget ? `Бюджет: ${budget}` : '',
      mainChannel ? `Основний канал: ${mainChannel}` : '',
      automationNeeds.length ? `Автоматизувати: ${automationNeeds.join(', ')}` : '',
      baseMessage ? `Опис: ${baseMessage}` : ''
    ].filter(Boolean).join('\n');

    const attribution = captureAttribution();

    const payload = {
      name: clean(formData.get('name')),
      contact: clean(formData.get('contact')),
      niche: clean(formData.get('niche')),
      message: details || baseMessage,
      language: getLang(),
      page: document.body.dataset.page || 'contact',
      source: attribution.utm_source || 'website',
      meta: {
        ...attribution,
        quizResult,
        auditReport,
        projectFormat,
        budget,
        mainChannel,
        automationNeeds
      }
    };

    const validationError = validate(payload);
    if (validationError) {
      showMessage(validationError, true);
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = t('sending');
      }

      const data = await submitLead(payload);
      showMessage(`${t('success')} ID: ${data.lead.publicId}`);

      const params = new URLSearchParams({
        id: data.lead.publicId,
        score: String(data.lead.leadScore || ''),
        quality: data.lead.leadScoreLabel || ''
      });

      window.location.href = `thank-you.html?${params.toString()}`;
    } catch (error) {
      console.error('[Lead form fixed handler]', error);
      showMessage(`${t('backend')} ${t('details')}: ${error.message}`, true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = t('submit');
      }
    }
  }, true);
})();
