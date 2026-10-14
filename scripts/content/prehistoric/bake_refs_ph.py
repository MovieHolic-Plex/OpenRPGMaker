#!/usr/bin/env python3
"""prehistoric 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기 출력에서 기계적으로 만든다.

  python3 scripts/content/prehistoric/bake_ph.py && python3 scripts/content/prehistoric/bake_refs_ph.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/prehistoricComposer.ts(compose_prehistoric_map 도구와 같은 함수)를 qa/compose-scene.mts 로 돌린 결과다.
산출: src/assets/prehistoricReferences.json (그림은 경로만) · public/assets/prehistoric-references/*.png
용도 1개 `ph-prehistoric`: ph-howto · ph-dictionary · ph-ex-<예제 6> · ph-errors.
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa'))
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

DATA = json.load(open(os.path.join(ROOT, 'src/assets/prehistoricTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/prehistoric/prehistoric-chipset.png')).convert('RGBA')
TPR = DATA['tilesPerRow']; N = DATA['count']
IMG = os.path.join(ROOT, 'public/assets/prehistoric-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(ROOT, 'src/assets/prehistoricReferences.json')
URL = lambda n: '/assets/prehistoric-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
EXAMPLES = [('village', 'village', 48, 36, 1, '원시 부족 마을 48×36'), ('swamp', 'swamp', 44, 34, 1, '원시 늪지 44×34'), ('volcano', 'volcano', 44, 34, 1, '화산 골짜기 44×34'),
            ('fossil', 'fossil', 46, 34, 1, '공룡 화석 계곡 46×34'), ('cave-dwelling', 'cave-dwelling', 18, 13, 1, '동굴 거처 18×13'), ('cave-gallery', 'cave-gallery', 24, 12, 1, '동굴 벽화 회랑 24×12')]
HEAD = (f"tilesetId `prehistoric` · 그림 `public/assets/prehistoric/prehistoric-chipset.png`(텍스처 `tex_prehistoric`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-prehistoric` — 다른 칩셋(버들항·던전·일본 도시·조선·마법 학교·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트는 prehistoric 잠금 팔레트(재질 22)만. 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 모든 그림은 object-gate 3/4 관문 영수증이 있는 조각(가장자리·벽면 낱칸은 조립 표본 영수증)만 구웠다.")
# 가장자리 쌍: 이름 → (안 재질, 밖 재질)
PAIRS = dict(grass=('grass', 'dirt'), fern=('fern', 'dirt'), mud=('mud', 'dirt'), ash=('ash', 'dirt'), stone=('stone', 'grass'), swamp=('swamp', 'mud'),
             water=('water', 'dirt'), lava=('lava', 'crust'), crust=('crust', 'ash'))
ALIAS = {'dirt-b': 'dirt', 'grass-b': 'grass', 'mud-b': 'mud', 'ash-b': 'ash'}
NAME_OF = {}
for g in DATA['tileGroups']:
    if g['id'].startswith('ph:ph-') and len(g['tileIds']) >= 1 and g['role'] in ('terrain', 'wall'):
        for t in g['tileIds']: NAME_OF.setdefault(t, g['id'][6:])


def corners(t):
    """칸 번호 → 네 모서리 재질(NW NE SW SE) 또는 None(길·자갈·실내 같은 덮어쓰기 칸)."""
    n = NAME_OF.get(t)
    if n is None: return None
    if n.startswith('w-'):
        _, pair, key = n.split('-'); a, b = PAIRS[pair]
        return [a if ch == '1' else b for ch in key]
    n = ALIAS.get(n, n)
    if n in ('dirt', 'grass', 'fern', 'mud', 'ash', 'stone', 'swamp', 'water', 'lava', 'crust'): return [n] * 4
    return None


def arr(a): return json.dumps(a, separators=(',', ':'))
def passable(t): return t < 0 or bool(DATA['passability'][t]['up'])
def outdoor_kits(): return [k for k in DATA['structureKits'] if k.get('learnedFrom') == 'pack-preset']


def compose(style, W, H, seed):
    out = os.path.join('/tmp', f'ph-ref-{style}-{seed}.json')
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'compose-scene.mts'), '--', out, style, str(W), str(H), str(seed)],
                   cwd=ROOT, check=True, capture_output=True)
    return json.load(open(out))


def validate(d):
    """E_START_BLOCKED · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE · E_EXIT_UNREACHABLE · W_ISLAND + E_OVERLAP(건물 사각형) + E_EDGE_SEAM(이웃 칸 가장자리 모서리가 다른 재질)."""
    errs = list(RS.validate(d))
    W, H = d['width'], d['height']
    for y in range(H):
        for x in range(W):
            c = corners(d['lower'][y * W + x])
            if c is None: continue
            if x + 1 < W:
                r = corners(d['lower'][y * W + x + 1])
                if r is not None and (c[1] != r[0] or c[3] != r[2]): errs.append(('E_EDGE_SEAM', f'{c}|{r}', x, y))
            if y + 1 < H:
                r = corners(d['lower'][(y + 1) * W + x])
                if r is not None and (c[2] != r[0] or c[3] != r[1]): errs.append(('E_EDGE_SEAM', f'{c}/{r}', x, y))
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
    t = json.loads(json.dumps(d)); a = b0['access'][0]; stamp(t, 'ph-woodpile', a['x'], a['y'])
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 장작더미", t, [(a['x'], a['y'], 2, 1)]))
    t = json.loads(json.dumps(d)); b1, b2 = t['buildings'][0], t['buildings'][1]; b2['rect']['x'] = b1['rect']['x'] + 1; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김(사각형 겹침)", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    t = json.loads(json.dumps(d)); y = d['start']['y'] - 2
    for x in range(d['width']): stamp(t, 'ph-palisade', x, y)
    out.append(('unreachable', f"시작 칸 바로 위 {y}·{y + 1}줄 전체를 통나무 울타리로 막음", t, [(0, y, d['width'], 2)]))
    t = json.loads(json.dumps(d)); door = b0['doors'][0]; W = d['width']
    t['lower'][door['y'] * W + door['x']] = next(g['tileIds'][0] for g in DATA['tileGroups'] if g['id'] == 'ph:ph-path'); t['upper'][door['y'] * W + door['x']] = -1
    out.append(('door-open', f"{b0['name']} 문 칸 ({door['x']},{door['y']})을 지우고 흙길로(문 그림 대신 빈 길)", t, [(door['x'], door['y'], 1, 1)]))
    t = json.loads(json.dumps(d))
    k = next(i for i, v in enumerate(t['lower']) if (NAME_OF.get(v) or '').startswith('w-grass-'))
    t['lower'][k] = next(g['tileIds'][0] for g in DATA['tileGroups'] if g['id'] == 'ph:ph-water')
    out.append(('edge-seam', f"풀밭 가장자리 칸 ({k % W},{k // W})을 물 한 칸으로 바꿈(이웃과 모서리가 안 맞음)", t, [(k % W, k // W, 1, 1)]))
    return out


def kit_sheet(filter_fn, name):
    ks = [k for k in DATA['structureKits'] if filter_fn(k)]; S = 2; pad = 8
    items = [(k, BL.reassemble(k, SHEET, TPR)) for k in ks]
    Wd = 1400; x = y = pad; rowh = 0; place = []
    for k, im in sorted(items, key=lambda t: -t[1].height):
        lw = int(FONT.getlength(k['id'].replace('ph-', ''))) + 4        # 이름표가 옆 칸 이름과 겹치지 않게 칸 폭 >= 이름 폭
        w, h = max(im.width * S, lw), im.height * S + 14
        if x + w + pad > Wd: x, y, rowh = pad, y + rowh + pad, 0
        place.append((x, y, k, im)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + pad), (58, 56, 66, 255)); dr = ImageDraw.Draw(sheet)
    for x0, y0, k, im in place:
        dr.text((x0, y0), k['id'].replace('ph-', ''), fill=(255, 255, 255, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, name), optimize=True)
    return len(ks)


def is_interior_kit(k): return '실내' in (k.get('ai', {}).get('tags') or [])


def dictionary_md():
    L = [f"# prehistoric · 사전 (바닥 한 칸 · 가장자리 · 키트 전체 배열)\n\n{HEAD}\n"]
    L.append("## 바닥(낱칸, 반복해 칠한다)\n\n이름 그대로 `fill_region` 의 material 에 쓸 수 있다. 번호는 이 시트의 칸 번호(아래층). «막힘» 바닥(물·늪 물·용암·벽면·천장)은 아래층이지만 걸을 수 없다.\n")
    L.append('| 이름 | 조각 id | 칸 번호 | 통행 | 규칙 |\n|---|---|---|---|---|')
    for g in DATA['tileGroups']:
        if g['id'].startswith('ph:ph-') and not g['id'].startswith('ph:ph-w-') and g['role'] in ('terrain', 'wall'):
            t = g['tileIds'][0]
            L.append(f"| {g['name']} | `{g['id'][3:]}` | {t}{' (+프레임 ' + ','.join(map(str, g['tileIds'][1:])) + ')' if len(g['tileIds']) > 1 else ''} | {'걷는다' if passable(t) else '막힘'} | {g.get('placementRules', '')[:90]} |")
    L.append("\n## 꼭짓점 가장자리(Wang) — 고르는 법\n\n칸 하나의 네 모서리(NW NE SW SE) 각각이 «안 재질»(1)인지 «밖 재질»(0)인지로 낱칸 `w-<쌍>-<열쇠>` 를 고른다. 열쇠는 NW NE SW SE 순서의 0/1 네 글자(0000 = 밖 재질 한 칸, 1111 = 안 재질 한 칸 — 이 둘은 가장자리 조각이 아니라 위 표의 낱칸).\n"
             "이웃 칸은 모서리를 함께 쓴다: 오른쪽 이웃의 NW·SW = 내 NE·SE, 아래 이웃의 NW·NE = 내 SW·SE. 어긋나면 이음선이 보인다(E_EDGE_SEAM). 그래서 맵 크기 (W+1)×(H+1) 꼭짓점 격자에 재질을 먼저 칠하고 칸마다 네 모서리로 고른다 — compose_prehistoric_map 이 이렇게 한다.\n")
    L.append('| 쌍 | 안(1) | 밖(0) | 모양 | 막힘 |\n|---|---|---|---|---|')
    shape = dict(grass='솟음(남쪽 그늘)', fern='솟음', mud='평평(섞임)', ash='평평', stone='솟음', swamp='꺼짐(북쪽 둑 벽)', water='꺼짐', lava='꺼짐', crust='평평')
    for p, (a, b) in PAIRS.items():
        L.append(f"| `w-{p}-*` | {a} | {b} | {shape[p]} | {'모서리 1 이 둘 이상이면 막힘(물가 칸)' if p in ('swamp', 'water', 'lava') else '걷는다'} |")
    L.append("\n쌍은 사슬을 이룬다 — 안 재질이 다른 쌍의 밖 재질이 된다: 흙 → 풀 → 암반 · 흙 → 고사리 · 흙 → 진흙 → 늪 물 · 흙 → 화산재 → 굳은 용암 → 용암 · 흙 → 물. "
             "한 칸에는 한 사슬만 모인다(풀과 진흙이 한 칸에서 만나는 조각은 없다 — 사이에 흙 한 칸을 둔다). 이웃 꼭짓점의 단 차는 1 이하(풀 꼭짓점 바로 옆에 용암 꼭짓점 금지).\n")
    L.append("\n## 키트(여러 칸 물체) — `list_tileset_objects` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **집·동굴**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. "
             "키트는 전부 고정 조각이다(이어 찍기 없음) — 통나무 울타리 `ph-palisade`(1×2)만 칸마다 이어 찍는다. 움직이는 키트(모닥불·화톳불·횃불·타르 웅덩이·증기 구멍·화덕·돌 등잔)는 찍으면 프레임이 자동 반복된다.\n")
    for k in DATA['structureKits']:
        t = [r['tiles'] for r in k['rows']]; u = [r['upperTiles'] for r in k['rows']]
        ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
        extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄(걸을 수 있어야 함)" if ent else ''
        L.append(f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:160]}\n- 규칙: {k['ai'].get('placementRules', '')[:200]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n")
    return '\n'.join(L)


def howto_md():
    return f"""# prehistoric · 원시 마을·늪·화산·화석 계곡·동굴 실내 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_prehistoric_map({{style, seed?, newMap?:{{name}}, replace?}})` 가 아래 순서·규칙대로 한 장을 **매번 다르게** 짠다. 새 맵이 필요하면 `newMap:{{name}}` — 칩셋·크기를 맞춰 맵을 만든다.
  - 야외: `village`(44×34 이상) · `swamp`(40×30 이상) · `volcano`(40×32 이상) · `fossil`(42×32 이상). 실내: `cave-dwelling` · `cave-gallery` · `chieftain-hut` · `shaman-hut`.
  - 시작 칸에서 모든 문 접근칸(실내는 출구)에 닿는지 엔진 통행으로 확인해 안 되면 깔지 않는다(맵을 바꾸지 않는다).
