#!/usr/bin/env python3
"""기물 크기 사전(size bible) 실측 — 손 도트 실내 v5(handInteriorSpec.json)와 버들항 소품 킷(beodeulCityTileset.json)에서
흔한 기물 종류별로 칸 수(가로 × 발밑 줄 + 위로 솟은 줄)와 막힘 모양을 잰다.

    python3 scripts/content/measure-object-footprints.py            # 종류별 표(사람이 읽는 글)
    python3 scripts/content/measure-object-footprints.py --json     # object-gen objectgen/footprint.py 의 MEASURED 에 넣는 JSON

정본 표와 판단 규칙은 object-gen(MovieHolic-Plex/object-gen) `objectgen/footprint.py` 다 — 편집기는 gen-kits 로 받아 쓴다.
이 스크립트는 그 숫자의 출처를 다시 재는 용도다(칩셋이 바뀌면 다시 돌려 object-gen 에 반영).

막힘 읽기:
- 실내 v5: w×h = 발밑(막힘) 칸, up = 발밑 위로 솟는 px(캐릭터 위에 그려지는 덮개). 벽 걸이(hang)·바닥 무늬(flat)는 뺀다.
- 버들항 킷: 칸마다 칩셋 통행(passability)을 읽어 X(막힘) / *(지나감 = 위로 솟은 덮개) / 빈칸. 발밑 줄 = 아래에서부터 X 가 있는 줄.
"""
from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# 종류 → 낱말(한국어·영어). 첫 번째로 맞는 종류를 쓴다(순서가 우선순위). object-gen footprint.py 의 CLASSES 와 같은 이름.
CLASSES: list[tuple[str, str]] = [
    ("fountain", r"분수|fountain"),
    ("well", r"우물|well\b"),
    ("stall", r"노점|좌판|가판|진열 ?천막|stall|booth"),
    ("tent", r"천막|텐트|tent"),
    ("wagon", r"마차|짐수레|wagon|carriage"),
    ("cart", r"수레|손수레|광차|cart"),
    ("tree", r"(?<![통장])나무(?! ?(?:벤치|탁자|문|상자|궤짝|통|울타리|간판|의자|더미|다리))|올리브|사이프러스|야자|전나무|소나무|\btree\b|\bpalm\b|\bfir\b|\bpine\b|\bolive\b|\bcypress\b"),
    ("statue", r"석상|동상|조각상|기념 ?원주|기념비|statue|monument|obelisk"),
    ("lamp", r"가로등|등불 ?기둥|횃불 ?기둥|등 기둥|lamp ?post|lamppost|\blamp\b"),
    ("signpost", r"이정표|표지판|입간판|팻말|signpost|milestone|sign\b"),
    ("banner", r"깃발|깃대|banner|flag"),
    ("bed", r"(?<!받)침대|\bbed\b"),
    ("wardrobe", r"옷장|책장|찬장|장식장|wardrobe|bookshelf|bookcase|cabinet|cupboard"),
    ("bench", r"벤치|걸상|bench"),
    ("table", r"탁자|테이블|책상|table|desk"),
    ("chair", r"의자|chair|stool|armchair"),
    ("counter", r"계산대|카운터|조리대|counter"),
    ("hearth", r"화덕|벽난로|난로|화로|stove|hearth|fireplace|oven"),
    ("trough", r"구유|먹이통|말 ?물통|trough|꽃상자|flowerbox"),
    ("crate", r"궤짝|상자|crate|box|chest|궤\b"),
    ("barrel", r"통\b|술통|나무통|barrel|keg|cask|bucket|tub"),
    ("jar", r"항아리|단지|독\b|옹기|jar|pot\b|urn|amphora|vase"),
    ("plant", r"화분|관목|덤불|화단|꽃밭|plant|shrub|bush|flowerbed|planter|potted"),
    ("pile", r"더미|무더기|자루|짚가리|건초|pile|stack|sack|hay"),
    ("rack", r"건조대|걸이|시렁|빨래|rack|stand\b"),
    ("boat", r"배\b|보트|boat"),
]
EXCLUDE = re.compile(r"이랑|집|오두막|저택|헛간|사원|신전|탑|창고|성\b|벽칸|지붕|굴뚝|박공|담쟁이|난간|돌담|울타리|아치|문칸|창칸|다리|강|운하|잔디|바닥|모래|절벽|물\b|밭|광장|길\b|house|wall|roof|cabin|temple|bridge|ground", re.I)


