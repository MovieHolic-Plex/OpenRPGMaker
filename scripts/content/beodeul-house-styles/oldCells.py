#!/usr/bin/env python3
"""덧붙이기 전용 확인: 기준 커밋(기본 origin/main)의 버들항 시트·칸 표·킷과 지금 것을 견준다 — 옛 칸의 화소·칸 표, 옛 킷과 그 순서, 묶음·오토타일·움직임 띠가 같아야 한다.
  python3 scripts/content/beodeul-house-styles/oldCells.py [기준 ref]"""
import io, json, pathlib, subprocess, sys
import numpy as np
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[3]
REF = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
PNG, TS = "public/assets/beodeul-city/beodeul-city-chipset.png", "src/assets/beodeulCityTileset.json"
show = lambda path: subprocess.run(["git", "-C", str(ROOT), "show", f"{REF}:{path}"], capture_output=True, check=True).stdout
old_png = np.array(Image.open(io.BytesIO(show(PNG))).convert("RGBA")); new_png = np.array(Image.open(ROOT / PNG).convert("RGBA"))
old = json.loads(show(TS)); new = json.loads((ROOT / TS).read_text())
n = old["count"]; rows = n // 128 * 16
pixels = np.array_equal(old_png[:rows], new_png[:rows])
tables = all(old[k] == new[k][:n] for k in ("passability", "priority", "terrain", "tileMeta"))
ids = [k["id"] for k in old["structureKits"]]
kits = [k["id"] for k in new["structureKits"]][:len(ids)] == ids and all(json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True) for a, b in zip(old["structureKits"], new["structureKits"]))
groups = all(json.dumps(old.get(k), sort_keys=True) == json.dumps(new.get(k), sort_keys=True) for k in ("tileGroups", "autotileGroups", "tileGrafts", "animationStrips"))
added = [k["id"] for k in new["structureKits"][len(ids):]]
print(json.dumps(dict(ref=REF, countOld=n, countNew=new["count"], oldPixelsSame=bool(pixels), oldTablesSame=tables, oldKits=len(ids), newKits=len(new["structureKits"]), oldKitsSameAndOrder=kits,
                      groupsAutotilesStripsSame=groups, addedKits=len(added), addedOnlyHouseStyles=all(i.startswith(("bd-house-st-", "bd-st-shadow-", "bd-st-foundation-")) for i in added)), ensure_ascii=False))
sys.exit(0 if pixels and tables and kits and groups else 1)
