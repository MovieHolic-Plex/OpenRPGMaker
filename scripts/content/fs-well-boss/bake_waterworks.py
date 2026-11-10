#!/usr/bin/env python3
"""『폴른 스타』 우물 밑 옛 상수도 조각(계단·다리)을 버들항 시트 꼬리 34,816~ 에 덧붙인다.

  python3 scripts/content/fs-well-boss/bake_waterworks.py --dry   # 관문 상태만
  python3 scripts/content/fs-well-boss/bake_waterworks.py         # 관문 통과한 조각만 굽는다(막힌 조각은 빼고 종료코드 2)

그림 정본: tiledata/fs-well-boss/pieces/<조각>.png (Opus 5.5 high 코드 손 도트, ~/claude-viz/fs-well-boss/nsbridge/draw_nsbridge.py).
다리(layer="upper")는 위층(upperTiles)에 둔다 — 투명 화소 밑으로 맵의 물·바닥이 비치고, 위층 통행(데크 걸음·난간 막힘)이 물 칸을 덮는다. 그리기 우선은 lower(사람 밑).
3/4 관문(hard rule): 조각마다 object_gate.refusal(context="bundle"). 지금은 보정 프로필이 없어 오너 위임 허용
(tiledata/fs-well-boss/decisions/*.json, Discord 원문·메시지 id·파일 해시)만 통과한다.
시트 순서: … → 호숫가(bake_lakeshore.py, 34,048~34,815) → 옛 상수도(이것).
"""
import argparse, json, pathlib, sys
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
PIECES = ROOT / "tiledata/fs-well-boss/pieces"
T, COLS, BASE = 16, 128, 34816

ITEMS = {
    "stairs-up": dict(kit="bd-wellboss-stairs-up", kind="wall_structure", name="옛 상수도 벽 속 오르는 계단 3×4",
                      walk=["xxx", "xox", "xox", "ooo"],
                      desc="어두운 벽돌벽 속으로 오르는 돌계단 — 위로 갈수록 어두워지고 맨 위는 쐐기돌 문 아치, 벽 횃불·쇠 난간. 가운데 줄이 걷는 칸, 맨 아래 줄은 밝은 착지.",
                      rules="북쪽 벽 앞면(2단 벽)에 얹는다. 이동 이벤트는 가운데 위 칸, 맨 아래 가운데 칸이 도착 칸."),
    "ew-bridge": dict(kit="bd-wellboss-bridge-ew", kind="structure", layer="upper", name="옛 상수도 동서 아치 돌다리 8×4",
                      walk=["xxxxxxxx", "oooooooo", "oooooooo", "xxxxxxxx"],
                      desc="남북 물길을 동서로 건너는 아치 돌다리 — 상판이 양쪽 바닥 벽돌로 이어지고(양 끝 2열 착지), 난간은 둑 위에서 낮은 연석으로 끝난다. 남쪽 면에 홍예 아치 둘, 아치 밑까지 물. 가운데 두 줄이 걷는 칸.",
                      rules="폭 4칸 남북 물길 위, 왼쪽 2열·오른쪽 2열이 양쪽 둑 바닥에 얹히게 놓는다(물길 서쪽 끝 x-2). 난간 줄(맨 위·맨 아래)은 막힘."),
}


def tiles_of(im):
    w, h = im.size[0] // T, im.size[1] // T
    return w, h, [[im.crop((x * T, y * T, x * T + T, y * T + T)) for x in range(w)] for y in range(h)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    from object_gate import refusal
    ok, blocked = [], []
    for item, d in ITEMS.items():
        im = Image.open(PIECES / f"{item}.png").convert("RGBA")
        why = refusal(im, kind=d["kind"], context="bundle")
        (blocked if why else ok).append((item, d, im, why))
    print(f"관문: {len(ok)}/{len(ITEMS)} 통과")
    for item, _, _, why in blocked:
        print("  막힘", item, "←", why)
    if a.dry:
        return 2 if blocked else 0
    count = json.loads(SHEET_JSON.read_text())["count"]
    if count < BASE:
        sys.exit(f"시트가 {BASE} 칸보다 짧다({count}) — 호숫가 꼬리(bake_lakeshore.py)부터 굽는다")
    cells = []
    for item, d, im, _ in ok:
        w, h, grid = tiles_of(im)
        assert len(d["walk"]) == h and all(len(r) == w for r in d["walk"]), item
        d["_w"], d["_h"], d["_ids"] = w, h, {}
        for y in range(h):
            for x in range(w):
                cells.append((item, d, x, y, grid[y][x]))
    rows = -(-len(cells) // COLS)
    new_count = BASE + rows * COLS
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    out = Image.new("RGBA", (COLS * T, (BASE // COLS + rows) * T), (0, 0, 0, 0))
    out.alpha_composite(sheet.crop((0, 0, COLS * T, (BASE // COLS) * T)), (0, 0))
    ts = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"):
        ts[k] = ts[k][:BASE]
    ts["animationStrips"] = [s for s in ts["animationStrips"] if s["baseTile"] < BASE]
    for i, (item, d, x, y, img) in enumerate(cells):
        tid = BASE + i
        out.alpha_composite(img, ((i % COLS) * T, (BASE // COLS + i // COLS) * T))
        walk = d["walk"][y][x] == "o"
        ts["passability"].append({k: walk for k in ("up", "down", "left", "right")})
        ts["priority"].append("lower")
        ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label=f"버들항 · {d['name']} ({x},{y})", description=d["desc"], tags=["버들항", "옛 상수도", "waterworks", item],
                                   defaultLayer=d.get("layer", "lower"), passage="walk" if walk else "solid", source="bundled-default"))
        d["_ids"][(x, y)] = tid
    for _ in range(len(cells), rows * COLS):
        ts["passability"].append({k: True for k in ("up", "down", "left", "right")}); ts["priority"].append("lower"); ts["terrain"].append(0)
        ts["tileMeta"].append(dict(label="", description="", source="bundled-default"))
    kit_ids = {d["kit"] for d in ITEMS.values()}
    ts["structureKits"] = [k for k in ts["structureKits"] if k["id"] not in kit_ids]
    for item, d, _, _ in ok:
        ts["structureKits"].append({
            "id": d["kit"], "kind": "section", "name": f"버들항 옛 상수도 · {d['name']}", "width": d["_w"], "height": d["_h"], "tileSize": T,
            "rows": [({"tiles": [-1] * d["_w"], "upperTiles": [d["_ids"][(x, y)] for x in range(d["_w"])]} if d.get("layer") == "upper" else {"tiles": [d["_ids"][(x, y)] for x in range(d["_w"])], "upperTiles": [-1] * d["_w"]}) for y in range(d["_h"])],
            "learnedFrom": "db-authored", "ai": {"description": d["desc"], "rules": d["rules"]},
        })
    out.save(SHEET_PATH, optimize=True)
    ts["count"] = new_count
    TS_PATH.write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=new_count, tilesPerRow=COLS)) + "\n")
    print(f"옛 상수도 꼬리 {BASE}..{new_count - 1}: {[i for i, *_ in ok]}")
    return 2 if blocked else 0


if __name__ == "__main__":
    sys.exit(main())
