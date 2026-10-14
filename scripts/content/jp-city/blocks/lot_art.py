"""빈터 쓰임(lot use) 손 도트 키트 — street_hand 가 register(prop) 로 등록한다(rail_art 와 같은 방식).
2026-10-14 사용자: 「jp_city 거리·광장의 빈 땅이 거슬린다. 실제 일본 도시는 남는 땅을 쓰임으로 채운다」 — 코인 주차, 자판기·자전거 틈,
쓰레기 집하, 작은 놀이터, 텃밭, 공사장 가림막, 광장 시계탑·분수·화단·매점. 구성기(src/project/jpCityStreetComposer.ts 의 빈터 쓰임 단계)가 이 키트를 고른다.
화풍: street_hand·rail_art 와 같다(modern3 램프만, sumi 윤곽, 빛 왼쪽 위, 정면 고정 3/4). 글자·상표·사람 없음(간판은 읽히지 않는 줄무늬).
3/4 관문 교훈: 판정자는 몸체 위쪽 줄을 센다 → 깊은(5줄+) 밝은 윗면 + 뒤 모서리 OL + 어두운 앞면, 얇은 것은 두껍게.
키트 id 는 `lot-*`. ENABLED 에 든 것만 등록한다(관문 통과분). 후보 미리보기: python3 scripts/content/jp-city/blocks/lot_art.py OUT.png"""
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'houses')); sys.path.insert(0, HERE)
from house_kit import K, OL            # noqa: E402
from rail_art import deck, slab, disc  # noqa: E402

CANDIDATES = []


def _spec(id_, name, w, h, kind, solid=(), other='star', tags=(), rules=''):
    def deco(fn):
        CANDIDATES.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=list(solid), other=other, tags=list(tags), rules=rules))
        return fn
    return deco


def top_face(c, x, y, w, rows, ramp, t=1, edge=True, grain=True):
    """street_hand.top_face 와 같다(순환 import 를 피해 옮겨 둠): 밝고 결 있는 윗면 + 한 칸 들인 테두리 홈 + 앞 모서리 어두운 줄 + 뒤·옆 OL.
    관문 판정자는 이 「판 테두리」가 있어야 윗면으로 센다(가로 띠만 있는 deck 은 「1px 윤곽」으로 읽혔다, 2026-10-14)."""
    c.R(x, y, w, rows, K(ramp, t + 1))
    if grain:
        for j in range(1, rows - 1, 2):
            for i in range(x + (j * 3) % 5, x + w, 7): c.HL(i, y + j, 3, K(ramp, t))
        for i in range(x + 1, x + w, 5): c.P(i, y + (i * 3) % max(1, rows - 1), K(ramp, t + 2))
    if rows >= 5 and w >= 6:
        c.HL(x + 1, y + 1, w - 2, K(ramp, t - 1)); c.VL(x + 1, y + 1, rows - 2, K(ramp, t - 1)); c.VL(x + w - 2, y + 1, rows - 2, K(ramp, t - 1))
        c.HL(x + 2, y + 2, w - 4, K(ramp, t + 3))
    if edge: c.HL(x, y + rows - 1, w, K(ramp, -3))
    c.HL(x, y - 1, w, OL); c.VL(x - 1, y - 1, rows + 1, OL); c.VL(x + w, y - 1, rows + 1, OL)


def roof(c, x, y, w, rows, ramp, t=2):
    """현장 사무소 지붕(관문 통과)과 같은 짜임: 결 있는 밝은 윗면 deck + 한 칸 넓은 앞 입술 2줄 + OL. 다음 줄부터 앞면."""
    deck(c, x, y, w, rows, ramp, t, ends=True)
    c.R(x - 1, y + rows, w + 2, 2, K(ramp, t - 3)); c.HL(x - 1, y + rows, w + 2, K(ramp, t - 2)); c.HL(x - 1, y + rows + 2, w + 2, OL)
    c.VL(x - 2, y + rows - 1, 3, OL); c.VL(x + w + 1, y + rows - 1, 3, OL)
    return y + rows + 3


def cylinder(c, cx, rx, top, bot, body):
    """원통 몸(버스 정류장 기둥과 같은 짜임 — 관문 통과): 왼쪽 밝고 오른쪽 어두운 곡면. body(y) → 램프 이름."""
    for y in range(top, bot):
        for i in range(-rx, rx):
            sh = 2 if i < -rx // 2 else 1 if i < 0 else 0 if i < rx // 2 else -2
            c.P(cx + i, y, K(body(y), sh))
        c.P(cx - rx - 1, y, OL); c.P(cx + rx, y, OL)
    for i in range(-rx - 1, rx + 1): c.P(cx + i, bot - (0 if abs(i + 0.5) < rx * 0.5 else 1 if abs(i + 0.5) < rx * 0.85 else 2), OL)


