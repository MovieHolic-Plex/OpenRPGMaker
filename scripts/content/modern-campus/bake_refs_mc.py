#!/usr/bin/env python3
"""modern_campus 야외 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기 출력에서 기계적으로 만든다.

  python3 scripts/content/modern-campus/bake_mc.py && python3 scripts/content/modern-campus/bake_refs_mc.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/campusComposer.ts(compose_campus_grounds 도구와 같은 함수)를 qa/compose-scene.mts 로 돌린 결과다.
산출: src/assets/modernCampusReferences.json (그림은 경로만) · public/assets/modern-campus-references/outdoor-*.png
용도 1개 `mc-outdoor`: mc-howto · mc-dictionary · mc-ex-school · mc-ex-university · mc-errors. 실내는 별도 용도 `mci-interior`(interior/prepare_campus_interior_refs.py).
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa'))
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

DATA = json.load(open(os.path.join(ROOT, 'src/assets/modernCampusTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/modern-campus/modern-campus-chipset.png')).convert('RGBA')
TPR = DATA['tilesPerRow']; N = DATA['count']
IMG = os.path.join(ROOT, 'public/assets/modern-campus-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(ROOT, 'src/assets/modernCampusReferences.json')
URL = lambda n: '/assets/modern-campus-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
EXAMPLES = [('school', 'school', 52, 40, 1, '한국 고등학교 교정 52×40'), ('university', 'university', 56, 44, 2, '대학 캠퍼스 쿼드 56×44')]
HEAD = (f"tilesetId `modern_campus` · 그림 `public/assets/modern-campus/modern-campus-chipset.png`(텍스처 `tex_modern_campus`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-campus` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트는 modern3 램프만. 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 모든 그림은 object-gate 3/4 관문 영수증이 있는 조각만 구웠다.")


def arr(a): return json.dumps(a, separators=(',', ':'))
def passable(t): return t < 0 or bool(DATA['passability'][t]['up'])
def outdoor_kits(): return [k for k in DATA['structureKits'] if k.get('learnedFrom') == 'pack-preset']


def compose(style, W, H, seed):
    out = os.path.join('/tmp', f'mc-ref-{style}-{seed}.json')
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'compose-scene.mts'), '--', out, style, str(W), str(H), str(seed)],
                   cwd=ROOT, check=True, capture_output=True)
    return json.load(open(out))


# ── 검증기(구조·통행만) ──
def validate(d):
    """E_BOUNDS · E_OVERLAP · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE — (코드, 대상, x, y) 목록."""
    W, H = d['width'], d['height']; errs = []
    walk = lambda x, y: 0 <= x < W and 0 <= y < H and passable(d['lower'][y * W + x]) and passable(d['upper'][y * W + x])
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
    # 1) 문 앞 접근칸에 벤치
    t = json.loads(json.dumps(d)); a = b0['access'][0]; stamp(t, 'mc-bench', a['x'], a['y']); t['props'].append(dict(kit='mc-bench', x=a['x'], y=a['y']))
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 벤치", t, [(a['x'], a['y'], 2, 1)]))
    # 2) 건물을 맵 밖으로
    t = json.loads(json.dumps(d)); bb = t['buildings'][0]; bb['rect']['x'] = d['width'] - bb['rect']['w'] // 2
    out.append(('bounds', f"{bb['name']}을 오른쪽 끝({bb['rect']['x']},{bb['rect']['y']})으로 밀어 맵 밖", t, [(bb['rect']['x'], bb['rect']['y'], d['width'] - bb['rect']['x'], bb['rect']['h'])]))
    # 3) 건물 겹침
    t = json.loads(json.dumps(d)); b1, b2 = t['buildings'][0], t['buildings'][1]; b2['rect']['x'] = b1['rect']['x'] + 2; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    # 4) 시작 칸 바로 위를 담으로 끊음
    t = json.loads(json.dumps(d)); y = d['start']['y'] - 1
    for x in range(d['width']): stamp(t, 'mc-wall-brick', x, y - 1)
    out.append(('unreachable', f"시작 칸 위 {y - 1}~{y}줄 전체를 벽돌 담으로 막음", t, [(0, y - 1, d['width'], 2)]))
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
        dr.text((x0, y0), k['id'].replace('mc-', ''), fill=(255, 255, 255, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, 'outdoor-kits.png'), optimize=True)
    return len(ks)


def dictionary_md():
    L = [f"# modern_campus · 사전 (바닥 한 칸 + 키트 전체 배열)\n\n{HEAD}\n"]
    L.append("## 바닥(낱칸, 반복해 칠한다)\n\n`fill_region` 의 material 에 **이름 그대로** 쓴다. 번호는 이 시트의 칸 번호(아래층). 연석(curb-*)은 잔디 칸의 그 변에 포장(길·광장)이 닿을 때만 쓴다 — 방향 이름은 «연석이 있는 변»이다.\n")
    L.append('| 이름 | 조각 id | 칸 번호 | 통행 |\n|---|---|---|---|')
    for g in DATA['tileGroups']:
        if len(g['tileIds']) == 1 and g['id'].startswith('mc:mc-') and g['role'] == 'terrain':
            t = g['tileIds'][0]
            L.append(f"| {g['name']} | `{g['id'][3:]}` | {t} | {'걷는다' if passable(t) else '막힘'} |")
    L.append("\n## 키트(여러 칸 물체) — `list_tileset_objects` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **건물**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. 키트는 전부 고정 조각이다(이어 찍기 없음) — 담 `mc-wall-brick`(1×2)·생울타리 `mc-hedge`(2×1)만 폭 간격으로 나란히 찍는다.\n")
    for k in outdoor_kits():
        t = [r['tiles'] for r in k['rows']]; u = [r['upperTiles'] for r in k['rows']]
        ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
        extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄(걸을 수 있어야 함)" if ent else ''
        L.append(f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:160]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n")
    return '\n'.join(L)


def howto_md(exs):
    return f"""# modern_campus · 교정·교사 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_campus_grounds({{mapId, style:"school"|"university", buildings?, seed?, replace?}})` 가 아래 순서·규칙대로 야외 한 장을 **매번 다르게** 짠다(학교 48×36 이상, 대학 52×40 이상). 씨앗이 운동장 방향·건물 고르기·나무·벤치 자리를 바꾼다.
  - 학교 `buildings` = [본관, 옆동, 체육관] 키트 끝말(예 `["school-12","cafeteria","gym-green"]`). 대학 = [북쪽 가운데, 북쪽 왼쪽, 북쪽 오른쪽, 남쪽 왼쪽, 남쪽 오른쪽](예 `["hall-12","library","dorm-7","admin","union"]`).
  - 시작 칸에서 모든 건물 문 접근칸에 닿는지 엔진 통행으로 확인해 안 되면 깔지 않는다(맵을 바꾸지 않는다).
