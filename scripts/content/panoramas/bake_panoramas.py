#!/usr/bin/env python3
"""OPRN 자체 맵 배경(파노라마) 견본을 코드로 찍는다 — 제3자 그림 없음.

사용: python3 scripts/content/panoramas/bake_panoramas.py [--out public/assets/panoramas]

세트와 층(아래→위)은 src/assets/oprnPanoramas.ts 와 이름이 같아야 한다. 그림을 바꾸면 이 스크립트를
다시 돌리고 PNG 를 같이 커밋한다(결정적이다 — 같은 시드면 같은 바이트).

규격
- 지평선 세트(맑은 하늘·노을): 640×240. 게임 논리 화면 320×240 에 cover 로 깔면 배율 1 이라 도트가 그대로다.
  가로는 이음매 없이 반복된다(구름은 감싸 그린다).
- 평면 세트(밤하늘·바다·구름 바다): 가로·세로 모두 이음매 없이 반복된다. native(1:1) 로 깐다.
- 색은 세트마다 작은 팔레트로 묶고, 그라데이션은 4×4 Bayer 디더로 띠를 나눈다.
"""
from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32) / 16.0


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def dither_gradient(width: int, height: int, stops: list[str], y0: int = 0, y1: int | None = None) -> np.ndarray:
    """세로 그라데이션을 팔레트 색 띠 + Bayer 디더로. 색은 stops 에 있는 것만 쓴다."""
    y1 = height if y1 is None else y1
    colors = np.array([hex_rgb(c) for c in stops], dtype=np.uint8)
    out = np.zeros((height, width, 3), dtype=np.uint8)
    span = max(1, y1 - y0)
    for y in range(height):
        t = min(1.0, max(0.0, (y - y0) / span)) * (len(stops) - 1)
        base = int(math.floor(t))
        frac = t - base
        row_threshold = BAYER4[y % 4]
        for x in range(width):
            pick = base + (1 if frac > row_threshold[x % 4] and base + 1 < len(stops) else 0)
            out[y, x] = colors[min(pick, len(stops) - 1)]
    return out


