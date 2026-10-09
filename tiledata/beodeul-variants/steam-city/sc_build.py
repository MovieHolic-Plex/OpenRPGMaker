# 증기 도시 건물: 벽돌 줄집(관이 벽을 타는)·가게·공동주택·보일러 집·시계탑. 앞면 + 지붕 윗면(3/4), 옆면 없음.
from sc_base import *
from sc_base import _hash

SH = 30                                                                    # 층 높이(px)


def copper_k(x, y, base, seam=6, lap=11, ox=0):
    """구리판 결: 세로 솟은 이음(seam px 마다 빛 +2 한 줄 · 바로 오른쪽 그늘 −1), 판 가로 겹침 줄(lap px 마다 −1),
    판마다 아주 작은 톤 흔들림. 점토 기와의 비늘·물결 결이 없다(규격 1)."""
    lx = (x + ox) % seam
    k = base
    if lx == 0: k += 2
    elif lx == 1: k -= 1
    if y % lap == lap - 1 and lx > 1: k -= 1
    if hash2((x + ox) // seam, y // lap, 57) < .18 and lx > 1: k -= 1
    return k


def roof_copper_hip(tc, x0, y0, W, H, ends=True, seed=0, yb=.45):
    """구리판 모임지붕(roof_hip 과 같은 기하): 뒤 경사(빛, 톤 5) · 앞 경사(톤 4→3) · 양 끝 삼각(서 4 · 동 3).
    세로 이음 구리판 + 놋쇠 마룻대·추녀, 녹청은 이음 줄을 따라 흘러내린 cyan 줄(규격: cyan 2~3)."""
    e = min(W // 3, int(H * .9))
    el = e if ends else 0; er = e if ends else 0
    YB = H * yb
    for y in range(H):
        xl = el * (1 - (y + .5) / H); xr = W - er * (1 - (y + .5) / H)
        for x in range(W):
            xx = x + .5
            if el and xx < el and y < YB * (1 - xx / el): continue
            if er and xx > W - er and y < YB * (1 - (W - xx) / er): continue
            if xx < xl:   k = copper_k(y, x, 4, 5, 9)                    # 서 끝: 이음이 가로로 돈다
            elif xx > xr: k = copper_k(y, x, 2, 5, 9)
            elif y < YB:  k = copper_k(x, y, 4)
            else:         k = copper_k(x, y, 3 if y < YB + (H - YB) * .5 else 2)
            m = 'rust'
            if el and xx < el and abs(y - YB * (1 - xx / el)) < 1: m, k = 'brass', 5
            if er and xx > W - er and abs(y - YB * (1 - (W - xx) / er)) < 1: m, k = 'brass', 3
            if el and abs(xx - xl) < 1 and y > 0: m, k = 'brass', 5
            if er and abs(xx - xr) < 1 and y > 0: m, k = 'brass', 2
            if abs(y + .5 - YB) < 1 and xl < xx < xr: m, k = 'brass', 4
            if y < 2 and xl <= xx <= xr: m, k = 'brass', (6 if y == 0 else 3)
            if not el and x < 2: m, k = 'brass', (5 if x == 1 else 2)
            if not er and x >= W - 2: m, k = 'brass', (2 if x == W - 2 else 1)
            if m == 'rust': k = max(2, k) if y < YB else max(1, k)
            tc.px(x0 + x, y0 + y, m, ck(k))
    for x in range(W):
        if tc.get(x0 + x, y0 + H - 1): tc.px(x0 + x, y0 + H - 1, 'rust', 2)
    seam_patina(tc, x0, y0, x0 + W, y0 + H, seed)


def roof_copper_pyramid(tc, x0, y0, W, H, seed=0):
    """구리판 뾰족 지붕(탑·판매대): 꼭짓점에서 네 면 — 왼 면 빛 5, 앞 면 4, 오른 면 3. 앞 면은 세로 이음, 옆 면은 꼭짓점으로 모이는 이음."""
    cx = W / 2.0
    for y in range(H):
        f = (y + 1) / H
        half = (W / 2.0) * f; inner = (W / 2.0) * .62 * f
        for x in range(W):
            d = x + .5 - cx
            if abs(d) > half: continue
            if abs(d) <= inner: k = copper_k(x, y, 3, 5, 9)
            else: k = copper_k(int(d / max(.3, f)) + 40, y, 4 if d < 0 else 2, 5, 9)
            m = 'rust'
            if abs(abs(d) - inner) < .8 and y > 1: m, k = 'brass', (5 if d < 0 else 2)
            if abs(abs(d) - half) < 1: m, k = 'brass', (5 if d < 0 else 1)
            if m == 'rust': k = max(2, k)
            tc.px(x0 + x, y0 + y, m, ck(k))
    for x in range(W):
        if tc.get(x0 + x, y0 + H - 1): tc.px(x0 + x, y0 + H - 1, 'rust', 2)
    seam_patina(tc, x0, y0, x0 + W, y0 + H, seed)


def seam_patina(tc, x0, y0, x1, y1, seed=0):
    """녹청(cyan 2~3): 솟은 이음 줄 바로 오른쪽(그늘 줄)을 따라 위에서 3~8px 흘러내린 줄. 흩뿌린 점 없음."""
    for x in range(int(x0), int(x1)):
        for y in range(int(y0), int(y1)):
            g = tc.get(x, y)
            if not g or g[0] != 'rust' or g[1] > 3: continue
            up = tc.get(x, y - 1)
            if up and up[0] == 'rust' and up[1] <= 3: continue           # 줄의 시작점만 고른다
            if hash2(x, y, seed + 81) > .2: continue
            L = 3 + int(hash2(x, y, seed + 82) * 6)
            for j in range(L):
                gg = tc.get(x, y + j)
                if not gg or gg[0] != 'rust': break
                tc.px(x, y + j, 'cyan', 3 if j == 0 else 2)


def patina_streaks(tc, x0, y0, x1, y1, seed=0, p=.16):
    """녹청 줄(규격: cyan 톤 2~3): 판 이음(16px)마다 위에서 아래로 흘러내린 2~7px 세로 줄 + 처마 끝 쪽 점. 넓게 번진 얼룩 아님."""
    for x in range(int(x0), int(x1)):
        if hash2(x, 3, seed + 71) > p: continue
        ys = int(y0 + hash2(x, 4, seed + 72) * (y1 - y0) * .8); L = 2 + int(hash2(x, 5, seed + 73) * 6)
        for y in range(ys, min(int(y1) - 1, ys + L)):
            g = tc.get(x, y)
            if g and g[0] == 'rust': tc.px(x, y, 'cyan', 2 if (y - ys) > L // 2 or g[1] <= 3 else 3)
    for x in range(int(x0), int(x1)):
        for y in range(int(y1) - 4, int(y1) - 1):
            g = tc.get(x, y)
            if g and g[0] == 'rust' and hash2(x, y, seed + 74) < .18: tc.px(x, y, 'cyan', 2)


def pipe_elbow_top(tc, cx, y, dia=4, right=True, mat='brass', L=6):
    """관 꼭대기 꺾임: 세로 관 끝에서 옆으로 L px 꺾여 벽 속(돌림띠 밑)으로 들어간다 — 허공 끝 금지."""
    d = 1 if right else -1
    for i in range(L):
        x = cx + d * i
        for j in range(dia):
            tc.px(x, y + j, mat, (6, 4, 3, 1)[min(3, j)])
    tc.vline(cx + d * L, y - 1, y + dia + 1, mat, 5 if d < 0 else 2)       # 이음 테


def wall_box(tc, x0, y0, seed=0):
    """벽 계기 상자: 검은 무쇠 함 + 압력계 + 밸브 바퀴."""
    for y in range(y0, y0 + 9):
        for x in range(x0, x0 + 10): tc.px(x, y, 'steel', 3 if x > x0 else 4)
    tc.hline(x0, x0 + 10, y0, 'steel', 5); tc.hline(x0, x0 + 10, y0 + 8, 'steel', 1)
    gauge(tc, x0 + 4, y0 + 4, 2, seed)
    tc.px(x0 + 8, y0 + 3, 'brass', 6); tc.px(x0 + 8, y0 + 5, 'brass', 3)


def door_wood(tc, x0, y0, w=12, h=21, seed=0, arch=True, mat='wood'):
    """나무 문(반원 채광창 + 놋쇠 손잡이 + 돌 문틀)."""
    r = w / 2.0
    for y in range(y0 - 2, y0 + h):
        for x in range(x0 - 2, x0 + w + 2):
            ins = y >= y0 + r or ((x + .5 - x0 - r) ** 2 + (y + .5 - y0 - r) ** 2) <= r * r
            out = y >= y0 + r or ((x + .5 - x0 - r) ** 2 + (y + .5 - y0 - r) ** 2) <= (r + 2) ** 2
            if not out: continue
            if x0 <= x < x0 + w and ins:
                if y < y0 + r: tc.px(x, y, 'amber' if _hash(seed, 2, 1) < .5 else 'glass', 3 if y < y0 + 2 else 2)
                else:
                    lx = x - x0
                    k = 4 if lx in (1, w // 2 + 1) else (2 if lx in (w // 2, w - 1) else 3)
                    if (y - y0 - int(r)) % 7 == 0: k = 2
                    tc.px(x, y, mat, k)
            else: tc.px(x, y, 'gst', 5 if x < x0 else 3)
    tc.px(x0 + w - 3, y0 + h - 10, 'brass', 6); tc.px(x0 + w - 3, y0 + h - 9, 'brass', 3)
    tc.hline(x0 - 1, x0 + w + 1, y0 + int(r), 'gst', 2)


def rowhouse(wc=3, storeys=2, seed=0, door=None, roof='slate', pipes=(), lit=(), chim=True, gauge_at=None, shop=False,
             awning=None, ends=True, soot=.35, balcony=False):
    """벽돌 줄집: 그을린 붉은 벽돌 + 아치 창 + 층 돌림띠 + 회색 석재 받침, 지붕 = slate(검은 슬레이트)·copper(구리+녹청)·verd(녹청 망사르드).
    pipes = [(x, 'brass'|'rust'|'steel', 위 꺾임 방향 +1/−1)] 벽을 타는 관(땅에서 올라와 처마 밑에서 벽으로 들어간다).
    shop = 1층 가게(큰 진열창 + 차양 awning 재질). 앞면 줄 막힘, 지붕 걷기 + 가림."""
    W = wc * 16
    Rh = (40 if wc >= 4 else 36) if roof != 'verd' else 42
    pad = 14 if chim else 2
    body = storeys * SH + 6
    H = pad + Rh + body
    tc = TC(W, H, seed)
    yb = pad + Rh
    d = door if door is not None else (wc // 2 if wc % 2 else wc // 2 - (1 if _hash(seed, 1, 3) < .5 else 0))
    brick_wall(tc, 2, yb, W - 2, H - 6, seed, soot=soot)
    for s in range(1, storeys): cornice(tc, 2, W - 2, yb + s * SH, 'gst')
    brick_plinth(tc, 2, W - 2, H - 6, 6, seed)
    for s in range(storeys):
        y0 = yb + s * SH
        ground = s == storeys - 1
        for c in range(wc):
            if ground and c == d: continue
            if ground and shop: continue
            arch_window(tc, c * 16 + 5, y0 + 7 + (2 if s > 0 else 0), 6, 12 if not ground else 11, lit=(s, c) in lit, seed=seed + c)
    if shop:                                                               # 1층 가게 진열창(무쇠 틀 + 유리 + 놋쇠 띠, 글자 없음)
        y0 = yb + (storeys - 1) * SH
        for c in range(wc):
            if c == d: continue
            x0 = c * 16 + 2; x1 = x0 + 13
            for y in range(y0 + 8, H - 8):
                for x in range(x0, x1):
                    edge = x in (x0, x1 - 1) or y in (y0 + 8, H - 9)
                    if edge: tc.px(x, y, 'steel', 4 if x == x0 or y == y0 + 8 else 1)
                    else:
                        lit_ = (storeys - 1, c) in lit
                        k = (4 if y < y0 + 14 else 3) if lit_ else (2 if y < y0 + 13 else 1)
                        tc.px(x, y, 'amber' if lit_ else 'glass', k)
            tc.px(x0 + 2, y0 + 10, 'glass' if (storeys - 1, c) not in lit else 'amber', 5)
            tc.hline(x0, x1, y0 + 6, 'brass', 5); tc.hline(x0, x1, y0 + 7, 'brass', 2)
        if awning:
            ay = y0 + 1
            for x in range(1, W - 1):
                stripe = (x // 4) % 2 == 0
                for j in range(5):
                    k = (5, 4, 4, 3, 2)[j] if stripe else (4, 3, 3, 2, 1)[j]
                    tc.px(x, ay + j, awning if stripe else 'stone', k if stripe else ck(k + 1))
                if x % 4 == 1: tc.px(x, ay + 5, awning, 2)                  # 물결 끝
    door_wood(tc, d * 16 + 2, H - 6 - 22, 12, 22, seed)
    if balcony:                                                            # 무쇠 발코니(2층, 난간 살 + 바닥판 그늘)
        by = yb + SH - 4
        for x in range(4, W - 4):
            tc.px(x, by, 'steel', 5); tc.px(x, by + 6, 'steel', 3); tc.px(x, by + 7, 'steel', 1)
            if x % 3 == 0:
                for y in range(by + 1, by + 6): tc.px(x, y, 'steel', 2)
        for x in (4, W - 5): tc.vline(x, by, by + 7, 'steel', 4)
    for (px_, mat, dirn) in pipes:                                         # 벽을 타는 관 — 땅(받침)에서 처마 밑 벽까지
        brass_pipe_v(tc, px_, yb + 6, H - 2, 4, mat)
        pipe_elbow_top(tc, px_ - 2, yb + 4, 4, right=dirn > 0, mat=mat, L=5)
        tc.hline(px_ - 4, px_ + 4, H - 2, 'gst', 2)                       # 땅으로 들어가는 받침 쇠
    if gauge_at is not None: wall_box(tc, gauge_at[0], yb + gauge_at[1], seed)
    eave_shadow(tc, 2, W - 2, yb, 4)
    if roof == 'slate': roof_hip(tc, 0, pad, W, Rh, 'roofk', ends=ends, cap='steel')
    elif roof == 'copper': roof_copper_hip(tc, 0, pad, W, Rh, ends=ends, seed=seed)
    elif roof == 'verd': RF.roof_mansard(tc, 0, pad, W, Rh, 'verd', seed, dormers=range(wc))
    cx = None
    if chim:
        e = min(W // 3, int(Rh * .9)) if ends and roof != 'verd' else 8
        cx = (W - e - 10) if d < wc / 2 else e + 2
        for y in range(pad - 6, pad + 12):                                 # 벽돌 굴뚝 + 무쇠 연통 갓
            for x in range(cx, cx + 8):
                if y < pad - 3: tc.px(x, y, 'steel', 6 if y == pad - 6 else 4)
                elif y == pad - 3: tc.px(x, y, 'steel', 1)
                else:
                    X, Y = x - cx, y - pad
                    k = 2 if (Y % 4 == 3 or (X + (Y // 4 % 2) * 4) % 8 == 7) else (4 if X < 5 else 3)
                    tc.px(x, y, 'brk' if k > 2 else 'gst', k)
        for x in range(cx + 2, cx + 6): tc.px(x, pad - 5, 'dark', 1)
    tc.grain(.03, mats=('brk', 'gst'))
    im = tc.fin(.6)
    if chim:
        im.alpha_composite(steam_cloud(14, 14, seed + 2, 190), (cx - 3, max(0, pad - 20)))
    return im


# ================================================================ 앵커 ① 시계탑 (5x14칸)
def quoin_k(y, x_left):
    """모서리 돌(퀸): 높이 6px 돌이 번갈아 길고 짧게 — 벽돌 벽 모서리를 회색 석재로 잡는다."""
    return 6 if (y % 6 == 0) else (5 if x_left else 3)


def brick_block(tc, x0, y0, x1, y1, seed, quoins=True, soot=.3):
    brick_wall(tc, x0, y0, x1, y1, seed, soot=soot)
    if quoins:
        for y in range(int(y0), int(y1)):
            long_ = (y - y0) // 6 % 2 == 0
            for x in range(int(x0), int(x0) + (6 if long_ else 4)):
                k = 6 if (y - y0) % 6 == 0 else (5 if x == x0 else 4)
                if (y - y0) % 6 == 5: k = 2
                tc.px(x, y, 'gst', k)
            for x in range(int(x1) - (6 if long_ else 4), int(x1)):
                k = 5 if (y - y0) % 6 == 0 else (3 if x < x1 - 1 else 2)
                if (y - y0) % 6 == 5: k = 1
                tc.px(x, y, 'gst', k)


def ledge_top(tc, x0, x1, y, depth=5, mat='gst'):
    """턱 윗면(3/4: 물러난 단의 윗면이 보인다): 앞모 빛 6 · 윗면 5·4 · 벽 밑 그늘 2."""
    for j in range(depth):
        for x in range(int(x0), int(x1)):
            k = (2, 4, 4, 5, 6)[min(4, depth - 1 - j)] if depth >= 5 else (6 if j == depth - 1 else 4)
            if x < x0 + 1: k = min(6, k + 1)
            if x >= x1 - 1: k = max(1, k - 2)
            tc.px(x, y + j, mat, k)
    for x in range(int(x0), int(x1)): tc.px(x, y + depth, mat, 2)                 # 앞 모 아래 그늘


def clock_face(tc, cx, cy, r, seed=0):
    """큰 시계판: 놋쇠 테 2px(왼위 빛) + 밝은 판(stone 6/5) + 눈금 점 12(숫자 없음) + 무쇠 바늘 둘 + 놋쇠 굴대."""
    for y in range(int(cy - r - 3), int(cy + r + 4)):
        for x in range(int(cx - r - 3), int(cx + r + 4)):
            dx = x + .5 - cx; dy = y + .5 - cy; d = math.hypot(dx, dy)
            if d <= r - 1:
                k = 6 if (dx + dy) < -r * .6 else 5
                if d > r - 2: k = 4
                tc.px(x, y, 'stone', k)
            elif d <= r + 1.2:
                l = -(dx + dy) / max(1, d)
                tc.px(x, y, 'brass', 6 if l > .7 else (5 if l > 0 else (3 if l > -.6 else 2)))
            elif d <= r + 2.4: tc.px(x, y, 'brass', 1)
    for i in range(12):
        a = i * math.pi / 6
        rr = r - 2.6
        tc.px(round(cx - .5 + math.sin(a) * rr), round(cy - .5 - math.cos(a) * rr), 'steel', 1 if i % 3 else 0)
        if i % 3 == 0: tc.px(round(cx - .5 + math.sin(a) * (rr - 1)), round(cy - .5 - math.cos(a) * (rr - 1)), 'steel', 1)
    for (a, L) in ((math.radians(305), r * .5), (math.radians(60), r * .78)):          # 시침·분침
        for t in np.linspace(0, L, int(L * 2) + 1):
            tc.px(round(cx - .5 + math.sin(a) * t), round(cy - .5 - math.cos(a) * t), 'steel', 1)
    tc.ell(cx, cy, 1.4, 1.4, 'brass', 5); tc.px(int(cx) - 1, int(cy) - 1, 'brass', 6)


def clock_tower(seed=0):
    """시계탑 5x14칸(80x224): 아래 = 2층 벽돌 받침(모서리 돌, 아치 문 3칸 가운데, 아치 창, 놋쇠 관 둘), 턱 윗면(3/4) →
    가운데 3칸 벽돌 몸통(모서리 돌, 좁은 아치 창 둘, 톱니 창 하나) → 돌 시계 단(턱 윗면 + 큰 놋쇠 시계판, 글자 없음) →
    종 다락(아치 셋 사이로 놋쇠 종) → 구리 뾰족 지붕(녹청 줄) + 놋쇠 꼭대기 장식. 받침 아래 3줄 막힘, 문 1칸 걷기, 위 걷기+가림."""
    W, H = 80, 224
    tc = TC(W, H, seed)
    # 지붕(뾰족, 구리)
    SX0, SX1 = 14, 66                                                     # 몸통 폭(3칸 + 턱)
    roof_copper_pyramid(tc, SX0 - 2, 10, SX1 - SX0 + 4, 34, seed)
    for y in range(0, 12):                                                # 꼭대기 장식(놋쇠 공 + 바늘)
        tc.px(39, y, 'brass', 5); tc.px(40, y, 'brass', 3)
    tc.ell(40, 8, 2.2, 2.2, 'brass', lambda x, y: 6 if x < 40 else 3)
    # 처마 돌림
    ledge_top(tc, SX0 - 3, SX1 + 3, 44, 4)
    # 종 다락(아치 셋 + 종)
    by0, by1 = 49, 76
    brick_block(tc, SX0, by0, SX1, by1, seed + 1)
    for i, ax in enumerate((SX0 + 8, SX0 + 22, SX0 + 36)):
        for y in range(by0 + 5, by1 - 2):
            for x in range(ax, ax + 9):
                r = 4.5; ins = y >= by0 + 5 + r or ((x + .5 - ax - r) ** 2 + (y + .5 - by0 - 5 - r) ** 2) <= r * r
                if ins: tc.px(x, y, 'dark', 1 if x < ax + 7 else 2)
                elif ((x + .5 - ax - r) ** 2 + (y + .5 - by0 - 5 - r) ** 2) <= (r + 1.5) ** 2: tc.px(x, y, 'gst', 5 if x < ax + 4 else 3)
        tc.hline(ax - 1, ax + 10, by1 - 2, 'gst', 5)
    # 가운데 아치 안 종
    bx = SX0 + 26
    for y in range(by0 + 10, by0 + 20):
        hw = 1.5 + (y - by0 - 10) * .35
        for x in range(int(bx - hw), int(bx + hw) + 1):
            tc.px(x, y, 'brass', 6 if x < bx - hw + 2 else (4 if x < bx + hw - 1 else 2))
    tc.hline(int(bx - 5), int(bx + 6), by0 + 20, 'brass', 2); tc.px(bx, by0 + 21, 'brass', 4)
    tc.hline(bx - 2, bx + 3, by0 + 9, 'steel', 2)
    # 시계 단(넓다 — 몸통보다 2px 씩 튀어나온 돌 상자)
    cy0, cy1 = 76, 122
    ledge_top(tc, SX0 - 4, SX1 + 4, cy0, 4)
    for y in range(cy0 + 5, cy1):
        for x in range(SX0 - 4, SX1 + 4):
            k = ashlar_k(x, y, 12, 6, seed + 5, 4)
            if x >= SX1 + 2: k -= 1
            if x < SX0 - 2: k += 1
            tc.px(x, y, 'gst', ck(k))
    clock_face(tc, 40, cy0 + 26, 17, seed)
    tc.hline(SX0 - 4, SX1 + 4, cy1 - 1, 'gst', 2)
    # 몸통(벽돌)
    sy0, sy1 = 122, 166
    ledge_top(tc, SX0 - 1, SX1 + 1, sy0, 3)
    brick_block(tc, SX0, sy0 + 3, SX1, sy1, seed + 2)
    for ax in (SX0 + 10, SX1 - 16):
        arch_window(tc, ax, sy0 + 12, 6, 14, lit=False, seed=seed + ax)
    gear_face(tc, 40, sy0 + 20, 6, 10, 'steel', .3, spokes=4, hub_mat='brass')     # 몸통 가운데 톱니 둥근 창(장식)
    # 받침(2층 넓음)
    py0 = 166
    ledge_top(tc, 0, W, py0, 5)
    brick_block(tc, 2, py0 + 5, W - 2, H - 6, seed + 3, soot=.2)
    cornice(tc, 2, W - 2, py0 + 26, 'gst')
    brick_plinth(tc, 2, W - 2, H - 6, 6, seed)
    for c in (0, 1, 3, 4):
        arch_window(tc, c * 16 + 5, py0 + 10, 6, 11, lit=(c == 3), seed=seed + c)
    for c in (0, 4): arch_window(tc, c * 16 + 5, py0 + 33, 6, 11, lit=(c == 0), seed=seed + 9 + c)
    door_wood(tc, 2 * 16 + 1, H - 6 - 24, 14, 24, seed)
    for (px_, mat) in ((22, 'brass'), (58, 'rust')):
        brass_pipe_v(tc, px_, py0 + 30, H - 2, 4, mat)
        pipe_elbow_top(tc, px_ - 2, py0 + 28, 4, right=px_ > 40, mat=mat, L=4)
    tc.grain(.03, mats=('brk', 'gst'))
    im = tc.fin(.6, shadow=(40, H - 2, 38, 3, 70))
    return im


# ================================================================ 앵커 ② 보일러 집(증기 펌프장) 8x9칸
def brick_stack(tc, cx, ytop, ybot, r=7, seed=0, bands=18):
    """둥근 벽돌 굴뚝: 벽돌 결(4px 줄, 원통 음영으로 톤 이동) + 검은 무쇠 띠 + 꼭대기 무쇠 갓."""
    x0 = int(cx - r)
    for y in range(ytop, ybot):
        for x in range(x0, x0 + 2 * r):
            t = (x - x0 + .5) / (2 * r)
            base = cyl_k(t) - 1
            Y = y - ytop; row = Y // 4; lx = (x - x0 + (row % 2) * 3) % 6
            if Y % 4 == 3 or lx == 5: k = max(1, base - 2); m = 'gst'
            else: k = base; m = 'brk'
            if Y % bands in (0, 1): m = 'steel'; k = cyl_k(t) - (0 if Y % bands == 0 else 2)
            tc.px(x, y, m, ck(k))
    for y in range(ytop - 5, ytop + 1):
        for x in range(x0 - 2, x0 + 2 * r + 2):
            k = cyl_k((x - x0 + 2.5) / (2 * r + 4)) + (1 if y < ytop - 3 else -1)
            tc.px(x, y, 'steel', ck(k))
    tc.ell(cx, ytop - 4, r - 1, 1.6, 'dark', 1)


def boiler_drum(tc, x0, y0, L, dia, mat='rust', seed=0):
    """누운 보일러 통: 구리 원통(위→아래 cyl_k) + 놋쇠 띠 + 리벳 줄 + 앞 끝 둥근 무쇠 뚜껑(볼트 고리) + 받침 다리."""
    for y in range(y0, y0 + dia):
        k = cyl_k((y - y0 + .5) / dia)
        for x in range(x0, x0 + L):
            m = mat; kk = k
            if (x - x0) % 14 in (0, 1): m = 'brass'; kk = k + (1 if (x - x0) % 14 == 0 else -1)
            elif (x - x0) % 14 == 7 and (y - y0) % 3 == 1: kk = 6
            tc.px(x, y, m, ck(kk))
    ex = x0 + L
    for y in range(y0 - 1, y0 + dia + 1):                                  # 앞 뚜껑(놋쇠 테 + 무쇠 원판)
        for x in range(ex, ex + 4):
            k = cyl_k((y - y0 + 1.5) / (dia + 2)) - (x - ex)
            tc.px(x, y, 'steel' if x > ex else 'brass', ck(k))
    for lx in (x0 + 4, x0 + L - 6):                                        # 받침
        for y in range(y0 + dia, y0 + dia + 5):
            for x in range(lx, lx + 4): tc.px(x, y, 'steel', 4 if x == lx else 2)


def boiler_house(seed=0):
    """보일러 집 8x9칸(128x144): 뒤로 솟은 둥근 벽돌 굴뚝 둘(무쇠 띠·갓·증기), 검은 슬레이트 박공 지붕 + 마룻대 환기 탑(증기가 새는 루버),
    높은 벽돌 홀(모서리 돌, 큰 아치 창 셋 — 안에 호박빛), 가운데 겹 무쇠 문(아치), 앞 왼쪽에 누운 구리 보일러 통 + 놋쇠 관이 벽으로,
    오른쪽 벽에 계기 상자·밸브 바퀴. 앞면 4줄 막힘(문 2칸 걷기), 위 걷기 + 가림."""
    W, H = 128, 144
    tc = TC(W, H, seed)
    for (cx, top) in ((26, 8), (102, 16)): brick_stack(tc, cx, top, 60, 7, seed + cx)
    RT, FT = 40, 78
    roof_hip(tc, 0, RT, W, FT - RT, 'roofk', ends=False, cap='steel')
    for y in range(RT - 10, RT + 12):                                     # 마룻대 환기 탑(루버)
        for x in range(46, 82):
            r = y - (RT - 10)
            if r < 3: tc.px(x, y, 'roofk', 6 if r == 0 else 4)
            elif r < 4: tc.px(x, y, 'roofk', 1)
            else:
                k = 4 if (r % 3 == 0) else (2 if r % 3 == 1 else 1)
                if x < 48: k = 5
                if x >= 80: k = 1
                tc.px(x, y, 'steel', k)
    brick_block(tc, 2, FT, W - 2, H - 6, seed, soot=.45)
    cornice(tc, 2, W - 2, FT, 'gst')
    brick_plinth(tc, 2, W - 2, H - 6, 6, seed)
    for ax in (12, 98):                                                   # 큰 아치 창
        for y in range(FT + 8, FT + 38):
            for x in range(ax, ax + 18):
                r = 9; cy = FT + 8 + r
                ins = y >= cy or ((x + .5 - ax - r) ** 2 + (y + .5 - cy) ** 2) <= r * r
                rim = y < cy and ((x + .5 - ax - r) ** 2 + (y + .5 - cy) ** 2) <= (r + 2) ** 2
                if ins:
                    m = 'steel' if ((x - ax) % 6 == 5 or (y - FT) % 7 == 6) else 'amber'
                    k = 2 if m == 'steel' else (4 if y < FT + 22 else 3)
                    if m == 'amber' and x > ax + 12: k -= 1
                    tc.px(x, y, m, k)
                elif rim: tc.px(x, y, 'gst', 6 if x < ax + 9 else 4)
        tc.hline(ax - 2, ax + 20, FT + 38, 'gst', 6); tc.hline(ax - 2, ax + 20, FT + 39, 'gst', 2)
    # 겹 무쇠 문(아치) 칸 3~4
    dx0, dx1 = 48, 80; dy0 = H - 6 - 34
    for y in range(dy0 - 4, H - 6):
        for x in range(dx0 - 3, dx1 + 3):
            r = 16; cy = dy0 + 12
            ins = (y >= cy or ((x + .5 - 64) ** 2 + (y + .5 - cy) ** 2) <= r * r) and dx0 <= x < dx1
            rim = (y < cy and ((x + .5 - 64) ** 2 + (y + .5 - cy) ** 2) <= (r + 3) ** 2) or (y >= cy and (x < dx0 or x >= dx1))
            if ins:
                lx = x - dx0
                k = 3 if lx % 8 else 1
                if lx % 8 == 1: k = 4
                if lx in (15, 16): k = 1
                if (y - dy0) % 10 == 0: k = 2
                tc.px(x, y, 'steel', k)
                if (y - dy0) % 10 == 1 and lx % 4 == 2: tc.px(x, y, 'brass', 5)
            elif rim: tc.px(x, y, 'gst', 5 if x < 64 else 3)
    # 앞 보일러 통(벽 앞, 왼쪽) + 관
    boiler_drum(tc, 8, H - 26, 30, 12, 'rust', seed)
    pipe_v(tc, 20, FT + 42, H - 26, 4, 'brass', step=12)
    pipe_h(tc, 20, 34, FT + 42, 4, 'brass', step=12)
    gauge(tc, 28, H - 32, 3, seed)
    wall_box(tc, 100, FT + 46, seed)
    valve_wheel(tc, 112, FT + 58, 4, 2, 'brass')
    brass_pipe_v(tc, 120, FT + 4, H - 2, 4, 'brass')
    tc.grain(.03, mats=('brk', 'gst'))
    im = tc.fin(.6)
    for (cx, top) in ((26, 8), (102, 16)):
        im.alpha_composite(steam_cloud(22, 18, seed + cx, 200), (cx - 11, max(0, top - 18)))
    for i, x in enumerate((50, 62, 72)):
        im.alpha_composite(steam_cloud(14, 12, seed + 40 + i, 170), (x - 4, RT - 18))
    return im


# ================================================================ 석탄 저장소: 무쇠 다리 위 석탄 깔때기 + 미끄럼 홈 (4x6칸)
def coal_hopper(seed=0):
    """석탄 깔때기 4x6칸(64x96): 리벳 검은 철판 상자(윗면에 석탄 산이 보인다) → 아래로 좁아지는 깔때기 → 미끄럼 홈(구리) →
    무쇠 다리 넷 + 가새. 다리 밑동 줄만 막힘(깔때기 밑으로 마차가 들어간다)."""
    W, H = 64, 96
    tc = TC(W, H, seed)
    # 윗면 석탄 산 + 상자 테
    for y in range(4, 16):
        for x in range(4, 60):
            d = abs(x + .5 - 32) / 28.0
            top = 4 + int(d * d * 9)
            if y < top: continue
            k = 3 if hash2(x // 2, y // 2, seed + 3) > .4 else 2
            if hash2(x, y, seed + 4) > .9: k = 5
            if x < 32 and y < top + 2: k += 1
            tc.px(x, y, 'coal', ck(k))
    panels(tc, 2, 14, 62, 44, 'steel', 2, 16, 15, stagger=False, rivets=True, face='front', seed=seed, vary=1)
    tc.hline(2, 62, 14, 'steel', 5); tc.hline(2, 62, 15, 'steel', 3)
    for y in range(44, 60):                                               # 깔때기(좁아짐)
        f = (y - 44) / 16.0
        xa = int(2 + f * 22); xb = int(62 - f * 22)
        for x in range(xa, xb):
            k = 3 if x < 32 else 2
            if x == xa: k = 4
            if (x - 2) % 16 == 0: k = 1
            tc.px(x, y, 'steel', k)
    for y in range(60, 70):                                               # 미끄럼 홈(구리, 아래로 비스듬)
        for x in range(26 - (y - 60), 40 - (y - 60)):
            tc.px(x, y, 'rust', 5 if y == 60 else (4 if x < 32 - (y - 60) else 3))
    for lx in (4, 56):                                                    # 다리
        for y in range(40, H - 2):
            tc.px(lx, y, 'steel', 4); tc.px(lx + 1, y, 'steel', 3); tc.px(lx + 2, y, 'steel', 2)
        for x in range(lx - 1, lx + 4): tc.px(x, H - 2, 'gst', 3); tc.px(x, H - 1, 'gst', 1)
    tc.line(7, 62, 20, 80, 'steel', 2); tc.line(56, 62, 44, 80, 'steel', 2)
    tc.line(7, 84, 56, 84, 'steel', 3)
    tc.hline(7, 56, 85, 'steel', 1)
    tc.grain(.03, mats=('coal',))
    return tc.fin(.6, shadow=(32, H - 2, 30, 3, 60))


def steam_tank(seed=0, h=56):
    """증기 저장 탱크 3x5칸: 세운 리벳 검은 철 원통 + 놋쇠 띠 둘 + 둥근 지붕 + 안전 밸브(김) + 사다리 + 압력계. 받침 줄만 막힘."""
    W = 48; H = h + 28
    tc = TC(W, H, seed)
    import fr_props as _FP
    _FP.cyl(tc, 24, 14, 20, 6, h, 'steel', top='steel', base=-2, seed=seed)
    for by in (24, 24 + h // 2):                                          # 놋쇠 띠
        for x in range(4, 44):
            t = (x - 4 + .5) / 40.0
            tc.px(x, by, 'brass', cyl_k(t)); tc.px(x, by + 1, 'brass', max(1, cyl_k(t) - 2))
    for y in range(16, 14 + h, 8):                                        # 리벳 줄
        for x in range(8, 42, 6): tc.px(x, y, 'steel', 6 if x < 24 else 4)
    for y in range(18, 14 + h): tc.px(38, y, 'steel', 5 if y % 3 == 0 else 2)    # 사다리
    tc.vline(41, 18, 14 + h, 'steel', 2)
    gauge(tc, 14, 34, 3, seed)
    tc.vline(24, 2, 10, 'brass', 4); tc.ell(24, 3, 2, 1.5, 'brass', 5)    # 안전 밸브
    tc.grain(.03)
    im = tc.fin(.6, shadow=(24, H - 4, 22, 4, 60))
    im.alpha_composite(steam_cloud(16, 12, seed + 5, 170), (16, 0))
    return im


def brick_chimney(seed=0, h=128):
    """홀로 선 큰 공장 굴뚝 2x8칸: 네모 석재 받침(윗면 보임) + 둥근 벽돌 굴뚝(무쇠 띠) + 증기·연기. 받침 줄만 막힘."""
    W = 32; tc = TC(W, h, seed)
    brick_stack(tc, 16, 20, h - 18, 8, seed, bands=20)
    for y in range(h - 22, h):
        for x in range(2, 30):
            r = y - (h - 22)
            if r < 4: k = 6 if r == 0 else 5
            elif r == 4: k = 2
            else: k = ashlar_k(x, y, 12, 6, seed, 4) - (1 if x >= 28 else 0)
            if y >= h - 2: k = 1
            tc.px(x, y, 'gst', ck(k))
    for x in range(7, 11):
        for y in range(h - 12, h - 7): tc.px(x, y, 'dark', 1)
    tc.grain(.03, mats=('gst', 'brk'))
    im = tc.fin(.6, shadow=(16, h - 2, 14, 3, 70))
    im.alpha_composite(steam_cloud(30, 22, seed + 3, 205), (1, 0))
    return im


# ================================================================ 석탄 창고(열린 앞면) 6x5칸
def coal_shed(seed=0):
    """석탄 창고 6x5칸(96x80): 골판 함석 박공 지붕(녹 줄) + 뒤 벽돌 벽 + 앞은 열린 칸 셋(나무 기둥 넷, 위 무쇠 보) —
    칸마다 안쪽 어둠 속 석탄 산. 앞면 아래 2줄 중 기둥 칸만 막힘, 칸 안은 석탄으로 막힘(전체 아래 2줄 막힘), 지붕 걷기+가림."""
    W, H = 96, 80
    tc = TC(W, H, seed)
    RF.roof_corr(tc, 0, 4, W, 34, seed)
    FT = 38
    for y in range(FT, H - 4):                                            # 뒤 벽(안쪽, 어둡게) + 석탄 산
        for x in range(2, W - 2):
            tc.px(x, y, 'dark', 2 if y < FT + 6 else 1)
    brick_wall(tc, 2, FT + 2, W - 2, FT + 14, seed, soot=.8)
    for y in range(FT + 2, FT + 14):
        for x in range(2, W - 2):
            g = tc.get(x, y)
            if g: tc.px(x, y, g[0], max(1, g[1] - 2))
    for i in range(3):
        coal_mound_sc(tc, 6 + i * 30, FT + 12, 26, H - 4 - (FT + 12), seed + i)
    for i in range(4):                                                    # 나무 기둥
        x0 = 1 + i * 30
        for y in range(FT, H - 2):
            for x in range(x0, x0 + 4): tc.px(x, y, 'wood', 5 if x == x0 else (4 if x < x0 + 3 else 2))
        tc.hline(x0 - 1, x0 + 5, H - 2, 'gst', 3); tc.hline(x0 - 1, x0 + 5, H - 1, 'gst', 1)
    for y in range(FT, FT + 4): tc.hline(0, W, y, 'steel', (4, 3, 2, 1)[y - FT])           # 무쇠 보
    for x in range(8, W - 8, 12): tc.px(x, FT + 1, 'steel', 6)
    tc.grain(.03, mats=('wood', 'coal'))
    return tc.fin(.6)


def coal_mound_sc(tc, x0, y0, w, h, seed=0):
    import sc_props as _P
    _P.coal_mound(tc, x0, y0, w, h, seed)
