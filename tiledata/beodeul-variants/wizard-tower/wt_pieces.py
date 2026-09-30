# 마법사의 탑 — 손 도트 조각들 (버들항 결: 7단 램프·바깥 윤곽·빛 왼쪽 위). Python/Pillow, 결정적.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
import numpy as np
from PIL import Image
import c4
from c4 import ST, WD, RD, SR, LF, PL, WA
import pz, kits7_manor as K, pf

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
IN = [rgb(x) for x in ('#141a3a', '#1f2b5e', '#2f4a8f', '#4470bd', '#6e9fdb', '#a9cbf0', '#e3f0ff')]   # 마법사 남색 램프
GL = [rgb(x) for x in ('#0f2a33', '#1c4a55', '#2f7f8c', '#3fa2ae', '#7fc9cf', '#b9e3e4', '#eefafa')]     # 유리·물빛 램프

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def px(s, x, y, c):
        x = int(x); y = int(y)
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = tuple(c) + (255,)
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1): s.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def ell(s, cx, cy, rx, ry, fn):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
                if u * u + v * v <= 1: s.px(x, y, fn(u, v))
    def img(s, fin=True):
        im = Image.fromarray(s.a); return pz.fin(im) if fin else im

def lit(u, v):        # 빛 왼쪽 위 -> 0..1
    return .5 - u * .42 - v * .38

# ---------------------------------------------------------------- 마법사의 탑 (버들항 원탑 몸체 + 남색 별 지붕)
def wizard_tower():
    import wt_tower34
    return wt_tower34.tower()

# ---------------------------------------------------------------- 혼천의 (돌 받침 위 놋쇠 고리)
def armillary():
    c = Cv(32, 52)
    # 받침 (3/4: 윗면 타원 + 앞면)
    for y in range(40, 50):
        for x in range(6, 26):
            u = (x + .5 - 16) / 10
            t = 5 if u < -.55 else 4 if u < -.1 else 3 if u < .45 else 2
            if y in (40, 41): t = min(6, t + 1)
            if y >= 48: t = max(1, t - 1)
            c.px(x, y, ST[t])
    for x in range(6, 26):                                                   # 아랫변 둥글게
        u = (x + .5 - 16) / 10; d = int(2.6 * math.sqrt(max(0, 1 - u * u)))
        for k in range(d): c.px(x, 50 + k if 50 + k < 52 else 51, ST[1] if u > 0 else ST[2])
    c.rect(13, 30, 18, 40, ST[3])                                            # 기둥
    for y in range(30, 41): c.px(13, y, ST[5]); c.px(14, y, ST[4]); c.px(17, y, ST[2]); c.px(18, y, ST[1])
    # 고리들 (놋쇠)
    cx, cy = 16, 17
    def ring(rx, ry, tilt, tone):
        for i in range(0, 200):
            ang = i / 200 * 2 * math.pi
            x = rx * math.cos(ang); y = ry * math.sin(ang)
            xr = x * math.cos(tilt) - y * math.sin(tilt); yr = x * math.sin(tilt) + y * math.cos(tilt)
            t = tone + (1 if xr < 0 and yr < 0 else -1 if xr > 0 and yr > 0 else 0)
            c.px(cx + xr, cy + yr, SR[max(1, min(6, t))])
    ring(13, 13, 0, 4); ring(13, 4, 0, 4); ring(4, 13, 0, 3); ring(10, 13, .0, 3)
    ring(12, 12, math.pi / 4, 3); ring(12, 3.5, math.pi / 4, 4)
    # 가운데 푸른 별 구슬
    c.ell(cx, cy, 3, 3, lambda u, v: IN[5] if lit(u, v) > .62 else IN[4] if lit(u, v) > .38 else IN[3])
    c.px(cx - 1, cy - 1, IN[6])
    for k in range(30, 33): c.px(15, k, SR[4]); c.px(16, k, SR[3])          # 축 밑동
    return c.img()

