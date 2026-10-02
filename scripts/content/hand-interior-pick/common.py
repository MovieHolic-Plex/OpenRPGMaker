# 16px 손 도트 실내 기물 「후보 찍기 → 사용자가 고르기」 하네스 공통 경로·도우미.
# 정본 v5(tiledata/hand-interior/v5)는 읽기만 한다. 산출물은 전부 tiledata/hand-interior/pick/ 아래.
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
PICK = os.path.join(ROOT, 'tiledata/hand-interior/pick')
CAND = os.path.join(PICK, 'candidates')
PAL_DIR = os.path.join(PICK, 'palette')
SHARED_PAL = os.path.join(PAL_DIR, 'v5.pal')
PXGRID = os.path.join(ROOT, 'scripts/content/pixel-harness/pxgrid')
HARNESS = os.path.join(ROOT, 'scripts/content/pixel-harness')
WORKER_RE = re.compile(r'^(w[0-9]{1,3}|h[0-9]{1,4}|pilot)-([A-Z])\.pxg$')   # 작업자 id(w1…w999, 소품 하네스 판 h1…, pilot) + 방향 글자

def slug(i):
    return re.sub(r'[^A-Za-z0-9]+', '_', i).strip('_')

NEW_ITEMS = os.path.join(ROOT, 'tiledata/hand-interior/new/items.json')   # 새 기물 길: v5 381개 밖의 기물 명세
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
            **{k: it[k] for k in ('use', 'facing', 'states', 'place', 'pair', 'refs') if it.get(k)}}

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
        seen.add(slug(i)); out.append(new_item_object(it))
    return out

def load_meta(include_new=True):
    """v5 메타. include_new 면 새 기물(new:True 가짜 객체)도 objects 끝에 붙인다. v5 파일은 읽기만 한다."""
    m = json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))
    if include_new:
        m = dict(m, objects=m['objects'] + load_new_items({o['id'] for o in m['objects']}))
    return m

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
    if o.get('new'):   # 새 기물은 v5 에 그림이 없다: 캔버스 크기의 투명 그림이 출발점
        from PIL import Image
        return Image.new('RGBA', (a['w'], a['h']))
    return v5_atlas().crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))

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
    return dict(canvas=[int(w), int(h)], footprint=r.get('footprint'), why=r.get('why', ''))

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
    fh = int((o.get('footprint') or {}).get('h') or 1)
    return TOP_MIN_SHALLOW if fh <= 1 else TOP_PER_DEPTH * (fh - 1)

def top_rule_text(o):
    """작업지시서·검수 지시문에 그대로 넣는 한 줄."""
    n = top_min(o)
    if n is None: return ''
    fh = int((o.get('footprint') or {}).get('h') or 1)
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
    return []
