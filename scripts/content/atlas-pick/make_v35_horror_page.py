#!/usr/bin/env python3
"""v35-horror.html — 호러 8종: 옛 후보(v34-A/h5-A) · v35-A · 히어로 16x24 를 같은 배율·1m 안내선과 함께 비교하고,
새 조각 옆에 히어로를 세운 맥락 그림(어두운 마룻바닥 위)까지 담는 자체완결 페이지."""
import os, sys, base64, io, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
from modern_style_bible_proof import Cv, hero
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAND = os.path.join(ROOT, 'tiledata', 'atlas-pick', 'candidates-horror')
OUT = os.path.expanduser('~/claude-viz/v35-horror.html')
ITEMS = [('pillar_stone', '돌기둥', '1x4칸', 'v34-A'), ('bed_manor', '저택 침대', '1x2칸', 'v34-A'), ('dresser', '서랍장', '1x2칸', 'v34-A'),
         ('hosp_bed', '병원 침대', '1x2칸', 'v34-A'), ('bedside_cabinet', '침대 협탁', '2x1칸', 'v34-A'),
         ('canopy_bed_rot', '썩은 천개 침대', '2x2칸', 'h5-A'), ('wheelchair', '휠체어', '1x2칸', 'v34-A'), ('operating_table', '수술대', '1x2칸', 'h5-A')]
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
hc = Cv(16, 24); hero(hc, 0, 0); HERO = Image.fromarray(hc.a, 'RGBA')
Z = 6
def ctx(new):
    """바닥판 위 발을 같은 줄에 맞춰 조각 · 히어로를 나란히 세운다(조각 캔버스 아래 줄 = 바닥 줄)."""
    w, h = new.size; W = w + 16 + 16 + 8; H = max(h, 24) + 8
    im = Image.new('RGBA', (W, H), (52, 40, 36, 255))
    for y in range(0, H, 8):
        for x in range(0, W, 8):
            if (x // 8 + y // 8) % 2: im.paste((58, 45, 40, 255), (x, y, x + 8, y + 8))
    base = H - 4
    im.alpha_composite(new, (4, base - h)); im.alpha_composite(HERO, (4 + w + 8, base - 24))
    return im
def fig(im, label, z=Z, grid=True):
    w, h = im.size
    g = f'<div class="g" style="background-size:{16*z}px {16*z}px"></div>' if grid else ''
    return f'<figure><div class="stage" style="width:{w*z}px;height:{h*z}px"><img src="{uri(im)}" style="width:{w*z}px;height:{h*z}px">{g}</div><figcaption>{label} {w}x{h}</figcaption></figure>'
cards = []
for slug, name, cells, old in ITEMS:
    d = os.path.join(CAND, slug)
    new = Image.open(os.path.join(d, 'v35-A.png')).convert('RGBA'); oi = Image.open(os.path.join(d, old + '.png')).convert('RGBA')
    cards.append(f'<section><h2>{name} <small>{slug} · 표 {cells}</small></h2><div class="row">{fig(oi, "옛 " + old)}{fig(new, "v35-A")}{fig(HERO, "히어로 16x24 (1.5m)")}{fig(ctx(new), "v35-A + 히어로 나란히", 6, False)}</div></section>')
B = [('canopy_bed_rot', '썩은 천개 침대', '2x3칸 (32x48, 세로 N+1)'), ('wheelchair', '휠체어', '1x1칸 (16x16)'), ('operating_table', '수술대', '2x1칸 (32x16, 가로형)')]
bcards = []
for slug, name, cells in B:
    d = os.path.join(CAND, slug)
    a = Image.open(os.path.join(d, 'v35-A.png')).convert('RGBA'); b = Image.open(os.path.join(d, 'v35-B.png')).convert('RGBA')
    bcards.append(f'<section><h2>{name} <small>{slug} · v35-B {cells}</small></h2><div class="row">{fig(a, "v35-A (지우지 않음)")}{fig(b, "v35-B")}{fig(HERO, "히어로 16x24 (1.5m)")}{fig(ctx(b), "v35-B + 히어로 나란히", 6, False)}</div></section>')
def room(n):
    return uri(Image.open(os.path.join(ROOT, 'tiledata', 'atlas-pick', 'rooms-horror', n + '.png')).convert('RGB'))
rooms = ''.join(f'<figure><img class="rm" src="{room(r + "-v35b")}"><figcaption>{t} (v35-B)</figcaption></figure>' for r, t in (('manor_bedroom', '저택 침실'), ('operating_room', '수술실'), ('ward_room', '병실')))
bsec = f'<h1 id="b">v35-B — 약한 3개 재작도 (배율 x{Z})</h1><p>천개 침대는 세로를 3칸으로 늘려 기둥·천 지붕·늘어진 천을 살렸고, 휠체어는 1x1, 수술대는 2x1 가로형. 수술대 위 조명은 32x16 에 안 들어가서 뺐다.</p>' + ''.join(bcards) + '<h2>방에 놓은 모습</h2><div class="rooms">' + rooms + '</div><hr>'
html = f'''<!doctype html><meta charset="utf-8"><title>v35 호러 재작도</title><style>
body{{background:#2a2830;color:#ddd;font:14px sans-serif;margin:20px}} h1{{font-size:18px}} h2{{font-size:15px;margin:22px 0 6px}} small{{color:#999;font-weight:400}}
.row{{display:flex;gap:28px;align-items:flex-end;background:#403d4a;padding:14px;border-radius:6px;overflow-x:auto}} figure{{margin:0}}
.stage{{position:relative;background:#6b6778}} img{{image-rendering:pixelated;display:block;position:relative;z-index:1}}
.g{{position:absolute;inset:0;z-index:2;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,.22) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.22) 1px,transparent 1px);background-position:0 100%}}
img.rm{{width:576px;image-rendering:pixelated}} .rooms{{display:flex;flex-wrap:wrap;gap:16px}} figcaption{{margin-top:4px;color:#aaa;font-size:12px}}</style>
{bsec}<h1>v35-A 호러 8종 — 옛 후보 / 새 손도트 / 히어로 / 나란히 (배율 x{Z}, 격자선 = 1m = 16px)</h1>
<p>바닥이 아래쪽 기준선. 격자 한 칸이 1m, 히어로는 1.5m(24px). 마지막 그림은 같은 바닥 줄에 조각과 히어로를 세운 것.</p>{''.join(cards)}'''
open(OUT, 'w', encoding='utf-8').write(html); print(OUT, len(html))