- 동굴·집 문 ↔ 실내: 같은 도구의 실내 style + `newMap` 으로 방을 짓고 `link_prehistoric_interior({{mapId, door:{{x,y}}, width, interiorMapId}})` 로 잇는다. 문 좌표는 compose 결과 `data.buildings[].doors`(큰 동굴은 문이 두 칸 → width:2).

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **땅 계획(꼭짓점 격자)**: 바탕 재질(마을 = 풀밭, 늪 = 진흙, 화산 = 화산재, 화석 계곡 = 흙 골짜기 + 동·서 풀 언덕 위 암반 능선)을 꼭짓점에 칠하고, 덩이(숲 띠·강·늪 웅덩이·용암 웅덩이·맨땅 빈터·마른 땅)를 값 잡음으로 일그러뜨려 얹는다. **띠 전체를 한 재질로 덮지 않는다** — 넓은 바닥마다 다른 재질 덩이를 몇 개 섞는다.
2. **빈터**: 쓰임이 있는 곳만 흙으로 판다 — 마을 광장(타원), 작업터, 집터(집 밑변 두 줄 + 문 앞 두 줄), 동굴 앞 빈터, 발굴터(자갈). 빈 땅마다 쓰임이 있다.
3. **집·동굴**: 문은 모두 남향(맨 아래 줄). 집 둘레 1칸·문 앞 2칸은 비운다. 마을은 광장 북쪽 족장 긴 집, 광장 서·동쪽 움집, 숲가 동굴 입구(큰 동굴은 문 두 칸), 무당 천막은 마을 가장자리.
4. **길**: 시작 칸(남쪽 가장자리) → 광장, 광장 → 집마다 접근칸, 광장 → 동굴. 길 칸의 네 꼭짓점을 흙으로 잠근 뒤 흙길(`path`)을 칠한다 — 그래서 길 둘레는 풀 가장자리가 자연스럽게 맞물린다. 강은 밧줄 다리(`bridge-h`, 물 위 위층 덧그림, 걷는다)로 건너고 양 끝 둑에 다리 기둥.
5. **소품**: 발자국 + 여백을 예약하고 겹치지 않는다. **자기 바닥 위에만** — 밑줄(서 있는 줄)의 바닥이 맞아야 놓는다:
   - 화톳불·돌 의자·북은 광장 흙, 건조대·가죽 틀·장작·맷돌은 작업터 흙, 정글 나무·나무고사리·큰 고사리는 고사리 바닥, 소철·덤불·열매 덤불은 풀밭,
   - 늪 나무·갈대·속새는 진흙(물가), 연잎은 늪 물·맑은 물 위(덧그림 ★ — 밟고 건너지 못한다), 통나무배는 물가 칸,
   - 고목·현무암 기둥·용암 첨탑·흑요석·증기 구멍은 화산재·굳은 용암, 긴 목 뼈대·뼈 더미는 발굴터 자갈, 갈비뼈·머리뼈 화석은 흙, 화석 박힌 바위는 풀·암반.
   소품 하나마다 시작 칸 BFS 로 이미 닿던 칸이 끊기지 않는지 확인한다.
