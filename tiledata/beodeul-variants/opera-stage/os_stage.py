# 극장 조각 1: 무대(걷힌 막·막 위 주름 띠·배경 그림판·각광·무대 계단·프롬프터 덮개·조명 받침·나무/성 배경판·조명 웅덩이)와
# 오케스트라 자리(그랜드 피아노·보면대 의자·지휘대·팀파니). 손 도트, 벨벳 VEL·금 GLT·짙은 널 EBN·쇠 IR·놋쇠 BR. 3/4, 빛 왼쪽 위.
from os_kit import *
from os_kit import _hash


# ------------------------------------------------------------------ 막
def drape_tied(seed=0):
    """걷힌 붉은 막 2×7(32x112, 왼쪽용): 위 금 막대에 걸린 벨벳 막이 바깥(왼쪽)으로 걷혀 허리에서 금줄로 묶이고, 아래로 다시 퍼져 바닥에 고인다.
    주름은 묶인 허리로 모인다. 아랫줄만 막힘(위는 걷기+가림)."""
    W, H = 32, 112; cv = Cv(W, H)
    waist = 70
    def inner(y):
        if y < waist:
            t = y / float(waist)
            return 13.5 + 18.0 * (1 - t) ** 1.7
        t = (y - waist) / float(H - 4 - waist)
        return 13.5 + 10.5 * min(1.0, t) ** .75 + (3 if y >= H - 4 else 0)
    nf = 6
    for y in range(3, H):
        xi = inner(y)
        for x in range(0, W):
            if x + .5 > xi: continue
            u = (x + .5) / xi
            ph = (u * nf) % 1.0
            k = 2 + int(round(2.6 * (.5 + .5 * math.cos(ph * 2 * math.pi - .9))))
            if u < .18: k += 1                                                       # 바깥 끝(빛 쪽)
            if u > .86: k -= 1
            if y < waist and y > waist - 12: k -= 1 if ph > .55 else 0               # 허리 위 주름 골이 깊다
            if y > waist + 4 and y < waist + 16 and ph < .3: k += 1                  # 허리 아래 불룩
            if _hash(x, y, seed + 3) < .04: k += 1
            if x + .5 > xi - 1: k = min(k, 2)
            cv.px(x, y, VEL[clamp(k, 1, 6)])
    for y in range(H - 6, H):                                                        # 바닥에 고인 자락 그늘
        for x in range(0, int(inner(y))):
            if y >= H - 2: cv.px(x, y, VEL[2] if x < inner(y) - 2 else VEL[1])
    for y in range(H - 8, H - 6):                                                    # 금 술 단
        for x in range(0, int(inner(y))): cv.px(x, y, GLT[5] if (x + y) % 3 else GLT[3])
    for y in range(waist - 2, waist + 3):                                            # 묶은 금줄
        for x in range(0, int(inner(y)) + 1):
            k = 5 if y < waist else (4 if y < waist + 2 else 2)
            if (x + y) % 4 == 0: k -= 1
            cv.px(x, y, GLT[k])
    tx = int(inner(waist)) - 1                                                       # 늘어진 술
    for y in range(waist + 2, waist + 13):
        hw = 1 if y < waist + 7 else 2
        for x in range(tx - hw, tx + hw + 1): cv.px(x, y, GLT[5] if x <= tx else GLT[3])
    cv.px(tx, waist + 13, GLT[2]); cv.px(tx - 1, waist + 13, GLT[3])
    for x in range(0, W):                                                            # 금 막대와 고리
        cv.px(x, 0, GLT[6] if x < 20 else GLT[5]); cv.px(x, 1, GLT[4]); cv.px(x, 2, GLT[2])
        if x % 5 == 2: cv.px(x, 3, GLT[3])
    im = fin(cv, .62)
    return shadow_under(im, 11, H - 1, 12, 2, 70)