def shadow(c, x, y, w):
    c.HL(x, y, w, K('yoru', -2)); c.HL(x + 1, y + 1, w - 2, K('yoru', -1))


def box(c, x, y, w, top, front, ramp, t=2, fr=None, ft=-1):
    """윗면 top 줄(밝다) + 앞면 front 줄(어둡다)의 상자. 윤곽 OL. 앞면 램프 fr(없으면 같은 램프)."""
    top_face(c, x, y, w, top, ramp, t)
    fr = fr or ramp
    c.R(x, y + top, w, front, K(fr, ft))
    c.HL(x, y + top, w, K(fr, ft + 1))
    c.VL(x, y + top, front, K(fr, ft + 1)); c.VL(x + w - 1, y + top, front, K(fr, ft - 2))
    c.VL(x - 1, y + top, front, OL); c.VL(x + w, y + top, front, OL); c.HL(x - 1, y + top + front, w + 2, OL)


# ───────────────────────── 코인 주차 ─────────────────────────
@_spec('lot-bay', '코인 주차 한 칸(흰 선·잠금판·차막이·번호판 자리, 6×3)', 6, 3, 'flat', other='flat', tags=['주차', '코인 파킹', '노면'],
       rules='아스팔트(생활도로) 위 3층 덧그림. 세로로 3줄 간격으로 쌓아 주차장을 만든다. 차(jp-prop-car-*)를 같은 칸 x+0, y+0 에 놓으면 주차 중.')
def lot_bay(c):
    c.HL(0, 1, 96, K('shiro', 2)); c.HL(0, 2, 96, K('shiro', 1)); c.HL(0, 3, 96, K('yoru', -2))                 # 칸 경계 흰 선(위)
    c.R(0, 1, 2, 46, K('shiro', 1)); c.VL(2, 1, 46, K('yoru', -2))                                            # 진입 반대쪽 끝 선
    # 차막이(輪留め): 남북으로 누운 콘크리트 막대 — 윗면 밝게, 남쪽 끝면 어둡게
    c.VL(81, 13, 26, OL); c.VL(88, 13, 26, OL); c.HL(82, 12, 6, OL)
    c.R(82, 13, 6, 23, K('conc', 2)); c.VL(82, 13, 23, K('conc', 3)); c.VL(87, 13, 23, K('conc', 0))
    for y in range(17, 35, 6): c.HL(83, y, 4, K('conc', 1))
    c.R(82, 36, 6, 3, K('conc', -2)); c.HL(81, 39, 8, OL); c.HL(82, 40, 6, K('yoru', -2))
    # 잠금판(ロック板): 칸 한가운데 낮은 철판 + 노랑 띠
    c.R(40, 25, 16, 9, K('tekko', -1)); c.HL(40, 25, 16, K('tekko', 1)); c.R(42, 27, 12, 2, K('kii', 1)); c.R(42, 30, 12, 2, K('tekko', 0))
    c.HL(39, 24, 18, OL); c.VL(39, 25, 9, OL); c.VL(56, 25, 9, OL); c.HL(39, 34, 18, OL)
    # 번호 칠 자리(읽히지 않는 흰 판)
    c.R(66, 6, 8, 5, K('shiro', 2)); c.P(68, 8, K('yoru', -1)); c.P(71, 8, K('yoru', -1))


@_spec('lot-pay', '코인 주차 정산기(1×2)', 1, 2, 'box', solid=[(0, 1)], tags=['주차', '정산기', '코인 파킹'],
       rules='코인 주차장 입구 쪽 가장자리, 주차 칸 옆 한 칸. 앞(남쪽)이 보도나 통로.')
def lot_pay(c):
    """열차 지붕(관문 통과)과 같은 짜임: 깊은 윗면(10줄) 위에 작은 상자(윗면+앞면) + 처마 줄 + 짧은 앞면."""
    c.HL(1, 2, 14, OL); c.VL(0, 2, 23, OL); c.VL(15, 2, 23, OL)
    deck(c, 1, 3, 14, 10, 'conc', 3, ends=False)                                                  # 윗면(깊게)
    deck(c, 3, 5, 6, 3, 'kii', 1, ends=True)                                                      # 윗면 위 표시등 상자
    c.R(3, 8, 6, 2, K('kii', -1)); c.HL(2, 10, 8, OL)
    c.R(10, 7, 3, 2, K('tekko', 1)); c.HL(10, 9, 3, K('tekko', -2))                               # 영수증 덮개
    c.HL(1, 13, 14, K('tekko', -3)); c.HL(1, 14, 14, OL)                                           # 처마(윗면 ↔ 앞면)
    c.R(1, 15, 14, 10, K('conc', -1)); c.VL(1, 15, 10, K('conc', 0)); c.VL(14, 15, 10, K('conc', -3))
    c.HL(1, 15, 14, K('kii', 1))
    c.R(3, 17, 7, 3, K('garasu', -1)); c.HL(3, 17, 7, K('garasu', 1))
    c.R(3, 22, 3, 1, OL); c.P(8, 22, K('aka', 1)); c.P(10, 22, K('midori', 1)); c.P(11, 18, K('kii', 1))
    c.HL(0, 25, 16, OL)
    shadow(c, 1, 26, 14)


