#!/usr/bin/env python3
"""desert_east 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기 출력에서 기계적으로 만든다.

  python3 scripts/content/desert-east/bake_de.py && python3 scripts/content/desert-east/bake_refs_de.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/desertEastComposer.ts(compose_desert_east_map·compose_desert_east_room 도구와 같은 함수)를 qa/*.mts 로 돌린 결과다.
산출: src/assets/desertEastReferences.json (그림은 경로만) · public/assets/desert-east-references/*.png
용도 2개: `de-outdoor`(de-howto · de-dictionary · de-ex-* · de-errors) · `de-interior`(de-room-howto · de-room-ex-*).
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa'))
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

D = os.environ.get('DE_DIR')
DATA = json.load(open(os.path.join(D or os.path.join(ROOT, 'src/assets'), 'desertEastTileset.json'), encoding='utf-8'))
PIECES = json.load(open(os.path.join(D or os.path.join(ROOT, 'src/assets'), 'desertEastPieces.json'), encoding='utf-8'))
SHEET = RS.SHEET
TPR = DATA['tilesPerRow']; N = DATA['count']
IMG = os.path.join(D, 'refs') if D else os.path.join(ROOT, 'public/assets/desert-east-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(D, 'desertEastReferences.json') if D else os.path.join(ROOT, 'src/assets/desertEastReferences.json')
URL = lambda n: '/assets/desert-east-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
EXAMPLES = [('oasis', 48, 36, 1, '오아시스 마을 48×36'), ('bazaar', 48, 32, 1, '바자르 시장 거리 48×32'), ('palace', 46, 38, 1, '궁전과 궁정 마당 46×38'),
            ('pyramid', 48, 36, 1, '피라미드 유적 48×36'), ('caravanserai', 40, 32, 1, '대상 숙소 40×32')]
ROOMS = [('teahouse', 13, 10, '찻집 13×10'), ('shop', 11, 9, '바자르 가게 11×9'), ('palace_hall', 17, 14, '궁전 알현실 17×14'), ('tomb', 15, 17, '피라미드 묘실 15×17'),
         ('hammam', 13, 11, '목욕탕 13×11'), ('inn', 13, 10, '여관 방 13×10')]
HEAD = (f"tilesetId `desert_east` · 그림 `public/assets/desert-east/desert-east-chipset.png`(텍스처 `tex_desert_east`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-desert-east` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트는 desert_east 잠금 21램프(사암·흙벽돌·회칠·청록·군청·금·나무·야자·물·모래…). 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 이야기 기물 8종(`de-objects` 묶음 — 봉인 제단·화단·샘·기록부·쪽지·표식·빛나는 파편·비문 돌)은 3/4 관문 미통과 — 오너 면제 그림이고, 그 밖의 그림은 object-gate 3/4 관문 영수증이 있는 조각만 구웠다.")


def arr(a): return json.dumps(a, separators=(',', ':'))
def passable(t): return t < 0 or bool(DATA['passability'][t]['up'])
KIT = {k['id']: k for k in DATA['structureKits']}


def run(script, out, *a):
    env = dict(os.environ)
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', script), '--', out, *map(str, a)], cwd=ROOT, check=True, capture_output=True, env=env)
    return json.load(open(out))


def validate(d):
    """E_BOUNDS · E_OVERLAP · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE — (코드, 대상, x, y) 목록."""
    W, H = d['width'], d['height']; errs = []
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and passable(d['lower'][y * W + x]) and passable(d['upper'][y * W + x])
    rects = [(b['name'], b['rect']) for b in d['buildings']] + [(p['kit'], dict(x=p['x'], y=p['y'], w=KIT[p['kit']]['width'], h=KIT[p['kit']]['height'])) for p in d['props']]
    for n, r in rects:
        if r['x'] < 0 or r['y'] < 0 or r['x'] + r['w'] > W or r['y'] + r['h'] > H: errs.append(('E_BOUNDS', n, r['x'], r['y']))
    for i, (n1, a) in enumerate(rects):
        for n2, b in rects[i + 1:]:
            if a['x'] < b['x'] + b['w'] and b['x'] < a['x'] + a['w'] and a['y'] < b['y'] + b['h'] and b['y'] < a['y'] + a['h']: errs.append(('E_OVERLAP', f'{n1}/{n2}', b['x'], b['y']))
    s = d['start']; seen = {(s['x'], s['y'])} if walk(s['x'], s['y']) else set(); q = list(seen)
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and walk(*n): seen.add(n); q.append(n)
    for b in d['buildings']:
        for c in b['doors']:
            if walk(c['x'], c['y']): errs.append(('E_DOOR_CELL_OPEN', b['name'], c['x'], c['y']))
        for c in b['access']:
            if not walk(c['x'], c['y']): errs.append(('E_DOOR_ACCESS_BLOCKED', b['name'], c['x'], c['y']))
            elif (c['x'], c['y']) not in seen: errs.append(('E_DOOR_UNREACHABLE', b['name'], c['x'], c['y']))
    return errs


def stamp(d, kit_id, x, y):
    k = KIT[kit_id]; W = d['width']
    for r, row in enumerate(k['rows']):
        for c in range(k['width']):
            X, Y = x + c, y + r
            if not (0 <= X < W and 0 <= Y < d['height']): continue
            if row['tiles'][c] >= 0: d['lower'][Y * W + X] = row['tiles'][c]
            if (row.get('upperTiles') or [-1] * k['width'])[c] >= 0: d['upper'][Y * W + X] = row['upperTiles'][c]


def tampers(d):
    out = []
    b0 = next(b for b in d['buildings'] if b['access'])
    t = json.loads(json.dumps(d)); a = b0['access'][0]; stamp(t, 'de-crates-stack', a['x'], a['y']); t['props'].append(dict(kit='de-crates-stack', x=a['x'], y=a['y']))
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 궤짝 쌓음", t, [(a['x'], a['y'], 2, 2)]))
    t = json.loads(json.dumps(d)); bb = t['buildings'][0]; bb['rect']['x'] = d['width'] - bb['rect']['w'] // 2
    out.append(('bounds', f"{bb['name']}을 오른쪽 끝({bb['rect']['x']},{bb['rect']['y']})으로 밀어 맵 밖", t, [(bb['rect']['x'], bb['rect']['y'], d['width'] - bb['rect']['x'], bb['rect']['h'])]))
    t = json.loads(json.dumps(d)); b1, b2 = t['buildings'][0], t['buildings'][1]; b2['rect']['x'] = b1['rect']['x'] + 1; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    t = json.loads(json.dumps(d)); y = d['start']['y'] - 2
    for x in range(d['width']): stamp(t, 'de-rock-small', x, y)
    out.append(('unreachable', f"시작 칸 위 {y}줄 전체를 바위로 막음", t, [(0, y, d['width'], 1)]))
    return out


def kit_sheet(prefixes, name, exclude_interior):
    ks = [k for k in DATA['structureKits'] if (k['ai'].get('themes') and (('실내' in k['ai']['description']) != exclude_interior))]
    S = 2; pad = 8; items = [(k, BL.reassemble(k, SHEET, TPR)) for k in ks]
    Wd = 1400; x = y = pad; rowh = 0; place = []
    for k, im in sorted(items, key=lambda t: -t[1].height):
        w, h = im.width * S, im.height * S + 14
        if x + w + pad > Wd: x, y, rowh = pad, y + rowh + pad, 0
        place.append((x, y, k, im)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + pad), (214, 184, 132, 255)); dr = ImageDraw.Draw(sheet)
    for x0, y0, k, im in place:
        dr.text((x0, y0), k['id'].replace('de-', ''), fill=(40, 24, 16, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, name), optimize=True)
    return len(ks)


def is_interior_kit(k): return '실내' in k['ai']['description']


def wang_sheet():
    sets = list(PIECES['wang'].items()); S = 3
    im = Image.new('RGBA', (16 * 16 * S + 8, len(sets) * (16 * S + 18) + 4), (40, 36, 44, 255)); dr = ImageDraw.Draw(im)
    for r, (sid, tiles) in enumerate(sets):
        y = r * (16 * S + 18) + 2; dr.text((4, y), f'{sid} — 번호 0~15 (NW1+NE2+SW4+SE8)', fill=(255, 255, 255, 255), font=FONT)
        for i, t in enumerate(tiles):
            if t < 0: continue
            im.alpha_composite(RS.tile(t).resize((16 * S, 16 * S), Image.NEAREST), (4 + i * 16 * S, y + 14))
    im.save(os.path.join(IMG, 'wang-sets.png'), optimize=True)


def dictionary_md():
    L = [f"# desert_east · 사전 (바닥 낱칸 · 모서리 왕 타일 · 키트 전체 배열)\n\n{HEAD}\n"]
    L.append("## 바닥 낱칸(반복해 칠한다, 아래층)\n\n| 조각 id | 칸 번호 | 통행 |\n|---|---|---|")
    for pid, t in sorted(PIECES['tiles'].items(), key=lambda kv: kv[1]):
        if pid in KIT: continue
        L.append(f"| `{pid}` | {t} | {'걷는다' if passable(t) else '막힘'} |")
    L.append("\n## 모서리 왕 타일(재질 경계) — 벌마다 16칸, 번호 = NW·1 + NE·2 + SW·4 + SE·8 (그 꼭짓점이 덧 재질이면 1)\n")
    L.append("꼭짓점 격자((W+1)×(H+1))에 재질을 정하고 칸마다 네 모서리로 번호를 고른다. 바탕(A)은 road·grass·dune·flag 벌에서 모래, water 벌에서 풀이다(물은 풀 안에만). 번호 15 = 순수 덧 재질(길·풀·포석은 낱칸 변주를 대신 써도 된다). 물 벌은 물 꼭짓점이 하나라도 있으면 막힘.\n")
    L.append('| 벌 | 바탕 → 덧 | 칸 번호 0..15 |\n|---|---|---|')
    names = dict(road='모래 → 다진 흙길', grass='모래 → 오아시스 풀', water='풀 → 못물(북쪽 둑 앞면)', dune='모래 → 솟은 사구(남쪽 비탈 그늘)', flag='모래 → 사암 포석(연석)')
    for sid, tiles in PIECES['wang'].items(): L.append(f"| `{sid}` | {names.get(sid, sid)} | `{arr(tiles)}` |")
    L.append("\n## 키트(여러 칸 물체) — `list_tileset_objects` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **건물**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. 키트는 전부 고정 조각이다 — 성벽 `de-wall-h`(1×3)·`de-wall-v`(2×1)만 폭 간격으로 나란히 이어 찍는다.\n")
    for k in DATA['structureKits']:
        t = [r['tiles'] for r in k['rows']]; u = [r.get('upperTiles') or [-1] * k['width'] for r in k['rows']]
        ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
        extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄" if ent else ''
        L.append(f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:140]} {k['ai'].get('placementRules', '')[:160]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n")
    return '\n'.join(L)


def howto_md():
    return f"""# desert_east · 사막·동양풍 야외 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_desert_east_map({{mapId, kind, seed?, replace?}})` 가 아래 순서·규칙대로 야외 한 장을 **씨앗마다 다르게** 짠다. kind 와 최소 크기:
  oasis 오아시스 마을 40×32 · bazaar 바자르 거리 42×30 · palace 궁전 44×36 · pyramid 피라미드 유적 44×34 · caravanserai 대상 숙소 36×30 (최소보다 24×20 넘게 크면 거부 — 빈 모래가 남는다).
