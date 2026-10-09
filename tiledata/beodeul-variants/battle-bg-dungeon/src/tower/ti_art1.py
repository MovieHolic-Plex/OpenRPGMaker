# 탑 내부 조각 1: 1층 홀(창·빛 무늬·기둥·기사 석상·화로·벽 촛대), 계단(직선 오름/내림·계단 아치), 잠긴 문, 함정, 경비실 소품.
# 손 도트(Pillow). 버들항 돌 램프 ST, 쇠 IR, 나무 WD, 금 GLD, 슬레이트 보라 SL. 3/4 시점(윗면+앞면), 빛 왼쪽 위.
from ti_kit import *
from ti_kit import _hash


def _facefill(cv, W, H, seed=0, x_ok=None):
    """조각 안에서 벽 앞면 결을 그대로 칠한다(앞면에 박히는 문·아치 둘레가 벽과 이어 보이게)."""
    for y in range(H):
        for x in range(W):
            if x_ok and not x_ok(x, y): continue
            cv.px(x, y, dlib.face_px('tower', x + 4000 + seed * 16, y, H, 3, False, False))


# ------------------------------------------------------------------ 창과 빛
def arch_window_tall(seed=0):
    """높은 아치 창 2×3(32x48): 마름돌 틀(왼쪽 밝음), 낮 하늘 유리를 돌 문설주로 둘로 가르고 납 띠, 아래 창턱 윗면."""
    W, H = 32, 48; cv = Cv(W, H)
    x0, x1, yt, yb = 7, 25, 5, 38                      # 유리 안쪽 상자
    cx = (x0 + x1) / 2.0; R = (x1 - x0) / 2.0
    def inner(x, y, pad=0):
        xx = x + .5; yy = y + .5
        if xx < x0 + pad or xx > x1 - pad or yy > yb - pad: return False
        if yy < yt + R: return math.hypot(xx - cx, yy - (yt + R)) <= R - pad
        return True
    def frame(x, y):
        return inner(x, y, -3) and not inner(x, y)
    for y in range(H):
        for x in range(W):
            if inner(x, y):
                t = (y - yt) / float(yb - yt)
                c = SKY[4] if t < .25 else (SKY[3] if t < .55 else SKY[2])
                if (x + y) % 7 == 0 and t < .6: c = SKY[5]                         # 유리 반짝임(사선)
                if abs(x + .5 - cx) < 1.5: c = ST[5] if x < cx else ST[3]          # 돌 문설주
                if (y - yt) % 9 == 8 and abs(x + .5 - cx) >= 1.5: c = IR[2]          # 납 띠(가로)
                if x == x0 or x == x1 - 1: c = mix(c, IR[2], .5)
                cv.px(x, y, c)
            elif frame(x, y):
                k = 6 if x < cx - 2 else (5 if x < cx + 3 else 4)
                if y < yt + 2: k = 6
                ash = C6.ash(x, y, k=1.0, bw=8, bh=6, seed=seed + 3)
                cv.px(x, y, mix(ash, ST[k], .55))
    # 쐐기돌
    for y in range(yt - 3, yt + 1):
        for x in range(int(cx) - 2, int(cx) + 2): cv.px(x, y, ST[6] if x < cx else ST[5])
    # 창턱: 윗면 3행(밝음) + 앞면 3행
    for y in range(yb, yb + 6):
        for x in range(x0 - 4, x1 + 4):
            k = (6 if x < cx else 5) if y < yb + 3 else (4 if x < x1 else 3)
            if y == yb + 5: k = 2
            cv.px(x, y, ST[k])
    return fin(cv, .55)


