"""Opus 최종 판정 보정용 「원본(알려진 정상)」 표본을 만든다 (2026-10-21).

조건 (b): 각 칩셋의 원본 그림은 정의상 그 칩셋 화풍이고 사람이 받아들인 그림이다 — 최종 판정이 이것을 90% 이상 통과시켜야 보정 통과.
묶음:
  originals-beodeul   버들항 원본(기존 표본 fresh3·style beodeul-heldout·fresh4 style-beodeul 을 다시 쓰지 않고 이름만 묶는다 → originals.json)
  originals-jp        jp_city 사용자 OK(2026-10-20) 묶음 jp-roof-47·jp-vehicles-12 (18323 held-images 의 그림, 종류는 묶음 그대로)
  originals-interior  손 도트 v5 실내(atlas_biome_interior) 키트 중 종류가 분명하고 2026-10-01 전수조사(tiledata/hand-interior/pick/audit/v34-audit-verdicts.json)가
                      「ok」 로 둔 것만 — 시트에서 키트를 그대로 합성. 전수조사가 A(위반)·B(수치 미달)로 표시했거나 조사에 없던 키트는
  uncertain-interior  로 따로 둔다(보정 (a)·(b) 어디에도 세지 않고 보고만). 감독 지시(2026-10-21)로 사용자 3/4 규칙상 결함인 3장
                      (궤짝 cabbage 윗면 1~2행, 식탁보 cake+pie 정면, 화덕 stove 윗면 3행)은 정상 묶음에서 뺀다 — 다시 그리기 대상.
  originals-v5large   object-gen oprn-interior-v5-large 견본: good 8 = 정상, bad·rejects 6 = 위반(종류는 이름으로)
라벨은 판정 전에 고정한다. 판정 결과를 보고 바꾸지 않는다.

  python3 src/harnesses/object-gate/tools/build_originals_calibration.py --holds <18323 데이터 폴더> --objgen <object-gen 체크아웃>
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
CAL = ROOT / "harness-data" / "object-gate" / "calibration"
sys.path.insert(0, str(ROOT / "src" / "harnesses" / "_core"))
from object_gate import pixel_sha256  # noqa: E402

# 손 도트 v5 실내 키트 → 종류. 키트 id 의 두 번째 마디(hand-interior:<type>:…)로 고른다. 종류가 애매한 것은 넣지 않는다.
INTERIOR_KIND = {
    "crate": "box", "chest": "box", "royal chest": "box", "ice chest": "box",
    "basket": "container", "pot": "container", "water jar": "container", "cauldron": "container", "washbasin": "container", "bathtub": "container",
    "holy water font": "container", "potted fern": "container", "potted flowering": "container", "potted cactus": "container",
    "barrel": "round_body", "quench barrel": "round_body",
    "shelf": "tall_furniture", "cabinet": "tall_furniture", "cupboard": "tall_furniture", "wardrobe": "tall_furniture", "bookshelf 1w": "tall_furniture",
    "bookshelf 2w": "tall_furniture", "bookshelf 3w": "tall_furniture", "apothecary drawers": "tall_furniture", "fireplace": "tall_furniture", "stove": "tall_furniture",
    "table": "low_furniture", "roundtable": "low_furniture", "nightstand": "low_furniture", "dining 2x1": "low_furniture", "desk 2x1": "low_furniture",
    "work 2x1": "low_furniture", "tea 2x1": "low_furniture", "counter 2x1": "low_furniture", "bed green": "low_furniture", "double bed red": "low_furniture",
    "straw bed": "low_furniture", "canopy bed": "low_furniture",
    "chair S": "seat", "stool": "seat", "bench 2": "seat", "pew": "seat", "armchair": "seat", "sofa": "seat", "bar stool": "seat", "throne": "seat",
    "round rug": "flat", "runner": "flat", "doormat": "flat", "rug red": "flat",
}
MAX_PER_TYPE = 2
DEFECT_KITS = {"hand-interior:crate:cabbage", "hand-interior:table:cake+pie", "hand-interior:stove"}  # 감독 지시 2026-10-21: 사용자 3/4 규칙상 결함


def compose_kit(tileset: dict, sheet: Image.Image, kit: dict) -> Image.Image:
    t = tileset.get("tileSize", 16)
    per = tileset["tilesPerRow"]
    out = Image.new("RGBA", (kit["width"] * t, kit["height"] * t), (0, 0, 0, 0))
    for r, row in enumerate(kit["rows"]):
        for layer in (row.get("tiles"), row.get("upperTiles")):
            for c, tid in enumerate(layer or []):
                if tid is None or tid < 0:
                    continue
                tile = sheet.crop(((tid % per) * t, (tid // per) * t, (tid % per) * t + t, (tid // per) * t + t))
                out.alpha_composite(tile, (c * t, r * t))
    box = out.getchannel("A").getbbox()
    return out.crop(box) if box else out


def write_set(name: str, entries: list[dict]) -> None:
    d = CAL / name
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    items = []
    for e in entries:
        e["img"].save(d / f"{e['name']}.png")
        items.append({k: v for k, v in e.items() if k != "img"})
    (d / "items.json").write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n")
    print(name, len(items))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--holds", required=True, help="18323 서버의 harness-data/object-gate")
    ap.add_argument("--objgen", required=True, help="object-gen 체크아웃")
    a = ap.parse_args()
    holds = Path(a.holds)

    # jp_city 사용자 OK 묶음
    jp = []
    for batch in ("jp-roof-47", "jp-vehicles-12"):
        q = json.loads((holds / "queue" / f"{batch}.json").read_text())
        seen = set()
        for it in q["items"]:
            if it["sha"] in seen:
                continue
            seen.add(it["sha"])
            img = Image.open(holds / "held-images" / it["sha"][:2] / f"{it['sha']}.png").convert("RGBA")
            assert pixel_sha256(img) == it["sha"]
            nm = "jp__" + it["label"].split("/", 1)[1].replace("/", "__").replace(" ", "_")
            jp.append({"name": nm, "kind": it["kind"], "styleKind": "building" if it["kind"] == "structure" else "prop", "view34": "good", "style": "good",
                       "group": f"originals-jp-{batch}", "original": "jp_city", "note": f"사용자 OK 2026-10-20 묶음 {batch}", "img": img})
    write_set("originals-jp", jp)

    # 손 도트 v5 실내 키트
    ts = json.loads((ROOT / "src" / "assets" / "atlasBiomeInteriorTileset.json").read_text())
    sheet = Image.open(ROOT / "public" / "assets" / "atlas-interior" / "interior-chipset.png").convert("RGBA")
    audit = {v["key"]: v["tier"] for v in json.loads((ROOT / "tiledata" / "hand-interior" / "pick" / "audit" / "v34-audit-verdicts.json").read_text())}
    taken: dict[str, int] = {}
    inter, unsure = [], []
    for kit in ts["structureKits"]:
        parts = kit["id"].split(":")
        if len(parts) < 2 or parts[0] != "hand-interior":
            continue
        typ = parts[1]
        kind = INTERIOR_KIND.get(typ)
        if not kind or taken.get(typ, 0) >= MAX_PER_TYPE:
            continue
        img = compose_kit(ts, sheet, kit)
        if img.width == 0:
            continue
        key = kit["id"].split(":", 1)[1]
        tier = audit.get(key)
        nm = "int__" + key.replace(":", "__").replace(" ", "_").replace("+", "_")
        entry = {"name": nm, "kind": kind, "styleKind": "ground" if kind == "flat" else "prop", "note": f"atlas_biome_interior 키트 {kit['id']} ({kit['name']}) · 10-01 전수조사 {tier or '없음'}", "img": img}
        if tier == "ok" and kit["id"] not in DEFECT_KITS:
            taken[typ] = taken.get(typ, 0) + 1
            inter.append({**entry, "view34": "good", "style": "good", "group": "originals-interior-v5", "original": "atlas_biome_interior"})
        elif sum(1 for u in unsure if u["name"].split("__")[1] == nm.split("__")[1]) < MAX_PER_TYPE:
            unsure.append({**entry, "view34": None, "style": None, "group": "uncertain-interior-v5", "audit": tier or "unaudited", "defect": kit["id"] in DEFECT_KITS})
    write_set("originals-interior", inter)
    write_set("uncertain-interior", unsure)

    # object-gen oprn-interior-v5-large
    base = Path(a.objgen) / "objectgen" / "anchors" / "oprn-interior-v5-large"
    meta = json.loads((base / "set.json").read_text())
    kind_of = lambda f: "low_furniture" if ("bed" in f or "dining" in f) else "seat" if ("chair" in f or "armchair" in f) else "tall_furniture"
    v5l = []
    for e in meta["examples"]:
        v5l.append({"name": "v5l__" + e["file"][:-4], "kind": kind_of(e["file"]), "styleKind": "prop", "view34": "good", "style": "good", "group": "originals-v5large",
                    "original": "oprn-interior-v5-large", "note": e["label"], "img": Image.open(base / e["file"]).convert("RGBA")})
    for e in meta["bad"] + meta["rejects"]:
        v5l.append({"name": "v5l__" + e["file"][:-4], "kind": kind_of(e["file"]), "styleKind": "prop", "view34": "bad", "style": None, "group": "v5large-bad",
                    "note": f"object-gen 견본 반려: {e['why']}", "img": Image.open(base / e["file"]).convert("RGBA")})
    write_set("originals-v5large", v5l)

    # 버들항 원본: 기존 표본의 이름만 묶는다(그림 복사 없음)
    beodeul = []
    for st in ("fresh3", "style", "fresh4"):
        for it in json.loads((CAL / st / "items.json").read_text()):
            g = it.get("group", "")
            if g == "fresh3-beodeul-good" or g == "beodeul-heldout" or g == "fresh4-style-beodeul":
                beodeul.append(f"{st}/{it['name']}")
    (CAL / "originals.json").write_text(json.dumps({
        "about": "Opus 최종 판정 보정 조건 (b) — 알려진 정상 원본. 전체 판정(3/4·화풍 둘 다)으로 90% 이상 통과해야 한다. 판정 전에 고정(2026-10-21).",
        "groups": {"beodeul_city": beodeul, "jp_city": [f"originals-jp/{e['name']}" for e in jp], "atlas_biome_interior": [f"originals-interior/{e['name']}" for e in inter],
                   "oprn-interior-v5-large": [f"originals-v5large/{e['name']}" for e in v5l if e["view34"] == "good"]},
        "uncertain": [f"uncertain-interior/{e['name']}" for e in unsure],
    }, ensure_ascii=False, indent=1) + "\n")
    print("beodeul", len(beodeul))


if __name__ == "__main__":
    main()
