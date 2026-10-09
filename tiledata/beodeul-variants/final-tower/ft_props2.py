# 최종 탑 조각 2 — 중간 기계·뼈 층: 갈비 아치(뼈 + 철골 보강), 갈비 기둥·철골 기둥, 핵 파이프 용기(맥동 두 프레임),
# 솟은 관·핵 도관, 추상 유기 덩이, 꺼진 조작대·기계 함, 바닥 환기구, 늘어진 전선, 척추 등, 오름 계단(바닥) + 계단 아치(벽 앞면).
import math
import numpy as np
from ft_base import *
from ft_base import _hash
from ft_debris import *
from fr_props import cyl as fcyl

def _bone_tube(tc, pts, w0, w1, mat='bone', seed=0, nodes=True):
    """중심선 pts[(x,y)] 를 따라 굵기 w0→w1 인 뼈 대롱. 화소마다 가장 가까운 중심선 점까지의 거리로 칠한다(줄무늬 없음).
    빛 왼쪽 위: 빛 쪽 가장자리 밝고 반대쪽 그늘, 드문 마디 혹."""
    P = np.array(pts, float); n = len(P)
    dense = []
    for i in range(n - 1):
        for t in np.linspace(0, 1, 6, endpoint=False): dense.append((P[i] * (1 - t) + P[i + 1] * t, (i + t) / (n - 1)))
    dense.append((P[-1], 1.0))
    Q = np.array([d[0] for d in dense]); F = np.array([d[1] for d in dense])
    tang = np.gradient(Q, axis=0); tang /= (np.linalg.norm(tang, axis=1, keepdims=True) + 1e-9)
    x0, y0 = int(Q[:, 0].min() - w0), int(Q[:, 1].min() - w0); x1, y1 = int(Q[:, 0].max() + w0 + 2), int(Q[:, 1].max() + w0 + 2)
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = Q - (x + .5, y + .5); dd = (d * d).sum(1); i = int(dd.argmin())
            f = F[i]; w = w0 + (w1 - w0) * f
            if nodes and abs(((f * 7) % 1) - .5) < .07: w += 1.0
            dist = math.sqrt(dd[i])
            if dist > w / 2: continue
            tx, ty = tang[i]; nx, ny = -ty, tx                       # 법선
            side = -((x + .5 - Q[i, 0]) * nx + (y + .5 - Q[i, 1]) * ny)
            lightside = -nx - ny                                     # 빛(왼쪽 위) 쪽을 향하는 법선 성분
            u = side / (w / 2) * (1 if lightside >= 0 else -1)       # 1 = 빛 쪽 가장자리
            k = 6 if u > .62 else (5 if u > .15 else (4 if u > -.35 else (3 if u > -.75 else 2)))
            if _hash(x, y, seed + 3) < .04: k -= 1
            tc.px(x, y, mat, clamp(k, 1, 6))

def _collar(tc, cx, cy, w, h=4, mat='steel'):
    """뼈를 죄는 강철 띠(볼트 둘)."""
    for y in range(int(cy), int(cy + h)):
        for x in range(int(cx - w / 2), int(cx + w / 2 + 1)):
            k = 5 if y == int(cy) else (4 if x < cx else 3)
            if y == int(cy + h - 1): k = 1
            tc.px(x, y, mat, k)
    tc.px(int(cx - w / 2) + 1, int(cy) + 1, mat, 6); tc.px(int(cx + w / 2) - 1, int(cy) + 1, mat, 6)

def _arch_pts(x0, xb, apex_x, apex_y, yb, n=60, side=1):
    """기둥 밑(xb, yb)에서 꼭대기(apex)까지 휘어 오르는 갈비 중심선."""
    out = []
    for i in range(n):
        t = i / (n - 1)
        x = xb + (apex_x - xb) * (1 - math.cos(t * math.pi / 2)) ** 1.3
        y = yb + (apex_y - yb) * math.sin(t * math.pi / 2) ** .8
        out.append((x, y))
    return out

