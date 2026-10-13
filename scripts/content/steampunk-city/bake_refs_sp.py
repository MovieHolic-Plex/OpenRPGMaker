#!/usr/bin/env python3
"""steampunk_city 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기 출력에서 기계적으로 만든다.

  python3 scripts/content/steampunk-city/bake_sp.py && python3 scripts/content/steampunk-city/bake_refs_sp.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/steampunkCityComposer.ts(compose_steampunk_city_map 도구와 같은 함수)를 qa/compose-scene.mts 로 돌린 결과다.
산출: src/assets/steampunkCityReferences.json (그림은 경로만) · public/assets/steampunk-city-references/*.png
용도 1개 `sp-steampunk`: sp-howto · sp-dictionary · sp-ex-street · sp-ex-industrial · sp-ex-dock · sp-ex-boiler-room · sp-ex-tavern · sp-errors.
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa'))
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

DATA = json.load(open(os.path.join(ROOT, 'src/assets/steampunkCityTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/steampunk-city/steampunk-city-chipset.png')).convert('RGBA')
TPR = DATA['tilesPerRow']; N = DATA['count']
IMG = os.path.join(ROOT, 'public/assets/steampunk-city-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(ROOT, 'src/assets/steampunkCityReferences.json')
URL = lambda n: '/assets/steampunk-city-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
EXAMPLES = [('street', 'street', 48, 34, 1, '증기 도시 거리 48×34'), ('industrial', 'industrial', 52, 40, 1, '공장 지대 + 기차역 52×40'), ('dock', 'dock', 48, 34, 1, '운하 부두 + 비행선 정박장 48×34'),
            ('boiler-room', 'boiler-room', 15, 11, 1, '보일러실 15×11'), ('tavern', 'tavern', 18, 13, 2, '선술집 18×13')]
HEAD = (f"tilesetId `steampunk_city` · 그림 `public/assets/steampunk-city/steampunk-city-chipset.png`(텍스처 `tex_steampunk_city`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-steampunk` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·캠퍼스·하늘섬·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트는 steampunk_city 잠금 팔레트(재질 22·116색)만. 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 모든 그림은 object-gate 3/4 관문 영수증이 있는 조각만 구웠다.")


def arr(a): return json.dumps(a, separators=(',', ':'))
def passable(t): return t < 0 or bool(DATA['passability'][t]['up'])
def outdoor_kits(): return [k for k in DATA['structureKits'] if k.get('learnedFrom') == 'pack-preset']


def compose(style, W, H, seed):
    out = os.path.join('/tmp', f'sp-ref-{style}-{seed}.json')
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'compose-scene.mts'), '--', out, style, str(W), str(H), str(seed)],
                   cwd=ROOT, check=True, capture_output=True)
    return json.load(open(out))


def validate(d):
    """E_START_BLOCKED · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE · E_EXIT_UNREACHABLE · W_ISLAND + E_OVERLAP(건물 사각형)."""
    errs = list(RS.validate(d))
    bs = d['buildings']
    for i in range(len(bs)):
        a = bs[i]['rect']
        for b in bs[i + 1:]:
            r = b['rect']
            if a['x'] < r['x'] + r['w'] and r['x'] < a['x'] + a['w'] and a['y'] < r['y'] + r['h'] and r['y'] < a['y'] + a['h']: errs.append(('E_OVERLAP', f"{bs[i]['name']}/{b['name']}", r['x'], r['y']))
    return errs


def kit_of(kid): return next(k for k in DATA['structureKits'] if k['id'] == kid)


def stamp(d, kit_id, x, y):
    k = kit_of(kit_id); W = d['width']
    for r, row in enumerate(k['rows']):
        for c in range(k['width']):
            X, Y = x + c, y + r
            if not (0 <= X < W and 0 <= Y < d['height']): continue
            if row['tiles'][c] >= 0: d['lower'][Y * W + X] = row['tiles'][c]
            if row['upperTiles'][c] >= 0: d['upper'][Y * W + X] = row['upperTiles'][c]
    return k


def tampers(d):
    out = []
    b0 = d['buildings'][1] if len(d['buildings']) > 1 else d['buildings'][0]
    t = json.loads(json.dumps(d)); a = b0['access'][0]; stamp(t, 'sp-barrels', a['x'], a['y'] - 1)
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 통 두 개", t, [(a['x'], a['y'] - 1, 2, 2)]))
    t = json.loads(json.dumps(d)); b1, b2 = t['buildings'][0], t['buildings'][1]; b2['rect']['x'] = b1['rect']['x'] + 1; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김(사각형 겹침)", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    t = json.loads(json.dumps(d)); y = d['start']['y'] - 1
    for x in range(d['width']): stamp(t, 'sp-fence', x, y)
    out.append(('unreachable', f"시작 칸 바로 위 {y}줄 전체를 철 울타리로 막음", t, [(0, y, d['width'], 1)]))
    t = json.loads(json.dumps(d)); door = b0['doors'][0]; W = d['width']
    t['lower'][door['y'] * W + door['x']] = next(g['tileIds'][0] for g in DATA['tileGroups'] if g['id'] == 'sp:sp-flag'); t['upper'][door['y'] * W + door['x']] = -1
    out.append(('door-open', f"{b0['name']} 문 칸 ({door['x']},{door['y']})을 지우고 판석으로(문 그림 대신 빈 길)", t, [(door['x'], door['y'], 1, 1)]))
    return out


def kit_sheet(filter_fn, name):
    ks = [k for k in DATA['structureKits'] if filter_fn(k)]; S = 2; pad = 8
    items = [(k, BL.reassemble(k, SHEET, TPR)) for k in ks]
    Wd = 1400; x = y = pad; rowh = 0; place = []
    for k, im in sorted(items, key=lambda t: -t[1].height):
        w, h = im.width * S, im.height * S + 14
        if x + w + pad > Wd: x, y, rowh = pad, y + rowh + pad, 0
        place.append((x, y, k, im)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + pad), (58, 56, 66, 255)); dr = ImageDraw.Draw(sheet)
    for x0, y0, k, im in place:
        dr.text((x0, y0), k['id'].replace('sp-', ''), fill=(255, 255, 255, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, name), optimize=True)
    return len(ks)


def is_interior_kit(k): return '실내' in (k.get('ai', {}).get('tags') or [])


def dictionary_md():
    L = [f"# steampunk_city · 사전 (바닥 한 칸 + 키트 전체 배열)\n\n{HEAD}\n"]
    L.append("## 바닥(낱칸, 반복해 칠한다)\n\n`fill_region` 의 material 에 **이름 그대로** 쓴다. 번호는 이 시트의 칸 번호(아래층). «막힘» 바닥(물·석축·배관 도랑·승강장 끝·부두 끝·벽면·천장)은 아래층이지만 걸을 수 없다.\n")
    L.append('| 이름 | 조각 id | 칸 번호 | 통행 | 규칙 |\n|---|---|---|---|---|')
    for g in DATA['tileGroups']:
        if len(g['tileIds']) >= 1 and g['id'].startswith('sp:sp-') and g['role'] in ('terrain', 'wall'):
            t = g['tileIds'][0]
            L.append(f"| {g['name']} | `{g['id'][3:]}` | {t}{' (+프레임 ' + ','.join(map(str, g['tileIds'][1:])) + ')' if len(g['tileIds']) > 1 else ''} | {'걷는다' if passable(t) else '막힘'} | {g.get('placementRules', '')[:90]} |")
    L.append("\n## 배관 도랑(오토타일) 고르는 법\n\n칸마다 북(N)·동(E)·남(S)·서(W) 이웃 배관과 이어진 변으로 이름을 고른다: 두 변 `pipe-ew`/`pipe-ns`/`pipe-ne`/`pipe-nw`/`pipe-se`/`pipe-sw`, 세 변 `pipe-new`/`pipe-sew`/`pipe-nes`/`pipe-nsw`, 끝 `pipe-e`/`pipe-w`/`pipe-n`/`pipe-s`(이어진 쪽 한 변). "
             "건물 벽으로 들어가는 칸은 북쪽 변을 이은 것으로 친다. 배관 도랑은 막힘 — 사람이 건너는 칸은 덮개 `pipe-grate-ew`(동서 배관 위)·`pipe-grate-ns`(남북 배관 위)로 바꾼다(걷는다).\n")
    L.append("\n## 키트(여러 칸 물체) — `list_tileset_objects` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **건물**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. "
             "키트는 전부 고정 조각이다(이어 찍기 없음) — 철 울타리 `sp-fence`(동서, 1×1)·`sp-fence-v`(남북, 1×1)만 칸마다 이어 찍는다. 움직이는 키트(증기 구멍·굴뚝 연기·보일러·기관·테슬라 코일·벽난로)는 찍으면 프레임이 자동 반복된다.\n")
    for k in DATA['structureKits']:
        t = [r['tiles'] for r in k['rows']]; u = [r['upperTiles'] for r in k['rows']]
        ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
        extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄(걸을 수 있어야 함)" if ent else ''
        L.append(f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:160]}\n- 규칙: {k['ai'].get('placementRules', '')[:200]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n")
    return '\n'.join(L)


def howto_md():
    return f"""# steampunk_city · 거리·공장·역·운하·실내 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_steampunk_city_map({{style, seed?, buildings?, newMap?:{{name}}, replace?}})` 가 아래 순서·규칙대로 한 장을 **매번 다르게** 짠다. 새 맵이 필요하면 `newMap:{{name}}` — 칩셋·크기를 맞춰 맵을 만든다.
  - 야외: `street`(44×34 이상) · `industrial`(48×40 이상) · `dock`(46×34 이상). 실내: `boiler-room` · `engine-room` · `workshop` · `lab` · `inn` · `tavern`(14×11 안팎).
  - `buildings` = 북쪽 건물 줄(왼쪽부터 키트 끝말). 예 `["row-3","row-flush-3","row-4","shop-gears","inn","tavern"]`.
  - 시작 칸에서 모든 문 접근칸(실내는 출구)에 닿는지 엔진 통행으로 확인해 안 되면 깔지 않는다(맵을 바꾸지 않는다).
