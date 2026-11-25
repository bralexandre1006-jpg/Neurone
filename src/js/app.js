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
const fmtMin = (v) => { const m = Math.round(v); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const fmtDate = (k, opt = { day: 'numeric', month: 'long' }) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', opt);
const fmtDuration = (w) => (w % 4 === 0 && w >= 8 ? plural(w / 4, 'mois').replace('moiss', 'mois') : plural(w, 'semaine'));

let route = { name: 'home' };
let catalog = [];
let quizSession = null;
let subnavClosed = false;
let recallSet = null;
let recallScope = 'all';

/* ---------------- Navigation ---------------- */
function go(r) {
  if (r.name === 'domains' || r.name === 'overview' || r.name === 'progress' || r.name === 'exams') r = { name: 'home' };
  if (r.name === 'recall') recallSet = recallSet && r.keep ? recallSet : null;
  route = r;
  stopAudio();
  closeMenu();
  if (r.name !== 'quiz') quizSession = null;
  render();
  $('#view').scrollTop = 0;
}

const HOME = { name: 'home' };

function currentLevel(d) {
  const ms = S.groupMembers(d).filter(S.isUnlocked);
  return ms.find((x) => S.domainStats(x).pct < 100) || ms[ms.length - 1] || d;
}

function visibleDomains() {
  const seen = new Set(), out = [];
  for (const d of state.domains) {
    if (!d.group) { out.push(d); continue; }
    if (seen.has(d.group)) continue;
    seen.add(d.group);
    out.push(currentLevel(d));
  }
  return out;
}

const sameGroup = (a, b) => !!a && !!b && (a.id === b.id || (!!a.group && a.group === b.group));

function avatarHTML(size = 30) {
  const p = state.profile;
  const initial = esc((p.name || 'C').trim().charAt(0).toUpperCase() || 'C');
  return p.avatar
    ? `<img class="avatar-img" src="${p.avatar}" alt="" style="width:${size}px;height:${size}px">`
    : `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${initial}</span>`;
}

function renderSidebar() {
  const inDomain = ['domain', 'lesson', 'quiz'].includes(route.name);
  $('#nav').innerHTML = `
    <button class="nav-item ${route.name === 'home' ? 'active' : ''}" data-nav="home" title="Accueil">${icon('home')}<span class="label">Accueil</span></button>
    <button class="nav-item ${route.name === 'recall' || route.mi === 'recall' ? 'active' : ''}" data-nav="recall" title="Rappel">${icon('brain')}<span class="label">Rappel</span></button>`;
  const cur = S.getDomain(route.id);
  $('#domainNav').innerHTML = state.domains.length
    ? visibleDomains().map((d) => `
      <button class="nav-item ${inDomain && sameGroup(cur, d) ? 'active' : ''}" data-domain="${d.id}" title="${esc(d.name)}${d.group ? ' · ' + esc(d.level) : ''}">
        <span class="dom-ico" style="color:${d.color}">${icon(d.icon)}</span><span class="label">${esc(d.name)}</span>
        <span class="pct">${S.domainStats(d).pct}%</span>
      </button>${inDomain && sameGroup(cur, d) && cur.modules.length && !subnavClosed ? `<div class="subnav">${tabsFor(cur).map((t) => `<button class="nav-item ${route.name === 'domain' && (route.tab || 'parcours') === t.id ? 'active' : ''}" data-go='${JSON.stringify({ name: 'domain', id: cur.id, tab: t.id })}'>${icon(t.ico)}<span class="label">${t.label}</span></button>`).join('')}</div>` : ''}`).join('')
    : `<button class="nav-item" data-action="new-domain">${icon('plus')}<span class="label">Ajouter un domaine</span></button>`;
  $('#navBottom').innerHTML = `
    <button class="nav-item ${route.name === 'settings' ? 'active' : ''}" data-nav="settings" title="Paramètres">${icon('settings')}<span class="label">Paramètres</span></button>`;
  $('#profileAvatar').innerHTML = avatarHTML(30);
  $('#profileName').textContent = state.profile.name || 'Camarade';
  const st = S.streak();
  $('#streakLabel').textContent = st ? `Série de ${plural(st, 'jour')}` : 'Aucune série en cours';
}

function crumbs(items) {
  $('#crumbs').innerHTML = items.map((it, i) => {
    const last = i === items.length - 1;
    const sep = i ? `<span class="sep">${icon('chevron')}</span>` : '';
    if (last) return `${sep}<span class="cur" data-tauri-drag-region>${esc(it.label)}</span>`;
    return `${sep}<button data-go='${JSON.stringify(it.go)}'>${esc(it.label)}</button>`;
  }).join('');
}

/* ---------------- Views ---------------- */
function render() {
  PL.resetCache();
  renderSidebar();
  const views = { home, domain, lesson, quiz, settings, recall };
  const fn = views[route.name] || home;
  const html = fn();
  if (html === null) return;
  $('#view').innerHTML = `<div class="view-inner">${html}</div>`;
  hydrateAudio($('#view'));
  requestAnimationFrame(onViewScroll);
  requestAnimationFrame(() => document.querySelectorAll('[data-w]').forEach((el) => (el.style.width = el.dataset.w + '%')));
}

function statCard(title, ico, val, foot) {
  return `<div class="card stat"><div class="card-title">${icon(ico)}${title}</div><div class="stat-val">${val}</div><div class="stat-foot">${foot}</div></div>`;
}

function bar(pct, color) {
  return `<div class="bar" style="color:${color}"><i data-w="${pct}" style="width:0"></i></div>`;
}

function nextStep(d) {
  const s = S.domainStats(d);
  const started = s.lessonsDone > 0 || Object.keys(state.progress.attempts).some((k) => k.startsWith(d.id + '/'));
  const n = S.nextLesson(d);
  if (!d.modules.length) return { empty: true };
  if (!n) {
    const done = s.pct === 100;
    return { label: done ? 'Revoir' : 'Ouvrir', title: done ? 'Domaine terminé' : 'Tout est à jour', sub: done ? 'Toutes les leçons, tests et l\'examen sont validés' : 'Termine les tests en attente pour avancer', go: { name: 'domain', id: d.id, tab: 'parcours' }, done };
  }
  if (n.type === 'lesson') {
    return { label: started ? 'Reprendre' : 'Commencer', title: n.lesson.title, sub: `Module ${n.mi + 1} · ${n.module.title} · ${n.lesson.minutes} min`, go: { name: 'lesson', id: d.id, mi: n.mi, li: n.module.lessons.indexOf(n.lesson) } };
  }
  if (n.type === 'quiz') {
    return { label: 'Passer le test', title: n.module.quiz.title || `Test : ${n.module.title}`, sub: `Module ${n.mi + 1} · ${n.module.quiz.questions.length} questions · réussite à ${S.passScore(n.module.quiz)} %`, go: { name: 'quiz', id: d.id, mi: n.mi } };
  }
  return { label: "Passer l'examen", title: 'Examen final', sub: `${d.exam.questions.length} questions · réussite à ${S.passScore(d.exam)} %`, go: { name: 'quiz', id: d.id, mi: 'exam' } };
}

function home() {
  crumbs([{ label: 'Accueil' }]);
  const now = new Date();
  const st = S.streak();
  const week = minutesSince(7);
  return `
  <div class="page-head">
    <div>
      <div class="who-row">${avatarHTML(22)}<span>${esc(state.profile.name || 'Camarade')}</span></div>
      <h1 class="h1">Aujourd'hui</h1>
      <div class="sub">${now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${st ? `série de ${plural(st, 'jour')}` : 'pas encore de série'} · ${fmtMin(week)} d'étude cette semaine</div>
    </div>
    <button class="btn" data-action="new-domain">${icon('plus')}Nouveau domaine</button>
  </div>
  <div class="home-grid">
    <section>
      <div class="section-title">Mes domaines</div>
      <div class="dlist">
        ${visibleDomains().map(homeDomainCard).join('')}
        <button class="card new-row" data-action="new-domain"><span class="plus">${icon('plus')}</span><span><b>Nouveau domaine</b><small>Depuis la bibliothèque ou à construire</small></span></button>
      </div>
    </section>
    <section>
      <div class="section-title">Séance du jour</div>
      <div class="card today">${todayCard()}</div>
    </section>
  </div>`;
}

function homeDomainCard(d) {
  const s = S.domainStats(d);
  const n = nextStep(d);
  const p = d.modules.length ? PL.plan(d) : null;
  return `
  <div class="card dcard" data-domain="${d.id}">
    <div class="dcard-top">
      <div class="dc-icon" style="color:${d.color}">${icon(d.icon)}</div>
      <div class="dcard-name"><div class="dc-name">${esc(d.name)}</div><div class="dim" style="font-size:12px">${esc(d.level)}${p && p.end && !p.finished ? ` · fin prévue le ${fmtDate(p.end, { day: 'numeric', month: 'short' })}` : ''}</div></div>
      <div class="dcard-pct mono">${s.pct}%</div>
    </div>
    ${bar(s.pct, d.color)}
    ${n.empty
      ? `<div class="dcard-next"><div><div class="dim" style="font-size:12px">Cursus à construire</div><div class="next-title">Importe un cursus pour commencer</div></div>
         <button class="btn btn-sm" data-go='${JSON.stringify({ name: 'domain', id: d.id })}'>Ouvrir</button></div>`
      : `<div class="dcard-next"><div style="min-width:0"><div class="dim" style="font-size:12px">${n.done ? 'Terminé' : 'Prochaine étape'}</div><div class="next-title">${esc(n.title)}</div><div class="dim next-sub">${esc(n.sub)}</div></div>
         <button class="btn ${n.done ? '' : 'btn-primary'}" data-go='${JSON.stringify(n.go)}'>${n.label}${icon('right')}</button></div>`}
  </div>`;
}

const TYPE_ICO = { lesson: 'book', quiz: 'exam', exam: 'trophy' };

function todayRows(list) {
  const todayK = S.today();
  const rows = [];
  let plannedMin = 0, doneMin = 0, nextK = null;
  list.filter((d) => d.modules.length).forEach((d) => {
    const p = PL.plan(d);
    p.doneToday.forEach((it) => { rows.push({ d, it, done: true, min: it.minutes }); doneMin += it.minutes; plannedMin += it.minutes; });
    p.todayPlanned.forEach((it) => { rows.push({ d, it, done: false, min: it.planned }); plannedMin += it.planned; });
    for (const k of p.days.keys()) if (k > todayK && (!nextK || k < nextK)) { nextK = k; break; }
  });
  return { rows, plannedMin, doneMin, nextK };
}

function todayCard(list = visibleDomains(), compact = false) {
  const { rows, plannedMin, doneMin, nextK } = todayRows(list);
  const head = `<div class="flex between"><div class="card-title" style="margin:0">${icon('calendar')}${compact ? "Aujourd'hui" : new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    ${plannedMin ? `<span class="mono dim" style="font-size:12px">${doneMin} / ${plannedMin} min</span>` : ''}</div>`;
  if (!rows.length) {
    return `${head}<div class="rest-title">Jour de repos</div>
      <div class="muted" style="font-size:13px">${nextK ? `Prochaine séance ${fmtDate(nextK, { weekday: 'long', day: 'numeric', month: 'long' })}. Le repos fait partie du plan, Camarade` : 'Ajoute un domaine pour lancer ton planning'}</div>`;
  }
  const first = rows.find((r) => !r.done);
  return `${head}
    ${bar(plannedMin ? Math.round((doneMin / plannedMin) * 100) : 0, 'var(--accent)')}
    <div class="today-list">${rows.map((r) => `
      <button class="today-item ${r.done ? 'done' : ''}" data-go='${JSON.stringify(r.it.go)}'>
        <span class="check ${r.done ? 'on' : ''}">${r.done ? icon('check') : ''}</span>
        ${compact ? '' : `<span class="cdot" style="color:${r.d.color};margin:0"></span>`}
        <span class="t">${esc(r.it.title)}${r.it.cont && !r.done ? ' <span class="dim">(partie)</span>' : ''}</span>
        <span class="m">${r.min} min</span>
      </button>`).join('')}</div>
    ${first ? (compact ? '' : `<button class="btn btn-primary" style="margin-top:16px;width:100%" data-go='${JSON.stringify(first.it.go)}'>Commencer la séance${icon('right')}</button>`) : `<div class="up" style="margin-top:12px;font-size:13px">Séance du jour accomplie. Le plan avance, Camarade</div>`}`;
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
      ${Math.round(min) ? `<span class="cal-min">${Math.round(min)}′</span>` : ''}
      ${c.plannedMin || c.doneMin ? `<span class="cal-bar"><i style="width:${Math.min(100, Math.round(((c.past ? c.doneMin : c.plannedMin + (c.today ? c.doneMin : 0)) / sc.minutes) * 100))}%"></i></span>` : ''}
    </div>`;
  }).join('')}</div>`).join('');
  return `<div class="card plan-card">
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

function minutesSince(days, domainId = null) {
  const from = new Date(); from.setDate(from.getDate() - days + 1);
  const k = S.today(from);
  let t = 0;
  for (const [day, v] of Object.entries(state.progress.log)) {
    if (day < k) continue;
    t += domainId ? (v[domainId] || 0) : Object.values(v).reduce((a, b) => a + b, 0);
  }
  return t;
}

function weekBuckets(n = 8) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (n - 1) * 7);
  return Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i * 7); return d; });
}

function studyChart(list) {
  const weeks = weekBuckets(8);
  const keys = weeks.map((w) => S.today(w));
  const series = list.map((d) => {
    const vals = keys.map(() => 0);
    for (const [day, v] of Object.entries(state.progress.log)) {
      if (!v[d.id]) continue;
      for (let i = keys.length - 1; i >= 0; i--) if (day >= keys[i]) { vals[i] += v[d.id]; break; }
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
  const curves = series.map((s) => `<path class="curve" d="${path(s.vals)}" stroke="${s.color}"/>`).join('');
  const yl = [4, 3, 2, 1, 0].map((i) => `<span>${Math.round((top * i) / 4)}m</span>`).join('');
  const xl = weeks.map((w) => `<span>${String(w.getDate()).padStart(2, '0')}/${String(w.getMonth() + 1).padStart(2, '0')}</span>`).join('');
  return `<div class="chart"><div class="y-labels">${yl}</div><div class="plot"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}${curves}</svg></div></div><div class="x-labels">${xl}</div>`;
}

function exBadge(d, l) {
  if (!l.exercise) return '';
  const b = S.bestScore(S.exerciseKey(d, l));
  return b === null ? '' : `<span class="pill ${b >= S.passScore(l.exercise) ? 'ok' : 'ko'}">${b}%</span>`;
}

function ring(pct, color, size = 72) {
  const c = 2 * Math.PI * 40;
  return `<div class="ring" style="color:${color};width:${size}px;height:${size}px"><svg viewBox="0 0 92 92"><circle class="track" cx="46" cy="46" r="40"/><circle class="val" cx="46" cy="46" r="40" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg><b>${pct}%</b></div>`;
}

const TABS = [
  { id: 'parcours', label: 'Parcours', ico: 'book' },
  { id: 'planning', label: 'Planning', ico: 'calendar' },
  { id: 'progression', label: 'Progression', ico: 'chart' },
  { id: 'examens', label: 'Examens', ico: 'exam' },
  { id: 'oeuvres', label: 'Œuvres', ico: 'film' }
];
const tabsFor = (d) => TABS.filter((t) => t.id !== 'oeuvres' || d.works?.length);

function domain() {
  const d = S.getDomain(route.id);
  if (!d) return (go(HOME), null);
  const tab = tabsFor(d).some((t) => t.id === route.tab) ? route.tab : 'parcours';
  crumbs([{ label: 'Accueil', go: HOME }, { label: d.name }]);
  const s = S.domainStats(d);
  const n = nextStep(d);

  const head = `
  <div class="dhero">
    <div class="dc-icon big" style="color:${d.color}">${icon(d.icon)}</div>
    <div style="min-width:0;flex:1">
      <h1 class="h1">${esc(d.name)}</h1>
      <div class="sub">${esc(d.level)} · ${plural(s.modules, 'module')} · ${s.lessons} leçons${d.source ? ` · source ${esc(d.source.name)}` : ''}</div>
    </div>
    ${d.modules.length ? ring(s.pct, d.color) : ''}
    <button class="icon-btn menu-btn" data-action="domain-menu" data-id="${d.id}" title="Options">${icon('more')}</button>
  </div>`;

  const levels = d.group ? S.groupMembers(d) : [];
  const switcher = levels.length > 1 ? `<div class="levels">${levels.map((x) => {
    const un = S.isUnlocked(x), pct = S.domainStats(x).pct;
    return `<button class="level ${x.id === d.id ? 'on' : ''} ${un ? '' : 'locked'}" data-go='${JSON.stringify({ name: 'domain', id: x.id })}'>
      <span class="lv-ico">${icon(pct === 100 ? 'check' : un ? 'book' : 'lock')}</span>
      <span class="lv-txt"><b>${esc(x.level)}</b><small>${un ? `${pct} %` : 'Verrouillé'}</small></span></button>`;
  }).join('<span class="lv-sep"></span>')}</div>` : '';
  if (!S.isUnlocked(d)) return head + switcher + lockedPanel(d);

  if (n.empty) {
    return head + `<div class="card empty">
      <div class="em-ico">${icon('sparkle')}</div>
      <h3>Le cursus n'est pas encore construit</h3>
      <p>Demande à Claude de générer le programme « ${esc(d.name)} » sur ${fmtDuration(d.durationWeeks)}, au rythme de ${PL.schedule(d).minutes} min ${PL.daysLabel(PL.schedule(d).days)} (≈ ${fmtMin(PL.weeklyMinutes(PL.schedule(d)) * d.durationWeeks)} de travail), puis importe le fichier JSON ici</p>
      <button class="btn btn-primary" data-action="import-curriculum" data-id="${d.id}">${icon('upload')}Importer un cursus (.json)</button>
    </div>`;
  }

  const resume = `
  <div class="resume">
    <div class="card resume-main">
      <div class="eyebrow">${n.done ? 'Terminé' : n.label === 'Commencer' ? 'Pour commencer' : 'Prochaine étape'}</div>
      <div class="resume-title">${esc(n.title)}</div>
      <div class="muted" style="font-size:13px">${esc(n.sub)}</div>
      <div style="margin-top:20px"><button class="btn btn-primary btn-lg" data-go='${JSON.stringify(n.go)}'>${n.label}${icon('right')}</button></div>
    </div>
    <div class="card resume-today">${todayCard([d], true)}</div>
  </div>`;

  const tabs = `<div class="segmented" role="tablist">${tabsFor(d).map((t) => `<button class="${t.id === tab ? 'on' : ''}" data-go='${JSON.stringify({ name: 'domain', id: d.id, tab: t.id })}'>${t.label}</button>`).join('')}</div>`;
  const body = { parcours: domainParcours, planning: (x) => planCard(x), progression: domainProgress, examens: domainExams, oeuvres: domainWorks }[tab](d);
  return head + switcher + resume + tabs + `<div class="tab-body">${body}</div>`;
}

function lockedPanel(d) {
  const prev = S.groupMembers(d).filter((x) => (x.levelOrder || 1) < (d.levelOrder || 1)).pop();
  const min = d.unlock?.minAvg ?? 80;
  const sc = prev ? S.levelScore(prev) : { avg: 0, complete: false };
  const ps = prev ? S.domainStats(prev) : { pct: 0 };
  const prevUnlocked = prev ? S.isUnlocked(prev) : false;
  const req = (ok, title, sub) => `<div class="req ${ok ? 'ok' : ''}"><span class="check ${ok ? 'on' : ''}">${ok ? icon('check') : ''}</span><span><b>${title}</b><small>${sub}</small></span></div>`;
  return `<div class="card locked-card">
    <div class="lock-ico">${icon('lock')}</div>
    <h3>Niveau ${esc(d.level)} verrouillé</h3>
    <p class="muted">Il s'ouvre quand le niveau ${esc(prev?.level || 'précédent')} est terminé avec au moins ${min} % de réussite</p>
    <div class="reqs">
      ${req(sc.complete, `Terminer le niveau ${esc(prev?.level || '')}`, `Leçons, bilans et examen final · ${ps.pct} % fait`)}
      ${req(sc.complete && sc.avg >= min, `Au moins ${min} % de moyenne`, `Moyenne des meilleurs scores aux bilans et à l'examen final · actuellement ${sc.avg} %`)}
    </div>
    ${prev ? `<button class="btn btn-primary btn-lg" data-go='${JSON.stringify(prevUnlocked ? (nextStep(prev).go || { name: 'domain', id: prev.id }) : { name: 'domain', id: prev.id })}'>Continuer le niveau ${esc(prev.level)}${icon('right')}</button>` : ''}
  </div>
  <div class="section-title" style="margin-top:24px">Au programme</div>
  <div class="card group">${d.modules.map((m, i) => `<div class="group-row" style="cursor:default">
    <span class="mod-num small">${String(i + 1).padStart(2, '0')}</span>
    <span class="gr-main"><span class="gr-title">${esc(m.title)}</span><span class="gr-sub">${plural(m.lessons.length, 'étape')} · ${esc(m.summary || '')}</span></span></div>`).join('')}</div>`;
}

function domainParcours(d) {
  const firstOpen = d.modules.findIndex((_, i) => !S.moduleState(d, i).done);
  const mods = d.modules.map((m, i) => {
    const ms = S.moduleState(d, i);
    const open = route.open !== undefined ? route.open === i : i === (firstOpen < 0 ? 0 : firstOpen);
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
            <span class="t">${l.kind ? `<span class="kind-tag">${icon(l.kind === 'film' ? 'film' : 'book')}${l.kind === 'film' ? 'Film' : 'Lecture'}</span>` : ''}${esc(l.title)}</span>${exBadge(d, l)}<span class="m">${fmtMin(l.minutes)}</span></button>`;
        }).join('')}
        ${m.quiz ? `<button class="lesson quiz" ${ms.quizUnlocked ? '' : 'disabled'} data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: i })}'>
          <span class="check ${ms.quizPassed ? 'on' : ''}">${ms.quizPassed ? icon('check') : ''}</span>
          <span class="t">${esc(m.quiz.title || 'Test de fin de module')} <span class="dim">· ${m.quiz.questions.length} questions</span></span>
          ${qBest !== null ? `<span class="pill ${ms.quizPassed ? 'ok' : 'ko'}">${qBest}%</span>` : ms.quizUnlocked ? `<span class="pill wait">À passer</span>` : `<span class="dim">${icon('lock')}</span>`}
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
  let exam = '';
  if (d.exam) {
    const un = S.examUnlocked(d), best = S.bestScore(S.examKey(d)), ok = S.isPassed(S.examKey(d), d.exam);
    exam = `<div class="card exam-row">
      <div class="flex" style="gap:16px"><span class="mod-num ${ok ? 'done' : ''}">${icon('trophy')}</span>
      <div><div class="mod-title">Examen final</div><div class="mod-sub">${d.exam.questions.length} questions · réussite à ${S.passScore(d.exam)} %${best !== null ? ` · meilleur score ${best} %` : ''}</div></div></div>
      ${un ? `<button class="btn ${ok ? '' : 'btn-primary'}" data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: 'exam' })}'>${ok ? 'Repasser' : "Passer l'examen"}</button>` : `<span class="dim flex" style="font-size:12.5px">${icon('lock')}Termine tous les modules</span>`}
    </div>`;
  }
  return `<div class="timeline">${mods}</div>${exam}`;
}

function domainExamList(d) {
  const out = [];
  d.modules.forEach((m, i) => {
    if (!m.quiz) return;
    const k = S.quizKey(d, m), ms = S.moduleState(d, i);
    out.push({ label: m.quiz.title || `Test du module ${i + 1}`, sub: m.title, available: ms.quizUnlocked, passed: ms.quizPassed, best: S.bestScore(k), tries: (state.progress.attempts[k] || []).length, n: m.quiz.questions.length, go: { name: 'quiz', id: d.id, mi: i } });
  });
  if (d.exam) {
    const k = S.examKey(d);
    out.push({ label: 'Examen final', sub: 'Valide le domaine', available: S.examUnlocked(d), passed: S.isPassed(k, d.exam), best: S.bestScore(k), tries: (state.progress.attempts[k] || []).length, n: d.exam.questions.length, go: { name: 'quiz', id: d.id, mi: 'exam' } });
  }
  return out;
}

function domainExams(d) {
  const list = domainExamList(d);
  if (!list.length) return `<div class="card">${emptyBlock('exam', 'Aucune épreuve', 'Ce cursus ne contient pas encore de test')}</div>`;
  return `<div class="card group">${list.map((e) => `
    <button class="group-row" ${e.available ? `data-go='${JSON.stringify(e.go)}'` : 'disabled'}>
      <span class="mod-num small ${e.passed ? 'done' : ''}">${e.passed ? icon('check') : e.available ? icon('exam') : icon('lock')}</span>
      <span class="gr-main"><span class="gr-title">${esc(e.label)}</span><span class="gr-sub">${esc(e.sub)} · ${e.n} questions${e.tries ? ` · ${plural(e.tries, 'essai')}` : ''}</span></span>
      ${e.passed ? '<span class="pill ok">Réussi</span>' : e.available ? '<span class="pill wait">Disponible</span>' : '<span class="dim" style="font-size:12px">Verrouillé</span>'}
      <span class="mono gr-score">${e.best !== null ? e.best + ' %' : '—'}</span>
    </button>`).join('')}</div>`;
}

function domainProgress(d) {
  const s = S.domainStats(d);
  const total = Object.values(state.progress.log).reduce((a, v) => a + (v[d.id] || 0), 0);
  const exScores = d.modules.flatMap((m) => m.lessons).filter((l) => l.exercise).map((l) => S.bestScore(S.exerciseKey(d, l))).filter((x) => x !== null);
  const avg = exScores.length ? Math.round(exScores.reduce((a, b) => a + b, 0) / exScores.length) : null;
  const passed = domainExamList(d).filter((e) => e.passed).length;
  const nTests = domainExamList(d).length;

  const days = 7 * 18;
  const start = new Date(); start.setDate(start.getDate() - days + 1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells = [];
  for (const x = new Date(start); x <= new Date(); x.setDate(x.getDate() + 1)) {
    const t = state.progress.log[S.today(x)]?.[d.id] || 0;
    const l = t === 0 ? 0 : t < 15 ? 1 : t < 30 ? 2 : t < 60 ? 3 : 4;
    cells.push(`<i data-l="${l}" title="${x.toLocaleDateString('fr-FR')} · ${t} min"></i>`);
  }
  const pre = d.id + '/';
  const attempts = Object.entries(state.progress.attempts).filter(([k]) => k.startsWith(pre)).flatMap(([k, arr]) => arr.map((a) => ({ k, ...a }))).sort((a, b) => b.date - a.date).slice(0, 8);
  const label = (k) => {
    const [, mid, t] = k.split('/');
    if (mid === 'exam') return 'Examen final';
    const m = d.modules.find((x) => x.id === mid);
    if (m) return m.quiz?.title ? `${m.quiz.title} · ${m.title}` : `Test · ${m.title}`;
    const l = d.modules.flatMap((x) => x.lessons).find((x) => x.id === mid);
    return l ? `Exercice · ${l.title}` : t;
  };
  return `
  <div class="grid stats">
    ${statCard('Avancement', 'target', `${s.pct}<small>%</small>`, `${plural(s.lessonsDone, 'leçon')} sur ${s.lessons}`)}
    ${statCard('Temps étudié', 'clock', fmtMin(total), `${fmtMin(minutesSince(7, d.id))} cette semaine`)}
    ${statCard('Exercices', 'book', avg !== null ? `${avg}<small>%</small>` : '—', avg !== null ? `moyenne sur ${plural(exScores.length, 'exercice')}` : 'aucun exercice fait')}
    ${statCard('Tests réussis', 'trophy', `${passed}<small>/${nTests}</small>`, 'bilans et examen final')}
  </div>
  <div class="card chart-card">
    <div class="card-title" style="margin:0">${icon('chart')}Temps d'étude par semaine</div>
    ${studyChart([d])}
  </div>
  <div class="split section-gap">
    <div class="card"><div class="h2" style="margin-bottom:16px">Activité</div><div class="heat">${cells.join('')}</div></div>
    <div class="card"><div class="h2" style="margin-bottom:8px">Derniers résultats</div><div class="list">
      ${attempts.length ? attempts.map((a) => `<div class="row">
        <div class="row-main"><div class="row-title">${esc(label(a.k))}</div><div class="row-sub">${new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</div></div>
        <span class="row-end" style="color:${a.pct >= 70 ? 'var(--green)' : '#f07a7d'}">${a.pct}%</span></div>`).join('') : '<div class="dim" style="padding:8px 0;font-size:13px">Aucun résultat pour l\'instant</div>'}
    </div></div>
  </div>`;
}

function lesson() {
  const d = S.getDomain(route.id);
  const m = d?.modules[route.mi];
  const l = m?.lessons[route.li];
  if (!l) return (go(HOME), null);
  if (!S.isUnlocked(d)) return (go({ name: 'domain', id: d.id }), null);
  crumbs([{ label: 'Accueil', go: HOME }, { label: d.name, go: { name: 'domain', id: d.id } }, { label: l.title }]);
  const done = S.isLessonDone(d, l);
  const flat = d.modules.flatMap((mm, mi) => mm.lessons.map((_, li) => ({ mi, li })));
  const pos = flat.findIndex((x) => x.mi === route.mi && x.li === route.li);
  const prev = flat[pos - 1], next = flat[pos + 1];
  return `
  <article class="reader">
    <div class="eyebrow">Module ${route.mi + 1} · ${esc(m.title)}</div>
    <h1 class="h1" style="font-size:28px">${esc(l.title)}</h1>
    <div class="hero-meta" style="margin-bottom:26px">${l.kind ? `<span class="pill wait">${l.kind === 'film' ? 'Film' : 'Lecture'}</span>` : ''}<span class="pill">${icon('clock')}${fmtMin(l.minutes)}</span><span class="pill">Leçon ${route.li + 1}/${m.lessons.length}</span>${l.audio?.length ? `<span class="pill">${icon('headphones')}${plural(l.audio.length, 'audio')}</span>` : ''}${done ? `<span class="pill ok">${icon('check')}Terminée</span>` : ''}</div>
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

const RECALL_D = { id: 'recall', name: 'Rappel', color: 'var(--accent)', modules: [] };

function quizCtx() {
  if (route.mi === 'recall') return recallSet ? { d: RECALL_D, q: recallSet.q, key: 'recall:' + recallSet.id, title: 'Rappel', kind: 'recall' } : null;
  const d = S.getDomain(route.id);
  if (d && route.mi === 'works') return d.worksQuiz ? { d, q: d.worksQuiz, key: `${d.id}/works`, title: 'Contrôle des œuvres', kind: 'works' } : null;
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
  if (!c) return (go(route.mi === 'recall' ? { name: 'recall' } : S.getDomain(route.id) ? { name: 'domain', id: route.id } : HOME), null);
  const { d, q, key, title, kind } = c;
  if (!S.isUnlocked(d)) return (go({ name: 'domain', id: d.id }), null);
  const back = kind === 'exercise' ? { name: 'lesson', id: d.id, mi: route.mi, li: route.li } : kind === 'recall' ? { name: 'recall' } : kind === 'works' ? { name: 'domain', id: d.id, tab: 'oeuvres' } : { name: 'domain', id: d.id };
  if (kind === 'recall') crumbs([{ label: 'Rappel', go: { name: 'recall' } }, { label: 'Questions' }]);
  else crumbs([{ label: 'Accueil', go: HOME }, { label: d.name, go: { name: 'domain', id: d.id } }, ...(kind === 'exercise' ? [{ label: c.l.title, go: back }] : []), { label: kind === 'exercise' ? 'Exercice' : title }]);
  if (!quizSession || quizSession.key !== key) {
    const shuffle = (n) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    quizSession = { key, answers: Array(q.questions.length).fill(null), orders: q.questions.map((x) => (x.choices ? shuffle(x.choices.length) : null)), submitted: false, pct: 0 };
  }
  const qs = quizSession;
  const pass = S.passScore(q);
  const okMsg = { exam: 'Domaine validé. Gloire au travailleur studieux, Camarade', quiz: 'Module validé, le suivant est débloqué', exercise: 'Leçon validée, elle est cochée automatiquement', recall: 'Bonne mémoire, Camarade', works: 'Tu connais tes classiques, Camarade' }[kind];

  const result = qs.submitted ? `
    <div class="card result">
      <span class="pill ${qs.pct >= pass ? 'ok' : 'ko'}">${qs.pct >= pass ? 'Réussi' : 'Pas encore'}</span>
      <div class="score" style="color:${qs.pct >= pass ? 'var(--green)' : 'var(--red)'}">${qs.pct}%</div>
      <div class="muted">${qs.correct}/${q.questions.length} bonnes réponses · seuil ${pass} %</div>
      <div class="muted" style="margin-top:6px">${qs.pct >= pass ? okMsg : 'Relis les corrections ci-dessous puis retente ta chance'}</div>
      <div class="flex" style="justify-content:center;margin-top:18px">
        <button class="btn" data-action="retry-quiz">${icon('refresh')}Recommencer</button>
        <button class="btn btn-primary" data-go='${JSON.stringify(back)}'>${{ exercise: 'Retour à la leçon', recall: 'Retour au rappel', works: 'Retour aux œuvres' }[kind] || 'Retour au domaine'}</button>
      </div>
    </div>${kind === 'recall' ? recallReview(q, qs) : ''}` : '';

  let lastSection = null;
  const items = q.questions.map((x, i) => {
    const sec = x.section && x.section !== lastSection ? `<div class="q-section">${esc(x.section)}</div>` : '';
    if (x.section) lastSection = x.section;
    const say = x.audio ? audioSay(x.audio) : '';
    const prompt = esc(x.q).replace(/_{3,}/g, '<span class="blank"></span>');
    let body;
    if (x.type === 'text') {
      const ok = qs.submitted && answerOk(x, qs.answers[i]);
      const chips = x.words?.length && !qs.submitted ? `<div class="words">${x.words.map((w) => `<button class="word" data-word="${esc(w)}" data-for="${i}">${esc(w)}</button>`).join('')}<button class="word clear" data-clear="${i}">Effacer</button></div>` : '';
      body = chips + `<input class="answer ${qs.submitted ? (ok ? 'right' : 'wrong') : ''}" data-text="${i}" value="${esc(qs.answers[i] ?? '')}" placeholder="Ta réponse…" autocomplete="off" spellcheck="false" ${qs.submitted ? 'disabled' : ''}>
        ${qs.submitted && !ok ? `<div class="explain">${icon('check', 'ok-ico')} ${x.accept.map(esc).join(' <span class="dim">ou</span> ')}</div>` : ''}`;
    } else {
      body = `<div class="choices ${qs.submitted ? 'locked' : ''}">
        ${(qs.orders?.[i] || x.choices.map((_, j) => j)).map((j) => {
          const ch = x.choices[j];
          let cls = qs.answers[i] === j ? 'sel' : '';
          if (qs.submitted) cls = j === x.answer ? 'right' : qs.answers[i] === j ? 'wrong' : '';
          return `<button class="choice ${cls}" data-choice="${i}:${j}"><span class="radio"></span>${esc(ch)}</button>`;
        }).join('')}
      </div>`;
    }
    return `${sec}<div class="card q">
      ${x.src ? `<div class="q-src">${esc(x.src.domain)} · ${esc(x.src.title)}</div>` : ''}
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
    <div class="sub" style="margin-bottom:22px">${q.questions.length} questions · réussite à ${pass} %${kind !== 'recall' && S.bestScore(key) !== null ? ` · meilleur score ${S.bestScore(key)} %` : ''}</div>
    ${result}${intro}${items}
    ${qs.submitted ? '' : `<div class="quiz-bar"><span class="muted mono" style="font-size:12px" id="answeredCount">${answered}/${q.questions.length} répondues</span>
      <button class="btn btn-primary" data-action="submit-quiz" ${answered === q.questions.length ? '' : 'disabled'}>Valider mes réponses</button></div>`}
  </div>`;
}

function domainLabel(d) { return d.group ? `${d.name} · ${d.level}` : d.name; }

function recallPool(scope) {
  const out = [];
  state.domains.forEach((d) => {
    if (!d.modules.length || !S.isUnlocked(d)) return;
    if (scope !== 'all' && (d.group || d.id) !== scope) return;
    d.modules.forEach((m, mi) => {
      m.lessons.forEach((l, li) => {
        if (!S.isLessonDone(d, l) || !l.exercise) return;
        l.exercise.questions.forEach((x) => {
          const rest = { ...x };
          out.push({ ...rest, src: { domain: domainLabel(d), title: l.title, go: { name: 'lesson', id: d.id, mi, li } } });
        });
      });
      if (m.quiz && S.isPassed(S.quizKey(d, m), m.quiz)) {
        m.quiz.questions.forEach((x) => {
          const { section, ...rest } = x;
          out.push({ ...rest, src: { domain: domainLabel(d), title: m.quiz.title || m.title, go: { name: 'domain', id: d.id } } });
        });
      }
    });
  });
  return out;
}

function recallReview(q, qs) {
  const wrong = q.questions.map((x, i) => ({ x, ok: answerOk(x, qs.answers[i]) })).filter((r) => !r.ok);
  if (!wrong.length) return `<div class="card note-card" style="margin-bottom:16px">Aucune erreur : tout est bien ancré, Camarade</div>`;
  const seen = new Set();
  const rows = wrong.filter((r) => { const k = r.x.src.title; if (seen.has(k)) return false; seen.add(k); return true; });
  return `<div class="section-title">À revoir</div><div class="card group" style="margin-bottom:24px">${rows.map((r) => `
    <button class="group-row" data-go='${JSON.stringify(r.x.src.go)}'>
      <span class="gr-ico" style="background:var(--raised);color:var(--accent)">${icon('book')}</span>
      <span class="gr-main"><span class="gr-title">${esc(r.x.src.title)}</span><span class="gr-sub">${esc(r.x.src.domain)}</span></span>
      <span class="dim">${icon('chevron')}</span>
    </button>`).join('')}</div>`;
}

function recall() {
  crumbs([{ label: 'Rappel' }]);
  const scopes = [{ id: 'all', label: 'Tout' }];
  const seen = new Set();
  state.domains.forEach((d) => { const k = d.group || d.id; if (!d.modules.length || seen.has(k)) return; seen.add(k); scopes.push({ id: k, label: d.name, d }); });
  if (!scopes.some((x) => x.id === recallScope)) recallScope = 'all';
  const pool = recallPool(recallScope);
  const lessons = new Set(pool.map((x) => x.src.title)).size;
  const hist = (state.progress.recalls || []).slice(-6).reverse();
  return `
  <div class="page-head"><div><h1 class="h1">Rappel</h1>
    <div class="sub">Dix questions tirées au hasard dans ce que tu as déjà vu, différentes à chaque lancement</div></div></div>
  <div class="segmented" style="margin-bottom:20px">${scopes.map((x) => `<button class="${x.id === recallScope ? 'on' : ''}" data-action="recall-scope" data-scope="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div>
  <div class="card recall-hero">
    <div class="recall-ico">${icon('brain')}</div>
    <div style="flex:1;min-width:0">
      <div class="resume-title" style="margin:0 0 4px">${pool.length ? `${Math.min(10, pool.length)} questions prêtes` : 'Rien à réviser pour l\'instant'}</div>
      <div class="muted">${pool.length ? `Tirées parmi ${pool.length} questions de ${plural(lessons, 'leçon')} et bilans déjà faits` : 'Termine au moins une leçon avec exercice pour débloquer le rappel'}</div>
    </div>
    <button class="btn btn-primary btn-lg" data-action="start-recall" ${pool.length ? '' : 'disabled'}>Lancer un rappel${icon('right')}</button>
  </div>
  ${hist.length ? `<div class="section-title" style="margin-top:24px">Derniers rappels</div><div class="card group">${hist.map((h) => `
    <div class="group-row" style="cursor:default"><span class="gr-main"><span class="gr-title">${new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="gr-sub">${h.n} questions</span></span>
    <span class="pill ${h.pct >= 70 ? 'ok' : 'ko'}">${h.pct} %</span></div>`).join('')}</div>` : ''}`;
}

function domainWorks(d) {
  const seen = state.progress.works || {};
  const k = (w) => `${d.id}/${w.id}`;
  const section = (type, title) => {
    const list = d.works.filter((w) => w.type === type);
    if (!list.length) return '';
    const n = list.filter((w) => seen[k(w)]).length;
    return `<div class="section-title flex between"><span>${title}</span><span class="dim" style="font-weight:400">${n}/${list.length} ${type === 'film' ? 'vus' : 'lus'}</span></div>
    <div class="card group works">${list.map((w) => `
      <div class="group-row work ${seen[k(w)] ? 'seen' : ''}">
        <button class="check ${seen[k(w)] ? 'on' : ''}" data-action="toggle-work" data-key="${k(w)}" title="${type === 'film' ? 'Marquer comme vu' : 'Marquer comme lu'}">${seen[k(w)] ? icon('check') : ''}</button>
        <span class="gr-main"><span class="gr-title">${esc(w.title)} <span class="dim" style="font-weight:400">· ${esc(w.author)}, ${esc(String(w.year))}</span></span>
        <span class="work-why">${esc(w.why)}</span></span>
        <span class="mono dim" style="font-size:12.5px;white-space:nowrap">${esc(w.length || '')}</span>
      </div>`).join('')}</div>`;
  };
  const best = d.worksQuiz ? S.bestScore(`${d.id}/works`) : null;
  return `${section('film', 'Films à voir')}<div style="height:20px"></div>${section('livre', 'Livres à lire')}
  ${d.worksQuiz ? `<div class="card exam-row" style="margin-top:20px">
    <div class="flex" style="gap:16px"><span class="mod-num ${best !== null && best >= S.passScore(d.worksQuiz) ? 'done' : ''}">${icon('trophy')}</span>
    <div><div class="mod-title">Contrôle des œuvres</div><div class="mod-sub">${d.worksQuiz.questions.length} questions sur les films et les livres${best !== null ? ` · meilleur score ${best} %` : ''}</div></div></div>
    <button class="btn btn-primary" data-go='${JSON.stringify({ name: 'quiz', id: d.id, mi: 'works' })}'>${best !== null ? 'Repasser' : 'Passer le contrôle'}</button>
  </div>` : ''}`;
}

function settings() {
  crumbs([{ label: 'Paramètres' }]);
  const size = new Blob([JSON.stringify(state)]).size;
  return `
  <div class="page-head"><div><h1 class="h1">Paramètres</h1></div></div>
  <div class="settings">
    <div class="section-title">Profil</div>
    <div class="card group">
      <button class="group-row" data-action="profile">
        ${avatarHTML(40)}
        <span class="gr-main"><span class="gr-title">${esc(state.profile.name || 'Camarade')}</span><span class="gr-sub">Nom et photo de profil</span></span>
        <span class="dim">${icon('chevron')}</span>
      </button>
    </div>

    <div class="section-title">Données</div>
    <div class="card group">
      <button class="group-row" data-action="export">
        <span class="gr-ico">${icon('download')}</span>
        <span class="gr-main"><span class="gr-title">Exporter une sauvegarde</span><span class="gr-sub">Domaines, progression et profil · ${(size / 1024).toFixed(1)} Ko stockés sur ce PC</span></span>
        <span class="dim">${icon('chevron')}</span>
      </button>
      <button class="group-row" data-action="import-all">
        <span class="gr-ico">${icon('upload')}</span>
        <span class="gr-main"><span class="gr-title">Restaurer une sauvegarde</span><span class="gr-sub">Remplace les données actuelles par celles du fichier</span></span>
        <span class="dim">${icon('chevron')}</span>
      </button>
    </div>

    <div class="section-title">Cursus</div>
    <div class="card">
      <div class="muted" style="font-size:13px;margin-bottom:12px">Un cursus importé dans un domaine est un fichier JSON</div>
      <pre class="code">{
  "modules": [{
    "title": "Les bases", "summary": "…",
    "lessons": [{
      "title": "…", "minutes": 12, "content": "&lt;p&gt;HTML&lt;/p&gt;",
      "audio": [{ "title": "Dialogue", "src": "audio/anglais/m1-l1.mp3" }],
      "exercise": { "intro": "&lt;p&gt;Consigne&lt;/p&gt;", "questions": [ … ] }
    }],
    "quiz": { "passScore": 70, "questions": [
      { "q": "…", "choices": ["a","b","c"], "answer": 1 },
      { "type": "text", "q": "She ____ happy.", "accept": ["is", "'s"] }
    ]}
  }],
  "exam": { "passScore": 75, "questions": [ … ] }
}</pre>
    </div>

    <div class="section-title">Zone sensible</div>
    <div class="card group">
      <button class="group-row danger" data-action="reset">
        <span class="gr-ico">${icon('trash')}</span>
        <span class="gr-main"><span class="gr-title">Tout réinitialiser</span><span class="gr-sub">Efface la progression et les domaines, puis réinstalle le cours d'anglais</span></span>
      </button>
    </div>
    <div class="dim mono" style="font-size:11.5px;padding:16px 4px">Neurone v0.7.0</div>
  </div>`;
}

/* ---------------- Profil & menus ---------------- */
function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

function profileModal() {
  const draft = { name: state.profile.name || 'Camarade', avatar: state.profile.avatar || null };
  const preview = () => (draft.avatar
    ? `<img src="${draft.avatar}" alt="">`
    : `<span>${esc(draft.name.trim().charAt(0).toUpperCase() || 'C')}</span>`);
  openModal(`
    <div class="modal-head"><div class="h2">Profil</div></div>
    <div class="modal-body">
      <div class="profile-edit">
        <button class="avatar-xl" id="pAvatar" title="Changer la photo">${preview()}<i>${icon('upload')}</i></button>
        <div class="flex" style="gap:8px">
          <button class="btn btn-sm" id="pPick">Choisir une photo</button>
          <button class="btn btn-sm btn-ghost" id="pRemove" ${draft.avatar ? '' : 'hidden'}>Retirer</button>
        </div>
      </div>
      <div class="field"><label>Nom</label><input id="pName" maxlength="32" value="${esc(draft.name)}"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" id="pSave">Enregistrer</button></div>`,
  (m) => {
    const refresh = () => { $('#pAvatar', m).innerHTML = preview() + `<i>${icon('upload')}</i>`; $('#pRemove', m).hidden = !draft.avatar; };
    const pick = () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        try { draft.avatar = await resizeImage(f); refresh(); } catch (e) { toast(e.message, false); }
      };
      inp.click();
    };
    $('#pAvatar', m).onclick = pick;
    $('#pPick', m).onclick = pick;
    $('#pRemove', m).onclick = () => { draft.avatar = null; refresh(); };
    $('#pName', m).addEventListener('input', (e) => { draft.name = e.target.value; if (!draft.avatar) refresh(); });
    $('#pSave', m).onclick = () => {
      state.profile = { name: draft.name.trim() || 'Camarade', avatar: draft.avatar };
      S.save(); closeModal(); toast('Profil mis à jour'); render();
    };
  });
}

function closeMenu() { document.querySelector('.menu-pop')?.remove(); }

function openMenu(anchor, items) {
  closeMenu();
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'menu-pop';
  el.innerHTML = items.map((it) => it === '-' ? '<div class="menu-sep"></div>' : `<button class="menu-item ${it.danger ? 'danger' : ''}" data-mi="${it.id}">${icon(it.icon)}${it.label}</button>`).join('');
  document.body.appendChild(el);
  el.style.top = `${r.bottom + 6}px`;
  el.style.left = `${Math.max(8, r.right - el.offsetWidth)}px`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mi]'); if (!b) return;
    e.stopPropagation();
    closeMenu();
    items.find((x) => x.id === b.dataset.mi)?.run();
  });
}

