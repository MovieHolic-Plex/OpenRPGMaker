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
    row = {"down": 0, "left": 1, "right": 2, "up": 3}[direction]
    cx, cy = (index % 4) * 3 + pattern, (index // 4) * 4 + row
    return s.crop((cx * fw, cy * fh, cx * fw + fw, cy * fh + fh))


def main():
    proj = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    street, T = render_map(proj, "map_mk_street")
    # 편의점(왼쪽)부터 찻집·큰길까지, 강물이 아래에 걸치게.
    view = street.crop((0, 4 * T, 20 * T, 4 * T + 180))
    modern2 = "assets/generated/charsets/Modern2.png"
    actor1 = "assets/easyrpg/charset/Actor1.png"
    y0 = 4 * T
    feet = lambda cx, cy: (cx * T + 8, (cy + 1) * T - y0)
    cast = [
        (modern2, 3, "right", feet(4, 9)),    # 마오 — 편의점 앞
        (modern2, 5, "right", feet(3, 9)),     # 히나
        (actor1, 0, "left", feet(7, 9)),      # 용사 레온(이세계 모습)이 다가온다
    ]
    for path, idx, d, (fx, fy) in cast:
        c = chip(path, idx, d)
        view.alpha_composite(c, (fx - c.width // 2, fy - c.height))
    # 노을빛 — 위는 주황, 아래는 보라.
    grad = Image.new("RGBA", view.size)
    for y in range(view.height):
        t = y / view.height
        r = int(255 * (1 - t) + 150 * t)
        g = int(176 * (1 - t) + 110 * t)
        b = int(120 * (1 - t) + 200 * t)
        for x in range(view.width):
            grad.putpixel((x, y), (r, g, b, 255))
    from PIL import ImageChops
    lit = ImageChops.multiply(view, grad)
    lit = Image.blend(view, lit, 0.7)
    lit = lit.resize((lit.width * 3, lit.height * 3), Image.NEAREST)
    lit.convert("RGB").save(out)
    print("wrote", out, lit.size)


if __name__ == "__main__":
    main()
