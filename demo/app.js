const DB_NAME = 'usaf_training_db';
const DB_VER = 1;
const KEY = 'trainees';

const TOPICS = [
  'Pre-trip inspection', 'Vehicle walk-around / fluids',
  'Load securement', 'Invoices & paperwork',
  'Safe driving & following distance', 'Backing procedures', 'Mirror use & scanning',
  'Customer interactions', 'Tablet usage & photo uploads', 'Delivery accuracy',
  'GPS use at every stop', 'Route navigation',
  'C.O.D. handling & cash', 'Defensive driving', 'Hazmat awareness',
  'Post-trip inspection',
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
  { name: 'Driver Qualification (compliance review)', initialsLabel: 'DOT Compliance Support', items: [
    'DQ file 100% compliant', 'Road test completed', 'Medical card obtained',
    'Drug & alcohol query ran (CDL drivers)', 'All LMS modules completed',
  ]},
];

const CHECKOFF_TOTAL = CHECKOFF_GROUPS.reduce((n, g) => n + g.items.length, 0);

// Most groups are initialled by the trainer. The compliance review is signed off
// by DOT Compliance Support instead, so its column and prompts say so.
function coInitialsLabel(g) {
  return (g && g.initialsLabel) || 'Trainer';
}

// The header row spells out which side the initials belong on ("Trainee
// Initials" / "Trainer Initials" — "DOT Compliance Support Initials" for the
// compliance group). The full wording is too long for a phone column, so each
// cell carries a short label too and CSS picks one for the current width.
function coHeadCell(cls, full, short) {
  return el('div', { class: cls }, [
    el('span', { class: 'co-lbl-full' }, [full]),
    el('span', { class: 'co-lbl-short' }, [short]),
  ]);
}

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

/* ---------- Digital Sign-Off ---------- */
// Each new-hire record carries up to four drawn signatures (trainer, trainee,
// ops leader, DOT compliance) plus a sign-off date — a full set of inputs, one
// per person, saved on the trainee row and embedded into the printed record.

const SIGNOFF_ROLES = [
  { key: 'trainer', label: 'Trainer Signature' },
  { key: 'driver', label: 'Trainee (Driver) Signature' },
  { key: 'opsLeader', label: 'Operations Leader Signature' },
  { key: 'dot', label: 'DOT Compliance Signature' },
];

function ensureSignoffs(tr) {
  if (!tr.signoffs || typeof tr.signoffs !== 'object') tr.signoffs = {};
  for (const r of SIGNOFF_ROLES) if (tr.signoffs[r.key] === undefined || tr.signoffs[r.key] === null) tr.signoffs[r.key] = '';
  if (!tr.signoffs.date) tr.signoffs.date = '';
  return tr.signoffs;
}

function makeSigPad(label, initial) {
  const wrap = el('div', { class: 'sigpad-wrap' });
  const canvas = el('canvas', { class: 'sigpad', width: 600, height: 200 });
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (initial && typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = initial;
    }
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    let drawing = false;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - r.left) * (canvas.width / r.width), y: (src.clientY - r.top) * (canvas.height / r.height) };
    };
    const down = (e) => { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const up = () => (drawing = false);
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', up);
    canvas.addEventListener('mouseleave', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up);
  }
  const bar = el('div', { class: 'sigpad-bar' });
  bar.appendChild(el('span', { class: 'sigpad-label' }, [label]));
  bar.appendChild(el('button', {
    class: 'btn ghost small',
    onclick: () => { if (ctx) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } },
  }, ['Clear']));
  wrap.appendChild(bar);
  wrap.appendChild(canvas);
  return {
    wrap,
    canvas,
    get: () => (ctx && ctx.getImageData && ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0) ? canvas.toDataURL() : null),
  };
}

function renderSignoffCard(tr) {
  ensureSignoffs(tr);
  const pads = {};
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'section-head' }, [el('h2', { class: 'co-sum', style: 'margin:0' }, ['Digital Sign-Off'])]),
    el('div', { class: 'sub', style: 'color:var(--muted);font-size:12px' }, ['One signature per person. Draw (finger, mouse, or stylus) and tap Save Signatures. They\'re embedded into this driver\'s printed record.']),
  ]);
  const grid = el('div', { class: 'sig-grid' });
  for (const r of SIGNOFF_ROLES) {
    pads[r.key] = makeSigPad(r.label, tr.signoffs[r.key] || null);
    grid.appendChild(pads[r.key].wrap);
  }
  card.appendChild(grid);
  card.appendChild(el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, ['Sign-off Date']),
    el('input', { type: 'date', id: 'signoffDate', value: tr.signoffs.date || todayISO(), onchange: (e) => { tr.signoffs.date = e.target.value; } }),
  ]));
  card.appendChild(el('div', { class: 'btn-row' }, [
    el('button', { class: 'btn primary', onclick: () => saveSignoffs(tr, pads) }, ['Save Signatures']),
    el('button', { class: 'btn ghost small danger', onclick: () => clearSignoffs(tr) }, ['Clear All']),
  ]));
  return card;
}

function saveSignoffs(tr, pads) {
  ensureSignoffs(tr);
  const dateInput = document.getElementById('signoffDate');
  if (dateInput) tr.signoffs.date = dateInput.value;
  let any = false;
  for (const r of SIGNOFF_ROLES) {
    tr.signoffs[r.key] = pads[r.key].get() || '';
    if (tr.signoffs[r.key]) any = true;
  }
  persist();
  renderTraineeDetail();
  toast(any ? 'Signatures saved.' : 'All signatures cleared.');
}

function clearSignoffs(tr) {
  if (!confirm('Clear ALL signatures for ' + tr.name + '?')) return;
  ensureSignoffs(tr);
  for (const r of SIGNOFF_ROLES) tr.signoffs[r.key] = '';
  tr.signoffs.date = '';
  persist();
  renderTraineeDetail();
  toast('Signatures cleared.');
}

/* ---------- New-Hire Driver Training Process (gated) ---------- */
// Updated U.S. AutoForce process (2026): the new driver's file (LMS modules,
// DQ file, road test) must be COMPLETE before they go on the road with a
// trainer. Four phases gate in order — nothing can be skipped.

const REGIONS = ['Central', 'West', 'East'];
const REGION_CONTACTS = {
  Central: ['Paula Gerrits', 'Tim Manning', 'Doug Kellner'],
  West: ['Paula Gerrits', 'Tim Manning', 'Mario Soria'],
  East: ['Paula Gerrits', 'Tim Manning', 'Aaron Rowells'],
};

