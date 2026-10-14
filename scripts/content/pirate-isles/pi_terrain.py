"""pirate_isles 바닥·물·해안 — 낱칸 바닥 + 8이웃 덩이 오토타일(47 변형, 안쪽 모서리까지) + 4이웃 벽 천장.

덩이 오토타일(blob, neighborhood 8): 조각은 8열×6행(47칸 + 빈 칸 1). BLOB_MASKS[i] = i 번째 칸의 정준 마스크
(대각 비트는 양옆 직교 이웃이 둘 다 있을 때만 남긴다). 굽기가 256 마스크 → 정준 마스크 → 칸으로 variantMap 을 만든다.
해안선은 화소 거리장(SDF)으로 그린다: 3×3 이웃 칸을 화소로 펼쳐 «땅에서 물까지 거리»를 재고, 그것을 반지름 R 로 깎은 집합까지의 거리 s 로
볼록 모서리를 둥글게 만든다. 무늬는 16 주기라 칸 경계에서 이어진다.
"""
import math
import numpy as np
from scipy.ndimage import distance_transform_edt as edt
from pi_core import *

N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128


def canon(m):
    o = m & 15
    if (m & NE) and (m & N) and (m & E): o |= NE
    if (m & SE) and (m & S) and (m & E): o |= SE
    if (m & SW) and (m & S) and (m & W): o |= SW
    if (m & NW) and (m & N) and (m & W): o |= NW
    return o


BLOB_MASKS = sorted({canon(m) for m in range(256)})
assert len(BLOB_MASKS) == 47


def per16(v, ph=0.0, a=0.7, b=0.45):
    """16 주기 매끈한 흔들림(칸 경계에서 이어진다)."""
    return a * math.sin(2 * math.pi * v / 16 + ph) + b * math.sin(2 * math.pi * v / 8 + ph * 1.7)


def shore_field(m, R=7):
    """마스크 m 칸의 화소별 s(땅 깊은 곳 0 → 물 쪽으로 커짐). 16×16 float."""
    g = np.zeros((48, 48), bool)
    cells = {(1, 1): True, (1, 0): bool(m & N), (2, 1): bool(m & E), (1, 2): bool(m & S), (0, 1): bool(m & W),
             (2, 0): bool(m & NE), (2, 2): bool(m & SE), (0, 2): bool(m & SW), (0, 0): bool(m & NW)}
    for (cx, cy), v in cells.items():
        if v: g[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16] = True
    dw = edt(g)                         # 땅 화소 → 가장 가까운 물 화소
    er = dw >= R                        # 깎은 땅
    s = edt(~er) if er.any() else np.full_like(dw, 99.0)
    return s[16:32, 16:32]


