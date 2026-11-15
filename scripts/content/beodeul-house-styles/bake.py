#!/usr/bin/env python3
"""버들항 집 양식(house styles — 새 건축: 덩어리·지붕 꼴·비례·붙는 것이 다른 집 가족)을 공용 버들항 시트 끝에 덧붙인다.

  python3 scripts/content/beodeul-house-styles/bake.py --dry         # 관문 상태와 칸 계획만
  python3 scripts/content/beodeul-house-styles/bake.py               # 굽는다
  python3 scripts/content/beodeul-house-styles/bake.py --check       # 다시 구워 지금 파일과 같은지만
  python3 scripts/content/beodeul-house-styles/bake.py --dev         # 관문 없이(표의 gate 가 DEV — 시험이 막는다, 커밋하지 않는다)
  python3 scripts/content/beodeul-house-styles/bake.py --renumber    # 내 칸을 시트 끝에서 떼어 새 번호로(출하 전에만 — main 의 시트가 먼저 자랐을 때)

그림 정본: tiledata/beodeul-house-styles/<양식>/houses/<집>.png (+ -shadow · -foundation) — assemble.py 가 부품(parts/)을 조립한 것. 목록·칸 크기·문 칸은 styles.json.
킷(중세 무리 bd-house-mk-* 와 같은 놓는 법): 본체 `bd-house-st-<양식>-<집>` 3층 · 바닥 그림자 `bd-st-shadow-…` 2층 · 기초 `bd-st-foundation-…` 4층, 같은 원점.
벽이 실린 칸은 막히고 지붕·처마 칸은 ★(사람 위에 그려지는 통행 칸), 문 부품은 1×2칸(dy = 높이-2), 문 앞 칸은 문 아래 한 칸.

3/4 관문(hard rule): 본체 그림마다 object-gate 출구 `require_all(context="bundle")`(종류 structure) — 하나라도 막히면 아무것도 쓰지 않는다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(styles.json waiver, harness-data/object-gate/waivers)으로 출구를 지난다. 면제는 그림 화소 해시에 묶여 있어
한 화소라도 바꾸면 굽기가 멈춘다. 면제는 통과가 아니다(스토어 출구는 막힌다).

칸 번호: 덧붙이기 전용. 이미 구운 집은 catalog.json 에 적힌 번호를 지키고, 새 집은 그때의 시트 끝(다음 빈 줄)에 붙는다 — 그래서 이 꼬리는 여러 토막일 수 있고,
다른 꼬리(기물 bd-obj-* 등)가 그 사이에 자라도 번호가 밀리지 않는다. 본체 칸은 집마다 따로 둔다(화소가 같아도 합치지 않는다 — 칸 하나가 한 집의 한 자리만 가리킨다),
그림자·기초 칸은 집끼리 나눠 쓴다. main 을 합치다 시트·정의가 충돌하면 main 것을 받고 이 스크립트를 다시 돌린다(정의에 내 킷이 없으면 처음부터 새 번호로 굽는다).
쓰는 것: public/assets/beodeul-city/beodeul-city-chipset.png · src/assets/beodeulCityTileset.json · src/assets/beodeulCitySheet.json ·
tiledata/beodeul-house-styles/catalog.json(칸 번호·막힘·해시) · src/assets/beodeulHouseStyles.json(양식 표 — 빌더·겉모습 고르기가 읽는다).
"""
import argparse, hashlib, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
STORE = ROOT / "tiledata/beodeul-house-styles"
CATALOG = STORE / "catalog.json"
TABLE = ROOT / "src/assets/beodeulHouseStyles.json"
T, COLS = 16, 128
HOUSE, SHADOW, FOUND = "bd-house-st-", "bd-st-shadow-", "bd-st-foundation-"
PREFIXES = (HOUSE, SHADOW, FOUND)
OPEN = {k: True for k in ("up", "down", "left", "right")}
SHUT = {k: False for k in ("up", "down", "left", "right")}
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."
ROLE_TAG = dict(cottage=["오두막", "작은 집"], family=["살림집", "집"], large=["큰 집", "저택"], shop=["가게집", "가게", "상점"], inn=["여관", "주막"], work=["일터", "작업장"], hall=["예배당", "회관"])


