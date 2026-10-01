"""2라운드: 적대 리뷰(조선다움·3/4) 지적을 반영해 다시 그린 소품·나무·담."""
import math
from tk import *
from build import outline, shadow
from props import puff, crown, trunk, ground_shadow


# ---------- 담 ----------
def _stones(c, x0, x1, y0, y1, seed=0):
    """토석담 몸통: 둥근 막돌 + 황토 흙. 줄마다 어긋나게."""
    St = RGB['stone']; E = RGB['earth']
    for y in range(y0, y1):
        for x in range(x0, x1):
            c.put(x, y, E[4] if rnd(x, y, 40 + seed) > 0.2 else E[3])
    rows = [(y0, 3), (y0 + 3, 3), (y0 + 6, 2)] if y1 - y0 >= 8 else [(y0, 3), (y0 + 3, 3)]
    for ri, (ry, rh) in enumerate(rows):
        x = x0 - (ri * 3) % 5
        k = 0
        while x < x1:
            w = 4 + hsh(k + ri * 7, seed, 3) % 3
            col = [St[4], St[5], St[4], E[5]][hsh(k, ri + seed, 9) % 4]
            for yy in range(ry, min(y1, ry + rh)):
                for xx in range(x + 1, x + w - 1 + (1 if yy == ry + 1 else 0)):
                    if x0 <= xx < x1:
                        c.put(xx, yy, col if yy != ry + rh - 1 else E[2] if col == E[5] else St[2])
            for xx in range(x + 1, x + w - 1):
                if x0 <= xx < x1 and ry < y1: c.put(xx, ry, St[6] if col != E[5] else E[6])
            x += w
            k += 1


def _cap(c, x0, x1, y0=2):
    G = RGB['giwa']
    for x in range(x0, x1):
        c.put(x, y0, G[5] if x % 4 < 2 else G[4]); c.put(x, y0 + 1, G[6] if x % 4 < 2 else G[5])
        c.put(x, y0 + 2, G[4] if x % 4 < 2 else G[3]); c.put(x, y0 + 3, G[3] if x % 4 < 2 else G[2]); c.put(x, y0 + 4, G[1])


def wall_h(x0=0, x1=T, seed=0):
    """토석담: 기와 덮개(밝은 청회색) 아래 황토+막돌 몸통 3줄. 덮개와 몸통 색이 확실히 다르다."""
    c = Cv(T, T)
    _stones(c, x0, x1, 6, 16, seed)
    _cap(c, x0, x1, 1)
    for x in range(x0, x1):
        c.put(x, 6, RGB['earth'][1])                       # 덮개 밑 그늘
        c.put(x, 15, RGB['earth'][1])
    return c


def wall_v():
    """세로 담: 덮개를 위에서 본 띠. 왼쪽 면은 빛을 받은 막돌 옆면 2px, 오른쪽은 어두운 그늘(대칭 금지)."""
    c = Cv(T, T)
    G = RGB['giwa']; St = RGB['stone']; E = RGB['earth']
    for y in range(T):
        c.put(2, y, St[5] if y % 4 else St[4]); c.put(3, y, St[4] if y % 4 else St[3])          # 빛 받은 옆면(막돌)
        for x in range(4, 12):
            col = {4: G[4], 5: G[5], 6: G[6], 7: G[5], 8: G[4], 9: G[3], 10: G[2], 11: G[1]}[x]
            if y % 4 == 3 and x not in (6,): col = G[3] if x < 8 else G[2]
            c.put(x, y, col)
        c.put(12, y, E[1])
    return c


def wall_corner(side):
    """모서리: 세로 덮개 띠가 내려와 가로 담과 만나는 곳에 네모 귀기둥 덮개(한 단 넓은 갓)를 얹는다."""
    c = Cv(T, T)
    v = wall_v()
    for y in range(0, 8):
        for x in range(T):
            if v.a[y, x, 3]: c.a[y, x] = v.a[y, x]
    h = wall_h(3, T, 1) if side == 'L' else wall_h(0, 13, 1)
    c.paste(h, 0, 0)
    G = RGB['giwa']
    x0, x1 = (1, 13) if side == 'L' else (3, 15)
    for y in range(0, 7):
        for x in range(x0, x1):
            c.put(x, y, G[6] if (x == x0 or y == 0) else (G[5] if y < 3 else G[4]) if x < x1 - 2 else G[3])
    for x in range(x0, x1): c.put(x, 7, G[1])
    return c


