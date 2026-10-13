"""gothic_manor 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 build_gothic_place 예제에서 기계적으로 만든다.

  python3 scripts/content/gothic-manor/bake_gm.py
  npx tsx --tsconfig tsconfig.app.json scripts/content/gothic-manor/export_places.ts --seeds 1   (예제 → tiledata/gothic-manor/places/*.json)
  python3 scripts/content/gothic-manor/bake_refs_gm.py

산출: src/assets/gothicManorReferences.json (그림은 경로만) · public/assets/gothic-manor-references/*.png (원본 해상도)
용도: gm-start(입구·없는 것·층·실행 순서·그룹 사전·시트) · gm-build(빌더 사용법·완성 예제 13장·정상/오류) ·
      gm-kits-<묶음>(조각 사전·그림) · gm-effects(움직이는 칸) · gm-check(자동 검사 범위·층 정정)
"""
import collections, json, math, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import bake_lib as BL  # noqa: E402
import loader  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
DATA = json.load(open(os.path.join(ROOT, 'src/assets/gothicManorTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/gothic-manor/gothic-manor-chipset.png')).convert('RGBA')
EXDIR = os.path.join(ROOT, 'tiledata/gothic-manor/places')
IMGDIR = os.path.join(ROOT, 'public/assets/gothic-manor-references')
OUT = os.path.join(ROOT, 'src/assets/gothicManorReferences.json')
TPR, N = DATA['tilesPerRow'], DATA['count']
KITS = {k['id']: k for k in DATA['structureKits']}
P = DATA['passability']
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
LAYERS = ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles')
HEAD = (f"tilesetId `gothic_manor` · 그림 `public/assets/gothic-manor/gothic-manor-chipset.png`(텍스처 `tex_gothic_manor`, **{N}칸**, 16px 칸, "
        f"시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, 한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). "
        "계열 `oprn-gothic` — 다른 칩셋(버들항·일본 도시·마법 학교·조선·실내 v5)의 칸 번호와 섞지 않는다. 색은 잠긴 고딕 팔레트(20 램프)뿐이다.")
MODULES = ['terrain', 'bld_manor', 'bld_chapel', 'bld_misc', 'yard2', 'gy_props', 'yard_props', 'int_walls', 'int_floors', 'int_furn', 'int_gallery', 'yard3']
SPACE_OF = {}
for m in MODULES:
    for pid, p in loader.load(m).pieces.items(): SPACE_OF[pid] = p['space']
GROUPS = collections.OrderedDict([
    ('grounds', ('정원·건물·땅', ('grounds', 'manor'))),
    ('graveyard', ('묘지·예배당 마당', ('graveyard',))),
    ('rooms', ('저택 실내(벽·바닥·가구)', ('hall', 'library', 'bedroom', 'kitchen', 'shared', 'chapel'))),
    ('cellar', ('지하실·납골당', ('cellar', 'crypt'))),
    ('gallery', ('미술관 전시실', ('gallery',))),
])
os.makedirs(IMGDIR, exist_ok=True)
for f in os.listdir(IMGDIR):
    if f.endswith('.png'): os.remove(os.path.join(IMGDIR, f))


def home(t):
    return BL.tile_home(DATA['priority'][t], DATA['tileMeta'][t])


def passable(t):
    p = P[t]; return p['up'] or p['down'] or p['left'] or p['right']


def save(name, im, scale=1):
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(os.path.join(IMGDIR, name), optimize=True)
    return f'/assets/gothic-manor-references/{name}'


def render(ex, marks=()):
    W, H = ex['w'], ex['h']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for k in LAYERS:
        for i, t in enumerate(ex.get(k) or []):
            if t >= 0: im.alpha_composite(BL.read_cell(SHEET, t, TPR), ((i % W) * 16, (i // W) * 16))
    d = ImageDraw.Draw(im)
    for x, y in marks: d.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], outline=(255, 40, 40, 255), width=2)
    return im


def arr_md(a, W):
    rows = [','.join('%d' % v for v in a[y * W:(y + 1) * W]) for y in range(len(a) // W)]
    return '```json\n[\n' + ',\n'.join('  ' + r for r in rows) + '\n]\n```'


def access_cells(ex):
    out = [(e['access']['x'], e['access']['y']) for e in (ex.get('entrances') or [])]
    step = dict(n=(0, 1), s=(0, -1), w=(1, 0), e=(-1, 0))
    for d in (ex.get('doorCells') or []):
        dx, dy = step[d['side']]; out.append((d['x'] + dx, d['y'] + dy))
    return out


# ───────────────────────── 구조 검사(자동 좌표 검증) ─────────────────────────
def check_map(ex):
    """[(코드, x, y, 설명)]. 미적 품질·이벤트 실행은 보지 않는다."""
    W, H = ex['w'], ex['h']; lo, lov, up, upv = (ex[k] for k in LAYERS); out = []
    for i in range(W * H):
        x, y = i % W, i // W
        if lo[i] >= 0 and home(lo[i]) == 'upper' and DATA['tileMeta'][lo[i]].get('defaultLayer') == 'upper':
            out.append(('GM-LAYER', x, y, f'위층 홈 칸 {lo[i]} 이 1층(lowerTiles)에 있다'))
        if up[i] >= 0 and DATA['priority'][up[i]] == 'lower' and not DATA['tileMeta'][up[i]].get('locked'):
            out.append(('GM-LAYER', x, y, f'아래층 땅 칸 {up[i]} 이 3층(upperTiles)에 있다'))
    occ = {}
    for p in ex.get('placed') or []:
        k = KITS.get(p['kit'])
        if not k: continue
        for yy, row in enumerate(k['rows']):
            for xx in range(k['width']):
                t = (row.get('upperTiles') or [-1] * k['width'])[xx]
                if t < 0 and row['tiles'][xx] < 0: continue
                X, Y = p['x'] + xx, p['y'] + yy
                if not (0 <= X < W and 0 <= Y < H): out.append(('GM-CUT', X, Y, f"{p['kit']} 가 맵 밖으로 잘렸다")); continue
                if t >= 0 and not passable(t):
                    if (X, Y) in occ and occ[(X, Y)] != p['kit'] + str(p['x']) + str(p['y']):
                        out.append(('GM-OVERLAP', X, Y, f"{p['kit']} 가 다른 막힌 기물 칸을 덮었다"))
                    occ[(X, Y)] = p['kit'] + str(p['x']) + str(p['y'])
    for x, y in access_cells(ex):
        if 0 <= x < W and 0 <= y < H:
            i = y * W + x
            if any(ex[k][i] >= 0 and not passable(ex[k][i]) for k in LAYERS):
                out.append(('GM-DOOR-BLOCKED', x, y, '문 앞 접근칸이 막혔다'))
    out += islands(ex)
    return out


def islands(ex):
    W, H = ex['w'], ex['h']
    ok = [ex['lowerTiles'][i] >= 0 and all(ex[k][i] < 0 or passable(ex[k][i]) for k in LAYERS) for i in range(W * H)]
    comp = [-1] * (W * H); sizes = []
    for s in range(W * H):
        if not ok[s] or comp[s] >= 0: continue
        cid = len(sizes); comp[s] = cid; st = [s]; n = 0
        while st:
            i = st.pop(); n += 1; x, y = i % W, i // W
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * W + nx
                if 0 <= nx < W and 0 <= ny < H and ok[j] and comp[j] < 0: comp[j] = cid; st.append(j)
        sizes.append(n)
    if len(sizes) <= 1: return []
    main = max(range(len(sizes)), key=lambda c: sizes[c])
    return [('GM-ISLAND', i % W, i // W, f'갇힌 통행 주머니({sizes[comp[i]]}칸)') for i in range(W * H) if ok[i] and comp[i] != main]


def stamp_into(ex, kid, x0, y0):
    k = KITS[kid]; W, H = ex['w'], ex['h']
    for yy, row in enumerate(k['rows']):
        for xx in range(k['width']):
            X, Y = x0 + xx, y0 + yy
            if not (0 <= X < W and 0 <= Y < H): continue
            lo, up = row['tiles'][xx], (row.get('upperTiles') or [-1] * k['width'])[xx]
            if lo >= 0: ex['lowerTiles'][Y * W + X] = lo
            if up >= 0: ex['upperTiles'][Y * W + X] = up
    ex['placed'] = list(ex.get('placed') or []) + [dict(kit=kid, x=x0, y=y0, role='prop')]


def clone(ex):
    e = dict(ex)
    for k in LAYERS: e[k] = list(ex[k])
    e['placed'] = list(ex.get('placed') or [])
    return e


def mutations(ex):
    """정상 예제에서 한 가지만 틀리게 바꾼 실제 배열들 → [(이름, 변조 예제)]."""
    out = []; W, H = ex['w'], ex['h']

    def solid_cells(kid):
        k = KITS[kid]; return sum(1 for r in k['rows'] for t in (r.get('upperTiles') or []) if t >= 0 and not passable(t))
    solid = [p for p in ex.get('placed') or [] if p['kit'] in KITS and solid_cells(p['kit']) >= 2]
    wide = [p for p in solid if KITS[p['kit']]['width'] >= 2]
    if wide:
        p = wide[-1]; e = clone(ex); stamp_into(e, p['kit'], W - 1, p['y']); out.append(('기물이 맵 오른쪽 끝에서 잘림', e))
    pair = next(((a, b) for a in solid for b in solid if a is not b and a['kit'] != b['kit']
                 and a['x'] + KITS[b['kit']]['width'] <= W and a['y'] + KITS[b['kit']]['height'] <= H), None)
    if pair:
        a, b = pair; e = clone(ex); stamp_into(e, b['kit'], a['x'], a['y']); out.append(('막힌 기물을 다른 기물 위에 겹침', e))
    acc = access_cells(ex)
    blocker = next((k for k in ('gm-tomb-round', 'gm-barrel', 'gm-chair', 'gm-stump') if k in KITS), None)
    if acc and blocker:
        x, y = acc[0]; e = clone(ex); stamp_into(e, blocker, x, y); out.append(('문 앞 접근칸을 기물로 막음', e))
    ups = [(i, t) for i, t in enumerate(ex['upperTiles']) if t >= 0 and DATA['tileMeta'][t].get('defaultLayer') == 'upper']
    if ups:
        i, t = ups[len(ups) // 2]; e = clone(ex); e['lowerTiles'][i], e['upperTiles'][i] = t, -1; out.append(('위층 칸을 1층에 칠함', e))
    return out


def kit_line(k):
    rows = []
    for r in k['rows']:
        s = ''
        for lo, up in zip(r['tiles'], r.get('upperTiles') or [-1] * k['width']):
            t = up if up >= 0 else lo
            s += '.' if t < 0 else ('F' if home(t) == 'lower' and passable(t) else 'X' if home(t) == 'lower' else 'C' if passable(t) else 'S')
        rows.append(s)
    return rows


cats = []


def cat(cid, name, desc):
    c = dict(id=cid, name=name, description=desc, documents=[], images=[]); cats.append(c); return c


def dict_doc(title, kits):
    lines = [f"# {title} — 조각 사전 ({len(kits)}종)\n", HEAD, '',
             '각 키트는 `stamp_object` 의 `kit:gothic_manor/<id>` 로 왼쪽 위 원점(dx 0, dy 0)에 찍는다. `tiles` 는 1층(lowerTiles), `upperTiles` 는 3층(upperTiles), -1 은 비움.',
             '통행 글자: S 막힘(위층·사람과 y 정렬) · C ★통행(위층·사람 위에 그림) · F 걷는 땅(1층) · X 막힌 땅(1층: 물) · . 비움.',
             '`출입:x,y` 태그 = 키트 원점 기준 문 앞 접근칸(건물 맨 아래 줄 바로 아래). 그 칸은 비워 두고, 문 칸(접근칸 바로 위)에 이동 이벤트를 단다.', '']
    for k in kits:
        ai = k['ai']; extra = [t for t in ai.get('tags', []) if t.startswith('출입:')]
        lines.append(f"## `{k['id']}` — {k['name']} ({k['width']}×{k['height']}칸, {'반복' if ai.get('repeatability') == 'repeat' else '고정'}{', ' + ' '.join(extra) if extra else ''})")
        lines.append(f"{ai['description']}  \n배치: {ai['placementRules']}")
        lines.append('통행 `' + ' / '.join(kit_line(k)) + '`')
        lines.append('```json\n' + json.dumps([[r['tiles'], r.get('upperTiles') or []] for r in k['rows']], separators=(',', ':')) + '\n```')
    return '\n'.join(lines)


def gallery(kits, name):
    pad = 6; W = 820; x = y = pad; rh = 0; pos = []
    ims = [(k['id'], BL.reassemble(k, SHEET, TPR)) for k in kits]
    for kid, im in ims:
        w, h = max(im.width, 6 * len(kid)), im.height + 12
        if x + w > W: x = pad; y += rh + pad; rh = 0
        pos.append((x, y)); x += w + pad; rh = max(rh, h)
    S = Image.new('RGBA', (W, y + rh + pad), (40, 38, 46, 255)); d = ImageDraw.Draw(S)
    for (kid, im), (px, py) in zip(ims, pos):
        d.text((px, py), kid.replace('gm-', ''), fill=(220, 220, 220, 255), font=FONT); S.alpha_composite(im, (px, py + 12))
    return save(name, S)


examples = []
for f in sorted(os.listdir(EXDIR)):
    if f.endswith('.json'): examples.append(json.load(open(os.path.join(EXDIR, f), encoding='utf-8')))
OUTDOOR = ('manor-grounds', 'graveyard', 'gallery-plaza')
examples.sort(key=lambda e: (e['place'] not in OUTDOOR, e['id']))
by_group = collections.OrderedDict((g, []) for g in GROUPS)
for k in DATA['structureKits']:
    sp = SPACE_OF.get(k['id'], 'shared')
    g = next((gid for gid, (_, spaces) in GROUPS.items() if sp in spaces), 'grounds')
    by_group[g].append(k)

# 1) 입구
c0 = cat('gm-start', '고딕 저택 · 읽는 순서·시트 지도', 'gothic_manor(고딕 호러 저택·묘지·미술관 손 도트 번들 칩셋)를 처음 깔 때 읽는 입구: 무엇이 있고 없는지·층과 통행·실행 순서·그룹 사전·시트.')
grp_rows = '\n'.join(f"| `gm-kits-{g}` | {GROUPS[g][0]} | {len(ks)} |" for g, ks in by_group.items() if ks)
c0['documents'].append(dict(id='gm-order', name='고딕 저택 · 읽는 순서·층과 통행·실행 순서', markdown='\n'.join([
    '# 고딕 저택 (gothic_manor) — 읽는 순서 · 층과 통행 · 실행 순서', '', HEAD, '',
    f"고딕 호러의 저택·예배당·공동묘지·철책·고사목·안개 이끼·납골당·미술관(박물관) 건물과 저택 실내(홀·서재·침실·부엌·지하실·전시실)의 **손 도트 조각**을 굽은 시트다. "
    f"조립 키트 {len(DATA['structureKits'])}종 · 오토타일 {len(DATA['autotileGroups'])}세트(길 3·연못·안개 이끼 + 철책·돌담·산울타리 런) · 움직이는 칸 묶음 {len(DATA['animationStrips'])}개 · 타일 그룹 {len(DATA['tileGroups'])}개. "
    "모든 조각은 3/4 탑뷰 관문(object-gate) 영수증이 현재 그림 해시에 PASS 인 것만 구웠다(실내 벽 부품은 조립된 방 그림의 영수증으로).",
    '', '## 이 타일셋에 없는 것',
    '- 사람·유령·동물 걷기 칩은 없다 — 이벤트 캐릭터 그림으로 둔다(사람은 기본 Actor1 등 RTP 걷기 칩). 떠도는 유령·까마귀·검은 고양이 타일은 관문을 통과하지 못해 시트에 없다.',
    '- 닫힌 철문·고사목 위 까마귀 기둥·성 기사 석상·첨탑 오벨리스크·장미 아치·독서대·새장·트렁크·지하 마름돌 벽난로는 관문 반려로 없다. 사전에 있는 id 만 쓴다.',
    '- 옛 「gothic-interior-authoring」 용도와 그 기물 번호는 폐기됐다(다른 그림이다). 이 문서의 id 만 쓴다.',
    '', '## 맵 짓기 — 먼저 빌더',
    '장소 한 장은 낱칸 칠하기로 처음부터 그리지 않는다. `build_gothic_place({place, width?, height?, seed?, density?, fog?, doors?, furniture?})` 한 번으로 짓는다(`list_gothic_places` 로 목록).',
    '- 야외 `manor-grounds`(흉가 저택과 정원) · `graveyard`(공동묘지와 예배당) · `gallery-plaza`(미술관 앞마당): 둘레 철책·돌담과 남쪽 정문, 북쪽 본 건물, 곁 건물, 길(모든 문까지 이어짐), 연못·묘비 줄·고사목·등불·안개 덧그림.',
    '- 실내 `hall`(변형 corridor·dining) · `library` · `bedroom` · `kitchen` · `cellar` · `chapel` · `crypt` · `gallery`: 벽 고리·문·바닥·러너·가구·덧그림.',
    '- 결과의 `entrances`(건물 문 칸 x,y — 이동 이벤트 자리, 그 아래 access 는 비움)·`exits`(정문)·`doorCells`(실내 문)에 transfer 를 달아 맵을 잇는다. 지은 뒤 소품만 더할 때 이 문서의 키트 사전으로 stamp 한다.',
    '', '## 읽는 순서', '1. 이 문서 → 2. `gm-build`(빌더 예제 13장: 입력→전체 배열→원본 그림, 정상/오류) → 3. 더할 소품의 `gm-kits-<묶음>` 사전 → 4. 움직임 `gm-effects`, 검사 범위 `gm-check`.',
    '', '## 층과 통행(칸 단위 엔진 판정)', '| 칸 종류 | 홈 층 | 걷기 | 그림 순서 |', '|---|---|---|---|',
    '| F 불투명 땅(풀·이끼·길·바닥) | 1층 lowerTiles | 걷는다 | 맨 아래 |', '| X 막힌 땅(연못 물) | 1층 | 막힘 | 맨 아래 |',
    '| f 투명 덧그림(낙엽·안개·핏자국·무덤 자리·러너) | 2층 lowerOverlayTiles | 걷는다 | 땅 위·사람 밑 |',
    '| S 몸체(건물·묘비·가구·철책) | 3층 upperTiles | 막힘 | 사람과 y 정렬 |', '| C ★ 윗부분(지붕 끝·수관·열린 문) | 3층 | 걷는다 | 사람 위 |',
    '', '## 실행 순서(손으로 소품을 더할 때)', '1. 대상 맵이 `gothic_manor` 인지 본다(아니면 `ask_tileset_change`).',
    '2. 땅은 반복 바닥 그룹(`gm:floor:…`)·길 오토타일(`gm:auto:gm-path-dirt|gm-cobble|gm-flagstone`)로 칠한다. 철책·돌담·산울타리는 런 그룹(`gm:run:…`)으로 이어 칠한다.',
    '3. 건물 → 큰 기물(고사목·석관) → 작은 소품 순서로 뒤(북)에서 앞(남)으로 찍는다. 막힌 칸끼리 겹치지 않게, 모든 `출입:` 접근칸과 길은 비워 둔다.',
    '4. 덧그림(f)·애니메이션 칸은 마지막. 5. `check_reachability` 로 정문에서 모든 문 앞에 닿는지 본다.',
    '', '## 조각 묶음', '| 용도 | 묶음 | 키트 |', '|---|---|---|', grp_rows])))
gl = ['# 그룹 사전', '', HEAD, '', '| id | 이름 | 역할 | 층 | 칸 수 | 규칙 |', '|---|---|---|---|---|---|']
for g in DATA['tileGroups']:
    gl.append(f"| `{g['id']}` | {g['name']} | {g['role']} | {g.get('defaultLayer', '')} | {len(g['tileIds'])} | {(g.get('placementRules') or '')[:120]} |")
c0['documents'].append(dict(id='gm-dict-groups', name='고딕 저택 · 그룹 사전', markdown='\n'.join(gl)))
al = ['# 오토타일·런', '', HEAD, '', '| id | 이름 | 이웃 | 층 | 쓰는 법 |', '|---|---|---|---|---|']
for a in DATA['autotileGroups']:
    al.append(f"| `{a['id']}` | {a['name']} | {a.get('neighborhood', 4)} | {a.get('layer', 'lower')} | {'영역을 칠하면 가장자리가 저절로 맞는다' if a.get('neighborhood') == 8 else '선을 그으면 끝·모서리·T자가 저절로 맞는다(3층)'} |")
c0['documents'].append(dict(id='gm-dict-autotiles', name='고딕 저택 · 오토타일·런', markdown='\n'.join(al)))
c0['images'].append(dict(id='gm-img-sheet', name='sheet.png', caption=f'시트 전체(원본 해상도 {SHEET.width}×{SHEET.height}px). 번호 n 은 열 n%{TPR}, 행 n÷{TPR}.', dataUrl=save('sheet.png', SHEET)))

# 2) 빌더 예제
cb = cat('gm-build', '고딕 저택 · build_gothic_place 완성 예제', 'build_gothic_place 로 지은 야외 3종·실내 10종(시드 1)의 입력·전체 배열·원본 그림, 그리고 대표 4장의 정상/오류 그림.')
ERR_FOR = {'gm-place-manor-grounds', 'gm-place-graveyard', 'gm-place-hall', 'gm-place-gallery'}
for ex in examples:
    probs = check_map(ex)
    img = render(ex)
    url = save(f"{ex['id']}.png", img)
    cb['images'].append(dict(id=f"gm-img-{ex['id']}", name=f"{ex['id']}.png", caption=f"완성 예제 {ex['name']} {ex['w']}×{ex['h']}칸 — build_gothic_place({{place:\"{ex['place']}\"{', variant:\"' + ex['variant'] + '\"' if ex.get('variant') else ''}, seed:1}}) 의 실제 출력(원본 해상도).", dataUrl=url))
    doors = ' '.join(f"{e['building'].split('(')[0]}({e['x']},{e['y']})" for e in (ex.get('entrances') or [])) or ' '.join(f"{d['side']}({d['x']},{d['y']})" for d in (ex.get('doorCells') or []))
    md = [f"# 완성 예제 — {ex['name']}", '', HEAD, '',
          f"입력: `build_gothic_place({{place:\"{ex['place']}\"{', variant:\"' + ex['variant'] + '\"' if ex.get('variant') else ''}, seed:1}})` → 맵 {ex['w']}×{ex['h']}칸, 시작 칸 ({ex['spawn']['x']},{ex['spawn']['y']}).",
          f"문(이동 이벤트 자리): {doors or '없음'}" + (f" · 정문 {' '.join('(%d,%d)' % (c['x'], c['y']) for c in ex['exits'])}" if ex.get('exits') else ''),
          '', '| 순서 | 키트 | x | y |', '|---|---|---|---|'] + [f"| {n + 1} | `{p['kit']}` | {p['x']} | {p['y']} |" for n, p in enumerate((ex.get('placed') or [])[:80])]
    md += ['', f"구조 검사(`gm-check`): {'문제 0건' if not probs else '; '.join(f'{c_} ({x},{y}) {d}' for c_, x, y, d in probs[:12])}"]
    for k, nm in zip(LAYERS, ('1층 lowerTiles', '2층 lowerOverlayTiles', '3층 upperTiles', '4층 upperOverlayTiles')):
        if any(v >= 0 for v in ex[k]): md += ['', f'## {nm}(행 우선)', arr_md(ex[k], ex['w'])]
    md += ['', f"그림: `gm-img-{ex['id']}`"]
    cb['documents'].append(dict(id=f"gm-ex-{ex['id'].replace('gm-place-', '')}", name=f"완성 예제 · {ex['name']}", markdown='\n'.join(md)))
    if ex['id'] not in ERR_FOR: continue
    em = ['# 정상/오류 — ' + ex['name'], '', HEAD, '', '정상 예제에서 **한 가지만** 틀리게 바꾼 실제 배열을 같은 검사로 돌린 결과다. 빨강 테두리 = 검사가 짚은 칸(맵 좌표 0 기준).', '',
          '| 변조 | 오류 코드 | 좌표 | 그림 |', '|---|---|---|---|']
    for n, (nm, e2) in enumerate(mutations(ex)):
        pr = [p for p in check_map(e2) if p not in probs]
        name = f"{ex['id']}-err{n + 1}.png"
        both = Image.new('RGBA', (img.width * 2 + 8, img.height), (40, 38, 46, 255))
        both.alpha_composite(img, (0, 0)); both.alpha_composite(render(e2, [(x, y) for _, x, y, _ in pr]), (img.width + 8, 0))
        cb['images'].append(dict(id=f"gm-img-{ex['id']}-err{n + 1}", name=name, caption=f'왼쪽 정상 · 오른쪽 오류({nm}). 빨강 = 검사가 짚은 칸.', dataUrl=save(name, both)))
        em.append(f"| {nm} | {', '.join(sorted({p[0] for p in pr})) or '(검사 못 잡음 — 범위 밖)'} | {' '.join(f'({x},{y})' for _, x, y, _ in pr[:6])} | `gm-img-{ex['id']}-err{n + 1}` |")
    cb['documents'].append(dict(id=f"gm-err-{ex['id'].replace('gm-place-', '')}", name=f"정상/오류 · {ex['name']}", markdown='\n'.join(em)))

# 3) 조각 묶음
for g, kits in by_group.items():
    if not kits: continue
    title = GROUPS[g][0]
    c = cat(f'gm-kits-{g}', f'고딕 저택 · {title}', f'{title} 조각 {len(kits)}종의 정확한 사전(칸 배열·통행·출입 칸)과 시트에서 다시 조립한 그림.')
    for i in range(0, len(kits), 40):
        c['documents'].append(dict(id=f'gm-{g}-dict-{i // 40 + 1}', name=f'{title} · 조각 사전 {i // 40 + 1}', markdown=dict_doc(title, kits[i:i + 40])))
    for i in range(0, len(kits), 60):
        c['images'].append(dict(id=f'gm-img-{g}-kits-{i // 60 + 1}', name=f'{g}-kits-{i // 60 + 1}.png', caption=f'{title} 키트 그림(원본 해상도, 시트에서 다시 조립한 실제 출력). 이름표는 id 의 gm- 뒤.',
                                dataUrl=gallery(kits[i:i + 60], f'{g}-kits-{i // 60 + 1}.png')))

# 4) 움직임
ce = cat('gm-effects', '고딕 저택 · 움직이는 칸(애니메이션)', f"animationStrips {len(DATA['animationStrips'])}개 — baseTile 부터 가로 연속 프레임.")
el = ['# 움직이는 칸', '', HEAD, '', '맵에는 **baseTile 번호만** 칠한다(엔진이 frames 개 연속 칸을 fps 로 돌린다). 프레임 칸 번호를 따로 칠하지 않는다. 키트로 찍으면 저절로 baseTile 이 들어간다.', '', '| baseTile | frames | fps | 이름 |', '|---|---|---|---|']
for st in DATA['animationStrips']:
    el.append(f"| {st['baseTile']} | {st['frames']} | {st['fps']} | {DATA['tileMeta'][st['baseTile']].get('label', '')} |")
ce['documents'].append(dict(id='gm-fx-strips', name='움직이는 칸 표', markdown='\n'.join(el)))

# 5) 검사 범위
ck = cat('gm-check', '고딕 저택 · 자동 검사 범위·층 정정', '구조 검사가 보는 것과 보지 않는 것, 층 정보 정정 기준.')
ck['documents'].append(dict(id='gm-check-scope', name='자동 검사 범위', markdown='\n'.join([
    '# 자동 검사 범위', '', HEAD, '',
    '| 코드 | 뜻 | 판정 근거 |', '|---|---|---|',
    '| `GM-LAYER` | 위층 홈 칸이 1층에, 또는 아래층 땅 칸이 3층에 있다 | 칸의 priority·tileMeta(엔진 tileLayerHome 과 같은 식) |',
    '| `GM-CUT` | 키트 칸이 맵 밖으로 잘렸다 | 배치 좌표 + 키트 크기 |',
    '| `GM-OVERLAP` | 막힌 기물 칸을 다른 막힌 기물이 덮었다 | 키트 upperTiles 통행 |',
    '| `GM-DOOR-BLOCKED` | 건물 문 앞 접근칸(`출입:`)·실내 문 안쪽 칸이 막혔다 | 그 칸 네 층 통행 |',
    '| `GM-ISLAND` | 걸을 수 있는 칸이 여러 덩이로 갈렸다 | 네 층 통행으로 4방향 연결 덩이를 센다 |',
    '', '보지 않는 것: 이벤트 실행, 미적 품질, 모델의 성공률. 검사 통과를 그런 성공으로 주장하지 않는다. build_gothic_place 는 같은 통행 검사를 짓는 중에 돌려, 실패하면 맵을 바꾸지 않는다.',
    '', '## 층 정보 기준', '모든 칸의 층·통행은 굽기(`bake_gm.py`)가 조각의 walk 글자에서 칸마다 정했다: F→floor(1층 통행), X→solidfloor, f→flat(투명, 2층·통행), S→solid(3층 막힘), C→star(3층 ★). 그룹의 층은 선언이 아니라 멤버 칸의 엔진 홈에서 유도했다(`bake_lib.derive_group_layer`).'])))

for c in cats:
    assert len(c['documents']) <= 64 and len(c['images']) <= 256, (c['id'], len(c['documents']), len(c['images']))
    for d in c['documents']: assert len(d['markdown']) <= 120000, (d['id'], len(d['markdown']))
    for im in c['images']: assert im['dataUrl'].startswith('/assets/gothic-manor-references/'), im['id']
assert len(cats) <= 32, len(cats)
json.dump(cats, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"용도 {len(cats)} · 문서 {sum(len(c['documents']) for c in cats)} · 그림 {sum(len(c['images']) for c in cats)} → {OUT}")
for c in cats: print(' ', c['id'], len(c['documents']), len(c['images']))
