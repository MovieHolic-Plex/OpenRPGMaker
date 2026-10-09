#!/usr/bin/env python3
"""월드맵 5판 생성기 — FF6 월드맵 실측(tiledata/atlas-pick/worldmap-ff6-study.md 「실측」 절)에 맞춘 톤·질감.

  python3 scripts/content/atlas-pick/worldmap_v5_gen.py            # 전부
  python3 scripts/content/atlas-pick/worldmap_v5_gen.py mountain   # 일부
  → tiledata/atlas-pick/candidates-worldmap/<slug>/v5-A.pxg (그다음 worldmap_check.py)

4판에서 바뀐 것(실측 근거):
- 팔레트: worldmap5.pal (어둡고 채도 낮음). 바다 (16,32,72)/(16,40,96) 두 톤이 84%, 풀 (40,88,40) 54%.
- 외곽선 없음. 재질은 **질감**으로 가른다(4판의 wink 윤곽·밝은 풀 테 폐기).
- 바다 = 4×2 벽돌 물결 두 톤 + 1px 반짝임 ~4%. 해안 = 물쪽 거품 그라데이션 + 땅쪽 어두운 둑 1px + 모래 띠.
- 풀 = 세 톤 잡음(54/25/21%). 산 = 땅이 안 보이는 조밀한 바위 덩이 + 「/」 능선 밝은 줄.
- 숲 = 세로 잎결 아주 어두운 덩이. 침엽수 = 홀로 선 작은 나무(폭 4·키 11).
- 아이콘은 4판 크기 등급을 유지하되 색을 가라앉히고 윤곽 대신 명암·바닥 그림자만 쓴다.
"""
import math, random, sys, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import worldmap_v4_gen as V4
from worldmap_v4_gen import Img, paint_bundle, facing, CAND, ROOT

V4.PAL_LINE = '@palette ../../palette/worldmap5.pal'
TITLE = '5판: FF6 실측 톤(어둡고 채도 낮음), 외곽선 없음'


def _rng(seed): return random.Random(seed)


