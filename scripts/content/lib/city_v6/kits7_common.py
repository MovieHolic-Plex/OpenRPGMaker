# Round-2 (v7) kit interface: new hand-drawn 버들항 kits (noble manor, outskirts houses, ...) are written as
#   tiledata/beodeul-city/kits7/<id>.json  +  <id>.up.png (upper layer, transparent background)  [+ <id>.lo.png (lower layer)]
# and cut into cells by scripts/content/build-beodeul-city.py (read_kits7). Nothing here draws; it validates and previews.
#
# A kit is a W x H grid of 16 px cells. `walk` has one string of W chars per row:
#   X  blocked cell (wall, roof body, trunk, furniture): upper picture drawn, y-sorted solid object
#   C  walkable cell whose upper picture is drawn OVER the player (eave overhang, chimney/cone tip, canopy)
#   F  walkable floor (path, gravel, plaza stone): usually a lower picture, no upper picture
#   .  empty: nothing is stamped, the ground already there stays
# lower picture: RGBA; a cell is stamped as lower only if ALL its 256 pixels are opaque (grass cells you want to keep
# must be left fully transparent, so they show the map's own lawn).  upper picture: any cell with alpha>0 is stamped.
import os, sys, json, pathlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
ROOT = pathlib.Path(__file__).resolve().parents[4]
KITS7 = ROOT / "tiledata/beodeul-city/kits7"
PREVIEW = ROOT / "scripts/.scratch/r2/kits7_preview"
T = 16
ROLES = ("district", "building", "part", "prop", "garden")

def save_kit(kid, name, up, walk, description, rules, tags, role="building", lo=None, doors=(), notes=None, assembly=None):
    """up/lo: PIL RGBA images with size (W*16, H*16) (extra bottom rows are cropped); walk: list of H strings of W chars.
    doors: [(dx, dy, note)] cell coordinates of a door cell (blocked); the cell below must be walkable (F/C or outside the kit).
    assembly: [(part_kit_id, x, y)] — the part kits (already saved) this kit is composed of, in stamping order; the kit's own
    pictures must be exactly those parts composited at those cell offsets (validate() checks it)."""
    H = len(walk); W = len(walk[0])
    assert all(len(r) == W for r in walk), f"{kid}: ragged walk rows"
    assert set("".join(walk)) <= set("XCF."), f"{kid}: bad walk chars"
    assert role in ROLES, role
    up = up.convert("RGBA").crop((0, 0, W * T, H * T)); assert up.size == (W * T, H * T), f"{kid}: upper picture smaller than {W}x{H} cells ({up.size})"
    KITS7.mkdir(parents=True, exist_ok=True)
    up.save(KITS7 / f"{kid}.up.png", optimize=True)
    lop = KITS7 / f"{kid}.lo.png"
    if lo is not None:
        lo = lo.convert("RGBA").crop((0, 0, W * T, H * T)); lo.save(lop, optimize=True)
    elif lop.exists(): lop.unlink()
    spec = dict(id=kid, name=name, w=W, h=H, walk=list(walk), description=description, rules=rules, tags=list(tags), role=role,
                doors=[dict(dx=d[0], dy=d[1], note=d[2] if len(d) > 2 else "문 칸") for d in doors], notes=notes or "",
                assembly=[dict(kit=a[0], x=a[1], y=a[2]) for a in (assembly or [])])
    (KITS7 / f"{kid}.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n")
    return spec

def load_kit(kid):
    spec = json.loads((KITS7 / f"{kid}.json").read_text())
    up = Image.open(KITS7 / f"{kid}.up.png").convert("RGBA")
    lp = KITS7 / f"{kid}.lo.png"
    return spec, up, (Image.open(lp).convert("RGBA") if lp.exists() else None)

def all_kits():
    return sorted(p.name[:-5] for p in KITS7.glob("*.json"))

