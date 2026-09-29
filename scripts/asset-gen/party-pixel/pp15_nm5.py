"""pp15_nm5 — retro2003 파티원 15칸 시트 공용 빌더 (묶음 m5, OPRN 자체 칩 Monster5).

원칙: 걷기 칩을 그린 **같은 함수**(scripts/asset-gen/oprn-charset/monster5.py)를 칩 1배로 48 칸에 다시 부른다.
  - 대기 칸 idle_a = 칩의 왼쪽 보기 서 있는 칸(행 3·열 1)과 픽셀까지 같다(발밑 원점만 (24, 44) 로 옮김).
  - 나머지 칸은 캐릭터 함수의 포즈 인자(뚜껑 각도·검 각도·손 위치·불꽃 높이…)를 바꿔 다시 그린 뒤
    몸 이동(dx·dy), 행 밀기 기울임(lean), 90° 회전(dead)만 한다 — 색이 새로 생기지 않는다.
  - 효과(물기·실·도깨비불·룬·까마귀·나사·불꽃)는 캐릭터 팔레트 색으로 몸 뒤(back)·앞(front)에 찍는다.
셀 48, 3열×5행(NAMES 순서), 왼쪽(적 쪽)을 본다. 바닥 y=44, 떠다니는 몸(초롱·마도서)은 dead 만 바닥.
산출: public/assets/generated/party-pixel/monster5-<i>.png, 확인판 .omo/nm5/board-<chip>.png.
"""
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/nm5'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
CELL = 48
GROUND = CELL - 4

_spec = importlib.util.spec_from_file_location('monster5', ROOT / 'scripts/asset-gen/oprn-charset/monster5.py')
M5 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M5)
Cv = M5.Cv


# ───────────────────────── 효과 붓 (셀 절대 좌표) ─────────────────────────
def spark(c, x, y, k, big=False):
    c.at(0, 0)
    c.px(x, y, k)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.px(x + dx, y + dy, k)
    if big:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            c.px(x + dx, y + dy, k)


def dot(c, x, y, k):
    c.at(0, 0)
    c.px(x, y, k)


def star(c, x, y, r, k, k2=None):
    c.at(0, 0)
    for i in range(8):
        a = i * math.pi / 4
        rr = r if i % 2 == 0 else r * .55
        c.line([(x, y), (x + math.cos(a) * rr, y + math.sin(a) * rr)], k)
    if k2:
        c.px(x, y, k2)


def arc(c, cx, cy, r, a0, a1, k, w=1, k2=None):
    """중심 (cx, cy), 반지름 r, 각도 a0→a1(도, 0 = 오른쪽, 90 = 아래)."""
    c.at(0, 0)
    n = max(4, int(abs(a1 - a0) / 8))
    pts = [(cx + math.cos(math.radians(a0 + (a1 - a0) * t / n)) * r, cy + math.sin(math.radians(a0 + (a1 - a0) * t / n)) * r) for t in range(n + 1)]
    c.line(pts, k, w)
    if k2:
        c.line(pts[n // 3: n * 2 // 3 + 1], k2, 1)


def ring(c, cx, cy, rx, ry, k, gap=0):
    c.at(0, 0)
    n = 40
    for t in range(n):
        if gap and t % gap == 0:
            continue
        a = t / n * 2 * math.pi
        c.px(cx + math.cos(a) * rx, cy + math.sin(a) * ry, k)


def rays(c, cx, cy, r0, r1, n, k, phase=0.0):
    c.at(0, 0)
    for t in range(n):
        a = phase + t / n * 2 * math.pi
        c.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)], k)


def speed(c, x, y, k, n=3, ln=6):
    c.at(0, 0)
    for j in range(n):
        yy = y + j * 4
        xx = x + (j % 2) * 2
        c.line([(xx, yy), (xx + ln - (j % 2) * 2, yy)], k)


def puff(c, x, y, r, ramp):
    c.at(0, 0)
    c.ell(x, y, r, r * .8, ramp, out=None)
    c.ell(x + r * .9, y + r * .2, r * .7, r * .6, ramp, out=None)


def crow(c, x, y, flap, k='o', eye=None):
    """왼쪽으로 나는 작은 까마귀. flap 0 날개 위 · 1 수평 · 2 아래."""
    c.at(0, 0)
    c.ell(x, y, 2.2, 1.3, k, out=None, shade=False)
    c.px(x - 3, y - 1, k)
    c.px(x - 2, y - 1, k)
    c.px(x + 3, y, k)
    wy = (-3, 0, 2)[flap]
    c.line([(x - 1, y), (x + 1, y + wy)], k)
    c.line([(x, y), (x + 3, y + wy - (1 if wy <= 0 else -1))], k)
    if eye:
        c.px(x - 2, y - 1, eye)


def fireball(c, x, y, r, ramp, tail=6):
    """왼쪽으로 날아가는 불덩이(꼬리는 오른쪽)."""
    d, m, l = ramp
    c.at(0, 0)
    c.poly([(x, y - r), (x + tail, y - r * .3), (x + tail + 2, y), (x + tail, y + r * .3), (x, y + r)], d, out=None, shade=False)
    c.ell(x, y, r, r, d, out=None, shade=False)
    c.ell(x - .3, y, r * .65, r * .65, m, out=None, shade=False)
    c.ell(x - .6, y - .3, r * .3, r * .3, l, out=None, shade=False)


