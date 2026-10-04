import sys, os, random
import jpenv
from jpstreet import Kit
from district import District
import gen as G
import numpy as np
from PIL import Image

def load(): return Kit.load(jpenv.OUT)

def strip(d, kit, rb, c0, c1, fams, rng, wmin=4, wmax=9, fmin=3, fmax=6, tag='', gap=0):
    """rb: 1층 아랫줄 행. c0..c1 사이를 건물로 채운다(좌→우). fams: [(가족, 가중치)]. 반환: 놓은 spec 목록"""
    out = []; c = c0
    while c1 - c >= wmin:
        w = rng.randint(wmin, wmax)
        if c1 - (c + w) < wmin: w = c1 - c
        fam = rng.choices([f for f, _ in fams], [x for _, x in fams])[0]
        nf = rng.randint(fmin, fmax)
        if fam == 'mansion' and w < 5: w = 5
        spec = G.gen(kit, fam, w, nf, rng.randrange(10 ** 6))
        d.building(spec, c, rb); out.append((c, w, fam, nf)); c += w + gap
    return out

# 도로 행 구성 (가로 도로): 인도 3줄 + 차도 + 인도 3줄
def hroad(d, r0, c0, c1, lanes=6, walk_top=True, walk_bot=True, guard=True):
    """r0 에서 시작. 반환 다음 행."""
    r = r0
    if walk_top:
        d.hline(r, c0, c1, 'sw_shade'); d.hline(r + 1, c0, c1, 'sw'); d.hline(r + 2, c0, c1, 'sw'); r += 3
        if guard: d.hline(r - 1, c0, c1, 'guard', 'S')
    d.hline(r, c0, c1, 'road_n'); r += 1
    for k in range(lanes):
        d.hline(r, c0, c1, 'road_dash' if k == lanes // 2 else 'road_c'); r += 1
    d.hline(r, c0, c1, 'road_s'); r += 1
    if walk_bot:
        d.hline(r, c0, c1, 'sw'); d.hline(r + 1, c0, c1, 'sw'); d.hline(r + 2, c0, c1, 'sw')
        if guard: d.hline(r, c0, c1, 'guard', 'S')
        r += 3
    return r

def save(d, name, scale=1):
    im = d.render()
    os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True); Image.fromarray(im).save(f'{jpenv.DISTRICTS_OUT}/{name}.png')
    return im

def fit_spec(kit, fam, w, avail, rng, minf=2, maxf=9, tries=40):
    """아랫줄까지 avail 행에 딱 맞는(또는 1행 모자란) 높이의 레시피를 만든다."""
    best = None
    for _ in range(tries):
        nf = rng.randint(minf, maxf); spec = G.gen(kit, fam, w, nf, rng.randrange(10 ** 6)); rows = kit.assemble(spec)['rows']
        if rows <= avail and (best is None or rows > best[0]): best = (rows, spec)
        if rows == avail or rows == avail - 1: return spec
    return best[1] if best else G.gen(kit, fam, w, minf, rng.randrange(10 ** 6))

def strip_fit(d, kit, rb, top, c0, c1, fams, rng, wmin=5, wmax=11, minf=2, maxf=9, gaps=(), post=None):
    out = []; c = c0
    while c1 - c >= wmin:
        w = rng.randint(wmin, wmax)
        if c1 - (c + w) < wmin: w = c1 - c
        fam = rng.choices([f for f, _ in fams], [x for _, x in fams])[0]
        if fam == 'mansion' and w < 5: w = 5
        spec = fit_spec(kit, fam, w, rb - top + 1, rng, minf, maxf)
        if post: spec = post(spec, w, fam, rng)
        d.building(spec, c, rb); out.append((c, w, fam)); c += w
    return out

