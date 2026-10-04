# 16px 생성 칩셋(atlas_biome_*, family oprn-atlas) 조각 「후보 찍기 → 사용자가 고르기」 하네스 공통 경로·도우미.
# 16px 실내(hand-interior-pick, 포트 18302)의 사본을 세트(현대·일본 …) 단위로 일반화한 것. 그 하네스와 데이터는 건드리지 않는다.
# 세트 목록 = tiledata/atlas-pick/sets.json : [{id, name, items(목록 JSON), candidates(후보 폴더), baseline('v0'|null)}]
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
BASE = os.path.join(ROOT, 'tiledata/atlas-pick')
PAL_DIR = os.path.join(BASE, 'palette')
PXGRID = os.path.join(ROOT, 'scripts/content/pixel-harness/pxgrid')
HARNESS = os.path.join(ROOT, 'scripts/content/pixel-harness')
MODERN_LIB = os.path.join(ROOT, 'scripts/content/lib/modern')
MODERN_SHEET = os.path.join(ROOT, 'public/assets/atlas-biomes/modern-chipset.png')
EASYRPG_LAST = 2729          # 시트 0~2729 = EasyRPG 계열 칸(폐기). 새 조각은 이 칸들을 쓰지도 닮지도 않는다
WORKER_RE = re.compile(r'^([a-z]{1,3}[0-9]{1,2}|pilot)-([A-Z])\.pxg$')   # 작업자 id(영문 1~3자 + 번호: j1 일본 · m1 현대 · w1 월드맵 · h1 호러 · s1 학원 …, pilot) + 방향 글자
LAYERS = {   # 층 id → (한국어, 배경이 투명해야 하나)
    'ground': ('바닥(아래층, 칸을 꽉 채운 불투명)', False),
    'decal': ('바닥 덧칠(아래층 위 투명 무늬)', True),
    'object': ('물체(위층, 투명 배경·바닥에 선다)', True),
    'wall': ('벽 걸이(위층, 투명 배경·벽면에 붙는다)', True),
    'facade': ('건물 외관 블록(불투명 허용)', False),
    'over': ('공중 덧칠(맨 위, 전선·가지 등 투명)', True),
    'kit': ('조립 킷 부품 시트(부품마다 층이 다르다 — kits-<세트>.json)', False),
}

def slug(i):
    return re.sub(r'[^A-Za-z0-9]+', '_', i).strip('_').lower()

def read_json(p, default=None):
    try:
        return json.load(open(p, encoding='utf-8'))
    except (OSError, ValueError):
        return default

def list_sets():
    return read_json(os.path.join(BASE, 'sets.json'), [])

def set_conf(s):
    for m in list_sets():
        if m['id'] == s: return m
    raise KeyError(s)

def cand_dir(s):
    return os.path.join(BASE, set_conf(s)['candidates'])

def kits_def(s):
    """sets.json 의 "kits": "kits-<세트>.json" (조립형 킷 정의). 없으면 None."""
    k = set_conf(s).get('kits')
    return read_json(os.path.join(BASE, k), None) if k else None

def kit_pack(kit, cols=8):
    """부품 시트 자리: 부품을 적힌 순서대로 선반 채우기(폭 cols 칸, 줄 높이 = 그 줄 가장 큰 부품). → ({slug: [cx, cy]}, [W칸, H칸])."""
    cols = max([cols] + [p['cells'][0] for p in kit['parts']])
    at = {}; x = y = sh = 0
    for p in kit['parts']:
        w, h = p['cells']
        if x + w > cols: y += sh; x = sh = 0
        at[p['slug']] = [x, y]; x += w; sh = max(sh, h)
    return at, [cols, y + sh]

def kit_workers(s):
    """jobs-<세트>-kit.json 의 workers → {킷 slug: 작업자}."""
    j = read_json(os.path.join(BASE, set_conf(s).get('kitJobs') or f'jobs-{s}-kit.json'), {}) or {}
    return {k: w for w, v in (j.get('workers') or {}).items() for k in (v.get('kits') or [])}

