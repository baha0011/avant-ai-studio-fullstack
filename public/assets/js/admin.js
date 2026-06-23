(function () {
  const root = document.getElementById('adminV2Root');
  if (!root) return;

  const tokenInput = document.getElementById('adminToken');
  const saveBtn = document.getElementById('saveToken');
  const loadBtn = document.getElementById('loadLeads');
  const statusFilter = document.getElementById('adminStatusFilter');
  const searchInput = document.getElementById('adminSearch');
  const statsWrap = document.getElementById('adminStats');
  const board = document.getElementById('adminBoard');
  const drawer = document.getElementById('leadDrawer');
  const drawerBody = document.getElementById('leadDrawerBody');
  const drawerClose = document.getElementById('leadDrawerClose');

  let leads = [];

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function getToken() {
    return tokenInput.value.trim();
  }

  function saveToken() {
    const token = getToken();
    if (token) localStorage.setItem('avantAdminToken', token);
  }

  function statusLabel(status) {
    const map = {
      new: '🆕 New',
      in_progress: '🔄 In work',
      closed: '✅ Closed',
      cancelled: '❌ Cancelled'
    };
    return map[status] || status;
  }

  function statusActions(status = 'new') {
    const normalized = String(status || 'new');

    if (normalized === 'new') {
      return [
        { label: '🔄 В роботу', next: 'in_progress', style: 'secondary' },
        { label: '✅ Закрити', next: 'closed', style: 'primary' }
      ];
    }

    if (normalized === 'in_progress') {
      return [
        { label: '✅ Закрити', next: 'closed', style: 'primary' },
        { label: '🆕 Повернути в new', next: 'new', style: 'secondary' }
      ];
    }

    if (normalized === 'closed') {
      return [
        { label: '🔄 Повернути в роботу', next: 'in_progress', style: 'secondary' }
      ];
    }

    if (normalized === 'cancelled') {
      return [
        { label: '🔄 Повернути в роботу', next: 'in_progress', style: 'secondary' },
        { label: '🆕 Повернути в new', next: 'new', style: 'secondary' }
      ];
    }

    return [
      { label: '🔄 В роботу', next: 'in_progress', style: 'secondary' }
    ];
  }

  function scoreClass(label) {
    return label === 'hot' ? 'hot' : label === 'warm' ? 'warm' : 'cold';
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': getToken(),
        ...(options.headers || {})
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function loadLeads() {
    saveToken();

    const params = new URLSearchParams({
      limit: '500'
    });

    if (statusFilter.value) params.set('status', statusFilter.value);
    if (searchInput.value.trim()) params.set('q', searchInput.value.trim());

    board.innerHTML = '<p class="muted">Завантажуємо заявки...</p>';

    try {
      const data = await api(`/api/leads?${params.toString()}`);
      leads = data.leads || [];
      renderStats(data.stats || {});
      renderBoard();
    } catch (error) {
      statsWrap.innerHTML = '';
      board.innerHTML = `<p class="muted">Не вдалося завантажити заявки: ${escapeHtml(error.message)}</p>`;
    }
  }

  function renderStats(stats) {
    const scoreCounts = Object.fromEntries((stats.byScore || []).map((item) => [item.score, item.count]));
    statsWrap.innerHTML = `
      <div class="stat-card"><strong>${stats.total || 0}</strong><span>Усього</span></div>
      <div class="stat-card"><strong>${stats.today || 0}</strong><span>Сьогодні</span></div>
      <div class="stat-card"><strong>${stats.week || 0}</strong><span>За тиждень</span></div>
      <div class="stat-card"><strong>${stats.month || 0}</strong><span>За місяць</span></div>
      <div class="stat-card"><strong>${scoreCounts.hot || 0}</strong><span>Hot leads</span></div>
      <div class="stat-card"><strong>${scoreCounts.warm || 0}</strong><span>Warm leads</span></div>
    `;
  }

  function renderStatusButtons(lead, mode = 'card') {
    return statusActions(lead.status).map((action) => {
      if (mode === 'drawer') {
        const cls = action.style === 'primary' ? 'btn btn-primary' : 'btn btn-secondary';
        return `<button class="${cls}" type="button" data-drawer-status="${escapeHtml(action.next)}">${escapeHtml(action.label)}</button>`;
      }

      return `<button type="button" data-status="${escapeHtml(lead.id)}" data-next="${escapeHtml(action.next)}">${escapeHtml(action.label)}</button>`;
    }).join('');
  }

  function leadCard(lead) {
    const source = lead.source_details || {};
    const details = lead.lead_details || {};
    const message = details.description || lead.message || '';

    return `
      <article class="admin-lead-card" data-lead-card="${escapeHtml(lead.id)}">
        <div class="lead-card-top">
          <div>
            <strong>${escapeHtml(lead.public_id)}</strong>
            <span>${escapeHtml(new Date(lead.created_at).toLocaleString('uk-UA'))}</span>
          </div>
          <span class="lead-score ${scoreClass(lead.lead_score_label)}">${escapeHtml(lead.lead_score_emoji)} ${escapeHtml(lead.lead_score_title)} · ${lead.lead_score}/100</span>
        </div>

        <h3>${escapeHtml(lead.name)}</h3>
        <p class="muted">${escapeHtml(lead.contact)}</p>

        <div class="lead-card-meta">
          <span>${statusLabel(lead.status)}</span>
          <span>${escapeHtml(lead.niche)}</span>
          <span>${escapeHtml(source.utm_source || source.source || 'website')}</span>
        </div>

        <p class="lead-card-message">${escapeHtml(message).slice(0, 220)}${message.length > 220 ? '…' : ''}</p>

        <div class="lead-actions">
          <button type="button" data-open="${escapeHtml(lead.id)}">Картка</button>
          ${renderStatusButtons(lead)}
        </div>
      </article>
    `;
  }

  function renderBoard() {
    if (!leads.length) {
      board.innerHTML = '<p class="muted">Заявок поки немає або фільтр нічого не знайшов.</p>';
      return;
    }

    board.innerHTML = leads.map(leadCard).join('');

    board.querySelectorAll('[data-open]').forEach((button) => {
      button.addEventListener('click', () => openDrawer(button.dataset.open));
    });

    board.querySelectorAll('[data-status]').forEach((button) => {
      button.addEventListener('click', () => updateStatus(button.dataset.status, button.dataset.next));
    });
  }

  async function updateStatus(id, status) {
    const drawerWasOpen = drawer.classList.contains('open');

    try {
      await api(`/api/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await loadLeads();

      if (drawerWasOpen) {
        const refreshedLead = leads.find((item) => String(item.id) === String(id));
        if (refreshedLead) {
          openDrawer(id);
        } else {
          drawer.classList.remove('open');
        }
      }
    } catch (error) {
      alert(`Не вдалося змінити статус: ${error.message}`);
    }
  }

  function openDrawer(id) {
    const lead = leads.find((item) => String(item.id) === String(id));
    if (!lead) return;

    const source = lead.source_details || {};
    const details = lead.lead_details || {};

    drawerBody.innerHTML = `
      <div class="drawer-head">
        <span class="lead-score ${scoreClass(lead.lead_score_label)}">${escapeHtml(lead.lead_score_emoji)} ${escapeHtml(lead.lead_score_title)} · ${lead.lead_score}/100</span>
        <h2>${escapeHtml(lead.public_id)}</h2>
        <p>${escapeHtml(new Date(lead.created_at).toLocaleString('uk-UA'))}</p>
      </div>

      <div class="drawer-section">
        <h3>Клієнт</h3>
        <p><b>Імʼя:</b> ${escapeHtml(lead.name)}</p>
        <p><b>Контакт:</b> ${escapeHtml(lead.contact)}</p>
        <p><b>Ніша:</b> ${escapeHtml(lead.niche)}</p>
        <p><b>Статус:</b> ${statusLabel(lead.status)}</p>
      </div>

      <div class="drawer-section">
        <h3>Проєкт</h3>
        <p><b>Формат:</b> ${escapeHtml(details.format || '—')}</p>
        <p><b>Бюджет:</b> ${escapeHtml(details.budget || '—')}</p>
        <p><b>Канал:</b> ${escapeHtml(details.channel || '—')}</p>
        <p><b>Автоматизація:</b> ${escapeHtml(details.automation || '—')}</p>
      </div>

      <div class="drawer-section">
        <h3>Опис</h3>
        <p>${escapeHtml(details.description || lead.message || '—')}</p>
      </div>

      <div class="drawer-section">
        <h3>Джерело</h3>
        <p><b>Source:</b> ${escapeHtml(source.utm_source || source.source || 'website')}</p>
        <p><b>Campaign:</b> ${escapeHtml(source.utm_campaign || '—')}</p>
        <p><b>Medium:</b> ${escapeHtml(source.utm_medium || '—')}</p>
        <p><b>Page:</b> ${escapeHtml(source.page || source.landingPage || '—')}</p>
        <p><b>Referrer:</b> ${escapeHtml(source.referrer || '—')}</p>
      </div>

      <div class="drawer-actions">
        ${renderStatusButtons(lead, 'drawer')}
      </div>
    `;

    drawer.classList.add('open');

    drawerBody.querySelectorAll('[data-drawer-status]').forEach((button) => {
      button.addEventListener('click', () => updateStatus(lead.id, button.dataset.drawerStatus));
    });
  }

  tokenInput.value = localStorage.getItem('avantAdminToken') || '';
  saveBtn.addEventListener('click', saveToken);
  loadBtn.addEventListener('click', loadLeads);
  statusFilter.addEventListener('change', loadLeads);
  searchInput.addEventListener('input', () => {
    clearTimeout(searchInput._timer);
    searchInput._timer = setTimeout(loadLeads, 250);
  });

  drawerClose.addEventListener('click', () => drawer.classList.remove('open'));
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) drawer.classList.remove('open');
  });

  if (tokenInput.value) loadLeads();
})();
