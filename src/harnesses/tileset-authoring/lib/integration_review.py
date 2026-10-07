"""현재 배선한 7시트의 시각 검수 자료. 검사 결과를 점수로 바꾸지 않는다.

python3 src/harnesses/tileset-authoring/lib/integration_review.py --out verify-shots/tileset-i6
맵 원본·2배 모음·모든 구조 물체·바닥 3×3 반복·I5 이후 변화 및 같은 이름 칸 대조를 남긴다.
원작 학습 그림은 읽거나 복사하지 않는다.
"""
import argparse
import hashlib
import json
import re
from itertools import combinations
from pathlib import Path

from PIL import Image, ImageDraw
from refdocs import _render

ROOT = Path(__file__).resolve().parents[4]
RUNS = ROOT / "qa-runs/harnesses/tileset-authoring"
OLD = dict(overworld="d99", coast="c106", climate="k102", dungeon="u100", rooms="r101", gyms="g102", wild="w196")


def contact(items, output, cols=3, scale=2, grid=False, compact=False):
    """그림 크기를 줄이지 않고 원 픽셀 정수 배율로 배열한다."""
    ims = [(label, im.convert("RGBA").resize((im.width * scale, im.height * scale), Image.Resampling.NEAREST)) for label, im in items]
    if compact:
        # A large structure must not shrink the small props alongside it when a viewer fits the page.
        positions, x, y, rh, in_row, width = [], 0, 0, 0, 0, 0
        measure = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        for label, im in ims:
            box = measure.textbbox((0, 0), label)
            cw = max(im.width, box[2] - box[0]) + 16
            if in_row and (in_row == cols or x + cw > 1280):
                x, y, rh, in_row = 0, y + rh, 0, 0
            positions.append((x, y)); x += cw; width = max(width, x)
            rh = max(rh, im.height + 32); in_row += 1
        size = (width, y + rh)
    else:
        cw = max(max(i.width, len(label) * 6) for label, i in ims) + 16
        ch = max(i.height for _, i in ims) + 32
        positions = [(n % cols * cw, n // cols * ch) for n in range(len(ims))]
        size = (cw * cols, ch * ((len(ims) + cols - 1) // cols))
    out = Image.new("RGBA", size, "#252831")
    d = ImageDraw.Draw(out)
    for n, (label, im) in enumerate(ims):
        x, y = positions[n]
        d.text((x + 4, y + 4), label, fill="white")
        out.alpha_composite(im, (x + 4, y + 24))
        if grid:
            for gx in range(0, im.width + 1, 16 * scale):
                d.line((x + 4 + gx, y + 24, x + 4 + gx, y + 24 + im.height), fill="#b04a87")
            for gy in range(0, im.height + 1, 16 * scale):
                d.line((x + 4, y + 24 + gy, x + 4 + im.width, y + 24 + gy), fill="#b04a87")
    out.convert("RGB").save(output, optimize=True)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True)
    args = ap.parse_args(); out = Path(args.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    idx = json.loads((ROOT / "src/assets/monsterKit/index.json").read_text())
    sheets, report = {}, {"sheets": {}, "same_names": [], "unique_objects": [], "unique_grounds": []}
    unique_objects, unique_grounds, crops = {}, {}, []
    for row in idx:
        theme, run = row["theme"], row["run"]; key = theme.removeprefix("monster-")
        base = RUNS / theme / run; bake = base / "bake"; dest = out / key; dest.mkdir(exist_ok=True)
        tiles = json.loads((base / "tiles.json").read_text()); ids = tiles["ids"]; cols = tiles["cols"]
        sheet = Image.open(base / "candidate.png").convert("RGBA")
        def tile(i):
            x, y = i % cols * 16, i // cols * 16
            return sheet.crop((x, y, x + 16, y + 16))
        hashes = {name: hashlib.sha256(tile(i).tobytes()).hexdigest() for name, i in ids.items()}
        sheets[key] = hashes
        maps, changes, map_hashes = [], [], {}
        oldbase = RUNS / theme / OLD[key]
        oldids = json.loads((oldbase / "tiles.json").read_text())["ids"]
        oldnames = {i: n for n, i in oldids.items()}; names = {i: n for n, i in ids.items()}
        for p in sorted(bake.glob("verify-*.json")):
            if "-err-" in p.stem: continue
            name = p.stem.removeprefix("verify-")
            im = _render(bake, p.name); im.save(dest / f"{name}.png", optimize=True)
            maps.append((name, im))
            map_hashes[name] = hashlib.sha256(im.tobytes()).hexdigest()
            # Every normal sample has a 4x tile-grid crop, separate from the native-size view.
            # Choose entrances/material junctions for the maps changed in I6.
            focus = {("overworld", "map"): (2, 2), ("overworld", "route"): (2, 1),
                     ("climate", "ash_town"): (13, 7), ("climate", "ice_route"): (12, 5),
                     ("climate", "desert"): (10, 10), ("wild", "river"): (15, 19),
                     ("dungeon", "sea_cave"): (0, 5), ("dungeon", "lava_cave"): (5, 6),
                     ("gyms", "gym_dragon"): (4, 3)}
            cx, cy = focus.get((key, name), (max(0, im.width // 32 - 4), max(0, im.height // 32 - 4)))
            crop = im.crop((cx * 16, cy * 16, min(im.width, (cx + 8) * 16), min(im.height, (cy + 8) * 16)))
            crops.append((f"{key}:{name} ({cx},{cy})", crop))
            oldp = oldbase / "bake" / p.name
            if oldp.exists():
                m, old = json.loads(p.read_text()), json.loads(oldp.read_text())
                if (m["width"], m["height"]) != (old["width"], old["height"]):
                    changes.append({"map": name, "resized": [old["width"], old["height"], m["width"], m["height"]]})
                else:
                    count = sum(any(names.get(m[layer][i], "empty") != oldnames.get(old[layer][i], "empty")
                                    for layer in ("lower", "upper")) for i in range(len(m["lower"])))
                    changes.append({"map": name, "changed_cells": count})
                # Tile-name equality is distinct from equality of the final rendered pixels.
                oldim = _render(oldbase / "bake", p.name)
                if oldim.size == im.size:
                    oldbytes, newbytes = oldim.tobytes(), im.tobytes()
                    changed_px = sum(oldbytes[i:i + 4] != newbytes[i:i + 4] for i in range(0, len(newbytes), 4))
                    changes[-1]["changed_render_pixels"] = changed_px
                if (key, name) in {("overworld", "map"), ("overworld", "route"), ("climate", "ash_town"),
                                   ("climate", "desert"), ("climate", "ice_route"), ("wild", "river"),
                                   ("dungeon", "sea_cave"), ("gyms", "gym_dragon")}:
                    contact([("I5", oldim), ("I6", im)], out / f"{key}-{name}-before-after.png", cols=2)
        for n in range(0, len(maps), 4): contact(maps[n:n + 4], dest / f"maps-{n // 4 + 1}.png", cols=2)
        objects = []
        for obj in json.loads((bake / "objects.json").read_text()):
            im = Image.new("RGBA", (obj["width"] * 16, obj["height"] * 16), "#aeb278")
            for layer in ("rowsLower", "rowsUpper"):
                for y, row_ in enumerate(obj[layer]):
                    for x, i in enumerate(row_):
                        if i >= 0: im.alpha_composite(tile(i), (x * 16, y * 16))
            objects.append((obj["name"], im))
            digest = hashlib.sha256(im.tobytes() + str(im.size).encode()).hexdigest()
            entry = unique_objects.setdefault(digest, {"image": im, "aliases": []})
            entry["aliases"].append(f"{key}:{obj['name']}")
        used_upper = set()
        for p in sorted(bake.glob("verify-*.json")):
            if "-err-" not in p.stem:
                used_upper.update(json.loads(p.read_text())["upper"])
        object_ids = {i for obj in json.loads((bake / "objects.json").read_text())
                      for layer in ("rowsLower", "rowsUpper") for row_ in obj[layer] for i in row_}
        for name, i in ids.items():
            if i not in used_upper or i in object_ids or "." in name: continue
            if re.search(r"at\d|rnd\d|fringe|ledge|fence|face_|rim_|wall|edge_|_f[123]$", name): continue
            im = Image.new("RGBA", (16, 16), "#aeb278"); im.alpha_composite(tile(i))
            digest = hashlib.sha256(im.tobytes() + str(im.size).encode()).hexdigest()
            entry = unique_objects.setdefault(digest, {"image": im, "aliases": []})
            entry["aliases"].append(f"{key}:{name}")
        for n in range(0, len(objects), 16): contact(objects[n:n + 16], dest / f"objects-{n // 16 + 1}.png", cols=4, scale=3)
        ground = []
        for name, i in ids.items():
            if re.search(r"(?:floor|_fl_|fl\d|sand\d|snow\d|ash\d|grass\d|atin\d_\d|_at255(?:_f0)?$)", name) and "." not in name and not re.search(r"_f[123]$", name):
                t = tile(i)
                if t.getchannel("A").getextrema() != (255, 255): continue
                im = Image.new("RGBA", (48, 48))
                for y in range(3):
                    for x in range(3): im.paste(t, (16 * x, 16 * y))
                ground.append((name, im))
                digest = hashlib.sha256(im.tobytes()).hexdigest()
                entry = unique_grounds.setdefault(digest, {"image": im, "aliases": []})
                entry["aliases"].append(f"{key}:{name}")
        for n in range(0, len(ground), 32): contact(ground[n:n + 32], dest / f"grounds-{n // 32 + 1}.png", cols=8)
        report["sheets"][key] = {"run": run, "maps": len(maps), "objects": len(objects), "grounds": len(ground), "map_changes": changes, "map_sha256": map_hashes,
                                    "sheet_sha256": hashlib.sha256(sheet.tobytes()).hexdigest()}
    for kind, entries, per_page, columns in (("objects", unique_objects, 12, 4), ("grounds", unique_grounds, 24, 6)):
        items = [(e["aliases"][0], e["image"]) for e in entries.values()]
        for n in range(0, len(items), per_page):
            contact(items[n:n + per_page], out / f"unique-{kind}-{n // per_page + 1}.png", cols=columns, scale=4, grid=True, compact=kind == "objects")
        report[f"unique_{kind}"] = [{"aliases": e["aliases"], "page": n // per_page + 1} for n, e in enumerate(entries.values())]
    for n in range(0, len(crops), 4): contact(crops[n:n + 4], out / f"grid-crops-{n // 4 + 1}.png", cols=2, scale=4, grid=True)
    for a, b in combinations(sheets, 2):
        shared = sheets[a].keys() & sheets[b].keys()
        diff = sorted(n for n in shared if sheets[a][n] != sheets[b][n])
        report["same_names"].append({"a": a, "b": b, "shared": len(shared), "different": diff})
    (out / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: {n: v for n, v in d.items() if n in ("run", "maps", "objects", "grounds")} for k, d in report["sheets"].items()}))
    print("same-name differences:", sum(len(q["different"]) for q in report["same_names"]))


if __name__ == "__main__": main()