# ---------------------------------------------------------------- 해시계 (돌 원반 + 놋쇠 바늘)
def sundial():
    """3/4 해시계 (32x34): 윗면 타원 원반 T=11 + 원반 두께 3 + 돌 받침 앞면. 놋 바늘은 삼각판(두 칸 폭)."""
    c = Cv(32, 34)
    cx, cy, rx, ry = 16, 6, 15, 5
    # 받침 기둥 (앞면, 원통 음영)
    for y in range(cy + 4, 33):
        for x in range(8, 24):
            u = (x + .5 - 16) / 8.0
            t = 5 if u < -.45 else 4 if u < .05 else 3 if u < .55 else 2
            if (y - 18) % 6 == 5: t = max(1, t - 1)
            c.px(x, y, ST[t])
    for x in range(6, 26):                                                        # 받침 밑 돌 테두리
        u = (x + .5 - 16) / 10.0
        for y in range(30, 34): c.px(x, y, ST[max(1, (5 if u < -.5 else 4 if u < 0 else 3 if u < .5 else 2) - (1 if y >= 32 else 0))])
    # 원반 앞 두께 3줄
    for x in range(cx - rx, cx + rx + 1):
        u = (x + .5 - cx) / rx
        if abs(u) > 1: continue
        d = int(ry * math.sqrt(1 - u * u) + cy + .5)
        for y in range(d, d + 4):
            t = (5 if u < -.45 else 4 if u < .05 else 3 if u < .55 else 2) - (1 if y >= d + 2 else 0)
            c.px(x, y, ST[max(1, t)])
    # 원반 윗면 (밝고 평평)
    for y in range(0, 14):
        for x in range(0, 32):
            uu = (x + .5 - cx) / rx; vv = (y + .5 - cy) / ry
            if uu * uu + vv * vv <= 1:
                c.px(x, y, ST[6] if uu * uu + vv * vv < .72 else ST[5])
    # 시각 눈금 (윗면 위 점), 바늘
    for h in range(0, 12):
        ang = h * math.pi / 6
        c.px(cx + 11 * math.cos(ang), cy + 3.4 * math.sin(ang), SR[4] if h % 3 else SR[5])
    for i in range(0, 4):
        for x in (cx, cx + 1): c.px(x, cy - i, SR[5] if x == cx else SR[3])
    for x in range(cx + 1, cx + 7): c.px(x, cy + 1, ST[3])                        # 바늘 그림자 (오른쪽 아래)
    return c.img()

# ---------------------------------------------------------------- 달돌 오벨리스크 (길가 표석)
def moon_obelisk():
    c = Cv(16, 52)
    for y in range(12, 50):
        hw = 4 if y < 40 else 6
        for x in range(8 - hw, 8 + hw):
            u = (x + .5 - 8) / hw
            t = 5 if u < -.45 else 4 if u < .05 else 3 if u < .55 else 2
            if y >= 40 and (y - 40) % 5 == 0: t = max(1, t - 1)
            if y in (40,): t = 6
            c.px(x, y, ST[t])
    for y in range(12, 40):                                                   # 몸통은 위로 갈수록 가늘다
        cut = (y - 12) // 9
        for x in range(4, 4 + cut): c.px(x, y, (0, 0, 0)); c.a[y, x] = 0
        for x in range(12 - cut, 12): c.a[y, x] = 0
    for y in range(20, 36, 4): c.px(8, y, IN[4]); c.px(7, y + 1, IN[3])     # 새긴 별 눈금
    c.px(8, 26, IN[5]); c.px(7, 26, IN[4]); c.px(9, 26, IN[4]); c.px(8, 25, IN[4]); c.px(8, 27, IN[4])
    # 위에 뜬 푸른 수정
    for y in range(1, 11):
        w = 3 - abs(y - 5) * 3 // 5
        for x in range(8 - w, 8 + w + 1):
            u = (x - 8) / max(1, w)
            t = 6 if (u < -.3 and y < 5) else 5 if u < .1 else 4 if u < .6 else 3
            c.px(x, y, IN[t])
    return c.img()