def window_light(seed=0):
    """창에서 들어온 빛 3×5(48x80, 반투명 장식): 창 아래에서 남쪽·오른쪽으로 비스듬히 퍼지는 엷은 빛줄기 끝에 창살 십자가 그림자진 밝은 무늬."""
    W, H = 48, 80; im = new(W, H); p = im.load()
    warm = (255, 240, 196)
    def shaft(x, y):
        t = y / float(H)
        xa = 8 + t * 14; xb = 26 + t * 18                  # 위 18px 폭 → 아래 22px 폭, 오른쪽으로 기운다
        return xa <= x < xb
    # 끝의 무늬: 아치 창 모양을 바닥에 눕혀(세로로 납작하게) 투영, 문설주·납 띠는 그림자
    px0, py0 = 21, 46; pw, ph = 22, 30
    def patch(x, y):
        xx = x - px0; yy = y - py0
        if not (0 <= xx < pw and 0 <= yy < ph): return False
        r = pw / 2.0
        if yy < r * .55:
            return ((xx + .5 - r) / r) ** 2 + ((yy + .5 - r * .55) / (r * .55)) ** 2 <= 1
        return True
    for y in range(H):
        for x in range(W):
            if patch(x, y):
                xx = x - px0; yy = y - py0
                bar = abs(xx + .5 - pw / 2.0) < 1.5 or (yy % 8 == 7)
                a = 50 if bar else (150 if (x + y) % 2 else 132)
                if xx in (0, pw - 1) or yy == ph - 1: a = 96
                p[x, y] = warm + (a,)
            elif shaft(x, y) and y < py0 + 4:
                a = 34 + int(22 * (y / float(H)))
                if (x + y) % 2 == 0: a += 6
                p[x, y] = warm + (a,)
    # 빛 속 먼지 점
    for i in range(14):
        x = int(10 + _hash(i, 1, seed + 7) * 30); y = int(4 + _hash(i, 2, seed + 7) * 50)
        if shaft(x, y): p[x, y] = (255, 252, 236, 150)
    return im


# ------------------------------------------------------------------ 기둥·석상·화로·벽 촛대
def pillar_grey(seed=0):
    """홀 둥근 기둥 1×3(16x48): 둥근 머리판 윗면 + 네모 판 앞면 + 홈 새긴 원통(6단 명암) + 두 단 받침. 아랫줄만 막힘."""
    W, H = 16, 48; cv = Cv(W, H)
    # 받침 아래 단(윗면 3 + 앞면 5)
    stone_box(cv, 1, 39, 15, 47, 3, ST, seed)
    for y in range(36, 39):                                                       # 받침 위 고리
        for x in range(3, 13): cv.px(x, y, ST[clamp(cyl_k(x, 3, 13) - (1 if y == 38 else 0))])
    x0, x1 = 4, 12
    for y in range(11, 36):
        for x in range(x0, x1):
            k = cyl_k(x, x0, x1)
            if x in (6, 9) and 12 < y < 35: k -= 1                                  # 세로 홈
            if _hash(x, y, seed + 2) < .04: k += 1 if _hash(y, x, seed + 3) < .5 else -1
            cv.px(x, y, ST[clamp(k)])
    for y in range(7, 11):                                                        # 목받이(아래로 좁아짐)
        hw = 6 - (y - 7) // 2
        for x in range(8 - hw, 8 + hw): cv.px(x, y, ST[clamp(cyl_k(x, 8 - hw, 8 + hw) - (1 if y == 10 else 0))])
    for y in range(4, 7):                                                         # 머리판 앞면
        for x in range(1, 15): cv.px(x, y, ST[5 if x < 3 else (4 if x < 12 else 3)] if y < 6 else ST[3])
    topell(cv, 8, 2.6, 7.2, 2.6, ST, 6, 5, seed)                                  # 머리판 윗면
    im = fin(cv, .6)
    return shadow_under(im, 8, 46.5, 7.5, 1.8, 80)


