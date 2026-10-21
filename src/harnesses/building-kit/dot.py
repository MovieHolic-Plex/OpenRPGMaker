"""building-kit 손 도트 도구.

색은 harness-data/building-kit/<테마>/palette.json 의 (램프, 단) 으로만 고른다(버들항 실제 화소 색). 후보 코드에 hex 를 쓰지 않는다.
그림은 행 문자열(글자 하나 = 화소 하나)로 직접 찍는다. 글자 → (램프, 단) 은 후보마다 범례로 정한다.
도형 마스크·잡음 함수로 본체를 만들지 않는다(assistant-skills/pixel-dot-authoring).

이 파일이 하는 일: 행 문자열 찍기(stamp)·캔버스·해시, 테마 팔레트 적재뿐이다.
그림 파일을 읽는 코드는 없다 — 버들항 시트의 칸/키트·Actor1·장면 바탕은 `beodeul.py` 에만 있다.
그래서 그리기 에이전트가 쓰는 `dot` 으로는 참고 그림을 화소로 읽어 베낄 수 없다(트레이스 차단).
"""
import hashlib
import json
import os

import numpy as np
from PIL import Image

T = 16
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.environ.get('BUILDING_KIT_DATA') or os.path.join(REPO, 'harness-data', 'building-kit')
RUNS = os.environ.get('BUILDING_KIT_RUNS') or os.path.join(REPO, 'qa-runs', 'harnesses', 'building-kit')
VIZ = os.path.expanduser('~/claude-viz')
THEMES = ('fantasy-kingdom', 'desert-oasis', 'northern-snow', 'beodeul-noble')


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def theme_dir(theme):
    return os.path.join(DATA, theme)


def seed(theme):
    return json.load(open(os.path.join(theme_dir(theme), 'seed.json'), encoding='utf-8'))


_PAL = {}


def palette(theme):
    if theme not in _PAL:
        path = os.path.join(theme_dir(theme), 'palette.json')
        if not os.path.exists(path):
            raise SystemExit(f'{theme}: palette.json 이 없다 — npm run harness -- building-kit palette {theme}')
        _PAL[theme] = json.load(open(path, encoding='utf-8'))
    return _PAL[theme]


def ramps(theme):
    return {k: [hx(c) for c in v] for k, v in palette(theme)['ramps'].items()}


def allowed(theme):
    return {hx(c) for c in palette(theme)['allowed']}


def shadow(theme):
    s = palette(theme)['shadow']
    return tuple(s['rgb']), int(s['alpha'])


def C(theme, ramp, tone):
    r = ramps(theme)[ramp]
    if tone < 0:
        tone = len(r) + tone
    return r[min(tone, len(r) - 1)]


def legend(theme, **kw):
    """legend('fantasy-kingdom', a=('roof', 0), b=('roof', 3)) → {'a': rgb, ...}. '.' 는 투명/유지, '~' 는 그림자."""
    return {k: C(theme, *v) for k, v in kw.items()}


class Cv:
    """RGBA 캔버스. (x, y), y 는 아래로."""

    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = np.zeros((h, w, 4), np.uint8)

    @staticmethod
    def of(img):
        a = np.array(img.convert('RGBA'))
        c = Cv(a.shape[1], a.shape[0])
        c.a = a.copy()
        return c

    def put(s, x, y, rgb, alpha=255):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.a[y, x, :3] = rgb
            s.a[y, x, 3] = alpha

    def shadow(s, x, y, rgb=(12, 14, 20), alpha=88):
        if 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 0:
            s.a[y, x, :3] = rgb
            s.a[y, x, 3] = alpha

    def paste(s, o, x, y):
        oa = o.a if isinstance(o, Cv) else np.array(o.convert('RGBA'))
        h, w = oa.shape[:2]
        for yy in range(h):
            Y = y + yy
            if not 0 <= Y < s.h:
                continue
            for xx in range(w):
                X = x + xx
                if not 0 <= X < s.w:
                    continue
                p = oa[yy, xx]
                if p[3] == 0:
                    continue
                if p[3] == 255 or s.a[Y, X, 3] == 0:
                    s.a[Y, X] = p
                else:
                    al = p[3] / 255.0
                    s.a[Y, X, :3] = (s.a[Y, X, :3] * (1 - al) + p[:3] * al).astype(np.uint8)

    def crop(s, x, y, w, h):
        c = Cv(w, h)
        c.a = s.a[y:y + h, x:x + w].copy()
        return c

    def img(s):
        return Image.fromarray(s.a, 'RGBA')


def stamp(cv, rows, leg, ox=0, oy=0):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == '.' or ch == ' ':
                continue
            if ch == '~':
                cv.shadow(ox + x, oy + y)
                continue
            if ch not in leg:
                raise KeyError(f'범례에 없는 글자 {ch!r} (행 {y} 열 {x}: {row})')
            cv.put(ox + x, oy + y, leg[ch])
    return cv


def grid(rows, leg, w=None, h=None):
    h = h or len(rows)
    w = w or max(len(r) for r in rows)
    for r in rows:
        if len(r) != w:
            raise ValueError(f'행 길이 {len(r)} ≠ {w}: {r!r}')
    return stamp(Cv(w, h), rows, leg)


def image_hash(im):
    a = np.array(im.convert('RGBA'))
    return hashlib.sha256(str(a.shape).encode() + a.tobytes()).hexdigest()


def tiled(cv, nx, ny):
    out = Cv(cv.w * nx, cv.h * ny)
    for j in range(ny):
        for i in range(nx):
            out.a[j * cv.h:(j + 1) * cv.h, i * cv.w:(i + 1) * cv.w] = cv.a
    return out