def valance_swag(seed=0):
    """막 위 주름 띠 3×1(48x16, 벽 앞면 장식, 가로로 이어 붙임): 위 평평한 벨벳 띠와 금 끈, 아래로 처진 주름 두 자락과 금 술, 자락 사이 금 방울."""
    W, H = 48, 16; cv = Cv(W, H)
    for x in range(W):
        u = (x % 24) / 24.0
        bot = 4 + 7.5 * math.sin(math.pi * u)
        for y in range(0, int(bot) + 1):
            if y < 3:
                k = 4 if y == 0 else (3 if y == 1 else 2)
                if (x + y) % 5 == 0: k += 1
                cv.px(x, y, VEL[k]); continue
            if y == 3: cv.px(x, y, GLT[5] if x % 3 else GLT[3]); continue
            v = (y - 3) / max(1.0, bot - 3)
            k = 4 if (y + int(4 * math.sin(math.pi * u))) % 3 == 0 else 3
            if v > .8: k = 2
            if u < .2: k += 1
            cv.px(x, y, VEL[clamp(k, 1, 6)])
        fy = int(bot) + 1
        cv.px(x, fy, GLT[5] if x % 2 else GLT[3])
        if x % 2 == 0 and fy + 1 < H: cv.px(x, fy + 1, GLT[3])
    for x0 in (0, 24):                                                               # 자락 사이 방울(이어 붙이면 이웃과 같은 자리)
        for y in range(4, 12):
            for dx in (-1, 0, 1):
                cv.px((x0 + dx) % W, y, GLT[5] if dx < 1 and y < 8 else GLT[3])
        for dx in (-1, 0, 1): cv.px((x0 + dx) % W, 12, GLT[2])
    return fin(cv, .7)


