#!/usr/bin/env python3
"""Inspect, patch and export literal pixel grids. This tool does not design artwork."""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile


TRANSPARENT = (0, 0, 0, 0)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def integer(value, lo, hi, label):
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError(f"{label} must be an integer in {lo}..{hi}")
    return value


def rgba(color):
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def validate(source):
    if not isinstance(source, dict) or type(source.get("version")) is not int or source["version"] != 1:
        raise ValueError("Expected a version 1 pixel grid object")
    w = integer(source.get("width"), 1, 512, "width")
    h = integer(source.get("height"), 1, 512, "height")
    maximum = integer(source.get("maxColors", 16), 1, 64, "maxColors")
    palette = source.get("palette")
    if not isinstance(palette, dict):
        raise ValueError("palette must be an object")
    for key, color in palette.items():
        if len(key) != 1 or not 33 <= ord(key) <= 126 or key == ".":
            raise ValueError(f"Invalid palette symbol {key!r}; '.' is transparent")
        if not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            raise ValueError(f"Palette {key!r} must be an explicit #RRGGBB color")
    frames = source.get("frames")
    if not isinstance(frames, list) or not 1 <= len(frames) <= 128:
        raise ValueError("frames must contain 1..128 explicit frame objects")
    ids, colors = set(), set()
    for frame in frames:
        if not isinstance(frame, dict):
            raise ValueError("Each frame must be an object")
        key = frame.get("id")
        if not isinstance(key, str) or not key or key in ids:
            raise ValueError("Frame IDs must be unique nonempty strings")
        ids.add(key)
        duration = integer(frame.get("durationMs"), 10, 10000, f"{key}.durationMs")
        if duration % 10:
            raise ValueError(f"{key}.durationMs must be a multiple of 10ms to preserve GIF timing")
        rows = frame.get("rows")
        if not isinstance(rows, list) or len(rows) != h:
            raise ValueError(f"{key}: expected {h} explicit rows")
        for y, row in enumerate(rows):
            if not isinstance(row, str) or len(row) != w:
                raise ValueError(f"{key} row {y}: expected {w} characters")
            for x, symbol in enumerate(row):
                if symbol != ".":
                    if symbol not in palette:
                        raise ValueError(f"{key} ({x},{y}): unknown palette symbol {symbol!r}")
                    colors.add(rgba(palette[symbol]))
        if "anchor" in frame:
            anchor = frame["anchor"]
            if not isinstance(anchor, list) or len(anchor) != 2:
                raise ValueError(f"{key}.anchor must be [x,y]")
            integer(anchor[0], 0, w - 1, f"{key}.anchor.x")
            integer(anchor[1], 0, h - 1, f"{key}.anchor.y")
        if "phase" in frame and not isinstance(frame["phase"], str):
            raise ValueError(f"{key}.phase must be a string")
    if len(colors) > maximum:
        raise ValueError(f"Sheet uses {len(colors)} opaque RGB colors; maxColors is {maximum}")
    return source


def load(path):
    raw = Path(path).read_bytes()
    return validate(json.loads(raw)), sha(raw)


def pixels(source, frame):
    lookup = {key: rgba(color) for key, color in source["palette"].items()}
    lookup["."] = TRANSPARENT
    return [lookup[symbol] for row in frame["rows"] for symbol in row]


