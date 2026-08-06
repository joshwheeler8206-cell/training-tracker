const DB_NAME = 'usaf_training_db';
const DB_VER = 1;
const KEY = 'trainees';

const TOPICS = [
  'Pre-trip inspection', 'Post-trip inspection', 'Vehicle walk-around / fluids',
  'Safe driving & following distance', 'Backing procedures', 'Mirror use & scanning',
  'Customer interactions', 'Tablet usage & photo uploads', 'Delivery accuracy',
  'GPS use at every stop', 'Route navigation', 'Load securement',
  'C.O.D. handling & cash', 'Invoices & paperwork', 'Defensive driving', 'Hazmat awareness',
];

const MILESTONES = [
  'Orientation / classroom', 'Ride-along 1', 'Ride-along 2', 'Ride-along 3',
  'Ride-along 4', 'Solo with shadow', 'Ready for release', 'Released / sign-off',
];

const CHECKOFF_GROUPS = [
  { name: 'Pre & Post Trip', items: [
    'Lights', 'Tires', 'Brakes',
    'Valid Driver License & Med Card in possession',
    'Corrective lenses or hearing aid if needed',
    'Checking oil/fluids daily', 'Horn', 'Air or oil (fluid) leaks — including windshield',
    'Belts and hoses', 'Battery cover and fuel caps secured',
    'Annual DOT inspection current', 'Load securement', 'Fire extinguisher',
    'In-cab paperwork — Registration/Insurance/UCR/Hazmat, etc.',
    'Warning triangles', 'Leaf spring/air bags and frame bolts',
    'Lift gate operation (if applicable)', 'Air brake system and operation (if applicable)',
  ]},
  { name: 'Dash Cameras', items: [
    'How the dash camera works', 'Tampering — consequences',
    'Samsara / Elite Extra', 'Trained & understands Samsara DVIR/App',
    'Trained & understands Samsara ELD (if applicable)', 'Trained & understands Elite Extra (if applicable)',
  ]},
  { name: 'Driver Qualification (compliance review)', items: [
    'DQ file 100% compliant', 'Road test completed', 'Medical card obtained',
    'Drug & alcohol query ran (CDL drivers)', 'All LMS modules completed',
  ]},
  { name: 'PACE Training', items: [
    'Driver evaluation completed', 'Uses PACE principles while operating vehicle',
    'No hand-held mobile devices while operating any company vehicle',
    'Fatigued driving discussed', '3 types of distractions (mental — manual — visual) discussed',
  ]},
  { name: 'Operating Vehicle on the Road', items: [
    'Following distance', 'Safe speed — follow speed limits', 'Lane changes',
    'Following truck routes', 'Lane restrictions', 'Driver alert', 'Driver safety bonus',
    'Seat belt usage (proper usage)', 'Fueling trucks — off-road fuel/diesel/gasoline',
  ]},
  { name: 'Operating Vehicle in a Parking Lot', items: [
    'Avoid backing — do a pull-through', 'Avoid blind-side backing',
    'If you must back — G.O.A.L.', 'If you must back — avoid distractions, radio down, window down',
    'Watch for low overhangs/wires/canopies/trees/garage doors',
    'Avoid traveling under any obstruction you don\'t have to go under',
    'Know the height of your vehicle', 'Go slow',
    'Keep safe distance from buildings/vehicles/objects', 'Watch for vehicle swing-out/tail swing',
  ]},
  { name: 'Roadside Inspections', items: [
    'CSA program — how it works', 'Turn in inspection report to your supervisor',
    'Weigh station / port of entry — do I have to stop / what to expect?',
  ]},
  { name: 'Incident / Crash Procedures', items: [
    'Contact authorities if in a vehicle incident on the road', 'Securing crash scene area',
    'Contact/report all vehicle incidents to supervisor at first available opportunity',
    'Crash scene photos',
  ]},
  { name: 'Hours of Service', items: [
    'Understands HOS regulations and how they apply',
    'Understands HOS ELD exemptions and how they apply',
  ]},
];

