const translations = {
  uk: {
    langCode: 'uk',
    meta: {
      home: ['Avant AI Studio — ШІ-асистенти для бізнесу', 'Avant AI Studio розробляє ШІ-асистентів для бізнесу: заявки, консультації, записи клієнтів, база даних, Google Sheets і Telegram-сповіщення.'],
      services: ['Послуги — Avant AI Studio', 'ШІ-асистенти для сайтів, Telegram-боти, обробка заявок, база даних, Google Sheets та адмін-панелі для бізнесу.'],
      integrations: ['Інтеграції — Avant AI Studio', 'Як працює backend Avant AI Studio: форма, база даних, Google Sheets, Telegram-сповіщення та адмін-процеси.'],
      process: ['Процес — Avant AI Studio', 'Як ми аналізуємо бізнес, проєктуємо сценарії, розробляємо ШІ-асистента, підключаємо базу даних, Google Sheets і Telegram.'],
      contact: ['Контакти — Avant AI Studio', 'Залиште заявку на консультацію або безкоштовний розбір комунікації бізнесу з клієнтами.'],
      admin: ['Admin — Avant AI Studio', 'Внутрішня панель перегляду заявок Avant AI Studio.']
    },
    common: {
      brand: 'Avant AI Studio', menuOpen: 'Відкрити меню', navHome: 'Головна', navServices: 'Послуги', navIntegrations: 'Інтеграції', navProcess: 'Процес', navContact: 'Контакти', navAdmin: 'Admin', ctaConsult: 'Отримати консультацію', ctaAudit: 'Отримати безкоштовний розбір', footerCopy: '© 2026 Avant AI Studio. Усі права захищені.', footerNote: 'ШІ-асистенти, база даних, Google Sheets і Telegram для бізнесу.'
    },
    home: {
      badge: 'ШІ-асистенти для бізнесу', title: 'Комунікаційна система, яка відповідає клієнтам, збирає заявки та не губить дані.', subtitle: 'Avant AI Studio розробляє ШІ-асистентів для бізнесу: сайт або бот приймає заявку, backend зберігає її в базі даних, дублює в Google Sheets і надсилає Telegram-сповіщення адміністратору.', primary: 'Отримати консультацію', secondary: 'Переглянути інтеграції', point1: 'ШІ відповідає клієнтам 24/7', point2: 'SQLite база даних для заявок', point3: 'Google Sheets замість CRM', point4: 'Telegram-сповіщення адміну', visualTitle: 'Avant Lead Assistant', visualStatus: 'Працює зараз', msg1: 'Клієнт залишає заявку на сайті або в боті.', msg2: 'Backend створює запис у базі даних та присвоює ID заявки.', msg3: 'Дані автоматично йдуть у Google Sheets.', msg4: 'Адміністратор отримує повідомлення в Telegram.', stat1: 'заявки в БД', stat2: 'таблиця для команди', stat3: 'сповіщення', stat4: 'готово до запуску'
    },
    services: {
      badge: 'Послуги студії', title: 'Розробляємо не просто бота, а повну систему прийому та обробки заявок.', subtitle: 'Frontend, backend, база даних, Google Sheets, Telegram і логіка ШІ-асистента працюють як один бізнес-інструмент.', s1Title: 'ШІ-асистент для сайту', s1Text: 'Відповідає на питання, пояснює послуги, збирає контакти та передає заявку на backend.', s2Title: 'Telegram-бот з ШІ', s2Text: 'Веде діалог із клієнтом, приймає заявки, показує статуси та може працювати як канал комунікації.', s3Title: 'Backend для заявок', s3Text: 'API приймає форму, валідує дані, зберігає заявку в базі та запускає інтеграції.', s4Title: 'База даних', s4Text: 'Усі заявки зберігаються локально в SQLite, тому дані не губляться при збоях зовнішніх сервісів.', s5Title: 'Google Sheets', s5Text: 'Заявки автоматично додаються в таблицю, яку може вести адміністратор або власник бізнесу.', s6Title: 'Telegram-сповіщення', s6Text: 'Адмін або канал отримує структуроване повідомлення: ID, ім’я, контакт, ніша та задача.', s7Title: 'Admin-панель', s7Text: 'Проста панель для перегляду заявок і зміни статусів: нова, в роботі, закрита, скасована.', s8Title: 'Підтримка запуску', s8Text: 'Допомагаємо налаштувати ключі, таблицю, Telegram-бота, деплой і базові бізнес-сценарії.'
    },
    integrations: {
      badge: 'Backend та інтеграції', title: 'Заявка проходить повний шлях: сайт → API → база даних → Google Sheets → Telegram.', subtitle: 'Це вже не статичний сайт. Проект має Express backend, SQLite DB, Google Sheets API, Telegram Bot API та внутрішню admin-панель.', flow1Title: 'Frontend', flow1Text: 'Форма на сайті збирає заявку клієнта.', flow2Title: 'Backend API', flow2Text: 'Express перевіряє дані та створює заявку.', flow3Title: 'Database', flow3Text: 'SQLite зберігає заявку та статуси інтеграцій.', flow4Title: 'Google Sheets + Telegram', flow4Text: 'Дані йдуть у таблицю та адміну в Telegram.', dbTitle: 'База даних', dbText: 'Таблиця leads містить ID заявки, ім’я, контакт, нішу, опис задачі, мову, статус, статус Google Sheets, статус Telegram і дату створення.', sheetsTitle: 'Google Sheets замість CRM', sheetsText: 'Google Sheets використовується як простий операційний центр для команди. Таблиця отримує новий рядок після кожної заявки.', tgTitle: 'Telegram для адміністратора', tgText: 'Адмін отримує красиве структуроване повідомлення в особистий чат, групу або канал. Це швидко, зручно і не потребує складної CRM.', envTitle: 'Що потрібно налаштувати', envText: 'У файлі .env потрібно вказати токен Telegram-бота, chat_id, ID Google Sheet, email сервісного акаунта та приватний ключ.', codeTitle: 'API endpoint для форми'
    },
    process: { badge: 'Процес', title: 'Розробка йде як продуктова система, а не як одноразова сторінка.', subtitle: 'Спочатку проектуємо сценарії та дані, потім збираємо frontend, backend, базу, Google Sheets, Telegram і тестуємо весь ланцюг.', p1Title: 'Аналіз бізнесу', p1Text: 'Розбираємо ніші, типові питання, заявки, канали комунікації та роль адміністратора.', p2Title: 'Проєктування логіки', p2Text: 'Визначаємо поля заявки, статуси, сценарії ШІ, правила передачі даних і повідомлень.', p3Title: 'Розробка системи', p3Text: 'Створюємо сайт, backend API, базу даних, інтеграцію Google Sheets і Telegram.', p4Title: 'Тестування', p4Text: 'Перевіряємо форму, збереження в БД, рядок у таблиці, повідомлення в Telegram і admin-панель.', p5Title: 'Запуск', p5Text: 'Готуємо .env, деплой, домен, HTTPS, доступи та базову інструкцію для команди.', p6Title: 'Покращення', p6Text: 'Аналізуємо реальні заявки, уточнюємо сценарії, додаємо поля, фільтри та автоматизації.' },
    contact: { badge: 'Контакти', title: 'Залиште заявку — вона потрапить у backend, базу даних, Google Sheets і Telegram.', subtitle: 'Форма нижче вже відправляє POST-запит на /api/leads. Після налаштування .env вона стане реальною робочою заявкою.', formTitle: 'Заявка на консультацію', nameLabel: 'Ім’я', namePlaceholder: 'Ваше ім’я', contactLabel: 'Телефон / Telegram', contactPlaceholder: '+380 або @username', nicheLabel: 'Ніша бізнесу', nichePlaceholder: 'Оберіть нішу', niche1: 'Клініка або стоматологія', niche2: 'Салон краси', niche3: 'Онлайн-школа', niche4: 'Сервісна компанія', niche5: 'Відділ продажів', niche6: 'Інший бізнес', taskLabel: 'Короткий опис задачі', taskPlaceholder: 'Наприклад: потрібен ШІ-асистент для запису клієнтів, відповідей на питання та Telegram-сповіщень адміну.', submit: 'Надіслати заявку', success: 'Дякуємо! Заявку створено. Якщо інтеграції увімкнені, дані вже пішли в Google Sheets і Telegram.', error: 'Не вдалося відправити заявку. Перевірте, чи запущений backend.', directTitle: 'Контакти', directText: 'Замініть ці placeholders перед публікацією.', telegram: 'Telegram', email: 'Email', phone: 'Phone', instagram: 'Instagram / LinkedIn' },
    admin: { badge: 'Admin-панель', title: 'Внутрішній перегляд заявок із бази даних.', subtitle: 'Введіть ADMIN_TOKEN із .env, щоб переглянути заявки та змінювати статуси.', tokenPlaceholder: 'ADMIN_TOKEN', saveToken: 'Зберегти токен', load: 'Завантажити заявки', total: 'Усього', today: 'Сьогодні', id: 'ID', client: 'Клієнт', niche: 'Ніша', task: 'Задача', status: 'Статус', integrations: 'Інтеграції', created: 'Створено', noData: 'Заявок поки немає або токен неправильний.' }
  },
  en: {
    langCode: 'en',
    meta: {
      home: ['Avant AI Studio — AI assistants for business', 'Avant AI Studio builds AI assistants for businesses: leads, consultations, appointments, database, Google Sheets, and Telegram notifications.'],
      services: ['Services — Avant AI Studio', 'AI website assistants, Telegram bots, lead processing, database, Google Sheets, and admin panels for business.'],
      integrations: ['Integrations — Avant AI Studio', 'How the Avant AI Studio backend works: form, database, Google Sheets, Telegram notifications, and admin workflows.'],
      process: ['Process — Avant AI Studio', 'How we analyze the business, design scenarios, build the AI assistant, connect database, Google Sheets, and Telegram.'],
      contact: ['Contact — Avant AI Studio', 'Send a request for a consultation or a free audit of your customer communication flow.'],
      admin: ['Admin — Avant AI Studio', 'Internal lead dashboard for Avant AI Studio.']
    },
    common: { brand: 'Avant AI Studio', menuOpen: 'Open menu', navHome: 'Home', navServices: 'Services', navIntegrations: 'Integrations', navProcess: 'Process', navContact: 'Contact', navAdmin: 'Admin', ctaConsult: 'Get a consultation', ctaAudit: 'Get a free audit', footerCopy: '© 2026 Avant AI Studio. All rights reserved.', footerNote: 'AI assistants, database, Google Sheets, and Telegram for business.' },
    home: { badge: 'AI assistants for business', title: 'A communication system that replies to customers, collects leads, and keeps data safe.', subtitle: 'Avant AI Studio builds AI assistants for businesses: the website or bot collects a request, the backend stores it in a database, duplicates it to Google Sheets, and sends a Telegram notification to the administrator.', primary: 'Get a consultation', secondary: 'View integrations', point1: 'AI replies to customers 24/7', point2: 'SQLite database for leads', point3: 'Google Sheets instead of CRM', point4: 'Telegram admin alerts', visualTitle: 'Avant Lead Assistant', visualStatus: 'Running now', msg1: 'A customer submits a request on the website or in a bot.', msg2: 'The backend creates a database record and assigns a lead ID.', msg3: 'Data is automatically sent to Google Sheets.', msg4: 'The administrator receives a Telegram notification.', stat1: 'leads in DB', stat2: 'team spreadsheet', stat3: 'notifications', stat4: 'ready to launch' },
    services: { badge: 'Studio services', title: 'We build not just a bot, but a complete lead collection and processing system.', subtitle: 'Frontend, backend, database, Google Sheets, Telegram, and AI assistant logic work as one business tool.', s1Title: 'AI website assistant', s1Text: 'Answers questions, explains services, collects contacts, and sends the lead to the backend.', s2Title: 'AI Telegram bot', s2Text: 'Guides the customer, collects requests, shows statuses, and can work as a communication channel.', s3Title: 'Lead backend', s3Text: 'The API receives the form, validates data, saves the request, and runs integrations.', s4Title: 'Database', s4Text: 'All requests are stored locally in SQLite, so data is not lost if external services fail.', s5Title: 'Google Sheets', s5Text: 'Requests are automatically added to a spreadsheet for the administrator or business owner.', s6Title: 'Telegram notifications', s6Text: 'The admin or channel receives a structured message: ID, name, contact, niche, and task.', s7Title: 'Admin panel', s7Text: 'A simple panel for viewing leads and changing statuses: new, in progress, closed, cancelled.', s8Title: 'Launch support', s8Text: 'We help configure keys, spreadsheet, Telegram bot, deployment, and basic business scenarios.' },
    integrations: { badge: 'Backend and integrations', title: 'A request goes through the full path: website → API → database → Google Sheets → Telegram.', subtitle: 'This is no longer a static website. The project includes an Express backend, SQLite DB, Google Sheets API, Telegram Bot API, and internal admin panel.', flow1Title: 'Frontend', flow1Text: 'The website form collects the customer request.', flow2Title: 'Backend API', flow2Text: 'Express validates the data and creates the lead.', flow3Title: 'Database', flow3Text: 'SQLite stores the lead and integration statuses.', flow4Title: 'Google Sheets + Telegram', flow4Text: 'Data goes to the spreadsheet and to the admin in Telegram.', dbTitle: 'Database', dbText: 'The leads table stores lead ID, name, contact, niche, task description, language, status, Google Sheets status, Telegram status, and creation date.', sheetsTitle: 'Google Sheets instead of CRM', sheetsText: 'Google Sheets works as a simple operating hub for the team. A new row is added after each request.', tgTitle: 'Telegram for the administrator', tgText: 'The admin receives a structured message in a private chat, group, or channel. It is fast, convenient, and does not require a complex CRM.', envTitle: 'What needs to be configured', envText: 'In the .env file, set the Telegram bot token, chat_id, Google Sheet ID, service account email, and private key.', codeTitle: 'API endpoint for the form' },
    process: { badge: 'Process', title: 'Development is handled as a product system, not a one-time page.', subtitle: 'First we design scenarios and data, then build frontend, backend, database, Google Sheets, Telegram, and test the entire chain.', p1Title: 'Business analysis', p1Text: 'We study the niche, common questions, requests, communication channels, and administrator role.', p2Title: 'Logic design', p2Text: 'We define lead fields, statuses, AI scenarios, data transfer rules, and notification logic.', p3Title: 'System development', p3Text: 'We build the website, backend API, database, Google Sheets integration, and Telegram integration.', p4Title: 'Testing', p4Text: 'We test the form, DB saving, spreadsheet row, Telegram message, and admin panel.', p5Title: 'Launch', p5Text: 'We prepare .env, deployment, domain, HTTPS, access credentials, and team instructions.', p6Title: 'Improvement', p6Text: 'We analyze real requests, refine scenarios, and add fields, filters, and automations.' },
    contact: { badge: 'Contact', title: 'Send a request — it will go to the backend, database, Google Sheets, and Telegram.', subtitle: 'The form below already sends a POST request to /api/leads. After .env setup, it becomes a real working lead flow.', formTitle: 'Consultation request', nameLabel: 'Name', namePlaceholder: 'Your name', contactLabel: 'Phone / Telegram', contactPlaceholder: '+380 or @username', nicheLabel: 'Business niche', nichePlaceholder: 'Select a niche', niche1: 'Clinic or dental practice', niche2: 'Beauty salon', niche3: 'Online school', niche4: 'Service company', niche5: 'Sales department', niche6: 'Other business', taskLabel: 'Short task description', taskPlaceholder: 'For example: we need an AI assistant for customer booking, FAQ replies, and Telegram admin alerts.', submit: 'Send request', success: 'Thank you! The lead has been created. If integrations are enabled, data has already gone to Google Sheets and Telegram.', error: 'Could not send the request. Check if the backend is running.', directTitle: 'Contacts', directText: 'Replace these placeholders before publishing.', telegram: 'Telegram', email: 'Email', phone: 'Phone', instagram: 'Instagram / LinkedIn' },
    admin: { badge: 'Admin panel', title: 'Internal lead dashboard from the database.', subtitle: 'Enter ADMIN_TOKEN from .env to view leads and update statuses.', tokenPlaceholder: 'ADMIN_TOKEN', saveToken: 'Save token', load: 'Load leads', total: 'Total', today: 'Today', id: 'ID', client: 'Client', niche: 'Niche', task: 'Task', status: 'Status', integrations: 'Integrations', created: 'Created', noData: 'No leads yet or the token is wrong.' }
  }
};

