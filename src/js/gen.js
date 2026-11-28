const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const uniq = (a) => [...new Set(a)];

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function words(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + words(n % 100) : '');
  if (n < 1e6) {
    const r = n % 1000;
    return words(Math.floor(n / 1000)) + ' thousand' + (r ? (r < 100 ? ' and ' : ' ') + words(r) : '');
  }
  const r = n % 1e6;
  return words(Math.floor(n / 1e6)) + ' million' + (r ? (r < 100 ? ' and ' : ' ') + words(r) : '');
}
const variants = (t) => uniq([t, t.replace(/ and /g, ' ')].flatMap((x) => [x, x.replace(/-/g, ' ')]));
const fmt = (n) => n.toLocaleString('en-US');

const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
function ordinal(n) {
  const w = words(n);
  const parts = w.split('-');
  const last = parts.pop();
  const o = ORD[last] || (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th');
  return [...parts, o].join('-');
}
const suffix = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');

const AAN = [
  ['umbrella', 'parapluie', 'an'], ['apple', 'pomme', 'an'], ['egg', 'œuf', 'an'], ['orange', 'orange', 'an'], ['island', 'île', 'an'],
  ['hour', 'heure', 'an'], ['heir', 'héritier', 'an'], ['honest man', 'homme honnête', 'an'], ['elephant', 'éléphant', 'an'], ['idea', 'idée', 'an'],
  ['onion', 'oignon', 'an'], ['owl', 'hibou', 'an'], ['ant', 'fourmi', 'an'], ['uncle', 'oncle', 'an'], ['eye', 'œil', 'an'], ['ear', 'oreille', 'an'],
  ['engineer', 'ingénieur', 'an'], ['oven', 'four', 'an'], ['insect', 'insecte', 'an'], ['armchair', 'fauteuil', 'an'], ['envelope', 'enveloppe', 'an'],
  ['airport', 'aéroport', 'an'], ['artist', 'artiste', 'an'], ['ice cream', 'glace', 'an'], ['old car', 'vieille voiture', 'an'], ['easy test', 'test facile', 'an'],
  ['university', 'université', 'a'], ['uniform', 'uniforme', 'a'], ['European country', 'pays européen', 'a'], ['unicorn', 'licorne', 'a'], ['user', 'utilisateur', 'a'],
  ['house', 'maison', 'a'], ['horse', 'cheval', 'a'], ['hat', 'chapeau', 'a'], ['hospital', 'hôpital', 'a'], ['dog', 'chien', 'a'], ['book', 'livre', 'a'],
  ['car', 'voiture', 'a'], ['year', 'année', 'a'], ['window', 'fenêtre', 'a'], ['table', 'table', 'a'], ['school', 'école', 'a'], ['yard', 'cour', 'a'],
  ['one-way street', 'rue à sens unique', 'a'], ['useful tool', 'outil utile', 'a'], ['big apple', 'grosse pomme', 'a'], ['young man', 'jeune homme', 'a'],
];

const ADJ = [
  ['big', 'grand, gros', 'bigger', 'biggest'], ['small', 'petit', 'smaller', 'smallest'], ['tall', 'grand (taille)', 'taller', 'tallest'],
  ['old', 'vieux', 'older', 'oldest'], ['young', 'jeune', 'younger', 'youngest'], ['fast', 'rapide', 'faster', 'fastest'], ['slow', 'lent', 'slower', 'slowest'],
  ['cheap', 'bon marché', 'cheaper', 'cheapest'], ['long', 'long', 'longer', 'longest'], ['short', 'court', 'shorter', 'shortest'],
  ['hot', 'chaud', 'hotter', 'hottest'], ['thin', 'mince', 'thinner', 'thinnest'], ['fat', 'gros', 'fatter', 'fattest'], ['nice', 'gentil', 'nicer', 'nicest'],
  ['large', 'vaste', 'larger', 'largest'], ['happy', 'heureux', 'happier', 'happiest'], ['easy', 'facile', 'easier', 'easiest'],
  ['pretty', 'joli', 'prettier', 'prettiest'], ['funny', 'drôle', 'funnier', 'funniest'], ['busy', 'occupé', 'busier', 'busiest'],
  ['heavy', 'lourd', 'heavier', 'heaviest'], ['strong', 'fort', 'stronger', 'strongest'], ['cold', 'froid', 'colder', 'coldest'],
  ['good', 'bon', 'better', 'best'], ['bad', 'mauvais', 'worse', 'worst'], ['far', 'loin', ['farther', 'further'], ['farthest', 'furthest']],
  ['expensive', 'cher', 'more expensive', 'most expensive'], ['intelligent', 'intelligent', 'more intelligent', 'most intelligent'],
  ['beautiful', 'beau', 'more beautiful', 'most beautiful'], ['difficult', 'difficile', 'more difficult', 'most difficult'],
  ['interesting', 'intéressant', 'more interesting', 'most interesting'], ['comfortable', 'confortable', 'more comfortable', 'most comfortable'],
  ['dangerous', 'dangereux', 'more dangerous', 'most dangerous'], ['important', 'important', 'more important', 'most important'],
  ['famous', 'célèbre', 'more famous', 'most famous'], ['careful', 'prudent', 'more careful', 'most careful'],
];

const VERBS = [
  ['cook', 'cuisiner', 'cooked'], ['stop', 'arrêter', 'stopped'], ['play', 'jouer', 'played'], ['study', 'étudier', 'studied'], ['watch', 'regarder', 'watched'],
  ['work', 'travailler', 'worked'], ['live', 'vivre', 'lived'], ['travel', 'voyager', ['travelled', 'traveled']], ['visit', 'visiter', 'visited'], ['open', 'ouvrir', 'opened'],
  ['try', 'essayer', 'tried'], ['plan', 'prévoir', 'planned'], ['want', 'vouloir', 'wanted'], ['like', 'aimer', 'liked'], ['walk', 'marcher', 'walked'],
  ['go', 'aller', 'went'], ['see', 'voir', 'saw'], ['eat', 'manger', 'ate'], ['drink', 'boire', 'drank'], ['buy', 'acheter', 'bought'], ['bring', 'apporter', 'brought'],
  ['think', 'penser', 'thought'], ['take', 'prendre', 'took'], ['make', 'faire, fabriquer', 'made'], ['come', 'venir', 'came'], ['give', 'donner', 'gave'],
  ['get', 'obtenir', 'got'], ['have', 'avoir', 'had'], ['do', 'faire', 'did'], ['say', 'dire', 'said'], ['write', 'écrire', 'wrote'], ['read', 'lire', 'read'],
  ['swim', 'nager', 'swam'], ['run', 'courir', 'ran'], ['sing', 'chanter', 'sang'], ['begin', 'commencer', 'began'], ['find', 'trouver', 'found'],
  ['know', 'savoir, connaître', 'knew'], ['leave', 'partir', 'left'], ['meet', 'rencontrer', 'met'], ['sleep', 'dormir', 'slept'], ['speak', 'parler', 'spoke'],
  ['tell', 'raconter', 'told'], ['teach', 'enseigner', 'taught'], ['catch', 'attraper', 'caught'], ['fly', 'voler (avion)', 'flew'], ['drive', 'conduire', 'drove'],
  ['break', 'casser', 'broke'], ['choose', 'choisir', 'chose'], ['forget', 'oublier', 'forgot'], ['lose', 'perdre', 'lost'], ['pay', 'payer', 'paid'],
  ['put', 'mettre', 'put'], ['sell', 'vendre', 'sold'], ['send', 'envoyer', 'sent'], ['sit', "s'asseoir", 'sat'], ['stand', 'être debout', 'stood'],
  ['understand', 'comprendre', 'understood'], ['win', 'gagner', 'won'], ['wear', 'porter (vêtement)', 'wore'], ['feel', 'ressentir', 'felt'], ['keep', 'garder', 'kept'],
  ['hear', 'entendre', 'heard'], ['become', 'devenir', 'became'], ['build', 'construire', 'built'], ['cut', 'couper', 'cut'], ['fall', 'tomber', 'fell'],
  ['grow', 'grandir', 'grew'], ['hold', 'tenir', 'held'], ['ride', 'monter (à cheval, à vélo)', 'rode'], ['spend', 'dépenser', 'spent'], ['steal', 'voler (dérober)', 'stole'], ['throw', 'lancer', 'threw'],
];
const arr = (x) => (Array.isArray(x) ? x : [x]);

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function timeAnswers(h, m) {
  const H = words(h), N = words(h % 12 + 1);
  let a;
  if (m === 0) a = [`${H} o'clock`, H];
  else if (m === 15) a = [`a quarter past ${H}`, `quarter past ${H}`, `fifteen past ${H}`, `fifteen minutes past ${H}`];
  else if (m === 30) a = [`half past ${H}`, `thirty minutes past ${H}`];
  else if (m === 45) a = [`a quarter to ${N}`, `quarter to ${N}`, `fifteen to ${N}`, `fifteen minutes to ${N}`];
  else if (m < 30) a = [`${words(m)} past ${H}`, `${words(m)} minutes past ${H}`, `${words(m)} minute past ${H}`];
  else a = [`${words(60 - m)} to ${N}`, `${words(60 - m)} minutes to ${N}`, `${words(60 - m)} minute to ${N}`];
  if (m >= 10) a.push(`${H} ${words(m)}`);
  return uniq(a.flatMap((x) => [x, `it's ${x}`, `it is ${x}`]).flatMap(variants));
}

const SECTION = {
  aan: 'Complète avec a ou an.',
  n99: 'Écris le nombre en toutes lettres, ou en chiffres selon la question.',
  big: 'Écris le nombre en toutes lettres.',
  time: "Écris l'heure en anglais avec past ou to.",
  date: 'Écris la date en anglais, ou le nombre ordinal en toutes lettres.',
  comp: "Donne le comparatif de supériorité de l'adjectif.",
  sup: "Donne le superlatif de l'adjectif, avec the.",
  pret: 'Conjugue le verbe au prétérit.',
};

const MAKERS = {
  aan() {
    const [w, fr, art] = pick(AAN);
    return { q: `____ ${w} (${fr})`, choices: ['a', 'an'], answer: art === 'a' ? 0 : 1, explain: art === 'an' ? `« ${w} » commence par un son voyelle : an.` : `« ${w} » commence par un son consonne : a.` };
  },
  n99() {
    const n = rnd(1, 99);
    if (Math.random() < 0.3) return { type: 'text', q: `${words(n)} = ____ (en chiffres)`, accept: [String(n)] };
    return { type: 'text', q: `${n} ____`, accept: variants(words(n)) };
  },
  big() {
    const n = pick([() => rnd(100, 999), () => rnd(1000, 9999), () => rnd(10000, 99999), () => rnd(1, 9) * 1000 + rnd(1, 99), () => rnd(100000, 999999)])();
    return { type: 'text', q: `${fmt(n)} ____`, accept: variants(words(n)), explain: `${fmt(n)} = ${words(n)}` };
  },
  time() {
    const h = rnd(1, 12), m = Math.random() < 0.8 ? rnd(0, 11) * 5 : rnd(1, 59);
    const ans = timeAnswers(h, m);
    return { type: 'text', q: `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')} = it's ____`, accept: ans, explain: `it's ${ans[0].replace(/^it's /, '')}` };
  },
  date() {
    if (Math.random() < 0.4) {
      const n = rnd(1, 31);
      return { type: 'text', q: `${n}${suffix(n)} => the ____`, accept: variants(ordinal(n)) };
    }
    const dt = new Date(rnd(1990, 2030), rnd(0, 11), rnd(1, 28));
    const d = dt.getDate(), M = MONTHS_EN[dt.getMonth()], D = DAYS_EN[dt.getDay()], y = dt.getFullYear();
    const a = [`${D}, ${M} ${d}${suffix(d)} ${y}`, `${D}, ${M} ${d} ${y}`, `${D}, ${M} ${d}${suffix(d)}, ${y}`, `${D}, ${M} ${d}, ${y}`, `${D}, ${d}${suffix(d)} ${M} ${y}`, `${D}, the ${d}${suffix(d)} of ${M} ${y}`];
    return { type: 'text', q: `${DAYS_FR[dt.getDay()]} ${d} ${MONTHS_FR[dt.getMonth()]} ${y} ____`, accept: uniq(a.flatMap((x) => [x, x.replace(/, /g, ' ')])), explain: a[0] };
  },
  comp() {
    const [w, fr, c] = pick(ADJ);
    return { type: 'text', q: `${w} (${fr}) ____`, accept: arr(c), explain: arr(c).join(' ou ') };
  },
  sup() {
    const [w, fr, , s] = pick(ADJ);
    return { type: 'text', q: `${w} (${fr}) => ____`, accept: arr(s).flatMap((x) => [`the ${x}`, x]), explain: arr(s).map((x) => `the ${x}`).join(' ou ') };
  },
  pret() {
    const [v, fr, p] = pick(VERBS);
    return { type: 'text', q: `${pick(['I', 'You', 'He', 'She', 'We', 'They'])} ____ (${v} / ${fr})`, accept: arr(p), explain: `${v} → ${arr(p).join(' ou ')}` };
  },
};

const BY_TITLE = {
  "L'article indéfini A/AN": 'aan', 'Compter de 1 à 99': 'n99', 'Les nombres supérieurs à 100': 'big', "Dire l'heure": 'time',
  'Dire la date': 'date', 'Les comparatifs': 'comp', 'Le superlatif': 'sup', 'Le prétérit': 'pret',
};

export const generatorFor = (d, l) => (d?.group === 'anglais' && BY_TITLE[l?.title]) || null;

export function generate(type, n = 10) {
  const out = [], seen = new Set();
  for (let i = 0; out.length < n && i < n * 20; i++) {
    const x = MAKERS[type]();
    if (seen.has(x.q)) continue;
    seen.add(x.q);
    out.push({ ...x, section: SECTION[type] });
  }
  return out;
}
