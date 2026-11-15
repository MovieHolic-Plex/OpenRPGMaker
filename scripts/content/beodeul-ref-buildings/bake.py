#!/usr/bin/env python3
"""버들항 참고 건물 유형(bd-bld-ref-*)을 공용 버들항 시트의 제 토막(46,464~)에 굽는다.

  python3 scripts/content/beodeul-ref-buildings/bake.py --dry     # 관문 상태와 칸 계획만
  python3 scripts/content/beodeul-ref-buildings/bake.py           # 굽는다
  python3 scripts/content/beodeul-ref-buildings/bake.py --check   # 다시 구워 지금 파일과 같은지만
  python3 scripts/content/beodeul-ref-buildings/bake.py --dev     # 관문 없이(표의 gate 가 DEV — 커밋하지 않는다)

그림 정본: tiledata/beodeul-ref-buildings/buildings/<이름>.png — assemble.py 가 부품(parts/)을 조립한 것. 목록·칸 크기·문 칸은 types.json(types_src.py).
킷: 본체 한 장 `bd-bld-ref-<이름>`(윗층). 벽이 실린 칸은 막히고 지붕·처마 칸은 ★(사람 위에 그려지는 통행 칸), 문 부품(entrance)은 문 폭×2칸(dy = 높이-2), 문 앞 칸은 문 아래 한 칸.
지나가는 칸(passage — 성문·문루 밑 길·아치 밑)은 아래층(tiles)에 바닥 그림으로 깔려 사람이 그 위를 걷는다(bd-wall-gatehouse 와 같은 법), 그 부품은 맨 아랫줄 통로 칸.

3/4 관문(hard rule): 건물 그림마다 object-gate 출구 `require_all(context="bundle")`(종류 structure) — 하나라도 막히면 아무것도 쓰지 않는다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(types.json waiver, harness-data/object-gate/waivers)으로 출구를 지난다. 면제는 그림 화소 해시에 묶여 있어
한 화소라도 바꾸면 굽기가 멈춘다. 면제는 통과가 아니다(스토어 출구는 막힌다).

칸 번호: 이 토막의 첫 칸은 46,464 로 못박혀 있다(이야기 기물 꼬리 34,944~38,271 · 집 양식 꼬리 38,272~46,463 뒤). 유형 목록 순서대로 건물의 빈 칸 아닌 칸을 줄 차례로 센다 —
새 유형은 목록 끝에만 더한다. 내 칸 [46,464, 끝) 만 제자리에서 다시 쓰고 앞 꼬리·뒤 꼬리의 칸과 킷은 건드리지 않는다. 시트가 46,464 보다 짧으면(앞 꼬리가 아직 덜 자랐으면) 빈 줄로 채운다 —
앞 꼬리의 굽기는 제 칸만 제자리에서 쓰므로 그 빈 줄을 나중에 채운다. main 을 합치다 시트·정의가 충돌하면 main 것을 받고 이 스크립트를 다시 돌린다.
쓰는 것: public/assets/beodeul-city/beodeul-city-chipset.png · src/assets/beodeulCityTileset.json · src/assets/beodeulCitySheet.json ·
tiledata/beodeul-ref-buildings/catalog.json(칸 번호·막힘·해시) · src/assets/beodeulRefBuildings.json(유형 표 — 빌더가 읽을 자료: 갈래·터·급·맞는 집 양식·마을 종류·문 칸·곁에 놓을 기물).
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
STORE = ROOT / "tiledata/beodeul-ref-buildings"
CATALOG = STORE / "catalog.json"
TABLE = ROOT / "src/assets/beodeulRefBuildings.json"
T, COLS, BASE = 16, 128, 46464
BIG = 60800      # 둘째 토막 60,800~61,823(1,024칸, 감독 배정 2026-11-16): 첫 토막(46,464~48,511)은 44채로 찼다. 그 뒤는 실내(48,512~52,607) · 던전(52,608~56,703) · 길목(56,704~60,799)의 토막이다 — 초대형 건물(types 의 block="big")은 그 뒤에 굽는다
BIG_END = 61824
PREFIX = "bd-bld-ref-"
LABEL = "버들항 참고 건물"
OPEN = {k: True for k in ("up", "down", "left", "right")}
SHUT = {k: False for k in ("up", "down", "left", "right")}
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."
CAT = dict(farm=("농장 건물", "farm building"), work=("일터", "workshop"), town=("읍 건물", "town building"), harbour=("항구 건물", "harbour building"), castle=("성읍 건물", "castle town building"))
SETTING = dict(rural=["village", "field", "farm", "마을", "농장"], town=["village", "town", "마을", "읍"], harbour=["village", "town", "harbor", "마을", "항구"], castle=["town", "city", "castle", "마을", "성읍"])


def load():
    spec = json.loads((STORE / "types.json").read_text(encoding="utf-8"))
    rep = json.loads((STORE / "report.json").read_text(encoding="utf-8"))
    out = []
    for t in spec["types"]:
        f = STORE / "buildings" / f"{t['name']}.png"
        if not f.exists() or t["name"] not in rep:
            sys.exit(f"{t['id']}: 그림이 없다 — 목록의 모든 유형을 조립한 뒤 굽는다(칸 번호가 목록 순서로 정해진다)")
        im = Image.open(f).convert("RGBA")
        assert im.size == (t["w"] * T, t["h"] * T), (t["id"], im.size)
        r = rep[t["name"]]
        assert r["door"] == t["door"] and r["size"] == [t["w"], t["h"]] and r["roofSideDeviationPx"] <= 1, t["id"]
        out.append(dict(t=t, im=im, blocked={tuple(b) for b in r["blocked"]}, rep=r))
    return spec, out


def kit_of(t, rows, lower):
    w, h = t["w"], t["h"]; ko, en = CAT[t["cat"]]
    tags = ["버들항", "참고 건물", "building", ko, en, f"cat:{t['cat']}", f"setting:{t['setting']}", f"tier:{t['tier']}", f"style:{t['style']}", *[f"kind:{k}" for k in t["kinds"]], t["ko"], t["en"], *t["words"],
            *([f"interior:{t['interior'].get('program') or '+'.join(t['interior']['rooms'])}"] if t.get("interior") else [])]
    door = t["door"]; passage = t.get("passage") or []
    how = (f"문 칸 ({door[0]},{door[1]}){'부터 ' + str(t.get('doorw', 1)) + '칸 폭' if t.get('doorw', 1) > 1 else ''} — 문 칸은 막히고 그 아래 칸이 문 앞 길" if door and not passage
           else f"사람이 지나가는 칸 {', '.join(f'({x},{y})' for x, y in passage)} — 그 칸의 바닥 그림은 아래층에 깔린다, 그 위·아래 칸에 길을 잇는다" if passage else "문 없음 — 들어가지 않는 구조물")
    ai = dict(role="building" if door and not passage else "prop", repeatability="fixed", layerHome="upper", tags=list(dict.fromkeys(tags)), themes=SETTING[t["setting"]],
              description=f"{t['ko']}({t['en']}) — {t['shape']}. {how}. 벽 칸은 막히고 지붕·처마 칸은 걸어 지날 수 있다(사람 위에 그려진다)."
                          + (f" 그림에 들어 있는 것: {' · '.join(t['included'])}." if t.get("included") else "") + (f" 실내(손 도트 실내 칩셋 atlas_biome_interior, build_hand_interior_room): layout {json.dumps(t['interior'], ensure_ascii=False)}." if t.get("interior") else "") + f" {GATE_NOTE}",
              placementRules=f"땅(풀·흙·포석) 위에 전체 {w}×{h}칸을 찍고 " + ("문 앞 접근칸(문 아래 한 칸)에 길을 잇는다. " if door and not passage else "지나가는 칸의 위·아래에 길을 잇는다. " if passage else "앞줄 앞을 한 칸 비운다. ")
                             + f"같은 킷을 한 마을에 두 번 놓지 않는다(노점·탑은 예외). 맞는 집 양식: {t['style']}." + (f" 곁에 따로 놓으면 어울리는 기물: {', '.join(t['props'][:5])}." if t.get("props") else ""))
    kit = dict(id=t["id"], kind="section", name=f"버들항 {ko} · {t['ko']} {w}×{h}", width=w, height=h, tileSize=T, learnedFrom="pack-preset",
               rows=[dict(tiles=lo, upperTiles=up) for lo, up in zip(lower, rows)], ai=ai)
    if door and not passage:
        kit["parts"] = [dict(id="door", kind="entrance", dx=door[0], dy=door[1] - 1, w=t.get("doorw", 1), h=2, note="문 칸(두 칸 높이) — 문 칸은 막힘, 그 아래 칸이 문 앞 길")]
    elif passage:
        low = [c for c in passage if c[1] == h - 1]
        kit["parts"] = [dict(id="gate", kind="entrance", dx=min(c[0] for c in low), dy=h - 1, w=len(low), h=1, note="통로 칸(걸음). 아래 칸에 바깥 길을 잇는다")]
    return kit


def main():
    ap = argparse.ArgumentParser()
    for flag in ("--dry", "--check", "--dev"):
        ap.add_argument(flag, action="store_true")
    a = ap.parse_args()
    spec, items = load()
    waiver = spec.get("waiver", "")
    if a.dev:
        got = [hashlib.sha256(it["im"].tobytes()).hexdigest() for it in items]; gate = "DEV"
    else:
        from object_gate import require_all
        got = require_all([(it["im"], "structure", f"beodeul_ref_buildings/{it['t']['name']}") for it in items], context="bundle")
        gate = f"3/4 gate not passed — owner waiver {waiver}"
    print(f"관문(bundle 출구): {len(got)}/{len(items)} — {'DEV(관문 없음)' if a.dev else GATE_NOTE + ' 묶음 ' + waiver}")

    ts = json.loads(TS_PATH.read_text())
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    assert ts["count"] == json.loads(SHEET_JSON.read_text())["count"] == (sheet.height // T) * COLS and ts["count"] % COLS == 0
    n = BASE; cells = []; kits = []; cat = []; first_end = None
    for it, digest in zip(items, got):
        t = it["t"]
        if t.get("block") == "big" and n < BIG: first_end = -(-n // COLS) * COLS; n = BIG
        else: assert n < BASE + 2048 or n >= BIG, "첫 토막이 넘친다 — 새 유형은 block=big 로"
        arr = np.array(it["im"]); passage = {tuple(c) for c in (t.get("passage") or [])}; rows, lower = [], []
        for y in range(t["h"]):
            up, lo = [], []
            for x in range(t["w"]):
                c = arr[y * T:(y + 1) * T, x * T:(x + 1) * T]
                if not (c[:, :, 3] > 0).any(): up.append(-1); lo.append(-1); continue
                block = (x, y) in it["blocked"]; walk = (x, y) in passage
                door = bool(t["door"]) and not passage and t["door"][0] <= x < t["door"][0] + t.get("doorw", 1) and y in (t["door"][1] - 1, t["door"][1])
                meta = dict(pass_=SHUT if block else OPEN, lower=walk, label=f"{LABEL} · {t['ko']}" + (" · 문" if door else " · 통로 바닥" if walk else f" ({x},{y})"),
                            description=f"{t['ko']}의 {'문(막힘 — 그 아래 칸이 문 앞 길)' if door else '통로 바닥(아래층에 깔린다 — 사람이 그 위를 걷는다)' if walk else '벽(막힘)' if block else '지붕·처마(사람 위에 그려지는 통행 칸)'}. {GATE_NOTE}",
                            tags=["버들항", "building", "참고 건물", f"cat:{t['cat']}", *(["door"] if door else [])], passage="solid" if block else "passable" if walk else "star")
                cells.append((n, c, meta)); (lo if walk else up).append(n); (up if walk else lo).append(-1); n += 1
            rows.append(up); lower.append(lo)
        kits.append(kit_of(t, rows, lower))
        cat.append(dict(id=t["id"], name=t["name"], ko=t["ko"], width=t["w"], height=t["h"], door=t["door"], doorw=t.get("doorw", 1), passage=t.get("passage") or [], rows=rows, lowerRows=lower,
                        blocked=sorted([list(b) for b in it["blocked"]]), roof=it["rep"]["roof"], roofVolumes=it["rep"]["roofVolumes"], roofSideDeviationPx=it["rep"]["roofSideDeviationPx"],
                        flatPercent=it["rep"]["flatPercent"], colours=it["rep"]["colours"], sha256=digest, waiver=waiver))
    big_end = -(-n // COLS) * COLS if first_end is not None else None
    assert big_end is None or big_end <= BIG_END, f"둘째 토막이 넘친다: {n} > {BIG_END}"
    end = first_end if first_end is not None else -(-n // COLS) * COLS; total = max(big_end or end, ts["count"])
    spans = [(BASE, end)] + ([(BIG, big_end)] if big_end else [])
    print(f"건물 {len(items)}채 · 칸 {n - BASE}개 → 내 토막 {BASE}..{end - 1} ({(end - BASE) // COLS}줄) · 시트 {ts['count']} → {total} ({total // COLS * T}px)")
    foreign = [i for s0, s1 in spans for i in range(s0, min(s1, ts["count"])) if (ts["tileMeta"][i].get("label") or "") and not ts["tileMeta"][i]["label"].startswith(LABEL)]
    if foreign: sys.exit(f"내 토막 끝 {end} 이 뒤 꼬리의 칸 {foreign[0]}(「{ts['tileMeta'][foreign[0]]['label']}」)을 넘는다 — 뒤 꼬리는 출하된 번호라 밀 수 없다. 그 뒤에 새 토막을 연다")
    if a.dry: return
    canvas = Image.new("RGBA", (COLS * T, total // COLS * T), (0, 0, 0, 0))
    canvas.paste(sheet, (0, 0))
    for s0, s1 in spans: canvas.paste(Image.new("RGBA", (COLS * T, (s1 - s0) // COLS * T), (0, 0, 0, 0)), (0, s0 // COLS * T))      # 내 토막을 비우고 다시 쓴다
    for k in ("passability", "priority", "terrain", "tileMeta"):
        assert len(ts[k]) == ts["count"], k
    blank = lambda: (dict(OPEN), "lower", 0, dict(label="", description="", source="bundled-default"))
    for i in range(ts["count"], total):
        p, pr, te, m = blank(); ts["passability"].append(p); ts["priority"].append(pr); ts["terrain"].append(te); ts["tileMeta"].append(m)
    for i in [i for s0, s1 in spans for i in range(s0, s1)]:
        p, pr, te, m = blank(); ts["passability"][i] = p; ts["priority"][i] = pr; ts["terrain"][i] = te; ts["tileMeta"][i] = m
    for i, px, m in cells:
        canvas.paste(Image.fromarray(px, "RGBA"), ((i % COLS) * T, (i // COLS) * T))
        ts["passability"][i] = dict(m["pass_"]); ts["priority"][i] = "lower" if m["lower"] else "upper"
        ts["tileMeta"][i] = dict(label=m["label"], description=m["description"], tags=m["tags"], defaultLayer="lower" if m["lower"] else "upper", passage=m["passage"], source="bundled-default")
    ts["animationStrips"] = [s for s in ts.get("animationStrips", []) if not any(s0 <= s["baseTile"] < s1 for s0, s1 in spans)]
    at = next((i for i, k in enumerate(ts["structureKits"]) if k["id"].startswith(PREFIX)), len(ts["structureKits"]))      # 내 킷은 목록의 제자리에서 바뀐다(처음이면 끝에)
    ts["structureKits"] = [k for k in ts["structureKits"][:at] if not k["id"].startswith(PREFIX)] + kits + [k for k in ts["structureKits"][at:] if not k["id"].startswith(PREFIX)]
    ts["count"] = total
    table = dict(_doc="버들항 참고 건물 유형 표 — scripts/content/beodeul-ref-buildings/bake.py 가 굽는다(손으로 고치지 않는다). 오너의 참고 그림 여섯 장에 서 있는 건물 유형(농장 · 일터 · 읍 · 항구 · 성읍)을 새로 그린 킷. "
                      "cat 갈래 · setting 터 · tier 급 · style 맞는 집 양식(any = 어느 양식에나) · kinds 그 건물이 일터·볼거리로 서는 마을 종류 id(tiledata/beodeul-objects/kinds.json 의 이름) · door 문 칸(doorw 칸 폭) · passage 지나가는 칸 · "
                      "included 그림에 들어 있는 발치 것 · props 곁에 따로 놓으면 어울리는 이미 있는 기물 킷 id. 새 유형은 끝에 더한다.",
                 version=1, tilesetId="beodeul_city", gate=gate, kitPrefix=PREFIX, base=BASE,
                 buildings=[dict(id=t["id"], ko=t["ko"], en=t["en"], cat=t["cat"], setting=t["setting"], tier=t["tier"], style=t["style"], kinds=t["kinds"], w=t["w"], h=t["h"], door=t["door"], doorw=t.get("doorw", 1),
                                 passage=t.get("passage") or [], interior=t.get("interior"), included=t.get("included") or [], props=t.get("props") or []) for t in (it["t"] for it in items)])
    catalog = dict(tilesetId="beodeul_city", texture="tex_beodeul_city", tileSize=T, tilesPerRow=COLS, kitPrefix=PREFIX, base=BASE, end=end, **(dict(bigBase=BIG, bigEnd=big_end) if big_end else {}),
                   source="scripts/content/beodeul-ref-buildings/bake.py (parts by Claude Fable 5.2 medium one-shot + code-made material tiles after original Beodeul patterns, assembled by code — see parts.json)",
                   gate=gate, buildings=cat)
    outputs = [(TS_PATH, json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n"), (SHEET_JSON, json.dumps(dict(count=total, tilesPerRow=COLS)) + "\n"),
               (CATALOG, json.dumps(catalog, ensure_ascii=False, indent=1) + "\n"), (TABLE, json.dumps(table, ensure_ascii=False, indent=1) + "\n")]
    if a.check:
        bad = [str(p.relative_to(ROOT)) for p, text in outputs if not p.exists() or p.read_text(encoding="utf-8") != text]
        if not np.array_equal(np.array(Image.open(SHEET_PATH).convert("RGBA")), np.array(canvas)): bad.append(str(SHEET_PATH.relative_to(ROOT)))
        print("다시 구운 것과 같다" if not bad else f"다르다: {bad}"); sys.exit(1 if bad else 0)
    canvas.save(SHEET_PATH, optimize=True)
    for p, text in outputs: p.write_text(text, encoding="utf-8")
    print(f"참고 건물 토막: 킷 {len(kits)}개 · 칸 {BASE}..{n - 1}")


if __name__ == "__main__":
    main()
