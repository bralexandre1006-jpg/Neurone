import { icon, BRAND, DOMAIN_ICONS } from './icons.js';
import * as S from './store.js';
import { initWindow } from './window.js';
import { audioSlot, audioSay, hydrateAudio, stopAudio } from './audio.js';
import * as PL from './plan.js';

const { state } = S;
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#60a5fa', '#34d399', '#facc15', '#f472b6', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);
const fmtDate = (k, opt = { day: 'numeric', month: 'long' }) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', opt);
const fmtDuration = (w) => (w % 4 === 0 && w >= 8 ? plural(w / 4, 'mois').replace('moiss', 'mois') : plural(w, 'semaine'));

let route = { name: 'overview' };
let catalog = [];
let quizSession = null;

/* ---------------- Navigation ---------------- */
function go(r) {
  route = r;
  stopAudio();
  if (r.name !== 'quiz') quizSession = null;
  render();
  $('#view').scrollTop = 0;
}

const NAV = [
  { name: 'overview', label: "Vue d'ensemble", ico: 'home' },
  { name: 'domains', label: 'Domaines', ico: 'grid', count: () => state.domains.length },
  { name: 'progress', label: 'Progression', ico: 'chart' },
  { name: 'exams', label: 'Examens', ico: 'exam' },
  { name: 'settings', label: 'Paramètres', ico: 'settings' }
];

function renderSidebar() {
  const active = ['domain', 'lesson', 'quiz'].includes(route.name) ? 'domains' : route.name;
  $('#nav').innerHTML = NAV.map((n) => `
    <button class="nav-item ${active === n.name ? 'active' : ''}" data-nav="${n.name}" title="${n.label}">
      ${icon(n.ico)}<span class="label">${n.label}</span>${n.count ? `<span class="count">${n.count()}</span>` : ''}
    </button>`).join('');
  $('#domainNav').innerHTML = state.domains.length
    ? state.domains.map((d) => `
      <button class="nav-item ${route.id === d.id ? 'active' : ''}" data-domain="${d.id}" title="${esc(d.name)}">
        <span class="cdot" style="color:${d.color}"></span><span class="label">${esc(d.name)}</span>
        <span class="pct">${S.domainStats(d).pct}%</span>
      </button>`).join('')
    : `<div class="dim" style="padding:4px 12px;font-size:12px">Aucun domaine</div>`;
  const st = S.streak();
  $('#streakLabel').textContent = `Série : ${plural(st, 'jour')}`;
}

function crumbs(items) {
  $('#crumbs').innerHTML = items.map((it, i) => {
    const last = i === items.length - 1;
    const sep = i ? `<span class="sep">/</span>` : '';
    if (last) return `${sep}<span class="cur" data-tauri-drag-region>${esc(it.label)}</span>`;
    return `${sep}<button data-go='${JSON.stringify(it.go)}'>${esc(it.label)}</button>`;
  }).join('');
}

/* ---------------- Views ---------------- */
function render() {
  renderSidebar();
  const views = { overview, domains, domain, lesson, quiz, progress, exams, settings };
  const fn = views[route.name] || overview;
  const html = fn();
  if (html === null) return;
  $('#view').innerHTML = `<div class="view-inner">${html}</div>`;
  hydrateAudio($('#view'));
  requestAnimationFrame(() => document.querySelectorAll('[data-w]').forEach((el) => (el.style.width = el.dataset.w + '%')));
}

function statCard(title, ico, val, foot, art = '') {
  return `<div class="card">${art}<div class="card-title">${icon(ico)}${title}</div><div class="stat-val">${val}</div><div class="stat-foot">${foot}</div></div>`;
}

function bar(pct, color) {
  return `<div class="bar" style="color:${color}"><i data-w="${pct}" style="width:0"></i></div>`;
}

function overview() {
  crumbs([{ label: "Vue d'ensemble" }]);
  const now = new Date();
  const all = state.domains.map((d) => ({ d, s: S.domainStats(d) }));
  const lessonsDone = all.reduce((a, x) => a + x.s.lessonsDone, 0);
  const lessonsTotal = all.reduce((a, x) => a + x.s.lessons, 0);
  const global = all.length ? Math.round(all.reduce((a, x) => a + x.s.pct, 0) / all.length) : 0;
  const ex = examList();
  const passed = ex.filter((e) => e.passed).length;
  const weekMin = minutesSince(7);
  const st = S.streak();

  return `
  <div class="page-head">
    <div>
      <h1 class="h1">${MONTHS[now.getMonth()]} <span class="soft">${now.getFullYear()}</span></h1>
    </div>
    <button class="btn btn-primary" data-action="new-domain">${icon('plus')}Nouveau domaine</button>
  </div>

  <div class="grid stats">
    ${statCard('Progression globale', 'target', `${global}<small>%</small>`, `${plural(all.length, 'domaine')} en cours`)}
    ${statCard('Série en cours', 'flame', `${st}<small>${st > 1 ? 'jours' : 'jour'}</small>`, st ? 'Le plan quinquennal avance' : 'Étudie aujourd\'hui pour lancer la série')}
    ${statCard('Leçons terminées', 'book', `${lessonsDone}<small>/${lessonsTotal}</small>`, `${fmtMin(weekMin)} cette semaine`)}
    ${statCard('Examens réussis', 'trophy', `${passed}<small>/${ex.length}</small>`, `${ex.filter((e) => e.available && !e.passed).length} à passer`)}
  </div>

  <div class="split">
    <div class="card chart-card">
      <div class="chart-head">
        <div><div class="card-title" style="margin:0">${icon('clock')}Temps d'étude</div>
        <div class="stat-val" style="margin-top:8px">${fmtMin(minutesSince(56))}</div>
        <div class="stat-foot">8 dernières semaines</div></div>
        <div class="legend">${state.domains.map((d) => `<span><i style="background:${d.color}"></i>${esc(d.name)}</span>`).join('')}</div>
      </div>
      ${studyChart()}
    </div>

    <div class="grid" style="align-content:start">
      <div class="card today">${todayCard()}</div>
      <div class="card">
        <div class="flex between" style="margin-bottom:6px"><div class="h2">Mes domaines</div><button class="btn btn-ghost btn-sm" data-nav="domains">Tout voir ${icon('right')}</button></div>
        <div class="list">${all.length ? all.slice(0, 5).map(({ d, s }) => `
          <button class="row" data-domain="${d.id}" style="text-align:left;width:100%">
            <span class="cdot" style="color:${d.color}"></span>
            <div class="row-main"><div class="row-title">${esc(d.name)}</div>${bar(s.pct, d.color)}</div>
            <span class="row-end">${s.pct}%</span>
          </button>`).join('') : `<div class="dim" style="padding:12px 0">Aucun domaine pour l'instant.</div>`}</div>
      </div>
    </div>
  </div>`;
}

const TYPE_ICO = { lesson: 'book', quiz: 'exam', exam: 'trophy' };

function todayCard() {
  const todayK = S.today();
  const rows = [];
  let plannedMin = 0, doneMin = 0, nextK = null;
  state.domains.filter((d) => d.modules.length).forEach((d) => {
    const p = PL.plan(d);
    p.doneToday.forEach((it) => { rows.push({ d, it, done: true, min: it.minutes }); doneMin += it.minutes; plannedMin += it.minutes; });
    p.todayPlanned.forEach((it) => { rows.push({ d, it, done: false, min: it.planned }); plannedMin += it.planned; });
    for (const k of p.days.keys()) if (k > todayK && (!nextK || k < nextK)) { nextK = k; break; }
  });
  const now = new Date();
  const head = `<div class="flex between"><div class="card-title" style="margin:0">${icon('calendar')}Aujourd'hui · ${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    ${plannedMin ? `<span class="mono dim" style="font-size:11.5px">${doneMin} / ${plannedMin} min</span>` : ''}</div>`;
  if (!rows.length) {
    return `${head}<div class="lesson-name" style="margin-top:14px">Jour de repos</div>
      <div class="muted" style="font-size:12.5px">${nextK ? `Prochaine séance ${fmtDate(nextK, { weekday: 'long', day: 'numeric', month: 'long' })}. Le repos fait partie du plan, Camarade.` : 'Ajoute un domaine pour lancer ton planning.'}</div>`;
  }
  const first = rows.find((r) => !r.done);
  return `${head}
    ${bar(plannedMin ? Math.round((doneMin / plannedMin) * 100) : 0, 'var(--accent)')}
    <div class="today-list">${rows.map((r) => `
      <button class="today-item ${r.done ? 'done' : ''}" data-go='${JSON.stringify(r.it.go)}'>
        <span class="check ${r.done ? 'on' : ''}">${r.done ? icon('check') : ''}</span>
        <span class="cdot" style="color:${r.d.color};margin:0"></span>
        <span class="t">${esc(r.it.title)}${r.it.cont && !r.done ? ' <span class="dim">(partie)</span>' : ''}</span>
        <span class="m">${r.min} min</span>
      </button>`).join('')}</div>
    ${first ? `<button class="btn btn-primary" style="margin-top:14px" data-go='${JSON.stringify(first.it.go)}'>Commencer la séance${icon('right')}</button>` : `<div class="up" style="margin-top:12px;font-size:12.5px">Séance du jour accomplie. Le plan avance, Camarade</div>`}`;
}

