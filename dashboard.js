(() => {
  'use strict';
  const role = document.body.dataset.role || 'student';
  const cfg = window.VIRTUAL_PLATFORM_CONFIG || {};
  const apiBase = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  const state = { lessons: [], materials: [], students: [], submissions: [], user: null };
  const featureInfo = {
    users:['User management','The original trainer dashboard includes user management for students and trainers. Restore this module with role-safe list/create/update actions.'],
    classes:['Class management','The original PHP version created classes, enrolled students and assigned courses. The corresponding data and permission actions must be migrated.'],
    courses:['Courses and units','Restore the original courses, class-course assignments, student-course assignments and enrollment data.'],
    curriculum:['Curriculum documents','Restore curriculum metadata and the old private curriculum file access with safe storage permissions.'],
    'past-papers':['Past papers','Restore past-paper records, question trees, model answers, marking guides and student-facing access.'],
    quizzes:['Quizzes and results','Restore quiz settings, question management, attempt limits, scoring and result history.'],
    progress:['Student progress','Restore lesson sessions, section completion, completion records and progress summaries.'],
    'virtual-trainer':['Virtual trainer settings','Restore trainer rules, settings, activity, research notes, transcripts and conversations.'],
    results:['My results','Restore student assessment results and historical quiz scores.']
  };
  function readUser(){ try{return JSON.parse(sessionStorage.getItem('virtual_platform_user')||'null')}catch{return null} }
  function getToken(){ return sessionStorage.getItem('virtual_platform_token') || ''; }
  function showNotice(message, error=false){ const box=$('notice'); if(!box)return; box.hidden=false; box.textContent=message; box.classList.toggle('error',error); }
  function setConnection(ok,message){ const el=$('connection-status'); if(!el)return; el.textContent=message; el.classList.toggle('offline',!ok); }
  async function api(action, fields={}) {
    if(!apiBase) throw new Error('Backend URL is not configured in config.js.');
    const token=getToken();
    const response=await fetch(apiBase,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,token,...fields})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }
  function itemsFrom(data, keys){ if(Array.isArray(data))return data; for(const key of keys){if(Array.isArray(data?.[key]))return data[key]} return []; }
  function safe(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function first(obj, keys, fallback=''){ for(const key of keys){if(obj && obj[key]!==undefined && obj[key]!==null && obj[key]!=='')return obj[key]} return fallback; }
  function row(title, description, meta='', url=''){
    const action = url ? `<a class="btn btn-light" href="${safe(url)}" target="_blank" rel="noopener">Open</a>` : '';
    return `<article class="item-row"><div><h3>${safe(title||'Untitled')}</h3><p>${safe(description||'No description provided.')}</p></div><div class="item-meta">${safe(meta)} ${action}</div></article>`;
  }
  function renderList(id, records, type){ const host=$(id); if(!host)return; if(!records.length){host.innerHTML='<p class="empty">No records were returned for this section yet.</p>';return;}
    host.innerHTML=records.map(item=>{
      if(type==='lessons')return row(first(item,['title','topic','name'],'Untitled lesson'),first(item,['description','introduction','learning_objectives'],'Lesson content'),first(item,['class_name','class','status'],'Virtual lesson'),first(item,['content_url','url','lesson_url'],''));
      if(type==='materials')return row(first(item,['title','name'],'Learning material'),first(item,['description','file_name'],'Shared resource'),first(item,['class_name','created_at'],'Material'),first(item,['file_url','url','content_url'],''));
      if(type==='students')return row(first(item,['full_name','name','username'],'Student'),first(item,['email'],'Student account'),first(item,['username','role'],'Learner'));
      return row(first(item,['title','lesson_title','name'],'Submission'),first(item,['submission_text','feedback','submission_url'],'Submitted work'),first(item,['submitted_at','status'],'Submission'),first(item,['submission_url'],''));
    }).join('');
  }
  async function load(type){
    const map={lessons:{action:'list_lessons',keys:['lessons','data'],id:'lessons-list'},materials:{action:'list_materials',keys:['materials','data'],id:'materials-list'},students:{action:'list_students',keys:['students','data'],id:'students-list'},submissions:{action:'list_submissions',keys:['submissions','data'],id:'submissions-list'}};
    const conf=map[type]; if(!conf)return;
    const host=$(conf.id); if(host)host.innerHTML='<p class="empty">Loading…</p>';
    try{ const data=await api(conf.action); const records=itemsFrom(data,conf.keys); state[type]=records; renderList(conf.id,records,type); updateStats(); setConnection(true,'Connected to learning service'); }
    catch(error){ if(host)host.innerHTML=`<p class="empty">${safe(error.message)}</p>`; setConnection(false,'Service needs attention'); }
  }
  function updateStats(){ const count=(key)=>state[key].length; if($('stat-lessons'))$('stat-lessons').textContent=count('lessons'); if($('stat-materials'))$('stat-materials').textContent=count('materials'); if($('stat-students'))$('stat-students').textContent=count('students'); if($('stat-submissions'))$('stat-submissions').textContent=count('submissions'); renderList('recent-lessons',state.lessons.slice(0,5),'lessons'); }
  async function loadAll(){ await Promise.all(['lessons','materials',...(role==='trainer'?['students','submissions']:[])].map(load)); if(role==='student')$('stat-submissions').textContent='—'; }
  function switchView(view){ document.querySelectorAll('.view').forEach(el=>el.hidden=true); const panel=$(`view-${view}`); if(panel)panel.hidden=false; document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===view)); const titles={overview:role==='trainer'?'Dashboard overview':'My dashboard',lessons:'Virtual lessons',materials:'Learning materials',students:'Students',submissions:role==='trainer'?'Student submissions':'My submissions',feature:$('feature-title')?.textContent||'Feature'}; if($('page-title'))$('page-title').textContent=titles[view]||'Dashboard'; }
  function showFeature(key){const info=featureInfo[key]||['Feature restoration','This feature existed in the original PHP website and is listed for restoration.']; $('feature-title').textContent=info[0]; $('feature-description').textContent=info[1]; switchView('feature'); document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.remove('active')); }
  function setupNavigation(){document.addEventListener('click',e=>{const go=e.target.closest('[data-go]');if(go){switchView(go.dataset.go);return;}const nav=e.target.closest('[data-view]');if(nav){switchView(nav.dataset.view);if(['lessons','materials','students','submissions'].includes(nav.dataset.view))load(nav.dataset.view);return;}const feature=e.target.closest('[data-feature]');if(feature){showFeature(feature.dataset.feature);return;}const reload=e.target.closest('[data-reload]');if(reload)load(reload.dataset.reload);});}
  async function submitForm(formId, action, fieldsBuilder, successMessage){const form=$(formId);if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;try{const fields=fieldsBuilder(new FormData(form));await api(action,fields);form.reset();showNotice(successMessage);await load(action==='create_lesson'?'lessons':'materials');}catch(error){showNotice(error.message,true);}finally{button.disabled=false;}});}
  async function boot(){ $('year').textContent=new Date().getFullYear(); state.user=readUser(); const name=first(state.user,['full_name','name','username'],role==='trainer'?'Trainer':'Student'); $('signed-in-user').textContent=name; $('welcome-name').textContent=name;
    if(!getToken()){showNotice('No active session token was found. Please sign in again to continue.',true);setConnection(false,'Sign-in required');}
    setupNavigation(); $('refresh-button').addEventListener('click',loadAll); $('logout-button').addEventListener('click',()=>{sessionStorage.removeItem('virtual_platform_token');sessionStorage.removeItem('virtual_platform_user');location.href='index.html';});
    if(role==='trainer'){
      submitForm('lesson-form','create_lesson',fd=>({title:fd.get('title'),class_name:fd.get('class_name'),description:fd.get('description'),content_url:fd.get('content_url'),published:fd.get('published')==='on'}),'Lesson saved.');
      submitForm('material-form','create_material',fd=>({title:fd.get('title'),description:fd.get('description'),file_url:fd.get('file_url'),class_name:fd.get('class_name')}),'Learning material added.');
    }
    await loadAll();
  }
  boot().catch(err=>{setConnection(false,'Unable to initialise');showNotice(err.message,true);});
})();
