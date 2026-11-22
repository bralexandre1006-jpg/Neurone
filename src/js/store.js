import { DEMO_DOMAINS } from './demo.js';

const KEY = 'neurone.v1';
export const PASS_DEFAULT = 70;

function blank() {
  return {
    version: 1,
    domains: structuredClone(DEMO_DOMAINS),
    progress: { lessons: {}, attempts: {}, log: {} },
    settings: { collapsed: false }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.domains)) return blank();
    s.progress ||= { lessons: {}, attempts: {}, log: {} };
    s.progress.lessons ||= {};
    s.progress.attempts ||= {};
    s.progress.log ||= {};
    s.settings ||= { collapsed: false };
    return s;
  } catch {
    return blank();
  }
}

export const state = load();

let saveTimer = 0;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  }, 150);
}
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
});

export const uid = (p = 'd') => p + Math.random().toString(36).slice(2, 9);
export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const lessonKey = (d, l) => `${d.id}/${l.id}`;
export const quizKey = (d, m) => `${d.id}/${m.id}/quiz`;
export const examKey = (d) => `${d.id}/exam`;

export const getDomain = (id) => state.domains.find((d) => d.id === id);

export function bestScore(key) {
  const a = state.progress.attempts[key];
  if (!a || !a.length) return null;
  return Math.max(...a.map((x) => x.pct));
}
export const passScore = (q) => q?.passScore ?? PASS_DEFAULT;
export const isPassed = (key, q) => (bestScore(key) ?? -1) >= passScore(q);
export const isLessonDone = (d, l) => !!state.progress.lessons[lessonKey(d, l)];

export function moduleState(d, idx) {
  const m = d.modules[idx];
  const lessonsDone = m.lessons.filter((l) => isLessonDone(d, l)).length;
  const prev = idx === 0 || isPassed(quizKey(d, d.modules[idx - 1]), d.modules[idx - 1].quiz);
  const allLessons = lessonsDone === m.lessons.length;
  const quizPassed = m.quiz ? isPassed(quizKey(d, m), m.quiz) : allLessons;
  return { unlocked: prev, lessonsDone, allLessons, quizUnlocked: prev && allLessons, quizPassed, done: allLessons && quizPassed };
}

export function examUnlocked(d) {
  return d.modules.length > 0 && d.modules.every((m, i) => moduleState(d, i).done);
}

export function domainStats(d) {
  let total = 0, done = 0, lessons = 0, lessonsDone = 0, minutes = 0;
  d.modules.forEach((m) => {
    m.lessons.forEach((l) => {
      total++; lessons++;
      minutes += l.minutes || 0;
      if (isLessonDone(d, l)) { done++; lessonsDone++; }
    });
    if (m.quiz) { total++; if (isPassed(quizKey(d, m), m.quiz)) done++; }
  });
  if (d.exam) { total++; if (isPassed(examKey(d), d.exam)) done++; }
  return { pct: total ? Math.round((done / total) * 100) : 0, lessons, lessonsDone, minutes, modules: d.modules.length };
}

export function nextLesson(d) {
  for (let i = 0; i < d.modules.length; i++) {
    const ms = moduleState(d, i);
    if (!ms.unlocked) return null;
    const m = d.modules[i];
    const l = m.lessons.find((x) => !isLessonDone(d, x));
    if (l) return { type: 'lesson', mi: i, lesson: l, module: m };
    if (m.quiz && !ms.quizPassed) return { type: 'quiz', mi: i, module: m };
  }
  if (d.exam && examUnlocked(d) && !isPassed(examKey(d), d.exam)) return { type: 'exam' };
  return null;
}

export function logStudy(domainId, minutes) {
  const k = today();
  const day = (state.progress.log[k] ||= {});
  day[domainId] = (day[domainId] || 0) + minutes;
}

export function streak() {
  const log = state.progress.log;
  let n = 0;
  const d = new Date();
  if (!log[today(d)]) d.setDate(d.getDate() - 1);
  while (log[today(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function setLessonDone(d, l, done) {
  const k = lessonKey(d, l);
  if (done && !state.progress.lessons[k]) {
    state.progress.lessons[k] = Date.now();
    logStudy(d.id, l.minutes || 10);
  } else if (!done) {
    delete state.progress.lessons[k];
  }
  save();
}

export function recordAttempt(key, domainId, correct, total) {
  const pct = Math.round((correct / total) * 100);
  (state.progress.attempts[key] ||= []).push({ pct, correct, total, date: Date.now() });
  logStudy(domainId, Math.max(3, Math.round(total * 1.2)));
  save();
  return pct;
}

export function deleteDomain(id) {
  state.domains = state.domains.filter((d) => d.id !== id);
  const pre = id + '/';
  for (const k of Object.keys(state.progress.lessons)) if (k.startsWith(pre)) delete state.progress.lessons[k];
  for (const k of Object.keys(state.progress.attempts)) if (k.startsWith(pre)) delete state.progress.attempts[k];
  save();
}

export function normalizeCurriculum(data) {
  const src = data.modules ? data : null;
  if (!src || !Array.isArray(src.modules)) throw new Error('Le fichier ne contient pas de liste « modules ».');
  const modules = src.modules.map((m, i) => {
    if (!m.title) throw new Error(`Module ${i + 1} : titre manquant.`);
    return {
      id: String(m.id || 'm' + (i + 1)),
      title: String(m.title),
      summary: m.summary ? String(m.summary) : '',
      week: m.week ?? null,
      lessons: (m.lessons || []).map((l, j) => ({
        id: `${m.id || 'm' + (i + 1)}-${l.id || 'l' + (j + 1)}`,
        title: String(l.title || `Leçon ${j + 1}`),
        minutes: Number(l.minutes) || 10,
        content: String(l.content || ''),
        audio: Array.isArray(l.audio) ? l.audio.filter((x) => x && x.src).map((x) => ({ src: String(x.src), title: String(x.title || 'Audio') })) : []
      })),
      quiz: m.quiz ? normQuiz(m.quiz) : null
    };
  });
  return { modules, exam: src.exam ? normQuiz(src.exam) : null };
}

function normQuiz(q) {
  if (!Array.isArray(q.questions) || !q.questions.length) throw new Error('Un quiz ne contient aucune question.');
  return {
    title: q.title || '',
    passScore: Number(q.passScore) || PASS_DEFAULT,
    questions: q.questions.map((x) => ({
      q: String(x.q),
      choices: x.choices.map(String),
      answer: Number(x.answer),
      explain: x.explain ? String(x.explain) : ''
    }))
  };
}

export function exportAll() {
  return JSON.stringify({ app: 'neurone', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importAll(text) {
  const s = JSON.parse(text);
  if (!Array.isArray(s.domains) || !s.progress) throw new Error('Sauvegarde Neurone invalide.');
  state.domains = s.domains;
  state.progress = s.progress;
  state.settings = s.settings || state.settings;
  save();
}

export function resetAll() {
  const b = blank();
  state.domains = b.domains;
  state.progress = b.progress;
  save();
}
