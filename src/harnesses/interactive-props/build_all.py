#!/usr/bin/env python3
"""
Master builder for all 100 real-source interactive props across 5 waves (20 each).
Generates every strip from verified existing high-quality repository PNGs, writes
harness-data/interactive-props/seed.json, picks all 100 strips through the mechanical
gate, and builds public/assets/harnesses/interactive-props/ + interactivePropsCatalog.json.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from build_wave1 import build_wave1, save_and_audit
from build_wave2 import build_wave2
from build_wave3 import build_wave3
from build_wave4 import build_wave4
from build_wave5 import build_wave5
from build_wave6 import build_wave6
from build_wave7 import build_wave7


def main() -> int:
    waves = [
        ("wave1-fantasy", build_wave1()),
        ("wave2-smash-dungeon", build_wave2()),
        ("wave3-modern", build_wave3()),
        ("wave4-joseon-murim", build_wave4()),
        ("wave5-scifi-steampunk", build_wave5()),
        ("wave6-doors-env", build_wave6()),
        ("wave7-push-doors", build_wave7()),
    ]

    seed_items = []
    strip_paths: list[tuple[str, Path]] = []
    for wave_tag, items in waves:
        save_and_audit(items, wave_tag)
        out_dir = ROOT / "qa-runs/harnesses/interactive-props" / wave_tag
        for it in items:
            strip_paths.append((it["id"], out_dir / f"{it['id']}.png"))
            rec = {k: v for k, v in it.items() if k != "frames_img"}
            seed_items.append(rec)

    assert len(seed_items) == 136, f"Expected 136 items, got {len(seed_items)}"

    seed = {
        "version": 2,
        "targetCount": len(seed_items),
        "notes": "100% real-source high-quality repository PNGs as Frame 0 across 7 eras and 7 waves (136 props).",
        "eras": ["fantasy", "dungeon", "modern", "joseon", "murim", "scifi", "steampunk"],
        "motions": [
            "hinge-lid",
            "drop-flap",
            "swing-double",
            "swing-single",
            "slide-drawer",
            "slide-door",
            "roll-shutter",
            "lid-aside",
            "untie-open",
            "smash-break",
            "toggle-switch",
            "activate-loop",
        ],
        "playbacks": ["oneshot", "toggle", "break", "loopAfterOpen"],
        "items": seed_items,
    }

    seed_path = ROOT / "harness-data/interactive-props/seed.json"
    seed_path.parent.mkdir(parents=True, exist_ok=True)
    seed_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(seed_items)} real-source items -> {seed_path.relative_to(ROOT)}")

    harness = str(HERE / "harness.py")
    subprocess.run([sys.executable, harness, "validate"], check=True)
    for iid, spath in strip_paths:
        subprocess.run(
            [sys.executable, harness, "pick", iid, str(spath), "--by", "owner-real-source", "--note", "Real repo PNG Frame-0 verified"],
            check=True,
        )
    subprocess.run([sys.executable, harness, "gate"], check=True)
    subprocess.run([sys.executable, harness, "build"], check=True)
    subprocess.run([sys.executable, harness, "status"], check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