def rib_arch(seed=201, broken=False):
    """갈비 아치 6x5(96x80): 강철 신을 신은 두 거대 갈비뼈가 휘어 올라 꼭대기에서 리벳 강철 머릿판으로 맞물린다.
    가운데를 가로지르는 H 형강 버팀보, 뼈를 죄는 강철 띠. broken = 오른쪽 갈비가 허리에서 부러지고 버팀보가 비스듬히 처졌다.
    양 끝 기둥 밑동 칸만 막힘(가운데 4칸 걷기, 윗줄은 걷기+가림)."""
    W, H = 96, 80; tc = TC(W, H, seed)
    yb = 72
    L = _arch_pts(0, 9, 47, 7, yb); R = [(W - x, y) for (x, y) in _arch_pts(0, 9, 49, 7, yb)]
    if broken:
        R = R[:int(len(R) * .45)]
    _bone_tube(tc, L, 10, 6, seed=seed)
    _bone_tube(tc, R, 10, 6.5, seed=seed + 1)
    if broken:                                                   # 부러진 끝 단면 + 떨어진 토막
        ex, ey = R[-1]
        for dy in range(-4, 4):
            for dx in range(-4, 4):
                if tc.get(int(ex + dx), int(ey + dy)) and dy < 0: tc.px(int(ex + dx), int(ey + dy), 'bone', 2 if (dx + dy) % 2 else 1)
        paste_ol(tc, ch_bone(seed + 5, 22, .5, r0=2.6, knob=2.2), 62, 60)
    # 꼭대기 머릿판(강철) — 부서진 쪽은 반만 남는다
    if not broken:
        box(tc, 39, 3, 58, 15, 4, 'steel', base=3, seed=seed)
        for x in (42, 48, 54): tc.px(x, 9, 'steel', 6); tc.px(x + 1, 10, 'steel', 1)
        tc.ell(48.5, 10.5, 2, 2, 'viol', 5); tc.px(48, 10, 'viol', 6)
    else:
        box(tc, 36, 4, 48, 14, 4, 'steel', base=3, seed=seed)
        tc.px(40, 9, 'steel', 6)
    # 버팀보(H 형강): 갈비 사이 가로
    if not broken:
        by = 30
        for x in range(16, 81):
            for i, k in enumerate((6, 5, 3, 1, 1, 4, 2)): tc.px(x, by + i, 'steel', k)
        for x in range(20, 80, 10): tc.px(x, by + 3, 'steel', 5)
    else:
        for x in range(16, 70):
            y0 = 30 + (x - 16) * .42
            for i, k in enumerate((6, 5, 3, 1, 1, 4, 2)): tc.px(x, int(y0) + i, 'rust' if x > 55 else 'steel', k)
    # 강철 띠·신
    for (pts, sd) in ((L, 0), (R, 1)):
        for f in ((.18,) if (broken and sd) else (.18, .55)):
            px_, py_ = pts[int(len(pts) * f)]
            _collar(tc, px_, py_ - 2, 12 - f * 4)
    for xb in (9, W - 9):
        box(tc, xb - 8, 66, xb + 8, 80, 5, 'steel', base=3, seed=seed + xb)
        tc.px(xb - 5, 72, 'steel', 6); tc.px(xb + 4, 72, 'steel', 6)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 7, streak=False)
    tc.grain(.03, mats=['bone'])
    im = tc_fin(tc, .62)
    o = new(W, H)
    if not broken: o.alpha_composite(glow_img(W, H, 48.5, 10.5, 9, 7, VIOL[4], 80))
    o.alpha_composite(im)
    for xb in (9, W - 9): o = shadow_under(o, xb, 79, 9, 2, 60)
    return o

