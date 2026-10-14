#!/usr/bin/env python3
"""sengoku_edo 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기·방 짓기 도구 출력에서 기계적으로 만든다.

  python3 scripts/content/sengoku-edo/bake_se.py && python3 scripts/content/sengoku-edo/bake_refs_se.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/sengokuEdoComposer.ts(compose_sengoku_edo_map 도구와 같은 함수)를 qa/compose-scene.mts 로 돌린 결과다.
실내 그림은 qa/check-sengoku-interiors.mts 가 build_hand_interior_room 도구 그대로 지은 맵을 엔진 렌더러로 그린 것이다.
산출: src/assets/sengokuEdoReferences.json (그림은 경로만) · public/assets/sengoku-edo-references/*.png
용도 2개: `se-outdoor`(se-howto · se-dictionary · se-ex-* 4 · se-errors) · `se-interior`(se-interior-howto).
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa')); import shutil
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

DATA = json.load(open(os.path.join(ROOT, 'src/assets/sengokuEdoTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/sengoku-edo/sengoku-edo-chipset.png')).convert('RGBA')
TPR = DATA['tilesPerRow']; N = DATA['count']
IMG = os.path.join(ROOT, 'public/assets/sengoku-edo-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(ROOT, 'src/assets/sengokuEdoReferences.json')
URL = lambda n: '/assets/sengoku-edo-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
EXAMPLES = [('castle-town', 'castle_town', 56, 48, 1, '성하마을 56×48'), ('samurai', 'samurai', 52, 36, 1, '무가 저택 거리 52×36'),
            ('temple', 'temple', 54, 38, 1, '신사·절 경내 54×38'), ('village', 'village', 54, 42, 1, '농촌 마을 54×42')]
HEAD = (f"tilesetId `sengoku_edo` · 그림 `public/assets/sengoku-edo/sengoku-edo-chipset.png`(텍스처 `tex_sengoku_edo`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-sengoku` — 다른 칩셋(버들항·일본 도시 jp_city·조선 joseon_baram·마법 학교·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트는 잠긴 sengoku 램프만(먹·회벽·기와·삼나무·주칠·초가·이끼 …). 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 모든 그림은 object-gate 3/4 관문 영수증이 있는 조각만 구웠다.")


def arr(a): return json.dumps(a, separators=(',', ':'))
def passable(t): return t < 0 or bool(DATA['passability'][t]['up'])
def star(t): return t >= 0 and passable(t) and DATA['priority'][t] == 'upper'
def cell_ok(lo, up):
    """엔진 규칙(collision.ts layeredPassability): 위층이 비었거나 ★면 아래층이, 아니면 위층이 칸을 정한다."""
    if up >= 0 and not star(up): return passable(up)
    return lo >= 0 and passable(lo)
def outdoor_kits(): return [k for k in DATA['structureKits'] if k.get('learnedFrom') == 'pack-preset']


def compose(style, W, H, seed):
    out = os.path.join('/tmp', f'se-ref-{style}-{seed}.json')
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'compose-scene.mts'), '--', out, style, str(W), str(H), str(seed)],
                   cwd=ROOT, check=True, capture_output=True)
    return json.load(open(out))


# ── 검증기(구조·통행만) ──
def validate(d):
    """E_BOUNDS · E_OVERLAP · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE — (코드, 대상, x, y) 목록."""
    W, H = d['width'], d['height']; errs = []
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and cell_ok(d['lower'][y * W + x], d['upper'][y * W + x])
    rects = [(b['name'], b['rect']) for b in d['buildings']] + [(p['kit'], dict(x=p['x'], y=p['y'], w=next(k['width'] for k in DATA['structureKits'] if k['id'] == p['kit']), h=next(k['height'] for k in DATA['structureKits'] if k['id'] == p['kit']))) for p in d['props']]
    for n, r in rects:
        if r['x'] < 0 or r['y'] < 0 or r['x'] + r['w'] > W or r['y'] + r['h'] > H: errs.append(('E_BOUNDS', n, r['x'], r['y']))
    nb = len(d['buildings'])
    for i in range(nb):
        n1, a = rects[i]
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
    k = next(k for k in DATA['structureKits'] if k['id'] == kit_id); W = d['width']
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
    # 1) 문 앞 접근칸에 석등
    t = json.loads(json.dumps(d)); a = b0['access'][0]; stamp(t, 'se-rice-bales', a['x'], a['y'] - 1); t['props'].append(dict(kit='se-rice-bales', x=a['x'], y=a['y'] - 1))
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 볏섬 더미", t, [(a['x'], a['y'] - 1, 2, 2)]))
    # 2) 건물을 맵 밖으로
    t = json.loads(json.dumps(d)); bb = t['buildings'][-1]; bb['rect']['x'] = d['width'] - bb['rect']['w'] // 2
    out.append(('bounds', f"{bb['name']}을 오른쪽 끝({bb['rect']['x']},{bb['rect']['y']})으로 밀어 맵 밖", t, [(bb['rect']['x'], bb['rect']['y'], d['width'] - bb['rect']['x'], bb['rect']['h'])]))
    # 3) 건물 겹침
    t = json.loads(json.dumps(d)); b1, b2 = t['buildings'][1], t['buildings'][2]; b2['rect']['x'] = b1['rect']['x'] + 1; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    # 4) 다리를 걷어 해자에 물만 남김(성으로 가는 길 끊김)
    t = json.loads(json.dumps(d)); W = d['width']; cut = []
    for i, u in enumerate(t['upper']):
        if u >= 0 and any(u in k['rows'][r]['upperTiles'] for k in DATA['structureKits'] if k['id'].startswith('se-bridge') for r in range(k['height'])):
            t['upper'][i] = -1; cut.append((i % W, i // W))
    xs = [c[0] for c in cut]; ys = [c[1] for c in cut]
    out.append(('unreachable', f"해자 다리 {len(cut)}칸을 걷어냄(성문 쪽이 끊김)", t, [(min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)] if cut else []))
    return out


def kit_sheet():
    ks = outdoor_kits(); S = 2; pad = 8
    items = [(k, BL.reassemble(k, SHEET, TPR)) for k in ks]
    Wd = 1400; x = y = pad; rowh = 0; place = []
    for k, im in sorted(items, key=lambda t: -t[1].height):
        w, h = im.width * S, im.height * S + 14
        if x + w + pad > Wd: x, y, rowh = pad, y + rowh + pad, 0
        place.append((x, y, k, im)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + pad), (58, 56, 66, 255)); dr = ImageDraw.Draw(sheet)
    for x0, y0, k, im in place:
        dr.text((x0, y0), k['id'].replace('se-', ''), fill=(255, 255, 255, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, 'outdoor-kits.png'), optimize=True)
    return len(ks)


def dictionary_md():
    L = [f"# sengoku_edo · 사전 (바닥 한 칸 + 키트 전체 배열)\n\n{HEAD}\n"]
    L.append("## 바닥(낱칸, 반복해 칠한다)\n\n번호는 이 시트의 칸 번호(아래층). 방향 이름(-n·-s·-w·-e·-nw…)은 «그 변에 다른 바닥이 닿는다»는 뜻이다: 풀밭 가장자리 `grass-edge-*` 는 그 변에 흙길, 물가 `water-*` 는 그 변에 뭍(돌 축대), 논두렁 `paddy-*` 는 그 변이 둑. 물·논은 걸을 수 없다.\n")
    L.append('| 이름 | 조각 id | 칸 번호 | 통행 |\n|---|---|---|---|')
    for g in DATA['tileGroups']:
        if len(g['tileIds']) == 1 and g['id'].startswith('se:se-') and g['role'] == 'terrain':
            t = g['tileIds'][0]
            L.append(f"| {g['name']} | `{g['id'][3:]}` | {t} | {'걷는다' if passable(t) else '막힘'} |")
    L.append("\n## 키트(여러 칸 물체) — `list_tileset_objects` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **건물**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. "
             "**도리이·성문·절 문루**는 통로 칸이 걷는 ★칸이다(사람 머리 위에 그려짐). **다리**(`se-bridge-*`)는 물 위에 얹는 키트로 상판이 아래층 물을 덮어 걷게 하고 난간은 막힘. 담(`se-wall-plaster` 1×2·`se-castle-wall` 1×3)은 1칸 간격 없이 나란히 찍는다.\n")
    for k in outdoor_kits():
        t = [r['tiles'] for r in k['rows']]; u = [r['upperTiles'] for r in k['rows']]
        ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
        extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄(걸을 수 있어야 함)" if ent else ''
        L.append(f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:160]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n")
    return '\n'.join(L)


def howto_md():
    return f"""# sengoku_edo · 전국·에도 야외 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_sengoku_edo_map({{mapId, style, seed?, replace?}})` 가 아래 순서·규칙대로 야외 한 장을 **매번 다르게** 짠다.
