"""building-kit fantasy-kingdom style-r11 후보 — RM2000 다층·다축 매스 혁명 판.

style-r10(업그레이드된 12대 핵심 베이스 + 쯔꾸르 지붕)을 reuseParts 로 이어받고,
RM2000 도시 격자 제거 연구에서 도출한 4대 구조 축의 8종 부품을 줄 A·B·C 마다 구조·재질 차별화해 그린다:
  1. band.roof_skirt / band.roof_skirt.green — 1·2층 층간 1행 기와 차양 지붕(Split Roof)
  2. wall.veranda — 2층 전폭 목재/석조 발코니 난간 + 후퇴 갤러리 벽
  3. wall.tower — 원통형 명암 석조 원형 포탑 벽 + 화살 구멍
  4. roof.turret — 2칸 폭 원뿔 포탑 지붕 + 성가퀴(배틀먼트) 띠(spire: true)
  5. roof.hip.wood — 짙은 목재 널판 모임지붕(한 건물 2색 지붕 교차용)
  6. roof.gf.back3 — 3칸 좁은 박공 뒤 끝 b3(벽맞댐 돌출 현관·협소 다단 주택용)
  7. extra.gable_peak — 3칸 폭 M자 쌍박공·중앙 대형 페디먼트 지붕 부속
hex 색 금지.
"""
import dot
import style_r10 as R10

ROUND = 'style-r11'
WAVE = 'style'
NOTES = {}
THEME = 'fantasy-kingdom'

TOK = R10.TOK


def _grid_tokens(rows):
    return R10._grid_tokens(rows)