def jars():
    """옹기(장독): 어깨가 둥글고 입이 좁은 몸통, 돔형 뚜껑. 장독대 돌판 위에 셋."""
    c = Cv(2 * T, T)
    E = RGB['earth']; St = RGB['stone']
    def jar(cx, base_y, w, h):
        for y in range(base_y - h, base_y):
            t = (y - (base_y - h)) / h
            prof = math.sin(math.pi * min(1.0, t * 0.8 + 0.2)) ** 0.7        # 어깨(위 1/3)가 가장 넓다
            half = w / 2 * (0.4 + 0.6 * prof) * (0.85 if t > 0.75 else 1.0)
            for x in range(int(round(cx - half)), int(round(cx + half)) + 1):
                v = (x - cx) / max(1, half)
                idx = 4 - (1 if v > 0.1 else 0) - (1 if v > 0.5 else 0) + (1 if v < -0.45 else 0)
                c.put(x, y, E[max(1, min(6, idx))])
        top = base_y - h
        c.rect(int(cx - w * 0.22), top - 2, int(cx + w * 0.22) + 1, top + 1, E[3])                  # 좁은 입(목)
        for k, ww in enumerate((0.34, 0.26, 0.14)):                                                 # 돔형 뚜껑
            c.hl(int(cx - w * ww), int(cx + w * ww) + 1, top - 3 - k, E[5 - k] if k < 2 else E[6])
    c.rect(1, 13, 31, 16, St[4]); c.hl(1, 31, 13, St[6]); c.hl(1, 31, 15, St[2])
    jar(8, 13, 11, 9); jar(19, 13, 9, 7); jar(27, 13, 7, 6)
    outline(c)
    return c


def bench():
    """평상: 얇은 널을 깐 낮고 넓은 마루. 위에서 본 널 윗면, 얇은 앞 띠, 가는 네 다리와 가로 살."""
    c = Cv(2 * T, T)
    W = RGB['wood']
    for y in range(1, 10):
        for x in range(1, 31):
            c.put(x, y, W[5] if (y % 3) else W[4])
    c.hl(1, 31, 1, W[6])
    for x in range(1, 31): c.put(x, 10, W[3])
    for x in (2, 27): c.rect(x, 11, x + 2, 16, W[3]); c.vl(x, 11, 16, W[5])
    for x in (6, 23): c.rect(x, 10, x + 2, 13, W[1])
    outline(c)
    return c


