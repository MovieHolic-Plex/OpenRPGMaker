"""pp15_nm6 — 묶음 m6(OPRN 자체 Monster6) 파티원 15칸 전투 시트 공용 빌더.

원칙: 전투 도트는 **걷기 칩과 같은 몸, 같은 배율(칩 x 1)** 이다. 칩 생성기 scripts/asset-gen/oprn-charset/monster6.py 의
캐릭터 함수(설계 좌표 + 캐릭터별 배율 k)를 그대로 불러 왼쪽 보기로 그리므로 대기 칸 idle_a 는 칩의 왼쪽 서 있는 칸과 픽셀이 같다.
칸마다 자세 값(팔 각도 aN·aF, 입·눈·날개·꼬리·웅크림)을 바꾸고, 몸 전체는 행 밀기(lean)·평행 이동(dx·dy)·눕히기(rot)만 한다.
효과는 캐릭터 팔레트(≤16색) 안의 색으로 back(몸 뒤) · front(몸 앞, 외곽선 포함) · over(외곽선 뒤, 빛·점) 세 층에 찍는다.
칸 3열 x 5행: 행0 idle_a·b·c / 행1 windup·move·attack / 행2 recover·hit·dead / 행3 cast_charge·raise·release / 행4 leap·buff·finisher.
발밑 = cell-4 행(공중형은 칩과 같이 떠 있고 dead 만 바닥), 가로 중심 = cell/2. 산출 public/assets/generated/party-pixel/monster6-<i>.png.
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts/asset-gen/oprn-charset'))
import monster6 as M  # noqa: E402

NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/nm6'
CHIPSHEET = ROOT / 'public/assets/generated/charsets/Monster6.png'
EXTRA = {'lean', 'dx', 'dy', 'rot', 'back', 'front', 'over'}
BG = (32, 40, 64)


def F(**kw):
    """자세 한 칸: 캐릭터 함수가 읽는 값은 P 로, 연출 값(lean·dx·dy·rot·back·front·over)은 ex 로."""
    P = M.D0()
    ex = {}
    for k, v in kw.items():
        (ex if k in EXTRA else P)[k] = v
    return P, ex


def geom(idx, cell):
    name, fn, pal = M.CHARS[idx]
    k, cax, cay = M.fit(fn, pal)
    return fn, pal, k, cell // 2 + (cax - 12), (cell - 4) - (29 - cay)


def render(idx, cell, P, ex):
    fn, pal, k, ax, ay = geom(idx, cell)
    dry = M.Cv(cell, cell, ax, ay, pal, k)
    fn(dry, 'left', dict(P))
    lean = ex.get('lean', 0)
    m = {key: (x + lean * (-y) / 28.0, y) for key, (x, y) in dry.m.items()}
    cv = M.Cv(cell, cell, ax, ay, pal, k)
    if 'back' in ex:
        ex['back'](cv, dict(dry.m))          # 행 밀기 전에 찍으므로 밀기 전 좌표
    fn(cv, 'left', dict(P))
    cv.shear(lean)
    if 'front' in ex:
        ex['front'](cv, m)
    cv.outline()
    if ex.get('rot'):
        lay(cv, ex['rot'], cell)
    if 'over' in ex:
        ex['over'](cv, m)
    if ex.get('dx') or ex.get('dy'):
        cv.move(ex.get('dx', 0), ex.get('dy', 0))
    cv.a[0, :] = 0; cv.a[-1, :] = 0; cv.a[:, 0] = 0; cv.a[:, -1] = 0
    return cv


def lay(cv, mode, cell):
    """dead: 'rot' = 뒤로 쓰러짐(시계 방향 90도, 머리가 오른쪽), 'flip' = 네발짐승이 배를 드러내고 뒤집힘."""
    a = cv.a
    ys, xs = np.nonzero(a)
    crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    r = np.rot90(crop, -1) if mode is True or mode == 'rot' else crop[::-1]
    b = np.zeros_like(a)
    h, w = r.shape
    y1 = cell - 4
    x0 = cell // 2 - w // 2 + 1
    b[y1 - h + 1:y1 + 1, x0:x0 + w] = r
    cv.a = b


# ───────────────────────── 효과 도형(설계 좌표) ─────────────────────────
def ball(cv, x, y, r, ramp, ol=True):
    return cv.put(cv.D(x, y, r), ramp, ol)


def disc(cv, x, y, r, col):
    cv.a[cv.D(x, y, r)] = cv.c(col)


def ring(cv, x, y, r, col, th=1.2):
    m = cv.D(x, y, r) & ~cv.D(x, y, max(0.0, r - th / cv.k))
    cv.a[m] = cv.c(col)


def arc(cv, x, y, r, a0, a1, col, th=1.2):
    """각도: 0 오른쪽 · 90 아래 · 180 왼쪽 · 270 위."""
    ang = np.degrees(np.arctan2(cv.yy - y, cv.xx - x)) % 360
    lo, hi = a0 % 360, a1 % 360
    sel = ((ang >= lo) & (ang <= hi)) if lo <= hi else ((ang >= lo) | (ang <= hi))
    m = cv.D(x, y, r) & ~cv.D(x, y, max(0.0, r - th / cv.k)) & sel
    cv.a[m] = cv.c(col)


def spark(cv, x, y, n, col, core=None):
    """픽셀 십자 별(팔 n px)."""
    X, Y = int(round(cv.ax + x * cv.k)), int(round(cv.ay + y * cv.k))
    c = cv.c(col)
    for d in range(-n, n + 1):
        for (u, v) in ((X + d, Y), (X, Y + d)):
            if 0 <= u < cv.w and 0 <= v < cv.h:
                cv.a[v, u] = c
    if core is not None and 0 <= X < cv.w and 0 <= Y < cv.h:
        cv.a[Y, X] = cv.c(core)


def xspark(cv, x, y, n, col):
    X, Y = int(round(cv.ax + x * cv.k)), int(round(cv.ay + y * cv.k))
    c = cv.c(col)
    for d in range(-n, n + 1):
        for (u, v) in ((X + d, Y + d), (X + d, Y - d)):
            if 0 <= u < cv.w and 0 <= v < cv.h:
                cv.a[v, u] = c


def dots(cv, x0, y0, x1, y1, n, col, seed=1):
    rng = np.random.default_rng(seed)
    cv.px([(rng.uniform(x0, x1), rng.uniform(y0, y1)) for _ in range(n)], col)


def line(cv, p0, p1, col):
    M.line(cv, p0, p1, col)


def speed(cv, x, y, lens, col, gap=2.5):
    """물체 뒤(오른쪽)로 끌리는 속도선."""
    n = len(lens)
    for i, L in enumerate(lens):
        yy = y + (i - (n - 1) / 2) * gap
        line(cv, (x, yy), (x + L, yy), col)


def cone(cv, x0, y0, L, spread, ramp, ol=True):
    """입·눈에서 왼쪽으로 퍼지는 부채꼴(브레스·시선)."""
    pts = [(x0, y0 - 1), (x0 - L * 0.5, y0 - spread * 0.7), (x0 - L, y0 - spread), (x0 - L - 2, y0 - spread * 0.3),
           (x0 - L - 2, y0 + spread * 0.3), (x0 - L, y0 + spread), (x0 - L * 0.5, y0 + spread * 0.7), (x0, y0 + 1)]
    return cv.put(cv.P(pts), ramp, ol)


def beam(cv, x0, y0, x1, y1, w, ramp, ol=True):
    return cv.put(cv.T([(x0, y0), (x1, y1)], w), ramp, ol)


def puff(cv, x, y, r, ramp, ol=True):
    return cv.put(cv.D(x, y, r) | cv.D(x + r * 0.9, y + r * 0.3, r * 0.7) | cv.D(x - r * 0.8, y + r * 0.4, r * 0.6), ramp, ol)


def rays(cv, x, y, r0, r1, n, col, phase=0.0):
    for i in range(n):
        a = 2 * math.pi * i / n + phase
        line(cv, (x + math.cos(a) * r0, y + math.sin(a) * r0), (x + math.cos(a) * r1, y + math.sin(a) * r1), col)


def shard(cv, x, y, s, ang, ramp, ol=True):
    """ang(도) 쪽으로 뾰족한 조각."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    pts = [(x + ux * s, y + uy * s), (x + nx * s * 0.45, y + ny * s * 0.45), (x - ux * s * 0.6, y - uy * s * 0.6), (x - nx * s * 0.45, y - ny * s * 0.45)]
    return cv.put(cv.P(pts), ramp, ol)


