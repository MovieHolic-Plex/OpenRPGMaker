# 51개 PAW 맵을 공용 DB 발행용 팩(output/paw-maps-pack.json, gitignored)으로 굽는다.
#
# 에디터 맵은 타일셋을 하나만 쓴다(GameMap.tilesetId). 그래서 맵을 네 무리(외부·가정·시설·특수)로 나누고,
# 무리마다 합본 타일셋 하나를 만든다. 합본에는 원본 PAW 시트를 통째 블록으로 싣는다(칸 번호 = 블록 원점 + 원본 칸).
# 자동타일은 256 이웃 모양의 변형 블록과 autotileGroup 으로, 격자에 맞지 않는 조각(문·소파·합성 킷)은
# 잘라낸 조각 칸으로 싣는다. 가구·소품(레시피·rect·킷·문 등)은 오브젝트로 따로 모으고,
# 맵은 그 타일셋 번호로 된 장소 맵(아래층 + 위층 + 위층 겹침)이 된다. PAW 그림은 저장소 밖에만 쓴다.
# Usage: python3 scripts/content/paw-maps/pack.py [out.json]
import sys, os, glob, runpy, json, hashlib, io, base64, inspect
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import pawlib
from PIL import Image, ImageChops

REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'output', 'paw-maps-pack.json')
TD = os.path.join(REPO, 'tiledata', 'pixel-art-world')
COLS = 64   # 2048px 폭 — 합본 높이를 WebGL 텍스처 한계(8192) 안으로 둔다
GROUPS = [('ext', '외부 · 마을/거리', lambda n: n < 20), ('home', '가정 · 저택 실내', lambda n: 20 <= n < 35),
          ('fac', '상점 · 시설 실내', lambda n: 35 <= n < 50), ('spec', '하수도 · 월드맵 · 특수', lambda n: n >= 50)]
def group_of(mid): n = int(mid[1:3]); return next(g for g, _, f in GROUPS if f(n))

