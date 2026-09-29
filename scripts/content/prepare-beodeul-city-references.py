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
    return im.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)   # kept as a 128-colour palette PNG (RGB re-expansion tripled the bytes)
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
LAY = ROOT / "verify-shots/beodeul-layouts"
LAYOUTS = [(lid, json.loads((LAY / lid / "metrics.json").read_text()), json.loads((LAY / lid / "recipe.json").read_text()), json.loads((LAY / lid / "map.json").read_text()))
           for lid in ("hilltop", "estuary")]
for lid, met, rec, _ in LAYOUTS:
    images.append(save("city", f"layout-{lid}", Image.open(LAY / lid / "render.png").convert("RGBA"),
                       f"예시 배치 「{rec['name']}」 100×100 — 편집기 도구(create_map·fill_region·stamp_object)만으로 깐 결과를 엔진 렌더로 찍었다. 원본과 같은 칸 {met['originality']['sameShare'] * 100:.1f}%, 문 {met['doors']}곳 모두 포장 길망에 닿음."))
guide = f"""# 버들항 — 도시 한 장 조립 (읽는 순서 · 설계 순서)

{HEAD}

버들항은 100×100 로마풍 항구 도시 시트다. 그림은 Python 손 도트(`scripts/content/lib/city_v6`)를 16px 칸으로 자른 것이고,
**원본 도시(정본 맵)는 이 시트로 만든 한 가지 예시일 뿐 정답 좌표가 아니다.** 같은 조각으로 다른 도시를 짓는 것이 이 문서의 목적이다.
완성 예시가 셋 있다: 원본(`city-overview`), 「언덕 위 성 아래 마을」(`layout-hilltop`), 「강어귀 항구 도시」(`layout-estuary`). 둘째·셋째는
원본과 같은 칸이 1% 미만이고 편집기 도구만으로 깔았다(부른 순서가 「예시 배치」 문서에 그대로 있다).

## 읽는 순서
1. 이 문서 → 「배치 규칙」 → 예시 배치 둘(그림 `layout-hilltop`·`layout-estuary`와 도구 순서).
2. 「자동타일·물·다리」 용도: 길·운하 물·모랫길 오토타일(연석·둑이 저절로 붙는다), 강·폭포·다리·호수 항구 키트.
3. 「구역 키트」 용도: 왕성·저택·포룸·성당·풍차 키트의 크기·출구 칸·역할 배열.
4. 「귀족 저택·성 밖 마을」 용도: 저택 넷·정원·목조집·우물 광장과 부품 조립표.
5. 「조각 사전」: 집 70·소품 34·나무 8. 6. 「결함 교훈」: 오류 그림과 검출 좌표. 까기 전에 한 번 읽는다.

## 도구 (조수가 실제로 쓰는 길)
- 새 맵: `create_map({{tilesetId:'{TID}', width:100, height:100}})` → 바닥 `fill_region({{mapId, rect:{{x:0,y:0,w:100,h:100}}, material:'버들항 풀밭'}})`.
- 구역·건물·소품·나무: `stamp_object({{objectId:'kit:{TID}/<키트 id>', mapId, x, y}})` (x,y = 키트 왼쪽 위). 키트 id 는 `list_spatial_designs({{kind:'object'}})`
  의 `kit:{TID}/…` 줄. 키트는 두 층을 그대로 찍는다. **-1 칸은 그 자리의 땅을 그대로 둔다**(조각의 빈 모서리로 밑 잔디가 보인다).
- 길·물·모랫길: `fill_region({{mapId, rect, material:'버들항 길 포석'|'버들항 물'|'버들항 모랫길'}})` 또는 `lay_path({{mapId, points, material, naturalness:0}})`.
  셋 다 **오토타일**이다 — 칠한 모양의 가장자리마다 연석(길)·돌 둑(물)·잔디 가장자리(모랫길)가 저절로 붙고, 광장·계단·다리·키트 칸과 맞닿은 쪽은 이어진다.
- 광장 판석: `fill_region(…, material:'버들항 광장 판석')` (오토타일 아님, 한 가지 칸).
- 빈 풀밭 무늬: `bd-ground-lawn-1…6`(6×6, 아래층만, 모서리 -1)을 10칸 안팎 띄워 흩어 찍는다. 먼저 찍고 그 위에 집·길을 깔아도 된다.
- 검사: `check_reachability({{mapId, from:{{…큰길 칸…}}, targets:[문 앞 칸들]}})`, 눈 확인 `show_map_region`.

## 설계 순서 (새 도시 한 장)
1. **물의 뼈대를 먼저 정한다.** 강이 어디서 들어와 어디로 나가는가(맵 가장자리 → 폭포 → 하구/호수). 호수 항구 `bd-harbour-lake`(83×15)는 남쪽 가장자리에,
   폭포 `bd-waterfall-drop`(12×7)은 강 위쪽 끝(맵 가장자리나 단 경계)에 둔다. 강 몸은 `버들항 물` 4칸 폭으로 칠한다.
2. **큰 구역 키트를 평지에 놓는다.** 왕성(33×33)·저택(21×22)·성당(17×22)·포룸(22×14)·풍차(12×22). 키트마다 출구 칸이 정해져 있다(「배치 규칙」 표).
   구역끼리 겹치지 않게, 출구 칸 앞에 거리가 올 자리를 남긴다.
3. **거리망을 깐다.** 큰 동서 거리 2~4줄(2칸 폭) + 남북 대로 2~3줄. 강을 건너는 자리마다 `bd-bridge-arch`(갑판 2줄이 거리 두 줄과 같은 행).
   모든 거리의 끝은 **교차로·키트 출구·다리·맵 가장자리** 중 하나다.
4. **집을 거리 북쪽 면에 늘어세운다.** 집 조각의 문은 모두 아래 줄에 있고(뒤집은 조각 없음) 문 앞 = 문 바로 아래 칸이다.
   그래서 집은 동서 거리의 **북쪽**에, 집 높이만큼 위에서부터 놓는다(집 y = 거리 y − 집 높이). 같은 조각을 연달아 셋 이상 두지 않는다.
5. 귀족 구역: 저택 + 바로 아래 정원(`bd-garden-formal`), 정원 발치가 거리에 닿게. 성 밖: 모랫길 + 목조집 + 우물 광장.
6. 나무·잔디 무늬를 빈 땅에(문 앞·길 위 금지), 소품은 광장 가장자리·가게 문 옆.
7. 검사 4가지: 막다른 거리 0, 물에 닿아 끝나는 거리 0, 막힌 문 앞 0, 모든 문 앞이 포장 길망에 닿음.

## 원본 구역 좌표 (예시 — 새 도시에서 따라 할 필요 없다)
| 키트 id | 이름 | 원본 원점 (x,y) | 크기 | 잇는 법 |
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
- 문 칸(건물 그림의 문)은 막힘이다. **문 바로 아래 칸이 문 앞 길**이다.

## 금지
- 원본 맵을 그대로 옮겨 깔지 않는다(원본 좌표 그대로 찍으면 같은 도시가 된다 — 요청이 「다른 도시」면 실패다).
- 번호를 추측해 한 칸씩 칠하지 않는다. 땅·물·길은 재료 이름으로 칠한다.
- 구역 키트를 물·절벽 위에 찍지 않는다(절벽·계단·해자가 키트 안에 구워져 있다). 건물 조각을 물·다른 건물 위에 찍지 않는다.
- 거리와 키트 사이에 **한 칸 틈**을 남기지 않는다: `fill_region` 이 벽 틈 한 칸을 메워(요약의 「벽 틈 메움」) 짧은 길 토막이 생긴다. 붙이거나 두 칸 이상 띄운다.
"""
docs.append(dict(id="bd-city-guide", name="도시 한 장 조립 · 읽는 순서", markdown=guide))

