"""음성 대조 — 예전에 사용자가 「허접」이라 한 그림을 그대로 다시 만들 수 있게 보관한다.
관문(lib/gates.py)은 이 그림들을 반드시 **불합격**시켜야 쓸 수 있다. 시트에는 들어가지 않는다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402

def _lump(im, cx, cy, rad, ramp):
    for y in range(int(cy - rad) - 1, int(cy + rad) + 2):
        for x in range(int(cx - rad) - 1, int(cx + rad) + 2):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d > rad:
                continue
            light = (-0.7 * dx - 0.7 * dy) / rad
            if d > rad - 1.1:
                c = ramp[0]
            elif light > 0.5:
                c = ramp[4] if (x + y) % 3 == 0 else ramp[3]
            elif light > 0.1:
                c = ramp[3] if (x * 2 + y) % 4 else ramp[2]
            elif light > -0.35:
                c = ramp[2]
            else:
                c = ramp[1]
            px.put(im, x, y, c)


def tree_disc(P, name: str = "x"):
    lf, tr, g = P["leaf"], P["trunk"], P["grass"]
    im = px.new(T * 2, T * 3)
    # 발밑 풀 자국
    for y in range(38, 48):
        for x in range(2, 30):
            if ((x - 16) / 14) ** 2 + ((y - 43) / 4.8) ** 2 <= 1.0:
                px.put(im, x, y, g[1] if ((x - 16) / 14) ** 2 + ((y - 43) / 4.8) ** 2 > 0.6 else g[2])
    # 줄기와 뿌리
    px.rect(im, 13, 29, 18, 42, tr[2])
    px.rect(im, 13, 29, 14, 42, tr[3])
    px.rect(im, 18, 29, 18, 42, tr[1])
    px.rect(im, 12, 40, 19, 42, tr[2])
    px.rect(im, 11, 42, 14, 43, tr[1]); px.rect(im, 17, 42, 20, 43, tr[1])
    px.rect(im, 12, 43, 19, 43, tr[0])
    # 잎 덩어리(뒤 → 앞)
    for cx, cy, rad in ((16, 10, 8), (9, 15, 7), (23, 15, 7), (16, 18, 9), (7, 23, 6), (25, 23, 6), (16, 27, 8)):
        _lump(im, cx, cy, rad, lf)
    return im


def _tier(im, cx, top, bot, half, lf):
    """삼각 한 단: 줄마다 폭이 늘고 가장자리는 톱니. 왼쪽이 밝고 오른쪽이 어둡다."""
    r = px.rng(f"tier{cx}{top}")
    for y in range(top, bot + 1):
        t = (y - top + 1) / (bot - top + 1)
        hw = int(half * t) + 1 + (1 if (y - top) % 3 == 2 else 0)
        for x in range(cx - hw, cx + hw):
            edge = x in (cx - hw, cx + hw - 1) or y == bot
            rel = (x - cx + 0.5) / max(1, hw)
            if edge:
                c = lf[0]
            elif rel < -0.45:
                c = lf[4] if r.random() < 0.3 else lf[3]
            elif rel < 0.1:
                c = lf[3] if r.random() < 0.4 else lf[2]
            elif rel < 0.6:
                c = lf[2]
            else:
                c = lf[1]
            px.put(im, x, y, c)
    for x in range(cx - half - 1, cx + half + 1):  # 단 아래 그림자선
        px.put(im, x, bot + 1, lf[0]) if (x + bot) % 2 == 0 else None


def pine_disc(P, name: str = "x"):
    lf, tr, g = P["leaf"], P["trunk"], P["grass"]
    im = px.new(T * 2, T * 3)
    for y in range(40, 48):
        for x in range(6, 26):
            if ((x - 16) / 10) ** 2 + ((y - 44) / 3.6) ** 2 <= 1.0:
                px.put(im, x, y, g[1])
    px.rect(im, 14, 37, 17, 44, tr[2]); px.rect(im, 14, 37, 14, 44, tr[3]); px.rect(im, 17, 37, 17, 44, tr[1])
    px.rect(im, 13, 43, 18, 44, tr[1])
    _tier(im, 16, 20, 40, 11, lf)
    _tier(im, 16, 11, 29, 9, lf)
    _tier(im, 16, 3, 18, 6, lf)
    return im




def gen3_tiles(root: Path):
    """젠3 평면 판의 바닥 칸(기준 없이 그려 화풍이 다르다고 판정된 것)."""
    import json
    import pokemon_overworld as po
    seed = json.loads((root / "harness-data/tileset-authoring/pokemon-overworld/seed.json").read_text())
    sh = po.build(seed)
    sheet = sh.image()
    def tile(name):
        i = sh.ids[name]
        return sheet.crop(((i % sh.cols) * T, (i // sh.cols) * T, (i % sh.cols) * T + T, (i // sh.cols) * T + T))
    return {"gen3_grass": tile("grass0"), "gen3_sand": tile("sand"), "gen3_water": tile("water_at255_f0"), "gen3_tall": tile("tall0")}


def gen3_house(P=None, root=None):
    """젠3 평면 판의 집(붉은 지붕+납작한 벽) 5×5 합성."""
    import json
    import pokemon_overworld as po
    root = root or Path(__file__).resolve().parents[4]
    seed = json.loads((root / "harness-data/tileset-authoring/pokemon-overworld/seed.json").read_text())
    sh = po.build(seed)
    sheet = sh.image()
    def tile(name):
        i = sh.ids[name]
        return sheet.crop(((i % sh.cols) * T, (i // sh.cols) * T, (i % sh.cols) * T + T, (i // sh.cols) * T + T))
    out = px.new(5 * T, 5 * T)
    rows = ["roof_red.ridge", "roof_red.body", "roof_red.eave", "wall_u", "wall_b"]
    for r, nm in enumerate(rows):
        for c in range(5):
            part = "l" if c == 0 else "r" if c == 4 else "m"
            key = f"{nm}.{part}"
            out.paste(tile(key), (c * T, r * T))
    return out