def periodic_noise(width: int, height: int, cell: int, seed: int, octaves: int = 3) -> np.ndarray:
    """가로·세로로 이음매 없이 반복되는 값 잡음(0..1). cell 은 width·height 를 나눠야 한다."""
    rng = np.random.default_rng(seed)
    total = np.zeros((height, width), dtype=np.float64)
    amp, norm = 1.0, 0.0
    size = cell
    for _ in range(octaves):
        gx, gy = max(1, width // size), max(1, height // size)
        lattice = rng.random((gy, gx))
        ys = (np.arange(height) / size)
        xs = (np.arange(width) / size)
        y0 = np.floor(ys).astype(int) % gy
        x0 = np.floor(xs).astype(int) % gx
        y1 = (y0 + 1) % gy
        x1 = (x0 + 1) % gx
        ty = ys - np.floor(ys)
        tx = xs - np.floor(xs)
        sy = (ty * ty * (3 - 2 * ty))[:, None]
        sx = (tx * tx * (3 - 2 * tx))[None, :]
        a = lattice[y0][:, x0]
        b = lattice[y0][:, x1]
        c = lattice[y1][:, x0]
        d = lattice[y1][:, x1]
        total += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy)
        norm += amp
        amp *= 0.5
        size = max(2, size // 2)
    return total / norm


def quantize(values: np.ndarray, palette: list[str], thresholds: list[float], dither: float = 0.0) -> np.ndarray:
    """값(0..1)을 문턱으로 나눠 팔레트 색으로. dither>0 이면 문턱 근처를 Bayer 로 섞는다."""
    h, w = values.shape
    bayer = np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    jitter = (bayer - 0.5) * dither
    v = values + jitter
    idx = np.zeros((h, w), dtype=int)
    for t in thresholds:
        idx += (v > t).astype(int)
    colors = np.array([hex_rgb(c) for c in palette], dtype=np.uint8)
    return colors[np.clip(idx, 0, len(palette) - 1)]


def blank_rgba(width: int, height: int) -> np.ndarray:
    return np.zeros((height, width, 4), dtype=np.uint8)


def put(img: np.ndarray, x: int, y: int, rgb: tuple[int, int, int], alpha: int = 255, wrap_y: bool = False) -> None:
    h, w = img.shape[:2]
    x %= w
    if wrap_y:
        y %= h
    if 0 <= y < h:
        img[y, x, :3] = rgb
        img[y, x, 3] = alpha


def cloud_blob(img: np.ndarray, cx: int, cy: int, width: int, height: int, rng: random.Random,
               light: str, mid: str, shade: str, wrap_y: bool = False) -> None:
    """뭉게구름 한 덩이. 위는 밝게, 아래 2줄은 그늘. 가로는 감싸 그려 반복 이음매가 없다."""
    lobes = []
    count = max(3, width // 14)
    for i in range(count):
        t = (i + 0.5) / count
        lx = cx - width // 2 + int(t * width)
        r = int(height * (0.45 + 0.55 * math.sin(math.pi * t)) * rng.uniform(0.75, 1.0))
        lobes.append((lx, cy - r // 3, max(3, r)))
    base_y = cy + height // 3
    mask = set()
    for (lx, ly, r) in lobes:
        for dy in range(-r, r + 1):
            for dx in range(-r - 2, r + 3):
                if (dx * dx) / ((r + 2) ** 2) + (dy * dy) / (r * r) <= 1.0 and ly + dy <= base_y:
                    mask.add((lx + dx, ly + dy))
    for x in range(cx - width // 2 - 4, cx + width // 2 + 5):
        for y in range(base_y - 2, base_y + 1):
            if any(abs(x - lx) <= r + 2 for (lx, _, r) in lobes):
                mask.add((x, y))
    lc, mc, sc = hex_rgb(light), hex_rgb(mid), hex_rgb(shade)
    for (x, y) in mask:
        above = (x, y - 1) in mask
        above2 = (x, y - 2) in mask
        below2 = (x, y + 2) in mask
        if not above or not above2:
            color = lc
        elif not below2:
            color = sc
        else:
            color = mc
        put(img, x, y, color, wrap_y=wrap_y)


def save(arr: np.ndarray, path: Path) -> None:
    mode = "RGBA" if arr.shape[2] == 4 else "RGB"
    Image.fromarray(arr, mode).save(path, optimize=True)
    print(f"wrote {path} {arr.shape[1]}x{arr.shape[0]}")


# ── 세트 1: 맑은 하늘 (지평선, 640×240) ──
def sky_day(out: Path) -> None:
    w, h = 640, 240
    base = dither_gradient(w, h, ["#2f6ad0", "#3f80dc", "#5598e6", "#6cb0ee", "#8cc8f4", "#b4def8"], 0, h - 20)
    save(base, out / "oprn-pano-sky-day.png")
    rng = random.Random(11)
    far = blank_rgba(w, h)
    for i in range(9):
        cloud_blob(far, rng.randrange(w), rng.randrange(84, 124), rng.randrange(36, 70), rng.randrange(10, 15), rng,
                   "#f4fbff", "#dcecf8", "#b8d2ea")
    save(far, out / "oprn-pano-sky-day-clouds-far.png")
    near = blank_rgba(w, h)
    for i in range(5):
        cloud_blob(near, int((i + rng.uniform(0.1, 0.6)) * w / 5), rng.randrange(48, 88), rng.randrange(70, 120),
                   rng.randrange(24, 34), rng, "#ffffff", "#eef5fc", "#c4d8ee")
    save(near, out / "oprn-pano-sky-day-clouds-near.png")


# ── 세트 1b: 맑은 하늘 + 낮 도시 (옥상·높은 층 창밖) ──
# 옥상 둘레가 하늘뿐이면 옥상이 공중에 뜬 상자로 읽혔다(첫사랑 VQA r22). 낮 공기 원근(멀수록 하늘색에 묻힘)으로
# 먼 빌딩 줄과 가까운 빌딩 줄 두 겹을 그린다. 바닥선은 그림 아래쪽(y≈200) — 맵 가운데(옥상 바닥)는 가리고
# 옆 빈 칸과 난간 위로 높은 빌딩 머리가 보인다.
def city_block(img: np.ndarray, rng: random.Random, ground: int, hmin: int, hmax: int,
               body: str, shade: str, win: str, roof_line: str) -> None:
    w = img.shape[1]
    x = rng.randrange(0, 8)
    while x < w:
        bw = rng.randrange(18, 46)
        bh = rng.randrange(hmin, hmax)
        top = ground - bh
        for dx in range(bw):
            for y in range(top, ground):
                put(img, x + dx, y, hex_rgb(shade if dx >= bw - max(3, bw // 6) else body))
            put(img, x + dx, top, hex_rgb(roof_line))
        # 창 줄(낮이라 불은 없다 — 하늘을 비추는 밝은 유리)
        for wy in range(top + 4, ground - 3, 5):
            for wx in range(x + 3, x + bw - max(4, bw // 6), 4):
                put(img, wx, wy, hex_rgb(win))
                put(img, wx + 1, wy, hex_rgb(win))
        if rng.random() < 0.35:  # 옥상 물탱크·안테나
            ax = x + rng.randrange(3, max(4, bw - 4))
            for y in range(top - rng.randrange(4, 9), top):
                put(img, ax, y, hex_rgb(roof_line))
        x += bw + rng.randrange(1, 6)


def sky_day_city(out: Path) -> None:
    w, h = 640, 240
    rng = random.Random(23)
    far = blank_rgba(w, h)
    city_block(far, rng, 214, 70, 150, "#a9c4e2", "#98b5d6", "#c7dcf2", "#8eaacb")
    save(far, out / "oprn-pano-sky-day-city-far.png")
    near = blank_rgba(w, h)
    city_block(near, rng, 236, 40, 110, "#7f98b8", "#6c84a4", "#b4cbe6", "#5e7696")
    save(near, out / "oprn-pano-sky-day-city-near.png")


# ── 세트 2: 노을 (지평선, 640×240) ──
# 지평선을 y=HORIZON(화면 위쪽 절반)에 둔다. 배경은 화면에 고정되므로, 지붕·절벽 위로 윗줄 몇 칸만 비워도
# 해와 실루엣이 보여야 한다(2026-10-21: 해가 맨 아래에 있으면 윗줄을 비워도 어두운 보라만 보였다).
# 지평선 아래는 노을을 비추는 물(먼 바다) — 맵을 더 비우면 수면이 이어진다.
HORIZON = 112


def sunset(out: Path) -> None:
    w, h = 640, 240
    sky = dither_gradient(w, HORIZON, ["#241a4a", "#3a2160", "#5e2a6e", "#8e3570", "#c44c62", "#e8704e", "#f79a44", "#ffc35c", "#ffdf8a"], 0, HORIZON - 2)
    water = dither_gradient(w, h - HORIZON, ["#e07a52", "#9a3e64", "#5e2a6e", "#3a2160", "#241a4a", "#1a1238"], 0, h - HORIZON)
    base = np.concatenate([sky, water], axis=0)
    # 화면에 맞춤은 넘치는 가로를 가운데 맞춘다(640 그림 → 320 화면이면 x 160..480 이 첫 화면). 해는 그 안 왼쪽.
    sun_x, sun_y = 374, HORIZON - 8
    for y in range(HORIZON):
        for x in range(w):
            d = math.hypot(x - sun_x, (y - sun_y) * 1.05)
            if d <= 18:
                base[y, x] = hex_rgb("#fff4c4")
            elif d <= 22:
                base[y, x] = hex_rgb("#ffe39a")
            elif d <= 30 and (x + y) % 2 == 0:
                base[y, x] = hex_rgb("#ffd27a")
    # 수면의 해 그림자 — 지평선에서 아래로 가며 짧아지고 흩어지는 가로 줄.
    rng = random.Random(41)
    for y in range(HORIZON + 1, h, 2):
        depth = (y - HORIZON) / (h - HORIZON)
        half = int(24 * (1 - depth) + 6)
        for _ in range(3):
            x0 = sun_x + rng.randrange(-half, half)
            length = rng.randrange(4, 12)
            color = hex_rgb("#ffe39a" if depth < 0.25 else "#f79a44" if depth < 0.6 else "#c44c62")
            for t in range(length):
                base[y, (x0 + t) % w] = color
    save(base, out / "oprn-pano-sunset.png")
    rng = random.Random(23)
    streaks = blank_rgba(w, h)
    for i in range(14):
        y = rng.randrange(14, HORIZON - 22)
        length = rng.randrange(40, 130)
        x0 = rng.randrange(w)
        thick = rng.choice([1, 2, 2, 3])
        dark = "#4a2058" if y < 50 else "#7a3060"
        rim = "#ff9a6a" if y > 50 else "#d86a8a"
        for t in range(length):
            taper = min(t, length - 1 - t)
            rows = thick if taper > 6 else max(1, thick - 1)
            for r in range(rows):
                put(streaks, x0 + t, y + r, hex_rgb(dark))
            if taper > 3:
                put(streaks, x0 + t, y + rows, hex_rgb(rim))
    save(streaks, out / "oprn-pano-sunset-clouds.png")
    skyline = blank_rgba(w, h)
    rng = random.Random(5)
    x = 0
    sil = hex_rgb("#2a1638")
    lit = hex_rgb("#ffcf70")
    ground = HORIZON + 2
    while x < w:
        bw = rng.randrange(14, 34)
        bh = rng.randrange(10, 40)
        roof = rng.choice(["flat", "flat", "gable", "tower"])
        if abs(x + bw // 2 - sun_x) < 34:
            bh = min(bh, 12)  # 해 앞은 낮게 — 해가 가려지지 않게
        for dx in range(bw):
            top = ground - bh
            if roof == "gable":
                top += abs(dx - bw // 2) // 2
            if roof == "tower" and bw // 2 - 2 <= dx <= bw // 2 + 1:
                top -= 8
            for y in range(top, ground):
                put(skyline, x + dx, y, sil)
        for wy in range(ground - bh + 5, ground - 3, 5):
            for wx in range(x + 3, x + bw - 3, 5):
                if rng.random() < 0.28:
                    put(skyline, wx, wy, lit)
                    put(skyline, wx + 1, wy, lit)
        x += bw + rng.randrange(0, 4)
    save(skyline, out / "oprn-pano-sunset-skyline.png")


# ── 세트 3: 밤하늘·별 (평면 반복, 320×256) ──
def night_stars(out: Path) -> None:
    w, h = 320, 256
    n = periodic_noise(w, h, 64, seed=7, octaves=4)
    base = quantize(n, ["#0a0c22", "#0f1230", "#16183e", "#22204e", "#33285e"], [0.42, 0.55, 0.66, 0.76], dither=0.08)
    save(base, out / "oprn-pano-night.png")
    rng = random.Random(31)
    far = blank_rgba(w, h)
    for _ in range(170):
        put(far, rng.randrange(w), rng.randrange(h), hex_rgb(rng.choice(["#6f7aa8", "#8a92c0", "#a6acd4"])), wrap_y=True)
    save(far, out / "oprn-pano-night-stars-far.png")
    near = blank_rgba(w, h)
    for _ in range(46):
        x, y = rng.randrange(w), rng.randrange(h)
        put(near, x, y, hex_rgb(rng.choice(["#ffffff", "#fff4c8", "#cfe4ff"])), wrap_y=True)
    for _ in range(9):
        x, y = rng.randrange(w), rng.randrange(h)
        core, arm = hex_rgb("#ffffff"), hex_rgb("#9fb8ff")
        put(near, x, y, core, wrap_y=True)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            put(near, x + dx, y + dy, arm, wrap_y=True)
    save(near, out / "oprn-pano-night-stars-near.png")


# ── 세트 4: 바다 (위에서 본 수면, 평면 반복 256×256) ──
def sea(out: Path) -> None:
    w, h = 256, 256
    n = periodic_noise(w, h, 64, seed=3, octaves=4)
    base = quantize(n, ["#14407a", "#1a4f8e", "#2062a4", "#2a74b6"], [0.40, 0.52, 0.64], dither=0.10)
    save(base, out / "oprn-pano-sea.png")
    rng = random.Random(17)
    waves = blank_rgba(w, h)
    for _ in range(70):
        x, y = rng.randrange(w), rng.randrange(h)
        length = rng.randrange(3, 9)
        for t in range(length):
            bump = 0 if t in (0, length - 1) else -1 if length > 4 and t in (length // 2,) else 0
            put(waves, x + t, y + bump, hex_rgb("#7cc4ec"), wrap_y=True)
        put(waves, x + length // 2, y - 1 if length > 4 else y, hex_rgb("#d6f2ff"), wrap_y=True)
    save(waves, out / "oprn-pano-sea-waves.png")


# ── 세트 5: 구름 바다 (위에서 본 구름, 평면 반복 320×256) ──
def cloud_sea(out: Path) -> None:
    w, h = 320, 256
    n = periodic_noise(w, h, 64, seed=41, octaves=4)
    base = quantize(n, ["#7fb6e6", "#a8cdef", "#cfe3f6", "#eaf3fb", "#ffffff"], [0.36, 0.47, 0.57, 0.68], dither=0.06)
    save(base, out / "oprn-pano-clouds.png")
    rng = random.Random(29)
    puffs = blank_rgba(w, h)
    for _ in range(6):
        cloud_blob(puffs, rng.randrange(w), rng.randrange(20, h - 10), rng.randrange(40, 80), rng.randrange(9, 15), rng,
                   "#ffffff", "#f2f7fc", "#c8dcf0", wrap_y=True)
    save(puffs, out / "oprn-pano-clouds-near.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="public/assets/panoramas")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    sky_day(out)
    sky_day_city(out)
    sunset(out)
    night_stars(out)
    sea(out)
    cloud_sea(out)


if __name__ == "__main__":
    main()
