"""sf_station 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 8항목을 굽기 결과(정의 JSON·시트)와 구성기 실제 출력(예제)에서 기계적으로 만든다.

  python3 scripts/content/sf-station/sf_refs.py        (sf_bake.py 다음에, 예제는 compose_probe.ts → tiledata/sf-station/examples/)

산출: src/assets/sfStationReferences.json (그림은 경로만 — 바이트 없음) · public/assets/sf-station-references/*.png (원본 해상도 또는 nearest 정수배)
용도: sf-start(입구·층·실행 순서·그룹 사전·시트) · sf-<묶음>(조각 사전·키트 그림·완성 예제·정상/오류) · sf-check(검사 범위·층 기준)
"""
import collections, json, math, os, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import bake_lib as BL  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DATA = json.load(open(os.path.join(ROOT, 'src/assets/sfStationTileset.json'), encoding='utf-8'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/sf-station/sf-station-chipset.png')).convert('RGBA')
EXDIR = os.path.join(ROOT, 'tiledata/sf-station/examples')
IMGDIR = os.path.join(ROOT, 'public/assets/sf-station-references')
OUT = os.path.join(ROOT, 'src/assets/sfStationReferences.json')
TPR, N = DATA['tilesPerRow'], DATA['count']
KITS = {k['id']: k for k in DATA['structureKits']}
FONT = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 11)
HEAD = (f"tilesetId `sf_station` · 그림 `public/assets/sf-station/sf-station-chipset.png`(텍스처 `tex_sf_station`, **{N}칸**, 16px 칸, "
        f"시트 {TPR * 16}×{math.ceil(N / TPR) * 16}px, 한 줄 **{TPR}칸** — 번호 n 의 칸은 열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). "
        "계열 `oprn-scifi` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·고딕·실내 v5)의 칸 번호와 섞지 않는다.")
GROUPS = collections.OrderedDict([('interior', '정거장 실내'), ('outdoor', '정거장·식민지 야외'), ('street', '네온 거리'), ('terrain', '바닥·벽')])
EX_GROUP = dict(station='interior', lab='interior', street='street', moonbase='outdoor')
os.makedirs(IMGDIR, exist_ok=True)
for f in os.listdir(IMGDIR):
    if f.endswith('.png'): os.remove(os.path.join(IMGDIR, f))


def home(t): return BL.tile_home(DATA['priority'][t], DATA['tileMeta'][t])
def passable(t): return t < 0 or DATA['passability'][t]['up']
def is_flat(t): return t >= 0 and DATA['priority'][t] == 'lower' and DATA['tileMeta'][t].get('locked') and DATA['tileMeta'][t].get('defaultLayer') == 'upper'


def save(name, im, scale=1):
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(os.path.join(IMGDIR, name), optimize=True)
    return f'/assets/sf-station-references/{name}'


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
    k = KITS.get('sf-' + pid)
    if not k: return
    for y in range(k['height']):
        for x in range(k['width']):
            lo, up = k['rows'][y]['tiles'][x], (k['rows'][y].get('upperTiles') or [-1] * k['width'])[x]
            if lo >= 0 or up >= 0: yield x0 + x, y0 + y, lo, up


def entrances(pid, x0, y0):
    k = KITS.get('sf-' + pid)
    for p in (k or {}).get('parts', []):
        if p['kind'] == 'entrance': yield x0 + p['dx'], y0 + p['dy'] + 1


def check_map(ex, place, lower, l2, upper):
    """배치·배열 기준 구조 검사 → [(코드, x, y, 설명)]. 미적 품질·이벤트 실행·모델 성공률은 보지 않는다."""
    W, H = ex['w'], ex['h']; out = []
    for i in range(W * H):
        x, y = i % W, i // W
        if lower[i] >= 0 and home(lower[i]) == 'upper' and not is_flat(lower[i]):
            out.append(('SF-LAYER', x, y, f'위층 홈 칸 {lower[i]} 이 1층(lowerTiles)에 있다'))
        if upper[i] >= 0 and home(upper[i]) == 'lower':
            out.append(('SF-LAYER', x, y, f'아래층 칸 {upper[i]} 이 3층(upperTiles)에 있다'))
        if l2[i] >= 0 and not is_flat(l2[i]):
            out.append(('SF-LAYER', x, y, f'덧그림이 아닌 칸 {l2[i]} 이 2층(lowerOverlayTiles)에 있다'))
    occ = {}
    for n, (pid, x0, y0) in enumerate(place):
        for X, Y, lo, up in kit_cells(pid, x0, y0):
            if not (0 <= X < W and 0 <= Y < H): out.append(('SF-CUT', min(max(X, 0), W - 1), min(max(Y, 0), H - 1), f'{pid} 가 맵 밖으로 잘렸다')); continue
            if up >= 0 and not is_flat(up):
                if (X, Y) in occ and occ[(X, Y)][2] != n and not passable(up) and not passable(occ[(X, Y)][1]):
                    out.append(('SF-OVERLAP', X, Y, f'{pid} 가 {occ[(X, Y)][0]} 의 막힌 칸을 덮었다'))
                occ[(X, Y)] = (pid, up, n)
    for pid, x0, y0 in place:
        for ax, ay in entrances(pid, x0, y0):
            if 0 <= ax < W and 0 <= ay < H:
                i = ay * W + ax
                if not (lower[i] >= 0 and passable(lower[i]) and passable(l2[i]) and passable(upper[i])):
                    out.append(('SF-DOOR-BLOCKED', ax, ay, f'{pid} 문 앞 접근칸이 막혔다'))
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
    return [('SF-ISLAND', i % W, i // W, f'갇힌 통행 주머니({sizes[comp[i]]}칸) — 주 통로와 이어지지 않는다') for i in range(W * H) if ok[i] and comp[i] != main]


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
    k = KITS.get('sf-' + pid)
    return k and any(t >= 0 and not is_flat(t) and not passable(t) for r in k['rows'] for t in (r.get('upperTiles') or []))


def mutations(ex):
    """정상 예제에서 한 가지만 틀리게 바꾼 변조 → [(이름, 배치, 배열 변조 함수)]."""
    out = []; place = [tuple(p) for p in ex['place']]; W, H = ex['w'], ex['h']
    multi = [p for p in place if KITS.get('sf-' + p[0]) and KITS['sf-' + p[0]]['width'] >= 2 and solid_kit(p[0])]
    solids = [p for p in place if solid_kit(p[0])]
    if multi:   # 1) 같은 키트를 맵 오른쪽 끝에 하나 더 찍어 잘리게
        p = multi[len(multi) // 2]; cut = (p[0], W - 1, p[2])
        out.append(('키트가 맵 끝에서 잘림', place + [cut], lambda a, c=cut: stamp_into(ex, a, *c)))
    if len(solids) >= 2:   # 2) 가장 작은 막힌 기물을 다른 기물의 막힌 칸 위에 겹쳐 찍음
        a = solids[0]; b = min(solids[1:], key=lambda p: KITS['sf-' + p[0]]['width'] * KITS['sf-' + p[0]]['height'])
        ac = next(((X, Y) for X, Y, lo, up in kit_cells(*a) if up >= 0 and not is_flat(up) and not passable(up)), None)
        bc = next(((X - b[1], Y - b[2]) for X, Y, lo, up in kit_cells(*b) if up >= 0 and not is_flat(up) and not passable(up)), None)
        if ac and bc:
            ov = (b[0], ac[0] - bc[0], ac[1] - bc[1])
            out.append(('막힌 기물이 서로 겹침', place + [ov], lambda arr, c=ov: stamp_into(ex, arr, *c)))
    doors = [(p, e) for p in place for e in entrances(*p)]
    small = [p for p in solids if KITS['sf-' + p[0]]['width'] == 1]
    if doors and small:   # 3) 문 앞 접근칸에 막힌 기물(1칸 폭)
        (_, (ax, ay)) = doors[0]; s = small[0]; kh = KITS['sf-' + s[0]]['height']; blk = (s[0], ax, ay - kh + 1)
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
    wall = next((g['variantMap']['15'] for g in DATA['autotileGroups'] if g['id'] == 'sf-at-wall-hull'), None)
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
             '각 키트는 `stamp_object({objectId:"kit:sf_station/<id>", x, y})` 로 왼쪽 위 원점(dx 0, dy 0)에 찍는다. `tiles` 는 1층(lowerTiles), `upperTiles` 는 위층(투명 덧그림 f 는 2층 lowerOverlayTiles, 나머지는 3층 upperTiles), -1 은 비움.',
             '통행 글자: S 막힘(3층·사람과 y 정렬) · C ★통행(3층·사람 위에 그림) · f 투명 덧그림(2층·걷기) · F 걷는 땅(1층) · X 막힌 땅(1층: 벽 천장·벽 앞면·우주 공허) · . 비움. 문(entrance) 부위의 바로 아래 칸이 문 앞 접근칸이다.', '']
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
        d.text((px, py), kid.replace('sf-', ''), fill=(220, 220, 220, 255), font=FONT); S.alpha_composite(im, (px, py + 12))
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
c0 = cat('sf-start', 'SF 정거장 · 읽는 순서·층·실행 순서', 'sf_station(우주 정거장·연구 기지·달 기지·사이버펑크 네온 거리 손 도트 번들 칩셋)을 처음 깔 때 읽는 입구: 무엇이 있고 없는지·층과 통행·구성기 실행 순서·묶음 지도·그룹 사전.')
group_rows = '\n'.join(f"| `sf-{g}` | {GROUPS[g]} | {len(by_group[g])} | {', '.join(e['id'] for e in examples.get(g, [])) or '없음'} |" for g in GROUPS)
c0['documents'].append(dict(id='sf-order', name='SF 정거장 · 읽는 순서·층과 통행·실행 순서', markdown='\n'.join([
    '# SF 정거장·네온 거리 (sf_station) — 읽는 순서 · 층과 통행 · 실행 순서', '', HEAD, '',
    f"우주 정거장 실내(로비·거주 선실·식당·위생실·실험실·의무실·냉동 수면실·서버실·수경 재배실), 달·식민지 야외(돔·모듈·관제탑·착륙장·셔틀·로버·태양광), 사이버펑크 네온 거리(고층 네온 빌딩·가게·호버카·노점·광고판), 바닥·벽 오토타일의 **손 도트 조각**을 굽은 시트다. 조립 키트 {len(DATA['structureKits'])}종 · 오토타일 {len(DATA['autotileGroups'])}세트 · 타일 그룹 {len(DATA['tileGroups'])}개. 모든 기물 조각은 3/4 탑뷰 관문(object-gate, 판정자 과반·화소 해시 영수증)을 통과했다.",
    '', '## 이 타일셋에 없는 것',
    '- 사람·로봇 인물은 타일이 아니다 — 이벤트의 캐릭터 그림(공용 Actor 칩)으로 둔다. 호버카·셔틀·로버는 **정지 키트**(그림 칸)이며 움직이는 탈것이 아니다.',
    '- 글자·상표가 있는 간판은 없다(네온은 무늬·화살표만). 움직이는 칸(animationStrips)도 아직 없다.',
    '- 계단·층 이동 칸은 없다 — 층은 맵을 나누고 엘리베이터 문(`sf-elevator-door`)에 이동 이벤트를 단다.',
    '', '## 맵 짓기 — 먼저 구성기', '맵 한 장은 낱칸 칠하기로 처음부터 그리지 않는다. `compose_sf_station_map({kind, seed, replace?})` 한 번으로 벽 천장·벽 앞면·문 통로·바닥·기물을 짓는다(기물은 놓을 때마다 통행 검사 — 문·시작 칸에 닿지 않으면 되돌린다).',
    '| kind | 무엇 | 권장 크기 | 하한 |', '|---|---|---|---|',
    '| station | 우주 정거장 로비(전망창 벽) + 복도 + 거주 선실·식당·위생실 | 44×32 | 34×26 |',
    '| lab | 연구 기지 실내: 실험실 + 복도 + 의무실·냉동 수면실·서버실·수경 재배실·창고 | 40×30 | 32×24 |',
    '| street | 사이버펑크 네온 거리: 북쪽 고층·가게 줄, 보도, 4줄 도로·횡단보도·호버카, 광장 노점, 남쪽 가게 줄 | 48×30 | 36×26 |',
    '| moonbase | 달 기지 야외: 레골리스·다져진 길·돔·모듈·관제탑·착륙장·셔틀·로버·태양광 | 48×32 | 36×26 |',
    '', '결과의 구역·건물 이름표(`list_map_locations`, 태그 `sf-area`)에 문 좌표가 있다 — 문 앞 접근칸에 이동 이벤트·NPC 를 둔다. 기획과 안 맞으면 seed 만 바꿔 `replace:true` 로 다시 짠다. «달 기지 연구소»처럼 바깥과 안을 함께 말하면 moonbase + lab 두 장을 짓고 `create_transfer_pair` 로 잇는다.',
    '', '## 읽는 순서', '1. 이 문서 → 2. `sf-dict-groups`(그룹 사전) → 3. 만들 맵의 묶음 `sf-<묶음>`(조각 사전 → 완성 예제 → 정상/오류) → 4. 바닥·벽은 `sf-terrain` → 5. 검사 범위는 `sf-check`.',
    '', '## 층과 통행(칸 단위 엔진 판정)', '| 칸 종류 | 홈 층 | 걷기 | 그림 순서 |', '|---|---|---|---|',
    '| F 불투명 땅(갑판·레골리스·보도·도로) | 1층 lowerTiles | 걷는다 | 맨 아래 |', '| X 막힌 땅(벽 천장·벽 앞면·우주 공허) | 1층 | 막힘 | 맨 아래 |',
    '| f 투명 덧그림(차선·얼룩·러그 일부) | 2층 lowerOverlayTiles(잠김·위 붓 홈) | 걷는다 | 땅 위·사람 밑 |',
    '| S 몸체 | 3층 upperTiles | 막힘 | 사람과 y 정렬 |', '| C ★ 윗부분(지붕 처마·간판 윗단·키 큰 기물 머리) | 3층 | 걷는다 | 사람 위 |',
    '', '## 손으로 고칠 때의 실행 순서(실내 방 하나)', '1. `create_map tilesetId:"sf_station"` (보는 맵이 다른 계열이면 `ask_tileset_change`).',
    '2. 맵 전체를 벽 천장 오토타일 `sf-at-wall-hull`(흰 연구동은 `sf-at-wall-white`)로 채우고, 방 안을 바닥 그룹(`sf:floor:deck-plate`·`lab-floor`·`crew-floor`…)으로 판다.',
    '3. 판 방의 북쪽 바로 아래 2줄을 벽 앞면(`sf:floor:wall-face-hull`/`-white`, 전망창은 `-viewport`)으로 칠한다 — 천장(위에서 본 벽 윗면) 밑에 앞면이 있어야 3/4 로 보인다.',
    '4. 문: 벽 천장을 2칸 폭으로 남북으로 뚫어 통로를 내고(바닥 `deck-hazard`), 뒷벽 앞면에 `sf-elevator-door`·`sf-airlock-inner` 를 얹는다(문 바로 아래 바닥 칸 = 접근칸, 비운다).',
    '5. 기물: 뒷벽에서 앞(남) 순서로 찍는다. 막힌 칸끼리 겹치지 않게, 문 앞 접근칸과 통로는 비운다. 벽걸이(`wall-screen-*`·`porthole-*`·`wall-lamp`)는 벽 앞면 줄에만.',
    '6. 사람은 이벤트로. 끝나면 `check_reachability`.',
    '', '## 묶음별 용도', '| 용도 | 묶음 | 키트 | 완성 예제 |', '|---|---|---|---|', group_rows])))
gl = ['# 그룹 사전', '', HEAD, '', '| id | 이름 | 역할 | 층 | 칸 수 | 규칙 |', '|---|---|---|---|---|---|']
for g in DATA['tileGroups']:
    gl.append(f"| `{g['id']}` | {g['name']} | {g.get('role', '')} | {g.get('defaultLayer', '')} | {len(g['tileIds'])} | {(g.get('placementRules') or '')[:120]} |")
gl += ['', '## 오토타일(4방향 마스크 N1 E2 S4 W8 → variantMap, 맵 밖은 이어진 것으로 본다)', '', '| id | 이름 | 층 | 변형 수 |', '|---|---|---|---|']
for a in DATA['autotileGroups']:
    gl.append(f"| `{a['id']}` | {a.get('name', '')} | {a.get('layer', 'lower')} | {len(a['variantMap'])} |")
c0['documents'].append(dict(id='sf-dict-groups', name='SF 정거장 · 그룹 사전', markdown='\n'.join(gl)))
c0['images'].append(dict(id='sf-img-sheet', name='sheet.png', caption=f'시트 전체(원본 해상도 {SHEET.width}×{SHEET.height}px). 번호 n 은 열 n%{TPR}, 행 n÷{TPR}.', dataUrl=save('sheet.png', SHEET)))

# 2) 묶음별
n_err = 0
for g, kits in by_group.items():
    if not kits: continue
    gname = GROUPS[g]
    c = cat(f'sf-{g}', f'SF 정거장 · {gname}', f'{gname} 조각 {len(kits)}종의 정확한 사전·키트 그림·완성 예제(구성기 입력→전체 배열→원본 그림)·정상/오류 그림.')
    for i in range(0, len(kits), 30):
        c['documents'].append(dict(id=f'sf-{g}-dict-{i // 30 + 1}', name=f'{gname} · 조각 사전 {i // 30 + 1}', markdown=dict_doc(gname, kits[i:i + 30], i // 30 + 1)))
    for i in range(0, len(kits), 40):
        c['images'].append(dict(id=f'sf-img-{g}-kits-{i // 40 + 1}', name=f'{g}-kits-{i // 40 + 1}.png', caption=f'{gname} 키트 그림(원본 해상도, 시트에서 다시 조립한 실제 출력). 이름표는 id 의 sf- 뒤.',
                                dataUrl=gallery(kits[i:i + 40], f'{g}-kits-{i // 40 + 1}.png')))
    for ex in examples.get(g, []):
        place = [tuple(p) for p in ex['place']]
        lower, l2, upper = ex['lower'], ex['l2'], ex['upper']
        probs = check_map(ex, place, lower, l2, upper)
        img = render(ex, lower, l2, upper)
        c['images'].append(dict(id=f"sf-img-{ex['id']}", name=f"{ex['id']}.png", caption=f"완성 예제 {ex['name']} {ex['w']}×{ex['h']}칸 — 원본 해상도, 아래 배열을 시트로 그린 실제 출력.", dataUrl=save(f"{ex['id']}.png", img)))
        md = [f"# 완성 예제 — {ex['name']}", '', HEAD, '', ex['desc'], '', ex['summary'], '',
              f"입력: `compose_sf_station_map({{kind:\"{ex['kind']}\", seed:{ex['seed']}}})` · 맵 {ex['w']}×{ex['h']}칸 · 출발 칸 ({ex['spawn']['x']},{ex['spawn']['y']}).",
              '', '## 구역·건물(이름표)', '| 이름 | x | y | w | h | 문 |', '|---|---|---|---|---|---|']
        md += [f"| {a['name']} | {a['x']} | {a['y']} | {a['w']} | {a['h']} | {('(%d,%d)' % (a['door']['x'], a['door']['y'])) if a.get('door') else '—'} |" for a in ex['areas']]
        md += ['', '## 기물 배치(찍은 순서, 키트 왼쪽 위 0 기준 — id 앞에 `sf-` 를 붙인다)', '| 순서 | 키트 | x | y |', '|---|---|---|---|']
        md += [f'| {n + 1} | `sf-{p}` | {x} | {y} |' for n, (p, x, y) in enumerate(place)]
        md += ['', f"구조 검사(`sf-check`): {'문제 0건' if not probs else '; '.join(f'{c_} ({x},{y}) {d}' for c_, x, y, d in probs[:12])}",
               '', '## 1층 lowerTiles(행 우선)', arr_md(lower, ex['w']), '', '## 2층 lowerOverlayTiles', arr_md(l2, ex['w']), '', '## 3층 upperTiles', arr_md(upper, ex['w']), '', f"그림: `sf-img-{ex['id']}`"]
        c['documents'].append(dict(id=f"sf-{g}-ex-{ex['id'].replace('sf-ex-', '')}", name=f"{gname} · 완성 예제 {ex['name']}", markdown='\n'.join(md)))
        em = ['# 정상/오류 — ' + ex['name'], '', HEAD, '', '정상 예제에서 **한 가지만** 틀리게 바꾼 실제 배열을 같은 검사로 돌린 결과다. 빨강 테두리 = 검사가 짚은 칸(맵 좌표 0 기준).', '',
              '| 변조 | 오류 코드 | 좌표 | 그림 |', '|---|---|---|---|']
        for n, (nm, pl, mut) in enumerate(mutations(ex)):
            arr = [list(lower), list(l2), list(upper)]; mut(arr)
            pr = [p for p in check_map(ex, pl, *arr) if p not in probs]
            name = f"{ex['id']}-err{n + 1}.png"
            both = Image.new('RGBA', (img.width * 2 + 8, img.height), (40, 42, 52, 255))
            both.alpha_composite(img, (0, 0)); both.alpha_composite(render(ex, *arr, [(x, y) for _, x, y, _ in pr]), (img.width + 8, 0))
            c['images'].append(dict(id=f"sf-img-{ex['id']}-err{n + 1}", name=name, caption=f'왼쪽 정상 · 오른쪽 오류({nm}). 빨강 = 검사가 짚은 칸.', dataUrl=save(name, both)))
            codes = sorted({p[0] for p in pr}); n_err += 1
            em.append(f"| {nm} | {', '.join(codes) or '(검사 못 잡음 — 범위 밖)'} | {' '.join(f'({x},{y})' for _, x, y, _ in pr[:6])}{' …' if len(pr) > 6 else ''} | `sf-img-{ex['id']}-err{n + 1}` |")
        c['documents'].append(dict(id=f"sf-{g}-err-{ex['id'].replace('sf-ex-', '')}", name=f"{gname} · 정상/오류 {ex['name']}", markdown='\n'.join(em)))
        print(ex['id'], '정상 검사', len(probs), '건')

# 3) 검사 범위
ck = cat('sf-check', 'SF 정거장 · 자동 검사 범위·층 기준', '구조 검사가 보는 것과 보지 않는 것, 층 정보 기준.')
ck['documents'].append(dict(id='sf-check-scope', name='자동 검사 범위', markdown='\n'.join([
    '# 자동 검사 범위', '', HEAD, '',
    '| 코드 | 뜻 | 판정 근거 |', '|---|---|---|',
    '| `SF-LAYER` | 위층 홈 칸이 1층에, 아래층 칸이 3층에, 덧그림이 아닌 칸이 2층에 있다 | 칸의 priority·tileMeta(엔진 tileLayerHome 과 같은 식) |',
    '| `SF-CUT` | 키트 칸이 맵 밖으로 잘렸다 | 배치 좌표 + 키트 크기 |',
    '| `SF-OVERLAP` | 막힌 기물 칸을 다른 막힌 기물이 덮었다 | 키트 upperTiles 통행 |',
    '| `SF-ISLAND` | 걸을 수 있는 칸이 여러 덩이로 갈렸다(벽·기물이 길을 막아 못 가는 주머니) | 1·2·3층 통행으로 4방향 연결 덩이를 센다 |',
    '| `SF-DOOR-BLOCKED` | 문(entrance 부위) 바로 아래 접근칸이 막혔다 | 그 칸의 1·2·3층 통행 |',
    '', '구성기(`compose_sf_station_map`)는 기물을 찍을 때마다 출발 칸에서 모든 문·접근칸에 닿는지 확인하고, 닿지 않으면 그 기물을 되돌린다 — 그래서 완성 예제의 검사는 0건이다. 저장 전 실패하면 맵을 바꾸지 않는다(복제본에서 짠 뒤 반영).',
    '', '보지 않는 것: 이벤트 실행, 미적 품질, 모델의 성공률. 검사 통과를 그런 성공으로 주장하지 않는다.',
    '', '## 층 정보 기준', '모든 칸의 층·통행은 굽기(`sf_bake.py`)가 조각 종류에서 칸마다 정했다: 낱칸 바닥→floor(1층 통행), 벽 천장·벽 앞면·우주 공허→solidfloor(1층 막힘), 투명 덧그림→flat(2층, 잠김·위 붓 홈·통행), 기물 몸체→solid(3층 막힘), 기물 윗부분→star(3층 ★). 그룹의 층은 선언이 아니라 멤버 칸의 엔진 홈에서 유도했다(`bake_lib.derive_group_layer`).'])))

for c in cats:
    assert len(c['documents']) <= 64 and len(c['images']) <= 256, (c['id'], len(c['documents']), len(c['images']))
    for d in c['documents']: assert len(d['markdown']) <= 120000, (d['id'], len(d['markdown']))
    for im in c['images']: assert im['dataUrl'].startswith('/assets/'), im['id']
assert len(cats) <= 32, len(cats)
json.dump(cats, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"용도 {len(cats)} · 문서 {sum(len(c['documents']) for c in cats)} · 그림 {sum(len(c['images']) for c in cats)} · 변조 {n_err} → {OUT}")
