#!/usr/bin/env python3
"""
interactive-props harness CLI.

Manages the 100-object multi-frame PNG strip library across eras
(fantasy, dungeon, modern, joseon, murim, scifi, steampunk):
  validate  — check seed.json integrity and counts
  list      — list seeded items by wave / era with picked & built status
  gate      — run mechanical pixel-art & animation checks on picked PNG strips
  sheet     — generate GIF showcase & frame-breakdown PNG sheet in qa-runs/
  pick      — verify & record a strip PNG into picked/ + ledger.json (SHA-256 bound)
  build     — copy verified picked strips to public/assets/harnesses/interactive-props/
              and emit src/assets/interactivePropsCatalog.json
  status    — print wave & era progress toward 100 props
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import taxonomy as TAX

SEED_PATH = ROOT / "harness-data" / "interactive-props" / "seed.json"
QUOTAS_PATH = ROOT / "harness-data" / "interactive-props" / "quotas.json"
LEDGER_PATH = ROOT / "harness-data" / "interactive-props" / "ledger.json"
PICKED_DIR = ROOT / "harness-data" / "interactive-props" / "picked"
PUBLIC_DIR = ROOT / "public" / "assets" / "harnesses" / "interactive-props"
CATALOG_OUT = ROOT / "src" / "assets" / "interactivePropsCatalog.json"
QA_DIR = ROOT / "qa-runs" / "harnesses" / "interactive-props"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_seed() -> dict:
    with SEED_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_ledger() -> dict:
    if not LEDGER_PATH.exists():
        return {"version": 1, "picks": {}}
    with LEDGER_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_ledger(ledger: dict) -> None:
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER_PATH.open("w", encoding="utf-8") as f:
        json.dump(ledger, f, ensure_ascii=False, indent=2)
        f.write("\n")


def frame_pixels(fr: Image.Image) -> list:
    getter = getattr(fr, "get_flattened_data", fr.getdata)
    return list(getter())


def check_strip_gate(item: dict, strip_path: Path) -> tuple[list[str], list[str]]:
    """Mechanical checks: returns (errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []
    if not strip_path.exists():
        return [f"missing strip file: {strip_path}"], []

    im = Image.open(strip_path).convert("RGBA")
    fw = int(item["frameWidth"])
    fh = int(item["frameHeight"])
    frames = int(item["frames"])
    expected_w = fw * frames

    # Z: Exact dimensions
    if im.width != expected_w or im.height != fh:
        errors.append(f"Z size mismatch: got {im.width}x{im.height}, expected {expected_w}x{fh} ({frames} frames of {fw}x{fh})")
        return errors, warnings

    # Slice frames and inspect alpha, pixel changes, and pure-black ratio
    frame_imgs = [im.crop((i * fw, 0, (i + 1) * fw, fh)) for i in range(frames)]
    pure_black_total = 0
    opaque_total = 0
    for idx, fr in enumerate(frame_imgs):
        data = frame_pixels(fr)
        opaque = sum(1 for _, _, _, a in data if a >= 128)
        clear = len(data) - opaque
        if opaque < 20:
            errors.append(f"A frame {idx} nearly empty ({opaque} opaque px)")
        if clear == 0 and idx == 0:
            warnings.append(f"A frame {idx} has zero transparent pixels (no sprite margin)")
        opaque_total += opaque
        pure_black_total += sum(1 for r, g, b, a in data if a >= 128 and r == 0 and g == 0 and b == 0)

    # D: Frame-to-frame motion delta
    changed_steps = 0
    for i in range(frames - 1):
        a = frame_pixels(frame_imgs[i])
        b = frame_pixels(frame_imgs[i + 1])
        diff = sum(1 for pa, pb in zip(a, b) if pa != pb)
        if diff >= 4:
            changed_steps += 1
    min_changes = max(1, frames - 2)
    if changed_steps < min_changes:
        errors.append(f"D insufficient animation motion: only {changed_steps}/{frames - 1} steps changed (need >= {min_changes})")

    # O: Pure black outline warning
    if opaque_total > 0 and (pure_black_total / opaque_total) > 0.15:
        warnings.append(f"O high pure-#000000 ratio ({pure_black_total}/{opaque_total}); prefer warm/hue-shifted outlines")

    return errors, warnings


def cmd_validate(_args) -> int:
    seed = load_seed()
    eras = set(seed["eras"])
    motions = set(seed["motions"])
    playbacks = set(seed["playbacks"])
    items = seed["items"]
    seen = set()
    errors = []

    for i, item in enumerate(items):
        iid = item.get("id", "")
        if not iid or iid in seen:
            errors.append(f"item[{i}] missing or duplicate id: {iid!r}")
        seen.add(iid)
        if item.get("era") not in eras:
            errors.append(f"{iid}: unknown era {item.get('era')!r}")
        if item.get("world") not in TAX.WORLDS:
            errors.append(f"{iid}: unknown world {item.get('world')!r}")
        if item.get("category") not in TAX.CATEGORIES:
            errors.append(f"{iid}: unknown category {item.get('category')!r}")
        if item.get("zone") not in TAX.ZONES:
            errors.append(f"{iid}: unknown zone {item.get('zone')!r}")
        if item.get("mount") not in TAX.MOUNTS:
            errors.append(f"{iid}: unknown mount {item.get('mount')!r}")
        genres = item.get("genres") or []
        if not genres or any(g not in TAX.GENRES for g in genres):
            errors.append(f"{iid}: invalid genres {genres!r}")
        roles = item.get("roles") or []
        if not roles or any(r not in TAX.ROLES for r in roles):
            errors.append(f"{iid}: invalid roles {roles!r}")
        if item.get("motion") not in motions:
            errors.append(f"{iid}: unknown motion {item.get('motion')!r}")
        if item.get("playback") not in playbacks:
            errors.append(f"{iid}: unknown playback {item.get('playback')!r}")
        if item.get("frames", 0) < 2:
            errors.append(f"{iid}: frames must be >= 2")
        if item.get("frameWidth", 0) < 8 or item.get("frameHeight", 0) < 8:
            errors.append(f"{iid}: invalid frame dimensions")
        src_png = item.get("sourcePng")
        if not src_png or not (ROOT / src_png).exists():
            errors.append(f"{iid}: missing real sourcePng {src_png!r}")
        open_png = item.get("sourceOpenPng")
        if open_png and not (ROOT / open_png).exists():
            errors.append(f"{iid}: missing sourceOpenPng {open_png!r}")

    target = seed.get("targetCount", 100)
    if len(items) != target:
        errors.append(f"item count {len(items)} != targetCount {target}")

    if errors:
        print("VALIDATE FAILED:")
        for e in errors:
            print("  -", e)
        return 1

    print(f"VALIDATE OK: {len(items)} items across {len(eras)} eras, {len(motions)} motion families.")
    return 0


def cmd_list(args) -> int:
    seed = load_seed()
    ledger = load_ledger()
    picks = ledger.get("picks", {})
    items = seed["items"]
    if args.wave:
        items = [x for x in items if x["wave"] == args.wave]
    if args.era:
        items = [x for x in items if x["era"] == args.era]

    print(f"{'ST':3} {'ID':26} {'WAVE':22} {'ERA':10} {'MOTION':14} {'FRAMES':7} {'SIZE':7} NAME")
    print("-" * 112)
    for item in items:
        iid = item["id"]
        picked = iid in picks and (PICKED_DIR / f"{iid}.png").exists()
        built = (PUBLIC_DIR / f"{iid}.png").exists()
        st = "★✓" if (picked and built) else ("★ " if picked else "· ")
        print(
            f"{st:3} {iid:26} {item['wave']:22} {item['era']:10} {item['motion']:14} "
            f"{item['frames']:<7} {item['frameWidth']}x{item['frameHeight']:<4} {item['name']}"
        )
    return 0


def cmd_gate(args) -> int:
    seed = load_seed()
    ledger = load_ledger()
    picks = ledger.get("picks", {})
    items = seed["items"]
    if args.wave:
        items = [x for x in items if x["wave"] == args.wave]
    if args.id:
        items = [x for x in items if x["id"] == args.id]

    checked = 0
    failed = 0
    for item in items:
        iid = item["id"]
        strip = PICKED_DIR / f"{iid}.png"
        if not strip.exists():
            continue
        checked += 1
        errs, warns = check_strip_gate(item, strip)
        rec = picks.get(iid)
        if rec and rec.get("sha256") != sha256_file(strip):
            errs.append(f"hash mismatch vs ledger ({rec.get('sha256')[:8]} != {sha256_file(strip)[:8]})")
        if errs:
            failed += 1
            print(f"FAIL {iid}: {'; '.join(errs)}")
        else:
            w = f" [WARN: {'; '.join(warns)}]" if warns else ""
            print(f"PASS {iid} ({item['frames']}x {item['frameWidth']}x{item['frameHeight']}){w}")

    print(f"Gate summary: {checked - failed}/{checked} passed, {failed} failed.")
    return 1 if failed else 0


def cmd_pick(args) -> int:
    seed = load_seed()
    by_id = {x["id"]: x for x in seed["items"]}
    item = by_id.get(args.id)
    if not item:
        print(f"Unknown prop id in seed.json: {args.id}", file=sys.stderr)
        return 1
    src = Path(args.strip).resolve()
    errs, warns = check_strip_gate(item, src)
    if errs:
        print(f"GATE FAILED for {args.id}:")
        for e in errs:
            print("  -", e)
        return 1

    PICKED_DIR.mkdir(parents=True, exist_ok=True)
    dst = PICKED_DIR / f"{args.id}.png"
    if src != dst:
        shutil.copy2(src, dst)
    digest = sha256_file(dst)

    ledger = load_ledger()
    ledger.setdefault("picks", {})[args.id] = {
        "sha256": digest,
        "pickedAt": datetime.now(timezone.utc).isoformat(),
        "by": args.by or "owner",
        "note": args.note or "",
    }
    save_ledger(ledger)
    w = f" (warnings: {', '.join(warns)})" if warns else ""
    print(f"PICKED {args.id} sha={digest[:12]}{w}")
    return 0


def cmd_build(_args) -> int:
    seed = load_seed()
    ledger = load_ledger()
    picks = ledger.get("picks", {})
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    catalog_entries = []
    errors = []
    for item in seed["items"]:
        iid = item["id"]
        rec = picks.get(iid)
        src = PICKED_DIR / f"{iid}.png"
        if not rec or not src.exists():
            continue
        actual_sha = sha256_file(src)
        if actual_sha != rec["sha256"]:
            errors.append(f"{iid}: picked PNG hash mismatch vs ledger")
            continue
        errs, _ = check_strip_gate(item, src)
        if errs:
            errors.append(f"{iid}: gate failed: {'; '.join(errs)}")
            continue
        dst = PUBLIC_DIR / f"{iid}.png"
        shutil.copy2(src, dst)
        entry = {
            "id": iid,
            "name": item["name"],
            "wave": item["wave"],
            "era": item["era"],
            "world": item["world"],
            "genres": item["genres"],
            "category": item["category"],
            "zone": item["zone"],
            "mount": item["mount"],
            "roles": item["roles"],
            "motion": item["motion"],
            "playback": item["playback"],
            "stripPath": f"assets/harnesses/interactive-props/{iid}.png",
            "frameWidth": item["frameWidth"],
            "frameHeight": item["frameHeight"],
            "frames": item["frames"],
            "frameMs": item["frameMs"],
            "footprint": item["footprint"],
            "anchorX": item["anchorX"],
            "anchorY": item["anchorY"],
            "se": item["se"],
            "tags": item["tags"],
            "sha256": actual_sha[:16],
        }
        if "containerStyle" in item:
            entry["containerStyle"] = item["containerStyle"]
        if "loopFromFrame" in item:
            entry["loopFromFrame"] = item["loopFromFrame"]
        if "sourcePng" in item:
            entry["sourcePng"] = item["sourcePng"]
        catalog_entries.append(entry)

    if errors:
        print("BUILD FAILED:")
        for e in errors:
            print("  -", e)
        return 1

    catalog = {
        "version": 1,
        "targetCount": seed.get("targetCount", 100),
        "builtCount": len(catalog_entries),
        "props": catalog_entries,
    }
    CATALOG_OUT.parent.mkdir(parents=True, exist_ok=True)
    with CATALOG_OUT.open("w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"BUILT {len(catalog_entries)}/{len(seed['items'])} interactive props -> {CATALOG_OUT.relative_to(ROOT)}")
    return 0


def cmd_sheet(args) -> int:
    seed = load_seed()
    items = seed["items"]
    if args.wave:
        items = [x for x in items if x["wave"] == args.wave]
    picked_items = [x for x in items if (PICKED_DIR / f"{x['id']}.png").exists()]
    if not picked_items:
        print("No picked strips found for sheet.")
        return 1

    out_dir = Path(args.out) if args.out else QA_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = args.wave or "all"

    # Build a crisp animated grid GIF sized cleanly to the tallest/widest frame in the batch
    cols = min(5, len(picked_items))
    rows = (len(picked_items) + cols - 1) // cols
    max_w = max(int(x["frameWidth"]) for x in picked_items)
    max_h = max(int(x["frameHeight"]) for x in picked_items)
    box_w = max(36, max_w + 4)
    box_h = max(36, max_h + 4)
    scale = 3 if max(box_w, box_h) <= 56 else 2
    cw, ch = box_w * scale, box_h * scale
    pad, hdr, lbl = 8, 28, 20
    gw = cols * (cw + pad) + pad
    gh = hdr + rows * (lbl + ch + pad) + pad

    loaded = []
    for item in picked_items:
        im = Image.open(PICKED_DIR / f"{item['id']}.png").convert("RGBA")
        fw, fh, nf = item["frameWidth"], item["frameHeight"], item["frames"]
        frs = [im.crop((i * fw, 0, (i + 1) * fw, fh)) for i in range(nf)]
        loaded.append((item, frs))

    gif_frames = []
    # 20 clean ticks (100ms-140ms feel) -> smaller, sharper, smoother GIFs!
    timeline_ms = [0, 140, 280, 420, 560, 680, 800, 920, 1060, 1200, 1340, 1480, 1620, 1760, 1900, 2040]
    for t_ms in timeline_ms:
        canvas = Image.new("RGBA", (gw, gh), (24, 26, 34, 255))
        dr = ImageDraw.Draw(canvas)
        dr.text((pad, 7), f"interactive-props [{tag}] ({len(loaded)} real-source props)", fill=(238, 240, 246, 255))
        for i, (item, frs) in enumerate(loaded):
            r, c = i // cols, i % cols
            x0 = pad + c * (cw + pad)
            y0 = hdr + r * (lbl + ch + pad)
            nf = len(frs)
            pb = item["playback"]
            if t_ms < 420:
                fi = 0
            elif pb == "break":
                fi = min(nf - 1, 1 + (t_ms - 420) // 130)
            elif pb == "loopAfterOpen":
                dt = t_ms - 420
                lf = item.get("loopFromFrame", max(1, nf - 2))
                if dt < lf * 130:
                    fi = min(nf - 1, 1 + dt // 130)
                else:
                    span = max(1, nf - lf)
                    fi = lf + ((dt - lf * 130) // 140) % span
            elif pb == "oneshot":
                fi = min(nf - 1, 1 + (t_ms - 420) // 130)
            elif t_ms < 1480:
                fi = min(nf - 1, 1 + (t_ms - 420) // 130)
            else:
                fi = max(0, nf - 2 - (t_ms - 1480) // 130)

            dr.rectangle([x0, y0, x0 + cw - 1, y0 + lbl - 1], fill=(38, 42, 54, 255))
            dr.text((x0 + 5, y0 + 4), item["id"][:22], fill=(232, 238, 246, 255))
            cell = Image.new("RGBA", (box_w, box_h), (46, 50, 62, 255))
            fr = frs[fi]
            cell.alpha_composite(fr, ((box_w - fr.width) // 2, (box_h - fr.height) // 2))
            canvas.paste(cell.resize((cw, ch), Image.NEAREST), (x0, y0 + lbl))
        gif_frames.append(canvas.convert("P", palette=Image.ADAPTIVE, colors=256))

    gif_path = out_dir / f"sheet-{tag}.gif"
    gif_frames[0].save(gif_path, save_all=True, append_images=gif_frames[1:], duration=135, loop=0, disposal=2)
    print(f"Wrote GIF sheet: {gif_path}")
    return 0


def cmd_status(_args) -> int:
    seed = load_seed()
    ledger = load_ledger()
    picks = ledger.get("picks", {})
    by_wave: dict[str, list[dict]] = {}
    by_era: dict[str, list[dict]] = {}
    for item in seed["items"]:
        by_wave.setdefault(item["wave"], []).append(item)
        by_era.setdefault(item["era"], []).append(item)

    total = len(seed["items"])
    picked_n = sum(1 for x in seed["items"] if x["id"] in picks and (PICKED_DIR / f"{x['id']}.png").exists())
    built_n = sum(1 for x in seed["items"] if (PUBLIC_DIR / f"{x['id']}.png").exists())
    print(f"interactive-props: {picked_n}/{total} picked, {built_n}/{total} built (target={seed.get('targetCount', 100)})")
    print("\nBy Wave:")
    for w, items in by_wave.items():
        p = sum(1 for x in items if x["id"] in picks and (PICKED_DIR / f"{x['id']}.png").exists())
        b = sum(1 for x in items if (PUBLIC_DIR / f"{x['id']}.png").exists())
        print(f"  {w:24} {p:2d}/{len(items):2d} picked   {b:2d}/{len(items):2d} built")
    print("\nBy Era:")
    for e, items in by_era.items():
        p = sum(1 for x in items if x["id"] in picks and (PICKED_DIR / f"{x['id']}.png").exists())
        b = sum(1 for x in items if (PUBLIC_DIR / f"{x['id']}.png").exists())
        print(f"  {e:14} {p:2d}/{len(items):2d} picked   {b:2d}/{len(items):2d} built")

    if QUOTAS_PATH.exists():
        quotas = json.loads(QUOTAS_PATH.read_text(encoding="utf-8"))
        m1 = quotas["milestones"]["m1"]
        full = quotas["milestones"]["full"]
        print(f"\n5-Axis Quota Progress (Built {built_n} / M1 {m1} / Full {full}):")
        print("  By Category:")
        for cat, q in quotas["byCategory"].items():
            cnt = sum(1 for x in seed["items"] if x.get("category") == cat)
            print(f"    {cat:14} {cnt:3d} / M1 {q['m1']:3d} (rem {max(0, q['m1'] - cnt):2d})  Full {q['full']:3d}  {q['label']}")
        print("  By Genre (multi-tag):")
        for gen, q in quotas["byGenre"].items():
            cnt = sum(1 for x in seed["items"] if gen in (x.get("genres") or []))
            print(f"    {gen:16} {cnt:3d} / M1 {q['m1']:3d} (rem {max(0, q['m1'] - cnt):2d})  Full {q['full']:3d}  {q['label']}")
        print("  By Role (multi-tag):")
        for rol, q in quotas["byRole"].items():
            cnt = sum(1 for x in seed["items"] if rol in (x.get("roles") or []))
            print(f"    {rol:14} {cnt:3d} / M1 {q['m1']:3d} (rem {max(0, q['m1'] - cnt):2d})  Full {q['full']:3d}  {q['label']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="interactive-props")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("validate")
    p_list = sub.add_parser("list")
    p_list.add_argument("--wave")
    p_list.add_argument("--era")

    p_gate = sub.add_parser("gate")
    p_gate.add_argument("--wave")
    p_gate.add_argument("--id")

    p_sheet = sub.add_parser("sheet")
    p_sheet.add_argument("--wave")
    p_sheet.add_argument("--out")

    p_pick = sub.add_parser("pick")
    p_pick.add_argument("id")
    p_pick.add_argument("strip")
    p_pick.add_argument("--by", default="owner")
    p_pick.add_argument("--note", default="")

    sub.add_parser("build")
    sub.add_parser("status")

    args = parser.parse_args()
    return {
        "validate": cmd_validate,
        "list": cmd_list,
        "gate": cmd_gate,
        "sheet": cmd_sheet,
        "pick": cmd_pick,
        "build": cmd_build,
        "status": cmd_status,
    }[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
