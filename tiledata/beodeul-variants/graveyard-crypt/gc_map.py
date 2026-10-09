# 웨이브 B 공용 지도 렌더러: dlib.Map 에 오토타일 덧그림·야외 숲 가장자리·자동 막힘 계산을 더한다.
from gc_kit import *
from gc_kit import _hash
import dlib
from gc_ext import *

def opaque_cells(img, row_from_bottom=0):
    """맨 아래에서 row_from_bottom 번째 줄(칸)의 각 칸: (아래 반 불투명 화소 수)."""
    cols = img.width // T; y1 = img.height - row_from_bottom * T; out = []
    a = img.split()[3]
    for cx in range(cols):
        box = (cx * T, y1 - 8, cx * T + T, y1)
        out.append(sum(1 for v in a.crop(box).getdata() if v > 0))
    return out

def foot(img, rows=1, thr=10, soft=True):
    """발자국(막힘) 계산. soft(키 큰 부드러운 물체)=아랫줄만, 아래 반이 thr 화소 이상 칠해진 칸만. solid=아래 rows 줄 전부(불투명 있는 칸)."""
    out = []; cols = img.width // T; rowsN = img.height // T
    a = img.split()[3]
    for r in range(rows):
        for cx in range(cols):
            y1 = img.height - r * T
            box = (cx * T, y1 - T, cx * T + T, y1)
            n = sum(1 for v in a.crop(box).getdata() if v > 0)
            lo = sum(1 for v in a.crop((cx * T, y1 - 8, cx * T + T, y1)).getdata() if v > 0)
            if (soft and r == 0 and lo >= thr) or (not soft and n >= 40): out.append((cx, -r))
    return out

class KMap(dlib.Map):
    def __init__(s, W, H, name):
        super().__init__(W, H, name)
        s.under = []      # (cells:set, sheet)  바닥 위·소품 아래 오토타일
        s.over = []       # 소품과 같은 층 오토타일 (울타리 등)
        s.autoblock = set()
        s.outdoor = set()
        s.canopy_tint = (0.62, 0.95, 0.66)
        s.partlist = []
        s.canopy_pal = 0
        s.canopy_r = 3
        s.ceil_fn = None
        s.CAN2 = [(12, 8, 22), (22, 16, 36), (34, 26, 52), (50, 40, 72), (72, 58, 98)]

    def put(s, x, y, img, rows=1, soft=True, layer=1, block=None, thr=10):
        blk = block if block is not None else foot(img, rows, thr, soft)
        s.props_add(x, y, img, blk, layer)

    def near_outdoor(s, x, y, r=2):
        for yy in range(y - r, y + r + 1):
            for xx in range(x - r, x + r + 1):
                if (xx, yy) in s.outdoor: return True
        return False

    CAN = [(8, 22, 20), (14, 36, 30), (22, 54, 40), (34, 76, 50), (52, 100, 62)]
    def canopy_tile(s, x, y):
        """숲 가장자리 타일: 덩이진 어두운 잎 덩어리. 열린 쪽 가장자리는 밝은 잎이 들쭉날쭉하고 남쪽 가장자리 아래는 줄기 그늘."""
        def op(dx, dy):
            xx, yy = x + dx, y + dy
            return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
        o = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0))
        key = ('canopy2', o, int(_hash(x, y, 4) * 4), s.canopy_pal)
        if key in dlib._fl_cache: return dlib._fl_cache[key]
        N, E, S_, W = o; CAN = s.CAN if s.canopy_pal == 0 else s.CAN2
        def f(px_, py_):
            X = px_ + x * 16; Y = py_ + y * 16
            n = vnoise(X, Y, 5, 811) * .65 + vnoise(X, Y, 2.4, 812) * .35
            k = 1 if n < .40 else (2 if n < .62 else 3)
            if _hash(X, Y, 813) > .94: k += 1
            d = 99.0
            if N: d = min(d, py_)
            if S_: d = min(d, 15 - py_)
            if W: d = min(d, px_)
            if E: d = min(d, 15 - px_)
            if d < 6:
                rag = vnoise(X * 1.3, Y * 1.3, 2.2, 814) * 3.2
                if d < rag + 1.2: k = min(4, k + 1 + (1 if d < rag * .6 else 0))
                elif d < 6: k = max(0, k - (1 if d < 5 else 0))
            if S_ and py_ >= 13: k = 0
            return tuple(int(v * .78) for v in CAN[clamp(k, 0, 4)])
        im = mk(f); dlib._fl_cache[key] = im; return im
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(dlib.face_tile(sty, None, n - k, int(_hash(x, y, 3) * 6), capL, capR, n * T), P)
                elif s.near_outdoor(x, y, s.canopy_r):
                    im.alpha_composite(s.canopy_tile(x, y), P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(s.ceil_fn(o8, int(_hash(x, y, 4) * 4)) if s.ceil_fn else dlib.ceiling(o8, int(_hash(x, y, 4) * 4), s.cave, getattr(s, 'band_pal', None)), P)
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for cells, sheet in s.over:
            for (x, y) in sorted(cells, key=lambda c: (c[1], c[0])): im.alpha_composite(atile_img(sheet, autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im
