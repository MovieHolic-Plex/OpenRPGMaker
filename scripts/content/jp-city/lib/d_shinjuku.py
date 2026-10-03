from dcommon import *
import os, jpenv
os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True)
#import export2                         # 칩셋은 이미 최신 (감독자가 내보냄)
#export2.export()
import v2misc as M2
kit = load(); rng = random.Random(31)
NC, NR = 96, 64
d = District(kit, NC, NR)

# ───────────────────────── 맞춤 부품: 일번가 게이트 (고유 지명 대신 일반 명칭) ─────────────────────────
def reg_arch(name, text, w):
    cv = M2.arch_gate(text, w); arr = np.asarray(cv.a).copy(); h = arr.shape[0] // 16
    kit.props[name] = dict(w=w, h=h, walk=[['C'] * w for _ in range(h - 1)] + [['S'] + ['C'] * (w - 2) + ['S']], cells=None)
    prev = kit.prop_image
    kit.prop_image = lambda n, _p=prev, _a=arr, _n=name: _a if n == _n else _p(n)
reg_arch('arch_ichibangai', '一番街', 8)

# ───────────────────────── 행 배치 (3/4 시점, 1칸=16px) ─────────────────────────
BN = 8                   # 북열 건물 밑동행
HN = 11                  # 하나미치도리 7줄: 11(연석)~17(연석)   북차선 11~13 · 중앙선 14 · 남차선 15~17
BK = 30                  # 가부키초 블록 밑동행 (20~30, 3층=11줄)
YS = 33                  # 야스쿠니도리 7줄: 33~39            북차선 33~35 · 중앙선 36 · 남차선 37~39
VB = 49                  # 고가 밑동행 (44~49)  열차 밑동행 45 (42~45)
d.fill(0, 0, NR, NC, 'sw')

def road(r0, c0=0, c1=NC):
    d.hline(r0, c0, c1, 'road_n'); d.fill(r0 + 1, c0, r0 + 6, c1, 'road_c'); d.hline(r0 + 3, c0, c1, 'road_dash'); d.hline(r0 + 6, c0, c1, 'road_s')
def sidewalks(r0, c0=0, c1=NC):
    """도로 7줄 위아래 인도 2줄씩. 점자블록은 연석에서 한 칸 안쪽(건물 쪽)."""
    d.hline(r0 - 2, c0, c1, 'sw_tactile'); d.hline(r0 - 1, c0, c1, 'sw')
    d.hline(r0 + 7, c0, c1, 'sw'); d.hline(r0 + 8, c0, c1, 'sw_tactile')
road(HN); sidewalks(HN); road(YS); sidewalks(YS)

# 횡단보도: 동서 도로를 건너는 줄은 가로줄(zeb), 앞뒤에 점자 점
def cross_h(r0, c0, c1):
    for r in range(r0, r0 + 7):
        for c in range(c0, c1): d.set(r, c, 'zeb_n' if r == r0 else 'zeb_s' if r == r0 + 6 else 'zeb_c')
    for c in range(c0, c1): d.set(r0 - 1, c, 'tactile_dot'); d.set(r0 + 7, c, 'tactile_dot')
XC_ICHI = (15, 21); XC_SAK = (75, 79); XC_HAN = (43, 47); XC_TUN = (55, 59)

# ───────────────────────── 시네시티 광장 · 세트럴로드 (남행 일방통행·보행자 우선) ─────────────────────────
def paving(r0, r1, c0, c1):
    for r in range(r0, r1):
        for c in range(c0, c1): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
paving(0, HN + 9, 38, 60)           # 광장(하나미치도리를 가로막고 양끝은 방책)
paving(HN + 9, YS - 1, 40, 58)     # 세트럴로드
# 이치방가이(보행자 거리 8칸)
paving(HN + 7, YS - 1, 14, 22)
for r in range(HN + 9, YS - 1):
    for c in range(14, 22): d.set(r, c, 'pave_a' if (r + c) % 3 else 'pave_b')
# 사쿠라도리(6칸)
for r in range(HN + 9, YS - 1):
    for c in range(74, 80): d.set(r, c, 'lane_c')

cross_h(HN, *XC_ICHI); cross_h(HN, *XC_SAK)
cross_h(YS, *XC_ICHI); cross_h(YS, *XC_HAN); cross_h(YS, *XC_TUN); cross_h(YS, *XC_SAK)

