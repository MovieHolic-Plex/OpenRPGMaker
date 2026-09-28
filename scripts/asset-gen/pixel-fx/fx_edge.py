"""Opt-in edge fade for pixel-fx cells (retro2003 QA, 2026-09-28).

A layer that reaches its cell border shows a straight cut line on stage; screen layers
(128px cell, 256px box) then reveal a square in the middle of the battle. Call
fade_edges(cell, T=.., B=.., L=.., R=..) at the end of draw(): on each side with a band > 0
the outermost row/column is cleared and the rest of the band thins out with a 4x4 ordered
(Bayer) dither. Pure alpha removal: no new colours, no blending, alpha stays 0/255.
Works with the three cell types: lib_hero.Cell (numpy index .a), lib_mage.Cel ('L' .im),
lib_scout.Cel (RGBA .im).
"""
import numpy as np
from PIL import Image

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])


def edge_mask(w, h, T=0, B=0, L=0, R=0):
    """True where a pixel must be cleared."""
    yy, xx = np.mgrid[0:h, 0:w]
    thr = (BAYER[yy % 4, xx % 4] + 0.5) / 16.0
    cut = np.zeros((h, w), bool)
    for band, dist in ((T, yy), (B, h - 1 - yy), (L, xx), (R, w - 1 - xx)):
        if band <= 0:
            continue
        keep = np.clip(dist / band, 0, 1)            # 0 at the border, 1 past the band
        cut |= (dist < 1) | ((dist < band) & (thr >= keep))
    return cut


def fade_edges(c, T=0, B=0, L=0, R=0, spare=()):
    """spare: (x0, y0, x1, y1) rectangles left untouched (a solid object that enters from an edge on purpose)."""
    if isinstance(getattr(c, 'a', None), np.ndarray):                    # lib_hero.Cell
        h, w = c.a.shape
        c.a[_spared(edge_mask(w, h, T, B, L, R), spare)] = 0
        return
    im = c.im
    w, h = im.size
    a = np.array(im)
    a[_spared(edge_mask(w, h, T, B, L, R), spare)] = 0                    # 'L' index or RGBA
    im.paste(Image.fromarray(a.astype(np.uint8), im.mode))


def _spared(m, spare):
    for x0, y0, x1, y1 in spare:
        m[y0:y1 + 1, x0:x1 + 1] = False
    return m