def mat_peppers():
    """멍석(엮은 짚)에 널어 말리는 길쭉한 붉은 고추 줄."""
    c = Cv(2 * T, T)
    S = RGB['straw']; R = RGB['red']; W = RGB['wood']
    for y in range(2, 14):
        for x in range(1, 31):
            c.put(x, y, S[4] if ((x // 2) + (y // 2)) % 2 else S[3])
    c.hl(1, 31, 2, S[6]); c.hl(1, 31, 13, S[2]); c.vl(1, 2, 14, S[5]); c.vl(30, 2, 14, S[2])
    for row, y in enumerate((3, 6, 9)):
        for k in range(5):
            x = 3 + k * 5 + (2 if row % 2 else 0)
            for i in range(5):                                   # 길쭉한 꼬투리 5px, 살짝 기울어짐
                yy = y + (1 if i >= 3 else 0)
                c.put(x + i, yy, R[3] if i else R[2]); c.put(x + i, yy + 1, R[2] if i % 2 else R[1])
            c.put(x + 1, y, R[5]); c.put(x + 2, y, R[4])
            c.put(x - 1, y, RGB['leaf'][3])                      # 꼭지
    outline(c)
    return c


def jangseung(female=False):
    """장승: 부릅뜬 큰 눈, 우뚝한 코, 벌린 입(남)/다문 붉은 입(여), 몸에 세로 한자 명문(天下大將軍/地下女將軍 느낌의 붉은 글씨 칸), 땅에 박은 흙무더기."""
    c = Cv(T, 2 * T)
    W = RGB['wood']; E = RGB['earth']; R = RGB['red']
    for y in range(7, 29):
        for x in range(4, 12):
            c.put(x, y, W[4] if x < 7 else (W[3] if x < 10 else W[2]))
    hat = E if female else W
    for x in range(6, 10): c.put(x, 1, hat[5])
    for x in range(5, 11): c.put(x, 2, hat[4]); c.put(x, 3, hat[4] if x < 8 else hat[3])
    for x in range(4, 12): c.put(x, 4, hat[3]); c.put(x, 5, hat[2]); c.put(x, 6, hat[1])
    for y in range(7, 14):
        for x in range(4, 12): c.put(x, y, W[5])
    # 부릅뜬 눈: 큰 흰 눈 + 검은 눈동자 + 굵은 눈썹
    for x in (4, 5, 6): c.put(x, 8, hx('#f7fdff')); c.put(x, 9, hx('#f7fdff'))
    for x in (9, 10, 11): c.put(x, 8, hx('#f7fdff')); c.put(x, 9, hx('#f7fdff'))
    c.put(5, 9, W[0]); c.put(10, 9, W[0]); c.put(5, 8, W[0]); c.put(10, 8, W[0])
    for x in (3, 4, 5, 6): c.put(x, 7, W[1])
    for x in (9, 10, 11, 12): c.put(x, 7, W[1])
    # 큰 코
    c.vl(7, 9, 12, W[6]); c.vl(8, 9, 12, W[3]); c.put(6, 11, W[2]); c.put(9, 11, W[2])
    if female:
        for x in (6, 7, 8, 9): c.put(x, 13, R[3])
        c.put(4, 7, W[0]); c.put(11, 7, W[0])
    else:
        for x in range(5, 11): c.put(x, 13, W[0])
        c.put(6, 13, hx('#f7fdff')); c.put(7, 13, hx('#f7fdff')); c.put(9, 13, hx('#f7fdff'))
    # 세로 명문: 붉은 글자 칸 4개(획처럼 보이는 2×3 점)
    for gy in (15, 19, 23):
        c.hl(6, 10, gy, R[3]); c.vl(7, gy, gy + 3, R[3]); c.vl(9, gy, gy + 3, R[2]); c.put(8, gy + 1, R[3]); c.put(6, gy + 2, R[2]); c.put(10, gy + 2, R[2])
    for x in range(2, 14):
        c.put(x, 29, E[4] if x % 3 else E[5]); c.put(x, 30, E[3])
        if 3 < x < 12: c.put(x, 31, E[2])
    outline(c)
    return c


def sotdae():
    """솟대: 장대 끝에 목이 긴 오리(몸통·위로 뻗은 목·머리·부리). 땅에 박은 흙무더기."""
    c = Cv(T, 2 * T)
    W = RGB['wood']; E = RGB['earth']; O = RGB['orange']
    for y in range(11, 30):
        c.put(7, y, W[5]); c.put(8, y, W[4]); c.put(9, y, W[2])
    for y in (16, 22, 27): c.hl(6, 11, y, W[2])
    for x in range(3, 13): c.put(x, 30, E[4]); c.put(x, 31, E[3])
    # 몸통(가로 타원)
    for y in range(8, 11):
        for x in range(4, 12): c.put(x, y, W[5] if y == 8 else (W[4] if y == 9 else W[3]))
    for x in (11, 12): c.put(x, 8, W[4]); c.put(x, 9, W[3])          # 꽁지
    # 길게 뻗은 목 + 머리 + 부리
    for y in range(2, 8): c.put(5, y, W[5]); c.put(6, y, W[4])
    for x in (4, 5, 6): c.put(x, 1, W[5]); c.put(x, 2, W[4])
    c.put(2, 2, O[4]); c.put(3, 2, O[4]); c.put(3, 3, O[3]); c.put(5, 1, W[0])
    outline(c)
    return c


def lantern():
    """석등: 하대석(연꽃잎 물결) + 장구형 간주석 + 팔각 화사석(밝힌 창) + 낮고 두툼한 옥개석(처마 끝 들림) + 보주."""
    c = Cv(T, 2 * T)
    St = RGB['stone']
    def band(x0, x1, y0, y1):
        for y in range(y0, y1):
            for x in range(x0, x1):
                c.put(x, y, St[6] if y == y0 else (St[5] if x < (x0 + x1) // 2 else St[4]))
        c.hl(x0, x1, y1 - 1, St[3])
    band(2, 14, 29, 32)                                    # 지대석
    band(3, 13, 26, 29)                                    # 하대석
    for x in range(3, 13, 2): c.put(x, 26, St[6]); c.put(x + 1, 27, St[6])        # 연꽃잎 물결
    for y in range(18, 26):                                # 장구형 간주석
        t = abs(y - 21.5)
        w = 2 + int(t * 0.9)
        for x in range(8 - w // 2 - 1, 8 + (w + 1) // 2 + 1):
            c.put(x, y, St[5] if x < 8 else St[4])
    band(4, 12, 16, 18)                                    # 상대석
    for y in range(9, 16):                                 # 팔각 화사석
        for x in range(5, 11): c.put(x, y, St[5] if x < 8 else St[4])
    c.rect(6, 10, 10, 14, RGB['earth'][1]); c.rect(7, 11, 9, 14, RGB['orange'][5]); c.put(7, 11, RGB['orange'][6])
    c.vl(7, 9, 15, St[3])
    for y, (a, b) in enumerate(((4, 12), (2, 14), (1, 15), (1, 15)), start=5):        # 옥개석: 낮고 두툼
        for x in range(a, b):
            c.put(x, y, St[6] if y == 5 else (St[5] if x < 8 else St[4]) if y < 8 else St[3])
    c.put(0, 7, St[6]); c.put(15, 7, St[5])                # 처마 끝 들림
    c.hl(1, 15, 8, St[2])
    for x, y in ((7, 3), (8, 3), (7, 4), (8, 4), (7, 2), (8, 2)): c.put(x, y, St[6] if x == 7 else St[5])
    outline(c)
    return c


def well():
    """정(井)자 돌우물: 네모 돌 테두리와 물, 테두리에 걸쳐 둔 큼직한 나무 두레박통과 줄 사리."""
    W, H = 2 * T, 2 * T
    c = Cv(W, H)
    St = RGB['stone']; Wa = RGB['water']; Wd = RGB['wood']; S = RGB['straw']
    x0, x1, y0, y1 = 3, 29, 12, 22
    for y in range(y0, y1):
        for x in range(x0, x1):
            c.put(x, y, St[6] if rnd(x, y, 2) > 0.5 else St[5])
    for y in range(y0 + 3, y1 - 3):
        for x in range(x0 + 5, x1 - 5):
            c.put(x, y, Wa[2] if rnd(x, y, 3) > 0.25 else Wa[1])
    for x in range(x0 + 5, x1 - 5): c.put(x, y0 + 3, Wa[1])
    for y in range(y1, y1 + 7):
        for x in range(x0, x1):
            c.put(x, y, St[4] if (x // 6 + (y - y1) // 3) % 2 else St[3])
    for x in range(x0, x1): c.put(x, y1 + 6, St[2])
    c.hl(x0, x1, y1 + 2, St[2])
    # 두레박통(큼직하게): 테두리 위에 앉음
    c.rect(19, 9, 28, 17, Wd[4]); c.hl(19, 28, 9, Wd[6]); c.hl(19, 28, 11, Wd[2]); c.hl(19, 28, 14, Wd[2])
    c.vl(19, 9, 17, Wd[5]); c.vl(27, 9, 17, Wd[2]); c.hl(19, 28, 16, Wd[1])
    for x in range(20, 27): c.put(x, 10, Wa[3] if x % 2 else Wa[2])               # 통 안의 물
    # 줄 사리
    for y in range(13, 19):
        for x in range(5, 10):
            if ((x - 7) ** 2 + (y - 16) ** 2) <= 6: c.put(x, y, S[3] if (x + y) % 2 else S[4])
    outline(c)
    return c


def bridge():
    """나무다리 5×4: 통나무 보 위에 깐 널 갑판(위에서 본 면) + 두툼한 판재 난간(뒤·앞) + 거친 막돌 교대(밝은 점 없이 어두운 틈만)."""
    W, H = 5 * T, 4 * T
    c = Cv(W, H)
    Wd = RGB['wood']; St = RGB['stone']; E = RGB['earth']
    top, bot = 16, 42
    for y in range(top, bot):
        for x in range(2, W - 2):
            k = (x - 2) % 6
            col = Wd[5] if k < 4 else Wd[2]
            if y - top < 2: col = Wd[6] if k < 4 else Wd[3]
            c.put(x, y, col)
    for x in range(2, W - 2): c.put(x, bot, Wd[3]); c.put(x, bot + 1, Wd[2]); c.put(x, bot + 2, Wd[1])      # 앞 보(두께)
    # 뒤 난간: 4px 두툼한 판재 + 앞으로 기운 동자기둥(위로 솟지 않는다)
    for y, col in ((8, Wd[6]), (9, Wd[5]), (10, Wd[4]), (11, Wd[3])):
        c.hl(2, W - 2, y, col)
    for x in range(8, W - 8, 14): c.rect(x, 11, x + 4, top, Wd[3]); c.vl(x, 11, top, Wd[5])
    # 앞 난간: 갑판 앞가장자리에 낮고 두툼하게 (판재 5px)
    for y, col in ((31, Wd[6]), (32, Wd[5]), (33, Wd[5]), (34, Wd[4]), (35, Wd[2])):
        c.hl(2, W - 2, y, col)
    for x in range(8, W - 8, 14): c.rect(x, 35, x + 4, bot + 2, Wd[3]); c.vl(x, 35, bot + 2, Wd[5]); c.vl(x + 3, 35, bot + 2, Wd[1])
    # 막돌 교대: 갑판보다 낮게, 어두운 틈과 은은한 면 구분만
    for (a, b2) in ((0, 7), (W - 7, W)):
        for y in range(top + 3, bot + 3):
            for x in range(a, b2):
                c.put(x, y, St[3] if (x * 3 + y) % 5 else St[2])
        for (sx, sy, sw, sh) in ((a, top + 3, 5, 6), (a + 3, top + 8, 4, 6), (a, top + 13, 5, 6), (a + 3, top + 18, 4, 6)):
            for yy in range(sy, min(bot + 3, sy + sh)):
                for xx in range(sx, min(b2, sx + sw)):
                    edge = xx in (sx, sx + sw - 1) or yy in (sy, sy + sh - 1)
                    c.put(xx, yy, St[1] if edge else (St[5] if yy < sy + 3 else St[4]))
    outline(c)
    for x in range(8, W - 8):                        # 얕은 물그림자
        for j in range(2):
            if c.a[bot + 3 + j, x, 3] == 0: c.put(x, bot + 3 + j, SHADOW, 90 - j * 40)
    return c


# ---------- 나무 ----------
def _roots(c, cx, yb, w, ramp='wood'):
    Wd = RGB[ramp]
    for k in range(1, 5):
        c.put(cx - w // 2 - k, yb, Wd[3]); c.put(cx + w // 2 + k, yb, Wd[2])
        c.put(cx - w // 2 - k + 1, yb - 1, Wd[4]); c.put(cx + w // 2 + k - 1, yb - 1, Wd[3])
    c.put(cx - w // 2 - 5, yb, Wd[2]); c.put(cx + w // 2 + 5, yb, Wd[1])
    for x in range(cx - w // 2 - 1, cx + w // 2 + 2): c.put(x, yb - 2, Wd[4] if x < cx else Wd[3])


def _trunk(c, cx, y0, y1, w0, w1, sway=0.0, phase=0.0, seed=0):
    Wd = RGB['wood']
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        x0 = cx + int(sway * math.sin(t * 4.0 + phase))
        wt = int(round(w0 + (w1 - w0) * t))
        for x in range(x0 - wt // 2, x0 - wt // 2 + wt + 1):
            v = (x - (x0 - wt // 2)) / max(1, wt)
            idx = 5 - (1 if v > 0.35 else 0) - (1 if v > 0.75 else 0)
            if (y // 3 + x) % 4 == 0 and rnd(x, y, 3 + seed) > 0.45: idx -= 1       # 껍질 갈라짐
            c.put(x, y, Wd[max(1, idx)])


def puffe(c, cx, cy, rx, ry, ramp, base=3):
    """타원형 잎덩이(왼쪽 위 밝고 오른쪽 아래 어둡다, 밑단은 톱니)."""
    rr = RGB[ramp]
    for y in range(int(cy - ry) - 1, int(cy + ry) + 3):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = math.hypot(dx, dy)
            lim = 1.0 + (0.18 * ((x // 2) % 2) if dy > 0.3 else 0.0)
            if d > lim:
                continue
            v = -0.55 * dx - 0.85 * dy
            idx = base + (1 if v > 0.25 else 0) + (1 if v > 0.75 else 0) - (1 if v < -0.3 else 0) - (1 if v < -0.75 else 0)
            if (x * 2 + y) % 5 < 2 and dy > -0.4: idx -= 1                 # 솔잎 가로 결
            c.put(x, y, rr[max(1, min(6, idx))])


def pine(seed=0):
    """소나무 4×5: 길게 휜 붉은 줄기, 위쪽에 비대칭으로 퍼진 넓고 납작한 솔잎 덩이, 비늘 갈라진 껍질, 뿌리 퍼짐."""
    W, H = 4 * T, 5 * T
    c = Cv(W, H)
    Wd = RGB['wood']
    for y in range(18, 77):
        t = (y - 18) / 59
        x0 = 30 + int(7 * math.sin(t * 3.4 + 0.5)) + int(3 * t)
        wt = int(round(4 + 4 * t))
        for x in range(x0 - wt // 2, x0 - wt // 2 + wt + 1):
            v = (x - (x0 - wt // 2)) / max(1, wt)
            idx = 6 - (1 if v > 0.3 else 0) - (1 if v > 0.7 else 0)         # 적송: 붉은 주황 갈색
            if (y // 2 + x) % 4 == 0 and rnd(x, y, 3) > 0.4: idx -= 2        # 비늘 갈라짐
            c.put(x, y, Wd[max(1, idx)])
    _roots(c, 36, 77, 8)
    def branch(x0, y0, x1, y1):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            x, y = x0 + (x1 - x0) * k // n, y0 + (y1 - y0) * k // n
            c.put(x, y, Wd[4]); c.put(x, y - 1, Wd[5]); c.put(x + 1, y, Wd[3])
    branch(33, 40, 52, 30); branch(32, 46, 12, 36); branch(34, 58, 52, 52)
    for (cx, cy, rx, ry) in ((26, 11, 17, 7), (50, 22, 12, 5), (12, 26, 11, 5), (52, 46, 10, 4), (18, 34, 9, 4), (40, 14, 10, 5)):
        puffe(c, cx, cy, rx, ry, 'pine', base=3)
    outline(c)
    return c


def persimmon(seed=0):
    """감나무 4×4: 뿌리가 퍼진 거북 등껍질 줄기, 옆으로 퍼진 가지, 큼직한 주황 감."""
    W, H = 4 * T, 4 * T
    c = Cv(W, H)
    Wd = RGB['wood']; Od = RGB['orange']
    _trunk(c, 32, 34, 60, 7, 9, sway=1.5, phase=0.3, seed=seed)
    _roots(c, 32, 61, 9)
    for (x0, y0, x1, y1) in ((30, 38, 14, 28), (34, 40, 52, 28), (32, 36, 32, 24)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            x, y = x0 + (x1 - x0) * k // n, y0 + (y1 - y0) * k // n
            c.put(x, y, Wd[3]); c.put(x + 1, y, Wd[2])
    puffs = [(32, 15, 10), (18, 20, 9), (46, 20, 9), (10, 28, 6), (54, 28, 6), (26, 26, 9), (40, 26, 9), (22, 12, 7), (42, 12, 7)]
    crown(c, puffs, 'leaf', base=3)
    for k in range(9):
        x, y = 10 + hsh(k, seed, 5) % 42, 12 + hsh(seed, k, 6) % 22
        for dy in range(4):
            for dx in range(4):
                if (dx in (0, 3) and dy in (0, 3)):
                    continue
                c.put(x + dx, y + dy, Od[6] if (dx, dy) == (1, 0) else (Od[5] if dy == 0 or dx == 0 else Od[4] if dy <= 1 else Od[3] if dy == 2 else Od[2]))
        c.put(x + 1, y - 1, RGB['leaf'][2]); c.put(x + 2, y - 1, RGB['leaf'][3]); c.put(x, y - 1, RGB['leaf'][3])   # 꼭지(잎)
    outline(c)
    return c


def willow(seed=0):
    """버드나무 4×5: 굵은 줄기·뿌리 퍼짐, 수관, 끝으로 갈수록 가늘어지는 3px 리본 가닥(길이·흔들림 제각각)."""
    W, H = 4 * T, 5 * T
    c = Cv(W, H)
    _trunk(c, 32, 26, 76, 7, 10, sway=2, phase=1.0, seed=seed)
    _roots(c, 32, 77, 10)
    crown(c, [(32, 11, 11), (17, 15, 10), (47, 15, 10), (8, 21, 6), (56, 21, 6), (32, 19, 10), (24, 8, 8), (40, 8, 8)], 'leaf', base=4)
    outline(c)
    lf = RGB['leaf']
    for xs in range(3, 62, 5):
        ln = 20 + hsh(xs, seed, 8) % 16 - abs(xs - 32) // 4
        ph = (hsh(xs, seed, 3) % 7) / 3.0
        for j in range(ln):
            y = 21 + j
            sway = int(math.sin(y * 0.22 + ph) * 2.0)
            wd = 3 if j < ln - 9 else (2 if j < ln - 3 else 1)
            for k in range(wd):
                tone = lf[5] if (k == 0 and j < 5) else (lf[4] if k == 0 else (lf[3] if k < wd - 1 or wd == 1 else lf[2]))
                if j % 6 == 0 and k == 0: tone = lf[5]
                c.put(xs + sway + k, y, tone)
    return c