const CHECKOFF_TOTAL = CHECKOFF_GROUPS.reduce((n, g) => n + g.items.length, 0);

function coItem(tr, item) {
  return (tr.checkoffs && tr.checkoffs[item]) || { date: '', driver: '', trainer: '' };
}

function ensureCheckoffs(tr) {
  if (!tr.checkoffs) tr.checkoffs = {};
  for (const g of CHECKOFF_GROUPS) {
    for (const item of g.items) {
      if (!tr.checkoffs[item]) tr.checkoffs[item] = { date: '', driver: '', trainer: '' };
    }
  }
  return tr;
}

function coCount(tr) {
  return Object.values(tr.checkoffs || {}).filter((s) => s && s.date).length;
}

let trainees = [];
let view = 'trainees';
let current = null;
let coOpen = {};
let _writeQueue = Promise.resolve();

const $ = (s) => document.getElementById(s);
const el = (tag, attrs = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n[k] = v;
    else if (v !== undefined && v !== null) n.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    n.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  }
  return n;
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    t.onsuccess = () => res(t.result);
    t.onerror = () => rej(t.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction('kv', 'readwrite').objectStore('kv').put(val, key);
    t.onsuccess = () => res();
    t.onerror = () => rej(t.error);
  });
}

function toast(msg) {
  let t = $('toast');
  if (!t) { t = el('div', { id: 'toast', class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

function initStorage() {
  return idbOpen().then(async () => {
    let data = await idbGet(KEY);
    if (!data) {
      const legacy = localStorage.getItem('trainingTrack') || localStorage.getItem('usaf_training');
      if (legacy) { try { data = JSON.parse(legacy); } catch (e) { data = null; } }
    }
    trainees = data && Array.isArray(data) ? data : [];
    await idbSet(KEY, trainees);
  });
}

function persist() {
  _writeQueue = _writeQueue.then(() => idbSet(KEY, trainees));
  try { localStorage.setItem('trainingTrack', JSON.stringify(trainees)); } catch (e) {}
}

function newTrainee(name, hireDate, trainer) {
  const topics = {};
  for (const t of TOPICS) topics[t] = { date: '', trainer: '' };
  const milestones = {};
  for (const m of MILESTONES) milestones[m] = { date: '', notes: '' };
  return ensureCheckoffs({ id: uid(), name, hireDate, trainer, topics, milestones, notes: '' });
}

function progressOf(tr) {
  const dTopics = Object.values(tr.topics).filter((t) => t.date).length;
  const dMiles = Object.values(tr.milestones).filter((m) => m.date).length;
  const total = TOPICS.length + MILESTONES.length;
  return { done: dTopics + dMiles, total, pct: Math.round(((dTopics + dMiles) / total) * 100) };
}

function statusOf(tr) {
  if (tr.milestones['Released / sign-off'].date) return 'released';
  if (tr.milestones['Ready for release'].date) return 'ready';
  return 'in-training';
}

function switchView(v) {
  view = v;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  const btns = document.querySelectorAll('.nav-btn');
  if (v === 'trainees') btns[0].classList.add('active');
  else btns[1].classList.add('active');
  render();
}

function render() {
  renderNav();
  if (view === 'trainees') renderTrainees();
  else renderPrint();
}

function renderNav() {
  const btns = document.querySelectorAll('.nav-btn');
  btns.forEach((b) => b.classList.remove('active'));
  if (view === 'trainees') btns[0].classList.add('active');
  else btns[1].classList.add('active');
}

function renderTrainees() {
  const main = $('app');
  main.innerHTML = '';
  if (!trainees.length) {
    main.append(
      el('div', { class: 'empty' }, [
        el('div', { class: 'big' }, ['🎓']),
        el('div', { class: 'title' }, ['No trainees yet']),
        el('div', {}, ['Add a new-hire and start signing off the curriculum.']),
        el('button', { class: 'btn primary', style: 'margin-top:16px', onclick: () => addTrainee() }, ['+ Add Trainee']),
      ])
    );
    return;
  }
  const sorted = [...trainees].sort((a, b) => {
    const order = { 'in-training': 0, 'ready': 1, 'released': 2 };
    return (order[statusOf(a)] - order[statusOf(b)]) || a.name.localeCompare(b.name);
  });
  const list = el('div', {}, sorted.map((tr) => {
    const st = statusOf(tr);
    const p = progressOf(tr);
    return el('div', { class: 'card row', onclick: () => openTrainee(tr.id) }, [
      el('div', {}, [
        el('div', { class: 'title' }, [tr.name]),
        el('div', { class: 'sub' }, [`Hired ${tr.hireDate || '—'}${tr.trainer ? ' · Trainer: ' + tr.trainer : ''}`]),
        el('div', { class: 'trainee-progress' }, [
          el('div', { class: 'track' }, [el('div', { class: 'fill', style: `width:${p.pct}%` })]),
          el('div', { class: 'pct' }, [`${p.pct}%`]),
        ]),
      ]),
      el('span', { class: `badge ${st}` }, [st.replace('-', ' ')]),
    ]);
  }));
  main.append(
    el('button', { class: 'btn primary full', onclick: () => addTrainee() }, ['+ Add Trainee']),
    el('div', { style: 'height:12px' }),
    list
  );
}

function addTrainee() {
  const main = $('app');
  main.innerHTML = '';
  main.append(
    el('div', { class: 'card' }, [
      el('h2', {}, ['New Trainee']),
      el('div', { class: 'field' }, [
        el('label', {}, ['Trainee name']),
        el('input', { id: 'newName', placeholder: 'Full name', autocomplete: 'off' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, ['Hire date']),
        el('input', { id: 'newHire', type: 'date' }),
      ]),
      el('div', { class: 'field' }, [
        el('label', {}, ['Trainer']),
        el('input', { id: 'newTrainer', placeholder: 'Your name', autocomplete: 'off' }),
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn primary', onclick: () => saveNewTrainee() }, ['Add Trainee']),
        el('button', { class: 'btn', onclick: () => renderTrainees() }, ['Cancel']),
      ]),
    ])
  );
  $('newName').focus();
}

function saveNewTrainee() {
  const name = $('newName').value.trim();
  if (!name) { toast('Enter a name'); return; }
  trainees.push(newTrainee(name, $('newHire').value, $('newTrainer').value.trim()));
  persist();
  openTrainee(trainees[trainees.length - 1].id);
}

function openTrainee(id) {
  current = trainees.find((t) => t.id === id);
  coOpen = {};
  if (CHECKOFF_GROUPS.length) coOpen[CHECKOFF_GROUPS[0].name] = true;
  renderTraineeDetail();
}

function renderTraineeDetail() {
  const tr = current;
  const main = $('app');
  main.innerHTML = '';
  const p = progressOf(tr);
  const st = statusOf(tr);
  const header = el('div', { class: 'card' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'no-top' }, [tr.name]),
      el('span', { class: `badge ${st}` }, [st.replace('-', ' ')]),
    ]),
    el('div', { class: 'sub', style: 'color:var(--muted);font-size:12px' }, [`Hired ${tr.hireDate || '—'} · Trainer: ${tr.trainer || '—'}`]),
    el('div', { class: 'trainee-progress' }, [
      el('div', { class: 'track' }, [el('div', { class: 'fill', style: `width:${p.pct}%` })]),
      el('div', { class: 'pct' }, [`${p.pct}%`]),
    ]),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn ghost small danger', onclick: () => deleteTrainee() }, ['Delete Trainee']),
      el('button', { class: 'btn small', onclick: () => renderTrainees() }, ['← Back']),
    ]),
  ]);

  const topicsCard = el('div', { class: 'card' }, [
    el('h2', {}, [`Curriculum (${Object.values(tr.topics).filter((t) => t.date).length}/${TOPICS.length})`]),
    ...TOPICS.map((t) => {
      const s = tr.topics[t];
      const done = !!s.date;
      return el('div', { class: 'topic-row' }, [
        el('div', { class: 'check ' + (done ? 'done' : ''), onclick: () => toggleTopic(t) }, [done ? '✓' : '']),
        el('div', {}, [
          el('div', { class: 'topic-name' }, [t]),
          el('div', { class: 'topic-meta' }, done ? `Signed off ${s.date}${s.trainer ? ' · ' + s.trainer : ''}` : 'Not yet'),
        ]),
      ]);
    }),
  ]);

  const milesCard = el('div', { class: 'card' }, [
    el('h2', {}, [`Ride-Alongs & Milestones (${Object.values(tr.milestones).filter((m) => m.date).length}/${MILESTONES.length})`]),
    ...MILESTONES.map((m) => {
      const s = tr.milestones[m];
      const done = !!s.date;
      return el('div', { class: 'mile-row' }, [
        el('div', { class: 'check ' + (done ? 'done' : ''), onclick: () => toggleMilestone(m) }, [done ? '✓' : '']),
        el('div', {}, [
          el('div', { class: 'mile-name' }, [m]),
          el('div', { class: 'mile-meta' }, done ? (s.notes ? `${s.date} · ${s.notes}` : s.date) : 'Not yet'),
        ]),
      ]);
    }),
  ]);

  const notesCard = el('div', { class: 'card' }, [
    el('h2', {}, ['Trainer Notes']),
    el('textarea', { id: 'traineeNotes', placeholder: 'Observations, areas to work on, follow-ups…' }, [tr.notes || '']),
    el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn primary', onclick: () => saveNotes() }, ['Save Notes']),
    ]),
  ]);

  main.append(header, topicsCard, renderCheckoffCard(ensureCheckoffs(tr)), milesCard, notesCard);
}

