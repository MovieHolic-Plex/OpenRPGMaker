#!/usr/bin/env python3
"""호러 후보를 v5 실내 방 맥락에 놓은 그림(공통 context.py 는 거리 맥락이라 호러에는 맞지 않는다).
  python3 scripts/content/atlas-pick/horror_context.py tiledata/atlas-pick/candidates-horror/<slug>/h1-A.pxg   # → h1-A.ctx.png (4배)

그림 = 왼쪽 「밝은 방」 + 오른쪽 「어두운 방」(같은 장면에 어둠 덮개 150 을 씌우고 촛불 한 점 둘레만 밝게) 나란히.
  - 벽면 2줄(v5 벽 조각) + 바닥(v5 바닥 조각)을 장면별로 깐다: 저택·연출 = 짙은 마루 + 회벽, 병원 = 회색 판석 + 회벽,
    폐교 = 밝은 마루 + 회벽, 밤 묘지 = 흙바닥 + 바위벽(벽 없이 바닥만).
  - 층별 놓는 자리: ground/decal = 바닥 한가운데, object = 바닥 위(발이 바닥 줄에), wall = 벽면에, facade = 벽 자리를 그 블록으로,
    over = 방 위 전체(어둠·안개 덮개는 가장자리·모서리를 실제 쓰는 자리에).
어두운 쪽은 게임 안에서 어둠 연출을 켰을 때 실루엣이 살아남는지 보는 용도다. 어두운 쪽에서 안 읽히면 명도 폭을 넓혀라."""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import horror_check  # noqa: F401  (세트 목록에 horror 덧대기)
from common import *  # noqa

V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
SCENE = {'낡은 서양 저택': ('floor:dplank', 'wall:plaster'), '연출': ('floor:dplank', 'wall:plaster'),
         '폐병원': ('floor:grey', 'wall:plaster'), '폐교 복도': ('floor:plank', 'wall:plaster'), '밤 숲·묘지': ('floor:earth', None),
         '미술관': ('floor:plank', 'wall:marblewall'), '지하·돌방': ('floor:flag', 'wall:stone'), '공통 뼈대': ('floor:dplank', 'wall:plaster')}   # 2판 장면
_A = None; _M = None
def v5_tile(tid):
    global _A, _M
    if _A is None:
        _A = Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA')
        m = json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))
        _M = {o['id']: o for k in ('floors', 'walls') for o in m[k]}
    a = _M[tid]['atlas']; return _A.crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))

def tiled(tile, w, h):
    im = Image.new('RGBA', (w, h))
    for y in range(0, h, tile.height):
        for x in range(0, w, tile.width):
            im.paste(tile, (x, y))
    return im

def is_wallface(it):
    return it['layer'] == 'facade' and it['cells'] == [2, 2] and (it['slug'].startswith('wall_') or it['slug'] == 'hosp_wall')

def auto_demo(it, slot):
    """2판 자동 타일(천장 윗면·카펫 러너, 4×3 시트) — 작은 방에 실제로 이어 붙인 모습(horror_room_compose 의 사분면 규칙)."""
    import horror_room_compose as HC
    plan = ['##########', '#....#####', '#........#', '#........#', '#........#', '###..#####', '##########']
    W, H = len(plan[0]), len(plan); inn = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] != '#'
    floor, wall = SCENE.get(it.get('scene'), SCENE['연출'])
    im = tiled(v5_tile(floor), W * 16, H * 16)
    for y in range(H):
        for x in range(W):
            if inn(x, y) and not inn(x, y - 1): im.paste(v5_tile(wall or 'wall:plaster').crop((0, 0, 16, 16)), (x * 16, y * 16))
            elif inn(x, y) and not inn(x, y - 2) and y >= 2 and not inn(x, y - 2): im.paste(v5_tile(wall or 'wall:plaster').crop((0, 16, 16, 32)), (x * 16, y * 16))
    if it['layer'] == 'facade':          # 천장 윗면
        for y in range(H):
            for x in range(W):
                if inn(x, y): continue
                if not any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    im.paste((6, 6, 9, 255), (x * 16, y * 16, x * 16 + 16, y * 16 + 16)); continue
                HC.quad_auto(im, slot, x, y, lambda dx, dy, x=x, y=y: not inn(x + dx, y + dy))
    else:                                # 러너: ㄱ자 + 출구로
        cells = {(x, 3) for x in range(1, 9)} | {(x, 4) for x in range(1, 9)} | {(3, 5), (4, 5), (3, 6), (4, 6)}
        cells = {c for c in cells if inn(*c)}
        for y in range(H):
            for x in range(W):
                if not inn(x, y): im.paste((6, 6, 9, 255), (x * 16, y * 16, x * 16 + 16, y * 16 + 16))
        for (x, y) in cells: HC.quad_auto(im, slot, x, y, lambda dx, dy, x=x, y=y: (x + dx, y + dy) in cells)
    return im