function planCard(d) {
  PL.ensureTarget(d);
  const p = PL.plan(d);
  const st = PL.status(d, p);
  const wk = PL.weeks(d, p);
  const sc = p.sc;
  const sessions = Math.ceil(p.remainingMin / sc.minutes);
  const dow = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const cal = wk.rows.map((row) => `<div class="cal-row">${row.map((c) => {
    const min = c.past || (c.today && !c.plannedMin) ? c.doneMin : c.plannedMin + (c.today ? c.doneMin : 0);
    const cls = [c.study ? 'study' : 'rest', c.today ? 'today' : '', c.past ? 'past' : '', c.plannedMin ? 'has' : '', c.doneMin ? 'did' : ''].join(' ');
    const tip = c.planned.map((x) => `• ${x.title} (${x.planned} min)`).join('\n');
    return `<div class="cal-day ${cls}" title="${esc(fmtDate(c.k, { weekday: 'long', day: 'numeric', month: 'long' }) + (tip ? '\n' + tip : c.doneMin ? `\n${c.doneMin} min étudiées` : c.study ? '' : '\nRepos'))}">
      <span class="cal-n">${c.date.getDate()}</span>
      ${min ? `<span class="cal-min">${min}′</span>` : ''}
      ${c.plannedMin || c.doneMin ? `<span class="cal-bar"><i style="width:${Math.min(100, Math.round(((c.past ? c.doneMin : c.plannedMin + (c.today ? c.doneMin : 0)) / sc.minutes) * 100))}%"></i></span>` : ''}
    </div>`;
  }).join('')}</div>`).join('');
  return `<div class="card plan-card section-gap" style="margin:0 0 14px">
    <div class="plan-top">
      <div class="plan-stats">
        <div><div class="eyebrow" style="margin-bottom:6px">Rythme</div><div class="plan-val">${sc.minutes} min</div><div class="dim" style="font-size:12px">${PL.daysLabel(sc.days)} · ${fmtMin(PL.weeklyMinutes(sc))}/sem.</div></div>
        <div><div class="eyebrow" style="margin-bottom:6px">Reste</div><div class="plan-val">${fmtMin(p.remainingMin)}</div><div class="dim" style="font-size:12px">${plural(sessions, 'séance')}</div></div>
        <div><div class="eyebrow" style="margin-bottom:6px">Fin prévue</div><div class="plan-val">${p.finished ? 'Terminé' : p.end ? fmtDate(p.end) : '—'}</div><div class="dim" style="font-size:12px">${d.schedule?.target && !p.finished ? `objectif ${fmtDate(d.schedule.target, { day: 'numeric', month: 'short' })}` : ''}</div></div>
      </div>
      <div class="flex">${st ? `<span class="pill ${st.kind === 'ok' ? 'ok' : st.kind === 'ko' ? 'ko' : ''}">${st.label}</span>` : ''}
        <button class="btn btn-sm" data-action="edit-rhythm" data-id="${d.id}">${icon('settings')}Modifier le rythme</button></div>
    </div>
    <div class="cal">
      <div class="cal-row cal-head">${dow.map((x) => `<span>${x}</span>`).join('')}</div>
      ${cal}
    </div>
    ${wk.more ? `<div class="dim" style="font-size:11.5px;margin-top:8px">… et la suite jusqu'au ${fmtDate(p.end)}.</div>` : ''}
  </div>`;
}

function minutesSince(days) {
  const from = new Date(); from.setDate(from.getDate() - days + 1);
  const k = S.today(from);
  let t = 0;
  for (const [day, v] of Object.entries(state.progress.log)) if (day >= k) t += Object.values(v).reduce((a, b) => a + b, 0);
  return t;
}

function weekBuckets(n = 8) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (n - 1) * 7);
  const weeks = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); return d; });
  return weeks;
}

function studyChart() {
  const weeks = weekBuckets(8);
  const keys = weeks.map((w) => S.today(w));
  const series = state.domains.map((d) => {
    const vals = keys.map(() => 0);
    for (const [day, v] of Object.entries(state.progress.log)) {
      if (!v[d.id]) continue;
      let idx = -1;
      for (let i = keys.length - 1; i >= 0; i--) if (day >= keys[i]) { idx = i; break; }
      if (idx >= 0) vals[idx] += v[d.id];
    }
    return { color: d.color, vals };
  });
  const max = Math.max(20, ...series.flatMap((s) => s.vals));
  const step = Math.ceil(max / 4 / 5) * 5;
  const top = step * 4;
  const W = 600, H = 200;
  const pt = (v, i) => [(i / (keys.length - 1)) * W, H - (v / top) * (H - 8) - 4];
  const path = (vals) => {
    const p = vals.map(pt);
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[Math.max(0, i - 1)], [x1, y1] = p[i], [x2, y2] = p[i + 1], [x3, y3] = p[Math.min(p.length - 1, i + 2)];
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2), cl = (y) => Math.max(lo, Math.min(hi, y));
      d += ` C${x1 + (x2 - x0) / 6},${cl(y1 + (y2 - y0) / 6)} ${x2 - (x3 - x1) / 6},${cl(y2 - (y3 - y1) / 6)} ${x2},${y2}`;
    }
    return d;
  };
  const grid = [0, 1, 2, 3, 4].map((i) => `<line class="grid-line" x1="0" x2="${W}" y1="${(i / 4) * H}" y2="${(i / 4) * H}"/>`).join('');
  const curves = series.map((s, i) => {
    const d = path(s.vals);
    return `<defs><linearGradient id="g${i}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
      <path class="area" d="${d} L${W},${H} L0,${H} Z" fill="url(#g${i})"/>
      <path class="curve" d="${d}" stroke="${s.color}"/>`;
  }).join('');
  const yl = [4, 3, 2, 1, 0].map((i) => `<span>${Math.round((top * i) / 4)}m</span>`).join('');
  const xl = weeks.map((w) => `<span>${String(w.getDate()).padStart(2, '0')}/${String(w.getMonth() + 1).padStart(2, '0')}</span>`).join('');
  return `<div class="chart"><div class="y-labels">${yl}</div><div class="plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${curves}</svg></div></div><div class="x-labels">${xl}</div>`;
}

