#!/usr/bin/env python3
"""jp_city 참고문서(AI-REFERENCE-CONTRACT 8항목) 굽기 — 번들이 소유한다.

  python3 scripts/content/jp-city/bake_refs.py             engine-results.json 을 읽어 문서·그림을 굽는다
  python3 scripts/content/jp-city/bake_refs.py --dump      먼저 엔진 덤프를 새로 돌린다(약 3분: npx tsx tiledata/jp-city/refs/engine_dump.mts)

입력  src/assets/jpCityTileset.json (칸 번호·그룹·오토타일·키트) · src/assets/jpCityBuildingSpec.json (건물 부품 사전·완성 예제 25)
      public/assets/jp-city/jp-city-chipset.png (48열 16px 시트) · tiledata/jp-city/{pins,kit-index,bake-report}.json
      tiledata/jp-city/refs/engine-results.json  ← engine_dump.mts 가 만든 **진짜 도구·엔진 실측**
        (build_jp_city_building · paint_tiles · fill_region · lay_path · stamp_object · stamp_layer_block 을 실제로 호출한 결과,
         isPassable · passabilityOf · tileLayerPolicy · autotileEngine 판정)
출력  src/assets/jpCityReferences.json          TilesetReferenceCategory[] (분류 id 접두 `jp-`, 그림은 `/assets/...` 경로 문자열만 — 바이트 없음)
      public/assets/jp-city-references/*.png    그림(긴 변 ≤ 820px, ≤128색, 확대는 nearest-neighbor 만)
      tiledata/jp-city/refs/*.md                같은 쪽의 출처 사본 + check-evidence.json
문서의 칸 번호·키트 id·좌표·오류 코드는 전부 정의 JSON·엔진 실측에서 읽은 것이다(손으로 쓴 값 금지). 쓰기 전에 문서를 다시 파싱해
정의에 없는 키트 id·범위 밖 칸 번호·키트 배열 불일치가 하나라도 있으면 실패한다. 그림은 시트에서 직접 합성한다(AI 모형 없음).
같은 입력이면 같은 바이트(난수·시각 없음).
"""
import argparse, collections, hashlib, json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
T = 16
PFX = 'jp-'
IMG_DIR = os.path.join(ROOT, 'public/assets/jp-city-references')
IMG_URL = '/assets/jp-city-references'
MD_DIR = os.path.join(ROOT, 'tiledata/jp-city/refs')
OUT_JSON = os.path.join(ROOT, 'src/assets/jpCityReferences.json')
ENGINE_JSON = os.path.join(MD_DIR, 'engine-results.json')

ap = argparse.ArgumentParser()
ap.add_argument('--dump', action='store_true', help='engine_dump.mts 를 먼저 다시 돌린다')
ARGS = ap.parse_args()
if ARGS.dump or not os.path.exists(ENGINE_JSON):
    print('engine_dump.mts 실행(약 3분) …', flush=True)
    subprocess.run(['npx', '--no-install', 'tsx', '--import', './tiledata/jp-city/refs/css-stub.mjs', 'tiledata/jp-city/refs/engine_dump.mts'], cwd=ROOT, check=True)

D = json.load(open(os.path.join(ROOT, 'src/assets/jpCityTileset.json'), encoding='utf-8'))
SPEC = json.load(open(os.path.join(ROOT, 'src/assets/jpCityBuildingSpec.json'), encoding='utf-8'))
PINS = json.load(open(os.path.join(ROOT, 'tiledata/jp-city/pins.json'), encoding='utf-8'))
REPORT = json.load(open(os.path.join(ROOT, 'tiledata/jp-city/bake-report.json'), encoding='utf-8'))
EN = json.load(open(ENGINE_JSON, encoding='utf-8'))
SHEET_PATH = 'public/assets/jp-city/jp-city-chipset.png'
SHEET = Image.open(os.path.join(ROOT, SHEET_PATH)).convert('RGBA')
COUNT, TPR, TID, TEX, FAMILY = D['count'], D['tilesPerRow'], D['id'], D['textureKey'], D['family']
SHEET_PX = SHEET.size
assert SHEET_PX == (TPR * T, -(-COUNT // TPR) * T), SHEET_PX
META = D['tileMeta']
KITS = {k['id']: k for k in D['structureKits']}
AT = {g['id']: g for g in D['autotileGroups']}
ST = SPEC['street']

FONT_S = ImageFont.load_default(size=8)
FONT = ImageFont.load_default(size=9)
for _p in ('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf'):
    if os.path.exists(_p):
        FONT_K = ImageFont.truetype(_p, 10); FONT_KS = ImageFont.truetype(_p, 9); break
else:
    FONT_K = FONT_KS = FONT

emitted_tiles = set()      # 문서에 적은 모든 칸 번호(검증용)
emitted_kits = set()


def tnum(t):
    t = int(t)
    assert -1 <= t < COUNT, t
    if t >= 0: emitted_tiles.add(t)
    return t


# ====================================================================== 그림 도구
_CELL = {}


def cell(t):
    if t not in _CELL:
        x, y = t % TPR * T, t // TPR * T
        _CELL[t] = SHEET.crop((x, y, x + T, y + T))
    return _CELL[t]


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST) if k > 1 else im


def quant(im):
    return im.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def checker(w, h, a=(70, 70, 78), b=(58, 58, 66), cell_=8):
    im = Image.new('RGBA', (w, h), a); d = ImageDraw.Draw(im)
    for y in range(0, h, cell_):
        for x in range(0, w, cell_):
            if (x // cell_ + y // cell_) % 2: d.rectangle([x, y, x + cell_ - 1, y + cell_ - 1], fill=b)
    return im


def text(d, xy, s, fill=(255, 255, 255, 255), font=FONT_K, outline=True):
    x, y = xy
    if outline:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)): d.text((x + dx, y + dy), s, fill=(0, 0, 0, 255), font=font)
    d.text(xy, s, fill=fill, font=font)


