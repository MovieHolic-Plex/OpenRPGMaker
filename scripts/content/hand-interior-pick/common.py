# 16px 손 도트 실내 기물 「후보 찍기 → 사용자가 고르기」 하네스 공통 경로·도우미.
# 정본 v5(tiledata/hand-interior/v5)는 읽기만 한다. 산출물은 전부 tiledata/hand-interior/pick/ 아래.
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
PICK = os.path.join(ROOT, 'tiledata/hand-interior/pick')
CAND = os.path.join(PICK, 'candidates')
PAL_DIR = os.path.join(PICK, 'palette')
V5_PAL = os.path.join(PAL_DIR, 'v5.pal')       # v5 재료 램프(make_palette.py 가 만든다)
SHARED_PAL = os.path.join(PAL_DIR, 'v6.pal')   # 실내 공통 팔레트 = v5 + 시트 색 128(2026-10-03). 시트 굽기도 이 색으로 옮긴다
PXGRID = os.path.join(ROOT, 'scripts/content/pixel-harness/pxgrid')
HARNESS = os.path.join(ROOT, 'scripts/content/pixel-harness')
WORKER_RE = re.compile(r'^(w[0-9]{1,3}|h[0-9]{1,4}|pilot)-([A-Z])\.pxg$')   # 작업자 id(w1…w999, 소품 하네스 판 h1…, pilot) + 방향 글자

def slug(i):
    return re.sub(r'[^A-Za-z0-9]+', '_', i).strip('_')

NEW_ITEMS = os.path.join(ROOT, 'tiledata/hand-interior/new/items.json')   # 새 기물 길: v5 381개 밖의 기물 명세
SETS = os.path.join(ROOT, 'tiledata/hand-interior/new/sets.json')   # 파생 묶음(방향·상태·움직임) — 하네스 안에서만 쓰는 묶음 그림 기물(src/harnesses/interior-props/derive.py)
KIND_KO = {'floor': '바닥 기물(막힘)', 'wall': '북쪽 벽 앞 기물(막힘, 벽에 붙임)', 'hang': '벽면 걸이(벽 두 줄 중 윗줄)', 'flat': '바닥 무늬(밟을 수 있음)'}

def new_item_object(it):
    """items.json 항목 하나 → v5 메타 객체 모양의 가짜 객체(new:True). v5 meta.meta_for 의 kind_ko·cells·placement 규칙을 그대로 쓴다.
    아틀라스 자리가 없으므로 atlas = {x:-1,y:-1,w,h = 캔버스, frames:1, padTop:0}. 솟는 높이 up = 캔버스 높이 − 발밑 칸 높이(floor·wall), hang·flat 은 0."""
    i = it['id']; k = it['kind']; fp = it['footprint']; fw, fh = int(fp['w']), int(fp['h']); w, h = [int(v) for v in it['canvas']]
    if k not in KIND_KO: raise SystemExit(f'{i}: kind {k!r} 는 floor/wall/hang/flat 중 하나여야 한다')
    if w != fw * 16: raise SystemExit(f'{i}: 캔버스 폭 {w} != 칸 수 {fw} × 16')
    if h % 16: raise SystemExit(f'{i}: 캔버스 높이 {h} 가 16 의 배수가 아니다')
    if k == 'hang' and fh != 0: raise SystemExit(f'{i}: hang 의 footprint.h 는 0')
    if k == 'flat' and h != fh * 16: raise SystemExit(f'{i}: flat 의 캔버스 높이 {h} != {fh} × 16')
    if k in ('floor', 'wall') and h < fh * 16: raise SystemExit(f'{i}: 캔버스 높이 {h} < 발밑 {fh} × 16')
    up = h - fh * 16 if k in ('floor', 'wall') else 0
    over = (up + 15) // 16
    rows = ['X' * fw if k in ('floor', 'wall') else '.' * fw for _ in range(fh)]
    rules = []
    if k == 'wall': rules.append('발밑 줄이 북쪽 벽면 바로 아래 첫 바닥 줄이어야 한다')
    if k == 'hang': rules.append('벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다')
    if k == 'flat': rules.append('밟을 수 있다. 다른 기물 밑에 먼저 깐다')
    if up and k != 'hang': rules.append(f'그림이 발밑 칸 위로 {up}px 솟는다 → 위 {over}칸은 플레이어 위에 그리는 겹침층')
    if k in ('floor', 'wall'): rules.append('출입문 칸과 문으로 이어지는 통로를 막지 않는다')
    desc = it['description']; head, sep, tail = desc.partition('. ')
    return {'id': i, 'name_ko': it['name_ko'], 'name_en': it.get('name_en', i), 'category': it['category'],
            'category_ko': it['category_ko'], 'tags': list(it.get('tags', [])), 'description': desc,
            'kind': k, 'kind_ko': KIND_KO[k], 'footprint': {'w': fw, 'h': fh}, 'image': {'w': w, 'h': h}, 'overhang_px': up,
            'cells': {'floor': rows, 'overlayRowsAbove': over}, 'placement': rules, 'related': [], 'variantGroup': i,
            'atlas': {'x': -1, 'y': -1, 'w': w, 'h': h, 'frames': 1, 'padTop': 0},
            'summary': (head + '.') if sep else desc, 'where': tail, 'since': 'v6 새 기물',
            'new': True, 'contextRoom': it.get('contextRoom'),
            **{k: it[k] for k in ('use', 'facing', 'states', 'place', 'pair', 'refs', 'blockout', 'parent', 'derive', 'slot') if it.get(k)}}

