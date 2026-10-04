"""새 부품 A (맵 라운드): 전봇대2·가로등·고양이·児童遊園·요금판·입간판·자전거 무리·깃발 기둥·상점가 아치·함석 시장 점포·환기탑·개찰구·夕やけだんだん·가설 진열대.
모든 색은 modern3 램프 K() 단. 16px 격자, 3/4 정면(앞면 + 윗면), 빛은 왼쪽 위. 글자는 일반 한자만(상호·로고 금지).
register(reg_prop, reg_deco, add, STREET) 로 등록한다."""
import sys, os
import jpenv
from v2core import *
from v2misc import _gl_bold2


def _line(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for k in range(n + 1): c.P(int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n)), col)

def _ground(c, x0, x1, y, col=None):
    """바닥 접지 그림자(한 칸 건너 점선)."""
    col = col or K('hodo', 0)
    for x in range(x0, x1):
        if (x - x0) % 2 == 0: c.P(x, y, col)

def _ol(c, down=True):
    """바깥 1px 어두운 윤곽만 입힌다(내부 잉크 없음 — 얇은 물체·작은 부품용). 윤곽은 4방향 이웃."""
    al = c.a[..., 3] > 0; pad = np.pad(al, 1)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    o = Cv(c.w, c.h); o.a[:] = c.a; o.a[nb & ~al] = (*rgb(DARK()), 255)
    return o


# ───────────────────────── 1. 전봇대 (가는 4px 기둥 + 변압기 + 처지는 전선) ─────────────────────────
def utility_pole2():
    """32x80. 나무 기둥 x=11..14(열 0) + 완금 + 애자 3개 + 변압기통 + 낮은 통신 완금 + 처지는 1px 전선 토막(양 끝이 가장자리까지)."""
    c = Cv(32, 80); px = 11
    c.R(px, 8, 4, 68, K('ita', 0)); c.VL(px, 8, 68, K('ita', 2)); c.VL(px + 3, 8, 68, K('ita', -2)); c.HL(px, 8, 4, K('ita', 3))
    for yy in range(26, 74, 11): c.HL(px, yy, 4, K('ita', -2)); c.HL(px, yy + 1, 4, K('ita', 1))            # 나이테 이음 띠
    # 위 완금 + 애자(윗면 하이라이트)
    c.R(2, 13, 22, 3, K('ita', 1)); c.HL(2, 13, 22, K('ita', 4)); c.HL(2, 15, 22, K('ita', -2)); c.VL(2, 13, 3, K('ita', 4)); c.VL(23, 13, 3, K('ita', -2))
    def insul(x, y):
        c.R(x, y, 2, 4, K('shiro', 3)); c.VL(x, y, 4, K('shiro', 4)); c.VL(x + 1, y, 4, K('shiro', 1)); c.HL(x, y, 2, K('shiro', 4))
    insul(4, 9); insul(20, 9); insul(12, 4)
    # 변압기통(기둥 오른쪽에 매단 원통): 윗면 + 몸통(왼쪽 밝음) + 띠 2 + 아래 뚜껑
    tx, ty = 16, 22
    c.R(tx, ty, 8, 3, K('conc', 4)); c.HL(tx, ty, 8, K('shiro', 4)); c.R(tx + 1, ty - 1, 6, 1, K('conc', 3))
    c.R(tx, ty + 3, 8, 12, K('conc', 1)); c.VL(tx, ty + 3, 12, K('conc', 3)); c.VL(tx + 1, ty + 3, 12, K('conc', 2)); c.VL(tx + 7, ty + 3, 12, K('conc', -1))
    c.HL(tx, ty + 6, 8, K('conc', -1)); c.HL(tx, ty + 11, 8, K('conc', -1))
    c.R(tx + 1, ty + 15, 6, 1, K('tekko', 1)); c.R(px + 4, ty + 3, 1, 2, K('tekko', 2)); c.R(px + 4, ty + 10, 1, 2, K('tekko', 2))      # 금구
    # 통신 완금(낮고 짧다) + 애자 2
    c.R(6, 43, 14, 2, K('ita', 1)); c.HL(6, 43, 14, K('ita', 4)); c.HL(6, 44, 14, K('ita', -2))
    insul(7, 40); insul(17, 40)
    # 전주 번호 판(노랑)
    c.R(px, 54, 4, 5, K('kii', 3)); c.HL(px, 54, 4, K('kii', 4)); c.VL(px + 3, 54, 5, K('kii', 0)); c.R(px + 1, 56, 2, 1, K('tekko', -2))
    # 밑동 콘크리트 기초
    c.R(px - 1, 72, 6, 4, K('hodo', 3)); c.HL(px - 1, 72, 6, K('hodo', 5)); c.VL(px + 4, 72, 4, K('hodo', 0)); c.HL(px - 1, 75, 6, K('hodo', -1))
    out = _ol(c)
    _ground(out, px - 3, px + 8, 77)
    # 전선(1px, 윤곽 뒤): 위 가운데 선은 높게, 바깥 선은 낮게. 모두 바깥으로 갈수록 처진다
    wc = K('sumi', 1)
    def wire(x0, y0, xe, ye):
        n = abs(xe - x0)
        for k in range(n + 1):
            t = k / max(n, 1); out.P(int(round(x0 + (xe - x0) * t)), int(round(y0 + (ye - y0) * (1 - (1 - t) ** 2))), wc)
    wire(12, 3, 0, 7); wire(13, 3, 31, 7)                       # 가운데 애자 → 양쪽
    wire(4, 8, 0, 11); wire(21, 8, 31, 11)                        # 바깥 애자
    wire(7, 39, 0, 42); wire(18, 39, 31, 42)                      # 통신선
    return out


# ───────────────────────── 2. 가로등 (주오도리식 T자 팔 + 구형 등 2개) ─────────────────────────
def lamp_post():
    """16x64. 기둥 3px(열 0) + 장식 고리 + 윗 가로 팔 + 양 끝에 매단 유백 구형 등 2개 + 밑동."""
    c = Cv(16, 64)
    c.R(6, 12, 3, 44, K('tekko', 1)); c.VL(6, 12, 44, K('tekko', 4)); c.VL(8, 12, 44, K('tekko', -1))
    for yy in (22, 28): c.R(5, yy, 5, 2, K('tekko', 3)); c.HL(5, yy, 5, K('tekko', 5)); c.HL(5, yy + 1, 5, K('tekko', 0))
    c.R(5, 48, 5, 2, K('tekko', 3)); c.HL(5, 48, 5, K('tekko', 5))
    c.R(4, 52, 7, 3, K('tekko', 2)); c.HL(4, 52, 7, K('tekko', 5)); c.VL(10, 52, 3, K('tekko', -1))
    c.R(3, 55, 9, 5, K('hodo', 2)); c.HL(3, 55, 9, K('hodo', 5)); c.VL(3, 55, 5, K('hodo', 4)); c.VL(11, 55, 5, K('hodo', -1)); c.HL(3, 59, 9, K('hodo', -2))
    # 팔(T자): 기둥 위에서 좌우로 뻗고 끝이 위로 살짝 휜다
    c.R(5, 9, 5, 4, K('tekko', 2)); c.HL(5, 9, 5, K('tekko', 5))
    c.R(1, 7, 13, 3, K('tekko', 2)); c.HL(1, 7, 13, K('tekko', 5)); c.HL(1, 9, 13, K('tekko', -1))
    c.R(7, 4, 1, 3, K('tekko', 3)); c.P(7, 3, K('kii', 4))                                         # 꼭대기 장식
    # 구형 등 두 개: 뚜껑 + 유백 구(왼위 밝음, 아래 따뜻한 노랑) + 받침
    for gx in (0, 10):
        c.R(gx, 10, 5, 1, K('tekko', 3)); c.R(gx + 1, 11, 3, 1, K('tekko', 2))
        for j in range(7):
            for i in range(5):
                d = ((i - 2) / 2.7) ** 2 + ((j - 3) / 3.7) ** 2
                if d <= 1.0: c.P(gx + i, 11 + j, K('shiro', 4) if (i <= 1 and j <= 2) else K('kii', 4) if j >= 5 or i == 4 else K('shiro', 3))
        c.R(gx + 1, 18, 3, 1, K('tekko', 2))
    return _ol(c)