function domains() {
  crumbs([{ label: 'Domaines' }]);
  return `
  <div class="page-head">
    <div><div class="eyebrow">Bibliothèque</div><h1 class="h1">Domaines <span class="soft">${state.domains.length}</span></h1>
    <div class="sub">Chaque domaine est un cursus complet : modules, leçons, tests et examen final</div></div>
    <button class="btn btn-primary" data-action="new-domain">${icon('plus')}Nouveau domaine</button>
  </div>
  <div class="grid domains">
    ${state.domains.map(domainCard).join('')}
    <button class="card new-card" data-action="new-domain"><div><div class="plus">${icon('plus')}</div>Nouveau domaine<div class="dim" style="font-size:12px;margin-top:4px">Anglais, philosophie, code…</div></div></button>
  </div>`;
}

function domainCard(d) {
  const s = S.domainStats(d);
  const empty = !d.modules.length;
  return `
  <div class="card domain-card" data-domain="${d.id}" style="color:${d.color}">
    <div class="dc-head">
      <div class="dc-icon" style="color:${d.color}">${icon(d.icon)}</div>
      ${empty ? `<span class="pill wait">Cursus à construire</span>` : d.demo ? `<span class="pill">Démo</span>` : s.pct === 100 ? `<span class="pill ok">Terminé</span>` : ''}
    </div>
    <div><div class="dc-name">${esc(d.name)}</div><div class="dc-desc">${esc(d.description || d.goal || '')}</div></div>
    <div class="dc-meta"><span class="pill">${icon('clock')}${PL.schedule(d).minutes} min/j</span>${!empty && PL.plan(d).end ? `<span class="pill">fin ${fmtDate(PL.plan(d).end, { day: 'numeric', month: 'short' })}</span>` : ''}<span class="pill">${esc(d.level)}</span><span class="pill">${plural(s.modules, 'module')}</span></div>
    <div><div class="dc-foot"><span>${s.lessonsDone}/${s.lessons} leçons</span><span>${s.pct}%</span></div>${bar(s.pct, d.color)}</div>
  </div>`;
}

function exBadge(d, l) {
  if (!l.exercise) return '';
  const b = S.bestScore(S.exerciseKey(d, l));
  return b === null ? '' : `<span class="pill ${b >= S.passScore(l.exercise) ? 'ok' : 'ko'}">${b}%</span>`;
}

function ring(pct, color) {
  const c = 2 * Math.PI * 40;
  return `<div class="ring" style="color:${color}"><svg viewBox="0 0 92 92"><circle class="track" cx="46" cy="46" r="40"/><circle class="val" cx="46" cy="46" r="40" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg><b>${pct}%</b></div>`;
}