def cars_row(d, kit, row, c0, c1, east, rng, gap=(1, 4), colors=None):
    """차선 한 줄에 차를 늘어놓는다. row: 차 밑동 행. east 이면 동쪽(오른쪽) 진행."""
    cols = colors or ['white', 'silver', 'black', 'red', 'blue', 'taxi', 'green', 'navy']
    c = c0
    while c < c1 - 3:
        nm = rng.choice(['car.' + rng.choice(cols)] * 5 + ['van.white'] * 1 + ['bus'] * 0)
        if not east: nm = nm.replace('car.', 'car.') + '_r' if nm.startswith('car.') else 'van.silver_r'
        P = kit.props[nm]; d.put(nm, c, row, solid=False); c += P['w'] + rng.randint(*gap)

SOFT = ('person.', 'car.', 'van.', 'bus', 'smoke', 'ricksha', 'string_lanterns', 'ad_truck')
def check(d, tag):
    """문 앞 접근 칸: 문 아랫줄 바로 아래 두 칸 안에 막는 소품이 없는가, 문 칸이 걷기 가능한가."""
    bad = []; kit = d.kit
    boxes = []
    for key, z, kind, *rest in d.items:
        if kind == 'propx': name, x, y = rest
        elif kind == 'prop': name, col, r0 = rest; x, y = col * 16, r0 * 16
        else: continue
        if name.startswith(SOFT): continue
        P = kit.props[name]; boxes.append((name, x, y, x + P['w'] * 16, y + P['h'] * 16))
    n = 0
    for (r, c) in d.doors:
        n += 1
        if not (0 <= r < d.nr) or d.walk[r][c] != 'F': bad.append(('walk', r, c, d.walk[r][c] if 0 <= r < d.nr else None)); continue
        # 문 바로 앞(아래) 2칸 영역 안에 단단한 소품이 있는가 (밑동 한 줄 기준)
        fx0, fx1 = c * 16, c * 16 + 16; fy0, fy1 = (r + 1) * 16, (r + 3) * 16
        for (nm, x0, y0, x1, y1) in boxes:
            P = kit.props[nm]
            if x1 <= fx0 or x0 >= fx1: continue
            if y1 <= fy0 or y1 > fy1 + 16: continue          # 밑동이 문 앞 영역에 놓인 것만
            if not any(ch == 'S' for ch in P['walk'][-1]): continue
            bad.append(('block', nm, r, c))
    print(f'[{tag}] 문 {n}개 / 막힘·접근 실패 {len(bad)}건', bad[:6])
    return n, len(bad)

def crowd(d, rng, r0, r1, c0, c1, n, kinds=40):
    for _ in range(n):
        r = rng.randint(r0, r1); c = rng.randint(c0, c1)
        d.put(f'person.{rng.randrange(kinds)}', c, r, dx=rng.randint(-4, 4), dy=rng.randint(-3, 3), solid=False)

def vis(spec, k, col, floor):
    spec = dict(spec); spec['decos'] = list(spec.get('decos', [])) + [dict(deco=k, col=col, floor=floor)]; return spec

def vroad(d, c0, c1, r0, r1, lanes_w=3, walk=4):
    """남북 대로: 양쪽 인도 walk 칸 + 차도. 인도는 sw."""
    d.fill(r0, c0, r1, c0 + walk, 'sw'); d.fill(r0, c1 - walk, r1, c1, 'sw')
    d.fill(r0, c0 + walk, r1, c1 - walk, 'road_c')

def cwalk_h(d, r0, c0, c1, n=4):
    for c in range(c0, c1):
        for r in range(r0, r0 + n): d.set(r, c, 'zeb_n' if r == r0 else 'zeb_s' if r == r0 + n - 1 else 'zeb_c')

def safe_put(d, name, c, row, **kw):
    """문 앞(문 행~3행 아래) 열과 겹치면 놓지 않는다. 놓았으면 True."""
    w = d.kit.props[name]['w']
    for (dr, dc) in d.doors:
        if c - 1 <= dc <= c + w and dr <= row <= dr + 3: return False
    d.put(name, c, row, **kw); return True
