# 제국 도시 건물 키트 — 성채(앵커 ①)·성문(④)·성벽·감시 포탑(④)·병영·격납고(②)·공장·굴뚝(③)·주택.
# 건축 언어: 아래 단 = 회색 마름돌(gst) + 받침 띠, 위 단 = 회청 철판(steel 32x16 엇갈림 + 리벳), 층 사이 돌림 띠,
# 지붕 = 버들항 슬레이트 결의 회청(성채)·검은(그 밖) 모임지붕, 마룻대·추녀는 강철 덮개. 창은 아치 없는 사각 강철 틀.
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위. 문장·글자·상표 없음 — 깃발·걸개는 단색.
import math
from ec_base import *
from ec_base import _hash, vnoise


def eave_shadow(tc, x0, x1, y, n=4):
    """처마 밑 그늘: 지붕 바로 아래 앞면 n 줄을 한 단씩 어둡게."""
    for j in range(n):
        for x in range(int(x0), int(x1)):
            if tc.get(x, y + j): tc.shift(x, y + j, -(2 if j < 2 else 1))


def iron_door(tc, x0, y0, w=12, h=20, seed=0, double=False, window=True):
    """철문: 돌 문틀(왼 빛·오른 그늘, 두꺼운 상인방) + 강철 문짝(세로 판·가로 띠 셋·리벳) + 작은 엿보기 창."""
    for y in range(y0 - 4, y0 + h):
        for x in range(x0 - 3, x0 + w + 3):
            if x0 <= x < x0 + w and y >= y0: continue
            k = 6 if x < x0 else (3 if x >= x0 + w else (5 if y < y0 - 1 else 2))
            if y == y0 - 4: k = 6
            tc.px(x, y, 'gst', k)
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            lx = x - x0
            k = 3 if lx % 4 else 2
            if lx == 0: k = 4
            if double and lx == w // 2: k = 1
            if (y - y0) in (2, h // 2, h - 3): k = 4 if lx < w - 1 else 3
            if (y - y0) in (3, h // 2 + 1, h - 2): k = 1
            tc.px(x, y, 'steel', k)
            if (y - y0) in (2, h // 2, h - 3) and lx % 4 == 1: tc.px(x, y, 'steel', 6)
    if window:
        for xx in ([x0 + 2, x0 + w - 5] if double else [x0 + w // 2 - 2]):
            for y in range(y0 + 5, y0 + 8):
                for x in range(xx, xx + 3): tc.px(x, y, 'glass', 2 if y > y0 + 5 else 4)
    tc.px(x0 + (w // 2 - 2 if double else w - 3), y0 + h // 2 + 3, 'brass', 5)
    if double: tc.px(x0 + w // 2 + 1, y0 + h // 2 + 3, 'brass', 5)


# ================================================================ 주택
def house(wc=4, storeys=2, seed=0, door=None, roof='roofk', chim=True, upper='iron', shutters=True, lit=(), ends=True, awning=False):
    """제국 도시 주택: 1층 회색 마름돌 + 철문, 위층 회청 철판(또는 석재) + 사각 창(철 덧문), 층 띠, 검은(또는 회청) 지붕 + 굴뚝.
    폭 wc 칸, storeys 층(1~3), ends=True 모임지붕 · False 박공 끝(양끝 강철 박공널), awning = 문 위 쇠 차양.
    앞면 줄 막힘, 지붕 줄 걷기 + 가림."""
    W = wc * 16; Rh = 40 if wc >= 4 else 36; pad = 14 if chim else 2
    if storeys == 1: Rh = 34 if wc >= 4 else 30
    SH = 30                                                               # 층 높이
    body = storeys * SH + 6
    H = pad + Rh + body
    tc = TC(W, H, seed)
    yb = pad + Rh                                                         # 앞면 시작
    d = door if door is not None else (wc // 2 if wc % 2 else wc // 2 - (1 if _hash(seed, 1, 3) < .5 else 0))
    for s in range(storeys):
        y0 = yb + s * SH; y1 = y0 + SH
        top_floor = s < storeys - 1
        if top_floor and upper == 'iron':
            iron_face(tc, 2, y0, W - 2, y1, seed=seed + s, base=3, oy=s * 5)
        else:
            stone_face(tc, 2, y0, W - 2, y1, 16, 8, seed + s * 7, base=4)
        if s > 0: string_course(tc, 2, W - 2, y0)
    plinth(tc, 2, W - 2, H - 6, 6, seed=seed)
    for s in range(storeys):
        y0 = yb + s * SH
        for c in range(wc):
            if s == storeys - 1 and c == d: continue
            wx = c * 16 + 5; wy = y0 + 8 + (2 if s > 0 else 0)
            window(tc, wx, wy, 6, 11 if s < storeys - 1 else 10, lit=(s, c) in lit,
                   seed=seed + c, shutter=shutters and _hash(s, c, seed + 9) < .35)
    iron_door(tc, d * 16 + 2, H - 6 - 21, 12, 21, seed)
    if awning:
        ax0, ax1, ay = d * 16 - 2, d * 16 + 18, H - 6 - 27
        for x in range(ax0, ax1):
            tc.px(x, ay, 'steel', 6 if x < ax0 + 8 else 5); tc.px(x, ay + 1, 'steel', 4); tc.px(x, ay + 2, 'steel', 2)
        for bx in (ax0 + 1, ax1 - 2):
            for j in range(3, 6): tc.px(bx, ay + j, 'steel', 3)
    eave_shadow(tc, 2, W - 2, yb, 4)
    roof_hip(tc, 0, pad, W, Rh, roof, ends=ends)
    if chim:
        e = min(W // 3, int(Rh * .9)) if ends else 6
        cx = (W - e - 10) if d < wc / 2 else e + 2
        chimney(tc, cx, pad - 6, 8, 18)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    if chim:
        im.alpha_composite(steam(12, 12, seed + 2, 110), (cx - 2, 0))
    return im


def house_tall(seed=0, roof='roofk'):
    """좁고 높은 3층 주택(3칸): 위 두 층 철판, 꼭대기 창 하나 불 켜짐."""
    return house(3, 3, seed=seed, door=1, upper='iron', lit=((0, 1),), roof=roof)


def house_wide(seed=0):
    """넓은 박공 주택(5칸, 2층): 회청 지붕 박공 끝, 문 위 쇠 차양 — 상점·관청 겸 집."""
    return house(5, 2, seed=seed, door=2, roof='roofb', ends=False, awning=True, lit=((0, 0), (0, 4)))


def house_low(seed=0, wc=4):
    """단층 노동자 집(4칸 또는 3칸): 마름돌 벽 + 검은 지붕(박공), 굴뚝 김."""
    return house(wc, 1, seed=seed, ends=(wc >= 4), roof='roofk')


# ================================================================ 병영 (앵커 ②)
def barracks(wc=10, seed=0):
    """병영 10x6칸: 긴 2층 건물. 1층 회색 마름돌(덧문 창 줄) + 가운데 겹 철문과 쇠 차양, 2층 회청 철판 창 줄,
    검은 모임지붕 위 환기 갓 셋 + 굴뚝 둘, 문 양옆 단색 걸개. 앞면 4줄 막힘(문 칸 2개만 걷기 — 병영 안으로 가는 문),
    지붕 줄 걷기 + 가림."""
    W = wc * 16; Rh = 44; pad = 14; SH = 30
    H = pad + Rh + 2 * SH + 6
    tc = TC(W, H, seed)
    yb = pad + Rh
    iron_face(tc, 2, yb, W - 2, yb + SH, seed=seed, base=3)
    stone_face(tc, 2, yb + SH, W - 2, yb + 2 * SH, 16, 8, seed + 3, base=4)
    string_course(tc, 2, W - 2, yb + SH)
    plinth(tc, 2, W - 2, H - 6, 6, seed=seed)
    dc = wc // 2 - 1                                                      # 문: 칸 dc, dc+1 (가운데 두 칸)
    for c in range(wc):
        window(tc, c * 16 + 5, yb + 8, 6, 11, seed=seed + c, lit=(c in (2, 7)), shutter=False)
        if c in (dc, dc + 1): continue
        window(tc, c * 16 + 5, yb + SH + 9, 6, 10, seed=seed + c + 20, shutter=_hash(c, 2, seed) < .5)
    # 문: 겹 철문(문틀 포함 32 폭) + 쇠 차양(받침 팔 둘)
    dx = dc * 16 + 3
    iron_door(tc, dx, H - 6 - 23, 26, 23, seed, double=True)
    for x in range(dx - 6, dx + 32):                                      # 차양 윗면 + 앞 모
        tc.px(x, H - 6 - 31, 'steel', 6 if x < dx + 13 else 5); tc.px(x, H - 6 - 30, 'steel', 5)
        tc.px(x, H - 6 - 29, 'steel', 4); tc.px(x, H - 6 - 28, 'steel', 2); tc.px(x, H - 6 - 27, 'steel', 1)
    for bx in (dx - 4, dx + 29):
        for j in range(6): tc.px(bx + (j // 3 if bx < dx else -(j // 3)), H - 6 - 27 + j, 'steel', 3)
    eave_shadow(tc, 2, W - 2, yb, 4)
    roof_hip(tc, 0, pad, W, Rh, 'roofk')
    for vx in (W * .3, W * .5, W * .7):                                   # 지붕 환기 갓(작은 강철 갓)
        vx = int(vx) - 5
        box(tc, vx, pad + 8, vx + 10, pad + 16, 3, 'steel', base=3)
        tc.hline(vx - 1, vx + 11, pad + 7, 'steel', 5)
    for cx in (44, W - 52):
        chimney(tc, cx, pad - 8, 8, 20)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    # 문 양옆 걸개
    for bx in (dx - 16, dx + 37):
        b = TC(10, 26, seed + bx); flag_banner(b, 1, 0, 8, 25); im.alpha_composite(b.fin(.7), (bx, yb + 2))
    for i, cx in enumerate((44, W - 52)):
        im.alpha_composite(smoke(16, 14, seed + i, 120), (cx - 4, 0))
    return im


# ================================================================ 격납고 (앵커 ②)
def hangar(wc=10, seed=0):
    """병기 격납고 10x8칸: 남북으로 누운 반원통 골판 강철 지붕(윗면은 세로 골 — 빛 왼쪽), 앞 박공은 아치 철판 면,
    가운데 큰 셔터문(가로 살, 반쯤 올라가 안이 어둡다) + 경고 띠 문틀 + 호박색 경고등 둘, 오른쪽 작은 철문, 통풍구.
    앞면 아래 4줄 막힘(셔터 아래 4칸은 걷기 — 격납고 안), 지붕은 걷기 + 가림."""
    W = wc * 16; H = 128
    tc = TC(W, H, seed)
    AR = 34                                                               # 아치 높이(앞 박공 위 둥근 부분)
    FT = 46                                                               # 앞 박공 아치 꼭대기 y
    WALL = FT + AR                                                        # 곧은 벽 시작 y (= 80)
    x0, x1 = 3, W - 3; cx = W / 2.0; half = (x1 - x0) / 2.0
    def arch_y(x):                                                        # 박공 윗선(타원 호)
        u = (x + .5 - cx) / half
        if abs(u) >= 1: return WALL
        return WALL - AR * math.sqrt(1 - u * u)
    # 지붕 윗면: 아치 윗선 위로 뒤로 뻗은 원통(세로 골판), 먼 끝은 y=4 의 곧은 선
    for x in range(x0, x1):
        u = (x + .5 - x0) / (x1 - x0)
        ya = arch_y(x)
        ytop = 4 + (WALL - 4 - AR) * (1 - math.sqrt(max(0, 1 - ((x + .5 - cx) / half) ** 2))) * .9
        for y in range(int(ytop), int(ya)):
            k = cyl_k(u)
            if (x - x0) % 4 == 3: k -= 1                                    # 골
            elif (x - x0) % 4 == 0: k += 1
            if (y - int(ytop)) in (0,): k = 6 if u < .5 else 3              # 먼 끝 테
            if (y % 24) == 12: k -= 1                                         # 판 이음(가로)
            tc.px(x, y, 'steel', clamp(k, 1, 6))
    # 앞 박공(아치 철판) + 곧은 벽
    for y in range(int(FT), H - 6):
        for x in range(x0, x1):
            if y < arch_y(x): continue
            tc.px(x, y, 'steel', 3)
    panels(tc, x0, FT, x1, H - 6, 'steel', 3, 32, 16, stagger=True, rivets=True, face='front', seed=seed + 1, vary=1)
    for x in range(x0, x1):                                               # 아치 윗선 테(강철 덮개 3px)
        ya = int(arch_y(x))
        if ya >= WALL: continue
        tc.px(x, ya, 'steel', 6 if x < cx else 4); tc.px(x, ya + 1, 'steel', 5 if x < cx else 3); tc.px(x, ya + 2, 'steel', 1)
    for y in range(int(FT), H - 6):                                       # 아치 밖 칸 지우기(다시)
        for x in range(x0, x1):
            if y < arch_y(x) - 0.01 and y >= WALL - AR - 1:
                g = tc.get(x, y)
                if g and g[1] == 3 and y > arch_y(x) - 1: pass
    # 받침(콘크리트 → 회색 석재)
    plinth(tc, x0, x1, H - 6, 6, seed=seed)
    # 셔터문
    sx0, sx1 = 2 * 16, 8 * 16 - 0                                        # 칸 2~7 (폭 6칸)
    sy0 = WALL - 2; sy1 = H - 6
    hazard(tc, sx0 - 4, sy0 - 5, sx1 + 4, sy0, seed + 2)
    hazard(tc, sx0 - 4, sy0, sx0, sy1, seed + 3); hazard(tc, sx1, sy0, sx1 + 4, sy1, seed + 4)
    open_h = 18                                                           # 아래로 열린 틈
    for y in range(sy0, sy1):
        for x in range(sx0, sx1):
            if y >= sy1 - open_h:
                f = (y - (sy1 - open_h)) / open_h
                tc.px(x, y, 'dark', 1 + (1 if f > .6 else 0) + (1 if f > .9 else 0))
            else:
                r = (y - sy0) % 4
                k = (5, 4, 3, 1)[r]
                if x < sx0 + 2: k += 1
                if x >= sx1 - 2: k -= 1
                tc.px(x, y, 'steel', clamp(k, 1, 6))
    for x in range(sx0, sx1):                                             # 셔터 아래 끝 손잡이 막대
        y = sy1 - open_h - 1; tc.px(x, y, 'steel', 6 if x % 8 else 2); tc.px(x, y + 1, 'steel', 1)
    for (lx, ly) in ((sx0 + 20, sy1 - 3), (sx1 - 24, sy1 - 4)):           # 안쪽 바닥 호박색 띠등
        for i in range(4): tc.px(lx + i, ly, 'amber', 5 - (i % 2))
    # 오른쪽 작은 철문 + 통풍구 + 왼쪽 계기함
    iron_door(tc, 8 * 16 + 9, H - 6 - 20, 10, 20, seed + 5)
    for y in range(WALL + 4, WALL + 12):
        for x in range(10, 22):
            tc.px(x, y, 'steel', 1 if (y - WALL) % 2 == 0 else 4)
    box(tc, 10, WALL + 18, 22, WALL + 32, 2, 'steel', base=4)
    # 박공 가운데 둥근 환기창(살창)
    for y in range(FT + 8, FT + 26):
        for x in range(int(cx - 12), int(cx + 12)):
            e = ((x + .5 - cx) / 11.5) ** 2 + ((y + .5 - (FT + 17)) / 8.5) ** 2
            if e <= 1: tc.px(x, y, 'dark', 1 if (x // 3) % 2 == 0 else 2)
            elif e <= 1.35: tc.px(x, y, 'steel', 5 if x < cx else 2)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    for i, ax in enumerate((sx0 - 13, sx1 + 6)):                          # 경고등(호박색) + 빛 번짐
        g = TC(8, 8, i); g.ell(4, 4, 3, 3, 'amber', lambda x, y: 6 if x < 4 and y < 4 else 4); g.hline(1, 7, 7, 'steel', 2)
        im.alpha_composite(D.glow(16, SIGNAL['amber'][5], 60, 8, 8, 8), (ax - 4, sy0 - 6))
        im.alpha_composite(g.fin(.7), (ax, sy0 - 2))
    return im


# ================================================================ 공장 (앵커 ③)
def stack_body(tc, cx, ytop, ybot, r=6, mat='steel', seed=0, bands=12):
    """세운 굴뚝 몸통: 원통 음영 + bands px 마다 리벳 테 + 꼭대기 갓(넓은 테 + 어두운 구멍 윗면)."""
    x0 = int(cx - r)
    for y in range(ytop, ybot):
        for x in range(x0, x0 + 2 * r):
            k = cyl_k((x - x0 + .5) / (2 * r))
            if (y - ytop) % bands == bands - 1: k -= 1
            elif (y - ytop) % bands == 0: k += 1
            tc.px(x, y, mat, clamp(k, 1, 6))
            if (y - ytop) % bands == 0 and (x - x0) % 4 == 1: tc.px(x, y, mat, 6 if x < cx else 4)
    for y in range(ytop - 4, ytop + 2):                                   # 갓
        for x in range(x0 - 2, x0 + 2 * r + 2):
            k = cyl_k((x - x0 + 2.5) / (2 * r + 4)) + (1 if y < ytop - 2 else 0)
            tc.px(x, y, mat, clamp(k, 1, 6))
    tc.ell(cx, ytop - 3, r - 1, 1.6, 'dark', 1)


def factory(wc=9, seed=0, stacks=(2, 6)):
    """공장 9x9칸: 톱날 지붕(검은 슬레이트 경사 셋 + 북쪽 채광창 띠), 뒤로 솟은 강철 굴뚝 둘과 짙은 연기,
    앞면 = 세로 골판 강철 벽(위 띠창) + 아래 회색 마름돌, 가운데 큰 미닫이 철문(경고 띠 문지방), 벽을 타는 관 둘과 바퀴 밸브.
    앞면 4줄 막힘(문 칸 3개만 걷기 — 공장 안), 지붕·굴뚝 걷기 + 가림."""
    W = wc * 16; H = 144
    tc = TC(W, H, seed)
    RT = 56; FT = 84                                                      # 톱날 지붕 시작·앞면 시작
    # 굴뚝(지붕 뒤)
    sx = [s * 16 + 8 for s in stacks]
    for i, x in enumerate(sx): stack_body(tc, x, 10 + i * 4, RT + 10, r=6, seed=seed + i)
    # 톱날 지붕: 띠 셋(위 → 아래), 띠마다 채광 유리 3px + 경사 지붕 결
    teeth = 3; th = (FT - RT) / teeth
    for t in range(teeth):
        ty0 = int(RT + t * th); ty1 = int(RT + (t + 1) * th)
        for y in range(ty0, ty1):
            for x in range(2, W - 2):
                r = y - ty0
                if r < 3:                                                   # 채광창(북쪽 유리 띠 끝이 보인다)
                    k = 3 if r == 0 else 2
                    if (x - 2) % 8 == 0: m, kk = 'steel', 4
                    else: m, kk = 'glass', k + (1 if (x + r) % 11 == 0 else 0)
                    tc.px(x, y, m, kk)
                elif r == 3: tc.px(x, y, 'steel', 5)
                else:
                    k = chip_tones(272, 224, 1, 4)[y % 16, x % 16] + (1 if r < 5 else 0)
                    if x >= W - 4: k -= 1
                    tc.px(x, y, 'roofk', clamp(k, 1, 6))
        tc.hline(2, W - 2, ty1 - 1, 'roofk', 1)
    # 앞면: 위 = 세로 골판(톤 줄무늬) + 띠창, 아래 22px = 마름돌
    for y in range(FT, H - 6):
        for x in range(2, W - 2):
            if y < H - 28:
                k = 4 if (x % 4) in (0, 1) else (3 if x % 4 == 2 else 2)
                if x < 4: k += 1
                if x >= W - 4: k -= 1
                if y < FT + 3: k = 1 + (y - FT)
                tc.px(x, y, 'steel', clamp(k, 1, 6))
            else:
                k = ashlar_k(x, y, 16, 8, seed + 3, 4)
                if x >= W - 4: k -= 1
                tc.px(x, y, 'gst', k)
    string_course(tc, 2, W - 2, H - 28)
    plinth(tc, 2, W - 2, H - 6, 6, seed=seed)
    for x in range(6, W - 6):                                             # 띠창(높은 창 줄)
        if (x - 6) % 20 < 16:
            for y in range(FT + 7, FT + 14): tc.px(x, y, 'glass', 2 if y < FT + 10 else 1)
            tc.px(x, FT + 6, 'steel', 5); tc.px(x, FT + 14, 'steel', 2)
    for x in range(6, W - 6, 20): tc.px(x + 1, FT + 8, 'glass', 5)
    # 미닫이 철문(칸 3~5) + 문지방 경고 띠
    dx0, dx1 = 3 * 16, 6 * 16; dy0 = H - 6 - 34
    for y in range(dy0, H - 6):
        for x in range(dx0, dx1):
            lx = x - dx0
            k = 3 if lx % 6 else 1
            if lx % 6 == 1: k = 4
            if y < dy0 + 3: k = 2
            tc.px(x, y, 'steel', k)
    for x in range(dx0 + 20, dx1):                                        # 한쪽이 열려 안이 어둡다
        for y in range(dy0 + 3, H - 6):
            if x < dx0 + 30: tc.px(x, y, 'dark', 2 if x < dx0 + 22 else 1)
    tc.hline(dx0 - 2, dx1 + 2, dy0 - 1, 'steel', 6); tc.hline(dx0 - 2, dx1 + 2, dy0 - 2, 'steel', 3)
    hazard(tc, dx0, H - 9, dx1, H - 6, seed + 7)
    # 벽을 타는 관 둘 + 밸브
    pipe_v(tc, 20, FT + 2, H - 8, 6, 'steel', step=16)
    pipe_v(tc, W - 22, FT + 2, H - 8, 6, 'brass', step=16)
    pipe_h(tc, 20, W - 22, FT + 22, 6, 'steel', step=16)
    for (vx, vy) in ((20, FT + 34), (W - 22, FT + 40)):
        tc.ell(vx, vy, 4, 4, 'redl', lambda x, y: 4 if (x + y) % 2 else 3)
        tc.px(vx, vy, 'steel', 5)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    for i, x in enumerate(sx):
        im.alpha_composite(smoke(26, 28, seed + 11 + i, 175), (x - 13, max(0, 10 + i * 4 - 27)))
    return im


def smokestack(seed=0, h=112):
    """홀로 선 큰 굴뚝 2x7칸: 네모 마름돌 받침(윗면 보임) + 리벳 테 강철 원통 + 갓, 짙은 연기. 받침 줄만 막힘."""
    W = 32; tc = TC(W, h, seed)
    stack_body(tc, 16, 26, h - 18, r=8, seed=seed, bands=14)
    for y in range(h - 22, h):                                            # 받침
        for x in range(2, 30):
            r = y - (h - 22)
            if r < 4: k = 6 if r == 0 else 5
            elif r == 4: k = 2
            else: k = ashlar_k(x, y, 12, 6, seed, 4) - (1 if x >= 28 else 0)
            if y >= h - 2: k = 1
            tc.px(x, y, 'gst', clamp(k, 1, 6))
    for x in range(6, 10): tc.px(x, h - 10, 'dark', 1); tc.px(x, h - 9, 'dark', 1); tc.px(x, h - 8, 'dark', 2)  # 청소 구멍
    for j in range(0, h - 46, 4):                                         # 사다리 발판
        tc.px(19, 30 + j, 'steel', 6); tc.px(20, 30 + j, 'steel', 6); tc.px(21, 30 + j, 'steel', 3)
    for y in range(30, h - 20): tc.px(18, y, 'steel', 2); tc.px(22, y, 'steel', 2)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6, shadow=(16, h - 2, 14, 3, 70))
    im.alpha_composite(smoke(30, 30, seed + 3, 185), (1, 0))
    return im


# ================================================================ 성벽·성문·포탑 (앵커 ④)
def wall_top(tc, x0, x1, y0=0, h=16, seed=0):
    """성벽 윗길(걷는 통로를 위에서): 회색 판석(칩셋 192,176 결) + 안쪽 턱 + 앞 끝 강철 덮개 흉벽(성가퀴: 판 + 총안)."""
    tt = chip_tones(192, 176, 3, 5)
    for y in range(y0, y0 + h):
        for x in range(x0, x1):
            r = y - y0
            if r == 0: k = 5
            elif r == 1: k = 3
            elif r < 10: k = tt[y % 16, x % 16]
            else: k = None
            if k is not None: tc.px(x, y, 'gst', k)
    for x in range(x0, x1):                                               # 흉벽(강철 판 성가퀴)
        m = ((x - x0) % 10) < 7
        for j in range(6):
            y = y0 + 10 + j
            if m: k = 6 if j == 0 else (5 if j < 2 else (4 if j < 5 else 2))
            else: k = None if j < 2 else (2 if j == 2 else 3)
            if k is not None: tc.px(x, y, 'steel', k)
        if m and (x - x0) % 10 == 6:
            for j in range(1, 6): tc.px(x, y0 + 10 + j, 'steel', 2)
        if m and (x - x0) % 10 == 1: tc.px(x, y0 + 13, 'steel', 6)


def wall(n=4, seed=0, banners=(), slits=True, drain=False):
    """성벽 n x 4칸: 윗줄 = 성벽 윗길 + 강철 흉벽, 앞면 3줄 = 위 회청 철판(리벳) + 아래 회색 마름돌 + 받침. 총안 틈.
    앞면 3줄 막힘, 윗길 줄은 걷기 + 가림(지도에서는 끝이 탑·성문·지도 끝으로 닫힌다)."""
    W = n * 16; H = 64; tc = TC(W, H, seed)
    wall_top(tc, 0, W, 0, 16, seed)
    iron_face(tc, 0, 16, W, 36, seed=seed, base=3, oy=4)
    for x in range(W):                                                    # 철판 아래 끝 쇠 테 + 물끊기
        tc.px(x, 36, 'steel', 5); tc.px(x, 37, 'steel', 2)
    stone_face(tc, 0, 38, W, H - 6, 16, 8, seed + 5, base=4, shade_r=False)
    plinth(tc, 0, W, H - 6, 6, seed=seed)
    for k in range(n):
        if slits and k % 2 == 1 and k not in [b for b in banners]: slit(tc, k * 16 + 7, 22, 9)
    if drain:
        for y in range(48, 54):
            for x in range(W // 2 - 3, W // 2 + 3): tc.px(x, y, 'dark', 1 if y > 49 else 2)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    for k in banners:
        b = TC(10, 24, seed + k); flag_banner(b, 1, 0, 8, 23); im.alpha_composite(b.fin(.7), (k * 16 + 3, 17))
    return im


def gatehouse(seed=0):
    """남쪽 성문 7x6칸: 네모 성문 탑 — 윗면(판석 + 강철 흉벽, 모서리 쇠 기둥), 앞면 위 철판·아래 마름돌, 가운데 3칸 문길
    (두꺼운 돌 문틀, 강철 상인방, 들어 올린 쇠살문 끝, 경고 띠 문설주, 안은 어두운 통로 바닥), 문 위 단색 걸개 둘과 신호등.
    앞면 막힘, 가운데 3칸 문길은 걷기(성 밖 ↔ 대로)."""
    W, H = 112, 96; tc = TC(W, H, seed)
    wall_top(tc, 0, W, 0, 16, seed)
    for y in range(0, 16):                                                # 탑 윗면은 성벽보다 넓은 판석(흉벽 앞으로 나온다)
        for x in (0, 1, W - 2, W - 1): tc.px(x, y, 'steel', 5 if x < 2 else 2)
    iron_face(tc, 0, 16, W, 50, seed=seed, base=3)
    for x in range(W): tc.px(x, 50, 'steel', 5); tc.px(x, 51, 'steel', 2)
    stone_face(tc, 0, 52, W, H - 6, 16, 8, seed + 5, base=4)
    plinth(tc, 0, W, H - 6, 6, seed=seed)
    # 문길(칸 2~4 = 32..80)
    gx0, gx1, gy0 = 32, 80, 42
    for y in range(gy0 - 8, H):                                           # 두꺼운 돌 문틀
        for x in range(gx0 - 6, gx1 + 6):
            if gx0 <= x < gx1 and y >= gy0: continue
            k = 6 if x < gx0 - 4 else (5 if x < gx0 else (3 if x >= gx1 + 3 else 4))
            if y < gy0 - 5: k = 6 if y == gy0 - 8 else 5
            elif y < gy0: k = 'L'
            if k == 'L': tc.px(x, y, 'steel', 4 if (x - gx0) % 8 else 6); continue        # 강철 상인방(리벳)
            if (y - gy0) % 10 == 9 and y > gy0: k = 2
            tc.px(x, y, 'gst', k)
    tc.hline(gx0 - 6, gx1 + 6, gy0 - 1, 'steel', 1)
    for y in range(gy0, H):                                               # 통로 안(그늘 + 먼 출구 빛)
        f = (y - gy0) / (H - gy0)
        for x in range(gx0, gx1):
            k = 1 if f < .35 else 2
            if f > .62:
                k = 2 + (1 if f > .85 else 0)
                if (x - gx0) % 16 == 15 or (y - gy0) % 9 == 8: k = 1
            tc.px(x, y, 'gst' if f > .62 else 'dark', k)
    for x in range(gx0, gx1):                                             # 들어 올린 쇠살문 끝(톱니)
        for j in range(5):
            if (x - gx0) % 6 in (0, 1) or j < 2: tc.px(x, gy0 + j, 'steel', 4 if j < 2 else 3)
        if (x - gx0) % 6 == 0: tc.px(x, gy0 + 5, 'steel', 5); tc.px(x + 1, gy0 + 6, 'steel', 2)
    hazard(tc, gx0 - 3, gy0 + 8, gx0, H - 6, seed + 1); hazard(tc, gx1, gy0 + 8, gx1 + 3, H - 6, seed + 2)
    for k in (1, 5): slit(tc, k * 16 + 7, 24, 10)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    for bx in (10, W - 20):
        b = TC(10, 28, seed + bx); flag_banner(b, 1, 0, 8, 27); im.alpha_composite(b.fin(.7), (bx, 18))
    g = TC(10, 6); g.ell(5, 3, 3, 2.4, 'redl', 5); g.px(4, 2, 'redl', 6)
    im.alpha_composite(D.glow(16, SIGNAL['red'][5], 60, 8, 8, 7), (48, 22)); im.alpha_composite(g.fin(.7), (51, 27))
    return im


def turret(seed=0, flip=False, light=True):
    """감시 포탑 3x7칸: 네모 마름돌 탑(앞면 아래 돌·위 철판, 총안), 꼭대기 강철 난간 발판 위 둥근 포탑(돔 + 짧은 포신 + 관측 틈),
    포탑 옆 서치라이트(둥근 갓, 빛나는 렌즈). 탑 앞면 아래 3줄 막힘, 위는 걷기 + 가림."""
    W, H = 48, 112; tc = TC(W, H, seed)
    BT = 52                                                               # 탑 앞면 시작
    # 탑 윗면(발판: 판석 + 난간)
    tt = chip_tones(192, 176, 3, 5)
    for y in range(40, BT):
        for x in range(1, W - 1):
            tc.px(x, y, 'gst', tt[y % 16, x % 16] if y > 41 else 6)
    iron_face(tc, 1, BT, W - 1, 82, seed=seed, base=3)
    for x in range(1, W - 1): tc.px(x, BT, 'steel', 6); tc.px(x, BT + 1, 'steel', 4)
    for x in range(1, W - 1):                                             # 내민 받침(돌출 띠: 마치콜레이션 홈)
        for j in range(5):
            y = 82 + j
            k = (5, 4, 3, 2, 1)[j]
            if (x - 1) % 8 in (6, 7) and j > 1: k = 1
            tc.px(x, y, 'gst', k)
    stone_face(tc, 3, 87, W - 3, H - 6, 12, 8, seed + 4, base=4)
    plinth(tc, 3, W - 3, H - 6, 6, seed=seed)
    slit(tc, 23, 62, 10); slit(tc, 23, 94, 8)
    # 포탑 돔
    FM.sphere(tc, 24, 30, 18, 'steel', ry=14, base=0)
    for y in range(18, 44):                                               # 돔 판 이음(세로 둘) + 리벳
        for x in (17, 31):
            g = tc.get(x, y)
            if g: tc.px(x, y, 'steel', max(1, g[1] - 1))
    for (x, y) in ((14, 26), (20, 21), (28, 21), (34, 26)): tc.px(x, y, 'steel', 6)
    for x in range(10, 39):                                               # 포탑 아래 테(회전 고리)
        tc.px(x, 42, 'steel', 5 if x < 24 else 3); tc.px(x, 43, 'steel', 2); tc.px(x, 44, 'steel', 1)
    for x in range(14, 34): tc.px(x, 35, 'dark', 1)                       # 관측 틈
    for x in range(14, 34): tc.px(x, 36, 'steel', 5)
    pb = (lambda x: W - 1 - x) if flip else (lambda x: x)
    for i in range(16):                                                   # 짧은 포신(앞 왼쪽으로 기울게)
        bx = 12 - i * .55; by = 38 + i * .55
        for j in range(4): tc.px(pb(int(bx)), int(by) + j - 1, 'steel', (5, 4, 3, 1)[j])
    for j in range(5): tc.px(pb(3), 45 + j - 2, 'steel', 2)
    # 난간 기둥 + 줄
    for x in (2, 14, 33, 45):
        for y in range(36, 52): tc.px(x, y, 'steel', 4 if y > 36 else 6)
    for x in range(2, 46): tc.px(x, 37, 'steel', 5); tc.px(x, 44, 'steel', 3)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    if light:                                                             # 서치라이트(포탑 돔 위, 받침 기둥)
        sl = searchlight_head(seed + 2)
        im.alpha_composite(sl, (16 if not flip else 16, 0))
    return im


def searchlight_head(seed=0):
    """서치라이트 머리(14x18): 강철 둥근 갓을 왼쪽 위로 들고, 앞 렌즈가 빛난다(청백), 받침 갈퀴."""
    tc = TC(16, 18, seed)
    FP.cyl(tc, 8, 4, 6, 3, 6, 'steel', top='glass', topk=6, seed=seed)
    tc.ell(8, 4, 4.4, 2, 'glass', lambda x, y: 6 if x < 8 else 5)
    for y in range(12, 18): tc.px(5, y, 'steel', 5); tc.px(11, y, 'steel', 2)
    tc.hline(4, 13, 17, 'steel', 1)
    im = tc.fin(.7)
    o = new(16, 18); o.alpha_composite(D.glow(16, (220, 250, 255), 60, 8, 5, 8), (0, 0)); o.alpha_composite(im)
    return o


# ================================================================ 성채 (앵커 ①)
def tower_sq(tc, x0, W, ytop, ybot, roof_h, seed=0, roof='roofk'):
    """네모 탑(성채 양 날개 사이): 뾰족 네모 지붕(검은 슬레이트·강철 추녀마루) + 내민 받침 띠 + 위 철판·아래 마름돌, 총안·창."""
    yf = ytop + roof_h                                                    # 앞면 시작
    iron_face(tc, x0 + 1, yf, x0 + W - 1, yf + 60, seed=seed, base=3)
    for x in range(x0 + 1, x0 + W - 1):                                   # 지붕 밑 내민 받침(홈 띠)
        for j in range(6):
            k = (6, 5, 4, 3, 2, 1)[j]
            if (x - x0 - 1) % 8 in (6, 7) and j > 1: k = 1
            tc.px(x, yf + j, 'gst', k)
    stone_face(tc, x0 + 1, yf + 60, x0 + W - 1, ybot - 6, 12, 8, seed + 3, base=4)
    string_course(tc, x0 + 1, x0 + W - 1, yf + 60)
    plinth(tc, x0 + 1, x0 + W - 1, ybot - 6, 6, seed=seed)
    window(tc, x0 + W // 2 - 3, yf + 14, 6, 12, seed=seed)
    slit(tc, x0 + W // 2 - 1, yf + 40, 10)
    slit(tc, x0 + W // 2 - 1, yf + 76, 9)
    roof_pyramid(tc, x0 - 2, ytop, W + 4, roof_h + 2, roof)
    cx = x0 + W // 2
    for y in range(ytop - 14, ytop + 2): tc.px(cx - 1, y, 'steel', 5); tc.px(cx, y, 'steel', 2)      # 깃대
    flag_pennant(tc, cx, ytop - 14, 12, 6)


def citadel(seed=0):
    """철골과 석재의 대형 성채 25x15칸(400x240): 가운데 본채(9칸, 3층: 위 둘 철판·아래 마름돌, 회청 모임지붕, 굴뚝 둘과 연기,
    지붕 밑 내민 받침 띠, 가운데 3칸 큰 겹 철문 + 강철 상인방 + 단색 걸개 둘), 양옆 네모 탑(3칸, 검은 뾰족 지붕 + 단색 삼각 깃발),
    바깥 날개(5칸, 2층, 회청 모임지붕, 굴뚝). 앞면 전부 막힘, 본채 문 가운데 3칸만 걷기(성채 안으로 가는 문). 지붕 줄 걷기 + 가림."""
    W, H = 400, 240; tc = TC(W, H, seed)
    GB = H                                                                # 땅 선
    # --- 바깥 날개 (0..80, 320..400)
    for (wx, fl) in ((0, False), (320, True)):
        yr = 92; yf = yr + 44
        iron_face(tc, wx, yf, wx + 80, yf + 32, seed=seed + wx, base=3)
        stone_face(tc, wx, yf + 32, wx + 80, GB - 6, 16, 8, seed + 4 + wx, base=4)
        string_course(tc, wx, wx + 80, yf + 32)
        plinth(tc, wx, wx + 80, GB - 6, 6, seed=seed)
        for c in range(5):
            window(tc, wx + c * 16 + 5, yf + 9, 6, 12, seed=seed + c, lit=(c == 2 and not fl))
            window(tc, wx + c * 16 + 5, yf + 44, 6, 11, seed=seed + c + 9, shutter=_hash(c, wx, 3) < .4)
        eave_shadow(tc, wx, wx + 80, yf, 4)
        roof_hip(tc, wx, yr, 80, 44, 'roofb', ends=('L' if not fl else 'R'))
        chimney(tc, wx + (12 if not fl else 60), yr - 8, 8, 18)
    # --- 본채 (128..272)
    KX0, KX1 = 128, 272
    yr = 44; yf = yr + 56
    for x in range(KX0, KX1):                                             # 내민 받침 띠(처마 밑)
        for j in range(7):
            k = (6, 5, 4, 4, 3, 2, 1)[j]
            if (x - KX0) % 12 in (10, 11) and j > 1: k = 1
            tc.px(x, yf + j, 'gst', k)
    iron_face(tc, KX0, yf + 7, KX1, yf + 39, seed=seed + 1, base=3)
    string_course(tc, KX0, KX1, yf + 39)
    iron_face(tc, KX0, yf + 42, KX1, yf + 74, seed=seed + 2, base=3, oy=8)
    string_course(tc, KX0, KX1, yf + 74)
    stone_face(tc, KX0, yf + 77, KX1, GB - 6, 16, 8, seed + 6, base=4)
    plinth(tc, KX0, KX1, GB - 6, 6, seed=seed)
    for c in range(9):
        cx = KX0 + c * 16 + 5
        window(tc, cx, yf + 16, 6, 14, seed=seed + c, lit=(c in (1, 7)))
        if c not in (3, 4, 5): window(tc, cx, yf + 50, 6, 14, seed=seed + c + 30, lit=(c == 6))
        if c not in (2, 3, 4, 5, 6): window(tc, cx, yf + 88, 6, 12, seed=seed + c + 60, shutter=True)
    # 큰 겹 철문 (칸 3~5 → 176..224)
    gx0, gx1 = 176, 224; gy0 = GB - 6 - 50
    for y in range(gy0 - 12, GB - 6):                                     # 돌 문틀(두꺼운 마름돌 기둥 + 강철 상인방)
        for x in range(gx0 - 8, gx1 + 8):
            if gx0 <= x < gx1 and y >= gy0: continue
            if y < gy0:
                k = 6 if y == gy0 - 12 else (5 if y < gy0 - 9 else (4 if (x - gx0) % 8 else 6))
                if y == gy0 - 1: k = 1
                tc.px(x, y, 'steel' if y >= gy0 - 9 else 'gst', k); continue
            k = 6 if x < gx0 - 6 else (5 if x < gx0 else (3 if x >= gx1 + 5 else 4))
            if (y - gy0) % 10 == 9: k = 2
            tc.px(x, y, 'gst', k)
    iron_door(tc, gx0, gy0, gx1 - gx0, 50, seed, double=True, window=False)
    for y in range(gy0, GB - 6):                                          # 문짝 큰 쇠띠(가로 셋 더) + 가운데 이음
        if (y - gy0) % 12 == 6:
            for x in range(gx0, gx1): tc.px(x, y, 'steel', 5); tc.px(x, y + 1, 'steel', 1)
    for (lx, ly) in ((gx0 + 18, gy0 + 26), (gx1 - 20, gy0 + 26)):           # 고리 손잡이
        tc.ell(lx + 1, ly, 2.5, 2.5, 'brass', 4); tc.px(lx + 1, ly, 'steel', 1)
    eave_shadow(tc, KX0 + 2, KX1 - 2, yf, 3)
    roof_hip(tc, KX0 - 2, yr, KX1 - KX0 + 4, 56, 'roofb')
    for i, cx in enumerate((KX0 + 22, KX1 - 30)): chimney(tc, cx, yr - 14, 8, 22)
    # --- 네모 탑 (80..128, 272..320)
    for tx in (80, 272):
        tower_sq(tc, tx, 48, 20, GB, 52, seed + tx, 'roofk')
        for y in range(72, GB):                                           # 탑이 한 걸음 앞에 선다: 경계 1px 어둠 + 오른쪽 이웃에 그늘 3px
            for x in (tx, tx + 47): tc.px(x, y, 'steel' if tc.get(x, y) and tc.get(x, y)[0] == 'steel' else 'gst', 1)
            for j in range(1, 4):
                if tc.get(tx + 47 + j, y) and y > 76: tc.shift(tx + 47 + j, y, -1 if j > 1 else -2)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    for i, cx in enumerate((KX0 + 22, KX1 - 30)):
        im.alpha_composite(smoke(22, 26, seed + 31 + i, 160), (cx - 7, 0))
    for (wx, fl) in ((0, False), (320, True)):
        cx = wx + (12 if not fl else 60); im.alpha_composite(steam(14, 12, seed + wx, 110), (cx - 3, 72))
    for bx in (gx0 - 30, gx1 + 20):                                       # 문 양옆 걸개(본채 2층 높이)
        b = TC(12, 40, seed + bx); flag_banner(b, 1, 0, 10, 38); im.alpha_composite(b.fin(.7), (bx, yf + 42))
    return im


def citadel_stairs(w=5, seed=0):
    """성채 정문 앞 돌계단 5x2칸: 단마다 밝은 디딤 윗면 + 어두운 챌면, 양쪽 낮은 돌 난간 끝. 걷기."""
    W, H = w * 16, 32; tc = TC(W, H, seed)
    for y in range(H):
        r = y % 6
        for x in range(4, W - 4):
            k = 6 if r == 0 else (5 if r < 3 else (3 if r < 5 else 2))
            if x < 6: k += 0
            tc.px(x, y, 'gst', k)
    for (x0, x1) in ((0, 5), (W - 5, W)):
        for y in range(H):
            for x in range(x0, x1):
                k = 6 if y < 2 else (5 if x < x0 + 2 else 3)
                if y >= H - 2: k = 2
                tc.px(x, y, 'gst', k)
    tc.grain(.04, mats=('gst',))
    return tc.fin(.75)


# ================================================================ 창고 (공장 지구)
def warehouse(wc=6, seed=0):
    """보급 창고 6x6칸: 낮고 넓은 강철 골판 창고 — 검은 박공 지붕(양 끝 강철 박공널, 지붕 가운데 채광 띠), 세로 골판 앞면,
    가운데 큰 미닫이 철문(반쯤 열려 안에 상자 더미), 문 위 호박색 등, 아래 회색 마름돌 받침. 앞면 3줄 막힘(문 칸 2개 걷기)."""
    W = wc * 16; Rh = 38; pad = 4; FH = 50
    H = pad + Rh + FH
    tc = TC(W, H, seed)
    yb = pad + Rh
    for y in range(yb, H - 6):
        for x in range(2, W - 2):
            if y < H - 18:
                k = 4 if (x % 4) in (0, 1) else (3 if x % 4 == 2 else 2)
                if x < 4: k += 1
                if x >= W - 4: k -= 1
                tc.px(x, y, 'steel', clamp(k, 1, 6))
            else:
                k = ashlar_k(x, y, 16, 6, seed + 3, 4) - (1 if x >= W - 4 else 0)
                tc.px(x, y, 'gst', k)
    string_course(tc, 2, W - 2, H - 18)
    plinth(tc, 2, W - 2, H - 6, 6, seed=seed)
    d0 = (wc // 2 - 1) * 16 + 2; d1 = d0 + 28; dy0 = H - 6 - 32
    for y in range(dy0, H - 6):
        for x in range(d0, d1):
            lx = x - d0
            if lx >= 14:                                                  # 열린 쪽: 안 어둠 + 상자
                tc.px(x, y, 'dark', 1 if lx > 15 else 2)
            else:
                k = 3 if lx % 5 else 1
                if lx % 5 == 1: k = 4
                tc.px(x, y, 'steel', k)
    crate(tc, d0 + 16, dy0 + 12, 10, 8, 4, seed)
    tc.hline(d0 - 2, d1 + 2, dy0 - 1, 'steel', 6); tc.hline(d0 - 2, d1 + 2, dy0 - 2, 'steel', 2)
    eave_shadow(tc, 2, W - 2, yb, 3)
    roof_hip(tc, 0, pad, W, Rh, 'roofk', ends=False)
    for x in range(8, W - 8):                                             # 지붕 채광 띠(뒤 경사)
        for y in range(pad + 7, pad + 11):
            if (x - 8) % 10 < 8: tc.px(x, y, 'glass', 3 if y == pad + 7 else 2)
    tc.grain(.03, mats=('gst',))
    im = tc.fin(.6)
    g = D.glow(16, SIGNAL['amber'][5], 60, 8, 8, 7); im.alpha_composite(g, (d0 + 6, dy0 - 14))
    lamp = TC(8, 6); lamp.ell(4, 3, 3, 2.4, 'amber', 5); lamp.px(3, 2, 'amber', 6); lamp.hline(0, 8, 0, 'steel', 4)
    im.alpha_composite(lamp.fin(.7), (d0 + 10, dy0 - 9))
    return im


def crate(tc, x0, y0, w=14, h=12, top=5, seed=0, mat='drab'):
    from ec_props import crate as _c
    return _c(tc, x0, y0, w, h, top, seed, mat)