- 시작 칸(남쪽 끝 길)에서 모든 건물 문 접근칸에 닿는지 엔진 통행으로 확인해 안 되면 깔지 않는다(맵을 바꾸지 않는다).
- 건물 문 ↔ 실내: desert_east 맵을 하나 더 만들어 `compose_desert_east_room({{mapId, kind}})`, 그다음 `link_desert_east_interior({{mapId, door:{{x,y}}, width, interiorMapId}})`. 문 좌표는 compose 결과 `data.buildings[].doors`.

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **땅은 재질 하나**: 꼭짓점 격자 전체 모래. 잔잔한 모래 4변주를 칸마다 섞고 값 잡음 덩이로 물결 모래(`de-sand-ripple`)·자갈 모래(`de-sand-pebble`)를 놓는다 — 띠 전체를 한 칸 그림으로 칠하지 않는다.
2. **길·광장·풀·물**은 꼭짓점 재질(road·flag·grass·water)로 정하고 모서리 왕 타일로 잇는다(칸 경계에 딱딱한 네모가 생기지 않는다). 물은 풀 띠(1칸 이상) 안에만.
3. **건물**은 길 북쪽에 밑변을 맞춰 줄로(문 남향, 문 바로 아래 접근칸이 길). 건물 사이 1~2칸. 성벽은 사각 둘레(북·남 `de-wall-h` 3줄, 동·서 `de-wall-v` 폭 2, 모서리 `de-wall-tower`, 남쪽 가운데 `de-wall-gate`/`de-caravanserai-gate` — 통로 칸은 걷는다).
4. **용도 구역**: 오아시스 = 못·야자·갈대·우물 광장·낙타 쉼터·천막 야영지·대추야자 과수원. 바자르 = 포석 큰길 북쪽 노점(2×2)·가게 줄, 분수 광장 + 회당 + 첨탑, 남쪽 바닥 장터(좌판 묶음 두 줄 격자, 묶음 사이 1칸). 궁전 = 궁전 앞 포석 단·사자 석상 짝·화로, 축선 길·분수, 좌우 정원(풀·물길·야자·협죽도), 신하 처소. 피라미드 = 대피라미드 + 남쪽 입구(`de-pyramid-door` 건물) + 석상·오벨리스크 늘어선 참배 길(4칸 간격 짝) + 작은 피라미드 + 무너진 신전 터(포석 바닥·기둥 줄·폐허 벽·아치) + 발굴 야영지. 대상 숙소 = 북쪽 방 줄 + 우물 단 + 낙타 줄 + 짐 구석.
5. **소품**: 발자국 + 여백을 예약하고 겹치지 않는다. 길·광장 통로, 문 접근칸과 그 아래 한 칸, 물 칸에는 두지 않는다. 땅이 맞아야 한다 — 야자·갈대·협죽도는 풀 위, 노점·분수·벤치는 포석 위, 낙타·천막·덤불·바위는 모래 위.
6. **트인 사막**: 마지막. 동서로 긴 사구 마루(꼭짓점 재질 dune, 가로 3꼭짓점 이상 — 외톨이는 마름모로 보여 지운다), 덤불·마른 풀·작은 바위를 3칸 이상 띄워, 큰 바위·노두 덩이. 사구 위에는 마른 풀만.

