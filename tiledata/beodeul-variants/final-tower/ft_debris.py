# 최종 탑 — 잔해 조각 사전과 「쌓인 더미」 그리기.
# 더미는 얼룩 잡음이 아니라 낱개 조각(강철판·마름돌·뼈·갈비·유리·톱니·관·척추뼈)을 뒤에서 앞으로 겹쳐 찍어 만든다.
# 조각마다 3/4 명암(윗면 밝고 앞 모 어둡다, 빛 왼쪽 위)과 자기 윤곽(오른쪽·아래 가장자리 = 램프 0, 아래 접촉 그림자)을 가진다.
# 그래서 버들항 돌무더기처럼 「덩이가 하나하나 읽히는」 더미가 된다. 재질은 미래 폐허 기계 재질 규약 + 뼈 램프.
import math
import numpy as np
from ft_base import *
from ft_base import _hash

def rng(seed): return np.random.default_rng(seed)

# ---------------------------------------------------------------- 조각 하나 붙이기(자기 윤곽 + 접촉 그림자)
def paste_ol(dst, src, ox, oy, toff=0, shade=True):
    ox, oy = int(ox), int(oy)
    m = src.m > 0
    H, W = m.shape
    for y in range(H):
        for x in range(W):
            if not m[y, x]: continue
            X, Y = ox + x, oy + y
            if not dst.inb(X, Y): continue
            t = int(src.t[y, x]) + toff
            right = x + 1 >= W or not m[y, x + 1]; down = y + 1 >= H or not m[y + 1, x]
            left = x == 0 or not m[y, x - 1]; up = y == 0 or not m[y - 1, x]
            if down: t = 0
            elif right: t = max(1, t - 2)
            elif left or up: t = max(1, t)
            dst.m[Y, X] = src.m[y, x]; dst.t[Y, X] = max(0, min(6, t)); dst.a[Y, X] = 255
    if shade:                                                   # 접촉 그림자: 조각 바로 아래 한 줄을 한 단 어둡게
        for x in range(W):
            col = np.nonzero(m[:, x])[0]
            if len(col) == 0: continue
            y = col[-1] + 1; X, Y = ox + x, oy + y
            if dst.inb(X, Y) and dst.m[Y, X] and not (y < H and m[y, x]): dst.t[Y, X] = max(0, dst.t[Y, X] - 1)

# ---------------------------------------------------------------- 낱개 조각
def ch_plate(seed, w, h, mat='steel'):
    """깨진 강철판 조각: 윗면(h-2 줄) + 앞 모 2줄, 모서리가 깨지고 리벳 둘."""
    r = rng(seed); tc = TC(w, h + 1, seed)
    cut = [int(r.integers(0, 3)) for _ in range(4)]
    top = max(2, h - 2)
    for y in range(h):
        for x in range(w):
            if y < cut[0] and x < cut[0] - y: continue
            if y < cut[1] and x >= w - (cut[1] - y): continue
            if y >= h - cut[2] and x < cut[2] - (h - 1 - y): continue
            if y >= h - cut[3] and x >= w - (cut[3] - (h - 1 - y)): continue
            if y < top:
                k = 4 + (1 if (y == 0 or x == 0) else 0)
                if x >= w - 2: k -= 1
            else: k = 2 if y == top else 1
            tc.px(x, y, mat, k)
    if w >= 6 and h >= 5:
        tc.px(2, 1, mat, 6); tc.px(w - 3, top - 2, mat, 6)
        if r.random() < .5: tc.line(2, top - 1, w - 3, 1, mat, 3)          # 휘어 접힌 금
    return tc

def ch_stone(seed, w, h):
    """부서진 탑 마름돌: 윗면 청보라 돌(밝음) + 앞면 쌓은 줄눈, 깨진 모서리."""
    r = rng(seed); tc = TC(w, h, seed); top = max(2, int(h * .45))
    c0 = int(r.integers(0, 3)); c1 = int(r.integers(0, 3))
    for y in range(h):
        for x in range(w):
            if y < c0 and x < c0 - y: continue
            if y < c1 and x >= w - (c1 - y): continue
            if y < top: k = 5 if (y == 0 or x == 0) else 4
            else:
                k = 3 if x < 2 else (2 if x < w - 2 else 1)
                if y == top: k = 2
                if (y - top) % 4 == 3: k = 1
            if _hash(x + seed, y, 7) < .07: k -= 1
            tc.px(x, y, 'ftst', clamp(k, 1, 6))
    return tc