function renderCheckoffCard(tr) {
  const done = coCount(tr);
  return el('div', { class: 'card' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'co-sum' }, [`Driver/Trainer Check-Off (${done}/${CHECKOFF_TOTAL})`]),
    ]),
    el('div', { class: 'sub', style: 'color:var(--muted);font-size:12px' }, ['Sign off each item with driver initials, trainer initials, and the date.']),
    ...CHECKOFF_GROUPS.map((g) => checkoffGroup(tr, g)),
  ]);
}

function checkoffGroup(tr, g) {
  const open = !!coOpen[g.name];
  const done = g.items.filter((it) => coItem(tr, it).date).length;
  return el('div', { class: 'co-group' }, [
    el('button', { class: 'co-head' + (open ? ' open' : ''), onclick: () => toggleCoGroup(g.name) }, [
      el('span', { class: 'co-title' }, [g.name]),
      el('span', { class: 'co-count' }, [`${done}/${g.items.length}`]),
      el('span', { class: 'co-chevron' }, ['▾']),
    ]),
    ...(open ? [coTable(tr, g)] : []),
  ]);
}

function toggleCoGroup(name) {
  if (coOpen[name]) delete coOpen[name];
  else coOpen[name] = true;
  renderTraineeDetail();
}

function coTable(tr, g) {
  const wrap = el('div', { class: 'co-table' });
  wrap.append(el('div', { class: 'co-row co-th' }, [
    el('div', { class: 'co-item' }, ['Item']),
    el('div', { class: 'co-drv' }, ['Driver']),
    el('div', { class: 'co-tr' }, ['Trainer']),
    el('div', { class: 'co-date' }, ['Date']),
  ]));
  for (const item of g.items) {
    const s = coItem(tr, item);
    const complete = !!(s.date && s.driver && s.trainer);
    wrap.append(el('div', { class: 'co-row' + (complete ? ' done' : '') }, [
      el('div', { class: 'co-item' }, [item]),
      el('div', { class: 'co-drv' }, [el('input', { type: 'text', class: 'co-input', maxlength: '3', placeholder: '·', value: s.driver, oninput: (e) => { s.driver = e.target.value; persist(); refreshCo(e.target); } })]),
      el('div', { class: 'co-tr' }, [el('input', { type: 'text', class: 'co-input', maxlength: '3', placeholder: '·', value: s.trainer, oninput: (e) => { s.trainer = e.target.value; persist(); refreshCo(e.target); } })]),
      el('div', { class: 'co-date' }, [el('input', { type: 'date', class: 'co-input', value: s.date, onchange: (e) => { s.date = e.target.value; persist(); refreshCo(e.target); } })]),
    ]));
  }
  const pending = g.items.filter((it) => !coItem(tr, it).date);
  wrap.append(el('div', { class: 'co-actions' }, [
    el('button', { class: 'btn ghost small', onclick: () => completeCoGroup(tr, g) }, ['Mark group complete' + (pending.length ? ` (${pending.length})` : '')]),
  ]));
  return wrap;
}

