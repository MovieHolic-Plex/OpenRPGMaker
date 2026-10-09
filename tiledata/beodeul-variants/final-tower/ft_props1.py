# 최종 탑 조각 1 — 하부 잔해 더미 층: 거대한 잔해 더미(오르는 길), 잔해 무더기, 쓰러진 갈비뼈, 휜 철골, 부서진 기계, 깨진 유리 통,
# 화물 승강기(바닥 판 + 벽 앞면 승강로). 톤 캔버스 + 미래 폐허 기계 재질 규약, 뼈·탑 돌 램프. 3/4 시점, 빛 왼쪽 위.
import math
import numpy as np
from ft_base import *
from ft_base import _hash
from ft_debris import *

# ---------------------------------------------------------------- ① 거대한 잔해 더미
MOUND_W, MOUND_H = 16, 9
# 오르는 길(조각 안 칸 좌표, 위 = 0). 남쪽 기슭(아래 가운데)에서 오른쪽 위로 비스듬히 올라 꼭대기 틈에서 왼쪽으로 꺾여 북쪽으로 넘어간다.
MOUND_PATH = {(7, 8), (8, 8), (7, 7), (8, 7), (8, 6), (9, 6), (9, 5), (10, 5), (10, 4), (11, 4),
              (8, 3), (9, 3), (10, 3), (11, 3), (8, 2), (9, 2), (8, 1), (9, 1), (8, 0), (9, 0)}
MOUND_FOOT_TOP = 3        # 이 줄부터 아래가 더미 발자국(막힘, 길 칸 제외). 위 0~2 줄은 꼭대기·뒤쪽(북쪽 방 바닥 위, 걷기+가림)

