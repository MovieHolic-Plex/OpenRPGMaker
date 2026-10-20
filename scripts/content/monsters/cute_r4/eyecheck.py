"""Python port of checks/eyeTable.ts V0-V5,V7 (early feedback while drawing; the TS check stays authoritative)."""
from __future__ import annotations

import math

import numpy as np


def _lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def oklab(r, g, b):
    lr, lg, lb = _lin(r), _lin(g), _lin(b)
    l = (0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb) ** (1 / 3)
    m = (0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb) ** (1 / 3)
    s = (0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb) ** (1 / 3)
    return (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s)


def check(img: np.ndarray, e: dict) -> list[str]:
    H, W = img.shape[:2]
    op = lambda x, y: 0 <= x < W and 0 <= y < H and img[y, x, 3] > 0
    L = lambda x, y: oklab(*img[y, x, :3].tolist())[0]
    boxes = [("near", e["near"])] + ([("second", e["second"])] if e.get("second") else []) + ([("far", e["far"])] if e.get("far") else [])
    inb = lambda b, x, y, p=0: b[0] - p <= x < b[0] + b[2] + p and b[1] - p <= y < b[1] + b[3] + p
    out = []
    stalk = e["anatomy"] == "stalk"
    for role, b in boxes:
        dark = hl = tot = 0
        dsum = 0.0
        for y in range(b[1], b[1] + b[3]):
            for x in range(b[0], b[0] + b[2]):
                if not op(x, y):
                    continue
                tot += 1
                lab = oklab(*img[y, x, :3].tolist())
                if lab[0] < 0.4:
                    dark += 1
                    dsum += lab[0]
                elif lab[0] >= 0.85 and math.hypot(lab[1], lab[2]) <= 0.06:
                    hl += 1
        mind = 2 if role == "far" else math.ceil(b[2] * b[3] * 0.35)
        if hl < 1 or dark < mind:
            out.append(f"V0 {role} dark {dark}/{mind} hl {hl}")
        ring = [(x, y) for y in range(b[1] - 1, b[1] + b[3] + 1) for x in range(b[0] - 1, b[0] + b[2] + 1) if not any(inb(bb, x, y) for _, bb in boxes)]
        if not stalk:
            air = sum(1 for x, y in ring if not op(x, y)) + (b[2] * b[3] - tot)
            if air:
                out.append(f"V1 {role} air {air}")
            dr = sum(1 for x, y in ring if op(x, y) and L(x, y) < 0.4)
            if ring and dr / len(ring) > 0.3:
                out.append(f"V2 {role} ring dark {dr}/{len(ring)}")
        skin = sorted(L(x, y) for x, y in ring if op(x, y))
        con = (skin[len(skin) // 2] if skin else 0) - (dsum / dark if dark else 1)
        if role != "far" and con < 0.3:
            out.append(f"V3 {role} contrast {con:.2f}")
    if not stalk and e.get("far") and e["anatomy"] == "threequarter":
        n, f = e["near"], e["far"]
        gap = n[0] - (f[0] + f[2])
        if gap < 1 or gap > 8:
            out.append(f"V4 gap {gap}")
        if f[2] * f[3] > n[2] * n[3]:
            out.append("V4 far bigger")
        if abs(f[1] + f[3] / 2 - (n[1] + n[3] / 2)) > 2:
            out.append("V4 height")
    if e["anatomy"] == "frontal":
        n, s2 = e["near"], e["second"]
        if abs(s2[2] * s2[3] - n[2] * n[3]) > max(n[2] * n[3], s2[2] * s2[3]) * 0.35 or abs(s2[1] - n[1]) > 1:
            out.append("V4 frontal size/height")
    isdark = lambda x, y: op(x, y) and L(x, y) < 0.4
    def edge(x, y):
        return op(x, y) and any(not op(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    stack = [(x, y) for _, b in boxes for y in range(b[1], b[1] + b[3]) for x in range(b[0], b[0] + b[2]) if isdark(x, y)]
    seen, left = set(), 0
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen or any(inb(b, nx, ny) for _, b in boxes) or not any(inb(b, nx, ny, 2) for _, b in boxes):
                continue
            if not isdark(nx, ny) or edge(nx, ny):
                continue
            seen.add((nx, ny))
            left += 1
            stack.append((nx, ny))
    if left > 3:
        out.append(f"V5 leftover {left}")
    if e["style"] == "round":
        x, y, _, h = e["near"]
        if h < 6 or L(x, y) < 0.4:
            out.append("V7 round template")
    return out
