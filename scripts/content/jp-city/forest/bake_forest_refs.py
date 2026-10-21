#!/usr/bin/env python3
"""jp_city 숲 참고문서(용도 jp-forest) 굽기 — 번들이 소유한다(AI-REFERENCE-CONTRACT 8항목).

  npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/forest/forest_refs_scenes.mts /tmp/jpf/refs/scenes.json
  python3 scripts/content/jp-city/forest/bake_forest_refs.py /tmp/jpf/refs/scenes.json

입력  scenes.json(실제 도구 paint_jp_forest·compose_jp_region·compose_jp_city_street·stamp_object 와 엔진 isPassable·checkJpForest 결과)
      public/assets/jp-city/jp-city-chipset.png(번들 시트 — 숲 칸이 구워진 시트여야 한다)
출력  src/assets/jpForestReferences.json            TilesetReferenceCategory[1] (그림은 /assets/... 경로만)
      public/assets/jp-city-references/forest-*.png 그림(긴 변 ≤ 820px, ≤128색, 확대는 nearest-neighbor 만)
      tiledata/jp-city/refs/forest-*.md              같은 쪽의 출처 사본
문서의 칸 번호·좌표·오류 코드는 전부 scenes.json 에서 읽는다(손으로 쓴 값 금지). 같은 입력이면 같은 바이트.
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
T = 16
SC = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/jpf/refs/scenes.json', encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/jp-city/jp-city-chipset.png')).convert('RGBA')
COLS = SHEET.width // T
assert COLS == SC['tilesPerRow'], (COLS, SC['tilesPerRow'])
assert SHEET.height // T * COLS >= SC['count'], '시트에 숲 칸이 없다 — 숲이 구워진 시트로 굽는다'
IMG_DIR = os.path.join(ROOT, 'public/assets/jp-city-references')
IMG_URL = '/assets/jp-city-references'
MD_DIR = os.path.join(ROOT, 'tiledata/jp-city/refs')
OUT_JSON = os.path.join(ROOT, 'src/assets/jpForestReferences.json')
S = SC['scenes']
G = SC['group']
CP = G['composer']
EN = SC['engine']


def tile(i):
    return SHEET.crop(((i % COLS) * T, (i // COLS) * T, (i % COLS) * T + T, (i // COLS) * T + T))


def render(sc, layers=('L1', 'L2', 'L3', 'L4'), box=None):
    W, H = sc['width'], sc['height']
    x0, y0, x1, y1 = box or (0, 0, W, H)
    img = Image.new('RGBA', ((x1 - x0) * T, (y1 - y0) * T), (0, 0, 0, 255))
    for key in layers:
        arr = sc['layers'][key]
        for y in range(y0, y1):
            for x in range(x0, x1):
                t = arr[y * W + x]
                if t is not None and t >= 0:
                    img.alpha_composite(tile(t), ((x - x0) * T, (y - y0) * T))
    return img


def up(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def mark(img, pts, k, color=(230, 30, 30, 255)):
    d = ImageDraw.Draw(img)
    for (x, y) in pts:
        d.rectangle([x * T * k, y * T * k, (x + 1) * T * k - 1, (y + 1) * T * k - 1], outline=color, width=2)
    return img


def side(*imgs, gap=8, bg=(40, 40, 40, 255)):
    """나란히(가로). 820px 를 넘으면 2열 격자로 접는다(왼쪽→오른쪽, 위→아래)."""
    cols = len(imgs)
    while cols > 1 and sum(sorted((i.width for i in imgs), reverse=True)[:cols]) + gap * (cols - 1) > 820:
        cols -= 1
    rows = [imgs[k:k + cols] for k in range(0, len(imgs), cols)]
    w = max(sum(i.width for i in r) + gap * (len(r) - 1) for r in rows)
    h = sum(max(i.height for i in r) for r in rows) + gap * (len(rows) - 1)
    out = Image.new('RGBA', (w, h), bg)
    y = 0
    for r in rows:
        x = 0
        for i in r:
            out.alpha_composite(i, (x, y)); x += i.width + gap
        y += max(i.height for i in r) + gap
    return out


IMAGES = []


def save(name, img, caption, title):
    assert max(img.size) <= 820, (name, img.size)
    q = img.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    os.makedirs(IMG_DIR, exist_ok=True)
    q.save(os.path.join(IMG_DIR, name), optimize=True)
    IMAGES.append(dict(id='jp-img-' + name[:-4], name=name, caption=caption, dataUrl=f'{IMG_URL}/{name}'))
    return title


def grid(sc, key, box=None):
    W = sc['width']
    x0, y0, x1, y1 = box or (0, 0, sc['width'], sc['height'])
    arr = sc['layers'][key]
    rows = []
    for y in range(y0, y1):
        rows.append(' '.join(f'{arr[y * W + x]:>5}' for x in range(x0, x1)))
    return '\n'.join(rows)


def call_str(c):
    return '`' + c['tool'] + '(' + json.dumps(c['args'], ensure_ascii=False) + ')`'


# ── 그림 ─────────────────────────────────────────────
ex, gr, kits, thin, road = S['ex'], S['grove'], S['kits'], S['thin'], S['road']
save('forest-ex.png', side(up(render(ex), 2), up(render(ex), 1)),
     '정답 예제: 16×12 잔디(칸 3281)에 ' + call_str(ex['call']) + ' 한 번. 왼쪽 ×2, 오른쪽 원본 1배(맵 전체, 1~4층 합성). 칸 배열은 `jp-forest-example`.', 'ex')
save('forest-ex-layers.png', side(*[up(render(ex, (k,)), 1) for k in ('L1', 'L2', 'L3', 'L4')]),
     '정답 예제의 층별 그림(원본 1배, 왼쪽 위부터 오른쪽·아래로 1층 숲 바닥·그늘 변형 / 2층 숲 밖 잔디 둘레 그늘 덧칸 + 가장 뒤 나무 / 3층 / 4층 가장 앞 나무). 검은 곳은 그 층이 빈 칸.', 'layers')
save('forest-kits-vs-forest.png', side(up(render(kits), 2), up(render(ex), 2)),
     '오류/정상: 위는 나무 키트 jp-prop-tree-zelkova 를 stamp_object 로 4칸 간격 격자에 6번 찍은 것(줄 맞춘 나무·수관이 안 겹침·그늘 없음 — 숲이 아니라 가로수 줄). 아래는 paint_jp_forest 한 번. ×2.', 'kits')
save('forest-grove.png', up(render(gr), 1),
     '공원 숲: ' + call_str(gr['call']) + ' — 덩이 숲 사이에 잔디 빈터가 남는다(원본 1배, 32×20).', 'grove')
save('forest-thin-road.png', side(up(render(thin), 2), up(render(road), 2)),
     '위: 2줄 띠 ' + call_str(thin['call']) + ' — 나무는 서지만 한 줄 가로수처럼 보인다(숲은 4줄 이상 권장). 아래: 숲 사각형 한가운데 길(y=6, 칸 ' + str(EN['road']) + ') — 길 칸은 건너뛰고 수관도 길 위로 넘치지 않는다. ×2.', 'thin-road')
muts = [S['mut-layer'], S['mut-trunk'], S['mut-road']]
save('forest-mutations.png', side(*[mark(up(render(m), 1), [(i['x'], i['y']) for i in m['issues']], 1) for m in muts]),
     '변조 검출(빨간 칸 = checkJpForest 가 보고한 칸): ① ' + muts[0]['mutation'] + ' → ' + muts[0]['issues'][0]['code'] + ', ② ' + muts[1]['mutation'] + ' → ' + muts[1]['issues'][0]['code'] + ', ③ ' + muts[2]['mutation'] + ' → ' + muts[2]['issues'][0]['code'] + '. 원본 1배, 왼쪽부터 ①②③.', 'mut')
sh = S['shrine']
save('forest-shrine.png', up(render(sh), 1),
     '신사 경내 + 진수의 숲: ' + call_str(sh['call']) + ' — 지역 조립기가 숲 구획을 같은 composer 숲으로 칠한다(원본 1배, 50×36).', 'shrine')
st = S['street']
save('forest-park-street.png', up(render(st, box=(0, 0, 25, 14)), 2),
     '주택가 공원 숲: ' + call_str(st['call']) + ' 의 공원 구획(왼쪽 위) — 공원 뒤쪽 잔디에 grove 숲(parkForest 기본), 입구 판석·연못·벤치 칸은 비켜 간다. 맵 (0,0)~(24,13) ×2.', 'park')

# ── 문서 ─────────────────────────────────────────────
count, tpr = SC['count'], SC['tilesPerRow']
head = (f"tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **{count}칸**, {T}px 칸, 한 줄 **{tpr}칸** — "
        f"번호 n 의 칸은 열 n%{tpr}, 행 n÷{tpr}(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 다른 칩셋 칸 번호와 섞지 않는다.\n\n")
mem = G['memberTileIds']
fl = CP['ground']['floorTiles']
ap = [t for t in CP['ground']['apronTiles'] if t >= 0]
sprites_tbl = '\n'.join(f"| `{s['name']}` | {s['shape']}{' (숲 속 짙은 판)' if s['dark'] else ''} | {s['w']}×{s['h']} | {', '.join(map(str, CP['trunkCols'][s['shape']]))} | "
                        + ' / '.join(' '.join(f'{t}' for t in s['tiles'][r * s['w']:(r + 1) * s['w']]) for r in range(s['h'])) + ' |' for s in CP['sprites'])
e = EN
doc_dict = head + f"""# 일본 도시 · 숲 사전 (나무 composer 숲 `{G['id']}`)

