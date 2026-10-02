import sys, importlib, json
from pathlib import Path
import numpy as np
from PIL import Image
SD = Path('/home/main/z-project/rpg-zzu-worldmap-icon-harness/tiledata/worldmap-kit/iconsets/desert-east')
KEY = np.array([255, 103, 139], np.uint8); SHD = np.array([254, 103, 139], np.uint8)

def load(kx=0.0, ky=.5, light='orig'):
    for m in ('oblique', 'east', 'scenes_a', 'scenes_b', 'icons_v9_lib', 'show'):
        sys.modules.pop(m, None)
    if str(SD / 'lib') not in sys.path: sys.path.insert(0, str(SD / 'lib'))
    ob = importlib.import_module('oblique')
    ob.KX, ob.KY = kx, ky
    ob.D_VIEW = np.array([-kx, 1.0, -ky])
    if light == 'front':
        L = np.array([0, -.35, .8]); ob.LIGHT = L / np.linalg.norm(L); ob.D_SUN = np.array([0, .55, 1.0])
    E = importlib.import_module('east')
    A = importlib.import_module('scenes_a'); B = importlib.import_module('scenes_b')
    return ob, E, A, B

def fit(ob, s, W, H, bottom=1):
    """큰 캔버스에 찍고 내용 상자를 W×H 칸 가운데·아래에 앉힌다(카메라가 바뀌어도 칸에 맞춘다)."""
    P = 40
    arr, _ = ob.render(s, W + 2 * P, H + 2 * P, ox=P, oy=P + H)
    arr = ob.finish(arr)
    k = (arr == KEY).all(2)
    ys, xs = np.nonzero(~k)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    w, h = x1 - x0, y1 - y0
    out = np.empty((H, W, 3), np.uint8); out[:] = KEY
    if w > W or h > H - bottom + 1:
        print('  !! 넘침', w, h, '>', W, H)
    w2, h2 = min(w, W), min(h, H)
    dx = (W - w2) // 2; dy = H - bottom - h2 + 1 if h2 <= H - bottom else 0
    out[dy:dy + h2, dx:dx + w2] = arr[y1 - h2:y1, x0 + (w - w2) // 2:x0 + (w - w2) // 2 + w2]
    return out, (int(w), int(h))
