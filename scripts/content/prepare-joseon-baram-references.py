# 조선 칩셋(joseon_baram) AI 참고문서 — 번들 소유(AGENTS.md 「새 타일·타일 학습은 공용에 추가한다」, tiledata/AI-REFERENCE-CONTRACT.md 8항목).
#   → src/assets/joseonBaramReferences.json (그림은 경로만, 바이트 없음) + public/assets/joseon-baram/references/*.png
#     + tiledata/joseon-village/references/*.md (같은 쪽의 출처 사본) + tiledata/joseon-village/qa-tamper-checks.json (오류 그림 검출 기록)
# 용도(categories): 1) 한 장 조립(사전·읽는 순서·작업 순서·통행)  2) 땅 오토타일(길·마당·강·논)  3) 건물 조각 사전  4) 나무·소품·담·다리 조각 사전
#                  5) 조립 예제(양반댁 둘레·집 줄·건널목·강과 논)  6) 오류 교훈(실제로 변조한 그림 + 검출 코드·좌표)
# 사용: python3 scripts/content/build-joseon-tileset.py 다음에  python3 scripts/content/prepare-joseon-baram-references.py [--map-id joseon_v20]
# 그림은 모두 시트 칸 번호를 그대로 다시 조립한 것(nearest-neighbor 확대)이다. AI 가 그린 모형은 없다.
import argparse, collections, json, pathlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument("--map-id", default="joseon_v20")
ap.add_argument("--data", default="tiledata/joseon-village")
args = ap.parse_args()
DATA = ROOT / args.data
TS = json.loads((ROOT / "src/assets/joseonBaramTileset.json").read_text())
PW = json.loads((DATA / "piece-walk.json").read_text())["pieces"]
MAPJ = json.loads((DATA / "maps" / f"{args.map_id}.json").read_text())
STATS = json.loads((DATA / "build-stats.json").read_text())
EXTRA = json.loads((ROOT / STATS["maps"][args.map_id]["extra"]).read_text())
EQUIV = json.loads((DATA / "autotile-equiv.json").read_text())
EXPECT = json.loads((DATA / "expected-mismatch.json").read_text()).get(args.map_id, {})
SHEET = Image.open(ROOT / "public" / TS["image"]).convert("RGBA")
IMG = ROOT / "public/assets/joseon-baram/references"; IMG.mkdir(parents=True, exist_ok=True)
MD = DATA / "references"; MD.mkdir(parents=True, exist_ok=True)
T, COLS, COUNT, TID, TEX = 16, TS["tilesPerRow"], TS["count"], TS["id"], TS["textureKey"]
PFX = "jb-"
KITS = {k["id"]: k for k in TS["structureKits"]}
PASS = [p["up"] or p["down"] or p["left"] or p["right"] for p in TS["passability"]]
PRI = TS["priority"]
AT = {a["id"]: a for a in TS["autotileGroups"]}
W, H = MAPJ["width"], MAPJ["height"]
LOWER, UPPER = MAPJ["lowerTiles"], MAPJ["upperTiles"]
PIECE_PATH = "public/" + TS["image"]