def rib_pillar(seed=211):
    """갈비 기둥 1x3(16x48): 강철 신에서 솟아 끝이 앞으로 휜 뼈 기둥, 강철 띠 둘, 끝에 매단 청록 등. 아랫줄만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    pts = [(6 + 3 * math.sin(t * 1.4) ** 2, 42 - t * 38) for t in np.linspace(0, 1, 40)]
    _bone_tube(tc, pts, 7, 4, seed=seed)
    _collar(tc, pts[10][0], pts[10][1], 8); _collar(tc, pts[26][0], pts[26][1], 7)
    box(tc, 1, 40, 15, 48, 3, 'steel', base=3, seed=seed)
    ex, ey = pts[-1]
    tc.vline(int(ex) + 2, int(ey) + 2, int(ey) + 6, 'cable', 2)
    tc.ell(ex + 2.5, ey + 8, 2, 2, 'cyan', 5); tc.px(int(ex) + 2, int(ey) + 7, 'cyan', 6)
    o = new(W, H); o.alpha_composite(glow_img(W, H, ex + 2.5, ey + 8, 7, 7, CYAN[4], 70)); o.alpha_composite(tc_fin(tc, .62))
    return shadow_under(o, 8, 47, 7, 1.5, 60)

def girder_post(seed=221):
    """철골 기둥 1x3(16x48): 바닥 판에 박힌 H 형강 기둥(앞 플랜지 빛줄·웨브 그늘·리벳), 허리에 엉겨 붙은 척추 마디 셋, 꼭대기 찢긴 끝. 아랫줄만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    for y in range(3, 44):
        for x in range(3, 13):
            k = 5 if x in (3, 4) else (6 if x == 5 else (2 if 6 < x < 11 else (3 if x == 11 else 1)))
            if 6 < x < 11 and y % 10 == 5: k = 4
            tc.px(x, y, 'steel', k)
    for x in range(3, 13):
        if _hash(x, 0, seed) < .5: tc.m[3, x] = 0
        if _hash(x, 1, seed) < .3: tc.m[4, x] = 0
    for i, y in enumerate((20, 26, 32)): paste_ol(tc, ch_vert(seed + i), 3, y)
    box(tc, 0, 42, 16, 48, 2, 'steel', base=2, seed=seed)
    rustify(tc, 0, 0, W, H, amount=.4, seed=seed + 2)
    return shadow_under(tc_fin(tc, .62), 8, 47, 7, 1.5, 60)

