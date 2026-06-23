(function () {
  const root = document.getElementById('adminCrmRoot');
  const workspace = document.getElementById('smmWorkspace');
  const accessWarning = document.getElementById('smmAccessWarning');
  const addForm = document.getElementById('smmAddForm');
  const urlInput = document.getElementById('smmUrlInput');
  const listWrap = document.getElementById('smmTargets');
  const loadBtn = document.getElementById('loadLeads');
  const analyzeAllBtn = document.getElementById('analyzeAllSmmBtn');
  const summaryWrap = document.getElementById('smmSummary');
  const heroCount = document.getElementById('smmHeroCount');
  const searchInput = document.getElementById('smmSearchInput');
  const analysisFilter = document.getElementById('smmAnalysisFilter');
  const contactFilter = document.getElementById('smmContactFilter');
  const sendFilter = document.getElementById('smmSendFilter');
  const sortModeSelect = document.getElementById('smmSortMode');
  const errorPositionSelect = document.getElementById('smmErrorPosition');
  const sentPositionSelect = document.getElementById('smmSentPosition');
  const viewModeSelect = document.getElementById('smmViewMode');
  const resetFiltersBtn = document.getElementById('smmResetFiltersBtn');
  const filterCount = document.getElementById('smmFilterCount');

  const leadModal = document.getElementById('smmLeadModal');
  const leadForm = document.getElementById('smmLeadForm');
  const leadModalTitle = document.getElementById('smmLeadModalTitle');
  const leadSiteLink = document.getElementById('smmLeadSiteLink');
  const leadCompanyInput = document.getElementById('smmLeadCompany');
  const leadBusinessInput = document.getElementById('smmLeadBusiness');
  const leadTelegramInput = document.getElementById('smmLeadTelegram');
  const leadPhoneInput = document.getElementById('smmLeadPhone');
  const leadMessageInput = document.getElementById('smmLeadMessage');
  const leadTelegramLink = document.getElementById('smmLeadTelegramLink');
  const leadError = document.getElementById('smmLeadError');
  const leadSaveBtn = document.getElementById('smmLeadSaveBtn');
  const leadCopyBtn = document.getElementById('smmLeadCopyBtn');
  const leadModalClose = document.getElementById('smmLeadModalClose');
  const leadModalCancel = document.getElementById('smmLeadModalCancel');

  if (!root || !workspace || !listWrap) return;

  let currentUser = null;
  let targets = [];
  let currentViewMode = localStorage.getItem('avantSmmViewMode') || 'expanded';

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

  function firstPhone(target) {
    const phones = Array.isArray(target.phones) ? target.phones : [];
    return phones[0] || '';
  }

  function cleanPhoneHref(phone = '') {
    const value = String(phone || '').replace(/[^+\d]/g, '');
    return value ? `tel:${value}` : '';
  }

  function getPrimaryContact(target) {
    const tg = firstTelegram(target);
    const phone = firstPhone(target);

    if (tg) {
      return {
        type: 'telegram',
        label: tg,
        href: telegramUrl(tg),
        button: '💬 Написати'
      };
    }

    if (phone) {
      return {
        type: 'phone',
        label: phone,
        href: cleanPhoneHref(phone),
        button: '📞 Номер'
      };
    }

    return {
      type: 'none',
      label: '—',
      href: '',
      button: 'Немає контакту'
    };
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

  function normalizeFilterText(value = '') {
    return String(value || '').toLowerCase().trim();
  }

  function targetHasTelegram(target) {
    return Array.isArray(target.telegram_contacts) && target.telegram_contacts.length > 0;
  }

  function targetHasPhone(target) {
    return Array.isArray(target.phones) && target.phones.length > 0;
  }

  function targetHasError(target) {
    return target.analysis_status === 'failed' || Boolean(target.error_message);
  }

  function targetDisplayName(target) {
    return String(target.company_name || target.normalized_url || target.url || `ID ${target.id}`);
  }

  function targetSearchHaystack(target) {
    return normalizeFilterText([
      target.company_name,
      target.normalized_url,
      target.url,
      target.business_type,
      target.description,
      target.offer_summary,
      ...(Array.isArray(target.telegram_contacts) ? target.telegram_contacts : []),
      ...(Array.isArray(target.phones) ? target.phones : []),
      ...(Array.isArray(target.emails) ? target.emails : [])
    ].filter(Boolean).join(' '));
  }

  function getCurrentFilters() {
    return {
      query: normalizeFilterText(searchInput?.value || ''),
      analysis: analysisFilter?.value || 'all',
      contact: contactFilter?.value || 'all',
      send: sendFilter?.value || 'all',
      sort: sortModeSelect?.value || 'newest',
      errors: errorPositionSelect?.value || 'bottom',
      sent: sentPositionSelect?.value || 'bottom'
    };
  }

  function getFilteredTargets() {
    const filters = getCurrentFilters();

    return targets.filter((target) => {
      const hasTelegram = targetHasTelegram(target);
      const hasPhone = targetHasPhone(target);
      const sendStatus = target.send_status || 'not_sent';
      const analysisStatus = target.analysis_status || 'pending';

      if (filters.query && !targetSearchHaystack(target).includes(filters.query)) {
        return false;
      }

      if (filters.analysis !== 'all' && analysisStatus !== filters.analysis) {
        return false;
      }

      if (filters.contact === 'telegram' && !hasTelegram) {
        return false;
      }

      if (filters.contact === 'phone_only' && (hasTelegram || !hasPhone)) {
        return false;
      }

      if (filters.contact === 'no_telegram' && hasTelegram) {
        return false;
      }

      if (filters.contact === 'no_contact' && (hasTelegram || hasPhone)) {
        return false;
      }

      if (filters.send !== 'all' && sendStatus !== filters.send) {
        return false;
      }

      return true;
    });
  }

  function compareText(a = '', b = '') {
    return String(a || '').localeCompare(String(b || ''), 'uk', { sensitivity: 'base' });
  }

  function compareDateDesc(a, b, field = 'updated_at') {
    const dateA = new Date(a[field] || a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b[field] || b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  }

  function getContactRank(target, mode) {
    const hasTelegram = targetHasTelegram(target);
    const hasPhone = targetHasPhone(target);

    if (mode === 'contact_phone_first') {
      if (hasPhone && !hasTelegram) return 10;
      if (hasTelegram) return 20;
      return 30;
    }

    if (mode === 'contact_none_first') {
      if (!hasTelegram && !hasPhone) return 10;
      if (hasTelegram) return 20;
      if (hasPhone) return 30;
      return 40;
    }

    if (hasTelegram) return 10;
    if (hasPhone) return 20;
    return 30;
  }

  function getAnalysisRank(target) {
    const map = {
      analyzed: 10,
      pending: 20,
      analyzing: 30,
      failed: 40
    };

    return map[target.analysis_status || 'pending'] || 50;
  }

  function getSendRank(target) {
    const map = {
      not_sent: 10,
      manual_required: 20,
      no_telegram: 30,
      skipped: 40,
      sent: 50
    };

    return map[target.send_status || 'not_sent'] || 60;
  }

  function getSortedTargets(items) {
    const filters = getCurrentFilters();

    return [...items].sort((a, b) => {
      if (filters.errors !== 'normal') {
        const errorA = targetHasError(a) ? 1 : 0;
        const errorB = targetHasError(b) ? 1 : 0;

        if (errorA !== errorB) {
          return filters.errors === 'top' ? errorB - errorA : errorA - errorB;
        }
      }

      if (filters.sent !== 'normal') {
        const sentA = (a.send_status || 'not_sent') === 'sent' ? 1 : 0;
        const sentB = (b.send_status || 'not_sent') === 'sent' ? 1 : 0;

        if (sentA !== sentB) {
          return filters.sent === 'top' ? sentB - sentA : sentA - sentB;
        }
      }

      if (filters.sort === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }

      if (filters.sort === 'name_az') {
        return compareText(targetDisplayName(a), targetDisplayName(b));
      }

      if (filters.sort === 'name_za') {
        return compareText(targetDisplayName(b), targetDisplayName(a));
      }

      if (filters.sort === 'contact_tg_first' || filters.sort === 'contact_phone_first' || filters.sort === 'contact_none_first') {
        const rankDiff = getContactRank(a, filters.sort) - getContactRank(b, filters.sort);
        if (rankDiff !== 0) return rankDiff;
      }

      if (filters.sort === 'analysis_status') {
        const rankDiff = getAnalysisRank(a) - getAnalysisRank(b);
        if (rankDiff !== 0) return rankDiff;
      }

      if (filters.sort === 'send_status') {
        const rankDiff = getSendRank(a) - getSendRank(b);
        if (rankDiff !== 0) return rankDiff;
      }

      return compareDateDesc(a, b);
    });
  }

  function renderFilterCount(visibleTargets) {
    if (!filterCount) return;

    const filters = getCurrentFilters();
    const active = [];

    if (filters.query) active.push(`пошук: "${filters.query}"`);
    if (filters.analysis !== 'all') active.push(`аналіз: ${filters.analysis}`);
    if (filters.contact !== 'all') active.push(`контакт: ${filters.contact}`);
    if (filters.send !== 'all') active.push(`статус: ${filters.send}`);
    if (filters.sort !== 'newest') active.push(`сортування: ${filters.sort}`);
    if (filters.errors !== 'bottom') active.push(`помилки: ${filters.errors}`);
    if (filters.sent !== 'bottom') active.push(`sent: ${filters.sent}`);

    filterCount.textContent = active.length
      ? `Показано ${visibleTargets.length} із ${targets.length} • ${active.join(' • ')}`
      : `Показано ${visibleTargets.length} із ${targets.length}`;
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

  function renderCompactTargets(visibleTargets) {
    listWrap.innerHTML = `
      <div class="smm-compact-list">
        <div class="smm-compact-head">
          <span>Компанія</span>
          <span>Контакт</span>
          <span>Статус</span>
          <span>Дії</span>
        </div>

        ${visibleTargets.map((target) => {
          const contact = getPrimaryContact(target);
          const sentCount = Number(target.sent_count || 0);
          const company = target.company_name || target.normalized_url || target.url || `ID ${target.id}`;

          return `
            <article class="smm-compact-row" data-smm-id="${escapeHtml(target.id)}">
              <div class="smm-compact-main">
                <strong title="${escapeHtml(company)}">${escapeHtml(company)}</strong>
                <a href="${escapeHtml(target.normalized_url || target.url || '#')}" target="_blank" rel="noopener">${escapeHtml(target.normalized_url || target.url || '')}</a>
              </div>

              <div class="smm-compact-contact ${escapeHtml(contact.type)}">
                <span>${contact.type === 'telegram' ? 'Telegram' : contact.type === 'phone' ? 'Номер' : 'Контакт'}</span>
                <strong title="${escapeHtml(contact.label)}">${escapeHtml(contact.label)}</strong>
              </div>

              <div class="smm-compact-status">
                ${statusBadge(target.analysis_status)}
                ${statusBadge(target.send_status)}
                ${sentCount > 0 ? `<span class="smm-sent-chip">sent x${sentCount}</span>` : ''}
              </div>

              <div class="smm-compact-actions">
                <button class="btn btn-secondary smm-card-btn" type="button" data-smm-open="${escapeHtml(target.id)}">🗂 Картка</button>
                <button class="btn btn-secondary smm-copy-btn" type="button" data-smm-copy="${escapeHtml(target.id)}">📋 Копіювати</button>
                ${
                  contact.href
                    ? `<a class="btn btn-primary smm-write-btn" href="${escapeHtml(contact.href)}" target="_blank" rel="noopener">${contact.type === 'telegram' ? '💬 Написати' : '📞 Номер'}</a>`
                    : `<button class="btn btn-secondary smm-write-btn" type="button" disabled>Немає</button>`
                }
                <button class="btn btn-secondary smm-sent-btn" type="button" data-smm-manual-sent="${escapeHtml(target.id)}">✅ sent</button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function findTarget(id) {
    return targets.find((item) => String(item.id) === String(id));
  }

  function updateTargetCache(updatedTarget) {
    const index = targets.findIndex((item) => String(item.id) === String(updatedTarget.id));

    if (index >= 0) {
      targets[index] = updatedTarget;
    } else {
      targets.unshift(updatedTarget);
    }
  }

  function setLeadModalError(message = '') {
    if (leadError) leadError.textContent = message;
  }

  function openLeadCard(id) {
    const target = findTarget(id);

    if (!target || !leadModal || !leadForm) return;

    const tg = firstTelegram(target);
    const phone = firstPhone(target);
    const site = target.normalized_url || target.url || '#';
    const title = target.company_name || target.normalized_url || target.url || `ID ${target.id}`;
    const tgUrl = telegramUrl(tg);

    leadModal.dataset.targetId = String(target.id);

    if (leadModalTitle) leadModalTitle.textContent = title;
    if (leadSiteLink) {
      leadSiteLink.href = site;
      leadSiteLink.textContent = site;
    }

    if (leadCompanyInput) leadCompanyInput.value = target.company_name || '';
    if (leadBusinessInput) leadBusinessInput.value = target.business_type || '';
    if (leadTelegramInput) leadTelegramInput.value = tg || '';
    if (leadPhoneInput) leadPhoneInput.value = phone || '';
    if (leadMessageInput) leadMessageInput.value = target.message_uk || '';

    if (leadTelegramLink) {
      leadTelegramLink.hidden = !tgUrl;
      leadTelegramLink.href = tgUrl || '#';
    }

    setLeadModalError('');
    leadModal.hidden = false;
    document.body.classList.add('smm-modal-open');

    setTimeout(() => {
      leadCompanyInput?.focus();
    }, 50);
  }

  function closeLeadCard() {
    if (!leadModal) return;

    leadModal.hidden = true;
    leadModal.dataset.targetId = '';
    document.body.classList.remove('smm-modal-open');
    setLeadModalError('');
  }

  async function saveLeadDetails(event) {
    event.preventDefault();

    const id = leadModal?.dataset.targetId;
    if (!id) return;

    const body = {
      company_name: leadCompanyInput?.value?.trim() || '',
      business_type: leadBusinessInput?.value?.trim() || '',
      telegram_contact: leadTelegramInput?.value?.trim() || '',
      phone: leadPhoneInput?.value?.trim() || '',
      message_uk: leadMessageInput?.value || ''
    };

    if (leadSaveBtn) {
      leadSaveBtn.disabled = true;
      leadSaveBtn.textContent = 'Зберігаємо...';
    }

    try {
      const data = await api(`/api/smm/targets/${id}/details`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });

      updateTargetCache(data.target);
      closeLeadCard();
      renderTargets();
    } catch (error) {
      setLeadModalError(error.message || 'Не вдалося зберегти картку');
    } finally {
      if (leadSaveBtn) {
        leadSaveBtn.disabled = false;
        leadSaveBtn.textContent = '💾 Зберегти';
      }
    }
  }

  async function copyLeadModalMessage() {
    const text = makeManualTelegramText(leadMessageInput?.value || '');

    if (!text) {
      setLeadModalError('Повідомлення порожнє.');
      return;
    }

    await navigator.clipboard.writeText(text).catch(() => null);

    if (leadCopyBtn) {
      const old = leadCopyBtn.textContent;
      leadCopyBtn.textContent = '✓ Скопійовано';
      setTimeout(() => {
        leadCopyBtn.textContent = old;
      }, 1200);
    }
  }

  function renderTargets() {
    renderSummary();

    const visibleTargets = getSortedTargets(getFilteredTargets());
    renderFilterCount(visibleTargets);

    if (!targets.length) {
      listWrap.innerHTML = '<p class="crm-empty">Сайти ще не додані.</p>';
      return;
    }

    if (!visibleTargets.length) {
      listWrap.innerHTML = '<p class="crm-empty">За цим фільтром сайтів немає.</p>';
      return;
    }

    if (currentViewMode === 'compact') {
      renderCompactTargets(visibleTargets);
      return;
    }

    listWrap.innerHTML = visibleTargets.map((target) => {
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
            <button class="btn btn-secondary" type="button" data-smm-open="${escapeHtml(target.id)}">🗂 Картка</button>
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
    const target = findTarget(id);
    const text = textarea?.value || target?.message_uk || '';
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

  if (viewModeSelect) {
    viewModeSelect.value = currentViewMode;
  }

  function saveFilterState() {
    const state = {
      q: searchInput?.value || '',
      analysis: analysisFilter?.value || 'all',
      contact: contactFilter?.value || 'all',
      send: sendFilter?.value || 'all',
      sort: sortModeSelect?.value || 'newest',
      errors: errorPositionSelect?.value || 'bottom',
      sent: sentPositionSelect?.value || 'bottom'
    };

    localStorage.setItem('avantSmmFilters', JSON.stringify(state));
  }

  function restoreFilterState() {
    const raw = localStorage.getItem('avantSmmFilters');
    if (!raw) return;

    try {
      const state = JSON.parse(raw);

      if (searchInput) searchInput.value = state.q || '';
      if (analysisFilter) analysisFilter.value = state.analysis || 'all';
      if (contactFilter) contactFilter.value = state.contact || 'all';
      if (sendFilter) sendFilter.value = state.send || 'all';
      if (sortModeSelect) sortModeSelect.value = state.sort || 'newest';
      if (errorPositionSelect) errorPositionSelect.value = state.errors || 'bottom';
      if (sentPositionSelect) sentPositionSelect.value = state.sent || 'bottom';
    } catch {
      localStorage.removeItem('avantSmmFilters');
    }
  }

  function handleFilterChange() {
    saveFilterState();
    renderTargets();
  }

  restoreFilterState();

  searchInput?.addEventListener('input', handleFilterChange);
  analysisFilter?.addEventListener('change', handleFilterChange);
  contactFilter?.addEventListener('change', handleFilterChange);
  sendFilter?.addEventListener('change', handleFilterChange);
  sortModeSelect?.addEventListener('change', handleFilterChange);
  errorPositionSelect?.addEventListener('change', handleFilterChange);
  sentPositionSelect?.addEventListener('change', handleFilterChange);

  resetFiltersBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (analysisFilter) analysisFilter.value = 'all';
    if (contactFilter) contactFilter.value = 'all';
    if (sendFilter) sendFilter.value = 'all';
    if (sortModeSelect) sortModeSelect.value = 'newest';
    if (errorPositionSelect) errorPositionSelect.value = 'bottom';
    if (sentPositionSelect) sentPositionSelect.value = 'bottom';

    localStorage.removeItem('avantSmmFilters');
    renderTargets();
  });

  viewModeSelect?.addEventListener('change', () => {
    currentViewMode = viewModeSelect.value || 'expanded';
    localStorage.setItem('avantSmmViewMode', currentViewMode);
    renderTargets();
  });

  document.addEventListener('click', async (event) => {
    const openCard = event.target.closest('[data-smm-open]');
    if (openCard) return openLeadCard(openCard.dataset.smmOpen);

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

  leadForm?.addEventListener('submit', saveLeadDetails);
  leadCopyBtn?.addEventListener('click', copyLeadModalMessage);
  leadModalClose?.addEventListener('click', closeLeadCard);
  leadModalCancel?.addEventListener('click', closeLeadCard);

  leadModal?.addEventListener('click', (event) => {
    if (event.target?.hasAttribute('data-smm-modal-close')) {
      closeLeadCard();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && leadModal && !leadModal.hidden) {
      closeLeadCard();
    }
  });

  setTimeout(loadTargets, 500);
})();