# ---------------------------------------------------------------------------
# 1. band.roof_skirt / band.roof_skirt.green (3x1 = 48x16 — 1·2층 사이 1행 기와 차양 지붕!)
# ---------------------------------------------------------------------------
def _make_roof_skirt(line, green=False):
    if green:
        if line == 'A':
            hi, lit, mid, sh, dk = 'v5', 'v4', 'v3', 'v1', 'v0'
        elif line == 'B':
            hi, lit, mid, sh, dk = 's3', 'v4', 's1', 's0', 'i0'
        else:
            hi, lit, mid, sh, dk = 'v5', 'v3', 'v2', 'v1', 'v0'
    else:
        if line == 'A':
            hi, lit, mid, sh, dk = 'r4', 'r3', 'r2', 'r1', 'r0'
        elif line == 'B':
            hi, lit, mid, sh, dk = 's3', 's2', 's1', 's0', 'i0'
        else:
            hi, lit, mid, sh, dk = 'g6', 'g5', 'g4', 'g2', 'g1'

    rows = []
    for y in range(16):
        r = []
        for pidx in range(3):
            for lx in range(16):
                # y=0,1: 2층 벽/베란다 바닥과 매끄럽게 이어지는 어두운 처마 그림자(A5 통과 보장)
                if y == 0:
                    ch = dk
                elif y == 1:
                    ch = sh if (lx % 4 != 3) else dk
                elif y >= 14:
                    ch = dk if (y == 15 or lx % 4 == 2) else sh
                else:
                    # 왼쪽 끝(l) 빛받는 모임 사선 · 오른쪽 끝(r) 그늘 사면
                    hip_l = max(1, 5 - (y - 2) // 3)
                    hip_r = min(14, 10 + (y - 2) // 3)
                    if pidx == 0 and lx < hip_l:
                        ch = dk if lx == 0 else sh
                    elif pidx == 0 and lx == hip_l:
                        ch = hi if y < 11 else lit
                    elif pidx == 2 and lx > hip_r:
                        ch = dk if (lx == 15 or y >= 11) else sh
                    elif pidx == 2 and lx == hip_r:
                        ch = dk
                    else:
                        if line == 'B':
                            # B: 청석 8px 엇갈린 슬레이트(가로 x=0/15 몸통)
                            ri = (y - 2) // 4
                            yy = (y - 2) % 4
                            tx = (lx + 2 + 4 * (ri % 2)) % 8
                            gap = (yy == 3) or (tx == 4)
                            if y >= 11:
                                ch = dk if gap else sh
                            else:
                                ch = sh if gap else (hi if (yy == 0 and tx in (1, 2)) else (lit if yy <= 1 else mid))
                        elif line == 'C':
                            # C: 거친 너와 세로 널(줄마다 어긋남)
                            ri = (y - 2) // 4
                            yy = (y - 2) % 4
                            tx = (lx + 2 * (ri % 2)) % 4
                            gap = (yy == 3) or (tx == 3 and yy >= 2)
                            if y >= 11:
                                ch = dk if gap else sh
                            else:
                                ch = sh if gap else (hi if (yy == 0 and tx == 1) else (lit if tx in (0, 1) else mid))
                        else:
                            # A: 버들항식 둥근 엇갈린 기와(x=0/15 경계 동일 톤)
                            ri = (y - 2) // 4
                            yy = (y - 2) % 4
                            tx = (lx + 1 + 2 * (ri % 2)) % 4
                            gap = (yy == 3) or (tx == 3 and yy >= 1)
                            if y >= 11:
                                ch = dk if gap else (mid if (yy == 0 and tx == 1) else sh)
                            else:
                                ch = sh if gap else (hi if (yy == 0 and tx == 1) else (lit if tx in (0, 1) else mid))
                r.append(ch)
        rows.append(r)
    tag = '초록' if green else '기본'
    return _grid_tokens(rows), {'note': f'style-r11 1·2층 층간 기와 차양 지붕({tag}, {line})'}


# ---------------------------------------------------------------------------
# 2. wall.veranda (5x2 = 80x32 — 2층 전폭 목재/석조 발코니 난간 + 후퇴 갤러리!)
# ---------------------------------------------------------------------------
def _make_wall_veranda(line):
    if line == 'A':
        pl_l, pl_m, pl_s = 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 't6', 't4', 't3', 't1'
        void_d, void_m = 't1', 't2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        fl_g, fl_a = 'v3', 'r4'
    elif line == 'B':
        pl_l, pl_m, pl_s = 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'k5', 'k4', 'k2', 'k0'
        void_d, void_m = 'i0', 'a1'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        fl_g, fl_a = 'v3', 's3'
    else:
        pl_l, pl_m, pl_s = 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'w6', 'w4', 'w3', 'w1'
        void_d, void_m = 'w1', 'w2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'
        fl_g, fl_a = 'v5', 'r4'

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
        # 공통 최상단 처마 밑 + 최하단 덱 보(y=29..31 어두운 단 → band.roof_skirt 와 A5 매끄럽게!)
        if y == 0:
            return tm_d
        if y >= 29:
            if y == 29:
                return tm_l if lx % 4 != 0 else tm_m
            return tm_d if y == 31 else (tm_m if lx % 4 != 0 else tm_d)
        # 조각 경계 기둥(lx=0, 15) 통일
        if (pidx == 0 and lx == 0) or (pidx == 4 and lx == 15):
            return tm_d
        if lx in (0, 15) and y <= 17:
            return tm_m if y % 5 != 0 else tm_d

        # 하단 전폭 발코니 난간(y=18..28) — RM2000 우상단 여관의 시그니처!
        if 18 <= y <= 28:
            # 문(d) 칸이 1층에 쓰일 일은 드물지만 문 규격 충족
            if pidx == 3 and 4 <= lx <= 11:
                if lx in (4, 11):
                    return tm_d
                if y == 22 and lx == 9:
                    return fl_a
                return tm_l if lx <= 7 else tm_m
            # 윗 난간대(y=18..19)
            if y == 18:
                return tm_h if (lx % 8 != 4) else tm_l
            if y == 19:
                return tm_d
            # 난간 기둥·살대(y=20..27) — 라인별 구조 차별화!
            if y == 28:
                return tm_d
            if (pidx == 0 and lx in (1, 2)) or (pidx == 4 and lx in (13, 14)):
                return tm_l if lx in (1, 13) else tm_d
            if lx in (0, 15):
                return tm_l if lx == 0 else tm_m
            if line == 'B':
                # B: 석조 아치형 발루스트레이드 난간
                if y == 20 or y == 27:
                    return tm_l if lx % 4 != 0 else tm_d
                if lx in (3, 4, 7, 8, 11, 12):
                    return tm_h if lx in (3, 7, 11) else tm_m
                return void_d if y <= 23 else void_m
            if line == 'C':
                # C: 통나무 X자 교차 난간
                if y in (23, 24):
                    return tm_l if y == 23 else tm_d
                d1 = (y - 20) + 2
                d2 = 13 - (y - 20)
                if lx in (d1, d1 + 1, d2, d2 - 1):
                    return tm_l
                return void_d if y <= 23 else void_m
            # A: 촘촘한 목재 세로 난간살(2px 살대 + 2px 어두운 베란다 깊이) + 창 밑 작은 꽃장식
            if pidx == 2 and y == 20 and 4 <= lx <= 11:
                return fl_a if lx in (6, 9) else fl_g
            if lx % 4 in (1, 2):
                return tm_l if lx % 4 == 1 else tm_m
            return void_d if y <= 23 else void_m

        # 상단 후퇴 갤러리 벽(y=1..17)
        if y == 17:
            return tm_d if lx % 4 == 0 else tm_m
        if pidx in (0, 4):
            if (pidx == 0 and lx == 1) or (pidx == 4 and lx == 14):
                return tm_l if pidx == 0 else tm_m
            if 4 <= y <= 14:
                d = (y - 4) + 3 if pidx == 0 else 12 - (y - 4)
                if lx in (d, d + 1):
                    return tm_l if lx == d else tm_d
            return bg_upper(lx, y)
        if pidx == 1:
            # m: 후퇴한 그늘 아치 갤러리 개구부(RM2000 우상단 어두운 복도 입구 느낌!)
            if 5 <= y <= 16 and 3 <= lx <= 12:
                if y == 5 and lx in (3, 12):
                    return bg_upper(lx, y)
                if y == 5 or lx in (3, 12):
                    return tm_l if lx <= 7 else tm_d
                if y == 6 or lx == 4:
                    return void_d
                return void_d if y <= 10 else void_m
            return bg_upper(lx, y)
        if pidx == 2:
            # w: 덧문 달린 2층 베란다 창
            if 4 <= y <= 16 and 2 <= lx <= 13:
                if y == 4:
                    return tm_l if lx < 10 else tm_d
                if lx in (2, 3, 12, 13):
                    return tm_d if lx in (2, 13) else tm_m
                if lx in (4, 11) or y in (5, 16):
                    return tm_d
                if lx in (7, 8) or y == 10:
                    return tm_m
                if (lx, y) in ((5, 7), (6, 7), (9, 7), (6, 12)):
                    return gl_h
                return gl_m if y >= 11 else gl_d
            return bg_upper(lx, y)
        # d(3): 2층 베란다 문
        if 4 <= y <= 17 and 3 <= lx <= 12:
            if y == 4 or lx in (3, 12):
                return tm_d
            if lx in (6, 9):
                return tm_d
            return tm_l if lx <= 7 else tm_m
        return bg_upper(lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r11 2층 전폭 발코니 베란다 벽 ({line})'}


# ---------------------------------------------------------------------------
# 3. wall.tower (5x2 = 80x32 — 원통형 명암 석조 원형 포탑 벽 + 화살 구멍 + 포스턴 문)
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

    # 6단 불규칙 석조 코스(원통 곡면 음영 적용)
    courses = [(2, 5), (7, 5), (12, 5), (17, 5), (22, 4), (26, 4)]

    def stone_at(gx, y, shade_bias):
        """gx in 0..31 (2칸 원통 좌표), shade_bias: 0=밝은 왼면, 1=정면, 2=중그늘, 3=깊은 오른면."""
        if y == 0:
            return st_l if shade_bias == 0 else (st_m if shade_bias == 1 else (st_s if shade_bias == 2 else st_d))
        if y == 1:
            return st_m if shade_bias <= 1 else (st_s if shade_bias == 2 else st_d)
        if y == 30:
            return st_m if (shade_bias <= 1 and gx % 5 != 0) else (st_s if shade_bias == 2 else st_d)
        if y == 31:
            return st_s if shade_bias <= 1 else st_d
        # 원통 띠 돌출 몰딩(y=16)
        if y == 16 and line == 'B':
            return st_h if shade_bias == 0 else (st_l if shade_bias == 1 else st_s)
        if y == 17 and line == 'B':
            return st_d
        for ci, (y0, h) in enumerate(courses):
            if y0 <= y < y0 + h:
                rr = y - y0
                if rr == h - 1:
                    return st_s if shade_bias == 0 else st_d
                # 원통 투시: 양끝 쪽 돌이 더 좁게(원근감!)
                step = 5 if (gx < 5 or gx >= 27) else 7
                off = (ci * 3) % step
                bx = (gx + off) % step
                if bx == 0:
                    return st_s if shade_bias == 0 else st_d
                v = (gx // step + ci * 2) % 3
                if shade_bias == 0:
                    if rr == 0:
                        return st_h
                    return wa_l if v == 0 else st_l
                if shade_bias == 1:
                    if rr == 0:
                        return st_l if v != 2 else st_m
                    return st_l if v == 0 else st_m
                if shade_bias == 2:
                    if rr == 0:
                        return st_m if v != 2 else st_s
                    return st_m if v == 0 else st_s
                # 깊은 오른 그늘 곡면
                if rr == 0:
                    return st_s if v == 0 else st_d
                return st_s if (v == 0 and rr == 1) else st_d
        return st_m

    def cyl_bias(gx):
        # 부드러운 4단 원통 명암 곡선(0=하이라이트 → 1=정면 → 2=중그늘 → 3=깊은 그늘)
        if gx <= 9:
            return 0
        if gx <= 18:
            return 1
        if gx <= 25:
            return 2
        return 3

    def cell_px(pidx, lx, y):
        # l(0): 2칸 원통 포탑의 왼쪽 절반(gx=0..15)
        if pidx == 0:
            if lx == 0:
                return st_s if y % 4 != 0 else st_d
            if line == 'C' and y in (7, 17, 26):
                return dr_l if lx < 10 else dr_m
            # 원통 정면-좌측 중앙 화살 구멍 1개(lx=11..13, y=9..18)
            if 9 <= y <= 18 and 11 <= lx <= 13:
                if lx == 12 and 10 <= y <= 17:
                    return 'i0'
                if y in (9, 18) or lx == 11:
                    return st_h if lx == 11 else st_d
                return st_d
            return stone_at(lx, y, cyl_bias(lx))
        # r(4): 2칸 원통 포탑의 오른쪽 절반(gx=16..31)
        if pidx == 4:
            if lx == 15:
                return st_d
            if line == 'C' and y in (7, 17, 26):
                return dr_m if lx < 8 else dr_d
            return stone_at(16 + lx, y, cyl_bias(16 + lx))
        # m(1): 가운데 반복(8px 주기 마름돌 — x=0/15 모두 돌 몸통 → S 가로 이음 0!)
        if pidx == 1:
            if y == 0:
                return st_d
            if y == 1:
                return st_s if lx % 4 != 3 else st_d
            if y == 30:
                return st_m if lx % 4 != 0 else st_d
            if y == 31:
                return st_d
            for ci, (y0, h) in enumerate(courses):
                if y0 <= y < y0 + h:
                    rr = y - y0
                    if rr == h - 1:
                        return st_d
                    bx = (lx + 2 + 4 * (ci % 2)) % 8
                    if bx == 7:
                        return st_d
                    return st_l if (rr == 0 or bx == 0) else st_m
            return st_m
        # w(2): 작은 아치형 탑 창문
        if pidx == 2:
            if 7 <= y <= 19 and 5 <= lx <= 10:
                if y == 7 and lx in (5, 10):
                    return stone_at(8 + lx, y, 1)
                if lx in (5, 10) or y in (7, 19):
                    return st_h if lx == 5 else st_d
                if (lx, y) in ((7, 10), (7, 11)):
                    return gl_h
                return 's0' if y < 14 else 's2'
            return stone_at(8 + lx, y, 1)
        # d(3): 좁은 아치형 탑 출입문(포스턴 문)
        if 7 <= y <= 29 and 3 <= lx <= 12:
            if y == 7 and lx in (3, 4, 11, 12):
                return stone_at(8 + lx, y, 1)
            if y == 8 and lx in (3, 12):
                return stone_at(8 + lx, y, 1)
            if lx in (3, 12) or (y == 7 and 5 <= lx <= 10) or (y == 8 and lx in (4, 11)):
                return st_h if lx <= 7 else st_d
            if y == 29:
                return st_l if lx <= 8 else st_d
            if y in (14, 23):
                return 'i2' if lx in (6, 9) else 'i0'
            if lx in (4, 11) or y == 9:
                return dr_d
            return dr_l if lx <= 7 else dr_m
        return stone_at(8 + lx, y, 1)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r11 원통형 명암 석조 원형 포탑 벽 ({line})'}


# ---------------------------------------------------------------------------
# 4. roof.turret (3x4 = 48x64, spire: true — 2칸 폭 원뿔 포탑 지붕 + 성가퀴 돌 띠!)
# ---------------------------------------------------------------------------
def _make_roof_turret(line):
    if line == 'A':
        hi, lit, mid, sh, dk = 'r4', 'r3', 'r2', 'r1', 'r0'
        st_h, st_l, st_m, st_d = 'k5', 'k4', 'k2', 'k0'
        fin = 'r4'
    elif line == 'B':
        hi, lit, mid, sh, dk = 's3', 's2', 's1', 's0', 'i0'
        st_h, st_l, st_m, st_d = 'a6', 'a5', 'a3', 'a0'
        fin = 'i3'
    else:
        hi, lit, mid, sh, dk = 'g6', 'g5', 'g4', 'g2', 'g1'
        st_h, st_l, st_m, st_d = 'w5', 'w4', 'w2', 'w1'
        fin = 'g6'

    def cone_px(gx, y, W):
        """gx in 0..W-1, y in 0..63. W=32(2칸 포탑 l+r) 또는 W=16(1칸 m)."""
        cx = W / 2.0
        # 깃대/첨탑 끝(y=0..5)
        if y <= 5:
            dist = abs(gx + 0.5 - cx)
            if dist <= 0.6:
                return fin if y <= 2 else (hi if gx < cx else sh)
            if y >= 4 and dist <= 1.6:
                return hi if gx < cx else dk
            return '.'
        # 원뿔 지붕 본체(y=6..47)
        if y <= 47:
            # 원뿔 반지름: y=6 에서 1.5px → y=47 에서 W/2 - 0.5px
            t = (y - 6) / 41.0
            rad = 1.5 + t * (W / 2.0 - 1.5)
            dx = (gx + 0.5) - cx
            if abs(dx) > rad:
                return '.'
            # 외곽선
            if abs(dx) >= rad - 1.0:
                return hi if (dx < 0 and y < 38) else dk
            # 처마 끝(y=45..47)
            if y >= 45:
                return dk if y == 47 else (sh if gx % 4 != 2 else dk)
            # 원뿔 기와 비늘 + 원통 명암(왼쪽 밝고 오른쪽 어두움)
            ri = (y - 6) // 4
            yy = (y - 6) % 4
            tx = (gx + 2 * (ri % 2)) % 4
            gap = (yy == 3) or (tx == 3 and yy >= 1)
            rel = dx / max(rad, 1.0)  # -1(왼쪽 빛) .. +1(오른쪽 그늘)
            if rel < -0.35:
                return mid if gap else (hi if yy <= 1 else lit)
            if rel < 0.25:
                return sh if gap else (lit if (yy == 0 and tx == 1) else mid)
            return dk if gap else (sh if rel < 0.7 else dk)
        # 하단 성가퀴(배틀먼트) + 까치발 돌 띠(y=48..63 — 포탑 벽과 자연 연결!)
        if y == 48:
            return dk
        if 49 <= y <= 53:
            # 성가퀴 톱니(merlons) — 라인 B 는 더 날카로운 석조 성가퀴, C 는 목조 망루 난간
            if (gx % 6) in (4, 5) and y <= 51:
                return st_d
            if y == 49:
                return st_h if gx < cx else st_l
            return st_l if gx < cx else st_m
        if y == 54:
            return st_d
        if 55 <= y <= 60:
            # 까치발(machicolations)
            if gx in (0, W - 1):
                return st_d
            if (gx % 4) in (1, 2) and y <= 59:
                return st_l if gx < cx else st_m
            return st_d if y <= 58 else st_m
        if y == 61:
            return st_m if gx < cx else st_d
        return st_d

    # l(0..15) = 32px 원뿔의 왼쪽 절반, m(16..31) = 16px 단독 원뿔, r(32..47) = 32px 원뿔의 오른쪽 절반
    rows = []
    for y in range(64):
        r = [cone_px(x, y, 32) for x in range(16)]
        r += [cone_px(x, y, 16) for x in range(16)]
        r += [cone_px(16 + x, y, 32) for x in range(16)]
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 2칸 원뿔 포탑 지붕 + 성가퀴 ({line})'}


# ---------------------------------------------------------------------------
# 5. roof.hip.wood (5x3 = 80x48 — RM2000 ①④ 이색 지붕 교차용 짙은 목재 널판 지붕!)
# ---------------------------------------------------------------------------
def _make_roof_hip_wood(line):
    if line == 'A':
        # A: 따뜻한 갈색 세로 널판/너와 지붕(RM2000 좌상단 갈색 지붕!)
        hi, lit, mid, sh, dk = 'g6', 'g5', 'g4', 'g2', 'g1'
    elif line == 'B':
        # B: 짙은 참나무 판자 지붕
        hi, lit, mid, sh, dk = 't5', 't4', 't3', 't2', 't1'
    else:
        # C: 짙은 붉은 삼나무 지붕(라인 C 의 기본 g 램프와 대비되는 r 램프!)
        hi, lit, mid, sh, dk = 'r4', 'r3', 'r2', 'r1', 'r0'

    H = 48
    cut_top = 18 if line == 'A' else (14 if line == 'B' else 21)
    lower_y = 32

    def plank_px(gx, y, shade=False):
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
            # A: 4px 세로 널판(vertical board-and-batten roof — RM2000 좌상단 갈색 세로 줄 지붕!)
            px4 = (gx + 1) % 4
            plank_id = (gx + 1) // 4
            joint_y = (y - 4 + 3 * (plank_id % 3)) % 12
            is_seam = (px4 == 3) or (joint_y == 11)
            is_hi = (px4 == 0 and joint_y in (0, 1))
            if shade:
                return dk if (is_seam or lower) else sh
            if lower:
                return dk if is_seam else (mid if px4 == 0 else sh)
            if is_seam:
                return sh
            if is_hi:
                return hi
            return lit if px4 in (0, 1) else mid
        if line == 'B':
            # B: 넓은 8px 수평 겹침 판자 + 마름모 이음(A 의 세로 널판과 구조 완전 차별화!)
            ri = (y - 4) // 4
            yy = (y - 4) % 4
            tx8 = (gx + 2 + 4 * (ri % 2)) % 8
            is_seam = (yy == 3) or (tx8 == 4 and yy >= 1)
            is_hi = (yy == 0 and tx8 in (1, 2, 3))
            if shade:
                return dk if (is_seam or lower) else sh
            if lower:
                return dk if is_seam else (mid if is_hi else sh)
            return sh if is_seam else (hi if is_hi else (lit if yy == 1 else mid))
        # C: 6px 굵은 가로 삼나무 비늘 지붕(줄마다 4px 엇갈림 + 굵은 처마 띠)
        ri = (y - 4) // 6
        yy = (y - 4) % 6
        tx4 = (gx + 1 + 2 * (ri % 2)) % 4
        is_seam = (yy == 5) or (yy == 4 and tx4 == 3)
        is_hi = (yy == 0 and tx4 in (0, 1))
        if shade:
            return dk if (is_seam or lower) else sh
        if lower:
            return dk if is_seam else (mid if (yy <= 1 and tx4 == 0) else sh)
        return sh if is_seam else (hi if is_hi else (lit if yy <= 2 else mid))

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
                    r[x] = plank_px(x, y, shade=False)
        for x in range(16):
            r[32 + x] = plank_px(x, y, shade=False)
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
                    r[48 + x] = plank_px(x, y, shade=(x > hip))
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 RM2000 세로 널판 목재 모임지붕 ({line})'}


# ---------------------------------------------------------------------------
# 6. roof.gf.back3 (3x1 = 48x16, form: gf_back — 3칸 좁은 박공 뒤 끝 b3)
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
# 7. extra.gable_peak / extra.gable_peak.green (3x2 = 48x32, on: roof — M자 쌍박공·중앙 페디먼트!)
# ---------------------------------------------------------------------------
def _make_extra_gable_peak(line, green=False):
    if line == 'A':
        r_hi, r_l, r_m, r_s, r_d = ('v5', 'v4', 'v3', 'v1', 'v0') if green else ('r4', 'r3', 'r2', 'r1', 'r0')
        pl_l, pl_m, pl_s = 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 't6', 't4', 't3', 't1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        fl_g, fl_a = 'v3', 'r4'
    elif line == 'B':
        r_hi, r_l, r_m, r_s, r_d = ('s3', 'v4', 's1', 's0', 'i0') if green else ('s3', 's2', 's1', 's0', 'i0')
        pl_l, pl_m, pl_s = 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'k5', 'k4', 'k2', 'k0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        fl_g, fl_a = 'a3', 's3'
    else:
        r_hi, r_l, r_m, r_s, r_d = ('v5', 'v3', 'v2', 'v1', 'v0') if green else ('g6', 'g5', 'g4', 'g2', 'g1')
        pl_l, pl_m, pl_s = 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'w6', 'w4', 'w2', 'w1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'
        fl_g, fl_a = 'v5', 'r4'

    # 3x2 = 48x32: 위쪽 절반(y=0..15)은 밝은 박공/반모임 지붕 윗면(top [0,1] 폭 >= 65% → F 통과),
    # 왼쪽·위 빛쪽 외곽선은 밝은 단(OUTLINE 경고 0!), 아래쪽(y=16..31)은 반목조 삼각 박공벽+다락창!
    rows = []
    for y in range(32):
        r = ['.'] * 48
        for x in range(48):
            if y < 18:
                if y == 0:
                    continue
                # 반모임/넓은 삼각 박공 실루엣(꼭대기 y=1 폭 14px → y=15 전폭 48px)
                half = min(23, int((y - 1) * 1.35) + 7)
                lo, hi_x = 23 - half, 24 + half
                if x < lo or x > hi_x:
                    continue
                if y == 1:
                    r[x] = r_hi if x < 28 else r_l
                elif x == lo:
                    r[x] = r_hi if y < 15 else r_l
                elif x == lo + 1:
                    r[x] = r_hi if y < 14 else r_m
                elif x == hi_x:
                    r[x] = r_d if y >= 5 else r_m
                elif y >= 16:
                    # 처마 앞 빗변 테두리(top [0,1] 대비 어두운 앞 모서리 — F 통과!)
                    r[x] = r_d if y == 17 else r_s
                else:
                    ri = y // 3
                    tx = (x + 2 * (ri % 2)) % 4
                    gap = (y % 3 == 2) or (tx == 3)
                    if x < 26:
                        r[x] = r_m if gap else (r_hi if (y % 3 == 0 and tx == 1) else r_l)
                    else:
                        r[x] = r_d if gap else (r_m if (y % 3 == 0 and tx == 1) else r_s)
            else:
                inset = max(2, 2 + (31 - y) // 6)
                lo, hi_x = inset, 47 - inset
                if x < lo or x > hi_x:
                    continue
                if x == lo:
                    r[x] = tm_l  # 왼쪽 빛쪽 외곽선 → OUTLINE 경고 0!
                elif x == hi_x or y == 31:
                    r[x] = tm_d
                elif y == 18:
                    r[x] = r_d  # 처마 깊은 그림자
                elif y == 30:
                    r[x] = tm_l if x < 34 else tm_m
                # 중앙 다락창(y=20..28, x=19..28)
                elif 20 <= y <= 28 and 19 <= x <= 28:
                    if y == 20:
                        r[x] = tm_h if x < 26 else tm_d
                    elif y == 28:
                        r[x] = fl_a if x in (21, 26) else fl_g
                    elif x in (19, 28):
                        r[x] = tm_d
                    elif x in (23, 24) or y == 24:
                        r[x] = tm_m
                    elif (x, y) in ((20, 22), (21, 22), (25, 22), (21, 26)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m if y >= 25 else gl_d
                elif line == 'A':
                    if y == 29:
                        r[x] = tm_m
                    elif x in (lo + 1, hi_x - 1):
                        r[x] = tm_l if x == lo + 1 else tm_d
                    elif (x - (lo + 2) == y - 20) or ((hi_x - 2) - x == y - 20):
                        r[x] = tm_m
                    else:
                        patch = ((x // 2) * 5 + (y // 2) * 7) % 11
                        r[x] = pl_m if (patch == 0 or y == 19) else pl_l
                elif line == 'B':
                    bx = (x + 3 * ((y // 4) % 2)) % 6
                    r[x] = tm_d if (y % 4 == 3 or bx == 5) else (pl_l if y % 4 == 0 else pl_m)
                else:
                    r[x] = tm_d if x % 4 == 0 else (pl_l if x % 4 == 1 else pl_m)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r11 3칸 M자 쌍박공·중앙 페디먼트 지붕 부속 ({line})'}


def _bind(fn, *args):
    def _f():
        return fn(*args)
    _f.__name__ = f'{fn.__name__}_{"_".join(str(a) for a in args)}'
    return _f


CANDIDATES = {
    'band.roof_skirt': {ln: _bind(_make_roof_skirt, ln, False) for ln in ('A', 'B', 'C')},
    'band.roof_skirt.green': {ln: _bind(_make_roof_skirt, ln, True) for ln in ('A', 'B', 'C')},
    'wall.veranda': {ln: _bind(_make_wall_veranda, ln) for ln in ('A', 'B', 'C')},
    'wall.tower': {ln: _bind(_make_wall_tower, ln) for ln in ('A', 'B', 'C')},
    'roof.turret': {ln: _bind(_make_roof_turret, ln) for ln in ('A', 'B', 'C')},
    'roof.hip.wood': {ln: _bind(_make_roof_hip_wood, ln) for ln in ('A', 'B', 'C')},
    'roof.gf.back3': {ln: _bind(_make_roof_gf_back3, ln) for ln in ('A', 'B', 'C')},
    'extra.gable_peak': {ln: _bind(_make_extra_gable_peak, ln, False) for ln in ('A', 'B', 'C')},
    'extra.gable_peak.green': {ln: _bind(_make_extra_gable_peak, ln, True) for ln in ('A', 'B', 'C')},
}