def render(layers, W, H, bg=(0, 0, 0, 255)):
    """layers: {'1'|'2'|'3'|'4': 평평한 칸 번호 배열(행 우선, -1 = 빈 칸)}. 에디터 그림 순서와 같다(1→2→3→4). 칸이 비면 검게 보인다."""
    im = Image.new('RGBA', (W * T, H * T), bg)
    for key in ('1', '2', '3', '4'):
        arr = layers.get(key)
        if not arr: continue
        for i, t in enumerate(arr):
            if t is not None and t >= 0: im.alpha_composite(cell(t), ((i % W) * T, (i // W) * T))
    return im


def mark_cells(im, cells, scale, color=(255, 40, 40, 255), width=2, pad=0):
    d = ImageDraw.Draw(im)
    for (x, y) in cells:
        d.rectangle([x * T * scale + pad, y * T * scale + pad, (x + 1) * T * scale - 1 - pad, (y + 1) * T * scale - 1 - pad], outline=color, width=width)
    return im


def _wrap(d, lab, width):
    """라벨을 그림 폭에 맞춰 줄바꿈(글자 단위)."""
    lines, cur = [], ''
    for ch in lab.replace('→', '->'):
        if cur and d.textlength(cur + ch, font=FONT_K) > width:
            lines.append(cur); cur = ch
        else: cur += ch
    lines.append(cur)
    return lines


def panels(items, gap=8, head=14, bg=(34, 34, 40, 255)):
    """items [(라벨, RGBA 이미지)] → 라벨 띠를 위에 단 나란한 그림(라벨은 그림 폭에서 줄바꿈)."""
    probe = ImageDraw.Draw(Image.new('RGBA', (4, 4)))
    wr = [_wrap(probe, lab, im.width) for lab, im in items]
    head = max(head, 12 * max(len(w) for w in wr) + 2)
    w = sum(i.width for _, i in items) + gap * (len(items) + 1)
    h = max(i.height for _, i in items) + head + gap * 2
    out = Image.new('RGBA', (w, h), bg); d = ImageDraw.Draw(out)
    x = gap
    for lines, (lab, im) in zip(wr, items):
        for li, line in enumerate(lines): d.text((x, 1 + 12 * li), line, fill=(255, 255, 255, 255), font=FONT_K)
        out.alpha_composite(im, (x, head + gap)); x += im.width + gap
    return out


def best_scale(widths, heights, gap=8, side=820, kmax=4):
    for k in range(kmax, 0, -1):
        if sum(w * k for w in widths) + gap * (len(widths) + 1) <= side and max(h * k for h in heights) + 14 + gap * 2 <= side: return k
    return 1


def contact_sheet(ids, cols, scale, label=True, bg=(46, 46, 54, 255), pad=3):
    """칸 번호 목록 → 번호 라벨이 붙은 모음 그림(투명 칸은 체크 무늬)."""
    cw = T * scale + pad; lh = 10 if label else 0
    rows = -(-len(ids) // cols)
    im = Image.new('RGBA', (cols * cw + pad, rows * (T * scale + lh + pad) + pad), bg); d = ImageDraw.Draw(im)
    for i, t in enumerate(ids):
        x = pad + (i % cols) * cw; y = pad + (i // cols) * (T * scale + lh + pad)
        c = up(cell(t), scale); b = checker(c.width, c.height); b.alpha_composite(c); im.alpha_composite(b, (x, y))
        if label: d.text((x, y + T * scale), str(t), fill=(255, 255, 255, 255), font=FONT_S)
    return im


IMAGES = collections.OrderedDict()      # 이름 → (분류, 기록)


def save_img(name, im, caption, cat):
    """긴 변 820 초과는 만들지 않는다(호출자가 쪼갠다)."""
    assert max(im.size) <= 820, (name, im.size)
    os.makedirs(IMG_DIR, exist_ok=True)
    quant(im).save(os.path.join(IMG_DIR, f'{name}.png'), optimize=True)
    rec = dict(id=f'{PFX}img-{name}', name=f'{name}.png', caption=caption, dataUrl=f'{IMG_URL}/{name}.png')
    IMAGES[name] = (cat, rec)
    return rec['id']


# ====================================================================== 글 도구
def md_table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '|'.join('---' for _ in head) + '|']
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)


def jline(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def jfences(items, maxc=11000, head=None):
    """목록은 항목마다 한 줄 — 한 펜스가 maxc 글자를 넘으면 새 펜스(페이지가 펜스 경계에서 온전히 끊긴다)."""
    out, cur, size = [], [], 0
    for it in items:
        s = jline(it)
        if cur and size + len(s) + 2 > maxc:
            out.append(cur); cur, size = [], 0
        cur.append(s); size += len(s) + 2
    if cur: out.append(cur)
    return '\n\n'.join('```json\n[\n' + ',\n'.join(c) + '\n]\n```' for c in out)


def flat_rows(rows, w=None):
    """2차원 → 줄마다 `y=NN: 번호 번호 …`(-1 은 '.')."""
    return '\n'.join(f'y={y:02d}: ' + ' '.join('.' if v < 0 else str(tnum(v)) for v in r) for y, r in enumerate(rows))


def to_rows(flat, W):
    return [flat[i:i + W] for i in range(0, len(flat), W)]


def runs_of(ids):
    ids = sorted(ids); out = []; s = p = None
    for i in ids:
        if s is None: s = p = i
        elif i == p + 1: p = i
        else: out.append((s, p)); s = p = i
    if s is not None: out.append((s, p))
    return out


def fmt_runs(runs, limit=14):
    parts = [f'{a}' if a == b else f'{a}~{b}' for a, b in runs]
    if len(parts) > limit: return ', '.join(parts[:limit]) + f' … (총 {len(parts)}구간)'
    return ', '.join(parts)


HEAD = (f'tilesetId `{TID}` · 그림 `{SHEET_PATH}`(텍스처 `{TEX}`, **{COUNT}칸**, 16px 칸, 시트 {SHEET_PX[0]}×{SHEET_PX[1]}px, 한 줄 **{TPR}칸** — 번호 n 의 칸은 '
        f'열 n%{TPR}, 행 n÷{TPR}(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `{FAMILY}` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.')
CATS = collections.OrderedDict()
MD_FILES = []


def new_cat(cid, name, desc):
    CATS[f'{PFX}{cid}'] = dict(id=f'{PFX}{cid}', name=name, description=desc, documents=[])
    return f'{PFX}{cid}'


def add_doc(cat, did, name, md):
    CATS[cat]['documents'].append(dict(id=f'{PFX}{did}', name=name, markdown=md))
    MD_FILES.append((f'{did}.md', md))


def label_of(t):
    return META[t].get('label') or ''


def kit_rows(k, key):
    return [[tnum(t) for t in r[key]] for r in k['rows']]


def codes_str(rows):
    return rows


def tool_json(obj):
    return '```json\n' + json.dumps(obj, ensure_ascii=False, separators=(', ', ': ')) + '\n```'


# ====================================================================== 데이터 파생(전부 정의 JSON 에서)
AUD = EN['layerAudit']
CODES = AUD['codes']          # 칸 번호 → 'h w d' 세 글자: 홈(l/u/b) · 걷기(1/0) · 그림 순서(a 항상 위 / b 캐릭터 아래 / y 캐릭터와 y정렬)


def code_text(t):
    c = CODES[t]
    if not c: return '(빈 칸·미사용)'
    home = {'l': '아래층(1층)', 'u': '위층(3층)', 'b': '양쪽'}[c[0]]
    walk = '걸음' if c[1] == '1' else '막힘'
    depth = {'a': '항상 캐릭터 위', 'b': '캐릭터 아래', 'y': '캐릭터와 y 정렬'}[c[2]]
    return f'{home}·{walk}·{depth}'


GROUP_FAMILY = {}
for _g in D['tileGroups']:
    _p = _g['id'].split(':')
    for _t in _g['tileIds']:
        GROUP_FAMILY.setdefault(_t, _p[1] if _p[1] in ('band', 'deco', 'prop', 'street') else 'block')
PIN_BLOCK = collections.defaultdict(list)
for _k, _v in PINS['cells'].items():
    PIN_BLOCK[_k.split('/')[0]].append(_v)
REGION = {}
for _t in range(COUNT):
    _l = label_of(_t)
    if _l.startswith('빈 칸'): REGION[_t] = 'people'
    elif _l.startswith('미사용'): REGION[_t] = 'unused'
    elif _t in GROUP_FAMILY and GROUP_FAMILY[_t] != 'block': REGION[_t] = GROUP_FAMILY[_t]
    else: REGION[_t] = '?'
for _t in PIN_BLOCK['jp16c']: REGION[_t] = 'composite'
for _t in range(3133, 3137): REGION[_t] = 'pcvariant'
for _b, _name in (('autotiles_ground', 'at8'), ('autotiles_lines', 'at4'), ('roads', 'roadblock'), ('buildings', 'bldgblock'), ('street_hand', 'streethand'), ('school', 'schoolblock'), ('transit_street', 'transitstreet'), ('transit_station', 'transitstation'),
               ('interior_shell', 'interior'), ('interior_entry', 'interior'), ('interior_washitsu', 'interior'), ('interior_ldk', 'interior'), ('interior_wet', 'interior'), ('interior_bed', 'interior'), ('interior_doors', 'interior')):
    for _t in PIN_BLOCK[_b]: REGION[_t] = _name
assert '?' not in set(REGION.values()), [t for t in REGION if REGION[t] == '?'][:10]
RUNS = {r: runs_of([t for t in range(COUNT) if REGION[t] == r]) for r in set(REGION.values())}
NCELL = {r: sum(b - a + 1 for a, b in RUNS[r]) for r in RUNS}
for _r in ('people', 'unused'): assert NCELL[_r] == (155 if _r == 'people' else 110), (_r, NCELL[_r])

N_KITS = collections.Counter(k.split('-')[1] for k in KITS)      # recipe/road/door/prop/fumikiri/underpass/footbridge
ROAD_KITS = [k for k in KITS if k.startswith(('jp-road-', 'jp-fumikiri', 'jp-underpass', 'jp-footbridge'))]
RECIPES = [k for k in KITS if k.startswith('jp-recipe-')]
DOORS = [k for k in KITS if k.startswith('jp-door-')]
PROPS = [k for k in KITS if k.startswith('jp-prop-')]
KIT_INDEX = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'kit-index.json'), encoding='utf-8'))['kits']
EXAMPLE_KITS = {b: [k for k in KITS if (KIT_INDEX.get(k, {}).get('source') or {}).get('block') == b] for b in ('school', 'transit_street', 'transit_station')}
_EXAMPLE_KIT_SET = {k for v in EXAMPLE_KITS.values() for k in v}
INTERIOR_KITS = [k for k in KITS if k.startswith('jp-in-')]
STREETH = [k for k in KITS if not re.match(r'jp-((recipe|road|door|prop|bldg|in)-|fumikiri|underpass|footbridge)', k) and k not in _EXAMPLE_KIT_SET]
assert (len(ROAD_KITS), len(RECIPES), len(DOORS), len(PROPS)) == (39, 25, 9, 142), (len(ROAD_KITS), len(RECIPES), len(DOORS), len(PROPS))
assert len(AT) == 17 and len(SPEC['examples']) == 25 and len(SPEC['decos']) == 73 and len(SPEC['bands']) == 60


# ====================================================================== 분류 1 — 읽는 순서·시트 지도
C_START = new_cat('start', '일본 도시 · 읽는 순서·시트 지도',
                  'jp_city(일본 상가 거리 손 도트 번들 칩셋)를 처음 깔 때 읽는 입구: 이 타일셋이 무엇이고 무엇이 없는지·읽는 순서·층과 통행(엔진 판정)·실행 순서·도구 지도·칸 번호 영역 지도·거리 칸 사전·그룹 사전.')


def doc_order():
    A = EN['atMatrix']
    return f'''# 일본 도시 (jp_city) — 읽는 순서 · 층과 통행 · 실행 순서

{HEAD}

modern3 팔레트(154색) 손 도트로 그린 **일본 상가 거리** 칩셋이다. 건물 한 채는 낱칸이 아니라 **띠 부품 조립**(지붕 + 층 N + 1층 띠, `build_jp_city_building`)이고,
땅은 **오토타일 {len(AT)}세트**, 도로·교차로·건널목은 **키트 {len(ROAD_KITS)}종**, 완성 상가 건물은 **레시피 키트 {len(RECIPES)}종**(문 {len(DOORS)}종), 거리 소품은 **키트 {len(PROPS)}종**이다
(구조 키트 총 {len(KITS)}종, 타일 그룹 {len(D['tileGroups'])}개). 낱칸으로 건물·소품을 칠하지 않는다 — 칸 번호는 같은 그림이 여러 키트에 공유되어 낱칸만 봐서는 무엇인지 알 수 없다.

## 이 타일셋에 없는 것 (쓰지 말 것)
- **사람(행인)**: 없다. 851~1005({NCELL['people']}칸)은 행인이 있던 자리의 **빈 칸**(번호만 유지, 통행 막힘)이다 — 칠하지 않는다. 행인·NPC 는 이벤트의 캐릭터 그래픽(Actor1 등)으로 둔다.
- **움직이는 칸**: 없다(`animationStrips` {len(D['animationStrips'])}개). 연못·수로 물도 정지 그림이다.
- **실내**: 없다. 거리와 건물 외관만이다. 실내는 다른 칩셋의 실내 맵으로 만든다.
- **止まれ(정지) 글자**: 역삼각 표지(`jp-road-sign-tomare`, 글자 없음)와 별개로 노면 글자 키트 `jp-road-mark-tomare-n/e/s/w`(JIS 16×16 글리프, 운전자가 읽는 방향 4가지)가 있다. 위에서 보는 지도에서는 동·서·남행은 글자가 돌아가 있어 읽기 어렵다 — 북행(글자가 바로 선다)을 우선 쓴다.
- **구역 세트**: 주택가(블록 담·문기둥·카포트·생활 소품)·생활도로(가장자리 표시·「30」)·전봇대·전선·작은 신사·학교 정문은 용도 「손 도트 거리 시설」, 역·학교·신사 건물은 용도 「손 도트 건물」. 공원은 소품(나무·놀이기구·벤치)으로 짓는다. 동네 한 장 조립 예제는 장소 「일본 도시 · 동네 한 장」(`scripts/content/jp-city/maps/town.mjs`).
- 다른 칩셋(버들항·현대 도시·조선·EasyRPG)의 칸 번호를 이 맵에 섞지 않는다. 같은 번호가 전혀 다른 그림이다.

## 읽는 순서
1. 이 문서 → 2. `jp-sheet-map`(칸 번호 영역 지도 + 거리 칸 사전) · `jp-dict-groups`(그룹 사전) →
3. 용도 「오토타일」(17세트: 사용법 `jp-at-usage` + 세트별 문서) → 4. 용도 「도로·교차로 키트」 →
5. 용도 「건물 조립 도구」(`jp-bld-tool` → 부품 사전 → 완성 예제 25) → 6. 용도 「상가 키트·문·소품」 → 7. 용도 「손 도트 건물」(`jp-bldg-hand-rules`) → 8. 용도 「손 도트 거리 시설」(`jp-street-hand-rules`) → 9. 용도 「정상/오류·자동 검사」.
이 문서를 건너뛰고 칸 번호부터 쓰면 안 된다. 같은 그림의 통행이 맥락(건물 아래 두 줄·문·소품 윗줄)마다 다르다(복제 칸 `jp16/<번호>@<종류>` 가 시트 끝에 있다).

## 층과 통행 (엔진 판정 — 칸 {AUD['checked']}개를 엔진 함수로 대조: `src/editor/tileLayerPolicy.ts` · `src/project/collision.ts` · `src/player/characterDepth.ts`)
| 층 | 맵 칸 | 이 칩셋에서 싣는 것 | 그림 순서 |
|---|---|---|---|
| 1층 | `lowerTiles`(빈칸 -1 은 검게 보인다) | 불투명 땅: 보도·도로·잔디·자갈·판석·물·선로·주차장 | 맨 아래 |
| 2층 | `lowerOverlayTiles`(선택) | **투명 덧그림**: 중앙선·차선 점선·횡단보도·점자블록(오토타일), 도로 표시, 생활도로 가장자리 側溝·흰 선·「30」(`jp-mark-*`) | 땅 위, 캐릭터 아래 |
| 3층 | `upperTiles` | 건물·소품·담·생울타리·철망·가드레일, 도로 키트의 표시·화살표 칸 | 막힘 칸은 캐릭터와 y 정렬, ★ 칸은 항상 캐릭터 위 |
| 4층 | `upperOverlayTiles`(선택) | 3층 칸 위에 또 얹는 부착물(건물 띠 + 부착물 한 장까지 — 건물 조립 도구가 쓴다), **전봇대·전선**(`jp-pole*`·`jp-wire-*`, 건물 앞에 서므로 3층 건물 칸을 지우지 않게) | 3층 위 |

칸 하나의 판정(엔진 실측, 칸 수):
{md_table(['홈 레이어(붓)', '걷기', '그림 순서', '칸 수', '무엇'], [
    ['위층', '걸음 ★', '항상 캐릭터 위', AUD['kindCount']['star|prio=upper|home=upper|depth=above'], '건물 윗층·처마·옥상·소품 윗부분'],
    ['위층', '막힘', '캐릭터와 y 정렬', AUD['kindCount']['solid|prio=upper|home=upper|depth=ysort'], '건물 아래 두 줄·문·소품 밑동·담·가드레일'],
    ['아래층', '걸음', '캐릭터 아래', AUD['kindCount']['passable|prio=lower|home=lower|depth=below'], '불투명 땅(보도·도로·잔디 …)'],
    ['아래층', '막힘', '캐릭터와 y 정렬', AUD['kindCount']['solid|prio=lower|home=lower|depth=ysort'], '막힌 땅(연못·수로 물)'],
    ['위층', '걸음', '캐릭터 아래', AUD['kindCount']['passable|prio=lower|home=upper|depth=below'], '**투명 덧그림**(중앙선·표시·점자블록·소품 아랫단)'],
    ['위층', '걸음 ★(계단)', '캐릭터 아래', AUD['kindCount']['star|prio=upper|home=upper|depth=below'], '돌계단·계단 칸(걸어 오르내리는 계단은 엔진이 아래로 그린다)'],
])}
- 통행: 맨 위 층(4→3→2)부터 내려가며 빈칸과 ★ 를 건너뛰고 **처음 만난 칸의 통행**이 그 칸을 정한다. 없으면 1층이 정한다. 1층이 비면 막힘.
- **투명하다고 위층에 두는 것이 아니다**(투명 여부·홈 레이어·통행·그림 순서는 별개 정보): 투명 오버레이(중앙선 등)는 홈이 위층이지만 오토타일 모양 재계산은 **2층**에서 된다(`jp-at-usage` 실측). 건물 몸채는 불투명이어도 위층 칸이다.
- 칸 통행의 정본은 엔진이다. 이 표는 `tiledata/jp-city/refs/engine_dump.mts` 가 엔진 함수를 직접 불러 센 값이다.

## 실행 순서 (한 장면을 만들 때)
1. **땅**: 보도·도로·잔디·물은 오토타일로 칠한다(`fill_region`/`lay_path`/`paint_tiles`, 용도 「오토타일」). 선로·중앙선 같은 선형은 `paint_tiles` 의 line.
2. **도로 키트**: 교차로·T자·굽은 길·건널목은 키트를 `stamp_object` 로 찍는다(용도 「도로·교차로 키트」). 키트는 서로 이어 붙이고, 오토타일과는 이음새가 닫힌다(한계).
3. **건물**: 문 앞 바닥(보도)을 **먼저** 깔고, **뒷줄 건물을 앞줄보다 먼저** `build_jp_city_building` 으로 짓는다(용도 「건물 조립 도구」). 완성 레시피를 그대로 찍으려면 `stamp_object`.
4. **소품**: 가로등·자판기·나무·차량은 키트로 찍는다. 문 앞 접근칸(문 바로 아래 한 줄)을 막지 않는다(용도 「상가 키트·문·소품」).
5. **검사**: 오류 코드·좌표 표(용도 「정상/오류·자동 검사」)로 맞춘다. 이벤트 실행(문 이동)·미적 품질은 검사 범위 밖이다.

## 도구 지도 (실제 호출로 확인한 것만)
{md_table(['도구', '이 타일셋에서', '확인한 사실'], [
    ['`paint_tiles`', '오토타일 낱칸 칠하기(rect/line/cells)', '`layer` 는 문자열 "1"~"4"(또는 lower/upper). 17세트 전부 칠한 뒤 이웃에 맞춰 자동 재성형(검사 오류 0). 투명 덧그림 칸을 "1" 로 요청하면 3층으로 **돌려 놓고 재성형하지 않는다**'],
    ['`fill_region`', '면 채우기: 보도 연석·생활도로·잔디·자갈 참배길·판석 광장·연못·수로', 'material = 그룹 이름(한국어). 블록담·생울타리·철망 울타리·가드레일은 「면 채우기 재료가 아님」으로 거부'],
    ['`lay_path`', '경유점을 잇는 길(8방 오토타일 7종만)', '선형 4방 10세트는 `path-needs-autotile` 로 거부'],
    ['`stamp_object`', '키트 찍기', 'objectId = `kit:jp_city/<키트 id>`, (x,y) = 키트 **왼쪽 위** 칸. -1 칸은 맵을 건드리지 않는다'],
    ['`stamp_layer_block`', '층별 배열을 그대로 찍기', '1·2층 오토타일 칸은 기본 재성형(`reshape:false` 면 번호 그대로). **3층 오토타일(담·울타리)은 재성형 안 됨**'],
    ['`build_jp_city_building`', '건물 한 채(L자 포함) 조립', '오류가 하나라도 있으면 맵을 한 칸도 바꾸지 않는다. jp_city 맵에서만 동작'],
    ['`list_jp_city_building_parts`', '부품 사전·완성 예제 조회', '`example` 로 예제 입력을 받는다(x,y 만 더해 그대로 짓는다)'],
    ['`list_tileset_references` / `read_tileset_reference`', '이 문서 읽기', '용도의 MD 모든 페이지·이미지를 읽은 뒤 배치한다'],
])}
'''


add_doc(C_START, 'order', '일본 도시 · 읽는 순서·층과 통행·실행 순서', doc_order())


def doc_sheet_map():
    reg = [
        ('band', '건물 층 띠', '건물 한 채를 이루는 띠 부품 칸(왼쪽 끝 · 몸통 변형 · 오른쪽 끝) 60종. **낱칸으로 칠하지 말고 `build_jp_city_building`**'),
        ('deco', '부착물', '간판·문·실외기·차양·창가림·비상계단 등 73종의 칸. 문(`door.*`)은 건물 1층 위에 얹는다'),
        ('street', '거리 바닥', '보도·도로·횡단보도·주차장·잔디·판석·선로·물 등 거리 칸 43칸(`jp:street:*`). 아래 사전'),
        ('unused', '미사용 원본 칸', '원본 번호만 지킨다(키트·그룹에 안 씀). 쓰지 않는다'),
        ('people', '행인 자리(빈 칸)', 'Actor1 행인이 있던 자리. 투명 빈 칸 · 막힘. **쓰지 않는다**'),
        ('prop', '소품 칸', '소품 키트 142종의 재료 칸(가로등·자판기·나무·차량·열차·신사 문·계단 …). **키트로 찍는다**'),
        ('composite', '겹쳐 구운 건물 칸', '건물 레시피 키트 안에서 문·간판을 건물 칸과 한 칸에 구워 합친 칸. **레시피 키트 안에서만**'),
        ('pcvariant', '통행 변형 복제 칸', '같은 그림을 다른 통행으로 쓰는 복제 칸(`jp16/<번호>@<종류>`) 4칸'),
        ('at8', '지면 8방 오토타일', '7세트 × 49칸 — 용도 「오토타일」'),
        ('at4', '선형 4방 오토타일', '10세트(블록담·생울타리·철망·가드레일·선로·중앙선·점선·횡단보도 둘·점자블록) — 용도 「오토타일」'),
        ('roadblock', '도로 키트 블록', '도로·교차로·건널목·지하도·육교·표지 키트의 재료 칸 112칸(오토타일 칸을 화소 그대로 복사한 칸 포함) — 용도 「도로·교차로 키트」'),
        ('bldgblock', '손 도트 건물 키트 블록', f'손 도트 일본 건물 {sum(1 for k in KITS if k.startswith("jp-bldg-"))}종(주택·아파트·가게·음식점·상업·공공·공장)의 재료 칸. **키트로 통째 찍는다** — 용도 「손 도트 건물」'),
        ('streethand', '손 도트 거리 시설 블록', f'전봇대·전선·노면 표시·블록 담·문기둥·카포트·생활 소품·도리이 등 {len(STREETH)}종 키트의 재료 칸. **키트로 찍는다**(전봇대·전선 4층, 노면 표시 2층) — 용도 「손 도트 거리 시설」'),
        ('schoolblock', '손 도트 小学校 블록', f'교정 흙·트랙 선·놀이기구·수영장·정문 등 小学校 키트 {len(EXAMPLE_KITS["school"])}종의 재료 칸. **키트로 찍는다**(트랙 선 2층) — 용도 「손 도트 小学校」'),
        ('transitstreet', '손 도트 노면전차 거리 블록', f'노면전차 레일·차막이·정류장 섬·導流帯·가선·전주·지하철 출입구 키트 {len(EXAMPLE_KITS["transit_street"])}종의 재료 칸. **키트로 찍는다**(레일 2층, 가선 4층) — 용도 「탈것·노면전차·지하철」'),
        ('interior', '손 도트 일본 집 실내 블록', f'바닥 7·벽면 5·천장 띠·가구 {len(INTERIOR_KITS)}종·탁자·탁상 물건의 재료 칸. **build_hand_interior_room({{tileset:"jp_city"}}) 로 짓는다**(낱칸으로 칠하지 않는다) — 용도 「일본 집 실내」'),
        ('transitstation', '손 도트 지하철역 블록', f'콘코스·승강장 바닥·벽·선로·개찰구·칸막이·매표기·계단·역무실·기둥·천장·간판 키트 {len(EXAMPLE_KITS["transit_station"])}종의 재료 칸 — 용도 「탈것·노면전차·지하철」'),
    ]
    rows = []
    for key, name, desc in reg:
        rows.append([name, fmt_runs(RUNS[key]), NCELL[key], desc])
    tot = sum(NCELL.values()); assert tot == COUNT, (tot, COUNT)
    street = [[n, ST[n], label_of(ST[n]), code_text(ST[n])] for n in ST]
    pc_note = md_table(['칸 종류(pc)', '층(priority)', '통행', '홈 레이어', '쓰임'], [
        ['floor', '아래', '걸음', '아래', '불투명 땅(보도·도로·잔디 …)'], ['solidfloor', '아래', '막힘', '아래', '불투명인데 막힌 땅(물)'],
        ['flat', '아래', '걸음', '위(덧그림)', '투명 바닥 표시·소품 아랫단(캐릭터 밑)'], ['solid', '위', '막힘', '위', '건물 아래 두 줄·문·소품 밑동·담·가드레일'],
        ['star', '위', '걸음 ★', '위', '건물 윗층·처마·옥상·소품 윗부분(사람 위에 그려짐)'], ['blank', '아래', '막힘', '아래', '빈 칸(행인 자리)']])
    return f'''# 일본 도시 — 칸 번호 영역 지도 · 거리 칸 사전

{HEAD}

## 번호 → 칸 위치 (0 기준)
`열 = n % {TPR}`, `행 = n ÷ {TPR}`(내림), 픽셀 `(열×16, 행×16)`. 예: 번호 {ST['sw']}(보도 포석) → 열 {ST['sw'] % TPR}, 행 {ST['sw'] // TPR}, 픽셀 ({ST['sw'] % TPR * T}, {ST['sw'] // TPR * T}).
시트는 {COUNT}칸 = {COUNT // TPR}줄 × {TPR}칸(높이 {SHEET_PX[1]}px ≤ 4096). 칸 번호는 **덧붙이기 전용**이다 — 다시 구워도 앞 번호는 그대로이고 새 칸은 끝에 붙는다.

## 영역 지도 (번호 구간은 정의 JSON 에서 센 값)
{md_table(['영역', '번호 구간', '칸 수', '내용·쓰는 법'], rows)}
합계 {tot}칸 = 시트 칸 수 {COUNT} (겹침·빠짐 없음).

## 칸의 통행 종류(pc)
{pc_note}
한 칸 번호는 통행이 하나뿐이다. 같은 그림이 맥락마다 다른 통행을 요구하면 복제 칸을 시트 끝에 덧붙였다(원본 번호는 안 움직인다).

## 거리 칸 사전 (건물 조립·도구가 쓰는 이름 → 칸 번호)
`jp_city` 의 거리 바닥 칸 이름이다(건물 조립 도구의 `yard`·문 앞 바닥, 완성 예제의 보도). 판정은 엔진 실측이다.
{md_table(['이름', '칸 번호', '라벨', '엔진 판정(홈·통행·그림 순서)'], street)}
- 같은 번호를 여러 이름이 가리킬 수 있다(`road_c`·`lane_c` = {ST['road_c']} 등) — 이름은 쓰임새 구분이고 그림은 같다.
- 보도 `sw` = {ST['sw']}, 도로 `road_c` = {ST['road_c']}, 잔디 `lawn` = {ST['lawn']}, 자갈 `gravel` = {ST['gravel']}, 물 `water` = {ST['water']}(막힘).
'''


add_doc(C_START, 'sheet-map', '일본 도시 · 칸 번호 영역 지도·거리 칸 사전', doc_sheet_map())


def doc_dict_groups():
    items = []
    for g in D['tileGroups']:
        t = g['tileIds']
        for x in t: tnum(x)
        items.append({'id': g['id'], 'name': g['name'], 'role': g['role'], 'layer': g['defaultLayer'], 'n': len(t), 'from': min(t), 'to': max(t)})
    by = collections.Counter(g['role'] for g in D['tileGroups'])
    return f'''# 일본 도시 — 타일 그룹 사전 ({len(items)}개)

{HEAD}

그룹은 「같은 뜻의 칸 묶음」이다(`fill_region`·`lay_path` 의 material 은 그룹 **이름**으로 찾는다 — id 를 넣지 않는다). 항목 = `id`·한국어 이름·역할(role)·기본 층(layer: 멤버 칸의 엔진 홈에서 유도 — 전부 위 `upper`, 전부 아래 `lower`, 섞이면 `mixed` 로 칸마다 엔진이 판정)·칸 수(n)·번호 최소~최대(`from`~`to`, 구간 사이에 다른 칸이 끼어 있을 수 있다).
역할별 개수: {', '.join(f'{k} {v}' for k, v in sorted(by.items()))}.
id 머리 `jp:band:` = 건물 층 띠, `jp:deco:` = 부착물, `jp:street:` = 거리 바닥, `jp:prop:` = 소품 칸, 그 밖(`jp:sidewalk-curb` 등) = 오토타일·도로 키트 칸.
정확한 칸 목록은 정의 JSON(`src/assets/jpCityTileset.json` 의 `tileGroups[].tileIds`)이 정본이고, 건물 띠·부착물의 **칸 배열**은 용도 「건물 조립 도구」의 부품 사전에 전부 있다.

{jfences(items)}
'''


add_doc(C_START, 'dict-groups', '일본 도시 · 타일 그룹 사전', doc_dict_groups())


def img_start():
    sheet_small = SHEET.copy()
    bg = checker(*sheet_small.size); bg.alpha_composite(sheet_small)
    s = 820 / bg.height
    ov = bg.resize((int(bg.width * s), 820), Image.LANCZOS)
    save_img('sheet-overview', ov, f'시트 전체 개요({SHEET_PX[0]}×{SHEET_PX[1]}px 를 820px 높이로 줄인 것 — **원본 해상도 아님**, 투명 칸은 체크 무늬). 영역 지도는 `jp-sheet-map`.', C_START)
    street_ids = list(dict.fromkeys(ST.values()))
    sh = contact_sheet(street_ids, 12, 3)
    save_img('sheet-street', sh, f'거리 칸 모음(번호 = 시트 칸 번호, 원본 ×3, 중복 번호 제거 {len(street_ids)}칸). `jp-sheet-map` 의 거리 칸 사전과 같은 번호.', C_START)
    strips = []
    for key, name in (('band', '건물 층 띠'), ('deco', '부착물'), ('prop', '소품'), ('composite', '겹쳐 구운 건물 칸'), ('at8', '지면 8방 오토타일'), ('at4', '선형 4방 오토타일'), ('roadblock', '도로 키트 블록')):
        first = [t for t in range(COUNT) if REGION[t] == key][:24]
        strips.append((f'{name} — 번호 {first[0]}~ (처음 24칸)', contact_sheet(first, 12, 2)))
    h = sum(i.height for _, i in strips) + 14 * len(strips) + 8
    im = Image.new('RGBA', (max(i.width for _, i in strips) + 8, h), (34, 34, 40, 255)); d = ImageDraw.Draw(im); y = 4
    for lab, i in strips:
        d.text((4, y), lab, fill=(255, 255, 255, 255), font=FONT_K); im.alpha_composite(i, (4, y + 13)); y += i.height + 14
    save_img('sheet-regions', im, '영역별 대표 칸(각 영역의 처음 24칸, 원본 ×2, 번호 라벨). 영역 구간은 `jp-sheet-map`.', C_START)


img_start()


# ====================================================================== 분류 2 — 오토타일 17세트
C_AT = new_cat('autotile', '일본 도시 · 오토타일 17세트',
               '지면 8방 7종(보도 연석·생활도로·잔디·자갈 참배길·판석 광장·연못·수로)과 선형 4방 10종(블록담·생울타리·철망·가드레일·선로·중앙선·차선 점선·횡단보도 둘·점자블록): 세트마다 칸 번호 사전·이웃 마스크→칸 규칙·쓰는 도구와 층·입력→전체 배열→그림·정상/오류 그림과 자동 좌표 검증.')
AT_DEMO = {a['id']: a for a in EN['autotiles']}
AT_MAT = {m['id']: m for m in EN['atMatrix']}
LAYER_NAME = {1: '1층(lowerTiles)', 2: '2층(lowerOverlayTiles)', 3: '3층(upperTiles)'}
LAYER_ARG = {1: '"1"', 2: '"2"', 3: '"3"'}
AT_INFO = {
    'jp-sidewalk-curb': ('아스팔트 도로(`road_c` 칸)', '보도 한 덩이의 둘레에 연석. 높은 지형이라 **남쪽 변에 앞면**(3/4 시점). 안쪽 모서리는 연석 모서리 사선 접합.'),
    'jp-lane-road': ('집 앞 콘크리트(`sw` 칸)', '보도 없는 생활도로 아스팔트. 가장자리에 1px 간격의 흰 외측선.'),
    'jp-lawn-dirt': ('맨흙(`gravel` 칸)', '잔디 덩이. 바깥 = 맨흙.'),
    'jp-gravel-lawn': ('잔디(`lawn` 칸)', '자갈 참배길(신사 길 느낌). 바깥 = 잔디.'),
    'jp-plaza-pave': ('잔디(`lawn` 칸)', '판석 광장. 높은 지형이라 **남쪽 변에 앞면**.'),
    'jp-water-pond': ('잔디(`lawn` 칸)', '연못 물(막힘). 낮은 지형이라 **북쪽 변에 앞면**(호안). 정지 그림.'),
    'jp-water-canal': ('콘크리트 보도(`sw` 칸)', '수로 물(막힘). 낮은 지형이라 북쪽 변에 앞면.'),
    'jp-wall-block': ('(위층 덧그림 — 아래는 보도 `sw`)', '블록담. 위층·막힘. 담 칸은 한 칸 안(윗면 + 앞면)에 그려 사람이 담 남쪽 칸에 서면 머리 윗 8px 가 담 앞면에 가려진다.'),
    'jp-hedge': ('(위층 덧그림 — 아래는 잔디 `lawn`)', '생울타리. 위층·막힘.'),
    'jp-fence-mesh': ('(위층 덧그림 — 아래는 보도 `sw`)', '철망 울타리. 위층·막힘.'),
    'jp-guardrail': ('(위층 덧그림 — 아래는 보도 `sw`)', '가드레일. 위층·막힘(투명이라 solid 위층 칸).'),
    'jp-rail-track': ('자갈(`gravel` 칸)', '선로. **불투명 1층 땅**(걸을 수 있음). T·십자는 분기기 없이 평면 교차로 그렸다.'),
    'jp-lane-center': ('(2층 투명 덧그림 — 아래는 도로 `road_c`)', '중앙선(노란 이중선). 투명·걸을 수 있음·캐릭터 밑.'),
    'jp-lane-dash': ('(2층 투명 덧그림 — 아래는 도로 `road_c`)', '차선 경계 점선. 투명·걸을 수 있음.'),
    'jp-crosswalk-ew': ('(2층 투명 덧그림 — 아래는 도로 `road_c`)', '횡단보도(동서로 건너는 줄). 양 끝·몸통·외딴 4칸은 그림이 같다(줄 간격이 칸 주기라 키만 4종).'),
    'jp-crosswalk-ns': ('(2층 투명 덧그림 — 아래는 도로 `road_c`)', '횡단보도(남북으로 건너는 줄). 키 4종.'),
    'jp-tactile': ('(2층 투명 덧그림 — 아래는 보도 `sw`)', '점자블록 선. 투명·걸을 수 있음.'),
}
BIT8 = [('N', 1), ('E', 2), ('S', 4), ('W', 8), ('NE', 16), ('SE', 32), ('SW', 64), ('NW', 128)]


def at_range(g):
    m = g['memberTileIds']; return min(m), max(m)


def mask_text(m, nbr):
    names = [n for n, b in BIT8 if m & b and (nbr == 8 or b < 16)]
    return '+'.join(names) if names else '(이웃 없음)'


def suffix_label(g, t):
    l = label_of(t); p = g['name'] + ' · '
    return l[len(p):] if l.startswith(p) else l


def canon8(m):
    c = m & 15
    for adj, diag in ((3, 16), (6, 32), (12, 64), (9, 128)):
        if m & adj == adj and m & diag: c |= diag
    return c


def at_dict_items(g):
    nbr = g.get('neighborhood', 4)
    vm = g['variantMap']
    keys = sorted({canon8(m) for m in range(256)}) if nbr == 8 else sorted(range(16))
    for k in keys: assert str(k) in vm, (g['id'], k)
    if nbr == 8:
        for m in range(256): assert vm[str(m)] == vm[str(canon8(m))], (g['id'], m)
    return [{'mask': k, 'nbrs': mask_text(k, nbr), 'tile': tnum(vm[str(k)]), 'label': suffix_label(g, vm[str(k)])} for k in keys]


def at_pattern_text(pat):
    return '\n'.join(f'y={y:02d}: {row}' for y, row in enumerate(pat))


def issue_rows(issues, key=None):
    return [(i['x'], i['y']) for i in issues if key is None or i['code'] == key]


def fmt_coords(cs, n=8):
    s = ' '.join(f'({x},{y})' for x, y in cs[:n])
    return s + (f' … (총 {len(cs)}칸)' if len(cs) > n else '')


def doc_at_usage():
    canon = EN['canonRule']
    rows = []
    for gid, g in AT.items():
        a, b = at_range(g); d = AT_DEMO[gid]
        tool = ('`fill_region`(면)·`lay_path`(길)·`paint_tiles`' if g.get('neighborhood', 4) == 8 else
                '`paint_tiles`(line/cells)')
        rows.append([f'`{gid}`', g['name'], f"{g.get('neighborhood', 4)}방", f'{a}~{b}({len(g["memberTileIds"])}칸)', LAYER_NAME[d['layer']], tool, f'`jp-at-{gid[3:]}`'])
    mat = []
    for gid in AT:
        m = AT_MAT[gid]; d = AT_DEMO[gid]
        def ent(layer):
            p = m['paint'][layer]; return f"{p['landed']}층에 놓임·{'정상' if p['stale'] == 0 else '재계산 안 됨 ' + str(p['stale']) + '칸'}"
        fill = ('거부 `' + m['fill']['code'] + '`' if not m['fill']['ok'] else ('정상' if m['fill']['stale'] == 0 else '면이 깔림(1층)·재계산 안 됨 ' + str(m['fill']['stale']) + '칸')) if m['fill'] else '-'
        if d['layer'] != 1 and 'fillL' in m:
            f2 = m['fillL']; fill += f" / layer \"{d['layer']}\": " + ('정상' if f2['stale'] == 0 and f2['ok'] else ('재계산 안 됨 ' + str(f2['stale']) + '칸' if f2['ok'] else '거부'))
        path = '정상' if m['path']['ok'] else '거부 `' + m['path']['code'] + '`'
        mat.append([f'`{gid}`', fill, path, ent('1'), ent('2'), ent('3')])
    j = EN['joinExp']['laneJoin']
    join_cells = to_rows(j['layers']['1'], 18)
    return f'''# 일본 도시 — 오토타일 사용법 · 도구와 층 · 정상/오류 판정

{HEAD}

오토타일은 「같은 세트의 칸끼리 이웃을 보고 가장자리·모서리 그림을 스스로 고르는 칸 묶음」이다. 맵에는 **몸통 칸**(8방: `variantMap[255]`, 4방: `variantMap[15]`)을 칠하면 도구가 둘레를 다시 계산해 알맞은 칸으로 바꾼다. 번호를 직접 골라 찍으면 모양이 안 맞는다.

## 이웃 비트와 칸 고르기 (엔진 `src/project/defaults/autotileEngine.ts`)
- 비트: N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128(8방), 4방은 하위 4비트만. `mask` = 이웃 칸(같은 세트의 칸) 쪽 비트의 합.
- 8방 정규화: 대각 비트는 **인접한 두 변이 모두 켜졌을 때만** 남는다(`canon`). 정의의 8방 7세트 모두 256키 전부에서 `variantMap[m] == variantMap[canon(m)]` 이고 서로 다른 `canon` 은 {sorted({v['canonCount'] for v in canon.values()})[0]}개다(7세트 검증: {sum(1 for v in canon.values() if v['ok'])}/7 일치). 그래서 세트 문서의 사전은 `canon` 마스크 {sorted({v['canonCount'] for v in canon.values()})[0]}개만 적는다.
- 칸 고르기: 칸의 이웃 8칸이 같은 세트 칸이면 비트 1, 아니면 0 → `mask` 를 `canon` 으로 바꿔 사전에서 칸 번호를 찾는다. 이웃으로 세는 칸(`connectTileIds`)은 **자기 세트 칸뿐**이다 — 다른 오토타일·도로 키트의 복사 칸과는 이어지지 않는다.
- 맵 밖은 이웃이 아니다(`edgeConnects:false`).

## 17세트 한눈에
{md_table(['오토타일 id', '이름(그룹 이름 = material)', '이웃', '칸 번호 범위', '칠하는 층', '도구', '문서'], rows)}

## 도구 행렬 (실제 호출 실측 — `tiledata/jp-city/refs/engine_dump.mts`)
같은 12×8 시험판(몸통 칸을 칠한 마스크)을 도구마다 실제로 칠하고 엔진으로 검사한 결과다. 「N층에 놓임」은 도구가 그 칸을 놓은 층, 「재계산 안 됨 N칸」은 칠한 뒤에도 이웃에 맞는 칸이 아닌 칸 수다.
{md_table(['세트', 'fill_region(면 채우기)', 'lay_path(길)', 'paint_tiles layer "1"', 'layer "2"', 'layer "3"'], mat)}
읽는 법과 규칙:
1. **지면 8방 7종**: 면은 `fill_region`, 굽은 길·강은 `lay_path`(경유점 2개 이상, `naturalness`·`seed`) 또는 `fill_region` 의 `path`+`width`, 낱칸은 `paint_tiles` layer "1". 전부 칠한 뒤 재계산 0칸 어긋남.
2. **위층 4방 4종(블록담·생울타리·철망·가드레일)**: `paint_tiles` layer **"3"** 의 line/cells. `fill_region` 은 「면 채우기 재료가 아님」으로 거부, `lay_path` 는 `path-needs-autotile`. **`stamp_layer_block` 은 3층 오토타일을 재성형하지 않는다**(기본 `reshape:true` 라도 1·2층만) — 번호를 그대로 찍어 어긋난다.
3. **선로**: 불투명 1층 땅 — `paint_tiles` layer "1" 의 line. `lay_path` 는 4방이라 거부.
4. **투명 덧그림 5세트(중앙선·차선 점선·횡단보도 둘·점자블록)**: **layer "2"** 로 칠한다. layer "1"·"3" 으로 요청하면 도구가 칸을 **3층으로 돌려 놓고 재성형하지 않아** 몸통 칸(십자)이 그대로 남는다(위 행렬 9칸 어긋남). `fill_region` 도 layer 를 안 주면 1층에 깔아 아래 땅이 없는 투명 칸이 검게 보이니 `layer:"2"` 를 준다.
5. **직접 번호 찍기 금지**: `stamp_layer_block` + `reshape:false`, 또는 맵 배열 직접 쓰기는 이웃을 보지 않으므로 어긋난다(세트 문서의 「오류 1」 그림).
6. **속칸 변형(`interiorVariants`)**: 8방 세트가 몸통 둘레 바깥에 갖는 깊이 변형 칸(단 0·단 1). 엔진 `shadeAutotileInterior` 의 몫인데 저장소에서 그것을 부르는 곳은 숲 윤곽 도구(`forestContour.ts`)뿐이다 — jp_city 도구 경로는 부르지 않으므로 도구가 칠한 속은 몸통 한 칸(`variantMap[255]`)이다. 손으로 속칸 변형을 심으면(완전 속칸에서) 재성형이 그 칸을 건드리지 않는다(`shapeAutotileGroupAround` 가 건너뜀).

## 키트와 이어붙이기 (한계 — 실측)
도로 키트의 도로 칸(3616~)은 오토타일 칸을 화소 그대로 **복사한 별개 칸**이라 오토타일의 멤버가 아니다(`jp-lane-road` 멤버와 겹치는 키트 칸 {EN['joinExp']['laneJoin']['kitCellsAreMembers']}개). 그래서 `jp-road-lane-h` 키트(6×4) 바로 오른쪽을 `fill_region` 으로 생활도로 칠하면 첫 칸이 **가장자리 칸 {join_cells[0][6]}**(「{suffix_label(AT['jp-lane-road'], join_cells[0][6])}」 — 이웃이 없다고 본 끝)으로 닫힌다 — 키트와 오토타일은 이음새에서 끊긴다.
키트는 키트끼리, 오토타일은 오토타일끼리 이어 칠한다(용도 「도로·교차로 키트」).

## 자동 좌표 검증 (이 용도)
검사 스크립트 `tiledata/jp-city/refs/engine_dump.mts` 는 엔진 함수 `autotileVariantForCell`·`tileLayerPolicy` 로 맵의 오토타일 멤버 칸을 훑는다.
| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `autotile-stale` | 멤버 칸이 있는 층에서 그 칸의 이웃으로 엔진이 고를 칸과 번호가 다르다(재계산 안 됨) | 몸통 칸을 `paint_tiles` 로 다시 칠한다 |
| `wrong-layer` | 멤버 칸이 그 세트의 칠하는 층이 아닌 층에 있다(세트 표 「칠하는 층」) | 칸을 지우고 맞는 층에 `paint_tiles` 로 칠한다 |
보는 범위는 **구조**(칸 번호와 층)다. 이벤트 실행·미적 품질·낮은 성능 모델이 맞게 칠할 확률은 이 검사로 주장하지 않는다. 변조 좌표는 세트 문서마다 있다.
'''


add_doc(C_AT, 'at-usage', '일본 도시 · 오토타일 사용법·도구와 층·정상/오류 판정', doc_at_usage())


def doc_autotile(gid):
    g = AT[gid]; d = AT_DEMO[gid]; m = AT_MAT[gid]
    nbr = g.get('neighborhood', 4); a, b = at_range(g)
    out_t, note = AT_INFO[gid]
    items = at_dict_items(g)
    members = set(g['memberTileIds']); mapped = {v for v in g['variantMap'].values()}
    extra = sorted(members - mapped)
    interior = g.get('interiorVariants') or []
    layer = d['layer']; W, H = d['W'], d['H']
    body = d['body']
    normal = d['normal']; se = d['staleErr']; le = d['layerErr']
    n_cells = d['cells']
    tg = next(x for x in D['tileGroups'] if x['id'] == ('jp:crosswalk' if gid.startswith('jp-crosswalk') else 'jp:' + gid[3:]))
    stale = issue_rows(se['issues'], 'autotile-stale'); wrong = issue_rows(le['issues'], 'wrong-layer')
    wrong_t = sorted({(i['layer']) for i in le['issues']})
    tool_ex = []
    if nbr == 8:
        tool_ex.append(('면 채우기', {'tool': 'fill_region', 'args': {'mapId': '<맵>', 'material': g['name'], 'rect': {'x': 2, 'y': 2, 'w': 8, 'h': 4}}}))
        tool_ex.append(('굽은 길', {'tool': 'lay_path', 'args': {'mapId': '<맵>', 'material': g['name'], 'points': [{'x': 1, 'y': 2}, {'x': 10, 'y': 2}, {'x': 10, 'y': 7}]}}))
        tool_ex.append(('낱칸·선', {'tool': 'paint_tiles', 'args': {'mapId': '<맵>', 'layer': str(layer), 'mode': 'rect', 'tile': body, 'from': {'x': 2, 'y': 2}, 'to': {'x': 9, 'y': 5}}}))
    else:
        tool_ex.append(('선 긋기', {'tool': 'paint_tiles', 'args': {'mapId': '<맵>', 'layer': str(layer), 'mode': 'line', 'tile': body, 'from': {'x': 1, 'y': 3}, 'to': {'x': 9, 'y': 3}}}))
    for _, e in tool_ex: tnum(body)
    ex_lines = '\n'.join(f'- {n}: `{jline(e)}`' for n, e in tool_ex)
    under_line = f'- 아래 땅(1층): 모든 칸 {tnum(d["under"])}({label_of(d["under"])})' if layer != 1 else f'- 바깥 지형(마스크 밖): 모든 칸 {tnum(d["outside"])}({label_of(d["outside"])})'
    err_rows = [
        ['오류 1 — 재계산 안 함(몸통 칸 번호 그대로 찍음)', f'`stamp_layer_block` `reshape:false` 로 마스크 칸 전부를 몸통 {body} 로', '`autotile-stale`', len(stale), fmt_coords(stale, 6)],
        [f'오류 2 — 잘못된 층({LAYER_NAME[layer]} 대신 {LAYER_NAME[d["wrongLayer"]]})', f'맞게 칠한 결과를 `stamp_layer_block` 로 {d["wrongLayer"]}층에 옮김', '`wrong-layer`', len(wrong), fmt_coords(wrong, 6)],
    ]
    if d.get('reroute'):
        rr = d['reroute']
        err_rows.append(['오류 3 — 도구에 1층으로 요청', f'`paint_tiles` layer "1" 로 같은 마스크', '`wrong-layer`', rr['issues'], f'도구가 {rr["onLayer3"]}칸을 3층에 놓고 재성형 안 함(서로 다른 칸 {rr["distinct"]}종 = 몸통 {body} 한 종)'])
    return f'''# 일본 도시 — 오토타일 · {g['name']} (`{gid}`)

{HEAD}

{note}

## 한눈에
{md_table(['항목', '값'], [
    ['오토타일 id · 그룹 이름', f'`{gid}` · `{g["name"]}`(fill_region·lay_path 의 material)'],
    ['타일 그룹', f'`{tg["id"]}`({len(tg["tileIds"])}칸, role `{tg["role"]}`)'],
    ['이웃', f'{nbr}방({"N E S W + 대각 NE SE SW NW" if nbr == 8 else "N E S W"})'],
    ['칸 번호 범위', f'{a}~{b}({len(g["memberTileIds"])}칸, 열 {a % TPR}·행 {a // TPR} ~ 열 {b % TPR}·행 {b // TPR})'],
    ['칠하는 층', f'**{LAYER_NAME[layer]}** (정의의 `layer`: {g.get("layer", "lower")} — 도구 실측으로 정한 칠하는 층)'],
    ['몸통 칸(맵에 칠하는 칸)', f'**{body}**({label_of(body)}) = `variantMap[{255 if nbr == 8 else 15}]`'],
    ['통행·그림 순서(몸통 칸, 엔진)', code_text(body)],
    ['바깥 지형 가정', out_t],
    ['이어지는 칸(connectTileIds)', f'자기 세트 {len(g["connectTileIds"])}칸뿐' + ('(복사본인 도로 키트 칸·다른 오토타일과 이어지지 않음)' if True else '')],
    ['속칸 변형', ('단 0 = ' + ', '.join(str(tnum(t)) for t in sorted(set(interior[0]))) + ' · 단 1 = ' + ', '.join(str(tnum(t)) for t in sorted(set(interior[1])))) if interior else '없음(4방 세트)'],
    ['몸통 변형 칸(사전 밖 멤버)', ', '.join(str(tnum(t)) + '(' + suffix_label(g, t) + ')' for t in extra) if extra else '없음'],
])}

## 칸 번호 사전 (정규화 마스크 → 칸 번호, 전체)
비트 N=1 E=2 S=4 W=8{" NE=16 SE=32 SW=64 NW=128" if nbr == 8 else ""}. `mask` 는 {"`canon` 으로 정규화한 값 " if nbr == 8 else ""}(같은 세트 이웃이 있는 쪽 비트의 합), `nbrs` 는 이웃이 있는 방향.
{"비정규 마스크(대각만 켜진 경우 등)는 `canon` 으로 바꿔 찾는다 — 256키 모두 같은 칸을 가리킨다(검증됨)." if nbr == 8 else "4방은 16키 전부가 사전에 있다."}
{jfences(items)}

## 쓰는 법 (실행 순서)
1. 맵 칩셋이 `jp_city` 인지, 칠할 층({LAYER_NAME[layer]})이 맞는지 확인한다{"" if layer == 1 else f" — 아래 1층에 땅 칸(보통 {tnum(d['under'])})이 먼저 깔려 있어야 한다(투명 칸이라 땅이 없으면 검게 보인다)" if layer in (2, 3) else ""}.
2. 몸통 칸 {body} 를 칠한다(도구가 이웃을 보고 가장자리·모서리 칸으로 바꾼다):
{ex_lines}
3. 낱번호를 직접 찍지 않는다. 이미 찍어 어긋났다면 몸통 칸으로 다시 칠한다.
4. 같은 세트가 마스크 밖 이웃(다른 지형)과 맞닿는 가장자리 그림은 **바깥 지형 가정**({out_t})으로 구워져 있다 — 다른 지형과 맞닿으면 가장자리 그림이 어색하다.

## 입력 → 전체 정답 배열 → 그림
입력(마스크 `#` = 이 세트 칸, `.` = 바깥, {W}×{H}칸, 좌표는 맵 칸 0 기준):
```text
{at_pattern_text(d['pattern'])}
```
{under_line}
도구: `paint_tiles` layer "{layer}" mode cells, tile {body}, cells = `#` 위치 {n_cells}칸. 결과 {LAYER_NAME[layer]} 전체 배열(행 우선, 모든 칸):
```text
{flat_rows(to_rows(normal['layers'][str(layer)], W))}
```
검사: `autotile-stale` {len(issue_rows(normal['issues'], 'autotile-stale'))}칸 · `wrong-layer` {len(issue_rows(normal['issues'], 'wrong-layer'))}칸 — 정상. 사용한 서로 다른 마스크 {d['distinctMasks']}종.
그림: `jp-img-at-{gid[3:]}-ok`(정상, 원본 ×3) · `jp-img-at-{gid[3:]}-tiles`(세트 칸 전체) · `jp-img-at-{gid[3:]}-err`(오류 1·2).

## 정상/오류 — 자동 좌표 검증
{md_table(['변조', '방법', '코드', '칸 수', '맵 좌표 (x,y)'], err_rows)}
오류 그림의 빨강 테두리 = 검사가 짚은 칸. 같은 입력 마스크에서 한 가지만 바꿨다. **검사 범위**: 칸 번호와 층의 구조. 이벤트 실행·미적 품질은 보지 않는다.
**레이어 정정 조건**: 이 세트 칸이 {LAYER_NAME[wrong_t[0]] if wrong_t else ""} 에 있으면 칠하는 층({LAYER_NAME[layer]})으로 옮긴다 — {"투명 덧그림은 아래 땅(1층)이 있어야 하고, 1층에 두면 아래 땅이 사라져 검게 보인다." if layer == 2 else "위층 칸은 3층에서만 이웃을 센다." if layer == 3 else "불투명 땅은 1층에서만 이웃을 센다."}
'''


for _gid in AT:
    add_doc(C_AT, f'at-{_gid[3:]}', f'일본 도시 · 오토타일 · {AT[_gid]["name"]}', doc_autotile(_gid))


def img_autotiles():
    for gid, g in AT.items():
        d = AT_DEMO[gid]; W, H = d['W'], d['H']; layer = d['layer']; short = gid[3:]
        ok = render(d['normal']['layers'], W, H)
        save_img(f'at-{short}-ok', panels([(f'정상 — paint_tiles layer "{layer}" 로 칠한 결과(원본 ×3, {W}×{H}칸)', up(ok, 3))]),
                 f'`{gid}` 정상: 마스크({d["cells"]}칸)를 `paint_tiles` layer "{layer}" 로 칠한 결과. 둘레 가장자리·모서리가 이웃에 맞게 재계산됨(검사 0칸). 칸 번호 배열은 `jp-at-{short}`.', C_AT)
        members = sorted(g['memberTileIds'])
        cols = 7 if len(members) == 49 else 4 if len(members) == 16 else 4
        save_img(f'at-{short}-tiles', contact_sheet(members, cols, 3),
                 f'`{gid}` 세트 칸 전체 {len(members)}칸(번호 라벨, 원본 ×3). 사전은 `jp-at-{short}`.', C_AT)
        k = best_scale([W * T, W * T], [H * T, H * T])
        e1 = up(render(d['staleErr']['layers'], W, H), k); e2 = up(render(d['layerErr']['layers'], W, H), k)
        s1 = issue_rows(d['staleErr']['issues'], 'autotile-stale'); s2 = issue_rows(d['layerErr']['issues'], 'wrong-layer')
        mark_cells(e1, s1, k, width=1); mark_cells(e2, s2, k, width=1)
        save_img(f'at-{short}-err', panels([(f'오류 1 · 재계산 안 함 — autotile-stale {len(s1)}칸', e1), (f'오류 2 · 잘못된 층({d["wrongLayer"]}층) — wrong-layer {len(s2)}칸', e2)]),
                 f'`{gid}` 오류: 왼쪽 = 몸통 칸 번호 그대로 찍음(가장자리·모서리가 없다), 오른쪽 = 같은 칸을 {d["wrongLayer"]}층에 놓음. 빨강 테두리 = 검사가 짚은 칸(원본 ×{k}). 좌표는 `jp-at-{short}`.', C_AT)


img_autotiles()


# ====================================================================== 분류 3 — 건물 조립 도구
C_BLD = new_cat('building', '일본 도시 · 건물 조립 도구',
                '`build_jp_city_building` 사용법 전부: 입력 스키마·좌표·조립 규칙(띠 문법)·부품 사전의 실제 id 목록과 칸 배열 전체·완성 예제 25(입력 → 칸 배열 → 통행 → 도구가 만든 결과 그림)·오류 코드 표와 오류 입력→결과 그림·문 앞 접근칸·뒷줄 먼저·L자 별채.')
BLD = {b['name']: b for b in EN['buildings']}
EXMETA = EN['exampleMeta']
BANDS = SPEC['bands']
DECOS = SPEC['decos']
for _n, _m in EXMETA.items():           # 높이 = 띠 줄수 합 (도구 결과와 일치 확인)
    if BLD[_n]['ok'] or True:
        _tot = sum(q['rows'] for q in _m)
        _sp = 0
        assert _tot == BLD[_n]['asm']['rows'] or _n.startswith('L_'), (_n, _tot, BLD[_n]['asm'])


def tile_list(t):
    return None if t is None else tnum(t)


def band_item(bid):
    b = BANDS[bid]
    item = {'band': bid, 'ko': b['ko'], 'kind': b['kind'], 'rows': b['rows'], 'modw': b['modw'],
            'L': [tile_list(t) for t in b['L']], 'R': [[tile_list(t) for t in c] for c in b['R']],
            'mods': {v: [[tile_list(t) for t in col] for col in cols] for v, cols in b['mods'].items()}, 'F': None if b['F'] is None else [tile_list(t) for t in b['F']]}
    return item


def deco_item(did):
    d = DECOS[did]
    return {'deco': did, 'ko': d['ko'], 'group': d['group'], 'w': d['w'], 'h': d['h'], 'avoidsWindows': d['avoidsWindows'],
            'cells': [[tile_list(t) for t in r] for r in d['cells']]}


def doc_bld_tool():
    ex = BLD['konbini_block']
    first_ok = ex['summary']
    clash = BLD['L_flats_lot']
    n_cl = sum(1 for b in BLD.values() if not b['ok'])
    rows_formula = []
    for n, m in EXMETA.items():
        kinds = collections.Counter(BANDS[q['bid']]['kind'] for q in m)
        rows_formula.append([n, ' + '.join(f"{q['bid']}({q['rows']})" for q in m), sum(q['rows'] for q in m), BLD[n]['rect']['h']])
    sum_rows = [r for r in rows_formula if not r[0].startswith('L_')]
    for r in sum_rows: assert r[2] == r[3], r
    return f'''# 일본 도시 — 건물 조립 도구 `build_jp_city_building` 사용법

{HEAD}

가변 폭·층수 **상가 건물**(상가·아파트·사무소·마치야·L자 별채)을 **부품 사전 + 순수 조립기 + 맵 도구**로 짓는다. 건물을 낱칸으로 칠하지 않는다. **오류가 하나라도 있으면 맵을 한 칸도 바꾸지 않는다**(복제본에 찍어 엔진 통행으로 다시 확인한 뒤에만 반영). jp_city 맵에서만 동작한다.
관련 도구: `list_jp_city_building_parts`(읽기 — 부품 사전·`example` 로 완성 예제 입력). 코드: `src/editor/tools/jpCityTools.ts` · 조립기 `src/editor/jpCity/builder.ts` · 사전 `src/assets/jpCityBuildingSpec.json`.

## 좌표 (원점·방향)
- `x`,`y` = 건물 **발 = 왼쪽 아래 칸**(0 기준 맵 좌표). 사각형은 `(x, y-높이+1)`~`(x+w-1, y)` — 위로 자란다.
- 문 칸 = 건물 맨 아래 줄(막힘). **문 앞 접근칸 = 문 바로 아래 한 줄**(`y+1`, 건물 사각형 바깥) — 걸을 수 있는 보도·도로여야 한다.
- 높이는 `띠 줄 수의 합`이다: 지붕(또는 옥상 간판) + 윗층 N×2 + (처마) + 1층 3줄 + (셋백이면 테라스 1줄). 예제 22개 전부 도구 결과의 높이와 일치(아래 표 + 각 예제).

## 실행 순서 (반드시)
1. `list_jp_city_building_parts` 로 id 를 확인한다(인자 없음 = 층 종류·벽·1층·지붕·문 목록, `query` = 부착물 검색, `example` = 완성 예제 입력). id 를 지어내지 않는다 — 사전은 이 용도의 「부품 사전」 문서에 칸 배열째 있다.
2. **문 앞 바닥을 먼저 깐다**: 문 아래 접근칸에서 걸을 수 있는 칸이 6개 이상 이어져야 한다(보도·도로). 바닥이 없으면 `DOOR_BLOCKED`.
3. **뒷줄 건물(발 y 가 작은 쪽)을 앞줄보다 먼저** 짓는다. 겹치는 두 건물은 나중에 찍은 쪽이 위에 그려진다.
4. `build_jp_city_building` 을 부른다. 성공하면 `rect`·`doors`·`access`·`solidCells`·`warnings` 를 돌려준다. 실패하면 코드·좌표·고칠 방법만 오고 맵은 그대로다.
5. 문 이동 이벤트는 **도구가 만들지 않는다**. 이벤트는 문 칸(`data.doors`), 길은 접근칸(`data.access`)에서 끝낸다 — 문 그림·문 앞 접근칸·출입구·상호작용(이벤트)은 서로 다른 것이다.

## 입력 스키마 (`additionalProperties:false`, 자유 키 객체 없음)
```json
{{"mapId":"<jp_city 맵 id, 생략하면 지금 보는 맵>","x":4,"y":12,"w":6,
 "floors":3,"floorKind":"pairs","wall":"shiro",
 "floorPlan":[{{"kind":"ribbon","wall":"conc","variants":[0,1]}}],
 "ground":"gr.konbini.0","groundVariants":[0],
 "door":{{"type":"auto","col":2}},
 "roof":"roof.ac.tank","head":"roofsign.aka","eave":"eave.slate",
 "setback":{{"upper":2,"ins":1}},
 "decos":[{{"deco":"pipe","col":5,"floor":"0","row":0,"cols":["kii","aka"]}}],
 "wing":{{"w":4,"ground":"gr.glass.kii","roof":"roof.plain.plain","door":{{"type":"cafe","col":1}},"side":"L","depth":2,"yard":"lot"}}}}
```
{md_table(['필드', '뜻', '규칙'], [
    ['`x`,`y`,`w`,`ground`', '필수. 발 칸·폭·1층 종류', '`w` 최소 3(왼쪽 끝 1 + 오른쪽 끝 2). 1층 종류는 `gr.` 를 생략해도 된다(`shop` 은 같은 뜻의 별칭)'],
    ['`floors`/`floorKind`/`wall`', '윗층 수(숫자)·모든 층의 띠 종류·기본 벽', '한 층 = 위·아래 2줄. 기본 띠 `pairs`, 기본 벽 `kinari`'],
    ['`floorPlan`', '층별 지정(**위에서 아래 순서**, `[0]` 이 맨 위 층)', '주면 `floors`·`floorKind`·`wall` 대신. 항목 = `kind`·`wall`·`variants`(몸통 변형 번호 목록, 모듈마다 돌려 쓴다)·`band`(띠 id 직접 지정, 보통 안 쓴다)'],
    ['`door`', '문 종류와 왼쪽 열 `col`(0 기준)', '생략하면 1층 종류의 기본 문을 **오른쪽 끝**에. `type:"none"`/null = 문 없음 → `NO_DOOR`'],
    ['`roof` / `head` / `eave`', '지붕 띠·옥상 간판 띠(지붕 자리를 대신)·처마 띠(1층 바로 위)', '맨 위는 지붕 띠(`roof.*`) 또는 옥상 간판(`roofsign.*`)이어야 한다'],
    ['`setback`', '`upper` 번호 층보다 위는 양쪽 `ins` 칸 안으로 들인다', '`w - 2×ins ≥ 3`. 들이는 층 아래에 테라스 띠(`terrace`) 1줄이 낀다'],
    ['`decos[]`', '부착물(간판·차양·실외기·비상계단 …)', '`deco`(id)·`col`(건물 왼쪽 끝 기준 열)·`floor`(**문자열** "0"(맨 위 윗층)·"1"… / `ground` / `head`)·`row`(띠 안에서 아래로 내릴 줄 수)·`cols`(`vstack.{{c}}` 의 색 목록)'],
    ['`wing`', 'L자: 본채 + 앞으로 튀어나온 별채', '`w`·`ground` 필수. `side` L/R(기본 L)·`depth`(기본 2, 1~12)·`yard`(본채 앞 남는 땅: `lot` 주차장 기본 또는 거리 칸 이름). 별채 폭 ≤ 본채 폭 − 2'],
])}

## 조립 규칙 (띠 문법 — `Kit` 의 TS 이식, Python 원본과 칸 배열·화소 일치를 증명)
- **띠 한 장**(폭 `nb`): 왼쪽 끝 `L` 1칸 + 몸통 모듈 `⌊(nb-3)/modw⌋` 번 반복(모듈마다 `variants` 를 돌려 쓴다) + 남는 칸은 채움 `F` + 오른쪽 끝 `R0`·`R1` 2칸. `modw` 가 2 인 띠(베란다·발코니·옥상 간판·1층 대부분)는 홀수 남는 칸을 `F` 가 메운다. 띠의 칸 배열 전체는 「부품 사전」 문서.
- **위에서 아래**: 지붕(또는 옥상 간판) → 윗층들(각 2줄) → (처마) → 1층(3줄). 셋백이면 위쪽 층만 안으로 들이고 사이에 `terrace`.
- **문**(`door.*` 2×3, 마치야 3×3)은 부착물로 1층 위에 얹는다. 문 칸은 막힘(맨 아래 두 줄), 접근칸 = 문 바로 아래 한 줄. 문 그림은 **고정** 조각(늘어나지 않는다), 띠 몸통·층 수는 **반복**.
- **L자**: 본채 + `wing`. 본채 앞 남는 땅은 `lot`(주차장) 또는 거리 칸. 별채 오른쪽 5px 그림자는 칸 번호로 못 그려 **생략**하고 경고 `SHADOW_OMITTED`.
- **층 배정**: 에디터 위층은 3층(`upperTiles`)·4층(`upperOverlayTiles`) 둘뿐 — 한 칸에 `[띠 + 부착물 하나]`까지 얹는다. 위 칸이 온전히 불투명하면 밑 칸은 버린다(화면은 같다). 그래도 위층 칸이 3장 넘으면 `DECO_CLASH`.
- **통행은 칸 번호가 정한다**(막힘 칸 = 위층 + 통행 불가). 도구는 찍은 뒤 엔진 `isPassable` 로 ① 막힘 칸이 실제로 막혔는지 ② 문 앞 접근칸에서 걸어갈 수 있는 칸이 **6개 이상** 이어지는지 다시 검사하고, 아니면 맵을 되돌린다.

## 응답 예 (실제 도구 결과)
정상(`konbini_block`, 맵 {ex['W']}×{ex['H']}, 발 ({ex['foot']['x']},{ex['foot']['y']})):
> {first_ok}

거부(`L_flats_lot`):
> {clash['summary'][:420]}

## 높이 = 띠 줄 수의 합 (예제 25, 도구 결과의 사각형 높이와 대조)
{md_table(['예제', '띠(위→아래)(줄 수)', '줄 수 합', '도구 결과 높이'], rows_formula)}
(L자 3종은 본채+별채 합성이라 별채가 더 튀어나온 만큼 높이가 다르다.)

## 한계 (정직하게)
- 한 칸에 투명 부착물 둘 + 띠(위층 3장)는 에디터 위층이 둘뿐이라 못 짓는다 → `DECO_CLASH`. 완성 예제 중 **{n_cl}개가 이 도구로 거부된다**: {', '.join(f'`{n}`' for n, b in BLD.items() if not b['ok'])}(각 예제의 오류 코드·좌표는 「완성 예제」 문서). 원본 렌더는 겹쳐 그리지만 에디터 층 한계로 못 짓는다.
- L자 별채의 그림자 5px 는 생략. 별채가 본채 앞 줄을 덮는 칸은 엔진 통행 기준(밑 본채 막힘 칸이 먼저 막는다).
- 층고 3칸·마치야 용마루·같은 높이 L자 지붕 병합 등은 이번 부품에 없다.
- **검사 범위**: 구조(띠 순서·층 쌍·문·부착물 충돌)와 통행(막힘 칸·접근칸 도달). 이벤트 실행·미적 품질·낮은 성능 모델의 성공률은 검사하지 않는다.
- 주택가·역·공원·신사용 건물 부품은 **후속 추가 자리**(지금 없음).
'''


add_doc(C_BLD, 'bld-tool', '일본 도시 · 건물 조립 도구 사용법·입력·좌표·규칙', doc_bld_tool())


def doc_bld_parts():
    fk = SPEC['floorKinds']
    groups = collections.OrderedDict()
    for did, d in DECOS.items():
        g = groups.setdefault(d['group'], dict(ko=d['groupKo'], ids=[], w=d['w'], h=d['h'], aw=d['avoidsWindows']))
        g['ids'].append(did)
    return f'''# 일본 도시 — 건물 부품 사전 (id 전체 목록)

{HEAD}

`build_jp_city_building` 이 받는 id 의 **전체** 목록이다. 칸 배열(어느 칸 번호가 어느 자리인지)은 이어지는 「띠 사전」·「부착물 사전」 문서에 있다. id 를 지어내면 `UNKNOWN_PART`.
제한: 폭 최소 {SPEC['limits']['minWidth']}칸 · 한 층 = {SPEC['limits']['floorRows']}줄 · 한 칸 위층 최대 {SPEC['limits']['maxLayersOverBase'] + 1}장(띠 + 부착물 하나).

## 벽 재질 (`wall`)
{md_table(['id', '뜻'], [[k, v] for k, v in SPEC['walls'].items()])}

## 층 띠 종류 (`floorKind` / `floorPlan[].kind`) — 띠 id = `fl.<kind>.<wall>`
{md_table(['kind', '이름', '모듈 폭 modw', '벽', '몸통 변형 번호(variants)'], [[k, v['ko'], v['modw'], ' '.join(v['walls']), ' '.join(map(str, v['variants']))] for k, v in fk.items()])}
- `curtain`·`tile` 은 `kinari` 벽 한 가지뿐(건물 `wall` 이 shiro 여도 kinari). `variants` 는 몸통 모듈마다 돌려 쓰는 변형 번호 목록이며 목록에 없는 번호는 `UNKNOWN_PART`.

## 1층 종류 (`ground`) — 띠 id = `gr.*`
{md_table(['id', '이름', '기본 문', '모듈 폭', '몸통 변형(groundVariants)'], [[k, v['ko'], v['door'], v['modw'], ' '.join(map(str, v['variants']))] for k, v in SPEC['grounds'].items()])}

## 지붕·옥상 간판·처마
{md_table(['구분', 'id', '이름', '비고'], [['지붕 `roof`', k, v['ko'], '경사 지붕' if v['pitched'] else '평지붕'] for k, v in SPEC['roofs'].items()] + [['옥상 간판 `head`(지붕 자리를 대신)', k, v['ko'], ''] for k, v in SPEC['heads'].items()] + [['처마 `eave`(1층 바로 위)', k, v['ko'], ''] for k, v in SPEC['eaves'].items()])}
- 지붕 id 는 `roof.` 를 생략할 수 있다(예: `plain.tank`). 건물 맨 위는 지붕 띠 또는 옥상 간판이어야 한다(`ROOF_ORDER`).

## 문 (`door.type`) — 부착물 `door.<type>`
{md_table(['type', '이름', '폭×높이(칸)', '1층 기본 문으로 쓰는 1층'], [[k, v['ko'], f"{v['w']}×{v['h']}", ', '.join(g for g, d in SPEC['doorDefault'].items() if d == k) or '-'] for k, v in SPEC['doors'].items()])}
- 문 칸 = 맨 아래 두 줄(막힘) + 윗줄(★). 접근칸 = 문 바로 아래 한 줄.

## 부착물 분류 ({len(DECOS)}종, `decos[].deco`)
{md_table(['분류(group)', '이름', '개수', '크기(칸)', '창 위 금지', 'id'], [[k, g['ko'], len(g['ids']), f"{g['w']}×{g['h']}", '예' if g['aw'] else '아니오', ', '.join(g['ids'])] for k, g in groups.items()])}
- 「창 위 금지」= 창이 있는 띠 위에 얹으면 `DECO_CLASH`(간판·차양·실외기·빨래·광고·무시코). 민벽(`blank`)이나 창 없는 칸에 얹는다.
- `vstack.{{c}}` 는 색 목록 `cols`(`kii aka sora midori`)와 정수 `floor` 가 필요하다. `fe`(비상계단)는 맨 아래 층에서 `fe_end` 로 바뀐다.

## 마당 · 거리 칸 (`wing.yard`) — {len(SPEC['yards'])}종
`{'`, `'.join(SPEC['yards'])}` — 번호는 `jp-sheet-map` 의 거리 칸 사전.

## 조립 결과를 맵에 적는 칸 목록(사전 속 번호의 집합)
- 아래층(1층) 칸: {len(SPEC['lower'])}종 · 막힘 칸: {len(SPEC['solid'])}종 · 불투명 칸(위 칸이 이것이면 밑 칸이 가려진다): {len(SPEC['opaque'])}종 — 전체 목록은 `src/assets/jpCityBuildingSpec.json` 의 `lower`·`solid`·`opaque`.
'''


add_doc(C_BLD, 'bld-parts', '일본 도시 · 건물 부품 사전(id 전체 목록)', doc_bld_parts())


def doc_bld_bands(did, title, ids):
    items = [band_item(b) for b in ids]
    return f'''# 일본 도시 — 건물 띠 사전 · {title}

{HEAD}

띠(band) 한 종의 **칸 번호 전체**다. 항목: `band` id · `kind` · `rows`(띠 줄 수) · `modw`(몸통 모듈 폭) · `L`(왼쪽 끝 칸, 줄마다) · `R`(오른쪽 끝 두 열: `R[0]`=끝에서 둘째 열, `R[1]`=맨 끝 열, 줄마다) ·
`mods`(몸통 변형 번호 → 모듈 열들 → 줄마다 칸) · `F`(남는 칸 채움, 줄마다, 없으면 null).
조립(폭 `nb` 의 띠): 열 0 = `L[줄]`, 열 `nb-2` = `R[0][줄]`, 열 `nb-1` = `R[1][줄]`, `k` 번째 모듈(0부터)의 `j` 번째 열 = 열 `1 + k×modw + j` ← `mods[변형][j][줄]`(변형은 `variants` 를 `k` 로 돌려 쓴 값), 남는 열 = `F[줄]`.
칸 번호는 `jp-sheet-map` 의 영역 지도 기준 시트 번호다(통행은 맥락별 복제 칸 번호가 이미 반영돼 있다).

{jfences(items, 12000)}
'''


_floor_ids = [b for b, v in BANDS.items() if v['kind'] == 'floor']
_other_ids = [b for b, v in BANDS.items() if v['kind'] != 'floor']
add_doc(C_BLD, 'bld-bands-floors', '일본 도시 · 건물 띠 사전 · 층 띠 30종', doc_bld_bands('bands-floors', '층 띠 30종(fl.*)', _floor_ids))
add_doc(C_BLD, 'bld-bands-other', '일본 도시 · 건물 띠 사전 · 지붕·옥상 간판·처마·테라스·1층', doc_bld_bands('bands-other', '지붕 13 · 옥상 간판 3 · 처마 2 · 테라스 1 · 1층 11', _other_ids))


def doc_bld_decos():
    ids = list(DECOS)
    half = len(ids) // 2 + 1
    items = [deco_item(i) for i in ids]
    return f'''# 일본 도시 — 건물 부착물 사전 ({len(ids)}종, 칸 번호 전체)

{HEAD}

부착물(`decos[].deco`) 한 종의 **칸 번호 배열**이다. 항목: `deco` id · `ko` · `group` · `w`×`h` · `avoidsWindows`(창 위에 얹으면 `DECO_CLASH`) · `cells`(줄마다 칸 번호, 비면 null). 건물 위층에 얹히므로 통행: 문(`door.*`)은 맨 아래 두 줄이 막힘, 나머지는 걸어 지나갈 수 있다(★).
`col`·`floor`·`row` 로 건물 띠 위에 놓는다(「건물 조립 도구」 문서). 그림은 이 용도의 `jp-img-parts-decos-*`.

{jfences(items, 12000)}
'''


add_doc(C_BLD, 'bld-decos', '일본 도시 · 건물 부착물 사전(칸 번호 전체)', doc_bld_decos())


def grid_image(cells, scale=2, bg=None):
    h = len(cells); w = max(len(r) for r in cells)
    im = Image.new('RGBA', (w * T, h * T), (0, 0, 0, 0))
    for y, row in enumerate(cells):
        for x, t in enumerate(row):
            if t is not None and t >= 0: im.alpha_composite(cell(t), (x * T, y * T))
    return up(im, scale)


def shelf_pack(items, width=816, pad=6, label_h=12, maxh=816):
    pages = []; cur = []; x = y = rowh = 0
    def flush():
        nonlocal cur, x, y, rowh
        if not cur: return
        im = Image.new('RGBA', (width, y + rowh + 2), (46, 46, 54, 255)); d = ImageDraw.Draw(im)
        for lab, g, px, py in cur:
            d.text((px + 1, py), lab, fill=(255, 255, 255, 255), font=FONT_S)
            bgc = checker(g.width, g.height); bgc.alpha_composite(g); im.alpha_composite(bgc, (px, py + label_h))
        pages.append(im); cur = []; x = y = rowh = 0
    for lab, g in items:
        w = max(g.width, 4 * len(lab)) + pad; h = g.height + label_h + pad
        if x + w > width and x > 0: x = 0; y += rowh; rowh = 0
        if y + h > maxh and cur: flush()
        cur.append((lab, g, x, y)); x += w; rowh = max(rowh, h)
    flush()
    return pages


def img_parts():
    bv = EN['bandViews']
    fl = [(b, grid_image([[c for c in row] for row in bv[b]['cells']], 2)) for b in _floor_ids if bv[b].get('ok') is not None and 'cells' in bv[b]]
    for i, pg in enumerate(shelf_pack(fl)):
        save_img(f'parts-floors-{i + 1}', pg, f'층 띠 30종 도감 {i + 1}(폭 6칸·몸통 변형 0 으로 조립기가 낸 칸을 그대로, 원본 ×2, 라벨 = 띠 id). 칸 번호는 `jp-bld-bands-floors`.', C_BLD)
    ot = [(b, grid_image(bv[b]['cells'], 2)) for b in _other_ids if 'cells' in bv[b]]
    for i, pg in enumerate(shelf_pack(ot)):
        save_img(f'parts-other-{i + 1}', pg, f'지붕·옥상 간판·처마·테라스·1층 띠 도감 {i + 1}(폭 6칸, 원본 ×2, 라벨 = 띠 id). 1층 띠에는 기본 문이 겹치지 않은 상태. 칸 번호는 `jp-bld-bands-other`.', C_BLD)
    vv = EN['variantViews']
    va = [(k, grid_image(v['cells'], 2)) for k, v in vv.items() if 'cells' in v]
    for i, pg in enumerate(shelf_pack(va)):
        save_img(f'parts-variants-{i + 1}', pg, f'층 띠 몸통 변형 도감 {i + 1}(아이보리 벽, 폭 6칸에 변형 번호 하나를 돌려 쓴 결과, 라벨 = `<kind>/<variant>`, 원본 ×2). 변형 번호는 `jp-bld-parts` 의 variants.', C_BLD)
    dc = [(d, grid_image(DECOS[d]['cells'], 2)) for d in DECOS]
    for i, pg in enumerate(shelf_pack(dc)):
        save_img(f'parts-decos-{i + 1}', pg, f'부착물 {len(DECOS)}종 도감 {i + 1}(원본 ×2, 라벨 = deco id). 칸 번호는 `jp-bld-decos`.', C_BLD)


img_parts()


# ---- 완성 예제 25: 입력 → 칸 배열 → 통행 → 그림
RECIPE_EN = {r['id']: r for r in EN['recipes']}
EQ = {}


def _recipe_id(name):
    return 'jp-recipe-' + name.lower().replace('_', '-')


def _px_diff(l1, W1, H1, l2, W2, H2):
    if (W1, H1) != (W2, H2): return None
    a = render(l1, W1, H1); b = render(l2, W2, H2)
    import numpy as np
    A = np.array(a); B = np.array(b)
    return int((A != B).any(axis=2).sum()), A.shape[0] * A.shape[1]


for _n, _b in BLD.items():
    _r = RECIPE_EN.get(_recipe_id(_n))
    if _b['ok'] and _r: EQ[_n] = _px_diff(_b['layers'], _b['W'], _b['H'], _r['layers'], _r['W'], _r['H'])


def flat_rows_at(rows, y0, x0=0):
    return '\n'.join(f'y={y0 + i:02d}: ' + ' '.join('.' if v < 0 else str(tnum(v)) for v in r) for i, r in enumerate(rows))


def crop(arr, W, rect):
    return [arr[(rect['y0'] + r) * W + rect['x0']: (rect['y0'] + r) * W + rect['x0'] + rect['w']] for r in range(rect['h'])]


def ex_section(name):
    b = BLD[name]; rect = b['rect']; W = b['W']
    ko = SPEC['examples'][name]['ko']
    layers = b['layers'] if b['ok'] else b['wouldBe']
    st = EXMETA[name]
    stack = ' → '.join(f"`{q['bid']}`({q['rows']}줄)" for q in st)
    args = b['toolArgs']
    l1 = crop(layers['1'], W, rect); l3 = crop(layers['3'], W, rect); l4 = crop(layers['4'], W, rect)
    yard = any(v != ST['sw'] for r in l1 for v in r)
    walk_rows = [b['walk'][y][max(0, rect['x0'] - 1): rect['x0'] + rect['w'] + 1] for y in range(rect['y0'], min(len(b['walk']), rect['y0'] + rect['h'] + 1))]
    d = b['data']
    if b['ok']:
        res = (f"**지어졌다** — {b['summary']}\n- 도구 데이터: 문 {jline(d['doors'])} · 문 앞 접근칸 {jline(d['access'])} · 칠한 칸 {d['placedCells']}개 · 막힘 칸 {d['solidCells']}개(엔진 통행과 일치)"
               + (f" · 경고 {jline(d['warnings'])}" if d['warnings'] else ''))
        eq = EQ.get(name)
        rec = RECIPE_EN.get(_recipe_id(name))
        eqt = (f"- 같은 이름의 레시피 키트 `{_recipe_id(name)}` 를 같은 자리에 `stamp_object` 로 찍은 화면과 화소 비교: 다른 화소 {eq[0]}/{eq[1]}" + ('(일치)' if eq[0] == 0 else '(L자 별채 그림자 등 차이 — 한계 참고)')) if eq else ''
    else:
        e = [i for i in b['issues'] if i['severity'] == 'error']
        res = (f"**거부됐다** — `{b['code']}` — {b['summary'][:300]}\n- 오류 {len(e)}건: " + ', '.join(f"`{i['code']}`@({i['x']},{i['y']})" for i in e) + '\n- 맵은 한 칸도 바뀌지 않았다. 아래 배열·그림은 **조립기가 계산한 「지었다면」 결과**(맵에 쓰지 않음, 빨강 테두리 = 오류 칸)다.')
        eqt = ''
    out = f'''## {name} — {ko} (그림 `jp-img-ex-{name}`)
- 결과: {res}
{eqt}
- 맵 시험판: {W}×{b['H']}칸, 1층 전체 보도 {ST['sw']}(`sw`), 아래 3줄 도로 {ST['road_c']}(`road_c`). 건물 사각형 ({rect['x0']},{rect['y0']})~({rect['x0'] + rect['w'] - 1},{rect['y0'] + rect['h'] - 1}) = {rect['w']}×{rect['h']}칸.
- 띠 쌓기(위→아래, 줄 수의 합 {sum(q['rows'] for q in st)}): {stack}
- 도구 인자:
```json
{json.dumps(args, ensure_ascii=False, separators=(',', ':'))}
```
- 3층(`upperTiles`) 사각형 안 전체 배열(맵 좌표 y, 열 {rect['x0']}~{rect['x0'] + rect['w'] - 1}):
```text
{flat_rows_at(l3, rect['y0'])}
```
- 4층(`upperOverlayTiles`):
```text
{flat_rows_at(l4, rect['y0'])}
```
{('- 1층(`lowerTiles`, 마당·주차장이 바꾼 칸 포함):' + chr(10) + '```text' + chr(10) + flat_rows_at(l1, rect['y0']) + chr(10) + '```') if yard else f'- 1층: 건물 사각형 안은 전부 보도 {ST["sw"]}(마당 없음).'}
- 통행 격자(엔진 `isPassable`, `#` 막힘 `.` 걸음, 열 {max(0, rect['x0'] - 1)}~{rect['x0'] + rect['w']}, 맨 아래 줄 = 문 앞 접근칸 줄):
```text
''' + '\n'.join(f'y={rect["y0"] + i:02d}: {r}' for i, r in enumerate(walk_rows)) + '\n```\n'
    return out


def doc_bld_ex(idx, names):
    body = '\n'.join(ex_section(n) for n in names)
    return f'''# 일본 도시 — 건물 조립 · 완성 예제 {idx}/5 ({', '.join(f'`{n}`' for n in names)})

{HEAD}

`list_jp_city_building_parts({{"example":"<이름>"}})` 의 완성 예제 입력을 **실제 `build_jp_city_building` 도구로 지은 결과**다(`tiledata/jp-city/refs/engine_dump.mts` 가 도구를 호출해 맵 배열을 읽었다).
시험판 맵: 폭 = 건물 폭 + 4, 높이 = 건물 높이 + 5, 1층 전체가 보도(`sw`), 아래 3줄이 도로(`road_c`), 건물 사각형은 맵 (2,1) 에서 시작한다. 좌표는 맵 칸 0 기준.
도구 인자의 `x`,`y` = 건물 발(왼쪽 아래 칸). 배열은 **건물 사각형 안만** 보여 준다 — 사각형 밖 칸은 시험판 바닥 그대로다. `.` 은 -1(빈 칸).
그림은 원본 해상도 ×2 로 시트에서 직접 합성한 것이다(AI 모형 아님).

{body}
'''


_names = list(SPEC['examples'])
for _i in range(5):
    _chunk = _names[_i * 5:(_i + 1) * 5]
    add_doc(C_BLD, f'bld-ex-{_i + 1}', f'일본 도시 · 건물 조립 · 완성 예제 {_i + 1}/5', doc_bld_ex(_i + 1, _chunk))


def img_examples():
    for n, b in BLD.items():
        W, H = b['W'], b['H']; layers = b['layers'] if b['ok'] else b['wouldBe']
        im = up(render(layers, W, H), 2)
        if not b['ok']:
            mark_cells(im, [(i['x'], i['y']) for i in b['issues'] if i['severity'] == 'error'], 2, width=2)
        ko = SPEC['examples'][n]['ko']
        lab = f"{n} — {ko} · " + ('지은 결과' if b['ok'] else f"거부({b['code']}) — 지었다면")
        save_img(f'ex-{n}', panels([(lab + f' (원본 ×2, {W}×{H}칸)', im)]),
                 f"완성 예제 `{n}`({ko}): " + ('`build_jp_city_building` 이 지은 결과(시험판 맵, 원본 ×2).' if b['ok'] else f"도구가 `{b['code']}` 로 거부한 입력을 조립기가 계산한 「지었다면」 그림(맵에 쓰지 않음, 빨강 테두리 = 오류 칸, 원본 ×2).") + ' 칸 배열·통행은 `jp-bld-ex-*`.', C_BLD)


img_examples()

# ---- 건물 오류: 코드 표 · 변조 실험 · 정상/오류 그림
FIX = {
    'TOO_NARROW': '폭을 늘린다(최소 3, 문 폭·셋백 들임 후 윗층 폭·별채 폭 ≤ 본채−2 도 확인)',
    'ROOF_ORDER': '맨 위에 `roof.*`(또는 `head`)를 둔다. 처마 `eave` 는 1층 바로 위 처마 띠로, 지붕 자리에 1층 띠를 넣지 않는다',
    'FLOOR_PAIR': '층 자리에는 위·아래 2줄 한 쌍인 층 띠(`fl.*`)만 넣는다(`terrace`·지붕 띠 금지)',
    'NO_DOOR': '`door` 를 주거나 생략한다(`type:"none"`·null 금지)',
    'DOOR_NOT_BOTTOM': '(조립 결과 손상 검사 전용 — 입력으로는 만들 수 없다)',
    'DOOR_BLOCKED': '문 앞 접근칸(문 바로 아래 한 줄)에서 걸을 수 있는 보도·도로를 6칸 이상 이어 깐다. 본채 문이 별채에 가리지 않게 `door.col` 을 옮긴다',
    'DECO_CLASH': '간판·차양·실외기 등은 민벽(`blank`)·창 없는 칸에 얹고, 같은 칸에 부착물 둘을 겹치지 않는다',
    'UNKNOWN_PART': '`list_jp_city_building_parts` 로 실제 id 를 확인한다',
    'DOOR_OUT_OF_RANGE': '`door.col` 을 0~(폭−문 폭) 안으로',
    'DECO_OUT_OF_RANGE': '`decos[].col`·`floor`·`row` 를 건물 사각형 안·있는 층으로',
    'OUT_OF_MAP': '건물 발을 옮겨 사각형 전체가 맵 안에 들게 한다',
    'BAD_INPUT': '숫자·필드 형식을 고친다(`floor` 는 문자열 "0"…)',
    'SHADOW_OMITTED': '(경고) L자 별채 그림자 생략 — 조치 없음',
}


def doc_bld_errors():
    codes = EN['issueCodes']
    cr = [[f'`{k}`', v, FIX[k]] for k, v in codes.items()]
    tr = []
    for t in EN['tampers']:
        errs = ', '.join(f"`{e['code']}`@({e['x']},{e['y']})" for e in t['errors']) or '(없음)'
        tr.append([t['id'], t['title'], t['what'], f"`{t['want']}`", ('거부 `' + t['toolCode'] + '`' if not t['toolOk'] else '**지어졌다(검출 실패)**'), '예' if t['mapUnchanged'] else '아니오', errs, f"`jp-img-err-bld-{t['id'].lower()}`"])
    sr = [[s['what'], ', '.join(f'`{g}`' for g in s['got'])] for s in EN['structureTampers']]
    return f'''# 일본 도시 — 건물 조립 · 정상/오류 · 자동 좌표 검증

{HEAD}

`build_jp_city_building` 은 일부러 틀린 입력을 **정확한 코드와 맵 좌표로 거부**하고(맵 불변), 정상 입력은 짓는다. 아래는 실제 도구를 호출한 결과다(`engine_dump.mts`, 시험판 맵 건물 폭+4 × 높이+5, 사각형 (2,1) 시작 — 좌표는 맵 칸 0 기준).
저장 전에 실패하면 **부분 배치가 남지 않는다**: 도구는 복제본에 찍어 엔진 통행으로 다시 검사한 뒤에만 반영한다(변조 11건 모두 「맵 불변」 확인, 아래 표).

## 오류 코드와 고치는 법
{md_table(['코드', '뜻', '고치는 법'], cr)}

## 변조 실험 (정상/오류 나란한 그림은 `jp-img-err-bld-<번호>`)
정상 입력은 편의점 6칸(3층, shiro, 지붕 `roof.ac.tank`, 문 auto 열 2)이다(B10 은 L자 정상판). 좌표는 오류 칸의 맵 좌표.
{md_table(['번호', '변조', '방법', '기대 코드', '도구 결과', '맵 불변', '검출 코드@맵 좌표', '그림'], tr)}

## 조립 결과를 직접 손상 (입력으로는 못 만드는 코드)
`checkJpCityStructure` 를 조립 결과에 직접 손상을 가해 돌렸다. 좌표는 건물 사각형 안 (열, 행).
{md_table(['손상', '검출'], sr)}

## 검사 범위 (과대 주장 금지)
- 보는 것: 띠 순서·층 쌍·문 유무와 위치·부착물의 창 위 얹힘과 겹침·사전에 없는 id·맵 안 여부·문 앞 접근칸의 통행과 도달(≥6칸)·막힘 칸이 엔진에서 실제로 막히는지.
- **보지 않는 것**: 문 이동 이벤트 실행·움직이는 NPC·미적 품질(색 조화·밀도)·이 문서를 읽는 낮은 성능 모델이 맞게 지을 확률. 검사 통과는 「구조와 통행이 맞다」는 뜻일 뿐이다.
- 회귀 시험 스크립트 `node scripts/content/jp-city/tamper_builder.mjs`(조립기 32건 + 도구 10건)는 이 문서를 만들 때 전부 통과했다.

## 레이어 정정 조건 (건물)
건물·부착물 칸은 **3층(`upperTiles`)·4층(`upperOverlayTiles`)** 에만 둔다(홈 레이어 위층). 1층에 두면 아래 땅이 없어 검게 보이고 그림 순서가 어긋난다 — 상가 용도의 오류 코드 `building-in-lower-layer`(용도 「상가 키트·문·소품」). 1층(`lowerTiles`)에는 땅(마당·주차장·보도)만 둔다.
'''


add_doc(C_BLD, 'bld-errors', '일본 도시 · 건물 조립 · 정상/오류·자동 좌표 검증', doc_bld_errors())


def img_bld_errors():
    for t in EN['tampers']:
        g = t['good']; bd = t['bad']
        k = best_scale([g['W'] * T, bd['W'] * T], [g['H'] * T, bd['H'] * T])
        gi = up(render(g['layers'], g['W'], g['H']), k)
        bi = up(render(bd['layers'], bd['W'], bd['H']), k)
        mark_cells(bi, [(e['x'], e['y']) for e in t['errors']], k, width=2)
        lab_bad = ', '.join(sorted({e['code'] for e in t['errors']})) or '?'
        save_img(f"err-bld-{t['id'].lower()}", panels([('정상 — 도구가 지은 결과', gi), (f"오류 {t['id']} — {t['title']} → {lab_bad}(거부, 지었다면)", bi)]),
                 f"건물 변조 {t['id']}: 정상(왼쪽, 도구가 지은 결과)/오류(오른쪽, 조립기가 계산한 「지었다면」 — 도구는 맵을 바꾸지 않고 거부). 변조: {t['what']}. 검출 {t['errors'] and ', '.join(e['code'] + '@(' + str(e['x']) + ',' + str(e['y']) + ')' for e in t['errors'])}. 빨강 테두리 = 오류 칸, 원본 ×{k}. 표는 `jp-bld-errors`.", C_BLD)


img_bld_errors()


# ====================================================================== 분류 4 — 도로·교차로 키트
C_ROAD = new_cat('road', '일본 도시 · 도로·교차로 키트',
                 '도로·교차로·건널목 키트 39종(생활도로 직선·T자·십자·굽은 길·막다른 길·횡단보도 2, 간선도로 4차선 직선·십자 교차로(신호기 4기 포함), 철도 건널목 4, 지하도·육교, 노면 표시·止まれ 글자 4방향·표지, 신호기 4종): 키트 id·크기·앵커·반복축·변 연결(팔) 위치·칸 번호 전체 배열·통행 코드, 키트를 이어 붙이는 공식과 정답 조립(생활도로 직선→T→십자, 굽은 길, 간선 교차로, 건널목), 오토타일과의 이음 한계, 정상/오류 그림.')
RC = {c['name']: c for c in EN['roadComps']}
RERR = EN['roadErrors']
KIT_CODES = EN['kitCodes']
LANE_KITS = [k for k in ROAD_KITS if k.startswith('jp-road-lane-')]
TRUNK_KITS = [k for k in ROAD_KITS if k.startswith('jp-road-trunk-')]
MISC_ROAD = [k for k in ROAD_KITS if k not in LANE_KITS and k not in TRUNK_KITS]
assert (len(LANE_KITS), len(TRUNK_KITS), len(MISC_ROAD)) == (17, 3, 19), (len(LANE_KITS), len(TRUNK_KITS), len(MISC_ROAD))


def kit_grid(kid):
    k = KITS[kid]
    return k['width'], k['height'], [r['tiles'] for r in k['rows']], [r['upperTiles'] for r in k['rows']]


def boundary_runs(kid):
    w, h, lo, upv = kit_grid(kid)
    occ = lambda x, y: lo[y][x] >= 0 or upv[y][x] >= 0
    sides = {'N': [occ(x, 0) for x in range(w)], 'S': [occ(x, h - 1) for x in range(w)], 'W': [occ(0, y) for y in range(h)], 'E': [occ(w - 1, y) for y in range(h)]}
    out = {}
    for s, v in sides.items():
        runs = []; st = None
        for i, b in enumerate(v + [False]):
            if b and st is None: st = i
            if not b and st is not None: runs.append((st, i - 1)); st = None
        out[s] = runs
    return out


def arms_of(kid):
    """도로가 이어 나가는 변(팔): 변 위 칸이 찬 구간이 도로 폭과 같은 것. 막다른 길(end-*)은 이름이 닫는 변을 뺀다."""
    width = 17 if kid.startswith('jp-road-trunk') else 4
    br = boundary_runs(kid); arms = {}
    closed = None
    m = re.search(r'lane-end-([nsew])$', kid)
    if m: closed = m.group(1).upper()
    for s, runs in br.items():
        if s == closed: continue
        for a, b in runs:
            if b - a + 1 == width: arms[s] = (a, b)
    return arms


OPP = {'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E'}


def next_pos(apos, akit, side, bkit):
    """A 의 side 팔에 B 를 이을 때 B 의 왼쪽 위 좌표(두 팔이 같은 선에 서도록)."""
    ax, ay = apos; aw, ah, _, _ = kit_grid(akit); bw, bh, _, _ = kit_grid(bkit)
    a0 = arms_of(akit)[side][0]; b0 = arms_of(bkit)[OPP[side]][0]
    if side == 'E': return (ax + aw, ay + a0 - b0)
    if side == 'W': return (ax - bw, ay + a0 - b0)
    if side == 'S': return (ax + a0 - b0, ay + ah)
    return (ax + a0 - b0, ay - bh)


# 정답 조립 좌표가 공식과 일치하는지(문서에 적는 공식의 근거) — 어긋나면 실패
_LC = [(p[0], p[1], p[2]) for p in RC['lane-chain']['placements']]
_ADJ = [(0, 'E', 1), (1, 'E', 2), (2, 'E', 3), (1, 'S', 4), (4, 'S', 5), (5, 'W', 6), (5, 'E', 7), (7, 'E', 8), (5, 'S', 9)]
for _a, _s, _b in _ADJ:
    got = next_pos((_LC[_a][1], _LC[_a][2]), _LC[_a][0], _s, _LC[_b][0])
    assert got == (_LC[_b][1], _LC[_b][2]), (_a, _s, _b, got, _LC[_b])
_TC = RC['trunk-cross']['placements']
for _a, _s, _b in ((0, 'E', 1), (1, 'E', 2)):
    got = next_pos((_TC[_a][1], _TC[_a][2]), _TC[_a][0], _s, _TC[_b][0])
    assert got == (_TC[_b][1], _TC[_b][2]), (_a, _s, _b, got, _TC[_b])


def kit_item(kid):
    k = KITS[kid]; ai = k['ai']; w, h, lo, upv = kit_grid(kid)
    arms = arms_of(kid)
    it = {'kit': kid, 'name': k['name'], 'w': w, 'h': h, 'anchor': ai.get('anchor'), 'repeat': (ai.get('growthAxis') if ai.get('repeatability') == 'repeat' else None),
          'arms': {s: [a, b] for s, (a, b) in arms.items()},
          'tiles': [[tnum(t) for t in r] for r in lo], 'upperTiles': [[tnum(t) for t in r] for r in upv], 'codes': KIT_CODES[kid]}
    if ai.get('access'): it['access'] = ai['access']
    emitted_kits.add(kid)
    return it


def kit_table(ids):
    rows = []
    for kid in ids:
        k = KITS[kid]; ai = k['ai']; arms = arms_of(kid)
        rows.append([f'`{kid}`', k['name'], f"{k['width']}×{k['height']}", ('반복 ' + ai['growthAxis']) if ai.get('repeatability') == 'repeat' else '고정',
                     (f"({ai['anchor']['dx']},{ai['anchor']['dy']})" if ai.get('anchor') else '-'),
                     ' '.join(f'{s}:{a}~{b}' for s, (a, b) in arms.items()) or '-'])
    return md_table(['키트 id', '이름', '크기 w×h', '반복/고정', '앵커(dx,dy)', '팔(변:시작~끝 오프셋)'], rows)


def doc_road_kit_dict(did, title, ids, extra=''):
    items = [kit_item(k) for k in ids]
    return f'''# 일본 도시 — 도로 키트 사전 · {title}

{HEAD}

키트 한 종의 **칸 번호 전체**다. 항목: `kit` id · `name` · `w`×`h` · `anchor`(키트의 「발」 기준점 dx,dy — 왼쪽 위가 (0,0)) · `repeat`(이어 붙여도 되는 축, null = 고정) · `arms`(도로가 이어 나가는 변 `N/S/E/W` → 변 위 시작~끝 오프셋, 변 위 칸이 찬 구간이 도로 폭과 같은 곳) ·
`tiles`(1층 칸, 줄마다) · `upperTiles`(3층 칸, 줄마다, 표시·화살표·표지 칸) · `codes`(칸마다 엔진 판정: `X` 막힘 · `*` 걸음 ★(캐릭터 위) · `.` 걸음 · `_` 빈 칸) · `access`(있으면 문 앞 같은 접근칸 오프셋).
-1 칸(위 배열에서는 -1 로 적힌 칸)은 **찍을 때 맵을 건드리지 않는다** — 키트 밖 땅(집 앞 보도·콘크리트)은 비어 있으니 먼저 깔고 겹쳐 찍는다. 찍는 법: `stamp_object({{"objectId":"kit:jp_city/<kit id>","mapId":"<맵>","x":<왼쪽 위 x>,"y":<왼쪽 위 y>}})`(기본 layers both).
{extra}
{kit_table(ids)}

{jfences(items, 14000)}
'''


add_doc(C_ROAD, 'road-dict-lane', '일본 도시 · 도로 키트 사전 · 생활도로 17종', doc_road_kit_dict('road-dict-lane', '생활도로 17종', LANE_KITS,
        '생활도로: 폭 4칸, 보도 없음, 가장자리에 흰 외측선. 직선(`lane-h` 6×4 가로 반복, `lane-v` 4×6 세로 반복)·T자 4방향·십자·굽은 길 4방향·막다른 길 4방향·횡단보도 2종(`lane-crosswalk-h` 6×4 가로 도로 · `lane-crosswalk-v` 4×6 세로 도로: 가운데 2칸 폭에 횡단보도 오토타일 칸을 얹은 직선 키트 — 직선 키트 한 곳을 이 키트로 바꿔 찍는다).'))
add_doc(C_ROAD, 'road-dict-trunk', '일본 도시 · 도로 키트 사전 · 간선도로 3종', doc_road_kit_dict('road-dict-trunk', '간선도로 3종', TRUNK_KITS,
        '간선도로 4차선: 차도 13줄(3칸 차선 넷 + 중앙분리대 1칸) + 양쪽 보도 2칸 = 폭 17칸. 왼쪽 통행(동쪽으로 가는 차는 북쪽 반). 분리대는 생울타리, 차선 경계는 점선. 직선은 `trunk-h` 8×17 가로 반복·`trunk-v` 17×8 세로 반복, 십자 교차로 `trunk-x` 는 29×29(정지선·방향 화살표·횡단보도 포함, 분리대는 횡단보도 앞에서 끝난다, 네 모퉁이 보도 끝에 신호기: 차량 3색 머리 + 보행 신호 달린 기둥, 마주 보는 모퉁이는 같은 신호).'))
add_doc(C_ROAD, 'road-dict-misc', '일본 도시 · 도로 키트 사전 · 건널목·지하도·육교·노면 표시·표지·신호기', doc_road_kit_dict('road-dict-misc', '철도 건널목 4 · 지하도 · 육교 · 노면 표시(자전거·止まれ 4방향) · 표지 4 · 신호기 4', MISC_ROAD,
        '건널목: 폭 4칸 생활도로 × 선로 한 줄, 경보기 둘 + 차단기 둘 + 바닥판 + 정지선. `-closed` 는 차단기 팔이 내려와 접근 차선을 막은 상태(열차 통과 연출용). 위층(경보기 머리·올라간 차단기 팔)은 지나갈 수 있고 기둥·본체·내려온 팔은 막힌다. 지하도·육교는 북쪽을 향한 한 방향. 신호기 1×2: `jp-road-signal-car`(차량 3색 머리, 青 켜짐)·`-car-red`(赤 켜짐)·`jp-road-signal-ped`(보행 신호, 赤 선 사람)·`-ped-green`(青 걷는 사람) — 머리칸(★ 지나감) 아래 기둥 받침(막힘). 큰 신호기·가로등은 시트의 기존 소품(`jp-prop-signal`·`jp-prop-lamp-post` 등)을 쓴다. 노면 글자 `jp-road-mark-tomare-n/e/s/w`(止まれ, 운전자가 북·동·남·서쪽으로 가며 읽는 방향)는 흰 칠 투명 오버레이라 도로(아래층) 위에 `stamp_object`(3층)로 얹는다.'))


def comp_doc(name, title, note):
    c = RC[name]; W, H = c['W'], c['H']
    pl = [[k, x, y] for k, x, y in c['placements']]
    for k, _, _ in pl: assert k in KITS, k
    log_ok = all(l['ok'] for l in c['log'])
    return f'''## {title} (그림 `jp-img-road-{name}`)
{note}
- 시험판 맵 {W}×{H}칸, 1층 전체 보도 `sw`({c['under']}) 위에 키트를 **위 순서대로** `stamp_object` 로 찍었다(전부 성공: {log_ok}). 좌표 = 키트 **왼쪽 위** 칸, 맵 칸 0 기준.
- 배치 목록 `[키트 id, x, y]`(찍는 순서):
{jfences(pl, 9000)}
- 결과 1층(`lowerTiles`) 전체 배열:
```text
{flat_rows(to_rows(c['layers']['1'], W))}
```
- 결과 3층(`upperTiles`) 전체 배열(표시·화살표·표지·경보기):
```text
{flat_rows(to_rows(c['layers']['3'], W))}
```
'''


def doc_road_assembly():
    adj_rows = []
    for a, s, b in _ADJ:
        pa, pb = _LC[a], _LC[b]
        adj_rows.append([f'`{pa[0]}`({pa[1]},{pa[2]})', s, f'`{pb[0]}`', f'({pb[1]},{pb[2]})', f"{arms_of(pa[0])[s][0]} → {arms_of(pb[0])[OPP[s]][0]}"])
    j = EN['joinExp']['laneJoin']
    lj = to_rows(j['layers']['1'], 18)
    return f'''# 일본 도시 — 도로·교차로 키트 조립 (공식 · 정답 조립 · 이음 한계)

{HEAD}

도로 키트 {len(ROAD_KITS)}종은 **낱칸이 아니라 키트 단위**로 찍는다. 키트 칸의 정확한 번호 배열은 `jp-road-dict-lane`·`jp-road-dict-trunk`·`jp-road-dict-misc`, 정답 조립 배열은 `jp-road-ex-*`.

## 키트 한눈에
{kit_table(ROAD_KITS)}
- **반복/고정**: 반복 가능 = 직선 4종(`lane-h`·`lane-v`·`trunk-h`·`trunk-v`, 같은 키트를 축 방향으로 키트 크기만큼 간격을 두고 연달아 찍는다). 나머지(교차로·굽은 길·막다른 길·횡단보도·건널목·지하도·육교·표시·표지·신호기)는 **고정** — 늘리거나 이어 붙이지 않는다.
- 도로 폭: 생활도로 4칸, 간선 17칸(차도 13 + 보도 2×2). 팔(`arms`)은 도로가 이어 나가는 변이다.

## 이어 붙이는 공식 (정답 조립 좌표로 검증됨)
A 키트 왼쪽 위 (ax,ay), A 의 `S` 변 팔 시작 오프셋 a0, B 키트의 맞은편 변(`OPP[S]`) 팔 시작 b0, B 크기 (bw,bh) 이면 B 의 왼쪽 위는
- `E`: (ax + aw, ay + a0 − b0) · `W`: (ax − bw, ay + a0 − b0) · `S`: (ax + a0 − b0, ay + ah) · `N`: (ax + a0 − b0, ay − bh).
즉 두 팔이 맞닿는 변에서 팔이 **같은 줄(열)** 에 서도록 오프셋 차이만큼 옮긴다. 직선 반복은 같은 키트로 이 식을 되풀이한 것이다(`lane-h` → `E` → `lane-h`: x 가 6씩).
아래 표는 정답 조립 `lane-chain` 의 이음 {len(_ADJ)}곳을 이 식으로 다시 계산해 **좌표가 정확히 일치**함을 확인한 것이다(스크립트 단언).
{md_table(['A (왼쪽 위)', 'A 의 변', 'B', 'B 왼쪽 위', '팔 시작 오프셋 a0 → b0'], adj_rows)}

## 실행 순서
1. **바닥**: 키트 밖(-1 칸)은 비어 있다. 집 앞 땅(보도 `sw`·콘크리트)을 먼저 깐다 — 키트 모서리 바깥이 비면 검게 보인다.
2. **도로 키트를 찍는다**: 교차로(T·십자)를 먼저 놓고 위 공식으로 직선·굽은 길·막다른 길을 이어 붙인다(찍는 순서는 결과에 영향이 없다 — 키트 칸이 겹치지 않는다).
3. 간선도로는 건물 쪽 보도가 키트 밖으로 이어지는 것으로 그려져 있으니 **건물 앞 보도에 겹쳐** 놓는다.
4. 신호기는 교차로 키트 `trunk-x` 에 네 모퉁이로 이미 들어 있다. 다른 곳(생활도로 십자·횡단보도 끝)에는 `jp-road-signal-car`·`jp-road-signal-ped` 1×2 를 보도 가장자리에 한 개씩 세운다(머리칸이 위, 기둥 받침이 아래 — 보도 폭이 2칸이면 한 칸만 막히니 안쪽 칸으로 지나가게 둔다). 가로등·볼라드는 도로 키트 밖 보도에 소품 키트로 찍는다(용도 「상가 키트·문·소품」).
5. **생활도로 횡단보도**: 가로 생활도로의 한 곳(6칸)을 `jp-road-lane-crosswalk-h`, 세로 생활도로의 한 곳(6칸)을 `jp-road-lane-crosswalk-v` 로 바꿔 찍는다. 도로 칸은 직선 키트와 같아 앞뒤 직선·오토타일 도로와 이음새가 맞는다.
6. **止まれ 노면 글자**: 일시정지 표지 `jp-road-sign-tomare`(1×2, 글자 없는 역삼각)를 길가에 세우고 그 앞 접근 차선에 `jp-road-mark-tomare-<방향>`(1×3 또는 3×1)을 얹는다. 방향 n=북행(글자가 똑바로 선다)·e=동행·s=남행·w=서행 — 운전자가 앞을 보고 읽는 방향이라 위에서 보는 지도에서는 n 만 바로 읽힌다(나머지는 글자가 돌아 있다).

## 정답 조립 4가지 (입력 = 배치 목록 → 전체 배열 → 그림은 실제 `stamp_object` 결과)
- 생활도로 직선 → T → 십자: `jp-road-ex-lane`(`lane-chain` 30×32: 직선 반복, T자 남쪽 가지, 세로 직선, 십자, 막다른 길).
- 굽은 길·막다른 길: `jp-road-ex-lane`(`lane-bends`).
- 간선 교차로: `jp-road-ex-trunk`(`trunk-cross` 45×29: `trunk-h` + `trunk-x` + `trunk-h`).
- 건널목: `jp-road-ex-fumikiri`(세로 건널목 열림 + 가로 건널목 닫힘).

## 오토타일과의 이음 (한계 — 실측)
키트의 도로·보도·선로 칸은 오토타일 칸을 화소 그대로 **복사한 별개 칸**(3616~)이라 오토타일의 멤버가 아니다(`jp-lane-road` 멤버와 겹치는 키트 칸 {j['kitCellsAreMembers']}개). 그래서 `jp-road-lane-h` 바로 오른쪽 (6,0) 부터 `fill_region` 으로 생활도로를 채운 시험(그림 `jp-img-road-join-limit`)에서
키트 쪽 이웃을 못 보고 첫 칸 (6,0) 이 가장자리 칸 {lj[0][6]}(「{suffix_label(AT['jp-lane-road'], lj[0][6])}」)로 닫혔다 — **키트와 오토타일은 이음새에서 끊긴다**. 키트는 키트끼리, 오토타일은 오토타일끼리 이어 칠한다.

## 한계
- 止まれ: 표지(`jp-road-sign-tomare`)는 역삼각 도형뿐(16px 도형 안에 글자가 안 들어간다). 글자는 노면 키트 `jp-road-mark-tomare-*` 가 맡지만 JIS 16×16 글리프를 가로로 1px 부풀린 것이라 가늘고, 동·서·남행은 글자가 돌아가 지도에서 읽기 어렵다(북행만 바로 읽힌다). 실제 예제 맵 ①(상가 거리)에는 쓰지 않았다.
- 차선 폭 3칸이라 간선 키트가 17칸 높이, 십자는 29×29(정의 크기)다.
- 건널목은 단선·생활도로(폭 4) 한 가지. 지하도·육교는 북쪽을 향한 한 방향.
- 신호기: 간선 십자 교차로 `trunk-x` 네 모퉁이에 4기가 들어 있고(위쪽 둘은 보도 ㄱ자 바깥 끝 칸, 아래쪽 둘은 한 칸 바깥), 단독 키트 `jp-road-signal-*`(1×2)도 있다. 신호는 정지 그림(青/赤 고정)이라 신호가 바뀌는 연출은 없다. 생활도로 십자·T자·건널목에는 신호기를 따로 찍어야 한다. 가로등·큰 신호기(`jp-prop-signal` 2×6)는 소품 키트다.
- 키트 칸 배열은 한 방향(canonical)으로 만들고 90도 회전해 4방향을 구웠다(T·굽은 길·막다른 길).
- **검사 범위**: 칸 번호·키트 id 와 좌표(공식 일치·도로 줄 끊김·층)만 본다. 신호·차량 흐름·이벤트·미적 품질은 보지 않는다.

## 정상/오류 — 자동 좌표 검증
{md_table(['코드', '뜻', '변조', '맵 좌표(x,y)', '그림'], [
    ['`road-gap`', '직선 반복 도로 줄 사이에 도로가 아닌 칸이 끼었다', '`lane-h` 반복 사이를 한 칸 비움(두 번째를 x=7 에)', ', '.join(f"({e['x']},{e['y']})" for e in RERR['badGap']['extra']), '`jp-img-err-road-gap`'],
    ['`arm-misaligned`', '이어 붙인 두 키트의 팔이 같은 줄에 서지 않는다(공식 위치와 다르다)', '`lane-v` 를 T 가지 아래 x=11 에(정답 x=10)', f"({RERR['shiftNote']['to'][0]},{RERR['shiftNote']['to'][1]}) 에서 +1열", '`jp-img-err-road-shift`'],
    ['`overlay-in-base-layer`', '투명 표시 칸(자전거 정차선 등)을 1층에 놓아 아래 땅이 사라졌다', '`stamp_layer_block` 로 `jp-road-mark-bike-stop` 칸을 1층에', ', '.join(f"({e['x']},{e['y']})" for e in RERR['markLower']['extra']['errors']), '`jp-img-err-road-mark-layer`'],
])}
**레이어 정정 조건**: 도로 키트의 1층 칸은 불투명 땅, 표시·화살표·표지·경보기 칸은 **3층**(`upperTiles`, 투명)이다. 3층 칸을 1층에 두면 `overlay-in-base-layer`, 땅 칸을 3층에 두면 위층 칸이 땅을 가린다. 키트는 `stamp_object` 로 통째로 찍어 층을 지킨다.
'''


add_doc(C_ROAD, 'road-assembly', '일본 도시 · 도로 키트 조립(공식·정답 조립·이음 한계·오류)', doc_road_assembly())
add_doc(C_ROAD, 'road-ex-lane', '일본 도시 · 도로 정답 조립 · 생활도로 직선→T→십자·굽은 길',
        f'''# 일본 도시 — 도로 정답 조립 · 생활도로

{HEAD}

입력(배치 목록) → 전체 1층·3층 배열 → 원본 해상도 그림. 실제 `stamp_object` 호출 결과다.

''' + comp_doc('lane-chain', '생활도로 직선 → T자 → 십자 → 막다른 길', '`lane-h` 를 6칸씩 이어 직선을 늘리고, T자 남쪽 가지에 `lane-v`, 그 아래에 십자 `lane-x`, 십자 남쪽에 막다른 길 `lane-end-s`, 십자 좌우에 다시 직선. 이음 좌표는 공식으로 계산한 값과 같다.')
        + comp_doc('lane-bends', '굽은 길·막다른 길', '서쪽 막다른 길 `lane-end-w` → 굽은 길 `bend-es`(동·남) → 세로 직선 → 굽은 길 `bend-ne` → 가로 직선 → 동쪽 막다른 길.'))
add_doc(C_ROAD, 'road-ex-trunk', '일본 도시 · 도로 정답 조립 · 간선 교차로',
        f'''# 일본 도시 — 도로 정답 조립 · 간선 교차로

{HEAD}

''' + comp_doc('trunk-cross', '간선 십자 교차로 + 좌우 직선', '`trunk-h`(8×17) · `trunk-x`(29×29) · `trunk-h` 를 가로로 이었다. `trunk-x` 의 서쪽·동쪽 팔은 y 6~22(17칸) — 직선은 y=6 에 놓는다.'))
add_doc(C_ROAD, 'road-ex-fumikiri', '일본 도시 · 도로 정답 조립 · 철도 건널목',
        f'''# 일본 도시 — 도로 정답 조립 · 철도 건널목

{HEAD}

건널목 키트는 **고정**이다(선로 한 줄 + 도로 4칸). 위 아래(좌우)로 생활도로 직선 키트를 이어 도로를 늘린다.

''' + comp_doc('fumikiri', '세로 도로 × 가로 선로(열림)', '`lane-v` → `fumikiri-v` → `lane-v`. 건널목 키트 폭 8 안에서 도로는 x 2~5(4칸).')
        + comp_doc('fumikiri-closed', '가로 도로 × 세로 선로(닫힘)', '`lane-h` 를 서쪽에 두고 `fumikiri-h-closed`(차단기 팔이 내려와 접근 차선을 막은 상태)를 이어 찍었다.'))


def img_roads():
    # 키트 도감
    def kit_img(kid, k=1):
        w, h, lo, upv = kit_grid(kid)
        layers = {'1': [t for r in lo for t in r], '3': [t for r in upv for t in r]}
        return up(render(layers, w, h, bg=(0, 0, 0, 0)), k)
    for i, pg in enumerate(shelf_pack([(k[8:], kit_img(k)) for k in LANE_KITS])):
        save_img(f'road-kits-lane-{i + 1}' if i else 'road-kits-lane', pg, f'생활도로 키트 17종 도감(원본 해상도, 라벨 = 키트 id 에서 `jp-road-` 를 뺀 것, 투명 칸은 체크 무늬 = -1 칸). 칸 번호는 `jp-road-dict-lane`.', C_ROAD)
    for i, pg in enumerate(shelf_pack([(k[8:], kit_img(k)) for k in TRUNK_KITS])):
        save_img(f'road-kits-trunk-{i + 1}' if i else 'road-kits-trunk', pg, f'간선도로 키트 3종 도감(원본 해상도, `trunk-x` 는 네 모퉁이에 신호기가 선 상태). 칸 번호는 `jp-road-dict-trunk`.', C_ROAD)
    for i, pg in enumerate(shelf_pack([(k[3:], kit_img(k, 2)) for k in MISC_ROAD])):
        save_img(f'road-kits-misc-{i + 1}' if i else 'road-kits-misc', pg, f'건널목 4·지하도·육교·노면 표시(止まれ 4방향 포함)·표지·신호기 키트 도감(원본 ×2). 칸 번호는 `jp-road-dict-misc`.', C_ROAD)
    # 정답 조립
    for name, k in (('lane-chain', 1), ('lane-bends', 1), ('trunk-cross', 1), ('fumikiri', 2), ('fumikiri-closed', 2)):
        c = RC[name]; im = up(render(c['layers'], c['W'], c['H']), k)
        save_img(f'road-{name}', panels([(f'{name} — 키트 {len(c["placements"])}개를 stamp_object 로 찍은 결과(원본 ×{k}, {c["W"]}×{c["H"]}칸)', im)]),
                 f'도로 정답 조립 `{name}`: 배치 목록 {len(c["placements"])}개를 실제 `stamp_object` 로 찍은 결과(원본 ×{k}). 배치 목록·전체 배열은 `jp-road-ex-*`.', C_ROAD)
    # 이음 한계
    j = EN['joinExp']['laneJoin']
    im = up(render(j['layers'], 18, 4), 2)
    mark_cells(im, [(6, y) for y in range(4)], 2, width=2)
    save_img('road-join-limit', panels([('왼쪽 6칸 = lane-h 키트 · 오른쪽 12칸 = fill_region(생활도로) — 이음새에서 닫힘(빨강 = 첫 오토타일 칸)', im)]),
             '키트와 오토타일의 이음 한계 실측: `jp-road-lane-h` 키트(x 0~5) 바로 오른쪽(x 6~17)을 `fill_region` 으로 생활도로 채웠다. 키트 칸은 오토타일 멤버가 아니라 첫 칸이 가장자리 칸으로 닫힌다(원본 ×2).', C_ROAD)
    # 오류 그림
    g = RERR['goodGap']; b = RERR['badGap']; k = best_scale([g['W'] * T, b['W'] * T], [g['H'] * T, b['H'] * T])
    gi = up(render(g['layers'], g['W'], g['H']), k); bi = up(render(b['layers'], b['W'], b['H']), k)
    mark_cells(bi, [(e['x'], e['y']) for e in b['extra']], k, width=2)
    save_img('err-road-gap', panels([('정상 — lane-h 를 6칸 간격(x 0·6·12)', gi), (f'오류 — 두 번째를 x=7 에: road-gap {len(b["extra"])}칸', bi)]),
             f'도로 변조 road-gap: 정상(왼쪽, `lane-h` 를 6칸 간격으로 반복)/오류(오른쪽, 두 번째 키트를 한 칸 띄움 → 도로 줄이 끊김, 좌표 ' + ', '.join(f"({e['x']},{e['y']})" for e in b['extra']) + f'). 빨강 테두리 = 오류 칸, 원본 ×{k}. 표는 `jp-road-assembly`.', C_ROAD)
    sb = RERR['shiftBad']; gd = RC['lane-chain']
    x0, y0, cw, ch = 6, 6, 12, 12
    def cropped(c):
        layers = {key: [c['layers'][key][(y0 + r) * c['W'] + x0 + col] for r in range(ch) for col in range(cw)] for key in ('1', '2', '3', '4')}
        return up(render(layers, cw, ch), 2)
    gi = cropped(gd); bi = cropped(sb)
    mark_cells(bi, [(11 - x0, 8 - y0 + r) for r in range(6)], 2, width=1)
    save_img('err-road-shift', panels([('정상 — lane-v 를 T 가지 바로 아래(x=10)', gi), ('오류 — lane-v 를 x=11 에: arm-misaligned', bi)]),
             f'도로 변조 arm-misaligned: 정상(왼쪽, `lane-v` 가 T자 남쪽 가지와 같은 줄 x=10)/오류(오른쪽, x=11 로 한 칸 어긋남 → 도로 폭이 틀어짐). 맵 칸 x {x0}~{x0 + cw - 1}, y {y0}~{y0 + ch - 1} 만 잘라 원본 ×2. 빨강 테두리 = 어긋난 키트(x=11, y 8~13).', C_ROAD)
    md = RERR['markDefault']; ml = RERR['markLower']; k = best_scale([md['W'] * T, ml['W'] * T], [md['H'] * T, ml['H'] * T])
    gi = up(render(md['layers'], md['W'], md['H']), k); bi = up(render(ml['layers'], ml['W'], ml['H']), k)
    mark_cells(bi, [(e['x'], e['y']) for e in ml['extra']['errors']], k, width=2)
    save_img('err-road-mark-layer', panels([('정상 — stamp_object (표시 칸은 3층)', gi), (f'오류 — 같은 칸을 1층에: overlay-in-base-layer {len(ml["extra"]["errors"])}칸', bi)]),
             f'도로 표시 변조 overlay-in-base-layer: `jp-road-mark-bike-stop`(투명 1칸). 정상(왼쪽, `stamp_object` → 3층)/오류(오른쪽, `stamp_layer_block` 로 1층에 → 아래 도로가 사라져 검게 보임). 좌표 ' + ', '.join(f"({e['x']},{e['y']})" for e in ml['extra']['errors']) + f'. 원본 ×{k}.', C_ROAD)


# arm-misaligned 를 공식으로 검증(오류 합성에서 lane-v 가 공식 위치와 다르다)
_sh = [(p[0], p[1], p[2]) for p in RERR['shiftBad']['placements']]
_good_v = next_pos((_LC[1][1], _LC[1][2]), _LC[1][0], 'S', _LC[4][0])
_bad_v = (_sh[4][1], _sh[4][2])
assert _bad_v != _good_v and _bad_v == (_good_v[0] + 1, _good_v[1]), (_bad_v, _good_v)
img_roads()


# ====================================================================== 분류 5 — 상가 키트·문·소품
C_SHOP = new_cat('shop', '일본 도시 · 상가 키트·문·소품',
                 '완성 상가 건물 레시피 25종·문 9종·거리 소품 142종: 키트 id·크기·앵커·문 앞 접근칸·입구·간판 부위·칸 번호 전체 배열·엔진 통행 코드, 3/4 시점 규칙, 통행·반복/고정·문 그림/접근칸/출입구/이벤트 구분, 배치 실행 순서, 정상/오류(문 앞 막힘·뒷줄/앞줄 순서·건물 칸을 1층에) 그림과 좌표.')
SE = EN['shopErrors']
PROP_GROUPS = [
    ('vehicle', '자동차·버스·트럭·인력거', r'^jp-prop-(car-|van-|bus|ad-truck|ricksha)'),
    ('rail', '열차·고가·역 설비', r'^jp-prop-(train|viaduct|catenary|station-gate|guard-tunnel|signal-overhead)'),
    ('shrine', '신사·절·참배 길', r'^jp-prop-(kaminarimon|hozomon|pagoda|honden|nakamise|censer|chozuya|lantern-post|stone-lantern|sanmon|string-lanterns)'),
    ('green', '나무·화분', r'^jp-prop-(tree-|planter|pot)'),
    ('sign', '간판·네온·깃발·상점 앞', r'^jp-prop-(neon-stack|akiba-neon|led-tower|nobori|blade-sign|street-flag|a-frame|coin-sign|coin-p|shop-cover|gacha-wall|theatre-front|arch-|omoide|tin-stall|maid-flyer)'),
    ('wall', '담·문·계단·차단물', r'^jp-prop-(wall-|gate-|stairs-|iron-stair|yuyake|barricade|cone)'),
    ('animal', '동물·놀이터', r'^jp-prop-(cat-|slide|swing|sandbox|hachiko)'),
    ('street', '거리 설비(자판기·자전거·신호·전봇대·벤치 등)', r'^jp-prop-'),
]


def prop_group(kid):
    for key, name, rx in PROP_GROUPS:
        if re.search(rx, kid): return key
    raise AssertionError(kid)


PG_NAME = {k: n for k, n, _ in PROP_GROUPS}
PG_COUNT = collections.Counter(prop_group(k) for k in PROPS)
assert sum(PG_COUNT.values()) == 142


def shop_item(kid):
    k = KITS[kid]; ai = k['ai']; w, h, lo, upv = kit_grid(kid)
    it = {'kit': kid, 'name': k['name'], 'w': w, 'h': h}
    if ai.get('anchor'): it['anchor'] = ai['anchor']
    if ai.get('access'): it['access'] = ai['access']
    parts = [{'kind': p['kind'], 'dx': p['dx'], 'dy': p['dy'], 'w': p['w'], 'h': p['h']} for p in k.get('parts', [])]
    if parts: it['parts'] = parts
    if any(t >= 0 for r in lo for t in r): it['tiles'] = [[tnum(t) for t in r] for r in lo]
    it['upperTiles'] = [[tnum(t) for t in r] for r in upv]
    it['codes'] = KIT_CODES[kid]
    emitted_kits.add(kid)
    return it


def doc_shop_rules():
    pr = [[r['id'], '; '.join(f"({a['x'] - 2},{a['y'] - 1}) 도달 {a['reach']}" for a in r['access'])] for r in EN['recipes']]
    eqrows = []
    for n in SPEC['examples']:
        b = BLD[n]; eq = EQ.get(n)
        eqrows.append([f'`{n}`', f"`{_recipe_id(n)}`", ('도구 거부 ' + b['code']) if not b['ok'] else (f'{eq[0]}/{eq[1]} 화소 다름' if eq else '-')])
    n_eq0 = sum(1 for v in EQ.values() if v and v[0] == 0)
    return f'''# 일본 도시 — 상가 키트·문·소품 규칙 (시점·통행·문 앞·반복/고정·배치 순서)

{HEAD}

## 키트 세 종류
- **레시피 {len(RECIPES)}종**(`jp-recipe-*`): 건물 한 채 완성품(문·간판 부위 포함). 건물 조립 도구의 완성 예제 {len(SPEC['examples'])}개와 이름이 1:1 로 대응한다(`konbini_block` ↔ `jp-recipe-konbini-block`, L자는 `jp-recipe-l-…`). 칸 배열은 문서 「상가 레시피 사전」.
- **문 {len(DOORS)}종**(`jp-door-*`, 2×3 · 마치야 3×3): 건물 지면 층 위에 겹쳐 찍는 부착물. 문서 「문 사전」.
- **소품 {len(PROPS)}종**(`jp-prop-*`): 자판기·자전거·신호기·전봇대·나무·차량·열차·신사 문·계단·네온 등 거리 소품. 문서 「소품 사전」. 후속 추가 자리: 주택가·역·공원·신사 구역용 세트는 없다(여기 있는 건 개별 소품).
**모든 키트는 고정**(`repeatability: fixed`)이다 — 늘리거나 이어 붙이지 않는다. 가로로 늘어놓고 싶은 것(자전거 줄·볼라드 줄)은 같은 키트를 칸 간격으로 **한 번씩 따로** 찍는다.

## 3/4 시점 규칙 (그림 규약, 블록 계약 `scripts/content/jp-city/CONTRACT.md`)
- 시점: 윗면 + **남쪽 정면**(3/4). 빛은 왼쪽 위, 그림자는 오른쪽 아래. 높은 지형·건물은 남쪽 변에 앞면, 낮은 지형(물)은 북쪽 변에 앞면.
- 팔레트: modern3(154색) 안의 색만, 알파 0/255(반투명 없음), 윤곽은 램프의 어두운 단. AI 이미지·행인(Actor1)은 번들에 없다.
- 키트 칸의 위·아래 겹침(문+건물 칸)은 **겹쳐 구운 칸**(2880~3132)에 이미 반영돼 있다 — 낱칸으로 다시 겹치지 않는다.

## 통행 (엔진 판정 — 키트마다 `codes` 가 문서에 있다)
- 건물 레시피: **지면 층(1층 띠) 아래 두 줄과 문 칸은 막힘**, 그 위(윗층·처마·옥상)는 걸어 지나갈 수 있고 사람 위에 그려진다(★).
- 소품: **밑동 칸은 막힘**, 윗부분은 ★(걸음·캐릭터 위). 투명 소품도 밑동은 막는다. 바퀴·열차 아랫줄 같은 투명 아랫단은 걸을 수 있다(캐릭터 밑).
- 차량·열차는 정지 그림(움직이지 않는다) — 밑동 막힘.
- 칸 종류와 층·통행 대응표는 `jp-sheet-map`(칸의 통행 종류). 키트 `codes` 문자: `X` 막힘 · `*` 걸음 ★ · `.` 걸음 · `_` 빈 칸.

## 문 그림 · 문 앞 접근칸 · 출입구 · 상호작용 이벤트 (서로 다른 것)
{md_table(['구분', '무엇', '통행', '비고'], [
    ['문 그림', '`jp-door-*` 2×3 부착물(레시피 안에는 합성 칸으로 이미 들어 있다)', '맨 아래 두 줄 막힘, 윗줄 ★', '그림일 뿐 이동을 일으키지 않는다'],
    ['출입구(입구 부위)', '키트 `parts` 의 `entrance`(문 칸 위치 dx,dy,w,h)', '막힘(문 칸)', '`stamp_object` 응답이 입구 맵 좌표를 돌려준다(이벤트 자리)'],
    ['문 앞 접근칸', '키트 바깥 **한 줄 아래**(`access`)', '걸을 수 있는 보도여야 한다', '소품·차량으로 막지 않는다(막으면 `door-access-blocked`)'],
    ['상호작용·전이 이벤트', '문 이동·대화 이벤트(저작자가 만든다)', '-', '도구가 만들지 않는다. 이벤트는 입구 칸, 길은 입구 바로 아래 칸에서 끝낸다. **이 문서의 검사는 이벤트 실행을 보지 않는다**'],
])}

## 실행 순서 (상가 한 구역)
1. **바닥**: 보도·도로를 먼저 깐다(오토타일·도로 키트). 건물 키트의 -1 칸 아래가 비면 검게 보이고, 접근칸이 막힌다.
2. **건물**: 뒷줄(발 y 가 작은 쪽) 먼저, 앞줄 나중. 레시피는 `stamp_object({{"objectId":"kit:jp_city/jp-recipe-<이름>","mapId":"<맵>","x":<왼쪽 위 x>,"y":<왼쪽 위 y>}})`(키트 크기는 사전의 `w`×`h`, 발 = 왼쪽 위 + (0,h−1)). 폭·층을 바꾸려면 `build_jp_city_building`(용도 「건물 조립 도구」).
3. **문 앞 접근칸 확인**: 레시피마다 `access` 오프셋(문 아래 한 줄)에서 걸을 수 있는 칸이 6칸 이상 이어져야 한다 — 시험판(보도 위)에서는 전부 도달 7칸(아래 표).
4. **소품**: 보도·도로 위에 소품 키트를 찍는다. 접근칸·횡단보도 접점을 피한다. 소품 발밑이 막힘 칸이므로 길을 막지 않는 자리에 둔다.
5. **검사**: 용도 「정상/오류」·이 문서 끝의 변조 표(문 앞 막힘·뒷줄/앞줄 순서·건물 칸을 1층에).

## 레시피 25종의 문 앞 접근칸 도달 (시험판 맵 보도 위, 키트 왼쪽 위 (2,1), 엔진 `isPassable` BFS, 6칸이면 통과)
{md_table(['레시피', '접근칸(키트 안 오프셋) 도달 칸 수(최대 7까지 센다)'], pr)}
{len(EN['recipes'])}종 전부 모든 접근칸에서 도달 ≥ 6.

## 레시피 = 건물 조립 도구 결과? (같은 자리 화소 비교)
도구가 지은 화면과 같은 이름 레시피를 같은 자리에 `stamp_object` 로 찍은 화면을 화소 단위로 비교했다.
{md_table(['건물 조립 예제', '레시피 키트', '비교'], eqrows)}
화소가 완전히 같은 예제 {n_eq0}개. 나머지 4개 중 `L_office_cafe` 는 별채 그림자(도구가 칸 번호로 못 그려 생략)에 해당하는 화소만 다르고, 3개(`machiya_izakaya` `L_machiya_annex` `L_flats_lot`)는 도구가 `DECO_CLASH` 로 거부해 비교 대상이 아니다.

## 정상/오류 — 자동 좌표 검증
{md_table(['코드', '뜻', '변조', '맵 좌표(x,y)', '그림'], [
    ['`door-access-blocked`', '문 앞 접근칸이 소품·차량·땅 때문에 막혔거나 걸어서 6칸 못 간다', '`jp-recipe-konbini-block`(발 아래 접근칸 (5,12)(6,12)) 위에 `jp-prop-vend-pair`(4×2)를 (4,11) 에 찍음', ', '.join(f"({e['x']},{e['y']})" for e in SE['blockedAccess']['errors']), '`jp-img-err-shop-door-access`'],
    ['`back-over-front`', '겹치는 두 건물을 뒷줄이 나중에 찍혀 앞 건물을 덮었다', '앞 `konbini-block`·뒤 `sushi-bar` 를 앞→뒤 순서로 찍음', f"{len(SE['orderBad']['errors'])}칸: " + ', '.join(f"({e['x']},{e['y']})" for e in SE['orderBad']['errors'][:6]) + ' …', '`jp-img-err-shop-order`'],
    ['`building-in-lower-layer`', '건물·소품 칸(홈 위층)이 1층에 있다 — 아래 땅이 사라지고 그림 순서가 어긋난다', '`stamp_layer_block` 로 건물 칸 66칸을 1층에 놓음', f"{len(SE['lowerBuilding']['errors'])}칸(예: " + ', '.join(f"({e['x']},{e['y']})" for e in SE['lowerBuilding']['errors'][:4]) + f"…), 그중 엔진에서 걸을 수 있다고 판정된 칸 {SE['lowerBuilding']['walkableBuildingCells']}", '`jp-img-err-shop-layer`'],
])}
- 정상 대조: 변조 전 같은 맵 — `door-access-blocked` 0건(접근칸 도달 {', '.join(str(a['reach']) for a in SE['okAccess']['acc'])}), `back-over-front`(뒷 → 앞 순서) {len(SE['orderGood']['errors'])}건.
- **검사 범위**: 칸 번호·층·통행·접근칸 도달(구조). 이벤트 실행·움직이는 NPC·미적 품질·낮은 성능 모델이 맞게 깔 확률은 보지 않는다. 저장 전 실패하면 부분 배치가 남지 않는다는 보장은 `build_jp_city_building` 에만 있다 — `stamp_object` 는 맵 밖으로 나간 칸을 잘라 내고 경고만 한다(검사는 이 표의 코드를 사후에 훑는 방식).
**레이어 정정 조건**: 건물·소품 칸은 3층(`upperTiles`)에만, 땅은 1층에만 둔다. 건물 칸이 1층에 있으면 `building-in-lower-layer` — 3층으로 옮기고 1층은 땅(보도)으로 되돌린다. 키트를 `stamp_object` 로 통째로 찍으면 층이 지켜진다.
'''


add_doc(C_SHOP, 'shop-rules', '일본 도시 · 상가 키트·문·소품 규칙(시점·통행·문 앞·배치 순서·오류)', doc_shop_rules())


def doc_shop_recipes(idx, ids):
    items = []
    by = {r['id']: r for r in EN['recipes']}
    for kid in ids:
        it = shop_item(kid)
        it['accessReach'] = [a['reach'] for a in by[kid]['access']]
        items.append(it)
    return f'''# 일본 도시 — 상가 레시피 사전 {idx}/2 ({len(ids)}종, 칸 번호 전체)

{HEAD}

완성 상가 건물 키트의 **칸 번호 전체**다. 항목: `kit` · `name` · `w`×`h` · `access`(문 앞 접근칸 오프셋 dx,dy — 키트 왼쪽 위 기준, 건물 사각형 **바깥** 한 줄 아래) · `parts`(`entrance` = 입구/문 칸 dx,dy,w,h · `sign` = 간판 부위) ·
`tiles`(1층 칸, 있으면) · `upperTiles`(3층 칸, 줄마다) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸) · `accessReach`(시험판 보도 위에서 접근칸마다 걸어 갈 수 있는 칸 수, 최대 7).
`-1` 은 찍을 때 맵을 건드리지 않는 칸이다. 발 = 왼쪽 위 + (0, h−1). 규칙은 `jp-shop-rules`, 그림은 `jp-img-shop-recipes-*`.

{jfences(items, 14000)}
'''


_half = (len(RECIPES) + 1) // 2
add_doc(C_SHOP, 'shop-recipes-1', '일본 도시 · 상가 레시피 사전 1/2', doc_shop_recipes(1, RECIPES[:_half]))
add_doc(C_SHOP, 'shop-recipes-2', '일본 도시 · 상가 레시피 사전 2/2', doc_shop_recipes(2, RECIPES[_half:]))


def doc_shop_doors():
    items = [shop_item(k) for k in DOORS]
    return f'''# 일본 도시 — 문 사전 ({len(DOORS)}종, 칸 번호 전체)

{HEAD}

문 키트(`jp-door-*`)는 건물 지면 층(1층 띠 3줄) **위에 겹쳐** 찍는 2×3(마치야 3×3) 부착물이다. 맨 아래 두 줄은 막힘(문 칸), 윗줄은 ★. 문 앞 접근칸 = 키트 바깥 한 줄 아래(`access`).
건물 조립 도구에서는 `door.type` 으로 고른다(`lattice·auto·lobby·steel·cafe·noren·rollup·machiya·house`). 항목 필드는 「상가 레시피 사전」과 같다. 그림 `jp-img-shop-doors`.

{jfences(items, 12000)}
'''


add_doc(C_SHOP, 'shop-doors', '일본 도시 · 문 사전(9종)', doc_shop_doors())


def doc_shop_props():
    ordered = sorted(PROPS, key=lambda k: ([g[0] for g in PROP_GROUPS].index(prop_group(k)), PROPS.index(k)))
    docs = []; cur = []; size = 0
    for kid in ordered:
        it = shop_item(kid); n = len(jline(it))
        if cur and size + n > 38000: docs.append(cur); cur = []; size = 0
        cur.append((kid, it)); size += n
    if cur: docs.append(cur)
    return docs


_PD = doc_shop_props()
for _i, _chunk in enumerate(_PD):
    _groups = list(dict.fromkeys(prop_group(k) for k, _ in _chunk))
    _toc = '\n'.join(f"- {PG_NAME[g]}: " + ', '.join(f'`{k}`' for k, _ in _chunk if prop_group(k) == g) for g in _groups)
    add_doc(C_SHOP, f'shop-props-{_i + 1}', f'일본 도시 · 소품 사전 {_i + 1}/{len(_PD)}',
            f'''# 일본 도시 — 소품 사전 {_i + 1}/{len(_PD)} ({len(_chunk)}종, 칸 번호 전체)

{HEAD}

거리 소품 키트 {len(PROPS)}종 중 이 문서의 {len(_chunk)}종이다(분류: 아래 목록, 전체는 {len(_PD)}개 문서). 항목 필드는 「상가 레시피 사전」과 같다(소품에는 `access`·`parts` 가 없다). 모든 소품은 **고정**.
`codes` 의 `X` = 밑동(막힘) · `*` = 윗부분 ★(걸음·캐릭터 위) · `.` = 걸음 · `_` 빈 칸. 소품은 **보도·도로·잔디 위**에 찍고, 문 앞 접근칸과 횡단보도 접점을 피한다. 그림 `jp-img-shop-props-*`.
{_toc}

{jfences([it for _, it in _chunk], 13000)}
''')


def img_shop():
    def kit_im(kid, k):
        w, h, lo, upv = kit_grid(kid)
        return up(render({'1': [t for r in lo for t in r], '3': [t for r in upv for t in r]}, w, h, bg=(0, 0, 0, 0)), k)
    for i, pg in enumerate(shelf_pack([(k[10:], kit_im(k, 1)) for k in RECIPES])):
        save_img(f'shop-recipes-{i + 1}', pg, f'상가 레시피 {len(RECIPES)}종 도감 {i + 1}(키트를 그대로, 원본 해상도, 라벨 = 키트 id 에서 `jp-recipe-` 를 뺀 것, 체크 무늬 = 키트 밖 -1 칸). 칸 번호는 `jp-shop-recipes-*`.', C_SHOP)
    for i, pg in enumerate(shelf_pack([(k[8:], kit_im(k, 4)) for k in DOORS])):
        save_img(f'shop-doors-{i + 1}' if i else 'shop-doors', pg, f'문 {len(DOORS)}종 도감(원본 ×4, 라벨 = 키트 id 에서 `jp-door-` 를 뺀 것). 칸 번호는 `jp-shop-doors`.', C_SHOP)
    order = sorted(PROPS, key=lambda k: ([g[0] for g in PROP_GROUPS].index(prop_group(k)), PROPS.index(k)))
    for gk, gn, _ in PROP_GROUPS:
        ids = [k for k in order if prop_group(k) == gk]
        items = [(k[8:], kit_im(k, 2 if max(KITS[k]['width'], KITS[k]['height']) <= 6 else 1)) for k in ids]
        for i, pg in enumerate(shelf_pack(items)):
            save_img(f'shop-props-{gk}-{i + 1}', pg, f'소품 도감 — {gn} {len(ids)}종 {i + 1}쪽(작은 소품 ×2, 큰 소품 원본 해상도, 라벨 = 키트 id 에서 `jp-prop-` 를 뺀 것). 칸 번호는 `jp-shop-props-*`.', C_SHOP)
    # 오류 그림
    a = SE['okAccess']; b = SE['blockedAccess']; W, H = 12, 17
    k = best_scale([W * T, W * T], [H * T, H * T])
    gi = up(render(a['layers'], W, H), k); bi = up(render(b['layers'], W, H), k)
    mark_cells(bi, [(e['x'], e['y']) for e in b['errors']], k, width=2); mark_cells(gi, [(x['x'], x['y']) for x in a['acc']], k, color=(40, 220, 80, 255), width=1)
    save_img('err-shop-door-access', panels([('정상 — 문 앞 접근칸(초록)이 열려 있다', gi), (f'오류 — 소품이 접근칸을 막음: door-access-blocked {len(b["errors"])}칸', bi)]),
             f'상가 변조 door-access-blocked: `jp-recipe-konbini-block` 문 앞 접근칸 (5,12)(6,12). 정상(왼쪽, 초록 테두리 = 접근칸, 도달 7)/오류(오른쪽, `jp-prop-vend-pair` 를 (4,11) 에 찍어 접근칸 도달 0). 좌표 ' + ', '.join(f"({e['x']},{e['y']})" for e in b['errors']) + f'. 원본 ×{k}.', C_SHOP)
    g, bd = SE['orderGood'], SE['orderBad']; W, H = 14, 19
    k = best_scale([W * T, W * T], [H * T, H * T])
    gi = up(render(g['layers'], W, H), k); bi = up(render(bd['layers'], W, H), k)
    mark_cells(bi, [(e['x'], e['y']) for e in bd['errors']], k, width=1)
    save_img('err-shop-order', panels([('정상 — 뒷줄(sushi-bar) 먼저, 앞줄(konbini-block) 나중', gi), (f'오류 — 앞줄 먼저·뒷줄 나중: back-over-front {len(bd["errors"])}칸', bi)]),
             f'상가 변조 back-over-front: 겹치는 두 건물. 정상(왼쪽, 뒤→앞 순서)/오류(오른쪽, 앞→뒤 순서로 찍어 뒷건물이 앞건물 위로 올라옴). 빨강 테두리 = 앞 건물 칸이 뒷건물에 덮인 {len(bd["errors"])}칸, 좌표 ' + ', '.join(f"({e['x']},{e['y']})" for e in bd['errors'][:6]) + f' … 원본 ×{k}.', C_SHOP)
    lb = SE['lowerBuilding']; W, H = 12, 17
    k = best_scale([W * T, W * T], [H * T, H * T])
    gi = up(render(a['layers'], W, H), k); bi = up(render(lb['layers'], W, H), k)
    mark_cells(bi, [(e['x'], e['y']) for e in lb['errors']][:80], k, width=1)
    save_img('err-shop-layer', panels([('정상 — 건물 칸은 3층', gi), (f'오류 — 건물 칸을 1층에: building-in-lower-layer {len(lb["errors"])}칸', bi)]),
             f'상가 변조 building-in-lower-layer: 정상(왼쪽, `stamp_object` → 3층)/오류(오른쪽, `stamp_layer_block` 로 같은 칸을 1층에 → 아래 보도가 사라져 투명 부분이 검게 보이고 그림 순서가 어긋남). 엔진에서 걸을 수 있다고 판정된 건물 칸 {lb["walkableBuildingCells"]}칸. 원본 ×{k}.', C_SHOP)


img_shop()


# ====================================================================== 분류 5b — 손 도트 건물 키트(jp-bldg-*)
BLDG = [k for k in KITS if k.startswith('jp-bldg-')]
BLDG_EN = {r['id']: r for r in EN['bldgKits']}
BC = EN['bldgComps']
_BCAT = collections.OrderedDict((('단독주택', []), ('공동주택', []), ('가게', []), ('음식점', []), ('상업 건물', []), ('공공 건물', []), ('공장·창고', [])))
for _k in BLDG:
    _BCAT[KITS[_k]['ai']['tags'][1]].append(_k)
assert sum(len(v) for v in _BCAT.values()) == len(BLDG), 'jp-bldg 분류 누락'
C_HB = new_cat('buildings-hand', f'일본 도시 · 손 도트 건물 {len(BLDG)}종',
               f'손 도트로 그린 일본 동네 건물 {len(BLDG)}종 통 키트(`jp-bldg-*`): 단독주택·목조 아파트·맨션·단지·채소가게·생선가게·빵집·이자카야·소바집·편의점·슈퍼·우체국·파출소·목욕탕·공장 등. '
               '키트 id·크기·막힘 줄·출입구·문 앞 접근칸·칸 번호 전체 배열·엔진 통행 코드, 줄지어 세우는 공식(다음 x = x + w − 1), 정답 조립(상점가·주택가)과 정상/오류(접근칸 막힘·두 칸 겹침) 그림과 좌표.')


def _bfoot(kid):
    k = KITS[kid]; codes = KIT_CODES[kid]
    d = sum(1 for r in codes if 'X' in r)
    return k['width'], k['height'], d


def doc_bldg_rules():
    rows = []
    for cat, ids in _BCAT.items():
        for kid in ids:
            w, h, d = _bfoot(kid); r = BLDG_EN[kid]
            rows.append([f'`{kid}`', KITS[kid]['name'], cat, f'{w}×{h}', d, '; '.join(f"({a['x'] - 2},{a['y'] - 1})" for a in r['access']) or '출입구 없음(셔터·빈 점포)', min((a['reach'] for a in r['access']), default='-')])
    sr = BC['shopRow']; hr = BC['houseRow']; st = BC['streetRow']
    return f"""# 일본 도시 — 손 도트 건물 {len(BLDG)}종 · 쓰는 법

{HEAD}

**무엇인가.** 스크립트 손 도트(modern3 팔레트, 빛 왼쪽 위, 정면 고정 3/4 시점, 한 층 32px·문 16×28·사람 16×24 눈금)로 그린 일본 동네 건물 한 채 = 키트 하나.
그림 원본은 `scripts/content/jp-city/houses/`(기준 집 `ref_house.py` → 조립 키트 `house_kit.py` → 상점 부품 `shop_parts.py` → 목록 `catalog.py`), 굽기 블록은 `blocks/buildings.py`.
띠 부품 조립 건물(`build_jp_city_building`, `jp-recipe-*`)과 **다른 계열**이다 — 한 거리에 섞어도 되지만 크기 눈금이 같으니 문·창 높이를 비교해 고른다.

**찍는 법(실행 순서).**
1. 바닥을 먼저 깐다: 보도(`jp:street:sw`)·생활도로·마당(자갈·잔디). 건물 키트에는 바닥(1층) 칸이 없다 — 모든 칸이 3층(위층).
2. `stamp_object` 로 `kit:jp-bldg-…` 를 찍는다(좌표 = 키트 왼쪽 위). 발 = 왼쪽 위 + (0, h−1). 출입구는 맨 아래 줄.
3. **줄지어 세우기:** 키트 양 끝 한 칸은 처마만 있는 칸이다. 단품을 나란히 세우는 가장 촘촘한 간격은 **다음 x = x + w − 1**(처마 칸끼리 1칸 겹침)이고,
   이때 **벽 사이에 1칸 틈(좁은 골목)**이 남는다 — 오른쪽 건물의 처마 칸이 왼쪽 건물의 처마 칸을 덮는다. 다음 x = x + w 면 틈 2칸.
   **x + w − 2 이하로 겹치면 앞 건물의 벽 칸이 덮여 잘린다**(오류 `wall-overwritten`, 아래 그림). 한 칸에 위층 그림이 하나뿐이라 옆 건물 처마를 화소로 겹칠 수 없다.
   **벽을 맞댄 상점가(商店街)는 줄 키트 `jp-bldg-row-*` 6종을 쓴다** — 단품 4~5채를 미리 합친 키트다(상점가 A~D·음식점 줄·역 앞 줄). 줄 키트끼리도 x + w − 1 로 이어 세우면 블록 사이에 1칸 골목이 생긴다.
4. 두 줄 이상이면 **뒷줄(화면 위쪽) 건물부터** 찍는다. 앞줄이 뒷줄 지붕을 덮어야 한다(상가 키트와 같은 규칙, `jp-shop-rules`).
5. 출입구 바로 아래 한 칸(`access`)은 걸을 수 있는 바닥으로 비운다. 소품·자판기·화분을 그 칸에 놓지 않는다(오류 `door-access-blocked`).
6. 문과 이벤트는 별개다: 출입구(`parts` 의 `entrance`)는 그림 위치이고, 실내 이동은 그 칸에 이벤트(전이)를 따로 놓는다. 접근칸은 사람이 서는 곳.

**통행(엔진 판정 `codes`).** 맨 아래 D줄(대부분 2, 3층 이상·큰 건물은 3)의 벽 칸만 `X` 막힘. 그 위 지붕·윗층과 양 끝 처마 칸은 `*`(걸음 · 캐릭터 위에 그림) —
건물 뒤(북쪽)를 지나가는 캐릭터가 지붕에 가려진다. 벽 칸은 실내가 아니다(정면 하나만 그렸고 옆면·뒷면은 없다).

**고정/반복.** 모든 건물 키트는 고정(늘리기 없음). 폭이 다른 건물이 필요하면 다른 키트를 고르거나 같은 계열 둘을 붙여 세운다.

**셔터 가게**(`*-shut`·`shop-vacant`·줄 키트 `row-shutter-*` 안의 셔터 칸)는 문이 없다 — `access` 가 비어 있고 이벤트(전이)를 두지 않는다. 동네 한 장에 10칸 중 1~2칸 섞는다(빈 점포율 13.6%, 조사 `tiledata/jp-city/research/README.md`).

**없는 것(정직한 목록).** 뒷면·옆면 그림 없음 · 간판 글자는 일본어 고정 · 마당·담·주차장·자전거 보관대는 키트 밖(오토타일·소품으로) · 실내 맵 없음 · 밤 조명판 없음.

## 목록 ({len(BLDG)}종)
{md_table(['키트', '이름', '분류', '폭×높이', '막힘 줄', '접근칸(dx,dy)', '도달(시험판 최소)'], rows)}

도달 = 시험판(보도 + 도로 2줄)에 키트만 찍고 접근칸에서 걸어 갈 수 있는 칸 수(최대 6에서 멈춤). 모든 키트 ≥ 6이면 출입구 앞이 열려 있다.

## 정답 조립 3개(엔진이 실제로 찍은 결과)
- 상점가 `bldg-shop-row`: {len(sr['placements'])}채, 맵 {sr['W']}×{sr['H']}, 배치 {jline(sr['placements'])}. 그림 `jp-img-bldg-shop-row`, 배열 `jp-bldg-hand-ex`.
- 주택가 `bldg-house-row`: {len(hr['placements'])}채, 맵 {hr['W']}×{hr['H']}, 배치 {jline(hr['placements'])}. 그림 `jp-img-bldg-house-row`.
- 벽을 맞댄 상점가 `bldg-street-row`: 줄 키트 {len(st['placements'])}개, 맵 {st['W']}×{st['H']}, 배치 {jline(st['placements'])}. 그림 `jp-img-bldg-street-row`.
"""


assert all(a['reach'] >= 6 for r in EN['bldgKits'] for a in r['access']), [r['id'] for r in EN['bldgKits'] if any(a['reach'] < 6 for a in r['access'])]
add_doc(C_HB, 'bldg-hand-rules', f'일본 도시 · 손 도트 건물 {len(BLDG)}종 · 쓰는 법·통행·줄지어 세우기', doc_bldg_rules())


def _bldg_dict_docs():
    docs = []; cur = []; size = 0
    for cat, ids in _BCAT.items():
        for kid in ids:
            it = shop_item(kid); it['category'] = cat; it['accessReach'] = [a['reach'] for a in BLDG_EN[kid]['access']]
            n = len(jline(it))
            if cur and size + n > 36000: docs.append(cur); cur = []; size = 0
            cur.append(it); size += n
    if cur: docs.append(cur)
    return docs


_BD = _bldg_dict_docs()
for _i, _chunk in enumerate(_BD):
    add_doc(C_HB, f'bldg-hand-dict-{_i + 1}', f'일본 도시 · 손 도트 건물 사전 {_i + 1}/{len(_BD)}', f"""# 일본 도시 — 손 도트 건물 사전 {_i + 1}/{len(_BD)} ({len(_chunk)}종, 칸 번호 전체)

{HEAD}

항목: `kit` · `name` · `category` · `w`×`h` · `anchor` · `access`(문 앞 접근칸 dx,dy — 키트 바깥 한 줄 아래) · `parts`(`entrance` = 출입구 그림 칸) ·
`upperTiles`(3층 칸 전체, `-1` = 맵을 건드리지 않는 칸) · `codes`(엔진 판정 `X` 막힘 · `*` ★ 뒤로 지나감 · `.` 걸음 · `_` 빈 칸) · `accessReach`(시험판 도달).
이 문서의 키트: {', '.join(f'`{it["kit"]}`' for it in _chunk)}. 그림 `jp-img-bldg-dict-*`.

{jfences(_chunk, 13000)}
""")


def doc_bldg_ex():
    sr = BC['shopRow']; hr = BC['houseRow']; st = BC['streetRow']
    def arr(c):
        W = c['W']
        return {'name': c['name'], 'W': W, 'H': c['H'], 'placements': c['placements'],
                'tiles': to_rows([tnum(t) for t in c['layers']['1']], W), 'upperTiles': to_rows([tnum(t) for t in c['layers']['3']], W)}
    return f"""# 일본 도시 — 손 도트 건물 정답 조립(상점가·주택가, 전체 배열)

{HEAD}

입력(배치 목록) → 엔진이 `stamp_object` 로 찍은 **전체 1층·3층 배열** → 원본 해상도 그림(`jp-img-bldg-shop-row`, `jp-img-bldg-house-row`, `jp-img-bldg-street-row`).\n단품 사이는 1칸 골목이 남는다. 벽을 맞댄 상점가는 줄 키트 `jp-bldg-row-*` 로 찍는다.
바닥: 보도(`jp:street:sw`) 위에 맨 아래 2줄 생활도로. 건물 발은 도로 위 두 줄(보도 줄 바로 위), 접근칸은 보도 줄.
배치 공식: 첫 키트 x=1, 다음 x = x + w − 1. y = (맵 높이 − 4) − h + 1.

```json
{jline(arr(sr))}
```

```json
{jline(arr(hr))}
```

벽을 맞댄 상점가(줄 키트 2개, 블록 사이 1칸 골목) — 그림 `jp-img-bldg-street-row`:

```json
{jline(arr(st))}
```
"""


add_doc(C_HB, 'bldg-hand-ex', '일본 도시 · 손 도트 건물 정답 조립(상점가·주택가 전체 배열)', doc_bldg_ex())


def doc_bldg_errors():
    be = BC['blockedErr']; oe = BC['overlapErr']
    return f"""# 일본 도시 — 손 도트 건물 정상/오류(엔진 변조 실험)

{HEAD}

| 오류 코드 | 변조 | 검출 칸(맵 좌표 x,y) | 그림 |
|---|---|---|---|
| `door-access-blocked` | 상점 3채 줄에서 두 번째 가게 접근칸 위로 `jp-prop-vend-pair` 를 찍음 | {', '.join(f"({e['x']},{e['y']})" for e in be)} | `jp-img-err-bldg-access` |
| `wall-overwritten` | 다음 x = x + w − **2**(두 칸 겹침) | {len(oe)}칸, 처음 {', '.join(f"({e['x']},{e['y']})" for e in oe[:8])} | `jp-img-err-bldg-overlap` |

검사 범위: 구조(칸 번호가 키트대로 남았는가)와 통행(접근칸에서 걸어 갈 수 있는 칸 수)만 잰다. 미적 품질·실내 이동 이벤트·건물 사이 간격의 자연스러움은 이 검사로 판정하지 않는다.
정상 쪽은 같은 줄을 x + w − 1 로 세운 것(오류 0).
"""


assert BC['blockedErr'], '접근칸 막힘 변조가 검출되지 않았다'
assert BC['overlapErr'], '두 칸 겹침 변조가 검출되지 않았다'
add_doc(C_HB, 'bldg-hand-errors', '일본 도시 · 손 도트 건물 정상/오류(접근칸 막힘·두 칸 겹침)', doc_bldg_errors())


def img_bldg():
    def kit_im(kid, k=1):
        w, h, lo, upv = kit_grid(kid)
        return up(render({'1': [t for r in lo for t in r], '3': [t for r in upv for t in r]}, w, h, bg=(0, 0, 0, 0)), k)
    for cat, ids in _BCAT.items():
        for i, pg in enumerate(shelf_pack([(k[8:], kit_im(k)) for k in ids])):
            slug = {'단독주택': 'house', '공동주택': 'apartment', '가게': 'shop', '음식점': 'restaurant', '상업 건물': 'commercial', '공공 건물': 'public', '공장·창고': 'industrial'}[cat]
            save_img(f'bldg-dict-{slug}-{i + 1}', pg, f'손 도트 건물 도감 — {cat} {len(ids)}종 {i + 1}쪽(원본 해상도, 라벨 = 키트 id 에서 `jp-bldg-` 를 뺀 것, 체크 무늬 = -1 칸). 칸 번호는 `jp-bldg-hand-dict-*`.', C_HB)
    for key, nm in (('shopRow', 'shop-row'), ('houseRow', 'house-row'), ('streetRow', 'street-row')):
        c = BC[key]; im = render(c['layers'], c['W'], c['H'])
        if im.width > 816: im = im.crop((0, 0, 816, im.height))
        save_img(f'bldg-{nm}', panels([(f'{c["name"]} — 키트 {len(c["placements"])}개를 stamp_object 로 찍은 결과(원본 해상도, {c["W"]}×{c["H"]}칸)', im)]),
                 f'손 도트 건물 정답 조립 `{c["name"]}`: 배치 {len(c["placements"])}개, 다음 x = x + w − 1(단품 사이는 1칸 골목, 줄 키트 안은 벽을 맞댐). 원본 해상도. 전체 배열은 `jp-bldg-hand-ex`.', C_HB)
    g = EN['bldgOverlap1']; b = BC['blocked']
    k = 1
    gi = render(g['layers'], g['W'], g['H']); bi = render(b['layers'], b['W'], b['H'])
    mark_cells(bi, [(e['x'], e['y']) for e in BC['blockedErr']], k, width=2)
    save_img('err-bldg-access', panels([('정상 — 접근칸(보도) 비어 있음', gi), (f'오류 — 접근칸 위 자판기: door-access-blocked {len(BC["blockedErr"])}칸', bi)]),
             '손 도트 건물 변조 door-access-blocked: 왼쪽 정상(가게 3채 x + w − 1)/오른쪽 오류(두 번째 가게 출입구 아래에 `jp-prop-vend-pair`). 빨강 = 막힌 접근칸. 원본 해상도.', C_HB)
    o = BC['overlap2']; oi = render(o['layers'], o['W'], o['H'])
    mark_cells(oi, [(e['x'], e['y']) for e in BC['overlapErr']], 1, width=1)
    save_img('err-bldg-overlap', panels([('정상 — 다음 x = x + w − 1', gi), (f'오류 — 다음 x = x + w − 2: wall-overwritten {len(BC["overlapErr"])}칸', oi)]),
             '손 도트 건물 변조 wall-overwritten: 두 칸 겹쳐 세우면 오른쪽 키트의 처마 칸이 왼쪽 건물 벽 칸을 덮는다(빨강). 원본 해상도.', C_HB)


img_bldg()


# ====================================================================== 분류 5c — 손 도트 거리 시설(blocks/street_hand.py)
SH = EN['streetHand']
assert sorted(SH['kits']) == sorted(STREETH), (len(SH['kits']), len(STREETH))
SH_GROUPS = [
    ('pole', '전봇대·전선(4층)', r'^jp-(pole|wire)'),
    ('mark', '노면 표시(2층)', r'^jp-mark-'),
    ('wall', '블록 담·문기둥·대문·카포트', r'^jp-(bwall|gate|carport|tsukigime)'),
    ('life', '생활·길가 소품', r'^jp-(propane|ac-unit|pots|monohoshi|keijiban|gomi-box|jizo|mirror2|hydrant-sign|bus-stop)'),
    ('landmark', '거점 소품(도리이·주유소 캐노피·학교 정문)', r'^jp-(torii|gas-canopy|school-gate)'),
]


def sh_group(kid):
    for key, _, rx in SH_GROUPS:
        if re.search(rx, kid): return key
    raise AssertionError(kid)


SH_LAYER = {'pole': '4', 'mark': '2', 'wall': '3', 'life': '3', 'landmark': '3'}
C_SH = new_cat('street-hand', f'일본 도시 · 손 도트 거리 시설 {len(STREETH)}종',
               f'실제 일본 주택가·생활도로 조사(tiledata/jp-city/research)에서 나온 거리 시설 {len(STREETH)}종: 콘크리트·나무 전봇대와 전선(4층), 생활도로 가장자리 側溝·흰 선·グレーチング·「30」(2층 투명 덧그림), '
               '블록 담(투각·펜스)·문기둥·대문·카포트·月極 표지, 프로판 봄베·실외기·화분·빨래 장대·게시판·쓰레기 상자·지장·주황 커브미러·소화전 표지·버스 정류장, 도리이·주유소 캐노피·학교 정문. '
               '키트 id·크기·층·칸 번호 전체 배열·엔진 통행 코드, 전봇대·전선 이음 공식, 정답 조립(주택 앞 담·생활도로·전봇대 줄) 전체 1~4층 배열과 정상/오류(3층에 찍은 전선·어긋난 전선·대문 막음) 그림과 좌표.')


def sh_item(kid):
    it = shop_item(kid)
    it['layer'] = SH_LAYER[sh_group(kid)]
    it['rules'] = KITS[kid]['ai'].get('placementRules', '')
    return it


def doc_sh_rules():
    g = SH['good']; pr = SH['probes']; er = SH['errors']
    wires = sorted(int(k[8:]) for k in STREETH if re.match(r'^jp-wire-\d+$', k))
    cnt = collections.Counter(sh_group(k) for k in STREETH)
    return f'''# 일본 도시 — 손 도트 거리 시설 {len(STREETH)}종 · 쓰는 법 (층·전봇대·전선·노면·담)

{HEAD}

**무엇인가.** 「일본 동네」로 읽히는 신호(조사 `tiledata/jp-city/research/README.md` 2절: 전봇대+처진 전선, 보도 없는 생활도로의 흰 路側帯 선과 側溝, 주황 「30」·커브미러, 블록 담, 프로판 봄베·화분·실외기)를
손 도트 키트로 그린 것이다. 그림 원본 `scripts/content/jp-city/blocks/street_hand.py`. 분류: {', '.join(f'{n} {cnt[k]}' for k, n, _ in SH_GROUPS)}.

## 층 (이 용도에서 가장 중요)
{md_table(['분류', '찍는 층', '찍는 도구', '왜'], [
    ['전봇대 `jp-pole`·`jp-pole-guy`·`jp-pole-wood`, 전선 `jp-wire-*`', '**4층**', '`stamp_layer_block` layers {{"4": 키트 upperTiles}}', '전봇대는 길가에 서서 뒤(북쪽) 건물 앞을 가린다. 3층에 찍으면 그 칸의 건물·지붕 칸이 **지워진다**(오류 `upper-overwritten`)'],
    ['노면 표시 `jp-mark-*`', '**2층**', '`stamp_layer_block` layers {{"2": …}}', '투명 덧그림(통행 걸음, 캐릭터 아래). 1층 길 칸은 그대로 둔다'],
    ['담·문기둥·대문·카포트·생활·거점 소품', '3층', '`stamp_object`(`kit:jp_city/<id>`)', '밑동 막힘, 윗부분 ★. 카포트 밑에 차를 세우려면 카포트를 4층에 둔다(동네 예제)'],
])}
- 엔진 통행 실측(정답 조립 맵): 전봇대 밑동(4층 막힘 칸) {', '.join(f"({q['x']},{q['y']}) {'걸음' if q['passable'] else '막힘'}" for q in pr['poleFoot'])} ·
  노면 표시 칸 ({pr['mark']['x']},{pr['mark']['y']}) {'걸음' if pr['mark']['passable'] else '막힘'} · 블록 담 ({pr['wall']['x']},{pr['wall']['y']}) {'걸음' if pr['wall']['passable'] else '막힘'}.
- **4층 ★ 칸은 아래층 통행을 바꾸지 않는다** — 엔진은 위층부터 내려가며 빈칸과 ★ 를 건너뛰고 처음 만난 칸의 통행을 쓴다. 전봇대 윗부분(★)이 건물 막힘 칸 위에 겹친 칸도 그대로 막힘이다
  (실측: 6×12 판의 블록 담 (2,5) 위에 전봇대 키트를 4층 (1,2) 에 찍으면 그 칸 4층은 `{pr['starOverWall'][0]['l4Passage']}` 이고 엔진 통행은 {'걸음' if pr['starOverWall'][0]['passable'] else '막힘'} — 담 위 칸 (2,4) 는 {'걸음' if pr['starOverWall'][1]['passable'] else '막힘'}).

## 전봇대·전선 공식
1. 전봇대 키트는 폭 3 × 높이 10(나무 9). 기둥은 가운데 열(키트 x+1), 완목은 키트 폭 3칸 전체. 밑동(키트 x+1, 맨 아래 줄)만 막힘.
2. 생활도로 **남쪽 가장자리 줄**(또는 북쪽)에 밑동을 둔다. 간격(키트 x 차이) L 은 전선 키트가 있는 {wires[0]}~{wires[-1]}칸. 실제는 30~40m 이지만 게임에서는 10~15칸이 읽기 좋다.
3. 전선 `jp-wire-<L>` 은 폭 L−3 × 높이 3. **왼쪽 전봇대 키트 x + 3, 전봇대 키트 맨 위 줄 y** 에 4층으로 찍는다 — 완목 끝(양옆 칸 경계)에서 이어진다. 한 칸이라도 어긋나면 전선이 완목을 덮거나 끊긴다(오류 `pole-arm-overwritten`).
4. 남북으로 잇는 전선 `jp-wire-v6/8/10` 은 위쪽 전봇대와 같은 x, 같은 y 에 4층.
5. 전봇대는 간판·창·문 앞을 덜 가리는 자리에 둔다(건물 사이 틈·처마 칸). 동네 예제는 「기둥 열이 덮는 건물 칸 수 + 간격 벌점」을 최소로 하는 자리를 고른다(`town.mjs` `poleRow`).

## 생활도로 노면 (2층)
- 폭 4칸 생활도로의 북쪽 가장자리 줄에 `jp-mark-edge-n`, 남쪽 줄에 `jp-mark-edge-s`, 남북 길은 `-w`/`-e`. **7칸마다 `-grate`**(グレーチング 뚜껑). 側溝 없는 흰 선만은 `jp-mark-line-*`.
- 「30」 `jp-mark-30`(2×4)은 남북 길 가운데 두 열에 세로로 둔다 — 그 두 열은 가장자리 표시를 빼고 깐다. 교차로 칸에는 가장자리 표시를 깔지 않는다.
- 보도 없는 길이다: 연석·보도 포석을 길가에 깔지 않는다(서양식 실수, 조사 README 2절).

## 집 앞 (블록 담·문기둥)
- 집 키트 발 줄 바로 아래 한 줄에 담을 세운다: 양 끝 `jp-bwall-end-l`/`-end-r`, 가운데 `jp-bwall-plain`, 4칸마다 `jp-bwall-sukashi`(투각). 펜스 얹은 담은 `jp-bwallf-*`(1×2 — 집 발 줄과 겹치므로 집을 한 줄 위에 세운다).
- **문 앞 접근칸(집 `access`) 열은 비운다**(대문 자리). 그 왼쪽 칸에 `jp-gatepost`(표찰·인터폰·우편함). 대문 짝 `jp-gate`(2×1)은 닫힌 그림이라 접근칸에 두면 막힌다(오류 `door-access-blocked`).
- 프로판 봄베 `jp-propane` 은 집 옆벽 칸, 실외기 `jp-ac-unit`·화분 `jp-pots` 은 집 옆 빈칸. 접근칸에 두지 않는다.

## 실행 순서
1. 땅(1층): 보도·생활도로·자갈·잔디. 2. 건물(3층, 뒷줄 먼저). 3. 담·문기둥·생활 소품(3층, 접근칸 비움). 4. 노면 표시(2층). 5. 전봇대·전선(4층) 마지막.
6. 검사: 접근칸 도달(≥6칸), 3층 건물 칸이 지워지지 않았는지, 전선 x = 전봇대 x + 3.

## 정답 조립 `street-hand-scene` ({SH['W']}×{SH['H']}칸, 그림 `jp-img-street-hand-scene`, 전체 배열 `jp-street-hand-ex`)
집 `{SH['house']['id']}` ({SH['house']['x']},{SH['house']['y']}) · 담 줄 y={SH['wallY']}(대문 열 x={SH['doorCol']}) · 생활도로 y={SH['lane'][0]}~{SH['lane'][1]} · 전봇대 {', '.join(f'({x},{f})' for x, f in SH['poles'])}(밑동 기준).
문 앞 접근칸 ({g['access']['x']},{g['access']['y']}) 도달 {g['access']['reach']}.

## 정상/오류 — 자동 좌표 검증 (엔진 변조 실험)
{md_table(['코드', '변조', '검출 칸(맵 좌표 x,y)', '그림'], [
    ['`upper-overwritten`', '전봇대·전선을 3층(`stamp_layer_block` "3")에 찍음', f"{len(er['onL3']['errors'])}칸: " + ', '.join(f"({e['x']},{e['y']})" for e in er['onL3']['errors'][:8]) + (' …' if len(er['onL3']['errors']) > 8 else ''), '`jp-img-err-street-hand-layer`'],
    ['`pole-arm-overwritten`', '전선을 전봇대 x + **2** 에 찍음(한 칸 왼쪽)', f"{len(er['shift']['errors'])}칸: " + ', '.join(f"({e['x']},{e['y']})" for e in er['shift']['errors'][:8]), '`jp-img-err-street-hand-wire`'],
    ['`door-access-blocked`', '대문 열에도 담을 세움', ', '.join(f"({e['x']},{e['y']})" for e in er['gate']['errors']) + f" (도달 {er['gate']['access']['reach']})", '`jp-img-err-street-hand-gate`'],
])}
- 정상 대조: 같은 맵의 정답 조립 — 세 코드 모두 0건(접근칸 도달 {g['access']['reach']}).
- **검사 범위**: 칸 번호·층·통행·접근칸 도달(구조)만. 전선이 건물 간판을 가리는 정도(미감)·이벤트·밤 조명은 보지 않는다.
- **레이어 정정 조건**: 전봇대·전선이 3층에 있으면 4층으로 옮기고 3층은 원래 건물 칸으로 되돌린다(지워진 칸은 건물 키트를 다시 찍어 복구). 노면 표시가 1층에 있으면 길 칸이 사라지므로 1층을 길로 되돌리고 표시는 2층에.

## 없는 것
전선 대각 구간 없음(가로·세로 직선만) · 변압기 없는 전봇대 없음(모두 변압기 달림, 나무 전봇대만 없음) · 신호등 달린 전봇대 없음 · 밤 조명 없음 · 「止まれ」 글자는 도로 키트 `jp-road-mark-tomare-*`.
'''


add_doc(C_SH, 'street-hand-rules', f'일본 도시 · 손 도트 거리 시설 {len(STREETH)}종 · 층·전봇대·전선·노면·담', doc_sh_rules())


def _sh_dict_docs():
    order = sorted(STREETH, key=lambda k: ([g[0] for g in SH_GROUPS].index(sh_group(k)), STREETH.index(k)))
    docs = []; cur = []; size = 0
    for kid in order:
        it = sh_item(kid); n = len(jline(it))
        if cur and size + n > 36000: docs.append(cur); cur = []; size = 0
        cur.append(it); size += n
    if cur: docs.append(cur)
    return docs


_SD = _sh_dict_docs()
for _i, _chunk in enumerate(_SD):
    add_doc(C_SH, f'street-hand-dict-{_i + 1}', f'일본 도시 · 손 도트 거리 시설 사전 {_i + 1}/{len(_SD)}', f"""# 일본 도시 — 손 도트 거리 시설 사전 {_i + 1}/{len(_SD)} ({len(_chunk)}종, 칸 번호 전체)

{HEAD}

항목: `kit` · `name` · `w`×`h` · `anchor`(발) · `upperTiles`(키트 칸 전체, `-1` = 맵을 건드리지 않는 칸) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸) ·
`layer`(찍는 층: "4" 전봇대·전선 · "2" 노면 표시 · "3" 나머지) · `rules`(키트에 적힌 배치 규칙). 모든 키트는 고정. 규칙은 `jp-street-hand-rules`, 그림 `jp-img-street-hand-dict-*`.
이 문서의 키트: {', '.join(f'`{it["kit"]}`' for it in _chunk)}.

{jfences(_chunk, 13000)}
""")


def doc_sh_ex():
    g = SH['good']; W = SH['W']
    arr = {'name': 'street-hand-scene', 'W': W, 'H': SH['H'], 'placements': [[e['kit'], e['x'], e['y'], e['layer']] for e in g['log']],
           **{f'layer{k}': to_rows([tnum(t) for t in g['layers'][k]], W) for k in ('1', '2', '3', '4')}}
    bad = [e for e in g['log'] if not e['ok']]
    assert not bad, bad[:3]
    return f"""# 일본 도시 — 손 도트 거리 시설 정답 조립(주택 앞 담·생활도로·전봇대 줄, 전체 1~4층 배열)

{HEAD}

입력 = `placements`([키트, 왼쪽 위 x, 왼쪽 위 y, 층] — 층 "3" 은 `stamp_object`, "2"·"4" 는 `stamp_layer_block`), 1층 바닥 = 보도 + y {SH['lane'][0]}~{SH['lane'][1]} 생활도로.
출력 = 엔진이 찍은 뒤의 **전체 배열** `layer1`~`layer4`(행 우선, -1 빈 칸). 그림 `jp-img-street-hand-scene`(원본 해상도).

```json
{jline(arr)}
```
"""


add_doc(C_SH, 'street-hand-ex', '일본 도시 · 손 도트 거리 시설 정답 조립(전체 1~4층 배열)', doc_sh_ex())
assert SH['errors']['onL3']['errors'], '3층 전선 변조가 검출되지 않았다'
assert SH['errors']['shift']['errors'], '전선 어긋남 변조가 검출되지 않았다'
assert SH['errors']['gate']['errors'], '대문 막음 변조가 검출되지 않았다'
assert SH['good']['access']['reach'] >= 6


def img_sh():
    def kit_im(kid, k):
        w, h, lo, upv = kit_grid(kid)
        return up(render({'1': [t for r in lo for t in r], '3': [t for r in upv for t in r]}, w, h, bg=(0, 0, 0, 0)), k)
    order = sorted(STREETH, key=lambda k: ([g[0] for g in SH_GROUPS].index(sh_group(k)), STREETH.index(k)))
    for gk, gn, _ in SH_GROUPS:
        ids = [k for k in order if sh_group(k) == gk]
        items = [(k[3:], kit_im(k, 2 if max(KITS[k]['width'], KITS[k]['height']) <= 6 else 1)) for k in ids]
        for i, pg in enumerate(shelf_pack(items)):
            save_img(f'street-hand-dict-{gk}-{i + 1}', pg, f'손 도트 거리 시설 도감 — {gn} {len(ids)}종 {i + 1}쪽(작은 키트 ×2, 큰 키트 원본, 라벨 = 키트 id 에서 `jp-` 를 뺀 것, 체크 무늬 = -1 칸). 칸 번호는 `jp-street-hand-dict-*`.', C_SH)
    W, H = SH['W'], SH['H']
    gi = render(SH['good']['layers'], W, H)
    mark_cells(gi, [(SH['good']['access']['x'], SH['good']['access']['y'])], 1, color=(40, 220, 80, 255), width=1)
    save_img('street-hand-scene', panels([(f'정답 — 집·블록 담·문기둥(3층), 側溝·흰 선·「30」(2층), 전봇대·전선(4층). 초록 = 문 앞 접근칸 (도달 {SH["good"]["access"]["reach"]})', gi)]),
             f'손 도트 거리 시설 정답 조립 street-hand-scene({W}×{H}칸, 원본 해상도). 전체 배열 `jp-street-hand-ex`.', C_SH)
    er = SH['errors']
    for key, nm, title in (('onL3', 'layer', '전봇대·전선을 3층에: upper-overwritten'), ('shift', 'wire', '전선을 x+2 에: pole-arm-overwritten'), ('gate', 'gate', '대문 열을 담으로 막음: door-access-blocked')):
        bi = render(er[key]['layers'], W, H)
        mark_cells(bi, [(e['x'], e['y']) for e in er[key]['errors']][:120], 1, width=1)
        save_img(f'err-street-hand-{nm}', panels([('정상', render(SH['good']['layers'], W, H)), (f'오류 — {title} {len(er[key]["errors"])}칸', bi)]),
                 f'손 도트 거리 시설 변조 {title}: 위 정상/아래 오류, 빨강 = 검출 칸(좌표는 `jp-street-hand-rules` 표). 원본 해상도.', C_SH)


img_sh()


# ====================================================================== 분류 5d — 손 도트 小学校(blocks/school.py + 예제 맵 maps/school.mjs)
EB = EN['exampleBlocks']['school']
SCH = EXAMPLE_KITS['school']
assert sorted(EB['kits']) == sorted(SCH), (len(EB['kits']), len(SCH))
SCH_GROUPS = [
    ('ground', '바닥(1층)·트랙 선(2층)', r'^jp-school-(ground|gomu|track)'),
    ('build', '수영장·정문·창고·사육장·자전거 보관대', r'^jp-(pool|school-gate|souko|shiiku-goya|bike-shelter)'),
    ('play', '놀이·체육 기구', r'^jp-(tetsubo|noboribou|unte|jungle-gym|tires|goal-|ball-net|chorei-dai|ichirinsha)'),
    ('garden', '화단·밭·연못·그늘·덤불·관찰', r'^jp-(kadan|asagao|gakkyuen|biotope|fujidana|hyakuyoubako|tsutsuji)'),
    ('front', '교사 앞 기물', r'^jp-(flagpoles|ninomiya|teaarai)'),
]


def sch_group(kid):
    for key, _, rx in SCH_GROUPS:
        if re.search(rx, kid): return key
    raise AssertionError(kid)


C_SCH = new_cat('school', f'일본 도시 · 손 도트 小学校 {len(SCH)}종',
                f'일본 小学校 교정 키트 {len(SCH)}종(교정 흙·트랙 선·철봉·오르기 봉·운제·정글짐·타이어·골대·방구망·조례대·외발자전거 걸이·25m 수영장·정문·체육 창고·사육장·자전거 보관대·화단·나팔꽃·학급 밭·비오톱·등나무 그늘·百葉箱·게양대·二宮金次郎像·수돗가)과 '
                f'예제 맵 jp-city-school({EB["W"]}×{EB["H"]}칸, 교사·체육관·수영장·운동장·놀이 구역·정문). 키트 id·크기·층·칸 번호 전체 배열·엔진 통행 코드, 예제 맵 전체 1~4층 배열, 정상/오류(트랙 선 1층·정문 막음·수영장 입구 막음) 그림과 좌표.')


def doc_sch_rules():
    er = EB['errors']; g = EB['good']
    cnt = collections.Counter(sch_group(k) for k in SCH)
    rows = []
    for t in g['targets']: rows.append([t['what'], f"({t['x']},{t['y']})", '도달' if t['reached'] else '**못 감**'])
    return f'''# 일본 도시 — 손 도트 小学校 {len(SCH)}종 · 쓰는 법 (교정 배치·층·입구)

{HEAD}

**무엇인가.** 일본 小学校 교정의 신호(조사 `tiledata/jp-city/research/03-building-types-dimensions.md` 「소학교」·「校庭」: 가운데 맨흙 운동장, **둘레에** 놀이기구·나무·조례대, 부속 屋外プール·学級農園·観賞池·飼育小屋)를 손 도트 키트로 그린 것이다.
그림 원본 `scripts/content/jp-city/blocks/school.py`, 예제 맵 생성기 `scripts/content/jp-city/maps/school.mjs`(검사 + 적대적 검증 관문 `scripts/content/jp-city/gate/adversarial_gate.py`). 분류: {', '.join(f'{n} {cnt[k]}' for k, n, _ in SCH_GROUPS)}.
교사·체육관 건물은 손 도트 건물 키트 `jp-bldg-school`·`jp-bldg-school-gym`(용도 「손 도트 건물」).

## 층
{md_table(['분류', '찍는 층', '찍는 도구', '왜'], [
    ['교정 흙 `jp-school-ground-a/b/c`', '**1층**', '`paint_tiles`·`fill_region`(칸 번호) 또는 `stamp_object`', '세 변형을 섞어 깐다(같은 칸 반복은 무늬가 보인다)'],
    ['트랙 선 `jp-school-track-l`(30×15)', '**2층**', '`stamp_layer_block` layers {{"2": 키트 upperTiles}}', '투명 덧그림 — 1층에 찍으면 흙이 사라지고 검게 보인다(오류 `overlay-in-base-layer`)'],
    ['수영장 `jp-pool`·연못 `jp-biotope`', '1층 바닥 + 3층', '`stamp_object`', '물 칸은 1층 막힘(solidfloor) — 3층 비움. 철망·탈의실·부들은 3층'],
    ['나머지 기물', '3층', '`stamp_object`(`kit:jp_city/<id>`)', '밑동 막힘, 윗부분 ★(뒤로 지나감)'],
])}

## 배치 순서(예제 맵이 이 순서로 지었다)
1. 1층: 교정 흙(A·B·C 섞어) → 교사·체육관 앞 포장 띠 → 정문 진입로(폭 = 정문 개구부 4칸) → 앞 생활도로.
2. 뒷줄 건물: 교사 `jp-bldg-school`(昇降口) · 체육관 · 수영장 `jp-pool`(입구 anchor 2칸은 남쪽 철망 가운데).
3. 교사 앞 줄(포장 띠 바로 아래): 게양대·나팔꽃 화분·화단·조례대(운동장을 본다)·게시판·二宮金次郎像·수돗가. **문 앞 접근칸 열은 비운다**.
4. 운동장: 트랙 선 2층 → 트랙 안 양 끝 골대 한 쌍 → 둘레(트랙 밖)에 철봉·타이어·등나무 그늘·수돗가 → 길가 담 안쪽에 방구망(가로로 4칸씩 이어 붙임).
5. 놀이·관찰 구역(진입로 반대쪽): 줄 사이 1칸으로 창고·오르기 봉·운제·철봉·백엽상·그네 / 정글짐·모래밭·미끄럼틀·등나무 그늘·비오톱 / 학급 밭·사육장·화단. 나무는 담 따라.
6. 정문 `jp-school-gate-l`(개구부 x+2~x+5) → 둘레 철망 오토타일(정문 자리 비움) → 생활도로 노면 표시 2층 → 전봇대·전선 4층(정문 앞은 비운다).
7. 검사: 정문 앞에서 모든 문 접근칸·수영장 입구에 도달, 막힘 칸이 엔진에서 막힘, 트랙 선이 2층.

## 빈칸
校庭 맨흙은 아이들이 뛰는 자리라 **비어 있는 것이 기능이다**. 빈칸으로 세는 것은 바탕 흙(교정 흙 A·B·C)뿐이다(길·포장·고무 칩·물은 목적 있는 바닥). 트랙 사각은 분모에서 빼고, 나머지 17×13 창 빈칸 상한은 마을과 같은 0.4. 예제 맵 실측 {EB['emptiness']['worst17x13']} (창 왼쪽 위 {tuple(EB['emptiness']['worstAt'])}).
놀이기구는 운동장 가운데가 아니라 **가장자리**에 모은다.

## 예제 맵 도달 (엔진 `isPassable`, 시작 = 정문 앞 생활도로 ({EB['start']['x']},{EB['start']['y']}), 도달 칸 {g['reachable']})
{md_table(['목표', '칸', '결과'], rows)}

## 정상/오류 — 자동 좌표 검증 (엔진 변조 실험)
{md_table(['코드', '변조', '검출 칸(맵 좌표 x,y)', '그림'], [
    [f"`{er['trackL1']['code']}`", er['trackL1']['title'], f"{len(er['trackL1']['errors'])}칸(1층이 트랙 선 칸으로 바뀜): " + ', '.join(f"({e['x']},{e['y']})" for e in er['trackL1']['errors'][:6]) + ' …', '`jp-img-err-school-track`'],
    [f"`{er['gateNet']['code']}`", er['gateNet']['title'], ', '.join(f"({e['x']},{e['y']})" for e in er['gateNet']['errors']) + f" (도달 칸 {g['reachable']} → {er['gateNet']['reachable']})", '`jp-img-err-school-gate`'],
    [f"`{er['poolKadan']['code']}`", er['poolKadan']['title'], ', '.join(f"({e['x']},{e['y']})" for e in er['poolKadan']['errors']), '`jp-img-err-school-pool`'],
])}
- 정상 대조: 예제 맵 그대로 — 세 코드 모두 0건(모든 목표 도달).
- **검사 범위**: 칸 번호·층·통행·도달(구조)만. 그림의 미감·아이들(사람)·밤 조명은 보지 않는다. 미감은 적대적 검증 관문(`tiledata/jp-city/gates/school.json`)이 따로 본다.
- **레이어 정정 조건**: 트랙 선이 1층에 있으면 1층을 교정 흙으로 다시 깔고 트랙 선은 2층에. 정문·입구 앞 기물은 접근 열 밖으로 옮긴다.

## 없는 것
교사·체육관 실내 없음(문 칸에 전이 이벤트) · 아이들·선생님 없음 · 밤 조명 없음 · 수영장 물은 막힘(헤엄 없음) · 학교 이름 글자 없음(명판은 무늬만).
'''


add_doc(C_SCH, 'school-rules', f'일본 도시 · 손 도트 小学校 {len(SCH)}종 · 교정 배치·층·입구', doc_sch_rules())


def sch_item(kid):
    it = shop_item(kid)
    it['layer'] = '2' if kid == 'jp-school-track-l' else '1' if kid.startswith('jp-school-ground') else '3'
    it['rules'] = KITS[kid]['ai'].get('placementRules', '')
    return it


_SCH_ORDER = sorted(SCH, key=lambda k: ([g[0] for g in SCH_GROUPS].index(sch_group(k)), SCH.index(k)))
_chunks = []; _cur = []; _size = 0
for _kid in _SCH_ORDER:
    _it = sch_item(_kid); _n = len(jline(_it))
    if _cur and _size + _n > 36000: _chunks.append(_cur); _cur = []; _size = 0
    _cur.append(_it); _size += _n
if _cur: _chunks.append(_cur)
for _i, _chunk in enumerate(_chunks):
    add_doc(C_SCH, f'school-dict-{_i + 1}', f'일본 도시 · 손 도트 小学校 사전 {_i + 1}/{len(_chunks)}', f"""# 일본 도시 — 손 도트 小学校 사전 {_i + 1}/{len(_chunks)} ({len(_chunk)}종, 칸 번호 전체)

{HEAD}

항목: `kit` · `name` · `w`×`h` · `anchor`(발) · `parts`(입구 anchor) · `tiles`(1층 바닥 칸, 있으면) · `upperTiles`(키트 칸 전체, `-1` = 맵을 건드리지 않는 칸) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸) ·
`layer`(찍는 층) · `rules`(키트에 적힌 배치 규칙). 규칙은 `jp-school-rules`, 그림 `jp-img-school-dict-*`.
이 문서의 키트: {', '.join(f'`{it["kit"]}`' for it in _chunk)}.

{jfences(_chunk, 13000)}
""")


def doc_sch_ex():
    g = EB['good']; W = EB['W']
    arr = {'name': 'jp-city-school', 'W': W, 'H': EB['H'], 'start': [EB['start']['x'], EB['start']['y']],
           'placements': [[q['id'], q['x'], q['y'], q['layer']] for q in EB['placed']],
           **{f'layer{k}': to_rows([tnum(t) for t in g['layers'][k]], W) for k in ('1', '2', '3', '4')}}
    return f"""# 일본 도시 — 小学校 예제 맵 jp-city-school 전체 1~4층 배열 ({W}×{EB['H']}칸)

{HEAD}

생성기 `scripts/content/jp-city/maps/school.mjs` 의 결과를 엔진에 다시 올려 잰 것이다. `placements` = [키트, 왼쪽 위 x, 왼쪽 위 y, 층], `layer1`~`layer4` = 행 우선 전체 배열(-1 빈 칸).
그림 `jp-img-school-scene-w`·`jp-img-school-scene-e`(원본 해상도, 서쪽·동쪽 반). 장소 카드 `jp-city-school-68x48` 로도 가져올 수 있다(`import_region_reference`).

```json
{jline(arr)}
```
"""


add_doc(C_SCH, 'school-ex', '일본 도시 · 小学校 예제 맵 전체 1~4층 배열', doc_sch_ex())
assert all(t['reached'] for t in EB['good']['targets']), EB['good']['targets']
for _k in ('trackL1', 'gateNet', 'poolKadan'): assert EB['errors'][_k]['errors'], f'{_k} 변조가 검출되지 않았다'


def img_sch():
    def kit_im(kid, k):
        w, h, lo, upv = kit_grid(kid)
        return up(render({'1': [t for r in lo for t in r], '3': [t for r in upv for t in r]}, w, h, bg=(0, 0, 0, 0)), k)
    for gk, gn, _ in SCH_GROUPS:
        ids = [k for k in _SCH_ORDER if sch_group(k) == gk]
        items = [(k[3:], kit_im(k, 2 if max(KITS[k]['width'], KITS[k]['height']) <= 6 else 1)) for k in ids]
        for i, pg in enumerate(shelf_pack(items)):
            save_img(f'school-dict-{gk}-{i + 1}', pg, f'손 도트 小学校 도감 — {gn} {len(ids)}종 {i + 1}쪽(작은 키트 ×2, 큰 키트 원본, 라벨 = 키트 id 에서 `jp-` 를 뺀 것). 칸 번호는 `jp-school-dict-*`.', C_SCH)
    W, H = EB['W'], EB['H']
    full = render(EB['good']['layers'], W, H)
    half = W // 2
    for nm, x0, x1 in (('w', 0, half), ('e', half, W)):
        save_img(f'school-scene-{nm}', full.crop((x0 * T, 0, x1 * T, H * T)),
                 f'小学校 예제 맵 jp-city-school {"서쪽" if nm == "w" else "동쪽"} 반(x {x0}~{x1 - 1}, 원본 해상도). 전체 배열 `jp-school-ex`.', C_SCH)
    er = EB['errors']
    for key, nm in (('trackL1', 'track'), ('gateNet', 'gate'), ('poolKadan', 'pool')):
        cells = [(e['x'], e['y']) for e in er[key]['errors']]
        xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
        cx0 = max(0, min(xs) - 6); cy0 = max(0, min(ys) - 6); cx1 = min(W, max(xs) + 7); cy1 = min(H, max(ys) + 7)
        if (cx1 - cx0) * T > 396: cx1 = cx0 + 396 // T
        if (cy1 - cy0) * T > 760: cy1 = cy0 + 760 // T
        bi = render(er[key]['layers'], W, H)
        mark_cells(bi, cells[:200], 1, width=1)
        crop = lambda im: im.crop((cx0 * T, cy0 * T, cx1 * T, cy1 * T))
        save_img(f'err-school-{nm}', panels([(f'정상 (x {cx0}~{cx1 - 1}, y {cy0}~{cy1 - 1})', crop(full)), (f'오류 — {er[key]["title"]} · {len(cells)}칸', crop(bi))]),
                 f'小学校 변조 `{er[key]["code"]}`: 왼쪽 정상/오른쪽 오류, 빨강 = 검출 칸(좌표는 `jp-school-rules` 표). 원본 해상도 잘라낸 것.', C_SCH)


img_sch()


# ====================================================================== 분류 5e — 탈것·노면전차·지하철(blocks/transit_*.py + maps/station.mjs + 런타임 map.transit)
TRS = EXAMPLE_KITS['transit_street']; TST = EXAMPLE_KITS['transit_station']
EBT = EN['exampleBlocks']['transit_station']
assert sorted(EBT['kits']) == sorted(TST), (len(EBT['kits']), len(TST))
VEH = json.load(open(os.path.join(ROOT, 'src', 'assets', 'jpCityVehicles.json'), encoding='utf-8'))['vehicles']
_PLAT = json.load(open(os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'maps', 'out', 'station-platform.map.json'), encoding='utf-8'))
_PLAT_REP = json.load(open(os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'maps', 'out', 'station-platform.report.json'), encoding='utf-8'))
_TRAM = json.load(open(os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'maps', 'out', 'tramstreet.map.json')))
_TRAM_REP = json.load(open(os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'maps', 'out', 'tramstreet.report.json')))
_CONC = json.load(open(os.path.join(ROOT, 'scripts', 'content', 'jp-city', 'maps', 'out', 'station-concourse.map.json'), encoding='utf-8'))
assert _PLAT_REP['ok'] and _PLAT_REP['anchors']['allReached'], _PLAT_REP['anchors']
TRN_GROUPS = [
    ('street', '노면전차 거리·지하철 출입구', lambda k: k in TRS),
    ('station', '지하철역 콘코스·승강장', lambda k: k in TST),
]
C_TRN = new_cat('transit', f'일본 도시 · 탈것·노면전차·지하철 (키트 {len(TRS) + len(TST)}종 · 탈것 {len(VEH)}종)',
                f'맵 위를 실제로 달리는 탈것 {len(VEH)}종(승용차·택시·경차·트럭·시내버스·노면전차·전철·지하철)을 까는 법(`set_map_transit`·`inspect_map_transit`, 좌측통행 차선 칸 규칙, 정류장·타기), '
                f'노면전차 거리 키트 {len(TRS)}종(레일·정류장 섬·導流帯·가선·전주·지하철 출입구)과 지하철역 키트 {len(TST)}종(콘코스·승강장), 예제 맵 さくら町駅 콘코스·승강장 전체 배열, 정상/오류(표 없이 지나감·계단 막음) 그림과 좌표.')


