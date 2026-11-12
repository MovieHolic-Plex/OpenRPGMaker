#!/usr/bin/env python3
"""버들항 이야기 기물 16종(샘·동굴 입구·유적 입구·빛나는 파편·야영 천막·가축 우리·늪 널빤지 길 넷·곡괭이·게시판·쪽지·봉인 제단·무너진 기둥·기록부)을
공용 버들항 시트 꼬리 34,944~35,071(한 줄 128칸)에 덧붙인다.

  python3 scripts/content/beodeul-objects/bake.py --dry   # 관문 상태만
  python3 scripts/content/beodeul-objects/bake.py         # 굽는다

그림 정본: tiledata/beodeul-objects/pieces/<id>.png (Claude Fable 5.2 medium 한 방, 색은 버들항 시트에서 뽑음) · 정의 tiledata/beodeul-objects/spec.json.
3/4 관문(hard rule): 그림마다 object-gate 출구 `require_all(context="bundle")` — 하나라도 막히면 아무것도 쓰지 않는다. 초안·임시 통과 길은 없다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12** (harness-data/object-gate/waivers) 로 출구를 지난다. 면제는 그림 화소 해시 + 종류에
묶여 있다 — pieces/ 의 그림을 한 화소라도 바꾸면 굽기가 멈춘다. 면제는 통과가 아니다(스토어 출구는 막힌다).

칸 번호는 덧붙이기 전용이다: spec.json 순서대로 굽고, 새 항목은 **끝에** 더한다(순서를 바꾸거나 빼면 아래 검사가 멈춘다). 한 줄(128칸)을 넘기면 줄을 늘린다 —
그때는 시트 끝 뒤 번들 이식 칸이 또 밀리므로 `npx tsx scripts/content/check-bundle-save-compat.mts <저장본 폴더>` 로 실제 저장본 사본을 다시 연다.
시트 순서: … → 호숫가(bake_lakeshore.py, 34,048~34,815) → 옛 상수도(bake_waterworks.py, 34,816~34,943) → 이야기 기물(이것). bake_waterworks.py 가 끝에서 이것을 다시 부른다.

놓는 방식(spec place): prop·tall = 서 있는 기물(block 칸만 막힘, 나머지 칸은 ★ 사람 위에 그려짐) · decal = 밟고 지나가는 바닥 그림(널빤지 길·쪽지 — 위층에 놓여
물 칸 위에서도 걸을 수 있다). 조수가 찾는 낱말은 코드가 아니라 킷 이름·태그(spec words)에 있다.
쓰는 것: public/assets/beodeul-city/beodeul-city-chipset.png · src/assets/beodeulCityTileset.json(칸 표·킷 bd-obj-*) · src/assets/beodeulCitySheet.json ·
tiledata/beodeul-objects/catalog.json(칸 번호·막힘·해시 — 탐침과 참고문서가 읽는다).
"""
import argparse, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
STORE = ROOT / "tiledata/beodeul-objects"
CATALOG = STORE / "catalog.json"
T, COLS, BASE = 16, 128, 34944
KIT_PREFIX = "bd-obj-"
FAMILY_KO = {"water": "물가", "entrance": "입구", "story": "이야기 물건", "camp": "야영", "farm": "농장", "swamp": "늪", "mine": "광산", "village": "마을", "ruin": "유적"}
OPEN = {k: True for k in ("up", "down", "left", "right")}
SHUT = {k: False for k in ("up", "down", "left", "right")}
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."


def load():
    spec = json.loads((STORE / "spec.json").read_text(encoding="utf-8"))
    items = spec["items"]
    imgs = {it["id"]: Image.open(STORE / "pieces" / it["src"]).convert("RGBA") for it in items}
    for it in items:
        assert imgs[it["id"]].size == (it["w"] * T, it["h"] * T), (it["id"], imgs[it["id"]].size)
        assert it["place"] in ("prop", "tall", "decal") and all(0 <= x < it["w"] and 0 <= y < it["h"] for x, y in it["block"]), it["id"]
    return spec, items, imgs


def cut(items, imgs):
    """항목 → 칸 행렬(시트 번호). 통째로 투명한 칸은 -1. 같은 그림의 칸도 따로 둔다(칸 표가 항목마다 다르다)."""
    cells, rows_of = [], {}
    for it in items:
        a = np.array(imgs[it["id"]])
        rows = []
        for y in range(it["h"]):
            row = []
            for x in range(it["w"]):
                c = a[y * T:(y + 1) * T, x * T:(x + 1) * T]
                if not (c[..., 3] > 0).any():
                    row.append(-1); continue
                row.append(BASE + len(cells)); cells.append((it, x, y, c))
            rows.append(row)
        rows_of[it["id"]] = rows
    return cells, rows_of


