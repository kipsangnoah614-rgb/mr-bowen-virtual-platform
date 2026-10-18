
(() => {
  'use strict';

  const role = document.body.dataset.role || 'student';
  const cfg = window.VIRTUAL_PLATFORM_CONFIG || {};
  const apiBase = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
  const $ = id => document.getElementById(id);

  const state = {
    lessons: [], materials: [], students: [], submissions: [],
    classes: [], courses: [], user: null, selectedClass: null
  };

  const featureInfo = {
    users: ['User management', 'User administration is not yet connected.'],
    classes: ['Class management', 'Create classes, assign courses and enrol students.'],
    courses: ['Courses and Units', 'Create courses and assign selected courses to classes.'],
    curriculum: ['Curriculum documents', 'Curriculum management is not yet connected.'],
    'past-papers': ['Past papers', 'Past-paper management is not yet connected.'],
    quizzes: ['Quizzes and results', 'Quiz management is not yet connected.'],
    progress: ['Student progress', 'Progress tracking is not yet connected.'],
    'virtual-trainer': ['Virtual trainer settings', 'Settings are not yet connected.'],
    results: ['My results', 'Results are not yet connected.']
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
    if (!apiBase) throw new Error('Backend URL is not configured in config.js.');

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
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function first(obj, keys, fallback = '') {
    for (const key of keys) {
      if (obj && obj[key] !== undefined &&
          obj[key] !== null && obj[key] !== '') return obj[key];
    }
    return fallback;
  }

  function row(title, description, meta = '', url = '') {
    const action = url
      ? `<a class="btn btn-light" href="${safe(url)}" target="_blank" rel="noopener">Open</a>`
      : '';

    return `<article class="item-row">
      <div><h3>${safe(title || 'Untitled')}</h3>
      <p>${safe(description || 'No description provided.')}</p></div>
      <div class="item-meta">${safe(meta)} ${action}</div>
    </article>`;
  }

  function materialRow(item) {
    const id = Number(item?.id);
    const action = Number.isSafeInteger(id) && id > 0
      ? `<button class="btn btn-light" type="button" data-download-material="${id}">Open / Download</button>`
      : '<span>Download unavailable</span>';

    return `<article class="item-row">
      <div><h3>${safe(first(item, ['title', 'name'], 'Learning material'))}</h3>
      <p>${safe(first(item, ['description', 'file_name'], 'Shared resource'))}</p></div>
      <div class="item-meta">${safe(first(item, ['class_name', 'created_at'], 'Material'))} ${action}</div>
    </article>`;
  }

  function renderList(id, records, type) {
    const host = $(id);
    if (!host) return;

    if (!records.length) {
      host.innerHTML = '<p class="empty">No records found.</p>';
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
      lessons: { action: 'list_lessons', keys: ['lessons', 'data'], id: 'lessons-list' },
      materials: { action: 'list_materials', keys: ['materials', 'data'], id: 'materials-list' },
      students: { action: 'list_students', keys: ['students', 'data'], id: 'students-list' },
      submissions: { action: 'list_submissions', keys: ['submissions', 'data'], id: 'submissions-list' }
    };

    const conf = map[type];
    if (!conf) return;

    const host = $(conf.id);
    if (host) host.innerHTML = '<p class="empty">Loading…</p>';

    try {
      const data = await api(conf.action);
      state[type] = itemsFrom(data, conf.keys);
      renderList(conf.id, state[type], type);
      updateStats();
      setConnection(true, 'Connected to learning service');
    } catch (error) {
      if (host) host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
      setConnection(false, 'Service needs attention');
    }
  }

  async function downloadMaterial(materialId, button) {
    if (!getToken()) {
      showNotice('Your session has expired. Please sign in again.', true);
      return;
    }

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
      const result = await api('get_material_download', { material_id: materialId });
      if (!result.download_url) throw new Error('The server did not return a download link.');

      if (newTab && !newTab.closed) newTab.location.replace(result.download_url);
      else window.location.assign(result.download_url);

      showNotice('Secure link created. It expires in five minutes.');
    } catch (error) {
      if (newTab && !newTab.closed) newTab.close();
      showNotice(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = previousText || 'Open / Download';
    }
  }

  function updateStats() {
    for (const key of ['lessons', 'materials', 'students', 'submissions']) {
      const el = $(`stat-${key}`);
      if (el) el.textContent = state[key].length;
    }
    renderList('recent-lessons', state.lessons.slice(0, 5), 'lessons');
  }

  async function loadAll() {
    const jobs = ['lessons', 'materials'];
    if (role === 'trainer') jobs.push('students', 'submissions');
    await Promise.all(jobs.map(load));
    if (role === 'student' && $('stat-submissions')) {
      $('stat-submissions').textContent = '—';
    }
  }

  function switchView(view) {
    document.querySelectorAll('.view').forEach(el => { el.hidden = true; });
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
    if ($('page-title')) $('page-title').textContent = titles[view] || 'Dashboard';
  }

  function showFeature(key) {
    const info = featureInfo[key] || ['Feature', 'Feature details'];
    if ($('feature-title')) $('feature-title').textContent = info[0];
    if ($('feature-description')) $('feature-description').textContent = info[1];

    switchView('feature');
    document.querySelectorAll('[data-view]').forEach(btn => btn.classList.remove('active'));

    if (role !== 'trainer') {
      const host = document.querySelector('#view-feature .feature-panel');
      if (host) host.innerHTML = `<h2>${safe(info[0])}</h2><p>${safe(info[1])}</p>`;
      return;
    }

    if (key === 'classes') renderClassesScreen();
    else if (key === 'courses') renderCoursesScreen();
    else {
      const host = document.querySelector('#view-feature .feature-panel');
      if (host) {
        host.innerHTML = `<div class="feature-symbol">🧩</div>
          <h2>${safe(info[0])}</h2><p>${safe(info[1])}</p>
          <p class="muted">This module has not yet been connected.</p>
          <button class="btn btn-primary" data-go="overview">Return to dashboard</button>`;
      }
    }
  }

  function featureHost() {
    return document.querySelector('#view-feature .feature-panel');
  }

  function renderClassesScreen() {
    const host = featureHost();
    if (!host) return;

    host.innerHTML = `
      <h2>Class management</h2>
      <p class="muted">Create classes, assign courses and enrol students.</p>
      <section class="panel">
        <h3>Create a class</h3>
        <form id="class-form" class="stack-form">
          <label>Class name<input name="class_name" required maxlength="120" placeholder="e.g. AEL526S"></label>
          <label>Class code<input name="class_code" required maxlength="50" placeholder="e.g. AEL526S"></label>
          <label>Level<input name="level" maxlength="50" placeholder="e.g. Level 5"></label>
          <label>Description<textarea name="description" rows="2"></textarea></label>
          <button class="btn btn-primary" type="submit">Create class</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-heading"><h3>Existing classes</h3>
          <button class="btn btn-light" type="button" data-management-reload="classes">Reload</button>
        </div>
        <div id="management-classes-list" class="list-area"><p class="empty">Loading classes…</p></div>
      </section>
      <section class="panel" id="selected-class-panel">
        <h3>Select a class</h3><p class="muted">Choose Manage on a class above to assign courses and enrol students.</p>
      </section>
      <button class="btn btn-light" data-go="overview">Return to dashboard</button>`;

    $('class-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;

      try {
        const fd = new FormData(form);
        await api('create_class', {
          class_name: String(fd.get('class_name') || '').trim(),
          class_code: String(fd.get('class_code') || '').trim(),
          level: String(fd.get('level') || '').trim(),
          description: String(fd.get('description') || '').trim()
        });
        form.reset();
        showNotice('Class created successfully.');
        await refreshClasses();
      } catch (error) {
        showNotice(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    refreshClasses();
  }

  async function refreshClasses() {
    const host = $('management-classes-list');
    if (host) host.innerHTML = '<p class="empty">Loading classes…</p>';

    try {
      const data = await api('list_classes');
      state.classes = itemsFrom(data, ['classes', 'data']);
      if (!host) return;

      if (!state.classes.length) {
        host.innerHTML = '<p class="empty">No classes found. Create your first class above.</p>';
        return;
      }

      host.innerHTML = state.classes.map(c => {
        const id = Number(first(c, ['id', 'class_id'], 0));
        return `<article class="item-row">
          <div><h3>${safe(first(c, ['class_name', 'name', 'title'], 'Unnamed class'))}</h3>
          <p>${safe(first(c, ['description', 'level'], 'Class'))}</p>
          <small>Code: ${safe(first(c, ['class_code', 'code'], '—'))} · ID: ${safe(id)}</small></div>
          <div class="item-meta"><button class="btn btn-primary" type="button" data-manage-class="${safe(id)}">Manage</button></div>
        </article>`;
      }).join('');
    } catch (error) {
      if (host) host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
    }
  }

  async function manageClass(classId) {
    const selected = state.classes.find(c => Number(first(c, ['id', 'class_id'], 0)) === classId);
    if (!selected) return;

    state.selectedClass = selected;
    const host = $('selected-class-panel');
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading class details…</p>';

    try {
      const [courseData, enrolData, courseListData] = await Promise.all([
        api('list_class_courses', { class_id: classId }),
        api('list_enrolments', { class_id: classId }),
        api('list_courses')
      ]);

      const assigned = itemsFrom(courseData, ['class_courses', 'assignments', 'courses', 'data']);
      const enrolments = itemsFrom(enrolData, ['enrolments', 'enrollments', 'students', 'data']);
      state.courses = itemsFrom(courseListData, ['courses', 'data']);

      const assignedIds = assigned.map(x => Number(first(x, ['course_id', 'id'], 0)));
      const availableCourses = state.courses.filter(c => {
        const id = Number(first(c, ['id', 'course_id'], 0));
        const status = String(first(c, ['status'], 'active')).toLowerCase();
        return id > 0 && !assignedIds.includes(id) && status === 'active';
      });

      const assignedHtml = assigned.length
        ? assigned.map(c => `<li>${safe(first(c, ['course_name', 'name', 'title'], 'Course'))}
            <small>${safe(first(c, ['course_code', 'code'], ''))}</small></li>`).join('')
        : '<li>No courses assigned yet.</li>';

      const studentOptions = state.students.map(s => {
        const id = Number(first(s, ['id', 'user_id', 'student_id'], 0));
        const label = first(s, ['full_name', 'name', 'username'], `Student ${id}`);
        return id > 0 ? `<option value="${safe(id)}">${safe(label)} (${safe(first(s, ['username'], id))})</option>` : '';
      }).join('');

      const enrolmentHtml = enrolments.length
        ? enrolments.map(e => {
            const studentId = Number(first(e, ['student_id', 'user_id', 'id'], 0));
            return `<article class="item-row"><div>
              <h3>${safe(first(e, ['full_name', 'student_name', 'name', 'username'], 'Enrolled student'))}</h3>
              <p>${safe(first(e, ['username', 'email'], 'Student'))}</p>
            </div><div class="item-meta">
              <button class="btn btn-danger" type="button" data-remove-enrolment="${safe(studentId)}" data-class-id="${safe(classId)}">Remove</button>
            </div></article>`;
          }).join('')
        : '<p class="empty">No students enrolled in this class yet.</p>';

      host.innerHTML = `
        <h3>Manage: ${safe(first(selected, ['class_name', 'name'], 'Class'))}</h3>
        <div class="content-grid">
          <section class="panel"><h3>Assign a course</h3>
            <form id="assign-course-form" class="stack-form">
              <label>Available courses
                <select name="course_id" required>
                  <option value="">Select a course</option>${availableCourses.map(c =>
                    `<option value="${safe(first(c, ['id', 'course_id'], ''))}">${safe(first(c, ['course_name', 'name', 'title'], 'Course'))} — ${safe(first(c, ['course_code', 'code'], ''))}</option>`
                  ).join('')}
                </select>
              </label>
              <button class="btn btn-primary" type="submit">Assign course</button>
            </form>
            <h4>Assigned courses</h4><ul>${assignedHtml}</ul>
          </section>
          <section class="panel"><h3>Enrol a student</h3>
            <form id="enrol-student-form" class="stack-form">
              <label>Registered student
                <select name="student_id" required>
                  <option value="">Select a student</option>${studentOptions}
                </select>
              </label>
              <button class="btn btn-primary" type="submit">Enrol student</button>
            </form>
          </section>
        </div>
        <section class="panel"><h3>Students enrolled in this class</h3>${enrolmentHtml}</section>`;

      $('assign-course-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const courseId = Number(new FormData(event.currentTarget).get('course_id'));
          await api('assign_course_to_class', { class_id: classId, course_id: courseId });
          showNotice('Course assigned to class.');
          await manageClass(classId);
        } catch (error) {
          showNotice(error.message, true);
        } finally {
          button.disabled = false;
        }
      });

      $('enrol-student-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          const studentId = Number(new FormData(event.currentTarget).get('student_id'));
          await api('enrol_student', { class_id: classId, student_id: studentId });
          showNotice('Student enrolled in class.');
          await manageClass(classId);
        } catch (error) {
          showNotice(error.message, true);
        } finally {
          button.disabled = false;
        }
      });
    } catch (error) {
      host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
    }
  }

  function renderCoursesScreen() {
    const host = featureHost();
    if (!host) return;

    host.innerHTML = `
      <h2>Courses and units</h2>
      <p class="muted">Create courses, then assign each course to the classes that should study it.</p>
      <section class="panel"><h3>Create a course</h3>
        <form id="course-form" class="stack-form">
          <label>Course or unit name<input name="course_name" required maxlength="180" placeholder="e.g. Refrigeration and Air Conditioning"></label>
          <label>Course code<input name="course_code" required maxlength="60" placeholder="e.g. CU-M4"></label>
          <label>Level<input name="level" maxlength="50" placeholder="e.g. Level 5"></label>
          <label>Description<textarea name="description" rows="2"></textarea></label>
          <button class="btn btn-primary" type="submit">Create course</button>
        </form>
      </section>
      <section class="panel"><div class="panel-heading"><h3>Existing courses</h3>
        <button class="btn btn-light" type="button" data-management-reload="courses">Reload</button></div>
        <div id="management-courses-list" class="list-area"><p class="empty">Loading courses…</p></div>
      </section>
      <button class="btn btn-light" data-go="overview">Return to dashboard</button>`;

    $('course-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const fd = new FormData(form);
        await api('create_course', {
          course_name: String(fd.get('course_name') || '').trim(),
          course_code: String(fd.get('course_code') || '').trim(),
          level: String(fd.get('level') || '').trim(),
          description: String(fd.get('description') || '').trim()
        });
        form.reset();
        showNotice('Course created successfully.');
        await refreshCourses();
      } catch (error) {
        showNotice(error.message, true);
      } finally {
        button.disabled = false;
      }
    });

    refreshCourses();
  }

  async function refreshCourses() {
    const host = $('management-courses-list');
    if (host) host.innerHTML = '<p class="empty">Loading courses…</p>';
    try {
      const data = await api('list_courses');
      state.courses = itemsFrom(data, ['courses', 'data']);
      if (!host) return;
      if (!state.courses.length) {
        host.innerHTML = '<p class="empty">No courses found. Create your first course above.</p>';
        return;
      }
      host.innerHTML = state.courses.map(c => `<article class="item-row">
        <div><h3>${safe(first(c, ['course_name', 'name', 'title'], 'Unnamed course'))}</h3>
        <p>${safe(first(c, ['description', 'level'], 'Course'))}</p></div>
        <div class="item-meta">Code: ${safe(first(c, ['course_code', 'code'], '—'))}
        · ${safe(first(c, ['status'], 'active'))}</div>
      </article>`).join('');
    } catch (error) {
      if (host) host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
    }
  }

  function setupNavigation() {
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const downloadButton = target.closest('[data-download-material]');
      if (downloadButton) {
        const id = Number(downloadButton.dataset.downloadMaterial);
        if (Number.isSafeInteger(id) && id > 0) downloadMaterial(id, downloadButton);
        return;
      }

      const manageButton = target.closest('[data-manage-class]');
      if (manageButton) {
        const id = Number(manageButton.dataset.manageClass);
        if (Number.isSafeInteger(id) && id > 0) manageClass(id);
        return;
      }

      const removeButton = target.closest('[data-remove-enrolment]');
      if (removeButton) {
        const studentId = Number(removeButton.dataset.removeEnrolment);
        const classId = Number(removeButton.dataset.classId);
        if (studentId > 0 && classId > 0 &&
            confirm('Remove this student from the selected class?')) {
          api('remove_student_from_class', { student_id: studentId, class_id: classId })
            .then(() => {
              showNotice('Student removed from class.');
              return manageClass(classId);
            })
            .catch(error => showNotice(error.message, true));
        }
        return;
      }

      const managementReload = target.closest('[data-management-reload]');
      if (managementReload) {
        if (managementReload.dataset.managementReload === 'classes') refreshClasses();
        if (managementReload.dataset.managementReload === 'courses') refreshCourses();
        return;
      }

      const go = target.closest('[data-go]');
      if (go) {
        switchView(go.dataset.go);
        return;
      }

      const nav = target.closest('[data-view]');
      if (nav) {
        switchView(nav.dataset.view);
        if (['lessons', 'materials', 'students', 'submissions'].includes(nav.dataset.view)) {
          load(nav.dataset.view);
        }
        return;
      }

      const feature = target.closest('[data-feature]');
      if (feature) {
        showFeature(feature.dataset.feature);
        return;
      }

      const reload = target.closest('[data-reload]');
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
        await api(action, fieldsBuilder(new FormData(form)));
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
    const name = first(state.user, ['full_name', 'name', 'username'],
      role === 'trainer' ? 'Trainer' : 'Student');

    if ($('signed-in-user')) $('signed-in-user').textContent = name;
    if ($('welcome-name')) $('welcome-name').textContent = name;

    if (!getToken()) {
      showNotice('No active session token was found. Please sign in again to continue.', true);
      setConnection(false, 'Sign-in required');
    }

    setupNavigation();

    $('refresh-button')?.addEventListener('click', async () => {
      await loadAll();
      if (role === 'trainer') {
        if (state.selectedClass) {
          await manageClass(Number(first(state.selectedClass, ['id', 'class_id'], 0)));
        }
      }
    });

    $('logout-button')?.addEventListener('click', () => {
      sessionStorage.removeItem('virtual_platform_token');
      sessionStorage.removeItem('virtual_platform_user');
      location.href = 'index.html';
    });

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
