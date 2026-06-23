(function () {
  const root = document.getElementById('adminCrmRoot');
  const drawer = document.getElementById('leadDrawer');
  const drawerBody = document.getElementById('leadDrawerBody');
  const tokenInput = document.getElementById('adminToken');

  if (!root || !drawer || !drawerBody) return;

  const STAGES = {
    new: 'Нова',
    contacted: 'Звʼязались',
    diagnostics: 'Діагностика',
    proposal: 'Пропозиція',
    decision: 'Очікує рішення',
    paid: 'Оплачено',
    closed: 'Закрито',
    rejected: 'Відмова'
  };

  let currentUser = window.AVANT_ADMIN_USER || null;
  let leadsCache = [];
  let refreshPromise = null;
  let enhanceTimer = null;

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function getToken() {
    return tokenInput?.value?.trim() || '';
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
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

  function crmMeta(lead = {}) {
    const meta = lead.meta_json || {};
    return meta.crm && typeof meta.crm === 'object' ? meta.crm : {};
  }

  function leadById(id) {
    return leadsCache.find((lead) => String(lead.id) === String(id)) || null;
  }

  function assigneeLabel(lead) {
    const assignee = crmMeta(lead).assigned_to || {};
    return assignee.name || assignee.email || '';
  }

  function stageValue(lead) {
    return crmMeta(lead).sales_stage || (lead.status === 'new' ? 'new' : 'contacted');
  }

  function isAssignedToCurrentUser(lead) {
    const assignee = crmMeta(lead).assigned_to || {};
    return currentUser && String(assignee.id || '') === String(currentUser.id || '');
  }

  function canTakeLead(lead) {
    if (!currentUser || !lead) return false;

    const assignee = crmMeta(lead).assigned_to || {};

    if (!assignee.id) return true;
    if (isAssignedToCurrentUser(lead)) return false;

    return currentUser.role === 'admin' || currentUser.role === 'super_admin';
  }

  async function loadMe() {
    try {
      const data = await api('/api/admin/me');
      currentUser = data.user;
      window.AVANT_ADMIN_USER = data.user;
    } catch {
      currentUser = window.AVANT_ADMIN_USER || null;
    }
  }

  async function refreshLeadsCache() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = api('/api/leads?limit=500')
      .then((data) => {
        leadsCache = data.leads || [];
        return leadsCache;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function stageSelectHtml(lead) {
    const current = stageValue(lead);

    return `
      <select class="crm-stage-select" data-v3-stage="${escapeHtml(lead.id)}">
        ${Object.entries(STAGES).map(([value, label]) => `
          <option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>
        `).join('')}
      </select>
    `;
  }

  function enhanceRows() {
    document.querySelectorAll('[data-open-button]').forEach((openBtn) => {
      const id = openBtn.dataset.openButton;
      const lead = leadById(id);
      const actions = openBtn.closest('.crm-row-actions');

      if (!actions || !lead || actions.dataset.crmV3Enhanced === '1') return;

      actions.dataset.crmV3Enhanced = '1';

      const assignee = assigneeLabel(lead);
      const stage = STAGES[stageValue(lead)] || '—';

      const chip = document.createElement('span');
      chip.className = 'crm-v3-chip';
      chip.textContent = assignee ? `👤 ${assignee}` : `🧭 ${stage}`;
      actions.appendChild(chip);

      if (canTakeLead(lead)) {
        const btn = document.createElement('button');
        btn.className = 'crm-action secondary crm-v3-take-mini';
        btn.type = 'button';
        btn.dataset.v3Assign = id;
        btn.textContent = 'Взяти';
        actions.appendChild(btn);
      }
    });
  }

  function renderAiResult(box, insights, lead) {
    const tgUrl = getTelegramUrl(lead.contact || '');

    box.innerHTML = `
      <div class="crm-ai-result">
        <div>
          <span class="crm-v3-chip ai">AI Summary</span>
          <p>${escapeHtml(insights.summary || '—')}</p>
        </div>

        <div>
          <span class="crm-v3-chip next">Next Action</span>
          <p>${escapeHtml(insights.nextAction || '—')}</p>
        </div>

        <div>
          <span class="crm-v3-chip reply">Suggested Reply</span>
          <textarea class="crm-ai-reply" readonly>${escapeHtml(insights.suggestedReply || '')}</textarea>
          <div class="crm-ai-actions">
            <button class="btn btn-secondary" type="button" data-v3-copy-reply>Скопіювати відповідь</button>
            ${tgUrl ? `<a class="btn btn-secondary" href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener">Відкрити Telegram</a>` : ''}
          </div>
        </div>

        <ul class="crm-ai-checklist">
          ${(insights.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function getTelegramUrl(contact = '') {
    const value = String(contact || '').trim();

    if (/^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
      return `https://t.me/${value.slice(1)}`;
    }

    const match = value.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})/i);
    if (match) return `https://t.me/${match[1]}`;

    return '';
  }

  async function loadAiPanel(id) {
    const box = drawerBody.querySelector('#crmV3AiBox');
    const lead = leadById(id);

    if (!box || !lead) return;

    box.innerHTML = '<p class="muted">AI аналізує заявку...</p>';

    try {
      const data = await api(`/api/leads/${id}/ai`);
      renderAiResult(box, data.insights || {}, lead);
    } catch (error) {
      box.innerHTML = `<p class="muted">AI-блок недоступний: ${escapeHtml(error.message)}</p>`;
    }
  }

  function enhanceDrawer() {
    const id = drawerBody.querySelector('[data-status-action]')?.dataset.statusAction;
    if (!id) return;

    const lead = leadById(id);
    if (!lead) return;

    const existing = drawerBody.querySelector('#crmV3Panel');
    if (existing && existing.dataset.leadId === String(id)) return;
    if (existing) existing.remove();

    const assignee = assigneeLabel(lead);
    const panel = document.createElement('section');
    panel.className = 'crm-info-block full crm-v3-panel';
    panel.id = 'crmV3Panel';
    panel.dataset.leadId = String(id);

    panel.innerHTML = `
      <h3>CRM v3 · менеджмент і AI</h3>

      <div class="crm-v3-grid">
        <div class="crm-v3-card">
          <span>Відповідальний</span>
          <strong>${escapeHtml(assignee || 'Не призначено')}</strong>
          <small>${assignee ? 'Заявка вже у роботі' : 'Можна взяти заявку в роботу'}</small>
        </div>

        <div class="crm-v3-card">
          <span>Етап воронки</span>
          ${stageSelectHtml(lead)}
          <small>Окремо від технічного статусу заявки</small>
        </div>
      </div>

      <div class="crm-v3-actions">
        ${canTakeLead(lead) ? `<button class="btn btn-primary" type="button" data-v3-assign="${escapeHtml(id)}">Взяти в роботу</button>` : ''}
        <button class="btn btn-secondary" type="button" data-v3-ai="${escapeHtml(id)}">AI Summary / Reply</button>
      </div>

      <div class="crm-ai-box" id="crmV3AiBox">
        <p class="muted">Натисніть “AI Summary / Reply”, щоб отримати короткий підсумок, наступну дію і готовий текст відповіді.</p>
      </div>
    `;

    const noteBlock = drawerBody.querySelector('#managerNote')?.closest('.crm-info-block');
    if (noteBlock) {
      noteBlock.before(panel);
    } else {
      drawerBody.querySelector('.crm-drawer-grid')?.appendChild(panel);
    }
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);

    enhanceTimer = setTimeout(async () => {
      try {
        await loadMe();
        await refreshLeadsCache();
        enhanceRows();
        enhanceDrawer();
      } catch {
        enhanceRows();
        enhanceDrawer();
      }
    }, 180);
  }

  async function assignLead(id) {
    const button = document.querySelector(`[data-v3-assign="${CSS.escape(String(id))}"]`);

    if (button) {
      button.disabled = true;
      button.textContent = 'Беремо...';
    }

    try {
      await api(`/api/leads/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      await refreshLeadsCache();
      document.getElementById('loadLeads')?.click();
      setTimeout(scheduleEnhance, 500);
    } catch (error) {
      alert(`Не вдалося взяти заявку: ${error.message}`);
      if (button) {
        button.disabled = false;
        button.textContent = 'Взяти в роботу';
      }
    }
  }

  async function updateStage(id, stage) {
    try {
      await api(`/api/leads/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage })
      });

      await refreshLeadsCache();
      scheduleEnhance();
    } catch (error) {
      alert(`Не вдалося змінити етап: ${error.message}`);
    }
  }

  document.addEventListener('click', async (event) => {
    const assignButton = event.target.closest('[data-v3-assign]');
    if (assignButton) {
      event.stopPropagation();
      await assignLead(assignButton.dataset.v3Assign);
      return;
    }

    const aiButton = event.target.closest('[data-v3-ai]');
    if (aiButton) {
      event.stopPropagation();
      await loadAiPanel(aiButton.dataset.v3Ai);
      return;
    }

    const copyReply = event.target.closest('[data-v3-copy-reply]');
    if (copyReply) {
      const text = drawerBody.querySelector('.crm-ai-reply')?.value || '';
      await navigator.clipboard.writeText(text).catch(() => null);
      copyReply.textContent = 'Скопійовано';
      setTimeout(() => {
        copyReply.textContent = 'Скопіювати відповідь';
      }, 900);
    }
  });

  document.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-v3-stage]');
    if (!select) return;

    await updateStage(select.dataset.v3Stage, select.value);
  });

  document.getElementById('loadLeads')?.addEventListener('click', () => {
    setTimeout(() => {
      leadsCache = [];
      scheduleEnhance();
    }, 600);
  });

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(root, { childList: true, subtree: true });
  observer.observe(drawerBody, { childList: true, subtree: true });

  window.addEventListener('avant:admin-ready', scheduleEnhance);
  document.addEventListener('DOMContentLoaded', scheduleEnhance);
  setTimeout(scheduleEnhance, 800);
})();
