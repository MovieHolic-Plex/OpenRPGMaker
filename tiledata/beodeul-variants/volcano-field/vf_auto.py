# 화산 지대 오토타일 16변형(칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0, 가로 4칸씩) + 바닥·절벽 표본.
#  autotile-lava    : 용암 ↔ 재 가장자리(현무암 덩이 물가, 밝은 띠·껍질 균열·거품) — 마왕성 용암과 같은 규칙(vf_lava), 주기 16.
#  autotile-heat    : 열기 번짐(용암·분기공 곁 땅 위에 덧그리는 투명 붉은 디더 + 불티). 가장자리는 들쭉날쭉 옅어진다.
#  autotile-ashpath : 밟아 다진 고운 재 오솔길(칩셋 모래흙 결 → 밝은 재), 가장자리에 부석·자갈 테.
import numpy as np
from PIL import Image
from vf_base import P, RGB, hash2, tnoise, recolor_tile, chip_tex, sheet_from_cells, LAV, ground_tex, cliff_render, flow_layer
import vf_lava as VL

N_, E_, S_, W_ = 1, 2, 4, 8
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def tnoise1(N, sc, seed):
    gw = max(1, N // sc); g = np.random.default_rng(seed).random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f


def edge_depth(n, inset=2.4, jag=1.7, rad=5.0, seed=1, size=16):
    """변형 n 의 가장자리 깊이장: 이웃 없는 쪽은 inset±jag 안쪽에서 시작(주기 잡음 → 옆 칸과 이어진다). m<0 투명, m>=0 칸 안."""
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


def lava_sheet(): return VL.lava_sheet(seed=61)


def heat_sheet(seed=5):
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    bay = np.tile(BAY, (4, 4))
    for n in range(16):
        m = edge_depth(n, inset=1.0, jag=2.2, rad=6.0, seed=seed)
        lvl = np.clip((m + 1.0) / 6.0, 0, 1) * 0.62
        on = (lvl > bay * 0.7 + 0.04)
        out = np.zeros((16, 16, 4), np.uint8)
        out[on] = (220, 84, 28, 52)
        sp = (m > 1.0) & (hash2(X, Y, seed + 11 + 0) < 0.035)
        out[sp] = LAV[4] + (220,)
        sp2 = np.roll(sp, -1, 0) & ~sp
        out[sp2] = LAV[3] + (150,)
        cr = (m > 3.0) & (hash2(X // 3, Y, seed + 3) > 0.94) & (hash2(X, Y, seed + 4) > 0.3)
        out[cr] = LAV[2] + (200,)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


def path_sheet(seed=7):
    """밟아 다진 고운 재 길: 칩셋 모래흙(64,224) 결을 밝은 재 톤으로, 가장자리 1~2px 눌린 띠 + 부석·자갈 알."""
    rgb0, t0 = recolor_tile(chip_tex(64, 224), 'vash', 3.2, 5.4)
    cells = []
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    for n in range(16):
        m = edge_depth(n, inset=2.2, jag=1.8, rad=5.0, seed=seed)
        T = t0.copy()
        foot = (hash2(X // 2, Y // 3, seed + 2) > 0.9) & (m > 3)                    # 발자국 눌림
        T = np.where(foot, T - 1, T)
        T = np.where((m >= 0) & (m < 1.0), 2, np.where((m >= 1.0) & (m < 2.2), np.minimum(T, 3), T))
        rgb = P('vash')[np.clip(T, 0, 6)]
        peb = (m >= -1.5) & (m < 1.2) & (hash2(X, Y, seed + 5) > 0.70)              # 가장자리 부석·자갈
        pc = np.where((hash2(X, Y, seed + 6) > 0.5)[..., None], P('vash')[6], P('cinder')[4])
        rgb = np.where(peb[..., None], pc, rgb)
        alpha = (m >= 0) | peb
        out = np.dstack([rgb, np.where(alpha, 255, 0)]).astype(np.uint8)
        cells.append(Image.fromarray(out, 'RGBA'))
    return sheet_from_cells(cells)


# ---------------------------------------------------------------- 바닥 표본(3x3 = 48x48, 이음새 없음)
def _tile48(name):
    rgb, t = ground_tex(name)
    return np.tile(rgb, (3, 3, 1))


def ground_sample(name, seed=1):
    a = _tile48(name).copy()
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    if name in ('ash', 'scorch'):
        peb = (hash2(X // 2, Y // 2, seed + 3) > 0.985)
        a = np.where(peb[..., None], P('basalt')[5], a)
        a = np.where((np.roll(peb, -1, 0) & ~peb)[..., None], P('basalt')[1], a)
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_basaltflag(seed=3):
    """신전 앞뜰 현무암 판석(3x3): 버들항 성 마름돌 결(16x12 엇갈림, 주기 48)을 현무암 램프로, 틈에 재."""
    from vf_struct import bas
    im = Image.new('RGBA', (48, 48)); px = im.load()
    for y in range(48):
        for x in range(48):
            c = bas(x, y, 16, 12, seed, -0.4)
            px[x, y] = c + (255,)
    for y in range(48):
        for x in range(48):
            r, g, b, a = px[x, y]
            if (y % 12 == 11 or (x + (y // 12 % 2) * 8) % 16 == 15) and hash2(x, y, seed + 9) > 0.55: px[x, y] = RGB('vash', 4) + (255,)
    return im


def face_basalt():
    """절벽 앞면 표본(3칸 폭: 윗턱 1줄 + 앞면 3줄 = 48x64): 현무암 갈빗대 결 + 응회암 지층 띠."""
    lev = [[1] * 5, [0] * 5, [0] * 5, [0] * 5, [0] * 5]
    im, _ = cliff_render(lev, seed=5)
    return im.crop((16, 0, 64, 64))


def ground_fineash(seed=12):
    """고운 재 둔덕 바닥(3x3): 칩셋 모래흙 결의 밝은 재 + 바람 물결(가로로 휜 가는 골, 주기 48)."""
    a = _tile48('fine').copy()
    X, Y = np.meshgrid(np.arange(48), np.arange(48))
    ph = Y + 2.6 * np.sin(2 * np.pi * X / 48.0 * 2 + 0.7) + 1.4 * np.sin(2 * np.pi * X / 48.0 * 3 + 2.0) + 1.5 * tnoise(48, 48, 12, seed)
    on = tnoise(48, 48, 8, seed + 1) > 0.45
    rip = (np.floor(ph) % 8 == 0) & on; lit = (np.floor(ph) % 8 == 7) & on
    a[rip] = P('vash')[2]; a[lit] = P('vash')[5]
    return Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')


def ground_lavafield(seed=106):
    """식은 용암 벌판(3x3, 걷기): 모난 현무암 덩이, 덩이 틈 일부가 아직 붉다. 주기 48(이음새 없음)."""
    m = np.ones((48, 48), bool)
    return flow_layer(m, seed=seed, glow_px=np.full((48, 48), 0.15), per=48)