def summary(source, digest):
    records = []
    previous = None
    w = source["width"]
    all_colors, alpha = set(), set()
    for frame in source["frames"]:
        ink = pixels(source, frame)
        alpha.update(p[3] for p in ink)
        colors = {p for p in ink if p[3]}
        all_colors.update(colors)
        occupied = [i for i, p in enumerate(ink) if p[3]]
        box = None
        edges = []
        if occupied:
            xs, ys = [i % w for i in occupied], [i // w for i in occupied]
            box = [min(xs), min(ys), max(xs), max(ys)]
            if box[0] == 0: edges.append("left")
            if box[1] == 0: edges.append("top")
            if box[2] == w - 1: edges.append("right")
            if box[3] == source["height"] - 1: edges.append("bottom")
        row = {
            "id": frame["id"], "durationMs": frame["durationMs"],
            "opaquePixels": len(occupied), "opaqueColors": len(colors),
            "boundsInclusive": box, "touchesEdges": edges,
            "rgbaSha256": sha(bytes(channel for p in ink for channel in p)),
            "changedFromPrevious": None if previous is None else sum(a != b for a, b in zip(previous, ink)),
        }
        for key in ("anchor", "phase"):
            if key in frame: row[key] = frame[key]
        records.append(row)
        previous = ink
    return {
        "sourceSha256": digest, "width": w, "height": source["height"],
        "frames": records, "opaqueColors": len(all_colors), "alpha": sorted(alpha),
        "totalDurationMs": sum(f["durationMs"] for f in source["frames"]),
        "assessment": "File measurements only; artistic quality and authorship were not assessed.",
    }


def write_atomic(path, payload):
    path = Path(path)
    raw = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()
    fd, temp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream: stream.write(raw)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp): os.unlink(temp)
    return sha(raw)


def init(args):
    path = Path(args.source)
    if path.exists(): raise ValueError(f"Already exists: {path}")
    w, h = args.size
    integer(w, 1, 512, "width"); integer(h, 1, 512, "height")
    integer(args.frames, 1, 128, "frames")
    source = {
        "version": 1, "width": w, "height": h, "maxColors": 16, "palette": {},
        "frames": [{"id": f"f{i:02d}", "durationMs": 80, "rows": ["." * w for _ in range(h)]}
                   for i in range(args.frames)],
    }
    validate(source)
    path.parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps({"source": str(path), "sourceSha256": write_atomic(path, source), "blank": True}))


