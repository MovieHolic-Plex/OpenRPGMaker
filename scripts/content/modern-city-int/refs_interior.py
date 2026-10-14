#!/usr/bin/env python3
"""modern_city 실내 참고문서 — 용도 `mc-interior` 하나를 src/assets/modernCityReferences.json 에 넣는다(있으면 갈아 끼운다).
계약 tiledata/AI-REFERENCE-CONTRACT.md: 사전(칸 번호)·실행 순서·예제 9장 완전 배열(엔진 출력 4층)·문 그림/접근칸/이벤트 분리·변조 오류 코드+좌표·검사 범위.
그림은 public/assets/modern-city-interior-references/*.png(1배 또는 nearest 정수배) — 번들 JSON 에는 경로만 둔다(바이트 없음).
bake_refs.py(거리 참고문서 굽기)가 JSON 을 통째로 다시 쓰므로 그 끝에서 references(ROOT) 를 다시 부른다.

  npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/check-rooms.mts --json /tmp/mci-check.json
  npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/tamper.mts /tmp/mci-tamper.json
  python3 scripts/content/modern-city-int/refs_interior.py /tmp/mci-check.json /tmp/mci-tamper.json
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'qa'))

CAT_ID = 'mc-interior'
IMG_DIR = os.path.join(ROOT, 'public/assets/modern-city-interior-references')
URL = '/assets/modern-city-interior-references/'
STORE = os.path.join(ROOT, 'tiledata/modern-city/interior/refs')       # 문서·그림 원본(엔진 배열 JSON 포함) — 다시 굽지 않고 references() 가 읽는다
REFS = os.path.join(ROOT, 'src/assets/modernCityReferences.json')
SPEC = os.path.join(ROOT, 'src/assets/modernCityRoomSpec.json')
EXDIR = os.path.join(ROOT, 'tiledata/modern-city/interior/examples')
ORDER = ['office-floor', 'konbini', 'apartment', 'hospital-ward', 'lobby', 'cafe', 'bank', 'concourse', 'warehouse']
PROGRAM_NOTE = {
    'office-floor': '열린 사무 공간 + 회의실(유리문 아닌 나무 문 예제, 도구 배치는 유리문) + 복도', 'konbini': '매장(출입구) + 뒷방(창고)', 'apartment': '침실 + 거실·부엌(LDK)',
    'hospital-ward': '4인 병실 + 대기 복도(출입구, 병원 미닫이 문)', 'lobby': '로비 한 칸(기둥 둘)', 'cafe': '카페 한 칸(오른쪽 아래 알코브)', 'bank': '은행 창구 한 칸(아래 양쪽 알코브)',
    'concourse': '대합실 한 칸(기둥 둘)', 'warehouse': '창고 한 칸(가운데 기둥)'}


def table(rows, head):
    return '\n'.join(['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows])


def grid(arr, W):
    return '\n'.join(' '.join('%5d' % v for v in arr[y * W:(y + 1) * W]) for y in range(len(arr) // W))


def render_png(m, k=1):
    import render_map
    from PIL import Image
    im = render_map.render(m)
    return im.resize((im.width * k, im.height * k), Image.NEAREST) if k > 1 else im


def boxed(m, boxes, k=2):
    from PIL import ImageDraw
    im = render_png(m, k).convert('RGB'); d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1) in boxes: d.rectangle([x0 * 16 * k - 1, y0 * 16 * k - 1, (x1 + 1) * 16 * k, (y1 + 1) * 16 * k], outline=(230, 30, 40), width=3)
    return im


def label(im, text):
    from PIL import Image, ImageDraw
    out = Image.new('RGB', (im.width, im.height + 14), (24, 24, 28)); out.paste(im, (0, 14))
    ImageDraw.Draw(out).text((3, 1), text, fill=(240, 240, 240)); return out


def build(check_path, tamper_path):
    """엔진 결과 JSON 두 개 → 그림(public)·문서 원본(tiledata/.../refs)."""
    from PIL import Image
    import pieces
    os.makedirs(IMG_DIR, exist_ok=True); os.makedirs(STORE, exist_ok=True)
    for fn in os.listdir(IMG_DIR): os.remove(os.path.join(IMG_DIR, fn))
    chk = json.load(open(check_path))['maps']; tam = json.load(open(tamper_path))
    S = json.load(open(SPEC, encoding='utf-8'))
    meta = json.load(open(os.path.join(ROOT, 'src/assets/modernCitySheet.json')))
    rep = json.load(open(os.path.join(ROOT, 'tiledata/modern-city/interior/bake-report.json')))
    docs, imgs, arrays = [], [], {}
    # 예제 9장: 평면 경로(엔진 출력) 그림 1배 + 방 구성(program) 경로 그림 1배
    for k in ORDER:
        mp, mg = chk['mci-plan-' + k], chk['mci-program-' + k]
        render_png(mp).save(os.path.join(IMG_DIR, 'plan-%s.png' % k), optimize=True)
        render_png(mg).save(os.path.join(IMG_DIR, 'program-%s.png' % k), optimize=True)
        arrays[k] = dict(plan=mp, program=dict(width=mg['width'], height=mg['height'], warnings=mg['warnings'], reached=mg['reached'], walk=mg['walk']))
    # 변조 비교: 정상 + 6 변조(빨간 상자 = 검출 좌표), ×2
    norm = tam['normal']; tiles = [label(boxed(norm, []), 'normal: 0 issues')]
    for t in tam['tampers']:
        bx = [(h['x'], h['y'], h['x'], h['y']) for h in t['hits'] if h.get('x') is not None] or [(8, 12, 9, 12)]
        tiles.append(label(boxed(t['map'] if t['map']['width'] else norm, bx), '%s -> %s' % (t['id'], ','.join(sorted({h['code'] for h in t['hits']})))))
    cols = 2; cw = max(i.width for i in tiles); ch = max(i.height for i in tiles)
    sheet = Image.new('RGB', (cols * cw + 8, ((len(tiles) + 1) // 2) * (ch + 8)), (40, 40, 44))
    for n, im in enumerate(tiles): sheet.paste(im, ((n % cols) * (cw + 8), (n // cols) * (ch + 8)))
    sheet.save(os.path.join(IMG_DIR, 'tamper-compare.png'), optimize=True)
    # 조각 도감(×2): 가구 그림 그대로
    cat = Image.open(os.path.join(ROOT, 'tiledata/modern-city/interior/_all-x3.png'))
    cat = cat.resize((cat.width // 3, cat.height // 3), Image.NEAREST); cat = cat.resize((cat.width * 2, cat.height * 2), Image.NEAREST)
    cat.save(os.path.join(IMG_DIR, 'pieces.png'), optimize=True)

    R = pieces.R
    # ── 규칙·사전 문서
    obj_rows = []
    for oid, o in S['objects'].items():
        d = R.objs[oid]
        cells = ' '.join('(%d,%d)=%d/%s' % (dx, dy, t, {1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4'}.get(l, l)) for dx, dy, t, l in o['cells'])
        obj_rows.append(('`%s`' % oid, o['ko'], o['kind'], '%dx%d' % (o['w'], o['h']), o['up'], o.get('category_ko') or '-', d.get('place') or '-', '걷기 칸 %s' % d['walk'] if d['walk'] else ('윗면(탁상 물건 가능)' if d['surface'] else '-'), cells))
    floor_rows = [('`%s`' % f, v['ko'], '%d×%d' % (v['cols'], v['rows']), '%d..%d (%d칸)' % (min(v['tiles']), max(v['tiles']), len(v['tiles']))) for f, v in S['floors'].items()]
    wall_rows = [('`%s`' % w, v['ko'], '%d칸 주기' % v['cols'], '%d..%d (%d칸)' % (min(v['tiles']), max(v['tiles']), len(v['tiles']))) for w, v in S['walls'].items()]
    table_rows = [('`%s`' % t, v['ko'], 'h=1 만' if v.get('oneRow') else 'w×h 자유', ', '.join('%s:%s' % (p, '/'.join(str(c[2]) for c in cs)) for p, cs in v['pieces'].items())) for t, v in S['tables'].items()]
    goods_rows = [('`%s`' % g, t) for g, t in S['goods'].items()]
    kinds = S['rooms']['kinds']
    kind_rows = [('`%s`' % k, v['ko'], ' · '.join(v['alias'])) for k, v in kinds.items()]
    tam_rows = [(t['id'], t['why'], t['expect'], ' '.join('%s@(%s,%s)' % (h['code'], h.get('x', '-'), h.get('y', '-')) for h in t['hits']), '잡음' if t['detected'] else '놓침') for t in tam['tampers']]
    rules = f'''# 현대 도시(modern_city) 실내 — 사전·짓는 순서·문/접근칸/이벤트·검사 범위·변조 오류

**tilesetId `modern_city`** · 그림 `public/assets/modern-city/modern-city-chipset.png`({meta['tilesPerRow']}열 × {meta['count']}칸, 칸 16px) · 실내 조각은 이 시트 **{rep['count_before']}..{rep['count_after'] - 1}번**({rep['count_after'] - rep['count_before']}칸)에 덧붙였다(덧붙이기 전용 — 앞 번호 불변, 거리 칸과 같은 시트·같은 맵에서 쓴다).
조각 정본 `scripts/content/modern-city-int/pieces.py`(코드 손 도트), 굽기 `bake_interior.py`, 방 짓기 사양 `src/assets/modernCityRoomSpec.json`, 예제 `tiledata/modern-city/interior/examples/*.json`.
다른 칩셋(jp_city·modern_campus·손 도트 실내 v5)의 칸 번호·가구 id 를 섞지 않는다 — 이 칩셋 가구 id 는 모두 `mci-` 로 시작한다.

> **3/4 관문:** 가구·바닥·벽면 {rep['gate'].get('prov', 0) + rep['gate'].get('pass', 0)}종은 object-gate(gemini-3.8-flash ×4 과반) 영수증 PASS, 문 4종은 조립 방 그림 영수증이 덮는다. 판정 프로필이 보정 전이라 «임시통과»로 센다. 네 번 다시 그려도 못 넘은 14종(북향 의자·칸막이·커튼·차단봉·드럼통·복합기·서버랙·세로 진열대·ATM·발권기·옆문 등)은 **이 칩셋에 없다** — 쓰지 않는다.

## 1. 짓는 길 두 개

1. **방 구성(권장)** — `build_hand_interior_room({{tileset:"modern_city", name, floor, wall, exitWidth:2, layout:{{program:"office-floor"}}}})`. program = {' · '.join('`%s`' % k for k in ORDER)}. 또는 `layout:{{rooms:[{{kind:"open-office"}},{{kind:"meeting"}},{{kind:"hall"}}]}}`(방 종류 표 3절). 도구가 방 크기·칸막이·문·출구를 짜고 방마다 아래 예제 방의 가구 한 벌을 심는다. 결과 `data.layout.picture` 로 배치를 본다.
2. **평면 그대로** — 예제 문서(`mc-int-map-<이름>`)의 「도구 인자 전체」 JSON 을 그대로 준다(plan·zones·objects·tables·goods·exitWidth·start). 크기·가구를 바꿀 때는 이 길로 평면 문자열을 고친다.

## 2. 조립 순서(실행 순서 — builder.ts 와 같다)

1. 평면 문자열: `#` 막힘, `.` 실내. 막힌 칸 바로 아래 **두 줄 = 벽면**(못 걷는다), 나머지 = 바닥. 천장 띠는 막힌 칸 중 실내에 닿은 칸.
2. 바닥 무늬는 floor id 의 cols×rows 반복(맵 원점 기준 `x mod cols`, `y mod rows`), 벽면은 wall id 의 cols 칸 주기. 존(zones)이 사각형마다 바닥·벽면을 바꾼다. **존 바닥은 칸막이(`#` 줄)로 감싼다** — 칸막이 없이 다른 바닥과 6칸 이상 맞닿으면 경고.
3. 걸이(`hang`: 창·시계·액자·게시판·노선도·메뉴판·에어컨)는 **벽면 윗줄**(막힌 칸 바로 아래 줄)에. 벽 가구(`wall`: 냉장 진열장·책장·서류장·주방·엘리베이터·계단·랙)는 **북쪽 벽면 바로 아래 첫 바닥 줄**에. 바닥 가구(`floor`)는 발자국 w×h 가 막힌다(걷기 칸 예외는 표). 깔개(`flat`: 점자 블록)는 밟힌다.
4. 그리는 순서 = (y+h)×16 — 남쪽 가구가 앞. 문 = (y+3)×16. 한 칸에 조각이 셋 이상 겹치면 앞 둘만 남는다.
5. 탁자(tables)는 w×h 사각형을 조각(모서리·가장자리·가운데)으로 붙인다. 탁상 물건(goods)은 **윗면이 있는 칸**(탁자·카운터·책상·협탁·계산대)에만.
6. 출입구 = plan 마지막 줄의 이어진 `.` 틈. 폭은 `exitWidth`(예제는 2~4칸). 출구 바로 위 줄은 비운다.
7. **ㅁ자 큰 방 금지**: 실내 60칸 이상인 방은 칸막이·기둥(`#` 한 칸 = 천장 + 벽면 두 줄 기둥)·모서리 알코브로 꺾는다(예제 로비·대합실·창고의 기둥, 카페·은행의 아래 알코브).

## 3. 방 종류 (layout.rooms[].kind)

{table(kind_rows, ['kind', '이름', '조수 낱말'])}

## 4. 문 그림 · 접근칸 · 출입 이벤트 — 섞지 않는다

| 구분 | 무엇 | 예(사무실 회의실) |
|---|---|---|
| 문 그림 | 가로 칸막이 1칸 틈 (x,y) 에 선 문(`mci-door-wood`·`mci-door-glass`·`mci-door-steel`·`mci-door-hospital`, 16×48: 인방 + 문틀 2줄). 발자국 없음 | (13,7) |
| 접근칸 | 문 위 칸 (x,y-1) 과 문틀 아래 칸 (x,y+3) — 비워 둔다 | (13,6) · (13,10) |
| 출입 이벤트 | 맵 이동. **방 사이 문은 같은 맵 안이라 이벤트가 없다.** 이동은 건물 출입구(마지막 줄 틈)와 계단(`mci-stairs-up`)에만 — 거리 문과는 `link_modern_city_interior` 가 잇는다 | 사무실 출구 (8,13)(9,13) |

옆문(세로 칸막이 문)은 이 칩셋에 없다 — 세로 칸막이는 문 없이 3줄 틈으로 튼다.

## 5. 가구 사전 ({len(S['objects'])}종) — id · 조립 종류 · 발자국 · 칸 번호(dx,dy)=칸/층

층: L1 바닥, L2 바닥 장식, L3 물체, L4 물체 위(겹침). `up` = 발자국 위로 솟은 그림 픽셀(앞 줄 가구 위로 그려진다).

{table(obj_rows, ['id', '이름', '종류', 'w×h', 'up', '분류', '놓는 곳', '통행', '칸'])}

바닥 {len(S['floors'])}종(무늬 × 그늘 변형 4, 도구가 고른다):

{table(floor_rows, ['floor', '이름', '무늬', '칸 번호'])}

벽면 {len(S['walls'])}종(윗줄·아랫줄 × 주기 × 서쪽 그늘):

{table(wall_rows, ['wall', '이름', '주기', '칸 번호'])}

탁자 {len(S['tables'])}종:

{table(table_rows, ['style', '이름', '크기', '조각 칸'])}

탁상 물건 {len(S['goods'])}종: {', '.join('`%s`=%d' % r for r in goods_rows)}. 천장 띠: `default`.

## 6. 자동 검사 범위와 변조 오류

`npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/check-rooms.mts` 가 예제 9장을 **조수 도구 그대로**(평면 경로·방 구성 경로 둘 다) 짓고 엔진 통행(`isPassable`)으로 출구에서 BFS 한다: 평면 경로 9장 모두 경고 0·걸음 칸 전부 도달. 방 구성 경로는 한 방짜리 5종(로비·카페·은행·대합실·창고)이 「ㅁ자」 경고를 낸다(도구가 한 방을 직사각형으로 짓기 때문 — 그 방들은 평면 경로를 쓴다).
`qa/tamper.mts` 가 사무실 평면을 실제로 변조해 엔진 조립기가 이름 붙은 코드로 잡는지 본다(그림 `tamper-compare.png`, 빨간 상자 = 검출 좌표):

{table(tam_rows, ['변조', '무엇을', '기대 코드', '검출(코드@좌표)', '결과'])}

**확인하지 않는 것:** 이벤트 실행(문 이동이 실제로 일어나는지는 `link_modern_city_interior` 시험이 따로 본다)·«도쿄 사무실처럼 보이는가»(미감 — 사람·판정자가 그림을 본다)·저가 모델 성공률. 도구는 오류가 하나라도 있으면 맵을 만들지 않는다(부분 배치 없음).

## 7. 층·통행 메타 대조

굽기는 칸마다 통행·층을 조각 종류에서 정한다: 바닥 = L1·통과, 벽면·천장 = L1·막힘, 가구 몸통 = L3·막힘(걷기 칸만 통과), 걸이 = L3·통과(벽면 위라 어차피 못 걷는다), 깔개 = L2·통과·잠금. `check-rooms.mts` 의 BFS 가 엔진 판정으로 이 메타를 다시 읽는다(예제 18장 모두 «걸음 칸 = 도달 칸»).
'''
    docs.append(dict(id='mc-int-rules', name='현대 도시 실내 · 사전·짓는 순서·검사', markdown=rules + '\n![변조 비교](' + URL + 'tamper-compare.png)\n\n가구 도감: `' + URL + 'pieces.png`\n'))
    imgs.append(dict(id='mc-int-img-tamper', name='tamper-compare.png', caption='사무실 예제 정상(왼쪽 위)과 실제 변조 6종 — 빨간 상자 = 엔진 조립기가 낸 오류 좌표(출구 막힘은 좌표 없는 no-entrance 라 막은 칸을 표시). 엔진 칸 배열을 시트 칸으로 붙인 그림 ×2.', dataUrl=URL + 'tamper-compare.png'))
    imgs.append(dict(id='mc-int-img-pieces', name='pieces.png', caption='실내 가구·바닥·벽면 도감 ×2(nearest). 전부 3/4 관문 영수증 PASS(임시통과).', dataUrl=URL + 'pieces.png'))
    # ── 예제 문서
    for k in ORDER:
        e = json.load(open(os.path.join(EXDIR, k + '.json'), encoding='utf-8'))
        m = arrays[k]['plan']; W = m['width']; pg = arrays[k]['program']
        tool = {kk: v for kk, v in m['args'].items() if kk not in ('mapId',)}
        tool['mapId'] = 'mc-int-' + k
        plan_txt = '\n'.join('%2d %s' % (i, r) for i, r in enumerate(e['plan']))
        rooms = '\n'.join('- `%s`(%s): x %d..%d · y %d..%d' % (r['room'], kinds[r['room']]['ko'], r['x0'], r['x1'], r['y0'], r['y1']) for r in e['rooms'])
        doors = [o for o in e['objects'] if R.objs[o['id']]['kind'] == 'door']
        door_txt = '\n'.join('- 문 그림 `%s` (%d,%d) · 접근칸 (%d,%d)·(%d,%d) · 이벤트 없음(같은 맵)' % (d['id'], d['x'], d['y'], d['x'], d['y'] - 1, d['x'], d['y'] + 3) for d in doors) or '- 방 사이 문 없음'
        H = len(e['plan']); row = e['plan'][-1]; ex = [x for x, c in enumerate(row) if c != '#']
        md = f'''# 현대 도시 실내 예제 — {e['name']} (`{k}`, {W}×{m['height']}칸)

tilesetId `modern_city` · 좌표 0기준(x 오른쪽, y 아래) · 칸 16px. 아래 배열은 **조수 도구 build_hand_interior_room 이 실제로 지은 맵**(엔진 출력)이고 그림 `plan-{k}.png` 는 그 배열을 시트 칸으로 붙인 1배 그림이다.
검사: 도구 경고 {len(m['warnings'])} · 걸음 칸 {m['walk']} 중 출구에서 {m['reached']} 도달.

## 평면 (`#` 막힘 · `.` 실내)
```
{plan_txt}
```
방(rooms — 방 구성표 `{k}` 의 원본):
{rooms}

## 문·출입
{door_txt}
- 출입구 틈 y={H - 1} x {ex[0]}..{ex[-1]} (폭 {len(ex)}, `exitWidth:{e.get('exitWidth', 1)}`) — 바로 위 줄 y={H - 2} 는 비운다. 거리와 잇는 이동 이벤트는 `link_modern_city_interior` 가 이 출구 칸에 둔다.

## 도구 인자 전체 (평면 경로)
```json
{json.dumps(tool, ensure_ascii=False, separators=(',', ':'))}
```

## 방 구성 경로
`build_hand_interior_room({{tileset:"modern_city", name:"{e['name']}", floor:"{e['floor']}", wall:"{e['wall']}", exitWidth:2, layout:{{program:"{k}"}}}})` — {PROGRAM_NOTE[k]}. 엔진 결과 {pg['width']}×{pg['height']}칸, 걸음 칸 {pg['walk']} 모두 도달{', 경고: ' + ' / '.join(w[:60] + '…' for w in pg['warnings']) if pg['warnings'] else ', 경고 0'}. 그림 `program-{k}.png`.

## 엔진 출력 전체 배열 (-1 = 빈칸)
1층 lowerTiles:
```
{grid(m['lower'], W)}
```
2층 lowerOverlayTiles:
```
{grid(m['lower2'] or [-1] * len(m['lower']), W)}
```
3층 upperTiles:
```
{grid(m['upper'], W)}
```
4층 upperOverlayTiles:
```
{grid(m['upper2'] or [-1] * len(m['lower']), W)}
```
'''
        docs.append(dict(id='mc-int-map-' + k, name='현대 도시 실내 예제 · ' + e['name'], markdown=md + '\n![%s](%splan-%s.png)\n' % (e['name'], URL, k)))
        imgs.append(dict(id='mc-int-img-plan-' + k, name='plan-%s.png' % k, caption='%s — 평면 경로 엔진 출력 1배(%d×%d칸). 배열·입력은 문서 mc-int-map-%s.' % (e['name'], W, m['height'], k), dataUrl=URL + 'plan-%s.png' % k))
        imgs.append(dict(id='mc-int-img-program-' + k, name='program-%s.png' % k, caption='%s — layout:{program:"%s"} 경로 엔진 출력 1배(%d×%d칸, 배치는 seed·variant 로 달라진다).' % (e['name'], k, pg['width'], pg['height']), dataUrl=URL + 'program-%s.png' % k))
    cat_ = dict(id=CAT_ID, name='현대 도시 · 실내(사무실·편의점·아파트·병원·로비·카페·은행·대합실·창고)',
                description='modern_city 실내 가구 %d종·바닥 %d·벽면 %d — 사전(칸 번호), 짓는 순서, 방 종류 %d, 예제 9장 엔진 출력 전체 배열, 문 그림/접근칸/이벤트 분리, 변조 오류 코드.' % (len(S['objects']), len(S['floors']), len(S['walls']), len(kinds)),
                documents=docs, images=imgs)
    json.dump(cat_, open(os.path.join(STORE, 'category.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    return cat_


def references(root=ROOT):
    """bake_refs.py 가 부른다 — 저장된 용도 하나(없으면 None)."""
    p = os.path.join(root, 'tiledata/modern-city/interior/refs/category.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def install(cat):
    refs = json.load(open(REFS, encoding='utf-8'))
    refs = [c for c in refs if c['id'] != CAT_ID] + [cat]
    json.dump(refs, open(REFS, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return refs


if __name__ == '__main__':
    cat = build(sys.argv[1], sys.argv[2])
    refs = install(cat)
    print('mc-interior docs', len(cat['documents']), 'images', len(cat['images']), '· categories', len(refs), '· json KB', os.path.getsize(REFS) // 1024,
          '· img KB', sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)) // 1024)
