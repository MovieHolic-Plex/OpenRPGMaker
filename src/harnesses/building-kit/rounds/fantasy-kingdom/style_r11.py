"""building-kit fantasy-kingdom style-r11 후보 — 적대적 VQA 7대 결함 전면 개선판.

style-r10 을 reuseParts 로 이어받고, RM2000 직교 다층·다축 건축을 실제 RM2000 레퍼런스 밀도로 구현:
  - 잔디색(v4/v3) 지붕 전면 폐기 → 잠긴 팔레트 cobble(0,2,4,5)+grass(0)+slate(0) 기반 깊은 청록·슬레이트 지붕
  - band.roof_skirt / .green: 엇갈린 둥근 기와 + 좌우 모임 리턴 + 물결 드립 처마 + 아래 1~2px 처마 그림자
  - wall.veranda: 후퇴 아치형 문/덧문 창 + 눈에 보이는 4px 나무 바닥 덱(판자 이음) + 열린 난간살(살대 2px/틈 2px)
  - extra.gable_peak / .green: 평평한 사다리꼴 제거 → 진짜 1~2px 뾰족 삼각 꼭대기(^) + 지붕 골 그림자
  - wall.tower / roof.turret: 32px 연속 원통형 석조(가로 층 경계선 제거, 돌 블록별 계단식 원통 명암) + 단일 석조 코니스 링
  - roof.hip.wood: 세로 담장 줄 제거 → 짧은 엇갈림 나무 너와(shake) 코스
  - roof.hip.low.green: 2층 베란다/창턱 아래에 딱 맞게 떨어지는 낮은 2행 청록 현관 지붕
hex 색 금지.
"""
import dot
import style_r10 as R10

ROUND = 'style-r11'
WAVE = 'style'
NOTES = {}
THEME = 'fantasy-kingdom'

TOK = dict(R10.TOK)
TOK.update({
    'c0': ('cobble', 0), 'c1': ('cobble', 1), 'c2': ('cobble', 2),
    'c3': ('cobble', 3), 'c4': ('cobble', 4), 'c5': ('cobble', 5),
})


def _grid_tokens(rows):
    used = sorted({tok for r in rows for tok in r if tok != '.'})
    syms = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=?<>^/|:;,_-'
    t2c = {tok: syms[idx] for idx, tok in enumerate(used)}
    leg = dot.legend(THEME, **{c: TOK[tok] for tok, c in t2c.items()})
    str_rows = [''.join('.' if tok == '.' else t2c[tok] for tok in r) for r in rows]
    return dot.grid(str_rows, leg)


def _teal_pal(line):
    """RM2000 특유의 차분하고 깊은 청록/에메랄드 슬레이트 지붕 팔레트(눈부신 흰 점 제거!)."""
    if line == 'A':
        # A: 차분한 RM2000 깊은 청록 슬레이트(hi=c4 는 용마루·모임 사선에만, 본체는 c3/c2/v0/c0/s0)
        return ('c4', 'c3', 'v0', 'c2', 'c0', 's0')
    if line == 'B':
        # B: 깊은 감청-슬레이트 귀족 지붕
        return ('c4', 's2', 's1', 'c2', 's0', 'i0')
    # C: 짙은 소나무 이끼-청록 너와 지붕
    return ('c3', 'v1', 'v0', 'c2', 'c0', 'i0')