# ---------------------------------------------------------------- ③ 핵 파이프 용기 (맥동 두 프레임)
def core_vessel(seed=231, on=True):
    """핵 파이프 용기 5x10(80x160): 경고 띠 두른 강철 받침단 위 유리 원통 속에서 보라 핵 구슬이 맥동한다(on = 밝은 프레임, off = 어두운 프레임).
    유리 둘레 강철 고리 셋, 뚜껑에서 굵은 관 셋이 위로 솟아 천장 어둠 속으로 사라지고, 옆 관 둘은 꺾여 바닥으로 들어간다.
    아래 3줄(받침단) 막힘, 위 줄은 걷기+가림(벽 앞면 위로 겹친다). 북쪽 벽 앞면 바로 아래 바닥에 둔다."""
    W, H = 80, 160; tc = TC(W, H, seed); cx = 40
    # 위로 솟는 관(뒤에서 먼저)
    pipe_v(tc, 24, 0, 60, 10, 'steel', step=32)
    pipe_v(tc, 40, 0, 52, 14, 'steel', step=32)
    pipe_v(tc, 56, 0, 60, 10, 'steel', step=32)
    for x0, dia in ((24, 10), (40, 14), (56, 10)):                 # 관 속 보라 빛 창(맥동)
        for y in (14, 38):
            for yy in range(y, y + 5):
                for xx in range(int(x0 - dia / 2 + 3), int(x0 + dia / 2 - 2)):
                    tc.px(xx, yy, 'viol', (5 if on else 3) if yy < y + 3 else (4 if on else 2))
    # 뚜껑
    fcyl(tc, cx, 56, 26, 7, 6, 'steel', seed=seed)
    # 유리 원통
    gy0, gy1 = 66, 118
    for y in range(gy0, gy1):
        for x in range(cx - 24, cx + 25):
            u = (x + .5 - cx) / 24.5
            if abs(u) > 1: continue
            k = 2 + (2 if -.72 < u < -.5 else (1 if u < .1 else 0)) - (1 if u > .7 else 0)
            tc.px(x, y, 'glass', clamp(k, 1, 6))
    # 핵 구슬
    gx, gyc = cx, 92; R = 13 if on else 11
    for y in range(gyc - R - 1, gyc + R + 2):
        for x in range(gx - R - 1, gx + R + 2):
            dx, dy = (x + .5 - gx) / R, (y + .5 - gyc) / R; d = dx * dx + dy * dy
            if d > 1: continue
            l = -.5 * dx - .55 * dy + .7 * math.sqrt(1 - d)
            k = 2 + l * 4.4 + (.6 if on else -.6)
            if d > .85: k -= 1
            tc.px(x, y, 'viol', clamp(round(k), 1, 6))
    for (dx, dy) in ((-5, -6), (-4, -6), (-5, -5)): tc.px(gx + dx, gyc + dy, 'viol', 6)
    # 핵을 감는 가는 에너지 줄(나선, 유리 안)
    for i in range(60):
        a = i / 60 * math.pi * 4; y = gy0 + 4 + i * (gy1 - gy0 - 8) / 60; x = cx + 19 * math.cos(a)
        if math.sin(a) > 0 and abs(y - gyc) > R - 2: tc.px(x, y, 'viol', 5 if on else 3)
    # 강철 고리 셋
    for y in (gy0, 92 - 1 if False else gy0 + 26, gy1 - 3):
        for yy in range(y, y + 4):
            for x in range(cx - 25, cx + 26):
                u = (x + .5 - cx) / 25.5
                if abs(u) > 1: continue
                k = cyl_k((u + 1) / 2) - (1 if yy == y + 3 else 0)
                tc.px(x, yy, 'steel', clamp(k, 1, 6))
        for x in range(cx - 22, cx + 23, 11): tc.px(x, y + 1, 'steel', 6)
    # 받침단(3/4 상자 + 경고 띠 + 리벳 판)
    box(tc, 6, 114, 74, 160, 10, 'steel', base=3, seed=seed + 1)
    panels(tc, 7, 125, 73, 158, 'steel', 3, 16, 12, stagger=True, rivets=True, face='front', seed=seed, vary=1)
    hazard(tc, 7, 125, 73, 129, seed)
    tc.ell(cx, 117, 25, 2.2, 'steel', 1)                          # 유리 받는 홈
    # 옆으로 꺾여 바닥으로 들어가는 관 둘
    for side in (-1, 1):
        x0 = cx + side * 26
        pipe_h(tc, min(x0, x0 + side * 10), max(x0, x0 + side * 10), 100, 8, 'brass', flange=False)
        pipe_v(tc, x0 + side * 10, 100, 150, 8, 'brass', step=16)
    tc.grain(.03, mats=['steel'])
    rustify(tc, 0, 0, W, H, amount=.14, seed=seed + 3, mats=('steel',), streak=False)
    im = tc_fin(tc, .6)
    o = new(W, H)
    o.alpha_composite(glow_img(W, H, gx, gyc, 34 if on else 26, 30 if on else 22, VIOL[4], 110 if on else 60, 4))
    o.alpha_composite(im)
    o.alpha_composite(glow_img(W, H, gx, gyc, 18, 18, VIOL[5], 70 if on else 25, 3))
    return shadow_under(o, 40, 158, 36, 3, 70)

