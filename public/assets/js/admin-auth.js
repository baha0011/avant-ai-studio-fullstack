(function () {
  const loginPanel = document.getElementById('adminLoginPanel');
  const crmRoot = document.getElementById('adminCrmRoot');
  const crmHero = document.querySelector('.crm-hero');
  const loginForm = document.getElementById('adminLoginForm');
  const emailInput = document.getElementById('adminEmail');
  const passwordInput = document.getElementById('adminPassword');
  const errorBox = document.getElementById('adminLoginError');
  const sessionBar = document.getElementById('adminSessionBar');
  const currentUser = document.getElementById('adminCurrentUser');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const manageUsersBtn = document.getElementById('manageUsersBtn');
  const smmCrmBtn = document.getElementById('smmCrmBtn');
  const usersModal = document.getElementById('adminUsersModal');
  const usersClose = document.getElementById('adminUsersClose');
  const usersList = document.getElementById('adminUsersList');
  const createForm = document.getElementById('adminUserCreateForm');

  if (!loginPanel || !crmRoot || !loginForm) return;

  let currentAdmin = null;

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function setError(message = '') {
    if (errorBox) errorBox.textContent = message;
  }

  function setLocked() {
    currentAdmin = null;
    window.AVANT_ADMIN_USER = null;

    document.body.classList.add('admin-login-mode');
    document.body.classList.remove('admin-crm-mode');
    document.body.dataset.adminRole = '';
    loginPanel.hidden = false;
    crmRoot.style.display = 'none';

    if (crmHero) crmHero.hidden = true;
    if (sessionBar) sessionBar.hidden = true;
  }

  function setUnlocked(user) {
    currentAdmin = user;
    window.AVANT_ADMIN_USER = user;

    document.body.classList.remove('admin-login-mode');
    document.body.classList.add('admin-crm-mode');
    document.body.dataset.adminRole = user.role || '';

    loginPanel.hidden = true;
    crmRoot.style.display = '';

    if (crmHero) {
      crmHero.hidden = user.role === 'manager';
    }

    if (sessionBar) sessionBar.hidden = false;

    if (currentUser) {
      currentUser.textContent = `${user.name || user.email} · ${user.role}`;
    }

    if (manageUsersBtn) {
      const canManageUsers = ['super_admin', 'admin'].includes(user.role);
      manageUsersBtn.hidden = !canManageUsers;
      manageUsersBtn.style.display = canManageUsers ? '' : 'none';
    }

    if (smmCrmBtn) {
      const canUseSmm = user.role === 'super_admin';
      smmCrmBtn.hidden = !canUseSmm;
      smmCrmBtn.style.display = canUseSmm ? '' : 'none';
    }

    applyRoleUi(user.role);

    setTimeout(() => {
      document.getElementById('loadLeads')?.click();
    }, 50);
  }

  function applyRoleUi(role) {
    const isManager = role === 'manager';

    const roleSelect = document.getElementById('newAdminRole');
    const superOption = roleSelect?.querySelector('option[value="super_admin"]');

    if (superOption) {
      superOption.hidden = role !== 'super_admin';
      superOption.disabled = role !== 'super_admin';

      if (roleSelect.value === 'super_admin' && role !== 'super_admin') {
        roleSelect.value = 'admin';
      }
    }

    const stats = document.getElementById('adminStats');
    const pipeline = document.getElementById('crmPipeline');
    const exportCsv = document.getElementById('exportCsvBtn');
    const summaryReport = document.getElementById('summaryReportBtn');
    const googleSheet = document.getElementById('openGoogleSheet');
    const heroCard = document.querySelector('.crm-hero-card');

    [stats, pipeline, exportCsv, summaryReport, googleSheet, heroCard].forEach((el) => {
      if (el) el.hidden = isManager;
    });
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

  async function checkMe() {
    try {
      const data = await api('/api/admin/me');
      setUnlocked(data.user);
    } catch {
      setLocked();
    }
  }

  async function login(event) {
    event.preventDefault();
    setError('');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setError('Вкажіть email і пароль.');
      return;
    }

    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      passwordInput.value = '';
      setUnlocked(data.user);
    } catch (error) {
      setError(error.message || 'Не вдалося увійти.');
    }
  }

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => null);
    setLocked();
  }

  function openUsersModal() {
    if (!usersModal) return;

    usersModal.classList.add('open');
    usersModal.setAttribute('aria-hidden', 'false');
    loadUsers();
  }

  function closeUsersModal() {
    if (!usersModal) return;

    usersModal.classList.remove('open');
    usersModal.setAttribute('aria-hidden', 'true');
  }

  async function loadUsers() {
    if (!usersList) return;

    usersList.innerHTML = '<p class="muted">Завантажуємо користувачів...</p>';

    try {
      const data = await api('/api/admin/users');
      const users = data.users || [];

      usersList.innerHTML = users.map((user) => {
        const isSelf = currentAdmin && Number(currentAdmin.id) === Number(user.id);
        const actorIsSuperAdmin = currentAdmin?.role === 'super_admin';
        const targetIsSuperAdmin = user.role === 'super_admin';
        const canEdit = actorIsSuperAdmin || !targetIsSuperAdmin;
        const canDelete = actorIsSuperAdmin && !isSelf;

        return `
          <article class="admin-user-row" data-user-id="${user.id}">
            <div class="admin-user-main">
              <strong>${escapeHtml(user.email)}</strong>
              <span>ID ${user.id} · ${escapeHtml(user.created_at || '')}${isSelf ? ' · це ви' : ''}</span>
            </div>

            <input type="text" data-field="name" value="${escapeHtml(user.name || '')}" placeholder="Імʼя" ${canEdit ? '' : 'disabled'}>

            <select data-field="role" ${canEdit ? '' : 'disabled'}>
              <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>manager</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
              <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''} ${actorIsSuperAdmin ? '' : 'disabled'}>super_admin</option>
            </select>

            <label class="admin-active-check">
              <input type="checkbox" data-field="is_active" ${user.is_active ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
              active
            </label>

            <input type="password" data-field="password" placeholder="${canEdit ? 'Новий пароль, якщо треба' : 'Тільки super_admin може змінити'}" ${canEdit ? '' : 'disabled'}>

            <div class="admin-user-actions">
              <button class="btn btn-secondary" type="button" data-save-user="${user.id}" ${canEdit ? '' : 'disabled'}>Зберегти</button>
              <button class="btn btn-danger" type="button" data-delete-user="${user.id}" ${canDelete ? '' : 'disabled'}>Видалити</button>
            </div>
          </article>
        `;
      }).join('');

      usersList.querySelectorAll('[data-save-user]').forEach((button) => {
        button.addEventListener('click', () => saveUser(button.dataset.saveUser));
      });

      usersList.querySelectorAll('[data-delete-user]').forEach((button) => {
        button.addEventListener('click', () => deleteUser(button.dataset.deleteUser));
      });
    } catch (error) {
      usersList.innerHTML = `<p class="admin-login-error">${escapeHtml(error.message)}</p>`;
    }
  }

  async function createUser(event) {
    event.preventDefault();

    const name = document.getElementById('newAdminName')?.value?.trim() || '';
    const email = document.getElementById('newAdminEmail')?.value?.trim() || '';
    const password = document.getElementById('newAdminPassword')?.value || '';
    const role = document.getElementById('newAdminRole')?.value || 'manager';

    if (!email || password.length < 8) {
      alert('Email і пароль мінімум 8 символів.');
      return;
    }

    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role })
      });

      createForm.reset();
      await loadUsers();
    } catch (error) {
      alert(error.message);
    }
  }

  async function saveUser(id) {
    const row = usersList.querySelector(`[data-user-id="${id}"]`);
    if (!row) return;

    const name = row.querySelector('[data-field="name"]').value.trim();
    const role = row.querySelector('[data-field="role"]').value;
    const is_active = row.querySelector('[data-field="is_active"]').checked;
    const password = row.querySelector('[data-field="password"]').value;

    const payload = { name, role, is_active };
    if (password) payload.password = password;

    try {
      await api(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      await loadUsers();
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteUser(id) {
    const row = usersList.querySelector(`[data-user-id="${id}"]`);
    const email = row?.querySelector('.admin-user-main strong')?.textContent || `ID ${id}`;

    const ok = confirm(`Видалити користувача ${email}? Це також видалить його сесії.`);
    if (!ok) return;

    try {
      await api(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });

      await loadUsers();
    } catch (error) {
      alert(error.message);
    }
  }

  loginForm.addEventListener('submit', login);
  logoutBtn?.addEventListener('click', logout);
  manageUsersBtn?.addEventListener('click', openUsersModal);
  usersClose?.addEventListener('click', closeUsersModal);
  createForm?.addEventListener('submit', createUser);

  usersModal?.addEventListener('click', (event) => {
    if (event.target === usersModal) closeUsersModal();
  });

  setLocked();
  checkMe();
})();
