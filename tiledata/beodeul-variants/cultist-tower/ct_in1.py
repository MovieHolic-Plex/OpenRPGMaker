# 신도의 탑 조각 2 — 1층 홀·2층 기도실·감방: 교단 휘장, 홀 제단, 해골 촛대, 해골 초, 벽 가면, 가면 걸이, 두건 겉옷 걸이, 신도 긴 의자,
# 무릎 방석, 의식용 항아리, 보라 불 화로, 보라 벽 촛대, 벽 쇠사슬, 바닥 쇠사슬, 감방 쇠창살 문, 짚 더미, 감방 양동이, 감방 뼈, 널 침상,
# 기도실 우상 돌기둥, 공물 그릇. 손 도트(Pillow), 버들항 7단 램프. 3/4 시점(윗면+앞면), 빛 왼쪽 위.
from ct_kit import *
from ct_kit import _hash


def cult_tapestry(seed=0):
    """교단 휘장 2×3(벽 앞면 장식, 32x48): 금 막대에 건 보라 천, 검붉은 테두리 띠, 가운데 큰 눈 문장과 아래 세 갈래 빛, 아래 술."""
    W, H = 32, 48; cv = Cv(W, H)
    for x in range(1, 31): cv.px(x, 3, GLD[5] if x < 16 else GLD[4]); cv.px(x, 4, GLD[2])
    cv.px(0, 3, GLD[3]); cv.px(31, 3, GLD[2])
    for y in range(5, 43):
        for x in range(4, 28):
            lx = x - 4
            k = 4
            ph = (lx + (y // 9)) % 6
            if ph < 1: k = 5
            elif ph >= 5: k = 3
            if lx == 0: k = 5
            if lx == 23: k = 2
            c = VIO[clamp(k, 0, 6)]
            if lx in (1, 2) or lx in (21, 22): c = CRIM[4] if lx in (1, 21) else CRIM[3]
            if y in (7, 8) or y in (39, 40): c = CRIM[4] if y in (7, 39) else CRIM[2]
            cv.px(x, y, c)
    for x in range(4, 28):                                                         # 아래 술
        if x % 2 == 0:
            for y in range(43, 46): cv.px(x, y, GLD[4] if y < 45 else GLD[3])
    ecv = Cv(W, H)
    eye_emblem(ecv, 16, 21, 13, BONE[4], CRIM[4], VIO[0])
    cv.im.alpha_composite(ecv.im)
    for (x, y) in ((15, 21), (16, 21), (15, 20), (16, 20)): cv.px(x, y, VIO[0])
    cv.px(14, 20, BONE[4])
    return fin(cv, .55)


def hall_altar(seed=0):
    """홀 제단 3×2(48x32): 두 단 마름돌 제단(윗면+앞면), 앞으로 드리운 검붉은 천에 눈 문장, 위에 해골·검은 그릇·굵은 초 넷. 아래 2줄 막힘."""
    W, H = 48, 32; cv = Cv(W, H)
    stone_box(cv, 0, 22, 48, 32, 3, CS, seed + 1)                                  # 아래 단
    stone_box(cv, 3, 6, 45, 24, 8, CS, seed)                                       # 제단 몸
    for y in range(6, 23):                                                         # 천
        for x in range(13, 35):
            if y > 20 and (x % 3 == 1): continue
            k = 4 if (x - 13) % 5 < 2 else 3
            if y < 9: k = 5
            if x in (13, 34): k = 2
            cv.px(x, y, CRIM[k])
    for x in range(13, 35): cv.px(x, 14, GLD[4] if x % 2 else GLD[3])
    eye_emblem(cv, 24, 17, 7, BONE[3], VIO[3], CRIM[0])
    skull(cv, 24, 4, .95, seed)
    for y in range(4, 8):                                                          # 검은 그릇(왼쪽)
        for x in range(7, 13): cv.px(x, y, IR[2] if x < 10 else IR[1])
    for x in range(7, 13): cv.px(x, 4, IR[3])
    for (cx_, h) in ((4, 7), (16, 5), (31, 5), (42, 7)): candle(cv, cx_, 9 if cx_ in (4, 42) else 7, h, seed=seed + cx_)
    return shadow_under(fin(cv, .55), 24, 31, 22, 1.6, 80)


def skull_candelabra(seed=0):
    """해골 촛대 1×2(16x32): 쇠 세 갈래 촛대 기둥, 받침 위 해골, 보라 불꽃 초 셋, 흘러내린 촛농. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(9, 25): cv.px(7, y, IR[4]); cv.px(8, y, IR[2])
    for x in range(2, 14): cv.px(x, 10, IR[4] if x < 8 else IR[3])
    for x in (2, 13): cv.px(x, 9, IR[3])
    for (cx_, top) in ((2, 4), (7, 2), (13, 4)):
        for y in range(top, 9):
            cv.px(cx_, y, CRM[6] if cx_ < 8 else CRM[5]); cv.px(cx_ + (1 if cx_ < 13 else -1), y, CRM[4])
        flame(cv, cx_, top - 1, 3, PF, seed + cx_, 1)
    cv.px(3, 9, CRM[5]); cv.px(12, 8, CRM[4])
    skull(cv, 8, 25, 1.0, seed)
    for x in range(3, 13): cv.px(x, 30, IR[3] if x < 8 else IR[2])
    for x in range(2, 14): cv.px(x, 31, IR[1])
    return shadow_under(fin(cv, .5), 8, 31, 6, 1.2, 70)


def skull_candle(seed=0):
    """해골 초 1×1(바닥 장식, 걷기): 바닥에 놓은 해골 위에 녹아내린 초, 보라 불꽃."""
    cv = Cv(16, 16)
    skull(cv, 8, 10, .9, seed)
    for y in range(4, 8): cv.px(7, y, CRM[6]); cv.px(8, y, CRM[4])
    for (x, y) in ((6, 8), (9, 8), (9, 9), (5, 9)): cv.px(x, y, CRM[5])
    flame(cv, 7, 3, 3, PF, seed, 1)
    return fin(cv, .5)


def mask_face(cv, cx, cy, seed=0, tone=None):
    """의식 가면(표정 없는 매끈한 갸름한 탈): 흰 바탕 + 아몬드 눈구멍 둘 + 이마의 검붉은 줄, 턱 끝."""
    tone = tone or [BONE[1], BONE[2], BONE[3], BONE[4]]
    for y in range(cy - 5, cy + 6):
        for x in range(cx - 4, cx + 5):
            dx = (x + .5 - cx) / 4.4; dy = (y + .5 - cy) / 5.6
            if dy > 0: dx *= 1 + dy * .5
            if dx * dx + dy * dy > 1: continue
            k = 3 if dx < -.15 else 2
            if dy < -.55: k = 3
            if dx > .55: k = 1
            cv.px(x, y, tone[k])
    for ox in (-2, 1):
        cv.px(cx + ox, cy - 1, VIO[0]); cv.px(cx + ox + 1, cy - 1, VIO[0]); cv.px(cx + ox + (1 if ox > 0 else 0), cy, VIO[1])
    for y in range(cy - 5, cy - 2): cv.px(cx, y, CRIM[3])
    cv.px(cx, cy + 3, tone[1])


def wall_mask(seed=0, red=False):
    """벽 가면 1×1(벽 앞면 장식): 쇠못에 걸린 표정 없는 흰 의식 가면(red = 검붉은 칠 가면)."""
    cv = Cv(16, 16)
    tone = [CRIM[1], CRIM[2], CRIM[4], CRIM[5]] if red else None
    cv.px(8, 1, IR[3]); cv.px(7, 2, IR[2]); cv.px(9, 2, IR[2])
    mask_face(cv, 8, 8, seed, tone)
    return fin(cv, .5)


def mask_rack(seed=0):
    """가면 걸이 2×2(32x32): 짙은 나무 틀 가로대 둘에 걸린 가면 다섯(흰·검붉은·보라). 아래 2줄 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for x0 in (2, 28):
        for y in range(2, 31): cv.px(x0, y, EBW[4]); cv.px(x0 + 1, y, EBW[2])
    for yb in (4, 18):
        for x in range(1, 31): cv.px(x, yb, EBW[5] if x < 16 else EBW[4]); cv.px(x, yb + 1, EBW[2])
    tones = [None, [CRIM[1], CRIM[2], CRIM[4], CRIM[5]], [VIO[1], VIO[2], VIO[4], VIO[5]]]
    for i, (cx_, cy_) in enumerate(((9, 10), (16, 10), (23, 10), (12, 24), (20, 24))):
        mask_face(cv, cx_, cy_, seed + i, tones[(i + seed) % 3])
    for x in range(1, 7): cv.px(x, 31, EBW[1])
    for x in range(26, 32): cv.px(x, 31, EBW[1])
    return shadow_under(fin(cv, .55), 16, 31, 14, 1.4, 70)


def robe_rack(seed=0):
    """두건 겉옷 걸이 2×2(32x32): 쇠관 걸이 틀에 걸린 검은 두건 겉옷 둘과 보라 띠 겉옷 하나(빈 옷, 사람 없음). 아랫줄만 막힘."""
    W, H = 32, 32; cv = Cv(W, H)
    for x in range(2, 30): cv.px(x, 3, IR[4] if x < 16 else IR[3])
    for x0 in (2, 29):
        for y in range(3, 30): cv.px(x0, y, IR[3] if x0 == 2 else IR[2])
    for x in range(0, 6): cv.px(x, 30, IR[2])
    for x in range(26, 32): cv.px(x, 30, IR[1])
    BLKR = [DK, (24, 20, 30), (34, 28, 42), (46, 38, 56), (60, 50, 72), (76, 64, 90), (96, 82, 112)]
    for i, (cx_, ramp) in enumerate(((9, BLKR), (16, VIO), (23, BLKR))):
        for y in range(4, 27):
            hw = 3 if y < 9 else min(6, 3 + (y - 9) // 3)
            for x in range(cx_ - hw, cx_ + hw + 1):
                dx = (x - cx_) / max(1, hw)
                k = 4 if dx < -.3 else (3 if dx < .4 else 2)
                if y < 9:                                                          # 두건(뾰족한 머리)
                    if abs(x - cx_) > (y - 3) * .8: continue
                    k += 1 if dx < 0 else 0
                    if 6 <= y <= 8 and abs(x - cx_) <= 1: k = 0                    # 두건 속 어둠(얼굴 없음)
                if (x + y) % 5 == 0 and y > 12: k -= 1                             # 주름
                cv.px(x, y, ramp[clamp(k, 0, 6)])
        if ramp is BLKR:
            for x in range(cx_ - 4, cx_ + 5): cv.px(x, 14, VIO[4] if x < cx_ else VIO[3])
        else:
            for x in range(cx_ - 4, cx_ + 5): cv.px(x, 14, GLD[4] if x < cx_ else GLD[3])
    return shadow_under(fin(cv, .55), 16, 31, 13, 1.3, 70)


def cult_pew(seed=0, w=3):
    """신도 긴 의자 3×1(48x16): 그을린 짙은 나무 좌판(윗면) + 앞면 다리 셋, 낮은 등받이 막대, 좌판에 펼친 기도서 하나. 막힘 1줄."""
    W, H = 16 * w, 16; cv = Cv(W, H)
    for y in range(1, 4):                                                          # 등받이(뒤, 북쪽)
        for x in range(1, W - 1): cv.px(x, y, EBW[4] if y == 1 else EBW[2])
    for y in range(4, 10):                                                         # 좌판 윗면
        for x in range(1, W - 1):
            c = EBW[5] if y == 4 else (EBW[4] if (x + y // 2) % 9 else EBW[3])
            if x >= W - 3: c = EBW[3]
            cv.px(x, y, c)
    for y in range(10, 12):
        for x in range(1, W - 1): cv.px(x, y, EBW[2])
    for lx in (2, W // 2, W - 4):
        for y in range(12, 16): cv.px(lx, y, EBW[3]); cv.px(lx + 1, y, EBW[1])
    bx = 6 + int(_hash(seed, 1, 3) * (W - 18))                                     # 기도서
    for y in range(5, 8):
        for x in range(bx, bx + 6): cv.px(x, y, CRM[5] if x < bx + 3 else CRM[4])
    cv.px(bx + 2, 5, VIO[2]); cv.px(bx + 3, 5, VIO[2])
    return fin(cv, .55)


def kneel_cushion(seed=0):
    """무릎 방석 1×1(바닥 장식, 걷기): 금 술 달린 낡은 보라 방석, 가운데 눌린 자국."""
    cv = Cv(16, 16)
    for y in range(5, 14):
        for x in range(2, 14):
            dx = (x + .5 - 8) / 6.2; dy = (y + .5 - 9.5) / 4.6
            if dx * dx + dy * dy > 1.15 or abs(dx) > 1 or abs(dy) > 1: continue
            k = 5 if dy < -.4 else (4 if dx < .3 else 3)
            if dy > .55: k = 2
            if abs(dx) < .35 and abs(dy) < .3: k = 3
            cv.px(x, y, VIO[k])
    for (x, y) in ((2, 6), (13, 6), (2, 13), (13, 13)): cv.px(x, y, GLD[4])
    return shadow_under(fin(cv, .5), 8, 13.6, 6, 1.2, 50)


def ritual_urn(seed=0, small=False):
    """의식용 항아리 1×2 / 작은 항아리 1×1: 배부른 검은 유약 항아리, 검붉은 띠와 눈 문장, 밀랍 봉인 뚜껑."""
    H = 16 if small else 32; cv = Cv(16, H)
    BLKG = [DK, (22, 18, 26), (34, 28, 40), (50, 42, 58), (70, 60, 80), (96, 86, 108), (132, 122, 144)]
    cy_ = H - 7 if small else H - 11; ry_ = 5 if small else 9; rx_ = 5 if small else 6.5
    mk = Mk(16, H); mk.ell(8, cy_, rx_, ry_); mk.rect(8 - (2 if small else 3), cy_ - ry_ - (2 if small else 4), 8 + (2 if small else 3), cy_ - ry_ + 2)
    vol(cv, mk, BLKG, None, None, 3, seed, grain=.05)
    for x in range(1, 15):                                                         # 검붉은 띠
        for y in (cy_ - 1, cy_):
            if mk.at(x, y): cv.px(x, y, CRIM[4] if x < 8 else CRIM[2])
    if not small: eye_emblem(cv, 8, cy_ + 4, 5, BONE[3], CRIM[3], VIO[0])
    ty = cy_ - ry_ - (2 if small else 4)
    topell(cv, 8, ty, 3.2 if small else 4.2, 1.3, CRIM, 5, 3, seed)              # 밀랍 봉인
    for x in range(6, 11): cv.px(x, ty + 1, BLKG[2])
    if small: cv.px(8, ty - 1, CRIM[5])
    return shadow_under(fin(cv, .55), 8, H - 1, 5.5, 1.2, 70)


def brazier_purple(seed=0):
    """보라 불 화로 1×2(16x32): 세 다리 검은 쇠 받침의 둥근 그릇에서 타오르는 보라 불(교단의 불). 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for (x0, y0, x1, y1) in ((4, 20, 2, 31), (12, 20, 14, 31), (8, 21, 8, 30)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i // n; y = y0 + (y1 - y0) * i // n
            cv.px(x, y, IR[3] if x <= 8 else IR[2])
    for x in range(4, 13): cv.px(x, 27, IR[2])
    for y in range(17, 22):
        hw = 7 - max(0, y - 19)
        for x in range(8 - hw, 8 + hw): cv.px(x, y, IR[clamp(cyl_k(x, 8 - hw, 8 + hw) - 1, 1, 5)])
    for x in range(2, 14, 3): cv.px(x, 19, CRIM[3])                               # 그릇 둘레 붉은 점
    topell(cv, 8, 16.5, 7, 2.2, IR, 5, 3, seed)
    for x in range(3, 13):
        for y in (16, 17):
            if ((x - 8) / 5.5) ** 2 + ((y + .5 - 16.5) / 1.4) ** 2 <= 1: cv.px(x, y, PF[1] if (x + y) % 3 else PF[3])
    flame(cv, 8, 15, 12, PF, seed + 3, 4)
    flame(cv, 5, 15, 6, PF, seed + 4, 1); flame(cv, 11, 15, 7, PF, seed + 5, 1)
    return shadow_under(fin(cv, .55), 8, 31, 6, 1.4, 70)


def sconce_purple(seed=0):
    """보라 벽 촛대 1×1(벽 앞면 장식): 쇠 벽판·접시에 굵은 검은 초, 보라 불꽃."""
    cv = Cv(16, 16)
    for y in range(9, 15): cv.px(8, y, IR[3]); cv.px(9, y, IR[2])
    for x in range(5, 12): cv.px(x, 9, IR[4] if x < 8 else IR[3])
    for x in range(6, 11): cv.px(x, 10, IR[2])
    for y in range(5, 9): cv.px(7, y, (64, 56, 72)); cv.px(8, y, (46, 40, 54)); cv.px(9, y, (32, 28, 40))
    flame(cv, 8, 4, 4, PF, seed, 1)
    return fin(cv, .5)


def chains_wall(seed=0):
    """벽 쇠사슬 1×2(벽 앞면 장식): 벽 고리에서 늘어진 쇠사슬 둘과 끝의 수갑 쇠고리."""
    cv = Cv(16, 32)
    for (x0, n) in ((4, 22), (11, 17)):
        cv.px(x0 - 1, 2, IR[4]); cv.px(x0, 2, IR[4]); cv.px(x0 + 1, 2, IR[2]); cv.px(x0, 3, IR[1])
        for i in range(n):
            y = 4 + i; cx_ = x0 + (1 if (i // 2) % 2 else 0) * (1 if i < n - 4 else 0)
            if i % 2 == 0: cv.px(cx_, y, IR[4]); cv.px(cx_ + 1, y, IR[2])
            else: cv.px(cx_, y, IR[3])
        yb = 4 + n
        for (dx, dy) in ((-2, 0), (-2, 1), (-1, 2), (0, 2), (1, 2), (2, 1), (2, 0), (-1, -1), (1, -1)): cv.px(x0 + dx, yb + dy, IR[4] if dx < 0 else IR[2])
    return fin(cv, .5)


def chain_floor(seed=0):
    """바닥 쇠사슬 2×1(바닥 장식, 걷기): 바닥 쇠고리에 박힌 사슬이 구불구불 늘어져 끝에 족쇄."""
    cv = Cv(32, 16)
    topell(cv, 4, 8, 2.6, 1.6, IR, 5, 3, seed); cv.px(4, 8, IR[0])
    for i in range(22):
        x = 6 + i; y = 9 + int(round(1.6 * math.sin(i / 3.0)))
        if i % 2 == 0: cv.px(x, y, IR[4]); cv.px(x, y + 1, IR[2])
        else: cv.px(x, y, IR[3])
    for (dx, dy) in ((0, -2), (1, -2), (2, -1), (2, 0), (2, 1), (1, 2), (0, 2), (-1, 1), (-1, -1)): cv.px(28 + dx, 9 + dy, IR[4] if dy < 0 else IR[2])
    return fin(cv, .5)


def cell_gate(seed=0):
    """감방 쇠창살 문 1×2(16x32, 걷기 — 잠긴 문 이벤트): 위아래 가로 띠 사이 굵은 쇠창살 넷, 가운데 자물쇠 판과 고리."""
    cv = Cv(16, 32)
    for x in range(0, 16):
        for y in (6, 7, 30, 31): cv.px(x, y, IR[4] if y in (6, 30) else IR[2])
    for bx in (1, 5, 9, 13):
        for y in range(4, 30):
            cv.px(bx, y, IR[4]); cv.px(bx + 1, y, IR[2])
        cv.px(bx, 3, IR[5]); cv.px(bx + 1, 3, IR[3])                               # 창살 끝 뾰족
    for y in range(15, 21):
        for x in range(9, 14): cv.px(x, y, IR[3] if x < 12 else IR[2])
    cv.px(11, 17, IR[0]); cv.px(11, 18, IR[0])
    for (x, y) in ((10, 13), (11, 12), (12, 13)): cv.px(x, y, GLD[4])
    return fin(cv, .5)


def bars_cell(m, N, E, S, W):
    """감방 쇠창살(위층, 막힘) 16변형: 가로 줄 = 위아래 가로 띠 + 굵은 세로 창살 셋(끝 뾰족), 세로 줄 = 위에서 본 띠,
    끝·모서리에는 네모 쇠기둥."""
    cv = Cv(16, 16)
    hz = E or W; vt = N or S
    if hz or m == 0:
        xa = 0 if W else 5; xb = 16 if E else 11
        for x in range(xa, xb):
            cv.px(x, 1, IR[4]); cv.px(x, 2, IR[2]); cv.px(x, 14, IR[4]); cv.px(x, 15, IR[1])
            if x % 5 in (1, 2):
                for y in range(0, 15): cv.px(x, y, IR[4] if x % 5 == 1 else IR[2])
    if vt:
        ya = 0 if N else 5; yb = 16 if S else 11
        for y in range(ya, yb):
            cv.px(6, y, IR[4]); cv.px(7, y, IR[3]); cv.px(8, y, IR[3]); cv.px(9, y, IR[1])
            if y % 4 == 0: cv.px(7, y, IR[5]); cv.px(8, y, IR[4])
    straight = (m == 10) or (m == 5)
    if not straight:
        for y in range(0, 16):
            for x in range(5, 11): cv.px(x, y, IR[5] if (y == 0 or x == 5) else (IR[4] if x < 8 else (IR[3] if x < 10 else IR[1])))
        for x in range(5, 11): cv.px(x, 4, IR[2])
    return pz.fin(cv.im, .6)
def bars_sheet():
    from gc_kit import autotile_sheet
    return autotile_sheet(bars_cell)


def straw_pile(seed=0):
    """짚 더미 2×1(바닥 장식, 걷기): 감방 바닥에 깐 눅눅한 짚 더미와 흩어진 지푸라기."""
    cv = Cv(32, 16)
    for y in range(3, 15):
        for x in range(1, 31):
            dx = (x + .5 - 15) / 13.5; dy = (y + .5 - 10) / 4.8
            if dx * dx + dy * dy > 1: continue
            k = 4 if (x * 3 + y * 7) % 5 < 2 else 3
            if dy < -.5: k = 5
            if dy > .55: k = 2
            if _hash(x, y, seed + 4) < .15: k += 1
            cv.px(x, y, GD[clamp(k)])
    for i in range(8):
        x = 2 + int(_hash(i, 0, seed) * 28); y = 3 + int(_hash(i, 1, seed) * 11)
        cv.px(x, y, GD[5]); cv.px(x + 1, y, GD[4])
    return fin(cv, .5)


def cell_bucket(seed=0):
    """감방 양동이 1×1: 쇠테 두른 낡은 나무 양동이와 굽은 손잡이. 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(6, 15):
        hw = 5 - (y - 6) // 5
        for x in range(8 - hw, 8 + hw):
            k = cyl_k(x, 8 - hw, 8 + hw) - 1
            c = EBW[clamp(k)]
            if y in (8, 13): c = IR[3] if x < 8 else IR[2]
            cv.px(x, y, c)
    topell(cv, 8, 6, 5, 1.6, EBW, 4, 2, seed)
    for x in range(4, 13): cv.px(x, 6, (40, 46, 40))
    for (x, y) in ((3, 4), (4, 2), (6, 1), (8, 1), (10, 1), (12, 2), (13, 4)): cv.px(x, y, IR[3])
    return shadow_under(fin(cv, .55), 8, 15, 5, 1, 70)


def cell_bones(seed=0):
    """감방 뼈 1×1(바닥 장식, 걷기): 벽가에 쌓인 해골 하나와 긴 뼈 둘."""
    cv = Cv(16, 16)
    for (x0, y0, x1, y1) in ((1, 13, 9, 11), (6, 14, 14, 14)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i // n; y = y0 + (y1 - y0) * i // n
            cv.px(x, y, BONE[3]); cv.px(x, y + 1, BONE[1])
    skull(cv, 10, 7, .85, seed)
    return fin(cv, .5)


def plank_bed(seed=0):
    """널 침상 2×1(32x16): 벽에 붙인 짧은 다리 나무 침상과 해진 담요. 막힘 1줄."""
    cv = Cv(32, 16)
    for y in range(2, 11):
        for x in range(1, 31):
            c = EBW[5] if y == 2 else (EBW[4] if (y // 3) % 2 else EBW[3])
            if x >= 29: c = EBW[3]
            cv.px(x, y, c)
    for y in range(11, 13):
        for x in range(1, 31): cv.px(x, y, EBW[2])
    for lx in (2, 27):
        for y in range(13, 16): cv.px(lx, y, EBW[3]); cv.px(lx + 1, y, EBW[1])
    for y in range(3, 10):
        for x in range(12, 28):
            k = 4 if (x + y) % 4 < 2 else 3
            if y == 3: k = 5
            cv.px(x, y, mix(VIO[k], GD[k], .45))
    return fin(cv, .55)


def prayer_idol(seed=0):
    """기도실 우상 돌기둥 2×3(32x48): 두 단 받침 위 사면 깎은 검은 돌기둥, 앞면에 새겨 빛나는 큰 눈, 꼭대기 뿔 모양 돌 장식,
    받침에 공물 그릇과 초. 받침 줄(아래 1줄)만 막힘."""
    W, H = 32, 48; cv = Cv(W, H)
    BLKS = [DK, (26, 22, 32), (38, 32, 46), (54, 46, 64), (74, 64, 86), (98, 88, 112), (128, 118, 144)]
    stone_box(cv, 1, 38, 31, 48, 4, CS, seed)
    stone_box(cv, 5, 32, 27, 40, 3, CS, seed + 1)
    mk = Mk(W, H); mk.poly([(9, 9), (23, 9), (22, 33), (10, 33)])
    vol(cv, mk, BLKS, 9, 23, 4, seed, grain=.05)
    for y in range(9, 12):
        for x in range(9, 23): cv.px(x, y, BLKS[5] if y == 9 else BLKS[4])
    for (pts) in ([(9, 9), (7, 4), (6, 1), (10, 6), (12, 9)], [(23, 9), (25, 4), (26, 1), (22, 6), (20, 9)]):   # 뿔 장식
        m2 = Mk(W, H); m2.poly(pts); vol(cv, m2, BLKS, None, None, 4, seed + 9, grain=.05)
    for y in range(14, 30, 4):
        for x in range(10, 22): cv.px(x, y, BLKS[2])
    eye_emblem(cv, 16, 20, 9, PF[3], PF[1], VIO[0])
    for (x, y) in ((15, 20), (16, 20)): cv.px(x, y, PF[4])
    for y in range(34, 37):                                                        # 공물 그릇
        for x in range(12, 20): cv.px(x, y, IR[3] if x < 16 else IR[2])
    for x in range(12, 20): cv.px(x, 33, CRIM[3])
    candle(cv, 7, 37, 4, seed=seed); candle(cv, 24, 37, 4, seed=seed + 1)
    return shadow_under(fin(cv, .55), 16, 47, 15, 1.6, 80)


def offering_bowl(seed=0):
    """공물 그릇 1×1: 짧은 돌 받침 위 넓은 쇠 그릇, 안에 검붉은 꽃잎과 뼈 조각. 막힘 1줄."""
    cv = Cv(16, 16)
    stone_box(cv, 5, 9, 11, 16, 2, CS, seed)
    for y in range(5, 9):
        hw = 7 - (y - 5)
        for x in range(8 - hw, 8 + hw): cv.px(x, y, IR[clamp(cyl_k(x, 8 - hw, 8 + hw) - 1, 1, 5)])
    topell(cv, 8, 4.6, 7, 1.8, IR, 5, 3, seed)
    for x in range(3, 13):
        if _hash(x, 4, seed) < .6: cv.px(x, 4, CRIM[4] if x % 2 else CRIM[2])
    cv.px(7, 4, BONE[3]); cv.px(8, 4, BONE[2])
    return shadow_under(fin(cv, .55), 8, 15.5, 5, 1, 70)
