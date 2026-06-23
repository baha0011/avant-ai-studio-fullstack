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

  let leads = [];
  let stats = {};
  let activeStatus = '';
  let activeLeadId = null;

  const STATUS_META = {
    new: { label: 'New', icon: '🆕', className: 'new' },
    in_progress: { label: 'In work', icon: '🔄', className: 'in-progress' },
    closed: { label: 'Closed', icon: '✅', className: 'closed' },
    cancelled: { label: 'Cancelled', icon: '❌', className: 'cancelled' }
  };

  const NICHE_MAP = {
    clinic: 'Клініка / стоматологія',
    beauty: 'Салон краси',
    education: 'Онлайн-школа',
    service: 'Сервісна компанія',
    sales: 'Відділ продажів',
    other: 'Інший бізнес'
  };

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
    return STATUS_META[status] || { label: status || 'new', icon: '•', className: 'new' };
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

    return [
      { label: 'В роботу', next: 'in_progress', icon: '🔄', type: 'secondary' }
    ];
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

      if (button) {
        const oldText = button.textContent;
        button.textContent = '✓';
        button.classList.add('copied');

        setTimeout(() => {
          button.textContent = oldText;
          button.classList.remove('copied');
        }, 900);
      }
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

      if (button) {
        const oldText = button.textContent;
        button.textContent = '✓';
        setTimeout(() => {
          button.textContent = oldText;
        }, 900);
      }
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

      if (activeLeadId) {
        const stillExists = leads.find((lead) => String(lead.id) === String(activeLeadId));
        if (stillExists && drawer.classList.contains('open')) openDrawer(activeLeadId);
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
    const format = details.format || 'Формат не вказано';
    const budget = details.budget || 'Бюджет не вказано';
    return { format, budget };
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
              <span>${escapeHtml(clientContact(lead))}</span>
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
          <span>${escapeHtml(clientContact(lead))}</span>
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
  }

  async function updateStatus(id, status) {
    const previousText = event?.target?.textContent;

    try {
      await api(`/api/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      activeLeadId = id;
      await loadLeads();
    } catch (error) {
      alert(`Не вдалося змінити статус: ${error.message}`);
      if (event?.target && previousText) event.target.textContent = previousText;
    }
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
      </div>

      <div class="crm-drawer-grid">
        <section class="crm-info-block">
          <h3>Клієнт</h3>
          <dl>
            <div><dt>Імʼя</dt><dd>${escapeHtml(lead.name || '—')}</dd></div>
            <div><dt>Контакт</dt><dd>${escapeHtml(clientContact(lead))}</dd></div>
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

  statusFilter.addEventListener('change', () => {
    activeStatus = statusFilter.value;
    pipeline.querySelectorAll('[data-status]').forEach((button) => {
      button.classList.toggle('active', button.dataset.status === activeStatus);
    });
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