function refreshCo(input) {
  const row = input.closest ? input.closest('.co-row') : null;
  if (row) {
    const vals = row.querySelectorAll('.co-input');
    const complete = vals.length === 3 && Array.from(vals).every((v) => v.value && v.value.trim());
    row.classList.toggle('done', complete);
  }
  const group = input.closest ? input.closest('.co-group') : null;
  if (group) {
    const count = group.querySelector('.co-count');
    if (count) {
      const rows = group.querySelectorAll('.co-row:not(.co-th)');
      let done = 0;
      rows.forEach((r) => { if (r.classList.contains('done')) done++; });
      count.textContent = `${done}/${rows.length}`;
    }
  }
  const sum = document.querySelector('.co-sum');
  if (sum) {
    const rows = document.querySelectorAll('.co-row:not(.co-th)');
    let done = 0;
    rows.forEach((r) => { if (r.classList.contains('done')) done++; });
    sum.textContent = `Driver/Trainer Check-Off (${done}/${rows.length})`;
  }
}

function completeCoGroup(tr, g) {
  const pending = g.items.filter((it) => !coItem(tr, it).date);
  if (!pending.length) { toast('This group is already signed off.'); return; }
  let initials = (tr.coInitials || '').toUpperCase();
  if (!initials) {
    const v = prompt('Trainer initials for this group?', '');
    if (v === null) return;
    initials = v.trim().toUpperCase();
    if (!initials) return;
    tr.coInitials = initials;
  }
  for (const it of pending) {
    const s = tr.checkoffs[it];
    s.date = todayISO();
    s.trainer = initials;
    if (!s.driver) s.driver = initials;
  }
  persist();
  renderTraineeDetail();
  toast(`${pending.length} item(s) signed off for ${g.name}.`);
}

