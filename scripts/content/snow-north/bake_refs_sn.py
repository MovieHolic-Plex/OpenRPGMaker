#!/usr/bin/env python3
"""snow_north 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기 출력에서 기계적으로 만든다.

  python3 scripts/content/snow-north/bake_sn.py && python3 scripts/content/snow-north/bake_refs_sn.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/snowNorthComposer.ts(compose_snow_north_map 도구와 같은 함수)를 qa/compose-scene.mts 로 돌린 결과다.
산출: src/assets/snowNorthReferences.json (그림은 경로만) · public/assets/snow-north-references/*.png
용도 1개 `sn-snow-north`: sn-howto · sn-dictionary · sn-ex-<예제 7> · sn-errors.
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa'))
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

DATA = json.load(open(os.path.join(ROOT, 'src/assets/snowNorthTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/snow-north/snow-north-chipset.png')).convert('RGBA')
TPR = DATA['tilesPerRow']; N = DATA['count']
IMG = os.path.join(ROOT, 'public/assets/snow-north-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(ROOT, 'src/assets/snowNorthReferences.json')
URL = lambda n: '/assets/snow-north-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
EXAMPLES = [('village', 'village', 46, 36, 1, '눈 덮인 북방 마을 46×36'), ('lake', 'lake', 42, 32, 1, '얼어붙은 호수 낚시터 42×32'),
            ('cave', 'cave', 38, 30, 1, '얼음 동굴 입구 38×30'), ('market', 'market', 42, 32, 1, '겨울 장터 42×32'),
            ('cabin', 'cabin', 12, 10, 1, '통나무 오두막 실내 12×10'), ('longhall', 'longhall', 20, 12, 1, '씨족 긴 회관 실내 20×12'),
            ('ice-cave', 'ice-cave', 18, 12, 1, '얼음 동굴 안 18×12')]
HEAD = (f"tilesetId `snow_north` · 그림 `public/assets/snow-north/snow-north-chipset.png`(텍스처 `tex_snow_north`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-snow` — 다른 칩셋(버들항 눈 기후 시트·마법 학교·던전·일본 도시·조선·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트는 snow_north 잠금 팔레트(차가운 파랑·흰색 + 따뜻한 창불)만. 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 모든 그림은 object-gate 3/4 관문 영수증이 있는 조각(목책·울타리·굴뚝 연기는 조립 그림 영수증, 오토타일 칸은 견본 영수증)만 구웠다.")

AUTOS = {g['id']: g for g in DATA['autotileGroups']}
OF = {}       # 칸 번호 → 오토타일 그룹 id
for g in DATA['autotileGroups']:
    for t in g['memberTileIds']: OF.setdefault(t, g['id'])
DIRS = dict(N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)


def canon(m):
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    out = m & 15
    if n and e and m & 16: out |= 16
    if s and e and m & 32: out |= 32
    if s and w and m & 64: out |= 64
    if n and w and m & 128: out |= 128
    return out


def arr(a): return json.dumps(a, separators=(',', ':'))
def passable(t): return t >= 0 and bool(DATA['passability'][t]['up'])
def tile_of(piece): return next(g['tileIds'][0] for g in DATA['tileGroups'] if g['id'] == 'sn:sn-' + piece)


def compose(style, W, H, seed):
    out = os.path.join('/tmp', f'sn-ref-{style}-{seed}.json')
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'compose-scene.mts'), '--', out, style, str(W), str(H), str(seed)],
                   cwd=ROOT, check=True, capture_output=True)
    return json.load(open(out))


def validate(d):
    """RS.validate(통행 BFS) + E_OVERLAP(건물 사각형) + E_AUTOTILE_MASK(오토타일 칸이 이웃과 맞는 모양이 아님 — 덩이 가장자리 어긋남)."""
    errs = list(RS.validate(d))
    W, H = d['width'], d['height']; lo = d['lower']
    for y in range(H):
        for x in range(W):
            t = lo[y * W + x]; gid = OF.get(t)
            if gid is None: continue
            g = AUTOS[gid]; conn = set(g.get('connectTileIds') or g['memberTileIds'])
            same = lambda X, Y: not (0 <= X < W and 0 <= Y < H) or lo[Y * W + X] in conn
            m = 0
            for nm, (dx, dy) in dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1)).items():
                if same(x + dx, y + dy): m |= DIRS[nm]
            want = g['variantMap'][str(m)]
            ok = t == want or (canon(m) == 255 and t in g['interiorVariants'][0])
            if not ok: errs.append(('E_AUTOTILE_MASK', gid, x, y))
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
    out = []; W = d['width']
    b0 = d['buildings'][1] if len(d['buildings']) > 1 else d['buildings'][0]
    t = json.loads(json.dumps(d)); a = b0['access'][0]; stamp(t, 'sn-woodpile', a['x'], a['y'] - 1)
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 장작더미", t, [(a['x'], a['y'] - 1, 2, 2)]))
    t = json.loads(json.dumps(d)); b1, b2 = t['buildings'][0], t['buildings'][1]; b2['rect']['x'] = b1['rect']['x'] + 1; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김(사각형 겹침)", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    t = json.loads(json.dumps(d)); y = d['start']['y'] - 2
    for x in range(W): stamp(t, 'sn-palisade', x, y)
    out.append(('unreachable', f"시작 칸 바로 위 {y}·{y + 1}줄 전체를 통나무 목책으로 막음", t, [(0, y, W, 2)]))
    t = json.loads(json.dumps(d)); door = b0['doors'][0]
    t['lower'][door['y'] * W + door['x']] = tile_of('pack'); t['upper'][door['y'] * W + door['x']] = -1
    out.append(('door-open', f"{b0['name']} 문 칸 ({door['x']},{door['y']})을 지우고 다진 눈으로(문 그림 대신 빈 길)", t, [(door['x'], door['y'], 1, 1)]))
    t = json.loads(json.dumps(d))
    ice_body = AUTOS['sn-at-ice']['variantMap']['255']
    k = next(i for i, v in enumerate(t['lower']) if v in (tile_of('snow'),) and t['upper'][i] < 0 and 3 < i % W < W - 4 and 3 < i // W < d['height'] - 4)
    t['lower'][k] = ice_body
    out.append(('autotile-seam', f"눈밭 한가운데 칸 ({k % W},{k // W})을 얼음 «속» 칸으로 바꿈(사방이 눈인데 둑 없는 얼음 — 모양이 이웃과 안 맞음)", t, [(k % W, k // W, 1, 1)]))
    return out


def kit_sheet(filter_fn, name):
    ks = [k for k in DATA['structureKits'] if filter_fn(k)]; S = 2; pad = 8
    items = [(k, BL.reassemble(k, SHEET, TPR)) for k in ks]
    Wd = 1400; x = y = pad; rowh = 0; place = []
    for k, im in sorted(items, key=lambda t: -t[1].height):
        lw = int(FONT.getlength(k['id'].replace('sn-', ''))) + 4
        w, h = max(im.width * S, lw), im.height * S + 14
        if x + w + pad > Wd: x, y, rowh = pad, y + rowh + pad, 0
        place.append((x, y, k, im)); x += w + pad; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + pad), (58, 56, 66, 255)); dr = ImageDraw.Draw(sheet)
    for x0, y0, k, im in place:
        dr.text((x0, y0), k['id'].replace('sn-', ''), fill=(255, 255, 255, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, name), optimize=True)
    return len(ks)


def autotile_sheet(name):
    """오토타일 6 그룹: 대표 모양 칸(속·네 변·네 모서리·외딴) 원본 ×2."""
    show = [255, 0, 4 | 2 | 32, 4 | 8 | 64, 1 | 2 | 16, 1 | 8 | 128, 255 - 16, 255 - 128, 1 | 4, 2 | 8]
    S = 2; rows = len(AUTOS); im = Image.new('RGBA', (170 + len(show) * (16 * S + 4), rows * (16 * S + 6) + 6), (58, 56, 66, 255)); dr = ImageDraw.Draw(im)
    for r, g in enumerate(DATA['autotileGroups']):
        y = 6 + r * (16 * S + 6); dr.text((6, y + 8), g['name'][:16], fill=(255, 255, 255, 255), font=FONT)
        for i, m in enumerate(show):
            t = g['variantMap'][str(m)]
            c = SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16)).resize((16 * S, 16 * S), Image.NEAREST)
            im.alpha_composite(c, (170 + i * (16 * S + 4), y))
    im.save(os.path.join(IMG, name), optimize=True)


def is_interior_kit(k): return '실내' in (k.get('ai', {}).get('tags') or [])


def dictionary_md():
    L = [f"# snow_north · 사전 (바닥 한 칸 · 오토타일 · 키트 전체 배열)\n\n{HEAD}\n"]
    L.append("## 바닥(낱칸, 반복해 칠한다)\n\n이름 그대로 `fill_region` 의 material 에 쓸 수 있다. 번호는 이 시트의 칸 번호(아래층). «막힘» 바닥(열린 물·벽면·천장)은 아래층이지만 걸을 수 없다.\n")
    L.append('| 이름 | 조각 id | 칸 번호 | 통행 | 규칙 |\n|---|---|---|---|---|')
    for g in DATA['tileGroups']:
        if g['id'].startswith('sn:sn-') and g['role'] in ('terrain', 'wall') and g['id'] not in ('sn:sn-buildings', 'sn:sn-props', 'sn:sn-interior'):
            t = g['tileIds'][0]
            L.append(f"| {g['name']} | `{g['id'][3:]}` | {t}{' (+프레임 ' + ','.join(map(str, g['tileIds'][1:4])) + ')' if 1 < len(g['tileIds']) <= 4 else ''} | {'걷는다' if passable(t) else '막힘'} | {(g.get('placementRules') or '')[:90]} |")
    L.append("\n## 오토타일 6 그룹(덩이로 칠하면 가장자리가 저절로 맞는다)\n\n엔진 `autotileGroups` (8이웃, 47 모양 + 속 변형). 칸 하나의 모양은 이웃 8칸이 «같은 덩이»인지로 정해진다: 비트 N1 E2 S4 W8 NE16 SE32 SW64 NW128 "
             "(대각선 비트는 그 양옆 변이 둘 다 같을 때만 센다). 맵 밖은 같은 덩이로 센다. 낱칸 번호로 가장자리를 손으로 고르지 말고 `fill_region`/붓으로 그룹을 칠한다 — 그러면 엔진이 모양을 고른다. "
             "그림 `autotiles.png`: 그룹마다 속·남북동서 가장자리·모서리 칸.\n")
    L.append('| 그룹 id | 이름 | 통행 | 속 칸(255) | 속 변형 | 이어진 이웃 |\n|---|---|---|---|---|---|')
    for g in DATA['autotileGroups']:
        t = g['variantMap']['255']
        L.append(f"| `{g['id']}` | {g['name']} | {'걷는다' if passable(t) else '막힘'} | {t} | {g['interiorVariants'][0][1:]} | {'열린 물 칸도 같은 덩이로 본다(얼음 구멍 둘레에 눈 둑이 생기지 않는다)' if g.get('connectTileIds') else '자기 그룹만'} |")
    L.append("\n쓰임: 다진 눈길 = 길·광장·문 앞, 얼음 = 호수·강(걸을 수 있다), 열린 물 = 얼음 위 낚시 구멍·여울(막힘, 반드시 얼음 덩이 안), 툰드라 = 숲가·바위 둘레 맨땅, 서리 풀 = 집 뒤뜰·울타리 안, 진창 = 우물가·장터·마구간. 바탕은 낱칸 눈밭(`snow`, 변주 `snow-b/c/d`).\n")
    L.append("\n## 키트(여러 칸 물체) — `list_tileset_objects` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **집**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. "
             "목책 `sn-palisade`(1×2 가로)·`sn-palisade-v`(세로)·울타리 `sn-fence`·`sn-fence-v`·얼음 담 `sn-ice-wall` 은 칸마다 이어 찍는다. 굴뚝 연기 `sn-smoke`(1×2)는 굴뚝 바로 위 두 칸. "
             "움직이는 키트(열린 물·화로·모닥불·연기·벽난로·솥·사우나 난로·화덕)는 찍으면 프레임이 자동 반복된다. 오로라 깃발은 **벽걸이** — 건물 앞벽이나 실내 벽면에만.\n")
    for k in DATA['structureKits']:
        t = [r['tiles'] for r in k['rows']]; u = [r['upperTiles'] for r in k['rows']]
        ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
        extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄(걸을 수 있어야 함)" if ent else ''
        L.append(f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:160]}\n- 규칙: {k['ai'].get('placementRules', '')[:200]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n")
    return '\n'.join(L)


def howto_md():
    return f"""# snow_north · 눈 마을·얼어붙은 호수·얼음 동굴 입구·겨울 장터·실내 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_snow_north_map({{style, seed?, newMap?:{{name}}, replace?}})` 가 아래 순서·규칙대로 한 장을 **매번 다르게** 짠다. 새 맵이 필요하면 `newMap:{{name}}` — 칩셋·크기를 맞춰 맵을 만든다.
  - 야외: `village`(44×34 이상) · `lake`(40×30 이상) · `cave`(36×28 이상) · `market`(40×30 이상). 실내: `cabin` · `longhall` · `tavern` · `sauna` · `ice-cave`.
  - 시작 칸에서 모든 문 접근칸(실내는 출구)에 닿는지 엔진 통행으로 확인해 안 되면 깔지 않는다(맵을 바꾸지 않는다).
