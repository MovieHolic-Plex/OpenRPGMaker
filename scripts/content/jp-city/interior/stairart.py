"""jp_city 실내 계단 공용 그림(2026-10-22 다시 그림) — 올라가는 계단(벽 앞에 서서 북쪽 천장 구멍으로 오른다)과
내려가는 계단통(바닥에 뚫린 구멍, 남쪽에서 들어서 북쪽으로 어둠 속으로 내려간다).

읽힘 규칙(사용자 「계단들이 다 씹창」 뒤 다시 정함):
  올라가는 계단  단마다 밝은 디딤판 윗면 + 그보다 확실히 어두운 챌판 띠 + 챌판 밑 그늘 한 줄. 아래(가까운) 단은 크고 밝고,
                위(먼) 단일수록 낮고 어두워져 맨 위는 위층 바닥 밑 어둠으로 들어간다. 양옆 옆판·손잡이, 트인 쪽 난간·아래 기둥.
  내려가는 계단통 바닥에 뚫린 구멍. 북·동·서 바닥 턱 위에 난간, 남쪽만 열린 입구(맨 위 디딤판 = 바닥 높이).
                북쪽으로 갈수록 디딤판이 한 단씩 낮아지고 어두워지며, 북쪽 끝은 구멍 안 북벽 면(거의 검정)이다.
                각 디딤판 북쪽 끝에 밝은 코(nosing) 한 줄 — 그 북쪽이 한 단 낮다는 표시.
그림 크기: 올라가는 계단 = w*16 × 48(벽면 두 줄 + 발칸 한 줄), 계단통 = 32 × 48(벽면 아랫줄 위로 솟는 난간 16px + 바닥 두 줄).
팔레트는 modern3 램프(K)만. 빛 왼쪽 위.
"""
from ikit import K, OL

# 재질: 디딤판·챌판·코·옆판 램프와 기준 단
MATS = {
    'wood': dict(tr=('ita', 2), nose=('ita', 3), ri=('ita', 0), sh=('ita', -3), side=('ita', -1), sideL=('ita', 1),
                 rail=('ita', 1), railH=('ita', 3), railD=('ita', -2), post=('ita', 0), rim=('yuka', 1), rimH=('yuka', 2), rimD=('ita', -2),
                 grip=None),
    'conc': dict(tr=('conc', 1), nose=('conc', 2), ri=('conc', -1), sh=('conc', -3), side=('conc', -1), sideL=('conc', 1),
                 rail=('tekko', 2), railH=('tekko', 3), railD=('tekko', -1), post=('tekko', 1), rim=('conc', 1), rimH=('conc', 2), rimD=('conc', -3),
                 grip=('yoru', 0)),
    'mansion': dict(tr=('conc', 1), nose=('conc', 2), ri=('conc', -1), sh=('conc', -3), side=('conc', -1), sideL=('conc', 1),
                    rail=('tekko', 1), railH=('tekko', 3), railD=('tekko', -2), post=('tekko', 0), rim=('conc', 1), rimH=('conc', 2), rimD=('conc', -3),
                    grip=None),
    'office': dict(tr=('conc', 1), nose=('conc', 2), ri=('conc', -1), sh=('conc', -3), side=('conc', -1), sideL=('conc', 1),
                   rail=('tekko', 2), railH=('tekko', 3), railD=('tekko', -1), post=('tekko', 1), rim=('conc', 1), rimH=('conc', 3), rimD=('conc', -3),
                   grip=('yoru', -1)),
    'bare': dict(tr=('conc', 1), nose=('conc', 2), ri=('conc', -2), sh=('conc', -3), side=('conc', -2), sideL=('conc', 0),
                 rail=None, railH=None, railD=None, post=None, rim=('conc', 0), rimH=('conc', 0), rimD=('conc', -3), grip=None),
}


def _k(spec, d=0):
    return K(spec[0], spec[1] + d)