# ------------------------------------------------------------------ 바다 / 해안
def sea_tex(ramp='wsea', seed=5, dark=0, mid=1, dash=2, dash2=3, sp1=3, sp2=4, p_dash=.0, p2=.0, p_sp=.026, sp_ramp=None):
    """4×2 벽돌 물결(16px 주기) 두 톤 + 옅은 줄 + 1px 반짝임."""
    rng = _rng(seed); cell = {}
    for y in range(16):
        for x in range(16): cell[(x, y)] = dark
    for _ in range(46):                 # 무작위 가로 2~3px 덩이 — 규칙적인 벽돌 대신 흩어진 물결
        x, y = rng.randrange(16), rng.randrange(16)
        for k in range(rng.choice([2, 2, 3])): cell[((x + k) % 16, y)] = mid
    free = [(x, y) for y in range(16) for x in range(16)]; rng.shuffle(free)
    n = lambda p: int(round(256 * p))
    i = 0
    for k, (tone, cnt) in enumerate(((dash, n(p_dash)), (dash2, n(p2)))):
        for _ in range(cnt // 2):     # 가로 2px 줄
            x, y = free[i]; i += 1
            cell[(x, y)] = tone; cell[((x + 1) % 16, y)] = tone
    sparks = set()
    for _ in range(n(p_sp) // 2):     # 반짝임 1px
        x, y = free[i]; i += 1
        cell[(x, y)] = sp1; sparks.add((x, y))
    for _ in range(1 if p_sp > .02 else 0):
        x, y = free[i]; i += 1
        cell[(x, y)] = sp2; sparks.add((x, y))
    spset = {sp1, sp2}
    if sp_ramp:
        return lambda x, y: ((sp_ramp[0], sp_ramp[1]) if cell[(x % 16, y % 16)] in spset and (x % 16, y % 16) in sparks else (ramp, cell[(x % 16, y % 16)]))
    return lambda x, y: (ramp, cell[(x % 16, y % 16)])


SAND_DEPTH = 4   # 땅쪽 둑1 + 모래 띠까지(바깥 귀퉁이는 투명으로 남아야 bg 검사를 통과)


def gen_coast():
    tex = sea_tex()
    fr = _rng(9)
    def water_edge(role, x, y, d, m, ext):
        h = (x * 7 + y * 13 + role.__hash__() % 5) % 10
        if d == 1: return ('wsea', 4 if h < 1 else 3)          # FF6 물쪽 밝기 83 -> 70 -> 59 -> 57 -> 50 -> 45 -> 43 (깊은 색까지 6~7px)
        if d == 2: return ('wsea', 3 if h < 5 else 2)
        if d == 3: return ('wsea', 2)
        if d == 4: return ('wsea', 2 if h < 6 else 1)
        if d == 5: return ('wsea', 2 if h < 3 else 1)
        if d == 6: return ('wsea', 2 if h < 1 else 1) if h < 6 else None
        return None
    img, P = paint_bundle('coast', 74, 3, 2, 4, tex, water_edge, title='coast_grass v5-A')
    # 땅쪽: 물과 닿은 투명 화소부터 바깥으로 거리 1 = 어두운 둑, 2~ = 모래 띠(FF6 실측: 둑 1~2px, 모래 3~5px)
    for cx, cy in V4.LAYOUT.values():
        if (cx, cy) == V4.LAYOUT['body_alt']: continue
        x0, y0 = cx * 16, cy * 16
        dist = {}
        front = []
        for y in range(16):
            for x in range(16):
                if img.g[y0 + y][x0 + x] is None: continue
                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + a, y + b
                    if 0 <= X < 16 and 0 <= Y < 16 and img.g[y0 + Y][x0 + X] is None and (X, Y) not in dist:
                        dist[(X, Y)] = 1; front.append((X, Y))
        while front:
            nxt = []
            for x, y in front:
                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + a, y + b
                    if 0 <= X < 16 and 0 <= Y < 16 and img.g[y0 + Y][x0 + X] is None and (X, Y) not in dist:
                        dist[(X, Y)] = dist[(x, y)] + 1; nxt.append((X, Y))
            front = nxt
        for (x, y), d in dist.items():
            if d > SAND_DEPTH: continue
            h = (x * 5 + y * 11 + cx * 3 + cy * 7) % 10
            if d == 1: t = ('wgrass', 0 if h < 6 else 1)
            elif d == 2: t = ('wrock', 2 if h < 5 else 3)
            else: t = ('wrock', 4 if h < 5 else 3)
            img.put(x0 + x, y0 + y, t)
    return img


def gen_sea_deep():
    tex = sea_tex('wdeep', 6, dark=0, mid=1, dash=2, dash2=3, sp1=4, sp2=5, p_dash=.0, p2=.0, p_sp=.034, sp_ramp=('wsea', 3))
    def edge(role, x, y, d, m, ext):
        if d == 1: return ('wdeep', 3)
        if d == 2 and (x + y) % 2 == 0: return ('wdeep', 2)
        return None
    return paint_bundle('sea_deep', 85, 3, 2, 4, tex, edge, title='sea_deep v5-A')[0]


# ------------------------------------------------------------------ 풀 바탕
def gen_plains_base():
    out = Img(48, 16)
    for v in range(3):
        rng = _rng(100 + v)
        for y in range(16):
            for x in range(16):
                r = rng.random()
                out.put(v * 16 + x, y, ('wgrass', 1 if r < .25 else (3 if r > .79 else 2)))
        for _ in range(9):            # 2px 짧은 덩이로 뭉쳐 「점점이」가 아닌 결이 되게
            x, y = rng.randrange(15), rng.randrange(16)
            t = out.g[y][v * 16 + x]
            out.put(v * 16 + x + 1, y, t)
    return out


# ------------------------------------------------------------------ 산 / 숲 / 침엽수 덩이
def mountain_tex(seed=21):
    """덩이진 어두운 바위: 4×4 값 잡음을 늘려 덩어리 + 화소 잡음. 밝은 「/」 능선은 3~4px 짧은 줄을 몇 개만."""
    rng = _rng(seed)
    N = 8
    g = [[rng.random() for _ in range(N)] for _ in range(N)]
    def v(x, y):
        gx, gy = x / (16 / N), y / (16 / N); x0, y0 = int(gx) % N, int(gy) % N; x1, y1 = (x0 + 1) % N, (y0 + 1) % N
        fx, fy = gx - int(gx), gy - int(gy)
        a = g[y0][x0] * (1 - fx) + g[y0][x1] * fx; b = g[y1][x0] * (1 - fx) + g[y1][x1] * fx
        return a * (1 - fy) + b * fy
    cell = {}
    for y in range(16):
        for x in range(16):
            t = v(x, y) + (rng.random() - .5) * .55
            cell[(x, y)] = 0 if t < .3 else (1 if t < .55 else (2 if t < .8 else 3))
    for _ in range(5):                  # 흩어진 회색 낱알(밝은 줄 대신)
        cell[(rng.randrange(16), rng.randrange(16))] = 5
    for _ in range(3):                  # 능선 낱알 2px 「/」
        x, y = rng.randrange(15), rng.randrange(1, 16)
        cell[(x, y)] = 5; cell[(x + 1, y - 1)] = 4
    return lambda x, y: ('wrock', cell[(x % 16, y % 16)])


def gen_mountain():
    tex = mountain_tex()
    def edge(role, x, y, d, m, ext):
        if d == 1:
            f = facing(x, y, ext, 1)
            return ('wrock', 3 if f > 0 else (0 if f < 0 else 1))
        if d == 2 and facing(x, y, ext) > 0: return ('wrock', 2)
        return None
    return paint_bundle('mountain', 41, 4, 3, 5, tex, edge, title='mountain v5-A')[0]


def forest_tex(seed=31):
    rng = _rng(seed); cell = {}
    for y in range(16):
        for x in range(16):
            cell[(x, y)] = 0 if rng.random() < .4 else 1
    for _ in range(9):                           # 옅은 얼룩(밝은 잎 덩이 2~3px)
        x, y = rng.randrange(16), rng.randrange(16)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (2, 0))[:rng.choice([3, 4, 5])]:
            cell[((x + dx) % 16, (y + dy) % 16)] = 2
    for _ in range(22):                          # 세로 잎결 2~4px
        x, y = rng.randrange(16), rng.randrange(16)
        n = rng.choice([2, 3, 3, 4]); tone = rng.choice([2, 2, 3, 3, 3, 4])
        for k in range(n):
            cell[(x, (y + k) % 16)] = tone if k < n - 1 else max(0, tone - 2)
    return lambda x, y: ('wleaf', cell[(x % 16, y % 16)])


def gen_forest():
    tex = forest_tex()
    def edge(role, x, y, d, m, ext):
        if d == 1: return ('wleaf', 0)
        if d == 2 and facing(x, y, ext) > 0: return ('wleaf', 3)
        return None
    return paint_bundle('forest', 52, 4, 3, 5, tex, edge, title='forest v5-A')[0]


def conifer_tex(seed=41):
    cell = {}
    for y in range(16):
        for x in range(16): cell[(x, y)] = ('wpine', 1 if (x + y) % 5 else 0)
    for cx, top in ((3, 0), (11, 3), (7, 9), (14, 12), (1, 10)):
        for k in range(7):
            hw = min(2, (k + 1) // 2)
            for dx in range(-hw, hw + 1):
                cell[((cx + dx) % 16, (top + k) % 16)] = ('wpine', 3 if dx < 0 and k > 0 else (1 if dx > 0 else 2))
        cell[(cx % 16, (top + 7) % 16)] = ('wbark', 0)
    return lambda x, y: cell[(x % 16, y % 16)]


def gen_conifer():
    tex = conifer_tex()
    def edge(role, x, y, d, m, ext):
        if d == 1: return ('wpine', 0)
        return None
    return paint_bundle('conifer', 63, 4, 3, 5, tex, edge, title='conifer v5-A')[0]


# ------------------------------------------------------------------ 큰 덩이 조각(96×32 = 32×32 셋)
def _tree(img, cx, top, h, w, ramp='wpine'):
    """홀로 선 소나무: 폭 w·키 h 삼각 + 줄기 2px, 왼쪽 밝게·오른쪽 어둡게."""
    for k in range(h):
        hw = max(0, min(w // 2, (k * (w // 2 + 1)) // (h - 1)))
        for dx in range(-hw, hw + 1):
            img.put(cx + dx, top + k, (ramp, 2 if dx < 0 and k > 1 else (0 if dx > 0 else 1)))
    img.put(cx, top + h, ('wbark', 1)); img.put(cx, top + h + 1, ('wbark', 0))


def gen_conifer_crowns():
    out = Img(96, 32)
    lay = [[(8, 3, 11, 5), (20, 9, 11, 5), (13, 17, 11, 5)],
           [(6, 8, 11, 5), (17, 2, 11, 5), (25, 14, 11, 5), (11, 17, 11, 5)],
           [(14, 4, 12, 5), (5, 14, 11, 5), (24, 16, 11, 5)]]
    for i, tr in enumerate(lay):
        tmp = Img(32, 32)
        for cx, top, h, w in sorted(tr, key=lambda t: t[1] + t[2]):
            t2 = Img(32, 32); _tree(t2, cx, top, h, w); tmp.blit(t2, 0, 0)
        out.blit(tmp, i * 32, 0)
    return out


def gen_forest_crowns():
    """외곽선 없는 어두운 덩이 + 세로 잎결. 덩이 아래는 그늘(-)."""
    out = Img(96, 32); rng = _rng(77)
    vs = [[(16, 17, 11), (9, 13, 6), (23, 14, 6)], [(9, 19, 7), (23, 19, 7), (16, 12, 7)], [(12, 18, 9), (24, 21, 6), (22, 11, 6)]]
    for i, lobes in enumerate(vs):
        tmp = Img(32, 32)
        for cx, cy, r in lobes:
            V4._disc(tmp, cx, cy, r, lambda dx, dy, rr: ('wleaf', 1))
        for y in range(32):
            for x in range(32):
                if tmp.g[y][x] is None: continue
                r = rng.random()
                s = (x + y) - 32
                tmp.g[y][x] = ('wleaf', 0 if r < .35 else (1 if r < .8 else 2))
        for _ in range(38):
            x, y = rng.randrange(32), rng.randrange(28); n = rng.choice([2, 3, 3, 4]); tone = rng.choice([2, 3, 3, 4, 5])
            if all(tmp.get(x, y + k) is not None for k in range(n)):
                for k in range(n): tmp.put(x, y + k, ('wleaf', tone if k < n - 1 else tone - 2))
        out.blit(tmp, i * 32, 0)
    return out


def _peak(peaks, seed):
    """봉우리: 왼 사면 밝게(위왼 빛)·오른 사면 어둡게 + 능선 「/」 밝은 줄. 눈 없음, 외곽선 없음, 발치는 몸통 톤으로 풀림."""
    rng = _rng(seed); img = Img(32, 32)
    top = [99] * 32; who = [0] * 32
    for x in range(32):
        for i, (cx, ay, hw) in enumerate(peaks):
            y = ay + abs(x + .5 - cx) * 1.5 + (rng.random() - .5) * 2.8
            if y < top[x]: top[x] = y; who[x] = i
    top = [int(round(t)) for t in top]
    for x in range(32):
        cx, ay, hw = peaks[who[x]]
        for y in range(top[x], 32):
            left = x + .5 < cx; depth = y - top[x]
            r = rng.random()
            if depth == 0: t = 3 if left else 2
            elif depth == 1: t = 3 if left else 1
            elif left: t = 2 if r < .6 else (3 if r < .72 else 1)
            else: t = 1 if r < .55 else (0 if r < .78 else 2)
            if y >= 27 and depth > 2: t = 1 if r < .5 else 2
            img.put(x, y, ('wrock', t))
        # 능선 밝은 줄(정상에서 왼쪽 아래로 흐르는 「/」)
    for cx, ay, hw in peaks:
        for k in range(0, 9):
            x, y = int(cx) - k // 1, ay + int(k * 1.5) + 1
            if 0 <= x < 32 and y < 30 and img.g[y][x] is not None and k % 4 == 0: img.put(x, y, ('wrock', 5))
    return img


def gen_mountain_peaks():
    out = Img(96, 32)
    out.blit(_peak([(16, 4, 13)], 3), 0, 0)
    out.blit(_peak([(9, 12, 9), (22, 5, 11)], 4), 32, 0)
    out.blit(_peak([(6, 15, 7), (16, 10, 8), (26, 16, 7)], 5), 64, 0)
    return out


# ------------------------------------------------------------------ 3판 조각 재색(pxg 텍스트 리맵)
STEP = {   # 램프별 (3판 번호 → 5판 번호)
    'wsea': {1: 1, 2: 2, 3: 3, 4: 3, 5: 3},
    'wdirt': {1: 0, 2: 1, 3: 2, 4: 3, 5: 4},
    'wgrass': {1: 1, 2: 2, 3: 2, 4: 3, 5: 3},
    'whill': {1: 1, 2: 1, 3: 1, 4: 2, 5: 2},
    'wsand': {0: 0, 1: 0, 2: 1, 3: 2, 4: 3, 5: 3},
    'wdune': {0: 0, 1: 0, 2: 1, 3: 1},
    'wstone': {1: 1, 2: 1, 3: 2, 4: 3, 5: 4},
    'wrock': {1: 1, 2: 2, 3: 3, 4: 4, 5: 5},
}


def remap_v3(slug, title):
    """v3-A.pxg 의 @palette·@mat 만 5판으로 바꾼다(블록·레이어는 그대로)."""
    src = (CAND / slug / 'v3-A.pxg').read_text(encoding='utf-8').splitlines()
    out = []
    for ln in src:
        if ln.startswith('@palette'): ln = V4.PAL_LINE
        elif ln.startswith('//'): ln = f'// {slug} v5-A ({TITLE}; v3-A 재색)'
        else:
            m = re.match(r'@mat (\S) (\w+) (\d+)$', ln)
            if m:
                k, ramp, s = m.group(1), m.group(2), int(m.group(3))
                s = STEP.get(ramp, {}).get(s, s)
                ln = f'@mat {k} {ramp} {s}'
        out.append(ln)
    return out


def write_remap(slug):
    p = CAND / slug / 'v5-A.pxg'
    p.write_text('\n'.join(remap_v3(slug, '')) + '\n', encoding='utf-8')
    return p


# ------------------------------------------------------------------ 흩뿌림(48×16 = 16×16 셋)
def gen_trees_scatter():
    """FF6 식 홀로 선 침엽수(폭 4·키 11, 세 톤 초록) — 숲 가장자리에 성기게."""
    out = Img(48, 16)
    lay = [[(5, 3)], [(11, 4), (4, 6)], [(8, 2)]]
    for i, ts in enumerate(lay):
        tmp = Img(16, 16)
        for cx, top in ts:
            _tree(tmp, cx, top, 9, 4)
            for x in range(cx - 1, cx + 3): tmp.put(x, top + 11, '-')
        out.blit(tmp, i * 16, 0)
    return out


def gen_plains_scatter():
    """풀 결 한두 뭉치(밝은 풀 2px 획) — 꽃 없음."""
    out = Img(48, 16)
    lay = [[(4, 6), (10, 10)], [(7, 3), (11, 12), (3, 12)], [(5, 8)]]
    for i, ps in enumerate(lay):
        for x, y in ps:
            out.put(i * 16 + x, y, ('wgrass', 4)); out.put(i * 16 + x + 1, y, ('wgrass', 3)); out.put(i * 16 + x, y + 1, ('wgrass', 0))
    return out


# ------------------------------------------------------------------ 실행
JOBS = {
    'mountain': gen_mountain, 'forest': gen_forest, 'conifer': gen_conifer, 'coast_grass': gen_coast,
    'sea_deep': gen_sea_deep, 'plains_base': gen_plains_base, 'mountain_peaks': gen_mountain_peaks,
    'forest_crowns': gen_forest_crowns, 'conifer_crowns': gen_conifer_crowns,
    'trees_scatter': gen_trees_scatter, 'plains_scatter': gen_plains_scatter,
}
REMAP = ['shoal', 'hills', 'desert', 'river', 'road', 'bridge_h', 'bridge_v']
try:
    import worldmap_v5_icons
    JOBS.update(worldmap_v5_icons.ICON_JOBS)
except ImportError:
    pass


def main():
    names = sys.argv[1:] or list(JOBS) + REMAP
    for n in names:
        if n in REMAP: p = write_remap(n)
        else:
            p = CAND / n / 'v5-A.pxg'
            JOBS[n]().write(p, f'{n} v5-A ({TITLE})')
        print('wrote', p.relative_to(ROOT))


if __name__ == '__main__':
    main()
