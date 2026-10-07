"""wizarding_world 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트·예제)에서 기계적으로 만든다.

  python3 scripts/content/wizarding/bake_refs_wz.py        (bake_wz.py 다음에)

산출: src/assets/wizardingWorldReferences.json (그림은 경로만) · public/assets/wizarding-world-references/*.png (원본 해상도 또는 nearest 정수배)
용도: wz-start(입구·시트 지도·층·실행 순서·그룹 사전) · wz-space-<공간>(키트 사전·완성 예제·정상/오류) · wz-characters · wz-effects · wz-check
"""
import collections, json, math, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import wzlib  # noqa: E402
import bake_lib as BL  # noqa: E402

ROOT = wzlib.ROOT
DATA = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/wizarding-world/wizarding-world-chipset.png')).convert('RGBA')
CHARS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingCharsets.json'), encoding='utf-8'))
EXDIR = os.path.join(wzlib.TD, 'examples')
IMGDIR = os.path.join(ROOT, 'public/assets/wizarding-world-references')
OUT = os.path.join(ROOT, 'src/assets/wizardingWorldReferences.json')
TPR, N = DATA['tilesPerRow'], DATA['count']
KITS = {k['id']: k for k in DATA['structureKits']}
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
HEAD = (f"tilesetId `wizarding_world` · 그림 `public/assets/wizarding-world/wizarding-world-chipset.png`(텍스처 `tex_wizarding_world`, **{N}칸**, 16px 칸, "
        f"시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, 한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). "
        "계열 `oprn-wizard` — 다른 칩셋(버들항·일본 도시·조선·EasyRPG·실내 v5)의 칸 번호와 섞지 않는다. 팔레트는 HP 테마 42색뿐이다.")
os.makedirs(IMGDIR, exist_ok=True)


def home(t):
    return BL.tile_home(DATA['priority'][t], DATA['tileMeta'][t])


def passable(t):
    return DATA['passability'][t]['up']


def save(name, im, scale=1):
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(os.path.join(IMGDIR, name), optimize=True)
    return f'/assets/wizarding-world-references/{name}'


def kit_image(k):
    return BL.reassemble(k, SHEET, TPR)


