import sys, re, os, hashlib, urllib.request, html
CACHE = sys.argv[1]
def fetch(url):
    if url.startswith('/'): url = 'https://www.anglaisfacile.com' + url
    fn = os.path.join(CACHE, hashlib.md5(url.encode()).hexdigest() + '.html')
    if not os.path.exists(fn):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        data = urllib.request.urlopen(req, timeout=30).read()
        open(fn, 'wb').write(data)
    b = open(fn, 'rb').read()
    try: return b.decode('utf-8')
    except UnicodeDecodeError: return b.decode('cp1252', 'replace')
def text(s):
    s = re.sub(r'(?is)<(script|style|noscript).*?</\1>', ' ', s)
    s = re.sub(r'(?i)<br\s*/?>|</p>|</div>|</tr>|</h\d>|</li>', '\n', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html.unescape(s)
    return re.sub(r'[ \t\xa0]+', ' ', re.sub(r'\n\s*\n+', '\n', s)).strip()
def links(s):
    return re.findall(r'href="([^"#]+)"[^>]*>(.*?)</a>', s, re.S)
if __name__ == '__main__':
    mode, url = sys.argv[2], sys.argv[3]
    s = fetch(url)
    if mode == 'text': print(text(s)[:int(sys.argv[4]) if len(sys.argv) > 4 else 6000])
    elif mode == 'links':
        pat = sys.argv[4] if len(sys.argv) > 4 else ''
        seen = set()
        for h, t in links(s):
            if pat in h and h not in seen:
                seen.add(h); print(h, '|', re.sub(r'\s+', ' ', re.sub('<[^>]+>', '', html.unescape(t))).strip()[:80])
    elif mode == 'raw': print(s[:int(sys.argv[4]) if len(sys.argv) > 4 else 6000])