@_spec('lot-board', '코인 주차 요금 안내판(기둥, 1×3)', 1, 3, 'column', solid=[(0, 2)], tags=['주차', '안내판', '코인 파킹'],
       rules='코인 주차장 모서리(보도 쪽). 글자 없는 요금 줄무늬판.')
def lot_board(c):
    """코인 주차 요금 기둥(원통): 위에서 본 큰 타원 윗면 + 노랑 머리띠 + 읽히지 않는 요금 줄 + 받침."""
    cx, rx = 8, 6
    cylinder(c, cx, rx, 7, 40, lambda y: 'kii' if y < 14 else 'shiro' if y < 33 else 'tekko')
    for j, w in ((18, 8), (21, 6), (24, 8), (27, 5), (30, 7)): c.HL(cx - 4, j, w, K('sora', -1))
    c.R(cx - 4, 15, 3, 2, K('sora', 0))
    disc(c, cx, 5, 7, 4, 'kii', 1)
    for i in (-4, -1, 2): c.P(cx + i, 4, K('kii', 2))
    c.R(2, 41, 12, 4, K('conc', -1)); c.HL(2, 41, 12, K('conc', 2)); c.HL(1, 45, 14, OL); c.VL(1, 41, 4, OL); c.VL(14, 41, 4, OL)
    shadow(c, 1, 46, 14)


# ───────────────────────── 놀이터 ─────────────────────────
@_spec('lot-slide', '놀이터 미끄럼틀(둥근 발판탑·동쪽으로 내려오는 미끄럼면, 3×3)', 3, 3, 'structure', solid=[(0, 1), (0, 2), (1, 2)], tags=['놀이터', '공원', '미끄럼틀'],
       rules='작은 공원·놀이터 안. 탑(왼쪽)만 막힘, 미끄럼 끝(오른쪽 아래)은 지나간다. 앞(남쪽) 한 칸은 비운다.')
def lot_slide(c):
    """둥근 발판탑(원통 — 위에서 본 큰 타원 윗면) + 동쪽 아래로 내려오는 미끄럼면(안쪽 면이 위에서 보인다)."""
    cx, rx = 11, 9
    # 미끄럼면: 탑 오른쪽 위에서 오른쪽 아래 땅으로
    for x in range(18, 46):
        t = min(1.0, (x - 18) / 24.0)
        y0 = int(round(14 + t * 20))
        c.P(x, y0, OL); c.P(x, y0 + 1, K('kii', 0))
        for j in range(2, 8): c.P(x, y0 + j, K('kii', 2 if j < 5 else 1))
        c.P(x, y0 + 8, K('kii', -1)); c.P(x, y0 + 9, K('kii', -2)); c.P(x, y0 + 10, OL)
        if x % 6 == 2: c.VL(x, y0 + 2, 3, K('shiro', 2))
        if x > 24 and x % 3 == 0: c.P(x, y0 + 11 + int((44 - y0 - 11) * 0.0), K('yoru', -1))
    c.VL(46, 34, 11, OL)
    c.R(36, 33, 2, 12, K('tekko', 0)); c.VL(36, 33, 12, K('tekko', 1)); c.VL(35, 33, 12, OL); c.VL(38, 33, 12, OL)   # 받침 다리
    cylinder(c, cx, rx, 12, 44, lambda y: 'sora' if y < 30 else 'tekko')                          # 탑 몸(원통)
    for y in range(16, 30, 4): c.HL(cx - rx + 2, y, 2 * rx - 4, K('sora', -2))                    # 탑 둘레 띠
    c.R(cx - 3, 31, 6, 13, K('yoru', -1)); c.VL(cx - 4, 31, 13, OL); c.VL(cx + 3, 31, 13, OL)        # 탑 밑 출입구(어둠)
    disc(c, cx, 9, 10, 6, 'sora', 1)                                                              # 발판 윗면(큰 타원)
    c.HL(cx - 7, 6, 14, K('sora', 2)); c.HL(cx - 5, 5, 10, K('sora', 2))
    for i in (-9, 9): c.R(cx + i - (1 if i > 0 else 0), 1, 2, 8, K('aka', 0))                     # 난간 기둥
    c.HL(cx - 9, 1, 19, K('aka', 1)); c.HL(cx - 9, 0, 19, OL)
    shadow(c, 2, 45, 44)


