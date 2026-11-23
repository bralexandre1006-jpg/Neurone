import sys, re, html, json
rows = []
s = open(sys.argv[1], encoding='utf-8', errors='replace').read()
for m in re.finditer(r'<tr>\s*<th[^>]*><FONT SIZE=2>(\d+)</FONT></th>(.*?)</tr>', s, re.S | re.I):
    n, body = m.group(1), m.group(2)
    cells = [re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', c))).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>', body, re.S | re.I)]
    ids = re.findall(r'voir2\.php\?id=(\d+)', body)
    rows.append({'n': int(n), 'title': cells[0] if cells else '', 'sub': cells[1] if len(cells) > 1 else '', 'ids': ids})
tests = sorted(set(re.findall(r'voir2\.php\?id=(\d+)[^"\']*', s)) - {i for r in rows for i in r['ids']})
json.dump({'rows': rows, 'other': tests}, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
print(len(rows), 'rows', sum(len(r['ids']) for r in rows), 'pages; other ids', len(tests))