- style: `castle_town` 성하마을(56×48 기본, 48×48 이상) · `inn_street` 여관 거리(56×40) · `samurai` 무가 저택(52×36) · `castle` 성(44×38) · `temple` 신사·절(54×38) · `village` 농촌(54×42).
- 빈 맵이 작으면 도구가 기본 크기로 키운다. 시작 칸에서 모든 건물 문 접근칸에 닿는지 엔진 통행으로 확인하고, 안 되면 다음 씨앗(최대 4번)을 보고 그래도 안 되면 맵을 바꾸지 않는다.
- 건물 문 ↔ 실내: `build_hand_interior_room({{tileset:"sengoku_edo", layout:{{program:"samurai-house"}}}})` 로 실내를 짓고 `link_sengoku_edo_interior({{mapId, door:{{x,y}}, interiorMapId}})` 로 잇는다. 문 좌표는 compose 결과 `data.buildings[].doors`.

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **바닥 한 재질**: 전체 `풀밭`(1). 나중에 짙은 풀·들꽃을 값 잡음 덩이로 섞는다(한 칸으로 띠를 칠하지 않는다).
2. **물·논 먼저**: 해자·강은 `해자·강물`(32) 사각형 + 테두리 칸을 «뭍이 있는 변» 이름으로(`water-n` = 북쪽이 뭍). 논은 사각형 안쪽 물논/자란 벼/익은 벼 한 종류 + 둘레 논두렁(`paddy-*`), 논 사이 1칸은 풀밭 두렁길.
3. **건물 줄**: 모두 남향. 거리 건물은 밑변을 한 줄에 맞추고 건물 사이 0~1칸(1칸이면 대울타리 대신 덤불·빈 골목). 성은 천수각 → 성벽 남쪽 줄(망루·담·성문·담·망루) → 서·동 성벽 → 해자 3칸(남쪽 5칸) → 성문 통로 아래 다리.
4. **길**: 거리 앞 `다진 흙길` 3~4줄, 남북 대로 4칸. 경내·저택 안은 `돌길(이시다타미)` 2칸 참배길. 모든 문 접근칸은 곧은 길(아래 → 옆)로 길망에 잇는다. 다리·문루 통로·도리이 아래는 길망의 일부다.
5. **문 앞**: 접근칸과 그 아래 한 칸은 비운다. 가게 앞 길가 소품(노점·볏섬·초롱)은 문에서 2칸 이상 옆.
6. **소품**: 발자국 + 여백 1칸을 예약하고 겹치지 않는다. 석등·고마이누는 참배길 양옆 풀밭 한 쌍씩, 길등은 거리 길가 5~6칸 간격, 노점은 큰길 북쪽 가장자리, 우물·장작·볏짚은 농가 마당.
7. **나무**: 마지막. 해자 바깥 둑·담 안쪽·경내 숲·집 뒤 띠에만, 3칸 이상 띄운다. 벚·단풍·소나무·삼나무·대숲·버드나무(물가).
8. **가장자리**: 풀밭이 흙길과 닿는 칸은 `grass-edge-*`, 물가는 `water-*` 로 바꾼다(구성기 마지막 단계).