6. **실내**: 바닥 덩이(동굴은 2~3칸 너비 계단으로 윗변이 오르내린다) · 바닥 윗변 위 두 줄은 벽면(`wall-<rock|wattle|hide>-u` 위·`-d` 아래, 막힘, 끝 칸 `-l`·`-r`) · 나머지는 천장 바위(`ceil`, 이웃 북·동·서에 바닥·벽면이 있으면 `ceil-<n|e|w…>` 테) · 맨 아래 줄 가운데 출입구 틈 2칸. 벽화(`paint-*`)는 바위 벽면 두 줄을 그림 조각으로 바꾼다(두 칸 그림은 같은 높이 두 열). 벽걸이(약초·탈·사슴뿔·칠한 가죽)는 벽면 아랫줄(1×2 는 두 줄)에. 화덕은 방 가운데, 잠자리·제단·족장 자리·해골 선반은 북쪽 벽 앞.

## 금지 조건
- 키트끼리 위층 칸이 겹치면 안 된다. 집이 겹치면 안 된다(E_OVERLAP). 문 칸이 걸을 수 있으면 안 되고(E_DOOR_CELL_OPEN) 접근칸이 막히면 안 된다(E_DOOR_ACCESS_BLOCKED). 시작 칸에서 접근칸·출구가 안 닿으면 안 된다(E_DOOR_UNREACHABLE·E_EXIT_UNREACHABLE).
- 가장자리 이웃 모서리가 어긋나면 안 된다(E_EDGE_SEAM). 물·늪 물·용암 위에 서 있는 소품을 놓지 않는다(연잎·뗏목·통나무배 제외).

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 집·동굴 키트 맨 아래 줄 출입구(막힘). **접근칸** = 문 바로 아래 줄(걸을 수 있는 바닥). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에 건다(link_prehistoric_interior 가 만든다).