# ───────────────────────── 3. 고양이 (16x16, 3/4 정면, 1px 윤곽) ─────────────────────────
def cat_sit(kind='calico'):
    """앉은 고양이: 큰 머리·삼각 귀·앞발 두 개가 보이는 몸통·오른쪽으로 말린 꼬리. 삼색(흰 바탕 + 주황·검정 무늬)."""
    pal = {'calico': dict(a=K('shiro', 3), b=K('daidai', 2), c=K('sumi', 2), s=K('shiro', 0), f=K('shiro', 4)),
           'black': dict(a=K('tekko', -2), b=K('tekko', -1), c=K('tekko', -3), s=K('tekko', -3), f=K('tekko', -1)),
           'white': dict(a=K('shiro', 4), b=K('shiro', 3), c=K('shiro', 3), s=K('shiro', 1), f=K('shiro', 4))}[kind]
    c = Cv(16, 16)
    ellipse(c, 8, 12, 5, 3.3, pal['a'], None, pal['s']); c.R(4, 12, 8, 3, pal['a'])           # 몸통
    c.R(12, 11, 2, 4, pal['a']); c.R(13, 9, 1, 3, pal['a']); c.P(13, 8, pal['a'])                # 꼬리
    ellipse(c, 8, 7, 5.3, 4.2, pal['a'], None, pal['s'])                                        # 머리
    for (x0, d) in ((3, 1), (10, -1)):                                                           # 귀(삼각)
        c.R(x0, 3, 3, 3, pal['a']); c.P(x0 if d == 1 else x0 + 2, 2, pal['a'])
    if kind == 'calico':
        c.R(3, 3, 3, 4, pal['b']); c.P(3, 2, pal['b']); c.R(10, 3, 3, 2, pal['c']); c.P(12, 2, pal['c']); c.R(6, 4, 2, 1, pal['b'])
        c.R(9, 11, 4, 3, pal['b']); c.R(4, 12, 2, 2, pal['c']); c.P(13, 9, pal['c']); c.P(13, 8, pal['c']); c.P(13, 10, pal['b'])
    out = _ol(c)
    ec = K('sumi', 0) if kind != 'black' else K('kii', 3)
    out.P(5, 6, ec); out.P(10, 6, ec); out.P(5, 7, ec) if False else None
    if kind != 'black': out.P(4, 3, K('pinku', 2)) if kind != 'calico' else None; out.P(11, 3, K('pinku', 2))
    out.P(7, 8, K('pinku', 3)); out.P(8, 8, K('pinku', 3))
    # 앞발 두 개(흰) + 접지선
    out.R(5, 13, 2, 2, pal['f']); out.R(9, 13, 2, 2, pal['f'])
    out.P(5, 14, pal['s']) if kind == 'white' else None
    for x in (4, 5, 6, 7, 8, 9, 10, 11): out.P(x, 15, DARK())
    out.P(7, 13, pal['s']); out.P(8, 13, pal['s'])
    return out

def cat_loaf(kind='ginger'):
    """식빵 자세: 몸이 둥근 식빵 모양, 앞발과 꼬리를 접어 넣고 머리를 왼쪽 앞에 둔다. 주황 얼룩 고양이."""
    pal = {'ginger': (K('daidai', 2), K('daidai', 3), K('daidai', 0), K('shiro', 3)), 'gray': (K('conc', 2), K('conc', 4), K('conc', 0), K('shiro', 3))}[kind]
    a, hi, lo, wh = pal
    c = Cv(16, 16)
    ellipse(c, 8, 11.5, 6.0, 4.4, a, hi, lo); c.R(3, 11, 10, 4, a)
    ellipse(c, 5.5, 7.5, 3.8, 3.2, a, hi, None)
    c.R(2, 3, 2, 3, a); c.R(7, 3, 2, 3, a); c.P(2, 3, hi); c.P(7, 3, hi)
    out = _ol(c)
    out.P(4, 7, K('sumi', 0)); out.P(7, 7, K('sumi', 0)); out.P(5, 9, K('pinku', 3)); out.P(6, 9, K('pinku', 3))
    for x in (9, 11, 13): out.VL(x, 9, 2, lo)
    out.R(3, 12, 4, 2, wh); out.HL(3, 12, 4, K('shiro', 4))
    for x in range(2, 14): out.P(x, 15, DARK())
    return out

def cat_wood():
    """처마 위 목각 고양이 (3/4): 크림색 고양이(갈색 줄무늬, 머리·귀 윗면 밝음, 왼쪽 밝고 오른쪽 어두움) + 받침 판(윗면 3px 중간 갈색 + 앞면 2px 어두운 갈색). 고양이가 받침보다 3단 이상 밝고, 발 밑에 1px 어두운 접지선이 있다."""
    c = Cv(16, 16)
    # 받침: 윗면 3px(중간 갈색, 왼쪽 앞 모서리 밝음) + 앞면 2px(어두움)
    c.R(1, 11, 14, 3, K('ita', 0)); c.HL(1, 11, 14, K('ita', 1)); c.HL(1, 13, 14, K('ita', 1)); c.VL(1, 11, 3, K('ita', 2))
    c.R(1, 14, 14, 2, K('ita', -2)); c.HL(1, 14, 14, K('ita', -1)); c.HL(1, 15, 14, K('ita', -3)); c.VL(1, 14, 2, K('ita', 0)); c.VL(14, 11, 5, K('ita', -2))
    # 접지: 발 바로 밑 1px 어두운 선(받침 윗면 위)
    c.HL(3, 12, 10, K('ita', -2))
    # 몸통(크림): 머리와 왼쪽 선이 같다. 오른쪽 한 줄은 그늘.
    c.R(3, 7, 10, 5, K('kinari', 1)); c.VL(3, 7, 5, K('kinari', 2)); c.VL(12, 7, 5, K('kinari', 0)); c.HL(4, 7, 8, K('kinari', 2))
    c.R(4, 10, 2, 2, K('kinari', 2)); c.R(9, 10, 2, 2, K('kinari', 2)); c.VL(7, 10, 2, K('kinari', 0)); c.P(6, 11, K('kinari', -1)); c.P(8, 11, K('kinari', -1))     # 앞발 두 개 + 사이 틈
    for y in (8, 9): c.P(4, y, K('ita', 2)); c.P(11, y, K('ita', 1))                                                                           # 줄무늬(옆구리)
    c.R(13, 8, 1, 4, K('kinari', 0)); c.P(13, 7, K('kinari', 0)); c.VL(13, 9, 3, K('ita', 2))                                                  # 꼬리
    # 머리 + 귀(윗면 밝은 단)
    c.R(3, 2, 10, 5, K('kinari', 1)); c.VL(3, 2, 5, K('kinari', 2)); c.VL(12, 2, 5, K('kinari', 0)); c.HL(6, 2, 4, K('kinari', 2))
    c.R(3, 0, 3, 3, K('kinari', 1)); c.R(10, 0, 3, 3, K('kinari', 0)); c.HL(3, 0, 3, K('kinari', 2)); c.HL(10, 0, 3, K('kinari', 1))
    c.P(4, 1, K('pinku', 1)); c.P(11, 1, K('pinku', 0))
    for x in (7, 8): c.P(x, 3, K('ita', 2))                                                                                                       # 이마 줄무늬
    out = _ol(c)
    for x in (5, 9): out.R(x, 4, 2, 2, K('sumi', 1)); out.P(x, 4, K('kii', 2))                                                                    # 눈: 노란 구멍
    out.P(7, 6, K('aka', 1)); out.P(8, 6, K('aka', 1))
    return out