- 집 문 ↔ 실내: 같은 도구의 실내 style + `newMap` 으로 방을 짓고 `link_snow_north_interior({{mapId, door:{{x,y}}, width, interiorMapId}})` 로 잇는다. 문 좌표는 compose 결과 `data.buildings[].doors`.

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **바탕**: 눈밭 낱칸(`snow` + 큰 덩이로만 `snow-b/c/d` 변주 — 자잘한 점박이 금지). 북쪽 가장자리는 가문비 숲 띠(나무 덩이 사이 틈을 둔다).
2. **덩이(오토타일)**: 툰드라·서리 풀·진창은 불규칙한 작은 덩이로, 한 덩이는 한 쓰임(집 뒤뜰 = 서리 풀, 우물가·장터 = 진창, 숲가 = 툰드라). 덩이 가장자리 1칸 돌기·홈은 다듬는다. 호수·강은 얼음 덩이, 낚시 구멍은 얼음 덩이 **안**에 1×1~2×1 열린 물.
3. **빈터·길**: 쓰임이 있는 곳만 다진 눈길로 판다 — 마을 광장, 장터 마당, 문 앞 두 줄, 시작 칸에서 광장·집마다 접근칸·동굴 입구·호숫가 오두막으로 이어지는 길(너비 1~2). 빈 땅마다 쓰임이 있다.
4. **집**: 문은 모두 남향(맨 아래 줄). 집 둘레 1칸·문 앞 2칸은 비운다. 마을은 목책 고리 + 남쪽 문루, 광장 북쪽 회관·통널 교회, 둘레 오두막, 가장자리 대장간·창고·사우나·훈제막. 굴뚝 연기는 지붕 바로 위.
   집 밑(문 앞 포함)의 땅은 집과 같은 땅 — 눈밭 섬 위 오두막 금지(호숫가 낚시 오두막은 얼음 위).