## 반복 가능 / 고정
- 반복: 바닥 낱칸 전부(흙·흙길·풀·고사리·암반·자갈·화산재·굳은 용암·진흙·늪 물·맑은 물·용암·밧줄 다리·실내 바닥·벽면·천장)와 가장자리 낱칸(꼭짓점 규칙대로). 고정: 집·동굴·소품·나무·화석·가구·벽화.

## 없는 소재
- 사람·글자·간판은 그리지 않았다(사람: Actor1 캐릭터 이벤트). 매머드 머리뼈는 반려되어 없다(뼈 집의 엄니 아치·뼈 더미·긴 목 뼈대로 대신한다).
- 3/4 관문을 통과하지 못한 조각은 **뺐다**(bake-report.json blocked) — 없는 키트 id 를 지어 부르지 않는다. `list_tileset_objects({{tilesetId:"prehistoric"}})` 로 실제 목록을 확인한다.

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 낱칸 바닥은 불투명 아래층(걷는다). 물·늪 물·용암·물가 가장자리(모서리 1 이 둘 이상)·벽면·천장은 아래층이지만 **막힘**.
- 집·동굴·소품은 위층·막힘. 나무·토템·선돌·횃불·건조대처럼 키 큰 키트는 **밑줄(발자국)만 막힘**이고 그 위 줄은 ★(뒤로 지나가면 사람 위에 그려진다). 큰 나무·뼈대·돌 둘레는 밑줄 중에서도 줄기·뼈가 땅에 닿는 칸만 막힘.
- 연잎·뗏목은 ★ 덧그림이라 밑의 물이 통행을 정한다(막힘). 밧줄 다리·발자국은 투명 덧그림이지만 걷는다(다리는 물 위를 건너게 해 준다).
- 확인 범위: 구조·좌표·통행(4방 BFS)·가장자리 모서리 일치뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`ph-ex-{k}`({t})' for k, _, _, _, _, t in EXAMPLES)} · `ph-errors`(정상/오류 나란히).
"""


def example_md(title, d, img):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings']) or '- (실내 — 집 없음)'
    props = collections.Counter(p['kit'] for p in d['props'])
    zones = '\n'.join(f"- {z['name']}({z['use']}): ({z['rect']['x']},{z['rect']['y']}) {z['rect']['w']}×{z['rect']['h']}" for z in d['zones'])
    return f"""# prehistoric 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/prehistoricComposer.ts`, compose_prehistoric_map 과 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_prehistoric_map({{style:"{d['style']}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}) · 출구 {[(c['x'], c['y']) for c in d['exits']]}.

