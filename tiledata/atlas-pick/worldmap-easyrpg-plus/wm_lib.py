"""EasyRPG World 개선판 — 공용 함수.

모든 픽셀은 좌표·규칙으로 직접 정한다. 생성 모델·트레이싱은 쓰지 않는다.
원본: public/assets/easyrpg-chipset-world.png (EasyRPG RTP World, CC BY 4.0).
시트 칸 배치(16px 격자, 칸 번호 = 행*30+열)는 바꾸지 않는다.
"""
import colorsys
import math
import numpy as np
from PIL import Image

PINK = (255, 103, 139)
CELL = 16
COLS = 30
ROWS = 16


def load_sheet(path):
    return np.array(Image.open(path).convert("RGB"), dtype=np.uint8)


def cell(a, c, r):
    return a[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]


def put_cell(a, c, r, tile):
    a[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = tile


def hexc(s):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


# ---------------------------------------------------------------- 팔레트 톤 다운
def mute_pixel(rgb, sat=0.86, val=0.95, hue_pull=True):
    """FF6 세계지도 톤 쪽으로 살짝 죽이는 규칙(HSV).
    - 분홍 키색·거의 흰색·거의 검정은 건드리지 않는다.
    - 채도 x sat, 명도 x val.
    - 초록은 색상을 노랑 쪽으로 6도 당긴다(올리브 잔디).
    """
    r, g, b = rgb
    if (r, g, b) == PINK:
        return rgb
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if v < 0.12:
        return rgb
    if s < 0.10 and v > 0.90:
        return rgb
    if hue_pull and 0.20 < h < 0.42 and s > 0.25:
        h = h - 6 / 360
    s2 = s * sat
    v2 = v * val if s > 0.18 else v
    r2, g2, b2 = colorsys.hsv_to_rgb(h, min(1, s2), min(1, v2))
    return (int(round(r2 * 255)), int(round(g2 * 255)), int(round(b2 * 255)))


def mute_block(block, **kw):
    out = block.copy()
    cache = {}
    h, w, _ = block.shape
    for y in range(h):
        for x in range(w):
            k = tuple(int(v) for v in block[y, x])
            if k not in cache:
                cache[k] = mute_pixel(k, **kw)
            out[y, x] = cache[k]
    return out


# ---------------------------------------------------------------- 덩어리(마스크)
def footprint(cm, inset=1, rad=3, notch=True):
    """cm: 칸 지도(bool 2차원). 반환: 픽셀 단위 발자국(bool).
    변이 비어 있는 쪽으로 inset 픽셀 들여 쓰고, 바깥 모서리는 반지름 rad 로 둥글리고,
    대각선만 빈 안쪽 모서리는 작게 깎는다."""
    ch, cw = len(cm), len(cm[0])
    H, W = ch * CELL, cw * CELL
    F = np.zeros((H, W), bool)

    def has(cx, cy):
        return 0 <= cx < cw and 0 <= cy < ch and cm[cy][cx]

    for cy in range(ch):
        for cx in range(cw):
            if not cm[cy][cx]:
                continue
            n, s_, w_, e = has(cx, cy - 1), has(cx, cy + 1), has(cx - 1, cy), has(cx + 1, cy)
            nw, ne, sw, se = has(cx - 1, cy - 1), has(cx + 1, cy - 1), has(cx - 1, cy + 1), has(cx + 1, cy + 1)
            for ly in range(CELL):
                for lx in range(CELL):
                    ok = True
                    if not w_ and lx < inset:
                        ok = False
                    if not e and lx > CELL - 1 - inset:
                        ok = False
                    if not n and ly < inset:
                        ok = False
                    if not s_ and ly > CELL - 1 - inset:
                        ok = False
                    px, py = lx + 0.5, ly + 0.5
                    # 바깥(볼록) 모서리 둥글리기
                    for (cond, ox, oy) in ((not n and not w_, 1, 1), (not n and not e, -1, 1),
                                           (not s_ and not w_, 1, -1), (not s_ and not e, -1, -1)):
                        if cond:
                            cxp = inset + rad if ox > 0 else CELL - inset - rad
                            cyp = inset + rad if oy > 0 else CELL - inset - rad
                            inside_box = (px < inset + rad if ox > 0 else px > CELL - inset - rad) and \
                                         (py < inset + rad if oy > 0 else py > CELL - inset - rad)
                            if inside_box and (px - cxp) ** 2 + (py - cyp) ** 2 > rad * rad + 0.5:
                                ok = False
                    # 안쪽(오목) 모서리 깎기
                    if notch:
                        for (cond, ox, oy) in ((n and w_ and not nw, 0, 0), (n and e and not ne, 1, 0),
                                               (s_ and w_ and not sw, 0, 1), (s_ and e and not se, 1, 1)):
                            if cond:
                                dx = px if ox == 0 else CELL - px
                                dy = py if oy == 0 else CELL - py
                                if dx + dy < inset + 1.6:
                                    ok = False
                    if ok:
                        F[cy * CELL + ly, cx * CELL + lx] = True
    return F


def cellmap_full(n=5):
    return [[True] * n for _ in range(n)]


def cellmap_iso(n=5):
    cm = [[False] * n for _ in range(n)]
    cm[n // 2][n // 2] = True
    return cm


def cellmap_inner(n=5):
    cm = cellmap_full(n)
    m = n // 2
    for dy in (-1, 1):
        for dx in (-1, 1):
            cm[m + dy][m + dx] = False
    return cm


# 킷 배치(3열 x 4행): (열, 행) -> (종류, 5x5 캔버스에서 뽑을 칸)
KIT_LAYOUT = {
    (0, 0): ("iso", (2, 2)),
    (2, 0): ("inner", (2, 2)),
    (0, 1): ("full", (0, 0)), (1, 1): ("full", (2, 0)), (2, 1): ("full", (4, 0)),
    (0, 2): ("full", (0, 2)), (1, 2): ("full", (2, 2)), (2, 2): ("full", (4, 2)),
    (0, 3): ("full", (0, 4)), (1, 3): ("full", (2, 4)), (2, 3): ("full", (4, 4)),
}


def build_kit(render_fn, variant_tile):
    """render_fn(kind, cellmap) -> (80x80x3 캔버스). 12칸 킷 (48x64) 반환.
    (1,0) 칸은 엔진이 쓰지 않는 변형칸이라 variant_tile 그대로."""
    canv = {}
    for kind, cmf in (("iso", cellmap_iso), ("inner", cellmap_inner), ("full", cellmap_full)):
        canv[kind] = render_fn(kind, cmf())
    kit = np.zeros((4 * CELL, 3 * CELL, 3), np.uint8)
    for (c, r), (kind, (cx, cy)) in KIT_LAYOUT.items():
        kit[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = canv[kind][cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL]
    kit[0:CELL, CELL:2 * CELL] = variant_tile
    return kit


def tile_bg(tile, n=5):
    return np.tile(tile, (n, n, 1))


def outline_pass(canvas, F, sprite_mask, color):
    """sprite_mask(=칠해진 픽셀) 바깥쪽 4방향 이웃 중 F 안의 빈 픽셀에 윤곽색."""
    H, W = sprite_mask.shape
    out = sprite_mask.copy()
    for y in range(H):
        for x in range(W):
            if sprite_mask[y, x]:
                continue
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and sprite_mask[yy, xx]:
                    canvas[y, x] = color
                    out[y, x] = True
                    break
    return out