function domain() {
  const d = S.getDomain(route.id);
  if (!d) return (go({ name: 'domains' }), null);
  crumbs([{ label: 'Domaines', go: { name: 'domains' } }, { label: d.name }]);
  const s = S.domainStats(d);
  const head = `
  <div class="hero">
    <div style="min-width:0">
      <div class="eyebrow" style="display:flex;align-items:center;gap:8px"><span class="cdot" style="color:${d.color};margin:0"></span>${esc(d.level)}${d.demo ? ' · démo' : ''}</div>
      <h1 class="h1">${esc(d.name)}</h1>
      <div class="sub">${esc(d.goal || d.description || '')}</div>
      <div class="hero-meta">
        <span class="pill">${icon('clock')}${PL.schedule(d).minutes} min · ${PL.daysLabel(PL.schedule(d).days)}</span>
        <span class="pill">${plural(s.modules, 'module')}</span>
        <span class="pill">${s.lessonsDone}/${s.lessons} leçons</span>
        <span class="pill">${fmtMin(PL.plan(d).totalMin)} au total</span>
      </div>
      ${d.source ? `<div class="source">Source : ${esc(d.source.name)}${d.source.note ? ` · ${esc(d.source.note)}` : ''}</div>` : ''}
    </div>
    <div class="flex" style="gap:16px">
      ${ring(s.pct, d.color)}
      <div style="display:grid;gap:6px">
        <button class="btn btn-sm" data-action="import-curriculum" data-id="${d.id}">${icon('upload')}Importer un cursus</button>
        <button class="btn btn-sm btn-danger" data-action="delete-domain" data-id="${d.id}">${icon('trash')}Supprimer</button>
      </div>
    </div>
  </div>`;

  if (!d.modules.length) {
    return head + `<div class="card empty">
      <div class="em-ico">${icon('sparkle')}</div>
      <h3>Le cursus n'est pas encore construit</h3>
      <p>Demande à Claude de générer le programme « ${esc(d.name)} » sur ${fmtDuration(d.durationWeeks)}, au rythme de ${PL.schedule(d).minutes} min ${PL.daysLabel(PL.schedule(d).days)} (≈ ${fmtMin(PL.weeklyMinutes(PL.schedule(d)) * d.durationWeeks)} de travail), puis importe le fichier JSON ici. Les modules, leçons, tests et l'examen final apparaîtront automatiquement.</p>
      <button class="btn btn-primary" data-action="import-curriculum" data-id="${d.id}">${icon('upload')}Importer un cursus (.json)</button>
    </div>`;
  }

  const firstOpen = d.modules.findIndex((_, i) => !S.moduleState(d, i).done);
  const mods = d.modules.map((m, i) => {
    const ms = S.moduleState(d, i);
    const open = route.open ? route.open === i : i === (firstOpen < 0 ? 0 : firstOpen);
    const qBest = m.quiz ? S.bestScore(S.quizKey(d, m)) : null;
    return `
    <div class="card module ${ms.unlocked ? '' : 'locked'} ${open ? 'open' : ''} ${ms.done ? 'done-mod' : ''}">
      <button class="mod-head" data-toggle>
        <span class="mod-num ${ms.done ? 'done' : ''}">${ms.done ? icon('check') : String(i + 1).padStart(2, '0')}</span>
        <div style="flex:1;min-width:0"><div class="mod-title">${esc(m.title)}</div><div class="mod-sub">${esc(m.summary || '')}</div></div>
        <span class="mono dim" style="font-size:12px">${ms.lessonsDone}/${m.lessons.length}</span>
        ${ms.unlocked ? '' : `<span class="dim">${icon('lock')}</span>`}
        <span class="chev">${icon('chevron')}</span>
      </button>
      <div class="mod-body">
        ${m.lessons.map((l, j) => {
          const done = S.isLessonDone(d, l);
          return `<button class="lesson" ${ms.unlocked ? '' : 'disabled'} data-go='${JSON.stringify({ name: 'lesson', id: d.id, mi: i, li: j })}'>
            <span class="check ${done ? 'on' : ''}">${done ? icon('check') : ''}</span>
            <span class="t">${esc(l.title)}</span>${exBadge(d, l)}<span class="m">${l.minutes} min</span></button>`;
        }).join('')}
        ${m.quiz ? `<button class="lesson quiz" ${ms.quizUnlocked ? '' : 'disabled'} data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: i })}'>
          <span class="check ${ms.quizPassed ? 'on' : ''}">${ms.quizPassed ? icon('check') : ''}</span>
          <span class="t">Test de fin de module <span class="dim">· ${m.quiz.questions.length} questions</span></span>
          ${qBest !== null ? `<span class="pill ${ms.quizPassed ? 'ok' : 'ko'}">${qBest}%</span>` : ms.quizUnlocked ? `<span class="pill wait">À passer</span>` : `<span class="dim">${icon('lock')}</span>`}
        </button>` : ''}
      </div>
    </div>`;
  }).join('');

  let exam = '';
  if (d.exam) {
    const un = S.examUnlocked(d), best = S.bestScore(S.examKey(d)), ok = S.isPassed(S.examKey(d), d.exam);
    exam = `<div class="card flex between section-gap" style="padding:18px">
      <div class="flex" style="gap:14px"><span class="mod-num ${ok ? 'done' : ''}">${icon('trophy')}</span>
      <div><div class="mod-title">Examen final</div><div class="mod-sub">${d.exam.questions.length} questions · seuil de réussite ${S.passScore(d.exam)} %${best !== null ? ` · meilleur score ${best} %` : ''}</div></div></div>
      ${un ? `<button class="btn ${ok ? '' : 'btn-primary'}" data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: 'exam' })}'>${ok ? 'Repasser' : "Passer l'examen"}</button>` : `<span class="pill">${icon('lock')}Termine tous les modules</span>`}
    </div>`;
  }
  return head + planCard(d) + `<div class="timeline">${mods}</div>${exam}`;
}

function lesson() {
  const d = S.getDomain(route.id);
  const m = d?.modules[route.mi];
  const l = m?.lessons[route.li];
  if (!l) return (go({ name: 'domains' }), null);
  crumbs([{ label: 'Domaines', go: { name: 'domains' } }, { label: d.name, go: { name: 'domain', id: d.id } }, { label: l.title }]);
  const done = S.isLessonDone(d, l);
  const flat = d.modules.flatMap((mm, mi) => mm.lessons.map((_, li) => ({ mi, li })));
  const pos = flat.findIndex((x) => x.mi === route.mi && x.li === route.li);
  const prev = flat[pos - 1], next = flat[pos + 1];
  return `
  <article class="reader">
    <div class="eyebrow">Module ${route.mi + 1} · ${esc(m.title)}</div>
    <h1 class="h1" style="font-size:28px">${esc(l.title)}</h1>
    <div class="hero-meta" style="margin-bottom:26px"><span class="pill">${icon('clock')}${l.minutes} min</span><span class="pill">Leçon ${route.li + 1}/${m.lessons.length}</span>${l.audio?.length ? `<span class="pill">${icon('headphones')}${plural(l.audio.length, 'audio')}</span>` : ''}${done ? `<span class="pill ok">${icon('check')}Terminée</span>` : ''}</div>
    ${l.audio?.length ? `<div class="audio-list">${l.audio.map(audioSlot).join('')}</div>` : ''}
    <div class="prose">${l.content || '<p class="dim">Contenu à venir.</p>'}</div>
    ${l.exercise ? exerciseCard(d, l) : ''}
    <div class="reader-foot">
      ${prev ? `<button class="btn btn-ghost" data-go='${JSON.stringify({ name: 'lesson', id: d.id, ...prev })}'>${icon('left')}Précédente</button>` : '<span></span>'}
      <div class="flex">
        <button class="btn ${done ? '' : 'btn-primary'}" data-action="toggle-lesson">${done ? 'Marquer non terminée' : `${icon('check')}Marquer comme terminée`}</button>
        ${next && !(m.quiz && route.li === m.lessons.length - 1) ? `<button class="btn" data-action="next-lesson" data-next='${JSON.stringify(next)}'>Suivante${icon('right')}</button>` : m.quiz ? `<button class="btn" data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: route.mi })}' ${S.moduleState(d, route.mi).allLessons ? '' : 'disabled'}>Test du module${icon('right')}</button>` : ''}
      </div>
    </div>
  </article>`;
}

function exerciseCard(d, l) {
  const k = S.exerciseKey(d, l), best = S.bestScore(k), ok = best !== null && best >= S.passScore(l.exercise);
  return `<div class="card exercise-card">
    <div class="flex" style="gap:14px;min-width:0">
      <span class="mod-num ${ok ? 'done' : ''}">${icon(ok ? 'check' : 'exam')}</span>
      <div style="min-width:0"><div class="mod-title">Exercice d'application</div>
      <div class="mod-sub">${plural(l.exercise.questions.length, 'question')}${best !== null ? ` · meilleur score ${best} %` : ''}</div></div>
    </div>
    <button class="btn ${ok ? '' : 'btn-primary'}" data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: route.mi, li: route.li })}'>${best !== null ? 'Refaire' : "Faire l'exercice"}${icon('right')}</button>
  </div>`;
}

function quizCtx() {
  const d = S.getDomain(route.id);
  if (!d) return null;
  if (route.mi === 'exam') return d.exam ? { d, q: d.exam, key: S.examKey(d), title: 'Examen final', kind: 'exam' } : null;
  const m = d.modules[route.mi];
  if (!m) return null;
  if (route.li !== undefined) {
    const l = m.lessons[route.li];
    return l?.exercise ? { d, m, l, q: l.exercise, key: S.exerciseKey(d, l), title: `Exercice : ${l.title}`, kind: 'exercise' } : null;
  }
  return m.quiz ? { d, m, q: m.quiz, key: S.quizKey(d, m), title: m.quiz.title ? `${m.quiz.title} : ${m.title}` : `Test : ${m.title}`, kind: 'quiz' } : null;
}

function answerOk(x, a) {
  if (a === null || a === undefined) return false;
  if (x.type === 'text') return S.matchText(a, x.accept);
  return a === x.answer;
}

function quiz() {
  const c = quizCtx();
  if (!c) return (go(S.getDomain(route.id) ? { name: 'domain', id: route.id } : { name: 'domains' }), null);
  const { d, q, key, title, kind } = c;
  const back = kind === 'exercise' ? { name: 'lesson', id: d.id, mi: route.mi, li: route.li } : { name: 'domain', id: d.id };
  crumbs([{ label: 'Domaines', go: { name: 'domains' } }, { label: d.name, go: { name: 'domain', id: d.id } }, ...(kind === 'exercise' ? [{ label: c.l.title, go: back }] : []), { label: kind === 'exercise' ? 'Exercice' : title }]);
  if (!quizSession || quizSession.key !== key) quizSession = { key, answers: Array(q.questions.length).fill(null), submitted: false, pct: 0 };
  const qs = quizSession;
  const pass = S.passScore(q);
  const okMsg = { exam: 'Domaine validé. Gloire au travailleur studieux, Camarade', quiz: 'Module validé, le suivant est débloqué', exercise: 'La leçon est acquise' }[kind];

  const result = qs.submitted ? `
    <div class="card result">
      <span class="pill ${qs.pct >= pass ? 'ok' : 'ko'}">${qs.pct >= pass ? 'Réussi' : 'Pas encore'}</span>
      <div class="score" style="color:${qs.pct >= pass ? 'var(--green)' : 'var(--red)'}">${qs.pct}%</div>
      <div class="muted">${qs.correct}/${q.questions.length} bonnes réponses · seuil ${pass} %</div>
      <div class="muted" style="margin-top:6px">${qs.pct >= pass ? okMsg : 'Relis les corrections ci-dessous puis retente ta chance'}</div>
      <div class="flex" style="justify-content:center;margin-top:18px">
        <button class="btn" data-action="retry-quiz">${icon('refresh')}Recommencer</button>
        <button class="btn btn-primary" data-go='${JSON.stringify(back)}'>${kind === 'exercise' ? 'Retour à la leçon' : 'Retour au domaine'}</button>
      </div>
    </div>` : '';

  let lastSection = null;
  const items = q.questions.map((x, i) => {
    const sec = x.section && x.section !== lastSection ? `<div class="q-section">${esc(x.section)}</div>` : '';
    if (x.section) lastSection = x.section;
    const say = x.audio ? audioSay(x.audio) : '';
    const prompt = esc(x.q).replace(/_{3,}/g, '<span class="blank"></span>');
    let body;
    if (x.type === 'text') {
      const ok = qs.submitted && answerOk(x, qs.answers[i]);
      body = `<input class="answer ${qs.submitted ? (ok ? 'right' : 'wrong') : ''}" data-text="${i}" value="${esc(qs.answers[i] ?? '')}" placeholder="Ta réponse…" autocomplete="off" spellcheck="false" ${qs.submitted ? 'disabled' : ''}>
        ${qs.submitted && !ok ? `<div class="explain">${icon('check', 'ok-ico')} ${x.accept.map(esc).join(' <span class="dim">ou</span> ')}</div>` : ''}`;
    } else {
      body = `<div class="choices ${qs.submitted ? 'locked' : ''}">
        ${x.choices.map((ch, j) => {
          let cls = qs.answers[i] === j ? 'sel' : '';
          if (qs.submitted) cls = j === x.answer ? 'right' : qs.answers[i] === j ? 'wrong' : '';
          return `<button class="choice ${cls}" data-choice="${i}:${j}"><span class="radio"></span>${esc(ch)}</button>`;
        }).join('')}
      </div>`;
    }
    return `${sec}<div class="card q">
      <div class="q-title"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="q-text">${prompt}</span>${say}</div>
      ${body}
      ${qs.submitted && x.explain ? `<div class="explain">${icon('info', 'dim')} ${esc(x.explain)}</div>` : ''}
    </div>`;
  }).join('');

  const answered = qs.answers.filter((a) => a !== null && a !== '').length;
  const intro = q.intro ? `<div class="note-card prose">${q.intro}</div>` : '';
  return `
  <div class="reader">
    <div class="eyebrow"><span style="color:${d.color}">●</span> ${esc(d.name)}</div>
    <h1 class="h1" style="font-size:28px">${esc(title)}</h1>
    <div class="sub" style="margin-bottom:22px">${q.questions.length} questions · réussite à ${pass} %${S.bestScore(key) !== null ? ` · meilleur score ${S.bestScore(key)} %` : ''}</div>
    ${result}${intro}${items}
    ${qs.submitted ? '' : `<div class="quiz-bar"><span class="muted mono" style="font-size:12px" id="answeredCount">${answered}/${q.questions.length} répondues</span>
      <button class="btn btn-primary" data-action="submit-quiz" ${answered === q.questions.length ? '' : 'disabled'}>Valider mes réponses</button></div>`}
  </div>`;
}

function examList() {
  const out = [];
  state.domains.forEach((d) => {
    d.modules.forEach((m, i) => {
      if (!m.quiz) return;
      const k = S.quizKey(d, m), ms = S.moduleState(d, i);
      out.push({ d, label: `Module ${i + 1} · ${m.title}`, kind: 'Test', key: k, q: m.quiz, available: ms.quizUnlocked, passed: ms.quizPassed, best: S.bestScore(k), tries: (state.progress.attempts[k] || []).length, go: { name: 'quiz', id: d.id, mi: i } });
    });
    if (d.exam) {
      const k = S.examKey(d);
      out.push({ d, label: 'Examen final', kind: 'Examen', key: k, q: d.exam, available: S.examUnlocked(d), passed: S.isPassed(k, d.exam), best: S.bestScore(k), tries: (state.progress.attempts[k] || []).length, go: { name: 'quiz', id: d.id, mi: 'exam' } });
    }
  });
  return out;
}

function exams() {
  crumbs([{ label: 'Examens' }]);
  const list = examList();
  return `
  <div class="page-head"><div><div class="eyebrow">Évaluations</div><h1 class="h1">Tests & examens</h1>
  <div class="sub">Un test clôt chaque module, un examen final valide le domaine</div></div></div>
  <div class="card">${list.length ? `<table class="tbl"><thead><tr><th>Domaine</th><th>Épreuve</th><th>Type</th><th>Statut</th><th class="num">Essais</th><th class="num">Meilleur</th></tr></thead><tbody>
    ${list.map((e) => `<tr class="${e.available ? 'click' : ''}" ${e.available ? `data-go='${JSON.stringify(e.go)}'` : ''}>
      <td><span class="flex"><span class="cdot" style="color:${e.d.color}"></span>${esc(e.d.name)}</span></td>
      <td>${esc(e.label)}</td><td class="muted">${e.kind}</td>
      <td>${e.passed ? '<span class="pill ok">Réussi</span>' : e.available ? '<span class="pill wait">Disponible</span>' : `<span class="pill">${icon('lock')}Verrouillé</span>`}</td>
      <td class="num muted">${e.tries}</td><td class="num">${e.best !== null ? e.best + ' %' : '—'}</td></tr>`).join('')}
  </tbody></table>` : emptyBlock('exam', 'Aucune épreuve', 'Les tests apparaîtront dès que tes domaines auront un cursus.')}</div>`;
}

function progress() {
  crumbs([{ label: 'Progression' }]);
  const days = 7 * 18;
  const start = new Date(); start.setDate(start.getDate() - days + 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells = [];
  for (const d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
    const v = state.progress.log[S.today(d)];
    const t = v ? Object.values(v).reduce((a, b) => a + b, 0) : 0;
    const l = t === 0 ? 0 : t < 15 ? 1 : t < 30 ? 2 : t < 60 ? 3 : 4;
    cells.push(`<i data-l="${l}" title="${d.toLocaleDateString('fr-FR')} · ${t} min"></i>`);
  }
  const attempts = Object.entries(state.progress.attempts).flatMap(([k, arr]) => arr.map((a) => ({ k, ...a }))).sort((a, b) => b.date - a.date).slice(0, 12);
  const label = (k) => {
    const [did, mid, t] = k.split('/');
    const d = S.getDomain(did);
    if (!d) return { d: null, t: k };
    if (mid === 'exam') return { d, t: 'Examen final' };
    const m = d.modules.find((x) => x.id === mid);
    return { d, t: m ? `Test · ${m.title}` : t };
  };
  return `
  <div class="page-head"><div><div class="eyebrow">Suivi</div><h1 class="h1">Progression</h1>
  <div class="sub">${fmtMin(minutesSince(365))} d'étude cette année · série actuelle ${plural(S.streak(), 'jour')}</div></div></div>
  <div class="card"><div class="flex between" style="margin-bottom:14px"><div class="h2">Activité</div>
    <div class="flex dim" style="font-size:11px;gap:4px">Moins <span class="heat" style="grid-template-rows:13px"><i></i><i data-l="1"></i><i data-l="2"></i><i data-l="3"></i><i data-l="4"></i></span> Plus</div></div>
    <div class="heat">${cells.join('')}</div></div>

  <div class="split section-gap">
    <div class="card"><div class="h2" style="margin-bottom:8px">Par domaine</div><div class="list">
      ${state.domains.map((d) => { const s = S.domainStats(d); return `<button class="row" data-domain="${d.id}" style="width:100%;text-align:left">
        <div class="dc-icon" style="color:${d.color};width:32px;height:32px">${icon(d.icon)}</div>
        <div class="row-main"><div class="flex between"><span class="row-title">${esc(d.name)}</span><span class="row-end">${s.pct}%</span></div>
        <div class="row-sub">${s.lessonsDone}/${s.lessons} leçons · ${plural(s.modules, 'module')} · ${PL.schedule(d).minutes} min ${PL.daysLabel(PL.schedule(d).days)}</div>${bar(s.pct, d.color)}</div></button>`; }).join('') || '<div class="dim">Aucun domaine.</div>'}
    </div></div>
    <div class="card"><div class="h2" style="margin-bottom:8px">Derniers résultats</div><div class="list">
      ${attempts.length ? attempts.map((a) => { const L = label(a.k); return `<div class="row">
        <span class="cdot" style="color:${L.d?.color || '#555'}"></span>
        <div class="row-main"><div class="row-title">${esc(L.t)}</div><div class="row-sub">${esc(L.d?.name || '')} · ${new Date(a.date).toLocaleDateString('fr-FR')}</div></div>
        <span class="row-end" style="color:${a.pct >= 70 ? 'var(--green)' : 'var(--red)'}">${a.pct}%</span></div>`; }).join('') : '<div class="dim" style="padding:10px 0">Aucun test passé pour l\'instant.</div>'}
    </div></div>
  </div>`;
}

function settings() {
  crumbs([{ label: 'Paramètres' }]);
  const size = new Blob([JSON.stringify(state)]).size;
  return `
  <div class="page-head"><div><div class="eyebrow">Application</div><h1 class="h1">Paramètres</h1></div></div>
  <div class="grid" style="max-width:760px">
    <div class="card"><div class="h2">Sauvegarde</div>
      <div class="muted" style="margin:6px 0 14px">Tes domaines et ta progression sont stockés localement sur ce PC (${(size / 1024).toFixed(1)} Ko). Exporte régulièrement une sauvegarde.</div>
      <div class="flex"><button class="btn" data-action="export">${icon('download')}Exporter (.json)</button><button class="btn" data-action="import-all">${icon('upload')}Restaurer une sauvegarde</button></div></div>
    <div class="card"><div class="h2">Format d'un cursus</div>
      <div class="muted" style="margin:6px 0 12px">Un cursus importé dans un domaine est un fichier JSON :</div>
      <pre class="mono" style="margin:0;font-size:11.5px;line-height:1.6;color:var(--text-2);background:#101012;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto">{
  "modules": [{
    "title": "Les bases", "summary": "…", "week": 1,
    "lessons": [{
      "title": "…", "minutes": 12, "content": "&lt;p&gt;HTML&lt;/p&gt;",
      "audio": [{ "title": "Dialogue", "src": "audio/anglais/m1-l1.mp3" }],
      "exercise": { "intro": "&lt;p&gt;Consigne&lt;/p&gt;", "questions": [ … ] }
    }],
    "quiz": { "passScore": 70, "questions": [
      { "q": "…", "choices": ["a","b","c"], "answer": 1, "explain": "…" },
      { "type": "text", "q": "She ____ (be) happy.", "accept": ["is", "'s"] }
    ]}
  }],
  "exam": { "passScore": 75, "questions": [ … ] }
}</pre></div>
    <div class="card"><div class="h2">Zone sensible</div>
      <div class="muted" style="margin:6px 0 14px">Efface toute la progression et les domaines, puis réinstalle le cours d'anglais.</div>
      <button class="btn btn-danger" data-action="reset">${icon('trash')}Tout réinitialiser</button></div>
    <div class="dim mono" style="font-size:11px;padding:4px 2px">Neurone v0.1.0</div>
  </div>`;
}

function emptyBlock(ico, title, text) {
  return `<div class="empty"><div class="em-ico">${icon(ico)}</div><h3>${title}</h3><p>${text}</p></div>`;
}

/* ---------------- Modals & toasts ---------------- */
function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span style="color:${ok ? 'var(--green)' : 'var(--red)'}">${icon(ok ? 'check' : 'info')}</span>${esc(msg)}`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2600);
}

