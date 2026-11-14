#!/usr/bin/env python3
"""버들항 이야기 기물 16종(샘·동굴 입구·유적 입구·빛나는 파편·야영 천막·가축 우리·늪 널빤지 길 넷·곡괭이·게시판·쪽지·봉인 제단·무너진 기둥·기록부)과
종류별 변형(2026-11-12 — 우물·벤치·이정표·상자·통·모닥불·짚가리·장작더미·가로등·손수레·제단·화로·계선주·빨래·화분·꽃밭·허수아비·입간판·짐 더미의 다른 그림)을
그리고 새 종류 105종(2026-11-14 — 마을 살림·물가와 물 위·농장·길가와 숲 바닥·절벽 위아래·유적과 묘지, 면제 묶음 fable-objects100-beodeul-2026-11-14)과
마을 종류별 기물(2026-11-14 — 마을 종류 38개의 생업 장면 벌과 공통 기물, 면제 묶음 fable-objects300-beodeul-2026-11-14)을
공용 버들항 시트 꼬리 34,944~(한 줄 128칸씩, 줄 수는 칸 수에 맞춰 늘어난다)에 덧붙인다.

  python3 scripts/content/beodeul-objects/bake.py --dry   # 관문 상태만
  python3 scripts/content/beodeul-objects/bake.py         # 굽는다

그림 정본: tiledata/beodeul-objects/pieces/<id>.png (Claude Fable 5.2 medium 한 방, 색은 버들항 시트에서 뽑음) · 정의 tiledata/beodeul-objects/spec.json.
3/4 관문(hard rule): 그림마다 object-gate 출구 `require_all(context="bundle")` — 하나라도 막히면 아무것도 쓰지 않는다. 초안·임시 통과 길은 없다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12** (harness-data/object-gate/waivers) 로 출구를 지난다. 면제는 그림 화소 해시 + 종류에
묶여 있다 — pieces/ 의 그림을 한 화소라도 바꾸면 굽기가 멈춘다. 면제는 통과가 아니다(스토어 출구는 막힌다).

칸 번호는 덧붙이기 전용이다: spec.json 순서대로 굽고, 새 항목은 **끝에** 더한다(순서를 바꾸거나 빼면 아래 검사가 멈춘다). 한 줄(128칸)을 넘기면 줄을 늘린다 —
그때는 시트 끝 뒤 번들 이식 칸이 또 밀리므로 `npx tsx scripts/content/check-bundle-save-compat.mts <저장본 폴더>` 로 실제 저장본 사본을 다시 연다.
시트 순서: … → 호숫가(bake_lakeshore.py, 34,048~34,815) → 옛 상수도(bake_waterworks.py, 34,816~34,943) → 이야기 기물(이것). bake_waterworks.py 가 끝에서 이것을 다시 부른다.

종류별 변형(spec variantOf = 같은 종류의 옛 킷 id): 그 킷과 칸 크기·막힌 칸이 같은 다른 그림이다(아래 검사가 맞춘다). 킷 ai.variantOf 로 굽히고, 조수 실행은
원본 id 로 온 놓기를 게임 열쇠로 고른 변형으로 찍는다(src/project/kitLook.ts) — 한 게임은 한 모습. 태그는 원본 킷의 태그 + 그 변형만의 낱말(종류 낱말 하나만은 넣지 않는다).
면제 묶음은 항목마다 다를 수 있다(spec item waiver, 없으면 spec waiver).

새 종류(variantOf 없음)는 갈아 끼우는 그림이 아니라 새 물건이다 — 마을·길·숲 빌더가 게임 열쇠로 골라 놓는다(src/editor/tools/beodeulObjectSets.ts).
spec on = water 는 물 칸 위에 놓는 기물(뗏목·부표·수련 — 막힘, 물은 원래 못 걷는다 · 징검돌 — 밟고 건넌다), on = shore 는 물가에 두는 기물.

마을 종류별 기물(spec kinds = 그 기물이 속한 마을 종류 id 목록, common = 여러 종류가 같이 쓰는 것): 킷 태그 `kind:<종류 id>` 로 굽고,
같은 표를 tiledata/beodeul-objects/kinds.json(킷 id → 종류 id 목록)으로도 쓴다 — 마을 종류 목록·빌더가 읽는다. 종류 이름은 spec kindNames.

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
FAMILY_KO = {"water": "물가", "entrance": "입구", "story": "이야기 물건", "camp": "야영", "farm": "농장", "swamp": "늪", "mine": "광산", "village": "마을", "ruin": "유적", "harbour": "항구",
             "forest": "숲 바닥", "cliff": "절벽·바위", "grave": "묘지", "road": "길가"}
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


def variant_base(it, ts):
    """변형의 원본 킷 — 칸 크기와 막힌 칸이 같아야 갈아 끼울 수 있다. 다르면 굽지 않는다."""
    base = next((k for k in ts["structureKits"] if k["id"] == it["variantOf"]), None)
    if base is None: sys.exit(f"{it['id']}: 원본 킷 {it['variantOf']} 이 없다")
    if (base["width"], base["height"]) != (it["w"], it["h"]): sys.exit(f"{it['id']}: 칸 크기 {it['w']}×{it['h']} 가 원본 {base['id']} {base['width']}×{base['height']} 와 다르다")
    blocked = sorted([x, y] for y, row in enumerate(base["rows"]) for x in range(base["width"])
                     if any(t >= 0 and not all(ts["passability"][t].values()) for t in (row.get("tiles", [-1] * base["width"])[x], (row.get("upperTiles") or [-1] * base["width"])[x])))
    if blocked != sorted(it["block"]): sys.exit(f"{it['id']}: 막힌 칸 {sorted(it['block'])} 이 원본 {base['id']} 의 {blocked} 와 다르다")
    # 원본이 비운 칸에는 그림을 두지 않는다 — 원본이 들어가는 자리면 변형도 들어간다(변형이 남의 칸을 덮거나 «이미 타일» 로 거절되지 않는다).
    im = Image.open(STORE / "pieces" / it["src"]).convert("RGBA")
    for y, row in enumerate(base["rows"]):
        for x in range(base["width"]):
            empty = row.get("tiles", [-1] * base["width"])[x] < 0 and (row.get("upperTiles") or [-1] * base["width"])[x] < 0
            if empty and im.crop((x * T, y * T, x * T + T, y * T + T)).getchannel("A").getbbox():
                sys.exit(f"{it['id']}: 원본 {base['id']} 이 비운 칸 ({x},{y}) 에 그림이 있다 — 그 칸을 비워라")
    return base


def kit_of(it, rows, base=None):
    flat = it["place"] == "decal"
    blocked = " ".join(f"({x},{y})" for x, y in it["block"])
    rest = ", 나머지 칸은 사람 위에 그려진다" if len(it["block"]) < it["w"] * it["h"] else ""
    ai = dict(role="prop", repeatability="repeat" if it.get("growth") else "fixed")
    if it.get("growth"): ai["growthAxis"] = it["growth"]
    ai["layerHome"] = "upper"
    # «주제 소품» = 이름을 대야만 놓이는 것(openGround 의 주제 소품) — 빈 땅 채우기가 제단·쪽지를 흩지 않는다.
    ai["tags"] = [it["place"], "버들항", "기물", "주제 소품", FAMILY_KO.get(it["family"], it["family"]), *it["words"]]
    # 물 위에 놓는 기물(spec on = water): «물 위» 태그 — 놓기 도구의 발자국 검사(뭍의 서는 소품용)가 물 위 부품으로 보고 건너뛴다. 물 칸이어야 한다는 규칙은 kitPlacementRules.ts.
    if it.get("on") == "water": ai["tags"].append("물 위")
    # 마을 종류(spec kinds): 그 종류의 생업 장면에 같이 놓이는 벌 — 킷 태그 kind:<종류 id> (kinds.json 과 같은 내용)
    ai["tags"] += [f"kind:{k}" for k in it.get("kinds", [])]
    if base is not None:   # 변형: 원본 킷의 태그(쓰임·장소)도 단다 — 원본을 찾는 태그 검색이 변형도 찾는다. 빈 땅 채우기에는 흩지 않는다(«주제 소품»).
        ai["tags"] += [t for t in base.get("ai", {}).get("tags", []) if t not in ai["tags"] and t not in ("prop", "물체")]
        ai["variantOf"] = base["id"]
    ai["themes"] = it["themes"]
    ai["description"] = f"{it['desc']} ({it['en']}) — " + ("바닥 그림, 밟고 지나간다." if flat else f"서 있는 기물, 막힌 칸 {blocked}{rest}.") \
        + (f" 「{base.get('name', base['id'])}」({base['id']}) 과 같은 종류의 다른 그림(같은 칸 크기·같은 막힌 칸)." if base is not None else "") + f" {GATE_NOTE}"
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
    waivers = sorted({it.get("waiver", spec["waiver"]) for it in items})
    print(f"관문(bundle 출구): {len(got)}/{len(items)} — {GATE_NOTE} 묶음 {', '.join(waivers)}")
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
                                   tags=["버들항", "기물", FAMILY_KO.get(it["family"], it["family"]), *it["words"], *(["prop"] if it.get("variantOf") else [])], defaultLayer="upper",
                                   passage="solid" if block else "walk" if flat else "star", source="bundled-default"))
    for _ in range(len(cells), rows * COLS):
        ts["passability"].append(dict(OPEN)); ts["priority"].append("lower"); ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label="", description="", source="bundled-default"))
    kits = [kit_of(it, rows_of[it["id"]], variant_base(it, ts) if it.get("variantOf") else None) for it in items]
    ts["structureKits"] = [k for k in ts["structureKits"] if not k["id"].startswith(KIT_PREFIX)] + kits
    ts["count"] = count
    out.save(SHEET_PATH, optimize=True)
    TS_PATH.write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=count, tilesPerRow=COLS)) + "\n")
    cat = dict(tilesetId="beodeul_city", texture="tex_beodeul_city", tileSize=T, tilesPerRow=COLS, base=BASE, count=count, kitPrefix=KIT_PREFIX,
               source="scripts/content/beodeul-objects/bake.py (Claude Fable 5.2 medium one-shot pictures, colours taken from the beodeul_city sheet)",
               license=spec["license"], gate=f"3/4 gate not passed — owner waivers {', '.join(waivers)}",
               items=[dict(id=it["id"], kit=KIT_PREFIX + it["id"], name=it["name"], en=it["en"], kind=it["kind"], width=it["w"], height=it["h"], place=it["place"],
                           rows=rows_of[it["id"]], block=it["block"], words=it["words"], sha256=sha, family=it["family"], waiver=it.get("waiver", spec["waiver"]),
                           **({"variantOf": it["variantOf"]} if it.get("variantOf") else {}), **({"on": it["on"]} if it.get("on") else {}),
                           **({"kinds": it["kinds"]} if it.get("kinds") else {}), **({"growth": it["growth"]} if it.get("growth") else {})) for it, sha in zip(items, got)])
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    kinds = {KIT_PREFIX + it["id"]: it["kinds"] for it in items if it.get("kinds")}
    (STORE / "kinds.json").write_text(json.dumps(dict(
        _doc="버들항 기물 킷 id → 마을 종류 id 목록(common = 여러 종류가 같이 쓰는 것). spec.json items[].kinds 에서 bake.py 가 만든다 — 손으로 고치지 않는다. 킷 태그 kind:<id> 와 같은 내용이다.",
        names=spec.get("kindNames", {}), kinds=kinds), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"이야기 기물 꼬리 {BASE}..{count - 1}: 킷 {len(kits)}개 ({KIT_PREFIX}*) — 변형 {sum(1 for it in items if it.get('variantOf'))}개")


if __name__ == "__main__":
    main()
