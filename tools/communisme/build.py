"""Construit src/courses/communisme.json à partir des fichiers mNN.md + exam.md.

Format :
  # mN | Titre du module | Résumé
  ## L | Titre de leçon | minutes      (L = leçon, F = film, R = lecture)
  ...markdown léger...
  ### EX                               (exercice de la leçon)
  ### BILAN                            (test de fin de module, en fin de fichier)
  ? Question QCM          + bonne réponse   - mauvaise réponse   = explication
  ?t Question écrite      + réponse acceptée (une par ligne)     = explication
"""
import os, re, json, html, glob

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'courses', 'communisme.json')


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)', r'<em>\1</em>', t)
    return t


def md(lines):
    out, para, lst, quote = [], [], [], []

    def flush():
        nonlocal para, lst, quote
        if para:
            out.append('<p>' + inline(' '.join(para)) + '</p>'); para = []
        if lst:
            out.append('<ul>' + ''.join(f'<li>{inline(x)}</li>' for x in lst) + '</ul>'); lst = []
        if quote:
            out.append('<div class="note">' + inline(' '.join(quote)) + '</div>'); quote = []

    for raw in lines:
        l = raw.rstrip()
        if not l.strip():
            flush(); continue
        if l.startswith('#### '):
            flush(); out.append(f'<h2>{inline(l[5:])}</h2>'); continue
        if l.startswith('- '):
            if para or quote: flush()
            lst.append(l[2:]); continue
        if l.startswith('> '):
            if para or lst: flush()
            quote.append(l[2:]); continue
        if lst or quote: flush()
        para.append(l.strip())
    flush()
    return ''.join(out)


def questions(lines):
    qs, cur = [], None
    for raw in lines:
        l = raw.strip()
        if not l:
            continue
        if l.startswith('?t '):
            cur = {'type': 'text', 'q': l[3:].strip(), 'accept': []}; qs.append(cur)
        elif l.startswith('? '):
            cur = {'q': l[2:].strip(), 'choices': [], 'answer': None}; qs.append(cur)
        elif l.startswith('+ '):
            if cur.get('type') == 'text':
                cur['accept'].append(l[2:].strip())
            else:
                cur['answer'] = len(cur['choices']); cur['choices'].append(l[2:].strip())
        elif l.startswith('- '):
            cur['choices'].append(l[2:].strip())
        elif l.startswith('= '):
            cur['explain'] = l[2:].strip()
        else:
            raise ValueError('Ligne inattendue : ' + l)
    for q in qs:
        if q.get('type') != 'text' and (q['answer'] is None or len(q['choices']) < 2):
            raise ValueError('QCM invalide : ' + q['q'])
        if q.get('type') == 'text' and not q['accept']:
            raise ValueError('Question écrite sans réponse : ' + q['q'])
    return qs


def parse(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    mid, title, summary = [x.strip() for x in lines[0][2:].split('|')]
    mod = {'id': mid, 'title': title, 'summary': summary, 'lessons': [], 'quiz': None}
    blocks, cur = [], None
    for l in lines[1:]:
        if l.startswith('## '):
            kind, t, mins = [x.strip() for x in l[3:].split('|')]
            cur = {'kind': kind, 'title': t, 'minutes': int(mins), 'body': [], 'ex': None}
            blocks.append(cur)
        elif l.startswith('### EX'):
            cur['ex'] = []
        elif l.startswith('### BILAN'):
            cur = {'kind': 'BILAN', 'ex': []}
            blocks.append(cur)
        elif cur is not None:
            (cur['ex'] if cur['ex'] is not None else cur['body']).append(l)
    n = 0
    for b in blocks:
        if b['kind'] == 'BILAN':
            mod['quiz'] = {'title': f'Bilan {mid[1:]}', 'passScore': 70, 'questions': questions(b['ex'])}
            continue
        n += 1
        les = {'id': f'{mid}l{n}', 'title': b['title'], 'minutes': b['minutes'], 'content': md(b['body'])}
        if b['kind'] == 'F': les['kind'] = 'film'
        if b['kind'] == 'R': les['kind'] = 'lecture'
        if b['ex']:
            les['exercise'] = {'title': 'Exercice', 'passScore': 70, 'questions': questions(b['ex'])}
        mod['lessons'].append(les)
    return mod


mods = [parse(p) for p in sorted(glob.glob(os.path.join(HERE, 'm[0-9][0-9].md')))]
bil_path = os.path.join(HERE, 'bilans.md')
if os.path.exists(bil_path):
    secs = re.split(r'^# (m\d+)\s*$', open(bil_path, encoding='utf-8').read(), flags=re.M)
    over = {secs[i]: questions(secs[i + 1].split('\n')) for i in range(1, len(secs), 2)}
    for m in mods:
        if m['id'] in over:
            m['quiz']['questions'] = over[m['id']]

works, works_quiz = [], None
wp = os.path.join(HERE, 'works.md')
if os.path.exists(wp):
    txt = open(wp, encoding='utf-8').read()
    main, _, ctrl = txt.partition('### CONTROLE')
    for blk in re.split(r'^## ', main, flags=re.M)[1:]:
        head, _, body = blk.partition('\n')
        t, wid, title, author, year, length = [x.strip() for x in head.split('|')]
        why, _, ctrl_w = body.partition('### CTRL')
        w = {'type': t, 'id': wid, 'title': title, 'author': author, 'year': year, 'length': length, 'why': ' '.join(why.split())}
        if ctrl_w.strip():
            w['quiz'] = {'title': f'Contrôle : {title}', 'passScore': 80, 'questions': questions(ctrl_w.split('\n'))}
        works.append(w)
    works_quiz = {'title': 'Contrôle des œuvres', 'passScore': 70, 'questions': questions(ctrl.split('\n'))}
for i, m in enumerate(mods):
    m['week'] = i + 1
exam_path = os.path.join(HERE, 'exam.md')
exam = {'title': 'Examen final', 'passScore': 75, 'questions': questions(open(exam_path, encoding='utf-8').read().split('\n'))} if os.path.exists(exam_path) else None

course = {
    'id': 'communisme', 'name': 'Communisme', 'level': 'Approfondi', 'icon': 'commu', 'color': '#e5484d',
    'durationWeeks': 13,
    'description': "De Marx au communisme rotatif : la Commune de Paris, l'URSS, la Chine, les expériences libertaires, Athènes, Bookchin, les zapatistes, la démocratie délibérative et la planification.",
    'goal': "Maîtriser toutes les sources et les contre-exemples du communisme rotatif, et savoir défendre ou critiquer le modèle avec des faits.",
    'modules': mods,
    'exam': exam,
    'works': works,
    'worksQuiz': works_quiz,
}
json.dump(course, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
total = sum(l['minutes'] for m in mods for l in m['lessons'])
print(len(mods), 'modules', sum(len(m['lessons']) for m in mods), 'items', total, 'min de leçons/films/lectures',
      sum(len(l.get('exercise', {}).get('questions', [])) for m in mods for l in m['lessons']), 'questions d\'exercice',
      sum(len(m['quiz']['questions']) for m in mods if m['quiz']), 'questions de bilan', len(exam['questions']) if exam else 0, 'à l\'examen')
