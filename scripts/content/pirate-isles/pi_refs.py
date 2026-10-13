"""pirate_isles 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 구성기 실제 출력(예제)에서 기계적으로 만든다.

  python3 scripts/content/pirate-isles/pi_refs.py        (pi_bake.py 다음에, 예제는 compose_probe.ts → tiledata/pirate-isles/examples/)

산출: src/assets/pirateIslesReferences.json (그림은 경로만 — 바이트 없음) · public/assets/pirate-isles-references/*.png (원본 해상도 또는 nearest 정수배)
용도: pi-start(입구·층·실행 순서·그룹 사전·시트) · pi-<묶음>(조각 사전·키트 그림·완성 예제·정상/오류) · pi-check(검사 범위·층 기준)
"""
import collections, json, math, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import bake_lib as BL  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = json.load(open(os.path.join(ROOT, 'src/assets/pirateIslesTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/pirate-isles/pirate-isles-chipset.png')).convert('RGBA')
EXDIR = os.path.join(ROOT, 'tiledata/pirate-isles/examples')
IMGDIR = os.path.join(ROOT, 'public/assets/pirate-isles-references')
OUT = os.path.join(ROOT, 'src/assets/pirateIslesReferences.json')
TPR, N = DATA['tilesPerRow'], DATA['count']
KITS = {k['id']: k for k in DATA['structureKits']}
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
HEAD = (f"tilesetId `pirate_isles` · 그림 `public/assets/pirate-isles/pirate-isles-chipset.png`(텍스처 `tex_pirate_isles`, **{N}칸**, 16px 칸, "
        f"시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, 한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). "
        "계열 `oprn-pirate` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·고딕·SF·실내 v5)의 칸 번호와 섞지 않는다.")
GROUPS = collections.OrderedDict([('buildings', '건물'), ('nature', '자연'), ('props', '소품'), ('boats', '배'), ('interior', '실내 가구'), ('terrain', '바닥·물·해안')])
EX_GROUP = dict(harbor='buildings', beach='nature', fort='props', wreck='boats', ship='interior', tavern='interior', hut='interior', cave='interior')
os.makedirs(IMGDIR, exist_ok=True)
for f in os.listdir(IMGDIR):
    if f.endswith('.png'): os.remove(os.path.join(IMGDIR, f))


def home(t): return BL.tile_home(DATA['priority'][t], DATA['tileMeta'][t])
def passable(t): return t < 0 or DATA['passability'][t]['up']
def is_flat(t): return t >= 0 and DATA['priority'][t] == 'lower' and DATA['tileMeta'][t].get('locked') and DATA['tileMeta'][t].get('defaultLayer') == 'upper'


def save(name, im, scale=1):
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(os.path.join(IMGDIR, name), optimize=True)
    return f'/assets/pirate-isles-references/{name}'


def render(ex, lower, l2, upper, marks=()):
    W, H = ex['w'], ex['h']
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for i in range(W * H):
        for t in (lower[i], l2[i], upper[i]):
            if t >= 0: im.alpha_composite(BL.read_cell(SHEET, t, TPR), ((i % W) * 16, (i // W) * 16))
    d = ImageDraw.Draw(im)
    for x, y in marks: d.rectangle([x * 16, y * 16, x * 16 + 15, y * 16 + 15], outline=(255, 40, 40, 255), width=2)
    return im


def arr_md(a, W):
    rows = [','.join('%d' % v for v in a[y * W:(y + 1) * W]) for y in range(len(a) // W)]
    return '```json\n[\n' + ',\n'.join('  ' + r for r in rows) + '\n]\n```'


# ───────────────────────── 구조 검사(자동 좌표 검증) ─────────────────────────
def kit_cells(pid, x0, y0):
    k = KITS.get('pi-' + pid)
    if not k: return
    for y in range(k['height']):
        for x in range(k['width']):
            lo, up = k['rows'][y]['tiles'][x], (k['rows'][y].get('upperTiles') or [-1] * k['width'])[x]
            if lo >= 0 or up >= 0: yield x0 + x, y0 + y, lo, up


def entrances(pid, x0, y0):
    k = KITS.get('pi-' + pid)
    for p in (k or {}).get('parts', []):
        if p['kind'] == 'entrance': yield x0 + p['dx'], y0 + p['dy'] + 1


def check_map(ex, place, lower, l2, upper):
    """배치·배열 기준 구조 검사 → [(코드, x, y, 설명)]. 미적 품질·이벤트 실행·모델 성공률은 보지 않는다."""
    W, H = ex['w'], ex['h']; out = []
    for i in range(W * H):
        x, y = i % W, i // W
        if lower[i] >= 0 and home(lower[i]) == 'upper' and not is_flat(lower[i]):
            out.append(('PI-LAYER', x, y, f'위층 홈 칸 {lower[i]} 이 1층(lowerTiles)에 있다'))
        if upper[i] >= 0 and home(upper[i]) == 'lower':
            out.append(('PI-LAYER', x, y, f'아래층 칸 {upper[i]} 이 3층(upperTiles)에 있다'))
        if l2[i] >= 0 and not is_flat(l2[i]):
            out.append(('PI-LAYER', x, y, f'덧그림이 아닌 칸 {l2[i]} 이 2층(lowerOverlayTiles)에 있다'))
    occ = {}
    for n, (pid, x0, y0) in enumerate(place):
        for X, Y, lo, up in kit_cells(pid, x0, y0):
            if not (0 <= X < W and 0 <= Y < H): out.append(('PI-CUT', min(max(X, 0), W - 1), min(max(Y, 0), H - 1), f'{pid} 가 맵 밖으로 잘렸다')); continue
            if up >= 0 and not is_flat(up):
                if (X, Y) in occ and occ[(X, Y)][2] != n and not passable(up) and not passable(occ[(X, Y)][1]):
                    out.append(('PI-OVERLAP', X, Y, f'{pid} 가 {occ[(X, Y)][0]} 의 막힌 칸을 덮었다'))
                occ[(X, Y)] = (pid, up, n)
    for pid, x0, y0 in place:
        for ax, ay in entrances(pid, x0, y0):
            if 0 <= ax < W and 0 <= ay < H:
                i = ay * W + ax
                if not (lower[i] >= 0 and passable(lower[i]) and passable(l2[i]) and passable(upper[i])):
                    out.append(('PI-DOOR-BLOCKED', ax, ay, f'{pid} 문 앞 접근칸이 막혔다'))
    out += islands(W, H, lower, l2, upper)
    return out


def islands(W, H, lower, l2, upper):
    ok = [lower[i] >= 0 and passable(lower[i]) and passable(l2[i]) and passable(upper[i]) for i in range(W * H)]
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
    return [('PI-ISLAND', i % W, i // W, f'갇힌 통행 주머니({sizes[comp[i]]}칸) — 주 통로와 이어지지 않는다') for i in range(W * H) if ok[i] and comp[i] != main]


def stamp_into(ex, arrs, pid, x0, y0):
    lower, l2, upper = arrs; W, H = ex['w'], ex['h']
    for X, Y, lo, up in kit_cells(pid, x0, y0):
        if not (0 <= X < W and 0 <= Y < H): continue
        i = Y * W + X
        if lo >= 0: lower[i] = lo
        if up >= 0:
            if is_flat(up): l2[i] = up
            else: upper[i] = up


def solid_kit(pid):
    k = KITS.get('pi-' + pid)
    return k and any(t >= 0 and not is_flat(t) and not passable(t) for r in k['rows'] for t in (r.get('upperTiles') or []))


def mutations(ex):
    """정상 예제에서 한 가지만 틀리게 바꾼 변조 → [(이름, 배치, 배열 변조 함수)]."""
    out = []; place = [tuple(p) for p in ex['place']]; W, H = ex['w'], ex['h']
    multi = [p for p in place if KITS.get('pi-' + p[0]) and KITS['pi-' + p[0]]['width'] >= 2 and solid_kit(p[0])]
    solids = [p for p in place if solid_kit(p[0])]
    if multi:   # 1) 같은 키트를 맵 오른쪽 끝에 하나 더 찍어 잘리게
        p = multi[len(multi) // 2]; cut = (p[0], W - 1, p[2])
        out.append(('키트가 맵 끝에서 잘림', place + [cut], lambda a, c=cut: stamp_into(ex, a, *c)))
    if len(solids) >= 2:   # 2) 가장 작은 막힌 기물을 다른 기물의 막힌 칸 위에 겹쳐 찍음
        a = solids[0]; b = min(solids[1:], key=lambda p: KITS['pi-' + p[0]]['width'] * KITS['pi-' + p[0]]['height'])
        ac = next(((X, Y) for X, Y, lo, up in kit_cells(*a) if up >= 0 and not is_flat(up) and not passable(up)), None)
        bc = next(((X - b[1], Y - b[2]) for X, Y, lo, up in kit_cells(*b) if up >= 0 and not is_flat(up) and not passable(up)), None)
        if ac and bc:
            ov = (b[0], ac[0] - bc[0], ac[1] - bc[1])
            out.append(('막힌 기물이 서로 겹침', place + [ov], lambda arr, c=ov: stamp_into(ex, arr, *c)))
    doors = [(p, e) for p in place for e in entrances(*p)]
    small = [p for p in solids if KITS['pi-' + p[0]]['width'] == 1]
    if doors and small:   # 3) 문 앞 접근칸에 막힌 기물(1칸 폭)
        (_, (ax, ay)) = doors[0]; s = small[0]; kh = KITS['pi-' + s[0]]['height']; blk = (s[0], ax, ay - kh + 1)
        out.append(('문 앞 접근칸을 기물로 막음', place + [blk], lambda arr, c=blk: stamp_into(ex, arr, *c)))
    if solids:   # 4) 위층 몸체 칸을 1층에 칠함
        p = solids[-1]
        cells = [(X, Y, up) for X, Y, lo, up in kit_cells(*p) if up >= 0 and not is_flat(up) and 0 <= X < W and 0 <= Y < H]
        if cells:
            X, Y, up = cells[0]

            def mut(arr, X=X, Y=Y, up=up):
                i = Y * W + X; arr[0][i] = up; arr[2][i] = -1
            out.append(('위층 칸을 1층에 칠함', place, mut))
    areas = [a for a in ex.get('areas', []) if a.get('door')]
    wall = next((g['variantMap']['15'] for g in DATA['autotileGroups'] if g['id'] == 'pi-at-wall-ship'), None)
    if areas and wall is not None:   # 5) 방 문 통로를 벽으로 메움 → 갇힌 주머니
        a = areas[-1]; dx, dy = a['door']['x'], a['door']['y']

        def seal(arr, dx=dx, dy=dy):
            for yy in range(dy - 1, dy + 2):
                for xx in range(dx - 2, dx + 3):
                    if 0 <= xx < W and 0 <= yy < H and arr[0][yy * W + xx] >= 0 and passable(arr[0][yy * W + xx]) and not (a['x'] <= xx < a['x'] + a['w'] and a['y'] <= yy < a['y'] + a['h']):
                        i = yy * W + xx; arr[0][i] = wall; arr[1][i] = -1; arr[2][i] = -1
        out.append((f"«{a['name']}» 문 통로를 벽으로 메움", place, seal))
    return out


# ───────────────────────── 문서 ─────────────────────────
cats = []


def cat(cid, name, desc):
    c = dict(id=cid, name=name, description=desc, documents=[], images=[]); cats.append(c); return c


def kit_line(k):
    rows = []
    for r in k['rows']:
        s = ''
        for lo, up in zip(r['tiles'], r.get('upperTiles') or [-1] * k['width']):
            if up >= 0: s += 'f' if is_flat(up) else ('C' if passable(up) else 'S')
            elif lo >= 0: s += 'F' if passable(lo) else 'X'
            else: s += '.'
        rows.append(s)
    return rows


def dict_doc(gname, kits, part):
    lines = [f"# {gname} — 조각 사전 {part} ({len(kits)}종)\n", HEAD, '',
             '각 키트는 `stamp_object({objectId:"kit:pirate_isles/<id>", x, y})` 로 왼쪽 위 원점(dx 0, dy 0)에 찍는다. `tiles` 는 1층(lowerTiles), `upperTiles` 는 위층(투명 덧그림 f 는 2층 lowerOverlayTiles, 나머지는 3층 upperTiles), -1 은 비움.',
             '통행 글자: S 막힘(3층·사람과 y 정렬) · C ★통행(3층·사람 위에 그림) · f 투명 덧그림(2층·걷기) · F 걷는 땅(1층) · X 막힌 땅(1층: 바다·벽 천장·벽 앞면·성벽 윗면) · . 비움. 문(entrance) 부위의 바로 아래 칸이 문 앞 접근칸이다.', '']
    for k in kits:
        ai = k['ai']; ent = [p for p in k.get('parts', []) if p['kind'] == 'entrance']
        lines.append(f"## `{k['id']}` — {k['name']} ({k['width']}×{k['height']}칸, {'반복' if ai.get('repeatability') == 'repeat' else '고정'}"
                     + (f", 문 (dx {ent[0]['dx']}, dy {ent[0]['dy']}) → 접근칸 (dx {ent[0]['dx']}, dy {ent[0]['dy'] + 1})" if ent else '') + ')')
        lines.append(f"{ai.get('description', '')}  \n배치: {ai.get('placementRules', '')}")
        lines.append('통행 `' + ' / '.join(kit_line(k)) + '`')
        lines.append('```json\n' + json.dumps([[r['tiles'], r.get('upperTiles') or [-1] * k['width']] for r in k['rows']], separators=(',', ':')) + '\n```')
    return '\n'.join(lines)


def gallery(kits, name):
    pad = 6; W = 820; x = y = pad; rh = 0; pos = []
    ims = [(k['id'], BL.reassemble(k, SHEET, TPR)) for k in kits]
    for kid, im in ims:
        w, h = max(im.width, 6 * len(kid)), im.height + 12
        if x + w > W: x = pad; y += rh + pad; rh = 0
        pos.append((x, y)); x += w + pad; rh = max(rh, h)
    S = Image.new('RGBA', (W, y + rh + pad), (40, 42, 52, 255)); d = ImageDraw.Draw(S)
    for (kid, im), (px, py) in zip(ims, pos):
        d.text((px, py), kid.replace('pi-', ''), fill=(220, 220, 220, 255), font=FONT); S.alpha_composite(im, (px, py + 12))
    return save(name, S)


examples = collections.defaultdict(list)
for f in sorted(os.listdir(EXDIR)):
    if f.endswith('.json'):
        e = json.load(open(os.path.join(EXDIR, f), encoding='utf-8')); examples[EX_GROUP[e['kind']]].append(e)

by_group = collections.OrderedDict((g, []) for g in GROUPS)
for k in DATA['structureKits']:
    g = next((g for g, ko in GROUPS.items() if ko in k['ai'].get('tags', [])), 'terrain')
    by_group[g].append(k)

# 1) 입구
c0 = cat('pi-start', '해적 군도 · 읽는 순서·층·실행 순서', 'pirate_isles(열대 군도·해적 항구 손 도트 번들 칩셋)를 처음 깔 때 읽는 입구: 무엇이 있고 없는지·층과 통행·구성기 실행 순서·묶음 지도·그룹 사전.')
group_rows = '\n'.join(f"| `pi-{g}` | {GROUPS[g]} | {len(by_group[g])} | {', '.join(e['id'] for e in examples.get(g, [])) or '없음'} |" for g in GROUPS)
c0['documents'].append(dict(id='pi-order', name='해적 군도 · 읽는 순서·층과 통행·실행 순서', markdown='\n'.join([
    '# 열대 군도·해적 항구 (pirate_isles) — 읽는 순서 · 층과 통행 · 실행 순서', '', HEAD, '',
    f"흰·금빛 모래 해안(젖은 모래·물거품 덩이 오토타일), 얕은 청록 바다·깊은 바다, 밀림 풀·흙길·모래길, 돌 방파제·판자 부두·요새 성벽 오토타일, 야자·활엽수·바위·산호, 오두막·수상 가옥·술집·창고·항만 사무소·선장의 집·등대·요새 문루·포대·병영·망루·노점·보물 동굴 입구·난파선, 통·상자·그물·대포·우물·횃불·보물 상자, 노 젓는 배·쪽배·고깃배·해적 범선, 배·술집·오두막·동굴 실내 가구의 **손 도트 조각**을 구운 시트다. 조립 키트 {len(DATA['structureKits'])}종 · 오토타일 {len(DATA['autotileGroups'])}세트 · 타일 그룹 {len(DATA['tileGroups'])}개. 모든 기물 조각은 3/4 탑뷰 관문(object-gate, 판정자 과반·화소 해시 영수증)을 통과했다.",
    '', '## 이 타일셋에 없는 것',
    '- 사람(해적·주민)은 타일이 아니다 — 이벤트의 캐릭터 그림(공용 Actor 칩)으로 둔다. 배는 **정지 키트**(그림 칸)이며 움직이는 탈것이 아니다.',
    '- 글자가 있는 간판·깃발은 없다(해골 깃발·그림 간판만). 움직이는 칸(animationStrips)도 아직 없다.',
    '- 로마풍 항구 도시는 버들항(beodeul_city) 칩셋이다 — 해적·열대 낱말이 없으면 그쪽으로 짓는다.',
    '', '## 맵 짓기 — 먼저 구성기', '맵 한 장은 낱칸 칠하기로 처음부터 그리지 않는다. `compose_pirate_isles_map({kind, seed, replace?})` 한 번으로 계획 → 섬·해안(오토타일) → 건물(문 앞 접근칸이 길에 닿게) → 소품(맞는 땅 위·건물과 1칸 띄움·길/문 앞/부두 금지) 순서로 짓는다. 기물은 놓을 때마다 통행 검사(출발 칸에서 모든 문 앞 접근칸·부두 끝에 닿는가)를 하고, 막으면 되돌린다.',
    '| kind | 무엇 | 권장 크기 | 하한 |', '|---|---|---|---|',
    '| harbor | 해적 항구 마을: 남쪽 바다·돌 방파제·판자 부두 2~3·정박한 배·해적 범선·북쪽 집 줄·큰길·방파제 앞 창고 줄·시장 광장·등대 | 56×40 | 44×34 |',
    '| beach | 열대 섬 해변 마을: 깊은 바다로 둘러싼 섬, 모래 둘레·풀 안쪽, 모래길 두 줄과 광장(모닥불·토템), 오두막들, 부두 끝 수상 가옥 둘·쪽배 | 52×40 | 40×32 |',
    '| fort | 해안 요새: 성벽 사각(윗면+앞면 두 줄)·모퉁이 포대 탑·남벽 문루(잠긴 대문)·성벽 위 대포·안뜰 병영·망루·포탄·옆 통로 | 48×40 | 40×34 |',
    '| wreck | 난파선과 보물 동굴 섬: 작은 섬, 북쪽 보물 동굴 입구와 바위, 남쪽 해변에 박힌 난파선과 흩어진 짐, 흙길 | 46×36 | 36×30 |',
    '| ship | 배 안: 선장실(위 큰 방) + 선원 선실·주방·선창 | 36×26 | 30×22 |',
    '| tavern | 해적 술집 안: 홀(바 선반·벽난로·탁자) + 부엌·창고·뒷방 | 32×24 | 26×20 |',
    '| hut | 섬 오두막 안 방 하나 | 16×14 | 14×12 |',
    '| cave | 보물 동굴 안: 굴 입구 방 + 보물 방·굴 안쪽 | 36×28 | 30×24 |',
    '', '결과의 건물·구역 이름표(`list_map_locations`, 태그 `pirate-area`)에 문 앞 접근칸 좌표가 있다 — 거기에 이동 이벤트·NPC 를 둔다. 실내 맵은 «바깥 문 자리(이동 이벤트)» 이름표가 나가는 칸이다. 기획과 안 맞으면 seed 만 바꿔 `replace:true` 로 다시 짠다. 바깥과 안은 맵 두 장(예: wreck + cave)을 짓고 `create_transfer_pair` 로 잇는다.',
    '', '## 읽는 순서', '1. 이 문서 → 2. `pi-dict-groups`(그룹 사전) → 3. 만들 맵의 묶음 `pi-<묶음>`(조각 사전 → 완성 예제 → 정상/오류) → 4. 바닥·물·해안은 `pi-terrain` → 5. 검사 범위는 `pi-check`.',
    '', '## 층과 통행(칸 단위 엔진 판정)', '| 칸 종류 | 홈 층 | 걷기 | 그림 순서 |', '|---|---|---|---|',
    '| F 불투명 땅(모래·풀·길·포석·부두·실내 바닥) | 1층 lowerTiles | 걷는다 | 맨 아래 |', '| X 막힌 땅(바다·벽 천장·벽 앞면·성벽 윗면) | 1층 | 막힘 | 맨 아래 |',
    '| f 투명 덧그림(밧줄 사리·그물 더미·금화·꽃밭·조개·러그) | 2층 lowerOverlayTiles(잠김·위 붓 홈) | 걷는다 | 땅 위·사람 밑 |',
    '| S 몸체 | 3층 upperTiles | 막힘 | 사람과 y 정렬 |', '| C ★ 윗부분(지붕·야자 잎·돛·키 큰 기물 머리) | 3층 | 걷는다 | 사람 위 |',
    '', '## 손으로 고칠 때의 실행 순서(야외 한 장)', '1. `create_map tilesetId:"pirate_isles"` (보는 맵이 다른 계열이면 `ask_tileset_change`).',
    '2. 바다부터: 깊은 바다 오토타일 `pi-at-deep` 로 채우고, 땅 둘레 2~4칸을 얕은 물(`pi-water`)로 — 깊은 물이 모래에 바로 닿지 않게.',
    '3. 땅: 모래 해안 오토타일 `pi-at-beach`(모래 칸 둘레에 젖은 모래·물거품이 저절로 생긴다), 안쪽 풀은 `pi-at-grass`(덩이 두께 2칸 이상). 길은 `pi-at-sandpath`(마을)·`pi-at-path`(흙길), 항구 땅은 `pi-at-quay`(남쪽이 물이면 돌벽 앞면), 부두는 `pi-at-boardwalk`(폭 2, 물 위로).',
    '4. 건물: 한 재질 땅 위에 키트로 찍는다. 문(entrance) 바로 아래 접근칸은 길과 잇고 비운다. 건물끼리·나무와 1칸 띄운다. 수상 가옥은 물 위에 두고 계단 칸 아래에 부두를 잇는다. 등대는 곶·방파제 끝.',
    '5. 소품: 짐(통·상자·자루)은 창고·부두 문 옆에 무더기로, 배·산호·물 바위는 물 위에만, 야자·풀숲은 맞는 땅에, 납작한 것(그물·밧줄·조개)은 걷는 덧그림이다. 길·문 앞·부두 통로에는 두지 않는다.',
    '6. 사람은 이벤트로. 끝나면 `check_reachability`.',
    '', '## 묶음별 용도', '| 용도 | 묶음 | 키트 | 완성 예제 |', '|---|---|---|---|', group_rows])))
gl = ['# 그룹 사전', '', HEAD, '', '| id | 이름 | 역할 | 층 | 칸 수 | 규칙 |', '|---|---|---|---|---|---|']
for g in DATA['tileGroups']:
    gl.append(f"| `{g['id']}` | {g['name']} | {g.get('role', '')} | {g.get('defaultLayer', '')} | {len(g['tileIds'])} | {(g.get('placementRules') or '')[:120]} |")
gl += ['', '## 오토타일(마스크 N1 E2 S4 W8 + 덩이(neighborhood 8)는 대각 NE16 SE32 SW64 NW128 → variantMap, 맵 밖은 이어진 것으로 본다)', '', '| id | 이름 | 층 | 변형 수 |', '|---|---|---|---|']
for a in DATA['autotileGroups']:
    gl.append(f"| `{a['id']}` | {a.get('name', '')} | {a.get('layer', 'lower')} | {a.get('neighborhood', 4)}방향 · {len(set(a['variantMap'].values()))}칸 |")
c0['documents'].append(dict(id='pi-dict-groups', name='해적 군도 · 그룹 사전', markdown='\n'.join(gl)))
c0['images'].append(dict(id='pi-img-sheet', name='sheet.png', caption=f'시트 전체(원본 해상도 {SHEET.width}×{SHEET.height}px). 번호 n 은 열 n%{TPR}, 행 n÷{TPR}.', dataUrl=save('sheet.png', SHEET)))

# 2) 묶음별
n_err = 0
for g, kits in by_group.items():
    if not kits: continue
    gname = GROUPS[g]
    c = cat(f'pi-{g}', f'해적 군도 · {gname}', f'{gname} 조각 {len(kits)}종의 정확한 사전·키트 그림·완성 예제(구성기 입력→전체 배열→원본 그림)·정상/오류 그림.')
    for i in range(0, len(kits), 30):
        c['documents'].append(dict(id=f'pi-{g}-dict-{i // 30 + 1}', name=f'{gname} · 조각 사전 {i // 30 + 1}', markdown=dict_doc(gname, kits[i:i + 30], i // 30 + 1)))
    for i in range(0, len(kits), 40):
        c['images'].append(dict(id=f'pi-img-{g}-kits-{i // 40 + 1}', name=f'{g}-kits-{i // 40 + 1}.png', caption=f'{gname} 키트 그림(원본 해상도, 시트에서 다시 조립한 실제 출력). 이름표는 id 의 pi- 뒤.',
                                dataUrl=gallery(kits[i:i + 40], f'{g}-kits-{i // 40 + 1}.png')))
    for ex in examples.get(g, []):
        place = [tuple(p) for p in ex['place']]
        lower, l2, upper = ex['lower'], ex['l2'], ex['upper']
        probs = check_map(ex, place, lower, l2, upper)
        img = render(ex, lower, l2, upper)
        c['images'].append(dict(id=f"pi-img-{ex['id']}", name=f"{ex['id']}.png", caption=f"완성 예제 {ex['name']} {ex['w']}×{ex['h']}칸 — 원본 해상도, 아래 배열을 시트로 그린 실제 출력.", dataUrl=save(f"{ex['id']}.png", img)))
        md = [f"# 완성 예제 — {ex['name']}", '', HEAD, '', ex['desc'], '', ex['summary'], '',
              f"입력: `compose_pirate_isles_map({{kind:\"{ex['kind']}\", seed:{ex['seed']}}})` · 맵 {ex['w']}×{ex['h']}칸 · 출발 칸 ({ex['spawn']['x']},{ex['spawn']['y']}).",
              '', '## 구역·건물(이름표)', '| 이름 | x | y | w | h | 문 |', '|---|---|---|---|---|---|']
        md += [f"| {a['name']} | {a['x']} | {a['y']} | {a['w']} | {a['h']} | {('(%d,%d)' % (a['door']['x'], a['door']['y'])) if a.get('door') else '—'} |" for a in ex['areas']]
        md += ['', '## 기물 배치(찍은 순서, 키트 왼쪽 위 0 기준 — id 앞에 `pi-` 를 붙인다)', '| 순서 | 키트 | x | y |', '|---|---|---|---|']
        md += [f'| {n + 1} | `pi-{p}` | {x} | {y} |' for n, (p, x, y) in enumerate(place)]
        md += ['', f"구조 검사(`pi-check`): {'문제 0건' if not probs else '; '.join(f'{c_} ({x},{y}) {d}' for c_, x, y, d in probs[:12])}",
               '', '## 1층 lowerTiles(행 우선)', arr_md(lower, ex['w']), '', '## 2층 lowerOverlayTiles', arr_md(l2, ex['w']), '', '## 3층 upperTiles', arr_md(upper, ex['w']), '', f"그림: `pi-img-{ex['id']}`"]
        c['documents'].append(dict(id=f"pi-{g}-ex-{ex['id'].replace('pi-ex-', '')}", name=f"{gname} · 완성 예제 {ex['name']}", markdown='\n'.join(md)))
        em = ['# 정상/오류 — ' + ex['name'], '', HEAD, '', '정상 예제에서 **한 가지만** 틀리게 바꾼 실제 배열을 같은 검사로 돌린 결과다. 빨강 테두리 = 검사가 짚은 칸(맵 좌표 0 기준).', '',
              '| 변조 | 오류 코드 | 좌표 | 그림 |', '|---|---|---|---|']
        for n, (nm, pl, mut) in enumerate(mutations(ex)):
            arr = [list(lower), list(l2), list(upper)]; mut(arr)
            pr = [p for p in check_map(ex, pl, *arr) if p not in probs]
            name = f"{ex['id']}-err{n + 1}.png"
            both = Image.new('RGBA', (img.width * 2 + 8, img.height), (40, 42, 52, 255))
            both.alpha_composite(img, (0, 0)); both.alpha_composite(render(ex, *arr, [(x, y) for _, x, y, _ in pr]), (img.width + 8, 0))
            c['images'].append(dict(id=f"pi-img-{ex['id']}-err{n + 1}", name=name, caption=f'왼쪽 정상 · 오른쪽 오류({nm}). 빨강 = 검사가 짚은 칸.', dataUrl=save(name, both)))
            codes = sorted({p[0] for p in pr}); n_err += 1
            em.append(f"| {nm} | {', '.join(codes) or '(검사 못 잡음 — 범위 밖)'} | {' '.join(f'({x},{y})' for _, x, y, _ in pr[:6])}{' …' if len(pr) > 6 else ''} | `pi-img-{ex['id']}-err{n + 1}` |")
        c['documents'].append(dict(id=f"pi-{g}-err-{ex['id'].replace('pi-ex-', '')}", name=f"{gname} · 정상/오류 {ex['name']}", markdown='\n'.join(em)))
        print(ex['id'], '정상 검사', len(probs), '건')

# 3) 검사 범위
ck = cat('pi-check', '해적 군도 · 자동 검사 범위·층 기준', '구조 검사가 보는 것과 보지 않는 것, 층 정보 기준.')
ck['documents'].append(dict(id='pi-check-scope', name='자동 검사 범위', markdown='\n'.join([
    '# 자동 검사 범위', '', HEAD, '',
    '| 코드 | 뜻 | 판정 근거 |', '|---|---|---|',
    '| `PI-LAYER` | 위층 홈 칸이 1층에, 아래층 칸이 3층에, 덧그림이 아닌 칸이 2층에 있다 | 칸의 priority·tileMeta(엔진 tileLayerHome 과 같은 식) |',
    '| `PI-CUT` | 키트 칸이 맵 밖으로 잘렸다 | 배치 좌표 + 키트 크기 |',
    '| `PI-OVERLAP` | 막힌 기물 칸을 다른 막힌 기물이 덮었다 | 키트 upperTiles 통행 |',
    '| `PI-ISLAND` | 걸을 수 있는 칸이 여러 덩이로 갈렸다(벽·기물이 길을 막아 못 가는 주머니) | 1·2·3층 통행으로 4방향 연결 덩이를 센다 |',
    '| `PI-DOOR-BLOCKED` | 문(entrance 부위) 바로 아래 접근칸이 막혔다 | 그 칸의 1·2·3층 통행 |',
    '', '구성기(`compose_pirate_isles_map`)는 기물을 찍을 때마다 출발 칸에서 모든 문·접근칸에 닿는지 확인하고, 닿지 않으면 그 기물을 되돌린다 — 그래서 완성 예제의 검사는 0건이다. 저장 전 실패하면 맵을 바꾸지 않는다(복제본에서 짠 뒤 반영).',
    '', '보지 않는 것: 이벤트 실행, 미적 품질, 모델의 성공률. 검사 통과를 그런 성공으로 주장하지 않는다.',
    '', '## 층 정보 기준', '모든 칸의 층·통행은 굽기(`pi_bake.py`)가 조각 종류에서 칸마다 정했다: 낱칸 바닥→floor(1층 통행), 바다·벽 천장·벽 앞면·성벽 윗면→solidfloor(1층 막힘), 투명 덧그림→flat(2층, 잠김·위 붓 홈·통행), 기물 몸체→solid(3층 막힘), 기물 윗부분→star(3층 ★). 그룹의 층은 선언이 아니라 멤버 칸의 엔진 홈에서 유도했다(`bake_lib.derive_group_layer`).'])))

for c in cats:
    assert len(c['documents']) <= 64 and len(c['images']) <= 256, (c['id'], len(c['documents']), len(c['images']))
    for d in c['documents']: assert len(d['markdown']) <= 120000, (d['id'], len(d['markdown']))
    for im in c['images']: assert im['dataUrl'].startswith('/assets/'), im['id']
assert len(cats) <= 32, len(cats)
json.dump(cats, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"용도 {len(cats)} · 문서 {sum(len(c['documents']) for c in cats)} · 그림 {sum(len(c['images']) for c in cats)} · 변조 {n_err} → {OUT}")
