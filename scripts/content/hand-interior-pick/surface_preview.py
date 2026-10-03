#!/usr/bin/env python3
"""새 바닥·벽 후보(tiles6.py)를 작은 방에 깔아 고르기 화면을 만든다 — 후보마다 A/B 두 장, 원래 색(고른 표면의 색은 공통 팔레트에 더한다).
  python3 scripts/content/hand-interior-pick/surface_preview.py ~/claude-viz/interior-surfaces.html
  python3 scripts/content/hand-interior-pick/surface_preview.py --qa <폴더>   # 검수용: 후보마다 방 3배 + 표면만 6배 PNG
검수에서 떨어진 후보는 tiles6.CUT 에 넣는다 — 고르기 화면에서 빠진다.
"""
import base64, io, os, sys
sys.path.insert(0, 'tiledata/hand-interior/v5'); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tiles as TL, room2, tiles5, tiles6 as T6
from palette_snap import snap
PLAN = ['#' * 14] + ['#' + '.' * 12 + '#'] * 8 + ['#' * 14]
import json
from PIL import Image
SHEET = Image.open('public/assets/atlas-interior/interior-chipset.png').convert('RGBA')
OBJS = json.load(open('src/assets/handInteriorSpec.json'))['objects']
# 방 안 소품(크기 가늠용): genre -> [(object id, x, y)] — y 는 소품 기준 칸(바닥 첫 줄 = 3)
FURN = {'modern': [('bookshelf 2w', 2, 3), ('potted fern', 5, 3), ('table:plate+cup', 8, 5), ('sofa', 8, 8), ('armchair', 11, 6)],
        'east': [('pot', 2, 3), ('chest', 4, 3), ('table:book+scroll', 6, 5), ('potted sapling', 11, 3)],
        'sf': [('gauge panel', 3, 1), ('gauge panel', 9, 1), ('chest', 2, 3), ('potted cactus', 11, 3), ('felt 2x1', 6, 5)]}
def furnish(im, genre):
    for oid, ox, oy in FURN[genre]:
        for c in OBJS[oid]['cells']:
            dx, dy, t = c[0], c[1], c[2]
            tile = SHEET.crop(((t % 48) * 16, (t // 48) * 16, (t % 48) * 16 + 16, (t // 48) * 16 + 16))
            im.alpha_composite(tile, ((ox + dx) * 16, (oy + dy) * 16))
    return im
PARTNER_WALL = {'modern': 'w_wallpaper_a', 'east': 'w_hanji_a', 'sf': 'w_sf_a'}
PARTNER_FLOOR = {'modern': 'herring_a', 'east': 'maru_b', 'sf': 'sfdeck_b'}
CEIL = {'modern': 'pale', 'east': 'lacquer', 'sf': 'navy'}
for fa, fb in T6.FLOOR_CANDS.values():
    TL.FLOORFN[fa.__name__] = fa; TL.FLOORFN[fb.__name__] = fb
for wa, wb in T6.WALL_CANDS.values():
    room2.FACEFN[wa.__name__] = wa; room2.FACEFN[wb.__name__] = wb
def render(floor, wall, genre, scale=3):
    room2.CEIL = T6.CEILS6[CEIL[genre]]
    im = furnish(room2.render(PLAN, floor, wall), genre); room2.CEIL = None
    return im.crop((16, 0, im.width - 16, im.height - 16)).resize(((im.width - 32) * scale, (im.height - 16) * scale), 0)
def room(kind, fn):
    key = next(k for k, v in {**T6.FLOOR_CANDS, **T6.WALL_CANDS}.items() if fn in v); g = T6.GENRE[key]
    return render(fn.__name__, PARTNER_WALL[g], g) if kind == '바닥' else render(PARTNER_FLOOR[g], fn.__name__, g)
def swatch(kind, fn, z=6):
    """표면만: 바닥 64x64, 벽 96x32 — 6배"""
    w, h = (64, 64) if kind == '바닥' else (96, 32)
    im = Image.new('RGBA', (w, h)); px = im.load()
    for y in range(h):
        for x in range(w): px[x, y] = tuple(fn(x, y)[:3]) + (255,)
    return im.resize((w * z, h * z), 0)
def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
CUT = getattr(T6, 'CUT', set())
def qa(out):
    os.makedirs(out, exist_ok=True)
    for kind, cands in (('바닥', T6.FLOOR_CANDS), ('벽', T6.WALL_CANDS)):
        for key, pair in cands.items():
            for ab, fn in zip('ab', pair):
                r = room(kind, fn); sw = swatch(kind, fn)
                sheet = Image.new('RGBA', (r.width + 16 + sw.width, max(r.height, sw.height)), (22, 22, 26, 255))
                sheet.paste(r, (0, 0)); sheet.paste(sw, (r.width + 16, 0)); sheet.save(f'{out}/{key}_{ab}.png')
    print('qa', out)
if sys.argv[1] == '--qa': qa(sys.argv[2]); sys.exit()
rows = []
for kind, cands, label, alt in (('바닥', T6.FLOOR_CANDS, T6.FLOOR_LABEL, T6.FLOOR_ALT), ('벽', T6.WALL_CANDS, T6.WALL_LABEL, T6.WALL_ALT)):
    for key, (a, b) in cands.items():
        g = T6.GENRE[key]; cards = []
        for ab, fn, name in (('A', a, alt[key][0]), ('B', b, alt[key][1])):
            if (key, ab.lower()) in CUT: continue
            cards.append(f'<figure data-k="{key}" data-ab="{ab.lower()}"><img src="{uri(room(kind, fn))}"><figcaption><b>{ab}</b> {name}</figcaption></figure>')
        if cards: rows.append(f'<section><h2>{kind} · {label[key]} <small>{key} · {g}</small></h2><div class="row">{"".join(cards)}</div></section>')
html = f'''<!doctype html><meta charset="utf-8"><title>새 바닥·벽 후보</title>
<style>body{{background:#16161a;color:#ddd;font:14px sans-serif;margin:18px}}h1{{font-size:18px}}h2{{font-size:15px;margin:18px 0 6px}}
small{{color:#888;font-weight:normal}}.row{{display:flex;gap:14px;flex-wrap:wrap}}figure{{margin:0}}img{{image-rendering:pixelated;display:block;border:1px solid #333}}
figcaption{{padding:4px 0}}figure{{cursor:pointer;outline:3px solid transparent}}figure.on{{outline-color:#4ad}}
#out{{position:fixed;right:18px;bottom:18px;background:#223;padding:10px 14px;border:1px solid #4ad;max-width:420px;font:13px monospace;white-space:pre-wrap}}</style>
<h1>새 바닥·벽 후보 — 줄마다 A 또는 B 를 골라 주세요 (방 그림 3배, 원래 색)</h1>{"".join(rows)}<div id="out">그림을 누르면 고른 목록이 여기 쌓입니다</div>
<script>const sel={{}};document.querySelectorAll("figure").forEach(f=>f.onclick=()=>{{const k=f.dataset.k,ab=f.dataset.ab;sel[k]=sel[k]===ab?undefined:ab;document.querySelectorAll(`figure[data-k="${{k}}"]`).forEach(g=>g.classList.toggle("on",sel[k]===g.dataset.ab));document.getElementById("out").textContent=Object.entries(sel).filter(e=>e[1]).map(e=>e[0]+"="+e[1]).join(" ")||"없음"}})</script>'''
open(sys.argv[1], 'w').write(html); print('ok', len(rows))
