#!/usr/bin/env python3
"""월드맵 세트 맥락 그림 — 후보를 실제로 깔았을 때의 모습.
  python3 scripts/content/atlas-pick/worldmap_context.py tiledata/atlas-pick/candidates-worldmap/<slug>/w1-A.pxg [...]   # → w1-A.ctx.png (4배)
  … --under plains=tiledata/atlas-pick/candidates-worldmap/plains_base/w2-B.png     # 임시 바탕 대신 후보 그림을 바탕으로(여러 번 줄 수 있다)

공통 context.py 는 현대 시트 보도·아스팔트를 깐다 — 월드맵에는 맞지 않아 이 세트 전용으로 따로 둔다(공통 파일은 안 건드린다).
- bundle(이어짐 조각 묶음 3×4): 시험 지도 12×9 칸 위에 엔진과 같은 8px 사분면 합성(src/project/defaults/terrainQuarterAutotile.ts
  quarterTile)으로 깐다 — 큰 덩이·오목 모서리·1칸 폭 가로/세로 줄·네거리·2×2·외딴 칸. 물(coast_*·sea_deep)은 뒤집어서(물이 넓고 섬이 있다).
  외딴 칸 두 곳: 왼쪽 = 외딴 통그림(isolated 칸), 오른쪽 = 네 모서리 사분면 합성(엔진이 통그림을 안 쓰는 지형에서 보이는 모양).
- base(바탕 3칸): 세 변형을 섞어 깐 10×6 + 변형별 3×3 반복.
- scatter: 임시 바탕 위에 셋을 흩뿌린 7×4.  piece(다리): 강 두 칸 폭 위에 두 칸.  icon: 바탕 한가운데.
밑바탕(under)은 아직 고르지 않았으므로 **임시 바탕**(팔레트 두 색 점무늬)을 쓴다 — 바탕 결은 판정 대상이 아니다.

2판(2026-09-30) 엔진 대조: 사분면 판정(quarter_role)·물 뒤집기·맵 가장자리 = 물은 엔진(terrainQuarterAutotile.ts quarterTile,
lakeAutotile.ts 물 블록)과 같다. 다른 점이 하나 있었다 — 엔진 quarterTile 은 몸통 변형(묶음 (1,0) 칸, 앵커+1)을 **한 번도 고르지 않는다**
(worldTerrainAutotiles.ts 의 bodyAlt 는 외딴 통그림 판정에만 쓰인다). 1판 맥락 그림은 몸통 칸의 35% 를 변형으로 바꿔 깔아
엔진에서는 안 생길 모습을 보여 줬다. 이제 기본은 엔진 그대로(변형 안 씀), `--body-alt` 를 주면 예전처럼 섞어 본다(시트 굽기에서 섞기를 넣을 때 대비).
「가는 물·흰 줄 이음새」는 합성 규칙이 아니라 그림 쪽 원인이었다(기슭 깊이 5~7px + 안쪽 모서리 홈 7~8px ↔ 변 깊이 0~4px 어긋남) —
worldmap_check.py 의 shore-* 검사가 잰다."""
import argparse, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

SET = 'worldmap'
T = 16
# 시험 지도(1 = 그 지형). 큰 L 덩이(오목 모서리), 2×2, 외딴 칸 둘, 네거리, 1칸 폭 가로·세로 줄
TEST_MAP = [
    '............',
    '.1111....1..',
    '.1111....1..',
    '.11...11111.',
    '.11......1..',
    '....1....1..',
    '.11.........',
    '.11...111.1.',
    '............',
]
ISO_WHOLE = (4, 5)          # 이 외딴 칸은 통그림, (10,7) 은 사분면 합성
SHOW_BODY_ALT = False       # 엔진은 몸통 변형을 깔지 않는다 — --body-alt 로만 켠다
WATER = ('coast_grass', 'coast_sand', 'coast_snow', 'sea_deep')
UNDER_TONES = {   # 임시 바탕: (램프, 바탕 단, 점 단)
    'plains': ('wgrass', 2, 3), 'sand': ('wsand', 3, 4), 'snow': ('wsnow', 4, 5), 'ash': ('wash', 2, 3),
    'sea': ('wsea', 2, 3), 'river': ('wriver', 2, 3),
}

_PAL = None
PALNAME = 'worldmap.pal'
def use_palette(name):
    """3판(v3-*.pxg)은 worldmap3.pal. 이름이 바뀌면 캐시를 버린다."""
    global _PAL, PALNAME
    if name != PALNAME: _PAL = None
    PALNAME = name