# ---- layout rules: sockets of every district kit (exit cells = walkable edge cells that face outward) ----
def sockets(k):
    rr = roles(k); out = []
    for j, r in enumerate(rr):
        for i, c in enumerate(r):
            if c != "F": continue
            lo = k["rows"][j]["tiles"][i]; tg = (TS["tileMeta"][lo] or {}).get("tags", []) if lo >= 0 and TS["tileMeta"][lo] else []
            if not any(t in tg for t in ("road", "plaza", "stair", "bridge", "gate", "sand")): continue
            if j == len(rr) - 1: out.append(("남", i, j))
            elif j == 0: out.append(("북", i, j))
            elif i == 0: out.append(("서", i, j))
            elif i == len(r) - 1: out.append(("동", i, j))
    return out
def sock_text(k):
    ss = sockets(k); groups = collections.OrderedDict()
    for side, i, j in ss: groups.setdefault(side, []).append((i, j))
    return "; ".join(f"{side} " + ", ".join(f"({i},{j})" for i, j in v) for side, v in groups.items()) or "없음(둘레가 풀·담)"
SOCK_KITS = ["bd-castle", "bd-estate", "bd-cathedral", "bd-forum", "bd-windmill", "bd-harbour-lake", "bd-harbour-square", "bd-waterfall-drop", "bd-waterfall-wall",
             "bd-bridge-arch", "bd-manor-small", "bd-manor-timber", "bd-manor-tower", "bd-manor-vine", "bd-garden-formal", "bd-out-well-plaza", "bd-out-well-plaza-sand"]