- 건물 문 ↔ 실내: 문 그림은 **안으로 이어지는 건물에만** 찍힌다(장식 문 금지). `build_hand_interior_room({{tileset:"modern_campus", exitWidth:2, ...}})` 로 실내를 먼저 짓고 `compose_campus_grounds({{..., entrances:[{{building:"본관", interiorMapId}}]}})` 로 들어갈 건물만 지정하면 문과 이음이 한 번에 난다. 안 지정한 건물은 문 없는 벽면이다. 나중에 실내를 달 때는 `link_campus_interior({{mapId, building, interiorMapId}})` — 문 그림과 이음을 같이 낸다. 그려진 문이 걸어서 닿지 않거나 이음이 없으면 projectLint 가 `campus-dead-door` error 로 막는다. 아래 예제 그림은 문 모양을 보이려고 전 건물에 문을 그린 것(`entrances:["all"]`)이다.

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **바닥 한 재질**: 전체 `캠퍼스 잔디`. 남쪽 4줄 = 보도 1 + 차도 3(가운데 점선).
2. **경계**: 학교 = 북쪽·남쪽 벽돌 담(`mc-wall-brick` 1×2, 1칸 간격으로 이어 찍기), 교문 자리 4칸은 비우고 양옆 `mc-gate-pillar`. 대학 = 남쪽 생울타리(`mc-hedge` 2×1) + 교문 양옆 볼라드.
3. **건물 줄**: 학교 = 북쪽 한 줄 [옆동][본관][체육관] 밑변 맞춤, 건물 사이 3칸. 대학 = 북쪽 세 동(쿼드를 바라봄) + 남쪽 두 동(앞길을 바라봄). 문은 모두 남향.
4. **길**: 건물 앞 3줄 `붉은 벽돌 포석` 광장(학교) / 쿼드 둘레 2줄 길 + 십자 길 + 가운데 분수 광장(대학). 교문 → 광장 주 통로 폭 3~4. 모든 문 접근칸은 곧은 길(아래 → 옆)로 길망에 잇는다.
5. **운동장**(학교): 광장 남쪽, 운동장 쪽 반에 `운동장 흙` 직사각형(≥12×8) + 흰 선 3줄 + 골대 둘, 통로 쪽 잔디 띠에 스탠드.
6. **소품**: 발자국 + 여백 1칸을 예약하고 겹치지 않는다. 길 칸에는 두지 않는다(가로등은 길 옆 잔디, 5칸 간격). 문 접근칸과 그 아래 한 칸은 비운다. 광장 소품(화분·쓰레기통·자판기 자리)은 문에서 2칸 이상 옆.
7. **나무**: 마지막. 담 안쪽 줄·건물 줄 사이·정원 덩이·쿼드 모서리에만, 4칸 이상 띄운다. 길 경계에 걸치지 않는다.
8. **잔디 변주**: 남은 잔디에 값 잡음 덩이로 짙은 잔디·들꽃을 섞는다 — 띠 전체를 한 칸으로 칠하지 않는다. 포장과 닿는 잔디 가장자리는 연석 칸.