const TRAIN_PHASES = [
  {
    key: 'p1',
    title: 'Day 1–2 · Driver File & LMS (before on-road)',
    rule: 'GATE — this driver must NOT go on the road (with or without a trainer) until every item is complete.',
    items: [
      'All LMS modules completed (incl. the 6 PACE modules)',
      'Driver DQ file completed',
      'DQ file completed & submitted prior to driving with trainer',
      'Road test completed & submitted electronically with DQ file',
      'Road test done in the type of truck they will drive (not the PACE form)',
      'Training vehicle has a working Samsara system',
    ],
  },
  {
    key: 'p2',
    title: 'Day 3 · Trainer Drives',
    rule: 'Trainer drives all day and gives a narrative (commentary) PACE drive.',
    items: [
      'Trainer drives all day (trainer + trainee on the road)',
      'Trainer gives a narrative PACE / commentary drive',
    ],
  },
  {
    key: 'p3',
    title: 'Day 4 · Trainee Drives',
    rule: 'Trainee drives with the trainer in the passenger seat; the PACE evaluation drive is on day 4.',
    items: [
      'Trainee drives with trainer in passenger seat',
      'PACE evaluation drive + PACE Driver Evaluation Form completed (day 4)',
      'Trainee drives using PACE principles with trainer coaching',
    ],
  },
  {
    key: 'p4',
    title: 'Day 5+ · Check-Off, Compliance & Release',
    rule: 'Trainer, trainee and ops management agree ready → check-off signed → sent to region compliance → compliance releases the driver.',
    items: [
      'Trainer, Trainee & ops management agree the driver is ready',
      'Driver-Trainer check-off fully signed',
      'Check-off + PACE evaluation form sent to region compliance',
      'Compliance confirms all compliance documents are 100%',
      'Compliance initials / dates the compliance items',
      'Compliance signs the last signature → released to drive on their own',
    ],
  },
];

const ROAD_MILES = ['Ride-along 1', 'Ride-along 2', 'Ride-along 3', 'Ride-along 4', 'Solo with shadow'];

function ensureProcess(tr) {
  if (!tr.process || typeof tr.process !== 'object') tr.process = {};
  if (!tr.process.region || REGIONS.indexOf(tr.process.region) === -1) {
    tr.process.region = (typeof localStorage !== 'undefined' && localStorage.getItem('trainRegion')) || 'Central';
  }
  if (!tr.process.phases || typeof tr.process.phases !== 'object') tr.process.phases = {};
  for (const ph of TRAIN_PHASES) {
    if (!tr.process.phases[ph.key]) tr.process.phases[ph.key] = { items: {} };
    for (const it of ph.items) {
      const s = tr.process.phases[ph.key].items[it];
      if (!s || typeof s !== 'object') tr.process.phases[ph.key].items[it] = { d: '', i: '' };
    }
  }
  return tr;
}

function procItem(tr, key, label) {
  return ensureProcess(tr).process.phases[key].items[label] || { d: '', i: '' };
}

// Backfills the fixed curriculum/milestone keys for records loaded from an
// older backup or a hand-edited import, so a legacy trainee without them can't
// crash the list/detail renders (progressOf/statusOf read these directly).
function ensureTraits(tr) {
  if (!tr.topics || typeof tr.topics !== 'object') { tr.topics = {}; for (const t of TOPICS) tr.topics[t] = { date: '', trainer: '' }; }
  if (!tr.milestones || typeof tr.milestones !== 'object') { tr.milestones = {}; for (const m of MILESTONES) tr.milestones[m] = { date: '', notes: '' }; }
  return ensureProcess(ensureCheckoffs(tr));
}

// The phase-4 "check-off fully signed" requirement is derived from the real
// table, and "Compliance signs the last signature" is derived from the drawn
// DOT Compliance signature — so the release can't be faked.
function autoItemPass(tr, ph, label) {
  if (label.indexOf('check-off fully signed') >= 0) return coCount(tr) >= CHECKOFF_TOTAL;
  if (label.indexOf('last signature') >= 0) return !!(ensureSignoffs(tr).dot);
  return null; // manual item
}

function phaseItemsDone(tr, key) {
  ensureProcess(tr);
  const ph = TRAIN_PHASES.find((p) => p.key === key);
  if (!ph) return false;
  return ph.items.every((it) => {
    const a = autoItemPass(tr, ph, it);
    if (a !== null) return a;
    const s = procItem(tr, key, it);
    return !!(s.d && s.d.trim());
  });
}

function prevPhasesDone(tr, key) {
  const i = TRAIN_PHASES.findIndex((p) => p.key === key);
  for (let k = 0; k < i; k++) if (!phaseItemsDone(tr, TRAIN_PHASES[k].key)) return false;
  return true;
}

function processProgress(tr) {
  const done = TRAIN_PHASES.filter((p) => phaseItemsDone(tr, p.key)).length;
  return { done, total: TRAIN_PHASES.length };
}

function processGateMsg(tr) {
  return TRAIN_PHASES.filter((p) => !phaseItemsDone(tr, p.key)).map((p) => p.title);
}

function onRoad(t) {
  const m = t.milestones || {};
  return ROAD_MILES.some((x) => m[x] && m[x].date);
}

function setTraineeRegion(tr, region) {
  ensureProcess(tr).process.region = region;
  try { localStorage.setItem('trainRegion', region); } catch (e) {}
  persist();
  renderTraineeDetail();
}

function toggleProcessItem(tr, key, label) {
  ensureProcess(tr);
  const ph = TRAIN_PHASES.find((p) => p.key === key);
  const a = autoItemPass(tr, ph, label);
  if (a !== null) {
    if (!a) toast(label.indexOf('last signature') >= 0
      ? 'Sign the DOT Compliance line in Digital Sign-Off first.'
      : 'Check-Off not fully signed yet (' + coCount(tr) + '/' + CHECKOFF_TOTAL + ') — finish the table above.');
    return;
  }
  if (key !== 'p1' && !prevPhasesDone(tr, key)) { toast('Complete the previous phase first.'); return; }
  const s = procItem(tr, key, label);
  if (s.d) { s.d = ''; s.i = ''; }
  else { s.d = todayISO(); s.i = tr.trainer || ''; }
  persist();
  const phDone = phaseItemsDone(tr, key);
  renderTraineeDetail();
  toast(s.d ? (phDone ? 'Phase complete: ' + ph.title : 'Signed off.') : 'Cleared.');
}