def doc_trn_rules():
    er = EBT['errors']; g = EBT['good']
    vrows = [[f"`{v['id']}`", v['name'], v['kind'], f"{v['length']}칸", ', '.join(k for k in v['frames'])] for v in VEH]
    trows = [[t['what'], f"({t['x']},{t['y']})", '도달' if t['reached'] else '**못 감**'] for t in g['targets']]
    return f'''# 일본 도시 — 탈것·노면전차·지하철 쓰는 법 (노선·차선 칸·정류장·역 맵)

{HEAD}

**무엇인가.** 맵의 `transit` 설정(노선 목록)이 게임에서 실제로 탈것을 움직인다. 탈것은 주인공 앞에서 서고(주인공을 밀거나 덮지 않는다), 정류장에서 문을 열고(`*_open` 그림),
`board` 가 있는 정류장에서는 탈것 옆에서 「조사」하면 그 맵·칸으로 옮겨 간다. 상태는 저장하지 않는다(맵에 들어올 때마다 90초 미리 돌린 상태로 시작).
정본: 저장 모양·시뮬레이션 `src/project/mapTransit.ts`, 길 띠 찾기 `src/project/transitAuto.ts`, 도구 `src/editor/tools/transitTools.ts`, 런타임 `src/player/playSceneTransit.ts`, 그림 목록 `src/assets/jpCityVehicles.json`(그림은 칩셋이 아니라 따로 된 탈것 시트 `/assets/jp-city/vehicles/<id>.png`).
편집기: 맵 설정 → 「탈것(차·버스·전차)」 칸(자동 깔기·노선 켜고 끄기·지우기·차 간격).

## 가장 쉬운 길 — 도구
1. `inspect_map_transit` — 1층 생활도로(`jp-lane-road` 오토타일) 그림에서 **곧은 차도 띠**(동서: 위 끝 행·폭 / 남북: 왼쪽 끝 열·폭)와 2층 노면전차 레일 줄을 찾아 보여 준다. 맵 끝에서 끝까지 이어진 띠만 자동 대상이다.
2. `set_map_transit {{ auto: {{}} }}` — 찾은 띠마다 좌측통행 두 방향 차 흐름(폭 4칸 이상; 2~3칸은 한 방향)을 깐다. 간격 `headwaySec`(큰길 4~6초, 한산한 주택가 10~14초).
3. 버스: `auto.busStops: [{{x, y, name, waitSec, board}}]` — (x, y) 는 **버스 머리가 서는 차선 칸**. 그 칸을 지나는 방향 차선에 시내버스 노선이 붙는다. 정류장 칸이 차선 위가 아니면 도구가 차선 행·열을 알려 주며 거절한다.
4. 노면전차: `auto.tram: true` — 2층 레일(`jp-tram-rail-h` 2줄 / `jp-tram-rail-v` 2열)이 맵 끝에서 끝까지 이어진 줄. **복선**(6칸 안에 나란한 두 레일 — 가운데 섬·전주 띠 3행까지)이면 좌측통행 두 방향, 단선이면 한 방향만(마주 오는 전차가 한 레일에서 비켜 갈 수 없다). 정류장 `auto.tramStops`.
5. 굽은 길·순환 버스·전철·지하철: `routes:[{{id, kind, path:[{{x,y}}…], vehicles, loop?, count?, headwaySec?, speed?, stops:[{{x,y,name,board}}]}}]` — 칸 경로를 직접 준다.
6. 깐 뒤 `inspect_map_transit` 로 120초 시험 결과(노선별 대수·오래 막힌 차)를 본다.

## 칸 규칙(이것을 어기면 도구가 거절한다)
{md_table(['규칙', '내용'], [
    ['경로 칸', '탈것 **머리**가 지나는 칸, 그리고 몸 폭 2칸 중 **위/왼쪽** 칸. 가로로 달리면 몸은 (머리 행, 머리 행+1), 세로면 (머리 열, 머리 열+1). 몸 길이 = 아래 표의 길이(머리에서 뒤로)'],
    ['좌측통행(폭 4칸 길 y0..y0+3 / x0..x0+3)', '동쪽행 = 위 두 줄(머리 행 y0) · 서쪽행 = 아래 두 줄(y0+2) · 남쪽행 = 오른쪽 두 열(x0+2) · 북쪽행 = 왼쪽 두 열(x0)'],
    ['맵 밖', '맵 끝에서 끝으로 지나는 노선은 양 끝을 맵 밖으로 늘인다(자동은 12칸, 허용 = 가장 긴 탈것 + 8칸). 탈것이 맵 밖에서 나타나 맵 밖으로 사라진다'],
    ['차도 밖 금지', '차·버스 노선은 맵 안 몸 칸이 모두 1층 생활도로여야 한다 — 아니면 `off-road` 로 거절(보도·건물 위를 달리는 차)'],
    ['노선 종류 ↔ 탈것', 'road = 승용·택시·경차·트럭 · bus = 버스 · tram = 노면전차 · train = 전철 · subway = 지하철'],
    ['정류장', '머리가 그 칸에 오면 `waitSec` 동안 서서 문을 연다. 뒤차는 1칸 띄우고 줄 선다(앞지르기 없음)'],
    ['교차로', '가로·세로 탈것이 서로의 몸을 막으면 6초 뒤 지나간다(교착 풀기). 같은 방향 줄·주인공 앞은 끝까지 선다'],
])}

## 탈것 {len(VEH)}종 (그림 `jp-img-transit-vehicles`)
{md_table(['id', '이름', '종류', '길이', '프레임'], vrows)}
버스·노면전차·전철·지하철의 문은 **차의 왼쪽 면**에만 있다(좌측통행 승강) — 화면에 보이는 남쪽 면은 서쪽으로 갈 때의 왼쪽 면이다. 동쪽으로 가는 차의 `right_open` 은 `right` 와 같은 그림(문이 반대쪽)이다.

## 노면전차 거리 (키트 {len(TRS)}종, 그림 = 실제 예제 맵 `jp-img-transit-tramstreet`, 실제 게임 화면 `jp-img-transit-runtime-tram`)
- 단면(북→남, 예제 맵 행): 보도 3(9~11) · 동쪽행 차로 3(12~14) · 동쪽행 궤도 2(15~16) · **가운데 띠 3(17~19)**: 동쪽행 섬 `jp-tram-stop`(x 6~17, 17~18행) + 그 밖 軌道敷 · 센터 전주 밑동 행(19) · 서쪽행 궤도 2(20~21) · 서쪽행 섬 `jp-tram-stop`/軌道敷 2(22~23) · 서쪽행 차로 3(24~26) · 보도 3(27~29: 연석 쪽 27행에 가드레일·가로수·가로등, 28~29행은 걷는 줄로 비운다). 가운데 띠가 3행인 까닭: 서쪽행 가선(서쪽행 궤도 윗행 −2)이 동쪽행 섬 위 승객 몸(섬 윗줄·그 위 줄)이 아니라 섬 난간 줄(18행)을 지나가게 하려고. (3/4 투영이라 가선은 궤도보다 2행 북쪽에 그려지고, 섬 아랫줄 난간·표지 허리를 지나가 보이는 것은 의도다.) 동쪽행은 3/4 에서 문이 보이는 남쪽 면을 쓰려고 **진행 방향 오른쪽 문**으로 승강한다(실제 좌측통행 안전지대는 보통 왼쪽 — 화면 타협, 전차는 양쪽 문). **섬은 둘 다 각 궤도의 남쪽**: 전차 그림 `jp-tram` 은 양 끝 운전대·문이 보이는 남쪽 면에 있고(`right_open`·`left_open` 모두 남쪽 면 문이 열림), 3/4 에서 정차한 전차 그림이 궤도 바로 북쪽 칸을 가려 북쪽 섬 위 주인공이 사라진다. 두 섬은 횡단보도 양쪽에 엇갈려 붙고, 섬 상류 끝에 導流帯(`jp-tram-stop-zebra-e` 동쪽행 섬 서쪽 끝 / `jp-tram-stop-zebra` 서쪽행 섬 동쪽 끝). 궤도·가운데 띠·섬 밖 칸 1층은 軌道敷 `jp-tram-trackbed`(-b) — 생활도로 오토타일과 섞지 않는다(차도 띠가 갈라져야 차 흐름이 일방 둘로 잡힌다). 차로 3칸 = 차 몸 2칸 + 여유(일방 1차로).
- 레일 `jp-tram-rail-h`/`-v` 는 **2층**(투명 덧그림 — 아스팔트 위). 1층에 찍으면 아스팔트가 사라진다.
- 가선 `jp-tram-wire-h`(2칸 반복)는 **4층**, 동행·서행 궤도 각각 윗행 **−2행**(전차 `jp-tram` 팬터그래프 끝이 닿는 높이). 센터 전주 `jp-tram-pole-c`(1×8)는 가운데 띠 아랫행에 밑동(밑동 = 동행 궤도 윗행 +4, 키트 윗행 = 동행 궤도 윗행 −3), 16~24칸 간격. 섬 위 승객 몸 칸(섬 윗줄과 그 위 줄)에는 4층(가선)이 지나가지 않는다. 보도에는 전주를 세우지 않는다(출입문·간판 앞을 막는다).
- 횡단보도는 **보도 → 차로 → 軌道敷·두 궤도·전주 행 → 차로 → 보도** 끝까지 4칸 폭(오토타일 `jp-crosswalk-ns`, 궤도 칸은 레일+줄무늬 합성 `jp-tram-rail-h-xwalk`). 보행 신호기 `jp-tram-ped-signal` 은 양 끝 보도에 대각 한 쌍(빨강 켜짐 그림). 각 차로 횡단보도 상류 바로 앞 열에 정지선 `jp-mark-stopline-v`, 차로|軌道敷 경계에 `jp-tram-lane-line-s`(동쪽행 차로 맨 아랫행)·`jp-tram-lane-line-n`(서쪽행 차로 맨 윗행).
- 센터 전주·보행 신호기 칸에는 태그 `foot-dy:N` 이 있다 — 런타임이 기둥 전체를 밑동 줄 기준으로 탈것·캐릭터와 y 정렬한다(북쪽 전차는 기둥 뒤, 남쪽 전차는 기둥 앞). 키트를 쪼개 찍지 말고 통째로.
- `jp-tram-curb-stop`(보도 승강 띠)은 궤도가 보도에 붙은 サイドリザベーション 길 전용.
- 차막이 `jp-tram-rail-end` 는 **단선 종점 전용** — 복선 장면에는 쓰지 않는다(좌측통행 서쪽행 궤도는 동쪽에서 들어온다).
- 차 흐름: 궤도(2층 레일) 칸은 차도에서 빠지므로 `set_map_transit` auto 가 북쪽 차로 = 동쪽행, 남쪽 차로 = 서쪽행 일방 두 개로 깐다. 차·버스는 레일 위를 달리지 못한다(`off-road`).
- 지하철 출입구 `jp-subway-entrance` 는 보도 안쪽(연석에서 2칸 이상)에 두고, 입구(anchor) 칸에 지하철역 콘코스로 가는 이동 이벤트를 둔다.
- 노면전차 노선: `auto.tram` 또는 routes kind `tram` — 정류장은 섬 옆 레일 칸, `at:"center"` 로 섬 가운데 칸을 준다.
- 버스 정류장: `auto.busStops:[{{x: 정문 가운데 x, y: 그 앞 차선 행, at:"center"}}]` — 버스 문이 정문 앞에 온다.

## 지하철역 (키트 {len(TST)}종, 예제 맵 さくら町駅)
- 콘코스(맨 위부터): 천장 보 `jp-subway-ceiling` 1줄 → 흰 타일 벽 2줄(매표기·출구 계단·역무실이 벽에 붙는다) → 바닥 → 개찰구 `jp-subway-gates`(9칸, 통로 = 홀수 열) — **양옆은 칸막이 `jp-subway-fence` 로 벽·기둥까지 막는다** → 승강장 계단 `jp-subway-stairs-down`(입구 = 남쪽 끝 줄 가운데 두 칸, 맨 윗줄은 머리벽이라 막힘 — 입구 앞 칸에서만 들어간다). 「↓のりば」 `jp-subway-sign-line-down` 은 계단 바로 북쪽 통로 위에 매단다. **둘레 벽**: 서·동 끝 열 `jp-subway-wall-w`/`-e`(북 벽 아래 행부터), 남쪽 맨 아랫행 `jp-subway-wall-s`, 아래 두 모서리 `-sw`/`-se` — 지하 대합실이 맵 끝에서 잘려 보이지 않게(개찰 옆 칸막이는 옆 벽까지).
- 승강장(맨 위부터): 천장 보 → 뒷벽 3줄(광고·역명판) → 선로 `jp-subway-track` 2줄(1층, 막힘) → 승강장 끝 `jp-subway-edge` 1줄(점자 블록, 걸음) → 바닥(기둥·의자·LED·매단 역명판·올라가는 계단).
- 점자 유도 블록은 2층 오토타일 `jp-tactile` 선: 출구 계단 앞 → 매표기·역무실 / 개찰 통로 한 열로 곧장 → 승강장 계단 입구 앞 행, 승강장은 끝 줄에서 계단 쪽 갈래. **계단 입구 바로 앞 칸(입구 폭 전체)은 칸 가득 점형 경고 블록 `jp-subway-tactile-warn`(2층)으로 바꿔 찍는다** — 오토타일 끝·꺾임 점은 칸 가운데 작은 점이라 입구 폭을 못 덮는다. 매단 간판(出口·のりば) 밑으로 점자를 지나게 두지 않는다(위에서 보면 선이 끊겨 보인다).
- 지하철 노선: `set_map_transit` 의 `auto.subway:{{board:{{mapId,x,y}}, stopName, centerX}}` 하나로 깐다 — 1층 선로를 찾아 30칸 열차가 맵 밖에서 들어와 몸 가운데가 `centerX`(기본 맵 가운데, 보통 승강장 계단 앞)에 서서 문을 연다. 직접 줄 때는 routes kind `subway`, 머리 행 = 선로 윗줄, 정류장은 `at:"center"` + 몸 가운데 칸. 결과 요약의 「서면 몸 x a~b」 로 확인한다.
- 이동: 계단 입구(anchor) 칸에 `transfer` 이벤트(playerTouch). 예제는 콘코스 승강장 계단 ↔ 승강장 올라가는 계단, 출구 계단 → 지상.

## 예제 맵 도달 (콘코스, 엔진 `isPassable`, 시작 ({EBT['start']['x']},{EBT['start']['y']}), 도달 칸 {g['reachable']})
{md_table(['목표', '칸', '결과'], trows)}
개찰 통로를 막고도 승강장 계단에 가는 칸(표 없이 지나감): **{len(g.get('bypass') or [])}칸**(정상 = 0).

## 정상/오류 — 자동 좌표 검증 (엔진 변조 실험, 콘코스)
{md_table(['코드', '변조', '검출 칸(맵 좌표 x,y)', '그림'], [
    [f"`{er['fenceGap']['code']}`", er['fenceGap']['title'], ', '.join(f"({e['x']},{e['y']})" for e in er['fenceGap']['errors']) + ' (개찰 통로를 막고도 도달한 승강장 계단 입구)', '`jp-img-err-transit-fence`'],
    [f"`{er['stairsBench']['code']}`", er['stairsBench']['title'], ', '.join(f"({e['x']},{e['y']})" for e in er['stairsBench']['errors']), '`jp-img-err-transit-stairs`'],
])}
도구 쪽 거절 코드: `no-road`(가장자리→가장자리 차도 없음) · `off-road`(몸이 차도 밖) · `invalid-route`(대각선 경로·두 칸보다 짧음·맵 밖 너무 멀리·노선 종류에 안 맞는 탈것) · `no-rail`(노면전차 레일 없음) · `invalid-args`(정류장이 차선·레일·경로 위가 아님).
- **검사 범위**: 칸 번호·층·통행·도달·노선 칸(구조)만. 그림의 미감은 적대적 검증 관문(`tiledata/jp-city/gates/transit.json`·`vehicles.json`)이 본다. 런타임 움직임은 `scripts/qa/runtime/transit.probe.mjs`(출하 플레이어)가 본다 — 그림 `jp-img-transit-runtime`.
- **레이어 정정 조건**: 레일이 1층이면 1층을 아스팔트로 다시 깔고 레일은 2층. 가선이 3층이면 4층으로(3층에 두면 아래 칸이 막히고 차보다 아래에 그려진다).

## 없는 것
탈것에 사람(운전사·승객) 없음 · 신호등 연동 없음(교차로는 서로 기다림) · 차선 바꾸기·앞지르기 없음 · 탈것 위치는 저장 안 됨 · 노면전차 가선은 그림뿐(전기 없음).
'''


