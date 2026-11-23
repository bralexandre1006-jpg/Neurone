"""Convertit un niveau du Guide de travail d'anglaisfacile.com en cursus Neurone.

Usage : python3 build_guide.py <cache_dir> <guide.json> <niveau: intermediaire|avance> <src_dir>
"""
import sys, os, re, json, html, random, urllib.request

CACHE, GUIDE, LEVEL, OUT = sys.argv[1:5]
sys.argv = [sys.argv[0], CACHE]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import page, body
from clean import clean, text_of

AUDIO_DIR = os.path.join(OUT, 'audio', 'anglais')
os.makedirs(AUDIO_DIR, exist_ok=True)
audio_files = set()


def amap(src):
    name = os.path.basename(src.split('?')[0])
    audio_files.add(src)
    word = re.sub(r'^\d+_', '', os.path.splitext(name)[0]).replace('_', ' ')
    return f'<button class="say" data-src="audio/anglais/{name}" title="Écouter « {html.escape(word)} »"></button>'


def parse_form(s):
    j = s.find('name="form2"')
    if j < 0:
        return []
    k = s.find('</form>', j)
    f = s[j:k if k > 0 else None]
    out, n = [], 1
    while True:
        r = re.search(r'name="r%d" value="(.*?)"' % n, f, re.S)
        if not r:
            break
        q = re.search(r'name="q%d" value="(.*?)">' % n, f, re.S)
        sel = re.search(r'<select name="p%d">(.*?)</select>' % n, f, re.S)
        opts = re.findall(r'<option value="([^"]*)"[^>]*>(.*?)</option>', sel.group(1)) if sel else None
        words = re.findall(r'elements\["p%d"\]\.value \+= "(.*?) ?";' % n, f)
        out.append({
            'answer': html.unescape(r.group(1)),
            'q': html.unescape(q.group(1)) if q else '',
            'options': [html.unescape(o[1]) for o in opts if o[0] != ''] if opts else None,
            'words': [html.unescape(w).strip() for w in words] if words else None,
        })
        n += 1
    return out


def conv_questions(qs):
    out = []
    for q in qs:
        srcs = re.findall(r"<source src='([^']+)'", q['q'])
        lines = [re.sub(r'\s+', ' ', l).strip() for l in text_of(q['q']).split('\n')]
        lines = [l for l in lines if l]
        idx = next((i for i, l in enumerate(lines) if '*' in l), len(lines) - 1 if lines else 0)
        header = ' '.join(lines[:idx]).strip()
        item = ' '.join(lines[idx:]).strip()
        if item.startswith('*'):
            item = item[1:].strip() or '____'
        elif item.endswith('*') and q['words']:
            item = item[:-1].strip()
        else:
            item = item.replace('*', '____')
        item = re.sub(r'_{5,}', '____', item)
        o = {'q': item}
        if header:
            o['section'] = header
        if srcs:
            amap(srcs[0])
            o['audio'] = 'audio/anglais/' + os.path.basename(srcs[0].split('?')[0])
        if q['options']:
            ans = q['answer'].strip()
            ch = [c.strip() for c in q['options']]
            if ans not in ch:
                ch.append(ans)
            o['choices'], o['answer'] = ch, ch.index(ans)
        else:
            o['type'] = 'text'
            o['accept'] = [a.strip() for a in q['answer'].split('§') if a.strip()]
            if q['words']:
                w = q['words'][:]
                random.Random(item).shuffle(w)
                o['words'] = w
        if o.get('accept') == [] or (not o.get('choices') and o.get('type') != 'text'):
            continue
        out.append(o)
    return out


def page_title(s):
    t = re.search(r'<H1>(.*?)</H1>', s, re.S)
    t = html.unescape(re.sub('<[^>]+>', '', t.group(1))).strip() if t else ''
    t = re.sub(r'\s*[-:]\s*(cours|le[cç]on)s?( d\'anglais| de grammaire[^-]*)?\s*$', '', t, flags=re.I)
    t = re.sub(r'\s*-\s*cours d\'anglais.*$', '', t, flags=re.I)
    return t.strip() or 'Exercice'


def cap(t):
    t = t.strip().rstrip('.').strip()
    return t[:1].upper() + t[1:]


MODULES = {
    'intermediaire': [
        (6, 'Goûts, souhaits et exclamations', "Exprimer ses goûts, ses regrets, s'exclamer, placer adjectifs et adverbes"),
        (12, 'Banque, dates et courrier', 'Vie pratique, noms composés, contractions et rédaction'),
        (18, 'Décrire et situer dans le temps', 'For, since, during, ago, préfixes et suffixes'),
        (24, 'Futur parfait, genre et Royaume-Uni', 'Les futurs avancés, have got et la culture britannique'),
        (30, 'Do, make, modaux et travail', 'Majuscules, périphrases modales, déplacements et monde du travail'),
        (36, 'Météo, nature et préférences', 'Vocabulaire du quotidien et pluriels compliqués'),
        (43, 'Ponctuation, present perfect et prononciation', 'Génitif, present perfect en ING, pronoms réfléchis et verbes irréguliers'),
    ],
    'avance': [
        (6, 'Sigles, accord et anglais familier', 'Abréviations, SMS, so do I / neither, both et argot'),
        (12, 'Gérondif, argent et mots de liaison', 'ING ou infinitif, économie et connecteurs'),
        (18, 'Comparaisons et pièges', 'Double comparatif, AS/LIKE, faire faire, faux amis et quantités'),
        (25, 'Used to, médias et anglais américain', 'Habitudes passées, propositions infinitives et culture américaine'),
        (31, 'Cuisine, prépositions et passif', 'Recettes, prépositions, passif expert, pays et politesse'),
        (38, 'Say/tell, sports et en ville', 'Say, tell, speak, there is, this/that, téléphone et déplacements'),
        (45, 'Transports, subjonctif et entreprise', 'Moyens de transport, subjonctif, confusions et vie professionnelle'),
        (52, 'Voyager et calculer', 'Verbes irréguliers compliqués, hôtel, avion, train et maths'),
        (58, 'Quantifieurs, questions et relatives', 'Much/many, question tags, questions complexes, that et what/which'),
    ],
}

