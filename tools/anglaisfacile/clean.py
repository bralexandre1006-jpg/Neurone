import re, html
from html.parser import HTMLParser

VOID = {'br', 'img', 'hr', 'source', 'input', 'meta'}
KEEP = {'p': 'p', 'br': 'br', 'table': 'table', 'tr': 'tr', 'td': 'td', 'th': 'th', 'ul': 'ul', 'ol': 'ol', 'li': 'li',
        'i': 'em', 'em': 'em', 'u': 'u', 'strong': 'strong', 'hr': None, 's': 's', 'strike': 's'}

class Node:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.kids = tag, dict(attrs or []), parent, []

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root'); self.cur = self.root
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur); self.cur.kids.append(n)
        if tag not in VOID: self.cur = n
    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, attrs, self.cur))
    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag: n = n.parent
        if n is not self.root: self.cur = n.parent
    def handle_data(self, d):
        self.cur.kids.append(d)

def esc(t): return html.escape(t, quote=False)

def ser(n, audio_map):
    out = []
    for k in n.kids:
        if isinstance(k, str):
            out.append(esc(k)); continue
        t = k.tag
        inner = lambda: ser(k, audio_map)
        if t in ('script', 'style', 'img', 'input', 'select', 'form'): continue
        if t == 'audio':
            src = next((c.attrs.get('src') for c in k.kids if isinstance(c, Node) and c.tag == 'source'), None) or k.attrs.get('src')
            if src: out.append(audio_map(src))
            continue
        if t == 'font':
            color = (k.attrs.get('color') or '').lower()
            size = k.attrs.get('size') or ''
            colored = color and color not in ('#000000', 'black', '#000')
            big = size in ('4', '5', '6', '+1', '+2')
            body = inner()
            if colored and big: out.append(f'<strong class="big">{body}</strong>')
            elif colored: out.append(f'<strong>{body}</strong>')
            else: out.append(body)
            continue
        if t in ('b', 'span', 'div', 'tbody', 'a', 'center', 'r', 'sup', 'sub'):
            out.append(inner()); continue
        if t == 'hr': out.append('<hr>'); continue
        m = KEEP.get(t)
        if m == 'br': out.append('<br>'); continue
        if m: out.append(f'<{m}>{inner()}</{m}>'); continue
        out.append(inner())
    return ''.join(out)

def clean(src_html, audio_map):
    p = P(); p.feed(src_html); p.close()
    s = ser(p.root, audio_map)
    s = '<p>' + s + '</p>'
    s = s.replace('\xa0', ' ')
    s = re.sub(r'<strong>\s*</strong>|<em>\s*</em>|<strong class="big">\s*</strong>', '', s)
    for _ in range(3):
        s = re.sub(r'<strong>(\s*)<strong>(.*?)</strong>(\s*)</strong>', r'<strong>\1\2\3</strong>', s, flags=re.S)
    s = re.sub(r'(<br>\s*){3,}', '</p><p>', s)
    s = re.sub(r'<p>\s*(<br>\s*)+', '<p>', s)
    s = re.sub(r'(<br>\s*)+</p>', '</p>', s)
    s = re.sub(r'<p>\s*</p>', '', s)
    s = re.sub(r'<p>(<p>)+', '<p>', s); s = re.sub(r'(</p>)+', '</p>', s)
    def head(m):
        inner = re.sub(r'</?strong[^>]*>', '', m.group(1)).strip().rstrip(':').strip()
        return f'<h2>{inner}</h2>' if inner else ''
    s = re.sub(r'<p>\s*<strong class="big">((?:(?!</p>).)*?)</strong>\s*(?::\s*)?</p>', head, s, flags=re.S)
    s = s.replace('<strong class="big">', '<strong>')
    s = re.sub(r'[ \t]{2,}', ' ', s)
    s = re.sub(r'<td>\s*</td>', '<td></td>', s)
    s = re.sub(r'<table>', '<div class="table-wrap"><table>', s); s = s.replace('</table>', '</table></div>')
    s = re.sub(r'<p>\s*</p>', '', s)
    return s.strip()

def text_of(src_html):
    p = P(); p.feed(src_html); p.close()
    def walk(n):
        r = []
        for k in n.kids:
            if isinstance(k, str): r.append(k)
            elif k.tag == 'br': r.append('\n')
            elif k.tag in ('audio', 'script', 'style'): continue
            else:
                r.append(walk(k))
                if k.tag in ('p', 'div', 'tr', 'li', 'hr'): r.append('\n')
        return ''.join(r)
    return walk(p.root).replace('\xa0', ' ')
