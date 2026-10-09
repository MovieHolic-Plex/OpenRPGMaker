"""wizarding_world 방 짓기 역할표 — build_hand_interior_room 이 이 칩셋으로 ㄱ·ㄷ·T자 방을 짓게 하는 변형 칸과 사양.

bake_wz.py 가 조각·오토타일을 놓은 뒤 부른다. 편집기 「방 짓기」 탭(src/project/roomKit.ts compileRoomKit)과 같은 규칙으로
  바닥 칸 × 그림자 4(벽 밑·서쪽), 벽면 칸 × 서쪽 2(윗줄은 천장 띠 밑 그늘), 천장 32(방 안 쪽 변에 어두운 선+밝은 선), 바깥 1
을 만든다. 차이: 어둡게 한 색은 마법 학교 팔레트(wzlib.PAL)의 가장 가까운 색으로 붙인다(팔레트 잠금 유지).
바닥은 같은 이름의 A·B·C 변형을 한 판(가로)으로 묶고 줄마다 밀어 깐다(lay rowShift). 벽면은 벽 세트 북벽 조각의 아래 두 줄.
산출 = src/assets/wizardingRoomSpec.json (번호는 pins 의 roomkit/… 키로 고정).
"""
import collections, re
import numpy as np
from PIL import Image

import wzlib

DARK = (1.0, 0.82, 0.64)
FOOT_SHADE = (2, 1, 1)
WEST_SHADE = (2, 2, 1, 1, 1, 0)
TOP_SHADE = (2, 2, 1, 1)
_PAL = np.array([p[:3] for p in wzlib.PAL], dtype=np.int32)
SKIP_FLOOR = re.compile(r'^wz-(nat-|qd-grass|post-snow|owl-void|owl-pit)|stair|band')


def _snap(a):
    """RGB 를 팔레트 최근접 색으로(알파 > 0 인 화소만)."""
    rgb = a[:, :, :3].reshape(-1, 1, 3).astype(np.int32)
    idx = ((rgb - _PAL[None, :, :]) ** 2).sum(-1).argmin(1)
    out = a.copy()
    vis = a[:, :, 3].reshape(-1) > 0
    snapped = _PAL[idx].reshape(16, 16, 3).astype(np.uint8)
    flat = out[:, :, :3].reshape(-1, 3)
    flat[vis] = snapped.reshape(-1, 3)[vis]
    return out


def _shade_rows(a, steps):
    a = a.astype(np.float32)
    for y in range(16):
        n = steps[y] if y < len(steps) else 0
        if n: a[y, :, :3] *= DARK[n]
    return a


def _shade_cols(a, steps):
    a = a.astype(np.float32)
    for x in range(16):
        n = steps[x] if x < len(steps) else 0
        if n: a[:, x, :3] *= DARK[n]
    return a


def _fin(a):
    return Image.fromarray(_snap(np.clip(np.rint(a), 0, 255).astype(np.uint8)), 'RGBA')


def floor_variants(im):
    base = np.array(im.convert('RGBA'))
    out = []
    for sh in range(4):
        a = base.astype(np.float32)
        if sh & 1: a = _shade_rows(a, FOOT_SHADE)
        if sh & 2: a = _shade_cols(a, WEST_SHADE)
        out.append(_fin(a))
    return out


def wall_variants(im, top_row):
    base = np.array(im.convert('RGBA')).astype(np.float32)
    if top_row: base = _shade_rows(base, TOP_SHADE)
    return [_fin(base), _fin(_shade_cols(base, WEST_SHADE))]


def ceiling_base():
    """가장 어두운 팔레트 색 바탕 + 둘째 어두운 색 점(결). 번호가 아니라 그림이라 매 굽기 같다."""
    dark, mid = wzlib.PAL[0], wzlib.PAL[1]
    a = np.zeros((16, 16, 4), np.uint8); a[:, :] = dark
    for y in range(16):
        for x in range(16):
            if (x * 7 + y * 13 + (x * y) % 5) % 11 == 0: a[y, x] = mid
    return a


