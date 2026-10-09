"""on_ground / 확대 / 시트 — 확인용."""
import numpy as np
from PIL import Image, ImageDraw

SHADOW_MUL = np.array([.64, .70, .82])
KEYC = np.array([255, 103, 139], np.uint8)
SHC = np.array([254, 103, 139], np.uint8)


def on_ground(arr, ground=(90, 160, 70)):
    h, w = arr.shape[:2]
    g = np.zeros((h, w, 3), np.uint8)
    g[:] = ground
    key = np.all(arr == KEYC, -1)
    shd = np.all(arr == SHC, -1)
    out = g.copy()
    out[shd] = (g[shd] * SHADOW_MUL).astype(np.uint8)
    out[~key & ~shd] = arr[~key & ~shd]
    return out


def zoom(a, z):
    return Image.fromarray(a).resize((a.shape[1] * z, a.shape[0] * z), Image.NEAREST)
