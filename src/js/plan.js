import * as S from './store.js';

export const DEFAULT_SCHEDULE = { minutes: 25, days: [1, 2, 3, 4, 5] };
export const DAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export const schedule = (d) => d.schedule || DEFAULT_SCHEDULE;
export const weeklyMinutes = (sc) => sc.minutes * sc.days.length;

export function daysLabel(days) {
  const set = ORDER.filter((x) => days.includes(x));
  if (!set.length) return 'aucun jour';
  if (set.length === 7) return 'tous les jours';
  const key = set.join('');
  if (key === '12345') return 'du lundi au vendredi';
  if (key === '60') return 'le week-end';
  const idx = set.map((x) => ORDER.indexOf(x));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && set.length > 2) return `du ${DAY_NAMES[set[0]]} au ${DAY_NAMES[set[set.length - 1]]}`;
  return set.map((x) => DAY_NAMES[x].slice(0, 3)).join(', ');
}

const quizMinutes = (q) => Math.max(5, Math.round(q.questions.length * 0.75));

export function items(d) {
  const out = [];
  d.modules.forEach((m, mi) => {
    m.lessons.forEach((l, li) => out.push({
      key: S.lessonKey(d, l), type: 'lesson', title: l.title, minutes: l.minutes || 10, mi, li,
      done: S.isLessonDone(d, l), doneAt: S.state.progress.lessons[S.lessonKey(d, l)] || 0,
      go: { name: 'lesson', id: d.id, mi, li }
    }));
    if (m.quiz) {
      const k = S.quizKey(d, m);
      out.push({ key: k, type: 'quiz', title: m.quiz.title || `Test : ${m.title}`, minutes: quizMinutes(m.quiz), mi,
        done: S.isPassed(k, m.quiz), doneAt: passedAt(k, m.quiz), go: { name: 'quiz', id: d.id, mi } });
    }
  });
  if (d.exam) {
    const k = S.examKey(d);
    out.push({ key: k, type: 'exam', title: 'Examen final', minutes: quizMinutes(d.exam),
      done: S.isPassed(k, d.exam), doneAt: passedAt(k, d.exam), go: { name: 'quiz', id: d.id, mi: 'exam' } });
  }
  return out;
}

function passedAt(key, q) {
  const a = (S.state.progress.attempts[key] || []).find((x) => x.pct >= S.passScore(q));
  return a ? a.date : 0;
}

const dayKey = (date) => S.today(date);
const addDays = (date, n) => { const x = new Date(date); x.setDate(x.getDate() + n); return x; };
const midnight = (date = new Date()) => { const x = new Date(date); x.setHours(0, 0, 0, 0); return x; };

function allocate(list, sc, from, firstCapacity) {
  const days = new Map();
  if (!sc.days.length || sc.minutes <= 0) return { days, end: null };
  let date = midnight(from);
  let cap = sc.days.includes(date.getDay()) ? firstCapacity : 0;
  let guard = 0;
  const nextDay = () => {
    do { date = addDays(date, 1); guard++; } while (!sc.days.includes(date.getDay()) && guard < 4000);
    cap = sc.minutes;
  };
  if (cap <= 0) nextDay();
  for (const it of list) {
    let rem = it.minutes, part = 0;
    while (rem > 0 && guard < 4000) {
      const k = dayKey(date);
      const slot = days.get(k) || [];
      if (cap < 5 && slot.length) { nextDay(); continue; }
      if (cap <= 0) { nextDay(); continue; }
      const fitsWithSlack = rem <= cap * 1.25;
      const take = fitsWithSlack ? rem : Math.min(rem, cap);
      slot.push({ ...it, planned: take, part: part++, cont: part > 1 || take < rem });
      days.set(k, slot);
      rem -= take;
      cap -= take;
      if (rem > 0) nextDay();
    }
  }
  const keys = [...days.keys()];
  return { days, end: keys.length ? keys[keys.length - 1] : null };
}

const cache = new Map();
export function resetCache() { cache.clear(); }

export function plan(d) {
  if (cache.has(d.id)) return cache.get(d.id);
  const res = computePlan(d);
  cache.set(d.id, res);
  return res;
}

function computePlan(d) {
  const sc = schedule(d);
  const all = items(d);
  const todayK = S.today();
  const doneToday = all.filter((it) => it.done && it.doneAt && S.today(new Date(it.doneAt)) === todayK);
  const used = doneToday.reduce((a, it) => a + it.minutes, 0);
  const remaining = all.filter((it) => !it.done);
  const { days, end } = allocate(remaining, sc, new Date(), Math.max(0, sc.minutes - used));
  const totalMin = all.reduce((a, it) => a + it.minutes, 0);
  const remainingMin = remaining.reduce((a, it) => a + it.minutes, 0);
  return { sc, all, days, end, doneToday, todayPlanned: days.get(todayK) || [], totalMin, remainingMin, finished: !remaining.length && all.length > 0 };
}

export function baselineEnd(d) {
  const sc = schedule(d);
  const { end } = allocate(items(d).filter((it) => !it.done), sc, new Date(), sc.minutes);
  return end;
}

export function ensureTarget(d) {
  if (!d.modules.length) return;
  if (!d.schedule) d.schedule = { ...DEFAULT_SCHEDULE, days: [...DEFAULT_SCHEDULE.days] };
  if (!d.schedule.target) { d.schedule.target = baselineEnd(d); S.save(); }
}

export function status(d, p) {
  if (p.finished) return { kind: 'ok', label: 'Terminé' };
  const target = d.schedule?.target;
  if (!target || !p.end) return null;
  const diff = Math.round((new Date(p.end) - new Date(target)) / 86400000);
  if (diff <= -2) return { kind: 'ok', label: `En avance de ${-diff} j` };
  if (diff >= 2) return { kind: 'ko', label: `En retard de ${diff} j` };
  return { kind: 'neutral', label: 'Dans les temps' };
}

export function weeks(d, p, maxWeeks = 10) {
  const start = midnight();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const endDate = p.end ? new Date(p.end) : start;
  const n = Math.min(maxWeeks, Math.max(1, Math.ceil((endDate - start) / (7 * 86400000)) + 1));
  const log = S.state.progress.log;
  const todayK = S.today();
  const out = [];
  for (let w = 0; w < n; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, w * 7 + i);
      const k = dayKey(date);
      const planned = p.days.get(k) || [];
      row.push({
        date, k,
        study: p.sc.days.includes(date.getDay()),
        today: k === todayK,
        past: k < todayK,
        planned,
        plannedMin: planned.reduce((a, x) => a + x.planned, 0),
        doneMin: Math.round(log[k]?.[d.id] || 0)
      });
    }
    out.push(row);
  }
  return { rows: out, more: Math.ceil((endDate - start) / (7 * 86400000)) + 1 > n };
}