const STORAGE_KEY = 'avantLang';
const DEFAULT_LANG = 'uk';
const page = document.body.dataset.page || 'home';
let currentLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;

function getValue(path, lang = currentLang) {
  return path.split('.').reduce((acc, part) => acc && acc[part], translations[lang]);
}

function setLanguage(lang) {
  currentLang = translations[lang] ? lang : DEFAULT_LANG;
  localStorage.setItem(STORAGE_KEY, currentLang);
  document.documentElement.lang = translations[currentLang].langCode;

  const meta = translations[currentLang].meta[page] || translations[currentLang].meta.home;
  document.title = meta[0];
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta[1]);

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = getValue(el.dataset.i18n);
    if (value) el.textContent = value;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const value = getValue(el.dataset.i18nPlaceholder);
    if (value) el.setAttribute('placeholder', value);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const value = getValue(el.dataset.i18nAria);
    if (value) el.setAttribute('aria-label', value);
  });
  document.querySelectorAll('[data-lang]').forEach((btn) => btn.classList.toggle('active', btn.dataset.lang === currentLang));
  window.dispatchEvent(new CustomEvent('avant:language', { detail: { lang: currentLang } }));
}

function setupMenu() {
  const btn = document.querySelector('.menu-toggle');
  const panel = document.querySelector('#mobileMenu');
  if (!btn || !panel) return;
  const close = () => { btn.classList.remove('active'); panel.classList.remove('open'); document.body.classList.remove('menu-open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    btn.classList.toggle('active', open);
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .14 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function setupCanvas() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles;
  const resize = () => {
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    particles = Array.from({ length: Math.min(76, Math.floor(window.innerWidth / 18)) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .25 * devicePixelRatio, vy: (Math.random() - .5) * .25 * devicePixelRatio, r: (Math.random() * 1.8 + .7) * devicePixelRatio }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(185,243,255,.45)';
    particles.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j]; const dx = p.x - q.x; const dy = p.y - q.y; const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 150 * devicePixelRatio) {
          ctx.strokeStyle = `rgba(124,92,255,${(1 - d / (150 * devicePixelRatio)) * .18})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
    });
    requestAnimationFrame(draw);
  };
  resize(); draw(); window.addEventListener('resize', resize);
}

function setupCursorGlow() {
  const glow = document.querySelector('.cursor-glow');
  if (!glow) return;
  window.addEventListener('pointermove', (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  });
}

function setupContactForm() {
  const form = document.getElementById('leadForm');
  if (!form) return;
  const message = document.getElementById('formMessage');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.className = 'form-message';
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.language = currentLang;
    payload.page = page;
    payload.source = 'website';
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('API error');
      message.textContent = `${getValue('contact.success')} ID: ${data.lead.publicId}`;
      message.className = 'form-message show';
      form.reset();
    } catch (error) {
      message.textContent = getValue('contact.error');
      message.className = 'form-message show error';
    }
  });
}

function setupAdmin() {
  const root = document.getElementById('adminRoot');
  if (!root) return;
  const tokenInput = document.getElementById('adminToken');
  const saveBtn = document.getElementById('saveToken');
  const loadBtn = document.getElementById('loadLeads');
  const tableWrap = document.getElementById('leadsTable');
  const statsWrap = document.getElementById('adminStats');
  tokenInput.value = localStorage.getItem('avantAdminToken') || '';
  saveBtn.addEventListener('click', () => localStorage.setItem('avantAdminToken', tokenInput.value.trim()));
  loadBtn.addEventListener('click', loadLeads);

  async function loadLeads() {
    const token = tokenInput.value.trim();
    if (token) localStorage.setItem('avantAdminToken', token);
    try {
      const res = await fetch('/api/leads', { headers: { 'X-Admin-Token': token } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
      renderStats(data.stats);
      renderTable(data.leads);
    } catch (e) {
      statsWrap.innerHTML = '';
      tableWrap.innerHTML = `<p class="muted">${getValue('admin.noData')}</p>`;
    }
  }

  function renderStats(stats) {
    statsWrap.innerHTML = `
      <div class="stat-card"><strong>${stats.total}</strong><span>${getValue('admin.total')}</span></div>
      <div class="stat-card"><strong>${stats.today}</strong><span>${getValue('admin.today')}</span></div>
    `;
  }

  function renderTable(leads) {
    if (!leads.length) { tableWrap.innerHTML = `<p class="muted">${getValue('admin.noData')}</p>`; return; }
    tableWrap.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>${getValue('admin.id')}</th><th>${getValue('admin.client')}</th><th>${getValue('admin.niche')}</th><th>${getValue('admin.task')}</th><th>${getValue('admin.status')}</th><th>${getValue('admin.integrations')}</th><th>${getValue('admin.created')}</th></tr></thead>
        <tbody>${leads.map((lead) => `
          <tr>
            <td><strong>${lead.public_id}</strong></td>
            <td>${lead.name}<br><span class="muted">${lead.contact}</span></td>
            <td>${lead.niche}</td>
            <td>${lead.message}</td>
            <td><select data-status-id="${lead.id}">
              ${['new','in_progress','closed','cancelled'].map(s => `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select></td>
            <td><span class="badge ${lead.sheet_status}">Sheets: ${lead.sheet_status}</span><br><span class="badge ${lead.telegram_status}">TG: ${lead.telegram_status}</span></td>
            <td>${lead.created_at}</td>
          </tr>`).join('')}</tbody>
      </table>`;
    tableWrap.querySelectorAll('[data-status-id]').forEach((select) => {
      select.addEventListener('change', async () => {
        await fetch(`/api/leads/${select.dataset.statusId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': tokenInput.value.trim() }, body: JSON.stringify({ status: select.value }) });
        loadLeads();
      });
    });
  }
}

document.querySelectorAll('[data-lang]').forEach((btn) => btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));
document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === page));
setupMenu(); setupReveal(); setupCanvas(); setupCursorGlow(); setupContactForm(); setupAdmin(); setLanguage(currentLang);