def knight_statue(seed=0):
    """기사 석상 2×3(32x48): 네모 받침(윗면+앞면) 위에 칼끝을 바닥에 짚고 방패를 든 돌 기사. 투구 깃·망토. 아랫줄 2칸 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    stone_box(cv, 3, 34, 29, 47, 4, ST, seed)                                     # 받침
    for x in range(5, 27): cv.px(x, 41, ST[3] if x > 6 else ST[4])               # 받침 띠 홈
    S2 = [ST[0], ST[1], ST[2], ST[3], mix(ST[3], ST[4], .5), ST[4], ST[5], ST[6]]
    mk = Mk(W, H)
    mk.poly([(10, 14), (22, 14), (24, 30), (8, 30)])                             # 망토·몸
    mk.rect(11, 29, 15, 36); mk.rect(17, 29, 21, 36)                               # 다리
    mk.ell(16, 9, 3.6, 4.0)                                                       # 투구
    mk.ell(10.5, 15, 3.0, 2.4); mk.ell(21.5, 15, 3.0, 2.4)                         # 어깨
    vol(cv, mk, ST, 7, 25, 4, seed, grain=.05)
    # 방패(왼팔, 앞으로): 위가 둥근 연 모양
    sh = Mk(W, H); sh.poly([(5, 17), (12, 17), (12, 25), (8.5, 30), (5, 25)])
    vol(cv, sh, ST, 5, 12, 5, seed + 1, grain=.03)
    for y in range(18, 28): cv.px(8, y, ST[3])                                    # 방패 세로 줄
    for x in range(6, 12): cv.px(x, 21, ST[3])
    # 칼: 두 손으로 자루를 쥐고 칼끝이 받침에 닿는다
    for y in range(20, 35): cv.px(16, y, ST[6] if y < 28 else ST[5]); cv.px(17, y, ST[4])
    for x in range(13, 21): cv.px(x, 19, ST[5] if x < 17 else ST[4])            # 코등이
    cv.px(16, 17, ST[4]); cv.px(16, 18, ST[5]); cv.px(17, 18, ST[3])
    for x in range(14, 19): cv.px(x, 9, ST[1])                                    # 투구 눈 틈
    cv.px(16, 10, ST[2])
    for (x, y) in ((15, 4), (16, 3), (17, 3), (18, 4), (19, 5), (20, 6)): cv.px(x, y, ST[5])   # 투구 깃
    for y in range(14, 30): cv.px(8 if y > 20 else 9, y, ST[3]) if y % 3 == 0 else None    # 망토 주름
    for y in range(16, 30, 3): cv.px(22, y, ST[2])
    im = fin(cv, .6)
    return shadow_under(im, 16, 46.5, 14, 2, 80)


def brazier_iron(seed=0):
    """쇠 화로 1×2(16x32): 세 다리 쇠 받침 위 둥근 쇠 그릇(윗면 숯) + 불꽃. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for (x0, y0, x1, y1) in ((4, 20, 2, 31), (12, 20, 14, 31), (8, 21, 8, 30)):  # 다리
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i // n; y = y0 + (y1 - y0) * i // n
            cv.px(x, y, IR[3] if x <= 8 else IR[2])
    for x in range(4, 13): cv.px(x, 27, IR[2])                                   # 다리 가로대
    for y in range(17, 22):                                                       # 그릇 앞면
        hw = 7 - max(0, y - 19)
        for x in range(8 - hw, 8 + hw): cv.px(x, y, IR[clamp(cyl_k(x, 8 - hw, 8 + hw) - 1, 1, 5)])
    topell(cv, 8, 16.5, 7, 2.2, IR, 5, 3, seed)                                   # 테
    for x in range(3, 13):                                                        # 숯
        for y in (16, 17):
            if ((x - 8) / 5.5) ** 2 + ((y + .5 - 16.5) / 1.4) ** 2 <= 1: cv.px(x, y, FL[0] if (x + y) % 3 else FL[2])
    flame = [(8, 3), (7, 5), (9, 6), (6, 8), (10, 8), (5, 11), (11, 11), (4, 14), (12, 14)]
    for y in range(4, 16):
        hw = 1 + (y - 4) * 4 // 11
        for x in range(8 - hw, 8 + hw + 1):
            d = abs(x - 8) / max(1, hw)
            k = 4 if d < .3 and y > 8 else (3 if d < .6 else (2 if d < .9 else 1))
            if y < 7: k = min(k, 3)
            if _hash(x, y, seed + 3) < .12: k = max(0, k - 1)
            cv.px(x, y, FL[k])
    cv.px(8, 2, FL[2]); cv.px(7, 4, FL[3]); cv.px(10, 5, FL[2])
    return shadow_under(fin(cv, .55), 8, 31, 6, 1.4, 70)


def wall_sconce(seed=0):
    """벽 촛대 1×1(장식, 앞면 위): 쇠 받침 팔과 접시, 굵은 초 하나와 불꽃."""
    cv = Cv(16, 16)
    for y in range(9, 15): cv.px(8, y, IR[3]); cv.px(9, y, IR[2])                # 벽판
    cv.px(7, 9, IR[4]); cv.px(10, 14, IR[1])
    for x in range(5, 12): cv.px(x, 9, IR[4] if x < 8 else IR[3])               # 접시
    for x in range(6, 11): cv.px(x, 10, IR[2])
    for y in range(5, 9): cv.px(7, y, CRM[6]); cv.px(8, y, CRM[5]); cv.px(9, y, CRM[3])   # 초
    cv.px(8, 4, FL[1]); cv.px(8, 3, FL[3]); cv.px(8, 2, FL[4]); cv.px(7, 3, FL[2]); cv.px(9, 3, FL[1]); cv.px(8, 1, FL[2])
    return fin(cv, .5)


