import sys, re, os, json, html, codecs
sys.path.insert(0, os.path.dirname(__file__))
from get import fetch, CACHE
import urllib.request, hashlib

def mixed(err):
    b = err.object[err.start:err.end]
    return (b.decode('cp1252', 'replace'), err.end)
codecs.register_error('mixed', mixed)

def page(url):
    fetch(url)
    full = 'https://www.anglaisfacile.com' + url
    fn = os.path.join(CACHE, hashlib.md5(full.encode()).hexdigest() + '.html')
    return open(fn, 'rb').read().decode('utf-8', 'mixed')

def parse_form(s):
    j = s.find('name="form2"')
    if j < 0: return []
    k = s.find('</form>', j)
    f = s[j:k if k > 0 else None]
    qs = []
    n = 1
    while True:
        r = re.search(r'name="r%d" value="(.*?)"' % n, f, re.S)
        q = re.search(r'name="q%d" value="(.*?)">' % n, f, re.S)
        if not r: break
        sel = re.search(r'<select name="p%d">(.*?)</select>' % n, f, re.S)
        opts = re.findall(r'<option value="([^"]*)"[^>]*>(.*?)</option>', sel.group(1)) if sel else None
        qs.append({'n': n, 'answer': html.unescape(r.group(1)), 'q': html.unescape(q.group(1)) if q else '', 'options': [html.unescape(o[1]) for o in opts if o[0] != ''] if opts else None})
        n += 1
    return qs

def body(s):
    i = s.find('</H1>')
    j = s.find('<IMG SRC="/etoile.gif"')
    if i < 0 or j < 0: return ''
    b = s[i + 5:j]
    b = re.sub(r'<DIV ALIGN=LEFT><B>\s*$', '', b)
    return b

if __name__ == '__main__':
    out = []
    for line in open(sys.argv[2], encoding='utf-8'):
        pid, rest = line.split('\t', 1)
        pid = pid.strip()
        s = page('/cgi2/myexam/voir2.php?id=' + pid)
        t = re.search(r'<H1>(.*?)</H1>', s, re.S)
        out.append({'id': pid, 'index': [c.strip() for c in rest.strip().split('\t')], 'title': html.unescape(re.sub('<[^>]+>', '', t.group(1))).strip() if t else '', 'body': body(s), 'questions': parse_form(s)})
    json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
    for o in out:
        kinds = {'select' if q['options'] else 'text' for q in o['questions']}
        print(o['id'], len(o['body']), len(o['questions']), kinds, o['title'][:60])