## 금지 조건
- 키트가 맵 밖으로 나가면 안 된다(E_BOUNDS). 건물이 겹치면 안 된다(E_OVERLAP). 문 칸이 걸을 수 있으면 안 되고(E_DOOR_CELL_OPEN) 접근칸이 막히면 안 된다(E_DOOR_ACCESS_BLOCKED). 시작 칸에서 접근칸이 안 닿으면 안 된다(E_DOOR_UNREACHABLE — 다리를 빼먹으면 해자 건너 성이 끊긴다).
- 물·논 위에는 다리 말고 아무것도 놓지 않는다.

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 건물 키트 맨 아래 줄 문(막힘). **접근칸** = 문 바로 아래 줄(걸을 수 있는 바닥). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에 건다(link_sengoku_edo_interior 가 만든다).
- 도리이·성문·절 문루의 통로는 이벤트가 아니라 걷는 ★칸이다(지나가면 된다).

## 반복 가능 / 고정
- 반복: 바닥 낱칸 전부(풀·흙길·돌길·자갈·이끼·물·논). 고정: 건물·소품·나무·다리·도리이. 담(`se-wall-plaster`·`se-castle-wall`)은 고정 조각을 나란히 이어 찍는다.

## 없는 소재
- 물레방아·볏덕(하자)·대울타리·병풍: 3/4 관문(object-gate)을 통과하지 못해 **뺐다** — 없는 키트 id 를 지어 부르지 않는다.
- 사람·말·가문 문장·간판 글자: 없다. 사람은 Actor1 캐릭터 이벤트로 둔다.
- 현대 일본 거리(편의점·철도)는 jp_city, 조선 마을은 joseon_baram — 칸 번호를 섞지 않는다.

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 낱칸 바닥은 불투명 아래층(물·논은 막힘, 나머지는 걷는다). 건물·소품은 위층·막힘. 나무 윗줄은 위층이지만 **걷는다**(★), 밑동 줄은 막힘.
- 다리 상판은 위층이지만 우선순위 «아래»(O)라 칸을 정한다 — 밑의 물(X)보다 위층 상판이 이긴다(엔진 collision.ts: 위에서부터 빈칸과 ★를 건너뛰고 처음 만난 칸이 정한다). 난간 칸은 X.
- 확인 범위: 구조·좌표·통행(4방 BFS, 엔진 규칙)뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`se-ex-{k}`({t})' for k, _, _, _, _, t in EXAMPLES)} · `se-errors`(정상/오류 나란히). 실내는 용도 `se-interior`.
"""


def example_md(title, d, img):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings'])
    props = collections.Counter(p['kit'] for p in d['props'])
    return f"""# sengoku_edo 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/sengokuEdoComposer.ts`, compose_sengoku_edo_map 과 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_sengoku_edo_map({{style:"{d['style']}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}).

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
    L = ["# sengoku_edo · 정상/오류 나란히 (변조 검출)\n", HEAD, "\n성하마을 예제를 실제로 변조해 검증기(`bake_refs_se.validate`, 엔진 통행 규칙)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `outdoor-err-compare.png` 의 빨간 테두리 = 변조 자리.\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for kind, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_BOUNDS 맵 밖 · E_OVERLAP 건물 겹침 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE 시작 칸에서 안 닿음.")
    L.append("\n확인 범위: 구조·좌표·통행(4방 BFS). 이벤트 실행·미감은 보지 않는다. 구성 도구는 검사가 실패하면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).")
    return '\n'.join(L)


