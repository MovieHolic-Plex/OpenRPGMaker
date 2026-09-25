#!/usr/bin/env python3
"""Atlas town parts — forest_harmony 3311~ (분야 A 마을·도시 소유 범위 3311~3610).

Hand pixels (drawn here in code, same 3/4 top-down view and the sheet's own colours) and one bake:
  - 범선 「푸른물결호」: the EasyRPG ship deck (CC0, public/assets/region-references/bluewave-ship.png — the ship chipset
    tiles plus their mirrored stern sprites) cut to 16px cells, the sea flood-filled away, identical cells shared.
  - 분수 3×3, 줄무늬 차양 노점 3×2 (빨강·파랑·초록), 불길·연기·그을린 잔해·잿자리, 비계, 축제 깃발 줄·등롱 줄·등롱 기둥,
    온천 김, 가죽 천막 3×3(짐승 가죽 · 검은 가죽), 토템 기둥, 해골 창, 전투 깃발.
Writes public/assets/forest-harmony/atlas-town-parts.png and src/assets/forestHarmonyAtlasTownParts.json (grafts,
slot rules, part shapes). Usage: python3 scripts/content/bake-atlas-town-parts.py
"""
import json, math, random
from collections import deque
from PIL import Image

START = 3311
T = 16
SHEET = "public/assets/forest-harmony/atlas-town-parts.png"
OUT = "src/assets/forestHarmonyAtlasTownParts.json"
TEXTURE = "tex_forest_harmony_atlas_town_parts"
ATLAS = "output/atlas-towns/probe/forest-atlas.png"  # the rendered forest_harmony (atlas.mjs) — source of recolours

tiles = []   # (image16, name, passable, layer, description)
parts = []   # {name, w, h, tiles:[[slot index]], passage, category, description}


def add_tile(img, name, passable=False, layer="upper", desc=""):
    data = img.tobytes()
    for k, t in enumerate(tiles):
        if t[0].tobytes() == data and t[2] == passable:
            return k
    tiles.append((img, name, passable, layer, desc))
    return len(tiles) - 1


def add_part(name, big, w, h, passable=False, category="prop", desc="", layer="upper", empty_ok=True):
    """Cut a w*h cell image into tiles; fully transparent cells become -1."""
    grid = []
    for cy in range(h):
        row = []
        for cx in range(w):
            c = big.crop((cx * T, cy * T, cx * T + T, cy * T + T))
            if c.getbbox() is None and empty_ok:
                row.append(-1)
            else:
                row.append(add_tile(c, f"{name} {cx + 1},{cy + 1}" if w * h > 1 else name, passable, layer, desc))
        grid.append(row)
    parts.append({"name": name, "w": w, "h": h, "slots": grid, "passage": "passable" if passable else "solid", "category": category, "description": desc})


def hexc(s, a=255):
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def ascii_img(rows, pal):
    h, w = len(rows), len(rows[0])
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        assert len(r) == w, (r, w)
        for x, ch in enumerate(r):
            if ch != ".":
                im.putpixel((x, y), pal[ch])
    return im


# ── ship ──
def ship():
    im = Image.open("public/assets/region-references/bluewave-ship.png").convert("RGBA")
    sea = {(9, 57, 137, 255), (6, 82, 152, 255), (8, 107, 186, 255), (32, 142, 248, 255)}
    W, H = im.size
    px = im.load()
    seen = set()
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or px[x, y] not in sea:
            continue
        seen.add((x, y))
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    for (x, y) in seen:
        px[x, y] = (0, 0, 0, 0)
    x0, y0, x1, y1 = 4, 5, 35, 17
    add_part("범선 푸른물결호", im.crop((x0 * T, y0 * T, x1 * T, y1 * T)), x1 - x0, y1 - y0, category="vehicle",
             desc="돛을 접은 큰 범선 갑판(EasyRPG 배 칩셋 CC0, 고물 조각 거울상 포함). 물 위에만 둔다. 뱃머리가 왼쪽, 가운데 선루, 대포·밧줄·통이 실려 있다. 부두 끝에 대어 둔다.")


