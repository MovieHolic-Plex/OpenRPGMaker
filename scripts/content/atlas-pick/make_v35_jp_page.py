#!/usr/bin/env python3
"""jp v35-A 비교 페이지: 옛 고른 후보 | v35-A | 히어로 16x24 와 같은 배율 + 1m(16px) 안내선.
  python3 scripts/content/atlas-pick/make_v35_jp_page.py  → ~/claude-viz/v35-jp.html (자체완결, data URI)"""
import os, sys, json, io, base64, sqlite3
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from modern_style_bible_proof import K, Cv, hero
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAND = os.path.join(ROOT, 'tiledata/atlas-pick/candidates-jp')
SL = 'vending_drink vending_cig vending_coffee vending_ice konbini_pole ped_signal tomare_sign jp_signal mamachari garbage_station phone_booth bus_stop_jp standing_sign komainu_a komainu_un'.split()
SC = 6

def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def old_choice(slug):
    d = os.path.join(CAND, slug)
    try:
        import urllib.request
        st = json.load(urllib.request.urlopen('http://127.0.0.1:18303/api/state?set=jp', timeout=5))
        it = [i for i in st['items'] if i['id'] == slug][0]
        ch = (it.get('pick') or {}).get('choice')
        if ch and os.path.exists(f'{d}/{ch}.png'): return ch
    except Exception: pass
    for c in ('v34-A', 'j5-A', 'j1-A', 'j2-A', 'j3-A', 'j4-A', 'j6-A'):
        if os.path.exists(f'{d}/{c}.png'): return c
    fs = sorted(f for f in os.listdir(d) if f.endswith('.png') and 'x4' not in f and 'ctx' not in f and not f.startswith('v35'))
    return fs[0][:-4] if fs else None

def scaled(im):
    return im.resize((im.width * SC, im.height * SC), Image.NEAREST)

def with_hero(im):
    w, h = im.size; pad = 6
    c = Cv(w + 16 + pad * 2, max(h, 24) + 4)
    c.R(0, 0, c.a.shape[1], c.a.shape[0], K('hodo', 1))
    base = Image.fromarray(c.a, 'RGBA'); fl = base.height - 3
    base.alpha_composite(im, (pad, fl - h)); c.a = np.array(base)
    hero(c, pad + w + 2, fl - 24)
    out = Image.fromarray(c.a, 'RGBA').resize((base.width * SC, base.height * SC), Image.NEAREST)
    px = out.load()
    for m in range(1, 6):                                            # 1m = 16px 안내선(바닥 기준)
        y = (fl - 16 * m) * SC
        if y < 0: break
        for x in range(0, out.width, 4):
            if 0 <= y < out.height: px[x, y] = (0, 220, 255, 255)
    return out

rows = []
for s in SL:
    d = os.path.join(CAND, s); oc = old_choice(s)
    new = Image.open(f'{d}/v35-A.png').convert('RGBA')
    old = Image.open(f'{d}/{oc}.png').convert('RGBA') if oc else None
    note = open(f'{d}/v35-A.note').read().strip()
    bg = 'background:#6d6675;image-rendering:pixelated'
    rows.append(f'''<section><h2>{s} <small>{new.width}x{new.height} · 옛 {oc} {old.width if old else "-"}x{old.height if old else "-"}</small></h2>
<div class=r><figure><img style="{bg}" src="{uri(scaled(old)) if old else ""}"><figcaption>옛 {oc}</figcaption></figure>
<figure><img style="{bg}" src="{uri(scaled(new))}"><figcaption>v35-A</figcaption></figure>
<figure><img style="image-rendering:pixelated" src="{uri(with_hero(new))}"><figcaption>히어로 16x24 옆 · 하늘색 점선 = 1m(16px)</figcaption></figure></div>
<p>{note}</p></section>''')
html = f'''<!doctype html><meta charset=utf-8><title>jp v35-A 규격 재작도</title>
<style>body{{background:#1d1b20;color:#e8e3dc;font:14px/1.5 sans-serif;margin:20px}}section{{border-top:1px solid #3a3640;padding:10px 0}}
h2{{margin:4px 0}}small{{color:#9b958d;font-weight:400}}.r{{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}}figure{{margin:0}}figcaption{{color:#9b958d;font-size:12px}}p{{color:#bbb;margin:4px 0}}</style>
<h1>jp 세트 v35-A — 칸 규격(1칸=16px=1m) 손 도트 재작도 {len(SL)}종</h1>
<p>각 줄: 옛 고른 후보 | 새 v35-A | 히어로와 나란히(같은 배율). 볼 것: ① 사람 옆에서 크기가 맞나 ② 윗면이 위에서 본 판으로 읽히나. 제외(exempt): taxi_black, taxi_yellow, utility_pole, sakura_tree.</p>
{"".join(rows)}'''
out = os.path.expanduser('~/claude-viz/v35-jp.html'); open(out, 'w').write(html); print(out, len(html) // 1024, 'KB')
