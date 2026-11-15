#!/usr/bin/env python3
"""jp_city 새 거리 조각의 명세(생성물 만들기) — Fable 5.2 가 그린 원본 그림(tiledata/jp-city/fable-street/sheets/*.png)을 칸에 맞춘 조각 그림으로 자른다.
  python3 scripts/content/jp-city/street/fable_street_spec.py
쓰는 것: tiledata/jp-city/fable-street/pieces/<키트 id>.png · index.json(바닥 무늬 깔기) · spec.json(굽기 블록 fable_street 가 읽는 목록) · src/assets/jpCityStreetPieces.json(구성기가 읽는 조각 표).
조각마다: 칸 크기 · 앵커 등급(어디에 서는가) · 층 · 바닥별 그림자 변형. 서 있는 조각은 3px 들어 올려 제 칸 안에 발치 그림자를 담는다(연석 줄 조각은 연석 위로 8px 더).
그림자·테·바닥별 변형은 코드가 원본 화소로 만든다(새로 그리는 화소는 그늘 한 단뿐). 조각 그림이 한 화소라도 바뀌면 오너 면제 묶음을 다시 적어야 한다(굽기가 멈춘다).
옛 키트 id → 새 조각 대응(alias)은 src/assets/jpCityStreetCatalog.json 의 야외 키트 이름에서 만든다 — 굽기 뒤 catalog.py 를 돌린 다음 이 스크립트를 다시 돌려도 결과는 같다(새 조각 jp-st-* 는 대응에서 뺀다)."""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
D = os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-street')
RAMPS = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'fable-city', 'palette.json'), encoding='utf-8'))['ramps']
OUT = f'{D}/pieces'
def hx(c): c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def R(r, i): return hx(RAMPS[r][i]) + (255,)
def src(i):
    p = f'{D}/sheets/{i}.png'
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None
# 바닥 가족: 무늬 그림 · 깔기 방식 · 그늘 색
GROUNDS = {
 'pave':      dict(ko='거리 · 보도 블록', src='g-pave', mode='shuffle', shade=R('stone', 2), base=R('stone', 5)),
 'forecourt': dict(ko='거리 · 앞마당 판', src='g-shoplot', mode='shuffle', shade=R('cream', 0), base=R('cream', 2)),
 'tarmac':    dict(ko='거리 · 아스팔트', src='g-asphalt', src2='g-asphalt2', mode='wrap', shade=R('tarmac', 0), base=R('tarmac', 3)),
 'alley':     dict(ko='거리 · 골목 돌길', src='g-alley', mode='wrap', shade=R('stone', 1), base=R('stone', 3)),
 'earth':     dict(ko='거리 · 다진 흙', src='g-earth', mode='wrap', shade=R('earth', 0), base=R('earth', 3)),
 'lawn':      dict(ko='거리 · 잔디 마당', src='g-grass', mode='wrap', shade=hx('#204c2c') + (255,), base=R('lawn', 3)),
 'lane':      dict(ko='거리 · 생활도로 포장', src='g-lane', mode='wrap', shade=R('lane', 0), base=R('lane', 3)),
 'laneside':  dict(ko='거리 · 생활도로 길가 띠', src='g-laneside', mode='wrap', shade=R('lane', 0), base=R('lane', 3)),
 'water':     dict(ko='거리 · 강물', src='g-water', mode='shuffle', shade=R('teal', 0), base=R('teal', 1)),
}
STAND = {'wall': ['pave', 'forecourt', 'alley', 'earth'], 'kerb': ['pave', 'lane'], 'lot': ['earth', 'lawn', 'forecourt', 'alley', 'pave'], 'open': ['earth', 'lawn', 'forecourt', 'alley', 'pave']}
PIECES = {}; KITS = {}; RUNS = {}
def save(kit, im): KITS[kit] = im
def shadow_mask(a, reach=3):
    """발치 그림자: 맨 아래 4줄에 화소가 있는 열마다, 그 아래로 reach 줄·오른쪽으로 비껴."""
    h, w = a.shape; m = np.zeros((h, w), bool)
    for x in range(w):
        ys = np.nonzero(a[:, x])[0]
        if not len(ys) or ys.max() < h - reach - 4: continue
        yb = int(ys.max())
        for dy in range(1, reach + 1):
            for dx in range(dy - 1, dy + 3):
                if yb + dy < h and x + dx < w: m[yb + dy, x + dx] = True
    return m & ~a