def blob_piece(id_, name, fn, desc='', tags=(), kind='terrain'):
    """fn(c, m, ox, oy) 로 47 변형을 8×6 조각에 그린다."""
    def draw(c):
        for i, m in enumerate(BLOB_MASKS):
            fn(c, m, (i % 8) * 16, (i // 8) * 16)
    piece(id_, name, 8, 6, kind, group='terrain', tags=['오토타일'] + list(tags), desc=desc)(draw)
    BLOB[id_] = dict(name=name, desc=desc, kind=kind)


BLOB = {}
AUTO4 = {}


def auto4_piece(id_, name, fn, desc='', tags=(), kind='terrain'):
    def draw(c):
        for m in range(16): fn(c, m, (m % 4) * 16, (m // 4) * 16)
    piece(id_, name, 4, 4, kind, group='terrain', tags=['오토타일'] + list(tags), desc=desc)(draw)
    AUTO4[id_] = dict(name=name, desc=desc, kind=kind)


# ================================================================== 낱칸 무늬(16 주기)
def sand_px(x, y, v=0):
    x %= 16; y %= 16
    t = 1
    r = hsh(x, y, 11 + v) % 61
    if r < 3: t = 2
    elif r < 5 and hsh(x + 1, y, 11 + v) % 3: t = 0
    elif r == 5: t = 3 if v == 2 else 2
    # 바람 물결(아주 옅은 사선 줄, 16 주기)
    if v == 1:
        k = (y * 3 + int(round(per16(x, 0.3, 1.3, 0.6)))) % 8
        if k == 0: t = 0
        elif k == 1 and t == 1: t = 2
    return K('sand', t)


def grass_px(x, y, v=0):
    x %= 16; y %= 16
    f = per16(x, 0.4 + v, 0.7, 0.5) + per16(y, 3.1 + v, 0.7, 0.4)
    t = -1 if f < -1.45 else 0
    q = hsh(x, y, 23 + v) % 17
    if q == 0: t += 1
    elif q == 1: t -= 1
    if hsh(x, (y - 1) % 16, 23 + v) % 17 == 0: t -= 1        # 풀잎 밝은 점 밑 그늘
    return K('grass', max(-2, min(2, t)))


def dirt_px(x, y, v=0):
    x %= 16; y %= 16
    t = 0
    r = hsh(x, y, 31 + v) % 23
    if r < 3: t = -1
    elif r < 5: t = 1
    if hsh(x // 3, y // 2, 33) % 11 == 0: t = -1
    return K('sand', t - 1) if t >= 0 or hsh(x, y, 35) % 2 else K('wood', 0)


def rockfloor_px(x, y, v=0):
    x %= 16; y %= 16
    # 바위판: 큰 판 덩이(8×6 엇갈림), 판 위 밝게·밑 그늘, 금
    row = y // 6; xx = (x + (4 if row % 2 else 0)) % 16; col = xx // 8
    vv = y % 6; uu = xx % 8
    tone = (hsh(col, row, 41 + v) % 3) - 1
    if vv == 5 or uu == 7: return K('rock', -2)
    if vv == 0 or uu == 0: return K('rock', tone + 1)
    if hsh(x, y, 43) % 19 == 0: return K('rock', tone - 1)
    return K('rock', tone)


def cobble_px(x, y, v=0):
    """항구 포석: 4×4 둥근 돌(행 엇갈림) — 위 밝게, 아래 그늘, 줄눈."""
    x %= 16; y %= 16
    row = y // 4; xx = (x + (2 if row % 2 else 0)) % 16; col = xx // 4
    uu, vv = xx % 4, y % 4
    tone = (hsh(col, row, 51 + v) % 3) - 1
    if uu == 3 or vv == 3: return K('stone', -2)
    if vv == 0 and uu < 2: return K('stone', tone + 2)
    if vv == 0 or uu == 0: return K('stone', tone + 1)
    if uu == 2 and vv == 2: return K('stone', tone - 1)
    return K('stone', tone)


def deck_px(x, y, v=0, mat='wood', t=0):
    """갑판·마루: 가로 판자 폭 4(이음 1), 판 끝 엇갈림, 못."""
    x %= 16; y %= 16
    row = y // 4; vv = y % 4
    off = (row * 5) % 16
    uu = (x + off) % 16
    tone = t + ((hsh(row, (x + off) // 16, 61 + v) % 3) - 1)
    if vv == 3: return K(mat, t - 2)
    if uu == 15: return K(mat, t - 1)
    if vv == 0: tone += 1
    if uu in (1, 13) and vv == 1: return K(mat, t - 3)
    if hsh(x, y, 63 + v) % 17 == 0: tone -= 1
    return K(mat, tone)


def fill_px(c, ox, oy, fn, **kw):
    for y in range(16):
        for x in range(16): c.P(ox + x, oy + y, fn(x, y, **kw))


def tile_row(id_, name, fns, desc='', tags=(), kind='terrain'):
    """낱칸 바닥 변형 n 개를 n×1 조각으로."""
    def draw(c):
        for i, f in enumerate(fns): fill_px(c, i * 16, 0, f)
    piece(id_, name, len(fns), 1, kind, group='terrain', tags=list(tags), desc=desc)(draw)


tile_row('sand', 'white-gold beach sand floor tiles, 3 variants (plain, wind ripples, shells)',
         [lambda x, y: sand_px(x, y, 0), lambda x, y: sand_px(x, y, 1), None], desc='흰·금빛 모래 바닥(변형 3: 맨 모래·바람 물결·조개).', tags=['모래', '해변'])


def _sand_shells(x, y):
    col = sand_px(x, y, 2)
    # 조개·불가사리 몇 개(고정 자리)
    for (sx, sy, k) in ((4, 4, 0), (11, 10, 1), (9, 3, 2)):
        dx, dy = x - sx, y - sy
        if k == 0 and (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)): return K('bone', 2 if (dx, dy) == (0, 0) else 1 if dy == 0 else 0)
        if k == 1 and (dx, dy) in ((0, -1), (-1, 0), (0, 0), (1, 0), (0, 1)): return K('coral', 2 if (dx, dy) == (0, 0) else 1 if dy <= 0 else 0)
        if k == 2 and (dx, dy) in ((0, 0), (1, 0)): return K('sand', -1 if dx else 3)
    return col


PIECES['sand']['draw'] = lambda c: [fill_px(c, i * 16, 0, f) for i, f in enumerate([lambda x, y: sand_px(x, y, 0), lambda x, y: sand_px(x, y, 1), _sand_shells])]

tile_row('grass', 'tropical jungle grass floor tiles, 2 variants (plain, small flowers)',
         [lambda x, y: grass_px(x, y, 0), lambda x, y: _grass_flowers(x, y)], desc='밀림 풀밭(변형 2: 맨 풀·작은 꽃).', tags=['풀'])


def _grass_flowers(x, y):
    for (sx, sy, mat) in ((3, 5, 'coral'), (11, 3, 'gold'), (8, 12, 'coral')):
        if (x, y) == (sx, sy): return K(mat, 2)
        if (x - sx, y - sy) in ((1, 0), (-1, 0), (0, -1)): return K(mat, 0)
        if (x - sx, y - sy) == (0, 1): return K('grass', -2)
    return grass_px(x, y, 1)


tile_row('cobble', 'harbor cobblestone pavement floor tiles, 2 variants', [lambda x, y: cobble_px(x, y, 0), lambda x, y: cobble_px(x, y, 1)],
         desc='항구 포석 바닥(마을·부두 광장). 변형 2.', tags=['포석', '항구'])
tile_row('rockfloor', 'flat coastal rock ground tiles, 2 variants', [lambda x, y: rockfloor_px(x, y, 0), lambda x, y: rockfloor_px(x, y, 1)],
         desc='평평한 해안 바위 바닥(곶·동굴 앞).', tags=['바위'])
tile_row('water', 'shallow turquoise sea water tiles, 2 variants', [lambda x, y: water_px(x, y, 'shallow', 0), lambda x, y: water_px(x + 5, y + 7, 'shallow', 0, 1)],
         desc='얕은 청록 바다(배·바위·산호를 띄운다). 걸을 수 없다.', tags=['물', '얕은 바다'])
tile_row('deepwater', 'deep blue sea water tiles, 2 variants', [lambda x, y: water_px(x, y, 'deep', 0), lambda x, y: water_px(x + 5, y + 7, 'deep', 0, 1)],
         desc='깊은 바다. 걸을 수 없다.', tags=['물', '깊은 바다'])
tile_row('deck', 'wooden ship deck planking floor tiles, 2 variants', [lambda x, y: deck_px(x, y, 0), lambda x, y: deck_px(x, y, 1)],
         desc='배 갑판·부두 마루(밝은 판자).', tags=['갑판', '마루'])


# ================================================================== 해안 덩이 오토타일
def at_beach(c, m, ox, oy):
    """모래 땅(이웃 = 모래·풀·길). 이웃 없는 쪽은 젖은 모래 → 물거품 줄 → 얕은 물로 끝난다."""
    s = shore_field(m, R=8)
    for y in range(16):
        for x in range(16):
            e = s[y, x] + min(1.0, s[y, x] / 3.0) * (0.55 * per16(x, 0.7) + 0.55 * per16(y, 2.1)) - 2.6
            if e < -2.2: col = sand_px(x, y, 0)
            elif e < -1.0: col = K('sand', 0) if hsh(x, y, 5) % 4 else K('sand', -1)
            elif e < 0.0: col = K('sand', -1) if hsh(x, y, 6) % 3 else K('sand', 0)
            elif e < 0.9: col = K('foam', 1) if hsh(x, y, 7) % 5 else K('foam', 0)
            elif e < 1.8: col = K('foam', -1) if (x + y) % 2 == 0 else K('shallow', 3)
            elif e < 2.8:
                col = K('shallow', 2) if hsh(x, y, 8) % 3 else water_px(x, y)
                if hsh(x, y, 9) % 7 == 0: col = K('foam', -1)
            else: col = water_px(x, y)
            c.P(ox + x, oy + y, col)


def at_grass(c, m, ox, oy):
    """풀밭(이웃 = 풀). 이웃 없는 쪽은 들쭉날쭉한 풀 끝 + 모래 위 1px 그늘(남쪽이 짙다)."""
    s = shore_field(m, R=6)
    for y in range(16):
        for x in range(16):
            e = s[y, x] + min(1.0, s[y, x] / 3.0) * (0.9 * per16(x, 1.3) + 0.9 * per16(y, 0.4)) - 3.2
            tuft = (hsh(x, 0, 71) % 3 == 0)
            if e < -1.0 or (e < 0.3 and tuft): col = grass_px(x, y)
            elif e < 0.0: col = K('grass', 1) if hsh(x, y, 72) % 2 else K('grass', 0)
            elif e < 1.0: col = K('sand', -1) if (s[min(15, y), x] > 0) else sand_px(x, y)
            else: col = sand_px(x, y)
            c.P(ox + x, oy + y, col)
    # 풀 가장자리 위 밝은 테(빛)·아래 짙은 테
    for y in range(16):
        for x in range(16):
            col = c.get(ox + x, oy + y)
            if col in RAMPS['grass']:
                up = c.get(ox + x, oy + y - 1) if y > 0 else None
                dn = c.get(ox + x, oy + y + 1) if y < 15 else None
                if dn is not None and dn not in RAMPS['grass']: c.P(ox + x, oy + y, K('grass', -2))
                elif up is not None and up not in RAMPS['grass']: c.P(ox + x, oy + y, K('grass', 2))


def at_deep(c, m, ox, oy):
    """깊은 바다(이웃 = 깊은 바다). 이웃 없는 쪽은 얕은 물로 풀린다(밝은 턱 + 섞임)."""
    s = shore_field(m, R=7)
    for y in range(16):
        for x in range(16):
            e = s[y, x] + min(1.0, s[y, x] / 3.0) * (0.7 * per16(x, 2.4) + 0.7 * per16(y, 1.1)) - 3.0
            if e < -0.5: col = water_px(x, y, 'deep')
            elif e < 0.5: col = K('deep', 1)
            elif e < 1.5: col = K('deep', 2) if (x + y) % 2 else K('shallow', -1)
            elif e < 2.5: col = K('shallow', -1) if hsh(x, y, 3) % 3 else K('shallow', 0)
            else: col = water_px(x, y)
            c.P(ox + x, oy + y, col)


def at_path(c, m, ox, oy):
    """흙길(풀밭 위, 이웃 = 길). 가장자리는 풀이 길 위로 삐져나온다."""
    s = shore_field(m, R=6)
    for y in range(16):
        for x in range(16):
            e = s[y, x] + min(1.0, s[y, x] / 3.0) * (0.8 * per16(x, 0.9) + 0.8 * per16(y, 2.7)) - 2.6
            tuft = hsh(x, y // 2, 81) % 4 == 0
            if e < -0.8: col = dirt_px(x, y)
            elif e < 0.2: col = K('wood', 0) if not tuft else K('grass', 1)
            elif e < 1.0: col = K('grass', -2) if not tuft else K('grass', 0)
            else: col = grass_px(x, y)
            c.P(ox + x, oy + y, col)


def at_sandpath(c, m, ox, oy):
    """다져진 모래길(풀밭 위, 이웃 = 모래길). 마을 안 길 — 밝은 모래 + 바퀴·발자국 결."""
    s = shore_field(m, R=6)
    for y in range(16):
        for x in range(16):
            e = s[y, x] + min(1.0, s[y, x] / 3.0) * (0.8 * per16(x, 2.2) + 0.8 * per16(y, 0.2)) - 2.6
            tuft = hsh(x, y // 2, 91) % 4 == 0
            if e < -0.8:
                col = sand_px(x, y, 0)
                if hsh(x, y, 93) % 13 == 0: col = K('sand', -1)
            elif e < 0.2: col = K('sand', -1) if not tuft else K('grass', 1)
            elif e < 1.0: col = K('grass', -2) if not tuft else K('grass', 0)
            else: col = grass_px(x, y)
            c.P(ox + x, oy + y, col)


blob_piece('at-beach', 'beach sand shoreline autotile sheet: sand edges with wet sand, white surf foam and shallow water, 47 variants',
           at_beach, desc='모래 해안 오토타일: 모래 칸 둘레가 젖은 모래 → 흰 물거품 → 얕은 물로 끝난다. 얕은 물(water)과 맞닿게 깐다.', tags=['해변', '모래', '물거품'])
blob_piece('at-grass', 'jungle grass on sand autotile sheet, ragged grass edges over sand, 47 variants',
           at_grass, desc='모래 위 풀밭 오토타일(가장자리 들쭉날쭉).', tags=['풀'])
blob_piece('at-deep', 'deep sea autotile sheet blending into shallow turquoise water at edges, 47 variants',
           at_deep, desc='깊은 바다 오토타일: 가장자리가 얕은 물로 풀린다. 얕은 물 띠 바깥에 깐다.', tags=['물', '깊은 바다'])
blob_piece('at-path', 'packed dirt jungle path autotile sheet over grass, 47 variants',
           at_path, desc='풀밭 위 흙길 오토타일.', tags=['길'])
blob_piece('at-sandpath', 'packed sand village path autotile sheet over grass, 47 variants',
           at_sandpath, desc='풀밭 위 다져진 모래길(마을 길) 오토타일.', tags=['길', '마을'])


# ================================================================== 부두·방파제·요새 벽(4이웃)
def at_boardwalk(c, m, ox, oy):
    """물 위 판자 부두: 가로 판자. 남쪽이 비면 앞 들보(4행) + 물에 박힌 말뚝·거품. 동서가 비면 모서리 들보 + 말뚝 머리."""
    for y in range(16):
        for x in range(16): c.P(ox + x, oy + y, deck_px(x, y, 0, 'wood', 0))
    if not m & N:
        c.HL(ox, oy, 16, K('dark', 1)); c.HL(ox, oy + 1, 16, K('wood', -2))
    for side in (W, E):
        if not m & side:
            x0 = 0 if side == W else 14
            c.R(ox + x0, oy, 2, 16, K('dark', 2 if side == W else 0)); c.VL(ox + (x0 if side == W else x0 + 1), oy, 16, K('dark', 3 if side == W else -1))
            for py in ((1, 9) if m & N or True else (9,)):
                c.R(ox + x0, oy + py, 2, 2, K('dark', 3 if side == W else 1)); c.P(ox + x0 + (1 if side == W else 0), oy + py + 1, K('dark', 0))
    if not m & S:
        for y in range(10, 16):
            for x in range(16): c.P(ox + x, oy + y, water_px(x, y))
        c.HL(ox, oy + 10, 16, K('dark', 2)); c.R(ox, oy + 11, 16, 2, K('dark', 0)); c.HL(ox, oy + 13, 16, K('dark', -2))
        for px in ([1, 7, 13] if True else []):
            if (px < 4 and m & W) or (px > 11 and m & E): pass
            c.R(ox + px, oy + 13, 2, 2, K('dark', -1)); c.P(ox + px, oy + 13, K('dark', 1))
            c.P(ox + px - 1, oy + 15, K('foam', 0)); c.P(ox + px + 2, oy + 15, K('foam', 0)); c.HL(ox + px, oy + 15, 2, K('foam', 1))
        if not m & W: c.R(ox, oy + 10, 2, 4, K('dark', 1))
        if not m & E: c.R(ox + 14, oy + 10, 2, 4, K('dark', -1))


def at_quay(c, m, ox, oy):
    """돌 방파제·부두 땅(포석): 남쪽이 비면 돌 쌓은 벽 앞면(6행) + 물에 닿는 거품. 북·동·서가 비면 경계석 테."""
    for y in range(16):
        for x in range(16): c.P(ox + x, oy + y, cobble_px(x, y, 0))
    if not m & N:
        c.HL(ox, oy, 16, K('stone', -2)); c.R(ox, oy + 1, 16, 2, K('stone', 2)); c.HL(ox, oy + 3, 16, K('stone', 0))
    if not m & W:
        c.R(ox, oy, 3, 16, K('stone', 1)); c.VL(ox, oy, 16, K('stone', -1)); c.VL(ox + 2, oy, 16, K('stone', -2))
    if not m & E:
        c.R(ox + 13, oy, 3, 16, K('stone', 0)); c.VL(ox + 15, oy, 16, K('stone', -3)); c.VL(ox + 13, oy, 16, K('stone', 2))
    if not m & S:
        c.R(ox, oy + 7, 16, 2, K('stone', 2)); c.HL(ox, oy + 7, 16, K('stone', 3))        # 경계석 윗면
        stones(c, ox, oy + 9, 16, 6, 'stone', -1, bh=3, blen=(4, 7), s=ox // 16 + 3, moss=0.25)
        c.HL(ox, oy + 9, 16, K('stone', -3))
        for x in range(16): c.P(ox + x, oy + 15, K('foam', 1) if hsh(x, 0, 5) % 3 else K('foam', 0))
        if not m & W: c.R(ox, oy + 7, 3, 8, K('stone', 0))
        if not m & E: c.R(ox + 13, oy + 7, 3, 8, K('stone', -2))


def at_fortwall(c, m, ox, oy):
    """요새 성벽 윗면(걷는 길 + 바깥 흉벽). 이웃 없는 쪽에 흉벽(여장) — 윗면이 보이는 돌 덩이. 남쪽 앞면은 wall-face-fort 두 줄을 아래에 붙인다."""
    for y in range(16):
        for x in range(16):
            col = cobble_px(x, y, 1)
            c.P(ox + x, oy + y, shift_col(col, None, -1))
    def merlon_row(y0, horiz=True, xs=None):
        pass
    if not m & N:
        for i in range(0, 16, 6):
            box(c, ox + i, oy, 5, 3, 2, 'stone', tt=2, ft=-1, sides=False)
        c.HL(ox, oy + 5, 16, K('stone', -2))
    if not m & S:
        c.R(ox, oy + 11, 16, 5, K('stone', 1))
        for i in range(0, 16, 6): box(c, ox + i, oy + 10, 5, 3, 3, 'stone', tt=3, ft=0, sides=False)
        c.HL(ox, oy + 10, 16, K('stone', -2))
    if not m & W:
        c.R(ox, oy, 3, 16, K('stone', 2)); c.VL(ox + 3, oy, 16, K('stone', -2)); c.VL(ox, oy, 16, K('stone', 0))
    if not m & E:
        c.R(ox + 13, oy, 3, 16, K('stone', 1)); c.VL(ox + 12, oy, 16, K('stone', -2)); c.VL(ox + 15, oy, 16, K('stone', -2))


auto4_piece('at-boardwalk', 'wooden pier boardwalk over water autotile: plank deck, edge beams, posts in the water with foam, 16 variants',
            at_boardwalk, desc='물 위 판자 부두(걷는다). 이웃 없는 남쪽은 앞 들보와 물에 박힌 말뚝.', tags=['부두', '판자'])
auto4_piece('at-quay', 'harbor stone quay autotile: cobble top, curb stones, south stone wall face into the sea with foam, 16 variants',
            at_quay, desc='돌 방파제·항구 포석 땅. 남쪽이 물이면 돌벽 앞면이 보인다.', tags=['항구', '방파제'])
auto4_piece('at-fortwall', 'stone fort rampart top autotile: walkway with crenellated parapet blocks on open sides, 16 variants',
            at_fortwall, desc='요새 성벽 윗면(걷는 길). 바깥쪽(이웃 없는 쪽)에 여장. 남쪽 가장자리 아래 두 줄에 wall-face-fort 를 붙인다.', tags=['요새', '성벽'])


@piece('wall-face-fort', 'stone fort wall front face strip, 4 variants x 2 rows (plain, arrow slit, cannon port, mossy)', 4, 2, 'terrain', group='terrain',
       tags=['요새', '성벽'], desc='요새 성벽 앞면(성벽 윗면 남쪽 가장자리 바로 아래 두 줄). 열 = 변형(민벽·활 구멍·포문·이끼).')
def _wff(c):
    for v in range(4):
        ox = v * 16
        stones(c, ox, 0, 16, 32, 'stone', -1, bh=5, blen=(5, 9), s=v * 7 + 1, moss=0.35 if v == 3 else 0.06)
        c.HL(ox, 0, 16, K('stone', -3)); c.HL(ox, 1, 16, K('stone', -2))
        c.HL(ox, 30, 16, K('stone', -2)); c.HL(ox, 31, 16, K('stone', -3))
        if v == 1:
            c.R(ox + 7, 8, 2, 12, K('shadow', 0)); c.VL(ox + 6, 8, 12, K('stone', 2)); c.VL(ox + 9, 8, 12, K('stone', -2)); c.HL(ox + 6, 20, 4, K('stone', 2))
        if v == 2:
            c.R(ox + 3, 10, 10, 8, K('stone', 2)); c.R(ox + 4, 11, 8, 6, K('shadow', 0)); c.HL(ox + 4, 11, 8, K('shadow', -1))
            c.R(ox + 5, 13, 6, 3, K('iron', -1)); c.ell(ox + 8, 14.5, 2, 1.5, K('shadow', -1)); c.P(ox + 6, 13, K('iron', 1))
            c.HL(ox + 3, 18, 10, K('stone', -3))
        if v == 3:
            for k in range(6): c.VL(ox + 2 + k * 2 + (k % 2), 2 + k % 3, 5 + hsh(k, v) % 6, K('moss', -1 + k % 3))


# ================================================================== 실내 바닥·벽
def ship_px(x, y): return deck_px(x, y, 3, 'dark', 1)
def tavern_px(x, y): return deck_px(x, y, 5, 'wood', -1)


def reed_px(x, y):
    """갈대 돗자리: 2×2 엮음 체크(가로·세로 번갈아) + 테두리 없는 반복."""
    x %= 16; y %= 16
    bx, by = x // 4, y // 4; u, v = x % 4, y % 4
    if (bx + by) % 2 == 0: t = 1 if v in (0, 1) else -1 if v == 3 else 0
    else: t = 1 if u in (0, 1) else -1 if u == 3 else 0
    if hsh(x, y, 101) % 23 == 0: t -= 1
    return K('thatch', t)


def cave_px(x, y): return rockfloor_px(x + 3, y + 5, 2)


def treasure_px(x, y):
    col = rockfloor_px(x, y, 3)
    for (sx, sy) in ((3, 4), (11, 9), (6, 12), (13, 2)):
        if (x, y) == (sx, sy): return K('gold', 2)
        if (x, y) == (sx + 1, sy): return K('gold', 0)
        if (x, y) == (sx, sy + 1): return K('gold', -2)
    return col


tile_row('floor-ship', 'dark ship cabin plank floor tiles, 2 variants', [ship_px, lambda x, y: deck_px(x, y, 9, 'dark', 1)], desc='배 안 어두운 판자 바닥(선실·선창·주방).', tags=['실내', '배'])
tile_row('floor-tavern', 'tavern wooden floorboards tiles, 2 variants', [tavern_px, lambda x, y: deck_px(x, y, 7, 'wood', -1)], desc='술집 마루.', tags=['실내', '술집'])
tile_row('floor-reed', 'woven reed mat hut floor tiles', [reed_px, lambda x, y: reed_px(x + 4, y)], desc='오두막 갈대 돗자리 바닥.', tags=['실내', '오두막'])
tile_row('floor-cave', 'rough cave rock floor and treasure-strewn floor tiles', [cave_px, treasure_px], desc='동굴 바위 바닥(변형 2: 맨바닥·금화 흩어진 바닥).', tags=['실내', '동굴'])


def wall_cap(c, m, ox, oy, mat, t=-2):
    """실내 벽 천장(벽 덩이 윗면): 어두운 판 + 이웃 없는 쪽에 밝은 테(벽 위 모서리)."""
    for y in range(16):
        for x in range(16):
            if mat == 'rock': col = K('rock', -2 + (1 if hsh(x // 3, y // 3, 7) % 4 == 0 else 0) - (1 if hsh(x, y, 9) % 9 == 0 else 0))
            elif mat == 'thatch': col = K('thatch', -2 + (1 if (x + (y // 3)) % 4 == 0 else 0))
            else: col = K(mat, t - (1 if (y % 4 == 3) else 0))
            c.P(ox + x, oy + y, col)
    hi = K(mat if mat != 'rock' else 'rock', 1); lo = K(mat, -3)
    if not m & N: c.HL(ox, oy, 16, lo); c.HL(ox, oy + 1, 16, hi)
    if not m & S: c.HL(ox, oy + 15, 16, K(mat, 2)); c.HL(ox, oy + 14, 16, hi)
    if not m & W: c.VL(ox, oy, 16, lo); c.VL(ox + 1, oy, 16, hi)
    if not m & E: c.VL(ox + 15, oy, 16, lo); c.VL(ox + 14, oy, 16, K(mat, 0))


for _mat, _id, _ko, _en in (('dark', 'ship', '배 선실 벽(검은 나무)', 'dark ship timber'), ('wood', 'tavern', '술집 벽(나무 들보)', 'tavern timber'),
                            ('thatch', 'hut', '오두막 벽(짚·대나무)', 'bamboo hut'), ('rock', 'cave', '동굴 벽(바위)', 'cave rock')):
    auto4_piece('at-wall-' + _id, f'{_en} interior wall top (ceiling) autotile, 16 variants',
                (lambda mat: lambda c, m, ox, oy: wall_cap(c, m, ox, oy, mat))(_mat),
                desc=f'{_ko} 천장 덩이. 남쪽 가장자리 아래 두 줄에 wall-face-{_id} 를 붙인다.', tags=['실내', '벽'])


def _face_ship(c, ox, v):
    planks(c, ox, 0, 16, 32, 'dark', 0, bw=4, plen=19, s=v * 3 + 1)
    c.R(ox, 0, 16, 3, K('dark', -2)); c.HL(ox, 3, 16, K('dark', 2))           # 천장 들보 그늘·턱
    c.R(ox, 28, 16, 4, K('dark', -1)); c.HL(ox, 28, 16, K('dark', 1)); c.HL(ox, 31, 16, K('dark', -3))   # 걸레받이
    if v == 1:                                                                  # 둥근 현창
        c.ell(ox + 8, 14, 5, 5, K('gold', -1)); c.ell(ox + 8, 14, 4, 4, K('gold', 1)); c.ell(ox + 8, 14, 3, 3, K('deep', 1))
        c.P(ox + 6, 12, K('deep', 3)); c.P(ox + 7, 12, K('shallow', 3)); c.P(ox + 6, 13, K('deep', 2)); c.HL(ox + 6, 16, 4, K('deep', -1))
    if v == 2:                                                                  # 갈비 기둥
        c.R(ox + 6, 3, 4, 25, K('dark', 1)); c.VL(ox + 6, 3, 25, K('dark', 2)); c.VL(ox + 9, 3, 25, K('dark', -2))
        for k in (8, 20): c.HL(ox + 6, k, 4, K('iron', 0)); c.P(ox + 7, k, K('iron', 2))
    if v == 3:                                                                  # 걸린 밧줄 고리
        for a in range(18):
            ang = 2 * math.pi * a / 18; c.P(ox + 8 + round(4 * math.cos(ang)), 15 + round(5 * math.sin(ang)), K('thatch', 0 if a % 2 else -1))
        c.R(ox + 7, 9, 2, 2, K('iron', 1))


def _face_tavern(c, ox, v):
    # 회칠 벽 + 위 들보 + 아래 판자 벽널
    for y in range(32):
        for x in range(16):
            t = 1 if hsh(x, y, v + 3) % 19 else 0
            c.P(ox + x, y, K('plaster', t - (1 if y < 6 else 0)))
    c.R(ox, 0, 16, 4, K('wood', -2)); c.HL(ox, 4, 16, K('wood', 1)); c.HL(ox, 5, 16, K('wood', -2))
    planks(c, ox, 18, 16, 14, 'wood', -1, bw=16, plen=4, vertical=True, s=v)
    c.HL(ox, 17, 16, K('wood', 2)); c.HL(ox, 18, 16, K('wood', 0)); c.HL(ox, 31, 16, K('wood', -3))
    if v == 1: c.R(ox + 7, 4, 2, 14, K('wood', -1)); c.VL(ox + 7, 4, 14, K('wood', 1))
    if v == 2:                                                                  # 작은 창(덧창)
        shutter_window(c, ox + 4, 7, 8, 7, 'teal', 'wood', sill=True)
    if v == 3:                                                                  # 걸린 등잔
        c.R(ox + 7, 7, 3, 1, K('iron', 0)); c.R(ox + 6, 8, 5, 5, K('iron', -1)); c.R(ox + 7, 9, 3, 3, K('fire', 2)); c.P(ox + 8, 10, K('fire', 3))


def _face_hut(c, ox, v):
    planks(c, ox, 0, 16, 32, 'thatch', 0, bw=3, plen=40, vertical=True, s=v + 11, nails=False)
    c.R(ox, 0, 16, 3, K('thatch', -3)); c.HL(ox, 3, 16, K('thatch', -1))
    for yy in (9, 21): c.HL(ox, yy, 16, K('wood', -1)); c.HL(ox, yy + 1, 16, K('wood', -3))   # 묶은 가로대
    c.R(ox, 29, 16, 3, K('thatch', -2)); c.HL(ox, 31, 16, K('thatch', -3))
    if v == 1:
        for k in range(5): c.VL(ox + 3 + k * 2, 4, 6 + k % 2, K('moss', 0 if k % 2 else 1))
    if v == 2: shutter_window(c, ox + 4, 11, 8, 7, 'thatch', 'wood')
    if v == 3:                                                                  # 걸린 방패 모양 바구니
        c.ell(ox + 8, 15, 5, 4, K('thatch', -2)); c.ell(ox + 8, 15, 4, 3, K('thatch', 1)); c.HL(ox + 4, 15, 9, K('thatch', -1))


def _face_cave(c, ox, v):
    for y in range(32):
        for x in range(16):
            xx = ox + x
            # 세로로 긴 바위 덩이(빛 왼쪽 위)
            col_i = (x + hsh(y // 6, v, 5) % 5) // 5
            u = (x + hsh(y // 6, v, 5) % 5) % 5
            t = (0 if u == 0 else -1 if u < 3 else -2) + (hsh(col_i, y // 7, v + 9) % 3 - 1)
            if y % 7 == 0: t += 1
            c.P(xx, y, K('rock', t))
    c.R(ox, 0, 16, 2, K('rock', -3)); c.R(ox, 29, 16, 3, K('rock', -2)); c.HL(ox, 31, 16, K('rock', -3))
    if v == 1:
        for k in range(4): c.P(ox + 3 + k * 3, 10 + k % 2 * 6, K('gold', 1)); c.P(ox + 4 + k * 3, 11 + k % 2 * 6, K('gold', -1))
    if v == 2:
        for k in range(6): c.VL(ox + 2 + k * 2, 2, 4 + hsh(k, 2) % 8, K('moss', k % 3 - 1))
    if v == 3:
        c.R(ox + 7, 9, 2, 2, K('iron', 0)); c.R(ox + 6, 11, 4, 5, K('dark', 0)); c.R(ox + 7, 8, 2, 3, K('fire', 1)); c.P(ox + 7, 7, K('fire', 3)); c.P(ox + 8, 6, K('fire', 2))


for _id, _fn, _ko, _en in (('ship', _face_ship, '배 선실 벽 앞면', 'dark ship cabin plank wall'), ('tavern', _face_tavern, '술집 벽 앞면(회칠+벽널)', 'tavern plaster and wainscot wall'),
                           ('hut', _face_hut, '오두막 벽 앞면(대나무)', 'bamboo hut wall'), ('cave', _face_cave, '동굴 벽 앞면(바위)', 'cave rock wall')):
    piece('wall-face-' + _id, f'{_en} front face strip, 4 variants x 2 rows', 4, 2, 'terrain', group='terrain', tags=['실내', '벽'],
          desc=f'{_ko} — 천장(at-wall-{_id}) 남쪽 가장자리 바로 아래 두 줄. 열 = 변형.')((lambda fn: lambda c: [fn(c, v * 16, v) for v in range(4)])(_fn))