def _shade_tube(n_up):
    """원통 단면 위치(-1 위쪽 .. 1 아래쪽) → 톤(빛 왼쪽 위)."""
    if n_up < -.55: return 5
    if n_up < -.1: return 6 if n_up < -.3 else 5
    if n_up < .4: return 4
    if n_up < .75: return 3
    return 2

def ch_bone(seed, L, ang, r0=2.0, knob=1.9, mat='bone'):
    """긴 뼈: 가운데가 가는 대롱 + 양 끝 두 갈래 혹(관절). ang = 라디안."""
    pad = int(r0 + knob + 2); ca, sa = math.cos(ang), math.sin(ang)
    W = int(abs(ca) * L + 2 * pad + 1); H = int(abs(sa) * L + 2 * pad + 1)
    tc = TC(W, H, seed)
    cx, cy = W / 2, H / 2
    for y in range(H):
        for x in range(W):
            dx, dy = x + .5 - cx, y + .5 - cy
            t = (dx * ca + dy * sa) / L + .5; d = -dx * sa + dy * ca
            if t < -.08 or t > 1.08: continue
            e = abs(t - .5) * 2
            r = r0 * (1 - .18 * math.sin(math.pi * t)) + (knob * max(0, (e - .78) / .22) ** .7 if e > .78 else 0)
            if e > .92:                                          # 관절 두 갈래(가운데 홈)
                if abs(d) < .6 and e > .99: continue
                r += .5
            if abs(d) > r: continue
            nu = d / max(.5, r)
            k = _shade_tube(nu if ca >= 0 else nu)
            tc.px(x, y, mat, k)
    return tc

def ch_rib(seed, R, a0, a1, th=2.4, mat='bone'):
    """휜 갈비뼈 한 대: 원호(반지름 R, a0→a1)를 따라 두께 th, 끝이 가늘어진다."""
    W = H = int(2 * R + 2 * th + 4); tc = TC(W, H, seed); cx = cy = W / 2
    for y in range(H):
        for x in range(W):
            dx, dy = x + .5 - cx, y + .5 - cy
            a = math.atan2(dy, dx); rr = math.hypot(dx, dy)
            lo, hi = min(a0, a1), max(a0, a1)
            aa = a
            while aa < lo: aa += 2 * math.pi
            if aa > hi: continue
            f = (aa - lo) / max(1e-6, hi - lo)
            t = th * (1 - .55 * f)
            if abs(rr - R) > t / 2: continue
            out = (rr - R) / (t / 2)                            # -1 안쪽 .. 1 바깥
            up = -dy / max(1, rr)                                # 바깥 면이 위를 보면 밝다
            k = 4 + (1 if out * up > .2 else (-1 if out * up < -.3 else 0)) - (1 if dx > 0 and out > .3 else 0)
            tc.px(x, y, mat, clamp(k, 1, 6))
    return tc

def ch_glass(seed, s):
    """유리 조각(세모): 청록 유리, 45° 빛줄 한 줄."""
    r = rng(seed); tc = TC(s + 1, s + 1, seed)
    p = [(r.uniform(0, s * .3), s), (s, r.uniform(s * .5, s)), (r.uniform(s * .3, s * .8), 0)]
    tc.poly(p, 'glass', lambda x, y: 3 + (1 if y < s * .5 else 0))
    for i in range(s):
        x = int(s * .3) + i // 2; y = s - 2 - i
        if tc.get(x, y): tc.px(x, y, 'glass', 6)
    return tc