숲은 **1층 숲 바닥 오토타일 하나**(`{G['id']}` «{G['name']}», 층 `{G['layer']}`)다. 이 바닥을 칠하면 엔진의 나무 composer(`src/project/defaults/treeComposer.ts`)가
칸마다 나무 그림 조각을 2·3·4층에 쌓고 둘레에 땅 그늘을 깐다. 나무 칸·그늘 칸은 **사람·조수가 낱칸으로 찍는 칸이 아니다**(tileMeta 설명에도 그렇게 적혀 있다).
지금 수종은 **활엽(느티나무·잡목) 하나**다. 삼나무·대숲·벚나무·단풍 숲은 이 방식으로는 아직 없다 — 대숲·삼나무는 옛 키트(`jp-rg-bamboo-*`, `jp-rg-sugi*`, stamp_object)로 놓는다.

## 칸
| 무엇 | 칸 번호 | 층 | 통행(엔진 passability) | 비고 |
|---|---|---|---|---|
| 숲 바닥(그늘 0) | `{mem[0]}` | 1층 | {'막힘' if not e['floor']['passability']['up'] else '걸음'} | 그룹 멤버 {len(mem)}칸 = 바닥 + 그늘 변형. 숲 칸은 걸을 수 없다 |
| 숲 바닥 그늘 변형 | {len(fl)}개 코드 → {len(set(fl))}칸 (`{min(fl)}`~`{max(fl)}`) | 1층 | 막힘 | 나무가 덮은 칸 둘레 6방(가운데·북·서·북서·동·북동) 그늘 코드로 고른다 |
| 숲 밖 잔디 둘레 그늘 | {len(ap)}칸 (`{min(ap)}`~`{max(ap)}`) | 2층 | {'걸음' if e['apron']['passability']['up'] else '막힘'} | 잔디 `{', '.join(map(str, CP['ground']['apronBases']))}` 위에만. 그 칸의 나무는 3·4층만 쓴다 |
| 나무 그림 조각 | 아래 표 {len(CP['sprites'])}그루 | 4·3·2층(앞에서부터) | {'걸음(★, 사람 위에 그려짐)' if e['sprite']['passability']['up'] else '막힘'} | 수관이 숲 밖 잔디로 넘쳐도 그 잔디는 걸을 수 있다 |
| 수관이 넘쳐도 되는 1층 | 잔디 그룹 {', '.join('`' + g + '`' for g in CP['overhangOnGroups'])} 멤버 {CP.get('overhangOnTilesCount', 0)}칸 + 숲 바닥 | — | — | 길·물·건물·소품 칸 위로는 넘치지 않는다 |

