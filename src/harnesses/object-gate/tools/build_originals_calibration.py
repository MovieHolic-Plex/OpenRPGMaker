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
import re
import hashlib
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
    "basket": "container", "pot": "container", "water jar": "container", "cauldron": "container", "bathtub": "container",
    "holy water font": "container", "potted fern": "container", "potted flowering": "container", "potted cactus": "container",
    "barrel": "round_body", "quench barrel": "round_body",
    "shelf": "wall_structure", "cabinet": "tall_furniture", "cupboard": "tall_furniture", "wardrobe": "tall_furniture", "bookshelf 1w": "tall_furniture",
    "bookshelf 2w": "tall_furniture", "bookshelf 3w": "tall_furniture", "apothecary drawers": "tall_furniture", "fireplace": "tall_furniture", "stove": "tall_furniture",
    "washbasin": "low_furniture", "table": "low_furniture", "roundtable": "low_furniture", "nightstand": "low_furniture", "dining 2x1": "low_furniture", "desk 2x1": "low_furniture",
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


AUDIT = CAL / "audit-2026-10-21.json"  # 감독 지시 감사(v6 에서 떨어진 원본·놓친 위반) — 종류 라벨 수정·결함·(a) 제외를 여기서 적용한다


def apply_audit_to_sets(audit: list[dict]) -> None:
    """fresh3·style 처럼 손으로 고정한 표본에 감사 결과를 적용한다(멱등). i=종류 수정, iii=불확실·결함, out=화풍 위반은 약한 라벨(보고만)."""
    by_set: dict[str, dict[str, dict]] = {}
    for a in audit:
        st, nm = a["label"].split("/", 1)
        by_set.setdefault(st, {})[nm] = a
    for st, m in by_set.items():
        path = CAL / st / "items.json"
        if not path.exists():
            continue  # 이 빌더가 만드는 묶음(originals-*)은 아래에서 따로 적용
        items = json.loads(path.read_text())
        for it in items:
            a = m.get(it["name"])
            if not a:
                continue
            if a["class"] == "i":
                it.setdefault("kindBefore", it["kind"])
                it["kind"] = a["newKind"]
                it["relabel"] = f"2026-10-21 감사: {a['reason']}"
            elif a["class"] == "iii":
                it.setdefault("groupBefore", it.get("group"))
                it["group"] = "uncertain-defect"
                it["defect"] = f"2026-10-21 감사: {a['reason']}"
            elif a["class"] == "out":
                it["weak"] = True
                it["auditOut"] = f"2026-10-21 감사: {a['reason']}"
        path.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n")


def base_name(label: str) -> str:
    """같은 물건의 변형(거울·눌림·얇게·색조·다른 묶음 사본)을 한 이름으로 — 틀린 예·대조 쌍과 같은 물건은 채점에서 같이 뺀다(누설 방지)."""
    n = label.split("/", 1)[1]
    n = re.sub(r"^(holdout|interior|murim|fresh2?|style)__", "", n)
    n = re.sub(r"^(mir|flat|thin|hue|real|realbad)_", "", n)
    return re.sub(r"^(int|v5l|jp|beodeul|synthetic)__", "", n)


# 대조 쌍(v9, 감독 지시 2026-10-21): 약한 유형마다 같은 칩셋의 맞는 그림 하나와 위반 하나. 판정자에게 같은 종류 줄에 보이고, 채점에서 뺀다.
# 고르는 규칙: v7·v8 에서 판정이 틀린 「어려운」 그림(hard-2026-10-21.json)과 같은 물건은 쓰지 않는다 — 어려운 표본을 채점에서 지우는 것이 되기 때문.
# 예외 하나: 합성 집은 위반이 h106·h122 둘뿐이라 h122 쌍을 쓰고 h106 은 채점에 남긴다(보고에 적는다).
CONTRAST = [
    {"pattern": "seat backrest vs seat", "kind": "seat", "good": "pairs/new-pew-e", "bad": "interior/pew__v5",
     "note": "same pew redrawn: green shows the seat plank as a top plane (rows of seat seen from above) in front of the backrest; red shows the backrest face-on with only a thin strip where the seat should be"},
    {"pattern": "side-facing seat", "kind": "seat", "good": "pairs/new-chair-e", "bad": "interior/chair_E__v5",
     "note": "same east-facing chair redrawn: green shows the seat as a horizontal plane of about 4 rows seen from above in front of the backrest post; red shows the seat as a thin edge under the side silhouette"},
    {"pattern": "wooden stand frame", "kind": "frame", "good": "style/prehistoric__fish-rack__after", "bad": "style/prehistoric__fish-rack__before",
     "note": "same rack: green draws the beams and posts with lit top faces and tinted outlines; red is the flat early version"},
    {"pattern": "composite house", "kind": "structure", "good": "style/beodeul__house-h122_0", "bad": "style/synthetic__house-h122_0", "allowHard": True,
     "note": "same house: green is the original; red is the same house quantised to 4 colours with a near-black outline (charge 8a/8b)"},
    {"pattern": "counter or cart with goods", "kind": "low_furniture", "good": "fresh3/b3_prop-veg_cart", "bad": "holdout/flat_nightstand__w8-C",
     "note": "green: goods heaped on a deck whose top plane is visible behind and between them; red: the top is a 1-2 row lip over a flat front"},
    {"pattern": "barrel", "kind": "round_body", "good": "originals-interior/int__barrel__apple", "bad": "interior/powder_kegs__w9-B",
     "note": "green: a barrel filled with apples seen from above inside the rim; red: barrel ends drawn face-on with no top ellipse"},
    {"pattern": "cauldron or basin", "kind": "container", "good": "originals-interior/int__holy_water_font", "bad": "fresh4/q039_interior",
     "note": "green: liquid surface seen from above inside an elliptical rim, about 3 rows at 16px; red: the rim is a 1-2 row dark band and nothing inside is seen"},
    {"pattern": "potted plant", "kind": "container", "good": "originals-interior/int__potted_flowering", "bad": None,
     "note": "green: the plant fills the pot mouth seen from above; the rim ellipse shows behind the stems"},
    {"pattern": "bed footboard", "kind": "low_furniture", "good": "originals-interior/int__double_bed_red", "bad": None,
     "note": "green: a bed is mostly its top (pillows, blanket) seen from above with a short footboard front of 2-4 rows — that is correct for beds"},
]


