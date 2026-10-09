# v6 소품을 v5 가구 표(kit4.OBJ)에 끼워 넣는 스위치.
#   install()        : OBJ 의 대상 가구를 v6 그림으로 바꾼다(크기·칸 점유·윗면 rect·애니메이션 틀은 v5 그대로).
#                      rooms4 를 import 하기 전에 불러야 예제 맵이 새 그림으로 지어진다.
#   patch_item(f)    : 이미 만든 v5 가구 F 하나를 v6 그림으로 바꾼 사본 (전후 비교용).
# 교체: HAND_INTERIOR_V6=1 python3 scripts/content/hand-interior/build_tileset.py  (swap6.py 참고)
import sys, os, copy
for p in ('tiledata/hand-interior/v5', 'tiledata/hand-interior/v6-objects'):
    if p not in sys.path: sys.path.insert(0, p)
from PIL import Image
import objs6 as O

def _goods(i): return i.split(':', 1)[1].split('+')

def builder(i):
    """v6 그림을 만드는 함수 (없으면 None). 반환 = RGBA 이미지"""
    fixed = {
        'bed green': lambda: O.bed(16, 'green'), 'bed red': lambda: O.bed(16, 'red'), 'bed blue': lambda: O.bed(16, 'blue'),
        'double bed green': lambda: O.bed(32, 'green', 4), 'double bed red': lambda: O.bed(32, 'red', 4), 'double bed blue': lambda: O.bed(32, 'blue', 4),
        'bookshelf 1w': lambda: O.bookshelf(16, 5), 'bookshelf 2w': lambda: O.bookshelf(32, 8), 'bookshelf 3w': lambda: O.bookshelf(48, 13),
        'wardrobe': O.wardrobe, 'clock': O.clock, 'nightstand': O.nightstand, 'cupboard': O.cupboard,
        'chest': O.chest, 'royal chest': lambda: O.chest(True),
        'barrel': O.barrel, 'quench barrel': O.quench_barrel, 'weapon barrel': O.weapon_barrel,
        'water jar': lambda: O.jar(True), 'pot': lambda: O.jar(False),
        'sofa': O.sofa, 'armchair': O.armchair,
        'chair S': lambda: O.chair('S'), 'chair N': lambda: O.chair('N'), 'chair E': lambda: O.chair('E'), 'chair W': lambda: O.chair('W'),
        'stool': O.stool, 'bar stool': O.bar_stool, 'bench 2': lambda: O.bench(2),
        'crate': O.crate, 'cake display case': O.cake_case,
        'potted fern': lambda: O.potted('fern'), 'potted flowering': lambda: O.potted('flowering'), 'potted sapling': lambda: O.potted('sapling'),
        'sack:grain': lambda: O.sack_of(['potato']), 'sack:flour': lambda: O.sack_of(['egg']),
        'fireplace': O.fireplace_base, 'bread oven': O.oven_base, 'stove': O.stove_base, 'kitchen range': lambda: O.range_frame(0),
    }
    if i in fixed: return fixed[i]
    if i.startswith('barrel:'): return lambda: O.barrel_of(_goods(i))
    if i.startswith('crate:'): return lambda: O.crate_of(_goods(i))
    if i.startswith('basket:'): return lambda: O.basket_of(_goods(i))
    if i.startswith('cabinet:'): return lambda: O.cabinet_of(_goods(i))
    return None

def _paint_fireplace(p, t):
    import anim4, math
    from mat import M
    anim4.flame(p, 16, 23, 10, 9, t); anim4.flame(p, 13, 23, 4, 5, t, 1); anim4.flame(p, 19, 23, 4, 5, t, 2)
    for x in range(11, 21, 3):
        p.set(x, 24, M['orange'][5] if anim4.osc(t, 1, x) > 0.3 else M['red'][4])

def _frames(i, f, base):
    """애니메이션 가구: v5 와 같은 주기·틀. 불꽃·불씨는 v5 그림 공식, 몸통만 v6."""
    import anim4
    import k as K5
    N = anim4.N
    if i == 'kitchen range': return [O.range_frame(t) for t in range(N)]
    paint = _paint_fireplace if i == 'fireplace' else f.paint[1]
    out = []
    for t in range(N):
        p = K5.Pix(base.width, base.height); p.im.alpha_composite(base); paint(p, t); out.append(p.im)
    return out

def patch_item(f):
    i = getattr(f, 'id', '') or ''
    if getattr(f, 'style', None) == 'counter':
        g = copy.copy(f); g.im = assemble_counter(f.fw); g.v6 = True; return g
    b = builder(i)
    if b is None: return f
    im = b()
    assert im.size == f.im.size, (i, im.size, f.im.size)
    g = copy.copy(f); g.im = im; g.v6 = True
    if getattr(f, 'frames', None):
        g.frames = _frames(i, f, im); g.im = g.frames[0]
    return g

_CP = None
def counter_pieces():
    global _CP
    if _CP is None:
        _CP = {}
        for Wc, cols in ((1, ['S']), (3, ['L', 'M', 'R'])):
            im = O.counter_slab(Wc)
            for k, cc in enumerate(cols): _CP[(cc, 'S')] = im.crop((k * 16, 0, k * 16 + 16, 24))
    return _CP

def assemble_counter(Wc):
    P = counter_pieces(); im = Image.new('RGBA', (Wc * 16, 24))
    for k in range(Wc):
        cc = 'S' if Wc == 1 else ('L' if k == 0 else 'R' if k == Wc - 1 else 'M')
        im.alpha_composite(P[(cc, 'S')], (k * 16, 0))
    return im

TARGETS = None
def install():
    """kit4.OBJ 의 대상 가구 + 카운터 자동 타일 조각을 v6 로 바꾼다. rooms4 import 전에 부른다."""
    import kit4, kit5, anim4, props5, props6, chapel5, tiles5  # noqa: F401  (OBJ 등록을 모두 끝낸다)
    global TARGETS
    TARGETS = []
    for i, (cat, fn) in list(kit4.OBJ.items()):
        if builder(i) is None: continue
        def nf(fn=fn, i=i):
            f = fn(); f.id = getattr(f, 'id', None) or i; return patch_item(f)
        kit4.OBJ[i] = (cat, nf); TARGETS.append(i)
    P = counter_pieces()
    for key, im in P.items(): kit4.PIECES['counter'][key] = im
    return TARGETS