sock_rows = "\n".join(f"| `{kid}` | {KITS[kid]['width']}×{KITS[kid]['height']} | {sock_text(KITS[kid])} |" for kid in SOCK_KITS if kid in KITS)
rules = f"""# 버들항 배치 규칙 — 구역 출구 · 거리 · 집 줄 · 다리 · 물

{HEAD}

## 1. 구역 키트의 출구 칸 (키트 원점 기준 dx,dy)
출구 = 키트 둘레의 걸을 수 있는 포장 칸(길·광장·계단·다리·문). 찍은 뒤 **출구 칸 바깥 이웃에 거리(또는 광장)가 닿아야** 한다.
예: 왕성을 (x,y)에 찍었고 남쪽 출구가 (16,32)면, 맵 칸 (x+16, y+33) 이 거리다.

| 키트 | 크기 | 출구 칸 (방향 dx,dy) |
|---|---|---|
{sock_rows}

키트 안에 이미 구워진 길(왕성 둑길·성당 광장·풍차 옆 길·호수 산책길)은 거리망의 일부다. 그 끝을 새 거리로 잇는다.

## 2. 거리
- 폭 2칸(큰 거리) 또는 1칸(골목·키트 샛길). `버들항 길 포석` 오토타일 — 연석은 칠한 모양에서 저절로 나온다.
- **거리의 끝 = 교차로 · 키트 출구 · 다리 · 맵 가장자리(마을을 떠나는 길)** 중 하나. 풀밭이나 물가에서 끝나면 결함이다.
- 강가 거리(둑길)는 강과 나란히 두면 괜찮다. 강을 **향해** 가는 거리는 다리로 건넌다.
- 키트 둘레와 거리 사이에 한 칸 틈 금지(메움 토막이 생긴다). 붙이거나 두 칸 이상.

## 3. 집 줄 (terrace)
- 집 조각 70개는 모두 문이 아래 줄이다. 동서 거리 행이 R 이면 집은 y = R − 집 높이 에 놓아 문 앞이 거리 첫 줄이 되게 한다.
- 집과 집은 붙이거나 한 칸 띄운다(15~30%). 같은 조각을 연달아 셋 이상 두지 않는다 — 가게집(`h…_0`)·살림집(`h…_1/2`)·작은 집(`i…`)을 섞는다.
- 남북 거리 옆에는 집 문이 닿지 않는다(옆면). 남북 거리가에는 집의 옆벽, 나무, 소품을 둔다.
- 두 동서 거리 사이의 간격 = 집 높이(6~9) + 거리 2 + 여유 0~2. 예시 둘은 10행 간격(38·48·58·68행).

## 4. 다리
- `bd-bridge-arch`(4×5): 4칸 폭 남북 강 위. 키트 1~2행이 갑판 → 거리 두 줄이 그 행과 같아야 한다(다리를 (x,y)에 찍으면 거리 행 = y+1, y+2).
- 먼저 강을 칠하고 다리를 찍고, 그다음 다리 양쪽 거리를 칠한다(다리 칸에 닿은 쪽은 연석이 안 생긴다).
- 호수 항구 키트 위 줄 38~41칸째에 하구 다리가 구워져 있다. 강을 그 칸 위로 내리면(x = 호수 x + 38) 강이 호수로 들어가고 호수 산책길이 강을 건넌다.

## 5. 물·땅
- 강 몸: `버들항 물` 4칸 폭(운하처럼 곧게 — 굽이는 칠한 모양대로 둑이 붙는다). 폭포 키트의 물 칸은 dx 4~7, 호수 하구도 4칸.
- 폭포 키트 양 끝은 바위 절벽면이 풀밭 위에 드러난다. 옆에 나무를 두거나 맵 가장자리에 붙인다.
- 성 밖 모랫길: `버들항 모랫길`(잔디 가장자리 오토타일). 목조집 줄과 우물 광장(`bd-out-well-plaza-sand`)을 거기에.
- 바닥 풀밭은 한 가지 칸이라 넓으면 죽어 보인다 → 잔디 무늬 조각을 흩고 나무 무리를 둔다.

## 6. 검사(자동, 구조만)
`scripts/content/lib/beodeul-metrics.ts`: 원본과 같은 칸 비율, 구역 키트 존재(찍은 자리의 90% 이상이 키트 그대로), 문 앞 육지 도달·포장 길망 도달,
막다른 포장 칸(이웃 1 이하), 막다른 넓은 거리(2~3칸 폭 끝), 물에 닿아 끝나는 거리, 막힌 문 앞, 같은 조각 셋 일렬. 미적 품질은 이 검사로 주장하지 않는다.
"""
docs.append(dict(id="bd-layout-rules", name="배치 규칙 · 구역 출구 · 거리 · 집 줄 · 다리", markdown=rules))