5. **소품**: 발자국 + 여백을 예약하고 겹치지 않는다. **자기 바닥 위에만**:
   - 화로·우물·이정표·불바구니 기둥은 광장 다진 눈, 노점·상자·통·자루는 장터, 장작더미·도끼 받침·썰매·스키 걸이는 집 마당(문 옆),
   - 생선 건조대·훈제막 곁 생선은 호숫가, 얼음 낚시 자리(`sn-fishing-spot`)는 얼음 위, 뒤집힌 배는 물가 눈 위, 갈대는 물가,
   - 가문비·자작나무·바위·그루터기는 숲 띠와 들의 덩이(혼자 서 있는 나무를 일렬로 늘어놓지 않는다), 천막·모닥불·가마솥은 동굴 앞 야영터.
   소품 하나마다 시작 칸 BFS 로 이미 닿던 칸이 끊기지 않는지 확인한다.
6. **실내**: 바깥 테두리는 천장(`ceiling` / 얼음 동굴 `ceiling-ice`, 막힘) · 북쪽 두 줄 벽면(`wall-<log|plank|ice>-u` 위·`-d` 아래, 막힘, 오두막은 `wall-window-u/d` 창) · 나머지 바닥(`floor-plank|stone|ice|sauna`) · 맨 아래 줄 가운데 출입구 2칸.
   벽난로·이층 침대·술통 받침은 북쪽 벽 앞(키 큰 가구는 윗줄이 벽면 아랫줄에 걸친다), 벽걸이(선반·사슴뿔·약초 다발·등·무기 걸이·오로라 깃발)는 벽면 칸에. 회관은 가운데 화덕 + 양옆 긴 상·긴 의자, 선술집은 북벽에서 한 칸 띄운 바 + 걸상 줄, 사우나는 난로 + 두 단 의자 + 물동이.

