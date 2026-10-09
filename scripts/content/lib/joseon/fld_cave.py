"""동굴 입구(바위산 앞면에 박힌 3종)와 동굴 안 물체(cav_). 입구는 바위산 지형 칸(fld_ground)을 그대로 깔고 그 위에 구멍을 판다 —
그래서 좌우가 이웃 절벽과 한 화소도 어긋나지 않는다. 입구 조각은 3줄 높이: 윗 한 줄은 바위산 윗면, 아래 두 줄이 앞면(윗줄·밑동줄).
"""
import math
from tk import *
from build import outline
from props5 import ell, shadow_ell, box
from trees import ground_shadow
import fld_ground as FG
from fld_props import boulder, _clean, ST, WD, ER, LF, PN, SW, PL, PS, RD, DB, DG, GW


def _cliff_canvas(w_cells, seed):
    """바위산 윗면 1줄 + 앞면 2줄을 지형 칸 그대로 이어 붙인 바탕(w_cells 폭 × 3줄)."""
    c = Cv(w_cells * T, 3 * T)
    for i in range(w_cells):
        c.paste(FG.rock_top(15, (seed + i) % 2), i * T, 0)
        c.paste(FG.face(0, 3, (seed + i) % 2), i * T, T)
        c.paste(FG.face(1, 3, (seed + i) % 2), i * T, 2 * T)
    return c


def _arch_mask(W, cx, base, half, top, kind='round'):
    """입구 구멍 영역(불리언 격자): 아래는 곧은 벽, 위는 반원."""
    m = [[False] * W for _ in range(3 * T)]
    for y in range(top, base):
        for x in range(cx - half, cx + half):
            if kind == 'round':
                yc = top + half
                if y < yc:
                    u = (x + 0.5 - cx) / half
                    v = (y + 0.5 - yc) / half
                    if u * u + v * v > 1: continue
            elif kind == 'cleft':
                t = (y - top) / float(base - top)
                hw = 3 + (half - 3) * (t ** 0.8)
                if abs(x + 0.5 - cx) > hw: continue
            m[y][x] = True
    return m


def _fill_dark(c, m, cx, base, top):
    for y in range(3 * T):
        for x in range(c.w):
            if m[y][x]:
                t = (y - top) / float(max(1, base - top))
                q = rnd(x, y, 5)
                col = ST[0] if t < 0.55 else (ST[1] if t < 0.85 or q > 0.5 else ST[0])
                c.put(x, y, col)