function phaseMark(tr, key) {
  ensureProcess(tr);
  const i = TRAIN_PHASES.findIndex((p) => p.key === key);
  if (i > 0 && !prevPhasesDone(tr, key)) { toast('Complete the "Day 1–2 · Driver File & LMS" phase first.'); return; }
  let trainer = (tr.trainer || '').toUpperCase();
  if (!trainer) {
    const v = prompt('Trainer initials for this phase?', '');
    if (v === null) return;
    trainer = v.trim().toUpperCase();
    if (!trainer) return;
    tr.trainer = trainer;
  }
  for (const it of TRAIN_PHASES[i].items) {
    if (autoItemPass(tr, TRAIN_PHASES[i], it) !== null) continue;
    const s = procItem(tr, key, it);
    if (!s.d) { s.d = todayISO(); s.i = trainer; }
  }
  persist();
  renderTraineeDetail();
  const miss = processGateMsg(tr);
  toast(miss.length ? 'Phase signed. Still needed: ' + miss.join('; ') : 'ALL PHASES COMPLETE — driver file done.');
}

function renderProcessCard(tr) {
  ensureProcess(tr);
  const pp = processProgress(tr);
  const p1ok = phaseItemsDone(tr, 'p1');
  const ok = pp.done === pp.total;
  const banner = ok
    ? el('div', { class: 'pr-banner ok' }, ['✅ FILE COMPLETE — released: this driver is cleared to drive on their own.'])
    : !p1ok
      ? el('div', { class: 'pr-banner no' }, ['🚫 NOT CLEARED TO DRIVE — the Day 1–2 driver file (LMS modules, DQ file, road test) is incomplete. Do NOT let this driver on the road until it\'s done.'])
      : el('div', { class: 'pr-banner warm' }, ['⚠️ Driver file complete — cleared for on-road training (Day 3+). Not yet released by compliance.']);

  const regionSel = el('select', { class: 'select', onchange: (e) => setTraineeRegion(tr, e.target.value) });
  for (const r of REGIONS) regionSel.appendChild(el('option', { value: r, selected: r === tr.process.region }, [r]));

  const card = el('div', { class: 'card pr-card' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'no-top' }, ['Driver Training Process (' + pp.done + '/' + pp.total + ' phases)']),
      regionSel,
    ]),
    banner,
  ]);

  TRAIN_PHASES.forEach((ph, i) => {
    const done = phaseItemsDone(tr, ph.key);
    const locked = ph.key !== 'p1' && !prevPhasesDone(tr, ph.key);
    const counts = ph.items.filter((it) => {
      const a = autoItemPass(tr, ph, it);
      return a !== null ? a : !!(procItem(tr, ph.key, it).d);
    }).length;
    card.appendChild(el('div', { class: 'pr-phase' }, [
      el('div', { class: 'pr-head' }, [
        el('span', { class: 'pr-title' + (done ? ' done' : '') }, [(done ? '✓ ' : locked ? '🔒 ' : '▢ ') + ph.title]),
        el('span', { class: 'pr-n' }, [counts + '/' + ph.items.length]),
      ]),
      el('div', { class: 'pr-body' + (locked ? ' locked' : '') }, [
        el('div', { class: 'pr-rule' }, [ph.rule]),
        ...ph.items.map((it) => {
          const a = autoItemPass(tr, ph, it);
          const auto = a !== null;
          const s = procItem(tr, ph.key, it);
          const active = auto ? a : !!s.d;
          return el('div', { class: 'pr-item' + (active ? ' done' : '') }, [
            el('div', { class: 'check ' + (active ? 'done' : ''), onclick: () => toggleProcessItem(tr, ph.key, it) }, [active ? '✓' : (auto ? '…' : '')]),
            el('div', {}, [
              el('div', { class: 'topic-name' }, [it + (auto && it.indexOf('check-off fully signed') >= 0 ? ' (' + coCount(tr) + '/' + CHECKOFF_TOTAL + ')' : '')]),
              el('div', { class: 'topic-meta' }, auto
                ? (a ? 'Auto-satisfied' : 'Waiting on the check-off table / DOT signature')
                : (s.d ? 'Done ' + s.d + (s.i ? ' · ' + s.i : '') : 'Not yet')),
            ]),
          ]);
        }),
        el('div', { class: 'btn-row', style: 'margin-top:10px' }, [
          el('button', { class: 'btn ghost small', onclick: () => phaseMark(tr, ph.key) }, ['✓ Mark phase complete']),
        ]),
      ]),
    ]));
  });

  const contacts = (REGION_CONTACTS[tr.process.region] || []).join(', ');
  card.appendChild(el('div', { class: 'pr-contacts' }, [
    el('div', { class: 'topic-name' }, ['Send check-off + PACE evaluation form to ' + tr.process.region + ' region: ' + contacts]),
    el('div', { class: 'topic-meta' }, ['Compliance evaluates, initials/dates the compliance items, then signs the LAST signature to release the driver.']),
  ]));
  return card;
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
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
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
    trainees = trainees.map((t) => ensureTraits(t));
    await idbSet(KEY, trainees);
    roster = await rosterGet();
  });
}

function persist() {
  _writeQueue = _writeQueue.then(() => idbSet(KEY, trainees));
  try { localStorage.setItem('trainingTrack', JSON.stringify(trainees)); } catch (e) {}
  scheduleAutoBackup();
}

/* ============================== Driver Roster (shared) ============================== */
// usaf_roster_db / usaf_roster_v1 — the SAME IndexedDB all six AutoForce apps read,
// so a driver profile added in the Driver Hub autofills here too.
const ROSTER_DB = 'usaf_roster_db';
const ROSTER_KEY = 'usaf_roster_v1';
let roster = [];

function rosterOpen() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(ROSTER_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}

async function rosterGet() {
  try {
    const db = await rosterOpen();
    return await new Promise((res) => {
      const t = db.transaction('kv', 'readonly').objectStore('kv').get(ROSTER_KEY);
      t.onsuccess = () => res(t.result || []);
      t.onerror = () => res([]);
    });
  } catch (e) { return []; }
}

