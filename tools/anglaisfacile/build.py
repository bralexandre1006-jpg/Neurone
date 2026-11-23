import sys, os, re, json, html, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from clean import clean, text_of

raw = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
AUDIO_DIR = os.path.join(OUT, 'audio', 'anglais')
os.makedirs(AUDIO_DIR, exist_ok=True)
os.makedirs(os.path.join(OUT, 'courses'), exist_ok=True)
audio_files = set()

def amap_factory():
    def amap(src):
        name = os.path.basename(src)
        audio_files.add(src)
        word = re.sub(r'^\d+_', '', os.path.splitext(name)[0]).replace('_', ' ')
        return f'<button class="say" data-src="audio/anglais/{name}" title="Écouter « {html.escape(word)} »"></button>'
    return amap
amap = amap_factory()

def conv_questions(qs):
    out, section = [], None
    for q in qs:
        srcs = re.findall(r"<source src='([^']+)'", q['q'])
        lines = [re.sub(r'\s+', ' ', l).strip() for l in text_of(q['q']).split('\n')]
        lines = [l for l in lines if l]
        idx = next((i for i, l in enumerate(lines) if '*' in l), len(lines) - 1 if lines else 0)
        header = ' '.join(lines[:idx]).strip()
        item = ' '.join(lines[idx:]).strip()
        if item.startswith('*'):
            rest = item[1:].strip()
            item = rest if rest else '____'
        else:
            item = item.replace('*', '____')
        item = re.sub(r'_{5,}', '____', item)
        o = {'q': item}
        if header: o['section'] = header
        if srcs:
            for s in srcs: amap(s)
            o['audio'] = 'audio/anglais/' + os.path.basename(srcs[0])
        if q['options']:
            ans = q['answer'].strip()
            ch = [c.strip() for c in q['options']]
            if ans not in ch: ch.append(ans)
            o['choices'], o['answer'] = ch, ch.index(ans)
        else:
            o['type'] = 'text'
            o['accept'] = [a.strip() for a in q['answer'].split('§') if a.strip()]
        out.append(o)
    return out

def minutes(body, nq):
    words = len(re.sub('<[^>]+>', ' ', body).split())
    return max(6, min(45, round(words / 110 + nq * 0.8)))

def cap(t):
    t = t.strip().rstrip('.').strip()
    return t[:1].upper() + t[1:]

MODULES = [
    ('Premiers pas', "L'article, l'auxiliaire BE, les adjectifs et les deux présents."),
    ('Nombres, heure et comparaisons', "Compter, dire l'heure, comparer et indiquer la possession."),
    ('Modaux, passé et futur', 'CAN, MUST, MAY, le prétérit, les relatives et le futur.'),
    ('Articles, present perfect et quantités', "THE ou pas THE, le present perfect, l'opinion et les quantifieurs."),
    ('Hypothèses, conseils et past perfect', "Le conditionnel, BE + -ING au passé, conseiller, suggérer, le plus-que-parfait."),
    ('Passif, discours rapporté et questions', 'Le passif, le style indirect et les questions.'),
    ('Se débrouiller en ville', "La date, les directions, les prépositions et faire du shopping."),
]