@_spec('lot-spring', '놀이터 스프링 놀이기구(오리, 1×2)', 1, 2, 'figure', solid=[(0, 1)], tags=['놀이터', '공원'],
       rules='놀이터 안. 둘을 한 칸 띄워 놓는다.')
def lot_spring(c):
    top_face(c, 2, 22, 12, 5, 'conc', 1, grain=False)                                             # 받침판 윗면
    c.R(2, 27, 12, 2, K('conc', -2)); c.VL(1, 27, 2, OL); c.VL(14, 27, 2, OL); c.HL(1, 29, 14, OL)
    for j in range(6): c.HL(6, 17 + j, 4, K('tekko', 2 if j % 2 else -1))                         # 스프링
    c.VL(5, 17, 6, OL); c.VL(10, 17, 6, OL)
    for j in range(-5, 6):                                                                       # 몸통(등이 위에서 보인다)
        for i in range(-6, 7):
            if (i * i) / 36.0 + (j * j) / 16.0 <= 1.0:
                c.P(9 + i, 12 + j, K('kii', 2 if j < -1 else 1 if j < 2 else 0 if i < 3 else -1))
            elif (i * i) / 49.0 + (j * j) / 22.0 <= 1.0: c.P(9 + i, 12 + j, OL)
    for j in range(-4, 4):                                                                       # 머리
        for i in range(-4, 4):
            d = (i * i + j * j)
            if d <= 9: c.P(4 + i, 5 + j, K('kii', 2 if j < 0 else 1))
            elif d <= 15: c.P(4 + i, 5 + j, OL)
    c.R(0, 6, 2, 2, K('daidai', 1)); c.P(0, 8, K('daidai', -1))                                  # 부리
    c.P(4, 4, OL); c.HL(7, 9, 4, K('kii', 2))
    c.R(5, 11, 2, 1, K('aka', 0)); c.R(12, 11, 2, 1, K('aka', 0))                                # 손잡이
    shadow(c, 3, 30, 11)


@_spec('lot-sandbox', '놀이터 모래판(나무 테두리, 3×2)', 3, 2, 'container', solid=[], tags=['놀이터', '공원', '모래'],
       rules='놀이터 안. 들어가 놀 수 있다(막힘 없음).')
def lot_sandbox(c):
    c.HL(1, 3, 46, OL); c.VL(0, 4, 26, OL); c.VL(47, 4, 26, OL); c.HL(1, 30, 46, OL)
    c.R(1, 4, 46, 4, K('ita', 2)); c.HL(1, 4, 46, K('ita', 0)); c.HL(1, 7, 46, K('ita', 1))       # 뒤 테 윗면
    c.R(1, 8, 4, 16, K('ita', 2)); c.R(43, 8, 4, 16, K('ita', 1))                                # 옆 테 윗면
    c.R(5, 8, 38, 16, K('yuka', 1))                                                              # 모래
    c.HL(5, 8, 38, K('yuka', -1)); c.HL(5, 9, 38, K('yuka', 0)); c.VL(5, 8, 16, K('yuka', 0))     # 뒤·왼쪽 테 그늘
    for i in range(7, 42, 3):
        for j in range(11, 23, 4): c.P(i + (j % 2), j, K('yuka', 2)); c.P(i + 1, j + 2, K('yuka', 0))
    for j in range(-2, 3):                                                                       # 모래 둔덕
        for i in range(-6, 7):
            if (i * i) / 36.0 + (j * j) / 5.0 <= 1.0: c.P(16 + i, 15 + j, K('yuka', 2 if j < 0 else 1))
    c.R(30, 13, 5, 5, K('sora', 0)); c.HL(30, 13, 5, K('sora', 2)); c.HL(31, 14, 3, K('sora', -2)); c.VL(29, 13, 5, OL); c.VL(35, 13, 5, OL); c.HL(29, 18, 7, OL)   # 양동이
    c.HL(23, 19, 5, K('aka', 1)); c.R(27, 18, 2, 2, K('aka', 0))                                # 삽
    c.R(1, 24, 46, 3, K('ita', 2)); c.HL(1, 24, 46, K('ita', 1))                                 # 앞 테 윗면
    c.R(1, 27, 46, 3, K('ita', -2)); c.HL(1, 27, 46, K('ita', -1))                               # 앞 테 앞면
    for x in range(10, 46, 12): c.VL(x, 27, 3, K('ita', -3))
    shadow(c, 1, 30, 46)