## 금지 조건
- 키트가 맵 밖으로 나가면 안 된다(E_BOUNDS). 건물·소품이 겹치면 안 된다(E_OVERLAP). 문 칸이 걸을 수 있으면 안 되고(E_DOOR_CELL_OPEN) 접근칸이 막히면 안 된다(E_DOOR_ACCESS_BLOCKED). 시작 칸에서 접근칸이 안 닿으면 안 된다(E_DOOR_UNREACHABLE).

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 건물 키트 맨 아래 줄 문(막힘). **접근칸** = 문 바로 아래 줄(걸을 수 있는 땅). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에(link_desert_east_interior 가 만든다).

## 반복 가능 / 고정
- 반복: 바닥 낱칸과 모서리 왕 타일. 고정: 건물·소품·나무·성벽 탑·성문. 성벽 `de-wall-h`·`de-wall-v` 는 고정 조각을 나란히.

## 없는 소재
- 사람·글자·간판·종교 문자: 없다(그리지 않았다). 사람은 Actor1 캐릭터 이벤트. 배·항구·눈·숲: 이 칩셋에 없다 — 다른 번들 칩셋의 별도 맵으로 짓는다(번호를 섞지 않는다).

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 바닥 낱칸·왕 타일은 불투명 아래층(걷는다, 물 왕 타일만 막힘). 건물·소품은 위층·막힘. 야자 잎 줄·갈대 차양 밑·성문 통로·아치 밑·부스러기는 위층이지만 **걷는다**(★: 사람 머리 위에 그려진다).
- 확인 범위: 구조·좌표·통행(4방 BFS)뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`de-ex-{k}`({t})' for k, _, _, _, t in EXAMPLES)} · `de-errors`(정상/오류 나란히). 실내는 용도 `de-interior`.
"""


def example_md(title, d, img, kind):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings'])
    zones = '\n'.join(f"- {z['name']} ({z['rect']['x']},{z['rect']['y']} {z['rect']['w']}×{z['rect']['h']}): {z['use']}" for z in d['zones'])
    props = collections.Counter(p['kit'] for p in d['props'])
    return f"""# desert_east 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/desertEastComposer.ts`, compose_desert_east_map 과 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_desert_east_map({{kind:"{kind}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}).

## 구역(용도)
{zones}

## 건물·문·접근칸
{doors}

## 소품 {sum(props.values())}개
{', '.join(f'`{k}`×{n}' for k, n in props.most_common())}

## 정답 배열 (폭 {d['width']} × 높이 {d['height']}, 행 우선)
아래층 `lowerTiles`:
```json
{arr(d['lower'])}
```
위층 `upperTiles`(-1 = 비움):
```json
{arr(d['upper'])}
```
"""


def room_howto_md():
    return f"""# desert_east · 실내 방 — 구조와 가구 규칙 (먼저 읽는다)

{HEAD}

## 도구
`compose_desert_east_room({{mapId, kind, seed?, replace?}})` — 맵 크기 = 방 크기(24×20 이하). kind 와 최소 크기: teahouse 찻집 12×9 · shop 바자르 가게 10×8 · palace_hall 궁전 알현실 16×13 · tomb 피라미드 묘실 13×16 · hammam 목욕탕 12×10 · inn 여관 방 12×9.
문에서 모든 빈 바닥이 닿는지 확인하고 안 되면 맵을 바꾸지 않는다. 야외 건물과는 `link_desert_east_interior` 로 잇는다(실내 맨 아랫줄 문 틈 하나).

## 방 뼈대 (직접 칠할 때도 같은 문법)
- 0행 = 천장(`de-ceil-warm` / 무덤 `de-ceil-tomb`). 1~2행 = 벽면 키트(1×2: 찻집·여관 `de-wall-plaster`(창 `de-wall-window-plaster`), 가게 `de-wall-stone`(벽감 `de-wall-niche-stone`), 궁전 `de-wall-palace`, 무덤 `de-wall-tomb`, 목욕탕 `de-wall-hammam`). 강조 벽은 서로 붙이지 않는다.
- 0열·마지막 열 = 천장 테(`-w` 테가 동쪽 · `-e` 테가 서쪽), 마지막 행 = `-s`(테가 북쪽) + 가운데 문 틈(바닥 칸), 아래 모서리 `-sw`/`-se`.
- 무덤은 남쪽 문에서 폭 3 통로가 북쪽 묘실로 이어진다. 통로 양옆은 천장(`de-ceil-tomb`), 묘실 아래 경계와 통로가 만나는 칸은 `-sw`/`-se`(테 북+동 / 북+서).
- 바닥 낱칸: 찻집 `de-floor-zellige`(+`-b` 16%), 가게 `de-floor-flag`, 궁전·목욕탕 `de-floor-marble`, 무덤 `de-floor-tomb`, 여관 `de-floor-wood`.

## 가구
- 벽 앞 줄(벽 바로 아래 첫 줄): 디완·찻대·선반·옥좌·석관 머리 단지·세면 대야·침상. 벽걸이 등(`de-lantern-wall`)은 벽 아랫줄 위층에 4~5칸마다.
- 문 → 방 가운데 통로 한 줄(문 폭)은 비운다(궁전 양탄자·분수만 예외 — 둘레로 돈다). 가구 둘레 여백은 키트 규칙(분수·탕·석관 둘레 1칸).
- 양탄자(`de-rug-medallion` 3×2, 걷는다) 위에 찻상·방석을 위층으로 겹칠 수 있다.

## 완성 예제
{' · '.join(f'`de-room-ex-{k}`({t})' for k, _, _, t in ROOMS)}
"""


def room_md(title, d, img, kind):
    props = collections.Counter(p['kit'] for p in d['props'])
    return f"""# desert_east 실내 예제 · {title}

{HEAD}

`compose_desert_east_room({{kind:"{kind}"}})` 를 {d['width']}×{d['height']} 맵에 — 구성기 실제 출력, 그림 `{img}` 는 시트 칸을 이어 붙인 것. 문 틈 {[(c['x'], c['y']) for c in d['doors']]}.

## 가구 {sum(props.values())}개
{', '.join(f'`{k}`×{n}' for k, n in props.most_common())}

