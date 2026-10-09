"""확장 아이콘 v2 — 원본 아이콘 모듈을 잘라 늘리고, 좌표로 직접 찍어 붙이는 도구.

원본(public/assets/easyrpg-chipset-world.png, EasyRPG RTP World, CC BY 4.0)의 픽셀을 모듈 단위로 재배열한다.
색은 원본에 있는 것만 쓴다(새 색을 넣으면 사유를 EXT-STYLE.md 에 기록). 생성 모델·트레이싱 없음.
"""
import numpy as np
from PIL import Image
from pathlib import Path
from wm_lib import PINK, mute_pixel

HERE = Path(__file__).resolve().parent
ORIG = np.array(Image.open(HERE / '../../../public/assets/easyrpg-chipset-world.png').convert('RGB'), dtype=np.uint8)
PINKA = np.array(PINK, dtype=np.uint8)
OL = (0x11, 0x16, 0x18)


def crop(x0, y0, x1, y1):
    """원본 절대 픽셀 [x0,x1) x [y0,y1) 잘라내기."""
    return ORIG[y0:y1, x0:x1].copy()


def blank(w, h):
    a = np.empty((h, w, 3), dtype=np.uint8)
    a[:] = PINKA
    return a


def is_key(a):
    return (a == PINKA).all(axis=-1)


def vstretch(a, b0, b1, k):
    """행 [b0,b1) 띠를 k번 더 끼워 넣는다(세로로 늘림)."""
    band = a[b0:b1]
    return np.concatenate([a[:b1]] + [band] * k + [a[b1:]], axis=0)


def hstretch(a, b0, b1, k):
    band = a[:, b0:b1]
    return np.concatenate([a[:, :b1]] + [band] * k + [a[:, b1:]], axis=1)


def paste(dst, src, x, y, over=True):
    """src 를 dst 의 (x,y) 에 붙인다. 분홍은 투명."""
    h, w = src.shape[:2]
    m = ~is_key(src)
    sub = dst[y:y + h, x:x + w]
    sub[m] = src[m]


def px(dst, x, y, rgb):
    if 0 <= y < dst.shape[0] and 0 <= x < dst.shape[1]:
        dst[y, x] = rgb


def rect(dst, x0, y0, x1, y1, rgb):
    dst[y0:y1 + 1, x0:x1 + 1] = rgb


def hexc(s):
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def mute(a):
    out = a.copy()
    cache = {}
    h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            c = tuple(int(v) for v in a[y, x])
            if c not in cache:
                cache[c] = mute_pixel(c)
            out[y, x] = cache[c]
    return out


def save(a, path, scale=1):
    im = Image.fromarray(a)
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)