def classify(name: str, ident: str) -> str | None:
    text = f"{name} {ident}".lower()
    if EXCLUDE.search(text):
        return None
    for cls, pattern in CLASSES:
        if re.search(pattern, text, re.I):
            return cls
    return None


def interior() -> list[dict]:
    spec = json.loads((ROOT / "src/assets/handInteriorSpec.json").read_text())
    out = []
    for key, obj in spec["objects"].items():
        if obj.get("kind") not in ("floor", "wall"):
            continue
        cls = classify(obj.get("ko") or "", key)
        if not cls:
            continue
        up = int(obj.get("up") or 0)
        out.append({"source": "interior-v5", "id": key, "name": obj.get("ko"), "cls": cls, "w": obj["w"], "foot": obj["h"],
                    "overPx": up, "over": -(-up // 16), "mask": None})
    return out


def beodeul() -> list[dict]:
    t = json.loads((ROOT / "src/assets/beodeulCityTileset.json").read_text())
    passability = t["passability"]

    def blocked(i: int) -> bool:
        p = passability[i] if 0 <= i < len(passability) else None
        return isinstance(p, dict) and not all(p.get(d, True) for d in ("up", "down", "left", "right"))

    out = []
    for kit in t["structureKits"]:
        if kit["width"] > 8 or kit["height"] > 8:
            continue
        name = re.sub(r"^버들항 (?:소품 |[^·]*· )?", "", kit.get("name") or "")
        name = re.sub(r"\s*\d+×\d+$", "", name)
        cls = classify(name, kit["id"])
        if not cls or kit["id"].startswith(("bd-tree-", "bd-mpart-", "bd-out-log", "bd-out-plank", "bd-out-roof", "bd-ground")):
            continue
        mask = []
        for row in kit["rows"]:
            line = ""
            for x in range(kit["width"]):
                ids = [i for layer in ("tiles", "upperTiles") for i in [(row.get(layer) or [])[x] if x < len(row.get(layer) or []) else -1] if i is not None and i >= 0]
                line += " " if not ids else "X" if any(blocked(i) for i in ids) else "*"
            mask.append(line)
        while mask and not mask[0].strip():
            mask.pop(0)  # 맨 위 빈 줄(그림 없음)은 크기가 아니다
        foot = 0
        for line in reversed(mask):
            if "X" in line:
                foot += 1
            else:
                break
        if foot == 0:
            continue  # 지나가는 장식(널다리 등)
        over = len(mask) - foot
        out.append({"source": "beodeul", "id": kit["id"], "name": name, "cls": cls, "w": kit["width"], "foot": foot,
                    "overPx": over * 16, "over": over, "mask": mask})
    return out


def summary(rows: list[dict]) -> dict:
    by = collections.defaultdict(list)
    for r in rows:
        by[r["cls"]].append(r)
    table = {}
    for cls, _ in CLASSES:
        items = by.get(cls, [])
        if not items:
            continue
        shapes = collections.Counter((r["w"], r["foot"], r["over"]) for r in items)
        (w, foot, over), n = shapes.most_common(1)[0]
        table[cls] = {
            "n": len(items),
            "mode": {"w": w, "foot": foot, "over": over, "count": n},
            "w": [min(r["w"] for r in items), max(r["w"] for r in items)],
            "foot": [min(r["foot"] for r in items), max(r["foot"] for r in items)],
            "over": [min(r["over"] for r in items), max(r["over"] for r in items)],
            "examples": [f"{r['source']}:{r['name']} {r['w']}x{r['foot']}+{r['over']}" + (f" [{'|'.join(r['mask'])}]" if r["mask"] else "")
                         for r in sorted(items, key=lambda r: (-shapes[(r['w'], r['foot'], r['over'])], r["source"]))[:6]],
        }
    return table


if __name__ == "__main__":
    rows = interior() + beodeul()
    table = summary(rows)
    if "--json" in sys.argv:
        print(json.dumps(table, ensure_ascii=False, indent=1))
    else:
        for cls, s in table.items():
            m = s["mode"]
            print(f"{cls:9} n={s['n']:3}  흔한 크기 {m['w']}×{m['foot']}+{m['over']} ({m['count']})  폭 {s['w']} 발밑 {s['foot']} 솟음 {s['over']}")
            for e in s["examples"]:
                print(f"            {e}")
