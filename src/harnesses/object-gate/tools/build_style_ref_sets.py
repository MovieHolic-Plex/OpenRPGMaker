"""object-gate 칩셋별 화풍 기준 그림 묶음 — 각 칩셋 번들에 이미 실린 그림에서 같은 종류 조각을 잘라 낸다.

    python3 src/harnesses/object-gate/tools/build_style_ref_sets.py [--only jp_city]

산출: harness-data/object-gate/style-refs/sets/<칩셋>/<종류>/<이름>.png + sets/<칩셋>/manifest.json.
화풍 판정은 후보의 칩셋 묶음을 쓴다(라벨 앞머리·--chipset). 묶음이 없거나 그 묶음에 그 종류가 없을 때만
버들항 기본 묶음(style-refs/<종류>, build_style_refs.py)으로 떨어지고, 영수증 style.refSet 에 fallback 을 적는다.
버들항(beodeul_city)은 기본 묶음 그대로다 — 여기서 만들지 않는다(보정 프로필 해시가 그 묶음에 묶여 있다).
계단 후보와 같은 그림을 기준으로 쓰지 않게 계단 키트는 고르지 않는다.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit_render import REPO, load_commit, render_kit, tile_image, trim  # noqa: E402
from PIL import Image  # noqa: E402

OUT = REPO / "harness-data" / "object-gate" / "style-refs" / "sets"

# 칩셋 → 정의·시트 + 종류별 키트(이름, 키트 id, 행 범위 또는 None) + 바닥/벽 패치(이름, 타일 그룹 id, 칸 수 cols×rows).
SETS = {
    "jp_city": {
        "tileset": "src/assets/jpCityTileset.json", "sheet": "public/assets/jp-city/jp-city-chipset.png",
        "kits": {
            "building": [("house-hip2", "jp-bldg-house-hip2", None), ("house-machiya", "jp-bldg-house-machiya", None)],
            "roof": [("roof-kawara-5", "jp-roof-kawara-5", None)],
            "tree": [("tree-zelkova", "jp-prop-tree-zelkova", None), ("tree-sakura", "jp-prop-tree-sakura", None)],
            "prop": [("in-kitchen-worktop", "jp-in-kitchen-worktop", None), ("in-tansu", "jp-in-tansu", None),
                     ("in-cv-back-shelf", "jp-in-cv-back-shelf", None), ("in-desk-study", "jp-in-desk-study", None),
                     ("vending-aka", "jp-prop-vending-aka", None)],
        },
        "patches": {
            "ground": [("floor-flooring", "jp:interior-floor-flooring", 4, 3), ("floor-tatami", "jp:interior-floor-tatami", 4, 3)],
            "wall": [("wall-cloth", "jp:interior-wall-cloth", 4, 2), ("wall-sc", "jp:interior-wall-sc-wall", 4, 2)],
        },
    },
    "wizarding_world": {
        "tileset": "src/assets/wizardingWorldTileset.json", "sheet": "public/assets/wizarding-world/wizarding-world-chipset.png",
        "kits": {
            "building": [("lake-boathouse-5", "wz-lake-boathouse-5", None)],
            "wall": [("castle-wall-n-window2", "wz-castle-wall-n-window2", None), ("castle-door2-closed", "wz-castle-door2-closed", None)],
            "prop": [("dorm-wardrobe", "wz-dorm-wardrobe", None), ("gh-workbench", "wz-gh-workbench", None),
                     ("lib-record-table", "wz-lib-record-table", None), ("furn-table-small", "wz-furn-table-small", None),
                     ("hd-workbench", "wz-hd-workbench", None)],
        },
        "patches": {
            "ground": [("floor-flag", "wz:floor:wz-castle-floor-flag", 4, 3), ("floor-oak", "wz:floor:wz-castle-floor-oak", 4, 3)],
        },
    },
    "atlas_biome_interior": {
        "tileset": "src/assets/atlasBiomeInteriorTileset.json", "sheet": "public/assets/atlas-interior/interior-chipset.png",
        "kits": {
            "prop": [("counter-3x1", "hand-interior:counter 3x1", None), ("bookshelf-2w", "hand-interior:bookshelf 2w", None),
                     ("desk-2x2", "hand-interior:desk 2x2", None), ("stove", "hand-interior:stove", None),
                     ("double-bed-green", "hand-interior:double bed green", None)],
        },
        "patches": {
            "ground": [("floor-boards", "hand-interior:floor:boards", 4, 3), ("floor-flag", "hand-interior:floor:flag", 4, 3)],
        },
    },
    "joseon_baram": {
        "tileset": "src/assets/joseonBaramTileset.json", "sheet": "public/assets/joseon-baram/joseon-baram-chipset.png",
        "kits": {
            "building": [("giwa-house-5", "jb-giwa_house_5", None), ("thatch-house-4", "jb-thatch_house_4", None)],
            "tree": [("pine-a", "jb-pine_a", None), ("zelkova", "jb-zelkova_a", None)],
            "wall": [("fort-wall-h", "jb-fort_wall_h", None), ("wall-h", "jb-wall_h", None)],
            "prop": [("jars", "jb-jars", None), ("stone-pagoda", "jb-stone_pagoda", None), ("market-stall-thatch", "jb-market_stall_thatch", None)],
        },
        "patches": {
            "ground": [("grass", "jb:grass", 4, 3), ("floor-maru", "jb:in_floor_maru", 4, 3)],
            "water": [("water-deep", "jb:water_deep", 4, 3)],
        },
    },
    "modern_city": {
        "tileset": "src/assets/modernCityTileset.json", "sheet": "public/assets/modern-city/modern-city-chipset.png",
        "kits": {
            "building": [("house-modern-a", "mc-bld-house-modern-A", None), ("cafe-a", "mc-bld-cafe-A", None)],
            "tree": [("tree-a", "mc-prop-tree-a", None)],
            "prop": [("kiosk-a", "mc-prop-kiosk-a", None), ("vending-a", "mc-prop-vending-a", None), ("bus-shelter-a", "mc-prop-bus-shelter-a", None)],
        },
        "patches": {
            "ground": [("floor-wood-oak", "mc:interior-floor-mci-wood-oak", 4, 3), ("floor-stone-lobby", "mc:interior-floor-mci-stone-lobby", 4, 3)],
            "wall": [("wall-home", "mc:interior-wall-mci-wall-home", 4, 2)],
        },
    },
    # 버들항 던전(동굴·하수도·폐허 칸, 2026-10-29): 같은 버들항 시트지만 마을 소품(벤치·노점·우물)이 아니라 던전에 이미 출하된 돌·수정·기둥 조각과 견준다.
    # 사용자가 「허접하다」고 한 옛 동굴 조각(sea-cave 석순·돌기둥·하수도 계단 면)과, 새 동굴 기물이 갈아 끼우는 옛 조각(뼈 더미·빛 이끼·빛 버섯)은 기준으로 쓰지 않는다.
    # 동굴 후보 라벨은 beodeul_dungeon/… 로 붙이고, 돌·수정·버섯은 화풍 종류 prop(서 있는 물건)으로 준다 — 이 묶음에는 나무가 없다.
    "beodeul_dungeon": {
        "tileset": "src/assets/beodeulCityTileset.json", "sheet": "public/assets/beodeul-city/beodeul-city-chipset.png",
        "kits": {
            "prop": [("fallen-column", "bd-pick-aqueduct-sewer-fallen-column", None), ("rubble-cave", "bd-pick-sea-cave-rubble-cave", None),
                     ("ice-crystal", "bd-pick-dungeon-theme-ice-crystal", None), ("corrupt-crystal-big", "bd-pick-dungeon-theme-corrupt-crystal-big", None),
                     ("fire-crystal", "bd-pick-volcano-cave-fire-crystal", None), ("brazier", "bd-pick-aqueduct-sewer-brazier", None),
                     ("crate-stack", "bd-pick-aqueduct-sewer-crate-stack", None)],
        },
    },
}
# 칩셋 이름의 다른 표기(하네스·라벨에서 쓰는 이름) → 묶음 id. TS 쪽 STYLE_REF_SET_ALIASES 와 같다.
ALIASES = {"modern3": "modern_city", "jp-city": "jp_city", "wizarding": "wizarding_world", "joseon": "joseon_baram",
           "atlas_interior": "atlas_biome_interior", "hand-interior": "atlas_biome_interior", "interior-v5": "atlas_biome_interior",
           "beodeul-dungeon": "beodeul_dungeon", "dungeon-cave": "beodeul_dungeon"}


def group_ids(tileset: dict, gid: str) -> list[int]:
    for g in tileset.get("tileGroups") or []:
        if (g.get("id") or g.get("name")) == gid:
            ids = g.get("tiles") or g.get("tileIds") or []
            return [i for i in ids if isinstance(i, int) and i >= 0]
    raise SystemExit(f"타일 그룹 없음: {gid}")


def build(set_id: str, spec: dict) -> dict:
    tileset, sheet = load_commit(None, spec["tileset"], spec["sheet"])
    tpr = tileset["tilesPerRow"]
    kits = {k["id"]: k for k in tileset["structureKits"]}
    manifest: dict = {}
    for kind, entries in spec.get("kits", {}).items():
        for name, kid, rows in entries:
            if kid not in kits:
                # 번들에서 사라진 키트 — 다른 이름의 비슷한 키트로 고친다(조용히 빼지 않는다).
                raise SystemExit(f"{set_id}: 키트 없음 {kid}")
            img = render_kit(kits[kid], sheet, tpr)
            if rows:
                img = img.crop((0, rows[0] * 16, img.width, (rows[1] + 1) * 16))
            put(set_id, kind, name, trim(img), manifest, {"kit": kid, "rows": rows})
    for kind, entries in spec.get("patches", {}).items():
        for name, gid, cols, rows in entries:
            ids = group_ids(tileset, gid)
            img = Image.new("RGBA", (cols * 16, rows * 16), (0, 0, 0, 0))
            for i in range(cols * rows):
                img.alpha_composite(tile_image(sheet, tpr, 16, ids[i % len(ids)]), ((i % cols) * 16, (i // cols) * 16))
            put(set_id, kind, name, img, manifest, {"group": gid, "tiles": [ids[i % len(ids)] for i in range(cols * rows)]})
    meta = {"chipset": set_id, "tileset": spec["tileset"], "sheet": spec["sheet"]}
    (OUT / set_id).mkdir(parents=True, exist_ok=True)
    (OUT / set_id / "manifest.json").write_text(json.dumps({"_meta": meta, **manifest}, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    return manifest


def put(set_id: str, kind: str, name: str, img: Image.Image, manifest: dict, source: dict) -> None:
    folder = OUT / set_id / kind
    folder.mkdir(parents=True, exist_ok=True)
    img.save(folder / f"{name}.png")
    digest = hashlib.sha256(f"{img.width}x{img.height}:".encode() + img.tobytes()).hexdigest()
    manifest.setdefault(kind, {})[name] = {"w": img.width, "h": img.height, "sha256": digest, **source}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    args = ap.parse_args()
    for set_id, spec in SETS.items():
        if args.only and args.only != set_id:
            continue
        m = build(set_id, spec)
        print(f"{set_id}: " + ", ".join(f"{k} {len(v)}" for k, v in sorted(m.items())))
    (OUT / "aliases.json").write_text(json.dumps(ALIASES, ensure_ascii=False, indent=1, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
