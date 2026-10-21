"""EasyRPG RTP pixel matcher, used as an attribution check (not a blocker).

The fingerprint (`fingerprint.bin`) holds only 64-bit hashes of 8x8 pixel windows taken from the upstream
EasyRPG RTP ChipSet sheets (https://github.com/EasyRPG/RTP, pinned commit below), at a 4px stride in all four
flips. No upstream image is stored in this repository. `build_fingerprint.py` regenerates it from a fresh
download into a temporary directory.

A target sheet is scanned at every 1px offset. A 16px cell counts as RTP-derived when at least 32 of its opaque
pixels are covered by matching windows. Exact copies (including flips) are found; recoloured or redrawn
derivatives are not.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
FINGERPRINT = HERE / 'fingerprint.bin'
RTP_COMMIT = '993d88cbc78c658d348bbfa74a3b424d393d27e5'
RTP_SHEETS = ['Dungeon', 'Exterior', 'Interior', 'Ship', 'World', 'retro_Dungeon', 'retro_Exterior', 'retro_World']
W = 8
STRIDE = 4
MAGIC = b'OPRNRTP1'


def _splitmix(seed: int, n: int) -> list[int]:
    out, x = [], seed & (2**64 - 1)
    for _ in range(n):
        x = (x + 0x9E3779B97F4A7C15) & (2**64 - 1)
        z = x
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & (2**64 - 1)
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & (2**64 - 1)
        out.append((z ^ (z >> 31)) | 1)
    return out


KEYS = np.array(_splitmix(0x0A7B_2026_1022, W * W), dtype=np.uint64).reshape(W, W)
SENTINEL = np.uint64(1 << 40)


def load_rgba(path) -> np.ndarray:
    im = Image.open(path)
    if getattr(im, 'n_frames', 1) > 1:
        im.seek(0)
    if im.mode == 'P' and 'transparency' not in im.info and Path(str(path)).name in {f'{s}.png' for s in RTP_SHEETS}:
        idx = np.array(im)
        rgba = np.array(im.convert('RGBA'))
        rgba[idx == 0, 3] = 0          # RPG Maker 2000 chipsets: palette index 0 is the transparent key
        return rgba
    return np.array(im.convert('RGBA'))


def window_hashes(rgba: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(hashes[h,w], opaque mask) for every 8x8 window."""
    a = rgba.astype(np.uint64)
    codes = (a[..., 0] << np.uint64(16)) | (a[..., 1] << np.uint64(8)) | a[..., 2]
    op = rgba[..., 3] >= 128
    codes = np.where(op, codes, SENTINEL)
    H, Wd = codes.shape
    h, w = H - W + 1, Wd - W + 1
    out = np.zeros((max(h, 0), max(w, 0)), np.uint64)
    if h <= 0 or w <= 0:
        return out, op
    with np.errstate(over='ignore'):
        for i in range(W):
            for j in range(W):
                out += codes[i:i + h, j:j + w] * KEYS[i, j]
    return out, op


def read_fingerprint(path: Path = FINGERPRINT) -> tuple[np.ndarray, np.ndarray, list[str]]:
    raw = path.read_bytes()
    assert raw[:8] == MAGIC, 'bad fingerprint file'
    (hlen,) = struct.unpack('<I', raw[8:12])
    header = json.loads(raw[12:12 + hlen])
    n = header['count']
    off = 12 + hlen
    hashes = np.frombuffer(raw, dtype='<u8', count=n, offset=off).astype(np.uint64)
    src = np.frombuffer(raw, dtype=np.uint8, count=n, offset=off + 8 * n)
    return hashes, src, header['sheets']


_FP = None


def scan(path, tile: int = 16) -> dict:
    """Cells of `path` that contain exact EasyRPG RTP pixels: {'cells': [...], 'sheets': {upstream: n}}."""
    global _FP
    if _FP is None:
        _FP = read_fingerprint()
    keys, src, names = _FP
    rgba = load_rgba(path)
    ex, op = window_hashes(rgba)
    if ex.size == 0:
        return {'cells': [], 'sheets': {}}
    i = np.clip(np.searchsorted(keys, ex), 0, len(keys) - 1)
    hit = keys[i] == ex
    cov = np.zeros(op.shape, bool)
    ys, xs = np.nonzero(hit)
    for y, x in zip(ys, xs):
        cov[y:y + W, x:x + W] = True
    cov &= op
    per = rgba.shape[1] // tile
    rows = rgba.shape[0] // tile
    per_cell = cov[:rows * tile, :per * tile].reshape(rows, tile, per, tile).sum((1, 3)).ravel()
    cells = [int(c) for c in np.nonzero(per_cell >= 32)[0]]
    sheets: dict[str, int] = {}
    cellset = set(cells)
    seen = set()
    for y, x in zip(ys, xs):
        c = ((y + 4) // tile) * per + (x + 4) // tile
        if c in cellset and c not in seen:
            seen.add(c)
            nm = names[int(src[i[y, x]])]
            sheets[nm] = sheets.get(nm, 0) + 1
    return {'cells': cells, 'sheets': sheets}
