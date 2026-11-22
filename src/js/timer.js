import * as S from './store.js';
import { icon } from './icons.js';

const { state } = S;
let ctx = null;
let manualPause = false;
let finished = false;
let ticker = 0;
let sinceSave = 0;
let onGoal = () => {};

const goalSec = (d) => (d.schedule?.minutes || 25) * 60;
const todaySec = (id) => Math.round((state.progress.log[S.today()]?.[id] || 0) * 60);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function initTimer(goalCallback) {
  onGoal = goalCallback;
  document.addEventListener('visibilitychange', update);
  document.getElementById('timerBtn').addEventListener('click', () => {
    if (!ctx) return;
    if (running()) manualPause = true;
    else { manualPause = false; finished = false; }
    update();
  });
}

export function setContext(route) {
  const study = route.name === 'lesson' || route.name === 'quiz';
  const id = route.id || null;
  const key = study ? `${route.name}:${id}:${route.mi}:${route.li}` : null;
  if (study && key !== ctx?.key) { finished = false; manualPause = false; }
  const prevStudy = ctx?.study;
  ctx = id ? { id, study, key } : null;
  if (prevStudy && !study) S.save();
  update();
}

export function finish() {
  finished = true;
  S.save();
  update();
}

function running() {
  return !!ctx?.study && !manualPause && !finished && document.visibilityState === 'visible';
}

function tick() {
  const d = S.getDomain(ctx.id);
  if (!d) return;
  const k = S.today();
  const day = (state.progress.log[k] ||= {});
  const before = todaySec(d.id);
  day[d.id] = (day[d.id] || 0) + 1 / 60;
  const after = before + 1;
  const goal = goalSec(d);
  const flag = `${k}/${d.id}`;
  state.progress.rang ||= {};
  if (before < goal && after >= goal && !state.progress.rang[flag]) {
    state.progress.rang[flag] = true;
    chime();
    onGoal(d);
    S.save();
  }
  if (++sinceSave >= 15) { sinceSave = 0; S.save(); }
  paint();
}

function update() {
  const on = running();
  if (on && !ticker) ticker = setInterval(tick, 1000);
  if (!on && ticker) { clearInterval(ticker); ticker = 0; }
  paint();
}

function paint() {
  const btn = document.getElementById('timerBtn');
  const d = ctx && S.getDomain(ctx.id);
  if (!d || !d.modules.length) { btn.hidden = true; return; }
  btn.hidden = false;
  const s = todaySec(d.id), goal = goalSec(d);
  const pct = Math.min(1, s / goal);
  const c = 2 * Math.PI * 7;
  const on = running();
  btn.classList.toggle('running', on);
  btn.classList.toggle('reached', s >= goal);
  btn.title = on ? 'Mettre en pause' : ctx.study ? 'Reprendre le minuteur' : 'Le minuteur démarre quand tu ouvres une leçon';
  btn.innerHTML = `
    <svg class="t-ring" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" class="t-track"/><circle cx="9" cy="9" r="7" class="t-val" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>
    <span class="t-time">${fmt(s)}<span class="t-goal"> / ${fmt(goal)}</span></span>
    <span class="t-ico">${icon(on ? 'pause' : 'play')}</span>`;
}

function chime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1174.66, 0.22], [1567.98, 0.44]].forEach(([f, t]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.35, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 1.1);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 1.2);
    });
    setTimeout(() => ac.close(), 2000);
  } catch {}
}
