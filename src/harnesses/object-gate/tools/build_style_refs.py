"""object-gate 화풍 기준 그림 — 번들 버들항(beodeul_city) 시트에서 같은 종류 조각을 잘라 낸다.

    python3 src/harnesses/object-gate/tools/build_style_refs.py

산출: harness-data/object-gate/style-refs/<종류>/<이름>.png + manifest.json (원본 키트·타일 번호·화소 해시).
판정자는 후보와 같은 종류의 기준 그림을 같은 배율로 받아 비교한다. 기준 그림이 바뀌면 프로필 해시가 바뀐다.
보정 표본의 「버들항 정상 표본」은 여기서 쓴 키트를 쓰지 않는다(판정자에게 보여 준 그림으로 자기 점수를 매기지 않게).
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit_render import REPO, load_commit, render_group_patch, render_kit, tile_image, trim  # noqa: E402
from PIL import Image  # noqa: E402

OUT = REPO / "harness-data" / "object-gate" / "style-refs"
TILESET, SHEET = "src/assets/beodeulCityTileset.json", "public/assets/beodeul-city/beodeul-city-chipset.png"

KITS = {  # 종류 → [(파일 이름, 키트 id, 행 범위 또는 None)]
    "building": [("house-h101_0", "bd-house-h101_0", None), ("house-h112_0-stone", "bd-house-h112_0", None)],
    "roof": [("roof-h104_0", "bd-house-h104_0", (1, 3))],
    "wall": [("wall-h104_0-timber", "bd-house-h104_0", (4, 5)), ("wall-h106_1-stone", "bd-house-h106_1", (6, 7))],
    "tree": [("tree-d43edd", "bd-tree-d43edd", None), ("tree-1a786c", "bd-tree-1a786c", None)],
    "prop": [("prop-stall-cheese", "bd-prop-stall_cheese_meat", None), ("prop-well-roofed", "bd-prop-well_roofed", None)],
}
PATCHES = {  # 바닥 종류 → [(이름, 타일 번호 4×3 순서)]
    "ground": [
        ("grass", [737, 2502, 737, 737, 12130, 737, 2502, 737, 11628, 737, 737, 2502]),
        ("paving", [3221, 2666, 3353, 4674, 9585, 17443, 3221, 2666, 3353, 4674, 9585, 17443]),
    ],
    "water": [("water", [23152] * 12)],
}


def main() -> None:
    tileset, sheet = load_commit(None, TILESET, SHEET)
    tpr = tileset["tilesPerRow"]
    kits = {k["id"]: k for k in tileset["structureKits"]}
    manifest = {}
    for kind, entries in KITS.items():
        for name, kid, rows in entries:
            img = render_kit(kits[kid], sheet, tpr)
            if rows:
                img = img.crop((0, rows[0] * 16, img.width, (rows[1] + 1) * 16))
            img = trim(img)
            put(kind, name, img, manifest, {"kit": kid, "rows": rows})
    for kind, entries in PATCHES.items():
        for name, ids in entries:
            img = Image.new("RGBA", (4 * 16, 3 * 16), (0, 0, 0, 0))
            for i, tid in enumerate(ids):
                img.alpha_composite(tile_image(sheet, tpr, 16, tid), ((i % 4) * 16, (i // 4) * 16))
            put(kind, name, img, manifest, {"tiles": ids})
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    print(f"{sum(len(v) for v in manifest.values())}장 → {OUT}")


def put(kind: str, name: str, img: Image.Image, manifest: dict, source: dict) -> None:
    folder = OUT / kind
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{name}.png"
    img.save(path)
    digest = hashlib.sha256(f"{img.width}x{img.height}:".encode() + img.tobytes()).hexdigest()
    manifest.setdefault(kind, {})[name] = {"w": img.width, "h": img.height, "sha256": digest, **source}


if __name__ == "__main__":
    main()