def load():
    spec = json.loads((STORE / "styles.json").read_text(encoding="utf-8"))
    houses = []
    for st in spec["styles"]:
        rep_path = STORE / st["id"] / "report.json"
        rep = json.loads(rep_path.read_text(encoding="utf-8")) if rep_path.exists() else {}
        for h in st["houses"]:
            f = STORE / st["id"] / "houses" / f"{h['name']}.png"
            if not f.exists() or h["name"] not in rep:
                continue   # 아직 그리지 않은 집(양식은 하나씩 굽는다)
            ims = {k: Image.open(STORE / st["id"] / "houses" / f"{h['name']}{suffix}.png").convert("RGBA") for k, suffix in (("body", ""), ("shadow", "-shadow"), ("foundation", "-foundation"))}
            assert ims["body"].size == (h["w"] * T, h["h"] * T), (h["id"], ims["body"].size)
            assert ims["shadow"].size == ims["foundation"].size == ((h["w"] + 1) * T, (h["h"] + 1) * T), h["id"]
            r = rep[h["name"]]
            assert r["door"] == h["door"] and r["size"] == [h["w"], h["h"]], h["id"]
            assert r["roofSideDeviationPx"] <= 1, f"{h['id']}: 지붕 옆선 수직 편차 {r['roofSideDeviationPx']}px"
            houses.append(dict(st=st, h=h, ims=ims, blocked={tuple(b) for b in r["blocked"]}, rep=r))
    return spec, houses