def ceiling_variants():
    base = ceiling_base()
    avg = base[:, :, :3].reshape(-1, 3).mean(0)
    rim = tuple(int(v + (255 - v) * 0.45) for v in avg) + (255,)
    edge = tuple(int(v * 0.45) for v in avg) + (255,)
    out = []
    for bits in range(32):
        a = base.copy()
        for i in range(16):
            if bits & 1: a[15, i] = edge; a[14, i] = rim
            if bits & 2: a[0, i] = edge; a[1, i] = rim
            if bits & 4: a[i, 0] = edge; a[i, 1] = rim
            if bits & 8: a[i, 15] = edge; a[i, 14] = rim
        out.append(Image.fromarray(_snap(a), 'RGBA'))
    return out, Image.fromarray(_snap(base), 'RGBA')


def build(pieces, piece_cells, img, put, space_spec):
    """pieces = [(mod, p)], piece_cells[pid][(x,y)] = (tid, pc), put(key, im, pc, meta) → tid. 반환 = 사양 dict."""
    meta = lambda label, desc, role: dict(label=label, desc=desc, role=role, tags=['wizarding', 'room-kit', '방 짓기'], rep='fixed', piece='roomkit')
    # 바닥: 1×1 반복 바닥 조각을 -a/-b/-c 꼬리로 묶는다.
    groups = collections.OrderedDict()
    for _, p in pieces:
        if not (p['repeat'] and p['family'] == 'surfaces' and p['w'] == 1 and p['h'] == 1 and p['walk'] == ['F']): continue
        if SKIP_FLOOR.search(p['id']): continue
        key = re.sub(r'-[abc]$', '', p['id'])
        groups.setdefault(key, []).append(p)
    floors = collections.OrderedDict()
    for key, members in groups.items():
        fid = key[3:] if key.startswith('wz-') else key
        ko = re.sub(r'\s*[ABC]$', '', members[0]['name'])
        tiles = []
        for p in members:
            src = img[piece_cells[p['id']][(0, 0)][0]]
            for sh, v in enumerate(floor_variants(src)):
                tiles.append(put(f"roomkit/floor/{p['id']}/{sh}!", v, 'floor', meta(f"방 짓기 바닥 · {ko} (그림자 {sh})", f"방 짓기 역할표 바닥 칸 — {ko}, 그림자 {sh}(1 벽 밑·2 서쪽).", 'terrain')))
        floors[fid] = dict(ko=ko, cols=len(members), rows=1, tiles=tiles, **({'lay': 'rowShift'} if len(members) > 1 else {}))
    # 벽면: 벽 세트 북벽 조각(1×4: 윗면 두께 + 정면 3줄)의 아래 두 줄.
    walls = collections.OrderedDict()
    for wid, ws in space_spec['wallsets'].items():
        cells = piece_cells.get(ws['n'])
        if not cells or (0, 2) not in cells or (0, 3) not in cells: continue
        tiles = []
        for r, row in enumerate((2, 3)):
            src = img[cells[(0, row)][0]]
            for west, v in enumerate(wall_variants(src, r == 0)):
                tiles.append(put(f"roomkit/wall/{wid}/{r}.{west}!", v, 'solidfloor', meta(f"방 짓기 벽면 · {ws['ko']} ({r + 1}줄{' 서쪽' if west else ''})", f"방 짓기 역할표 벽면 칸 — {ws['ko']}.", 'wall')))
        walls[wid] = dict(ko=ws['ko'], cols=1, tiles=tiles)
    ceil_v, void_im = ceiling_variants()
    ceil = [put(f"roomkit/ceiling/default/{b}!", v, 'solidfloor', meta(f"방 짓기 천장 (이웃 {b})", '방 짓기 역할표 천장 띠 칸 — 방 안 쪽 변에 테두리.', 'wall')) for b, v in enumerate(ceil_v)]
    void = put('roomkit/void!', void_im, 'solidfloor', meta('방 짓기 바깥', '방 짓기 역할표 바깥(천장 너머) 칸.', 'wall'))
    return collections.OrderedDict(version=1, tilesetId='wizarding_world', tileSize=16, blank=0, void=void, floors=floors, walls=walls,
                                   ceilings=dict(default=ceil), objects={}, tables={}, lines={}, daises={}, goods={})