# ---- the two example layouts: recipe + role grid ----
def role_grid(mp):
    lo, u = mp["lowerTiles"], mp["upperTiles"]; out = []
    for y in range(H):
        s_ = ""
        for x in range(W):
            t = u[y * W + x]; l = lo[y * W + x]
            tg = (TS["tileMeta"][l] or {}).get("tags", []) if TS["tileMeta"][l] else []
            if t >= 0: s_ += "C" if PASS[t] else "S"
            elif "water" in tg: s_ += "~"
            elif "sand" in tg: s_ += "s"
            elif "bridge" in tg or "pier" in tg: s_ += "="
            elif any(k in tg for k in ("road", "plaza", "stair", "gate")): s_ += "R"
            elif PASS[l]: s_ += "."
            else: s_ += "X"
        out.append(s_)
    return "\n".join(out)
def call_line(c):
    a = c["args"]
    if c["name"] == "stamp_object": return f"stamp_object {a['objectId'].split('/')[-1]} @({a['x']},{a['y']})"
    if c["name"] == "fill_region": r = a["rect"]; return f"fill_region {a['material']} ({r['x']},{r['y']}) {r['w']}×{r['h']}"
    return f"{c['name']} {json.dumps(a, ensure_ascii=False)[:120]}"
INTENT = {"hilltop": "성은 북쪽 한가운데 언덕, 저택·성당이 양 날개. 큰길(38행) 아래 포룸, 동쪽 귀족 구역(저택+정원), 서쪽 풍차 들. 성벽 밖 남쪽 모랫길에 목조집과 우물 광장. 강·항구 없음 — 내륙 성읍.",
          "estuary": "강이 북쪽 맵 가장자리에서 들어와(물 오토타일은 가장자리에 둑을 만들지 않는다) 곧게 남쪽 호수 항구로 흐른다. 서쪽 둑에 왕성·귀족 저택, 동쪽 둑에 저택 구역·성당·포룸·풍차. 다리 셋 + 호수 하구 다리. 양 둑에 강가 둑길. 호수 옆 모랫길에 어부 목조집, 우물 광장."}
for lid, met, rec, mp in LAYOUTS:
    lines = [call_line(c) for c in rec["calls"] if not (c["name"] == "stamp_object" and "ground-lawn" in c["args"]["objectId"])]
    lawn = sum(1 for c in rec["calls"] if c["name"] == "stamp_object" and "ground-lawn" in c["args"]["objectId"])
    dd_ = met["defects"]
    body = f"""# 예시 배치 · {rec['name']} (`{lid}`)

{HEAD}

의도: {INTENT[lid]}

그림 `layout-{lid}` (엔진 렌더 100×100, 820px 로 줄임). 이 배치는 `scripts/content/author-beodeul-layouts.mts --only {lid}` 가
편집기 도구를 아래 순서로 불러 만든다(같은 순서로 부르면 같은 맵이 나온다 — 전체 아래층·윗층 배열은 이 순서의 결과다).

## 잰 값
| 항목 | 값 |
|---|---|
| 원본과 같은 칸 | {met['originality']['sameCells']}/10000 ({met['originality']['sameShare'] * 100:.2f}%) |
| 구역 키트 | {', '.join(d['id'] + ('✓' if d['present'] else '·') for d in met['districts'])} |
| 문 | {met['doors']}곳 — 육지 도달 {met['landReach']['reached']}, 포장 길망 도달 {met['streetReach']['reached']} |
| 막다른 포장 칸 / 막다른 넓은 거리 | {len(dd_['deadEndPavedCells'])} / {len(dd_.get('deadEndStreets', []))} |
| 물에 닿아 끝나는 거리 / 막힌 문 앞 / 같은 조각 셋 일렬 | {len(dd_['roadIntoWater'])} / {len(dd_['blockedDoorFronts'])} / {len(dd_['sameKitRepeats'])} |
| 도구 호출 | {len(rec['calls'])}번(잔디 무늬 조각 {lawn}번 포함) |

## 도구 순서 (잔디 무늬 {lawn}번은 뺐다)
```text
{chr(10).join(lines)}
```

## 역할 격자 100×100 (R 포장 · s 모랫길 · = 다리/잔교 · ~ 물 · . 걷는 땅 · X 막힌 땅 · C 윗층 걸음 · S 윗층 막힘)
```text
{role_grid(mp)}
```
"""
    docs.append(dict(id=f"bd-layout-{lid}", name=f"예시 배치 · {rec['name']}", markdown=body))