# ───────────────────────── 건물 도우미 ─────────────────────────
BLD = []
def bld(spec, c, base):
    asm = d.building(spec, c, base); BLD.append((c, c + asm['n'] - 1, base + 1 - asm['rows'], base, spec.get('_tag', ''))); return asm
def fit_tall(fam, w, nf, seed, avail):
    """nf 층 (avail 안에 들어가게). avail=None 이면 위쪽이 지도 밖으로 잘려도 둔다."""
    s = G.gen(kit, fam, w, nf, seed)
    while avail and kit.assemble(s)['rows'] > avail and nf > 1:
        nf -= 1; s = G.gen(kit, fam, w, nf, seed)
    return s
def sign(name, col, bottom_row, key):
    """건물 앞면 위에 얹는 돌출 간판(그리기 순서를 건물 바로 뒤로)."""
    P = kit.props[name]; d.items.append((key, 1, 'propx', name, col * 16, (bottom_row - P['h'] + 1) * 16))
COL = ['aka', 'kii', 'sora', 'midori']
def post_kind(kind, s, w, nf, r):
    """업종별 간판 방식 (조사서 §2): 같은 부품 3연속 금지를 위해 업종을 섞는다."""
    dec = list(s.get('decos', [])); s = dict(s); s['_tag'] = kind; s['head'] = None
    def add(deco, col, floor, **kw): dec.append(dict(deco=deco, col=col, floor=floor, **kw))
    if kind == 'host':              # 돌출 세로 간판 적층 + 정면 전광
        s['ground'] = r.choice(['gr.shutter.sora', 'gr.glass.sora']); s['door'] = ('steel' if 'shutter' in s['ground'] else 'cafe', r.choice([1, w - 3]))
        c1, c2 = r.sample(COL, 2)
        for fl in range(nf):
            add(f'vsign.mark.{c1 if fl % 2 == 0 else c2}', 0 if fl % 2 == 0 else w - 1, fl)
        if w >= 7 and nf >= 3: add(r.choice(['vision.0', 'vision.2', 'vision.3']), (w - 6) // 2, 1)
        s['head'] = None
    elif kind == 'karaoke':         # 정면 대형 전광 + 돌출 간판
        s['ground'] = 'gr.glass.sora'; s['door'] = ('lobby', w - 3 if r.random() < .5 else 1)
        if w >= 6 and nf >= 2: add(r.choice(['vision.3', 'vision.0', 'vision.2']), (w - 6) // 2, 0)
        s['head'] = 'roofsign.sora' if (w >= 6 and r.random() < .5) else None
        if s['head']: add('rtext.karaoke', max(0, (w - 4) // 2), 'head', row=0)
        else: add('rtext.karaoke', max(0, (w - 4) // 2), nf - 1 if nf > 1 else 0)
        add(f'sign_h.{r.choice(COL[:3])}', w - 3, nf - 1)
    elif kind == 'pachinko':        # 정면 LED 띠 + 옥상 대형 간판
        s['ground'] = 'gr.konbini.1'; s['door'] = ('auto', w // 2 - 1)
        s['head'] = 'roofsign.kii'
        add('rtext.pachinko', max(0, (w - 4) // 2), 'head', row=0)
        add(r.choice(['wallad.aka', 'wallad.sora']), 1, 1)
        if w >= 9 and nf >= 3: add(r.choice(['wallad.sora', 'wallad.aka']), w - 5, 2)
    elif kind == 'hotel':           # 소형 네온 + 입구 천개(차고 커튼)
        s['ground'] = 'gr.garage'; s['door'] = ('rollup', r.choice([0, w - 2]))
        add(f'sunshade.{r.choice(COL[:3])}', 1 if s['door'][1] == 0 else 0, nf - 1)
        add(f'plate.mark.{r.choice(COL)}', 1, 0)
        s['head'] = None
    elif kind == 'izakaya':         # 돌출 세로 간판 5~6단 + 노렌
        s['ground'] = 'gr.izakaya'; s['door'] = ('noren', r.choice([0, w - 2]))
        add('vsign.izakaya', 0 if s['door'][1] else w - 1, 0)
        add(f'vsign.mark.{r.choice(COL)}', w - 1 if s['door'][1] else 0, min(1, nf - 1))
        add(f'sign_h.{r.choice(COL[:3])}', 1, nf - 1)
        if w >= 5: add('rtext.izakaya', 1, 0)
    elif kind == 'bar':             # 잡거빌딩(바·스낵): 간판이 외벽을 덮는다
        s['ground'] = r.choice(['gr.izakaya', 'gr.shutter.aka']); s['door'] = ('noren' if s['ground'] == 'gr.izakaya' else 'steel', r.choice([0, w - 2]))
        for fl in range(nf):
            add(r.choice(['vstack.aka', 'vstack.sora', 'vstack.kii', 'vstack.midori']), r.choice([0, w - 1]), fl)
        add(f'vsign.{r.choice(["kissa", "ramen", "sento"])}', 1, 0)
    elif kind == 'konbini':         # 1층 널 + 옥상 글자
        s['ground'] = r.choice(['gr.konbini.0', 'gr.konbini.1']); s['door'] = ('auto', 0 if r.random() < .5 else w - 2)
        add(f'sign_h.{r.choice(COL[:3])}', max(0, w - 3), 0)
        s['head'] = r.choice([None, 'roofsign.aka'])
    s['decos'] = dec
    return s
KW = dict(host=(5, 7), karaoke=(7, 9), pachinko=(8, 10), hotel=(6, 8), izakaya=(5, 6), bar=(4, 6), konbini=(6, 7))
FAMS = dict(host='office', karaoke='retail', pachinko='retail', hotel='mansion', izakaya='izakaya', bar='bar', konbini='retail')
def fill_row(c0, c1, base, kinds, nfs, avail):
    c = c0; last = []; out = []
    while c < c1:
        rem = c1 - c
        cand = [k for k in kinds if k not in last[-2:]] or kinds
        k = rng.choice(cand); lo, hi = KW[k]
        if rem <= hi + 1: w = rem
        else:
            top = min(hi, rem - 4)
            w = rng.randint(lo, top) if top >= lo else rem
        w = max(4, w)
        if k == 'hotel' and w < 6: k = 'bar'
        nf = rng.choice(nfs)
        s = fit_tall(FAMS[k], w, nf, rng.randrange(10 ** 6), avail)
        s = post_kind(k, s, w, len(s['floors']), rng)
        if avail and kit.assemble(s)['rows'] > avail: s = fit_tall(FAMS[k], w, 2, rng.randrange(10 ** 6), avail); s = post_kind(k, s, w, len(s['floors']), rng)
        bld(s, c, base); out.append((c, w, k)); last.append(k); c += w
    return out

# ───────────────────────── 북열: 하나미치도리 북쪽 (호스트·카라오케·파친코·호텔) ─────────────────────────
north_kinds = ['host', 'karaoke', 'pachinko', 'hotel', 'bar', 'konbini']
nrow = fill_row(0, 38, BN, north_kinds, [3, 4, 5, 6], None) + fill_row(60, NC, BN, north_kinds, [3, 4, 5, 6], None)
# 광장 정면 대형 복합 타워 (유리·금속 외벽 + 정면 대형 전광 + 큰 입구 캐노피). '특가' 판은 측면 소형 간판으로 낮춘다.
tw = G.gen(kit, 'office', 20, 4, 71); tw['floors'] = [G.F('curtain', 'kinari', v) for v in ([0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 1, 0], [1, 1, 0, 0])]
tw['ground'] = 'gr.glass.sora'; tw['door'] = ('lobby', 9); tw['head'] = 'roofsign.sora'
tw = vis(tw, 'facade_ad.0', 6, 1); tw = vis(tw, 'vision.3', 1, 2); tw = vis(tw, 'vision.0', 13, 2)
tw['_tag'] = 'tower'
bld(tw, 39, BN)
d.put('theatre_front8', 45, BN, solid=False)           # 정면 대형 입구 캐노피

# ───────────────────────── 가부키초 블록 (하나미치 남쪽 ~ 야스쿠니 북쪽) ─────────────────────────
kab_kinds = ['karaoke', 'pachinko', 'host', 'izakaya', 'hotel', 'bar', 'konbini']
krow = fill_row(0, 14, BK, kab_kinds, [3], 11) + fill_row(22, 40, BK, kab_kinds, [3], 11) + fill_row(58, 74, BK, kab_kinds, [3], 11) + fill_row(80, NC, BK, kab_kinds, [3], 11)

# ───────────────────────── 골든가이 (x0~39 · 2층 목조 연립) ─────────────────────────
GGA, GGB = 50, 61                    # 밑동행 (A 42~50, B 53~61)
for r in range(42, 64):
    for c in range(42, 47): d.set(r, c, 'lane_c')                     # 골든가이 동쪽 세로 골목 + 하나조노 통로(ガード로 이어짐)
for r in (51, 52, 62, 63):
    for c in range(0, 47): d.set(r, c, 'lane_c')
def partition(rem):
    while True:
        out = []; x = rem
        while x > 0:
            w = rng.choice([3, 3, 4, 4, 4, 5]); out.append(w); x -= w
        if x == 0: return out
BAR_DOORS = ['noren', 'noren', 'lattice', 'steel']
BOARDS = ['board.izakaya', 'board.sakaya', 'board.kissaten', 'board.shokudo', 'board.sushi', 'board.ramen']
_lastb = [None]
BW = {'board.izakaya': 3, 'board.sakaya': 2, 'board.kissaten': 3, 'board.shokudo': 2, 'board.sushi': 3, 'board.ramen': 4}
def board(w):
    b = rng.choice([x for x in BOARDS if x != _lastb[0] and BW[x] <= w]); _lastb[0] = b; return dict(deco=b, col=rng.randint(0, w - BW[b]))
def gg_bar(w, nf, base_tag):
    for _ in range(30):
        s = G.gen(kit, 'bar', w, nf, rng.randrange(10 ** 6))
        if kit.assemble(s)['rows'] == 5 + 2 * nf: break
    s = dict(s); s['_tag'] = 'gg'
    s['ground'] = rng.choice(['gr.izakaya', 'gr.izakaya', 'gr.shutter.aka', 'gr.shutter.sora'])
    s['door'] = (('noren' if rng.random() < .65 else 'lattice') if s['ground'] == 'gr.izakaya' else 'steel', rng.choice([0, max(0, w - 2)]))
    dec = list(s.get('decos', []))
    if rng.random() < .6 and w >= 4: dec.append(dict(board(w), floor=nf - 1))
    if rng.random() < .5: dec.append(dict(deco=rng.choice(['ac.0', 'ac.1']), col=rng.choice([0, w - 1]), floor=0 if nf > 1 else 0))
    if rng.random() < .35 and w >= 4: dec.append(dict(deco='laundry', col=rng.randint(0, w - 2), floor=0))
    if rng.random() < .4: dec.append(dict(deco=f'plate.mark.{rng.choice(COL)}', col=rng.randint(0, max(0, w - 2)), floor=min(1, nf - 1)))
    s['decos'] = dec
    return s
GG_STAIRS = []
def plan_seq(rem):
    """rem 칸을 (건물 폭 3~5 / 1칸 샛길 / 2칸 외부계단 틈) 로 정확히 채운다."""
    for _ in range(400):
        seq = []; x = rem
        while x > 0:
            w = rng.choice([3, 3, 4, 4, 4, 5])
            if w > x: w = x
            seq.append(('b', w)); x -= w
            if x >= 4:
                g = rng.random()
                if g < .30: seq.append(('g', 1)); x -= 1
                elif g < .52 and x >= 5: seq.append(('s', 2)); x -= 2
        if x == 0 and all(i[1] >= 3 for i in seq if i[0] == 'b') and seq[-1][0] == 'b': return seq
    raise SystemExit('plan_seq')
def gg_band(base, nf, reserved, tag):
    top = base - (5 + 2 * nf) + 1
    c = 0; stairs = 0
    bounds = sorted(reserved) + [42]
    while c < 42:
        if c in reserved:
            w = reserved[c]
            for r in range(top, base + 1):
                for cc in range(c, c + w): d.set(r, cc, 'lane_c')
            c += w; continue
        nxt = min(rc for rc in bounds if rc > c); rem = nxt - c
        for kind, w in plan_seq(rem):
            if kind == 'b': bld(gg_bar(w, nf, tag), c, base)
            else:
                for r in range(top, base + 1):
                    for cc in range(c, c + w): d.set(r, cc, 'lane_c')
                if kind == 's': GG_STAIRS.append(('iron_stair' if stairs % 2 == 0 else 'iron_stair_r', c, base)); stairs += 1
            c += w
        assert c == nxt, (c, nxt)
gg_band(GGA, 2, {16: 2}, 'A')            # 야스쿠니 횡단보도(x15~20)와 맞춘 2칸 입구
gg_band(GGB, 2, {}, 'B')
for nm, c, base in GG_STAIRS: d.put(nm, c, base, solid=False)

# ───────────────────────── JR 고가 + 야마노테 + ガード (열차는 보도 남쪽에 앉힌다) ─────────────────────────
MODS = [(42, 'viaduct6_pass'), (48, 'viaduct6_shut'), (54, 'viaduct6'), (60, 'viaduct6_shops'), (66, 'viaduct6_shut'), (72, 'viaduct6_shops'), (78, 'viaduct6_shut'), (84, 'viaduct6_shops'), (90, 'viaduct6_shut')]
for c, nm in MODS: d.put(nm, c, VB, solid=False)
d.put('guard_tunnel', 55, VB, solid=False)                  # 터널 2: 야스쿠니 횡단보도(x54~57)와 맞춘 ガード
# 고가 아래 벽은 막고 개구부 두 곳만 통과
for r in range(44, VB + 1):
    for c in range(42, NC): d.walk[r][c] = 'X'
for c0 in (43, 55):
    for r in range(42, VB + 1):
        for c in range(c0, c0 + 4): d.walk[r][c] = 'F'
# 열차: 야마노테선(녹색 띠) 중심, 카테너리 기둥 사이로 달린다
TR = [(42, 'train8_g'), (50, 'train8_g'), (58, 'train8_g'), (66, 'train8'), (74, 'train8_g'), (82, 'train8_g'), (90, 'train8_g')]
for c, nm in TR: d.put(nm, c, 45, solid=False)
for c in (49, 57, 65, 73, 81, 89): d.items.append((VB + 0.2, 1, 'propx', 'catenary_pole', c * 16, 43 * 16))

# ───────────────────────── 오모이데요코초 (함석 점포 + 1층 꼬치집) ─────────────────────────
for c in range(47, NC):
    for r in (54, 55): d.set(r, c, 'lane_c')
    d.set(63, c, 'lane_c')
for r in range(50, 54):
    for c in (49, 50, 55, 56, 57, 58): d.set(r, c, 'lane_c')
STALLS = [59, 63, 67, 71, 75, 79, 83, 87, 91]
last = -1
for c in STALLS:
    t = rng.choice([x for x in (0, 1, 2) if x != last]); last = t
    d.put(f'tin_stall.{t}', c, 53, solid=True)
for c in range(46, 54): pass
d.put('bike_rack', 95 - 2 + 0, 52) if False else None
# 남쪽 열: 1층 꼬치집 (폭 3~4, 카운터·단차·노렌) — 골목 위 함석 덮개는 전선·제등 줄로 대신한다
OB = 62
def omoide_row():
    segs = [(47, 55), (59, 75), (76, 96)]
    for c0, c1 in segs:
        c = c0
        while c < c1:
            rem = c1 - c
            w = rem if rem <= 5 else rng.choice([3, 3, 4, 4])
            if rem - w in (1, 2): w = rem if rem <= 5 else w + 1
            if w < 3:
                for r in range(56, OB + 1):
                    for cc in range(c, c1): d.set(r, cc, 'lane_c')
                break
            s = G.gen(kit, 'bar', w, 1, rng.randrange(10 ** 6)); s = dict(s); s['_tag'] = 'omo'
            s['ground'] = rng.choice(['gr.izakaya', 'gr.izakaya', 'gr.shutter.aka']); s['door'] = ('noren' if s['ground'] == 'gr.izakaya' else 'steel', 0 if rng.random() < .5 else max(0, w - 2))
            s['roof'] = rng.choice(['roof.plain.plain', 'roof.ac.plain']); s['head'] = None
            dec = [x for x in s.get('decos', [])]
            if w >= 4 and rng.random() < .55: dec.append(dict(board(w), floor=0))
            s['decos'] = dec
            bld(s, c, OB); c += w
    for r in range(56, OB + 1):                                # 샛길(통로 4칸 두 곳 + 1칸 가교)
        for c in (55, 56, 57, 58, 75): d.set(r, c, 'lane_c')
omoide_row()
d.put('omoide_gate', 47, 53, solid=True)                                          # 오모이데요코초 입구 문(좌우 점포 벽 + 가운데 2칸 통로)
d.put('vending.aka', 53, 53)
for c in range(59, 95, 4):                                                       # 점포 처마 높이(앞 차양 밑)에 걸린 제등 줄: 점포보다 앞에 그린다
    if 55 <= c <= 58: continue
    d.items.append((53.6, 1, 'propx', 'string_lanterns4', c * 16, 52 * 16 - 2))

# ───────────────────────── 아치(일번가 입구) · 방책 · 광장 가구 ─────────────────────────
d.put('arch_ichibangai', 14, 24)                                  # 보행로 안쪽으로 내려 도로를 비움
for c in (15, 20):
    d.put('bollard', c, HN + 8, solid=True)
for c in (14, 21): d.put('bollard', c, YS + 8, solid=True) if False else None
for c in (36, 37): d.put('barricade3', c - 2, 13, solid=False)    # 하나미치 북차선 끝 방책
d.put('barricade3', 60, 16, solid=False); d.put('cone', 37, 14, solid=False); d.put('cone', 60, 14, solid=False)
for c in (40, 55): d.put('bench', c, 24, solid=True); d.put('bench', c + 3, 27, solid=True)
for c in (43, 52): d.put('planter', c, 22); d.put('planter', c, 28)
for c in (41, 57): d.put('lamp_post', c, 25); d.put('lamp_post', c, 29)
d.put('street_flag', 48, 21); d.put('street_flag', 49, 21); d.put('street_flag', 48, 26); d.put('street_flag', 49, 26)
d.put('metro_exit', 51, 30, solid=True)
d.put('smoking_area', 57, 30, solid=True) if False else None
d.put('coin_sign', 43, 31); d.put('roadsign', 62, YS - 1, solid=False) if False else None
# 택시 승강장: 야스쿠니 북차선, 앞뒤 간격 1칸 이상
for c in (60, 66, 72): pass

# 소품: 신호·자판기·간판·가로등
def sp(name, c, row, **kw): return safe_put(d, name, c, row, **kw)
for c in (13, 22, 74, 79): sp('signal', c, HN - 1); sp('signal', c, HN + 8) if False else None
sp('signal', 13, HN + 7); sp('signal', 22, HN - 1); sp('signal', 74, HN + 7); sp('signal', 80, HN - 1)
sp('signal', 13, YS - 1); sp('signal', 22, YS + 7); sp('signal', 41, YS - 1); sp('signal', 47, YS + 7); sp('signal', 53, YS - 1); sp('signal', 59, YS + 7); sp('signal', 74, YS - 1); sp('signal', 80, YS + 7)
d.put('signal_overhead', 43, YS + 8, solid=False); d.put('signal_overhead', 55, YS + 8, solid=False)   # 횡단보도 머리 위 신호
for c in range(2, NC - 4, 9):
    if 36 <= c <= 60: continue
    sp('lamp_post', c, HN - 1); sp('lamp_post', c + 4, HN + 8)
    sp('lamp_post', c + 2, YS - 1) if not (14 < c < 22) else None
    sp('lamp_post', c + 5, YS + 7) if not (14 < c < 22) else None
for c, nm in ((3, 'vend_pair'), (28, 'vend_trio'), (67, 'vend_pair'), (90, 'vend_trio')): sp(nm, c, HN - 1)
for c, nm in ((8, 'vend_pair'), (34, 'vend_trio'), (64, 'vend_pair'), (86, 'vend_pair')): sp(nm, c, YS - 1)
sp('bike_cluster', 6, YS + 8); sp('bike_rack', 34, YS + 8); sp('post_box', 70, YS + 8)
sp('vend_pair', 4, YS + 8); sp('smoking_area', 36, YS + 8)

# 호객·돌출 간판 (건물 앞면 위, 업종 변주)
SIGNS = ['neon_stack.0', 'neon_stack.1', 'neon_stack.2', 'neon_stack.3', 'akiba_neon_r', 'akiba_neon_b', 'blade_sign.0', 'blade_sign.1', 'blade_sign.2', 'blade_sign.3']
def edge_signs(rowlist, base):
    prev = None
    for (c, w, k) in rowlist:
        if c == 0 or rng.random() < .4 or c in (14, 22): continue
        nm = rng.choice([s for s in SIGNS if s != prev]); prev = nm
        sign(nm, c - 1 if rng.random() < .5 else c, base - 3 if kit.props[nm]['h'] > 3 else base - 4, base + 0.5)
edge_signs(nrow, BN); edge_signs(krow, BK)
# 일번가 양옆 벽: 돌출 간판 적층 + 측면 출입구 대신 간판
for nm, c in (('akiba_neon_b', 23), ('blade_sign.2', 13), ('blade_sign.0', 22)): sign(nm, c, BK - 3 if kit.props[nm]['h'] > 3 else BK - 4, BK + 0.5)
sign('neon_stack.2', 72, BK - 3, BK + 0.5); sign('akiba_neon_r', 80, BK - 3, BK + 0.5); sign('blade_sign.3', 73, BK - 4, BK + 0.5); sign('blade_sign.1', 79, BK - 4, BK + 0.5)
# 광장 양옆 LED 타워
for nm, c in (('led_tower.0', 12), ('led_tower.1', 30), ('led_tower.0', 60), ('led_tower.1', 71), ('led_tower.0', 80)): d.put(nm, c, BN + 2, solid=True)      # 가부키초 대형 LED 외벽
# 광고 트럭 (가부키초 명물) : 하나미치 남차선 1대
d.put('ad_truck_r', 24, HN + 6, solid=False)

# ───────────────────────── 전봇대·전선 (이면 골목: 골든가이·오모이데·사쿠라도리·하나조노) ─────────────────────────
POLES = []                              # (col, base_row)
def pole(c, base): 
    if sp('utility_pole2', c, base, solid=True): POLES.append((c, base))
for c in (9, 25, 38): pole(c, 52)
for c in (12, 30): pole(c, 63)
for c in (52, 68, 84): pole(c, 55)
for c in (48, 80): pole(c, 63) if False else None
pole(76, 24); pole(76, 30); pole(42, 57); pole(42, 52)
pole(23, 18) if False else None

# ───────────────────────── 차량 (좌측통행: 북차선=동행, 남차선=서행. 차선 중심에 한 줄, 겹침 없음) ─────────────────────────
def segs(c0, c1, cuts):
    out = []; x = c0
    for a, b in sorted(cuts):
        if b < c0 or a > c1: continue
        if a - 1 > x: out.append((x, min(a - 1, c1)))
        x = max(x, b + 1)
    if x < c1: out.append((x, c1))
    return out
def lane_cars(row, east, c0, c1, cuts, gap=(2, 5), bus=False):
    cols = ['white', 'silver', 'black', 'red', 'blue', 'green', 'navy', 'white', 'silver']
    for a, b in segs(c0, c1, cuts):
        c = a + rng.randint(0, 2)
        while c + 5 <= b:
            nm = 'car.' + rng.choice(cols) + ('' if east else '_r')
            if rng.random() < .1: nm = 'van.white' if east else 'van.silver_r'
            if bus and rng.random() < .08 and c + 9 <= b: nm = 'bus' if east else 'bus_r'
            W = kit.props[nm]['w']
            d.put(nm, c, row, solid=False); c += W + rng.randint(*gap)
cutH = [(XC_ICHI[0] - 1, XC_ICHI[1]), (XC_SAK[0] - 1, XC_SAK[1])]
lane_cars(HN + 2, True, 0, 36, cutH); lane_cars(HN + 2, True, 62, NC, cutH)
lane_cars(HN + 6, False, 0, 36, cutH + [(23, 30)]); lane_cars(HN + 6, False, 62, NC, cutH)
cutY = [(XC_ICHI[0] - 1, XC_ICHI[1]), (XC_HAN[0] - 1, XC_HAN[1]), (XC_TUN[0] - 1, XC_TUN[1]), (XC_SAK[0] - 1, XC_SAK[1])]
# 택시 승강장 (x60~72): 3대, 앞뒤 간격 1칸
TAXI = [60, 66, 72]
cutYN = cutY + [(59, 78)]
lane_cars(YS + 2, True, 0, NC, cutYN, bus=True)
for c in TAXI[:2]: d.put('car.taxi', c, YS + 2, solid=False)
lane_cars(YS + 6, False, 0, NC, cutY, bus=True)

# ───────────────────────── 인파 (Actor1 원본 person.0~39, 보행 가능한 칸에만, 넉넉히) ─────────────────────────
PEOPLE = []
ROADC = ('road_c', 'road_n', 'road_s', 'road_dash')
def crowd2(r0, r1, c0, c1, n, tries=900):
    k = 0
    while k < n and tries > 0:
        tries -= 1
        r = rng.randint(r0, r1); c = rng.randint(c0, c1)
        if not (0 <= r < NR and 0 <= c + 1 < NC): continue
        if d.walk[r][c] != 'F' or d.walk[r][c + 1] != 'F': continue
        if d.surf[r][c] in ROADC or d.surf[r][c + 1] in ROADC: continue
        if any(abs(r - pr) <= 1 and abs(c - pc) <= 2 for pr, pc in PEOPLE): continue
        PEOPLE.append((r, c)); d.put(f'person.{rng.randrange(40)}', c, r, dx=rng.randint(-3, 3), dy=rng.randint(-2, 2), solid=False); k += 1
crowd2(1, HN - 2, 38, 58, 12); crowd2(HN + 7, YS - 2, 41, 56, 22); crowd2(HN + 7, YS - 2, 15, 20, 9); crowd2(HN + 7, YS - 2, 75, 78, 4)
crowd2(HN - 1, HN - 1, 2, NC - 3, 6); crowd2(HN + 7, HN + 8, 2, NC - 3, 7); crowd2(YS - 2, YS - 1, 2, NC - 3, 7); crowd2(YS + 7, YS + 8, 2, NC - 3, 8)
crowd2(HN + 1, HN + 6, 15, 20, 3); crowd2(YS, YS + 6, 43, 46, 3); crowd2(YS, YS + 6, 55, 58, 3); crowd2(HN + 1, HN + 6, 75, 78, 2)
crowd2(51, 52, 2, 40, 5); crowd2(62, 63, 2, 40, 4); crowd2(42, 63, 42, 46, 5); crowd2(54, 55, 47, 94, 7); crowd2(63, 63, 47, 94, 4)
crowd2(HN + 9, YS - 3, 76, 77, 2)

im = d.render()

# ───────────────────────── 전선 (이면 골목만) ─────────────────────────
def wire(im, x0, y0, x1, y1, sag, col=(46, 42, 52)):
    n = max(abs(x1 - x0), 1)
    for i in range(n + 1):
        t = i / n; x = int(round(x0 + (x1 - x0) * t)); y = int(round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)))
        if 0 <= x < im.shape[1] and 0 <= y < im.shape[0]: im[y, x, :3] = col; im[y, x, 3] = 255
def pole_top(c, base): return ((c + 1) * 16 - 2, (base - 4) * 16 + 6)   # utility_pole2 가로대 높이
def wires(pl, strands=((0, 0), (3, 1), (6, 2)), sag=5):
    pl = sorted(pl)
    for (c0, b0), (c1, b1) in zip(pl, pl[1:]):
        x0, y0 = pole_top(c0, b0); x1, y1 = pole_top(c1, b1)
        for dy, ds in strands: wire(im, x0 + 2, y0 + dy, x1 - 2, y1 + dy, sag + ds)
wires([p for p in POLES if p[1] == 52]); wires([p for p in POLES if p[1] == 63 and p[0] < 40]); wires([p for p in POLES if p[1] == 55 and p[0] >= 48])
wires([(76, 24), (76, 30)], sag=3); wires([(42, 52), (42, 57)], sag=3)
# 골목 사이 가교 전선 (골든가이 A/B 열 가로 묶음, 오모이데 처마 라인)
for (c0, b0) in [p for p in POLES if p[1] == 52]:
    for dy in (0, 4): wire(im, pole_top(c0, 52)[0], pole_top(c0, 52)[1] + dy, pole_top(c0, 52)[0] + 6, pole_top(c0, 52)[1] + dy + 5, 1)
# 골목 가로지르는 전선 묶음 (사쿠라도리 · 하나조노 통로 · 골든가이)
for (c0, c1, b) in ((74, 80, 24), (74, 80, 30), (42, 47, 52), (42, 47, 57)):
    x0, y0 = pole_top(c0 + 2 if c0 == 74 else c0, b)
    for dy, ds in ((0, 1), (3, 2), (6, 1)):
        wire(im, c0 * 16, y0 + dy - 2, c1 * 16, y0 + dy + 3, ds)
for (c0, b0) in [p for p in POLES if p[1] == 52 and p[0] < 40]:
    x0, y0 = pole_top(c0, b0)
    for dy in (0, 4): wire(im, x0 - 22, y0 + dy + 6, x0 - 2, y0 + dy, 1); wire(im, x0 + 2, y0 + dy, x0 + 28, y0 + dy + 6, 1)
Image.fromarray(im).save(os.path.join(jpenv.DISTRICTS_OUT, 'district_shinjuku.png'))
print(im.shape)
# 건물 겹침 검사
ov = [(a[4], b[4], a[:4], b[:4]) for i, a in enumerate(BLD) for b in BLD[i + 1:] if not (a[1] < b[0] or b[1] < a[0] or a[3] < b[2] or b[3] < a[2])]
print('건물 겹침', len(ov), ov[:4])
check(d, 'shinjuku')
