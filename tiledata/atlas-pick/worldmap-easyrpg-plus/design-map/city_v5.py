#!/usr/bin/env python3
"""월드맵 설계 데모 5단계 — 성곽 도시 아이콘 3종(손 도트, 좌표로만 그림).

  capital  6x6 (96x96)  수도: 팔각 바깥 성벽 + 안쪽 성벽·성채 + 시장 광장 + 집들
  fort     4x4 (64x64)  성곽 도시: 칠각 성벽 + 작은 성채
  harbor   5x4 (80x64)  항구 성곽 도시: 북·동·서 성벽, 남쪽은 부두(물 쪽이 열림)

3/4 시점: 성벽은 윗면 + 앞면(남쪽 면·북쪽 성벽의 안쪽 면), 빛은 왼쪽 위.
색은 원본(world-plus-ext 성·마을 아이콘)에 이미 있는 것만 쓴다. 생성 모델·트레이싱 없음.
"""
import numpy as np
import scipy.ndimage as ndi
from PIL import Image, ImageDraw

KEY = (255, 103, 139)


def C(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


K = C('#111618')       # 윤곽
S0, S1, S2, S3, S4, S5 = C('#373740'), C('#473f55'), C('#505362'), C('#666484'), C('#777394'), C('#8d8aac')
MOS = C('#716641')     # 이끼
PALE = C('#aec3b7')
SAND, SAND2, EARTH = C('#ca9356'), C('#966a52'), C('#925940')
BR0, BR1 = C('#321b09'), C('#5e3516')
WOOD, WOOD2 = C('#683f20'), C('#925940')
RED, RED2 = C('#b82e2e'), C('#6b1a16')
G0, G1, G2, G3, G4 = C('#1a4e2b'), C('#2c7b37'), C('#4c8135'), C('#54a043'), C('#8abe4c')
WATER, WATER2, WATER3 = C('#3f7fb8'), C('#2f6a9e'), C('#6aa8d6')


def hsh(x, y, s=0):
    v = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    v = ((v ^ (v >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((v ^ (v >> 16)) & 0xFFFF) / 65535.0


class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 3), np.uint8)
        self.a[:] = KEY
        self.yy, self.xx = np.mgrid[0:h, 0:w]

    def fill(self, m, c):
        self.a[m] = c

    def poly(self, pts, c):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([(int(x), int(y)) for x, y in pts], fill=255)
        m = np.array(im) > 0
        self.a[m] = c
        return m

    def pmask(self, pts):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([(int(x), int(y)) for x, y in pts], fill=255)
        return np.array(im) > 0

    def ell(self, cx, cy, rx, ry):
        return ((self.xx - cx) / (rx + .5)) ** 2 + ((self.yy - cy) / (ry + .5)) ** 2 <= 1.0

    def rect(self, x0, y0, x1, y1, c):
        self.a[max(y0, 0):y1 + 1, max(x0, 0):x1 + 1] = c

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = c

    def solid(self):
        return ~np.all(self.a == np.array(KEY, np.uint8), axis=2)

    def outline(self, m, c=K):
        e = ndi.binary_dilation(m, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~m
        self.a[e & ~self.solid()] = c


def shift_up(m, k):
    o = np.zeros_like(m)
    if k == 0:
        return m.copy()
    o[:-k] = m[k:]
    return o


# ---------------------------------------------------------------- 성벽 고리
def wall_ring(cv, ring, hgt, split_y, merl=True):
    """고리 모양 발자국 ring 을 hgt 만큼 올린다. 앞(남쪽)쪽 조각 마스크를 함께 돌려준다."""
    H, W = ring.shape
    lev = np.full((H, W), -1, np.int32)
    srcy = np.zeros((H, W), np.int32)
    for k in range(hgt):
        m = shift_up(ring, k)
        lev[m] = k
        srcy[m] = (cv.yy + k)[m]
    top = shift_up(ring, hgt)
    face = (lev >= 0) & ~top
    # 앞면 색: 높이(lev) 기준 3단 + 돌 줄눈 + 이끼
    for y, x in zip(*np.nonzero(face)):
        k = lev[y, x]
        if k >= hgt - 1:
            c = S2
        elif k >= 2:
            c = S1
        else:
            c = S0
        row = (k // 3)
        if k % 3 == 0 and k > 0 and k < hgt - 1:
            c = S0
        elif (x + (row % 2) * 3) % 6 == 0 and k < hgt - 1:
            c = S0
        if hsh(x, y, 5) < .035 and 2 <= k < hgt - 1:
            c = MOS
        cv.a[y, x] = c
    # 윗면
    edge = top & ~ndi.binary_erosion(top, iterations=1)
    cv.a[top] = S4
    inner = ndi.binary_erosion(top, iterations=1)
    cv.a[inner & (hsh_arr(cv, 3) < .5)] = S3 if False else S4
    if merl:
        # 바깥쪽 가장자리 띠: 톱니(총안). 3칸 간격으로 홈
        band = top & ~ndi.binary_erosion(top, iterations=2)
        for y, x in zip(*np.nonzero(band)):
            cv.a[y, x] = S3 if (x // 2) % 2 == 0 else S5
        cv.a[top & ~band] = S5 if False else S4
    # 윗면 아래 경계선(면과 구분)
    under = top & ~shift_up(top, -1) if False else None
    sil = face | top
    cv.outline(sil)
    # 윤곽: 실루엣 테두리 중 화면 밖(KEY)과 닿는 곳
    src = srcy.copy()
    src[top] = (cv.yy + hgt)[top]
    d, (iy, ix) = ndi.distance_transform_edt(~sil, return_indices=True)
    front = (src[iy, ix] >= split_y)
    return sil | (d <= 1.01), front, sil


def hsh_arr(cv, s):
    a = np.zeros((cv.h, cv.w))
    for y in range(cv.h):
        for x in range(cv.w):
            a[y, x] = hsh(x, y, s)
    return a


# ---------------------------------------------------------------- 탑
def tower(cv, cx, by, r, hgt, roof=None, flag=False):
    ry = max(2, int(round(r * .55)))
    body = np.zeros((cv.h, cv.w), bool)
    lev = np.full((cv.h, cv.w), -1)
    for k in range(hgt):
        m = cv.ell(cx, by - k, r, ry)
        body |= m
        lev[m] = k
    topm = cv.ell(cx, by - hgt, r, ry)
    face = body & ~topm
    for y, x in zip(*np.nonzero(face)):
        u = (x - cx) / max(r, 1)
        k = lev[y, x]
        if u < -.55:
            c = S3
        elif u < .15:
            c = S2
        elif u < .55:
            c = S1
        else:
            c = S0
        if k % 4 == 0 and k > 0:
            c = tuple(int(v * .86) for v in c)
        if hsh(x, y, 9) < .04 and k > 1:
            c = MOS
        cv.a[y, x] = c
    # 화살창
    for wy in (by - hgt // 2,):
        cv.px(cx, wy, K)
        cv.px(cx, wy - 1, K)
        if r >= 5:
            cv.px(cx - 3, wy + 1, K)
            cv.px(cx + 3, wy + 1, K)
    cv.a[topm] = S4
    rim = topm & ~ndi.binary_erosion(topm)
    for y, x in zip(*np.nonzero(rim)):
        cv.a[y, x] = S5 if ((x - cx) // 2) % 2 == 0 else S2
    flo = ndi.binary_erosion(topm, iterations=2)
    cv.a[flo] = S1 if roof is None else S3
    sil = body
    if roof:
        rh = int(r * 1.9)
        apex = (cx, by - hgt - rh)
        pts_l = [(cx - r - 1, by - hgt), apex, (cx, by - hgt + 1)]
        pts_r = [(cx + r + 1, by - hgt), apex, (cx, by - hgt + 1)]
        ml = cv.pmask(pts_l)
        mr = cv.pmask(pts_r)
        lc, dc = roof
        cv.a[ml] = lc
        cv.a[mr] = dc
        # 처마 아랫단
        sil = sil | ml | mr
        cv.outline(sil, BR0 if False else K)
        cv.outline(ml | mr, BR0)
        if flag:
            cv.px(cx, apex[1] - 1, K)
            cv.px(cx, apex[1] - 2, K)
            cv.px(cx, apex[1] - 3, K)
            for i, cc in enumerate([RED, RED, RED2]):
                cv.px(cx + 1 + i, apex[1] - 3, cc)
                cv.px(cx + 1 + i, apex[1] - 2, cc if i < 2 else RED2)
    else:
        cv.outline(sil)
    return sil


# ---------------------------------------------------------------- 집·덤불
def house(cv, cx, by, kind='g', roof='red', w=9):
    lit, sh = (RED, RED2) if roof == 'red' else (WOOD2, WOOD)
    wall, wall_s = (SAND, SAND2)
    wh = 4
    x0, x1 = cx - w // 2, cx + w // 2
    if kind == 'g':      # 앞박공(삼각)
        rh = w // 2 + 2
        cv.rect(x0 + 1, by - wh, x1 - 1, by, wall)
        cv.rect(cx + 1, by - wh, x1 - 1, by, wall_s)
        pl = [(x0 - 1, by - wh), (cx, by - wh - rh), (cx, by - wh)]
        pr = [(x1 + 1, by - wh), (cx, by - wh - rh), (cx, by - wh)]
        ml, mr = cv.pmask(pl), cv.pmask(pr)
        cv.a[ml] = lit
        cv.a[mr] = sh
        # 용마루 밝은 선
        for i in range(rh - 1):
            cv.px(cx - 1 - i * (w // 2) // rh, by - wh - rh + 1 + i, C('#d86a4a') if False else lit)
        cv.px(cx, by - 1, BR1)
        cv.px(cx, by - 2, BR1)
        cv.px(cx - 2, by - 3, K)
        sil = ml | mr | cv.pmask([(x0 + 1, by - wh), (x1 - 1, by - wh), (x1 - 1, by), (x0 + 1, by)])
    else:                # 옆박공(긴 지붕, 용마루 동서)
        wlen = w + 3
        x0, x1 = cx - wlen // 2, cx + wlen // 2
        rh = 5
        cv.rect(x0 + 1, by - wh, x1 - 1, by, wall)
        cv.rect(x0 + (x1 - x0) // 2 + 1, by - wh, x1 - 1, by, wall_s)
        front = [(x0 - 1, by - wh + 1), (x1 + 1, by - wh + 1), (x1 - 2, by - wh - rh), (x0 + 2, by - wh - rh)]
        lhip = [(x0 - 1, by - wh + 1), (x0 + 2, by - wh - rh), (x0 + 4, by - wh + 1)]
        mf = cv.pmask(front)
        cv.a[mf] = lit
        rhp = cv.pmask([(x1 + 1, by - wh + 1), (x1 - 2, by - wh - rh), (x1 - 5, by - wh + 1)])
        cv.a[rhp] = sh
        # 기와 줄
        for yy in range(by - wh - rh + 2, by - wh + 1, 2):
            for xx in range(x0, x1 + 1):
                if mf[yy, xx] and not rhp[yy, xx]:
                    cv.a[yy, xx] = tuple(int(v * .86) for v in lit)
        cv.px(cx - 1, by - 2, K)
        cv.rect(cx + 2, by - 3, cx + 3, by - 2, BR1)
        sil = mf | rhp | cv.pmask([(x0 + 1, by - wh), (x1 - 1, by - wh), (x1 - 1, by), (x0 + 1, by)])
    cv.outline(sil, BR0)
    return sil


def bush(cv, cx, by, r=3):
    m = cv.ell(cx, by - r // 2, r, max(2, r - 1))
    cv.a[m] = G1
    top = m & (cv.yy < by - r // 2)
    cv.a[top & ((cv.xx - cx) < 1)] = G2
    for y, x in zip(*np.nonzero(m)):
        if hsh(x, y, 3) < .22:
            cv.a[y, x] = G4 if x < cx else G0
    cv.outline(m, G0)


def arch(cv, cx, by, w=8, h=9):
    """성문: 어두운 아치 + 문틀"""
    x0 = cx - w // 2
    for yy in range(by - h, by + 1):
        for xx in range(x0, x0 + w + 1):
            top_r = w / 2.0
            if yy < by - h + top_r:
                dy = (by - h + top_r) - yy
                if ((xx - cx) ** 2 + dy ** 2) > (top_r + .3) ** 2:
                    continue
            cv.px(xx, yy, K)
    # 창살(쇠문) 줄
    for yy in range(by - h + 3, by + 1, 2):
        for xx in range(x0 + 1, x0 + w, 2):
            cv.px(xx, yy, BR0)
    for xx in range(x0, x0 + w + 1):
        cv.px(xx, by - h - 1 + (2 if xx in (x0, x0 + w) else 0), S5) if False else None


def stall(cv, cx, by, c1, c2):
    cv.rect(cx - 3, by - 3, cx + 3, by - 1, c1)
    for i in range(-3, 4):
        if i % 2 == 0:
            cv.rect(cx + i, by - 3, cx + i, by - 1, c2)
    cv.rect(cx - 3, by, cx + 3, by, BR1)
    cv.px(cx - 3, by - 4, BR0)
    cv.px(cx + 3, by - 4, BR0)
    cv.outline(cv.pmask([(cx - 3, by - 3), (cx + 3, by - 3), (cx + 3, by), (cx - 3, by)]), BR0)


def well(cv, cx, cy):
    m = cv.ell(cx, cy, 4, 3)
    cv.a[m] = S3
    w = cv.ell(cx, cy, 3, 2)
    cv.a[w] = WATER2
    cv.a[cv.ell(cx - 1, cy - 1, 1, 0)] = WATER3
    cv.a[m & (cv.yy > cy + 1)] = S1
    cv.a[cv.ell(cx, cy, 3, 2)] = WATER2
    cv.outline(m)


# ---------------------------------------------------------------- 땅(잔디 + 길)
def ground(cv, region, salt=1):
    for y, x in zip(*np.nonzero(region)):
        h = hsh(x, y, salt)
        cv.a[y, x] = G2 if h > .12 else G3
        if hsh(x // 2, y // 2, salt + 4) < .16:
            cv.a[y, x] = G1


def road(cv, pts, w, region):
    """꺾은선 길. 가장자리 한 줄은 어두운 흙"""
    im = Image.new('L', (cv.w, cv.h), 0)
    d = ImageDraw.Draw(im)
    d.line([tuple(p) for p in pts], fill=255, width=w)
    m = (np.array(im) > 0) & region
    e = m & ~ndi.binary_erosion(m)
    for y, x in zip(*np.nonzero(m)):
        cv.a[y, x] = SAND if hsh(x, y, 7) > .15 else SAND2
    cv.a[e & (hsh_arr(cv, 11) < .7)] = SAND2
    return m


def plaza(cv, cx, cy, rx, ry, region):
    m = cv.ell(cx, cy, rx, ry) & region
    for y, x in zip(*np.nonzero(m)):
        cv.a[y, x] = SAND if ((x // 2 + y // 2) % 2 == 0) else (SAND if hsh(x, y, 8) > .3 else C('#b8844e') if False else SAND2)
    e = m & ~ndi.binary_erosion(m)
    cv.a[e] = SAND2
    return m


def drop_shadow(cv, sil, dx=2, dy=2):
    sh = np.zeros_like(sil)
    sh[dy:, dx:] = sil[:-dy, :-dx]
    sh &= ~cv.solid()
    chk = ((cv.xx + cv.yy) % 2 == 0)
    cv.a[sh & chk] = G0


def finish(cv):
    return Image.fromarray(cv.a)
