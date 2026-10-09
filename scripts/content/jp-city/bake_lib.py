"""bake_jp.py 보조 모듈 — 칸 통행 종류(pc) 표 · 자리 키 핀 · 시트 쓰기/읽기 · 재조립 · 팔레트 · 정의 검사.

선례: src/harnesses/modern-chipset/bake_lib.py(재조립·팔레트·pc 표), scripts/content/hand-interior/pin_ids.py(자리 키 핀).
modern_city 와 다른 점: 번호 핀 키가 내용 해시가 아니라 **자리 키**(`<블록>/<local>`)다 — 그림을 다듬어도(같은 키) 번호가 안 바뀐다.
"""
import collections, json, math, os
import numpy as np
from PIL import Image

T = 16
TPR = 96                     # 열 수. 2026-10-08 48 → 96(4묶음 던전으로 칸이 48열×4096px 한도 12288 을 넘었다).
                             # 칸 번호는 그대로(번호 = 시트 위 순서), 그림 위치만 다시 놓는다 — ensureJpCityTileset 이 48열 사본을 같은 시트로 보고
                             # tilesPerRow 만 고친다(RELAYOUT_FROM). 다시 바꿀 일이 생기면 그 목록에 옛 열 수를 더한다.
MAX_H = 4096
MARKER = (0xe0, 0x40, 0xc0)

# 칸 통행 종류(pc) → (priority, passable, passage, 기본 층)  — modern_city bake_lib.PC 와 같은 뜻
#   floor      불투명 땅(아래층, 걷는다)                   solidfloor 불투명 땅인데 막힘(물 등)
#   flat       투명 바닥 표시·소품 아랫단(2층, 걷는다, 캐릭터 밑)   solid  위층·막힘(건물 몸채·소품 밑동)
#   star       위층·통행 가능 ★(사람 위에 그려짐)             blank  빈 칸
PC = {
    'floor': ('lower', True, 'passable', 'lower'),
    'solidfloor': ('lower', False, 'solid', 'lower'),
    'flat': ('lower', True, 'passable', 'upper'),
    'solid': ('upper', False, 'solid', 'upper'),
    'star': ('upper', True, 'star', 'upper'),
    'blank': ('lower', False, 'solid', 'lower'),
}
PC_ORDER = ['floor', 'solidfloor', 'solid', 'star', 'flat', 'blank']     # 동률일 때 고르는 순서
PCNOTE = {'floor': '걸을 수 있는 땅(아래층)', 'solidfloor': '막힌 땅(아래층)', 'flat': '투명 바닥 표시(캐릭터 밑, 걸을 수 있음)',
          'solid': '막힘(위층)', 'star': '솟은 칸 ★(걸어 지나갈 수 있고 사람 위에 그려짐)', 'blank': '빈 칸'}
LOWER_PC = ('floor', 'solidfloor')    # 키트에서 아래층(tiles)에 놓는 pc. 나머지는 위층(upperTiles).


# ------------------------------------------------------------------ 그림 도구
def norm(im):
    """투명 화소의 RGB 를 0 으로(비교가 안정되게). RGBA PIL 이미지."""
    a = np.array(im.convert('RGBA'))
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a, 'RGBA')


def arr_norm(a):
    a = np.array(a, dtype=np.uint8)
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a, 'RGBA')


def empty(cell):
    return not np.asarray(cell)[:, :, 3].any()


def alpha_class(cell):
    a = np.asarray(cell)[:, :, 3]
    if not a.any(): return 'blank'
    return 'opaque' if (a == 255).all() else 'trans'


def same_image(a, b):
    return a.size == b.size and np.array_equal(np.asarray(norm(a)), np.asarray(norm(b)))