def backdrop_landscape(seed=0, night=False):
    """배경 그림판 12×3(192x48, 무대 뒤벽 장식): 위·아래 나무 막대에 건 캔버스에 붓 결로 칠한 산과 언덕·강·둥근 나무, 해(밤에는 달·별). 글자 없음."""
    W, H = 192, 48; cv = Cv(W, H)
    sky_t = [(120, 156, 206), (150, 180, 220), (186, 200, 220), (226, 206, 180), (238, 186, 150)] if not night else \
            [(22, 26, 60), (30, 38, 80), (42, 54, 104), (60, 70, 126), (84, 88, 140)]
    for y in range(3, 45):
        for x in range(2, W - 2):
            t = (y - 3) / 26.0
            i = clamp(int(t * 5 + (.5 if (x // 3 + y) % 2 else 0) * .6), 0, 4)
            c = sky_t[i]
            if not night and vnoise(x * .4, y * 1.6, 9, 971) > .7 and y < 20: c = mix(c, (246, 240, 232), .6)   # 붓 구름
            cv.px(x, y, c)
    sx, sy = (138, 15)
    for y in range(3, 30):
        for x in range(120, 160):
            d = math.hypot(x + .5 - sx, (y + .5 - sy))
            if d < 6.5: cv.px(x, y, (250, 236, 170) if not night else (232, 232, 214))
            elif d < 8 and (x + y) % 2 == 0: cv.px(x, y, (246, 214, 150) if not night else (150, 156, 190))
    if night:
        for i in range(30):
            x = 4 + int(_hash(i, 1, 973) * 184); y = 4 + int(_hash(i, 2, 973) * 18)
            cv.px(x, y, (230, 230, 250))
    def ridge(base, amp, sc, sd):
        return lambda x: base - amp * (vnoise(x, 0, sc, sd) * .7 + vnoise(x, 0, sc / 3.0, sd + 1) * .3)
    layers = [(ridge(31, 16, 36, 974), [(132, 112, 156), (150, 128, 170), (112, 96, 140)] if not night else [(40, 40, 76), (50, 50, 90), (32, 32, 64)]),
              (ridge(37, 12, 28, 975), [(86, 124, 132), (104, 142, 140), (70, 104, 116)] if not night else [(30, 46, 66), (38, 56, 76), (24, 36, 54)]),
              (ridge(42, 8, 22, 976), [GRN[3], GRN[4], GRN[2]] if not night else [(26, 52, 44), (34, 64, 50), (20, 40, 36)])]
    for (rf, pal) in layers:
        for x in range(2, W - 2):
            top = rf(x)
            for y in range(int(top), 45):
                c = pal[0]
                if y < top + 2: c = pal[1]
                if (x * 3 + y * 5) % 11 == 0: c = pal[2]                              # 붓 자국
                cv.px(x, y, c)
    for i in range(80):                                                              # 강: 앞 언덕을 굽이쳐 흐른다
        t = i / 80.0; x = 20 + t * 150; y = 44 - t * 6 + 2.5 * math.sin(t * 9)
        for dx in range(-2, 3):
            cv.px(int(x + dx), int(y), (150, 190, 214) if not night else (70, 90, 130))
        cv.px(int(x), int(y) - 1, (196, 222, 236) if not night else (110, 130, 170))
    for (tx, ty, r) in ((14, 36, 5), (26, 38, 6), (58, 37, 4), (100, 39, 5), (112, 37, 4), (170, 36, 6), (182, 38, 4)):   # 둥근 나무
        for y in range(ty, ty + 7): cv.px(tx, y, (92, 60, 40)); cv.px(tx + 1, y, (70, 44, 30))
        for y in range(ty - r, ty + r):
            for x in range(tx - r, tx + r + 2):
                if math.hypot(x + .5 - tx - .5, y + .5 - ty) < r:
                    c = GRN[2] if x > tx else GRN[3]
                    if math.hypot(x + 1.5 - tx, y + 1.5 - ty + 1) < r * .5: c = GRN[4]
                    if night: c = mul(c, .5)
                    cv.px(x, y, c)
    for y in range(3, 45):                                                           # 캔버스 가장자리 그늘
        for x in (2, 3, W - 4, W - 3):
            if cv.p[x, y][3]: cv.px(x, y, mul(cv.p[x, y][:3], .82))
    for x in range(0, W):                                                            # 위·아래 막대
        for y, k in ((0, 5), (1, 4), (2, 2), (45, 4), (46, 3), (47, 1)): cv.px(x, y, WD[k])
    for x in (0, W - 1):
        for y in range(H): cv.px(x, y, WD[2])
    return fin(cv, .8)


# ------------------------------------------------------------------ 무대 앞 부속
def footlight(seed=0):
    """각광 1×1(무대 앞판 위 장식): 무대 턱에 얹은 놋쇠 조개 덮개, 위로 등불이 비친다(빛무리와 함께)."""
    cv = Cv(16, 16)
    for y in range(0, 4):                                                            # 등불(덮개 너머 무대 쪽)
        for x in range(5, 11):
            if abs(x - 7.5) <= 1 + y: cv.px(x, y, FL[4] if y < 2 else FL[3])
    for y in range(2, 9):                                                            # 조개 덮개(갈비 결)
        hw = 6 if y < 7 else 5
        for x in range(8 - hw, 8 + hw):
            k = 5 if x < 6 else (4 if x < 10 else 3)
            if (x - 2) % 3 == 0 and y < 7: k -= 1
            if y == 2: k = 6 if x < 9 else 5
            if y >= 7: k = 2
            cv.px(x, y, BR[k])
    for x in range(3, 13): cv.px(x, 9, BR[1])
    return fin(cv, .6)


def stage_steps(seed=0):
    """무대 계단 2×2(32x32, 걷기): 객석 바닥에서 무대로 오르는 짙은 나무 계단 네 단 — 위로 갈수록 디딤판이 밝고, 디딤판 끝마다 금 코판 한 줄,
    양옆 낮은 옆판. 무대 앞판 줄의 2칸을 바닥으로 열고, 그 칸과 바로 위 무대 끝 줄에 걸쳐 놓는다."""
    W, H = 32, 32; cv = Cv(W, H)
    for i in range(4):                                                               # 아래(남) 단부터
        yb = 31 - i * 8
        for y in range(yb - 7, yb + 1):
            ly = yb - y
            for x in range(3, 29):
                if ly <= 1: k = 2                                                    # 챌판(그늘)
                elif ly == 2: k = 1
                elif ly == 3: cv.px(x, y, GLT[4] if x % 6 else GLT[3]); continue    # 코판
                else: k = 4 + (1 if i >= 2 else 0) + (1 if ly == 7 else 0)            # 디딤판(무대 널과 같은 톤)
                if 3 < ly < 7 and (x + i * 9) % 13 == 0: k -= 1
                if x > 25: k -= 1
                if x < 5: k += 1
                if (x * 7 + i * 5) % 17 == 0 and ly > 3: k -= 1
                cv.px(x, y, EBN[clamp(k, 1, 6)])
    for x0 in (0, 29):
        for y in range(0, 32):
            for x in range(x0, x0 + 3):
                k = 4 if x == x0 else (3 if x == x0 + 1 else 1)
                cv.px(x, y, EBN[k] if y > 1 else GLT[5 if x == x0 else 3])
    return fin(cv, .62)


def prompter_hood(seed=0):
    """프롬프터 덮개 2×1(32x16): 무대 앞 가운데 바닥에 엎어 놓은 반구 나무 덮개, 금 테·꼭대기 장식. 막힘 1줄."""
    cv = Cv(32, 16)
    for y in range(2, 16):
        for x in range(1, 31):
            dx = (x + .5 - 16) / 15.0; dy = (y + .5 - 15) / 13.0
            if dx * dx + dy * dy > 1: continue
            k = 5 if dx < -.35 else (4 if dx < .25 else 3)
            if dy < -.75: k += 1
            if (x - 1) % 6 == 0: k -= 1                                              # 세로 갈비
            if y >= 14: k = 2
            cv.px(x, y, EBN[clamp(k, 1, 6)])
    for y in range(13, 16):
        for x in range(2, 30): cv.px(x, y, GLT[5] if y == 13 else (GLT[3] if y == 14 else GLT[1]))
    cv.px(15, 1, GLT[5]); cv.px(16, 1, GLT[4]); cv.px(15, 2, GLT[4]); cv.px(16, 2, GLT[3])
    return shadow_under(fin(cv, .62), 16, 15.5, 15, 1.5, 70)


def stage_lamp(seed=0):
    """무대 조명등 1×2(16x32): 세 다리 쇠 받침 위 멍에에 걸린 검은 원통 등, 앞 렌즈가 따뜻하게 빛난다. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for (x0, y0, x1, y1) in ((8, 18, 3, 30), (8, 18, 13, 30), (8, 18, 8, 29)):
        line(cv, x0, y0, x1, y1, lambda x, y: IR[3] if x <= 8 else IR[2])
    for y in range(12, 19): cv.px(8, y, IR[3]); cv.px(9, y, IR[2])
    for y in range(6, 14):                                                           # 멍에
        cv.px(3, y, IR[3]); cv.px(13, y, IR[2])
    for x in range(3, 14): cv.px(x, 13, IR[2])
    for y in range(3, 12):                                                           # 원통 등(앞이 남서쪽을 향해 기운다)
        for x in range(4, 13):
            k = cyl_k(x, 4, 13) - 1
            cv.px(x, y, I7[clamp(k, 1, 5)])
    topell(cv, 8.5, 3.2, 4.6, 2.0, I7, 5, 3, seed)
    for y in range(8, 12):                                                           # 렌즈
        for x in range(5, 12):
            if ((x + .5 - 8.5) / 3.6) ** 2 + ((y + .5 - 10) / 1.9) ** 2 <= 1: cv.px(x, y, FL[4] if x < 8 else FL[3])
    cv.px(12, 2, IR[4]); cv.px(12, 1, IR[3])
    return shadow_under(fin(cv, .58), 8, 30.5, 6, 1.4, 60)


def tree_flat(seed=0):
    """나무 배경판 2×3(32x48): 합판을 오려 칠한 둥근 나무 — 붓 결 잎 덩이·밤색 줄기, 오른쪽·아래에 합판 단면, 뒤에 나무 버팀대와 모래주머니. 아랫줄만 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(34, 46):                                                          # 버팀대(뒤, 오른쪽 아래로 비스듬)
        x = 22 + (y - 34) // 2
        cv.px(x, y, WD[4]); cv.px(x + 1, y, WD[2])
    for x in range(14, 30): cv.px(x, 45, WD[3]); cv.px(x, 46, WD[1])
    mk_ = Mk(W, H)
    for (cx, cy, rx, ry) in ((15, 13, 11, 9), (8, 19, 7, 6), (23, 19, 7, 6), (15, 23, 10, 6), (11, 7, 6, 5), (20, 7, 6, 5)):
        mk_.ell(cx, cy, rx, ry)
    mk_.rect(13, 26, 19, 44)
    for y in range(H):
        for x in range(W):
            if not mk_.at(x, y): continue
            if y >= 26 and 13 <= x < 19 and not mk_.at(x, y - 0) is False and y > 27:
                k = 5 if x < 15 else (4 if x < 17 else 3)
                if (y + x) % 5 == 0: k -= 1
                cv.px(x, y, WD[k]); continue
            n = vnoise(x, y, 4, seed + 980)
            k = 3 if n < .4 else (4 if n < .7 else 5)
            if x < 9 and y < 18: k += 1
            if (x * 2 + y) % 7 == 0: k -= 1                                          # 붓 자국
            cv.px(x, y, GRN[clamp(k, 1, 6)])
    for y in range(H):                                                               # 합판 단면(오른쪽·아래 1px)
        for x in range(W - 1, 0, -1):
            if mk_.at(x - 1, y) and not mk_.at(x, y): cv.px(x, y, (196, 166, 120)); break
    im = fin(cv, .62)
    sb = Cv(W, H)
    for y in range(42, 47):
        for x in range(23, 31):
            if ((x + .5 - 27) / 4.2) ** 2 + ((y + .5 - 45) / 2.8) ** 2 <= 1: sb.px(x, y, CNV[4] if x < 27 else CNV[3])
    im.alpha_composite(fin(sb, .6))
    return shadow_under(im, 18, 46.5, 12, 1.6, 60)


def castle_flat(seed=0):
    """성 배경판 3×3(48x48): 합판을 오려 칠한 성 — 톱니 성벽 탑 둘·가운데 벽·아치 문·창·작은 깃발, 연보라 회색 붓 결, 뒤 버팀대·모래주머니. 아랫줄만 막힘."""
    W, H = 48, 48; cv = Cv(W, H)
    for y in range(36, 46):
        x = 38 + (y - 36) // 2
        cv.px(x, y, WD[4]); cv.px(x + 1, y, WD[2])
    STP = [(40, 36, 56), (78, 72, 98), (108, 102, 128), (138, 132, 156), (164, 160, 180), (190, 186, 204), (214, 212, 226)]
    mk_ = Mk(W, H)
    mk_.rect(2, 10, 14, 46); mk_.rect(34, 10, 46, 46); mk_.rect(12, 20, 36, 46)
    for x0 in (2, 6, 10, 34, 38, 42): mk_.rect(x0, 6, x0 + 3, 10)
    for x0 in range(12, 36, 5): mk_.rect(x0, 17, x0 + 3, 20)
    mk_.poly([(30, 2), (30, 8), (36, 5)])                                             # 깃발
    for y in range(H):
        for x in range(W):
            if not mk_.at(x, y): continue
            if 30 <= x <= 36 and y < 9 and not (12 <= x < 36 and y >= 17):
                cv.px(x, y, VEL[4] if x < 33 else VEL[3]); continue
            row = y // 5; off = (row % 2) * 4
            k = 4 if ((x + off) // 8 + row) % 3 else 3
            if (y % 5 == 4) or ((x + off) % 8 == 7): k = 2
            if x < 5 or (12 <= x < 15 and y > 20): k += 1
            if 34 <= x < 37: k += 1
            if _hash(x, y, seed + 5) < .06: k += 1
            cv.px(x, y, STP[clamp(k, 1, 6)])
    for y in range(30, 46):                                                          # 아치 문
        for x in range(18, 30):
            if y < 34 and math.hypot(x + .5 - 24, y + .5 - 34) > 6: continue
            cv.px(x, y, (40, 28, 30) if x > 19 else (70, 48, 40))
    for (x0, y0) in ((6, 16), (6, 28), (38, 16), (38, 28)):                          # 창
        for y in range(y0, y0 + 5):
            for x in range(x0, x0 + 3): cv.px(x, y, (30, 26, 44) if y > y0 else STP[2])
    for y in range(2, 10): cv.px(30, y, WD[2])
    for y in range(H):
        for x in range(W - 1, 0, -1):
            if mk_.at(x - 1, y) and not mk_.at(x, y): cv.px(x, y, (196, 166, 120)); break
    im = fin(cv, .62)
    sb = Cv(W, H)
    for y in range(42, 48):
        for x in range(38, 47):
            if ((x + .5 - 42.5) / 4.4) ** 2 + ((y + .5 - 45) / 2.6) ** 2 <= 1: sb.px(x, y, CNV[4] if x < 42 else CNV[3])
    im.alpha_composite(fin(sb, .6))
    return shadow_under(im, 24, 46.5, 22, 1.6, 60)


def light_pool(seed=0):
    """조명 웅덩이 3×2(48x32, 반투명 바닥 장식): 위 조명등이 무대 바닥에 떨어뜨린 따뜻한 타원 빛, 세 단으로 끊어 도트 느낌."""
    im = new(48, 32); p = im.load()
    for y in range(32):
        for x in range(48):
            d = ((x + .5 - 24) / 23.0) ** 2 + ((y + .5 - 16) / 15.0) ** 2
            if d > 1: continue
            a = 44 if d > .62 else 76
            p[x, y] = (255, 236, 186, a)
    return im


# ------------------------------------------------------------------ 오케스트라
def grand_piano(seed=0):
    """그랜드 피아노 3×3(48x48): 검은 옻칠 몸통(오른쪽이 굽은 날개 모양)과 비스듬히 세운 뚜껑, 속의 금빛 현, 앞 건반, 놋쇠 바퀴 다리. 아래 2줄 막힘."""
    W, H = 48, 48; cv = Cv(W, H)
    LQ = [(8, 6, 12), (16, 12, 22), (26, 20, 34), (38, 30, 48), (56, 46, 68), (84, 74, 98), (128, 120, 146)]
    def body(x, y):                                                                  # 몸통 윗면(위에서 본 날개 모양)
        if not (4 <= x < 44 and 18 <= y < 38): return False
        if x >= 30:
            t = (x - 30) / 14.0
            return y >= 18 + 14 * t ** 1.4
        return True
    for y in range(H):
        for x in range(W):
            if body(x, y):
                c = LQ[2]
                if 8 <= x < 40 and 22 <= y < 36 and body(x + 3, y - 3):              # 속 현과 틀
                    c = (70, 46, 26) if (x + y) % 2 else (88, 58, 30)
                    if (y - 22) % 3 == 0: c = GLT[4] if x < 26 else GLT[3]
                    if x in (14, 26): c = LQ[3]                                      # 쇠 틀 갈비
                cv.px(x, y, c)
    for y in range(38, 44):                                                          # 앞 옆판(건반 쪽)
        for x in range(4, 44 if y < 40 else 42):
            cv.px(x, y, LQ[3] if x < 8 else LQ[2])
    for x in range(8, 38):                                                           # 건반
        cv.px(x, 38, MRB[6] if x % 3 else MRB[3]); cv.px(x, 39, MRB[5] if x % 3 else MRB[2])
        if x % 7 in (1, 2, 4, 5): cv.px(x, 38, LQ[1])
    for y in range(4, 22):
        for x in range(4, 44):
            t = (y - 4) / 18.0
            xa = 4 + t * 2; xb = 26 + t * 18
            if xa <= x < xb and y < 19 + (1 if x < 30 else 0):
                k = 3 if x < xa + 3 else 2
                if abs((x - xa) - (y - 4) * 1.6 - 6) < 1.5: k = 5                    # 광택 줄
                if y == 4 or x < xa + 1: k = 4
                cv.px(x, y, LQ[k])
    line(cv, 30, 19, 22, 10, LQ[5])                                                  # 뚜껑 받침대
    for (x, y) in ((6, 44), (40, 44), (24, 44)):
        for yy in range(y, y + 3): cv.px(x, yy, LQ[3]); cv.px(x + 1, yy, LQ[1])
        cv.px(x, y + 3, BR[5]); cv.px(x + 1, y + 3, BR[3])
    return shadow_under(fin(cv, .7), 24, 46.5, 21, 2, 70)


def music_chair(seed=0):
    """보면대 의자 1×1: 나무 의자(뒤)와 그 앞 가는 쇠 보면대(악보 판은 줄만, 글자·음표 없음). 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(2, 9):                                                            # 의자 등받이
        for x in range(3, 13): cv.px(x, y, WD[5] if y == 2 else (WD[4] if x < 10 else WD[3]))
    for y in range(9, 12):
        for x in range(2, 14): cv.px(x, y, VEL[4] if y == 9 else VEL[3])
    for (x, y0) in ((3, 12), (12, 12)):
        for y in range(y0, 16): cv.px(x, y, WD[2])
    for y in range(6, 15): cv.px(8, y, IR[2])                                        # 보면대 기둥(앞)
    for y in range(9, 14):
        for x in range(4, 13): cv.px(x, y, MRB[5] if (y - 9) % 2 == 0 else MRB[3]) if 10 <= y <= 12 else cv.px(x, y, IR[3])
    cv.px(6, 15, IR[2]); cv.px(10, 15, IR[2])
    return shadow_under(fin(cv, .62), 8, 15, 6, 1.2, 60)


def conductor_podium(seed=0):
    """지휘대 1×1: 낮은 둥근 단(윗면+앞면)과 남쪽 금 손잡이 난간, 단 위 지휘봉 받침. 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(8, 16):
        for x in range(1, 15):
            dx = (x + .5 - 8) / 7.0
            if abs(dx) > 1: continue
            if y < 12:
                if ((x + .5 - 8) / 7) ** 2 + ((y + .5 - 10) / 2.4) ** 2 <= 1: cv.px(x, y, VEL[5] if dx < 0 else VEL[4])
            else: cv.px(x, y, EBN[4] if dx < -.3 else (EBN[3] if dx < .4 else EBN[2]))
    for x in range(2, 14): cv.px(x, 12, GLT[4])
    for x in range(1, 15): cv.px(x, 5, GLT[5] if x < 9 else GLT[3])
    for x in (1, 14):
        for y in range(5, 12): cv.px(x, y, GLT[4] if x == 1 else GLT[2])
    cv.px(8, 8, IR[4]); cv.px(9, 7, IR[3]); cv.px(10, 6, MRB[6])
    return shadow_under(fin(cv, .62), 8, 15, 7, 1.2, 60)


def timpani(seed=0):
    """팀파니 2×2(32x32): 구리 솥 모양 북 둘(윗면 크림 가죽, 테 나사, 쇠 다리)과 북채 한 쌍. 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    CU = [(40, 18, 10), (92, 44, 20), (140, 70, 34), (184, 104, 52), (214, 140, 80), (236, 184, 124), (250, 224, 180)]
    for (cx, r) in ((9, 7.5), (23, 6.5)):
        for y in range(14, 27):
            hw = r * math.sqrt(max(0, 1 - ((y - 14) / 13.0) ** 2))
            for x in range(int(cx - hw), int(cx + hw) + 1):
                cv.px(x, y, CU[clamp(cyl_k(x, cx - hw, cx + hw + 1), 1, 6)])
        topell(cv, cx + .5, 14, r + .6, 3.2, MRB, 6, 4, seed)
        for a in range(8):
            xx = int(cx + .5 + math.cos(a * .785) * (r + .4)); yy = int(14 + math.sin(a * .785) * 3.2)
            cv.px(xx, yy, IR[4])
        for (lx, ly) in ((cx - r + 2, 31), (cx + r - 2, 31)): line(cv, cx, 26, lx, ly, IR[2])
    line(cv, 12, 9, 18, 13, WD[4]); cv.px(11, 8, CNV[5]); cv.px(12, 8, CNV[4])
    line(cv, 15, 8, 19, 13, WD[3]); cv.px(14, 7, CNV[5])
    return shadow_under(fin(cv, .62), 16, 30.5, 14, 1.6, 60)


def stage_trapdoor(seed=0):
    """무대 함정문 2×2(32x32, 바닥 장식·걷기): 무대 널 사이 네모 덮개 — 한 단 밝은 널, 둘레 그늘 홈, 쇠 경첩 둘과 손잡이 고리."""
    cv = Cv(32, 32)
    for y in range(2, 30):
        for x in range(2, 30):
            if x in (2, 29) or y in (2, 29): cv.px(x, y, EBN[1]); continue
            if x == 3 or y == 3: cv.px(x, y, EBN[4]); continue
            ly = (y - 4) % 6
            k = 3 if ly else 1
            if ly == 1: k = 4
            if x > 26: k -= 1
            cv.px(x, y, EBN[clamp(k, 1, 6)])
    for (x0, y0) in ((6, 4), (22, 4)):
        for x in range(x0, x0 + 5): cv.px(x, y0, IR[4]); cv.px(x, y0 + 1, IR[2])
    for (x, y, c) in ((15, 25, IR[4]), (16, 25, IR[3]), (14, 26, IR[3]), (17, 26, IR[2]), (15, 27, IR[2]), (16, 27, IR[1])): cv.px(x, y, c)
    return cv.im


def prop_throne(seed=0):
    """소품 옥좌 2×3(32x48): 무대 장면용 금칠 나무 옥좌 — 볏 장식 높은 등받이(진홍 벨벳), 팔걸이, 낮은 단(윗면+앞면). 아랫줄만 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    stone_box(cv, 1, 38, 31, 47, 3, EBN, seed)
    for x in range(1, 31): cv.px(x, 41, GLT[4] if x < 26 else GLT[3])
    for y in range(6, 34):                                                           # 등받이
        for x in range(7, 25):
            if y < 12 and abs(x - 15.5) > 3 + (y - 6) * 1.6: continue
            edge = x in (7, 8, 23, 24) or y < 9
            if edge: cv.px(x, y, GLT[6] if (x < 12 and y < 12) or x == 7 else (GLT[5] if x < 16 else GLT[3])); continue
            k = 4 if x < 13 else (3 if x < 20 else 2)
            if (x + y) % 5 == 0 and (y - x) % 5 == 0: k = 5
            cv.px(x, y, VEL[k])
    for (x, y, k) in ((15, 3, 6), (16, 3, 4), (15, 4, 5), (16, 4, 3), (14, 5, 5), (17, 5, 3)): cv.px(x, y, GLT[k])
    for y in range(26, 38):                                                          # 앉는 자리 앞판
        for x in range(5, 27):
            k = 4 if y < 29 else 3
            if y == 26: k = 5
            cv.px(x, y, VEL[k] if y < 31 else (GLT[4] if y == 31 else EBN[3 if x < 24 else 2]))
    for x0 in (2, 26):                                                               # 팔걸이
        for y in range(22, 38):
            for x in range(x0, x0 + 4):
                k = 5 if x == x0 else (4 if x < x0 + 3 else 2)
                if y < 24: k = 6 if x < x0 + 2 else 4
                cv.px(x, y, GLT[k])
    return shadow_under(fin(cv, .62), 16, 46.5, 15, 1.6, 70)


def arch_flat(seed=0):
    """주랑 배경판 4×3(64x48): 합판을 오려 칠한 회랑 — 위 돌림띠, 기둥 셋(머리·받침·명암), 둥근 아치 둘 너머 칠한 하늘과 정원 울타리, 뒤 버팀대. 아랫줄만 막힘."""
    W, H = 64, 48; cv = Cv(W, H)
    for x0 in (14, 46):
        for y in range(36, 46):
            x = x0 + (y - 36) // 2; cv.px(x, y, WD[4]); cv.px(x + 1, y, WD[2])
    STN = [MRB[0], (104, 92, 92), (140, 128, 122), (172, 162, 150), (198, 190, 176), (220, 214, 200), (236, 232, 220)]
    cols = (2, 29, 56)
    mk_ = Mk(W, H); mk_.rect(2, 6, 63, 46)
    for y in range(H):
        for x in range(W):
            if not mk_.at(x, y): continue
            col = [c for c in cols if c <= x < c + 7]
            if y < 12:                                                               # 돌림띠
                k = 5 if y < 8 else (4 if y < 10 else 2)
                if y == 6: k = 6
                if y == 9 and x % 4 == 0: k = 3
                cv.px(x, y, STN[k]); continue
            if col:
                lx = x - col[0]
                k = (5, 6, 5, 4, 4, 3, 2)[lx]
                if y < 15 or y > 42: k = min(6, k + 1) if y in (12, 43) else k
                if y in (14, 15, 41, 42): k = 3
                cv.px(x, y, STN[k]); continue
            # 아치: 기둥 사이
            c0 = max(c for c in cols if c <= x) + 7; c1 = min(c for c in cols if c > x)
            mid = (c0 + c1) / 2.0; r = (c1 - c0) / 2.0
            spring = 12 + r
            inside = y > spring or math.hypot(x + .5 - mid, y + .5 - spring) <= r - .5
            if not inside:
                k = 4 if x < mid else 3
                if math.hypot(x + .5 - mid, y + .5 - spring) <= r + 1.2: k = 2
                cv.px(x, y, STN[k]); continue
            t = (y - 12) / 34.0
            c = mix(BLU[5], (236, 206, 176), min(1, t * 1.3))
            if y > 36: c = GRN[3] if (x * 2 + y) % 5 else GRN[4]
            if 33 <= y <= 36 and (x % 4 == 0 or y == 33): c = MRB[4]               # 칠한 정원 난간
            cv.px(x, y, c)
    for y in range(H):
        for x in range(W - 1, 0, -1):
            if mk_.at(x - 1, y) and not mk_.at(x, y): cv.px(x, y, (196, 166, 120)); break
    im = fin(cv, .62)
    return shadow_under(im, 32, 46.5, 30, 1.6, 60)


def set_rock(seed=0):
    """소품 바위 2×1(32x16→32x32): 종이 반죽으로 빚어 칠한 둥근 바위 둘(윗면 밝고 이끼 붓 자국), 뒤가 비어 가볍다. 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    RK = [(40, 34, 44), (70, 62, 72), (98, 90, 96), (126, 118, 120), (154, 146, 144), (182, 176, 170), (206, 202, 194)]
    mk_ = Mk(W, H); mk_.ell(12, 22, 11, 9); mk_.ell(24, 26, 7, 5.5)
    vol(cv, mk_, RK, 1, 31, 4, seed + 3, grain=.08)
    for y in range(H):
        for x in range(W):
            if mk_.at(x, y) and not mk_.at(x, y - 2) and _hash(x, y, seed + 9) < .55: cv.px(x, y, GRN[4] if x < 16 else GRN[3])
    return shadow_under(fin(cv, .62), 15, 30.5, 14, 1.5, 70)