function openModal(html, onMount) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal" role="dialog">${html}</div>`;
  root.hidden = false;
  onMount?.(root.firstElementChild);
}
function closeModal() { $('#modalRoot').hidden = true; $('#modalRoot').innerHTML = ''; }

function confirmModal(title, text, label, fn) {
  openModal(`<div class="modal-head"><div class="h2">${title}</div></div><div class="modal-body"><div class="muted">${text}</div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-danger" id="okBtn">${label}</button></div>`,
  (m) => { $('#okBtn', m).onclick = () => { closeModal(); fn(); }; });
}

function rhythmFields(sc) {
  return `<div class="field rhythm"><label>Ton rythme</label>
    <div class="rh-row">
      <div class="rh-min"><input id="rMin" type="number" min="5" max="480" step="5" value="${sc.minutes}"><span>min / jour</span></div>
      <div class="chips" id="rChips">${[15, 25, 45, 60, 90].map((v) => `<button data-v="${v}" class="${v === sc.minutes ? 'on' : ''}">${v}</button>`).join('')}</div>
    </div>
    <div class="days" id="rDays">${[1, 2, 3, 4, 5, 6, 0].map((x) => `<button data-v="${x}" class="${sc.days.includes(x) ? 'on' : ''}" title="${PL.DAY_NAMES[x]}">${PL.DAY_SHORT[x]}</button>`).join('')}</div>
    <div class="rh-sum" id="rSum"></div>
  </div>`;
}

