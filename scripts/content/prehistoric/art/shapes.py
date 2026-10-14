"""prehistoric 공용 도형 — 원뿔 지붕(이엉·가죽), 원통 벽, 바위 덩이(윗면 + 앞면), 출입구 구멍, 뼈 엄니 곡선.

3/4 탑뷰 규칙: 빛은 왼쪽 위. 위에서 보이는 면(지붕 원뿔, 바위 윗면, 원반)은 밝고, 남쪽 앞면은 한두 단 어둡고,
오른쪽은 더 어둡다. 윤곽은 자기 재질 가장 어두운 단, 땅에 닿는 밑선은 먹(ink).
"""
import math
from px import C, rnd, h32, NT, MI


def lit(u):
    """가로 위치 u(0 왼쪽 ~ 1 오른쪽) → 빛 단 보정."""
    return 1 if u < 0.28 else 0 if u < 0.6 else -1 if u < 0.85 else -2


# ═══════════════════════ 원뿔 지붕 ═══════════════════════
def cone_half(ay, ey, rx, y, power=0.62):
    k = max(0.0, (y + 0.5 - ay) / max(1, ey - ay))
    return rx * min(1.0, k) ** power


def cone_mask(ax, ay, cx, ey, rx, ry, x, y, power=0.62):
    """볼록한 원뿔(꼭짓점 ax,ay · 처마 타원 중심 cx,ey · 반지름 rx,ry) 안인가 → (u, 꼭짓점에서의 세로 비율)."""
    if y < ay: return None
    if y <= ey:
        half = cone_half(ay, ey, rx, y, power)
        if abs(x + 0.5 - cx) > half: return None
    else:
        dy = (y + 0.5 - ey) / ry
        if dy > 1: return None
        half = rx * math.sqrt(max(0, 1 - dy * dy))
        if abs(x + 0.5 - cx) > half: return None
    u = (x + 0.5 - (cx - half)) / max(1, 2 * half)
    return u, (y - ay) / max(1, ey + ry - ay)


def thatch_cone(c, ax, ay, cx, ey, rx, ry, base=3, tier=5, s=0, mat='thatch', power=0.62):
    """이엉 원뿔 지붕: 처마 곡선을 따라 휜 겹(tier px). 겹마다 머리 빛·몸 짚 가닥(짧은 세로 획)·밑 그늘.
    빛은 왼쪽(원뿔 둘레 위치 u)에서 오른쪽으로 네 단계. 잡음 점은 쓰지 않는다(가닥 획만)."""
    n = NT[MI[mat]]
    for y in range(c.h):
        for x in range(c.w):
            r = cone_mask(ax, ay, cx, ey, rx, ry, x, y, power)
            if r is None: continue
            u, v = r
            # 처마 타원을 따라 휘는 겹 좌표
            ex = (x + 0.5 - cx) / rx
            sag = ry * (1 - math.sqrt(max(0.0, 1 - min(1.0, ex * ex)))) * min(1.0, (y - ay) / max(1, ey - ay))
            yy = (y - ay) + ry * 0.0 - sag * -1.0
            yy = (y - ay) + sag * 0.9
            tp = int(yy) % tier; ti = int(yy) // tier
            t = base + (1 if u < 0.22 else 0 if u < 0.55 else -1 if u < 0.82 else -2)
            if v < 0.12: t += 1
            # 짚 가닥: 겹마다 엇갈린 세로 획
            col = (x + ti * 2) % 3
            if tp == 0: t += 1
            elif tp == tier - 1: t -= 2
            elif col == 0 and tp >= 2: t -= 1
            elif col == 1 and tp == 1: t += 1 if u < 0.6 else 0
            c.P(x, y, mat, max(0, min(n - 1, t)))
    # 처마 끝: 짚 끝 들쭉날쭉 + 밑 그늘
    for x in range(c.w):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == mat]
        if not ys: continue
        yb = max(ys)
        c.P(x, yb, mat, 1)
        if h32(x, 3, s) % 3 == 0 and yb + 1 < c.h: c.P(x, yb + 1, mat, 0)


