#!/usr/bin/env python3
"""v35-modern.html — 옛 후보(v34-A/v0) · v35-A · 히어로 16x24 를 같은 배율·1m 안내선과 함께 비교하는 자체완결 페이지."""
import os, sys, base64, io, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
from modern_style_bible_proof import Cv, hero
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAND = os.path.join(ROOT, 'tiledata', 'atlas-pick', 'candidates-modern')
OUT = os.path.expanduser('~/claude-viz/v35-modern.html')
ITEMS = [('gn_delivery_scooter', '배달 오토바이', '2x2칸'), ('mo_ped_signal', '보행 신호등', '1x3칸'), ('gn_bike_share', '공유 자전거 거치대', '3x2칸'),
         ('gn_street_stall', '포장마차', '2x3칸'), ('mo_sculpture', '조각 기념비', '1x3칸')]
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
hc = Cv(16, 24); hero(hc, 0, 0); HERO = Image.fromarray(hc.a, 'RGBA')
Z = 6
cards = []
for slug, name, cells in ITEMS:
    d = os.path.join(CAND, slug)
    old = 'v34-A' if os.path.exists(os.path.join(d, 'v34-A.png')) else 'v0'
    new = Image.open(os.path.join(d, 'v35-A.png')).convert('RGBA'); oi = Image.open(os.path.join(d, old + '.png')).convert('RGBA')
    chk = json.load(open(os.path.join(d, 'v35-A.check.json'))) if os.path.exists(os.path.join(d, 'v35-A.check.json')) else {}
    def fig(im, label):
        w, h = im.size
        return f'<figure><div class="stage" style="width:{w*Z}px;height:{h*Z}px"><img src="{uri(im)}" style="width:{w*Z}px;height:{h*Z}px"><div class="g" style="background-size:{16*Z}px {16*Z}px"></div></div><figcaption>{label} {w}x{h}</figcaption></figure>'
    cards.append(f'<section><h2>{name} <small>{slug} · {cells}</small></h2><div class="row">{fig(oi, "옛 " + old)}{fig(new, "v35-A")}{fig(Image.open(os.path.join(d, "v35-B.png")).convert("RGBA"), "v35-B (자전거 2대 + 작은 단말기)") if os.path.exists(os.path.join(d, "v35-B.png")) else ""}{fig(HERO, "히어로 16x24 (1.5m)")}</div></section>')
html = f'''<!doctype html><meta charset="utf-8"><title>v35 강남·현대 재작도</title><style>
body{{background:#2a2830;color:#ddd;font:14px sans-serif;margin:20px}} h1{{font-size:18px}} h2{{font-size:15px;margin:22px 0 6px}} small{{color:#999;font-weight:400}}
.row{{display:flex;gap:28px;align-items:flex-end;background:#403d4a;padding:14px;border-radius:6px;overflow-x:auto}} figure{{margin:0}}
.stage{{position:relative;background:#6b6778}} img{{image-rendering:pixelated;display:block;position:relative;z-index:1}}
.g{{position:absolute;inset:0;z-index:2;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,.22) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.22) 1px,transparent 1px);background-position:0 100%}}
figcaption{{margin-top:4px;color:#aaa;font-size:12px}}</style>
<h1>v35-A 강남·현대 5종 — 옛 후보 / 새 손도트 / 히어로 (같은 배율 x{Z}, 격자선 = 1m = 16px)</h1>
<p>바닥이 아래쪽 기준선. 격자 한 칸이 1m, 히어로는 1.5m(24px). 제외 5종(버스·승용차 2·은행나무·플라타너스)은 exempt.</p>{''.join(cards)}'''
open(OUT, 'w', encoding='utf-8').write(html); print(OUT, len(html))