# ───────────────────────── 4. 児童遊園 놀이기구 (칙칙한 도장 색, 윗면 밝음) ─────────────────────────
def slide():
    """미끄럼틀 48x48 (3/4): 왼쪽 사다리(두 레일 + 흰 디딤판 사이는 어두운 구멍) + 승강대(윗면 5px 밝은 판 + 어두운 뒷선 / 앞면 5px 어두운 판 + 아랫 그늘) + 빨간 지붕 프레임(윗면 3px)
    + 오른쪽으로 내려오는 홈 파인 활강판(뒷 벽 윗면 밝음 · 안쪽 어두움 / 바닥면 / 앞 벽 윗면 밝음 / 앞 옆단 어두움, 끝은 평평한 출구) + 활강판 받침 다리 2개 + 접지 그림자. 뒤 받침 기둥은 사다리와 떨어져 한 단 어둡다."""
    c = Cv(48, 48)
    # 승강대 뒤 받침 기둥(사다리와 틈을 두고 한 단 어둡게)
    c.R(22, 20, 2, 25, K('tekko', -2)); c.VL(22, 20, 25, K('tekko', 0))
    # 지붕 프레임: 기둥 2개(승강대 윗면에 선다) + 윗면 2px + 앞면 3px
    for rx in (4, 19): c.R(rx, 5, 2, 8, K('aka', 0)); c.VL(rx, 5, 8, K('aka', 2)); c.VL(rx + 1, 5, 8, K('aka', -1))
    c.R(3, 0, 20, 2, K('aka', 3)); c.HL(3, 0, 20, K('aka', 2)); c.HL(3, 1, 20, K('aka', 3)); c.VL(3, 0, 2, K('aka', 4))
    c.R(3, 2, 20, 3, K('aka', 1)); c.HL(3, 2, 20, K('aka', 4)); c.HL(3, 4, 20, K('aka', -1)); c.VL(22, 2, 3, K('aka', -1))
    # 승강대: 윗면 5px(뒷선 어두움 + 밝은 판 + 판 이음 세로선) + 앞면 5px(어두움) + 아랫 그늘
    c.R(2, 10, 22, 1, K('ita', -1)); c.R(2, 11, 22, 5, K('ita', 6)); c.HL(2, 11, 22, K('ita', 4)); c.VL(2, 11, 5, K('shiro', 3))
    for x in (8, 14, 20): c.VL(x, 12, 4, K('ita', 4))
    c.HL(2, 15, 22, K('ita', 3))
    c.R(2, 16, 22, 5, K('ita', -1)); c.HL(2, 16, 22, K('ita', 1)); c.VL(2, 16, 5, K('ita', 1)); c.VL(23, 11, 10, K('ita', -3)); c.HL(2, 20, 22, K('ita', -3))
    # 사다리 레일 2개(밝은 왼쪽 / 한 단 어두운 오른쪽) + 디딤판(흰 면 + 어두운 앞단), 사이는 어두운 구멍
    c.R(5, 21, 2, 24, K('tekko', 1)); c.VL(5, 21, 24, K('tekko', 4)); c.R(17, 21, 2, 24, K('tekko', -1)); c.VL(17, 21, 24, K('tekko', 1))
    c.R(7, 21, 10, 24, K('tekko', -3))
    for yy in (24, 29, 34, 39): c.R(7, yy, 10, 2, K('shiro', 3)); c.HL(7, yy, 10, K('shiro', 4)); c.HL(7, yy + 1, 10, K('conc', 2))
    c.R(4, 44, 4, 2, K('hodo', 1)); c.R(16, 44, 4, 2, K('hodo', 1)); c.R(21, 44, 4, 2, K('hodo', 0))
    # 활강판: 뒷 벽(윗면 밝음 / 안쪽 어두움) + 바닥면 + 앞 벽 윗면(가장 밝음) + 앞 옆단(어두움). 끝 4칸은 평평한 출구.
    x0, x1, ya, yb = 24, 45, 11, 33
    cy = lambda x: int(round(ya + (yb - ya) * (1 - (1 - min(1.0, (x - x0) / (x1 - x0 - 4))) ** 1.7)))
    for x in range(x0, x1 + 1):
        y = cy(x)
        c.P(x, y - 2, K('conc', 5)); c.P(x, y - 1, K('conc', 1))                                   # 뒷 벽 윗면 + 안쪽 그늘
        for k in range(0, 4): c.P(x, y + k, K('conc', 4) if k < 3 else K('conc', 5))              # 바닥면(앞으로 갈수록 밝다)
        c.P(x, y + 4, K('shiro', 4))                                                              # 앞 벽 윗면
        c.P(x, y + 5, K('conc', 2)); c.P(x, y + 6, K('conc', 0)); c.P(x, y + 7, K('tekko', -1))   # 앞 옆단
    for lx in (30, 38):                                                                           # 활강판 받침 다리: 앞 옆단 밑에서 땅까지
        ly = cy(lx) + 8; c.R(lx, ly, 2, 45 - ly, K('tekko', -2)); c.VL(lx, ly, 45 - ly, K('tekko', 0))
    out = _ol(c)
    _ground(out, 3, 47, 46, K('hodo', 0))
    return out

def swing():
    """그네 48x48: 양쪽 끝의 A자 다리(꼭대기 한 점에서 바닥으로 벌어지는 직선 3px 기둥 2개) + 윗 가로대(윗면 밝음) + 쇠사슬 1px 2줄씩 + 나무 좌석 2개(윗면 + 앞면) + 접지 그림자. 틀은 칙칙한 녹색."""
    c = Cv(48, 48); G = 'midori'
    def leg(x0, y0, x1, y1, lit):
        n = y1 - y0
        for k in range(n + 1):
            x = int(round(x0 + (x1 - x0) * k / n)); y = y0 + k
            c.R(x, y, 3, 1, K(G, -1)); c.P(x, y, K(G, 0 if lit else -1)); c.P(x + 2, y, K(G, -2))
    for ax in (7, 40):                                                                        # 꼭대기 중심 ax
        leg(ax - 1, 5, ax - 4, 43, True); leg(ax - 1, 5, ax + 2, 43, False)
        c.R(ax - 3, 3, 7, 4, K(G, 0)); c.HL(ax - 3, 3, 7, K(G, 2)); c.VL(ax + 3, 3, 4, K(G, -2))   # 꼭대기 이음 블록
        c.R(ax - 7, 43, 6, 2, K('hodo', 1)); c.R(ax, 43, 6, 2, K('hodo', 1))              # 발 받침
    c.R(3, 3, 42, 3, K(G, 0)); c.HL(3, 3, 42, K(G, 3)); c.HL(3, 4, 42, K(G, 1)); c.HL(3, 5, 42, K(G, -2)); c.VL(3, 3, 3, K(G, 2)); c.VL(44, 3, 3, K(G, -2))     # 윗 가로대
    for sx in (14, 29):
        for dx in (0, 9):
            for yy in range(6, 29): c.P(sx + dx, yy, K('tekko', 4) if yy % 2 == 0 else K('tekko', 1))                     # 쇠사슬
        c.R(sx - 2, 29, 13, 2, K('ita', 4)); c.HL(sx - 2, 29, 13, K('ita', 6)); c.R(sx - 2, 31, 13, 3, K('ita', 1)); c.VL(sx - 2, 31, 3, K('ita', 3)); c.VL(sx + 10, 31, 3, K('ita', -1)); c.HL(sx - 2, 33, 13, K('ita', -2))
    out = _ol(c)
    _ground(out, 0, 48, 46, K('hodo', 0))
    return out