def palette_for(path):
    b = os.path.basename(path)
    if b.startswith('v6-'): return 'worldmap6.pal'      # 6판: 목표 그림 실측 톤(짙은 올리브·갈색 산·청록 물)
    if b.startswith('v5-'): return 'worldmap5.pal'      # 5판: FF6 실측 톤(어둡고 채도 낮음)
    return 'worldmap3.pal' if b.startswith(('v3-', 'v4-')) else 'worldmap.pal'
def pal():
    global _PAL
    if _PAL is None:
        sys.path.insert(0, PXGRID); import pxgrid
        _PAL, _ = pxgrid.load_palette(os.path.join(PAL_DIR, PALNAME))
    return _PAL

def h01(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF

def placeholder(kind):
    """16×16 임시 바탕(주기 16). 2×2 덩이 점무늬 — 결을 흉내 내지 않는다."""
    ramp, b, d = UNDER_TONES.get(kind or 'plains', UNDER_TONES['plains'])
    P = pal(); a = np.zeros((T, T, 4), np.uint8); a[..., :] = tuple(P[f'{ramp}:{b}'][:3]) + (255,)
    for y in range(0, T, 2):
        for x in range(0, T, 2):
            if h01(x // 2, y // 2, 7) < 0.18: a[y:y + 2, x:x + 2] = tuple(P[f'{ramp}:{d}'][:3]) + (255,)
    return a

def under_cells(kind, overrides):
    """바탕 칸 목록(섞어 깔 변형들). 덮어쓰기 그림: 3×4 묶음이면 몸통·몸통 변형, 3×1 이면 세 칸, 아니면 첫 칸."""
    p = overrides.get(kind)
    if not p: return [placeholder(kind)]
    a = np.array(Image.open(p).convert('RGBA'))
    if a.shape[:2] == (64, 48):
        out = [a[32:48, 16:32]]
        if (a[0:16, 16:32, 3] == 255).all(): out.append(a[0:16, 16:32])
        return out
    if a.shape[:2] == (16, 48): return [a[:, k * 16:(k + 1) * 16] for k in range(3)]
    return [a[:16, :16]]

def field(wc, hc, kind, overrides, seed=3):
    cs = under_cells(kind, overrides); im = np.zeros((hc * T, wc * T, 4), np.uint8)
    for y in range(hc):
        for x in range(wc):
            im[y * T:(y + 1) * T, x * T:(x + 1) * T] = cs[int(h01(x, y, seed) * len(cs)) % len(cs)]
    return im

def over(dst, src, x, y):
    """src(RGBA) 를 dst 의 (x,y) px 에 알파 합성."""
    h, w = src.shape[:2]; d = dst[y:y + h, x:x + w].astype(np.float32); s = src.astype(np.float32)
    al = s[..., 3:4] / 255.0
    d[..., :3] = s[..., :3] * al + d[..., :3] * (1 - al); d[..., 3:4] = np.maximum(d[..., 3:4], s[..., 3:4])
    dst[y:y + h, x:x + w] = d.astype(np.uint8)

ROLE_AT = {'isolated': (0, 0), 'body_alt': (1, 0), 'inner': (2, 0), 'corner_nw': (0, 1), 'edge_n': (1, 1), 'corner_ne': (2, 1),
           'edge_w': (0, 2), 'body': (1, 2), 'edge_e': (2, 2), 'corner_sw': (0, 3), 'edge_s': (1, 3), 'corner_se': (2, 3)}
def role(a, r):
    cx, cy = ROLE_AT[r]; return a[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T]

QUARTERS = {'nw': ((0, -1), (-1, 0), (-1, -1), 0, 0), 'ne': ((0, -1), (1, 0), (1, -1), 8, 0),
            'sw': ((0, 1), (-1, 0), (-1, 1), 0, 8), 'se': ((0, 1), (1, 0), (1, 1), 8, 8)}
def quarter_role(q, v, h, d):
    """엔진 quarterTile() 과 같은 판정."""
    if not v and not h: return {'nw': 'corner_nw', 'ne': 'corner_ne', 'sw': 'corner_sw', 'se': 'corner_se'}[q]
    if not v: return 'edge_n' if q in ('nw', 'ne') else 'edge_s'
    if not h: return 'edge_w' if q in ('nw', 'sw') else 'edge_e'
    if not d: return 'inner'
    return 'body'

def compose_bundle(bundle, mask, outside_connected=False, iso_whole=()):
    """mask(행 문자열 목록, '1' = 지형) 위에 묶음을 사분면 합성. 돌려주는 값 = (그림 RGBA, 지형 칸 표시 배열, 사분면 경계 표시)."""
    H, W = len(mask), len(mask[0]); im = np.zeros((H * T, W * T, 4), np.uint8)
    on = lambda x, y: (mask[y][x] == '1') if (0 <= x < W and 0 <= y < H) else outside_connected
    has_alt = SHOW_BODY_ALT and (role(bundle, 'body_alt')[..., 3] == 255).all()
    for y in range(H):
        for x in range(W):
            if not on(x, y): continue
            if (x, y) in iso_whole and not any(on(x + dx, y + dy) for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0))):
                im[y * T:(y + 1) * T, x * T:(x + 1) * T] = role(bundle, 'isolated'); continue
            for q, ((vx, vy), (hx, hy), (dx, dy), ox, oy) in QUARTERS.items():
                r = quarter_role(q, on(x + vx, y + vy), on(x + hx, y + hy), on(x + dx, y + dy))
                if r == 'body' and has_alt and h01(x, y, 11) < 0.35: r = 'body_alt'
                im[y * T + oy:y * T + oy + 8, x * T + ox:x * T + ox + 8] = role(bundle, r)[oy:oy + 8, ox:ox + 8]
    return im