## 금지 조건
- 키트끼리 위층 칸이 겹치면 안 된다. 집이 겹치면 안 된다(E_OVERLAP). 문 칸이 걸을 수 있으면 안 되고(E_DOOR_CELL_OPEN) 접근칸이 막히면 안 된다(E_DOOR_ACCESS_BLOCKED). 시작 칸에서 접근칸·출구가 안 닿으면 안 된다(E_DOOR_UNREACHABLE·E_EXIT_UNREACHABLE).
- 오토타일 칸 모양이 이웃과 어긋나면 안 된다(E_AUTOTILE_MASK) — 낱칸 번호로 가장자리를 흉내 내지 말고 그룹으로 칠한다. 열린 물 위에 소품을 놓지 않는다. 눈사람은 없다(그리지 않았다).

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 집 키트 맨 아래 줄 출입구(막힘). **접근칸** = 문 바로 아래 줄(걸을 수 있는 다진 눈). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에 건다(link_snow_north_interior 가 만든다).

## 반복 가능 / 고정
- 반복: 바닥 낱칸 전부(눈·다진 눈·얼음·툰드라·서리 풀·진창·널판 길·판석·실내 바닥·벽면·천장)와 오토타일 6 그룹(덩이로). 고정: 집·소품·나무·가구·벽걸이.

