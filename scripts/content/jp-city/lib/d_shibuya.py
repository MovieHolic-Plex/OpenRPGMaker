from dcommon import *
import os, jpenv
os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True)
import jfont
# (칩셋은 이미 최신 — export2.export() 는 호출하지 않는다)
kit = load(); rng = random.Random(11)
NC, NR = 96, 64
d = District(kit, NC, NR)

# ------------------------------------------------------------------ 스크립트 로컬 도구 (부품 파일은 건드리지 않는다)
_cc = {}; _cp = {}
_orig_cell = kit.cell; _orig_pi = kit.prop_image
kit.cell = lambda name: _cc[name] if isinstance(name, str) and name in _cc else _orig_cell(name)
kit.prop_image = lambda name: _cp[name] if name in _cp else _orig_pi(name)

def reg_prop(name, arr, solid_base=False):
    """스크립트 안에서 만든 그림(간판·전선)을 소품으로 등록. 막힘 없음(solid_base 면 밑동만 막힘)."""
    h, w = arr.shape[0] // 16, -(-arr.shape[1] // 16)
    if arr.shape[1] % 16: arr = np.pad(arr, ((0, 0), (0, w * 16 - arr.shape[1]), (0, 0)))
    if arr.shape[0] % 16: arr = np.pad(arr, ((0, 16 - arr.shape[0] % 16), (0, 0), (0, 0))); h = arr.shape[0] // 16
    _cp[name] = arr
    kit.props[name] = dict(w=w, h=h, walk=[['C'] * w for _ in range(h)], cells=None, layer=None, desc='local')

def draw_text(a, x, y, text, fg, sh=None, scale=1, gap=1, bold=False):
    for ch in text:
        g = jfont.glyph(ch)
        if scale > 1: g = np.kron(g, np.ones((scale, scale), np.uint8))
        offs = [(1, 1)] if sh is not None else []
        for (ox, oy, col) in ([(1, 1, sh)] if sh is not None else []) + [(0, 0, fg)] + ([(1, 0, fg)] if bold else []):
            for yy in range(g.shape[0]):
                for xx in range(g.shape[1]):
                    if g[yy, xx]:
                        py, px = y + yy + oy, x + xx + ox
                        if 0 <= py < a.shape[0] and 0 <= px < a.shape[1]: a[py, px, :3] = col; a[py, px, 3] = 255
        x += g.shape[1] + gap
    return x

def text_w(text, scale=1, gap=1): return len(text) * (16 * scale + gap) - gap