def bundle_mask(slug):
    if slug in WATER:
        return [''.join('0' if c == '1' else '1' for c in row) for row in TEST_MAP], True
    return TEST_MAP, False

def worldmap_context(it, slot, overrides=None):
    """slot = 후보 그림(RGBA PIL). 돌려주는 값 = PIL RGBA(1배)."""
    overrides = overrides or {}; a = np.array(slot.convert('RGBA')); kind = it.get('kind'); under = it.get('under') or 'plains'
    if kind == 'bundle':
        mask, outside = bundle_mask(it['slug']); H, W = len(mask), len(mask[0])
        base = field(W, H, under, overrides)
        over(base, compose_bundle(a, mask, outside, (ISO_WHOLE,)), 0, 0)
        return Image.fromarray(base)
    if kind == 'base':
        cs = [a[:, k * T:(k + 1) * T] for k in range(3)]; W, H = 10 + 1 + 9, 6
        im = np.zeros((H * T, W * T, 4), np.uint8)
        for y in range(H):
            for x in range(10):
                im[y * T:(y + 1) * T, x * T:(x + 1) * T] = cs[int(h01(x, y, 5) * 3) % 3]
        for k in range(3):
            for y in range(3):
                for x in range(3):
                    im[y * T:(y + 1) * T, (11 + k * 3 + x) * T:(12 + k * 3 + x) * T] = cs[k]
        return Image.fromarray(im)
    if kind == 'scatter':
        im = field(7, 4, under, overrides)
        for k, (x, y) in enumerate(((1, 1), (3, 2), (5, 1))):
            over(im, a[:, k * T:(k + 1) * T], x * T, y * T)
        over(im, a[:, 0:T], 5 * T, 3 * T)
        return Image.fromarray(im)
    if kind == 'piece':
        im = field(6, 6, 'plains', overrides); riv = under_cells('river', overrides)[0]
        horiz = it.get('joins') == 'y'   # 세로 다리 = 가로로 흐르는 강
        for k in range(6):
            for w in (2, 3):
                x, y = (k, w) if horiz else (w, k)
                im[y * T:(y + 1) * T, x * T:(x + 1) * T] = riv
        for w in (2, 3):
            x, y = (2, w) if horiz else (w, 2)
            over(im, a, x * T, y * T)
        return Image.fromarray(im)
    # icon
    w, h = it['cells']; im = field(w + 4, h + 3, under, overrides)
    over(im, a, 2 * T, 1 * T)
    return Image.fromarray(im)

def parse_under(vals):
    out = {}
    for v in vals or []:
        k, _, p = v.partition('='); out[k] = p
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--under', action='append'); ap.add_argument('--body-alt', action='store_true', help='몸통 변형을 섞어 깐다(엔진은 아직 안 한다)')
    a = ap.parse_args(); ov = parse_under(a.under)
    global SHOW_BODY_ALT; SHOW_BODY_ALT = a.body_alt
    for f in a.files:
        use_palette(palette_for(f))
        st, s = set_of_path(f)
        its = items_by_slug(st or SET) if st else {}
        if not its:   # sets.json 에 아직 없을 때
            its = {x['slug']: x for x in read_json(os.path.join(BASE, 'jobs-worldmap.json'), {'items': []})['items']}
        it = its[s]
        png = os.path.splitext(f)[0] + '.png'
        if not os.path.exists(png) or os.path.getmtime(png) < os.path.getmtime(f):
            sys.path.insert(0, PXGRID); import pxgrid; pxgrid.render(f, png)
        im = worldmap_context(it, Image.open(png).convert('RGBA'), ov)
        out = os.path.splitext(f)[0] + '.ctx.png'
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out); print(out)

if __name__ == '__main__':
    main()