def _mound_profile(seed=3):
    W = MOUND_W * T
    top = np.zeros(W); bot = np.zeros(W)
    for x in range(W):
        u = x / (W - 1)
        hump = max(math.exp(-((u - .34) / .2) ** 2), .92 * math.exp(-((u - .7) / .17) ** 2))   # 두 봉우리(왼쪽이 높다)
        crest = 50 - 36 * hump + 5 * vnoise(x, 0, 9, seed) + 3 * vnoise(x, 0, 3, seed + 1)
        e = min(x, W - 1 - x)                                     # 양 끝: 벽 덩이 모서리에 기대어 둥글게 흘러내린다
        top[x] = crest + (34 * (1 - e / 18) ** 2 if e < 18 else 0)
        bot[x] = 140 - 4 * vnoise(x, 0, 6, seed + 2) - (3 if _hash(x // 5, 0, seed) < .3 else 0) - (10 * (1 - e / 10) ** 2 if e < 10 else 0)
    return top, bot

def rubble_mound(seed=11):
    """거대한 잔해 더미 16x9(256x144): 부서진 강철판·마름돌·뼈·갈비·관·톱니·유리가 쌓인 언덕. 남쪽 기슭에서 강철 디딤판 길이
    오른쪽 위로 비스듬히 올라 꼭대기 틈을 넘는다. 꼭대기에서 철골 둘이 비스듬히 솟고, 왼쪽 비탈에 거대한 갈비뼈가 휘어 나왔다."""
    W, H = MOUND_W * T, MOUND_H * T
    top, bot = _mound_profile(seed)
    inside = lambda x, y: top[x] <= y <= bot[x]
    def height(x, y):
        return max(0.0, min(1.0, (bot[x] - y) / max(1.0, bot[x] - 14)))
    def toff(x, y):                                               # 꼭대기 밝게, 기슭 어둡게, 오른쪽 비탈 한 단 그늘
        h = height(int(x), int(y)); k = 1 if h > .7 else (0 if h > .42 else (-1 if h > .18 else -2))
        if x > W * .82 and h < .6: k -= 1
        return k
    # 길 화소 마스크: 칸을 가로 1px 씩 줄이고, 꺾이는 자리는 둥글게 이어 붙인다
    pm = np.zeros((H, W), bool)
    for (cx, cy) in MOUND_PATH:
        pm[cy * T:(cy + 1) * T, cx * T + 1:(cx + 1) * T - 1] = True
    from scipy import ndimage as ndi
    pm = ndi.binary_closing(pm, structure=np.ones((5, 5)))
    ins = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W): ins[y, x] = inside(x, y)
    pm &= ins
    r = rng(seed)
    feats = []
    feats.append((ch_girder(seed + 1, 46, -1.15), 62, 44))        # 꼭대기 왼쪽에서 솟은 철골
    feats.append((ch_girder(seed + 2, 40, -2.05), 196, 40))       # 오른쪽 철골(반대로 기움)
    feats.append((ch_girder(seed + 3, 30, -.2), 226, 92))
    rib = ch_rib(seed + 4, 26, 3.55, 5.15, th=6.0); feats.append((rib, 46, 96))      # 거대한 갈비뼈(왼쪽 비탈)
    rib2 = ch_rib(seed + 5, 20, 3.7, 5.0, th=5.0); feats.append((rib2, 70, 100))
    feats.append((ch_gear(seed + 6, 11), 190, 112))               # 큰 놋쇠 톱니(오른쪽 비탈)
    feats.append((ch_pipe(seed + 7, 30, 10), 118, 56))            # 꼭대기 굵은 관 토막
    feats.append((ch_bone(seed + 8, 30, .25, r0=3.0, knob=3.0), 30, 128))   # 큰 넓적다리뼈(왼쪽 기슭)
    feats.append((ch_bone(seed + 9, 24, 2.9, r0=2.6, knob=2.6), 218, 134))
    for i in range(5): feats.append((ch_glass(seed + 20 + i, 7 + i % 3), 150 + i * 9, 132 - (i % 2) * 6))
    for i, (x, y) in enumerate(((40, 70), (100, 88), (176, 76), (210, 66), (24, 104), (234, 112))):
        feats.append((ch_plate(seed + 30 + i, 18 + i % 3 * 3, 11 + i % 2 * 2, 'steel' if i % 3 else 'rust'), x, y))
    for i in range(5): feats.append((ch_vert(seed + 40 + i), 150 + i * 8, 70 + i * 3))           # 꼭대기를 가로지르는 척추 마디 줄
    MK = [('plate', .38), ('stone', .34), ('bone', .05), ('rib', .02), ('girder', .08), ('pipe', .06), ('glass', .03), ('gear', .02), ('vert', .02)]
    tc, _ = pile(W, H, inside, height, seed, path=pm, kinds=MK, size=(10, 20), density=1.0, features=feats, toff_fn=toff)
    path_steps(tc, pm, seed + 50, step_h=6)
    # 철골 꼭대기에 걸쳐 늘어진 전선
    cable(tc, 40, 18, 92, 30, sag=10)
    cable(tc, 180, 20, 214, 30, sag=8)
    # 깨진 핵 조각 빛 점 둘(보라)
    for (x, y) in ((104, 76), (205, 96)):
        for (dx, dy, k) in ((0, 0, 6), (1, 0, 5), (0, 1, 5), (-1, 0, 4), (0, -1, 4)): tc.px(x + dx, y + dy, 'viol', k)
    tc.grain(.03)
    im = tc_fin(tc, .62)
    o = new(W, H)
    o.alpha_composite(glow_img(W, H, 104, 76, 12, 9, VIOL[4], 70)); o.alpha_composite(glow_img(W, H, 205, 96, 10, 8, VIOL[4], 60))
    o.alpha_composite(im)
    return shadow_under(o, W // 2, H - 2, W // 2 - 6, 3, 70)

def mound_block():
    """더미 발자국(막힘 칸, 왼쪽 아래 칸 기준 (dx, -dy)). 길 칸과 꼭대기 위 줄은 걷기."""
    out = []
    for cy in range(MOUND_FOOT_TOP, MOUND_H):
        for cx in range(MOUND_W):
            if (cx, cy) not in MOUND_PATH: out.append((cx, -(MOUND_H - 1 - cy)))
    return out

# ---------------------------------------------------------------- 작은 무더기
def rubble_heap(seed=21, w=4, h=3, kinds=KINDS):
    """잔해 무더기 4x3: 강철판·마름돌·뼈·관이 쌓인 낮은 언덕. 아래 2줄 막힘."""
    W, H = w * T, h * T
    cx = W / 2
    top = lambda x: 10 + 10 * abs((x - cx) / (W / 2)) ** 1.5 + 4 * vnoise(x, 0, 6, seed)
    inside = lambda x, y: top(x) <= y <= H - 3 - 2 * vnoise(x, 0, 5, seed + 1) and abs(x - cx) < W / 2 - 1
    height = lambda x, y: max(0, min(1, (H - 3 - y) / max(1, H - 3 - top(x))))
    feats = [(ch_girder(seed + 1, 26, -.9), int(W * .62), 22), (ch_bone(seed + 2, 18, .2, r0=2.4, knob=2.4), int(W * .3), H - 4)]
    tc, _ = pile(W, H, inside, height, seed, size=(8, 14), kinds=kinds, features=feats)
    tc.grain(.03)
    return shadow_under(tc_fin(tc, .62), W // 2, H - 2, W // 2 - 3, 2, 70)

def rubble_small(seed=31):
    """작은 잔해 2x2: 판 조각·마름돌·뼈 하나씩. 아랫줄 막힘."""
    W, H = 32, 32; cx = 16
    inside = lambda x, y: 12 + 6 * abs((x - cx) / 15) ** 1.4 <= y <= 29 and abs(x - cx) < 15
    height = lambda x, y: max(0, min(1, (29 - y) / 16))
    tc, _ = pile(W, H, inside, height, seed, size=(7, 12), features=[(ch_plate(seed + 1, 14, 9), 12, 22)])
    return shadow_under(tc_fin(tc, .62), 16, 30, 13, 2, 70)

def bone_scatter(seed=41):
    """흩어진 뼈 2x1(바닥 장식): 긴 뼈 둘·갈비 하나·척추 마디 둘. 걷기."""
    tc = TC(32, 16, seed)
    paste_ol(tc, ch_bone(seed + 1, 15, .25, r0=1.8), 1, 4)
    paste_ol(tc, ch_bone(seed + 2, 11, 2.7, r0=1.6), 15, 7)
    paste_ol(tc, ch_rib(seed + 3, 7, 3.6, 5.4, th=2.6), 12, -1)
    paste_ol(tc, ch_vert(seed + 4), 21, 6); paste_ol(tc, ch_vert(seed + 5), 3, 7)
    return tc_fin(tc, .7)

def plate_scatter(seed=45):
    """흩어진 판 조각 2x1(바닥 장식): 깨진 강철판 둘·유리 조각·나사. 걷기."""
    tc = TC(32, 16, seed)
    paste_ol(tc, ch_plate(seed + 1, 13, 7), 2, 6); paste_ol(tc, ch_plate(seed + 2, 9, 6, 'rust'), 18, 8)
    paste_ol(tc, ch_glass(seed + 3, 6), 14, 2); paste_ol(tc, ch_glass(seed + 4, 5), 26, 3)
    for (x, y) in ((11, 13), (29, 13), (16, 14)): tc.px(x, y, 'steel', 5); tc.px(x + 1, y, 'steel', 1)
    return tc_fin(tc, .7)

# ---------------------------------------------------------------- 쓰러진 거대 갈비뼈 · 휜 철골
def giant_rib_fallen(seed=51):
    """쓰러진 거대 갈비뼈 4x2: 바닥에 눕힌 거대한 휜 뼈(위에서 본 초승달 꼴, 윗면 밝고 앞 모 3px 그늘), 왼쪽 끝 둥근 관절 혹,
    오른쪽 끝은 부러진 단면, 결 줄·금, 밑에 깔린 판 조각. 아랫줄 막힘."""
    W, H = 64, 32; tc = TC(W, H, seed)
    paste_ol(tc, ch_plate(seed + 1, 14, 8), 44, 21)
    cx, cy, rx, ry = 34, 30, 28, 17
    pts = []
    for i in range(80):
        a = math.pi * (1.08 + .8 * i / 79)
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a), i / 79))
    th0 = 4.4
    for y in range(H):
        for x in range(W):
            best = None
            for (px_, py_, f) in pts:
                d = math.hypot(x + .5 - px_, (y + .5 - py_) * 1.2)
                if best is None or d < best[0]: best = (d, f, px_, py_)
            d, f, px_, py_ = best
            w = th0 * (1 - .35 * f) + (2.2 * max(0, (.08 - f) / .08) if f < .08 else 0)
            if d > w: continue
            up = (py_ - (y + .5))                                    # 중심선보다 위 = 윗면 쪽(밝다)
            k = 5 if up > w * .25 else (4 if up > -w * .3 else 3)
            if up < -w * .7: k = 2
            if (int(f * 60) % 7 == 0) and -w * .3 < up < w * .4: k -= 1  # 결 줄
            if f > .96: k = 2 if (x + y) % 3 else 1                   # 부러진 단면
            tc.px(x, y, 'bone', k)
    for x in range(W):                                               # 앞 모 두께(아래로 3px)
        col = [y for y in range(H) if tc.get(x, y) and tc.get(x, y)[0] == 'bone']
        if col:
            yb = col[-1]
            for d_, k in ((1, 2), (2, 2), (3, 1)):
                if yb + d_ < H and not tc.get(x, yb + d_): tc.px(x, yb + d_, 'bone', k)
    tc.line(18, 12, 24, 10, 'bone', 2)                                # 금
    return shadow_under(tc_fin(tc, .62), 32, 29, 28, 3, 70)

