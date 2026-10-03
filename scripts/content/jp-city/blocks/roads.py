"""jp_city 블록 `roads` — 일본식 도로 키트(생활도로·간선도로·철도 건널목·지하도/육교 계단·표지류). 계약: ../CONTRACT.md
오토타일(autotiles_ground 의 jp-lane-road · jp-sidewalk-curb, autotiles_lines 의 선로·생울타리·횡단보도)을 화소 그대로 복사해 쓰고,
없는 접속·표지 칸(차선 경계 점선·정지선·방향 화살표·건널목 바닥판·경보기·차단기·지하도·육교·표지)만 코드로 그렸다. 키트 id 는 전부 `jp-` 로 시작.
  python3 scripts/content/jp-city/blocks/roads.py            # selftest + tiledata/jp-city/blocks/roads/*.png
"""
import os, sys, hashlib, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
import numpy as np                                        # noqa: E402
from lib_blocks_roads.kitlib import *                    # noqa: E402,F401,F403
from lib_blocks_roads import kitlib as KL, art           # noqa: E402

BLOCK = 'roads'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'roads')

DIRN = {(-1, 0): 'W', (1, 0): 'E', (0, -1): 'N', (0, 1): 'S'}
TAGS_ROAD = ['도로', '키트']

class PadNeeded(Exception):
    def __init__(s, n): s.n = n

def tall(reg, xf, sp, x, y, base_key, head_key=None):
    """서 있는 물체: canonical (x,y) 아랫칸 + 바로 위(화면 위쪽) 머리칸. 회전해도 위는 위."""
    X, Y = xf.fwd(x, y)
    if head_key is not None and Y - 1 < 0: raise PadNeeded(1 - Y if Y == 0 else -(Y - 1))
    assert (X, Y) not in sp.over, ('겹침', X, Y)
    sp.over[(X, Y)] = base_key
    if head_key is not None:
        assert (X, Y - 1) not in sp.over, ('머리칸 겹침', X, Y - 1)
        sp.over[(X, Y - 1)] = head_key
    return X, Y

def plan(reg, xf, sp, x, y, fam, make, k0, pc, label, desc, tags):
    """평면 표시: canonical (x,y) 에 기본 방향 k0 인 표시를 놓는다(회전은 xf.k 만큼 더해진다)."""
    X, Y = xf.fwd(x, y)
    sp.over[(X, Y)] = reg.planar(fam, make, k0 + xf.k, pc, label, desc, tags)

# ───────────── 표시 칸 등록 ─────────────
def m_dash(reg, xf, sp, x, y, k0=0):
    plan(reg, xf, sp, x, y, 'mk.dash', art.dash_top, k0, 'flat', '차선 경계 점선',
         '같은 방향 차선 사이 흰 점선(칸 가장자리 2px). 도로 위에 얹는 투명 오버레이. 차선 폭은 3칸이라 점선 줄 사이가 3칸.', ['도로', '차선', '오버레이'])
def m_stop(reg, xf, sp, x, y, k0=0):
    plan(reg, xf, sp, x, y, 'mk.stop', art.stop_bar, k0, 'flat', '정지선',
         '교차로·건널목 앞 흰 정지선(3px). 이웃 칸과 이어진다. 접근 차선 칸마다 놓는다. 투명 오버레이.', ['도로', '정지선', '오버레이'])
def m_arrow(reg, xf, sp, x, y, kind, k0=0):
    names = {'s': '직진', 'r': '우회전', 'l': '좌회전', 'sl': '직진·좌회전', 'sr': '직진·우회전'}
    plan(reg, xf, sp, x, y, 'mk.arr.' + kind, lambda kind=kind: art.arrow(kind), k0, 'flat', '방향 화살표 · ' + names[kind],
         '차선 가운데에 그리는 진행 방향 화살표(' + names[kind] + '). 위쪽이 진행 방향(회전해 4방향). 투명 오버레이.', ['도로', '화살표', '오버레이'])
def m_cw(reg, xf, sp, x, y, axis):
    """횡단보도: 보행 방향 axis('ns'|'ew') 를 회전해 맞춘 오토타일 칸(jp-crosswalk-*)을 복사."""
    ax = axis
    if xf.k % 2: ax = 'ew' if axis == 'ns' else 'ns'
    key = reg.copy('l', 'jp-crosswalk-%s.m%d' % (ax, 5 if ax == 'ns' else 10), 'cw.' + ax, label='횡단보도(%s)' % ('남북' if ax == 'ns' else '동서'))
    X, Y = xf.fwd(x, y); sp.over[(X, Y)] = key

def m_tact(reg, xf, sp, x, y):
    """횡단보도 끝 보도 쪽의 경고 점자블록(점 블록). 투명 오버레이."""
    X, Y = xf.fwd(x, y); sp.over[(X, Y)] = reg.copy('l', 'jp-tactile.m0', 'tc.m0', label='경고 점자블록(횡단보도 끝)',
                                                    desc='횡단보도가 보도와 만나는 칸에 얹는 노란 경고 점자블록(점 블록). 투명 오버레이.')

# ───────────── 생활도로 ─────────────
LW = 4
def sp_lane(reg, kind, k):
    """kind: straight(가로 6×4) · end(서쪽이 막힌 6×4) · bend(동·남 8×8) · t(남쪽 가지 12×8) · x(십자 12×12)."""
    dims = {'straight': (6, 4), 'end': (6, 4), 'bend': (8, 8), 't': (12, 8), 'x': (12, 12)}[kind]
    xf = Xf(dims[0], dims[1], k); sp = Spec(xf.w, xf.h)
    if kind == 'straight': p = lambda x, y: 0 <= y < LW
    elif kind == 'end': p = lambda x, y: 0 <= y < LW and x >= 0
    elif kind == 'bend': p = lambda x, y: ((0 <= y < LW and x >= 0) or (0 <= x < LW and y >= 0) or (x, y) == (LW, LW)) and (x, y) != (0, 0)     # 바깥 모서리 한 칸을 깎고 안쪽 모서리 한 칸을 메운다(隅切り)
    elif kind == 't': p = lambda x, y: (0 <= y < LW) or (4 <= x < 8 and y >= 0) or (x, y) in ((3, 4), (8, 4))
    else: p = lambda x, y: (4 <= y < 8) or (4 <= x < 8) or (x, y) in ((3, 3), (8, 3), (3, 8), (8, 8))
    sp.road = xf.pred(p)
    return xf, sp