def ch_gear(seed, R):
    """반쯤 묻힌 놋쇠 톱니(3/4 눕힌 원판): 이 여덟~열, 가운데 구멍."""
    ry = R * .55; W = int(2 * R + 4); H = int(2 * ry + 6); tc = TC(W, H, seed); cx, cy = W / 2, ry + 2
    n = 8 + int(_hash(seed, 1, 3) * 3)
    for y in range(H):
        for x in range(W):
            dx, dy = (x + .5 - cx) / R, (y + .5 - cy) / ry
            a = math.atan2(dy, dx); rr = math.hypot(dx, dy)
            tooth = (math.cos(a * n) > .2)
            if rr < (1.0 if tooth else .82):
                k = 5 if (dx < 0 and dy < 0) else 4
                if rr > .78: k -= 1
                if rr < .26: k = 1 if rr < .18 else 3
                tc.px(x, y, 'brass', k)
            elif rr < 1.0 and y + .5 > cy and dy > 0: pass
    for x in range(W):                                           # 두께(앞 모 2px)
        col = [y for y in range(H) if tc.get(x, y)]
        if col:
            yb = col[-1]
            for d in (1, 2): tc.px(x, yb + d, 'brass', 2 if d == 1 else 1)
    return tc

def ch_pipe(seed, L, dia=6):
    """잘린 관 토막(눕힘): 원통 음영 + 왼쪽 끝 열린 단면(어둠)."""
    tc = TC(L + 2, dia + 2, seed)
    pipe_h(tc, 1, L + 1, dia / 2 + 1, dia, 'steel' if _hash(seed, 0, 5) < .9 else 'rust', step=16)
    for y in range(1, dia + 1):
        tc.px(1, y, 'steel', 5); tc.px(2, y, 'dark', 1 if 1 < y < dia else 3)
    return tc

def ch_vert(seed):
    """척추뼈 한 마디: 둥근 몸통 + 위로 솟은 가시 돌기 + 양옆 날개(얼굴로 읽히지 않게 구멍 없음)."""
    tc = TC(11, 9, seed)
    tc.ell(5.5, 5.5, 3.2, 2.6, 'bone', lambda x, y: 5 if (x < 5 and y < 5) else (4 if y < 7 else 3))
    for (x, y, k) in ((5, 0, 5), (5, 1, 5), (6, 1, 4), (5, 2, 4), (1, 4, 4), (0, 5, 3), (9, 4, 4), (10, 5, 3)): tc.px(x, y, 'bone', k)
    return tc

def ch_flesh(seed, rx, ry):
    """추상 유기 덩이: 둥근 덩이 셋이 엉긴 검붉은 덩이, 젖은 반사 호(점 두 개 대칭 금지), 주름 골."""
    r = rng(seed); W = int(rx * 2 + 4); H = int(ry * 2 + 4); tc = TC(W, H, seed)
    lobes = [(W / 2, H / 2, rx, ry)] + [(W / 2 + r.uniform(-rx * .5, rx * .5), H / 2 + r.uniform(-ry * .3, ry * .4), rx * r.uniform(.45, .7), ry * r.uniform(.5, .75)) for _ in range(2)]
    for y in range(H):
        for x in range(W):
            best = None
            for (cx, cy, ax, ay) in lobes:
                d = ((x + .5 - cx) / ax) ** 2 + ((y + .5 - cy) / ay) ** 2
                if d <= 1 and (best is None or d < best[0]): best = (d, cx, cy, ax, ay)
            if best is None: continue
            d, cx, cy, ax, ay = best
            dx, dy = (x + .5 - cx) / ax, (y + .5 - cy) / ay
            k = 3 + (1 if (dx < -.15 and dy < -.1) else 0) - (1 if dy > .45 else 0) - (1 if d > .7 else 0)
            tc.px(x, y, 'flesh', clamp(k, 1, 6))
    # 젖은 반사: 왼쪽 위 짧은 호
    for (cx, cy, ax, ay) in lobes[:2]:
        for i in range(-2, 2):
            x = int(cx - ax * .45 + i); y = int(cy - ay * .55 + abs(i) * .5)
            if tc.get(x, y): tc.px(x, y, 'flesh', 5 if i else 6)
    # 주름 골
    for i in range(int(rx)):
        x = int(W / 2 - rx * .3 + i); y = int(H / 2 + math.sin(i * .9 + seed) * 1.2)
        if tc.get(x, y): tc.px(x, y, 'flesh', 2)
    return tc