function bindRhythm(m, sc, extra) {
  const sum = () => {
    const w = PL.weeklyMinutes(sc);
    $('#rSum', m).innerHTML = sc.days.length ? `<strong>${fmtMin(w)}</strong> par semaine · ${PL.daysLabel(sc.days)}${extra ? extra(sc) : ''}` : '<span class="warn">Choisis au moins un jour</span>';
  };
  $('#rMin', m).addEventListener('input', (e) => {
    sc.minutes = Math.max(5, Math.min(480, parseInt(e.target.value, 10) || 5));
    $('#rChips', m).querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.v === sc.minutes));
    sum();
  });
  $('#rChips', m).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sc.minutes = +b.dataset.v; $('#rMin', m).value = sc.minutes;
    $('#rChips', m).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    sum();
  });
  $('#rDays', m).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const v = +b.dataset.v;
    sc.days = sc.days.includes(v) ? sc.days.filter((x) => x !== v) : [...sc.days, v];
    b.classList.toggle('on', sc.days.includes(v));
    sum();
  });
  sum();
  return sum;
}

function rhythmModal(d) {
  const sc = { minutes: PL.schedule(d).minutes, days: [...PL.schedule(d).days] };
  const p = PL.plan(d);
  openModal(`
    <div class="modal-head"><div class="h2">Rythme · ${esc(d.name)}</div><div class="muted" style="margin-top:4px">Le planning et la date de fin seront recalculés à partir d'aujourd'hui</div></div>
    <div class="modal-body">${rhythmFields(sc)}</div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="rSave">Enregistrer</button></div>`,
  (m) => {
    bindRhythm(m, sc, (x) => (p.remainingMin && x.days.length ? ` · reste ${fmtMin(p.remainingMin)}, soit ~${Math.ceil(p.remainingMin / x.minutes)} séances` : ''));
    $('#rSave', m).onclick = () => {
      if (!sc.days.length) return toast('Choisis au moins un jour', false);
      d.schedule = { minutes: sc.minutes, days: sc.days, target: null };
      PL.ensureTarget(d); S.save(); closeModal();
      toast('Rythme mis à jour'); render();
    };
  });
}

