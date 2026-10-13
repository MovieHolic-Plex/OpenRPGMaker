"""일체형 1층 가게 정면(문 + 1층 블록을 한 장으로 그림) — street_hand 가 register(prop) 로 등록한다.
왜: 건물 조립기의 1층 띠와 문 부착물을 따로 그리면 문이 스티커처럼 붙는다(2026-10-12 사용자 지적).
이 키트는 폭 W칸 × 3칸(48px) 한 장에 간판띠·차양·창·문틀·문짝·발판을 같은 팔레트·같은 윤곽으로 그린다.
문은 정확히 2칸 폭(dc 번째 칸부터). 막힘: 아래 두 줄 전부(문 포함), 윗줄(간판·차양)은 뒤로 지나감(star).
id: sf-<role>-<W>-<L|R>   (L = 문이 왼쪽, R = 문이 오른쪽). 구성은 composer 가 같은 id 를 만든다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
sys.path.insert(0, HERE)
from house_kit import K, OL            # noqa: E402
import shop_parts as SP                 # noqa: E402

H = 48
ROLES = ('konbini', 'izakaya', 'ramen', 'cafe', 'shop', 'bento', 'office', 'apartment', 'house', 'machiya', 'sento')
WIDTHS = tuple(range(3, 10))


def door_col(W, side):
    """문 왼쪽 칸 번호."""
    if W <= 3: return 0 if side == 'L' else 1
    return 1 if side == 'L' else W - 3


# ───────────────────────── 공통 조각 ─────────────────────────
def wall(c, W, ramp, base, tex=None):
    c.R(0, 0, W * 16, H, K(ramp, base))
    if tex == 'plank':                                    # 세로 판자 결
        for x in range(3, W * 16, 6): c.VL(x, 20, 28, K(ramp, base - 1))
    elif tex == 'tile':
        for y in range(22, H, 6):
            c.HL(0, y, W * 16, K(ramp, base - 1))
    elif tex == 'plaster':
        for x in range(5, W * 16, 9):
            c.P(x, 26 + (x % 5) * 3, K(ramp, base - 1)); c.P(x + 2, 22 + (x % 7) * 3, K(ramp, base + 1))
    c.VL(0, 0, H, K(ramp, base + 1))                      # 왼쪽 빛


def eave_dark(c, W, ramp, base):
    """위층 처마 밑 그늘 2줄 — 위층과 이어지게."""
    c.HL(0, 0, W * 16, K(ramp, base - 3)); c.HL(0, 1, W * 16, K(ramp, base - 2))


def fascia(c, W, ramp, shade=0, stripe=None, tile=False):
    """간판띠: 위층 벽 밑으로 튀어나온 庇(차양 지붕) 윗면(y 1~7: 기와/콘크리트 결 7줄, 뒷모서리 OL, 안쪽 홈, 앞 모서리 어두운 줄 y 8) → 간판 앞면 y 9~23.
    3/4 관문(2026-10-13): 정면 입면만 있으면 윗면 0행으로 떨어진다. stripe=((ramp,t),...) 이면 앞면 가로 줄무늬(편의점)."""
    w = W * 16
    roof = 'tairu' if tile else 'conc'
    c.HL(0, 0, w, OL)
    if tile:
        c.R(0, 1, w, 7, K(roof, 2))
        for r in range(7):                               # 기와 줄(가로) + 엇갈린 세로 이음
            if r % 2 == 1: c.HL(0, 1 + r, w, K(roof, 0))
            for x in range((r % 2) * 3, w, 6): c.VL(x, 1 + r, 1, K(roof, -1))
        c.HL(0, 2, w, K(roof, 3))
        c.HL(0, 8, w, K(roof, -3))                        # 앞 모서리(어두운 줄)
    else:                                                # 평지붕 윗면: 뒤 난간(밝은 턱+그늘) → 자갈/방수 바닥(아래로 갈수록 밝음) → 앞 난간 윗면
        c.HL(0, 1, w, K(roof, 4)); c.HL(0, 2, w, K(roof, -2))
        for r, t in enumerate((-1, -1, 0, 0, 1)):
            c.HL(0, 3 + r, w, K(roof, t))
        for x in range(w):
            h = (x * 7 + 3) % 11
            if h == 0: c.P(x, 3 + (x % 5), K(roof, 3))
            elif h == 5: c.P(x, 3 + ((x * 3) % 5), K(roof, -3))
        c.HL(0, 8, w, K(roof, 5))                         # 앞 난간 윗면 밝은 모서리
    c.R(0, 9, w, 15, K(ramp, shade))
    c.HL(0, 9, w, K(ramp, shade - 2)); c.HL(0, 22, w, K(ramp, shade - 2)); c.HL(0, 23, w, K(ramp, shade - 3))
    if stripe:
        for k, col in enumerate(stripe): c.HL(0, 12 + k * 3, w, K(*col)); c.HL(0, 13 + k * 3, w, K(*col))


def fascia_ext(c, W, ramp, shade=0):
    """창 윗틀(y 22~23)을 간판 앞면 아랫단이 덮는다(창 그리기 뒤에 호출)."""
    w = W * 16
    c.R(0, 22, w, 2, K(ramp, shade)); c.HL(0, 22, w, K(ramp, shade - 2)); c.HL(0, 23, w, K(ramp, shade - 3))


def piers(c, W, ramp, base):
    c.R(0, 20, 3, 28, K(ramp, base + 1)); c.VL(2, 20, 28, K(ramp, base - 1))
    c.R(W * 16 - 3, 20, 3, 28, K(ramp, base - 1)); c.VL(W * 16 - 1, 20, 28, K(ramp, base - 2))


def plinth(c, x, w, ramp, t):
    """창 밑 허리벽 y 42~47."""
    c.R(x, 42, w, 6, K(ramp, t)); c.HL(x, 42, w, K(ramp, t + 2)); c.HL(x, 47, w, K(ramp, t - 2))
    for i in range(x + 4, x + w, 8): c.VL(i, 43, 4, K(ramp, t - 1))


def sign_text(c, W, dc, s, col, side):
    """간판띠 글자: 문이 아닌 창 칸들 가운데(문은 간판띠 밑까지 올라온다). 자리가 모자라면 글자 간격을 줄이고, 그래도 안 되면 생략."""
    if not s: return
    cells = [i for i in range(W) if not (dc <= i < dc + 2)]
    if not cells: return
    runs, cur = [], [cells[0]]
    for i in cells[1:]:
        if i == cur[-1] + 1: cur.append(i)
        else: runs.append(cur); cur = [i]
    runs.append(cur)
    run = max(runs, key=len)
    x0, x1 = run[0] * 16 + 2, (run[-1] + 1) * 16 - 2
    for step in (17, 16, 15):
        tw = SP.text_w(s, step)
        if tw <= x1 - x0:
            SP.text(c, x0 + (x1 - x0 - tw) // 2, 8, s, col, step); return


# ───────────────────────── 창 ─────────────────────────
def mullion(c, x):
    c.VL(x, 22, 20, K('tekko', -1)); c.VL(x + 1, 22, 20, K('tekko', 1))


def win_glass(c, x, kind='glass', goods='mart', seed=0, tint=('garasu', 0)):
    """창 한 칸(16px): 틀 → 유리 → 속 물건. y 22~41."""
    c.R(x, 22, 16, 20, K('tekko', -1))
    c.R(x + 1, 24, 14, 16, K(*tint)); c.R(x + 1, 24, 14, 2, K(tint[0], tint[1] - 1))
    if kind == 'glass':
        for k in range(5): c.P(x + 3 + k * 2, 36 - k, K('garasu', 2))
        c.HL(x + 1, 28, 14, K('garasu', 1))
    elif kind == 'goods':
        cols = SP.GOODS[goods]
        c.HL(x + 1, 33, 14, K('ita', -1)); c.HL(x + 1, 34, 14, K('ita', -2))                      # 진열대 판
        for k in range(4):
            col = cols[(seed + k) % len(cols)]
            c.R(x + 2 + k * 3 + (k // 2), 28 + (k * 5 + seed) % 3, 3, 33 - (28 + (k * 5 + seed) % 3), K(*col))
            c.P(x + 2 + k * 3 + (k // 2), 28 + (k * 5 + seed) % 3, K(col[0], col[1] + 2))
        c.HL(x + 1, 38, 14, K('ita', -1))
    elif kind == 'shelf':
        for yy in (29, 35):
            c.HL(x + 1, yy, 14, K('shiro', 0)); c.HL(x + 1, yy + 1, 14, K('tekko', 0))
            for k in range(7):
                col = SP.GOODS['mart'][(seed + k) % 6]
                c.R(x + 2 + k * 2, yy - 3, 2, 3, K(*col))
    elif kind == 'curtain':
        c.R(x + 1, 24, 14, 6, K('shiro', 1)); c.HL(x + 1, 30, 14, K('shiro', -1))
        for k in range(0, 14, 3): c.VL(x + 1 + k, 24, 6, K('shiro', 2))
        c.R(x + 5, 35, 6, 5, K('daidai', 0)); c.R(x + 6, 31, 4, 4, K('midori', 0)); c.P(x + 8, 30, K('midori', 2))     # 화분
    elif kind == 'steam':
        c.R(x + 1, 24, 14, 16, K('kii', 1)); c.R(x + 1, 24, 14, 3, K('kii', 0))
        c.R(x + 3, 33, 10, 5, K('shiro', 1)); c.HL(x + 3, 33, 10, K('shiro', 2)); c.P(x + 6, 31, K('shiro', 2)); c.P(x + 9, 30, K('shiro', 2))   # 그릇·김
    elif kind == 'lobby':
        c.R(x + 1, 24, 14, 16, K('garasu', -1)); c.HL(x + 1, 24, 14, K('garasu', 1)); c.VL(x + 1, 24, 16, K('garasu', 1))
        for k in range(4): c.P(x + 4 + k * 2, 34 - k, K('garasu', 2))
    elif kind == 'mailbox':
        c.R(x + 1, 24, 14, 16, K('tekko', 0))
        for r in range(3):
            for k in range(3): c.R(x + 2 + k * 4, 26 + r * 4, 3, 3, K('tekko', 2)); c.P(x + 3 + k * 4, 27 + r * 4, K('kii', 1))
    c.HL(x, 41, 16, K('conc', 2))                                                                  # 창턱


def win_lattice(c, x, glow=('kii', 1), wood=('ita', -2)):
    """격자창(코시): 따뜻한 종이 빛 + 가는 격자."""
    c.R(x, 22, 16, 20, K(*wood)); c.R(x + 2, 24, 12, 16, K(*glow))
    c.R(x + 2, 24, 12, 2, K(glow[0], glow[1] - 1))
    for k in range(2, 14, 3): c.VL(x + k, 24, 16, K(*wood))
    for yy in (28, 32, 36): c.HL(x + 2, yy, 12, K(*wood))
    c.HL(x, 41, 16, K('ita', 1))


# ───────────────────────── 차양·노렌·등 ─────────────────────────
def awning(c, W, col, y=22, scallop=True, skip=None):
    """차양(3/4 윗면 + 앞 + 물결 끝). 줄무늬는 칸마다 같다(2칸 주기)."""
    x0 = 0
    for i in range(W * 16):
        if skip and skip[0] <= i < skip[1]: continue
        st = (i // 8) % 2
        for j in range(5): c.P(i, y + j, K(col, 2 if st else 1))
        for j in range(3): c.P(i, y + 5 + j, K(col, 0 if st else -1))
        if scallop and i % 8 in (3, 4): c.P(i, y + 8, K(col, -2))
        elif scallop: c.P(i, y + 8, OL)
        if scallop and i % 8 in (3, 4): c.P(i, y + 9, OL)
    for i in range(W * 16):
        if not (skip and skip[0] <= i < skip[1]): c.P(i, y - 1, OL)


def noren(c, x, w, col='kon', crest=True, y=19, h=14, split=True):
    """노렌: 문 위 가로 천(중간 세로 트임) + 흰 문장."""
    c.R(x, y, w, h, K(col, 0)); c.HL(x, y, w, K(col, 2)); c.HL(x, y + h - 1, w, K(col, -2)); c.HL(x, y - 1, w, K('ita', -2))
    if split: c.VL(x + w // 2, y + 1, h - 1, K(col, -2))
    for xx in range(x, x + w, 2): c.P(xx, y, K('ita', 0))
    if crest:
        for cx in (x + w // 4, x + 3 * w // 4):
            c.R(cx - 2, y + 4, 5, 5, K('shiro', 2)); c.P(cx, y + 6, K(col, 0)); c.P(cx - 1, y + 5, K(col, 1)); c.P(cx + 1, y + 7, K(col, 1))
    c.VL(x - 1, y - 1, h + 1, OL); c.VL(x + w, y - 1, h + 1, OL)


def lantern(c, x, y, col='aka'):
    c.R(x, y, 6, 8, K(col, 1)); c.HL(x, y, 6, K('sumi', 1)); c.HL(x, y + 7, 6, K('sumi', 1)); c.VL(x, y + 1, 6, K(col, 2)); c.VL(x + 5, y + 1, 6, K(col, -1))
    c.R(x + 2, y + 2, 2, 3, K('kii', 3)); c.VL(x + 2, y - 2, 2, OL)


# ───────────────────────── 문 ─────────────────────────
# 문 높이 36px(y 12~47): 캐릭터(Actor1 24x32)보다 머리 위 4px 높다. 간판띠는 문 위에서 y 10 까지만 내려오고 문틀이 그 밑을 먹는다.
T = 12


def door_head(c, x0, col):
    """문 위 보: 간판띠 앞면이 문 위까지 내려오므로 문틀 윗선만 긋는다."""
    c.HL(x0 - 1, 11, 34, K(col[0], col[1] - 3)); c.HL(x0 - 1, 12, 34, OL)


def threshold(c, x0, frame='conc'):
    c.R(x0, 45, 32, 3, K(frame, 1)); c.HL(x0, 45, 32, K(frame, 3)); c.HL(x0, 47, 32, K(frame, -2))


def door_auto(c, x0, frame=('tekko', 1), glass=('garasu', 0)):
    """자동문(편의점·사무소): 철 틀 + 양쪽 큰 유리 + 가운데 틈, 손잡이 막대, 위 센서 상자, 바닥 매트."""
    c.R(x0 + 1, T, 30, 36, K(*frame)); c.HL(x0 + 1, T, 30, K(frame[0], frame[1] + 1))
    for part in (x0 + 3, x0 + 17):
        c.R(part, T + 5, 12, 30, K(*glass)); c.R(part, T + 5, 12, 3, K(glass[0], glass[1] - 1))
        for k in range(5): c.P(part + 2 + k * 2, T + 24 - k, K('garasu', 2))
    c.VL(x0 + 15, T + 3, 33, K('tekko', -2)); c.VL(x0 + 16, T + 3, 33, K('tekko', -2))
    c.VL(x0 + 13, T + 18, 8, K('shiro', 2)); c.VL(x0 + 18, T + 18, 8, K('shiro', 2))
    c.R(x0 + 10, T + 1, 12, 3, K('shiro', 1)); c.P(x0 + 16, T + 2, K('aka', 1))
    c.R(x0 + 4, 43, 24, 2, K('kon', -1))
    c.VL(x0, T, 36, OL); c.VL(x0 + 31, T, 36, OL)


def door_wood(c, x0, wood='ita', glass=True, sign='OPEN'):
    """목재 유리문(카페·상점): 틀, 위 큰 유리 + 아래 판, 놋쇠 손잡이, 영업 팻말."""
    c.R(x0 + 1, T, 30, 36, K(wood, -1)); c.R(x0 + 3, T + 2, 26, 32, K(wood, 0)); c.VL(x0 + 3, T + 2, 32, K(wood, 1))
    if glass:
        c.R(x0 + 6, T + 5, 20, 17, K('garasu', 0)); c.R(x0 + 6, T + 5, 20, 3, K('garasu', -1)); c.HL(x0 + 6, T + 21, 20, K('garasu', 1))
        for k in range(5): c.P(x0 + 9 + k * 2, T + 19 - k, K('garasu', 2))
        c.VL(x0 + 16, T + 5, 17, K(wood, -1))
    c.R(x0 + 6, T + 25, 20, 9, K(wood, -1)); c.HL(x0 + 6, T + 25, 20, K(wood, 1)); c.HL(x0 + 6, T + 33, 20, K(wood, -2))
    c.R(x0 + 24, T + 20, 2, 6, K('kii', 2)); c.P(x0 + 24, T + 20, K('kii', 3))
    if sign:
        c.R(x0 + 18, T + 8, 7, 4, K('aka', 1)); c.HL(x0 + 18, T + 8, 7, K('aka', 2))
        c.P(x0 + 19, T + 10, K('shiro', 2)); c.P(x0 + 21, T + 10, K('shiro', 2)); c.P(x0 + 23, T + 10, K('shiro', 2))
    c.VL(x0, T, 36, OL); c.VL(x0 + 31, T, 36, OL)


def door_lattice(c, x0, wood=('ita', -2), glow=('yuka', 2), n=2):
    """미닫이 격자문: 두 짝, 한지 빛, 가는 격자, 아래 판."""
    c.R(x0 + 1, T, 30, 36, K(*wood))
    for leaf in range(n):
        lx = x0 + 3 + leaf * 14
        c.R(lx, T + 2, 12, 32, K(wood[0], wood[1] + 1)); c.R(lx + 1, T + 3, 10, 24, K(*glow))
        for k in range(3, 10, 3): c.VL(lx + k, T + 3, 24, K(*wood))
        for yy in (T + 10, T + 18): c.HL(lx + 1, yy, 10, K(*wood))
        c.R(lx + 1, T + 28, 10, 5, K(wood[0], wood[1] + 2))
    c.R(x0 + 14, T + 20, 2, 7, K('kii', 2)); c.R(x0 + 16, T + 20, 2, 7, K('kii', 2))
    c.VL(x0, T, 36, OL); c.VL(x0 + 31, T, 36, OL)


def door_glass_red(c, x0, frame=('aka', -1)):
    """라멘집 미닫이 유리문: 붉은 틀 + 큰 유리 + 가로 손잡이."""
    c.R(x0 + 1, T, 30, 36, K(*frame))
    for part in (x0 + 3, x0 + 17):
        c.R(part, T + 4, 12, 31, K('garasu', 0)); c.R(part, T + 4, 12, 3, K('garasu', -1))
        for k in range(5): c.P(part + 2 + k * 2, T + 24 - k, K('garasu', 2))
    c.VL(x0 + 15, T + 3, 33, K(*frame)); c.VL(x0 + 16, T + 3, 33, K(frame[0], frame[1] + 1))
    c.R(x0 + 12, T + 20, 3, 2, K('shiro', 2)); c.R(x0 + 17, T + 20, 3, 2, K('shiro', 2))
    c.VL(x0, T, 36, OL); c.VL(x0 + 31, T, 36, OL)


def door_entry(c, x0):
    """맨션 현관: 오토락 문(짙은 유리) + 옆 인터폰 패널."""
    c.R(x0 + 1, T, 30, 36, K('tekko', 0)); c.R(x0 + 3, T + 4, 20, 31, K('garasu', -1)); c.R(x0 + 3, T + 4, 20, 3, K('garasu', -2))
    for k in range(6): c.P(x0 + 6 + k * 2, T + 24 - k, K('garasu', 1))
    c.VL(x0 + 13, T + 4, 31, K('tekko', -1)); c.R(x0 + 11, T + 18, 2, 8, K('shiro', 1)); c.R(x0 + 15, T + 18, 2, 8, K('shiro', 1))
    c.R(x0 + 25, T + 14, 5, 11, K('tekko', 2)); c.R(x0 + 26, T + 15, 3, 3, K('sora', 2)); c.P(x0 + 26, T + 20, K('kii', 2)); c.P(x0 + 28, T + 20, K('aka', 1)); c.P(x0 + 27, T + 22, K('midori', 2))
    c.VL(x0, T, 36, OL); c.VL(x0 + 31, T, 36, OL)


# ───────────────────────── 역할별 조립 ─────────────────────────
STYLES = {
    'konbini':  dict(wall=('shiro', 0), fascia=('shiro', 0), stripe=(('midori', 1), ('aka', 1), ('sora', 1)), win='shelf', door='auto', plinth=('tekko', 1), text=None),
    'izakaya':  dict(wall=('ita', -1), fascia=('ita', -2), win='lattice', door='lattice', plinth=('tekko', -1), text='居酒屋', textcol=('shiro', 2), noren='kon', lantern='aka'),
    'ramen':    dict(wall=('aka', -2), fascia=('aka', -1), win='steam', door='glass_red', plinth=('tekko', -1), text='ラーメン', textcol=('shiro', 2), noren='aka'),
    'cafe':     dict(wall=('renga', 0), fascia=('midori', -1), win='curtain', door='wood', plinth=('renga', -1), text='喫茶', textcol=('kinari', 2), awning='midori'),
    'shop':     dict(wall=('kinari', 0), fascia=('sora', 0), win='goods', door='wood', plinth=('conc', -1), text='商店', textcol=('shiro', 2), awning='daidai'),
    'bento':    dict(wall=('kinari', 1), fascia=('daidai', 0), win='goods', door='wood', plinth=('conc', -1), text='弁当', textcol=('shiro', 2), awning='shiro', goods='mart'),
    'office':   dict(wall=('conc', 0), fascia=('conc', -1), win='lobby', door='auto', plinth=('conc', -2), text=None, doorframe=('tekko', 2)),
    'apartment': dict(wall=('tairu', 0), fascia=('conc', 0), win='mailbox', door='entry', plinth=('conc', -2), text=None),
    'house':    dict(wall=('ita', 0), fascia=('tairu', -1), win='lattice', door='lattice', plinth=('conc', -1), text=None, tile=True),
    'machiya':  dict(wall=('ita', -2), fascia=('tairu', -2), win='lattice', door='lattice', plinth=('tekko', -1), text=None, tile=True, darkwood=True),
    'sento':    dict(wall=('shiro', -1), fascia=('shiro', 0), win='goods', door='lattice', plinth=('conc', -1), text='湯', textcol=('kon', 0), noren='kon', tile=True),
}


def draw(c, role, W, side):
    s = STYLES[role]
    dc = door_col(W, side)
    wr, wb = s['wall']
    wall(c, W, wr, wb, 'plank' if role in ('izakaya', 'house', 'machiya') else 'plaster' if role in ('konbini', 'shop', 'bento', 'sento') else None)
    fascia(c, W, *s['fascia'], stripe=s.get('stripe'), tile=bool(s.get('tile')))
    piers(c, W, wr, wb)
    for i in range(W):
        x = i * 16
        if dc <= i < dc + 2: continue
        win = s['win']
        if win == 'lattice': win_lattice(c, x, glow=('kii', 1) if role == 'izakaya' else ('yuka', 2), wood=('ita', -3) if s.get('darkwood') else ('ita', -2))
        else: win_glass(c, x, kind={'shelf': 'shelf', 'steam': 'steam', 'curtain': 'curtain', 'goods': 'goods', 'lobby': 'lobby', 'mailbox': 'mailbox'}[win], goods=s.get('goods', ('veg', 'fruit', 'bread', 'drug')[(i + W) % 4]), seed=i * 3 + W)
        if i > 0 and not (dc <= i - 1 < dc + 2): mullion(c, x)
        plinth(c, x, 16, *s['plinth'])
    fascia_ext(c, W, *s['fascia'])
    if s.get('text'): sign_text(c, W, dc, s['text'], K(*s['textcol']), side)
    x0 = dc * 16
    c.R(x0, 42, 32, 6, K(*s['plinth']))                      # 문 밑은 발판이 덮는다
    d = s['door']
    if d == 'auto': door_auto(c, x0, frame=s.get('doorframe', ('tekko', 1)))
    elif d == 'wood': door_wood(c, x0, wood='ita', sign='OPEN' if role == 'cafe' else None)
    elif d == 'lattice': door_lattice(c, x0, wood=('ita', -3) if s.get('darkwood') else ('ita', -2), glow=('kii', 1) if role == 'izakaya' else ('yuka', 2))
    elif d == 'glass_red': door_glass_red(c, x0)
    elif d == 'entry': door_entry(c, x0)
    door_head(c, x0, s['fascia'])
    threshold(c, x0, frame='conc')
    if s.get('awning'): awning(c, W, s['awning'], skip=(x0, x0 + 32))
    if s.get('noren'): noren(c, x0 + 3, 26, col=s['noren'], crest=role != 'ramen', y=T + 1, h=13 if role != 'sento' else 20)
    if s.get('lantern'):
        for i in range(W):
            if not (dc <= i < dc + 2) and i % 2 == (0 if side == 'R' else 1): lantern(c, i * 16 + 5, 11, s['lantern']) if False else None
        lx = (dc + 2) * 16 + 4 if dc + 2 < W else dc * 16 - 10
        lantern(c, lx, 24, s['lantern'])
    c.HL(0, 47, W * 16, K('sumi', 1))


def register(prop):
    for role in ROLES:
        for W in WIDTHS:
            for side in ('L', 'R'):
                if side == 'R' and door_col(W, 'R') == door_col(W, 'L'): continue
                solid = [(cx, cy) for cx in range(W) for cy in (1, 2)]
                def fn(c, role=role, W=W, side=side): draw(c, role, W, side)
                prop('sf-%s-%d-%s' % (role, W, side), '일체형 가게 정면 %s %d칸(%s)' % (role, W, '문 왼쪽' if side == 'L' else '문 오른쪽'), W, 3, solid=solid, other='star',
                     tags=['건물', '1층', '가게 정면', role],
                     rules='건물 1층 3줄 전체를 덮어 찍는다(문 2칸 포함, 문 앞은 비운다). 위층·지붕은 build_jp_city_building 이 그린다.')(fn)