## 금지 조건
- 키트가 맵 밖으로 나가면 안 된다(E_BOUNDS). 건물이 겹치면 안 된다(E_OVERLAP). 문 칸이 걸을 수 있으면 안 되고(E_DOOR_CELL_OPEN) 접근칸이 막히면 안 된다(E_DOOR_ACCESS_BLOCKED). 시작 칸에서 접근칸이 안 닿으면 안 된다(E_DOOR_UNREACHABLE).
- 차도(아스팔트·점선·횡단보도) 위에는 소품·건물을 놓지 않는다.

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 건물 키트 맨 아래 줄 문(막힘). **접근칸** = 문 바로 아래 줄(걸을 수 있는 바닥). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에 건다(entrances·link_campus_interior 가 만든다). 문 그림이 있으면 셋 다 있어야 하고, 하나라도 없으면 죽은 문이다.

## 반복 가능 / 고정
- 반복: 바닥 낱칸 전부. 고정: 건물·소품·나무·교문 기둥·분수·시계탑. 담·생울타리는 고정 조각을 폭 간격으로 나란히.

## 없는 소재
- 숲·동굴·물가: 이 칩셋에 없다(나무는 느티·은행·벚·소나무 2×3 과 관목뿐). 숲 맵은 다른 번들 칩셋의 별도 맵으로 짓는다(번호를 섞지 않는다).
- 국기 게양대·소화전·야외 자판기·철봉·허들·미닫이 교문·철망 울타리: 3/4 관문을 통과하지 못해 **뺐다** — 없는 키트 id 를 지어 부르지 않는다. 사람: Actor1 캐릭터 이벤트.

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 낱칸 바닥은 불투명 아래층(걷는다). 건물·소품은 위층·막힘. 나무 윗줄 2줄은 위층이지만 **걷는다**(★: 사람 머리 위에 그려진다), 밑동 줄은 막힘.
- 확인 범위: 구조·좌표·통행(4방 BFS)뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`mc-ex-{k}`({t})' for k, _, _, _, _, t in EXAMPLES)} · `mc-errors`(정상/오류 나란히).
"""


def example_md(title, d, img):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings'])
    props = collections.Counter(p['kit'] for p in d['props'])
    return f"""# modern_campus 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/campusComposer.ts`, compose_campus_grounds 와 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_campus_grounds({{style:"{d['style']}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}) · 교문 {[(c['x'], c['y']) for c in d['gate']]}.

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
    L = ["# modern_campus · 정상/오류 나란히 (변조 검출)\n", HEAD, "\n학교 예제를 실제로 변조해 검증기(`bake_refs_mc.validate`)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `outdoor-err-compare.png` 의 빨간 테두리 = 변조 자리.\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for kind, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_BOUNDS 맵 밖 · E_OVERLAP 건물 겹침 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE 시작 칸에서 안 닿음.")
    L.append("\n확인 범위: 구조·좌표·통행(4방 BFS). 이벤트 실행·미감은 보지 않는다. 구성 도구는 검사가 실패하면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).")
    return '\n'.join(L)


def main():
    nk = kit_sheet()
    exs = {}
    for key, style, W, H, seed, title in EXAMPLES:
        d = compose(style, W, H, seed); exs[key] = (title, d)
        RS.render(d).save(os.path.join(IMG, f'outdoor-{key}.png'), optimize=True)
        assert not validate(d), (key, validate(d)[:3])
    base = exs['school'][1]; rows = []; pics = [RS.render(base)]
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
    imgs = [dict(id='mc-img-kits', name='outdoor-kits.png', caption=f'야외 키트 도감 {nk}종(원본 ×2). 전부 object-gate 영수증이 있는 그림.', dataUrl=URL('outdoor-kits.png'))]
    for key, _, W, H, _, title in EXAMPLES:
        imgs.append(dict(id=f'mc-img-{key}', name=f'outdoor-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'outdoor-{key}.png')))
    imgs.append(dict(id='mc-img-err-compare', name='outdoor-err-compare.png', caption='학교 예제 정상(왼쪽 위)과 변조 4종(문 앞 막힘·맵 밖·겹침·길 끊김, 빨간 테두리 = 변조 자리).', dataUrl=URL('outdoor-err-compare.png')))
    docs = [dict(id='mc-howto', name='modern_campus 야외 · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md(exs)),
            dict(id='mc-dictionary', name='modern_campus 야외 · 사전(바닥·키트 전체 배열)', markdown=dictionary_md())]
    for key, _, _, _, _, title in EXAMPLES:
        docs.append(dict(id=f'mc-ex-{key}', name=f'modern_campus 야외 예제 · {title}', markdown=example_md(title, exs[key][1], f'outdoor-{key}.png')))
    docs.append(dict(id='mc-errors', name='modern_campus 야외 · 정상/오류 변조 검출', markdown=errors_md(rows)))
    cat = dict(id='mc-outdoor', name='modern_campus · 교정·교사 야외 (사전 · 순서 · 예제 2 · 변조 오류)',
               description='학교 교정·대학 쿼드·교문·운동장을 짓는 법. 구성 도구 compose_campus_grounds, 바닥 사전·키트 전체 배열·문 그림/접근칸/이벤트 분리·완성 예제 2장(구성기 실제 출력 배열)·변조 오류.', documents=docs, images=imgs)
    json.dump([cat], open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for kind, desc, errs in rows: print('변조', kind, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs), 'images', len(imgs))


if __name__ == '__main__':
    main()