## 정답 배열 (폭 {d['width']} × 높이 {d['height']})
아래층 `lowerTiles`:
```json
{arr(d['lower'])}
```
위층 `upperTiles`:
```json
{arr(d['upper'])}
```
"""


def errors_md(rows):
    L = ["# desert_east · 정상/오류 나란히 (변조 검출)\n", HEAD, "\n오아시스 예제를 실제로 변조해 검증기(`bake_refs_de.validate`)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `err-compare.png` 의 빨간 테두리 = 변조 자리.\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for kind, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_BOUNDS 맵 밖 · E_OVERLAP 겹침 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE 시작 칸에서 안 닿음.")
    L.append("\n확인 범위: 구조·좌표·통행(4방 BFS). 이벤트 실행·미감은 보지 않는다. 구성 도구는 검사가 실패하면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).")
    return '\n'.join(L)


# ───────────────────────── 이야기 기물(de-objects 조각 묶음) ─────────────────────────
OBJ_SPEC = os.path.join(ROOT, 'tiledata/desert-east/objects/spec.json')
OBJ_SCENE = [('spring', 1, 1), ('seal-altar', 6, 2), ('inscription-stone', 9, 2), ('record-stand', 11, 2), ('flower-bed', 13, 3),
             ('marker', 6, 6), ('shard', 8, 6), ('note', 10, 6)]     # (조각, 왼쪽 위 x, y) — 16×8 모래 장면


def objects_scene(spec):
    """모래 16×8 위에 8종을 키트 배열 그대로 놓은 장면 + 좌표 검사(통행이 선언과 같은가 · 3층에 통째로 있는가)."""
    W, H = 16, 8
    sand = [PIECES['tiles'][n] for n in ('de-sand', 'de-sand-b', 'de-sand-c', 'de-sand-d')]
    d = dict(width=W, height=H, lower=[sand[(x * 7 + y * 13) % 4] for y in range(H) for x in range(W)], upper=[-1] * (W * H))
    for pid, x, y in OBJ_SCENE: stamp(d, 'de-' + pid, x, y)
    return d


def objects_check(d, spec):
    W = d['width']; by = {it['id']: it for it in spec['items']}; errs = []
    for pid, ox, oy in OBJ_SCENE:
        it = by[pid]; k = KIT['de-' + pid]; block = {tuple(c) for c in it['block']}
        for r, row in enumerate(k['rows']):
            for c, t in enumerate(row['upperTiles']):
                if t < 0: continue
                i = (oy + r) * W + ox + c
                if d['upper'][i] != t: errs.append(('E_OBJ_LAYER' if d['lower'][i] == t else 'E_OBJ_INCOMPLETE', 'de-' + pid, ox + c, oy + r)); continue
                if passable(t) == ((c, r) in block): errs.append(('E_OBJ_PASSAGE', 'de-' + pid, ox + c, oy + r))
    return errs


def objects_md(spec, d, tamper_rows):
    by = {it['id']: it for it in spec['items']}
    L = [f"# desert_east · 이야기 기물 8종 (샘·봉인 제단·화단·기록부·쪽지·표식·빛나는 파편·비문 돌)\n\n{HEAD}\n",
         f"게임들이 바랐는데 그림이 없던 물건이다. **이 여덟 그림은 3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 {spec['waiver']}, Claude Fable 5.2 한 방 그림)이다 — 관문 영수증이 없고 스토어로는 나가지 않는다. "
         "그림 정본 `tiledata/desert-east/objects/pieces/`, 정의 `spec.json`, 굽기는 다른 조각과 같은 `bake_de.py`.\n",
         "## 1. 사전\n\n모든 칸은 **위층(upperTiles)** 에 놓는다(아래층 모래·포석·풀은 그대로 — 투명 화소 밑으로 비친다). 서 있는 기물: 막힌 칸은 네 방향 막힘, 나머지 칸은 ★(사람 위에 그려지고 걷는다). 바닥 그림(쪽지): 사람 아래·걷는다.\n",
         "| 키트 id | 무엇 | 크기 | 위층 칸 번호(위 줄 / 아래 줄) | 놓는 방식 | 막힌 칸 (dx,dy) | 찾는 낱말(키트 태그) |\n|---|---|---|---|---|---|---|"]
    for it in spec['items']:
        k = KIT['de-' + it['id']]
        L.append(f"| `de-{it['id']}` | {it['name']} | {it['w']}×{it['h']} | {' / '.join(' '.join(map(str, r['upperTiles'])) for r in k['rows'])} | {'바닥 그림(밟고 지나감)' if it['place'] == 'decal' else '서 있는 기물'} | "
                 f"{' '.join('(%d,%d)' % tuple(c) for c in it['block']) or '—'} | {', '.join(it['words'])} |")
    L.append("\n전부 고정 조각(이어 찍지 않는다). 입구·문 부품은 없다. 같은 것이 실내에 필요하면 이 키트를 그대로 쓴다(실내 전용 변형은 없다).\n")
    L.append("## 2. 실행 순서\n\n1. 땅(모래·포석·풀)을 먼저 깐다 — 구성 도구 `compose_desert_east_map` 이 지은 맵이면 그대로 둔다.\n"
             "2. `stamp_tileset_object({ mapId, objectId: \"de-…\", base })` — **base = 맨 아래 줄의 왼쪽 칸**(왼쪽 위가 (x,y)·높이 h 면 base = (x, y+h−1)). 조수 v2 는 `place_object({ mapId, objectId, at })`. 도구는 통째로 놓거나 거절한다.\n"
             "3. 큰 것부터(샘 3×3 → 제단 2×2·화단 2×1 → 1×2 → 1×1). 샘 둘레 한 칸은 걷는 바닥으로 비운다. 물 위·건물 문 앞 접근칸·길 한가운데에는 놓지 않는다.\n"
             "4. 그림일 뿐이다 — 읽기·줍기·봉인 풀기는 이벤트를 따로 둔다(막힌 칸의 이벤트는 «같은 높이·결정 키», 쪽지는 그 칸 «플레이어 아래»).\n"
             "5. 빈 땅 채우기에 흩지 않는다(키트 태그 «주제 소품») — 이야기가 부를 때만 놓는다. 조각별 자리는 키트 `placementRules`.\n")
    arrs = lambda a: '\n'.join(arr(a[y * d['width']:(y + 1) * d['width']]) for y in range(d['height']))
    L.append(f"## 3. 조립 예제 {d['width']}×{d['height']} (그림 `objects-scene.png` 원본 해상도 · `objects-scene-3x.png`)\n\n놓은 순서(키트 · 왼쪽 위): "
             + ' · '.join(f"`de-{p}` ({x},{y})" for p, x, y in OBJ_SCENE) + f"\n\n아래층 lower(한 줄 = 맵 한 줄, index = y*{d['width']}+x):\n```\n{arrs(d['lower'])}\n```\n\n위층 upper:\n```\n{arrs(d['upper'])}\n```\n")
    L.append("## 4. 정상/오류 (실제로 변조해 검출, 그림 `objects-err.png` — 왼쪽 정상 · 오른쪽 변조, 빨간 상자)\n\n| 변조 | 검출 코드 | 첫 오류(코드, 키트, x, y) |\n|---|---|---|")
    for desc, errs in tamper_rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_OBJ_LAYER 키트 칸이 아래층에 있다 · E_OBJ_INCOMPLETE 키트 칸이 빠졌다 · E_OBJ_PASSAGE 칸 통행이 선언(막힌 칸/걷는 칸)과 다르다.\n"
             "확인 범위: 키트 칸이 위층에 통째로 있는가, 칸 통행이 선언과 같은가(시트 통행표). 이벤트 실행·그림의 미감·3/4 시점(이 그림들은 관문 미통과다)·모델이 실제로 잘 놓는지는 보지 않는다.")
    return '\n'.join(L)


def objects_refs():
    """(문서 목록, 그림 목록) — spec.json 이 없으면 빈 목록."""
    if not os.path.exists(OBJ_SPEC): return [], []
    spec = json.load(open(OBJ_SPEC, encoding='utf-8'))
    d = objects_scene(spec); errs = objects_check(d, spec)
    assert not errs, errs[:4]
    im = RS.render(d); im.save(os.path.join(IMG, 'objects-scene.png'), optimize=True)
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(IMG, 'objects-scene-3x.png'), optimize=True)
    W = d['width']; rows = []; pics = []
    t1 = json.loads(json.dumps(d)); i = 6 * W + 10; t1['lower'][i] = t1['upper'][i]; t1['upper'][i] = -1            # 쪽지를 아래층에(모래가 사라진다)
    t2 = json.loads(json.dumps(d)); t2['upper'][2 * W + 6] = -1; t2['upper'][2 * W + 7] = -1                          # 제단 윗줄을 뺌
    for desc, t, box in (('쪽지 칸을 위층에서 빼 아래층에 찍음 (10,6) — 모래가 사라지고 둘레가 뚫린다', t1, (10, 6, 1, 1)), ('봉인 제단 윗줄 두 칸을 뺌 (6,2)·(7,2) — 제단이 잘린다', t2, (6, 2, 2, 1))):
        e = objects_check(t, spec); assert e, desc; rows.append((desc, e))
        pic = RS.render(t); dr = ImageDraw.Draw(pic); x, y, w, h = box
        dr.rectangle([x * 16, y * 16, (x + w) * 16 - 1, (y + h) * 16 - 1], outline=(255, 30, 30, 255), width=1); pics.append(pic)
    S = 2; cmp_ = Image.new('RGBA', (im.width * S * 3 + 16, im.height * S), (20, 20, 28, 255))
    for n, pic in enumerate([im] + pics): cmp_.paste(pic.resize((pic.width * S, pic.height * S), Image.NEAREST), (n * (im.width * S + 8), 0))
    cmp_.save(os.path.join(IMG, 'objects-err.png'), optimize=True)
    docs = [dict(id='de-objects', name='desert_east · 이야기 기물 8종(샘·제단·화단·기록부·쪽지·표식·파편·비문 돌) — 사전·순서·예제·오류', markdown=objects_md(spec, d, rows))]
    imgs = [dict(id='de-img-objects-scene', name='objects-scene.png', caption=f"이야기 기물 8종 조립 예제 — 원본 해상도 {im.width}×{im.height}(시트 칸 이어 붙임). 3/4 관문 미통과 — 오너 면제 그림.", dataUrl=URL('objects-scene.png')),
            dict(id='de-img-objects-scene-3x', name='objects-scene-3x.png', caption='같은 장면 3배 최근접 확대.', dataUrl=URL('objects-scene-3x.png')),
            dict(id='de-img-objects-err', name='objects-err.png', caption='정상(왼쪽) · 쪽지를 아래층에(가운데) · 제단 윗줄 빠짐(오른쪽), 2배 최근접. 빨간 상자 = 변조 자리.', dataUrl=URL('objects-err.png'))]
    return docs, imgs


# ───────────────────────── 다른 그림·새 기물·겉모습 재질(de-variety) ─────────────────────────
VAR_SPEC = os.path.join(ROOT, 'tiledata/desert-east/variety/spec.json')
VAR_SCENE = [('de-notice-board', 1, 4), ('de-barrels', 4, 5), ('de-barrel', 7, 5), ('de-stop-lever', 9, 4), ('de-save-crystal', 11, 4), ('de-hatch-down', 13, 4),
             ('de-room-door', 8, 0)]     # (키트, 왼쪽 위 x, y) — 16×8: 윗 두 줄은 실내 벽면(방 문), 아래는 모래


def variety_scene(spec):
    W, H = 16, 8
    sand = [PIECES['tiles'][n] for n in ('de-sand', 'de-sand-b', 'de-sand-c', 'de-sand-d')]
    d = dict(width=W, height=H, lower=[sand[(x * 7 + y * 13) % 4] for y in range(H) for x in range(W)], upper=[-1] * (W * H))
    wall = KIT['de-wall-plaster']
    for x in range(W):
        for r in range(2): d['lower'][r * W + x] = wall['rows'][r]['tiles'][0]
    have = {it['id'] for it in spec['items']}
    scene = [(k, x, y) for k, x, y in VAR_SCENE if k in have and k in KIT]
    for kid, x, y in scene: stamp(d, kid, x, y)
    return d, scene


def variety_check(d, spec, scene):
    W = d['width']; by = {it['id']: it for it in spec['items']}; errs = []
    for kid, ox, oy in scene:
        it = by[kid]; k = KIT[kid]; block = {tuple(c) for c in it['block']}
        for r, row in enumerate(k['rows']):
            for c, t in enumerate(row['upperTiles']):
                if t < 0: continue
                i = (oy + r) * W + ox + c
                if d['upper'][i] != t: errs.append(('E_OBJ_LAYER' if d['lower'][i] == t else 'E_OBJ_INCOMPLETE', kid, ox + c, oy + r)); continue
                if passable(t) == ((c, r) in block): errs.append(('E_OBJ_PASSAGE', kid, ox + c, oy + r))
                if it['place'] in ('wallmount', 'walldoor') and passable(d['lower'][i]): errs.append(('E_OBJ_OFF_WALL', kid, ox + c, oy + r))
    return errs


def variety_sheets(spec):
    """그림 둘: 원본 옆에 변형(variety-variants.png) · 겉모습 재질 견본(variety-looks.png — 재질마다 모래/길/광장 가장자리 왕 타일 4×4)."""
    bases = {}
    for it in spec['items']:
        if it.get('variantOf') and it['id'] in KIT: bases.setdefault(it['variantOf'], []).append(it['id'])
    S, pad, Wd = 2, 8, 1400
    x = y = pad; rowh = 0; place = []
    for b, vs in bases.items():
        ims = [BL.reassemble(KIT[k], SHEET, TPR) for k in [b] + vs]
        w = sum(im.width * S + 4 for im in ims) + 6; h = max(im.height for im in ims) * S + 14
        if x + w + pad > Wd: x, y, rowh = pad, y + rowh + pad, 0
        place.append((x, y, b, ims)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + pad), (214, 184, 132, 255)); dr = ImageDraw.Draw(sheet)
    for x0, y0, b, ims in place:
        dr.text((x0, y0), b.replace('de-', ''), fill=(40, 24, 16, 255), font=FONT)
        xx = x0; hh = max(im.height for im in ims) * S
        for n, im in enumerate(ims):
            sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (xx, y0 + 14 + hh - im.height * S)); xx += im.width * S + 4
            if n == 0: dr.line([(xx, y0 + 14), (xx, y0 + 14 + hh)], fill=(120, 90, 50, 255)); xx += 4
    sheet.save(os.path.join(IMG, 'variety-variants.png'), optimize=True)
    looks = PIECES.get('looks') or {}
    rows = [(sid, name, tiles) for sid, sets in (looks.get('wang') or {}).items() for name, tiles in sets.items()]
    Z = 2; per = 6
    im = Image.new('RGBA', (per * (64 * Z + 10) + 6, (len(rows) + per - 1) // per * (64 * Z + 20) + 6), (40, 36, 44, 255)); dr = ImageDraw.Draw(im)
    for n, (sid, name, tiles) in enumerate(rows):
        ox, oy = 6 + (n % per) * (64 * Z + 10), 4 + (n // per) * (64 * Z + 20)
        dr.text((ox, oy), f'{sid} · {name}', fill=(255, 255, 255, 255), font=FONT)
        for i, t in enumerate(tiles): im.alpha_composite(RS.tile(t).resize((16 * Z, 16 * Z), Image.NEAREST), (ox + (i % 4) * 16 * Z, oy + 14 + (i // 4) * 16 * Z))
    im.save(os.path.join(IMG, 'variety-looks.png'), optimize=True)
    return bases


def variety_md(spec, d, scene, tamper_rows, bases):
    by = {it['id']: it for it in spec['items']}
    looks = PIECES.get('looks') or {}
    L = [f"# desert_east · 같은 종류의 다른 그림 · 새 집 · 새 기물 · 게임마다 고르는 바닥 재질\n\n{HEAD}\n",
         f"같은 사막 칩셋으로 지은 게임들이 서로 달라 보이게 2026-11-13 에 더한 그림이다. **모두 3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 {spec['waiver']}, Claude Fable 5.2 한 방 그림과 그 코드 조립) — 관문 영수증이 없고 스토어로는 나가지 않는다. "
         "정의 `tiledata/desert-east/variety/spec.json`, 그림 `variety/pieces/`, 굽기는 다른 조각과 같은 `bake_de.py`.\n",
         "## 1. 사전\n\n### 1-1. 변형 키트(같은 종류의 다른 그림)\n\n변형은 원본 키트와 **칸 크기·채운 칸·칸마다 통행·층·문 칸이 같다**(킷 `ai.variantOf` = 원본 id). 원본 자리에 그대로 갈아 끼울 수 있다. 칸 번호 전체 배열은 «사전» 문서의 키트 절에 있다(같은 id).\n",
         "| 원본 키트 | 크기 | 변형 키트 |\n|---|---|---|"]
    for b, vs in bases.items(): L.append(f"| `{b}` {KIT[b]['name']} | {KIT[b]['width']}×{KIT[b]['height']} | {' · '.join('`%s`' % v for v in vs)} |")
    L.append("\n### 1-2. 새 집(평지붕 직각 지붕 + 남쪽 앞벽)\n\n| 키트 id | 이름 | 크기 | 문 칸 x(맨 아랫줄, 막힘) | 접근칸 |\n|---|---|---|---|---|")
    for it in spec['items']:
        if it['type'] == 'house' and not it.get('variantOf') and it['id'] in KIT: L.append(f"| `{it['id']}` | {it['name']} | {it['w']}×{it['h']} | {', '.join(map(str, it['entrance']))} | 문 바로 아래 줄(걸을 수 있는 길·마당) |")
    L.append("\n### 1-3. 새 기물\n\n모든 칸은 **위층(upperTiles)**. 서 있는 기물: 막힌 칸은 네 방향 막힘, 나머지 칸은 ★(사람 위에 그려지고 걷는다). 바닥 그림(decal): 사람 아래·걷는다. 벽면 기물(wallmount·door): 실내 벽면 칸(벽 두 줄) 위층에만.\n")
    L.append("| 키트 id | 무엇 | 크기 | 위층 칸 번호(위 줄 / 아래 줄) | 놓는 방식 | 막힌 칸 (dx,dy) | 찾는 낱말(키트 태그) |\n|---|---|---|---|---|---|---|")
    how = dict(prop='서 있는 기물', tall='서 있는 기물', decal='바닥 그림(밟고 지나감)', wallmount='벽면에 건다', walldoor='벽면의 문')
    for it in spec['items']:
        if it['type'] != 'object' or it['id'] not in KIT: continue
        k = KIT[it['id']]
        L.append(f"| `{it['id']}` | {it['name']} | {it['w']}×{it['h']} | {' / '.join(' '.join(map(str, r['upperTiles'])) for r in k['rows'])} | {how[it['place']]} | {' '.join('(%d,%d)' % tuple(c) for c in it['block']) or '—'} | {', '.join(it['words'])} |")
    L.append("\n### 1-4. 겉모습 재질(게임마다 고르는 바닥·길·광장)\n\n갈래 셋(ground 모래 · road 길 · plaza 광장)마다 재질 이름 하나를 고른다(\"\" = 원래 그림). 한 칸 바닥은 원래 조각 id 자리에 그 재질의 칸을, 모서리 왕 타일은 그 재질 묶음의 16칸을 쓴다 — 번호 규칙(NW1+NE2+SW4+SE8)·통행은 원래 벌과 같다. 가장자리 꼴은 원래 왕 타일과 같은 코드가 만들었다(재질 화소만 새 그림).\n")
    L.append("| 갈래 | 고를 수 있는 재질 |\n|---|---|")
    for part, names in (looks.get('parts') or {}).items(): L.append(f"| {part} | {' · '.join('`%s`' % (n or '(원래)') for n in names)} |")
    L.append("\n| 재질 | 원래 조각 id → 칸 번호 |\n|---|---|")
    for name, m in (looks.get('tiles') or {}).items(): L.append(f"| `{name}` | {' · '.join('%s→%d' % kv for kv in m.items())} |")
    L.append("\n| 벌 | 재질 묶음(ground+road / ground+plaza) | 칸 번호 0..15 |\n|---|---|---|")
    for sid, sets in (looks.get('wang') or {}).items():
        for name, tiles in sets.items(): L.append(f"| `{sid}` | `{name}` | `{arr(tiles)}` |")
    L.append("\n## 2. 실행 순서\n\n1. **구성 도구가 고른다**: `compose_desert_east_map`·`compose_desert_east_room` 은 조수 실행(게임 열쇠)이면 원본 id 로 놓는 자리마다 그 게임의 그림(원본 또는 변형 하나)을, 땅에는 그 게임의 재질을 깐다. 한 게임은 어느 맵에서나 같은 그림·같은 재질이다. 열쇠가 없으면(사람 편집) 원래 그림만.\n"
             "2. **손으로 놓을 때**: `stamp_tileset_object`·`place_object` 에 원본 id 를 주면 같은 규칙으로 그 게임의 그림이 놓인다. 변형 id 를 직접 주면 그 그림 그대로. 놓는 자리 규칙은 원본과 같다(키트 `placementRules`).\n"
             "3. **바닥을 손으로 칠할 때**: 한 맵에 한 재질만 — 원래 모래 옆에 다른 재질의 모래 칸을 섞지 않는다. 가장자리는 그 재질 묶음의 왕 타일 16칸으로(번호 규칙은 «사전» 문서).\n"
             "4. **새 기물**: 통·게시판은 구성 도구가 광장·집 곁에 놓는다. 레버·내려가는 계단 입구·방 문·세이브 수정은 이야기가 부를 때만(키트 태그 «주제 소품»). 방 문은 실내 벽면 칸 위에만, 계단 입구는 남쪽 한 줄을 비우고.\n"
             "5. 그림일 뿐이다 — 읽기·당기기·내려가기·저장은 이벤트를 따로 둔다(막힌 칸의 이벤트는 «같은 높이·결정 키», 계단 입구는 윗줄 칸 «닿으면»).\n")
    arrs = lambda a: '\n'.join(arr(a[y * d['width']:(y + 1) * d['width']]) for y in range(d['height']))
    L.append(f"## 3. 조립 예제 {d['width']}×{d['height']} (그림 `variety-scene.png` 원본 해상도 · `variety-scene-3x.png`) — 윗 두 줄은 실내 벽면\n\n놓은 순서(키트 · 왼쪽 위): "
             + ' · '.join(f"`{p}` ({x},{y})" for p, x, y in scene) + f"\n\n아래층 lower(한 줄 = 맵 한 줄, index = y*{d['width']}+x):\n```\n{arrs(d['lower'])}\n```\n\n위층 upper:\n```\n{arrs(d['upper'])}\n```\n")
    L.append("## 4. 정상/오류 (실제로 변조해 검출, 그림 `variety-err.png` — 왼쪽 정상 · 오른쪽 변조, 빨간 상자)\n\n| 변조 | 검출 코드 | 첫 오류(코드, 키트, x, y) |\n|---|---|---|")
    for desc, errs in tamper_rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_OBJ_LAYER 키트 칸이 아래층에 있다 · E_OBJ_INCOMPLETE 키트 칸이 빠졌다 · E_OBJ_PASSAGE 칸 통행이 선언과 다르다 · E_OBJ_OFF_WALL 벽면 기물이 벽면 칸 밖에 있다.\n"
             "확인 범위: 새 기물 칸이 위층에 통째로 있는가 · 통행이 선언과 같은가 · 벽면 기물이 벽면 위인가. 변형 키트의 칸 크기·통행이 원본과 같은지는 저장소 시험(`test/desertEastVariety.test.ts`)이 본다. 그림의 미감·3/4 시점(관문 미통과)·모델이 실제로 잘 놓는지는 보지 않는다.\n"
             "그림: `variety-variants.png`(원본 | 변형, 2배) · `variety-looks.png`(재질 묶음마다 왕 타일 16칸, 2배).")
    return '\n'.join(L)


def variety_refs():
    """(문서 목록, 그림 목록) — variety/spec.json 이 없으면 빈 목록."""
    if not os.path.exists(VAR_SPEC): return [], []
    spec = json.load(open(VAR_SPEC, encoding='utf-8'))
    d, scene = variety_scene(spec); errs = variety_check(d, spec, scene)
    assert not errs, errs[:4]
    im = RS.render(d); im.save(os.path.join(IMG, 'variety-scene.png'), optimize=True)
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(IMG, 'variety-scene-3x.png'), optimize=True)
    W = d['width']; rows = []; pics = []
    pos = {k: (x, y) for k, x, y in scene}
    hx, hy = pos['de-hatch-down']; nx, ny = pos['de-notice-board']; lx, ly = pos['de-room-door']
    t1 = json.loads(json.dumps(d)); i = hy * W + hx; t1['lower'][i] = t1['upper'][i]; t1['upper'][i] = -1                       # 계단 입구 한 칸을 아래층에
    t2 = json.loads(json.dumps(d)); t2['upper'][ny * W + nx] = -1; t2['upper'][ny * W + nx + 1] = -1                             # 게시판 윗줄을 뺌
    t3 = json.loads(json.dumps(d))                                                                                               # 방 문을 모래 바닥으로 옮김
    for r in range(2): t3['upper'][(ly + 5 + r) * W + lx] = t3['upper'][(ly + r) * W + lx]; t3['upper'][(ly + r) * W + lx] = -1
    def check3(t):   # 옮긴 자리로 검사(장면 좌표를 바꿔서)
        return variety_check(t, spec, [(k, x, y + 5) if k == 'de-room-door' else (k, x, y) for k, x, y in scene])
    for desc, t, box, chk in ((f'계단 입구 왼쪽 위 칸을 위층에서 빼 아래층에 찍음 ({hx},{hy}) — 모래가 사라진다', t1, (hx, hy, 1, 1), lambda t: variety_check(t, spec, scene)),
                              (f'게시판 윗줄 두 칸을 뺌 ({nx},{ny})·({nx + 1},{ny}) — 지붕이 잘린다', t2, (nx, ny, 2, 1), lambda t: variety_check(t, spec, scene)),
                              (f'방 문을 벽면에서 모래 바닥 ({lx},{ly + 5}) 로 옮김 — 벽면 기물이 바닥에 뜬다', t3, (lx, ly + 5, 1, 2), check3)):
        e = chk(t); assert e, desc; rows.append((desc, e))
        pic = RS.render(t); dr = ImageDraw.Draw(pic); x, y, w, h = box
        dr.rectangle([x * 16, y * 16, (x + w) * 16 - 1, (y + h) * 16 - 1], outline=(255, 30, 30, 255), width=1); pics.append(pic)
    S = 2; cmp_ = Image.new('RGBA', (im.width * S * 2 + 8, im.height * S * 2 + 8), (20, 20, 28, 255))
    for n, pic in enumerate([im] + pics): cmp_.paste(pic.resize((pic.width * S, pic.height * S), Image.NEAREST), ((n % 2) * (im.width * S + 8), (n // 2) * (im.height * S + 8)))
    cmp_.save(os.path.join(IMG, 'variety-err.png'), optimize=True)
    bases = variety_sheets(spec)
    nv = sum(len(v) for v in bases.values())
    docs = [dict(id='de-variety', name=f'desert_east · 같은 종류의 다른 그림 {nv}종·새 집·새 기물·게임마다 고르는 바닥 재질 — 사전·순서·예제·오류', markdown=variety_md(spec, d, scene, rows, bases))]
    imgs = [dict(id='de-img-variety-scene', name='variety-scene.png', caption=f"새 기물 조립 예제 — 원본 해상도 {im.width}×{im.height}(윗 두 줄은 실내 벽면 — 방 문). 3/4 관문 미통과 — 오너 면제 그림.", dataUrl=URL('variety-scene.png')),
            dict(id='de-img-variety-scene-3x', name='variety-scene-3x.png', caption='같은 장면 3배 최근접 확대.', dataUrl=URL('variety-scene-3x.png')),
            dict(id='de-img-variety-err', name='variety-err.png', caption='정상(왼쪽 위) · 계단 입구 칸을 아래층에 · 게시판 윗줄 빠짐 · 방 문을 바닥으로, 2배 최근접. 빨간 상자 = 변조 자리.', dataUrl=URL('variety-err.png')),
            dict(id='de-img-variety-variants', name='variety-variants.png', caption=f'원본(세로선 왼쪽)과 같은 종류의 다른 그림 {nv}종(오른쪽), 2배. 3/4 관문 미통과 — 오너 면제 그림.', dataUrl=URL('variety-variants.png')),
            dict(id='de-img-variety-looks', name='variety-looks.png', caption='게임마다 고르는 바닥·길·광장 재질 — 재질 묶음마다 모서리 왕 타일 16칸(번호 순 4×4), 2배.', dataUrl=URL('variety-looks.png'))]
    return docs, imgs


def main():
    n_out = kit_sheet(None, 'kits-outdoor.png', True); n_in = kit_sheet(None, 'kits-interior.png', False); wang_sheet()
    exs = {}
    for kind, W, H, seed, title in EXAMPLES:
        d = run('compose-scene.mts', f'/tmp/de-ref-{kind}.json', kind, W, H, seed); exs[kind] = (title, d)
        RS.render(d).save(os.path.join(IMG, f'ex-{kind}.png'), optimize=True)
        assert not validate(d), (kind, validate(d)[:3])
    rooms = {}
    for kind, W, H, title in ROOMS:
        d = run('compose-room.mts', f'/tmp/de-ref-room-{kind}.json', kind, W, H, 1); rooms[kind] = (title, d)
        RS.render(d).save(os.path.join(IMG, f'room-{kind}.png'), optimize=True)
    base = exs['oasis'][1]; rows = []; pics = [RS.render(base)]
    for kind, desc, t, boxes in tampers(base):
        errs = validate(t); rows.append((kind, desc, errs))
        im = RS.render(t); dr = ImageDraw.Draw(im)
        for x, y, w, h in boxes: dr.rectangle([x * 16, y * 16, (x + w) * 16 - 1, (y + h) * 16 - 1], outline=(255, 30, 30, 255), width=3)
        pics.append(im)
    s = 0.5; tw, th = int(pics[0].width * s), int(pics[0].height * s)
    cmp_ = Image.new('RGBA', (tw * 3 + 16, th * 2 + 8), (20, 20, 28, 255))
    for i, im in enumerate(pics[:6]): cmp_.paste(im.resize((tw, th), Image.NEAREST), ((i % 3) * (tw + 8), (i // 3) * (th + 8)))
    cmp_.save(os.path.join(IMG, 'err-compare.png'), optimize=True)
    assert all(errs for _, _, errs in rows), [k for k, _, e in rows if not e]
    imgs = [dict(id='de-img-kits-outdoor', name='kits-outdoor.png', caption=f'야외 키트 도감 {n_out}종(원본 ×2). 이야기 기물 8종(봉인 제단·화단·샘·기록부·쪽지·표식·파편·비문 돌)은 3/4 관문 미통과 — 오너 면제 그림이고, 나머지는 object-gate 영수증이 있는 그림.', dataUrl=URL('kits-outdoor.png')),
            dict(id='de-img-wang', name='wang-sets.png', caption='모서리 왕 타일 다섯 벌(×3) — 번호 0..15 = NW1+NE2+SW4+SE8.', dataUrl=URL('wang-sets.png'))]
    for kind, W, H, _, title in EXAMPLES:
        imgs.append(dict(id=f'de-img-ex-{kind}', name=f'ex-{kind}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'ex-{kind}.png')))
    imgs.append(dict(id='de-img-err-compare', name='err-compare.png', caption='오아시스 예제 정상(왼쪽 위)과 변조 4종(문 앞 막힘·맵 밖·겹침·길 끊김, 빨간 테두리 = 변조 자리).', dataUrl=URL('err-compare.png')))
    docs = [dict(id='de-howto', name='desert_east 야외 · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md()),
            dict(id='de-dictionary', name='desert_east · 사전(바닥·왕 타일·키트 전체 배열)', markdown=dictionary_md())]
    for kind, _, _, _, title in EXAMPLES:
        docs.append(dict(id=f'de-ex-{kind}', name=f'desert_east 야외 예제 · {title}', markdown=example_md(title, exs[kind][1], f'ex-{kind}.png', kind)))
    docs.append(dict(id='de-errors', name='desert_east 야외 · 정상/오류 변조 검출', markdown=errors_md(rows)))
    odocs, oimgs = objects_refs(); docs += odocs; imgs += oimgs
    vdocs, vimgs = variety_refs(); docs += vdocs; imgs += vimgs
    out_cat = dict(id='de-outdoor', name='desert_east · 사막·동양풍 야외 (사전 · 순서 · 예제 5 · 변조 오류)',
                   description='오아시스 마을·바자르 거리·궁전·피라미드 유적·대상 숙소를 짓는 법. 구성 도구 compose_desert_east_map, 바닥·왕 타일·키트 전체 배열, 문 그림/접근칸/이벤트 분리, 완성 예제 5장(구성기 실제 출력), 변조 오류.', documents=docs, images=imgs)
    rimgs = [dict(id='de-img-kits-interior', name='kits-interior.png', caption=f'실내 키트 도감 {n_in}종(원본 ×2).', dataUrl=URL('kits-interior.png'))]
    rdocs = [dict(id='de-room-howto', name='desert_east 실내 · 방 구조·가구 규칙(먼저 읽는다)', markdown=room_howto_md())]
    for kind, W, H, title in ROOMS:
        rimgs.append(dict(id=f'de-img-room-{kind}', name=f'room-{kind}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도.', dataUrl=URL(f'room-{kind}.png')))
        rdocs.append(dict(id=f'de-room-ex-{kind}', name=f'desert_east 실내 예제 · {title}', markdown=room_md(title, rooms[kind][1], f'room-{kind}.png', kind)))
    in_cat = dict(id='de-interior', name='desert_east · 사막·동양풍 실내 (방 구조 · 예제 6)',
                  description='찻집·가게·궁전 알현실·피라미드 묘실·목욕탕·여관 방을 짓는 법. 구성 도구 compose_desert_east_room, 천장·벽·테 문법, 가구 규칙, 완성 예제 6장.', documents=rdocs, images=rimgs)
    json.dump([out_cat, in_cat], open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for kind, desc, errs in rows: print('변조', kind, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs) + len(rdocs), 'images', len(imgs) + len(rimgs))


if __name__ == '__main__':
    main()