# ───────────────────────── 텃밭 ─────────────────────────
def _bed(c, x, y, w, crop):
    """나무 틀 두둑 하나: 뒤 테 윗면 · 흙 · 작물 · 앞 테 윗면/앞면."""
    c.HL(x, y - 1, w, OL); c.VL(x - 1, y, 15, OL); c.VL(x + w, y, 15, OL); c.HL(x, y + 15, w, OL)
    c.R(x, y, w, 3, K('ita', 1)); c.HL(x, y, w, K('ita', 0))
    c.R(x, y + 3, w, 7, K('soil', -1))
    for i in range(x + 1, x + w - 1, 3): c.P(i, y + 4 + (i % 4), K('soil', 0)); c.P(i + 1, y + 8, K('soil', -2))
    c.R(x, y + 10, w, 2, K('ita', 2)); c.R(x, y + 12, w, 3, K('ita', -2)); c.HL(x, y + 12, w, K('ita', -1))
    if crop == 'cabbage':
        for cx in range(x + 5, x + w - 3, 9):
            for j in range(-3, 4):
                for i in range(-4, 5):
                    if (i * i) / 16.0 + (j * j) / 9.0 <= 1.0: c.P(cx + i, y + 6 + j, K('midori', 2 if j < 0 else 1 if i < 2 else 0))
            c.P(cx - 1, y + 5, K('lino', 2)); c.P(cx, y + 6, K('midori', -1)); c.HL(cx - 4, y + 9, 9, K('midori', -1))
    else:
        for sx in range(x + 4, x + w - 2, 7):
            c.VL(sx, y - 7, 15, K('ita', 1)); c.P(sx, y - 8, OL)                                  # 지주
            for j in range(-6, 8, 2):
                c.P(sx - 1, y + j, K('ki', 2)); c.P(sx + 1, y + j + 1, K('ki', 1)); c.P(sx - 2, y + j + 1, K('ki', 0))
            c.P(sx + 2, y - 1, K('aka', 1)); c.P(sx - 2, y + 3, K('aka', 2)); c.P(sx + 1, y + 6, K('aka', 0))


@_spec('lot-veg', '동네 텃밭 두둑 둘(양배추·토마토 지주, 4×3)', 4, 3, 'organic', solid=[], tags=['텃밭', '주택가', '채소'],
       rules='주택가 빈터·집 뒤. 생울타리나 블록담으로 두른 안쪽. 두둑 사이 통로는 대지 바닥이 보인다.')
def lot_veg(c):
    _bed(c, 3, 9, 58, 'tomato')
    _bed(c, 3, 30, 58, 'cabbage')
    c.R(52, 25, 6, 4, K('sora', 0)); c.HL(52, 25, 6, K('sora', 2)); c.HL(58, 26, 3, K('sora', -1)); c.VL(51, 25, 4, OL); c.HL(51, 29, 8, OL)   # 물뿌리개
    shadow(c, 3, 46, 58)


# ───────────────────────── 공사장 ─────────────────────────
@_spec('lot-hoarding', '공사장 가림막(仮囲い, 두꺼운 윗단, 3×2)', 3, 2, 'structure', solid=[(0, 1), (1, 1), (2, 1)], tags=['공사', '가림막', '빈터'],
       rules='공사 중 빈터의 보도 쪽 가장자리에 가로로 이어 붙인다. 막힘(아래 줄).')
def lot_hoarding(c):
    """열차 지붕과 같은 짜임: 깊은 윗면(작업 발판 · 12줄) 위에 고정쇠 상자 + 처마 줄 + 흰 판 앞면."""
    c.HL(0, 0, 48, OL)
    deck(c, 0, 1, 48, 12, 'conc', 3, ends=False)                                                  # 가림막 위 작업 발판 윗면(깊게)
    for j in (5, 9): c.HL(0, j, 48, K('conc', 2))
    for ax in (6, 30):                                                                           # 발판 위 자재 상자(윗면+앞면)
        deck(c, ax, 3, 10, 4, 'ita', 1, ends=True)
        c.R(ax, 7, 10, 2, K('ita', -2)); c.HL(ax - 1, 9, 12, OL); c.VL(ax - 1, 7, 2, OL); c.VL(ax + 10, 7, 2, OL)
    c.HL(0, 13, 48, K('tekko', -3)); c.HL(0, 14, 48, OL)                                          # 처마(윗면 ↔ 앞면)
    c.R(0, 15, 48, 13, K('shiro', 1)); c.HL(0, 15, 48, K('shiro', 2))
    for x in range(15, 48, 16): c.VL(x, 16, 6, K('shiro', -1)); c.VL(x + 1, 16, 6, K('shiro', 2))   # 판 이음
    c.R(0, 21, 48, 4, K('sora', 0)); c.HL(0, 21, 48, K('sora', 1)); c.HL(0, 24, 48, K('sora', -1))
    for x in range(0, 48, 6): c.R(x, 25, 3, 3, K('kii', 1)); c.R(x + 3, 25, 3, 3, OL)
    c.HL(0, 28, 48, OL); shadow(c, 0, 29, 48)


