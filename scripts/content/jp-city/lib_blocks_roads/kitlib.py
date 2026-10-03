"""roads 블록 공용 도우미 — 칸 사전(Reg) · 좌표 회전(Xf) · 키트 사양(Spec) · 오토타일 마스크 해석(realize).
키트는 한 방향(canonical)으로 사양을 쓰고, 90도 회전해 나머지 방향을 만든다. 오토타일 칸은 회전한 지역에서 마스크를 다시 재서 고른다(빛 방향이 맞다).
키트 칸은 같은 블록 안의 칸만 가리킬 수 있어서(계약), 오토타일(autotiles_ground/lines) 칸은 화소 그대로 복사해 이 블록의 칸으로 둔다."""
import os, sys, collections
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
JP = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, JP); sys.path.insert(0, os.path.join(JP, 'blocks'))
from lib_blocks_lines.core import K, Px, rot90, Image, check_cell, ref_cell, ROOT      # noqa: E402
import autotiles_ground as AG                                                           # noqa: E402
import autotiles_lines as AL                                                            # noqa: E402
from . import art                                                                       # noqa: E402

N_, E_, S_, W_, NE_, SE_, SW_, NW_ = 1, 2, 4, 8, 16, 32, 64, 128

_SRC = {}
def src():
    """autotiles_ground / autotiles_lines 를 한 번 굽는다(0.7초). {블록: build() 결과}."""
    if not _SRC:
        _SRC['g'] = AG.build(); _SRC['l'] = AL.build()
    return _SRC

def autotile(block, aid):
    return next(a for a in src()[block]['autotiles'] if a['id'] == aid)

# ───────────── 좌표 회전 ─────────────
class Xf:
    """canonical (w,h) 창을 시계 방향으로 k 번 돈 좌표 변환. (x,y)->(h-1-y,x). oy: 위쪽 덧댐 줄 수(서 있는 물체의 머리칸이 창 밖으로 나갈 때)."""
    def __init__(s, w, h, k=0, oy=0):
        s.k = k % 4; s.dims = [(w, h)]
        for _ in range(s.k): w, h = h, w; s.dims.append((w, h))
        s.w, s.h0 = w, h; s.oy = oy; s.h = h + oy
    def fwd(s, x, y):
        for i in range(s.k):
            w0, h0 = s.dims[i]; x, y = h0 - 1 - y, x
        return x, y + s.oy
    def inv(s, x, y):
        y -= s.oy
        for i in range(s.k - 1, -1, -1):
            w0, h0 = s.dims[i]; x, y = y, h0 - 1 - x
        return x, y
    def pred(s, p):
        """canonical 좌표 술어 → 회전 좌표 술어."""
        return lambda x, y: bool(p(*s.inv(x, y)))
    def vec(s, dx, dy):
        a = s.fwd(0, 0); b = s.fwd(dx, dy); return b[0] - a[0], b[1] - a[1]

# ───────────── 칸 사전 ─────────────
class Reg:
    def __init__(s): s.cells = collections.OrderedDict()
    def add(s, key, img, pc, label, desc, tags):
        if key in s.cells: return key
        s.cells[key] = dict(img=img, pc=pc, label=label, desc=desc, tags=list(tags)); return key
    def copy(s, block, local, key, label=None, desc=None, tags=None, pc=None):
        """다른 블록(g=autotiles_ground, l=autotiles_lines)의 칸을 화소 그대로 복사."""
        if key in s.cells: return key
        c = src()[block]['cells'][local]
        d = desc or ('[키트용 복사 칸: %s 의 %s 칸과 화소가 같다] ' % ({'g': 'autotiles_ground', 'l': 'autotiles_lines'}[block], local)) + c['desc']
        return s.add(key, c['img'].copy(), pc or c['pc'], label or c['label'], d, tags if tags is not None else c['tags'])
    def copy_ref(s, name, key, pc, label, desc, tags):
        """기준 시트(jp_shopstreet16) 칸 이름 → 이 블록 칸(화소 그대로)."""
        if key in s.cells: return key
        return s.add(key, ref_cell(name).copy(), pc, label, '[키트용 복사 칸: 시트 %s 와 화소가 같다] ' % name + desc, tags)
    def planar(s, fam, make, k, pc, label, desc, tags):
        """평면 표시: fam 기본 그림을 시계 방향 k 번 돌린 칸. 키 = fam (k=0) / fam.r<k>."""
        key = fam if k % 4 == 0 else '%s.r%d' % (fam, k % 4)
        if key in s.cells: return key
        im = make()
        if k % 4: im = rot90(im, k % 4)
        return s.add(key, im, pc, label + ('' if k % 4 == 0 else ' (%d°)' % (90 * (k % 4))), desc, tags)

def mask8(pred, x, y):
    m = 0
    for b, dx, dy in ((N_, 0, -1), (E_, 1, 0), (S_, 0, 1), (W_, -1, 0), (NE_, 1, -1), (SE_, 1, 1), (SW_, -1, 1), (NW_, -1, -1)):
        if pred(x + dx, y + dy): m |= b
    return m

def mask4(pred, x, y):
    m = 0
    for b, dx, dy in ((N_, 0, -1), (E_, 1, 0), (S_, 0, 1), (W_, -1, 0)):
        if pred(x + dx, y + dy): m |= b
    return m

