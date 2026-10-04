"""월드맵 설계 데모 6단계 — 손 도트 랜드마크 7종.

Pillow 로 다각형 마스크를 그리고, 마스크마다 '왼쪽 위 빛' 계단 명암을 입힌 뒤 1px 어두운 테두리(111618)를 두른다.
원본 성 아이콘과 같은 결: 테두리 + 5~6단 명암 + 벽돌 줄눈 + 이끼 점.  생성 이미지·트레이싱 없음(좌표는 전부 손으로 적은 것).
"""
import numpy as np
from PIL import Image, ImageDraw

KEY = (255, 103, 139)
OUT = (17, 22, 24)


def H(x, y, s=0):
    n = (np.asarray(x, np.int64) * 374761393 + np.asarray(y, np.int64) * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


STONE = [hx(c) for c in ('2a2833', '363540', '493f59', '515567', '66648b', '78739c', '9a95bd')]
SAND = [hx(c) for c in ('351803', '6d3b15', '9a5435', 'b77246', 'd59147', 'e6b46a', 'f3d79a')]
LEAF = [hx(c) for c in ('0c3a22', '13522e', '1c6d32', '218238', '40a837', '6fc850', 'a4e070')]
GRASS = [hx(c) for c in ('13522e', '218238', '40a837', '5cbd45')]
BARK = [hx(c) for c in ('2a1406', '4a2a10', '6d3b15', '8a4f24', 'a8682f')]
ICE = [hx(c) for c in ('3a5a8a', '5c86b8', '8cb6dc', 'c4e0f0', 'f0fafc')]
WATER = [hx(c) for c in ('14407a', '1e62a8', '2f86cc', '5cb0e0', 'b4e6f4')]
ROCKB = [hx(c) for c in ('2a1408', '4a2a18', '6a3c24', '8a5234', 'a8683c', 'c88c58')]
CRYS = [hx(c) for c in ('1c5a78', '2a8ca8', '5cc8d8', 'a4f0f0', 'f0ffff')]


class C:
    def __init__(self, cw, ch):
        self.w, self.h = cw * 16, ch * 16
        self.px = np.zeros((self.h, self.w, 3), np.uint8)
        self.px[:] = KEY
        self.m = np.zeros((self.h, self.w), bool)
        self.Y, self.X = np.mgrid[0:self.h, 0:self.w]

    def mask(self, fn):
        im = Image.new('L', (self.w, self.h), 0)
        fn(ImageDraw.Draw(im))
        return np.array(im) > 0

    def poly(self, pts):
        return self.mask(lambda d: d.polygon(pts, fill=255))

    def ell(self, cx, cy, rx, ry):
        return self.mask(lambda d: d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255))

    def rect(self, x0, y0, x1, y1):
        return self.mask(lambda d: d.rectangle((x0, y0, x1, y1), fill=255))

    def paint(self, mk, ramp, t, dither=True):
        """t: 0~1 밝기 배열(전체 크기). 계단 양자화 + 경계 1px 체크 디더."""
        n = len(ramp)
        v = np.clip(t, 0, .9999) * (n - 1)
        lo = np.floor(v).astype(int)
        fr = v - lo
        chk = ((self.X + self.Y) & 1) == 0
        idx = np.where(dither & (fr > .62) & chk, lo + 1, lo) if dither else lo
        idx = np.clip(idx, 0, n - 1)
        arr = np.array(ramp, np.uint8)
        self.px[mk] = arr[idx][mk]
        self.m |= mk

    def put(self, mk, color):
        self.px[mk] = color
        self.m |= mk

    def dot(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y, x] = color
            self.m[y, x] = True

    def outline(self):
        m = self.m
        nb = np.zeros_like(m)
        nb[1:] |= m[:-1]; nb[:-1] |= m[1:]; nb[:, 1:] |= m[:, :-1]; nb[:, :-1] |= m[:, 1:]
        o = nb & ~m
        self.px[o] = OUT
        self.m |= o

    def save_arr(self):
        return self.px


