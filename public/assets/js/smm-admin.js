(function () {
  const root = document.getElementById('adminCrmRoot');
  const workspace = document.getElementById('smmWorkspace');
  const accessWarning = document.getElementById('smmAccessWarning');
  const addForm = document.getElementById('smmAddForm');
  const urlInput = document.getElementById('smmUrlInput');
  const listWrap = document.getElementById('smmTargets');
  const loadBtn = document.getElementById('loadLeads');
  const analyzeAllBtn = document.getElementById('analyzeAllSmmBtn');
  const startBtn = document.getElementById('startSmmBtn');
  const summaryWrap = document.getElementById('smmSummary');
  const heroCount = document.getElementById('smmHeroCount');

  if (!root || !workspace || !listWrap) return;

  let currentUser = null;
  let targets = [];

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
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

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async function checkAccess() {
    try {
      const data = await api('/api/admin/me');
      currentUser = data.user;

      const allowed = currentUser?.role === 'super_admin';

      workspace.hidden = !allowed;
      accessWarning.hidden = allowed;
      analyzeAllBtn.hidden = !allowed;
      startBtn.hidden = !allowed;
      loadBtn.hidden = !allowed;

      return allowed;
    } catch {
      workspace.hidden = true;
      accessWarning.hidden = true;
      return false;
    }
  }

  function firstTelegram(target) {
    const contacts = Array.isArray(target.telegram_contacts) ? target.telegram_contacts : [];
    return contacts[0] || '';
  }

  function makeManualTelegramText(text = '') {
    const siteUrl = 'https://avant-ai-studio.onrender.com';

    return String(text || '')
      .replace(/<a\s+href=["']([^"']+)["']\s*>\s*Avant AI Studio\s*<\/a>/gi, `Avant AI Studio\n${siteUrl}`)
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function telegramUrl(contact = '') {
    const value = String(contact || '').trim();

    if (/^@[a-zA-Z0-9_]{5,32}$/.test(value)) {
      return `https://t.me/${value.slice(1)}`;
    }

    const match = value.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})/i);
    if (match) return `https://t.me/${match[1]}`;

    return '';
  }

  function statusBadge(status = '') {
    return `<span class="smm-badge ${escapeHtml(status || 'unknown')}">${escapeHtml(status || 'unknown')}</span>`;
  }

  function renderSummary() {
    const total = targets.length;
    const analyzed = targets.filter((target) => target.analysis_status === 'analyzed').length;
    const enabled = targets.filter((target) => target.send_enabled).length;
    const sent = targets.filter((target) => target.send_status === 'sent').length;
    const manual = targets.filter((target) => target.send_status === 'manual_required').length;

    if (heroCount) heroCount.textContent = String(total);

    summaryWrap.innerHTML = `
      <div class="crm-stat"><span>Усього</span><strong>${total}</strong><small>компаній</small></div>
      <div class="crm-stat"><span>Проаналізовано</span><strong>${analyzed}</strong><small>готові звіти</small></div>
      <div class="crm-stat"><span>Увімкнено</span><strong>${enabled}</strong><small>для outreach</small></div>
      <div class="crm-stat"><span>Sent</span><strong>${sent}</strong><small>відправлено</small></div>
      <div class="crm-stat"><span>Manual</span><strong>${manual}</strong><small>потрібна ручна дія</small></div>
    `;
  }

  function renderTargets() {
    renderSummary();

    if (!targets.length) {
      listWrap.innerHTML = '<p class="crm-empty">Сайти ще не додані.</p>';
      return;
    }

    listWrap.innerHTML = targets.map((target) => {
      const tg = firstTelegram(target);
      const tgUrl = telegramUrl(tg);
      const emails = Array.isArray(target.emails) ? target.emails : [];
      const phones = Array.isArray(target.phones) ? target.phones : [];
      const sentCount = Number(target.sent_count || 0);

      return `
        <article class="smm-target-card" data-smm-id="${escapeHtml(target.id)}">
          <div class="smm-target-head">
            <div>
              <div class="smm-url-line">
                <strong>${escapeHtml(target.company_name || target.normalized_url || target.url)}</strong>
                ${sentCount > 0 ? `<span class="smm-sent-chip">sent x${sentCount}</span>` : ''}
              </div>
              <a href="${escapeHtml(target.normalized_url || target.url)}" target="_blank" rel="noopener">${escapeHtml(target.normalized_url || target.url)}</a>
            </div>

            <div class="smm-statuses">
              ${statusBadge(target.analysis_status)}
              ${statusBadge(target.send_status)}
            </div>
          </div>

          <div class="smm-report-grid">
            <section>
              <h3>Звіт</h3>
              <dl>
                <div><dt>Сфера</dt><dd>${escapeHtml(target.business_type || '—')}</dd></div>
                <div><dt>Опис</dt><dd>${escapeHtml(target.description || 'Ще не проаналізовано')}</dd></div>
                <div><dt>Telegram</dt><dd>${tg ? escapeHtml(tg) : '—'}</dd></div>
                <div><dt>Email</dt><dd>${escapeHtml(emails.join(', ') || '—')}</dd></div>
                <div><dt>Phone</dt><dd>${escapeHtml(phones.join(', ') || '—')}</dd></div>
              </dl>
            </section>

            <section>
              <h3>Що запропонувати</h3>
              <p>${escapeHtml(target.offer_summary || 'Після аналізу тут зʼявиться персональна пропозиція.')}</p>

              <label class="smm-toggle">
                <input type="checkbox" data-smm-toggle="${escapeHtml(target.id)}" ${target.send_enabled ? 'checked' : ''}>
                <span>Включити в SMM outreach</span>
              </label>
            </section>
          </div>

          <label class="smm-message-label">
            Повідомлення українською
            <textarea data-smm-message="${escapeHtml(target.id)}" placeholder="Після аналізу тут зʼявиться персональне повідомлення...">${escapeHtml(target.message_uk || '')}</textarea>
          </label>

          <div class="smm-card-actions">
            <button class="btn btn-secondary" type="button" data-smm-analyze="${escapeHtml(target.id)}">🔍 Аналіз</button>
            <button class="btn btn-secondary" type="button" data-smm-save-message="${escapeHtml(target.id)}">💾 Зберегти текст</button>
            <button class="btn btn-secondary" type="button" data-smm-copy="${escapeHtml(target.id)}">📋 Копіювати</button>
            ${tgUrl ? `<a class="btn btn-secondary" href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener">💬 Відкрити Telegram</a>` : ''}
            <button class="btn btn-secondary" type="button" data-smm-manual-sent="${escapeHtml(target.id)}">✅ Позначити sent</button>
            <button class="btn btn-danger" type="button" data-smm-delete="${escapeHtml(target.id)}">🗑 Видалити</button>
          </div>

          ${target.error_message ? `<p class="smm-error">${escapeHtml(target.error_message)}</p>` : ''}
          ${target.last_sent_at ? `<p class="muted">Остання відправка: ${escapeHtml(formatDate(target.last_sent_at))}</p>` : ''}
        </article>
      `;
    }).join('');
  }

  async function loadTargets() {
    const allowed = await checkAccess();
    if (!allowed) return;

    loadBtn.disabled = true;
    loadBtn.textContent = 'Оновлюємо...';

    try {
      const data = await api('/api/smm/targets');
      targets = data.targets || [];
      renderTargets();
    } catch (error) {
      listWrap.innerHTML = `<p class="crm-empty">Не вдалося завантажити SMM CRM: ${escapeHtml(error.message)}</p>`;
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Оновити SMM CRM';
    }
  }

  async function addTarget(event) {
    event.preventDefault();

    const url = urlInput.value.trim();
    if (!url) return;

    try {
      await api('/api/smm/targets', {
        method: 'POST',
        body: JSON.stringify({ url })
      });

      urlInput.value = '';
      await loadTargets();
    } catch (error) {
      alert(error.message);
    }
  }

  async function analyzeTarget(id) {
    const button = document.querySelector(`[data-smm-analyze="${CSS.escape(String(id))}"]`);

    if (button) {
      button.disabled = true;
      button.textContent = 'Аналізуємо...';
    }

    try {
      await api(`/api/smm/targets/${id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      await loadTargets();
    } catch (error) {
      alert(error.message);
      await loadTargets();
    }
  }

  async function analyzeAll() {
    const ok = confirm('Проаналізувати всі pending/failed сайти?');
    if (!ok) return;

    analyzeAllBtn.disabled = true;
    analyzeAllBtn.textContent = 'Аналізуємо...';

    try {
      const data = await api('/api/smm/analyze-all', {
        method: 'POST',
        body: JSON.stringify({})
      });

      alert(`Готово. analyzed: ${data.summary.analyzed}, failed: ${data.summary.failed}`);
      await loadTargets();
    } catch (error) {
      alert(error.message);
      await loadTargets();
    } finally {
      analyzeAllBtn.disabled = false;
      analyzeAllBtn.textContent = '🔍 Аналізувати всі';
    }
  }

  async function startSmm() {
    const ok = confirm('Почати SMM outreach по увімкнених компаніях?');
    if (!ok) return;

    startBtn.disabled = true;
    startBtn.textContent = 'Працюємо...';

    try {
      const data = await api('/api/smm/start', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const s = data.summary || {};
      alert(`SMM готово. sent: ${s.sent}, manual: ${s.manualRequired}, failed: ${s.failed}, skipped: ${s.skipped}`);
      await loadTargets();
    } catch (error) {
      alert(error.message);
      await loadTargets();
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = '🚀 Почати SMM';
    }
  }

  async function setSendEnabled(id, checked) {
    try {
      await api(`/api/smm/targets/${id}/send-enabled`, {
        method: 'PATCH',
        body: JSON.stringify({ send_enabled: checked })
      });

      const target = targets.find((item) => String(item.id) === String(id));
      if (target) target.send_enabled = checked;
      renderTargets();
    } catch (error) {
      alert(error.message);
      await loadTargets();
    }
  }

  async function saveMessage(id) {
    const textarea = document.querySelector(`[data-smm-message="${CSS.escape(String(id))}"]`);
    const message = textarea?.value?.trim() || '';

    try {
      await api(`/api/smm/targets/${id}/message`, {
        method: 'PATCH',
        body: JSON.stringify({ message_uk: message })
      });

      await loadTargets();
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteTarget(id) {
    const ok = confirm('Видалити сайт із SMM CRM?');
    if (!ok) return;

    try {
      await api(`/api/smm/targets/${id}`, {
        method: 'DELETE'
      });

      await loadTargets();
    } catch (error) {
      alert(error.message);
    }
  }

  async function manualSent(id) {
    try {
      await api(`/api/smm/targets/${id}/manual-sent`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      await loadTargets();
    } catch (error) {
      alert(error.message);
    }
  }

  async function copyMessage(id, button) {
    const textarea = document.querySelector(`[data-smm-message="${CSS.escape(String(id))}"]`);
    const text = textarea?.value || '';
    const manualText = makeManualTelegramText(text);

    if (!manualText.trim()) {
      alert('Повідомлення порожнє.');
      return;
    }

    await navigator.clipboard.writeText(manualText).catch(() => null);

    if (button) {
      const old = button.textContent;
      button.textContent = '✓ Скопійовано без HTML';
      setTimeout(() => {
        button.textContent = old;
      }, 1200);
    }
  }

  addForm?.addEventListener('submit', addTarget);
  loadBtn?.addEventListener('click', loadTargets);
  analyzeAllBtn?.addEventListener('click', analyzeAll);
  startBtn?.addEventListener('click', startSmm);

  document.addEventListener('click', async (event) => {
    const analyze = event.target.closest('[data-smm-analyze]');
    if (analyze) return analyzeTarget(analyze.dataset.smmAnalyze);

    const save = event.target.closest('[data-smm-save-message]');
    if (save) return saveMessage(save.dataset.smmSaveMessage);

    const del = event.target.closest('[data-smm-delete]');
    if (del) return deleteTarget(del.dataset.smmDelete);

    const sent = event.target.closest('[data-smm-manual-sent]');
    if (sent) return manualSent(sent.dataset.smmManualSent);

    const copy = event.target.closest('[data-smm-copy]');
    if (copy) return copyMessage(copy.dataset.smmCopy, copy);
  });

  document.addEventListener('change', async (event) => {
    const toggle = event.target.closest('[data-smm-toggle]');
    if (!toggle) return;

    await setSendEnabled(toggle.dataset.smmToggle, toggle.checked);
  });

  setTimeout(loadTargets, 500);
})();