def doormat_slate(seed=0):
    """입구 깔개 2×1(32x16, 바닥 장식): 슬레이트 보라 천에 금실 테두리, 양 끝 술."""
    cv = Cv(32, 16)
    for y in range(3, 14):
        for x in range(2, 30):
            c = SL[3] if (x + y) % 4 else SL[4]
            if y in (3, 13) or x in (2, 29): c = GLD[4]
            elif y in (4, 12) or x in (3, 28): c = SL[1]
            elif y == 8 and 6 < x < 26: c = GLD[3] if x % 2 else SL[5]
            cv.px(x, y, c)
    for x in range(3, 29, 2): cv.px(x, 2, GLD[3]); cv.px(x, 14, GLD[3])
    return cv.im


# ------------------------------------------------------------------ 계단
def stair_straight_up(seed=0):
    """직선 석조 오름 계단 4×4(64x64, 걷기): 양옆 난간벽 윗면 띠 + 북쪽으로 오르는 계단 8단(밟판 밝음·챌판 어두움).
    위로 갈수록 밟판이 밝고 짧아져 오르는 방향이 읽힌다. 맨 윗단은 벽 앞면의 계단 아치(stair_arch_up)로 이어진다."""
    W, H = 64, 64; cv = Cv(W, H)
    for y in range(H):
        for x in range(8, 56):
            st = y // 8; ly = y % 8                                   # st 0 = 맨 위 단
            hi = 7 - st                                               # 높이 단계
            if ly < 5:                                                # 밟판(윗면)
                k = 5 if hi >= 4 else 4
                if ly == 0: k += 1
                if x < 12: k -= 1                                     # 왼쪽 난간 그늘
            else:                                                     # 챌판(앞면)
                k = 3 if ly == 5 else 2
                if hi >= 5: k += 1
            r = _hash(x, y, seed + 11)
            if r < .05: k -= 1
            elif r > .97: k += 1
            c = ST[clamp(k)]
            if (x - 8 + st * 9) % 24 == 0 and ly < 5: c = ST[3]       # 밟판 돌 이음(단마다 어긋남)
            if ly == 4: c = mix(c, ST[6], .35)                         # 단 끝 모서리 빛
            cv.px(x, y, c)
    # 난간벽: 위에서 본 띠(8px) — 바깥 테 밝음, 안쪽 테 그늘. 남쪽 끝에 앞면 6행.
    for y in range(H):
        for (xa, xb, left) in ((0, 8, True), (56, 64, False)):
            for x in range(xa, xb):
                if y >= H - 6:
                    k = 4 if left and x < 2 else 3
                    if y == H - 1: k = 1
                    elif y == H - 6: k = 5 if left else 4
                else:
                    k = 5
                    if (left and x == 0) or (not left and x == 56): k = 6
                    if (left and x == 7) or (not left and x == 63): k = 3
                    if y % 16 == 15: k = 3                             # 갓돌 이음
                cv.px(x, y, ST[clamp(k)])
    im = fin(cv, .5)
    return im