- 건물 문 ↔ 실내: 같은 도구의 실내 style + `newMap` 으로 방을 짓고 `link_steampunk_interior({{mapId, door:{{x,y}}, width:2, interiorMapId}})` 로 잇는다. 문 좌표는 compose 결과 `data.buildings[].doors`.

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **계획(구역 줄)**: 북쪽 건물 줄 → 보도·길 → 남쪽 쓰임 구역. 빈 땅은 남기지 않고 쓰임을 준다 — 뒷골목(석탄재), 시장 광장(벽돌 포석, 판석 테 안쪽), 철 울타리 쌈지 공원(풀), 석탄 마당(석탄재), 승강장(판석), 화물 측선·하역장, 비행선 정박장(판자).
2. **건물 줄**: 밑변(baseY)을 맞춘다. 연립(row-3·row-flush-3·row-4)은 어깨를 붙이고(틈 0), 다른 건물 사이는 2칸 골목(자갈). 문은 모두 남향.
3. **거리(street)**: 북쪽 보도 3줄(판석) → 연석(curb-s) → 차도 6줄(자갈, 둘째·셋째 줄이 노면 궤도 tram-n·tram-s) → 연석(curb-n) → 남쪽 보도. 그 남쪽에 시장 광장 + 쌈지 공원.
4. **공장·역(industrial)**: 공장 줄 → 공장 마당 7줄(석탄재, 셋째 줄에 보일러실 → 공장 배관 도랑, 문 접근 열·마당 출입구 열은 덮개) → 철 울타리(출입구 3칸) → 자갈 길 3줄 → 역 앞 판석 광장(역 건물) → 승강장 2줄 → 승강장 끝 → 본선(rail-n·rail-s) → 석탄재 1줄 → 화물 측선 → 하역장.
5. **운하(dock)**: 부두 창고 줄 → 둑길 4줄(자갈, 석축 위 줄에 계선주 5칸 간격·증기 기중기) → 석축(quay, 막힘) → 물 4줄 → 갓돌(quay-lip, 걷는다) → 남쪽 산책로. 돌다리는 bridge-w·m·m·e 를 석축~갓돌 전체에. 잔교는 deck 2~3줄 + deck-edge(물 위 끝).
6. **실내**: 바깥 테두리 천장(ceiling, 막힘) · 맨 윗줄 안쪽 두 줄 벽면(wall-*-u 위·wall-*-d 아래, 막힘) · 바닥 · 맨 아래 줄 가운데 출입구 틈 2칸(바닥). 벽 장식(배관·압력계·밸브·공구판·선반·톱니 시계)은 벽면 두 줄에만, 키 큰 가구(책장·진열장·옷장·보일러·벽난로)는 윗줄이 벽면 아랫줄에 겹치게 북쪽 벽에 등을 댄다.
7. **소품**: 발자국 + 여백을 예약하고 겹치지 않는다. 자기 바닥 위에만 놓는다 — 석탄·광차·고철은 석탄재 마당, 노점은 광장 포석(앞 2칸 손님 자리), 벤치는 공원·승강장·광장, 계선주·밧줄은 둑 줄·잔교, 가스등은 보도 바깥 줄 6칸 간격. 문 접근칸과 그 아래 한 칸은 비운다. 소품 하나마다 시작 칸 BFS 로 이미 닿던 칸이 끊기지 않는지 확인한다.
8. **바닥 변주**: 자갈·석탄재는 값 잡음 덩이로 얼룩 변주를 섞고, 판석 배수 홈은 드문 낱칸으로만 — 띠 전체를 한 칸으로 칠하지 않는다.