@_spec('lot-cabin', '공사장 현장 사무소(조립식, 3×3)', 3, 3, 'structure', solid=[(0, 2), (1, 2), (2, 2), (0, 1), (1, 1), (2, 1)], tags=['공사', '사무소', '빈터'],
       rules='공사 빈터 안쪽(뒤쪽). 문은 남쪽 아래 줄 가운데.')
def lot_cabin(c):
    deck(c, 1, 3, 46, 11, 'conc', 2, ends=True)                                                   # 지붕 윗면(가로 홈)
    c.R(0, 14, 48, 2, K('conc', -1)); c.HL(0, 14, 48, K('conc', 0)); c.HL(0, 16, 48, OL); c.VL(-1, 13, 3, OL); c.VL(48, 13, 3, OL)
    c.R(1, 17, 46, 25, K('shiro', 1)); c.VL(1, 17, 25, K('shiro', 2)); c.VL(46, 17, 25, K('shiro', -1))
    c.R(1, 17, 46, 2, K('sora', 0)); c.HL(1, 17, 46, K('sora', 1))
    for x in (16, 32): c.VL(x, 19, 23, K('shiro', -1))
    c.R(5, 22, 9, 8, K('garasu', -1)); c.HL(5, 22, 9, K('garasu', 1)); c.VL(9, 22, 8, K('shiro', 1)); c.HL(4, 21, 11, OL); c.HL(4, 30, 11, OL); c.VL(4, 21, 10, OL); c.VL(14, 21, 10, OL)
    c.R(36, 22, 7, 8, K('garasu', -1)); c.HL(36, 22, 7, K('garasu', 1)); c.HL(35, 21, 9, OL); c.HL(35, 30, 9, OL); c.VL(35, 21, 10, OL); c.VL(43, 21, 10, OL)
    c.R(20, 23, 9, 19, K('tekko', -1)); c.VL(20, 23, 19, K('tekko', 0)); c.P(27, 32, K('kii', 1)); c.HL(19, 22, 11, OL); c.VL(19, 22, 20, OL); c.VL(29, 22, 20, OL)
    c.VL(0, 17, 25, OL); c.VL(47, 17, 25, OL); c.HL(0, 42, 48, OL)
    c.R(2, 43, 44, 1, K('tekko', -2)); c.R(18, 43, 13, 2, K('conc', 1)); c.HL(18, 43, 13, K('conc', 2))
    shadow(c, 1, 45, 46)


# ───────────────────────── 광장·로터리 ─────────────────────────
@_spec('lot-planter', '광장 화단(콘크리트 틀·꽃, 2×2)', 2, 2, 'container', solid=[(0, 1), (1, 1)], tags=['화단', '광장', '로터리'],
       rules='광장·역 앞 로터리·보도 넓은 곳. 여럿을 한 칸 띄워 줄짓는다.')
def lot_planter(c):
    c.HL(1, 2, 30, OL); c.VL(0, 3, 25, OL); c.VL(31, 3, 25, OL); c.HL(1, 28, 30, OL)
    c.R(1, 3, 30, 3, K('conc', 2)); c.HL(1, 3, 30, K('conc', 1))                                   # 뒤 테
    c.R(1, 6, 3, 12, K('conc', 2)); c.R(28, 6, 3, 12, K('conc', 1))                                # 옆 테
    c.R(4, 6, 24, 12, K('soil', -1)); c.HL(4, 6, 24, K('soil', -2))
    for cx, cy, r in ((9, 9, 4), (19, 8, 5), (24, 13, 3), (12, 14, 3)):
        for j in range(-r, r + 1):
            for i in range(-r, r + 1):
                if i * i + j * j <= r * r: c.P(cx + i, cy + j, K('ki', 2 if j < 0 else 1 if i < 1 else 0))
    for (x, y, m) in ((8, 7, 'pinku'), (11, 10, 'kii'), (18, 6, 'aka'), (21, 9, 'pinku'), (16, 11, 'shiro'), (24, 12, 'kii'), (13, 14, 'aka'), (6, 11, 'shiro')):
        c.P(x, y, K(m, 2)); c.P(x + 1, y, K(m, 1))
    c.R(1, 18, 30, 3, K('conc', 2)); c.HL(1, 18, 30, K('conc', 3))                                # 앞 테 윗면
    c.R(1, 21, 30, 7, K('conc', -1)); c.HL(1, 21, 30, K('conc', 0)); c.VL(30, 21, 7, K('conc', -3))
    c.HL(1, 25, 30, K('conc', -2))
    shadow(c, 1, 29, 30)