def zigzag(cv, x0, y0, x1, y1, n, amp, col, seed=3):
    rng = np.random.default_rng(seed)
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        pts.append((x0 + (x1 - x0) * t + rng.uniform(-amp, amp) * 0.4, y0 + (y1 - y0) * t + (amp if i % 2 else -amp)))
    pts.append((x1, y1))
    for p, q in zip(pts, pts[1:]):
        line(cv, p, q, col)


def both(*fs):
    def f(cv, m):
        for g in fs:
            g(cv, m)
    return f


# ───────────────────────── 조립 · 검사 · 확인판 ─────────────────────────
def chip_left(idx):
    a = np.array(Image.open(CHIPSHEET).convert('RGBA'))
    bx, by = idx % 4 * 72, idx // 4 * 128
    return a[by + 96: by + 128, bx + 24: bx + 48]


def _crop(a):
    ys, xs = np.nonzero(a[:, :, 3])
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def build(idx, cell, frames):
    assert len(frames) == 15
    chip = f'monster6-{idx}'
    cells = [render(idx, cell, P, ex).rgba() for P, ex in frames]
    sheet = Image.new('RGBA', (cell * 3, cell * 5), (0, 0, 0, 0))
    for i, im in enumerate(cells):
        sheet.alpha_composite(im, (i % 3 * cell, i // 3 * cell))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{chip}.png')
    bad = check(sheet, cell)
    same = np.array_equal(_crop(np.array(cells[0])), _crop(chip_left(idx)))
    if not same:
        bad.append('idle_a != chip left standing cell')
    board(idx, cell, sheet)
    print(chip, 'cell', cell, 'OK' if not bad else bad)
    return not bad


def check(sheet, cell):
    a = np.array(sheet)
    bad = []
    if a.shape[:2] != (cell * 5, cell * 3):
        bad.append(f'size {a.shape}')
    if not set(np.unique(a[:, :, 3])) <= {0, 255}:
        bad.append('alpha')
    cols = {tuple(c) for c in a[a[:, :, 3] > 0][:, :3]}
    if len(cols) > 16:
        bad.append(f'colors {len(cols)}')
    cs = [a[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell] for r in range(5) for c in range(3)]
    for i, c in enumerate(cs):
        if not c[:, :, 3].any():
            bad.append(f'{NAMES[i]} empty')
    for i in range(15):
        for j in range(i + 1, 15):
            if np.array_equal(cs[i], cs[j]):
                bad.append(f'{NAMES[i]}=={NAMES[j]}')
    return bad


def board(idx, cell, sheet, z=4):
    """확인판: 왼쪽 = 걷기 칩 왼쪽 서 있는 칸(4배), 오른쪽 = 15칸(4배)."""
    chip = Image.fromarray(chip_left(idx), 'RGBA').resize((24 * z, 32 * z), Image.NEAREST)
    big = sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST)
    W = 24 * z + 16 + big.width
    H = max(big.height, 32 * z)
    im = Image.new('RGBA', (W, H), BG + (255,))
    im.alpha_composite(chip, (0, 0))
    grid = Image.new('RGBA', big.size, (44, 54, 84, 255))
    for r in range(5):
        for c in range(3):
            if (r + c) % 2:
                grid.paste((38, 47, 74, 255), (c * cell * z, r * cell * z, (c + 1) * cell * z, (r + 1) * cell * z))
    grid.alpha_composite(big)
    im.alpha_composite(grid, (24 * z + 16, 0))
    QA.mkdir(parents=True, exist_ok=True)
    im.save(QA / f'pp-monster6-{idx}.png')