## 선로 탈것
- 선로 한 가닥 = `rail-n` 줄 + 바로 아래 `rail-s` 줄. 탈것(3줄 높이)은 맨 아래 칸이 rail-s, 가운데가 rail-n, 맨 윗줄은 선로 북쪽 줄 위에 겹친다(★ 걸어 지나감).
- 열차: 동쪽이 앞 — [객차][객차][탄수차][기관차]. 차막이 `sp-buffer-stop` 은 측선 끝(두 줄 위). 노면 증기 전차는 차도 궤도(tram-n·tram-s) 위.

## 금지 조건
- 키트끼리 위층 칸이 겹치면 안 된다(가스등 머리가 건물 앞면을 지운다). 건물이 겹치면 안 된다(E_OVERLAP). 문 칸이 걸을 수 있으면 안 되고(E_DOOR_CELL_OPEN) 접근칸이 막히면 안 된다(E_DOOR_ACCESS_BLOCKED). 시작 칸에서 접근칸·출구가 안 닿으면 안 된다(E_DOOR_UNREACHABLE·E_EXIT_UNREACHABLE).
- 차도·선로·물 위에는 서 있는 소품을 놓지 않는다(탈것·바지선 제외).

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 건물 키트 맨 아래 줄 문(막힘). **접근칸** = 문 바로 아래 줄(걸을 수 있는 바닥). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에 건다(link_steampunk_interior 가 만든다).

