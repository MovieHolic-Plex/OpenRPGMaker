"""땅·길·물·담·철책·산울타리 — 마른 풀밭 하나를 공용 바탕으로, 길·포석·판석·연못은 그 위 오토타일, 담·철책·산울타리는 4방 이웃 줄 조각.
질감은 모두 16 주기(절대 좌표 해시)라 어느 칸에 깔아도 이음새가 없다."""
import os, sys, math, random
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, OL, OL2, run_module   # noqa: E402
from gmdraw import *
from gmdraw import slab, slab_top                                  # noqa: E402,F403

MODULE = 'terrain'
SP = 'grounds'


def h16(x, y, s=0): return hsh(x % 16, y % 16, s)


# ───────────────────────── 바탕 질감(16 주기) ─────────────────────────
def grass_px(x, y, v=0):
    """마른 올리브 풀밭: 바탕 3, 풀 포기(밝은 끝 + 어두운 밑), 드문 흙 점·낙엽(v=1)·돌(v=2)."""
    lx, ly = x % 16, y % 16
    t = 3
    if h16(lx // 2, ly // 2, 1 + v) < .22: t = 2
    # 풀 포기: 정해진 자리에 2~3px 잎
    tufts = ((2, 4), (9, 2), (13, 9), (5, 11), (10, 14), (0, 8)) if v != 1 else ((3, 3), (12, 6), (7, 12))
    for (tx, ty) in tufts:
        if lx == tx and ly in (ty, ty + 1): return K('grass', 5 if ly == ty else 4)
        if lx == tx + 1 and ly == ty + 1: return K('grass', 4)
        if lx == tx - 1 and ly == ty + 1: return K('grass', 4)
        if lx in (tx - 1, tx, tx + 1) and ly == ty + 2: return K('grass', 1)
    if v == 1:
        for (fx, fy, m) in ((6, 6, 'bark'), (13, 13, 'velvet'), (1, 13, 'bark'), (10, 9, 'gold')):
            if (lx, ly) == (fx, fy): return K(m, 4)
            if (lx, ly) == (fx + 1, fy): return K(m, 2)
    if v == 2:
        for (sx, sy) in ((5, 5), (12, 12)):
            if (lx, ly) == (sx, sy): return K('stone', 5)
            if (lx, ly) in ((sx + 1, sy), (sx, sy + 1)): return K('stone', 3)
            if (lx, ly) == (sx + 1, sy + 1): return K('stone', 1)
    if h16(lx, ly, 9) < .04: return K('dirt', 3)
    return K('grass', t)


def dirt_px(x, y):
    """진흙 길: 흙 3 바탕에 불규칙한 밝은·어두운 덩이, 바퀴 자국 짧은 끊긴 줄, 자갈 몇."""
    lx, ly = x % 16, y % 16
    v = h16(lx // 3 + (ly // 3) * 2, ly // 3, 21) * .6 + h16(lx // 2, ly // 2, 24) * .4
    t = 4 if v > .68 else 2 if v < .22 else 3
    if ly == 4 and 2 <= lx <= 6 or ly == 11 and 9 <= lx <= 14: t = 2
    if ly == 5 and 2 <= lx <= 6 or ly == 12 and 9 <= lx <= 14: t = 4
    for (sx, sy) in ((3, 8), (11, 1), (14, 14), (7, 14), (12, 7)):
        if (lx, ly) == (sx, sy): return K('stone', 4)
        if (lx, ly) == (sx + 1, sy + 1): return K('dirt', 1)
    return K('dirt', t)


_COB = [(2, 2), (8, 1), (13, 3), (4, 7), (10, 6), (15, 9), (1, 12), (7, 12), (12, 14), (5, 15.5)]


def cobble_px(x, y):
    """둥근 자갈(16 주기 보로노이): 돌마다 왼 위가 밝고 오른 아래가 어둡다, 돌 사이 어두운 틈, 드문 물빛."""
    lx, ly = x % 16 + .5, y % 16 + .5
    ds = []
    for i, (sx, sy) in enumerate(_COB):
        for ox in (-16, 0, 16):
            for oy in (-16, 0, 16):
                ds.append((math.hypot((lx - sx - ox) * 1.0, (ly - sy - oy) * 1.2), i, sx + ox, sy + oy))
    ds.sort()
    d0, i, sx, sy = ds[0]; d1 = ds[1][0]
    if d1 - d0 < 1.0: return K('stone', 1)
    t = 3 + (1 if h16(i, 0, 31) > .65 else -1 if h16(i, 1, 32) < .25 else 0)
    dx, dy = lx - sx, ly - sy
    if dx + dy < -2.2: t += 1
    elif dx + dy > 2.4: t -= 1
    if t >= 4 and dx + dy < -3 and h16(i, 2, 33) < .3: return K('glass', 5)
    return K('stone', t)


_FLAGS = [(0, 0, 9, 6), (9, 0, 7, 6), (0, 6, 6, 10), (6, 6, 10, 5), (6, 11, 5, 5), (11, 11, 5, 5)]


def flag_px(x, y):
    """크기가 다른 판석(16 주기 배치 여섯 장), 틈에 이끼, 돌판마다 단."""
    lx, ly = x % 16, y % 16
    for i, (fx, fy, fw, fh) in enumerate(_FLAGS):
        if fx <= lx < fx + fw and fy <= ly < fy + fh:
            bx, by = lx - fx, ly - fy
            if bx == fw - 1 or by == fh - 1:
                return K('ivy', 2) if h16(lx, ly, 42) < .3 else K('stone', 1)
            t = 4 + (0 if h16(i, 0, 41) > .35 else -1)
            if by == 0 or bx == 0: t += 1
            if by == fh - 2 and bx > 0: t -= 1
            if h16(lx, ly, 43) < .05: t -= 1
            return K('stone', t)
    return K('stone', 1)


def gravel_px(x, y):
    """묘지 자갈길: 작은 돌 알갱이 2px 덩이."""
    lx, ly = x % 16, y % 16
    h = h16(lx // 2, ly // 2, 51)
    t = 3 if h < .35 else 4 if h < .7 else 2
    if (lx + ly) % 2 == 0 and h16(lx, ly, 52) < .3: t += 1
    if h16(lx, ly, 53) < .08: return K('dirt', 2)
    return K('stone', t)


def water_px(x, y, f=0):
    """검은 연못: 깊은 물 1~2, 잔물결 가로선(프레임마다 흐름)."""
    lx, ly = x % 16, y % 16
    t = 1 if h16(lx // 4, ly // 3, 61) < .5 else 2
    for (rx, ry, L) in ((2, 3, 4), (9, 8, 5), (4, 13, 3), (12, 1, 3)):
        if ly == ry and (lx - rx - f) % 16 < L: return K('water', 4 if (lx - rx - f) % 16 == 0 else 3)
    return K('water', t)


# ───────────────────────── 1×1 반복 바닥 ─────────────────────────
for _v, _nm in ((0, 'a'), (1, 'b'), (2, 'c')):
    def _mk(v):
        def _g(c):
            for y in range(16):
                for x in range(16): c.P(x, y, grass_px(x, y, v))
        return _g
    REG.piece(f'gm-ground-grass-{_nm}', '마른 풀밭 ' + _nm.upper() + (' (낙엽)' if _v == 1 else ' (돌멩이)' if _v == 2 else ''), 1, 1, ['F'], 'surfaces', SP,
              role='terrain', kind='terrain', repeat=True, tags=['풀밭', '바탕', '땅'],
              desc='고딕 저택·묘지의 공용 바탕 땅: 마른 올리브 풀밭(16 주기, 이음새 없음).' + (' 낙엽 몇 장.' if _v == 1 else ' 작은 돌멩이.' if _v == 2 else ''),
              rules='맵 전체 바탕을 A 로 깔고 B·C 를 드문드문 섞는다(띠 전체를 한 변형으로 칠하지 않는다).')(_mk(_v))


@REG.piece('gm-ground-gravel', '묘지 자갈 바닥', 1, 1, ['F'], 'surfaces', 'graveyard', role='terrain', kind='terrain', repeat=True,
           tags=['자갈', '묘지', '길'], desc='회색 자갈 바닥(16 주기).', rules='묘지 안 무덤 줄 사이·예배당 앞마당에 넓게.')
def _gravel(c):
    for y in range(16):
        for x in range(16): c.P(x, y, gravel_px(x, y))


# ───────────────────────── 오토타일 ─────────────────────────
def _patch(inside, outside, rim_in=None, rim_out=None, wob=1.2, seed=0, r=4):
    """48×48 블롭 패치 + 16×16 안쪽 모서리 칸. inside/outside(x,y)->색. 경계는 16 주기 물결."""
    def wv(t): return wob * (math.sin(t * 2 * math.pi / 16 + seed) * .6 + math.sin(t * 4 * math.pi / 16 + seed * 2) * .4)

    def sd(x, y):                 # 둥근 사각형 [4,44)² 의 부호 거리(안 음수)
        px, py = x + .5, y + .5
        qx = max(4 + r - px, px - (44 - r), 0); qy = max(4 + r - py, py - (44 - r), 0)
        if qx > 0 and qy > 0: d = math.hypot(qx, qy) - r
        else:
            d = max(4 - px, px - 44, 4 - py, py - 44)
        return d - (wv(px) if abs(py - 24) > abs(px - 24) else wv(py))
    p = Cv(48, 48)
    for y in range(48):
        for x in range(48):
            d = sd(x, y)
            if d < 0:
                col = inside(x, y)
                if rim_in and d > -1.2: col = rim_in(x, y)
            else:
                col = outside(x, y)
                if rim_out and d < 1.4: col = rim_out(x, y)
            p.P(x, y, col)
    ic = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            d = min(math.hypot(x + .5 - cx, y + .5 - cy) for cx, cy in ((0, 0), (16, 0), (0, 16), (16, 16)))
            d = 4.5 + wv(x + y) * .5 - d            # 모서리 안쪽 파임
            if d < 0:
                col = inside(x, y)
                if rim_in and d > -1.2: col = rim_in(x, y)
            else:
                col = outside(x, y)
                if rim_out and d < 1.4: col = rim_out(x, y)
            ic.P(x, y, col)
    return p, ic


@REG.autotile('gm-path-dirt', '진흙 길(풀밭 가장자리)', 'surfaces', SP, desc='수레바퀴 자국과 자갈이 박힌 진흙 길. 바깥은 마른 풀밭, 경계는 풀이 흙 위로 덮인 들쭉날쭉한 선.',
              rules='저택 정문·묘지·예배당을 잇는 길. 폭 2~3칸, 문 앞 접근칸까지 닿게. fill_region·붓이 이웃에 맞춰 고른다.', tags=['길', '흙길'])
def _path_dirt():
    return _patch(dirt_px, lambda x, y: grass_px(x, y, 0), rim_in=lambda x, y: K('dirt', 1), rim_out=lambda x, y: K('grass', 5 if h16(x, y, 3) < .5 else 4), seed=1.3)


@REG.autotile('gm-cobble', '젖은 자갈 포장(돌 연석)', 'surfaces', SP, desc='비에 젖은 둥근 자갈 포장. 가장자리에 밝은 연석, 바깥은 마른 풀밭.',
              rules='저택 앞마당·마차 길·미술관 앞 광장. 길 하나에 포장 종류 하나.', tags=['포장', '자갈', '광장'])
def _cobble():
    return _patch(cobble_px, lambda x, y: grass_px(x, y, 0), rim_in=lambda x, y: K('stone', 5 if (x + y) % 5 else 3), rim_out=lambda x, y: K('grass', 1), wob=.4, seed=2.1)


@REG.autotile('gm-flagstone', '판석 광장(틈 이끼)', 'surfaces', 'gallery', desc='큰 사각 판석 광장, 틈에 이끼. 바깥은 마른 풀밭, 경계는 깨진 판석 끝.',
              rules='미술관·예배당 정면 광장, 분수 둘레.', tags=['판석', '광장'])
def _flag():
    return _patch(flag_px, lambda x, y: grass_px(x, y, 0), rim_in=lambda x, y: K('stone', 2), rim_out=lambda x, y: K('grass', 1), wob=.6, seed=3.7)


@REG.autotile('gm-pond', '검은 연못(돌 테)', 'surfaces', SP, desc='고인 검은 물(잔물결) + 윗면이 보이는 돌 테 + 바깥 마른 풀밭.',
              rules='정원 연못·해자. 물 칸은 막힘. 둘레에 고사목·석상.', pc='solidfloor', role='water', tags=['연못', '물'])
def _pond():
    def rim(x, y): return K('stone', 5 if (y % 16) < 8 else 4)
    return _patch(water_px, lambda x, y: grass_px(x, y, 0), rim_in=lambda x, y: K('water', 0), rim_out=lambda x, y: K('stone', 5 if (x // 3 + y // 3) % 2 else 4), wob=.5, seed=4.4)


# ───────────────────────── 바닥 덧그림(투명) ─────────────────────────
@REG.piece('gm-ov-moss', '이끼 덩이(덧그림)', 1, 1, ['f'], 'surfaces', SP, role='terrain', kind='flat', tags=['이끼', '덧그림'],
           desc='풀밭·포석 위에 얹는 이끼 덩이 둘(투명 바탕).', rules='담 밑·무덤 둘레·그늘진 곳에 드문드문.')
def _ov_moss(c):
    for (cx, cy, w) in ((5, 6, 5), (11, 11, 4)):
        for y in range(cy - 2, cy + 2):
            for x in range(cx - w // 2, cx + w - w // 2):
                if abs(x - cx) + abs(y - cy) * 1.5 > w * .7: continue
                c.P(x, y, K('ivy', 4 if y < cy else 3 if x < cx + 1 else 2))


@REG.piece('gm-ov-leaves', '낙엽 흩어짐(덧그림)', 1, 1, ['f'], 'surfaces', SP, role='terrain', kind='flat', tags=['낙엽', '덧그림'],
           desc='검붉은·누런 낙엽 몇 장(투명 바탕).', rules='고사목 밑·길가에.')
def _ov_leaves(c):
    for (x, y, m) in ((3, 4, 'velvet'), (10, 3, 'gold'), (7, 9, 'bark'), (13, 12, 'velvet'), (2, 13, 'gold')):
        c.P(x, y, K(m, 4)); c.P(x + 1, y, K(m, 3)); c.P(x, y + 1, K(m, 2))


@REG.piece('gm-ov-puddle', '물웅덩이(덧그림)', 1, 1, ['f'], 'surfaces', SP, role='terrain', kind='flat', tags=['웅덩이', '덧그림'],
           desc='길 위 얕은 물웅덩이(하늘빛 반사).', rules='흙길·자갈 위에 하나씩.')
def _ov_puddle(c):
    c.ellipse(8, 9, 6, 3, K('water', 2)); c.ellipse(7, 8.5, 4, 1.8, K('water', 3)); c.HL(5, 8, 3, K('water', 5)); c.HL(4, 12, 9, K('dirt', 2))


@REG.piece('gm-ov-fog', '바닥 안개(흐르는 3프레임)', 2, 1, ['ff'], 'effects', SP, role='terrain', kind='flat', frames=3, fps=3, tags=['안개', '덧그림', '애니메이션'],
           desc='땅 위를 낮게 흐르는 안개 띠(투명 바탕, 3프레임).', rules='묘지·연못가에 덩이로. 사람·문을 덮지 않는 바닥에만.')
def _ov_fog(c, f):
    for y in range(4, 14):
        for x in range(32):
            v = math.sin((x + f * 4) * .35) * 2 + math.sin((x - f * 2) * .17 + y) * 1.5
            if abs(y - 9 - v * .5) < 2.2 - abs(x - 16) / 16 and (x + y + f) % 2 == 0:
                c.P(x, y, K('fog', 3 if y < 9 else 2))


@REG.piece('gm-ov-grave-plot', '무덤 자리 흙(덧그림)', 1, 2, ['f', 'f'], 'surfaces', 'graveyard', role='terrain', kind='flat', tags=['무덤', '덧그림'],
           desc='묘비 앞 길쭉한 무덤 자리(다진 흙 + 테두리 돌).', rules='묘비 바로 아래 두 칸에. 묘비 줄마다 같은 방향.')
def _ov_plot(c):
    for y in range(2, 30):
        for x in range(3, 13):
            edge = x in (3, 12) or y in (2, 29)
            c.P(x, y, K('stone', 4 if y == 2 else 3) if edge else K('dirt', 3 if h16(x // 2, y // 2, 71) < .5 else 2))


# ───────────────────────── 줄(담·철책·산울타리) ─────────────────────────
def _slab_top(c, x0, y0, w, h, m='stone', t=6):
    """위에서 본 돌판 윗면: 밝은 면 + 뒤로 물러나는 세로 이음 + 어두운 뒷변 + 앞 모서리 빛."""
    c.R(x0, y0, w, h, K(m, t))
    for x in range(x0 + 3, x0 + w - 1, 5): c.VL(x, y0 + 1, h - 2, K(m, t - 1))
    c.HL(x0, y0, w, K(m, 2)); c.HL(x0, y0 + h - 1, w, K(m, t))


def _stone_post(c, cx=8, y0=0, r=5.5):
    """둥근 돌기둥: 위에서 보이는 타원 갓 윗면(밝음) + 원통 몸(왼 빛 → 오른 그늘)."""
    for y in range(y0 + 4, 16):
        for x in range(int(cx - r + .5), int(cx + r + .5)):
            u = (x + .5 - (cx - r)) / (2 * r)
            c.P(x, y, K('stone', 4 if u < .3 else 3 if u < .7 else 2))
    c.ellipse(cx, y0 + 4.5, r + .8, 3.6, K('stone', 3))
    c.ellipse(cx, y0 + 3.5, r + .8, 3.4, K('stone', 6))
    c.ellipse(cx - .5, y0 + 3, r * .5, 1.6, K('stone', 5))
    c.HL(int(cx - r), 15, int(2 * r), K('stone', 1))


@REG.run('gm-fence-iron', '무쇠 창살 철책(돌 받침)', 'architecture', SP, kind='frame',
         desc='낮은 돌 받침(윗면 보임) 위 창끝 무쇠 철책. 동서 줄은 창살이 서 있는 정면, 남북 줄은 위에서 본 받침 띠와 창끝 점, 끝·모퉁이는 돌기둥(갓돌).',
         rules='저택·묘지 둘레. 문 자리는 철문 조각(gm-gate-iron-open)을 끼운다. 줄 하나로 칠하면 모퉁이·끝이 알아서 맞는다.', tags=['철책', '울타리', '담'])
def _fence(c, n, e, s, w):
    horiz = e or w
    vert = n or s
    if horiz:
        x0 = 0 if w else 6; x1 = 16 if e else 10
        slab(c, x0, 8, x1 - x0, 6, 2, seams=5)                   # 받침 윗면 6행(창살은 그 가운데에 선다)
    if vert:
        y0 = 0 if n else 4; y1 = 16 if s else 12
        slab_top(c, 3, y0, 10, y1 - y0)
        c.VL(3, y0, y1 - y0, K('stone', 2)); c.VL(12, y0, y1 - y0, K('stone', 2))
        if not s: c.R(3, y1, 10, 3, K('stone', 3)); c.HL(3, y1 + 2, 10, K('stone', 1))
    post = not (horiz and not vert and (e and w)) and ((horiz and vert) or not horiz or not (e and w)) and not (vert and not horiz and n and s)
    if post: _stone_post(c)
    c.outline()
    if horiz:
        for x in range(x0, x1):                    # 창살: 받침 윗면 가운데(11행)에 선다 — 앞쪽 윗면 3행이 창살 앞에 보인다
            if x % 4 == 1 and not (post and 2 <= x <= 13):
                c.VL(x, 1, 10, K('iron', 4)); c.VL(x + 1, 1, 10, K('iron', 1))
                c.P(x, 0, K('iron', 6)); c.P(x + 1, 0, K('iron', 3))
                c.P(x, 11, K('stone', 3)); c.P(x + 1, 11, K('stone', 3)); c.P(x + 2, 12, K('stone', 4))
        for xx in range(x0, x1):                   # 가로대: 위에서 보이는 윗면 2행(밝음) + 앞면 1행
            if post and 2 <= xx <= 13: continue
            for (y, t) in ((2, 6), (3, 5), (4, 1), (6, 6), (7, 5), (8, 1)): c.P(xx, y, K('iron', t))
    if vert:
        for y in range(y0, y1):
            if (y - 1) % 3 == 0 and not (post and y < 16): c.P(7, y, K('iron', 1)); c.P(8, y, K('iron', 5)); c.P(8, y + 1, K('stone', 4))


@REG.run('gm-wall-stone', '이끼 낀 낮은 돌담', 'architecture', SP, kind='box',
         desc='윗면 갓돌이 보이는 낮은 돌담(앞면 마름돌 두 줄, 갓돌 이끼). 동서 줄은 윗면+앞면, 남북 줄은 위에서 본 갓돌 띠.',
         rules='정원·묘지 경계, 길 옆. 철책과 섞지 말고 한 구획 한 종류.', tags=['돌담', '담'])
def _wall(c, n, e, s, w):
    x0 = 0 if w else 3; x1 = 16 if e else 13
    y0 = 0 if n else 3
    if e or w or not (n or s):
        # 윗면(갓돌) + 앞면
        for x in range(x0, x1):
            for y in range(y0 if n else 3, 9):
                t = 5 if y > 3 or n else 6
                if h16(x // 3, y, 81) < .12: t -= 1
                c.P(x, y, K('stone', t))
        c.HL(x0, 8, x1 - x0, K('stone', 6))
        if not s:
            masonry(c, x0, 9, x1 - x0, 7, 'stone', 3, seed=8, course=4, blen=(4, 7), period=16)
            c.HL(x0, 9, x1 - x0, K('stone', 2))
        else:
            for x in range(x0, x1):
                for y in range(9, 16): c.P(x, y, K('stone', 5 if h16(x // 3, y, 82) > .12 else 4))
    if n or s:
        for y in range(0 if n else 3, 16 if s else 9):
            for x in range(3, 13):
                t = 5 if 3 < x < 12 else 6 if x == 3 else 4
                if h16(x // 3, y // 2, 83) < .12: t -= 1
                c.P(x, y, K('stone', t))
        if not s:
            masonry(c, 3, 9, 10, 7, 'stone', 3, seed=8, course=4, blen=(4, 7))
            c.HL(3, 9, 10, K('stone', 2))
    for x in range(16):
        for y in range(16):
            if c.opaque(x, y) and K('stone', 5)[:3] == c.get(x, y)[:3] and h16(x, y, 84) < .07: c.P(x, y, K('ivy', 4))
    c.outline()


@REG.run('gm-hedge', '마른 산울타리(가지 비치는 덤불 벽)', 'nature', SP, kind='organic',
         desc='손질이 끊긴 어두운 상록 산울타리: 위에서 보이는 잎 윗면(밝은 덩이) + 남쪽 앞면(어두운 잎·드러난 가지).',
         rules='정원 미로·화단 경계. 줄로 칠하면 모퉁이가 맞는다.', tags=['산울타리', '덤불', '정원'])
def _hedge(c, n, e, s, w):
    x0 = 0 if w else 2; x1 = 16 if e else 14; y0 = 0 if n else 2; y1 = 16 if s else 10
    for y in range(y0, 16 if s else 16):
        for x in range(x0, x1):
            front = (not s) and y >= y1
            lx, ly = x % 16, y % 16
            h = h16(lx // 2, ly // 2, 91)
            if front:
                t = 2 if h > .3 else 1
                if h16(lx, ly, 92) < .1: c.P(x, y, K('bark', 2)); continue
                if y == 15: t = 0
            else:
                t = 4 if h > .55 else 3 if h > .2 else 2
                if (ly % 4 == 0 and lx % 5 == 1) or h16(lx, ly, 93) < .06: t = 5
            c.P(x, y, K('ivy', t))
    c.outline()


@REG.piece('gm-gate-iron-open', '무쇠 쌍문(열림)', 3, 2, ['SCS', 'SCS'], 'architecture', SP, role='fence', kind='structure',
           tags=['철문', '정문', '문'], desc='무쇠 쌍문이 안쪽으로 열린 상태: 가운데 칸으로 지나갈 수 있다.', rules='철책(gm-fence-iron) 줄 안에 3칸을 비우고 끼운다. 가운데 칸으로 지나간다 — 저택·묘지 정문.')
def _gate_open(c):
    _gate_draw(c, open_=True)


def _gate_draw(c, open_):
    slab(c, 10, 22, 28, 8, 2, seams=5)                          # 문턱 돌 윗면 8행
    for px in (6, 42):                           # 둥근 돌기둥: 타원 갓 윗면 + 원통 몸
        for y in range(8, 32):
            for x in range(px - 6, px + 6):
                u = (x + .5 - (px - 6)) / 12
                c.P(x, y, K('stone', 4 if u < .3 else 3 if u < .7 else 2))
            if y % 6 == 0: c.HL(px - 6, y, 12, K('stone', 2))
        c.ellipse(px, 8.5, 7, 4, K('stone', 3)); c.ellipse(px, 7, 7, 4, K('stone', 6)); c.ellipse(px - 1, 6, 3.5, 1.8, K('stone', 5))
        c.ellipse(px, 4, 2.5, 2.5, K('stone', 4)); c.P(px - 1, 3, K('stone', 6)); c.HL(px - 6, 31, 12, K('stone', 1))
    c.outline()
    bar = lambda x, top, bot: (c.VL(x, top, bot - top, K('iron', 4)), c.VL(x + 1, top, bot - top, K('iron', 1)), c.P(x, top - 1, K('iron', 6)), c.P(x, bot, K('stone', 3)), c.P(x + 1, bot, K('stone', 3)))
    rail = lambda x0, w, y: [c.HL(x0, y + k, w, K('iron', t)) for k, t in ((0, 6), (1, 5), (2, 1))]
    if not open_:
        for x in range(13, 36):                  # 닫힌 문짝은 문턱 뒷변(22) 위에 선다 — 문턱 윗면 8행이 앞에 그대로 보인다
            top = 4 + int(abs(x - 24) * .25)
            if (x - 13) % 3 == 0: bar(x, top, 22)
        rail(13, 23, 8); rail(13, 23, 15)
        c.R(23, 11, 3, 3, K('gold', 4)); c.P(23, 11, K('gold', 6))
    else:
        for x0 in (13, 31):                      # 안쪽으로 열린 문짝: 좁은 비스듬한 면
            for k in range(5):
                x = x0 + k
                d = k if x0 == 13 else 4 - k
                c.VL(x, 6 + d, 20 - d, K('iron', 4 if k % 2 == 0 else 2)); c.P(x, 5 + d, K('iron', 6))
            rail(x0, 5, 14)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
