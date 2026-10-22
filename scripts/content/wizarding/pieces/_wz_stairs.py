"""마법 학교 계단 공용 그리기 (2026-10-22 다시 그림 — 사용자 「계단들이 다 씹창」).

두 종류만 있다. 화풍 규칙은 CONTRACT.md 1절(42색·유색 1px 윤곽·빛 왼쪽 위·면당 3~4단).

* up_into_doorway(c, M) — 올라가는 계단 2×3(32×48, walk SS/FF/ff). 북벽에 붙인다: 위 두 줄은 북벽 정면 자리의 문틀
  (돌 첨두 아치 · 나무 기둥과 인방 · 리벳 무쇠 틀)이고, 그 안으로 계단이 북쪽으로 올라가 위층 빛 속으로 사라진다.
  남쪽에서 들어서서 북쪽을 보며 오른다. 밝은 디딤판 + 어두운 챌판 8단, 위로 갈수록 얇고, 꼭대기 두 단은 위층 빛을 받는다.
  맨 아래 줄은 바닥으로 나온 첫 단 + 양옆 손잡이·친주(양옆 투명, 동쪽 바닥에 그림자).
  (방 가운데에 홀로 선 계단은 「어디로 가는지 모르는 단상」으로 읽혀 버렸다 — 적대 검수 r1·r2.)
* well_down(c, M) — 내려가는 계단통 2×2(32×32, walk ff/ff). 바닥에 뚫린 구멍: 북·서·동 세 쪽 난간, 남쪽만 열림.
  남쪽 바닥 가장자리 돌 턱(코) 바로 아래부터 디딤판이 북쪽으로 내려가며 한 단씩 어두워져 끝은 거의 검다.
  챌판은 보이지 않는다(내려가는 계단의 챌판은 북쪽을 본다). 남쪽 띠와 난간 바깥은 투명(그 방 바닥).

M(재질 묶음): tread·tread_hi·tread_lo(디딤판 램프와 코·몸 단) · riser·rise_hi·rise_lo(챌판) · rail('stone'|'wood'|'iron' 손잡이) ·
frame(문틀 재질) · glow('warm'|'cool') · runner(가운데 깔개 램프 또는 None) · bits(덧그림 함수 또는 None).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from wzlib import K   # noqa: E402

W = 32
SHADOW = K('ink', 1)
SHADOW2 = K('ink', 1)


def _hs(x, y, s=0):
    return (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff) / 65536.0


def _rm(kind):
    return {'stone': 'stone', 'wood': 'wood', 'iron': 'iron'}[kind]


# ───────────────────────── 난간 ─────────────────────────
def rail_north(c, y0, kind, x0, x1, see_through=True):
    """북쪽 가로 난간 7px(y0 손잡이/갓 · y0+1..4 동자 · y0+5 밑판 · y0+6 밑 그늘). see_through 면 동자 사이는 투명."""
    m = _rm(kind)
    gap = None if see_through else K('night', 0)
    if kind == 'stone':
        if gap: c.R(x0, y0 + 2, x1 - x0, 3, gap)
        c.HL(x0, y0, x1 - x0, K(m, 5)); c.HL(x0, y0 + 1, x1 - x0, K(m, 3))
        for x in range(x0 + 1, x1 - 1, 4):                       # 배 부른 돌 동자(2px, 왼쪽 빛)
            c.VL(x, y0 + 2, 3, K(m, 4)); c.VL(x + 1, y0 + 2, 3, K(m, 2))
            c.P(x, y0 + 3, K(m, 5))
        c.HL(x0, y0 + 5, x1 - x0, K(m, 4)); c.HL(x0, y0 + 6, x1 - x0, K(m, 2))
        c.HL(x0, y0 - 1 if y0 > 0 else y0, 0, K(m, 0))
    elif kind == 'wood':
        if gap: c.R(x0, y0 + 2, x1 - x0, 3, gap)
        c.HL(x0, y0, x1 - x0, K(m, 5)); c.HL(x0, y0 + 1, x1 - x0, K(m, 2))
        for x in range(x0 + 2, x1 - 1, 5):
            c.VL(x, y0 + 2, 3, K(m, 4)); c.VL(x + 1, y0 + 2, 3, K(m, 2))
        c.HL(x0, y0 + 5, x1 - x0, K(m, 3)); c.HL(x0, y0 + 6, x1 - x0, K(m, 1))
    else:   # iron: 가는 무쇠 살 + 황동 손잡이
        if gap: c.R(x0, y0 + 2, x1 - x0, 3, gap)
        c.HL(x0, y0, x1 - x0, K('brass', 4)); c.HL(x0, y0 + 1, x1 - x0, K('brass', 2))
        for x in range(x0 + 1, x1, 3):
            c.VL(x, y0 + 2, 3, K('iron', 3))
        c.HL(x0, y0 + 4, x1 - x0, K('iron', 2))
        c.HL(x0, y0 + 5, x1 - x0, K('iron', 3)); c.HL(x0, y0 + 6, x1 - x0, K('iron', 1))


def newel(c, x, y, h, kind):
    """3px 친주(기둥). 밝은 머리, 왼쪽 빛, 오른쪽 그늘, 밑 윤곽."""
    m = _rm(kind)
    hi = 5 if m != 'iron' else 4
    c.R(x, y, 3, h, K(m, hi - 2))
    c.VL(x, y, h, K(m, hi - 1)); c.VL(x + 2, y, h, K(m, hi - 3))
    c.HL(x, y, 3, K(m, hi)); c.P(x + 2, y, K(m, hi - 1))
    if kind == 'iron': c.P(x + 1, y, K('brass', 5)); c.P(x + 1, y + 1, K('brass', 3))
    if kind == 'stone': c.HL(x, y + 2, 3, K(m, hi - 3))
    c.HL(x, y + h - 1, 3, K(m, 0))


def hand_rail(c, x, y0, y1, kind, lit):
    """계단 옆 손잡이 난간 3px(세로로 흐름): 손잡이 + 동자 머리. lit=서쪽(빛)."""
    m = _rm(kind)
    top = 5 if m != 'iron' else 4
    h = y1 - y0
    if kind == 'iron':
        c.VL(x, y0, h, K('iron', 1)); c.VL(x + 1, y0, h, K('brass', 4 if lit else 3)); c.VL(x + 2, y0, h, K('iron', 1))
        for y in range(y0 + 3, y1, 5): c.P(x + 1, y, K('brass', 2))
        return
    if lit:
        c.VL(x, y0, h, K(m, 0)); c.VL(x + 1, y0, h, K(m, top)); c.VL(x + 2, y0, h, K(m, top - 2))
    else:
        c.VL(x, y0, h, K(m, top - 2)); c.VL(x + 1, y0, h, K(m, top - 1)); c.VL(x + 2, y0, h, K(m, 0))
    step = 8 if kind == 'stone' else 6
    for y in range(y0 + step - 1, y1, step):
        c.P(x + 1, y, K(m, top - 2))


# ───────────────────────── 디딤판 ─────────────────────────
def draw_steps(c, M, tx0, tx1, y, treads, warm=0, span=None):
    """y 부터 아래로 단마다 디딤판 윗면 treads[i] px(맨 윗줄은 뒤 챌판 밑 그늘, 몸, 맨 아랫줄은 밝은 앞 모서리) → 챌판 2px(코 밑 그늘 · 앞면).
    위에서 본 수평면(디딤판) → 밝은 앞 모서리 → 어두운 앞면(챌판) 순서라 3/4 윗면으로 읽힌다.
    위(멀다)일수록 한 단 어둡다. warm>0 이면 맨 위 warm 단은 위층 빛(황동 램프)을 받는다. 반환 steps [(종류, y, h, i)], 끝 y."""
    steps = []
    for i, h in enumerate(treads):
        steps.append(('t', y, h, i)); y += h
        steps.append(('r', y, 2, i)); y += 2
    n = len(treads)
    for kind_s, yy, h, i in steps:
        far = (n - 1 - i)                                   # 0=맨 아래(가까움)
        lit = warm and i < warm
        if kind_s == 't':
            tm = 'brass' if lit else M['tread']
            lo = M['tread_lo'] - (1 if far >= n - 2 and not lit else 0)
            hi = M['tread_hi'] - (1 if far >= n - 1 and not lit else 0)
            if lit: lo, hi = 4, 5
            if span:                                                                 # 원근: 줄마다 폭이 다르다
                for k in range(h):
                    a0, a1 = span(yy + k)
                    col = K(tm, lo - 1) if k == 0 else K(tm, hi) if k == h - 1 else K(tm, lo)
                    c.HL(a0, yy + k, a1 - a0, col)
                    c.P(a0 - 1, yy + k, K(tm, hi) if k == h - 1 else K(M.get('side', 'stone'), 2))   # 서쪽 옆판 윗모서리
                    c.P(a1, yy + k, K(tm, hi) if k == h - 1 else K(M.get('side', 'stone'), 3))       # 동쪽 옆판 윗모서리
                    if 0 < k < h - 1:
                        for x in range(a0 + 2, a1 - 2):
                            if _hs(x, yy + k, 5) < 0.06: c.P(x, yy + k, K(tm, lo - 1))
                continue
            c.R(tx0, yy, tx1 - tx0, h, K(tm, lo))
            c.HL(tx0, yy, tx1 - tx0, K(tm, lo - 1))                                  # 뒤 챌판 밑 그늘
            c.HL(tx0, yy + h - 1, tx1 - tx0, K(tm, hi))                              # 밝은 앞 모서리(코)
            c.R(tx1 - 3, yy, 3, h - 1, K(tm, lo - 1))                                # 오른쪽 그늘
            c.VL(tx0, yy, h - 1, K(tm, lo - 1))                                      # 왼쪽 손잡이 그늘
            for x in range(tx0 + 2, tx1 - 3):
                if h >= 4 and _hs(x, i, 5) < 0.08: c.P(x, yy + 1 + (x % (h - 2)), K(tm, lo - 1))
        else:
            rm = M['riser']
            if span:
                for k in range(2):
                    a0, a1 = span(yy + k)
                    c.HL(a0, yy + k, a1 - a0, K(rm, M['rise_lo']) if k == 0 else K(rm, M['rise_hi'] - (1 if far >= n - 2 else 0)))
                    c.P(a0 - 1, yy + k, K(M.get('side', 'stone'), 0)); c.P(a1, yy + k, K(M.get('side', 'stone'), 1))   # 옆판이 챌판 높이에서 어둡게 꺾인다
                continue
            c.HL(tx0, yy, tx1 - tx0, K(rm, M['rise_lo']))                            # 코 밑 그늘
            c.HL(tx0, yy + 1, tx1 - tx0, K(rm, M['rise_hi'] - (1 if far >= n - 2 else 0)))
            c.R(tx1 - 3, yy, 3, 2, K(rm, M['rise_lo']))
    return steps, y


def _runner(c, m, steps, span=None):
    """가운데 붉은 깔개(x12..19)와 챌판마다 황동 계단 막대. span 이 있으면 원근 따라 폭이 줄마다 좁아진다."""
    if span:
        for kind_s, yy, h, i in steps:
            for k in range(h):
                a0, a1 = span(yy + k); w = max(4, round((a1 - a0) * 6 / 22)); x0 = (a0 + a1 - w) // 2
                if kind_s == 't':                                   # 깔개는 디딤판과 같은 결로 접힌다: 윗면 중간 · 코 황동 막대 · 챌판 짙게
                    col = K('brass', 3) if k == h - 1 else K(m, 1) if k == 0 else K(m, 2)
                    c.HL(x0, yy + k, w, col)
                else:
                    c.HL(x0, yy + k, w, K(m, 0) if k == 0 else K(m, 1))
        return
    x0, w = 12, 8
    for kind_s, yy, h, i in steps:
        if kind_s == 't':
            c.R(x0, yy, w, h, K(m, 3)); c.HL(x0, yy, w, K(m, 2)); c.VL(x0 + w - 1, yy, h, K(m, 2))
            c.HL(x0 - 1, yy + h - 1, w + 2, K('brass', 4)); c.P(x0 + w, yy + h - 1, K('brass', 3))   # 앞 모서리 황동 막대
        else:
            c.R(x0, yy, w, h, K(m, 1)); c.HL(x0, yy + 1, w, K(m, 2)); c.VL(x0 + w - 1, yy, h, K(m, 1))


# ───────────────────────── 내려가는 계단통 2×2 ─────────────────────────
HX0, HX1 = 6, 26          # 구멍 x
HY0, HY1 = 8, 26          # 구멍 y(북쪽 턱 아래 ~ 남쪽 턱 위)


def _low_rail_h(c, x0, x1, y, kind):
    """낮은 가로 난간(위에서 비스듬히 본다): 손잡이 윗면 2px(밝음·중간) + 짧은 동자 2px(사이 투명) + 밑 그늘."""
    m = _rm(kind); hi = 5 if m != 'iron' else 4
    cap = 'brass' if kind == 'iron' else m
    c.HL(x0, y, x1 - x0, K(cap, hi)); c.HL(x0, y + 1, x1 - x0, K(cap, hi - 2))
    for x in range(x0 + 2, x1 - 1, 4):
        c.VL(x, y + 2, 2, K(m, hi - 1)); c.VL(x + 1, y + 2, 2, K(m, hi - 3))
    c.HL(x0, y + 4, x1 - x0, K(m, 1))


def _low_rail_v(c, x, y0, y1, kind, lit):
    """낮은 세로 난간(서·동): 손잡이 윗면 2px 폭이 북→남으로 흐르고 바깥쪽에 짧은 동자 그늘."""
    m = _rm(kind); hi = 5 if m != 'iron' else 4
    cap = 'brass' if kind == 'iron' else m
    h = y1 - y0
    c.VL(x, y0, h, K(cap, hi if lit else hi - 1)); c.VL(x + 1, y0, h, K(cap, hi - 2))
    for y in range(y0 + 3, y1 - 1, 4):
        c.P(x + 2, y, K(m, hi - 3)); c.P(x + 2, y + 1, K(m, 1))


def well_down(c, M):
    """바닥에 뚫린 내려가는 계단통(위에서 비스듬히 본다). 구멍 둘레에 턱을 따로 두르지 않는다 — 방 바닥이 그대로 구멍 가장자리까지
    오고(투명), 가장자리에는 1px 어두운 떨어짐 선만 있다. 북·서·동 세 쪽 바닥 위에 낮은 난간(위에서 본 2px 손잡이 윗면 + 그늘),
    남쪽은 난간 없이 열려 있어 바닥 높이에 가까운 첫 디딤판으로 그대로 들어선다.
    구멍 안: 줄눈 없는 어두운 북쪽 안벽과 디딤판 네 단이 북쪽으로 내려가며 한 단씩 어두워진다(벽돌 줄눈·기울인 옆벽은 아궁이로 읽혀 뺐다 — 단마다 밝은 코만 둔다).
    각 디딤판의 북쪽 끝(화면 위)은 한 단 아래로 떨어지는 모서리라 밝은 코, 남쪽 끝은 앞 단 코 밑 그늘. 챌판은 북쪽을 봐서 안 보인다."""
    kind = M['rail']
    X0, X1, Y0 = 5, 27, 5
    c.clear(0, 0, 32, 32)
    # 북쪽 안벽 정면(바닥 아래로 꺼진 벽, 가장 어둡다) y5..8 + 맨 윗줄 바닥 끝 모서리
    c.R(X0, Y0, X1 - X0, 4, K('night', 0)); c.HL(X0, Y0, X1 - X0, K('stone', 1))   # 줄눈 없는 민 어둠(벽돌 무늬는 아궁이로 읽혔다)
    # 2026-10-23 다시 그림: 같은 4px 띠 다섯은 바닥 환기구·창살로 읽혔다(Argon 적대 검수). 단 높이가 남쪽(가까운 쪽)으로 갈수록 커지고
    # (원근 2·3·4·5·6), 구덩이 양옆 안벽이 북쪽으로 갈수록 넓어지며(사다리꼴), 가까운 세 단에는 돌 줄눈이 엇갈려 박힌다.
    bands = M.get('bands') or [(('night', 0), ('night', 1), 2), (('night', 1), ('stone', 1), 3), (('stone', 1), ('stone', 2), 4),
                               (('stone', 2), ('stone', 3), 5), (('stone', 3), ('stone', 4), 6)]   # 가까운 단도 방 바닥보다 밝지 않게(밝은 띠 = 솟은 단상)
    y = Y0 + 4
    nb = len(bands)
    for k, ((bm, bt), (nm, nt), h) in enumerate(bands):
        c.R(X0, y, X1 - X0, h, K(bm, bt))
        c.HL(X0, y, X1 - X0, K(nm, nt))                                   # 북쪽 끝 = 한 단 아래로 떨어지는 코(밝음)
        if k < nb - 1: c.HL(X0, y + h - 1, X1 - X0, K(bm, max(0, bt - 1)))   # 앞(가까운) 단 코 밑 그늘
        if k >= nb - 3 and h >= 4:                                         # 가까운 세 단: 엇갈린 돌 줄눈(세로 1px)
            for x in range(X0 + 3 + (k % 2) * 4, X1 - 2, 8): c.VL(x, y + 1, h - 2, K(bm, max(0, bt - 1)))
        for yy in range(y, y + h):                                         # 구덩이 안벽: 북쪽(먼 단)일수록 곧게 넓어진다(원근선)
            ww = 1 + round(4 * (28 - yy) / 19)
            c.HL(X0, yy, ww, K('stone', 0) if yy == y else K(bm, max(0, bt - 2)))
            c.HL(X1 - ww, yy, ww, K('stone', 1) if yy == y else K(bm, max(0, bt - 1)))
            c.P(X0 + ww, yy, K('stone', 2) if yy == y else K(bm, max(0, bt - 1)))   # 안벽과 디딤판이 만나는 원근선
        if M.get('bits'): M['bits'](c, k, y, h)
        y += h
    assert y == 29, y
    # 구멍 가장자리 떨어짐 선(서·동), 남쪽은 첫 단과 바닥 사이 얕은 이음
    c.VL(X0 - 1, Y0, 29 - Y0, K('stone', 1)); c.VL(X1, Y0, 29 - Y0, K('stone', 2))
    c.HL(X0 - 1, Y0 - 1, X1 - X0 + 2, K('stone', 2))
    c.HL(X0, 29, X1 - X0, K('stone', 2))
    # 세 쪽 낮은 난간: 위에서 본 2px 손잡이 윗면 + 남동쪽 1px 바닥 그늘(솟은 기둥 없음)
    m = _rm(kind); hi = 5 if m != 'iron' else 4
    cap = 'brass' if kind == 'iron' else m
    sh = K(m, 1) if m != 'iron' else K('iron', 2)
    c.HL(1, 1, 30, K(cap, hi)); c.HL(1, 2, 30, K(cap, hi - 2)); c.HL(3, 3, 26, sh)       # 북쪽
    c.VL(1, 1, 27, K(cap, hi)); c.VL(2, 1, 27, K(cap, hi - 2)); c.VL(3, 3, 25, sh)         # 서쪽
    c.VL(29, 1, 27, K(cap, hi - 1)); c.VL(30, 1, 27, K(cap, hi - 2)); c.VL(31, 2, 26, sh)  # 동쪽
    for x in (1, 29):                                                                       # 남쪽 끝: 손잡이가 바닥으로 낮게 끝난다
        c.HL(x, 28, 2, K(cap, hi - 2)); c.HL(x, 29, 2, sh)


# ───────────────────────── 북벽 문 안으로 올라가는 계단 2×3 ─────────────────────────
GLOW = {'warm': (('brass', 0), ('brass', 1)), 'cool': (('night', 1), ('night', 2)), 'shop': (('brass', 2), ('brass', 3))}


def up_into_doorway(c, M):
    """북벽에 붙여 놓는 올라가는 계단(walk SS/FF/ff). 위 두 줄은 북벽 정면 자리: 문틀(돌 첨두 아치 · 나무 기둥과 인방 ·
    리벳 무쇠 틀) 안으로 계단이 북쪽으로 올라가 위층 빛 속으로 사라진다. 맨 아래 줄은 아래층 바닥으로 나온 첫 단들 +
    양옆 손잡이·친주(양옆은 투명, 오른쪽 바닥에 그림자). 위로 갈수록 디딤판이 얇아지고, 꼭대기 두 단은 위층 빛(황동색)을 받는다.
    M: 디딤판·챌판 램프(draw_steps) · rail(손잡이) · frame('stone'|'wood'|'iron') · runner(깔개 램프 또는 None) · bits."""
    kind = M['rail']; fr = M.get('frame', 'wood')
    fm = _rm(fr); fhi = 5 if fm != 'iron' else 4
    # 문 안: 계단통 옆벽(그늘 돌) + 위층 바닥 끝에 번진 빛
    c.R(3, 0, 26, 32, K('stone', 1))
    c.R(4, 4, 24, 7, K('night', 0))
    (g0m, g0t), (g1m, g1t) = GLOW[M.get('glow', 'warm')]
    c.R(6, 7, 20, 3, K(g0m, g0t)); c.R(9, 8, 14, 2, K(g1m, g1t))
    c.HL(6, 6, 20, K('night', 1))
    # 계단 몸(2026-10-23 다시 그림 — 고른 폭의 가로 띠는 선반·책장으로 읽혔다, object-gate 눈 거부권·3/4 FAIL):
    # 계단 폭이 맨 아래 [5,27) 에서 맨 위 [10,22) 로 곧게 좁아진다(원근). 그 바깥은 계단통 양옆 벽 안면(사다리꼴, 서쪽 그늘·동쪽 빛),
    # 단 끝 1px 는 옆판(stringer) — 디딤판·코 높이는 밝은 윗모서리, 챌판 높이는 어둡게 꺾여 원근선을 따라 모인다.
    TY = 10
    def span(yy):
        t = (47 - yy) / (47 - TY)
        return round(5 + 5 * t), round(27 - 5 * t)
    sm = M.get('side', 'stone')
    for yy in range(TY, 48):
        x0, x1 = span(yy)
        c.R(3, yy, x0 - 3, 1, K(sm, 1)); c.R(x1, yy, 29 - x1, 1, K(sm, 2))
    steps, y = draw_steps(c, M, 0, 0, TY, [3, 4, 6, 7, 7], warm=1, span=span)
    assert y == 47, y
    if M.get('runner'): _runner(c, M['runner'], [st for st in steps if st[1] >= 14], span=span)
    if M.get('bits'): M['bits'](c, steps)
    x0, x1 = span(47); c.HL(x0, 47, x1 - x0, K(M['riser'], 0))
    # 맨 아래 줄(바닥 위): 양옆 투명 + 오른쪽 그림자, 원근 따라 비스듬히 오르는 손잡이, 친주, 첫 단 밑 접지선
    c.clear(0, 32, 3, 16); c.clear(29, 32, 3, 16)
    for yy in range(33, 48): c.R(29, yy, 1 + (47 - yy) // 6, 1, SHADOW2)
    rm = _rm(kind); top = 5 if rm != 'iron' else 4
    capc = K('brass', 3) if kind == 'iron' else K(rm, top - 1)
    for yy in range(26, 40):                       # 손잡이: 아래 단 옆으로만, 계단 끝 바깥 2px 를 원근선 따라(윗면 + 바깥 그늘)
        x0, x1 = span(yy)
        c.P(x0 - 2, yy, capc); c.P(x0 - 3, yy, K(rm, 0) if rm != 'iron' else K('iron', 1))
        c.P(x1 + 1, yy, K(rm, top - 2) if kind != 'iron' else K('brass', 2)); c.P(x1 + 2, yy, K(rm, 0) if rm != 'iron' else K('iron', 1))
    c.VL(2, 32, 9, SHADOW); c.VL(29, 32, 9, SHADOW)
    newel(c, 3, 38, 10, kind); newel(c, 26, 38, 10, kind)
    # 문틀: 기둥 x0..2 · x29..31 (y0..31)
    for x0, lit in ((0, True), (29, False)):
        c.R(x0, 0, 3, 32, K(fm, fhi - 2))
        c.VL(x0, 0, 32, K(fm, 0) if lit else K(fm, fhi - 3)); c.VL(x0 + 1, 0, 32, K(fm, fhi - 1) if lit else K(fm, fhi - 2))
        c.VL(x0 + 2, 0, 32, K(fm, fhi - 3) if lit else K(fm, 0))
        if fr == 'stone':
            for yy in (6, 13, 20, 27): c.HL(x0, yy, 3, K(fm, fhi - 4)); c.P(x0 + 1, yy + 1, K(fm, fhi))
        elif fr == 'iron':
            for yy in range(4, 31, 5): c.P(x0 + 1, yy, K('brass', 4))
        else:
            for yy in (9, 21): c.HL(x0, yy, 3, K('wood', 1)); c.P(x0 + 1, yy + 1, K('iron', 3))
        c.HL(x0, 31, 3, K(fm, 0))
    # 인방·아치
    if fr == 'stone':
        c.R(0, 0, 32, 4, K(fm, fhi - 2)); c.HL(0, 0, 32, K(fm, fhi)); c.HL(0, 3, 32, K(fm, fhi - 3))
        for i, w in enumerate((8, 5, 3, 1)):                       # 첨두 아치 어깨
            c.R(3, 4 + i, w, 1, K(fm, fhi - 2)); c.R(29 - w, 4 + i, w, 1, K(fm, fhi - 3))
            c.P(3 + w, 4 + i, K(fm, 0)); c.P(28 - w, 4 + i, K(fm, 0))
        c.R(14, 0, 4, 4, K(fm, fhi - 1)); c.HL(14, 3, 4, K(fm, fhi - 3)); c.VL(17, 0, 4, K(fm, fhi - 3))   # 쐐기돌
    elif fr == 'iron':
        c.R(0, 0, 32, 4, K('iron', 2)); c.HL(0, 0, 32, K('iron', 4)); c.HL(0, 1, 32, K('iron', 3)); c.HL(0, 3, 32, K('iron', 0))
        for x in range(3, 30, 4): c.P(x, 2, K('brass', 4))
        c.HL(3, 4, 26, K('night', 0))
    else:
        c.R(0, 0, 32, 4, K('wood', 3)); c.HL(0, 0, 32, K('wood', 4)); c.HL(0, 1, 32, K('wood', 4)); c.HL(1, 1, 30, K('wood', 5))
        c.HL(0, 3, 32, K('wood', 1)); c.HL(3, 4, 26, K('wood', 0))
        for x in (6, 25): c.P(x, 2, K('iron', 3))