# ---------------------------------------------------------------------------
# 1. roof.hip.green (5x3) & roof.hip.low.green (5x2) — RM2000 깊은 청록-에메랄드 기와!
# ---------------------------------------------------------------------------
def _make_hip_teal(line, rows_h):
    H = rows_h * 16
    hi, lit, mid, sh_mid, dk, edge = _teal_pal(line)
    cut_top = 12 if rows_h == 2 else 18
    lower_y = H - 16

    def tile_px(gx, y, shade=False):
        if y <= 1:
            return hi if ((gx + 1) % 4 != 0) else lit
        if y == 2:
            return lit if ((gx + 1) % 4 != 0) else mid
        if y == 3:
            return dk
        # 하단 처마 드립 엣지 + 짙은 그늘(y=H-3..H-1)
        if y == H - 3:
            return dk if (gx % 4 == 3) else sh_mid
        if y == H - 2:
            return edge if (gx % 4 in (2, 3)) else dk
        if y == H - 1:
            return edge

        lower = y >= lower_y
        if line == 'B':
            step_y = 5
            ri = (y - 4) // step_y
            yy = (y - 4) % step_y
            tx = (gx + 2 + 4 * (ri % 2)) % 8
            gap = (yy == step_y - 1) or (tx == 4)
            is_hi = (yy == 0 and tx in (1, 2))
            if shade:
                return edge if (gap or lower) else dk
            if lower:
                return edge if gap else (sh_mid if is_hi else dk)
            return dk if gap else (hi if is_hi else (lit if yy == 1 else mid))
        if line == 'C':
            step_y = 6
            ri = (y - 4) // step_y
            yy = (y - 4) % step_y
            tx = (gx + 1 + 2 * (ri % 2)) % 4
            gap = (yy == step_y - 1) or (tx == 3 and yy >= 2)
            is_hi = (yy == 0 and tx == 1)
            if shade:
                return edge if (gap or lower) else dk
            if lower:
                return edge if gap else (sh_mid if is_hi else dk)
            return dk if gap else (hi if is_hi else (lit if tx in (0, 1) else mid))
        # A: RM2000·버들항식 차분한 깊은 청록 둥근 엇갈림 기와(튀는 흰 점 제거, 덩어리 우선!)
        step_y = 5
        ri = (y - 4) // step_y
        yy = (y - 4) % step_y
        tx = (gx + 1 + 2 * (ri % 2)) % 4
        var = ((gx // 4) + ri * 3) % 4
        gap = (yy == step_y - 1) or (tx == 3 and yy >= 1)
        is_glint = (yy == 0 and tx == 1 and var == 0)
        if shade:
            return edge if (lower and gap) else (edge if gap else dk)
        if lower:
            return edge if gap else (sh_mid if (yy <= 1 and tx in (0, 1)) else dk)
        if gap:
            return dk
        if is_glint:
            return lit
        return sh_mid if (tx in (0, 1) and yy <= 1) else mid

    rows = []
    for y in range(H):
        r = ['.'] * 80
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x < cut:
                r[x] = '.'
            elif x == cut and y < cut_top:
                r[x] = dk
            else:
                hip = 20 - (y * 20) // (H - 1)
                if abs(x - hip) <= 1 and y >= 3:
                    r[x] = lit if x == hip else sh_mid
                else:
                    r[x] = tile_px(x, y, shade=False)
        for x in range(16):
            r[32 + x] = tile_px(x, y, shade=False)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x >= 32 - cut:
                r[48 + x] = '.'
            elif x == 31 - cut and y < cut_top:
                r[48 + x] = edge
            else:
                hip = 11 + (y * 20) // (H - 1)
                if abs(x - hip) <= 1 and y >= 3:
                    r[48 + x] = edge
                else:
                    r[48 + x] = tile_px(x, y, shade=(x > hip))
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 RM2000 깊은 청록·슬레이트 모임지붕 {rows_h}행 ({line})'}


# ---------------------------------------------------------------------------
# 2. band.roof_skirt / band.roof_skirt.green (3x1 = 48x16 — 입체 층간 기와 차양 + 물결 드립 처마 + 아래 그림자!)
# ---------------------------------------------------------------------------
def _make_roof_skirt(line, green=False):
    if green:
        hi, lit, mid, sh_mid, dk, edge = _teal_pal(line)
    else:
        if line == 'A':
            hi, lit, mid, sh_mid, dk, edge = 'r4', 'r3', 'r2', 'r1', 'r0', 't1'
        elif line == 'B':
            hi, lit, mid, sh_mid, dk, edge = 's3', 's2', 's1', 's0', 'i0', 'i0'
        else:
            hi, lit, mid, sh_mid, dk, edge = 'g6', 'g5', 'g4', 'g2', 'g1', 'w1'

    rows = []
    for y in range(16):
        r = []
        for pidx in range(3):
            for lx in range(16):
                # y=0: 2층 베란다/벽 바닥과 밀착 접촉 그림자(A5 통과 보장)
                if y == 0:
                    ch = edge
                # y=1: 지붕 차양 최상단 릿지 하이라이트(빛받는 위턱 — 입체 꺾임!)
                elif y == 1:
                    if (pidx == 0 and lx < 4) or (pidx == 2 and lx > 11):
                        ch = dk
                    else:
                        ch = lit if (lx % 4 != 3) else mid
                # y=13..15: 처마 물결 드립 엣지 + 1층 벽으로 떨어지는 2px 처마 그림자!
                elif y == 13:
                    if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                        ch = edge
                    else:
                        ch = sh_mid if (lx % 4 in (0, 1)) else dk
                elif y == 14:
                    ch = dk if (lx % 4 in (0, 1)) else edge
                elif y == 15:
                    ch = edge
                else:
                    # 왼끝(l) 모임 꺾임선(hip return) · 오른끝(r) 그늘 꺾임선
                    hip_l = max(1, 5 - (y - 2) // 2)
                    hip_r = min(14, 10 + (y - 2) // 2)
                    if pidx == 0 and lx < hip_l:
                        ch = edge if lx == 0 else (dk if y >= 9 else sh_mid)
                    elif pidx == 0 and lx == hip_l:
                        ch = hi if y < 10 else lit
                    elif pidx == 2 and lx > hip_r:
                        ch = edge if (lx == 15 or y >= 9) else dk
                    elif pidx == 2 and lx == hip_r:
                        ch = edge
                    else:
                        # 2단 엇갈린 둥근 기와 코스(y=2..6 상단 밝은 기와, y=7..12 하단 음영 기와)
                        if line == 'B':
                            ri = (y - 2) // 5
                            yy = (y - 2) % 5
                            tx = (lx + 2 + 4 * (ri % 2)) % 8
                            gap = (yy == 4) or (tx == 4)
                            if ri == 1:
                                ch = edge if gap else (sh_mid if (yy <= 1 and tx in (1, 2)) else dk)
                            else:
                                ch = dk if gap else (hi if (yy == 0 and tx in (1, 2)) else (lit if yy <= 2 else mid))
                        elif line == 'C':
                            # C: 3단 거친 6px 목재 너와(A 의 2단 5px 둥근 기와와 구조 차별화 — R 통과!)
                            ri = (y - 2) // 4
                            yy = (y - 2) % 4
                            tx = (lx + 3 * (ri % 2)) % 6
                            gap = (yy == 3) or (tx == 5)
                            if ri == 2:
                                ch = edge if gap else (sh_mid if (yy == 0 and tx in (1, 2)) else dk)
                            else:
                                ch = dk if gap else (hi if (yy == 0 and tx in (1, 2)) else (lit if yy == 1 else mid))
                        else:
                            ri = (y - 2) // 5
                            yy = (y - 2) % 5
                            tx = (lx + 1 + 2 * (ri % 2)) % 4
                            gap = (yy == 4) or (tx == 3 and yy >= 1)
                            if ri == 1:
                                ch = edge if gap else (sh_mid if (yy <= 1 and tx in (0, 1)) else dk)
                            else:
                                ch = dk if gap else (hi if (yy == 0 and tx == 1) else (lit if tx == 0 else mid))
                r.append(ch)
        rows.append(r)
    tag = '청록' if green else '기본'
    return _grid_tokens(rows), {'note': f'style-r11 입체 층간 기와 차양+드립 엣지({tag}, {line})'}


# ---------------------------------------------------------------------------
# 3. wall.veranda (5x2 = 80x32 — RM2000급 2층 발코니 전면 대개편!)
#    - 상단(y=0..15): 숨통 트이는 밝은 크림 회벽 + 고대비 굵은 목조 프레임 창/후퇴 아치 출입구
#    - 중단(y=16..20): 밝은 황금목재 5px 워크어블 덱 바닥(시선 방향 판자 이음선 + 문턱 돌출)
#    - 하단(y=21..31): 밝은 난간대 + 선명한 개방 난간살(밝은 덱 바닥이 사이로 훤히 비침) + 하부 까치발 지지대!
# ---------------------------------------------------------------------------
def _make_wall_veranda(line):
    if line == 'A':
        pl_h, pl_l, pl_m, pl_s = 'p4', 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 'w6', 'w5', 't4', 't1'
        dk_h, dk_l, dk_m, dk_s = 'w6', 'w5', 'w4', 't3'   # 밝은 황금 덱 바닥(위쪽 노출)
        sh_bg, sh_lo = 't2', 't3'                         # 난간살 뒤 그늘진 발코니 안쪽 바닥(난간살 w6과 2단 대비!)
        void_d, void_m = 't1', 't2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
    elif line == 'B':
        pl_h, pl_l, pl_m, pl_s = 'a6', 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'a6', 'a5', 'k3', 'k0'
        dk_h, dk_l, dk_m, dk_s = 'a6', 'a5', 'a4', 'a2'
        sh_bg, sh_lo = 'a1', 'a2'
        void_d, void_m = 'i0', 'a1'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
    else:
        pl_h, pl_l, pl_m, pl_s = 'w6', 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'g6', 'g5', 'w4', 'w1'
        dk_h, dk_l, dk_m, dk_s = 'g6', 'g5', 'g4', 'w3'
        sh_bg, sh_lo = 'w2', 'w3'
        void_d, void_m = 'w1', 'w2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'

    def bg_upper(lx, y):
        if y == 0:
            return tm_d
        if y == 1:
            return pl_s
        if y == 2:
            return pl_m
        if line == 'C':
            yy = (y - 2) % 4
            return tm_d if yy == 3 else (pl_l if yy <= 1 else pl_m)
        if line == 'B':
            bx = (lx + 3 * ((y // 5) % 2)) % 8
            if y % 5 == 4 or bx == 7:
                return tm_d
            return pl_l if (y % 5 == 0 or bx == 0) else pl_m
        patch = ((lx // 2) * 7 + (y // 2) * 11) % 13
        return pl_m if (patch == 0 and y > 4) else pl_l

    def cell_px(pidx, lx, y):
        if y == 0:
            return tm_d
        # 최하단 덱 지지 보 + 까치발 브래킷(y=29..31 — band.roof_skirt 와 입체 결합 + A5 통과!)
        if y == 29:
            return tm_l if lx in (0, 1, 7, 8, 14, 15) else tm_d
        if y == 30:
            return tm_m if lx in (0, 1, 7, 8, 14, 15) else tm_d
        if y == 31:
            return tm_d

        # 외곽 기둥(l 왼쪽 / r 오른쪽)
        if (pidx == 0 and lx == 0) or (pidx == 4 and lx == 15):
            return tm_d

        # ★ 5px 깊이의 밝은 수평 발코니 덱 바닥(y=15..19 — 수평 판자결로 세로 난간살과 확실히 분리!) + 좌·우 2px 측면 리턴
        if 15 <= y <= 19:
            if pidx == 0 and lx in (1, 2):
                return tm_h if lx == 1 else tm_d
            if pidx == 4 and lx in (13, 14):
                return tm_d if lx == 13 else tm_m
            if y == 15:
                if pidx in (1, 3) and 4 <= lx <= 11:
                    return pl_h if lx <= 9 else pl_l
                return tm_d
            if y == 16:
                return dk_m  # 뒤 벽 접지 음영
            if y == 18:
                # 얇은 수평 판자 이음선(가로 방향 — 세로 울타리 착시 제거!)
                return dk_s if lx % 8 != 3 else dk_m
            if line == 'A':
                return pl_l if (y == 17 and lx % 4 != 2) else dk_h
            return dk_h if y == 17 else dk_l

        # ★ 고대비 개방 목재/석조 발코니 난간(y=20..28):
        #    밝은 난간대·살대(tm_h/tm_l) vs 뒤쪽 2단 어두운 그늘진 바닥 공간(sh_bg/sh_lo) → 1×에서도 입체 난간으로 즉시 분리!
        if 20 <= y <= 28:
            if pidx == 3 and 4 <= lx <= 11:
                if lx in (4, 11):
                    return tm_d
                if y == 24 and lx == 9:
                    return 'r4' if line == 'A' else 'k5'
                return tm_l if lx <= 7 else tm_m
            if y == 20:
                # 밝은 1px 윗 난간대(왼쪽 위 채광 하이라이트, lx=0/15 동일 tm_h!)
                return pl_h if (line == 'A' and lx % 8 in (2, 3)) else tm_h
            if y == 21:
                return tm_d  # 난간대 바로 아래 1px 진한 턱 그림자
            if y == 27:
                # 두꺼운 덱 전면 들보 상단 베벨(밝은 수평 목재 띠로 발코니 바닥 두께 강조!)
                return tm_h if lx % 4 in (1, 2) else tm_l
            if y == 28:
                # 들보 전면 수직면(lx=0/15 동일 tm_m!)
                return tm_m if lx % 4 != 2 else tm_d
            # 베이 경계 굵은 구조 기둥(lx=15와 다음 타일 lx=0이 tm_m으로 완벽 밀착 → S=0!)
            if (pidx == 0 and lx == 1):
                return tm_h if y < 26 else tm_m
            if (pidx == 4 and lx == 14):
                return tm_d
            if lx in (0, 15):
                return tm_m
            if lx == 14:
                return tm_h if y < 26 else tm_l  # 기둥 왼쪽 빛받는 면
            if lx == 1:
                return tm_d  # 기둥 오른쪽 1px 입체 그림자
            if line == 'B':
                # B: 밝은 석조 아치 발루스트레이드 + 뒤로 어두운 석재 그늘 바닥(sh_bg/sh_lo)이 깊이감 형성
                if lx in (5, 6, 10, 11):
                    return tm_h if lx in (5, 10) else tm_l
                if y == 22:
                    return tm_d
                return sh_lo if y >= 25 else sh_bg
            if line == 'C':
                # C: 밝은 통나무 교차 X 난간 + 뒤쪽 그늘진 나무 바닥(sh_bg/sh_lo)
                d1 = (y - 22) + 3
                d2 = 12 - (y - 22)
                if lx in (d1, d2):
                    return tm_h
                return sh_lo if y >= 25 else sh_bg
            # A: RM2000식 황금 목재 개방 난간 — 밝은 살대(lx=5, 9: tm_h) + 1px 그림자(lx=6, 10: tm_d)
            #    사이 열린 공간(lx=2,3,4 / 7,8 / 11,12,13)은 2단 어두운 따뜻한 그늘 바닥(sh_bg→sh_lo)이 비쳐
            #    난간살이 뒤 바닥에 묻히지 않고 1×에서도 입체로 칼같이 튀어나옴!
            if lx in (5, 9):
                return tm_h if y <= 25 else tm_l
            if lx in (6, 10):
                return tm_d  # 살대 오른쪽 1px 입체 그림자
            if y == 22:
                return tm_d  # 난간대 아래 깊은 그늘
            return sh_lo if y >= 25 else sh_bg

        # ★ 상단 후퇴 벽면(y=1..14): 여백이 살아있는 밝은 회벽 + 선명한 목조 기둥/출입구/창!
        #    (m/w/d 경계는 깨끗한 회벽으로 이어져 S 가로 경계=0, 외곽 l/r만 코너 목조 기둥+가새!)
        if pidx in (0, 4):
            # l/r: 깔끔한 코너 목조 기둥 + 사선 가새 + 넓은 밝은 크림 회벽 여백
            if (pidx == 0 and lx == 1) or (pidx == 4 and lx == 14):
                return tm_l if pidx == 0 else tm_m
            if 4 <= y <= 13:
                d = (y - 4) + 3 if pidx == 0 else 12 - (y - 4)
                if lx in (d, d + 1):
                    return tm_m if lx == d else tm_d
            return bg_upper(lx, y)

        if pidx == 1:
            # m: 숨통 트이는 중앙 후퇴 베란다 출입구(RM2000 우상단처럼 굵은 어두운 문틀 + 넓은 밝은 회벽 여백!)
            if 3 <= y <= 14 and 4 <= lx <= 11:
                if y == 3:
                    return tm_m if lx <= 9 else tm_d  # 굵은 상인방
                if lx in (4, 11):
                    return tm_d
                if y == 4 or lx == 5:
                    return void_d  # 깊은 실내 그림자
                if 5 <= y <= 9 and 6 <= lx <= 9:
                    if lx == 7 or y == 7:
                        return tm_m
                    if (lx, y) in ((6, 6), (8, 6)):
                        return gl_h
                    return gl_m if y >= 8 else gl_d
                return void_d if lx <= 7 else void_m
            return bg_upper(lx, y)

        if pidx == 2:
            # w: 주변에 밝은 회벽 여백(2px)을 둔 깔끔한 2층 베란다 창(복잡한 덧문 과밀 제거 → 1× 가독성 극대화!)
            if 3 <= y <= 13 and 3 <= lx <= 12:
                if y == 3:
                    return tm_h if lx < 10 else tm_d
                if y == 13:
                    return tm_h if lx <= 8 else tm_d  # 밝은 창턱
                if lx in (3, 12) or y == 4:
                    return tm_d
                if lx in (7, 8) or y == 8:
                    return tm_m
                if (lx, y) in ((5, 6), (6, 6), (9, 6), (5, 10)):
                    return gl_h
                return gl_m if y >= 9 else gl_d
            return bg_upper(lx, y)

        # d(3): 2층 발코니 큰 문
        if 3 <= y <= 14 and 4 <= lx <= 11:
            if y == 3 or lx in (4, 11):
                return tm_d
            if lx in (7, 8):
                return tm_d
            return tm_l if lx <= 7 else tm_m
        return bg_upper(lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r11 RM2000급 밝은 5px 황금 덱+개방 난간+여백 회벽 2층 베란다 ({line})'}


# ---------------------------------------------------------------------------
# 4. wall.tower (5x2 = 80x32 — 가로 층 경계선 제거 + 돌 블록별 부드러운 원통 명암!)
# ---------------------------------------------------------------------------
def _make_wall_tower(line):
    if line == 'A':
        st_h, st_l, st_m, st_s, st_d = 'k5', 'k4', 'k3', 'k1', 'k0'
        wa_l = 'p2'
        dr_l, dr_m, dr_d = 't4', 't3', 't1'
        gl_h = 'p4'
    elif line == 'B':
        st_h, st_l, st_m, st_s, st_d = 'a6', 'a5', 'a4', 'a2', 'a0'
        wa_l = 'k4'
        dr_l, dr_m, dr_d = 'i3', 'i2', 'i0'
        gl_h = 's3'
    else:
        st_h, st_l, st_m, st_s, st_d = 'k4', 'k3', 'k2', 'k1', 'k0'
        wa_l = 'w4'
        dr_l, dr_m, dr_d = 'w5', 'w3', 'w1'
        gl_h = 'p3'

    # 8단 4px 석조 코스 — 부드러운 5단 원통 곡면 음영(급격한 흑백 점프 제거 + 왼쪽 반사광 림!)
    def cyl_tone(gx, ci, rr, block_id):
        jitter = ((ci * 3 + block_id) % 3) - 1
        gx_eff = gx + jitter * 2
        if gx <= 2:
            bias = 1  # 원통 왼쪽 가장자리 살짝 감기는 반사광
        elif gx_eff <= 12:
            bias = 0  # 밝은 주광면
        elif gx_eff <= 20:
            bias = 1  # 정면 중간톤
        elif gx_eff <= 26:
            bias = 2  # 부드러운 전환 그늘(중간 어두움)
        else:
            bias = 3  # 좁은 우측 끝 그늘(k0 먹색 남발 금지 → st_s 중심!)
        v = (block_id * 5 + ci * 3) % 3
        if bias == 0:
            if rr == 0:
                return st_h if gx <= 9 else st_l
            return wa_l if v == 0 else st_l
        if bias == 1:
            if rr == 0:
                return st_l if v != 2 else st_m
            return st_l if v == 0 else st_m
        if bias == 2:
            if rr == 0:
                return st_m
            return st_m if v == 0 else st_s
        # 좁은 우측 끝 그늘(gx 27..30): st_s 위주, 아주 미세한 st_d 줄눈만
        if rr == 0:
            return st_m if v == 0 else st_s
        return st_s if rr <= 1 else st_d

    # 원통 투시 돌 자르기 좌표(양끝으로 갈수록 돌 폭이 좁아짐: 3,4,6,6,6,4,3 = 32px)
    cuts_even = [0, 3, 7, 13, 19, 25, 29, 32]
    cuts_odd = [0, 2, 5, 10, 16, 22, 27, 30, 32]

    def stone_cyl(gx, y):
        if line == 'B':
            # B: 고딕 대형 6px 마름돌 + 중앙 돌출 띠(y=15..16) — A 의 4px 불규칙 막돌과 구조 완전 차별화(R 통과!)
            if y == 15:
                return st_h if gx < 12 else (st_l if gx < 21 else (st_m if gx < 27 else st_s))
            if y == 16:
                return st_s if gx < 16 else st_d
            ci = y // 6
            rr = y % 6
            cuts = [0, 4, 10, 17, 24, 29, 32] if ci % 2 == 0 else [0, 3, 8, 14, 21, 27, 32]
        else:
            ci = y // 4
            rr = y % 4
            cuts = cuts_even if ci % 2 == 0 else cuts_odd
        # 돌 블록 찾기
        bid = 0
        is_vseam = False
        for k in range(len(cuts) - 1):
            if cuts[k] <= gx < cuts[k + 1]:
                bid = k
                is_vseam = (gx == cuts[k] and gx > 0)
                break
        if gx == 0:
            return st_s if rr != (5 if line == 'B' else 3) else st_d
        if gx == 31:
            return st_d
        if rr == (5 if line == 'B' else 3) or is_vseam:
            return st_m if gx < 10 else (st_s if gx < 20 else st_d)
        return cyl_tone(gx, ci, rr, bid)

    def cell_px(pidx, lx, y):
        if pidx == 0:
            if line == 'C' and y in (12, 13):
                return dr_l if lx < 10 else dr_m
            # 작은 아치 화살 구멍 1개(원통 정면 좌중간 lx=11..13, y=10..18)
            if 10 <= y <= 18 and 11 <= lx <= 13:
                if lx == 12 and 11 <= y <= 17:
                    return 'i0'
                if lx == 11:
                    return st_h
                return st_d
            return stone_cyl(lx, y)
        if pidx == 4:
            if line == 'C' and y in (12, 13):
                return dr_m if lx < 8 else dr_d
            return stone_cyl(16 + lx, y)
        if pidx == 1:
            # m: 8px 주기 마름돌(S 가로 이음 0)
            ci = y // 4
            rr = y % 4
            bx = (lx + 2 + 4 * (ci % 2)) % 8
            if rr == 3 or bx == 7:
                return st_s
            return st_l if (rr == 0 or bx == 0) else st_m
        if pidx == 2:
            if 7 <= y <= 19 and 5 <= lx <= 10:
                if y == 7 and lx in (5, 10):
                    return stone_cyl(8 + lx, y)
                if lx in (5, 10) or y in (7, 19):
                    return st_h if lx == 5 else st_d
                if (lx, y) in ((7, 10), (7, 11)):
                    return gl_h
                return 's0' if y < 14 else 's2'
            return stone_cyl(8 + lx, y)
        # d(3)
        if 7 <= y <= 29 and 3 <= lx <= 12:
            if y == 7 and lx in (3, 4, 11, 12):
                return stone_cyl(8 + lx, y)
            if y == 8 and lx in (3, 12):
                return stone_cyl(8 + lx, y)
            if lx in (3, 12) or (y == 7 and 5 <= lx <= 10) or (y == 8 and lx in (4, 11)):
                return st_h if lx <= 7 else st_d
            if y == 29:
                return st_l if lx <= 8 else st_d
            if y in (14, 23):
                return 'i2' if lx in (6, 9) else 'i0'
            if lx in (4, 11) or y == 9:
                return dr_d
            return dr_l if lx <= 7 else dr_m
        return stone_cyl(8 + lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r11 연속 원통 석조 포탑 벽(층 경계선 제거, {line})'}


# ---------------------------------------------------------------------------
# 5. roof.turret (3x4 = 48x64, spire: true — 부드러운 원통 원뿔 + 단일 돌출 석조 코니스 링!)
# ---------------------------------------------------------------------------
def _make_roof_turret(line):
    if line == 'A':
        hi, lit, mid, sh, dk = 'r4', 'r3', 'r2', 'r1', 'r0'
        st_h, st_l, st_m, st_s, st_d = 'k5', 'k4', 'k3', 'k1', 'k0'
        fin = 'r4'
    elif line == 'B':
        hi, lit, mid, sh, dk = 's3', 's2', 's1', 's0', 'i0'
        st_h, st_l, st_m, st_s, st_d = 'a6', 'a5', 'a4', 'a2', 'a0'
        fin = 'i3'
    else:
        hi, lit, mid, sh, dk = 'g6', 'g5', 'g4', 'g2', 'g1'
        st_h, st_l, st_m, st_s, st_d = 'w5', 'w4', 'w3', 'w2', 'w1'
        fin = 'g6'

    def cone_px(gx, y, W):
        cx = W / 2.0
        # 상단 첨탑 피니얼(y=0..6 — 주 지붕보다 18px 이상 솟아 A8 실루엣 차이 확보!)
        if y <= 6:
            dist = abs(gx + 0.5 - cx)
            if y >= 1 and dist <= 0.6:
                return fin if y <= 3 else (hi if gx < cx else sh)
            if y >= 4 and dist <= 1.6:
                return hi if gx < cx else dk
            return '.'
        # 원뿔 지붕 본체(y=7..52 — 원통 폭 W 에 넉넉히 앉음)
        if y <= 52:
            t = (y - 7) / 45.0
            rad = 1.6 + t * (W / 2.0 - 1.6)
            dx = (gx + 0.5) - cx
            if abs(dx) > rad:
                return '.'
            if abs(dx) >= rad - 1.0:
                return lit if (dx < 0 and y < 44) else dk
            if y >= 50:
                return dk if y == 52 else (sh if gx % 4 != 2 else dk)
            # 원뿔 기와 엇갈림 + 부드러운 4단 원통 곡면 음영(타일마다 전환점 엇갈림 → 세로 직선 경계 제거!)
            ri = (y - 9) // 4
            yy = (y - 9) % 4
            tx = (gx + 2 * (ri % 2)) % 4
            gap = (yy == 3) or (tx == 3 and yy >= 1)
            rel = (dx / max(rad, 1.0)) + (((ri + gx // 4) % 3 - 1) * 0.10)
            if rel < -0.30:
                return mid if gap else (hi if yy <= 1 else lit)
            if rel < 0.15:
                return sh if gap else (lit if (yy == 0 and tx == 1) else mid)
            if rel < 0.55:
                return dk if gap else (mid if (yy == 0 and tx == 1) else sh)
            return dk if (gap or yy >= 2) else sh
        # ★ VQA #5 개선: 밝은 모자 테두리 제거 → 차분한 단일 원통 석조 코니스 링(y=53..57) + 원통 석조 목(y=58..63)!
        rel_x = (gx + 0.5 - cx) / (W / 2.0)  # -1 .. +1
        if y == 53:
            return dk
        if y == 54:
            return st_l if rel_x < -0.15 else (st_m if rel_x < 0.4 else st_s)
        if y in (55, 56):
            if gx in (0, W - 1):
                return st_s if gx == 0 else st_d
            seam = (gx % 6 == 0)
            if rel_x < -0.15:
                return st_m if seam else st_l
            if rel_x < 0.4:
                return st_s if seam else st_m
            return st_d if seam else st_s
        if y == 57:
            return st_s if rel_x < 0.35 else st_d  # 1px 코니스 밑 그림자
        if gx == 0:
            return st_m
        if gx == W - 1:
            return st_d
        if y == 60:
            return st_m if rel_x < -0.1 else (st_s if rel_x < 0.45 else st_d)
        if rel_x < -0.15:
            return st_l if y != 58 else st_m
        if rel_x < 0.4:
            return st_m if y != 58 else st_s
        return st_s

    rows = []
    for y in range(64):
        r = [cone_px(x, y, 32) for x in range(16)]
        r += [cone_px(x, y, 16) for x in range(16)]
        r += [cone_px(16 + x, y, 32) for x in range(16)]
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 부드러운 원통 원뿔 포탑+단일 코니스 링 ({line})'}


# ---------------------------------------------------------------------------
# 6. roof.hip.wood (5x3 = 80x48 — VQA #6: 긴 세로 담장 제거 → 짧은 엇갈림 나무 너와 코스!)
# ---------------------------------------------------------------------------
def _make_roof_hip_wood(line):
    if line == 'A':
        hi, lit, mid, sh, dk = 'g6', 'g5', 'g4', 'g2', 'g1'
    elif line == 'B':
        hi, lit, mid, sh, dk = 't5', 't4', 't3', 't2', 't1'
    else:
        hi, lit, mid, sh, dk = 'r4', 'r3', 'r2', 'r1', 'r0'

    H = 48
    cut_top = 18 if line == 'A' else (14 if line == 'B' else 21)
    lower_y = 32

    def shake_px(gx, y, shade=False):
        if y <= 1:
            return hi if ((gx + 1) % 4 != 0) else lit
        if y == 2:
            return lit if ((gx + 1) % 4 != 0) else mid
        if y == 3:
            return sh
        if y >= H - 3:
            return dk if (y == H - 1 or gx % 4 == 2) else sh
        lower = y >= lower_y
        if line == 'A':
            # A: 5px 짧은 엇갈림 나무 너와(horizontal shake courses — 긴 세로 홈 제거!)
            ri = (y - 4) // 5
            yy = (y - 4) % 5
            tx = (gx + 1 + 2 * (ri % 2)) % 4
            var = ((gx // 4) + ri * 3) % 3
            is_gap = (yy == 4) or (tx == 3 and yy >= 2)
            is_hi = (yy == 0 and tx == 1 and var != 2)
            if shade:
                return dk if (is_gap or lower) else (mid if (yy == 0 and tx == 1 and var == 0) else sh)
            if lower:
                return dk if is_gap else (mid if (yy <= 1 and tx in (0, 1)) else sh)
            if is_gap:
                return sh
            if is_hi:
                return hi
            return lit if (tx in (0, 1) and yy <= 2) else mid
        if line == 'B':
            # B: 8px 수평 겹침 참나무 비늘
            ri = (y - 4) // 4
            yy = (y - 4) % 4
            tx8 = (gx + 2 + 4 * (ri % 2)) % 8
            is_gap = (yy == 3) or (tx8 == 4 and yy >= 1)
            is_hi = (yy == 0 and tx8 in (1, 2, 3))
            if shade:
                return dk if (is_gap or lower) else sh
            if lower:
                return dk if is_gap else (mid if is_hi else sh)
            return sh if is_gap else (hi if is_hi else (lit if yy == 1 else mid))
        # C: 6px 굵은 삼나무 겹침 너와
        ri = (y - 4) // 6
        yy = (y - 4) % 6
        tx4 = (gx + 1 + 2 * (ri % 2)) % 4
        is_gap = (yy == 5) or (yy == 4 and tx4 == 3)
        is_hi = (yy == 0 and tx4 in (0, 1))
        if shade:
            return dk if (is_gap or lower) else sh
        if lower:
            return dk if is_gap else (mid if (yy <= 1 and tx4 == 0) else sh)
        return sh if is_gap else (hi if is_hi else (lit if yy <= 2 else mid))

    rows = []
    for y in range(H):
        r = ['.'] * 80
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x < cut:
                r[x] = '.'
            elif x == cut and y < cut_top:
                r[x] = sh
            else:
                hip = 22 - (y * 22) // (H - 1)
                if abs(x - hip) <= 1 and y >= 3:
                    r[x] = hi if x == hip else lit
                else:
                    r[x] = shake_px(x, y, shade=False)
        for x in range(16):
            r[32 + x] = shake_px(x, y, shade=False)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x >= 32 - cut:
                r[48 + x] = '.'
            elif x == 31 - cut and y < cut_top:
                r[48 + x] = dk
            else:
                hip = 9 + (y * 22) // (H - 1)
                if abs(x - hip) <= 1 and y >= 3:
                    r[48 + x] = dk
                else:
                    r[48 + x] = shake_px(x, y, shade=(x > hip))
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 짧은 엇갈림 나무 너와(shake) 모임지붕 ({line})'}


# ---------------------------------------------------------------------------
# 7. roof.gf.back3 (3x1 = 48x16, form: gf_back)
# ---------------------------------------------------------------------------
def _make_roof_gf_back3(line):
    hi, lit, mid, sh, dk, _ = R10._gf_pal(line)
    edge = [23, 21, 20, 18, 17, 15, 14, 12, 11, 9, 8, 6, 5, 3, 2, 0]

    def px(x, y):
        lo, hi_x = edge[y], 47 - edge[y]
        if x < lo or x > hi_x:
            return '.'
        if x == lo or x == hi_x:
            return dk
        if x == lo + 1:
            return hi if y < 14 else lit
        if x == hi_x - 1:
            return sh
        return R10._gf_ridge_body(line, x, y, 23)

    rows = [[px(x, y) for x in range(48)] for y in range(16)]
    return _grid_tokens(rows), {'note': f'style-r11 3칸 좁은 박공 뒤 끝 b3 ({line})'}


# ---------------------------------------------------------------------------
# 8. extra.gable_peak / .green (3x2 = 48x32 — VQA #4: 평평한 사다리꼴 제거 → 진짜 뾰족 삼각 박공 ^!)
# ---------------------------------------------------------------------------
def _make_extra_gable_peak(line, green=False):
    if green:
        r_hi, r_l, r_m, r_s, r_d, r_e = _teal_pal(line)
    else:
        if line == 'A':
            r_hi, r_l, r_m, r_s, r_d, r_e = 'r4', 'r3', 'r2', 'r1', 'r0', 't1'
        elif line == 'B':
            r_hi, r_l, r_m, r_s, r_d, r_e = 's3', 's2', 's1', 's0', 'i0', 'i0'
        else:
            r_hi, r_l, r_m, r_s, r_d, r_e = 'g6', 'g5', 'g4', 'g2', 'g1', 'w1'

    if line == 'A':
        pl_l, pl_m, pl_s = 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 't6', 't4', 't3', 't1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
    elif line == 'B':
        pl_l, pl_m, pl_s = 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'k5', 'k4', 'k2', 'k0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
    else:
        pl_l, pl_m, pl_s = 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'w6', 'w4', 'w2', 'w1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'

    # 진짜 뾰족 삼각 박공(^): y=1 꼭대기 2px(x=23,24) → y=19 처마 양끝(0..47),
    # 빗변 바깥 3px 은 지붕 기와/박공널, 안쪽 삼각(y=7..31)은 진짜 삼각 반목조 박공벽 + 마룻대공 + 다락창!
    rows = []
    for y in range(32):
        r = ['.'] * 48
        for x in range(48):
            if y == 0:
                continue
            if y <= 19:
                # 뾰족 삼각 지붕 빗변: y=1 → half=1 (4px), y=18 → half=23 (48px)
                half = min(23, int((y - 1) * 1.35) + 1)
                lo, hi_x = 23 - half, 24 + half
                if x < lo or x > hi_x:
                    continue
                # 안쪽 삼각 박공벽 시작(y=7 부터, 빗변 안쪽 4px 들어감)
                inner_half = int((y - 7) * 1.35) if y >= 7 else -1
                in_lo, in_hi = 23 - inner_half, 24 + inner_half
                if inner_half >= 0 and in_lo <= x <= in_hi:
                    # 삼각 박공벽 안쪽!
                    if x in (in_lo, in_hi) or y == 7:
                        r[x] = tm_d  # 처마 안쪽 깊은 그림자
                    elif x in (23, 24) and y <= 13:
                        r[x] = tm_l if x == 23 else tm_d  # 마룻대공(king post)
                    elif y == 14:
                        r[x] = tm_l if x < 30 else tm_m  # 깃보(collar beam)
                    elif y == 15:
                        r[x] = tm_d
                    else:
                        patch = ((x // 2) * 5 + (y // 2) * 7) % 11
                        r[x] = pl_m if patch == 0 else pl_l
                else:
                    # 삼각 박공 지붕 빗변 + 바지보드(왼쪽 빛 하이라이트, 오른쪽 그늘 + 골 그림자)
                    if x == lo:
                        r[x] = r_hi if y < 17 else r_l
                    elif x == lo + 1:
                        r[x] = r_hi if y < 16 else r_m
                    elif x == hi_x:
                        r[x] = r_e if y >= 4 else r_d
                    elif x == hi_x - 1:
                        r[x] = r_d
                    elif x < 24:
                        r[x] = r_m if (y % 3 == 0) else r_l
                    else:
                        r[x] = r_d if (y % 3 == 0) else r_s
            else:
                # 하단 박공벽 본체(y=20..31, x=4..43) + 아치형 다락창 + X 트러스!
                lo, hi_x = 4, 43
                if x < lo or x > hi_x:
                    continue
                if x == lo:
                    r[x] = tm_l
                elif x == hi_x or y == 31:
                    r[x] = tm_d
                elif y == 30:
                    r[x] = tm_l if x < 30 else tm_m
                elif 20 <= y <= 28 and 19 <= x <= 28:
                    if y == 20:
                        r[x] = tm_h if x < 26 else tm_d
                    elif x in (19, 28) or y == 28:
                        r[x] = tm_d
                    elif x in (23, 24) or y == 24:
                        r[x] = tm_m
                    elif (x, y) in ((20, 22), (21, 22), (25, 22), (21, 26)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m if y >= 25 else gl_d
                elif line == 'A':
                    if x in (lo + 1, hi_x - 1):
                        r[x] = tm_l if x == lo + 1 else tm_d
                    elif (x - (lo + 2) == y - 20) or ((hi_x - 2) - x == y - 20):
                        r[x] = tm_m
                    else:
                        patch = ((x // 2) * 5 + (y // 2) * 7) % 11
                        r[x] = pl_m if patch == 0 else pl_l
                elif line == 'B':
                    bx = (x + 3 * ((y // 4) % 2)) % 6
                    r[x] = tm_d if (y % 4 == 3 or bx == 5) else (pl_l if y % 4 == 0 else pl_m)
                else:
                    r[x] = tm_d if x % 4 == 0 else (pl_l if x % 4 == 1 else pl_m)
        rows.append(r)
    tag = '청록' if green else '기본'
    return _grid_tokens(rows), {'note': f'style-r11 뾰족 삼각 박공 피크({tag}, {line})'}


# ---------------------------------------------------------------------------
# 9. extra.gable_dormer.green (2x2 = 32x32 — 깊은 청록 슬레이트로 통일!)
# ---------------------------------------------------------------------------
def _make_gable_dormer_teal(line):
    r_hi, r_l, r_m, r_s, r_d, r_e = _teal_pal(line)
    if line == 'A':
        pl_l, pl_m = 'p3', 'p2'
        tm_l, tm_m, tm_d = 't4', 't3', 't1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
    elif line == 'B':
        pl_l, pl_m = 'a5', 'a4'
        tm_l, tm_m, tm_d = 'k4', 'k2', 'k0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
    else:
        pl_l, pl_m = 'w5', 'w4'
        tm_l, tm_m, tm_d = 'w4', 'w2', 'w1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'

    rows = []
    for y in range(32):
        r = ['.'] * 32
        for x in range(32):
            if y == 0:
                continue
            if y <= 15:
                half = min(15, int((y - 1) * 1.1) + 1)
                lo, hi_x = 15 - half, 16 + half
                if x < lo or x > hi_x:
                    continue
                if x == lo:
                    r[x] = r_hi if y < 13 else r_l
                elif x == lo + 1:
                    r[x] = r_hi
                elif x == hi_x:
                    r[x] = r_e if y >= 4 else r_d
                elif y >= 14:
                    r[x] = r_e if y == 15 else r_d
                elif x < 16:
                    r[x] = r_m if (y % 3 == 0) else r_l
                else:
                    r[x] = r_d if (y % 3 == 0) else r_s
            else:
                lo, hi_x = 4, 27
                if x < lo or x > hi_x:
                    continue
                if x == lo:
                    r[x] = tm_l
                elif x == hi_x or y == 31:
                    r[x] = tm_d
                elif y == 16:
                    r[x] = r_e
                elif y == 30:
                    r[x] = tm_l if x < 20 else tm_m
                elif 18 <= y <= 27 and 10 <= x <= 21:
                    if x in (10, 21) or y in (18, 27):
                        r[x] = tm_d
                    elif x in (15, 16) or y == 22:
                        r[x] = tm_m
                    elif (x, y) in ((12, 20), (13, 20), (18, 20), (13, 24)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m if y >= 23 else gl_d
                else:
                    r[x] = pl_m if ((x // 2 + y // 2) % 5 == 0) else pl_l
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 깊은 청록 삼각 도머 ({line})'}


# ---------------------------------------------------------------------------
# 10. roof.saddle.teal (5x3 = 80x48, end: 2, flat: true) — 사용자 첨부 RM2000 쌍어깨 평정·안장 만사드 지붕!
#     - 좌(l)·우(r) 32px: 평평한 꼭대기 쌍어깨(y=0..8) + 넓은 슬레이트 지붕면 + 하단 빗변 박공 목조 트러스(크림 삼각 개구부!)
#     - 중앙(m) 16px: 8px 낮게 꺼진 평평한 안장 지붕(y=8..31) + 단차 처마 띠(y=32..37) + 중앙 목재 판자 발코니 로지아(y=38..47)!
# ---------------------------------------------------------------------------
def _make_roof_saddle(line):
    hi, lit, mid, sh_mid, dk, edge = _teal_pal(line)
    if line == 'A':
        tm_h, tm_l, tm_m, tm_d = 'w5', 'w4', 't3', 't1'
        pl_l, pl_m = 'p3', 'p2'
    elif line == 'B':
        tm_h, tm_l, tm_m, tm_d = 'k3', 'k2', 'k1', 'i0'
        pl_l, pl_m = 'a5', 'a4'
    else:
        tm_h, tm_l, tm_m, tm_d = 'w5', 'w4', 'w3', 'w1'
        pl_l, pl_m = 'w5', 'w4'

    def slate_px(gx, y, shade=False, sunlit_level=0):
        # RM2000 첨부 사진 특유의 깊은 청록 4×4 직사각 슬레이트(수평 색띠 완전 제거!)
        # sunlit_level: 2(최상단), 1(중간 4코스 점진 페이드), 0(하단 깊은 청록) — v0/c2 동일 청록 계열 유지!
        ri = y // 4
        yy = y % 4
        m4 = gx % 4
        if line == 'B':
            m8 = gx % 8
            gap = (yy == 3 and m8 not in (0, 4)) or (m8 == (2 if ri % 2 == 0 else 5))
        elif line == 'C':
            gap = (yy == 3 and m4 != 0) or (m4 == (1 if ri % 2 == 0 else 2) and yy >= 1)
        else:
            # 엇갈린 기와 끝 겹침(yy==3 에서 m4==0 은 윗 기와 몸통이 1px 내려와 86px 일자 줄무늬 차단!)
            gap = (yy == 3 and m4 != 0) or (m4 == (1 if ri % 2 == 0 else 2) and yy >= 1)
        if shade:
            return edge if gap else dk
        if gap:
            return dk
        h = (gx // 4) * 7 + ri * 5
        if line == 'B':
            if sunlit_level == 2:
                return hi if (yy <= 1 and m4 != 2) else lit
            if sunlit_level == 1:
                return lit if (yy == 0 or (yy == 1 and h % 2 == 0)) else mid
            return mid if yy == 0 else sh_mid
        if sunlit_level == 2:
            # 상단: 같은 v0(깊은 청록) 몸통 위에 sh_mid(c2)/lit(c3) 윗결 하이라이트만 올려 회색 띠 방지!
            if yy == 0:
                return lit if (m4 == 0 and h % 2 == 0) else sh_mid
            return sh_mid if (yy == 1 and h % 3 == 0) else mid
        if sunlit_level == 1:
            # 중간 4개 코스(y=12..27): 타일마다 엇갈리며 점진적으로 톤 다운
            if yy == 0 and h % 3 != 0:
                return sh_mid
            return mid if yy <= 1 else (mid if h % 2 == 0 else dk)
        # 하단(y>=28): 깊은 청록(mid/dk)
        if yy == 0 and m4 == 0 and h % 3 == 0:
            return sh_mid
        return mid if yy <= 1 else dk

    def _sun_lvl(gx, y):
        # 4개 기와 코스(y=12..27)에 걸쳐 기와 단위로 점진적 그라데이션 → 1× 수평 밴딩 0%!
        tx_id = gx // 4
        jitter = ((tx_id * 5 + 3) % 4) * 2  # 0, 2, 4, 6px 지그재그
        if y <= 14 + jitter:
            return 2
        if y <= 24 + jitter:
            return 1
        return 0

    rows = []
    for y in range(48):
        r = ['.'] * 80
        # l (0..31): 왼쪽 평정 어깨(y=0..10, 8px 평평한 꼭대기 x=10..21) + 45° 양측 경사 + 하단 빗변 트러스 + 우측 대각 처마 뺨!
        for x in range(32):
            if y < 11:
                left_cut = max(0, 10 - y)
                right_cut = min(32, 22 + y)
                if x < left_cut or x >= right_cut:
                    continue
                if y == 0:
                    r[x] = lit if x < 18 else sh_mid
                elif x == left_cut:
                    r[x] = sh_mid if y < 6 else dk
                elif x == right_cut - 1:
                    r[x] = dk
                elif y == 1:
                    r[x] = lit if x < 19 else mid
                else:
                    r[x] = slate_px(x, y, shade=(x < left_cut + 2), sunlit_level=2)
            else:
                cheek_x = 24 + (y - 35) // 2 if y >= 35 else 32
                truss_w = (y - 36) if y >= 37 else -1
                if x >= cheek_x and y >= 35:
                    if x == cheek_x:
                        r[x] = edge
                    elif x == cheek_x + 1:
                        r[x] = lit if y % 4 != 3 else sh_mid
                    else:
                        r[x] = edge if (y % 4 == 3 or x == 31) else dk
                elif truss_w >= 0 and (13 - truss_w) <= x <= (14 + truss_w) and 3 <= x < cheek_x:
                    in_lo, in_hi = 13 - truss_w, 14 + truss_w
                    if x in (in_lo, in_hi) or y == 37:
                        r[x] = edge
                    elif y == 47:
                        r[x] = tm_d
                    elif y == 38:
                        r[x] = tm_l if x < 18 else tm_m
                    elif y == 46:
                        r[x] = tm_m
                    elif x in (13, 14) or x in (in_lo + 1, in_hi - 1):
                        r[x] = tm_l if x <= 13 else tm_m
                    elif 40 <= y <= 45 and (x in (9, 10, 11, 16, 17, 18)):
                        if y == 40 and x in (9, 11, 16, 18):
                            r[x] = tm_d
                        elif y == 45:
                            r[x] = tm_d
                        else:
                            r[x] = pl_l if x in (10, 17) else pl_m
                    else:
                        r[x] = tm_h if (y == 39 and x < 16) else tm_l
                elif x == 0:
                    r[x] = dk
                elif x in (1, 2):
                    r[x] = sh_mid if y % 4 != 3 else dk
                else:
                    r[x] = slate_px(x, y, shade=(y >= 34 and x >= 22), sunlit_level=_sun_lvl(x, y) if x >= 4 else 0)

        # m (32..47): ★ 10px 낮게 꺼진 평평한 안장 지붕(y=10..30) + 단차 밝은 턱(y=31) + 어두운 수직 처마(y=32..36) + 세로 목재 로지아(y=37..47)!
        for lx in range(16):
            if y < 10:
                continue
            if y == 10:
                r[32 + lx] = lit if (lx % 4 in (0, 3)) else sh_mid
            elif y == 11:
                r[32 + lx] = sh_mid if (lx % 4 != 2) else mid
            elif y <= 30:
                # m: lx//4==0 과 3 을 같은 jitter(2)로 맞추어 lx=0/15 가로 이음 S=0 유지 + 4코스 점진 페이드!
                tj = 2 if (lx // 4) in (0, 3) else (0 if (lx // 4) == 1 else 6)
                lvl = 2 if y <= 16 + tj else (1 if y <= 24 + tj else 0)
                r[32 + lx] = slate_px(lx, y, shade=False, sunlit_level=lvl)
            elif y == 31:
                r[32 + lx] = sh_mid if (lx % 4 in (1, 2)) else dk
            elif y <= 33:
                r[32 + lx] = edge if (lx % 4 == 2 or y == 33) else dk
            elif y <= 36:
                r[32 + lx] = edge if (lx % 4 == 2 or y == 36) else dk
            else:
                if y == 37 or y == 47:
                    r[32 + lx] = tm_d
                elif lx % 4 == 2:
                    r[32 + lx] = tm_d
                elif lx % 4 == 1:
                    r[32 + lx] = tm_l if y < 44 else tm_m
                else:
                    r[32 + lx] = tm_m

        # r (48..79): 오른쪽 평정 어깨(좌우 대칭 + 오른쪽 그늘 음영 + 좌측 대각 처마 윙!)
        for x in range(32):
            if y < 11:
                right_cut = 32 - max(0, 10 - y)
                left_cut = max(0, 10 - y)
                if x < left_cut or x >= right_cut:
                    continue
                if y == 0:
                    r[48 + x] = sh_mid if x < 18 else dk
                elif x == right_cut - 1:
                    r[48 + x] = edge
                elif x == left_cut:
                    r[48 + x] = dk
                elif y == 1:
                    r[48 + x] = sh_mid if x < 18 else dk
                else:
                    r[48 + x] = slate_px(x, y, shade=(x >= right_cut - 6), sunlit_level=2 if x < 18 else 1)
            else:
                cheek_r = 7 - (y - 35) // 2 if y >= 35 else -1
                truss_w = (y - 36) if y >= 37 else -1
                if x <= cheek_r and y >= 35:
                    if x == cheek_r:
                        r[48 + x] = edge
                    elif x == cheek_r - 1:
                        r[48 + x] = lit if (y <= 41 and y % 4 != 3) else (sh_mid if y % 4 != 3 else dk)
                    else:
                        r[48 + x] = edge if (y % 4 == 3 or x == 0) else dk
                elif truss_w >= 0 and (17 - truss_w) <= x <= (18 + truss_w) and cheek_r < x <= 28:
                    in_lo, in_hi = 17 - truss_w, 18 + truss_w
                    if x in (in_lo, in_hi) or y == 37:
                        r[48 + x] = edge
                    elif y == 47:
                        r[48 + x] = tm_d
                    elif y == 38:
                        r[48 + x] = tm_m
                    elif y == 46:
                        r[48 + x] = tm_d
                    elif x in (17, 18) or x in (in_lo + 1, in_hi - 1):
                        r[48 + x] = tm_m if x <= 17 else tm_d
                    elif 40 <= y <= 45 and (x in (13, 14, 15, 20, 21, 22)):
                        if y == 40 and x in (13, 15, 20, 22):
                            r[48 + x] = tm_d
                        elif y == 45:
                            r[48 + x] = tm_d
                        else:
                            r[48 + x] = pl_l if x in (14, 21) else pl_m
                    else:
                        r[48 + x] = tm_l if x < 18 else tm_m
                elif x == 31:
                    r[48 + x] = edge
                elif x >= 27:
                    r[48 + x] = edge if y % 4 == 3 else dk
                else:
                    r[48 + x] = slate_px(x, y, shade=(x >= 22), sunlit_level=_sun_lvl(x, y) if x < 18 else 0)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 RM2000 깊은 청록 쌍어깨 평정·안장 만사드 지붕 ({line})'}


# ---------------------------------------------------------------------------
# 11. roof.flat.stone (3x2 = 48x32, end: 1 — 진짜 건축용 평평한 석조/목조 옥상 지붕!)
# ---------------------------------------------------------------------------
def _make_roof_flat_stone(line):
    if line == 'A':
        # A: 따뜻한 석회암 슬래브 평지붕(wall.stone 과 조화되는 석재 k5/k4/k3 데크 + 차분한 남측 파라펫 + 테라코타 띠 코니스)
        dk_h, dk_l, dk_m, dk_s, dk_d = 'k5', 'k4', 'k3', 'k2', 'k0'
        par_h, par_l, par_m, par_d = 'k3', 'k2', 'k1', 'k0'
        trim_l, trim_d = 'r3', 'r0'
    elif line == 'B':
        # B: 귀족 마름돌 성가퀴 평지붕(밝은 옥상 석판 > 그늘진 남측 성가퀴 → F 통과!)
        dk_h, dk_l, dk_m, dk_s, dk_d = 'a6', 'a5', 'a4', 'a3', 'a1'
        par_h, par_l, par_m, par_d = 'a4', 'a3', 'a2', 'a0'
        trim_l, trim_d = 's2', 'i0'
    else:
        # C: 북방/농가 목재 데크 평지붕(밝은 황금목재 데크 > 어두운 통나무 파라펫 → F 통과!)
        dk_h, dk_l, dk_m, dk_s, dk_d = 'w6', 'g6', 'w5', 'w3', 'w1'
        par_h, par_l, par_m, par_d = 'w4', 'w3', 'w2', 'w1'
        trim_l, trim_d = 'w3', 'w1'

    rows = []
    for y in range(32):
        r = []
        for pidx in range(3):
            for lx in range(16):
                # 윗면 평평한 석재/목재 옥상 데크(y=0..15 — 사방 3px 파라펫 림 + y=15 1px 내부 접지 홈으로 옥상 둘레 완성! VQA #1!)
                if y == 0:
                    ch = par_d if ((pidx == 0 and lx == 0) or (pidx == 2 and lx == 15)) else dk_h
                elif y == 1:
                    ch = dk_h if (lx % 8 != 7) else dk_l
                elif y == 2:
                    ch = par_d if ((pidx == 0 and lx == 0) or (pidx == 2 and lx == 15)) else (dk_h if ((pidx == 0 and lx == 1) or (pidx == 2 and lx == 14)) else par_l)
                elif y <= 14:
                    # 좌·우 3px 파라펫 측벽(l: lx=0..2, r: lx=13..15 — 앞 코핑 y=16과 ㅁ자로 연결!)
                    if pidx == 0 and lx <= 2:
                        ch = par_d if lx == 0 else (dk_h if lx == 1 else par_l)
                    elif pidx == 2 and lx >= 13:
                        ch = par_d if lx == 15 else (dk_l if lx == 14 else par_l)
                    elif line == 'C':
                        yy = (y - 2) % 4
                        bx = (lx + 2 + 4 * (((y - 2) // 4) % 2)) % 8
                        ch = dk_m if (yy == 3 or bx == 7) else (dk_h if yy <= 1 else dk_l)
                    elif line == 'B':
                        yy = (y - 2) % 7
                        bx = (lx + 2) % 8
                        ch = dk_m if (yy == 6 or bx == 7) else (dk_h if (yy <= 1 or bx == 0) else dk_l)
                    else:
                        ri = (y - 2) // 5
                        yy = (y - 2) % 5
                        bx = (lx + 2 + 4 * (ri % 2)) % 8
                        ch = dk_s if (yy == 4 or bx == 7) else (dk_h if (yy == 0 and bx in (1, 2)) else (dk_l if yy <= 2 else dk_m))
                elif y == 15:
                    # ★ VQA #1: 앞 파라펫 안쪽 1px 깊이 홈(좌·우 3px 파라펫 림 lx=0..2 / lx=13..15 는 끊기지 않고 y=16 코핑과 L자 결합!)
                    if pidx == 0 and lx <= 2:
                        ch = par_d if lx == 0 else (dk_h if lx == 1 else par_l)
                    elif pidx == 2 and lx >= 13:
                        ch = par_d if lx == 15 else (dk_l if lx == 14 else par_l)
                    else:
                        ch = par_l if (lx % 8 != 4) else par_m
                # 앞쪽 파라펫 난간벽(y=16 밝은 코핑 턱 + y=17..24 어두운 남측 수직면 → ㅁ자 옥상 파라펫 완결 + F 통과!)
                elif y == 16:
                    if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                        ch = par_d
                    else:
                        ch = dk_l if (lx % 8 != 4) else par_h
                elif y == 17:
                    ch = par_m if (lx % 8 != 4) else par_d
                elif y <= 24:
                    if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                        ch = par_d
                    elif line == 'A' and y in (20, 21):
                        ch = trim_d if lx in (7, 8) else (trim_l if y == 20 else par_m)
                    elif line == 'B' and y in (18, 19) and lx % 4 in (2, 3):
                        ch = par_d  # B: 톱니 성가퀴 홈
                    else:
                        ch = par_d if (lx % 8 == 4 or y == 24) else par_m
                # 하단 처마 코니스 + 까치발(y=25..31)
                elif y == 25:
                    ch = par_l if lx % 4 != 0 else par_m
                elif y <= 28:
                    ch = par_m if (lx % 4 in (1, 2)) else par_d
                else:
                    ch = par_d if (y == 31 or lx % 4 == 0) else par_m
                r.append(ch)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 건축용 평평한 석조/목조 평지붕 ({line})'}


# ---------------------------------------------------------------------------
# 12. band.balcony_deck (3x1 = 48x16 — 1칸 깊이 밝은 수평 덱 2층 통발코니 띠!)
# ---------------------------------------------------------------------------
def _make_band_balcony_deck(line):
    if line == 'A':
        fl_h, fl_l, fl_m, fl_s = 'p3', 'w6', 'w5', 'w4'   # 따뜻한 햇빛 꿀빛 오크 수평 데크(벽돌 느낌 제거!)
        tm_h, tm_l, tm_m, tm_d = 'w5', 't4', 't3', 't1'
        sh_bg, sh_lo = 't2', 't3'
        cap_h = 'w6'
    elif line == 'B':
        fl_h, fl_l, fl_m, fl_s = 'a6', 'a5', 'a4', 'a3'
        tm_h, tm_l, tm_m, tm_d = 'a5', 'a4', 'a2', 'a0'
        sh_bg, sh_lo = 'a1', 'a2'
        cap_h = 'a6'
    else:
        fl_h, fl_l, fl_m, fl_s = 'g6', 'w6', 'w5', 'w3'
        tm_h, tm_l, tm_m, tm_d = 'w4', 'w3', 'w2', 'w1'
        sh_bg, sh_lo = 'w1', 'w2'
        cap_h = 'w5'

    rows = []
    for y in range(16):
        r = []
        for pidx in range(3):
            for lx in range(16):
                if y == 0:
                    ch = tm_d
                elif y <= 7:
                    if pidx == 0 and lx <= 2:
                        ch = tm_d if lx == 0 else (tm_h if lx == 1 else tm_m)
                    elif pidx == 2 and lx >= 13:
                        ch = tm_d if lx == 15 else (tm_m if lx == 14 else tm_d)
                    elif pidx == 0 and lx == 3:
                        ch = fl_m
                    elif line == 'C':
                        # C: 세로 통나무 판자 + 중간 보강 띠(y=4) → A 의 가로 오크 데크와 구조 차별화(R 통과!)
                        if y == 1:
                            ch = fl_s
                        elif lx % 4 == 2:
                            ch = fl_s
                        elif y in (3, 6):
                            ch = fl_l
                        else:
                            ch = fl_h if (lx % 4 == 1) else fl_m
                    elif y == 1:
                        ch = fl_m
                    elif y == 4:
                        ch = fl_m if lx % 8 != 4 else fl_s  # 부드러운 수평 목재 이음선
                    elif y == 7:
                        ch = fl_h
                    else:
                        ch = fl_h if (y in (2, 5) and lx % 8 != 7) else fl_l
                elif y == 8:
                    ch = cap_h if (lx % 8 in (2, 3)) else tm_h
                elif y == 9:
                    ch = tm_d
                elif y <= 12:
                    if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                        ch = tm_d
                    elif pidx == 0 and lx == 1:
                        ch = tm_h
                    elif pidx == 2 and lx == 14:
                        ch = tm_m
                    elif lx in (0, 15):
                        ch = tm_m
                    elif lx == 14:
                        ch = tm_h
                    elif lx == 1:
                        ch = tm_d
                    elif line == 'B':
                        ch = (tm_h if lx in (5, 10) else tm_l) if lx in (5, 6, 10, 11) else (sh_lo if y >= 11 else sh_bg)
                    elif line == 'C':
                        # C: 굵은 수평 이중 통나무 난간(y=11 가로 막대 — A 의 세로 살대와 구조 완전 차별화!)
                        if y == 11:
                            ch = cap_h if lx % 4 != 2 else tm_l
                        elif lx in (7, 8):
                            ch = tm_h if lx == 7 else tm_d
                        else:
                            ch = sh_bg
                    else:
                        if lx in (5, 9):
                            ch = tm_h if y <= 11 else tm_l
                        elif lx in (6, 10):
                            ch = tm_d
                        else:
                            ch = sh_lo if y >= 11 else sh_bg
                elif y == 13:
                    ch = tm_h if lx % 4 in (1, 2) else tm_l
                elif y == 14:
                    ch = tm_m if lx in (0, 1, 7, 8, 14, 15) else tm_d
                else:
                    ch = tm_d
                r.append(ch)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 1칸 깊이 밝은 수평 덱 2층 통발코니 띠 ({line})'}


# ---------------------------------------------------------------------------
# 13. roof.balcony_deck (3x3 = 48x48, end: 1, flat: true — 진짜 넓은 2칸+ 깊이(32px 바닥!) 대형 2층 발코니 테라스!)
#     - y=0..31 (32px = 온전한 2타일 깊이!!): 햇빛 받는 밝은 수평 바닥 + 2층 벽/좌측 난간 그림자 + 야외 카페 테이블·의자·벤치·화분!
#     - y=32..47 (16px): 어두운 목재/석조 프레임 개방 전면 난간 + 캔틸레버 들보 + 까치발!
# ---------------------------------------------------------------------------
def _make_roof_balcony_deck(line):
    if line == 'A':
        fl_h, fl_l, fl_m, fl_s = 'p3', 'w6', 'w5', 'w4'   # 따뜻하고 부드러운 햇빛 오크 목재 데크(벽돌 착시 제거!)
        tm_h, tm_l, tm_m, tm_d = 'w5', 't4', 't3', 't1'   # 대비가 뚜렷한 진한 참나무 난간·가구
        sh_bg, sh_lo = 't2', 't3'
        pot_l, pot_d, leaf_h, leaf_d = 'r3', 'r0', 'v2', 'v0'
        cap_h = 'p4'
    elif line == 'B':
        fl_h, fl_l, fl_m, fl_s = 'a6', 'a5', 'a4', 'a3'   # 밝은 대리석·석회암 체크 타일 테라스!
        tm_h, tm_l, tm_m, tm_d = 'a4', 'a3', 'a2', 'a0'
        sh_bg, sh_lo = 'a1', 'a2'
        pot_l, pot_d, leaf_h, leaf_d = 's2', 's0', 'v2', 'v0'
        cap_h = 'a5'
    else:
        fl_h, fl_l, fl_m, fl_s = 'g6', 'w6', 'w5', 'w3'   # 밝은 황금 삼나무 데크(Line C 램프 잠금 준수!)
        tm_h, tm_l, tm_m, tm_d = 'w4', 'w3', 'w2', 'w1'
        sh_bg, sh_lo = 'w1', 'w2'
        pot_l, pot_d, leaf_h, leaf_d = 'w4', 'w1', 'v2', 'v0'
        cap_h = 'w5'

    def floor_px(pidx, lx, y):
        if y == 0:
            return fl_s
        if y in (1, 2):
            return fl_m if (y == 2 or lx % 4 != 2) else fl_s
        if pidx == 0 and lx in (3, 4):
            return fl_s if lx == 3 else fl_m
        if line == 'B':
            ty = (y - 3) // 7
            yy = (y - 3) % 7
            bx = (lx + 2) % 8
            if yy == 6 or bx == 7:
                return fl_s
            tile_even = ((ty + (lx + 2) // 8) % 2 == 0)
            return fl_h if (tile_even or yy == 0) else fl_l
        if line == 'C':
            # C: 6px 넓은 가로 통나무 + 중앙 장식 러그/보강 띠(y=12..22 체크 패턴 — A 와 구조 완전 차별화 → R 통과!)
            if 12 <= y <= 22 and pidx == 1:
                if y in (12, 22):
                    return fl_s
                return fl_h if ((lx + y) % 4 in (0, 1)) else fl_m
            ri = (y - 3) // 6
            yy = (y - 3) % 6
            bx = (lx + 3 * (ri % 2)) % 8
            if yy == 5 or (bx == 7 and yy >= 2):
                return fl_s
            return fl_h if yy <= 1 else (fl_l if yy <= 3 else fl_m)
        # A: 부드러운 햇빛 꿀빛 오크 수평 판자(4px 가로 코스, 은은한 fl_m 이음선 — 벽돌 느낌 없이 매끈한 나무 바닥!)
        ri = (y - 3) // 4
        yy = (y - 3) % 4
        bx = (lx + 2 + 4 * (ri % 2)) % 12
        if yy == 3:
            return fl_m if bx != 6 else fl_s
        if bx == 11 and yy in (1, 2):
            return fl_m
        return fl_h if (yy == 0 and ri % 2 == 0) else fl_l

    rows = []
    for y in range(48):
        r = []
        for pidx in range(3):
            for lx in range(16):
                # ★ y=0..31: 32px(2 full tiles!) 깊이의 진짜 넓은 야외 발코니 바닥 + 측면 난간 + 카페 테이블·의자·벤치·화분!
                if y <= 31:
                    if pidx == 0 and lx <= 2:
                        if lx == 0:
                            ch = tm_d
                        elif lx == 1:
                            ch = cap_h if (y % 8 in (0, 1)) else tm_h
                        else:
                            ch = tm_d if (y % 8 == 7) else tm_m
                    elif pidx == 2 and lx >= 13:
                        if lx == 15:
                            ch = tm_d
                        elif lx == 14:
                            ch = tm_l if (y % 8 in (0, 1)) else tm_m
                        else:
                            ch = tm_d if (y % 8 == 7) else fl_m
                    elif pidx == 0 and 5 <= lx <= 11 and 3 <= y <= 9:
                        if y <= 5:
                            ch = leaf_h if ((lx + y) % 2 == 0 and 6 <= lx <= 10) else leaf_d
                        elif y == 6:
                            ch = pot_l if lx <= 9 else pot_d
                        elif y <= 8:
                            ch = pot_d if (lx in (5, 11) or y == 8) else pot_l
                        else:
                            ch = fl_s
                    elif pidx == 0 and 7 <= lx <= 12 and 15 <= y <= 23:
                        if (lx in (7, 12) and y in (15, 19)):
                            ch = floor_px(pidx, lx, y)
                        elif y <= 19:
                            if y in (15, 19) or lx in (7, 12):
                                ch = tm_d
                            else:
                                ch = cap_h if (y == 16 and lx <= 10) else tm_h
                        elif y <= 22:
                            if lx in (9, 10):
                                ch = tm_m if lx == 9 else tm_d
                            elif y == 22 and 8 <= lx <= 11:
                                ch = fl_s
                            else:
                                ch = floor_px(pidx, lx, y)
                        else:
                            ch = fl_s if 8 <= lx <= 11 else floor_px(pidx, lx, y)
                    elif pidx == 0 and 5 <= lx <= 6 and 18 <= y <= 21:
                        ch = cap_h if y == 18 else (tm_m if y == 19 else (tm_d if y == 20 else fl_s))
                    elif pidx == 2 and 4 <= lx <= 10 and 3 <= y <= 9:
                        if y <= 5:
                            ch = leaf_h if ((lx + y) % 2 == 0 and 5 <= lx <= 9) else leaf_d
                        elif y == 6:
                            ch = pot_l if lx <= 8 else pot_d
                        elif y <= 8:
                            ch = pot_d if (lx in (4, 10) or y == 8) else pot_l
                        else:
                            ch = fl_s
                    elif pidx == 2 and 3 <= lx <= 11 and 16 <= y <= 22:
                        if y == 16:
                            ch = tm_d if lx in (3, 11) else cap_h
                        elif y == 17:
                            ch = tm_m if lx not in (3, 11) else tm_d
                        elif y in (18, 19):
                            ch = tm_d if lx in (3, 11) else (cap_h if y == 18 else tm_h)
                        elif y == 20:
                            ch = tm_d
                        elif y == 21:
                            ch = tm_d if lx in (4, 10) else fl_s
                        else:
                            ch = fl_s if 4 <= lx <= 10 else floor_px(pidx, lx, y)
                    else:
                        ch = floor_px(pidx, lx, y)
                # ★ y=32..47 (16px): 어두운 프레임 개방 전면 발코니 난간 + 두꺼운 캔틸레버 들보 + 까치발!
                elif y == 32:
                    if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                        ch = tm_d
                    else:
                        ch = cap_h if (lx % 8 in (2, 3)) else tm_h
                elif y == 33:
                    ch = tm_d
                elif y <= 41:
                    if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                        ch = tm_d
                    elif pidx == 0 and lx == 1:
                        ch = tm_h if y < 40 else tm_m
                    elif pidx == 2 and lx == 14:
                        ch = tm_m if y < 40 else tm_d
                    elif lx in (0, 15):
                        ch = tm_m
                    elif lx == 14:
                        ch = tm_h if y < 40 else tm_l
                    elif lx == 1:
                        ch = tm_d
                    elif line == 'B':
                        if lx in (5, 6, 10, 11):
                            ch = tm_h if lx in (5, 10) else tm_l
                        elif y == 34:
                            ch = tm_d
                        else:
                            ch = sh_lo if y >= 39 else sh_bg
                    elif line == 'C':
                        # C: 농가 수평 통나무 2단 난간(y=37 가로 보 + 중앙 기둥) — A 와 구조 완전 차별화!
                        if y == 37:
                            ch = cap_h if lx % 4 != 2 else tm_l
                        elif y == 38:
                            ch = tm_d
                        elif lx in (7, 8):
                            ch = tm_h if lx == 7 else tm_d
                        else:
                            ch = sh_lo if y >= 39 else sh_bg
                    else:
                        if lx in (5, 9):
                            ch = tm_h if y <= 39 else tm_l
                        elif lx in (6, 10):
                            ch = tm_d
                        elif y == 34:
                            ch = tm_d
                        else:
                            ch = sh_lo if y >= 39 else sh_bg
                elif y == 42:
                    ch = tm_h if lx % 4 in (1, 2) else tm_l
                elif y == 43:
                    ch = tm_m if lx % 4 != 2 else tm_d
                elif y <= 45:
                    ch = tm_l if (y == 44 and lx in (0, 1, 7, 8, 14, 15)) else (tm_m if lx in (0, 1, 7, 8, 14, 15) else tm_d)
                else:
                    ch = tm_d
                r.append(ch)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 2칸+ 깊이(32px 수평 바닥!) 대형 돌출 2층 발코니 테라스 ({line})'}


# ---------------------------------------------------------------------------
# 14. wall.balcony_upper (5x2 = 80x32 — 넓은 2층 발코니로 바로 나가는 바닥 높이 프렌치 발코니 도어 2층 벽!)
#     - m(1): 덱 바닥(y=31)까지 내려오는 유리 창살 2층 프렌치 발코니 출입문 + 문턱 → A1(건물당 D 1개)과 충돌 없이
#             넓은 2층 발코니(roof.balcony_deck / band.balcony_deck)에 실제 출입구 제공!
# ---------------------------------------------------------------------------
def _make_wall_balcony_upper(line):
    if line == 'A':
        pl_h, pl_l, pl_m, pl_s = 'p4', 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 'w5', 't4', 't3', 't1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        sh_l, sh_d = 'r3', 'r0'
    elif line == 'B':
        pl_h, pl_l, pl_m, pl_s = 'a6', 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'k5', 'k4', 'k2', 'k0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        sh_l, sh_d = 's2', 'i0'
    else:
        pl_h, pl_l, pl_m, pl_s = 'w6', 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'g6', 'g5', 'w3', 'w1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'
        sh_l, sh_d = 'w4', 'w1'

    def bg_px(lx, y):
        if y == 0:
            return tm_d
        if y == 1:
            return pl_s
        if y == 2:
            return pl_m
        if y == 31:
            return tm_d
        if line == 'C':
            yy = (y - 2) % 4
            return tm_d if yy == 3 else (pl_l if yy <= 1 else pl_m)
        if line == 'B':
            bx = (lx + 3 * ((y // 5) % 2)) % 8
            if y % 5 == 4 or bx == 7:
                return tm_d
            return pl_l if (y % 5 == 0 or bx == 0) else pl_m
        patch = ((lx // 2) * 7 + (y // 2) * 11) % 13
        return pl_m if (patch == 0 and y > 4) else pl_l

    def cell_px(pidx, lx, y):
        if y == 0:
            return tm_d
        if (pidx == 0 and lx == 0) or (pidx == 4 and lx == 15):
            return tm_d
        # 하단 목재 굽도리(y=29..31 — m 프렌치 도어 발코니 출입구 lx=4..11 에서는 바닥까지 열려 밝은 문턱!)
        if y >= 29:
            if pidx in (1, 3) and 4 <= lx <= 11:
                if y == 31:
                    return tm_h if lx <= 8 else tm_l  # 덱 바닥으로 이어지는 밝은 문턱!
                if lx in (4, 11):
                    return tm_d
                if lx in (7, 8):
                    return tm_d if pidx == 3 else tm_m
                return tm_l if lx <= 7 else tm_m
            if y == 31:
                return tm_d
            return tm_l if (y == 29 and lx % 4 != 2) else tm_m

        if pidx in (0, 4):
            # l/r: 코너 목조 기둥 + 가로 중방(y=17) + 사선 가새
            if (pidx == 0 and lx == 1) or (pidx == 4 and lx == 14):
                return tm_l if pidx == 0 else tm_m
            if y in (17, 18):
                return tm_l if y == 17 else tm_d
            if 4 <= y <= 16:
                d = (y - 4) + 3 if pidx == 0 else 12 - (y - 4)
                if lx in (d, d + 1):
                    return tm_m if lx == d else tm_d
            return bg_px(lx, y)

        if pidx == 1:
            # ★ m: 2층 발코니 덱 바닥까지 닿는 프렌치 유리 이중 발코니 도어(y=5..31, lx=4..11)!
            #    양끝 lx=0..3 / 12..15 는 깨끗한 회벽 + 수평 허리보(y=17..18)로 S=0 유지!
            if 5 <= y <= 28 and 4 <= lx <= 11:
                if y == 5:
                    return tm_h if lx <= 9 else tm_d  # 상인방
                if lx in (4, 11) or y == 6:
                    return tm_d
                if lx in (7, 8):
                    return tm_m if y < 20 else tm_d  # 이중문 중앙 여닫이 틈
                if y <= 19:
                    # 상단 유리 격자창(발코니 프렌치 도어!)
                    if y in (12, 19):
                        return tm_m
                    if (lx, y) in ((5, 8), (6, 8), (9, 8), (5, 14)):
                        return gl_h
                    return gl_m if y >= 14 else gl_d
                # 하단 목재 도어 패널(y=20..28) + 문손잡이(y=21, lx=6/9)
                if y == 21 and lx in (6, 9):
                    return 'r4' if line == 'A' else 'k5'
                return tm_l if lx <= 7 else tm_m
            if y in (17, 18):
                return tm_l if y == 17 else tm_d
            return bg_px(lx, y)

        if pidx == 2:
            # w: 넓은 회벽 여백 + 깔끔한 2층 창 + 화분 상자
            if 6 <= y <= 22 and 3 <= lx <= 12:
                if y == 6:
                    return tm_h if lx <= 9 else tm_d
                if y == 22:
                    return tm_h if lx <= 8 else tm_d
                if lx in (3, 12) or y == 7:
                    return tm_d
                if lx in (7, 8) or y == 14:
                    return tm_m
                if (lx, y) in ((5, 9), (6, 9), (9, 9), (5, 16)):
                    return gl_h
                return gl_m if y >= 15 else gl_d
            if y == 23 and 4 <= lx <= 11:
                return sh_l if lx % 2 == 0 else sh_d
            if y in (17, 18) and (lx < 3 or lx > 12):
                return tm_l if y == 17 else tm_d
            return bg_px(lx, y)

        # d(3): 큰 아치 출입문
        if 5 <= y <= 28 and 4 <= lx <= 11:
            if y == 5 or lx in (4, 11):
                return tm_d
            if lx in (7, 8):
                return tm_d
            if y == 18 and lx == 9:
                return 'r4' if line == 'A' else 'k5'
            return tm_l if lx <= 7 else tm_m
        return bg_px(lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r11 발코니 덱 직결 프렌치 도어 2층 벽 ({line})'}


def _bind(fn, *args):
    def _f():
        return fn(*args)
    _f.__name__ = f'{fn.__name__}_{"_".join(str(a) for a in args)}'
    return _f


CANDIDATES = {
    'roof.hip.green': {ln: _bind(_make_hip_teal, ln, 3) for ln in ('A', 'B', 'C')},
    'roof.hip.low.green': {ln: _bind(_make_hip_teal, ln, 2) for ln in ('A', 'B', 'C')},
    'roof.saddle.teal': {ln: _bind(_make_roof_saddle, ln) for ln in ('A', 'B', 'C')},
    'roof.flat.stone': {ln: _bind(_make_roof_flat_stone, ln) for ln in ('A', 'B', 'C')},
    'roof.balcony_deck': {ln: _bind(_make_roof_balcony_deck, ln) for ln in ('A', 'B', 'C')},
    'band.roof_skirt': {ln: _bind(_make_roof_skirt, ln, False) for ln in ('A', 'B', 'C')},
    'band.roof_skirt.green': {ln: _bind(_make_roof_skirt, ln, True) for ln in ('A', 'B', 'C')},
    'band.balcony_deck': {ln: _bind(_make_band_balcony_deck, ln) for ln in ('A', 'B', 'C')},
    'wall.veranda': {ln: _bind(_make_wall_veranda, ln) for ln in ('A', 'B', 'C')},
    'wall.balcony_upper': {ln: _bind(_make_wall_balcony_upper, ln) for ln in ('A', 'B', 'C')},
    'wall.tower': {ln: _bind(_make_wall_tower, ln) for ln in ('A', 'B', 'C')},
    'roof.turret': {ln: _bind(_make_roof_turret, ln) for ln in ('A', 'B', 'C')},
    'roof.hip.wood': {ln: _bind(_make_roof_hip_wood, ln) for ln in ('A', 'B', 'C')},
    'roof.gf.back3': {ln: _bind(_make_roof_gf_back3, ln) for ln in ('A', 'B', 'C')},
    'extra.gable_peak': {ln: _bind(_make_extra_gable_peak, ln, False) for ln in ('A', 'B', 'C')},
    'extra.gable_peak.green': {ln: _bind(_make_extra_gable_peak, ln, True) for ln in ('A', 'B', 'C')},
    'extra.gable_dormer.green': {ln: _bind(_make_gable_dormer_teal, ln) for ln in ('A', 'B', 'C')},
}
