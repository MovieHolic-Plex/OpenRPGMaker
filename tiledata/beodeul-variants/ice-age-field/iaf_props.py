# 빙하기 설원 필드 새 조각 2 — 야영지·표지·나무·작은 장식(손 도트, 버들항 px2 볼륨 페인터·parts5b 덩이·vprops.snowcap). 결정적.
import math
import numpy as np
from PIL import Image
from iaf_base import C, PAL, P, RGB, F, put, blank, hash2, _hash, vnoise, SN, IC
from parts5b import lump, slab
from vprops import snowcap
from iaf_pieces import _bone_seg, _blob


def _pole(c, x0, y0, x1, y1, w=1.2, mat='wood', seed=1, lit=5, dark=2):
    c.new()
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
    for i in range(n + 1):
        f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
        for xx in range(int(x - w) - 1, int(x + w) + 2):
            d = xx + 0.5 - x
            if abs(d) <= w: c.tone(xx, int(y), mat, lit if d < -w * 0.2 else (dark + 1 if d < w * 0.4 else dark))


# ================================================================ 가죽 천막
def fur_tent_cone():
    """원뿔 가죽 천막(3x3): 꼭대기에서 엇갈려 솟은 장대 넷, 꿰맨 가죽 판(꼭대기에서 퍼지는 솔기), 앞 가운데 걷어 올린 문 자락과 어두운 문,
    밑단 털가죽 테, 아래 치마에 쌓인 눈. 몸 아랫줄 3칸 막힘(문 칸은 막힘 — 문 앞 칸에 이벤트)."""
    W, H = 48, 48
    c = C(W, H, seed=501); c.shadow(25, 45, 21, 2.4, 100)
    c.group(1)
    _pole(c, 18, 9, 13, 0, 0.8, 'wood', 1); _pole(c, 30, 9, 35, 0, 0.8, 'wood', 2)
    _pole(c, 22, 8, 20, 0, 0.7, 'wood', 3); _pole(c, 26, 8, 29, 1, 0.7, 'wood', 4)
    c.group(2); c.new()
    ax, ay, by = 24, 7, 43
    for y in range(ay, by + 1):
        f = (y - ay) / (by - ay)
        hw = 2 + 19 * f ** 0.95
        for x in range(int(ax - hw), int(ax + hw) + 1):
            dx = (x + 0.5 - ax) / max(1, hw)
            t = 5 if dx < -0.55 else (4 if dx < -0.05 else (3 if dx < 0.55 else 2))
            if f > 0.88: t -= 1
            # 솔기: 꼭대기에서 퍼지는 선 넷
            for s in (-0.62, -0.22, 0.22, 0.62):
                if abs(dx - s) < 0.04 + 0.5 / max(1, hw): t = max(1, t - 1)
            if _hash(x, y, 3) > 0.92: t = max(1, t - 1)
            c.tone(x, y, 'hide', t)
    # 문(앞 가운데, 아래 1/3): 어두운 삼각 + 왼쪽으로 걷어 올린 자락
    c.group(3); c.new()
    for y in range(29, by + 1):
        hw = (y - 29) * 0.42 + 0.5
        for x in range(int(24 - hw), int(24 + hw) + 1):
            c.tone(x, y, 'dark', 1 if y < 38 else 2)
    for y in range(29, 41):
        x = int(24 - (y - 29) * 0.42) - 1
        for k in range(3): c.tone(x - k, y, 'hide', 5 if k == 0 else 4)
    # 밑단 털 테
    c.group(4); c.new()
    for x in range(3, 46):
        for y in range(41, 45):
            dx = (x + 0.5 - 24) / 21.5
            if abs(dx) > 1: continue
            yy = 41 + int(1.2 * math.sin(x * 1.3)) if y == 41 else y
            if y == 41 and _hash(x, 1, 5) > 0.6: continue
            c.tone(x, yy, 'fur', 5 if dx < -0.3 else (4 if dx < 0.4 else 3) if y < 44 else 2)
    # 끈 묶음(장대 꼭대기)
    for (x, y) in ((22, 8), (23, 8), (25, 8), (26, 8), (24, 9)): c.tone(x, y, 'rope', 3)
    im = F(c, 0.64)
    px = im.load()
    for x in range(2, 47):                                                       # 아래 치마에 쌓인 눈
        h = int(2 + 2.2 * (0.5 + 0.5 * math.sin(x / 3.3)) + hash2(x, 1, 7) * 1.5)
        if 18 < x < 30: h = max(1, h - 2)
        for j in range(h):
            y = 46 - j
            if px[x, y][3] > 200 or j < 2: put(px, W, H, x, y, SN[6] if j == h - 1 else (SN[5] if j > 0 else SN[4]))
    return im