function toggleTopic(t) {
  const s = current.topics[t];
  if (s.date) { s.date = ''; s.trainer = ''; }
  else { s.date = todayISO(); s.trainer = current.trainer || ''; }
  persist();
  renderTraineeDetail();
}

function toggleMilestone(m) {
  const s = current.milestones[m];
  if (s.date) { s.date = ''; s.notes = ''; }
  else {
    s.date = todayISO();
    const note = prompt(`Notes for "${m}"?`, '');
    s.notes = note ? note.trim() : '';
  }
  persist();
  renderTraineeDetail();
}

function saveNotes() {
  current.notes = $('traineeNotes').value;
  persist();
  toast('Notes saved');
}

function deleteTrainee() {
  if (!confirm(`Delete ${current.name} and their training record?`)) return;
  trainees = trainees.filter((t) => t.id !== current.id);
  current = null;
  persist();
  renderTrainees();
}

function exportAll() {
  const data = JSON.stringify({ app: 'usaf-training', exported: todayISO(), trainees }, null, 2);
  const a = el('a', { href: 'data:text/json;charset=utf-8,' + encodeURIComponent(data), download: 'training-tracker-backup.json' });
  document.body.append(a);
  a.click();
  a.remove();
  toast('Backup downloaded');
}

function renderPrint() {
  const main = $('app');
  main.innerHTML = '';
  if (!trainees.length) {
    main.append(el('div', { class: 'empty' }, [el('div', { class: 'title' }, ['No trainees to print'])]));
    return;
  }
  main.append(
    el('button', { class: 'btn primary full', onclick: () => openPrint() }, ['🖨️ Print / Save PDF']),
    el('div', { style: 'height:12px' }),
    trainees.map((tr) => {
      const st = statusOf(tr);
      const p = progressOf(tr);
      return el('div', { class: 'card row', onclick: () => openTrainee(tr.id) }, [
        el('div', {}, [
          el('div', { class: 'title' }, [tr.name]),
          el('div', { class: 'sub' }, [`${p.pct}% complete · ${st}`]),
        ]),
        el('span', { class: `badge ${st}` }, [st.replace('-', ' ')]),
      ]);
    })
  );
}