add_doc(C_TRN, 'transit-rules', '일본 도시 · 탈것·노면전차·지하철 · 노선·차선·정류장·역', doc_trn_rules())


def trn_item(kid):
    it = shop_item(kid)
    it['block'] = 'transit_street' if kid in TRS else 'transit_station'
    it['rules'] = KITS[kid]['ai'].get('placementRules', '')
    return it


_TRN_ORDER = list(TRS) + list(TST)
_chunks = []; _cur = []; _size = 0
for _kid in _TRN_ORDER:
    _it = trn_item(_kid); _n = len(jline(_it))
    if _cur and _size + _n > 36000: _chunks.append(_cur); _cur = []; _size = 0
    _cur.append(_it); _size += _n
if _cur: _chunks.append(_cur)
for _i, _chunk in enumerate(_chunks):
    add_doc(C_TRN, f'transit-dict-{_i + 1}', f'일본 도시 · 노면전차·지하철 키트 사전 {_i + 1}/{len(_chunks)}', f"""# 일본 도시 — 노면전차 거리·지하철역 키트 사전 {_i + 1}/{len(_chunks)} ({len(_chunk)}종, 칸 번호 전체)

{HEAD}

항목: `kit` · `name` · `w`×`h` · `anchor`(발) · `parts`(입구 anchor·간판·창) · `tiles`(1층 바닥 칸, 있으면) · `upperTiles`(키트 칸 전체, `-1` = 맵을 건드리지 않는 칸) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸) ·
`block`(그림 원본 blocks/<block>.py) · `rules`(키트에 적힌 배치 규칙). 쓰는 법은 `jp-transit-rules`, 그림 `jp-img-transit-dict-*`.
이 문서의 키트: {', '.join(f'`{it["kit"]}`' for it in _chunk)}.

{jfences(_chunk, 13000)}
""")