## 반복 가능 / 고정
- 반복: 바닥 낱칸 전부(자갈·판석·벽돌 포석·석탄재·철판·풀·흙·선로·궤도·물·석축·갓돌·판자·승강장·다리·배관 도랑·실내 바닥·벽면·천장). 고정: 건물·소품·탈것·기중기·비행선·가구.

## 없는 소재
- 하늘섬·떠 있는 섬은 이 칩셋에 없다(다른 칩셋 sky_island). 숲·동굴·산도 없다.
- 3/4 관문을 통과하지 못해 **뺐다**: 곡물 자루 더미(야외)·누운 압력 탱크·급수 기둥·세 칸 철 울타리 묶음 — 없는 키트 id 를 지어 부르지 않는다. 사람: Actor1 캐릭터 이벤트. 글자·간판 글씨·상표는 그리지 않았다.

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 낱칸 바닥은 불투명 아래층(걷는다). 물·석축·배관 도랑·승강장 끝·부두 끝·벽면·천장은 아래층이지만 **막힘**(solidfloor).
- 건물·소품은 위층·막힘. 가스등·시계 기둥·굴뚝·급수탑·노점·탈것 같은 키 큰 키트는 **맨 아래 줄(발자국)만 막힘**이고 그 위 줄은 ★(뒤로 지나가면 사람 위에 그려진다). 굴뚝 연기는 전부 ★. 문형 기중기는 다리 칸만 막힘이고 들보 아래로 지나간다.
- 확인 범위: 구조·좌표·통행(4방 BFS)뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`sp-ex-{k}`({t})' for k, _, _, _, _, t in EXAMPLES)} · `sp-errors`(정상/오류 나란히).
"""


def example_md(title, d, img):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings']) or '- (실내 — 건물 없음)'
    props = collections.Counter(p['kit'] for p in d['props'])
    zones = '\n'.join(f"- {z['name']}({z['use']}): ({z['rect']['x']},{z['rect']['y']}) {z['rect']['w']}×{z['rect']['h']}" for z in d['zones'])
    return f"""# steampunk_city 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/steampunkCityComposer.ts`, compose_steampunk_city_map 과 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_steampunk_city_map({{style:"{d['style']}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}) · 출구 {[(c['x'], c['y']) for c in d['exits']]}.

