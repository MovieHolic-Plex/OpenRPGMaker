"""포켓몬풍 야외 레시피 — 젠3 문법(잔디 벌판·키큰 풀·흙길·점프 턱·물가·울타리·둥근 나무·붉은 지붕)을 원본 도트로.

뜯은 그림·팔레트 샘플링 없음. 모든 픽셀을 좌표로 정한다. 반환은 Sheet(칸 번호 배치) 하나.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import Color, N, E, S, W, T  # noqa: E402


class Sheet:
    """16열 시트. 구역(섹션)마다 새 행에서 시작하고 이름 → 칸 번호를 등록한다."""

    def __init__(self, cols: int = 16) -> None:
        self.cols = cols
        self.tiles: list = []
        self.ids: dict[str, int] = {}
        self.anim: list[dict] = []
        self.sections: list[tuple[str, int, int]] = []

    def row_start(self) -> None:
        while len(self.tiles) % self.cols:
            self.tiles.append(None)

    def add(self, name: str, im) -> int:
        i = len(self.tiles)
        self.tiles.append(im)
        self.ids[name] = i
        return i

    def section(self, title: str):
        self.row_start()
        start = len(self.tiles)
        self.sections.append((title, start, -1))
        return start

    def end_section(self) -> None:
        title, start, _ = self.sections[-1]
        self.sections[-1] = (title, start, len(self.tiles))
        self.row_start()

    def image(self):
        rows = (len(self.tiles) + self.cols - 1) // self.cols
        out = px.new(self.cols * T, rows * T)
        for i, t in enumerate(self.tiles):
            if t is not None:
                out.paste(t, ((i % self.cols) * T, (i // self.cols) * T))
        return out


def palette(seed: dict) -> dict[str, list[Color]]:
    p = seed["palette"]
    return {k: (px.ramp(v) if isinstance(v, list) else px.hexc(v)) for k, v in p.items()}  # type: ignore[misc]


# ---- 바닥 ----------------------------------------------------------------------------------
def _blade(im, x: int, y: int, light: Color, dark: Color) -> None:
    px.put(im, x + 1, y, light)
    px.put(im, x, y + 1, dark)
    px.put(im, x + 2, y + 1, dark)
    px.put(im, x + 1, y + 2, dark)


def grass_tile(P, variant: int):
    g = P["grass"]
    im = px.new()
    px.fill(im, g[2])
    base_spots = [(2, 2), (10, 5), (5, 10), (13, 13)]
    shifted = [(4, 1), (12, 8), (1, 8), (8, 13)]
    spots = base_spots if variant in (0, 3) else shifted
    for x, y in spots:
        _blade(im, x, y, g[3], g[1])
    if variant == 2:  # 덤불 한 포기
        for dx, dy, c in ((6, 6, g[4]), (7, 6, g[4]), (5, 7, g[3]), (6, 7, g[3]), (7, 7, g[3]), (8, 7, g[3]), (6, 8, g[1]), (7, 8, g[1])):
            px.put(im, dx, dy, c)
    if variant == 3:  # 나무 그림자 받은 풀
        for y in range(T):
            for x in range(T):
                im.putpixel((x, y), px.tint(im.getpixel((x, y)), 0.78))
    return im


def flower_grass(P, kind: str):
    im = grass_tile(P, 1)
    f = P[f"flower_{kind}"]
    g = P["grass"]
    for fx, fy in ((4, 4), (11, 9)):
        px.put(im, fx, fy, f[0])
        px.put(im, fx - 1, fy, f[1] if len(f) > 1 else f[0])
        px.put(im, fx + 1, fy, f[1] if len(f) > 1 else f[0])
        px.put(im, fx, fy - 1, f[1] if len(f) > 1 else f[0])
        px.put(im, fx, fy + 1, f[1] if len(f) > 1 else f[0])
        px.put(im, fx, fy, P["flower_y"][0] if kind != "y" else P["flower_r"][0])
        px.put(im, fx, fy + 2, g[1])
    return im


def tall_grass_tile(P, variant: int):
    t = P["tall"]
    im = px.new()
    px.fill(im, t[2])
    r = px.rng(f"tall{variant}")
    # 칸 하나에 풀 무더기 네 개(2×2). 한 무더기 = 날 세 개가 모인 부채꼴
    for ox, oy in ((0, 0), (8, 0), (0, 8), (8, 8)):
        cx, cy = ox + 4, oy + 5 + (variant if ox else 0) % 2
        key = {"d": t[0], "m": t[1], "l": t[3]}
        px.stamp(im, cx - 3, cy - 3, [
            "d..d..d",
            "dm.dm.d",
            "dmddmdd" if False else "dmmdmmd",
            ".dlmlmd".replace("m", "m"),
            "..dmmd.",
        ], key)
    for _ in range(3 if variant else 2):
        px.put(im, r.randrange(T), r.randrange(T), t[1])
    return im


def flat_ground(P, which: str):
    c = P[which]
    im = px.new()
    px.fill(im, c[2])
    r = px.rng(f"flat-{which}")
    for _ in range(9):
        x, y = r.randrange(T), r.randrange(T)
        px.put(im, x, y, c[1])
        if r.random() < 0.5:
            px.put(im, (x + 1) % T, y, c[1])
    for _ in range(6):
        px.put(im, r.randrange(T), r.randrange(T), c[3])
    return im


def _grass_pixel(P, x: int, y: int) -> Color:
    return _GRASS0[(x, y)]


_GRASS0: dict[tuple[int, int], Color] = {}


AUTOTILE_PARAMS = {"dirt": ("dirt-path", 2, 3, 1), "sand": ("sand-path", 2, 3, 1), "water": ("water", 2, 3, 0)}


def autotile_masks(kind: str) -> dict:
    name, depth, radius, amp = AUTOTILE_PARAMS[kind]
    return {m: px.inside_mask(m, name, depth, radius, amp) for m in px.ALL47}


def _material_autotile(P, mask: int, name: str, base, tex_at, rim_in, rim_out, depth=2, radius=3, amp=1):
    inside = px.inside_mask(mask, name, depth, radius, amp)
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, mask)
            if inside[y][x]:
                c = tex_at(x, y)
                if not nb["n"] or not nb["w"]:
                    c = rim_in("lit", x, y, c)
                elif not nb["s"] or not nb["e"]:
                    c = rim_in("shade", x, y, c)
                im.putpixel((x, y), c)
            else:
                c = base[(x, y)]
                if nb["n"] or nb["e"] or nb["s"] or nb["w"]:
                    c = rim_out(x, y, c)
                im.putpixel((x, y), c)
    return im


def path_autotile(P, kind: str):
    ground = flat_ground(P, kind)
    c = P[kind]
    g = P["grass"]

    def tex(x, y):
        return ground.getpixel((x, y))

    def rim_in(side, x, y, col):
        return c[3] if side == "lit" else c[0]

    def rim_out(x, y, col):
        return g[1]

    return {m: _material_autotile(P, m, f"{kind}-path", _GRASS0, tex, rim_in, rim_out) for m in px.ALL47}


def water_autotile(P):
    w = P["water"]
    g = P["grass"]
    out: dict[int, list] = {}

    def frame_tex(f):
        def tex(x, y):
            col = w[1]
            for ri, ry in enumerate((2, 6, 10, 14)):
                off = (ri * 5 + f * 4) % T
                if y == ry and (x - off) % T < 4:
                    col = w[2]
                if y == ry - 1 and (x - off) % T in (1, 2):
                    col = w[3]
            return col
        return tex

    def rim_in(side, x, y, col):
        return w[4] if side == "lit" else w[3]

    def rim_out(x, y, col):
        return g[0]

    for m in px.ALL47:
        out[m] = [_material_autotile(P, m, "water", _GRASS0, frame_tex(f), rim_in, rim_out, depth=2, radius=3, amp=0) for f in range(4)]
    return out


# ---- 턱·울타리·바위 ------------------------------------------------------------------------
def ledge_south(P, part: str):
    """점프 턱(남쪽으로 뛰어내림). 풀밭 가장자리가 흙 벽으로 꺾이는 모양 — 위는 풀 처마, 아래는 어두운 그림자."""
    g, d = P["grass"], P["dirt"]
    im = grass_tile(P, 0)
    x0, x1 = 0, T - 1
    if part == "l":
        x0 = 2
    if part == "r":
        x1 = T - 3
    r = px.rng("ledge")
    streak = [r.randrange(3) for _ in range(T)]
    for x in range(x0, x1 + 1):
        end = (part == "l" and x == x0) or (part == "r" and x == x1)
        near_end = (part == "l" and x == x0 + 1) or (part == "r" and x == x1 - 1)
        top = 7 + (1 if end else 0)
        bot = 13 - (1 if end else 0)
        px.put(im, x, top - 1, g[1])               # 풀 처마 그림자선
        px.put(im, x, top, g[3] if (x % 4) else g[2])  # 처마 끝 풀
        for y in range(top + 1, bot + 1):
            col = d[2] if y == top + 1 else d[1]
            if y > top + 2 and (x + streak[x]) % 5 == 0:
                col = d[0]
            if y == bot:
                col = d[0]
            px.put(im, x, y, col)
        if end or near_end:
            for y in range(top + 1, bot + 1):
                px.put(im, x, y, d[0] if end else d[1])
    for x in range(x0 + 1, x1 + 3):
        for y in (bot + 1, bot + 2):
            if 0 <= x < T:
                px.put(im, x, y, g[1] if y == bot + 1 else g[0 if x % 2 else 1])
    return im


def ledge_side(P):
    """동쪽으로 뛰어내리는 턱 — 서쪽 풀밭, 동쪽이 흙 벽(서쪽 판은 좌우 반전)."""
    g, d = P["grass"], P["dirt"]
    im = grass_tile(P, 0)
    r = px.rng("ledge-side")
    for y in range(T):
        px.put(im, 8, y, g[1])
        px.put(im, 9, y, g[3] if y % 4 else g[2])
        for x in range(10, 15):
            col = d[2] if x == 10 else d[1]
            if x > 11 and (y + r.randrange(2)) % 5 == 0:
                col = d[0]
            px.put(im, x, y, col)
        px.put(im, 15, y, d[0])
    return im


def fence_cell(P, mask: int):
    wd = P["wood"]
    im = px.new()
    # 기둥(가운데) — 위에서 본 3/4: 윗면 밝게, 앞면 어둡게
    px.rect(im, 6, 4, 9, 11, wd[2])
    px.rect(im, 6, 4, 9, 5, wd[3])
    px.rect(im, 6, 11, 9, 12, wd[0])
    px.rect(im, 9, 6, 9, 11, wd[1])
    px.rect(im, 5, 13, 10, 13, (0, 0, 0, 56))  # 땅 그림자
    for y in (6, 9):
        if mask & W:
            px.rect(im, 0, y, 5, y + 1, wd[2])
            px.rect(im, 0, y, 5, y, wd[3])
        if mask & E:
            px.rect(im, 10, y, 15, y + 1, wd[2])
            px.rect(im, 10, y, 15, y, wd[3])
    if mask & N:
        px.rect(im, 7, 0, 8, 3, wd[2])
    if mask & S:
        px.rect(im, 7, 12, 8, 15, wd[1])
    return im


def _disc(im, cx, cy, rx, ry, color_at):
    for y in range(T * 2):
        for x in range(T * 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                c = color_at(x, y)
                if c is not None:
                    px.put(im, x, y, c)


def bush(P):
    lf = P["leaf"]
    im = px.new()
    cx, cy = 8, 9
    for y in range(T):
        for x in range(T):
            d = ((x - cx) / 6.2) ** 2 + ((y - cy) / 5.0) ** 2
            if d <= 1.0:
                light = (x - 6) + (y - 7)
                col = lf[3] if light < -2 else lf[2] if light < 3 else lf[1]
                if d > 0.78:
                    col = lf[0]
                px.put(im, x, y, col)
    for x, y in ((6, 7), (7, 6), (9, 8)):
        px.put(im, x, y, lf[4])
    px.rect(im, 4, 14, 11, 14, (0, 0, 0, 56))
    return im


def rock(P):
    rk = P["rock"]
    im = px.new()
    cx, cy = 8, 9
    for y in range(T):
        for x in range(T):
            d = ((x - cx) / 6.0) ** 2 + ((y - cy) / 4.6) ** 2
            if d <= 1.0:
                light = (x - 7) + (y - 7)
                col = rk[3] if light < -3 else rk[2] if light < 2 else rk[1]
                if d > 0.72:
                    col = rk[0]
                px.put(im, x, y, col)
    px.put(im, 6, 7, rk[3])
    px.put(im, 7, 7, rk[3])
    px.rect(im, 4, 14, 12, 14, (0, 0, 0, 56))
    return im


def sign(P):
    wd = P["wood"]
    im = px.new()
    px.rect(im, 7, 9, 8, 14, wd[1])
    px.rect(im, 2, 3, 13, 9, wd[2])
    px.rect(im, 2, 3, 13, 3, wd[3])
    px.rect(im, 2, 9, 13, 9, wd[0])
    px.rect(im, 2, 3, 2, 9, wd[1])
    px.rect(im, 13, 3, 13, 9, wd[0])
    for x in (5, 7, 9, 11):
        px.put(im, x, 6, wd[0])
    px.rect(im, 5, 15, 10, 15, (0, 0, 0, 56))
    return im


# ---- 나무(큰 2×2) --------------------------------------------------------------------------
def tree_big(P, name: str):
    lf, tr = P["leaf"], P["trunk"]
    im = px.new(T * 2, T * 2)
    r = px.rng(name)
    cx, cy = 16, 13
    # 땅 그림자
    for y in range(26, 32):
        for x in range(6, 27):
            if ((x - 16) / 11) ** 2 + ((y - 29) / 3.2) ** 2 <= 1.0:
                px.put(im, x, y, (0, 0, 0, 56))
    # 줄기
    px.rect(im, 13, 22, 18, 29, tr[1])
    px.rect(im, 13, 22, 14, 29, tr[2])
    px.rect(im, 18, 22, 18, 29, tr[0])
    px.rect(im, 12, 29, 19, 29, tr[0])
    # 수관(둥근 덩어리 + 앞뒤 명암)
    for y in range(32):
        for x in range(32):
            d = ((x - cx) / 13.5) ** 2 + ((y - cy) / 11.5) ** 2
            if d <= 1.0:
                light = (x - 11) * 0.8 + (y - 8)
                col = lf[4] if light < -6 else lf[3] if light < 0 else lf[2] if light < 9 else lf[1]
                if d > 0.80:
                    col = lf[0]
                px.put(im, x, y, col)
    # 잎 덩이 무늬(결이 있는 가짜 점 잡음이 아니라 3px 덩이)
    for _ in range(22):
        x, y = r.randrange(5, 27), r.randrange(3, 22)
        if ((x - cx) / 12) ** 2 + ((y - cy) / 10) ** 2 <= 0.78:
            c = lf[3] if r.random() < 0.5 else lf[1]
            px.rect(im, x, y, x + 1, y, c)
            px.put(im, x + 1, y + 1, c)
    return im


def tree_pine(P, name: str):
    lf, tr = P["leaf"], P["trunk"]
    im = px.new(T * 2, T * 2)
    for y in range(26, 32):
        for x in range(8, 25):
            if ((x - 16) / 8.5) ** 2 + ((y - 29) / 2.6) ** 2 <= 1.0:
                px.put(im, x, y, (0, 0, 0, 56))
    px.rect(im, 14, 25, 17, 29, tr[1])
    px.rect(im, 14, 25, 14, 29, tr[2])
    px.rect(im, 17, 25, 17, 29, tr[0])
    tiers = ((1, 9, 4), (7, 16, 7), (13, 24, 10))  # (위, 아래, 반폭)
    for top, bot, half in tiers:
        for y in range(top, bot + 1):
            hw = int(half * (y - top + 1) / (bot - top + 1)) + 1
            for x in range(16 - hw, 16 + hw):
                edge = x in (16 - hw, 16 + hw - 1) or y == bot
                light = (x - 16) + (y - top) * 0.2
                col = lf[0] if edge else lf[3] if light < -2 else lf[2] if light < 3 else lf[1]
                px.put(im, x, y, col)
        px.rect(im, 16 - half, bot, 16 + half - 1, bot, lf[0])
    return im


# ---- 집 조각 ------------------------------------------------------------------------------
def roof_tile(P, color: str, row: str, part: str):
    rf = P[color]
    pl = P["plaster"]
    im = px.new()
    px.fill(im, rf[2])
    for y in range(T):
        for x in range(T):
            course = y // 4
            joint = (x + (2 if course % 2 else 0)) % 4 == 0
            if y % 4 == 3:
                im.putpixel((x, y), rf[1])
            elif joint:
                im.putpixel((x, y), rf[1])
            elif y % 4 == 0:
                im.putpixel((x, y), rf[3] if (x + course) % 3 else rf[2])
    if row == "ridge":
        px.rect(im, 0, 0, T - 1, 1, rf[3])
        px.rect(im, 0, 2, T - 1, 2, rf[0])
    if row == "eave":
        px.rect(im, 0, 13, T - 1, 14, rf[1])
        px.rect(im, 0, 15, T - 1, 15, rf[0])
    if part == "l":
        px.rect(im, 0, 0, 0, T - 1, rf[0])
        px.rect(im, 1, 0, 1, T - 1, rf[1])
    if part == "r":
        px.rect(im, T - 1, 0, T - 1, T - 1, rf[0])
        px.rect(im, T - 2, 0, T - 2, T - 1, rf[1])
    return im


def wall_tile(P, part: str, kind: str = "plain", lower: bool = False):
    """집 앞벽. 위 줄(lower=False)은 처마 그림자와 창, 아래 줄(lower=True)은 돌 밑단."""
    pl, rk, wd, w = P["plaster"], P["rock"], P["wood"], P["water"]
    im = px.new()
    px.fill(im, pl[2])
    if not lower:
        px.rect(im, 0, 0, T - 1, 2, pl[1])  # 처마 그림자
        px.rect(im, 0, 3, T - 1, 3, pl[0])
    else:
        px.rect(im, 0, 11, T - 1, 15, rk[2])  # 돌 밑단
        px.rect(im, 0, 11, T - 1, 11, rk[3])
        px.rect(im, 0, 15, T - 1, 15, rk[0])
        for x in (3, 8, 13):
            px.put(im, x, 13, rk[1])
    if part == "l":
        px.rect(im, 0, 0, 1, T - 1, pl[1])
        px.rect(im, 0, 0, 0, T - 1, pl[0])
    if part == "r":
        px.rect(im, T - 2, 0, T - 1, T - 1, pl[1])
        px.rect(im, T - 1, 0, T - 1, T - 1, pl[0])
    if kind == "window":
        px.rect(im, 3, 5, 12, 14, wd[1])
        px.rect(im, 4, 6, 11, 13, w[3])
        px.rect(im, 4, 6, 11, 6, w[4])
        px.rect(im, 7, 6, 8, 13, wd[1])
        px.rect(im, 4, 9, 11, 9, wd[1])
        px.rect(im, 2, 15, 13, 15, wd[0])
    return im


def door_tile(P, row: str):
    pl, rk, wd = P["plaster"], P["rock"], P["wood"]
    im = wall_tile(P, "m", lower=(row == "bot"))
    y0, y1 = (4, 15) if row == "top" else (0, 10)
    px.rect(im, 3, y0, 12, y1, wd[0])
    px.rect(im, 4, y0 + 1 if row == "top" else y0, 11, y1, wd[2])
    px.rect(im, 4, y0 + 1 if row == "top" else y0, 5, y1, wd[3])
    px.rect(im, 10, y0 + 1 if row == "top" else y0, 11, y1, wd[1])
    if row == "top":
        px.put(im, 10, 11, P["dirt"][3])
    else:
        px.rect(im, 2, 11, 13, 13, rk[3])
        px.rect(im, 2, 13, 13, 13, rk[1])
        px.rect(im, 2, 14, 13, 15, (0, 0, 0, 56))
    return im


# ---- 조립 ---------------------------------------------------------------------------------
def build(seed: dict) -> Sheet:
    P = palette(seed)
    sh = Sheet(seed.get("tilesPerRow", 16))

    g0 = grass_tile(P, 0)
    for y in range(T):
        for x in range(T):
            _GRASS0[(x, y)] = g0.getpixel((x, y))

    sh.section("바닥")
    for i in range(4):
        sh.add(f"grass{i}", grass_tile(P, i))
    sh.add("flower_w", flower_grass(P, "w"))
    sh.add("flower_r", flower_grass(P, "r"))
    sh.add("flower_y", flower_grass(P, "y"))
    sh.add("grass_clover", grass_tile(P, 2))
    sh.add("tall0", tall_grass_tile(P, 0))
    sh.add("tall1", tall_grass_tile(P, 1))
    sh.add("dirt", flat_ground(P, "dirt"))
    sh.add("sand", flat_ground(P, "sand"))
    sh.end_section()

    sh.section("턱")
    sh.add("ledge_s_mid", ledge_south(P, "m"))
    sh.add("ledge_s_l", ledge_south(P, "l"))
    sh.add("ledge_s_r", ledge_south(P, "r"))
    e = ledge_side(P)
    sh.add("ledge_e", e)
    sh.add("ledge_w", px.mirror(e))
    sh.end_section()

    sh.section("흙길 오토타일(47)")
    dirt_vars = path_autotile(P, "dirt")
    for m in px.ALL47:
        sh.add(f"dirt_at{m}", dirt_vars[m])
    sh.end_section()

    sh.section("모랫길 오토타일(47)")
    sand_vars = path_autotile(P, "sand")
    for m in px.ALL47:
        sh.add(f"sand_at{m}", sand_vars[m])
    sh.end_section()

    sh.section("물 오토타일(47 × 4프레임)")
    water = water_autotile(P)
    for m in px.ALL47:
        base = len(sh.tiles)
        if base % 4:  # 변형마다 4칸 연속 — 한 행에 네 변형
            sh.row_start()
            base = len(sh.tiles)
        for f in range(4):
            sh.add(f"water_at{m}_f{f}", water[m][f])
        sh.ids[f"water_at{m}"] = sh.ids[f"water_at{m}_f0"]
        sh.anim.append(dict(baseTile=sh.ids[f"water_at{m}_f0"], frames=4, fps=3))
    sh.end_section()

    sh.section("울타리 오토타일")
    for m in range(16):
        sh.add(f"fence_at{m}", fence_cell(P, m))
    sh.end_section()

    sh.section("나무·소품")
    for kind, fn in (("tree_a", tree_big), ("tree_b", tree_big), ("pine_a", tree_pine)):
        im = fn(P, kind)
        for part, (ox, oy) in {"tl": (0, 0), "tr": (T, 0), "bl": (0, T), "br": (T, T)}.items():
            sh.add(f"{kind}.{part}", im.crop((ox, oy, ox + T, oy + T)))
    sh.add("bush", bush(P))
    sh.add("rock", rock(P))
    sh.add("sign", sign(P))
    sh.end_section()

    sh.section("집 조각")
    for color in ("roof_red", "roof_blue"):
        for row in ("ridge", "body", "eave"):
            for part in ("l", "m", "r"):
                sh.add(f"{color}.{row}.{part}", roof_tile(P, color, row, part))
        sh.row_start()
    for part in ("l", "m", "r"):
        sh.add(f"wall_u.{part}", wall_tile(P, part))
    sh.add("wall_u.window", wall_tile(P, "m", "window"))
    sh.row_start()
    for part in ("l", "m", "r"):
        sh.add(f"wall_b.{part}", wall_tile(P, part, lower=True))
    sh.add("door.top", door_tile(P, "top"))
    sh.add("door.bot", door_tile(P, "bot"))
    sh.end_section()
    return sh


def role_ids(sh) -> dict[str, list[str]]:
    ids = sh.ids
    has = lambda prefix: any(k.startswith(prefix) for k in ids)
    return {
        "grass": ["grass0"] if "grass0" in ids else [],
        "tall_grass": ["tall0"] if "tall0" in ids else [],
        "dirt": ["dirt"] if "dirt" in ids else [],
        "sand": ["sand"] if "sand" in ids else [],
        "path_autotile": [f"dirt_at{m}" for m in px.ALL47] if has("dirt_at") else [],
        "sand_autotile": [f"sand_at{m}" for m in px.ALL47] if has("sand_at") else [],
        "water_autotile": [f"water_at{m}" for m in px.ALL47] if has("water_at") else [],
        "ledge_south": ["ledge_s_mid", "ledge_s_l", "ledge_s_r"] if "ledge_s_mid" in ids else [],
        "ledge_west": ["ledge_w"] if "ledge_w" in ids else [],
        "ledge_east": ["ledge_e"] if "ledge_e" in ids else [],
        "fence_autotile": [f"fence_at{m}" for m in range(16)] if has("fence_at") else [],
        "tree_big": ["tree_a.tl", "tree_a.tr", "tree_a.bl", "tree_a.br"] if "tree_a.tl" in ids else [],
        "tree_pine": ["pine_a.tl"] if "pine_a.tl" in ids else [],
        "bush": ["bush"] if "bush" in ids else [],
        "rock": ["rock"] if "rock" in ids else [],
        "sign": ["sign"] if "sign" in ids else [],
        "house_kit": ["roof_red.ridge.m", "wall_u.m", "door.top", "door.bot"] if "door.top" in ids else [],
    }


FAMILIES = [("흙길", "dirt_at", "dirt", ""), ("모랫길", "sand_at", "sand", ""), ("물", "water_at", "water", "_f0")]
EXTRA_MASKS: dict[str, str] = {}
OPAQUE = ["grass0", "tall0", "dirt", "sand", "dirt_at255", "water_at255_f0"]