def load_new_items(v5_ids=None):
    """tiledata/hand-interior/new/items.json → 가짜 객체 목록. v5 id·slug 와 겹치면 에러."""
    if not os.path.exists(NEW_ITEMS): return []
    d = json.load(open(NEW_ITEMS, encoding='utf-8'))
    if v5_ids is None:
        v5_ids = {o['id'] for o in json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))['objects']}
    v5_slugs = {slug(i) for i in v5_ids}; out = []; seen = set()
    for it in d.get('items', []):
        i = it['id']
        if i in v5_ids or slug(i) in v5_slugs: raise SystemExit(f'새 기물 id {i!r} 가 v5 기물과 겹친다 (new/items.json)')
        if slug(i) in seen: raise SystemExit(f'새 기물 id {i!r} 가 new/items.json 안에서 겹친다')
        seen.add(slug(i)); out.append(apply_resize(new_item_object(it)))
    if os.path.exists(SETS):   # 파생 묶음: 같은 새 기물 모양 + set(칸 자리). 칩셋에는 안 굽는다(install_picks 가 건너뛴다)
        for e in json.load(open(SETS, encoding='utf-8')).get('sets', []):
            if slug(e['id']) in seen or slug(e['id']) in v5_slugs: raise SystemExit(f'파생 묶음 id {e["id"]!r} 가 다른 기물과 겹친다')
            seen.add(slug(e['id']))
            o = new_item_object(e)
            o['set'] = {k: e.get(k) for k in ('parent', 'derive', 'slots', 'ms', 'picked', 'canvas')}
            o['kind_ko'] = f"파생 묶음 · {o['kind_ko']}"
            out.append(o)
    return out

_META = {}
def load_meta(include_new=True):
    """v5 메타. include_new 면 새 기물(new:True 가짜 객체)도 objects 끝에 붙인다. v5 파일은 읽기만 한다.
    세 파일(메타·새 기물 명세·크기 바꿈 표시)의 시각이 그대로면 지난 결과를 쓴다 — 그림·상태 요청마다 불려
    한 번 30ms+ 씩 서버를 막았다(2026-10-03 「이미지 로딩 느림」). 객체는 얕은 사본으로 돌려 부르는 쪽이 고쳐도 캐시는 그대로."""
    def mt(f):
        try: return os.stat(f).st_mtime_ns
        except OSError: return 0
    k = (include_new, mt(os.path.join(V5, 'interior-meta.json')), mt(NEW_ITEMS), mt(RESIZE_STAMP), mt(SETS))
    if _META.get(include_new, (None,))[0] != k:
        m = json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))
        if include_new:
            m = dict(m, objects=[apply_resize(o) for o in m['objects']] + load_new_items({o['id'] for o in m['objects']}))
        _META[include_new] = (k, m)
    m = _META[include_new][1]
    return dict(m, objects=[dict(o) for o in m['objects']])