# ───────────── 간선도로 ─────────────
TH = 17          # 가로 간선: 보도 2 + 차선 3·3 + 분리대 1 + 차선 3·3 + 보도 2
def sp_trunk_straight(reg, k):
    xf = Xf(8, TH, k); sp = Spec(xf.w, xf.h)
    sp.sw = xf.pred(lambda x, y: y < 2 or y >= 15 or y == 8)
    sp.asph = xf.pred(lambda x, y: 2 <= y <= 14 and y != 8)
    sp.hedge = xf.pred(lambda x, y: y == 8)
    for x in range(8):
        for y in (5, 12): m_dash(reg, xf, sp, x, y)
    return xf, sp

NT = 29          # 십자 간선: 팔 8(보도 띠 2 포함) + 중심 13 + 팔 8. 차도 8..20, 분리대 14, 보도 6~7·21~22(네 모서리는 ㄱ자 보도), 모서리 안쪽 6×6 은 건물 자리(비움)
def sp_trunk_cross(reg, k):
    xf = Xf(NT, NT, 0); sp = Spec(NT, NT)
    road = lambda x, y: 8 <= x <= 20 or 8 <= y <= 20
    band = lambda x, y: (6 <= x <= 22) or (6 <= y <= 22)
    med = lambda x, y: (y == 14 and (x <= 4 or x >= 24)) or (x == 14 and (y <= 4 or y >= 24))
    sp.sw = lambda x, y: (band(x, y) and not road(x, y)) or med(x, y)
    sp.sw_mem = lambda x, y: (not road(x, y)) or med(x, y)           # 건물 자리까지 보도가 이어지는 것으로 보고 마스크를 잰다(건물 쪽에 연석을 그리지 않는다)
    sp.asph = lambda x, y: road(x, y) and not med(x, y)
    sp.hedge = med
    I = Xf(NT, NT, 0)
    for x in list(range(0, 5)) + list(range(24, 29)):               # 차선 경계 점선은 직선 키트와 같은 줄에 직접 놓는다(180° 회전하면 경계선 안쪽 2px 가 어긋난다)
        for y in (11, 18): m_dash(reg, I, sp, x, y)
    for y in list(range(0, 5)) + list(range(24, 29)):
        for x in (10, 17): m_dash(reg, I, sp, x, y, 1)
    for r in range(4):                      # 서쪽 팔을 4번 돌려 네 팔을 만든다(정지선·화살표·횡단보도)
        xr = Xf(NT, NT, r)
        for y in range(8, 14): m_stop(reg, xr, sp, 5, y)
        m_arrow(reg, xr, sp, 2, 9, 'sl', 1); m_arrow(reg, xr, sp, 2, 12, 'r', 1)
        for x in (6, 7):
            for y in range(8, 21): m_cw(reg, xr, sp, x, y, 'ns')
            for y in (7, 21): m_tact(reg, xr, sp, x, y)
    return xf, sp

# ───────────── 철도 건널목 ─────────────
def _fk_cells(reg):
    ap = lambda: reg.add('al.pole', art.alarm_pole(), 'solid', '건널목 경보기 기둥', '철도 건널목 경보기의 기둥+받침(노랑-검정 띠). 막힘.', ['건널목', '경보기', '막힘'])
    ah = lambda: reg.add('al.head', art.alarm_head(), 'star', '건널목 경보기 머리', '철도 건널목 경보기의 머리(노랑-검정 X 표지 + 빨간 경고등 둘). 걸어서 지나갈 수 있는 윗칸(사람 위에 그려짐).', ['건널목', '경보기', '윗칸'])
    gb = lambda: reg.add('gt.box', art.gate_box(), 'solid', '건널목 차단기 본체', '철도 건널목 차단기의 회색 본체. 막힘.', ['건널목', '차단기', '막힘'])
    gt = lambda: reg.add('gt.top', art.gate_top(), 'star', '건널목 차단기 (올라간 팔)', '올라가 있는 차단기 팔(노랑-검정 세로 막대). 걸어서 지나갈 수 있는 윗칸. 차단기가 열린 상태.', ['건널목', '차단기', '윗칸'])
    def arm(ax, kind):
        fn = art.arm_ew if ax == 'ew' else art.arm_ns
        return reg.add('am.%s.%s' % (ax, kind), fn(kind), 'solid', '내려온 차단기 팔 (%s)' % kind, '내려와 있는 차단기 팔의 한 토막(노랑-검정 줄). 막힘. 차단기가 닫힌 상태.', ['건널목', '차단기', '막힘'])
    return ap, ah, gb, gt, arm

def sp_fumikiri(reg, axis, closed):
    """axis 'v': 세로 도로(폭 4, x2..5) × 가로 선로(y4), 8×9. 왼쪽통행: 북쪽에서 오는 차는 동쪽 차선, 남쪽에서 오는 차는 서쪽 차선.
       북쪽 접근: 차단기 (6,3)·경보기 (7,3)·정지선 y1 / 남쪽 접근: 차단기 (1,6)·경보기 (0,6)·정지선 y8. 닫힘은 팔이 도로 쪽(가로)으로 내려온다.
       axis 'h': 가로 도로(폭 4, y2..5) × 세로 선로(x4), 9×8. 서쪽에서 오는 차는 북쪽 차선, 동쪽에서 오는 차는 남쪽 차선.
       서쪽 접근: 차단기 (3,1)·경보기 (2,1)·정지선 x1 / 동쪽 접근: 차단기 (5,6)·경보기 (6,6)·정지선 x7. 닫힘은 팔이 세로로 내려온다."""
    ap, ah, gb, gt, arm = _fk_cells(reg)
    if axis == 'v':
        sp = Spec(8, 9); xf = Xf(8, 9, 0)
        sp.road = lambda x, y: 2 <= x <= 5; sp.rail = lambda x, y: y == 4
        for x in range(2, 6): sp.deck[(x, 4)] = 'h'
        for x in (4, 5): m_stop(reg, xf, sp, x, 1, 1)
        for x in (2, 3): m_stop(reg, xf, sp, x, 8, 1)
        posts = ((6, 3, 7, 3, -1, 'ew'), (1, 6, 0, 6, 1, 'ew'))
    else:
        sp = Spec(9, 8); xf = Xf(9, 8, 0)
        sp.road = lambda x, y: 2 <= y <= 5; sp.rail = lambda x, y: x == 4
        for y in range(2, 6): sp.deck[(4, y)] = 'v'
        for y in (2, 3): m_stop(reg, xf, sp, 1, y, 0)
        for y in (4, 5): m_stop(reg, xf, sp, 7, y, 0)
        posts = ((3, 1, 2, 1, 0, 'ns'), (5, 6, 6, 6, 0, 'ns'))
    for (gx, gy, alx, aly, adx, ax2) in posts:
        tall(reg, xf, sp, alx, aly, ap(), ah())
        if not closed:
            tall(reg, xf, sp, gx, gy, gb(), gt())
        else:
            tall(reg, xf, sp, gx, gy, gb(), None)
            if ax2 == 'ew':
                sp.over[(gx + adx, gy)] = arm('ew', 'mid' if abs(adx) else 'mid')
                sp.over[(gx + 2 * adx, gy)] = arm('ew', 'tipW' if adx < 0 else 'tipE')
            else:
                dy = 1 if gy < 4 else -1
                sp.over[(gx, gy + dy)] = arm('ns', 'mid')
                sp.over[(gx, gy + 2 * dy)] = arm('ns', 'tipS' if dy > 0 else 'tipN')
    return xf, sp