## 나무 그림(행 우선, -1 = 투명 칸, `/` = 다음 줄)
| 이름 | 모양 | 칸 w×h | 줄기 열 | 칸 번호 |
|---|---|---|---|---|
{sprites_tbl}

모양별 기본 비율: 밑동마다 해시 r 로 r<{CP['shapeOdds'][0]} 이면 {CP['shapeOrder'][0]}→{CP['shapeOrder'][1]}→{CP['shapeOrder'][2]}, r<{CP['shapeOdds'][1]} 이면 {CP['shapeOrder'][1]}→{CP['shapeOrder'][0]}→{CP['shapeOrder'][2]}, 그 밖은 {CP['shapeOrder'][2]}→{CP['shapeOrder'][1]} 순서로 들어가는 첫 모양.
"""

doc_order = head + f"""# 일본 도시 · 숲 까는 순서·규칙·층

## 조수가 쓰는 입구 (이것만 쓴다)
1. **새 장소를 통째로 지을 때**: `compose_jp_region`(신사·사찰·산길·사토야마 등 숲 구획이 있는 지역)과 `compose_jp_city_street`(주택가 공원 → `parkForest` 기본 `grove`)가 숲을 **스스로** 같은 composer 로 칠한다. 나무 밑 땅 그늘(접지)은 늘 켜진다(`grounding` 인자는 옛 호출용으로 받기만 하고 무시한다).
2. **이미 있는 맵에 숲을 더할 때**: `paint_jp_forest` 한 번.
   - 자리: `rect:{{x,y,w,h}}` 또는 `beside:{{x,y,w,h, side, depth}}`(기준 사각형 — 신사 경내·공원·건물 — 옆 띠, side `north|south|east|west|around`, depth 3~20 기본 6) 또는 `besideLocation`(맵 위치 이름표) + `side`·`depth`.
   - `forestType`: `dense`(기본, 빽빽한 숲 — 신사 옆 진수의 숲·산비탈·경계 숲) | `grove`(공원 숲 — 덩이 숲 사이 잔디 빈터).