def lit(c, mk, x0=None, x1=None, y0=None, y1=None, a=.55, b=.25, base=.55):
    """왼쪽 위가 밝고 오른쪽 아래가 어두운 그라디언트."""
    ys, xs = np.nonzero(mk)
    x0 = xs.min() if x0 is None else x0
    x1 = xs.max() if x1 is None else x1
    y0 = ys.min() if y0 is None else y0
    y1 = ys.max() if y1 is None else y1
    tx = (c.X - x0) / max(x1 - x0, 1)
    ty = (c.Y - y0) / max(y1 - y0, 1)
    return base + a * (.5 - tx) + b * (.5 - ty)


def bricks(c, mk, t, rowh=5, brick=8, amt=.2, s=1):
    row = (c.Y // rowh)
    off = (H(row, 0, s) * brick).astype(int)
    seam_h = (c.Y % rowh) == rowh - 1
    seam_v = ((c.X + off) % brick) == 0
    t = t.copy()
    t[seam_h] -= amt
    t[seam_v & ~seam_h] -= amt * .6
    t += (H(c.X // 2 + row, c.Y // 2, s + 7) - .5) * .12
    return t


# ─── 1. 천공섬 (5x3) ───
def sky_island():
    c = C(5, 3)
    cx = 40
    # 아래 바위 뿌리: 역원뿔, 톱니 끝
    pts = [(6, 14), (74, 14), (68, 24), (60, 32), (52, 38), (46, 46), (42, 41), (38, 47), (33, 39), (26, 34), (18, 27), (11, 21)]
    rock = c.poly(pts)
    t = lit(c, rock, a=.5, b=-.05, base=.5)
    t += (H(c.X // 3, c.Y // 3, 3) - .5) * .18
    t[((c.Y + (c.X // 7)) % 6) == 0] -= .14        # 지층 줄
    c.paint(rock, ROCKB, t)
    # 폭포 한 줄
    for y in range(17, 40):
        c.dot(57 + (y // 9) % 2, y, WATER[3] if y % 3 else WATER[4])
    # 윗면 풀밭 타원
    top = c.ell(cx, 13, 37, 9)
    g = lit(c, top, a=.4, b=.5, base=.6) + (H(c.X, c.Y, 4) - .5) * .18
    c.paint(top, GRASS, g)
    # 윗면 안쪽 가장자리 어두운 림(앞쪽)
    rim = top & ~c.ell(cx, 11, 35, 8)
    rim &= c.Y > 13
    c.put(rim, GRASS[0])
    # 나무 덩이
    for (tx, ty, r) in ((14, 10, 4), (20, 13, 3), (58, 9, 4), (64, 12, 3), (27, 8, 3)):
        m = c.ell(tx, ty, r, r - 1)
        c.paint(m, LEAF, lit(c, m, a=.6, b=.4, base=.6), dither=False)
        c.put(c.rect(tx, ty + r - 1, tx, ty + r), BARK[1])
    # 작은 탑(흰 돌)
    tw = c.rect(36, 1, 44, 13)
    c.paint(tw, STONE, bricks(c, tw, lit(c, tw, a=.7, b=.0, base=.78), rowh=4, brick=5, amt=.15))
    roof = c.poly([(34, 2), (46, 2), (40, -4)])
    c.paint(roof, SAND, lit(c, roof, a=.5, b=.2, base=.55), dither=False)
    c.put(c.rect(38, 6, 40, 9), STONE[0])
    c.put(c.rect(39, 11, 41, 13), STONE[0])
    # 구름 솜뭉치(가장자리·아래)
    for (qx, qy, r) in ((8, 22, 4), (72, 22, 4), (14, 29, 3), (66, 30, 3), (34, 44, 3), (52, 43, 2)):
        m = c.ell(qx, qy, r + 1, r - 1) & ~c.m
        c.paint(m, ICE, lit(c, m, a=.5, b=.5, base=.85), dither=False)
    c.outline()
    return c.save_arr()


# ─── 2. 거대한 탑 (2x4) ───
def giant_tower():
    c = C(2, 4)
    body = c.poly([(3, 62), (29, 62), (25, 26), (23, 16), (9, 16), (7, 26)])
    t = lit(c, body, x0=3, x1=29, a=.8, b=.1, base=.6)
    t = bricks(c, body, t, rowh=4, brick=7, amt=.17, s=2)
    c.paint(body, STONE, t)
    # 층 고리(살짝 튀어나온 띠)
    for yy, hw in ((50, 14), (38, 12), (26, 10)):
        r = c.rect(16 - hw, yy, 16 + hw, yy + 2)
        c.paint(r, STONE, lit(c, r, a=.6, b=-.4, base=.9), dither=False)
        c.put(c.rect(16 - hw, yy + 3, 16 + hw, yy + 3), STONE[0] if False else STONE[1])
    # 창
    for (wx, wy) in ((12, 53), (19, 53), (15, 41), (13, 29), (18, 29), (15, 19)):
        c.put(c.rect(wx, wy, wx + 1, wy + 3), STONE[0])
        c.dot(wx, wy, STONE[1])
    # 머리 전망대
    hd = c.rect(5, 10, 27, 16)
    c.paint(hd, STONE, bricks(c, hd, lit(c, hd, a=.7, b=.1, base=.75), rowh=3, brick=5, amt=.15, s=4))
    for bx in (5, 10, 15, 20, 25):
        m = c.rect(bx, 6, bx + 2, 10)
        c.paint(m, STONE, lit(c, m, a=.5, b=.0, base=.8), dither=False)
    # 꼭대기 수정
    cr = c.poly([(16, -1), (20, 4), (16, 9), (12, 4)])
    c.paint(cr, CRYS, lit(c, cr, a=.9, b=.3, base=.75), dither=False)
    # 문
    c.put(c.poly([(12, 62), (12, 57), (14, 55), (18, 55), (20, 57), (20, 62)]), STONE[0])
    # 바닥 돌무더기
    for (rx, ry) in ((1, 62), (30, 62), (4, 63), (27, 63)):
        c.paint(c.rect(rx, ry, rx + 2, ry + 1), STONE, lit(c, c.rect(rx, ry, rx + 2, ry + 1), base=.6), dither=False)
    # 이끼 점
    for i in range(14):
        xx = int(6 + H(i, 1, 9) * 20)
        yy = int(20 + H(i, 2, 9) * 40)
        if c.m[yy, xx]:
            c.dot(xx, yy, LEAF[3])
    c.outline()
    return c.save_arr()


# ─── 3. 폐허 도시 (4x3) ───
def ruined_city():
    c = C(4, 3)
    # 바닥 잔해 띠
    base = c.poly([(1, 44), (8, 40), (56, 40), (63, 44), (60, 47), (4, 47)])
    c.paint(base, SAND, lit(c, base, a=.3, b=.3, base=.45) + (H(c.X, c.Y, 5) - .5) * .25)
    # 벽체 조각들: 열마다 윗선 높이(계단식으로 무너진 모양)
    def wall(x0, x1, tops, bot=44, s=1):
        m = np.zeros((c.h, c.w), bool)
        n = len(tops)
        for x in range(x0, x1 + 1):
            seg = min((x - x0) * n // (x1 - x0 + 1), n - 1)
            ty = tops[seg]
            if (x - x0) % 5 == 2 and H(x, s, 3) > .5:
                ty += 2
            m[ty:bot + 1, x] = True
        t = lit(c, m, x0=x0, x1=x1, a=.6, b=.1, base=.62)
        t = bricks(c, m, t, rowh=4, brick=6, amt=.17, s=s)
        c.paint(m, STONE, t)
        # 윗면 부서진 단면(밝은 1px)
        ys, xs = np.nonzero(m)
        for x in range(x0, x1 + 1):
            col = np.nonzero(m[:, x])[0]
            if len(col):
                c.dot(x, col[0], STONE[6])
        return m
    wall(2, 13, [30, 27, 33], s=2)
    wall(15, 23, [22, 19, 25], s=3)
    # 온전한 성문 아치(가운데)
    arch = wall(24, 38, [14, 12, 12, 14, 16], s=4)
    c.put(c.poly([(28, 44), (28, 34), (30, 31), (34, 31), (36, 34), (36, 44)]), STONE[0])
    c.put(c.rect(25, 18, 26, 22), STONE[0]); c.put(c.rect(35, 18, 36, 22), STONE[0])
    wall(40, 52, [21, 17, 10, 14], s=5)
    wall(54, 62, [31, 36, 33], s=6)
    # 앞줄 낮은 담
    wall(6, 20, [39, 41, 39], s=7)
    wall(44, 58, [40, 38, 41], s=8)
    # 앞 잔해 돌 + 풀
    for i in range(16):
        xx = int(3 + H(i, 3, 11) * 57)
        yy = int(41 + H(i, 4, 11) * 5)
        m = c.rect(xx, yy, xx + 1 + (i % 2), yy + 1)
        c.paint(m, STONE, lit(c, m, base=.5 + H(i, 5, 11) * .4), dither=False)
    for i in range(10):
        xx = int(2 + H(i, 7, 12) * 58)
        yy = int(42 + H(i, 8, 12) * 5)
        c.dot(xx, yy, LEAF[3 + (i % 2)])
    # 덩굴: 벽 위 이끼
    for i in range(24):
        xx = int(3 + H(i, 1, 13) * 58)
        yy = int(12 + H(i, 2, 13) * 30)
        if c.m[yy, xx] and not (c.px[yy, xx] == np.array(OUT)).all():
            c.dot(xx, yy, LEAF[2])
    c.outline()
    return c.save_arr()


# ─── 4. 거목 (3x3) ───
def giant_tree():
    c = C(3, 3)
    # 줄기
    tr = c.poly([(17, 47), (20, 34), (21, 24), (27, 24), (28, 34), (31, 47), (27, 44), (24, 46), (21, 44)])
    t = lit(c, tr, x0=17, x1=31, a=.8, b=.0, base=.55) + (H(c.X, c.Y // 3, 6) - .5) * .18
    t[((c.X + c.Y // 4) % 4) == 0] -= .1
    c.paint(tr, BARK, t)
    # 뿌리
    for pts in ([(17, 47), (11, 47), (14, 44), (19, 43)], [(31, 47), (37, 47), (34, 44), (29, 43)]):
        m = c.poly(pts)
        c.paint(m, BARK, lit(c, m, a=.6, base=.45))
    # 나무 구멍 문
    c.put(c.poly([(22, 44), (22, 39), (24, 37), (26, 39), (26, 44)]), BARK[0])
    # 수관: 큰 덩이 여러 개를 뒤→앞
    blobs = [(10, 19, 10, 8), (38, 19, 10, 8), (24, 11, 13, 9), (16, 12, 9, 7), (32, 12, 9, 7), (24, 22, 15, 7), (8, 26, 7, 5), (40, 26, 7, 5)]
    for (bx, by, rx, ry) in blobs:
        m = c.ell(bx, by, rx, ry)
        tt = lit(c, m, x0=bx - rx, x1=bx + rx, y0=by - ry, y1=by + ry, a=.5, b=.8, base=.62)
        tt += (H(c.X // 2, c.Y // 2, 8) - .5) * .22
        c.paint(m, LEAF, tt)
        # 덩이 밑 그늘선
        sh = m & (c.Y > by + ry - 2)
        c.put(sh, LEAF[0])
    # 하얀 꽃/빛 방울
    for i in range(18):
        xx = int(6 + H(i, 1, 14) * 36)
        yy = int(6 + H(i, 2, 14) * 20)
        if c.m[yy, xx]:
            c.dot(xx, yy, (252, 244, 210) if i % 3 else (248, 200, 222))
    c.outline()
    return c.save_arr()


# ─── 5. 분화구 호수 (3x3) ───
def crater_lake():
    c = C(3, 3)
    outer = c.ell(24, 25, 22, 19)
    ring = lit(c, outer, a=.6, b=.5, base=.6) + (H(c.X // 2, c.Y // 2, 15) - .5) * .3
    c.paint(outer, ROCKB, ring)
    # 바깥 능선 돌출
    for (bx, by) in ((6, 12), (40, 10), (44, 28), (4, 30), (22, 5)):
        m = c.ell(bx, by, 4, 3)
        c.paint(m, ROCKB, lit(c, m, a=.6, b=.6, base=.75), dither=False)
    inner = c.ell(24, 27, 15, 11)
    # 안쪽 벽: 위쪽이 어두움(그림자)
    wall = c.ell(24, 25, 16, 12)
    c.paint(wall & ~inner | (inner & (c.Y < 20)), ROCKB, lit(c, wall, a=.3, b=-.7, base=.25), dither=False)
    lake = c.ell(24, 28, 13, 9)
    tw = 1.0 - ((c.Y - 19) / 18.0) * .8 + (H(c.X // 2, c.Y, 16) - .5) * .18
    tw -= ((c.X - 24) / 26.0) * .2
    c.paint(lake, WATER, tw)
    # 호수 반짝임
    for (sx, sy, l) in ((17, 26, 3), (29, 31, 2), (21, 33, 2), (31, 25, 1)):
        c.put(c.rect(sx, sy, sx + l, sy), WATER[4])
    # 중앙 작은 섬
    isl = c.ell(25, 29, 4, 2)
    c.paint(isl, GRASS, lit(c, isl, base=.7), dither=False)
    c.put(c.rect(25, 26, 26, 28), LEAF[3])
    # 연기/수증기 점
    for (sx, sy) in ((12, 22), (37, 24)):
        c.dot(sx, sy, ICE[3])
    c.outline()
    return c.save_arr()


# ─── 6. 사막 신전 (3x3) ───
def desert_temple():
    c = C(3, 3)
    # 3단 계단 피라미드
    tiers = [(3, 45, 26), (8, 40, 17), (13, 35, 9)]
    for (x0, x1, y0) in tiers:
        m = c.poly([(x0, 45 if y0 == 26 else y0 + 10), (x1, 45 if y0 == 26 else y0 + 10), (x1 - 3, y0), (x0 + 3, y0)])
        t = lit(c, m, x0=x0, x1=x1, a=.7, b=.1, base=.62)
        t = bricks(c, m, t, rowh=4, brick=8, amt=.15, s=x0)
        c.paint(m, SAND, t)
        # 윗면 띠
        top = c.rect(x0 + 3, y0, x1 - 3, y0 + 1)
        c.paint(top, SAND, lit(c, top, a=.3, base=.98), dither=False)
    # 꼭대기 제단
    alt = c.rect(20, 3, 28, 10)
    c.paint(alt, SAND, bricks(c, alt, lit(c, alt, a=.7, base=.7), rowh=3, brick=5, amt=.14, s=5))
    c.put(c.poly([(18, 3), (30, 3), (24, -3)]), SAND[5])
    c.paint(c.poly([(20, 3), (28, 3), (24, -1)]), SAND, np.full((c.h, c.w), .95), dither=False)
    # 정면 계단 + 문
    c.paint(c.rect(21, 34, 27, 45), SAND, np.where((c.Y % 2) == 0, .92, .5), dither=False)
    c.put(c.poly([(22, 30), (22, 27), (24, 25), (26, 27), (26, 30)]), SAND[0])
    c.put(c.rect(22, 31, 26, 34), SAND[1])
    # 양옆 오벨리스크
    for ox in (1, 40):
        ob = c.poly([(ox, 46), (ox + 5, 46), (ox + 4, 20), (ox + 2, 15), (ox + 1, 20)]) if False else c.poly([(ox + 1, 46), (ox + 6, 46), (ox + 5, 21), (ox + 3, 16), (ox + 2, 21)])
        c.paint(ob, SAND, lit(c, ob, x0=ox, x1=ox + 6, a=.8, base=.68), dither=False)
        c.put(c.rect(ox + 3, 28, ox + 4, 30), SAND[1])
    # 모래 쌓임 + 선인장
    sd = c.poly([(0, 47), (10, 43), (38, 43), (47, 47)])
    c.paint(sd & ~c.m, SAND, lit(c, sd, a=.2, b=.4, base=.85), dither=False)
    c.outline()
    return c.save_arr()


# ─── 7. 고대 돌원 (2x2) ───
def stone_circle():
    c = C(2, 2)
    # 뒤쪽 돌 → 앞쪽 돌 순서
    stones = [(6, 13, 3, 8), (13, 11, 4, 11), (20, 12, 3, 9), (25, 15, 3, 6), (3, 19, 4, 7), (10, 22, 4, 8), (18, 22, 4, 8), (25, 21, 3, 7)]
    for i, (sx, sy, w, h) in enumerate(stones):
        m = c.poly([(sx, sy + h), (sx + w, sy + h), (sx + w, sy + 1), (sx + w // 2 + (i % 2), sy - 1), (sx, sy + 1)])
        c.paint(m, STONE, lit(c, m, x0=sx, x1=sx + w, a=.8, b=.3, base=.62) + (H(c.X, c.Y, 20 + i) - .5) * .18)
        if h > 8:
            c.put(c.rect(sx + 1, sy + 3, sx + 1, sy + 5), LEAF[3] if i % 2 else STONE[1])
    # 중앙 제단석 + 룬 빛
    al = c.ell(16, 19, 3, 2)
    c.paint(al, STONE, lit(c, al, base=.8), dither=False)
    c.dot(16, 19, CRYS[3])
    c.dot(15, 19, CRYS[2]); c.dot(17, 19, CRYS[2]); c.dot(16, 18, CRYS[2])
    gr = c.ell(16, 26, 14, 4) & ~c.m
    c.paint(gr, GRASS, lit(c, gr, base=.7) + (H(c.X, c.Y, 21) - .5) * .3)
    c.outline()
    return c.save_arr()


LANDMARKS = [
    # 이름, 그리는 함수, 칸 폭, 칸 높이, 설명
    ('sky_island', sky_island, 5, 3, '천공섬 — 떠 있는 대륙'),
    ('giant_tower', giant_tower, 2, 4, '거대한 탑'),
    ('ruined_city', ruined_city, 4, 3, '폐허 도시'),
    ('giant_tree', giant_tree, 3, 3, '거목'),
    ('crater_lake', crater_lake, 3, 3, '분화구 호수'),
    ('desert_temple', desert_temple, 3, 3, '사막 신전'),
    ('stone_circle', stone_circle, 2, 2, '고대 돌원'),
]

if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/w7/lm.png'
    W = sum(w for _, _, w, _, _ in LANDMARKS) * 16 + 8 * len(LANDMARKS)
    sheet = Image.new('RGB', (W, 4 * 16), (90, 150, 90))
    x = 0
    for n, f, w, h, d in LANDMARKS:
        a = f()
        assert a.shape == (h * 16, w * 16, 3), (n, a.shape)
        im = Image.fromarray(a)
        im = Image.composite(Image.new('RGB', im.size, (90, 150, 90)), im, Image.fromarray((np.all(a == KEY, axis=2) * 255).astype(np.uint8)))
        sheet.paste(im, (x, 0))
        x += w * 16 + 8
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(out)
    print(sheet.size)