# ---------------------------------------------------------------- 온실 (돌 밑동·나무 틀·유리 박공)
def greenhouse():
    Wd, Hd = 80, 64; c = Cv(Wd, Hd)
    # 박공 지붕 (유리): 앞에서 본 삼각
    top, eave = 2, 26
    for y in range(top, eave + 1):
        hw = 4 + (y - top) * 36 // (eave - top)
        for x in range(40 - hw, 40 + hw):
            u = (x + .5 - 40) / max(1, hw)
            base = GL[4] if u < -.2 else GL[3] if u < .4 else GL[2]
            if (x - 40 + hw) % 7 == 0: base = WD[5] if u < 0 else WD[3]      # 서까래 = 나무 살
            c.px(x, y, base)
        c.px(40 - hw, y, WD[5]); c.px(40 + hw - 1, y, WD[2])
    for x in range(36, 44): c.px(x, top, WD[5])
    # 앞면 벽: 밑동 돌 + 유리 + 나무 틀
    y0 = eave + 1
    for y in range(y0, 63):
        for x in range(4, 76):
            if y >= 51:                                                       # 돌 밑동
                u = (x - 4) / 72
                t = 4 if ((x // 8 + (y - 51) // 4) % 3 == 0) else 3
                if (y - 51) % 4 == 0: t = 2
                if y >= 61: t = 2
                c.px(x, y, ST[t])
            else:
                col = GL[4] if (x + y) % 11 == 0 else GL[3] if ((x - 4) // 6 + (y - y0) // 8) % 2 == 0 else GL[2]
                c.px(x, y, col)
    for x in range(4, 76, 12):                                                # 세로 살
        for y in range(y0, 51): c.px(x, y, WD[5] if x < 36 else WD[3]); c.px(x + 1, y, WD[3] if x < 36 else WD[2])
    for y in (y0, y0 + 12, 50):                                                # 가로 살
        for x in range(4, 76): c.px(x, y, WD[4])
    for y in range(y0, 51):
        c.px(4, y, WD[5]); c.px(75, y, WD[2])
    # 안의 식물 (유리 너머 초록·붉은 열매)
    for i, x in enumerate(range(10, 72, 12)):
        h = 8 + (i * 5) % 7
        for k in range(h):
            c.px(x + 4 + (k % 2), 50 - k, LF[3] if k % 3 else LF[4]); c.px(x + 3, 50 - k // 2, LF[2])
        c.px(x + 5, 50 - h, RD[4]); c.px(x + 3, 50 - h + 2, RD[4]) if i % 2 == 0 else None
    # 문 (가운데): 나무 여닫이 + 놋 손잡이
    for y in range(y0 + 8, 62):
        for x in range(34, 47):
            c.px(x, y, WD[3] if x < 40 else WD[2])
            if y < y0 + 20 and (x in (36, 37, 43, 44)): c.px(x, y, GL[4] if x < 40 else GL[3])
    for x in range(34, 47): c.px(x, y0 + 8, WD[5])
    for y in range(y0 + 8, 62): c.px(40, y, WD[1]); c.px(34, y, WD[5]); c.px(46, y, WD[1])
    c.px(38, 46, SR[5]); c.px(42, 46, SR[5])
    return c.img()

# ---------------------------------------------------------------- 지구본 (나무 받침 위 푸른 구)
def globe():
    c = Cv(16, 32)
    c.ell(8, 12, 7, 7, lambda u, v: (GL[5] if lit(u, v) > .7 else GL[4] if lit(u, v) > .5 else GL[3] if lit(u, v) > .3 else GL[2]))
    for (x, y) in ((5, 9), (6, 9), (5, 10), (8, 13), (9, 13), (10, 12), (9, 15), (6, 14)): c.px(x, y, LF[4] if x < 8 else LF[3])
    for x in range(2, 15): c.px(x, 12 + (0 if 4 < x < 12 else 1), SR[3])       # 적도 놋 띠
    c.line(2, 8, 13, 17, SR[3]) if False else None
    for y in range(19, 23): c.px(8, y, WD[4]); c.px(7, y, WD[5])
    for y in range(23, 30):                                                     # 받침
        hw = 2 + (y - 23) // 2
        for x in range(8 - hw, 8 + hw + 1): c.px(x, y, WD[5] if x < 8 else WD[3])
    for x in range(3, 14): c.px(x, 29, WD[2]); c.px(x, 30, WD[1])
    return c.img()

# ---------------------------------------------------------------- 태양계의 (탁자 위 놋 고리·구슬)
def orrery():
    c = Cv(32, 32)
    for y in range(18, 30):                                                     # 탁자 위 원반
        for x in range(2, 30):
            u = (x + .5 - 16) / 14; vt = 22 + 4 * math.sqrt(max(0, 1 - u * u)); vb = 22 - 4 * math.sqrt(max(0, 1 - u * u))
            if y < vb or y > vt + 4: continue
            c.px(x, y, WD[5] if (y <= vt and u < .1) else WD[4] if y <= vt else WD[2] if u < .3 else WD[1])
    # 세 겹 궤도(타원)와 별 구슬
    cx, cy = 16, 14
    for rx, ry, tone in ((13, 5, 4), (9, 3.6, 3), (5, 2.2, 5)):
        for i in range(160):
            a = i / 160 * 2 * math.pi
            c.px(cx + rx * math.cos(a), cy + ry * math.sin(a), SR[tone])
    c.ell(cx, cy, 3, 3, lambda u, v: SR[6] if lit(u, v) > .7 else SR[5] if lit(u, v) > .4 else SR[4])
    for (x, y, col) in ((cx - 12, cy + 2, IN[4]), (cx + 8, cy - 3, RD[5]), (cx + 4, cy + 3, GL[4]), (cx - 6, cy - 3, IN[5])):
        c.ell(x, y, 2, 2, lambda u, v, col=col: col)
    c.line(cx, cy + 3, cx, 22, SR[2])
    return c.img()

# ---------------------------------------------------------------- 증류로 (벽돌 화덕 + 유리 플라스크)
def athanor():
    c = Cv(32, 48)
    for y in range(22, 47):                                                      # 벽돌 몸통
        for x in range(2, 30):
            row = (y - 22) // 4; off = 4 if row % 2 else 0
            t = 4 if lit((x - 16) / 14, 0) > .3 else 3
            if (y - 22) % 4 == 0: t = 2
            elif (x + off) % 8 == 0: t = 2
            c.px(x, y, RD[t - 1] if t > 2 else RD[1])
    c.rect(2, 22, 29, 23, ST[5]); c.rect(1, 46, 30, 47, ST[2])
    for y in range(34, 44):                                                      # 화구
        for x in range(9, 23):
            u = (x + .5 - 16) / 7
            if y < 36 and abs(u) > .75: continue
            c.px(x, y, ST[0])
    for (x, y, col) in ((14, 42, SR[5]), (15, 41, SR[4]), (17, 42, RD[5]), (16, 40, SR[6]), (18, 41, RD[4]), (13, 40, RD[5])): c.px(x, y, col)
    # 위: 유리 증류기 (둥근 병 + 굽은 관 + 받이 병)
    c.ell(11, 13, 7, 8, lambda u, v: GL[5] if (u < -.35 and v < -.2) else GL[3] if lit(u, v) > .35 else GL[2])
    for y in range(9, 19):                                                       # 안의 붉은 액
        for x in range(5, 18):
            u = (x + .5 - 11) / 6.0; v = (y + .5 - 13) / 7.5
            if u * u + v * v < 1 and v > -.05: c.px(x, y, RD[4] if (u < 0.1) else RD[3])
    c.rect(9, 3, 12, 6, GL[3]); c.px(9, 3, GL[5])
    c.line(12, 4, 19, 6, GL[4]); c.line(19, 6, 24, 12, GL[3]); c.line(20, 6, 25, 12, GL[2])
    c.ell(25, 17, 3, 5, lambda u, v: GL[4] if u < -.2 else GL[3])
    c.px(25, 20, IN[4]); c.px(24, 19, IN[3]); c.px(26, 20, IN[3])
    c.rect(5, 21, 18, 22, ST[3])                                                 # 받침 고리
    return c.img()

# ---------------------------------------------------------------- 별자리 지도 (벽걸이 2x1)
def starmap():
    """벽걸이 별자리 지도 (32x22): 위 턱(나무 윗면 T=4) + 앞면 F=18 (푸른 밤하늘·금 별자리)."""
    c = Cv(32, 22)
    c.rect(0, 0, 31, 4, WD[4]); c.px(0, 0, WD[5]); c.px(31, 0, WD[5]); c.px(0, 4, WD[3]); c.px(31, 4, WD[3])      # 윗면 (밝은 턱, 평평)
    c.rect(0, 5, 31, 21, WD[2]); c.rect(2, 7, 29, 19, IN[0])                                  # 앞 틀 + 밤하늘
    for y in range(7, 20):
        for x in range(2, 30):
            if (x * 7 + y * 13) % 17 == 0: c.px(x, y, IN[5])
            elif (x * 5 + y * 3) % 23 == 0: c.px(x, y, IN[3])
    pts = [(6, 16), (10, 11), (15, 14), (20, 9), (25, 12), (23, 17)]
    for a_, b_ in zip(pts, pts[1:]): c.line(a_[0], a_[1], b_[0], b_[1], IN[2])
    for (x, y) in pts: c.px(x, y, SR[6]); c.px(x, y - 1, SR[5])
    for x in range(0, 32): c.px(x, 21, WD[1])
    for y in range(5, 22): c.px(0, y, WD[3]); c.px(31, y, WD[1])
    for x in range(2, 30): c.px(x, 7, IN[1])
    return c.img()

def all_pieces():
    return [('wizard-tower', wizard_tower, '탑 몸(버들항 원탑)에 남색 별 지붕·아치 문·초승달을 손으로 얹은 랜드마크 (96×236, 3/4 원통)'),
            ('armillary', armillary, '돌 받침 위 놋쇠 혼천의 — 세 겹 고리·푸른 별 구슬 (32×52)'),
            ('sundial', sundial, '돌 원반 해시계 — 시각 눈금·놋 바늘 (32×34, 3/4 윗면 타원)'),
            ('moon-obelisk', moon_obelisk, '달돌 표석 — 새긴 별 눈금·위에 뜬 푸른 수정 (16×52)'),
            ('greenhouse', greenhouse, '온실 — 돌 밑동·나무 살·유리 박공·안의 식물 (80×64)'),
            ('globe', globe, '나무 받침 지구본 (16×32)'),
            ('orrery', orrery, '탁자 위 태양계의 — 세 겹 궤도·색 구슬 (32×32)'),
            ('athanor', athanor, '벽돌 증류로 — 화구·붉은 액 플라스크·굽은 유리관 (32×48)'),
            ('starmap', starmap, '별자리 지도 벽걸이 (32×22, 윗턱 T4·앞면 F18)')]

if __name__ == '__main__':
    ps = all_pieces(); ims = [(n, f()) for n, f, _ in ps]
    Wd = sum(i.width + 10 for _, i in ims); Hd = max(i.height for _, i in ims)
    sh = Image.new('RGBA', (Wd, Hd), (70, 100, 66, 255)); x0 = 4
    for n, i in ims: sh.alpha_composite(i, (x0, Hd - i.height)); x0 += i.width + 10
    sh = sh.resize((sh.width * 3, sh.height * 3), Image.NEAREST); sh.save(os.path.join(HERE, '..', '_out-4', 'wt_pieces.png')); print(sh.size)