def fur_tent_dome():
    """털가죽 둥근 움막(3x3): 큰 짐승 뼈 갈빗대 틀 위로 덧댄 가죽·털 판 조각(판마다 톤이 다르다), 정수리에 쌓인 눈,
    앞 가운데 낮은 아치 문(털 휘장 반쯤 드리움), 밑동 돌·눈. 몸 아랫줄 3칸 막힘."""
    W, H = 48, 48
    c = C(W, H, seed=511); c.shadow(24, 45, 21, 2.4, 100)
    c.group(1)
    cx, cy, rx, ry = 24, 30, 21, 21
    rng = np.random.default_rng(4)
    pat = {}
    c.new()
    for y in range(8, 46):
        for x in range(2, 47):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            if dy > 0.72 or dx * dx + dy * dy > 1: continue
            # 판 조각: 각도·높이로 나눈 칸
            a = math.atan2(dy, dx); band = int((dy + 1) * 3.2); seg = int((a + math.pi) / (math.pi / (3 + band)))
            key = (band, seg)
            if key not in pat: pat[key] = ('hide' if rng.random() < 0.65 else 'fur', rng.integers(-1, 2))
            mat, off = pat[key]
            nz = math.sqrt(max(0, 1 - dx * dx - dy * dy))
            v = c.shade(dx, dy, nz, 0.25)
            t = int(round(1.2 + v * 4.0)) + off
            if dy > 0.6: t -= 1
            c.tone(x, y, mat, max(1, min(5, t)))
    # 판 경계 꿰맨 줄(어둡게)
    for y in range(9, 45):
        for x in range(3, 46):
            if c.m[y][x] and c.m[y][x + 1] and c.m[y + 1][x]:
                dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
                a = math.atan2(dy, dx); band = int((dy + 1) * 3.2); seg = int((a + math.pi) / (math.pi / (3 + band)))
                dx2 = (x + 1.5 - cx) / rx; a2 = math.atan2(dy, dx2); seg2 = int((a2 + math.pi) / (math.pi / (3 + band)))
                dy3 = (y + 1.5 - cy) / ry; band3 = int((dy3 + 1) * 3.2)
                if seg2 != seg or band3 != band: c.darken(x, y, 2)
    # 뼈 갈빗대(바깥으로 드러난 틀)
    for (x0, w) in ((10, 1.4), (24, 1.5), (38, 1.4)):
        c.group(5 + x0)
        pts = [(x0, 44)]
        for k in range(1, 7):
            yy = 44 - k * 5.5
            xx = cx + (x0 - cx) * math.sqrt(max(0, 1 - ((yy + 0.5 - cy) / ry) ** 2)) * 1.0 if yy < cy else x0
            pts.append((xx, yy))
        _bone_seg(c, pts, [w] * len(pts), 'bone', x0)
    # 문
    c.group(30); c.new()
    for y in range(31, 45):
        for x in range(17, 32):
            dx = (x + 0.5 - 24.5) / 7.0; dy = (y + 0.5 - 38) / 7.0
            if y < 38 and dx * dx + dy * dy > 1: continue
            if abs(dx) > 1: continue
            c.tone(x, y, 'dark', 1 if y < 40 else 2)
    for y in range(31, 41):                                                      # 반쯤 드리운 털 휘장(오른쪽)
        for x in range(25, 32):
            dx = (x + 0.5 - 24.5) / 7.0; dy = (y + 0.5 - 38) / 7.0
            if (y < 38 and dx * dx + dy * dy > 1) or abs(dx) > 1: continue
            if x - 25 < (40 - y) * 0.7 + 1: c.tone(x, y, 'fur', 4 if x < 28 else 3)
    im = F(c, 0.64)
    im = snowcap(im, 4, 9)
    px = im.load()
    for x in range(2, 47):                                                       # 밑동 눈·돌
        for j in range(3):
            y = 46 - j
            if j == 0 or px[x, y][3] > 200 or hash2(x, j, 3) > 0.5:
                put(px, W, H, x, y, SN[5] if j < 2 else SN[6])
    for (x, y) in ((6, 44), (15, 45), (35, 45), (42, 44)):
        put(px, W, H, x, y, RGB('stone', 4)); put(px, W, H, x + 1, y, RGB('stone', 3)); put(px, W, H, x, y + 1, RGB('stone', 2)); put(px, W, H, x + 1, y + 1, RGB('stone', 2))
    return im


