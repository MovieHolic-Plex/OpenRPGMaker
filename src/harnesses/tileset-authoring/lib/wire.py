"""배선(wire): 구운 지역 시트 → 공용 번들. 프로젝트 행에 쓰지 않는다(AGENTS 「새 타일은 공용에」).

산출(저장소 안, 커밋 대상):
- public/assets/monster-kit/<테마>.png                시트 그림(굽기 sheet.png 그대로)
- src/assets/monsterKit/<테마>.json                   엔진 TilesetDef 모양(통행·층·지형·턱·미끄럼·오토타일·칸 메타·애니·구조 킷)
- src/assets/monsterKit/index.json                    목록 [{theme, id, textureKey, name, path, count, tilesPerRow, tileSize}]
- src/project/defaults/monsterKitSheets.generated.ts  정적 import 표(vite 가 JSON 을 묶는다)
번들 등록(bundled.ts)·새/기존 프로젝트 심기(defaultAssets.ensureBundledTilesets)는 monsterKit.ts 가 이 목록으로 한다.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
ASSET_DIR = ROOT / "public" / "assets" / "monster-kit"
JSON_DIR = ROOT / "src" / "assets" / "monsterKit"
GEN = ROOT / "src" / "project" / "defaults" / "monsterKitSheets.generated.ts"


def _kits(objects: list, theme: str) -> list:
    kits = []
    for o in objects:
        rows = [{"tiles": lo, "upperTiles": up} for lo, up in zip(o["rowsLower"], o["rowsUpper"])]
        kit = {"id": f"mk-{theme}-{o['name']}", "kind": "section", "name": o["name"], "width": o["width"], "height": o["height"],
               "tileSize": 16, "rows": rows, "learnedFrom": "db-authored",
               "ai": {"description": f"{o['name']} ({o['kind']}, {o['width']}×{o['height']})"}}
        if o.get("entrance"):
            kit["parts"] = [{"id": "door", "kind": "entrance", "dx": o["entrance"]["dx"], "dy": o["entrance"]["dy"], "w": o["entrance"].get("w", 1), "h": 1}]
        kits.append(kit)
    return kits


def wire(theme: str, run_dir: Path, seed: dict) -> dict:
    bake = run_dir / "bake"
    ts = json.loads((bake / "tileset.json").read_text())
    objects = json.loads((bake / "objects.json").read_text())
    tid = seed["tilesetId"]
    tex = f"tex_{tid}"
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(bake / "sheet.png", ASSET_DIR / f"{theme}.png")
    out = {k: ts[k] for k in ("tileSize", "tilesPerRow", "count", "passability", "priority", "terrain", "tileMeta",
                              "animationStrips", "autotileGroups", "ledgeDirections") if k in ts}
    if ts.get("slideTiles"):
        out["slideTiles"] = ts["slideTiles"]
    import refdocs
    title = seed.get("title", seed["tilesetName"])
    out.update({"id": tid, "name": seed["tilesetName"], "textureKey": tex, "family": "oprn-atlas",
                "structureKits": _kits(objects, theme), "referenceDocuments": [refdocs.build(theme, run_dir, seed, title)],
                "source": {"theme": theme, "run": run_dir.name}})
    (JSON_DIR / f"{theme}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    idx_p = JSON_DIR / "index.json"
    idx = json.loads(idx_p.read_text()) if idx_p.exists() else []
    idx = [e for e in idx if e["theme"] != theme]
    idx.append({"theme": theme, "id": tid, "textureKey": tex, "name": seed["tilesetName"], "path": f"assets/monster-kit/{theme}.png",
                "count": ts["count"], "tilesPerRow": ts["tilesPerRow"], "tileSize": ts["tileSize"], "run": run_dir.name})
    idx.sort(key=lambda e: e["theme"])
    idx_p.write_text(json.dumps(idx, ensure_ascii=False, indent=1) + "\n")
    lines = ["// 생성 파일 — src/harnesses/tileset-authoring/lib/wire.py 가 쓴다. 손으로 고치지 않는다.",
             "// 몬스터 수집 손 도트 시트(지역별)의 정의 JSON 정적 import 표."]
    for i, e in enumerate(idx):
        lines.append(f'import s{i} from "@/assets/monsterKit/{e["theme"]}.json";')
    lines.append("")
    lines.append("export const MONSTER_KIT_SHEET_DATA: Record<string, unknown> = {")
    for i, e in enumerate(idx):
        lines.append(f'  "{e["textureKey"]}": s{i},')
    lines.append("};")
    GEN.write_text("\n".join(lines) + "\n")
    cat = out["referenceDocuments"][0]
    return {"theme": theme, "tiles": ts["count"], "kits": len(out["structureKits"]), "docs": len(cat["documents"]), "images": len(cat["images"]),
            "json_kb": (JSON_DIR / f"{theme}.json").stat().st_size // 1024}
