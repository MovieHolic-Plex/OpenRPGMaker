#!/usr/bin/env python3
"""새 바닥·벽 후보(tiles6.py)를 작은 방에 깔아 고르기 화면을 만든다 — 후보마다 A/B 두 장, 원래 색(고른 표면의 색은 공통 팔레트에 더한다).
  python3 scripts/content/hand-interior-pick/surface_preview.py ~/claude-viz/interior-surfaces.html
"""
import base64, io, os, sys
sys.path.insert(0, 'tiledata/hand-interior/v5'); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tiles as TL, room2, tiles5, tiles6 as T6
from palette_snap import snap
PLAN = ['#' * 14] + ['#' + '.' * 12 + '#'] * 6 + ['#' * 14]
PARTNER_WALL = {'modern': 'w_white_a', 'east': 'w_hanji_a', 'sf': 'w_sf_a'}
PARTNER_FLOOR = {'modern': 'herring_a', 'east': 'jangpan_a', 'sf': 'sfdeck_a'}
CEIL = {'modern': 'pale', 'east': 'lacquer', 'sf': 'navy'}
for fa, fb in T6.FLOOR_CANDS.values():
    TL.FLOORFN[fa.__name__] = fa; TL.FLOORFN[fb.__name__] = fb
for wa, wb in T6.WALL_CANDS.values():
    room2.FACEFN[wa.__name__] = wa; room2.FACEFN[wb.__name__] = wb
def render(floor, wall, genre, scale=3):
    room2.CEIL = T6.CEILS6[CEIL[genre]]
    im = room2.render(PLAN, floor, wall); room2.CEIL = None
    n = 0
    im = im.crop((16, 0, im.width - 16, im.height - 16)).resize(((im.width - 32) * scale, (im.height - 16) * scale), 0)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), n
rows = []
for kind, cands, label, alt in (('바닥', T6.FLOOR_CANDS, T6.FLOOR_LABEL, T6.FLOOR_ALT), ('벽', T6.WALL_CANDS, T6.WALL_LABEL, T6.WALL_ALT)):
    for key, (a, b) in cands.items():
        g = T6.GENRE[key]; cards = []
        for ab, fn, name in (('A', a, alt[key][0]), ('B', b, alt[key][1])):
            if kind == '바닥': uri, n = render(fn.__name__, PARTNER_WALL[g], g)
            else: uri, n = render(PARTNER_FLOOR[g], fn.__name__, g)
            cards.append(f'<figure data-k="{key}" data-ab="{ab.lower()}"><img src="{uri}"><figcaption><b>{ab}</b> {name}</figcaption></figure>')
        rows.append(f'<section><h2>{kind} · {label[key]} <small>{key} · {g}</small></h2><div class="row">{"".join(cards)}</div></section>')
html = f'''<!doctype html><meta charset="utf-8"><title>새 바닥·벽 후보</title>
<style>body{{background:#16161a;color:#ddd;font:14px sans-serif;margin:18px}}h1{{font-size:18px}}h2{{font-size:15px;margin:18px 0 6px}}
small{{color:#888;font-weight:normal}}.row{{display:flex;gap:14px;flex-wrap:wrap}}figure{{margin:0}}img{{image-rendering:pixelated;display:block;border:1px solid #333}}
figcaption{{padding:4px 0}}figure{{cursor:pointer;outline:3px solid transparent}}figure.on{{outline-color:#4ad}}
#out{{position:fixed;right:18px;bottom:18px;background:#223;padding:10px 14px;border:1px solid #4ad;max-width:420px;font:13px monospace;white-space:pre-wrap}}</style>
<h1>새 바닥·벽 후보 — 줄마다 A 또는 B 를 골라 주세요 (방 그림 3배, 원래 색)</h1>{"".join(rows)}<div id="out">그림을 누르면 고른 목록이 여기 쌓입니다</div>
<script>const sel={{}};document.querySelectorAll("figure").forEach(f=>f.onclick=()=>{{const k=f.dataset.k,ab=f.dataset.ab;sel[k]=sel[k]===ab?undefined:ab;document.querySelectorAll(`figure[data-k="${{k}}"]`).forEach(g=>g.classList.toggle("on",sel[k]===g.dataset.ab));document.getElementById("out").textContent=Object.entries(sel).filter(e=>e[1]).map(e=>e[0]+"="+e[1]).join(" ")||"없음"}})</script>'''
open(sys.argv[1], 'w').write(html); print('ok', len(rows))