def pipe_riser(seed=241):
    """솟은 굵은 관 2x5(32x80): 바닥 받침 상자에서 위로 솟아 천장으로 사라지는 굵은 관 둘(지름 12·8), 보라 빛 창 하나, 볼트 테.
    아랫줄만 막힘(위는 벽 앞면 위로 겹친다)."""
    W, H = 32, 80; tc = TC(W, H, seed)
    pipe_v(tc, 11, 0, 72, 12, 'steel', step=32)
    pipe_v(tc, 25, 0, 74, 8, 'rust', step=16)
    for yy in range(40, 46):
        for xx in range(8, 14): tc.px(xx, yy, 'viol', 5 if yy < 43 else 4)
    box(tc, 2, 66, 30, 80, 4, 'steel', base=3, seed=seed)
    tc.px(5, 72, 'steel', 6); tc.px(26, 72, 'steel', 6)
    rustify(tc, 0, 0, W, H, amount=.3, seed=seed + 1, mats=('steel',))
    o = new(W, H); o.alpha_composite(glow_img(W, H, 11, 43, 9, 6, VIOL[4], 60)); o.alpha_composite(tc_fin(tc, .6))
    return shadow_under(o, 16, 79, 14, 1.5, 60)

def conduit_run(seed=251):
    """핵 도관 4x2(64x32): 강철 안장 받침 위 굵은 관, 관 마디마다 보라 빛이 흐르는 유리 창 셋, 가는 놋쇠 관이 곁을 따른다. 아랫줄 막힘."""
    W, H = 64, 32; tc = TC(W, H, seed)
    for sx in (6, 44): box(tc, sx, 18, sx + 12, 32, 3, 'steel', base=2, seed=seed + sx)
    pipe_h(tc, 0, 64, 15, 12, 'steel', step=32)
    for x0 in (8, 28, 48):
        for x in range(x0, x0 + 8):
            for y in range(12, 17): tc.px(x, y, 'viol', 5 if y < 14 else 4)
        tc.px(x0, 12, 'viol', 6)
    pipe_h(tc, 0, 64, 26, 6, 'brass', step=16)
    rustify(tc, 0, 0, W, H, amount=.25, seed=seed + 2, mats=('steel',))
    o = new(W, H); o.alpha_composite(tc_fin(tc, .6))
    for x0 in (12, 32, 52): o.alpha_composite(glow_img(W, H, x0, 14, 8, 5, VIOL[4], 55))
    return shadow_under(o, 32, 31, 28, 1.5, 55)

# ---------------------------------------------------------------- 추상 유기 덩이 (눈·얼굴 없음)
def flesh_mass(seed=261):
    """유기 덩이 3x2(48x32): 쓰러진 관을 감싸 엉긴 검붉은 둥근 덩이들, 덩이에서 뻗은 힘줄 줄기가 강철판에 붙었다. 젖은 반사 호. 아랫줄 막힘."""
    W, H = 48, 32; tc = TC(W, H, seed)
    paste_ol(tc, ch_pipe(seed + 1, 30, 8), 9, 15)
    paste_ol(tc, ch_plate(seed + 2, 14, 8), 32, 22)
    for i, (x, y, rx, ry) in enumerate(((8, 10, 9, 7), (22, 6, 11, 8), (30, 14, 7, 6), (2, 18, 6, 5))):
        paste_ol(tc, ch_flesh(seed + 10 + i, rx, ry), x, y)
    for (x0, y0, x1, y1) in ((36, 18, 44, 26), (10, 24, 4, 30), (28, 22, 34, 29)):   # 힘줄
        tc.line(x0, y0, x1, y1, 'flesh', 3); tc.line(x0 + 1, y0, x1 + 1, y1, 'flesh', 1)
    return shadow_under(tc_fin(tc, .62), 22, 30, 20, 2, 70)

def flesh_small(seed=271):
    """작은 유기 덩이 1x1: 바닥 틈에 엉긴 덩이 하나와 힘줄. 칸 막힘."""
    tc = TC(16, 16, seed)
    paste_ol(tc, ch_flesh(seed, 6, 5), 1, 2)
    tc.line(10, 12, 15, 14, 'flesh', 3)
    return shadow_under(tc_fin(tc, .62), 8, 14, 7, 1.5, 60)