3. 편집기 붓: 「숲 · 활엽」 오토타일로 1층을 칠하면 같은 규칙으로 나무가 선다(붓질 둘레만 다시 짠다 — 붓질을 쌓은 결과 = 한 번에 칠한 결과).
4. 확인: `show_map_region` 으로 본다. 구조 검사 `checkJpForest`(아래 코드)는 0건이어야 한다.

**하지 말 것:** 나무 키트(`jp-prop-tree-*`)를 숲처럼 격자로 여러 번 stamp(`jp-img-forest-kits-vs-forest`), 나무·그늘 칸을 번호로 paint_tiles, 숲 바닥을 길·건물 위에 칠하기.
가로수·마당 한 그루는 키트(`jp-prop-tree-zelkova|ginkgo|sakura`)가 맞다 — 숲(여러 그루가 겹친 덩이)만 이 방식이다.

## 규칙(엔진이 하는 일 — 결정적, 칸 해시만 쓴다)
1. **숲 칸** = 1층이 `{G['id']}` 멤버인 칸. 숲이 될 수 있는 칸 = 1층이 잔디·자갈잔디(또는 이미 숲 바닥)이고 2~4층에 남의 칸(집·소품·길 덧칸)이 없는 칸. 아니면 `paint_jp_forest` 가 건너뛴다(결과의 `skipped`).
2. **밑동 줄**: 짝수 줄(y%{CP['rowStep']}==0) 또는 숲의 남쪽 끝 줄. 줄 안에서는 x ≡ 줄 위상 (mod {CP['colStep']}) 인 칸(위상은 두 줄마다 1~2씩 누적), 그중 {int(CP['skip'] * 100)}% 는 비운다.
3. **모양**: 위 비율로 고른 모양이 들어가면(줄기 열 칸이 모두 숲, 수관 칸이 모두 «넘쳐도 되는 칸») 그 모양, 아니면 다음 모양. 숲 속(밑동 아래 칸도 숲)은 짙은 판(`d`).
4. **겹침**: 칸마다 덮는 조각을 깊이 z = y×4096 + 해시 순(남쪽 = 앞)으로 줄 세워 **앞에서부터 {', '.join(map(str, CP['layers']))}층**에 둔다. 앞 조각이 칸을 98% 이상 덮거나 층이 차면 멈춘다.
5. **그늘(grounding)**: 놓인 나무의 아래 {CP['ground'].get('shadeRows', 2)}줄 중 불투명 {CP['ground']['shadeCover']}%(맨 밑줄 {CP['ground']['shadeCoverBase']}%) 이상인 칸이 그늘을 드리운다.
   숲 칸은 1층 그늘 변형(6방 코드 64가지)으로, 숲 밖 잔디 `{', '.join(map(str, CP['ground']['apronBases']))}` 칸은 {CP['ground']['apronLayer']}층 둘레 그늘 덧칸으로 바꾼다.