# ───────────── 키트 정의 ─────────────
def L(id_, ko, desc, rules, **kw):
    d = dict(id=id_, name=ko, desc=desc, rules=rules, tags=list(TAGS_ROAD), repeat='fixed', growth=None, snap='floor', parts=[], access=[], role='terrain')
    d.update(kw); return d

ROT_T = {0: ('s', '남쪽'), 1: ('w', '서쪽'), 2: ('n', '북쪽'), 3: ('e', '동쪽')}
ROT_END = {0: ('w', '서쪽'), 1: ('n', '북쪽'), 2: ('e', '동쪽'), 3: ('s', '남쪽')}
ROT_BEND = {0: ('es', '동·남'), 1: ('sw', '남·서'), 2: ('wn', '서·북'), 3: ('ne', '북·동')}

KITS = []
def _lane_kits():
    out = []
    LR = ('생활도로(폭 4칸, 보도 없음, 가장자리에 흰 외측선). 도로 칸은 오토타일 jp-lane-road 와 이음새가 맞아 같은 도로에 이어 칠할 수 있다. '
          '키트 밖(집 앞 땅)은 비어 있으니 보도·콘크리트·건물 앞마당과 겹쳐 놓는다.')
    out.append(L('jp-road-lane-h', '생활도로 · 직선(가로)', '보도 없는 생활도로 가로 직선 6×4. 좌우로 이어 길이를 늘린다.', LR + ' 가로로 반복.', spec=('lane', 'straight', 0), repeat='repeat', growth='x'))
    out.append(L('jp-road-lane-v', '생활도로 · 직선(세로)', '보도 없는 생활도로 세로 직선 4×6. 위아래로 이어 길이를 늘린다.', LR + ' 세로로 반복.', spec=('lane', 'straight', 1), repeat='repeat', growth='y'))
    for k, (c, ko) in ROT_T.items():
        out.append(L('jp-road-lane-t-' + c, 'T자 생활도로 · %s 가지' % ko, '생활도로 T자 교차로 12×8. 가로 본선에 %s으로 갈라지는 길. 모서리 안쪽은 오토타일이 둥글게 비워 준다.' % ko, LR, spec=('lane', 't', k)))
    out.append(L('jp-road-lane-x', '생활도로 · 십자 교차로', '생활도로 십자 교차로 12×12. 네 모서리가 안쪽으로 파인다.', LR, spec=('lane', 'x', 0)))
    for k, (c, ko) in ROT_BEND.items():
        out.append(L('jp-road-lane-bend-' + c, '생활도로 · 굽은 길(%s)' % ko, '생활도로가 직각으로 꺾이는 8×8. %s 방향으로 길이 뻗는다.' % ko, LR, spec=('lane', 'bend', k)))
    for k, (c, ko) in ROT_END.items():
        out.append(L('jp-road-lane-end-' + c, '생활도로 · 막다른 길(%s 끝)' % ko, '막다른 생활도로 6×4. %s 쪽이 막혀 있다(흰 외측선이 끝을 두른다).' % ko, LR, spec=('lane', 'end', k)))
    return out

TR = ('4차선 간선도로(차도 13줄: 3칸 차선 넷 + 중앙분리대 1칸, 양쪽 보도 2칸). 왼쪽 통행: 동쪽으로 가는 차는 북쪽 반. 연석·보도는 오토타일 jp-sidewalk-curb 와 이음새가 맞다. '
      '보도 바깥쪽(건물 쪽)은 키트 밖으로 이어지는 것으로 그렸으니 건물 앞 보도에 겹쳐 놓는다.')
def _trunk_kits():
    return [
        L('jp-road-trunk-h', '간선도로 4차선 · 직선(가로)', '4차선+중앙분리대 간선도로 가로 직선 8×17. 차선 경계 점선, 분리대는 생울타리.', TR + ' 가로로 반복.', spec=('trunk', 'straight', 0), repeat='repeat', growth='x'),
        L('jp-road-trunk-v', '간선도로 4차선 · 직선(세로)', '4차선+중앙분리대 간선도로 세로 직선 17×8.', TR + ' 세로로 반복.', spec=('trunk', 'straight', 1), repeat='repeat', growth='y'),
        L('jp-road-trunk-x', '간선도로 4차선 · 십자 교차로(정지선·화살표·횡단보도)', '간선도로 십자 교차로 27×27. 접근로마다 정지선·좌/우회전 화살표·횡단보도, 분리대는 횡단보도 앞에서 끝난다.',
          TR + ' 사방으로 간선이 이어지는 교차로 한 덩이.', spec=('trunk', 'cross', 0)),
    ]

FR = ('철도 건널목(폭 4칸 생활도로 × 선로 한 줄). 선로는 오토타일 jp-rail-track 위에 바닥판이 얹혀 도로와 만난다. 왼쪽 통행이라 차단기는 접근 차선 쪽 길가에 선다. '
      '위층(경보기 머리·올라간 차단기 팔)은 지나갈 수 있고 기둥·본체·내려온 팔은 막힌다.')
def _fumikiri_kits():
    out = []
    for axis, ko in (('v', '세로 도로 × 가로 선로'), ('h', '가로 도로 × 세로 선로')):
        out.append(L('jp-fumikiri-%s' % axis, '철도 건널목 · %s (열림)' % ko, '경보기 둘·올라간 차단기 둘·바닥판·정지선이 있는 건널목. 차단기가 열린 상태(통행 가능).', FR, spec=('fumikiri', axis, False), snap='free', role='prop',
                     tags=['건널목', '철도', '도로', '키트']))
        out.append(L('jp-fumikiri-%s-closed' % axis, '철도 건널목 · %s (닫힘)' % ko, '같은 건널목에서 차단기 팔이 내려와 접근 차선을 막은 상태. 열차 통과 연출용.', FR, spec=('fumikiri', axis, True), snap='free', role='prop',
                     tags=['건널목', '철도', '도로', '키트']))
    return out

