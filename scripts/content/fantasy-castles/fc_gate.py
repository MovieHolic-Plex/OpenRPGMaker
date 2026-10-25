#!/usr/bin/env python3
"""fantasy_castles 3/4 관문 — 판정 단위 그림 만들기 · object-gate 판정 · 출구 확인 · 번들 게시(관문 통과 때만).

  python3 scripts/content/fantasy-castles/fc_gate.py units     조각(키트 원본 네 층)·바닥 견본 그림을 tiledata/fantasy-castles/gate/ 에 쓰고 items.jsonl 을 만든다
  python3 scripts/content/fantasy-castles/fc_gate.py review    items.jsonl 을 npm run harness -- object-gate review --batch 로 판정받는다(영수증 기록)
  python3 scripts/content/fantasy-castles/fc_gate.py check     단위마다 object_gate.refusal(context=bundle) — 막힌 수와 이유를 gate/check.json 에 쓴다
  python3 scripts/content/fantasy-castles/fc_gate.py publish   check 가 막힘 0 일 때만 시트·참고 그림을 public/assets/fantasy-castles/ 로, 정의 JSON 을 src/assets/ 로 옮긴다

관문을 건너뛰거나 기준을 완화하는 길은 없다. 보정되지 않은 프로필의 AI 통과는 통과로 세지 않는다(object_gate.refusal 그대로).
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, "src", "harnesses", "_core"))
import fc_build as FB  # noqa: E402
import object_gate as OG  # noqa: E402

DATA = os.environ.get("FC_DATA") or os.path.join(REPO, "tiledata", "fantasy-castles")
GATE = os.path.join(DATA, "gate")
T = 16
SWATCH = 12
ORGANIC = ("tree", "pine", "oak", "bush", "shrub", "flower", "grass", "reed", "vine", "hedge", "fern", "ivy")
DEBRIS = ("rubble", "debris", "pebble", "stones", "scree")


def kind_for(name: str, layers: dict) -> str:
    n = name.lower()
    if not any(v >= 0 for L in ("object", "object_over") for row in layers[L] for v in row):
        return "terrain"
    if any(k in n for k in ORGANIC):
        return "organic"
    if any(k in n for k in DEBRIS):
        return "debris"
    return "structure"


def style_kind(kind: str, name: str) -> str:
    n = name.lower()
    if kind == "terrain":
        return "water" if any(k in n for k in ("water", "sea", "river", "moat", "lake")) else "ground"
    if kind == "organic":
        return "tree"
    if "roof" in n:
        return "roof"
    if "wall" in n or "rampart" in n or "cliff" in n:
        return "wall"
    return "building"


def render_cells(src, layers, w, h):
    out = np.zeros((h * T, w * T, 4), np.float64)
    for L in FB.LAYERS:
        for y in range(h):
            for x in range(w):
                i = layers[L][y][x]
                if i < 0:
                    continue
                px = src["cell"](i).astype(np.float64)
                a = px[..., 3:4] / 255.0
                dst = out[y * T:(y + 1) * T, x * T:(x + 1) * T]
                dst[..., :3] = np.round(px[..., :3] * a + dst[..., :3] * (1 - a))
                dst[..., 3:4] = np.maximum(dst[..., 3:4], px[..., 3:4])
    return out.astype(np.uint8)


def sources():
    return [FB.load_source(os.path.join(DATA, "src", folder), mid, name) for folder, mid, name in FB.DEFAULT_MAPS]


def make_units():
    os.makedirs(os.path.join(GATE, "units"), exist_ok=True)
    items, seen = [], {}
    for s in sources():
        entries, origin = FB._piece_entries(s)
        for name, q in entries:
            img = render_cells(s, q["layers"], q["w"], q["h"])
            if not img[..., 3].any():
                continue
            sha = hashlib.sha256(img.tobytes()).hexdigest()
            if sha in seen:
                seen[sha]["alsoAs"].append(f"{s['id']}/{name}")
                continue
            kind = kind_for(str(name), q["layers"])
            label = f"fantasy-castles/{s['id']}/{name}"
            png = os.path.join(GATE, "units", f"{s['id']}--{FB.PREFIX}{''.join(c if c.isalnum() else '-' for c in str(name))}.png")
            Image.fromarray(img).save(png)
            item = dict(png=os.path.relpath(png, REPO), kind=kind, styleKind=style_kind(kind, str(name)),
                        name=f"{s['name']} {name}", label=label, source=origin, alsoAs=[])
            seen[sha] = item
            items.append(item)
        ground = {L: s["layers"][L] if L in ("ground", "ground_over") else [[-1] * s["w"] for _ in range(s["h"])] for L in FB.LAYERS}
        for y0 in range(0, s["h"], SWATCH):
            for x0 in range(0, s["w"], SWATCH):
                w, h = min(SWATCH, s["w"] - x0), min(SWATCH, s["h"] - y0)
                part = {L: [row[x0:x0 + w] for row in ground[L][y0:y0 + h]] for L in FB.LAYERS}
                img = render_cells(s, part, w, h)
                sha = hashlib.sha256(img.tobytes()).hexdigest()
                if sha in seen:
                    continue
                png = os.path.join(GATE, "units", f"{s['id']}--ground-{x0}-{y0}.png")
                Image.fromarray(img).save(png)
                item = dict(png=os.path.relpath(png, REPO), kind="terrain", styleKind="ground", name=f"{s['name']} 바닥 ({x0},{y0}) {w}x{h}",
                            label=f"fantasy-castles/{s['id']}/ground-{x0}-{y0}", source="map ground+ground_over", alsoAs=[])
                seen[sha] = item
                items.append(item)
    with open(os.path.join(GATE, "items.jsonl"), "w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps({k: it[k] for k in ("png", "kind", "styleKind", "name", "label")}, ensure_ascii=False) + "\n")
    with open(os.path.join(GATE, "units.json"), "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)
    by = {}
    for it in items:
        by[it["kind"]] = by.get(it["kind"], 0) + 1
    print(json.dumps(dict(units=len(items), byKind=by), ensure_ascii=False))
    return items


def load_units():
    with open(os.path.join(GATE, "units.json"), encoding="utf-8") as f:
        return json.load(f)


def check():
    rows, blocked = [], 0
    for it in load_units():
        why = OG.refusal(os.path.join(REPO, it["png"]), kind=it["kind"], context="bundle")
        receipt = OG.read_receipt(OG.pixel_sha256(os.path.join(REPO, it["png"])))
        rows.append(dict(label=it["label"], kind=it["kind"], refused=why, receipt=bool(receipt),
                         aiVerdict=(receipt or {}).get("verdict"), profile=(receipt or {}).get("profileHash")))
        blocked += why is not None
    out = dict(units=len(rows), blocked=blocked, passed=len(rows) - blocked, context="bundle", rows=rows)
    with open(os.path.join(GATE, "check.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    reasons = {}
    for r in rows:
        if r["refused"]:
            key = r["refused"].split(" — ")[0][:80]
            reasons[key] = reasons.get(key, 0) + 1
    print(json.dumps(dict(units=len(rows), blocked=blocked, passed=len(rows) - blocked, reasons=reasons), ensure_ascii=False, indent=1))
    return blocked


def review():
    cmd = ["npm", "run", "-s", "harness", "--", "object-gate", "review", "--batch", os.path.join(GATE, "items.jsonl")]
    print(" ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=REPO)


def publish():
    if check():
        print("게시 거절: 3/4 관문에서 막힌 단위가 있다(gate/check.json). 번들·public 에 아무것도 쓰지 않았다.")
        return 2
    build = os.path.join(DATA, "build")
    dest = os.path.join(REPO, "public", "assets", "fantasy-castles")
    os.makedirs(os.path.join(dest, "references"), exist_ok=True)
    shutil.copy2(os.path.join(build, "fantasy-castles-chipset.png"), os.path.join(dest, "fantasy-castles-chipset.png"))
    for f in os.listdir(os.path.join(build, "references")):
        shutil.copy2(os.path.join(build, "references", f), os.path.join(dest, "references", f))
    for f in ("fantasyCastlesSheet.json", "fantasyCastlesTileset.json", "fantasyCastlesReferences.json"):
        shutil.copy2(os.path.join(build, f), os.path.join(REPO, "src", "assets", f))
    led = FB.Ledger(os.path.join(DATA, "cell-ledger.json"))
    led.frozen = len(led.cells)
    led.save()
    print(f"게시: 시트·참고 그림 → public/assets/fantasy-castles/, 정의 → src/assets/. 장부 앞 {led.frozen}칸 동결. 다음은 tiledata/fantasy-castles/ACTIVATE.md 의 배선.")
    return 0


def main(argv):
    stage = argv[0] if argv else "check"
    if stage == "units":
        make_units()
        return 0
    if stage == "review":
        return review()
    if stage == "check":
        return 1 if check() else 0
    if stage == "publish":
        return publish()
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