cats.append(dict(id="beodeul-city", name="버들항 · 도시 한 장 조립(원본은 예시)", description="버들항 시트로 새 도시를 짓는 순서: 도구(stamp_object 키트·오토타일 재료), 설계 순서, 배치 규칙(구역 출구 표·거리·집 줄·다리·물), 원본과 다른 예시 배치 둘(언덕 위 성읍·강어귀 항구)의 도구 순서·역할 격자·잰 값. 먼저 읽는다.", documents=docs, images=images))

def board(kits, per_row, name, cap, scale=1):
    cw = max(k["width"] for k in kits) + 1; ch = max(k["height"] for k in kits) + 2
    rows_ = -(-len(kits) // per_row)
    im = Image.new("RGBA", (per_row * cw * T, rows_ * ch * T), (58, 90, 52, 255)); dd = ImageDraw.Draw(im)
    for i, k in enumerate(kits):
        x, y = (i % per_row) * cw * T, (i // per_row) * ch * T
        im.alpha_composite(kit_image(k), (x, y + T))
        dd.text((x + 2, y + 2), k["id"][3:], fill=(255, 255, 255, 255))
    return save("pieces", name, im, cap, scale)
# =============================== 2. district kits ===============================
docs, images = [], []
for kid, k in DISTRICTS:
    im = kit_image(k)
    images.append(save("kits", f"kit-{kid[3:]}", im, f"{k['name']} 키트 `{kid}` {k['width']}×{k['height']}, 원본에서의 원점 ({BOXES[kid][0]},{BOXES[kid][1]}). 두 층을 찍은 그대로(주민 없음).", 1 if max(im.size) > 400 else 2))
    rr = "\n".join(roles(k))
    body = f"""## {k['name']} — `{kid}`

{k['ai']['description']}

- 찍기: `stamp_object({{objectId:'kit:{TID}/{kid}', mapId, x, y}})` — x,y 는 새 도시의 설계대로(원본은 ({BOXES[kid][0]},{BOXES[kid][1]})). 같은 크기의 평지 풀밭에.
- 출구 칸: {sock_text(k)}
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
cats.append(dict(id="beodeul-city-kits", name="버들항 · 구역 키트(왕성·저택·포룸·성당·풍차·항구·강/다리)", description="구역 키트 8종의 원점·크기·잇는 법·역할 배열과 그림, 왕성·저택·포룸 안 조각 정답 좌표, 움직이는 칸.", documents=docs, images=images))

# ---- v7: autotiles + river / waterfall / bridge / harbour kits (their own category) ----
wdocs, wimages = [], []
def autotile_board(ag, name, cap):
    vm = ag["variantMap"]
    im = Image.new("RGBA", (8 * 2 * T, 2 * 2 * T), (58, 90, 52, 255)); dd = ImageDraw.Draw(im)
    for n in range(16):
        x_, y_ = (n % 8) * 2 * T, (n // 8) * 2 * T
        im.alpha_composite(tile(vm[str(n)]), (x_ + 4, y_ + 2)); dd.text((x_ + 22, y_ + 6), str(n), fill=(255, 255, 255, 255))
    return save("water", name, im, cap, 3)
AT = {a["id"]: a for a in TS["autotileGroups"]}
at_rows = []
for aid, name, mat in (("beodeul_road_autotile", "at-road", "버들항 길 포석"), ("beodeul_canal_lake_47", "at-water", "버들항 물"), ("beodeul_sand_autotile", "at-sand", "버들항 모랫길")):
    ag = AT[aid]; wimages.append(autotile_board(ag, name, f"`{aid}` ({mat}) 16변형 — 아래 숫자 = 마스크(N=1 E=2 S=4 W=8, 같은 재료가 이웃한 방향의 합). 15 = 사방이 이어진 바디."))
    at_rows.append(f"| `{mat}` | `{aid}` | " + " ".join(f"{m}:{ag['variantMap'][str(m)]}" for m in range(16)) + " |")
at_doc = f"""# 자동타일 — 길 포석 · 강/운하 물 · 모랫길

{HEAD}

v7 에서 셋이 오토타일이 됐다. `fill_region`·`lay_path` 에 재료 이름만 주면 칠한 모양대로 가장자리 칸이 골라진다.
- 마스크: 같은 재료(또는 이어지는 칸: 광장·계단·다리·키트의 포장 칸, 맵 밖)가 있는 방향의 합 N=1 E=2 S=4 W=8. 15 = 바디.
- 없는 쪽마다: 길은 연석 2px, 물은 돌 둑 테두리와 그림자, 모랫길은 잔디 가장자리.
- 맵 가장자리는 이어진 것으로 본다(가장자리에 테두리가 안 생긴다 — 길·강이 맵 밖으로 나가는 모양).
- 물은 8장면 움직임 띠다(바디·변형 모두).

| 재료 | 그룹 | 마스크:칸 번호 |
|---|---|---|
{chr(10).join(at_rows)}

그림 `at-road`·`at-water`·`at-sand`. 번호를 직접 칠하지 말고 재료 이름으로 칠한다(한 칸만 번호로 두면 이웃이 다시 계산되지 않는다).
"""
wdocs.append(dict(id="bd-autotiles", name="자동타일 · 길·물·모랫길", markdown=at_doc))
WATER_KITS = ["bd-river-upper", "bd-river-straight-ns", "bd-canal-straight-ew", "bd-river-bend-ns-ew", "bd-canal-bend-ew-ns", "bd-bridge-arch",
              "bd-waterfall-drop", "bd-waterfall-wall", "bd-harbour-lake", "bd-harbour-square"]
wb = []
for kid in WATER_KITS:
    k = KITS[kid]; im = kit_image(k)
    wimages.append(save("water", f"kit-{kid[3:]}", im, f"{k['name']} `{kid}` {k['width']}×{k['height']}.", 1 if max(im.size) > 400 else 3))
    wb.append(f"## {k['name']} — `{kid}` ({k['width']}×{k['height']})\n\n{k['ai']['description']}\n\n"
              f"- 찍기: `stamp_object({{objectId:'kit:{TID}/{kid}', mapId, x, y}})`\n- 잇는 법: {k['ai']['placementRules']}\n- 출구 칸: {sock_text(k)}\n- 그림: `kit-{kid[3:]}`\n\n"
              f"역할 배열:\n```text\n" + "\n".join(roles(k)) + "\n```\n")
wdocs.append(dict(id="bd-water-kits", name="강·폭포·다리·호수 항구 키트", markdown=f"""# 강 · 폭포 · 다리 · 호수 항구 키트

{HEAD}

원본의 윗 강(성 옆 74칸 — v6 에서 키트로 덮이지 않던 곳)과 강 조각·폭포 둘·아치 다리·호수 항구·항구 광장. 강 몸은 오토타일 물로 칠하고,
이 키트는 **모양이 정해진 자리**(폭포 낙차·다리 갑판·호수 둑과 잔교)에만 쓴다. 강 폭은 모두 4칸이다.

순서: 호수 항구(남쪽 가장자리) → 폭포(강 위 끝) → `버들항 물` 로 폭포 아래 ~ 호수 하구(호수 x+38)까지 4칸 폭 → 다리 → 다리 양쪽 거리.

""" + "\n".join(wb)))
cats.append(dict(id="beodeul-city-water", name="버들항 · 자동타일과 강·폭포·다리·항구", description="길 포석·강/운하 물·모랫길 오토타일(16변형 마스크 표·그림)과 강 조각·폭포 둘·아치 다리·호수 항구·항구 광장 키트의 출구·역할 배열·그림.", documents=wdocs, images=wimages))

# ---- v7: noble manors + outskirts (hand-drawn kits with part assembly) ----
K7DIR = DATA / "kits7"
mdocs, mimages = [], []
manors = [k for k in TS["structureKits"] if k["id"].startswith(("bd-manor-", "bd-garden-"))]
mparts = [k for k in TS["structureKits"] if k["id"].startswith("bd-mpart-")]
outs = [k for k in TS["structureKits"] if k["id"].startswith("bd-out-")]
out_whole = [k for k in outs if k["width"] * k["height"] >= 9 or k["id"] in ("bd-out-fence-run", "bd-out-hay-barrels", "bd-out-woodpile")]
out_parts = [k for k in outs if k not in out_whole]
mimages.append(board(manors, 3, "manor-kits", "귀족 저택 넷(작은·반목조·탑·담쟁이)과 정형 정원·정원 정문. 두 층을 찍은 그대로."))
mimages.append(board(mparts, 10, "manor-parts", "저택 부품(지붕·박공·창 칸·문·기둥·담쟁이·산울타리·화단…). 저택 키트는 이 부품의 조립이다.", 2))
mimages.append(board(out_whole, 5, "outskirts-kits", "성 밖 마을 — 통나무 오두막·판자집·긴 집·작은 오두막, 우물 광장 둘, 장작·건초·울타리·창고.", 2))
mimages.append(board(out_parts, 12, "outskirts-parts", "목조집 부품(통나무 벽·문 넷·창·지붕 조각·박공·용마루 끝·굴뚝·덩굴·간판).", 3))
def asm_table(kid):
    f_ = K7DIR / f"{kid}.json"
    if not f_.exists(): return ""
    a_ = json.loads(f_.read_text()).get("assembly") or []
    if not a_: return ""
    return "조립표(부품 → 키트 안 칸 x,y; 뒤의 것이 위에 겹친다):\n\n| 부품 | x | y |\n|---|---|---|\n" + "\n".join(f"| `{p['kit']}` | {p['x']} | {p['y']} |" for p in a_) + "\n"
def entry7(k):
    door = next((p for p in (k.get("parts") or []) if p["kind"] == "entrance"), None)
    dl = f"\n- 문 칸 (dx {door['dx']}, dy {door['dy']}) — 문 앞 = (x+{door['dx']}, y+{door['dy'] + 1})" if door else ""
    return (f"### `{k['id']}` — {k['name']} ({k['width']}×{k['height']})\n{k['ai']['description']}\n- 배치: {k['ai']['placementRules'] or '—'}{dl}\n"
            f"- 역할:\n```text\n" + "\n".join(roles(k)) + "\n```\n" + asm_table(k["id"]))
mdocs.append(dict(id="bd-manor-kits", name="귀족 저택·정원 키트와 조립표", markdown=f"""# 귀족 저택 · 정원

{HEAD}

귀족 구역 = 저택 한 채 + 바로 아래 정형 정원. 정원의 가운데 자갈길(3칸)이 저택 현관 계단 아래에서 시작해 정원 발치(아래 줄)로 나간다 —
그 발치 칸 아래가 거리다. 예시 「언덕 위」: `bd-manor-timber`(72,41) + `bd-garden-formal`(72,53), 정원 발치 (80,61)에서 3칸 폭 길이 68행 거리로. 예시 「강어귀」: `bd-manor-vine`(4,40) + 정원(4,52), 거리 61행.
저택 키트는 부품(`bd-mpart-*`)을 조립표대로 겹친 결과다. 새 저택을 조립할 때는 표처럼 벽 칸 줄 → 창·문 → 지붕 → 박공·지붕창·굴뚝 → 담쟁이 순서로 겹친다.

""" + "\n".join(entry7(k) for k in manors) + "\n## 부품 사전 (`manor-parts`)\n" + "\n".join(f"- `{k['id']}` {k['width']}×{k['height']} — {k['name']}: 역할 `{' / '.join(roles(k))}`" for k in mparts) + "\n"))
mdocs.append(dict(id="bd-outskirts-kits", name="성 밖 목조집·우물 광장 키트와 조립표", markdown=f"""# 성 밖 마을 — 목조집 · 우물 광장

{HEAD}

성벽 밖(또는 항구 옆 어부 마을)은 포석 대신 `버들항 모랫길`, 반목조 집 대신 통나무·판자 목조집이다. 목조집도 문이 아래 줄이라 모랫길 북쪽 면에 늘어세운다.
우물 광장 `bd-out-well-plaza-sand`(9×8)는 둘레 모서리 칸이 비어 잔디가 보인다. 북쪽 트임(4~5칸째)과 남쪽 가장자리가 길과 닿는다.
예시 「언덕 위」: 모랫길 78~79행, 광장 (44,71) 을 큰 거리와 (48,70) 두 칸으로 잇는다. 예시 「강어귀」: 광장 (26,76), 북쪽 (30,75) 두 칸.

""" + "\n".join(entry7(k) for k in out_whole) + "\n## 부품 사전 (`outskirts-parts`)\n" + "\n".join(f"- `{k['id']}` {k['width']}×{k['height']} — {k['name']}: 역할 `{' / '.join(roles(k))}`" for k in out_parts) + "\n"))
cats.append(dict(id="beodeul-city-manor-outskirts", name="버들항 · 귀족 저택과 성 밖 목조 마을", description=f"귀족 저택 4·정원 2 키트({len(mparts)}개 부품 조립표), 성 밖 목조집·우물 광장·장작 키트({len(out_parts)}개 부품)의 문 칸·역할·조립표·그림.", documents=mdocs, images=mimages))


# =============================== 3. piece dictionary ===============================
docs, images = [], []
houses = [k for k in TS["structureKits"] if k["id"].startswith("bd-house-")]
props = [k for k in TS["structureKits"] if k["id"].startswith("bd-prop-")]
trees = [k for k in TS["structureKits"] if k["id"].startswith("bd-tree-")]
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
cats.append(dict(id="beodeul-city-pieces", name="버들항 · 건물·소품·나무 조각 사전", description=f"건물 {len(houses)}(이름 있는 건물 {len(landmarks)} 포함)·소품 {len(props)}·나무 {len(trees)} 조각의 키트 id, 설명, 배치 규칙, 문 칸, 역할, 윗층 배열, 조각판 그림.", documents=docs, images=images))

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
# layout-rule error pictures: tampered copies of the two example layouts, caught by beodeul-metrics.ts (author-beodeul-layouts.mts writes them)
lay_rows = []
for lid in ("hilltop", "estuary"):
    tj = LAY / lid / "tampers.json"
    if not tj.exists(): continue
    good_full = Image.open(LAY / lid / "render.png").convert("RGBA")
    for t_ in json.loads(tj.read_text()):
        x0, y0, x1, y1 = [max(0, v) for v in t_["box"]]; x1 = min(W, x1); y1 = min(H, y1)
        bad_full = Image.open(LAY / lid / f"{t_['id']}.png").convert("RGBA")
        g_ = good_full.crop((x0 * T, y0 * T, x1 * T, y1 * T)); b_ = bad_full.crop((x0 * T, y0 * T, x1 * T, y1 * T))
        im = Image.new("RGBA", (g_.width * 2 + 16, g_.height), (27, 28, 31, 255)); im.paste(b_, (0, 0)); im.paste(g_, (g_.width + 16, 0))
        det = "; ".join(f"{k_} {len(v_)}곳 예 {v_[0] if not isinstance(v_[0], dict) else v_[0].get('front', v_[0].get('at'))}" for k_, v_ in t_["detected"].items()) or "없음"
        sr = t_["streetReach"]
        images.append(save("qa", t_["id"], im, f"왼쪽 오류 · 오른쪽 정답(예시 배치 `{lid}`, 칸 {x0},{y0}~{x1},{y1}). {t_['caption']} 검출: {det}. 포장 길망 도달 {sr['reached']}/{sr['total']}.", 2))
        lay_rows.append(f"| `{t_['id']}` | `{lid}` | {t_['caption']} | {det} · 길망 도달 {sr['reached']}/{sr['total']} |")
        results.append(dict(code=t_["id"], tamper=t_["calls"], detected=t_["detected"]))
V7_FIXED = [
    "같은 나무 되풀이: 나무를 변형 셋·색조 흔들기로 고르고, 같은 변형을 이웃에 두지 않는다(q32 「둥근 나무 다섯 일렬」).",
    "빨랫줄: 5줄로 줄이고 집 사이 풀 틈 위에만, 14칸 이상 띄움.",
    "원색 노랑 밀밭: 밀 색 램프를 누른 황토로(q12·q13·q42).",
    "막다른 길 토막·문 앞이 아닌 끝가지: 두 번째 길 감사(road_fix7)가 문 앞·잔교 머리를 빼고 가지치기.",
    "큰길이 강에 닿아 끝남(q32): 넷째 다리 (47,67).",
    "성 북쪽 물띠 줄무늬: 해자 돌 벽면을 창백한 마름돌 한 가지로.",
    "잔교 그림이 사람을 가림: 잔교 널판을 윗층에서 땅으로 내림.",
    "구역 키트 가장자리의 이웃 조각(반쪽 집·지붕 꼭지·성벽 기둥·저택 옆 강 한 줄)을 잘라 냈다 — 새 도시에 찍어도 잘린 이웃이 따라오지 않는다. 왕성 해자 양 끝은 막힌 물 끝.",
    "남은 것: 왕성 키트 아래 절벽의 양 끝은 잘린 단면 그대로다(끝 마감 그림이 없다). 맵 가장자리에 붙이거나 끝에 나무 무리를 둔다.",
]
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

## v7 에서 고친 것
{chr(10).join('- ' + x for x in V7_FIXED)}

## 새 도시를 깔 때의 오류 그림 (예시 배치 변조 → `beodeul-metrics.ts` 검출)
| 그림 | 배치 | 변조 | 검출 |
|---|---|---|---|
{chr(10).join(lay_rows)}

## 원본 오류 그림 (실제 변조 → 자동 검출)
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
cats.append(dict(id="beodeul-city-qa", name="버들항 · QA 결함 교훈(오류 그림)", description="16구역 적대적 QA 표(v5→v6), v7 에서 고친 것, 까는 규칙 7, 원본 변조 오류 그림 5장 + 새 배치 변조 오류 그림(다리 빠짐·막다른 길·문 앞 막힘·같은 집 일렬)과 검출 좌표, 검사 범위.", documents=docs, images=images))

# write MD copies + bundle
for c in cats:
    for d_ in c["documents"]:
        md = d_["markdown"]
        (MD / f"{d_['id']}.md").write_text(md.rstrip() + "\n")
(ROOT / "src/assets/beodeulCityReferences.json").write_text(json.dumps(cats, ensure_ascii=False, indent=0) + "\n")
print(json.dumps(dict(categories=len(cats), documents=sum(len(c["documents"]) for c in cats), images=sum(len(c["images"]) for c in cats),
                      chars=[sum(len(d_["markdown"]) for d_ in c["documents"]) for c in cats], tamper=[(r["code"], len(r["detected"])) for r in results])))