@_spec('lot-clock', '광장 시계탑(돌 받침·기둥·네모 시계, 1×4)', 1, 4, 'column', solid=[(0, 3)], tags=['시계', '광장', '역 앞'],
       rules='광장 한가운데·역 앞 로터리 섬. 글자 없는 둥근 시계판.')
def lot_clock(c):
    box(c, 1, 2, 14, 8, 13, 'tekko', 1, ft=-1)                                                    # 시계 머리 윗면(8줄) + 앞
    for j in range(-5, 6):
        for i in range(-5, 6):
            d = i * i + j * j
            if d <= 20: c.P(8 + i, 16 + j, K('shiro', 2 if d < 12 else 1))
            elif d <= 30: c.P(8 + i, 16 + j, K('tekko', -2))
    c.VL(8, 12, 5, OL); c.HL(8, 16, 4, OL); c.P(8, 11, K('tekko', 0)); c.P(8, 21, K('tekko', 0)); c.P(3, 16, K('tekko', 0)); c.P(13, 16, K('tekko', 0))
    c.R(6, 24, 4, 25, K('tekko', 0)); c.VL(6, 24, 25, K('tekko', 2)); c.VL(9, 24, 25, K('tekko', -2)); c.VL(5, 24, 25, OL); c.VL(10, 24, 25, OL)
    box(c, 1, 49, 14, 6, 5, 'conc', 1, ft=-2)                                                     # 돌 받침
    shadow(c, 1, 61, 14)


@_spec('lot-fountain', '광장 분수(둥근 수반·가운데 접시, 3×3)', 3, 3, 'container', solid=[(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)], tags=['분수', '광장', '공원'],
       rules='광장·공원 한가운데. 둘레 한 칸은 비워 걸어 돌게 한다.')
def lot_fountain(c):
    cx, cy, RX, RY, rx, ry = 24, 24, 22, 12, 18, 9
    for y in range(0, 48):
        for x in range(0, 48):
            i, j = x - cx, y - cy
            do = (i * i) / (RX * RX) + (j * j) / (RY * RY)
            di = (i * i) / (rx * rx) + (j * j) / (ry * ry)
            if di <= 1.0:
                t = -1 if j < -5 else 0 if j < 3 else -1
                c.P(x, y, K('garasu', t))
            elif do <= 1.0: c.P(x, y, K('conc', 3 if j < 0 else 2))
            elif do <= 1.12 and j <= 0: c.P(x, y, OL)
    for x in range(cx - RX, cx + RX + 1):                                                          # 수반 앞 벽
        i = x - cx
        yf = cy + int(RY * math.sqrt(max(0.0, 1 - (i * i) / (RX * RX))))
        for k in range(1, 8): c.P(x, yf + k, K('conc', -1 if k < 3 else -2) if i < 12 else K('conc', -3))
        c.P(x, yf + 8, OL)
    for y in range(cy, cy + 9): c.P(cx - RX - 1, y, OL); c.P(cx + RX + 1, y, OL)
    for i in range(-RX, RX + 1, 3):                                                                # 앞 벽 위 테
        yf = cy + int(RY * math.sqrt(max(0.0, 1 - (i * i) / (RX * RX))))
        c.P(cx + i, yf, K('conc', 1))
    for (x, y) in ((12, 22), (31, 20), (17, 28), (36, 26), (26, 31), (9, 26)): c.HL(x, y, 3, K('garasu', 2))
    c.R(21, 12, 6, 14, K('conc', 1)); c.VL(21, 12, 14, K('conc', 2)); c.VL(26, 12, 14, K('conc', -2)); c.VL(20, 12, 14, OL); c.VL(27, 12, 14, OL)
    disc(c, 24, 11, 7, 3, 'conc', 2)                                                               # 가운데 접시
    c.HL(20, 10, 9, K('garasu', 0)); c.HL(21, 11, 7, K('garasu', 1))
    c.VL(24, 3, 7, K('garasu', 2)); c.P(23, 2, K('garasu', 1)); c.P(25, 2, K('garasu', 1))
    for (x, y) in ((16, 13), (32, 13), (15, 17), (33, 17)): c.P(x, y, K('garasu', 2))
    shadow(c, 3, 45, 42)


@_spec('lot-kiosk', '광장 매점·노점(줄무늬 차양, 2×3)', 2, 3, 'structure', solid=[(0, 2), (1, 2)], tags=['매점', '노점', '광장'],
       rules='광장 가장자리·역 앞. 앞(남쪽)에 손님 칸을 비운다. 상표·글자 없음.')
