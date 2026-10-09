# 탑 내부 조각 3: 꼭대기 방(제단·수정구 받침·장미창·발코니 아치·마법 고리·수정 무리·돌 화분), 나선 계단(오름/내림),
# 하늘·발코니 턱, 오토타일 3종(슬레이트 카펫·돌 난간·함정 구덩이). 손 도트, 버들항 램프. 3/4 시점, 빛 왼쪽 위.
from ti_kit import *
from ti_kit import _hash
from gc_kit import autotile_sheet


# ------------------------------------------------------------------ 꼭대기 방
def altar_summit(seed=0):
    """꼭대기 제단 3×2(48x32): 마름돌 제단(윗면+앞면 띠 무늬) 위에 금테 두른 푸른 천을 앞으로 드리우고, 가운데 은 그릇, 양 끝 굵은 초.
    아래 2줄 막힘. 앞 한 칸은 비운다."""
    W, H = 48, 32; cv = Cv(W, H)
    stone_box(cv, 2, 8, 46, 31, 9, ST, seed)
    for y in range(20, 30):                                            # 앞면 판 무늬(움푹한 판 둘)
        for x in (6, 7, 40, 41): cv.px(x, y, ST[3])
    for x in range(6, 42): cv.px(x, 20, ST[3]); cv.px(x, 29, ST[5])
    for y in range(8, 27):                                             # 푸른 천(윗면을 덮고 앞으로 드리움)
        for x in range(15, 33):
            if y < 17: c = SL[4] if (x < 18 or y == 8) else SL[3]
            else:
                if y > 23 and abs(x - 24) > (27 - y) * 3: continue
                c = SL[3] if x < 26 else SL[2]
                if y == 17: c = SL[2]
            if x in (15, 32): c = GLD[4]
            cv.px(x, y, c)
    for x in range(16, 32): cv.px(x, 26 - (0 if abs(x - 24) < 3 else 1), GLD[4]) if abs(x - 24) < 9 else None
    cv.px(24, 21, GLD[5]); cv.px(23, 22, GLD[4]); cv.px(25, 22, GLD[4]); cv.px(24, 23, GLD[3])
    topell(cv, 24, 11, 5.2, 2.0, IR, 6, 4, seed)                        # 은 그릇
    for x in range(20, 29): cv.px(x, 13, IR[2])
    cv.px(23, 11, BL[5]); cv.px(24, 11, BL[4]); cv.px(25, 11, BL[3])
    for cx in (7, 40):                                                 # 초
        for y in range(2, 12):
            cv.px(cx, y, CRM[6]); cv.px(cx + 1, y, CRM[5]); cv.px(cx + 2, y, CRM[3])
        for x in range(cx - 1, cx + 4): cv.px(x, 12, GLD[4] if x < cx + 2 else GLD[3])
        cv.px(cx + 1, 1, FL[3]); cv.px(cx + 1, 0, FL[4]); cv.px(cx, 1, FL[2])
    return shadow_under(fin(cv, .58), 24, 31, 22, 1.6, 80)