## 없는 소재
- 사람·글자·간판·로고·눈사람은 그리지 않았다(사람: Actor1 캐릭터 이벤트). 오로라 깃발은 추상 무늬만.
- 3/4 관문을 통과하지 못한 조각은 **뺐다**(bake-report.json blocked) — 없는 키트 id 를 지어 부르지 않는다. `list_tileset_objects({{tilesetId:"snow_north"}})` 로 실제 목록을 확인한다.

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 낱칸·오토타일 바닥은 불투명 아래층(걷는다). 열린 물·벽면·천장은 아래층이지만 **막힘**. 얼음은 걷는다.
- 집·소품은 위층·막힘. 나무·이정표·화로·건조대·망루처럼 키 큰 키트는 **밑줄(발자국)만 막힘**이고 그 위 줄은 ★(뒤로 지나가면 사람 위에 그려진다). 벽걸이·굴뚝 연기는 ★.
- 확인 범위: 구조·좌표·통행(4방 BFS)·오토타일 모양 일치뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 버들항 눈 기후와의 관계
- «눈 오는 버들항»·버들항 겨울 기후 요청은 버들항 칩셋(눈 기후 시트)의 일이다. 이 칩셋은 «북방 설원·눈 마을·바이킹풍 겨울 마을» 처럼 북방 세계를 따로 지을 때 쓴다. 두 칩셋 칸 번호를 섞지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`sn-ex-{k}`({t})' for k, _, _, _, _, t in EXAMPLES)} · `sn-errors`(정상/오류 나란히).
"""


def example_md(title, d, img):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings']) or '- (실내 — 집 없음)'
    props = collections.Counter(p['kit'] for p in d['props'])
    zones = '\n'.join(f"- {z['name']}({z['use']}): ({z['rect']['x']},{z['rect']['y']}) {z['rect']['w']}×{z['rect']['h']}" for z in d['zones'])
    return f"""# snow_north 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/snowNorthComposer.ts`, compose_snow_north_map 과 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_snow_north_map({{style:"{d['style']}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}) · 출구 {[(c['x'], c['y']) for c in d['exits']]}.