def lot_kiosk(c):
    """매점: 원근 사다리꼴 줄무늬 차양(양쪽 대칭으로 뒤로 모이는 줄) + 깊은 카운터 윗면 + 선반."""
    for j in range(11):                                                                          # 차양 윗면(경사면, 뒤가 좁다)
        ins = (10 - j) // 2
        for x in range(ins, 32 - ins):
            u = (x - 16 + 0.5) * 16.0 / (16 - ins)                                               # 가운데 기준 줄 좌표(뒤로 모인다)
            stripe = int((u + 32) // 4) % 2
            c.P(x, 2 + j, (K('aka', 1 if j < 6 else 0) if stripe else K('shiro', 2 if j < 6 else 1)))
        c.P(ins - 1, 2 + j, OL); c.P(32 - ins, 2 + j, OL)
    c.HL(5, 1, 22, OL)
    for x in range(0, 32):                                                                       # 차양 앞 물결 띠
        u = (x - 16 + 0.5); stripe = int((u + 32) // 4) % 2
        col = K('aka', -1) if stripe else K('shiro', 0)
        c.P(x, 13, col); c.P(x, 14, col)
        if x % 4 in (1, 2): c.P(x, 15, col)
        c.P(x, 16 if x % 4 in (1, 2) else 15, OL)
    c.R(1, 17, 30, 10, K('ita', -2))                                                             # 뒤 선반
    for x in range(3, 29, 4): c.R(x, 19, 3, 3, K(('sora', 'kii', 'midori', 'pinku', 'shiro', 'aka', 'kii')[(x // 4) % 7], 1))
    c.HL(2, 22, 28, K('ita', 0))
    top_face(c, 1, 28, 30, 7, 'ita', 1)                                                          # 카운터 윗면(깊게)
    for x in range(5, 27, 7):                                                                    # 카운터 위 물건(위에서 본 작은 상자)
        m = ('shiro', 'kii', 'sora', 'aka')[(x // 7) % 4]
        c.R(x, 29, 4, 2, K(m, 2)); c.R(x, 31, 4, 1, K(m, 0)); c.HL(x, 32, 4, OL)
    c.R(1, 35, 30, 9, K('ita', -1)); c.HL(1, 35, 30, K('ita', 0)); c.VL(16, 36, 8, K('ita', -3))
    for px in (0, 31): c.VL(px, 16, 28, OL)
    c.HL(0, 44, 32, OL); shadow(c, 1, 45, 30)


# 관문 통과분만 굽는다(2026-10-14, 영수증 harness-data/object-gate/receipts). 후보 전체를 다시 검사하려면 ENABLED = None.
# 미통과(4판 넘게 다시 그렸으나 판정자가 정면 입면도로 읽음): lot-pay(정산기 상자), lot-hoarding(공사 가림막) — 구성기는 대신
# 요금 기둥(lot-board)·철망 울타리 오토타일(철망 울타리)·기존 게시판(jp-keijiban)을 쓴다. 안내판(lot-notice)은 jp-keijiban 으로 대체해 후보에서 뺐다.
ENABLED = {'lot-bay', 'lot-board', 'lot-slide', 'lot-spring', 'lot-sandbox', 'lot-veg', 'lot-cabin', 'lot-planter', 'lot-clock', 'lot-fountain', 'lot-kiosk'}


def register(prop):
    for s in CANDIDATES:
        if ENABLED is not None and s['id'] not in ENABLED: continue
        prop(s['id'], s['name'], s['w'], s['h'], solid=s['solid'], other=s['other'], tags=s['tags'], rules=s['rules'])(s['draw'])


def kinds():
    return {'jp-' + s['id']: s['kind'] for s in CANDIDATES}


def preview(out, bg=(132, 128, 146, 255), scale=3):
    """후보 전부를 대지 색 위에 원본·확대로 한 장(관문 전 눈 확인)."""
    from PIL import Image
    from house_kit import Cv
    ims = []
    for s in CANDIDATES:
        cv = Cv(s['w'] * 16, s['h'] * 16); s['draw'](cv)
        im = Image.new('RGBA', (cv.w, cv.h), bg); im.alpha_composite(Image.fromarray(cv.a, 'RGBA')); ims.append(im)
    W = sum(i.width + 6 for i in ims); H = max(i.height for i in ims)
    S = Image.new('RGBA', (W, H), (40, 40, 48, 255)); x = 0
    for i in ims: S.alpha_composite(i, (x, H - i.height)); x += i.width + 6
    S.resize((S.width * scale, S.height * scale), Image.NEAREST).save(out)


if __name__ == '__main__':
    preview(sys.argv[1] if len(sys.argv) > 1 else '/tmp/lot_art.png')
