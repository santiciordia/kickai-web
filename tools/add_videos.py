#!/usr/bin/env python3
"""Agrega links de VEO a videos.json.
Uso: python3 tools/add_videos.py <id-torneo> < links.txt     (un link por línea)
Fecha, hora, cancha y formato se leen del propio link. No duplica links ya cargados."""
import sys, re, json, datetime
P = 'videos.json'
tid = sys.argv[1]
d = json.load(open(P))
t = next((x for x in d['tournaments'] if x['id'] == tid), None)
if t is None:
    t = {'id': tid, 'name': sys.argv[2] if len(sys.argv) > 2 else tid, 'place': '', 'matches': []}; d['tournaments'].append(t)
have = {m['url'] for m in t['matches']}
ids = {m['id'] for m in t['matches']}
add = 0
for u in sys.stdin.read().split():
    if not u.startswith('http') or u in have: continue
    pu = u.split('?')[0].split('#')[0]  # solo la ruta, sin parámetros
    dd = re.search(r'matches/(\d{4})(\d{2})(\d{2})-', pu)
    if not dd: print('sin fecha:', u); continue
    c = re.search(r'cancha-(\d+[a-z]?)-', pu); h = re.search(r'-(\d{1,2})hs', pu); f = re.search(r'-f(\d+)-', pu)
    dt = datetime.date(int(dd[1]), int(dd[2]), int(dd[3]))
    if h and int(h[1]) >= 21: dt -= datetime.timedelta(days=1)  # partidos de las 21+ vienen con fecha del día siguiente
    vid = re.search(r'-(v[0-9a-f]{7})/?$', pu)
    mid = 'v' + (vid[1] if vid else str(len(ids)))
    m = {'id': mid, 'date': dt.isoformat(), 'time': f'{int(h[1]):02d}:00' if h else '', 'field': f'Cancha {c[1].upper()}' if c else '',
         'home': '', 'away': '', 'fmt': f'F{f[1]}' if f else '', 'gender': '', 'url': u}
    tm = re.search(r'hs-(.+?)-vs-(.+?)-v[0-9a-f]{7}/?$', pu)
    if tm: m['home'], m['away'] = [re.sub(r'\bFc\b', 'FC', x.replace('-', ' ').title()) for x in tm.groups()]
    if 'primer-tiempo' in pu: m['note'] = 'Primer tiempo'
    t['matches'].append(m); have.add(u); ids.add(mid); add += 1
t['matches'].sort(key=lambda m: (m['date'], m['field'], m['time']), reverse=True)
json.dump(d, open(P, 'w'), ensure_ascii=False, indent=1)
print('agregados:', add, '· total en', t['name'] + ':', len(t['matches']))