# ───────────── 격자로 정의하는 키트(지하도·육교·표지) ─────────────
def grid_kit(reg, kd):
    """kd['cellsfn'](reg) → (w, h, {(x,y): (key, layer)}) ; layer 'base'|'up'."""
    w, h, items = kd['cellsfn'](reg)
    base = [[None] * w for _ in range(h)]; up = [[None] * w for _ in range(h)]
    for (x, y), (key, lay) in items.items(): (base if lay == 'base' else up)[y][x] = key
    return base, up, {}

def _ug(reg):
    c = art.underpass_cells(); items = {}
    for (cx, cy), im in c.items():
        if not np.array(im)[..., 3].any(): continue
        floor = cy >= 1 and cx in (1, 2)
        key = reg.add('ug.%d.%d' % (cx, cy), im, 'floor' if floor else 'solid', '지하도 입구 (%d,%d)' % (cx + 1, cy + 1),
                      ('지하도 입구 계단의 걸을 수 있는 계단 칸(아래층). 계단 아래 칸이 입구 위치.' if floor else '지하도 입구의 북쪽 벽·난간벽(막힘, 위층).'), ['지하도', '계단', '입구'])
        items[(cx, cy)] = (key, 'base' if floor else 'up')
    return 4, 4, items

def _fb(reg):
    c = art.footbridge_cells(); items = {}
    for (cx, cy), im in c.items():
        if not np.array(im)[..., 3].any(): continue
        if cy == 0: pc = 'star'
        elif cy == 1: pc = 'solid'
        else: pc = 'floor' if cx in (1, 2) else 'solid'
        lab = {'star': '육교 난간·바닥 윗면(걸어 지나감 ★)', 'solid': '육교 바닥 앞면·난간벽(막힘)', 'floor': '육교 계단(걸을 수 있음)'}[pc]
        key = reg.add('fb.%d.%d' % (cx, cy), im, pc, '육교 계단 (%d,%d) %s' % (cx + 1, cy + 1, lab), '육교 계단 한 세트의 칸. ' + lab + '.', ['육교', '계단', '보행교'])
        items[(cx, cy)] = (key, 'base' if pc == 'floor' else 'up')
    return 4, 5, items

def _sg(kind):
    def f(reg):
        if kind == 'tomare':
            h = reg.copy_ref('prop.stop_sign.c0.r0', 'sg.tomare.head', 'star', '일시정지 표지 머리(止まれ 역삼각)', '빨간 역삼각 일시정지 표지의 머리. 걸어 지나갈 수 있는 윗칸. 글자(止まれ)는 넣지 않았다(16px 에서 읽히지 않음).', ['표지', '일시정지', '윗칸'])
            b = reg.copy_ref('prop.stop_sign.c0.r2', 'sg.base', 'solid', '표지 기둥 받침', '표지 기둥과 받침. 막힘.', ['표지', '기둥', '막힘'])
        elif kind == 'mirror':
            h = reg.copy_ref('prop.curve_mirror.c0.r1', 'sg.mirror.head', 'star', '커브 미러 머리', '둥근 커브 미러(주황 테두리). 걸어 지나갈 수 있는 윗칸.', ['표지', '커브미러', '윗칸'])
            b = reg.copy_ref('prop.curve_mirror.c0.r2', 'sg.mirror.base', 'solid', '커브 미러 기둥 받침', '커브 미러 기둥과 받침. 막힘.', ['표지', '커브미러', '막힘'])
        elif kind == 'coin':
            h = reg.copy_ref('prop.coin_p.c0.r0', 'sg.coin.head', 'star', '코인 파킹 표지 머리(파란 P)', '코인 파킹 안내 표지(파란 바탕 P). 걸어 지나갈 수 있는 윗칸.', ['표지', '주차', '윗칸'])
            b = reg.copy_ref('prop.coin_p.c0.r1', 'sg.coin.base', 'solid', '코인 파킹 표지 기둥 받침', '코인 파킹 표지의 기둥과 받침. 막힘.', ['표지', '주차', '막힘'])
        else:
            h = reg.add('sg.post.head', art.sign_post_head(), 'star', '도로 표지 기둥 머리(지시 표지)', '파란 사각 지시 표지(흰 화살표). 걸어 지나갈 수 있는 윗칸.', ['표지', '지시표지', '윗칸'])
            b = reg.copy_ref('prop.stop_sign.c0.r2', 'sg.base', 'solid', '표지 기둥 받침', '표지 기둥과 받침. 막힘.', ['표지', '기둥', '막힘'])
        return 1, 2, {(0, 0): (h, 'up'), (0, 1): (b, 'up')}
    return f

def _bike(reg):
    k = reg.planar('mk.bike', art.bike_stop, 0, 'flat', '자전거 정차선', '자전거 대기 위치 표시: 흰 정지선 아래 파란 바탕에 자전거 그림. 도로 가장자리 차선 위에 놓는 투명 오버레이(평면).', ['도로', '자전거', '정차선', '오버레이'])
    return 1, 1, {(0, 0): (k, 'up')}

