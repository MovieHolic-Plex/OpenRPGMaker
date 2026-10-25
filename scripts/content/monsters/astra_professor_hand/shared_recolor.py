"""Astra professor bust candidates from the shared portrait library (public/assets/shared/portraits).

Recolors a shared bust to the professor's overworld chip (ScarloxyPeople14 slot 1): brown hair with grey
streaks, white lab coat, navy shirt; then reframes it to the cast bust framing (head ~38 px of 64) and
reduces it to a 64x64, <=16-colour grid with a 1 px outline. Output: .omo/astra-prof/shared-<key>/bust-<expr>.png

  python3 scripts/content/monsters/astra_professor_hand/shared_recolor.py
"""
from __future__ import annotations
import colorsys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
SRC = ROOT / "public/assets/shared/portraits"
OUT = ROOT / ".omo/astra-prof"

HEX = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
HAIR = [HEX(c) for c in ("#381c14", "#5c3022", "#7b382f", "#874b36", "#a15d4a")]
GREY = [HEX(c) for c in ("#8d8984", "#b9b5ae", "#d8d5cf")]
COAT = [HEX(c) for c in ("#414c61", "#9aa6ba", "#d6dfed", "#f2f6fc")]
NAVY = [HEX(c) for c in ("#1c2546", "#262f52", "#2e3d6c", "#414c8a")]
OUTLINE = HEX("#23262e")
EXPRS = ("base", "happy", "sad", "angry", "surprised")

# key: (source set, expression map, head bbox in source fractions (x0, y0, x1), coat/shirt split rule, grey share)
CANDIDATES = {
    # Kind old scholar: white hair → brown with grey streaks, brown coat → lab coat, white turtleneck → navy.
    "elder": dict(set="people2-white-elder", exprs={"base": "base", "happy": "happy", "sad": "sad", "angry": "serious", "surprised": "surprised"},
                  head=(0.30, 0.0, 0.88), shirt_y=0.79, coat_y=0.64, grey=0.30, face=(0.50, 0.22, 0.86, 0.62)),
    # Brown-haired moustached man: orange hair → chip brown + grey temples, brown jacket → lab coat, black shirt → navy.
    "moustache": dict(set="people1-mustache", exprs={"base": "base", "happy": "happy", "sad": "sad", "angry": "serious", "surprised": "surprised"},
                      head=(0.26, 0.02, 0.84), shirt_y=0.70, coat_y=0.70, grey=0.12),
}


def ramp(colors, t):
    t = min(0.999, max(0.0, t))
    return colors[int(t * len(colors))]


def recolor(im: Image.Image, spec) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    hair_v = []
    cells = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            fy = y / h
            # skin: warm, light, moderately saturated — leave as is
            skin = 0.02 <= hh <= 0.12 and 0.15 <= s <= 0.6 and v >= 0.62
            if skin and fy < spec["coat_y"] + (0.12 if spec["set"] == "people2-white-elder" else 0.0):
                continue
            if spec["set"] == "people2-white-elder":
                fx0, fy0, fx1, fy1 = spec["face"]
                in_face = fx0 <= x / w <= fx1 and fy0 <= fy <= fy1
                if in_face and 0.0 <= hh <= 0.14 and s >= 0.05 and v > 0.8:
                    continue  # pale skin highlight, not hair
                if s < 0.16 and v > 0.45:
                    kind = "shirt" if fy > spec["shirt_y"] and abs(x / w - 0.62) < 0.18 else "hair"
                elif fy > spec["coat_y"] and not skin:
                    kind = "coat"
                else:
                    continue
            else:
                if 0.0 <= hh <= 0.08 and s > 0.55 and fy < spec["coat_y"]:
                    kind = "hair"
                elif fy > spec["coat_y"] and v < 0.25:
                    kind = "shirt"
                elif fy > spec["coat_y"] - 0.04 and not skin:
                    kind = "coat"
                else:
                    continue
            cells[(x, y)] = (kind, v)
            if kind == "hair":
                hair_v.append(v)
    hair_v.sort()
    cut = hair_v[int(len(hair_v) * (1 - spec["grey"]))] if hair_v else 2
    lo, hi = (hair_v[0], hair_v[-1]) if hair_v else (0, 1)
    for (x, y), (kind, v) in cells.items():
        a = px[x, y][3]
        if kind == "hair":
            if spec["set"] == "people1-mustache":
                # grey only at the temples (sides of the head, upper half)
                fx = x / w
                temple = (fx < 0.42 or fx > 0.78) and 0.12 < y / h < 0.45 and v > (lo + hi) / 2
                c = ramp(GREY, (v - lo) / max(1e-6, hi - lo)) if temple else ramp(HAIR, (v - lo) / max(1e-6, hi - lo))
            else:
                c = ramp(GREY, (v - cut) / max(1e-6, hi - cut)) if v >= cut else ramp(HAIR, (v - lo) / max(1e-6, cut - lo))
        elif kind == "coat":
            c = ramp(COAT, v / 0.6)
        else:
            c = ramp(NAVY, (v - (0.45 if spec["set"] == "people2-white-elder" else 0.0)) / 0.55)
        px[x, y] = (*c, a)
    return im