def ch_girder(seed, L, ang):
    """H 형강 토막: 윗 플랜지 빛줄·웨브 그늘·아랫 플랜지, 끝은 찢겼다."""
    ca, sa = math.cos(ang), math.sin(ang); th = 7
    W = int(abs(ca) * L + abs(sa) * th + 4); H = int(abs(sa) * L + abs(ca) * th + 4)
    tc = TC(W, H, seed); cx, cy = W / 2, H / 2
    mat = 'steel' if _hash(seed, 2, 9) < .88 else 'rust'
    for y in range(H):
        for x in range(W):
            dx, dy = x + .5 - cx, y + .5 - cy
            t = (dx * ca + dy * sa); d = -dx * sa + dy * ca + th / 2
            if abs(t) > L / 2 - (1.5 * _hash(int(d), seed, 3) if t > 0 else 0) or not (0 <= d < th): continue
            di = int(d)
            k = (6, 5, 3, 1, 1, 5, 2)[di]
            tc.px(x, y, mat, k)
    return tc

KINDS = [('plate', .30), ('stone', .25), ('bone', .14), ('rib', .06), ('girder', .08), ('pipe', .06), ('glass', .04), ('gear', .02), ('vert', .03), ('rust', .02)]
def random_chunk(r, size, kinds=KINDS):
    names = [k for k, _ in kinds]; ws = np.array([w for _, w in kinds]); ws = ws / ws.sum()
    kd = names[int(r.choice(len(names), p=ws))]; sd = int(r.integers(1, 1 << 30))
    s = size
    if kd == 'plate': return ch_plate(sd, int(s * r.uniform(1.0, 1.6)), int(s * r.uniform(.6, .9)))
    if kd == 'rust': return ch_plate(sd, int(s * r.uniform(.9, 1.4)), int(s * r.uniform(.6, .8)), 'rust')
    if kd == 'stone': return ch_stone(sd, int(s * r.uniform(.9, 1.3)), int(s * r.uniform(.7, 1.0)))
    if kd == 'bone': return ch_bone(sd, s * r.uniform(1.2, 1.8), r.uniform(-.5, .5) + (math.pi if r.random() < .5 else 0), r0=max(1.8, s * .15))
    if kd == 'rib': return ch_rib(sd, s * r.uniform(.8, 1.2), r.uniform(3.4, 4.2), r.uniform(5.2, 6.0), th=max(3.0, s * .3))
    if kd == 'girder': return ch_girder(sd, s * r.uniform(1.6, 2.4), r.uniform(-.5, .5))
    if kd == 'pipe': return ch_pipe(sd, int(s * r.uniform(1.0, 1.6)), 6 if s > 8 else 4)
    if kd == 'glass': return ch_glass(sd, max(4, int(s * .6)))
    if kd == 'gear': return ch_gear(sd, max(3, s * .45))
    return ch_vert(sd)