def check_contrast() -> list[dict]:
    for c in CONTRAST:
        for side in ("good", "bad"):
            lab = c.get(side)
            if not lab:
                continue
            if not (CAL / f"{lab}.png").exists():
                raise SystemExit(f"대조 쌍 그림 없음: {lab}")
            if base_name(lab) in HARD_BASES and not c.get("allowHard"):
                raise SystemExit(f"대조 쌍 {lab} 은 어려운 표본과 같은 물건이다 — 쓰지 않는다")
    return CONTRAST


def negatives(skip: set[str]) -> dict[str, list[str]]:
    """종류마다 확실(A) 3/4 위반 2장 — 판정자에게 같은 종류의 「틀린 예」로 보인다. 이 그림들은 보정 (a)·(b) 에서 뺀다(누설 방지)."""
    tiers = json.loads((CAL / "tiers.json").read_text()).get("tiers", {})
    pool: dict[str, list[str]] = {}
    lab = json.loads((CAL / "interior" / "labels.json").read_text())
    for nm in lab["bad"]:
        pool.setdefault(lab["kinds"][nm], []).append(f"interior/{nm}")
    for st in ("fresh4", "fresh5", "holdout"):
        f = CAL / st / "items.json"
        lf = CAL / st / "labels.json"
        if f.exists():
            for it in json.loads(f.read_text()):
                if it.get("view34") == "bad" and it.get("tier", "A") == "A":
                    pool.setdefault(it["kind"], []).append(f"{st}/{it['name']}")
        elif lf.exists():
            l2 = json.loads(lf.read_text())
            for nm in l2["bad"]:
                pool.setdefault(l2["kinds"][nm], []).append(f"{st}/{nm}")
    out = {}
    for k, labels in pool.items():
        # 감사한 표본(놓친 위반 등)은 쓰지 않는다 — 틀린 예로 쓰면 (a) 에서 빠져 숫자가 좋아진다. 고르는 순서는 이름의 해시(결정적, 판정 결과와 무관).
        ok = sorted((x for x in labels if tiers.get(x, {}).get("tier", "A") == "A" and x not in skip and base_name(x) not in HARD_BASES), key=lambda x: hashlib.sha256(x.encode()).hexdigest())
        if ok:
            out[k] = ok[:2]
    return out


HARD_BASES = {base_name(x) for x in json.loads((CAL / "hard-2026-10-21.json").read_text())} if (CAL / "hard-2026-10-21.json").exists() else set()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--holds", required=True, help="18323 서버의 harness-data/object-gate")
    ap.add_argument("--objgen", required=True, help="object-gen 체크아웃")
    a = ap.parse_args()
    holds = Path(a.holds)
    audit21 = json.loads(AUDIT.read_text())["items"] if AUDIT.exists() else []
    apply_audit_to_sets(audit21)
    out_v5l = {x["label"].split("/", 1)[1]: x for x in audit21 if x["class"] == "out" and x["label"].startswith("originals-v5large/")}

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
        nm = "v5l__" + e["file"][:-4]
        ent = {"name": nm, "kind": kind_of(e["file"]), "styleKind": "prop", "view34": "bad", "style": None, "group": "v5large-bad",
               "note": f"object-gen 견본 반려: {e['why']}", "img": Image.open(base / e["file"]).convert("RGBA")}
        if nm in out_v5l:  # 반려 이유가 시점이 아니라 화풍 → (a) 에서 빼고 약한 화풍 위반(보고만)
            ent.update(view34=None, style="bad", weak=True, auditOut=f"2026-10-21 감사: {out_v5l[nm]['reason']}")
        v5l.append(ent)
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
        "uncertain": [f"uncertain-interior/{e['name']}" for e in unsure]
                     + [f"fresh3/{x['label'].split('/', 1)[1]}" for x in audit21 if x["class"] == "iii" and x["label"].startswith("fresh3/")],
        "defects": sorted(["uncertain-interior/int__crate__cabbage", "uncertain-interior/int__table__cake_pie", "uncertain-interior/int__stove"]
                          + [x["label"] for x in audit21 if x["class"] == "iii"]),
        "negatives": negatives({x["label"] for x in audit21}),
        "contrast": check_contrast(),
    }, ensure_ascii=False, indent=1) + "\n")
    print("beodeul", len(beodeul))


if __name__ == "__main__":
    main()