def render(lower, upper, W, H, marks=()):
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for i in range(W * H):
        for t in (lower[i], upper[i]):
            if t >= 0: im.alpha_composite(BL.read_cell(SHEET, t, TPR), ((i % W) * 16, (i // W) * 16))
    d = ImageDraw.Draw(im)
    for x, y in marks: d.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], outline=(255, 40, 40, 255), width=2)
    return im


def arr_md(a, W):
    rows = [','.join('%d' % v for v in a[y * W:(y + 1) * W]) for y in range(len(a) // W)]
    return '```json\n[\n' + ',\n'.join('  ' + r for r in rows) + '\n]\n```'


# ───────────────────────── 구조 검사(자동 좌표 검증) ─────────────────────────
def check_map(ex, lower, upper):
    """예제 배치 기준 구조 검사. [(코드, x, y, 설명)]. 미적 품질·이벤트 실행은 보지 않는다."""
    W, H = ex['w'], ex['h']; out = []
    for i in range(W * H):
        x, y = i % W, i // W
        if lower[i] >= 0 and home(lower[i]) == 'upper' and DATA['tileMeta'][lower[i]].get('defaultLayer') == 'upper':
            out.append(('WZ-LAYER', x, y, f'위층 홈 칸 {lower[i]} 이 1층(lowerTiles)에 있다'))
        if upper[i] >= 0 and DATA['priority'][upper[i]] == 'lower' and not DATA['tileMeta'][upper[i]].get('locked'):
            out.append(('WZ-LAYER', x, y, f'아래층 땅 칸 {upper[i]} 이 3층(upperTiles)에 있다'))
    occ = {}
    for n, (pid, x0, y0) in enumerate(ex['place']):
        k = KITS.get(pid)
        if not k: continue
        for y in range(k['height']):
            for x in range(k['width']):
                lo, up = k['rows'][y]['tiles'][x], k['rows'][y]['upperTiles'][x]
                if lo < 0 and up < 0: continue
                X, Y = x0 + x, y0 + y
                if not (0 <= X < W and 0 <= Y < H): out.append(('WZ-CUT', X, Y, f'{pid} 가 맵 밖으로 잘렸다')); continue
                if up >= 0:
                    if (X, Y) in occ and occ[(X, Y)][0] != pid and not passable(up) and not passable(occ[(X, Y)][1]):
                        out.append(('WZ-OVERLAP', X, Y, f'{pid} 가 {occ[(X, Y)][0]} 의 막힌 칸을 덮었다'))
                    occ[(X, Y)] = (pid, up)
        if 'door' in pid and pid.endswith('open'):
            ax, ay = x0 + k['width'] // 2, y0 + k['height']
            if 0 <= ax < W and 0 <= ay < H:
                i = ay * W + ax
                if (lower[i] >= 0 and not passable(lower[i])) or (upper[i] >= 0 and not passable(upper[i])):
                    out.append(('WZ-DOOR-BLOCKED', ax, ay, f'{pid} 문 앞 접근칸이 막혔다'))
    out += islands(W, H, lower, upper)
    return out


def walkable(t):
    return t < 0 or passable(t)


def islands(W, H, lower, upper):
    """걸을 수 있는 칸이 한 덩이인가. 가장 큰 덩이 밖의 걸을 수 있는 칸마다 WZ-ISLAND(갇힌 주머니 — 플레이어가 못 간다)."""
    ok = [lower[i] >= 0 and walkable(lower[i]) and walkable(upper[i]) for i in range(W * H)]
    comp = [-1] * (W * H); sizes = []
    for s in range(W * H):
        if not ok[s] or comp[s] >= 0: continue
        cid = len(sizes); comp[s] = cid; stack = [s]; n = 0
        while stack:
            i = stack.pop(); n += 1; x, y = i % W, i // W
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * W + nx
                if 0 <= nx < W and 0 <= ny < H and ok[j] and comp[j] < 0: comp[j] = cid; stack.append(j)
        sizes.append(n)
    if len(sizes) <= 1: return []
    main = max(range(len(sizes)), key=lambda c: sizes[c])
    return [('WZ-ISLAND', i % W, i // W, f'갇힌 통행 주머니({sizes[comp[i]]}칸) — 주 통로와 이어지지 않는다') for i in range(W * H) if ok[i] and comp[i] != main]


def arrays(ex, place):
    W, H = ex['w'], ex['h']
    lower = list(ex['lower']); upper = list(ex['upper'])
    if place is not ex['place']:   # 변조 배치 → 다시 계산
        base = json.load(open(os.path.join(EXDIR, ex['id'] + '.json'), encoding='utf-8'))
        lower = [-1] * (W * H); upper = [-1] * (W * H)
        fl = KITS.get(base['floor'])
        ft = None
        if fl: ft = (fl['rows'][0]['tiles'][0], fl['rows'][0]['upperTiles'][0])
        else:
            g = next((a for a in DATA['autotileGroups'] if a['id'] == base['floor']), None)
            if g: ft = (g['variantMap']['255'], -1)
            else:
                grp = next((g for g in DATA['tileGroups'] if g['id'] == 'wz:floor:' + base['floor']), None)
                if grp: ft = (grp['tileIds'][0], -1)
        if ft:
            for i in range(W * H): lower[i] = ft[0] if ft[0] >= 0 else -1
        for pid, x0, y0 in place:
            k = KITS.get(pid)
            if not k: continue
            for y in range(k['height']):
                for x in range(k['width']):
                    X, Y = x0 + x, y0 + y
                    if not (0 <= X < W and 0 <= Y < H): continue
                    lo, up = k['rows'][y]['tiles'][x], k['rows'][y]['upperTiles'][x]
                    if lo >= 0: lower[Y * W + X] = lo
                    if up >= 0: upper[Y * W + X] = up
    return lower, upper


def mutations(ex):
    """정상 예제에서 한 가지만 틀리게 바꾼 변조들 → [(이름, 배치, 배열 변조 함수|None)]."""
    out = []
    place = ex['place']
    kits = [(n, p) for n, p in enumerate(place) if p[0] in KITS and KITS[p[0]]['width'] * KITS[p[0]]['height'] > 1]
    if kits:   # 1) 키트를 맵 오른쪽 끝 밖으로 밀어 잘리게
        n, (pid, x, y) = kits[-1]
        out.append(('키트가 맵 끝에서 잘림', [q if i != n else (pid, ex['w'] - 1, y) for i, q in enumerate(place)], None))
    solids = [(n, p) for n, p in enumerate(place) if p[0] in KITS and any(t >= 0 and not passable(t) for r in KITS[p[0]]['rows'] for t in r['upperTiles'])]
    if len(solids) >= 2:   # 2) 막힌 기물 두 개를 겹침
        (n1, a), (n2, b) = solids[0], solids[1]
        out.append(('막힌 기물이 서로 겹침', place + [(b[0], a[1], a[2])], None))
    doors = [p for p in place if 'door' in p[0] and p[0].endswith('open') and p[0] in KITS]
    if doors and solids:   # 3) 열린 문 앞에 막힌 기물
        d = doors[0]; k = KITS[d[0]]; s = solids[-1][1]
        out.append(('열린 문 앞 접근칸을 기물로 막음', place + [(s[0], d[1] + k['width'] // 2 - KITS[s[0]]['width'] // 2, d[2] + k['height'])], None))
    ups = [(p, y, x) for p in place if p[0] in KITS for y, r in enumerate(KITS[p[0]]['rows']) for x, t in enumerate(r['upperTiles']) if t >= 0 and DATA['tileMeta'][t].get('defaultLayer') == 'upper']
    if ups:   # 4) 위층 칸을 1층에 칠함
        p, y, x = ups[0]

        def mut(lower, upper, p=p, y=y, x=x):
            X, Y = p[1] + x, p[2] + y
            i = Y * ex['w'] + X
            if 0 <= X < ex['w'] and 0 <= Y < ex['h'] and upper[i] >= 0: lower[i], upper[i] = upper[i], -1
        out.append(('위층 칸을 1층에 칠함', place, mut))
    return out


# ───────────────────────── 문서 ─────────────────────────
cats = []


def cat(cid, name, desc):
    c = dict(id=cid, name=name, description=desc, documents=[], images=[]); cats.append(c); return c


def kit_line(k):
    rows = []
    for r in k['rows']:
        s = ''
        for lo, up in zip(r['tiles'], r['upperTiles']):
            t = up if up >= 0 else lo
            s += '.' if t < 0 else ('F' if home(t) == 'lower' and passable(t) else 'X' if home(t) == 'lower' else 'C' if passable(t) else 'S')
        rows.append(s)
    return rows


def dict_doc(space, kits):
    lines = [f"# {wzlib.SPACES[space]} — 조각 사전 ({len(kits)}종)\n", HEAD, '',
             '각 키트는 `stamp_object` 의 `kit:wizarding_world/<id>` 로 왼쪽 위 원점(dx 0, dy 0)에 찍는다. `tiles` 는 1층(lowerTiles), `upperTiles` 는 3층(upperTiles), -1 은 비움.',
             '통행 글자: S 막힘(위층·사람과 y 정렬) · C ★통행(위층·사람 위에 그림) · F 걷는 땅(1층) · X 막힌 땅(1층: 물) · . 비움. 애니메이션 칸은 baseTile 부터 가로 연속 프레임(animationStrips).', '']
    for k in kits:
        ai = k['ai']; st = [t for t in ai.get('tags', []) if t.startswith('상태:') or t.startswith('애니메이션')]
        lines.append(f"## `{k['id']}` — {k['name']} ({k['width']}×{k['height']}칸, {'반복' if ai.get('repeatability') == 'repeat' else '고정'}{', ' + ', '.join(st) if st else ''})")
        lines.append(f"{ai['description']}  \n배치: {ai['placementRules']}")
        lines.append('통행 `' + ' / '.join(kit_line(k)) + '`')
        lines.append('```json\n' + json.dumps([[r['tiles'], r['upperTiles']] for r in k['rows']], separators=(',', ':')) + '\n```')
    return '\n'.join(lines)


def gallery(kits, name):
    pad = 6; W = 820; x = y = pad; rh = 0; pos = []
    ims = [(k['id'], kit_image(k)) for k in kits]
    for kid, im in ims:
        w, h = max(im.width, 6 * len(kid)), im.height + 12
        if x + w > W: x = pad; y += rh + pad; rh = 0
        pos.append((x, y)); x += w + pad; rh = max(rh, h)
    S = Image.new('RGBA', (W, y + rh + pad), (52, 51, 56, 255)); d = ImageDraw.Draw(S)
    for (kid, im), (px, py) in zip(ims, pos):
        d.text((px, py), kid.replace('wz-', ''), fill=(220, 220, 220, 255), font=FONT); S.alpha_composite(im, (px, py + 12))
    return save(name, S)


examples = {}
for f in sorted(os.listdir(EXDIR)) if os.path.isdir(EXDIR) else []:
    if f.endswith('.json'):
        e = json.load(open(os.path.join(EXDIR, f), encoding='utf-8')); examples.setdefault(e['space'], []).append(e)

by_space = collections.OrderedDict((s, []) for s in wzlib.SPACES)
for k in DATA['structureKits']:
    sp = next((s for s in wzlib.SPACES if wzlib.SPACES[s] in k['ai'].get('tags', [])), 'shared')
    by_space[sp].append(k)

# 1) 입구
c0 = cat('wz-start', '마법 학교 · 읽는 순서·시트 지도', 'wizarding_world(해리포터풍 마법 학교 손 도트 번들 칩셋)를 처음 깔 때 읽는 입구: 무엇이 있고 없는지·층과 통행·실행 순서·공간별 용도 지도·그룹 사전.')
space_rows = '\n'.join(f"| `wz-space-{s}` | {wzlib.SPACES[s]} | {len(by_space[s])} | {', '.join(e['id'] for e in examples.get(s, [])) or '없음'} |" for s in wzlib.SPACES if by_space[s])
c0['documents'].append(dict(id='wz-order', name='마법 학교 · 읽는 순서·층과 통행·실행 순서', markdown='\n'.join([
    '# 마법 학교 (wizarding_world) — 읽는 순서 · 층과 통행 · 실행 순서', '', HEAD, '',
    f"영국 마법학교풍 고딕 석조 성채·마법 상점·호그스미드 눈 마을·금지된 숲·검은 호수·퀴디치 경기장의 **손 도트 조각**을 굽은 시트다. 조립 키트 {len(DATA['structureKits'])}종 · 오토타일 {len(DATA['autotileGroups'])}세트 · 움직이는 칸 묶음 {len(DATA['animationStrips'])}개 · 타일 그룹 {len(DATA['tileGroups'])}개. 인물·생물 걷기 칩은 캐릭터 그림 `Wizarding1`~`Wizarding{CHARS['sheets']}`({len(CHARS['characters'])}명, 용도 `wz-characters`).",
    '', '## 이 타일셋에 없는 것',
    '- 사람·생물은 타일이 아니다 — 이벤트의 캐릭터 그림(`tex_oprn_charset_wizarding<N>`)으로 둔다. 세스트랄·마차·보트는 크기가 커서 **정지 키트**(그림 칸)이며 움직이는 탈것이 아니다.',
    '- 검수를 통과하지 못한 조각은 시트에 없다(사전에 있는 id 만 쓴다). 다른 칩셋의 실내 가구·벽을 섞지 않는다.',
    '', '## 맵 짓기 — 먼저 빌더', '방·야외 한 장은 낱칸 칠하기로 처음부터 그리지 않는다. `build_wizarding_space({space, width?, height?, doors?, furnitureMode?, density?, seed?})` 한 번으로 벽 고리·문·바닥·러너·가구를 짓는다(가구는 놓을 때마다 통행 검사 — 걸을 수 있는 칸이 한 덩이, 문·시작 칸 닿음). 공간 목록·가구 id·NPC 걷기 칩은 `list_wizarding_spaces`. 결과의 doorCells 에 이동 이벤트(transfer)를 달아 방을 잇고, spawn 을 도착 지점으로 쓴다. 지은 뒤 소품을 더할 때만 이 문서의 키트 사전으로 stamp 한다.',
    '', '## 읽는 순서', '1. 이 문서 → 2. `wz-dict-groups`(그룹 사전) → 3. 만들 공간의 용도 `wz-space-<공간>`(조각 사전 → 완성 예제 → 정상/오류) → 4. 공용 성채 벽·바닥은 `wz-space-shared` → 5. 사람은 `wz-characters`, 움직임은 `wz-effects`, 검사 범위는 `wz-check`.',
    '', '## 층과 통행(칸 단위 엔진 판정)', '| 칸 종류 | 홈 층 | 걷기 | 그림 순서 |', '|---|---|---|---|',
    '| F 불투명 땅 | 1층 lowerTiles | 걷는다 | 맨 아래 |', '| X 막힌 땅(물) | 1층 | 막힘 | 맨 아래 |', '| f 투명 덧그림(얼룩·자국) | 2층(붓 홈 위, 잠김) | 걷는다 | 땅 위·사람 밑 |',
    '| S 몸체 | 3층 upperTiles | 막힘 | 사람과 y 정렬 |', '| C ★ 윗부분(처마·수관·서가 윗단·열린 문) | 3층 | 걷는다 | 사람 위 |',
    '', '## 실행 순서(실내 한 칸)', '1. `create_map tilesetId:"wizarding_world"` (보는 맵이 다른 계열이면 `ask_tileset_change`).',
    '2. 바닥: 오토타일 그룹(`wz:auto:…`)이나 반복 바닥 그룹(`wz:floor:…`)으로 `fill_region` 한다.',
    '3. 벽: 북쪽 0~3행에 `wz-castle-wall-n`(창·기둥 변형 섞기)·모서리 `wz-castle-wall-nw/ne`, 서·동 가장자리 열 `wz-castle-wall-w/e`, 남쪽 마지막 2행 `wz-castle-wall-s`·`-sw/-se`. 문은 북벽에 `wz-castle-door1-*`/`door2-*`, 남벽 출입구 `wz-castle-door-s`.',
    '4. 가구·기물: 공간 사전의 키트를 뒤(북)에서 앞(남) 순서로 찍는다. 막힌 칸끼리 겹치지 않게, 문 바로 아래 한 칸은 비운다.',
    '5. 얼룩·자국(f)·효과(애니메이션)는 마지막에 덧그린다. 6. 사람은 이벤트로.',
    '', '## 공간별 용도', '| 용도 | 공간 | 키트 | 완성 예제 |', '|---|---|---|---|', space_rows])))
gl = ['# 그룹 사전', '', HEAD, '', '| id | 이름 | 역할 | 층 | 칸 수 | 규칙 |', '|---|---|---|---|---|---|']
for g in DATA['tileGroups']:
    gl.append(f"| `{g['id']}` | {g['name']} | {g['role']} | {g['defaultLayer']} | {len(g['tileIds'])} | {g['placementRules'][:120]} |")
c0['documents'].append(dict(id='wz-dict-groups', name='마법 학교 · 그룹 사전', markdown='\n'.join(gl)))
ov = SHEET.copy(); sc = min(1.0, 820 / ov.height)
c0['images'].append(dict(id='wz-img-sheet', name='sheet.png', caption=f'시트 전체(원본 해상도 {SHEET.width}×{SHEET.height}px). 번호 n 은 열 n%{TPR}, 행 n÷{TPR}.', dataUrl=save('sheet.png', SHEET)))

# 2) 공간별
for s, kits in by_space.items():
    if not kits: continue
    c = cat(f'wz-space-{s}', f'마법 학교 · {wzlib.SPACES[s]}', f'{wzlib.SPACES[s]} 조각 {len(kits)}종의 정확한 사전·완성 예제(입력→전체 배열→원본 그림)·정상/오류 그림.')
    for i in range(0, len(kits), 40):
        c['documents'].append(dict(id=f'wz-{s}-dict-{i // 40 + 1}', name=f'{wzlib.SPACES[s]} · 조각 사전 {i // 40 + 1}', markdown=dict_doc(s, kits[i:i + 40])))
    for i in range(0, len(kits), 60):
        c['images'].append(dict(id=f'wz-img-{s}-kits-{i // 60 + 1}', name=f'{s}-kits-{i // 60 + 1}.png', caption=f'{wzlib.SPACES[s]} 키트 그림(원본 해상도, 시트에서 다시 조립한 실제 출력). 이름표는 id 의 wz- 뒤.',
                                dataUrl=gallery(kits[i:i + 60], f'{s}-kits-{i // 60 + 1}.png')))
    for ex in examples.get(s, []):
        lower, upper = ex['lower'], ex['upper']
        probs = check_map(ex, lower, upper)
        img = render(lower, upper, ex['w'], ex['h'])
        url = save(f"{ex['id']}.png", img)
        c['images'].append(dict(id=f"wz-img-{ex['id']}", name=f"{ex['id']}.png", caption=f"완성 예제 {ex['name']} {ex['w']}×{ex['h']}칸 — 원본 해상도, 아래 배열을 시트로 그린 실제 출력.", dataUrl=url))
        md = [f"# 완성 예제 — {ex['name']}", '', HEAD, '', ex.get('desc') or '', '',
              f"맵 {ex['w']}×{ex['h']}칸. 바닥 `{ex['floor']}` 를 전부 채운 뒤 아래 순서대로 찍는다(뒤가 위). 좌표는 키트 왼쪽 위(0 기준).",
              '', '| 순서 | 키트 | x | y |', '|---|---|---|---|'] + [f'| {n + 1} | `{p}` | {x} | {y} |' for n, (p, x, y) in enumerate(ex['place'])]
        if ex.get('skipped'): md += ['', f"검수 미통과로 이 시트에 없는 조각(배열에서 빠짐): {', '.join('`%s`' % k for k in ex['skipped'])}"]
        md += ['', f"구조 검사(`wz-check`): {'문제 0건' if not probs else '; '.join(f'{c_} ({x},{y}) {d}' for c_, x, y, d in probs[:12])}",
               '', '## 1층 lowerTiles(행 우선)', arr_md(lower, ex['w']), '', '## 3층 upperTiles', arr_md(upper, ex['w']), '', f"그림: `wz-img-{ex['id']}`"]
        c['documents'].append(dict(id=f"wz-{s}-ex-{ex['id'].replace('wz-', '')}", name=f"{wzlib.SPACES[s]} · 완성 예제 {ex['name']}", markdown='\n'.join(md)))
        em = ['# 정상/오류 — ' + ex['name'], '', HEAD, '', '정상 예제에서 **한 가지만** 틀리게 바꾼 실제 배열을 같은 검사로 돌린 결과다. 빨강 테두리 = 검사가 짚은 칸(맵 좌표 0 기준).', '',
              '| 변조 | 오류 코드 | 좌표 | 그림 |', '|---|---|---|---|']
        for n, (nm, place, mut) in enumerate(mutations(ex)):
            lo, up = arrays(ex, place)
            if mut: mut(lo, up)
            ex2 = dict(ex, place=place)
            pr = [p for p in check_map(ex2, lo, up) if p not in probs]
            name = f"{ex['id']}-err{n + 1}.png"
            both = Image.new('RGBA', (img.width * 2 + 8, img.height), (52, 51, 56, 255))
            both.alpha_composite(img, (0, 0)); both.alpha_composite(render(lo, up, ex['w'], ex['h'], [(x, y) for _, x, y, _ in pr]), (img.width + 8, 0))
            c['images'].append(dict(id=f"wz-img-{ex['id']}-err{n + 1}", name=name, caption=f'왼쪽 정상 · 오른쪽 오류({nm}). 빨강 = 검사가 짚은 칸.', dataUrl=save(name, both)))
            em.append(f"| {nm} | {', '.join(sorted({p[0] for p in pr})) or '(검사 못 잡음 — 범위 밖)'} | {' '.join(f'({x},{y})' for _, x, y, _ in pr[:6])} | `wz-img-{ex['id']}-err{n + 1}` |")
        c['documents'].append(dict(id=f"wz-{s}-err-{ex['id'].replace('wz-', '')}", name=f"{wzlib.SPACES[s]} · 정상/오류 {ex['name']}", markdown='\n'.join(em)))

# 3) 캐릭터
cc = cat('wz-characters', '마법 학교 · 인물·생물 걷기 칩', f"캐릭터 그림 Wizarding1~{CHARS['sheets']} 의 {len(CHARS['characters'])}명 명단(시트·칸·외형).")
cl = ['# 인물·생물 걷기 칩', '', '이벤트 그래픽 `{type:"bundled", textureKey:"tex_oprn_charset_wizarding<시트>", characterIndex:<칸>}`. 시트는 RM2K3 CharSet 288×256(8명 = 4열×2행, 한 명 3프레임×4방향, 행 순서 위·오른쪽·아래·왼쪽).', '',
      '| id | 이름 | 공간 | 시트 | 칸 | 외형 |', '|---|---|---|---|---|---|']
for ch in CHARS['characters']:
    cl.append(f"| `{ch['id']}` | {ch['name']} | {ch['spaceName']} | Wizarding{ch['sheet']} | {ch['index']} | {ch['desc'][:140]} |")
cc['documents'].append(dict(id='wz-chr-roster', name='인물·생물 명단', markdown='\n'.join(cl)))
for n in range(1, CHARS['sheets'] + 1):
    im = Image.open(os.path.join(ROOT, f'public/assets/generated/charsets/Wizarding{n}.png')).convert('RGBA')
    cc['images'].append(dict(id=f'wz-img-charset-{n}', name=f'Wizarding{n}.png', caption=f'Wizarding{n} 시트 2배(nearest). 칸 0~3 윗줄, 4~7 아랫줄.', dataUrl=save(f'charset-{n}.png', im, 2)))

# 4) 움직임
ce = cat('wz-effects', '마법 학교 · 움직이는 칸(애니메이션)', f"animationStrips {len(DATA['animationStrips'])}개 — baseTile 부터 가로 연속 프레임.")
el = ['# 움직이는 칸', '', HEAD, '', '맵에는 **baseTile 번호만** 칠한다(엔진이 frames 개 연속 칸을 fps 로 돌린다). 프레임 칸 번호를 따로 칠하지 않는다.', '', '| baseTile | frames | fps | 이름 |', '|---|---|---|---|']
for st in DATA['animationStrips']:
    el.append(f"| {st['baseTile']} | {st['frames']} | {st['fps']} | {DATA['tileMeta'][st['baseTile']]['label']} |")
ce['documents'].append(dict(id='wz-fx-strips', name='움직이는 칸 표', markdown='\n'.join(el)))

# 5) 검사 범위
ck = cat('wz-check', '마법 학교 · 자동 검사 범위·층 정정', '구조 검사가 보는 것과 보지 않는 것, 층 정보 정정 기준.')
ck['documents'].append(dict(id='wz-check-scope', name='자동 검사 범위', markdown='\n'.join([
    '# 자동 검사 범위', '', HEAD, '',
    '| 코드 | 뜻 | 판정 근거 |', '|---|---|---|',
    '| `WZ-LAYER` | 위층 홈 칸(잠긴 defaultLayer upper)이 1층에, 또는 아래층 땅 칸이 3층에 있다 | 칸의 priority·tileMeta(엔진 tileLayerHome 과 같은 식) |',
    '| `WZ-CUT` | 키트 칸이 맵 밖으로 잘렸다 | 배치 좌표 + 키트 크기 |',
    '| `WZ-OVERLAP` | 막힌 기물 칸을 다른 막힌 기물이 덮었다 | 키트 upperTiles 통행 |',
    '| `WZ-ISLAND` | 걸을 수 있는 칸이 여러 덩이로 갈렸다(가구가 길을 막아 플레이어가 못 가는 주머니) | 칸 lower/upper 통행으로 4방향 연결 덩이를 센다 |',
    '| `WZ-DOOR-BLOCKED` | 열린 문(`…door…-open`) 바로 아래 접근칸이 막혔다 | 그 칸 lower/upper 통행 |',
    '', '보지 않는 것: 이벤트 실행, 미적 품질, 길 전체 연결, 모델의 성공률. 검사 통과를 그런 성공으로 주장하지 않는다.',
    '', '## 층 정보 기준', '모든 칸의 층·통행은 굽기(`bake_wz.py`)가 조각의 walk 글자에서 칸마다 정했다: F→floor(1층 통행), X→solidfloor, f→flat(투명, 잠김·위층 붓·통행), S→solid(3층 막힘), C→star(3층 ★). 그룹의 층은 선언이 아니라 멤버 칸의 엔진 홈에서 유도했다(`bake_lib.derive_group_layer`).'])))

for c in cats:
    assert len(c['documents']) <= 64 and len(c['images']) <= 256, (c['id'], len(c['documents']), len(c['images']))
    for d in c['documents']: assert len(d['markdown']) <= 120000, (d['id'], len(d['markdown']))
assert len(cats) <= 32, len(cats)
json.dump(cats, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"용도 {len(cats)} · 문서 {sum(len(c['documents']) for c in cats)} · 그림 {sum(len(c['images']) for c in cats)} → {OUT}")