6. **최소 크기**: 2줄 띠도 남쪽 끝 줄이 밑동 줄이라 나무가 서지만 한 줄 가로수처럼 보인다(`jp-img-forest-thin-road`). 숲은 4×4 이상, 덩이 숲은 6×5 이상 권장.
7. **좌·우·위 마감**: 따로 마감 칸이 없다 — 수관이 숲 밖 잔디로 0~2칸 넘치고(그 잔디는 걸을 수 있다), 길·물·건물 쪽으로는 넘치지 않아 곧게 잘린다.

## 층과 통행(엔진 판정 — `isPassable`·passability·priority)
| 칸 | 층 | priority | 통행 | 사람과의 앞뒤 |
|---|---|---|---|---|
| 숲 바닥·그늘 변형 | 1 | {e['floor']['priority']} | {'막힘' if not e['floor']['passability']['up'] else '걸음'} | 아래 |
| 둘레 그늘 덧칸 | 2 | {e['apron']['priority']} | {'걸음' if e['apron']['passability']['up'] else '막힘'} | 사람 밑 |
| 나무 조각 | 2·3·4 | {e['sprite']['priority']} | {'걸음(★)' if e['sprite']['passability']['up'] else '막힘'} | 사람 위(수관 밑을 지나간다) |
숲 칸 통행은 1층 바닥이 막는다. 숲 밖으로 넘친 수관 밑 잔디는 걸을 수 있다(예제의 통행 배열 `jp-forest-example`).
"""

ew = ex['width']
doc_ex = head + f"""# 일본 도시 · 숲 완전한 예제(입력 → 전체 층 배열 → 원본 그림)

입력: 16×12 맵, 1층 전체 잔디 `3281`, 호출 {call_str(ex['call'])}.
결과 요약(도구 그대로): «{ex['result']['summary']}». 검사 `checkJpForest` = {len(ex['issues'])}건.
그림: `jp-img-forest-ex`(원본 1배·×2), 층별 `jp-img-forest-ex-layers`.

## 1층 (숲 바닥·그늘 변형 / 잔디)
```
{grid(ex, 'L1')}
```
## 2층 (-1 = 빈 칸)
```
{grid(ex, 'L2')}
```
## 3층
```
{grid(ex, 'L3')}
```
## 4층
```
{grid(ex, 'L4')}
```
## 통행(1 = 걸음, 엔진 isPassable)
```
{chr(10).join(' '.join(str(ex['passable'][y * ew + x]) for x in range(ew)) for y in range(ex['height']))}
```

## 다른 정상 예
- 공원 숲(grove): {call_str(gr['call'])} → «{gr['result']['summary']}» (`jp-img-forest-grove`).
- 신사: {call_str(sh['call'])} → 지역이 숲 구획을 같은 composer 로 칠한다(`jp-img-forest-shrine`, 검사 {len(sh['issues'])}건).
- 주택가 공원: {call_str(st['call'])} → 공원 숲 {st['result'].get('parkForestCells')}칸(`jp-img-forest-park-street`, 검사 {len(st['issues'])}건).
"""

codes = {
    'FOREST_TILE_ON_LAYER1': '나무·그늘 덧칸이 1층에 있다(잘못된 레이어 — 1층은 숲 바닥만)',
    'FOREST_ROOT_OFF_FOREST': '줄기 열의 밑동 칸이 숲 바닥이 아닌 칸에 있다(잘린 뿌리 — 숲 밖에 선 나무)',
    'FOREST_OVER_FOREIGN': '나무 조각 밑 1층이 잔디·숲 바닥이 아니다(길·물·건물 위로 넘친 수관)',
    'FOREST_TRUNK_MISSING': '밑동 바로 위 칸은 있는데 밑동 칸이 비었다(빠진 줄기)',
    'FOREST_APRON_OFF_LAWN': '둘레 그늘 덧칸 밑이 그늘용 잔디가 아니다',
}
mut_rows = '\n'.join(f"| `{m['id']}` | {m['mutation']} | " + ', '.join(f"`{i['code']}` ({i['x']},{i['y']}) {i['layer']}층 칸 {i['tile']}" for i in m['issues']) + ' |' for m in muts)
clean = ', '.join(f"`{k}` {len(S[k]['issues'])}건" for k in ('ex', 'grove', 'thin', 'road', 'kits', 'shrine', 'street'))
doc_err = head + f"""# 일본 도시 · 숲 정상/오류·자동 좌표 검사·층 정정

