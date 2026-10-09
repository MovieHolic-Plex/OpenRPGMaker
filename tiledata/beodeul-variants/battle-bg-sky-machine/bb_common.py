# 전투 배경(하늘·시간·기계 계열) 공용 틀 — 640×360 한 장을 하늘 띠·원경·지평선·전투 바닥·가장자리 물체 순서로 쌓는다.
# 그림 함수는 lib/ 에 복사한 각 장소 모듈(sc_/as_/tr_/fr_/mf_/ft_)의 것을 그대로 부른다. 여기서는 배치·띠·안개만 한다.
# 규칙(WAVE-BRIEF-3 A): 640×360 · 불투명 · 색 ≤ 96 · 그라데이션 하늘 금지(3~5 색 띠 + 손으로 찍은 구름) ·
# 배틀러 자리(x 120~560, y 190~330)에는 키 큰 물체·글자·밝은 점 금지 · 맨 아래 20px 는 HUD 가 덮는다.
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, 'lib')
if LIB not in sys.path: sys.path.insert(0, LIB)
import numpy as np
from PIL import Image

W, H = 640, 360
HORIZON = 176                      # 지평선(바닥 뒤 끝) 기본값
STAGE = (120, 190, 560, 330)       # 배틀러 자리 — 키 큰 물체·밝은 점 금지


def canvas(c=(0, 0, 0)):
    return Image.new('RGBA', (W, H), tuple(c) + (255,))


def bands(img, y0, y1, cols, cuts=None, dither=2):
    """y0..y1 를 색 띠로 칠한다(그라데이션 아님). cols = 위→아래 색, cuts = 띠 경계 y(len(cols)-1 개).
    경계에는 체크 디더 dither 줄(손 도트 띠 경계)."""
    n = len(cols)
    if cuts is None: cuts = [int(y0 + (y1 - y0) * (i + 1) / n) for i in range(n - 1)]
    a = np.array(img)
    for y in range(y0, y1):
        k = sum(1 for c in cuts if y >= c)
        a[y, :, :3] = cols[k]
        for j, c in enumerate(cuts):                     # 경계 디더: 위 띠 쪽 dither 줄에 아래 색 체크
            if c - dither <= y < c and dither:
                xs = np.arange(W)
                m = ((xs + y) % 2 == 0) if (c - y) == 1 else ((xs % 4 == (y % 2) * 2))
                a[y, m, :3] = cols[j + 1]
    img.paste(Image.fromarray(a, 'RGBA'))
    return img


def paste(img, part, x, ybot, flip=False):
    """part 를 왼쪽 x, 아래 ybot 에 맞춰 덧그린다(알파 합성)."""
    if flip: part = part.transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(part, (int(x), int(ybot - part.height)))
    return part.size


def haze(part, col, t):
    """먼 물체: 색을 하늘(공기) 쪽으로 t 만큼 섞는다(알파는 그대로). 같은 물체를 원경에 쓸 때."""
    a = np.array(part.convert('RGBA')).astype(np.float32)
    a[..., :3] = a[..., :3] * (1 - t) + np.array(col, np.float32) * t
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def tile_floor(img, y0, y1, fn, ox=0, oy=0, x0=0, x1=W):
    """바닥 텍스처 함수 fn(X,Y)->(r,g,b) 로 y0..y1 를 칠한다(타일 좌표는 ox,oy 만큼 밀어 맞춤)."""
    p = img.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            c = fn(x + ox, y - y0 + oy)
            p[x, y] = tuple(c[:3]) + (255,)
    return img


def tile_image(img, tile, y0, y1, x0=0, x1=W, ox=0, oy=0):
    """작은 표본 그림(예: 48×48 바닥 표본)을 이어 붙여 칠한다."""
    tw, th = tile.size; t = tile.convert('RGBA')
    for y in range(y0 - ((oy) % th), y1, th):
        for x in range(x0 - (ox % tw), x1, tw):
            _clip_paste(img, t, x, y, x0, y0, x1, y1)
    return img


def _clip_paste(img, t, x, y, x0, y0, x1, y1):
    cx0, cy0 = max(x, x0, 0), max(y, y0, 0); cx1, cy1 = min(x + t.width, x1, W), min(y + t.height, y1, H)
    if cx1 <= cx0 or cy1 <= cy0: return
    img.alpha_composite(t.crop((cx0 - x, cy0 - y, cx1 - x, cy1 - y)), (cx0, cy0))


def shade_rows(img, y0, y1, k):
    """y0..y1 줄을 k 배 어둡게(가장자리 그늘·HUD 밑)."""
    a = np.array(img).astype(np.float32)
    a[y0:y1, :, :3] *= k
    img.paste(Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA'))


def finish(img, path, ncol=96):
    """불투명·색 ≤ ncol 로 맞춰 저장. 색이 넘치면 디더 없이 줄인다."""
    rgb = img.convert('RGB')
    n = len(rgb.getcolors(1 << 20) or [])
    if n > ncol:
        rgb = rgb.quantize(colors=ncol, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    rgb.save(path)
    chk = Image.open(path)
    assert chk.size == (W, H), chk.size
    assert chk.mode == 'RGB'
    m = len(chk.getcolors(1 << 20))
    assert m <= ncol, m
    return n, m
