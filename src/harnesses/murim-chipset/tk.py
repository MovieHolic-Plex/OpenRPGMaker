"""무림 칩셋(murim_wuxia) 손 도트 도구.

색은 harness-data/murim-chipset/palette.json 의 (램프, 단) 으로만 고른다. 이 파일과 후보 코드에 hex 를 쓰지 않는다.
그림은 행 문자열 격자(stamp)로 직접 찍는다 — 글자 하나 = 화소 하나, 글자 → (램프, 단) 은 후보마다 범례로 정한다.
도형 마스크·노이즈·자동 윤곽으로 본체를 만들지 않는다(assistant-skills/pixel-dot-authoring).
"""
import hashlib
import json
import os

import numpy as np

T = 16
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = os.path.join(REPO, 'harness-data', 'murim-chipset')

PAL = json.load(open(os.path.join(DATA, 'palette.json'), encoding='utf-8'))


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


RAMPS = {k: [hx(c) for c in v] for k, v in PAL['ramps'].items()}
RAMPS.update({k: [hx(c) for c in v] for k, v in PAL['shared'].items()})
INK = hx(PAL['ink'])
SHADOW = hx(PAL['shadow']['color'])
SHADOW_A = int(PAL['shadow']['alpha'])
ALLOWED = {hx(c) for c in PAL['allowed']}


def C(ramp, tone=None):
    """('mu', 3) 또는 C('mu', 3) 또는 'ink' → RGB."""
    if ramp == 'ink':
        return INK
    if tone is None and isinstance(ramp, tuple):
        ramp, tone = ramp
    return RAMPS[ramp][tone]


class Cv:
    """RGBA 캔버스. 좌표 (x, y), y 는 아래로."""

    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = np.zeros((h, w, 4), np.uint8)

    def put(s, x, y, col, alpha=255):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.a[y, x, :3] = col
            s.a[y, x, 3] = alpha

    def shadow(s, x, y):
        """투명한 칸에만 그림자 한 화소(본체 위에는 안 덮는다)."""
        if 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 0:
            s.a[y, x, :3] = SHADOW
            s.a[y, x, 3] = SHADOW_A

    def paste(s, o, x, y):
        for yy in range(o.h):
            for xx in range(o.w):
                p = o.a[yy, xx]
                if p[3] == 0:
                    continue
                X, Y = x + xx, y + yy
                if 0 <= X < s.w and 0 <= Y < s.h:
                    if p[3] == 255 or s.a[Y, X, 3] == 0:
                        s.a[Y, X] = p
                    else:  # 그림자를 바닥 위에 섞는다(장면 합성 전용, 후보 원본에는 쓰지 않는다)
                        al = p[3] / 255.0
                        s.a[Y, X, :3] = (s.a[Y, X, :3] * (1 - al) + p[:3] * al).astype(np.uint8)

    def img(s):
        from PIL import Image
        return Image.fromarray(s.a, 'RGBA')


def stamp(cv, rows, legend, ox=0, oy=0, wrap=False):
    """행 문자열을 찍는다. '.' 는 건너뜀(투명 유지), '~' 는 그림자. 범례에 없는 글자는 오류.
    wrap=True 면 캔버스 밖 좌표를 감아서 찍는다(반복 타일의 이음 확인용)."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.':
                continue
            x, y = ox + i, oy + j
            if wrap:
                x, y = x % cv.w, y % cv.h
            if ch == '~':
                cv.shadow(x, y)
                continue
            if ch not in legend:
                raise KeyError(f'범례에 없는 글자 {ch!r} (행 {j}, 열 {i})')
            cv.put(x, y, C(legend[ch]))


def grid(rows, legend, w=None, h=None):
    """행 문자열 하나로 캔버스 전체를 만든다. 행 길이가 다르면 오류(손으로 찍다 틀린 자리를 바로 잡게)."""
    h = h or len(rows)
    w = w or max(len(r) for r in rows)
    for j, r in enumerate(rows):
        if len(r) != w:
            raise ValueError(f'행 {j} 길이 {len(r)} ≠ {w}: {r!r}')
    if len(rows) != h:
        raise ValueError(f'행 수 {len(rows)} ≠ {h}')
    cv = Cv(w, h)
    stamp(cv, rows, legend)
    return cv


def image_hash(im):
    """그림 해시 = 크기 + RGBA 원시 바이트의 sha256. PNG 압축과 무관하게 같은 그림이면 같다."""
    a = np.asarray(im.convert('RGBA'))
    h = hashlib.sha256()
    h.update(f'{a.shape[1]}x{a.shape[0]}:'.encode())
    h.update(a.tobytes())
    return h.hexdigest()


def luma(rgb):
    rgb = np.asarray(rgb, float)
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
