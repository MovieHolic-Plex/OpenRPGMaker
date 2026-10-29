#!/usr/bin/env python3
"""『전생한 마왕, 편의점 알바 시작하다』 타이틀 그림 — 데모의 상점가 맵(jp_city)을 그대로 그리고 번들 걷기 칩 배우를 얹는다.

새 도트를 그리지 않는다: 맵 타일·현대 걷기 칩(oprn-charset-modern2)·EasyRPG 칩(Actor1)만 합성하고 노을빛을 곱한다.

    python3 scripts/content/maou-konbini/render_title.py <demo.project.json> public/assets/generated/title/maou-konbini-title.png
<demo.project.json> 은 createMaouKonbiniFlagshipDemo() 의 serialized(굽기 산출 dist/demos/maou-konbini.play.json 도 된다).
"""
import json, os, re, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = open(os.path.join(ROOT, "src/assets/bundled.ts"), encoding="utf8").read()
PATHS = {m.group(1): m.group(2) for m in re.finditer(r'textureKey:\s*"([A-Za-z0-9_]+)"\s*,\s*path:\s*"([^"]+)"', SRC)}
_cache = {}


def sheet(key):
    if key not in _cache:
        p = PATHS.get(key)
        _cache[key] = Image.open(os.path.join(ROOT, "public", p)).convert("RGBA") if p else None
    return _cache[key]


