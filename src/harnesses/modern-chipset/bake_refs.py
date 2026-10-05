#!/usr/bin/env python3
"""modern_city 참고문서(AI-REFERENCE-CONTRACT 8항목) 굽기 — 번들이 소유한다.

  python3 src/harnesses/modern-chipset/bake_refs.py [--seed 1]      (bake_tileset.py → bake_map.py 다음에)

입력  src/assets/modernCityTileset.json · public/assets/modern-city/modern-city-chipset.png · tiledata/modern-city/{kit-index,bake-report}.json
      tiledata/modern-city/map/modern-city-<seed>{,-plan,-report}.json (예제 도시, bake_map.py 가 만든다)
출력  src/assets/modernCityReferences.json            TilesetReferenceCategory[] (분류 id 접두 `mc-`, 그림은 경로 문자열만)
      public/assets/modern-city-references/*.png      그림(긴 변 ≤ 820px, ≤128색, nearest-neighbor 확대만)
      tiledata/modern-city/refs/*.md                  같은 쪽의 출처 사본 + check-evidence.json(변조 검출 기록)
문서의 키트 id·칸 번호·좌표는 전부 정의 JSON·키트 색인·예제 맵에서 읽은 것이다(손으로 쓴 값 금지). 쓰기 전에 문서를 다시 파싱해
정의에 없는 키트 id·범위 밖 칸 번호·키트 배열 불일치가 하나라도 있으면 실패한다. 그림은 시트·키트에서 직접 렌더한다(AI 모형 없음).
"""
import argparse, collections, json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bake_map as BM            # noqa: E402
import compose_town as CT        # noqa: E402

ROOT = BM.ROOT
T = 16
PFX = 'mc-'
IMG_DIR = os.path.join(ROOT, 'public/assets/modern-city-references')
IMG_URL = '/assets/modern-city-references'
MD_DIR = os.path.join(ROOT, 'tiledata/modern-city/refs')
OUT_JSON = os.path.join(ROOT, 'src/assets/modernCityReferences.json')
FONT = ImageFont.load_default(size=9)
FONT_S = ImageFont.load_default(size=8)
FONT_K = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', 10)   # 한글 라벨용(그림 안 글자)

S = BM.Sheet()
D = S.d
KI = S.kit_index
REPORT = json.load(open(os.path.join(ROOT, 'tiledata/modern-city/bake-report.json'), encoding='utf-8'))
COUNT, TPR, TID, TEX = D['count'], D['tilesPerRow'], D['id'], D['textureKey']
SHEET_PATH = 'public/assets/modern-city/modern-city-chipset.png'
SHEET_PX = (TPR * T, math.ceil(COUNT / TPR) * T)
LABEL = S.label_id

emitted_tiles = set()          # 문서에 적은 모든 칸 번호(검증용)
emitted_kits = set()


def tid_of(label):
    t = LABEL[label]; emitted_tiles.add(t); return t


def tnum(t):
    emitted_tiles.add(int(t)); return int(t)


def coords(t):
    return f'열 {t % TPR}·행 {t // TPR}(픽셀 {t % TPR * T},{t // TPR * T})'


# ====================================================================== 그림 도구
def checker(w, h, a=(70, 70, 78), b=(58, 58, 66), cell=8):
    im = Image.new('RGBA', (w, h), a); d = ImageDraw.Draw(im)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if (x // cell + y // cell) % 2: d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=b)
    return im


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST) if k > 1 else im


def shrink(im, side=820):
    if max(im.size) > side:
        s = side / max(im.size)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    return im


def quant(im):
    return im.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


IMAGES = collections.OrderedDict()      # 이름 → (분류, dict(id,name,caption,dataUrl))


def save_img(name, im, caption, cat):
    """cat: 이 그림이 속한 분류. 긴 변 820 초과는 만들지 않는다(호출자가 쪼갠다)."""
    assert max(im.size) <= 820, (name, im.size)
    os.makedirs(IMG_DIR, exist_ok=True)
    quant(im).save(os.path.join(IMG_DIR, f'{name}.png'), optimize=True)
    rec = dict(id=f'{PFX}img-{name}', name=f'{name}.png', caption=caption, dataUrl=f'{IMG_URL}/{name}.png')
    IMAGES[name] = (cat, rec)
    return rec['id']


def text(d, xy, s, fill=(255, 255, 255, 255), font=FONT, outline=True):
    x, y = xy
    if outline:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)): d.text((x + dx, y + dy), s, fill=(0, 0, 0, 255), font=font)
    d.text(xy, s, fill=fill, font=font)