function newDomainModal() {
  const f = { color: COLORS[state.domains.length % COLORS.length], icon: 'book', level: 'Débutant', unit: 'mois' };
  openModal(`
    <div class="modal-head"><div class="h2">Nouveau domaine</div><div class="muted" style="margin-top:4px">Choisis ton rythme, puis un cours de la bibliothèque ou un domaine à construire</div></div>
    <div class="modal-body">
      ${rhythmFields(PL.DEFAULT_SCHEDULE)}
      ${catalog.length ? `<div class="field"><label>Depuis la bibliothèque</label><div class="lib">${catalog.map((c) => {
        const has = state.domains.some((d) => d.courseId === c.id);
        return `<div class="lib-item"><div class="dc-icon" style="color:${c.color}">${icon(c.icon)}</div>
          <div style="flex:1;min-width:0"><div class="row-title">${esc(c.name)} <span class="dim">· ${esc(c.level)}</span></div><div class="row-sub">${plural(c.modules, 'module')} · ${c.lessons} leçons</div></div>
          <button class="btn btn-sm" data-lib="${c.id}" ${has ? 'disabled' : ''}>${has ? 'Déjà ajouté' : 'Ajouter'}</button></div>`;
      }).join('')}</div></div><div class="or"><span>ou crée un domaine personnalisé</span></div>` : ''}
      <div class="field"><label>Nom du domaine</label><input id="fName" maxlength="40" placeholder="Ex. Anglais, Philosophie, Python…"><div class="err" id="fErr" hidden>Donne un nom à ce domaine.</div></div>
      <div class="field"><label>Objectif</label><textarea id="fGoal" maxlength="200" placeholder="Ex. Atteindre un niveau B2 et suivre une série sans sous-titres."></textarea></div>
      <div class="row2">
        <div class="field"><label>Durée</label><div class="flex"><input id="fDur" type="number" min="1" max="52" value="3" style="width:80px">
          <div class="seg" id="fUnit" style="flex:1"><button data-v="semaines">Semaines</button><button data-v="mois" class="on">Mois</button></div></div></div>
        <div class="field"><label>Niveau de départ</label><div class="seg" id="fLevel"><button class="on" data-v="Débutant">Débutant</button><button data-v="Intermédiaire">Inter.</button><button data-v="Avancé">Avancé</button></div></div>
      </div>
      <div class="field"><label>Couleur</label><div class="swatches" id="fColor">${COLORS.map((c) => `<button class="swatch ${c === f.color ? 'on' : ''}" data-v="${c}" style="background:${c};color:${c}"></button>`).join('')}</div></div>
      <div class="field"><label>Icône</label><div class="icons-pick" id="fIcon">${DOMAIN_ICONS.map((i) => `<button data-v="${i}" class="${i === f.icon ? 'on' : ''}">${icon(i)}</button>`).join('')}</div></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="fCreate">Créer le domaine</button></div>`,
  (m) => {
    const sc = { minutes: PL.DEFAULT_SCHEDULE.minutes, days: [...PL.DEFAULT_SCHEDULE.days] };
    const durWeeks = () => { const n = Math.max(1, Math.min(52, parseInt($('#fDur', m).value, 10) || 1)); return f.unit === 'mois' ? n * 4 : n; };
    const refresh = bindRhythm(m, sc, (x) => ` · <span class="dim">domaine personnalisé : ${fmtMin(PL.weeklyMinutes(x) * durWeeks())} au total</span>`);
    $('#fDur', m).addEventListener('input', refresh);
    $('#fUnit', m).addEventListener('click', () => setTimeout(refresh));
    const okDays = () => { if (!sc.days.length) { toast('Choisis au moins un jour', false); return false; } return true; };
    const pick = (id, k) => $(id, m).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $(id, m).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      f[k] = b.dataset.v;
    });
    pick('#fUnit', 'unit'); pick('#fLevel', 'level'); pick('#fColor', 'color'); pick('#fIcon', 'icon');
    if (!catalog.length) $('#fName', m).focus();
    const create = () => {
      const name = $('#fName', m).value.trim();
      if (!okDays()) return;
      if (!name) { $('#fErr', m).hidden = false; if (!catalog.length) $('#fName', m).focus(); return; }
      const n = Math.max(1, Math.min(52, parseInt($('#fDur', m).value, 10) || 1));
      const d = {
        id: S.uid(), name, goal: $('#fGoal', m).value.trim(), description: '', color: f.color, icon: f.icon, level: f.level,
        durationWeeks: f.unit === 'mois' ? n * 4 : n, createdAt: Date.now(), modules: [], exam: null,
        schedule: { minutes: sc.minutes, days: [...sc.days], target: null }
      };
      state.domains.push(d); S.save(); closeModal();
      toast(`Domaine « ${name} » créé`);
      go({ name: 'domain', id: d.id });
    };
    $('#fCreate', m).onclick = create;
    m.querySelectorAll('[data-lib]').forEach((b) => (b.onclick = async () => {
      if (!okDays()) return;
      b.disabled = true; b.textContent = 'Ajout…';
      try {
        const d = await addCourse(catalog.find((c) => c.id === b.dataset.lib), { minutes: sc.minutes, days: [...sc.days] });
        closeModal(); toast(`« ${d.name} » ajouté`); go({ name: 'domain', id: d.id });
      } catch (e) { toast('Impossible de charger ce cours', false); b.disabled = false; b.textContent = 'Ajouter'; }
    }));
    $('#fName', m).addEventListener('keydown', (e) => e.key === 'Enter' && create());
  });
}

