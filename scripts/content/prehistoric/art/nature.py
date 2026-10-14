#!/usr/bin/env python3
"""prehistoric 자연 — 큰 고사리·소철·나무고사리·정글 나무·아라우카리아·속새·갈대·늪 나무·고목·덤불·버섯,
바위(둥근 돌·큰 바위·바위 언덕·현무암 기둥·용암 바위 첨탑·흑요석 조각), 바닥 덧그림(덩굴 꽃·연잎·발자국).

나무·풀은 organic(윗줄 별 = 뒤로 지나가면 위에 그려진다, 밑줄 막힘). 잎 덩이는 공 모양 빛(왼쪽 위 밝게).

  python3 nature.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, NT, MI
from kit import Reg, contact, OUT
from shapes import seeds, near2, rock_px, rock_hill, lit

R = Reg('nature')


# ═══════════════════════ 잎 덩이 ═══════════════════════
def foliage(c, blobs, mat='fern', base=None, s=0, clump=3, leafy=False):
    """잎 덩이(공) 여럿: 뒤(위)부터 앞(아래)으로 겹친다. 덩이마다 왼쪽 위 빛, 오른쪽 아래 가장자리 그늘,
    잎 무늬 = clump px 덩이마다 왼쪽 위 화소 밝게·오른쪽 아래 어둡게(잎사귀 하나)."""
    n = NT[MI[mat]]
    base = n - 4 if base is None else base
    owner = {}
    for bi, (cx, cy, r) in enumerate(sorted(blobs, key=lambda b: b[1])):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.92)
                d = dx * dx + dy * dy
                # 가장자리를 잎 끝처럼 들쭉날쭉
                if d > 1.0 + (rnd(x, y, s + bi) - 0.6) * 0.25: continue
                light = -0.62 * dx - 0.78 * dy
                t = base + (1 if light > 0.25 else 0) + (1 if light > 0.62 else 0) - (1 if light < -0.3 else 0) - (1 if light < -0.7 else 0)
                if leafy:
                    # 2판(화풍 정렬): 버들항 나무처럼 공 안을 잎 뭉치(지름 6~8px)로 나누고 뭉치마다 왼쪽 위 빛면·오른쪽 아래 그늘면,
                    # 뭉치 사이 틈은 한 단 어둡게 — 공 하나의 큰 명암 위에 뭉치 명암이 얹혀 4~5단이 된다
                    k, sx, sy, d1, d2 = _leaf_seed(x, y, cx, cy, r, s + bi * 7)
                    ll = -0.62 * (x + 0.5 - sx) / 3.4 - 0.78 * (y + 0.5 - sy) / 3.4
                    if ll > 0.3: t += 1
                    if ll > 0.68 and light > -0.4: t += 1
                    if ll < -0.35: t -= 1
                    if d2 - d1 < 1.2 and ll < 0.1: t -= 1
                else:
                    gx, gy = (x + bi * 5) // clump, (y + (x // clump) % 2 + bi) // clump
                    lx, ly = (x + bi * 5) % clump, (y + (x // clump) % 2 + bi) % clump
                    rr = rnd(gx, gy, s + 40)
                    if lx == 0 and ly == 0 and rr < 0.55 and light > -0.5: t += 1
                    elif lx == clump - 1 and ly == clump - 1 and rr > 0.35: t -= 1
                if d > 0.8 and light < 0: t -= 1
                c.P(x, y, mat, max(0, min(n - 1, t)))
                owner[(x, y)] = bi
    # 덩이 사이: 앞 덩이 윗가장자리 바로 위(뒤 덩이) 한 줄 그늘
    for (x, y), bi in owner.items():
        b2 = owner.get((x, y + 1))
        if b2 is not None and b2 > bi:
            g = c.get(x, y); c.P(x, y, g[0], max(0, g[1] - 2))
    return owner


_LEAF = {}


def _leaf_seed(x, y, cx, cy, r, s):
    """잎 뭉치 씨앗(공 하나 안 격자 4.5px + 흔들림)에서 가장 가까운 것: (번호, 씨앗 x, y, 첫 거리, 둘째 거리)."""
    key = (round(cx, 2), round(cy, 2), round(r, 2), s)
    if key not in _LEAF:
        pts = []; g = 4.6
        n = int(r / g) + 2
        for j in range(-n, n + 1):
            for i in range(-n, n + 1):
                px_ = cx + i * g + (j % 2) * g / 2 + (rnd(i, j, s + 61) - 0.5) * 2.2
                py_ = cy + j * g * 0.86 + (rnd(i, j, s + 62) - 0.5) * 2.0
                pts.append((px_, py_))
        _LEAF[key] = pts
    best = (9e9, 0); sec = 9e9
    for k, (px_, py_) in enumerate(_LEAF[key]):
        d = math.hypot(x + 0.5 - px_, y + 0.5 - py_)
        if d < best[0]: sec = best[0]; best = (d, k)
        elif d < sec: sec = d
    px_, py_ = _LEAF[key][best[1]]
    return best[1], px_, py_, best[0], sec


def frond(c, x0, y0, ang, ln, droop, mat='fern', t0=4, leaf=2, s=0):
    """깃꼴 잎 한 장: 줄기 곡선을 따라 작은 잎이 쌍쌍이(폭이 걸음마다 넓고 좁게 번갈아 잎 사이 홈이 보인다).
    위쪽 반 밝게·아래쪽 반 어둡게·가운데 잎맥. 잎 둘레 한 화소 어두운 테를 먼저 깔아 겹친 잎끼리 갈라진다."""
    n = NT[MI[mat]]
    W = leaf + 0.8
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    steps = ln * 3
    body = {}
    prev = None
    for k in range(steps + 1):
        f = k / steps
        x = x0 + ca * ln * f
        y = y0 + sa * ln * f + droop * 7 * f * f
        if prev is not None:
            dx, dy = x - prev[0], y - prev[1]
            nn = math.hypot(dx, dy) or 1
            nx, ny = -dy / nn, dx / nn
            if ny > 0: nx, ny = -nx, -ny
            wf = W * (math.sin(math.pi * min(1, 0.12 + f)) ** 0.5) * (1.0 if int(f * ln * 0.9) % 2 == 0 else 0.55)
            for d10 in range(-int(wf * 10), int(wf * 10) + 1, 3):
                d = d10 / 10
                key = (round(x + nx * d), round(y + ny * d))
                tt = t0 - int(f * 1.8) + (1 if d > 0.5 else 0) - (1 if d < -0.5 else 0)
                if abs(d) < 0.35: tt = t0 - 1 - int(f * 1.8)
                body[key] = max(1, min(n - 1, tt))
        prev = (x, y)
    for (x, y) in body:
        for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k2 = (x + ddx, y + ddy)
            if k2 not in body and ddy >= 0: c.P(k2[0], k2[1], mat, 0)
    for (x, y), tt in body.items(): c.P(x, y, mat, tt)


def outline_soft(c):
    c.outline(bottom=('ink', 1))


# ═══════════════════════ 고사리·소철·나무고사리 ═══════════════════════
@R.add('fern-giant', '큰 고사리 포기', 2, 2, 'organic', tags=['고사리', '정글', '풀'], rules='정글·숲 바닥 가장자리. 길을 막지 않게 덩이로.')
def _(c):
    cx, cy = 16, 22
    for (a, ln, dr, t) in ((200, 13, 0.5, 3), (-20, 13, 0.5, 2), (225, 12, 0.3, 4), (-45, 12, 0.3, 3), (250, 11, 0.1, 5), (-70, 11, 0.1, 4),
                           (270, 10, 0.0, 5), (180, 12, 0.7, 2), (0, 12, 0.7, 2), (160, 10, 0.9, 1), (20, 10, 0.9, 1)):
        frond(c, cx, cy, a, ln, dr, t0=t + 1, leaf=2)
    for i in range(-2, 3): c.P(cx + i, cy + 1, 'fern', 1)
    outline_soft(c)


@R.add('fern-s', '작은 고사리', 1, 1, 'organic', tags=['고사리', '풀'], rules='바닥 꾸밈. 길·문 앞에는 두지 않는다.')
def _(c):
    cx, cy = 8, 12
    for (a, ln, dr, t) in ((200, 7, 0.4, 3), (-20, 7, 0.4, 2), (240, 7, 0.1, 5), (-60, 7, 0.1, 4), (270, 6, 0, 5), (175, 6, 0.8, 2), (5, 6, 0.8, 1)):
        frond(c, cx, cy, a, ln, dr, t0=t + 1, leaf=2)
    outline_soft(c)


def scaly_trunk(c, x0, y0, w, h, mat='bark', s=0):
    """소철·나무고사리 줄기: 마름모 비늘(잎자루 흔적), 왼쪽 빛."""
    for j in range(h):
        for i in range(w):
            u = (i + 0.5) / w
            k = (i + (j // 2) * 2) % 4
            t = 3 + lit(u)
            if j % 2 == 0 and k == 0: t -= 2
            elif j % 2 == 1 and k == 2: t -= 1
            elif k == 1: t += 1 if u < 0.6 else 0
            c.P(x0 + i, y0 + j, mat, max(0, min(5, t)))


@R.add('cycad', '소철(굵은 비늘 줄기 + 뻣뻣한 잎)', 2, 3, 'organic', tags=['소철', '정글', '나무'], rules='정글·마을 둘레 정원. 다른 나무와 한 칸 띄운다.')
def _(c):
    scaly_trunk(c, 11, 26, 10, 20)
    for j in range(3): c.HL(10 - j, 44 + j, 12 + 2 * j, 'bark', 1 if j else 2)
    cx, cy = 16, 24
    for (a, ln, dr, t) in ((195, 15, 0.25, 3), (-15, 15, 0.25, 2), (215, 14, 0.1, 4), (-35, 14, 0.1, 3), (240, 13, 0, 5), (-60, 13, 0, 4),
                           (265, 12, 0, 5), (-85, 12, 0, 5), (175, 13, 0.5, 2), (5, 13, 0.5, 1), (155, 10, 0.7, 1), (25, 10, 0.7, 1)):
        frond(c, cx, cy, a, ln, dr, mat='fern', t0=t + 1, leaf=2)
    # 가운데 솔방울(노랑 갈색)
    for (i, j, t) in ((-1, -1, 4), (0, -1, 4), (1, -1, 3), (-1, 0, 3), (0, 0, 3), (1, 0, 2), (0, 1, 2)):
        c.P(cx + i, cy + j, 'thatch', t)
    outline_soft(c)


@R.add('tree-fern', '나무고사리(가는 줄기 + 우산 잎)', 2, 4, 'organic', tags=['나무고사리', '정글', '나무'], rules='정글·늪 가장자리. 덩이로 두세 그루.')
def _(c):
    scaly_trunk(c, 14, 20, 5, 42, s=3)
    c.HL(12, 61, 9, 'bark', 1); c.HL(13, 60, 7, 'bark', 2)
    cx, cy = 16, 16
    for (a, ln, dr, t) in ((190, 16, 0.6, 2), (-10, 16, 0.6, 1), (210, 15, 0.45, 3), (-30, 15, 0.45, 2), (235, 13, 0.2, 4), (-55, 13, 0.2, 3),
                           (260, 10, 0.05, 5), (-80, 10, 0.05, 5), (170, 13, 0.85, 1), (10, 13, 0.85, 1), (120, 9, 0.6, 1), (60, 9, 0.6, 1)):
        frond(c, cx, cy, a, ln, dr, t0=t + 1, leaf=2)
    for (i, j, t) in ((-1, 0, 4), (0, 0, 3), (1, 0, 2), (0, -1, 4)): c.P(cx + i, cy + j, 'fern', t)
    outline_soft(c)


# ═══════════════════════ 큰 나무 ═══════════════════════
def trunk(c, cx, top, bot, w, roots=3, s=0):
    """줄기 + 뿌리 갈래(밑에서 벌어진다). 세로 껍질 결, 왼쪽 빛."""
    for y in range(top, bot + 1):
        f = (y - top) / max(1, bot - top)
        ww = w + (roots * 2 * max(0, f - 0.7) / 0.3 if f > 0.7 else 0)
        x0 = int(round(cx - ww / 2)); x1 = int(round(cx + ww / 2))
        for x in range(x0, x1):
            u = (x - x0 + 0.5) / max(1, x1 - x0)
            t = 3 + lit(u)
            if (x - x0) % 3 == 2 and (y + x) % 5 != 0: t -= 1
            c.P(x, y, 'bark', max(0, min(5, t)))


@R.add('jungle-tree', '정글 나무(넓은 잎 덩이)', 4, 5, 'organic', tags=['나무', '정글', '숲'], rules='정글 숲 덩이. 줄기 칸(밑 두 줄)만 막힌다. 길 곁에는 한 칸 띄운다.')
def _(c):
    trunk(c, 32, 44, 78, 8, roots=5)
    foliage(c, [(20, 22, 14), (44, 20, 15), (32, 12, 13), (14, 36, 11), (50, 36, 11), (32, 34, 14), (24, 46, 9), (42, 47, 9)], mat='fern', base=3, s=1, leafy=True)
    # 늘어진 덩굴 두 가닥
    for (x, y0, ln) in ((19, 44, 9), (47, 45, 7)):
        for j in range(ln): c.P(x + (j // 4) % 2, y0 + j, 'grass', 3 if j % 3 else 4)
    outline_soft(c)


@R.add('araucaria', '아라우카리아(층층 가지 침엽수)', 3, 5, 'organic', tags=['나무', '침엽수', '숲'], rules='숲·언덕. 줄기 칸만 막힌다.')
def _(c):
    trunk(c, 24, 10, 78, 4, roots=2, s=2)
    # 층마다 양옆으로 뻗어 끝이 처진 가지 판: 위에서 보이는 잎 윗면(밝음) + 처진 밑 가장자리(어두움), 끝은 뭉툭한 잎 뭉치
    for k, (y, half) in enumerate(((12, 8), (22, 12), (33, 16), (45, 20), (57, 23))):
        blobs = []
        for side in (-1, 1):
            for m in range(3):
                f = (m + 1) / 3
                blobs.append((24 + side * half * f * 0.85, y + 2 + f * f * 5, 3.2 + (1 - f) * 2.2))
        blobs.append((24, y, 4 + half * 0.15))
        foliage(c, blobs, mat='fern', base=3 - (k > 2), s=20 + k, clump=2)
    foliage(c, [(24, 6, 3.5)], mat='fern', base=4, s=30, clump=2)
    outline_soft(c)


@R.add('swamp-tree', '늪 나무(버팀 뿌리 + 늘어진 이끼)', 3, 4, 'organic', tags=['나무', '늪'], rules='늪 진흙 위. 물칸에는 두지 않는다.')
def _(c):
    # 버팀 뿌리(아치 여러 개)
    for (x0, x1) in ((10, 20), (16, 26), (22, 34), (26, 38)):
        for k in range(21):
            f = k / 20; x = x0 + (x1 - x0) * f; y = 62 - 10 * math.sin(math.pi * f)
            c.P(round(x), round(y), 'bark', 3 if f < 0.5 else 2); c.P(round(x), round(y) + 1, 'bark', 1)
    trunk(c, 24, 26, 54, 7, roots=2, s=4)
    foliage(c, [(14, 18, 11), (34, 16, 12), (24, 9, 10), (24, 24, 11)], mat='fern', base=2, s=4, leafy=True)
    # 늘어진 이끼
    for x in range(10, 40, 3):
        ln = 4 + h32(x, 1, 4) % 7
        for j in range(ln): c.P(x, 26 + j, 'grass', 2 if j > ln - 3 else 3)
    outline_soft(c)


@R.add('dead-tree', '타 죽은 고목(화산)', 2, 3, 'organic', tags=['고목', '화산'], rules='화산재 바닥·용암 둘레. 덩이로 한두 그루.')
def _(c):
    trunk(c, 16, 14, 46, 5, roots=3, s=5)
    for (x0, y0, x1, y1) in ((16, 22, 6, 10), (16, 18, 26, 6), (7, 12, 3, 6), (24, 8, 29, 3), (16, 14, 15, 2), (12, 16, 9, 12), (21, 20, 28, 16)):
        c.line(x0, y0, x1, y1, 'bark', 3); c.line(x0 + 1, y0, x1 + 1, y1, 'basalt', 1)
    for (x, y) in ((6, 10), (26, 6), (15, 2)): c.P(x, y, 'ash', 3)
    outline_soft(c)


@R.add('horsetail', '속새 무리(마디 줄기)', 1, 2, 'organic', tags=['속새', '물가', '늪'], rules='물가·늪 둑.')
def _(c):
    for k, (x, top) in enumerate(((3, 6), (6, 2), (9, 8), (12, 4), (7, 12))):
        for y in range(top, 31):
            t = 4 if k % 2 == 0 else 3
            if (y - top) % 4 == 0: t = 1
            elif (y - top) % 4 == 1: t += 1
            c.P(x, y, 'grass', t); c.P(x + 1, y, 'grass', max(1, t - 2))
        c.P(x, top - 1, 'thatch', 4)
        for side in (-1, 1):
            for j in range(top + 3, 28, 4): c.P(x + (2 if side > 0 else -1), j + 1, 'grass', 2)
    outline_soft(c)


@R.add('reeds', '늪 갈대', 1, 1, 'organic', tags=['갈대', '늪', '물가'], rules='늪 진흙 둑에 덩이로.')
def _(c):
    for k, (x, top, lean) in enumerate(((2, 3, -1), (5, 1, 0), (8, 4, 1), (11, 2, 0), (13, 6, 1))):
        for y in range(top, 16):
            xx = x + (lean if y < top + 4 else 0)
            c.P(xx, y, 'grass', 4 if y < top + 6 else 3)
        c.P(x + lean, top - 1, 'mud', 4); c.P(x + lean, top, 'mud', 5)
    outline_soft(c)


@R.add('bush', '덤불', 1, 1, 'organic', tags=['덤불', '풀'], rules='빈터 가장자리 꾸밈.')
def _(c):
    foliage(c, [(6, 8, 5), (10, 7, 5), (8, 11, 5)], mat='grass', base=2, s=7, clump=2)
    outline_soft(c)


@R.add('berry-bush', '열매 덤불', 2, 1, 'organic', tags=['덤불', '열매', '채집'], rules='마을 둘레 채집터.')
def _(c):
    foliage(c, [(8, 9, 6), (16, 7, 7), (24, 9, 6), (12, 12, 5), (21, 12, 5)], mat='grass', base=2, s=8, clump=2)
    for (x, y) in ((7, 7), (14, 5), (19, 9), (25, 8), (11, 11), (22, 12), (16, 10)):
        c.P(x, y, 'feather', 3); c.P(x + 1, y + 1, 'feather', 1)
    outline_soft(c)


@R.add('mushrooms', '버섯 무리', 1, 1, 'organic', tags=['버섯', '숲'], rules='숲·동굴 앞 그늘.')
def _(c):
    for (cx, cy, r, h) in ((5, 8, 3, 5), (10, 6, 4, 7), (12, 11, 2, 3)):
        for j in range(h): c.P(cx, cy + j, 'bone', 4); c.P(cx + 1, cy + j, 'bone', 2)
        for y in range(cy - r, cy + 1):
            for x in range(cx - r, cx + r + 2):
                dx = (x + 0.5 - cx - 0.5) / (r + 0.5); dy = (y + 0.5 - cy) / (r * 0.8)
                if dx * dx + dy * dy <= 1: c.P(x, y, 'ochre', 4 if dx + dy < -0.5 else 3 if dx < 0.3 else 2)
        c.P(cx - 1, cy - r + 1, 'bone', 5); c.HL(cx - r, cy + 1, 2 * r + 2, 'ochre', 1)
    outline_soft(c)


# ═══════════════════════ 바위 ═══════════════════════
def boulder(c, cx, cy, rx, ry, mat='stone', s=0, top=0.45):
    """둥근 돌: 위에서 보이는 둥근 윗면(밝은 판) + 앞면(어둡다), 금 하나."""
    n = NT[MI[mat]]
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1 + (rnd(x, y, s) - 0.5) * 0.15: continue
            topface = dy < top - 0.6 + 0.3 * (1 - dx * dx)
            if topface:
                t = n - 2 + (1 if dx + dy < -0.7 else 0) - (1 if dx > 0.5 else 0)
            else:
                t = n - 4 + (1 if dx < -0.4 else 0) - (1 if dx > 0.4 else 0) - (1 if dy > 0.75 else 0)
            c.P(x, y, mat, max(1, min(n - 1, t)))
    # 윗면 앞 가장자리 빛선
    for x in range(int(cx - rx), int(cx + rx) + 1):
        ys = [y for y in range(c.h) if c.get(x, y) and c.get(x, y)[0] == mat and c.get(x, y)[1] >= n - 3]
        if ys: c.P(x, max(ys), mat, n - 1 if x < cx else n - 2)
    c.line(int(cx + rx * 0.2), int(cy - ry * 0.1), int(cx + rx * 0.45), int(cy + ry * 0.6), mat, 1)


@R.add('rock-s', '둥근 돌', 1, 1, 'organic', tags=['바위', '돌'], rules='빈터 가장자리·길가에 드문드문.')
def _(c):
    boulder(c, 8, 10, 6.5, 5, s=1); outline_soft(c)


@R.add('rock-l', '큰 바위', 2, 2, 'organic', tags=['바위'], rules='숲·언덕 가장자리. 길을 막지 않는다.')
def _(c):
    boulder(c, 13, 20, 11, 9, s=2); boulder(c, 24, 25, 6, 5, s=3); outline_soft(c)


@R.add('rock-mossy', '이끼 낀 바위', 2, 2, 'organic', tags=['바위', '이끼', '정글'], rules='정글·늪 둑.')
def _(c):
    boulder(c, 15, 19, 12, 10, s=4)
    for x in range(4, 28):
        for y in range(8, 20):
            g = c.get(x, y)
            if g and g[0] == 'stone' and g[1] >= 4 and rnd(x // 2, y // 2, 9) < 0.55:
                c.P(x, y, 'grass', 3 if x < 15 else 2)
    outline_soft(c)


@R.add('rock-outcrop', '바위 언덕(풀 윗면)', 3, 2, 'organic', tags=['바위', '언덕'], rules='들판·마을 둘레 가장자리. 통째로 막힌다.')
def _(c):
    rock_hill(c, 0, 0, 48, 31, 12, mat='stone', cap='grass', s=6, cell=9)
    outline_soft(c)


@R.add('basalt-columns', '현무암 기둥 무리(육각 윗면)', 2, 3, 'organic', tags=['현무암', '화산', '바위'], rules='화산 골짜기 둘레.')
def _(c):
    # 키가 다른 육각 기둥: 위에서 보이는 육각 윗면(밝음) + 앞면 두 쪽(왼쪽 밝게·오른쪽 어둡게)
    for (cx, top, w) in ((9, 10, 8), (23, 6, 8), (16, 16, 8), (5, 24, 7), (27, 22, 7)):
        bot = 46
        for y in range(top + 4, bot):
            for x in range(cx - w // 2, cx + w // 2):
                left = x < cx
                t = 3 if left else 1
                if x == cx - w // 2: t = 2
                if (y - top) % 9 == 0: t -= 1
                c.P(x, y, 'basalt', max(0, t))
        for j in range(5):
            half = w // 2 - (abs(j - 2) if j != 2 else 0) * 1
            for x in range(cx - half, cx + half):
                c.P(x, top + j, 'basalt', 5 if j < 3 and x < cx else 4)
        c.HL(cx - w // 2 + 1, top, w - 2, 'basalt', 3)
    outline_soft(c)


@R.add('lava-spire', '용암 바위 첨탑', 1, 2, 'organic', tags=['화산', '바위'], rules='화산재 바닥에 드문드문.')
def _(c):
    for y in range(2, 31):
        f = (y - 2) / 29
        half = 1.5 + f * 5.5
        for x in range(int(8 - half), int(8 + half) + 1):
            u = (x - (8 - half)) / (2 * half)
            t = 3 + lit(u)
            if (y + x) % 7 == 0: t -= 1
            c.P(x, y, 'basalt', max(0, min(5, t)))
    for (x, y) in ((7, 12), (8, 13), (9, 18), (6, 22), (7, 23)): c.P(x, y, 'lava', 2)
    c.P(8, 1, 'basalt', 4)
    outline_soft(c)


@R.add('obsidian', '흑요석 조각', 1, 1, 'debris', tags=['흑요석', '화산', '잔해'], rules='화산재 바닥·용암 둘레 잔해.')
def _(c):
    for (x0, y0, pts) in ((3, 8, ((0, 0), (2, -3), (4, 1), (2, 3))), (9, 10, ((0, 0), (3, -2), (5, 2), (2, 3))), (6, 4, ((0, 0), (2, -2), (3, 1)))):
        poly = [(x0 + a, y0 + b) for a, b in pts]
        c.poly(poly, lambda x, y: ('tar', 2 if (x + y) % 3 else 3))
        c.P(poly[1][0], poly[1][1] + 1, 'basalt', 5)
    c.outline(bottom=('ink', 1))


# ═══════════════════════ 바닥 덧그림 ═══════════════════════
@R.add('lily', '연잎(물 위)', 1, 1, 'flat', tags=['늪', '물', '연잎'], rules='늪·물칸 위층 덧그림. 걸을 수 없는 물 위에만.')
def _(c):
    for (cx, cy, r) in ((5, 5, 3.4), (11, 10, 3.0), (4, 12, 2.2)):
        for y in range(16):
            for x in range(16):
                dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.75)
                if dx * dx + dy * dy <= 1 and not (dx > 0 and abs(dy) < 0.25 and dx < 0.9):
                    c.P(x, y, 'grass', 4 if dx + dy < -0.4 else 3 if dy < 0.4 else 2)
    c.P(11, 9, 'bloom', 3); c.P(12, 9, 'bloom', 2); c.P(11, 8, 'bone', 5)


# 들꽃 덧그림(flowers)은 뺐다 — object-gate 에서 «flat(깔개·바닥 무늬)» 종류가 아니라고 판정됐다(2026-10-14). 풀밭 무늬(grass bloom 점)로 대신한다.


@R.add('footprints', '큰 짐승 발자국(세 발가락)', 1, 1, 'flat', tags=['발자국', '공룡', '흙'], rules='흙·진흙 바닥 덧그림. 줄지어 두세 개.')
def _(c):
    # 세 발가락 발자국 하나(칸 가득): 움푹한 바닥(어둡게) + 앞쪽(남) 가장자리 밝은 흙 둔덕
    pts = set()
    for (x0, y0, x1, y1) in ((8, 10, 8, 2), (8, 10, 3, 4), (8, 10, 13, 4)):
        n = 12
        for k in range(n + 1):
            x = x0 + (x1 - x0) * k / n; y = y0 + (y1 - y0) * k / n
            r = 1.6 - 0.8 * k / n
            for yy in range(int(y - 2), int(y + 3)):
                for xx in range(int(x - 2), int(x + 3)):
                    if (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r: pts.add((xx, yy))
    for yy in range(9, 14):
        for xx in range(5, 12):
            if ((xx + 0.5 - 8) / 3.2) ** 2 + ((yy + 0.5 - 11) / 2.4) ** 2 <= 1: pts.add((xx, yy))
    for (x, y) in pts:
        c.P(x, y, 'dirt', 1 if (x, y - 1) not in pts else 2)
    for (x, y) in pts:
        if (x, y + 1) not in pts: c.P(x, y + 1, 'dirt', 5)


if __name__ == '__main__':
    R.export()
    ims = [(it['id'], R.render(it).img()) for it in R.items]
    contact(ims, os.path.join(OUT, 'nature', 'preview.png'), z=3, W=1900, bg=(138, 95, 58))
    print(len(R.items), 'nature')