def inspect(args):
    source, digest = load(args.source)
    print(json.dumps(summary(source, digest), ensure_ascii=False, indent=2))
    if args.frame is None:
        if args.crop: raise ValueError("--crop requires --frame")
        return
    frame = next((f for f in source["frames"] if f["id"] == args.frame), None)
    if frame is None: raise ValueError(f"Unknown frame {args.frame!r}")
    x, y, w, h = args.crop or (0, 0, source["width"], source["height"])
    if min(x, y) < 0 or min(w, h) < 1 or x + w > source["width"] or y + h > source["height"]:
        raise ValueError("Crop must fit within the source grid")
    print("x:  " + "".join(str(i // 10 % 10) for i in range(x, x + w)))
    print("    " + "".join(str(i % 10) for i in range(x, x + w)))
    for i in range(y, y + h): print(f"{i:03d} {frame['rows'][i][x:x + w]}")
    print("palette: " + json.dumps(source["palette"], ensure_ascii=False))


def apply(args):
    source, digest = load(args.source)
    patch = json.loads(Path(args.patch).read_text())
    if not isinstance(patch, dict) or type(patch.get("version")) is not int or patch["version"] != 1:
        raise ValueError("Expected a version 1 coordinate patch")
    if patch.get("sourceSha256") != digest:
        raise ValueError("sourceSha256 does not match; inspect the current grid before applying")
    if set(patch) - {"version", "sourceSha256", "palette", "ops"}:
        raise ValueError("A patch accepts only palette entries and explicit coordinate ops")
    palette = patch.get("palette", {})
    ops = patch.get("ops", [])
    if not isinstance(palette, dict) or not isinstance(ops, list):
        raise ValueError("palette must be an object and ops must be an array")
    updated = deepcopy(source)
    updated["palette"].update(palette)
    frames = {f["id"]: f for f in updated["frames"]}
    for op in ops:
        if not isinstance(op, dict) or set(op) - {"frame", "x", "y", "pixels", "before"}:
            raise ValueError("Each op is {frame,x,y,pixels,before?}; drawing/transform commands are unsupported")
        frame = frames.get(op.get("frame"))
        if frame is None: raise ValueError(f"Unknown frame in op: {op.get('frame')!r}")
        x = integer(op.get("x"), 0, source["width"] - 1, "op.x")
        y = integer(op.get("y"), 0, source["height"] - 1, "op.y")
        run = op.get("pixels")
        if not isinstance(run, str) or not run or x + len(run) > source["width"]:
            raise ValueError("pixels must be a nonempty horizontal run within the frame")
        row = frame["rows"][y]
        if "before" in op and op["before"] != row[x:x + len(run)]:
            raise ValueError(f"before does not match {frame['id']} at ({x},{y})")
        frame["rows"][y] = row[:x] + run + row[x + len(run):]
    validate(updated)
    changes = {
        a["id"]: sum(p != q for p, q in zip(pixels(source, a), pixels(updated, b)))
        for a, b in zip(source["frames"], updated["frames"])
    }
    # Recheck after validation; a stale patch must never replace a concurrent edit.
    if sha(Path(args.source).read_bytes()) != digest:
        raise ValueError("Source changed during patch validation")
    result_hash = write_atomic(args.source, updated)
    journal = Path(str(args.source) + ".edits.jsonl")
    record = {"sourceSha256": digest, "resultSha256": result_hash, "changedPixels": changes, "patch": patch}
    with journal.open("a") as stream:
        stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(json.dumps({"sourceSha256": result_hash, "changedPixels": changes, "journal": str(journal)}))


def flat_pixels(image):
    return image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()


def render(args):
    from PIL import Image, ImageDraw, ImageFont

    source, digest = load(args.source)
    scale = integer(args.scale, 1, 12, "scale")
    out = Path(args.out)
    if out.resolve() == Path(args.source).resolve(): raise ValueError("Output must be a directory")
    w, h = source["width"], source["height"]
    frames = []
    for frame in source["frames"]:
        image = Image.new("RGBA", (w, h))
        image.putdata(pixels(source, frame))
        frames.append(image)
    planned = {"sheet.png", "report.json", "dark.gif", "light.gif", "checker.gif"}
    if Path(args.source).resolve().parent == out.resolve() and Path(args.source).name in planned:
        raise ValueError("Output filenames would overwrite the pixel source")
    out.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (w * len(frames), h), TRANSPARENT)
    for i, image in enumerate(frames): sheet.paste(image, (i * w, 0))
    sheet.save(out / "sheet.png", optimize=True)

    # Labels, grids and checker patterns belong only to review images.
    label = ImageFont.load_default()
    grid_scale = min(scale, max(1, 1480 // max(w, h)))
    for mode, preview_scale in (("native", 1), ("grid", grid_scale)):
        cw, ch = w * preview_scale + 44, h * preview_scale + 48
        columns = min(4, max(1, 1536 // cw))
        rows = max(1, 1536 // ch)
        per_page = columns * rows
        for start in range(0, len(frames), per_page):
            subset = frames[start:start + per_page]
            count_rows = (len(subset) + columns - 1) // columns
            board = Image.new("RGB", (cw * min(columns, len(subset)), ch * count_rows), "#182030")
            draw = ImageDraw.Draw(board)
            for n, image in enumerate(subset):
                index = start + n
                x, y = n % columns * cw + 30, n // columns * ch + 28
                draw.text((x - 22, y - 24), f"{index:02d} / {source['frames'][index]['durationMs']}ms", fill="white", font=label)
                thumb = image.resize((w * preview_scale, h * preview_scale), Image.Resampling.NEAREST)
                check = Image.new("RGB", thumb.size, "#d466b0")
                cd = ImageDraw.Draw(check)
                step = max(4, preview_scale * 2)
                for yy in range(0, check.height, step):
                    for xx in range(0, check.width, step):
                        if (xx // step + yy // step) % 2:
                            cd.rectangle((xx, yy, xx + step - 1, yy + step - 1), fill="#7b517e")
                check.paste(thumb, (0, 0), thumb)
                board.paste(check, (x, y))
                if mode == "grid" and preview_scale >= 4:
                    for xx in range(w + 1):
                        draw.line((x + xx * preview_scale, y, x + xx * preview_scale, y + h * preview_scale), fill="#536174")
                    for yy in range(h + 1):
                        draw.line((x, y + yy * preview_scale, x + w * preview_scale, y + yy * preview_scale), fill="#536174")
                    interval = max(1, 24 // preview_scale)
                    for xx in range(0, w, interval): draw.text((x + xx * preview_scale, y - 12), str(xx), fill="white", font=label)
                    for yy in range(0, h, interval): draw.text((x - 24, y + yy * preview_scale), str(yy), fill="white", font=label)
            board.save(out / f"contact-{mode}-{start // per_page:02d}.png")

    duration = [frame["durationMs"] for frame in source["frames"]]
    original_colors = sorted({p[:3] for f in source["frames"] for p in pixels(source, f) if p[3]})
    backgrounds = {"dark": [(24, 32, 48)], "light": [(237, 232, 221)],
                   "checker": [(212, 102, 176), (123, 81, 126)]}
    for name, bg in backgrounds.items():
        # Exact RGB lookup avoids implicit quantization of the authored colors.
        colors = list(dict.fromkeys(original_colors + bg))
        palette = [v for color in colors for v in color] + [0] * (768 - len(colors) * 3)
        color_index = {color: i for i, color in enumerate(colors)}
        animation = []
        for image in frames:
            thumb = image.resize((w * 2, h * 2), Image.Resampling.NEAREST)
            preview = Image.new("RGB", thumb.size, bg[0])
            if len(bg) > 1:
                draw = ImageDraw.Draw(preview)
                for y in range(0, h * 2, 8):
                    for x in range(0, w * 2, 8):
                        if (x // 8 + y // 8) % 2: draw.rectangle((x, y, x + 7, y + 7), fill=bg[1])
            preview.paste(thumb, (0, 0), thumb)
            indexed = Image.new("P", preview.size)
            indexed.putpalette(palette)
            indexed.putdata([color_index[p] for p in flat_pixels(preview)])
            animation.append(indexed)
        animation[0].save(out / f"{name}.gif", save_all=True, append_images=animation[1:],
                          duration=duration, loop=0, disposal=2, optimize=False)

    if sha(Path(args.source).read_bytes()) != digest:
        raise ValueError("Source changed during rendering; rerender from the current source")
    report = summary(source, digest)
    report["gifPreviewScale"] = 2
    report["reviewGridScale"] = grid_scale
    # Prove that saved native PNG pixels match the explicit source, not merely its dimensions.
    with Image.open(out / "sheet.png") as saved:
        saved = saved.convert("RGBA")
        for i, frame in enumerate(source["frames"]):
            actual = list(flat_pixels(saved.crop((i * w, 0, (i + 1) * w, h))))
            if actual != pixels(source, frame): raise ValueError(f"PNG pixel mismatch in {frame['id']}")
    report["nativePngMatchesSource"] = True
    report["outputs"] = {p.name: sha(p.read_bytes()) for p in sorted(out.iterdir())
                         if p.is_file() and (p.name in planned - {"report.json"} or p.name.startswith("contact-"))}
    write_atomic(out / "report.json", report)
    print(json.dumps({"out": str(out), "sourceSha256": digest, "nativePngMatchesSource": True,
                      "frames": len(frames), "opaqueColors": report["opaqueColors"]}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("init", help="Create only blank, transparent grids")
    p.add_argument("source"); p.add_argument("--size", nargs=2, type=int, required=True)
    p.add_argument("--frames", type=int, default=1); p.set_defaults(run=init)
    p = commands.add_parser("inspect", help="Read palette, hashes, frame measurements and coordinates")
    p.add_argument("source"); p.add_argument("--frame")
    p.add_argument("--crop", nargs=4, type=int); p.set_defaults(run=inspect)
    p = commands.add_parser("apply", help="Apply only explicit coordinate/color runs")
    p.add_argument("source"); p.add_argument("patch"); p.set_defaults(run=apply)
    p = commands.add_parser("render", help="Export literal pixels and review images")
    p.add_argument("source"); p.add_argument("--out", required=True)
    p.add_argument("--scale", type=int, default=6); p.set_defaults(run=render)
    args = parser.parse_args()
    try:
        args.run(args)
    except (ValueError, OSError, TypeError, KeyError, json.JSONDecodeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