## 구역(빈 땅마다 쓰임)
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


def errors_md(rows):
    L = ["# steampunk_city · 정상/오류 나란히 (변조 검출)\n", HEAD, "\n거리 예제를 실제로 변조해 검증기(`bake_refs_sp.validate`)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `err-compare.png` 의 빨간 테두리 = 변조 자리.\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for kind, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_OVERLAP 건물 겹침 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE 시작 칸에서 안 닿음 · E_EXIT_UNREACHABLE 출구에 안 닿음 · E_START_BLOCKED 시작 칸 막힘 · W_ISLAND 고립된 걸음 칸.")
    L.append("\n확인 범위: 구조·좌표·통행(4방 BFS). 이벤트 실행·미감은 보지 않는다. 구성 도구는 검사가 실패하면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).")
    return '\n'.join(L)


def main():
    nk = kit_sheet(lambda k: not is_interior_kit(k), 'kits-outdoor.png')
    ni = kit_sheet(is_interior_kit, 'kits-interior.png')
    exs = {}
    for key, style, W, H, seed, title in EXAMPLES:
        d = compose(style, W, H, seed); exs[key] = (title, d)
        RS.render(d).save(os.path.join(IMG, f'ex-{key}.png'), optimize=True)
        assert not validate(d), (key, validate(d)[:3])
    base = exs['street'][1]; rows = []; pics = [RS.render(base)]
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
    imgs = [dict(id='sp-img-kits-outdoor', name='kits-outdoor.png', caption=f'야외 키트 도감 {nk}종(원본 ×2). 전부 object-gate 영수증이 있는 그림.', dataUrl=URL('kits-outdoor.png')),
            dict(id='sp-img-kits-interior', name='kits-interior.png', caption=f'실내 키트 도감 {ni}종(원본 ×2).', dataUrl=URL('kits-interior.png'))]
    for key, _, W, H, _, title in EXAMPLES:
        imgs.append(dict(id=f'sp-img-{key}', name=f'ex-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'ex-{key}.png')))
    imgs.append(dict(id='sp-img-err-compare', name='err-compare.png', caption='거리 예제 정상(왼쪽 위)과 변조 4종(문 앞 막힘·건물 겹침·길 끊김·문 칸 열림, 빨간 테두리 = 변조 자리).', dataUrl=URL('err-compare.png')))
    docs = [dict(id='sp-howto', name='steampunk_city · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md()),
            dict(id='sp-dictionary', name='steampunk_city · 사전(바닥·배관·키트 전체 배열)', markdown=dictionary_md())]
    for key, _, _, _, _, title in EXAMPLES:
        docs.append(dict(id=f'sp-ex-{key}', name=f'steampunk_city 예제 · {title}', markdown=example_md(title, exs[key][1], f'ex-{key}.png')))
    docs.append(dict(id='sp-errors', name='steampunk_city · 정상/오류 변조 검출', markdown=errors_md(rows)))
    cat = dict(id='sp-steampunk', name='steampunk_city · 스팀펑크 도시 (사전 · 순서 · 예제 5 · 변조 오류)',
               description='증기 도시 거리·공장 지대와 기차역·운하 부두·실내 여섯 가지를 짓는 법. 구성 도구 compose_steampunk_city_map, 바닥·배관 사전·키트 전체 배열·문 그림/접근칸/이벤트 분리·완성 예제 5장(구성기 실제 출력 배열)·변조 오류.', documents=docs, images=imgs)
    json.dump([cat], open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for kind, desc, errs in rows: print('변조', kind, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs), 'images', len(imgs))


if __name__ == '__main__':
    main()