def _ring(c, m, cx, base, top, half, stones, seed):
    """구멍 둘레 3px 쐐기돌 띠(밝은 윗면·어두운 이음)."""
    H = 3 * T
    inside = lambda x, y: 0 <= y < H and 0 <= x < c.w and m[y][x]
    for y in range(H):
        for x in range(c.w):
            if m[y][x]:
                continue
            d = min((k for k in range(1, 4) if any(inside(x + dx, y + dy) for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)))), default=0)
            if d == 0: continue
            ang = math.atan2(y - (top + half), x - cx)
            seg = int((ang + math.pi) / (math.pi / 7)) if y < top + half else (y // 6)
            if y >= top + half and abs(x - cx) < half + 4:
                col = ST[5] if (seg % 2) else ST[4]
                if d == 3: col = ST[2]
            else:
                col = (ST[6] if seg % 2 else ST[5]) if d == 1 else ((ST[5] if seg % 2 else ST[4]) if d == 2 else ST[2])
            if x < cx and d == 1: col = ST[6]
            c.put(x, y, col)


def cave_a(seed=1):
    """돌로 쌓은 굴 입구 80×48(5×3): 쐐기돌 아치가 바위산 앞면에 박혔다. 안쪽은 어둡고 문턱에 흙이 깔린다."""
    W = 5 * T
    c = _cliff_canvas(5, seed)
    cx, base, half, top = 40, 46, 14, 16
    m = _arch_mask(W, cx, base, half, top)
    _fill_dark(c, m, cx, base, top)
    _ring(c, m, cx, base, top, half, True, seed)
    for x in range(cx - half, cx + half):                               # 문턱 흙
        c.put(x, base, ER[4]); c.put(x, base + 1, ER[3])
        if x % 3: c.put(x, base - 1, ER[2])
    for x in (cx - 5, cx, cx + 5):                                      # 천장에서 늘어진 뿌리/고드름 돌
        for k in range(3):
            c.put(x, top + 1 + k, ST[2])
    boulder(c, 8, 44, 4.0, 2.8, seed)                                   # 입구 곁에 굴러 내린 돌
    boulder(c, 72, 44, 3.4, 2.4, seed + 3)
    ground_shadow(c, 40, 47, 28, 1.5, 55)
    return c


def cave_b(seed=2):
    """나무로 짠 갱도 입구 64×48(4×3): 두 기둥과 들보, 비스듬한 버팀대, 걸린 등. 광산·사냥꾼 굴."""
    W = 4 * T
    c = _cliff_canvas(4, seed)
    cx, base, top = 32, 46, 20
    half = 10
    m = [[False] * W for _ in range(3 * T)]
    for y in range(top, base):
        for x in range(cx - half, cx + half):
            m[y][x] = True
    _fill_dark(c, m, cx, base, top)
    for y in range(top - 4, base + 1):                                  # 기둥 둘
        for k, x in enumerate(range(cx - half - 3, cx - half)):
            c.put(x, y, WD[5] if k == 0 else (WD[4] if k == 1 else WD[3]))
        for k, x in enumerate(range(cx + half, cx + half + 3)):
            c.put(x, y, WD[4] if k == 0 else (WD[3] if k == 1 else WD[1]))
    for y in range(top - 6, top - 1):                                   # 들보
        for x in range(cx - half - 6, cx + half + 6):
            c.put(x, y, WD[6] if y == top - 6 else (WD[5] if y < top - 3 else (WD[3] if y < top - 2 else WD[2])))
    for k in range(5):                                                  # 버팀대(비스듬히)
        c.put(cx - half + k, top - 1 + k, WD[4]); c.put(cx - half + k, top + k, WD[2])
        c.put(cx + half - 1 - k, top - 1 + k, WD[3]); c.put(cx + half - 1 - k, top + k, WD[1])
    for x in range(cx - half, cx + half):
        c.put(x, base, ER[4]); c.put(x, base + 1, ER[3])
    for y in range(top - 1, top + 4):                                   # 걸린 등
        c.put(cx + 2, y, WD[2])
    for (dx, dy, col) in ((0, 4, PS[5]), (1, 4, PS[5]), (0, 5, PS[4]), (1, 5, PS[4]), (0, 6, RD[4]), (1, 6, RD[3]), (0, 3, PS[6])):
        c.put(cx + 2 + dx - 0, top + dy + 0, col)
    boulder(c, 6, 45, 4.2, 2.8, seed + 1)
    boulder(c, 58, 45, 3.6, 2.5, seed + 4)
    ground_shadow(c, 32, 47, 24, 1.5, 55)
    return c


def cave_c(seed=3):
    """갈라진 틈 굴 48×48(3×3): 바위산이 쪼개진 좁은 틈(위로 갈수록 좁다)과 짐승 뼈. 몬스터 굴."""
    W = 3 * T
    c = _cliff_canvas(3, seed)
    cx, base, half, top = 24, 46, 10, 14
    m = _arch_mask(W, cx, base, half, top, 'cleft')
    _fill_dark(c, m, cx, base, top)
    H = 3 * T
    for y in range(H):                                                  # 갈라진 가장자리: 밝은 왼쪽·어두운 오른쪽 한 줄
        for x in range(W):
            if m[y][x]:
                continue
            if x > 0 and m[y][x - 1]: c.put(x, y, ST[1])
            elif x < W - 1 and m[y][x + 1]: c.put(x, y, ST[6] if y % 3 else ST[5])
            elif x > 1 and m[y][x - 2]: c.put(x, y, ST[2])
            elif x < W - 2 and m[y][x + 2]: c.put(x, y, ST[5])
    for x in range(cx - half + 2, cx + half - 2):
        c.put(x, base, ER[3]); c.put(x, base + 1, ER[2])
    boulder(c, 8, 45, 4.2, 3.0, seed)
    boulder(c, 40, 44, 4.6, 3.2, seed + 2)
    # 문턱의 뼈
    for (x, y) in ((cx - 6, 44), (cx - 5, 45), (cx - 4, 44)):
        c.put(x, y, PL[5]); c.put(x + 1, y, PL[3])
    ground_shadow(c, 24, 47, 18, 1.5, 55)
    return c


# ---------------------------------------------------------------- 동굴 안 물체(cav_)
CST = [ST[0], ST[1], ST[1], ST[2], ST[3], ST[4], ST[5]]          # 어두운 바위 램프


def stalagmite(seed=0):
    """석순 16×32: 뾰족하게 솟은 돌 기둥 둘(왼쪽이 밝다)."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7, 1.6, 70)
    for (cx, base, h, w) in ((6, 29, 22, 6), (11, 29, 14, 5)):
        for k in range(h):
            half = max(0.8, (w / 2.0) * (1 - (k / float(h)) ** 1.3))
            y = base - k
            for x in range(int(round(cx - half)), int(round(cx + half)) + 1):
                u = (x - cx) / max(half, 0.8)
                t = 6 if u < -0.45 else (5 if u < 0.0 else (4 if u < 0.55 else 2))
                if rnd(x, y, seed + 4) < 0.14: t = max(2, t - 1)
                c.put(x, y, ST[max(2, min(t, 5) - 1)] if k > 1 else ST[5])
    return _clean(c)


def cave_rock(seed=0, wide=False):
    c = Cv(2 * T if wide else T, T)
    ground_shadow(c, c.w // 2 + 2, 14, c.w // 2 - 2, 1.6, 75)
    if wide:
        boulder(c, 10, 9, 7.0, 5.0, seed, ramp=CST)
        boulder(c, 24, 10, 6.0, 4.2, seed + 5, ramp=CST)
        boulder(c, 17, 12, 3.2, 2.4, seed + 9, ramp=CST)
    else:
        boulder(c, c.w // 2, 9, c.w // 2 - 3.5, 4.6, seed, ramp=CST)
    return _clean(c)


def brazier():
    """화로 16×32: 돌 받침 위 쇠 화로에서 불이 탄다(굴 안의 빛)."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7, 1.6, 70)
    box(c, 4, 29, 9, 2, 2, ST, (5, 4), (4, 3, 2, 1))
    for y in range(18, 28):                                             # 다리와 몸통
        c.put(7, y, ST[3]); c.put(8, y, ST[2])
    ell(c, 8, 17, 6.0, 3.0, lambda x, y, u, v: GW[5] if (v < 0 and u < 0.2) else (GW[3] if v < 0.5 else GW[2]))
    ell(c, 8, 16.5, 4.2, 1.8, lambda x, y, u, v: PS[3])
    flame = [(8, 4, PS[6]), (7, 5, PS[6]), (8, 5, PS[5]), (9, 5, PS[5]), (7, 6, PS[5]), (8, 6, PS[5]), (9, 6, PS[4]), (6, 7, PS[5]), (7, 7, PS[4]), (8, 7, PS[4]), (9, 7, PS[4]), (10, 7, PS[4]),
             (6, 8, PS[4]), (7, 8, PS[3]), (8, 8, PS[3]), (9, 8, PS[3]), (10, 8, RD[5]), (6, 9, PS[3]), (7, 9, RD[5]), (8, 9, RD[5]), (9, 9, RD[4]), (10, 9, RD[4]),
             (6, 10, RD[4]), (7, 10, RD[4]), (8, 10, RD[4]), (9, 10, RD[3]), (10, 10, RD[3]), (7, 11, RD[3]), (8, 11, RD[3]), (9, 11, RD[2]), (7, 12, PS[2]), (8, 12, PS[3]), (9, 12, PS[2]), (8, 13, PS[2]), (7, 13, PS[3]), (9, 13, PS[1])]
    for x, y, col in flame:
        c.put(x, y + 3, col)
    return _clean(c)


def chest():
    """보물 상자 16×16: 나무 몸통 + 쇠띠 + 둥근 뚜껑, 자물쇠."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 7, 1.5, 70)
    for y in range(5, 14):
        for x in range(2, 14):
            if y < 8:
                if y == 5 and (x < 3 or x > 12): continue
                t = WD[6] if y == 5 else (WD[5] if x < 6 else (WD[4] if x < 10 else WD[3]))
            else:
                t = WD[5] if x < 5 else (WD[4] if x < 9 else (WD[3] if x < 12 else WD[2]))
            c.put(x, y, t)
    for x in range(2, 14):
        c.put(x, 8, WD[1]); c.put(x, 13, WD[1])
    for x in (3, 12):
        for y in range(5, 14):
            c.put(x, y, GW[4] if x == 3 else GW[2])
    c.put(7, 9, PS[5]); c.put(8, 9, PS[4]); c.put(7, 10, PS[4]); c.put(8, 10, PS[3]); c.put(7, 8, GW[3]); c.put(8, 8, GW[3])
    return _clean(c)


def mushroom(kind=0):
    """굴 버섯 16×16: 푸른 갓과 흰 기둥이 모여 난다(어둠 속에서 눈에 띄는 색)."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 6, 1.4, 70)
    cap = DB if kind == 0 else DG
    for (cx, cy, rx, ry) in ((5, 9, 3.4, 2.4), (10, 6, 4.2, 2.8), (12, 11, 2.6, 1.9)):
        for y in range(int(cy) + 2, 14):
            c.put(int(cx), y, PL[5]); c.put(int(cx) + 1, y, PL[3])
        ell(c, cx, cy, rx, ry, lambda x, y, u, v: cap[6] if (v < -0.3 and u < 0) else (cap[5] if (u < 0.3 and v < 0.2) else (cap[4] if v < 0.5 else cap[3])))
    c.put(9, 5, PL[6]); c.put(5, 8, PL[6])
    return _clean(c)


def crystal():
    """푸른 결정 무더기 16×16: 뾰족한 결정 셋(왼쪽 면 밝고 오른쪽 면 어둡다), 바닥에 돌."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 6.5, 1.5, 70)
    boulder(c, 8, 12, 6, 2.6, 4, ramp=CST)
    for (cx, base, h, w) in ((5, 12, 8, 3), (9, 12, 12, 4), (13, 12, 6, 3)):
        for k in range(h):
            half = max(0.6, (w / 2.0) * (1 - k / (h * 1.15)))
            for x in range(int(cx - half), int(cx + half) + 1):
                u = (x - cx) / max(half, 0.5)
                c.put(x, base - k, DB[6] if (u < -0.3 and k > h // 3) else (DB[5] if u < 0.4 else DB[3]))
        c.put(cx, base - h, DB[6])
    return _clean(c)


def pillar():
    """동굴 기둥 16×32: 천장에서 내려온 종유석과 석순이 만난 굵은 돌기둥(왼쪽 밝고 오른쪽 어둡다), 가운데가 잘록하다."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7.5, 1.7, 70)
    for y in range(0, 30):
        t = y / 29.0
        hw = 3.2 + 2.6 * (abs(t - 0.5) * 2) ** 1.6
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x - 8) / max(hw, 1)
            tone = 6 if u < -0.5 else (5 if u < -0.05 else (4 if u < 0.55 else 2))
            if rnd(x, y, 12) < 0.15: tone = max(2, tone - 1)
            c.put(x, y, ST[min(5, tone)])
    return _clean(c)


