
(() => {
  'use strict';

  const role = document.body.dataset.role || 'student';
  const cfg = window.VIRTUAL_PLATFORM_CONFIG || {};
  const apiBase = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
  const $ = id => document.getElementById(id);
  const state = {
    lessons: [], materials: [], students: [], submissions: [], user: null
  };

  const featureInfo = {
    users: ['User management', 'Restore role-safe student and trainer management.'],
    classes: ['Class management', 'Restore classes, student enrolment and course assignments.'],
    courses: ['Courses and units', 'Restore courses and class-course assignments.'],
    curriculum: ['Curriculum documents', 'Restore curriculum records and secure document access.'],
    'past-papers': ['Past papers', 'Restore past papers, questions and marking guides.'],
    quizzes: ['Quizzes and results', 'Restore quizzes, attempts and scoring.'],
    progress: ['Student progress', 'Restore lesson progress and completion records.'],
    'virtual-trainer': ['Virtual trainer settings', 'Restore virtual trainer settings and conversation history.'],
    results: ['My results', 'Restore student assessment results and quiz scores.']
  };

  function readUser() {
    try {
      return JSON.parse(sessionStorage.getItem('virtual_platform_user') || 'null');
    } catch {
      return null;
    }
  }

  function getToken() {
    return sessionStorage.getItem('virtual_platform_token') || '';
  }

  function showNotice(message, error = false) {
    const box = $('notice');
    if (!box) return;
    box.hidden = false;
    box.textContent = message;
    box.classList.toggle('error', error);
  }

  function setConnection(ok, message) {
    const el = $('connection-status');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('offline', !ok);
  }

  async function api(action, fields = {}) {
    if (!apiBase) {
      throw new Error('Backend URL is not configured in config.js.');
    }

    const token = getToken();
    const response = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action, ...fields })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }

    return data;
  }

  function itemsFrom(data, keys) {
    if (Array.isArray(data)) return data;
    for (const key of keys) {
      if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
  }

  function safe(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch]));
  }

  function first(obj, keys, fallback = '') {
    for (const key of keys) {
      if (obj && obj[key] !== undefined &&
          obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }
    }
    return fallback;
  }

  function row(title, description, meta = '', url = '') {
    const action = url
      ? `<a class="btn btn-light" href="${safe(url)}" target="_blank" rel="noopener">Open</a>`
      : '';

    return `<article class="item-row">
      <div>
        <h3>${safe(title || 'Untitled')}</h3>
        <p>${safe(description || 'No description provided.')}</p>
      </div>
      <div class="item-meta">${safe(meta)} ${action}</div>
    </article>`;
  }

  // Materials use their database ID, never the private storage path.
  function materialRow(item) {
    const id = Number(item?.id);
    const validId = Number.isSafeInteger(id) && id > 0;

    const action = validId
      ? `<button class="btn btn-light" type="button"
           data-download-material="${id}">Open / Download</button>`
      : '<span>Download unavailable</span>';

    return `<article class="item-row">
      <div>
        <h3>${safe(first(item, ['title', 'name'], 'Learning material'))}</h3>
        <p>${safe(first(item, ['description', 'file_name'], 'Shared resource'))}</p>
      </div>
      <div class="item-meta">
        ${safe(first(item, ['class_name', 'created_at'], 'Material'))}
        ${action}
      </div>
    </article>`;
  }

  function renderList(id, records, type) {
    const host = $(id);
    if (!host) return;

    if (!records.length) {
      host.innerHTML = '<p class="empty">No records were returned for this section yet.</p>';
      return;
    }

    host.innerHTML = records.map(item => {
      if (type === 'lessons') {
        return row(
          first(item, ['title', 'topic', 'name'], 'Untitled lesson'),
          first(item, ['description', 'introduction', 'learning_objectives'], 'Lesson content'),
          first(item, ['class_name', 'class', 'status'], 'Virtual lesson'),
          first(item, ['content_url', 'url', 'lesson_url'], '')
        );
      }

      if (type === 'materials') return materialRow(item);

      if (type === 'students') {
        return row(
          first(item, ['full_name', 'name', 'username'], 'Student'),
          first(item, ['email'], 'Student account'),
          first(item, ['username', 'role'], 'Learner')
        );
      }

      return row(
        first(item, ['title', 'lesson_title', 'name'], 'Submission'),
        first(item, ['submission_text', 'feedback', 'submission_url'], 'Submitted work'),
        first(item, ['submitted_at', 'status'], 'Submission'),
        first(item, ['submission_url'], '')
      );
    }).join('');
  }

  async function load(type) {
    const map = {
      lessons: {
        action: 'list_lessons',
        keys: ['lessons', 'data'],
        id: 'lessons-list'
      },
      materials: {
        action: 'list_materials',
        keys: ['materials', 'data'],
        id: 'materials-list'
      },
      students: {
        action: 'list_students',
        keys: ['students', 'data'],
        id: 'students-list'
      },
      submissions: {
        action: 'list_submissions',
        keys: ['submissions', 'data'],
        id: 'submissions-list'
      }
    };

    const conf = map[type];
    if (!conf) return;

    const host = $(conf.id);
    if (host) host.innerHTML = '<p class="empty">Loading…</p>';

    try {
      const data = await api(conf.action);
      const records = itemsFrom(data, conf.keys);
      state[type] = records;
      renderList(conf.id, records, type);
      updateStats();
      setConnection(true, 'Connected to learning service');
    } catch (error) {
      if (host) {
        host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
      }
      setConnection(false, 'Service needs attention');
    }
  }

  async function downloadMaterial(materialId, button) {
    if (!getToken()) {
      showNotice('Your session has expired. Please sign in again.', true);
      return;
    }

    // Open the new tab immediately to avoid popup blockers.
    const newTab = window.open('about:blank', '_blank');

    if (newTab) {
      try {
        newTab.document.title = 'Preparing secure download';
        newTab.document.body.innerHTML =
          '<p style="font-family:sans-serif;padding:1rem">Preparing secure download…</p>';
      } catch (_) {}
    }

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing…';

    try {
      // The server checks permissions and creates the temporary URL.
      const result = await api('get_material_download', {
        material_id: materialId
      });

      if (!result.download_url) {
        throw new Error('The server did not return a download link.');
      }

      if (newTab && !newTab.closed) {
        newTab.location.replace(result.download_url);
      } else {
        window.location.assign(result.download_url);
      }

      showNotice('Secure link created. It expires in five minutes.');
    } catch (error) {
      if (newTab && !newTab.closed) newTab.close();
      showNotice(error.message || 'Could not open this material.', true);
    } finally {
      button.disabled = false;
      button.textContent = previousText || 'Open / Download';
    }
  }

  function updateStats() {
    const count = key => state[key].length;

    if ($('stat-lessons')) $('stat-lessons').textContent = count('lessons');
    if ($('stat-materials')) $('stat-materials').textContent = count('materials');
    if ($('stat-students')) $('stat-students').textContent = count('students');
    if ($('stat-submissions')) $('stat-submissions').textContent = count('submissions');

    renderList('recent-lessons', state.lessons.slice(0, 5), 'lessons');
  }

  async function loadAll() {
    await Promise.all([
      'lessons',
      'materials',
      ...(role === 'trainer' ? ['students', 'submissions'] : [])
    ].map(load));

    if (role === 'student' && $('stat-submissions')) {
      $('stat-submissions').textContent = '—';
    }
  }

  function switchView(view) {
    document.querySelectorAll('.view').forEach(el => {
      el.hidden = true;
    });

    const panel = $(`view-${view}`);
    if (panel) panel.hidden = false;

    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    const titles = {
      overview: role === 'trainer' ? 'Dashboard overview' : 'My dashboard',
      lessons: 'Virtual lessons',
      materials: 'Learning materials',
      students: 'Students',
      submissions: role === 'trainer' ? 'Student submissions' : 'My submissions',
      feature: $('feature-title')?.textContent || 'Feature'
    };

    if ($('page-title')) {
      $('page-title').textContent = titles[view] || 'Dashboard';
    }
  }

  function showFeature(key) {
    const info = featureInfo[key] || [
      'Feature restoration',
      'This feature existed in the original PHP website and is listed for restoration.'
    ];

    if ($('feature-title')) $('feature-title').textContent = info[0];
    if ($('feature-description')) $('feature-description').textContent = info[1];

    switchView('feature');
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  function setupNavigation() {
    document.addEventListener('click', event => {
      const downloadButton = event.target.closest('[data-download-material]');

      if (downloadButton) {
        const id = Number(downloadButton.dataset.downloadMaterial);
        if (Number.isSafeInteger(id) && id > 0) {
          downloadMaterial(id, downloadButton);
        }
        return;
      }

      const go = event.target.closest('[data-go]');
      if (go) {
        switchView(go.dataset.go);
        return;
      }

      const nav = event.target.closest('[data-view]');
      if (nav) {
        switchView(nav.dataset.view);
        if (['lessons', 'materials', 'students', 'submissions'].includes(nav.dataset.view)) {
          load(nav.dataset.view);
        }
        return;
      }

      const feature = event.target.closest('[data-feature]');
      if (feature) {
        showFeature(feature.dataset.feature);
        return;
      }

      const reload = event.target.closest('[data-reload]');
      if (reload) load(reload.dataset.reload);
    });
  }

  function submitForm(formId, action, fieldsBuilder, successMessage) {
    const form = $(formId);
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;

      try {
        const fields = fieldsBuilder(new FormData(form));
        await api(action, fields);
        form.reset();
        showNotice(successMessage);
        await load(action === 'create_lesson' ? 'lessons' : 'materials');
      } catch (error) {
        showNotice(error.message, true);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function boot() {
    if ($('year')) $('year').textContent = new Date().getFullYear();

    state.user = readUser();
    const name = first(
      state.user,
      ['full_name', 'name', 'username'],
      role === 'trainer' ? 'Trainer' : 'Student'
    );

    if ($('signed-in-user')) $('signed-in-user').textContent = name;
    if ($('welcome-name')) $('welcome-name').textContent = name;

    if (!getToken()) {
      showNotice('No active session token was found. Please sign in again to continue.', true);
      setConnection(false, 'Sign-in required');
    }

    setupNavigation();

    if ($('refresh-button')) {
      $('refresh-button').addEventListener('click', loadAll);
    }

    if ($('logout-button')) {
      $('logout-button').addEventListener('click', () => {
        sessionStorage.removeItem('virtual_platform_token');
        sessionStorage.removeItem('virtual_platform_user');
        location.href = 'index.html';
      });
    }

    if (role === 'trainer') {
      submitForm('lesson-form', 'create_lesson', fd => ({
        title: fd.get('title'),
        class_name: fd.get('class_name'),
        description: fd.get('description'),
        content_url: fd.get('content_url'),
        published: fd.get('published') === 'on'
      }), 'Lesson saved.');

      submitForm('material-form', 'create_material', fd => ({
        title: fd.get('title'),
        description: fd.get('description'),
        file_url: fd.get('file_url'),
        class_name: fd.get('class_name')
      }), 'Learning material added.');
    }

    await loadAll();
  }

  boot().catch(error => {
    setConnection(false, 'Unable to initialise');
    showNotice(error.message, true);
  });
})();