def kit_of(it, rows):
    flat = it["place"] == "decal"
    blocked = " ".join(f"({x},{y})" for x, y in it["block"])
    rest = ", 나머지 칸은 사람 위에 그려진다" if len(it["block"]) < it["w"] * it["h"] else ""
    ai = dict(role="prop", repeatability="repeat" if it.get("growth") else "fixed")
    if it.get("growth"): ai["growthAxis"] = it["growth"]
    ai["layerHome"] = "upper"
    # «주제 소품» = 이름을 대야만 놓이는 것(openGround 의 주제 소품) — 빈 땅 채우기가 제단·쪽지를 흩지 않는다.
    ai["tags"] = [it["place"], "버들항", "기물", "주제 소품", FAMILY_KO.get(it["family"], it["family"]), *it["words"]]
    ai["themes"] = it["themes"]
    ai["description"] = f"{it['desc']} ({it['en']}) — " + ("바닥 그림, 밟고 지나간다." if flat else f"서 있는 기물, 막힌 칸 {blocked}{rest}.") + f" {GATE_NOTE}"
    ai["placementRules"] = it["rule"]
    if it.get("access"): ai["access"] = it["access"]
    kit = dict(id=KIT_PREFIX + it["id"], name=f"버들항 기물 · {it['name']} {it['w']}×{it['h']}", kind="section", width=it["w"], height=it["h"], tileSize=T,
               learnedFrom="pack-preset", rows=[dict(tiles=[-1] * it["w"], upperTiles=r) for r in rows])
    if it.get("parts"): kit["parts"] = it["parts"]
    kit["ai"] = ai
    return kit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    from object_gate import require_all
    spec, items, imgs = load()
    got = require_all([(imgs[it["id"]], it["kind"], f"beodeul_objects/{it['id']}") for it in items], context="bundle")
    print(f"관문(bundle 출구): {len(got)}/{len(items)} — {GATE_NOTE} 묶음 {spec['waiver']}")
    cells, rows_of = cut(items, imgs)
    if CATALOG.exists():   # 덧붙이기 전용: 출하된 칸 번호는 그 그림을 지킨다
        old = {it["id"]: it["rows"] for it in json.loads(CATALOG.read_text(encoding="utf-8"))["items"]}
        moved = [i for i in old if old[i] != rows_of.get(i)]
        if moved: sys.exit(f"칸 번호가 바뀐다: {moved} — 새 항목은 spec.json 끝에 더한다(순서 바꾸기·빼기 금지)")
    rows = -(-len(cells) // COLS)
    count = BASE + rows * COLS
    print(f"칸 {len(cells)}개 → 꼬리 {BASE}..{count - 1} ({rows}줄)")
    if a.dry:
        return
    sheet_count = json.loads(SHEET_JSON.read_text())["count"]
    if sheet_count < BASE:
        sys.exit(f"시트가 {BASE} 칸보다 짧다({sheet_count}) — 옛 상수도 꼬리(bake_waterworks.py)부터 굽는다")
    if sheet_count > count:
        sys.exit(f"시트 count {sheet_count} 가 이 꼬리 끝 {count} 보다 크다 — 뒤에 다른 꼬리가 붙었다. 그 꼬리 굽기가 이 스크립트 뒤에서 다시 돌아야 한다")
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    out = Image.new("RGBA", (COLS * T, (BASE // COLS + rows) * T), (0, 0, 0, 0))
    out.alpha_composite(sheet.crop((0, 0, COLS * T, (BASE // COLS) * T)), (0, 0))
    ts = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"):
        ts[k] = ts[k][:BASE]
    ts["animationStrips"] = [s for s in ts["animationStrips"] if s["baseTile"] < BASE]
    for i, (it, x, y, c) in enumerate(cells):
        out.alpha_composite(Image.fromarray(c, "RGBA"), ((i % COLS) * T, (BASE // COLS + i // COLS) * T))
        block = [x, y] in it["block"]
        flat = it["place"] == "decal"
        # 서 있는 기물: 막힌 칸은 사람과 같은 층(막힘), 나머지는 ★(사람 위·통행). 바닥 그림: 사람 아래·통행.
        ts["passability"].append(dict(SHUT if block else OPEN))
        ts["priority"].append("lower" if block or flat else "upper")
        ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label=f"버들항 기물 · {it['name']}" + (f" ({x},{y})" if it["w"] * it["h"] > 1 else ""), description=f"{it['desc']} {GATE_NOTE}",
                                   tags=["버들항", "기물", FAMILY_KO.get(it["family"], it["family"]), *it["words"]], defaultLayer="upper",
                                   passage="solid" if block else "walk" if flat else "star", source="bundled-default"))
    for _ in range(len(cells), rows * COLS):
        ts["passability"].append(dict(OPEN)); ts["priority"].append("lower"); ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label="", description="", source="bundled-default"))
    kits = [kit_of(it, rows_of[it["id"]]) for it in items]
    ts["structureKits"] = [k for k in ts["structureKits"] if not k["id"].startswith(KIT_PREFIX)] + kits
    ts["count"] = count
    out.save(SHEET_PATH, optimize=True)
    TS_PATH.write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=count, tilesPerRow=COLS)) + "\n")
    cat = dict(tilesetId="beodeul_city", texture="tex_beodeul_city", tileSize=T, tilesPerRow=COLS, base=BASE, count=count, kitPrefix=KIT_PREFIX,
               source="scripts/content/beodeul-objects/bake.py (Claude Fable 5.2 medium one-shot pictures, colours taken from the beodeul_city sheet)",
               license=spec["license"], gate=f"3/4 gate not passed — owner waiver {spec['waiver']}",
               items=[dict(id=it["id"], kit=KIT_PREFIX + it["id"], name=it["name"], en=it["en"], kind=it["kind"], width=it["w"], height=it["h"], place=it["place"],
                           rows=rows_of[it["id"]], block=it["block"], words=it["words"], sha256=sha) for it, sha in zip(items, got)])
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"이야기 기물 꼬리 {BASE}..{count - 1}: 킷 {len(kits)}개 ({KIT_PREFIX}*)")


if __name__ == "__main__":
    main()
