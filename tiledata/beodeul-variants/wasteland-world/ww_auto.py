# 황폐 필드 오토타일 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0, 가로 4칸씩) + 바닥·골 앞면 표본.
#  autotile-crack : 땅 균열 ↔ 붉은 흙 가장자리. 좁고 깊은 틈(속은 어둠, 북쪽 안벽에 사암 지층 3~4px, 남쪽 테에 밝은 흙 턱). 막힘.
#  autotile-dust  : 재·먼지 번짐. 땅 위에 덧그리는 회보랏빛 재(칩셋 모래흙 결 → 재 램프) + 바람 물결, 가장자리는 체커 디더로 옅어진다.
#  autotile-trail : 밟아 다진 흙길. 밝은 다져진 붉은 흙(칩셋 모래흙 결), 가장자리 눌린 띠 + 잔돌 테.
# 화산 지대 vf_auto.edge_depth 와 같은 주기 잡음 가장자리 규칙이라 옆 칸과 이어진다.
import numpy as np
from PIL import Image
from ww_base import P, RGB, hash2, tnoise, recolor_tile, chip_tex, sheet_from_cells, ground_tex, chasm_render, crack_lines, mud_plates

N_, E_, S_, W_ = 1, 2, 4, 8
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def tnoise1(N, sc, seed):
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f


