(function () {
  const root = document.getElementById('adminCrmRoot');
  if (!root) return;

  const tokenInput = document.getElementById('adminToken');
  const saveBtn = document.getElementById('saveToken');
  const loadBtn = document.getElementById('loadLeads');
  const statusFilter = document.getElementById('adminStatusFilter');
  const searchInput = document.getElementById('adminSearch');
  const statsWrap = document.getElementById('adminStats');
  const pipeline = document.getElementById('crmPipeline');
  const tableBody = document.getElementById('crmLeadList');
  const mobileList = document.getElementById('crmMobileList');
  const heroCount = document.getElementById('crmHeroCount');
  const drawer = document.getElementById('leadDrawer');
  const drawerBody = document.getElementById('leadDrawerBody');
  const drawerClose = document.getElementById('leadDrawerClose');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const summaryReportBtn = document.getElementById('summaryReportBtn');

  let leads = [];
  let stats = {};
  let activeStatus = '';
  let activeLeadId = null;

  const STATUS_META = {
    new: { label: 'New', human: 'Нова', icon: '🆕', className: 'new' },
    in_progress: { label: 'In work', human: 'В роботі', icon: '🔄', className: 'in-progress' },
    closed: { label: 'Closed', human: 'Закрита', icon: '✅', className: 'closed' },
    cancelled: { label: 'Cancelled', human: 'Скасована', icon: '❌', className: 'cancelled' }
  };

  const NICHE_MAP = {
    clinic: 'Клініка / стоматологія',
    beauty: 'Салон краси',
    education: 'Онлайн-школа',
    service: 'Сервісна компанія',
    sales: 'Відділ продажів',
    other: 'Інший бізнес'
  };

  function isManagerRole() {
    return window.AVANT_ADMIN_USER?.role === 'manager' || document.body.dataset.adminRole === 'manager';
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function clean(value = '') {
    return String(value || '').trim();
  }

  function formatNiche(niche = '') {
    return NICHE_MAP[niche] || niche || '—';
  }

  function formatDate(value = '') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '—';

    return new Intl.DateTimeFormat('uk-UA', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function getStatusMeta(status = 'new') {
    return STATUS_META[status] || { label: status || 'new', human: status || 'new', icon: '•', className: 'new' };
  }

  function statusBadge(status = 'new') {
    const meta = getStatusMeta(status);
    return `<span class="crm-status ${meta.className}">${meta.icon} ${meta.label}</span>`;
  }

  function scoreClass(label = '') {
    return label === 'hot' ? 'hot' : label === 'warm' ? 'warm' : 'cold';
  }

  function scoreBadge(lead) {
    return `<span class="crm-score ${scoreClass(lead.lead_score_label)}">${escapeHtml(lead.lead_score_emoji || '⚪')} ${escapeHtml(lead.lead_score_title || 'Cold lead')} · ${Number(lead.lead_score || 0)}/100</span>`;
  }

  function getTelegramUrl(contact = '') {
    const value = clean(contact);

    if (/^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
      return `https://t.me/${value.slice(1)}`;
    }

    const match = value.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})/i);
    if (match) return `https://t.me/${match[1]}`;

    return '';
  }

  function statusActions(status = 'new') {
    if (status === 'new') {
      return [
        { label: 'В роботу', next: 'in_progress', icon: '🔄', type: 'secondary' },
        { label: 'Закрити', next: 'closed', icon: '✅', type: 'primary' }
      ];
    }

    if (status === 'in_progress') {
      return [
        { label: 'Закрити', next: 'closed', icon: '✅', type: 'primary' },
        { label: 'В new', next: 'new', icon: '🆕', type: 'secondary' }
      ];
    }

    if (status === 'closed') {
      return [
        { label: 'В роботу', next: 'in_progress', icon: '🔄', type: 'secondary' }
      ];
    }

    if (status === 'cancelled') {
      return [
        { label: 'В роботу', next: 'in_progress', icon: '🔄', type: 'secondary' },
        { label: 'В new', next: 'new', icon: '🆕', type: 'secondary' }
      ];
    }

    return [{ label: 'В роботу', next: 'in_progress', icon: '🔄', type: 'secondary' }];
  }

  function getToken() {
    return tokenInput.value.trim();
  }

  function saveToken() {
    const token = getToken();
    if (token) localStorage.setItem('avantAdminToken', token);
  }

  async function copyText(value, button = null) {
    const text = String(value || '').trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    if (button) {
      const oldText = button.textContent;
      button.textContent = '✓';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = oldText;
        button.classList.remove('copied');
      }, 900);
    }
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': getToken(),
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async function loadLeads() {
    saveToken();

    const params = new URLSearchParams({ limit: '500' });
    if (activeStatus) params.set('status', activeStatus);
    if (searchInput.value.trim()) params.set('q', searchInput.value.trim());

    setLoading(true);

    try {
      const data = await api(`/api/leads?${params.toString()}`);
      leads = data.leads || [];
      stats = data.stats || {};
      renderAll();

      if (activeLeadId && drawer.classList.contains('open')) {
        const stillExists = leads.find((lead) => String(lead.id) === String(activeLeadId));
        if (stillExists) openDrawer(activeLeadId);
      }
    } catch (error) {
      leads = [];
      stats = {};
      renderStats();
      renderPipeline();
      renderEmpty(`Не вдалося завантажити CRM: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    loadBtn.disabled = isLoading;
    loadBtn.textContent = isLoading ? 'Оновлюємо...' : 'Оновити CRM';
  }

  function renderAll() {
    renderStats();
    renderPipeline();
    renderList();
  }

  function countByStatus() {
    const map = { new: 0, in_progress: 0, closed: 0, cancelled: 0 };
    (stats.byStatus || []).forEach((item) => {
      map[item.status] = item.count;
    });
    return map;
  }

  function countByScore() {
    const map = { hot: 0, warm: 0, cold: 0 };
    (stats.byScore || []).forEach((item) => {
      map[item.score] = item.count;
    });
    return map;
  }

  function renderStats() {
    if (isManagerRole()) {
      if (statsWrap) statsWrap.hidden = true;
      if (pipeline) pipeline.hidden = true;
      if (heroCount) heroCount.textContent = '—';
      return;
    }

    if (statsWrap) statsWrap.hidden = false;
    if (pipeline) pipeline.hidden = false;

    const score = countByScore();
    const total = stats.total || 0;
    if (heroCount) heroCount.textContent = String(total);

    statsWrap.innerHTML = `
      <div class="crm-stat"><span>Усього</span><strong>${total}</strong><small>всі заявки</small></div>
      <div class="crm-stat"><span>Сьогодні</span><strong>${stats.today || 0}</strong><small>нові за день</small></div>
      <div class="crm-stat"><span>Тиждень</span><strong>${stats.week || 0}</strong><small>за поточний тиждень</small></div>
      <div class="crm-stat"><span>Місяць</span><strong>${stats.month || 0}</strong><small>за поточний місяць</small></div>
      <div class="crm-stat hot"><span>Hot</span><strong>${score.hot || 0}</strong><small>пріоритетні</small></div>
      <div class="crm-stat warm"><span>Warm</span><strong>${score.warm || 0}</strong><small>перспективні</small></div>
    `;
  }

  function renderPipeline() {
    const byStatus = countByStatus();
    const total = stats.total || 0;

    pipeline.querySelectorAll('[data-status]').forEach((button) => {
      const status = button.dataset.status;
      const count = status ? byStatus[status] || 0 : total;
      button.classList.toggle('active', status === activeStatus);
      const span = button.querySelector('span');
      if (span) span.textContent = String(count);
    });

    statusFilter.value = activeStatus;
  }

  function renderEmpty(text) {
    tableBody.innerHTML = `<tr><td colspan="7" class="crm-empty">${escapeHtml(text)}</td></tr>`;
    mobileList.innerHTML = `<p class="crm-empty mobile">${escapeHtml(text)}</p>`;
  }

  function shortProject(lead) {
    const details = lead.lead_details || {};
    return {
      format: details.format || 'Формат не вказано',
      budget: details.budget || 'Бюджет не вказано'
    };
  }

  function sourceLabel(lead) {
    const source = lead.source_details || {};
    return source.utm_source || source.source || lead.source || 'website';
  }

  function sourceSubLabel(lead) {
    const source = lead.source_details || {};
    return source.utm_campaign || source.page || lead.page || '—';
  }

  function clientContact(lead) {
    return lead.contact || '—';
  }

  function contactWithCopy(lead) {
    const contact = clientContact(lead);
    const tgUrl = getTelegramUrl(contact);

    return `
      <div class="crm-contact-line">
        <span>${escapeHtml(contact)}</span>
        <button class="copy-id-btn" type="button" data-copy-contact="${escapeHtml(contact)}" title="Скопіювати контакт">⧉</button>
        ${tgUrl ? `<a class="copy-id-btn tg-open-btn" href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener" title="Написати клієнту">💬</a>` : ''}
      </div>
    `;
  }

  function actionButtons(lead, compact = false) {
    return statusActions(lead.status).map((action) => `
      <button
        class="crm-action ${action.type}"
        type="button"
        data-status-action="${escapeHtml(lead.id)}"
        data-next="${escapeHtml(action.next)}"
        title="${escapeHtml(action.label)}"
      >
        ${action.icon} ${compact ? '' : escapeHtml(action.label)}
      </button>
    `).join('');
  }

  function renderList() {
    if (!leads.length) {
      renderEmpty('Заявок не знайдено.');
      return;
    }

    tableBody.innerHTML = leads.map((lead) => {
      const project = shortProject(lead);

      return `
        <tr class="crm-row" data-open-lead="${escapeHtml(lead.id)}">
          <td>
            <div class="crm-lead-id">
              ${scoreBadge(lead)}
              <div class="crm-id-line">
                <strong>${escapeHtml(lead.public_id)}</strong>
                <button class="copy-id-btn" type="button" data-copy-id="${escapeHtml(lead.public_id)}" title="Скопіювати ID">⧉</button>
              </div>
            </div>
          </td>

          <td>
            <div class="crm-client">
              <strong>${escapeHtml(lead.name || 'Без імені')}</strong>
              ${contactWithCopy(lead)}
              <small>${escapeHtml(formatNiche(lead.niche))}</small>
            </div>
          </td>

          <td>
            <div class="crm-project">
              <strong>${escapeHtml(project.format)}</strong>
              <span>${escapeHtml(project.budget)}</span>
            </div>
          </td>

          <td>
            <div class="crm-source">
              <strong>${escapeHtml(sourceLabel(lead))}</strong>
              <span>${escapeHtml(sourceSubLabel(lead))}</span>
            </div>
          </td>

          <td>${statusBadge(lead.status)}</td>

          <td>
            <div class="crm-date">
              <strong>${escapeHtml(formatDate(lead.created_at))}</strong>
              <span>${escapeHtml(lead.language || 'uk')}</span>
            </div>
          </td>

          <td>
            <div class="crm-row-actions">
              <button class="crm-action ghost" type="button" data-open-button="${escapeHtml(lead.id)}">Картка</button>
              ${actionButtons(lead, true)}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    mobileList.innerHTML = leads.map((lead) => {
      const project = shortProject(lead);

      return `
        <article class="crm-mobile-card" data-open-lead="${escapeHtml(lead.id)}">
          <div class="crm-mobile-top">
            ${scoreBadge(lead)}
            ${statusBadge(lead.status)}
          </div>
          <strong>${escapeHtml(lead.name || 'Без імені')}</strong>
          ${contactWithCopy(lead)}
          <p>${escapeHtml(project.format)}</p>
          <div class="crm-mobile-meta">
            <small>${escapeHtml(lead.public_id)}</small>
            <small>${escapeHtml(formatDate(lead.created_at))}</small>
          </div>
          <div class="crm-row-actions">
            <button class="crm-action ghost" type="button" data-open-button="${escapeHtml(lead.id)}">Картка</button>
            ${actionButtons(lead, true)}
          </div>
        </article>
      `;
    }).join('');

    bindListEvents();
  }

  function bindListEvents() {
    document.querySelectorAll('[data-open-lead]').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('button, select, a')) return;
        openDrawer(row.dataset.openLead);
      });
    });

    document.querySelectorAll('[data-open-button]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openDrawer(button.dataset.openButton);
      });
    });

    document.querySelectorAll('[data-status-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        updateStatus(button.dataset.statusAction, button.dataset.next);
      });
    });

    document.querySelectorAll('[data-copy-id]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        copyText(button.dataset.copyId, button);
      });
    });

    document.querySelectorAll('[data-copy-contact]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        copyText(button.dataset.copyContact, button);
      });
    });
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      activeLeadId = id;
      await loadLeads();
    } catch (error) {
      alert(`Не вдалося змінити статус: ${error.message}`);
    }
  }

  async function saveManagerNote(id) {
    const textarea = drawerBody.querySelector('#managerNote');
    const comment = textarea?.value?.trim();

    if (!comment) {
      alert('Напишіть коментар менеджера.');
      return;
    }

    try {
      await api(`/api/leads/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ comment })
      });

      textarea.value = '';
      await renderLeadLogs(id);
    } catch (error) {
      alert(`Не вдалося зберегти коментар: ${error.message}`);
    }
  }

  function parseLogMessage(log) {
    const raw = String(log.message || '');

    if (log.channel === 'manager_note') {
      try {
        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === 'object') {
          return {
            author: parsed.author || parsed.authorEmail || 'CRM user',
            authorEmail: parsed.authorEmail || '',
            role: parsed.role || '',
            comment: parsed.comment || raw,
            isStructured: true
          };
        }
      } catch {
        return {
          author: 'Старий коментар',
          authorEmail: '',
          role: '',
          comment: raw,
          isStructured: false
        };
      }
    }

    return {
      author: '',
      authorEmail: '',
      role: '',
      comment: raw,
      isStructured: false
    };
  }

  function renderLogItem(log) {
    const parsed = parseLogMessage(log);
    const isNote = log.channel === 'manager_note';

    if (isNote) {
      return `
        <article class="crm-log-item manager_note crm-comment-log">
          <div class="crm-comment-log-head">
            <strong>${escapeHtml(parsed.author || 'CRM user')}</strong>
            ${parsed.role ? `<span>${escapeHtml(parsed.role)}</span>` : ''}
          </div>
          ${parsed.authorEmail ? `<small class="crm-comment-author-email">${escapeHtml(parsed.authorEmail)}</small>` : ''}
          <p>${escapeHtml(parsed.comment || '')}</p>
          <small>${escapeHtml(formatDate(log.created_at))}</small>
        </article>
      `;
    }

    return `
      <article class="crm-log-item ${escapeHtml(log.channel || '')}">
        <div>
          <strong>${escapeHtml(log.channel || 'log')}</strong>
          <span>${escapeHtml(log.status || '')}</span>
        </div>
        <p>${escapeHtml(parsed.comment || '')}</p>
        <small>${escapeHtml(formatDate(log.created_at))}</small>
      </article>
    `;
  }

  async function renderLeadLogs(id) {
    const logsWrap = drawerBody.querySelector('#leadLogs');
    if (!logsWrap) return;

    logsWrap.innerHTML = '<p class="muted">Завантажуємо історію...</p>';

    try {
      const data = await api(`/api/leads/${id}/logs`);
      const logs = data.logs || [];

      if (!logs.length) {
        logsWrap.innerHTML = '<p class="muted">Історія поки порожня.</p>';
        return;
      }

      logsWrap.innerHTML = logs.map(renderLogItem).join('');
    } catch (error) {
      logsWrap.innerHTML = `<p class="muted">Не вдалося завантажити історію: ${escapeHtml(error.message)}</p>`;
    }
  }

  function openAuditReport(lead) {
    const details = lead.lead_details || {};
    const source = lead.source_details || {};
    const scoreReasons = Array.isArray(lead.lead_score_reasons) ? lead.lead_score_reasons : [];

    const reportHtml = `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>AI Audit Report — ${escapeHtml(lead.public_id)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 42px; line-height: 1.5; }
    .top { border-bottom: 3px solid #111827; padding-bottom: 18px; margin-bottom: 26px; }
    h1 { margin: 0; font-size: 30px; }
    h2 { margin-top: 30px; font-size: 18px; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #eef2ff; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .card { border: 1px solid #d1d5db; border-radius: 14px; padding: 16px; }
    .muted { color: #6b7280; }
    ul { padding-left: 20px; }
    button { margin-bottom: 20px; padding: 10px 14px; border-radius: 10px; border: 1px solid #d1d5db; background: #111827; color: white; cursor: pointer; }
    @media print { body { padding: 18px; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Save as PDF / Print</button>

  <div class="top">
    <p class="badge">Avant AI Studio</p>
    <h1>AI Audit Report</h1>
    <p class="muted">Заявка: ${escapeHtml(lead.public_id)} · ${escapeHtml(formatDate(lead.created_at))}</p>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Клієнт</h2>
      <p><b>Імʼя:</b> ${escapeHtml(lead.name || '—')}</p>
      <p><b>Контакт:</b> ${escapeHtml(lead.contact || '—')}</p>
      <p><b>Ніша:</b> ${escapeHtml(formatNiche(lead.niche))}</p>
    </div>

    <div class="card">
      <h2>Lead Quality</h2>
      <p><b>Score:</b> ${escapeHtml(String(lead.lead_score || 0))}/100</p>
      <p><b>Quality:</b> ${escapeHtml(lead.lead_score_title || 'Cold lead')}</p>
      <p><b>Reasons:</b> ${escapeHtml(scoreReasons.join(', ') || '—')}</p>
    </div>
  </div>

  <h2>Поточна задача</h2>
  <div class="card">
    <p><b>Формат:</b> ${escapeHtml(details.format || '—')}</p>
    <p><b>Бюджет:</b> ${escapeHtml(details.budget || '—')}</p>
    <p><b>Канал:</b> ${escapeHtml(details.channel || '—')}</p>
    <p><b>Автоматизація:</b> ${escapeHtml(details.automation || '—')}</p>
    <p><b>Опис:</b> ${escapeHtml(details.description || lead.message || '—')}</p>
  </div>

  <h2>Рекомендований MVP</h2>
  <div class="card">
    <ul>
      <li>Збір заявки через форму або Telegram.</li>
      <li>Автоматичне збереження в базу даних.</li>
      <li>Google Sheets як простий операційний центр.</li>
      <li>Telegram-сповіщення адміну з кнопками статусу.</li>
      <li>CRM-панель для пошуку, статусів, коментарів і контролю заявок.</li>
    </ul>
  </div>

  <h2>Джерело заявки</h2>
  <div class="card">
    <p><b>Source:</b> ${escapeHtml(source.utm_source || source.source || lead.source || 'website')}</p>
    <p><b>Campaign:</b> ${escapeHtml(source.utm_campaign || '—')}</p>
    <p><b>Page:</b> ${escapeHtml(source.page || source.landingPage || lead.page || '—')}</p>
  </div>
</body>
</html>
`;

    const win = window.open('', '_blank');
    if (!win) return alert('Браузер заблокував відкриття звіту.');
    win.document.write(reportHtml);
    win.document.close();
  }

  function openSummaryReport() {
    const byStatus = countByStatus();
    const byScore = countByScore();

    const reportHtml = `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>CRM Summary Report — Avant AI Studio</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 42px; line-height: 1.5; }
    h1 { margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 24px 0; }
    .card { border: 1px solid #d1d5db; border-radius: 14px; padding: 16px; }
    .card strong { display: block; font-size: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    button { margin-bottom: 20px; padding: 10px 14px; border-radius: 10px; border: 1px solid #d1d5db; background: #111827; color: white; cursor: pointer; }
    @media print { button { display: none; } body { padding: 18px; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Save as PDF / Print</button>
  <h1>CRM Summary Report</h1>
  <p>Avant AI Studio · ${escapeHtml(new Date().toLocaleString('uk-UA'))}</p>

  <div class="grid">
    <div class="card"><span>Усього</span><strong>${stats.total || 0}</strong></div>
    <div class="card"><span>Сьогодні</span><strong>${stats.today || 0}</strong></div>
    <div class="card"><span>Тиждень</span><strong>${stats.week || 0}</strong></div>
    <div class="card"><span>Місяць</span><strong>${stats.month || 0}</strong></div>
    <div class="card"><span>Hot</span><strong>${byScore.hot || 0}</strong></div>
    <div class="card"><span>Warm</span><strong>${byScore.warm || 0}</strong></div>
  </div>

  <h2>Pipeline</h2>
  <div class="grid">
    <div class="card"><span>New</span><strong>${byStatus.new || 0}</strong></div>
    <div class="card"><span>In work</span><strong>${byStatus.in_progress || 0}</strong></div>
    <div class="card"><span>Closed</span><strong>${byStatus.closed || 0}</strong></div>
  </div>

  <h2>Leads</h2>
  <table>
    <thead><tr><th>ID</th><th>Клієнт</th><th>Статус</th><th>Score</th><th>Джерело</th></tr></thead>
    <tbody>
      ${leads.map((lead) => `
        <tr>
          <td>${escapeHtml(lead.public_id)}</td>
          <td>${escapeHtml(lead.name || '')}</td>
          <td>${escapeHtml(lead.status || '')}</td>
          <td>${escapeHtml(String(lead.lead_score || 0))}/100</td>
          <td>${escapeHtml(sourceLabel(lead))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
`;

    const win = window.open('', '_blank');
    if (!win) return alert('Браузер заблокував відкриття звіту.');
    win.document.write(reportHtml);
    win.document.close();
  }

  function downloadCsv() {
    if (!leads.length) return alert('Спочатку завантажте заявки.');

    const headers = ['Public ID', 'Name', 'Contact', 'Niche', 'Status', 'Lead Score', 'Quality', 'Source', 'Created At'];
    const rows = leads.map((lead) => [
      lead.public_id,
      lead.name,
      lead.contact,
      formatNiche(lead.niche),
      lead.status,
      lead.lead_score,
      lead.lead_score_title,
      sourceLabel(lead),
      formatDate(lead.created_at)
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `avant-crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function openDrawer(id) {
    const lead = leads.find((item) => String(item.id) === String(id));
    if (!lead) return;

    activeLeadId = id;

    const details = lead.lead_details || {};
    const source = lead.source_details || {};
    const scoreReasons = Array.isArray(lead.lead_score_reasons) ? lead.lead_score_reasons : [];

    drawerBody.innerHTML = `
      <div class="crm-drawer-head">
        <div>
          ${scoreBadge(lead)}
          <div class="crm-drawer-id-line">
            <h2>${escapeHtml(lead.public_id)}</h2>
            <button class="copy-id-btn" type="button" data-copy-id="${escapeHtml(lead.public_id)}" title="Скопіювати ID">⧉</button>
          </div>
          <p>${escapeHtml(formatDate(lead.created_at))}</p>
        </div>
        ${statusBadge(lead.status)}
      </div>

      <div class="crm-drawer-actions">
        ${actionButtons(lead)}
        <button class="crm-action ghost" type="button" id="auditReportBtn">📄 AI Audit PDF</button>
      </div>

      <div class="crm-drawer-grid">
        <section class="crm-info-block">
          <h3>Клієнт</h3>
          <dl>
            <div><dt>Імʼя</dt><dd>${escapeHtml(lead.name || '—')}</dd></div>
            <div><dt>Контакт</dt><dd>${contactWithCopy(lead)}</dd></div>
            <div><dt>Ніша</dt><dd>${escapeHtml(formatNiche(lead.niche))}</dd></div>
            <div><dt>Мова</dt><dd>${escapeHtml(lead.language || 'uk')}</dd></div>
          </dl>
        </section>

        <section class="crm-info-block">
          <h3>Проєкт</h3>
          <dl>
            <div><dt>Формат</dt><dd>${escapeHtml(details.format || '—')}</dd></div>
            <div><dt>Бюджет</dt><dd>${escapeHtml(details.budget || '—')}</dd></div>
            <div><dt>Канал</dt><dd>${escapeHtml(details.channel || '—')}</dd></div>
            <div><dt>Автоматизація</dt><dd>${escapeHtml(details.automation || '—')}</dd></div>
          </dl>
        </section>

        <section class="crm-info-block full">
          <h3>Опис задачі</h3>
          <p>${escapeHtml(details.description || lead.message || '—')}</p>
        </section>

        <section class="crm-info-block">
          <h3>Джерело</h3>
          <dl>
            <div><dt>Source</dt><dd>${escapeHtml(source.utm_source || source.source || lead.source || 'website')}</dd></div>
            <div><dt>Campaign</dt><dd>${escapeHtml(source.utm_campaign || '—')}</dd></div>
            <div><dt>Medium</dt><dd>${escapeHtml(source.utm_medium || '—')}</dd></div>
            <div><dt>Page</dt><dd>${escapeHtml(source.page || source.landingPage || lead.page || '—')}</dd></div>
            <div><dt>Referrer</dt><dd>${escapeHtml(source.referrer || '—')}</dd></div>
          </dl>
        </section>

        <section class="crm-info-block">
          <h3>Lead scoring</h3>
          <dl>
            <div><dt>Score</dt><dd>${escapeHtml(String(lead.lead_score || 0))}/100</dd></div>
            <div><dt>Quality</dt><dd>${escapeHtml(lead.lead_score_title || 'Cold lead')}</dd></div>
            <div><dt>Reasons</dt><dd>${escapeHtml(scoreReasons.join(', ') || '—')}</dd></div>
          </dl>
        </section>

        <section class="crm-info-block full crm-comments-workspace">
          <div class="crm-comment-editor">
            <h3>Коментар менеджера</h3>
            <p class="muted">Окреме робоче поле для нотаток по ліду. В історії буде видно, хто залишив коментар.</p>
            <textarea id="managerNote" class="crm-note-textarea" placeholder="Наприклад: написав клієнту, чекаю відповідь, бюджет підтвердив..."></textarea>
            <button class="btn btn-primary crm-note-save" type="button" id="saveManagerNoteBtn">Зберегти коментар</button>
          </div>

          <div class="crm-comment-history">
            <h3>Історія дій і коментарів</h3>
            <div class="crm-logs" id="leadLogs">
              <p class="muted">Завантажуємо історію...</p>
            </div>
          </div>
        </section>
      </div>
    `;

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');

    drawerBody.querySelectorAll('[data-status-action]').forEach((button) => {
      button.addEventListener('click', () => updateStatus(button.dataset.statusAction, button.dataset.next));
    });

    drawerBody.querySelectorAll('[data-copy-id]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        copyText(button.dataset.copyId, button);
      });
    });

    drawerBody.querySelectorAll('[data-copy-contact]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        copyText(button.dataset.copyContact, button);
      });
    });

    drawerBody.querySelector('#saveManagerNoteBtn')?.addEventListener('click', () => saveManagerNote(lead.id));
    drawerBody.querySelector('#auditReportBtn')?.addEventListener('click', () => openAuditReport(lead));

    renderLeadLogs(lead.id);
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    activeLeadId = null;
  }

  tokenInput.value = localStorage.getItem('avantAdminToken') || '';

  saveBtn.addEventListener('click', () => {
    saveToken();
    saveBtn.textContent = 'Збережено';
    setTimeout(() => {
      saveBtn.textContent = 'Зберегти';
    }, 900);
  });

  loadBtn.addEventListener('click', loadLeads);
  exportCsvBtn?.addEventListener('click', downloadCsv);
  summaryReportBtn?.addEventListener('click', openSummaryReport);

  statusFilter.addEventListener('change', () => {
    activeStatus = statusFilter.value;
    loadLeads();
  });

  pipeline.querySelectorAll('[data-status]').forEach((button) => {
    button.addEventListener('click', () => {
      activeStatus = button.dataset.status;
      statusFilter.value = activeStatus;
      loadLeads();
    });
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchInput._timer);
    searchInput._timer = setTimeout(loadLeads, 250);
  });

  drawerClose.addEventListener('click', closeDrawer);
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) closeDrawer();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  if (tokenInput.value) loadLeads();
})();