let fileHandler = null;
function pickFile(fn) { fileHandler = fn; $('#fileInput').value = ''; $('#fileInput').click(); }
$('#fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file || !fileHandler) return;
  try { fileHandler(await file.text()); } catch (err) { toast(err.message || 'Fichier illisible', false); }
});

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- Actions ---------------- */
const actions = {
  'new-domain': newDomainModal,
  'edit-rhythm': (el) => rhythmModal(S.getDomain(el.dataset.id)),
  'delete-domain': (el) => {
    const d = S.getDomain(el.dataset.id);
    confirmModal('Supprimer ce domaine ?', `« ${esc(d.name)} » et toute sa progression seront supprimés définitivement.`, 'Supprimer', () => {
      S.deleteDomain(d.id); toast('Domaine supprimé'); go({ name: 'domains' });
    });
  },
  'import-curriculum': (el) => pickFile((text) => {
    const d = S.getDomain(el.dataset.id);
    const c = S.normalizeCurriculum(JSON.parse(text));
    const apply = () => { d.modules = c.modules; d.exam = c.exam; d.demo = false; S.save(); toast(`Cursus importé : ${plural(c.modules.length, 'module')}`); render(); };
    d.modules.length ? confirmModal('Remplacer le cursus ?', 'Le cursus actuel de ce domaine sera remplacé. La progression des leçons ayant le même identifiant est conservée.', 'Remplacer', apply) : apply();
  }),
  'toggle-lesson': () => {
    const d = S.getDomain(route.id), l = d.modules[route.mi].lessons[route.li];
    const was = S.isLessonDone(d, l);
    S.setLessonDone(d, l, !was);
    if (!was) toast('Leçon terminée');
    render();
  },
  'next-lesson': (el) => {
    const d = S.getDomain(route.id), l = d.modules[route.mi].lessons[route.li];
    if (!S.isLessonDone(d, l)) S.setLessonDone(d, l, true);
    const n = JSON.parse(el.dataset.next);
    if (!S.moduleState(d, n.mi).unlocked) { toast('Réussis le test du module pour débloquer la suite', false); return go({ name: 'quiz', id: d.id, mi: route.mi }); }
    go({ name: 'lesson', id: d.id, ...n });
  },
  'submit-quiz': () => {
    const c = quizCtx();
    if (!c) return;
    const qs = quizSession;
    qs.correct = c.q.questions.filter((x, i) => answerOk(x, qs.answers[i])).length;
    qs.pct = S.recordAttempt(qs.key, c.d.id, qs.correct, c.q.questions.length);
    qs.submitted = true;
    render();
    $('#view').scrollTo({ top: 0, behavior: 'smooth' });
  },
  'retry-quiz': () => { quizSession = null; render(); $('#view').scrollTop = 0; },
  export: () => { download(`neurone-sauvegarde-${S.today()}.json`, S.exportAll()); toast('Sauvegarde exportée'); },
  'import-all': () => pickFile((text) => confirmModal('Restaurer cette sauvegarde ?', 'Tes données actuelles seront remplacées par celles du fichier.', 'Restaurer', () => {
    try { S.importAll(text); toast('Sauvegarde restaurée'); go({ name: 'overview' }); } catch (e) { toast(e.message, false); }
  })),
  reset: () => confirmModal('Tout réinitialiser ?', 'Toute ta progression et tes domaines seront effacés. Exporte une sauvegarde avant si besoin.', 'Réinitialiser', () => {
    S.resetAll(); seed().finally(() => { toast('Application réinitialisée'); go({ name: 'overview' }); });
  })
};

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-close]') || t.id === 'modalRoot') return closeModal();
  const a = t.closest('[data-action]');
  if (a && !a.disabled) return actions[a.dataset.action]?.(a);
  const c = t.closest('[data-choice]');
  if (c && quizSession && !quizSession.submitted) {
    const [i, j] = c.dataset.choice.split(':').map(Number);
    quizSession.answers[i] = j;
    const top = $('#view').scrollTop; render(); $('#view').scrollTop = top;
    return;
  }
  const tg = t.closest('[data-toggle]');
  if (tg) return tg.parentElement.classList.toggle('open');
  const g = t.closest('[data-go]');
  if (g && !g.disabled) return go(JSON.parse(g.dataset.go));
  const n = t.closest('[data-nav]');
  if (n) return go({ name: n.dataset.nav });
  const dm = t.closest('[data-domain]');
  if (dm) return go({ name: 'domain', id: dm.dataset.domain });
});

document.addEventListener('input', (e) => {
  const t = e.target.closest('[data-text]');
  if (!t || !quizSession || quizSession.submitted) return;
  quizSession.answers[+t.dataset.text] = t.value.trim() === '' ? null : t.value;
  const n = quizSession.answers.filter((a) => a !== null && a !== '').length;
  const cnt = $('#answeredCount');
  if (cnt) cnt.textContent = `${n}/${quizSession.answers.length} répondues`;
  const btn = $('[data-action="submit-quiz"]');
  if (btn) btn.disabled = n !== quizSession.answers.length;
});
document.addEventListener('keydown', (e) => {
  const t = e.target.closest?.('[data-text]');
  if (!t || e.key !== 'Enter') return;
  e.preventDefault();
  const all = [...document.querySelectorAll('[data-text]')];
  const next = all[all.indexOf(t) + 1];
  if (next) next.focus(); else $('[data-action="submit-quiz"]')?.click();
});

/* ---------------- Search ---------------- */
const sInput = $('#searchInput'), sBox = $('#searchResults');
let sIdx = 0, sItems = [];
function runSearch() {
  const q = sInput.value.trim().toLowerCase();
  if (!q) { sBox.hidden = true; return; }
  sItems = [];
  state.domains.forEach((d) => {
    if (d.name.toLowerCase().includes(q)) sItems.push({ label: d.name, sub: 'Domaine', color: d.color, go: { name: 'domain', id: d.id } });
    d.modules.forEach((m, mi) => m.lessons.forEach((l, li) => {
      if (l.title.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)) sItems.push({ label: l.title, sub: `${d.name} · ${m.title}`, color: d.color, go: { name: 'lesson', id: d.id, mi, li } });
    }));
  });
  sItems = sItems.slice(0, 8); sIdx = 0;
  sBox.innerHTML = sItems.length ? sItems.map((it, i) => `<button class="sr-item ${i === sIdx ? 'active' : ''}" data-si="${i}"><span class="cdot" style="color:${it.color}"></span><span>${esc(it.label)}<small>${esc(it.sub)}</small></span></button>`).join('') : `<div class="sr-empty">Aucun résultat</div>`;
  sBox.hidden = false;
}
function pickSearch(i) { const it = sItems[i]; if (!it) return; sInput.value = ''; sBox.hidden = true; sInput.blur(); go(it.go); }
sInput.addEventListener('input', runSearch);
sInput.addEventListener('focus', () => { if (state.settings.collapsed) toggleSidebar(); runSearch(); });
sInput.addEventListener('blur', () => setTimeout(() => (sBox.hidden = true), 150));
sInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!sItems.length) return;
    sIdx = (sIdx + (e.key === 'ArrowDown' ? 1 : -1) + sItems.length) % sItems.length;
    sBox.querySelectorAll('.sr-item').forEach((b, i) => b.classList.toggle('active', i === sIdx));
  } else if (e.key === 'Enter') pickSearch(sIdx);
  else if (e.key === 'Escape') { sInput.value = ''; sBox.hidden = true; sInput.blur(); }
});
sBox.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-si]'); if (b) { e.preventDefault(); pickSearch(+b.dataset.si); } });

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); sInput.focus(); sInput.select(); }
  if (e.key === 'Escape' && !$('#modalRoot').hidden) closeModal();
});

/* ---------------- Sidebar ---------------- */
function toggleSidebar() {
  state.settings.collapsed = !state.settings.collapsed;
  $('#app').classList.toggle('collapsed', state.settings.collapsed);
  S.save();
}

$('#brandMark').outerHTML = BRAND;
$('#collapseBtn').innerHTML = icon('sidebar');
$('#collapseBtn').onclick = toggleSidebar;
$('.search-ico').innerHTML = icon('search');
$('#addDomainSide').innerHTML = icon('plus');
$('#addDomainSide').dataset.action = 'new-domain';
$('#app').classList.toggle('collapsed', !!state.settings.collapsed);

async function loadCatalog() {
  try { catalog = await (await fetch('courses/index.json')).json(); } catch { catalog = []; }
}

async function addCourse(entry, sc) {
  const course = await (await fetch(entry.file)).json();
  const d = S.domainFromCourse(course);
  d.schedule = { ...(sc || PL.DEFAULT_SCHEDULE), days: [...(sc || PL.DEFAULT_SCHEDULE).days], target: null };
  PL.ensureTarget(d);
  state.domains.push(d);
  S.save();
  return d;
}

async function seed() {
  if (state.seeded !== false) return;
  const first = catalog.find((c) => c.id === 'anglais-debutant');
  try { if (first) await addCourse(first); } catch (e) { console.error(e); }
  state.seeded = true;
  S.save();
}

initWindow();
loadCatalog().then(seed).finally(render);