def cells_of(im):
    a = np.array(im)
    return [[(a[y * T:(y + 1) * T, x * T:(x + 1) * T] if (a[y * T:(y + 1) * T, x * T:(x + 1) * T, 3] > 0).any() else None) for x in range(im.width // T)] for y in range(im.height // T)]


def sha(c):
    return hashlib.sha256(c.tobytes()).hexdigest()[:20]


def kit_body(st, h, rows):
    w, hh = h["w"], h["h"]
    tags = ["버들항", "house", "home", "집 양식", f"style:{st['id']}", f"role:{h['role']}", *ROLE_TAG[h["role"]], h["roleEn"], st["name"], st["en"], *[x for x in h["words"] if x not in (h["roleKo"], st["name"], h["roleEn"], st["en"])], "문 1개"]
    ai = dict(role="building", repeatability="fixed", layerHome="upper", tags=list(dict.fromkeys(tags)),
              description=f"{st['name']} 양식의 {h['ko']}({h['en']}) — {h['shape']}. 집당 한 입구(문 칸 ({h['door'][0]},{h['door'][1]})), 벽 칸은 막히고 지붕·처마 칸은 걸어 지날 수 있다(사람 위에 그려진다). {GATE_NOTE}",
              placementRules=f"전체 {w}×{hh}와 문 앞 접근칸(문 아래 한 칸)을 예약한다. 한 마을은 한 양식의 집으로 짓고 같은 키트를 연속으로 놓지 않는다. "
                             f"{SHADOW}{h['id'][len(HOUSE):]}를 2층, 본체를 3층, {FOUND}{h['id'][len(HOUSE):]}를 4층에 같은 원점으로 함께 놓는다.")
    return dict(id=h["id"], kind="section", name=f"버들항 집 · {st['name']} · {h['ko']} {w}×{hh}", width=w, height=hh, tileSize=T, learnedFrom="pack-preset",
                rows=[dict(tiles=[-1] * w, upperTiles=r) for r in rows],
                parts=[dict(id="door", kind="entrance", dx=h["door"][0], dy=h["door"][1] - 1, w=1, h=2, note="문 칸(두 칸 높이) — 문 칸은 막힘, 그 아래 칸이 문 앞 길")], ai=ai)


def kit_companion(st, h, kind, rows):
    kid = h["id"][len(HOUSE):]
    return dict(id=(SHADOW if kind == "shadow" else FOUND) + kid, kind="section", name=f"버들항 집 · {st['name']} · {h['ko']} · {'바닥 그림자' if kind == 'shadow' else '기초'}", width=h["w"] + 1, height=h["h"] + 1, tileSize=T,
                learnedFrom="pack-preset", rows=[dict(tiles=[-1] * (h["w"] + 1), upperTiles=r) for r in rows],
                ai=dict(role="prop", repeatability="fixed", layerHome="perCell", tags=["버들항", "집 양식", kind], description=f"{h['id']}와 같은 원점에 {'2' if kind == 'shadow' else '4'}층으로 놓는다. 모든 칸 통행 가능.",
                        placementRules="건물과 같은 원점. 벽 칸을 막지 않는다."))


def main():
    ap = argparse.ArgumentParser()
    for flag in ("--dry", "--check", "--dev", "--renumber"):
        ap.add_argument(flag, action="store_true")
    a = ap.parse_args()
    spec, houses = load()
    waiver = spec.get("waiver", "")
    if a.dev:
        got = [hashlib.sha256(h["ims"]["body"].tobytes()).hexdigest() for h in houses]
        gate = "DEV"
    else:
        from object_gate import require_all
        got = require_all([(h["ims"]["body"], "structure", f"beodeul_house_styles/{h['st']['id']}/{h['h']['name']}") for h in houses], context="bundle")
        gate = f"3/4 gate not passed — owner waiver {waiver}"
    print(f"관문(bundle 출구): {len(got)}/{len(houses)} — {'DEV(관문 없음)' if a.dev else GATE_NOTE + ' 묶음 ' + waiver}")

    ts = json.loads(TS_PATH.read_text())
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    assert ts["count"] == json.loads(SHEET_JSON.read_text())["count"] == (sheet.height // T) * COLS and ts["count"] % COLS == 0
    mine = [k for k in ts["structureKits"] if k["id"].startswith(PREFIXES)]
    old = json.loads(CATALOG.read_text(encoding="utf-8")) if CATALOG.exists() and mine else None
    if old:   # 정의에 실린 내 킷의 칸 번호와 카탈로그가 같아야 한다(다르면 손으로 합친 것이다)
        by_id = {k["id"]: [r["upperTiles"] for r in k["rows"]] for k in mine}
        for it in old["houses"]:
            assert by_id.get(it["id"]) == it["rows"], f"{it['id']}: 정의의 칸 번호가 카탈로그와 다르다 — 시트·정의를 main 것으로 되돌리고 다시 굽는다"
    if a.renumber and old:
        first = min(old["cellNumbers"])
        base = first // COLS * COLS
        assert set(range(first, max(old["cellNumbers"]) + 1)) <= set(old["cellNumbers"]) and ts["count"] - max(old["cellNumbers"]) <= COLS, "내 칸 뒤에 다른 꼬리가 붙었다 — 번호를 다시 매길 수 없다(출하된 번호다)"
        for k in ("passability", "priority", "terrain", "tileMeta"):
            ts[k] = ts[k][:base]
        ts["count"] = base
        sheet = sheet.crop((0, 0, COLS * T, base // COLS * T))
        old = None
    ts["structureKits"] = [k for k in ts["structureKits"] if not k["id"].startswith(PREFIXES)]

    # 칸 배정: 이미 구운 집은 그 번호(칸 꼴이 같아야 한다), 새 집·새 나눠 쓰는 칸은 시트 끝부터.
    number = {}                       # ("body", 집 id, x, y) | ("shared", 화소 해시) → 칸 번호
    if old:
        for it in old["houses"]:
            for y, row in enumerate(it["rows"]):
                for x, n in enumerate(row):
                    if n >= 0: number[("body", it["id"], x, y)] = n
        for s, n in old["shared"].items(): number[("shared", s)] = n
    start = ts["count"]
    nxt = [start]
    cell_px, cell_meta = {}, {}

    def take(key, pixels, meta):
        n = number.get(key)
        if n is None:
            n = number[key] = nxt[0]; nxt[0] += 1
        cell_px[n] = pixels; cell_meta[n] = meta
        return n

    out_houses, kits = [], []
    for h, digest in zip(houses, got):
        st, hh = h["st"], h["h"]
        if old:
            prev = next((it for it in old["houses"] if it["id"] == hh["id"]), None)
        else:
            prev = None
        grid = cells_of(h["ims"]["body"])
        if prev is not None:
            shape_now = [[c is not None for c in row] for row in grid]
            if shape_now != [[n >= 0 for n in row] for row in prev["rows"]]:
                sys.exit(f"{hh['id']}: 그림의 칸 꼴이 구운 것과 다르다 — 출하 전이면 --renumber, 출하 뒤면 새 id 로 더한다")
        rows = []
        for y, row in enumerate(grid):
            out = []
            for x, c in enumerate(row):
                if c is None: out.append(-1); continue
                block = (x, y) in h["blocked"]
                # 이름표: 문 칸은 «문» 이라고 적는다(문 낱말 판독이 여닫이문으로 읽는다). 다른 칸에는 집 이름을 적지 않는다 — «계단 집»·«아치 창 집» 같은 이름이 통로 낱말로 읽힌다.
                door = x == hh["door"][0] and y in (hh["door"][1] - 1, hh["door"][1])
                out.append(take(("body", hh["id"], x, y), c, dict(pass_=SHUT if block else OPEN, label=f"버들항 집 · {st['name']} 양식" + (" · 나무 문" if door else f" ({x},{y})"),
                                                                   description=f"{st['name']} 양식 집의 {'문(막힘 — 그 아래 칸이 문 앞 길)' if door else '벽(막힘)' if block else '지붕·처마(사람 위에 그려지는 통행 칸)'}. {GATE_NOTE}",
                                                                   tags=["버들항", "building", "집 양식", f"style:{st['id']}", *(["door"] if door else [])], passage="solid" if block else "star")))
            rows.append(out)
        comp = {}
        for kind in ("shadow", "foundation"):
            crow = []
            for row in cells_of(h["ims"][kind]):
                out = []
                for c in row:
                    if c is None: out.append(-1); continue
                    out.append(take(("shared", sha(c)), c, dict(pass_=OPEN, label=f"버들항 집 · {'바닥 그림자' if kind == 'shadow' else '기초'}", description="집 양식 건물과 같은 원점에 놓는 덧그림. 통행 가능.",
                                                                 tags=["버들항", "집 양식", kind], passage="star")))
                crow.append(out)
            comp[kind] = crow
        kits.append(kit_body(st, hh, rows))
        kits += [kit_companion(st, hh, "shadow", comp["shadow"]), kit_companion(st, hh, "foundation", comp["foundation"])]
        out_houses.append(dict(id=hh["id"], style=st["id"], name=hh["name"], ko=hh["ko"], en=hh["en"], role=hh["role"], width=hh["w"], height=hh["h"], door=hh["door"], rows=rows,
                               shadowRows=comp["shadow"], foundationRows=comp["foundation"], blocked=sorted([list(b) for b in h["blocked"]]), groundLines=h["rep"]["groundLines"],
                               roof=h["rep"]["roof"], roofVolumes=h["rep"]["roofVolumes"], roofSideDeviationPx=h["rep"]["roofSideDeviationPx"], flatPercent=h["rep"]["flatPercent"], colours=h["rep"]["colours"],
                               sha256=digest, waiver=waiver))
    if old:
        gone = [it["id"] for it in old["houses"] if it["id"] not in {h["h"]["id"] for h in houses}]
        if gone: sys.exit(f"구운 집이 빠졌다: {gone} — 덧붙이기 전용이다(빼지 않는다)")
    count = -(-nxt[0] // COLS) * COLS
    new_cells = nxt[0] - start
    print(f"집 {len(houses)}채 · 칸 {len(cell_px)}개(새 칸 {new_cells}) → 시트 {ts['count']} → {count} ({(count - ts['count']) // COLS}줄 덧붙임)")
    if a.dry:
        return

    canvas = Image.new("RGBA", (COLS * T, count // COLS * T), (0, 0, 0, 0))
    canvas.alpha_composite(sheet, (0, 0))
    for k in ("passability", "priority", "terrain", "tileMeta"):
        assert len(ts[k]) == ts["count"], k
    for n in range(ts["count"], count):
        ts["passability"].append(dict(OPEN)); ts["priority"].append("lower"); ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label="", description="", source="bundled-default"))
    for n, px in cell_px.items():
        x, y = (n % COLS) * T, (n // COLS) * T
        canvas.paste(Image.fromarray(px, "RGBA"), (x, y))
        m = cell_meta[n]
        ts["passability"][n] = dict(m["pass_"]); ts["priority"][n] = "upper"; ts["terrain"][n] = 0
        ts["tileMeta"][n] = dict(label=m["label"], description=m["description"], tags=m["tags"], defaultLayer="upper", passage=m["passage"], source="bundled-default")
    ts["structureKits"] += kits
    ts["count"] = count
    styles = {}
    for st in spec["styles"]:
        hs_ = [h for h in out_houses if h["style"] == st["id"]]
        if not hs_: continue
        styles[st["id"]] = dict(label=st["name"], en=st["en"], houses=[dict(id=h["id"], role=h["role"], w=h["width"], h=h["height"]) for h in hs_])
    table = dict(_doc="버들항 집 양식 표 — scripts/content/beodeul-house-styles/bake.py 가 굽는다(손으로 고치지 않는다). 양식마다 집 킷과 역할: 빌더는 오두막·살림집·큰 집을 본 무리로, 가게집을 강조로, 여관·회관·일터를 앵커로 쓴다. 양식 순서가 게임 열쇠의 고르기 순번이므로 새 양식은 끝에 더한다.",
                 version=1, tilesetId="beodeul_city", gate=gate, kitPrefix=HOUSE, shadowPrefix=SHADOW, foundationPrefix=FOUND, styles=styles)
    catalog = dict(tilesetId="beodeul_city", texture="tex_beodeul_city", tileSize=T, tilesPerRow=COLS, kitPrefix=HOUSE, shadowPrefix=SHADOW, foundationPrefix=FOUND,
                   source="scripts/content/beodeul-house-styles/bake.py (parts by Claude Fable 5.2 medium one-shot + code-made material tiles after original Beodeul patterns, assembled by code)",
                   gate=gate, cellNumbers=sorted(cell_px), shared={k[1]: n for k, n in number.items() if k[0] == "shared" and n in cell_px}, houses=out_houses)
    outputs = [(TS_PATH, json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n"), (SHEET_JSON, json.dumps(dict(count=count, tilesPerRow=COLS)) + "\n"),
               (CATALOG, json.dumps(catalog, ensure_ascii=False, indent=1) + "\n"), (TABLE, json.dumps(table, ensure_ascii=False, indent=1) + "\n")]
    if a.check:
        bad = [str(p.relative_to(ROOT)) for p, text in outputs if not p.exists() or p.read_text(encoding="utf-8") != text]
        if not np.array_equal(np.array(Image.open(SHEET_PATH).convert("RGBA")), np.array(canvas)): bad.append(str(SHEET_PATH.relative_to(ROOT)))
        print("다시 구운 것과 같다" if not bad else f"다르다: {bad}")
        sys.exit(1 if bad else 0)
    canvas.save(SHEET_PATH, optimize=True)
    for p, text in outputs: p.write_text(text, encoding="utf-8")
    print(f"집 양식 꼬리: 킷 {len(kits)}개({HOUSE}* {len(out_houses)} + 그림자·기초) · 양식 {', '.join(styles)} · 칸 {min(cell_px)}..{max(cell_px)}")


if __name__ == "__main__":
    main()
