#!/usr/bin/env python3
"""modern_campus 관문 현황 — art/ 세 등록부 + 실내 가구·바닥·벽면의 현재 그림 해시 영수증을 센다. python3 gate_report.py [--fails]"""
import os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'interior'))
import bake_mc as BM
TB = BM.TB
rows = []
for it in BM._art_items():
    rows.append((it['group'], it['id'], it['kind'], TB.gate_status(it['png'], it['kind']) if os.path.exists(it['png']) else 'PNG 없음'))
import campus_interior as CI
from PIL import Image
for id_, (a, kind, ko) in CI.kit_images().items():
    rows.append(('interior', id_, kind, TB.gate_status(Image.fromarray(a, 'RGBA'), kind)))
c = collections.Counter((g, s in ('pass', 'prov')) for g, _, _, s in rows)
for g in ('terrain', 'buildings', 'props', 'interior'):
    print('%-9s 통과 %3d · 막힘 %3d' % (g, c[(g, True)], c[(g, False)]))
if '--fails' in sys.argv:
    for g, i, k, s in rows:
        if s not in ('pass', 'prov'): print('  ', g, i, k, s[:90])