## 구역(빈 땅마다 쓰임)
{zones}

## 집·문·접근칸
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
    L = ["# snow_north · 정상/오류 나란히 (변조 검출)\n", HEAD, "\n마을 예제를 실제로 변조해 검증기(`bake_refs_sn.validate`)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `err-compare.png` 의 빨간 테두리 = 변조 자리.\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for kind, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_AUTOTILE_MASK 오토타일 모양이 이웃과 안 맞음 · E_OVERLAP 집 겹침 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE 시작 칸에서 안 닿음 · E_EXIT_UNREACHABLE 출구에 안 닿음 · E_START_BLOCKED 시작 칸 막힘 · W_ISLAND 고립된 걸음 칸.")
    L.append("\n확인 범위: 구조·좌표·통행(4방 BFS)·오토타일 모양. 이벤트 실행·미감은 보지 않는다. 구성 도구는 검사가 실패하면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).")
    return '\n'.join(L)


def main():
    nk = kit_sheet(lambda k: not is_interior_kit(k), 'kits-outdoor.png')
    ni = kit_sheet(is_interior_kit, 'kits-interior.png')
    autotile_sheet('autotiles.png')
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
    imgs = [dict(id='sn-img-kits-outdoor', name='kits-outdoor.png', caption=f'야외 키트 도감 {nk}종(원본 ×2). 전부 object-gate 영수증이 있는 그림.', dataUrl=URL('kits-outdoor.png')),
            dict(id='sn-img-kits-interior', name='kits-interior.png', caption=f'실내 키트 도감 {ni}종(원본 ×2).', dataUrl=URL('kits-interior.png')),
            dict(id='sn-img-autotiles', name='autotiles.png', caption='오토타일 6 그룹 — 속·가장자리·모서리 대표 칸(원본 ×2).', dataUrl=URL('autotiles.png'))]
    for key, _, W, H, _, title in EXAMPLES:
        imgs.append(dict(id=f'sn-img-{key}', name=f'ex-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'ex-{key}.png')))
    imgs.append(dict(id='sn-img-err-compare', name='err-compare.png', caption='마을 예제 정상(왼쪽 위)과 변조 5종(문 앞 막힘·집 겹침·길 끊김·문 칸 열림·오토타일 어긋남, 빨간 테두리 = 변조 자리).', dataUrl=URL('err-compare.png')))
    docs = [dict(id='sn-howto', name='snow_north · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md()),
            dict(id='sn-dictionary', name='snow_north · 사전(바닥·오토타일·키트 전체 배열)', markdown=dictionary_md())]
    for key, _, _, _, _, title in EXAMPLES:
        docs.append(dict(id=f'sn-ex-{key}', name=f'snow_north 예제 · {title}', markdown=example_md(title, exs[key][1], f'ex-{key}.png')))
    docs.append(dict(id='sn-errors', name='snow_north · 정상/오류 변조 검출', markdown=errors_md(rows)))
    cat = dict(id='sn-snow-north', name='snow_north · 북방 설원 (사전 · 순서 · 예제 7 · 변조 오류)',
               description='눈 덮인 북방 마을·얼어붙은 호수 낚시터·얼음 동굴 입구·겨울 장터와 오두막·긴 회관·선술집·사우나·얼음 동굴 실내를 짓는 법. 구성 도구 compose_snow_north_map, 바닥·오토타일 사전·키트 전체 배열·문 그림/접근칸/이벤트 분리·완성 예제 7장(구성기 실제 출력 배열)·변조 오류.', documents=docs, images=imgs)
    json.dump([cat], open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for kind, desc, errs in rows: print('변조', kind, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs), 'images', len(imgs))


if __name__ == '__main__':
    main()
