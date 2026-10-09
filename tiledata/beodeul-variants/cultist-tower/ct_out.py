# 신도의 탑 조각 1 — 바깥: 3/4 원통 탑, 입구 계단, 돌 제단·선돌, 해골 말뚝, 교단 깃대, 잿빛 고목, 매단 쇠우리, 돌무덤, 땅 문장석,
# 마른 풀, 잿빛 흙길 오토타일. 손 도트(Pillow). 버들항 성 마름돌(castle6.ash) 결, 7단 램프, pz.fin 윤곽. 3/4 시점, 빛 왼쪽 위.
from ct_kit import *
from ct_kit import _hash, _gtex
from gc_kit import autotile_sheet


# ------------------------------------------------------------------ 탑 바깥 (원통)
def cult_tower(seed=0):
    """교단 탑 7×14(112x224): 원통 몸통(마름돌 줄눈이 앞으로 휘어 감긴다), 나선으로 오르는 보라빛 창 넷, 위 내민 돌받침(구멍 띠),
    흉벽 고리(앞 흉벽 + 안쪽에서 본 뒤 흉벽), 지붕 판석 위 보라 불 화로와 깃대, 앞면 교단 휘장 둘, 아치 문과 문 위 문장."""
    W, H = 112, 224; cv = Cv(W, H)
    R = 55.5; cx = 56.0; ry = 13.0
    Yb = 208.0; Htop = 158; P = 12; Ri = R - 6
    def surf(x):
        d = x + .5 - cx
        if abs(d) > R: return None
        u, cz = pv._wrap(d, R)
        return d, u, cz
    def shade(d, cz): return .44 + .6 * max(0, cz * .9 - .42 * (d / R))
    # (1) 뒤 흉벽 안쪽 면(뒤 반원, 안쪽 반지름 Ri): 지붕 위로 보인다
    for x in range(W):
        d = x + .5 - cx
        if abs(d) > Ri: continue
        cz = math.sqrt(max(0, 1 - (d / Ri) ** 2))
        ytop = Yb - Htop - P - ry * cz * Ri / R                                    # 뒤쪽은 위로
        ybot = Yb - Htop - ry * cz * Ri / R
        u = math.asin(max(-1, min(1, d / Ri))) * Ri
        for y in range(int(ytop) - 6, int(ybot) + 1):
            hh = ybot - y                                                          # 지붕 판에서 높이
            if hh < 0: continue
            if hh > P:                                                             # 뒤 흉벽 톱니(위 6px)
                if (int(u + 200) % 12) >= 7 or hh > P + 6: continue
            k = .78 - .16 * (d / Ri)
            c = cstone(int(u + 300), int(hh + 40), k=.62, bw=12, bh=6, seed=seed + 3)
            if hh > P - 1 and hh <= P: c = CS[5]
            if hh > P and hh >= P + 5: c = CS[6] if d < 0 else CS[5]
            cv.px(x, y, mul(c, k / .7))
    # (2) 지붕 판석(안쪽 원판)
    yc = Yb - Htop
    for y in range(int(yc - ry) - 1, int(yc + ry) + 2):
        for x in range(W):
            dx = (x + .5 - cx) / Ri; dy = (y + .5 - yc) / (ry * Ri / R)
            if dx * dx + dy * dy > 1: continue
            X = int(x * 1.0); Y = int((y - yc) * R / ry * .5)
            row = (Y + 200) // 6; lx = (X + (row % 2) * 6) % 12
            c = CS[4] if _hash(lx // 12 + X // 12, row, 71) < .6 else CS[5]
            if lx == 11 or (Y + 200) % 6 == 5: c = CS[2]
            if dy < -.55: c = mul(c, .78)                                          # 뒤 흉벽 그늘
            if dx > .55: c = mul(c, .85)
            cv.px(x, y, c)
    # (3) 지붕 위: 깃대(오른쪽 뒤) + 보라 불 화로(가운데)
    fx = int(cx + 22)
    for y in range(int(yc - 52), int(yc + 1)):
        cv.px(fx, y, EBW[4]); cv.px(fx + 1, y, EBW[2])
    cv.px(fx, int(yc - 53), GLD[4]); cv.px(fx + 1, int(yc - 53), GLD[3])
    for j in range(14):                                                            # 갈라진 꼬리 깃발(교단 보라)
        L = 18 - abs(j - 7) * 0 - (j * 0)
        for i in range(2, 22):
            if j < 7 and i > 20 - (7 - j) * 0: pass
            tail = i > 15 and (abs(j - 6.5) < (i - 15) * .7)
            if tail: continue
            yy = int(yc - 51) + j + int(1.6 * math.sin(i / 3.2))
            k = 5 if j < 2 else (4 if j < 10 else 3)
            if i > 17: k -= 1
            c = VIO[clamp(k, 0, 6)]
            if j in (0, 13): c = CRIM[4]
            cv.px(fx + 1 + i, yy, c)
    ecv = Cv(W, H)
    eye_emblem(ecv, fx + 10, int(yc - 44), 7, BONE[3], CRIM[3], VIO[0])
    cv.im.alpha_composite(ecv.im)
    bx = int(cx - 4)                                                               # 화로: 세 다리 쇠 그릇
    for (x0, x1) in ((bx - 6, bx - 9), (bx + 6, bx + 9), (bx, bx)):
        for i in range(10):
            xx = x0 + (x1 - x0) * i // 9
            cv.px(xx, int(yc - 2 - 9 + i), IR[3] if xx <= bx else IR[2])
    for y in range(int(yc - 16), int(yc - 10)):
        hw = 8 - max(0, y - int(yc - 13))
        for x in range(bx - hw, bx + hw): cv.px(x, y, IR[clamp(cyl_k(x, bx - hw, bx + hw) - 1, 1, 5)])
    topell(cv, bx, yc - 16.5, 8, 2.4, IR, 5, 3, seed)
    flame(cv, bx, int(yc - 17), 14, PF, seed + 5, 5)
    flame(cv, bx - 4, int(yc - 17), 8, PF, seed + 6, 2); flame(cv, bx + 4, int(yc - 17), 9, PF, seed + 7, 2)
    # (4) 앞 몸통 + 앞 흉벽(바깥 면): u,h 결 공간에서 칠한다
    WINS = [(-26, 26), (-6, 60), (16, 94), (34, 126)]                              # 창 (u, h 아래끝) — 나선으로 오른다(안의 나선 계단)
    BAN = (-31, 31)                                                                # 휘장 u 가운데
    for x in range(W):
        s_ = surf(x)
        if not s_: continue
        d, u, cz = s_
        kk = shade(d, cz)
        ytop = Yb - (Htop + P + 7) + ry * cz; ybot = Yb + ry * cz
        for y in range(int(ytop), int(ybot) + 1):
            h = Yb + ry * cz - (y + .5)                                            # 땅에서 높이(px)
            if h < 0: continue
            c = None
            if h > Htop + P:                                                       # 앞 흉벽 톱니
                if (int(u + 200) % 12) < 7:
                    c = CS[6] if h > Htop + P + 5 else cstone(int(u + 200), int(h), .62, 12, 6, seed)
                    if (int(u + 200) % 12) == 6: c = CS[2]
                else: continue
            elif h > Htop + P - 2: c = CS[6] if d < R * .3 else CS[5]              # 흉벽 윗면 띠
            elif h > Htop - 2: c = cstone(int(u + 200), int(h), .62, 12, 6, seed)  # 흉벽 앞면
            elif h > Htop - 14:                                                    # 내민 돌받침 띠(구멍 띠)
                hb = Htop - h
                if hb < 3: c = CS[5] if hb < 1.5 else CS[3]
                else:
                    seg = int(u + 200) % 10
                    c = CS[4] if seg < 5 else (DK if hb > 6 else CS[1])
                    if seg == 0: c = CS[5]
                    if hb > 11: c = CS[2]
            elif h < 9:                                                            # 받침돌(굵은 한 줄) + 발 그늘
                c = mix(cstone(int(u + 200), int(h), .55, 24, 9, seed + 4), CS[2], .2)
                if h > 7.5: c = CS[4]
                if h < 1.5: c = CS[1]
            else:
                c = cstone(int(u + 200), int(h), .56, 12, 6, seed)
                # 금(드물게)·그을음(창 위)
                if abs(u - 14 + (h - 40) * .35 + (1 if int(h) % 5 < 2 else 0)) < .6 and 36 < h < 50: c = CS[1]
                if abs(u + 40 - (h - 100) * .3) < .6 and 96 < h < 108: c = CS[1]
                sv = vnoise(u * .7 + 300, h * .25, 5, seed + 81)                    # 세로 그을음 줄
                if sv > .7: c = mix(c, SOOT, .28 * (sv - .7) / .3 + .06)
                if h < 30 and vnoise(u + 300, h, 4, seed + 82) > .7: c = mix(c, (70, 74, 52), .22)   # 아래 마른 이끼
            # 창
            for (wu, wh_) in WINS:
                du = u - wu; dh = h - wh_
                if abs(du) <= 4.5 and -1 <= dh <= 17:
                    top = dh > 13 and math.hypot(du, (dh - 13) * 1.1) > 4.5
                    if top: continue
                    if abs(du) > 3.2 or dh < .5 or (dh > 12.5 and math.hypot(du, (dh - 12.5) * 1.1) > 3.2):
                        c = CS[5] if du < 0 else CS[3]                             # 창틀
                        if dh < .5: c = CS[6] if du < 0 else CS[4]                 # 창턱
                    else:
                        g = 2 if dh < 4 else (3 if dh < 9 else 2)
                        c = PF[g] if abs(du) < 1.5 else PF[g - 1]
                        if abs(du) < .7 and dh > 3: c = VIO[1]                     # 창살
                        if 6 < dh < 7.2: c = VIO[1]
                if 17 < dh < 30 and abs(du) < 3 and h < Htop - 14:                 # 창 위 그을음
                    c = mix(c, SOOT, .35 * (1 - (dh - 17) / 13))
            # 문(아래 가운데)
            du = u - 0.0
            if abs(du) <= 12 and h <= 36:
                arch = h > 24 and math.hypot(du, (h - 24) * 1.0) > 12
                if not arch:
                    inner = abs(du) <= 8.5 and (h <= 24 or math.hypot(du, h - 24) <= 8.5)
                    if not inner:
                        c = CS[6] if du < -2 else (CS[5] if du < 4 else CS[3])     # 아치 돌테(쐐기돌)
                        if h > 24 and int(math.degrees(math.atan2(h - 24, du)) + 180) % 30 < 3: c = CS[2]
                        if h <= 24 and int(h) % 8 == 7: c = CS[2]
                    else:
                        # 쇠띠 두른 짙은 나무 문짝
                        k = 4 if du < -3 else (3 if du < 3 else 2)
                        if int(du + 20) % 4 == 0: k -= 1
                        c = EBW[clamp(k, 0, 6)]
                        if int(h) in (6, 7, 17, 18): c = IR[2] if du < 0 else IR[1]
                        if abs(du) < .6: c = EBW[0]
                        if 10 <= h <= 12 and du in (2.5, 3.5) or (abs(du - 3) < 1.1 and 10 <= h <= 12.5): c = IR[4]
                        if h > 24: c = mix(c, DK, .35)
            if 39 <= h <= 47 and abs(du) <= 5:                                     # 문 위 문장 돌판
                c = CS[5] if du < 0 else CS[4]
                if h < 40 or abs(du) > 4.2: c = CS[3]
            # 앞 휘장 둘
            for bu in BAN:
                db = u - bu
                if abs(db) <= 6.5 and Htop - 16 - 66 <= h <= Htop - 14:
                    lo = Htop - 16 - 66
                    if h - lo < 7 and abs(db) > (h - lo):
                        continue
                    k = 4
                    ph = (db + 6.5) % 4
                    if ph < 1: k = 5
                    elif ph >= 3: k = 3
                    if abs(db) > 5: c = CRIM[4] if db < 0 else CRIM[2]
                    else: c = VIO[clamp(k, 0, 6)]
                    if h > Htop - 18: c = GLD[4] if db < 0 else GLD[3]             # 매단 막대
            c = mul(c, min(1.12, kk)) if c is not None else None
            if c is not None: cv.px(x, y, c)
    # 휘장 문장(눈) — 결 공간 대신 화면 위치로(가운데 근처라 왜곡 작다)
    for bu in BAN:
        dd = R * math.sin(bu / R * math.pi / 2); xs = cx + dd; hh = Htop - 46
        czb = math.sqrt(max(0, 1 - (dd / R) ** 2))
        eye_emblem(cv, int(xs), int(Yb - hh + ry * czb), 7, BONE[3], CRIM[4], VIO[0])
    # 문 위 문장
    eye_emblem(cv, int(cx), int(Yb - 43 + ry), 7, BONE[2], CRIM[3], VIO[0])
    # 문 앞 고리 손잡이 그늘
    im = fin(cv, .55)
    return im


def tower_steps(seed=0):
    """탑 입구 돌계단 4×2(64x32, 걷기): 문 앞에 반원으로 퍼진 세 단, 단마다 밟판(밝음)·챌판(어두움), 양 끝 해골 받침돌."""
    W, H = 64, 32; cv = Cv(W, H)
    cx = 32
    for st in range(3):                                                            # 뒤(위) 단부터
        rx = 14 + st * 7; top = 2 + st * 9; ryy = 4 + st * 1.5
        for y in range(top - 3, top + 10):
            for x in range(W):
                dx = (x + .5 - cx) / rx
                if abs(dx) > 1: continue
                yb = top + ryy * math.sqrt(1 - dx * dx)
                if y > yb + 4 or y < top - 1: continue
                if y <= yb:                                                        # 밟판
                    k = 5 if dx < .2 else 4
                    if y <= top: k = 6 if dx < 0 else 5
                    if _hash(x, y, seed + st) < .06: k -= 1
                    if (x + st * 5) % 14 == 0: k = 3
                    cv.px(x, y, CS[clamp(k)])
                else:                                                              # 챌판
                    k = 3 if y - yb < 2 else 2
                    if dx > .5: k -= 1
                    cv.px(x, y, CS[clamp(k)])
    for sx in (3, 54):                                                             # 양 끝 받침돌 + 해골
        stone_box(cv, sx, 18, sx + 8, 31, 3, CS, seed + sx)
        skull(cv, sx + 4, 15, .9, seed)
    return fin(cv, .55)


# ------------------------------------------------------------------ 바깥 소품
def stone_altar_out(seed=0):
    """바깥 돌 제단 3×2(48x32): 두꺼운 마름돌 판(윗면+앞면), 판 위 검붉은 천·쇠사슬 둘·해골 둘·녹은 초, 앞면 아래 받침 두 기둥."""
    W, H = 48, 32; cv = Cv(W, H)
    for (x0, x1) in ((6, 14), (34, 42)):                                           # 받침 기둥
        for y in range(20, 31):
            for x in range(x0, x1): cv.px(x, y, CS[clamp(cyl_k(x, x0, x1) - 1)])
    for y in range(20, 31):
        for x in range(14, 34): cv.px(x, y, DK if y > 21 else CS[1])               # 판 밑 그늘
    stone_box(cv, 1, 5, 47, 21, 9, CS, seed)                                       # 판(윗면 9px + 앞면)
    for x in range(3, 45, 11): cv.px(x, 15, CS[3]); cv.px(x, 16, CS[3])           # 앞면 이음
    for y in range(4, 15):                                                         # 천: 판 위 가운데에서 앞으로 드리움
        for x in range(16, 32):
            k = 4 if (x - 16) % 4 < 2 else 3
            if y < 6: k = 5
            cv.px(x, y, CRIM[k])
    for y in range(14, 20):
        for x in range(17, 31):
            if y > 18 and (x % 3 == 0): continue
            cv.px(x, y, CRIM[3] if x < 24 else CRIM[2])
    for (ax, bx_) in ((4, 15), (33, 44)):                                          # 쇠사슬(판 위에 가로로)
        for x in range(ax, bx_):
            cv.px(x, 9 + (1 if (x // 2) % 2 else 0), IR[4] if x % 2 else IR[2])
    skull(cv, 8, 6, .8, seed); skull(cv, 39, 7, .8, seed + 1)
    candle(cv, 22, 6, 4, seed=seed); candle(cv, 27, 5, 5, seed=seed + 1)
    for x in range(14, 17): cv.px(x, 13, CRM[4])                                   # 흘러내린 촛농
    return shadow_under(fin(cv, .55), 24, 30.5, 22, 2, 80)


def standing_stone(seed=0, broken=False):
    """선돌 1×3(16x48) / 부러진 선돌 1×2: 위가 둥글게 깎인 길쭉한 돌기둥, 앞면에 새긴 나선 홈, 밑동 마른 풀."""
    H = 32 if broken else 48; W = 16; cv = Cv(W, H)
    mk = Mk(W, H)
    if broken: mk.poly([(3, 10), (6, 7), (9, 9), (13, 6), (13, 31), (3, 31)])
    else: mk.poly([(3, 8), (5, 3), (9, 1), (12, 4), (13, 10), (13, 47), (3, 47)])
    vol(cv, mk, CS, 3, 13, 4, seed, grain=.08)
    if broken:
        for (x, y) in ((6, 8), (7, 8), (9, 10), (10, 8), (11, 7)): cv.px(x, y, CS[6])
    cy0 = 20 if not broken else 18
    for a in range(0, 360 * 2, 20):                                                # 새긴 나선
        r = a / 720 * 3.6
        x = int(8 + r * math.cos(math.radians(a))); y = int(cy0 + r * math.sin(math.radians(a)) * .9)
        cv.px(x, y, CS[2])
    cv.px(8, cy0, VIO[3])
    im = fin(cv, .55)
    px = im.load(); WP.tufts(px, W, H, 2, 14, H - 1, seed + 33, .5, 3)
    return shadow_under(im, 8, H - 1.5, 6, 1.6, 80)


def skull_pike(seed=0):
    """해골 말뚝 1×2(16x32): 땅에 박은 깎은 나무 말뚝 끝에 해골, 말뚝에 감은 보라 천 끈."""
    W, H = 16, 32; cv = Cv(W, H)
    for y in range(9, 31):
        cv.px(7, y, EBW[4]); cv.px(8, y, EBW[3]); cv.px(9, y, EBW[2])
        if y % 5 == 0: cv.px(8, y, EBW[1])
    for y in (16, 17, 19):
        for x in range(6, 11): cv.px(x, y, VIO[4] if x < 8 else VIO[2])
    for (x, y) in ((10, 20), (11, 22), (11, 24), (10, 26)): cv.px(x, y, VIO[3])  # 끈 자락
    skull(cv, 8, 5, 1.0, seed)
    im = fin(cv, .55)
    px = im.load(); WP.tufts(px, W, H, 4, 12, H - 1, seed + 41, .5, 3)
    return shadow_under(im, 8, 30.5, 4, 1.2, 80)


def cult_banner_pole(seed=0):
    """교단 깃대 1×4(16x64): 쇠 머리 장식 깃대에 가로 막대, 늘어진 보라 깃발(검붉은 테두리, 눈 문장), 뾰족한 끝. 밑동 돌 무지."""
    W, H = 16, 64; cv = Cv(W, H)
    for y in range(3, 62): cv.px(3, y, EBW[4]); cv.px(4, y, EBW[2])
    for (x, y) in ((3, 1), (4, 1), (3, 2), (4, 2), (2, 2), (5, 2)): cv.px(x, y, IR[4] if x <= 3 else IR[2])
    for x in range(3, 15): cv.px(x, 6, IR[4] if x < 9 else IR[3])
    cloth_v(cv, 5, 15, 7, 46, VIO, seed, tip=True, border=CRIM)
    eye_emblem(cv, 10, 20, 5, BONE[3], CRIM[4], VIO[0])
    for (x0, y0, w) in ((0, 59, 4), (5, 60, 4), (1, 57, 5)):                       # 밑동 돌
        for i in range(w): cv.px(x0 + i, y0, CS[5] if i < w - 1 else CS[3]); cv.px(x0 + i, y0 + 1, CS[3])
    return shadow_under(fin(cv, .55), 4, 62, 4, 1.2, 80)


def ash_tree(seed=1, big=False):
    """잿빛 고목 2×3 / 큰 고목 3×4: 잎 없는 비틀린 줄기와 갈라진 앙상한 가지, 가지 윗면에 재, 밑동 마른 풀(황폐 필드 가지 붓)."""
    if big:
        c = WB.C(48, 64, seed=seed); c.shadow(24, 61.5, 14, 2.6, 100)
        WP.limb(c, [(24, 63), (25, 51), (23, 41), (24, 30), (26, 20)], [5.4, 4.4, 3.6, 2.8, 2.0], 'ashw', 3)
        WP.limb(c, [(23, 39), (15, 33), (10, 25), (6, 17), (5, 10)], [2.6, 2.0, 1.4, 1.0, .6], 'ashw', 4)
        WP.limb(c, [(24, 33), (32, 29), (38, 21), (42, 13)], [2.4, 1.8, 1.2, .7], 'ashw', 5)
        WP.limb(c, [(26, 21), (22, 13), (21, 5)], [1.6, 1.1, .7], 'ashw', 6)
        WP.limb(c, [(25, 23), (31, 15), (33, 8)], [1.3, .9, .6], 'ashw', 7)
        WP.limb(c, [(10, 25), (16, 20)], [.9, .5], 'ashw', 8); WP.limb(c, [(38, 21), (44, 19)], [.8, .5], 'ashw', 9)
        WP.limb(c, [(21, 61), (14, 63)], [1.8, .8], 'ashw', 11); WP.limb(c, [(27, 61), (35, 63)], [1.8, .8], 'ashw', 12)
        for y in range(45, 56): c.tone(24 + (y % 3 == 0), y, 'abyss', 1)
        WP._dust_on_top(c, 'ashw', seed=13, p=.4)
        im = WB.F(c); px = im.load(); WP.tufts(px, 48, 64, 12, 36, 63, seed + 22, .5, 5)
        return im
    c = WB.C(32, 48, seed=seed); c.shadow(16, 45.6, 9, 2.0, 90)
    lean = 1 if seed % 2 else -1
    WP.limb(c, [(16, 47), (16, 38), (16 + 2 * lean, 28), (16, 18), (17 - lean, 9)], [3.8, 3.0, 2.4, 1.8, 1.0], 'ashw', 3)
    WP.limb(c, [(16, 31), (10, 25), (6, 18), (4, 11)], [1.9, 1.4, 1.0, .6], 'ashw', 4)
    WP.limb(c, [(16, 24), (22, 19), (26, 12), (28, 6)], [1.8, 1.3, .9, .5], 'ashw', 5)
    WP.limb(c, [(10, 25), (5, 25), (2, 21)], [.9, .7, .5], 'ashw', 41)
    WP.limb(c, [(16, 17), (19, 11), (20, 4)], [1.0, .7, .5], 'ashw', 6)
    WP.limb(c, [(14, 46), (9, 47)], [1.4, .7], 'ashw', 8); WP.limb(c, [(18, 46), (23, 47)], [1.4, .7], 'ashw', 9)
    for (x, y) in ((15, 36), (16, 37), (15, 37)): c.tone(x, y, 'abyss', 1)
    WP._dust_on_top(c, 'ashw', seed=9, p=.4)
    im = WB.F(c); px = im.load(); WP.tufts(px, 32, 48, 8, 25, 47, seed + 21, .55, 4)
    return im


def gibbet_cage(seed=0):
    """매단 쇠우리 2×3(32x48): 땅에 박은 굽은 나무 기둥 팔 끝에 사슬로 매단 둥근 쇠창살 우리(빈 우리, 바닥에 뼈 몇 조각)."""
    W, H = 32, 48; cv = Cv(W, H)
    for y in range(4, 47): cv.px(5, y, EBW[4]); cv.px(6, y, EBW[3]); cv.px(7, y, EBW[2])
    for x in range(5, 26): cv.px(x, 4, EBW[4] if x < 20 else EBW[3]); cv.px(x, 5, EBW[2])
    for (x, y) in ((8, 6), (9, 7), (10, 8), (8, 7), (9, 8)): cv.px(x, y, EBW[3])    # 버팀목
    for y in range(6, 12): cv.px(22, y, IR[4] if y % 2 else IR[2])                 # 사슬
    cx, top, bot, rx = 22, 12, 34, 7.5
    for y in range(top, bot + 1):                                                  # 뒤 창살(어둡게)
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if (x - int(cx - rx)) % 3 == 1: cv.px(x, y, IR[1])
    for x in range(int(cx - rx), int(cx + rx) + 1):                                # 바닥판 + 뼈
        cv.px(x, bot, IR[2]); cv.px(x, bot - 1, IR[1])
    for (x, y) in ((18, 32), (19, 32), (20, 31), (24, 32), (25, 32)): cv.px(x, y, BONE[3])
    for y in range(top, bot + 1):                                                  # 앞 창살(밝게, 3/4 둥글게)
        for k in range(5):
            t = -1 + k * .5
            x = int(round(cx + t * rx * .95))
            cv.px(x, y, IR[4] if t < 0 else (IR[3] if t < .6 else IR[2]))
    for yy in (top, top + 1, 22, bot - 2):                                         # 띠
        for x in range(int(cx - rx), int(cx + rx) + 1): cv.px(x, yy, IR[4] if x < cx else IR[2])
    for (x, y) in ((cx - 2, top - 1), (cx, top - 2), (cx + 2, top - 1)): cv.px(int(x), y, IR[3])
    im = fin(cv, .55)
    px = im.load(); WP.tufts(px, W, H, 2, 11, H - 1, seed + 5, .5, 3)
    return shadow_under(im, 7, 46.5, 5, 1.4, 80)


def bone_cairn(seed=0):
    """돌무덤 1×1: 둥근 돌 셋을 쌓고 꼭대기에 해골, 둘레에 뼈 조각."""
    W, H = 16, 16; cv = Cv(W, H)
    for (cx_, cy_, rx, ryy) in ((5, 13, 4, 2.6), (11, 13, 4, 2.6), (8, 10, 4, 2.4)):
        mk = Mk(W, H); mk.ell(cx_, cy_, rx, ryy); vol(cv, mk, CS, None, None, 4, seed + cx_, grain=.1)
    skull(cv, 8, 5, .85, seed)
    for (x, y) in ((1, 15), (2, 15), (14, 14), (15, 14)): cv.px(x, y, BONE[3])
    return shadow_under(fin(cv, .55), 8, 15, 7, 1.2, 70)


def sigil_stone(seed=0):
    """땅 문장석 2×2(바닥 장식, 걷기): 땅에 박힌 둥근 판석에 새긴 두 겹 고리와 나선, 홈에 밴 검붉은 물."""
    W, H = 32, 32; cv = Cv(W, H)
    cx, cy = 16, 16
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - cx, (y + .5 - cy) * 1.05)
            if d > 14.5: continue
            k = 4 if (x + y) < 30 else 3
            if d > 13.3: k = 2 if y > cy else 5
            if _hash(x, y, seed + 2) < .07: k -= 1
            c = CS[clamp(k)]
            if 10.2 < d < 11.4 or 5.4 < d < 6.4: c = CRIM[2]
            cv.px(x, y, c)
    for a in range(0, 540, 12):
        r = 1 + a / 540 * 4.2
        cv.px(int(cx + r * math.cos(math.radians(a))), int(cy + r * math.sin(math.radians(a))), CRIM[1])
    for k in range(6):                                                             # 고리 사이 점(글자 아님)
        a = math.radians(k * 60 + 15)
        cv.px(int(cx + 8.4 * math.cos(a)), int(cy + 8.4 * math.sin(a)), VIO[4])
    return fin(cv, .5)


def dead_grass(seed=0):
    """마른 풀 포기 1×1(바닥 장식, 걷기): 잿빛 바랜 풀잎 몇 포기와 잔돌."""
    W, H = 16, 16; im = new(W, H); px = im.load()
    G = WB.R7('dgr')
    for (x0, x1, yb) in ((2, 8, 13), (8, 14, 15), (5, 10, 9)):
        for x in range(x0, x1):
            if _hash(x, yb, seed) > .6: continue
            hgt = 1 + int(_hash(x, yb, seed + 1) * 4)
            for j in range(hgt):
                t = 5 if j >= hgt - 1 else (4 if j else 2)
                px[x, yb - j] = G[t] + (255,)
    if _hash(seed, 0, 3) < .6: px[12, 6] = CS[5] + (255,); px[13, 6] = CS[4] + (255,); px[12, 7] = CS[3] + (255,)
    return im


def rocks_ash(seed=0):
    """잿빛 돌 무리 1×1: 크고 작은 모난 돌 셋(윗면 밝음)."""
    W, H = 16, 16; cv = Cv(W, H)
    for (cx_, cy_, rx, ryy) in ((5, 12, 4.2, 3.0), (11, 13, 3.0, 2.2), (9, 9, 2.4, 1.8)):
        mk = Mk(W, H); mk.ell(cx_, cy_, rx, ryy); vol(cv, mk, CS, None, None, 4, seed + cx_ * 3, grain=.1)
    return shadow_under(fin(cv, .55), 8, 14.6, 7, 1.2, 70)


def bone_scatter_out(seed=0):
    """흩어진 뼈 2×1(바닥 장식, 걷기): 긴 뼈 둘·갈비 조각·작은 해골."""
    W, H = 32, 16; cv = Cv(W, H)
    for (x0, y0, x1, y1) in ((3, 11, 13, 8), (17, 12, 27, 13)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i // n; y = y0 + (y1 - y0) * i // n
            cv.px(x, y, BONE[3]); cv.px(x, y + 1, BONE[1])
        for (x, y) in ((x0, y0), (x1, y1)):
            cv.px(x - 1, y - 1, BONE[4]); cv.px(x + 1, y - 1, BONE[3]); cv.px(x - 1, y + 1, BONE[2])
    for i in range(4): cv.px(9 + i * 2, 4, BONE[3]); cv.px(9 + i * 2, 5, BONE[2]); cv.px(10 + i * 2, 6, BONE[1])
    skull(cv, 26, 6, .7, seed)
    return fin(cv, .55)


# ------------------------------------------------------------------ 오토타일: 잿빛 흙길(밟아 다진 길, 가장자리 들쭉날쭉)
def trail_inner(x, y):
    a = _gtex('hard')
    r, g, b = [int(v) for v in a[y % 16, x % 16]]
    c = mix((r, g, b), CS[5], .12)
    if _hash(x, y, 921) > .985: c = CS[6]
    return c
def trail_border(d):
    if d == 0: return WB.RGB('ashe', 2)
    if d == 1: return WB.RGB('ashe', 3)
    return None
def trail_sheet(): return edge_overlay(trail_inner, trail_border, amp=2, base=1, seed=37)