def _h(x, y, salt):
    v = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)
    v = (v ^ (v >> 13)) * 1274126177 & 0xFFFFFFFF
    return v % 100


def _grain(c, x0, y0, w, h, col_of, wood, salt):
    """디딤판 결: 나무 = 짧은 가로 나뭇결(한 단 어둡게), 콘크리트 = 잔 점(한 단 어둡게·가끔 밝게). col_of(dd) → 색."""
    if w <= 2 or h <= 0: return
    for y in range(y0, y0 + h):
        x = x0
        while x < x0 + w:
            r = _h(x, y, salt)
            if wood:
                if r < 5:
                    n = 2 + r % 3
                    c.HL(x, y, min(n, x0 + w - x), col_of(-1)); x += n + 2; continue
            else:
                if r < 11: c.P(x, y, col_of(-1))
                elif r < 15: c.P(x, y, col_of(1))
            x += 1


# 올라가는 계단 단 높이(아래 → 위, 먼 단일수록 낮다 — 원근). 합 37, y 10..46 에 단, y0..9 = 위층 바닥 밑 어둠.
UP_STEPS = (9, 8, 6, 5, 4, 3, 2)


def _step_rows(p):
    """단 높이 p → (디딤판 줄 수(코 포함), 챌판 줄 수, 그늘 1). jp_city 지하철 계단·석단처럼 디딤판(수평면)이 단 높이 대부분을
    차지하고 챌판은 1줄, 그 밑 그늘 1줄 — 두꺼운 챌판 띠는 정면 입면(셔터)으로 읽힌다(object-gate 3/4 눈, VQA)."""
    if p >= 4: return p - 2, 1, 1
    return p - 1, 0, 1