function openPrint() {
  const w = window.open('', '_blank', 'width=820,height=900');
  w.document.write(printHtml());
  w.document.close();
  w.print();
}

function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function printHtml() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const rows = trainees.map((tr) => {
    const p = progressOf(tr);
    const st = statusOf(tr);
    const topicsDone = Object.values(tr.topics).filter((t) => t.date).length;
    const milesDone = Object.values(tr.milestones).filter((m) => m.date).length;
    return `<tr>
      <td>${esc(tr.name)}</td>
      <td>${esc(tr.hireDate || '—')}</td>
      <td>${esc(tr.trainer || '—')}</td>
      <td>${topicsDone}/${TOPICS.length}</td>
      <td>${milesDone}/${MILESTONES.length}</td>
      <td>${p.pct}%</td>
      <td style="text-transform:capitalize;color:${st === 'released' ? '#15803d' : st === 'ready' ? '#b45309' : '#7c3aed'};font-weight:700">${st.replace('-', ' ')}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Training Record</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0; font-size: 20px; }
    .sub { color: #555; font-size: 12px; margin: 4px 0 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
    th { background: #eee; }
    h2 { font-size: 14px; margin: 22px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    h3 { font-size: 13px; margin: 10px 0 4px; }
    h4 { font-size: 12.5px; margin: 12px 0 4px; color: #333; }
    ul { margin: 0 0 10px; }
    li { font-size: 12px; margin-bottom: 2px; }
    .foot { margin-top: 30px; display: flex; gap: 60px; }
    .sig { width: 230px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
  </style></head><body>
    <h1>Driver Training Record</h1>
    <div class="sub">Generated ${today} · U.S. AutoForce · New-Hire Onboarding</div>
    <h2>All Trainees</h2>
    <table>
      <tr><th>Trainee</th><th>Hired</th><th>Trainer</th><th>Curriculum</th><th>Milestones</th><th>Progress</th><th>Status</th></tr>
      ${rows}
    </table>
    <h2>Curriculum &amp; Milestones</h2>
    <h3>Training Topics (${TOPICS.length})</h3>
    <ul>${TOPICS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Ride-Along Milestones (${MILESTONES.length})</h3>
    <ul>${MILESTONES.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    <h2>Driver/Trainer Check-Off</h2>
    ${trainees.map(checkoffPrintBlock).join('')}
    <div class="foot">
      <div class="sig">Trainer Signature</div>
      <div class="sig">Trainee Signature</div>
      <div class="sig">Operations Leader Signature</div>
      <div class="sig">DOT Compliance Signature</div>
      <div class="sig">Date</div>
    </div>
  </body></html>`;
}

function checkoffPrintBlock(tr) {
  ensureCheckoffs(tr);
  const done = coCount(tr);
  const groups = CHECKOFF_GROUPS.map((g) => {
    const gdone = g.items.filter((it) => coItem(tr, it).date).length;
    return `<h4>${esc(g.name)} (${gdone}/${g.items.length})</h4>
      <table><tr><th>Item</th><th>Driver Initials</th><th>Trainer Initials</th><th>Date</th></tr>
      ${g.items.map((it) => {
        const s = coItem(tr, it);
        return `<tr><td>${esc(it)}</td><td>${esc(s.driver)}</td><td>${esc(s.trainer)}</td><td>${esc(s.date)}</td></tr>`;
      }).join('')}
      </table>`;
  }).join('');
  return `<h3>${esc(tr.name)} — ${done}/${CHECKOFF_TOTAL} signed</h3>${groups}`;
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

initStorage().then(() => { render(); registerSW(); }).catch((e) => console.error(e));
