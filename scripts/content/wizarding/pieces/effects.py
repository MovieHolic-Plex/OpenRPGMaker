"""effects 모듈 — 애니메이션 효과 조각(wz-fx-*). 전부 투명 배경 위층(C) 또는 투명 바닥 덧그림(f).
  python3 scripts/content/wizarding/pieces/effects.py   → 검사 + tiledata/wizarding/review/effects*.png
밝은 픽셀(불빛 #FFE0A0·#E99D52, 마법 #82C8B3·#C9B2DA·#F2F2E8)은 코어에만 좁게 쓴다.
"""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'effects'


def hs(x, y, s=0):
    """결정적 해시 잡음 0..1."""
    h = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791) ^ 0x5bd1e995
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def fx(id, name, space, w, h, frames, fps, desc, walk=None, rules='', tags=(), **kw):
    walk = walk or ['C' * w] * h
    return REG.piece(id, name, w, h, walk, 'effects', space, desc, rules=rules, tags=list(tags), frames=frames, fps=fps, **kw)


def art(c, x, y, rows, leg):
    """글자 그림: rows 의 글자를 leg 색으로 (x,y) 에서 찍는다('.' 은 건너뜀)."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in leg: c.P(x + i, y + j, leg[ch])


def flame(c, cx, by, h, w, lean=0.0, rim=0.72, tipcol=None, ems=None):
    """불꽃 혀: 밑 by(맨 아랫줄)에서 위로 h 줄, 밑폭 w. cx 는 반 픽셀 좌표(8.5 = 픽셀 8 의 가운데).
    바깥 주황, 속 노랑, 밑 중심에 흰 불씨 — 노랑·흰은 좁게."""
    f1, f2, f3, f4 = K('fire', 1), K('fire', 2), K('fire', 3), K('fire', 4)
    for k in range(h):
        t = k / max(h - 1, 1)
        half = max((w / 2.0) * (1 - t ** 1.5), 0.55)
        ctr = cx + lean * t * t
        y = by - k
        x0, x1 = int(math.floor(ctr - half)), int(math.ceil(ctr + half))
        for x in range(x0, x1 + 1):
            d = abs(x + 0.5 - ctr)
            if d > half + 0.01: continue
            d /= half
            if k == h - 1: col = tipcol or (f1 if h >= 8 else f2)
            elif d > rim: col = f1 if h >= 8 else f2
            elif d > 0.45 or t > 0.6: col = f2
            elif t > 0.18 or d > 0.18: col = f3
            else: col = f4 if k <= 1 else f3
            c.P(x, y, col)


def puff(c, cx, cy, r, cols, seed=0, flat=1.0):
    """덩이 연기·먼지: 겹친 원 몇 개, 왼쪽 위가 밝은 단(cols = 어두움→밝음 3단)."""
    blobs = [(0, 0, r), (-r * 0.55, r * 0.2, r * 0.7), (r * 0.6, r * 0.25, r * 0.65), (r * 0.05, -r * 0.5, r * 0.6)]
    for i, (ox, oy, rr) in enumerate(blobs):
        if rr < 0.7: continue
        for y in range(int(cy + oy - rr - 1), int(cy + oy + rr + 2)):
            for x in range(int(cx + ox - rr - 1), int(cx + ox + rr + 2)):
                d = ((x + 0.5 - cx - ox) / rr) ** 2 + ((y + 0.5 - cy - oy) / (rr * flat)) ** 2
                if d <= 1.0:
                    lit = ((x + 0.5 - cx - ox) + (y + 0.5 - cy - oy)) / rr  # 음수 = 왼쪽 위
                    c.P(x, y, cols[0] if lit > 0.55 else (cols[1] if lit > -0.35 else cols[2]))


def sparkle(c, x, y, s, m='glow', hot=True):
    """네 갈래 반짝임. s=0 점, 1 작은 십자, 2 큰 십자, 3 큰 십자+대각."""
    a, b, e = K(m, 3), K(m, 2), K(m, 4)
    if s <= 0: c.P(x, y, a); return
    c.P(x, y, e if hot else a)
    arm = {1: 1, 2: 2, 3: 2}[s]
    for k in range(1, arm + 1):
        col = a if k == 1 else b
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)): c.P(x + dx, y + dy, col)
    if s == 3:
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)): c.P(x + dx, y + dy, b)


def shear_rows(c, fn, tilt, mid=8, span=5.0):
    """fn(tmp) 로 그린 16×16 을 위쪽은 tilt 만큼 옆으로 밀어 기울여 c 에 얹는다."""
    t = Cv(c.w, c.h); fn(t)
    for y in range(c.h):
        s = int(round(tilt * (mid - y) / span))
        for x in range(c.w):
            v = t.a[y, x]
            if v[3]: c.P(x + s, y, tuple(int(q) for q in v))


# ═══════════════════════════ 공용 ═══════════════════════════
@fx('wz-fx-candle-flame', '촛불 불꽃(4프레임)', 'shared', 1, 1, 4, 6,
    '황동 촛대 wz-furn-candlestick 위에 겹치는 촛불 불꽃만. 불꽃 아랫점(심지)이 칸 y=5. 4프레임이 키·기울기·폭이 달라 일렁인다.',
    rules='촛대 칸 바로 위 칸(촛대 심지가 칸 아래쪽)에 겹친다. 위층.', tags=['촛불', '불꽃', '일렁임'])
def _candle(c, f):
    h, lean, w = ((6, 0.0, 3), (5, 1.2, 3), (6, -1.2, 3), (4, 0.6, 4))[f]
    c.P(8, 5, K('wood', 1))                                      # 심지
    flame(c, 8.5, 4, h, w, lean, rim=0.99)
    if f == 1: c.P(10, 0, K('fire', 2))                          # 튀는 불똥
    if f == 3: c.P(7, 0, K('fire', 1))


@fx('wz-fx-fireplace', '벽난로 불(6프레임)', 'shared', 3, 2, 6, 7,
    '벽난로 아궁이에 겹치는 불. 큰 혀 5개가 프레임마다 높이·기울기가 달라지고 밑에는 숯불 알갱이, 위로 불똥이 튄다.',
    rules='3×2 벽난로(wz-furn-fireplace) 아궁이 위에 겹친다. 불의 밑줄은 아래 칸 y=30.', tags=['벽난로', '불', '장작'])
def _fire(c, f):
    # 숯불 바닥
    for x in range(6, 42):
        n = hs(x, f, 3)
        c.P(x, 31, K('fire', 0)); c.P(x, 30, K('fire', 1) if n < 0.7 else K('fire', 2))
        if 10 < x < 38 and n > 0.55: c.P(x, 29, K('fire', 1) if n < 0.85 else K('fire', 2))
    spec = [(10.5, 12, 9, 2.0), (38.5, 13, 9, -1.8), (17.5, 17, 11, 1.2), (31.5, 16, 11, -1.4), (24.5, 22, 13, 0.0)]
    for i, (cx, hh, ww, lean) in enumerate(spec):
        k = (f + i * 2) % 6
        flame(c, cx, 29, int(hh + (0, 3, 5, 2, -1, 1)[k]), ww + (0, 1, 0, -1, 0, 1)[k] % 2, lean * (1, 0.2, -1, -0.4, 0.9, -0.8)[k], rim=0.75)
    # 밑동 속 밝은 심
    for x in range(18, 31): c.P(x, 28, K('fire', 3) if hs(x, f, 8) > 0.35 else K('fire', 2))
    for x in range(21, 28): c.P(x, 27, K('fire', 3))
    # 불똥
    for j in range(3):
        sx = 12 + int(hs(f, j, 1) * 24); sy = 3 + int(hs(f, j, 2) * 10)
        c.P(sx, sy, K('fire', 3) if j == 0 else K('fire', 2))


@fx('wz-fx-dust-motes', '떠다니는 먼지(4프레임)', 'shared', 1, 1, 4, 3,
    '빛줄기 속에 천천히 떠다니는 먼지 알갱이. 알갱이가 커졌다 작아지고 한두 개는 사라졌다 나타난다.',
    rules='창가·서가 앞 위층에 깐다. 잡음처럼 보이지 않게 칸당 3~4알.', tags=['먼지', '빛줄기'])
def _dust(c, f):
    motes = [(3, 4, 0.5, 0.7), (11, 3, -0.4, 0.8), (7, 10, 0.6, -0.5), (13, 12, -0.5, -0.7), (5, 14, 0.4, -0.6)]
    for i, (x0, y0, dx, dy) in enumerate(motes):
        x = int(round(x0 + dx * f * 1.5 + math.sin((f + i) * 1.6))); y = int(round(y0 + dy * f * 1.5))
        x %= 16; y %= 16
        ph = (f + i) % 4
        if ph == 0: c.P(x, y, K('snow', 3))
        elif ph == 1: c.P(x, y, K('linen', 3)); c.P(x + 1, y, K('linen', 2))
        elif ph == 2: c.P(x, y, K('linen', 2))
        elif i % 2 == 0: c.P(x, y, K('linen', 1))                # 흐려져 거의 사라짐


@fx('wz-fx-wand-glow', '지팡이 끝 빛(4프레임)', 'shared', 1, 1, 4, 8,
    '지팡이 끝에서 켜지는 작은 빛. 점 → 작은 십자 → 큰 십자+대각 → 둥근 잔광 으로 모양이 바뀐다.',
    rules='지팡이를 든 사람의 손 끝 칸에 겹친다. 중심(8,8).', tags=['지팡이', '룸모스', '빛'])
def _wandglow(c, f):
    if f == 0: sparkle(c, 8, 8, 0, hot=False); c.P(8, 8, K('glow', 4))
    elif f == 1: sparkle(c, 8, 8, 1)
    elif f == 2: sparkle(c, 8, 8, 3)
    else:
        c.P(8, 8, K('glow', 4))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): c.P(8 + dx, 8 + dy, K('glow', 3))
        for dx, dy in ((2, 1), (-2, -1), (1, -2), (-1, 2), (2, -1), (-2, 1)): c.P(8 + dx, 8 + dy, K('glow', 2))


# ═══════════════════════════ 부엉이 탑 · 우체국 ═══════════════════════════
@fx('wz-fx-owl-feather', '부엉이 착지 깃털(4프레임)', 'owlery', 1, 1, 4, 5,
    '부엉이가 내려앉을 때 흩날려 떨어지는 깃털 한 장. 비스듬히 → 반대로 기울어 → 눕혀져 → 바닥에 누워 앉는다.',
    rules='부엉이 횃대·바닥 칸 위에 겹친다.', tags=['부엉이', '깃털', '착지'])
def _feather(c, f):
    leg = {'s': K('linen', 1), 'b': K('linen', 3), 'h': K('linen', 4), 'w': K('wood', 4), 'd': K('linen', 2)}
    if f == 0:
        art(c, 6, 1, ['..h..', '.hbh.', '.hbb.', 'hbsb.', '.bsd.', '.bsd.', '..s..', '..s..'], leg)
        c.P(3, 10, K('linen', 4)); c.P(12, 7, K('linen', 3))
    elif f == 1:
        art(c, 5, 4, ['...hh', '..hbh', '.hbbs', 'hbbs.', '.dbs.', 'dss..', 's....'], leg)
    elif f == 2:
        art(c, 4, 8, ['.hhh....', 'hbbbsbh.', '.dbbbbss', '..dddsw.'], leg)
    else:
        art(c, 4, 12, ['.hbbbh.', 'sbbbbbs', '.ddddd.'], leg); c.P(11, 11, K('linen', 3)); c.P(2, 13, K('linen', 2))


@fx('wz-fx-seal-afterglow', '우편 봉인 잔광(4프레임)', 'postoffice', 1, 1, 4, 5,
    '밀랍 봉인을 찍은 뒤 가라앉는 붉은 잔광. 봉인 원판이 한 번 반짝이고 둘레 불티가 돌며 사그라든다.',
    rules='우편물·봉인 칸 위에 겹친다. 중심(8,8).', tags=['우체국', '봉인', '밀랍'])
def _sealglow(c, f):
    c.ellipse(8, 8, 3, 3, K('red', 2)); c.ellipse(8, 8, 2, 2, K('red', 3)); c.P(7, 7, K('red', 4) if f < 2 else K('fire', 2))
    if f == 0:
        for dx, dy in ((0, -5), (0, 5), (5, 0), (-5, 0)): c.P(8 + dx, 8 + dy, K('fire', 3))
        for dx, dy in ((3, -3), (-3, 3), (3, 3), (-3, -3)): c.P(8 + dx, 8 + dy, K('fire', 2))
    elif f == 1:
        for dx, dy in ((4, -3), (-4, 3), (3, 4), (-3, -4)): c.P(8 + dx, 8 + dy, K('fire', 2))
        for dx, dy in ((0, -5), (5, 0)): c.P(8 + dx, 8 + dy, K('fire', 1))
    elif f == 2:
        for dx, dy in ((5, -1), (-5, 1), (2, 5)): c.P(8 + dx, 8 + dy, K('fire', 1))
    else:
        c.P(8, 3, K('red', 1)); c.P(12, 9, K('red', 1))


# ═══════════════════════════ 마법약 교실 ═══════════════════════════
def _cauldron(c, f, m):
    vio = (m == 'violet')
    rim, hi = K(m, 3), K(m, 4)
    ce, fl, ed = (K(m, 4), K(m, 3), K(m, 2)) if vio else (K(m, 3), K(m, 2), K(m, 1))
    # 증기: 2px 폭의 S자 띠가 한 프레임에 1px 씩 위로 흐른다(세로 파장 6 = 6프레임에 한 바퀴)
    for y in range(9, -1, -1):
        t = (9 - y) / 9.0
        cx = 8 + int(round((1.2 + 1.8 * t) * math.sin(2 * math.pi * (y + f) / 6.0)))
        bright = (y + f) % 6 < 3
        for x, col in ((cx, ce if bright else fl), (cx + 1, fl)):
            if y <= 1 and (x + y) % 2: continue
            c.P(x, y, col)
        if t > 0.35 and (y + f) % 6 in (1, 2): c.P(cx - 1, y, ed)
        if t > 0.35 and (y + f) % 6 in (4, 5): c.P(cx + 2, y, ed)
    # 고리 기포 3개(위상 0·2·4): 2px 로 떠올라 3px 고리로 커지고 터진다
    for bx, ph0 in ((2, 0), (7, 2), (12, 4)):
        ph = (f + ph0) % 6
        if ph in (0, 1):
            y = 13 - ph
            c.P(bx, y, hi); c.P(bx + 1, y, rim); c.P(bx, y + 1, rim); c.P(bx + 1, y + 1, rim)
        elif ph in (2, 3, 4):
            y = (10, 9, 8)[ph - 2]
            for dx, dy in ((0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2)):
                c.P(bx + dx, y + dy, rim)
            c.P(bx, y, hi)
        else:
            c.P(bx - 1, 9, rim); c.P(bx + 3, 9, rim); c.P(bx + 1, 6, hi); c.P(bx - 1, 11, rim); c.P(bx + 3, 11, rim)


@fx('wz-fx-cauldron-violet', '가마솥 보랏빛 기포·증기(6프레임)', 'potions', 1, 1, 6, 6,
    '가마솥 위에 겹치는 보랏빛 약의 기포와 증기. 기포가 커지며 올라 터지고 증기가 꼬불거린다.',
    rules='솥 칸 바로 위에 겹친다. 기포는 칸 아래쪽(y 14)에서 시작.', tags=['가마솥', '기포', '증기'])
def _cv(c, f): _cauldron(c, f, 'violet')


@fx('wz-fx-cauldron-green', '가마솥 녹색 기포·증기(6프레임)', 'potions', 1, 1, 6, 6,
    '가마솥 위에 겹치는 녹색 약의 기포와 증기. 보랏빛 쌍둥이와 같은 모양, 색만 다르다.',
    rules='솥 칸 바로 위에 겹친다.', tags=['가마솥', '기포', '증기', '녹색'])
def _cg(c, f): _cauldron(c, f, 'glow')


@fx('wz-fx-potion-reaction', '시약 반응(6프레임)', 'potions', 1, 1, 6, 6,
    '시약이 섞여 번쩍이고 연기로 가라앉는다. 불꽃 별 → 터짐 → 둥근 연기 → 퍼지는 연기.',
    rules='시약병·솥 칸 위에 겹친다. 중심(8,9).', tags=['시약', '반응', '번쩍임'])
def _react(c, f):
    if f == 0:
        sparkle(c, 8, 9, 1)
    elif f == 1:
        sparkle(c, 8, 9, 3)
        for dx, dy in ((4, -3), (-4, 3), (3, 4), (-4, -3)): c.P(8 + dx, 9 + dy, K('glow', 3))
    elif f == 2:
        c.ellipse(8, 9, 3, 3, K('glow', 2)); c.ellipse(8, 9, 2, 2, K('glow', 3)); c.P(8, 9, K('glow', 4)); c.P(7, 8, K('glow', 4))
        for dx, dy in ((6, 0), (-6, 1), (1, -6), (2, 6)): c.P(8 + dx, 9 + dy, K('glow', 2))
    else:
        _smoke(c, f)


def _smoke(c, f):
    """윤곽 없는 밝은 회색 2단 연기 덩이 여러 개가 위로 퍼지며 가장자리부터 체커 디더로 흩어진다."""
    lt, md = K('snow', 2), K('iron', 4)
    blobs = {3: ((8, 8, 3.0), (5, 6, 1.8), (11, 6, 1.8)),
             4: ((8, 6, 3.2), (4, 4, 2.2), (12, 3, 2.4), (8, 2, 1.8)),
             5: ((6, 3, 2.4), (11, 2, 2.2), (8, 5, 1.8))}[f]
    for bi, (cx, cy, r) in enumerate(blobs):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if not (0 <= x < 16 and 0 <= y < 16): continue
                d = math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.85))
                if d > 1.05: continue
                lit = ((x + 0.5 - cx) + (y + 0.5 - cy)) / r
                solid = 0.55 if f < 5 else 0.0
                if d <= solid:
                    c.P(x, y, lt if lit < 0.35 else md)
                elif (x + y) % 2 == 0 and hs(x, y, bi + f) > (0.1 if f < 5 else 0.4):
                    c.P(x, y, md if lit > 0.0 else lt)


# ═══════════════════════════ 시계탑 ═══════════════════════════
@fx('wz-fx-gear-oil-glint', '기어 윤활 반짝임(4프레임)', 'clocktower', 1, 1, 4, 5,
    '기름 먹은 황동 기어에서 반짝이는 두 점과 떨어지는 기름방울.',
    rules='기어·톱니 칸 위에 겹친다. 반짝임은 황동색.', tags=['기어', '기름', '반짝임'])
def _gear(c, f):
    def star(x, y, s):
        if s <= 0: return
        c.P(x, y, K('brass', 5))
        if s >= 2:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): c.P(x + dx, y + dy, K('brass', 4))
        if s >= 3:
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)): c.P(x + dx, y + dy, K('brass', 3))
    sa = (3, 2, 0, 1)[f]; sb = (1, 2, 3, 2)[f]
    star(4, 5, sa); star(11, 9, sb)
    if f >= 2:
        y = 2 + (f - 2) * 5
        c.P(8, y, K('brass', 4)); c.P(8, y + 1, K('brass', 3))
        if f == 3: c.P(8, y + 2, K('brass', 2))


# ═══════════════════════════ 눈 ═══════════════════════════
@fx('wz-fx-snow-fine', '가는 눈발(4프레임·반복)', 'postoffice', 1, 1, 4, 5,
    '가늘게 내리는 눈. 한 칸에 눈송이 6개가 4프레임에 4px씩 내려가 칸 위아래가 이어지고, 크기가 점→작은 십자 로 바뀐다.',
    rules='눈 내리는 야외 칸 위에 반복해 깐다. 위아래가 이어진다.', tags=['눈', '눈발', '내림'], repeat=True)
def _snow(c, f):
    flakes = [(2, 1, 0), (7, 4, 1), (12, 0, 2), (4, 9, 3), (10, 11, 0), (14, 7, 1)]
    for x0, y0, k in flakes:
        y = (y0 + 4 * f) % 16
        x = x0 + (1 if (f + k) % 4 in (1, 2) else 0)
        big = (f + k) % 4 == 2
        c.P(x, y, K('snow', 3))
        if big:
            c.P(x - 1, y, K('snow', 1)); c.P(x + 1, y, K('snow', 1)); c.P(x, (y + 1) % 16, K('snow', 2))
        elif (f + k) % 4 == 0: c.P(x, (y + 1) % 16, K('snow', 1))


@fx('wz-fx-snow-shake', '눈 털기(4프레임)', 'postoffice', 1, 1, 4, 5,
    '지붕·외투에서 눈덩이가 떨어져 부서지고 가루가 쌓인다. 덩이 → 쪼개짐 → 흩날림 → 소복이 쌓임.',
    rules='처마·사람 머리 위·바닥 칸에 겹친다.', tags=['눈', '털기', '쌓임'])
def _shake(c, f):
    s3, s2, s1 = K('snow', 3), K('snow', 2), K('snow', 1)
    if f == 0:
        art(c, 5, 1, ['.sss.', 'sS3Ss', 'ssss.'.replace('.', 's')], {'s': s2, 'S': s3, '3': s3}); c.R(5, 4, 5, 1, s1)
        c.P(4, 5, s2); c.P(10, 5, s1)
    elif f == 1:
        art(c, 3, 4, ['.ss', 'ssS', 's.'], {'s': s2, 'S': s3}); art(c, 8, 5, ['ss.', 'sSs', '.s.'], {'s': s2, 'S': s3})
        c.P(6, 2, s3); c.P(12, 3, s2); c.P(7, 8, s1)
    elif f == 2:
        for (x, y, v) in ((2, 8, 1), (5, 10, 2), (8, 8, 3), (11, 10, 2), (13, 7, 1), (4, 6, 1), (9, 12, 1)): c.P(x, y, K('snow', v))
        c.P(6, 12, s2); c.P(7, 12, s1)
    else:
        art(c, 3, 12, ['..sSs..', '.sSSSs.', 'sssssss'], {'s': s2, 'S': s3}); c.R(3, 15, 7, 1, s1)
        c.P(5, 8, s3); c.P(10, 10, s2)


# ═══════════════════════════ 지팡이 가게 ═══════════════════════════
@fx('wz-fx-wand-test', '지팡이 시험(8프레임)', 'wandshop', 2, 1, 8, 8,
    '지팡이를 시험하는 순간. 지팡이 끝(x 2,y 8)에서 빛줄기가 뻗고 → 과녁에서 불꽃이 터지고 → 불티가 떨어지며 가라앉는다.',
    rules='2×1. 왼쪽 칸 왼쪽에 지팡이 끝, 오른쪽 칸 중간(x 24)에 과녁.', tags=['지팡이', '시험', '빛줄기', '불꽃'])
def _wandtest(c, f):
    g2, g3, g4 = K('glow', 2), K('glow', 3), K('glow', 4)
    L = (7, 14, 21, 21, 0, 0, 0, 0)[f]
    if L:
        for x in range(2, 2 + L):
            y = 8 + (1 if (x + f) % 5 == 0 else 0) - (1 if (x + f) % 7 == 0 else 0)
            c.P(x, y, g3 if (x + f) % 2 else g4)
            if (x + f) % 3 == 0: c.P(x, y - 1, g2)
            if (x + f) % 4 == 0: c.P(x, y + 1, g2)
        c.P(2, 8, g4); c.P(1, 8, g3)
    cx, cy = 24, 8
    if f == 1: c.P(cx, cy, g3)
    elif f == 2:
        sparkle(c, cx, cy, 2, 'glow'); c.P(cx + 1, cy + 1, K('fire', 3)); c.P(cx - 1, cy - 1, K('fire', 2))
    elif f == 3:
        flame(c, cx + 0.5, cy + 4, 8, 6, 0.8, rim=0.6)
        for dx, dy in ((6, -3), (-5, -4), (4, -6), (-3, 2)): c.P(cx + dx, cy + dy, K('fire', 3))
    elif f == 4:
        flame(c, cx + 0.5, cy + 5, 7, 5, -0.6, rim=0.6)
        for dx, dy in ((7, 1), (-6, 0), (5, -4), (-4, -5), (2, -7)): c.P(cx + dx, cy + dy, K('fire', 2))
    elif f == 5:
        flame(c, cx + 0.5, cy + 6, 4, 4, 0.5, rim=0.6)
        for dx, dy in ((6, 4), (-5, 3), (3, 1)): c.P(cx + dx, cy + dy, K('fire', 1))
        for dx, dy in ((0, -3), (1, -4), (-1, -5)): c.P(cx + dx, cy + dy, K('iron', 3))
    elif f == 6:
        for dx, dy in ((0, 6), (1, 6), (-1, 5)): c.P(cx + dx, cy + dy, K('fire', 1))
        c.P(cx, cy + 5, K('fire', 2))
        for dx, dy in ((1, -2), (0, -3), (-1, -4), (1, -5)): c.P(cx + dx, cy + dy, K('iron', 4) if dy % 2 else K('night', 3))
    elif f == 7:
        c.P(cx, cy + 6, K('fire', 0)); c.P(cx + 1, cy + 6, K('fire', 1))
        c.P(cx - 1, cy - 1, K('night', 3)); c.P(cx, cy - 3, K('iron', 4))


# ═══════════════════════════ 도서관 ═══════════════════════════
@fx('wz-fx-book-tremble', '잠금 책 진동(6프레임)', 'library', 1, 1, 6, 10,
    '금박 자물쇠가 달린 붉은 책이 덜덜 떤다. 책이 좌우·위로 흔들리고 윗부분이 기울며 옆에 흔들림 선과 보랏빛 불똥이 튄다.',
    rules='책상·서가 위에 놓인 책 자리에 그대로 겹쳐 쓴다(이 조각이 책 자체다).', tags=['금서', '책', '떨림'])
def _booktremble(c, f):
    dx, dy, tilt = ((0, 0, 0), (-1, 0, 2), (1, -1, -2), (-1, 0, -1), (1, 0, 2), (0, -1, 0))[f]

    def book(t):
        t.R(3, 12, 10, 1, K('red', 1))                               # 표지 아랫단
        t.R(3, 10, 10, 2, K('linen', 3)); t.HL(3, 11, 10, K('linen', 2))   # 책배(쪽)
        t.R(3, 3, 10, 7, K('red', 2)); t.HL(3, 3, 10, K('red', 3)); t.VL(3, 3, 7, K('red', 1)); t.VL(4, 4, 6, K('red', 1))
        t.HL(5, 4, 7, K('brass', 3)); t.HL(5, 9, 7, K('brass', 2)); t.VL(11, 5, 4, K('brass', 3))
        t.R(7, 5, 3, 3, K('brass', 4)); t.P(7, 5, K('brass', 5)); t.P(8, 6, K('ink', 0))          # 자물쇠
        t.HL(3, 3, 1, K('brass', 4)); t.HL(12, 3, 1, K('brass', 4))
    shear_rows(c, book, tilt)
    if dx or dy:
        t = Cv(16, 16); t.a[:] = c.a; c.a[:] = 0
        for y in range(16):
            for x in range(16):
                if t.a[y, x, 3]: c.P(x + dx, y + dy, tuple(int(q) for q in t.a[y, x]))
    if f in (1, 4):
        c.P(1, 6, K('night', 3)); c.P(0, 8, K('night', 3)); c.P(14, 7, K('night', 3)); c.P(15, 9, K('night', 3))
    if f in (2, 3):
        c.VL(0, 5, 3, K('night', 3)); c.VL(15, 8, 3, K('night', 3))
    if f in (0, 2, 5): c.P(8 + (f - 2), 1, K('violet', 4)); c.P(9, 2 if f == 2 else 0, K('violet', 3))


@fx('wz-fx-page-wind', '페이지 바람(6프레임)', 'library', 1, 1, 6, 8,
    '펼친 책 위로 바람이 불어 쪽이 넘어간다. 쪽이 살짝 들림 → 반쯤 세워짐 → 세워짐 → 넘어감 → 내려앉음 → 가장자리 파르르.',
    rules='열린 책 자리에 그대로 겹쳐 쓴다(이 조각이 책 자체다).', tags=['책', '바람', '쪽'])
def _pagewind(c, f):
    c.R(1, 13, 14, 2, K('wood', 2)); c.HL(1, 13, 14, K('wood', 3))                      # 책 표지
    c.R(2, 8, 6, 5, K('linen', 4)); c.R(8, 8, 6, 5, K('linen', 3)); c.VL(8, 8, 5, K('linen', 1))
    for y in (9, 11): c.HL(3, y, 4, K('linen', 2))
    ang = (12, 40, 85, 120, 168, 172)[f]
    th = math.radians(ang)
    xo = 8 + 5.5 * math.cos(th); ly = 5.2 * math.sin(th)
    if f >= 4:
        # 넘어가 왼쪽 쪽 위에 얹힌 쪽
        c.R(2, 8, 6, 5, K('linen', 3)); c.VL(7, 8, 5, K('linen', 1))
        for y in (9, 11): c.HL(3, y, 3, K('linen', 2))
        c.R(8, 8, 6, 5, K('linen', 4))
        for y in (9, 11): c.HL(9, y, 4, K('linen', 2))
        if f == 5: c.P(2, 7, K('linen', 3)); c.P(3, 7, K('linen', 4)); c.P(2, 6, K('linen', 4))
    else:
        up = K('linen', 4) if ang < 90 else K('linen', 3)
        pts = [(8, 8), (8, 13), (xo, 13 - ly), (xo, 8 - ly)] if ang >= 40 else [(8, 8), (8, 13), (13.5, 13 - ly), (13.5, 8 - ly * 1.1)]
        c.poly(pts, up)
        c.line(int(8), 8, int(round(xo)), int(round(8 - ly)), K('linen', 2))
    for (x, y) in ((0, 4 + (f % 2)), (1, 6), (3, 3)): c.P(x, y, K('snow', 1))
    c.HL(0, 5, 2 + f % 2, K('snow', 1))
    if f in (2, 3): c.P(14, 3, K('linen', 3)); c.P(15, 2, K('linen', 4))


@fx('wz-fx-chain-tension', '쇠사슬 긴장(6프레임)', 'library', 1, 1, 6, 8,
    '칸을 가로지르는 쇠사슬. 늘어졌다가 팽팽해지며 반짝이고 다시 처진다. 고리가 번갈아 옆·정면으로 보인다.',
    rules='금서 서랍·철문 앞 가로 칸. 양옆 칸으로 이어 쓰려면 같은 조각을 나란히.', tags=['쇠사슬', '긴장'])
def _chain(c, f):
    sag = (5, 4, 2, 0, 2, 4)[f]
    flip = 1 if f >= 3 else 0          # 팽팽해지면 가로·세로 고리가 서로 뒤바뀐다
    for i, x0 in enumerate((0, 3, 6, 9, 12, 15)):
        y = int(round(6 + sag * math.sin(math.pi * (x0 + 1.5) / 16.0)))
        if (i + flip) % 2 == 0:        # 가로 타원 고리 3x2: 윗줄 밝게(1px 반사)
            if x0 <= 13:
                c.P(x0, y, K('snow', 2)); c.P(x0 + 1, y, K('iron', 4)); c.P(x0 + 2, y, K('iron', 4))
                c.P(x0, y + 1, K('iron', 3)); c.P(x0 + 1, y + 1, K('iron', 3)); c.P(x0 + 2, y + 1, K('iron', 2))
            else:
                c.P(x0, y, K('snow', 2)); c.P(x0, y + 1, K('iron', 3))
        else:                          # 세로 타원 고리 2x3
            if x0 <= 14:
                c.P(x0, y - 1, K('iron', 4)); c.P(x0 + 1, y - 1, K('iron', 3))
                c.P(x0, y, K('snow', 2)); c.P(x0 + 1, y, K('iron', 3))
                c.P(x0, y + 1, K('iron', 3)); c.P(x0 + 1, y + 1, K('iron', 2))
            else:
                c.P(x0, y - 1, K('iron', 4)); c.P(x0, y, K('snow', 2)); c.P(x0, y + 1, K('iron', 3))
    if f == 3:
        for x, y in ((4, 2), (11, 2)):
            c.P(x, y, K('snow', 3))
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)): c.P(x + dx, y + dy, K('snow', 1))
    if f == 4: c.P(9, 4, K('snow', 3))
    if f == 2: c.P(5, 7, K('snow', 3))


# ═══════════════════════════ 금지된 숲 마차 ═══════════════════════════
@fx('wz-fx-forest-fog', '숲 옅은 안개(4프레임)', 'carriage', 2, 1, 4, 3,
    '숲 바닥을 낮게 깔리는 옅은 안개. 낮은 대비의 점무늬 띠 세 줄이 4프레임에 8px씩 흘러 양끝이 이어진다.',
    walk=['ff'], rules='숲길·승차장 바닥 위에 2칸 폭으로 덧그린다. 좌우로 이어 쓴다.', tags=['안개', '숲'], repeat=True)
def _fog(c, f):
    # 폭 넓은 2~3px 높이 띠 — 체커 디더(1px 번갈이)로 채우고 가장자리는 성기게. 프레임마다 늘고 줄며 8px 씩 흘러 32px 에서 이어진다.
    bands = ((2, 0, 14, 3), (6, 17, 11, 2), (9, 7, 15, 3), (13, 22, 10, 2))
    for row, (y, off, ln, hgt) in enumerate(bands):
        ln = ln + (0, 3, 1, -2)[(f + row) % 4]
        x0 = (off + 8 * f) % 32
        for k in range(ln):
            x = (x0 + k) % 32
            e = min(k, ln - 1 - k)
            hh = hgt if e >= 3 else (hgt - 1 if e >= 1 else 1)
            for j in range(hh):
                if (x + y + j) % 2: continue
                if e < 3 and hs(x, y + j, row + 7) < 0.35: continue
                c.P(x, y + j, K('iron', 3) if (j == 0 and e >= 2) else K('night', 3))


@fx('wz-fx-wheel-dust', '마차 바퀴 먼지(4프레임)', 'carriage', 1, 1, 4, 6,
    '마차 바퀴가 굴러 일으키는 흙먼지. 작은 덩이 → 커져 번짐 → 위로 풀어짐 → 알갱이로 흩어짐.',
    rules='마차 바퀴 아래 칸에 겹친다. 밑줄 y=15.', tags=['마차', '먼지', '바퀴'])
def _wheeldust(c, f):
    cols = (K('linen', 2), K('dirt', 5), K('dirt', 4))
    if f == 0:
        puff(c, 4, 13, 2.0, cols); c.P(8, 14, K('dirt', 4)); c.P(7, 15, K('dirt', 3))
    elif f == 1:
        puff(c, 5, 12, 3.2, cols, flat=0.8); puff(c, 11, 13.5, 1.8, cols)
    elif f == 2:
        puff(c, 6, 10, 3.0, (K('linen', 1), K('dirt', 5), K('dirt', 4)), flat=0.9); puff(c, 12, 11.5, 2.2, cols)
        c.P(2, 14, K('dirt', 3))
    else:
        for (x, y) in ((4, 6), (7, 7), (10, 8), (3, 10), (13, 10), (8, 11)): c.P(x, y, K('dirt', 5) if (x + y) % 2 else K('linen', 1))
        c.P(5, 13, K('dirt', 3)); c.P(11, 13, K('dirt', 3))


# ═══════════════════════════ 온실 ═══════════════════════════
@fx('wz-fx-mandrake-scream', '맨드레이크 비명 파동(6프레임)', 'greenhouse', 2, 2, 6, 7,
    '뽑힌 맨드레이크의 비명 파동과 튀는 흙. 보랏빛 충격파 고리가 퍼지며 끊어지고 흙 부스러기가 솟았다 떨어진다.',
    rules='2×2. 화분 한가운데(16,19)에서 퍼진다.', tags=['맨드레이크', '비명', '파동', '흙'])
def _scream(c, f):
    cx, cy = 16.0, 19.0

    def ring(r, col, gapk):
        n = max(10, int(r * 7))
        for k in range(n):
            if (k + gapk) % 4 == 0: continue
            a = 2 * math.pi * k / n
            c.P(int(round(cx + r * math.cos(a))), int(round(cy + r * 0.8 * math.sin(a))), col)
    rs = ((3, 0), (6, 0), (9, 3), (12, 7), (14, 11), (0, 0))[f]
    if f == 0: ring(3, K('violet', 4), 0)
    elif f == 1: ring(6, K('violet', 4), 1); ring(3, K('violet', 3), 2)
    elif f == 2: ring(9, K('violet', 3), 0); ring(5, K('violet', 4), 1)
    elif f == 3: ring(12, K('violet', 3), 1); ring(8, K('violet', 3), 2); ring(4, K('violet', 2), 0)
    elif f == 4: ring(14, K('violet', 2), 2); ring(10, K('violet', 2), 1)
    c.R(14, 25, 5, 2, K('dirt', 3)); c.R(13, 26, 7, 1, K('dirt', 2))
    crumbs = {0: [(13, 23), (19, 22)], 1: [(11, 19), (21, 17), (16, 14)], 2: [(8, 14), (24, 12), (14, 8), (19, 9)],
              3: [(6, 12), (26, 14), (11, 7), (21, 6), (16, 5)], 4: [(5, 18), (27, 20), (9, 14), (23, 15), (15, 11)],
              5: [(6, 23), (26, 24), (10, 22), (22, 23), (16, 20), (13, 27), (20, 27)]}[f]
    for i, (x, y) in enumerate(crumbs):
        c.P(x, y, K('dirt', 4 if i % 2 else 5)); 
        if f in (1, 2, 3) and i % 2 == 0: c.P(x + 1, y, K('dirt', 3))
    if f == 2: c.P(12, 18, K('snow', 3))
    c.P(15, 20, K('violet', 4)) if f < 2 else None


@fx('wz-fx-watering-stream', '물뿌리개 물줄기(4프레임)', 'greenhouse', 1, 1, 4, 8,
    '물뿌리개 주둥이에서 곡선으로 떨어지는 물줄기. 물방울 줄이 4프레임에 한 방울 간격 흘러 이어지고 바닥에서 튄다.',
    rules='물뿌리개를 든 사람 앞 칸에 겹친다. 시작(0,4)→끝(14,14).', tags=['물뿌리개', '물', '온실'])
def _water(c, f):
    n = 6
    for i in range(-1, n):
        t = (i + f / 4.0) / (n - 1)
        if not (0 <= t <= 1): continue
        x = int(round(0 + 14 * t)); y = int(round(4 + 10 * t * t + 1.5 * t))
        big = (i % 2 == 0)
        c.P(x, y, K('water', 4)); c.P(x, y + 1, K('water', 3))
        if big: c.P(x + 1, y, K('water', 5)); c.P(x - 1, y, K('water', 3))
        if t < 0.2: c.P(x, y - 1, K('water', 4))
    # 바닥 튀김
    sp = [[(13, 14), (15, 14)], [(12, 15), (15, 13), (14, 15)], [(12, 14), (15, 15)], [(13, 15), (11, 15), (15, 14)]][f]
    for (x, y) in sp: c.P(x, y, K('water', 5) if (x + f) % 2 else K('water', 4))


# ═══════════════════════════ 병동 ═══════════════════════════
@fx('wz-fx-ward-heal', '병동 치료 잔광(6프레임)', 'infirmary', 1, 1, 6, 6,
    '침상 위로 오르는 부드러운 치료 잔광. 십자 반짝임 세 개가 시차를 두고 커졌다 작아지며 떠오른다.',
    rules='침상·환자 칸 위에 겹친다.', tags=['병동', '치료', '잔광'])
def _heal(c, f):
    for i, (x, y0) in enumerate(((4, 13), (8, 15), (12, 12))):
        ph = (f + i * 2) % 6
        y = y0 - ph * 2
        s = (0, 1, 2, 3, 1, 0)[ph]
        if y < 1: continue
        sparkle(c, x, y, s, 'glow', hot=(ph in (2, 3)))
    for k, (x, y) in enumerate(((2, 3), (14, 6), (6, 8), (11, 2))):
        if (f + k) % 3 == 0: c.P(x, y, K('glow', 2))
        if (f + k) % 3 == 1: c.P(x, y, K('glow', 1))


@fx('wz-fx-vial-vapor', '약병 김(4프레임)', 'infirmary', 1, 1, 4, 5,
    '약병 주둥이에서 가늘게 오르는 연한 김. 꼬불꼬불 오르며 위에서 말려 풀린다.',
    rules='약병 칸 바로 위에 겹친다. 시작(8,15).', tags=['약병', '김'])
def _vapor(c, f):
    for y in range(14, 0, -1):
        sway = int(round(2.0 * math.sin(y * 0.65 + f * 1.57)))
        if y % 3 == 0 and f % 2 == 0: continue
        if y > 4 or (y + f) % 2:
            c.P(8 + sway, y, K('glow', 3) if y < 6 else K('glow', 2))
        if y in (9, 10, 11) and f in (1, 2): c.P(8 + sway + 1, y, K('glow', 1))
    c.P(8 + int(round(2.0 * math.sin(0.65 + f * 1.57))), 0, K('glow', 2)) if f in (1, 3) else None
    if f == 3: c.P(11, 2, K('glow', 3)); c.P(12, 1, K('glow', 2))


# ═══════════════════════════ 퀴디치 ═══════════════════════════
@fx('wz-fx-snitch-wings', '골든 스니치 날개(4프레임)', 'quidditch', 1, 1, 4, 12,
    '골든 스니치의 은빛 날개 파닥임. 금공 하나에 날개가 위 → 수평 → 아래 → 수평 으로 움직이고 공도 한 픽셀 오르내린다.',
    rules='공중(캐릭터 위 위층). 공 중심(8,8).', tags=['스니치', '날개', '골든'])
def _snitch(c, f):
    by = 8 + (0, 1, 0, -1)[f]
    c.ellipse(8, by, 2.2, 2.2, K('brass', 3))
    c.R(7, by - 1, 2, 2, K('brass', 4)); c.P(7, by - 1, K('brass', 5)); c.P(9, by + 1, K('brass', 2)); c.P(7, by + 1, K('brass', 2))
    c.P(8, by - 3, K('brass', 1)) if False else None
    wc, wd = K('snow', 3), K('iron', 4)
    for sgn in (-1, 1):
        x0 = 8 + sgn * 3
        if f == 0:
            pts = [(1, -1), (2, -2), (3, -3), (3, -4), (4, -4)]   # 위로
            for dx, dy in pts: c.P(x0 + sgn * (dx - 1), by + dy, wc if dy > -3 else wd)
            c.P(x0 + sgn * 2, by - 1, wd)
        elif f == 1 or f == 3:
            L = 5 if f == 1 else 4
            for k in range(L): c.P(x0 + sgn * k, by - (1 if k > 1 and f == 1 else 0) + (1 if f == 3 and k > 1 else 0), wc if k < L - 1 else wd)
            c.P(x0 + sgn * 1, by + 1, wd)
        else:
            pts = [(1, 1), (2, 2), (3, 3), (3, 4), (4, 4)]        # 아래로
            for dx, dy in pts: c.P(x0 + sgn * (dx - 1), by + dy, wc if dy < 3 else wd)
            c.P(x0 + sgn * 2, by + 1, wd)


@fx('wz-fx-bludger-trail', '블러저 궤적(6프레임)', 'quidditch', 2, 1, 6, 10,
    '쇠 공 블러저가 오른쪽으로 날아간다. 검은 공이 프레임마다 4px 진행하고 뒤로 점점 흐려지는 쇠빛 꼬리가 늘었다 줄었다 한다.',
    rules='2×1 공중. 공이 왼쪽에서 오른쪽으로 지나간다.', tags=['블러저', '궤적'])
def _bludger(c, f):
    x = 5 + 4 * f
    L = (4, 8, 12, 12, 10, 8)[f]
    for k in range(3, L):
        px = x - k
        if px < 0: break
        for dy in (-1, 0, 1):
            n = hs(px, dy + f, 11)
            if abs(dy) == 0 or n > 0.5 + k / 18.0:
                col = K('iron', 3) if k < 6 else (K('night', 3) if k < 9 else K('night', 2))
                if hs(px, dy, f) > 0.25 + k / 30.0 and (k % 2 == 0 or dy == 0): c.P(px, 8 + dy * 2 + (0 if dy == 0 else 0), col)
    c.ellipse(x + 0.5, 8, 3.2, 3.2, K('night', 1)); c.ellipse(x + 0.5, 8, 2.4, 2.4, K('night', 2))
    c.P(x - 1, 6, K('iron', 4)); c.P(x, 6, K('iron', 3)); c.P(x - 1, 7, K('iron', 3)); c.P(x + 2, 10, K('night', 0))
    c.HL(x - 3, 8, 1, K('iron', 3))


@fx('wz-fx-broom-stop-dust', '빗자루 급정지 먼지(6프레임)', 'quidditch', 2, 1, 6, 8,
    '빗자루로 급정지할 때 땅에 끌리며 일어나는 먼지. 긁힌 자국 → 덩이 번짐 → 위로 풀림 → 엷은 알갱이.',
    walk=['ff'], rules='2×1 땅 바로 위(투명 덧그림). 밑줄 y=15.', tags=['빗자루', '먼지', '급정지'])
def _brdust(c, f):
    cols = (K('linen', 2), K('dirt', 5), K('dirt', 4))
    if f == 0:
        for x in range(3, 14): c.P(x, 14, K('dirt', 3) if x % 2 else K('dirt', 4))
        puff(c, 6, 13, 1.8, cols)
    elif f == 1:
        puff(c, 8, 12.5, 3.0, cols, flat=0.8); puff(c, 18, 13.5, 2.0, cols)
        for x in range(2, 8): c.P(x, 15, K('dirt', 3))
    elif f == 2:
        puff(c, 9, 11, 3.8, cols, flat=0.85); puff(c, 20, 12, 3.0, cols, flat=0.85); puff(c, 27, 13.5, 1.8, cols)
    elif f == 3:
        puff(c, 10, 9.5, 3.6, (K('linen', 1), K('dirt', 5), K('dirt', 4)), flat=0.9); puff(c, 21, 10.5, 3.4, cols)
        c.P(27, 13, K('dirt', 4)); c.P(5, 14, K('dirt', 3))
    elif f == 4:
        for (x, y) in ((6, 6), (10, 5), (13, 8), (19, 7), (23, 9), (27, 11), (9, 11), (16, 11)):
            c.P(x, y, K('dirt', 5)); c.P(x + 1, y, K('linen', 1))
    else:
        for (x, y) in ((8, 4), (14, 6), (21, 5), (25, 8), (11, 9), (18, 10)): c.P(x, y, K('linen', 1) if (x + y) % 2 else K('dirt', 4))


# ═══════════════════════════ 보트 창고 ═══════════════════════════
@fx('wz-fx-boat-ripple', '보트 물결·노 물보라(6프레임)', 'boathouse', 2, 1, 6, 8,
    '노가 물을 젓는 자리. 노 물보라가 튀어 떨어지고 납작한 물결 고리가 두 겹으로 퍼져 흩어진다.',
    walk=['ff'], rules='2×1 물 위(투명 덧그림). 노 자리 (9,8).', tags=['보트', '물결', '노', '물보라'])
def _boatripple(c, f):
    w3, w4, w5 = K('water', 3), K('water', 4), K('water', 5)
    cx, cy = 10, 9

    def ring(r, col, gap):
        n = max(8, int(r * 6))
        for k in range(n):
            if (k + gap) % 5 == 0: continue
            a = 2 * math.pi * k / n
            c.P(int(round(cx + r * math.cos(a))), int(round(cy + r * 0.42 * math.sin(a))), col)
    if f <= 2:
        sp = {0: [(9, 6), (9, 5), (8, 4), (10, 4)], 1: [(8, 3), (11, 3), (9, 5), (12, 5), (7, 6)], 2: [(6, 6), (13, 6), (8, 7), (11, 7)]}[f]
        for i, (x, y) in enumerate(sp): c.P(x, y, w5 if i % 2 == 0 else w4)
    ring((3, 5, 8, 11, 14, 16)[f], w5 if f < 3 else w4, f)
    if f >= 2: ring((0, 0, 4, 7, 10, 12)[f], w4 if f < 4 else w3, f + 2)
    if f == 5: ring(6, w3, 1)


@fx('wz-fx-launch-ripple', '진수 파문(6프레임)', 'boathouse', 2, 2, 6, 7,
    '보트를 물에 띄울 때 퍼지는 큰 파문. 거품 점이 모이고 납작한 고리가 세 겹으로 커지며 얇아져 사라진다.',
    walk=['ff', 'ff'], rules='2×2 물 위(투명 덧그림). 중심(16,18).', tags=['보트', '진수', '파문'])
def _launch(c, f):
    w3, w4, w5 = K('water', 3), K('water', 4), K('water', 5)
    cx, cy = 16, 18

    def ring(r, col, gap):
        n = max(10, int(r * 6))
        for k in range(n):
            if (k + gap) % 6 == 0: continue
            a = 2 * math.pi * k / n
            c.P(int(round(cx + r * math.cos(a))), int(round(cy + r * 0.45 * math.sin(a))), col)
    for i, (x, y) in enumerate(((14, 17), (17, 19), (15, 20), (19, 17), (12, 19), (18, 21))):
        if f <= 2 and (i + f) % 2 == 0: c.P(x, y, K('snow', 3) if f == 0 else K('snow', 2))
    rr = ((3, 0, 0), (5, 2, 0), (8, 4, 1), (11, 7, 3), (13, 10, 6), (15, 12, 8))[f]
    ring(rr[0], w5 if f < 2 else w4, f)
    if rr[1]: ring(rr[1], w4, f + 1)
    if rr[2]: ring(rr[2], w3 if f > 3 else w4, f + 2)
    if f in (3, 4):
        for (x, y) in ((6, 15), (26, 20), (12, 27), (22, 12)): c.P(x, y, w3)


# ═══════════════════════════ 허니듀크 ═══════════════════════════
@fx('wz-fx-candy-wrap', '과자 포장지 접힘(8프레임)', 'honeydukes', 1, 1, 8, 8,
    '붉은 포장지가 사탕을 감싼다. 펼친 종이 → 양옆이 접힘 → 말림 → 끝이 비틀림 → 반짝이는 사탕 포장.',
    rules='창고 선반·작업대 칸 위. 중심(8,8).', tags=['과자', '포장지', '접힘'])
def _wrap(c, f):
    r1, r2, r3, r4, b4 = K('red', 1), K('red', 2), K('red', 3), K('red', 4), K('brass', 4)
    if f == 0:
        c.R(3, 3, 10, 10, r2); c.HL(3, 3, 10, r3); c.VL(3, 3, 10, r3); c.HL(3, 12, 10, r1); c.VL(12, 3, 10, r1)
        c.ellipse(8, 8, 2, 2, K('choc', 3)); c.P(7, 7, K('choc', 4)); c.R(5, 5, 1, 1, b4); c.R(10, 10, 1, 1, b4)
    elif f == 1:
        c.R(5, 3, 8, 10, r2); c.R(3, 4, 2, 8, r4); c.VL(5, 3, 10, r1); c.HL(5, 3, 8, r3); c.HL(3, 4, 2, r3)
        c.ellipse(9, 8, 2, 2, K('choc', 3)); c.P(8, 7, K('choc', 4))
    elif f == 2:
        c.R(5, 3, 6, 10, r2); c.R(3, 5, 2, 6, r4); c.R(11, 5, 2, 6, r4); c.VL(5, 3, 10, r1); c.VL(10, 3, 10, r1); c.HL(5, 3, 6, r3)
        c.ellipse(8, 8, 1.5, 2, K('choc', 3)); c.P(7, 7, K('choc', 4))
    elif f == 3:
        c.R(4, 4, 8, 8, r2); c.HL(4, 4, 8, r3); c.HL(4, 11, 8, r1); c.R(7, 5, 2, 6, r3); c.R(2, 6, 2, 4, r4); c.R(12, 6, 2, 4, r4)
        c.P(5, 5, b4); c.P(10, 9, b4)
    elif f == 4:
        c.ellipse(8, 8, 3.2, 3.2, r2); c.ellipse(8, 7.5, 2.5, 2, r3); c.HL(6, 6, 2, r4)
        for x in (1, 2): c.P(x, 7, r4); c.P(x, 9, r2)
        for x in (13, 14): c.P(x, 7, r4); c.P(x, 9, r2)
        c.P(3, 8, r3); c.P(12, 8, r3)
        c.P(5, 10, b4); c.P(10, 6, b4)
    elif f == 5:
        c.ellipse(8, 8, 3.2, 3.0, r2); c.ellipse(8, 7.5, 2.4, 2, r3); c.HL(6, 6, 2, r4); c.HL(5, 10, 6, r1)
        art(c, 0, 5, ['.rr', 'r4r', 'rrr', 'r4r', '.rr'], {'r': r2, '4': r4}); art(c, 13, 5, ['rr.', 'r4r', 'rrr', 'r4r', 'rr.'], {'r': r2, '4': r4})
        c.P(3, 7, r3); c.P(12, 7, r3)
    elif f == 6:
        c.ellipse(8, 8, 3.3, 3.0, r2); c.ellipse(8, 7.5, 2.5, 2, r3); c.HL(6, 6, 2, r4); c.HL(5, 10, 6, r1); c.P(9, 8, b4); c.P(6, 9, b4)
        art(c, 0, 6, ['r.r', 'rr4', 'rrr', 'rr4', 'r.r'], {'r': r2, '4': r4}); art(c, 13, 6, ['r.r', '4rr', 'rrr', '4rr', 'r.r'], {'r': r2, '4': r4})
    else:
        c.ellipse(8, 8, 3.3, 3.0, r2); c.ellipse(8, 7.5, 2.5, 2, r3); c.HL(6, 6, 2, r4); c.HL(5, 10, 6, r1)
        art(c, 0, 6, ['r.r', 'rr4', 'rrr', 'rr4', 'r.r'], {'r': r2, '4': r4}); art(c, 13, 6, ['r.r', '4rr', 'rrr', '4rr', 'r.r'], {'r': r2, '4': r4})
        c.P(6, 6, K('brass', 5)); c.P(7, 5, K('brass', 5)); c.P(5, 6, K('brass', 4)); c.P(6, 5, K('brass', 4)); c.P(8, 6, K('brass', 4))


@fx('wz-fx-string-tie', '끈 묶기(8프레임)', 'honeydukes', 1, 1, 8, 8,
    '종이 꾸러미에 끈을 묶는다. 끈이 가로로 → 세로로 감기고 → 매듭이 짓고 → 나비매듭이 조여진다.',
    rules='창고 작업대 위. 꾸러미 중심(8,8).', tags=['꾸러미', '끈', '묶기'])
def _tie(c, f):
    c.R(3, 4, 10, 9, K('linen', 3)); c.HL(3, 4, 10, K('linen', 4)); c.VL(3, 4, 9, K('linen', 4)); c.HL(3, 12, 10, K('linen', 1)); c.VL(12, 4, 9, K('linen', 2))
    s2, s3, s4 = K('red', 2), K('red', 3), K('red', 4)
    if f == 0:
        art(c, 11, 11, ['.rr', 'r.r', 'rr.'], {'r': s3}); c.P(10, 13, s3)
    elif f == 1:
        c.HL(3, 8, 10, s3); c.P(13, 8, s3); c.P(14, 9, s2); c.P(14, 10, s2)
    elif f == 2:
        c.HL(3, 8, 10, s3); c.VL(8, 4, 5, s3); c.P(8, 3, s3)
    elif f == 3:
        c.HL(3, 8, 10, s3); c.VL(8, 4, 9, s3); c.HL(3, 9, 10, s2)
        c.P(8, 3, s3); c.P(9, 3, s2)
    elif f == 4:
        c.HL(3, 8, 10, s3); c.VL(8, 4, 9, s3); c.R(7, 7, 3, 3, s2); c.P(7, 7, s4); c.P(9, 9, s2)
    elif f == 5:
        c.HL(3, 8, 10, s3); c.VL(8, 4, 9, s3); c.R(7, 7, 3, 3, s2); c.P(7, 7, s4)
        art(c, 4, 5, ['rr.', 'r.r', '.rr'], {'r': s3}); c.P(9, 6, s3)
    elif f == 6:
        c.HL(3, 8, 10, s3); c.VL(8, 4, 9, s3); c.R(7, 7, 3, 3, s2); c.P(7, 7, s4)
        art(c, 3, 4, ['rrr.', 'r44r', 'rrrr', '.rr.'], {'r': s3, '4': s4}); art(c, 9, 4, ['.rrr', 'r44r', 'rrrr', '.rr.'], {'r': s3, '4': s4})
    else:
        c.HL(3, 8, 10, s3); c.VL(8, 4, 9, s3); c.R(7, 7, 3, 3, s2); c.P(7, 7, s4)
        art(c, 4, 5, ['rrr', 'r4r', 'rrr'], {'r': s3, '4': s4}); art(c, 9, 5, ['rrr', 'r4r', 'rrr'], {'r': s3, '4': s4})
        c.P(6, 10, s2); c.P(5, 11, s2); c.P(10, 10, s2); c.P(11, 11, s2); c.P(12, 12, s2)
        c.P(8, 7, K('brass', 5))


@fx('wz-fx-magic-seal', '마법 봉인(8프레임)', 'honeydukes', 1, 1, 8, 8,
    '상자 뚜껑에 마법 봉인이 새겨진다. 점 → 룬 고리가 돌며 생김 → 원판으로 응축 → 번쩍 → 가라앉아 반짝이는 봉인.',
    rules='창고 상자·문 위. 중심(8,8).', tags=['마법', '봉인', '룬'])
def _seal(c, f):
    v2, v3, v4 = K('violet', 2), K('violet', 3), K('violet', 4)
    if f == 0: c.P(8, 8, K('glow', 3))
    elif f == 1:
        c.P(8, 8, K('glow', 4)); 
        for dx, dy in ((0, -2), (2, 0), (0, 2), (-2, 0)): c.P(8 + dx, 8 + dy, K('glow', 3))
    elif f in (2, 3):
        r = 3 if f == 2 else 4
        for k in range(8):
            a = 2 * math.pi * k / 8 + (0.4 if f == 3 else 0)
            x, y = int(round(8 + r * math.cos(a))), int(round(8 + r * math.sin(a)))
            c.P(x, y, K('glow', 3)); 
            if k % 2 == 0: c.P(x + (1 if x < 8 else -1) if f == 3 else x, y, K('glow', 2))
        c.P(8, 8, K('glow', 4))
    elif f == 4:
        c.ellipse(8, 8, 4, 4, v2, fill=False)
        c.ellipse(8, 8, 2.5, 2.5, v3); c.P(7, 7, v4)
        for dx, dy in ((0, -5), (5, 0), (0, 5), (-5, 0)): c.P(8 + dx, 8 + dy, K('glow', 3))
    elif f == 5:
        c.ellipse(8, 8, 4.2, 4.2, v3); c.ellipse(8, 8, 3, 3, v2); c.HL(7, 7, 2, v4); c.VL(8, 6, 4, v4)
        c.P(5, 6, v4); c.P(11, 10, v4)
    elif f == 6:
        sparkle(c, 8, 8, 3, 'glow')
        c.ellipse(8, 8, 4.2, 4.2, v3, fill=False)
    else:
        c.ellipse(8, 8, 4, 4, v3); c.ellipse(8, 8, 3, 3, v2); c.ellipse(8, 8, 4, 4, v2, fill=False)
        c.HL(7, 7, 2, v3); c.VL(8, 6, 4, v3); c.P(7, 7, v4)
        c.P(12, 4, K('glow', 4)); c.P(12, 3, K('glow', 3)); c.P(11, 4, K('glow', 3)); c.P(13, 4, K('glow', 3)); c.P(12, 5, K('glow', 3))


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