def up_stairs(c, w, mat, left='wall', right='balustrade'):
    """북쪽 벽 앞에 서서 천장 구멍으로 오르는 계단(그림 w*16 × 48, 발칸 = 맨 아래 줄). w = 칸 수.
    양옆 옆판(stringer: 바깥 윤곽 · 밝은 윗면 · 중간 면) 사이에 단이 쌓인다 — 옆판이 없으면 셔터·사다리로 읽힌다(VQA r1~r10).
    단마다 밝은 디딤판(결) → 가장 밝은 코 → 확실히 어두운 챌판 → 그늘 한 줄. 아래 단은 깊고 밝으며 위로 갈수록 얕고 어두워져
    맨 위 10px 는 위층 바닥 밑 어둠이다 — 오르는 방향(북)이 그림만으로 보인다.
    left = 'wall' | 'stringer', right = 'balustrade'(옆판 위 난간동자 + 손잡이 + 아래 기둥) | 'pipe'(쇠파이프 손잡이 + 아래 기둥) | 'stringer'(난간 없는 맨 콘크리트 옆벽)."""
    M = MATS[mat]
    pw = w * 16
    sw = 2 if w == 1 else 3                                       # 옆판 폭
    if right == 'stringer' and w > 1: sw = 5                      # 공사장 맨 콘크리트 옆벽은 더 두껍다(윗면 + 안면)
    tx0, tx1 = (1 if w == 1 else sw), pw - sw                     # 1칸 폭은 서쪽 옆판 없이 윤곽만(디딤판 폭을 지킨다)
    tw = tx1 - tx0
    TOP = 10 if w > 1 else 14                                     # 1칸 폭은 위층 구멍 어둠을 더 깊게(얇은 윗단 = 루버, VQA r15)
    ri = lambda d: _k(M['ri'], d)                                 # 챌판: 디딤판보다 세 단 어둡게(중간 톤 — 검은 줄무늬면 환기구로 읽힌다)
    # 위층 바닥 밑 어둠
    for j, col in enumerate((K('sumi', -1), K('sumi', -1), K('sumi', 0), K('sumi', 0), K('sumi', 1), K('sumi', 1), K('yoru', -3), K('yoru', -3), K('yoru', -2), K('yoru', -2))):
        c.HL(0, j, pw, col)
    for j in range(10, TOP): c.HL(0, j, pw, K('yoru', -2 + (j - 10) // 2))
    y = 47
    steps, dd_ = (UP_STEPS, (0, 0, 0, -1, -1, -2, -3)) if w > 1 else ((10, 8, 7, 5, 3), (0, 0, -1, -1, -2))
    if right == 'stringer':                                       # 맨 콘크리트: 단 다섯, 두꺼운 중간 챌판 띠 2줄 — 고른 얇은 줄 = 셔터(VQA r26·r28 2/3)
        steps, dd_ = (10, 9, 7, 6, 5), (0, 0, -1, -1, -2)   # 1칸 폭: 단 수를 줄여 단마다 두껍게(얇은 줄무늬 = 환기구, VQA r14)
    rows = []
    for i, p in enumerate(steps):
        d = dd_[i]
        trh, rih, _ = _step_rows(p)
        if right == 'stringer': trh, rih = p - 3, 2
        top = y - p
        c.R(tx0, top, tw, trh, _k(M['tr'], d))                    # 디딤판 윗면(수평면)
        if trh >= 3: c.HL(tx0, top, tw, _k(M['tr'], d - 1))      # 디딤판 뒤쪽(위 단 챌판 밑) 한 줄 그늘 — 깊이 띠
        if trh >= 4: _grain(c, tx0 + 1, top + 1, tw - 2, trh - 2, lambda dd: _k(M['tr'], d + dd), mat == 'wood', 11 + i)
        c.HL(tx0, top + trh - 1, tw, _k(M['nose'], d))            # 앞 코(가장 밝다)
        for k in range(rih): c.HL(tx0, top + trh + k, tw, ri(d) if k == rih - 1 or right != 'stringer' else _k(M['ri'], d + 1))   # 챌판(맨 콘크리트는 2줄: 중간·어둠)
        c.HL(tx0, top + trh + rih, tw, K('ita', -3 + max(d, -1)) if mat == 'wood' else K('yoru', -1 + max(d, -2)))  # 그늘 한 줄(나무는 따뜻한 갈색)
        rows.append((top, trh, rih))
        y = top
    # 옆판: 바깥 윤곽 · 밝은 윗면 · 중간 면(안쪽, 디딤판 쪽). 맨 위는 어둠 속으로 들어간다.
    def stringer(xo, xs):                                         # xo = 윤곽 x, xs = 윤곽에서 안쪽으로 가는 x 들
        c.VL(xo, 0, 48, OL)
        for k, x in enumerate(xs):
            if right == 'stringer':                               # 맨 콘크리트 옆벽 덩이: 밝은 윗모서리 · 윗면 둘 · 계단 쪽 안면(서쪽 = 그늘 짙게, 동쪽 = 빛 받는 중간)
                col = ((K('conc', 2), K('conc', 1), K('conc', 1), K('conc', -1)) if xo == 0 else (K('conc', 0), K('conc', -1), K('conc', -1), K('conc', -3)))[min(k, 3)]   # 서쪽 벽 = 빛 받는 윗면, 동쪽 벽 = 그늘(같은 밝은 기둥 둘 = 문틀·셔터, VQA r28)
            else:
                col = _k(M['sideL']) if k == 0 else _k(M['side'], -(k - 1))
            c.VL(x, TOP - 2, 50 - TOP, col); c.VL(x, 0, TOP - 2, K('yoru', -2 - min(k, 1)))
    stringer(0, list(range(1, tx0)))
    stringer(pw - 1, list(range(pw - 2, pw - 1 - sw, -1)))
    c.VL(tx0, TOP, 37, _k(M['tr'], -2))                           # 서쪽 옆판이 디딤판에 드리운 가는 그늘(빛 왼쪽 위)
    # 옆판 안쪽 모서리 톱니: 단마다 코 줄은 밝게, 챌판·그늘 줄은 어둡게 — 옆판이 단을 따라 꺾여 올라가는 옆모습(투시)
    for top, trh, rih in (rows if right != 'stringer' else ()):  # 맨 콘크리트 옆벽은 톱니 없이 한 덩이(마디진 옆대 = 사다리·셔터 틀, VQA r26 2/3)
        for x in ([tx0 - 1] if tx0 > 1 else []) + [tx1]:
            c.P(x, top + trh - 1, _k(M['sideL'], 1) if x == tx1 else _k(M['sideL']))
            for yy in range(top + trh, top + trh + rih + 1): c.P(x, yy, _k(M['side'], -2))
    if right == 'stringer':                                       # 동쪽 벽이 디딤판에 드리운 그늘 1px(빛 왼쪽 위) + 맨 아래 단 앞 턱
        for top, trh, rih in rows: c.VL(tx1 - 1, top, trh, _k(M['tr'], -2))
        c.HL(tx0, 46, tw, _k(M['nose'])); c.HL(tx0, 47, tw, K('yoru', -1))
        return
    # 동쪽 옆판 위 난간: 손잡이(밝은 윗면) 한 줄 + 동자, 맨 아래 기둥(갓·몸·발 그늘)은 발칸 바닥에 선다.
    R = pw - sw
    NT = 33
    if right == 'balustrade' and w > 1:
        for yy in range(TOP + 1, NT, 4): c.P(R + 1, yy, _k(M['railH'], 1))
    c.VL(R, TOP - 2, NT - TOP + 2, _k(M['railH']))
    bx, bw = pw - 4, 3
    c.R(bx, NT - 1, bw + 1, 1, OL)
    c.R(bx, NT, bw, 2, _k(M['railH'])); c.R(bx, NT + 2, bw, 46 - NT - 2, _k(M['rail'] or M['side']))
    c.VL(bx, NT + 2, 46 - NT - 2, _k(M['railH'])); c.VL(bx + bw - 1, NT + 2, 46 - NT - 2, _k(M['railD'] or M['side'], -1))
    c.VL(bx - 1, NT - 1, 48 - NT, OL); c.HL(bx, 46, bw, _k(M['railD'] or M['side'], -1)); c.HL(bx - 1, 47, bw + 1, K('yoru', -2))


def down_well(c, mat, rails=True):
    """바닥에 뚫린 내려가는 계단통 32×48. y0..15 = 벽면 아랫줄 위로 솟는 난간, y16..47 = 바닥 두 줄(윗줄 막힘·아랫줄 밟음).
    구멍 둘레 바닥 고리(서·동 2px, 북 3px)와 남쪽 입구 앞 바닥은 투명 — 그 방 바닥이 그대로 보여 「바닥에 뚫린 구멍」으로 읽힌다.
    난간은 고리 바깥에 서고 옆 난간은 남쪽 끝보다 4px 앞(북)에서 기둥으로 끝난다 — 남쪽은 바닥 높이 입구로 열려 있다.
    구멍 속은 대부분 어둡고 가장 가까운(남쪽) 디딤판 한두 단만 밝다 — 오르는 계단(밝은 단이 위로 쌓임)과 한눈에 갈린다.
    rails=False 면 난간을 그리지 않는다(공사장 — 블록이 라바콘·차단봉을 따로 얹는다)."""
    M = MATS[mat]
    if mat == 'wood':                                             # 계단통 난간은 짙은 나무(밝은 베이지 윗대는 벽난로 선반으로 읽힌다 — VQA r8)
        M = dict(M, rail=('ita', -1), railH=('ita', 1), railD=('ita', -3), post=('ita', -1))
    X0, X1 = 4, 28                                                # 구멍 x [X0, X1)
    YN, YS = 19, 43                                               # 구멍 y [YN, YS) — YS 줄 = 남쪽 바닥 끝 코
    w = X1 - X0

    def tread(d):                                                 # 깊이 d(-1 = 남쪽 첫 단 … -5 = 가장 먼 단): 밝은 단 넷이 한 단씩 어두워지고 맨 끝 단만 짙은 보라
        if mat == 'wood': return K('ita', max(d + 1, -4))         # 나무: 따뜻한 갈색 램프로만 ita 0(바닥) → -1 → … → -4(근흑 갈색). 밝은 판자 = 침대·난로(VQA r15·r20)
        if d <= -5: return K('yoru', 0)
        return _k(M['tr'], d - 1) if d >= -3 else K('yoru', 0)   # tr-2 → -3 → -4 → yoru 0 — 남쪽 첫 단도 방 바닥보다 밝지 않게(밝은 띠 = 턱, VQA r13)

    # 내려가는 계단은 디딤판 윗면만 보인다(챌판은 북쪽을 향해 숨는다). 단마다 북쪽 끝에 어두운 낙차 줄 하나 —
    # 그 너머 단이 한 단 낮다. 가까운 두 단은 바닥처럼 밝고(밟고 내려갈 단이 보인다), 북쪽으로 갈수록 어두워져 맨 끝은 짙은 보라 북벽.
    # 밝은 코·남향 챌판은 그리지 않는다(그리면 오르는 계단으로 읽힌다, VQA r1~r6). 먼 단에는 점을 찍지 않는다(자갈 상자, VQA r8).
    # 나무·회색 같은 짜임(회색이 VQA r20·r21 다수 통과): 디딤판은 너비 전체, 값이 단마다 크게 어두워지고, 단마다 북쪽 낙차 1px 어둠 + 남쪽 코 1px 밝음.
    # 나무는 따뜻한 갈색 램프 — 고른 짙은 갈색 상자는 궤·화로·이층 침대로 읽힌다(VQA r21 3/3).
    if mat == 'wood':                                             # 나무(VQA r23~r25 다수 통과): 가까운 단 = 방 바닥(ita 0)보다 한 단 밝게, 근흑 북벽 3px
        # 회색과 같은 일곱 단·쐐기 구덩이 벽, 따뜻한 갈색 → 근흑(VQA r28 2/3: 갈색만 쓰면 바닥과 같은 값 = 궤짝. r22: 위 절반이 다 검으면 장)
        RAMP = {-1: K('ita', 1), -2: K('ita', 0), -3: K('ita', -1), -4: K('ita', -3), -5: K('yoru', -1), -6: K('yoru', -2), -7: K('yoru', -3)}
        PITC, DROP, NOSE1 = K('sumi', 1), K('yoru', -3), K('ita', 2)
        pit, bands = 2, ((21, 2), (23, 2), (25, 3), (28, 3), (31, 3), (34, 4), (38, 5))
    else:
        # 회색: 디딤판 일곱 단이 북벽 바로 밑까지 차고, 단 높이가 남쪽으로 갈수록 커진다(2·2·3·3·3·4·5). 북쪽 근흑은 2px 만 —
        # 큰 검은 판 위 줄무늬 서너 개 = 환기구·그릴·오븐(VQA r23·r25 다수). 가장 가까운 단에는 밝은 코를 긋지 않는다(상자 앞판, VQA r25).
        RAMP = {-1: _k(M['tr'], 0), -2: _k(M['tr'], -1), -3: _k(M['tr'], -2), -4: _k(M['tr'], -3), -5: _k(M['tr'], -5), -6: K('yoru', -1), -7: K('yoru', -3)}   # 단이 바닥 값에서 천천히 내려간다 — 검은 판에 줄 몇 개 = 가전(VQA r29 3/3)
        PITC, DROP, NOSE1 = K('sumi', 1), K('yoru', -3), None
        pit, bands = 2, ((21, 2), (23, 2), (25, 3), (28, 3), (31, 3), (34, 4), (38, 5))
    c.R(X0, YN, w, pit, PITC); c.HL(X0, YN, w, _k(M['rimD'], 1))   # 북벽 면(거의 검정)
    depths = tuple(range(-len(bands), 0))
    for (y0, h), d in zip(bands, depths):
        col = RAMP[d]
        c.R(X0, y0, w, h, col)
        c.HL(X0, y0, w, (PITC if d <= -3 else DROP) if mat == 'wood' else RAMP.get(d - 2, PITC))   # 북쪽 끝 낙차(1px 어둠). 회색은 두 단 어둡게만 — 검은 줄 = 그릴 살(VQA r29)
        if h >= 3 and d >= -5:                                    # 남쪽 끝 코(1px 밝게) — 가장 가까운 회색 단은 생략
            nose = RAMP.get(d + 1) if d <= -2 else NOSE1
            if nose is not None: c.HL(X0, y0 + h - 1, w, nose)
        if d >= -3:                                               # 가까운 단만 잔 점(나무는 결)
            for yy in range(y0 + 1, y0 + h - 1):
                for xx in range(X0 + 2, X1 - 2):
                    if _h(xx, yy, 71 + d) < 6: c.P(xx, yy, RAMP.get(d - 1))
        # 안쪽 옆벽: 디딤판보다 한 단 어둡게 1px(굵은 옆벽 = 그릴 상자, VQA r19). 회색은 먼 단일수록 옆벽이 넓어진다(구덩이 벽, VQA r25).
        ww = ({-7: 5, -6: 4, -5: 4, -4: 3, -3: 2, -2: 2, -1: 1} if mat == 'wood' else {-7: 3, -6: 3, -5: 2, -4: 2, -3: 1, -2: 1, -1: 1})[d]   # 안쪽 구덩이 벽이 북쪽으로 넓어진다(세로 틀 = 가전 앞판 VQA r27, 계단식 모서리 = 화덕 VQA r29 — 회색은 얕게)
        c.R(X0, y0, ww, h, RAMP.get(d - 1, PITC)); c.R(X1 - ww, y0, ww, h, RAMP.get(d - 1, PITC))
    # 바닥 고리와 구멍 사이 모서리 선: 북·서는 밝은 바닥 끝, 동은 어두운 끝
    c.HL(X0, YN - 1, w, _k(M['rimD'], 1))                        # 북쪽 바닥 끝(구멍으로 떨어지는 모서리) — 옆은 바닥이 그대로 구멍 벽 그늘에 닿는다
    if rails:                                                     # 바닥 위에서는 구멍 옆 가장자리도 1px 어둡게 잘라야 바닥이 뚫린 것으로 읽힌다(VQA r24 「회색 상자·가전」)
        c.VL(X0 - 1, YN, YS - YN, _k(M['rimD'], 1)); c.VL(X1, YN, YS - YN, _k(M['rimD'], 1))
        lip = K('ita', 1) if mat == 'wood' else _k(M['rimH'], 1)   # 나무: 크림색 턱은 틀(액자)로 보인다 — 판자 밝은 결 한 단
        if mat == 'wood': c.VL(X0 - 2, YN, YS - YN, lip); c.VL(X1 + 1, YN, YS - YN, lip)   # 회색은 밝은 턱 줄 없음 — 어둠·밝음·밝음·어둠 겹줄 = 가구 틀(VQA r29)   # 그 바깥 1px 밝은 바닥 턱 — 난간이 바닥 위에 서고 바닥이 구멍으로 꺾인다
    if not rails:                                                 # 난간 없는 슬래브 구멍: 두께 2px 맨 콘크리트 턱(북·서·동) + 안쪽 그늘, 남쪽은 열림
        c.R(X0 - 3, YN - 3, w + 6, 2, _k(M['rim'])); c.HL(X0 - 3, YN - 3, w + 6, _k(M['rimH'], 1)); c.HL(X0 - 1, YN - 1, w + 2, K('yoru', -2))
        for xt, xi in ((X0 - 2, X0 - 1), (X1 + 1, X1)):            # 옆 턱 2px: 밝은 윗면(군데군데 깨짐) + 구멍 쪽 어두운 안면
            for y in range(YN - 1, YS):
                c.P(xt, y, K('conc', -1) if _h(xt, y, 91) < 18 else K('conc', 1))
                c.P(xi, y, K('conc', -3))
        c.HL(X0 - 4, YN - 4, w + 8, OL)
        return
    # 난간(높이 10px): 북쪽 손잡이 y7..8 이 북쪽 고리(y16..17) 위 동자에 얹힌다. 옆 손잡이는 x0..1 · x30..31,
    # 북 끝 y7 → 남 기둥 갓 y32. 기둥 몸 y34..42, 발 그늘 y43 — 구멍 남쪽 모서리(y43)에 선다.
    T = 10 if mat == 'wood' else 9                                # 난간은 낮게 — 높은 살대 = 아기 침대(나무 VQA r20)·철망 선반·수레(회색 VQA r23)
    # 북쪽 난간: 가는 손잡이 1px + 그 밑 그늘 1px + 4px 간격 동자 — 사이로 벽면이 비친다. 두 줄 띠·굵은 머리대는
    # 침대 머리판(나무 VQA r11)·벽난로·히터 앞판(회색 VQA r26 2/3)으로 읽힌다. 나무·회색 같은 짜임.
    for x in range(4, 29, 4):
        c.VL(x, T + 1, 16 - T, _k(M['post'])); c.P(x + 1, 17, K('yoru', -2))
    c.HL(0, T, 32, _k(M['railH'])); c.HL(1, T + 1, 30, _k(M['railD']))
    c.HL(3, 17, 26, K('ita', -3) if mat == 'wood' else K('yoru', -1))   # 동자 발이 바닥에 닿는 그늘(밑 막이 없음 — 상자 틀로 읽힌다, VQA r9·r10)
    # 옆 난간: 바깥 윤곽 1px + 밝은 손잡이 1px(가볍게 — 굵은 옆 기둥 둘이 앞을 막으면 상자 틀로 읽힌다, VQA r9).
    cap = 28                                                      # 기둥이 구멍 남쪽 끝보다 앞에서 끝난다 — 남쪽 입구가 트여 보이게(나무 VQA r21 3/3 「닫힌 틀」, 회색 r23 「다리 달린 선반」)
    if mat != 'wood':                                             # 회색: 옆 난간은 구멍 가장자리를 따라 남쪽 끝 가까이까지 가는 납작한 띠(위에서 본 손잡이), 서 있는 기둥 몸 없음 —
        for xo, xh in ((0, 1), (31, 30)):                         # 남쪽 기둥 = 상자 다리·가전 받침(VQA r24·r25 다수)
            c.VL(xo, T, YS - 1 - T, OL); c.VL(xh, T, YS - 3 - T, _k(M['rail'], -1))   # 옆 손잡이는 중간 쇠색 — 밝은 세로줄 둘 = 가전 앞판 틀(VQA r29)
            for y in range(T + 5, YS - 4, 5): c.P(xh, y, _k(M['railD']))
            c.R(min(xo, xh), YS - 4, 2, 2, _k(M['railH'], 1)); c.P(xh, YS - 3, _k(M['railD']))
        return
    for xo, xh in ((0, 1), (31, 30)):
        c.VL(xo, T, cap + 11 - T, OL); c.VL(xh, T, cap - T, _k(M['railH']))
        for y in range(T + 5, cap - 1, 5): c.P(xh, y, _k(M['railD']))  # 동자 이음
        c.R(min(xo, xh), cap, 2, 2, _k(M['railH'])); c.R(min(xo, xh), cap + 2, 2, 9, _k(M['post'])); c.P(xh, cap + 2, _k(M['railD']))   # 기둥 몸 9px, 발 그늘 없음
