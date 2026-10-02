"""장면 공통: 아이콘 등록, 큰 캔버스에 그린 뒤 칸에 앉히기(done), 맞춤 보고(FIT)."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import numpy as np
import oblique as ob
from oblique import render, finish

ICONS = {}
CUR = ['?']
FIT = {}
SOFT = [False]


def icon(name):
    def deco(fn):
        def run():
            CUR[0] = name
            return fn()
        run.__name__ = fn.__name__
        ICONS[name] = run
        return fn
    return deco


def done(s, W, H, *_ignored, name=None, bottom=1, halign='center'):
    """큰 캔버스에 그린 뒤 내용 상자를 W x H 칸에 가운데·아래 정렬로 앉힌다. 안 들어가면 실패 — 설계를 줄인다."""
    PAD = 48
    arr, st = render(s, W + 2 * PAD, H + 2 * PAD, ox=PAD, oy=PAD + H)
    arr = finish(arr)
    key = np.all(arr == np.array(ob.KEY, np.uint8), -1)
    ys, xs = np.nonzero(~key)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    w, h = x1 - x0, y1 - y0
    slack = (int(W - w), int(H - bottom - h))
    name = name or CUR[0]
    FIT[name] = (int(w), int(h), slack)
    if (w > W or h > H - bottom) and not SOFT[0]:
        raise ValueError(f'{name}: 내용 {w}x{h} 가 {W}x{H} 칸에 안 들어간다 (slack {slack})')
    if w > W or h > H - bottom:                       # SOFT 미리보기: 칸을 늘려서라도 보여 준다
        W, H = max(W, -(-w // 16) * 16), max(H, -(-(h + bottom) // 16) * 16)
    out = np.zeros((H, W, 3), np.uint8)
    out[:] = ob.KEY
    dx = (W - w) // 2 if halign == 'center' else 0
    dy = H - bottom - h
    out[dy:dy + h, dx:dx + w] = arr[y0:y1, x0:x1]
    return out, st