def validate(kid):
    """Returns a list of problems (empty = ok)."""
    spec, up, lo = load_kit(kid); W, H = spec["w"], spec["h"]; errs = []
    import numpy as np
    A = np.array(up)[..., 3]; L = np.array(lo)[..., 3] if lo is not None else None
    for y in range(H):
        for x in range(W):
            c = spec["walk"][y][x]
            ua = A[y * T:(y + 1) * T, x * T:(x + 1) * T]; has_up = bool(ua.any())
            la = L[y * T:(y + 1) * T, x * T:(x + 1) * T] if L is not None else None
            has_lo = la is not None and bool((la == 255).all())
            if la is not None and la.any() and not has_lo: errs.append(f"({x},{y}) lower picture is partly transparent")
            if ua.any() and (ua == 0).any() and c == "F" and not has_lo: pass
            if c == "." and (has_up or has_lo): errs.append(f"({x},{y}) '.' cell has a picture")
            if c in "XC" and not has_up: errs.append(f"({x},{y}) '{c}' cell has no upper picture")
            if c == "F" and not has_lo and not has_up: errs.append(f"({x},{y}) 'F' cell has no picture at all")
            if c == "X" and has_lo and not has_up: errs.append(f"({x},{y}) blocked cell without upper picture")
    if spec.get("assembly"):
        cu = Image.new("RGBA", up.size); cl = Image.new("RGBA", up.size)
        for a in spec["assembly"]:
            ps, pu, pl_ = load_kit(a["kit"]); cu.alpha_composite(pu, (a["x"] * T, a["y"] * T))
            if pl_ is not None: cl.alpha_composite(pl_, (a["x"] * T, a["y"] * T))
        du = int((np.array(cu) != np.array(up)).any(axis=2).sum())
        if du: errs.append(f"assembly of parts differs from the kit's upper picture in {du} px")
        if lo is not None or np.array(cl)[..., 3].any():
            dl = int((np.array(cl) != np.array(lo if lo is not None else Image.new("RGBA", up.size))).any(axis=2).sum())
            if dl: errs.append(f"assembly of parts differs from the kit's lower picture in {dl} px")
    for d in spec["doors"]:
        dx, dy = d["dx"], d["dy"]
        if spec["walk"][dy][dx] != "X": errs.append(f"door ({dx},{dy}) is not a blocked cell")
        if dy + 1 < H and spec["walk"][dy + 1][dx] not in "FC.": errs.append(f"the cell below door ({dx},{dy}) is not walkable")
    return errs

def preview(kid, scale=3, bg=(70, 120, 60)):
    """Two panels: the kit on grass, and the collision overlay (red = blocked, cyan = drawn over the player, green = floor)."""
    spec, up, lo = load_kit(kid); W, H = spec["w"], spec["h"]
    base = Image.new("RGBA", (W * T, H * T), bg + (255,))
    try:
        import palette, ground  # noqa
    except Exception: pass
    if lo is not None: base.alpha_composite(lo)
    base.alpha_composite(up)
    over = base.copy(); d = ImageDraw.Draw(over, "RGBA")
    col = {"X": (255, 40, 40, 90), "C": (40, 220, 255, 90), "F": (60, 255, 90, 60)}
    for y in range(H):
        for x in range(W):
            c = spec["walk"][y][x]
            if c in col: d.rectangle((x * T, y * T, x * T + 15, y * T + 15), fill=col[c], outline=col[c][:3] + (160,))
    for dr in spec["doors"]: d.rectangle((dr["dx"] * T + 2, dr["dy"] * T + 2, dr["dx"] * T + 13, dr["dy"] * T + 13), outline=(255, 255, 0, 255), width=2)
    out = Image.new("RGBA", ((W * T) * 2 + 8, H * T), (20, 20, 24, 255)); out.paste(base, (0, 0)); out.paste(over, (W * T + 8, 0))
    out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
    PREVIEW.mkdir(parents=True, exist_ok=True); p = PREVIEW / f"{kid}.png"; out.save(p); return p

if __name__ == "__main__":
    ids = sys.argv[1:] or all_kits()
    bad = 0
    for k in ids:
        e = validate(k); p = preview(k)
        print(k, "OK" if not e else f"{len(e)} problems", p)
        for x in e[:12]: print("   ", x)
        bad += bool(e)
    sys.exit(1 if bad else 0)
