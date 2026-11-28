"""Command-line entry point for object-gen-v2."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .pack import build_store_pack
from .palette import load_palette, verify_sprite
from .sheet import build_contact_sheets, build_gallery_html


def _collect_1x_pngs(target: Path) -> list[Path]:
    if target.is_file():
        return [target]
    return sorted(p for p in target.glob("*.png") if not p.stem.endswith("-x4"))


def cmd_verify(args: argparse.Namespace) -> int:
    allowed = load_palette(args.palette) if args.palette else None
    pngs = _collect_1x_pngs(Path(args.path))
    if not pngs:
        print(f"No 1x PNGs found under {args.path}", file=sys.stderr)
        return 1

    failed = 0
    rows = []
    for p in pngs:
        rep = verify_sprite(p, allowed, forbid_pure_black=args.no_pure_black)
        rows.append(rep)
        status = "PASS" if rep.ok else "FAIL"
        if not rep.ok:
            failed += 1
        err_s = f" | {'; '.join(rep.errors)}" if rep.errors else ""
        print(
            f"[{status}] {p.name:36s} {rep.width:3d}x{rep.height:<3d} "
            f"colors={rep.unique_colors:2d} pv={rep.palette_violations} av={rep.alpha_violations} "
            f"sha={rep.pixel_sha256[:12]}{err_s}"
        )
    print(f"Summary: {len(rows) - failed}/{len(rows)} PASS")
    return 1 if failed else 0


def cmd_sheet(args: argparse.Namespace) -> int:
    pngs = _collect_1x_pngs(Path(args.path))
    if not pngs:
        print(f"No 1x PNGs found under {args.path}", file=sys.stderr)
        return 1
    out = Path(args.out)
    sheets = build_contact_sheets(pngs, out, per_sheet=args.per_sheet, cols=args.cols)
    for s in sheets:
        print(f"Wrote QA sheet: {s}")
    if args.html:
        before_map: dict[str, Path] = {}
        if args.before_dir:
            bdir = Path(args.before_dir)
            for p in pngs:
                cand = bdir / p.name
                if cand.exists():
                    before_map[p.stem] = cand
        html_path = build_gallery_html(pngs, out / "gallery.html", title=args.title, before_map=before_map)
        print(f"Wrote HTML gallery: {html_path}")
    return 0


def cmd_pack(args: argparse.Namespace) -> int:
    out = build_store_pack(
        args.spec,
        args.out,
        tiles_per_row=args.tiles_per_row,
        palette_override=args.palette,
    )
    print(f"Packed oprn-store-pack/1 -> {out}")
    return 0


def cmd_init_batch(args: argparse.Namespace) -> int:
    root = Path(args.dir)
    (root / "pieces").mkdir(parents=True, exist_ok=True)
    spec_path = root / "spec.json"
    if spec_path.exists() and not args.force:
        print(f"Refusing to overwrite existing {spec_path} (pass --force)", file=sys.stderr)
        return 1
    spec = {
        "packId": root.name,
        "title": args.title or root.name,
        "summary": f"Carbon Medium 1-pass 3/4 objects ({root.name})",
        "model": "gemini-4-carbon (thought_level: medium)",
        "license": "CC0",
        "palette": args.palette,
        "piecesDir": "pieces",
        "items": [],
    }
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Initialized batch -> {root}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="object-gen-v2", description="Carbon Medium 1-pass 3/4 pixel-art toolkit")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ver = sub.add_parser("verify", help="Verify 1x PNGs against locked palette & binary alpha")
    p_ver.add_argument("path", help="Directory of 1x PNGs or a single PNG file")
    p_ver.add_argument("--palette", help="Locked palette .json or .pal file")
    p_ver.add_argument("--no-pure-black", action="store_true", help="Fail if any #000000 pixel is present")
    p_ver.set_defaults(func=cmd_verify)

    p_sh = sub.add_parser("sheet", help="Build 4x QA contact sheet PNGs (+ optional HTML gallery)")
    p_sh.add_argument("path", help="Directory of 1x PNGs")
    p_sh.add_argument("--out", required=True, help="Output directory")
    p_sh.add_argument("--per-sheet", type=int, default=20)
    p_sh.add_argument("--cols", type=int, default=5)
    p_sh.add_argument("--html", action="store_true", help="Also emit gallery.html")
    p_sh.add_argument("--before-dir", help="Optional folder of before 1x PNGs matching filenames")
    p_sh.add_argument("--title", default="object-gen-v2 QA Gallery")
    p_sh.set_defaults(func=cmd_sheet)

    p_pk = sub.add_parser("pack", help="Compile spec.json + verified PNGs into oprn-store-pack/1")
    p_pk.add_argument("spec", help="Path to batch spec.json")
    p_pk.add_argument("--out", required=True, help="Output pack folder")
    p_pk.add_argument("--tiles-per-row", type=int, default=16)
    p_pk.add_argument("--palette", help="Override palette path")
    p_pk.set_defaults(func=cmd_pack)

    p_init = sub.add_parser("init-batch", help="Scaffold a new batch folder with spec.json")
    p_init.add_argument("dir", help="Batch directory to create")
    p_init.add_argument("--palette", default="palettes/fable-city.json")
    p_init.add_argument("--title")
    p_init.add_argument("--force", action="store_true")
    p_init.set_defaults(func=cmd_init_batch)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
