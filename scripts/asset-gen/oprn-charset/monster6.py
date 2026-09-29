"""OPRN 자체 몬스터 걷기 칩 Monster6 (묶음 m6, 전설의 괴수 8명) 생성기.

RM2K3 CharSet 288x256: 캐릭터 8명(4열x2행, 72x128), 블록 안 3열(걷기 0·1·2, 1 이 서 있는 발) x 4행(0 위·1 오른쪽·2 아래·3 왼쪽), 칸 24x32.
그림은 전부 좌표·수식으로 찍는다(외부 그림·리샘플 없음). 캐릭터마다 draw(cv, view, P) 함수 하나:
  view  'left'(옆, 왼쪽을 본다) · 'down'(앞) · 'up'(뒤). 오른쪽은 left 를 좌우 반전.
  P     자세 값(걷기 step -1/0/1, 전투 칸은 팔 각도 aN·aF·기울기 lean·입 mouth·눈 eye·날개 wing·웅크림 crouch 등).
전투 15칸 시트(scripts/asset-gen/party-pixel/pp15_nm6.py)가 같은 함수로 같은 몸을 그린다.
좌표: 발바닥 = (0, 0), 위가 음수 y, 앞(왼쪽)이 음수 x.

    python3 scripts/asset-gen/oprn-charset/monster6.py
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/charsets/Monster6.png'


# ───────────────────────── 캔버스 ─────────────────────────
class Cv:
    def __init__(s, w, h, ax, ay, pal, k=1.0):
        s.w, s.h, s.ax, s.ay, s.k = w, h, ax, ay, k
        s.names = list(pal.keys())
        s.rgb = [None] + [tuple(pal[k]) for k in s.names]
        s.ix = {k: i + 1 for i, k in enumerate(s.names)}
        s.a = np.zeros((h, w), np.int16)
        s.m = {}                     # 기준점(손·눈·입) 설계 좌표 — 전투 시트 효과가 붙는다
        s.ol = s.ix['ol']
        yy, xx = np.mgrid[0:h, 0:w]
        s.xx, s.yy = (xx - ax + 0.5) / k - 0.5, (yy - ay + 0.5) / k - 0.5     # 설계 좌표(k 배로 찍는다)

    def c(s, n):
        return n if isinstance(n, (int, np.integer)) else s.ix[n]

    # 모양(불리언 마스크)
    def E(s, cx, cy, rx, ry):
        return ((s.xx - cx) / (rx + 0.5)) ** 2 + ((s.yy - cy) / (ry + 0.5)) ** 2 <= 1.0

    def R(s, x0, y0, x1, y1):
        x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1))
        return (s.xx >= x0) & (s.xx <= x1) & (s.yy >= y0) & (s.yy <= y1)

    def P(s, pts):
        im = Image.new('L', (s.w, s.h), 0)
        ImageDraw.Draw(im).polygon([(s.ax + x * s.k, s.ay + y * s.k) for x, y in pts], fill=255)
        return np.array(im) > 0

    def D(s, x, y, r):
        return (s.xx - x) ** 2 + (s.yy - y) ** 2 <= r * r + 0.35

    def T(s, pts, widths):
        """관(팔·꼬리·연기): 꺾은선을 따라 원을 이어 붙인다. widths 는 점마다 굵기(끝 사이는 선형)."""
        if not isinstance(widths, (list, tuple)):
            widths = [widths] * len(pts)
        m = np.zeros((s.h, s.w), bool)
        for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
            n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 3))
            for k in range(n + 1):
                t = k / n
                m |= s.D(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (w0 + (w1 - w0) * t) / 2)
        return m

    # 칠하기
    def put(s, m, ramp, ol=True):
        if ol:
            s.a[_dil(m) & ~m] = s.ol
        if isinstance(ramp, (tuple, list)):
            ids = [s.c(r) for r in ramp]
            if len(ids) == 2:
                ids = [ids[0], ids[0], ids[1]]
            l, mid, d = ids
            up, dn, lf, rt = _nb(m)
            dark = m & (~dn | ~rt)
            light = m & ~dark & (~up | ~lf)
            s.a[m] = mid
            s.a[light] = l
            s.a[dark] = d
        else:
            s.a[m] = s.c(ramp)
        return m

    def px(s, pts, col):
        col = s.c(col)
        for x, y in pts:
            X, Y = int(round(s.ax + x * s.k)), int(round(s.ay + y * s.k))
            if 0 <= X < s.w and 0 <= Y < s.h:
                s.a[Y, X] = col

    def shear(s, lean, height=28):
        """윗부분을 lean px 만큼 가로로 민다(+ 는 뒤=오른쪽)."""
        if not lean:
            return
        b = s.a.copy()
        for row in range(s.h):
            k = int(round(lean * (s.ay - row) / height))
            if k:
                b[row] = np.roll(s.a[row], k)
                if k > 0:
                    b[row, :k] = 0
                else:
                    b[row, k:] = 0
        s.a = b

    def move(s, dx, dy):
        b = np.zeros_like(s.a)
        H, W = s.a.shape
        ys, xs = np.nonzero(s.a)
        ny, nx = ys + dy, xs + dx
        ok = (ny >= 0) & (ny < H) & (nx >= 0) & (nx < W)
        b[ny[ok], nx[ok]] = s.a[ys[ok], xs[ok]]
        s.a = b

    def outline(s):
        m = s.a > 0
        s.a[_dil(m) & ~m] = s.ol

    def rgba(s, flip=False):
        out = np.zeros((s.h, s.w, 4), np.uint8)
        for i, c in enumerate(s.rgb):
            if c is None:
                continue
            out[s.a == i] = (*c, 255)
        if flip:
            out = out[:, ::-1]
        return Image.fromarray(out, 'RGBA')


def _nb(m):
    up = np.zeros_like(m); up[1:] = m[:-1]
    dn = np.zeros_like(m); dn[:-1] = m[1:]
    lf = np.zeros_like(m); lf[:, 1:] = m[:, :-1]
    rt = np.zeros_like(m); rt[:, :-1] = m[:, 1:]
    return up, dn, lf, rt


def _dil(m):
    up, dn, lf, rt = _nb(m)
    return m | up | dn | lf | rt


def jag(cv, m, period=3, phase=0, depth=1):
    """털 끝: 마스크 아래 가장자리에 period 마다 1px 술을 단다."""
    out = m.copy()
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        if y + 1 < m.shape[0] and not m[y + 1, x] and (x - cv.ax + phase) % period == 0:   # 기준점 기준 열(칸이 달라도 같은 술)
            for d in range(1, depth + 1):
                if y + d < m.shape[0]:
                    out[y + d, x] = True
    return out


def pol(x, y, ang, ln):
    """각도 ang(도): 0 = 아래, 90 = 앞(왼쪽, -x), 180 = 위."""
    r = math.radians(ang)
    return (x - math.sin(r) * ln, y + math.cos(r) * ln)


def D0(**kw):
    P = dict(step=0, bob=0, aN=None, aF=None, lean=0, mouth=0, eye=0, wing=0, crouch=0, tail=0, head=0, fx=None)
    P.update(kw)
    return P


# ───────────────────────── 0 예티 ─────────────────────────
YETI = dict(ol=(40, 46, 74), furL=(255, 255, 255), fur=(222, 230, 244), furD=(166, 180, 212), furDD=(112, 126, 170),
            skin=(126, 176, 214), skinD=(80, 120, 174), mouth=(196, 58, 82), ice=(150, 222, 255), iceD=(74, 150, 226),
            iceL=(236, 250, 255))


def yeti(cv, view, P):
    s, cr = P['step'], P['crouch']
    by = cr + P['bob']
    FUR, FURB = ('furL', 'fur', 'furD'), ('fur', 'furD', 'furDD')
    if view == 'left':
        aN = P['aN'] if P['aN'] is not None else 10 - 22 * s
        aF = P['aF'] if P['aF'] is not None else 10 + 22 * s
        lift = [0, 0]
        if s < 0: lift = [-1, 0]
        if s > 0: lift = [0, -1]
        # 먼 다리·팔
        cv.put(cv.T([(2, -7 + by), (2 + 2 * s, -1 + lift[1])], 4) | cv.E(1 + 2 * s, -1 + lift[1], 2.5, 1), FURB)
        hx, hy = pol(3, -17 + by, aF, 8)
        cv.m['hF'] = (hx, hy)
        cv.put(cv.T([(3, -17 + by), (hx, hy)], [4, 4]) | cv.D(hx, hy, 2.4), FURB)
        # 몸통 + 머리(한 덩이 털)
        body = cv.E(0, -12 + by, 7, 7) | cv.E(-1, -20 + by + P['head'], 6, 5)
        body = jag(cv, body, 3, 1, 1)
        cv.put(body, FUR)
        cv.px([(x, -21 + by + P['head']) for x in (1, 3)] + [(4, -14 + by), (2, -9 + by), (5, -10 + by)], 'furD')
        hy2 = by + P['head']
        # 얼굴
        cv.put(cv.E(-4, -19 + hy2, 2.5, 3) & cv.R(-7, -23 + hy2, 0, -15 + hy2), ('skin', 'skin', 'skinD'), ol=False)
        cv.px([(-3, -22 + hy2), (-1, -20 + hy2)], 'furL')
        cv.px([(-6, -24 + hy2), (-5, -25 + hy2), (-4, -24 + hy2)], 'furD')           # 이마 털
        if P['eye'] == 1:
            cv.px([(-6, -20 + hy2), (-5, -20 + hy2)], 'ol')
        elif P['eye'] == 2:
            cv.px([(-5, -21 + hy2)], 'iceL'); cv.px([(-6, -21 + hy2)], 'ice')
        else:
            cv.px([(-5, -21 + hy2)], 'ol')
        if P['mouth']:
            cv.put(cv.R(-6, -18 + hy2, -3, -17 + hy2 + P['mouth'] - 1), 'mouth', ol=False)
            cv.px([(-6, -18 + hy2), (-4, -18 + hy2)], 'furL')
        else:
            cv.px([(-6, -17 + hy2), (-5, -17 + hy2)], 'skinD'); cv.px([(-6, -18 + hy2)], 'furL')
        # 가까운 다리
        cv.put(cv.T([(-1, -7 + by), (-1 - 2 * s, -1 + lift[0])], 4) | cv.E(-2 - 2 * s, -1 + lift[0], 2.5, 1), FUR)
        # 가까운 팔
        hx, hy = pol(-1, -16 + by, aN, 8)
        cv.m['hN'] = (hx, hy); cv.m['eye'] = (-5, -21 + hy2); cv.m['mouth'] = (-6, -17 + hy2)
        arm = jag(cv, cv.T([(0, -15 + by), (hx, hy)], [4, 3]), 2, 0, 1)
        cv.put(arm | cv.D(hx, hy, 2), ('fur', 'fur', 'furD'))
        tx, ty = pol(hx, hy, aN, 2.5)
        cv.px([(tx, ty), (tx - 1, ty)], 'furDD')
    else:
        front = view == 'down'
        for sg in (-1, 1):
            lift = -1 if (s == -1 and sg == -1) or (s == 1 and sg == 1) else 0
            cv.put(cv.T([(3 * sg, -7 + by), (3 * sg, -1 + lift)], 4) | cv.E(3 * sg, -1 + lift, 2, 1), FUR)
        body = jag(cv, cv.E(0, -12 + by, 7, 7) | cv.E(0, -20 + by, 6, 5), 3, 0, 1)
        cv.put(body, FUR)
        for sg in (-1, 1):
            sw = s * sg
            ang = 8
            hx, hy = 8 * sg + (sg * 1 if P['aN'] else 0), -9 + by - sw
            if P['aN'] is not None:
                hx, hy = pol(7 * sg, -16 + by, -sg * P['aN'] if sg < 0 else P['aN'], 8)
            arm = jag(cv, cv.T([(6 * sg, -16 + by), (hx, hy)], [5, 4]), 2, 0, 1)
            cv.put(arm | cv.D(hx, hy, 2.4), FUR)
            cv.px([(hx - 1, hy + 2), (hx + 1, hy + 2)], 'furDD')
        if front:
            cv.put(cv.E(0, -19 + by, 3, 3), ('skin', 'skin', 'skinD'), ol=False)
            cv.px([(-1, -24 + by), (0, -25 + by), (1, -24 + by)], 'furD')
            cv.px([(-2, -20 + by), (2, -20 + by)], 'ol')
            if P['mouth']:
                cv.put(cv.R(-2, -18 + by, 2, -17 + by), 'mouth', ol=False)
            else:
                cv.px([(-1, -17 + by), (0, -17 + by), (1, -17 + by)], 'skinD')
            cv.px([(-2, -18 + by), (2, -18 + by)], 'furL')
            cv.px([(-3, -12 + by), (3, -12 + by), (0, -10 + by), (-2, -8 + by), (2, -8 + by)], 'furD')
        else:
            cv.px([(-2, -22 + by), (0, -21 + by), (2, -22 + by), (-3, -15 + by), (0, -13 + by), (3, -15 + by),
                   (-2, -9 + by), (2, -9 + by)], 'furD')


# ───────────────────────── 선 · 삼지창 ─────────────────────────
def line(cv, p0, p1, col):
    (x0, y0), (x1, y1) = p0, p1
    n = max(1, int(max(abs(x1 - x0), abs(y1 - y0)) * 2))
    cv.px([(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n + 1)], col)


def trident(cv, hx, hy, ang, up=11, down=10, col=('gold', 'goldD')):
    """ang: 끝(갈래)이 향하는 각(pol 규약: 180 위, 90 앞)."""
    tx, ty = pol(hx, hy, ang, up)
    cv.m['tip'] = pol(hx, hy, ang, up + 2)
    bx, by_ = pol(hx, hy, ang + 180, down)
    m = np.zeros((cv.h, cv.w), bool)
    line(cv, (bx, by_), (tx, ty), col[1])
    # 갈래: 끝에서 수직으로 가로대, 세 갈래 2px
    r = math.radians(ang)
    dx, dy = -math.sin(r), math.cos(r)          # 진행 방향
    nx, ny = -dy, dx                           # 수직
    line(cv, (tx - nx * 2, ty - ny * 2), (tx + nx * 2, ty + ny * 2), col[0])
    for k in (-2, 0, 2):
        line(cv, (tx + nx * k, ty + ny * k), (tx + nx * k + dx * 2.2, ty + ny * k + dy * 2.2), col[0])
    return m


# ───────────────────────── 1 인어 전사 ─────────────────────────
MERFOLK = dict(ol=(18, 36, 58), skinL=(214, 244, 232), skin=(150, 212, 196), skinD=(84, 152, 150), hairL=(96, 150, 232),
               hair=(44, 88, 176), hairD=(28, 52, 118), scL=(128, 236, 204), sc=(36, 168, 158), scD=(18, 104, 118),
               fin=(252, 146, 150), finD=(196, 76, 108), gold=(252, 222, 110), goldD=(186, 134, 48), wat=(214, 250, 255),
               eyeW=(255, 255, 255))


def merfolk(cv, view, P):
    s, by = P['step'], P['bob'] + P['crouch']
    t = P['tail'] if P['tail'] else s
    SK, SC, HR, FN = ('skinL', 'skin', 'skinD'), ('scL', 'sc', 'scD'), ('hairL', 'hair', 'hairD'), ('fin', 'fin', 'finD')
    if view == 'left':
        aN = P['aN'] if P['aN'] is not None else 50 + 8 * s
        aF = P['aF'] if P['aF'] is not None else 12 - 10 * s
        # 먼 팔
        hx, hy = pol(1, -17 + by, aF, 6)
        cv.put(cv.T([(1, -17 + by), (hx, hy)], [3, 2]), ('skin', 'skinD', 'skinD'))
        # 뒷머리
        cv.put(cv.T([(0, -24 + by), (3, -21 + by), (4 + (s > 0), -15 + by)], [6, 4, 2]), HR)
        # 꼬리: 허리 → 바닥에서 뒤로 말려 지느러미가 선다
        tail = cv.T([(0, -10 + by), (1, -6), (0, -2), (4, -1), (8, -3 + t)], [7, 6, 5, 4, 2])
        cv.put(tail, SC)
        cv.px([(-1, -7), (1, -5), (0, -3), (3, -2), (5, -2)], 'scD')
        cv.put(cv.P([(8, -3 + t), (11, -8 + 2 * t), (10, -3 + t), (11, 0)]), FN)
        # 몸통 + 비늘 띠
        cv.put(cv.E(0, -14 + by, 3, 4), SK)
        cv.put(cv.R(-3, -11 + by, 3, -10 + by), ('scL', 'sc', 'sc'), ol=False)
        cv.px([(-2, -14 + by), (1, -15 + by)], 'skinD')
        # 머리
        hb = by + P['head']
        cv.put(cv.E(-1, -21 + hb, 3, 3.5), SK)
        cv.put(cv.E(0, -24 + hb, 3.5, 1.5) | cv.R(0, -24 + hb, 3, -19 + hb), HR, ol=False)
        cv.put(cv.P([(1, -21 + hb), (4, -24 + hb), (3, -19 + hb)]), FN)
        if P['eye'] == 1:
            cv.px([(-3, -21 + hb), (-2, -21 + hb)], 'ol')
        else:
            cv.px([(-3, -22 + hb)], 'ol'); cv.px([(-3, -21 + hb)], 'eyeW' if P['eye'] == 2 else 'skin')
        if P['mouth']:
            cv.px([(-4, -19 + hb), (-3, -19 + hb)], 'finD')
        else:
            cv.px([(-3, -19 + hb)], 'skinD')
        # 가까운 팔 + 삼지창
        hx, hy = pol(-1, -17 + by, aN, 5)
        cv.m['hN'] = (hx, hy); cv.m['eye'] = (-3, -22 + hb); cv.m['mouth'] = (-4, -19 + hb)
        wa = P.get('weap', 180)
        trident(cv, hx, hy, wa, up=P.get('wup', 11), down=P.get('wdn', 10))
        cv.put(cv.T([(-1, -17 + by), (hx, hy)], [3, 2]) | cv.D(hx, hy, 1.2), SK)
        cv.put(cv.D(-1, -17 + by, 1.3), ('gold', 'gold', 'goldD'))
    else:
        front = view == 'down'
        cv.put(cv.T([(0, -10 + by), (0, -4), (0, -1)], [7, 6, 6]), SC)
        for sg in (-1, 1):
            k = t * sg
            cv.put(cv.P([(3 * sg, -2), (7 * sg, -4 + k), (6 * sg, 0)]), FN)
        cv.px([(-1, -6), (1, -4), (-1, -2), (1, -8)], 'scD')
        if not front:
            cv.put(cv.T([(0, -24 + by), (0, -16 + by)], [7, 4]), HR)
        cv.put(cv.E(0, -14 + by, 3.5, 4), SK)
        cv.put(cv.R(-3, -11 + by, 3, -10 + by), ('scL', 'sc', 'sc'), ol=False)
        cv.put(cv.E(0, -21 + by, 3, 3.5), SK if front else HR)
        cv.put(cv.E(0, -24 + by, 3.5, 1.5), HR, ol=False)
        for sg in (-1, 1):
            cv.put(cv.P([(3 * sg, -21 + by), (6 * sg, -24 + by), (5 * sg, -19 + by)]), FN)
        if front:
            cv.px([(-1, -21 + by), (1, -21 + by)], 'ol'); cv.px([(0, -19 + by)], 'skinD')
        # 삼지창(오른손 = 화면 쪽 +x 는 앞 보기에서 캐릭터 왼손)
        side = 1 if front else -1
        hx, hy = 5 * side, -13 + by - s * side
        trident(cv, hx, hy, 180, up=11, down=9)
        cv.put(cv.T([(3 * side, -17 + by), (hx, hy)], [3, 2]), SK)
        ox, oy = -4 * side, -12 + by + s * side
        cv.put(cv.T([(-3 * side, -17 + by), (ox, oy)], [3, 2]), SK)
        cv.put(cv.D(3 * side, -17 + by, 1.3) | cv.D(-3 * side, -17 + by, 1.3), ('gold', 'gold', 'goldD'))


# ───────────────────────── 2 사이클롭스 ─────────────────────────
CYCLOPS = dict(ol=(52, 30, 30), skL=(240, 204, 152), sk=(206, 154, 102), skD=(150, 100, 70), skDD=(104, 64, 50),
               eyeW=(255, 255, 238), iris=(214, 54, 46), horn=(236, 226, 196), loin=(124, 84, 54), loinD=(82, 52, 40),
               belt=(160, 160, 172), rock=(156, 146, 134), rockD=(104, 96, 92), glow=(255, 232, 96), glowL=(255, 255, 210))


def cyc_eye(cv, x, y, P, big=1.6):
    cv.put(cv.E(x, y, big, big), 'eyeW')
    if P['eye'] == 1:
        cv.put(cv.E(x, y, big, big), 'skD', ol=False); cv.px([(x - 1, y), (x, y), (x + 1, y)], 'ol')
    elif P['eye'] == 2:
        cv.put(cv.E(x, y, big, big), 'glowL', ol=False); cv.px([(x, y)], 'glow')
    else:
        cv.px([(x - 1 if view_is_left(cv) else x, y), (x - 1 if view_is_left(cv) else x, y - 1)], 'iris')


def view_is_left(cv):
    return getattr(cv, 'view', 'left') == 'left'


def cyclops(cv, view, P):
    s, cr = P['step'], P['crouch']
    by = cr + P['bob']
    SK, SKB = ('skL', 'sk', 'skD'), ('sk', 'skD', 'skDD')
    cv.view = view
    if view == 'left':
        aN = P['aN'] if P['aN'] is not None else 8 - 20 * s
        aF = P['aF'] if P['aF'] is not None else 8 + 20 * s
        lf = [-1 if s < 0 else 0, -1 if s > 0 else 0]
        cv.put(cv.T([(2, -8 + by), (2 + 2 * s, -2 + lf[1])], 5) | cv.E(1 + 2 * s, -1 + lf[1], 3, 1), SKB)
        hx, hy = pol(3, -18 + by, aF, 9)
        cv.m['hF'] = (hx, hy)
        cv.put(cv.T([(3, -18 + by), (hx, hy)], [5, 4]) | cv.D(hx, hy, 2.5), SKB)
        # 몸통 · 머리(목 없이 한 덩이)
        cv.put(cv.E(0, -14 + by, 7, 6) | cv.E(-2, -21 + by + P['head'], 5, 5), SK)
        cv.px([(-4, -13 + by), (-3, -12 + by), (-4, -15 + by), (2, -16 + by), (4, -14 + by)], 'skD')
        # 허리천
        cv.put(cv.R(-5, -9 + by, 5, -5 + by) & cv.E(0, -7 + by, 6, 4) | cv.P([(-3, -6 + by), (0, -2 + by), (1, -6 + by)]), ('loin', 'loin', 'loinD'))
        cv.put(cv.R(-6, -9 + by, 6, -9 + by) & cv.E(0, -9 + by, 7, 2), 'belt', ol=False)
        hb = by + P['head']
        cv.put(cv.P([(-3, -25 + hb), (-2, -28 + hb), (0, -25 + hb)]), ('horn', 'horn', 'skD'))
        # 눈썹 · 눈 · 입
        cv.px([(-7, -24 + hb), (-6, -24 + hb), (-5, -24 + hb), (-4, -24 + hb)], 'skDD')
        cyc_eye(cv, -5, -22 + hb, P)
        if P['mouth']:
            cv.put(cv.R(-7, -19 + hb, -4, -18 + hb + P['mouth'] - 1), 'skDD', ol=False)
            cv.px([(-6, -19 + hb), (-4, -19 + hb)], 'eyeW')
        else:
            cv.px([(-7, -18 + hb), (-6, -18 + hb), (-5, -18 + hb)], 'skDD'); cv.px([(-6, -19 + hb)], 'eyeW')
        # 가까운 다리 · 팔
        cv.put(cv.T([(-2, -8 + by), (-2 - 2 * s, -2 + lf[0])], 5) | cv.E(-3 - 2 * s, -1 + lf[0], 3, 1), SK)
        hx, hy = pol(-2, -18 + by, aN, 9)
        cv.m['hN'] = (hx, hy); cv.m['eye'] = (-5, -22 + hb); cv.m['mouth'] = (-6, -18 + hb)
        cv.put(cv.T([(-1, -18 + by), (hx, hy)], [4, 4]) | cv.D(hx, hy, 2.5), ('sk', 'sk', 'skD'))
        cv.px([pol(hx, hy, aN, 1.5), (hx + 1, hy)], 'skD')
    else:
        front = view == 'down'
        for sg in (-1, 1):
            lift = -1 if (s == -1 and sg == -1) or (s == 1 and sg == 1) else 0
            cv.put(cv.T([(3 * sg, -8 + by), (3 * sg, -2 + lift)], 5) | cv.E(3 * sg + sg, -1 + lift, 2.5, 1), SK)
        cv.put(cv.E(0, -14 + by, 7, 6) | cv.E(0, -21 + by, 5, 5), SK)
        cv.put(cv.R(-6, -9 + by, 6, -5 + by) & cv.E(0, -7 + by, 7, 4), ('loin', 'loin', 'loinD'))
        cv.put(cv.R(-7, -9 + by, 7, -9 + by) & cv.E(0, -9 + by, 7, 2), 'belt', ol=False)
        cv.put(cv.P([(-1, -25 + by), (0, -28 + by), (1, -25 + by)]), ('horn', 'horn', 'skD'))
        for sg in (-1, 1):
            hx, hy = 9 * sg, -9 + by - 2 * s * sg
            cv.put(cv.T([(6 * sg, -18 + by), (hx, hy)], [5, 5]) | cv.D(hx, hy, 2.5), SK)
        if front:
            cv.px([(x, -24 + by) for x in range(-2, 3)], 'skDD')
            cyc_eye(cv, 0, -22 + by, P)
            cv.px([(-1, -18 + by), (0, -18 + by), (1, -18 + by)], 'skDD')
            cv.px([(-2, -13 + by), (2, -13 + by), (0, -11 + by)], 'skD')
        else:
            cv.px([(-3, -16 + by), (3, -16 + by), (0, -14 + by), (0, -12 + by)], 'skD')


# ───────────────────────── 3 나방 인간 ─────────────────────────
MOTHMAN = dict(ol=(40, 28, 40), furL=(236, 226, 206), fur=(184, 164, 144), furD=(122, 102, 92), furDD=(80, 62, 66),
               wingL=(222, 204, 150), wing=(170, 140, 100), wingD=(110, 84, 70), spot=(90, 196, 214), spotD=(40, 110, 150),
               eyeR=(255, 56, 56), eyeL=(255, 206, 168), dust=(252, 242, 150), dustP=(206, 140, 255), dustD=(132, 76, 204))


def mothman(cv, view, P):
    s, w = P['step'], P['wing']
    by = P['bob'] + P['crouch'] - 2
    FU, WG = ('furL', 'fur', 'furD'), ('wingL', 'wing', 'wingD')
    if view == 'left':
        aN = P['aN'] if P['aN'] is not None else 30 + 10 * s
        # 날개(뒤): 앞날개 + 뒷날개
        up = cv.P([(1, -18 + by), (6, -25 + by + w), (10, -27 + by + 2 * w), (11, -20 + by + w), (9, -13 + by), (3, -12 + by)])
        lo = cv.P([(2, -13 + by), (9, -11 + by - w), (9, -6 + by - w), (4, -6 + by)])
        cv.put(lo, ('wing', 'wing', 'wingD'))
        cv.put(up, WG)
        cv.put(cv.D(7, -20 + by + w, 1.6), 'spot', ol=False); cv.px([(7, -20 + by + w)], 'spotD')
        cv.px([(9, -24 + by + 2 * w), (4, -16 + by), (6, -9 + by - w)], 'wingD')
        line(cv, (2, -17 + by), (9, -25 + by + 2 * w), 'wingD')
        # 다리(가늘게 매달림)
        for x0, k in ((1, 1), (-1, -1)):
            fx = x0 - 1 + (s * k if s else 0)
            cv.put(cv.T([(x0, -8 + by), (fx, -2 + by)], 2), ('furD', 'furD', 'furDD'))
        # 몸통
        body = jag(cv, cv.E(0, -13 + by, 4, 6), 2, s % 2, 1)
        cv.put(body, FU)
        cv.px([(x, -11 + by) for x in (-2, 0, 2)] + [(x, -9 + by) for x in (-1, 1)], 'furD')
        # 목털 · 머리
        hb = by + P['head']
        cv.put(jag(cv, cv.E(0, -18 + hb, 4, 2), 2, 0, 1), ('furL', 'furL', 'fur'))
        cv.put(cv.E(-1, -21 + hb, 3, 2.5), FU)
        er = 'eyeL' if P['eye'] == 2 else 'eyeR'
        if P['eye'] == 1:
            cv.px([(-4, -21 + hb), (-3, -21 + hb)], 'ol')
        else:
            cv.put(cv.E(-3, -21 + hb, 1, 1.2), er, ol=False); cv.px([(-3, -22 + hb)], 'eyeL')
        # 깃털 더듬이
        for tip in ((-4, -27 + hb), (1, -27 + hb)):
            line(cv, (-1, -23 + hb), tip, 'furD')
            cv.px([(tip[0] + 1, tip[1] + 1), (tip[0] - 1, tip[1] + 1)], 'furD')
        # 가까운 팔
        hx, hy = pol(-2, -16 + by, aN, 6)
        cv.m['hN'] = (hx, hy); cv.m['eye'] = (-3, -21 + hb); cv.m['wing'] = (7, -20 + by + w)
        cv.put(cv.T([(-2, -16 + by), (hx, hy)], [2, 2]), ('fur', 'furD', 'furD'))
        cv.px([pol(hx, hy, aN - 30, 1.5), pol(hx, hy, aN + 30, 1.5)], 'furDD')
    else:
        front = view == 'down'
        for sg in (-1, 1):
            up = cv.P([(2 * sg, -18 + by), (8 * sg, -26 + by + 2 * w), (11 * sg, -24 + by + 2 * w), (11 * sg, -15 + by + w), (4 * sg, -11 + by)])
            lo = cv.P([(2 * sg, -12 + by), (9 * sg, -10 + by - w), (7 * sg, -5 + by - w), (2 * sg, -7 + by)])
            cv.put(lo, ('wing', 'wing', 'wingD'))
            cv.put(up, WG)
            cv.put(cv.D(7 * sg, -19 + by + w, 1.6), 'spot', ol=False); cv.px([(7 * sg, -19 + by + w)], 'spotD')
            line(cv, (2 * sg, -17 + by), (9 * sg, -24 + by + 2 * w), 'wingD')
        for sg in (-1, 1):
            cv.put(cv.T([(sg, -8 + by), (sg * 2, -2 + by + (s * sg > 0))], 2), ('furD', 'furD', 'furDD'))
        cv.put(jag(cv, cv.E(0, -13 + by, 4, 6), 2, 0, 1), FU)
        cv.put(jag(cv, cv.E(0, -18 + by, 4, 2), 2, 0, 1), ('furL', 'furL', 'fur'))
        cv.put(cv.E(0, -21 + by, 3, 2.5), FU)
        for sg in (-1, 1):
            line(cv, (sg, -23 + by), (4 * sg, -27 + by), 'furD')
            cv.px([(4 * sg - sg, -27 + by), (4 * sg, -26 + by)], 'furD')
        if front:
            for sg in (-1, 1):
                cv.put(cv.E(2 * sg, -21 + by, 1, 1.2), 'eyeR', ol=False)
            cv.px([(-2, -22 + by), (2, -22 + by)], 'eyeL')
            cv.px([(x, -11 + by) for x in (-2, 0, 2)], 'furD')
        else:
            cv.px([(0, -12 + by), (0, -9 + by), (-2, -14 + by), (2, -14 + by)], 'furD')


mothman.floats = True


# ───────────────────────── 4 바실리스크 ─────────────────────────
BASILISK = dict(ol=(20, 40, 30), scL=(172, 232, 112), sc=(88, 170, 70), scD=(40, 112, 62), scDD=(24, 70, 50),
                belly=(232, 222, 152), bellyD=(178, 158, 100), crest=(232, 62, 62), crestD=(150, 30, 52),
                crown=(252, 212, 82), eye=(255, 240, 90), eyeG=(200, 255, 230), stone=(172, 172, 184), stoneD=(112, 112, 128))


def basilisk(cv, view, P):
    s, by = P['step'], P['bob'] + P['crouch']
    SC, CR = ('scL', 'sc', 'scD'), ('crest', 'crest', 'crestD')
    if view == 'left':
        t = P['tail'] if P['tail'] else s
        # 먼 다리
        for bx, off in ((-1, 2 * s), (8, -2 * s)):
            cv.put(cv.T([(bx, -5 + by), (bx - 1 + off, -1)], 3) | cv.E(bx - 2 + off, 0, 1.5, 0.6), ('sc', 'scD', 'scDD'))
        # 꼬리
        cv.put(cv.T([(8, -7 + by), (11, -5 + by), (10, -2), (7, -1 + t * 0)], [5, 4, 3, 1]) |
               cv.T([(7, -1), (5, -1 - (t > 0))], [1, 1]), SC)
        # 몸 · 배
        cv.put(cv.E(3, -7 + by, 6, 4), SC)
        cv.put(cv.E(2, -4 + by, 5, 1.2), ('belly', 'belly', 'bellyD'), ol=False)
        for x in (1, 4, 7):
            cv.put(cv.P([(x - 1, -10 + by), (x + (1 if x < 7 else 1), -13 + by + (x == 7)), (x + 2, -10 + by)]), ('crestD', 'crestD', 'crestD'))
        cv.px([(0, -8 + by), (3, -9 + by), (6, -8 + by), (4, -7 + by)], 'scD')
        # 목 · 머리
        hb = by + P['head']
        cv.put(cv.T([(0, -8 + by), (-4, -12 + hb)], [5, 4]), SC)
        cv.put(cv.P([(-8, -15 + hb), (-7, -19 + hb), (-6, -16 + hb), (-4, -20 + hb), (-3, -16 + hb), (-1, -18 + hb), (-1, -13 + hb), (-7, -13 + hb)]), CR)
        cv.put(cv.E(-6, -13 + hb, 3.5, 2.8) | cv.E(-9, -12 + hb, 2, 1.8), SC)
        cv.m['eye'] = (-7, -14 + hb); cv.m['mouth'] = (-11, -11 + hb); cv.m['hN'] = (-10, -11 + hb)
        cv.put(cv.R(-8, -16 + hb, -4, -16 + hb), 'crown', ol=False); cv.px([(-7, -17 + hb), (-5, -17 + hb)], 'crown')
        if P['mouth']:
            cv.put(cv.R(-11, -11 + hb, -6, -11 + hb + P['mouth']), 'crestD', ol=True)
            cv.px([(-10, -11 + hb), (-8, -11 + hb)], 'belly')
        else:
            line(cv, (-10, -11 + hb), (-6, -11 + hb), 'scDD')
        if P['eye'] == 2:
            cv.put(cv.E(-7, -14 + hb, 1.2, 1), 'eyeG', ol=False); cv.px([(-7, -14 + hb)], 'eye')
        elif P['eye'] == 1:
            cv.px([(-8, -14 + hb), (-7, -14 + hb)], 'ol')
        else:
            cv.px([(-7, -14 + hb), (-8, -14 + hb)], 'eye'); cv.px([(-8, -14 + hb)], 'ol')
        # 가까운 다리
        for bx, off in ((-2, -2 * s), (6, 2 * s)):
            cv.put(cv.T([(bx, -5 + by), (bx - 1 + off, -1 - (off < 0))], 3) | cv.E(bx - 2 + off, 0 - (off < 0), 1.5, 0.6), SC)
            cv.px([(bx - 3 + off, 0 - (off < 0))], 'belly')
    else:
        front = view == 'down'
        for sg in (-1, 1):
            lift = -1 if s * sg > 0 else 0
            cv.put(cv.T([(4 * sg, -5 + by), (6 * sg, -1 + lift)], 3) | cv.E(6 * sg, 0 + lift, 1.5, 0.6), SC)
        if not front:
            cv.put(cv.T([(0, -6), (2 * s, -2), (-s, 0)], [5, 3, 1]), SC)
        cv.put(cv.E(0, -7 + by, 5, 4), SC)
        if front:
            cv.put(cv.E(0, -5 + by, 3, 1.5), ('belly', 'belly', 'bellyD'), ol=False)
        cv.put(cv.P([(-4, -14 + by), (-3, -18 + by), (-1, -15 + by), (0, -20 + by), (1, -15 + by), (3, -18 + by), (4, -14 + by)]), CR)
        cv.put(cv.E(0, -12 + by, 4, 3.5), SC)
        cv.put(cv.R(-3, -15 + by, 3, -15 + by), 'crown', ol=False); cv.px([(-2, -16 + by), (0, -16 + by), (2, -16 + by)], 'crown')
        if front:
            cv.put(cv.E(0, -10 + by, 2.5, 1.5), SC, ol=False)
            cv.px([(-2, -13 + by), (2, -13 + by)], 'eye'); cv.px([(-2, -12 + by), (2, -12 + by)], 'ol')
            cv.px([(-1, -9 + by), (1, -9 + by)], 'scDD')
        else:
            cv.px([(0, -9 + by), (-2, -6 + by), (2, -6 + by)], 'crestD')


# ───────────────────────── 5 지니 ─────────────────────────
DJINN = dict(ol=(30, 24, 62), skL=(152, 204, 255), sk=(82, 140, 232), skD=(52, 90, 182), skDD=(36, 56, 132),
             smL=(226, 218, 255), sm=(172, 152, 232), smD=(112, 90, 182), gold=(255, 222, 92), goldD=(198, 138, 40),
             hair=(46, 30, 70), sash=(228, 60, 88), eyeW=(255, 255, 224), wind=(196, 255, 238), windD=(104, 210, 200))


def djinn(cv, view, P):
    s, t = P['step'], (P['tail'] or P['step'])
    by = P['bob'] + P['crouch']
    SK, SM = ('skL', 'sk', 'skD'), ('smL', 'sm', 'smD')
    # 램프(바닥, 흔들리지 않는다)
    lx = 5 if view == 'left' else 0
    if P.get('lamp', True):
        cv.put(cv.E(lx, -1, 3, 1.3) | cv.P([(lx - 3, -2), (lx - 6, -3), (lx - 3, -1)]) | cv.R(lx - 1, -3, lx + 1, -3), ('gold', 'gold', 'goldD'))
    if view == 'left':
        smoke = cv.T([(0, -10 + by), (1 + t, -6 + by // 2), (3, -3), (lx - 1, -2)], [9, 7, 4, 2])
        cv.put(smoke, SM)
        cv.px([(0 + t, -7 + by // 2), (2, -4), (-2, -9 + by)], 'smL'); cv.px([(3 + t, -8 + by // 2)], 'smD')
        aN, aF = P['aN'], P['aF']
        if aF is not None:
            hx, hy = pol(3, -18 + by, aF, 8)
            cv.m['hF'] = (hx, hy)
            cv.put(cv.T([(3, -18 + by), (hx, hy)], [4, 3]) | cv.D(hx, hy, 2), ('sk', 'skD', 'skDD'))
        cv.put(cv.E(0, -15 + by, 6, 4.5), SK)
        cv.px([(-3, -16 + by), (-2, -15 + by), (1, -16 + by)], 'skD')
        cv.put(cv.R(-5, -11 + by, 5, -10 + by) & cv.E(0, -11 + by, 6, 2), ('sash', 'sash', 'sash'), ol=False)
        hb = by + P['head']
        cv.put(cv.E(-2, -22 + hb, 3, 3.5), SK)
        cv.m['eye'] = (-4, -23 + hb); cv.m['mouth'] = (-5, -20 + hb); cv.m['hN'] = (-6, -14 + by); cv.m['lamp'] = (lx - 5, -3)
        cv.put(cv.T([(0, -25 + hb), (2, -27 + hb), (4, -26 + hb)], [3, 2, 1]), ('hair', 'hair', 'hair'))
        cv.put(cv.P([(-5, -20 + hb), (-2, -20 + hb), (-4, -16 + hb)]), ('hair', 'hair', 'hair'))
        cv.px([(1, -21 + hb)], 'gold')
        if P['eye'] == 1:
            cv.px([(-4, -22 + hb), (-3, -22 + hb)], 'ol')
        else:
            cv.px([(-4, -23 + hb), (-3, -23 + hb) if P['eye'] == 2 else (-4, -23 + hb)], 'eyeW')
        if P['mouth']:
            cv.px([(-5, -20 + hb), (-4, -20 + hb)], 'sash')
        if aN is None:
            # 팔짱: 앞팔 가로
            cv.put(cv.T([(-3, -17 + by), (-5, -14 + by), (3, -14 + by)], [4, 3, 3]), SK)
            cv.px([(-3, -14 + by), (-3, -13 + by), (-3, -15 + by)], 'gold')
        else:
            hx, hy = pol(-3, -17 + by, aN, 8)
            cv.m['hN'] = (hx, hy)
            cv.put(cv.T([(-3, -17 + by), (hx, hy)], [4, 3]) | cv.D(hx, hy, 2), SK)
            bx, bb = pol(-3, -17 + by, aN, 6)
            cv.px([(bx, bb), (bx, bb + 1)], 'gold')
    else:
        front = view == 'down'
        cv.put(cv.T([(0, -10 + by), (t, -6 + by // 2), (0, -3), (0, -2)], [10, 7, 4, 2]), SM)
        cv.px([(-2 + t, -7), (1, -4)], 'smL')
        cv.put(cv.E(0, -15 + by, 6, 4.5), SK)
        cv.put(cv.R(-5, -11 + by, 5, -10 + by) & cv.E(0, -11 + by, 6, 2), ('sash', 'sash', 'sash'), ol=False)
        for sg in (-1, 1):
            hx, hy = 7 * sg, -11 + by - s * sg
            cv.put(cv.T([(5 * sg, -18 + by), (hx, hy)], [4, 3]) | cv.D(hx, hy, 2), SK)
            cv.px([(hx, hy - 2), (hx - sg, hy - 2)], 'gold')
        cv.put(cv.E(0, -22 + by, 3.5, 3.5), SK)
        cv.put(cv.T([(0, -25 + by), (0, -28 + by)], [3, 2]), ('hair', 'hair', 'hair'))
        cv.px([(-4, -22 + by), (4, -22 + by)], 'gold')
        if front:
            cv.px([(-1, -23 + by), (1, -23 + by)], 'eyeW')
            cv.put(cv.P([(-2, -20 + by), (2, -20 + by), (0, -16 + by)]), ('hair', 'hair', 'hair'))
            cv.px([(-2, -16 + by), (2, -16 + by)], 'skD')
        else:
            cv.px([(0, -16 + by), (-3, -14 + by), (3, -14 + by)], 'skD')


djinn.floats = True


# ───────────────────────── 6 키메라 ─────────────────────────
CHIMERA = dict(ol=(42, 24, 20), lionL=(250, 212, 122), lion=(222, 160, 70), lionD=(160, 100, 50), mane=(176, 72, 40),
               maneD=(112, 40, 30), goatL=(242, 242, 232), goat=(188, 186, 178), horn=(120, 98, 88), snake=(98, 176, 92),
               snakeD=(42, 104, 62), fireL=(255, 242, 142), fire=(255, 122, 40), fireD=(206, 50, 30), bolt=(176, 150, 255))


def chimera(cv, view, P):
    s, by = P['step'], P['bob'] + P['crouch']
    t = P['tail'] if P['tail'] else s
    LI, MN, GT, SN = ('lionL', 'lion', 'lionD'), ('mane', 'mane', 'maneD'), ('goatL', 'goat', 'horn'), ('snake', 'snake', 'snakeD')
    if view == 'left':
        for bx, off in ((-3, 2 * s), (6, -2 * s)):
            cv.put(cv.T([(bx, -6 + by), (bx + off, -1)], 4) | cv.E(bx + off - 1, -1, 2, 1), ('lion', 'lionD', 'lionD'))
        # 뱀 꼬리
        sh = P.get('snake', t)
        cv.put(cv.T([(8, -9 + by), (10, -12 + by), (10, -16 + by + sh), (9, -18 + by + sh)], [3, 3, 3, 3]), SN)
        cv.put(cv.E(8, -19 + by + sh, 2, 1.3), SN)
        cv.px([(7, -20 + by + sh)], 'fireL')
        cv.m['snake'] = (5, -19 + by + sh)
        if P['mouth']:
            cv.px([(5, -19 + by + sh), (6, -19 + by + sh)], 'fireD')
        # 몸
        cv.put(cv.E(1, -9 + by, 7, 4.5), LI)
        cv.px([(0, -6 + by), (3, -6 + by), (5, -7 + by)], 'lionL')
        cv.px([(2, -11 + by), (5, -10 + by)], 'lionD')
        # 염소 머리
        gh = by + P.get('goat', 0)
        cv.put(cv.T([(3, -12 + by), (3, -16 + gh)], 3), GT)
        cv.put(cv.E(2, -18 + gh, 2.5, 2), GT)
        cv.put(cv.T([(3, -20 + gh), (5, -22 + gh), (7, -21 + gh), (7, -19 + gh)], [2, 2, 1, 1]), ('horn', 'horn', 'horn'))
        cv.px([(1, -19 + gh)], 'ol'); cv.px([(0, -16 + gh), (0, -15 + gh)], 'goat')
        cv.m['goat'] = (0, -17 + gh)
        # 사자 머리
        hb = by + P['head']
        cv.put(jag(cv, cv.E(-5, -13 + hb, 5, 5), 2, 0, 1), MN)
        cv.put(cv.E(-7, -12 + hb, 3, 3), LI)
        cv.m['mouth'] = (-10, -10 + hb); cv.m['eye'] = (-8, -14 + hb); cv.m['hN'] = (-10, -10 + hb)
        cv.put(cv.E(-9, -11 + hb, 1.5, 1.5), ('lionL', 'lionL', 'lion'), ol=False)
        cv.px([(-10, -12 + hb)], 'ol')
        if P['eye'] == 1:
            cv.px([(-8, -14 + hb), (-7, -14 + hb)], 'ol')
        else:
            cv.px([(-8, -14 + hb)], 'ol' if P['eye'] == 0 else 'fireL')
        if P['mouth']:
            cv.put(cv.R(-10, -10 + hb, -7, -10 + hb + P['mouth']), 'maneD')
            cv.px([(-10, -10 + hb), (-8, -10 + hb)], 'goatL')
        else:
            cv.px([(-10, -10 + hb), (-9, -10 + hb)], 'lionD')
        for bx, off in ((-5, -2 * s), (4, 2 * s)):
            cv.put(cv.T([(bx, -6 + by), (bx + off, -1 - (off < 0))], 4) | cv.E(bx + off - 1, -1 - (off < 0), 2, 1), LI)
    else:
        front = view == 'down'
        for sg in (-1, 1):
            lift = -1 if s * sg > 0 else 0
            cv.put(cv.T([(4 * sg, -6 + by), (4 * sg, -1 + lift)], 4) | cv.E(4 * sg, -1 + lift, 2, 1), LI)
        # 뒤의 뱀과 염소
        cv.put(cv.T([(-3, -10 + by), (-6, -14 + by + s), (-6, -18 + by + s)], [3, 3, 3]) | cv.E(-6, -19 + by + s, 2, 1.5), SN)
        cv.px([(-7, -19 + by + s), (-5, -19 + by + s)], 'fireL')
        cv.put(cv.T([(3, -11 + by), (5, -16 + by)], 3) | cv.E(5, -18 + by, 2.5, 2), GT)
        cv.put(cv.T([(6, -20 + by), (8, -22 + by), (9, -20 + by)], [2, 1, 1]), ('horn', 'horn', 'horn'))
        cv.put(cv.E(0, -9 + by, 6, 4.5), LI)
        if front:
            cv.put(jag(cv, cv.E(0, -12 + by, 5, 5), 2, 0, 1), MN)
            cv.put(cv.E(0, -11 + by, 3, 3), LI)
            cv.put(cv.E(0, -9 + by, 1.5, 1.2), ('lionL', 'lionL', 'lion'), ol=False)
            cv.px([(-1, -13 + by), (1, -13 + by)], 'ol'); cv.px([(0, -10 + by)], 'ol')
        else:
            cv.put(jag(cv, cv.E(0, -12 + by, 5, 4.5), 2, 0, 1), MN)
            cv.put(cv.T([(0, -8 + by), (0, -3), (1, -1)], [3, 2, 1]), LI)


# ───────────────────────── 7 타락 천사 ─────────────────────────
DARK_ANGEL = dict(ol=(20, 16, 30), skin=(236, 214, 206), skinD=(176, 138, 148), hair=(226, 226, 240), hairD=(150, 150, 184),
                  robeL=(112, 90, 144), robe=(70, 50, 92), robeD=(40, 28, 60), wingL=(104, 98, 134), wing=(60, 56, 82),
                  wingD=(32, 28, 48), halo=(255, 212, 92), haloD=(190, 130, 42), eye=(214, 40, 64), light=(255, 252, 214),
                  lightB=(174, 150, 255))


def dark_angel(cv, view, P):
    s, w = P['step'], P['wing']
    by = P['bob'] + P['crouch']
    RB, WG, HR = ('robeL', 'robe', 'robeD'), ('wingL', 'wing', 'wingD'), ('hair', 'hair', 'hairD')
    if w == 0 and s:
        w = s
    if view == 'left':
        aN = P['aN'] if P['aN'] is not None else 10 - 16 * s
        # 날개
        wg = cv.P([(1, -18 + by), (5, -24 + by + w), (10, -27 + by + w), (11, -21 + by), (11, -13 + by - w), (9, -6 + by - w), (6, -9 + by), (3, -12 + by)])
        cv.put(wg, WG)
        for fx_, fy in ((10, -8), (8, -10), (10, -14), (10, -19)):
            cv.px([(fx_, fy + by - (w if fy > -14 else 0))], 'wingD')
        line(cv, (3, -17 + by), (9, -24 + by + w), 'wingL')
        line(cv, (5, -14 + by), (10, -16 + by), 'wingD')
        # 다리(발만 치마 아래)
        for k, sg in ((-1, 1), (1, -1)):
            fx_ = k + 2 * s * sg
            cv.put(cv.E(fx_ - 1, -1 - (s * sg < 0), 1.5, 1), ('robeD', 'robeD', 'robeD'))
        # 치마
        cv.put(cv.P([(-3, -12 + by), (3, -12 + by), (4 + (s > 0), -2), (-5 + (s > 0) - (s < 0), -2)]), RB)
        line(cv, (0, -10 + by), (-1 - s, -3), 'robeD')
        cv.put(cv.E(0, -15 + by, 3, 4), RB)
        cv.put(cv.R(-3, -12 + by, 3, -12 + by), 'haloD', ol=False)
        hb = by + P['head']
        cv.put(cv.T([(0, -24 + hb), (2, -21 + hb), (3, -15 + by)], [6, 5, 3]), HR)
        cv.put(cv.E(-1, -21 + hb, 3, 3.5), ('skin', 'skin', 'skinD'))
        cv.put(cv.E(0, -23 + hb, 3.5, 2) | cv.R(0, -23 + hb, 2, -18 + hb), HR, ol=False)
        cv.px([(-4, -22 + hb), (-3, -23 + hb)], 'hair')
        # 금 간 후광
        ring = cv.E(1, -26 + hb, 3.5, 1) & ~cv.E(1, -26 + hb, 2, 0.3)
        cv.a[ring] = cv.ix['halo']
        cv.px([(3, -27 + hb), (4, -26 + hb)], 'haloD'); cv.px([(-1, -25 + hb)], 0)
        if P['eye'] == 1:
            cv.px([(-3, -21 + hb), (-2, -21 + hb)], 'ol')
        else:
            cv.px([(-3, -21 + hb)], 'light' if P['eye'] == 2 else 'eye')
        cv.px([(-3, -19 + hb)], 'skinD')
        hx, hy = pol(-1, -17 + by, aN, 6)
        cv.m['hN'] = pol(hx, hy, aN, 1.5); cv.m['eye'] = (-3, -21 + hb); cv.m['halo'] = (1, -26 + hb)
        cv.put(cv.T([(-1, -17 + by), (hx, hy)], [3, 3]), RB)
        cv.put(cv.D(*pol(hx, hy, aN, 1), 1.1), ('skin', 'skin', 'skinD'))
    else:
        front = view == 'down'
        for sg in (-1, 1):
            wg = cv.P([(2 * sg, -17 + by), (6 * sg, -24 + by + w * sg), (11 * sg, -27 + by + w * sg), (11 * sg, -12 + by), (8 * sg, -6 + by), (3 * sg, -10 + by)])
            cv.put(wg, WG)
            line(cv, (3 * sg, -16 + by), (9 * sg, -24 + by + w * sg), 'wingL')
            cv.px([(10 * sg, -9 + by), (9 * sg, -13 + by)], 'wingD')
        for sg in (-1, 1):
            cv.put(cv.E(2 * sg, -1 - (s * sg > 0), 1.5, 1), ('robeD', 'robeD', 'robeD'))
        cv.put(cv.P([(-3, -12 + by), (3, -12 + by), (5, -2), (-5, -2)]), RB)
        line(cv, (0, -10 + by), (s, -3), 'robeD')
        cv.put(cv.E(0, -15 + by, 3.5, 4), RB)
        cv.put(cv.R(-3, -12 + by, 3, -12 + by), 'haloD', ol=False)
        for sg in (-1, 1):
            hx, hy = 4 * sg, -10 + by - s * sg
            cv.put(cv.T([(3 * sg, -17 + by), (hx, hy)], 3), RB)
            cv.put(cv.D(hx, hy + 1, 1.1), ('skin', 'skin', 'skinD'))
        if not front:
            cv.put(cv.T([(0, -23 + by), (0, -15 + by)], [7, 5]), HR)
        cv.put(cv.E(0, -21 + by, 3, 3.5), ('skin', 'skin', 'skinD') if front else HR)
        cv.put(cv.E(0, -23 + by, 3.5, 2), HR, ol=False)
        if front:
            cv.px([(-3, -21 + by), (3, -21 + by), (-3, -20 + by), (3, -20 + by)], 'hair')
            cv.px([(-1, -21 + by), (1, -21 + by)], 'eye')
        ring = cv.E(0, -26 + by, 3.5, 1) & ~cv.E(0, -26 + by, 2, 0.3)
        cv.a[ring] = cv.ix['halo']
        cv.px([(2, -27 + by), (3, -26 + by)], 'haloD'); cv.px([(-2, -25 + by)], 0)


CHARS = [('yeti', yeti, YETI), ('merfolk', merfolk, MERFOLK), ('cyclops', cyclops, CYCLOPS), ('mothman', mothman, MOTHMAN),
         ('basilisk', basilisk, BASILISK), ('djinn', djinn, DJINN), ('chimera', chimera, CHIMERA), ('dark_angel', dark_angel, DARK_ANGEL)]


def poses_walk(fn, st):
    P = D0(step=st)
    if getattr(fn, 'floats', False):
        P['bob'] = [0, -1, 0][st + 1]
        P['wing'] = st
        P['tail'] = st
    return P


FIT = {}


def fit(fn, pal):
    """캐릭터 맞춤: 걷기 12칸 합집합 상자를 재어 설계 배율 k(≤1, 폭 ≤22·키 ≤29)와 칸 안 기준점(ax, ay)을 정한다.
    발바닥 아래 끝이 칸 29행(아래 2px 여백)에 오고, 가로는 합집합 상자가 칸 가운데 온다. 전투 시트도 같은 k 를 쓴다."""
    key = fn.__name__
    if key in FIT:
        return FIT[key]
    k = 1.0
    for _ in range(6):
        ys0, ys1, xs0, xs1 = [], [], [], []
        for view in ('up', 'left', 'down'):
            for st in (-1, 0, 1):
                cv = Cv(64, 64, 32, 48, pal, k)
                fn(cv, view, poses_walk(fn, st)); cv.outline()
                ys, xs = np.nonzero(cv.a)
                ys0.append(ys.min()); ys1.append(ys.max()); xs0.append(xs.min()); xs1.append(xs.max())
        h = max(ys1) - min(ys0) + 1
        wdt = max(xs1) - min(xs0) + 1
        if h <= 29 and wdt <= 22:
            break
        k *= min(1.0, 28.5 / h, 21.5 / wdt) * 0.995
    ay = 48 - (max(ys1) - 29)
    ax = 32 - (min(xs0) - 1) + (22 - wdt) // 2
    FIT[key] = (k, ax, ay)
    return FIT[key]


def render(fn, pal, view, P, w=24, h=32, ax=None, ay=None, k=None):
    fk, fax, fay = fit(fn, pal)
    cv = Cv(w, h, fax if ax is None else ax, fay if ay is None else ay, pal, fk if k is None else k)
    fn(cv, 'left' if view == 'right' else view, P)
    cv.outline()
    return cv, cv.rgba(flip=(view == 'right'))


def build():
    sheet = Image.new('RGBA', (288, 256), (0, 0, 0, 0))
    for i, (name, fn, pal) in enumerate(CHARS):
        bx, by = i % 4 * 72, i // 4 * 128
        for r, view in enumerate(['up', 'right', 'down', 'left']):
            for p in range(3):
                _, im = render(fn, pal, view, poses_walk(fn, p - 1))
                sheet.alpha_composite(im, (bx + p * 24, by + r * 32))
        print(name, 'k=%.3f ax=%d ay=%d' % FIT[fn.__name__])
    return sheet


if __name__ == '__main__':
    sh = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sh.save(OUT)
    qa = ROOT / '.omo/nm6'
    qa.mkdir(parents=True, exist_ok=True)
    big = sh.resize((288 * 4, 256 * 4), Image.NEAREST)
    bg = Image.new('RGBA', big.size, (0, 150, 150, 255)); bg.alpha_composite(big)
    bg.save(qa / 'charset-x4.png')
    print('wrote', OUT)