def extra_kit_defs():
    SG = '길가 표지(1×2: 윗칸은 걸어 지나갈 수 있고 아래 기둥 받침은 막힌다). 보도 가장자리나 도로 모퉁이에 한 개씩 세운다.'
    return [
        L('jp-underpass-entrance', '지하도 입구(내려가는 계단)', '보행자 지하도 입구 4×4: 북쪽 벽의 어두운 터널 입구, 양쪽 난간벽, 아래로 내려가는 계단(가장 아래에 노란 점자 띠). 위에서 보이는 3/4 시점의 단순형.',
          '보도·광장 위에 놓는다. 계단 아래 칸(키트 맨 아래 줄 가운데 두 칸)이 입구이고 그 아래(남쪽) 칸으로 접근한다. 계단 안은 걸을 수 있고 워프 이벤트를 심는다.',
          cellsfn=_ug, snap='free', role='prop', tags=['지하도', '계단', '입구', '키트'], parts=[dict(kind='anchor', x=1, y=3, w=2, h=1, label='지하도 입구(계단 아래)')],
          access=[dict(x=1, y=4), dict(x=2, y=4)]),
        L('jp-footbridge-stairs', '육교 계단', '보행교(육교) 계단 한 세트 4×5: 위쪽 보행교 바닥 앞면·난간, 양쪽 난간벽, 올라가는 계단(가장 아래에 노란 점자 띠).',
          '큰 도로 옆 보도에 놓는다. 계단 아래 칸(키트 맨 아래 줄 가운데 두 칸)으로 접근한다. 윗줄(난간·바닥)은 지나갈 수 있는 위층이고 바닥 앞면은 막힌다. 계단 안은 걸을 수 있고 워프 이벤트를 심는다.',
          cellsfn=_fb, snap='free', role='prop', tags=['육교', '계단', '보행교', '키트'], parts=[dict(kind='anchor', x=1, y=4, w=2, h=1, label='육교 계단 아래')],
          access=[dict(x=1, y=5), dict(x=2, y=5)]),
        L('jp-road-sign-tomare', '일시정지 표지(역삼각)', '빨간 역삼각 일시정지 표지 1×2(止まれ). 글자는 16px 에서 읽히지 않아 역삼각 도형으로 그렸다.', SG, cellsfn=_sg('tomare'), snap='free', role='prop', tags=['표지', '일시정지', '키트']),
        L('jp-road-sign-mirror', '커브 미러', '둥근 커브 미러 1×2(주황 기둥).', SG, cellsfn=_sg('mirror'), snap='free', role='prop', tags=['표지', '커브미러', '키트']),
        L('jp-road-sign-post', '도로 표지 기둥(지시 표지)', '파란 사각 지시 표지(흰 화살표) 기둥 1×2.', SG, cellsfn=_sg('post'), snap='free', role='prop', tags=['표지', '지시표지', '키트']),
        L('jp-road-sign-coin', '코인 파킹 표지', '파란 바탕 P 의 코인 파킹 표지 1×2.', SG, cellsfn=_sg('coin'), snap='free', role='prop', tags=['표지', '주차', '키트']),
        L('jp-road-mark-bike-stop', '자전거 정차선', '자전거 대기 위치 표시 1×1(흰 정지선 + 파란 바탕 자전거). 투명 오버레이(평면).', '도로 가장자리 차선 위에 놓는다. 걸을 수 있다.',
          cellsfn=_bike, snap='floor', role='terrain', tags=['도로', '자전거', '정차선', '키트']),
    ]

def kit_defs():
    return _lane_kits() + _trunk_kits() + _fumikiri_kits() + extra_kit_defs()

def make_spec(reg, kd):
    sp = kd['spec']
    if sp[0] == 'lane': return sp_lane(reg, sp[1], sp[2])
    if sp[0] == 'trunk': return sp_trunk_straight(reg, sp[2]) if sp[1] == 'straight' else sp_trunk_cross(reg, 0)
    if sp[0] == 'fumikiri': return sp_fumikiri(reg, sp[1], sp[2])
    raise KeyError(sp)

def realize_kit(reg, kd):
    if 'cellsfn' in kd: return grid_kit(reg, kd)
    xf, sp = make_spec(reg, kd)
    return KL.realize(reg, sp)

def draft(kid=None):
    reg = Reg(); outs = {}
    for kd in kit_defs():
        if kid and kd['id'] != kid: continue
        outs[kd['id']] = realize_kit(reg, kd)
    return reg, outs

# ───────────── 계약 인터페이스 ─────────────
def _group_of(key):
    if key.startswith(('mk.', 'cw.', 'tc.')): return 'mark'
    if key.startswith(('al.', 'gt.', 'am.')): return 'fumikiri'
    if key.startswith('dk.'): return 'deck'
    if key.startswith(('ug.', 'fb.')): return 'stairs'
    if key.startswith('sg.'): return 'sign'
    return None
