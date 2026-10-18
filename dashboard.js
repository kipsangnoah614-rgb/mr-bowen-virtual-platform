
(() => {
  'use strict';

  const role = document.body.dataset.role || 'student';
  const cfg = window.VIRTUAL_PLATFORM_CONFIG || {};
  const apiBase = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
  const $ = id => document.getElementById(id);

  const state = {
    lessons: [], materials: [], students: [], submissions: [],
    classes: [], courses: [], user: null, selectedClass: null,
    papers: [], paperQuestions: [], quizzes: [], selectedQuiz: null,
    quizAnswers: {}, trainer: null, trainerSettings: null, chat: []
  };

  const featureInfo = {
    users: ['User management', 'Manage registered users.'],
    classes: ['Class management', 'Manage classes and enrolments.'],
    courses: ['Courses and Units', 'Manage courses and class assignments.'],
    curriculum: ['Curriculum documents', 'Curriculum resources.'],
    'past-papers': ['Past Papers', 'Browse published examination papers.'],
    quizzes: ['Quizzes and Results', 'Take quizzes and review attempts.'],
    progress: ['Student Progress', 'Track learning progress.'],
    'virtual-trainer': ['Virtual Trainer', 'Your learning assistant.'],
    results: ['My Results', 'Review assessment results.']
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

  function itemsFrom(data, keys = []) {
    if (Array.isArray(data)) return data;
    for (const key of keys) {
      if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
  }

  function showNotice(message, error = false) {
    const box = $('notice');
    if (!box) {
      alert(message);
      return;
    }
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

  function featureHost() {
    return document.querySelector('#view-feature .feature-panel');
  }

  function setFeature(title, description = '') {
    const host = featureHost();
    if (!host) {
      showNotice('The dashboard feature panel is missing.', true);
      return null;
    }

    host.innerHTML = `
      <h2>${safe(title)}</h2>
      <p class="muted">${safe(description)}</p>
      <div id="feature-content"><p class="empty">Loading…</p></div>
      <p><button class="btn btn-light" data-go="overview" type="button">
        Return to dashboard
      </button></p>`;

    switchView('feature');
    return $('feature-content');
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

  function row(title, description, meta = '', url = '') {
    const action = url
      ? `<a class="btn btn-light" href="${safe(url)}"
          target="_blank" rel="noopener">Open</a>`
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
      ? `<button class="btn btn-light" type="button"
          data-download-material="${id}">Open / Download</button>`
      : '';

    return `<article class="item-row">
      <div><h3>${safe(first(item, ['title', 'name'], 'Learning material'))}</h3>
      <p>${safe(first(item, ['description', 'file_name'], 'Shared resource'))}</p></div>
      <div class="item-meta">${action}</div>
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
          first(item, ['title', 'topic', 'name'], 'Lesson'),
          first(item, ['description', 'introduction'], 'Lesson content'),
          first(item, ['class_name', 'status'], 'Lesson'),
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
        action: 'list_lessons', keys: ['lessons', 'data'], id: 'lessons-list'
      },
      materials: {
        action: 'list_materials', keys: ['materials', 'data'], id: 'materials-list'
      },
      students: {
        action: 'list_students', keys: ['students', 'data'], id: 'students-list'
      },
      submissions: {
        action: 'list_submissions', keys: ['submissions', 'data'], id: 'submissions-list'
      }
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

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing…';

    try {
      const result = await api('get_material_download', {
        material_id: materialId
      });

      if (!result.download_url) {
        throw new Error('The server did not return a download link.');
      }

      window.open(result.download_url, '_blank', 'noopener');
      showNotice('Secure download link created.');
    } catch (error) {
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

    const recent = $('recent-lessons');
    if (recent) {
      recent.innerHTML = state.lessons.length
        ? state.lessons.slice(0, 5).map(item => row(
            first(item, ['title', 'topic'], 'Lesson'),
            first(item, ['description'], 'Lesson'),
            first(item, ['class_name'], '')
          )).join('')
        : '<p class="empty">No lessons available yet.</p>';
    }
  }

  async function loadAll() {
    const jobs = ['lessons', 'materials'];
    if (role === 'trainer') jobs.push('students', 'submissions');

    await Promise.all(jobs.map(load));
  }

  // ---------------- PAST PAPERS ----------------

  async function renderStudentPastPapers() {
    const host = setFeature(
      'Past Papers',
      'Choose a published paper to view its questions.'
    );
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading past papers…</p>';

    try {
      const data = await api('list_past_papers');
      state.papers = itemsFrom(data, ['past_papers', 'papers', 'data']);

      if (!state.papers.length) {
        host.innerHTML = `
          <p class="empty">No past papers are available to this account.</p>
          <p class="muted">Check the paper publication status, course assignment,
          student enrolment, and backend access rules.</p>`;
        return;
      }

      host.innerHTML = state.papers.map(paper => {
        const id = Number(first(paper, ['id', 'paper_id'], 0));
        return `<article class="item-row">
          <div>
            <h3>${safe(first(paper, ['title'], 'Past paper'))}</h3>
            <p>${safe(first(paper, ['exam_session'], ''))}
              ${safe(first(paper, ['exam_year'], ''))}</p>
            <small>${safe(first(paper, ['course_name'], 'Course'))}</small>
          </div>
          <div class="item-meta">
            <button class="btn btn-primary" type="button"
              data-open-paper="${safe(id)}">View questions</button>
          </div>
        </article>`;
      }).join('');
    } catch (error) {
      host.innerHTML = `
        <p class="empty">Unable to load past papers: ${safe(error.message)}</p>
        <p class="muted">Confirm that quick-service supports the
        <code>list_past_papers</code> action.</p>`;
    }
  }

  async function openPastPaper(paperId) {
    const host = setFeature('Past Paper', 'Examination questions');
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading questions…</p>';

    try {
      const data = await api('get_past_paper_questions', {
        paper_id: paperId
      });

      state.paperQuestions = itemsFrom(
        data, ['questions', 'past_paper_questions', 'data']
      );

      if (!state.paperQuestions.length) {
        host.innerHTML = `
          <p class="empty">No questions were returned for this paper.</p>
          <button class="btn btn-light" data-feature="past-papers">
            Back to papers
          </button>`;
        return;
      }

      host.innerHTML = state.paperQuestions.map((q, index) => `
        <article class="panel">
          <h3>Question ${safe(first(q, ['question_number'], index + 1))}
            (${safe(first(q, ['marks'], 0))} marks)</h3>
          <p>${safe(first(q, ['question_text', 'question'], 'Question text unavailable'))}</p>
        </article>
      `).join('') + `
        <button class="btn btn-light" data-feature="past-papers">
          Back to papers
        </button>`;
    } catch (error) {
      host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
    }
  }

  // ---------------- QUIZZES ----------------

  async function renderStudentQuizzes() {
    const host = setFeature(
      'Quizzes',
      'Select an available quiz. Your submitted attempts are saved by the server.'
    );
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading quizzes…</p>';

    try {
      const data = await api('list_quizzes');
      state.quizzes = itemsFrom(data, ['quizzes', 'data']);

      if (!state.quizzes.length) {
        host.innerHTML = `
          <p class="empty">No quizzes are currently available.</p>
          <p class="muted">Only quizzes allowed by the backend access and
          availability rules will be displayed.</p>`;
        return;
      }

      host.innerHTML = state.quizzes.map(quiz => {
        const id = Number(first(quiz, ['id', 'quiz_id'], 0));
        return `<article class="item-row">
          <div>
            <h3>${safe(first(quiz, ['title'], 'Quiz'))}</h3>
            <p>${safe(first(quiz, ['description'], 'No description'))}</p>
            <small>Time limit: ${safe(first(quiz, ['time_limit_minutes'], 'Not specified'))} minutes</small>
          </div>
          <div class="item-meta">
            <button class="btn btn-primary" type="button"
              data-start-quiz="${safe(id)}">Start quiz</button>
          </div>
        </article>`;
      }).join('');
    } catch (error) {
      host.innerHTML = `
        <p class="empty">Unable to load quizzes: ${safe(error.message)}</p>
        <p class="muted">Confirm that quick-service supports
        <code>list_quizzes</code>.</p>`;
    }
  }

  async function startQuiz(quizId) {
    const host = setFeature('Take Quiz', 'Answer the questions and submit once ready.');
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading quiz…</p>';

    try {
      const data = await api('get_quiz', { quiz_id: quizId });
      const quiz = data.quiz || data;
      const questions = itemsFrom(data, ['questions', 'lesson_assessments', 'data']);

      state.selectedQuiz = quiz;
      state.quizAnswers = {};

      if (!questions.length) {
        host.innerHTML = `
          <p class="empty">This quiz has no questions available.</p>
          <p class="muted">The quiz may not have a linked lesson, or the
          backend may not yet return its questions.</p>`;
        return;
      }

      host.innerHTML = `
        <h3>${safe(first(quiz, ['title'], 'Quiz'))}</h3>
        <p>${safe(first(quiz, ['description'], ''))}</p>
        <form id="take-quiz-form">
          ${questions.map((q, index) => {
            const id = String(first(q, ['id'], index + 1));
            const questionText = first(q, ['question', 'question_text'], 'Question');
            const type = String(first(q, ['question_type'], 'multiple_choice')).toLowerCase();
            const options = [
              ['A', q.option_a], ['B', q.option_b],
              ['C', q.option_c], ['D', q.option_d]
            ].filter(item => item[1] !== null && item[1] !== undefined && item[1] !== '');

            return `<section class="panel">
              <h3>Question ${index + 1}</h3>
              <p>${safe(questionText)}</p>
              ${options.length ? options.map(([letter, label]) => `
                <label style="display:block;margin:8px 0">
                  <input type="radio" name="q_${safe(id)}"
                    value="${safe(letter)}" required>
                  ${safe(letter)}. ${safe(label)}
                </label>`).join('') :
                `<label>Answer
                  <textarea name="q_${safe(id)}" rows="3" required></textarea>
                </label>`}
              <small>${safe(first(q, ['marks'], ''))} marks</small>
            </section>`;
          }).join('')}
          <button class="btn btn-primary" type="submit">Submit quiz</button>
          <button class="btn btn-light" type="button" data-feature="quizzes">Cancel</button>
        </form>`;

      const form = $('take-quiz-form');
      form?.addEventListener('submit', async event => {
        event.preventDefault();

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        const answers = {};
        for (const [key, value] of new FormData(form).entries()) {
          if (key.startsWith('q_')) answers[key.slice(2)] = value;
        }

        try {
          const result = await api('submit_quiz', {
            quiz_id: quizId,
            answers
          });

          const score = first(result, ['score'], null);
          const total = first(result, ['total_marks'], null);
          const percentage = first(result, ['percentage'], null);
          const passed = first(result, ['passed'], null);

          host.innerHTML = `
            <h3>Quiz submitted</h3>
            <p>Your answers have been sent to the server.</p>
            ${score !== null ? `<p>Score: ${safe(score)} / ${safe(total)}</p>` : ''}
            ${percentage !== null ? `<p>Percentage: ${safe(percentage)}%</p>` : ''}
            ${passed !== null ? `<p>Status: ${passed ? 'Passed' : 'Not passed'}</p>` : ''}
            <button class="btn btn-primary" data-feature="quizzes">Return to quizzes</button>`;
        } catch (error) {
          showNotice(error.message, true);
          button.disabled = false;
        }
      });
    } catch (error) {
      host.innerHTML = `
        <p class="empty">Unable to open quiz: ${safe(error.message)}</p>
        <button class="btn btn-light" data-feature="quizzes">Back to quizzes</button>`;
    }
  }

  // ---------------- VIRTUAL TRAINER ----------------

  async function renderStudentVirtualTrainer() {
    const host = setFeature(
      'Virtual Trainer',
      'Ask questions about your learning. Responses depend on the server integration.'
    );
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading virtual trainer…</p>';

    try {
      const data = await api('get_virtual_trainer');
      state.trainer = data.trainer || data;

      host.innerHTML = `
        <section class="panel">
          <h3>${safe(first(state.trainer, ['trainer_name', 'name'], 'Virtual Trainer'))}</h3>
          <p>${safe(first(state.trainer, ['welcome_message'], 'Welcome! What would you like help learning today?'))}</p>
        </section>
        <section class="panel">
          <div id="virtual-trainer-chat" aria-live="polite">
            <p class="muted">Start by typing a question below.</p>
          </div>
          <form id="virtual-trainer-form" class="stack-form">
            <label>Your question
              <textarea name="message" rows="3" required
                placeholder="Type your learning question…"></textarea>
            </label>
            <button class="btn btn-primary" type="submit">Send question</button>
          </form>
        </section>`;

      $('virtual-trainer-form')?.addEventListener('submit', async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const button = form.querySelector('button[type="submit"]');
        const message = String(new FormData(form).get('message') || '').trim();
        if (!message) return;

        button.disabled = true;
        const chat = $('virtual-trainer-chat');
        chat.innerHTML += `<p><strong>You:</strong> ${safe(message)}</p>`;

        try {
          const result = await api('virtual_trainer_message', { message });
          const reply = first(result, ['reply', 'response', 'answer', 'message'],
            'The service returned no response text.');

          chat.innerHTML += `<p><strong>Virtual Trainer:</strong> ${safe(reply)}</p>`;
          form.reset();
        } catch (error) {
          chat.innerHTML += `
            <p class="empty">The trainer could not respond: ${safe(error.message)}</p>
            <p class="muted">A working AI response requires a supported backend action
            and, if applicable, a configured server-side AI provider.</p>`;
        } finally {
          button.disabled = false;
        }
      });
    } catch (error) {
      host.innerHTML = `
        <p class="empty">Unable to load the virtual trainer: ${safe(error.message)}</p>
        <p class="muted">The deployed quick-service function must implement
        <code>get_virtual_trainer</code> before this screen can load.</p>`;
    }
  }

  // ---------------- TRAINER FEATURE SCREENS ----------------

  async function renderTrainerListFeature(key, action, keys, title) {
    const host = setFeature(title, 'Records returned by your secure learning service.');
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading…</p>';

    try {
      const data = await api(action);
      const records = itemsFrom(data, keys);

      if (!records.length) {
        host.innerHTML = `<p class="empty">No records returned.</p>
          <p class="muted">Creating or editing records requires the relevant
          backend management actions.</p>`;
        return;
      }

      host.innerHTML = records.map(item => {
        const id = Number(first(item, ['id', 'paper_id', 'quiz_id'], 0));
        const name = first(item, ['title', 'trainer_name'], title);
        const desc = first(item, ['description', 'exam_session', 'welcome_message'], '');
        const meta = [
          first(item, ['status'], ''),
          first(item, ['exam_year', 'time_limit_minutes'], '')
        ].filter(Boolean).join(' · ');

        return row(name, desc, meta) +
          (id ? `<p><small>Record ID: ${safe(id)}</small></p>` : '');
      }).join('');
    } catch (error) {
      host.innerHTML = `
        <p class="empty">${safe(error.message)}</p>
        <p class="muted">Check whether the deployed quick-service function
        implements <code>${safe(action)}</code>.</p>`;
    }
  }

  async function showFeature(key) {
    const info = featureInfo[key] || ['Feature', 'Feature details'];

    if (role !== 'trainer') {
      if (key === 'past-papers') return renderStudentPastPapers();
      if (key === 'quizzes') return renderStudentQuizzes();
      if (key === 'virtual-trainer') return renderStudentVirtualTrainer();

      setFeature(info[0], info[1]);
      return;
    }

    if (key === 'past-papers') {
      return renderTrainerListFeature(
        key, 'list_past_papers', ['past_papers', 'papers', 'data'], info[0]
      );
    }

    if (key === 'quizzes') {
      return renderTrainerListFeature(
        key, 'list_quizzes', ['quizzes', 'data'], info[0]
      );
    }

    if (key === 'virtual-trainer') {
      const host = setFeature(info[0], info[1]);
      if (!host) return;

      host.innerHTML = '<p class="empty">Loading trainer settings…</p>';

      try {
        const [trainerData, settingsData, rulesData] = await Promise.all([
          api('get_virtual_trainer'),
          api('get_virtual_trainer_settings'),
          api('list_virtual_trainer_rules')
        ]);

        const trainer = trainerData.trainer || trainerData;
        const settings = settingsData.settings || settingsData;
        const rules = itemsFrom(rulesData, ['rules', 'data']);

        host.innerHTML = `
          <section class="panel">
            <h3>${safe(first(trainer, ['trainer_name'], 'Virtual Trainer'))}</h3>
            <p>${safe(first(trainer, ['welcome_message'], 'No welcome message set.'))}</p>
            <p>Status: ${safe(first(trainer, ['status'], 'Unknown'))}</p>
          </section>
          <section class="panel">
            <h3>Teaching settings</h3>
            <pre style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(JSON.stringify(settings, null, 2))}</pre>
          </section>
          <section class="panel">
            <h3>Trainer rules (${rules.length})</h3>
            ${rules.length ? rules.map(rule => row(
              first(rule, ['rule_name'], 'Rule'),
              first(rule, ['rule_description'], ''),
              first(rule, ['status'], '')
            )).join('') : '<p class="empty">No rules returned.</p>'}
          </section>
          <p class="muted">This view displays existing settings. Editing settings
          requires backend update actions that are not assumed here.</p>`;
      } catch (error) {
        host.innerHTML = `<p class="empty">${safe(error.message)}</p>
          <p class="muted">One or more virtual-trainer actions may not exist yet
          in the deployed backend.</p>`;
      }
      return;
    }

    if (key === 'classes') return renderClassesScreen();
    if (key === 'courses') return renderCoursesScreen();

    const host = setFeature(info[0], info[1]);
    if (host) {
      host.innerHTML = `<p class="empty">This module is not connected yet.</p>`;
    }
  }

  // ---------------- CLASS MANAGEMENT ----------------

  async function renderClassesScreen() {
    const host = setFeature('Class management', 'Create classes and manage their course assignments.');
    if (!host) return;

    host.innerHTML = `
      <section class="panel">
        <h3>Create a class</h3>
        <form id="class-form" class="stack-form">
          <label>Class name<input name="class_name" required></label>
          <label>Class code<input name="class_code" required></label>
          <label>Level<input name="level"></label>
          <label>Description<textarea name="description" rows="2"></textarea></label>
          <button class="btn btn-primary" type="submit">Create class</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-heading"><h3>Existing classes</h3>
          <button class="btn btn-light" type="button" data-management-reload="classes">Reload</button>
        </div>
        <div id="management-classes-list"><p class="empty">Loading classes…</p></div>
      </section>`;

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

    await refreshClasses();
  }

  async function refreshClasses() {
    const host = $('management-classes-list');
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading classes…</p>';

    try {
      const data = await api('list_classes');
      state.classes = itemsFrom(data, ['classes', 'data']);

      host.innerHTML = state.classes.length
        ? state.classes.map(c => row(
            first(c, ['class_name', 'name'], 'Class'),
            first(c, ['description', 'level'], ''),
            `Code: ${first(c, ['class_code', 'code'], '')} · ID: ${first(c, ['id'], '')}`
          )).join('')
        : '<p class="empty">No classes found.</p>';
    } catch (error) {
      host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
    }
  }

  // ---------------- COURSE MANAGEMENT ----------------

  async function renderCoursesScreen() {
    const host = setFeature('Courses and units', 'Create and review courses.');
    if (!host) return;

    host.innerHTML = `
      <section class="panel">
        <h3>Create a course</h3>
        <form id="course-form" class="stack-form">
          <label>Course name<input name="course_name" required></label>
          <label>Course code<input name="course_code" required></label>
          <label>Level<input name="level"></label>
          <label>Description<textarea name="description" rows="2"></textarea></label>
          <button class="btn btn-primary" type="submit">Create course</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-heading"><h3>Existing courses</h3>
          <button class="btn btn-light" type="button" data-management-reload="courses">Reload</button>
        </div>
        <div id="management-courses-list"><p class="empty">Loading courses…</p></div>
      </section>`;

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

    await refreshCourses();
  }

  async function refreshCourses() {
    const host = $('management-courses-list');
    if (!host) return;

    host.innerHTML = '<p class="empty">Loading courses…</p>';

    try {
      const data = await api('list_courses');
      state.courses = itemsFrom(data, ['courses', 'data']);

      host.innerHTML = state.courses.length
        ? state.courses.map(c => row(
            first(c, ['course_name', 'name'], 'Course'),
            first(c, ['description', 'level'], ''),
            first(c, ['status'], 'active')
          )).join('')
        : '<p class="empty">No courses found.</p>';
    } catch (error) {
      host.innerHTML = `<p class="empty">${safe(error.message)}</p>`;
    }
  }

  // ---------------- NAVIGATION ----------------

  function setupNavigation() {
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const download = target.closest('[data-download-material]');
      if (download) {
        downloadMaterial(Number(download.dataset.downloadMaterial), download);
        return;
      }

      const paper = target.closest('[data-open-paper]');
      if (paper) {
        openPastPaper(Number(paper.dataset.openPaper));
        return;
      }

      const quiz = target.closest('[data-start-quiz]');
      if (quiz) {
        startQuiz(Number(quiz.dataset.startQuiz));
        return;
      }

      const reload = target.closest('[data-management-reload]');
      if (reload) {
        if (reload.dataset.managementReload === 'classes') refreshClasses();
        if (reload.dataset.managementReload === 'courses') refreshCourses();
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

      const reloadButton = target.closest('[data-reload]');
      if (reloadButton) load(reloadButton.dataset.reload);
    });
  }

  async function boot() {
    state.user = readUser();

    const name = first(
      state.user,
      ['full_name', 'name', 'username'],
      role === 'trainer' ? 'Trainer' : 'Student'
    );

    if ($('signed-in-user')) $('signed-in-user').textContent = name;
    if ($('welcome-name')) $('welcome-name').textContent = name;
    if ($('student-account')) $('student-account').textContent = name;

    if (!getToken()) {
      showNotice('No active session token was found. Please sign in again.', true);
      setConnection(false, 'Sign-in required');
    }

    setupNavigation();

    $('student-logout')?.addEventListener('click', logout);
    $('logout-button')?.addEventListener('click', logout);

    $('refresh-button')?.addEventListener('click', loadAll);

    await loadAll();
  }

  function logout() {
    sessionStorage.removeItem('virtual_platform_token');
    sessionStorage.removeItem('virtual_platform_user');
    location.href = 'index.html';
  }

  boot().catch(error => {
    setConnection(false, 'Unable to initialise');
    showNotice(error.message, true);
  });
})();