function emptyBlock(ico, title, text) {
  return `<div class="empty"><div class="em-ico">${icon(ico)}</div><h3>${title}</h3><p>${text}</p></div>`;
}

/* ---------------- Modals & toasts ---------------- */
function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-app"><img src="logo.png" alt=""></span><span class="toast-body"><b>Neurone</b><small>${esc(msg)}</small></span><span class="toast-state ${ok ? 'ok' : 'ko'}">${icon(ok ? 'check' : 'info')}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 3200);
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
      ${catalog.length ? `<div class="field"><label>Depuis la bibliothèque</label><div class="lib">${catalog.filter((c) => !c.group || c.levelOrder === 1).map((c) => {
        const lv = c.group ? catalog.filter((x) => x.group === c.group) : [c];
        const has = state.domains.some((d) => d.courseId === c.id);
        return `<div class="lib-item"><div class="dc-icon" style="color:${c.color}">${icon(c.icon)}</div>
          <div style="flex:1;min-width:0"><div class="row-title">${esc(c.name)} <span class="dim">· ${lv.length > 1 ? lv.map((x) => esc(x.level)).join(', ') : esc(c.level)}</span></div><div class="row-sub">${lv.length > 1 ? `${lv.length} niveaux · ${lv.reduce((a, x) => a + x.lessons, 0)} leçons` : `${plural(c.modules, 'module')} · ${c.lessons} leçons`}</div></div>
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
        const entry = catalog.find((c) => c.id === b.dataset.lib);
        if (entry.group) state.removedGroups = (state.removedGroups || []).filter((g) => g !== entry.group);
        const d = await addCourse(entry, { minutes: sc.minutes, days: [...sc.days] });
        await syncGroups();
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
  profile: profileModal,
  'domain-menu': (el) => {
    const d = S.getDomain(el.dataset.id);
    openMenu(el, [
      ...(d.modules.length ? [{ id: 'r', icon: 'calendar', label: 'Modifier le rythme', run: () => rhythmModal(d) }] : []),
      { id: 'i', icon: 'upload', label: d.modules.length ? 'Remplacer le cursus' : 'Importer un cursus', run: () => actions['import-curriculum'](el) },
      '-',
      { id: 'x', icon: 'trash', label: 'Supprimer le domaine', danger: true, run: () => actions['delete-domain'](el) }
    ]);
  },
  'edit-rhythm': (el) => rhythmModal(S.getDomain(el.dataset.id)),
  'delete-domain': (el) => {
    const d = S.getDomain(el.dataset.id);
    confirmModal('Supprimer ce domaine ?', `« ${esc(d.name)} »${d.group ? ' (tous les niveaux)' : ''} et toute sa progression seront supprimés définitivement.`, 'Supprimer', () => {
      S.deleteDomain(d.id); toast('Domaine supprimé'); go(HOME);
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
    if (c.kind === 'recall') {
      qs.pct = Math.round((qs.correct / c.q.questions.length) * 100);
      (state.progress.recalls ||= []).push({ date: Date.now(), pct: qs.pct, n: c.q.questions.length });
      S.save();
    } else {
      qs.pct = S.recordAttempt(qs.key, c.d.id, qs.correct, c.q.questions.length);
    }
    if (c.kind === 'exercise' && qs.pct >= S.passScore(c.q) && !S.isLessonDone(c.d, c.l)) S.setLessonDone(c.d, c.l, true);
    qs.submitted = true;
    render();
    $('#view').scrollTo({ top: 0, behavior: 'smooth' });
  },
  'retry-quiz': () => { if (route.mi === 'recall') return actions['start-recall'](); quizSession = null; render(); $('#view').scrollTop = 0; },
  'start-recall': () => {
    const pool = recallPool(recallScope);
    if (!pool.length) return toast('Termine au moins une leçon pour lancer un rappel', false);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    recallSet = { id: Date.now(), q: { passScore: 70, questions: pool.slice(0, 10) } };
    quizSession = null;
    go({ name: 'quiz', mi: 'recall' });
  },
  'recall-scope': (el) => { recallScope = el.dataset.scope; render(); },
  'toggle-work': (el) => {
    const k = el.dataset.key;
    state.progress.works ||= {};
    if (state.progress.works[k]) delete state.progress.works[k]; else state.progress.works[k] = Date.now();
    S.save(); const top = $('#view').scrollTop; render(); $('#view').scrollTop = top;
  },
  export: () => { download(`neurone-sauvegarde-${S.today()}.json`, S.exportAll()); toast('Sauvegarde exportée'); },
  'import-all': () => pickFile((text) => confirmModal('Restaurer cette sauvegarde ?', 'Tes données actuelles seront remplacées par celles du fichier.', 'Restaurer', () => {
    try { S.importAll(text); toast('Sauvegarde restaurée'); go(HOME); } catch (e) { toast(e.message, false); }
  })),
  reset: () => confirmModal('Tout réinitialiser ?', 'Toute ta progression et tes domaines seront effacés. Exporte une sauvegarde avant si besoin.', 'Réinitialiser', () => {
    S.resetAll(); seed().finally(() => { toast('Application réinitialisée'); go(HOME); });
  })
};

document.addEventListener('click', (e) => {
  const t = e.target;
  if (!t.closest('.menu-pop') && !t.closest('[data-action="domain-menu"]')) closeMenu();
  if (t.closest('[data-close]') || t.id === 'modalRoot') return closeModal();
  const a = t.closest('[data-action]');
  if (a && !a.disabled) return actions[a.dataset.action]?.(a);
  const wb = t.closest('[data-word], [data-clear]');
  if (wb && quizSession && !quizSession.submitted) {
    const i = wb.dataset.for ?? wb.dataset.clear;
    const inp = document.querySelector(`[data-text="${i}"]`);
    if (wb.dataset.clear !== undefined) {
      inp.value = '';
      wb.parentElement.querySelectorAll('[data-word]').forEach((b) => (b.disabled = false));
    } else {
      inp.value = (inp.value.trim() ? inp.value.trimEnd() + ' ' : '') + wb.dataset.word;
      wb.disabled = true;
    }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
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
  if (dm) {
    const target = S.getDomain(dm.dataset.domain);
    const here = ['domain', 'lesson', 'quiz'].includes(route.name) && sameGroup(S.getDomain(route.id), target);
    if (here && dm.closest('#domainNav')) { subnavClosed = !subnavClosed; return renderSidebar(); }
    subnavClosed = false;
    return go({ name: 'domain', id: dm.dataset.domain });
  }
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

document.addEventListener('keydown', (e) => {
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
$('#addDomainSide').innerHTML = icon('plus');
$('#profileBtn').dataset.action = 'profile';
if (window.__TAURI__) document.documentElement.classList.add('tauri');
function onViewScroll() {
  const v = $('#view'), top = v.scrollTop;
  $('.topbar').classList.toggle('scrolled', top > 4);
  const h1 = v.querySelector('.h1');
  const show = !!h1 && h1.getBoundingClientRect().bottom < v.getBoundingClientRect().top + 8;
  const bt = $('#barTitle');
  if (show && bt.textContent !== h1.textContent) bt.textContent = h1.textContent;
  bt.classList.toggle('on', show);
  $('#crumbs').classList.toggle('dim-out', show);
  const rp = $('#readProg');
  rp.hidden = route.name !== 'lesson';
  if (!rp.hidden) rp.firstElementChild.style.transform = `scaleX(${Math.min(1, top / Math.max(1, v.scrollHeight - v.clientHeight))})`;
}
$('#view').addEventListener('scroll', onViewScroll, { passive: true });
$('#addDomainSide').dataset.action = 'new-domain';
$('#app').classList.toggle('collapsed', !!state.settings.collapsed);

async function loadCatalog() {
  try { catalog = await (await fetch('courses/index.json')).json(); } catch { catalog = []; }
}

async function addCourse(entry, sc) {
  const course = await (await fetch(entry.file)).json();
  const d = S.domainFromCourse(course);
  d.schedule = { minutes: (sc || PL.DEFAULT_SCHEDULE).minutes, days: [...(sc || PL.DEFAULT_SCHEDULE).days], target: null };
  state.domains.push(d);
  if (S.isUnlocked(d)) PL.ensureTarget(d);
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
async function hydrate() {
  for (const d of state.domains) {
    const entry = catalog.find((c) => c.id === d.courseId);
    if (!entry) continue;
    try {
      const c = await (await fetch(entry.file)).json();
      const cur = S.normalizeCurriculum(c);
      Object.assign(d, {
        fromLibrary: true, group: c.group || null, levelOrder: c.levelOrder || 1, unlock: c.unlock || null,
        level: c.level || d.level, icon: c.icon || d.icon, description: c.description || d.description, goal: c.goal || d.goal, source: c.source || null,
        modules: cur.modules, exam: cur.exam, works: cur.works, worksQuiz: cur.worksQuiz
      });
    } catch (e) { console.error(e); }
  }
}

async function syncGroups() {
  const removed = state.removedGroups || [];
  const groups = [...new Set(state.domains.filter((d) => d.group).map((d) => d.group))].filter((g) => !removed.includes(g));
  for (const g of groups) {
    const base = S.groupMembers(state.domains.find((d) => d.group === g))[0];
    for (const entry of catalog.filter((c) => c.group === g)) {
      if (state.domains.some((d) => d.courseId === entry.id)) continue;
      try { await addCourse(entry, base.schedule); } catch (e) { console.error(e); }
    }
  }
}

const AUTO_INSTALL = ['communisme'];
async function autoInstall() {
  state.autoInstalled ||= [];
  for (const id of AUTO_INSTALL) {
    if (state.autoInstalled.includes(id)) continue;
    const entry = catalog.find((c) => c.id === id);
    if (!entry) continue;
    try {
      if (!state.domains.some((d) => d.courseId === id)) await addCourse(entry, PL.DEFAULT_SCHEDULE);
      state.autoInstalled.push(id);
      S.save();
    } catch (e) { console.error(e); }
  }
}

loadCatalog().then(hydrate).then(seed).then(syncGroups).then(autoInstall).catch(console.error).finally(render);
