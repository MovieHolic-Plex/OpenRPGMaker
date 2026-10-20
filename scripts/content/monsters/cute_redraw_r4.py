#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
# ─── How to run ───
# python3 scripts/content/monsters/cute_redraw_r4.py --out-dir /tmp/x [--species a,b]   # preview only (repo untouched)
# python3 scripts/content/monsters/cute_redraw_r4.py --apply [--species a,b]           # write authored front+back, ledger, eyes.json
"""Round 4 (2026-10-20): 눈 판정 1 의 3차 불합격 14종을 몸 전체부터 다시 그린다 (사용자 「불합격인건 아예 다시그려」).

Every species is hand-written geometry + stamps on the shared kit (`cute_r4/kit.py`, one module per species in `cute_r4/`). Cuteness checklist (from the user's
style reference; designs, silhouettes and colours of that reference are NOT used):
  1. big expressive eyes with a white catchlight, both eyes readable in 3/4 facing the viewer
  2. big head : body ratio (stage 1 head ~45% of height, later stages sleeker but still a round face)
  3. rounded forms, soft silhouettes
  4. one or two signature features per species, exaggerated and clean
  5. friendly expression (small mouth / smile)
  6. flat colour areas: one shade + one highlight per material
  7. one dark-tinted outline colour per creature (never pure black)
  8. sturdy little legs/paws planted on the ground line
  9. elegant tails
 10. evolution lines stay recognisable (same signature, sleeker proportions)
Each species keeps its seed name, type, palette family and evolution relationship.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib  # noqa: E402

from cute_r4.kit import colours, ink_box  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "harness-data/monster-collect-species"
AUTHORED = DATA / "authored"

# The 14 species the user failed in 눈 판정 1 round 3 (n id).
SPECIES = ["sparkit", "leafling", "gustchick", "wickworm", "zaptoe", "lanternwing", "sandnip", "glaciermane",
           "dozemite", "trancescythe", "oraclemantis", "solmane", "lunavane", "astralhart"]


def drawer(sid: str):
    return importlib.import_module(f"cute_r4.{sid}").draw


# ═══════════════════════════════════════════════════════════════════════════
# preview / apply
# ═══════════════════════════════════════════════════════════════════════════
PASS_REF = {
    "sparkit": ["kilnclaw", "rootpig", "brookraft"],
    "leafling": ["frondhare", "rootpig", "aqualing"],
    "gustchick": ["ribbonwing", "brookraft", "pipbug"],
    "wickworm": ["beaconmoth", "pipbug", "rootpig"],
    "lanternwing": ["beaconmoth", "pipbug", "brookraft"],
    "zaptoe": ["coilcrest", "kilnclaw", "aqualing"],
    "sandnip": ["dunestalk", "coralpin", "rootpig"],
    "glaciermane": ["rimepelt", "flurrykit", "brambleboar"],
    "dozemite": ["hushdoll", "pipbug", "aqualing"],
    "trancescythe": ["hushdoll", "veilmaster", "coilcrest"],
    "oraclemantis": ["veilmaster", "galecrest", "grovewarden"],
    "solmane": ["kilnclaw", "rimepelt", "thundercairn"],
    "lunavane": ["winterquill", "abyssail", "brookraft"],
    "astralhart": ["grovewarden", "rimepelt", "frondhare"],
}


def bundle(sid: str, side: str) -> Image.Image:
    return Image.open(ROOT / f"public/assets/harnesses/monster-collect-species/{sid}/{side}.png").convert("RGBA")


def preview(sid: str, front: np.ndarray, back: np.ndarray, out: Path) -> None:
    S = 4
    refs = PASS_REF.get(sid, ["kilnclaw", "rootpig", "brookraft"])
    tiles = [Image.fromarray(front, "RGBA"), Image.fromarray(back, "RGBA"), bundle(sid, "front")] + [bundle(r, "front") for r in refs]
    labels = ["NEW front", "NEW back", "OLD front (failed)"] + [f"PASS {r}" for r in refs]
    bg = (122, 138, 106, 255)
    W = len(tiles) * (64 * S + 8) + 8
    sheet = Image.new("RGBA", (W, 64 * S + 16 + 64 + 16 + 14), bg)
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for i, t in enumerate(tiles):
        big = t.resize((64 * S, 64 * S), Image.NEAREST)
        sheet.paste(big, (8 + i * (64 * S + 8), 22), big)
        sheet.paste(t, (8 + i * (64 * S + 8) + 96, 64 * S + 38), t)
        d.text((10 + i * (64 * S + 8), 4), labels[i], fill=(255, 255, 255, 255))
    sheet.save(out / f"{sid}-preview.png")
    z = Image.new("RGBA", (64 * 8 * 2 + 8, 64 * 8), bg)
    for i, t in enumerate(tiles[:2]):
        big = t.resize((64 * 8, 64 * 8), Image.NEAREST)
        z.paste(big, (i * (64 * 8 + 8), 0), big)
    z.save(out / f"{sid}-zoom.png")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", type=Path)
    ap.add_argument("--species")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args(argv)
    only = a.species.split(",") if a.species else [s for s in SPECIES if (Path(__file__).parent / "cute_r4" / f"{s}.py").exists()]
    for sid in only:
        fn = drawer(sid)
        front, eyes = fn("front")
        back, _ = fn("back")
        from cute_r4.kit import bottom_align
        fys = np.nonzero(front[:, :, 3])[0].max()
        if fys != 63 and eyes:
            dy = 63 - int(fys)
            for k in ("near", "far", "second"):
                if eyes.get(k):
                    eyes[k] = [eyes[k][0], eyes[k][1] + dy, eyes[k][2], eyes[k][3]]
        from cute_r4.kit import despeckle
        front, back = despeckle(bottom_align(front)), despeckle(bottom_align(back))
        fb, bb = ink_box(front), ink_box(back)
        from cute_r4.eyecheck import check as eyecheck
        issues = eyecheck(front, eyes) if eyes else ["no eyes"]
        print(f"{sid}: EYE {issues or 'ok'}")
        print(f"{sid}: front ink {fb[2]}x{fb[3]} area {fb[2]*fb[3]} at y{fb[1]}-{fb[1]+fb[3]-1} colours {colours(front)} | back {bb[2]}x{bb[3]} y{bb[1]}-{bb[1]+bb[3]-1} colours {colours(back)} | eyes {eyes}")
        if a.out_dir:
            a.out_dir.mkdir(parents=True, exist_ok=True)
            Image.fromarray(front, "RGBA").save(a.out_dir / f"{sid}-front.png")
            Image.fromarray(back, "RGBA").save(a.out_dir / f"{sid}-back.png")
            preview(sid, front, back, a.out_dir)
        if a.apply:
            if issues:
                print(f"{sid}: eye check failed, not applied", file=sys.stderr)
                return 1
            apply(sid, front, back, eyes)
    if a.apply:
        write_tables()
    return 0


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def base_sha(path: Path) -> str | None:
    """sha256 of the file at the round-4 base commit (BASE env, else merge-base with origin/main)."""
    import os
    import subprocess
    rel = path.relative_to(ROOT).as_posix()
    base = os.environ.get("BASE") or subprocess.run(["git", "merge-base", "HEAD", "origin/main"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    r = subprocess.run(["git", "show", f"{base}:{rel}"], cwd=ROOT, capture_output=True)
    return hashlib.sha256(r.stdout).hexdigest() if r.returncode == 0 else None


_TABLE: dict | None = None
_LEDGER: dict | None = None


def tables() -> tuple[dict, dict]:
    global _TABLE, _LEDGER
    if _TABLE is None:
        _TABLE = json.loads((DATA / "eyes.json").read_text(encoding="utf-8"))
        _LEDGER = json.loads((DATA / "ledger.json").read_text(encoding="utf-8"))
    return _TABLE, _LEDGER


def apply(sid: str, front: np.ndarray, back: np.ndarray, eyes: dict) -> None:
    """Write authored front+back, point the ledger at them, and replace the species' eyes.json entry."""
    table, ledger = tables()
    picks = ledger["picks"][sid]
    shas = {}
    for side, arr in (("front", front), ("back", back)):
        path = AUTHORED / f"{sid}-{side}.png"
        before = base_sha(path)  # the round-3 file as committed (re-running --apply stays idempotent)
        Image.fromarray(arr, "RGBA").save(path, optimize=True)
        after = sha(path)
        pick = picks[side]
        if before:
            pick["previousAuthoredSha256"] = before
        else:
            pick.pop("previousAuthoredSha256", None)
        pick["authored"] = f"authored/{sid}-{side}.png"
        pick["authoredSha256"] = after
        shas[side] = (pick.get("previousAuthoredSha256"), after)
    entry = table["species"][sid]
    for k in ("repair", "frozen", "second", "accept"):
        entry.pop(k, None)
    entry["anatomy"] = eyes["anatomy"]
    entry["style"] = eyes["style"]
    entry["near"] = eyes["near"]
    entry["far"] = eyes.get("far")
    if eyes.get("second"):
        entry["second"] = eyes["second"]
    entry["patch"] = {"from": shas["front"][0], "to": shas["front"][1], "source": "cute_redraw_r4.py"}
    entry["chip"] = "clean"
    print(f"{sid}: applied front {shas['front'][1][:12]} back {shas['back'][1][:12]}")


def write_tables() -> None:
    table, ledger = tables()
    rows = ",\n".join(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in table["species"].items())
    (DATA / "eyes.json").write_text('{\n  "version": 1,\n  "species": {\n' + rows + "\n  }\n}\n", encoding="utf-8")
    (DATA / "ledger.json").write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