def piece(name, sheet, x0, x1, anchor, tags, ko, layer=None, hpx=None, lift=None, look=None, repeat=False, grounds=None, wpx=None, shadow=True, canopy=False):
    im = src(sheet)
    if im is None: print('  (없음)', sheet, name); return
    s = im.crop((x0, 0, x1, im.height)); a = np.array(s)[:, :, 3] > 0
    if not a.any(): print('  (빈 조각)', name); return
    top = int(np.nonzero(a.any(1))[0].min()); bot = int(np.nonzero(a.any(1))[0].max())
    layer = layer or ('floor' if anchor == 'floor' else 'prop')
    standing = anchor in STAND and layer != 'floor'
    lift = lift if lift is not None else ((11 if anchor == 'kerb' else 3) if standing else 0)
    pw = wpx or (x1 - x0); cw = -(-pw // 16)
    body = s.crop((0, top, x1 - x0, bot + 1)); bh = body.height
    ch = -(-(bh + lift) // 16)
    def make(g):
        c = Image.new('RGBA', (cw * 16, ch * 16), (0, 0, 0, 0)); ox = (cw * 16 - (x1 - x0)) // 2 if not canopy else 0
        if standing and shadow and g:
            base = Image.new('RGBA', c.size, (0, 0, 0, 0)); base.alpha_composite(body, (ox, ch * 16 - lift - bh))
            m = shadow_mask(np.array(base)[:, :, 3] > 0)
            if canopy:                                                     # 수관 그림자: 구덩이 오른쪽 보도 위로 떨어진다
                ex, ey = ox + (x1 - x0) // 2 + 14, ch * 16 - lift - 3
                for y in range(c.height):
                    for x in range(c.width):
                        if ((x - ex) / 15.0) ** 2 + ((y - ey) / 5.0) ** 2 <= 1 and not np.array(base)[y, x, 3]: m[y, x] = True
            px = c.load(); col = GROUNDS[g]['shade']
            for y, x in zip(*np.nonzero(m)): px[int(x), int(y)] = col
        c.alpha_composite(body, (ox, ch * 16 - lift - bh)); return c
    gl = grounds if grounds is not None else (STAND.get(anchor) if standing and shadow else None)
    if gl:
        for g in gl: save(f'jp-st-{name}--{g}', make(g))
    else: save(f'jp-st-{name}', make(None))
    PIECES[name] = dict(w=cw, h=ch, anchor=anchor, layer=layer, tags=tags, ko=ko, **({'grounds': gl} if gl else {}), **({'look': look} if look else {}), **({'repeat': True} if repeat else {}))
def cells_of(sheet, cw=16, chh=16):
    im = src(sheet)
    return None if im is None else [[im.crop((x, y, x + cw, y + chh)) for x in range(0, im.width, cw)] for y in range(0, im.height, chh)]
def raw(name, im, anchor, tags, ko, layer='floor', grounds=None, repeat=True, look=None, variants=None):
    """이미 칸에 맞는 그림을 그대로 조각으로. variants = {바닥: 그림}."""
    if variants:
        for g, v in variants.items(): save(f'jp-st-{name}--{g}', v)
    else: save(f'jp-st-{name}', im)
    ref = im if im is not None else next(iter(variants.values()))
    PIECES[name] = dict(w=ref.width // 16, h=ref.height // 16, anchor=anchor, layer=layer, tags=tags, ko=ko, **({'grounds': list(variants)} if variants else {}), **({'repeat': True} if repeat else {}), **({'look': look} if look else {}))
def comp(*ims):
    c = Image.new('RGBA', ims[0].size, (0, 0, 0, 0))
    for i in ims: c.alpha_composite(i)
    return c
def remap(im, pairs):
    a = np.array(im)
    for s, d in pairs:
        m = (a[:, :, :3] == np.array(s[:3])).all(2) & (a[:, :, 3] > 0); a[m, :3] = d[:3]
    return Image.fromarray(a, 'RGBA')

# ───────── 바닥 무늬 ─────────
def grounds():
    for f, g in GROUNDS.items():
        im = src(g['src'])
        if im is None: print('  (없음)', g['src']); continue
        save(f'jp-st-gnd-{f}', im)
        if g.get('src2') and src(g['src2']) is not None: save(f'jp-st-gnd-{f}-2', src(g['src2']))
        if g['mode'] == 'shuffle':                                         # 민무늬 칸(한 색이 가장 많은 칸)을 더 자주
            sc = []
            for y in range(0, im.height, 16):
                for x in range(0, im.width, 16):
                    a = np.array(im.crop((x, y, x + 16, y + 16)))[:, :, :3].reshape(-1, 3); _, cnt = np.unique(a, axis=0, return_counts=True); sc.append(int(cnt.max()))
            order = sorted(range(len(sc)), key=lambda i: -sc[i]); w = [1] * len(sc)
            for k in order[:max(2, len(sc) // 2)]: w[k] = 4
            g['weights'] = w
        g['cw'], g['ch'] = im.width // 16, im.height // 16
def ground_cell(f):
    im = KITS.get(f'jp-st-gnd-{f}')
    return im.crop((0, 0, 16, 16)) if im is not None else Image.new('RGBA', (16, 16), GROUNDS[f]['base'])

# ───────── 테: 연석 · 테 돌 · 잔디 가장자리 ─────────
BITS = ['n', 'e', 's', 'w']
def combos():
    out = []
    for m in range(1, 16): out.append(''.join(b for i, b in enumerate(BITS) if m >> i & 1))
    return out
def border_set(prefix, ring, ko, tags, post=None, variants=None):
    """ring[r][c] = 3x3(또는 연석 4x3) 고리 조각. 변마다 곧은 조각, 이웃한 두 변은 모퉁이 조각, 나머지 조합은 겹쳐 만든다."""
    T, B, Lf, Rt = ring['n'], ring['s'], ring['w'], ring['e']; C = {'nw': ring['nw'], 'ne': ring['ne'], 'es': ring['se'], 'sw': ring['sw']}
    for bits in combos():
        s = set(bits)
        if len(s) == 1: im = {'n': T, 's': B, 'w': Lf, 'e': Rt}[bits]
        elif bits in ('ne', 'es', 'sw'): im = C[bits]
        elif bits == 'nw': im = C['nw']
        elif bits == 'ns': im = comp(T, B)
        elif bits == 'ew': im = comp(Rt, Lf)
        elif bits == 'nes': im = comp(C['ne'], C['es'])
        elif bits == 'new': im = comp(C['nw'], C['ne'])
        elif bits == 'esw': im = comp(C['es'], C['sw'])
        elif bits == 'nsw': im = comp(C['nw'], C['sw'])
        else: im = comp(C['nw'], C['ne'], C['es'], C['sw'])
        if post: im = post(im)
        if variants: raw(f'{prefix}-{bits}', None, 'floor', tags, ko, variants={g: v(im) for g, v in variants.items()})
        else: raw(f'{prefix}-{bits}', im, 'floor', tags, ko)
def borders():
    k = cells_of('g-kerb')
    if k:
        light = lambda im: remap(im, [(R('concrete', 5), R('concrete', 6)), (R('concrete', 6), hx('#f2efe2') + (255,))]) if False else remap(im, [(R('concrete', 5), R('concrete', 6))])
        plain = lambda row: sorted((1, 2), key=lambda c: len({tuple(p) for p in np.array(k[row][c]).reshape(-1, 4) if p[3]}))[0]
        ring = dict(n=k[0][plain(0)], s=k[2][plain(2)], w=k[1][0], e=k[1][3], nw=k[0][0], ne=k[0][3], se=k[2][3], sw=k[2][0])
        border_set('kerb', ring, '연석', ['border'], post=light)
        raw('kerb-n-mark', light(k[0][3 - plain(0)]), 'floor', ['border'], '연석(주차 금지 칠)'); raw('kerb-s-mark', light(k[2][3 - plain(2)]), 'floor', ['border'], '연석(주차 금지 칠)')
        d = cells_of('g-details')
        if d:
            tact = d[0][0]
            for side, kerb, dy in (('s', ring['s'], -5), ('n', ring['n'], 5)):
                c = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); c.alpha_composite(tact.crop((0, max(0, -dy), 16, 16 - max(0, dy))), (0, max(0, dy))); c.alpha_composite(light(kerb))
                raw(f'kerb-{side}-tactile', c, 'floor', ['border'], '연석 + 점자 블록')
    k2 = cells_of('g-kerb2')
    if k2:
        light = lambda im: remap(im, [(R('concrete', 5), R('concrete', 6))])
        for name, (r, c) in {'kerb-i-se': (0, 0), 'kerb-i-sw': (0, 2), 'kerb-i-ne': (2, 0), 'kerb-i-nw': (2, 2)}.items(): raw(name, light(k2[r][c]), 'floor', ['border'], '연석 안쪽 모퉁이')
    e = cells_of('g-lotedge')
    if e: border_set('sett', dict(n=e[0][1], s=e[2][1], w=e[1][0], e=e[1][2], nw=e[0][0], ne=e[0][2], se=e[2][2], sw=e[2][0]), '필지 테 돌', ['border'])
    ge = cells_of('g-lanedge')
    if ge: border_set('gutter', dict(n=ge[0][1], s=ge[2][1], w=ge[1][0], e=ge[1][2], nw=ge[0][0], ne=ge[0][2], se=ge[2][2], sw=ge[2][0]), '배수로 테', ['border'])
    t = cells_of('g-grassedge')
    if t:
        lawn3 = R('lawn', 3)
        def turf(g):
            under = ground_cell(g)
            def f(im):
                a = np.array(im); out = np.array(under).copy(); keep = (a[:, :, 3] > 0) & ~((a[:, :, :3] == np.array(lawn3[:3])).all(2))
                inside = (a[:, :, 3] > 0) & ~keep; out[inside] = (0, 0, 0, 0); out[keep] = a[keep]
                return Image.fromarray(out, 'RGBA')
            return f
        border_set('turf', dict(n=t[0][1], s=t[2][1], w=t[1][0], e=t[1][2], nw=t[0][0], ne=t[0][2], se=t[2][2], sw=t[2][0]), '잔디 가장자리', ['border'], variants={g: turf(g) for g in ('earth', 'forecourt', 'pave', 'alley', 'tarmac', 'lane')})
    for g, d in GROUNDS.items():
        if g == 'water': continue
    sh = {}
    for g, d in GROUNDS.items():
        if g == 'water': continue
        c = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); px = c.load()
        for y in range(4):
            for x in range(16): px[x, y] = d['shade']
        sh[g] = c
    raw('shade-n', None, 'floor', ['shade', 'road'], '건물 발치 그림자', layer='prop', variants=sh)

# ───────── 노면 표시(코드로 그린다 — 곧은 선) ─────────
def marks():
    WH = R('white', 3); WW = R('white', 2)
    def tile(draw):
        c = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); px = c.load()
        def rect(x0, y0, x1, y1, col=WH):
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1): px[x, y] = col
        draw(rect); return c
    def mk(name, draw, ko): raw(name, tile(draw), 'floor', ['road', 'mark'], ko)
    mk('mark-edge-h-a', lambda r: (r(0, 3, 15, 4), r(6, 4, 8, 4, WW)), '가장자리 선'); mk('mark-edge-h-b', lambda r: (r(0, 11, 15, 12), r(2, 11, 4, 11, WW)), '가장자리 선')
    mk('mark-edge-h-both', lambda r: (r(0, 3, 15, 4), r(0, 11, 15, 12)), '가장자리 선'); mk('mark-edge-v-a', lambda r: (r(3, 0, 4, 15), r(4, 9, 4, 11, WW)), '가장자리 선')
    mk('mark-edge-v-b', lambda r: (r(11, 0, 12, 15), r(11, 3, 11, 5, WW)), '가장자리 선'); mk('mark-edge-v-both', lambda r: (r(3, 0, 4, 15), r(11, 0, 12, 15)), '가장자리 선')
    mk('mark-centre-h', lambda r: r(0, 14, 15, 15), '중앙선'); mk('mark-centre-v', lambda r: r(14, 0, 15, 15), '중앙선')
    for row, extra in (('n', lambda r: None), ('m', lambda r: None), ('s', lambda r: None)):
        mk(f'mark-zebra-h-{row}', lambda r: (r(0, 2, 15, 5), r(0, 10, 15, 13), r(5, 5, 8, 5, WW)), '횡단보도')
    mk('mark-zebra-v', lambda r: (r(2, 0, 5, 15), r(10, 0, 13, 15), r(5, 6, 5, 9, WW)), '횡단보도')
    for side, x in (('w', 11), ('e', 3)):
        for row, ey in (('n', 3), ('m', None), ('s', 11)):
            def d(r, x=x, ey=ey, side=side):
                r(x, 0 if ey != 3 else 3, x + 1, 15 if ey != 11 else 12)
                if ey is not None: r(0 if side == 'w' else x, ey, x + 1 if side == 'w' else 15, ey + 1)
            mk(f'mark-stop-{side}-{row}', d, '정지선')

# ───────── 경계 줄 가족 ─────────
def run_family(fam, ko, ring_sheet, x_sheet, xmap, lift=4, tags=('run',), mids=()):
    ring = src(ring_sheet); names = {}
    def run_piece(name, im, hrows, variants=True, liftpx=lift):
        """가로 줄 조각: 4px 들어 올리고 발치에 그늘 띠(남쪽 바닥의 어두운 단)."""
        ch = hrows // 16
        def make(g):
            c = Image.new('RGBA', (16, ch * 16), (0, 0, 0, 0)); c.alpha_composite(im.crop((0, liftpx, 16, hrows)), (0, 0))
            if g:
                a = np.array(c); cols = a[:, :, 3].any(0); px = c.load()
                for x in range(16):
                    if cols[x]:
                        for y in range(hrows - liftpx, hrows): px[x, y] = GROUNDS[g]['shade']
            return c
        gl = ['pave', 'alley', 'tarmac', 'earth', 'forecourt', 'lawn'] if variants else None
        if gl:
            for g in gl: save(f'jp-st-{name}--{g}', make(g))
        else: save(f'jp-st-{name}', make(None))
        PIECES[name] = dict(w=1, h=ch, anchor='run', layer='prop', tags=list(tags), ko=ko, repeat=True, **({'grounds': gl} if gl else {}))
    if ring is not None:
        for nm, (cx, ry, hh) in {'nw': (0, 0, 32), 'mid': (1, 48, 32), 'ne': (2, 0, 32), 'sw': (0, 48, 32), 'se': (2, 48, 32)}.items():
            run_piece(f'{fam}-{nm}', ring.crop((cx * 16, ry, cx * 16 + 16, ry + hh)), hh); names[nm] = f'{fam}-{nm}'
        for nm, cx in (('sl', 0), ('sr', 2)):
            im = ring.crop((cx * 16, 32, cx * 16 + 16, 48)); save(f'jp-st-{fam}-{nm}', im)
            PIECES[f'{fam}-{nm}'] = dict(w=1, h=1, anchor='run', layer='prop', tags=list(tags), ko=ko, repeat=True); names[nm] = f'{fam}-{nm}'
    xs = src(x_sheet) if x_sheet else None
    if xs is not None:
        for nm, col in xmap.items():
            run_piece(f'{fam}-{nm}', xs.crop((col * 16, 0, col * 16 + 16, 32)), 32); names[nm] = f'{fam}-{nm}'
    if 'mid' not in names: return
    RUNS[fam] = dict(ko=ko, mid=names['mid'], mids=[names[m] for m in mids if m in names], endL=names.get('endl', names['mid']), endR=names.get('endr', names['mid']),
                     **({'sideL': names['sl'], 'sideR': names['sr']} if 'sl' in names else {}), **({k: names[k] for k in ('nw', 'ne', 'sw', 'se') if k in names}),
                     **({'gate': [names['gl'], names['g'], names['gr']]} if all(k in names for k in ('gl', 'g', 'gr')) else {}))
def runs():
    run_family('wall', '블록 담', 'p-wall-ring', 'p-wall-x', dict(m1=0, gl=1, g=2, gr=3, endl=4, endr=5, m2=6), mids=('m1', 'm2'))
    run_family('hedge', '산울타리', 'p-hedge-ring', 'p-hedge-x', dict(endl=0, endr=1, gl=2, g=3, gr=4, m1=5), mids=('m1',))
    run_family('fence', '판자 담', 'p-fence-ring', 'p-fence-x', dict(gl=0, g=1, gr=2, endl=3, endr=4, m1=5), mids=('m1',))
    run_family('rail', '난간', 'p-rail-ring', 'p-rail', dict(endl=0, endr=2), lift=2)
    # 갓돌 위 난간(강둑 북쪽): 같은 그림을 5px 내려 윗칸은 지나다니고 아랫칸(둑 갓돌)에 발이 닿는다
    rr = src('p-rail')
    if rr is not None:
        for nm, col in (('mid', 1), ('endl', 0), ('endr', 2)):
            c = Image.new('RGBA', (16, 32), (0, 0, 0, 0)); c.alpha_composite(rr.crop((col * 16, 0, col * 16 + 16, 27)), (0, 5)); save(f'jp-st-railcap-{nm}', c)
            PIECES[f'railcap-{nm}'] = dict(w=1, h=2, anchor='run', layer='prop', tags=['run'], ko='갓돌 위 난간', repeat=True)
        RUNS['railcap'] = dict(ko='갓돌 위 난간', mid='railcap-mid', mids=[], endL='railcap-endl', endR='railcap-endr')
    for fam, ko, sheet, cols, extra in (('guard', '가드레일', 'p-guard', dict(endl=0, mid=1, endr=2), {}), ('barricade', '공사장 바리케이드', 'p-koji', dict(endl=0, mid=1, endr=2), {})):
        im = src(sheet)
        if im is None: continue
        names = {}
        for nm, col in cols.items():
            s = im.crop((col * 16, 0, col * 16 + 16, im.height)); a = np.array(s)[:, :, 3] > 0; top = int(np.nonzero(a.any(1))[0].min()); ch = -(-(im.height - top + 2) // 16)
            c = Image.new('RGBA', (16, ch * 16), (0, 0, 0, 0)); c.alpha_composite(s.crop((0, im.height - ch * 16 + 2, 16, im.height)), (0, 0)) if im.height >= ch * 16 else c.alpha_composite(s, (0, ch * 16 - im.height - 2))
            save(f'jp-st-{fam}-{nm}', c); PIECES[f'{fam}-{nm}'] = dict(w=1, h=ch, anchor='run', layer='prop', tags=['run'], ko=ko, repeat=True); names[nm] = f'{fam}-{nm}'
        RUNS[fam] = dict(ko=ko, mid=names['mid'], mids=[], endL=names['endl'], endR=names['endr'])
    nf = src('p-netfence')
    if nf is not None:
        names = {}
        for nm, col in dict(endl=0, mid=1, endr=2, m1=3, g=4).items():
            c = Image.new('RGBA', (16, 32), (0, 0, 0, 0)); c.alpha_composite(nf.crop((col * 16, 2, col * 16 + 16, 32)), (0, 0)); save(f'jp-st-net-{nm}', c)
            PIECES[f'net-{nm}'] = dict(w=1, h=2, anchor='run', layer='prop', tags=['run'], ko='철망 울타리', repeat=True); names[nm] = f'net-{nm}'
        side = nf.crop((80, 0, 96, 16)); save('jp-st-net-sl', side); save('jp-st-net-sr', side.transpose(Image.FLIP_LEFT_RIGHT))
        for nm in ('sl', 'sr'): PIECES[f'net-{nm}'] = dict(w=1, h=1, anchor='run', layer='prop', tags=['run'], ko='철망 울타리', repeat=True)
        RUNS['net'] = dict(ko='철망 울타리', mid='net-mid', mids=['net-m1'], endL='net-endl', endR='net-endr', sideL='net-sl', sideR='net-sr', gate=['net-mid', 'net-g', 'net-mid'])

# ───────── 소품 ─────────
def P(sheet, defs):
    for d in defs:
        name, x0, x1, anchor, tags, ko = d[:6]; kw = d[6] if len(d) > 6 else {}
        piece(name, sheet, x0, x1, anchor, tags, ko, **kw)
def props():
    P('p-vend', [('vend-red', 0, 16, 'wall', ['vend', 'spill'], '자판기(빨강)'), ('vend-white', 16, 32, 'wall', ['vend', 'spill'], '자판기(흰색)')])
    P('p-vend2', [('vend-green', 0, 16, 'wall', ['vend', 'spill'], '자판기(녹차)'), ('vend-ice', 16, 32, 'wall', ['vend', 'spill'], '아이스크림 자판기'), ('vend-brown', 32, 48, 'wall', ['vend', 'spill'], '옛 자판기')])
    P('p-bike-cat', [('bike-blue', 0, 32, 'wall', ['bike', 'housefront', 'spill'], '자전거(파랑)'), ('cat-calico', 32, 48, 'open', ['critter'], '삼색 고양이'), ('cat-tabby', 48, 64, 'open', ['critter'], '줄무늬 고양이와 까마귀')])
    P('p-bikes', [('bike-red', 0, 32, 'wall', ['bike', 'housefront', 'spill'], '자전거(빨강)'), ('bike-green', 32, 64, 'wall', ['bike', 'housefront'], '자전거(초록)'), ('bike-fold', 64, 96, 'wall', ['bike', 'spill'], '접이식 자전거')])
    P('p-bikes2', [('bikerack', 0, 48, 'kerb', ['kerb-low', 'bikes'], '자전거 거치대'), ('scooter', 48, 80, 'wall', ['bike', 'housefront', 'spill'], '스쿠터'), ('trike', 80, 96, 'lot', ['yard'], '세발자전거')])
    P('p-animals', [('cat-black', 0, 16, 'open', ['critter'], '검은 고양이'), ('cat-orange', 16, 32, 'open', ['critter'], '자는 고양이'), ('dog-shiba', 32, 48, 'lot', ['yard', 'critter'], '시바견'), ('pigeons', 48, 64, 'open', ['critter'], '비둘기'), ('sparrows', 64, 80, 'open', ['critter'], '참새')])
    P('p-lamp-pole', [('lamp-modern', 0, 16, 'kerb', ['kerb-tall', 'lamp'], '가로등'), ('pole-a', 16, 32, 'kerb', ['kerb-tall', 'pole'], '전봇대')])
    P('p-lamps', [('lamp-shotengai', 0, 16, 'kerb', ['kerb-tall', 'lamp'], '상점가 가로등'), ('lamp-gas', 16, 32, 'kerb', ['kerb-tall', 'lamp', 'promenade-tall'], '가스등 꼴 가로등'), ('lamp-wood', 32, 48, 'kerb', ['kerb-tall', 'lamp'], '나무 전등 기둥')])
    P('p-poles', [('pole-light', 0, 16, 'kerb', ['kerb-tall', 'pole'], '전봇대(가로등)'), ('pole-trans', 16, 32, 'kerb', ['kerb-tall', 'pole'], '전봇대(변압기)'), ('mirror', 32, 48, 'kerb', ['kerb-tall', 'roadsign'], '도로 반사경')])
    P('p-roadsigns', [('sign-stop', 0, 16, 'kerb', ['kerb-tall', 'roadsign'], '정지 표지'), ('sign-school', 16, 32, 'kerb', ['kerb-tall', 'roadsign'], '통학로 표지'), ('sign-noparking', 32, 48, 'kerb', ['kerb-tall', 'roadsign'], '주차 금지 표지'), ('busstop', 48, 64, 'kerb', ['kerb-tall', 'roadsign'], '버스 정류장 표지'), ('signal-ped', 64, 80, 'kerb', ['kerb-tall', 'signal'], '보행 신호등')])
    P('p-signs', [('aframe-coffee', 0, 16, 'wall', ['spill', 'sign'], '입간판(커피)'), ('nobori-red', 16, 32, 'wall', ['spill', 'sign'], '깃발(빨강)'), ('buckets', 32, 48, 'wall', ['spill'], '꽃 양동이')])
    P('p-signs2', [('aframe-ramen', 0, 16, 'wall', ['spill', 'sign'], '입간판(라멘)'), ('signbox', 16, 32, 'wall', ['spill', 'sign'], '불 켜진 간판 상자'), ('nobori-navy', 32, 48, 'wall', ['spill', 'sign'], '깃발(남색)'), ('nobori-green', 48, 64, 'wall', ['spill', 'sign'], '깃발(초록)')])
    P('p-signs3', [('barber', 0, 16, 'wall', ['spill', 'sign'], '이발소 표시등'), ('chochin', 16, 32, 'wall', ['spill', 'sign'], '초롱'), ('menucase', 32, 48, 'wall', ['spill', 'sign'], '음식 견본 진열장'), ('board-flower', 48, 64, 'wall', ['spill', 'sign'], '꽃집 입간판')])
    P('p-spill', [('crates-stack', 0, 16, 'wall', ['spill'], '병 상자 더미'), ('rack-produce', 16, 48, 'wall', ['spill'], '청과 진열대'), ('wagon', 48, 64, 'wall', ['spill'], '세일 왜건')])
    P('p-spill2', [('fishboxes', 0, 32, 'wall', ['spill'], '생선 상자'), ('ricesacks', 32, 48, 'wall', ['spill'], '쌀 포대'), ('flowerstand', 48, 80, 'wall', ['spill'], '꽃 진열대')])
    P('p-spill3', [('bookwagon', 0, 32, 'wall', ['spill'], '헌책 수레'), ('magrack', 32, 48, 'wall', ['spill'], '잡지 선반'), ('gacha', 48, 64, 'wall', ['spill'], '캡슐 뽑기'), ('ride', 64, 80, 'wall', ['spill'], '동전 놀이 기구')])
    P('p-spill4', [('noren-frame', 0, 32, 'wall', ['spill'], '노렌 틀'), ('clothesrack', 32, 64, 'wall', ['spill'], '옷걸이 매대')])
    P('p-spill5', [('keg', 0, 16, 'wall', ['spill', 'backdoor'], '맥주 통과 병 상자'), ('boxes', 16, 32, 'wall', ['spill', 'backdoor'], '종이 상자 더미'), ('handtruck', 32, 48, 'wall', ['spill', 'backdoor'], '손수레'), ('umbrellas', 48, 64, 'wall', ['spill'], '우산꽂이'), ('lpg', 64, 80, 'wall', ['backdoor', 'housefront'], '가스통')])
    P('p-spill6', [('vegcrates', 0, 32, 'wall', ['spill'], '채소 궤짝'), ('sweetsbench', 32, 64, 'wall', ['spill'], '과자 좌판'), ('jars', 64, 80, 'wall', ['spill'], '항아리'), ('stool', 80, 96, 'wall', ['spill'], '걸상과 연장 상자')])
    P('p-resi', [('pots-a', 0, 16, 'wall', ['housefront', 'yard'], '화분'), ('laundry', 16, 48, 'lot', ['yard'], '빨래 건조대'), ('ac-wall', 48, 64, 'facade', ['facade'], '실외기(벽)', dict(lift=0, shadow=False))])
    P('p-resi2', [('futon', 0, 32, 'lot', ['yard'], '이불 널이'), ('pots-shelf', 32, 48, 'wall', ['housefront'], '화분 선반'), ('tap', 48, 64, 'lot', ['yard'], '마당 수도'), ('doghouse', 64, 80, 'lot', ['yard'], '개집')])
    P('p-resi3', [('ac-ground', 0, 16, 'wall', ['housefront', 'backdoor'], '실외기'), ('ac-stack', 16, 32, 'wall', ['backdoor'], '실외기 2단'), ('heater', 32, 48, 'wall', ['housefront', 'backdoor'], '급탕기'), ('postbox-house', 48, 64, 'wall', ['housefront'], '집 우편함'), ('shed', 64, 80, 'lot', ['yard'], '철제 창고')])
    P('p-bench-post', [('bench', 0, 32, 'kerb', ['kerb-low', 'promenade', 'bench'], '벤치'), ('postbox', 32, 48, 'kerb', ['kerb-tall'], '우체통'), ('planter-conc', 48, 64, 'wall', ['housefront', 'spill', 'promenade'], '화분 상자')])
    P('p-benches', [('bench-plain', 0, 32, 'kerb', ['kerb-low', 'promenade', 'bench'], '나무 걸상'), ('bench-stone', 32, 64, 'open', ['promenade', 'bench', 'park'], '돌 벤치'), ('bench-bus', 64, 96, 'kerb', ['kerb-low', 'bench'], '정류장 의자')])
    P('p-bins', [('recycle', 0, 32, 'wall', ['backdoor', 'spill'], '분리수거함'), ('cage', 32, 64, 'kerb', ['kerb-low', 'garbage'], '쓰레기 수거 망'), ('wheelie', 64, 80, 'wall', ['backdoor', 'housefront'], '쓰레기통과 신문 묶음')])
    P('p-planters', [('planter-long', 0, 32, 'kerb', ['kerb-low', 'promenade'], '긴 화단 상자'), ('tub', 32, 48, 'kerb', ['kerb-low', 'promenade'], '꽃 화분'), ('pot-shrub', 48, 64, 'wall', ['housefront', 'spill'], '둥근 나무 화분'), ('pots-b', 64, 80, 'wall', ['housefront'], '화분 둘'), ('styro', 80, 96, 'wall', ['housefront', 'backdoor'], '스티로폼 텃밭')])
    for nm, sheet, x0 in (('tree-zelkova', 'p-tree', 0), ('tree-ginkgo', 'p-trees', 0), ('tree-sakura', 'p-trees', 32), ('tree-camphor', 'p-trees', 64)):
        piece(nm, sheet, x0, x0 + 32, 'kerb', ['tree'], {'tree-zelkova': '가로수(느티)', 'tree-ginkgo': '가로수(은행)', 'tree-sakura': '가로수(벚)', 'tree-camphor': '가로수(녹나무)'}[nm], repeat=True, wpx=48, canopy=True, lift=9, grounds=['pave'])
    for nm, x0, ko in (('gtree-kaki', 0, '마당 감나무'), ('gtree-pine', 32, '마당 큰 소나무'), ('gtree-osmanthus', 64, '금목서')):
        piece(nm, 'p-gtrees', x0, x0 + 32, 'open', ['gardentree'], ko, repeat=True, canopy=True, grounds=['earth', 'lawn'])
    P('p-shrubs', [('pine', 0, 32, 'lot', ['yard', 'garden'], '정원 소나무'), ('azalea', 32, 48, 'lot', ['yard', 'garden'], '철쭉'), ('hydrangea', 48, 64, 'lot', ['yard', 'garden'], '수국'), ('sasa', 64, 80, 'lot', ['yard', 'garden'], '조릿대'), ('maple-sapling', 80, 96, 'lot', ['yard', 'garden'], '단풍 묘목')])
    P('p-yard', [('lantern-stone', 0, 16, 'lot', ['yard', 'garden', 'shrine'], '석등'), ('rocks', 16, 48, 'lot', ['yard', 'garden'], '정원 돌'), ('basin', 48, 64, 'lot', ['yard', 'garden', 'shrine'], '돌 물확'), ('jizo', 64, 80, 'wall', ['shrine', 'spill'], '지장 사당'), ('sodegaki', 80, 96, 'lot', ['yard', 'garden'], '대나무 가림 울')])
    piece('carport', 'p-carport', 0, 48, 'lot', ['cover', 'carport'], '카포트', layer='over', lift=0, shadow=False)
    P('p-cars', [('car-kei', 0, 48, 'road', ['car'], '경차', dict(lift=2, shadow=False)), ('car-sedan', 48, 96, 'road', ['car'], '승용차', dict(lift=2, shadow=False))])
    P('p-cars2', [('car-keitruck', 0, 48, 'road', ['car'], '경트럭', dict(lift=2, shadow=False)), ('car-van', 48, 96, 'road', ['car'], '택배 밴', dict(lift=2, shadow=False))])
    P('p-guard', [('bollards', 48, 64, 'kerb', ['kerb-low'], '볼라드'), ('bollard-stone', 64, 80, 'kerb', ['kerb-low', 'promenade'], '돌 말뚝'), ('hydrant', 80, 96, 'kerb', ['kerb-low'], '소화전')])
    P('p-arcade-arch', [('arch-l', 0, 16, 'run', ['arcade'], '아케이드 입구 기둥', dict(lift=0, shadow=False, repeat=True)), ('arch-beam', 16, 32, 'facade', ['arcade'], '아케이드 들보', dict(lift=0, shadow=False, repeat=True, layer='over', hpx=32)), ('arch-sign', 32, 64, 'facade', ['arcade'], '아케이드 간판', dict(lift=0, shadow=False, repeat=True, layer='over')), ('arch-r', 64, 80, 'run', ['arcade'], '아케이드 입구 기둥', dict(lift=0, shadow=False, repeat=True))])
    P('p-arcade-canopy', [(n, i * 16, i * 16 + 16, 'facade', ['arcade'], '아케이드 차양', dict(lift=0, shadow=False, repeat=True, layer='over', look='canopy')) for i, n in enumerate(['canopy-l', 'canopy-a', 'canopy-b', 'canopy-post', 'canopy-c', 'canopy-r'])])
    P('p-yatai', [('yatai-tako', 0, 48, 'open', ['stall'], '다코야키 노점'), ('yatai-veg', 48, 96, 'open', ['stall'], '채소 노점')])
    P('p-park', [('slide', 0, 32, 'open', ['park'], '미끄럼틀'), ('swing', 32, 64, 'open', ['park'], '그네'), ('rider', 64, 80, 'open', ['park'], '스프링 놀이 기구'), ('fountain', 80, 96, 'open', ['park', 'promenade'], '음수대')])
    P('p-koji', [('cones', 48, 64, 'open', ['koji'], '고깔'), ('toilet', 64, 80, 'lot', ['koji'], '간이 화장실'), ('sand', 80, 96, 'open', ['koji'], '모래 더미')])
    P('p-station', [('shelter', 0, 48, 'kerb', ['station'], '버스 쉘터'), ('phone', 48, 64, 'wall', ['station', 'spill'], '공중전화'), ('lockers', 64, 96, 'wall', ['station', 'spill'], '코인 로커')])
    P('p-parking', [('paymachine', 0, 16, 'lot', ['parking'], '주차 정산기'), ('sign-p', 16, 32, 'lot', ['parking'], '주차장 표지'), ('lockplate', 32, 48, 'floor', ['parking', 'on:tarmac+forecourt'], '주차 잠금판'), ('wheelstops', 48, 64, 'floor', ['parking', 'on:tarmac+forecourt'], '바퀴 멈춤턱'), ('barrier', 64, 80, 'lot', ['parking'], '주차 차단기')])
    P('p-boat', [('boat', 0, 48, 'water', ['afloat'], '나룻배', dict(lift=3, shadow=False)), ('moorpost', 48, 64, 'open', ['promenade'], '계류 말뚝'), ('ducks', 64, 80, 'water', ['afloat'], '오리', dict(lift=4, shadow=False)), ('fishing', 80, 96, 'open', ['promenade'], '낚시 자리')])
def flats():
    d = cells_of('g-details')
    if d:
        raw('tactile', d[0][0], 'floor', ['on:pave'], '점자 블록'); raw('manhole', d[0][1], 'floor', ['road', 'accent-tarmac', 'on:tarmac'], '맨홀'); raw('grate', d[0][2], 'floor', ['road', 'on:tarmac'], '배수구')
        raw('stepstone-a', d[0][3], 'floor', ['step', 'on:earth+lawn'], '디딤돌'); raw('stepstone-b', d[0][4], 'floor', ['step', 'on:earth+lawn'], '디딤돌')
    for sheet, fam, n, kos in (('g-grass-d', 'lawn', 5, ['클로버', '웃자란 풀', '민들레', '닳은 자리', '젖은 풀']), ('g-earth-d', 'earth', 6, ['밟힌 길', '밟힌 길', '조약돌', '마른 풀', '젖은 흙', '잡초'])):
        c = cells_of(sheet)
        if c:
            for i in range(n): raw(f'{fam}-accent-{i}', c[0][i], 'floor', [f'accent-{fam}', f'on:{fam}'], kos[i])
    c = cells_of('g-asphalt-d')
    if c:
        big = src('g-asphalt-d').crop((0, 0, 32, 16)); raw('tarmac-patch-big', big, 'floor', ['road', 'accent-tarmac', 'on:tarmac'], '보수 자국')
        for i, (nm, ko) in enumerate((('tarmac-patch', '보수 자국'), ('tarmac-crack-a', '금'), ('tarmac-crack-b', '금'), ('tarmac-oil', '기름 얼룩'), ('tarmac-wheel', '바퀴 띠'))):
            raw(nm, c[0][2 + i], 'floor', ['road', 'on:tarmac'] + ([] if nm == 'tarmac-wheel' else ['accent-tarmac']), ko)
    ld = src('g-lane-d')
    if ld is not None:
        raw('lane-trench', ld.crop((0, 0, 32, 16)), 'floor', ['road', 'accent-lane', 'on:lane'], '굴착 보수 자국')
        raw('lane-patch', ld.crop((32, 0, 48, 16)), 'floor', ['road', 'accent-lane', 'on:lane'], '보수 자국'); raw('lane-valve', ld.crop((48, 0, 64, 16)), 'floor', ['road', 'accent-lane', 'on:lane'], '밸브 뚜껑')
    br = src('p-bridge')
    if br is not None:
        for side, x0 in (('w', 0), ('e', 16)):
            for part, y0 in (('-n', 0), ('', 16), ('-s', 32)): raw(f'bridge-{side}{part}', br.crop((x0, y0, x0 + 16, y0 + 16)), 'run', ['bridge'], '다리 난간', layer='prop')
    e = src('g-emb')
    if e is not None:
        for i in range(4): raw(f'emb-{i}', e.crop((i * 16, 0, i * 16 + 16, 48)), 'water', ['emb'], '강둑', layer='ground')
    s = src('g-stair')
    if s is not None: raw('emb-stair', s, 'water', ['embstair'], '강둑 계단', layer='ground')
    we = src('g-wateredge')
    if we is not None:
        for i in range(4):
            raw(f'watershade-{i}', we.crop((i * 16, 0, i * 16 + 16, 16)), 'floor', ['watershade'], '둑 그늘진 물')
            raw(f'bankfar-{i}', we.crop((i * 16, 16, i * 16 + 16, 32)).transpose(Image.FLIP_TOP_BOTTOM), 'floor', ['bankfar'], '건너편 둑 갓돌')

ALIAS_RULES = [(r'car-|van|taxi|truck|keitora|-bus', ['car']), (r'tree', ['tree']), (r'lamp|lantern-post', ['lamp']), (r'utility-pole', ['pole']), (r'signal', ['signal']), (r'mirror|road-sign|sign-(stop|slow|school)|doro-sign|speed', ['roadsign']),
               (r'bench', ['bench']), (r'vending', ['vend']), (r'bike-(cluster|rack|shelter)', ['bikes']), (r'bike', ['bike']), (r'planter|kadan|asagao|pots|prop-pot|flower', ['housefront']), (r'post-box|postbox', ['kerb-tall:postbox']),
               (r'a-frame|nobori|blade-sign|banner', ['sign']), (r'stone-lantern|toro', ['shrine']), (r'hokora|jizo', ['shrine']), (r'gomi|garbage', ['garbage']), (r'bollard|cone', ['kerb-low']),
               (r'monohoshi|laundry|futon', ['yard']), (r'cat|dog', ['critter']), (r'rack-|wagon|crate|stall-low|shop-cover', ['spill']), (r'carport', ['carport']), (r'yatai|stall', ['stall']),
               (r'slide|swing|sandbox|jungle|seesaw|park-', ['park']), (r'koji|barricade|kouji', ['koji']), (r'locker|phone|bus-shelter|taxi-sign', ['station']), (r'parking|meter|lot-sign', ['parking']), (r'boat|duck', ['afloat'])]
def alias(repo):
    out = {}
    if not repo: return out
    cat = json.load(open(f'{repo}/src/assets/jpCityStreetCatalog.json', encoding='utf-8'))
    for kid in cat['sizes']:
        if kid.startswith('jp-st-') or kid.startswith('jp-bldg') or kid.startswith('jp-in-'): continue
        for rx, tags in ALIAS_RULES:
            if re.search(rx, kid):
                names = [n for n, p in PIECES.items() if any((t.split(':')[0] in p['tags']) and (':' not in t or t.split(':')[1] == n) for t in tags) and p['anchor'] != 'run' and p['layer'] != 'floor']
                if names: out[kid] = sorted(names)
                break
    return out
KIND = {'ground': 'terrain', 'floor': 'flat', 'run': 'wall_structure'}
def spec_items():
    """굽기 블록이 읽는 목록: 키트마다 칸 크기 · 층(ground 바닥 무늬·bank 제 바닥을 가져오는 조각·floor 바닥 덧그림·shade 건물 발치 그늘·prop 서 있는 것) · 관문 종류 · 이름."""
    items = []
    for k in sorted(KITS):
        im = KITS[k]; name = k[len('jp-st-'):].split('--')[0]; g = k.split('--')[1] if '--' in k else None; p = PIECES.get(name)
        if k.startswith('jp-st-gnd-'): layer, kind, ko, tags = 'ground', 'terrain', '바닥 무늬 · ' + GROUNDS[name[4:].replace('-2', '')]['ko'], ['바닥']
        elif k.startswith('jp-st-shade-'): layer, kind, ko, tags = 'shade', 'flat', '건물 발치 그늘', ['그늘']
        elif p is None: raise SystemExit('조각 표에 없는 키트 ' + k)
        else:
            layer = {'ground': 'bank', 'floor': 'floor'}.get(p['layer'], 'prop')
            kind = 'terrain' if layer == 'bank' else 'flat' if layer == 'floor' else 'wall_structure' if p['anchor'] == 'run' else 'organic' if set(p['tags']) & {'tree', 'gardentree', 'garden'} else 'other'
            ko, tags = p['ko'], list(p['tags'])
        items.append(dict(id=k, piece=name, ground=g, w=im.width // 16, h=im.height // 16, layer=layer, kind=kind, anchor=p['anchor'] if p else None, name=ko + (' · ' + GROUNDS[g]['ko'] + ' 위' if g else ''), tags=tags))
    return items
def main():
    shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    grounds(); borders(); marks(); runs(); props(); flats()
    for k, im in KITS.items(): im.save(f'{OUT}/{k}.png')
    cells = sum((im.width // 16) * (im.height // 16) for im in KITS.values())
    data = dict(version=1, _doc='생성물 — scripts/content/jp-city/street/fable_street_spec.py. 손으로 고치지 않는다.',
                grounds={f: g['ko'] for f, g in GROUNDS.items()}, pieces=PIECES, runs=RUNS, alias=alias(ROOT),
                groundOf={'생활도로': 'lane', '수로': 'water', '거리 · 주차장': 'tarmac', '자갈 참배길': 'earth', '산길 흙': 'earth', '판석 광장': 'pave', '잔디': 'lawn', '校庭 흙 바닥': 'earth'},
                runOf={'블록담': 'wall', '생울타리': 'hedge', '판자담': 'fence', '철망 울타리': 'net', '가드레일': 'guard'})
    index = dict(grounds={f: dict(kit=f'jp-st-gnd-{f}', mode=g['mode'], cw=g.get('cw'), ch=g.get('ch'), weights=g.get('weights'), kit2=(f'jp-st-gnd-{f}-2' if f'jp-st-gnd-{f}-2' in KITS else None)) for f, g in GROUNDS.items()}, kits=sorted(KITS))
    json.dump(index, open(f'{D}/index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    json.dump(dict(waiver='fable-jpstreet-2026-11-15', items=spec_items()), open(f'{D}/spec.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    open(f'{ROOT}/src/assets/jpCityStreetPieces.json', 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('조각', len(PIECES), '· 키트 그림', len(KITS), '· 칸', cells, '· 줄 가족', list(RUNS), '· 옛 id 대응', len(data['alias']))
if __name__ == '__main__': main()