# ---------------------------------------------------------------- 더미
def pile(W, H, inside, height, seed, path=None, kinds=KINDS, size=(8, 15), density=1.0, toff_fn=None, base_mat='ftst', features=()):
    """inside(x,y)->bool 실루엣, height(x,y)->0..1 (0 앞 아래, 1 꼭대기), path = 화소 마스크(조각을 두지 않는 길).
    1) 바탕(틈 어둠) 2) 조각을 뒤(위)에서 앞(아래)으로 3) 길."""
    tc = TC(W, H, seed); r = rng(seed)
    Y, X = np.mgrid[0:H, 0:W]
    ins = np.zeros((H, W), bool)
    for y in range(H):
        for x in range(W): ins[y, x] = inside(x, y)
    for y in range(H):
        for x in range(W):
            if ins[y, x]: tc.px(x, y, base_mat, 1 if _hash(x, y, seed) < .8 else 2)
    pts = []
    step = 5.0 / math.sqrt(density)
    yy = 0.0
    while yy < H:
        xx = (yy * 1.7) % step
        while xx < W:
            jx = xx + r.uniform(-step * .5, step * .5); jy = yy + r.uniform(-step * .5, step * .5)
            if 0 <= int(jx) < W and 0 <= int(jy) < H and ins[int(jy), int(jx)]: pts.append((jy, jx))
            xx += step
        yy += step * .8
    pts = [(py, px_, None) for (py, px_) in pts] + [(fy, fx, fc) for (fc, fx, fy) in features]
    pts.sort(key=lambda p: p[0])
    pm = path if path is not None else np.zeros((H, W), bool)
    for (py, px_, fc) in pts:
        h = height(int(min(W - 1, max(0, px_))), int(min(H - 1, max(0, py))))
        if fc is None:
            s = size[0] + (size[1] - size[0]) * (r.random() ** 1.2) * (1.0 - .3 * h)
            c = random_chunk(r, s, kinds)
        else: c = fc
        ox = int(px_ - c.w / 2); oy = int(py - c.h + 2)
        # 길 안에는 조각을 두지 않는다(길 가장자리 2px 까지만 걸친다)
        if pm.any():
            sub = pm[max(0, oy + 2):max(0, oy + c.h - 1), max(0, ox + 2):max(0, ox + c.w - 2)]
            if sub.size and sub.any(): continue
        toff = toff_fn(px_, py) if toff_fn else (1 if h > .78 else (0 if h > .3 else -1))
        # 실루엣 밖으로 크게 나가는 조각은 잘라 낸다(윤곽은 들쭉날쭉하되 떠 있지 않게)
        mm = c.m > 0
        for yy2 in ([] if fc is not None else range(0)): pass
        for yy2 in range(c.h):
            for xx2 in range(c.w):
                if mm[yy2, xx2] and fc is None:
                    gx, gy = ox + xx2, oy + yy2
                    if not (0 <= gx < W and 0 <= gy < H) or not (ins[min(H - 1, gy + 2), gx] if 0 <= gx < W else False):
                        if not (0 <= gx < W and 0 <= gy + 3 < H and ins[gy + 3, gx]): c.m[yy2, xx2] = 0
        paste_ol(tc, c, ox, oy, toff)
    return tc, ins

def path_steps(tc, pm, seed, step_h=5, mat='steel'):
    """길(화소 마스크)을 디딤판 계단으로: 다져진 부스러기 바탕 + step_h 마다 가로 강철 디딤판(윗모 빛·앞 모 그늘·리벳)."""
    H, W = pm.shape
    ys = np.nonzero(pm.any(1))[0]
    if len(ys) == 0: return
    for y in range(H):
        for x in range(W):
            if not pm[y, x]: continue
            k = 2 + (1 if _hash(x, y, seed) < .3 else 0)
            tc.px(x, y, 'ftst', k)
    yb = ys[-1]
    y = yb
    i = 0
    while y > ys[0]:
        row = np.nonzero(pm[y])[0]
        if len(row) >= 3:
            x0, x1 = row[0] + 1, row[-1]
            j0 = int(_hash(i, 1, seed) * 2); j1 = int(_hash(i, 2, seed) * 2)
            for xx in range(x0 + j0, x1 - j1):
                for d, k in ((-3, 5), (-2, 4), (-1, 3), (0, 1)):
                    if 0 <= y + d < H and pm[y + d, xx]: tc.px(xx, y + d, mat, k if xx > x0 + j0 else k + (1 if d < -1 else 0))
            if x1 - j1 - (x0 + j0) > 6:
                tc.px(x0 + j0 + 1, y - 2, mat, 6); tc.px(x1 - j1 - 2, y - 2, mat, 6)
        y -= step_h; i += 1
    # 길 가장자리: 한 단 어두운 테(부스러기와 갈라 읽히게)
    for y in range(H):
        for x in range(W):
            if pm[y, x] and ((x > 0 and not pm[y, x - 1]) or (x + 1 < W and not pm[y, x + 1])): tc.shift(x, y, -1)