## 구역(빈 땅마다 쓰임)
{zones}

## 집·동굴·문·접근칸
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
    L = ["# prehistoric · 정상/오류 나란히 (변조 검출)\n", HEAD, "\n마을 예제를 실제로 변조해 검증기(`bake_refs_ph.validate`)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `err-compare.png` 의 빨간 테두리 = 변조 자리.\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for kind, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_EDGE_SEAM 가장자리 모서리 어긋남 · E_OVERLAP 집 겹침 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE 시작 칸에서 안 닿음 · E_EXIT_UNREACHABLE 출구에 안 닿음 · E_START_BLOCKED 시작 칸 막힘 · W_ISLAND 고립된 걸음 칸.")
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
    base = exs['village'][1]; rows = []; pics = [RS.render(base)]
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
    imgs = [dict(id='ph-img-kits-outdoor', name='kits-outdoor.png', caption=f'야외 키트 도감 {nk}종(원본 ×2). 전부 object-gate 영수증이 있는 그림.', dataUrl=URL('kits-outdoor.png')),
            dict(id='ph-img-kits-interior', name='kits-interior.png', caption=f'실내 키트 도감 {ni}종(원본 ×2).', dataUrl=URL('kits-interior.png'))]
    for key, _, W, H, _, title in EXAMPLES:
        imgs.append(dict(id=f'ph-img-{key}', name=f'ex-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'ex-{key}.png')))
    imgs.append(dict(id='ph-img-err-compare', name='err-compare.png', caption='마을 예제 정상(왼쪽 위)과 변조 5종(문 앞 막힘·집 겹침·길 끊김·문 칸 열림·가장자리 어긋남, 빨간 테두리 = 변조 자리).', dataUrl=URL('err-compare.png')))
    docs = [dict(id='ph-howto', name='prehistoric · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md()),
            dict(id='ph-dictionary', name='prehistoric · 사전(바닥·가장자리·키트 전체 배열)', markdown=dictionary_md())]
    for key, _, _, _, _, title in EXAMPLES:
        docs.append(dict(id=f'ph-ex-{key}', name=f'prehistoric 예제 · {title}', markdown=example_md(title, exs[key][1], f'ex-{key}.png')))
    docs.append(dict(id='ph-errors', name='prehistoric · 정상/오류 변조 검출', markdown=errors_md(rows)))
    cat = dict(id='ph-prehistoric', name='prehistoric · 선사 원시 세계 (사전 · 순서 · 예제 6 · 변조 오류)',
               description='원시 부족 마을·늪지·화산 골짜기·공룡 화석 계곡과 동굴 거처·벽화 회랑·족장 집·무당 천막 실내를 짓는 법. 구성 도구 compose_prehistoric_map, 바닥·꼭짓점 가장자리 사전·키트 전체 배열·문 그림/접근칸/이벤트 분리·완성 예제 6장(구성기 실제 출력 배열)·변조 오류.', documents=docs, images=imgs)
    json.dump([cat], open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for kind, desc, errs in rows: print('변조', kind, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs), 'images', len(imgs))


if __name__ == '__main__':
    main()
