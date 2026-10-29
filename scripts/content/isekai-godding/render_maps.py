#!/usr/bin/env python3
"""『이세계로 떠난 한국 고딩』 맵 미리보기 — 프로젝트 JSON 의 맵을 타일 그대로 PNG 로 그린다(검수용).

새 도트를 그리지 않는다: 맵 타일·현대 걷기 칩(oprn-charset-modern2)·EasyRPG 칩(Actor1)만 합성하고 노을빛을 곱한다.

    python3 scripts/content/maou-konbini/render_title.py <demo.project.json> public/assets/generated/title/maou-konbini-title.png
<demo.project.json> 은 createMaouKonbiniFlagshipDemo() 의 serialized(굽기 산출 dist/demos/maou-konbini.play.json 도 된다).
"""
import json, os, re, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SRC = open(os.path.join(ROOT, "src/assets/bundled.ts"), encoding="utf8").read()
PATHS = {m.group(1): m.group(2) for m in re.finditer(r'textureKey:\s*["\']([A-Za-z0-9_]+)["\']\s*,\s*path:\s*["\']([^"\']+)["\']', SRC)}
RTP = open(os.path.join(ROOT, "src/assets/easyrpgRtp.ts"), encoding="utf8").read()
for m in re.finditer(r'path:\s*"([^"]+)"[^}]*?textureKey:\s*"([A-Za-z0-9_]+)"', RTP):
    PATHS.setdefault(m.group(2), m.group(1))
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


def main():
    proj = json.load(open(sys.argv[1]))
    proj = proj.get("project", proj)
    out = sys.argv[2]
    ids = sys.argv[3:] or list(proj["maps"].keys())
    os.makedirs(out, exist_ok=True)
    for mid in ids:
        try:
            im, T = render_map(proj, mid)
        except Exception as e:  # noqa: BLE001
            print("skip", mid, e)
            continue
        from PIL import ImageDraw
        d = ImageDraw.Draw(im)
        for ev in proj["maps"][mid].get("events", []):
            x, y = ev["x"] * T, ev["y"] * T
            drawn = False
            for pg in ev.get("pages") or []:
                g = (pg.get("graphic") or {}).get("sprite") or {}
                sh = sheet(g.get("id", "")) if g.get("id") else None
                if sh is None:
                    continue
                fw, fh = sh.width // 12, sh.height // 8
                idx = pg["graphic"].get("pattern", 0)
                fr = sh.crop(((idx % 12) * fw, (idx // 12) * fh, (idx % 12 + 1) * fw, (idx // 12 + 1) * fh))
                im.alpha_composite(fr, (int(x + T / 2 - fw / 2), int(y + T - fh)))
                drawn = True
                break
            if not drawn:
                d.rectangle((x + 2, y + 2, x + T - 3, y + T - 3), outline=(255, 40, 200))
        scale = 2 if im.width < 900 else 1
        im.resize((im.width * scale, im.height * scale), Image.NEAREST).convert("RGB").save(os.path.join(out, f"{mid}.png"))
        print("wrote", mid, im.size)


if __name__ == "__main__":
    main()
