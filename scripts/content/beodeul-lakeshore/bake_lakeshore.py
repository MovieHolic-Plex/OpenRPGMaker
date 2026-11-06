#!/usr/bin/env python3
"""버들항 자연 호숫가 오토타일(물↔풀, 물↔모래 47장씩, 물 몸통과 같은 8프레임)을 시트 꼬리 34,048~ 에 덧붙이고,
긴 비탈 조각 14장을 rampArt.json["grass-steps"].pieces 에 굽는다. 오너 승인 2026-11-07 「그래 이게 낫다」(long-ramp.html).

  python3 scripts/content/beodeul-lakeshore/bake_lakeshore.py --dry          # 관문 상태만
  python3 scripts/content/beodeul-lakeshore/bake_lakeshore.py                # 관문 통과 시 굽기
  python3 scripts/content/beodeul-lakeshore/bake_lakeshore.py --from-store   # 관문 없이 저장된 그림대로 꼬리만 다시 붙이기(bake_cave.py 가 부른다)

그림 정본: tiledata/beodeul-lakeshore/tiles.json(호숫가 프레임, scripts/experiments/lake-shore/pieces.py 가 만든다) ·
          tiledata/beodeul-lakeshore/long-ramp.json(긴 비탈 모듈, scripts/experiments/long-ramp/pieces.py).
3/4 관문(hard rule): 굽는 그림(호숫가 94 대표 프레임 + 긴 비탈 14)마다 object_gate.refusal(kind="terrain", context="bundle").
하나라도 막히면 아무것도 쓰지 않는다. 시트 순서: … → 동굴 기물(bake_cave.py, 33,920~34,047) → 호숫가(이것).
"""
import argparse, json, pathlib, sys
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
ART = ROOT / "src/project/relief/rampArt.json"
STORE = ROOT / "tiledata/beodeul-lakeshore"
T, COLS, FRAMES = 16, 128, 8
BASE = 34048
LANDS = {"grass": ("풀", "beodeul_lakeshore_grass"), "sand": ("모래", "beodeul_lakeshore_sand")}
DIRS = [("N", 1), ("E", 2), ("S", 4), ("W", 8), ("NE", 16), ("SE", 32), ("SW", 64), ("NW", 128)]
KO = {"N": "북", "E": "동", "S": "남", "W": "서", "NE": "북동", "SE": "남동", "SW": "남서", "NW": "북서"}


def normalize(m):
    for c, a, b in ((16, 1, 2), (32, 4, 2), (64, 4, 8), (128, 1, 8)):
        if not (m & a and m & b): m &= ~c
    return m


def rgba_img(w, h, data):
    return Image.frombytes("RGBA", (w, h), bytes(data))


def load():
    tiles = json.loads((STORE / "tiles.json").read_text())
    ramp = json.loads((STORE / "long-ramp.json").read_text())
    masks = sorted(int(m) for m in tiles["grass"])
    assert len(masks) == 47
    return tiles, ramp, masks


def gate_items(tiles, ramp):
    for land in LANDS:
        for m, data in tiles[land].items():
            yield rgba_img(T, T, data), f"beodeul-lakeshore/{land}/{m}"
    for k, d in ramp.items():
        yield rgba_img(d["w"], d["h"], d["rgba"]), f"beodeul-long-ramp/{k}"


def write(tiles, ramp, masks):
    sheet_count = json.loads(SHEET_JSON.read_text())["count"]
    if sheet_count < BASE:
        sys.exit(f"시트가 {BASE} 칸보다 짧다({sheet_count}) — 동굴 기물 꼬리(bake_cave.py)부터 굽는다")
    cells = [(land, m, f) for land in LANDS for m in masks for f in range(FRAMES)]
    rows = -(-len(cells) // COLS)
    count = BASE + rows * COLS
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    out = Image.new("RGBA", (COLS * T, (BASE // COLS + rows) * T), (0, 0, 0, 0))
    out.alpha_composite(sheet.crop((0, 0, COLS * T, (BASE // COLS) * T)), (0, 0))
    for i, (land, m, f) in enumerate(cells):
        out.alpha_composite(rgba_img(T, T, tiles[land + "@frames"][str(m)][f]), ((i % COLS) * T, (BASE // COLS + i // COLS) * T))
    out.save(SHEET_PATH, optimize=True)

    ts = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"): ts[k] = ts[k][:BASE]
    ts["animationStrips"] = [s for s in ts["animationStrips"] if s["baseTile"] < BASE]
    block = {d: False for d in ("up", "down", "left", "right")}
    first = {}
    for i, (land, m, f) in enumerate(cells):
        tid = BASE + i
        if f == 0: first[(land, m)] = tid
        dirs = "·".join(KO[n] for n, b in DIRS if m & b) or "외딴 한 칸"
        ko = LANDS[land][0]
        ts["passability"].append(dict(block)); ts["priority"].append("lower"); ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label=f"버들항 · 호숫가({ko}) 오토타일 · {dirs}" + (f" · 장면 {f + 1}" if f else ""),
                                   description=f"자연 호숫가 물 칸(마스크 {m}): 물이 {ko}밭으로 둥글게 스며드는 물가. 막힘. 물 몸통과 같이 8프레임 움직임. 그룹 `{LANDS[land][1]}`.",
                                   tags=["버들항", "water", "호숫가", "lakeshore", ko], defaultLayer="lower", passage="solid", source="bundled-default"))
    open_ = {d: True for d in ("up", "down", "left", "right")}
    for _ in range(len(cells), rows * COLS):
        ts["passability"].append(dict(open_)); ts["priority"].append("lower"); ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label="", description="", source="bundled-default"))
    for tid in first.values(): ts["animationStrips"].append(dict(baseTile=tid, frames=FRAMES, fps=8))
    water = next(g for g in ts["autotileGroups"] if g["id"] == "beodeul_canal_lake_47")
    groups = []
    for land, (ko, gid) in LANDS.items():
        members = [first[(land, m)] for m in masks]
        groups.append(dict(id=gid, name=f"버들항 호숫가({ko})", neighborhood=8, memberTileIds=members,
                           variantMap={str(m): first[(land, normalize(m))] for m in range(256)},
                           connectTileIds=sorted(set(members) | set(water["memberTileIds"]) | set(water.get("connectTileIds") or [])),
                           edgeConnects=True, outsideConnects=True))
    ts["autotileGroups"] = [g for g in ts["autotileGroups"] if g["id"] not in {v[1] for v in LANDS.values()}] + groups
    ts["count"] = count
    TS_PATH.write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=count, tilesPerRow=COLS)) + "\n")

    art = json.loads(ART.read_text())
    pieces = art["grass-steps"]["pieces"]
    for k in [k for k in pieces if ":long-" in k]: del pieces[k]
    pieces.update(ramp)
    ART.write_text(json.dumps(art) + "\n")
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--from-store", action="store_true")
    a = ap.parse_args()
    tiles, ramp, masks = load()
    if not a.from_store:
        from object_gate import refusal
        blocked = [(label, why) for im, label in gate_items(tiles, ramp) if (why := refusal(im, kind="terrain", context="bundle"))]
        n = 2 * len(masks) + len(ramp)
        print(f"관문: {n - len(blocked)}/{n} 통과")
        for label, why in blocked[:10]: print("  막힘", label, "←", why)
        if blocked:
            sys.exit(2)
        if a.dry:
            return
    count = write(tiles, ramp, masks)
    print(f"호숫가 꼬리 {BASE}..{count - 1}, 긴 비탈 {len(ramp)}조각 굽기 완료")


if __name__ == "__main__":
    main()