# ── fountain 3x3 ──
def fountain():
    S = 48
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    p = im.load()
    out, dark, stone, lite, hi = hexc("2c2c38"), hexc("5c5f6e"), hexc("8e93a0"), hexc("b9bec8"), hexc("dfe3ea")
    wd, wm, wl, ww = hexc("2d4f9c"), hexc("3f6fcf"), hexc("6f9ce6"), hexc("d8ecff")
    cx, cy, rx, ry = 23.5, 21.0, 22.5, 15.5
    wall = 7  # front side wall height
    for y in range(S):
        for x in range(S):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = dx * dx + dy * dy
            # side wall: below the ellipse's lower half, down by `wall`
            below = False
            if abs(x - cx) <= rx:
                yb = cy + ry * math.sqrt(max(0, 1 - ((x - cx) / rx) ** 2))
                if yb <= y <= yb + wall and y >= cy:
                    below = True
            if d <= 1.0:
                inner = ((x - cx) / (rx - 4)) ** 2 + ((y - cy) / (ry - 3.5)) ** 2
                if inner <= 1.0:
                    # water, darker toward the back rim
                    t = (y - (cy - ry)) / (2 * ry)
                    p[x, y] = wm if t > 0.45 else wd
                    if (x * 7 + y * 3) % 11 == 0 and inner < 0.8:
                        p[x, y] = wl
                elif inner <= 1.35:
                    p[x, y] = hi if y < cy else lite
                else:
                    p[x, y] = stone
                if d > 0.93:
                    p[x, y] = out
            elif below:
                yb = cy + ry * math.sqrt(max(0, 1 - ((x - cx) / rx) ** 2))
                k = y - yb
                brick = (int(k) // 3 + (x // 5)) % 2
                p[x, y] = dark if (int(k) % 3 == 0 or (x + (int(k) // 3) * 2) % 6 == 0) else (stone if brick else lite)
                if k >= wall - 1 or abs(x - cx) >= rx - 0.7:
                    p[x, y] = out
    # pedestal and spray in the middle
    for y in range(8, 26):
        for x in range(21, 27):
            if y >= 16:
                p[x, y] = out if x in (21, 26) or y == 25 else (lite if x < 24 else stone)
    for y in range(12, 17):
        for x in range(18, 30):
            e = ((x - 23.5) / 6) ** 2 + ((y - 14) / 2.4) ** 2
            if e <= 1:
                p[x, y] = out if e > 0.7 else hi
    # spray: a plume and falling drops
    for y in range(2, 13):
        w = 1 + (y - 2) // 3
        for x in range(24 - w, 24 + w):
            p[x, y] = ww if abs(x - 23.5) < w - 0.5 else wl
    for (x, y) in [(17, 9), (30, 9), (15, 12), (32, 12), (19, 6), (28, 6), (16, 16), (31, 16)]:
        p[x, y] = ww
        p[x, y + 1] = wl
    add_part("광장 분수", im, 3, 3, category="landmark", desc="돌 수반 분수 3×3. 광장 한가운데. 통행 불가. 둘레 한 칸은 비워 광장을 돌아 걷게 한다.")


# ── market stalls with a striped awning ──
def stall(name, c1, c2, goods):
    im = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    p = im.load()
    out, wood, wdk, wlt = hexc("3a2410"), hexc("9a6232"), hexc("6a4020"), hexc("c08a4e")
    A, B = hexc(c1), hexc(c2)
    # awning: rows 0..13, slanted stripes, scalloped hem
    for y in range(1, 14):
        for x in range(1, 47):
            stripe = ((x + (y // 2)) // 6) % 2
            col = A if stripe == 0 else B
            if y < 4:
                col = tuple(max(0, v - 30) if i < 3 else v for i, v in enumerate(col))
            p[x, y] = col
        p[0, y] = out
        p[47, y] = out
    for x in range(48):
        p[x, 0] = out
    for x in range(1, 47):
        k = x % 6
        hem = 14 + (1 if 1 <= k <= 4 else 0)
        for y in range(13, hem + 1):
            p[x, y] = (A if ((x // 6) % 2 == 0) else B)
        p[x, hem + 1] = out
    # posts
    for x in (2, 3, 44, 45):
        for y in range(15, 32):
            p[x, y] = wdk if x in (3, 45) else wood
    # counter: rows 22..31
    for y in range(22, 32):
        for x in range(2, 46):
            p[x, y] = wlt if y == 22 else (wood if (y - 23) % 3 else wdk)
        p[1, y] = out
        p[46, y] = out
    for x in range(1, 47):
        p[x, 21] = out
        p[x, 31] = out
    # goods on the counter (rows 17..21)
    rnd = random.Random(name)
    for gx in range(6, 43, 5):
        col = hexc(goods[rnd.randrange(len(goods))])
        dk = tuple(max(0, v - 60) if i < 3 else v for i, v in enumerate(col))
        for y in range(17, 22):
            for x in range(gx, gx + 4):
                e = ((x - gx - 1.5) / 2.2) ** 2 + ((y - 19.5) / 2.3) ** 2
                if e <= 1:
                    p[x, y] = dk if e > 0.6 else col
        p[gx + 1, 18] = hexc("ffffff", 200)
    add_part(name, im, 3, 2, category="prop", desc="줄무늬 차양을 친 장터 노점 3×2(윗줄 차양, 아랫줄 좌판). 통행 불가. 광장·시장 거리 가장자리에 여럿 줄지어 두고 앞 한 칸은 비운다.")


# ── fire ──
def flame(seed, tall=False):
    H = 32 if tall else 16
    im = Image.new("RGBA", (16, H), (0, 0, 0, 0))
    p = im.load()
    rnd = random.Random(seed)
    tongues = [(rnd.uniform(3.5, 12.5), rnd.uniform(0.55, 1.0) * H, rnd.uniform(3.4, 5.6)) for _ in range(5)]
    pal = [hexc("5a1a0a"), hexc("c8321a"), hexc("f07820"), hexc("ffc830"), hexc("fff4a8")]
    heat = [[0.0] * 16 for _ in range(H)]
    for y in range(H):
        for x in range(16):
            v = 0
            for (tx, th, tw) in tongues:
                fy = (H - 1 - y) / th  # 0 at base, 1 at tip
                if 0 <= fy <= 1:
                    wdt = tw * (1 - fy) ** 0.7 + 0.3
                    xx = tx + math.sin(fy * 3 + seed) * 1.2
                    v = max(v, 1 - abs(x - xx) / wdt - fy * 0.25)
            heat[y][x] = v
    for y in range(H):
        for x in range(16):
            v = heat[y][x]
            if v <= 0:
                continue
            nb = min(heat[yy][xx] if 0 <= yy < H and 0 <= xx < 16 else 0 for (xx, yy) in [(x + 1, y), (x - 1, y), (x, y - 1)])
            if nb <= 0:
                p[x, y] = pal[0]
            else:
                p[x, y] = pal[1 if v < 0.3 else 2 if v < 0.55 else 3 if v < 0.8 else 4]
    return im


def smoke(seed):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = im.load()
    rnd = random.Random(seed)
    blobs = [(rnd.uniform(4, 12), rnd.uniform(4, 12), rnd.uniform(4, 6.5)) for _ in range(5)]
    for y in range(16):
        for x in range(16):
            v = max(1 - math.hypot(x - bx, y - by) / r for bx, by, r in blobs)
            if v > 0:
                g = 70 + int(60 * v) if y > 7 else 90 + int(70 * v)
                p[x, y] = (g, g, g + 6, int(90 + 110 * min(1, v * 1.6)))
    return im


def ash_patch(seed):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = im.load()
    rnd = random.Random(seed)
    cols = [hexc("6e6862"), hexc("5c5650"), hexc("807a72"), hexc("3e3834")]
    for y in range(16):
        for x in range(16):
            d = math.hypot((x - 7.5) / 7.8, (y - 7.5) / 7.0) + rnd.uniform(-0.18, 0.18)
            if d < 0.95:
                c = cols[rnd.randrange(3)] if d < 0.8 else (cols[1] + (0,))[:4]
                if d >= 0.8: c = (c[0], c[1], c[2], 150)
                if 0.25 < d < 0.7 and rnd.random() < 0.12: c = cols[3]
                p[x, y] = c
            if d < 0.7 and rnd.random() < 0.05:
                p[x, y] = hexc("e0602a")  # embers
    return im


def charred_beams(seed):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(3):
        x0, y0 = rnd.randint(0, 3), rnd.randint(3, 12)
        x1, y1 = min(15, x0 + rnd.randint(11, 15)), max(2, min(13, y0 + rnd.randint(-6, 6)))
        d.line((x0, y0 + 1, x1, y1 + 1), fill=hexc("140e0a"), width=4)
        d.line((x0, y0, x1, y1), fill=hexc("3a2a1e"), width=3)
        d.line((x0, y0 - 1, x1, y1 - 1), fill=hexc("5a4434"), width=1)
        d.point((x0 + 2, y0), fill=hexc("6a5040"))
    for _ in range(4):
        x, y = rnd.randint(2, 13), rnd.randint(3, 14)
        d.point((x, y), fill=hexc("f07820"))
    return im


from PIL import ImageDraw


def fire_set():
    for k in range(3):
        add_part(f"불길 {k + 1}", flame(11 + k * 7), 1, 1, category="fire", desc="지붕·잔해 위에 얹는 불길(윗레이어). 불타는 마을 전용. 통행 불가 칸 위에만 둔다.")
    add_part("큰 불길", flame(5, tall=True), 1, 2, category="fire", desc="두 칸 높이 큰 불길. 무너진 집·장작더미 위에.")
    for k in range(2):
        add_part(f"연기 {k + 1}", smoke(40 + k), 1, 1, passable=True, category="fire", desc="반투명 검은 연기(윗레이어, 통행 가능). 불길 위쪽 지붕에.")
    for k in range(3):
        add_part(f"잿자리 {k + 1}", ash_patch(70 + k), 1, 1, passable=True, category="fire", desc="타고 남은 잿자리(윗레이어, 통행 가능). 불탄 집 둘레 땅에 두세 칸씩 붙여.")
    for k in range(2):
        add_part(f"그을린 들보 {k + 1}", charred_beams(90 + k), 1, 1, category="fire", desc="타다 남은 들보 더미. 무너진 집 자리에.")


# ── scaffolding ──
def scaffold():
    im = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    out, pole, plank, pl2 = hexc("3a2410"), hexc("a8743c"), hexc("c8965a"), hexc("8a5a2c")
    for x in (3, 23, 43):
        d.rectangle((x - 1, 0, x + 1, 47), fill=out)
        d.line((x, 0, x, 47), fill=pole)
    for y in (6, 22, 38):
        d.rectangle((0, y - 2, 47, y + 2), fill=out)
        d.rectangle((0, y - 1, 47, y + 1), fill=plank)
        d.line((0, y + 1, 47, y + 1), fill=pl2)
        for x in range(4, 47, 8):
            d.point((x, y), fill=pl2)
    # diagonal braces
    d.line((4, 22, 22, 7), fill=out, width=2)
    d.line((24, 38, 42, 23), fill=out, width=2)
    d.line((4, 21, 21, 7), fill=pole)
    d.line((24, 37, 41, 23), fill=pole)
    add_part("비계", im, 3, 3, category="construction", desc="짓고 있는 집 벽 앞에 세운 나무 비계 3×3(윗레이어, 통행 불가). 재건 마을의 공사 중인 집 벽·지붕 위에 겹친다.")


# ── festival ──
def festival():
    out = hexc("2a1a10")
    rope = hexc("5a3a1c")
    # bunting: rope sagging across a cell with three flags
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = im.load()
    cols = [hexc("e0402a"), hexc("f0c030"), hexc("3a78d8")]
    for x in range(16):
        y = 3 + int(round(1.6 * math.sin(math.pi * x / 16)))
        p[x, y] = rope
    for k, fx in enumerate((1, 6, 11)):
        c = cols[k]
        y0 = 4 + int(round(1.6 * math.sin(math.pi * (fx + 2) / 16)))
        for dy in range(6):
            for dx in range(4 - dy * 4 // 6 + 1):
                x = fx + dx + dy * 2 // 6
                if x < 16:
                    p[x, y0 + dy] = c if dx not in (0,) else tuple(max(0, v - 50) if i < 3 else v for i, v in enumerate(c))
    add_part("축제 깃발 줄", im, 1, 1, passable=True, category="festival", desc="삼색 삼각 깃발 줄(윗레이어·통행 가능 ★). 길 위를 가로질러 등롱 기둥 사이에 한 줄로 잇는다.")
    # lantern string: rope with round paper lanterns
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    p = im.load()
    for x in range(16):
        y = 3 + int(round(1.4 * math.sin(math.pi * x / 16)))
        p[x, y] = rope
    for lx, col in ((3, "f05a28"), (11, "ffb020")):
        y0 = 5 + int(round(1.4 * math.sin(math.pi * lx / 16)))
        for dy in range(6):
            for dx in range(-2, 3):
                e = (dx / 2.6) ** 2 + ((dy - 2.5) / 3.0) ** 2
                if e <= 1:
                    p[lx + dx, y0 + dy] = out if e > 0.75 else (hexc("fff0a0") if dx == 0 and 1 <= dy <= 3 else hexc(col))
        p[lx, y0 - 1] = out
    add_part("등롱 줄", im, 1, 1, passable=True, category="festival", desc="종이 등롱을 매단 줄(윗레이어·통행 가능 ★). 밤 축제 거리·광장 위를 가로질러.")
    # lantern post 1x2
    im = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((6, 6, 9, 31), fill=out)
    d.rectangle((7, 6, 8, 30), fill=hexc("7a4a22"))
    d.rectangle((3, 3, 12, 5), fill=out)
    d.line((4, 4, 11, 4), fill=hexc("9a6232"))
    d.ellipse((2, 6, 13, 17), fill=out)
    d.ellipse((3, 7, 12, 16), fill=hexc("e0402a"))
    d.ellipse((5, 8, 10, 14), fill=hexc("ffb040"))
    d.line((7, 9, 7, 13), fill=hexc("fff0a0"))
    d.line((3, 11, 12, 11), fill=hexc("a82818"))
    d.rectangle((5, 28, 10, 31), fill=out)
    add_part("등롱 기둥", im, 1, 2, category="festival", desc="붉은 종이 등롱을 단 나무 기둥 1×2(통행 불가). 축제 깃발 줄·등롱 줄의 양 끝, 무대·광장 가장자리.")


# ── hot spring steam ──
def steam():
    for k in range(2):
        im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        p = im.load()
        rnd = random.Random(300 + k)
        for c in range(3):
            bx, by = rnd.uniform(4, 12), rnd.uniform(3, 13)
            for y in range(16):
                for x in range(16):
                    v = 1 - math.hypot((x - bx) / 3.2, (y - by) / 4.2)
                    if v > 0:
                        a = int(40 + 120 * v)
                        old = p[x, y]
                        p[x, y] = (236, 242, 248, max(old[3], a))
        add_part(f"온천 김 {k + 1}", im, 1, 1, passable=True, category="spring", desc="온천물 위에 피어오르는 반투명 김(윗레이어). 물 칸 위에만, 서너 칸 떨어뜨려.")


# ── recolours of sheet art ──
def atlas_cut(t, w, h):
    at = Image.open(ATLAS).convert("RGBA")
    big = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 0))
    for dy in range(h):
        for dx in range(w):
            tt = t + dy * 30 + dx
            big.paste(at.crop((tt % 30 * T, tt // 30 * T, tt % 30 * T + T, tt // 30 * T + T)), (dx * T, dy * T))
    return big


def recolour(im, fn):
    out = im.copy()
    p = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = p[x, y]
            if a:
                p[x, y] = fn(r, g, b) + (a,)
    return out


def hide_tents():
    base = atlas_cut(417, 3, 3)
    def leather(r, g, b):
        l = (r + g + b) / 3
        if r > 200 and g > 190:  # canvas → tanned hide
            return (int(l * 0.78), int(l * 0.56), int(l * 0.36))
        if r > 150 and g > 130 and b > 110:
            return (int(l * 0.72), int(l * 0.5), int(l * 0.32))
        return (r, g, b)
    def black(r, g, b):
        l = (r + g + b) / 3
        if l > 110:
            return (int(l * 0.42), int(l * 0.36), int(l * 0.34))
        return (r, g, b)
    add_part("가죽 천막", recolour(base, leather), 3, 3, category="tent", desc="짐승 가죽 천막 3×3(아랫줄 가운데가 입구). 유목 천막촌·사냥꾼 야영지. 입구 앞 한 칸은 비운다.")
    add_part("검은 가죽 천막", recolour(base, black), 3, 3, category="tent", desc="그을린 검은 가죽 천막 3×3. 고블린·오크 같은 몬스터 마을 전용.")
    def red(r, g, b):
        l = (r + g + b) / 3
        if r > 200 and g > 190:
            return (min(255, int(l * 1.05)), int(l * 0.42), int(l * 0.34))
        if r > 150 and g > 130 and b > 110:
            return (int(l * 0.95), int(l * 0.36), int(l * 0.3))
        return (r, g, b)
    add_part("붉은 축제 천막", recolour(base, red), 3, 3, category="tent", desc="붉은 천 축제 천막 3×3. 축제 광장·장터 가장자리.")


def totems():
    out = hexc("2a1a10")
    im = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    rows = [
        "......kkkk......",
        "....kkrrrrkk....",
        "...kyrrrrrryk...",
        "...kwwkrrkwwk...",
        "...kwkkrrkkwk...",
        "...krrrrrrrrk...",
        "...krkkkkkkrk...",
        "...krkwkwkkrk...",
        "....kkkkkkkk....",
        ".....kbbbbk.....",
        "....kbgggbbk....",
        "....kbkggkbk....",
        "....kbggggbk....",
        "....kbgkkgbk....",
        "....kbbggbbk....",
        ".....kbbbbk.....",
        ".....kbwwbk.....",
        ".....kbbbbk.....",
        "....kkbbbbkk....",
        "...kyykbbkyyk...",
        "...kkkkbbkkkk...",
        ".....kbbbbk.....",
        ".....kbnbbk.....",
        ".....kbbnbk.....",
        ".....kbbbbk.....",
        ".....kbnbbk.....",
        ".....kbbbbk.....",
        ".....kbbnbk.....",
        "....kkbbbbkk....",
        "...kddbbbbddk...",
        "...kkkkkkkkkk...",
        "................",
    ]
    pal = {"k": out, "r": hexc("b8321e"), "y": hexc("f0c030"), "w": hexc("f0ead8"), "b": hexc("8a5a2c"), "g": hexc("4a8a3a"), "n": hexc("5a3818"), "d": hexc("4a3a2a")}
    add_part("토템 기둥", ascii_img(rows, pal), 1, 2, category="monster", desc="짐승 얼굴을 새긴 토템 기둥 1×2(통행 불가). 몬스터 마을·유목 천막촌 모닥불 곁.")
    skull = atlas_cut(383, 1, 1)
    im = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((7, 10, 8, 31), fill=out)
    d.line((7, 11, 7, 30), fill=hexc("8a5a2c"))
    im.alpha_composite(skull, (0, 0))
    add_part("해골 창", im, 1, 2, category="monster", desc="해골을 꽂은 창 1×2(통행 불가). 몬스터 마을 목책 입구 양옆에만.")
    im = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((2, 0, 4, 31), fill=out)
    d.line((3, 1, 3, 30), fill=hexc("7a4a22"))
    d.polygon([(4, 2), (15, 4), (12, 9), (15, 14), (4, 15)], fill=out)
    d.polygon([(5, 3), (13, 5), (10, 9), (13, 13), (5, 14)], fill=hexc("6a2a1a"))
    d.line((6, 8, 9, 8), fill=hexc("d8c8a0"))
    d.line((7, 6, 7, 11), fill=hexc("d8c8a0"))
    add_part("전투 깃발", im, 1, 2, category="monster", desc="가죽 전투 깃발 1×2(통행 불가). 몬스터 마을 두목 천막·요새 문 앞.")


PLACEMENT = {
    "vehicle": "배는 물 칸 위에만, 모든 칸이 물이어야 한다. 부두 끝 곁에 대고 뱃머리는 바다 쪽. 판자 몇 장으로 배를 흉내 내지 않는다.",
    "landmark": "분수는 포장 광장 한가운데. 둘레 한 칸은 비워 둔다.",
    "prop": "노점은 광장·시장 거리 가장자리에 차양이 위, 좌판이 아래로. 앞 한 칸은 통로로 비운다. 들판 한가운데 금지.",
    "fire": "불길·연기는 불타는 마을(밤 조명)의 지붕·잔해 위에만, 덩이로 모아 둔다(흩뿌리지 않는다). 잿자리는 불탄 집 둘레 땅.",
    "construction": "비계는 짓고 있는 집 앞벽에 겹쳐 세우고 문 칸은 비운다. 곁에 통나무·장작·연장 상자.",
    "festival": "깃발 줄·등롱 줄은 길 위를 가로지르는 한 줄로, 양 끝에 등롱 기둥. 밤 축제 맵(어두운 조명)에서 광장·큰길 위에.",
    "spring": "김은 온천물 칸 위에만, 서너 칸 띄어서.",
    "tent": "천막은 입구(아랫줄 가운데) 앞 한 칸을 비운다. 모닥불·장작·물통과 함께 야영지 한 덩이로.",
    "monster": "토템·해골 창·전투 깃발은 몬스터 마을의 모닥불·두목 천막·목책 입구 곁에만.",
}


def main():
    ship()
    fountain()
    stall("줄무늬 노점 빨강", "d8402a", "f2e6cc", ["e0402a", "f0a020", "8ac040", "c83060"])
    stall("줄무늬 노점 파랑", "3a68c8", "f2e6cc", ["c8b89a", "8a6a4a", "d0d0d8", "5a8ad0"])
    stall("줄무늬 노점 초록", "3a9a4a", "f2e6cc", ["f0c030", "e07020", "b04a2a", "7ab040"])
    fire_set()
    scaffold()
    festival()
    steam()
    hide_tents()
    totems()
    n = len(tiles)
    assert START + n <= 3611, f"{n} tiles exceed 3311~3610"
    cols = 30
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * T, rows * T), (0, 0, 0, 0))
    for k, (img, *_rest) in enumerate(tiles):
        sheet.paste(img, (k % cols * T, k // cols * T))
    sheet.save(SHEET)
    solid = {"up": False, "down": False, "left": False, "right": False}
    open_ = {"up": True, "down": True, "left": True, "right": True}
    slots = []
    for k, (img, name, passable, layer, desc) in enumerate(tiles):
        slots.append({"name": name, "passability": open_ if passable else solid, "priority": layer, "terrain": 0,
                      "tileMeta": {"role": "prop", "label": name, "description": desc or name, "source": "user", "userLocked": True,
                                   "defaultLayer": layer, "passage": "passable" if passable else "solid", "layerBacking": "none"}})
    count = START + n
    out_parts = []
    for p in parts:
        out_parts.append({**{k: v for k, v in p.items() if k != "slots"}, "tiles": [[(START + s) if s >= 0 else -1 for s in row] for row in p["slots"]]})
    groups = {}
    for p in out_parts:
        groups.setdefault(p["category"], []).append(p)
    tile_groups = [{"id": f"atlas-town-{cat}", "name": f"마을·도시 부품 · {', '.join(q['name'] for q in ps)}", "role": "prop", "source": "user", "confidence": "high",
                    "defaultLayer": "upper", "tileIds": sorted({t for q in ps for row in q["tiles"] for t in row if t >= 0}),
                    "description": " / ".join(f"{q['name']} {q['w']}×{q['h']}: {q['description']}" for q in ps),
                    "placementRules": PLACEMENT.get(cat, "여러 칸 조각은 전부 찍는다(잘라 쓰지 않는다). 주인(집·광장·부두·야영지) 곁에만 둔다.")} for cat, ps in groups.items()]
    data = {"textureKey": TEXTURE, "start": START, "count": count, "frames": n, "grafts": [{"targetTile": START + k, "sourceChipset": TEXTURE, "sourceTile": k} for k in range(n)],
            "slots": slots, "parts": out_parts, "tileGroups": tile_groups}
    with open(OUT, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)
        f.write("\n")
    # preview ×4 on grass
    prev = Image.new("RGBA", sheet.size, (86, 160, 70, 255))
    prev.alpha_composite(sheet)
    prev.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save("output/atlas-towns/probe/parts-preview.png")
    print(n, "tiles", START, "~", count - 1, [p["name"] for p in parts])


main()