## 검사 `checkJpForest(map, tileset)` (`src/editor/jpCity/forestPainter.ts`)
구조와 층만 본다 — **보기 좋은지·수종이 맞는지는 판정하지 않는다**(시각 판정은 그림을 직접 보거나 3/4 관문 판정자가 한다). 칸 좌표는 0 기준.
| 코드 | 뜻 |
|---|---|
""" + '\n'.join(f'| `{k}` | {v} |' for k, v in codes.items()) + f"""

## 변조 실험(정답 예제를 한 곳씩 망가뜨려 검사) — `jp-img-forest-mutations`
| 장면 | 변조 | 검출(코드·좌표·층·칸) |
|---|---|---|
{mut_rows}
정상 장면은 모두 0건: {clean}.
키트 격자(`kits`)도 0건이다 — 구조는 틀리지 않았지만 숲이 아니다(줄 맞춘 가로수). 이것은 검사가 못 잡는 «보기» 오류라서 그림(`jp-img-forest-kits-vs-forest`)으로 가른다.

## 정상/오류 그림
- 키트 격자 vs 숲: `jp-img-forest-kits-vs-forest`.
- 2줄 띠·길 사이: `jp-img-forest-thin-road` — 길 칸은 건너뛰고(`skipped`), 수관이 길 위로 안 넘친다.
- 저장 전 실패: `paint_jp_forest` 는 맵 사본에 칠하고 성공해야 반영한다 — 숲이 될 잔디 칸이 0이면 오류(`no-forest-cells`)로 멈추고 맵은 그대로다. jp_city 가 아닌 맵은 `wrong-tileset`, 숲 칸이 없는 옛 시트는 `forest-not-baked`.

## 층 설명 정정(전 → 후)
- 숲 밖 둘레 그늘 덧칸(예 `{e['apron']['tile']}`)의 tileMeta 는 `defaultLayer: {e['apron']['meta'].get('defaultLayer')}`·설명 «투명 덧그림: 붓은 위층»이지만, 엔진 composer 는 이 칸을 **{CP['ground']['apronLayer']}층**(priority `{e['apron']['priority']}`, 사람 밑)에 둔다.
  조수가 이 칸을 손으로 다룰 일은 없다 — composer 가 놓고 지운다. 판단 근거는 tileMeta 가 아니라 이 문서의 층 표다.
- 나무 조각 tileMeta `defaultLayer: {e['sprite']['meta'].get('defaultLayer')}`(passage `{e['sprite']['meta'].get('passage')}`)는 엔진과 같다(2~4층, 사람 위).
"""

DOCS = [
    dict(id='jp-forest-order', name='일본 도시 · 숲 까는 순서·규칙·층(paint_jp_forest)', markdown=doc_order),
    dict(id='jp-forest-dict', name='일본 도시 · 숲 사전(숲 바닥·그늘·나무 그림 칸 번호)', markdown=doc_dict),
    dict(id='jp-forest-example', name='일본 도시 · 숲 완전한 예제(전체 층 배열)', markdown=doc_ex),
    dict(id='jp-forest-errors', name='일본 도시 · 숲 정상/오류·좌표 검사·층 정정', markdown=doc_err),
]
os.makedirs(MD_DIR, exist_ok=True)
for d in DOCS:
    open(os.path.join(MD_DIR, d['id'].replace('jp-', '', 1) + '.md'), 'w', encoding='utf-8').write(d['markdown'])
cat = dict(id='jp-forest', name='일본 도시 · 숲(나무 composer — 신사 숲·공원 숲)',
           description='jp_city 숲을 까는 법: paint_jp_forest(rect·beside·besideLocation, forestType dense|grove) 한 번, 지역·거리 조립기의 숲. '
                       '숲 바닥·그늘·나무 그림 칸 사전, 엔진 규칙(밑동 줄·모양·겹침·그늘), 완전한 층 배열 예제, 정상/오류 그림과 변조 검출 좌표, 층 정정.',
           documents=DOCS, images=IMAGES)
json.dump([cat], open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'{OUT_JSON}: 문서 {len(DOCS)} · 그림 {len(IMAGES)} · 글자 {sum(len(d["markdown"]) for d in DOCS)}')