INTERIOR_CASES = [('samurai-house', '무가 저택(다다미 방·다실·침방·서재)'), ('ryokan-2f', '여관 2층 손님방'), ('castle-hall', '성 알현실'), ('machiya', '마치야 가게 + 안방'), ('minka', '농가(흙바닥 부엌 + 이로리 방)'), ('tea', '다실 하나')]


def interior_md(spec):
    objs = spec['objects']
    rows = '\n'.join(f"| `{k}` | {o.get('ko', k)} | {o.get('w', '?')}×{o.get('h', '?')} | {o.get('category_ko', '')} |" for k, o in sorted(objs.items()))
    rk = spec['rooms']['kinds']
    return f"""# sengoku_edo · 실내(다다미 방·다실·여관·알현실·가게·농가·도장) 짓는 법

{HEAD}

## 도구
`build_hand_interior_room({{tileset:"sengoku_edo", name, layout:{{program:"samurai-house"}}}})` 한 번. 도구가 방 크기·칸막이·문·출구를 짜고 방마다 제작자 견본 방(src/assets/sengokuEdoRoomTemplates.json)의 가구 한 벌을 심는다. 다른 배치는 `layout.variant` 1·2, 다른 견본은 `layout.seed`.
- 방 구성(program): `samurai-house`(다다미 방·다실·침방·서재) · `ryokan-1f`(손님방·부엌·목욕간) · `ryokan-2f`(손님방·침방) · `castle-hall`(알현실·대기 다다미 방) · `machiya`(가게·안방) · `minka`(농가 큰방·부엌) · `dojo`(도장·사범 서재).
- 방 하나: `layout:{{rooms:[{{kind:"tea"}}]}}`. 방 종류: {' · '.join(f'`{k}` {v["ko"]}' for k, v in rk.items())}.
- 바닥 `floor`: {' · '.join(f'`{k}`' for k in spec['floors'])}. 벽면 `wall`: {' · '.join(f'`{k}`' for k in spec['walls'])}. 천장은 `default`(먹색 들보) 하나.
- 짓고 나면 야외 건물 문과 `link_sengoku_edo_interior({{mapId, door, interiorMapId}})` 로 잇는다(바깥 = 문 앞 접근칸, 안 = 맨 아래 출입구 틈).

## 규칙
- 벽면은 위 두 줄(장지·후스마·회벽·판자). 걸이 가구(족자·가미다나·걸이 초롱·장지 창)는 벽면 줄에만, 나머지는 바닥 줄에.
- 출입구 틈 위 두 칸은 비운다. 닿지 못한 바닥 0이어야 한다(도구가 data.layout 과 경고로 알려 준다).
- 병풍·물레방아처럼 3/4 관문을 못 넘은 물건은 없다 — 지어 부르지 않는다.

## 가구 {len(objs)}종
| id | 이름 | 칸 | 분류 |
|---|---|---|---|
{rows}

## 예제 그림
{chr(10).join(f'- `interior-{k}.png` — {t}: build_hand_interior_room 도구 그대로 지은 맵을 엔진 렌더러로 그린 원본 해상도' for k, t in INTERIOR_CASES)}
"""