def girder_bent(seed=61):
    """휜 철골 3x2: 가운데가 꺾여 휜 H 형강 하나(윗 플랜지 빛줄·웨브 그늘·리벳)와 찢긴 끝, 밑에 깔린 마름돌. 아랫줄 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    paste_ol(tc, ch_stone(seed + 1, 12, 9), 30, 21)
    paste_ol(tc, ch_girder(seed + 2, 28, -.32), 0, 9)
    paste_ol(tc, ch_girder(seed + 3, 24, .45), 20, 8)
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 4)
    return shadow_under(tc_fin(tc, .62), 24, 30, 20, 2, 70)

# ---------------------------------------------------------------- 부서진 기계 · 깨진 유리 통
def machine_wreck(seed=71):
    """부서진 기계 몸통 3x3: 강철판 상자(윗면 환풍 창살, 앞면 판 줄눈·리벳·녹물), 뜯긴 옆구리로 쏟아진 전선과 관, 꺼진 표시등. 아래 2줄 막힘."""
    W, H = 48, 48; tc = TC(W, H, seed)
    box(tc, 4, 10, 42, 46, 10, 'steel', base=3, seed=seed)
    panels(tc, 5, 21, 41, 45, 'steel', 3, 16, 12, stagger=True, rivets=True, face='front', seed=seed, vary=1)
    for x in range(10, 34, 3):                                                # 윗면 환풍 창살
        for y in range(12, 18): tc.px(x, y, 'dark', 1); tc.px(x + 1, y, 'steel', 5)
    # 뜯긴 오른쪽 위 모서리
    for y in range(10, 30):
        for x in range(30, 43):
            if (x - 30) + (y - 10) * .9 < 14 and (x - 30) > (y - 10) * .25:
                if (x - 30) + (y - 10) * .9 > 12: tc.px(x, y, 'steel', 5)
                else: tc.m[y, x] = 0
    for y in range(13, 28):
        for x in range(32, 41):
            if tc.m[y, x] == 0 and (x - 32) + (y - 13) * .9 < 11: tc.px(x, y, 'dark', 1 + (1 if (x + y) % 5 == 0 else 0))
    cable(tc, 33, 18, 45, 40, sag=4); cable(tc, 35, 20, 47, 44, sag=3, mat='cable')
    pipe_v(tc, 38, 22, 34, 4, 'brass', flange=False)
    tc.ell(12, 30, 2, 2, 'dark', 1); tc.px(11, 29, 'redl', 3)                 # 꺼진 표시등
    tc.ell(19, 30, 2, 2, 'dark', 1)
    rustify(tc, 0, 0, W, H, amount=.45, seed=seed + 2)
    tc.grain(.03)
    return shadow_under(tc_fin(tc, .6), 24, 46, 21, 2, 75)

def glass_vat_broken(seed=81):
    """깨진 유리 통 2x3: 강철 받침·뚜껑 사이 세운 유리 원통, 앞이 깨져 속이 비었고 아래 바닥에 탁한 액이 흘렀다(안에 아무것도 없음). 아랫줄 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    cx = 16
    # 받침(아래) · 뚜껑(위) 강철 원통
    from fr_props import cyl as fcyl
    fcyl(tc, cx, 40, 12, 4, 5, 'steel', seed=seed)
    # 유리 몸통
    for y in range(12, 41):
        for x in range(5, 28):
            u = (x + .5 - cx) / 11.5
            if abs(u) > 1: continue
            k = 3 + (2 if -.7 < u < -.45 else (1 if u < 0 else 0)) - (1 if u > .6 else 0)
            broken = (y > 22 and abs(u + .1) < .45 - (y - 22) * .0 and (y + int(_hash(x, 0, seed) * 6)) > 26)
            if broken: tc.px(x, y, 'dark', 1 + (1 if u < -.2 else 0)); continue
            tc.px(x, y, 'glass', clamp(k, 1, 6))
    for (x0, y0) in ((9, 25), (12, 23), (16, 27), (20, 24), (23, 28)):        # 깨진 들쭉날쭉 가장자리
        for d in range(3): tc.px(x0 + d % 2, y0 - d, 'glass', 5)
    fcyl(tc, cx, 9, 12, 4, 4, 'steel', seed=seed + 1)
    pipe_v(tc, 10, 0, 6, 4, 'steel', flange=False); pipe_v(tc, 22, 1, 6, 3, 'brass', flange=False)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 2)
    im = tc_fin(tc, .6)
    # 흘러나온 탁한 액(반투명 보라빛 웅덩이)
    o = new(W, H); o.alpha_composite(glow_img(W, H, 18, 46, 13, 2.5, (110, 70, 150), 120, 3)); o.alpha_composite(im)
    for (x, y) in ((6, 44), (25, 45), (28, 46)):
        o.putpixel((x, y), GLASS[5] + (255,))
    return shadow_under(o, 16, 47, 13, 1.5, 60)