def room(it, slot):
    if it.get('autotile'): return auto_demo(it, slot)
    w, h = it['cells']; layer = it['layer']; floor, wall = SCENE.get(it.get('scene'), SCENE['연출'])
    if it.get('ctx_floor'): floor = it['ctx_floor']
    if it.get('ctx_wall'): wall = it['ctx_wall']
    wc = max(w + 4, 6); wr = 0 if wall is None else 2           # 벽면 2줄
    if layer in ('wall', 'facade'): wr = max(wr, h if layer == 'facade' else h + 1)
    hc = wr + (h + 3 if layer not in ('wall', 'facade') else 3)
    im = tiled(v5_tile(floor), wc * 16, hc * 16)
    if wr:
        im.paste(tiled(v5_tile(wall or 'wall:plaster'), wc * 16, wr * 16), (0, 0))
    ox = (wc - w) // 2 * 16
    if layer == 'ground' and it['cells'] == [2, 2]:          # 2판 바닥 조각: 바닥 전체에 이어 깔아 반복을 본다
        im.paste(tiled(slot, wc * 16, (hc - wr) * 16), (0, wr * 16))
    elif is_wallface(it):                                     # 2판 벽면 조각: 벽면 두 줄 전체에 이어 깔아 이음을 본다
        im.paste(tiled(slot, wc * 16, 32), (0, (wr - 2) * 16))
    elif layer == 'facade':
        im.paste(slot, (ox, (wr - h) * 16))
    elif layer == 'wall':
        im.alpha_composite(slot, (ox, max(0, wr - h) * 16 if h <= wr else 0))
    elif layer == 'over':
        if it['slug'] in ('dark_edge',):
            for x in range(wc): im.alpha_composite(slot, (x * 16, wr * 16))
        elif it['slug'] in ('dark_corner', 'cobweb_corner'):
            im.alpha_composite(slot, (0, wr * 16 if it['slug'] == 'dark_corner' else 0))
        else:
            im.alpha_composite(slot, (ox, wr * 16 + 16))
    else:
        im.alpha_composite(slot, (ox, (wr + 1) * 16))
    return im

def darkened(im):
    a = np.array(im).astype(np.float32); H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]; cx, cy = W * 0.5, H * 0.62
    d = np.sqrt(((xx - cx) / (W * 0.45)) ** 2 + ((yy - cy) / (H * 0.55)) ** 2)
    k = np.clip(0.28 + 0.55 * (1 - d), 0.28, 0.83)[..., None]    # 가운데 촛불, 가장자리 짙게
    warm = np.array([1.0, 0.92, 0.78], np.float32)
    a[..., :3] = a[..., :3] * k * (warm * (k / 0.83) + (1 - k / 0.83) * np.array([0.8, 0.85, 1.0], np.float32))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def main():
    for f in sys.argv[1:]:
        st, s = set_of_path(f); it = items_by_slug(st)[s]
        png = os.path.splitext(f)[0] + '.png'
        if not os.path.exists(png):
            sys.path.insert(0, PXGRID); import pxgrid; pxgrid.render(f, png)
        lit = room(it, Image.open(png).convert('RGBA')); dark = darkened(lit)
        both = Image.new('RGBA', (lit.width * 2 + 8, lit.height), (20, 18, 24, 255))
        both.paste(lit, (0, 0)); both.paste(dark, (lit.width + 8, 0))
        out = os.path.splitext(f)[0] + '.ctx.png'
        both.resize((both.width * 4, both.height * 4), Image.NEAREST).save(out); print(out)

if __name__ == '__main__':
    main()