def interior_images():
    out = '/tmp/se-int-ref'
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'check-sengoku-interiors.mts'), '--', '--out', out], cwd=ROOT, capture_output=True)
    for k, _ in INTERIOR_CASES:
        shutil.copy(os.path.join(out, f'{k}.png'), os.path.join(IMG, f'interior-{k}.png'))


def main():
    nk = kit_sheet()
    exs = {}
    for key, style, W, H, seed, title in EXAMPLES:
        d = compose(style, W, H, seed); exs[key] = (title, d)
        RS.render(d).save(os.path.join(IMG, f'outdoor-{key}.png'), optimize=True)
        assert not validate(d), (key, validate(d)[:3])
    base = exs['castle-town'][1]; rows = []; pics = [RS.render(base)]
    for kind, desc, t, boxes in tampers(base):
        errs = validate(t); rows.append((kind, desc, errs))
        im = RS.render(t); dr = ImageDraw.Draw(im)
        for x, y, w, h in boxes: dr.rectangle([x * 16, y * 16, (x + w) * 16 - 1, (y + h) * 16 - 1], outline=(255, 30, 30, 255), width=3)
        pics.append(im)
    s = 0.5; tw, th = int(pics[0].width * s), int(pics[0].height * s)
    cmp_ = Image.new('RGBA', (tw * 3 + 16, th * 2 + 8), (20, 20, 28, 255))
    for i, im in enumerate(pics[:6]): cmp_.paste(im.resize((tw, th), Image.NEAREST), ((i % 3) * (tw + 8), (i // 3) * (th + 8)))
    cmp_.save(os.path.join(IMG, 'outdoor-err-compare.png'), optimize=True)
    assert all(errs for _, _, errs in rows), [k for k, _, e in rows if not e]
    interior_images()
    spec = json.load(open(os.path.join(ROOT, 'src/assets/sengokuEdoRoomSpec.json'), encoding='utf-8'))
    imgs = [dict(id='se-img-kits', name='outdoor-kits.png', caption=f'야외 키트 도감 {nk}종(원본 ×2). 전부 object-gate 영수증이 있는 그림.', dataUrl=URL('outdoor-kits.png'))]
    for key, _, W, H, _, title in EXAMPLES:
        imgs.append(dict(id=f'se-img-{key}', name=f'outdoor-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'outdoor-{key}.png')))
    imgs.append(dict(id='se-img-err-compare', name='outdoor-err-compare.png', caption='성하마을 예제 정상(왼쪽 위)과 변조 4종(문 앞 막힘·맵 밖·겹침·다리 걷음, 빨간 테두리 = 변조 자리).', dataUrl=URL('outdoor-err-compare.png')))
    docs = [dict(id='se-howto', name='sengoku_edo 야외 · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md()),
            dict(id='se-dictionary', name='sengoku_edo 야외 · 사전(바닥·키트 전체 배열)', markdown=dictionary_md())]
    for key, _, _, _, _, title in EXAMPLES:
        docs.append(dict(id=f'se-ex-{key}', name=f'sengoku_edo 야외 예제 · {title}', markdown=example_md(title, exs[key][1], f'outdoor-{key}.png')))
    docs.append(dict(id='se-errors', name='sengoku_edo 야외 · 정상/오류 변조 검출', markdown=errors_md(rows)))
    cat = dict(id='se-outdoor', name='sengoku_edo · 전국·에도 야외 (사전 · 순서 · 예제 4 · 변조 오류)',
               description='성하마을·여관 거리·무가 저택·성·신사/절·농촌을 짓는 법. 구성 도구 compose_sengoku_edo_map, 바닥 사전·키트 전체 배열·문 그림/접근칸/이벤트 분리·완성 예제 4장(구성기 실제 출력 배열)·변조 오류.', documents=docs, images=imgs)
    iimgs = [dict(id=f'se-img-interior-{k}', name=f'interior-{k}.png', caption=f'{t} — build_hand_interior_room 실제 출력(엔진 렌더).', dataUrl=URL(f'interior-{k}.png')) for k, t in INTERIOR_CASES]
    icat = dict(id='se-interior', name='sengoku_edo · 실내 (다다미 방·다실·여관·알현실·가게·농가·도장)', description='build_hand_interior_room(tileset:sengoku_edo) 방 구성·방 종류·바닥·벽면·가구 목록과 실제 출력 그림 6장.',
                documents=[dict(id='se-interior-howto', name='sengoku_edo 실내 · 방 구성·가구·규칙', markdown=interior_md(spec))], images=iimgs)
    json.dump([cat, icat], open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for kind, desc, errs in rows: print('변조', kind, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs) + 1, 'images', len(imgs) + len(iimgs))


if __name__ == '__main__':
    main()