GROUPS = [
    ('mark', 'jp:road-kit-marking', '도로 키트 · 노면 표시', 'road', 'lower',
     '차선 경계 점선·정지선·방향 화살표·자전거 정차선(평면 투명 오버레이, 4방향 회전본 포함)과 횡단보도·경고 점자블록 복사 칸.',
     '도로 위(아래층이 아스팔트)에 투명으로 얹는다. 도로가 없는 곳에 단독으로 두지 않는다. 낱칸보다 키트(jp-road-trunk-x 등)로 찍는다 — 키트 안에 맞는 자리로 들어 있다.'),
    ('fumikiri', 'jp:fumikiri-parts', '철도 건널목 · 경보기·차단기', 'prop', 'upper',
     '철도 건널목의 경보기(기둥 막힘·머리 윗칸)·차단기(본체 막힘·올라간 팔 윗칸·내려온 팔 막힘). 서 있는 물체라 위층.',
     '건널목 키트(jp-fumikiri-*)로 찍는다. 낱칸으로 쓰면 경보기·차단기가 선로·도로 없이 떠 있게 된다.'),
    ('deck', 'jp:fumikiri-deck', '철도 건널목 · 바닥판', 'path', 'lower',
     '도로와 선로가 만나는 칸의 바닥판(레일 두 줄이 선로 오토타일 jp-rail-track 과 같은 자리로 이어진다). 아래층, 걸을 수 있다.',
     '선로(jp-rail-track) 가 도로를 가로지르는 칸에 깐다(건널목 키트 jp-fumikiri-* 가 맞는 자리에 놓는다).'),
    ('stairs', 'jp:underpass-footbridge', '지하도 입구·육교 계단', 'prop', 'upper',
     '지하도 입구(내려가는 계단)와 육교(보행교) 계단 한 세트의 칸. 계단 칸은 걸을 수 있고 난간벽·벽은 막힌다.',
     '키트(jp-underpass-entrance, jp-footbridge-stairs)로 찍는다. 계단 칸에 워프 이벤트를 심는다.'),
    ('sign', 'jp:road-sign-parts', '길가 표지(1×2)', 'prop', 'upper',
     '일시정지 역삼각·커브 미러·지시 표지·코인 파킹 표지의 머리칸(윗칸, 지나감 ★)과 기둥 받침(막힘).',
     '키트(jp-road-sign-*)로 찍는다. 머리칸 위에 기둥 받침 칸이 붙는 1×2 한 쌍이다.'),
]
_CACHE = {}
def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    reg = Reg(); kits = []; used = set(); index = {}
    for kd in kit_defs():
        base, up, prov = realize_kit(reg, kd)
        h = len(up); w = len(up[0])
        for lay in (base, up):
            for row in lay:
                for k in row:
                    if k is not None: used.add(k)
        has_base = any(k is not None for row in base for k in row)
        ai = dict(snap=kd['snap'], tags=list(kd['tags']), description=kd['desc'], placementRules=kd['rules'], repeatability=kd['repeat'],
                  growthAxis=kd['growth'], anchor=dict(dx=w // 2, dy=h - 1), access=kd['access'], role=kd['role'])
        kits.append(dict(id=kd['id'], name=kd['name'], grid=up, base=base if has_base else None, parts=kd['parts'], ai=ai))
        index[kd['id']] = (base, up, prov)
    cells = collections.OrderedDict((k, reg.cells[k]) for k in reg.cells if k in used)
    groups = []
    for tag, gid, name, role, layer, desc, rules in GROUPS:
        mem = [k for k in cells if _group_of(k) == tag]
        if mem: groups.append(dict(id=gid, name=name, role=role, defaultLayer=layer, cells=mem, desc=desc, rules=rules))
    _CACHE['r'] = (reg, cells, kits, groups, index)
    return _CACHE['r']

NOTES = ('도로 키트 블록. 오토타일(autotiles_ground 생활도로·보도 연석, autotiles_lines 선로·생울타리·횡단보도·점자블록)의 칸을 화소 그대로 복사해 쓰고(키트 칸은 같은 블록 칸만 가리킬 수 있어서), '
         '새로 그린 칸은 차선 경계 점선·정지선·방향 화살표 5종×회전·자전거 정차선·건널목 바닥판·경보기·차단기(올림/내림 팔)·지하도·육교·지시 표지뿐이다. '
         '키트는 canonical 방향 하나로 사양을 쓰고 90도 회전해 4방향을 만든다(오토타일 칸은 회전한 지역에서 마스크를 다시 재서 고른다). '
         '한계: (1) 止まれ 글자는 글리프(glyphs.json)에 없고 16px 에서 읽히지 않아 역삼각 도형만. (2) 차선 폭 3칸 → 간선 4차선 키트가 17칸 높이, 십자는 27×27. '
         '(3) 건널목은 단선·생활도로(폭 4) 한 가지. (4) 지하도·육교는 북쪽을 향한 한 방향. (5) 신호기·가로등은 시트의 기존 소품(jp-prop-signal 등)을 쓴다.')
def build():
    reg, cells, kits, groups, index = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': groups, 'kits': kits, 'notes': NOTES}

# ───────────── 검사 ─────────────
def _same_px(a, b):
    A = np.array(a.convert('RGBA')); B = np.array(b.convert('RGBA'))
    A[A[..., 3] == 0] = 0; B[B[..., 3] == 0] = 0
    return A.shape == B.shape and bool((A == B).all())

def _digest(b):
    h = hashlib.sha256()
    for k in sorted(b['cells']): h.update(k.encode()); h.update(np.array(b['cells'][k]['img'].convert('RGBA')).tobytes()); h.update(b['cells'][k]['pc'].encode())
    for kit in b['kits']: h.update(json.dumps([kit['id'], kit['grid'], kit['base'], kit['parts'], kit['ai']], ensure_ascii=False, sort_keys=True).encode())
    return h.hexdigest()

def selftest(verbose=True, render=True):
    """(a) 칸 16×16 RGBA·알파 0/255·modern3·마커색 0 (b) 오토타일 칸이 원본 오토타일의 같은 마스크 칸과 화소 일치 + 지역 칸이 빠짐없이 채워짐 + 반복 키트의 이음 비트
       (c) 선로↔도로 건널목 경계: 바닥판 레일이 선로 오토타일 레일과 같은 화소 (d) 같은 입력 build() 두 번 해시 동일 (e) 키트 자료 검사. 반환: 문제 수."""
    out = []
    def bad(m): out.append(m)
    b = build(); reg, cells, kits, groups, index = _finalize()
    # (a)
    n_px = 0
    for k, c in b['cells'].items():
        for m in check_cell(c['img']): bad('(a) %s: %s' % (k, m))
        if c['pc'] not in ('floor', 'solidfloor', 'flat', 'solid', 'star', 'blank'): bad('(a) %s pc %s' % (k, c['pc']))
        arr = np.array(c['img']); 
        if not arr[..., 3].any(): bad('(a) %s 완전 투명 칸' % k)
        if c['pc'] in ('floor', 'solidfloor') and not (arr[..., 3] == 255).all(): bad('(a) %s 아래층(불투명) 칸인데 투명 화소가 있다' % k)
        if c['pc'] == 'flat' and (arr[..., 3] == 255).all(): bad('(a) %s 투명 덧그림(flat) 칸인데 완전 불투명' % k)
        n_px += 1
    # (b)
    nb = 0; kinds = collections.Counter()
    for kid, (base, up, prov) in index.items():
        for key, (kind, m) in prov.items():
            x, y = key[0], key[1]; lay = up if len(key) == 3 else base
            blk, aid, pre = AT[kind]; at = KL.autotile(blk, aid)
            ks = lay[y][x]
            if ks is None: bad('(b) %s (%d,%d) %s 지역 칸이 비었다' % (kid, x, y, kind)); continue
            srcs = [at['variantMap'][str(m)]]
            if kind == 'lane' and m == 255: srcs += ['lane.b1', 'lane.b2']
            if kind == 'sw' and m == 255: srcs += ['sidewalk.b1']
            ok = any(_same_px(b['cells'][ks]['img'], KL.src()[blk]['cells'][sl]['img']) for sl in srcs)
            if not ok: bad('(b) %s (%d,%d) %s 마스크 %d: 원본 오토타일 칸과 화소가 다르다' % (kid, x, y, kind, m))
            nb += 1; kinds[kind] += 1
    for kd in kit_defs():                                        # 반복 키트의 이음: 반복 방향 이웃 비트가 모든 칸에 켜져 있어야 이어 붙여도 이음새가 없다
        if kd['repeat'] != 'repeat': continue
        axbits = (E_ | W_) if kd['growth'] == 'x' else (N_ | S_)
        for key, (kind, m) in index[kd['id']][2].items():
            if m & axbits != axbits: bad('(b) %s (%s) 반복 방향 이음 비트 없음 mask=%d' % (kd['id'], key, m))
    # (c)
    deck_rows = (4, 5, 10, 11)
    for axis, rk, tr in (('h', 'jp-rail-track.m10', False), ('v', 'jp-rail-track.m5', True)):
        D = np.array(art.deck_h() if axis == 'h' else art.deck_v()); Rr = np.array(KL.src()['l']['cells'][rk]['img'])
        if axis == 'h':
            for y in deck_rows:
                for x in (0, 15):
                    if not (D[y, x] == Rr[y, x]).all(): bad('(c) 바닥판(h) 레일 화소 (%d,%d) 가 선로 오토타일과 다르다' % (x, y))
        else:
            for x in deck_rows:
                for y in (0, 15):
                    if not (D[y, x] == Rr[y, x]).all(): bad('(c) 바닥판(v) 레일 화소 (%d,%d) 가 선로 오토타일과 다르다' % (x, y))
    for kid in ('jp-fumikiri-v', 'jp-fumikiri-h'):                # 바닥판 양옆은 선로 오토타일 칸(레일이 이어지는 마스크)이어야 한다
        base, up, prov = index[kid]; ds = [(x, y) for y in range(len(base)) for x in range(len(base[0])) if base[y][x] and base[y][x].startswith('dk.')]
        if not ds: bad('(c) %s 바닥판 없음' % kid); continue
        for (x, y) in ds:
            dx, dy = (1, 0) if base[y][x] == 'dk.h' else (0, 1)
            for sg in (1, -1):
                nx, ny = x + dx * sg, y + dy * sg
                if 0 <= nx < len(base[0]) and 0 <= ny < len(base):
                    nk = base[ny][nx]
                    if nk is not None and not (nk.startswith('dk.') or nk.startswith('rl.')): bad('(c) %s 바닥판 이웃 칸 %s 가 선로가 아니다' % (kid, nk))
    # (d)
    reg2 = None
    _CACHE.clear(); h2 = _digest(build()); _CACHE.clear(); h3 = _digest(build())
    if h2 != h3: bad('(d) 같은 입력 build() 해시가 다르다')
    # (e)
    ids = set()
    for kit in kits:
        if not kit['id'].startswith('jp-'): bad('(e) id 접두 %s' % kit['id'])
        if kit['id'] in ids: bad('(e) id 중복 %s' % kit['id'])
        ids.add(kit['id'])
        up = kit['grid']; w = len(up[0]); h = len(up)
        if any(len(r) != w for r in up) or (kit['base'] and (len(kit['base']) != h or any(len(r) != w for r in kit['base']))): bad('(e) %s 격자 크기 불일치' % kit['id'])
        for lay in (up, kit['base'] or []):
            for r in lay:
                for k in r:
                    if k is not None and k not in b['cells']: bad('(e) %s 칸 키 %s 없음' % (kit['id'], k))
        for p in kit['parts']:
            if not (0 <= p['x'] and 0 <= p['y'] and p['x'] + p['w'] <= w and p['y'] + p['h'] <= h): bad('(e) %s 부위 범위 밖' % kit['id'])
        for a in kit['ai']['access']:
            if 0 <= a['x'] < w and 0 <= a['y'] < h: bad('(e) %s 접근 칸 (%d,%d) 이 키트 안' % (kit['id'], a['x'], a['y']))
        if all(k is None for r in up for k in r) and not kit['base']: bad('(e) %s 빈 키트' % kit['id'])
    for g in groups:
        for k in g['cells']:
            if k not in b['cells']: bad('(e) 그룹 %s 칸 %s 없음' % (g['id'], k))
    if render:
        render_all()
    if verbose:
        print('roads — 칸 %d (새로 그린 %d · 오토타일 복사 %d) · 키트 %d · 그룹 %d' % (len(b['cells']), sum(1 for c in b['cells'].values() if not c['desc'].startswith('[키트용')),
              sum(1 for c in b['cells'].values() if c['desc'].startswith('[키트용')), len(kits), len(groups)))
        print('  (b) 오토타일 대조 칸 %d (%s) · (d) 해시 %s · 문제 %d' % (nb, dict(kinds), h2[:12], len(out)))
        for m in out[:30]: print('   ', m)
    return len(out)

# ───────────── 렌더(눈 확인용) ─────────────
def _at_cell(blk, aid, loc): return KL.src()[blk]['cells'][loc]['img']

def _paint_auto(canvas, region, kind, W, H, ox=0, oy=0):
    """오토타일 엔진 규칙대로 region(set) 을 칠한다(마스크 → variantMap). 우리 키트 칸이 아니라 원본 오토타일 칸을 쓴다(키트와의 이음 확인용)."""
    blk, aid, pre = AT[kind]; at = KL.autotile(blk, aid)
    pred = lambda x, y: (x, y) in region
    for (x, y) in region:
        if not (0 <= x - ox < W and 0 <= y - oy < H): continue
        m = KL.mask8(pred, x, y) if at['neighborhood'] == 8 else KL.mask4(pred, x, y)
        canvas.alpha_composite(_at_cell(blk, aid, at['variantMap'][str(m)]), ((x - ox) * 16, (y - oy) * 16))

def _place(canvas, reg, base, up, x0, y0, layers=('b', 'u')):
    for lay, nm in ((base, 'b'), (up, 'u')):
        if nm not in layers: continue
        for y, row in enumerate(lay):
            for x, k in enumerate(row):
                if k is not None: canvas.alpha_composite(reg.cells[k]['img'], ((x0 + x) * 16, (y0 + y) * 16))

def _grid_img(W, H, bgname='st.sw'):
    bg = ref_cell(bgname); im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for y in range(H):
        for x in range(W): im.alpha_composite(bg, (x * 16, y * 16))
    return im

def scene_town(reg, outs):
    """① 생활도로 동네: 오토타일로 길게 뻗은 생활도로 + 십자·T 키트가 그 위에 이음새 없이 얹힌다."""
    W, H = 44, 30; im = _grid_img(W, H)
    road = {(x, 12 + dy) for x in range(0, 44) for dy in range(4)} | {(14 + dx, y) for y in range(0, 30) for dx in range(4)}
    road |= {(x, 24 + dy) for x in range(14, 44) for dy in range(4)} | {(34 + dx, y) for y in range(12, 28) for dx in range(4)}
    _paint_auto(im, road, 'lane', W, H)
    b, u, _ = outs['jp-road-lane-x']; _place(im, reg, b, u, 10, 8)              # 십자 12×12: 중심 (14..17, 12..15)
    b, u, _ = outs['jp-road-lane-t-n']; _place(im, reg, b, u, 30, 20)           # T 12×8(북쪽 가지): 본선 y24..27, 가지 x34..37 위로
    # 표지·정차선
    for kid, (x, y) in (('jp-road-sign-tomare', (13, 10)), ('jp-road-sign-mirror', (18, 10)), ('jp-road-sign-post', (8, 10)), ('jp-road-sign-coin', (26, 10))):
        b, u, _ = outs[kid]; _place(im, reg, b, u, x, y)
    b, u, _ = outs['jp-road-mark-bike-stop']; _place(im, reg, b, u, 20, 12); _place(im, reg, b, u, 21, 12)
    return im

def scene_trunk(reg, outs):
    """② 간선도로: 십자 교차로 + 직선 가로·세로 키트를 사방으로 이어 붙임(이음새 확인) + 코너에 육교·지하도 + 표지."""
    W, H = 80, 45; im = _grid_img(W, H); CX, CY = 25, 8
    b, u, _ = outs['jp-road-trunk-x']; _place(im, reg, b, u, CX, CY)
    bt, ut, _ = outs['jp-road-trunk-h']; bv, uv, _ = outs['jp-road-trunk-v']
    for i in range(0, 3): _place(im, reg, bt, ut, CX + 29 + i * 8, CY + 6)
    for i in range(0, 3): _place(im, reg, bt, ut, CX - (i + 1) * 8, CY + 6)
    for i in range(1, 2): _place(im, reg, bv, uv, CX + 6, CY - 8 * i)
    for i in range(0, 1): _place(im, reg, bv, uv, CX + 6, CY + 29 + 8 * i)
    b, u, _ = outs['jp-underpass-entrance']; _place(im, reg, b, u, 1, 1)
    b, u, _ = outs['jp-footbridge-stairs']; _place(im, reg, b, u, 8, 1)
    for kid, (x, y) in (('jp-road-sign-post', (62, 3)), ('jp-road-sign-tomare', (68, 3)), ('jp-road-sign-mirror', (73, 3)), ('jp-road-sign-coin', (77, 3))):
        b, u, _ = outs[kid]; _place(im, reg, b, u, x, y)
    return im

def scene_rail(reg, outs):
    """③ 철도 건널목: 선로·생활도로 오토타일이 건널목 키트 양쪽으로 끊김 없이 이어진다. 왼쪽 열림, 오른쪽 닫힘(세로 도로 × 가로 선로)."""
    W, H = 44, 24; im = _grid_img(W, H, 'st.pave_a')
    road = {(10 + dx, y) for y in range(0, 24) for dx in range(4)} | {(32 + dx, y) for y in range(0, 24) for dx in range(4)}
    rail = {(x, 9) for x in range(0, 44)}
    # 키트 밖 + 키트 안(아래에 깔았다가 키트가 덮는다): 오토타일 마스크는 전체 합집합으로 잰다. 선로 칸과 도로 칸이 겹치는 (바닥판 자리) 도로 쪽은 칠하지 않는다.
    _paint_auto(im, {c for c in road if c[1] != 9}, 'lane', W, H)
    _paint_auto(im, {c for c in rail if not (c[0] in (10, 11, 12, 13, 32, 33, 34, 35))}, 'rail', W, H)
    b, u, _ = outs['jp-fumikiri-v']; _place(im, reg, b, u, 8, 5)
    b, u, _ = outs['jp-fumikiri-v-closed']; _place(im, reg, b, u, 30, 5)
    return im

def scene_rail_h(reg, outs):
    W, H = 30, 24; im = _grid_img(W, H, 'st.pave_a')
    road = {(x, 8 + dy) for x in range(0, 30) if x != 14 for dy in range(4)}
    _paint_auto(im, road, 'lane', W, H)
    rail = {(14, y) for y in range(0, 24) if y not in (8, 9, 10, 11)}
    _paint_auto(im, rail, 'rail', W, H)
    b, u, _ = outs['jp-fumikiri-h']; _place(im, reg, b, u, 10, 6)
    return im

def _sheet(reg, outs, ids, scale, bgname, name, cols=3):
    ims = []
    for kid in ids:
        b, u = outs[kid][:2]; im = KL.compose(reg, b, u, ref_cell(bgname)) if bgname else KL.compose(reg, b, u, None)
        ims.append((kid, im))
    return ims

def render_all():
    os.makedirs(OUTDIR, exist_ok=True)
    reg, cells, kits, groups, index = _finalize(); outs = index
    sc = {'street-town-x4.png': scene_town(reg, outs), 'street-trunk-x4.png': scene_trunk(reg, outs), 'street-rail-x4.png': scene_rail(reg, outs), 'street-rail-h-x4.png': scene_rail_h(reg, outs)}
    for n, im in sc.items(): im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(OUTDIR, n))
    # 키트별 ×8 조각표(바탕은 보도 칸이 아니라 키트 밖이 보이게 어두운 단색 + 격자)
    from PIL import ImageDraw
    groups_ = [('lane', [k['id'] for k in kits if k['id'].startswith('jp-road-lane')]), ('trunk', ['jp-road-trunk-h', 'jp-road-trunk-v']), ('trunk-x', ['jp-road-trunk-x']),
               ('fumikiri', [k['id'] for k in kits if k['id'].startswith('jp-fumikiri')]), ('stairs', ['jp-underpass-entrance', 'jp-footbridge-stairs']),
               ('signs', [k['id'] for k in kits if k['id'].startswith(('jp-road-sign', 'jp-road-mark'))])]
    for gname, ids in groups_:
        tiles = []
        for kid in ids:
            b, u = outs[kid][:2]; im = KL.compose(reg, b, u, None)
            canvas = Image.new('RGBA', im.size, (74, 112, 74, 255))                 # 빈 칸(키트가 비운 곳)은 녹색으로 보인다
            for y in range(0, im.height, 16):
                for x in range(0, im.width, 16):
                    if (x // 16 + y // 16) % 2: canvas.alpha_composite(Image.new('RGBA', (16, 16), (66, 102, 66, 255)), (x, y))
            S = 8 if max(im.size) <= 160 else 4 if max(im.size) <= 288 else 2                  # 큰 키트는 줄여서(×4/×2) 한 장에 담는다
            canvas.alpha_composite(im); tiles.append(('%s ×%d' % (kid, S), canvas.resize((im.width * S, im.height * S), Image.NEAREST)))
        W = 2600; xs = 0; ys = 0; rowh = 0; pos = []
        for kid, t in tiles:
            if xs + t.width > W: xs = 0; ys += rowh + 24; rowh = 0
            pos.append((kid, t, xs, ys)); xs += t.width + 16; rowh = max(rowh, t.height)
        out = Image.new('RGBA', (W, ys + rowh + 24), (30, 28, 36, 255)); d = ImageDraw.Draw(out)
        for kid, t, x, y in pos: out.alpha_composite(t, (x, y + 12)); d.text((x, y), kid, fill=(255, 255, 255, 255))
        out.save(os.path.join(OUTDIR, 'kits-%s.png' % gname))
    # 칸 표(새로 그린 칸 ×8)
    new = [(k, c) for k, c in cells.items() if not c['desc'].startswith('[키트용')]
    cols = 12; S = 8
    out = Image.new('RGBA', (cols * (16 * S + 8), ((len(new) + cols - 1) // cols) * (16 * S + 22)), (30, 28, 36, 255)); d = ImageDraw.Draw(out)
    for i, (k, c) in enumerate(new):
        x = (i % cols) * (16 * S + 8); y = (i // cols) * (16 * S + 22)
        t = Image.new('RGBA', (16, 16), (90, 90, 100, 255)); t.alpha_composite(c['img']); out.alpha_composite(t.resize((16 * S, 16 * S), Image.NEAREST), (x, y + 12)); d.text((x, y), '%s %s' % (k, c['pc']), fill=(255, 255, 255, 255))
    out.save(os.path.join(OUTDIR, 'new-cells-x8.png'))

if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