def hsh(x, y, s=0):
    n = (x * 73856093 ^ y * 19349663 ^ s * 83492791) & 0xFFFFFF
    return n % 97

# 오토타일 → 이 블록 칸 이름 접두어
AT = {'lane': ('g', 'jp-lane-road', 'ln'), 'sw': ('g', 'jp-sidewalk-curb', 'sw'), 'rail': ('l', 'jp-rail-track', 'rl'), 'hedge': ('l', 'jp-hedge', 'hg')}
def auto_cell(reg, kind, m):
    """오토타일 kind 의 마스크 m(8방 256 / 4방 16) 칸을 이 블록 칸으로 복사하고 로컬 키를 돌려준다."""
    blk, aid, pre = AT[kind]; at = autotile(blk, aid)
    srcloc = at['variantMap'][str(m)]
    return reg.copy(blk, srcloc, pre + '.' + srcloc.split('.', 1)[1])
def body_variant(reg, kind, x, y):
    """몸통(마스크 255)에서 가끔 잔금·얼룩 변형. 위치 해시(난수 아님)."""
    blk, aid, pre = AT[kind]; h = hsh(x, y, 5)
    if kind == 'lane' and h < 8: return reg.copy(blk, 'lane.b1', 'ln.b1')
    if kind == 'lane' and 8 <= h < 15: return reg.copy(blk, 'lane.b2', 'ln.b2')
    if kind == 'sw' and h < 9: return reg.copy(blk, 'sidewalk.b1', 'sw.b1')
    return None

# ───────────── 키트 사양 ─────────────
class Spec:
    """회전이 끝난 창(w×h) 위의 키트 사양. 술어는 창 밖(무한)으로 이어진다."""
    def __init__(s, w, h):
        s.w, s.h = w, h
        no = lambda x, y: False
        s.road = no; s.sw = no; s.sw_mem = None; s.asph = no; s.rail = no; s.hedge = no
        s.deck = {}                  # (x,y) -> 'h'|'v'
        s.base_extra = {}            # (x,y) -> key (아래층에 직접 놓는 칸)
        s.over = {}                  # (x,y) -> key (위층)

def realize(reg, sp, check_roles=True):
    """사양 → (base[y][x], up[y][x]) 로컬 키 격자. 아래층: 덱 > 생활도로 > 보도 > 아스팔트 > 선로. 위층: 생울타리(분리대) + 표시·물체."""
    base = [[None] * sp.w for _ in range(sp.h)]; up = [[None] * sp.w for _ in range(sp.h)]
    prov = {}                          # (x,y) -> (오토타일 종류, 마스크) — selftest 가 원본 오토타일 칸과 화소를 대조한다
    for y in range(sp.h):
        for x in range(sp.w):
            if (x, y) in sp.base_extra: base[y][x] = sp.base_extra[(x, y)]
            elif (x, y) in sp.deck:
                ax = sp.deck[(x, y)]
                base[y][x] = reg.add('dk.' + ax, art.deck_h() if ax == 'h' else art.deck_v(), 'floor', '건널목 바닥판 (%s)' % ('가로 선로' if ax == 'h' else '세로 선로'),
                                     '철도 건널목의 도로 위 바닥판. 레일 두 줄이 선로 오토타일과 같은 자리로 이어진다. 걸을 수 있다.', ['건널목', '선로', '바닥판'])
            elif sp.road(x, y):
                m = mask8(sp.road, x, y); v = body_variant(reg, 'lane', x, y) if m == 255 else None
                base[y][x] = v or auto_cell(reg, 'lane', m); prov[(x, y)] = ('lane', m)
            elif sp.sw(x, y):
                m = mask8(sp.sw_mem or sp.sw, x, y); v = body_variant(reg, 'sw', x, y) if m == 255 else None
                base[y][x] = v or auto_cell(reg, 'sw', m); prov[(x, y)] = ('sw', m)
            elif sp.asph(x, y):
                h = hsh(x, y, 9)
                if h < 6: base[y][x] = reg.copy('g', 'lane.b1', 'ln.b1')
                elif h < 11: base[y][x] = reg.copy('g', 'lane.b2', 'ln.b2')
                else: base[y][x] = reg.copy('g', 'lane.m255', 'ln.m255', label='아스팔트(간선도로 몸통)', desc='간선도로의 차도 아스팔트. 생활도로 오토타일 몸통 칸과 같은 그림. 걸을 수 있다.')
            elif sp.rail(x, y):
                m4 = mask4(sp.rail, x, y); base[y][x] = auto_cell(reg, 'rail', m4); prov[(x, y)] = ('rail', m4)
            if sp.hedge(x, y):
                m4 = mask4(sp.hedge, x, y); up[y][x] = auto_cell(reg, 'hedge', m4); prov[(x, y, 'u')] = ('hedge', m4)
            if (x, y) in sp.over: up[y][x] = sp.over[(x, y)]
    return base, up, prov

def compose(reg, base, up, bg=None):
    """키트 격자를 그림으로: 아래층 → 위층 겹침. bg: PIL 16x16(전체 반복) 또는 None(투명)."""
    h = len(base); w = len(base[0])
    out = Image.new('RGBA', (w * 16, h * 16), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            if bg is not None: out.alpha_composite(bg, (x * 16, y * 16))
            for lay in (base, up):
                k = lay[y][x]
                if k is not None: out.alpha_composite(reg.cells[k]['img'], (x * 16, y * 16))
    return out