function rosterPut(list) {
  const snapshot = JSON.parse(JSON.stringify(list));
  if (typeof indexedDB !== 'undefined') {
    return rosterOpen().then((db) => new Promise((res) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(snapshot, ROSTER_KEY);
      t.onsuccess = () => res();
      t.onerror = () => res();
    })).catch(() => {});
  }
  try { localStorage.setItem(ROSTER_DB + ':' + ROSTER_KEY, JSON.stringify(snapshot)); } catch (e) {}
  return Promise.resolve();
}

function rosterFind(name) {
  const n = String(name || '').trim().toLowerCase();
  return roster.find((r) => String(r.name || '').trim().toLowerCase() === n) || null;
}

function rosterUpsert(entry) {
  const name = String((entry && entry.name) || '').trim();
  if (!name) return;
  const existing = rosterFind(name);
  if (existing) {
    for (const k of ['license', 'warehouse', 'phone', 'hireDate', 'trainer', 'licenseExp', 'medCardExp']) {
      const v = String((entry && entry[k]) || '').trim();
      if (v) existing[k] = v;
    }
  } else {
    roster.push({
      name,
      license: String((entry && entry.license) || '').trim(),
      warehouse: String((entry && entry.warehouse) || '').trim(),
      phone: String((entry && entry.phone) || '').trim(),
      hireDate: String((entry && entry.hireDate) || '').trim(),
      trainer: String((entry && entry.trainer) || '').trim(),
      licenseExp: String((entry && entry.licenseExp) || '').trim(),
      medCardExp: String((entry && entry.medCardExp) || '').trim(),
    });
  }
  rosterPut(roster);
}

// Every driver name the app knows about: the shared roster plus any driver that
// only lives in the Cert Tracker — so the name pickers never come up empty just
// because a driver was first added on a different screen.
function knownDriverNames() {
  const seen = {};
  const add = (n) => { const s = String(n || '').trim(); if (s) seen[s.toLowerCase()] = s; };
  for (const r of roster) add(r.name);
  if (typeof drivers !== 'undefined' && drivers) for (const d of drivers) add(d.name);
  return Object.keys(seen).sort((a, b) => a.localeCompare(b)).map((k) => seen[k]);
}

function ensureRosterDatalist() {
  let dl = document.getElementById('roster-names');
  if (!dl) {
    dl = el('datalist', { id: 'roster-names' });
    document.body.append(dl);
  }
  dl.innerHTML = '';
  for (const n of knownDriverNames()) dl.appendChild(el('option', { value: n }));
  return dl;
}

/* ---------- Reliable Month / Day / Year date entry ----------
   A native <input type="date"> calendar cannot always reach another year: on
   several phones and tablets (and inside installed web apps) tapping the year
   header simply does nothing, so a future expiration date or an old hire date
   becomes impossible to enter. These three plain dropdowns always work on every
   device, and still store the same 'YYYY-MM-DD' string the app already uses. */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function splitISO(iso) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(iso == null ? '' : iso).trim());
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: 0, m: 0, d: 0 };
}