def hide_cone(c, ax, ay, cx, ey, rx, ry, base=3, s=0, seams=5, mat='hide', power=1.0):
    """가죽 원뿔 천막: 꼭짓점으로 모이는 솔기(어두운 선 + 옆 부푼 빛) + 가로 꿰맴 점선, 왼쪽 밝게."""
    n = NT[MI[mat]]
    for y in range(c.h):
        for x in range(c.w):
            r = cone_mask(ax, ay, cx, ey, rx, ry, x, y, power)
            if r is None: continue
            u, v = r
            ang = math.atan2(x + 0.5 - ax, (y + 0.5 - ay) * 1.1 + 0.01)
            a = (ang + 1.6) * seams
            frac = a - math.floor(a)
            t = base + (1 if u < 0.25 else 0 if u < 0.58 else -1 if u < 0.84 else -2)
            if frac < 0.08: t -= 2
            elif frac < 0.22: t += 1
            elif frac > 0.9: t -= 1
            if (y - ay) % 10 == 6 and frac > 0.3 and frac < 0.85 and x % 2 == 0: t -= 1
            c.P(x, y, mat, max(0, min(n - 1, t)))


# ═══════════════════════ 원통 벽 ═══════════════════════
def cyl_wall(c, x0, y0, w, h, fn):
    """원통 벽 앞면: fn(x, y, u, j) -> (mat, t) — u 는 0~1 가로 위치."""
    for j in range(h):
        for i in range(w):
            u = (i + 0.5) / w
            r = fn(x0 + i, y0 + j, u, j)
            if r: c.P(x0 + i, y0 + j, *r)


