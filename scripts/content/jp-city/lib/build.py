"""일본 상가 거리 키트 빌더: 띠 페인터 → 16px 칸 슬라이스·이름·중복 제거 → 시트/카탈로그 → 조립기 → 검증."""
import os, sys, json, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paint2 import *
import paint, tune, post
from PIL import Image

import jpenv
OUT = jpenv.OUT; os.makedirs(OUT, exist_ok=True)

# ───────── 칸 저장소 ─────────
CELLS = []            # [(canonical_name, array)]
NAMES = {}            # name -> index | None(빈 칸)
HASH = {}
def add(name, arr):
    if not arr[..., 3].any(): NAMES[name] = None; return name
    h = hashlib.md5(arr.tobytes()).hexdigest()
    if h not in HASH:
        HASH[h] = len(CELLS); CELLS.append((name, arr.copy()))
    NAMES[name] = HASH[h]; return name
def reserve_blank(n, start):
    """행인(Actor1 person.*)이 차지하던 자리를 투명한 빈 칸 n개로 지킨다 — 뒤의 칸 번호가 원본 시트와 같도록. 해시 사전에는 넣지 않는다."""
    assert len(CELLS) == start, (len(CELLS), start)
    for i in range(n): CELLS.append((f'_reserved.person.{i}', np.zeros((16, 16, 4), np.uint8)))
def cut(a, col, row): return a[row * 16:(row + 1) * 16, col * 16:(col + 1) * 16]

def finish(c, pt, pb):
    a = c.a.copy()
    if pt: a = np.concatenate([np.repeat(a[:1], 3, 0), a], 0)
    if pb: a = np.concatenate([a, np.repeat(a[-1:], 3, 0)], 0)
    a = tune.ink(post.contour(a), edge=3, inner=2, soft=1)
    if pt: a = a[3:]
    if pb: a = a[:-3]
    return a

# ───────── 띠 정의: 종류 → 페인터 ─────────
FLOOR_V = {'slide': [0, 1, 2, 3, 4, 5, 6, 7], 'veranda': [0, 1, 2, 3, 4, 5, 6, 7], 'koushi': [0, 1, 2, 3], 'pairs': [0, 1, 2, 3], 'ribbon': [0, 1], 'curtain': [0, 1], 'balcony': [0, 1, 3, 7, 11, 15], 'tile': [0, 1], 'blank': [0]}
WALLS = ('kinari', 'shiro', 'conc', 'hodo')
NOWALL = ('tile', 'curtain')
GROUND = {  # id → (kind, awn, v)
    'gr.izakaya': ('izakaya', 'aka', 0), 'gr.konbini.0': ('konbini', 'aka', 0), 'gr.konbini.1': ('konbini', 'aka', 1), 'gr.garage': ('garage', 'aka', 0),
    **{f'gr.shutter.{a}': ('shutter', a, 0) for a in ('aka', 'sora', 'kii')}, **{f'gr.glass.{a}': ('glass', a, 0) for a in ('aka', 'sora', 'kii')}, 'gr.machiya': ('machiya', 'aka', 0)}
ROOFS = {f'roof.{l}.{r}': (l, r) for l in ('plain', 'ac', 'stair') for r in ('plain', 'tank', 'cyl')}
SIGNS = {f'roofsign.{c}': c for c in ('aka', 'sora', 'kii')}

def paint_band(bid, n, vs=(0,)):
    """띠 하나를 폭 n칸으로 직접 그려 잉크까지 먹인 RGBA 배열."""
    p = bid.split('.')
    if p[0] == 'fl': return finish(floor_band(p[1], p[2] if p[1] not in NOWALL else 'kinari', n, list(vs)), True, True)
    if bid == 'roof.tile': return finish(roof_tile_band(n), False, True)
    if bid == 'roof.hip': return finish(hip_band(n), False, True)
    if bid == 'roof.hip.slate': return finish(hip_band(n, 'tairu'), False, True)
    if bid == 'roof.slate': return finish(roof_tile_band(n, 'tairu'), False, True)
    if bid == 'eave.slate': return finish(eave_band(n, 'tairu'), True, True)
    if p[0] == 'roof': l, r = ROOFS[bid]; return finish(roof_band(n, l, r), False, True)
    if bid == 'eave': return finish(eave_band(n), True, True)
    if p[0] == 'roofsign': return finish(roofsign_band(n, SIGNS[bid]), False, True)
    if p[0] == 'terrace': return finish(terrace_band(n), False, True)
    if p[0] == 'gr': k, a, v = GROUND[bid]; return finish(ground_band(k, n, a, list(vs) if k == 'machiya' else v), True, False)
    raise KeyError(bid)