def doc_trn_ex():
    g = EBT['good']; W = EBT['W']
    conc = {'name': CONC_ID, 'W': W, 'H': EBT['H'], 'start': [EBT['start']['x'], EBT['start']['y']],
            'placements': [[q['id'], q['x'], q['y'], q['layer']] for q in EBT['placed']],
            'events': [[e['id'], e['x'], e['y'], e['pages'][0]['commands'][0]] for e in _CONC['events']],
            **{f'layer{k}': to_rows([tnum(t) for t in g['layers'][k]], W) for k in ('1', '2', '3', '4')}}
    PW = _PLAT['width']
    plat = {'name': _PLAT['id'], 'W': PW, 'H': _PLAT['height'], 'start': _PLAT_REP['start'],
            'placements': [[q['id'], q['x'], q['y'], q['layer']] for q in _PLAT_REP['placedList']],
            'events': [[e['id'], e['x'], e['y'], e['pages'][0]['commands'][0]] for e in _PLAT['events']],
            'transit': _PLAT['transit'],
            **{f'layer{k}': to_rows([tnum(t) for t in _PLAT[f]], PW) for k, f in (('1', 'lowerTiles'), ('2', 'lowerOverlayTiles'), ('3', 'upperTiles'), ('4', 'upperOverlayTiles'))}}
    TW = _TRAM['width']
    def _tram_wires():
        """가선 줄 = 맵 4층 jp-tram-wire-h 배치에서 직접 읽는다(행 번호를 손으로 적지 않는다 — 관문 tramstreet 6회차)."""
        ws = [q for q in _TRAM_REP['placedList'] if q['id'] == 'jp-tram-wire-h']
        rows = sorted({q['y'] for q in ws}); xs = sorted({q['x'] for q in ws})
        rails = sorted({r['path'][0]['y'] for r in _TRAM['transit']['routes'] if r['kind'] == 'tram'})   # 전차 노선 머리 행 = 레일 윗행
        assert len(rows) == 2 and len(rails) == 2 and all(r == t - 2 for r, t in zip(rows, rails)), (rows, rails)
        return f"4층 jp-tram-wire-h: x {xs[0]},{xs[1]},{xs[2]},… 마다(2칸 반복) 행 {rows[0]}·{rows[1]} = 각 궤도 레일 윗행 {rails[0]}·{rails[1]} −2"
    tram = {'name': _TRAM['id'], 'W': TW, 'H': _TRAM['height'], 'start': _TRAM_REP['start'],
            'placements': [[q['id'], q['x'], q['y'], q['layer']] for q in _TRAM_REP['placedList'] if q['id'] != 'jp-tram-wire-h'],
            'wires': _tram_wires(),
            'events': [[e['id'], e['x'], e['y'], e['pages'][0]['commands'][0]] for e in _TRAM['events']],
            'transit': _TRAM['transit'],
            **{f'layer{k}': to_rows([tnum(t) for t in _TRAM[f]], TW) for k, f in (('1', 'lowerTiles'), ('2', 'lowerOverlayTiles'), ('3', 'upperTiles'), ('4', 'upperOverlayTiles'))}}
    return f"""# 일본 도시 — 지하철역 さくら町 예제 맵 전체 배열 (콘코스 {W}×{EBT['H']} · 승강장 {PW}×{_PLAT['height']})

{HEAD}

생성기 `scripts/content/jp-city/maps/station.mjs`. 콘코스는 엔진에 다시 올려 잰 배열, 승강장은 생성기 출력(검사 통과: 입구 {_PLAT_REP['anchors']['n']}칸 도달, 막힘 칸 엔진 일치).
`placements` = [키트, 왼쪽 위 x, 왼쪽 위 y, 층], `events` = [id, x, y, 이동 명령], `transit` = 승강장 지하철 노선(그대로 `set_map_transit routes` 에 줄 수 있는 모양), `layer1`~`layer4` = 행 우선 전체 배열(-1 빈 칸).
그림 `jp-img-transit-concourse`·`jp-img-transit-platform`, 실제 게임 화면 `jp-img-transit-runtime`.

## 콘코스
```json
{jline(conc)}
```

## 승강장
```json
{jline(plat)}
```

## 노면전차 거리 {_TRAM['width']}×{_TRAM['height']} (`scripts/content/jp-city/maps/tramstreet.mjs`, 그림 `jp-img-transit-tramstreet`, 실제 화면 `jp-img-transit-runtime-tram`)
지하철 출입구 계단 두 칸 → 위 콘코스 출구 계단 앞. `transit` = 조수 도구 `set_map_transit auto {{traffic:true, tram:true, tramStops:[…at:"center"…]}}` 가 깐 결과(차 흐름 일방 둘 + 복선 노면전차).
```json
{jline(tram)}
```
"""