def render_sheet(cells, count, tpr=TPR):
    rows = math.ceil(count / tpr)
    sheet = Image.new('RGBA', (tpr * T, rows * T), (0, 0, 0, 0))
    for tid, c in cells.items(): sheet.paste(c, ((tid % tpr) * T, (tid // tpr) * T))
    return sheet


def read_cell(sheet_img, tid, tpr=TPR):
    return sheet_img.crop(((tid % tpr) * T, (tid // tpr) * T, (tid % tpr) * T + T, (tid // tpr) * T + T))


def reassemble(kit, sheet_img, tpr=TPR):
    """시트 PNG + 키트 정의만으로 다시 조립한 RGBA(정규화). 아래층 칸 위에 위층 칸을 겹친다."""
    w, h = kit['width'], kit['height']
    out = Image.new('RGBA', (w * T, h * T), (0, 0, 0, 0))
    for y, row in enumerate(kit['rows']):
        for x in range(w):
            lo = row['tiles'][x]; up = (row.get('upperTiles') or [-1] * w)[x]
            if lo >= 0: out.paste(read_cell(sheet_img, lo, tpr), (x * T, y * T))
            if up >= 0:
                c = read_cell(sheet_img, up, tpr)
                region = out.crop((x * T, y * T, x * T + T, y * T + T))
                if empty(region): out.paste(c, (x * T, y * T))
                else:
                    region.alpha_composite(c); out.paste(region, (x * T, y * T))
    return norm(out)


# ------------------------------------------------------------------ 자리 키 핀
class Pins:
    """자리 키 → 칸 번호. 이전 굽기(pins.json)에 있는 키는 그 번호를 그대로, 새 키는 max+1 부터 덧붙인다. 번호는 절대 안 움직인다."""
    def __init__(self, prev):
        self.map = dict(prev.get('cells', {}))
        self.next_id = (max(self.map.values()) + 1) if self.map else 0
        self.used = {}           # 이번 굽기에서 쓴 키 → 번호

    def assign(self, key):
        if key in self.used: return self.used[key]
        tid = self.map.get(key)
        if tid is None:
            tid = self.next_id; self.next_id += 1; self.map[key] = tid
        self.used[key] = tid
        return tid


def load_pins(path):
    if os.path.exists(path): return json.load(open(path, encoding='utf-8'))
    return {'version': 1, 'tilesPerRow': TPR, 'count': 0, 'cells': {}}


# ------------------------------------------------------------------ 팔레트
def load_palette(path):
    cols = set()
    for line in open(path, encoding='utf-8'):
        for tok in line.split('//')[0].split():
            if tok.startswith('#') and len(tok) == 7:
                cols.add(tuple(int(tok[i:i + 2], 16) for i in (1, 3, 5)))
    return cols


def off_palette(cell, pal):
    a = np.asarray(cell)
    vis = a[:, :, 3] > 0
    out = {}
    for r, g, b in a[vis][:, :3]:
        c = (int(r), int(g), int(b))
        if c not in pal: out[c] = out.get(c, 0) + 1
    return out


# ------------------------------------------------------------------ 정의 검사 (src/project/types/base.ts 를 손으로 옮긴 것)
ENUM = dict(passage={'passable', 'solid', 'star'}, layer={'lower', 'upper'}, rep={'auto', 'center', 'fixed', 'repeat'},
            grole={'building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop'}, glayer={'lower', 'upper', 'event', 'mixed'},
            source={'ai', 'bundled-default', 'imported', 'unknown', 'user'}, krole={'building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop'},
            kpart={'entrance', 'sign', 'anchor', 'window'}, growth={'horizontal', 'vertical', 'both'}, snap={'wall-north', 'wall-any', 'floor', 'free'})
TOP_KEYS = ['id', 'name', 'textureKey', 'family', 'tileSize', 'tilesPerRow', 'count', 'libraryEnd', 'passability', 'priority', 'terrain', 'tileMeta',
            'tileGroups', 'autotileGroups', 'animationStrips', 'structureKits']


# ---- 그룹 층(defaultLayer) = 멤버 칸의 엔진 홈에서 유도한다 (정정 2026-10-03)
# 엔진(src/editor/tileLayerClassification.ts tileLayerHome)은 커스텀 타일셋의 칸 홈을 **칸 단위**로만 정한다: 잠긴(locked) 칸의 meta.defaultLayer,
# 아니면 priority[tile]. 그룹의 defaultLayer 는 홈 판정에 안 쓰이고 어휘 설명(tileVocabulary.groupLayerHome → v3 도구)만 정한다.
# 그래서 그룹 값은 선언하지 않고 멤버 칸의 홈에서 유도한다 — 전부 위 = upper, 전부 아래 = lower, 섞이면 mixed(layerHome perCell, 칸마다 엔진이 판정).
UNUSED_LABELS = ('빈 칸', '미사용', '옛 굽기')


def tile_home(priority, meta):
    """엔진 tileLayerHome 의 커스텀 타일셋 경로를 그대로 옮긴 것: 잠긴 칸의 defaultLayer 우선, 아니면 priority."""
    if (meta.get('locked') is True or meta.get('userLocked') is True) and meta.get('defaultLayer') in ('lower', 'upper'): return meta['defaultLayer']
    return priority


def derive_group_layer(declared, tids, priority, tile_meta):
    """(defaultLayer, layerHome). 'event' 그룹은 그대로 둔다."""
    if declared == 'event': return declared, 'perCell'
    homes = {tile_home(priority[t], tile_meta[t]) for t in tids if not tile_meta[t].get('label', '').startswith(UNUSED_LABELS)}
    if len(homes) == 1:
        h = next(iter(homes)); return h, h
    if not homes: return declared, declared if declared in ('lower', 'upper') else 'perCell'
    return 'mixed', 'perCell'


def check_definition(data, expect_tpr=TPR):
    """필드명·값 범위·키트 부위·문 칸 막힘·접근칸 통행·오토타일 256/16 키·칸 번호 범위. 위반을 코드별로 센다."""
    bad = collections.Counter(); ex = {}

    def no(code, info=None):
        bad[code] += 1; ex.setdefault(code, info)
    n = data['count']
    if list(data.keys()) != TOP_KEYS: no('top-keys', list(data.keys()))
    if data['tilesPerRow'] != expect_tpr or data['tileSize'] != 16: no('geometry')
    if data['libraryEnd'] != n: no('libraryEnd')
    for key in ('passability', 'priority', 'terrain', 'tileMeta'):
        if len(data[key]) != n: no('len-' + key)
    for i in range(n):
        p = data['passability'][i]
        if set(p) != {'up', 'down', 'left', 'right'} or not all(isinstance(v, bool) for v in p.values()): no('passability-shape', i)
        if data['priority'][i] not in ENUM['layer']: no('priority', i)
        if not isinstance(data['terrain'][i], int): no('terrain', i)
        m = data['tileMeta'][i]
        if not isinstance(m.get('label'), str) or not isinstance(m.get('description'), str) or not m.get('description'): no('meta-text', i)
        if m.get('passage') is not None and m['passage'] not in ENUM['passage']: no('passage', i)
        if m.get('defaultLayer') is not None and m['defaultLayer'] not in ENUM['layer']: no('defaultLayer', i)
        if m.get('repeatability') is not None and m['repeatability'] not in ENUM['rep']: no('repeatability', i)
        if m.get('source') not in ENUM['source']: no('source', i)
        if m.get('layerBacking') not in (None, 'none') and not isinstance(m.get('layerBacking'), int): no('layerBacking', i)
        if m.get('tags') is not None and not all(isinstance(t, str) for t in m['tags']): no('tags', i)
        if m.get('passage') == 'solid' and (p['up'] or p['down']) or m.get('passage') in ('passable', 'star') and not p['up']: no('passage-vs-passability', i)
    gids = set()
    for g in data['tileGroups']:
        if g['id'] in gids: no('group-dup', g['id'])
        gids.add(g['id'])
        if not g['id'].startswith('jp:'): no('group-prefix', g['id'])
        if g['role'] not in ENUM['grole']: no('group-role', g['id'])
        if g['defaultLayer'] not in ENUM['glayer']: no('group-layer', g['id'])
        if g['defaultLayer'] != 'event' and g['tileIds']:
            want = derive_group_layer(g['defaultLayer'], g['tileIds'], data['priority'], data['tileMeta'])
            if (g['defaultLayer'], g.get('layerHome')) != want: no('group-layer-vs-tile-home', dict(id=g['id'], got=(g['defaultLayer'], g.get('layerHome')), want=want))
        if any(not (0 <= t < n) for t in g['tileIds']) or g['tileIds'] != sorted(set(g['tileIds'])): no('group-tiles', g['id'])
        if not g['tileIds']: no('group-empty', g['id'])
        if not g.get('description') or not g.get('placementRules'): no('group-text', g['id'])
    kids = set()
    for k in data['structureKits']:
        if k['id'] in kids: no('kit-dup', k['id'])
        kids.add(k['id'])
        if not k['id'].startswith('jp-'): no('kit-prefix', k['id'])
        if k['kind'] != 'section' or k['learnedFrom'] not in ('user-paint', 'db-authored', 'interior-catalog', 'pack-preset'): no('kit-kind', k['id'])
        if len(k['rows']) != k['height'] or k['width'] < 1 or k['height'] < 1: no('kit-height', k['id'])
        if k.get('tileSize') != 16: no('kit-tilesize', k['id'])
        for r in k['rows']:
            if len(r['tiles']) != k['width'] or len(r.get('upperTiles') or []) != k['width']: no('kit-width', k['id'])
            for t in r['tiles'] + r['upperTiles']:
                if t != -1 and not (0 <= t < n): no('kit-tile-range', k['id'])
        ai = k.get('ai') or {}
        if not ai.get('description') or not ai.get('placementRules'): no('kit-ai-text', k['id'])
        if ai.get('role') is not None and ai['role'] not in ENUM['krole']: no('kit-ai-role', k['id'])
        if ai.get('growthAxis') is not None and ai['growthAxis'] not in ENUM['growth']: no('kit-growth', k['id'])
        if ai.get('snap') is not None and ai['snap'] not in ENUM['snap']: no('kit-snap', k['id'])
        if ai.get('repeatability') not in (None, 'repeat', 'fixed'): no('kit-repeat', k['id'])
        cell_at = lambda x, y: (k['rows'][y]['upperTiles'][x] if k['rows'][y]['upperTiles'][x] >= 0 else k['rows'][y]['tiles'][x])
        pids = set()
        for pt in k.get('parts', []):
            if pt['id'] in pids: no('kit-part-dup', k['id'])
            pids.add(pt['id'])
            if pt['kind'] not in ENUM['kpart'] or not (0 <= pt['dx'] and pt['dx'] + pt['w'] <= k['width'] and 0 <= pt['dy'] and pt['dy'] + pt['h'] <= k['height']): no('kit-part', k['id']); continue
            if pt['kind'] == 'entrance':
                for x in range(pt['dx'], pt['dx'] + pt['w']):
                    t = cell_at(x, pt['dy'] + pt['h'] - 1)
                    if t < 0 or data['passability'][t]['up']: no('door-cell-not-solid', k['id'])
        for a in ai.get('access', []):
            if not (0 <= a['dx'] < k['width'] and 0 <= a['dy'] <= k['height']): no('kit-access-range', k['id']); continue
            if a['dy'] < k['height']:
                t = cell_at(a['dx'], a['dy'])
                if t < 0 or not data['passability'][t]['up']: no('kit-access-blocked', k['id'])
    aids = set()
    for a in data['autotileGroups']:
        if a['id'] in aids: no('autotile-dup', a['id'])
        aids.add(a['id'])
        mem = set(a['memberTileIds'])
        if not mem or any(not (0 <= t < n) for t in mem | set(a['variantMap'].values()) | set(a.get('connectTileIds', []))): no('autotile-range', a['id'])
        if a['neighborhood'] not in (4, 8) or len(a['variantMap']) != (16 if a['neighborhood'] == 4 else 256): no('autotile-shape', a['id'])
        if set(a['variantMap']) != {str(i) for i in range(16 if a['neighborhood'] == 4 else 256)}: no('autotile-keys', a['id'])
        if not set(a['variantMap'].values()) <= mem: no('autotile-variant-not-member', a['id'])
        for lst in a.get('interiorVariants', []) or []:
            if not set(lst) <= mem: no('autotile-interior-not-member', a['id'])
        if a.get('layer') not in (None, 'lower', 'upper'): no('autotile-layer', a['id'])
    return dict(violations=sum(bad.values()), by_code=dict(bad), examples=ex, tiles_checked=n, kits_checked=len(data['structureKits']),
                groups_checked=len(data['tileGroups']), autotiles_checked=len(data['autotileGroups']))