def sandbox():
    """모래판 48x32 (3/4): 나무 틀(뒤 윗면 3px 밝음·안쪽 뒤벽 그늘 1px·좌우 틀·앞 윗면 3px + 앞면 4px) + 노란 베이지 모래(2색 점 질감) + 파란 양동이(윗면 타원 + 몸통) + 삽."""
    c = Cv(48, 32)
    c.R(2, 4, 44, 3, K('ita', 3)); c.HL(2, 4, 44, K('ita', 5))
    c.R(2, 7, 44, 3, K('ita', -2))
    sand, sh, sl = K('yuka', 2), K('yuka', 1), K('kinari', 3)
    c.R(4, 10, 40, 14, sand); c.R(4, 10, 40, 1, sh)                                             # 모래 + 뒤벽 안쪽 그늘
    for yy in range(11, 24):                                                                    # 2색 점 질감(규칙 격자)
        for xx in range(5, 43):
            if (xx * 3 + yy * 5) % 17 == 0: c.P(xx, yy, sl)
            elif (xx * 7 + yy * 3) % 13 == 0: c.P(xx, yy, sh)
    c.R(2, 10, 3, 14, K('ita', 3)); c.VL(2, 10, 14, K('ita', 5)); c.VL(4, 10, 14, K('ita', -2))
    c.R(43, 10, 3, 14, K('ita', 1)); c.VL(45, 10, 14, K('ita', -3)); c.VL(43, 10, 14, K('ita', -2))
    c.R(2, 24, 44, 3, K('ita', 3)); c.HL(2, 24, 44, K('ita', 5)); c.R(2, 27, 44, 4, K('ita', 0)); c.HL(2, 30, 44, K('ita', -3))
    for x in (14, 26, 38): c.VL(x, 28, 3, K('ita', -2))
    # 파란 양동이: 윗면 타원(안쪽 어두움 + 밝은 테) + 몸통(위가 넓은 사다리꼴)
    for j in range(6):
        w = 8 - j // 2; x0 = 31 + j // 4
        c.R(x0 if False else 32 + (j // 3), 15 + j, 7 - (j // 3) * 2, 1, K('sora', 1))
    c.VL(32, 15, 2, K('sora', 3)); c.VL(38, 15, 6, K('sora', 0)); c.VL(33, 17, 3, K('sora', 3))
    ellipse(c, 35.5, 14, 3.8, 1.8, K('sora', 3)); ellipse(c, 35.5, 14, 2.4, 1.0, K('sora', -1))     # 윗면 + 안쪽
    c.HL(33, 21, 5, K('sora', -2))
    # 삽: 자루 + 날(윗면 1px)
    _line(c, 22, 12, 27, 18, K('ita', 0)); _line(c, 23, 12, 28, 18, K('ita', -2)); c.R(26, 18, 3, 3, K('kii', 1)); c.HL(26, 18, 3, K('kii', 3)); c.HL(26, 20, 3, K('kii', -1))
    out = _ol(c)
    _ground(out, 3, 46, 31, K('hodo', -1))
    return out

# ───────────────────────── 5. 코인 주차 요금판 · 6. A자 입간판 ─────────────────────────
def coin_sign():
    """16x32: 얇은 기둥 + 파란 판 위에 막대로 그린 흰 P 마크 + 아래 요금 판(막대 3줄 + 노란 머리띠) + 받침."""
    c = Cv(16, 32)
    c.R(7, 20, 2, 10, K('tekko', 1)); c.VL(7, 20, 10, K('tekko', 4)); c.VL(8, 20, 10, K('tekko', -1))
    c.R(2, 1, 12, 11, K('sora', 0)); c.VL(2, 1, 11, K('sora', 2)); c.VL(13, 1, 11, K('sora', -1)); c.HL(2, 1, 12, K('sora', 3)); c.HL(2, 11, 12, K('sora', -2))
    wc, wd = K('shiro', 4), K('shiro', 2)                                                      # P: 세로 2px 막대 + 둥근 머리
    c.R(5, 3, 2, 7, wc); c.R(7, 3, 3, 2, wc); c.R(9, 4, 2, 3, wc); c.R(7, 6, 3, 2, wc); c.VL(6, 3, 7, wd) if False else None
    c.P(10, 3, K('sora', 0)); c.P(10, 7, K('sora', 0))
    c.R(2, 13, 12, 8, K('shiro', 3)); c.VL(2, 13, 8, K('shiro', 4)); c.VL(13, 13, 8, K('shiro', 0)); c.HL(2, 20, 12, K('shiro', 0))
    c.R(2, 13, 12, 2, K('kii', 2)); c.HL(2, 13, 12, K('kii', 3))
    for k, w in enumerate((7, 5, 6)): c.HL(4, 16 + k * 2, w, K('tekko', 0)); c.R(11, 16 + k * 2, 2, 1, K('aka', 1))
    c.R(5, 29, 6, 2, K('hodo', 3)); c.HL(5, 29, 6, K('hodo', 5)); c.HL(5, 31, 6, K('hodo', -1))
    return _ol(c)

def a_frame():
    """A자 입간판 16x16 (3/4): 꼭대기 능선(윗면 밝은 나무 1px + 앞면 + 경첩 점) + 앞판(완만한 사다리꼴 짙은 회색 칠판 + 1px 나무 테두리: 왼쪽 밝음·오른쪽 어두움 + 흰 분필 줄 3개)
    + 판 아래 가로대 + 바깥으로 벌어진 두 다리(가운데 6px 이 뚫려 바닥 접점 2곳) + 접지선."""
    c = Cv(16, 16)
    c.R(5, 1, 6, 1, K('ita', 6)); c.R(5, 2, 6, 1, K('ita', 3)); c.P(5, 2, K('ita', 5)); c.P(10, 2, K('ita', -1)); c.P(7, 2, K('tekko', 1)); c.P(8, 2, K('tekko', 1))   # 능선 윗면 + 앞면 + 경첩
    for j in range(9):
        w = 8 + (j * 4) // 8; x0 = 8 - w // 2; y = 3 + j
        for i in range(w): c.P(x0 + i, y, K('tekko', -1))                                  # 칠판 면
        c.P(x0, y, K('ita', 5)); c.P(x0 + w - 1, y, K('ita', -1))                          # 좌 밝은 / 우 어두운 테두리
    c.HL(4, 3, 8, K('ita', 4))                                                              # 앞판 위 테두리
    c.HL(2, 12, 12, K('ita', 2)); c.P(2, 12, K('ita', 5)); c.P(13, 12, K('ita', -1))      # 판 밑 가로대
    c.R(2, 13, 3, 2, K('ita', 3)); c.VL(2, 13, 2, K('ita', 5)); c.R(11, 13, 3, 2, K('ita', -1)); c.VL(13, 13, 2, K('ita', -3))     # 벌어진 두 다리
    c.HL(6, 5, 4, K('shiro', 4)); c.HL(5, 7, 6, K('shiro', 3)); c.HL(5, 9, 5, K('shiro', 4))   # 분필 글줄 3개(흰)
    out = _ol(c)
    _ground(out, 2, 14, 15, K('hodo', 0))
    return out

# ───────────────────────── 7. 자전거 무리 (3x1) ─────────────────────────
def _mini_bike(frame, face=1):
    """자전거 한 대 15x14 (scene_standard 의 파란 자전거 축소판): 바퀴 = 지름 7 의 둥근 어두운 타이어 링(1px) + 밝은 안쪽(왼쪽 위 밝고 오른쪽 아래 어둡다) + 허브 점,
    프레임 = 1px 색선(윗관 밝음·아래관 어두움), 안장·핸들바 = 위에 밝은 1px 단 + 아래 어두운 단, 앞바구니 = 회색 윗면 + 세로 살. 프레임은 윤곽을 따로 입히지 않는다(타이어가 윤곽).
    face=1 이면 오른쪽을 본다. 기하만 좌우 반전하고 빛(왼쪽 위)은 그대로 둔다."""
    c = Cv(15, 14)
    mx = (lambda x: x) if face == 1 else (lambda x: 14 - x)
    P = lambda x, y, col: c.P(mx(x), y, col)
    FR = lambda t: K(frame, t)
    WH = ("..TTT..", ".TWwcT.", "TWwwcDT", "TwwhcDT", "TcccDDT", ".TcDDT.", "..TTT..")
    WC = {'T': K('sumi', 0), 'W': K('shiro', 3), 'w': K('conc', 5), 'c': K('conc', 3), 'D': K('conc', 2), 'h': K('tekko', -1)}
    for x0 in (0, 8):
        for j, row in enumerate(WH):
            for i, ch in enumerate(row):
                if ch != '.': c.P(mx(x0 + i) if face == 1 else 14 - (x0 + i), 6 + j, WC[ch])
    def line(x0, y0, x1, y1, col):
        for p in _pts(x0, y0, x1, y1): P(p[0], p[1], col)
    line(5, 5, 7, 10, FR(1)); line(5, 6, 10, 6, FR(2)); line(7, 10, 10, 7, FR(-1)); line(10, 6, 11, 8, FR(0))
    P(3, 9, K('tekko', -2)); P(11, 9, K('tekko', -2))                                         # 허브
    P(6, 11, K('tekko', -1)); P(7, 11, K('tekko', -1))                                       # 페달
    for dx in (-1, 0, 1): P(5 + dx, 3, K('tekko', 5)); P(5 + dx, 4, K('tekko', -2))         # 안장: 윗면 밝음 + 앞면 어두움
    P(5, 5, K('tekko', 1))
    P(10, 4, K('tekko', 1)); P(10, 5, K('tekko', 1))                                         # 스템
    for x in (9, 10, 11): P(x, 3, K('tekko', 5))                                              # 핸들바 윗면
    P(9, 4, K('tekko', -2))                                                                   # 그립
    for x in (12, 13, 14): P(x, 3, K('conc', 5)); P(x, 4, K('conc', 3) if x != 13 else K('tekko', -1)); P(x, 5, K('tekko', -2))   # 앞바구니
    for x in range(1, 14):                                                                    # 접지 점선
        if x % 2: P(x, 13, K('hodo', 0))
    return c

def _pts(x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    return [(int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n))) for k in range(n + 1)]

def bike_cluster():
    """3x1 (48x16): 자전거 3대가 앞/뒤 열로 선다(대마다 y 를 어긋나게, 1px 띄움). 오른쪽·왼쪽·오른쪽을 본다. 프레임 색이 모두 다르다. 각 대 밑에 접지 점선."""
    out = Cv(48, 16)
    def put(b, x, y):
        for j in range(b.h):
            for i in range(b.w):
                if b.a[j, i, 3] and 0 <= x + i < 48 and 0 <= y + j < 16: out.a[y + j, x + i] = b.a[j, i]
    for (fr, face, x, y) in (('aka', 1, 0, 2), ('sora', -1, 16, 0), ('midori', 1, 32, 1)):
        put(_mini_bike(fr, face), x, y)
    return out

# ───────────────────────── 8. 상점가 가로등 깃발 기둥 ─────────────────────────
def street_flag(col='aka'):
    """16x48: 기둥 + 위 작은 구형 등 + 옆으로 뻗은 팔에 매단 세로 깃발(색 마크 하나) + 밑동."""
    c = Cv(16, 48)
    c.R(4, 10, 3, 34, K('tekko', 1)); c.VL(4, 10, 34, K('tekko', 4)); c.VL(6, 10, 34, K('tekko', -1))
    c.R(3, 40, 5, 4, K('tekko', 2)); c.HL(3, 40, 5, K('tekko', 5)); c.R(2, 44, 7, 3, K('hodo', 3)); c.HL(2, 44, 7, K('hodo', 5)); c.HL(2, 46, 7, K('hodo', -1))
    for j in range(5):
        w = (3, 4, 4, 4, 3)[j]; x0 = 5 - w // 2
        for i in range(w): c.P(x0 + i, 3 + j, K('shiro', 4) if (j < 2 and i == 0) else K('kii', 4) if j >= 3 else K('shiro', 3))
    c.R(3, 8, 5, 2, K('tekko', 3)); c.HL(3, 8, 5, K('tekko', 5))
    c.R(7, 12, 8, 2, K('tekko', 2)); c.HL(7, 12, 8, K('tekko', 5))
    c.R(8, 14, 6, 22, K(col, 1)); c.VL(8, 14, 22, K(col, 3)); c.VL(13, 14, 22, K(col, -1)); c.HL(8, 14, 6, K(col, 4)); c.HL(8, 35, 6, K(col, -2))
    for j in range(17, 25):
        for i in range(8, 14):
            d = (i - 10.5) ** 2 + (j - 20.5) ** 2
            if d <= 7: c.P(i, j, K('shiro', 3) if d > 3.5 else K('shiro', 4))
    return _ol(c)


# ───────────────────────── 9. 상점가 아치 (8x5칸) ─────────────────────────
def _arch(text, ramp, trim, step=22):
    """128x80. 양 기둥(콘크리트, 윤곽 통일) + 간판 상자(윗면 + 앞면 + 안 판) + 가운데 한자(획 2px·그림자 1px) + 윗면 위 전구 점 + 아래로 늘어진 색 깃발 줄."""
    W, H = 128, 80; c = Cv(W, H)
    for px in (6, W - 16):                                                                  # 기둥 + 받침
        c.R(px, 30, 10, 47, K('tekko', 2)); c.VL(px, 30, 47, K('tekko', 4)); c.VL(px + 1, 30, 47, K('tekko', 3)); c.VL(px + 9, 30, 47, K('tekko', 0))
        c.R(px - 2, 74, 14, 5, K('hodo', 3)); c.HL(px - 2, 74, 14, K('hodo', 5)); c.HL(px - 2, 78, 14, K('hodo', -1))
    c.R(2, 3, W - 4, 4, K(ramp, 1)); c.HL(2, 3, W - 4, K('shiro', 4))                        # 간판 윗면
    c.R(2, 7, W - 4, 24, K(ramp, -2)); c.VL(2, 7, 24, K(ramp, 0)); c.VL(W - 3, 7, 24, K(ramp, -3)); c.HL(2, 30, W - 4, K(ramp, -3))
    c.R(5, 10, W - 10, 18, K(ramp, -1)); c.HL(5, 10, W - 10, K(ramp, 0))
    for i in range(10, W - 10, 8): c.R(i, 4, 3, 2, K(trim, 3))                                 # 전구 점
    n = len(text); x = (W - step * (n - 1) - 17) // 2
    out = ink2(c)
    for k, ch in enumerate(text): _gl_bold2(out, x + k * step + 1, 12, ch, K(ramp, -3))
    for k, ch in enumerate(text): _gl_bold2(out, x + k * step, 11, ch, K('shiro', 4) if trim != 'kii' else K('kii', 4))
    # 늘어진 색 깃발 줄(윗 줄 1px + 삼각 깃발), 기둥 사이에만
    fl = Cv(W, H); cols = [('kii', 3), ('shiro', 3), ('aka', 1), ('shiro', 3), ('sora', 1)] if trim != 'kii' else [('shiro', 3), ('kii', 3), ('sora', 1), ('kii', 3), ('aka', 1)]
    xs = list(range(22, W - 26, 8))
    for k, fx in enumerate(xs):
        cn, ct = cols[k % len(cols)]
        for j in range(6):
            w = 6 - j if j < 5 else 1
            for i in range(max(w, 1)): fl.P(fx + (6 - w) // 2 + i, 33 + j, K(cn, ct))
    fl = _ol(fl)
    for x_ in range(20, W - 24): fl.P(x_, 32, DARK())
    for j in range(H):
        for i in range(W):
            if fl.a[j, i, 3] and out.a[j, i, 3] == 0: out.a[j, i] = fl.a[j, i]
    return out

def arch_shotengai():
    """상점가 게이트 8x5칸: 초록 간판 + 흰 '商店街' (+ 노란 전구 점). 기둥 열 0·7 이 막힌다."""
    return _arch('商店街', 'midori', 'kii')

def arch_shotengai2():
    """같은 크기 변형: 붉은 간판 + 흰 '南口'. 기둥 열 0·7 이 막힌다."""
    return _arch('南口', 'aka', 'kii', step=26)


# ───────────────────────── 10. 함석지붕 시장 점포 (4x4칸) ─────────────────────────
def tin_stall(v=0):
    """64x64. 물결 함석 지붕(경사 윗면 12px + 앞 가장자리 4px, 세로 골) + 처마 그늘 + 나무 기둥 2 + 노렌 3폭 + 초롱 + 진열대(윗면 + 앞면) + 물건. v=0 녹슨 갈색 지붕·남색 노렌·채소 / 1 청회 지붕·적색 노렌·생선 / 2 녹회색 지붕·남색-흰 노렌·병·통조림."""
    c = Cv(64, 64)
    roof = [('daidai', -1), ('tairu', 1), ('lino', 1)][v]; rn, rt = roof
    # 뒤벽(어두움)
    c.R(5, 19, 54, 38, K('yoru', 0)); c.R(5, 19, 54, 3, K('yoru', -2))
    # 기둥
    for px in (3, 59):
        c.R(px, 18, 3, 40, K('ita', 0)); c.VL(px, 18, 40, K('ita', 3)); c.VL(px + 2, 18, 40, K('ita', -2))
    # 노렌 3폭 + 막대
    ncol = [(('kon', 0), ('shiro', 3)), (('aka', 0), ('shiro', 3)), (('kon', 0), ('shiro', 3))][v]
    c.R(15, 21, 42, 2, K('ita', 3)); c.HL(15, 21, 42, K('ita', 5))
    for k in range(3):
        x0 = 17 + k * 13
        base = ('kon', 0) if v == 0 else ('aka', 0) if v == 1 else (('kon', 0) if k != 1 else ('shiro', 2))
        c.R(x0, 23, 12, 13, K(*base)); c.VL(x0, 23, 13, K(base[0], base[1] + 2)); c.VL(x0 + 11, 23, 13, K(base[0], base[1] - 1)); c.HL(x0, 35, 12, K(base[0], base[1] - 2))
        mk = ('shiro', 3) if base[0] != 'shiro' else ('kon', 0)
        c.R(x0 + 4, 27, 4, 4, K(*mk)); c.R(x0 + 5, 28, 2, 2, K(*base)) if v != 1 else c.R(x0 + 4, 28, 4, 2, K(*mk))      # 문양 하나(고리/막대)
    # 초롱
    chochin(c, 10, 22, 8, 12, 'aka')
    # 진열대: 윗면 6px + 앞면 + 다리 그림자
    c.R(5, 42, 54, 6, K('ita', 4)); c.HL(5, 42, 54, K('ita', 6)); c.HL(5, 47, 54, K('ita', 2))
    c.R(5, 48, 54, 9, K('ita', 0)); c.VL(5, 48, 9, K('ita', 2)); c.VL(58, 48, 9, K('ita', -2)); c.HL(5, 56, 54, K('ita', -3))
    for x in (17, 29, 41, 53): c.VL(x, 49, 7, K('ita', -2))
    # 물건
    if v == 0:                                                                              # 채소 상자: 초록·주황 더미
        for k, (cn, ct) in enumerate((('midori', 1), ('daidai', 2), ('midori', 0), ('aka', 1), ('midori', 1), ('kii', 2), ('midori', 0), ('daidai', 1))):
            x0 = 8 + k * 6
            c.R(x0, 37, 6, 6, K('ita', 1)); c.HL(x0, 42, 6, K('ita', -2))
            ellipse(c, x0 + 3, 37, 2.8, 2.6, K(cn, ct), K(cn, min(ct + 1, 2)), None)
    elif v == 1:                                                                            # 생선: 흰 스티로폼 상자 + 은색 생선
        for k in range(4):
            x0 = 8 + k * 13
            c.R(x0, 37, 11, 6, K('shiro', 2)); c.HL(x0, 37, 11, K('shiro', 4)); c.VL(x0 + 10, 37, 6, K('shiro', 0)); c.HL(x0, 42, 11, K('shiro', 0))
            for f in range(2): c.R(x0 + 2 + f * 4, 38 + f % 2, 3, 2, K('conc', 4)); c.P(x0 + 2 + f * 4, 38 + f % 2, K('sora', 2))
    else:                                                                                   # 병·통조림: 서 있는 색 막대
        cols = [('daidai', 1), ('midori', 0), ('aka', 0), ('kii', 1), ('sora', 0), ('shiro', 2), ('daidai', 1), ('midori', 0), ('aka', 0), ('kii', 1), ('sora', 0), ('shiro', 2)]
        for k, (cn, ct) in enumerate(cols):
            x0 = 8 + k * 4; h = 7 + (k % 3)
            c.R(x0, 43 - h, 3, h, K(cn, ct)); c.VL(x0, 43 - h, h, K(cn, ct + 1)); c.HL(x0, 43 - h, 3, K('shiro', 3)) if k % 2 == 0 else None
    # 지붕: 경사 윗면(세로 골 주기 4px: 밝 2/어 2) + 앞 가장자리 + 처마 그늘
    for j in range(12):                                                                     # 윗면: 위가 좁아 보이지 않게 전폭(함석은 앞쪽 경사)
        for x in range(1, 63):
            ph = (x - 1) % 4
            t = rt + 1 + (1 if ph < 2 else 0) + (1 if j < 2 else 0) - (1 if j > 9 else 0)
            c.P(x, 2 + j, K(rn, t))
    for x in range(1, 63): c.P(x, 2, K(rn, rt + 3 if rn != 'daidai' else rt + 2))
    for j in range(4):                                                                      # 앞 가장자리: 한 단 어둡게 + 아래 물결 끝
        for x in range(1, 63):
            ph = (x - 1) % 4
            if j == 3 and ph in (1, 2): continue
            c.P(x, 14 + j, K(rn, rt - 2 + (1 if ph < 2 else 0) - (1 if j >= 2 else 0)))
    for x in range(1, 63): c.P(x, 18, K('yoru', -2)); c.P(x, 19, K('yoru', -1)) if x % 2 == 0 else None
    out = _ol(c)
    for x in range(4, 62):                                                                  # 바닥 접지
        out.P(x, 58, K('hodo', -1)); out.P(x, 59, K('hodo', 0)) if x % 2 == 0 else None
    return out

def tin_stall0(): return tin_stall(0)
def tin_stall1(): return tin_stall(1)
def tin_stall2(): return tin_stall(2)


# ───────────────────────── 11. 환기탑 (2x4칸) ─────────────────────────
def vent_tower():
    """32x64. 콘크리트 탑: 윗면(밝은 덮개 + 안쪽 단) + 앞면 격자 루버 2열 x 4단(위 그림자 단·슬랫 밝은 줄 + 어두운 틈) + 중앙 기둥 + 밑 플린스."""
    c = Cv(32, 64)
    c.R(1, 1, 30, 7, K('conc', 5)); c.HL(1, 1, 30, K('shiro', 4)); c.R(3, 3, 26, 3, K('conc', 4)); c.HL(3, 3, 26, K('shiro', 3)); c.HL(3, 5, 26, K('conc', 2))   # 윗면 + 안쪽 단
    c.R(1, 8, 30, 3, K('conc', 1)); c.HL(1, 8, 30, K('conc', 3)); c.HL(1, 10, 30, K('conc', -1))                                         # 덮개 앞 가장자리
    c.R(3, 11, 26, 46, K('conc', 2)); c.VL(3, 11, 46, K('conc', 4)); c.VL(28, 11, 46, K('conc', 0))
    for row in range(4):
        y0 = 14 + row * 11
        for col in range(2):
            x0 = 5 + col * 12
            c.R(x0, y0, 10, 9, K('yoru', -2)); c.HL(x0, y0, 10, K('conc', -1)); c.VL(x0, y0, 9, K('conc', -1)); c.VL(x0 + 9, y0, 9, K('conc', 3)); c.HL(x0, y0 + 8, 10, K('conc', 4))
            for s in range(2, 8, 2): c.HL(x0 + 1, y0 + s, 8, K('conc', 3)); c.HL(x0 + 1, y0 + s + 1, 8, K('conc', 0)) if s < 6 else None
    c.R(15, 11, 2, 46, K('conc', 1)); c.VL(15, 11, 46, K('conc', 3)); c.VL(16, 11, 46, K('conc', -1))
    c.R(1, 57, 30, 6, K('conc', 3)); c.HL(1, 57, 30, K('shiro', 3)); c.VL(1, 57, 6, K('conc', 5)); c.VL(30, 57, 6, K('conc', 0)); c.HL(1, 62, 30, K('conc', -1))
    return ink2(c, ext=True)


# ───────────────────────── 12. 지상 개찰구 출입구 (6x4칸) ─────────────────────────
def station_gate():
    """96x64. 캔버스(윗면 + 앞 띠: 왼쪽 파랑·오른쪽 주황 노선 색 띠 + 가운데 노선 마크 판) + 양 기둥 + 가운데 자동 유리문(양 날개) + 양옆 노선도 판 + 안쪽 개찰 기둥 + 플린스."""
    c = Cv(96, 64)
    # 캐노피 윗면 5px(뒷가장자리 어두운 선 1 + 밝은 판 3 + 앞 모서리 가장 밝은 선 1) — 앞면 코니스와 분리
    c.R(2, 1, 92, 1, K('conc', 0)); c.R(2, 2, 92, 4, K('conc', 5)); c.HL(2, 3, 92, K('conc', 6)); c.HL(2, 6, 92, K('shiro', 4)); c.VL(2, 2, 5, K('shiro', 4)); c.VL(93, 2, 5, K('conc', 2))
    c.R(2, 7, 92, 10, K('conc', 1)); c.HL(2, 7, 92, K('conc', -1)); c.HL(2, 8, 92, K('conc', 3)); c.HL(2, 16, 92, K('conc', -1)); c.VL(2, 8, 9, K('conc', 3)); c.VL(93, 8, 9, K('conc', -1))   # 앞면 코니스(한 단 어둡다)
    c.R(6, 11, 38, 3, K('sora', 1)); c.HL(6, 11, 38, K('sora', 3)); c.R(52, 11, 38, 3, K('daidai', 1)); c.HL(52, 11, 38, K('daidai', 3))      # 노선 색 띠(앞면 안)
    c.R(18, 17, 2, 3, K('tekko', 1)); c.R(76, 17, 2, 3, K('tekko', 1))                                                                         # 마크 판 걸이
    # 기둥 + 뒤 어두운 안
    for px in (4, 86):
        c.R(px, 17, 6, 41, K('conc', 2)); c.VL(px, 17, 41, K('conc', 4)); c.VL(px + 5, 17, 41, K('conc', -1))
    c.R(10, 17, 76, 41, K('yoru', -1)); c.R(10, 17, 76, 3, K('yoru', -3))
    # 양옆 벽 + 노선도 판(흰 틀 + 색 선)
    for x0 in (11, 69):
        c.R(x0, 22, 16, 22, K('conc', 1)); c.VL(x0, 22, 22, K('conc', 3)); c.VL(x0 + 15, 22, 22, K('conc', -1))
        c.R(x0 + 2, 25, 12, 14, K('shiro', 3)); c.VL(x0 + 13, 25, 14, K('shiro', 0)); c.HL(x0 + 2, 38, 12, K('shiro', 0))
        c.HL(x0 + 3, 28, 9, K('sora', 2)); c.HL(x0 + 3, 31, 9, K('daidai', 2)); c.HL(x0 + 3, 34, 6, K('midori', 1)); c.P(x0 + 6, 28, K('shiro', 4)); c.P(x0 + 9, 31, K('shiro', 4)); c.P(x0 + 8, 34, K('shiro', 4))
        c.R(x0, 44, 16, 14, K('conc', 0)); c.HL(x0, 44, 16, K('conc', 3))
    # 가운데 유리문 2날개 + 문틀
    c.R(30, 20, 36, 38, K('tekko', 1)); c.HL(30, 20, 36, K('tekko', 4))
    for dx in (32, 49):
        c.R(dx, 22, 15, 34, K('garasu', 0)); c.VL(dx, 22, 34, K('garasu', 2)); c.VL(dx + 14, 22, 34, K('garasu', -1)); c.HL(dx, 22, 15, K('garasu', 3))
        for k in range(4): c.P(dx + 3 + k * 2 + 4, 26 + k * 2, K('garasu', 4)); c.P(dx + 4 + k * 2 + 4, 26 + k * 2, K('garasu', 3)) if False else None
        for k in range(8): c.P(dx + 2 + k, 34 - k // 2 + (0), K('garasu', 4)) if False else None
        _line(c, dx + 3, 30, dx + 8, 25, K('garasu', 3)); _line(c, dx + 4, 38, dx + 11, 31, K('garasu', 3))
        c.R(dx, 32, 15, 2, K('tekko', 2)); c.HL(dx, 32, 15, K('tekko', 4))
    c.R(46, 22, 3, 34, K('tekko', 1)); c.VL(46, 22, 34, K('tekko', 3))
    c.R(30, 56, 36, 2, K('hodo', 0))
    # 안쪽 개찰 기둥 실루엣(유리 너머)
    for gx in (36, 56): c.R(gx, 44, 6, 12, K('tekko', -2)); c.HL(gx, 44, 6, K('tekko', 1)); c.R(gx + 2, 46, 2, 2, K('midori', 2))
    # 플린스 + 발판
    c.R(2, 58, 92, 4, K('conc', 3)); c.HL(2, 58, 92, K('shiro', 3)); c.HL(2, 61, 92, K('conc', -1))
    out = ink2(c, ext=True)
    # 노선 마크 판 (가운데 캐노피 앞 매단 판): 둥근 마크, 글자 없음
    out.R(38, 14, 20, 12, K('kon', -1)); out.HL(38, 14, 20, K('kon', 1)); out.VL(38, 14, 12, K('kon', 1)); out.VL(57, 14, 12, K('kon', -2)); out.HL(38, 25, 20, K('kon', -2))
    for j in range(12):
        for i in range(20):
            d = ((i - 9.5) / 6.2) ** 2 + ((j - 5.5) / 4.4) ** 2
            if d <= 1: out.P(38 + i, 14 + j, K('shiro', 4) if d > .55 else K('sora', 2))
    out.R(41, 19, 14, 2, K('shiro', 4)); out.R(44, 19, 8, 2, K('aka', 2))
    return out


# ───────────────────────── 13. 夕やけだんだん (15x5칸, 오르는 돌계단 정면 정사영) ─────────────────────────
def yuyake_stairs():
    """240x80. 위쪽이 좁아지는 원근(양옆 옹벽의 안쪽 면이 위로 갈수록 넓게 보인다): 위(y0~6)는 포장이 이어지는 평지, 아래로 10단 — 디딤판 4px(밝은 돌, 앞 모서리 흰 선, 슬래브 줄눈) + 챌판 3px(어두운 청회) + 단 밑 그림자.
    양옆 낮은 콘크리트 옹벽(윗면 줄눈) 안쪽 면: 왼쪽은 그늘, 오른쪽은 빛을 받는다. 계단 가장자리를 따라 비스듬한 1px 연속 철 난간 + 기둥. 맨 아래는 포장 바닥."""
    W, H = 240, 80; c = Cv(W, H)
    WL = 14; n = 10; STEP = 7; ytop = 7; ybot = ytop + n * STEP                          # 계단 y 범위 [7, 77)
    y0 = ybot
    INS = 18
    def inset(y):                                                                          # 위로 갈수록 안쪽 면이 넓어진다
        t = (ybot - y) / (ybot - 0.0); return int(round(INS * min(max(t, 0), 1)))
    for y in range(H):
        ins = inset(y) if y < ybot else 0
        xl, xr = WL + 3 + ins, W - WL - 3 - ins
        for x in range(WL, xl):                                                            # 왼쪽 옹벽 안쪽 면(그늘): 가로 줄눈 8px
            c.P(x, y, K('tekko', -1) if (y % 8) else K('tekko', -3))
        for x in range(xr, W - WL):                                                        # 오른쪽 옹벽 안쪽 면(빛)
            c.P(x, y, K('conc', 3) if (y % 8) else K('conc', 0))
        if y < ytop:                                                                       # 이어지는 포장
            for x in range(xl, xr): c.P(x, y, K('hodo', 4) if y == 0 else K('hodo', 1) if (y == 3 or (x - 3) % 16 == 0) else K('hodo', 3))
        elif y < ybot:
            k = (y - ytop) // STEP; r = (y - ytop) % STEP
            for x in range(xl, xr):
                if r < 4:
                    col = K('shiro', 3) if r == 3 else K('conc', 5) if r == 0 else K('conc', 3)
                    if r in (1, 2) and (x - xl - 16 - (k % 2) * 24) % 48 == 0: col = K('conc', 1)
                elif r < 6:
                    col = K('tekko', 1) if r == 4 else K('tekko', -1)
                else:
                    col = K('tekko', -3)
                c.P(x, y, col)
            if r < 4:                                                                     # 왼쪽 가장자리 그늘 3px
                for x in range(xl, xl + 3): c.P(x, y, K('conc', 1) if r < 3 else K('conc', 2))
        else:
            for x in range(xl, xr): c.P(x, y, K('hodo', -1) if y == ybot else K('hodo', 1) if (x - 3) % 16 == 0 else K('hodo', 3))
    # 양옆 옹벽 윗면(밝은 슬래브)
    for x0, lit in ((0, True), (W - WL, False)):
        face, jn = (K('conc', 4), K('conc', 1)) if lit else (K('conc', 3), K('conc', 0))
        c.R(x0, 0, WL, H - 9, face)
        for yy in range(7, H - 9, 8): c.HL(x0, yy, WL, jn)
        for yy in range(0, H - 9, 8):
            xj = x0 + (4 if (yy // 8) % 2 == 0 else 9); c.VL(xj, yy, 7, jn)
        c.R(x0, H - 9, WL, 9, K('conc', 1) if lit else K('conc', -1)); c.HL(x0, H - 9, WL, K('shiro', 3) if lit else K('conc', 2)); c.HL(x0, H - 1, WL, K('conc', -2))
        c.VL(x0, 0, H - 9, K('shiro', 4) if lit else K('conc', 4)); c.VL(x0 + WL - 1, 0, H - 9, K('conc', -2))
    out = _ol(c)
    # 비스듬한 철 난간: 계단 가장자리(안쪽 면 경계)를 따라 1px 연속선 + 4행 간격 기둥. 위·아래 끝 기둥 머리
    for side in (-1, 1):
        for y in range(2, ybot - 1):
            ins = inset(y)
            x = (WL + 3 + ins - 1) if side < 0 else (W - WL - 3 - ins)
            out.P(x, y, K('tekko', 6) if side < 0 else K('tekko', -1))
            if y % 5 == 2:
                for dy in range(0, 3): out.P(x + (1 if side < 0 else -1), y + dy, K('tekko', -2))
                out.P(x, y, K('tekko', 6) if side < 0 else K('tekko', -3))
        ins = inset(2); x = (WL + 3 + ins - 1) if side < 0 else (W - WL - 3 - ins)
        out.R(x - 1, 0, 3, 3, K('tekko', 2)); out.HL(x - 1, 0, 3, K('tekko', 6))
        ins = inset(ybot - 2); x = (WL + 3 + ins - 1) if side < 0 else (W - WL - 3 - ins)
        out.R(x - 1, ybot - 4, 3, 4, K('tekko', 2)); out.HL(x - 1, ybot - 4, 3, K('tekko', 6))
    return out


# ───────────────────────── 14. 가설 진열대 4종 (6x2칸, 막힘 없음) ─────────────────────────
def _table(c, cloth, ct, y0=15):
    """접이식 상: 윗면(밝은 나무판) + 앞 천 + 가위다리. 폭 4..91."""
    c.R(4, y0, 88, 4, K('ita', 4)); c.HL(4, y0, 88, K('ita', 6)); c.HL(4, y0 + 3, 88, K('ita', 2))
    c.R(4, y0 + 4, 88, 8, K(cloth, ct)); c.VL(4, y0 + 4, 8, K(cloth, ct + 1)); c.VL(91, y0 + 4, 8, K(cloth, ct - 1)); c.HL(4, y0 + 11, 88, K(cloth, ct - 2))
    for x in range(12, 88, 14): c.VL(x, y0 + 5, 6, K(cloth, ct - 1))                       # 천 주름
    for lx in (8, 84):
        _line(c, lx, y0 + 12, lx + 4, 30, K('tekko', 2)); _line(c, lx + 4, y0 + 12, lx, 30, K('tekko', 2))
    c.R(4, 30, 88, 1, K('hodo', 0))

def shop_cover(v=0):
    """96x32. v0 채소 상자(나무 상자 4 + 초록·주황·붉은 더미) / v1 생선 얼음 상자(흰 상자 + 얼음 + 은색 생선, 파란 천) / v2 튀김대(유리 진열 + 갈색 튀김 + 노란 가격표) / v3 두부(물통 + 흰 두부 + 매단 나무 간판에 남색 마름모)."""
    c = Cv(96, 32)
    if v == 0:
        _table(c, 'kinari', 0)
        for k in range(4):
            x0 = 7 + k * 21
            c.R(x0, 7, 18, 9, K('ita', 1)); c.HL(x0, 7, 18, K('ita', 3)); c.VL(x0, 7, 9, K('ita', 3)); c.VL(x0 + 17, 7, 9, K('ita', -1)); c.HL(x0, 15, 18, K('ita', -2))
            cn = [('midori', 0), ('daidai', 1), ('aka', 0), ('kii', 1)][k]
            for i in range(3):
                ellipse(c, x0 + 3.5 + i * 5, 7, 3.2, 3, K(*cn), K(cn[0], cn[1] + 1), K(cn[0], cn[1] - 1))
    elif v == 1:
        _table(c, 'sora', 0)
        FISH = ("t..bbbbbb.", "ttsssssksb", "ttwwwwwwws", "t..wwwwww.")                                 # 은빛 생선 10x3(머리 오른쪽): b 등(어두운 청) / s 옆면 / w 배 / k 눈 / t 꼬리
        for k in range(3):                                                                   # 위가 열린 얼음 상자 3개: 뒷 테두리 윗면 + 얼음 바닥 8px(내용물 얹힘) + 앞 테두리 앞면 4px
            x0 = 8 + k * 28
            c.R(x0, 2, 25, 1, K('shiro', 4)); c.VL(x0, 2, 13, K('shiro', 4)); c.VL(x0 + 24, 2, 13, K('shiro', 0))                       # 뒷 테두리(밝음) + 좌우 벽
            c.R(x0 + 1, 3, 23, 8, K('garasu', 3)); c.HL(x0 + 1, 3, 23, K('garasu', 0)); c.HL(x0 + 1, 4, 23, K('garasu', 1))           # 얼음면(뒷벽 그늘이 위)
            for yy in range(5, 11):                                                                                                    # 얼음 알갱이: 규칙 격자 1색
                for xx in range(x0 + 2, x0 + 23):
                    if (xx + yy * 2) % 6 == 0: c.P(xx, yy, K('shiro', 4))
            if k == 0:                                                                       # 은빛 생선 3마리: 뒷줄 1마리(뒷 테두리 위로 솟음) + 앞줄 2마리
                cm = {'b': K('sora', -1), 's': K('tekko', 4), 'w': K('conc', 5), 'k': K('shiro', 4), 't': K('tekko', 3)}
                for (fx, fy) in ((x0 + 8, 0), (x0 + 2, 5), (x0 + 13, 6)):
                    for j, row in enumerate(FISH):
                        for i, ch in enumerate(row):
                            if ch != '.': c.P(fx + i, fy + j, cm[ch])
            else:                                                                            # 덩이 5개를 쌓는다: 뒷줄 3개(뒷 테두리 위로 솟음) + 앞줄 2개
                for (fx, fy) in ((x0 + 2, 1), (x0 + 9, 1), (x0 + 16, 1), (x0 + 5, 6), (x0 + 13, 6)):
                    if k == 1:                                                               # 연어 토막: 주황 몸 + 흰 결 줄 + 어두운 아랫변
                        c.R(fx, fy, 6, 5, K('daidai', 3)); c.HL(fx, fy, 6, K('daidai', 4)); c.HL(fx + 1, fy + 2, 4, K('shiro', 4)); c.HL(fx + 1, fy + 3, 4, K('shiro', 4)); c.VL(fx + 5, fy, 5, K('daidai', 2)); c.HL(fx, fy + 4, 6, K('daidai', 1))
                    else:                                                                    # 참치 덩이: 윗면(밝은 붉음) 2px + 앞면(붉음) 3px + 아랫변
                        c.R(fx, fy, 6, 2, K('aka', 4)); c.HL(fx, fy, 6, K('pinku', 4)); c.R(fx, fy + 2, 6, 3, K('aka', 2)); c.VL(fx + 5, fy + 2, 3, K('aka', 1)); c.HL(fx, fy + 4, 6, K('aka', 0))
            c.R(x0, 12, 25, 4, K('conc', 5)); c.HL(x0, 11, 25, K('shiro', 4)); c.HL(x0, 12, 25, K('shiro', 1)); c.VL(x0, 11, 5, K('shiro', 4)); c.VL(x0 + 24, 11, 5, K('conc', 2)); c.HL(x0, 15, 25, K('conc', 2))   # 앞 테두리 앞면(한 단 어둡게)
    elif v == 2:
        _table(c, 'aka', -1)
        c.R(6, 4, 84, 11, K('garasu', 1)); c.HL(6, 4, 84, K('garasu', 4)); c.VL(6, 4, 11, K('garasu', 3)); c.VL(89, 4, 11, K('garasu', 0))
        c.R(8, 6, 80, 8, K('garasu', -1))
        for k in range(8):
            x0 = 10 + k * 10
            ellipse(c, x0 + 4, 11, 4, 2.6, K('kawara', 1), K('daidai', 1), K('kawara', -1)); c.P(x0 + 2, 10, K('daidai', 2))
        for x in range(8, 88, 20): c.R(x, 1, 8, 4, K('kii', 3)); c.HL(x, 1, 8, K('kii', 4)); c.R(x + 2, 3, 4, 1, K('tekko', -2))     # 가격표
        c.R(6, 15, 84, 1, K('tekko', 1))
    else:
        _table(c, 'conc', 0)
        c.R(6, 3, 52, 1, K('conc', 5)); c.R(6, 4, 52, 8, K('sora', 0)); c.HL(7, 4, 50, K('sora', -2)); c.HL(7, 5, 50, K('sora', -1))      # 물통: 뒷 테두리 윗면(밝음) + 물(뒤가 어둡다)
        c.R(6, 12, 52, 4, K('conc', 4)); c.HL(6, 12, 52, K('shiro', 3)); c.VL(6, 3, 13, K('conc', 5)); c.VL(57, 3, 13, K('conc', 1)); c.HL(6, 15, 52, K('conc', 1))   # 앞 테두리 앞면
        for k in range(4):                                                                                                    # 4덩이: 두부 3(크림색) + 유부 1(갈색). 덩이 사이로 물이 보인다
            x0 = 8 + k * 12; fried = (k == 2)
            top, face, side = (K('daidai', 1), K('kawara', 0), K('kawara', -1)) if fried else (K('shiro', 4), K('kinari', 3), K('kinari', 1))
            h = 2 if fried else 3
            c.R(x0, 8 - h + 1, 10, h + 2, top)                                                                                 # 윗면
            c.HL(x0, 8 - h + 1, 10, K('shiro', 4) if not fried else K('daidai', 3)); c.HL(x0, 8, 10, K('kinari', 5) if not fried else K('daidai', 2))                                         # 윗면 앞 모서리 밝음
            c.R(x0, 8 + 1, 10, 3, face); c.VL(x0 + 9, 8 + 1, 3, side); c.HL(x0, 8 + 3, 10, side)                                # 앞면
            c.HL(x0, 12 - 1, 10, K('sora', 1))                                                                                # 물에 잠긴 밑선
        c.R(62, 3, 28, 4, K('ita', 6)); c.HL(62, 3, 28, K('ita', 4)); c.VL(62, 3, 4, K('ita', 6)); c.HL(62, 6, 28, K('ita', 5)); c.VL(89, 3, 4, K('ita', 3))   # 나무 상자 윗면 4px(밝음)
        c.HL(62, 7, 28, K('ita', 0))                                                                                                                         # 윗면/앞면 경계 그늘
        c.R(62, 8, 28, 7, K('ita', 3)); c.VL(62, 8, 7, K('ita', 5)); c.VL(89, 8, 7, K('ita', 0)); c.HL(62, 14, 28, K('ita', 1))                              # 앞면
        for j in range(7):
            w = min(j, 6 - j) + 1
            for i in range(-w, w + 1): c.P(76 + i, 8 + j - (1 if j else 0), K('kon', 0)) if 8 + j - (1 if j else 0) <= 14 else None
        c.R(75, 10, 3, 3, K('shiro', 3))
        c.HL(62, 15, 28, K('ita', -3))                                                                                        # 접지선
    out = _ol(c)
    return out

def shop_cover0(): return shop_cover(0)
def shop_cover1(): return shop_cover(1)
def shop_cover2(): return shop_cover(2)
def shop_cover3(): return shop_cover(3)


def register(reg_prop, reg_deco, add, STREET):
    reg_prop('utility_pole2', utility_pole2(), (0,), '전봇대(가는 기둥+완금+변압기+전선 토막)')
    reg_prop('lamp_post', lamp_post(), (0,), '주오도리식 가로등')
    reg_prop('cat.sit', cat_sit(), (), '앉은 고양이(삼색)')
    reg_prop('cat.loaf', cat_loaf(), (), '식빵 자세 고양이')
    reg_prop('cat.wood', cat_wood(), (), '처마 위 목각 고양이')
    reg_prop('slide', slide(), (0, 1, 2), '미끄럼틀')
    reg_prop('swing', swing(), (0, 2), '그네')
    reg_prop('sandbox', sandbox(), (), '모래판')
    reg_prop('coin_sign', coin_sign(), (0,), '코인 주차 요금판')
    reg_prop('a_frame', a_frame(), (), 'A자 입간판')
    reg_prop('bike_cluster', bike_cluster(), (), '자전거 무리')
    reg_prop('street_flag', street_flag(), (0,), '상점가 가로등 깃발 기둥')
    reg_prop('arch_shotengai', arch_shotengai(), (0, 7), '상점가 아치(商店街)')
    reg_prop('arch_shotengai2', arch_shotengai2(), (0, 7), '상점가 아치 변형(南口)')
    for i, f in enumerate((tin_stall0, tin_stall1, tin_stall2)): reg_prop(f'tin_stall.{i}', f(), (0, 1, 2, 3), '함석지붕 시장 점포')
    reg_prop('vent_tower', vent_tower(), (0, 1), '오다큐 환기탑')
    reg_prop('station_gate', station_gate(), (0, 1, 4, 5), '지상 개찰구 출입구')
    reg_prop('yuyake_stairs', yuyake_stairs(), (), '夕やけだんだん 돌계단(15x5, 걸을 수 있음)')
    for i, f in enumerate((shop_cover0, shop_cover1, shop_cover2, shop_cover3)): reg_prop(f'shop_cover.{i}', f(), (), '상점가 가설 진열대')
