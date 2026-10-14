#!/usr/bin/env python3
"""sky_island 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 실제 구성기 출력에서 기계적으로 만든다.

  python3 scripts/content/sky-island/bake_si.py && python3 scripts/content/sky-island/bake_refs_si.py

예제 배열은 손으로 쓴 견본이 아니라 src/project/skyIslandComposer.ts(compose_sky_island_map 도구와 같은 함수)를 qa/compose-scene.mts 로 돌린 결과다.
산출: src/assets/skyIslandReferences.json (그림은 경로만 — 바이트 없음) · public/assets/sky-island-references/*.png
용도 2개: `si-outdoor`(사전 · 순서 · 예제 4 · 변조 오류) · `si-interior`(순서 · 방 예제 4 · 변조 오류).
"""
import collections, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city')); sys.path.insert(0, os.path.join(HERE, 'qa'))
import bake_lib as BL        # noqa: E402
import render_scene as RS    # noqa: E402

DATA = json.load(open(os.path.join(ROOT, 'src/assets/skyIslandTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/sky-island/sky-island-chipset.png')).convert('RGBA')
TPR = DATA['tilesPerRow']; N = DATA['count']; TM = DATA['tileMeta']
KITS = {k['id']: k for k in DATA['structureKits']}
GROUPS = {g['id']: g for g in DATA['tileGroups']}
IMG = os.path.join(ROOT, 'public/assets/sky-island-references'); os.makedirs(IMG, exist_ok=True)
OUT = os.path.join(ROOT, 'src/assets/skyIslandReferences.json')
URL = lambda n: '/assets/sky-island-references/' + n
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
# (키, style, W, H, seed, 제목) — 크기는 compose_sky_island_map 의 빈 맵 자동 크기와 같다.
OUTDOOR = [('village', 'village', 50, 34, 7, '하늘섬 마을 50×34'), ('shrine', 'shrine', 46, 40, 7, '구름 위 신전 섬 46×40'),
           ('dock', 'dock', 52, 30, 7, '비공정 부두 52×30'), ('archipelago', 'archipelago', 54, 42, 7, '섬 사슬(섬 넷·다리 넷) 54×42')]
ROOMS = [('cottage', 'room-cottage', 11, 11, 7, '오두막 실내 11×11'), ('shrine', 'room-shrine', 13, 14, 7, '신전 실내 13×14'),
         ('cabin', 'room-cabin', 11, 10, 7, '비공정 선실 11×10'), ('observatory', 'room-observatory', 13, 12, 7, '천문대 실내 13×12')]
HEAD = (f"tilesetId `sky_island` · 그림 `public/assets/sky-island/sky-island-chipset.png`(텍스처 `tex_sky_island`, **{N}칸**, 16px 칸, 시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, "
        f"한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-sky` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·고딕·실내 v5)의 칸 번호와 섞지 않는다. "
        "팔레트 잠금 손 도트, 시점은 3/4 탑뷰(윗면 + 남쪽 앞면), 빛 왼쪽 위. 모든 그림은 object-gate 3/4 관문 영수증이 있는 조각만 구웠다(판정 프로필 미보정 — 잠정 통과).")


def arr(a): return json.dumps(a, separators=(',', ':'))
def gid(name): return GROUPS[f'si:{name}']['tileIds'][0]
def passable(t): return t >= 0 and any(DATA['passability'][t].values())
def star(t): return t >= 0 and (TM[t] or {}).get('passage') == 'star'
def home(t): return (TM[t] or {}).get('defaultLayer')


def kit_of(kid):
    """키트 정의 — 한 칸 소품(꽃·방석·밧줄 뭉치)은 그룹이라 1×1 로 감싼다(구성기 skyPaletteFromTileset 과 같다)."""
    if kid in KITS: return KITS[kid]
    t = gid(kid)
    row = dict(tiles=[-1], upperTiles=[t]) if home(t) == 'upper' else dict(tiles=[t], upperTiles=[-1])
    return dict(id=kid, width=1, height=1, rows=[row], parts=[])


def is_outdoor_kit(k): return '실내' not in k['ai']['tags']


def compose(style, W, H, seed):
    out = os.path.join('/tmp', f'si-ref-{style}-{seed}.json')
    subprocess.run([os.path.join(ROOT, 'node_modules/.bin/vite-node'), os.path.join(HERE, 'qa', 'compose-scene.mts'), '--', out, style, str(W), str(H), str(seed)],
                   cwd=ROOT, check=True, capture_output=True)
    return json.load(open(out))


# ── 검증기(구조·통행·층·가장자리 방향만) ──
SKYISH = {t for g in GROUPS.values() if g['role'] == 'terrain' and any(g['id'].startswith(f'si:si-{p}') for p in ('sky', 'face', 'tip', 'billow', 'falls-air', 'falls-mist')) for t in g['tileIds']}
EDGE_OUT = {'n': [(0, -1)], 's': [(0, 1)], 'w': [(-1, 0)], 'e': [(1, 0)], 'nw': [(0, -1), (-1, 0)], 'ne': [(0, -1), (1, 0)], 'sw': [(0, 1), (-1, 0)], 'se': [(0, 1), (1, 0)]}
EDGE_TILES = {gid(f'si-gs-{d}'): d for d in EDGE_OUT}   # 풀↔하늘 바깥 가장자리 8방(안쪽 모서리는 방향이 둘이라 뺀다)


def walk(d, x, y):
    """엔진 규칙(MZ): 위층 칸이 있으면 위층이 정하고(★ 이면 아래층), 없으면 아래층."""
    W, H = d['width'], d['height']
    if not (0 <= x < W and 0 <= y < H): return False
    up, lo = d['upper'][y * W + x], d['lower'][y * W + x]
    if up >= 0 and not star(up): return passable(up)
    return passable(lo)


def reach(d):
    s = d['start']; seen = {(s['x'], s['y'])} if walk(d, s['x'], s['y']) else set(); q = list(seen)
    while q:
        x, y = q.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in seen and walk(d, *n): seen.add(n); q.append(n)
    return seen


def validate(d):
    """(코드, 대상, x, y) 목록. E_BOUNDS · E_OVERLAP · E_KIT_PARTIAL · E_LAYER · E_EDGE_REVERSED · E_DOOR_CELL_OPEN · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE · E_BRIDGE_UNREACHABLE · E_EXIT_UNREACHABLE"""
    W, H = d['width'], d['height']; errs = []
    rects = [(b['name'], b['kit'], b['rect']['x'], b['rect']['y']) for b in d['buildings']] + [(p['kit'], p['kit'], p['x'], p['y']) for p in d['props']]
    for n, kid, x, y in rects:
        k = kit_of(kid)
        if x < 0 or y < 0 or x + k['width'] > W or y + k['height'] > H: errs.append(('E_BOUNDS', n, x, y)); continue
        # 키트 발자국이 시트 정의와 칸마다 같은가(잘린 줄기·빠진 지붕·윗줄만 남은 나무 = 부분 키트)
        for r, row in enumerate(k['rows']):
            for c in range(k['width']):
                lo, up = row['tiles'][c], (row.get('upperTiles') or [-1] * k['width'])[c]
                i = (y + r) * W + x + c
                if (lo >= 0 and d['lower'][i] != lo) or (up >= 0 and d['upper'][i] != up):
                    errs.append(('E_KIT_PARTIAL', n, x + c, y + r)); break
            else: continue
            break
    nb = len(d['buildings'])
    for i in range(nb):
        n1, k1, ax, ay = rects[i]; a = kit_of(k1)
        for n2, k2, bx, by in rects[i + 1:]:
            b = kit_of(k2)
            if ax < bx + b['width'] and bx < ax + a['width'] and ay < by + b['height'] and by < ay + a['height']: errs.append(('E_OVERLAP', f'{n1}/{n2}', bx, by))
    for i, t in enumerate(d['lower']):
        if t >= 0 and home(t) == 'upper': errs.append(('E_LAYER', f'{t}({TM[t]["label"]}) 아래층', i % W, i // W))
        if t in EDGE_TILES:
            x, y = i % W, i // W
            for dx, dy in EDGE_OUT[EDGE_TILES[t]]:
                X, Y = x + dx, y + dy
                if 0 <= X < W and 0 <= Y < H and d['lower'][Y * W + X] not in SKYISH:
                    errs.append(('E_EDGE_REVERSED', f'gs-{EDGE_TILES[t]}', x, y)); break
    for i, t in enumerate(d['upper']):
        if t >= 0 and home(t) == 'lower': errs.append(('E_LAYER', f'{t}({TM[t]["label"]}) 위층', i % W, i // W))
    seen = reach(d)
    for b in d['buildings']:
        for c in b['doors']:
            if walk(d, c['x'], c['y']): errs.append(('E_DOOR_CELL_OPEN', b['name'], c['x'], c['y']))
        for c in b['access']:
            if not walk(d, c['x'], c['y']): errs.append(('E_DOOR_ACCESS_BLOCKED', b['name'], c['x'], c['y']))
            elif (c['x'], c['y']) not in seen: errs.append(('E_DOOR_UNREACHABLE', b['name'], c['x'], c['y']))
    for br in d['bridges']:
        for end in (br['from'], br['to']):
            if (end['x'], end['y']) not in seen: errs.append(('E_BRIDGE_UNREACHABLE', br['kind'], end['x'], end['y']))
    for e in d.get('exits', []):
        # 실내 출구 깔개는 맵 맨 아래 벽 줄 — 그 바로 위 칸(시작 칸)에 닿아야 한다.
        if (e['x'], e['y'] - 1) not in seen: errs.append(('E_EXIT_UNREACHABLE', '출구', e['x'], e['y']))
    return errs


def stamp(d, kid, x, y):
    k = kit_of(kid); W = d['width']
    for r, row in enumerate(k['rows']):
        for c in range(k['width']):
            X, Y = x + c, y + r
            if not (0 <= X < W and 0 <= Y < d['height']): continue
            if row['tiles'][c] >= 0: d['lower'][Y * W + X] = row['tiles'][c]
            up = (row.get('upperTiles') or [-1] * k['width'])[c]
            if up >= 0: d['upper'][Y * W + X] = up
    return k


def clone(d): return json.loads(json.dumps(d))


def tampers_outdoor(d):
    out = []; W = d['width']
    b0 = d['buildings'][0]
    t = clone(d); a = b0['access'][0]; stamp(t, 'si-barrel', a['x'], a['y'])
    out.append(('door-blocked', f"{b0['name']} 문 앞 접근칸 ({a['x']},{a['y']})에 나무통", t, [(a['x'], a['y'], 1, 1)]))
    br = next(b for b in d['bridges'] if b['kind'] == 'rope'); mx = (br['from']['x'] + br['to']['x']) // 2; my = (br['from']['y'] + br['to']['y']) // 2
    t = clone(d); t['upper'][my * W + mx] = -1
    out.append(('bridge-cut', f"밧줄 다리 가운데 ({mx},{my}) 위층 다리 칸을 지움(아래층은 하늘 — 막힘)", t, [(mx, my, 1, 1)]))
    # 반대 외곽: 섬 북쪽 가장자리 한 칸을 남쪽 가장자리로
    gn, gsS = gid('si-gs-n'), gid('si-gs-s'); i = next(i for i, v in enumerate(d['lower']) if v == gn and i % W > 8)
    t = clone(d); t['lower'][i] = gsS
    out.append(('edge-reversed', f"북쪽 가장자리 ({i % W},{i // W}) 를 남쪽 가장자리(처마) 칸으로 — 바깥 방향이 반대", t, [(i % W, i // W, 1, 1)]))
    # 잘못된 층: 나무 키트를 전부 아래층에 찍음(풀이 지워지고 나무가 사람 밑에 깔린다)
    tr = next((p for p in d['props'] if p['kit'] in ('si-tree-round', 'si-tree-pine', 'si-tree-blossom')), None)
    t = clone(d); k = kit_of('si-tree-round')
    x0, y0 = (tr['x'], tr['y']) if tr else (d['start']['x'] + 2, d['start']['y'] - 4)
    for r, row in enumerate(k['rows']):
        for c in range(k['width']):
            v = row['upperTiles'][c] if row['upperTiles'][c] >= 0 else row['tiles'][c]
            if v >= 0: t['lower'][(y0 + r) * W + x0 + c] = v; t['upper'][(y0 + r) * W + x0 + c] = -1
    if not tr: t['props'].append(dict(kit='si-tree-round', x=x0, y=y0))
    out.append(('wrong-layer', f"둥근 나무를 ({x0},{y0}) 에 위층 대신 아래층으로 찍음", t, [(x0, y0, k['width'], k['height'])]))
    # 잘린 줄기: 나무 밑동 줄(맨 아래 줄)을 지움
    tr = tr or next(p for p in d['props'] if p['kit'].startswith('si-tree'))
    k = kit_of(tr['kit']); t = clone(d); yb = tr['y'] + k['height'] - 1
    for c in range(k['width']):
        t['upper'][yb * W + tr['x'] + c] = -1; t['lower'][yb * W + tr['x'] + c] = gid('si-grass')
    out.append(('trunk-cut', f"{tr['kit']} ({tr['x']},{tr['y']}) 밑동 줄({yb})을 지워 수관만 뜸", t, [(tr['x'], yb, k['width'], 1)]))
    t = clone(d); bb = t['buildings'][0]; bb['rect']['x'] = d['width'] - bb['rect']['w'] // 2
    out.append(('bounds', f"{bb['name']}을 오른쪽 끝({bb['rect']['x']},{bb['rect']['y']})으로 밀어 맵 밖", t, [(bb['rect']['x'], bb['rect']['y'], d['width'] - bb['rect']['x'], bb['rect']['h'])]))
    t = clone(d); b1, b2 = t['buildings'][0], t['buildings'][1]; b2['rect']['x'] = b1['rect']['x'] + 2; b2['rect']['y'] = b1['rect']['y']
    out.append(('overlap', f"{b2['name']}을 {b1['name']} 위({b2['rect']['x']},{b2['rect']['y']})로 옮김", t, [(b2['rect']['x'], b2['rect']['y'], b2['rect']['w'], b2['rect']['h'])]))
    return out


def tampers_room(d):
    out = []; s = d['start']
    t = clone(d); stamp(t, 'si-chest', s['x'], s['y']); t['props'].append(dict(kit='si-chest', x=s['x'], y=s['y']))
    out.append(('exit-blocked', f"출구 깔개 바로 위 시작 칸 ({s['x']},{s['y']})에 상자", t, [(s['x'], s['y'], 1, 1)]))
    bed = next((p for p in d['props'] if p['kit'] in ('si-bed', 'si-hearth', 'si-wardrobe', 'si-bookshelf')), d['props'][0])
    k = kit_of(bed['kit']); t = clone(d); W = d['width']; yb = bed['y'] + k['height'] - 1
    for c in range(k['width']): t['upper'][yb * W + bed['x'] + c] = -1
    out.append(('kit-partial', f"{bed['kit']} ({bed['x']},{bed['y']}) 아랫줄을 지워 반쪽만 남김", t, [(bed['x'], yb, k['width'], 1)]))
    return out


def label_sheet(kits, name, S=2, Wd=1400, bg=(58, 56, 66, 255)):
    items = [(k, BL.reassemble(k, SHEET, TPR)) for k in kits]
    x = y = 8; rowh = 0; place = []
    for k, im in sorted(items, key=lambda t: -t[1].height):
        w, h = max(im.width * S, 60), im.height * S + 14
        if x + w + 8 > Wd: x, y, rowh = 8, y + rowh + 8, 0
        place.append((x, y, k, im)); x += w + 8; rowh = max(rowh, h)
    sheet = Image.new('RGBA', (Wd, y + rowh + 8), bg); dr = ImageDraw.Draw(sheet)
    for x0, y0, k, im in place:
        dr.text((x0, y0), k['id'].replace('si-', ''), fill=(255, 255, 255, 255), font=FONT)
        sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x0, y0 + 14))
    sheet.save(os.path.join(IMG, name), optimize=True)
    return len(kits)


def terrain_sheet():
    gs = [g for g in DATA['tileGroups'] if g['role'] == 'terrain' and len(g['tileIds']) == 1]
    cols = 12; cw, ch = 116, 52; S = 2
    im = Image.new('RGBA', (cols * cw + 8, math.ceil(len(gs) / cols) * ch + 8), (58, 56, 66, 255)); dr = ImageDraw.Draw(im)
    for i, g in enumerate(gs):
        t = g['tileIds'][0]; x0, y0 = 4 + (i % cols) * cw, 4 + (i // cols) * ch
        cell = SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16)).resize((32, 32), Image.NEAREST)
        im.paste((126, 176, 232, 255), (x0, y0, x0 + 32, y0 + 32)); im.alpha_composite(cell, (x0, y0))
        dr.text((x0 + 36, y0), f'#{t}', fill=(255, 230, 140, 255), font=FONT)
        dr.text((x0 + 36, y0 + 14), g['id'][6:][:12], fill=(255, 255, 255, 255), font=FONT)
        dr.text((x0 + 36, y0 + 28), '걷는다' if passable(t) else '막힘', fill=(160, 230, 160, 255) if passable(t) else (240, 150, 150, 255), font=FONT)
    im.save(os.path.join(IMG, 'terrain.png'), optimize=True)
    return len(gs)


def kit_md(k):
    t = [r['tiles'] for r in k['rows']]; u = [r.get('upperTiles') or [-1] * k['width'] for r in k['rows']]
    ent = next((p for p in k.get('parts', []) if p['kind'] == 'entrance'), None)
    extra = f" · 문 칸 x={ent['dx']}..{ent['dx'] + ent['w'] - 1}, y={ent['dy']}(막힘) · 접근칸 y={k['height']} 줄(걸을 수 있어야 함)" if ent else ''
    return f"### `{k['id']}` {k['name']} — {k['width']}×{k['height']}{extra}\n- {k['ai']['description'][:180]}\n- 아래층 `tiles` = `{arr(t)}`\n- 위층 `upperTiles` = `{arr(u)}`\n"


def layer_audit():
    """계약 8항: tileMeta 홈 레이어 ↔ 엔진 우선순위 ↔ 통행 대조."""
    rows = collections.Counter()
    decals = []
    for i, m in enumerate(TM):
        if not m or not m.get('defaultLayer'): continue
        key = (m['defaultLayer'], DATA['priority'][i], m.get('passage'))
        rows[key] += 1
        if m['defaultLayer'] == 'upper' and DATA['priority'][i] == 'lower': decals.append(f"{i}({m['label']})")
    return rows, decals


def dictionary_md():
    L = [f"# sky_island · 사전 (바닥 낱칸 + 키트 전체 배열)\n\n{HEAD}\n", "그림 `terrain.png`(바닥 낱칸 도감, 번호·통행) · `outdoor-kits.png` · `interior-kits.png`(키트 도감, 원본 ×2).\n"]
    L.append("## 바닥·가장자리·다리(낱칸, 그룹 id `si:<조각>`)\n\n번호는 이 시트의 칸 번호. 가장자리 방향 이름은 «하늘(또는 구름)이 있는 바깥 변»이다 — `gs-n` 은 북쪽이 하늘인 풀 칸. `gs-in*` 은 안쪽 모서리(대각선 한 칸만 하늘). "
             "섬 밑면(`face-*`·`tip-*`)은 남쪽 가장자리 줄 바로 아래부터 2~4줄 아래로 매단다. 다리·잔교 상판은 **위층**(아래층은 하늘 그대로)이고 걷는다.\n")
    L.append('| 조각 id | 이름 | 칸 번호 | 통행 | 홈 층 |\n|---|---|---|---|---|')
    for g in DATA['tileGroups']:
        if g['role'] == 'terrain' and len(g['tileIds']) == 1:
            t = g['tileIds'][0]
            L.append(f"| `{g['id'][3:]}` | {g['name']} | {t} | {'걷는다' if passable(t) else '막힘'}{' ★' if star(t) else ''} | {home(t) or '-'} |")
    anim = DATA['animationStrips']
    L.append(f"\n움직이는 칸 묶음 {len(anim)}개(물·폭포·수정·풍차 등) — 첫 칸 번호만 칠하면 엔진이 이어지는 칸으로 돌린다: " + ', '.join(f"{a['baseTile']}(×{a['frames']})" for a in anim) + "\n")
    L.append("## 야외 키트 — `list_tileset_objects({tilesetId:\"sky_island\"})` / `stamp_tileset_object` 로 찍는다\n")
    L.append("각 키트: 크기 `W×H` 칸, 아래층 `tiles`(-1 = 비움)·위층 `upperTiles` 전체 배열(행 우선). **건물**은 문 칸(entrance, 막힘 — 이동 이벤트는 문 앞 접근칸에)과 접근칸(문 바로 아래 줄, 걸을 수 있어야 함)을 가진다. "
             "울타리 `si-fence-h`(가로)·`si-fence-v`(세로)·`si-fence-w`/`si-fence-e`(가로 줄의 서·동 끝 기둥)는 1×1 을 이어 찍는다. 나머지는 고정 조각.\n")
    for k in DATA['structureKits']:
        if is_outdoor_kit(k): L.append(kit_md(k))
    L.append("## 실내 키트\n")
    for k in DATA['structureKits']:
        if not is_outdoor_kit(k): L.append(kit_md(k))
    rows, decals = layer_audit()
    L.append("## 층 대조(계약 8항 — 홈 레이어 · 렌더 우선순위 · 통행은 별개)\n\n| 홈 층 | 우선순위 | 통행 | 칸 수 |\n|---|---|---|---|")
    for (h, p, s), n in sorted(rows.items()): L.append(f"| {h} | {p} | {s} | {n} |")
    L.append(f"\n홈 층 upper·우선순위 lower 인 {len(decals)}칸은 **걷는 깔개**다(다리·잔교 상판·꽃밭·키 큰 풀·밧줄 뭉치·깔개·방석): 위층에 놓아 아래 바닥을 지우지 않고, 사람 **밑에** 그려지며, 걷는다. "
             "구운 직후 정의를 엔진 판정(MZ: 위층 칸이 있으면 위층이 통행을 정하고 ★ 이면 아래층)과 대조했고 고칠 설명은 없었다(before = after). " + ', '.join(decals[:30]))
    return '\n'.join(L)


def howto_md():
    return f"""# sky_island · 하늘섬 야외 배치 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 가장 빠른 길 — 구성 도구 (먼저 이것)
- `compose_sky_island_map({{mapId, style, seed?, replace?}})` 가 아래 순서·규칙대로 한 장을 **씨앗마다 다르게** 짠다. style: `village` 마을 · `shrine` 구름 위 신전 섬 · `dock` 비공정 부두 · `archipelago` 섬 사슬 · `room-cottage`/`room-shrine`/`room-cabin`/`room-observatory` 실내.
  - 빈 맵이면 크기를 맞춘다(마을 50×34 · 신전 46×40 · 부두 52×30 · 섬 사슬 54×42). 손댄 맵은 `replace:true` 가 있어야 덮는다.
  - 시작 칸에서 모든 건물 문 접근칸·다리 양 끝·실내 출구에 닿는지 **엔진 통행**(isPassable + 4방 BFS)으로 다시 확인하고, 안 되면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).
  - 결과 `data.buildings[].doors/access` 는 실내 이음, `data.zones`(큰길·광장·밭·나무숲·들꽃 풀밭·쉼터·짐 마당·비공정 정박…)는 이벤트 자리 고르기에 쓴다.
- 건물 문 ↔ 실내: 실내를 새 맵에 `compose_sky_island_map({{style:"room-…"}})` 로 짓고 `link_sky_island_interior({{mapId, door:{{x,y}}, interiorMapId}})` 로 잇는다(실내 출구는 `si-exit-mat` 칸).

## 구성기의 순서 (직접 깔 때도 같은 순서)
1. **하늘**: 전체 아래층 `si-sky`(막힘). 반짝임 `si-sky-glint` 은 값 잡음으로 드물게.
2. **섬 땅**: 직사각형 몇 개를 겹친 덩이에 `si-grass`. 바깥 테두리 한 줄은 `si-gs-*`(바깥 변 = 하늘 쪽), 안쪽 모서리는 `si-gs-in*`. 섬 최소 12×10(작은 섬 8×7).
3. **밑면**: 남쪽 가장자리 줄 바로 아래 줄 = `face-top*`(서쪽 끝 `face-top-l`, 동쪽 끝 `face-top-r`), 그 아래 `face-mid*` 1~3줄, 끝 줄 `tip-*`. 가운데가 가장 깊다(끝이 뾰족한 밑면). 밑면 칸은 막힘이다 — 물건을 놓지 않는다.
4. **길**: `si-path-1/2/3`(디딤돌, 1칸 폭) 큰길 한 줄 + 문 접근칸에서 큰길까지 곧은 세로 길. 광장 `si-plaza`(가장자리 `si-plaza-*`), 밭 `si-field`(가장자리 `si-field-*`).
5. **건물**: 큰길 북쪽에 남향으로 줄 세우고 밑변을 엇갈리게(1칸) 둔다. 건물 사이 2칸 이상, 둘레 1칸·문 앞 2칸은 비운다. 풍차는 밭 끝, 등대는 부두 끝, 천문대는 섬 사슬의 가장 먼 섬.
6. **다리**: 섬 사이 하늘을 건넌다. 가로 = `si-bridge-h-w` + `si-bridge-h`… + `si-bridge-h-e`(위층), 세로 = `si-bridge-v-n` + `si-bridge-v`… + `si-bridge-v-s`, 돌다리 = 상판 `si-sbridge-w/…/-e`(위층) + 바로 아래 줄 아치 `si-sbridge-arch-w/…/-e`. 다리 양 끝은 두 섬의 길 칸에 닿아야 한다.
7. **물**: 연못 `si-pond`(3×2) → 가장 가까운 섬 끝까지 `si-stream` ≤3줄 → 가장자리 `si-stream-lip` → 밑면 앞 `si-falls-face` → 하늘 `si-falls-air` → 끝 `si-falls-mist`. 굽은 시내 칸은 없다(곧게만).
8. **소품**: 발자국 + 여백 1칸을 예약하고 겹치지 않는다. 길·다리 칸에는 두지 않는다. 광장 = 우물 가운데 + 노점·통·상자·벤치·가로등. 밭 = 울타리로 두르고 문 한 칸을 비운 뒤 작물 줄(밀·양배추·새싹).
9. **나무·덩이**: 마지막. 남은 빈 풀 6×5 / 4×4 덩이에 나무숲·들꽃 풀밭·수정 바위·쉼터를 하나씩. 길 경계·섬 가장자리 줄에 걸치지 않는다.
10. **하늘 장식**: 구름 `si-cloud-puff-s/m/l` 은 섬과 밑면에서 2칸 이상 떨어진 하늘에만, 늘어진 뿌리 `si-roots-hang` 은 밑면 줄에만.

## 부두(비공정)
- 잔교: 섬 가장자리 줄에서 하늘로 `si-pier-w/c/e`(위층·걷는다) 줄을 내고 끝 줄은 `si-pier-sw/s/se`, 바로 아래 줄 `si-pier-struts-*`(막힘). 비공정 `si-airship`(8×6, 막힘)은 잔교 옆 하늘에, 갑판 줄과 잔교 사이를 `si-bridge-h` 건널판 한 칸으로 잇는다(그 칸 = 이벤트 «탑승» 자리, zones `airship`).
- 잔교 둘레에 `si-bollard`·`si-ropecoil`·`si-windsock`, 짐 마당 광장에 `si-crates`·`si-barrel`·`si-cart`.

## 금지 조건(검증기 오류 코드)
- E_BOUNDS 키트가 맵 밖 · E_OVERLAP 건물 겹침 · E_KIT_PARTIAL 키트 일부만 찍힘(잘린 밑동·빠진 지붕) · E_LAYER 위층 홈 칸을 아래층에(또는 반대) · E_EDGE_REVERSED 가장자리 칸의 바깥 변이 하늘이 아님
- E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE / E_BRIDGE_UNREACHABLE / E_EXIT_UNREACHABLE 시작 칸에서 안 닿음

## 문 그림 · 접근칸 · 출입구 · 이벤트는 따로다
- **문 그림** = 건물 키트 맨 아래 줄 문(막힘). **접근칸** = 문 바로 아래 줄(걷는 길). **출입구** = 키트 `parts` 의 entrance. **이동 이벤트** = 접근칸에(link_sky_island_interior 가 만든다).

## 반복 가능 / 고정
- 반복: 바닥·가장자리·밑면·길·광장·밭·다리 상판·잔교 상판·울타리 1×1. 고정: 건물·비공정·나무·바위·우물·연못·노점·석상·비석·구름·깃발.

## 없는 소재
- 도리이·문루·성문, 굽은 시내·강, 동굴, 성벽, 사람·글자·간판: 이 칩셋에 없다. 사람은 Actor1 캐릭터 이벤트로 놓는다. 없는 키트 id 를 지어 부르지 않는다.
- 쇠사슬 매달림 `si-chain-hang` 은 키트로 있지만 밑면과 맞지 않아 구성기가 쓰지 않는다.

## 층 정정(투명 · 홈 레이어 · 통행 · 우선순위는 따로)
- 바닥·가장자리·밑면·하늘은 불투명 아래층. 건물·소품·나무는 위층·막힘. 나무 윗줄(수관)은 위층 ★(사람 머리 위에 그려지고 아래층이 통행을 정한다), 밑동 줄은 막힘. 다리·잔교·꽃밭·깔개는 위층 + 우선순위 lower(걷는 깔개).
- 확인 범위: 구조·좌표·층 홈·가장자리 방향·통행(4방 BFS)뿐이다. 이벤트 실행·미감·모델 성공률은 구조 검사로 주장하지 않는다.

## 완성 예제 · 변조 오류
{' · '.join(f'`si-ex-{k}`({t})' for k, _, _, _, _, t in OUTDOOR)} · `si-errors`(정상/오류 나란히). 실내는 용도 `si-interior`.
"""


def room_howto_md():
    return f"""# sky_island · 실내 4종 — 순서와 규칙 (먼저 읽는다)

{HEAD}

## 도구
- 새 맵에 `compose_sky_island_map({{style:"room-cottage"|"room-shrine"|"room-cabin"|"room-observatory", seed}})` — 빈 맵이면 크기를 맞춘다(오두막 11×11 · 신전 13×14 · 선실 11×10 · 천문대 13×12). 그다음 `link_sky_island_interior` 로 바깥 문과 잇는다(출구 = `si-exit-mat` 칸, 없으면 맨 아래 줄 가운데).

## 방의 순서
1. 전체 `si-void`(천장 어둠, 막힘). 바닥 사각 w×h(오두막 9×7 · 신전 11×10 · 선실 9×6 · 천문대 11×8)를 맵 가운데에.
2. 바닥 재질: 오두막 `si-floor-wood` · 신전 `si-floor-stone`(가운데 `si-floor-mosaic` 띠) · 선실 `si-floor-deck` · 천문대 `si-floor-wood`.
3. 북벽 2줄: 윗줄 `si-wall-*`, 아랫줄 `si-wall-*-low`(오두막 회벽 · 신전 돌벽 · 선실 널벽 · 천문대 별 벽). 창은 윗줄에 `-win`/`-port`/`-arch`/`-sky` 를 2칸 이상 띄워.
4. 바닥 좌우 열 바깥 = `si-void-e`/`si-void-w`(천장 테), 바닥 아래 줄 = `si-void-s`(남벽 윗면, 모서리 `-sw`/`-se`). 남벽 가운데 한 칸 = `si-exit-mat`(출구, 걷는다). 그 바로 위 바닥 칸이 시작 칸.
5. 가구: 벽에 붙는 것(난로·찬장·책장·옷장·망원경·조타륜·제단)을 북벽 아랫줄 바로 아래 줄에 먼저, 그다음 방 가운데 깔개 → 탁자·의자(깔개와 겹치지 않게) → 침대는 옆벽, 상자·화분은 구석.
6. 출구 깔개에서 위로 2줄·좌우 1칸은 비운다(문 앞 통로). 모든 가구 앞 한 칸은 걸을 수 있어야 한다.

## 방마다 들어가는 것(구성기 실제 출력)
- 오두막: 난로 · 깔개 · 침대 · 찬장 · 옷장 · 탁자+의자 · 대야 · 상자 · 화분
- 신전: 제단 · 공물 · 향로 · 석등 · 긴 깔개(신전 길) · 방석 · 벽 깃발 · 책장 · 상자
- 선실: 둥근 창 셋 · 조타륜(앞벽) · 해도 탁자 · 침대 둘 · 등 · 상자 · 통·상자 무더기 · 걸상
- 천문대: 망원경(앞벽 가운데) · 책장 · 지구본 · 천체 모형 · 사다리 · 책상+의자 · 깔개 · 등 · 상자 · 화분

## 금지 조건
- E_EXIT_UNREACHABLE 출구 위 시작 칸이 막혀 출구에 못 닿음 · E_KIT_PARTIAL 가구 일부만 찍힘 · E_BOUNDS · E_LAYER (야외와 같은 검증기)
- 벽 2줄·천장 테 위에 가구를 놓지 않는다(벽 깃발 `si-banner-wall` 만 벽 아랫줄에 위층으로).

## 완성 예제 · 변조 오류
{' · '.join(f'`si-room-{k}`({t})' for k, _, _, _, _, t in ROOMS)} · `si-room-errors`.
"""


def example_md(title, d, img, tool_style):
    doors = '\n'.join(f"- {b['name']}(`{b['kit']}`, {b['rect']['x']},{b['rect']['y']} {b['rect']['w']}×{b['rect']['h']}): 문 칸 {[(c['x'], c['y']) for c in b['doors']]} · 접근칸 {[(c['x'], c['y']) for c in b['access']]}" for b in d['buildings']) or '- (없음)'
    bridges = '\n'.join(f"- {b['kind']}: ({b['from']['x']},{b['from']['y']}) → ({b['to']['x']},{b['to']['y']})" for b in d['bridges']) or '- (없음)'
    zones = '\n'.join(f"- {z['name']}(`{z['use']}`): {z['rect']['x']},{z['rect']['y']} {z['rect']['w']}×{z['rect']['h']}" for z in d['zones'])
    props = collections.Counter(p['kit'] for p in d['props'])
    return f"""# sky_island 완성 예제 · {title}

{HEAD}

입력 → 정답 배열 → 원본 해상도 완성 그림. 배열은 구성기(`src/project/skyIslandComposer.ts`, compose_sky_island_map 과 같은 함수)의 **실제 출력**이고 그림 `{img}` 는 같은 시트의 칸을 그대로 이어 붙인 것이다(엔진 렌더가 아님, 하늘색 배경). 검증기 결과: {len(validate(d))}건 오류.

## 입력
`compose_sky_island_map({{style:"{tool_style}", seed:{d['seed']}}})` 를 {d['width']}×{d['height']} 맵에. 시작 칸 ({d['start']['x']},{d['start']['y']}){' · 출구 ' + str([(c['x'], c['y']) for c in d['exits']]) if d['exits'] else ''}.

## 건물·문·접근칸
{doors}

## 다리·잔교
{bridges}

## 쓰임 구역
{zones}

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


def errors_md(rows, img, base_title, kind='야외'):
    L = [f"# sky_island · {kind} 정상/오류 나란히 (변조 검출)\n", HEAD, f"\n{base_title} 예제를 실제로 변조해 검증기(`bake_refs_si.validate`)가 코드와 맵 좌표로 잡는지 확인한 결과다. 그림 `{img}` 의 빨간 테두리 = 변조 자리(왼쪽 위 = 정상).\n",
         '| 변조 | 검출 코드 | 첫 오류(코드, 대상, x, y) |\n|---|---|---|']
    for _, desc, errs in rows: L.append(f"| {desc} | {', '.join(sorted({e[0] for e in errs})) or '못 잡음'} | {errs[0] if errs else '-'} |")
    L.append("\n오류 코드: E_BOUNDS 맵 밖 · E_OVERLAP 건물 겹침 · E_KIT_PARTIAL 키트 일부만 · E_LAYER 층 홈 위반 · E_EDGE_REVERSED 가장자리 바깥 변이 하늘 아님 · E_DOOR_CELL_OPEN 문 칸이 걸을 수 있음 · E_DOOR_ACCESS_BLOCKED 접근칸 막힘 · E_DOOR_UNREACHABLE / E_BRIDGE_UNREACHABLE / E_EXIT_UNREACHABLE 시작 칸에서 안 닿음.")
    L.append("\n확인 범위: 구조·좌표·층 홈·가장자리 방향·통행(4방 BFS). 이벤트 실행·미감은 보지 않는다. 구성 도구는 엔진 통행 검사가 실패하면 맵을 바꾸지 않는다(부분 배치가 남지 않는다).")
    return '\n'.join(L)


def compare(base, tampered, name, cols=4, s=0.5):
    pics = [RS.render(base)]
    for _, _, t, boxes in tampered:
        im = RS.render(t); dr = ImageDraw.Draw(im)
        for x, y, w, h in boxes: dr.rectangle([x * 16 - 2, y * 16 - 2, (x + w) * 16 + 1, (y + h) * 16 + 1], outline=(255, 30, 30, 255), width=3)
        pics.append(im)
    tw, th = int(pics[0].width * s), int(pics[0].height * s)
    rows = math.ceil(len(pics) / cols)
    cmp_ = Image.new('RGBA', (tw * cols + 8 * (cols - 1), th * rows + 8 * (rows - 1)), (20, 20, 28, 255))
    for i, im in enumerate(pics): cmp_.paste(im.resize((tw, th), Image.NEAREST), ((i % cols) * (tw + 8), (i // cols) * (th + 8)))
    cmp_.save(os.path.join(IMG, name), optimize=True)


def main():
    nk_out = label_sheet([k for k in DATA['structureKits'] if is_outdoor_kit(k) and k['id'] != 'si-airship'] + [KITS['si-airship']], 'outdoor-kits.png', bg=(126, 176, 232, 255))
    nk_in = label_sheet([k for k in DATA['structureKits'] if not is_outdoor_kit(k)], 'interior-kits.png', S=3, Wd=1100)
    nt = terrain_sheet()
    exs = {}
    for key, style, W, H, seed, title in OUTDOOR:
        d = compose(style, W, H, seed); exs[key] = d
        RS.render(d).save(os.path.join(IMG, f'outdoor-{key}.png'), optimize=True)
        assert not validate(d), (key, validate(d)[:5])
    rooms = {}
    for key, style, W, H, seed, title in ROOMS:
        d = compose(style, W, H, seed); rooms[key] = d
        RS.render(d).save(os.path.join(IMG, f'room-{key}.png'), optimize=True)
        assert not validate(d), (key, validate(d)[:5])
    base = exs['village']; t_out = tampers_outdoor(base)
    rows = [(k, desc, validate(t)) for k, desc, t, _ in t_out]
    compare(base, t_out, 'outdoor-err-compare.png')
    rbase = rooms['cottage']; t_in = tampers_room(rbase)
    rrows = [(k, desc, validate(t)) for k, desc, t, _ in t_in]
    compare(rbase, t_in, 'room-err-compare.png', cols=3, s=2)
    assert all(e for _, _, e in rows + rrows), [k for k, _, e in rows + rrows if not e]

    imgs = [dict(id='si-img-terrain', name='terrain.png', caption=f'바닥·가장자리·밑면·다리·실내 바닥/벽 낱칸 {nt}종 — 칸 번호·조각 id·통행(원본 ×2, 하늘색 배경).', dataUrl=URL('terrain.png')),
            dict(id='si-img-kits', name='outdoor-kits.png', caption=f'야외 키트 도감 {nk_out}종(원본 ×2). 전부 object-gate 영수증이 있는 그림.', dataUrl=URL('outdoor-kits.png'))]
    for key, _, W, H, _, title in OUTDOOR:
        imgs.append(dict(id=f'si-img-{key}', name=f'outdoor-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}(시트 칸 이어 붙임).', dataUrl=URL(f'outdoor-{key}.png')))
    imgs.append(dict(id='si-img-err-compare', name='outdoor-err-compare.png', caption='마을 예제 정상(왼쪽 위)과 변조 7종(문 앞 막힘·다리 끊김·반대 외곽·잘못된 층·잘린 밑동·맵 밖·겹침, 빨간 테두리 = 변조 자리). 0.5배.', dataUrl=URL('outdoor-err-compare.png')))
    rimgs = [dict(id='si-img-room-kits', name='interior-kits.png', caption=f'실내 키트 도감 {nk_in}종(원본 ×3).', dataUrl=URL('interior-kits.png'))]
    for key, _, W, H, _, title in ROOMS:
        rimgs.append(dict(id=f'si-img-room-{key}', name=f'room-{key}.png', caption=f'{title} — 구성기 실제 출력, 원본 해상도 {W * 16}×{H * 16}.', dataUrl=URL(f'room-{key}.png')))
    rimgs.append(dict(id='si-img-room-err-compare', name='room-err-compare.png', caption='오두막 정상(왼쪽)과 변조 2종(출구 막힘·가구 반쪽, 빨간 테두리). 2배.', dataUrl=URL('room-err-compare.png')))

    docs = [dict(id='si-howto', name='sky_island 야외 · 배치 순서·규칙·도구(먼저 읽는다)', markdown=howto_md()),
            dict(id='si-dictionary', name='sky_island · 사전(바닥 낱칸·키트 전체 배열·층 대조)', markdown=dictionary_md())]
    for key, style, _, _, _, title in OUTDOOR:
        docs.append(dict(id=f'si-ex-{key}', name=f'sky_island 야외 예제 · {title}', markdown=example_md(title, exs[key], f'outdoor-{key}.png', style)))
    docs.append(dict(id='si-errors', name='sky_island 야외 · 정상/오류 변조 검출', markdown=errors_md(rows, 'outdoor-err-compare.png', '마을')))
    rdocs = [dict(id='si-room-howto', name='sky_island 실내 · 방 순서·규칙(먼저 읽는다)', markdown=room_howto_md())]
    for key, style, _, _, _, title in ROOMS:
        rdocs.append(dict(id=f'si-room-{key}', name=f'sky_island 실내 예제 · {title}', markdown=example_md(title, rooms[key], f'room-{key}.png', style)))
    rdocs.append(dict(id='si-room-errors', name='sky_island 실내 · 정상/오류 변조 검출', markdown=errors_md(rrows, 'room-err-compare.png', '오두막', '실내')))
    cats = [dict(id='si-outdoor', name='sky_island · 하늘섬 야외 (사전 · 순서 · 예제 4 · 변조 오류)',
                 description='떠 있는 섬·밑면·밧줄/돌 다리·잔교·비공정 부두·신전 섬·섬 사슬을 짓는 법. 구성 도구 compose_sky_island_map, 낱칸 사전·키트 전체 배열·층 대조·완성 예제 4장(구성기 실제 출력 배열)·변조 오류 7종.', documents=docs, images=imgs),
            dict(id='si-interior', name='sky_island · 실내 4종 (오두막 · 신전 · 비공정 선실 · 천문대)',
                 description='하늘섬 건물 실내 방 넷을 짓는 법. 벽 2줄·천장 테·출구 깔개·가구 순서, 완성 예제 4장(구성기 실제 출력 배열)·변조 오류 2종. 키트 배열은 si-outdoor 의 사전에 있다.', documents=rdocs, images=rimgs)]
    json.dump(cats, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for k, _, errs in rows + rrows: print('변조', k, sorted({e[0] for e in errs}))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes', 'docs', len(docs) + len(rdocs), 'images', len(imgs) + len(rimgs))


if __name__ == '__main__':
    main()