CONC_ID = 'jp-city-station-concourse'
add_doc(C_TRN, 'transit-ex', '일본 도시 · 지하철역 さくら町 예제 맵 전체 배열', doc_trn_ex())
assert all(t['reached'] for t in EBT['good']['targets']), EBT['good']['targets']
assert not EBT['good'].get('bypass'), EBT['good']['bypass']
for _k in ('fenceGap', 'stairsBench'): assert EBT['errors'][_k]['errors'], f'{_k} 변조가 검출되지 않았다'


def img_trn():
    def kit_im(kid, k):
        w, h, lo, upv = kit_grid(kid)
        return up(render({'1': [t for r in lo for t in r], '3': [t for r in upv for t in r]}, w, h, bg=(0, 0, 0, 0)), k)
    for gk, gn, f in TRN_GROUPS:
        ids = [k for k in _TRN_ORDER if f(k)]
        items = [(k[3:], kit_im(k, 2 if max(KITS[k]['width'], KITS[k]['height']) <= 8 else 1)) for k in ids]
        for i, pg in enumerate(shelf_pack(items)):
            save_img(f'transit-dict-{gk}-{i + 1}', pg, f'{gn} 키트 도감 {len(ids)}종 {i + 1}쪽(작은 키트 ×2, 큰 키트 원본, 라벨 = 키트 id 에서 `jp-` 를 뺀 것). 칸 번호는 `jp-transit-dict-*`.', C_TRN)
    # 탈것 목록 — 오른쪽 보는 그림(문 연 그림이 있으면 옆에)
    vitems = []
    for v in VEH:
        sheet = Image.open(os.path.join(ROOT, 'public', v['image'].lstrip('/'))).convert('RGBA')
        for fk in ('right', 'right_open', 'down'):
            fr = v['frames'].get(fk)
            if not fr: continue
            g = sheet.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
            if g.width > 420: g = g.resize((g.width // 2, g.height // 2), Image.NEAREST)
            vitems.append((f"{v['id'][3:]} {fk}", g))
    for i, pg in enumerate(shelf_pack(vitems)):
        save_img(f'transit-vehicles{"" if i == 0 else "-" + str(i + 1)}', pg, f'탈것 {len(VEH)}종(오른쪽·문 연·아래 보는 그림, 원본 16px 칸 기준 — 긴 열차는 ½). 칸이 아니라 따로 된 시트다 — 맵에 찍지 말고 `set_map_transit` 노선으로 달리게 한다.', C_TRN)
    # 노면전차 거리 그림은 키트 합성 장면이 아니라 실제 예제 맵(tramstreet.mjs)을 굽는다 — 장면과 맵이 어긋나 조수에게 틀린 배치를 가르치던 문제(관문 4회차).
    W, H = EBT['W'], EBT['H']
    full = render(EBT['good']['layers'], W, H)
    save_img('transit-concourse', full, f'さくら町駅 콘코스 {W}×{H}칸(원본 해상도): 매표기·출구 계단·역무실·개찰구+칸막이·승강장 계단·점자 유도 블록. 배열 `jp-transit-ex`.', C_TRN)
    pl = render({'1': _PLAT['lowerTiles'], '2': _PLAT['lowerOverlayTiles'], '3': _PLAT['upperTiles'], '4': _PLAT['upperOverlayTiles']}, _PLAT['width'], _PLAT['height'])
    save_img('transit-platform', pl, f'さくら町駅 승강장 {_PLAT["width"]}×{_PLAT["height"]}칸(원본 해상도): 뒷벽·선로 2줄·승강장 끝·기둥·LED·매단 역명판·올라가는 계단. 지하철은 런타임이 그린다(`jp-img-transit-runtime`).', C_TRN)
    rt = Image.open(os.path.join(ROOT, 'verify-shots', 'jp-city', 'transit-runtime', 'subway-stop.png')).convert('RGBA')
    rt2 = Image.open(os.path.join(ROOT, 'verify-shots', 'jp-city', 'transit-runtime', 't0.png')).convert('RGBA')
    tm = render({'1': _TRAM['lowerTiles'], '2': _TRAM['lowerOverlayTiles'], '3': _TRAM['upperTiles'], '4': _TRAM['upperOverlayTiles']}, _TRAM['width'], _TRAM['height'])
    save_img('transit-tramstreet', tm, f'노면전차 거리 {_TRAM["width"]}×{_TRAM["height"]}칸(원본 해상도): 건물·보도·동쪽행 차로·복선 레일+센터 전주+가선·서쪽행 안전지대 섬·서쪽행 차로·보도, 4칸 횡단보도+보행 신호기, 지하철 출입구. 배열 `jp-transit-ex` 맨 아래.', C_TRN)
    rt3 = Image.open(os.path.join(ROOT, 'verify-shots', 'jp-city', 'tram-runtime', 'tram-stop.png')).convert('RGBA')
    save_img('transit-runtime-tram', panels([('안전지대 섬 옆에 선 서쪽행 노면전차(문 연 그림) — 섬 위에서 위를 보고 「조사」로 탄다', rt3.resize((rt3.width * 3 // 4, rt3.height * 3 // 4), Image.NEAREST))]),
             '출하 플레이어 실제 화면(scripts/content/jp-city/qa/tram-street.probe.mjs): 노면전차 거리. 위는 동쪽행 전차, 아래 차로는 서쪽행 택시, 전차 집전기가 가선에 닿는다.', C_TRN)
    save_img('transit-runtime', panels([('승강장에 선 지하철(문 연 그림) — 승강장 끝에서 위를 보고 「조사」로 탄다', rt.resize((rt.width * 3 // 4, rt.height * 3 // 4), Image.NEAREST))]),
             '출하 플레이어 실제 화면(scripts/qa/runtime/transit.probe.mjs): 승강장에 선 지하철. 노선은 승강장 맵 `transit`.', C_TRN)
    save_img('transit-runtime-road', panels([('学校前 길 — 차 흐름(좌측통행 두 방향)·정류장에 선 시내버스', rt2.resize((rt2.width * 3 // 4, rt2.height * 3 // 4), Image.NEAREST))]),
             '출하 플레이어 실제 화면: 小学校 앞 생활도로에 `set_map_transit auto` 로 깐 차 흐름과 学校前 버스 정류장. 동쪽행은 위 두 줄, 서쪽행은 아래 두 줄.', C_TRN)
    er = EBT['errors']
    for key, nm in (('fenceGap', 'fence'), ('stairsBench', 'stairs')):
        cells = [(e['x'], e['y']) for e in er[key]['errors']]
        bi = render(er[key]['layers'], W, H)
        mark_cells(bi, cells, 1, width=1)
        if key == 'fenceGap': mark_cells(bi, [(x, 9) for x in range(0, 8)], 1, color=(255, 200, 0, 255), width=1)
        cw = min(W, 24) * T
        save_img(f'err-transit-{nm}', panels([(f'정상 (x 0~{cw // T - 1})', full.crop((0, 0, cw, H * T))), (f'오류 — {er[key]["title"]} · {len(cells)}칸', bi.crop((0, 0, cw, H * T)))]),
                 f'지하철역 변조 `{er[key]["code"]}`: 왼쪽 정상/오른쪽 오류, 빨강 = 검출 칸(좌표는 `jp-transit-rules` 표){", 노랑 = 뺀 칸막이" if key == "fenceGap" else ""}. 원본 해상도.', C_TRN)


img_trn()


# ====================================================================== 분류 6 — 정상/오류·자동 검사(총괄)
# ====================================================================== 분류 — 일본 집 실내 (build_hand_interior_room tileset jp_city)
JPI = json.load(open(os.path.join(ROOT, 'src', 'assets', 'jpInteriorSpec.json'), encoding='utf-8'))
EIN = EN['interior']
_IN_BLOCK = {k: (KIT_INDEX.get(k, {}).get('source') or {}).get('block', '') for k in INTERIOR_KITS}
assert sorted(INTERIOR_KITS) == sorted(f'jp-in-{o}' for o in JPI['objects']), (len(INTERIOR_KITS), len(JPI['objects']))
_IN_EX = ('house-1f', 'house-2f', 'apartment-1k')
_IN_EX_KO = {'house-1f': '2층 단독주택 1층', 'house-2f': '2층 단독주택 2층', 'apartment-1k': '원룸 아파트(1K)'}
C_INT = new_cat('interior', f'일본 도시 · 일본 집 실내 (가구 {len(JPI["objects"])}종 · 바닥 {len(JPI["floors"])} · 벽면 {len(JPI["walls"])})',
                f'일본 현대 집 실내(현관 타타키·화실 다다미·LDK·욕실·탈의실·화장실·침실·아이방·원룸 1K)를 `build_hand_interior_room({{tileset:"jp_city"}})` 한 번으로 짓는 법: '
                f'평면 문자열 규칙·가구 종류(바닥·벽 앞·걸이·밟는 무늬)·탁자·탁상 물건·계단 이동, 가구 {len(JPI["objects"])}종 사전(칸 번호·통행 전체), 예제 3맵(2층 단독주택 1층·2층, 원룸) 도구 인자 + 4층 정답 배열 + 원본 그림, 정상/오류 변조 좌표.')


def _in_obj_img(oid, k=2):
    o = JPI['objects'][oid]
    dys = [c[1] for c in o['cells']] or [0]; dxs = [c[0] for c in o['cells']] or [0]
    y0 = min(dys); w = max(max(dxs) + 1, o['w'], 1); h = max(max(dys) - y0 + 1, 1)
    im = checker(w * T, h * T)
    for dx, dy, t, _l in sorted(o['cells'], key=lambda c: c[3]):
        im.alpha_composite(cell(tnum(t)), (dx * T, (dy - y0) * T))
    return up(im, k)


def _in_pack(items, side=800, gap=6, bg=(46, 46, 54, 255)):
    """[(라벨, 그림)] → 줄바꿈 배치 그림 목록(각각 긴 변 ≤ 820)."""
    probe = ImageDraw.Draw(Image.new('RGBA', (4, 4)))
    pages, rows, cur, cw, ch = [], [], [], gap, 0
    for lab, im in items:
        bw = max(im.width, int(probe.textlength(lab, font=FONT_KS)) + 2)
        if cur and cw + bw + gap > side: rows.append((cur, ch)); cur, cw, ch = [], gap, 0
        cur.append((lab, im, bw)); cw += bw + gap; ch = max(ch, im.height + 12)
    if cur: rows.append((cur, ch))
    page, ph = [], gap
    for r in rows:
        if page and ph + r[1] + gap > side: pages.append(page); page, ph = [], gap
        page.append(r); ph += r[1] + gap
    if page: pages.append(page)
    out = []
    for pg in pages:
        H = gap + sum(h + gap for _, h in pg)
        canvas = Image.new('RGBA', (side, H), bg); d = ImageDraw.Draw(canvas); y = gap
        for row, h in pg:
            x = gap
            for lab, im, bw in row:
                d.text((x, y), lab, fill=(255, 255, 255, 255), font=FONT_KS); canvas.alpha_composite(im, (x, y + 11)); x += bw + gap
            y += h + gap
        out.append(canvas)
    return out


def _in_item(oid):
    o = JPI['objects'][oid]; kid = f'jp-in-{oid}'
    it = {'id': oid, 'ko': o['ko'], 'category': o['category'], 'categoryKo': o['category_ko'], 'block': _IN_BLOCK[kid], 'kind': o['kind'], 'w': o['w'], 'h': o['h'], 'up': o.get('up', 0)}
    for key in ('use', 'facing', 'surface', 'stairs', 'tags', 'place', 'pair', 'desc'):
        if o.get(key) not in (None, [], '', False): it[key] = o[key]
    it['cells'] = [[dx, dy, tnum(t), l] for dx, dy, t, l in o['cells']]
    it.update(shop_item(kid))
    return it


_IN_CATS = []
for _o in JPI['objects'].values():
    if not any(c == _o['category'] for c, _, _ in _IN_CATS): _IN_CATS.append((_o['category'], _o['category_ko'], 0))
_IN_CATS = [(c, ko, sum(1 for o in JPI['objects'].values() if o['category'] == c)) for c, ko, _ in _IN_CATS]


def doc_in_rules():
    er = EIN['errors']
    ex1 = EIN['examples']['house-1f']
    err_rows = []
    for key, e in er.items():
        hard = [i for i in e['issues'] if i['severity'] == 'error']
        soft = [i for i in e['issues'] if i['severity'] == 'warning']
        pick = hard or soft
        where = ', '.join(sorted({f"({i['x']},{i['y']})" for i in pick if i['x'] is not None}))
        if key == 'doorBlocked' and e['unreachedFloor']: where = f"막은 칸 (13,10) → 닿지 못한 바닥 {len(e['unreachedFloor'])}칸: " + ' '.join(f"({c['x']},{c['y']})" for c in e['unreachedFloor'][:8])
        codes = ', '.join(sorted({f"`{i['code']}`" for i in pick})) or (f"`{e['toolCode']}`" if e['toolCode'] else '-')
        res = ('도구 거부 · 맵 불변' if e['mapUnchanged'] and e['toolCode'] else ('짓되 경고' if soft and not hard else ('도구 거부' if e['toolCode'] else '?')))
        err_rows.append([e['title'], codes, where or '-', res, e['fix'], f'`jp-img-in-err-{key.lower()}`'])
    kinds = md_table(['kind', '놓는 곳(조립기 검사)', '통행', '그리는 순서'], [
        ['`floor`', '발자국 칸 전부가 바닥(벽면 아님)', '발자국 막힘(walk 칸만 밟음) · 위로 솟은 칸 ★', '(y+h)·16 — 남쪽 것이 앞'],
        ['`wall`', '발자국 바로 북쪽 칸이 벽면 아랫줄(= 북쪽 벽 바로 아래 첫 바닥 줄)', '발자국 막힘 · 벽면을 덮는 윗부분 ★', '(y+h)·16'],
        ['`hang`', '벽면 **윗줄**(막힌 칸 바로 아래 줄) y 에 건다 — 그림이 벽면 두 줄을 덮는다', '★(벽면이라 원래 못 걷는다)', 'y·16 — 벽 가구보다 먼저(뒤)'],
        ['`flat`', '바닥 위 무늬(방석·깔개·매트·현관 단·슬리퍼·현관문 문턱)', '걸음(2층)', '맨 먼저(가구 밑)'],
        ['`door`', '**가로 칸막이(`#` 줄)의 1칸 틈 칸** (x,y) — 틈 좌우가 `#`, 틈 위가 북쪽 방, 틈 아래 두 줄(벽면 높이)이 바닥', '통로를 막지 않는다 — 틈 칸 인방·아랫방 쪽 윗줄 ★, 그 아랫줄 2층(밟음)', '(y+3)·16 — 아랫방 벽면 가구보다 앞'],
        ['`sidedoor`', '**세로 칸막이(`#` 열) 3줄 틈의 통로 칸**(셋째 줄) (x,y) — 좌우가 실내, 바로 위 두 칸이 칸막이 끝 벽면', '통로를 막지 않는다 — 위 두 칸(끝 벽면 위) ★, 통로 칸 2층(밟음)', '(y+1)·16'],
    ])
    return f'''# 일본 도시 — 일본 집 실내 짓는 법 (build_hand_interior_room · tileset "jp_city")

{HEAD}

**무엇인가.** 일본 거리(`jp_city`)와 같은 칩셋·같은 손 도트 화풍의 **일본 현대 집 실내** 재료다. 구조(바닥 {len(JPI["floors"])}·벽면 {len(JPI["walls"])}·천장 띠)와 가구 {len(JPI["objects"])}종·탁자 {len(JPI["tables"])}종·탁상 물건 {len(JPI["goods"])}종.
판타지 손 도트 실내(`atlas_biome_interior`)와 **같은 조립기**(`src/editor/handInterior/builder.ts`)가 사양만 바꿔(`src/assets/jpInteriorSpec.json`) 짓는다 — 규칙은 같고, id·칸 번호는 다르다(섞지 않는다).
정본: 그림 `scripts/content/jp-city/blocks/interior_*.py`(+ 틀 `interior/ikit.py`) → `bake_jp.py` → 사양 `bake_interior_spec.py`. 예제 `tiledata/jp-city/interior/examples/*.json`, 짓는 스크립트 `scripts/content/jp-city/maps/interior.mjs`.

## 읽는 순서 · 실행 순서
1. 이 문서(규칙) → 가까운 예제 하나(`jp-interior-ex-house-1f` 단독주택 1층 · `jp-interior-ex-house-2f` 2층 · `jp-interior-ex-apartment-1k` 원룸)와 그 그림 `jp-img-interior-*`.
2. `list_hand_interior_parts({{tileset:"jp_city", room:"화실"}})` — 방 종류(현관·복도·화실·LDK·부엌·욕실·탈의실·화장실·침실·아이방·원룸·유닛 배스) 또는 건물(`jp_house`·`jp_apartment`)의 예제 가구. 낱말은 `query`. 행마다 desc·놓는 곳·짝 소품·use·facing 이 있다. 칸 번호까지 보려면 사전 `jp-interior-dict-*`. 분류로 좁히려면 `category`: {' · '.join(f"`{c}` {ko} {n}" for c, ko, n in _IN_CATS)}.
3. 평면(plan)을 정한다 → `build_hand_interior_room({{tileset:"jp_city", mapId, name, plan, floor, wall, zones, objects, tables, goods, start, links}})` **한 번**. 오류가 있으면 맵을 만들지 않고 코드·좌표로 거부한다 — 고쳐서 다시 부른다. 경고(닿지 못한 바닥·쓸 수 없는 가구)도 0 이 될 때까지 고친다.
4. 층이 여럿이면 층마다 한 맵(계단 x 를 위아래 층에서 맞춘다), 계단 칸에 `links`. **짓는 순서**: 아직 없는 맵을 가리키는 links 는 거부된다(`link-target-missing`) — ① 1층을 links 없이 짓고 ② 2층을 1층으로 가는 links 와 함께 짓고 ③ 1층을 같은 mapId·`replace:true` 로 2층 links 를 넣어 다시 짓는다. 도착 칸(toX,toY)은 그 맵의 걸을 수 있는 바닥(계단 발칸·계단통 아랫줄 바로 옆)이어야 한다. 거리 맵의 집 문에 들어가는 실내면 현관 아래 틈 칸에 거리로 나가는 `links` 를 단다.
5. `show_map_region`·`check_reachability` 로 확인. 낱칸 번호로 칠하지 않는다(`paint_tiles` 로 가구 칸을 찍으면 통행·그림 순서가 어긋난다).

## 평면(plan) — 구조는 전부 자동
- 한 줄 = 문자열, 모든 줄 같은 길이. `#` = 막힌 칸(외벽·칸막이·건물 밖), 그 밖(`.`) = 실내.
- **막힌 칸 바로 아래 두 줄 = 벽면**(못 걷는다, 위 줄 = 윗줄 · 아래 줄 = 아랫줄), 나머지 실내 = 바닥. 막힌 칸 중 실내에 8방으로 닿는 칸 = 천장 띠(어두운 띠 + 실내 쪽 밝은 테두리), 닿지 않는 칸 = 공허(검정).
- 서쪽이 막힌 바닥·벽면에는 그림자 변형, 벽면 바로 아래 바닥 줄에는 접촉 그림자가 자동으로 깔린다.
- **가로 칸막이**(`#` 한 줄)의 틈 1칸 = 문 통로(틈 아래 칸은 벽면이 아니라 바닥이 된다). 예: 1층 6행 `{ex1['args']['plan'][6]}` 의 틈 x {', '.join(str(i) for i, ch in enumerate(ex1['args']['plan'][6]) if ch != '#')} = 화실 후스마·화장실 문·부엌↔LDK 트인 곳, 2층 6행 `{EIN['examples']['house-2f']['args']['plan'][6]}` = 침실·화장실·아이방 문(복도에서 한 칸씩). **정면 문(`door` 종류)은 이 틈에 단다** — 문이 정면으로 보여야 하는 방(화실·화장실·침실)은 복도의 **북쪽**에 두면 복도 쪽 벽면에 열린 문틀이 보인다.
- **세로 칸막이**(`#` 한 열)의 틈은 **3줄**이어야 지나간다 — 틈의 위 두 줄은 북쪽이 막혀 벽면이 되고 셋째 줄이 통로다. 1~2줄 틈은 벽면으로 막힌다. 예: 1층 x 3·6 열의 y 9~11 틈 → 통로 y 11(욕실·탈의실 입구), x 12 열의 y 8~10 틈 → 통로 y 10(LDK 입구). 세로 칸막이 틈의 통로 칸에는 **옆문(`sidedoor` 종류)** 을 단다 — 정면 문(`door`)을 달면 `door-not-in-gap`, 옆문을 틈 밖에 두면 `sidedoor-not-in-gap`. 틈 앞 칸(통로 줄 양옆)에는 가구를 두지 않는다.
- 출입구 = 맨 아래 줄의 `.` 틈(또는 `start`) — 그 틈 칸에 현관문 문턱 `genkan-door`(flat). 현관은 맨 아래, 그 위 마루 끝 줄에 `agarikamachi`(현관 단) 를 한 줄로 깐다.
- 바닥·벽면은 `floor`·`wall` 기본값 + `zones`(x0,y0,x1,y1 사각형마다 floor·wall). 일본 집 짝: 현관 `tataki` · 복도·LDK·양실 `flooring`(+`cloth`) · 화실 `tatami` + `juraku` · 부엌 `cushion` + `kitchen-panel` · 욕실 `bathtile` + `bathwall` · 탈의실·화장실 `cushion` + `cloth` · 침실 `flooring`/`carpet` + `cloth-beige`. 벽면 zone 은 벽면 칸(막힌 칸 아래 두 줄)을 덮어야 바뀐다.

## 가구 종류(kind)
{kinds}
- 좌표 x,y = **발자국 왼쪽 위 칸**(그림이 위로 솟은 부분 `up` px 는 그 위 칸에 그려진다). 한 칸에 위층 조각은 둘까지(3·4층) — 셋이면 앞(남쪽) 둘만 남는다.
- 계단: 올라가는 계단 `stairs-up-wood`(1칸)·`stairs-up-wood-wide`(2칸)는 **wall 종류** — 북쪽 벽 앞 첫 바닥 줄에 세우면 벽면 두 줄을 덮고 벽 속으로 오른다. 발칸은 걸을 수 있다 → 그 칸에 위층으로 가는 `links`. 내려가는 계단통 `stairwell-down-wood`(2×2): 윗줄 난간은 막히고 아랫줄 두 칸은 밟는다 → 그 두 칸에 아래층 `links`.
- **방문(`door` 종류)**: 열린 양식 문 `door-open-western` · 열린 화장실 문 `door-open-toilet` · 열린 후스마 `fusuma-open`. 좌표 = 평면의 가로 칸막이 1칸 틈 칸. 틈 칸에는 천장 띠가 이어진 인방이, 그 아래 벽면 높이 두 줄에는 문틀·옆으로 젖혀진(밀린) 문짝이 그려지고 가운데는 비어 통로다. 예제: 1층 화실 `fusuma-open`(7,6)·화장실 `door-open-toilet`(10,6), 2층 침실 `door-open-western`(7,6)·화장실 `door-open-toilet`(11,6)·아이방 `door-open-western`(16,6), 원룸 부엌↔방 `door-open-western`(6,6).
- **옆문(`sidedoor` 종류)**: 열린 나무 옆문 `door-side-western` · 열린 미닫이 옆문 `door-side-sliding`(욕실·탈의실). 좌표 = 세로 칸막이 3줄 틈의 통로 칸. 예제: 1층 욕실 (3,11)·탈의실 (6,11) `door-side-sliding`, LDK (12,10) `door-side-western`, 원룸 유닛 배스 (4,10) `door-side-sliding`.
- **닫힌 문·창(걸이)** `door-western`·`oshiire`·`closet-doors`·창 4종은 **벽면 윗줄에 거는 닫힌 그림** — 들어가지 않는 문(벽장 `oshiire`·`closet-doors`, 광·납戸 문)을 벽면에 보여 줄 때, 또는 이벤트(조사·이동)를 붙일 자리. 예제: 1층 화실 `oshiire`(5,1), 2층 복도 `door-western`(13,7) = 들어가지 않는 장식 문(광·納戸 자리, 통로 아님 — 조사 이벤트를 달 수 있는 칸), 아이방 `closet-doors`(18,1).
- 탁자 자동 타일 `tables:[{{style, x, y, w, h}}]` — `dining`(식탁, 아무 크기) · `kcounter`(대면 부엌 카운터, 한 줄). 윗면이 있어 탁상 물건을 올린다.
- 탁상 물건 `goods:[{{id, x, y}}]` — 윗면 있는 가구(`surface`)나 탁자 칸 위에만, 그 칸 4층이 비어 있어야 한다(위로 솟은 이웃 가구가 4층을 쓰면 거부). 물건: {', '.join(f'`{g}`' for g in JPI['goods'])}.
- 의자·소파·좌의자는 바라보는 쪽별 id(`-s` 남향 · `-n` 북향 · `-e` · `-w`) — 탁자·TV 를 보게 놓는다(탁자 북쪽 의자 = `-s`).

## 일본 집 방 구성 (예제가 따르는 규칙)
- 현관: 맨 아래 출입구 틈 → 타타키(2~3줄, `tataki`) → 마루 끝 줄 `agarikamachi` → 복도. 신발장 `getabako`(옆벽 곁, floor 종류라 북쪽 벽이 없어도 선다)·우산꽂이 `umbrella-stand`·벗은 신발 `shoes-pair` 은 **타타키**에, 현관 매트 `genkan-mat`·슬리퍼 `slippers`(발끝이 집 안쪽)는 **아가리카마치 바로 위 마루 줄**에 둔다(신발을 벗고 올라선 자리 — 예제 1층 매트 (8,10)·슬리퍼 (10,10)).
- 복도는 동서로, **화실·화장실은 복도 북쪽**(가로 칸막이 틈 + 정면 문), 복도 북쪽 벽에 계단(위층 도착 칸과 맞춘다). 욕실·탈의실은 복도 옆 세로 칸막이 3줄 틈 + 미닫이 옆문, 욕실은 탈의실을 지나서. 방마다 문이 있다(예외: 현관↔복도는 단 `agarikamachi`, 부엌↔LDK 는 대면 카운터 앞 트인 곳).
- 화실: 북쪽 벽에 도코노마(`tokonoma` 2칸)·불단(`butsudan`)·벽장(`oshiire` 걸이 — 그 앞 바닥은 비워 둔다)·쇼지 창, 가운데 좌탁(`zataku`·`chabudai`) + 방석 4장(`zabuton`, 밟는 무늬), 다기·센베 접시는 좌탁 위. 문 틈 바로 위 칸(방 쪽)은 비운다. 지가이다나·장롱(`chigaidana`·`tansu`)은 벽이 남을 때.
- LDK: 부엌은 북쪽 벽에 냉장고·조리대·싱크·가스대(후드)·조리대·식기장(`cupboard`)을 한 줄로(전자레인지는 조리대 위 탁상 물건 `microwave`), 그 앞 한 줄 띄워 대면 카운터(`kcounter` 2칸) — 카운터 **양 끝 둘 다** 통로로 남긴다. 부엌 앞 통로 줄을 1×2 가구(레인지 선반 등)로 막지 않는다. 식탁은 부엌 앞, 의자는 탁자를 본다. 거실은 TV 받침(벽 가구, 2칸) — 좌탁(2칸) — 소파(TV 를 보는 `sofa-n`, 2칸)를 **같은 x 에** 남쪽으로 늘어놓고, **좌탁과 소파 사이 한 줄 띄움**(붙이면 소파 등받이가 좌탁 칸 4층을 차지해 탁상 물건이 안 올라간다). 3칸 깔개 `rug` 는 2칸 가구와 가운데가 안 맞으니 아이방·원룸 바닥에 따로 깐다. TV 받침은 벽 가구라 그 x 두 칸 바로 북쪽이 벽면이어야 한다 — 부엌과 트인 곳(가로 칸막이 틈) 아래에는 놓을 수 없다.
- 2층: 남쪽 복도(2줄, 방문들이 닿는 만큼만 — 쓰지 않는 서쪽은 `#`, 끝에 계단통·실내 빨래 건조대·장식 광 문) + 북쪽 방들(가로 칸막이 틈 1칸 = 방문) — 부부 침실(더블 침대·협탁·화장대·옷장)·화장실·아이방(침대 하나 — 이층침대 또는 싱글, 공부 책상 + `desk-chair-n`, 벽장 `closet-doors`). 원룸(1K): 현관 → 부엌(싱크 — 조리대 — 가스대 순, 냉장고는 끝, 세탁기는 현관 곁) → **문**(부엌과 방 사이 문이 있어야 1K, 없으면 1R) → 방(침대·TV·좌탁), 유닛 배스(욕조+변기 한 방, 미닫이 옆문).
- LDK 입구(세로 칸막이 통로 칸) 바로 안쪽 칸은 비운다 — TV·좌탁·식탁이 그 칸을 둘러싸면 LDK 전체가 막힌다(식탁은 좌탁과 한 열 띄운다).
- 방은 쓸 만큼만 — 빈 바닥이 넓게 남으면 방을 줄인다(가구로 메우지 않는다). 1층 남서쪽처럼 쓸 일 없는 귀퉁이는 `#` 로 막는다.

## 통행·층 (엔진 판정 — 예제 1층의 막힘 지도)
가구 발자국 = 막힘(3층, `solid`), 위로 솟은 칸·걸이 = ★(3층, 지나감 — 캐릭터 위에 그려짐), 밟는 무늬 = 2층(걸음), 바닥 = 1층 걸음, 벽면·천장·공허 = 1층 막힘(`solidfloor`). 탁상 물건 = 4층.
`X` 막힘 · `.` 걸음 (house-1f, {ex1['W']}×{ex1['H']}):
```
{chr(10).join(ex1['codes'])}
```

## 정상/오류 — 자동 좌표 검증 (정상 = 예제 1층 그대로, 오류 = 한 가지만 바꿈. 엔진 조립기 실측)
{md_table(['변조', '코드', '검출 칸(맵 좌표 x,y)', '도구 결과', '고치는 법', '그림'], err_rows)}
- 오류(`error`)면 도구는 **맵을 만들거나 바꾸지 않는다**(부분 배치 없음). 경고(`warning`: 닿지 못한 바닥·쓸 수 없는 가구·조각 셋 겹침)는 짓되 요약에 남는다 — 0 이 될 때까지 고친다.
- **레이어 정정 조건**: 가구 조각은 3층(앞뒤 둘이면 4층까지), 밟는 무늬는 2층, 탁상 물건은 4층. 4층이 이미 찼다는 `goods-no-layer` 는 물건이 아니라 이웃 가구 자리를 옮겨 고친다(위 표). `paint_tiles` 로 가구 칸을 1층에 칠하면 바닥이 사라지고 통행이 바뀐다 — 지우고 도구로 다시 짓는다.
- **검사 범위**: 칸 번호·층·발자국 겹침·놓는 곳(벽·벽면·윗면·문 틈)·출입구에서의 도달(BFS, 엔진 `passabilityOf`)만. 이벤트 실행(계단 이동이 실제로 일어나는지)과 「집처럼 보이는가」(미감)는 도구가 보지 않는다 — 미감은 적대적 검증 관문(`adversarial_gate.py --stage interior`, 판정과 그림·문서 해시가 `tiledata/jp-city/gates/interior.json` 에 남는다. 통과 여부는 그 파일의 verdict 를 본다), 계단 이동은 런타임 QA(`scripts/content/jp-city/qa/interior.probe.mjs` — 출하 플레이어에서 방향 입력으로 방마다·계단 왕복)가 본다.

## 없는 것
세로 벽(동·서 벽면)에 거는 창·액자 없음(걸이는 북쪽 벽면만). 예제는 **실내만** — 현관 틈(`genkan-door`) 칸의 거리로 나가는 `links` 는 비어 있다. 거리 맵의 집 문에 붙일 때 그 칸에 단다(`build_hand_interior_room` 을 같은 mapId·`replace:true` 로 다시 부르거나 `create_transfer_pair`). 베란다·발코니 없음. 사람(가족 NPC)은 Actor1 캐릭터를 이벤트로 놓는다. 가게·학교·사무실 실내는 아직 없다(이 용도는 집).
'''


add_doc(C_INT, 'interior-rules', '일본 도시 · 일본 집 실내 · 짓는 법·평면 규칙·가구 종류·정상/오류', doc_in_rules())

# 사전 — 블록 순서, 문서 하나 ≤ 36000자
_IN_ORDER = [o for b in ('interior_entry', 'interior_washitsu', 'interior_ldk', 'interior_wet', 'interior_bed', 'interior_doors') for o in JPI['objects'] if _IN_BLOCK[f'jp-in-{o}'] == b]
assert len(_IN_ORDER) == len(JPI['objects']), (len(_IN_ORDER), len(JPI['objects']))
_chunks = []; _cur = []; _size = 0
for _oid in _IN_ORDER:
    _it = _in_item(_oid); _n = len(jline(_it))
    if _cur and _size + _n > 36000: _chunks.append(_cur); _cur = []; _size = 0
    _cur.append(_it); _size += _n
if _cur: _chunks.append(_cur)
for _i, _chunk in enumerate(_chunks):
    add_doc(C_INT, f'interior-dict-{_i + 1}', f'일본 도시 · 일본 집 실내 가구 사전 {_i + 1}/{len(_chunks)}', f"""# 일본 도시 — 일본 집 실내 가구 사전 {_i + 1}/{len(_chunks)} ({len(_chunk)}종, 칸 번호 전체)

{HEAD}

항목: `id`(도구 objects[].id 에 그대로) · `ko` · `category`·`categoryKo`(방 분류 — `list_hand_interior_parts` 의 category 인자, 정본 `interior/categories.py`) · `block`(그림 원본 blocks/<block>.py) · `kind`(floor 바닥 가구 · wall 북쪽 벽 앞 · hang 벽면 윗줄 걸이 · flat 밟는 무늬) · `w`×`h`(발자국 칸) · `up`(위로 솟은 px) ·
`use`·`facing`·`surface`(윗면 → 탁상 물건)·`stairs`·`tags`(방)·`place`(놓는 곳)·`pair`(짝 가구)·`desc` · `cells`([dx, dy, 칸 번호, 층] — dy<0 은 발자국 위로 솟은 칸, 층 2 = 밟는 무늬·3 = 가구) ·
같은 그림의 키트 `kit`(`stamp_object` 용 — 실내는 도구로 짓고 키트는 낱개 확인용) · `upperTiles`(키트 칸 전체) · `codes`(엔진 판정 `X` 막힘 · `*` ★ · `.` 걸음 · `_` 빈 칸). 짓는 법은 `jp-interior-rules`, 그림 `jp-img-interior-dict-*`.

{jfences(_chunk, 13000)}
""")


def doc_in_surfaces():
    fl = [{'id': k, 'ko': v['ko'], 'cols': v['cols'], 'rows': v['rows'], 'tiles': [tnum(t) for t in v['tiles']]} for k, v in JPI['floors'].items()]
    wl = [{'id': k, 'ko': v['ko'], 'cols': v['cols'], 'tiles': [tnum(t) for t in v['tiles']]} for k, v in JPI['walls'].items()]
    ce = [{'id': k, 'tiles': [tnum(t) for t in v]} for k, v in JPI['ceilings'].items()]
    tb = [{'style': k, 'ko': v['ko'], 'oneRow': v['oneRow'], 'up': v['up'], 'pieces': {pk: [[dx, dy, tnum(t), l] for dx, dy, t, l in cells] for pk, cells in v['pieces'].items()}} for k, v in JPI['tables'].items()]
    gd = [{'id': k, 'tile': tnum(v)} for k, v in JPI['goods'].items()]
    return f'''# 일본 도시 — 일본 집 실내 구조·탁자·탁상 물건 사전 (칸 번호 전체)

{HEAD}

조립기가 칸 번호를 고르는 식(사람이 칠하지 않는다 — 검증·디버깅용):
- 바닥: `tiles[((y % rows) * cols + x % cols) * 4 + 그림자]`, 그림자 = 1(바로 위 칸이 벽면) | 2(서쪽 칸이 막힘). 짜임 무늬는 맵 좌표에 고정(주기 {list(JPI['floors'].values())[0]['cols']}×{list(JPI['floors'].values())[0]['rows']}).
- 벽면: `tiles[((줄 − 1) * cols + x % cols) * 2 + 서쪽]`, 줄 1 = 윗줄 · 2 = 아랫줄, 서쪽 = 1(서쪽 칸이 막힘).
- 천장 띠: `tiles[b]`, b = 남(1)·북(2)·서(4)·동(8)이 실내인지 + 16(북쪽이 공허). 공허 = `{tnum(JPI['void'])}`.
- 탁자: 조각 키 = 열(L 왼 · M 가운데 · R 오른 · S 한 칸) + 행(T 위 · M · B 아래 · S 한 줄), 조각마다 [dx, dy, 칸 번호, 층].

## 바닥 {len(fl)}
{jfences(fl, 13000)}

## 벽면 {len(wl)}
{jfences(wl, 13000)}

## 천장 띠
{jfences(ce, 13000)}

## 탁자 {len(tb)}
{jfences(tb, 13000)}

## 탁상 물건 {len(gd)}
{jfences(gd, 13000)}
'''


add_doc(C_INT, 'interior-surfaces', '일본 도시 · 일본 집 실내 바닥·벽면·천장·탁자·탁상 물건 칸 번호', doc_in_surfaces())


def doc_in_ex(f):
    e = EIN['examples'][f]; W = e['W']
    a = e['args']
    rooms = md_table(['방', '사각형(x0,y0)-(x1,y1)'], [[r['room'], f"({r['x0']},{r['y0']})-({r['x1']},{r['y1']})"] for r in e['rooms']])
    ev = md_table(['이벤트', '칸', '이동'], [[x['id'], f"({x['x']},{x['y']})", f"{(x['to'] or {}).get('mapId')} ({(x['to'] or {}).get('x')},{(x['to'] or {}).get('y')})"] for x in e['events']]) if e['events'] else '(이동 이벤트 없음 — 현관 밖은 거리 맵에 붙일 때 단다)'
    lay = '\n\n'.join(f"### {k}층\n```\n{flat_rows(to_rows([tnum(t) for t in e['layers'][k]], W))}\n```" for k in ('1', '2', '3', '4'))
    return f'''# 일본 도시 — 일본 집 실내 예제: {_IN_EX_KO[f]} (`{a["mapId"]}`, {W}×{e["H"]})

{HEAD}

입력(도구 `build_hand_interior_room` 인자 그대로) → 4층 정답 배열 → 원본 그림 `jp-img-interior-{f}`. 도구 결과: {e["summary"]}

## 입력
{tool_json(a)}

## 방 구획(사람이 붙인 이름 — `list_hand_interior_parts` 방 표의 근거)
{rooms}

## 이동
{ev}

## 통행(엔진 `isPassable`, `X` 막힘 · `.` 걸음)
```
{chr(10).join(e['codes'])}
```

## 4층 정답 배열 (칸 번호, `.` = 빈 칸)
{lay}
'''


for _f in _IN_EX:
    add_doc(C_INT, f'interior-ex-{_f}', f'일본 도시 · 일본 집 실내 예제 · {_IN_EX_KO[_f]}', doc_in_ex(_f))


def img_in():
    for f in _IN_EX:
        e = EIN['examples'][f]; W, H = e['W'], e['H']
        k = max(1, min(4, 820 // (W * T), 820 // (H * T)))
        save_img(f'interior-{f}', up(render(e['layers'], W, H), k), f'{_IN_EX_KO[f]} {W}×{H}칸(×{k}, 엔진 4층 합성 — 도구가 실제로 지은 맵). 배열·입력 `jp-interior-ex-{f}`.', C_INT)
    items = [(oid, _in_obj_img(oid)) for oid in _IN_ORDER]
    for i, pg in enumerate(_in_pack(items)):
        save_img(f'interior-dict-{i + 1}', pg, f'일본 집 실내 가구 도감 {i + 1}쪽(×2, 체크 = 투명, 라벨 = 가구 id, 발자국 위로 솟은 칸 포함). 칸 번호는 `jp-interior-dict-*`.', C_INT)
    sf = []
    for fid, v in JPI['floors'].items():
        im = Image.new('RGBA', (v['cols'] * T, v['rows'] * T))
        for y in range(v['rows']):
            for x in range(v['cols']): im.alpha_composite(cell(tnum(v['tiles'][(y * v['cols'] + x) * 4])), (x * T, y * T))
        sf.append((f'바닥 {fid}', up(im, 2)))
    for wid, v in JPI['walls'].items():
        im = Image.new('RGBA', (v['cols'] * T, 2 * T))
        for r in (1, 2):
            for x in range(v['cols']): im.alpha_composite(cell(tnum(v['tiles'][((r - 1) * v['cols'] + x) * 2])), (x * T, (r - 1) * T))
        sf.append((f'벽면 {wid}', up(im, 2)))
    for i, pg in enumerate(_in_pack(sf)):
        save_img(f'interior-surfaces-{i + 1}', pg, f'일본 집 실내 바닥(짜임 주기 한 벌)·벽면(윗줄+아랫줄) ×2. 칸 번호 `jp-interior-surfaces`.', C_INT)
    # 정상/오류 — 오류 칸 둘레를 잘라 나란히
    good = EIN['examples']['house-1f']; W, H = good['W'], good['H']
    for key, e in EIN['errors'].items():
        pick = [i for i in e['issues'] if i['severity'] == 'error'] or [i for i in e['issues'] if i['severity'] == 'warning']
        pts = [(i['x'], i['y']) for i in pick if i['x'] is not None]
        if key == 'doorBlocked': pts = [(13, 10)] + [(c['x'], c['y']) for c in e['unreachedFloor']]
        if not pts or not e['layers']: continue
        cx = sum(p[0] for p in pts) // len(pts); cy = sum(p[1] for p in pts) // len(pts)
        cw, chh = 11, 9
        x0 = max(0, min(W - cw, cx - cw // 2)); y0 = max(0, min(H - chh, cy - chh // 2))
        k = 2
        def crop(layers):
            im = render(layers, W, H).crop((x0 * T, y0 * T, (x0 + cw) * T, (y0 + chh) * T)); return up(im, k)
        gi = crop(good['layers']); bi = crop(e['layers'])
        mark_cells(bi, [(x - x0, y - y0) for x, y in pts if x0 <= x < x0 + cw and y0 <= y < y0 + chh], k)
        codes = ', '.join(sorted({i['code'] for i in pick}))
        save_img(f'in-err-{key.lower()}', panels([('정상(예제 1층)', gi), (f'오류 — {e["title"]} → {codes}', bi)]),
                 f'일본 집 실내 변조 `{codes}`: 왼쪽 정상/오른쪽 오류, 빨강 = 조립기가 짚은 칸. 잘라낸 창 = 맵 칸 ({x0},{y0})~({x0 + cw - 1},{y0 + chh - 1}), 원본 ×{k}. 좌표·고치는 법은 `jp-interior-rules` 정상/오류 표.', C_INT)


img_in()


C_ERR = new_cat('errors', '일본 도시 · 정상/오류·자동 좌표 검증·층 정정',
                '모든 용도의 정상/오류 실험을 한곳에 모은 총괄: 검사 코드 → 용도·문서·그림 지도, 변조별 맵 좌표 표(오토타일 17세트·건물 11+3·도로 3·상가 3), 검사 범위(과대 주장 금지), 엔진 판정과 안 맞는 층 설명의 정정(전/후)과 투명 덧그림 층 돌려놓기 실험.')

# 층 설명 대조: 그룹 defaultLayer 는 굽기가 멤버 칸의 엔진 홈에서 유도한다(bake_lib.derive_group_layer) — 정정 후 어긋남 0 을 여기서 다시 확인한다.
# 정정 전(2026-10-03 이전 굽기)의 선언값 — 역사 기록용 상수. 투명 덧그림 5그룹은 lower, 나머지 8그룹은 upper 였다.
OLD_GROUP_LAYER = {'jp:lane-center': 'lower', 'jp:lane-dash': 'lower', 'jp:crosswalk': 'lower', 'jp:tactile': 'lower', 'jp:road-kit-marking': 'lower',
                   'jp:prop:street': 'upper', 'jp:prop:green': 'upper', 'jp:prop:gate': 'upper', 'jp:prop:shrine': 'upper', 'jp:prop:stairs': 'upper',
                   'jp:prop:storefront': 'upper', 'jp:prop:play': 'upper', 'jp:underpass-footbridge': 'upper'}
_GROUP_HOMES = collections.OrderedDict()            # 정정 대상 그룹 → {'upper': [칸], 'lower': [칸]} (엔진 홈 기준)
_LEFT_MISMATCH = []                                  # 정정 후에도 그룹 층과 칸 홈이 어긋난 (그룹, 칸) — 0 이어야 한다
HIST_TILES = 3728      # 정정(2026-10-03) 당시 칸 수 — 이후에 덧붙은 칸(번호 ≥ 3728)은 정정 전/후 비교 표에 세지 않는다
for _g in D['tileGroups']:
    _homes = {'upper': [], 'lower': []}; _hist = {'upper': [], 'lower': []}
    for _t in _g['tileIds']:
        _c = CODES[_t]
        if not _c or _c[0] == 'b': continue
        _homes['lower' if _c[0] == 'l' else 'upper'].append(_t)
        if _t < HIST_TILES: _hist['lower' if _c[0] == 'l' else 'upper'].append(_t)
    if _g['id'] in OLD_GROUP_LAYER: _GROUP_HOMES[_g['id']] = _hist
    if _g['defaultLayer'] == 'event': continue
    _want = 'mixed' if (_homes['upper'] and _homes['lower']) else ('upper' if _homes['upper'] else 'lower' if _homes['lower'] else _g['defaultLayer'])
    if _g['defaultLayer'] != _want: _LEFT_MISMATCH.append(_g['id'])
assert not _LEFT_MISMATCH, _LEFT_MISMATCH
assert not AUD['groupLayerMismatches'], AUD['groupLayerMismatches']
assert set(_GROUP_HOMES) == set(OLD_GROUP_LAYER), set(OLD_GROUP_LAYER) ^ set(_GROUP_HOMES)
_LM_UP_BY = collections.OrderedDict((gid, h['upper']) for gid, h in _GROUP_HOMES.items() if OLD_GROUP_LAYER[gid] == 'lower')     # 옛 선언 아래층·엔진 홈 위층(투명 덧그림)
_LM_LO_BY = collections.OrderedDict((gid, h['lower']) for gid, h in _GROUP_HOMES.items() if OLD_GROUP_LAYER[gid] == 'upper' and h['lower'])   # 옛 선언 위층·엔진 홈 아래층
_LM_UP = [t for v in _LM_UP_BY.values() for t in v]
_LM_LO = [t for v in _LM_LO_BY.values() for t in v]
assert len(_LM_UP) == 74 and len(_LM_LO) == 103, (len(_LM_UP), len(_LM_LO))
_STAIR_STAR = [{'tile': t} for t in AUD['walkableStairs']]
assert len(_STAIR_STAR) == 62 + 8 and sum(1 for t in AUD['walkableStairs'] if REGION[t] == 'interior') == 8, len(_STAIR_STAR)   # 54 + 지하철역 계단(내려가는 4·올라가는 4 — 둘 다 맨 윗줄 가운데는 머리벽이라 막힘) + 일본 집 실내 계단 8(올라가는 계단 발칸·솟은 칸, 계단통 솟은 칸)


def n_issue(lst): return len(lst)


def doc_err_overview():
    B = EN['tampers']
    rows = [
        ['`autotile-stale`', '오토타일 멤버 칸이 이웃과 안 맞는다(재계산 안 됨)', f'오토타일 17세트(세트마다 1건)', '`jp-at-<세트>`·`jp-at-usage`', '`jp-img-at-<세트>-err`(왼쪽)', '몸통 칸을 `paint_tiles` 로 다시 칠한다'],
        ['`wrong-layer`', '오토타일 칸이 칠하는 층이 아닌 층에 있다', '오토타일 17세트(세트마다 1건)', '`jp-at-<세트>`·`jp-at-usage`', '`jp-img-at-<세트>-err`(오른쪽)', '지우고 맞는 층에 `paint_tiles` 로 칠한다'],
    ]
    for t in B:
        codes = ', '.join(f'`{c}`' for c in sorted({e["code"] for e in t['errors']}))
        rows.append([codes, t['title'], f"건물 {t['id']}", '`jp-bld-errors`', f"`jp-img-err-bld-{t['id'].lower()}`", '표의 「고치는 법」(`jp-bld-errors`)'])
    rows += [
        ['`road-gap`', '직선 반복 도로 줄이 끊김', '도로 키트', '`jp-road-assembly`', '`jp-img-err-road-gap`', '간격을 키트 폭으로 맞춘다'],
        ['`arm-misaligned`', '키트 팔이 같은 줄에 안 선다', '도로 키트', '`jp-road-assembly`', '`jp-img-err-road-shift`', '팔 오프셋 공식 위치로 옮긴다'],
        ['`overlay-in-base-layer`', '투명 표시 칸이 1층에 있다', '도로 키트', '`jp-road-assembly`', '`jp-img-err-road-mark-layer`', '3층으로 옮긴다(`stamp_object`)'],
        ['`door-access-blocked`', '문 앞 접근칸이 막혔다', '상가 키트', '`jp-shop-rules`', '`jp-img-err-shop-door-access`', '소품을 접근칸 밖으로 옮긴다'],
        ['`back-over-front`', '뒷건물이 앞건물을 덮었다', '상가 키트', '`jp-shop-rules`', '`jp-img-err-shop-order`', '뒷줄 먼저·앞줄 나중 순서로 찍는다'],
        ['`building-in-lower-layer`', '건물 칸이 1층에 있다', '상가 키트', '`jp-shop-rules`', '`jp-img-err-shop-layer`', '3층으로 옮기고 1층은 땅으로'],
    ]
    return f'''# 일본 도시 — 정상/오류 · 자동 좌표 검증 · 층 정정 (총괄)

{HEAD}

이 용도는 다른 용도(오토타일·건물 조립 도구·도로 키트·상가 키트)에 흩어진 **정상/오류 나란한 그림과 맵 좌표 검증**을 한곳에서 찾는 지도다.
각 용도 문서에 정상 그림·오류 그림·변조 좌표가 이미 들어 있다 — 아래 표의 문서·그림 이름으로 찾아 읽는다. 이 용도 자체에는 변조 좌표 전체표(`jp-err-scenarios`)와 층 설명 정정(`jp-err-layer-correction`)이 있다.

## 검사의 정체
- 검사는 사람이 쓴 규칙이 아니라 **엔진 함수의 판정**이다: 오토타일은 `autotileVariantForCell`(이웃으로 고르는 칸), 층은 `tileLayerPolicy().home`, 통행은 `isPassable`·`passabilityOf`, 그림 순서는 `mapUpperTileDepth`, 건물은 `checkJpCityStructure`(조립기).
- 오류 그림은 정상 입력에서 **한 가지만 일부러 틀리게 바꾼** 실제 맵(`tiledata/jp-city/refs/engine_dump.mts` 가 실제 도구를 호출해 만든 결과)이고, 빨강 테두리가 검사가 짚은 칸이다. 좌표는 맵 칸 0 기준 (x,y).
- 건물 조립 도구(`build_jp_city_building`)는 틀린 입력이면 **맵을 바꾸지 않고** 코드와 좌표로 거부한다(변조 {len(B)}건 전부 「맵 불변」). 낱칸 도구(`paint_tiles`·`stamp_layer_block`·`stamp_object`)는 막지 않고 사후 검사로만 잡는다.

## 코드 → 용도·문서·그림 지도
{md_table(['코드', '뜻', '실험', '문서', '오류 그림', '고치는 법(레이어 정정 포함)'], rows)}

## 검사 범위 (과대 주장 금지)
| 보는 것 | 보지 않는 것 |
|---|---|
| 칸 번호·층·이웃 재계산 일치·막힘/걸음·문 앞 접근칸 도달·그림 순서·키트 팔 좌표 | 이벤트 실행(문 이동·대화)·움직이는 NPC·신호와 차량 흐름 |
| 건물 띠 순서·층 쌍·문 위치·부착물 겹침(조립기) | 색 조화·밀도·「좋아 보이는가」 같은 미적 품질 |
| 번들 안 키트·부품 id 와 좌표 | 이 문서를 읽는 낮은 성능 모델이 맞게 깔 확률(측정하지 않았다) |
검사 통과는 「구조·층·통행이 맞다」는 뜻일 뿐이다. 이 문서 묶음은 저장소의 전체 시험(`vitest`·게이트)을 돌린 결과가 아니다.

## 읽는 순서
`jp-err-overview`(이 문서) → 해당 용도의 문서(위 표) → 변조 좌표 전체표 `jp-err-scenarios` → 층 설명 정정 `jp-err-layer-correction`.
'''


add_doc(C_ERR, 'err-overview', '일본 도시 · 정상/오류 총괄(코드 → 용도·문서·그림 지도)', doc_err_overview())


def doc_err_scenarios():
    at_rows = []
    for gid in AT:
        d = AT_DEMO[gid]; short = gid[3:]
        s1 = issue_rows(d['staleErr']['issues'], 'autotile-stale'); s2 = issue_rows(d['layerErr']['issues'], 'wrong-layer')
        at_rows.append([f'`{gid}`', LAYER_NAME[d['layer']], f'몸통 칸 {d["body"]} 그대로 찍음(재계산 없이)', f'`autotile-stale` {len(s1)}칸: ' + fmt_coords(s1, 5),
                        f'같은 칸을 {d["wrongLayer"]}층에 놓음', f'`wrong-layer` {len(s2)}칸: ' + fmt_coords(s2, 5), f'`jp-img-at-{short}-err`'])
    bl = []
    for t in EN['tampers']:
        errs = ', '.join(f"`{e['code']}`@({e['x']},{e['y']})" for e in t['errors']) or '(없음)'
        bl.append([t['id'], t['what'], ('거부 `' + t['toolCode'] + '`' if not t['toolOk'] else '**지어졌다**'), '맵 불변' if t['mapUnchanged'] else '**맵이 바뀜**', errs])
    sr = [[s['what'], ', '.join(f'`{g}`' for g in s['got'])] for s in EN['structureTampers']]
    RE = EN['roadErrors']; SE_ = EN['shopErrors']
    rd = [
        ['`road-gap`', '`lane-h` 반복 두 번째를 x=7 에(정답 x=6)', ', '.join(f"({e['x']},{e['y']})" for e in RE['badGap']['extra'])],
        ['`arm-misaligned`', '`lane-v` 를 x=11 에(정답 x=10)', f"({RE['shiftNote']['to'][0]},{RE['shiftNote']['to'][1]}) 에서 +1열"],
        ['`overlay-in-base-layer`', '`jp-road-mark-bike-stop` 칸을 1층에', ', '.join(f"({e['x']},{e['y']})" for e in RE['markLower']['extra']['errors'])],
        ['`door-access-blocked`', '`jp-prop-vend-pair` 를 (4,11) 에 찍어 `konbini-block` 접근칸을 막음', ', '.join(f"({e['x']},{e['y']})" for e in SE_['blockedAccess']['errors'])],
        ['`back-over-front`', '앞줄 `konbini-block` 먼저·뒷줄 `sushi-bar` 나중', f"{len(SE_['orderBad']['errors'])}칸: " + ', '.join(f"({e['x']},{e['y']})" for e in SE_['orderBad']['errors'][:6]) + ' …'],
        ['`building-in-lower-layer`', '`stamp_layer_block` 으로 건물 칸을 1층에', f"{len(SE_['lowerBuilding']['errors'])}칸(예: " + ', '.join(f"({e['x']},{e['y']})" for e in SE_['lowerBuilding']['errors'][:4]) + '…)'],
    ]
    return f'''# 일본 도시 — 변조 실험 전체표 (좌표)

{HEAD}

모든 실험은 실제 도구를 호출해 만든 맵이다(`tiledata/jp-city/refs/engine_dump.mts`, 같은 입력이면 같은 결과). 좌표는 시험판 맵의 칸 0 기준 (x,y), 「N칸」은 검사가 짚은 칸 수. 오류 그림은 각 용도 문서의 이름으로 열린다.

## 오토타일 17세트 (세트마다 2건, 입력 마스크는 각 세트 문서)
{md_table(['세트', '칠하는 층', '오류 1', '검출 1', '오류 2', '검출 2', '그림'], at_rows)}

## 건물 조립 도구 변조 B1~B11 (실제 `build_jp_city_building`, 시험판 건물 폭+4 × 높이+5, 사각형 (2,1) 시작)
{md_table(['번호', '변조', '도구 결과', '맵', '검출 코드@맵 좌표'], bl)}
조립 결과 직접 손상(`checkJpCityStructure`, 좌표는 건물 사각형 안 (열,행)):
{md_table(['손상', '검출'], sr)}

## 도로·상가 변조 6건
{md_table(['코드', '변조', '맵 좌표(x,y)'], rd)}

## 읽는 법
- 코드 한 줄이 짚은 칸이 곧 고칠 자리다. 고치는 법은 총괄 `jp-err-overview` 의 표.
- 「맵 불변」은 도구가 부분 배치를 남기지 않는다는 뜻이다. 낱칸 도구의 오류는 맵이 이미 바뀐 뒤 사후 검사로 보인다.
- **보는 범위**: 칸 번호·층·통행·접근칸 도달. 이벤트 실행·미적 품질·모델 성공률은 보지 않는다.
'''


add_doc(C_ERR, 'err-scenarios', '일본 도시 · 변조 실험 전체표(맵 좌표)', doc_err_scenarios())


def doc_err_layer():
    kc = AUD['kindCount']
    now = {g['id']: g for g in D['tileGroups']}
    up_rows = [[f'`{gid}`', f'{len(v)}칸', fmt_runs(runs_of(v), 8), f"`{OLD_GROUP_LAYER[gid]}` → `{now[gid]['defaultLayer']}`(layerHome `{now[gid]['layerHome']}`)", '3층 위(투명), 그림 순서는 캐릭터 아래'] for gid, v in _LM_UP_BY.items()]
    lo_rows = [[f'`{gid}`', f'{len(v)}칸', fmt_runs(runs_of(v), 8), f"`{OLD_GROUP_LAYER[gid]}` → `{now[gid]['defaultLayer']}`(layerHome `{now[gid]['layerHome']}`)", code_text(v[0])] for gid, v in _LM_LO_BY.items()]
    stair = fmt_runs(runs_of([e['tile'] for e in _STAIR_STAR]), 10)
    nm = EN['autotiles'][12]
    return f'''# 일본 도시 — 층 설명 정정 (엔진 판정 대 정의 설명, 전/후 — 정의 정정 완료)

{HEAD}

타일 그룹의 `defaultLayer`(정의의 층 설명)와 엔진 판정(`tileLayerPolicy().home` · `passabilityOf` · `mapUpperTileDepth`)을 칸 {AUD['checked']}개에 대조했다. **엔진이 정본이다** — 둘이 다르면 엔진을 따른다.
**정의 정정 완료**: 어긋났던 그룹 13개의 층 설명은 이제 멤버 칸의 엔진 홈에서 유도한 값이다(굽기 `bake_lib.derive_group_layer`). 정정 뒤 다시 잰 어긋남은 **0건**(그룹 {AUD['groups']}개 전부 일치)이다. 칸 번호·그림·통행·칸 `priority` 는 바뀌지 않았다 — 엔진은 칸 홈을 칸 단위(잠긴 칸의 `defaultLayer`, 아니면 `priority`)로만 정하고 그룹 `defaultLayer` 는 홈 판정에 쓰지 않기 때문에, 칠하는 결과는 정정 전후가 같고 **어휘 설명(AI가 읽는 그룹 층)만 바로잡혔다**.

## 1. 엔진 판정 여섯 종 (검사한 칸 {AUD['checked']}개, 빈 칸 {AUD['blank']}개 제외)
{md_table(['홈', '통행', '그림 순서', '칸 수', '무엇'], [
    ['위층', '걸음 ★', '항상 캐릭터 위', kc['star|prio=upper|home=upper|depth=above'], '건물 윗층·처마·옥상·소품 윗부분'],
    ['위층', '막힘', '캐릭터와 y 정렬', kc['solid|prio=upper|home=upper|depth=ysort'], '건물 아래 두 줄·문·소품 밑동·담·가드레일'],
    ['아래층', '걸음', '캐릭터 아래', kc['passable|prio=lower|home=lower|depth=below'], '불투명 땅(보도·도로·잔디 …)'],
    ['아래층', '막힘', '캐릭터와 y 정렬', kc['solid|prio=lower|home=lower|depth=ysort'], '막힌 땅(연못·수로 물)'],
    ['위층', '걸음', '캐릭터 아래', kc['passable|prio=lower|home=upper|depth=below'], '**투명 덧그림**(중앙선·표시·점자블록·소품 아랫단)'],
    ['위층', '걸음 ★(계단)', '캐릭터 아래', kc['star|prio=upper|home=upper|depth=below'], '돌계단·계단 칸 (태그에 stair·계단·사다리)'],
])}
정의 검사 `group-layer-vs-tile-home` 가 이 일치를 굽기마다 확인한다(그룹 층 = 멤버 칸 홈이 전부 위이면 `upper`, 전부 아래이면 `lower`, 섞이면 `mixed` + `layerHome: perCell`).

## 2. 정정 A — 그룹 설명이 「아래층」이던 투명 덧그림 5그룹 ({len(_LM_UP)}칸) → 「위층」
{md_table(['그룹', '칸 수', '칸 번호', '전 → 후(그룹 층)', '엔진 판정(정본)'], up_rows)}
엔진 홈은 위층, **재성형 층은 2층(`lowerOverlayTiles`)** — 아래 1층에 땅이 있어야 하고, 칸은 2층에 칠한다. 그림 순서는 캐릭터 아래(`depth=below`), 통행은 걸음이다. 1층에 직접 칠하면 아래 땅이 없어 검게 보인다. 도구 실측: `paint_tiles` 에 layer "1"·"3" 을 주면 이 칸을 **3층으로 돌려 놓고 재성형하지 않는다**(아래 「층 돌려놓기 실험」).

## 3. 정정 B — 그룹 설명이 「위층」이던 소품·육교 8그룹 ({len(_LM_LO)}칸이 엔진 홈 아래층) → 「mixed」
{md_table(['그룹', '아래층 칸 수', '아래층 칸 번호', '전 → 후(그룹 층)', '엔진 판정(정본)'], lo_rows)}
이 그룹들은 위층 칸과 아래층 칸이 섞여 있어(소품 밑동·바닥 쪽 칸은 아래층 홈) 그룹 층을 하나로 못 박지 못한다 — 이제 `mixed`·`perCell` 이라 어휘 도구가 칸마다 엔진 홈을 따른다. 키트는 키트 배열대로(`stamp_object`) 찍으면 칸마다 정해진 층에 놓이므로 문제가 없다 — 낱칸을 직접 칠할 때만 이 판정을 따라 층을 고른다.

## 4. 계단 {len(_STAIR_STAR)}칸 — 정정 대상이 아니다(엔진의 설계된 예외)
칸 번호 {stair}(그룹 `jp:prop:stairs` 등). 통행은 `star` 인데 그림 순서가 「아래」라서 처음에는 어긋남으로 셌다. 그러나 엔진은 `star` 칸이라도 **태그에 stair·계단·사다리가 있으면 밟는 계단**으로 보고 일부러 캐릭터 아래로 그린다(`src/player/characterDepth.ts` `isWalkableStairTile` · `mapUpperTileDepth`) — 오르내리는 계단이라 캐릭터가 위로 지나간다. 정의(`passage=star` + `stairs`/`계단` 태그)가 이 규칙에 맞게 되어 있어 **바꾸지 않는다**. 이 칸을 「캐릭터를 가리는 처마」처럼 쓰지 않는다 — 가려지지 않는다. 같은 규칙을 `star` 칸 54개에 태그로 적용하고, 나머지 `star` 칸 2221개는 항상 캐릭터 위다.

## 층 돌려놓기 실험 (투명 덧그림을 잘못된 층으로 칠했을 때)
`jp-lane-center`(중앙선, 정답 층 2층)를 같은 입력으로 두 번 칠했다. 정상은 `paint_tiles` layer **"2"**, 오류는 layer "1" — 도구 응답: 「{nm['reroute']['summary']}」 (경고 {len(nm['reroute']['warnings'])}건). 결과: 3층에 {nm['reroute']['onLayer3']}칸, 2층에 {nm['reroute']['onLayer2']}칸, 서로 다른 칸 번호 {nm['reroute']['distinct']}종(몸통 칸 하나뿐 — 재성형 안 됨), `autotile-stale`/`wrong-layer` {nm['reroute']['issues']}건.
그림 `jp-img-err-layer-reroute`(왼쪽 정상, 오른쪽 오류).
**정정(전 → 후)**: 오류 맵의 칸을 3층에서 지우고 아래 1층에 땅이 있는지 확인한 뒤 layer "2" 로 몸통 칸을 칠한다 — 왼쪽 정상 그림이 이 결과다(같은 입력을 layer "2" 로 칠한 실측: 2층에 이웃에 맞는 칸, 검사 0건). 지우는 단계 자체는 따로 실행해 보지 않았다.

## 한계
- 위 대조는 이 번들의 타일 정의와 엔진 함수에 대한 것이다. 사용자가 올린 타일셋·다른 칩셋에는 적용되지 않는다.
- 이미 만들어 둔 프로젝트의 타일셋 사본은 칸 수·칸 층 표가 같으면 갱신되지 않는다(`ensureJpCityTileset` 의 형태 서명이 그룹 층을 안 본다) — 정정된 그룹 층은 새 프로젝트부터 보인다. 칠하는 결과는 칸 홈이 정하므로 동작은 같다.
'''


add_doc(C_ERR, 'err-layer-correction', '일본 도시 · 층 설명 정정(엔진 판정 대 정의 설명, 전/후)', doc_err_layer())


def img_err():
    nm = [a for a in EN['autotiles'] if a['id'] == 'jp-lane-center'][0]; W, H = nm['W'], nm['H']
    k = best_scale([W * T, W * T], [H * T, H * T])
    gi = up(render(nm['normal']['layers'], W, H), k); bi = up(render(nm['reroute']['layers'], W, H), k)
    save_img('err-layer-reroute', panels([('정상 — layer "2" 로 칠함(2층, 재성형)', gi), (f'오류 — layer "1" 로 요청 → 3층으로 돌려놓음, 몸통 칸만({nm["reroute"]["issues"]}칸 어긋남)', bi)]),
             f'`jp-lane-center`(투명 덧그림, 정답 2층): 정상(왼쪽, layer "2")/오류(오른쪽, layer "1" 요청 → 도구가 3층으로 돌려 놓고 재성형하지 않아 중앙선 이음이 몸통 칸 하나로만 보임). 좌표·결과는 `jp-err-layer-correction`. 원본 ×{k}.', C_ERR)


img_err()


# ====================================================================== 마무리 — 검증·쓰기
def finalize():
    # 그림 → 분류
    for name, (cat, rec) in IMAGES.items():
        CATS[cat].setdefault('images', []).append(rec)
    cats = list(CATS.values())
    for c in cats: c.setdefault('images', [])
    # 한도
    assert len(cats) <= 32, len(cats)
    for c in cats:
        assert len(c['documents']) <= 64, (c['id'], len(c['documents']))
        assert len(c['images']) <= 256, (c['id'], len(c['images']))
        for d in c['documents']: assert len(d['markdown']) <= 120000, (d['id'], len(d['markdown']))
    # 그림 파일 — 경로 형식·존재·크기·색 수
    img_ids = set()
    for c in cats:
        for im in c['images']:
            assert re.fullmatch(r'/assets/jp-city-references/[A-Za-z0-9_-]+\.png', im['dataUrl']), im['dataUrl']
            p = os.path.join(ROOT, 'public' + im['dataUrl'])
            assert os.path.exists(p), p
            with Image.open(p) as f:
                assert max(f.size) <= 820, (p, f.size)
                assert f.mode == 'P' and len(f.getpalette()) // 3 <= 256
                assert len([c_ for c_ in f.getcolors(maxcolors=100000) or [] ]) <= 128, p
            assert 'data:image' not in im['dataUrl']
            assert im['id'] not in img_ids, im['id']; img_ids.add(im['id'])
    # 안 쓰는 PNG 청소(이전 실행의 찌꺼기)
    used = {os.path.basename(im['dataUrl']) for c in cats for im in c['images']}
    for fn in sorted(os.listdir(IMG_DIR)):
        if fn.endswith('.png') and fn not in used: os.remove(os.path.join(IMG_DIR, fn)); print('stale 삭제', fn)
    # 문서 id 유일, 설명 글에 쓴 id 토큰 확인
    doc_ids = [d['id'] for c in cats for d in c['documents']]
    assert len(doc_ids) == len(set(doc_ids))
    known = set(doc_ids) | img_ids | set(KITS) | set(AT) | {TID, FAMILY}
    unknown = collections.Counter()
    for c in cats:
        for d in c['documents']:
            for tok in re.findall(r'`(jp-[A-Za-z0-9_-]+)`', d['markdown']):
                if tok in known or tok.endswith('-'): continue
                unknown[(d['id'], tok)] += 1
    kit_like = [(d, t) for (d, t) in unknown if re.match(r'jp-(recipe|road|door|prop|fumikiri|underpass|footbridge)', t)]
    assert not kit_like, kit_like[:10]
    # 문서에 적힌 배열 ↔ 정의(키트·오토타일 사전) 대조
    checked_items = 0
    fence = re.compile(r'```json\n(.*?)\n```', re.S)
    for c in cats:
        for d in c['documents']:
            for m in fence.finditer(d['markdown']):
                try: arr = json.loads(m.group(1))
                except Exception: continue
                if not isinstance(arr, list): continue
                for it in arr:
                    if not isinstance(it, dict): continue
                    if 'kit' in it and 'upperTiles' in it:
                        k = KITS[it['kit']]
                        w, h, lo, upv = kit_grid(it['kit'])
                        assert (it['w'], it['h']) == (w, h), it['kit']
                        assert it['upperTiles'] == [[int(t) for t in r] for r in upv], it['kit']
                        if 'tiles' in it: assert it['tiles'] == [[int(t) for t in r] for r in lo], it['kit']
                        checked_items += 1
                    for key in ('tile',):
                        if key in it and isinstance(it[key], int): assert -1 <= it[key] < COUNT
    # 범위 밖 칸 번호 — emitted_tiles 는 tnum 에서 이미 단언. 키트 전부 문서에 있어야 한다.
    missing = sorted(set(KITS) - emitted_kits)
    assert not missing, missing[:10]
    for k in RECIPES + DOORS + PROPS: assert k in emitted_kits
    # 건물 예제 25·오토타일 17 문서 존재
    for gid in AT: assert f'{PFX}at-{gid[3:]}' in doc_ids, gid
    # JSON
    out = json.dumps(cats, ensure_ascii=False, indent=1) + '\n'
    assert 'data:image' not in out
    open(OUT_JSON, 'w', encoding='utf-8').write(out)
    for fn, md in MD_FILES: open(os.path.join(MD_DIR, fn), 'w', encoding='utf-8').write(md)
    ev = collections.OrderedDict()
    ev['categories'] = [dict(id=c['id'], name=c['name'], documents=len(c['documents']), images=len(c['images']),
                             chars=sum(len(d['markdown']) for d in c['documents'])) for c in cats]
    ev['totals'] = dict(categories=len(cats), documents=len(doc_ids), images=len(img_ids), chars=sum(len(d['markdown']) for c in cats for d in c['documents']),
                        maxDocChars=max(len(d['markdown']) for c in cats for d in c['documents']), maxImagePx=max(max(Image.open(os.path.join(IMG_DIR, f)).size) for f in used))
    ev['tilesEmitted'] = len(emitted_tiles)
    ev['kitsEmitted'] = len(emitted_kits)
    ev['kitArrayItemsRoundtrip'] = checked_items
    ev['unknownTokens'] = sorted(f'{d}:{t}' for (d, t) in unknown)
    ev['sha256'] = dict(json=hashlib.sha256(out.encode()).hexdigest(),
                        images=hashlib.sha256(b''.join(open(os.path.join(IMG_DIR, f), 'rb').read() for f in sorted(used))).hexdigest())
    open(os.path.join(MD_DIR, 'check-evidence.json'), 'w', encoding='utf-8').write(json.dumps(ev, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps(ev['totals'], ensure_ascii=False)); print('sha', ev['sha256']); print('unknown 토큰', len(unknown))
    for c in ev['categories']: print(c)


finalize()
