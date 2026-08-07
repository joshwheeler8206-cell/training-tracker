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
  { name: 'PACE Training', items: [
    'Driver evaluation completed', 'Uses PACE principles while operating vehicle',
  ]},
  { name: 'Distracted Driving', items: [
    'No use of any hand-held mobile devices while operating any company vehicle',
    'Fatigued driving discussed',
    '3 types of distractions (mental — manual — visual) discussed',
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
  { name: 'Dash Camera', items: [
    'How the dash camera works', 'Tampering — consequences',
  ]},
  { name: 'Samsara', items: [
    'Samsara / Elite Extra', 'Trained & understands Samsara DVIR/App',
    'Trained & understands Samsara ELD (if applicable)', 'Trained & understands Elite Extra (if applicable)',
  ]},
  { name: 'Driver Qualification (compliance review)', items: [
    'DQ file 100% compliant', 'Road test completed', 'Medical card obtained',
    'Drug & alcohol query ran (CDL drivers)', 'All LMS modules completed',
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

const AF_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAHdElNRQfqCAYXOA/wWZLGAAAcJklEQVR42tV9ebBdR3nn93X3OXd/m56kp6fFTxLSkxfZllfZQMEYSGycZJhKKoEBAsQsQXYFMhOSMBOYqpDKlBNCyllMAS5CAgQTYsczmbg8zgAJMba8YCNZtmxZ+25Jb7vr2fr75o8+613eu0+LpRzderr33D59un/9/b6t+/RFZoaOw5xDBCI2bxDR9Xnv6/rFQ/6eE8HRKT3bIC/gQHN0AQNAVBsDAyCH54CB0RQwVTNweI9UefMPgMPLoxqzFaY+RpWkLjTlEYA5ql9JtBUOl+WqpblNa0rXvqm8YVUxZwlmJgYEEAKZGQARO5EA7ASIGRDBXC8QEPHgaf3PO93n9vlHp7XrMwAoAVIAQqaTPdCBbOvnQSfd+e7oMACm0DEfuTc6YbOYteZAEzPnLLF6We7mywfvuHnJ2hXFdDeZuROkdoBMIWJmBinw6LT+5o+cJ17x6g7lLbQVCDS3jKTlvMlORjQYMK65FzpRe+dDB1LChcjAQMyer1selfPybdcO3/XulauXFTRxLEptGGUACtEhRgRi+N529zs/dmotKuVRIhAxczy+55dZi5adBZmVhTtpKoDBArTmWjMYKKoP3T7+vneOCwTmLhglAJkvNLEUeKZKX/yn5lN7vEoelQBNqc5k0JmHWecoO+fKrC7omPKYjKcUEARcbfhvuXr4v39w/dKhnOl+GiOMiJKgc/C0/tzfNY5N68ECaEqPVv+yc3Z6h6P2tDOrTSunPmZvl71pV3SyIAIAKAEzNX/1svwfb7t83XixDSM0CsUYLCHw4Gn929+uzzapZEOgIdOZC8usRCCS+mNSxHqk3SxAuoa0KeRYRcZ3iWWnbfCYlcRGKxiqqD//9FXrxktpjGKNwwLxTI3+yzfrJ2d10QY9HzoXglkpTDDUFMbkG4NAxMxMxMRAxGQQ4GSQEACBEQERJAIiCAQjA5AyKonsZBWZFNhoBeNLcvf/1tXLhnMGEGZAIoqF7bPfaTyzzx8snLXsnA2zOBSN5I7ETMSaWGvSxFqzphAgznQ2w6m4nQZZA5AUoCQqAUqiFMZ9CQ0/dqh5JWG25m+9avi+T22OMUFmNhL17Secr32/OVzCN45ZES6Rn8KBpkBzoI2kZEp2VTHtxj4eIubUHwYGgaAk2AptSyiJoa+SqZCZQUmcmnPv+aV1v3bnZQYW1EQC8dBp/RvfqBm69dbK58Ss6DRjhIomDjR7AfsBac1E4QXYBY62zqRaMr/Nigcmkj8BoBTmLZGzUSIQAzNj1F8EIGaJ8MBnr1s7XiJiYer/zpNOrUVSzG+z5vGV50PH0AKBBQAiaM0tl+YaeqauZxu66Wg/YGZDChYZpcvniE6alYggEAHA86na8Kerfr2lmdh4QLFuVwLnGsE3Hj1kqlBS4IFT+olXvFIee/s758QsBEBkTez57PrkB6yJI7UaejCJkHVY9LOXnWz74+YJAEYgTbUmtRwo5kXBlvGdNHGlIP/1+TP7jtXXrywLAPh/L7p1hyTOw6yzRAeRAcAPqNqkmZquNrXrMzELBBHVe+HQ4W7oJB0EEMiauNoIZmpeoAlDZ5OlwGrDe+ypkwAgXJ+f2efnFBKdJ2YxRIqGHY9n63q2rlsuETMioLmmo/XnFx3ujU5arxnPUSB4Pk1X/aajEREBNHHelk/unHI9rV45Fhyb0rZKeHiOzEJkZmi51PLIDyIqYab1cCHR6cWsTnQSzwABmKsNPwh0paiAwbbw8OvNXfur6sUjgRdwKYea22pfDLOYI3Fix+OmS35ACCb07+xMb3QAzh2dPmWHs/UDgEBoOjrQNFSypMSmE/x0z4zaezLAzKguKDvQiY7RtZ5PDYe8gENourlzC6BzzjZrsbITV2gYYOg2U/dGKjYivHq4qo7P6NC6L55Z5pxACDQ3HO14DBDaac52ZmFmnTM6Z8GsNnTMBzQY1dxiXh4/3VKzdZLibJjFJnREaLrUcDRRqGh6xFkXHJ2zZFa3BgsE19PMPFvzlBcwQqb2fpjFAAI4IK63yPUIsSc6/y6YlWmw6R2i6+kzs646u6y7QHY8rjW1iU563uzfCbPa0DHtEQhzdV/1gQ4gIIT4sMlFNFrUcAmBhUjKI4dxVHi5uRqjv+H5KEcXG35Ml08c6zAqNKaxBzqJI56qP6wy0wAIe8BhLiUOgbqik6qf1TzoMIQur69Z67AYERuHWCScMtV11Tjdbtw2yKnLOx0xBhAItkLzSQggAkBABN8nTZnaMBG9trYltZk/UoClkAmIe6JjSqr50fECdj0eqYhyTgACEdea2lZSJNm56MIEnA4d1L25qZHsSSUA4JarT057UoAS0HKCfE4QgevT8mGrnJfpXmlNzCwlRlLYjVMAwFxr+q9POzlL5G2pmbAHOgys5kGn5dLyIfWR2yrXrc+X82hElRm6TrCd68E9T7dcvetA40+/d+hMTd/2M5c9+dPTHPj/9VcmbpwcKBVkav4Bj5ycdr1gYnyJpSSFmbPu96k1g+27pr70t3sOnWyU8lJnZDmtyBjf/Qcnu6LjeDyxTN37q6NLKpLTN7sQ6MwPHQMiztb87Qf16GjebfiblvKSQZuj1JIZX0Q8nAIo/rbrQQwCcbrqfvj3n9m1f66Yk0Sdaj6kWAad0JgzIMC2OwaXVKTrkxRvPCyZQxMPVdSaZerwNL15rarkwfNJtLUKwWRmKcrPzgc6gKdpZCD3Pz565fs+91RqKiWDDjCLTouOCI5HkyutaydsPyB1sdEBM89HPDHEE8NcsDgIuNuYZTjF81aIAJZEP9DXbxq5fnK40QoEdkEHAESnN4gAgeaVI9JMM3JoYy7mCwCIIG/BWEkTs5n9aX9FkGSS+/O+zHzFxHgpTAZ1oAPAqos3yMDMMoypYH5ZfSMPTSBl4sZ0HpEpimBdqOWm55ZE7iY75j6q01eOEm4c4XPRGRYeGC1oiL36tm/Tje5nWBOvOcSgiwuiItcgFUkgALCm6Cq8VCQI2MwBdsUHUvOvibu9EEDc/q7dQWOVGZEwRgc/4IZD8a0ukSOFQLdv0yHJYpoded5dk5mg2qJQM7tfa2qKw5U3kmK4UMeMTkTsUgzj/kaTYAuZ34SGWac/HZ2otihBIDQc8oM47/XGUmzeWyHHA8bzXJsSoIWUdFsmoD30YWCIo3kwrqfrU9MlTC0TuXSUdLxyqKsCRoyNV99KOg0sd0EHomg+HBcirrUoNgUpu3nxj9DJZ+6MITjMeUQcg9ANWjBm7NQ+beiwCTUMFojQaOlAsyVTMnopSRCnUudd4MskS/pxg5JruY1uqYyCCmNWANenlscCEwsHiUd6aRyIHEbT3R2hROb7a3bW2e6CDgAkFKu3KIqLw2tDml1sWKLeQKgnGLvaDUxl/rgfLwhSxIqRyqJjdBAgcsMlX0eRa+RPIDLCJUOwMO+bih27YhiJwWKUdCpC6ZiDUYgcaG66lIRhCBK57ondp616UwtxqUBEDAN2sNJizdAWuGMmFoiU9MIIxcKWCniztl8BQNMlCpfJhFgisKfxTBMbLSnExQYGAIx/T2ihBiQmhA5Dlhr/lKJeAJ+IV91kxwCovIAdjxPHB9iMVU7SijLVpJYXJMN6NgcxlFS4prIbhTBWsgz9KWlISRB3QQcAVMPRybRJmDwDYihaet2wX7UvIYohQsulgARibxWUUGzh7HBkiFI5jI45HuUHnExRpUISZgg0+ATyYuOSPjSDYuZuXY9PRc7fwhzj5AJO2bLMLIYC6EAnUVgpwbvYB5uMjwlVuzUp0cmLVdKJP9OOTmjm2+0/hu85tPiXCsWSYe4xoZMa2b6VNGcFoGNSTwF08Y7irNyl5UmbByd65sIwJfl9K+mYkUlXM5O9qhs6ALHAXSoMA4jX8fWINABTBqzvlGtKgrrPj2fyQZEVC7kVitElY+YjlcgI2AsfSOncPgBKVjG0y07kH6kO2UlPonHM54t+xOnO1ANlHQUyFqnPIIkTpqSYFVt/1a6WYiWdJEsuDQmKNHQXJR2dSTRoPE0zf5WJH5RSvinfGuLVHdkZkKSC/pU0M3O0lgQREcV5pyYyUi/tkk54EWvW4SKk6OiFOWeAb0cHmFWq9hQPYzXXR8KMiAA4l8vl7JxUghmCQLuu43m+EALPI06YWiDe+SUCEZEmpVSxWBBCAIDW2nFcz/OEQMT2qDLtSUdd71wflJ09i8TVRGTzTzAhMGuiSrkkhDh8+Ohre/eePHlKKblq1cqNGzaMjS1rtlqO4yop+1OasMC0BqNplcC2hAcCsA6oUCggijNTU/ue2X/8+ElEXLlyxcYNG8ZXjrmO22w6UklIJCIdlcRuXwYdgFCCMjqcGQTCbENrPd+8mKl7aGjw6e3P3v/lr/74yaempqa15wGilcuPj4+9+46f/eSvf+yyy9bMzc1J2WfE0hMdZkABR0+1JlYU20SBgYloaHDwiaee/dpXH9i+ffupU2e05wKgyuXGli9757tuu/uTH5+c3DA7W5VSpG+mNU9XXcQUwyCjcOSKG7e12X8GEAjVhn7HlnIpL3zN2KGnDdjlcumLf3Lf3Xd/6qUXd2nmXC6XLxbsXF5KOTc39/S/PfnQ//rHdevWXn315mazhUKcdXbSBBgI8MVvv7b1qpFCTgapVhHR4ODAV7729W2fvOfFn+7wAx22JJ9XSlbr9Z9sf+Z7Dz2yfGzshhuvb7ZahmtErJSYrXn3P/iyHxBGvEmhwwAgx27a1uYdAbASMFMPHJffeV1Fa/A1E0P6pQM9ODjw+1/4n3/0hT/MlyuFYrGtP0qpQrlcr9cffuiRjRs3XnPN5nq9CSiiGsJnCvt8CYGjg7kH//nIVx7eXyqo225Y6vkUaCJgPwiGh4f+7M/u/2+f+V2rUCiUSmmtx8xKiEK57LruIw8/Mja+YuvNN9XqDQBUlhgq21/6650/fuFksaDMJhxt6AAzbrn7xTZ04lUwLUf/x1sHP/IzS5YOKgzHCwFAkx4cGPzWg4985FfvqgwPMTMRCSGIyPc9RGHZNgAwkVTSc71iofD44/945aZ1rZaTSp70q7yZodb0//4Hx77y8H4hwPPo/Xes+dCdEyMDNjENVCr/9NgPf/EX31ssFgHRtISZPc9DAMu2EZGIpJRBEDDRo48+cuvNW+qN5vSc98BDu//20b2FnGx7EiM9PYJbtr3YiU4IHkK9qcdG1LXrCyMVhYm1QyX5G/f+2uGD+3KFAmkthHAdx7LtFeMrfd8/cfyYEMKyLCJSStXmZt7yzv/07g98vlGfEwnREtuRZn/mWwYArjaCnXvn9h6plfJh8q7W8NeMFbdsHBqsqHzOfvDLn9mze0ehWNKmJa6rpBxbuYqJThw/xsy2bRORVKpRq2658a2/8MHPHTsx/cIrU0dONipFNQ86AIxbtu3sio45Yx7ucDyKl8syaWmXq4d+NPvsH9j5MpEWQjiOs37D5C+//0NjK8aJ6NXdL333W39VnZuzLIuIBbKnrdE3/6FdGiXtp0CJfdY2ZzV7EiBnYd4W8cI6ieD6uuX4KPOtM7trL91n5/JGdlzXWbV64lc++OFVqycA+MC+1x785tdPn3rdtnNEJAR6ni5ffk++stJWOmdLHa9i6YaOCVZ7osPMmkFJGCiKpAixzCm3+bIUxACIwvf9pcuWf+Ke3xwYHGo2G4h44823FgqFv/jSvSaSY5CKa8XgYHlgDXk1AJHEMmlcIEpVZFtifLJ4oTYwawZLoV1Sws7D64daQps9AIIgGBgY+tg9n14+tqJRryPCVddsuav8qT+99ws68BEFs1CiVYJj5YENgVtbEB0In83pgU78f/zwuibSBIHvt6onAAQACIGe61x/09ahkZF6rWoU5OzszIbJK9ZvmHQdBxEBgUi3qieIIKqHtebAPBmvWRNpbd5TkP5IrDURUdsSVAAmAk2sA+3WXzfnjPhcveX6sbHx2twcIgLg3Ozsmom1l1+x2XEcY7yY2W2cNiuq50fHeJFifnTSWKZKEZMPqaCxXBkgIhQC4n2KEErlMhHFq6pZ+1GKvBezugoUdGterMKYKQCM1sYxlysDzIxCJEEGQ7lSYUqyEqyDrha9M1sGDGox6ITRKwop7QoDmeQnCnHowD4pJBt7BiCl9Fz3+NEjyrKidToo7UrS50Wgw93RicJWYZXMG2aWUh0+uN9UobU2o6V1cOTwQWWpsCUMwiqGtiaczOkiOzHfxSLRAQYCFLmhtdFpKhSKLzz3zDPbfzw8sqRQLBZLpVK58tj/eeT40SO2bZueoLTsgdVMQbzKpw90eD50oqDRqqwyAsvM+Xx+966dT/zLD4aGR4rFUrFYGhwc+v7jjx7Y+1oulw9rQ2GVxpnjyaNessORkl4MOiazwIFbGrtuyioBh/t+IMDfPPDl/a+9un7jZBAEO37y3PPPPZ0vFMygkfbsyqrc8HoOnGgl5jkwKzbAgKS9/PCkyA2ydo2KkUp995tfP3xw/+TlVzLzrp0/ffapJ+xcLryYApUfsQfWsnaTFNu8/cVrP/H8YtAxoJOwSie3f3HuwP+VuSGmwGwA1mo1hZDMhID5QiEUY6G0O7tsy7bBdbdrrxZv13H2zEo3j0mo4vSr360efEzmBk1LAKDVbKII95soFIpJS7zq4NqfH7jsdvLrUQ6pO7PS+aBFoJPkb7W7ZPMHmqd3Bc1TwiqZlpXLldRqUQYAFJZ2Z0rjWwcuu0179fOMDgAAkHYG197hTL/i148Iq8ykEaFYLoffIzIRAKBQ5NfyQxsrK9/GQbMTHeiGDnNoxfpFJzqJpD1VGB2/9bOqMKLdOUQBKMJNziLtCQDamS4svWbZdduYKbY75w0do3QpELIwuvmjqjimPeNnCI5bQmzcEe1V7fJlI5s+AChjBbQwVwDk8us/3n/pOCmAiKxdq7isPH5z0DrjzR2mwAEmYGIOmHwKWijsoTfduXTLJ4SwQ7dgQXRgUehEOpF8ZVeKS7dor+43jnLgMDAAAWumgMkBFKWxW0Ym3ydUibXXpge5h+yEPb3m488tRnayrSeN0gaUrVM768e2u7P7yW8CoswN5Ec2lcdvzg2tI7/JrPtFhxeJTlwTaxQKULlze1und3jVQxQ0AVBYRbsyURi92q6sYe0xByn3rS9pwGs+9uxZoJOa8idgQJVHlBS0WHsAgDKH0mLtUeD0q3fOHp0EJGA2A8baY+0BMAoLhcUUkHa66p0FuaIsiV5AyaXzlm5HB8A8pUtBM9QIQgIza5eClvEP3yh0AEKd7QKbp1oFADP5pN2kJX0xK9GGtiVF3kYT6fS2WRE6bVo2U940CIDDhY6pDHnf6HRo8d7opGBMKoxACrfeMS3BTEt6tj+ld0JpYCLO56QYqSizUWdc2mwkF6qo9skl03mIbBVHxjSRljgRFp+MVmUkjYvjNYi2WUrfBZMUbzTUGNaD6aFK1R+2KOopZLeubb8FAiZPDrXJTtxx0JpGhwpq1dLc7sONnCXCOyD7PjFz5Gelx5DNZYiglIBwlhOIyPe1lJgiSEqSmYnIMouvo9pcz4umzdqUHQOADrRlSRNnmpv6XsDMQkSb2GUv1FoLRKVkbHpI68DXUooseaN3xExk2aoDnUSToEA/0KtXDKirJkqPPztlJNQ8jL5irHLTjauFyM5/hyMPWvPTTx84cXxWKWHQsXPytndsGhoqhpKYvoBBSvHq7mM7XjiolIjDyBtuetOGyXEdaIhhiv4IKaZOz/3bD3b6XmCicd8LVl+27Ja3XomifdKZARAgCPQT33/h5LEzypLMQJoKxfzbb79xcKhMmtrWezKwlPLFn7yy45mXLUtFgHdRLMy8eXKpumFyIGcLSrCnm25cOTk53Gxy5+I7Ii6VEEA/9PczlgJA8LzgyqtW3LR1ZaPOKADaMs3MUuLYeHnfaycbDUdKDHw9MFh8+zs2SaVId25PzEQ8efmS40dO73h+f6FgG2fvLbddsXHT8maDRMeSUiIqVYQO3O/9zQ+N3LVc7/pbJm952/raHAnZRl9gZmXh2PjAay8dcFpOWGEHOkSQt9Wbt6xSV68rTyzP7z3WyNvm+VXYt39m+fJBopD5qaoBADwP9+2dite8K4Unjs8dPdIsFOxuk8KslNz72qlm0zVPwAqJjbqz55VTE+uWZyUozOkIIc6crp84Pm0pEa+E3/PS8aXLRtvFIRIKx8E9u48JEVLaUvLIgVNHDtbzhVy4p3YWIMtSL+845LSccKvtDhstEFpOMLl25NorxpCZ/+jBg3/5D4eXDFiBZgDWAZXLtpKCO65EgMDXtbojox0FATgIdD5nFQoWt5vesEB1rsXMQgAzIDBpQsTKQCFjoRL9DY264zpeolOYg0APDBRlSsskmgXB94LaXENZwqg8RAj8IF/IFUu5MBXZZjeZ52aqACAQO/sIDEri6enGb9219ffufisy86tHGr/0+R3GRpip+Cgj2SU9jAhSxJssh+WJTKasu0WXMpW3jDqmNbWnY6JbCIFCYDZiAh3otLJIGRBGRGmGM6oQAUiTJt1WeWxAlBTRUHb175iIH/v6f758/ajSxJOrS++6YeQffvT6UEVpHTYxXtEWbVsXbaLCGSNlvhMIIt6mqWOQU+WT8wY1iMtnPbeOhHFSvlOIwpFMwc0AKFAJmYYmPWxdmWWqVxKnZp333nnF5etHtaZQD9/9njVDZRUEDEllHE3tp/7LosNRT+KvIdqTlilTvpuv3H5A+xUZwkYHQWf9WXSSwUiKhNsHQ3gh9UIHAXxfDw/kf/MjW8F4mUKg1rx+ZfGuO1fN1n3j33T6mt0Tt235lL4jia6+7EKRBEfE6jDJPTKnnbFBmzfYEVeylDhTde7+wA0bJka0JiFQROqTt71nzduvHZmueUriBUWHMxX2jQ5kOzMvOnwWcSWzUmJ6tvWuW9d++sM3Gz1jEmaIiMwgBN7765MTywv1VqBEpN4vADrzyQ73RmcxsgPd0eH50anV3bWrh+77/O1CIIfLSVCYmQ8hUBOPj+a/+tubRypWreVbEvl8owMLogPd0LnwzDLojA4XvvUn71m5vGLIZUx2ONXHzFKg1rxxdflbn9+yeml+uupZZq3AG8OsXuhcYGYhgFJiaqa5Znzg4ft/edO6Ua3JOA3Jpv8Q9QARtWYp8dSM+zv3v/z4s68PlSylMPJZ4AIyK92Zs2VWD3S6Ng+MRfd9PTPXuuPtb7rv9352+Wi5DZ0MQAlGxAKBGB743wf/8qH9s3VvoGhJCaSZ0vdbDLP6kR3uQL9/2YG+ZQfCHx7BQNNczRkeyH/6wzdte/8NQiAxS5FBpx2gGCMzPyElHjzRuO/v9j22/WS14Rdz0rbM6t7YAenqjL7RstOJfhadcMdQk1IkYscNmi1voGz/3H/Y+JmPbl27elhrQsSFf7omjREzE4EQgIh7jtQe+uGxf3n+1KETTccNTLQhhfnNILhU0Ylux2zWigRaM3PelmtXDd12y8R777xyct0SZjY/KNLvjx9Bqr+GbgDhjye1XL1r/9zTu6ZeOVg9cqo5Nec2moHr6ZQeXQyzEpXaxcZ1QactmluQWVHJnCVLRWt0uLB6ReWK9aO3Xrdq8+SyYt4y0ACCoVWvn8/6/6sd3wrcAUH4AAAAAElFTkSuQmCC';

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
    .print-brand { display: flex; align-items: center; gap: 12px; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #7c3aed; }
    .print-brand img { width: 44px; height: 44px; border-radius: 10px; }
    .pb-eyebrow { font-size: 10px; font-weight: bold; letter-spacing: 1.8px; text-transform: uppercase; color: #7c3aed; }
    .pb-eyebrow + h1 { margin: 1px 0 0; }
  </style></head><body>
    <div class="print-brand"><img src="${AF_LOGO}" alt="U.S. AutoForce"><div><div class="pb-eyebrow">U.S. AutoForce</div><h1>Driver Training Record</h1></div></div>
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