def daub(x, y, u, j, base=4, s=0):
    """흙 반죽 벽(욋가지 엮음 위에 흙): 따뜻한 흙빛, 엮음 가로 결이 드문드문 비친다."""
    t = base + lit(u)
    # 흙 반죽 덩이 결: 손으로 바른 얕은 가로 자국(짧은 획, 위 빛·밑 그늘)
    k = (x + (y // 4) * 5) % 9
    if y % 4 == 1 and k < 4: t += 1 if u < 0.7 else 0
    elif y % 4 == 2 and k < 4: t -= 1
    if j >= 0 and (h32(x // 6, y // 7, s) % 11 == 0) and x % 6 == 2: t -= 1
    return ('dirt', max(1, min(6, t)))


def log_wall(x, y, u, j, base=3, s=0):
    """세운 통나무 벽: 4px 통나무, 통나무마다 왼쪽 빛·오른쪽 그늘·틈 먹."""
    k = x % 4
    if k == 3: return ('bark', 0)
    t = base + lit(u) + (1 if k == 0 else 0) - (1 if k == 2 else 0)
    if rnd(x // 4, y // 3, s) < 0.12: t -= 1
    return ('bark', max(0, min(5, t)))


# ═══════════════════════ 출입구 ═══════════════════════
def doorway(c, x0, y0, w, h, arch=4, floor='dirt', curtain=None):
    """어두운 출입구(사람 크기): 위 아치, 안은 위로 갈수록 어둡다. 밑 두 줄은 안쪽 바닥.
    curtain: 위에 말아 올린 가죽 휘장 재질."""
    for j in range(h):
        for i in range(w):
            # 아치: 위 arch 줄은 둥글게 깎는다
            if j < arch:
                dx = (i + 0.5 - w / 2) / (w / 2); dy = (arch - j - 0.5) / arch
                if dx * dx + dy * dy > 1.0: continue
            t = 0 if j < h * 0.45 else 1
            mat = 'ink'
            if j >= h - 2: mat, t = floor, 1 if j == h - 2 else 2
            elif j >= h - 5 and i > w * 0.3: mat, t = 'ink', 2
            c.P(x0 + i, y0 + j, mat, t)
    if curtain:
        for i in range(w):
            if c.get(x0 + i, y0 + arch - 1) is None: continue
            c.P(x0 + i, y0 + arch - 1, curtain, 4 if i < w * 0.4 else 3)
            c.P(x0 + i, y0 + arch, curtain, 2)
        # 옆으로 젖힌 휘장 자락(왼쪽)
        for j in range(arch, h - 3):
            c.P(x0, y0 + j, curtain, 3); c.P(x0 + 1, y0 + j, curtain, 2 if j % 3 else 1)


# ═══════════════════════ 바위(보로노이 덩이 결) ═══════════════════════
def seeds(x0, y0, w, h, cell, s):
    out = []
    for gy in range(-1, h // cell + 2):
        for gx in range(-1, w // cell + 2):
            out.append((x0 + (gx + 0.15 + 0.7 * rnd(gx, gy, s)) * cell, y0 + (gy + 0.15 + 0.7 * rnd(gx, gy, s + 1)) * cell * 0.8, h32(gx, gy, s + 2)))
    return out


def near2(x, y, sd):
    b0 = (9e9, None); b1 = 9e9
    for (sx, sy, k) in sd:
        d = math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.15)
        if d < b0[0]: b1 = b0[0]; b0 = (d, (sx, sy, k))
        elif d < b1: b1 = d
    return b0[1], b0[0], b1


def rock_px(x, y, sd, u, mat='stone', base=None, cell=10, depth=0.0):
    """앞면 바위 결 한 화소: 덩이(보로노이 칸)마다 왼쪽 위 빛·오른쪽 아래 그늘, 덩이 사이 틈은 어둡다.
    depth 0(위)~1(밑): 밑으로 갈수록 한 단 어둡다."""
    n = NT[MI[mat]]
    base = n - 3 if base is None else base
    (sx, sy, k), d1, d2 = near2(x, y, sd)
    if d2 - d1 < 1.05: return (mat, 1)
    dx, dy = (x + 0.5 - sx) / cell, (y + 0.5 - sy) / cell
    t = base + (k % 3 == 0) - (k % 5 == 0)
    if dx + dy < -0.42: t += 1
    elif dx + dy > 0.38: t -= 1
    if d2 - d1 < 2.0 and dx + dy > 0: t -= 1
    if d2 - d1 < 2.0 and dx + dy < -0.2: t += 1
    t += (1 if u < 0.25 else 0 if u < 0.62 else -1)
    t -= int(depth * 1.6)
    return (mat, max(1, min(n - 1, t)))


def smooth_noise1(i, s, period=9):
    a = rnd(i // period, 1, s); b = rnd(i // period + 1, 1, s); f = (i % period) / period
    f = f * f * (3 - 2 * f)
    return a * (1 - f) + b * f


def rock_hill(c, x0, y0, w, h, top_h, mat='stone', cap='grass', s=0, cell=10, round_top=0.35, side_in=3):
    """바위 언덕(3/4): 울퉁불퉁한 뒤 윤곽 + 윗면(cap: grass 풀 덮개 · rock 밝은 암반 · ash 재) + 앞면 바위 덩이 결.
    돌려주는 값: front[i] = 열 i 의 앞면 시작 y(윗면 앞 가장자리)."""
    n = NT[MI[mat]]
    sd = seeds(x0, y0, w, h, cell, s)
    back = []; front = []
    for i in range(w):
        e = abs((i + 0.5) / w * 2 - 1)
        drop = (e ** 4) * top_h * round_top * 2.2
        sh = (max(0.0, e - 0.82) / 0.18) ** 1.6 * min(10, top_h * 0.45)     # 둥근 어깨: 양 끝 열은 윗면·앞면이 함께 내려앉는다
        back.append(int(y0 + smooth_noise1(i, s, 11) * top_h * 0.2 + drop + sh))
        front.append(int(y0 + top_h + (smooth_noise1(i, s + 5, 8) - 0.5) * 3 + sh))
    bottom = y0 + h - 1
    for i in range(w):
        e = abs((i + 0.5) / w * 2 - 1)
        u = (i + 0.5) / w
        # 앞면(좌우 끝은 조금 안으로 둥글게)
        for y in range(front[i], bottom + 1):
            j = y - front[i]; fh = bottom - front[i] + 1
            inset = side_in * (max(0, 1 - j / 5.0)) if e > 0.92 else 0
            if e > 0.97 and y > bottom - 2: continue
            if inset and (i < inset or i >= w - inset): continue
            c.P(x0 + i, y, *rock_px(x0 + i, y, sd, u, mat, cell=cell, depth=j / max(1, fh)))
        # 윗면
        for y in range(back[i], front[i]):
            j = y - back[i]
            if cap == 'grass':
                import terrain as _T
                gm, gt = _T.p_grass0((x0 + i) % 16, y % 16)
                t = gt + (1 if u < 0.3 else 0 if u < 0.72 else -1)
                if j == 0: t = 1
                elif j == 1: t = max(t, 4)
                if gm == 'bloom': c.P(x0 + i, y, gm, gt); continue
                c.P(x0 + i, y, 'grass', max(1, min(5, t)))
            elif cap == 'fern':
                t = 2 + (1 if u < 0.3 else 0 if u < 0.7 else -1)
                if j == 0: t = 1
                if (x0 + i + y) % 4 == 0 and j > 1: t += 2
                c.P(x0 + i, y, 'fern', max(1, min(5, t)))
            else:
                tm = {'rock': mat, 'ash': 'ash'}[cap]
                tn = NT[MI[tm]]
                (sx, sy, k), d1, d2 = near2(x0 + i, y, sd)
                t = tn - 2 + (1 if u < 0.3 else 0 if u < 0.7 else -1)
                if j == 0: t = tn - 4
                elif j == 1: t = tn - 1
                elif d2 - d1 < 1.0: t -= 2
                c.P(x0 + i, y, tm, max(1, min(tn - 1, t)))
        # 윗면 앞 가장자리 빛
        if cap in ('rock', 'ash'): c.P(x0 + i, front[i] - 1, mat if cap == 'rock' else 'ash', (NT[MI[mat]] - 1) if cap == 'rock' else 4)
    # 풀 덮개는 앞면 위로 처진다(술 모양)
    if cap in ('grass', 'fern'):
        for i in range(w):
            ln = [0, 1, 2, 1, 3, 1, 0, 2][h32(i // 2, 9, s) % 8]
            for k in range(ln):
                y = front[i] + k
                if c.get(x0 + i, y): c.P(x0 + i, y, cap, 2 if k == ln - 1 else 3)
            if c.get(x0 + i, front[i] + ln): 
                g = c.get(x0 + i, front[i] + ln); c.P(x0 + i, front[i] + ln, g[0], max(0, g[1] - 2))
    return front, back


def arch_mask(i, j, w, h, arch):
    """출입구 아치 안인가(폭 w · 높이 h · 위 arch 줄 둥글게)."""
    if j >= arch: return 0 <= i < w and j < h
    dx = (i + 0.5 - w / 2) / (w / 2); dy = (arch - j - 0.5) / arch
    return dx * dx + dy * dy <= 1.0


def tusk_arc(c, cx, by, rx, ry, a0=200, a1=340, width=3, mat='bone'):
    """타원 호 엄니(중심 cx, 밑 by, 반지름 rx·ry, 각도 a0→a1). 굵기 width, 윗가 밝게·밑가 어둡게, 끝으로 갈수록 가늘다."""
    steps = int(abs(a1 - a0) * max(rx, ry) / 12) + 20
    pts = {}
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        f = k / steps
        wk = max(1, round(width * (1 - 0.55 * f)))
        for d in range(wk):
            x = cx + (rx - d) * math.cos(a); y = by + (ry - d) * math.sin(a)
            key = (round(x), round(y))
            t = 5 if d == 0 else 2 if d == wk - 1 else 4
            if key not in pts or t > pts[key]: pts[key] = t
    for (x, y), t in pts.items(): c.P(x, y, mat, t)
    # 밑가 먹선
    for (x, y), t in list(pts.items()):
        if (x, y + 1) not in pts and c.get(x, y + 1) and c.get(x, y + 1)[0] != mat: c.P(x, y + 1, mat, 0)