def cable_tangle(seed=91):
    """엉킨 전선 2x1(바닥 장식): 바닥을 기는 굵은 전선 셋, 끊긴 끝 하나에 청록 불꽃 점. 걷기."""
    tc = TC(32, 16, seed)
    cable(tc, 0, 5, 31, 9, sag=5); cable(tc, 0, 11, 30, 4, sag=-4); cable(tc, 4, 14, 26, 12, sag=3)
    for (x, y, k) in ((26, 11, 6), (27, 10, 5), (27, 12, 4)): tc.px(x, y, 'cyan', k)
    return tc_fin(tc, .75)

# ---------------------------------------------------------------- 화물 승강기 (층 이동)
def lift_platform(seed=101):
    """화물 승강기 바닥 판 4x4(64x64): 바닥에 맞물린 강철 격자 판(경고 띠 테두리), 뒤쪽 두 모서리에서 솟은 안내 기둥과
    도르래 줄, 앞 가운데 호출 버튼 기둥(청록 등). 판 전체 걷기(맨 윗줄 가운데 = 층 이동 칸), 기둥 칸만 막힘."""
    W, H = 64, 64; tc = TC(W, H, seed)
    # 판(윗면): y 18..60, x 4..60
    for y in range(18, 61):
        for x in range(4, 60):
            e = min(x - 4, 59 - x, y - 18, 60 - y)
            if e < 4:
                on = ((x + y) // 4) % 2 == 0
                tc.px(x, y, 'warn' if on else 'cable', 4 if on else 2)
                if e == 0: tc.px(x, y, 'steel', 5 if (y == 18 or x == 4) else 1)
            else:
                lx = (x - 8) % 8; ly = (y - 22) % 8
                k = 3 if ly not in (0, 7) else (4 if ly == 0 else 1)
                if lx == 7: k = 1
                tc.px(x, y, 'steel', k)
    for x in range(4, 60): tc.px(x, 61, 'steel', 2); tc.px(x, 62, 'steel', 1)          # 판 두께(앞 모)
    hazard(tc, 22, 56, 42, 59, seed)
    # 뒤 모서리 안내 기둥(키 큰 강철 형강, 판 위로 솟아 승강로로 이어진다)
    for gx in (6, 52):
        for y in range(0, 24):
            for i, k in enumerate((5, 6, 4, 3, 2, 1)): tc.px(gx + i, y, 'steel', k)
            if y % 8 == 4: tc.px(gx + 2, y, 'steel', 6)
        box(tc, gx - 1, 20, gx + 7, 26, 2, 'steel', base=3)
    # 도르래 줄 둘
    for x in (26, 37):
        for y in range(0, 20): tc.px(x, y, 'cable', 3 if y % 3 else 4); tc.px(x + 1, y, 'cable', 1)
        box(tc, x - 3, 18, x + 5, 22, 1, 'steel', base=4)
    rustify(tc, 0, 0, W, H, amount=.18, seed=seed + 2, mats=('steel',), streak=False)
    return tc_fin(tc, .62)

def lift_shaft_face(seed=111):
    """승강로(벽 앞면 장식) 4x3(64x48): 벽 앞면에 뚫린 어두운 승강로 — 양옆 안내 레일·가로 보강재, 위로 사라지는 줄 둘,
    맨 위 도르래 틀, 레일 옆 청록 층 표시등 둘(글자 없음). 앞면 3줄 필요."""
    W, H = 64, 48; tc = TC(W, H, seed)
    for y in range(0, 48):
        for x in range(4, 60):
            d = 1 if (x < 8 or x > 55) else 0
            tc.px(x, y, 'dark', 1 + (1 if y > 40 else 0) + d)
    for gx in (6, 52):                                                      # 레일
        for y in range(0, 48):
            for i, k in enumerate((5, 6, 4, 3, 2, 1)): tc.px(gx + i, y, 'steel', k)
    for y in (12, 30):                                                       # 가로 보강재
        for x in range(12, 52): tc.px(x, y, 'steel', 4); tc.px(x, y + 1, 'steel', 2)
    for x in (26, 37):
        for y in range(0, 48): tc.px(x, y, 'cable', 3 if y % 3 else 4); tc.px(x + 1, y, 'cable', 1)
    box(tc, 18, 0, 46, 6, 2, 'steel', base=3)                                # 도르래 틀
    tc.ell(31.5, 3, 4, 2, 'brass', 4)
    for (x, y) in ((1, 18), (60, 18)):                                       # 층 표시등
        box(tc, x, y, x + 3, y + 6, 1, 'steel', base=3)
        tc.px(x + 1, y + 2, 'cyan', 6); tc.px(x + 1, y + 3, 'cyan', 4)
    for y in range(0, 48):                                                   # 승강로 둘레 강철 틀
        tc.px(4, y, 'steel', 5); tc.px(5, y, 'steel', 3); tc.px(58, y, 'steel', 3); tc.px(59, y, 'steel', 1)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 1, mats=('steel',))
    return tc_fin(tc, .6)

def call_post(seed=121):
    """승강기 호출 기둥 1x2: 강철 기둥 위 버튼 상자, 청록 등(켜짐)과 경고 띠. 아랫줄만 막힘."""
    tc = TC(16, 32, seed)
    for y in range(10, 30):
        for i, k in enumerate((4, 5, 3, 2)): tc.px(6 + i, y, 'steel', k)
    box(tc, 3, 4, 13, 14, 2, 'steel', base=3)
    tc.ell(8, 9.5, 2, 2, 'cyan', 5); tc.px(7, 8, 'cyan', 6)
    hazard(tc, 6, 22, 10, 26, seed)
    box(tc, 4, 28, 12, 32, 1, 'steel', base=2)
    return shadow_under(tc_fin(tc, .6), 8, 31, 5, 1.5, 60)