def stair_arch_up(seed=0):
    """계단 아치 4×3(64x48, 앞면 장식): 벽 앞면에 뚫린 넓은 아치 — 안쪽은 어둠 속으로 이어지는 밝은 계단 끝, 둘레는 마름돌 아치 틀."""
    W, H = 64, 48; cv = Cv(W, H)
    x0, x1 = 8, 56; cx = 32; R = 24; ytop = 4
    def inside(x, y, pad=0):
        xx = x + .5; yy = y + .5
        if xx < x0 + pad or xx > x1 - pad: return False
        if yy < ytop + R: return math.hypot(xx - cx, yy - (ytop + R)) <= R - pad
        return True
    _facefill(cv, W, H, seed, lambda x, y: not inside(x, y, -3))
    for y in range(H):
        for x in range(W):
            if inside(x, y):
                # 안쪽: 위로 오르는 계단 단이 어둠 속으로 사라진다
                ly = (H - 1 - y) % 6; st = (H - 1 - y) // 6
                fade = min(1.0, st / 6.0)
                c = ST[4] if ly >= 2 else ST[2]
                c = mix(c, dlib.VOID[1], fade * .92)
                if x < x0 + 3: c = mix(c, dlib.VOID[0], .5)
                cv.px(x, y, c)
            elif inside(x, y, -3):
                k = 6 if x < cx - 6 else (5 if x < cx + 6 else 4)
                c = mix(C6.ash(x, y, bw=8, bh=6, seed=seed + 9), ST[k], .5)
                # 아치 돌 이음(방사)
                a = math.atan2(y + .5 - (ytop + R), x + .5 - cx)
                if y < ytop + R and int((a + math.pi) * 5) % 2 == 0 and abs(math.hypot(x + .5 - cx, y + .5 - ytop - R) - R - 1.5) < 1.6 and (int((a + math.pi) * 10) % 2 == 0): c = ST[3]
                cv.px(x, y, c)
    for y in range(ytop - 3, ytop + 1):
        for x in range(cx - 3, cx + 3): cv.px(x, y, ST[6] if x < cx else ST[5])       # 쐐기돌
    return fin(cv, .55)


def stair_straight_down(seed=0):
    """직선 석조 내림 계단 4×4(64x64, 걷기): 바닥에 뚫린 계단 구멍. 양옆 낮은 난간벽(윗면+앞면), 남쪽은 열려 있고
    계단 8단이 북쪽으로 내려갈수록 어두워져 어둠에 잠긴다. 북쪽 끝에는 구멍 안벽 앞면이 보인다."""
    W, H = 64, 64; cv = Cv(W, H)
    for y in range(4, H):
        for x in range(8, 56):
            st = (H - 1 - y) // 7; ly = (H - 1 - y) % 7               # st 0 = 맨 아래(남쪽, 바닥 높이) 단
            depth = st
            if ly == 6: k = 2                                         # 단 끝 그늘
            elif ly == 5: k = 3
            else: k = 5 if ly == 0 else 4
            c = ST[clamp(k)]
            if (x - 8) % 24 == 0 and ly < 5: c = ST[3]
            if _hash(x, y, seed + 3) < .05: c = mix(c, ST[2], .5)
            c = mix(c, dlib.VOID[1], min(.95, depth * .14))
            if x < 12: c = mix(c, dlib.VOID[0], .35)                  # 왼쪽 난간 밑 그늘
            cv.px(x, y, c)
    for y in range(0, 10):                                            # 북쪽 안벽 앞면(어둡다)
        for x in range(8, 56):
            c = mix(dlib.face_px('tower', x + 4000, y + 10, 30, 3, False, False), dlib.VOID[1], .7)
            if y == 0: c = ST[4]
            cv.px(x, y, c)
    # 난간벽: 윗면 띠 + 남쪽 끝 앞면, 북쪽은 바닥과 같은 높이로 이어지는 턱
    for y in range(H):
        for (xa, xb, left) in ((0, 8, True), (56, 64, False)):
            for x in range(xa, xb):
                if y >= H - 6:
                    k = 4 if left and x < 2 else 3
                    if y == H - 1: k = 1
                    elif y == H - 6: k = 5 if left else 4
                else:
                    k = 5
                    if (left and x == 0) or (not left and x == 56): k = 6
                    if (left and x == 7) or (not left and x == 63): k = 3
                    if y % 16 == 15: k = 3
                cv.px(x, y, ST[clamp(k)])
    for x in range(0, 64):                                            # 북쪽 턱(바닥 높이 갓돌)
        for y in range(0, 3): cv.px(x, y, ST[6] if y == 0 else ST[5]) if (x < 8 or x >= 56 or y < 2) else None
    return fin(cv, .5)


