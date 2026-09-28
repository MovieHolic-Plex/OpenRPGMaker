# AI reference documents for the 버들항 v6 sheet (beodeul_city, scripts/content/build-beodeul-city.py) — bundle-owned,
# per AGENTS.md 「새 타일·타일 학습은 공용에 추가한다」 and tiledata/AI-REFERENCE-CONTRACT.md.
#   → src/assets/beodeulCityReferences.json (image paths, no bytes) + public/assets/beodeul-city/references/*.png
#     + tiledata/beodeul-city/references/*.md (the same pages, committed as the source copy)
# Uses (categories): 1) 도시 한 장 조립(읽는 순서·배치 순서·구역 배치도·통행·검사) 2) 구역 키트(왕성·저택·포룸·성당·풍차·항구·강/다리)
# 3) 건물·소품·나무 조각 사전(칸 배열, 문 칸, 배치 규칙) 4) 16구역 QA 결함 교훈(오류 그림 = 실제 변조 + 검출 좌표).
# Usage (after build-beodeul-city.py): python3 scripts/content/prepare-beodeul-city-references.py
import json, pathlib, collections
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA = ROOT / "tiledata/beodeul-city"; REND = DATA / "render"
TS = json.loads((ROOT / "src/assets/beodeulCityTileset.json").read_text())
MAP = json.loads((DATA / "map.json").read_text())
KITS = {k["id"]: k for k in TS["structureKits"]}
PROPS = {p["id"]: p for p in json.loads((ROOT / "scripts/content/lib/city_v6/meta.json").read_text())["props"]}
QA = json.loads((ROOT / "scripts/content/lib/city_v6/qa-v6.json").read_text())
GRID = json.loads((REND / "city6_grid.json").read_text())
SHEET = Image.open(ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png").convert("RGBA")
IMG = ROOT / "public/assets/beodeul-city/references"; IMG.mkdir(parents=True, exist_ok=True)
MD = DATA / "references"; MD.mkdir(parents=True, exist_ok=True)
W, H, T, COLS = MAP["width"], MAP["height"], 16, TS["tilesPerRow"]
TID = TS["id"]
CITY = Image.open(REND / "city6.png").convert("RGBA")
PASS = [p["up"] or p["down"] or p["left"] or p["right"] for p in TS["passability"]]

def tile(t):
    return SHEET.crop((t % COLS * T, t // COLS * T, t % COLS * T + T, t // COLS * T + T))
def draw(lower, upper, w, h, bg=(58, 90, 52, 255)):
    im = Image.new("RGBA", (w * T, h * T), bg)
    for layer in (lower, upper):
        for i, t in enumerate(layer):
            if t is not None and t >= 0: im.alpha_composite(tile(t), (i % w * T, i // w * T))
    return im
def small(im, side=820):
    s = min(1.0, side / max(im.size))
    im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.NEAREST if s >= 1 else Image.LANCZOS) if s < 1 else im
    return im.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT).convert("RGB")
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def save(cat, name, im, caption, scale=1):
    im = small(up(im, scale) if scale > 1 else im)
    im.save(IMG / f"{name}.png", optimize=True)
    return dict(id=f"bd-{name}", name=f"{name}.png", caption=caption, dataUrl=f"/assets/beodeul-city/references/{name}.png")
def rows_text(a, w, x0, y0, x1, y1):
    return "\n".join(" ".join(f"{a[y * w + x]}" for x in range(x0, x1)) for y in range(y0, y1))
def kit_arrays(k):
    lo = "\n".join(" ".join(str(t) for t in r["tiles"]) for r in k["rows"])
    upx = "\n".join(" ".join(str(t) for t in r["upperTiles"]) for r in k["rows"])
    return lo, upx
def roles(k):
    out = []
    for r in k["rows"]:
        s = ""
        for lo, u in zip(r["tiles"], r["upperTiles"]):
            t = u if u >= 0 else lo
            if t < 0: s += "."
            elif u >= 0 and PASS[u]: s += "C"      # upper, walkable: ★ drawn over the player
            elif u >= 0: s += "S"                  # upper, blocked
            elif PASS[lo]: s += "F"
            else: s += "X"
        out.append(s)
    return out
def kit_image(k):
    return draw([t for r in k["rows"] for t in r["tiles"]], [t for r in k["rows"] for t in r["upperTiles"]], k["width"], k["height"])

cats = []
HEAD = f"tilesetId `{TID}` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`, {TS['count']}칸, 16px 칸, 한 줄 {COLS}칸 — 번호 n 의 칸은 행 n÷{COLS}, 열 n%{COLS}). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다."

# =============================== 1. city assembly ===============================
docs, images = [], []
city_small = CITY.copy()
d = ImageDraw.Draw(city_small)
DISTRICTS = [(k, KITS[k]) for k in ("bd-castle", "bd-estate", "bd-forum", "bd-cathedral", "bd-windmill", "bd-river-bridge", "bd-harbour-west", "bd-harbour")]
BOXES = {"bd-castle": (0, 0, 33, 33), "bd-estate": (36, 2, 57, 24), "bd-forum": (54, 34, 76, 48), "bd-cathedral": (82, 3, 99, 25),
         "bd-windmill": (1, 34, 13, 56), "bd-harbour": (36, 62, 99, 100), "bd-harbour-west": (0, 62, 36, 100), "bd-river-bridge": (26, 24, 42, 44)}
COL = {"bd-castle": (255, 80, 80), "bd-estate": (255, 200, 60), "bd-forum": (80, 200, 255), "bd-cathedral": (200, 120, 255), "bd-windmill": (120, 255, 120),
       "bd-harbour": (60, 120, 255), "bd-harbour-west": (60, 220, 220), "bd-river-bridge": (255, 140, 200)}
for kid, (x0, y0, x1, y1) in BOXES.items():
    d.rectangle((x0 * T, y0 * T, x1 * T - 1, y1 * T - 1), outline=COL[kid] + (255,), width=5)
    d.text((x0 * T + 8, y0 * T + 8), kid, fill=COL[kid] + (255,))
images.append(save("city", "city-overview", CITY, "버들항 v6 전체 100×100(원본 렌더, 주민 포함). 이 그림이 목표 완성본이다. 칸 16px, 820px 로 줄임."))
images.append(save("city", "city-districts", city_small, "구역 배치도 — 색 상자 = 구역 키트(bd-castle 왕성 · bd-estate 귀족 저택 · bd-forum 포룸 · bd-cathedral 성당 언덕 · bd-windmill 풍차 들 · bd-river-bridge 강·폭포·다리 · bd-harbour-west / bd-harbour 항구). 상자 좌표는 문서 표와 같다."))
# levels + walk map
lv = Image.new("RGB", (W, H)); lp = lv.load()
LVC = {0: (70, 110, 170), 1: (110, 160, 90), 2: (190, 170, 90), 3: (220, 220, 220)}
for y in range(H):
    for x in range(W):
        c = LVC[GRID["E"][y][x]]
        if GRID["water"][y][x]: c = (30, 60, 140)
        elif GRID["F"][y][x]: c = (90, 70, 60)
        if MAP["walkable"][y][x] and not GRID["water"][y][x]: c = tuple(min(255, v + 60) for v in c)
        lp[x, y] = c
images.append(save("city", "city-levels-walk", up(lv, 8), "세 단 지형과 통행: 짙은 파랑 물, 갈색 절벽면, 흰색 3단(성 바위), 노랑 2단(저택·성당 언덕), 초록 1단(가운데 마을), 푸른 회색 0단(항구). 밝은 칸 = 걸을 수 있는 칸(길·광장·계단·다리·잔교·풀밭).", 1))
dist_rows = "\n".join(f"| `{kid}` | {k['name']} | ({BOXES[kid][0]},{BOXES[kid][1]}) | {k['width']}×{k['height']} | {k['ai']['placementRules']} |" for kid, k in DISTRICTS)
guide = f"""# 버들항 v6 — 도시 한 장 조립 (읽는 순서 · 배치 순서)

{HEAD}

버들항 v6 는 100×100 로마풍 항구 도시다. 세 단 지형(0 항구 · 1 가운데 마을 · 2 언덕 · 3 성 바위), 강 하나(폭포 둘), 아치 다리 셋, 남쪽 호수 항구,
북서 왕성, 북쪽 언덕 귀족 저택, 가운데 포룸, 북동 성당 언덕, 서쪽 탑풍차, 집 70채(가게 30), 소품 34종, 나무. 그림은 Python 손 도트(`scripts/content/lib/city_v6`)를
16px 칸으로 자른 것이다 — **이 시트에는 3×3·47 오토타일이 없다.** 땅·물·절벽·다리는 원본에서 잘린 칸이고, 한 칸이 한 번 쓰인 경우가 많다.
그래서 이 타일셋으로 「비슷한 도시」를 까는 길은 **번호를 한 칸씩 고르는 것이 아니라 키트를 찍는 것**이다.

## 읽는 순서
1. 이 문서 → 그림 `city-overview`(완성본) → `city-districts`(구역 상자) → `city-levels-walk`(단·통행).
2. 「구역 키트」 용도: 구역마다 크기·원점·문·잇는 법과 정답 역할 배열.
3. 「조각 사전」 용도: 건물 70·소품 34·나무 8 조각(윗부분 그림, 투명 배경).
4. 「결함 교훈」 용도: 16구역 적대적 QA 에서 나온 결함과 오류 그림(변조로 재현, 좌표 포함). 까기 전에 한 번 읽는다.

## 도구 (조수가 실제로 쓰는 길)
- 구역·건물·소품은 **`stamp_object`** 로 찍는다: `stamp_object({{objectId:'kit:{TID}/<키트 id>', mapId, x, y}})`. 키트 id 목록은 `list_spatial_designs({{kind:'object'}})` 의
  `data.shared.rows[].id` 에서 `kit:{TID}/…` 로 시작하는 줄이다(또는 아래 표). 키트는 아래층(땅)과 윗층(물체) 두 층을 원형 그대로 찍는다.
  **구역 키트는 두 층 모두 채워져 있어 찍은 자리의 땅을 덮고, 조각(건물·소품·나무)은 아래층이 -1 이라 찍은 자리의 땅을 그대로 둔다.**
- 땅 면: `fill_region({{mapId, rect, material:'버들항 풀밭'|'버들항 길 포석'|'버들항 광장 판석'|'버들항 물'}})` — 오토타일이 아니라 대표 칸 한 가지로 칠한다(가장자리 연석 없음).
- 새 맵: `create_map({{tilesetId:'{TID}', width, height}})`.
- 시트 자체 그림은 도구가 보여 주지 않는다. 그림은 이 문서의 이미지와 `show_map_region`(칠한 맵 그림)으로 본다.

## 도시 한 장 배치 순서 (100×100 기준, 원본 좌표 그대로가 정답)
1. 빈 맵 전체를 `버들항 풀밭` 으로 칠한다.
2. 구역 키트를 **원본 좌표에** 찍는다(아래 표). 순서: `bd-castle`(0,0) → `bd-river-bridge`(26,24) → `bd-estate`(36,2) → `bd-cathedral`(82,3) →
   `bd-forum`(54,34) → `bd-windmill`(1,34) → `bd-harbour-west`(0,62) → `bd-harbour`(36,62).
   구역 키트끼리는 원본에서 겹치지 않거나(상자 사이 1~3칸 틈) 겹치는 칸이 같은 칸이다 — 원본 좌표를 지키면 이음새가 맞는다.
3. 구역 사이 가운데 마을(20~55열 × 35~62행, 75~99열 × 25~62행)은 원본에 가로길 두 줄(33~34행 전폭, 44행·54행 끊긴 가로길)과 세로길(12~13, 56~58, 70~71, 88~89열)이 있다.
   `버들항 길 포석` 으로 이 길을 깔고, 길 북쪽 면에 건물 조각을 문이 길을 보게(문 칸 바로 아래가 길) 늘어세운다.
4. 가게 앞·광장 가장자리에 소품 조각(가로등·벤치·노점·화분·간판), 빈 풀밭에 나무 조각 무리.
5. 주민(이벤트)은 길·광장 칸에.
6. 검사: `check_reachability({{mapId, from:{{x:62,y:33}}, targets:[문 앞 칸들]}})` 로 모든 문 앞이 이어졌는지, `show_map_region` 으로 눈 확인.

## 구역 표 (원본 좌표 = 정답 원점)
| 키트 id | 이름 | 원점 (x,y) | 크기 | 잇는 법 |
|---|---|---|---|---|
{dist_rows}

## 역할 표기 (키트 칸마다)
| 기호 | 층 | 통행 | 뜻 |
|---|---|---|---|
| F | 아래층 | 걸음 | 길·광장·풀·계단·다리·잔교 |
| X | 아래층 | 막힘 | 물·절벽면·담·건물 밑 |
| C | 윗층 ★ | 걸음 | 사람 위에 그려지는 지붕 끝·나무 윗부분·굴뚝 |
| S | 윗층 | 막힘 | 벽·문·기둥·소품 밑동 |
| . | — | — | 비움(-1, 그 자리의 땅을 그대로 둔다) |

## 통행 판정 (엔진 판정과 같음)
- 칸의 통행은 맨 위 층부터: 윗층이 있고 ★ 가 아니면 윗층 칸이, 아니면 아래층 칸이 정한다(`src/project/collision.ts`).
- 원본 100×100 에서 걸을 수 있는 칸 {sum(1 for r in MAP['walkable'] for v in r if v)}칸. 정본 저장 스크립트가 편집기 통행과 원본 점유 격자를 칸마다 대조한다(불일치 0 이어야 저장).
- 문 칸(건물 그림의 문)은 막힘이다. **문 바로 아래 칸이 문 앞 길**이다 — 길이 거기서 끝나야 한다.

## 금지
- 번호를 추측해 한 칸씩 칠하지 않는다(이 시트 칸은 원본 자리에서 잘린 조각이라 다른 자리에 한 칸만 두면 이음새가 끊긴다).
- 구역 키트를 원본과 다른 단(높이)의 땅에 찍지 않는다 — 절벽·계단이 키트 안에 구워져 있다.
- 건물 조각을 물·절벽·다른 건물 위에 찍지 않는다. 같은 조각을 한 줄로 셋 이상 이어 찍지 않는다(QA 결함 「같은 집 되풀이」).
"""
docs.append(dict(id="bd-city-guide", name="도시 한 장 조립 · 읽는 순서", markdown=guide))
cats.append(dict(id="beodeul-city", name="버들항 v6 · 도시 한 장 조립", description="버들항 v6(100×100 로마풍 항구 도시) 시트의 읽는 순서, 도구(stamp_object 키트·fill_region 재료), 도시 한 장 배치 순서, 구역 좌표 표, 역할·통행 판정, 금지. 먼저 읽는다.", documents=docs, images=images))

# =============================== 2. district kits ===============================
docs, images = [], []
for kid, k in DISTRICTS:
    im = kit_image(k)
    images.append(save("kits", f"kit-{kid[3:]}", im, f"{k['name']} 키트 `{kid}` {k['width']}×{k['height']}, 원점 ({BOXES[kid][0]},{BOXES[kid][1]}). 두 층을 찍은 그대로(주민 없음).", 1 if max(im.size) > 400 else 2))
    rr = "\n".join(roles(k))
    body = f"""## {k['name']} — `{kid}`

{k['ai']['description']}

- 찍기: `stamp_object({{objectId:'kit:{TID}/{kid}', mapId, x:{BOXES[kid][0]}, y:{BOXES[kid][1]}}})` (원본 좌표. 다른 맵이면 같은 크기의 풀밭에)
- 잇는 법: {k['ai']['placementRules']}
- 그림: `kit-{kid[3:]}`

역할 배열({k['width']}×{k['height']}, 위 → 아래):
```text
{rr}
```
"""
    docs.append(dict(id=f"bd-kit-{kid[3:]}", name=f"구역 키트 · {k['name']}", markdown=f"# 구역 키트 · {k['name']}\n\n{HEAD}\n\n" + body))
# castle / estate / forum part lists from the Python kit answers
parts = json.loads((REND / "city6_kits.json").read_text())
pl = []
for n, v in parts.items():
    pl.append(f"### {n} (상자 {v['bbox']})\n\n| 조각 | x | y | w | h | 비고 |\n|---|---|---|---|---|---|\n" + "\n".join(
        f"| {a['piece']} | {a['x']} | {a['y']} | {a['w']} | {a['h']} | {', '.join(str(a[k2]) for k2 in ('door', 'note', 'layer', 'parts', 'material', 'part') if k2 in a)} |" for a in v["answer"]))
docs.append(dict(id="bd-kit-parts", name="구역 안 조각 배치(왕성·저택·포룸 정답)", markdown=f"""# 구역 안 조각 배치 — 왕성 · 저택 · 포룸 정답 좌표

Python 조립기(`scripts/content/lib/city_v6/city6_kits.py`)가 찍은 조각의 맵 좌표(왼쪽 위 칸, 폭·높이). 구역 키트 안의 그림이 이 조각들이다.
왕성은 궁전(23×8, 문 16,10) → 테라스 → 궁전 문 축의 말굽 계단(14,12 폭 5) → 원탑 넷(1·11·19·29열, 19행) → 성벽 → 성문루(14,19) → 도개교(15,23) → 둑길(15,26) → 계단(15,30) → 큰길 순서로 이어진다.
저택은 담(37,3 19×20) 안에 본채(39,3 문 45,11)·부엌·마차고·문지기 집·정원, 남쪽 쇠살문(44~45,22)이 유일한 출입구다.
포룸은 주랑(55,35)·신전(61,35 문 64,40, 기단 계단)·카페(69,35)·분수(63,43)·석상 둘·아치 문(55,45).

{chr(10).join(pl)}
"""))
# windmill / harbour / river notes
docs.append(dict(id="bd-kit-anim", name="움직이는 칸(물·연기·풍차·배·분수)", markdown=f"""# 움직이는 칸

이 시트의 움직임은 모두 데이터(`animationStrips`, {len(TS['animationStrips'])}줄)다: 칸 번호 baseTile 부터 오른쪽으로 frames 칸이 한 장면씩, 초당 8장면.
원본 24장면 한 바퀴(물 8 · 풍차 날개 8 · 연기 12 · 배/분수/깃발 4의 최소공배수)를 칸마다 주기로 줄였다. 편집기·플레이어가 같은 띠를 돌린다.

- 물(운하·호수): 8장면. 땅 칸(아래층).
- 굴뚝 연기: 12장면, 윗층(★, 지나감).
- 풍차 날개: 8장면(`bd-windmill` 키트 안, 탑 위 윗층).
- 배(항구 키트 안 8척): 4장면, 물 위 윗층(막힘 — 물 칸이라).
- 분수·깃발·기중기·등불 줄: 4~6장면.

키트를 찍으면 띠 칸이 그대로 찍혀 움직인다. 띠의 둘째 이후 칸 번호를 직접 칠하지 않는다(baseTile 만 칠한다).
"""))
cats.append(dict(id="beodeul-city-kits", name="버들항 v6 · 구역 키트(왕성·저택·포룸·성당·풍차·항구·강/다리)", description="구역 키트 8종의 원점·크기·잇는 법·역할 배열과 그림, 왕성·저택·포룸 안 조각 정답 좌표, 움직이는 칸.", documents=docs, images=images))

# =============================== 3. piece dictionary ===============================
docs, images = [], []
houses = [k for k in TS["structureKits"] if k["id"].startswith("bd-house-")]
props = [k for k in TS["structureKits"] if k["id"].startswith("bd-prop-")]
trees = [k for k in TS["structureKits"] if k["id"].startswith("bd-tree-")]
def board(kits, per_row, name, cap, scale=1):
    cw = max(k["width"] for k in kits) + 1; ch = max(k["height"] for k in kits) + 2
    rows_ = -(-len(kits) // per_row)
    im = Image.new("RGBA", (per_row * cw * T, rows_ * ch * T), (58, 90, 52, 255)); dd = ImageDraw.Draw(im)
    for i, k in enumerate(kits):
        x, y = (i % per_row) * cw * T, (i // per_row) * ch * T
        im.alpha_composite(kit_image(k), (x, y + T))
        dd.text((x + 2, y + 2), k["id"][3:], fill=(255, 255, 255, 255))
    return save("pieces", name, im, cap, scale)
landmarks = [k for k in houses if not k["id"][9:].startswith(("h", "i"))]
plain = [k for k in houses if k["id"][9:].startswith(("h", "i"))]
images.append(board(landmarks, 4, "pieces-landmarks", "이름 있는 건물 12(왕성 마구간·대장간·병영, 저택 본채·마차고·문지기 집, 카페, 탑풍차 몸체, 성당, 창고, 여관, 마을 대장간). 윗부분 그림만, 투명 바탕을 풀빛 위에."))
images.append(board(plain[:29], 6, "pieces-houses-a", "살림집·가게집 조각 1/2 — 이름표 = 키트 id 끝(bd-house-…)."))
images.append(board(plain[29:], 6, "pieces-houses-b", "살림집·가게집 조각 2/2."))
images.append(board(props, 9, "pieces-props", "소품 34종(가로등·벤치·노점·수레·상자·화분·간판·계선주·그물·빨래·석상·우물…). 윗부분 그림만.", 2))
images.append(board(trees, 8, "pieces-trees", "나무 8종(활엽수·덤불·사이프러스).", 2))
def entry(k):
    lo, upx = kit_arrays(k)
    door = next((p for p in (k.get("parts") or []) if p["kind"] == "entrance"), None)
    return f"""### `{k['id']}` — {k['name']}
{k['ai']['description']}
- 배치: {k['ai']['placementRules'] or '—'}{f'''
- 문 칸: 키트 원점 기준 (dx {door['dx']}, dy {door['dy']}) — 찍은 뒤 문 앞 길 칸 = (x+{door['dx']}, y+{door['dy'] + 1})''' if door else ''}
- 역할 `{' / '.join(roles(k))}`
- 윗층 배열:
```text
{upx}
```
"""
for i in range(0, len(houses), 18):
    part = houses[i:i + 18]
    docs.append(dict(id=f"bd-pieces-houses-{i // 18 + 1}", name=f"건물 조각 사전 {i // 18 + 1}", markdown=f"# 건물 조각 사전 {i // 18 + 1}\n\n{HEAD}\n\n찍기: `stamp_object({{objectId:'kit:{TID}/<id>', mapId, x, y}})` (x,y = 키트 왼쪽 위 칸). 아래층은 -1(땅 그대로).\n\n" + "\n".join(entry(k) for k in part)))
docs.append(dict(id="bd-pieces-props", name="소품·나무 조각 사전", markdown=f"# 소품·나무 조각 사전\n\n{HEAD}\n\n소품 규칙의 주인: 가로등은 광장 모서리·큰길 가, 벤치는 분수·우물 옆, 노점·수레는 광장 가장자리, 간판·입간판·진열대는 가게 문 옆(문 앞 2칸 금지), 계선주·그물·생선 궤짝은 부두, 빨래는 집 사이 골목.\n\n" + "\n".join(entry(k) for k in props + trees)))
cats.append(dict(id="beodeul-city-pieces", name="버들항 v6 · 건물·소품·나무 조각 사전", description=f"건물 {len(houses)}(이름 있는 건물 {len(landmarks)} 포함)·소품 {len(props)}·나무 {len(trees)} 조각의 키트 id, 설명, 배치 규칙, 문 칸, 역할, 윗층 배열, 조각판 그림.", documents=docs, images=images))

# =============================== 4. QA defect lessons (tampered error pairs) ===============================
docs, images = [], []
lower, upper = list(MAP["lowerTiles"]), list(MAP["upperTiles"])
def crop_map(lo, u, x0, y0, x1, y1):
    return draw([lo[y * W + x] for y in range(y0, y1) for x in range(x0, x1)], [u[y * W + x] for y in range(y0, y1) for x in range(x0, x1)], x1 - x0, y1 - y0)
def walk_of(lo, u, x, y):
    t = u[y * W + x]
    if t >= 0 and TS["priority"][t] == "upper" and not PASS[t]: return False
    if t >= 0 and PASS[t]: return PASS[lo[y * W + x]]
    return PASS[lo[y * W + x]]
def reach(lo, u, start):
    seen = {start}; q = collections.deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and walk_of(lo, u, *n): seen.add(n); q.append(n)
    return seen
BASE_REACH = reach(lower, upper, (62, 33))
DOOR_FRONT = [(d[0], d[1] + 1) for d in MAP["doors"]]
def check(lo, u):
    r = reach(lo, u, (62, 33)); errs = []
    for d, f in zip(MAP["doors"], DOOR_FRONT):
        if f not in r: errs.append(dict(code="door-unreachable", at=f, door=d[2]))
    return errs
assert not check(lower, upper), "the original must pass"
def pair(name, bad_lo, bad_u, box, cap):
    x0, y0, x1, y1 = box
    good = crop_map(lower, upper, x0, y0, x1, y1); bad = crop_map(bad_lo, bad_u, x0, y0, x1, y1)
    im = Image.new("RGBA", (good.width * 2 + 16, good.height), (27, 28, 31, 255)); im.paste(bad, (0, 0)); im.paste(good, (good.width + 16, 0))
    return save("qa", name, im, cap, 2)
def stamp(lo, u, kit, x, y):
    lo, u = list(lo), list(u)
    for j, r in enumerate(kit["rows"]):
        for i, (a, b) in enumerate(zip(r["tiles"], r["upperTiles"])):
            if 0 <= x + i < W and 0 <= y + j < H:
                if a >= 0: lo[(y + j) * W + x + i] = a
                if b >= 0: u[(y + j) * W + x + i] = b
    return lo, u
results = []
# E1: a house stamped on the street in front of another house's door (blocked door front)
h = KITS["bd-house-h103_1"]
lo1, u1 = stamp(lower, upper, h, 15, 74)
e1 = check(lo1, u1)
images.append(pair("err-door-blocked", lo1, u1, (10, 64, 34, 82), f"왼쪽 오류 · 오른쪽 정답. 가게집 `bd-house-h103_1` 을 (15,74) 길 위에 찍어 푸줏간(문 17,73) 문 앞 길을 막았다. 검출: {', '.join(f'{e['code']} {tuple(e['at'])}' for e in e1[:3])}."))
results.append(dict(code="door-unreachable", tamper="bd-house-h103_1 @ (15,74)", detected=e1))
# E2: drawbridge deck removed (moat water left) — the castle's only way in breaks
lo2, u2 = list(lower), list(upper)
wt = lower[24 * W + 5]
for y in range(23, 26):
    for x in range(15, 18): lo2[y * W + x] = wt; u2[y * W + x] = upper[24 * W + 5]
e2 = check(lo2, u2)
images.append(pair("err-drawbridge-missing", lo2, u2, (6, 16, 28, 32), f"왼쪽 오류 · 오른쪽 정답. 해자 위 도개교(15,23 3×3)를 해자 물 칸으로 바꿨다 — 왕성의 유일한 출입구가 끊긴다(다른 다리가 있는 강과 달리 우회로가 없다). 검출: 문 앞 도달 불가 {len(e2)}곳, 예 {', '.join(str(tuple(e['at'])) for e in e2[:4])}."))
results.append(dict(code="door-unreachable", tamper="drawbridge (15..17,23..25) → moat water", detected=e2))
# E3: grand stair removed (cliff face copied over it) — the palace is cut off
lo3, u3 = list(lower), list(upper)
face = lower[13 * W + 10]
for y in range(12, 15):
    for x in range(14, 19): lo3[y * W + x] = lower[y * W + 10]; u3[y * W + x] = upper[y * W + 10]
e3 = check(lo3, u3)
images.append(pair("err-stair-missing", lo3, u3, (4, 4, 30, 20), f"왼쪽 오류 · 오른쪽 정답. 궁전 문 축의 말굽 계단(14,12 폭 5)을 절벽면 칸으로 덮었다 — 성 바위 위 궁전 문이 아래 마을과 끊긴다. 검출: {', '.join(f'{e['code']} {tuple(e['at'])}' for e in e3[:3])}."))
results.append(dict(code="door-unreachable", tamper="grand stair (14..18,12..14) → cliff face", detected=e3))
# E4: pier head short of the promenade (the v6 QA fix undone) — shown, detected as a dead-end pier
lo4, u4 = list(lower), list(upper)
px_, py_, pw, ph = GRID["piers"][0]
for x in range(px_, px_ + pw): lo4[py_ * W + x] = lower[(py_ + 2) * W + px_ + pw + 1]; u4[py_ * W + x] = upper[(py_ + 2) * W + px_ + pw + 1]
pier_cells = [(px_ + i, py_ + j) for j in range(1, ph) for i in range(pw)]
r4 = reach(lo4, u4, (62, 33))
cut = [c for c in pier_cells if c not in r4]
images.append(pair("err-pier-gap", lo4, u4, (px_ - 6, py_ - 5, px_ + 8, py_ + ph + 1), f"왼쪽 오류 · 오른쪽 정답. 잔교({px_},{py_})의 첫 널판 줄을 물로 되돌렸다 — v6 QA 가 고친 「잔교가 산책길에 한 칸 못 미침」. 검출: 잔교 칸 {len(cut)}/{len(pier_cells)} 이 큰길에서 도달 불가(예 {cut[:2]})."))
results.append(dict(code="pier-unreachable", tamper=f"pier row ({px_}..{px_ + pw - 1},{py_}) → water", detected=cut))
# E5: same tree 5 in a row (a flagged visual defect: structure check can't see it) — shown only
lo5, u5 = list(lower), list(upper)
tr = trees[0]
for i in range(5): lo5, u5 = stamp(lo5, u5, tr, 3 + i * tr["width"], 57)
images.append(pair("err-tree-row", lo5, u5, (0, 52, 26, 64), "왼쪽 오류 · 오른쪽 정답. 같은 나무 조각을 한 줄로 다섯 번(QA q32 「같은 둥근 나무 다섯 그루 일렬」). 구조 검사로는 잡히지 않는다 — 눈으로 보는 결함이다."))
results.append(dict(code="visual-only", tamper="5× same tree in a row @ (3,57)", detected=[]))
(DATA / "qa-tamper-checks.json").write_text(json.dumps(results, ensure_ascii=False, indent=1) + "\n")
qrows = "\n".join(f"| {q['id']} | {q['v5M']}/{q['v5m']} → **{q['v6M']}/{q['v6m']}** | {' / '.join(q['fixed'])} | {' / '.join(q['new_in_v6'])} |" for q in QA["quadrants"])
docs.append(dict(id="bd-qa-lessons", name="16구역 QA 결함 교훈 · 오류 그림", markdown=f"""# 16구역 적대적 QA 에서 배운 것 (버들항 v5 → v6)

{QA['method']}

표: 구역 id(q행열, 25×25칸) · 중대/경미 결함 수 v5 → v6 · 고친 것 · v6 에서 남거나 새로 본 것.

| 구역 | 중대/경미 | 고친 것 | 남은 것 |
|---|---|---|---|
{qrows}

## 남은 큰 결함 (v6 끝)
{chr(10).join('- ' + x for x in QA['left'])}

## 까는 사람이 지킬 규칙 (위 결함에서)
1. **모든 길은 어딘가에 닿는다** — 막다른 가로길 금지(q13·q24·q33·q34). 길 끝은 문·광장·다리·계단·맵 가장자리 중 하나.
2. **큰길이 강을 만나면 다리** — 분홍 대로가 폭포 옆 강에 그냥 닿은 것(q32)이 중대 결함.
3. **문 앞 한 칸은 길** — 문 앞을 소품·집·나무로 막지 않는다(오류 그림 1).
4. **잔교 첫 널판은 산책길에 닿는다**(오류 그림 4, q41·q44 에서 고친 것).
5. **같은 소품·나무를 한 줄로 늘어세우지 않는다**(화분 가로수·둥근 나무 다섯·침엽수 줄·빨랫줄, 오류 그림 5).
6. **궁전·신전 같은 큰 건물은 문 축에 계단**(q11·q23 고친 것), 원탑 원뿔 처마 밑 칸에 소품 금지(v6 수정).
7. 원색 노랑 밀밭 사각형·붉은 벽돌 경계선처럼 튀는 색 덩이 금지(q12·q13·q42).

## 오류 그림 (실제 변조 → 자동 검출)
정답 맵(원본 100×100)에 변조를 가하고 같은 검사(큰길 62,33 에서 네 방향 도달, 문 앞 칸 전부)를 돌렸다. 결과는 `tiledata/beodeul-city/qa-tamper-checks.json`.

| 그림 | 변조 | 검출 |
|---|---|---|
| `err-door-blocked` | 가게집을 문 앞 길에 찍음 | {', '.join(f"{e['code']} {tuple(e['at'])}" for e in e1[:2]) or '없음'} |
| `err-drawbridge-missing` | 도개교 → 해자 물 | 문 앞 도달 불가 {len(e2)}곳 |
| `err-stair-missing` | 말굽 계단 → 절벽면 | {', '.join(f"{e['code']} {tuple(e['at'])}" for e in e3[:2]) or '없음'} |
| `err-pier-gap` | 잔교 첫 줄 → 물 | 잔교 칸 {len(cut)}/{len(pier_cells)} 도달 불가 |
| `err-tree-row` | 같은 나무 5그루 일렬 | 구조 검사로는 안 잡힘(눈 검사) |

## 검사 범위
자동 검사는 **통행과 연결(도달)** 만 본다. 미적 품질(반복·색·밀도)·이벤트 실행·저가 모델 성공률은 이 검사로 주장하지 않는다.
"""))
cats.append(dict(id="beodeul-city-qa", name="버들항 v6 · 16구역 QA 결함 교훈(오류 그림)", description="16구역 적대적 QA 표(v5→v6 중대/경미), 남은 결함, 까는 규칙 7, 실제 변조로 재현한 오류 그림 5장과 검출 좌표, 검사 범위.", documents=docs, images=images))

# write MD copies + bundle
for c in cats:
    for d_ in c["documents"]:
        md = d_["markdown"]
        (MD / f"{d_['id']}.md").write_text(md.rstrip() + "\n")
(ROOT / "src/assets/beodeulCityReferences.json").write_text(json.dumps(cats, ensure_ascii=False, indent=0) + "\n")
print(json.dumps(dict(categories=len(cats), documents=sum(len(c["documents"]) for c in cats), images=sum(len(c["images"]) for c in cats),
                      chars=[sum(len(d_["markdown"]) for d_ in c["documents"]) for c in cats], tamper=[(r["code"], len(r["detected"])) for r in results])))