def head_box(src: Image.Image, spec):
    """Head extent from the source alpha: widest opaque span among rows above the coat line, and the top row."""
    src = src.convert("RGBA")
    w, h = src.size
    a = src.split()[3].load()
    top = next(y for y in range(h) if any(a[x, y] >= 128 for x in range(0, w, 2)))
    spans = []
    for y in range(top, int(h * (spec["coat_y"] - 0.08))):
        xs = [x for x in range(0, w, 2) if a[x, y] >= 128]
        if xs:
            spans.append((xs[-1] - xs[0], xs[0], xs[-1]))
    spans.sort()
    _, x0, x1 = spans[int(len(spans) * 0.9)]
    return x0 / w, top / h, x1 / w


def frame(im: Image.Image, spec, box) -> Image.Image:
    w, h = im.size
    x0, y0, x1 = box
    head_w = (x1 - x0) * w
    scale = 40 / head_w
    side = 64 / scale
    cx = (x0 + x1) / 2 * w
    left = cx - side / 2
    top = y0 * h - 3 / scale
    canvas = Image.new("RGBA", (int(side) + 2, int(side) + 2), (0, 0, 0, 0))
    canvas.alpha_composite(im, (int(-left), int(-top)))
    small = canvas.resize((64, 64), Image.LANCZOS)
    return small


def pixelize(small: Image.Image) -> Image.Image:
    px = small.load()
    for y in range(64):
        for x in range(64):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 140 else (0, 0, 0, 0)
    solid = small.copy()
    rgb = Image.new("RGB", (64, 64), (0, 0, 0))
    rgb.paste(solid, mask=solid.split()[3])
    q = rgb.quantize(colors=15, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    o, qp, sp = out.load(), q.load(), solid.load()
    for y in range(64):
        for x in range(64):
            if sp[x, y][3]:
                o[x, y] = (*qp[x, y], 255)
    # 1 px outline on the silhouette (inside edge), like the other cast busts
    edge = []
    for y in range(64):
        for x in range(64):
            if not sp[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < 64 and 0 <= ny < 64 and not sp[nx, ny][3]:
                    edge.append((x, y))
                    break
    for x, y in edge:
        if y < 63:
            o[x, y] = (*OUTLINE, 255)
    return out


def main() -> None:
    for key, spec in CANDIDATES.items():
        dest = OUT / f"shared-{key}"
        dest.mkdir(parents=True, exist_ok=True)
        for expr, src_expr in spec["exprs"].items():
            src = Image.open(SRC / spec["set"] / f"bust-{src_expr}.png")
            pixelize(frame(recolor(src, spec), spec, head_box(src, spec))).save(dest / f"bust-{expr}.png")
        print("wrote", dest)


if __name__ == "__main__":
    main()