def tile(t):
    return SHEET.crop((t % COLS * T, t // COLS * T, t % COLS * T + T, t // COLS * T + T))


def draw(lower, upper, w, h, bg=(0, 0, 0, 255)):
    im = Image.new("RGBA", (w * T, h * T), bg)
    for layer in (lower, upper):
        for i, t in enumerate(layer):
            if t is not None and t >= 0:
                im.alpha_composite(tile(t), (i % w * T, i // w * T))
    return im


def region(x0, y0, x1, y1, lower=None, upper=None):
    lo, up_ = lower or LOWER, upper or UPPER
    lw = [lo[y * W + x] if 0 <= x < W and 0 <= y < H else -1 for y in range(y0, y1) for x in range(x0, x1)]
    uw = [up_[y * W + x] if 0 <= x < W and 0 <= y < H else -1 for y in range(y0, y1) for x in range(x0, x1)]
    return lw, uw


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST) if k > 1 else im


def small(im, side=820):
    if max(im.size) > side:
        s = side / max(im.size)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    return im.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)


def save(name, im, caption):
    im = small(im)
    im.save(IMG / f"{name}.png", optimize=True)
    return dict(id=f"{PFX}{name}", name=f"{name}.png", caption=caption, dataUrl=f"/assets/joseon-baram/references/{name}.png")


def tint_overlay(im, chars, w, h, alpha=96):
    """칸마다 통행 색(X 빨강 / C 파랑 / F 초록)을 얹는다."""
    a = np.array(im.convert("RGBA"))
    col = {"X": (230, 40, 40), "C": (50, 110, 255), "F": (40, 200, 70)}
    for j in range(h):
        for i in range(w):
            c = chars[j][i]
            if c in col:
                sub = a[j * T:(j + 1) * T, i * T:(i + 1) * T, :3].astype(np.float32)
                a[j * T:(j + 1) * T, i * T:(i + 1) * T, :3] = (sub * (1 - alpha / 255) + np.array(col[c], np.float32) * (alpha / 255)).astype(np.uint8)
    return Image.fromarray(a)


def piece_image(name, with_walk=False, bg=(88, 120, 70, 255)):
    k = KITS[PFX + name]
    ups = [t for r in k["rows"] for t in r["upperTiles"]]
    im = draw([-1] * len(ups), ups, k["width"], k["height"], bg)
    if with_walk:
        im = tint_overlay(im, PW[name]["rows"], k["width"], k["height"])
    return im


def sheet_of(names, per_row_px=800, zoom=2, with_walk=True):
    """조각 여러 개를 한 장에(줄바꿈). 칸 통행 색을 얹는다."""
    items = [(n, piece_image(n, with_walk)) for n in names]
    x = y = rowh = 0
    pos = []
    for n, im in items:
        w, h = im.width * zoom + 6, im.height * zoom + 14
        if x + w > per_row_px and x > 0:
            x = 0; y += rowh; rowh = 0
        pos.append((x, y)); x += w; rowh = max(rowh, h)
    out = Image.new("RGBA", (per_row_px, y + rowh + 2), (46, 46, 54, 255))
    d = ImageDraw.Draw(out)
    for (n, im), (px, py) in zip(items, pos):
        d.text((px + 2, py + 1), n[:26], fill=(255, 255, 255, 255))
        out.alpha_composite(up(im, zoom), (px, py + 12))
    return out


def ko(name):
    return KITS[PFX + name]["name"].replace("조선 ", "", 1)


HEAD = (f"tilesetId `{TID}` · 그림 `{PIECE_PATH}`(텍스처 `{TEX}`, **{COUNT}칸**, 16px 칸, 한 줄 **{COLS}칸** — 번호 n 의 칸은 행 n÷{COLS}, 열 n%{COLS}, "
        f"픽셀 좌표 (열×16, 행×16), 모두 0 기준). 칸 {TS['baseCount']} 이상은 같은 그림이 다른 통행으로 쓰이는 복사본 칸이다(맵이 알아서 쓴다 — 번호를 직접 고르지 않는다).")
WALKTXT = """| 기호 | 칸 통행 | 그림 순서 | 뜻 |
|---|---|---|---|
| `X` | 막힘 | 사람과 같은 높이로 y 정렬(윗층 priority `upper`) | 집 몸채·담·소품·줄기 |
| `C` | 걸음 | 항상 사람 위(★, `upper`) | 처마 끝·나무 수관·문루 보 — 아래 칸의 땅이 통행을 정한다 |
| `F` | 걸음 | 땅 바로 위·사람 아래(`lower`) | 문 앞 디딤돌·다리 상판·선착장·성문 통로·그림자 |
| `.` | — | — | 그림 없음(-1, 찍는 자리의 땅을 그대로 둔다) |"""
cats = []
docs_md = []   # (파일명, 내용)


def add_doc(docs, did, name, md):
    docs.append(dict(id=f"{PFX}{did}", name=name, markdown=md))
    docs_md.append((f"{did}.md", md))


placed = EXTRA["placed"]
doors = EXTRA["doors"]
GKIND = EXTRA["groundKind"]
walkgrid = MAPJ["walk"]


def cell_walk(lo, upv):
    """엔진 규칙(collision.ts)을 그대로: 윗층이 ★ 가 아니고 정보가 있으면 윗층이 정하고, 아니면 아래층."""
    if upv is not None and upv >= 0 and not (PASS[upv] and PRI[upv] == "upper"):
        return PASS[upv]
    return PASS[lo] if lo is not None and lo >= 0 else False


def bfs(walk_fn, start):
    seen = {start}; q = collections.deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in seen or not (0 <= n[0] < W and 0 <= n[1] < H) or not walk_fn(*n):
                continue
            seen.add(n); q.append(n)
    return seen


# ============================================================ 1. 한 장 조립
docs, images = [], []
village_img = draw(LOWER, UPPER, W, H)
images.append(save("village-overview", village_img, f"마을 20호 {W}×{H}(시트 칸 번호만으로 다시 조립한 그림, 화소 0 차이). 이 그림이 목표 완성본이다. 820px 로 줄임."))
walk_img = tint_overlay(village_img, ["".join("X" if walkgrid[y][x] == "0" else "." for x in range(W)) for y in range(H)], W, H, 110)
images.append(save("village-walk", walk_img, "같은 마을의 칸 통행: 빨강 = 못 걷는 칸(엔진 isPassable 이 거짓). 물·논·집 몸채·나무 밑동·담이 빨강이고 문 앞 디딤돌·다리 갑판·성문 통로는 열려 있다."))
ms = STATS["maps"][args.map_id]
guide = f"""# 조선 — 한 장 조립 (읽는 순서 · 작업 순서 · 통행)

{HEAD}

조선(바람의나라풍) 칩셋은 손 도트 조각 **{STATS['pieces']}종**(집·정자·성문·궁궐·나무·담·소품)과 땅 오토타일 **{STATS['autotileGroups']}종**(흙길·마당·강/연못·빈 논·모 논 등)을 한 장에 담았다.
**원본 마을 20호(정본 맵 `{args.map_id}`)는 이 시트로 만든 한 가지 예시일 뿐 정답 좌표가 아니다.** 같은 조각으로 다른 마을을 짓는 것이 이 문서의 목적이다.
계열은 `{TS['family']}` — 버들항(`oprn-atlas`)·숲마을 칸 번호와 섞어 쓰지 않는다(맵의 타일셋을 바꾸려면 사용자 승인이 필요하다).

## 읽는 순서
1. 이 문서 → 「마을 배치 규칙」(길 위계·집 줄·문 앞) → 「조립 예제」(양반댁 둘레·집 줄·건널목·강과 논의 칸 배열과 완성 그림).
2. 「땅 오토타일」: 흙길·마당·강·논은 칠하면 가장자리가 저절로 맞는다. 번호를 한 칸씩 고르지 않는다.
3. 「건물 조각 사전」「나무·소품·담·다리 조각 사전」: 조각마다 크기·칸 배열·칸 통행·문 칸.
4. 「오류 교훈」: 실제로 변조한 오류 그림과 검출 코드·좌표.

## 칸 통행 기호 (모든 조각 사전의 `walk` 격자가 이 기호다)
{WALKTXT}

엔진 판정(`src/project/collision.ts`): 칸의 통행은 맨 위 층부터 — ★(통행 가능 + priority upper)를 건너뛰고 처음 만난 칸이 정한다. 그래서
**수관(C) 밑 땅이 길이면 걷고, 물이면 못 걷는다.** 다리 갑판(F)은 아래 물(막힘)을 덮어 걸을 수 있다. `X` 는 어떤 땅 위에서도 막힌다.

## 도구 (조수가 실제로 쓰는 길)
- 새 맵: `create_map({{tilesetId:'{TID}', width:64, height:56}})`.
- 땅: 풀 `fill_region(…, material:'조선 풀')`(변형 4종이 섞인 평면), 길 `lay_path/fill_region(… material:'조선 흙길')`, 마당 `조선 마당`, 강·연못 `조선 강·연못`,
  논 `조선 모 논`(또는 `조선 빈 논`), 판석 `조선 판석`, 밭 `조선 밭이랑`. 길·마당·강·논은 **오토타일**이다.
- 건물·나무·담·소품: `stamp_object({{objectId:'kit:{TID}/{PFX}<조각 이름>', mapId, x, y}})` — x,y = 조각 왼쪽 위 칸. 조각 이름은 아래 사전의 `kit` 값.
  **조각은 윗층 그림만이다.** 아래층(-1)은 찍는 자리의 땅을 그대로 둔다.
- 검사: `check_reachability` 로 문 앞 칸·성문 통로·다리 건너편이 닿는지, `show_map_region` 으로 눈 확인.

## 작업 순서 (새 마을)
1. **땅 → 물 → 길 → 마당 → 논·밭**: 풀로 채우고, 강(폭 4~5, 위·아래 맵 가장자리를 가로지름)과 연못을 칠한 뒤 큰길·안길을 깔고, 문 앞 마당을 만든다.
2. **큰길 위에서 강을 건너는 자리마다 다리**(`{PFX}bridge` 5×4: 위 1줄 난간, 가운데 2줄 갑판 = 큰길 2줄과 같은 행, 아래 1줄 비움). 다리를 찍고 양쪽 길을 이어 준다.
3. **건물**: 집 문(아래 한 줄의 디딤돌 칸)이 길 쪽을 보게 놓는다. 집 y = 문 앞 길 y − 집 높이. 문 앞 한 칸(조각 바로 아래)은 비워 길·마당과 잇는다.
4. **담·마당 둘레**: 담 조각을 이어 붙이고 모서리 4종을 맞춘 뒤 대문(`gate_solseul`, 통로 2칸)을 담 사이에 낀다.
5. **나무·소품**: 길·문 앞 1칸 밖에, 같은 나무를 6칸 안에 두 번 두지 않는다. 장독대·평상·우물은 집 곁, 갈대·바위는 물가.
6. 검사 → 고침 → 다시 검사.

## 반복할 수 있는 조각 · 고정 조각
| 반복 | 고정 |
|---|---|
| 땅 평면 변형(풀 4·마당 2·판석 2·밭 2): 섞어 깐다 | 집·누각·성문·궁궐(한 번에 한 채, 늘리지 않는다) |
| 오토타일(길·마당·강·논): 칠한 모양대로 | 다리·선착장·물레방아·나룻배(자리마다 하나) |
| 담 가로 `wall_h/_h1/_h2`(1×2)·세로 `wall_v`: 번갈아 이어 붙인다 | 담 모서리 4종(NW·NE·SW·SE)·성벽 끝 |
| 나무·덤불(같은 그림은 6칸 밖) | 사립문·솟을대문·홍살문 |

## 문 · 디딤돌 · 문 앞 접근칸 · 이벤트 (섞지 않는다)
- **문 그림**: 집 아래 두 줄(벽·문) — 막힘(`X`).
- **디딤돌 칸**: 맨 아래 줄의 계단 그림 칸 — 걸음(`F`). 조립 부품 `parts.door`(kind `entrance`)가 이 칸이다.
- **문 앞 접근칸**: 조각 바로 아래 한 칸 — 길·마당(땅). 맵 `doors[]` 가 이 칸을 기록하고 도달 검사가 이 칸에서 디딤돌로 올라선다.
- **통로**: 성문류(`gate_solseul`·`gate_pyeong`·`palace_gate_4`·`fort_gate`·`gungnae_gate_*`)는 아치 열 전부가 `F`(위쪽 같은 열은 `C`) — 걸어서 반대편으로 나간다(`parts.passage`).
- **이벤트**: 이 칩셋에는 실내 맵이 없다. 문 이동·상호작용 이벤트는 만들지 않는다(주민 NPC 20명만). 문 이동이 필요하면 조수가 실내 맵을 따로 만들고 디딤돌 칸에 이벤트를 심는다.

## 통행·구조 검사의 범위 (item 7)
저장 스크립트(`scripts/content/save-joseon-baram.mjs`)가 **구조·통행만** 센다: 엔진 `isPassable` 대 구운 정답 {W * H}칸 불일치 0, 문 앞·디딤돌·성문 통로·주민 칸 도달, 오토타일 마스크 대 엔진.
이벤트 실행·미적 품질·저가 모델의 성공률은 이 검사로 주장하지 않는다. 저장 전에 검사가 실패하면 부분 배치를 남기지 않는다(도구가 되돌린다).

## 금지
- 원본 마을을 그대로 옮겨 깔지 않는다(요청이 「다른 마을」이면 실패다).
- 칸 번호를 추측해 한 칸씩 칠하지 않는다. 땅은 재료 이름, 조각은 키트로.
- 건물·큰 나무를 물·논 위에 찍지 않는다. 문 앞 한 칸에 소품·나무를 두지 않는다. 키트의 -1 칸을 다른 땅으로 덮으려 하지 않는다.
- 수관 조각의 윗부분 칸을 아래층(lowerTiles)에 칠하지 않는다 — 투명 부분이 검게 빈다(오류 교훈 그림).
"""
add_doc(docs, "guide", "조선 한 장 조립 · 읽는 순서", guide)
rules = f"""# 마을 배치 규칙 — 길 위계 · 집 줄 · 문 앞 · 다리 · 물 · 나무

{HEAD}

## 1. 길 위계 (마을 20호 실측)
- **큰길** 폭 2칸(동서, 구간마다 한 행씩 어긋나 직선이 되지 않는다) → **안길** 폭 1~2칸(큰길에서 갈라져 북쪽으로, 직선 구간을 꺾어 이음) → **샛길** 폭 1칸(막다른, 집 한두 채 전용).
- 모든 길의 끝은 **교차로·마당·문 앞·맵 가장자리** 중 하나다. 풀밭에서 끝나면 결함이다.
- 문 앞 **꼬리길**: 집 문 앞 한 칸에서 가장 가까운 길 칸까지 마당(`조선 마당`)으로 잇는다(문 앞 3칸 + 길까지).
- 길은 `fill_region/lay_path` 오토타일로 깔면 가장자리가 저절로 맞는다. 직접 번호를 고르지 않는다.

## 2. 집 줄
- 집은 길 북쪽 면에 놓는다(문이 아래). 집 y = 문 앞 길 y − 집 높이(6줄이면 길 y − 6). 지붕 좌우 처마 한 칸씩이 옆 칸 위로 나온다(`C` — 걸을 수 있다).
- 같은 줄 두 채는 꼬리길을 공유할 수 있되 지붕 종류(기와·초가)를 다르게 한다. 기와집은 양반댁·관아, 초가는 평민 집, 주막·대장간·방앗간은 큰길 남쪽.
- 집 한 채마다 곁살림(장독대·낟가리·항아리)과 마당 앞 낮은 담(토담·죽벽, 돌기와담은 기와집)을 두되 문 앞 3칸은 비운다.
- 최소 간격: 집과 집은 1칸 이상 띄우거나 담을 맞댄다. 건물 겹침 0.

## 3. 양반댁(담 둘레)
- 토석담 네 변(가로 `wall_h/_h1/_h2` 번갈아·세로 `wall_v`·`wall_v_e` 서·동)과 모서리 4종, 남쪽 가운데는 솟을대문(`gate_solseul` 통로 2칸). 담 안은 다진 흙 마당.
- 안채·사랑채·곳간을 마당에 배치하고 우물·장독대·정원수를 둔다. 자세한 칸 배열은 「조립 예제」.

## 4. 다리·물
- 강은 폭 4~5칸, 구간마다 둑이 한 칸씩 흔들려 곧지 않다. 다리 구간은 둑을 맞춰 둔다. 다리(`{PFX}bridge` 5×4)는 큰길 2줄 = 갑판 2줄과 같은 행.
- 연못은 가로로 두 칸씩 밀리는 둥근 윤곽(블롭 47종이 둥글게 만든다). 도랑은 연못→논, 강→밭.
- 갈대·바위는 물가 한 칸 안쪽, 선착장(`dock` 1×2)은 샛길 끝에서 물로, 배는 물 위 한 척.

## 5. 나무·덤불·밭
- 숲띠(뒷산)는 맵 위 가장자리 밖으로 걸치게(y=-4~-5), 맵 안은 군락으로 묶는다. 과수원(감나무)은 엇갈려 줄지어, 마을 가장자리 덤불·어린 나무.
- 같은 나무 그림을 6칸 안에 둘 이상 두지 않는다(M4). 수관 높이 종류 3개 이상(3·4·5칸).
- 밭이랑·논은 직사각형으로 크게. 맨 잔디 창(게임 한 화면 20×15칸) 비율 ≤ 0.33.

## 6. 마을 20호 게이트 실측 (지도 게이트 `JS_PROFILE=village20`)
맨 잔디 창 최대 0.31 · 맨 잔디 전체 0.20 · 수관 피복 0.095 · 물체 피복 0.285 · 같은 나무 반복 쌍 0 · 건물 22채(밀도 0.0061/칸) · 나무 키 종류 3 · 앞뒤로 겹친 쌍 53.
(이 수치는 마을 20호가 통과한 값이지 새 마을의 하한이 아니다. 새 마을은 칸 수·성격이 다르면 비율을 직접 잰다.)

## 7. 통행 실측 (이 마을)
걸을 수 있는 칸 {ms['walkable']}/{W * H}. 시작 칸 {ms['start']}(큰길)에서 문 앞 {ms['doors']}곳·디딤돌·성문 통로·주민 {ms['people']}명 칸이 모두 걸어서 닿는다(엔진 canMove 너비 우선 탐색).
"""
add_doc(docs, "village-rules", "마을 배치 규칙", rules)
cats.append(dict(id="joseon-baram-guide", name="조선 · 한 장 조립(읽는 순서·작업 순서·통행) — 먼저 읽는다",
                 description="조선(바람의나라풍) 칩셋으로 마을을 짓는 순서, 칸 통행 기호(X/C/F), 문·디딤돌·접근칸 구분, 검사 범위. 마을 20호 완성 그림과 통행 그림.",
                 documents=docs, images=images))

# ============================================================ 2. 땅 오토타일
docs, images = [], []
rows_t = []
for a in TS["autotileGroups"]:
    mem = a["memberTileIds"]
    kind = "블롭 47×변형" if len(mem) % 47 == 0 and len(mem) >= 47 else "마스크 16"
    rows_t.append(f"| `{a['id']}` | {a['name']} | {kind} | {mem[0]}~{mem[-1]} ({len(mem)}칸) | {'맵 밖 = 이어짐' if a.get('edgeConnects') else '맵 가장자리 = 가장자리 모양'} | {len(a['connectTileIds'])}칸 |")
flat_rows = []
for g in TS["tileGroups"]:
    if g["id"].startswith("jb:") and g["defaultLayer"] == "lower" and "오토타일" not in g["name"]:
        flat_rows.append(f"| `{g['id']}` | {g['name']} | {g['tileIds'][0]}~{g['tileIds'][-1]} ({len(g['tileIds'])}칸) |")
exp_lines = "\n".join(f"- **{gid}**: {v['max']}칸 이내 — {v['why']}" for gid, v in EXPECT.items())
auto_md = f"""# 땅 오토타일 — 흙길·마당·강/연못·논 (마스크 비트와 변형 표)

{HEAD}

## 비트 정의 (엔진 `AUTOTILE_DIR` 와 같다 — 번호 재배열이 필요 없다)
`N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128`. 값 = **그 방향 이웃이 같은 재료(이어짐)**. 이어지지 않는 변이 가장자리·둑이 된다.
모든 그룹은 `neighborhood: 8` 이고 `variantMap` 은 마스크 0~255 → 칸 번호다.
- **마스크 16**(흙길·마당·논): 그림은 4변만 보므로 **하위 4비트**(`mask & 15`)로 정한다. 칸 번호 = 묶음 첫 칸 + (mask & 15).
- **블롭 47**(강·연못): 한 칸을 네 사분면(8×8)으로 나누고 사분면마다 (옆 변·위/아래 변·모서리) 세 이웃만 본다. 모서리 비트는 양쪽 변이 모두 물일 때만 의미가 있다
  (`canon(m)` = 하위 4비트 + 양쪽 변이 모두 켜진 대각 비트) → 서로 다른 값 **47종**. 칸 번호 = 묶음 첫 칸 + 순번(canon 값 오름차순). 변형 2는 같은 모양의 물결 차이(+47)이고 엔진은 변형 0 으로 칠한다.

## 그룹 표
| 그룹 id | 이름 | 종류 | 멤버 칸 번호 | 맵 가장자리 | 이웃으로 세는 칸 |
|---|---|---|---|---|---|
{chr(10).join(rows_t)}

평면 바닥(오토타일 아님, 여러 변형을 섞어 깐다):
| 묶음 | 이름 | 칸 |
|---|---|---|
{chr(10).join(flat_rows)}

## 재료별 규칙
- **흙길(`jb_road16_autotile`)**: 맵 밖을 이어짐으로 본다 → 맵 가장자리에서 끝나는 길은 끝막음이 안 생긴다. 폭 1~2칸. 다리 갑판·마당과 닿는 쪽도 이어진다.
- **마당(`jb_yard16_autotile`)**: 마당 + 흙길을 이웃으로 센다(길과 마당이 자연스럽게 이어진다). 맵 가장자리는 가장자리 모양.
- **강·연못(`jb_water47_autotile`)**: 지나갈 수 없다. 강은 맵 위·아래 가장자리를 가로지르므로 가장자리 밖을 물로 본다(`edgeConnects`). 연못이 맵 왼쪽 끝(x=0)에 닿으면 구운 마스크와 엔진 마스크가 한 칸 어긋날 수 있다 — 연못은 x≥1 에 둔다.
- **논(`jb_rice16_autotile` 모 논 / `jb_paddy16_autotile` 빈 논)**: 지나갈 수 없다(물 댄 논). 논두렁 길은 마당 칸으로 이미 깔려 있다. 칠한 직사각형 둘레에 둑(가장자리)이 붙는다.
- **밭이랑**(평면 2변형)·**풀**(평면 4변형)·**판석**(평면 2변형)은 걸을 수 있다.

## 알려진 마스크 불일치 (구운 마을 20호, 엔진 대조 결과)
{exp_lines}
나머지 그룹(강·논)은 불일치 0 이다. 붓으로 건드리면 그 칸만 엔진 규칙으로 다시 계산된다.
"""
add_doc(docs, "autotile", "땅 오토타일 · 마스크와 변형", auto_md)


def grid_image(tiles, cols, labels=None, zoom=3):
    rows = -(-len(tiles) // cols)
    im = Image.new("RGBA", (cols * (T * zoom + 2), rows * (T * zoom + 12)), (46, 46, 54, 255))
    d = ImageDraw.Draw(im)
    for i, t in enumerate(tiles):
        x, y = (i % cols) * (T * zoom + 2), (i // cols) * (T * zoom + 12)
        im.alpha_composite(up(tile(t), zoom), (x, y + 10))
        d.text((x + 1, y), (labels[i] if labels else str(t)), fill=(255, 255, 255, 255))
    return im


for aid in ("jb_road16_autotile", "jb_yard16_autotile", "jb_rice16_autotile"):
    a = AT.get(aid)
    if not a:
        continue
    tiles = [a["variantMap"][str(m)] for m in range(16)]
    images.append(save(f"at-{aid.split('_')[1]}", grid_image(tiles, 8, [f"m{m}" for m in range(16)]),
                       f"`{aid}` ({a['name']}) 마스크 16변형 — 위 글자 = 마스크(N=1 E=2 S=4 W=8, 이어진 방향의 합). m15 = 사방이 이어진 몸통, m0 = 외딴 한 칸."))
wa = AT.get("jb_water47_autotile")
if wa:
    tl, lab = [], []
    for m in range(256):
        t = wa["variantMap"][str(m)]
        if t not in tl:
            tl.append(t); lab.append(f"{m}")
    images.append(save("at-water47", grid_image(tl, 8, lab, 2),
                       "`jb_water47_autotile` 블롭 47종 — 위 글자 = 그 칸을 고르는 대표 마스크(8비트). 둑·물가·깊은 물이 이웃에 따라 둥글게 이어진다."))
add_doc(docs, "autotile-howto", "오토타일 칠하는 법", f"""# 오토타일 칠하는 법과 검사

{HEAD}

1. 칠하는 도구는 `fill_region`/`lay_path` — 재료 이름(`조선 흙길`·`조선 마당`·`조선 강·연못`·`조선 모 논`)을 준다. 도구가 마스크를 계산해 가장자리를 맞춘다.
2. 한 칸만 지울 때 둘레 칸도 다시 계산된다(8방향 그룹은 대각 이웃까지). 칠한 뒤 `show_map_region` 으로 가장자리를 눈으로 본다.
3. 같은 재료끼리만 이어진다. 흙길 옆에 마당을 칠하면 마당 칸이 길과 이어진 모양이 된다(마당 그룹이 길을 이웃으로 센다).
4. 오류의 모양은 「오류 교훈」의 **반대 방향 둑**(마스크 불일치) 그림 — 검출 코드 `autotile-mask-mismatch`.

## 마스크 → 칸 번호 (손으로 계산하지 않는다 — 검증용)
흙길 `{AT['jb_road16_autotile']['memberTileIds'][0]} + (mask & 15)`, 마당 `{AT['jb_yard16_autotile']['memberTileIds'][0]} + (mask & 15)`, 모 논 `{AT['jb_rice16_autotile']['memberTileIds'][0]} + (mask & 15)`,
강·연못: `canon(mask)` 를 오름차순 47종 순번으로 바꿔 `{AT['jb_water47_autotile']['memberTileIds'][0]} + 순번`.
""")
cats.append(dict(id="joseon-baram-terrain", name="조선 · 땅 오토타일(흙길·마당·강/연못·논)",
                 description="마스크 비트(N1 E2 S4 W8 …), 16변형·블롭 47종 그림, variantMap 규칙, 재료별 규칙, 알려진 마스크 불일치.",
                 documents=docs, images=images))


# ============================================================ 3·4. 조각 사전
def piece_entry(name):
    k = KITS[PFX + name]
    w, h = k["width"], k["height"]
    entry = {"kit": f"kit:{TID}/{PFX}{name}", "w": w, "h": h, "class": PW[name]["cls"],
             "upperTiles": [r["upperTiles"] for r in k["rows"]], "walk": PW[name]["rows"]}
    for p in k.get("parts", []):
        entry[p["id"]] = {"dx": p["dx"], "dy": p["dy"], "w": p["w"], "h": p["h"]}
    return entry


def piece_docs(names, did_prefix, title, intro, per_doc=14):
    out = []
    total = -(-len(names) // per_doc)
    for n0 in range(0, len(names), per_doc):
        chunk = names[n0:n0 + per_doc]
        body = [f"# {title} {n0 // per_doc + 1}/{total}", "", HEAD, "", intro, "",
                "`upperTiles` = 윗층 칸 번호(행 위→아래, -1 = 그림 없음), `walk` = 칸 통행(X 막힘 / C 걸음★ / F 걸음 / . 없음). 아래층은 -1(찍는 자리의 땅을 그대로 둔다). "
                "`door` = 디딤돌 칸(문 앞 접근칸은 그 바로 아래 칸), `passage` = 통로 열 범위.", ""]
        for n in chunk:
            k = KITS[PFX + n]
            cnt = collections.Counter("".join(PW[n]["rows"]))
            body += [f"### {PFX}{n} · {ko(n)} · {k['width']}×{k['height']} · 분류 {PW[n]['cls']}",
                     f"막힘 {cnt['X']} · 걸음★ {cnt['C']} · 걸음 {cnt['F']}칸. {k['ai']['placementRules']}", "```json",
                     json.dumps(piece_entry(n), ensure_ascii=False, separators=(",", ":")), "```", ""]
        add_doc(out, f"{did_prefix}-{n0 // per_doc + 1}", f"{title} {n0 // per_doc + 1}", "\n".join(body))
    return out


def piece_images(names, prefix, caption, per_sheet=24):
    out = []
    for n0 in range(0, len(names), per_sheet):
        chunk = names[n0:n0 + per_sheet]
        zoom = 2 if max(KITS[PFX + n]["width"] for n in chunk) <= 8 else 1
        out.append(save(f"{prefix}-{n0 // per_sheet + 1}", sheet_of(chunk, 800, zoom),
                        f"{caption} {n0 // per_sheet + 1}. 칸 통행 색: 빨강 X 막힘 · 파랑 C 걸음★(사람 위) · 초록 F 걸음. 이름표는 조각 이름(kit id 는 `{PFX}` 를 붙인다)."))
    return out


by_cls = collections.defaultdict(list)
for n, v in PW.items():
    by_cls[v["cls"]].append(n)
built = sorted(by_cls["built"], key=lambda n: (n.startswith(("gn_", "palace", "tower", "gungnae")), n))
docs = piece_docs(built, "pieces-built", "건물 조각 사전", "집·관아·정자·성문·궁궐·누각. **문은 맨 아래 줄 디딤돌 칸**이고 집 y = 문 앞 길 y − 집 높이. 지붕 좌우 처마 열은 `C`(걸을 수 있다).")
imgs = piece_images(built, "pieces-built", "건물 조각 통행 그림")
cats.append(dict(id="joseon-baram-buildings", name="조선 · 건물 조각 사전(칸 배열·통행·문 칸)",
                 description=f"집·관아·정자·성문·궁궐 {len(built)}종의 크기·윗층 칸 배열·칸 통행 격자·문 디딤돌/통로 좌표와 통행 그림.", documents=docs, images=imgs))
RANK = {"tree": 0, "bush": 1, "sapling": 2, "tuft": 3, "wall": 4, "prop": 5}
others = sorted([n for n, v in PW.items() if v["cls"] != "built"], key=lambda n: (RANK.get(PW[n]["cls"], 9), n))
docs = piece_docs(others, "pieces-props", "나무·소품·담·다리 조각 사전", "나무(수관 `C` 위·줄기 `X` 아래), 덤불, 담·성벽(전부 `X`), 소품(`X`), 다리·선착장·돌계단·징검돌·성문 통로(`F`).", per_doc=22)
imgs = piece_images(others, "pieces-props", "나무·소품·담·다리 조각 통행 그림", per_sheet=40)
cats.append(dict(id="joseon-baram-props", name="조선 · 나무·소품·담·다리 조각 사전",
                 description=f"나무·덤불·담·성벽·소품·다리 {len(others)}종의 칸 배열·통행 격자와 통행 그림.", documents=docs, images=imgs))

# ============================================================ 5. 조립 예제
docs, images = [], []


def array_text(vals, w):
    return "\n".join(" ".join(f"{v:5d}" for v in vals[r * w:(r + 1) * w]) for r in range(len(vals) // w))


def example(did, title, x0, y0, x1, y1, what, steps, zoom=2):
    lo, upv = region(x0, y0, x1, y1)
    w, h = x1 - x0, y1 - y0
    im = draw(lo, upv, w, h)
    images.append(save(f"ex-{did}", up(im, zoom), f"조립 예제 「{title}」 맵 칸 ({x0},{y0})~({x1 - 1},{y1 - 1}) {w}×{h} — 아래 두 배열을 그대로 찍은 완성 그림(원본 해상도의 {zoom}배, nearest)."))
    sym = {"grass": ".", "road": "r", "yard": "y", "water": "w", "paddy": "p", "field": "f", "paving": "s"}
    gk = "\n".join("".join(sym.get(GKIND[y][x], "?") if 0 <= y < H and 0 <= x < W else " " for x in range(x0, x1)) for y in range(y0, y1))
    pcs = [p for p in placed if p["x"] < x1 and p["x"] + p["w"] > x0 and p["y"] < y1 and p["y"] + p["h"] > y0]
    plist = "\n".join(f"- `{p['name']}` {p['w']}×{p['h']} 왼쪽 위 ({p['x']},{p['y']})" for p in pcs[:45])
    md = f"""# 조립 예제 — {title}

{HEAD}

{what}

## 입력 → 정답 배열 → 완성 그림
맵 칸 ({x0},{y0}) 부터 {w}×{h}칸. 맵 id `{args.map_id}`(정본 맵, 저장·재로드 증거 `tiledata/joseon-village/storage-proof.json`).

**아래층(lowerTiles)** — 땅(풀·길·마당·물·논) 칸 번호, 행 위→아래:
```
{array_text(lo, w)}
```
**윗층(upperTiles)** — 조각 그림 칸 번호(-1 = 비움):
```
{array_text(upv, w)}
```
**땅 종류**(`.` 풀 · `r` 길 · `y` 마당 · `w` 물 · `p` 논 · `f` 밭 · `s` 판석):
```
{gk}
```
**놓은 조각**(찍은 순서, 왼쪽 위 칸, 이 구획에 걸친 것):
{plist}

## 실행 순서
{steps}
"""
    add_doc(docs, f"ex-{did}", f"조립 예제 · {title}", md)


example("manor", "양반댁 둘레(담·솟을대문·채)", 7, 0, 28, 25,
        "토석담 네 변 + 모서리 4종 + 남쪽 솟을대문(통로 2칸) + 안채·사랑채·곳간과 마당. 마을 20호의 가장 복잡한 한 구획이다.",
        "1. 땅: 풀 → 담 안쪽 직사각형(담 x 9~25, y 3~21 안)에서 건물 둘레를 `조선 마당` 으로 → 큰길·안길.\n2. 담: 위 변 `wall_h/_h1/_h2` 를 x=9..25 에 번갈아, 아래 변은 대문 양옆만 / 서·동 변은 `wall_v`·`wall_v_e` 를 y=3..21 에 / 모서리 NW(8,1)·NE(26,1)·SW(8,22)·SE(26,22).\n"
        "3. 대문 `gate_solseul`(10×7)을 남쪽 담 가운데(12,17)에(남쪽 담은 y=22 이므로 대문 아래 두 줄이 담 선과 겹친다) — 통로 열 4·5(조각 안)가 담 밖과 마당을 잇는다.\n4. 채: `giwa_house_6`(13,4) 안채, `giwa_numa`(9,11) 사랑채, `thatch_gotgan`(21,9) 곳간, `pine_c`(10,6)·`persimmon_a`(22,17) 나무 — 문 앞 한 칸을 비운다.\n5. 소품: 우물·장독대·굴뚝·평상·화단과 정원수. 검사: 대문 통로 → 마당 도달.")
example("row", "집 줄과 문 앞 꼬리길", 30, 0, 64, 29,
        "안길 동쪽 집 줄: 지붕 종류가 다른 초가·기와가 번갈아, 문 앞 3칸 + 길까지 마당, 곁살림과 낮은 담.",
        "1. 동쪽 안길(x 46~48 부근, 남북으로 꺾이며)을 `lay_path` 로 깐다. 2. 집을 놓는다: 집 y = 문 앞 길 y − 집 높이(`thatch_house_4k`(49,1)·`giwa_house_4`(50,8)·`thatch_house_5`(49,15)·`giwa_seodang`(50,22); 서쪽 줄 `thatch_house_4`(33,3)·`giwa_house_5b`(32,10)·`thatch_hut_2`(34,17)). 3. 문 앞: 문 열(디딤돌 칸) 아래 한 칸 + 좌우 한 칸(3칸)을 `조선 마당` 으로 칠하고 길까지 이어 칠한다.\n"
        "4. 곁살림(`jars`(56,12)(61,5)·`haystack`(61,19)·`scarecrow`(58,11))은 집 옆 1칸 밖에. 5. 문 앞 3칸에는 아무것도 두지 않는다. 검사: 모든 문 앞 칸·디딤돌이 안길에서 걸어 닿는다.")
example("bridge", "큰길을 건너는 다리 두 개", 34, 20, 52, 34,
        "강(폭 4~5) 위 다리 두 개(위 (40,24), 아래 (40,27)): 각각 길 2줄 = 갑판 2줄. 다리 양끝 길 칸은 갑판으로 이어지고, 강가에 빨래터·평상·우물·느티나무가 선다.",
        "1. 강을 `조선 강·연못` 으로 칠한다(위·아래 맵 가장자리를 가로지름). 2. 길 2줄(위 다리 y 25~26, 아래 다리 y 28~29)을 양쪽 둑까지 칠한다. 3. 다리 `bridge`(5×4)를 왼쪽 위 (40,27) — 갑판 2줄(조각 안 1·2줄)이 큰길 2줄과 같은 행.\n"
        "4. 위쪽 다리 (40,24) 도 같은 방식, 강가 소품은 `laundry`(38,25)·`pyeongsang`(35,26)·`well`(32,25)·`zelkova_c`(37,20). 5. 검사: 서쪽 둑 → 동쪽 둑이 갑판으로 걸어 닿는다(갑판 `F` 가 아래 물을 덮는다).")
example("water", "연못·도랑·논·선착장", 0, 33, 24, 55,
        "연못(블롭 윤곽)과 그 위 도랑, 논 네 구획(5×5 모 논)과 논두렁 마당, 샛길 끝 선착장과 배, 기슭의 갈대·바위, 과수원.",
        "1. 연못: 가로로 두 칸씩 밀리는 윤곽을 `조선 강·연못` 으로. 2. 도랑: y=39 한 줄(x 9~21)을 같은 재료로 — 연못과 이어진다. 3. 논 네 구획(5×5: x 10~14·16~20 × y 34~38·40~44)을 `조선 모 논` 직사각형으로 — 사이 한 칸은 풀(논두렁).\n4. 선착장 `dock` 두 개를 (8,39)(8,41) 물가에, `boat`(5,44) 한 척. 5. 갈대 `reeds`(3,52)(7,53)·바위 `rocks`(5,54)는 남쪽 기슭에, 감나무 `persimmon_*` 과수원은 논 아래(10~22, 48~52).")
cats.append(dict(id="joseon-baram-examples", name="조선 · 조립 예제(양반댁 둘레·집 줄·다리·연못과 논)",
                 description="정본 마을 20호의 네 구획을 입력(좌표)→전체 아래·윗층 정답 배열→원본 해상도 완성 그림으로 연결하고 실행 순서를 적었다.",
                 documents=docs, images=images))

# ============================================================ 6. 오류 교훈(실제 변조 + 검출)
docs, images = [], []
START = tuple(MAPJ["start"])
TERRAIN_TILES = set(t for g in TS["tileGroups"] if g["id"].startswith("jb:") and g["defaultLayer"] == "lower" for t in g["tileIds"])
TERRAIN_TILES |= set(t for a in TS["autotileGroups"] for t in a["memberTileIds"])


def walk_fn_for(lo, upl):
    return lambda x, y: cell_walk(lo[y * W + x], upl[y * W + x])


def detect(lo, upl):
    """저작 검사 세 가지(구조·통행 범위): 반환 [(코드, x, y, 설명)]."""
    out = []
    wf = walk_fn_for(lo, upl)
    seen = bfs(wf, START)
    for d in doors:
        if (d["x"], d["y"]) not in seen:
            out.append(("door-unreachable", d["x"], d["y"], f"{d['piece']} 문 앞 칸에 닿지 못한다"))
    for i, t in enumerate(lo):
        if t not in TERRAIN_TILES:
            out.append(("object-tile-in-lower-layer", i % W, i // W, f"아래층 칸 {t} 은 지형 묶음이 아니다(윗층 그림이 아래층에 칠해짐)"))
    for p in placed:
        if p["name"] == "bridge" or p["name"].startswith("gungnae_bridge"):
            for j in range(p["h"]):
                for i in range(p["w"]):
                    if PW[p["name"]]["rows"][j][i] == "F" and not wf(p["x"] + i, p["y"] + j):
                        out.append(("bridge-blocked", p["x"] + i, p["y"] + j, f"{p['name']} 갑판 칸이 막혔다"))
    return out


def mask_of(group, lo, x, y):
    conn = set(group["connectTileIds"])
    m = 0
    for bit, dx, dy in ((1, 0, -1), (2, 1, 0), (4, 0, 1), (8, -1, 0), (16, 1, -1), (32, 1, 1), (64, -1, 1), (128, -1, -1)):
        X, Y = x + dx, y + dy
        if not (0 <= X < W and 0 <= Y < H):
            if group.get("edgeConnects"):
                m |= bit
        elif lo[Y * W + X] in conn:
            m |= bit
    return m


def mask_mismatches(lo):
    out = set()
    for gid, g in AT.items():
        mem = set(g["memberTileIds"]); eq = EQUIV[gid]
        for y in range(H):
            for x in range(W):
                t = lo[y * W + x]
                if t in mem:
                    v = g["variantMap"][str(mask_of(g, lo, x, y))]
                    if eq.get(str(v), v) != eq.get(str(t), t):
                        out.add((gid, x, y))
    return out


BASE_MM = mask_mismatches(LOWER)
base_find = detect(LOWER, UPPER)
assert not base_find, f"정상 맵에서 검사가 걸린다: {base_find[:3]}"
tamper_log = dict(baseline=dict(findings=0, maskMismatchKnown={g: sum(1 for m in BASE_MM if m[0] == g) for g in AT}), cases=[])


def pair_image(bad_lo, bad_up, good_lo, good_up, x0, y0, x1, y1, zoom=3, mark=None):
    a = draw(*region(x0, y0, x1, y1, bad_lo, bad_up), x1 - x0, y1 - y0)
    b = draw(*region(x0, y0, x1, y1, good_lo, good_up), x1 - x0, y1 - y0)
    if mark:
        d = ImageDraw.Draw(a)
        for (mx, my) in mark:
            d.rectangle(((mx - x0) * T, (my - y0) * T, (mx - x0 + 1) * T - 1, (my - y0 + 1) * T - 1), outline=(255, 255, 0, 255), width=1)
    out = Image.new("RGBA", (a.width * 2 * zoom + 8, a.height * zoom), (255, 255, 255, 255))
    out.alpha_composite(up(a, zoom), (0, 0)); out.alpha_composite(up(b, zoom), (a.width * zoom + 8, 0))
    return out


def tile_ids_of(piece):
    return [t for r in KITS[PFX + piece]["rows"] for t in r["upperTiles"]]


# 1) 문 앞 막힘
d0 = next(d for d in doors if d["piece"] == "thatch_house_4")
rock = tile_ids_of("rocks")[0]
bad_up = list(UPPER); bad_up[d0["y"] * W + d0["x"]] = rock
f = detect(LOWER, bad_up)
assert any(c[0] == "door-unreachable" and (c[1], c[2]) == (d0["x"], d0["y"]) for c in f), f
images.append(save("err-door-blocked", pair_image(LOWER, bad_up, LOWER, UPPER, d0["x"] - 4, d0["y"] - 6, d0["x"] + 5, d0["y"] + 3, mark=[(d0["x"], d0["y"])]),
                   f"왼쪽 오류 · 오른쪽 정답. 초가 `thatch_house_4` 문 앞 칸 ({d0['x']},{d0['y']}) 에 바위(`rocks`)를 놓아 문 앞을 막았다. 검출: door-unreachable ({d0['x']},{d0['y']})."))
tamper_log["cases"].append(dict(code="door-unreachable", at=[d0["x"], d0["y"]], change="문 앞 칸에 rocks(막힘 1칸)를 윗층에 놓음", detected=[list(c[:3]) for c in f if c[0] == "door-unreachable"]))

# 2) 수관을 아래층에
tr = next(p for p in placed if p["name"].startswith("zelkova"))
bad_lo = list(LOWER); bad_up2 = list(UPPER)
moved = []
for j in range(2):
    for i in range(tr["w"]):
        x, y = tr["x"] + i, tr["y"] + j
        if 0 <= x < W and 0 <= y < H and UPPER[y * W + x] >= 0:
            bad_lo[y * W + x] = UPPER[y * W + x]; bad_up2[y * W + x] = -1; moved.append((x, y))
f = detect(bad_lo, bad_up2)
codes = [c for c in f if c[0] == "object-tile-in-lower-layer"]
assert len(codes) >= len(moved) > 0
images.append(save("err-canopy-lower", pair_image(bad_lo, bad_up2, LOWER, UPPER, tr["x"] - 2, max(0, tr["y"] - 1), tr["x"] + tr["w"] + 2, tr["y"] + tr["h"] + 1, mark=moved[:1]),
                   f"왼쪽 오류 · 오른쪽 정답. 느티나무 `{tr['name']}` ({tr['x']},{tr['y']}) 수관 위 두 줄을 아래층에 칠했다 → 투명 부분 밑에 땅이 없어 검게 비었다. 검출: object-tile-in-lower-layer {moved[0]} 외 {len(moved) - 1}칸."))
tamper_log["cases"].append(dict(code="object-tile-in-lower-layer", at=list(moved[0]), change=f"{tr['name']} 수관 {len(moved)}칸을 lowerTiles 에 칠함", detected=[list(c[:3]) for c in codes][:8], detectedCount=len(codes)))

# 3) 반대 방향 둑
wg = AT["jb_water47_autotile"]
wmem = set(wg["memberTileIds"])
cand = None
for y in range(5, H - 5):
    for x in range(1, W - 1):
        if LOWER[y * W + x] in wmem and LOWER[y * W + x - 1] not in wmem and LOWER[y * W + x + 1] in wmem:
            cand = (x, y); break
    if cand:
        break
cx, cy = cand
m = mask_of(wg, LOWER, cx, cy)
swapped = (m & ~(2 | 8 | 16 | 32 | 64 | 128)) | (2 if m & 8 else 0) | (8 if m & 2 else 0) | (16 if m & 128 else 0) | (128 if m & 16 else 0) | (32 if m & 64 else 0) | (64 if m & 32 else 0)
bad_lo3 = list(LOWER); bad_lo3[cy * W + cx] = wg["variantMap"][str(swapped)]
mm = mask_mismatches(bad_lo3) - BASE_MM
assert (wg["id"], cx, cy) in mm, (mm, cand)
images.append(save("err-bank-reversed", pair_image(bad_lo3, UPPER, LOWER, UPPER, cx - 4, cy - 4, cx + 5, cy + 5, mark=[(cx, cy)]),
                   f"왼쪽 오류 · 오른쪽 정답. 강 서쪽 둑 칸 ({cx},{cy}) 을 동쪽 둑 모양(마스크 {m}→{swapped})으로 바꿨다 → 둑이 반대편을 본다. 검출: autotile-mask-mismatch ({cx},{cy})."))
tamper_log["cases"].append(dict(code="autotile-mask-mismatch", at=[cx, cy], change=f"{wg['id']} 칸 마스크 {m} → {swapped}", detected=sorted([list(a) for a in mm])))

# 4) 다리 갑판 막힘
br = next(p for p in placed if p["name"] == "bridge")
bx, by = br["x"] + 2, br["y"] + 1
bad_up4 = list(UPPER); bad_up4[by * W + bx] = rock
f = detect(LOWER, bad_up4)
assert any(c[0] == "bridge-blocked" and (c[1], c[2]) == (bx, by) for c in f), f
images.append(save("err-bridge-blocked", pair_image(LOWER, bad_up4, LOWER, UPPER, br["x"] - 3, br["y"] - 1, br["x"] + br["w"] + 3, br["y"] + br["h"] + 1, mark=[(bx, by)]),
                   f"왼쪽 오류 · 오른쪽 정답. 큰 다리 갑판 ({bx},{by}) 에 바위를 놓았다. 검출: bridge-blocked ({bx},{by})."))
tamper_log["cases"].append(dict(code="bridge-blocked", at=[bx, by], change="다리 갑판 한 칸에 rocks", detected=[list(c[:3]) for c in f if c[0] == "bridge-blocked"]))
(DATA / "qa-tamper-checks.json").write_text(json.dumps(tamper_log, ensure_ascii=False, indent=1) + "\n")
tbl = "\n".join(f"| `{c['code']}` | ({c['at'][0]},{c['at'][1]}) | {c['change']} | {c['detected'][:3]} |" for c in tamper_log["cases"])
add_doc(docs, "qa-lessons", "오류 교훈 · 오류 그림(실제 변조)", f"""# 오류 교훈 — 실제로 변조한 오류 그림과 검출 기록

{HEAD}

아래 네 가지는 정본 마을 20호를 **실제로 변조**해 만든 그림이고, 검사 코드가 같은 좌표를 잡는다(`tiledata/joseon-village/qa-tamper-checks.json`).
정상 맵은 `door-unreachable`·`object-tile-in-lower-layer`·`bridge-blocked` 0 건, 마스크 불일치는 알려진 칸(「땅 오토타일」)뿐이다.

| 코드 | 맵 좌표 | 변조 | 검출 좌표(앞 3개) |
|---|---|---|---|
{tbl}

## 1. 문 앞 막힘 — `door-unreachable`
문 앞 한 칸(조각 바로 아래)에 소품·나무를 두면 디딤돌에 못 올라선다. 문 앞 3칸은 비운다. 검사: 시작 칸에서 모든 문 앞 칸까지 4방향 도달.
## 2. 수관을 아래층에 — `object-tile-in-lower-layer`
조각의 투명 부분이 있는 칸은 **윗층**에만 칠한다(키트로 찍으면 저절로 맞는다). 아래층에 칠하면 밑에 땅이 없어 검게 빈다. 검사: 아래층 칸이 지형 묶음 번호인가.
## 3. 반대 방향 둑 — `autotile-mask-mismatch`
오토타일 칸을 손으로 바꾸면 이웃과 둑 방향이 어긋난다. 칠하는 도구로 다시 칠하면 맞는다. 검사: 이웃 8칸으로 정한 변형과 실제 칸 비교(구운 알려진 불일치는 제외).
## 4. 다리 갑판 막힘 — `bridge-blocked`
갑판(`F`) 칸에 막힘 조각을 얹으면 강을 건널 수 없다. 갑판 칸은 모두 걸을 수 있어야 한다.

## 검사가 주장하는 것·주장하지 않는 것 (item 7)
이 네 검사는 **구조와 통행**만이다. 이벤트 실행, 미적 품질(자연스러움·밀도), 저가 모델 성공률은 구조 검사 통과로 대신 주장하지 않는다.
저장 전에 위 검사가 실패하면 부분 배치를 남기지 않는다.

## 기존 문서·칸 메타의 레이어 정정 (item 8)
조선 칩셋은 신규다 — 정정할 이전 문서·before/after 가 없다. 이 칩셋의 칸 메타(`tileMeta`)는 처음부터 투명 여부·홈 레이어(`defaultLayer`)·통행(`passage`)·렌더 우선순위(`priority`)를 따로 적는다:
조각 칸은 `defaultLayer: upper`, 통행 X=`solid`/C=`star`/F=`passable`, priority X·C=`upper`/F=`lower`. 땅 칸은 `lower`.
""")
cats.append(dict(id="joseon-baram-qa", name="조선 · 오류 교훈(실제 변조 그림 + 검출 코드·좌표)",
                 description="문 앞 막힘·수관 아래층·반대 방향 둑·다리 갑판 막힘을 실제로 변조한 오류/정답 그림과 검출 코드·맵 좌표. 검사 범위와 레이어 정정(신규).",
                 documents=docs, images=images))

# ============================================================ 쓰기
out = ROOT / "src/assets/joseonBaramReferences.json"
out.write_text(json.dumps(cats, ensure_ascii=False, separators=(",", ":")))
for old in MD.glob("*.md"):
    old.unlink()
for fn, md in docs_md:
    (MD / fn).write_text(md)
print(json.dumps(dict(categories=len(cats), documents=sum(len(c["documents"]) for c in cats), images=sum(len(c["images"]) for c in cats),
                      markdownChars=sum(len(m) for _, m in docs_md), maxDocChars=max(len(m) for _, m in docs_md), jsonBytes=out.stat().st_size,
                      pngBytes=sum(p.stat().st_size for p in IMG.glob("*.png"))), ensure_ascii=False))