def crystal_pedestal(seed=0):
    """수정구 받침 1×2(16x32): 홈 새긴 짧은 돌기둥 위 금 발톱 받침에 얹은 빛나는 푸른 수정구. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    stone_box(cv, 2, 26, 14, 32, 2, ST, seed)
    for y in range(15, 26):
        for x in range(4, 12):
            k = cyl_k(x, 4, 12)
            if x in (6, 9): k -= 1
            cv.px(x, y, ST[clamp(k)])
    for y in range(12, 15):
        for x in range(2, 14): cv.px(x, y, ST[6] if y == 12 else (ST[5] if x < 11 else ST[3]))
    for (x, y) in ((4, 11), (5, 10), (11, 11), (10, 10), (7, 11), (8, 11)): cv.px(x, y, GLD[5] if x < 8 else GLD[4])
    for y in range(1, 11):                                             # 수정구
        for x in range(2, 14):
            dx = (x + .5 - 8) / 5.6; dy = (y + .5 - 6) / 5.2
            d = dx * dx + dy * dy
            if d > 1: continue
            k = 3
            if d < .55: k = 4
            if dx < -.15 and dy < -.1: k = 5
            if d > .82: k = 2
            if dx > .5 and dy > .3: k = 1
            cv.px(x, y, BL[k])
    cv.px(5, 3, BL[6]); cv.px(6, 3, BL[6]); cv.px(5, 4, BL[6]); cv.px(9, 7, BL[5])
    im = fin(cv, .5)
    return shadow_under(im, 8, 31, 7, 1.3, 70)


def rose_window(seed=0):
    """장미창 3×3(48x48, 앞면 장식): 둥근 마름돌 틀 속 여덟 갈래 돌살, 푸른·금·붉은 빛 유리. 앞면 3줄 위, 방 북쪽 벽 가운데."""
    W, H = 48, 48; cv = Cv(W, H)
    cx, cy, R = 24, 22, 19
    for y in range(H):
        for x in range(W):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
            if d > R + 3: continue
            if d > R:                                                  # 돌 틀
                k = 6 if (dx + dy) < -6 else (5 if (dx + dy) < 8 else 4)
                c = mix(C6.ash(x, y, bw=6, bh=5, seed=seed + 7), ST[k], .5); cv.px(x, y, c); continue
            spoke = abs(math.sin(a * 4)) * d < 1.3 and d > 4.5
            ring = abs(d - 10) < 1.1 or d < 4.2 and d > 3
            if spoke or ring:
                cv.px(x, y, ST[5] if dx < 0 else ST[4]); continue
            seg = int((a + math.pi) / (math.pi / 4)) % 8
            if d < 3: c = GLD[5]
            elif d < 10: c = [BL[4], GLD[4], BL[4], RD[4], BL[4], GLD[4], BL[4], RD[4]][seg]
            else: c = [BL[3], BL[5], BL[3], GLD[5], BL[3], BL[5], BL[3], GLD[5]][seg]
            if (x + y) % 5 == 0: c = mix(c, (255, 255, 255), .35)
            cv.px(x, y, c)
    for y in range(42, 47):                                            # 아래 받침 턱
        for x in range(10, 38): cv.px(x, y, ST[6] if y == 42 else (ST[5] if x < 30 else ST[4]) if y < 45 else ST[2])
    return fin(cv, .55)


def balcony_arch(seed=0):
    """발코니 아치 3×3(48x48, 걷기): 탑 바깥벽(발코니 쪽 앞면)에 뚫린 아치 문 — 윗줄은 벽 윗면 띠(걷기+가림), 아래 두 줄은 아치 틀이 두른 통로."""
    W, H = 48, 48; cv = Cv(W, H)
    x0, x1 = 5, 43; cx = 24; R = 19; ytop = 16
    def inside(x, y, pad=0):
        xx = x + .5; yy = y + .5
        if xx < x0 + pad or xx > x1 - pad: return False
        if yy < ytop + R * .6:
            return ((xx - cx) / (R - pad)) ** 2 + ((yy - ytop - R * .6) / (R * .6 - pad * .6)) ** 2 <= 1
        return True
    for y in range(H):
        for x in range(W):
            if y < 16:                                                 # 벽 윗면 띠(갓돌)
                c = dlib._band_px(x, y, seed, False, 3)
                if y == 0: c = ST[6]
                elif y == 15: c = DK
                elif y == 14: c = mix(c, DK, .3)
                cv.px(x, y, c); continue
            if inside(x, y): continue                                  # 통로: 바닥이 비친다
            if inside(x, y, -3):
                k = 6 if x < cx - 8 else (5 if x < cx + 8 else 4)
                cv.px(x, y, mix(C6.ash(x, y, bw=8, bh=6, seed=seed + 4), ST[k], .55))
            else:
                cv.px(x, y, dlib.face_px('tower', x + 4100, y - 16, 32, 3, False, False))
    for y in range(14, 19):
        for x in range(cx - 3, cx + 3): cv.px(x, y, ST[6] if x < cx else ST[5])
    return fin(cv, .55)


def rune_ring(seed=0):
    """마법 고리 3×3(48x48, 바닥 장식, 걷기): 바닥에 박은 금 두 겹 원과 여덟 꼭짓점 푸른 보석, 안쪽 엇갈린 사각 두 개(글자 없음)."""
    W, H = 48, 48; im = new(W, H); p = im.load()
    cx = cy = 24
    def put(x, y, c, a=255):
        if 0 <= x < W and 0 <= y < H: p[x, y] = tuple(c) + (a,)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if abs(d - 21) < .8: put(x, y, GLD[4] if (x + y) % 2 else GLD[5])
            elif abs(d - 18.5) < .6: put(x, y, GLD[3])
            elif 18.5 < d < 21 and (x * 3 + y) % 7 == 0: put(x, y, BL[5], 160)
    for i in range(2):                                                 # 엇갈린 사각
        ang = i * math.pi / 4
        pts = [(cx + 17 * math.cos(ang + k * math.pi / 2), cy + 17 * math.sin(ang + k * math.pi / 2)) for k in range(4)]
        for k in range(4):
            (xa, ya), (xb, yb) = pts[k], pts[(k + 1) % 4]
            n = int(max(abs(xb - xa), abs(yb - ya))) + 1
            for t in range(n + 1):
                x = int(round(xa + (xb - xa) * t / n)); y = int(round(ya + (yb - ya) * t / n))
                put(x, y, GLD[4] if i == 0 else BL[4])
    for k in range(8):
        a = k * math.pi / 4
        x = int(round(cx + 21 * math.cos(a) - .5)); y = int(round(cy + 21 * math.sin(a) - .5))
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)): put(x + dx, y + dy, BL[5] if dx + dy == 0 else BL[3])
    for (dx, dy) in ((-1, -1), (0, -1), (-1, 0), (0, 0)): put(cx + dx, cy + dy, BL[6] if dx + dy == -2 else BL[4])
    return im


def crystal_cluster(seed=0):
    """마력 수정 무리 1×2(16x32): 바닥 틈에서 솟은 푸른 수정 기둥 셋(빛 면/그늘 면). 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for (bx, top, w) in ((3, 12, 3), (8, 4, 4), (12, 16, 3)):
        for y in range(top, 30):
            hw = min(w, 1 + (y - top) // 2)
            for x in range(bx - hw, bx + hw + 1):
                k = 5 if x < bx else (3 if x == bx else 2)
                if y < top + 2: k = 6 if x <= bx else 4
                cv.px(x, y, BL[k])
        cv.px(bx - 1, top + 4, BL[6]); cv.px(bx - 1, top + 5, BL[6])
    for x in range(1, 15): cv.px(x, 30, ST[2]); cv.px(x, 29, ST[3]) if x % 3 else None
    im = fin(cv, .5)
    return shadow_under(im, 8, 30.5, 7, 1.4, 70)


def planter_box(seed=0):
    """돌 화분 2×1(32x16): 발코니 난간 안쪽에 두는 네모 돌 화분(윗면 테+흙)에 버들항 잎 램프 풀 포기와 흰·노란 꽃. 막힘 1줄."""
    cv = Cv(32, 16)
    stone_box(cv, 1, 7, 31, 16, 3, ST, seed)
    for y in range(8, 10):
        for x in range(3, 29): cv.px(x, y, WD[2] if (x + y) % 3 else WD[1])
    for i in range(16):
        x = 3 + int(_hash(i, 1, seed + 5) * 26); h = 2 + int(_hash(i, 2, seed + 5) * 5)
        for y in range(9 - h, 9): cv.px(x, y, LF[3] if y < 9 - h // 2 else LF[2]); cv.px(x + 1, y + 1, LF[1])
        cv.px(x, 8 - h, LF[5] if i % 4 else (CRM[6] if i % 8 else GLD[5]))
    return shadow_under(fin(cv, .55), 16, 15.5, 15, 1.2, 60)


# ------------------------------------------------------------------ 나선 계단
def _spiral(down, seed=0):
    """3/4 나선 계단: 바닥면 좌표의 쐐기 단을 높이 z 만큼 화면 위(오름)·아래(내림)로 밀어 뒤(북)에서 앞(남) 순서로 칠한다.
    단마다 밟판(밝음, 돌 결) + 앞 두께 챌판(어두움). 둘레 낮은 돌벽 고리(윗면 + 앞면, 남쪽 입구 틈), 가운데 기둥.
    오름: 고리를 먼저 깔고 단이 그 위로 쌓인다. 내림: 단이 구멍 속으로 내려가고 고리가 앞을 가린다."""
    W, H = 48, (48 if down else 64); cv = Cv(W, H)
    cx, cy = 24.0, (26.0 if down else 42.0); R = 20.5; r0 = 4.0; ry = .76
    n = 9; step = 3
    a0 = math.pi / 2 + .42; span = (1.12 if not down else 1.55) * math.pi
    if not down: n = 8
    GAP = .42
    def ring():
        for y in range(H):
            for x in range(W):
                dx = x + .5 - cx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                if abs(a - math.pi / 2) < GAP: continue
                if R - 2.6 <= d <= R + .4:
                    k = 6 if (dx + dy * 1.3) < -10 else (5 if (dx + dy * 1.3) < 8 else 4)
                    if d < R - 1.8: k -= 1
                    cv.px(x, y, ST[k])
        for y in range(H):
            for x in range(W):
                dx = x + .5 - cx; dy = (y + .5 - cy) / ry; d = math.hypot(dx, dy); a = math.atan2(dy, dx)
                if dy <= 0 or d <= R + .4 or abs(math.atan2((y - 3 + .5 - cy) / ry, dx) - math.pi / 2) < GAP: continue
                for k in range(1, 5):
                    d2 = math.hypot(dx, (y - k + .5 - cy) / ry)
                    if R - 2.6 <= d2 <= R + .4:
                        cv.px(x, y, (ST[4] if dx < -8 else (ST[3] if dx < 8 else ST[2])) if k < 4 else ST[1]); break
    if down:
        for y in range(H):
            for x in range(W):
                if math.hypot(x + .5 - cx, (y + .5 - cy) / ry) < R - 2.4: cv.px(x, y, dlib.VOID[0])
    else:
        ring()
    def draw_step(i):
        lo = a0 + span * i / n; hi = a0 + span * (i + 1) / n
        z = (i * step) if not down else -(i * step) - 1
        top = {}
        for py in range(-int(R) - 2, int(R) + 3):
            for pxx in range(-int(R) - 2, int(R) + 3):
                d = math.hypot(pxx + .5, py + .5)
                if d > R - 2.6 or d < r0 - .3: continue
                aa = (math.atan2(py + .5, pxx + .5) - lo) % (2 * math.pi)
                if aa > (hi - lo): continue
                sx = int(cx + pxx); sy = int(math.floor(cy + (py + .5) * ry - z))
                f = aa / (hi - lo)
                k = 5 if f > .25 else 4
                if f > .8: k = 6
                if d > R - 4: k -= 1
                if _hash(sx + i * 7, sy, seed + 3) < .07: k -= 1
                c = ST[clamp(k)]
                if down: c = mix(c, dlib.VOID[1], min(.8, .02 + i * .085))
                elif i >= n - 2: c = mix(c, dlib.VOID[1], .3 + (.25 if i == n - 1 else 0))
                top[(sx, sy)] = c
        depth = step if down else max(step, z + 1)          # 오름: 밟판 밑을 바닥까지 채운 돌 몸통(나선 덩어리)
        for (sx, sy), c in list(top.items()):
            for k in range(1, depth + 1):
                if (sx, sy + k) in top: break
                if down: rc = ST[2] if k < step else ST[1]
                else:
                    rc = mix(C6.ash(sx, sy + k, k=.62, bw=8, bh=6, seed=seed + 2), ST[3], .3)
                    if k <= 2: rc = ST[2]
                    if k == depth: rc = ST[1]
                if down: rc = mix(rc, dlib.VOID[0], min(.85, .08 + i * .085))
                cv.px(sx, sy + k, rc)
        for (sx, sy), c in top.items(): cv.px(sx, sy, c)
    mid = lambda i: math.sin(a0 + span * (i + .5) / n)
    back = sorted([i for i in range(n) if mid(i) <= 0], key=mid)
    front = sorted([i for i in range(n) if mid(i) > 0], key=mid)
    for i in back: draw_step(i)
    hcol = n * step + 3 if not down else 2
    x0c, x1c = int(cx - r0), int(cx + r0) + 1
    for y in range(int(cy - hcol), int(cy + r0 * ry) + 1):
        for x in range(x0c, x1c):
            dx = x + .5 - cx
            if abs(dx) > r0: continue
            if y + .5 > cy + math.sqrt(max(0, 1 - (dx / r0) ** 2)) * r0 * ry: continue
            k = cyl_k(x, x0c, x1c) - (1 if down else 0)
            c = ST[clamp(k)]
            if down: c = mix(c, dlib.VOID[1], .35)
            cv.px(x, y, c)
    topell(cv, cx, cy - hcol, r0 + .2, max(1.6, r0 * ry * .7), ST, 6, 4, seed)
    for i in front: draw_step(i)
    if down: ring()
    return fin(cv, .5)

def _spiral_up(seed=0):
    """3/4 나선 오름 계단(48x64): 둥근 돌 받침단(윗면 원판 + 앞면 4px) 위에 쐐기 단 8개가 서쪽→북쪽→동쪽으로 감아 오른다.
    단마다 밟판(밝음) + 밑을 받친 쌓은 돌 몸통, 가운데 기둥, 마지막 두 단은 위층으로 뚫린 어둠 속으로 사라진다."""
    W, H = 48, 64; cv = Cv(W, H)
    cx, cy = 24.0, 44.0; R = 21.0; r0 = 4.0; ry = .74
    n = 8; step = 3
    a0 = math.pi / 2 + .5; span = 1.25 * math.pi
    # 받침단: 앞면(아래로 4px) → 윗면 원판
    for y in range(H):
        for x in range(W):
            dx = x + .5 - cx
            for k in range(0, 5):
                dy = (y - k + .5 - cy) / ry
                if math.hypot(dx, dy) <= R:
                    if k == 0:
                        d = math.hypot(dx, dy)
                        kk = 5 if (dx + dy) < -6 else 4
                        if d > R - 1.3: kk = 6 if dy < 0 else 4
                        if _hash(x, y, seed + 21) < .06: kk -= 1
                        cv.px(x, y, ST[kk])
                    else:
                        cv.px(x, y, (ST[4] if dx < -8 else (ST[3] if dx < 8 else ST[2])) if k < 4 else ST[1])
                    break
    # 위층으로 뚫린 어둠(계단이 들어가는 천장 구멍): 북동쪽 위
    for y in range(0, 26):
        for x in range(22, 46):
            if ((x + .5 - 34) / 12.5) ** 2 + ((y + .5 - 12) / 11.5) ** 2 <= 1:
                cv.px(x, y, dlib.VOID[0] if _hash(x, y, 31) < .8 else dlib.VOID[1])
    def draw_step(i):
        lo = a0 + span * i / n; hi = a0 + span * (i + 1) / n
        z = (i + 1) * step
        top = {}
        for py in range(-int(R) - 2, int(R) + 3):
            for pxx in range(-int(R) - 2, int(R) + 3):
                d = math.hypot(pxx + .5, py + .5)
                if d > R - 2 or d < r0 - .3: continue
                aa = (math.atan2(py + .5, pxx + .5) - lo) % (2 * math.pi)
                if aa > (hi - lo): continue
                sx = int(cx + pxx); sy = int(math.floor(cy + (py + .5) * ry - z))
                f = aa / (hi - lo)
                k = 5 if f > .22 else 4
                if f > .8: k = 6
                if d > R - 3.5: k -= 1
                if _hash(sx + i * 7, sy, seed + 3) < .07: k -= 1
                c = ST[clamp(k)]
                if i >= n - 2: c = mix(c, dlib.VOID[1], .35 + (.3 if i == n - 1 else 0))
                top[(sx, sy)] = c
        for (sx, sy), c in list(top.items()):
            for k in range(1, z + 1):
                if (sx, sy + k) in top: break
                rc = mix(C6.ash(sx, sy + k, k=.66, bw=8, bh=5, seed=seed + 2), ST[3], .25)
                if k <= 2: rc = ST[2]
                if k == z: rc = ST[1]
                if i >= n - 2: rc = mix(rc, dlib.VOID[0], .45)
                cv.px(sx, sy + k, rc)
        for (sx, sy), c in top.items(): cv.px(sx, sy, c)
    mid = lambda i: math.sin(a0 + span * (i + .5) / n)
    back = sorted([i for i in range(n) if mid(i) <= 0], key=mid)
    front = sorted([i for i in range(n) if mid(i) > 0], key=mid)
    for i in back: draw_step(i)
    hcol = n * step + 6
    x0c, x1c = int(cx - r0), int(cx + r0) + 1
    for y in range(int(cy - hcol), int(cy + r0 * ry) + 1):
        for x in range(x0c, x1c):
            dx = x + .5 - cx
            if abs(dx) > r0: continue
            if y + .5 > cy + math.sqrt(max(0, 1 - (dx / r0) ** 2)) * r0 * ry: continue
            cv.px(x, y, ST[clamp(cyl_k(x, x0c, x1c))])
    topell(cv, cx, cy - hcol, r0 + .2, 1.8, ST, 6, 4, seed)
    for i in front: draw_step(i)
    return fin(cv, .5)

def spiral_stair_up(seed=0):
    """나선 오름 계단 3×4(48x64, 걷기): 둥근 돌 받침단 위 가운데 기둥을 돌아 서→북→동으로 오르는 쐐기 계단 8단(밑은 쌓은 돌 몸통).
    높은 단일수록 화면 위로 쌓이고, 마지막 두 단은 위층으로 뚫린 어둠 속으로 사라진다(맨 윗줄은 걷기+가림)."""
    return _spiral_up(seed)

def spiral_stair_down(seed=0):
    """나선 내림 계단 3×3(48x48, 걷기): 둥근 구멍 둘레 낮은 벽, 남쪽 입구에서 가운데 기둥을 돌아 내려가는 쐐기 계단 — 내려갈수록 어둠에 잠긴다."""
    return _spiral(True, seed)


# ------------------------------------------------------------------ 하늘·발코니 턱
def sky_px(X, Y):
    """발코니 너머 하늘: 위가 진하고 아래로 밝아지는 세 단 하늘(디더로 경계) + 둥근 덩이 구름(윗가 흰빛, 아래 그늘)."""
    t = Y / 416.0
    tt = t * 3 + (.5 if (X + Y) % 2 else 0) * .25
    c = SKY[1] if tt < 1.0 else (SKY[2] if tt < 2.0 else SKY[3])
    n = vnoise(X * .55, Y * 1.25, 22, 611) * .62 + vnoise(X, Y, 7, 612) * .38
    if n > .6:
        up = vnoise(X * .55, (Y - 3) * 1.25, 22, 611) * .62 + vnoise(X, Y - 3, 7, 612) * .38
        dn = vnoise(X * .55, (Y + 3) * 1.25, 22, 611) * .62 + vnoise(X, Y + 3, 7, 612) * .38
        c = SKY[5] if up <= .6 else (SKY[4] if dn > .6 else SKY[3])
        if up > .6 and dn > .6: c = SKY[4] if n < .7 else SKY[5]
    elif n > .57 and (X + Y) % 2 == 0: c = SKY[4]
    return c

def ledge_px(X, Y):
    """발코니 판 앞면(1칸): 마름돌 띠 6행 + 그 밑 둥근 까치발 돌(16px 마다) + 사이 하늘."""
    if Y < 6:
        c = C6.ash(X, Y, k=.8, bw=16, bh=6, seed=7)
        if Y == 0: c = ST[5]
        elif Y == 5: c = ST[2]
        return c
    lx = X % 16
    if Y < 11 and 5 <= lx <= 10:
        w = {6: 3, 7: 3, 8: 2.5, 9: 2, 10: 1.2}[Y]
        if abs(lx - 7.5) <= w: return ST[4] if lx < 7 else (ST[3] if lx < 9 else ST[2])
    if Y == 6: return ST[1]
    return None

def ledge_sample():
    im = new(48, 48)
    for y in range(48):
        for x in range(48):
            c = ledge_px(x, y) if y < 16 else None
            im.putpixel((x, y), tuple(c if c is not None else sky_px(x, y + 30)) + (255,))
    return im


# ------------------------------------------------------------------ 오토타일
def carpet_cell(m, N, E, S, W):
    """슬레이트 보라 카펫(버들항 성 지붕색): 금실 테두리 + 안쪽 한 줄 짙은 띠, 속은 결 고운 천에 16px 마다 작은 금 마름모. 이웃 없는 쪽 끝은 술."""
    im = new(); p = im.load()
    for y in range(T):
        for x in range(T):
            c = SL[3] if (x * 3 + y) % 5 else mix(SL[3], SL[4], .4)
            if (x + y) % 2 == 0 and (x // 2 + y // 2) % 3 == 0: c = mix(SL[3], SL[2], .5)
            dd = abs(x - 7.5) + abs(y - 7.5)
            if dd <= 1.5: c = GLD[5] if dd < 1 else GLD[4]
            elif dd <= 2.5: c = SL[2]
            d = 99
            if not W: d = min(d, x)
            if not E: d = min(d, 15 - x)
            if not N: d = min(d, y)
            if not S: d = min(d, 15 - y)
            if d == 0: c = SL[1]
            elif d == 1: c = GLD[5] if (x + y) % 4 else GLD[4]
            elif d == 2: c = GLD[3]
            elif d == 3: c = SL[2]
            p[x, y] = tuple(c) + (255,)
            if not S and y >= 15 and x % 2 == 0: p[x, y] = (0, 0, 0, 0)
            if not N and y == 0 and x % 2 == 1: p[x, y] = (0, 0, 0, 0)
    return im
def carpet_sheet(): return autotile_sheet(carpet_cell)


def balustrade_cell(m, N, E, S, W):
    """돌 난간(위층, 막힘): 가로 줄 = 갓돌(윗면 3행 밝음 + 앞 두께 3행) 아래 항아리 모양 난간동자, 세로 줄 = 위에서 본 갓돌 띠.
    끝·모서리·외톨이 칸에는 네모 기둥(윗면 + 앞면)."""
    cv = Cv(16, 16)
    hz = E or W; vt = N or S
    if hz:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            lx = x % 4
            for y in range(8, 14):                                     # 난간동자(앞면): 가운데 볼록, 위아래 잘록
                hw = {8: 0, 9: 1, 10: 1, 11: 1, 12: 0, 13: 1}[y]
                if abs(lx - 1.5) <= hw + .5: cv.px(x, y, ST[5] if lx < 1 else (ST[4] if lx < 3 else ST[3]))
            cv.px(x, 14, ST[4]); cv.px(x, 15, ST[2])                   # 받침 띠
            for y in range(2, 8):                                      # 갓돌
                cv.px(x, y, ST[6] if y == 2 else (ST[5] if y < 5 else (ST[4] if y < 7 else ST[2])))
    if vt:
        ya = 0 if N else 6; yb = 16 if S else 10
        for y in range(ya, yb):
            for x in range(5, 11): cv.px(x, y, ST[6] if x == 5 else (ST[5] if x < 8 else (ST[4] if x < 10 else ST[2])))
    straight = (m == 10) or (m == 5)                                   # E+W 또는 N+S
    if not straight:
        for y in range(0, 7):
            for x in range(4, 12): cv.px(x, y, ST[6] if (y == 0 or x == 4) else (ST[5] if x < 10 else ST[4]))
        for y in range(7, 15):
            for x in range(4, 12): cv.px(x, y, ST[5] if x < 6 else (ST[4] if x < 9 else ST[3]))
        for x in range(4, 12): cv.px(x, 7, ST[3]); cv.px(x, 15, ST[1])
    return pz.fin(cv.im, .6)
def balustrade_sheet(): return autotile_sheet(balustrade_cell)


def pit_cell(m, N, E, S, W):
    """함정 구덩이(바닥, 막힘): 바닥이 꺼진 구멍. 북쪽 가장자리 아래로 구덩이 안벽 앞면(마름돌이 아래로 어두워짐),
    바닥 쪽은 짙은 어둠과 희미한 쇠 가시 끝, 남쪽은 바닥 턱(밝은 모서리), 옆은 얇은 깎인 테."""
    im = new(); p = im.load()
    for y in range(T):
        for x in range(T):
            X = x + m * 16
            c = dlib.VOID[0] if _hash(X, y, 701) < .8 else dlib.VOID[1]
            sx = (x + 3) % 6
            if 9 <= y <= 12 and sx in (2, 3) and y >= 12 - (1 if sx == 2 else 2): c = IR[2] if sx == 2 else IR[1]   # 가시 끝
            if not N and y < 11:
                c = mix(dlib.face_px('tower', X + 4000, y, 11, 3, False, False), dlib.VOID[0], min(.92, .15 + y * .08))
                if y == 0: c = ST[5]
                elif y == 1: c = ST[4]
            if not S and y >= 13:
                c = ST[5] if y == 13 else (ST[4] if y == 14 else ST[3])
            if not W and x < 2: c = ST[4] if x == 0 else ST[2]
            if not E and x > 13: c = ST[3] if x == 15 else ST[1]
            p[x, y] = tuple(c) + (255,)
    return im
def pit_sheet(): return autotile_sheet(pit_cell)


def floor_candles(seed=0):
    """바닥 초 무리 1×1(바닥 장식, 걷기 아님 — 작은 소품): 높이가 다른 굵은 초 셋과 녹아내린 촛농. 의식 고리 둘레에."""
    cv = Cv(16, 16)
    for (cx, top, w) in ((4, 6, 3), (9, 3, 3), (12, 8, 2)):
        for y in range(top, 15):
            for x in range(cx, cx + w): cv.px(x, y, CRM[6] if x == cx else (CRM[5] if x < cx + w - 1 else CRM[3]))
        cv.px(cx + w // 2, top - 1, FL[3]); cv.px(cx + w // 2, top - 2, FL[4]); cv.px(cx + w // 2, top - 3, FL[2])
        cv.px(cx - 1, 14, CRM[4]); cv.px(cx + w, 14, CRM[3])
    for x in range(2, 15): cv.px(x, 15, CRM[3]) if x % 3 else None
    return fin(cv, .5)


def astral_table(seed=0):
    """별 관측 탁자 2×2(32x32): 짙은 나무 탁자 윗면에 놋쇠 궤도 셋과 색 구슬의 천구 모형, 펼친 별 지도. 아래 2줄 막힘."""
    cv = Cv(32, 32)
    for y in range(8, 24):
        for x in range(1, 31):
            if y < 17:
                c = WD[4] if (y == 8 or x == 1) else WD[3]
                if x >= 29: c = WD[2]
            else:
                c = WD[2] if x < 28 else WD[1]
                if y == 17: c = WD[1]
                if y == 23: c = WD[0]
            cv.px(x, y, c)
    for (x0, y0) in ((2, 24), (28, 24)):
        for y in range(y0, y0 + 6): cv.px(x0, y, WD[3]); cv.px(x0 + 1, y, WD[1])
    for y in range(10, 16):                                            # 별 지도
        for x in range(20, 29):
            c = BL[1] if (x + y) % 5 else BL[2]
            if x in (20, 28) or y in (10, 15): c = CRM[4]
            if _hash(x, y, 9) < .12: c = CRM[6]
            cv.px(x, y, c)
    for (rx, ry, col) in ((9, 3.4, BR[4]), (6.5, 2.4, BR[5]), (4, 1.5, BR[3])):     # 궤도 고리
        for i in range(90):
            a = i * math.pi * 2 / 90
            cv.px(int(11 + rx * math.cos(a)), int(8 + ry * math.sin(a)), col)
    for (x, y, col) in ((11, 7, GLD[5]), (11, 8, GLD[4]), (3, 9, BL[4]), (17, 7, RD[4]), (9, 10, LF[4]), (14, 6, CRM[6])): cv.px(x, y, col)
    for y in range(8, 14): cv.px(11, y, BR[2]) if y > 8 else None
    return shadow_under(fin(cv, .55), 16, 30.5, 15, 1.4, 70)


def stone_urn(seed=0):
    """돌 항아리 화분 1×2(16x32): 둥근 돌 항아리(윗면 테 + 원통) 위로 늘어진 버들항 잎 램프 고사리. 아랫줄만 막힘."""
    cv = Cv(16, 32)
    for y in range(18, 31):
        hw = 6 if y < 26 else 6 - (y - 25)
        if y < 20: hw = 5
        for x in range(8 - hw, 8 + hw): cv.px(x, y, ST[clamp(cyl_k(x, 8 - hw, 8 + hw))])
    for x in range(3, 13): cv.px(x, 23, ST[3]) if x % 2 else None
    topell(cv, 8, 17.5, 6, 2, ST, 6, 4, seed)
    for x in range(4, 12): cv.px(x, 17, WD[1]); cv.px(x, 18, WD[2]) if 4 < x < 11 else None
    fronds = [(-1, 1.0), (-.55, .9), (-.15, 1.0), (.25, .95), (.6, .85), (1.0, 1.0)]
    for i, (dirx, ln) in enumerate(fronds):
        for t in range(12):
            x = int(8 + dirx * t * .55 * ln); y = int(16 - t * 1.0 + (t * t) * .07 * abs(dirx))
            cv.px(x, y, LF[3] if t < 8 else LF[4]); cv.px(x + 1, y + 1, LF[1])
            if t % 2 == 0: cv.px(x - 1, y, LF[4]); cv.px(x + 1, y - 1, LF[5] if t > 6 else LF[2])
    return shadow_under(fin(cv, .55), 8, 31, 6.5, 1.3, 70)


def armchair(seed=0):
    """서재 안락의자 1×1: 슬레이트 보라 천을 씌운 등받이·팔걸이 의자(앞에서 본 좌판). 막힘 1줄."""
    cv = Cv(16, 16)
    for y in range(1, 15):
        for x in range(1, 15):
            if y < 7 and 3 <= x <= 12: c = SL[4] if x < 6 else SL[3]           # 등받이
            elif 7 <= y < 11 and 3 <= x <= 12: c = SL[5] if y == 7 else SL[4]    # 좌판 윗면
            elif y >= 11 and 3 <= x <= 12: c = SL[2] if y < 14 else SL[1]
            elif (x < 3 or x > 12) and y >= 5: c = WD[4] if x < 3 else WD[2]     # 팔걸이
            else: continue
            cv.px(x, y, c)
    for x in (1, 2, 13, 14): cv.px(x, 5, WD[5])
    return shadow_under(fin(cv, .55), 8, 15, 7, 1.2, 70)