function joinISO(y, m, d) {
  if (!y || !m || !d) return '';
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// Month / Day / Year dropdowns. onChange(iso) fires on every pick; iso is ''
// until all three are chosen. A pre-filled date keeps its day and month, so
// just changing the year re-dates the whole field in one tap.
function dateSelects(value, onChange) {
  const cur = splitISO(value);
  const thisYear = new Date().getFullYear();
  const mSel = el('select', { class: 'dt-m', 'aria-label': 'Month' });
  const dSel = el('select', { class: 'dt-d', 'aria-label': 'Day' });
  const ySel = el('select', { class: 'dt-y', 'aria-label': 'Year' });
  const emit = () => {
    let y = Number(ySel.value) || 0;
    let m = Number(mSel.value) || 0;
    let d = Number(dSel.value) || 0;
    if (y && m && d) { const last = new Date(y, m, 0).getDate(); if (d > last) d = last; onChange(joinISO(y, m, d)); return; }
    onChange(joinISO(y, m, d));
  };
  mSel.appendChild(el('option', { value: '' }, ['Month']));
  MONTH_LABELS.forEach((label, i) => mSel.appendChild(el('option', { value: i + 1, selected: cur.m === i + 1 }, [label])));
  dSel.appendChild(el('option', { value: '' }, ['Day']));
  for (let i = 1; i <= 31; i++) dSel.appendChild(el('option', { value: i, selected: cur.d === i }, [i]));
  ySel.appendChild(el('option', { value: '' }, ['Year']));
  for (let y = thisYear + 12; y >= thisYear - 40; y--) ySel.appendChild(el('option', { value: y, selected: cur.y === y }, [y]));
  [mSel, dSel, ySel].forEach((s) => s.addEventListener('change', emit));
  return el('div', { class: 'dt-row' }, [mSel, dSel, ySel]);
}

// Same trio, but the field's original id lives on a hidden input so existing
// readers (document.getElementById(id).value) keep working untouched.
function dateField(labelText, id, value) {
  const hidden = el('input', { type: 'hidden', id, value: value || '' });
  const row = dateSelects(value || '', (iso) => { hidden.value = iso; });
  return el('div', { class: 'field' }, [el('span', { class: 'field-label' }, [labelText]), row, hidden]);
}

// Write an ISO date into a field by id and, when that id sits on a Month/Day/Year
// trio, move the three dropdowns to match — so autofill from the roster shows up
// in the visible controls instead of only landing on the hidden carrier.
function syncDateField(id, iso) {
  const hidden = document.getElementById(id);
  if (!hidden) return;
  hidden.value = iso || '';
  const host = hidden.parentNode;
  if (!host || !host.children) return;
  // NB: children is an HTMLCollection in a real browser (no .find/.forEach) —
  // walk it by index so this works on every engine as well as in the test mock.
  let row = null;
  for (let i = 0; i < host.children.length; i++) {
    const c = host.children[i];
    const cn = String((c && c.className) || '');
    if ((' ' + cn + ' ').indexOf(' dt-row ') >= 0) { row = c; break; }
  }
  if (!row || row.children.length !== 3) return;
  const p = splitISO(iso);
  const vals = [p.m ? String(p.m) : '', p.d ? String(p.d) : '', p.y ? String(p.y) : ''];
  for (let i = 0; i < row.children.length; i++) {
    const sel = row.children[i];
    if (sel && sel.tagName === 'SELECT') sel.value = vals[i];
  }
}

// Read an ISO date back as MM/DD/YYYY for the read-only roster summary.
function fmtDate(iso) {
  const p = splitISO(iso);
  if (!p.y) return String(iso == null ? '' : iso).trim();
  return String(p.m).padStart(2, '0') + '/' + String(p.d).padStart(2, '0') + '/' + p.y;
}

// Everything the roster knows about a driver that a form might want to show.
// The mapped fields get filled into the form; whatever is left over is printed
// under the name (hire date, lic. #, licence / med-card expirations).
function rosterInfoBits(r) {
  if (!r) return [];
  const out = [];
  const add = (label, v) => {
    const s = String(v == null ? '' : v).trim();
    if (s) out.push(label + ' ' + s);
  };
  add('Hire date', fmtDate(r.hireDate));
  add('Lic.#', r.license);
  add('Lic. exp', fmtDate(r.licenseExp));
  add('Med card exp', fmtDate(r.medCardExp));
  add('Warehouse', r.warehouse);
  add('Trainer', r.trainer);
  return out;
}

// Name input with typeahead; when it matches a roster driver, fills the given
// field ids from the roster (only when the target field is still empty) and
// shows the rest of what the roster knows about them.
// The field also carries a plain <select> pull-down of every known driver name:
// a native <datalist> popup only opens once you start typing (and on some phones
// and in installed web apps it never opens at all), so the dropdown is the
// dependable way to pick someone who is already on the roster.
function rosterField(labelText, id, value, fields, extra = {}) {
  const input = el('input', { type: 'text', id, value, list: 'roster-names', autocomplete: 'off', ...extra });
  const info = el('div', { class: 'roster-info' });
  info.style.display = 'none'; // nothing shown until a roster driver is matched
  const paintInfo = (r) => {
    const bits = rosterInfoBits(r);
    info.innerHTML = '';
    if (bits.length) {
      info.appendChild(el('b', {}, ['From roster: ']));
      info.appendChild(el('span', {}, [bits.join('  •  ')]));
    }
    info.style.display = bits.length ? '' : 'none';
  };
  // force = the user just picked the driver, so the roster wins; typing only
  // fills fields that are still blank so nothing they typed gets stomped.
  const fill = (force) => {
    const r = rosterFind(input.value);
    paintInfo(r);
    if (!r) return;
    for (const [fid, prop] of Object.entries(fields)) {
      const n = document.getElementById(fid);
      if (!n || (n.value && !force)) continue;
      syncDateField(fid, r[prop] || '');
    }
  };
  input.addEventListener('input', () => fill(false));
  input.addEventListener('change', () => fill(false));
  if (value) paintInfo(rosterFind(value));
  const kids = [el('span', { class: 'field-label' }, [labelText]), input];
  const names = knownDriverNames();
  if (names.length) {
    const pick = el('select', { class: 'roster-pick', 'aria-label': 'Choose ' + labelText + ' from the driver roster' });
    pick.appendChild(el('option', { value: '' }, ['Choose from roster…']));
    for (const n of names) pick.appendChild(el('option', { value: n }, [n]));
    pick.addEventListener('change', (e) => {
      const n = e.target.value;
      if (!n) return;
      input.value = n;
      fill(true);
      // Let any field-level handler (persisting the name, autofill, ...) run.
      if (typeof Event === 'function' && input.dispatchEvent) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      pick.value = '';
    });
    kids.push(pick);
  }
  kids.push(info);
  return el('label', { class: 'field' }, kids);
}

function newTrainee(name, hireDate, trainer) {
  const topics = {};
  for (const t of TOPICS) topics[t] = { date: '', trainer: '' };
  const milestones = {};
  for (const m of MILESTONES) milestones[m] = { date: '', notes: '' };
  return ensureTraits({ id: uid(), name, hireDate, trainer, topics, milestones, notes: '', signoffs: {} });
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
  afWatchTraining();   // auto-save the PDF the moment a trainee is released
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
    ensureProcess(tr);
    const p1ok = phaseItemsDone(tr, 'p1');
    const warnFile = !p1ok && (onRoad(tr) || st === 'released');
    return el('div', { class: 'card row', onclick: () => openTrainee(tr.id) }, [
      el('div', {}, [
        el('div', { class: 'title' }, [tr.name]),
        el('div', { class: 'sub' }, [`Hired ${tr.hireDate || '—'}${tr.trainer ? ' · Trainer: ' + tr.trainer : ''}${warnFile ? ' · ⚠️ driver file incomplete' : ''}`]),
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
  ensureRosterDatalist();
  const main = $('app');
  main.innerHTML = '';
  main.append(
    el('div', { class: 'card' }, [
      el('h2', {}, ['New Trainee']),
      rosterField('Trainee name', 'newName', '', { newTrainer: 'trainer', newHire: 'hireDate' }, { placeholder: 'Full name' }),
      dateField('Hire date', 'newHire', ''),
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
  const trainer = $('newTrainer').value.trim();
  const hireDate = $('newHire').value;
  trainees.push(newTrainee(name, hireDate, trainer));
  persist();
  rosterUpsert({ name, hireDate, trainer });
  openTrainee(trainees[trainees.length - 1].id);
}

function openTrainee(id) {
  current = trainees.find((t) => t.id === id);
  coOpen = {};
  if (CHECKOFF_GROUPS.length) coOpen[CHECKOFF_GROUPS[0].name] = true;
  renderTraineeDetail();
}

function renderTraineeDetail() {
  afWatchTraining();   // release can be toggled from this view too
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
      el('button', { class: 'btn small', onclick: () => afTrainReport(tr) }, ['📄 Save PDF / Email']),
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
    el('p', { class: 'rsub' }, ['Tap a milestone (or the 📝 button) to add or update its notes at any time — notes are kept when a milestone is unchecked.']),
    ...MILESTONES.map((m) => {
      const s = tr.milestones[m];
      const done = !!s.date;
      return el('div', { class: 'mile-row' }, [
        el('div', { class: 'check ' + (done ? 'done' : ''), onclick: () => toggleMilestone(m) }, [done ? '✓' : '']),
        el('div', { class: 'mile-body', onclick: () => editMilestoneNote(m) }, [
          el('div', { class: 'mile-name' }, [m]),
          el('div', { class: 'mile-meta' }, done ? (s.notes ? `${s.date} · ${s.notes}` : s.date) : (s.notes ? `Not yet · ${s.notes}` : 'Not yet')),
        ]),
        el('button', { class: 'mile-note-btn' + (s.notes ? ' has' : ''), title: 'Add or edit notes', 'aria-label': `Add or edit notes for ${m}`, onclick: (e) => { if (e && e.stopPropagation) e.stopPropagation(); editMilestoneNote(m); } }, ['📝']),
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

  main.append(header, renderProcessCard(tr), topicsCard, renderCheckoffCard(ensureCheckoffs(tr)), renderSignoffCard(tr), milesCard, notesCard);
}

function renderCheckoffCard(tr) {
  const done = coCount(tr);
  return el('div', { class: 'card' }, [
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'co-sum' }, [`Driver/Trainer Check-Off (${done}/${CHECKOFF_TOTAL})`]),
    ]),
    el('div', { class: 'sub', style: 'color:var(--muted);font-size:12px' }, ['Each item takes the trainee\'s initials, the initials of whoever signed the group off, and the date. Only the Driver Qualification review (the bottom group) is initialled by DOT Compliance Support.']),
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
  const wrap = el('div', { class: 'co-table' + (g.initialsLabel ? ' co-table-wide' : '') });
  wrap.append(el('div', { class: 'co-row co-th' }, [
    el('div', { class: 'co-item' }, ['Item']),
    coHeadCell('co-drv', 'Trainee Initials', 'Trainee'),
    coHeadCell('co-tr', coInitialsLabel(g) + ' Initials', g.initialsLabel ? 'DOT Compliance' : coInitialsLabel(g)),
    el('div', { class: 'co-date' }, ['Date']),
  ]));
  for (const item of g.items) {
    const s = coItem(tr, item);
    const complete = !!(s.date && s.driver && s.trainer);
    wrap.append(el('div', { class: 'co-row' + (complete ? ' done' : '') }, [
      el('div', { class: 'co-item' }, [item]),
      el('div', { class: 'co-drv' }, [el('input', { type: 'text', class: 'co-input', maxlength: '3', placeholder: '·', value: s.driver, oninput: (e) => { const v = e.target.value.toUpperCase(); if (e.target.value !== v) e.target.value = v; s.driver = v; persist(); refreshCo(e.target); } })]),
      el('div', { class: 'co-tr' }, [el('input', { type: 'text', class: 'co-input', maxlength: '3', placeholder: '·', value: s.trainer, oninput: (e) => { const v = e.target.value.toUpperCase(); if (e.target.value !== v) e.target.value = v; s.trainer = v; persist(); refreshCo(e.target); } })]),
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
  // The compliance review is initialled by DOT Compliance Support, not by the
  // trainer, so it keeps its own initials (the trainer's are reused everywhere else).
  let initials;
  if (g.initialsLabel) {
    initials = ((tr.coInitialsExtra || {})[g.initialsLabel] || '').toUpperCase();
    if (!initials) {
      const v = prompt(g.initialsLabel + ' initials for this group?', '');
      if (v === null) return;
      initials = v.trim().toUpperCase();
      if (!initials) return;
      if (!tr.coInitialsExtra) tr.coInitialsExtra = {};
      tr.coInitialsExtra[g.initialsLabel] = initials;
    }
  } else {
    initials = (tr.coInitials || '').toUpperCase();
    if (!initials) {
      const v = prompt('Trainer initials for this group?', '');
      if (v === null) return;
      initials = v.trim().toUpperCase();
      if (!initials) return;
      tr.coInitials = initials;
    }
  }
  let driverInit = (tr.coDriverInitials || '').toUpperCase();
  const needDriver = pending.some((it) => !coItem(tr, it).driver);
  if (needDriver && !driverInit) {
    const v = prompt('Driver initials for this group?', '');
    if (v === null) return;
    driverInit = v.trim().toUpperCase();
    if (!driverInit) return;
    tr.coDriverInitials = driverInit;
  }
  for (const it of pending) {
    const s = tr.checkoffs[it];
    s.date = todayISO();
    s.trainer = initials;
    if (!s.driver) s.driver = driverInit;
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
  if (!s.date) {
    ensureProcess(current);
    if (m === 'Ride-along 1' && !phaseItemsDone(current, 'p1')) {
      toast('🚫 Blocked: complete the "Day 1–2 · Driver File & LMS" phase (LMS modules, DQ file, road test) before this driver goes on the road with a trainer.');
      return;
    }
    if (m === 'Solo with shadow' && !phaseItemsDone(current, 'p1')) {
      toast('🚫 Blocked: the "Day 1–2 · Driver File & LMS" phase must be complete before solo & shadow.');
      return;
    }
    if (m === 'Ready for release' && (!phaseItemsDone(current, 'p1') || !phaseItemsDone(current, 'p2') || !phaseItemsDone(current, 'p3'))) {
      toast('🚫 Blocked: finish the Day 1–2 file and the Day 3 / Day 4 phases before marking "Ready for release".');
      return;
    }
    if (m === 'Released / sign-off' && !phaseItemsDone(current, 'p4')) {
      toast('🚫 Blocked: release requires the full "Day 5+ · Check-Off, Compliance & Release" phase (check-off fully signed, sent to compliance, compliance signs the last DOT signature). Still needed: ' + processGateMsg(current).join('; '));
      return;
    }
    s.date = todayISO();
    // Ask for the note straight away, pre-filled with anything already recorded
    // so a previously written note is never lost (e.g. after an uncheck/recheck).
    const note = promptMilestoneNote(m, s.notes);
    if (note !== null) s.notes = note;
  } else {
    // Unchecking only clears the completion date — the notes are kept so the
    // ride-along log can be added to over time.
    s.date = '';
  }
  persist();
  renderTraineeDetail();
}

// Opens the note editor for a milestone (works whether or not it is checked)
// with the existing note pre-filled, so notes can be built up over time.
function editMilestoneNote(m) {
  if (!current) return;
  const s = current.milestones[m];
  if (!s) return;
  const note = promptMilestoneNote(m, s.notes);
  if (note === null) return;
  const changed = note !== (s.notes || '');
  s.notes = note;
  persist();
  renderTraineeDetail();
  if (changed) toast(note ? `Note saved for "${m}"` : `Note cleared for "${m}"`);
}

function promptMilestoneNote(m, existing) {
  const val = prompt(`Notes for "${m}"? (add or edit — leave blank to clear)`, existing || '');
  return val === null ? null : val.trim();
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

/* ---------- Auto-backup ----------
   Keeps an off-device, recoverable copy: a timestamped JSON file drops into
   Downloads a few seconds after you stop entering data. Debounced 15s,
   throttled to one per 5 min, capped per session. Toggle in the Print tab. */
const AUTOBACKUP_KEY = 'autobk_training';
let _abEnabled = (localStorage.getItem(AUTOBACKUP_KEY) !== 'off');
let _abTimer = null, _abLast = 0, _abCount = 0, _abPending = false;
const AB_DELAY = 15000, AB_MIN_GAP = 300000, AB_MAX = 6;

function autoBackupEnabled() { return _abEnabled; }
function setAutoBackup(on) { _abEnabled = !!on; try { localStorage.setItem(AUTOBACKUP_KEY, on ? 'on' : 'off'); } catch (e) {} }
function scheduleAutoBackup() { if (!_abEnabled) return; _abPending = true; clearTimeout(_abTimer); _abTimer = setTimeout(runAutoBackup, AB_DELAY); }
function runAutoBackup() {
  if (!_abEnabled || !_abPending) return;
  const now = Date.now();
  if (_abCount >= AB_MAX) { _abPending = false; return; }
  if (_abLast && now - _abLast < AB_MIN_GAP) { _abTimer = setTimeout(runAutoBackup, AB_MIN_GAP - (now - _abLast)); return; }
  _abPending = false; _abLast = now; _abCount++;
  try {
    if (!trainees.length) return;
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
    const data = JSON.stringify({ app: 'usaf-training', exported: todayISO(), trainees }, null, 2);
    const a = el('a', { href: 'data:text/json;charset=utf-8,' + encodeURIComponent(data), download: 'training-tracker-auto-' + ts + '.json' });
    document.body.append(a);
    a.click();
    a.remove();
  } catch (e) {}
}
function autoBackupToggleUI() {
  const ck = el('input', { type: 'checkbox', class: 'ab-ck', onchange: (e) => { setAutoBackup(e.target.checked); toast(e.target.checked ? 'Auto-backup ON' : 'Auto-backup OFF'); } });
  ck.checked = _abEnabled;
  return el('label', { class: 'ab-toggle' }, [
    ck,
    el('span', { class: 'ab-txt' }, [
      el('span', { class: 'ab-title' }, ['Auto-backup to Downloads']),
      el('span', { class: 'sub' }, ['Saves a timestamped backup file to Downloads a few seconds after you stop entering data (up to 6 per session).']),
    ]),
  ]);
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
    autoBackupToggleUI(),
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
        el('button', {
          class: 'btn ghost small',
          onclick: (e) => { e.stopPropagation(); afTrainReport(tr); },
        }, ['📄 PDF']),
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

const AF_LOGO = 'data:image/jpeg;base64,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';

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
    .foot { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 24px; }
    .sig { width: 210px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
    .sig img { display: block; max-height: 44px; max-width: 100%; margin-bottom: 2px; }
    .sig .sigdate { font-size: 12px; font-weight: 600; height: 44px; display: flex; align-items: flex-end; }
    .print-brand { display: flex; align-items: center; gap: 12px; padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #7c3aed; }
    .print-brand img { height: 44px; width: auto; border-radius: 6px; }
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
    ${trainees.map((tr) => processPrintBlock(tr) + checkoffPrintBlock(tr) + signoffPrintBlock(tr)).join('')}
  </body></html>`;
}

function signoffPrintBlock(tr) {
  ensureSignoffs(tr);
  const s = tr.signoffs;
  const cell = (data, label) => '<div class="sig">' +
    (data ? '<img src="' + data + '" alt="' + esc(label) + '">' : '') +
    '<div>' + esc(label) + '</div></div>';
  return '<h4>Digital Sign-Off — ' + esc(tr.name) + '</h4>' +
    '<div class="foot">' +
    cell(s.trainer, 'Trainer Signature') +
    cell(s.driver, 'Trainee Signature') +
    cell(s.opsLeader, 'Operations Leader Signature') +
    cell(s.dot, 'DOT Compliance Signature') +
    '<div class="sig">' + (s.date ? '<div class="sigdate">' + esc(s.date) + '</div>' : '') + '<div>Date</div></div>' +
    '</div>';
}

function processPrintBlock(tr) {
  ensureProcess(tr);
  const p1ok = phaseItemsDone(tr, 'p1');
  const ok = phaseItemsDone(tr, 'p4');
  const contacts = (REGION_CONTACTS[tr.process.region] || []).join(', ');
  const phases = TRAIN_PHASES.map((ph, idx) => {
    const rows = ph.items.map((it) => {
      const a = autoItemPass(tr, ph, it);
      const auto = a !== null;
      const s = procItem(tr, ph.key, it);
      const active = auto ? a : !!s.d;
      return `<tr><td style="width:22px;text-align:center">${active ? '✓' : ''}</td>
        <td>${esc(it)}${auto && it.indexOf('check-off fully signed') >= 0 ? ' (' + coCount(tr) + '/' + CHECKOFF_TOTAL + ')' : ''}</td>
        <td style="width:70px">${esc(s.i)}</td>
        <td style="width:90px">${esc(s.d)}</td></tr>`;
    }).join('');
    return `<h4>Phase ${idx + 1} — ${esc(ph.title)}${phaseItemsDone(tr, ph.key) ? ' ✓' : ''}</h4>
      <p style="margin:2px 0 6px;color:#555;font-size:11px">${esc(ph.rule)}</p>
      <table><tr><th></th><th>Requirement</th><th>Initials</th><th>Date</th></tr>${rows}</table>`;
  }).join('');
  return `<h3>Driver Training Process (gated)</h3>
    <p style="margin:2px 0 8px;font-weight:700;color:${p1ok ? '#0a7a0a' : '#b00020'}">
    Driver File Gate (Day 1–2, before on-road): ${p1ok ? 'COMPLETE — cleared to drive with trainer' : 'INCOMPLETE — driver must NOT go on the road'}</p>
    <p style="margin:0 0 8px;font-size:11px;color:#555">Region: ${esc(tr.process.region)} · Send check-off + PACE evaluation form to: ${esc(contacts)}</p>
    ${phases}
    ${ok ? '<p style="margin:8px 0 0;font-weight:700;color:#0a7a0a">FILE COMPLETE — released to drive on their own.</p>' : ''}`;
}

function checkoffPrintBlock(tr) {
  ensureCheckoffs(tr);
  const done = coCount(tr);
  const groups = CHECKOFF_GROUPS.map((g) => {
    const gdone = g.items.filter((it) => coItem(tr, it).date).length;
    return `<h4>${esc(g.name)} (${gdone}/${g.items.length})</h4>
      <table><tr><th>Item</th><th>Trainee Initials</th><th>${esc(coInitialsLabel(g))} Initials</th><th>Date</th></tr>
      ${g.items.map((it) => {
        const s = coItem(tr, it);
        return `<tr><td>${esc(it)}</td><td>${esc((s.driver || '').toUpperCase())}</td><td>${esc((s.trainer || '').toUpperCase())}</td><td>${esc(s.date)}</td></tr>`;
      }).join('')}
      </table>`;
  }).join('');
  return `<h3>${esc(tr.name)} — ${done}/${CHECKOFF_TOTAL} signed</h3>${groups}`;
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    /* SW disabled in demo */
  }
}

initStorage().then(() => { render(); registerSW(); }).catch((e) => console.error(e));

/* === AF-REPORT:BEGIN === */
window.__afToast = toast;

function afTrainReleased(tr) {
  const m = (tr && tr.milestones) || {};
  return !!(m['Released / sign-off'] && m['Released / sign-off'].date);
}
function afTrainKey(tr) {
  const m = (tr && tr.milestones) || {};
  return 'train:' + ((tr && (tr.id || tr.name)) || '?') + ':' + ((m['Released / sign-off'] || {}).date || '');
}

/* Build a print-quality PDF spec out of one new-hire training record. */
function afTrainSpec(tr) {
  const tp = tr.topics || {};
  const m = tr.milestones || {};
  const st = statusOf(tr);
  const p = progressOf(tr);
  const proc = (tr.process && tr.process.phases) || {};
  const phaseDone = TRAIN_PHASES.filter((x) => phaseItemsDone(tr, x.key)).length;
  const released = (m['Released / sign-off'] || {}).date || '';
  const meta = [
    ['Driver:', tr.name || '—'],
    ['Hire Date:', tr.hireDate || '—'],
    ['Trainer:', tr.trainer || '—'],
    ['Region:', (tr.process && tr.process.region) || '—'],
    ['Status:', st === 'released' ? 'RELEASED — cleared to drive' : st === 'ready' ? 'Ready for release' : 'In training'],
    ['Released:', released || '—'],
    ['Progress:', p.done + ' / ' + p.total + '  (' + p.pct + '%)'],
    ['Check-Off:', coCount(tr) + ' / ' + CHECKOFF_TOTAL + ' items signed'],
    ['Process:', phaseDone + ' / ' + TRAIN_PHASES.length + ' phases complete'],
  ];
  const blocks = [];
  blocks.push({
    heading: 'Curriculum (' + Object.keys(tp).filter((t) => (tp[t] || {}).date).length + ' / ' + TOPICS.length + ')',
    rows: TOPICS.map((t) => {
      const s = tp[t] || {};
      return [t, s.date ? s.date + (s.trainer ? ' · ' + s.trainer : '') : '—'];
    }),
  });
  blocks.push({
    heading: 'Ride-Alongs & Milestones',
    rows: MILESTONES.map((mm) => {
      const s = m[mm] || {};
      const notes = s.notes || '';
      return [mm, s.date ? (notes ? s.date + ' · ' + notes : s.date) : (notes || '—')];
    }),
  });
  TRAIN_PHASES.forEach((ph) => {
    blocks.push({
      heading: 'Process · ' + ph.title,
      rows: ph.items.map((it) => {
        const s = procItem(tr, ph.key, it);
        const auto = autoItemPass(tr, ph, it);
        let v;
        if (auto === true) v = 'Signed' + (s.d ? ' · ' + s.d : '');
        else v = s.d ? (s.i ? s.i + ' · ' + s.d : s.d) : '—';
        return [it, v];
      }),
      notes: ph.rule,
    });
  });
  CHECKOFF_GROUPS.forEach((g) => {
    blocks.push({
      heading: 'Check-Off · ' + g.name + (g.initialsLabel ? ' — ' + g.initialsLabel + ' initials' : ''),
      rows: g.items.map((it) => {
        const c = coItem(tr, it);
        const bits = [];
        if (c.date) bits.push(c.date);
        if (c.driver) bits.push('trainee ' + c.driver);
        if (c.trainer) bits.push('trainer ' + c.trainer);
        return [it, bits.join(' · ') || '—'];
      }),
    });
  });
  const so = ensureSignoffs(tr);
  const signatures = SIGNOFF_ROLES.filter((r) => so[r.key]).map((r) => ({ label: r.label, image: so[r.key] }));
  const footnotes = [];
  if (so.date) footnotes.push('Check-Off / Sign-Off Date: ' + so.date);
  const region = (tr.process || {}).region;
  if (region && typeof REGION_CONTACTS !== 'undefined' && REGION_CONTACTS[region]) {
    footnotes.push('Region ' + region + ' contacts: ' + REGION_CONTACTS[region].join(', '));
  }
  footnotes.push('The driver file must be complete and signed off before the driver goes on the road alone.');
  footnotes.push('Generated ' + todayISO() + ' · U.S. AutoForce · Field Operations');
  return {
    kind: 'New Hire',
    name: tr.name || 'Trainee',
    date: released || todayISO(),
    title: 'New-Hire Driver Training Record',
    subtitle: (tr.name || '') + (tr.hireDate ? ' · hired ' + tr.hireDate : '') + (tr.trainer ? ' · trainer ' + tr.trainer : ''),
    logo: typeof AF_LOGO !== 'undefined' ? AF_LOGO : null,
    stamp: st === 'released' ? 'RELEASED TO DRIVE' : st === 'ready' ? 'READY FOR RELEASE' : 'IN TRAINING',
    meta, blocks, paragraphs: [], signatures, footnotes,
  };
}

/* Save + offer to email one training record (also used by on-screen buttons). */
function afTrainReport(tr) { return AFReport.save(afTrainSpec(tr)); }

/* Fires the auto-save exactly once, the moment a trainee is released. */
function afWatchTraining() {
  try {
    AFReport.watchTraining(trainees, { isComplete: afTrainReleased, key: afTrainKey, spec: afTrainSpec });
  } catch (e) {}
}
/* === AF-REPORT:END === */