guide = json.load(open(GUIDE))
level_name = {'intermediaire': 'Intermédiaire', 'avance': 'Avancé'}[LEVEL]
modules, cur, mi = [], [], 0
bounds = MODULES[LEVEL]

for r in guide['rows']:
    parts, qsets = [], []
    for k, pid in enumerate(r['ids']):
        s = page('/cgi2/myexam/voir2.php?id=' + pid)
        t = page_title(s)
        b = clean(body(s), amap)
        intro = ''
        m = re.search(r'<h2>[^<]*Exercice[^<]*</h2>(.*)$', b, re.S | re.I)
        if m:
            intro = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1)))).strip()
            b = b[:m.start()].rstrip()
        if len(re.sub('<[^>]+>', '', b).strip()) > 160:
            parts.append(f'<h2>{html.escape(t)}</h2>{b}')
        qs = conv_questions(parse_form(s))
        if qs:
            label = f'Partie {"ABC"[k]} · {t}' + (f' — {intro}' if intro and len(intro) < 220 else '')
            qs[0]['section'] = label + (f' · {qs[0]["section"]}' if qs[0].get('section') else '')
            qsets.append(qs)
    title = cap(r['title'])
    sub = r['sub'] if r['sub'] and r['sub'] != '>>' else ''
    content = (f'<p class="lead">{html.escape(cap(sub))}</p>' if sub else '') + ''.join(parts)
    if not parts:
        content += '<p>Cette étape est composée d\'exercices d\'application : lance l\'exercice ci-dessous.</p>'
    allq = [q for qs in qsets for q in qs]
    words = len(re.sub('<[^>]+>', ' ', content).split())
    lesson = {'id': f'g{LEVEL[:3]}{r["n"]}', 'title': title, 'minutes': max(8, min(45, round(words / 110 + len(allq) * 0.6))), 'content': content}
    if allq:
        lesson['exercise'] = {'title': 'Exercice', 'passScore': 70, 'questions': allq}
    cur.append(lesson)
    if mi < len(bounds) and r['n'] == bounds[mi][0]:
        _, mt, ms = bounds[mi]
        pool = [q for l in cur for q in l.get('exercise', {}).get('questions', [])]
        rnd = random.Random(f'{LEVEL}-{mi}')
        picks = []
        for l in cur:
            qs = l.get('exercise', {}).get('questions', [])
            picks += rnd.sample(qs, min(3, len(qs)))
        picks = [dict(q) for q in picks][:24]
        for q in picks:
            q.pop('section', None)
        modules.append({'id': f'm{mi + 1}', 'title': mt, 'summary': ms, 'week': mi * 2 + 1, 'lessons': cur,
                        'quiz': {'title': f'Bilan {mi + 1}', 'passScore': 70, 'questions': picks}})
        cur, mi = [], mi + 1

exam_pool = [q for m in modules for q in m['quiz']['questions']]
exam = random.Random(LEVEL + '-exam').sample(exam_pool, min(40, len(exam_pool)))

course_id = f'anglais-{LEVEL}'
order = {'intermediaire': 2, 'avance': 3}[LEVEL]
n_less = sum(len(m['lessons']) for m in modules)
course = {
    'id': course_id, 'group': 'anglais', 'levelOrder': order,
    'name': 'Anglais', 'level': level_name, 'icon': 'globe', 'color': '#60a5fa',
    'durationWeeks': len(modules) * 2,
    'description': f"Le guide de travail niveau {level_name.lower()} d'anglaisfacile.com : {n_less} étapes en {len(modules)} modules.",
    'goal': {'intermediaire': "Consolider la grammaire et l'anglais pratique du quotidien : goûts, regrets, durées, courrier, travail, voyages.",
             'avance': 'Maîtriser les subtilités : gérondif, faux amis, used to, passif, question tags, anglais britannique et américain.'}[LEVEL],
    'unlock': {'prev': 'anglais-debutant' if order == 2 else 'anglais-intermediaire', 'minAvg': 80},
    'source': {'name': 'anglaisfacile.com', 'url': f'https://www.anglaisfacile.com/guide/guide-{"intermediaire" if order == 2 else "avance"}.php', 'note': "Contenu repris avec l'autorisation du site. Bilans et examen composés à partir des exercices du site."},
    'modules': modules,
    'exam': {'title': 'Examen final', 'passScore': 75, 'questions': exam},
}
json.dump(course, open(os.path.join(OUT, 'courses', course_id + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

for src in sorted(audio_files):
    fn = os.path.join(AUDIO_DIR, os.path.basename(src.split('?')[0]))
    if os.path.exists(fn):
        continue
    url = src if src.startswith('http') else 'https://www.anglaisfacile.com' + (src if src.startswith('/') else '/' + src)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        open(fn, 'wb').write(urllib.request.urlopen(req, timeout=30).read())
    except Exception as e:
        print('audio KO', src, e)

print(course_id, 'modules', len(modules), 'lessons', n_less, 'questions', sum(len(l.get('exercise', {}).get('questions', [])) for m in modules for l in m['lessons']), 'audio', len(audio_files))