def render_layers(lower=None, lo2=None, upper=None, up4=None, w=BM.W, h=BM.H, bg=(0, 0, 0, 255)):
    im = Image.new('RGBA', (w * T, h * T), bg)
    for layer in (lower, lo2, upper, up4):
        if layer is None: continue
        for i, t in enumerate(layer):
            if t is not None and t >= 0: im.alpha_composite(S.cell(t), ((i % w) * T, (i // w) * T))
    return im


def kit_layers(kid):
    k = S.kits[kid]
    return [t for r in k['rows'] for t in r['tiles']], [t for r in k['rows'] for t in r['upperTiles']]


def kit_render(kid, bg=None):
    k = S.kits[kid]; w, h = k['width'], k['height']
    lo, upv = kit_layers(kid)
    return render_layers(lo, None, upv, None, w, h, bg or (0, 0, 0, 0))


def shelf_pack(items, width, pad=6, label_h=12):
    """items [(label, RGBA)] → 줄 바꿈으로 채운 장들. 높이가 820 을 넘으면 새 장."""
    pages = []; cur = []; x = y = rowh = 0
    def flush():
        nonlocal cur, x, y, rowh
        if not cur: return
        im = Image.new('RGBA', (width, y + rowh + 2), (46, 46, 54, 255)); d = ImageDraw.Draw(im)
        for lab, g, px, py in cur:
            d.text((px + 1, py), lab[:30], fill=(255, 255, 255, 255), font=FONT_S)
            bg = checker(g.width, g.height); bg.alpha_composite(g); im.alpha_composite(bg, (px, py + label_h))
        pages.append(im); cur = []; x = y = rowh = 0
    for lab, g in items:
        w, h = max(g.width, 4 * len(lab[:30])) + pad, g.height + label_h + pad
        if x + w > width and x > 0: x = 0; y += rowh; rowh = 0
        if y + h > 820 and cur: flush()
        cur.append((lab, g, x, y)); x += w; rowh = max(rowh, h)
    flush()
    return pages


def md_table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '|'.join('---' for _ in head) + '|']
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)


def jfence(obj):
    """목록은 항목마다 한 줄 — 페이지가 줄 경계에서 끊기므로 항목 중간에서 잘리지 않는다(여전히 올바른 JSON)."""
    if isinstance(obj, list) and len(obj) > 1 and all(isinstance(o, (dict, list)) for o in obj):
        body = '[\n' + ',\n'.join(json.dumps(o, ensure_ascii=False, separators=(',', ':')) for o in obj) + '\n]'
    else:
        body = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    return '```json\n' + body + '\n```'


def kit_ids(kind):
    return [i for i, v in KI.items() if v['kind'] == kind]


# ====================================================================== 데이터
ap = argparse.ArgumentParser()
ap.add_argument('--seed', type=int, default=1)
ARGS = ap.parse_args()
SEED = ARGS.seed
MAP_PATH = os.path.join(ROOT, f'tiledata/modern-city/map/modern-city-{SEED}.json')
PLAN = json.load(open(MAP_PATH.replace('.json', '-plan.json'), encoding='utf-8'))
MAPJ = json.load(open(MAP_PATH, encoding='utf-8'))
MREPORT = json.load(open(MAP_PATH.replace('.json', '-report.json'), encoding='utf-8'))
MW, MH = MAPJ['width'], MAPJ['height']
ROWS0, COLS0, RW = PLAN['roads']['rows'], PLAN['roads']['cols'], PLAN['roads']['width']
CHK = BM.MapChecker(S)

HEAD = (f'tilesetId `{TID}` · 그림 `{SHEET_PATH}`(텍스처 `{TEX}`, **{COUNT}칸**, 16px 칸, 시트 {SHEET_PX[0]}×{SHEET_PX[1]}px, 한 줄 **{TPR}칸** — 번호 n 의 칸은 '
        f'열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `{D["family"]}` — 버들항(`oprn-atlas`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.')
CATS = collections.OrderedDict()      # 분류 id → dict(name, description, documents[])
MD_FILES = []


def add_doc(cat, did, name, md):
    CATS[cat]['documents'].append(dict(id=f'{PFX}{did}', name=name, markdown=md))
    MD_FILES.append((f'{did}.md', md))


def new_cat(cid, name, desc):
    CATS[f'{PFX}{cid}'] = dict(id=f'{PFX}{cid}', name=name, description=desc, documents=[])
    return f'{PFX}{cid}'


# ====================================================================== 예제 맵에서 읽은 사실 + 규칙 검증
LOW, LO2, UPR, UP4 = MAPJ['lowerTiles'], MAPJ['lowerOverlayTiles'], MAPJ['upperTiles'], MAPJ['upperOverlayTiles']
INTERS = [(c, r) for r in ROWS0 for c in COLS0]
ID = dict(asphalt=tid_of('아스팔트'), asphalt2=tid_of('아스팔트(얼룩)'), side=tid_of('보도 포석'), side2=tid_of('보도 포석(얼룩)'),
          cx_h=tid_of('횡단보도(가로 도로 위, 줄 가로)'), cx_v=tid_of('횡단보도(세로 도로 위, 줄 세로)'),
          curb_n=tid_of('연석(남쪽이 도로)'), curb_s=tid_of('연석(북쪽이 도로)'), curb_w=tid_of('연석(동쪽이 도로)'), curb_e=tid_of('연석(서쪽이 도로)'),
          cor_nw=tid_of('연석 모서리(남동쪽이 도로)'), cor_ne=tid_of('연석 모서리(남서쪽이 도로)'), cor_sw=tid_of('연석 모서리(북동쪽이 도로)'), cor_se=tid_of('연석 모서리(북서쪽이 도로)'))
GREEN = {tid_of(l) for l in BM.GREEN_LABELS}


def at(layer, x, y): return layer[y * MW + x] if 0 <= x < MW and 0 <= y < MH else None


def verify_rules():
    """문서에 적을 도로 규칙이 예제 맵과 칸 하나도 어긋나지 않는지 센다. 어긋나면 그 규칙 문장은 쓰지 못한다(실패)."""
    res = {}
    exp = {}                                   # (x,y) → 기대 칸 번호(불변 규칙이 정하는 칸)
    asph = {ID['asphalt'], ID['asphalt2']}
    for r in ROWS0:
        for c in COLS0:
            for x in range(0, MW):
                if not any(c - 1 <= x <= c + RW for c0 in COLS0 for c in [c0]):
                    exp[(x, r - 1)] = ID['curb_n']; exp[(x, r + RW)] = ID['curb_s']
    for c in COLS0:
        for r0 in ROWS0:
            pass
        for y in range(0, MH):
            if not any(r - 1 <= y <= r + RW for r in ROWS0):
                exp[(c - 1, y)] = ID['curb_w']; exp[(c + RW, y)] = ID['curb_e']
    for r in ROWS0:
        for c in COLS0:
            exp[(c - 1, r - 1)] = ID['cor_nw']; exp[(c + RW, r - 1)] = ID['cor_ne']; exp[(c - 1, r + RW)] = ID['cor_sw']; exp[(c + RW, r + RW)] = ID['cor_se']
            for y in range(r, r + RW): exp[(c - 2, y)] = ID['cx_h']; exp[(c + RW + 1, y)] = ID['cx_h']
            for x in range(c, c + RW): exp[(x, r - 2)] = ID['cx_v']; exp[(x, r + RW + 1)] = ID['cx_v']
    bad = [(p, t, at(LOW, *p)) for p, t in exp.items() if 0 <= p[0] < MW and 0 <= p[1] < MH and at(LOW, *p) != t]
    res['curb_crosswalk_rule'] = dict(cells=len(exp), mismatched=len(bad), examples=bad[:3])
    road_cells = {(x, y) for y in range(MH) for x in range(MW) if any(r <= y < r + RW for r in ROWS0) or any(c <= x < c + RW for c in COLS0)}
    badr = [(p, at(LOW, *p)) for p in road_cells if p not in exp and at(LOW, *p) not in asph]
    res['road_asphalt_rule'] = dict(cells=len(road_cells), mismatched=len(badr), examples=badr[:3])
    blots = sum(1 for p in road_cells if at(LOW, *p) == ID['asphalt2'])
    res['asphalt_blotch_pct'] = round(100 * blots / max(1, sum(1 for p in road_cells if p not in exp)), 1)
    side_cells = [(x, y) for y in range(MH) for x in range(MW) if (x, y) not in exp and (x, y) not in road_cells and at(LOW, x, y) not in GREEN]
    bads = [(p, at(LOW, *p)) for p in side_cells if at(LOW, *p) != (ID['side2'] if (p[0] + p[1] * 3) % 7 == 0 else ID['side'])]
    res['sidewalk_rule'] = dict(cells=len(side_cells), mismatched=len(bads), examples=bads[:3])
    # 정지선: 교차로마다 (c-3: 서쪽 접근 y=r..r+2), (c+RW+2: 동쪽 접근 y=r+3..r+5), (r-3: 북쪽 접근 x=c+3..c+5), (r+RW+2: 남쪽 접근 x=c..c+2) — 시작·가운데·끝
    stops = {}
    for c, r in INTERS:
        for k, part in enumerate('sme'):
            stops[(c - 3, r + k)] = tid_of(f'정지선(서쪽 접근, 세로선) {dict(s="차선 시작 칸", m="가운데 칸", e="차선 끝 칸")[part]}')
            stops[(c + RW + 2, r + 3 + k)] = tid_of(f'정지선(동쪽 접근, 세로선) {dict(s="차선 시작 칸", m="가운데 칸", e="차선 끝 칸")[part]}')
            stops[(c + 3 + k, r - 3)] = tid_of(f'정지선(북쪽 접근, 가로선) {dict(s="차선 시작 칸", m="가운데 칸", e="차선 끝 칸")[part]}')
            stops[(c + k, r + RW + 2)] = tid_of(f'정지선(남쪽 접근, 가로선) {dict(s="차선 시작 칸", m="가운데 칸", e="차선 끝 칸")[part]}')
    badst = [(p, t, at(LO2, *p)) for p, t in stops.items() if at(LO2, *p) != t]
    res['stopline_rule'] = dict(cells=len(stops), mismatched=len(badst), examples=badst[:3])
    return res, exp, stops


RULES, EXPECT_GROUND, STOPS = verify_rules()
print('rule check', {k: (v if not isinstance(v, dict) else (v['cells'], v['mismatched'])) for k, v in RULES.items()})


# ====================================================================== 분류 1 — 읽는 순서·사전
C_START = new_cat('start', '현대 도시 · 읽는 순서·사전', 'modern_city(도쿄풍 현대 도시 번들 칩셋)를 처음 깔 때 읽는 입구: 읽는 순서·층과 통행(엔진 판정)·실행 순서(도로→보도→건물→소품→차량)·땅/도로/표시/그림자 칸 번호 사전.')
PL = PLAN['placements']
BUILDS = [p for p in PL if p['kind'] == 'building']
KIND_COUNTS = REPORT['kits']['by_kind']
AUDIT = json.load(open(os.path.join(MD_DIR, 'layer-audit.json'), encoding='utf-8')) if os.path.exists(os.path.join(MD_DIR, 'layer-audit.json')) else None

# 가로 중앙선 구간(예제에서 읽음)
def runs_of(vals):
    out = []; cur = None
    for v in vals:
        if cur and v == cur[1] + 1: cur[1] = v
        else:
            if cur: out.append(tuple(cur))
            cur = [v, v]
    if cur: out.append(tuple(cur))
    return out

CENTER_IDS = set(S.group_ids['mc:marking-center'])
CENTER_H = {r: runs_of([x for x in range(MW) if LO2[(r + 2) * MW + x] in CENTER_IDS]) for r in ROWS0}
CENTER_V = {c: runs_of([y for y in range(MH) if LO2[y * MW + c + 2] in CENTER_IDS]) for c in COLS0}


for _r in ROWS0:
    _cr = CENTER_H[_r]
    for _a, _b in zip(_cr[:-1], _cr[1:]): assert any(_a[1] == c - 5 and _b[0] == c + RW + 4 for c in COLS0), ('가로 중앙선 끝 규칙', _cr)
for _c in COLS0:
    _cv = CENTER_V[_c]
    for _a, _b in zip(_cv[:-1], _cv[1:]): assert any(_a[1] == r - 5 and _b[0] == r + RW + 4 for r in ROWS0), ('세로 중앙선 끝 규칙', _cv)


def order_doc():
    r0, r1 = ROWS0[0], ROWS0[-1]; c0 = COLS0[0]
    cr = CENTER_H[r0]; cv = CENTER_V[c0]
    n_b = KIND_COUNTS['building']; n_p = KIND_COUNTS['prop']; n_v = KIND_COUNTS['vehicle']
    fam_n = len({v['source']['name'] for v in KI.values() if v['kind'] == 'building'})
    t = f"""# 현대 도시 (modern_city) — 읽는 순서 · 층과 통행 · 실행 순서

{HEAD}

modern-chipset 하네스가 합성한 도쿄풍 도시(건물·도로·소품·차량)를 16px 칸으로 자른 번들 칩셋이다. **조립은 키트 단위**다 — 건물 한 채·소품 하나·차량 하나·도로 구간 하나가
structureKit 하나(총 {REPORT['kits']['total']}종: 건물 {n_b}·소품 {n_p}·차량 {n_v}·도로 구간 {KIND_COUNTS['road']}·거리 단면 {KIND_COUNTS['street']}·횡단보도 {KIND_COUNTS['crosswalk']}·교차로 {KIND_COUNTS['junction']}).
건물 키트는 건물 {fam_n}계열 × 글자(A~C) × 벽색·지붕색 변형이다. 낱칸으로 건물을 칠하지 않는다 — 칸 번호는 같은 그림이 여러 키트에 공유되어 낱칸만 봐서는 어느 건물인지 알 수 없다.
이 칩셋에는 사람(Actor1)이 없다 — 행인·운전자는 이벤트·캐릭터의 일이다.

## 읽는 순서
1. 이 문서 → 2. `{PFX}dict-ground`(땅·도로·표시·그림자 칸 번호 사전) → 3. `{PFX}road-assembly`(도로 구간·교차로·횡단보도·오토타일) →
4. `{PFX}building-assembly`(건물 조립·겹침 순서·문 앞) + 건물 키트 사전 `{PFX}bld-<계열>`(칸 배열·문 칸·접근 칸) →
5. `{PFX}prop-rules`(소품·차량 배치 규칙) + `{PFX}dict-props`·`{PFX}dict-vehicles`(키트 사전) → 6. `{PFX}example-*`(완성 예제 도시 {MW}×{MH}: 배치 목록 + 네 층 전체 배열 + 그림) →
7. `{PFX}errors-*`(정상/오류 그림·자동 좌표 검증·레이어 정정).

## 층과 통행 (엔진 판정 — src/project/collision.ts passabilityOf · src/player/characterDepth.ts mapUpperTileDepth)
{md_table(['층','맵 칸','이 칩셋에서 싣는 것','그림 순서'], [
['1층','`lowerTiles` (모든 칸 채움, -1 금지)','땅: 아스팔트·보도·연석·횡단보도·공원 잔디·꽃밭·벽돌 포장·길·연못 물·생울타리','맨 아래'],
['2층','`lowerOverlayTiles` (선택)','투명 오버레이: 도로 표시(중앙선·정지선·화살표·맨홀·배수구)·접지 그림자','땅 위, 캐릭터 아래'],
['3층','`upperTiles`','키트 칸: 건물·소품·차량. 막힘 칸은 캐릭터와 칸 행 y 로 정렬, ★ 칸은 항상 캐릭터 위','y 정렬 / 항상 위'],
['4층','`upperOverlayTiles` (선택)','3층 칸이 이미 있는 자리에 반투명 키트 칸이 또 필요할 때만(뒤 건물 앞에 선 가로등 등)','3층 위'],
])}

- 통행: 맨 위 층(4→3→2)부터 내려가며 빈칸과 ★ 를 건너뛰고 **처음 만난 칸의 통행**이 그 칸을 정한다. 없으면 1층이 정한다. 1층이 비면 막힘.
- 키트 칸의 통행(번들이 정함): 건물 칸 전부 막힘(문 칸 포함). 소품·차량은 **발밑 줄만 막힘**, 키 큰 소품의 윗줄은 ★(통행 가능, 캐릭터 위). 땅·도로 표시·그림자는 걸을 수 있다. 물·생울타리 땅은 막힘.
- 칸 하나의 판정은 번호 사전의 `통행`·`홈`·`그림 순서` 열이다. 이 사실은 엔진 함수로 전 칸({AUDIT['checked'] if AUDIT else '?'}칸)을 대조해 어긋남 {AUDIT['mismatches'] if AUDIT else '?'}건이었다(`tiledata/modern-city/refs/layer-audit.mts`).
- 투명 여부·홈 레이어·통행·그림 순서는 서로 다른 정보다. 투명한 소품이라도 발밑 줄은 막고 윗줄만 ★ 로 비운다(규칙은 칸 단위로 이미 구워져 있다).

## 실행 순서 — 새 거리를 만들 때 (아래 숫자는 예제 도시 {MW}×{MH}에서 읽은 값이고, 예제 맵 전체와 {RULES['curb_crosswalk_rule']['cells'] + RULES['road_asphalt_rule']['cells'] + RULES['sidewalk_rule']['cells'] + RULES['stopline_rule']['cells']}칸을 규칙대로 다시 계산해 어긋남 0 을 확인했다)
1. **맵**: `tilesetId: {TID}`, 1층을 보도로 채운다. 보도 `{tnum(ID['side'])}`, 7칸에 한 칸(`(x + y*3) % 7 == 0`)만 얼룩 `{tnum(ID['side2'])}`. 공원 구역 안쪽만 공원 칸으로 바꾼다(5번).
2. **도로 격자**: 도로 폭 {RW}칸(두 차선 + 노란 이중 중앙선). 가로 도로 위 줄 y = {', '.join(str(r) for r in ROWS0)} (각각 y..y+{RW - 1}), 세로 도로 위 줄 x = {', '.join(str(c) for c in COLS0)} (x..x+{RW - 1}).
   도로 칸은 아스팔트 `{tnum(ID['asphalt'])}`, 약 {RULES['asphalt_blotch_pct']:.0f}%만 얼룩 `{tnum(ID['asphalt2'])}`을 흩는다. 한 번에 까려면 키트 `mc-street-ew-section`/`mc-street-ns-section`/`mc-intersection-12x12` (→ `{PFX}road-assembly`).
3. **연석**: 가로 도로의 북쪽 줄 y = r-1 은 `{tnum(ID['curb_n'])}`(남쪽이 도로), 남쪽 줄 y = r+{RW} 는 `{tnum(ID['curb_s'])}`(북쪽이 도로). 세로 도로의 서쪽 줄 x = c-1 은 `{tnum(ID['curb_w'])}`(동쪽이 도로), 동쪽 줄 x = c+{RW} 는 `{tnum(ID['curb_e'])}`(서쪽이 도로).
   두 도로가 만나는 구간(x = c-1..c+{RW}, y = r-1..r+{RW})은 연석 줄을 이어 깔지 않고 모서리 네 칸만: (c-1,r-1) `{tnum(ID['cor_nw'])}` · (c+{RW},r-1) `{tnum(ID['cor_ne'])}` · (c-1,r+{RW}) `{tnum(ID['cor_sw'])}` · (c+{RW},r+{RW}) `{tnum(ID['cor_se'])}`. 안/밖 방향은 이름의 「~쪽이 도로」가 도로가 있는 쪽이다. **연석은 보도 오토타일 `mc-sidewalk-curb` 가 칠하면 도로 쪽에 알아서 세운다.** 단 오토타일은 이웃이 보도·연석이 아닌 모든 칸(공원 잔디·생울타리·횡단보도 포함)을 도로로 보고 연석을 세운다 — 공원 둘레 보도는 오토타일 말고 보도 낱칸으로 깐다(예제가 그렇다).
4. **횡단보도**: 가로 도로를 건너는 것은 x = c-2 와 x = c+{RW + 1} 의 세로 {RW}칸(y = r..r+{RW - 1}) `{tnum(ID['cx_h'])}`, 세로 도로를 건너는 것은 y = r-2 와 y = r+{RW + 1} 의 가로 {RW}칸(x = c..c+{RW - 1}) `{tnum(ID['cx_v'])}`.
5. **정지선·중앙선(2층)**: 정지선은 횡단보도 바깥 한 칸 건너: 서쪽 접근 x = c-3 (y = r..r+2, 시작·가운데·끝), 동쪽 접근 x = c+{RW + 2} (y = r+3..r+{RW - 1}), 북쪽 접근 y = r-3 (x = c+3..c+{RW - 1}), 남쪽 접근 y = r+{RW + 2} (x = c..c+2). 번호는 `{PFX}dict-ground`.
   노란 이중 중앙선은 가로 도로의 y = r+2(위 줄)·r+3(아래 줄), 세로 도로의 x = c+2(왼쪽 줄)·c+3(오른쪽 줄). 구간은 **교차로·횡단보도 칸을 비우고** 그 사이만: 예제 가로 구간 x = {cr[0][0]}..{cr[0][1]} 과 x = {cr[1][0]}..{cr[1][1]}, 세로 구간 y = {cv[0][0]}..{cv[0][1]} · {cv[1][0]}..{cv[1][1]} · {cv[2][0]}..{cv[2][1]}. 구간은 칸 경계에서 끝나므로 양 끝 칸도 보통 중앙선 칸이다(끝 칸 12종은 구간을 칸 안쪽 4px 에서 끝내고 싶을 때만). **교차로 중심 {RW}×{RW}에는 중앙선을 두지 않는다.**
6. **건물(3층)**: 뒷줄(발 y 가 작은 것)부터 앞줄 순서로 키트를 찍는다. 문 앞(키트 바로 아래 한 줄)은 보도·비워 둔다. 밑변 줄 아래 앞 보도 3줄(문 앞 줄 + 2줄)이 연석까지 이어진다. (→ `{PFX}building-assembly`)
7. **소품**(3층): 가로등·신호등·전신주·가로수는 보도 연석 쪽, 자판기·쓰레기통은 건물 벽 쪽, 공원은 나무·가로등·벤치·분수. 문 앞·횡단보도 접점은 비운다. (→ `{PFX}prop-rules`)
8. **차량**(3층): 차선 가운데에 정지 그림으로. 교차로·횡단보도 위 금지. 연석 쪽 한 줄 주차는 도로 가장자리 줄.
9. **접지 그림자(2층)**: 건물 오른쪽·아래(보도 위에만), 소품 발밑. 도로 표시와 같은 2층이라 한 칸에 둘이 겹치면 표시가 이긴다(예제 규칙).
10. **검사**: 문 앞 접근 칸이 시작 위치에서 걸어서 닿는지·건물 밑변이 보도 위인지·겹침 순서·층 홈을 자동으로 센다(→ `{PFX}errors-overview`). 통과 전에는 저장하지 않는다.

## 금지 조건·최소 크기 (예제 도시를 만든 규칙 — compose_town 상수와 측정값)
- 도로 폭 {CT.RW}칸 고정. 건물 앞 보도 {CT.SW}줄. 건물 가로 {CT.MIN_W}칸 미만은 쓰지 않는다.
- 같은 건물(글자·색 변형 무시)은 한 도시에 {CT.FAM_CAP_DEFAULT}채까지, 학교·창고·백화점·은행·병원·연립주택·호텔·주차 건물은 1채까지(특수 건물 상한 {CT.KIND_CAPS}).
- 건물 뒷줄은 높이 {CT.REAR_MAX}칸, 앞줄은 {CT.DENSE_FRONT_MAX}칸까지, 한 블록에 건물 줄은 {CT.DENSE_ROWS}겹까지.
- 문 앞 접근 칸(반드시)과 그 양옆 한 칸(가급적), 횡단보도 접점, 골목 입구에는 소품·차량을 두지 않는다. 키 큰 소품 발밑이 도로·연석·횡단보도에 닿지 않는다.
- 사람·전선은 타일이 아니다. 움직이는 차·행인·문 이동 이벤트는 이 칩셋 문서의 범위 밖이다.
"""
    return t


add_doc(C_START, 'order', '현대 도시 · 읽는 순서·층과 통행·실행 순서', order_doc())


GROUP_KO = {'road': '도로 바닥', 'crosswalk': '횡단보도', 'sidewalk': '보도', 'curb': '연석', 'green': '공원 땅', 'plaza': '벽돌 포장', 'water': '연못 물', 'hedge': '생울타리',
            'marking-center': '노란 중앙선', 'marking-stop': '정지선', 'marking-arrow': '직진 화살표', 'marking-manhole': '맨홀·배수구', 'shadow': '접지 그림자'}
LAYER_USE = {'floor': '1층', 'solidfloor': '1층'}


def tile_row(t):
    m = D['tileMeta'][t]; p = D['passability'][t]
    walk = 'o 걸음' if (p['up'] and p['down'] and p['left'] and p['right']) else ('x 막힘' if not any(p.values()) else '방향별')
    g = next((g['id'] for g in D['tileGroups'] if t in g['tileIds'] and g['id'].split(':', 1)[1] in GROUP_KO), '')
    gk = GROUP_KO.get(g.split(':', 1)[1], g) if g else '빈 칸(쓰지 않는다)'
    home = m.get('defaultLayer', '-')
    use = '2층(오버레이)' if t in CHK.marking_all else '1층'
    return [tnum(t), m['label'], gk, walk, {'lower': '하위(1층)', 'upper': '상위(3층)'}.get(home, home), use, f'{t % TPR},{t // TPR}']


def dict_ground_doc():
    ids = [0] + [t for g in ('mc:road', 'mc:crosswalk', 'mc:sidewalk', 'mc:curb', 'mc:green', 'mc:plaza', 'mc:water', 'mc:hedge') for t in D['tileGroups'][[x['id'] for x in D['tileGroups']].index(g)]['tileIds']] \
        + [t for g in ('mc:marking-center', 'mc:marking-stop', 'mc:marking-arrow', 'mc:marking-manhole', 'mc:shadow') for t in S.group_ids[g]]
    ids = sorted(set(ids))
    rows = [tile_row(t) for t in ids]
    at = D['autotileGroups'][0]
    vm = at['variantMap']
    t = f"""# 현대 도시 — 땅·도로·표시·그림자 칸 번호 사전

{HEAD}

이 사전은 낱칸으로 칠하는 칸(번호 0~{max(ids)})이다. 건물·소품·차량 칸은 키트로만 찍는다(`{PFX}bld-*`·`{PFX}dict-props`·`{PFX}dict-vehicles`). 좌표 열은 시트의 열,행(0 기준)이다.
`통행` o = 네 방향 모두 걸음, x = 네 방향 막힘. `홈` = 번들이 정한 기본 층(tileMeta.defaultLayer)이고 엔진 판정과 전 칸 일치한다. **도로 표시·그림자는 투명 오버레이**라
아래 땅 위에 겹쳐야 하며 1층에 단독으로 두면 검게 보인다 — 예제는 2층(`lowerOverlayTiles`)에 둔다(홈 3층 = 같은 그림·같은 통행, 캐릭터 아래).

{md_table(['번호','이름','종류','통행','홈 레이어','예제에서 쓰는 층','시트 열,행'], rows)}

## 보도·연석 오토타일 `mc-sidewalk-curb`
이웃 4방향(N=1·E=2·S=4·W=8)에서 **보도 계열(보도·연석)이 이어진 방향의 비트를 켠다**. 이어지지 않은 방향 = 도로 쪽이라 연석이 선다. 맵 밖은 이어진 것으로 본다(`edgeConnects`).
구성원(칠하는 칸) {json.dumps(at['memberTileIds'])}, 이웃으로 치는 칸 {json.dumps(at['connectTileIds'])}.
비트 → 선택되는 칸(`variantMap`, 16칸 전부):
{jfence({str(k): tnum(v) for k, v in vm.items()})}
한계: 반대편 두 줄이 도로인 얇은 보도·세 방향이 도로인 곶은 조각이 없어 일반 보도 칸으로 떨어진다. 공원 잔디·생울타리·횡단보도 이웃도 「이어지지 않음」으로 본다 — 공원 둘레는 보도 낱칸으로 깐다.
"""
    return t


add_doc(C_START, 'dict-ground', '현대 도시 · 땅·도로·표시·그림자 칸 번호 사전', dict_ground_doc())


# ====================================================================== 그림: 칸 모음·키트
def contact_sheet(ids, cols, zoom, label_font=FONT_S, bg=(46, 46, 54, 255)):
    cell = T * zoom; pad = 3
    rows = math.ceil(len(ids) / cols)
    im = Image.new('RGBA', (cols * (cell + pad) + pad, rows * (cell + 12 + pad) + pad), bg); d = ImageDraw.Draw(im)
    for i, t in enumerate(ids):
        x = pad + (i % cols) * (cell + pad); y = pad + (i // cols) * (cell + 12 + pad)
        c = checker(cell, cell, cell=max(4, zoom * 2)); c.alpha_composite(up(S.cell(t), zoom)); im.alpha_composite(c, (x, y))
        d.text((x, y + cell), str(t), fill=(255, 255, 255, 255), font=label_font)
    return im


def kit_grid_image(kid, zoom, show_ids=True, door=True, extra_below=0, bg=None):
    """키트 한 장을 칸 격자·칸 번호와 함께. 문 칸은 빨강 테두리, 키트 바깥 한 줄 아래의 접근 칸은 초록 테두리."""
    k = S.kits[kid]; w, h = k['width'], k['height']
    base = checker(w * T, (h + 1) * T, cell=8) if door else checker(w * T, h * T, cell=8)
    sidewalk = S.cell(ID['side'])
    if door:
        for x in range(w): base.alpha_composite(sidewalk, (x * T, h * T))
    base.alpha_composite(kit_render(kid), (0, 0))
    im = up(base, zoom); d = ImageDraw.Draw(im)
    for x in range(w + 1): d.line([(x * T * zoom, 0), (x * T * zoom, im.height)], fill=(255, 255, 255, 50))
    for y in range(im.height // (T * zoom) + 1): d.line([(0, y * T * zoom), (im.width, y * T * zoom)], fill=(255, 255, 255, 50))
    if show_ids:
        for y, r in enumerate(k['rows']):
            for x, t in enumerate(r['upperTiles'] or r['tiles']):
                tt = r['upperTiles'][x] if r['upperTiles'][x] >= 0 else r['tiles'][x]
                if tt >= 0: text(d, (x * T * zoom + 2, y * T * zoom + 2), str(tt), font=FONT_S)
    if door and k.get('parts'):
        for p in k['parts']:
            if p['kind'] == 'entrance':
                d.rectangle([p['dx'] * T * zoom, p['dy'] * T * zoom, (p['dx'] + p['w']) * T * zoom - 1, (p['dy'] + 1) * T * zoom - 1], outline=(255, 60, 60, 255), width=2)
                d.rectangle([p['dx'] * T * zoom, (p['dy'] + 1) * T * zoom, (p['dx'] + p['w']) * T * zoom - 1, (p['dy'] + 2) * T * zoom - 1], outline=(60, 255, 90, 255), width=2)
    return im


def kit_lower_stamp(kids_at, w, h, base_tile=None):
    lower = [base_tile if base_tile is not None else ID['side']] * (w * h)
    for kid, ox, oy in kids_at:
        k = S.kits[kid]
        for y, r in enumerate(k['rows']):
            for x, t in enumerate(r['tiles']):
                if t >= 0 and 0 <= ox + x < w and 0 <= oy + y < h: lower[(oy + y) * w + ox + x] = t
    return lower


def road_images():
    out = {}
    # 교차로 12x12
    k = S.kits['mc-intersection-12x12']
    im = up(kit_render('mc-intersection-12x12', (0, 0, 0, 255)), 4)
    d = ImageDraw.Draw(im)
    for i in range(13): d.line([(i * 64, 0), (i * 64, 768)], fill=(255, 255, 255, 40)); d.line([(0, i * 64), (768, i * 64)], fill=(255, 255, 255, 40))
    out['road-intersection'] = (im, f'`mc-intersection-12x12`(12×12칸, 원본 16px 을 4배 nearest 확대, 원본 해상도 {12 * T}×{12 * T}). 한 번에 찍는 교차로: 바깥 보도 모서리 4칸·둥근 연석·사방 횡단보도·정지선(차선마다 시작/가운데/끝)·중심 6×6 아스팔트. 칸 번호 배열은 문서 본문.')
    # 거리 단면(가로) 반복
    lower = kit_lower_stamp([('mc-street-ew-section', x, 0) for x in range(8)], 8, 12)
    im = up(render_layers(lower, None, None, None, 8, 12, (0, 0, 0, 255)), 4)
    out['road-street-ew'] = (im, '`mc-street-ew-section`(1×12, 가로 도로 한 칸 폭 단면)을 x 방향으로 8번 이어 찍은 그림(4배 확대). 위에서부터 보도 2줄·북쪽 연석·도로 6줄(노란 이중선)·남쪽 연석·보도 2줄. 가로로 반복한다.')
    lower = kit_lower_stamp([('mc-street-ns-section', 0, y) for y in range(8)], 12, 8)
    im = up(render_layers(lower, None, None, None, 12, 8, (0, 0, 0, 255)), 4)
    out['road-street-ns'] = (im, '`mc-street-ns-section`(12×1, 세로 도로 한 줄 단면)을 y 방향으로 8번 이어 찍은 그림(4배 확대). 왼쪽부터 보도 2칸·서쪽 연석·도로 6칸(노란 이중선)·동쪽 연석·보도 2칸. 세로로 반복한다.')
    return out


def kit_street_check():
    """도로 키트만으로 예제 거리(세로 도로 + 가로 도로 둘 + 교차로 둘)를 다시 깔아 예제 맵의 땅과 칸 종류를 대조한다. 아스팔트·보도 얼룩 위치는 무작위라 같은 종류로 센다."""
    c = COLS0[0]
    at = [('mc-street-ns-section', c - 3, y) for y in range(MH)]
    for r in ROWS0: at += [('mc-street-ew-section', x, r - 3) for x in range(MW) if not (c - 3 <= x <= c + RW + 2)]
    at += [('mc-intersection-12x12', c - 3, r - 3) for r in ROWS0]
    lower = kit_lower_stamp(at, MW, MH)
    zone = {(x, y) for y in range(MH) for x in range(MW) if any(r - 3 <= y < r + RW + 3 for r in ROWS0) or c - 3 <= x < c + RW + 3}
    def cls(t):
        lab = D['tileMeta'][t]['label']
        if lab.startswith('아스팔트') or 77 <= t <= 92: return 'road'
        if lab.startswith('보도'): return 'side'
        return lab
    bad = [(x, y) for (x, y) in zone if cls(lower[y * MW + x]) != cls(LOW[y * MW + x])]
    return dict(cells=len(zone), mismatched=len(bad), examples=bad[:5])


KSC = kit_street_check()
print('kit street check', KSC)
assert KSC['mismatched'] == 0, KSC
ROAD_KITS = ['mc-road-ew-2lane', 'mc-road-ns-2lane', 'mc-street-ew-section', 'mc-street-ns-section', 'mc-crosswalk-on-ew-road', 'mc-crosswalk-on-ns-road', 'mc-intersection-6x6', 'mc-intersection-12x12']


def kit_tiles(kid, layer='tiles'):
    emitted_kits.add(kid)
    return [[tnum(t) if t >= 0 else -1 for t in r[layer]] for r in S.kits[kid]['rows']]


def road_doc():
    c, r = COLS0[0], ROWS0[0]
    rows = []
    for kid in ROAD_KITS:
        v = KI[kid]; k = S.kits[kid]
        rows.append([f'`{kid}`', v['name'], f"{k['width']}×{k['height']}", '1층(lowerTiles)', k['ai'].get('growthAxis') or '한 번에', v['cells']])
    arrays = {kid: kit_tiles(kid) for kid in ROAD_KITS}
    t = f"""# 현대 도시 — 도로 구간 조립 (직선·거리 단면·횡단보도·교차로·오토타일)

{HEAD}

도로 키트 {len(ROAD_KITS)}종은 **모두 1층(lowerTiles)** 키트이고 도로 표시(중앙선·정지선)가 아스팔트에 **구워져 있다**(번호 77~92: `mc:roadkit` 그룹). 같은 그림을 낱칸으로 깔 때는 아스팔트 `{tnum(ID['asphalt'])}` 위에 2층 표시 칸을 얹는다(`{PFX}dict-ground`).
이 단원의 기준 좌표: 도로 위 줄 가로 y = r, 세로 x = c(예제 r = {', '.join(map(str, ROWS0))}, c = {COLS0[0]}), 도로 폭 {RW}칸.

{md_table(['키트','이름','크기(칸)','층','반복','쓰는 칸 수'], rows)}

## 반복식과 원점 (좌표는 모두 키트 왼쪽 위 칸 = 원점)
- **가로 도로** 한 구간: `mc-street-ew-section`(1×12)을 원점 (x, r-3)에 놓고 x 를 1씩 올리며 반복한다. 키트 행 0·1 = 앞 보도, 행 2 = 북쪽 연석(y = r-1), 행 3~8 = 도로 {RW}줄(행 5·6 에 중앙선이 구워짐), 행 9 = 남쪽 연석(y = r+{RW}), 행 10·11 = 뒤 보도.
  구간 끝은 교차로 키트 폭(x = c-3..c+{RW + 2}) 앞에서 멈춘다 — 끝 처리는 아래 「끝 마감」.
- **세로 도로** 한 구간: `mc-street-ns-section`(12×1)을 원점 (c-3, y)에 놓고 y 를 1씩 올리며 반복한다. 키트 열 0·1 = 왼 보도, 열 2 = 서쪽 연석(x = c-1), 열 3~8 = 도로 {RW}칸(열 5·6 에 중앙선), 열 9 = 동쪽 연석(x = c+{RW}), 열 10·11 = 오른 보도.
- **교차로**: `mc-intersection-12x12` 를 원점 (c-3, r-3) 에 **한 번만** 찍는다 — 교차로 폭 12×12(보도 모서리·연석 모서리 네 칸·사방 횡단보도·정지선·중심 6×6)가 이미 들어 있다. 두 도로의 거리 단면은 이 12×12 바깥에서만 이어진다. 교차로 중심에는 중앙선이 없다.
- **횡단보도만 따로**: 가로 도로를 건너는 것 `mc-crosswalk-on-ew-road`(1×{RW}) 원점 (c-2, r) 또는 (c+{RW + 1}, r), 세로 도로를 건너는 것 `mc-crosswalk-on-ns-road`({RW}×1) 원점 (c, r-2) 또는 (c, r+{RW + 1}). 교차로 키트를 쓰면 이미 들어 있다.
- **직선 도로만**(보도 없이): `mc-road-ew-2lane`(1×{RW}) 원점 (x, r) 반복, `mc-road-ns-2lane`({RW}×1) 원점 (c, y) 반복. 연석·보도는 오토타일 `mc-sidewalk-curb` 로 칠한다.
- **끝 마감**(예제가 그렇게 했다): 중앙선은 칸 전체 폭(16px)으로 구워져 있다. 가로 도로의 중앙선은 교차로 키트 왼쪽에서 x = c-5 칸까지, 오른쪽에서 x = c+{RW + 4} 칸부터 있고 그 사이 x = c-4..c+{RW + 3}(14칸: 정지선 칸·횡단보도 칸·교차로 중심 바깥)은 중앙선이 없다.
  단면 키트를 깔고 나면 중앙선 두 칸(키트 행 5·6)을 아스팔트 낱칸 `{tnum(ID['asphalt'])}` 으로 바꿔 그 14칸을 비운다. 세로 도로도 같다(y = r-5 까지, y = r+{RW + 4} 부터).
  2층 「끝 칸」(중앙선이 칸 가장자리 4px 안에서 끝남)은 예제가 쓰지 않았다 — 칸 경계에서 끊기지 않는 구간을 만들 때만 쓴다.

## 검증 (자동)
이 키트만으로 예제 거리(세로 도로 1·가로 도로 {len(ROWS0)}·교차로 {len(ROWS0)})를 다시 깔아 예제 맵의 땅과 칸 종류(아스팔트·보도·연석 방향·횡단보도)를 {KSC['cells']}칸 대조했고 어긋남 {KSC['mismatched']}칸이었다.
같은 번호가 아닌 칸은 아스팔트·보도 얼룩(무작위) 위치뿐이다.

## 한계 (정직하게)
- 도로 폭은 {RW}칸 고정, 2차선(차선 하나 = 칸 2개 + 중앙선 2칸). 4차선·1차선·T자·곡선·로터리 키트는 없다. 필요하면 그림부터 새로 굽는다.
- 거리 단면 키트의 앞 보도는 2줄이다. 건물 앞 보도 3줄은 단면 키트 바깥에 보도 낱칸 한 줄을 더 깐다(예제 규칙).
- 오토타일 `mc-sidewalk-curb` 는 도로 쪽 연석(변 4종·모서리 4종)만 낸다. 얇은 보도(반대편 두 줄이 도로)·곶(세 방향이 도로)·공원/생울타리 이웃은 일반 보도로 떨어진다.
- 도로 표시 중 연석 주차 틱(ㄴ자)은 칸이 없다.

## 칸 번호 배열 (키트마다 전체, 행 순서 위→아래)
{chr(10).join(f"**`{kid}`** ({S.kits[kid]['width']}×{S.kits[kid]['height']})" + chr(10) + jfence(dict(kit=kid, tiles=arrays[kid])) for kid in ROAD_KITS)}
"""
    return t


C_ASM = new_cat('assemble', '현대 도시 · 조립 정답', '도로 구간·건물·소품을 조립하는 정답: 키트 id → 칸 배열, 반복식·원점, 앞줄/뒷줄 겹침 순서, 문 앞 접근 칸, 반복/고정 구분.')
add_doc(C_ASM, 'road-assembly', '현대 도시 · 도로 구간 조립(직선·교차로·횡단보도·오토타일)', road_doc())
RIMGS = road_images()
for nm, (im, cap) in RIMGS.items(): save_img(nm, im, cap, C_ASM)


# ====================================================================== 건물 조립
FAMS = collections.OrderedDict()
for _kid, _v in KI.items():
    if _v['kind'] == 'building': FAMS.setdefault(_v['source']['name'], []).append(_kid)
BLD_PLACE = {p['kit']: p for p in BUILDS}


def fam_slug(fam): return fam.replace('bld_', '').replace('_', '-')


def door_info(kid):
    v = KI[kid]; h = v['h']
    doors = v.get('doors') or []
    return [dict(cells=[d['cells'][0], d['cells'][1]], dy=h - 1) for d in doors], [[a['dx'], a['dy']] for a in v['access']]


def bld_record(kid):
    v = KI[kid]; doors, acc = door_info(kid)
    emitted_kits.add(kid)
    return dict(kit=kid, w=v['w'], h=v['h'], variant=dict(wall=v['variant'].get('wall'), roof=v['variant'].get('roof')), door=doors, access=acc, tiles=kit_tiles(kid, 'upperTiles'))


def pick_examples():
    used = [p['kit'] for p in BUILDS]
    by_area = sorted(used, key=lambda k: KI[k]['w'] * KI[k]['h'])
    small = by_area[0]; tall = max(used, key=lambda k: KI[k]['h']); mid = by_area[len(by_area) // 2]
    multi = max(used, key=lambda k: len(KI[k].get('doors') or []))
    out = []
    for k in (small, mid, tall, multi):
        if k not in out: out.append(k)
    return out


EX_KITS = pick_examples()


def overlap_pairs():
    out = []
    for i, a in enumerate(BUILDS):
        for b in BUILDS[i + 1:]:
            ax, ay = a['at']; aw, ah = a['size']; bx, by = b['at']; bw, bh = b['size']
            x0, x1, y0, y1 = max(ax, bx), min(ax + aw, bx + bw), max(ay, by), min(ay + ah, by + bh)
            if x0 < x1 and y0 < y1:
                first, later = (a, b) if a['order'] < b['order'] else (b, a)
                out.append(dict(first=first, later=later, box=(x0, y0, x1 - 1, y1 - 1)))
    return out


OVERLAPS = overlap_pairs()


def map_crop(x0, y0, w, h, layers=('lower', 'lo2', 'upper', 'up4'), zoom=2, mark_access=None, mark_cells=None, only_kits=None):
    lw = [LOW[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
    l2 = [LO2[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
    if only_kits is None:
        u3 = [UPR[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
        u4 = [UP4[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
    else:
        L = BM.Layers()
        for n, p in enumerate(PL):
            if p['kit'] in only_kits and not p.get('dropped') and p['at'] in only_kits[p['kit']]: BM.stamp_kit(S, L, p['kit'], p['at'][0], p['at'][1], n)
        u3 = [L.upper[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
        u4 = [L.up4[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
    im = render_layers(lw if 'lower' in layers else None, l2 if 'lo2' in layers else None, u3 if 'upper' in layers else None, u4 if 'up4' in layers else None, w, h, (0, 0, 0, 255))
    im = up(im, zoom); d = ImageDraw.Draw(im)
    for (cx, cy) in (mark_access or []):
        x, y = (cx - x0) * T * zoom, (cy - y0) * T * zoom
        d.rectangle([x, y, x + T * zoom - 1, y + T * zoom - 1], outline=(60, 255, 90, 255), width=2)
    for (cx, cy) in (mark_cells or []):
        x, y = (cx - x0) * T * zoom, (cy - y0) * T * zoom
        d.rectangle([x, y, x + T * zoom - 1, y + T * zoom - 1], outline=(255, 60, 60, 255), width=2)
    return im


def building_images():
    out = {}
    for n, kid in enumerate(EX_KITS):
        k = S.kits[kid]
        zoom = 4 if (k['width'] * T * 4 <= 500 and (k['height'] + 1) * T * 4 <= 800) else 3
        im = kit_grid_image(kid, zoom)
        out[f'bld-kit-{fam_slug(KI[kid]["source"]["name"])}-{KI[kid]["source"]["letter"].lower()}'] = (im, f'`{kid}`({k["width"]}×{k["height"]}칸) 키트를 {zoom}배 nearest 확대. 칸마다 3층 칸 번호, 빨강 테두리 = 문 칸(막힘), 초록 테두리 = 문 앞 접근 칸(키트 바깥 한 줄 아래, 보도).')
        if kid in BLD_PLACE:
            p = BLD_PLACE[kid]; ox, oy = p['at']; w, h = p['size']
            acc = [(ox + a[0], oy + a[1]) for a in door_info(kid)[1]]
            x0 = max(0, ox - 2); y0 = max(0, oy - 2); ww = min(MW, ox + w + 2) - x0; hh = min(MH, oy + h + 4) - y0
            im2 = map_crop(x0, y0, ww, hh, zoom=2, mark_access=acc)
            out[f'bld-map-{fam_slug(KI[kid]["source"]["name"])}-{KI[kid]["source"]["letter"].lower()}'] = (im2, f'같은 키트가 예제 도시 {MW}×{MH} 의 ({ox},{oy}) 에 놓인 모습(2배 확대, 사각 ({x0},{y0})~({x0 + ww - 1},{y0 + hh - 1})). 초록 테두리 = 문 앞 접근 칸 {acc}.')
    return out


def overlap_image():
    if not OVERLAPS: return None
    best = max(OVERLAPS, key=lambda o: (o['box'][2] - o['box'][0] + 1) * (o['box'][3] - o['box'][1] + 1))
    a, b = best['first'], best['later']
    x0 = max(0, min(a['at'][0], b['at'][0]) - 1); y0 = max(0, min(a['at'][1], b['at'][1]) - 1)
    x1 = min(MW, max(a['at'][0] + a['size'][0], b['at'][0] + b['size'][0]) + 1); y1 = min(MH, max(a['at'][1] + a['size'][1], b['at'][1] + b['size'][1]) + 1)
    w, h = x1 - x0, y1 - y0
    zoom = 2 if (w * T * 2 * 2 + 8 <= 820) else 1
    only1 = {a['kit']: [a['at']]}; only2 = {a['kit']: [a['at']], b['kit']: [b['at']]}
    i1 = map_crop(x0, y0, w, h, ('lower', 'upper'), zoom, only_kits=only1)
    i2 = map_crop(x0, y0, w, h, ('lower', 'upper'), zoom, only_kits=only2, mark_cells=[(best['box'][0], best['box'][1])])
    im = Image.new('RGBA', (i1.width * 2 + 8, i1.height), (255, 0, 255, 255)); im.alpha_composite(i1.convert('RGBA'), (0, 0)); im.alpha_composite(i2.convert('RGBA'), (i1.width + 8, 0))
    return im, best


def front_sidewalk_rows():
    """앞줄 건물 문 앞 줄(접근 줄)에서 아래로 내려가며 보도가 이어지는 줄 수의 분포(연석 전까지)."""
    out = []
    for p in BUILDS:
        acc = door_info(p['kit'])[1]
        if not acc: continue
        ax, ay = p['at'][0] + acc[0][0], p['at'][1] + acc[0][1]
        if not (ax, ay) in {tuple(c) for cells in PLAN['doors'] for c in cells}: continue          # 앞줄(문 앞이 열린) 건물만
        n = 0
        for dy in (1, -1):
            y = ay; cnt = 0
            while 0 <= y < MH and LOW[y * MW + ax] in (ID['side'], ID['side2']): cnt += 1; y += dy
            if dy == 1: down = cnt
            else: up_ = cnt
        out.append(max(down, up_))
    return collections.Counter(out)


SWROWS = front_sidewalk_rows()


def building_doc():
    L = MREPORT['layer_log']
    ov = OVERLAPS
    ov_rows = [(o['box'][3] - o['box'][1] + 1) for o in ov]
    exs = [bld_record(k) for k in EX_KITS]
    wall_n = sum(1 for v in KI.values() if v['kind'] == 'building' and v['variant'].get('wall'))
    roof_n = sum(1 for v in KI.values() if v['kind'] == 'building' and v['variant'].get('roof'))
    base_n = sum(1 for v in KI.values() if v['kind'] == 'building' and not v['variant'].get('wall') and not v['variant'].get('roof'))
    fam_rows = []
    for fam, kids in FAMS.items():
        vs = [KI[k] for k in kids]
        letters = sorted({v['source']['letter'] for v in vs}); walls = sorted({v['variant']['wall'] for v in vs if v['variant'].get('wall')}); roofs = sorted({v['variant']['roof'] for v in vs if v['variant'].get('roof')})
        base = vs[0]
        fam_rows.append([f'`{fam}`', f"`{PFX}bld-{fam_slug(fam)}`", base['name'].rsplit(' ', 1)[0] if base['name'][-1:] in 'ABC' else base['name'], f"{base['w']}×{base['h']}", ','.join(letters), len(kids), ','.join(walls) or '-', ','.join(roofs) or '-'])
    t = f"""# 현대 도시 — 건물 조립 (키트·문 앞·겹침 순서·변형)

{HEAD}

## 키트가 정하는 것
- 건물 한 채 = 키트 하나(`mc-bld-<계열>-<글자>[-<벽색>][-roof-<지붕색>]`). 칸 번호는 **3층(upperTiles)** 이고 1층은 비어 있다 — **찍는 자리의 땅(보도)을 그대로 둔다.**
- 키트 원점 = 왼쪽 위 칸. 앵커 = 왼쪽 아래 칸 = 건물 발(밑변). 건물 그림은 칸 경계에 맞춰져 있어 스냅이 없다(폭은 16의 배수, 위쪽에 투명 패딩 칸이 있을 수 있다).
- **칸 통행**: 키트의 모든 칸이 막힘(문 칸 포함, 지붕 옥상 설비 포함). 윗면까지 한 장이라 ★ 칸이 없다.
- **문**: `parts[kind: entrance]` 가 문 칸을 준다(키트 안 `dx`, `dy = 높이-1`, 폭 `w`). 문 칸 자체는 막힘이고, **문 앞 접근 칸 = 키트 바깥 한 줄 아래** (`(원점x + dx .. dx+w-1, 원점y + 높이)`). 연립처럼 문이 여럿이면 문마다 접근 칸 묶음이 있다.
  문 그림·문 앞 접근 칸·출입구 이벤트는 서로 다르다: 문 그림 = 키트 안 칸(고정), 접근 칸 = 키트 밖 보도 칸(비워 둠), 출입구(전이·상호작용) 이벤트 = 이 문서 범위 밖(예제 도시에는 이벤트가 없다).
- 반복 가능/고정: 건물 키트는 **전부 고정**(`repeatability: fixed`) — 늘리거나 가로로 이어 붙이지 않는다. 늘려도 되는 것은 도로 구간 키트뿐이다.
- 좌·우 마감 키트·안/밖 모서리 키트는 건물에 없다. 폭이 다른 건물은 다른 키트(글자 A~C)다.

## 앞줄과 뒷줄 (겹침 우선순위)
- 땅 먼저: 보도·도로는 1층에서 이미 깔렸다. 그 위 3층에 건물 키트를 **뒷줄(밑변 y 가 작은 것)부터 앞줄(밑변 y 가 큰 것) 순서로** 찍는다. 앞줄 건물의 지붕·윗부분이 뒷줄 건물의 아래쪽을 덮는다.
- 예제의 겹침은 {len(ov)}쌍(겹친 줄 수 최소 {min(ov_rows) if ov_rows else 0}·최대 {max(ov_rows) if ov_rows else 0}줄). 불투명한 앞줄 칸은 뒷줄 칸을 3층에서 덮어쓰고(예제 {L.get('overwritten_opaque', 0)}칸), 반투명한 칸(가로등·간판처럼 가장자리가 투명한 칸)은 3층이 이미 찼을 때 **4층**에 얹는다(예제 {L.get('stamped_4', 0)}칸).
- 앞줄을 먼저 찍으면 뒤 건물이 앞 건물 위로 올라온다 — 오류 `back-over-front`(→ `{PFX}errors-overview`).
- 땅 규칙: 밑변 줄의 땅 칸은 전부 보도(`{tnum(ID['side'])}`/`{tnum(ID['side2'])}`)여야 한다. 도로·연석·횡단보도·공원 위에 건물을 얹지 않는다(`building-on-nonwalk`).
- 문 앞: 앞줄 건물 문 앞 접근 칸에서 도로 쪽으로 보도가 이어지는 줄 수(예제 앞줄 {sum(SWROWS.values())}채): {', '.join(f'{k}줄 {v}채' for k, v in sorted(SWROWS.items()))}. 접근 칸 자체는 **반드시** 비운다(자동 검사 `door-access-blocked`). 접근 칸 양옆 한 칸도 가급적 비운다 — 원본 생성 규칙은 문 폭 ±8px 비움이고, 칸에 맞추는 과정에서 예제는 소품 발 8곳이 바로 옆 칸에 붙었다.

## 변형 id 규칙 (총 {len([k for k in KI if KI[k]['kind'] == 'building'])}종 = 기본 {base_n} + 벽색 변형 {wall_n} + 지붕색 변형 {roof_n})
- 기본: `mc-bld-<계열>-<글자>` (원본 벽·원본 지붕). 벽색 변형: `…-<벽색>` (벽만 바꿈, 지붕은 기본). 지붕색 변형: `…-roof-<지붕색>` (지붕만 바꿈, 벽은 기본, 색은 teal·navy·brick·sage·lgray).
- **벽색 × 지붕색 조합 키트는 없다.** 필요한 색이 사전에 없으면 가장 가까운 키트를 쓰고(그림이 달라질 수 있다) 새 조합은 시트에 구워 넣어야 한다(`bake_tileset.py`, 칸 번호는 덧붙이기 전용).
- 계열 표(건물 키트 사전 문서 `{PFX}bld-<슬러그>`에 키트마다 칸 배열·문·접근 칸):

{md_table(['계열','사전 문서','이름','크기(칸)','글자','키트 수','벽색 변형','지붕색 변형'], fam_rows)}

## 완전한 조립 예제 (예제 도시에 실제로 놓인 키트)
입력(키트 id·원점) → 3층 정답 배열 → 그림. 배열은 `tiles[행][열]`, -1 = 빈 칸(그 칸은 땅이 보인다). 문 칸은 `door.cells`(열 범위)와 `dy`, 접근 칸은 `access`(키트 원점 기준 dx,dy; dy = 높이 → 키트 바깥 한 줄 아래).
"""
    for k, rec in zip(EX_KITS, exs):
        p = BLD_PLACE.get(k)
        slug = f'{fam_slug(KI[k]["source"]["name"])}-{KI[k]["source"]["letter"].lower()}'
        t += f"\n### `{k}` — {KI[k]['name']}\n입력: `{k}` 를 원점 ({p['at'][0] if p else '?'},{p['at'][1] if p else '?'}) 에 3층으로 찍는다(예제 도시). 그림: `{PFX}img-bld-kit-{slug}`(키트) · `{PFX}img-bld-map-{slug}`(도시에 놓인 모습).\n" + jfence(rec) + "\n"
    t += """
## 실행 순서 (건물 하나)
1. 놓을 칸의 땅이 보도인지 본다(밑변 줄 전체 + 문 앞 접근 줄).
2. 이미 놓인 건물과 겹치면 겹친 칸 중 밑변이 큰(앞줄) 건물이 나중이 되게 순서를 정한다.
3. 키트를 3층에 찍는다. 4. 문 앞 접근 칸(반드시)과 양옆 한 칸(가급적)을 비워 둔다. 5. 그림자(2층)는 소품·건물 규칙대로 따로 깐다(→ `mc-order`).
6. 자동 검사(`building-on-nonwalk`·`back-over-front`·`door-access-blocked`)가 0 인지 본다.
"""
    return t


add_doc(C_ASM, 'building-assembly', '현대 도시 · 건물 조립(키트·문 앞·겹침 순서·변형)', building_doc())
for nm, (im, cap) in building_images().items(): save_img(nm, im, cap, C_ASM)
_ov = overlap_image()
if _ov:
    _im, _best = _ov
    save_img('bld-overlap-order', _im, f"겹침 순서 예: 왼쪽 = 뒷줄 `{_best['first']['kit']}` 만, 오른쪽 = 이어서 앞줄 `{_best['later']['kit']}` 를 나중에 찍은 결과(예제 좌표). 빨강 테두리 = 겹친 칸 ({_best['box'][0]},{_best['box'][1]}). 앞줄이 뒷줄의 아래쪽을 덮는다.", C_ASM)


# ====================================================================== 분류 — 건물 키트 사전(계열마다 한 문서)
C_BLD = new_cat('buildings', '현대 도시 · 건물 키트 사전', '건물 키트 전부(계열마다 한 문서): 키트 id → 크기·변형·문 칸·문 앞 접근 칸·3층 칸 번호 전체 배열. 조립 규칙은 「조립 정답」.')


def bld_family_doc(fam, kids):
    base = KI[kids[0]]
    ko = base['name'].rsplit(' ', 1)[0] if base['name'][-1:] in 'ABC' else base['name']
    recs = [bld_record(k) for k in kids]
    rows = []
    for k in kids:
        v = KI[k]; doors, acc = door_info(k)
        rows.append([f'`{k}`', f"{v['w']}×{v['h']}", f"{v['variant'].get('wall') or '-'}", f"{v['variant'].get('roof') or '-'}", ' '.join(f"{d['cells'][0]}..{d['cells'][1]}" for d in doors) + f" (dy={v['h'] - 1})",
                     ' '.join(f"({a[0]},{a[1]})" for a in acc), v['cells']])
    n_used = sum(1 for k in kids if k in BLD_PLACE)
    t = f"""# 현대 도시 — 건물 키트 사전: {ko} (`{fam}`)

{HEAD}

계열 `{fam}` 키트 {len(kids)}종. 크기 {base['w']}×{base['h']}칸(가로×세로), 층수 {base.get('floors')}, 분류 {base.get('cat')}. 모든 칸 **막힘**(3층, 위층), 문 앞 접근 칸은 키트 바깥 한 줄 아래.
예제 도시에 쓰인 키트 {n_used}종. 조립 규칙·겹침 순서는 `{PFX}building-assembly`.

{md_table(['키트','크기','벽색','지붕색','문 칸 열(dx)','접근 칸 (dx,dy)','칸 수'], rows)}

## 칸 번호 전체 배열 (3층, tiles[행][열], -1 = 빈 칸)
{jfence(recs)}
"""
    return t


for _fam, _kids in FAMS.items():
    add_doc(C_BLD, f'bld-{fam_slug(_fam)}', f"현대 도시 · 건물 키트 사전 · {_fam}", bld_family_doc(_fam, _kids))


def building_galleries():
    items = []
    for fam, kids in FAMS.items():
        for k in kids:
            v = KI[k]
            if v['variant'].get('wall') or v['variant'].get('roof'): continue
            items.append((k.replace('mc-bld-', ''), kit_render(k)))
    pages = shelf_pack(items, 800)
    out = {}
    for i, pg in enumerate(pages):
        out[f'bld-gallery-{i + 1}'] = (pg, f'건물 기본 키트 도감 {i + 1}/{len(pages)}(원본 16px 해상도 그대로, 라벨 = 키트 id 에서 `mc-bld-` 를 뺀 것). 벽색·지붕색 변형은 `-<벽색>`·`-roof-<지붕색>` 이 붙은 별도 키트.')
    return out


for nm, (im, cap) in building_galleries().items(): save_img(nm, im, cap, C_BLD)


# ====================================================================== 소품·차량
import bake_data as BD            # noqa: E402

C_PROP = new_cat('props', '현대 도시 · 소품·차량 키트 사전', '소품(가로등·신호등·벤치·나무 …)·차량 키트 전부: 키트 id → 이름·크기·발밑 줄·★ 칸·3층 칸 번호 전체 배열과 키트 도감 그림. 배치 규칙은 「조립 정답」.')
PROPS_KITS = kit_ids('prop'); VEH_KITS = kit_ids('vehicle')
TALL = set(REPORT['tall_props'])
PROPS_USED = [p for p in PL if p['kind'] == 'prop' and not p.get('dropped')]
VEH_USED = [p for p in PL if p['kind'] == 'vehicle' and not p.get('dropped')]
import statistics


def foot_cell(p):
    ox, oy = p['at']; w, h = p['size']
    xs = [ox + dx for dx in range(w) if S.kits[p['kit']]['rows'][h - 1]['upperTiles'][dx] >= 0] or [ox]
    return (sum(xs) / len(xs), oy + h - 1)


def nearest_same(names):
    ps = [foot_cell(p) for p in PROPS_USED if KI[p['kit']]['name'] in names]
    if len(ps) < 2: return len(ps), None, None
    ds = [min(math.hypot(a[0] - b[0], a[1] - b[1]) for j, b in enumerate(ps) if j != i) for i, a in enumerate(ps)]
    return len(ps), round(min(ds), 1), round(statistics.median(ds), 1)


def prop_rule_rows():
    rows = []
    cnt = collections.Counter(KI[p['kit']]['name'] for p in PROPS_USED)
    for nm, (ko, grp, tall, where) in BD.PROPS.items():
        n = cnt.get(ko, 0)
        rows.append([ko, f'`{nm}`', BD.PROP_GROUPS[grp], '키 큰(발밑 막힘+윗줄 ★)' if tall else '발밑·전 칸 막힘', where, n])
    return rows


def vehicle_stats():
    foot_off = collections.Counter(); cross = 0; parked = 0
    for p in VEH_USED:
        fx, fy = foot_cell(p)
        for r in ROWS0:
            if r <= fy < r + RW: foot_off[f'가로 도로 위 줄 r + {int(fy - r)}'] += 1
        for c in COLS0:
            if c <= fx < c + RW: foot_off[f'세로 도로 위 줄 c + {int(fx - c)}'] += 1
        for r in ROWS0:
            for c in COLS0:
                ox, oy = p['at']; w, h = p['size']
                if ox < c + RW + 3 and ox + w > c - 2 and oy < r + RW + 3 and oy + h > r - 2: cross += 1
    return foot_off, cross


VFOOT, VCROSS = vehicle_stats()
compose_doc_lines = [ln.strip() for ln in (CT.__doc__ or '').splitlines() if ln.strip().startswith(('연석 쪽 보도', '건물 벽 쪽 보도', '문 앞', '차:', '충돌:', '소품 규칙'))]


def prop_rules_doc():
    nl = '\n'
    st = {nm: nearest_same(names) for nm, names in (('가로등', ('가로등',)), ('신호등', ('신호등',)), ('전신주', ('전신주',)), ('가로수', ('가로수', '가로수(기본)', '침엽수', '은행나무', '벚나무')), ('소화전', ('소화전',)))}
    t = f"""# 현대 도시 — 소품·차량 배치 규칙

{HEAD}

소품·차량은 **키트 하나 = 3층에 한 번 찍는 것**이다. 키트는 투명 배경 그림을 알파 경계로 잘라 밑변 정렬·좌우 가운데로 16의 배수 캔버스에 놓았다(칸에 맞추려고 원본 위치에서 가로세로 최대 8px 이동).
- **통행**: 모든 칸 막힘. 단 키 큰 소품(가로등·신호등·보행 신호기·전신주·정류장 표지·가로수·공원 가로등 등 {len(TALL)}종)은 **발밑 줄만 막힘, 그 위 줄은 ★**(걸을 수 있고 캐릭터 위에 그려짐, 아래 칸의 땅이 통행을 정한다).
  차량은 전 칸 막힘(정차 그림 — 움직이지 않는다). 투명한 소품이라 받침이 없다 — 3층에 얹고 바닥(보도)은 1층에 그대로 둔다.
- **원점**: 키트 왼쪽 위 칸. 발밑 줄 = 키트 마지막 행(그 행에서 -1 이 아닌 칸이 막힘). 키 큰 소품은 발밑 줄이 놓일 땅(보도·공원) 위에 오도록 원점을 잡는다.
- **그림자**: 소품 발밑 둘레에 2층 그림자 칸(`{PFX}dict-ground` 접지 그림자). 소품은 보도·공원 위에만, 차량은 그림자가 없다.
- 반복 가능/고정: 모든 소품·차량 키트 **고정**(늘리거나 이어 붙이지 않는다). 가로로 이어 깔도록 만든 소품(공사 펜스·생울타리 가로/세로)은 같은 키트를 칸마다 한 번씩 찍는다.

## 배치 규칙 (원본 생성기 규칙 + 예제 도시 실측)
원본 생성기(compose_town.py)가 지킨 구역 규칙(모듈 설명 그대로):
{nl.join('- ' + ln for ln in compose_doc_lines)}

예제 도시({MW}×{MH}) 실측(소품 {len(PROPS_USED)}개·차량 {len(VEH_USED)}대, 접근 칸을 막은 소품은 옮기거나 뺐다):
{md_table(['소품','개수','같은 종류끼리 가장 가까운 발밑 거리(칸) 최소','중앙값'], [[k, v[0], v[1] if v[1] is not None else '-', v[2] if v[2] is not None else '-'] for k, v in st.items()])}
- 가로수끼리 최소 {st['가로수'][1]}칸(규칙 4칸, 칸 스냅으로 약간 줄어든다). 가로등·신호등·전신주는 연석 쪽 보도 줄, 한 줄 간격 4칸 이상.
- 신호등은 교차로 네 모서리 보도에 하나씩(예제 {st['신호등'][0]}개 = 교차로 {len(INTERS)}개 × 4), 보행 신호기(적/녹)는 횡단보도 끝 보도에 짝으로.
- **문 앞**: 문 앞 접근 칸에는 소품·차량 발이 없다(자동 검사로 0 확인). 양옆 한 칸에 발이 붙은 소품이 예제에 8곳 있다 — 가급적 피한다.
- **차량**: 차선 가운데에 정지 그림으로. 발밑 줄 분포: {', '.join(f'{k} {v}대' for k, v in sorted(VFOOT.items()))}. 교차로(횡단보도 포함, 폭 12칸) 영역에 닿은 차량 {VCROSS}대 — **교차로·횡단보도 위 정차 금지.**
  차량은 연석 쪽 한 줄 주차(주차 차량·정차 버스·스쿠터) 또는 차선 가운데. 한 도로에 차선이 둘이므로 차선 하나에 한 줄.

## 소품 종류표 (배치 구역과 예제 개수)
{md_table(['소품','생성기 이름','묶음','통행','놓는 곳','예제 개수'], prop_rule_rows())}

## 칸 맞춤으로 생기는 오차 (정직하게)
- 원본은 픽셀 단위로 놓였으므로 칸에 맞춘 소품·차량은 가로세로 최대 8px 이동한다(예제 {len(PROPS_USED) + len(VEH_USED)}개 중 8px 이동 {sum(1 for p in PROPS_USED + VEH_USED if max(abs(p['snap_shift_px'][0]), abs(p['snap_shift_px'][1])) == 8)}개).
- 연석 주차 칸 표시(차 앞뒤 ㄴ자 틱)와 전신주 사이 전선은 타일 칸이 없어 넣지 않았다.
- 신호등 좌우 반전 변형은 시트에 없다(한 방향만).
"""
    return t


add_doc(C_ASM, 'prop-rules', '현대 도시 · 소품·차량 배치 규칙', prop_rules_doc())


def prop_dict_doc(kind, kids, title, extra):
    rows = []
    for k in kids:
        v = KI[k]; kk = S.kits[k]
        rows.append([f'`{k}`', v['name'], f"{v['w']}×{v['h']}", '키 큰(★ 윗줄)' if k in TALL else '-', v['source'].get('name'), v['cells']])
    recs = []
    for k in kids:
        v = KI[k]; emitted_kits.add(k)
        recs.append(dict(kit=k, w=v['w'], h=v['h'], tall=(k in TALL), tiles=kit_tiles(k, 'upperTiles')))
    return f"""# 현대 도시 — {title}

{HEAD}

{extra}

{md_table(['키트','이름','크기','★','출처 슬롯','칸 수'], rows)}

## 칸 번호 전체 배열 (3층, tiles[행][열], -1 = 빈 칸; 발밑 줄 = 마지막 행)
{jfence(recs)}
"""


add_doc(C_PROP, 'dict-props', '현대 도시 · 소품 키트 사전', prop_dict_doc('prop', PROPS_KITS, '소품 키트 사전', f'소품 키트 {len(PROPS_KITS)}종(같은 그림의 알파벳 글자 a~e 는 다른 원본 판). 키 큰 소품 {len(TALL)}종은 발밑 줄만 막고 위 줄은 ★. `stamp_object({{objectId:"kit:{TID}/<키트 id>", mapId, x, y}})` 의 x,y 는 키트 왼쪽 위 칸.'))
add_doc(C_PROP, 'dict-vehicles', '현대 도시 · 차량 키트 사전', prop_dict_doc('vehicle', VEH_KITS, '차량 키트 사전', f'차량 키트 {len(VEH_KITS)}종(승용차류는 색 변형·왼쪽 향함 `-l`, 정면·뒷면 차는 거울 없음). 전 칸 막힘(정차 그림). 이름 끝 `-<색>` = 차 색(silver 는 원본이라 접미사 없음).'))


def prop_galleries(kids, label, per=None):
    items = [(k.replace('mc-prop-', '').replace('mc-veh-', ''), kit_render(k)) for k in kids]
    pages = shelf_pack(items, 800)
    return {f'{label}-{i + 1}': (pg, f'{"소품" if label == "prop-gallery" else "차량"} 키트 도감 {i + 1}/{len(pages)}(원본 16px 그대로, 라벨 = 키트 id 의 뒷부분).') for i, pg in enumerate(pages)}


for nm, (im, cap) in prop_galleries(PROPS_KITS, 'prop-gallery').items(): save_img(nm, im, cap, C_PROP)
_vb = [k for k in VEH_KITS if not any(c in k for c in ('-black', '-navy', '-red', '-white', '-beige', '-green', '-teal', '-ochre')) and not k.endswith('-l')]
for nm, (im, cap) in prop_galleries(_vb, 'veh-gallery').items(): save_img(nm, im, cap + ' 색 변형·왼쪽 향함 키트는 생략(사전 표에는 전부 있다).', C_PROP)


# ====================================================================== 완성 예제
C_EX = new_cat('example', '현대 도시 · 완성 예제', f'완성 예제 도시 {MW}×{MH}(16px, 시드 {SEED}): 입력(도로 격자·건물/소품/차량 배치 목록) → 네 층 전체 정답 배열 → 원본 해상도 그림과 검증 숫자. 맵 JSON: tiledata/modern-city/map/modern-city-{SEED}.json, 번들 장소 「현대 도시 · 도쿄풍 예제 거리」.')


def layer_text(arr, rows=range(MH)):
    out = []
    for y in rows:
        out.append(f'y={y:02d}: ' + ' '.join('.' if arr[y * MW + x] < 0 else str(tnum(arr[y * MW + x])) for x in range(MW)))
    return '\n'.join(out)


def parse_layer(txt):
    vals = {}
    for ln in txt.splitlines():
        m = re.match(r'y=(\d+): (.*)$', ln)
        if m: vals[int(m.group(1))] = [-1 if v == '.' else int(v) for v in m.group(2).split()]
    return vals


EX_DOCS = {}


_gx = [(i % MW, i // MW) for i, t in enumerate(LOW) if t in GREEN]
PARK_BB = (min(a for a, b in _gx), max(a for a, b in _gx), min(b for a, b in _gx), max(b for a, b in _gx))


def example_plan_doc():
    r = MREPORT; v = r['render_vs_reference']; re_ = r['reachability']; b = r['buildings']
    brow = []
    for n, p in enumerate(BUILDS):
        doors, acc = door_info(p['kit'])
        front = all(any(cell == [p['at'][0] + a[0], p['at'][1] + a[1]] for cells in PLAN['doors'] for cell in cells) for a in acc) if acc else False
        brow.append([n + 1, f"`{p['kit']}`", f"({p['at'][0]},{p['at'][1]})", f"{p['size'][0]}×{p['size'][1]}", ' '.join(f"({p['at'][0] + a[0]},{p['at'][1] + a[1]})" for a in sorted(set(map(tuple, acc)))) if front else '(뒷줄 — 앞 건물에 가려짐)'])
    t = f"""# 현대 도시 — 완성 예제 ({MW}×{MH}) · 입력과 검증

{HEAD}

예제 도시는 compose_town 이 합성한 도시(시드 {SEED})의 스프라이트를 **키트 id + 원점**으로 바꿔 네 층에 찍은 것이다. 새 그림은 없고 시트 칸 번호만 쓴다.
맵 id `modern-city-{SEED}`(번들 장소는 `modern-city-example`), 타일셋 `{TID}`, 타일 16px, 기후 `inherit`, 이벤트 없음.
입력 → 정답 배열 → 그림: 배치 목록(이 문서·`{PFX}example-placements`) → 네 층 배열(`{PFX}example-layer1`·`layer2`·`layer3a`·`layer3b`·`layer4`) → 그림(`{PFX}img-example-*`).

## 입력
- 시작 위치 ({PLAN['start'][0]},{PLAN['start'][1]}) — 큰 교차로 북서쪽 모서리 보도. 이벤트·NPC·움직이는 차·행인은 없다.
- 도로 격자: 가로 도로 위 줄 y = {', '.join(map(str, ROWS0))}, 세로 도로 위 줄 x = {', '.join(map(str, COLS0))}, 폭 {RW}칸. 교차로 {len(INTERS)}개 (c,r) = {', '.join(f'({c},{r})' for c, r in INTERS)}. 공원 구역: 두 가로 도로 사이 · 세로 도로 서쪽 블록(블록 [가로줄 {PLAN['park']['block'][0]}, 세로줄 {PLAN['park']['block'][1]}]), 잔디가 깔린 칸의 범위 x {PARK_BB[0]}~{PARK_BB[1]} · y {PARK_BB[2]}~{PARK_BB[3]}, 템플릿 `{PLAN['park']['template']}`(십자길 + 분수 + 연못).
- 땅·도로 표시는 규칙으로 정해진다(`{PFX}order`의 실행 순서 — 예제 {RULES['curb_crosswalk_rule']['cells'] + RULES['road_asphalt_rule']['cells'] + RULES['sidewalk_rule']['cells'] + RULES['stopline_rule']['cells']}칸에서 어긋남 0). 공원 안쪽 땅(잔디·꽃밭·벽돌·길·연못·생울타리 둘레)과 화살표·맨홀·배수구는 배열에 있다.
- 건물 {len(BUILDS)}채 (찍은 순서 = 뒷줄 → 앞줄, 키트 id·원점·크기·문 앞 접근 칸):

{md_table(['#','키트','원점(x,y)','크기','문 앞 접근 칸(절대 좌표)'], brow)}

- 소품·차량 배치는 `{PFX}example-placements`(키트 id + 원점, 찍은 순서).

## 층 쌓기 규칙 (이 맵이 쓴 것)
- 1층: 땅. 2층: 도로 표시 + 접지 그림자(한 칸에 둘이 겹치면 표시 우선). 3층: 키트 칸을 **찍은 순서대로** 덮어쓴다(불투명이면 덮어쓰고, 반투명이면 3층이 이미 찼을 때 4층).
- 이 규칙으로 배치 목록을 다시 찍은 3·4층은 맵 배열과 **칸 하나도 어긋나지 않는다**(자동 검사 `layer-mismatch` 0 — `{PFX}errors-overview`).
- 소품·차량 중 문 앞 접근 칸을 막은 것은 한 칸 옮겼다({len(r['props_vehicles']['moved'])}곳: {', '.join(m['name'] for m in r['props_vehicles']['moved']) or '-'}) 또는 뺐다({len(r['props_vehicles']['dropped'])}곳: {', '.join(m['name'] for m in r['props_vehicles']['dropped']) or '-'}).

## 검증 (자동, 이 맵 그대로)
- 칸 번호: 네 층 모두 정의 범위(0..{COUNT - 1}) 안, 1층 빈칸 {r['tile_id_range']['lower_empty_cells']}칸.
- 건물: {b['count']}채 모두 키트 그림과 **화소 일치**(변형 대체 {b['substituted']}).
- 도달성: 시작 위치에서 문 앞 접근 칸 {re_['access_cells']}칸 전부 걸어서 닿는다(엔진 규칙 `canMove`, 막힌 접근 칸 {re_['unreachable_access_cells']}). 걸을 수 있는 {re_['walkable_cells']}칸 중 닿는 칸 {re_['reachable_cells']}칸 — 닿지 않는 {re_['walkable_cells'] - re_['reachable_cells']}칸은 공사 펜스 안쪽 같은 갇힌 자리다.
- 그림 비교: 맵을 시트·정의만으로 다시 그린 그림과 원본 합성(사람·전선을 뺀 기준)을 비교 — 건물 칸 {v['by_cell_class']['building_cells']['mismatch_pct']}% · 아무것도 안 놓인 칸 {v['by_cell_class']['untouched_cells']['mismatch_pct']}% · 소품 칸 {v['by_cell_class']['prop_cells']['mismatch_pct']}% · 차량 칸 {v['by_cell_class']['vehicle_cells']['mismatch_pct']}% 화소가 다르다.
  소품·차량 차이는 16px 칸에 맞추려고 최대 8px 옮겼기 때문이고(건물은 원래 칸 정렬이라 0), 차 색은 시트에 구워진 색으로 바뀐 것이 있다.

## 그림
- `{PFX}img-example-overview`: 도시 전체(960px 을 820px 로 줄인 개요 — **원본 해상도 아님**).
- `{PFX}img-example-q1`~`q4`: 네 사분면(각 480×480, 시트 칸 번호만으로 다시 조립한 **원본 해상도** 그림, 팔레트 128색 양자화).
- `{PFX}img-example-layers`: 한 구역을 1층 → 2층 → 3층(건물) → 3·4층(전부)으로 쌓는 단계. `{PFX}img-example-reach`: 걸을 수 있는데 닿지 않는 칸(빨강)·문 앞 접근 칸(초록)·시작 위치(파랑)(축소). `{PFX}img-example-vs-source`: 원본 합성(왼쪽)과 맵(오른쪽).
"""
    return t


def example_placements_doc():
    def rec(p): return [p['kit'], p['at'][0], p['at'][1]]
    props = [p for p in PL if p['kind'] != 'building' and not p.get('dropped')]
    seq = [rec(p) for p in PL if not p.get('dropped')]
    marks = [[m['kind'], m['tile'], m['at'][0], m['at'][1]] for m in PLAN['marks']]
    for p in PL:
        emitted_kits.add(p['kit'])
    for m in PLAN['marks']: tnum(m['tile'])
    t = f"""# 현대 도시 — 완성 예제 · 배치 목록 (찍은 순서)

{HEAD}

3층에 **이 순서대로** `[키트 id, 원점 x, 원점 y]` 를 찍는다(발끝 y 가 작은 것부터 = 뒤에 있는 것부터). 건물 {len(BUILDS)}채·소품 {sum(1 for p in PL if p['kind'] == 'prop' and not p.get('dropped'))}개·차량 {sum(1 for p in PL if p['kind'] == 'vehicle' and not p.get('dropped'))}대, 합계 {len(seq)}.
키트의 칸 배열은 건물 `{PFX}bld-*`, 소품·차량 `{PFX}dict-props`·`{PFX}dict-vehicles`.

{jfence(seq)}

## 도로 표시 오버레이 (2층, 낱칸) — `[종류, 칸 번호, x, y]`
화살표·맨홀·배수구는 아래 목록의 칸에 찍는다(화살표는 정지선 앞 차선 가운데, 배수구는 연석 곁 2칸 한 쌍). 중앙선·정지선·접지 그림자는 규칙(`{PFX}order`)과 2층 배열(`{PFX}example-layer2`)에 있다.
{jfence(marks)}
"""
    return t


add_doc(C_EX, 'example-plan', '현대 도시 · 완성 예제 · 입력과 검증', example_plan_doc())
add_doc(C_EX, 'example-placements', '현대 도시 · 완성 예제 · 배치 목록', example_placements_doc())
LAYER_HEAD = lambda title, extra: f"""# 현대 도시 — 완성 예제 · {title}

{HEAD}

맵 `modern-city-{SEED}` {MW}×{MH}. 행 `y=NN:` 뒤에 x = 0..{MW - 1} 순서의 칸 번호를 공백으로 나열했다. `.` = -1(빈 칸).
{extra}

"""
add_doc(C_EX, 'example-layer1', '현대 도시 · 완성 예제 · 1층(lowerTiles) 정답 배열',
        LAYER_HEAD('1층 lowerTiles 정답 배열', '땅(아스팔트·보도·연석·횡단보도·공원 잔디·꽃밭·벽돌·길·연못·생울타리). 빈 칸이 없다.') + '```text\n' + layer_text(LOW) + '\n```\n')
add_doc(C_EX, 'example-layer2', '현대 도시 · 완성 예제 · 2층(lowerOverlayTiles) 정답 배열',
        LAYER_HEAD('2층 lowerOverlayTiles 정답 배열', '도로 표시(중앙선·정지선·화살표·맨홀·배수구)와 접지 그림자. 투명 칸이라 1층의 땅 위에 겹친다.') + '```text\n' + layer_text(LO2) + '\n```\n')
add_doc(C_EX, 'example-layer3a', '현대 도시 · 완성 예제 · 3층(upperTiles) 정답 배열 (y=00~29)',
        LAYER_HEAD('3층 upperTiles 정답 배열 (y=00~29)', '건물·소품·차량 키트 칸(찍은 순서대로 덮어쓴 결과). 아래 절반은 `layer3b`.') + '```text\n' + layer_text(UPR, range(0, 30)) + '\n```\n')
add_doc(C_EX, 'example-layer3b', '현대 도시 · 완성 예제 · 3층(upperTiles) 정답 배열 (y=30~59)',
        LAYER_HEAD('3층 upperTiles 정답 배열 (y=30~59)', '위 절반은 `layer3a`.') + '```text\n' + layer_text(UPR, range(30, 60)) + '\n```\n')
add_doc(C_EX, 'example-layer4', '현대 도시 · 완성 예제 · 4층(upperOverlayTiles) 정답 배열',
        LAYER_HEAD('4층 upperOverlayTiles 정답 배열', '3층 칸이 이미 있는 자리에 반투명 키트 칸(뒤 건물 앞에 선 가로등·간판의 투명 가장자리 등)이 겹칠 때만 쓴다.') + '```text\n' + layer_text(UP4) + '\n```\n')


# ---- 예제 그림
def example_images():
    ids = {}
    full = render_layers(LOW, LO2, UPR, UP4, MW, MH)
    ids['overview'] = save_img('example-overview', shrink(full.convert('RGB')), f'완성 예제 도시 전체 {MW}×{MH}칸(960px 을 820px 로 줄인 개요 — 원본 해상도 아님). 네 사분면 원본 해상도 그림은 example-q1~q4.', C_EX)
    for n, (qx, qy) in enumerate([(0, 0), (30, 0), (0, 30), (30, 30)], 1):
        im = map_crop(qx, qy, 30, 30, zoom=1)
        ids[f'q{n}'] = save_img(f'example-q{n}', im, f'완성 예제 사분면 {n}: x {qx}~{qx + 29}, y {qy}~{qy + 29}(원본 해상도 480×480, 시트 칸 번호만으로 조립). 칸 번호 정답은 mc-example-layer*.', C_EX)
    # 층 쌓기 단계
    x0, y0, w, h = 33, 29, 10, 12
    acc = sorted({tuple(c) for cells in PLAN['doors'] for c in cells if x0 <= c[0] < x0 + w and y0 <= c[1] < y0 + h})
    steps = [('1층 땅', ('lower',)), ('+2층 표시·그림자', ('lower', 'lo2')), ('+3층 건물·소품', ('lower', 'lo2', 'upper')), ('+4층(전부) · 초록=문 앞 접근 칸', ('lower', 'lo2', 'upper', 'up4'))]
    pw, ph = w * T * 2, h * T * 2
    sheet = Image.new('RGBA', (pw * 2 + 18, (ph + 16) * 2 + 6), (30, 30, 36, 255)); d = ImageDraw.Draw(sheet)
    for i, (lab, ly) in enumerate(steps):
        im = map_crop(x0, y0, w, h, layers=ly, zoom=2, mark_access=acc if i == 3 else None)
        ox, oy = 6 + (i % 2) * (pw + 6), 2 + (i // 2) * (ph + 16)
        text(d, (ox, oy), lab, font=FONT_K); sheet.alpha_composite(im, (ox, oy + 12))
    ids['layers'] = save_img('example-layers', sheet, f'층 쌓기 단계(원본 ×2 확대, x {x0}~{x0 + w - 1}, y {y0}~{y0 + h - 1}): 1층 땅 → 2층 표시·그림자 → 3층 건물·소품 → 4층까지 전부. 초록 테두리 = 문 앞 접근 칸.', C_EX)
    # 도달성
    reach = Image.open(os.path.join(ROOT, f'verify-shots/modern-city/reach-{SEED}.png')).convert('RGB')
    ids['reach'] = save_img('example-reach', shrink(reach), f'도달성(960px 을 820px 로 줄임 — 원본 해상도 아님): 시작 위치(파랑)에서 걸어서 닿지 않는 걸을 수 있는 칸 = 빨강({MREPORT["reachability"]["walkable_cells"] - MREPORT["reachability"]["reachable_cells"]}칸, 공사 펜스 안쪽), 문 앞 접근 칸 = 초록.', C_EX)
    # 원본 합성 vs 맵
    ref = Image.open(os.path.join(ROOT, f'verify-shots/modern-city/ref-{SEED}.png')).convert('RGB')
    mp = Image.open(os.path.join(ROOT, f'verify-shots/modern-city/map-{SEED}.png')).convert('RGB')
    rx, ry, rw, rh = 30, 28, 25, 25
    box = (rx * T, ry * T, (rx + rw) * T, (ry + rh) * T)
    both = Image.new('RGB', (rw * T * 2 + 6, rh * T + 12), (30, 30, 36)); dd = ImageDraw.Draw(both)
    text(dd, (2, 0), 'compose_town 합성(사람·전선 뺌)', font=FONT_K); text(dd, (rw * T + 8, 0), '맵(시트 칸 번호만)', font=FONT_K)
    both.paste(ref.crop(box), (0, 12)); both.paste(mp.crop(box), (rw * T + 6, 12))
    ids['vs'] = save_img('example-vs-source', both, f'원본 합성(왼쪽)과 맵(오른쪽) 비교(원본 해상도, x {rx}~{rx + rw - 1}, y {ry}~{ry + rh - 1}). 건물은 같고, 소품·차량은 칸에 맞춰 최대 8px 옮겨지며 차 색 일부가 시트의 구운 색으로 바뀐다.', C_EX)
    return ids


EXIMG = example_images()


# ====================================================================== 오류 검출(실제 변조)
import copy
C_ERR = new_cat('errors', '현대 도시 · 정상/오류·자동 검사', '정상/오류 나란한 그림(실제 변조 7종: 막힌 문 앞·뒤집힌 겹침 순서·교차로 중앙선·도로 위 가로등·건물이 1층에·도로 표시가 1층에·틀린 연석)과 오류 코드·맵 좌표, 검사가 보는 범위·보지 않는 범위, 층 정정 전후.')
EVID = collections.OrderedDict()


def crop_arrays(mj, x0, y0, w, h, zoom=2, red=(), green=()):
    def sl(arr): return [arr[(y0 + j) * MW + x0 + i] if 0 <= x0 + i < MW and 0 <= y0 + j < MH else -1 for j in range(h) for i in range(w)]
    im = up(render_layers(sl(mj['lowerTiles']), sl(mj['lowerOverlayTiles']), sl(mj['upperTiles']), sl(mj['upperOverlayTiles']), w, h, (0, 0, 0, 255)), zoom)
    d = ImageDraw.Draw(im)
    for col, cells in (((255, 60, 60, 255), red), ((60, 255, 90, 255), green)):
        for (cx, cy) in cells:
            x, y = (cx - x0) * T * zoom, (cy - y0) * T * zoom
            d.rectangle([x, y, x + T * zoom - 1, y + T * zoom - 1], outline=col, width=2)
    return im


def tampered_base():
    return copy.deepcopy(MAPJ), copy.deepcopy(PLAN)


def restamped(mj, plan):
    L = CHK.restamp(plan)
    mj['upperTiles'] = list(L.upper); mj['upperOverlayTiles'] = list(L.up4)


# 변조 대상은 전부 예제 맵에서 읽어 고른다(손으로 고른 좌표 아님).
KIT_BY_KIND = {k: [p for p in PL if p['kind'] == k and not p.get('dropped')] for k in ('building', 'prop', 'vehicle')}


def solid_foot_cells(kid, at, size):
    k = S.kits[kid]; w, h = size
    return [(at[0] + x, at[1] + h - 1) for x in range(w) if k['rows'][h - 1]['upperTiles'][x] >= 0]


def pick_access():
    for p in BUILDS:
        if p.get('dropped'): continue
        acc = [a for a in KI[p['kit']]['access']]
        for a in acc:
            c = (p['at'][0] + a['dx'], p['at'][1] + a['dy'])
            if any(c in [tuple(x) for x in cells] for cells in PLAN['doors']) and p['at'][1] + p['size'][1] < 20:
                return p, c
    raise SystemExit('접근 칸을 못 찾음')


def scen_door():
    mj, plan = tampered_base(); b, c = pick_access()
    blocker_kid = next(p['kit'] for p in KIT_BY_KIND['prop'] if p['size'] == [1, 1] and S.kits[p['kit']]['rows'][0]['upperTiles'][0] >= 0 and p['kit'] in PROPS_KITS)
    plan['placements'].append(dict(order=len(plan['placements']), kit=blocker_kid, at=[c[0], c[1]], size=[1, 1], kind='prop'))
    restamped(mj, plan)
    return mj, plan, 'door-access-blocked', [c], dict(why='문 앞 접근 칸에 막히는 소품을 얹었다', kit=blocker_kid, building=b['kit'], door_access=list(c)), (c[0] - 5, c[1] - 6)


def scen_order():
    mj, plan = tampered_base()
    ov = next(o for o in OVERLAPS if (o['first']['at'][1] + o['first']['size'][1]) < (o['later']['at'][1] + o['later']['size'][1]))   # 정상: 뒷줄(발 위)이 먼저
    pls = plan['placements']
    ia = next(i for i, p in enumerate(pls) if p['kit'] == ov['first']['kit'] and p['at'] == ov['first']['at'])
    ib = next(i for i, p in enumerate(pls) if p['kit'] == ov['later']['kit'] and p['at'] == ov['later']['at'])
    pls[ia], pls[ib] = pls[ib], pls[ia]
    restamped(mj, plan)
    bx = ov['box']
    return mj, plan, 'back-over-front', [(bx[0], bx[1])], dict(why='뒷줄 건물과 앞줄 건물의 찍는 순서를 맞바꿨다', back=ov['first']['kit'], front=ov['later']['kit'], overlap=list(bx)), (bx[0] - 4, bx[1] - 3)


def scen_marking():
    mj, plan = tampered_base()
    r, c = ROWS0[0], COLS0[0]; x, y = c + 2, r + 2
    ids = sorted(CENTER_IDS)
    mj['lowerOverlayTiles'][y * MW + x] = ids[0]
    return mj, plan, 'marking-in-intersection', [(x, y)], dict(why='교차로 중심 6×6 안에 노란 중앙선 칸을 얹었다', tile=ids[0]), (x - 6, y - 5)


def scen_tall():
    mj, plan = tampered_base()
    kid = next(p['kit'] for p in KIT_BY_KIND['prop'] if p['kit'] in TALL and p['size'][0] == 1)
    h = next(p['size'][1] for p in KIT_BY_KIND['prop'] if p['kit'] == kid)
    c, r = COLS0[0], ROWS0[0]
    x, y = c + 2, r + RW + 8                       # 세로 도로 위(교차로 아래쪽), 중앙선 옆 한 칸
    assert LOW[y * MW + x] in (ID['asphalt'], ID['asphalt2']), (x, y)
    plan['placements'].append(dict(order=len(plan['placements']), kit=kid, at=[x, y - (h - 1)], size=[1, h], kind='prop'))
    restamped(mj, plan)
    return mj, plan, 'tall-prop-on-road', [(x, y)], dict(why='키 큰 소품(가로등류)을 도로 한가운데 발밑에 세웠다', kit=kid), (x - 6, y - 7)


def scen_lower_building():
    mj, plan = tampered_base()
    b = BUILDS[11]; x, y = b['at'][0] + 1, b['at'][1] + 2
    i = y * MW + x; assert mj['upperTiles'][i] >= 0
    mj['lowerTiles'][i] = mj['upperTiles'][i]; mj['upperTiles'][i] = -1
    return mj, plan, 'building-in-lower-layer', [(x, y)], dict(why='건물 벽 칸 하나를 3층 대신 1층에 찍었다', building=b['kit'], tile=mj['lowerTiles'][i]), (x - 4, y - 4)


def scen_overlay_lower():
    mj, plan = tampered_base()
    r, c = ROWS0[0], COLS0[0]
    cand = [(x, r + 2) for x in range(c - 20, c - 3) if LO2[(r + 2) * MW + x] in CENTER_IDS and UPR[(r + 2) * MW + x] < 0 and UP4[(r + 2) * MW + x] < 0 and all(UPR[(r + 2 + dy) * MW + x] < 0 for dy in (-1, 0, 1))]
    x, y = cand[len(cand) // 2]
    i = y * MW + x
    mj['lowerTiles'][i] = mj['lowerOverlayTiles'][i]; mj['lowerOverlayTiles'][i] = -1
    return mj, plan, 'overlay-in-base-layer', [(x, y)], dict(why='투명 중앙선 칸을 2층 대신 1층에 찍었다(아래 아스팔트가 사라져 검게 보인다)', tile=mj['lowerTiles'][i]), (x - 6, y - 5)


def scen_curb():
    mj, plan = tampered_base()
    r = ROWS0[0]; x, y = 10, r - 1
    assert LOW[y * MW + x] == ID['curb_n'], LOW[y * MW + x]
    mj['lowerTiles'][y * MW + x] = ID['curb_s']
    return mj, plan, 'curb-mismatch', [(x, y)], dict(why='가로 도로 북쪽 연석 칸을 반대 방향(북쪽이 도로) 연석으로 바꿨다', tile=ID['curb_s'], expected=ID['curb_n']), (x - 6, y - 5)


SCENARIOS = [('E1', scen_door), ('E2', scen_order), ('E3', scen_marking), ('E4', scen_tall), ('E5', scen_lower_building), ('E6', scen_overlay_lower), ('E7', scen_curb)]
BASE_ERRS = CHK.run(MAPJ, PLAN)
assert not BASE_ERRS, BASE_ERRS[:3]
ERR_IMG = {}
for sid, fn in SCENARIOS:
    mj, plan, code, cells, info, org = fn()
    errs = CHK.run(mj, plan)
    hit = [e for e in errs if e['code'] == code and (e['x'], e['y']) in set(map(tuple, cells)) or (e['code'] == code and code == 'back-over-front')]
    assert hit, (sid, code, cells, [(e['code'], e['x'], e['y']) for e in errs[:6]])
    cw, ch = 12, 10
    x0 = max(0, min(MW - cw, org[0])); y0 = max(0, min(MH - ch, org[1]))
    ok = crop_arrays(MAPJ, x0, y0, cw, ch, 2, green=[c for c in cells] if code == 'door-access-blocked' else ())
    bad = crop_arrays(mj, x0, y0, cw, ch, 2, red=cells)
    pw, ph = cw * T * 2, ch * T * 2
    sheet = Image.new('RGBA', (pw * 2 + 18, ph + 20), (30, 30, 36, 255)); dd = ImageDraw.Draw(sheet)
    text(dd, (6, 2), f'{sid} 정상 (x {x0}~{x0 + cw - 1}, y {y0}~{y0 + ch - 1})', font=FONT_K); text(dd, (pw + 12, 2), f'{sid} 오류 · {code}', font=FONT_K)
    sheet.alpha_composite(ok, (6, 16)); sheet.alpha_composite(bad, (pw + 12, 16))
    iid = save_img(f'err-{sid.lower()}-{code}', sheet, f'{sid} 정상(왼쪽)/오류(오른쪽): {info["why"]}. 검사 오류 코드 {code}, 맵 좌표 {cells}(빨강 테두리). 원본 ×2 확대.', C_ERR)
    ERR_IMG[sid] = iid
    EVID[sid] = dict(code=code, cells=[list(c) for c in cells], crop=dict(x0=x0, y0=y0, w=cw, h=ch), tamper=info,
                     detected=[dict(e) for e in errs if e['code'] == code][:6], all_codes=dict(collections.Counter(e['code'] for e in errs)), image=iid)
    print('tamper', sid, code, cells, dict(collections.Counter(e['code'] for e in errs)))


# ---- 오류 문서
FIXES = {
    'tile-out-of-range': '정의 밖 번호는 없다 — 칸 번호는 이 문서의 사전/키트 배열에서만 가져온다. 1층 빈칸 -1 은 땅으로 채운다.',
    'layer-mismatch': '낱칸 편집을 되돌리고 배치 목록(키트 id + 원점, 뒤 → 앞 순서)대로 다시 찍는다. 3·4층을 손으로 고치지 않는다.',
    'building-in-lower-layer': '건물·소품 칸은 3층(upperTiles)에 둔다. 1층엔 땅만.',
    'overlay-in-base-layer': '도로 표시·그림자는 2층(lowerOverlayTiles)에 둔다. 1층엔 불투명 땅만(투명 칸을 1층에 두면 아래 땅이 없어 검게 보인다).',
    'ground-in-object-layer': '불투명 땅(아스팔트·보도 등)은 1층으로 옮긴다.',
    'door-access-blocked': '문 앞 접근 칸에서 소품·차량을 치우거나 한 칸 옮긴다(예제 도시는 5곳을 옮기고 2곳을 뺐다).',
    'door-not-on-sidewalk': '문 앞 접근 칸의 땅을 보도로 바꾼다(건물을 보도 위에 얹는다).',
    'building-on-nonwalk': '건물 밑변을 보도 위로 옮긴다. 도로·연석·횡단보도·공원 위에 얹지 않는다.',
    'back-over-front': '겹치는 건물은 뒷줄(발이 위쪽)을 먼저, 앞줄을 나중에 찍는다(배치 목록 순서를 고친다).',
    'marking-in-intersection': '교차로 중심 6×6 안의 중앙선 칸을 지운다. 구간은 횡단보도 바깥에서 끝낸다.',
    'tall-prop-on-road': '가로등·신호등·전신주·가로수는 보도·공원에 둔다.',
    'curb-mismatch': '연석을 낱칸으로 깔았다면 도로가 있는 쪽 이름(「~쪽이 도로」)을 맞춘다. 가능하면 오토타일 `mc-sidewalk-curb` 로 칠한다.',
}
ERR_CASE = {EVID[sid]['code']: sid for sid in EVID}


def errors_overview_doc():
    rows = []
    for code, desc in BM.CHECK_CODES.items():
        sid = ERR_CASE.get(code)
        ev = EVID[sid] if sid else None
        rows.append([f'`{code}`', desc, FIXES[code], (f"{sid}: " + ', '.join(f'({x},{y})' for x, y in ev['cells'])) if ev else '(변조 기록 없음 — 규칙은 같은 코드 경로)'])
    t = f"""# 현대 도시 — 정상/오류 · 자동 검사

{HEAD}

예제 맵(`modern-city-{SEED}`)과 배치 목록을 **실제로 변조**해서 검사기가 코드·좌표를 정확히 짚는지 확인했다(기록: `tiledata/modern-city/refs/check-evidence.json`). 정상 맵의 검사 결과는 오류 0.
변조 7종의 정상/오류 나란한 그림은 `{PFX}img-err-e1-*`~`e7-*`, 설명은 `{PFX}errors-scenarios`.

## 어떻게 돌리나
- 구조 검사: `python3 src/harnesses/modern-chipset/bake_map.py --check tiledata/modern-city/map/modern-city-{SEED}.json` (옆의 `-plan.json` 배치 목록이 필요). 오류가 있으면 종료 코드 1.
- 통행 검사(엔진 규칙 그대로): `npx vite-node tiledata/modern-city/map/check-reach.mts {SEED}` — 저장소의 `canMove`로 시작 위치에서 4방향 BFS.
- 예제 맵은 굽는 중에도 같은 검사를 거치고, **하나라도 오류면 파일을 아무것도 쓰지 않는다**(`bake_map.py`가 `refused` 를 출력하고 종료). 부분 배치가 남지 않는다.

## 검사가 보는 것 / 보지 않는 것
- 보는 것(구조·통행): 칸 번호 범위 · 배치 목록과 3·4층의 일치 · 땅/표시/건물이 각자 제 층에 있는지 · 건물 밑변이 보도 위인지 · 문 앞 접근 칸의 땅과 시작 위치에서의 도달 · 겹치는 건물의 찍는 순서 · 교차로 중심의 중앙선 · 키 큰 소품 발밑 · 연석 오토타일 방향.
- **보지 않는 것**: 이벤트 실행(문 이동·대화·NPC) · 움직이는 차·행인 · 미적 품질(색 조화·밀도·자연스러움) · 이 문서를 읽는 낮은 성능 모델이 실제로 맞게 깔 확률 · 그림 화소(그림 비교는 별도 통계). 검사 통과는 **구조가 맞다**는 뜻일 뿐 잘 만든 도시라는 뜻이 아니다.
- 소품·차량 겹침(두 소품이 같은 칸), 4층 넘침은 검사하지 않는다 — 예제 굽기에서 `layer4_overflow` 를 따로 센다(0).

## 오류 코드와 정정
{md_table(['코드','뜻','고치는 법','변조 실험(좌표)'], rows)}

## 정상 상태의 기준 (이 맵 그대로 측정)
- 오류 0, 칸 번호 범위 안, 1층 빈칸 0, 건물 {len(BUILDS)}채 전부 보도 위, 문 앞 접근 칸 {MREPORT['reachability']['access_cells']}칸 전부 도달.
"""
    return t


def errors_scenarios_doc():
    out = [f"""# 현대 도시 — 정상/오류 변조 실험 7종

{HEAD}

각 실험은 예제 맵의 사본에서 **한 가지만** 바꾸고 검사기를 돌린 결과다(좌표는 모두 맵 칸 좌표, 0 기준). 그림은 왼쪽 정상·오른쪽 오류(원본 ×2 확대), 빨강 테두리 = 오류 칸, 초록 테두리 = 정상일 때 비어 있어야 하는 문 앞 접근 칸.
"""]
    for sid in EVID:
        ev = EVID[sid]
        out.append(f"""## {sid} — `{ev['code']}`
- 변조: {ev['tamper']['why']}. 세부: {json.dumps({k: v for k, v in ev['tamper'].items() if k != 'why'}, ensure_ascii=False)}
- 검사 결과 코드: {json.dumps(ev['all_codes'], ensure_ascii=False)} — 기대한 코드가 좌표 {ev['cells']} 에서 검출됨.
- 그림: `{ev['image']}` (자른 범위 x {ev['crop']['x0']}~{ev['crop']['x0'] + ev['crop']['w'] - 1}, y {ev['crop']['y0']}~{ev['crop']['y0'] + ev['crop']['h'] - 1}).
- 고치는 법: {FIXES[ev['code']]}
""")
    out.append("""## 이 실험이 다루지 않는 오류
- 정지선·횡단보도·화살표 칸의 위치 오류, 소품끼리 겹침, 그림자 위치 — 구조 검사 항목이 아니다(예제에서는 규칙 재계산으로 어긋남 0 확인). 잘린 뿌리·빠진 줄기·반대 외곽은 숲 계열 용어로, 이 도시 칩셋에는 해당 소재(나무 키트는 소품 1개 키트)가 없다.
""")
    return '\n'.join(out)


add_doc(C_ERR, 'errors-overview', '현대 도시 · 정상/오류 · 자동 검사 범위와 오류 코드', errors_overview_doc())
add_doc(C_ERR, 'errors-scenarios', '현대 도시 · 정상/오류 · 변조 실험 7종(좌표 기록)', errors_scenarios_doc())


def layer_correction_doc():
    bk = AUDIT['byGroupKinds'] if AUDIT else {}
    rows = []
    for gid in ('mc:road', 'mc:sidewalk', 'mc:green', 'mc:water', 'mc:hedge', 'mc:marking-center', 'mc:marking-stop', 'mc:marking-arrow', 'mc:marking-manhole', 'mc:shadow'):
        for k, n in (bk.get(gid) or {}).items():
            pas, prio, home, depth = k.split('|')
            rows.append([f'`{gid}`', n, {'passable': '걸음', 'solid': '막힘'}[pas], prio.split('=')[1], home.split('=')[1], {'below': '캐릭터 아래', 'ysort': '캐릭터와 y 정렬', 'above': '캐릭터 위'}[depth.split('=')[1]]])
    kinds = sorted({k for g, v in bk.items() if g.startswith('mc:building') or g.startswith('mc:prop') or g.startswith('mc:veh') for k in v})
    t = f"""# 현대 도시 — 층 표기 대조: 엔진 판정 전후

{HEAD}

AI-REFERENCE-CONTRACT 8항: 투명 여부·홈 레이어·통행·그림 순서는 **별개의 정보**다. 칸 {AUDIT['checked'] if AUDIT else '?'}칸을 엔진 함수로 대조했다(`tiledata/modern-city/refs/layer-audit.mts`, 결과 `layer-audit.json`): 어긋남 **{AUDIT['mismatches'] if AUDIT else '?'}건**.
대조한 엔진 함수: 홈 레이어 `src/editor/tileLayerPolicy.ts`, 통행 `src/project/collision.ts` 의 `passabilityOf`, 그림 순서 `src/player/characterDepth.ts` 의 `mapUpperTileDepth`.

## 그룹별 측정(칸 수)
{md_table(['그룹','칸 수','통행','칸 우선순위 priority','홈 레이어(편집기 붓)','그림 순서'], rows)}

건물·소품·차량 칸 묶음(요약): {', '.join(kinds)}.

## 전/후
| 항목 | 전: 번들 tileMeta·그룹 문구 | 후: 엔진 측정과 이 문서의 표기 |
|---|---|---|
| 도로 표시·그림자 칸의 층 | 그룹 이름 「…(오버레이, 2층)」, tileMeta 설명 「붓은 위층에 깔고 … 캐릭터 밑에 그린다(2층)」 — 읽는 사람이 홈 레이어(위층=3층)와 2층을 한 가지로 오해할 수 있다 | 투명 칸이고 통행 가능이다. 편집기 붓 홈 레이어는 `upper`(위층 슬롯)지만 **그림 순서는 캐릭터 아래**(통행 가능한 칸은 y 정렬 대신 아래). 예제 맵은 이 칸들을 **2층 `lowerOverlayTiles`** 에 둔다(같은 그림·같은 통행, 캐릭터 아래). 1층에 단독으로 두면 아래 땅이 없어 검게 보인다 → 오류 코드 `overlay-in-base-layer` |
| 건물·소품 칸 | 「위층에 찍는다」 | 맞다. 3층(홈 `upper`). 막힘 칸은 캐릭터와 y 정렬, ★ 칸은 항상 캐릭터 위. 1층에 있으면 `building-in-lower-layer` |
| 땅 칸 | 아래층 | 맞다. 1층. 3·4층에 있으면 `ground-in-object-layer` |
| 물·생울타리 땅 | 아래층 | 1층이지만 **막힘**(통행 막힘 + y 정렬) — 땅이라고 걸을 수 있는 것은 아니다 |
| 투명 여부 vs 층 | (구분 안 됨) | 투명하다고 위층에 두는 것이 아니다: 투명한 소품도 발밑 줄은 막고 윗줄만 ★. 투명 오버레이(표시·그림자)만 2층 |

tileMeta·그룹의 문구 자체는 이 문서의 작성자가 고치지 않았다(번들 정의 JSON 은 별도 담당). 위 전/후 표가 **문서에서 쓰는 정정 표기**이며 엔진 측정으로 뒷받침된다.
"""
    return t


add_doc(C_ERR, 'errors-layer-correction', '현대 도시 · 층 표기 대조(엔진 판정 전후)', layer_correction_doc())
json.dump(EVID, open(os.path.join(MD_DIR, 'check-evidence.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---- 땅 칸 모음 그림
def ground_sheet():
    ids = []
    for gid in ('mc:road', 'mc:sidewalk', 'mc:green', 'mc:plaza', 'mc:water', 'mc:hedge', 'mc:marking-center', 'mc:marking-stop', 'mc:marking-arrow', 'mc:marking-manhole'):
        g = next(g for g in D['tileGroups'] if g['id'] == gid); ids += g['tileIds']
    for g in D['autotileGroups']: ids += [t for t in g['memberTileIds'] if t not in ids]
    cw = [t for t in dict.fromkeys(ids)]
    return contact_sheet(cw, 22, 2)


_gs = ground_sheet()
assert max(_gs.size) <= 820, _gs.size
save_img('sheet-ground', _gs, '땅·도로·표시 칸 모음(번호 = 시트 칸 번호, 원본 ×2). 아래 사전 표의 번호와 같다. 접지 그림자 칸·연석 칸은 `mc-dict-ground`.', C_START)


# ====================================================================== 조립·검증·쓰기
def finalize():
    cats = []
    for cid, c in CATS.items():
        imgs = [rec for (cat, rec) in IMAGES.values() if cat == cid]
        cats.append(dict(id=cid, name=c['name'], description=c['description'], documents=c['documents'], images=imgs))
    # --- 한도(contract: validation limits)
    assert len(cats) <= 32
    for c in cats:
        assert len(c['documents']) <= 64 and len(c['images']) <= 256, (c['id'], len(c['documents']), len(c['images']))
        for d in c['documents']:
            assert len(d['markdown']) <= 120000, (d['id'], len(d['markdown']))
            assert re.fullmatch(r'[\w.-]{1,100}', d['id']), d['id']
        for i in c['images']:
            assert re.fullmatch(r'[\w.-]{1,100}', i['id']) and re.fullmatch(r'^/assets/(?:[\w-]+/)*[\w.-]+\.(png|jpe?g|webp)$', i['dataUrl']), i
            assert os.path.exists(os.path.join(ROOT, 'public' + i['dataUrl'])), i
            assert 'data:' not in i['dataUrl']
    # --- 문서 재파싱 검증
    doc_ids = {d['id'] for c in cats for d in c['documents']}
    img_ids = {i['id'] for c in cats for i in c['images']}
    cat_ids = {c['id'] for c in cats}
    kit_set = set(S.kits)
    auto_ids = {g['id'] for g in D['autotileGroups']}
    problems = []
    n_fences = n_ints = 0
    CNT = collections.Counter()
    for c in cats:
        for d in c['documents']:
            md = d['markdown']
            for tok in set(re.findall(r'(?<![\w-])mc-[\w-]*[\w]', md)):
                if tok in kit_set or tok in doc_ids or tok in img_ids or tok in cat_ids or tok in auto_ids: continue
                if re.search(re.escape(tok) + r'(-?\*|-[<`])', md) and not re.search(re.escape(tok) + r'(?![\w-])(?!-[<`])', md): continue
                if tok in ('mc-bake',): continue
                problems.append((d['id'], 'unknown-token', tok))
            for m in re.finditer(r'```(json|text)\n(.*?)\n```', md, re.S):
                n_fences += 1
                body = m.group(2)
                if m.group(1) == 'json':
                    obj = json.loads(body)
                    def walk(o, path=''):
                        if isinstance(o, dict):
                            if 'kit' in o and 'tiles' in o:
                                kid = o['kit']; k = S.kits[kid]
                                exp_u = [[tnum(t) if t >= 0 else -1 for t in r['upperTiles']] for r in k['rows']]
                                exp_l = [[tnum(t) if t >= 0 else -1 for t in r['tiles']] for r in k['rows']]
                                if o['tiles'] not in (exp_u, exp_l): problems.append((d['id'], 'kit-array-mismatch', kid))
                                CNT['kitrec'] += 1
                            if 'kit' in o and 'lower' in o:
                                pass
                            for kk, v in o.items(): walk(v, path + '/' + kk)
                        elif isinstance(o, list):
                            for v in o: walk(v, path)
                    walk(obj)
                    # 칸 번호 범위: 배치 목록의 [kit,x,y]·표시 목록은 별도
                    if isinstance(obj, list) and obj and isinstance(obj[0], list) and isinstance(obj[0][0], str) and obj[0][0].startswith('mc-'):
                        for r in obj:
                            if r[0] not in kit_set: problems.append((d['id'], 'placement-kit', r[0]))
                            if not (0 <= r[1] < MW and 0 <= r[2] < MH): problems.append((d['id'], 'placement-xy', r))
                    elif isinstance(obj, list) and obj and isinstance(obj[0], list) and isinstance(obj[0][0], str):
                        for r in obj:
                            if not (0 <= r[1] < COUNT): problems.append((d['id'], 'mark-tile', r)); n_ints += 1
                else:   # layer text 배열
                    for ln in body.splitlines():
                        mm = re.match(r'y=\d+: (.*)$', ln)
                        vals = mm.group(1).split()
                        assert len(vals) == MW, (d['id'], len(vals))
                        for v in vals:
                            if v != '.':
                                n_ints += 1
                                if not (0 <= int(v) < COUNT): problems.append((d['id'], 'tile-range', v))
            # 칸 번호 문서(건물·소품) 안 모든 정수 배열 칸 범위
    # --- 예제 층 문서가 맵 배열과 동일한지 재파싱
    def read_layer(doc_ids_):
        vals = {}
        for did in doc_ids_:
            md = next(d['markdown'] for c in cats for d in c['documents'] if d['id'] == did)
            body = re.search(r'```text\n(.*?)\n```', md, re.S).group(1)
            vals.update(parse_layer(body))
        assert sorted(vals) == list(range(len(vals)))
        return [v for y in sorted(vals) for v in vals[y]]
    for name, ids_, arr in (('layer1', [PFX + 'example-layer1'], LOW), ('layer2', [PFX + 'example-layer2'], LO2), ('layer3', [PFX + 'example-layer3a', PFX + 'example-layer3b'], UPR), ('layer4', [PFX + 'example-layer4'], UP4)):
        got = read_layer(ids_)
        exp = [-1 if t < 0 else tnum(t) for t in arr]
        if got != exp: problems.append((name, 'layer-text-vs-map', sum(1 for a, b in zip(got, exp) if a != b)))
    # --- 문서가 말하는 모든 키트를 한 번은 내보냈는지(건물·소품·차량 전부)
    missing = sorted(kit_set - emitted_kits - {k for k, v in KI.items() if v['kind'] not in ('building', 'prop', 'vehicle', 'road')})
    if missing: problems.append(('coverage', 'kits-not-in-any-doc', missing[:10] + [len(missing)]))
    if problems:
        for p in problems[:40]: print('PROBLEM', p)
        raise SystemExit(f'문서 검증 실패 {len(problems)}건')
    print('verify ok: fences', n_fences, 'kit records', CNT['kitrec'], 'ints', n_ints)
    return cats


CATS_OUT = finalize()
import parking_bundle
parking_reference = parking_bundle.references(ROOT)
if parking_reference: CATS_OUT.append(parking_reference)
os.makedirs(MD_DIR, exist_ok=True)
for fn in os.listdir(MD_DIR):
    if fn.endswith('.md'): os.remove(os.path.join(MD_DIR, fn))
for fn, md in MD_FILES:
    open(os.path.join(MD_DIR, fn), 'w', encoding='utf-8').write(md)
json.dump(CATS_OUT, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
nd = sum(len(c['documents']) for c in CATS_OUT); ni = sum(len(c['images']) for c in CATS_OUT)
img_kb = sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)) / 1024
unused = sorted(set(os.listdir(IMG_DIR)) - {rec['dataUrl'].rsplit('/', 1)[1] for _, rec in IMAGES.values()})
for fn in unused: os.remove(os.path.join(IMG_DIR, fn))
print(json.dumps(dict(categories=len(CATS_OUT), documents=nd, images=ni, json_kb=round(os.path.getsize(OUT_JSON) / 1024), images_kb=round(img_kb), removed_stale=unused,
                      per_cat=[(c['id'], len(c['documents']), len(c['images'])) for c in CATS_OUT]), ensure_ascii=False))