def hide_windbreak():
    """가죽 바람막이(3x2): 비스듬히 박은 말뚝 넷 사이에 이어 맨 가죽 판, 윗단은 끈 사이로 처졌고, 바람 맞는 뒤쪽(왼쪽)에 눈이 쌓였다.
    모닥불 북서쪽에 두르듯 둔다. 아랫줄 막힘."""
    W, H = 48, 32
    c = C(W, H, seed=521); c.shadow(24, 29.5, 22, 2.0, 90)
    posts = [(4, 27, 3, 6), (17, 28, 16, 5), (30, 28, 31, 6), (43, 27, 45, 8)]
    c.group(2)
    for i in range(3):
        (x0, yb0, xt0, yt0), (x1, yb1, xt1, yt1) = posts[i], posts[i + 1]
        c.new()
        for x in range(x0 + 1, x1):
            f = (x - x0) / (x1 - x0)
            yt = yt0 + (yt1 - yt0) * f + 3.5 * math.sin(f * math.pi)                # 끈 사이로 처진 윗단
            yb = yb0 + (yb1 - yb0) * f - 1
            for y in range(int(yt), int(yb) + 1):
                t = 4 if f < 0.35 else (3 if f < 0.8 else 2)
                if y < yt + 1.5: t = 5
                if (x + i * 5) % 7 == 0: t -= 1
                c.tone(x, y, 'hide', max(1, t))
    c.group(1)
    for (x0, yb, xt, yt) in posts: _pole(c, x0, yb, xt, yt - 2, 0.9, 'wood', x0)
    for (x0, yb, xt, yt) in posts: c.tone(xt, yt, 'rope', 3); c.tone(xt + 1, yt, 'rope', 2)
    im = F(c, 0.64)
    px = im.load()
    for x in range(1, 47):                                                       # 앞 밑동 눈
        h = int(2 + hash2(x // 2, 1, 3) * 2)
        for j in range(h): put(px, W, H, x, 30 - j, SN[6] if j == h - 1 else SN[5])
    return snowcap(im, 2, 4)


# ================================================================ 야영 소품
def campfire_snow():
    """눈밭 모닥불(1칸): 녹아 드러난 흙 둘레에 돌 테, 엇갈린 장작, 타오르는 불(불 램프), 둘레 눈은 녹아 젖었다."""
    W, H = 16, 16
    c = C(W, H, seed=531)
    c.group(1); c.new()
    for y in range(8, 16):
        for x in range(0, 16):
            if ((x + 0.5 - 8) / 7.6) ** 2 + ((y + 0.5 - 12) / 3.8) ** 2 <= 1: c.tone(x, y, 'dirt', 2 if hash2(x, y, 1) > 0.4 else 3)
    for i, a in enumerate(np.linspace(0, 2 * math.pi, 9)[:-1]):
        x = 8 + 6.2 * math.cos(a); y = 12 + 3.0 * math.sin(a)
        c.group(2 + i); c.ellipsoid(x, y, 1.8, 1.3, 'stone', amb=0.25)
    c.group(20)
    c.hcyl(4, 12, 11, 1.0, 'bark', endcap='L', capmat='wood')
    for (x, y, t) in ((8, 3, 5), (7, 4, 5), (8, 4, 6), (9, 4, 5), (6, 5, 4), (7, 5, 5), (8, 5, 6), (9, 5, 6), (10, 5, 4), (6, 6, 3), (7, 6, 5), (8, 6, 5),
                      (9, 6, 5), (10, 6, 3), (6, 7, 3), (7, 7, 4), (8, 7, 4), (9, 7, 4), (10, 7, 3), (7, 8, 3), (8, 8, 3), (9, 8, 3), (8, 2, 4), (10, 3, 4)):
        c.tone(x, y, 'fire', t)
    return F(c, 0.68)


def hide_rack_fur():
    """털가죽 말림틀(2x2): 기둥 둘·가로대 위 눈, 끈으로 팽팽히 당겨 맨 털가죽 한 장(가운데 밝고 테두리 어두움), 아래 낙수 고드름."""
    W, H = 32, 32
    c = C(W, H, seed=541); c.shadow(16, 30, 13, 1.6, 100)
    c.group(2); c.new()
    for y in range(9, 26):
        f = (y - 9) / 17
        hw = 9 + 2 * math.sin(f * math.pi)
        for x in range(int(16 - hw), int(16 + hw) + 1):
            dx = (x + 0.5 - 16) / hw
            t = 5 if (abs(dx) < 0.5 and 0.15 < f < 0.85) else (4 if abs(dx) < 0.8 else 3)
            if dx > 0.5: t -= 1
            if _hash(x, y, 2) > 0.85: t -= 1
            c.tone(x, y, 'fur', max(1, t))
    for (x0, y0, x1, y1) in ((5, 10, 7, 11), (26, 10, 24, 11), (5, 24, 7, 23), (26, 24, 24, 23), (16, 7, 16, 9)):
        c.line(x0, y0, x1, y1, 'rope', 3)
    c.group(1)
    for x0 in (2, 27): slab(c, x0, 6, 3, 2, 23, 'bark', top=5, front=(3, 2), seed=x0, round_=False)
    slab(c, 2, 3, 28, 3, 2, 'bark', top=5, front=(3, 2), seed=7)
    im = F(c, 0.64)
    return snowcap(im, 2, 6)


def fur_pile():
    """털가죽 더미(1칸): 접어 쌓은 털가죽 셋(맨 위 줄무늬 결), 위에 눈 몇 점."""
    W, H = 16, 16
    c = C(W, H, seed=545); c.shadow(8, 14, 7, 1.4, 90)
    for i, (y0, mat, w) in enumerate(((10, 'fur', 13), (7, 'hide', 12), (4, 'fur', 10))):
        c.group(i + 1); slab(c, 8 - w // 2, y0, w, 3, 2, mat, top=5 if i != 1 else 4, front=(3, 2), seed=i, tex=0.3)
    for x in range(4, 12, 2): c.tone(x, 5, 'fur', 3)
    return snowcap(F(c, 0.64), 1, 3)


def sled_loaded():
    """짐 실은 썰매(2x1): 뼈 활주부 위 나무 바닥, 가죽으로 싼 짐 셋을 끈으로 묶었다, 앞에 끄는 줄."""
    W, H = 32, 16
    c = C(W, H, seed=551); c.shadow(15, 13.5, 13, 1.4, 90)
    c.group(1)
    for x in range(3, 29): c.tone(x, 13, 'bone', 5 if x < 20 else 4); c.tone(x, 14, 'bone', 2)
    c.tone(2, 12, 'bone', 5); c.tone(1, 11, 'bone', 4); c.tone(29, 13, 'bone', 3)
    for x0 in (6, 22): c.tone(x0, 12, 'bark', 2)
    c.group(2); c.box(4, 9, 24, 2, 2, 'wood')
    for i, (cx, rx, mat) in enumerate(((10, 5.5, 'hide'), (19, 4.8, 'fur'), (25, 3.4, 'hide'))):
        c.group(3 + i); c.ellipsoid(cx, 6.5, rx, 3.8, mat, amb=0.25, bump=0.3)
    for x in (10, 19): c.line(x, 3, x, 10, 'rope', 3)
    c.line(4, 9, 0, 11, 'rope', 3)
    im = F(c, 0.64)
    return snowcap(im, 1, 3)


def firewood_snow():
    """눈 쌓인 장작더미(1칸): 쪼갠 장작 다섯 단면(나이테), 윗면 눈."""
    W, H = 16, 16
    c = C(W, H, seed=561); c.shadow(8, 14, 7, 1.3, 90)
    for i, (cx, cy) in enumerate(((4, 12), (8, 12), (12, 12), (6, 8.6), (10, 8.6))):
        c.group(i + 1); c.hcyl(cx - 1, cx + 1, cy, 2.0, 'bark', endcap='L', capmat='wood')
    return snowcap(F(c, 0.64), 2, 4)


def supply_bundles():
    """보급 짐(2x1): 끈으로 묶은 가죽 보따리 둘, 흙빛 질항아리 하나, 엮은 바구니 하나, 위에 눈."""
    W, H = 32, 16
    c = C(W, H, seed=571); c.shadow(16, 14, 14, 1.4, 90)
    c.group(1); c.ellipsoid(7, 9.5, 5.5, 4.2, 'hide', amb=0.25, bump=0.3)
    c.line(7, 5, 7, 13, 'rope', 3)
    c.group(2); c.ellipsoid(14, 10.5, 4.0, 3.4, 'fur', amb=0.25, bump=0.3)
    c.group(3); c.cylinder(21.5, 7, 13, 3.3, 'dirt', capry=1.3, amb=0.25)
    for x in range(19, 25): c.tone(x, 6, 'dirt', 2)
    c.group(4); c.cylinder(28, 9, 13.5, 2.8, 'rope', capry=1.2, amb=0.25)
    for y in range(9, 14):
        for x in range(26, 31):
            if c.m[y][x] and (x + y) % 2 == 0: c.darken(x, y, 1)
    return snowcap(F(c, 0.64), 1, 5)


def cook_tripod():
    """요리 삼각대(1x2): 묶은 장대 셋에 매단 검은 솥, 아래 숯불. 밑동 칸만 막힘."""
    W, H = 16, 32
    c = C(W, H, seed=581); c.shadow(8, 29.5, 6.5, 1.4, 90)
    c.group(1)
    _pole(c, 8, 3, 2, 30, 0.6, 'wood', 1); _pole(c, 8, 3, 14, 30, 0.6, 'wood', 2); _pole(c, 8, 3, 9, 29, 0.5, 'wood', 3)
    for (x, y) in ((7, 4), (8, 4), (9, 4)): c.tone(x, y, 'rope', 3)
    c.group(2); c.line(8, 5, 8, 16, 'iron', 2)
    c.group(3); c.ellipsoid(8, 20, 4.2, 3.4, 'iron', amb=0.15, bias=-0.15)
    for x in range(4, 13): c.tone(x, 17, 'iron', 4 if x < 9 else 3)
    c.group(4)
    for (x, y, t) in ((6, 27, 3), (7, 27, 4), (8, 27, 5), (9, 27, 4), (10, 27, 3), (7, 28, 2), (8, 28, 3), (9, 28, 2), (8, 26, 4)):
        c.tone(x, y, 'fire', t)
    return F(c, 0.66)


# ================================================================ 눈 폭풍에 쓰러진 표지
def _carved_pole_px(c, x0, y0, x1, y1, w, seed):
    """새김 고리 띠가 있는 표지 장대."""
    _pole(c, x0, y0, x1, y1, w, 'wood', seed, lit=5, dark=2)
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for k in range(4, n - 2, 9):
        f = k / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f
        if abs(x1 - x0) > abs(y1 - y0):
            for yy in range(int(y - w) - 1, int(y + w) + 2):
                if 0 <= yy < c.h and c.m[yy][int(x)]: c.tone(int(x), yy, 'wood', 2); c.tone(int(x) + 1, yy, 'wood', 6 if yy < y else 5)
        else:
            for xx in range(int(x - w) - 1, int(x + w) + 2):
                if 0 <= xx < c.w: c.tone(xx, int(y), 'wood', 1); c.tone(xx, int(y) + 1, 'wood', 6 if xx < x else 4)


def marker_fallen():
    """눈 폭풍에 쓰러진 표지(3x1): 밑동에서 부러져 동쪽으로 넘어진 새김 장대(고리 띠), 부러진 쪽 가시 결, 끝에 매단 해진 천 조각,
    서쪽엔 꺾인 그루터기가 서 있고 장대 위로 눈이 덮였다."""
    W, H = 48, 16
    c = C(W, H, seed=591); c.shadow(26, 13.5, 21, 1.5, 90)
    c.group(1)
    for y in range(6, 14):                                                       # 그루터기
        for x in range(2, 7):
            t = 5 if x == 2 else (4 if x < 5 else 2)
            if y < 8 and _hash(x, y, 3) > 0.5: continue
            c.tone(x, y, 'wood', t)
    for (x, y) in ((3, 5), (5, 6), (4, 6)): c.tone(x, y, 'wood', 5)
    c.group(2)
    c.hcyl(8, 42, 10, 2.6, 'wood', amb=0.25)
    for x0 in (14, 23, 32):                                                      # 새김 고리 띠
        for y in range(7, 13):
            if c.m[y][x0]: c.tone(x0, y, 'wood', 2); c.tone(x0 + 1, y, 'wood', 5 if y < 10 else 4)
    for x0 in (18, 27, 36):                                                      # 고리 사이 마름모 새김
        c.tone(x0, 9, 'wood', 2); c.tone(x0 - 1, 10, 'wood', 2); c.tone(x0 + 1, 10, 'wood', 2); c.tone(x0, 11, 'wood', 2)
    for (x, y) in ((7, 9), (7, 11), (8, 8), (6, 10)): c.tone(x, y, 'wood', 5)
    c.group(3); c.new()
    for (x, y, t) in ((42, 10, 4), (43, 11, 4), (44, 11, 3), (43, 12, 3), (45, 12, 4), (46, 13, 3), (44, 13, 2), (41, 11, 3), (42, 12, 4)):
        c.tone(x, y, 'red', t)
    im = F(c, 0.64)
    return snowcap(im, 2, 8)


def marker_standing():
    """바람에 기운 새김 표지(1x3): 고리 띠 새긴 장대 꼭대기에 짐승 뿔 장식, 바람에 날리는 해진 천 셋, 밑동 돌무더기와 눈. 밑동 칸만 막힘."""
    W, H = 16, 48
    c = C(W, H, seed=601); c.shadow(8, 45.5, 6, 1.4, 90)
    c.group(1)
    _carved_pole_px(c, 7, 44, 9, 6, 1.4, 2)
    c.group(2)
    _bone_seg(c, [(9, 6), (5, 3), (3, 0.5)], [0.9, 0.7, 0.5], 'tusk', 3)
    _bone_seg(c, [(9, 6), (13, 3), (14, 0.5)], [0.9, 0.7, 0.5], 'tusk', 4)
    c.group(3)
    for i, (y0, L, mat) in enumerate(((12, 6, 'red'), (17, 5, 'cloth'), (22, 4, 'red'))):
        c.new()
        for j in range(L):
            yy = y0 + j // 2 + (1 if j % 3 == 2 else 0)
            c.tone(10 + j, yy, mat, 4 if j < 2 else 3); c.tone(10 + j, yy + 1, mat, 3 if j < L - 1 else 2)
    c.group(4)
    for (cx, cy, r) in ((5, 44, 2.6), (10, 44.5, 2.4), (7.5, 41.5, 2.0)):
        c.new(); c.ellipsoid(cx, cy, r, r * 0.8, 'stone', amb=0.25)
    return snowcap(F(c, 0.64), 1, 6)


def marker_stub():
    """부러진 표지 밑동(1칸): 꺾여 남은 짧은 새김 장대와 눈 더미 — 쓰러진 표지 근처에 둔다."""
    W, H = 16, 16
    c = C(W, H, seed=611); c.shadow(8, 14, 5, 1.2, 90)
    c.group(1)
    for y in range(5, 14):
        for x in range(6, 10):
            if y < 7 and _hash(x, y, 2) > 0.45: continue
            c.tone(x, y, 'wood', 5 if x == 6 else (4 if x < 9 else 2))
    for x in range(6, 10): c.tone(x, 9, 'wood', 1)
    c.group(2); lump(c, 8, 11, 6.5, 1.5, 2, 'snow', top=6, front=(5, 4), seed=3, tex=0.05)
    return F(c, 0.7)


# ================================================================ 나무
def fir_laden(seed=1):
    """눈에 짓눌린 전나무(2x3): 단마다 두툼한 눈 베개가 얹혀 가지가 처졌다(눈 덩이 윗면 밝고 밑 푸른 그늘), 짙은 침엽이 눈 밑으로 비친다.
    줄기는 밑변과 같은 폭. 맨 아랫줄 줄기 칸만 막힘."""
    W, H = 32, 48
    c = C(W, H, seed=621 + seed); c.shadow(16, 45.5, 12, 2.2, 110)
    c.group(1); c.new()
    for y in range(38, 46):
        for x in range(14, 18): c.tone(x, y, 'bark', 5 if x == 14 else (4 if x < 17 else 2))
    tiers = [(16, 40, 14.5, 7), (16, 31, 12.0, 7), (16, 22, 9.5, 6), (16, 13, 7.0, 6), (16, 6, 4.0, 5)]
    for i, (cx, yb, hw, th) in enumerate(tiers):
        c.group(10 + i); c.new()
        for y in range(yb - th, yb + 1):
            f = (y - (yb - th)) / th
            w = 1.5 + hw * f ** 0.8
            for x in range(int(cx - w), int(cx + w) + 1):
                dx = (x + 0.5 - cx) / max(1, w)
                if y == yb and (x + i) % 3 == 0: continue
                t = 3 if dx < -0.3 else (2 if dx < 0.4 else 1)
                if y >= yb - 1: t = max(1, t - 1)
                c.tone(x, y, 'pine', t + 1)
        # 눈 베개: 단 윗부분을 덮는 두툼한 덩이(밑으로 둥글게 처진다)
        c.new()
        for y in range(yb - th - 1, yb - 1):
            f = (y - (yb - th - 1)) / th
            w = 1.2 + hw * f ** 0.8 * 0.92
            for x in range(int(cx - w), int(cx + w) + 1):
                dx = (x + 0.5 - cx) / max(1, w)
                lim = yb - th + th * (0.62 - 0.22 * dx * dx) + 1.2 * math.sin(x * 1.7 + i)
                if y > lim: continue
                t = 6 if dx < -0.15 else 5
                if y > lim - 1.2: t = 4 if dx < 0.3 else 3
                c.tone(x, y, 'snow', t)
    return F(c, 0.62)


def fir_buried(seed=1):
    """눈에 묻힌 어린 전나무(2x2): 큰 눈 더미 위로 꼭대기 두 단만 솟았다. 밑동 줄 막힘."""
    W, H = 32, 32
    c = C(W, H, seed=631 + seed); c.shadow(16, 29, 14, 2.0, 60)
    c.group(1)
    lump(c, 16, 18, 14, 4.5, 5, 'snow', top=5, front=(4, 3), seed=seed, tex=0.06)
    for i, (yb, hw, th) in enumerate(((22, 8.5, 7), (14, 5.5, 6), (8, 3.0, 5))):
        c.group(10 + i); c.new()
        for y in range(yb - th, yb + 1):
            f = (y - (yb - th)) / th; w = 1.2 + hw * f ** 0.8
            for x in range(int(16 - w), int(16 + w) + 1):
                dx = (x + 0.5 - 16) / max(1, w)
                lim = yb - th + th * (0.45 - 0.2 * dx * dx)
                if y <= lim: c.tone(x, y, 'snow', 6 if dx < 0 else 5)
                else: c.tone(x, y, 'pine', 4 if dx < -0.3 else (3 if dx < 0.4 else 2))
    c.group(20)
    lump(c, 16, 21, 12, 3.0, 3, 'snow', top=6, front=(5, 4), seed=seed + 2, tex=0.05)
    return F(c, 0.7)


def frost_snag(seed=1):
    """상고대 앉은 고사목(2x3): 잎 없는 줄기·꺾인 가지, 바람 맞은 왼쪽 가장자리마다 흰 서리 깃, 가지 윗면 눈, 밑동 눈 더미."""
    W, H = 32, 48
    c = C(W, H, seed=641 + seed); c.shadow(16, 45.5, 9, 2.0, 100)
    def limb(pts, ws, sd):
        c.new()
        for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], ws, ws[1:]):
            n = 20
            for i in range(n + 1):
                f = i / n; x = x0 + (x1 - x0) * f; y = y0 + (y1 - y0) * f; r = w0 + (w1 - w0) * f
                for yy in range(int(y - r) - 1, int(y + r) + 2):
                    for xx in range(int(x - r) - 1, int(x + r) + 2):
                        if math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r:
                            dx = (xx + 0.5 - x) / max(r, 0.5)
                            c.tone(xx, yy, 'bark', 4 if dx < -0.35 else (2 if dx > 0.35 else 3))
    c.group(1)
    limb([(16, 46), (16, 36), (15, 26), (17, 15), (15, 5)], [3.6, 3.0, 2.3, 1.6, 0.9], 1)
    limb([(15, 30), (9, 24), (5, 17), (3, 12)], [1.8, 1.3, 1.0, 0.6], 2)
    limb([(16, 22), (22, 17), (26, 11), (28, 7)], [1.6, 1.2, 0.8, 0.5], 3)
    limb([(17, 34), (24, 31), (28, 26)], [1.4, 1.0, 0.6], 4)
    limb([(9, 24), (5, 25), (2, 22)], [0.9, 0.6, 0.5], 5)
    limb([(16, 15), (11, 10), (10, 5)], [1.0, 0.7, 0.5], 6)
    c.group(9)
    lump(c, 16, 42, 9, 2.0, 3, 'snow', top=6, front=(5, 4), seed=seed, tex=0.05)
    im = F(c, 0.64); px = im.load(); W, H = im.size
    src = im.copy().load()
    for y in range(1, H - 6):                                                    # 서리 깃(윤곽 뒤에 얹는다): 바람 맞은 왼쪽·윗면
        for x in range(1, W):
            a = src[x, y]
            if a[3] < 200 or sum(a[:3]) > 600: continue
            if src[x - 1, y][3] < 100 and _hash(x, y, 7) > 0.25:
                put(px, W, H, x - 1, y, SN[6] if _hash(x, y, 8) > 0.4 else SN[5])
                if x > 1 and _hash(x, y, 10) > 0.6: put(px, W, H, x - 2, y, SN[5])
            if src[x, y - 1][3] < 100 and _hash(x, y, 9) > 0.3: put(px, W, H, x, y - 1, SN[6])
    return im


# ================================================================ 작은 장식(걷기)
def frozen_grass(seed=1):
    """눈 위로 솟은 서리 맞은 마른 풀(1칸 장식, 걷기): 가는 잎 다섯 묶음, 잎끝에 서리."""
    c = C(16, 16, seed=651 + seed)
    for i, (x0, L, d) in enumerate(((4, 7, -1), (6, 9, 0), (8, 8, 1), (10, 6, 1), (12, 5, 2), (5, 5, -2))):
        c.new()
        for j in range(L):
            x = x0 + int(round(d * j / L * 2)); y = 14 - j
            c.tone(x, y, 'frgr', 4 if j > L * 0.5 else 3)
        c.tone(x0 + int(round(d * 2 * (L - 1) / L)), 14 - L + 1, 'snow', 6)
    for x in range(2, 15): c.tone(x, 15, 'snow', 5)
    return F(c, 0.78)


def tracks_beast(seed=1):
    """짐승 발자국 줄(2x1 장식, 걷기): 큰 네 발 짐승이 지나간 둥근 발자국 쌍이 사선으로 이어진다(눌린 그늘 + 밀려난 눈 턱)."""
    W, H = 32, 16
    im = blank(W, H); px = im.load()
    for i in range(5):
        cx = 3 + i * 6.5; cy = 11 - i * 1.4 + (2 if i % 2 else 0)
        for y in range(H):
            for x in range(W):
                d = ((x + 0.5 - cx) / 1.9) ** 2 + ((y + 0.5 - cy) / 1.4) ** 2
                if d <= 1: put(px, W, H, x, y, SN[3] if y < cy else SN[4])
                elif d <= 1.9 and y > cy: put(px, W, H, x, y, SN[6])
    return im


def ice_crack(seed=1):
    """얼음판 균열(2x1 장식, 걷기): 언 호수 위 갈라진 금 — 어두운 틈, 아래 밝은 턱, 금에 낀 눈가루, 갈래 둘."""
    W, H = 32, 16
    im = blank(W, H); px = im.load()
    pts = [(1, 9), (7, 7), (13, 9), (19, 6), (25, 8), (31, 5)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(x1 - x0 + 1):
            x = x0 + k; y = int(round(y0 + (y1 - y0) * k / (x1 - x0)))
            put(px, W, H, x, y, IC[1]); put(px, W, H, x, y + 1, IC[5])
            if hash2(x, y, 3) > 0.7: put(px, W, H, x, y, SN[5])
    for (x0, y0, dx, dy, L) in ((13, 9, 1, 1, 4), (19, 6, -1, -1, 3), (7, 7, 1, -1, 3)):
        for k in range(L):
            put(px, W, H, x0 + dx * k, y0 + dy * k, IC[1]); put(px, W, H, x0 + dx * k, y0 + dy * k + 1, IC[5])
    return im


def frozen_reeds(seed=1):
    """얼음에 갇힌 갈대(1칸 장식, 걷기): 호숫가 얼음판을 뚫고 나온 마른 갈대 줄기, 밑동 둘레 얼음 고리, 줄기 끝 서리."""
    c = C(16, 16, seed=661 + seed)
    for i, (x0, L, d) in enumerate(((5, 11, -1), (7, 13, 0), (9, 10, 1), (11, 8, 1))):
        c.new()
        for j in range(L):
            c.tone(x0 + int(round(d * j / L * 1.5)), 14 - j, 'reed', 4 if j > L * 0.4 else 3)
        c.tone(x0 + int(round(d * 1.5 * (L - 1) / L)), 14 - L, 'snow', 6)
    for (x, y) in ((6, 9), (7, 8), (9, 6)): c.tone(x, y, 'reed', 5)
    im = F(c, 0.76)
    px = im.load()
    for x in range(3, 14):
        put(px, 16, 16, x, 15, IC[5] if x < 8 else IC[4])
    return im