# ---- 공용 DB 에 이미 있는 PAW 타일셋: 원본 시트와 칸이 그림째 같으면 그 타일셋의 통행·층·설명을 그대로 쓴다 ----
SHARED_DB = os.path.expanduser('~/.local/share/oprn/shared-content.sqlite')
OWN_LIBRARY = 'pixel-art-world-maps-51-local'
def shared_paw_tilesets():
    import sqlite3
    if not os.path.exists(SHARED_DB): return []
    con = sqlite3.connect(f'file:{SHARED_DB}?mode=ro', uri=True); out = []
    for lid, payload in con.execute('SELECT id, payload FROM content_libraries'):
        if not lid.startswith('pixel-art-world') or lid == OWN_LIBRARY: continue
        lib = json.loads(payload)
        for tid, t in lib.get('tilesets', {}).items():
            a = lib.get('assets', {}).get(t.get('image', {}).get('id', ''), {})
            url = a.get('dataUrl') or ''
            if not url.startswith('data:image/'): continue
            out.append((lid, tid, t, Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGBA')))
    con.close(); return out
SHARED_TS = None
def shared_match(s):
    """원본 시트 s 와 칸 번호·그림이 같은 공용 타일셋 (library, tilesetId, def) 또는 None"""
    global SHARED_TS
    if SHARED_TS is None: SHARED_TS = shared_paw_tilesets()
    im = pawlib.sheet(s).convert('RGBA'); cols = im.width // 32
    cl = [im.crop((x * 32, y * 32, x * 32 + 32, y * 32 + 32)) for y in range(im.height // 32) for x in range(cols)]
    nz = [i for i, c in enumerate(cl) if c.getbbox() is not None]
    for lid, tid, t, tim in SHARED_TS:
        if t['tilesPerRow'] != cols or t['count'] < len(cl) or tim.width // 32 != cols or tim.height // 32 * cols < len(cl): continue
        if nz and all(tim.crop(((i % cols) * 32, (i // cols) * 32, (i % cols) * 32 + 32, (i // cols) * 32 + 32)).tobytes() == cl[i].tobytes() for i in nz):
            return lid, tid, t
    return None
def stem(name): return os.path.splitext(name)[0]
def h(im): return hashlib.sha1(im.tobytes()).hexdigest()
EMPTY = h(Image.new('RGBA', (32, 32)))

# ---- 맵 실행 기록: 격자 시트, 위층 조각의 출처 라벨 ----
cur = {'grid': set()}
_tile_init = pawlib.tile.__init__
def tile_init(self, name, t, row=None):
    _tile_init(self, name, t, row); cur['grid'].add(name)
pawlib.tile.__init__ = tile_init
_rect = pawlib.Map.rect
def rect(self, name, sx, sy, w, h_, x, y):
    cur['grid'].add(name); _rect(self, name, sx, sy, w, h_, x, y)
pawlib.Map.rect = rect

PRIO = {'recipe': 0, 'rec': 0, 'kit': 1, 'comp': 1, 'loose': 1, 'door': 1, 'build': 1, 'arr': 2, 'R': 3, 'chip': 4, 'image': 5}
# 맵 파일의 건물 조립 헬퍼(이름 인자를 받는다) — 그 안에서 찍힌 조각은 하나의 건물 오브젝트로 본다
BUILD = {'rtown': '레트로 상가 건물', 'roofshop': '지붕 상점', 'jhouse': '일본식 주택', 'konbini': '편의점 건물',
         'school_main': '학교 본관', 'bwall': '블록담', 'pine': '소나무', 'pole': '전봇대'}
def label_from_stack():
    best = None
    for fr in inspect.stack()[2:16]:
        fn, L = fr.function, fr.frame.f_locals
        lab = None
        if fn == 'recipe' and 'self' in L: lab = ('recipe', L['name'], L['rid'], None)
        elif fn == 'rec' and 'sh' in L: lab = ('recipe', L['sh'], L['rid'], L.get('name'))
        elif fn == 'R' and 'rid' in L: lab = ('recipe', L['name'], L['rid'], None)          # 가정 맵: R(m, sheet, recipe id, x, y)
        elif fn in ('place', 'obj') and 'name' in L and isinstance(L.get('label'), str): lab = ('R', L['name'], L['label'] or None)
        elif fn in BUILD: lab = ('build', fn, L.get('name') if isinstance(L.get('name'), str) else None)
        elif fn == 'kit' and 'kid' in L: lab = ('kit', L['kid'], L.get('name'))
        elif fn == 'comp' and 'cid' in L: lab = ('comp', L['cid'], L.get('name'))
        elif fn == 'loose' and 'fn' in L: lab = ('loose', L['fn'], L['idx'], L.get('name'))
        elif fn == 'door' and 'name' in L: lab = ('door', L['name'])
        elif fn == 'arr' and 'sh' in L: lab = ('arr', L['sh'], L.get('name'))
        elif fn == 'R' and 'sh' in L: lab = ('R', L['sh'], L.get('name'))
        elif fn == 'chip' and 'self' in L: lab = ('chip', L['name'])
        elif fn == 'rect' and 'self' in L and 'sx' in L: lab = ('R', L['name'], None)
        elif fn == 'image' and 'self' in L: lab = ('image', L['name'])
        if lab and (best is None or PRIO[lab[0]] < PRIO[best[0]]): best = lab
        if fr.filename.startswith(HERE + '/m') and fn == '<module>':
            line = (fr.code_context or [''])[0]
            note = line.split('#', 1)[1].strip() if '#' in line else ''
            if best is None: best = ('custom', os.path.basename(fr.filename), fr.lineno)
            return best, {'map': os.path.basename(fr.filename)[:-3], 'line': fr.lineno, 'code': line.strip()[:200], 'note': note}
    return best or ('custom', '?', 0), {}

class Over(list):
    def __init__(self): super().__init__(); self.labels = []; self.hints = []
    def append(self, item):
        super().append(item); lab, hint = label_from_stack(); self.labels.append(lab); self.hints.append(hint)
_init = pawlib.Map.__init__
def map_init(self, *a, **k):
    _init(self, *a, **k); self.over = Over()
pawlib.Map.__init__ = map_init

runs = []
def capture(self):
    bad = self.lint()
    if bad: raise AssertionError(f'{self.id} lint: ' + '; '.join(bad[:5]))
    runs.append(dict(m=self, grid=set(cur['grid']), full=self.render()))
pawlib.Map.save = capture
for f in sorted(glob.glob(HERE + '/m[0-9][0-9]_*.py')):
    cur['grid'] = set()
    runpy.run_path(f, run_name='__main__')

# ---- 이름 사전 ----
def J(n): return json.load(open(os.path.join(TD, n)))
CITY = {k['id']: k['name'] for k in J('city-kits.json')['kits']}
COMP = {c['id']: c['name'] for f in ('mansion-exteriors-layout.json', 'retrotown-exteriors-layout.json') for p in J(f) for c in p['composites']}
LOOSE = {(p['filename'], i): r['name'] for p in J('loose.json')['packs'] for i, r in enumerate(p['recipes'])}
REC = pawlib.CATALOG.get('recipes', {})
NAMES_FILE = os.path.join(HERE, 'object-names.json')   # 그림 해시(앞 16자) → 사람이 읽는 한국어 이름. 그림은 없다.
NAMES = json.load(open(NAMES_FILE)) if os.path.exists(NAMES_FILE) else {}
def ko(s): return s and any('\uac00' <= c <= '\ud7a3' for c in s)
def object_name(lab):
    k = lab[0]
    if k == 'recipe': return REC.get(lab[1], {}).get(lab[2], {}).get('name') or (lab[3] if ko(lab[3]) else f'{stem(lab[1])} · {lab[2]}')
    if k == 'kit': return CITY.get(lab[1]) or lab[1]
    if k == 'comp': return COMP.get(lab[1]) or lab[1]
    if k == 'loose': return LOOSE.get((lab[1], lab[2])) or f'{stem(lab[1])} #{lab[2]}'
    if k == 'door': return f'문 · {stem(lab[1])}'
    if k in ('arr', 'R'): return lab[2] if ko(lab[2]) else (f'{stem(lab[1])} · {lab[2]}' if lab[2] else f'{stem(lab[1])} 블록')
    if k == 'build': return BUILD[lab[1]]
    if k == 'chip': return f'{stem(lab[1])} 칩'
    if k == 'image': return f'{stem(lab[1])} 조각'
    return f'{lab[1]}:{lab[2]} 조각'
KIND_KO = {'recipe': '카탈로그 레시피', 'kit': '도시 킷', 'comp': '건물 외관 합성', 'loose': '낱장 소재', 'door': '문 스프라이트 닫힘 프레임',
           'build': '건물 조립',
           'arr': '타일 배열 조립', 'R': '시트 블록', 'chip': '칩 시트', 'image': '이미지 조각', 'custom': '맵 전용 합성'}

def is_auto(r): return isinstance(r, pawlib.auto)
def ref_key(r): return (type(r).__name__, r.name, tuple(sorted((k, repr(v)) for k, v in vars(r).items() if not k.startswith('_') and k != 'name')))
NB = ((0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8), (1, -1, 16), (1, 1, 32), (-1, 1, 64), (-1, -1, 128))
def same(a, b): return a is not None and b is not None and type(a) is type(b) and a.name == b.name and getattr(a, 'cx', None) == getattr(b, 'cx', None) and getattr(a, 'cy', None) == getattr(b, 'cy', None)
def cells_of(im):
    """32px cells of an image placed on the grid (partial edge cells padded transparent)"""
    W, H = -(-im.width // 32), -(-im.height // 32)
    for cy in range(H):
        for cx in range(W):
            c = Image.new('RGBA', (32, 32)); c.alpha_composite(im.crop((cx * 32, cy * 32, min(im.width, cx * 32 + 32), min(im.height, cy * 32 + 32))))
            yield cx, cy, c

def build_group(key, gname, recs):
    # 1) 블록 모으기: 격자 시트(통째), 자동타일(변형), 조각
    autos = {}
    grid = set()
    for rec in recs:
        m = rec['m']
        for row in m.lo:
            for r in row:
                if r is not None and is_auto(r): autos.setdefault(ref_key(r), r)
        for row in m.up:
            for c in row:
                for r in c:
                    if is_auto(r): autos.setdefault(ref_key(r), r)
        grid |= rec['grid']
    auto_names = {r.name for r in autos.values()}
    grid = sorted(s for s in grid if not (s in auto_names and pawlib.sheet(s).height == 128 and pawlib.sheet(s).width in (96, 384)))
    blocks = []  # (kind, key, w, h, cells[list of PIL or None])
    for s in grid:
        im = pawlib.sheet(s); w, h_ = im.width // 32, im.height // 32
        if w and h_: blocks.append(('sheet', s, w, h_, [im.crop((x * 32, y * 32, x * 32 + 32, y * 32 + 32)) for y in range(h_) for x in range(w)]))
    auto_blocks = {}
    for k, r in sorted(autos.items(), key=lambda kv: (kv[1].name, kv[0])):
        uniq, mask_to = [], {}
        seen = {}
        for mask in range(256):
            c = r.image(mask); hh = h(c)
            if hh not in seen: seen[hh] = len(uniq); uniq.append(c)
            mask_to[mask] = seen[hh]
        w = 8; blocks.append(('auto', k, w, -(-len(uniq) // w), uniq + [None] * (w * -(-len(uniq) // w) - len(uniq))))
        auto_blocks[k] = dict(ref=r, mask_to=mask_to, n=len(uniq))
    # 2) 선반 배치 (높이 내림차순), 조각은 맨 아래 줄부터
    order = sorted(range(len(blocks)), key=lambda i: (-blocks[i][3], -blocks[i][2], blocks[i][1] if isinstance(blocks[i][1], str) else str(blocks[i][1])))
    origin, y, x, shelf = {}, 0, 0, 0
    for i in order:
        _, _, w, h_, _ = blocks[i]
        if x + w > COLS: y += shelf; x, shelf = 0, 0
        origin[i] = (x, y); x += w; shelf = max(shelf, h_)
    derived_y = y + shelf
    cells = {}  # id -> PIL
    sheet_origin, auto_id = {}, {}
    for i, (kind, k, w, h_, cl) in enumerate(blocks):
        ox, oy = origin[i]
        for j, c in enumerate(cl):
            if c is None: continue
            cells[(oy + j // w) * COLS + ox + j % w] = c
        if kind == 'sheet': sheet_origin[k] = (ox, oy, w, h_)
        else: auto_id[k] = {mask: (oy + t // w) * COLS + ox + t % w for mask, t in auto_blocks[k]['mask_to'].items()}
    by_hash = {}
    for i in sorted(cells):
        by_hash.setdefault(h(cells[i]), i)
    derived = []
    def piece(c):
        hh = h(c)
        if hh == EMPTY: return -1
        i = by_hash.get(hh)
        if i is None:
            i = derived_y * COLS + len(derived); derived.append(c); cells[i] = c; by_hash[hh] = i
        return i
    def tile_id(r):
        if type(r) is pawlib.tile and r.name in sheet_origin:
            ox, oy, w, h_ = sheet_origin[r.name]
            if r.cx < w and r.cy < h_: return (oy + r.cy) * COLS + ox + r.cx
        return piece(r.image())
    use = {}  # id -> dict(lower, solid, upper, cover)
    def note(i, layer, solid):
        if i < 0: return
        u = use.setdefault(i, {'lower': 0, 'upper': 0, 'solid': False})
        u[layer] += 1; u['solid'] |= solid
    def cover(i): return cells[i].getchannel('A').point(lambda v: 255 if v > 128 else 0).histogram()[255]

    # 3) 오브젝트와 맵
    objects, obj_by_hash = [], {}
    out_maps = []
    for rec in recs:
        m = rec['m']; W, H = m.w, m.h
        lower, stacks = [-1] * (W * H), [[] for _ in range(W * H)]
        for yy in range(H):
            for xx in range(W):
                r = m.lo[yy][xx]
                if r is None: continue
                if is_auto(r):
                    mk = 0
                    for dx, dy, b in NB:
                        a, bb = xx + dx, yy + dy
                        if not m._ok(a, bb) or same(m.lo[bb][a], r): mk |= b
                    i = auto_id[ref_key(r)][mk]
                else: i = tile_id(r)
                lower[yy * W + xx] = i
                cls = m.cls[yy][xx] if m.cls else 'F'
                note(i, 'lower', cls in 'CW')
        for yy in range(H):
            for xx in range(W):
                for r in m.up[yy][xx]:
                    if is_auto(r):
                        mk = 0
                        for dx, dy, b in NB:
                            a, bb = xx + dx, yy + dy
                            if not m._ok(a, bb) or any(same(q, r) for q in m.up[bb][a]): mk |= b
                        i = auto_id[ref_key(r)][mk]
                    else: i = tile_id(r)
                    if i >= 0: stacks[yy * W + xx].append(i); note(i, 'upper', False)
        placed = []
        for (px, py, im), lab, hint in zip(m.over, m.over.labels, m.over.hints):
            ox, oy = px // 32, py // 32
            if px % 32 or py % 32:   # 칸 사이에 놓인 조각: 칸 격자에 맞춰 다시 앉힌 뒤 자른다
                pad = Image.new('RGBA', (px % 32 + im.width, py % 32 + im.height)); pad.alpha_composite(im, (px % 32, py % 32)); im = pad
            ow, oh = -(-im.width // 32), -(-im.height // 32)
            rows = [[-1] * ow for _ in range(oh)]
            for cx, cy, c in cells_of(im):
                i = piece(c); rows[cy][cx] = i
                if i < 0: continue
                note(i, 'upper', cover(i) > 400)
                mx, my = ox + cx, oy + cy
                if 0 <= mx < W and 0 <= my < H: stacks[my * W + mx].append(i)
            oh_ = h(im)
            o = obj_by_hash.get(oh_)
            if o is None:
                o = dict(id=f'{key}_{len(objects):03d}', hash=oh_[:16], name=NAMES.get(oh_[:16]) or object_name(lab), autoName=object_name(lab),
                         hint=hint, kind=lab[0], source=lab[1] if len(lab) > 1 else '',
                         width=ow, height=oh, pxWidth=im.width, pxHeight=im.height, upper=rows, maps=[], uses=0)
                obj_by_hash[oh_] = o; objects.append(o)
            o['uses'] += 1
            if m.id not in o['maps']: o['maps'].append(m.id)
            placed.append({'object': o['id'], 'x': ox, 'y': oy})
        upper = [s[0] if s else -1 for s in stacks]
        extra = {str(i): s[1:] for i, s in enumerate(stacks) if len(s) > 1}
        # 장소 킷은 아래층·위층 두 줄만 담는다 — 위층이 두 겹인 칸은 겹친 그림을 조각 하나로 합성해 싣는다
        place_upper = list(upper)
        for k, s in enumerate(stacks):
            if len(s) > 1:
                c = Image.new('RGBA', (32, 32))
                for i in s: c.alpha_composite(cells[i])
                place_upper[k] = piece(c); note(place_upper[k], 'upper', False)
        out_maps.append(dict(m=m, full=rec['full'], lower=lower, upper=upper, stacks=extra, place_upper=place_upper, objects=placed))
    # 4) 아틀라스
    rows_total = derived_y + -(-len(derived) // COLS)
    count = rows_total * COLS
    atlas = Image.new('RGBA', (COLS * 32, rows_total * 32))
    for i, c in cells.items(): atlas.alpha_composite(c, ((i % COLS) * 32, (i // COLS) * 32))
    # 5) 재구성 비교: 아틀라스 + 층 번호만으로 다시 그려 갤러리 렌더와 비교
    def cell(i): return atlas.crop(((i % COLS) * 32, (i // COLS) * 32, (i % COLS) * 32 + 32, (i // COLS) * 32 + 32))
    worst = 0
    for om in out_maps:
        m = om['m']; W, H = m.w, m.h; img = Image.new('RGBA', (W * 32, H * 32), (0, 0, 0, 255))
        for k in range(W * H):
            pos = ((k % W) * 32, (k // W) * 32)
            for i in [om['lower'][k], om['upper'][k], *om['stacks'].get(str(k), [])]:
                if i >= 0: img.alpha_composite(cell(i), pos)
        kimg = Image.new('RGBA', (W * 32, H * 32), (0, 0, 0, 255))
        for k in range(W * H):
            for i in (om['lower'][k], om['place_upper'][k]):
                if i >= 0: kimg.alpha_composite(cell(i), ((k % W) * 32, (k // W) * 32))
        ref = om['full'].convert('RGB')
        gal = os.path.join(pawlib.OUT, m.id + '.png')
        if os.path.exists(gal): ref = Image.open(gal).convert('RGB')
        d = max(max(b[1] for b in ImageChops.difference(x.convert('RGB'), ref).getextrema()) for x in (img, kimg))
        if d > 4: raise AssertionError(f'{m.id} rebuild differs by {d}/255')
        om['rebuildDiff'] = d; worst = max(worst, d)
    # 6) 칸 정보
    label, shared_of = {}, {}
    for s, (ox, oy, w, h_) in sheet_origin.items():
        sm = shared_match(s)
        if sm: shared_of[s] = sm
        for j in range(w * h_): label[(oy + j // w) * COLS + ox + j % w] = ('sheet', s, j)
    for k, ids in auto_id.items():
        for t in set(ids.values()): label.setdefault(t, ('auto', k[1], None))
    for j in range(len(derived)): label[derived_y * COLS + j] = ('piece', None, j)
    tiles = []
    for i in range(count):
        c = cells.get(i); u = use.get(i)
        lab = label.get(i)
        transparent = c is None or c.getchannel('A').getextrema()[0] < 255
        layer = ('lower' if u['lower'] >= u['upper'] else 'upper') if u else ('upper' if transparent else 'lower')
        solid = bool(u and (u['solid'] or (u['upper'] and not u['lower'] and cover(i) > 400)))
        if lab is None: text, desc = '빈 칸', '비어 있는 칸'
        elif lab[0] == 'sheet': text, desc = f'{stem(lab[1])} {lab[2]}', f'원본 {lab[1]} 의 {lab[2]}번 칸'
        elif lab[0] == 'auto': text, desc = f'{stem(lab[1])} 자동타일', f'원본 {lab[1]} 자동타일 변형 칸'
        else: text, desc = f'잘라낸 조각 {lab[2]}', '격자에 맞지 않는 원본 조각(문·가구·합성)을 32px 로 자른 칸'
        t = {'label': text, 'description': desc, 'layer': layer, 'passage': 'solid' if solid else 'passable',
             'used': bool(u), 'source': 'imported' if lab else 'unknown'}
        if lab and lab[0] == 'sheet' and lab[1] in shared_of:
            lid, tid, sd = shared_of[lab[1]]; j = lab[2]
            # 이미 검토된 공용 타일셋의 칸 규칙을 그대로 가져온다(같은 원본 칸 번호)
            t.update(sharedTileset=tid, sharedTile=j, passability=sd['passability'][j], priority=sd['priority'][j],
                     meta=(sd.get('tileMeta') or [None] * (j + 1))[j] if j < len(sd.get('tileMeta') or []) else None)
        tiles.append(t)
    autotiles = []
    for k, ids in auto_id.items():
        members = sorted(set(ids.values()))
        autotiles.append({'id': f'{key}_auto_{len(autotiles):02d}', 'name': f'자동타일 · {stem(k[1])}', 'sheet': k[1],
                          'memberTileIds': members, 'variantMap': {str(mk): t for mk, t in ids.items()}})
    # 오브젝트 미리보기: 합본 칸만으로 다시 그린다(칸 번호가 맞는지 함께 확인된다)
    for o in objects:
        pv = Image.new('RGBA', (o['width'] * 32, o['height'] * 32))
        for yy, row in enumerate(o['upper']):
            for xx, i in enumerate(row):
                if i >= 0: pv.alpha_composite(cell(i), (xx * 32, yy * 32))
        pb = io.BytesIO(); pv.save(pb, 'PNG', optimize=True)
        o['preview'] = 'data:image/png;base64,' + base64.b64encode(pb.getvalue()).decode()
    buf = io.BytesIO(); atlas.save(buf, 'PNG', optimize=True); raw = buf.getvalue()
    maps_json = []
    for om in out_maps:
        m = om['m']
        th = om['full'].copy(); th.thumbnail((480, 480)); tb = io.BytesIO(); th.convert('RGB').save(tb, 'PNG', optimize=True)
        maps_json.append({'id': m.id, 'name': m.title, 'width': m.w, 'height': m.h, 'kind': m.kind, 'note': m.note, 'sheets': sorted(m.used),
                          'lowerTiles': om['lower'], 'upperTiles': om['upper'], 'upperTileStacks': om['stacks'], 'placeUpperTiles': om['place_upper'], 'objects': om['objects'],
                          'port': entry(m), 'rebuildDiff': om['rebuildDiff'], 'tags': place_tags(m)[0], 'usage': place_tags(m)[1],
                          'preview': 'data:image/png;base64,' + base64.b64encode(tb.getvalue()).decode()})
    print(f'{key}: {len(recs)} maps, sheets {len(sheet_origin)}, autotiles {len(auto_id)}, pieces {len(derived)}, objects {len(objects)}, '
          f'atlas {COLS * 32}x{rows_total * 32} {len(raw) // 1024}KB, rebuild max {worst}/255')
    return {'key': key, 'name': gname, 'cols': COLS, 'count': count, 'atlas': 'data:image/png;base64,' + base64.b64encode(raw).decode(),
            'atlasSha': hashlib.sha256(raw).hexdigest(), 'width': COLS * 32, 'height': rows_total * 32, 'tiles': tiles,
            'sheets': [{'sheet': s, 'x': ox, 'y': oy, 'width': w, 'height': h_, 'firstTile': oy * COLS + ox,
                        **({'sharedLibrary': shared_of[s][0], 'sharedTileset': shared_of[s][1]} if s in shared_of else {})}
                       for s, (ox, oy, w, h_) in sorted(sheet_origin.items())],
            'pieces': {'firstRow': derived_y, 'count': len(derived)}, 'autotiles': autotiles, 'objects': objects, 'maps': maps_json,
            'rebuildMaxChannelDiff': worst}

KIND = {
    'exterior': ('장소유형:마을·도시', '공간형태:실외'), 'interior': ('장소유형:건물·시설', '공간형태:건물 내부'),
    'worldmap': ('장소유형:자연', '공간형태:실외'),
}
USAGE = {'m0': '도시', 'm1': '도시', 'm2': '주거', 'm3': '상업시설', 'm4': '공공시설', 'm5': '탐험', 'm6': '오락'}
SPECIAL = {'m50': ('장소유형:던전·유적', '공간형태:지하', '탐험'), 'm51': ('장소유형:던전·유적', '공간형태:지하', '탐험'),
           'm52': ('장소유형:자연', '공간형태:실외', '월드맵'), 'm53': ('장소유형:자연', '공간형태:실외', '월드맵'),
           'm59': ('장소유형:건물·시설', '공간형태:건물 내부', '종교'), 'm12': ('장소유형:건물·시설', '공간형태:실외', '종교'),
           'm27': ('장소유형:건물·시설', '공간형태:건물 내부', '목욕탕'), 'm02': ('장소유형:마을·도시', '공간형태:실외', '목욕탕')}
def place_tags(m):
    p = m.id[:3]
    t, space, use = SPECIAL.get(p) or (*KIND.get(m.kind, KIND['interior']), USAGE.get(p[:2], '시설'))
    return [t, space], use

def entry(m):
    if m.cls:
        ds = [(x, y) for y in range(m.h) for x in range(m.w) if m.cls[y][x] == 'D']
        if ds: x, y = max(ds, key=lambda p: p[1]); return {'x': x, 'y': y}
    return {'x': m.w // 2, 'y': m.h - 1}

groups = [build_group(k, n, [r for r in runs if group_of(r['m'].id) == k]) for k, n, _ in GROUPS]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({'groups': groups, 'rebuildMaxChannelDiff': max(g['rebuildMaxChannelDiff'] for g in groups)}, open(OUT, 'w'), ensure_ascii=False)
print(f'pack {sum(len(g["maps"]) for g in groups)} maps -> {OUT}')