def kit_item(s, kit, kd=None):
    """킷 하나 → 고르는 화면 기물 한 개(kind='kit'). 후보 = 부품 시트 한 장(kN-A.pxg), 캔버스 = 시트 크기."""
    kd = kd or kits_def(s) or {}
    at, (W, H) = kit_pack(kit, kd.get('sheetCols', 8))
    parts = [dict(p, at=at[p['slug']]) for p in kit['parts']]
    return dict(id=kit['slug'], slug=kit['slug'], kind='kit', name=kit['name'], scene=kit.get('scene', ''), cells=[W, H], canvas=[W * 16, H * 16],
                layer='kit', layer_ko=LAYERS['kit'][0], description=kit.get('about', '') + f' (부품 {len(parts)} · 조립 예 {len(kit.get("examples", []))})',
                palette_hint=kit.get('palette_hint', ''), worker=kit_workers(s).get(kit['slug'], '-'), replaces=kit.get('replaces', []), aliases=kit.get('aliases', {}),
                contract=kit.get('contract', []), parts=parts, examples=kit.get('examples', []))

def items(s):
    """세트의 기물 목록(순서 유지). 각 기물: id, slug, name, description, cells[w,h], layer, palette_hint, worker, scene …
    조립형 킷이 있는 세트(일본): 킷 항목(kind='kit')이 앞에, 그다음 보통 기물. 킷으로 대체된 옛 기물에는 movedTo=<킷 slug>."""
    it = read_json(os.path.join(BASE, set_conf(s)['items']), {'items': []})
    out = it.get('items', []) if isinstance(it, dict) else []
    kd = kits_def(s)
    if not kd: return out
    kits = [kit_item(s, k, kd) for k in kd.get('kits', [])]
    moved = {r: k['slug'] for k in kits for r in k['replaces']}
    return kits + [dict(o, movedTo=moved[o['slug']]) if o['slug'] in moved else o for o in out]

_STD = {}
def size_std():
    """tiledata/atlas-pick/size-std.json — 실제 비율(§12) 표준 칸수 후보. {세트: {slug: {cells, canvas, tags:[h34-B…], basis}}}.
    기물 원본(jobs-*.json)의 칸수는 그대로 두고, 이 표에 든 태그 후보만 표준 캔버스로 재고 검사한다."""
    if not _STD:
        _STD.update(read_json(os.path.join(BASE, 'size-std.json'), {}) or {})
    return _STD

def std_of(st, slug):
    return (size_std().get(st) or {}).get(slug)

def std_tag(st, slug, stem):
    """후보 stem 에 해당하는 표준 항목(cells·canvas·basis). 기본 항목의 tags 에 들면 그것,
    `alt: {stem: {cells, canvas, basis}}` 가 있으면 그 태그만 다른 캔버스(예: 재작도 v35-B 가 v35-A 와 칸수가 다를 때)."""
    sd = std_of(st, slug)
    if not sd: return None
    alt = (sd.get('alt') or {}).get(stem)
    if alt: return dict(sd, **alt)
    return sd if stem in sd.get('tags', []) else None

def canvas_for(st, it, stem):
    """후보 stem(예 'h34-B')이 기물의 표준 태그면 표준 캔버스, 아니면 기물 캔버스."""
    sd = std_tag(st, it['slug'], stem) if st and it else None
    if sd: return list(sd['canvas'])
    return list(it['canvas']) if it and it.get('canvas') else None

def items_by_slug(s):
    return {x['slug']: x for x in items(s)}

def set_of_path(path):
    """후보 파일 경로 → (세트 id, slug)."""
    d = os.path.dirname(os.path.abspath(path)); root = os.path.dirname(d)
    for m in list_sets():
        if os.path.abspath(os.path.join(BASE, m['candidates'])) == root:
            return m['id'], os.path.basename(d)
    return None, os.path.basename(d)

def atomic_write(path, text):
    tmp = path + '.tmp%d' % os.getpid()
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text)
    os.replace(tmp, path)