# ------------------------------------------------------------------ 잠긴 문 · 함정
def locked_door(seed=0):
    """잠긴 문 2×3(32x48): 벽 앞면 결 속 아치 문틀, 쇠띠를 두른 나무 쌍여닫이와 큰 금빛 자물쇠·쇠사슬. 아랫줄 막힘(열쇠 이벤트로 연다)."""
    W, H = 32, 48; cv = Cv(W, H)
    x0, x1, ytop = 4, 28, 6; cx = 16; R = 12
    def inside(x, y, pad=0):
        xx = x + .5; yy = y + .5
        if xx < x0 + pad or xx > x1 - pad or yy > H: return False
        if yy < ytop + R: return math.hypot(xx - cx, yy - (ytop + R)) <= R - pad
        return True
    _facefill(cv, W, H, seed, lambda x, y: not inside(x, y, -3))
    for y in range(H):
        for x in range(W):
            if inside(x, y):
                lx = x - x0
                c = WD[4] if lx % 6 not in (0, 5) else WD[2]
                if x in (15, 16): c = WD[1]                                     # 두 짝 사이
                if lx % 6 == 1: c = WD[5]
                if y in (16, 17, 32, 33, 42): c = IR[3] if x < cx else IR[2]   # 쇠띠
                if y in (16, 32) : c = IR[4] if x < cx else IR[3]
                if y in (17, 33, 43) and _hash(x, 0, 3) < .3: c = IR[5]        # 못
                if y >= H - 2: c = ST[2]
                cv.px(x, y, c)
            elif inside(x, y, -3):
                k = 6 if x < cx - 3 else (5 if x < cx + 4 else 4)
                if y >= H - 3: k = 3
                cv.px(x, y, mix(C6.ash(x, y, bw=8, bh=6, seed=seed + 2), ST[k], .55))
    for y in range(ytop - 3, ytop + 1):
        for x in range(cx - 2, cx + 2): cv.px(x, y, ST[6] if x < cx else ST[5])
    # 쇠사슬(X자)과 자물쇠
    for i in range(-9, 10):
        for (sx, sy) in ((cx + i, 26 + abs(i) // 3), ):
            if i % 2 == 0: cv.px(sx, sy, IR[4]); cv.px(sx, sy + 1, IR[2])
            else: cv.px(sx, sy, IR[3])
    for y in range(26, 34):
        for x in range(13, 19):
            c = GLD[5] if x < 15 else (GLD[4] if x < 17 else GLD[3])
            if y == 26: c = GLD[6] if x < 16 else GLD[5]
            if y == 33: c = GLD[2]
            cv.px(x, y, c)
    for (x, y) in ((14, 23), (14, 24), (14, 25), (15, 22), (16, 22), (17, 23), (17, 24), (17, 25)): cv.px(x, y, IR[4] if x < 16 else IR[3])   # 고리
    cv.px(15, 29, GLD[1]); cv.px(15, 30, GLD[1]); cv.px(16, 30, GLD[2])                                                                      # 열쇠 구멍
    return fin(cv, .55)


def trap_plate(seed=0):
    """압력판 1×1(바닥 장식, 걷기): 판석 속에 살짝 꺼진 네모 판 — 둘레 홈, 가운데 엇갈린 금속 테."""
    cv = Cv(16, 16)
    for y in range(2, 14):
        for x in range(2, 14):
            c = mix(ST[4], ST[3], .25)
            if x == 2 or y == 2: c = ST[2]
            elif x == 13 or y == 13: c = ST[5]
            elif x == 3 or y == 3: c = mix(ST[4], ST[3], .5)
            if 5 <= x <= 10 and 5 <= y <= 10 and (x in (5, 10) or y in (5, 10)): c = IR[3] if x < 8 else IR[2]
            cv.px(x, y, c)
    cv.px(7, 7, IR[4]); cv.px(8, 8, IR[1])
    return cv.im


def trap_spikes(seed=0):
    """가시 함정 1×1(바닥 장식, 걷기 — 피해는 이벤트): 구멍 3×3 에서 솟은 쇠 가시(왼쪽 밝음)."""
    cv = Cv(16, 16)
    for (hx_, hy) in ((3, 5), (8, 4), (13, 5), (3, 10), (8, 9), (13, 10), (5, 14), (11, 14)):
        cv.px(hx_ - 1, hy, ST[1]); cv.px(hx_, hy, DK); cv.px(hx_ + 1, hy, ST[2]); cv.px(hx_, hy + 1, ST[3])
        for k in range(1, 5):
            cv.px(hx_, hy - k, IR[5] if k < 4 else IR[4])
            if k < 3: cv.px(hx_ + 1, hy - k, IR[2])
    return cv.im


def trap_holes(seed=0):
    """가시 구멍 1×1(바닥 장식, 걷기): 가시가 들어간 상태의 작은 구멍들 — 가시 함정 앞뒤 칸에 섞어 함정 자리를 암시한다."""
    cv = Cv(16, 16)
    for (hx_, hy) in ((3, 4), (8, 3), (13, 4), (3, 9), (8, 8), (13, 9), (5, 13), (11, 13)):
        cv.px(hx_ - 1, hy, ST[2]); cv.px(hx_, hy, DK); cv.px(hx_ + 1, hy, ST[2]); cv.px(hx_, hy + 1, ST[5])
    return cv.im


def treasure_chest(seed=0):
    """보물 상자 1×1: 둥근 뚜껑 윗면(나무 널+쇠띠) + 앞면 금 자물쇠. 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(3, 15):
        for x in range(1, 15):
            if y < 8:                                                   # 뚜껑 윗면(둥근)
                k = 5 if y < 5 else 4
                if x < 3: k += 1
                c = WD[clamp(k)]
                if y == 3 and x in (1, 14): continue
            else:
                k = 4 if x < 3 else (3 if x < 12 else 2)
                c = WD[clamp(k)]
                if y == 8: c = WD[1]
            if x in (3, 12): c = IR[4] if y < 8 else IR[3]
            if y == 14: c = WD[1]
            cv.px(x, y, c)
    for y in range(8, 12):
        for x in range(6, 10): cv.px(x, y, GLD[5] if x < 8 else GLD[4])
    cv.px(7, 10, GLD[1]); cv.px(6, 8, GLD[6])
    return shadow_under(fin(cv, .55), 8, 15, 7, 1.2, 70)


def weapon_rack_grey(seed=0):
    """창·검 걸이 2×2(32x32): 나무 틀(윗 가로대 윗면 + 앞면)에 창 셋·검 둘, 가운데 푸른 방패(버들항 방패 그림). 아래 2줄 막힘."""
    cv = Cv(32, 32)
    for (x, top) in ((5, 3), (10, 1), (26, 2)):                       # 창
        for y in range(top + 3, 29): cv.px(x, y, WD[4]); cv.px(x + 1, y, WD[2])
        for y in range(top, top + 4):
            hw = (y - top + 1) // 2
            for xx in range(x - hw, x + hw + 2): cv.px(xx, y, IR[5] if xx <= x else IR[3])
    for (x, top) in ((15, 8), (21, 7)):                               # 검
        for y in range(top, 26): cv.px(x, y, IR[5]); cv.px(x + 1, y, IR[3])
        for xx in range(x - 2, x + 4): cv.px(xx, 26, GLD[4] if xx < x + 1 else GLD[3])
        cv.px(x, 27, WD[3]); cv.px(x, 28, WD[2]); cv.px(x, 29, GLD[4])
    for y in range(9, 12):                                            # 위 가로대(윗면 1 + 앞면 2)
        for x in range(2, 30): cv.px(x, y, WD[5] if y == 9 else (WD[3] if x < 28 else WD[2]))
    for y in range(24, 31):                                           # 아래 받침(윗면 2 + 앞면)
        for x in range(1, 31): cv.px(x, y, WD[5] if y < 26 else (WD[3] if x < 29 else WD[2]) if y < 30 else WD[1])
    im = fin(cv, .55)
    im.alpha_composite(C6.shield(), (11, 13))
    return shadow_under(im, 16, 31, 15, 1.4, 70)


def guard_table(seed=0):
    """경비 탁자 2×2(32x32): 널 윗면 탁자 위에 쇠 잔 둘·빵·주사위, 앞에 둥근 의자 둘. 아래 2줄 막힘."""
    cv = Cv(32, 32)
    for y in range(6, 22):
        for x in range(2, 30):
            if y < 16:
                k = 5 if (y == 6 or x == 2) else 4
                if (x - 2) % 7 == 6: k = 3
                if x >= 28: k = 3
            else:
                k = 3 if x < 27 else 2
                if y == 16: k = 2
                if y == 21: k = 1
            cv.px(x, y, WD[clamp(k)])
    for (x0, y0) in ((3, 21), (26, 21)):
        for y in range(y0, y0 + 6): cv.px(x0, y, WD[3]); cv.px(x0 + 1, y, WD[2])
    for (cx, cy) in ((8, 10), (22, 11)):                              # 잔
        for y in range(cy - 3, cy + 1):
            for x in range(cx - 1, cx + 2): cv.px(x, y, IR[4] if x < cx + 1 else IR[2])
        cv.px(cx, cy - 3, (150, 110, 60)); cv.px(cx + 2, cy - 2, IR[3])
    for (x, y) in ((14, 9), (15, 9), (16, 9), (13, 10), (14, 10), (15, 10), (16, 10), (17, 10)): cv.px(x, y, (196, 150, 84) if y == 9 else (150, 104, 54))   # 빵
    cv.px(18, 13, CRM[6]); cv.px(19, 13, CRM[5]); cv.px(18, 14, CRM[4]); cv.px(19, 14, CRM[3]); cv.px(19, 12, ST[1])
    for cx in (9, 23):                                                # 둥근 의자
        topell(cv, cx, 26, 3.6, 1.6, WD, 5, 4, seed)
        for y in range(27, 31): cv.px(cx - 2, y, WD[3]); cv.px(cx + 2, y, WD[2])
    return shadow_under(fin(cv, .55), 16, 30.5, 15, 1.6, 70)


def armor_steel(seed=0):
    """판금 갑옷 장식 1×2(16x32): 받침 위 은빛 갑옷, 푸른 투구 깃·푸른 허리띠, 앞에 짚은 검. 아랫줄만 막힘."""
    cv = Cv(16, 32); mk = Mk(16, 32)
    mk.rect(5, 19, 8, 27); mk.rect(9, 19, 12, 27)
    mk.poly([(4, 16), (12, 16), (13, 20), (3, 20)])
    mk.rect(4, 9, 13, 17)
    mk.ell(4.2, 10.4, 2.4, 2.0); mk.ell(11.8, 10.4, 2.4, 2.0)
    mk.ell(8, 6, 3.2, 3.4)
    vol(cv, mk, IR, 2, 14, 4, seed, grain=.05)
    for y in range(32):
        for x in range(16):
            if mk.at(x, y) and not mk.at(x - 1, y): cv.px(x, y, IR[5])
    for y in range(19, 27): cv.px(8, y, IR[1])
    stone_box(cv, 2, 27, 14, 32, 2, ST, seed)
    for y in range(9, 16): cv.px(8, y, IR[5] if y < 12 else IR[4])
    for x in range(4, 13): cv.px(x, 16, SL[4] if x < 9 else SL[3])
    for x in range(6, 11): cv.px(x, 6, IR[0])
    for (x, y) in ((7, 2), (8, 1), (9, 0), (10, 0), (11, 1), (12, 2), (12, 3), (13, 4), (13, 5)): cv.px(x, y, SL[5] if x < 10 else SL[4])
    for (x, y) in ((8, 2), (9, 1), (10, 1), (11, 2), (12, 4)): cv.px(x, y, SL[3])
    for y in range(14, 27): cv.px(8, y, IR[5] if y < 22 else IR[4])
    for x in range(6, 11): cv.px(x, 14, GLD[4] if x < 8 else GLD[3])
    cv.px(8, 12, GLD[5]); cv.px(8, 13, GLD[3])
    return shadow_under(fin(cv, .5), 8, 31, 7, 1.4, 80)


def stone_bench(seed=0):
    """돌 벤치 2×1(32x16): 두 다리 받침 위 두꺼운 마름돌 좌판(윗면 + 앞 두께). 막힘 1줄. 홀 기둥 사이 벽가에."""
    cv = Cv(32, 16)
    for y in range(4, 10):
        for x in range(1, 31):
            k = 6 if (y == 4 or x == 1) else 5
            if x >= 29: k = 4
            if y >= 8: k = 4 if x < 28 else 3
            if y == 9: k = 3
            if (x - 1) % 15 == 14 and y < 8: k = 4
            if _hash(x, y, seed + 6) < .05: k -= 1
            cv.px(x, y, ST[clamp(k)])
    for (x0, x1) in ((4, 9), (22, 27)):
        for y in range(10, 15):
            for x in range(x0, x1): cv.px(x, y, ST[4] if x < x0 + 2 else (ST[3] if x < x1 - 1 else ST[2]))
        for x in range(x0, x1): cv.px(x, 15, ST[1])
    for x in range(9, 22): cv.px(x, 10, ST[2])
    return shadow_under(fin(cv, .58), 16, 15, 15, 1.3, 70)