def make_board(name, wc, hc, bg, fg, text, scale=1, gap=2, bezel=(44, 44, 58), band=None, shadow=True):
    a = np.zeros((hc * 16, wc * 16, 4), np.uint8); H, W = a.shape[:2]
    a[1:H - 1, 1:W - 1] = (*bezel, 255); a[3:H - 3, 3:W - 3] = (*bg, 255)
    hi = tuple(min(255, int(v * 1.25) + 10) for v in bg); lo = tuple(int(v * .65) for v in bg)
    a[3:5, 3:W - 3, :3] = hi; a[H - 6:H - 3, 3:W - 3, :3] = lo
    if band: a[H - 7:H - 4, 3:W - 3, :3] = band
    tw = text_w(text, scale, gap); th = 16 * scale
    draw_text(a, (W - tw) // 2, (H - th) // 2 - 1, text, fg, tuple(int(v * .35) for v in bg) if shadow else None, scale, gap)
    reg_prop(name, a); return name

# 지구 전용 아치: 센터가이 (기존 아치의 몸통에 글자판만 다시 칠한다)
_arch = kit.prop_image('arch_centergai').copy()
_arch[12:29, 6:154, :3] = (40, 126, 168)
draw_text(_arch, 38, 12, 'センター街', (246, 241, 252), (10, 40, 71), 1, 4, bold=True)
reg_prop('arch_center', _arch); kit.props['arch_center']['walk'] = [['C'] * 10 for _ in range(4)] + [['S'] + ['C'] * 8 + ['S']]

# 역명 판 / 지붕 간판 (가공 상호)
make_board('b_ekimei', 8, 2, (240, 244, 240), (30, 90, 56), 'ＪＲ渋谷駅', 1, 4, bezel=(58, 120, 80), band=(60, 160, 90), shadow=False)
make_board('b_ekimei_s', 6, 2, (240, 244, 240), (30, 90, 56), '渋谷駅', 1, 6, bezel=(58, 120, 80), band=(60, 160, 90), shadow=False)
make_board('b_led', 8, 4, (24, 30, 70), (120, 230, 255), '渋谷発', 2, 4, bezel=(30, 30, 40))
make_board('b_mode', 8, 2, (200, 50, 70), (255, 240, 220), 'モード渋谷', 1, 3)
make_board('b_don', 6, 2, (240, 200, 50), (150, 20, 20), '激安市場', 1, 2)
make_board('b_karaoke', 6, 2, (60, 60, 90), (255, 220, 120), 'カラオケ', 1, 2)
make_board('b_furu', 4, 2, (230, 120, 60), (255, 255, 240), '古着', 1, 6)
make_board('b_yaku', 5, 2, (50, 160, 90), (255, 255, 255), 'くすり堂', 1, 2)
make_board('b_game', 5, 2, (130, 70, 170), (255, 240, 120), 'ゲーム館', 1, 2)
make_board('b_ramen', 6, 2, (180, 40, 40), (255, 235, 180), '麺屋ひかり', 1, 0)
make_board('b_hotel', 6, 2, (60, 40, 90), (230, 200, 255), 'ホテル月', 1, 2)
make_board('b_live', 4, 2, (30, 30, 36), (255, 120, 180), '音箱', 1, 6)

def wire(name, x0, y0, x1, y1, sag=6):
    """전선: 두 점 사이 늘어진 1px 선(투명 배경 소품). 반환 (그림 좌상단 x,y)."""
    w = abs(x1 - x0) + 2; hh = abs(y1 - y0) + sag + 3
    a = np.zeros((hh, w, 4), np.uint8)
    xa, ya = (x0, y0) if x0 <= x1 else (x1, y1); xb, yb = (x1, y1) if x0 <= x1 else (x0, y0)
    for x in range(xa, xb + 1):
        t = (x - xa) / max(1, xb - xa); y = ya + (yb - ya) * t + sag * 4 * t * (1 - t)
        a[int(round(y - min(ya, yb))), x - xa] = (38, 36, 48, 255)
        a[int(round(y - min(ya, yb))) + 1, x - xa] = (38, 36, 48, 110)
    reg_prop(name, a); return (xa, min(ya, yb))

def overlay(name, x, y, key, z=1):
    """건물 위에 얹는 그림(간판 등). 픽셀 좌표 (x,y)=좌상단, key 는 그리는 순서(행 단위)."""
    d.items.append((key, z, 'propx', name, x, y))

# ------------------------------------------------------------------ 격자
BASE1, BASE2 = 18, 60
ROAD0, ROAD1 = 22, 40
X0, X1 = 38, 59                    # 스크램블 칸 (횡단보도로 둘러싸인 사각형)
ARM0, ARM1 = 46, 57                # 북쪽 팔 (센터가이 방향 도로) 12칸
CG0, CG1 = 25, 34                  # 센터가이 입구 거리 10칸
SW_N = (44, 45, 58, 59)            # 팔 양옆 인도
d.fill(0, 0, NR, NC, 'sw')
d.hline(19, 0, NC, 'sw_shade')
# 동서 도로
d.fill(ROAD0, 0, ROAD1 + 1, NC, 'road_c'); d.hline(ROAD0, 0, NC, 'road_n'); d.hline(ROAD1, 0, NC, 'road_s')
for c in range(NC):
    if c < 33 or c > 64: d.set(31, c, 'road_dash')
# 북쪽 팔: 12칸 도로 + 양옆 인도 (건물이 양옆을 막는다)
ARMTOP = 9
d.fill(ARMTOP, ARM0, ROAD0, ARM1 + 1, 'road_c')
for r in range(ARMTOP, ROAD0): d.set(r, 52, 'lot_line')                  # 중앙선(실선)
for c in range(52, ARM1 + 1): d.set(21, c, 'lane_stop')                  # 남행(동쪽 반: 좌측통행) 정지선
for c in range(ARM0, ARM1 + 1): d.set(ARMTOP, c, 'road_n')
for c in range(ARM0, 52): d.set(16, c, 'manhole') if c == 49 else None
for r in range(0, 22):
    for c in (44, 45, 58, 59): d.set(r, c, 'sw_shade' if r == 19 else 'sw')
for c in range(ARM0 - 2, ARM1 + 3): d.set(8, c, 'sw')
# 센터가이 보행자 거리
for r in range(0, 22):
    for c in range(CG0, CG1 + 1): d.set(r, c, 'pave_b' if (r // 2 + c) % 3 == 0 else 'pave_a')
# 남쪽 인도 + 철도 아래 + 역 앞
d.fill(41, 0, NR, NC, 'sw'); d.hline(41, 0, NC, 'sw_shade'); d.hline(54, 0, NC, 'sw_shade')

# --- 횡단보도: 줄은 차량 진행과 평행 (남북 도로 횡단=세로줄 vz_c, 동서 도로 횡단=가로줄 zeb_*)
for c in range(X0, X1 + 1):
    for r in range(ROAD0, ROAD0 + 4): d.set(r, c, 'vz_c')
    for r in range(ROAD1 - 3, ROAD1 + 1): d.set(r, c, 'vz_c')
for r in range(ROAD0, ROAD1 + 1):
    kind = 'n' if r == ROAD0 else 's' if r == ROAD1 else 'c'
    for c in list(range(X0 - 4, X0)) + list(range(X1 + 1, X1 + 5)): d.set(r, c, 'zeb_' + kind)

# --- 대각 횡단보도: 북서 모퉁이 → 남동 모퉁이 (두 모퉁이에 닿게, 줄은 걷는 방향과 직각)
_road = _orig_cell(kit.street['road_c'])
def diag_cells(p0, p1, half=26, per=14, bar=7):
    (x0, y0), (x1, y1) = p0, p1; L = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** .5; ux, uy = (x1 - x0) / L, (y1 - y0) / L
    cells = {}
    for r in range(int(min(y0, y1) // 16) - 3, int(max(y0, y1) // 16) + 4):
        for c in range(int(min(x0, x1) // 16) - 3, int(max(x0, x1) // 16) + 4):
            a = _road.copy(); hit = False
            for py in range(16):
                for px in range(16):
                    X, Y = c * 16 + px + .5, r * 16 + py + .5; al = (X - x0) * ux + (Y - y0) * uy; pe = (X - x0) * -uy + (Y - y0) * ux
                    if 0 <= al <= L and abs(pe) <= half and (al % per) < bar: a[py, px] = (236, 232, 244, 255); hit = True
            if hit: cells[(r, c)] = a
    return cells
for (r, c), a in diag_cells((X0 * 16, ROAD0 * 16), ((X1 + 1) * 16, (ROAD1 + 1) * 16), half=32).items():
    if ROAD0 + 4 <= r <= ROAD1 - 4 and X0 <= c <= X1:
        _cc[f'dz{r}_{c}'] = a; d.set(r, c, f'dz{r}_{c}')

# 정지선 (동행=북쪽 차선은 횡단보도 서쪽 끝 앞, 서행=남쪽 차선은 동쪽 끝 앞)
for r in range(ROAD0 + 1, 31): d.set(r, 33, 'stop_c')
for r in range(32, ROAD1): d.set(r, 64, 'stop_c')
# 점자블록: 연석에서 한 칸 안쪽 줄 (횡단보도 끝)
for c in list(range(34, 46)) + list(range(58, 64)): d.set(20, c, 'tactile_dot')
for c in range(34, 64): d.set(42, c, 'tactile_dot')

# ------------------------------------------------------------------ 건물
def gen_(fam, n, nf, seed): return G.gen(kit, fam, n, nf, seed)
def row_bld(c0, c1, fams, base, tops, wmin=5, wmax=10, minf=1, maxf=9, rg=None, vis_every=0, no_vis=()):
    """c0..c1 를 건물로 채운다. 건물마다 상단 행(tops 중 무작위)이 달라 스카이라인이 들쭉날쭉."""
    rg = rg or rng; out = []; c = c0; i = 0
    while c1 - c >= wmin:
        w = rg.randint(wmin, wmax)
        if c1 - (c + w) < wmin: w = c1 - c
        fam = rg.choices([f for f, _ in fams], [x for _, x in fams])[0]
        if fam == 'mansion' and w < 5: w = 5
        top = rg.choice(tops); avail = base - top + 1
        spec = fit_spec(kit, fam, w, avail, rg, minf, maxf); spec['head'] = None
        out.append((c, w, fam, spec)); d.building(spec, c, base); c += w; i += 1
    return out

def free_put(name, c, row, **kw):
    for dc in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5):
        if safe_put(d, name, c + dc, row, **kw): return c + dc
    return None
def rear(c0, c1, base=8, seed=1):
    """앞 건물 뒤(위)에 깔리는 뒷줄 건물. 앞줄이 낮은 곳에서만 보인다. 문은 등록하지 않는다."""
    rr = random.Random(seed); c = c0; n0 = len(d.doors)
    while c1 - c >= 5:
        w = rr.randint(5, 9)
        if c1 - (c + w) < 5: w = c1 - c
        fam = rr.choice(['office', 'mansion', 'retail', 'bar'])
        spec = fit_spec(kit, fam, max(w, 5 if fam == 'mansion' else w), base + 1, rr, 2, 9); spec['head'] = None
        d.building(spec, c, base); c += w
    del d.doors[n0:]
rb = random.Random(5)
# 서쪽 블록 (0-24): 오래된 잡거빌딩·바·맨션 혼합. 14~17 칸은 뒷골목(전봇대·자판기)
rear(0, 25, 8, 1); rear(60, NC, 8, 2)
W1 = row_bld(0, 13, [('office', 3), ('bar', 1), ('retail', 2)], BASE1, [3, 5, 7, 9], 5, 8, rg=rb)
W2 = row_bld(17, CG0, [('mansion', 3), ('izakaya', 2), ('retail', 2), ('office', 2)], BASE1, [3, 5, 8, 10], 4, 8, rg=rb)
# 동쪽 블록 (60-95)
E_bld = row_bld(72, NC, [('office', 3), ('mansion', 3), ('retail', 2), ('bar', 1)], BASE1, [3, 5, 8, 11], 5, 9, rg=rb)
# QFRONT 풍 코너 빌딩 (유리 커튼월 + LED 벽): 북서
spec_q = None
for t in range(300):
    s = gen_('retail', 9, 7, 1000 + t)
    if all(f['kind'] in ('curtain', 'ribbon', 'pairs') for f in s['floors']) and sum(1 for f in s['floors'] if f['kind'] == 'curtain') >= 3 and kit.assemble(s)['rows'] >= 15 and kit.assemble(s)['rows'] <= 17: spec_q = s; break
spec_q = spec_q or fit_spec(kit, 'retail', 9, 17, random.Random(3), 6, 9)
spec_q['head'] = None; d.building(spec_q, 35, BASE1)
# 원통 타워 풍 패션 빌딩: 북동 코너
spec_t = None
for t in range(300):
    s = gen_('retail', 11, 6, 2000 + t); s['roof'] = 'roof.plain.cyl'
    if sum(1 for f in s['floors'] if f['kind'] in ('curtain', 'ribbon')) >= 4 and kit.assemble(s)['rows'] >= 13 and kit.assemble(s)['rows'] <= 16: spec_t = s; break
spec_t = spec_t or fit_spec(kit, 'retail', 11, 16, random.Random(4), 5, 8)
spec_t['head'] = None; d.building(spec_t, 60, BASE1)
# 북동 중간 (71 은 비움: 뒷골목 하나) — 66~71 사이 2번째 빌딩
d.building(vis(fit_spec(kit, 'office', 11, 15, random.Random(8), 5, 8), 'facade_ad.1', 3, 1), 71, BASE1) if False else None
d.fill(0, 71, 19, 72, 'sw')

# 북쪽 팔 끝: 도겐자카 쪽을 막아선 대형 판매빌딩 (남향)
spec_h = fit_spec(kit, 'retail', 16, 9, random.Random(14), 4, 8); spec_h['head'] = None
d.building(vis(spec_h, 'facade_ad.1', 4, 1) if False else spec_h, 44, 7)
# 남쪽: 고가(JR) — 전 폭, 역 중앙은 통로·점포
VIA = ['viaduct6_shops', 'viaduct6', 'viaduct6_pass', 'viaduct6', 'viaduct6_shut', 'viaduct6_shops', 'viaduct6', 'viaduct6_pass', 'viaduct6_pass', 'viaduct6', 'viaduct6_shops', 'viaduct6', 'viaduct6_shut', 'viaduct6', 'viaduct6_shops', 'viaduct6']
for i, v in enumerate(VIA): d.put(v, i * 6, 53, solid=False)
VBASE_T = 49
rt = random.Random(9); c = -3
while c < NC:   # 승강장 위 전철: 끝까지 이어 붙인다 (편성마다 색이 다름)
    nm = rt.choice(['train10', 'train10_b', 'train8', 'train8_g', 'train8_y', 'train8_b', 'train10_y']); d.put(nm, c, VBASE_T, solid=False); c += kit.props[nm]['w']
for c in range(4, NC, 12): d.put('catenary_pole', c, VBASE_T + 1, solid=False)
# 철도 아래(남쪽) 가장자리 건물: 서쪽 코인주차장 + 상점, 동쪽 상점
rs = random.Random(21)
S_W = row_bld(18, 36, [('izakaya', 3), ('bar', 2), ('retail', 2)], BASE2, [54, 55], 4, 7, 1, 3, rg=rs)
S_E = row_bld(62, NC, [('retail', 3), ('izakaya', 2), ('bar', 2), ('mansion', 1)], BASE2, [54, 55], 4, 8, 1, 3, rg=rs)
# 역 앞 광장: 포장 + 버스·택시 승강장 (도로)
for r in range(55, NR):
    for c in range(36, 62): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
for r in range(58, 64):
    for c in range(36, 62): d.set(r, c, 'road_c')
for c in range(36, 62): d.set(58, c, 'road_n'); d.set(63, c, 'road_s')
# 코인주차장 (서쪽 아래)
for r in range(55, NR):
    for c in range(0, 18): d.set(r, c, 'lot')
for r in range(55, 63):
    for c in range(0, 18):
        if c % 6 == 0: d.set(r, c, 'lot_line')
for c in (2, 8, 14): d.set(55, c, 'lot_num'); d.set(59, c, 'lot_num')
for c in range(0, 18): d.set(63, c, 'sw')

# ------------------------------------------------------------------ 소품
# 센터가이 아치(입구, 서쪽 인도 끝) + 이름 간판 건물 꼭대기
d.put('arch_center', CG0, 21, solid=False)
d.put('neon_stack.1', 23, 16, solid=False)
d.put('string_lanterns4', 28, 16, solid=False); d.put('a_frame', 26, 15) if False else None
for r, c, nm in ((14, 26, 'a_frame'), (16, 33, 'a_frame'), (9, 25, 'garbage_net'), (12, 33, 'bench'), (6, 26, 'vend_pair')):
    safe_put(d, nm, c, r, solid=False)
# 북쪽 팔 인도: 가로등·화분·표지, 공사 구간(이 팔은 장례 신호로 정차 중)
for r in (4, 11, 17): d.put('lamp_post', 44, r, solid=False); d.put('lamp_post', 59, r + 2, solid=False)
for r, nm in ((7, 'pot'), (14, 'pot'), (20, 'pot')): d.put(nm, 45, r, solid=False)
d.put('roadsign', 58, 9, solid=False); d.put('street_flag', 45, 6, solid=False); d.put('bollard', 44, 20, solid=False); d.put('bollard', 59, 20, solid=False)
for c in (46, 47, 48): d.put('cone', c, 8, solid=False)
d.put('barricade3', 46, 7, solid=False); d.put('barricade3', 49, 7, solid=False)
d.put('signal_overhead', 52, 9, solid=False)
# 신호기 (모퉁이 4개)
free_put('signal', 37, 21); free_put('signal', 62, 21); d.put('signal', 36, 44); d.put('signal', 60, 44)
# 도시 가구: 자판기·자전거 거치대·벤치·가로수(적게, 비대칭)
for r, c, nm in ((19, 12, 'vend_pair'), (21, 40, 'bench'), (21, 62, 'planter'), (21, 66, 'bike_rack'), (21, 82, 'vend_trio'), (21, 91, 'bike_cluster'), (21, 5, 'bike_rack'), (21, 19, 'planter')):
    safe_put(d, nm, c, r, solid=False)
for r, c, nm in ((44, 3, 'vend_trio'), (44, 9, 'bike_rack'), (44, 14, 'bench'), (44, 22, 'vend_pair'), (45, 28, 'planter'), (44, 33, 'bike_cluster'),
                 (44, 76, 'planter'), (45, 82, 'vend_trio'), (44, 88, 'bike_rack'), (44, 93, 'vend_pair'), (45, 70, 'bench')):
    safe_put(d, nm, c, r, solid=False)
free_put('tree.zelkova', 67, 21, solid=False); free_put('tree.zelkova', 93, 21, solid=False); d.put('tree.zelkova', 56, 43, solid=False); d.put('tree.zelkova', 20, 45, solid=False)
# 남동 모퉁이: 하치코·지하철 출구·JR 개찰 출입구·전시 전차(청개구리)
d.put('hachiko', 62, 45); d.put('metro_exit', 66, 45)
d.put('train8_g', 71, 44, solid=False)
d.put('station_gate', 79, 45) if False else None
d.put('smoking_area', 91, 45, solid=False)
# 역사: 역명 판 (선로 위 승강장·고가 벽면) + 개찰 출입구
overlay('b_ekimei_s', 44 * 16, 44 * 16, 43.0)
overlay('b_ekimei', 44 * 16, 50 * 16, 53.4)
d.put('station_gate', 45, 57, solid=False); d.put('station_gate', 51, 57, solid=False)
for c in (36, 55): d.put('lamp_post', c, 57, solid=False)
for c in (40, 58): d.put('bench', c, 56, solid=False)
d.put('roadsign', 52, 62, solid=False); d.put('roadsign', 38, 62, solid=False)
for c in (38, 44, 50): d.put('car.taxi_r', c, 60, solid=False)
d.put('bus_r', 37, 63, solid=False); d.put('bus_r', 48, 63, solid=False); d.put('car.taxi', 58, 63, solid=False)
# 주차장: 주차 차량 + 요금 표지
for c, nm in ((0, 'car.silver'), (12, 'car.red'), (6, 'car.white')): d.put(nm, c + 1, 58, solid=False)
for c, nm in ((0, 'van.white'), (6, 'car.navy')): d.put(nm, c + 1, 62, solid=False)
d.put('coin_sign', 17, 57, solid=False); d.put('coin_p', 0, 54) if False else None; d.put('coin_p', 17, 62, solid=False); d.put('bike_rack', 14, 62, solid=False)
# 뒷골목 (13~16 열): 전봇대 + 전선, 쓰레기, 자판기
P1 = free_put('utility_pole2', 14, 20, solid=False); P2 = free_put('utility_pole2', 22, 19, solid=False)
P3 = free_put('utility_pole2', 78, 20, solid=False); P4 = free_put('utility_pole2', 88, 21, solid=False)
print('poles', P1, P2, P3, P4)
def pole_top(c, row): return (c * 16 + 7, (row - 4) * 16 + 8)
Pr = [(P1, 20), (P2, 19), (P3, 20), (P4, 21)]
for i, ((pa, ra), (pb, rb_)) in enumerate(((Pr[0], Pr[1]), (Pr[2], Pr[3]))):
    if pa is None or pb is None: continue
    for j, off in enumerate((0, 3, 6)):
        xa, ya = pole_top(pa, ra); xb, yb = pole_top(pb, rb_)
        x, y = wire(f'w{i}{j}', xa, ya + off, xb, yb + off, 5 + j); overlay(f'w{i}{j}', x, y, 21.1)

# 간판: 지붕 위 (창을 가리지 않게) + 건물별 서로 다른 가공 상호
def roof_y(spec, base): return (base + 1 - kit.assemble(spec)['rows']) * 16
rsg = random.Random(77)
SIGN = ['b_don', 'b_karaoke', 'b_furu', 'b_yaku', 'b_game', 'b_ramen', 'b_hotel', 'b_live']
rsg.shuffle(SIGN)
for (c, w, fam, spec) in W1 + W2 + E_bld:
    if not SIGN or w < 5: continue
    ry = roof_y(spec, BASE1)
    if ry < 40 or rsg.random() < .35: continue
    nm = SIGN.pop(); sw = kit.props[nm]['w']
    if sw > w: SIGN.insert(0, nm); continue
    overlay(nm, (c + (w - sw) // 2) * 16, ry - 26, BASE1 + .4)
# 대형 비전/간판: 교차로 쪽을 향한 건물
ry = roof_y(spec_q, BASE1)
overlay('b_led', 36 * 16, ry + 5 * 16, BASE1 + .45)                       # QFRONT 풍 LED 벽
ry = roof_y(spec_t, BASE1); overlay('b_mode', 61 * 16 + 8, ry - 26, BASE1 + .45)

# ------------------------------------------------------------------ 차량 (좌측통행: 동행=북쪽 차선)
def veh_lane(base, c0, c1, east, rg, dense_end):
    """dense_end: 'hi' 면 c1 쪽(정지선 앞)에서 빽빽하게, 'lo' 면 c0 쪽에서 빽빽하게."""
    kinds = [('car.white', 4), ('car.silver', 3), ('car.black', 3), ('car.blue', 2), ('car.red', 1), ('car.green', 1), ('car.navy', 2), ('car.taxi', 3), ('van.white', 2), ('bus', 1), ('ad_truck', 1)]
    ns = [k for k, _ in kinds]; ws = [w for _, w in kinds]
    out = []; pos = (c1 - 2) if dense_end == 'hi' else (c0 + 1)
    while True:
        nm = rg.choices(ns, ws)[0]
        if not east:
            nm = {'van.white': 'van.silver_r'}.get(nm, nm + '_r')
        P = kit.props[nm]; w = P['w']
        if dense_end == 'hi':
            c = pos - w
            if c < c0: break
            pos = c - rg.choice([1, 1, 2, 2, 3])
        else:
            c = pos
            if c + w > c1: break
            pos = c + w + rg.choice([1, 1, 2, 2, 3])
        d.put(nm, c, base, solid=False)
for base, east in ((25, True), (29, True), (35, False), (39, False)):
    rgc = random.Random(base * 7)
    if east: veh_lane(base, 0, 32, True, rgc, 'hi'); veh_lane(base, 65, NC - 1, True, random.Random(base * 3), 'lo')
    else: veh_lane(base, 65, NC - 1, False, rgc, 'lo'); veh_lane(base, 0, 32, False, random.Random(base * 3), 'hi')

# ------------------------------------------------------------------ 군중 (모퉁이·횡단보도 끝에 몰고, 중앙은 성기게)
def crowd_(r0, r1, c0, c1, n, kinds=40): crowd(d, rng, r0, r1, c0, c1, n, kinds)
crowd_(19, 21, 34, 45, 18); crowd_(19, 21, 58, 66, 14); crowd_(42, 44, 33, 41, 14); crowd_(42, 44, 54, 66, 16)      # 네 모퉁이 대기
crowd_(ROAD0 + 3, ROAD0 + 3, X0, X1 - 1, 14); crowd_(ROAD1 - 3, ROAD1 - 3, X0, X1 - 1, 14)                        # 북·남 횡단
crowd_(ROAD0 + 5, ROAD1 - 2, X0 - 3, X0 - 1, 14); crowd_(ROAD0 + 5, ROAD1 - 2, X1 + 1, X1 + 3, 14)                  # 서·동 횡단
crowd_(ROAD0 + 5, ROAD1 - 4, X0 + 3, X1 - 3, 14)                                                                  # 대각
crowd_(4, 20, CG0, CG1 - 1, 26); crowd_(19, 21, 0, 32, 12); crowd_(19, 21, 70, NC - 4, 10)
crowd_(41, 45, 0, 32, 12); crowd_(41, 45, 67, NC - 4, 10); crowd_(55, 57, 37, 58, 12); crowd_(59, 62, 0, 20, 2)
crowd_(1, 20, 44, 45, 5); crowd_(1, 20, 58, 59, 5)
# 남쪽 가장자리 인도: 자판기·자전거·벤치·화단·가로수로 용도를 준다
for r, c, nm in ((62, 20, 'vend_trio'), (62, 27, 'bike_rack'), (63, 31, 'planter'), (62, 66, 'vend_pair'), (63, 72, 'bike_cluster'), (62, 78, 'bench'),
                 (62, 84, 'vend_trio'), (63, 90, 'planter'), (63, 25, 'garbage_net'), (63, 70, 'garbage_net')):
    safe_put(d, nm, c, r, solid=False)
free_put('tree.ginkgo', 75, 63, solid=False); free_put('lamp_post', 64, 62, solid=False); free_put('lamp_post', 82, 62, solid=False); free_put('lamp_post', 22, 62, solid=False)
im = d.render()
Image.fromarray(im).save(os.path.join(jpenv.DISTRICTS_OUT, 'district_shibuya_v2.png'))
print(im.shape)
check(d, 'shibuya')