BAND = {}   # id → 기록
def reg_band(bid, rows, vlist=(0,), modw=1):
    nref = 3 + modw * 2
    rec = {'rows': rows, 'modw': modw, 'L': None, 'R': None, 'mods': {}, 'F': None}
    base = paint_band(bid, 3 + modw, [vlist[0]])
    rec['L'] = [add(f'{bid}.L.r{r}', cut(base, 0, r)) for r in range(rows)]
    rec['R'] = [[add(f'{bid}.R{k}.r{r}', cut(base, base.shape[1] // 16 - 2 + k, r)) for r in range(rows)] for k in (0, 1)]
    for v in vlist:
        a = paint_band(bid, 3 + modw * 2, [v])
        mods = [[add(f'{bid}.M{v}.c{j}.r{r}', cut(a, 1 + j, r)) for r in range(rows)] for j in range(modw)]
        for j in range(modw):                              # 모듈 반복 검증: 둘째 모듈이 첫째와 같아야 한다
            for r in range(rows): assert NAMES[mods[j][r]] == NAMES[add(f'_chk.{bid}.{v}.{j}.{r}', cut(a, 1 + modw + j, r))], (bid, v, j, r)
        rec['mods'][str(v)] = mods
    if modw == 2:
        a = paint_band(bid, 4, [vlist[0]])
        rec['F'] = [add(f'{bid}.F.r{r}', cut(a, 1, r)) for r in range(rows)]
    BAND[bid] = rec

for k, vl in FLOOR_V.items():
    mw = FLOORS[k][0]
    for w in ((None,) if k in NOWALL else WALLS):
        reg_band(f'fl.{k}.{w or "any"}' if False else f'fl.{k}.{w or "kinari"}', 2, vl, mw)
for bid in ROOFS: reg_band(bid, 2)
for bid in SIGNS: reg_band(bid, 4, (0,), 2)
reg_band('terrace', 1)
for bid in GROUND:
    if bid == 'gr.machiya': reg_band(bid, 3, (0, 1, 2, 3, 4, 5), 1)
    else: reg_band(bid, 3, (0,), 2)
reg_band('eave', 1); reg_band('roof.tile', 2); reg_band('roof.slate', 2); reg_band('roof.hip', 2); reg_band('roof.hip.slate', 2); reg_band('eave.slate', 1)
# 바닥 띠가 모듈 한 칸 단위가 아닌 '고정 F' 규칙: ground 는 modw 2 (M0,M1) + F = M0 로 검증됨
for bid in GROUND:
    BAND[bid]['F'] = [BAND[bid]['mods']['0'][0][r] for r in range(3)]
for bid in SIGNS:
    BAND[bid]['F'] = [BAND[bid]['mods']['0'][0][r] for r in range(4)]

# ───────── 부착물 ─────────
DECO = {}
def reg_deco(name, cv):
    a = cv.a; w, h = a.shape[1] // 16, a.shape[0] // 16
    DECO[name] = {'w': w, 'h': h, 'cells': [[add(f'deco.{name}.c{c}.r{r}', cut(a, c, r)) for c in range(w)] for r in range(h)]}
reg_deco('fe', deco_fe(False)); reg_deco('fe_end', deco_fe(True))
for col in ('aka', 'sora', 'kii'): reg_deco(f'sign_h.{col}', deco_sign_h(col))
for col in ('kii', 'aka', 'sora', 'midori'): reg_deco(f'vstack.{col}', deco_vstack(col))
for col in ('aka', 'sora'): reg_deco(f'wallad.{col}', deco_wallad(col))
VS = {'izakaya': ('居酒屋', 'aka', 'shiro', 3), 'yakkyoku': ('薬局', 'midori', 'shiro', 3), 'sushi': ('寿司', 'sora', 'shiro', 3), 'yakiniku': ('焼肉', 'kii', 'kon', -2), 'kissa': ('喫茶', 'daidai', 'shiro', 3), 'sento': ('銭湯', 'sora', 'kinari', 3), 'ramen': ('ラーメン', 'aka', 'kii', 3)}
for k, (t, bg, fg, ft) in VS.items(): reg_deco(f'vsign.{k}', deco_vsign(t, bg, fg, ft))
PL = {'yakkyoku': ('薬局', 'midori', 'shiro', 3), 'sushi': ('寿司', 'sora', 'shiro', 3), 'kissa': ('喫茶', 'daidai', 'kinari', 3), 'yakiniku': ('焼肉', 'aka', 'kii', 3), 'sento': ('銭湯', 'tairu', 'kinari', 3), 'bento': ('弁当', 'kii', 'kon', -2), 'shika': ('歯科', 'shiro', 'sora', -1)}
for k, (t, bg, fg, ft) in PL.items(): reg_deco(f'plate.{k}', deco_plate(t, bg, fg, ft))
for col, fg in (('aka', 'shiro'), ('sora', 'shiro'), ('kii', 'kon'), ('midori', 'shiro')): reg_deco(f'plate.mark.{col}', deco_plate('', col, fg, 3 if fg == 'shiro' else -2))
for col, fg in (('aka', 'shiro'), ('sora', 'shiro'), ('kii', 'kon'), ('midori', 'shiro')): reg_deco(f'vsign.mark.{col}', deco_vsign(3, col, fg, 3 if fg == 'shiro' else -2))
BD = {'izakaya': '居酒屋', 'ramen': 'ラーメン', 'kissaten': '喫茶店', 'sakaya': '酒屋', 'shokudo': '食堂', 'sushi': '寿司処', 'tempura': '天ぷら'}
for k, t in BD.items(): reg_deco(f'board.{k}', deco_board(t))
reg_deco('ac.0', deco_ac(0)); reg_deco('ac.1', deco_ac(1)); reg_deco('pipe', deco_pipe()); reg_deco('laundry', deco_laundry())
for col in ('sora', 'aka', 'kii'): reg_deco(f'sunshade.{col}', deco_sunshade(col))
reg_deco('inuyarai', deco_inuyarai()); reg_deco('mushiko', deco_mushiko())
RT = {'ramen': ('ラーメン', 'shiro'), 'izakaya': ('居酒屋', 'kii'), 'karaoke': ('カラオケ', 'shiro'), 'pachinko': ('パチンコ', 'kii')}
for k, (t, fg) in RT.items(): reg_deco(f'rtext.{k}', deco_rtext(t, fg))

import doors as DR
for _k, _f in DR.BUILDERS.items(): reg_deco(f'door.{_k}', _f())
DOOR_DEFAULT = {'gr.izakaya': 'noren', 'gr.konbini.0': 'auto', 'gr.konbini.1': 'auto', 'gr.garage': 'rollup', 'gr.machiya': 'machiya',
                **{f'gr.shutter.{a}': 'steel' for a in ('aka', 'sora', 'kii')}, **{f'gr.glass.{a}': 'cafe' for a in ('aka', 'sora', 'kii')}}
def with_door(spec):
    """레시피의 문(spec['door']=(종류, 열))을 ground 부착물로 풀어 준다. 없으면 용도별 기본 문을 우끝에."""
    s = dict(spec); n = s['n']; t, col = s.get('door') or (DOOR_DEFAULT[s['ground']], None)
    w = DECO[f'door.{t}']['w']
    if col is None: col = n - w
    assert 0 <= col <= n - w, (t, col, n)
    s['decos'] = list(s.get('decos', [])) + [dict(deco=f'door.{t}', col=col, floor='ground')]
    s['_door'] = (t, col, w); return s
# ───────── 거리 칸 ─────────
STREET = {}
for n_, cv in (('sw', sw_cell()), ('sw_tactile', sw_cell('tactile')), ('sw_shade', sw_cell('shade')), ('road_n', road_cell('n')), ('road_c', road_cell('c')),
               ('road_dash', road_cell('dash')), ('road_s', road_cell('s')), ('cw_n', cw_cell('n')), ('cw_m', cw_cell('m')), ('cw_s', cw_cell('s'))):
    STREET[n_] = add(f'st.{n_}', cv.a)
STREET['guard'] = add('st.guard', guard_cell().a)
for n_, cv in (('lane_n', lane_cell('n')), ('lane_c', lane_cell('c')), ('lane_s', lane_cell('s')), ('lane_stop', lane_cell('man')), ('lot', lot_cell('plain')), ('lot_line', lot_cell('line')),
               ('lot_stop', lot_cell('stop')), ('lot_num', lot_cell('num')), ('gravel', gravel_cell())):
    STREET[n_] = add(f'st.{n_}', cv.a)
for n_, cv in (('stop_c', stopline_cell()), ('stop_n', stopline_n()), ('stop_s', stopline_s()), ('zeb_n', zebra_cell('n')), ('zeb_c', zebra_cell('c')), ('zeb_s', zebra_cell('s')),
               ('tactile_dot', tactile_dot()), ('tactile_bar', tactile_bar())):
    STREET[n_] = add(f'st.{n_}', cv.a)
STREET['manhole'] = add('st.manhole', manhole().a)

# ───────── 소품 (가로 x 세로 칸, 걸음/층) ─────────
import props as P0
from jp import pole as pole_fn
PROP = {}
def reg_prop(name, cv, walk_bottom_cols, desc):
    a = cv.a; w, h = a.shape[1] // 16, a.shape[0] // 16
    cells = [[add(f'prop.{name}.c{c}.r{r}', cut(a, c, r)) for c in range(w)] for r in range(h)]
    walk = [['C' if r < h - 1 else ('S' if c in walk_bottom_cols else 'C') for c in range(w)] for r in range(h)]
    layer = [['up' if r < h - 1 else 'lo' for c in range(w)] for r in range(h)]
    PROP[name] = {'w': w, 'h': h, 'cells': cells, 'walk': walk, 'layer': layer, 'desc': desc}
for col in ('aka', 'sora', 'midori'):
    cv = Cv(32, 32); P0.vending2(cv, 6, 30, col); reg_prop(f'vending.{col}', cv, (0, 1), '자판기')
for col in ('sora', 'midori', 'aka'):
    cv = Cv(32, 32); P0.bike2(cv, 2, 24, col); reg_prop(f'bike.{col}', cv, (), '자전거(마마차리) — 걸을 수 있는 소품')
cv = Cv(32, 64); paint.__dict__  # placeholder
from jp5 import signal as signal_fn, roadsign as roadsign_fn
class _S(Cv): pass
cv = signal2(); reg_prop('signal', cv, (1,), '신호기(청황적·보행자·押ボタン)')
cv = Cv(32, 80); roadsign_fn(cv, 16, 78); reg_prop('roadsign', cv, (1,), '도로 표지(원형)')
cv = pole_tall(); reg_prop('utility_pole', cv, (1,), '전봇대(변압기·완금·접지)')

reg_prop('planter', (lambda: (lambda c: c)(Cv(32, 16)))(), (), '') if False else None
def _p(name, cv, cols, desc):
    cv_ = Cv(cv.w, cv.h); cv_.a[:] = cv.a; reg_prop(name, cv_, cols, desc)
_p('curve_mirror', curve_mirror(), (0,), '커브미러'); _p('post_box', post_box(), (0,), '우체통'); _p('garbage_net', garbage_net(), (0, 1), '쓰레기 그물'); _p('bike_rack', bike_rack(), (0, 1), '자전거 거치대')
_p('recycle', Cv(16, 16), (), '') if False else None
_p('stop_sign', stop_sign(), (0,), '일시정지 표지'); _p('coin_p', coin_p(), (0,), '코인 파킹 표지')
for _c in ('aka', 'sora', 'midori'): _p(f'nobori.{_c}', nobori(_c), (0,), '幟(깃발)')
_p('vend_pair', vend_cluster(['aka', 'sora']), (0, 1, 2), '자판기 2대+재활용함'); _p('vend_trio', vend_cluster(['sora', 'aka', 'midori']), (0, 1, 2, 3), '자판기 3대+재활용함')
_p('planter', planter(), (0, 1), '화단(걸림)'); _p('pot', pot(), (0,), '화분'); _p('bench', bench(), (0, 1), '벤치'); _p('bollard', bollard(), (0,), '볼라드')
# ───────── 조립기 ─────────
def band_cells(bid, nb, vs=(0,)):
    rec = BAND[bid]; rows = rec['rows']; mw = rec['modw']
    assert nb >= 3, nb
    g = [[None] * nb for _ in range(rows)]
    m = nb - 3; cnt = m // mw
    for r in range(rows):
        g[r][0] = rec['L'][r]; g[r][nb - 2] = rec['R'][0][r]; g[r][nb - 1] = rec['R'][1][r]
    for k in range(cnt):
        v = str(vs[k % len(vs)]); mods = rec['mods'][v]
        for j in range(mw):
            for r in range(rows): g[r][1 + k * mw + j] = mods[j][r]
    for c in range(1 + cnt * mw, nb - 2):
        for r in range(rows): g[r][c] = rec['F'][r]
    return g

def assemble(spec):
    """건물 recipe → {'cells','walk','layer'} (행 x 열)."""
    spec = with_door(spec); n = spec['n']; rows = []; wide = []         # (band 격자, 열 오프셋)
    st = spec.get('setback'); u = st['upper'] if st else 0; ins = st['ins'] if st else 0
    ub = n - 2 * ins
    pieces = []
    top = spec['head'] or spec['roof']
    pieces.append((top, ub if st else n, ins if st else 0, [0]))
    for i, f in enumerate(spec['floors']):
        if st and i == u: pieces.append(('terrace', n, 0, [0]))
        up = st and i < u
        pieces.append(((f['band'] if 'band' in f else f"fl.{f['kind']}.{f.get('wall') or 'kinari'}"), ub if up else n, ins if up else 0, f.get('vs', [0])))
    pieces.append((spec['ground'], n, 0, [0]))
    grid = []; meta = []                     # meta: (band 시작 행, 행 수, band id, 오프셋)
    for bid, nb, off, vs in pieces:
        g = band_cells(bid, nb, vs); r0 = len(grid)
        for r in range(len(g)): grid.append([None] * off + g[r] + [None] * (n - off - nb))
        meta.append((r0, len(g), bid, off, nb))
    R = len(grid)
    # 부착물 (층 순서, 터미널 판정은 층 인덱스)
    floor_rows = [(m[0], m[3], m[4], m[2]) for m in meta if m[2].startswith('fl.')]
    nf = len(floor_rows)
    deco_over = []
    for d in spec.get('decos', []):
        fl = d['floor']
        if fl == 'head': r0 = meta[0][0]
        elif fl == 'ground': r0 = meta[-1][0]
        else: r0 = floor_rows[fl][0]
        dn = d['deco']
        if dn == 'fe': dn = 'fe_end' if fl == nf - 1 else 'fe'
        if '{c}' in dn: dn = dn.format(c=d['cols'][fl % len(d['cols'])])
        D = DECO[dn]
        for rr in range(D['h']):
            for cc in range(D['w']):
                deco_over.append((r0 + rr + d.get('row', 0), d['col'] + cc, D['cells'][rr][cc]))
    walk = [['C'] * n for _ in range(R)]; layer = [['up'] * n for _ in range(R)]
    gr = meta[-1][0]
    for r in (gr + 1, gr + 2):
        for c in range(n): walk[r][c] = 'S'; layer[r][c] = 'lo'
    t_, c_, w_ = spec['_door']; dcols = list(range(c_, c_ + w_))
    for c in dcols: walk[gr + 2][c] = 'F'
    return {'cells': grid, 'deco': deco_over, 'walk': walk, 'layer': layer, 'rows': R, 'n': n, 'door_cols': dcols}

def array_of(name):
    i = NAMES[name]
    return np.zeros((16, 16, 4), np.uint8) if i is None else CELLS[i][1]

def render(asm):
    n, R = asm['n'], asm['rows']; im = np.zeros((R * 16, n * 16, 4), np.uint8)
    def blit(r, c, nm):
        a = array_of(nm); sub = im[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]; m = a[..., 3] > 0; sub[m] = a[m]
    for r in range(R):
        for c in range(n):
            if asm['cells'][r][c]: blit(r, c, asm['cells'][r][c])
    for r, c, nm in asm['deco']: blit(r, c, nm)
    return im

def direct(spec):
    """같은 recipe 를 조립기 없이 띠 전체를 직접 그려 쌓은 정답."""
    spec = with_door(spec); n = spec['n']; st = spec.get('setback'); u = st['upper'] if st else 0; ins = st['ins'] if st else 0; ub = n - 2 * ins
    bands = []
    top = spec['head'] or spec['roof']
    bands.append((top, ub if st else n, ins if st else 0, [0]))
    for i, f in enumerate(spec['floors']):
        if st and i == u: bands.append(('terrace', n, 0, [0]))
        up = st and i < u
        bands.append(((f['band'] if 'band' in f else f"fl.{f['kind']}.{f.get('wall') or 'kinari'}"), ub if up else n, ins if up else 0, f.get('vs', [0])))
    if spec.get('eave'): bands.append((spec['eave'] if isinstance(spec['eave'], str) else 'eave', n, 0, [0]))
    bands.append((spec['ground'], n, 0, spec.get('ground_vs', [0])))
    H = sum(paint_band(b, nb, vs).shape[0] for b, nb, off, vs in bands); im = np.zeros((H, n * 16, 4), np.uint8); y = 0
    floor_y = []; head_y = 0; ground_y = None
    for b, nb, off, vs in bands:
        a = paint_band(b, nb, vs)
        if b.startswith('fl.'): floor_y.append((y, off, nb))
        if b.startswith('gr.'): ground_y = y
        im[y:y + a.shape[0], off * 16:(off + nb) * 16] = a; y += a.shape[0]
    nf = len(floor_y)
    for d in spec.get('decos', []):
        fl = d['floor']; dn = d['deco']
        if dn == 'fe': dn = 'fe_end' if fl == nf - 1 else 'fe'
        if '{c}' in dn: dn = dn.format(c=d['cols'][fl % len(d['cols'])])
        a = DECO[dn]
        yy = (head_y if fl == 'head' else ground_y if fl == 'ground' else floor_y[fl][0]) + 16 * d.get('row', 0)
        for rr in range(a['h']):
            for cc in range(a['w']):
                src = array_of(a['cells'][rr][cc]); sub = im[yy + rr * 16:yy + rr * 16 + 16, (d['col'] + cc) * 16:(d['col'] + cc) * 16 + 16]; m = src[..., 3] > 0; sub[m] = src[m]
    return im

# ───────── 레시피 ─────────
def F(kind, wall='kinari', vs=(0,)): return {'kind': kind, 'wall': wall, 'vs': list(vs)}
CANON = {
  'izakaya_tower': dict(n=6, head='roofsign.aka', door=('noren', 1), roof='roof.ac.tank',
      floors=[F('balcony', 'kinari', [0, 7, 1, 15]), F('balcony', 'kinari', [3, 0, 11]), F('balcony', 'kinari', [1, 5, 0]), F('pairs', 'kinari', [1, 0, 1]), F('pairs', 'kinari', [0, 1, 1])], ground='gr.izakaya',
      decos=[dict(deco='fe', col=3, floor=i) for i in range(5)]),
  'konbini_block': dict(n=6, head=None, door=('auto', 2), roof='roof.ac.tank', floors=[F('curtain', vs=[1, 0, 0]), F('curtain', vs=[0, 1, 0]), F('ribbon', 'hodo', [1, 0, 1])], ground='gr.konbini.0', decos=[]),
  'garage_flats': dict(n=5, head=None, door=('lobby', 3), roof='roof.plain.plain', floors=[F('balcony', 'shiro', [v]) for v in (3, 0, 7, 1, 11, 15)], ground='gr.garage',
      decos=[dict(deco='vstack.{c}', cols=['kii', 'aka'], col=4, floor=i) for i in range(6)]),
  'shutter_office': dict(n=5, head=None, door=('steel', 0), roof='roof.plain.tank', floors=[F('ribbon', 'conc', [1, 0]), F('pairs', 'conc', [1, 2, 2]), F('blank', 'conc'), F('pairs', 'conc', [0, 1])], ground='gr.shutter.sora',
      decos=[dict(deco='wallad.aka', col=0, floor=2), dict(deco='sign_h.kii', col=2, floor=1)]),
  'setback_shop': dict(n=6, head=None, door=('cafe', 2), roof='roof.plain.tank', setback=dict(upper=2, ins=1), floors=[F('pairs', 'kinari', [1, 1]), F('ribbon', 'kinari', [0, 1]), F('ribbon', 'kinari', [1, 0]), F('balcony', 'kinari', [7, 3]), F('balcony', 'kinari', [0, 15])], ground='gr.glass.kii',
      decos=[dict(deco='vstack.{c}', cols=['midori', 'aka', 'sora'], col=5, floor=i) for i in range(2, 5)]),
}
NEW = {
  'narrow_shutter': dict(n=4, head=None, door=('house', 1), roof='roof.plain.plain', floors=[F('pairs', 'shiro', [1, 0]) for _ in range(3)], ground='gr.shutter.aka', decos=[]),
  'wide_konbini': dict(n=8, head='roofsign.sora', door=('auto', 5), roof='roof.ac.plain', floors=[F('curtain', vs=[0, 1]), F('ribbon', 'kinari', [1, 0, 0]), F('pairs', 'kinari', [2, 2, 0, 1, 1])], ground='gr.konbini.1', decos=[dict(deco='sign_h.sora', col=1, floor=2)]),
  'izakaya_alt': dict(n=7, head=None, door=('noren', 0), roof='roof.ac.plain', floors=[F('tile'), F('tile', vs=[1]), F('tile', vs=[0, 1])], ground='gr.izakaya', decos=[dict(deco='fe', col=3, floor=i) for i in range(3)]),
  'garage_tall': dict(n=5, head='roofsign.kii', door=('lobby', 0), roof='roof.plain.tank', floors=[F('blank', 'hodo'), F('blank', 'hodo'), F('pairs', 'hodo', [0, 1])], ground='gr.garage', decos=[dict(deco='wallad.sora', col=0, floor=1)]),
  'big_setback': dict(n=10, head=None, door=('cafe', 4), roof='roof.plain.tank', setback=dict(upper=1, ins=2), floors=[F('ribbon', 'shiro', [1, 0, 1, 0]), F('balcony', 'hodo', [0, 1, 3, 7]), F('balcony', 'hodo', [11, 15, 0]), F('tile', vs=[1, 0])], ground='gr.glass.sora', decos=[]),
}

NEW3 = {
  'machiya_izakaya': dict(n=6, head=None, door=('machiya', 3), roof='roof.hip.slate', eave='eave.slate', floors=[F('koushi', 'kinari', [1, 0, 0, 2]), F('koushi', 'kinari', [0, 2, 0, 0])], ground='gr.machiya', ground_vs=[0, 4, 5, 4],
      decos=[dict(deco='board.izakaya', col=1, floor='ground'), dict(deco='vsign.mark.aka', col=5, floor=0), dict(deco='inuyarai', col=0, floor='ground', row=2)]),
  'sushi_bar': dict(n=5, head=None, door=('noren', 3), roof='roof.hip.slate', eave='eave.slate', floors=[F('pairs', 'shiro', [1, 2, 1])], ground='gr.machiya', ground_vs=[4, 5, 4],
      decos=[dict(deco='vsign.sushi', col=4, floor=0), dict(deco='mushiko', col=2, floor=0), dict(deco='inuyarai', col=0, floor='ground', row=2)]),
  'ramen_tower': dict(n=7, head='roofsign.aka', door=('steel', 5), roof='roof.plain.plain', floors=[F('ribbon', 'conc', [1, 0]), F('pairs', 'conc', [3, 2, 1, 0, 1]), F('balcony', 'conc', [7, 0, 3])], ground='gr.shutter.aka',
      decos=[dict(deco='rtext.ramen', col=1, floor='head'), dict(deco='plate.mark.midori', col=1, floor=1), dict(deco='vsign.mark.kii', col=6, floor=0)]),
  'bento_corner': dict(n=5, head=None, door=('auto', 3), roof='roof.plain.tank', floors=[F('pairs', 'kinari', [2, 2, 1]), F('pairs', 'kinari', [1, 2, 2])], ground='gr.konbini.1',
      decos=[dict(deco='plate.bento', col=1, floor=0), dict(deco='vsign.mark.sora', col=4, floor=0)]),
  'sento_front': dict(n=7, head=None, door=('machiya', 2), roof='roof.hip.slate', eave='eave.slate', floors=[F('tile'), F('koushi', 'shiro', [0, 3, 0, 3, 0])], ground='gr.machiya', ground_vs=[5, 4, 5, 4],
      decos=[dict(deco='vsign.sento', col=6, floor=0), dict(deco='inuyarai', col=5, floor='ground', row=2)]),
}

NEW4 = {
  'danchi_flats': dict(n=6, head=None, door=('lobby', 2), roof='roof.plain.tank', floors=[F('balcony', 'hodo', [3, 11, 0, 7]) for _ in range(4)], ground='gr.garage',
      decos=[dict(deco='pipe', col=5, floor=i) for i in range(4)]),
  'bar_row': dict(n=5, head='roofsign.sora', door=('noren', 2), roof='roof.ac.plain', floors=[F('pairs', 'kinari', [1, 2]), F('pairs', 'kinari', [2, 1])], ground='gr.izakaya',
      decos=[dict(deco='ac.1', col=2, floor=0), dict(deco='ac.0', col=1, floor=1), dict(deco='pipe', col=4, floor=0), dict(deco='pipe', col=4, floor=1)]),
  'office_shutter': dict(n=6, head=None, door=('steel', 4), roof='roof.plain.tank', floors=[F('ribbon', 'shiro', [1, 0, 1]), F('pairs', 'shiro', [1, 2, 1]), F('pairs', 'shiro', [2, 1, 1])], ground='gr.shutter.kii',
      decos=[dict(deco='ac.0', col=2, floor=1), dict(deco='ac.1', col=1, floor=2), dict(deco='pipe', col=5, floor=1), dict(deco='pipe', col=5, floor=2)]),
}

LSPEC = {
  'L_office_cafe': dict(side='L', depth=2, yard='lot',
      main=dict(n=7, head=None, roof='roof.plain.tank', floors=[F('ribbon', 'shiro', [1, 0, 1]), F('pairs', 'shiro', [1, 2, 1, 0]), F('pairs', 'shiro', [0, 1, 1, 2])], ground='gr.shutter.sora',
                decos=[dict(deco='ac.0', col=2, floor=1), dict(deco='pipe', col=6, floor=1), dict(deco='pipe', col=6, floor=2)]),
      wing=dict(n=3, head=None, roof='roof.plain.plain', floors=[], ground='gr.glass.kii', door=('cafe', 1), decos=[])),
  'L_machiya_annex': dict(side='L', depth=2, yard='sw',
      main=dict(n=7, head=None, roof='roof.hip.slate', eave='eave.slate', floors=[F('koushi', 'kinari', [1, 0, 0, 2, 0]), F('koushi', 'kinari', [0, 2, 0, 0, 1])], ground='gr.machiya', ground_vs=[0, 4, 5, 4, 5], decos=[dict(deco='board.shokudo', col=1, floor='ground')]),
      wing=dict(n=3, head=None, roof='roof.hip.slate', floors=[], ground='gr.machiya', ground_vs=[4], door=('house', 1), decos=[dict(deco='inuyarai', col=0, floor='ground', row=2)])),
  'L_flats_lot': dict(side='L', depth=3, yard='lot',
      main=dict(n=7, head=None, roof='roof.stair.cyl', floors=[F('veranda', 'conc', [3, 5, 1]) for _ in range(4)], ground='gr.garage', decos=[dict(deco='pipe', col=6, floor=i) for i in range(4)]),
      wing=dict(n=4, head=None, roof='roof.plain.tank', floors=[F('pairs', 'kinari', [1, 2]), F('pairs', 'kinari', [2, 1])], ground='gr.konbini.1', door=('auto', 2), decos=[dict(deco='plate.mark.sora', col=1, floor=0)])),
}

# ───────── 배치 규칙 검사: 층 부착물이 창을 가리는가 ─────────
WINDOWLESS = {('pairs', 2), ('blank', 0), ('slide', None)}
def lint_decos(name, spec):
    """sign_h/plate/sunshade/ac/laundry/wallad/vsign 이 창 열 위에 얹히면 위반. pairs 의 변형 2 = 빈 벽."""
    bad = []; n = spec['n']
    for d in spec.get('decos', []):
        fl = d['floor']
        if not isinstance(fl, int): continue
        dn = d['deco']
        if dn.split('.')[0] not in ('sign_h', 'plate', 'sunshade', 'ac', 'laundry', 'wallad', 'vsign', 'mushiko'): continue
        if dn.startswith('vsign'): continue       # 세로 간판은 우측 기둥 열에 붙이는 규칙(문 열 제외)
        f = spec['floors'][fl]; kind = f['kind']; vs = f.get('vs', [0]); mw = FLOORS[kind][0]
        D = DECO[Kit_deco_name(d, fl, len(spec['floors']))]; st = spec.get('setback'); off = (st['ins'] if st and fl < st['upper'] else 0)
        for cc in range(D['w']):
            col = d['col'] + cc - off - 1       # 모듈 열(좌끝 L 칸 제외)
            if col < 0 or col >= (n - 2 * off) - 3: continue
            k = col // mw; v = vs[k % len(vs)]
            if kind == 'blank': continue
            if kind == 'pairs' and (v & 2): continue
            bad.append((name, f"floor{fl}", dn, d['col'] + cc)); break
    return bad
def Kit_deco_name(d, fl, nf):
    dn = d['deco']
    if dn == 'fe': dn = 'fe_end' if fl == nf - 1 else 'fe'
    if '{c}' in dn: dn = dn.format(c=d['cols'][fl % len(d['cols'])])
    return dn

NEW5 = {
  'mansion_veranda': dict(n=7, head=None, roof='roof.stair.cyl', door=('lobby', 4), floors=[F('veranda', 'shiro', v) for v in ([1, 2, 4], [0, 5, 2], [3, 4, 1], [1, 0, 6], [6, 1, 3])], ground='gr.garage',
      decos=[dict(deco='pipe', col=6, floor=i) for i in range(5)]),
  'office_slide': dict(n=5, head=None, roof='roof.ac.cyl', door=('steel', 1), floors=[F('slide', 'kinari', [1, 5, 0]), F('slide', 'kinari', [2, 1, 4]), F('slide', 'kinari', [5, 0, 3])], ground='gr.shutter.kii',
      decos=[dict(deco='pipe', col=4, floor=0), dict(deco='pipe', col=4, floor=1), dict(deco='pipe', col=4, floor=2)]),
  'mixed_tenant': dict(n=7, head=None, roof='roof.stair.plain', door=('auto', 4), floors=[F('slide', 'conc', [1, 0, 5, 1, 0]), F('slide', 'conc', [0, 1, 4, 0, 1]), F('pairs', 'conc', [2, 2, 1, 0, 1]), F('veranda', 'conc', [1, 5, 0])], ground='gr.konbini.0',
      decos=[dict(deco='plate.mark.sora', col=1, floor=2), dict(deco='pipe', col=6, floor=0), dict(deco='pipe', col=6, floor=1)]),
  'slim_tower': dict(n=4, head='roofsign.kii', roof='roof.ac.cyl', door=('cafe', 0), floors=[F('slide', 'hodo', [1, 0]), F('slide', 'hodo', [0, 5]), F('slide', 'hodo', [5, 1])], ground='gr.glass.sora', decos=[]),
}
