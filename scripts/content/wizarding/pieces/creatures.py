"""creatures — 부엉이 3종 · 세스트랄 · 맨드레이크 · 초콜릿 개구리 (손 도트, 코드로 그림)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402

MODULE = 'creatures'
INK, INK2 = OL, OL2


def C(m, t): return K(m, t)


# ───────────────────────── 부엉이 ─────────────────────────
SNOW_W = C('snow', 3); SNOW_S = C('snow', 2); SNOW_D = C('snow', 1)
OWLS = {
    'barn': dict(name='헛간부엉이', main=C('brass', 3), dark=C('brass', 2), light=C('brass', 4), belly=SNOW_W, bellyd=SNOW_S,
                 face=SNOW_W, rim=C('brass', 2), eye=INK, pupil=INK, beak=C('wood', 5), foot=C('wood', 4), spot=C('brass', 2),
                 tuft=False, heart=True, spots='dots'),
    'eagle': dict(name='수리부엉이', main=C('wood', 3), dark=C('wood', 2), light=C('wood', 4), belly=C('wood', 5), bellyd=C('wood', 4),
                  face=C('wood', 4), rim=C('wood', 2), eye=C('fire', 2), pupil=INK, beak=INK2, foot=C('wood', 5), spot=C('wood', 2),
                  tuft=True, heart=False, spots='streaks'),
    'snowy': dict(name='흰부엉이', main=SNOW_W, dark=SNOW_S, light=SNOW_W, belly=SNOW_W, bellyd=SNOW_S,
                  face=SNOW_W, rim=SNOW_S, eye=C('brass', 4), pupil=INK, beak=INK2, foot=C('night', 2), spot=C('night', 1),
                  tuft=False, heart=False, spots='bars'),
}


def _sp(pts, s, cx, by):
    return [(cx + dx * s, by + dy * s) for dx, dy in pts]


def _mir(c, fn, cx):
    """fn(sign) 를 오른쪽(+1)과 왼쪽(-1)으로 두 번 부른다."""
    fn(1); fn(-1)


def _px(c, cx, dx, y, col, w=1, sign=1):
    """cx 기준 대칭 점(dx>=0 은 가운데에서 dx 번째 칸)."""
    if sign > 0: c.R(int(cx + dx), y, w, 1, col)
    else: c.R(int(cx - dx - w), y, w, 1, col)


WING_UP = [(2.5, -8), (3.5, -13), (7, -18), (10.5, -17), (11, -12), (9, -7), (6, -4)]
WING_OUT = [(3, -9), (8, -11.5), (11.5, -9), (11.5, -5), (8, -3), (3, -3.5)]
WING_FOLD = [(3.6, -10), (5.2, -8), (5.2, -3), (4.2, -1.2), (3.2, -2), (3, -6)]


def _front_face(c, sp, cx, by, s):
    # 얼굴판
    fy = by - 11.5 * s
    if sp['heart']:
        c.ellipse(cx - 2.3 * s, fy - 0.5 * s, 2.7 * s, 2.8 * s, sp['face'])
        c.ellipse(cx + 2.3 * s, fy - 0.5 * s, 2.7 * s, 2.8 * s, sp['face'])
        c.poly([(cx - 4.2 * s, fy), (cx + 4.2 * s, fy), (cx, fy + 3.8 * s)], sp['face'])
        c.ellipse(cx - 2.3 * s, fy - 0.5 * s, 2.7 * s, 2.8 * s, sp['rim'], fill=False)
        c.ellipse(cx + 2.3 * s, fy - 0.5 * s, 2.7 * s, 2.8 * s, sp['rim'], fill=False)
    else:
        c.ellipse(cx - 2.4 * s, fy, 2.6 * s, 2.5 * s, sp['face'])
        c.ellipse(cx + 2.4 * s, fy, 2.6 * s, 2.5 * s, sp['face'])
    # 눈
    ey = int(fy - 0.8 * s)
    for sg in (1, -1):
        ex = int(cx - 3 * s - 1) if sg < 0 else int(cx + 3 * s)
        ew = 2 if s >= 0.9 else 1
        c.R(ex, ey, ew, ew, sp['eye'])
        if sp['eye'] != INK and ew == 2: c.P(ex + (1 if sg < 0 else 0), ey + 1, sp['pupil'])
        elif sp['eye'] == INK and ew == 2: c.P(ex + (0 if sg < 0 else 1), ey, C('night', 3))
    # 눈썹(수리부엉이: 사나운 눈썹)
    if sp['tuft']:
        for sg in (1, -1):
            ex = int(cx - 4 * s - 1) if sg < 0 else int(cx + 4 * s)
            c.R(ex, ey - 1, int(2 * s + 1), 1, sp['dark'])
    # 부리
    c.R(cx - 1, int(fy + 1.2 * s), 2, 1, sp['beak'])
    c.P(cx - (1 if s < 0.9 else 0), int(fy + 2.2 * s), sp['beak']) if s >= 0.9 else None


def owl_front(c, sp, cx, by, wings='fold', s=1.0, back=False, head=None):
    """정면(back=True 면 뒷모습) 부엉이. cx 는 가운데 경계선(정수), by 는 발이 닿는 마지막 줄."""
    # 날개 (몸 뒤) — 펼친 날개는 몸 뒤에서 나온다
    if wings in ('up', 'out'):
        pts = WING_UP if wings == 'up' else WING_OUT
        for sg in (1, -1):
            P = [(cx + sg * dx * s, by + dy * s) for dx, dy in pts]
            c.poly(P, sp['dark'])
            # 안쪽 밝은 면 + 날개깃 끝
            inner = [(cx + sg * dx * s, by + dy * s) for dx, dy in
                     ([(3, -9), (4, -12.5), (7, -16), (8.5, -14), (8, -10), (6, -6)] if wings == 'up'
                      else [(3.5, -8.5), (7.5, -10), (9.5, -8.5), (9.5, -6), (7, -4.5), (3.5, -5)])]
            c.poly(inner, sp['main'])
            tipx = [(11 if wings == 'up' else 11.5) * sg]
            ex = int(cx + (10.2 * s if sg > 0 else -10.2 * s - 1))
            ty = by + (-13 if wings == 'up' else -9) * s
            for k in range(3):
                yy = int(ty + k * 2 * s)
                c.P(int(cx + sg * (11 * s) - (1 if sg > 0 else 0)) if sg > 0 else int(cx - 11 * s), yy, sp['spot'])
    bw, bh = 5 * s, 5.5 * s
    hw, hh = 5.5 * s, 4.2 * s
    # 몸통
    c.ellipse(cx, by - 5.5 * s, bw, bh, sp['main'])
    # 머리
    if head is None:
        c.ellipse(cx, by - 11.5 * s, hw, hh, sp['main'])
    if back:
        # 뒷모습: 뒷머리 선, 등 깃 줄무늬, 꼬리
        c.ellipse(cx, by - 11.5 * s, hw - 1.2 * s, hh - 1 * s, sp['light'])
        for dy in (-8, -6, -4):
            for sg in (1, -1):
                _px(c, cx, 1, int(by + dy * s), sp['dark'], 2, sg)
        c.R(cx - 2, int(by - 8 * s), 4, 1, sp['dark'])
        if sp['tuft']:
            for sg in (1, -1):
                for dx, dy in ((3, -15), (4, -16), (4, -15)):
                    _px(c, cx, dx, int(by + dy * s), sp['dark'], 1, sg)
        if wings == 'fold':
            for sg in (1, -1):
                for k in range(2):
                    _px(c, cx, 3 + k, int(by - 3 * s) - k * 2, sp['dark'], 1, sg)
            c.R(cx - 3, int(by - 3 * s), 6, 3, sp['dark'])
            c.R(cx - 2, int(by - 5 * s), 4, 2, sp['dark'])
        c.R(cx - 2, by, 4, 1, sp['dark'])           # 꼬리깃 끝
        return
    # 앞모습
    for sg in (1, -1):
        if sp['tuft'] and head is None:
            for dx, dy in ((3, -15.5), (4, -16.5), (4, -15.5), (4, -14.5), (5, -15)):
                _px(c, cx, int(dx), int(by + dy * s), sp['dark'], 1, sg)
    # 배
    c.ellipse(cx, by - 4.5 * s, 3.3 * s, 4.2 * s, sp['belly'])
    spots = sp['spots']
    for k, yy in enumerate((-7, -5, -3)):
        y = int(by + yy * s)
        if spots == 'streaks':
            c.R(cx - 1, y, 1, 2, sp['spot']); c.R(cx + 1, y, 1, 2, sp['spot'])
        elif spots == 'none':
            pass
        elif spots == 'bars':
            c.R(cx - 2 + (k % 2), y, 2, 1, sp['spot']); c.R(cx + 1 - (k % 2), y, 2, 1, sp['spot'])
        else:
            c.P(cx - 2 + k % 2, y, sp['bellyd']); c.P(cx + 1 - k % 2, y, sp['bellyd'])
    (head or _front_face)(c, sp, cx, by, s)
    # 접힌 날개
    if wings == 'fold':
        for sg in (1, -1):
            P = [(cx + sg * dx * s, by + dy * s) for dx, dy in WING_FOLD]
            c.poly(P, sp['dark'])
            _px(c, cx, int(4.2 * s), int(by - 8 * s), sp['main'], 1, sg)
            _px(c, cx, int(4.2 * s), int(by - 5 * s), sp['main'], 1, sg)
    # 발
    c.R(cx - 3, by, 2, 1, sp['foot']); c.R(cx + 1, by, 2, 1, sp['foot'])


def owl_side(c, sp, cx, by, wings='fold', s=1.0):
    """오른쪽을 보는 옆모습. cx 는 몸 중심 x."""
    cx = float(cx)
    # 꼬리 (왼쪽 아래)
    c.poly(_sp([(-2, -7), (-8, -3), (-8, -1), (-3, -1)], s, cx, by), sp['dark'])
    # 날개(뒤쪽) 펼침
    if wings == 'up':
        c.poly(_sp([(-1, -9), (-3, -15), (-6, -19), (-9, -16), (-8, -10), (-4, -6)], s, cx, by), sp['dark'])
        c.poly(_sp([(-1, -9), (-3, -14), (-5, -17), (-7, -14), (-6, -10), (-3, -7)], s, cx, by), sp['main'])
    c.ellipse(cx, by - 5.5 * s, 5 * s, 5.5 * s, sp['main'])
    c.ellipse(cx + 3 * s, by - 11.5 * s, 4.6 * s, 4.2 * s, sp['main'])
    if sp['tuft']:
        for dx, dy in ((1, -15.5), (1, -16.5), (2, -15.5), (0, -15.5), (2, -14.5)):
            c.P(int(cx + dx * s), int(by + dy * s), sp['dark'])
    # 배
    c.ellipse(cx + 2 * s, by - 4.5 * s, 2.6 * s, 4 * s, sp['belly'])
    # 얼굴판
    c.ellipse(cx + 5 * s, by - 11.3 * s, 2.2 * s, 2.6 * s, sp['face'])
    if sp['heart']: c.ellipse(cx + 5 * s, by - 11.3 * s, 2.2 * s, 2.6 * s, sp['rim'], fill=False)
    # 눈·부리
    ex, ey = int(cx + 5 * s), int(by - 12.3 * s)
    ew = 2 if s >= 0.9 else 1
    c.R(ex, ey, ew, ew, sp['eye'])
    if sp['eye'] != INK and ew == 2: c.P(ex + 1, ey + 1, sp['pupil'])
    elif ew == 2: c.P(ex, ey, C('night', 3))
    if sp['tuft']: c.R(ex - 1, ey - 1, 3, 1, sp['dark'])
    c.R(int(cx + 7.4 * s), int(by - 10.5 * s), 1, 2 if s >= 0.9 else 1, sp['beak'])
    c.P(int(cx + 8 * s), int(by - 10 * s), sp['beak']) if s >= 0.9 else None
    # 접힌 날개(몸 위)
    if wings in ('fold', 'out'):
        if wings == 'fold':
            c.poly(_sp([(-3, -9), (2, -9), (4, -5), (0, -1), (-6, -1.5), (-6, -4)], s, cx, by), sp['dark'])
            c.poly(_sp([(-2, -8), (1, -8), (2.5, -5.5)], s, cx, by), sp['main'])
            c.P(int(cx - 1 * s), int(by - 4 * s), sp['main']); c.P(int(cx + 1 * s), int(by - 3 * s), sp['main'])
        else:   # 아래로 내린 날개(앞쪽)
            c.poly(_sp([(-2, -9), (3, -8), (6, -3), (3, 0), (-3, -1), (-6, -5)], s, cx, by), sp['dark'])
            c.poly(_sp([(-1.5, -8), (2, -7.5), (4, -4), (2, -2.5), (-2, -3)], s, cx, by), sp['main'])
    elif wings == 'up':
        c.poly(_sp([(-1, -9), (2, -9), (3, -5), (0, -2), (-5, -2), (-5, -5)], s, cx, by), sp['dark'])
        c.poly(_sp([(-1, -8), (1, -8), (2, -5)], s, cx, by), sp['main'])
    c.R(int(cx - 1), by, 2, 1, sp['foot']); c.R(int(cx + 2), by, 2, 1, sp['foot'])


def _owl_char(sp):
    def fn(c, d, f):
        wings = ('up', 'fold', 'out')[f]
        if d == 'down': owl_front(c, sp, 12, 31, wings)
        elif d == 'up': owl_front(c, sp, 12, 31, wings, back=True)
        else:
            t = Cv(24, 32); owl_side(t, sp, 11, 31, wings)
            t.outline()
            c.blit(t if d == 'right' else t.flip_h(), 0, 0)
            return
        c.outline()
    return fn


for _k, _sp_ in OWLS.items():
    REG.character(f'wz-cre-owl-{_k}', _sp_['name'] + ' (걷기 시트)', 'owlery',
                  f"{_sp_['name']}. 4방향×3프레임: 0·2 날갯짓, 1 날개 접고 선 자세. 몸 10~14px(사람보다 훨씬 작음).",
                  tags=['부엉이', '새', _sp_['name']], family='creatures')(_owl_char(_sp_))



# ── 1x1 조각 전용 머리 (수리부엉이·흰부엉이): 걷기 시트와 헛간부엉이는 옛 머리를 그대로 쓴다 ──
FIRE2, FIRE1 = C('fire', 2), C('fire', 1)


def _head_eagle(c, sp, cx, by, s):
    big = s >= 0.7
    fy = by - 11.5 * s; hy = int(fy)
    e0 = 2 if big else 1
    c.ellipse(cx, fy, 5.5 * s, 4.2 * s, sp['main'])
    c.ellipse(cx, hy + 0.4, 3.9 if big else 3.1, 2.9 if big else 2.4, C('wood', 5))     # 밝은 얼굴판
    top = int(fy - 4.2 * s * 0.75)
    for sg in (1, -1):
        x = cx + (e0 + 1) if sg > 0 else cx - (e0 + 1) - 1
        c.P(x, top - 1, sp['dark']); c.P(x, top, sp['dark'])                           # 짧은 귀깃 2px
        c.P(x + sg, top, sp['dark'])
    for sg in (1, -1):
        x = cx + e0 if sg > 0 else cx - e0 - 2
        c.R(x, hy - 1, 2, 2, FIRE2)
        c.P(x + (0 if sg > 0 else 1), hy, INK)
        c.R(x, hy - 2, 2, 1, sp['dark'])
        c.P(x + (2 if sg > 0 else -1), hy - 1, sp['dark'])                                # 눈썹 바깥 처짐
    c.R(cx - 1, hy, 2, 2, FIRE2)                                                        # 휜 부리
    c.P(cx - 1, hy + 2, C('wood', 3)); c.P(cx, hy + 1, C('wood', 3))


def _head_snowy(c, sp, cx, by, s):
    big = s >= 0.7
    fy = by - 11.5 * s; hy = int(fy)
    e0 = 2 if big else 1
    c.ellipse(cx, fy + 0.2, 3.9 if big else 3.1, 3.6 if big else 3.0, sp['main'])        # 둥근 머리
    for sg in (1, -1):
        x = cx + e0 if sg > 0 else cx - e0 - 2
        c.R(x, hy - 2, 2, 1, FIRE2); c.R(x, hy + 1, 2, 1, FIRE2)                          # 주황 눈테
        c.R(x, hy - 1, 2, 2, C('brass', 4))
        c.P(x + (0 if sg > 0 else 1), hy, INK)
        c.P(x + (-1 if sg > 0 else 2), hy - 1, FIRE2); c.P(x + (-1 if sg > 0 else 2), hy, FIRE2)
    c.R(cx - 1, hy + 1, 2, 1, C('brass', 3)); c.P(cx - 1, hy + 2, C('brass', 2))          # 작은 노란 휜 부리
    for dx, k in ((-1, 6), (1, 4), (-2, 2.5)):
        c.P(cx + dx, int(by - k * s), C('snow', 1))                                       # 가슴 회색 점


SNOWY_PC = dict(OWLS['snowy'], spots='none')


def _owl_piece(sp, kind, head=None):
    def fn(c):
        if kind == 'perch': owl_front(c, sp, 8, 15, 'fold', 0.8, head=head)
        elif kind == 'land': owl_front(c, sp, 8, 15, 'up', 0.62, head=head)
        else:
            owl_front(c, sp, 8, 11, 'out', 0.62, head=head)
            # 발에 매단 봉투
            c.R(5, 12, 6, 4, C('linen', 3)); c.R(5, 12, 6, 1, C('linen', 4)); c.R(5, 15, 6, 1, C('linen', 2))
            c.R(5, 12, 1, 4, C('linen', 2)); c.P(7, 13, C('linen', 2)); c.P(8, 14, C('linen', 2))
            c.R(7, 13, 2, 2, C('red', 3)); c.P(7, 13, C('red', 4))
        c.outline()
    return fn


def _PC(k, sp, kind):
    if k == 'eagle': return sp, kind, _head_eagle
    if k == 'snowy': return SNOWY_PC, kind, _head_snowy
    return sp, kind, None


for _k, _sp_ in OWLS.items():
    n = _sp_['name']
    REG.piece(f'wz-cre-owl-{_k}-perch', f'{n} 횃대 대기', 1, 1, ['C'], 'creatures', 'owlery',
              f'{n}가 횃대 가로대 위에 날개를 접고 앉은 모습. 횃대 조각 위층에 겹쳐 놓는다.',
              rules='횃대 가로대 칸의 위층에 겹친다. 발이 가로대 줄에 닿는다.', tags=['부엉이', '횃대'], role='prop')(_owl_piece(*_PC(_k, _sp_, 'perch')))
    REG.piece(f'wz-cre-owl-{_k}-land', f'{n} 착지', 1, 1, ['C'], 'creatures', 'owlery',
              f'{n}가 날개를 펼치고 내려앉는 순간.', tags=['부엉이', '착지'], role='prop')(_owl_piece(*_PC(_k, _sp_, 'land')))
    REG.piece(f'wz-cre-owl-{_k}-mail', f'{n} 편지 비행', 1, 1, ['C'], 'creatures', 'postoffice',
              f'{n}가 발에 봉투를 매달고 나는 모습.', tags=['부엉이', '편지', '비행'], role='prop')(_owl_piece(*_PC(_k, _sp_, 'mail')))

# ───────────────────────── 세스트랄 ─────────────────────────
TB, TB2, TB3 = C('night', 1), C('night', 2), C('night', 3)
TBN = C('ink', 1)
MEM, MEM2 = C('red', 1), C('violet', 2)
BONE = C('night', 3)
WHITE = C('snow', 3)
LEATH, LEATH2, LEATH3 = C('wood', 3), C('wood', 2), C('wood', 4)
BR, BR2 = C('brass', 4), C('brass', 3)


def _wing_front(c, sg, kind, cx=24):
    """앞/뒤 모습의 박쥐 날개 한쪽(sg=-1 왼쪽, +1 오른쪽)."""
    def m(pts): return [((cx - 0.5) + sg * (cx - 0.5 - x) * -1 if False else (23.5 + sg * (23.5 - x) * -1), y) for x, y in pts]
    # 왼쪽 좌표로 쓰고 sg 에 따라 거울
    def mir(pts):
        return [(x if sg < 0 else 47 - x, y) for x, y in pts]
    if kind == 'spread':
        mem = [(17, 25), (9, 13), (3, 10), (0, 19), (1, 29), (6, 24), (8, 33), (12, 27), (14, 36), (18, 33)]
        c.poly(mir(mem), MEM)
        c.poly(mir([(17, 26), (10, 15), (5, 14), (3, 21), (7, 24), (9, 30), (13, 27), (15, 32), (18, 31)]), MEM2)
        for a, b in (((17, 25), (3, 10)), ((3, 10), (1, 29)), ((3, 10), (8, 33)), ((3, 10), (14, 36))):
            (x0, y0), (x1, y1) = mir([a, b])
            c.line(x0, y0, x1, y1, BONE)
        for a in ((3, 9), (2, 10)):
            c.P(*mir([a])[0], BONE)
    else:   # folded
        mem = [(16, 26), (10, 8), (6, 12), (3, 22), (3, 34), (7, 39), (10, 33), (13, 38), (16, 34)]
        c.poly(mir(mem), MEM)
        c.poly(mir([(15, 27), (11, 12), (8, 16), (6, 24), (6, 33), (9, 30), (12, 34), (15, 32)]), MEM2)
        for a, b in (((16, 26), (10, 8)), ((10, 8), (3, 34)), ((10, 8), (7, 39)), ((10, 8), (13, 38))):
            (x0, y0), (x1, y1) = mir([a, b])
            c.line(x0, y0, x1, y1, BONE)


def th_front(c, back=False, wing='fold', harness=False, body=True, ph=0, bob=0):
    by = bob
    if body:
        for sg in (-1, 1):
            _wing_front(c, sg, wing)
        # 꼬리 (뒷모습)
        if back:
            for k in range(14):
                c.P(23 + (k // 5) % 2, 32 + k, TB2); c.P(24 + (k // 5) % 2, 32 + k, TB)
            c.R(22, 45, 4, 2, TB2)
        # 다리는 몸통 뒤에서 먼저 그리고, 몸통 아래로 나온 부분만 보인다
        legs = {0: ((19, 47, 0), (29, 43, 3)), 1: ((21, 47, 0), (27, 47, 0)), 2: ((19, 43, 3), (29, 47, 0)), 3: ((21, 47, 0), (27, 47, 0))}[ph % 4]
        for (lx, ly, lift), sx in zip(legs, (-1, 1)):
            top = 36 + by
            xs = lx + (2 if (ph % 4 == 1 and sx < 0) else 0) - (2 if (ph % 4 == 3 and sx > 0) else 0)
            for y in range(top, ly + 1):
                w = 3 if (y - top) % 6 != 3 else 4
                c.R(xs - 1, y, w, 1, TB2)
                c.P(xs - 1, y, TB3)
            c.R(xs - 2, ly - 1, 5, 2, TBN)
            c.P(xs - 2, ly - 1, TB2)
        # 몸통
        if not back:
            c.ellipse(23.5, 33 + by, 9, 8, TB)           # 가슴
            c.ellipse(23.5, 31 + by, 7, 6, TB2)          # 가슴 윗면 (빛)
            # 드러난 늑골: 위가 휘어진 아치
            for k, yy in enumerate((28, 31, 34, 37)):
                w = 6 - (k == 3) * 1
                c.HL(24 - w, yy + by, w * 2, TB3) if hasattr(c, 'HL') else None
                c.HL(24 - w + 1, yy + 1 + by, w * 2 - 2, TBN)
            c.VL(23, 27 + by, 11, TB3); c.VL(24, 27 + by, 11, TB3)   # 흉골
            # 목
            c.poly([(19, 18 + by), (29, 18 + by), (31, 30 + by), (17, 30 + by)], TB)
            c.poly([(20, 18 + by), (25, 18 + by), (25, 29 + by), (19, 29 + by)], TB2)
            # 머리 (정면, 긴 얼굴)
            c.ellipse(23.5, 13 + by, 5, 7.5, TB)
            c.poly([(20, 17 + by), (28, 17 + by), (27, 25 + by), (20, 25 + by)], TB)
            c.ellipse(23.5, 24 + by, 3.6, 2.2, TB2)      # 주둥이
            c.poly([(18, 8 + by), (20, 3 + by), (22, 8 + by)], TB); c.poly([(26, 8 + by), (28, 3 + by), (30, 8 + by)], TB)
            c.P(20, 6 + by, MEM2); c.P(28, 6 + by, MEM2)
            c.R(19, 11 + by, 2, 2, WHITE); c.R(27, 11 + by, 2, 2, WHITE)       # 흰 눈
            c.P(20, 12 + by, TBN); c.P(27, 12 + by, TBN)
            c.P(22, 24 + by, TBN); c.P(25, 24 + by, TBN)      # 콧구멍
            c.VL(23, 8 + by, 8, TB2); c.VL(24, 8 + by, 8, TB3)  # 콧대 하이라이트
            # 갈기
            for yy in range(14, 28, 3):
                c.P(17, yy + by, TB3); c.P(30, yy + 1 + by, TB3)
        else:
            c.ellipse(23.5, 34 + by, 10, 9, TB)          # 엉덩이
            c.ellipse(23.5, 31 + by, 8, 6, TB2)
            for k, yy in enumerate((28, 31, 34)):
                c.HL(15 + k, yy + by, 16 - 2 * k, TB3)
                c.HL(16 + k, yy + 1 + by, 14 - 2 * k, TBN)
            c.VL(23, 22 + by, 9, TB3); c.VL(24, 22 + by, 9, TB3)    # 척추
            c.ellipse(23.5, 15 + by, 4.5, 6, TB)          # 머리 뒤
            c.poly([(18, 10 + by), (20, 4 + by), (22, 10 + by)], TB); c.poly([(26, 10 + by), (28, 4 + by), (30, 10 + by)], TB)
            c.poly([(20, 18 + by), (28, 18 + by), (30, 26 + by), (18, 26 + by)], TB)
            c.R(22, 9 + by, 4, 6, TB2)
    if harness:
        _harness_front(c, body)
    c.outline(color=None)


def _harness_front(c, body=True):
    ST, ST2 = LEATH, LEATH3
    # 머리 굴레: 이마띠 + 뺨끈 + 코끈
    c.HL(19, 9, 10, ST); c.HL(19, 10, 10, ST2)
    c.VL(19, 10, 7, ST); c.VL(28, 10, 7, ST)
    c.HL(20, 20, 8, ST2); c.HL(20, 21, 8, ST)
    c.P(19, 9, BR); c.P(28, 9, BR); c.P(23, 9, BR2); c.P(24, 9, BR2)
    if not body:
        _harness_unseen(c, ST, ST2)
        return
    # 목걸이(칼라) — 두껍고 둥글게
    c.R(15, 25, 18, 4, ST); c.HL(15, 25, 18, ST2); c.HL(16, 28, 16, C('wood', 1))
    for x in (17, 21, 26, 30): c.P(x, 26, BR2)
    c.R(22, 28, 4, 3, BR2); c.R(23, 29, 2, 1, C('ink', 1)); c.P(22, 28, BR)
    # 가슴띠 (V자)
    c.line(17, 29, 23, 36, ST); c.line(18, 29, 24, 36, ST2)
    c.line(31, 29, 25, 36, ST); c.line(30, 29, 24, 36, ST2)
    c.R(22, 36, 4, 3, BR2); c.R(23, 37, 2, 1, C('ink', 1)); c.P(22, 36, BR)
    # 배띠 + 견인줄 (몸 양옆으로 나가 견인봉 고리에 걸림)
    c.HL(14, 39, 20, ST); c.HL(14, 40, 20, ST2)
    for sg, x0 in ((-1, 14), (1, 33)):
        c.R(x0 - (2 if sg < 0 else 0), 38, 3, 4, BR2)
        c.R(x0 - (1 if sg < 0 else -1), 39, 1, 2, C('ink', 1))
        c.P(x0 - (2 if sg < 0 else 0), 38, BR)


def _arc(c, x0, x1, y0, depth, col, th=2, up=False):
    """가로로 휘는 띠: 가운데가 depth만큼 아래(또는 위)로 불룩. 몸 둘레를 감싼 모양이 된다."""
    mid = (x0 + x1) / 2.0; hw = (x1 - x0) / 2.0
    for x in range(x0, x1 + 1):
        t = 1 - ((x - mid) / hw) ** 2
        y = y0 + int(round(depth * t)) * (-1 if up else 1)
        for k in range(th): c.P(x, y + k, col)


def _harness_unseen(c, ST, ST2):
    """몸이 안 보일 때의 마구: 목·배를 감싼 둥근 띠가 투명한 몸통의 윤곽을 만든다."""
    # 목걸이: 앞으로 불룩한 U자 + 뒤쪽 윗선(희미)
    _arc(c, 16, 31, 24, 2, ST2, 1, up=True)
    _arc(c, 15, 32, 26, 3, ST, 2); _arc(c, 15, 32, 27, 3, ST2, 1)
    for x in (17, 21, 26, 30): c.P(x, 27 + (0 if x in (21, 26) else -1) + 1, BR2)
    # 목끈: 굴레 코끈 아래 → 목걸이 가운데 → 가슴 버클
    c.VL(23, 22, 5, ST); c.VL(24, 22, 5, ST2)
    c.R(22, 29, 4, 3, BR2); c.R(23, 30, 2, 1, C('ink', 1)); c.P(22, 29, BR)
    # 가슴띠: 목걸이 양 끝에서 둥글게 내려와 가운데 버클에 모인다
    for sg in (-1, 1):
        pts = [(23 + sg * 7, 30), (23 + sg * 8, 33), (23 + sg * 7, 36), (23 + sg * 5, 39), (23 + sg * 3, 41), (23 + sg * 1, 42)]
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            c.line(xa, ya, xb, yb, ST); c.line(xa + 1, ya, xb + 1, yb, ST2)
    c.VL(23, 32, 10, ST); c.VL(24, 32, 10, ST2)                      # 가슴 한가운데 줄
    # 배띠: 아래로 불룩한 둥근 고리 + 뒤쪽 윗선(몸 반대편을 지나감)
    _arc(c, 14, 33, 36, 3, ST2, 1, up=True)
    _arc(c, 14, 33, 40, 4, ST, 2); _arc(c, 14, 33, 41, 4, ST2, 1)
    for sg, x0 in ((-1, 14), (1, 33)):                                    # 견인줄 고리
        c.R(x0 - (2 if sg < 0 else 0), 39, 3, 4, BR2)
        c.R(x0 - (1 if sg < 0 else -1), 40, 1, 2, C('ink', 1))
        c.P(x0 - (2 if sg < 0 else 0), 39, BR)
    # 아래로 늘어진 버클 + 그 밑의 옅은 그림자
    c.R(22, 45, 4, 3, BR2); c.R(23, 46, 2, 1, C('ink', 1)); c.P(22, 45, BR); c.P(25, 47, BR)
    c.HL(21, 48, 6, C('ink', 1))


def th_side(c, wing='fold', ph=0):
    """오른쪽을 보는 세스트랄(3×3 칸 48×48)."""
    # 날개 (몸 뒤쪽 먼 날개는 생략, 가까운 날개 접음)
    mem = [(20, 25), (15, 5), (10, 10), (4, 20), (2, 28), (7, 29), (9, 33), (13, 29), (16, 33), (20, 29)]
    c.poly(mem, MEM)
    c.poly([(19, 25), (15, 9), (11, 14), (7, 22), (9, 27), (12, 26), (15, 29)], MEM2)
    for a, b in (((20, 25), (15, 5)), ((15, 5), (2, 28)), ((15, 5), (9, 33)), ((15, 5), (16, 33))):
        c.line(a[0], a[1], b[0], b[1], BONE)
    # 꼬리
    for k in range(14):
        c.P(5 - k // 4, 26 + k, TB2); c.P(6 - k // 4, 26 + k, TB)
    c.R(0, 38, 3, 3, TB2)
    # 다리 (먼 쪽은 어둡게)
    def leg(x, ph_off, far, hind):
        top = 33
        lift = [0, 3, 0, 1][(ph + ph_off) % 4] if ph else 0
        bot = 46 - lift
        col = TBN if far else TB2
        for y in range(top, bot + 1):
            sh = 0
            if hind:
                sh = -1 if 8 < y - top < 13 else 0
            w = 2 if (y - top) % 6 else 3
            c.R(x + sh, y, w, 1, col)
        c.R(x - 1, bot - 1, 4, 2, TBN)
    leg(8, 0, True, True); leg(26, 2, True, False)
    # 몸통
    c.ellipse(18, 30, 13, 7, TB)
    c.ellipse(9, 29, 6, 7, TB)                      # 엉덩이
    c.ellipse(19, 28, 11, 4, TB2)                   # 윗면 빛
    for k, x in enumerate((13, 17, 21, 25)):
        c.VL(x, 28, 8, TB3); c.VL(x + 1, 29, 7, TBN)    # 늑골
    c.HL(8, 22, 18, TB3)                            # 척추능선
    leg(12, 2, False, True); leg(30, 0, False, False)
    # 목
    c.poly([(27, 25), (30, 14), (37, 13), (35, 31), (29, 33)], TB)
    c.poly([(29, 24), (31, 16), (35, 15), (33, 27)], TB2)
    # 머리
    c.poly([(33, 11), (38, 9), (42, 14), (47, 21), (47, 26), (43, 28), (38, 23), (34, 20)], TB)
    c.poly([(36, 11), (40, 11), (43, 16), (45, 20)], TB2)
    c.poly([(33, 10), (33, 4), (36, 9)], TB); c.P(34, 7, MEM2)       # 귀
    c.R(38, 14, 3, 2, WHITE); c.P(39, 15, TBN)                         # 흰 눈
    c.P(45, 24, TBN); c.HL(41, 26, 4, TBN)                             # 콧구멍·입
    for yy in range(15, 30, 3): c.P(29 - (yy // 3) % 2, yy, TB3)       # 갈기
    c.outline()


def _th_piece_down(wing='fold', harness=False, body=True):
    def fn(c):
        th_front(c, wing=wing, harness=harness, body=body)
    return fn


def _th_stand(d):
    def fn(c):
        if d == 'down': th_front(c)
        elif d == 'up': th_front(c, back=True)
        else:
            t = Cv(48, 48); th_side(t)
            c.blit(t if d == 'right' else t.flip_h(), 0, 0)
    return fn


TH_COMMON = dict(family='creatures', space='carriage', role='prop')
WALK_FRONT = ['CSC', 'SSS', 'SSS']
for _d, _nm, _walk in (('down', '아래', WALK_FRONT), ('up', '위', WALK_FRONT), ('right', '오른쪽', ['CCS', 'SSS', 'SSS']), ('left', '왼쪽', ['SCC', 'SSS', 'SSS'])):
    REG.piece(f'wz-cre-thestral-{_d}', f'세스트랄 서 있음 ({_nm})', 3, 3, _walk,
              desc=f'세스트랄이 {_nm}쪽을 보고 서 있는 모습. 드러난 늑골·흰 눈·박쥐 날개.', tags=['세스트랄', '마차'],
              **TH_COMMON)(_th_stand(_d))

def _unseen_walk():
    t = Cv(48, 48); th_front(t, harness=True, body=False)
    rows = []
    for r in range(3):
        row = ''
        for q in range(3):
            row += 'C' if t.a[r*16:r*16+16, q*16:q*16+16, 3].any() else '.'
        rows.append(row)
    return rows


REG.piece('wz-cre-thestral-wings', '세스트랄 날개 펼침', 3, 3, ['CSC', 'CSC', 'CSC'],
          desc='세스트랄이 아래를 보며 날개를 활짝 편 모습. 날개 끝 칸은 위층 C.', tags=['세스트랄', '날개'], **TH_COMMON)(_th_piece_down('spread'))
REG.piece('wz-cre-thestral-harness', '세스트랄 마구 착용', 3, 3, WALK_FRONT,
          desc='가죽 띠·칼라·견인봉 고리를 단 세스트랄(아래). 비가시 상태와 짝.', tags=['세스트랄', '마구', '마차'],
          states='thestral-visibility', **TH_COMMON)(_th_piece_down('fold', True))
REG.piece('wz-cre-thestral-harness-unseen', '세스트랄 마구 (보이지 않음)', 3, 3, _unseen_walk(),
          desc='세스트랄이 보이지 않는 사람 눈에는 마구만 공중에 떠 있다. 마구 착용과 같은 크기·같은 자리.', tags=['세스트랄', '마구', '비가시'],
          states='thestral-visibility', **TH_COMMON)(_th_piece_down('fold', True, False))


def _th_walk(c, f):
    th_front(c, ph=f, bob=(1 if f % 2 == 1 else 0) * 0)


REG.piece('wz-cre-thestral-walk', '세스트랄 걷기 (아래)', 3, 3, WALK_FRONT,
          desc='세스트랄이 아래를 향해 걷는 4프레임. 다리가 엇갈린다.', tags=['세스트랄', '걷기'], frames=4, fps=6, repeat=True, **TH_COMMON)(_th_walk)


# ───────────────────────── 맨드레이크 ─────────────────────────
MR, MR2, MR3, MRW = C('linen', 2), C('linen', 1), C('linen', 3), C('dirt', 3)
LF, LF2, LF3 = C('leaf', 3), C('leaf', 2), C('leaf', 4)
MOUTH, TONGUE = INK, C('red', 2)


def _leaves(c, cx, ty, f, view):
    """머리 위 잎다발: 가운데 큰 잎 + 양옆 잎. 꿈틀(f)에 따라 기운다."""
    sw = (-1, 0, 1)[f]
    c.poly([(cx + sw, ty - 6), (cx + 2 + sw, ty - 1), (cx + sw, ty + 1), (cx - 2 + sw, ty - 1)], LF)
    c.VL(cx + sw, ty - 4, 5, LF2); c.P(cx + sw - 1, ty - 2, LF3)
    c.poly([(cx - 6 - sw, ty - 3), (cx - 1, ty), (cx - 1, ty + 1), (cx - 5, ty + 1)], LF2)
    c.poly([(cx + 6 + sw, ty - 3), (cx + 1, ty), (cx + 1, ty + 1), (cx + 5, ty + 1)], LF)
    c.P(cx - 5 - sw, ty - 1, LF3)


@REG.character('wz-cre-mandrake', '맨드레이크', 'greenhouse',
               '작은 뿌리 몸에 머리 위 잎다발을 인 맨드레이크. 주름진 얼굴로 비명을 지르며 걷는 대신 꿈틀거린다(3프레임).',
               tags=['맨드레이크', '온실', '식물'], family='creatures')
def _mandrake(c, d, f):
    sw = (-1, 0, 1)[f]
    cx = 12 + sw
    # 뿌리 다리(꿈틀: 벌어짐이 프레임마다 다름)
    spread = (3, 1, 3)[f]
    for s in (-1, 1):
        x0 = 12 + s * 2
        c.R(x0 - 1 if s < 0 else x0, 26, 2, 4, MR2)
        c.R(x0 + s * (spread // 2) - (1 if s < 0 else 0), 29, 2, 2, MR2)
        c.P(12 + s * (spread + 1), 31, MRW)
    c.P(12, 31, MRW)
    # 몸통(뿌리)
    c.ellipse(12 + sw * 0.5, 23, 4.5, 4.5, MR)
    c.ellipse(13 + sw * 0.5, 24, 3, 3.5, MR2)
    c.P(10, 22, MR3)
    # 팔
    a = (-2, 0, 2)[f]
    c.R(6, 21 + a // 2, 2, 3, MR); c.R(16, 21 - a // 2, 2, 3, MR2)
    c.P(5, 24 + a // 2, MR2); c.P(18, 24 - a // 2, MR2)
    # 머리
    c.ellipse(cx, 14, 6, 5.5, MR)
    c.ellipse(cx + 1, 15, 4.5, 4, MR2)
    c.ellipse(cx - 1.5, 12, 2.5, 1.5, MR3)
    if d == 'up':
        c.R(cx - 3, 12, 6, 1, MRW); c.R(cx - 2, 15, 5, 1, MRW); c.R(cx - 1, 18, 3, 1, MRW)
        c.ellipse(cx, 13, 3, 2, MR)
    elif d == 'down':
        c.R(cx - 4, 11, 2, 1, MRW); c.R(cx + 2, 11, 2, 1, MRW)           # 이마 주름
        c.R(cx - 3, 13, 2, 1, INK); c.R(cx + 1, 13, 2, 1, INK)             # 찡그린 눈
        c.P(cx - 2, 12, MRW); c.P(cx + 2, 12, MRW)
        c.ellipse(cx, 17, 2.5, 3, MOUTH)                                   # 비명 입
        c.R(cx - 1, 18, 2, 2, TONGUE)
        c.P(cx - 5, 16, MRW); c.P(cx + 4, 16, MRW)
    else:
        sgn = 1 if d == 'right' else -1
        ex = cx + sgn * 2
        c.R(ex - (1 if sgn < 0 else 0), 13, 2, 1, INK)
        c.R(cx + sgn * 3 - (1 if sgn < 0 else 0), 11, 2, 1, MRW)
        c.ellipse(cx + sgn * 4, 17, 2, 2.5, MOUTH)
        c.P(cx + sgn * 4, 18, TONGUE)
        c.P(cx - sgn * 3, 14, MRW)
    _leaves(c, cx, 9, f, d)
    c.outline()


# ───────────────────────── 초콜릿 개구리 ─────────────────────────
CH0, CH1, CH2, CH3, CH4 = C('choc', 0), C('choc', 1), C('choc', 2), C('choc', 3), C('choc', 4)
GLOSS = C('linen', 3)


def _tl(c, x0, y0, x1, y1, col, w=2, vert=False):
    """굵은 선(가로 w줄 또는 세로 w줄 평행 복사)."""
    for k in range(w):
        c.line(x0 + (0 if vert else 0), y0 + k, x1, y1 + k, col) if not vert else c.line(x0 + k, y0, x1 + k, y1, col)


def _eye(c, x, y, sg, d):
    """솟은 눈: 밝은 테 + 검은 눈동자 + 반짝임."""
    c.ellipse(x, y, 2.4, 2.4, CH4)
    c.R(x - 1, y - 1, 3, 3, CH4)
    if d == 'up':
        c.R(x - 1, y - 1, 3, 2, INK); c.P(x - 1 + (1 if sg < 0 else 0), y - 1, GLOSS)   # 뒤에서도 눈이 보인다
    if d != 'up':
        c.R(x - (1 if sg < 0 else 0), y, 2, 2, INK)
        c.P(x - (1 if sg < 0 else 0), y, INK); c.P(x + sg - (1 if sg < 0 else 0), y - 1, GLOSS)
    c.HL(x - 2, y + 2, 5, CH2)       # 아래 눈꺼풀


def frog(c, cx, by, pose, d='down', s=1.0):
    """초콜릿 개구리. pose: crouch | leap. by = 발바닥 y. 낮고 넓은 몸 + 머리 위 불거진 두 눈 + 굵게 접힌 뒷다리·물갈퀴 발 + 넓은 입."""
    leap = pose == 'leap'
    if d in ('down', 'up'):
        top = by - (9 if leap else 6)
        # 뒷다리 (굵은 허벅지 + 옆으로 벌어진 물갈퀴 발)
        for sg in (-1, 1):
            if leap:
                c.poly([(cx + sg * 4, top - 3), (cx + sg * 9, top + 1), (cx + sg * 11, by - 3), (cx + sg * 10, by - 1), (cx + sg * 6, by - 2), (cx + sg * 7, top + 4), (cx + sg * 4, top + 3)], CH2)
                c.poly([(cx + sg * 5, top - 2), (cx + sg * 8, top), (cx + sg * 8, top + 3), (cx + sg * 5, top + 2)], CH3)
                fx = cx + sg * 9
            else:
                c.ellipse(cx + sg * 7, by - 4, 3.6, 4.2, CH2)
                c.ellipse(cx + sg * 7 - sg * 0.5, by - 5, 2, 2.4, CH3)
                fx = cx + sg * 8
            xs = fx - 3 if sg > 0 else fx - 2
            c.R(xs, by - 1, 6, 1, CH2)                                      # 물갈퀴 막
            for k in (0, 2, 4): c.P(xs + k, by, CH1)                        # 발가락 셋
        # 몸통 + 머리 한 덩이 (낮고 넓게)
        if leap:
            c.ellipse(cx, by - 8, 7.5, 5.5, CH2); c.ellipse(cx, by - 9, 7, 5, CH3); c.ellipse(cx - 2, by - 11, 3.5, 2, CH4)
        else:
            c.ellipse(cx, by - 4.5, 8.5, 4.2, CH2); c.ellipse(cx, by - 5.5, 8, 3.8, CH3); c.ellipse(cx - 2, by - 7, 4, 1.6, CH4)
        my = by - (9 if leap else 5)
        ey = my - (5 if leap else 4)
        for sg in (-1, 1):
            _eye(c, cx + sg * 4, ey, sg, d)
        if d == 'down':
            c.HL(cx - 6, my, 12, CH1); c.P(cx - 7, my - 1, CH1); c.P(cx + 6, my - 1, CH1)      # 넓은 입
            c.P(cx - 1, my - 2, CH1); c.P(cx, my - 2, CH1)                                      # 콧구멍
            for sg in (-1, 1):
                c.R(cx + sg * 4 - (1 if sg < 0 else 0) - (0), by - 3 if not leap else by - 5, 2, 3 if not leap else 3, CH2)
        else:
            c.VL(cx, my - 3, 6, CH2); c.VL(cx - 1, my - 2, 5, CH4)                             # 등줄
    else:
        sg = 1 if d == 'right' else -1
        def X(dx): return cx + sg * dx
        def Rm(dx, y, w, h, col): c.R(X(dx) if sg > 0 else X(dx) - w + 1, y, w, h, col)
        def Em(dx, y, rx, ry, col): c.ellipse(X(dx), y, rx, ry, col)
        if leap:
            # 뒤로 쭉 뻗은 굵은 뒷다리 + 물갈퀴 발
            for k in range(3): c.line(X(-3), by - 8 + k, X(-10), by - 2 + k, CH2)
            Rm(-13, by - 1, 5, 1, CH2)
            for k in (-13, -11, -9): c.P(X(k), by, CH1)
            for k in range(2): c.line(X(5), by - 6 + k, X(10), by - 3 + k, CH2)        # 앞다리 앞으로
            Rm(9, by - 3, 3, 1, CH2)
            Em(-1, by - 9, 7, 3.4, CH2); Em(-1, by - 10, 6.5, 3, CH3); Em(-3, by - 11, 3.5, 1.4, CH4)
            Em(5, by - 9, 3.8, 3, CH3)
            Em(-4, by - 8, 3.4, 3, CH2); Em(-4, by - 9, 2, 1.6, CH3)                    # 허벅지
            my, ex = by - 8, 4
        else:
            Em(-1, by - 4, 8, 4, CH2); Em(-1, by - 5, 7.5, 3.6, CH3); Em(-3, by - 7, 4, 1.4, CH4)
            Em(5, by - 5, 4, 3, CH3)
            Em(-3, by - 3, 4.2, 3.4, CH2); Em(-3, by - 4, 2.4, 1.8, CH3)               # 굵게 접힌 허벅지
            Rm(-9, by - 1, 7, 1, CH2)                                                  # 정강이 + 발
            for k in (-10, -8, -6): c.P(X(k), by, CH1)
            Rm(5, by - 3, 2, 3, CH2); Rm(6, by - 1, 3, 1, CH1)                         # 앞다리
            my, ex = by - 4, 4
        _eye(c, X(ex), my - 5, sg, d)
        Rm(2, my, 8, 1, CH1); c.P(X(9), my - 1, CH1)                                    # 넓은 입 끝이 올라감


@REG.character('wz-cre-frog', '초콜릿 개구리', 'honeydukes',
               '반질한 갈색 초콜릿 개구리. 프레임 0·2 는 도약, 1 은 웅크림.', tags=['초콜릿 개구리', '허니듀크', '과자'], family='creatures')
def _frog_char(c, d, f):
    if f == 1:
        frog(c, 12, 31, 'crouch', d)
    else:
        frog(c, 12, 26 if f == 0 else 22, 'leap', d)
        c.R(9, 31, 6, 1, CH1)           # 도약 중 바닥 그림자
        c.outline()
        return
    c.outline()


def _frog_pkg(c):
    # 오각 상자: 앞면 + 열린 뚜껑
    c.poly([(8, 3), (15, 7), (13, 15), (3, 15), (1, 7)], C('red', 3))
    c.poly([(8, 5), (13, 8), (12, 14), (4, 14), (3, 8)], C('red', 2))
    for (a, b) in (((8, 3), (15, 7)), ((15, 7), (13, 15)), ((13, 15), (3, 15)), ((3, 15), (1, 7)), ((1, 7), (8, 3))):
        c.line(a[0], a[1], b[0], b[1], C('brass', 4))
    # 열린 입구(어두운 속) + 개구리
    c.poly([(8, 5), (12, 7), (12, 9), (4, 9), (4, 7)], INK2)
    c.ellipse(8, 8, 3, 2, CH3); c.P(7, 7, CH4)
    c.P(6, 5, CH4); c.P(10, 5, CH4); c.P(6, 5, INK); c.P(10, 5, INK)
    c.R(6, 8, 4, 1, CH2)
    # 열린 뚜껑(왼쪽 위로 젖혀짐)
    c.poly([(1, 7), (8, 3), (6, 1), (0, 4)], C('red', 4))
    c.line(0, 4, 6, 1, C('brass', 5))
    c.R(6, 11, 4, 2, C('brass', 4)); c.P(7, 12, C('red', 1))
    c.outline()


REG.piece('wz-cre-frog-pack', '초콜릿 개구리 포장', 1, 1, ['f'],
          'creatures', 'honeydukes', '뚜껑이 열린 오각 포장 상자 안에서 초콜릿 개구리가 고개를 내민다.',
          tags=['초콜릿 개구리', '포장', '과자'], role='prop')(_frog_pkg)


def _frog_leap(c, f):
    """16px 한 칸 도약. 낮고 넓은 몸·머리 위 불거진 눈·굵게 접힌(또는 쭉 뻗은) 뒷다리 물갈퀴·넓은 입."""
    cy = (11, 9, 6, 10)[f]            # 몸통 중심 y
    stretch = (0, 1, 2, 1)[f]         # 0 웅크림, 1 도약 중, 2 정점
    # 뒷다리 (몸 뒤쪽 = 왼쪽)
    if stretch == 0:
        c.ellipse(4, cy + 0.5, 3, 2.5, CH2); c.ellipse(4, cy - 0.5, 2, 1.5, CH3)   # 굵게 접힌 허벅지
        c.R(1, cy + 2, 6, 1, CH2)                                                # 정강이+물갈퀴 발
        for x in (1, 3, 5): c.P(x, cy + 3, CH1)
    else:
        n = 3 if stretch == 2 else 2
        fx, fy = (0, cy + 6) if stretch == 2 else (1, cy + 4)
        for k in range(3): c.line(5, cy + k - 1, fx + 1, fy + k - 2, CH2)       # 굵은 허벅지~정강이
        c.ellipse(5, cy, 2.5, 2, CH3)
        c.R(fx - 1, fy, 4, 1, CH2)                                              # 물갈퀴 발
        for x in (fx - 1, fx + 1, fx + 3): c.P(x, fy + 1, CH1)
    # 몸통 (납작)
    c.ellipse(8, cy + 0.5, 5.5, 2.8, CH2); c.ellipse(8, cy, 5, 2.4, CH3)
    c.R(6, cy - 2, 4, 1, CH4)
    # 머리 + 불거진 눈 + 넓은 입
    c.ellipse(11.5, cy, 3, 2.3, CH3)
    c.R(10, cy - 5, 3, 3, CH4); c.R(12, cy - 4, 1, 2, INK); c.P(10, cy - 5, GLOSS); c.HL(10, cy - 2, 3, CH2)
    c.HL(10, cy + 1, 5, CH1); c.P(14, cy, CH1)
    # 앞다리
    if stretch == 0: c.R(11, cy + 2, 2, 2, CH2); c.R(12, cy + 3, 3, 1, CH2)
    else: c.line(12, cy + 1, 14, cy + 3, CH2); c.line(12, cy + 2, 14, cy + 4, CH2)
    if stretch: c.R(5, 15, 6, 1, CH1)                                           # 땅 그림자
    c.outline()


REG.piece('wz-cre-frog-leap', '초콜릿 개구리 도약', 1, 1, ['C'],
          'creatures', 'honeydukes', '웅크렸다가 뛰어올라 착지하는 4프레임.',
          tags=['초콜릿 개구리', '도약'], role='prop', frames=4, fps=6, repeat=True)(_frog_leap)

if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