def render_map(proj, mid):
    m = proj["maps"][mid]
    ts = proj["tilesets"][m["tilesetId"]]
    base = sheet(ts["image"]["id"])
    T, per = ts["tileSize"], ts["tilesPerRow"]
    grafts = {g["targetTile"]: g for g in (ts.get("tileGrafts") or [])}
    W, H = m["width"], m["height"]
    im = Image.new("RGBA", (W * T, H * T), (12, 10, 18, 255))
    cache = {}

    def tile(t):
        if t in cache:
            return cache[t]
        g = grafts.get(t)
        out = None
        if g:
            s = sheet(g["sourceChipset"])
            if s is not None:
                st = g.get("sourceTileSize") or T
                sp = g.get("sourceTilesPerRow") or s.width // st
                n = g["sourceTile"]
                out = s.crop(((n % sp) * st, (n // sp) * st, (n % sp) * st + st, (n // sp) * st + st))
                if st != T:
                    out = out.resize((T, T), Image.NEAREST)
        elif base is not None and (t // per) * T < base.height:
            out = base.crop(((t % per) * T, (t // per) * T, (t % per) * T + T, (t // per) * T + T))
        cache[t] = out
        return out

    for layer in ("lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"):
        for i, t in enumerate(m.get(layer) or []):
            if t is None or t < 0:
                continue
            tt = tile(t)
            if tt is not None:
                im.alpha_composite(tt, ((i % W) * T, (i // W) * T))
    return im, T


def chip(path, index, direction, pattern=1):
    """24×32 걷기 칩 한 칸. 시트 = 4×2 인물, 인물마다 3열×4행(아래·왼·오른·위)."""
    s = Image.open(os.path.join(ROOT, "public", path)).convert("RGBA")
    key = s.getpixel((0, 0))
    if key[3] == 255:  # EasyRPG 시트는 왼쪽 위 색이 투명색이다.
        s.putdata([(r, g, b, 0) if (r, g, b, a) == key else (r, g, b, a) for (r, g, b, a) in s.getdata()])
    fw, fh = s.width // 12, s.height // 8
    # OPRN 현대 칩은 아래·왼·오른·위, EasyRPG(RM2000) 칩은 위·오른·아래·왼 순서다.
    order = ("up", "right", "down", "left") if "easyrpg" in path else ("down", "left", "right", "up")
    row = order.index(direction)
    cx, cy = (index % 4) * 3 + pattern, (index // 4) * 4 + row
    return s.crop((cx * fw, cy * fh, cx * fw + fw, cy * fh + fh))


def tinted(im, rgb, amount):
    """불투명 화소를 rgb 쪽으로 amount 만큼 끌어당긴다(알파 유지)."""
    over = Image.new("RGBA", im.size, rgb + (255,))
    mixed = Image.blend(im, over, amount)
    mixed.putalpha(im.getchannel("A"))
    return mixed


def glow(size, rgb, radius, strength):
    """가운데가 밝은 둥근 빛(가산용)."""
    import math
    g = Image.new("RGBA", size, (0, 0, 0, 0))
    cx, cy = size[0] / 2, size[1] / 2
    px = g.load()
    for y in range(size[1]):
        for x in range(size[0]):
            d = math.hypot((x - cx) / radius[0], (y - cy) / radius[1])
            a = max(0.0, 1 - d) ** 2 * strength
            if a > 0:
                px[x, y] = rgb + (int(255 * min(1, a)),)
    return g


def main():
    """타이틀 그림(960×540 = 480×270 의 2배 도트).

    왼쪽: 어둡게 가라앉은 마왕성 옥좌의 방과 4배로 선 마왕 제르바스(Monster2 #7). 글자·메뉴가 얹히는 쪽이라 인물을 두지 않는 빈 바닥이 아래 왼쪽에 남는다.
    오른쪽: 노을 진 사쿠라자카 상점가, 해피 마트 앞에 선 지금의 마오와 히나(현대 걷기 칩 2배).
    가운데: 비스듬히 갈라진 빛 이음매 — 「그때」와 「지금」. 새 도트는 없다(맵 타일·번들 칩만 합성).
    """
    from PIL import ImageChops
    proj = json.load(open(sys.argv[1]))
    proj = proj.get("project", proj)
    out = sys.argv[2]
    W, H = 480, 270
    canvas = Image.new("RGBA", (W, H), (10, 6, 18, 255))

    # 오른쪽 — 상점가(2배). 편의점 문이 이음매 오른쪽에 오게 자른다.
    street, T = render_map(proj, "map_mk_street")
    sx0, sy0 = 4, 26
    right = street.crop((sx0, sy0, sx0 + 150, sy0 + 135)).resize((300, 270), Image.NEAREST)
    modern2 = "assets/generated/charsets/Modern2.png"
    feet = lambda mx, my: ((mx - sx0) * 2, (my - sy0) * 2)
    for idx, d, (fx, fy) in [(3, "left", feet(52, 158)), (5, "left", feet(72, 156))]:
        c = chip(modern2, idx, d).resize((48, 64), Image.NEAREST)
        right.alpha_composite(c, (fx - 24, fy - 64))
    grad = Image.new("RGBA", right.size)
    gp = grad.load()
    for y in range(right.height):
        t = y / right.height
        col = (int(255 * (1 - t) + 170 * t), int(178 * (1 - t) + 120 * t), int(130 * (1 - t) + 205 * t), 255)
        for x in range(right.width):
            gp[x, y] = col
    right = Image.blend(right, ImageChops.multiply(right, grad), 0.72)
    canvas.alpha_composite(right, (W - right.width, 0))

    # 왼쪽 — 옥좌의 방(2배), 보랏빛으로 눌러 어둡게.
    throne, _ = render_map(proj, "map_mk_throne")
    tx0, ty0 = 23 * 16 + 8 - 70, 0
    left = throne.crop((tx0, ty0, tx0 + 125, ty0 + 135)).resize((250, 270), Image.NEAREST)
    dark = Image.new("RGBA", left.size, (70, 24, 96, 255))
    left = Image.blend(left, ImageChops.multiply(left, dark), 0.85)
    lg = glow((220, 220), (190, 70, 255), (110, 110), 0.55)
    left.alpha_composite(lg, (left.width // 2 - 110 + 40, 30))
    maou = chip("assets/easyrpg/charset/Monster2.png", 7, "down").resize((96, 128), Image.NEAREST)

    # 비스듬한 이음매: 위 x=245 → 아래 x=195. 왼쪽 그림을 그 선까지만 덮는다.
    mask = Image.new("L", left.size, 0)
    mp = mask.load()
    for y in range(left.height):
        edge = 245 - 50 * y / (left.height - 1)
        for x in range(left.width):
            mp[x, y] = 255 if x < edge else 0
    canvas.paste(left, (0, 0), mask)
    seam = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sp = seam.load()
    for y in range(H):
        edge = 245 - 50 * y / (H - 1)
        for dx in range(-6, 7):
            x = int(round(edge)) + dx
            if 0 <= x < W:
                a = max(0, 1 - abs(dx) / 6.5) ** 1.6
                sp[x, y] = (255, 196, 120, int(230 * a))
    canvas.alpha_composite(seam)
    # 마왕은 이음매를 넘어 선다(그림틀을 깨는 쪽이 「전(前) 마왕」답다). 발밑 그림자 → 몸.
    mx, my = 170 - 48, H - 128 - 14
    shadow = tinted(maou, (16, 0, 26), 1.0)
    shadow.putalpha(shadow.getchannel("A").point(lambda a: int(a * 0.55)))
    canvas.alpha_composite(shadow, (mx + 6, my + 6))
    canvas.alpha_composite(maou, (mx, my))

    # 글자가 얹히는 왼쪽 위·메뉴가 얹히는 왼쪽 아래를 한 번 더 어둡게(가독성).
    veil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vp = veil.load()
    for y in range(H):
        for x in range(W):
            top = max(0.0, 1 - y / 120) * max(0.0, 1 - x / 420) * 0.55
            vp[x, y] = (8, 2, 14, int(255 * min(0.7, top)))
    canvas.alpha_composite(veil)
    canvas.resize((W * 2, H * 2), Image.NEAREST).convert("RGB").save(out)
    print("wrote", out, (W * 2, H * 2))


if __name__ == "__main__":
    main()