def flesh_wall(seed=281):
    """벽 유기 덩이 2x2(벽 앞면 장식): 벽 아래 턱에서 위로 번져 오른 검붉은 덩이 막 — 아래가 두껍고 위 가장자리는 들쭉날쭉 성기다.
    덩이 속 골(어두운 줄)·젖은 반사·벽판 틈으로 파고든 가는 뿌리. 추상(눈·얼굴·다리 꼴 없음). 앞면 2~3줄의 아래쪽에 붙인다."""
    W, H = 32, 32; tc = TC(W, H, seed)
    n = FB.tnoise(W, H, 6, seed) * .7 + FB.tnoise(W, H, 3, seed + 1) * .3
    Y, X = np.mgrid[0:H, 0:W]
    edge = .25 + .28 * np.sin((X + 2) / (W + 4) * math.pi) ** .8     # 가운데가 더 높이 번졌다
    v = (Y / H) + (n - .5) * .45
    mass = v > (1.0 - edge)
    for y in range(H):
        for x in range(W):
            if not mass[y, x]: continue
            depth = v[y, x] - (1.0 - edge[y, x])
            lobe = FB.tnoise(W, H, 4, seed + 2)[y, x]
            k = 3 + (1 if lobe > .6 else 0) - (1 if lobe < .35 else 0) - (1 if depth < .04 else 0)
            if abs(lobe - .47) < .025 and depth > .08: k = 2           # 덩이 사이 얕은 골(구멍 아님)
            if y >= H - 3: k = 2 if y < H - 1 else 1
            tc.px(x, y, 'flesh', clamp(k, 1, 6))
    for y in range(1, H):                                          # 젖은 반사: 덩이 위 가장자리 군데군데
        for x in range(W):
            if tc.get(x, y) and not tc.get(x, y - 1) and _hash(x // 3, y, seed) < .35: tc.px(x, y, 'flesh', 5)
    for (x0, y0, x1, y1) in ((6, 22, 4, 13), (25, 20, 27, 11), (16, 18, 17, 9)):   # 벽 틈으로 파고든 가는 뿌리(위로)
        tc.line(x0, y0, x1, y1, 'flesh', 2)
    return tc_fin(tc, .72)

# ---------------------------------------------------------------- 기계 소품
def console_dead(seed=291):
    """조작대 2x2: 기운 판의 강철 조작대, 청록 화면(막대 무늬만, 글자 없음)·단추 줄·레버, 뒤로 빠지는 전선. 아래 2줄 막힘."""
    W, H = 32, 32; tc = TC(W, H, seed)
    box(tc, 2, 14, 30, 32, 4, 'steel', base=3, seed=seed)
    panels(tc, 3, 19, 29, 31, 'steel', 3, 13, 12, rivets=True, face='front', seed=seed, vary=0)
    for y in range(4, 15):                                       # 기운 화면 판
        x0 = 5 + (14 - y) // 3
        for x in range(x0, 27 - (14 - y) // 3):
            tc.px(x, y, 'steel', 4 if y > 5 else 5)
    for y in range(6, 12):
        for x in range(9, 23):
            tc.px(x, y, 'cyan', 2 if (x + y) % 5 else 3)
    for i, h in enumerate((3, 5, 2, 4)):
        for y in range(11 - h, 11): tc.px(11 + i * 3, y, 'cyan', 5); tc.px(12 + i * 3, y, 'cyan', 4)
    for x in range(6, 26, 3): tc.px(x, 15, 'redl' if x % 2 else 'amber', 4)
    tc.vline(26, 8, 15, 'steel', 5); tc.px(26, 7, 'redl', 5)
    cable(tc, 4, 26, 0, 31, sag=2)
    o = new(W, H); o.alpha_composite(glow_img(W, H, 16, 9, 12, 7, CYAN[4], 55)); o.alpha_composite(tc_fin(tc, .6))
    return shadow_under(o, 16, 31, 14, 1.5, 60)

def machine_cabinet(seed=301):
    """기계 함 2x3: 키 큰 강철 함(윗면 환풍 창살, 앞면 판 둘·리벳), 깜빡이는 청록·호박 표시등 줄, 아래 통풍구, 녹물. 아래 2줄 막힘."""
    W, H = 32, 48; tc = TC(W, H, seed)
    box(tc, 2, 4, 30, 48, 6, 'steel', base=3, seed=seed)
    panels(tc, 3, 11, 29, 46, 'steel', 3, 13, 17, rivets=True, face='front', seed=seed, vary=1)
    for x in range(6, 26, 3): tc.px(x, 6, 'dark', 1); tc.px(x, 7, 'dark', 1)
    for i in range(6):
        y = 15 + i * 3; c = 'cyan' if _hash(i, 0, seed) < .6 else 'amber'
        tc.px(8, y, c, 6 if i % 2 else 3); tc.px(9, y, c, 4)
        tc.px(20, y, 'cyan', 5 if i % 3 == 0 else 2)
    for y in range(36, 44, 2):
        for x in range(7, 25): tc.px(x, y, 'dark', 1)
    rustify(tc, 0, 0, W, H, amount=.35, seed=seed + 1)
    return shadow_under(tc_fin(tc, .6), 16, 47, 14, 1.5, 60)

def vent_glow(seed=311):
    """빛나는 바닥 환기구 1x1(바닥 장식): 강철 틀 창살 아래 보라 빛. 걷기."""
    tc = TC(16, 16, seed)
    for y in range(2, 14):
        for x in range(2, 14):
            if x in (2, 13) or y in (2, 13): tc.px(x, y, 'steel', 5 if (x == 2 or y == 2) else 2)
            elif y % 3 == 0: tc.px(x, y, 'steel', 4)
            else: tc.px(x, y, 'viol', 3 if 4 < x < 11 else 2)
    return tc_fin(tc, .8)

def cable_hang(seed=321):
    """늘어진 전선 다발 1x3(벽 앞면 장식): 천장에서 내려와 벽을 타고 늘어진 굵은 전선 셋, 끝에서 청록 불꽃. 앞면 3줄."""
    W, H = 16, 48; tc = TC(W, H, seed)
    for i, (x, sag) in enumerate(((3, 3), (7, -2), (11, 2))):
        for y in range(0, 40 - i * 4):
            xx = x + int(sag * math.sin(y / 40 * math.pi))
            tc.px(xx, y, 'cable', 3); tc.px(xx + 1, y, 'cable', 1)
    for (x, y, k) in ((4, 40, 6), (5, 41, 5), (3, 41, 4), (12, 33, 5)): tc.px(x, y, 'cyan', k)
    return tc_fin(tc, .8)

def spine_lamp(seed=331):
    """척추 등 1x3(16x48): 강철 받침 위에 척추 마디를 쌓아 올린 기둥, 꼭대기 강철 갓 아래 청록 등. 아랫줄만 막힘."""
    W, H = 16, 48; tc = TC(W, H, seed)
    box(tc, 2, 40, 14, 48, 3, 'steel', base=3, seed=seed)
    for i in range(6): paste_ol(tc, ch_vert(seed + i), 2 + (i % 2), 34 - i * 5)
    box(tc, 3, 2, 13, 7, 2, 'steel', base=4, seed=seed)
    tc.ell(8, 9, 3, 2.5, 'cyan', 5); tc.px(7, 8, 'cyan', 6)
    o = new(W, H); o.alpha_composite(glow_img(W, H, 8, 9, 8, 8, CYAN[4], 80)); o.alpha_composite(tc_fin(tc, .62))
    return shadow_under(o, 8, 47, 7, 1.5, 60)

# ---------------------------------------------------------------- 오름 계단 (바닥) + 계단 아치 (벽 앞면)
def stair_up(seed=341):
    """오름 계단 4x4(64x64): 바닥 위에서 북쪽으로 오르는 강철 디딤판 계단 8단 — 양옆은 갈비뼈를 세워 박은 강철 난간벽,
    위로 갈수록 밟판이 밝다. 가운데 2열 걷기(맨 윗줄 = 위층 이동 칸), 양옆 난간 열 막힘."""
    W, H = 64, 64; tc = TC(W, H, seed)
    for i in range(8):                                           # 디딤판(아래 = 0단)
        y1 = 64 - i * 8; y0 = y1 - 8
        for y in range(y0, y1):
            for x in range(14, 50):
                ly = y - y0
                k = 2 + i // 3 + (2 if ly <= 1 else (1 if ly <= 3 else 0)) - (1 if ly >= 6 else 0)
                if ly == 7: k = 1
                if x >= 47: k -= 1
                tc.px(x, y, 'steel', clamp(k, 1, 6))
        for x in (17, 46): tc.px(x, y0 + 1, 'steel', 6)
        if i % 3 == 1: hazard(tc, 14, y0 + 5, 50, y0 + 7, seed + i)
    for side in (0, 1):                                          # 난간벽(윗면 + 앞면)
        x0 = 2 if side == 0 else 50
        box(tc, x0, 0, x0 + 12, 64, 4, 'steel', base=3 if side == 0 else 2, seed=seed + side)
        panels(tc, x0 + 1, 5, x0 + 11, 63, 'steel', 3 if side == 0 else 2, 11, 16, rivets=True, face='front', seed=seed + side, vary=0)
        for j, yb in enumerate((20, 40, 60)):                    # 박힌 갈비뼈
            pts = [(x0 + 6 + (3 if side == 0 else -3) * math.sin(t * 1.3), yb - t * 18) for t in np.linspace(0, 1, 18)]
            _bone_tube(tc, pts, 5, 3, seed=seed + j)
    rustify(tc, 0, 0, W, H, amount=.08, seed=seed + 3, mats=('steel',), streak=False)
    return tc_fin(tc, .62)

def stair_arch(seed=351):
    """계단 아치(벽 앞면 장식) 4x3(64x48): 벽 앞면을 뚫은 강철 틀 개구부 — 위로 이어지는 계단 끝이 어둠 속으로, 틀 위 리벳 들보와
    양쪽 갈비뼈 버팀, 들보 가운데 보라 등. 오름 계단 바로 위 벽 앞면에(앞면 3줄 필요)."""
    W, H = 64, 48; tc = TC(W, H, seed)
    for y in range(8, 48):
        for x in range(14, 50):
            d = (48 - y)
            k = 1 if d > 22 else 2
            if (y % 8) in (0, 1) and d < 26: k = 3 if d < 14 else 2
            tc.px(x, y, 'steel' if d < 26 else 'dark', k if d < 26 else 1)
    box(tc, 6, 0, 58, 10, 3, 'steel', base=3, seed=seed)
    for x in range(10, 56, 6): tc.px(x, 6, 'steel', 6); tc.px(x + 1, 7, 'steel', 1)
    for side in (0, 1):
        x0 = 6 if side == 0 else 50
        box(tc, x0, 8, x0 + 8, 48, 1, 'steel', base=3 if side == 0 else 2, seed=seed + 1 + side)
        pts = [(x0 + 4 + (-2 if side == 0 else 2) * math.sin(t * 2), 46 - t * 36) for t in np.linspace(0, 1, 30)]
        _bone_tube(tc, pts, 5, 3.5, seed=seed + side)
    tc.ell(32, 4, 3, 2, 'viol', 5); tc.px(31, 3, 'viol', 6)
    o = new(W, H); o.alpha_composite(tc_fin(tc, .6)); o.alpha_composite(glow_img(W, H, 32, 5, 10, 6, VIOL[4], 70))
    return o