def edge_depth(n, inset=2.4, jag=1.7, rad=5.0, seed=1, size=16):
    """변형 n 의 가장자리 깊이장(화산 지대와 같은 식). m<0 투명, m>=0 칸 안."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & N_), 'E': not (n & E_), 'S': not (n & S_), 'W': not (n & W_)}
    jN = tnoise1(size, 4, seed + 1); jS = tnoise1(size, 4, seed + 2); jW = tnoise1(size, 4, seed + 3); jE = tnoise1(size, 4, seed + 4)
    d = {'N': Y - (inset + (jN[X] - 0.5) * 2 * jag), 'S': (size - 1 - Y) - (inset + (jS[X] - 0.5) * 2 * jag),
         'W': X - (inset + (jW[Y] - 0.5) * 2 * jag), 'E': (size - 1 - X) - (inset + (jE[Y] - 0.5) * 2 * jag)}
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    return m


def crack_sheet(seed=11):
    """깊은 땅 균열 16변형(투명 덧그림). 틈 폭은 칸의 ~10px(이웃 쪽으로는 칸 끝까지 이어진다).
    속: 북쪽 안벽(남쪽을 보는 면) 3~4px 붉은 사암 지층 → 아래는 어둠. 테: 1px 어두운 윤곽, 남쪽 테 위 밝은 흙 턱 1px."""
    cells = []
    rr = P('rrock'); ab = P('abyss'); rd = P('rdirt')
    for n in range(16):
        m = edge_depth(n, inset=3.0, jag=1.4, rad=4.0, seed=seed)
        inside = m >= 0
        out = np.zeros((16, 16, 4), np.uint8)
        for x in range(16):
            run = 99 if (n & N_) and inside[0, x] else 0                       # 위 이웃이 있으면 안벽이 위 칸에서 이미 끝났다
            for y in range(16):
                if not inside[y, x]: run = 0; continue
                k = run; run += 1
                if k < 4 and not ((n & N_) and k >= 99):
                    t = (4, 3, 3, 2)[k] if k < 4 else 1
                    if hash2(x, y, seed + 3) > 0.8: t -= 1
                    c = rr[t]
                    if k == 2 and hash2(x // 2, y, seed + 4) > 0.5: c = P('dust')[4]          # 얇은 재 층
                else:
                    c = ab[1 if hash2(x, y, seed + 5) > 0.15 else 2]
                out[y, x, :3] = c; out[y, x, 3] = 255
        # 테: 바깥 1px 윤곽, 남쪽 테 밑 밝은 흙 턱
        edge = (~inside) & (np.roll(inside, 1, 0) | np.roll(inside, -1, 0) | np.roll(inside, 1, 1) | np.roll(inside, -1, 1))
        # 감긴(roll) 가장자리가 반대쪽에서 넘어오지 않게
        edge[0, :] &= inside[1, :] | np.roll(inside, 1, 1)[0, :] | np.roll(inside, -1, 1)[0, :]
        edge[15, :] &= inside[14, :] | np.roll(inside, 1, 1)[15, :] | np.roll(inside, -1, 1)[15, :]
        out[edge] = (rd[0][0], rd[0][1], rd[0][2], 255)
        lip = (~inside) & np.roll(inside, 1, 0) & ~edge
        lip[0, :] = False
        out[lip] = (rd[5][0], rd[5][1], rd[5][2], 255)
        below = (~inside) & np.roll(edge, 1, 0) & np.roll(inside, 2, 0)
        below[:2, :] = False
        out[below & (out[..., 3] == 0)] = (rd[5][0], rd[5][1], rd[5][2], 255)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def dust_sheet(seed=21):
    """재·먼지 번짐 16변형: 칩셋 모래흙 결의 재 + 가로 바람 물결, 가장자리 3~5px 는 체커 디더로 옅게(땅이 비친다)."""
    rgb0, t0 = recolor_tile(chip_tex(64, 224), 'dust', 2.6, 4.8)
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    bay = np.tile(BAY, (4, 4))
    du = P('dust')
    for n in range(16):
        m = edge_depth(n, inset=0.5, jag=2.4, rad=6.0, seed=seed)
        lvl = np.clip((m + 1.0) / 4.5, 0, 1)
        on = lvl > bay * 0.95 + 0.03
        rgb = rgb0.copy()
        rip = (((Y + np.round(1.6 * np.sin(X / 2.5 + 0.7))).astype(int)) % 6 == 0) & (m > 2)
        rgb[rip] = du[2]
        lit = (((Y + np.round(1.6 * np.sin(X / 2.5 + 0.7))).astype(int)) % 6 == 5) & (m > 2)
        rgb[lit] = du[5]
        out = np.dstack([rgb, np.where(on, 255, 0)]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def trail_sheet(seed=7):
    """밟아 다진 흙길 16변형: 칩셋 모래흙(64,224) 결을 밝은 다져진 붉은 흙 톤으로, 가장자리 1~2px 눌린 띠 + 잔돌 알."""
    rgb0, t0 = recolor_tile(chip_tex(64, 224), 'rdirt', 3.4, 5.6)
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m = edge_depth(n, inset=2.2, jag=1.8, rad=5.0, seed=seed)
        T = t0.copy()
        foot = (hash2(X // 2, Y // 3, seed + 2) > 0.9) & (m > 3)
        T = np.where(foot, T - 1, T)
        T = np.where((m >= 0) & (m < 1.0), 2, np.where((m >= 1.0) & (m < 2.2), np.minimum(T, 3), T))
        rgb = P('rdirt')[np.clip(T, 0, 6)]
        peb = (m >= -1.5) & (m < 1.2) & (hash2(X, Y, seed + 5) > 0.72)
        pc = np.where((hash2(X, Y, seed + 6) > 0.5)[..., None], P('rrock')[5], P('dust')[5])
        rgb = np.where(peb[..., None], pc, rgb)
        alpha = (m >= 0) | peb
        out = np.dstack([rgb, np.where(alpha, 255, 0)]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ---------------------------------------------------------------- 바닥 표본(3x3 = 48x48, 이음새 없음)
def _tile48(name):
    rgb, t = ground_tex(name)
    return np.tile(rgb, (3, 3, 1)), np.tile(t, (3, 3))


def ground_redearth(seed=3):
    """갈라진 붉은 흙(3x3): 칩셋 점박이 흙 결 + 주기 48 로 감긴 갈라진 틈(덩이로, 틈 밑 밝은 턱)."""
    a, _ = _tile48('earth'); a = a.copy()
    Y, X = np.mgrid[0:48, 0:48]
    keep = tnoise(48, 48, 16, seed + 1) > 0.42
    cr, lip = crack_lines(X, Y, seed + 2, per=48, sc=24, keep=keep, thick=0.06)
    a[cr] = P('rdirt')[1]; a[lip & ~cr] = P('rdirt')[5]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_drymud(seed=5):
    """마른 호수 바닥(3x3): 칩셋 모래흙 결의 창백한 진흙이 큰 다각형 판으로 갈라졌다(판마다 톤, 말린 위 모 밝게), 소금 점."""
    _, t = _tile48('mud')
    Y, X = np.mgrid[0:48, 0:48]
    tt, gap = mud_plates(X, Y, seed, per=48, sc=24, t_tex=t)
    a = P('mud')[tt]
    salt = ~gap & (tnoise(48, 48, 8, seed + 2) > 0.66) & (hash2(X, Y, seed + 3) > 0.8)
    a[salt] = P('mud')[6]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_ashdrift(seed=12):
    """재 쌓인 땅(3x3): 칩셋 모래흙 결의 회보랏빛 재 + 가로로 휜 바람 물결(주기 48)."""
    a, _ = _tile48('dust'); a = a.copy()
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    ph = Y + 2.4 * np.sin(2 * np.pi * X / 48.0 * 2 + 0.7) + 1.3 * np.sin(2 * np.pi * X / 48.0 * 3 + 2.0) + 1.5 * tnoise(48, 48, 12, seed)
    on = tnoise(48, 48, 8, seed + 1) > 0.45
    rip = (np.floor(ph) % 8 == 0) & on; lit = (np.floor(ph) % 8 == 7) & on
    a[rip] = P('dust')[2]; a[lit] = P('dust')[5]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def face_chasm():
    """깊은 골 앞면 표본(3칸 폭: 윗턱 1줄 + 앞면 3줄 + 골 속 1줄 = 48x80): 붉은 사암 갈빗대 결 + 겉흙·재 층 → 아래는 어둠."""
    lev = [[1] * 5, [0] * 5, [0] * 5, [0] * 5, [0] * 5]
    void = [(x, 4) for x in range(5)]
    im, _ = chasm_render(lev, seed=5, void=void)
    return im.crop((16, 0, 64, 80))