TITLES = {
    'Les 3 comparatifs: supériorité, égalité, infériorité': 'Les comparatifs',
    "MAY & DON'T HAVE TO": "MAY et DON'T HAVE TO",
    'Le PRESENT PERFECT': 'Le present perfect',
    'Les quantifieurs SOME, ANY, NO, TOO MUCH/TOO MANY, ENOUGH': 'Les quantifieurs : some, any, no, too much, enough',
    'Quelques quantifieurs supplémentaires; le difficile problème des noms dénombrables/indénombrables': 'Dénombrables et indénombrables',
    'Le past perfect/plus-que-parfait/plu perfect': 'Le past perfect (plus-que-parfait)',
    'Style direct > Style indirect': 'Le style indirect',
    'Ordres et conseils + Style indirect > Style direct': 'Le style indirect : ordres et conseils',
    'Les nombres ordinaux, cardinaux, les jours, les mois': 'Dire la date',
    'Les directions / la signalisation routière': 'Demander son chemin',
    'Les couleurs, les vêtements, émettre un choix, proposer quelque chose': 'Acheter un vêtement',
    'A/AN, THE, article zéro': 'Les articles : a/an, the, article zéro',
    'Les structures hypothétiques, le conditionnel': 'Hypothèses et conditionnel',
    "L'auxiliaire BE": "L'auxiliaire BE (être)",
}
modules, cur, exam_pool = [], [], []
mi = 0
for o in raw:
    is_bilan = o['index'][0].upper().startswith('BILAN')
    if is_bilan:
        title, summary = MODULES[mi]
        qs = conv_questions(o['questions'])
        exam_pool.append(qs)
        modules.append({'id': f'm{mi + 1}', 'title': title, 'summary': summary, 'week': mi * 2 + 1, 'lessons': cur,
                        'quiz': {'title': f'Bilan {mi + 1}', 'passScore': 70, 'questions': qs}})
        cur, mi = [], mi + 1
        continue
    num, objective = o['index'][0], o['index'][1] if len(o['index']) > 1 else ''
    objective = re.sub(r'\s*ATTENTION!.*$', '', objective).strip()
    point = o['index'][2] if len(o['index']) > 2 else ''
    title = cap(point) if point else cap(objective)
    title = TITLES.get(title, title)
    body = clean(o['body'], amap)
    intro = ''
    m = re.search(r'<h2>[^<]*Exercice[^<]*</h2>(.*)$', body, re.S | re.I)
    if m:
        intro = m.group(1).strip()
        intro = re.sub(r'^\s*<p>\s*</p>', '', intro)
        body = body[:m.start()].rstrip()
    lesson = {'id': f'l{o["id"]}', 'title': title, 'minutes': minutes(body, len(o['questions'])),
              'content': (f'<p class="lead">{html.escape(cap(objective))}.</p>' if objective and point else '') + body}
    if o['questions']:
        lesson['exercise'] = {'title': 'Exercice', 'intro': intro, 'passScore': 70, 'questions': conv_questions(o['questions'])}
    cur.append(lesson)

exam = []
for qs in exam_pool:
    step = max(1, len(qs) // 5)
    exam += [dict(q) for q in qs[::step][:5]]
for q in exam: q.pop('section', None)

course = {
    'id': 'anglais-debutant',
    'group': 'anglais',
    'levelOrder': 1,
    'name': 'Anglais',
    'level': 'Débutant',
    'icon': 'uk',
    'color': '#60a5fa',
    'durationWeeks': 14,
    'description': "Le cours pour débutants d'anglaisfacile.com : 35 leçons en 7 modules, avec exercices, bilans et examen final.",
    'goal': "Maîtriser les bases de l'anglais : grammaire essentielle, nombres, heure, temps du passé et du futur, se repérer en ville.",
    'source': {'name': 'anglaisfacile.com', 'url': 'https://www.anglaisfacile.com/beginners/index.php', 'note': 'Contenu repris avec l\'autorisation du site.'},
    'modules': modules,
    'exam': {'title': 'Examen final', 'passScore': 75, 'questions': exam},
}
json.dump(course, open(os.path.join(OUT, 'courses', 'anglais-debutant.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump([{'id': course['id'], 'file': 'courses/anglais-debutant.json', 'name': course['name'], 'level': course['level'], 'icon': course['icon'], 'color': course['color'],
            'description': course['description'], 'lessons': sum(len(m['lessons']) for m in modules), 'modules': len(modules)}],
          open(os.path.join(OUT, 'courses', 'index.json'), 'w'), ensure_ascii=False, indent=1)

for src in sorted(audio_files):
    fn = os.path.join(AUDIO_DIR, os.path.basename(src))
    if not os.path.exists(fn):
        req = urllib.request.Request('https://www.anglaisfacile.com' + src, headers={'User-Agent': 'Mozilla/5.0'})
        open(fn, 'wb').write(urllib.request.urlopen(req, timeout=30).read())
print('modules', len(modules), 'lessons', sum(len(m['lessons']) for m in modules), 'exam', len(exam), 'audio', len(audio_files))
for m in modules: print(' ', m['title'], [l['title'] for l in m['lessons']], len(m['quiz']['questions']))