def objects_by_id():
    return {o['id']: o for o in load_meta()['objects']}

def objects_by_slug():
    return {slug(o['id']): o for o in load_meta()['objects']}

_ATLAS = None
def v5_atlas():
    global _ATLAS
    if _ATLAS is None:
        from PIL import Image
        _ATLAS = Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA')
    return _ATLAS

def v5_slot(o):
    """v5 아틀라스의 칸 자리(패딩 포함, 첫 프레임). 후보 캔버스 크기 = 이 크기."""
    a = o['atlas']
    from PIL import Image
    if o.get('set'):   # 파생 묶음: 원본 칸을 채운 출발 그림(derive.make_set 이 만든 seed.png)
        p = os.path.join(CAND, slug(o['id']), 'seed.png')
        if os.path.exists(p): return Image.open(p).convert('RGBA')
    if o.get('new'):   # 새 기물은 v5 에 그림이 없다: 캔버스 크기의 투명 그림이 출발점
        return Image.new('RGBA', (a['w'], a['h']))
    im = v5_atlas().crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))
    rz = resize_for(slug(o['id']))
    if rz and tuple(rz['canvas']) != im.size:   # 크기를 바꾼 v5 기물: 지금 그림을 새 캔버스 바닥 가운데에 두고 출발
        c = Image.new('RGBA', tuple(rz['canvas']))
        c.paste(im, ((c.width - im.width) // 2, c.height - im.height), im)   # 넘치면 잘린다(바닥 가운데 맞춤)
        return c
    return im

def resize_for(s):
    """사용자가 크기를 바꾸라고 한 기물: candidates/<slug>/resize.json = {"canvas":[w,h],"footprint":{"w":2,"h":0},"why":"…"}.
    없으면 None → 기존 동작(v5 칸 자리 크기) 그대로."""
    p = os.path.join(CAND, s, 'resize.json')
    if not os.path.exists(p): return None
    try:
        r = json.load(open(p, encoding='utf-8'))
        w, h = r['canvas']; assert int(w) > 0 and int(h) > 0
    except (ValueError, KeyError, TypeError, AssertionError, OSError):
        return None
    return dict(canvas=[int(w), int(h)], footprint=r.get('footprint'), why=r.get('why', ''),
                blockout=r.get('blockout'), top_note=r.get('top_note', ''))

RESIZE_STAMP = os.path.join(CAND, '.resize-stamp')   # resize.json 을 쓰면 건드린다 — 메타 캐시가 이 시각도 본다

def apply_resize(o):
    """resize.json 이 있는 기물은 칸 수·(새 기물이면) 캔버스·밑그림·윗면 규칙 문장까지 그 크기로 본다.
    2026-10-03: 고르는 화면 메모 「2x2 로 만들어」 가 작업지시서 글로만 가고 캔버스(16×32)·검사는 그대로라 작동하지 않았다."""
    rz = resize_for(slug(o['id']))
    if not rz: return o
    o = dict(o)
    if rz['footprint']: o['footprint'] = dict(rz['footprint'])
    if o.get('new'):
        o['atlas'] = dict(o['atlas'], w=rz['canvas'][0], h=rz['canvas'][1], padTop=0)
        o['image'] = {'w': rz['canvas'][0], 'h': rz['canvas'][1]}
    if rz.get('blockout'): o['blockout'] = rz['blockout']
    if rz.get('top_note'): o['description'] = o['description'].rstrip() + ' ' + rz['top_note']
    return o

SIZE_RE = re.compile(r'(\d{1,2})\s*(?:칸)?\s*[xX×*]\s*(\d{1,2})')

def size_from_note(note):
    """메모에서 「2x2」「3×2」 같은 크기 요청(가로×세로 칸)을 찾는다. 없거나 말이 안 되면 None."""
    m = SIZE_RE.search(note or '')
    if not m: return None
    w, h = int(m.group(1)), int(m.group(2))
    return (w, h) if 1 <= w <= 8 and 1 <= h <= 8 else None

def resize_spec(o, w, h, why):
    """기물 o 를 가로 w × 세로 h 칸으로 — resize.json 내용. 바닥 기물은 깊이 h 칸 + 원래 솟음, 매다는 것(발밑 0칸)은 그림 높이 h 칸."""
    fp = o['footprint']; fh0 = int(fp.get('h') or 0)
    cw0, ch0 = (o['atlas']['w'], o['atlas']['h']) if o.get('new') else geom(o)['canvas']
    if fh0 == 0:
        footprint, canvas = {'w': w, 'h': 0}, [16 * w, 16 * h]
    else:
        rise = max(0, ch0 - 16 * fh0)
        footprint, canvas = {'w': w, 'h': h}, [16 * w, 16 * h + rise]
    spec = {'canvas': canvas, 'footprint': footprint, 'why': why}
    probe = dict(o, footprint=footprint)
    n = top_min(probe)
    if n and h >= 2 and fh0 != 0:
        spec['top_note'] = f'(크기 {w}×{h}: 꼭대기 윗면 {n}행 이상 — 위에서 내려다본 면이 깊이만큼 길다)'
        if w * h >= BIG_AREA:   # 대형: 밑그림 띠가 있어야 판이 열린다 — 앞면 = 맨 아래 솟음 높이, 윗면 = 그 위 n+2 행
            H = canvas[1]; fr = max(8, canvas[1] - 16 * h); c = H - fr; a = max(0, c - n - 2)
            spec['blockout'] = {'top': [a, c - 1], 'front': [c, H - 1], 'cover': 0.7}
    return spec

def write_resize(o, w, h, why):
    """resize.json 을 쓰고 후보 폴더를 다시 준비하게 한다(info.json 지움 → ensure_folder 가 새 캔버스로 prep)."""
    d = os.path.join(CAND, slug(o['id'])); os.makedirs(d, exist_ok=True)
    spec = resize_spec(o, w, h, why)
    atomic_write(os.path.join(d, 'resize.json'), json.dumps(spec, ensure_ascii=False))
    try: os.remove(os.path.join(d, 'info.json'))
    except OSError: pass
    atomic_write(RESIZE_STAMP, now_stamp())
    return spec

def now_stamp():
    import time
    return str(time.time())

def geom(o):
    """후보가 따라야 할 캔버스·패딩·칸 수. resize.json 이 있으면 그 값(패딩 0), 없으면 v5 그대로."""
    rz = resize_for(slug(o['id']))
    if rz:
        return dict(canvas=rz['canvas'], padTop=0, footprint=rz['footprint'] or o['footprint'], resized=rz)
    a = o['atlas']
    return dict(canvas=[a['w'], a['h']], padTop=a['padTop'], footprint=o['footprint'], resized=None)

def atomic_write(path, text):
    tmp = path + '.tmp%d' % os.getpid()
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)

def v5_modules():
    """v5 방 조립 스크립트(rooms4·room4)를 불러온다. 스크립트가 상대 경로를 쓰므로 cwd 를 저장소 루트로."""
    os.chdir(ROOT)
    if V5 not in sys.path:
        sys.path.insert(0, V5)
    import rooms4, room4  # noqa
    return rooms4, room4

# ── 꼭대기 면 규칙(3/4 시점) — 하네스·검사·검수가 같이 쓰는 한 곳 ───────────────────────────────────────────────
# 2026-10-02: 대형 기물(기차·마차 6×2·4×2)을 「꼭대기 윗면 4행」으로 주문했더니 25장이 전부 옆모습(측면도)으로 나왔고
# 검수도 「4행」을 그대로 통과시켰다. 3행은 깊이 1칸 가구(책장·옷장)의 최소치다. 발밑이 남북으로 깊으면 위에서 내려다본
# 윗면도 그만큼 길어야 한다 — 칩셋 실측: 4×2 식탁 상판 24행, 마도 기관 3×2 윗면 약 10~12행, 2×2 작전 탁자 9~10행.
TOP_MIN_SHALLOW = 3   # 발밑 깊이 1칸(또는 벽 앞 기물)
TOP_PER_DEPTH = 10    # 깊이 2칸 이상: (깊이 − 1) × 10 행
TOP_CLAIM_RE = re.compile(r'꼭대기\s*윗면\s*(\d+)\s*행\s*\(\s*y\s*=\s*(\d+)\s*[~\-–]\s*(\d+)\s*\)')
SPEC_TOP_RE = re.compile(r'꼭대기\s*윗면\s*(\d+)(?:\s*~\s*(\d+))?\s*행')

def top_min(o):
    """꼭대기 면(가장 높은 수평 면 — 지붕·상판·뚜껑·받침) 윗면 최소 행 수. 바닥 기물·벽 앞 기물만, 나머지(걸이·바닥 무늬)는 None."""
    if o.get('kind') not in ('floor', 'wall'): return None
    if o.get('set'): return None   # 파생 묶음: 칸마다 원본 칸과 같은 윗면이 기준이다(검수 지시문이 말한다) — 2026-10-04 의자 등받이 머리 1행이 「3행 미만」으로 떨어졌다
    fh = int((o.get('footprint') or {}).get('h') or 1)
    return TOP_MIN_SHALLOW if fh <= 1 else TOP_PER_DEPTH * (fh - 1)

def top_rule_text(o):
    """작업지시서·검수 지시문에 그대로 넣는 한 줄."""
    n = top_min(o)
    if n is None: return ''
    fh = int((o.get('footprint') or {}).get('h') or 1)
    b = o.get('blockout')
    if b:
        (t0, t1) = b['top']
        return (f'이 기물은 3/4 밑그림이 있다 → **주 윗면(밑그림 윗면 띠 y={t0}~{t1}, {t1 - t0 + 1}행)** 이 위에서 내려다본 면이어야 한다(최소 {n}행). '
                f'그 위로 솟는 부품(틀 가로보·굴뚝·돔·조각·날개)은 이 행 수 규칙이 아니다 — 그 부품은 윗면이 조금이라도 보이면 된다. top_rows·top_y 는 주 윗면을 잰다.')
    if fh <= 1: return f'이 기물의 꼭대기 윗면 최소 {n}행(발밑 깊이 1칸).'
    return (f'이 기물은 발밑이 남북으로 {fh}칸 깊다 → **꼭대기 윗면 최소 {n}행**. 위에서 내려다본 지붕·상판·받침이 긴 면으로 보여야 한다. '
            f'지붕·상판이 몇 행짜리 띠로만 보이는 옆모습(측면도)은 무조건 떨어진다.')

def parse_top_claim(note):
    """작업자 메모의 `꼭대기 윗면 N행(y=a~b)` → (N, a, b) 또는 None."""
    m = TOP_CLAIM_RE.search(note or '')
    return tuple(int(g) for g in m.groups()) if m else None

def spec_top_lint(o):
    """명세(설명) 검사 — 깊은 기물(발밑 깊이 2칸 이상)은 설명에 `꼭대기 윗면 N행` 이 있어야 하고 N 이 규칙 이상이어야 한다.
    설명이 곧 작업자 명세라, 여기서 모자라게 쓰면 작업자는 그대로 옆모습을 그린다(2026-10-02 기관차)."""
    n = top_min(o); fh = int((o.get('footprint') or {}).get('h') or 1)
    if n is None or fh <= 1: return []
    got = [int(b or a) for a, b in SPEC_TOP_RE.findall(o.get('description') or '')]
    if not got: return [f"{o['id']}: 설명에 「꼭대기 윗면 N행」이 없다 — 발밑 깊이 {fh}칸이면 {n}행 이상을 적는다"]
    if max(got) < n: return [f"{o['id']}: 설명의 꼭대기 윗면 {max(got)}행 < {n}행(발밑 깊이 {fh}칸 규칙) — 이대로면 옆모습이 나온다"]
    return blockout_lint(o)

BIG_AREA = 6   # 발밑 칸 수가 이 이상인 깊은 기물(대형)은 3/4 밑그림(blockout)이 있어야 판을 연다

def blockout_lint(o):
    """대형 깊은 기물의 3/4 밑그림 검사. blockout = {top:[a,b], front:[c,d], cover:0.7} — 캔버스 y 좌표.
    top = 위에서 내려다본 주 윗면 띠, front = 그 아래 남쪽 면 띠, cover = 그 띠 줄들이 물건 폭을 채워야 하는 비율.
    작업자가 고르는 것이 아니라 명세가 정한다 — 그래서 옆면 한가운데를 윗면이라 우길 수 없다."""
    fp = o.get('footprint') or {}; fw, fh = int(fp.get('w') or 1), int(fp.get('h') or 1); b = o.get('blockout')
    if o.get('kind') not in ('floor', 'wall') or fh < 2 or fw * fh < BIG_AREA:
        return [] if not b else _blockout_shape(o, b)
    if not b: return [f"{o['id']}: 대형 깊은 기물({fw}×{fh})인데 3/4 밑그림(blockout: top·front·cover)이 없다"]
    return _blockout_shape(o, b)

def _blockout_shape(o, b):
    H = int((o.get('image') or o.get('atlas') or {}).get('h') or 0); n = top_min(o) or 0
    try:
        (a, bb), (c, d) = b['top'], b['front']; cov = float(b.get('cover', 0.7))
    except (KeyError, TypeError, ValueError):
        return [f"{o['id']}: blockout 꼴이 틀렸다 — {{top:[a,b], front:[c,d], cover}}"]
    errs = []
    if not (0 <= a <= bb < c <= d < (H or 10 ** 6)): errs.append(f"{o['id']}: blockout 범위가 이상하다 top={b['top']} front={b['front']} 캔버스 높이 {H}")
    if bb - a + 1 < n: errs.append(f"{o['id']}: blockout 윗면 {bb - a + 1}행 < 규칙 {n}행")
    if not 0.3 <= cov <= 1: errs.append(f"{o['id']}: blockout cover {cov} 는 0.3~1")
    return errs

def blockout_image(o, scale=8):
    """밑그림 그림(작업자·검수자용): 윗면 띠 = 밝은 회색, 남쪽 면 띠 = 어두운 회색, 그 위 = 솟는 것(굴뚝·돔·조각) 자리 빗금.
    8배, 16px 마다 칸 선, 띠 경계 y 를 적는다."""
    from PIL import Image, ImageDraw
    b = o['blockout']; W = int((o.get('image') or o['atlas'])['w']); H = int((o.get('image') or o['atlas'])['h']); S = scale
    im = Image.new('RGBA', (W * S, H * S), (150, 120, 90, 255)); dr = ImageDraw.Draw(im)
    (a, bb), (c, d) = b['top'], b['front']
    for y in range(0, a * S, 6): dr.line([(0, y), (W * S, y + W * S // 4)], fill=(170, 140, 110, 255))
    dr.rectangle([S, a * S, (W - 1) * S - 1, (bb + 1) * S - 1], fill=(214, 214, 205, 255), outline=(40, 40, 50, 255), width=2)
    dr.rectangle([S, c * S, (W - 1) * S - 1, (d + 1) * S - 1], fill=(110, 105, 112, 255), outline=(40, 40, 50, 255), width=2)
    for x in range(0, W * S, 16 * S): dr.line([(x, 0), (x, H * S)], fill=(0, 0, 0, 90))
    for y in range(H * S, -1, -16 * S): dr.line([(0, y), (W * S, y)], fill=(0, 0, 0, 90))
    for y, t in ((a, f'top y={a}'), (bb, f'~{bb} ({bb - a + 1}rows)'), (c, f'front y={c}'), (d, f'~{d}')):
        dr.text((S * 2, y * S + 2), t, fill=(200, 20, 20, 255))
    return im

