"""고른 조각 건물 키트(bd-pick-*)의 문 칸을 그림에서 찾는다.
python3 scripts/content/beodeul-picks/find_pick_doors.py [--dry]
쓰는 것: tiledata/beodeul-variants/pick-doors.json(정본 — bake_picks.py 가 키트에 parts 로 붙인다) +
번들 src/assets/beodeulCityTileset.json 의 해당 키트에 parts:[{kind:"entrance"}] (도시 집 키트 bd-house-* 와 같은 모양).
판정: 맨 아래 칸 줄 바로 위 18px 띠에서 「어두운 나무색(문짝) 또는 아주 어두운(아치 속)」 픽셀 비율이 가장 높은 16px 칸.
키트 그림은 왼쪽 아래 맞춤(bake_picks.py 규약). 점수가 낮으면(문 없는 물체) 넣지 않는다."""
import json, re, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
TS = json.load(open(ROOT / "src/assets/beodeulCityTileset.json"))
OUT = ROOT / "tiledata/beodeul-variants/pick-doors.json"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
BUILDING = re.compile(r"-(?:[nsewd]\d(?:-[a-z]+)?|hall|hut|shed|inn|khan|temple|shrine|smith|smelt|boss|bath|loom|pierhut|winery|lighthouse|fish-market|adit|toll-booth|guard-post|greenhouse|wizard-tower)$")
res = {}
for k in TS["structureKits"]:
    if not k["id"].startswith("bd-pick-") or k["width"] < 3 or k["height"] < 4: continue
    if k["ai"].get("role") != "prop" or not BUILDING.search(k["id"]): continue
    m = re.search(r"tiledata/beodeul-variants/[^ )]+\.png", k["ai"].get("description", ""))
    if not m: continue
    im = Image.open(ROOT / m.group(0)).convert("RGBA"); W, H = im.size
    px = im.load(); best = (0.0, -1)
    band = [(x, y) for y in range(max(0, H - 13), H - 2) for x in range(W) if px[x, y][3] >= 200]
    if len(band) < 60: continue
    med = [sorted(px[x, y][i] for x, y in band)[len(band) // 2] for i in range(3)]
    cols = range(1, k["width"] - 1) if k["width"] >= 4 else range(k["width"])
    for c in cols:
        n = 0; diff = 0.0; dark = 0
        for y in range(max(0, H - 13), H - 2):
            for x in range(c * 16 + 2, min(W, c * 16 + 14)):
                r, g, b, a = px[x, y]
                if a < 200: continue
                n += 1; diff += (abs(r - med[0]) + abs(g - med[1]) + abs(b - med[2])) / 3
                if 0.3 * r + 0.59 * g + 0.11 * b < 0.3 * med[0] + 0.59 * med[1] + 0.11 * med[2] - 25: dark += 1
        if n < 80: continue
        s = diff / n / 255 + dark / n * 0.5
        if s > best[0]: best = (s, c)
    # 건물(이름으로 고름)은 모두 문을 갖는다 — 신호가 약하면(통나무 벽처럼 문과 벽 색이 같으면) 가운데 칸
    col = best[1] if best[0] >= 0.12 and best[1] >= 0 else (k["width"] - 1) // 2
    res[k["id"]] = {"dx": col, "dy": k["height"] - 1, "score": round(best[0], 2)}
print(len(res), "doors"); [print(i, v) for i, v in list(res.items())]
def door_part(v):
    return {"id": "door", "kind": "entrance", "dx": v["dx"], "dy": v["dy"], "w": 1, "h": 1, "note": "문 칸(윗부분 그림, 그림에서 찾음) — 문 칸 자체는 막힘, 그 아래 칸이 문 앞 길"}
if "--dry" not in sys.argv:
    OUT.write_text(json.dumps({i: {"dx": v["dx"], "dy": v["dy"]} for i, v in sorted(res.items())}, indent=0) + "\n")
    for k in TS["structureKits"]:
        if k["id"] in res: k["parts"] = [door_part(res[k["id"]])]
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
