#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/monsters/crab_eye_candidates.py [--out qa-runs/harnesses/monster-collect-species/crab-eyes]
"""Hand-coded eye-stalk candidates for the crab line (coralpin, reefguard, atollclamp) — 눈 규칙 판본 5.

R13 stamped the seed's "eyes on short stalks" as square cream goggles. These candidates redraw only the
eyes (character-mapped pixel templates, no generated images, no body change) on top of the current
authored front. They are NOT installed: a human picks one per species from the pick sheet, then the pick is
written to eyes.json as a `repair` and applied by upgrade_all_60_eyes.py. Each candidate records the sha256
of the authored front it was drawn on, so a pick against a changed picture is refused.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image

ROOT: Final[Path] = Path(__file__).resolve().parents[3]
AUTHORED: Final[Path] = ROOT / "harness-data/monster-collect-species/authored"
BASELINE_REF: Final[str] = "5b8d884cbb"  # last sprite before the square goggles (R13 source)

# 0 rim/stalk dark · C cream eyeball · P pupil · W highlight · I iris · S stalk shell colour · . untouched
TEMPLATES: Final[dict[str, dict[str, list[str]]]] = {
    "A": {  # 둥근 크림 눈알 + 짧은 자루, 눈동자는 보는 이 왼쪽
        "near": [".0000.", "0WPPC0", "0PPPC0", "0PIPC0", "0CCCC0", ".0000."],
        "far": [".000.", "0WPC0", "0PPC0", "0CCC0", ".000."],
    },
    "B": {  # BW 스타일 큰 반짝 눈(크림 테두리 + 2×2 하이라이트), 자루 1칸
        "near": [".00000.", "0WWPPC0", "0WWPPC0", "0PPPIC0", "0PIIIC0", "0CCCCC0", ".00000."],
        "far": [".000.", "0WPC0", "0PPC0", "0PIC0", "0CCC0", ".000."],
    },
    "C": {  # 긴 자루 위 까만 구슬눈(흰 반짝 2칸), 게다운 쪽
        "near": [".000.", "0WWP0", "0WPP0", "0PPI0", ".000."],
        "far": [".00.", "0WP0", "0PI0", ".00."],
    },
}
# ball centre per species (64 canvas), candidate C lifts the balls by LIFT_C px on longer stalks
CENTRES: Final[dict[str, dict[str, tuple[int, int]]]] = {
    "coralpin": {"far": (33, 36), "near": (42, 37)},
    "reefguard": {"far": (33, 35), "near": (41, 37)},
    "atollclamp": {"far": (23, 35), "near": (30, 37)},
}
LIFT_C: Final[int] = 2
RIM: Final[dict[str, tuple[int, int, int]]] = {"coralpin": (34, 8, 4), "reefguard": (38, 10, 3), "atollclamp": (39, 11, 1)}
CREAM: Final = (254, 243, 212)
PUPIL: Final = (28, 10, 8)
WHITE: Final = (255, 255, 255)
IRIS: Final = (3, 115, 118)


def lum(rgb: np.ndarray) -> float:
    return 0.299 * int(rgb[0]) + 0.587 * int(rgb[1]) + 0.114 * int(rgb[2])


def baseline(sid: str) -> np.ndarray:
    raw = subprocess.check_output(["git", "show", f"{BASELINE_REF}:public/assets/harnesses/monster-collect-species/{sid}/front.png"], cwd=ROOT)
    return np.array(Image.open(io.BytesIO(raw)).convert("RGBA"))


def clear_old_eyes(arr: np.ndarray, base: np.ndarray, boxes: list[list[int]], on_body: bool) -> None:
    """Undo the square goggles (eyes.json near/second boxes, 1 px margin): restore non-eye baseline pixels,
    drop eye-coloured ones; on a body (atollclamp) re-fill them from the surrounding shell instead."""
    hole = np.zeros(arr.shape[:2], dtype=bool)
    for x0, y0, w, h in boxes:
        for y in range(y0 - 1, y0 + h + 1):
            for x in range(x0 - 1, x0 + w + 1):
                b = base[y, x]
                eyeish = lum(b) < 40 or (lum(b) > 225 and int(b[:3].max()) - int(b[:3].min()) < 60)
                if b[3] and not eyeish:
                    arr[y, x] = b
                elif on_body:
                    hole[y, x] = True
                else:
                    arr[y, x] = (0, 0, 0, 0)
    # old balls drawn wider than the table box: eye-coloured pixels connected to a box, up to 3 px beside it, never below it
    stack = [(y, x) for x0, y0, w, h in boxes for y in range(y0 - 1, y0 + h + 1) for x in range(x0 - 1, x0 + w + 1)]
    seen = set(stack)
    while stack:
        y, x = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (ny, nx) in seen or not any(x0 - 3 <= nx < x0 + w + 3 and y0 - 2 <= ny < y0 + h for x0, y0, w, h in boxes):
                continue
            seen.add((ny, nx))
            px = arr[ny, nx]
            if px[3] and (lum(px) < 40 or (lum(px) > 225 and int(px[:3].max()) - int(px[:3].min()) < 60)):
                if on_body:
                    hole[ny, nx] = True
                else:
                    arr[ny, nx] = (0, 0, 0, 0)
                stack.append((ny, nx))
    while hole.any():
        progressed = False
        for y, x in np.argwhere(hole):
            around = [arr[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if not hole[y + dy, x + dx] and arr[y + dy, x + dx, 3] and lum(arr[y + dy, x + dx]) >= 40]
            if around:
                arr[y, x] = max(around, key=lambda c: (sum(1 for o in around if (o == c).all()), lum(c)))
                hole[y, x] = False
                progressed = True
        if not progressed:
            break


def shell_top(arr: np.ndarray, x: int, y: int) -> int:
    for yy in range(y, 64):
        if arr[yy, x, 3]:
            return yy
    return y


def paint(arr: np.ndarray, rows: list[str], cx: int, cy: int, cmap: dict[str, tuple[int, int, int]]) -> tuple[int, int, int, int]:
    h, w = len(rows), len(rows[0])
    x0, y0 = cx - w // 2, cy - h // 2
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in cmap:
                arr[y0 + dy, x0 + dx] = (*cmap[ch], 255)
    return x0, y0, w, h


def candidate(sid: str, key: str, src: np.ndarray, base: np.ndarray, boxes: list[list[int]]) -> tuple[np.ndarray, dict[str, list[int]]]:
    """Returns the candidate sprite and its eye boxes {near, second} (second = far ball) for eyes.json."""
    arr = src.copy()
    clear_old_eyes(arr, base, boxes, sid == "atollclamp")
    cmap = {"0": RIM[sid], "C": CREAM, "P": PUPIL, "W": WHITE, "I": IRIS}
    lift = LIFT_C if key == "C" else 0
    eye_boxes: dict[str, list[int]] = {}
    for role in ("far", "near"):
        cx, cy = CENTRES[sid][role]
        cy -= lift
        rows = TEMPLATES[key][role]
        x0, y0, w, h = paint(arr, rows, cx, cy, cmap)
        eye_boxes["second" if role == "far" else "near"] = [x0 + 1, y0 + 1, w - 2, h - 2]
        if sid == "atollclamp":
            continue
        sx = x0 + w // 2 - 1
        for yy in range(y0 + h, shell_top(arr, sx, y0 + h)):
            arr[yy, sx] = (*RIM[sid], 255)
            arr[yy, sx + 1] = (*RIM[sid], 255)
    return arr, eye_boxes


def apply_pick(out: Path, pick: str) -> None:
    """Install a candidate the USER picked (`coralpin=B`). Refuses if the authored front or the candidate file changed.

    Known follow-up (2026-10-20): the v4 rule `checks/eyes.ts` wants a pupil surrounded by bright skin, and
    eyeTable V0/V3 measure contrast against the ring around the box — a stalk ball is ringed by its dark rim and
    air, so most candidates fail both. The install PR must add the stalk exception (seed `eyes` override) first.
    """
    sid, key = pick.split("=")
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    cand = manifest[sid]["candidates"][key]
    src_path = AUTHORED / f"{sid}-front.png"
    current = hashlib.sha256(src_path.read_bytes()).hexdigest()
    if current != manifest[sid]["drawnOn"]:
        raise SystemExit(f"{sid}: authored front changed since the candidates were drawn ({current[:12]}) — regenerate the sheet")
    data = (out / cand["file"]).read_bytes()
    if hashlib.sha256(data).hexdigest() != cand["sha256"]:
        raise SystemExit(f"{sid} {key}: candidate file hash mismatch")
    src_path.write_bytes(data)
    table_path = ROOT / "harness-data/monster-collect-species/eyes.json"
    table = json.loads(table_path.read_text(encoding="utf-8"))
    entry = table["species"][sid]
    entry.update({"style": "hand", "near": cand["near"], "second": cand["second"], "picked": f"user-pick {key} ({cand['sha256'][:12]})"})
    entry.pop("pending", None)
    entry.pop("accept", None)
    rows = ",\n".join(f"    {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in table["species"].items())
    table_path.write_text('{\n  "version": 1,\n  "species": {\n' + rows + "\n  }\n}\n", encoding="utf-8")
    ledger_path = ROOT / "harness-data/monster-collect-species/ledger.json"
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    front = ledger["picks"][sid]["front"]
    front.update({"authored": f"authored/{sid}-front.png", "previousAuthoredSha256": current, "authoredSha256": cand["sha256"]})
    ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{sid}: installed user pick {key} {current[:12]} -> {cand['sha256'][:12]} (now run harness build + field_chip derive/pick/bake)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=ROOT / "qa-runs/harnesses/monster-collect-species/crab-eyes")
    ap.add_argument("--apply", help="species=KEY the user picked from the sheet (never chosen by an agent)")
    args = ap.parse_args()
    if args.apply:
        apply_pick(args.out, args.apply)
        return
    manifest: dict[str, dict] = {}
    table = json.loads((ROOT / "harness-data/monster-collect-species/eyes.json").read_text(encoding="utf-8"))
    for sid in CENTRES:
        src_path = AUTHORED / f"{sid}-front.png"
        src_sha = hashlib.sha256(src_path.read_bytes()).hexdigest()
        src = np.array(Image.open(src_path).convert("RGBA"))
        base = baseline(sid)
        entry = table["species"][sid]
        boxes = [entry["near"], entry["second"]]
        (args.out / sid).mkdir(parents=True, exist_ok=True)
        manifest[sid] = {"drawnOn": src_sha, "candidates": {}}
        for key in TEMPLATES:
            arr, eye_boxes = candidate(sid, key, src, base, boxes)
            path = args.out / sid / f"cand-{key}.png"
            Image.fromarray(arr, "RGBA").save(path, optimize=True)
            manifest[sid]["candidates"][key] = {"file": str(path.relative_to(args.out)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), **eye_boxes}
            print(sid, key, manifest[sid]["candidates"][key]["sha256"][:12])
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