def objects():
    d = {}
    d['fld_cave_a'] = cave_a(1)
    d['fld_cave_b'] = cave_b(2)
    d['fld_cave_c'] = cave_c(3)
    d['cav_stalagmite'] = stalagmite(0)
    d['cav_rock_a'] = cave_rock(1)
    d['cav_rock_b'] = cave_rock(4, wide=True)
    d['cav_brazier'] = brazier()
    d['cav_chest'] = chest()
    d['cav_mushroom_a'] = mushroom(0)
    d['cav_mushroom_b'] = mushroom(1)
    d['cav_crystal'] = crystal()
    d['cav_pillar'] = pillar()
    return d


if __name__ == '__main__':
    import sys
    from PIL import Image
    o = objects()
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(o)
    sc = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    ims = [(n, o[n].img()) for n in names]
    Wd = sum(i.width * sc + 12 for _, i in ims) + 12
    H = max(i.height for _, i in ims) * sc + 24
    s = Image.new('RGBA', (Wd, H), (88, 160, 53, 255))
    x = 12
    for n, i in ims:
        s.alpha_composite(i.resize((i.width * sc, i.height * sc), Image.NEAREST), (x, H - i.height * sc - 6))
        x += i.width * sc + 12
    s.convert('RGB').save(sys.argv[1])
    print('violations', len(VIOLATIONS))