# ───────────────────────── 조립 ─────────────────────────
def render(i, pose, hover):
    fn, pal = M5.CHARS[i]
    P = dict(ph=1, step=0)
    P.update(pose.get('P', {}))
    dx, dy = pose.get('dx', 0), pose.get('dy', 0)
    o = (24 + dx, GROUND - hover + dy)
    body = Cv(CELL, CELL, pal)
    body.at(*o)
    fn(body, 'side', P)
    A = body.a
    lean = pose.get('lean', 0)
    if lean:
        B = np.full_like(A, -1)
        for y in range(CELL):
            s = int(round(lean * (GROUND - y) / 22.0))
            if s > 0:
                B[y, s:] = A[y, :-s]
            elif s < 0:
                B[y, :s] = A[y, -s:]
            else:
                B[y] = A[y]
        A = B
    if pose.get('rot'):
        ys, xs = np.nonzero(A >= 0)
        crop = A[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        crop = np.rot90(crop, pose['rot'])
        A = np.full_like(A, -1)
        h, w = crop.shape
        y0 = GROUND - h + 1 + pose.get('rot_dy', 0)
        x0 = 24 + dx - w // 2
        A[y0:y0 + h, x0:x0 + w] = crop
    if pose.get('floor'):
        ys = np.nonzero((A >= 0).any(1))[0]
        A = np.roll(A, GROUND - ys.max(), axis=0)
    cv = Cv(CELL, CELL, pal)
    if pose.get('back'):
        pose['back'](cv, o)
    cv.a = np.where(A >= 0, A, cv.a)
    if pose.get('front'):
        pose['front'](cv, o)
    return cv.rgba()


def build(i, poses, hover=0, chip=None):
    chip = chip or f'monster5-{i}'
    sheet = np.zeros((CELL * 5, CELL * 3, 4), np.uint8)
    frames = {}
    for k, n in enumerate(NAMES):
        fr = render(i, poses.get(n, {}), hover)
        frames[n] = fr
        r, cl = divmod(k, 3)
        sheet[r * CELL:(r + 1) * CELL, cl * CELL:(cl + 1) * CELL] = fr
    errs = validate(sheet, poses, hover)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet).save(OUT / f'{chip}.png')
    board(i, sheet, chip)
    print(chip, sheet.shape[1], 'x', sheet.shape[0], 'errors:', errs or 'none')
    return sheet, errs


def validate(sheet, poses, hover):
    errs = []
    if sheet.shape != (CELL * 5, CELL * 3, 4):
        errs.append('size')
    if not np.isin(sheet[:, :, 3], (0, 255)).all():
        errs.append('alpha')
    cols = {tuple(v) for v in sheet[sheet[:, :, 3] == 255][:, :3]}
    if len(cols) > 16:
        errs.append(f'colors {len(cols)}')
    seen = set()
    for k, n in enumerate(NAMES):
        r, cl = divmod(k, 3)
        cell = sheet[r * CELL:(r + 1) * CELL, cl * CELL:(cl + 1) * CELL]
        a = cell[:, :, 3] > 0
        if not a.any():
            errs.append(f'{n} empty')
            continue
        if a[0].any() or a[-1].any() or a[:, 0].any() or a[:, -1].any():
            errs.append(f'{n} touches edge')
        b = cell.tobytes()
        if b in seen:
            errs.append(f'{n} duplicate')
        seen.add(b)
        bottom = np.nonzero(a.any(1))[0].max()
        p = poses.get(n, {})
        grounded = n == 'dead' or (hover == 0 and p.get('dy', 0) >= 0 and n != 'leap')
        if grounded and bottom != GROUND:
            errs.append(f'{n} bottom {bottom}')
        if bottom > GROUND:
            errs.append(f'{n} below ground {bottom}')
    return errs


def chip_stand(i):
    fr, _ = M5.chip_frame(i, 3, 1)
    return fr


def board(i, sheet, chip, s=4):
    """칩 왼쪽 서 있는 칸 4배 | 15칸 4배 (+칸 이름)."""
    from PIL import ImageDraw
    chipim = Image.fromarray(chip_stand(i)).resize((24 * s, 32 * s), Image.NEAREST)
    W = 24 * s + 16 + CELL * 3 * s
    H = CELL * 5 * s
    bg = Image.new('RGBA', (W, H), (32, 40, 64, 255))
    bg.alpha_composite(chipim, (0, 0))
    sh = Image.fromarray(sheet).resize((CELL * 3 * s, CELL * 5 * s), Image.NEAREST)
    x0 = 24 * s + 16
    d = ImageDraw.Draw(bg)
    for k in range(15):
        r, cl = divmod(k, 3)
        d.rectangle([x0 + cl * CELL * s, r * CELL * s, x0 + (cl + 1) * CELL * s - 1, (r + 1) * CELL * s - 1],
                    fill=(40, 52, 80, 255) if (r + cl) % 2 else (32, 40, 64, 255))
        d.line([(x0 + cl * CELL * s, r * CELL * s + GROUND * s + s), (x0 + (cl + 1) * CELL * s - 1, r * CELL * s + GROUND * s + s)], fill=(70, 80, 110, 255))
    bg.alpha_composite(sh, (x0, 0))
    for k, n in enumerate(NAMES):
        r, cl = divmod(k, 3)
        d.text((x0 + cl * CELL * s + 3, r * CELL * s + 2), n, fill=(200, 200, 220, 255))
    QA.mkdir(parents=True, exist_ok=True)
    bg.save(QA / f'board-{chip}.png')

