# 최종 탑 조각 3 — 최상부 핵 방: 중앙 제단(세 단 둥근 단·앞 계단·발광 고리·뼈 발톱 받침 위 떠 있는 핵 구슬, 맥동 두 프레임),
# 도관 기둥, 관·뼈 벽 장식, 내림 계단, 허공 틈, 핵 화로, 허공에 뜬 잔해, 철골 다리, 부유 바닥 조각.
import math
import numpy as np
from ft_base import *
from ft_base import _hash
from ft_debris import *
from ft_props2 import _bone_tube, _collar
import ft_void as FV

def _tier(tc, cx, cy, rx, ry, h, seed, top_k=4, ring=None, steps=None):
    """둥근 단 한 겹: 윗면 타원(동심 고리 판석) + 앞면 띠(마름돌 줄, 원통 명암). steps = (x0, x1) 앞면 가운데 계단."""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry; r = math.hypot(u, v)
            if r > 1: continue
            a = math.atan2(v, u)
            ringi = int(r * 4); nst = 8 + ringi * 6
            seg = int(((a + math.pi) / (2 * math.pi)) * nst + (ringi % 2) * .5)
            k = top_k + (1 if (u < -.2 and v < 0) else 0) - (1 if r > .9 else 0)
            if abs(r * 4 - round(r * 4)) < .06 or abs(((a + math.pi) / (2 * math.pi)) * nst + (ringi % 2) * .5 - round(((a + math.pi) / (2 * math.pi)) * nst + (ringi % 2) * .5)) < .04 * (1 + ringi):
                k -= 1
            if _hash(seg, ringi, seed) < .2: k -= 1
            if _hash(x, y, seed + 1) < .04: k += 1
            if ring is not None and abs(r - ring) < .035: tc.px(x, y, 'viol', 4 if (x + y) % 3 else 6); continue
            tc.px(x, y, 'ftst', clamp(k, 1, 6))
    for x in range(int(cx - rx), int(cx + rx + 1)):
        u = (x + .5 - cx) / rx
        if abs(u) >= 1: continue
        yb = cy + ry * math.sqrt(1 - u * u)
        for d in range(h):
            y = int(yb) + d
            if steps and steps[0] <= x < steps[1]:
                ly = d % 3
                k = 5 if ly == 0 else (3 if ly == 1 else 2)
                if x in (steps[0], steps[1] - 1): k = 1
                tc.px(x, y, 'ftst', k); continue
            k = cyl_k((u + 1) / 2)
            if d == 0: k = min(6, k + 1)
            if d % 4 == 3 or (int(x + (d // 4) * 5) % 11 == 0): k -= 1
            if d == h - 1: k = 1
            tc.px(x, y, 'ftst', clamp(k - 1, 1, 6))

def core_altar(seed=401, on=True):
    """핵 제단 8x7(128x112): 세 단 둥근 돌 단(동심 고리 판석, 아랫단에 보라 빛 상감 고리, 앞 가운데 계단) 위
    뼈 발톱 넷이 받쳐 든 떠 있는 핵 구슬과 엇갈린 강철 고리 둘. 얼굴·눈 없음. on = 밝은 프레임, off = 어두운 프레임.
    아래 3줄(단) 막힘, 앞 가운데 계단 2칸은 걷기, 위 줄은 걷기+가림."""
    W, H = 128, 112; tc = TC(W, H, seed); cx = 64
    _tier(tc, cx, 82, 60, 19, 9, seed, 3, ring=.86, steps=(50, 78))
    _tier(tc, cx, 72, 44, 14, 8, seed + 1, 4, steps=(54, 74))
    _tier(tc, cx, 64, 27, 9, 6, seed + 2, 5)
    for y in range(58, 71):                                      # 꼭대기 핵 받침 홈(빛)
        for x in range(cx - 16, cx + 17):
            r = math.hypot((x + .5 - cx) / 15, (y + .5 - 64) / 5)
            if r < 1: tc.px(x, y, 'viol', (5 if on else 3) if r < .5 else (4 if on else 2))
    oy = 30; R = 13 if on else 11
    def claw(side, front):
        xb = cx + side * (17 if not front else 12); yb = 66 if not front else 70
        xt = cx + side * (7 if not front else 9); yt = oy + (2 if not front else 8)
        pts = [(xb + (xt - xb) * t + side * 7 * math.sin(t * math.pi) * (1 - t * .3), yb + (yt - yb) * t) for t in np.linspace(0, 1, 34)]
        _bone_tube(tc, pts, 6.5, 2.5, seed=seed + side + (3 if front else 0))
        _collar(tc, xb, yb - 6, 9)
    def ring_half(rx, ry, back, mat, k0):
        for i in range(240):
            a = i / 240 * 2 * math.pi
            x = cx + rx * math.cos(a); y = oy + ry * math.sin(a)
            if (math.sin(a) < 0) == back: tc.px(x, y, mat, k0 + (1 if math.cos(a) < 0 else 0))
    claw(-1, False); claw(1, False)
    ring_half(22, 6, True, 'steel', 4); ring_half(7, 20, True, 'brass', 3)
    for y in range(oy - R - 1, oy + R + 2):                     # 핵 구슬
        for x in range(cx - R - 1, cx + R + 2):
            dx, dy = (x + .5 - cx) / R, (y + .5 - oy) / R; d = dx * dx + dy * dy
            if d > 1: continue
            l = -.5 * dx - .55 * dy + .7 * math.sqrt(1 - d)
            k = 2 + l * 4.4 + (.6 if on else -.7)
            if d > .86: k -= 1
            tc.px(x, y, 'viol', clamp(round(k), 1, 6))
    for (dx, dy) in ((-5, -6), (-4, -6), (-5, -5), (-4, -7)): tc.px(cx + dx, oy + dy, 'viol', 6)
    ring_half(22, 6, False, 'steel', 4); ring_half(7, 20, False, 'brass', 3)
    claw(-1, True); claw(1, True)
    tc.grain(.02, mats=['ftst'])
    im = tc_fin(tc, .6)
    o = new(W, H)
    o.alpha_composite(glow_img(W, H, cx, oy, 40 if on else 30, 34 if on else 26, VIOL[4], 110 if on else 55, 4))
    o.alpha_composite(glow_img(W, H, cx, 82, 62, 21, VIOL[3], 50 if on else 25, 3))
    o.alpha_composite(im)
    o.alpha_composite(glow_img(W, H, cx, oy, 16, 16, VIOL[5], 80 if on else 25, 3))
    return shadow_under(o, cx, 109, 58, 3, 70)

def altar_block():
    """제단 발자국(왼쪽 아래 칸 기준). 아래 3줄 막힘, 맨 아랫줄 가운데 2칸(계단 발치)은 걷기."""
    out = []
    for dy in range(3):
        for dx in range(8):
            if dy == 0 and dx in (3, 4): continue
            if dx in (0, 7) and dy == 2: continue
            out.append((dx, -dy))
    return out

def conduit_pylon(seed=411):
    """도관 기둥 1x4(16x64): 강철 받침 위 위로 가늘어지는 리벳 강철 기둥, 꼭대기 위에 떠 있는 보라 결정, 밑동을 죄는 갈비 버팀 둘. 아랫줄만 막힘."""
    W, H = 16, 64; tc = TC(W, H, seed)
    for y in range(14, 58):
        hw = 2 + (y - 14) / 44 * 2.5
        for x in range(int(8 - hw), int(8 + hw + 1)):
            u = (x + .5 - (8 - hw)) / (2 * hw + 1)
            k = cyl_k(u)
            if y % 10 == 4: k = min(6, k + 1)
            tc.px(x, y, 'steel', k)
    for (x, y) in ((6, 24), (6, 34), (6, 44)): tc.px(x, y, 'steel', 6)
    for side in (-1, 1):
        pts = [(8 + side * (6 - 4 * t), 60 - t * 16) for t in np.linspace(0, 1, 14)]
        _bone_tube(tc, pts, 3.5, 2, seed=seed + side)
    box(tc, 1, 56, 15, 64, 3, 'steel', base=3, seed=seed)
    for (x, y, k) in ((8, 2, 6), (7, 3, 5), (8, 3, 6), (9, 3, 5), (7, 4, 4), (8, 4, 5), (9, 4, 4), (7, 5, 4), (8, 5, 5), (9, 5, 3), (7, 6, 3), (8, 6, 4), (9, 6, 3), (8, 7, 3), (8, 8, 2)):
        tc.px(x, y, 'viol', k)
    o = new(W, H); o.alpha_composite(glow_img(W, H, 8, 5, 8, 8, VIOL[4], 90)); o.alpha_composite(tc_fin(tc, .62))
    return shadow_under(o, 8, 63, 7, 1.5, 60)

def pipe_organ_wall(seed=421):
    """관·뼈 벽 장식 6x3(96x48, 벽 앞면 위): 천장 어둠에서 내려와 벽을 따라 늘어선 굵기 다른 세로 관 일곱(보라 빛 창),
    두 높이에서 관을 가로질러 묶은 휜 갈비뼈, 아래 강철 받침 띠. 앞면 3줄 필요, 제단 뒤 북쪽 벽 가운데."""
    W, H = 96, 48; tc = TC(W, H, seed)
    xs = [(8, 8), (20, 10), (33, 6), (48, 14), (63, 6), (76, 10), (88, 8)]
    for i, (x, d) in enumerate(xs):
        pipe_v(tc, x, 0, 42, d, 'steel' if i % 3 else 'rust', step=16 if d < 10 else 32)
        wy = 10 + int(_hash(i, 0, seed) * 16)
        for yy in range(wy, wy + 5):
            for xx in range(int(x - d / 2 + 2), int(x + d / 2 - 1)): tc.px(xx, yy, 'viol', 5 if yy < wy + 3 else 4)
    for yb in (16, 32):
        pts = [(2 + t * 92, yb - 7 * math.sin(t * math.pi)) for t in np.linspace(0, 1, 60)]
        _bone_tube(tc, pts, 5, 4, seed=seed + yb)
    box(tc, 0, 40, 96, 48, 2, 'steel', base=3, seed=seed)
    for x in range(4, 96, 9): tc.px(x, 44, 'steel', 6)
    o = new(W, H); o.alpha_composite(tc_fin(tc, .6))
    for i, (x, d) in enumerate(xs): o.alpha_composite(glow_img(W, H, x, 12 + int(_hash(i, 0, seed) * 16), 7, 5, VIOL[4], 45))
    return o

def stair_down(seed=431):
    """내림 계단 4x4(64x64): 바닥에 뚫린 계단 구멍 — 강철 테두리, 양옆 갈비뼈 난간 낮은 벽, 남쪽 입구에서 북쪽으로 내려갈수록
    어둠과 아래층 보라 빛에 잠기는 강철 디딤판 8단. 가운데 2열 걷기(맨 아랫줄 = 도착·출발 칸), 양옆 난간 열 막힘."""
    W, H = 64, 64; tc = TC(W, H, seed)
    for i in range(8):
        y0 = 4 + i * 7; y1 = y0 + 7
        depth = 7 - i                                            # 북쪽(위)이 가장 깊다
        for y in range(y0, y1):
            for x in range(14, 50):
                ly = y - y0
                k = 1 + max(0, 4 - depth // 2) + (1 if ly <= 1 else 0) - (1 if ly >= 5 else 0)
                if ly == 6: k = 1
                if depth >= 6: tc.px(x, y, 'viol' if (x + y) % 4 == 0 else 'dark', 2 if (x + y) % 4 == 0 else 1); continue
                tc.px(x, y, 'steel', clamp(k, 1, 6))
    for side in (0, 1):
        x0 = 2 if side == 0 else 50
        box(tc, x0, 0, x0 + 12, 64, 6, 'ftst', base=3 if side == 0 else 2, seed=seed + side)
        for j, yb in enumerate((22, 44, 62)):
            pts = [(x0 + 6 + (2 if side == 0 else -2) * math.sin(t * 1.3), yb - t * 15) for t in np.linspace(0, 1, 16)]
            _bone_tube(tc, pts, 4.5, 3, seed=seed + j + side * 5)
    for x in range(2, 62): tc.px(x, 0, 'steel', 5); tc.px(x, 1, 'steel', 3); tc.px(x, 2, 'steel', 1)
    o = new(W, H); o.alpha_composite(tc_fin(tc, .62)); o.alpha_composite(glow_img(W, H, 32, 10, 18, 8, VIOL[4], 70))
    return o

def void_rift(seed=441, w=3, h=2):
    """허공 틈 w×h: 바닥이 찢겨 드러난 허공(별·성운) — 북쪽 안벽은 깨진 돌 앞면, 둘레는 보라 빛이 새는 들쭉날쭉한 금. 모든 칸 막힘."""
    W, H = w * T, h * T
    vb = TV.void_image(W, H, seed=seed, per=False, nebula=True, star_dens=1.6)
    va = np.array(vb)
    Y, X = np.mgrid[0:H, 0:W]
    n = FB.tnoise(W, H, 5, seed)
    rr = np.sqrt(((X + .5 - W / 2) / (W / 2 - 2)) ** 2 + ((Y + .5 - H / 2) / (H / 2 - 3)) ** 2) + (n - .5) * .5
    hole = rr < .82
    out = np.zeros((H, W, 4), np.uint8)
    out[hole] = va[hole]
    # 북쪽 안벽(구멍 위 가장자리 아래 4px 깨진 돌 앞면)
    for x in range(W):
        ys = np.nonzero(hole[:, x])[0]
        if len(ys) == 0: continue
        y0 = ys[0]
        for d in range(5):
            y = y0 + d
            if y < H and hole[y, x]: out[y, x, :3] = FT[3 - min(2, d // 2)] if d < 4 else FT[0]; out[y, x, 3] = 255
    rim = (rr >= .82) & (rr < 1.02)
    bay = np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
    for (y, x) in zip(*np.nonzero(rim)):
        t = (rr[y, x] - .82) / .2
        if t < .25: out[y, x, :3] = VIOL[4]; out[y, x, 3] = 255
        elif bay[y, x] > t: out[y, x, :3] = VIOL[3]; out[y, x, 3] = 150
    return Image.fromarray(out, 'RGBA')

def core_lamp(seed=451):
    """핵 화로 1x2: 세 다리 강철 받침의 둥근 그릇에서 타오르는 보라 불길. 아랫줄만 막힘."""
    W, H = 16, 32; tc = TC(W, H, seed)
    for (x0, x1) in ((4, 2), (8, 8), (12, 14)): tc.line(x0, 18, x1, 30, 'steel', 3)
    tc.ell(8, 17, 6, 2.5, 'steel', lambda x, y: 4 if x < 8 else 2)
    for y in range(18, 21):
        for x in range(3, 14): tc.px(x, y, 'steel', 3 if x < 8 else 2)
    for (x, y, k) in ((8, 6, 4), (7, 8, 5), (8, 8, 6), (9, 9, 5), (6, 11, 4), (7, 11, 6), (8, 11, 6), (9, 11, 5), (10, 12, 4),
                      (5, 14, 4), (6, 13, 5), (7, 13, 6), (8, 13, 6), (9, 13, 6), (10, 14, 5), (11, 15, 4), (5, 15, 3), (6, 15, 5), (7, 15, 6), (8, 15, 5), (9, 15, 5), (10, 15, 4)):
        tc.px(x, y, 'viol', k)
    o = new(W, H); o.alpha_composite(glow_img(W, H, 8, 12, 8, 10, VIOL[4], 90)); o.alpha_composite(tc_fin(tc, .62))
    return shadow_under(o, 8, 31, 6, 1.5, 60)

# ---------------------------------------------------------------- 허공에 뜬 잔해 (허공 칸 위 장식)
def _float(tc_img, w, h, seed):
    o = new(w, h); o.alpha_composite(glow_img(w, h, w / 2, h - 3, w / 2.2, 3, VIOL[2], 60, 2)); o.alpha_composite(tc_img); return o

def void_girder(seed=461):
    """허공에 뜬 철골 토막 2x2: 비스듬히 떠도는 H 형강 토막과 따라 도는 볼트·판 부스러기, 아래 희미한 보라 빛. 허공 위 장식."""
    tc = TC(32, 32, seed)
    paste_ol(tc, ch_girder(seed, 24, -.6), 2, 6)
    paste_ol(tc, ch_plate(seed + 1, 7, 5), 22, 22); tc.px(6, 25, 'steel', 5); tc.px(27, 6, 'steel', 5)
    return _float(tc_fin(tc, .62), 32, 32, seed)

def void_bone(seed=471):
    """허공에 뜬 갈비뼈 2x1: 떠도는 휜 갈비 한 대와 척추 마디 하나. 허공 위 장식."""
    tc = TC(32, 16, seed)
    paste_ol(tc, ch_rib(seed, 11, 3.5, 5.3, th=3.4), 2, -4)
    paste_ol(tc, ch_vert(seed + 1), 19, 6)
    return _float(tc_fin(tc, .62), 32, 16, seed)

def void_slab(seed=481):
    """허공에 뜬 작은 바닥 조각 2x2: 깨진 돌판 + 강철 갑판 + 늘어진 철근(밟을 수 없는 먼 조각). 허공 위 장식."""
    piece, _ = FV.fragment_piece((2, 1), seed=seed)
    o = new(32, 32); o.alpha_composite(piece.crop((0, 0, 32, 32)))
    return o

def bridge_girder_v(seed=491):
    """철골 다리(남북) 1x1 이어 붙임 칸: 허공을 건너는 H 형강 윗 플랜지(폭 10px, 리벳 두 줄), 양옆 허공. 걷기, 세로로 잇는다."""
    tc = TC(16, 16, seed)
    for y in range(16):
        for x in range(3, 13):
            k = 5 if x == 3 else (6 if x == 4 else (4 if x < 11 else (2 if x == 11 else 1)))
            if y % 8 == 7: k -= 1
            tc.px(x, y, 'steel', clamp(k, 1, 6))
        if y % 8 == 3: tc.px(5, y, 'steel', 6); tc.px(10, y, 'steel', 6)
    rustify(tc, 0, 0, 16, 16, amount=.25, seed=seed, streak=False)
    return tc.img()

def bridge_girder_h(seed=501):
    """철골 다리(동서) 1x1 이어 붙임 칸: 윗 플랜지 윗면(밟는 면, 리벳) + 아래로 보이는 웨브·아랫 플랜지. 걷기, 가로로 잇는다."""
    tc = TC(16, 16, seed)
    for x in range(16):
        for y, k in ((1, 6), (2, 5), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4), (8, 3), (9, 2), (10, 1), (11, 1), (12, 1), (13, 3), (14, 2), (15, 0)):
            tc.px(x, y, 'steel', k)
        if x % 8 == 3: tc.px(x, 4, 'steel', 6); tc.px(x, 7, 'steel', 6)
    rustify(tc, 0, 0, 16, 16, amount=.25, seed=seed, streak=False)
    return tc.img()
