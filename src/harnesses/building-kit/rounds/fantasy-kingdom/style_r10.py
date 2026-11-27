"""building-kit fantasy-kingdom style-r10 후보 — 쯔꾸르 정석(RM2000·RMXP·FSM/REFMAP) 고품질 지붕·처마 6종.

품질 전면 개편:
- roof.hip.green: 가로 블라인드 줄 제거 → 엇갈린 비늘 기와 + 부드러운 처마 음영 그라데이션
- extra.gable_dormer / extra.gable_dormer.green: 낱장 기와 결 + 따뜻한 크림 반목조 + 창틀/꽃상자 + 지붕 위 오른쪽 그림자
- extra.porch_roof: 오른쪽 끊김 노치 제거 → 연속 배치 시 매끄럽게 이어지는 3/4 경사 나무/청석 덧지붕
- roof.flat & extra.terrace: 다듬은 파라펫 갓돌·오목 몰딩 + 높이/꽃색이 다양한 자연스러운 옥상 화단·난간
"""
import dot
import style_r3 as R3
import style_r4 as R4

ROUND = 'style-r10'
WAVE = 'style'
NOTES = {}
THEME = 'fantasy-kingdom'

TOK = {
    'r0': ('roof', 0), 'r1': ('roof', 1), 'r2': ('roof', 2), 'r3': ('roof', 3), 'r4': ('roof', 4),
    's0': ('slate', 0), 's1': ('slate', 1), 's2': ('slate', 2), 's3': ('slate', 3),
    'g0': ('shingle', 0), 'g1': ('shingle', 1), 'g2': ('shingle', 2), 'g3': ('shingle', 3),
    'g4': ('shingle', 4), 'g5': ('shingle', 5), 'g6': ('shingle', 6),
    'p0': ('plaster', 0), 'p1': ('plaster', 1), 'p2': ('plaster', 2), 'p3': ('plaster', 3), 'p4': ('plaster', 4),
    't0': ('timber', 0), 't1': ('timber', 1), 't2': ('timber', 2), 't3': ('timber', 3),
    't4': ('timber', 4), 't5': ('timber', 5), 't6': ('timber', 6),
    'w0': ('wood', 0), 'w1': ('wood', 1), 'w2': ('wood', 2), 'w3': ('wood', 3),
    'w4': ('wood', 4), 'w5': ('wood', 5), 'w6': ('wood', 6),
    'k0': ('stone', 0), 'k1': ('stone', 1), 'k2': ('stone', 2), 'k3': ('stone', 3), 'k4': ('stone', 4), 'k5': ('stone', 5),
    'a0': ('ashlar', 0), 'a1': ('ashlar', 1), 'a2': ('ashlar', 2), 'a3': ('ashlar', 3),
    'a4': ('ashlar', 4), 'a5': ('ashlar', 5), 'a6': ('ashlar', 6),
    'i0': ('iron', 0), 'i1': ('iron', 1), 'i2': ('iron', 2), 'i3': ('iron', 3),
    'v0': ('grass', 0), 'v1': ('grass', 1), 'v2': ('grass', 2), 'v3': ('grass', 3), 'v4': ('grass', 4), 'v5': ('grass', 5), 'v6': ('grass', 6),
    'c0': ('cobble', 0), 'c1': ('cobble', 1), 'c2': ('cobble', 2), 'c3': ('cobble', 3), 'c4': ('cobble', 4), 'c5': ('cobble', 5),
}


def _grid_tokens(rows):
    used = sorted({tok for r in rows for tok in r if tok != '.'})
    syms = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=?<>^/|:;,_-'
    t2c = {tok: syms[idx] for idx, tok in enumerate(used)}
    leg = dot.legend(THEME, **{c: TOK[tok] for tok, c in t2c.items()})
    str_rows = [''.join('.' if tok == '.' else t2c[tok] for tok in r) for r in rows]
    return dot.grid(str_rows, leg)


# ---------------------------------------------------------------------------
# 1. roof.flat (3x2 = 48x32: l, m, r, end=1 — 다듬은 석조/벽돌 평지붕 + 난간 파라펫)
# ---------------------------------------------------------------------------
def _make_roof_flat(line):
    if line == 'A':
        cop_h, cop_l, cop_m, cop_d = 'p4', 'p3', 'p1', 'r1'
        fl_h, fl_l, fl_m, fl_d = 'p3', 'p2', 'p0', 'g4'
        par_l, par_m, par_d = 'r3', 'r2', 'r0'
    elif line == 'B':
        cop_h, cop_l, cop_m, cop_d = 'k5', 'k4', 'k3', 'k1'
        fl_h, fl_l, fl_m, fl_d = 'a6', 'a5', 'a4', 'a2'
        par_l, par_m, par_d = 'a4', 'a2', 'a0'
    else:
        cop_h, cop_l, cop_m, cop_d = 'w6', 'w5', 'w4', 'w1'
        fl_h, fl_l, fl_m, fl_d = 'w6', 'w5', 'w4', 'w2'
        par_l, par_m, par_d = 'w3', 'w2', 'w0'

    def floor_px(lx, y):
        # 16px 대칭 옥상 포석/나무갑판 (x=0/15 일치)
        if line == 'A':
            # 따뜻한 테라코타+석회 엇갈린 옥상 판석
            row_i = (y - 3) // 4
            yy = (y - 3) % 4
            sx = (lx + 4 * (row_i % 2)) % 8
            if yy == 3 or sx == 4:
                return fl_m
            if yy == 0 and sx in (1, 2):
                return fl_h
            return fl_l
        if line == 'B':
            # 정교한 마름돌 판석
            if y in (7, 11, 15):
                return fl_d
            if lx in (7, 8) and (y // 4) % 2 == 0:
                return fl_d
            return fl_h if y < 9 else fl_l
        # C: 나무 갑판 널빤지
        if y in (6, 9, 12, 15):
            return fl_d
        if lx == 8 and (y // 3) % 2 == 0:
            return fl_d
        return fl_h if y < 9 else fl_l

    rows = []
    for y in range(32):
        r = []
        for pidx in range(3):
            for lx in range(16):
                # 뒤쪽 난간 갓돌(y=0..2)
                if y == 0:
                    ch = cop_h if (pidx != 2 or lx < 14) else cop_m
                elif y == 1:
                    ch = cop_l if (lx % 8 != 4) else cop_m
                elif y == 2:
                    ch = cop_d
                # 좌/우 측면 파라펫 벽(두께 3px, 갓돌 입체)
                elif pidx == 0 and lx <= 2 and y <= 23:
                    ch = cop_h if lx == 0 else (cop_l if lx == 1 else cop_d)
                elif pidx == 2 and lx >= 13 and y <= 23:
                    ch = par_d if lx == 15 else (cop_m if lx == 14 else cop_l)
                # 옥상 평면 바닥(y=3..15)
                elif y <= 15:
                    ch = floor_px(lx, y)
                # 앞 난간 내벽 그림자 + 갓돌 윗면(y=16..19)
                elif y == 16:
                    ch = par_d
                elif y == 17:
                    ch = cop_h if (lx % 8 != 4) else cop_m
                elif y == 18:
                    ch = cop_l if (lx % 8 != 4) else cop_d
                elif y == 19:
                    ch = cop_d
                # 앞 파라펫 외벽(벽돌/석재 몰딩 + 처마 그늘 y=20..31)
                elif y <= 28:
                    if line == 'A':
                        # 엇갈린 벽돌 파라펫 + 하단 돌림띠
                        row_i = (y - 20) // 3
                        yy = (y - 20) % 3
                        sx = (lx + 4 * (row_i % 2)) % 8
                        if y == 28 or yy == 2 or sx == 4:
                            ch = par_d
                        elif yy == 0 and sx in (1, 2):
                            ch = par_l
                        else:
                            ch = par_m
                    elif line == 'B':
                        # 고전 석조 아케이드 프리즈 몰딩
                        if y in (20, 28):
                            ch = par_d
                        elif 22 <= y <= 26 and lx in (3, 4, 5, 10, 11, 12):
                            ch = par_d if y == 22 else par_m
                        else:
                            ch = par_l if y < 24 else par_m
                    else:
                        # 목조 난간 보 + 까치발
                        if y in (20, 28) or lx in (3, 12):
                            ch = par_d
                        elif y <= 24:
                            ch = par_l if lx % 4 != 0 else par_m
                        else:
                            ch = par_m
                else:
                    ch = par_d if y >= 30 else (cop_d if lx % 4 == 2 else par_d)
                r.append(ch)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 다듬은 평지붕·난간 ({line})'}


# ---------------------------------------------------------------------------
# 2. roof.hip.green (5x3 = 80x48 — 엇갈린 비늘/골 초록 기와 모임지붕, 블라인드 줄 제거!)
# ---------------------------------------------------------------------------
def _make_roof_hip_green(line):
    if line == 'A':
        hi, lit, mid, sh, dk, edge = 'v6', 'v4', 'v2', 'v0', 'c0', 'i0'
    elif line == 'B':
        hi, lit, mid, sh, dk, edge = 'v5', 'v2', 'v0', 's1', 's0', 'i0'
    else:
        hi, lit, mid, sh, dk, edge = 'v5', 'v3', 'v1', 'v0', 'g0', 'i0'

    def tile_px(gx, y, shade=False):
        # 용마루(y=0..3)
        if y <= 1:
            return hi if ((gx + 2) % 4 != 0) else lit
        if y == 2:
            return lit if ((gx + 2) % 4 != 0) else mid
        if y == 3:
            return sh
        # 맨 아래 처마 끝(y=45..47)
        if y >= 45:
            return edge if y == 47 else (dk if (gx % 4 != 2) else edge)

        # 엇갈린 둥근 기와 낱장(x=0/15 대칭: 4px 기와 폭, 줄마다 2px 엇갈림, 5px 단)
        # 아랫단(y>=32)도 똑같은 낱장 기와 결을 유지하면서 톤만 한 단 어둡게(F 관문 + 블라인드 제거!)
        lower = y >= 32
        step_y = 5 if line != 'C' else 6
        row_i = (y - 4) // step_y
        yy = (y - 4) % step_y
        shift = 2 if (row_i % 2 == 1) else 0
        # 4px 기와(gx+shift % 4 -> 0,1,2,3; x=0과 x=15가 같은 경계 패턴을 갖도록 보정)
        tx = (gx + shift) % 4

        if line == 'A':
            # 둥근 겹침 기와 (버들항 기와 리듬과 유사)
            is_gap = (yy == step_y - 1) or (tx == 3 and yy >= 1)
            is_hi = (yy == 0 and tx in (0, 1))
            if shade:
                return edge if (lower and is_gap) else (dk if is_gap else (dk if lower else sh))
            if lower:
                return dk if is_gap else (mid if is_hi else sh)
            return sh if is_gap else (hi if is_hi else (lit if tx in (0, 1) else mid))
        if line == 'B':
            # 청록 8px 비늘 슬레이트(x=0/15 모두 타일 몸통 — S 가로 이음 0)
            tx8 = (gx + 2 + (4 if row_i % 2 else 0)) % 8
            is_gap = (yy == step_y - 1) or (tx8 == 4)
            is_hi = (yy == 0 and tx8 in (1, 2, 6))
            if shade:
                return edge if (lower and is_gap) else (dk if is_gap else (dk if lower else sh))
            if lower:
                return dk if is_gap else (mid if is_hi else sh)
            return sh if is_gap else (hi if is_hi else (lit if yy <= 2 else mid))
        # C: 육각/다이아 숲초록 비늘 기와
        tx4 = (gx + (2 if row_i % 2 else 0)) % 4
        is_gap = (yy == step_y - 1) or (yy == step_y - 2 and tx4 in (0, 3))
        is_hi = (yy == 1 and tx4 in (1, 2))
        if shade:
            return dk if is_gap else (dk if lower else sh)
        if lower:
            return dk if is_gap else (mid if is_hi else sh)
        return sh if is_gap else (hi if is_hi else (lit if tx4 in (1, 2) else mid))

    rows = []
    for y in range(48):
        r = ['.'] * 80
        cut_top = 18 if line == 'A' else (17 if line == 'B' else 19)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x < cut:
                r[x] = '.'
            elif x == cut and y < cut_top:
                r[x] = sh
            else:
                hip = 22 - (y * 22) // 47
                if abs(x - hip) <= 1 and y >= 3:
                    r[x] = hi if x == hip else lit
                else:
                    r[x] = tile_px(x, y, shade=False)
        for x in range(16):
            r[32 + x] = tile_px(x, y, shade=False)
        for x in range(32):
            cut = max(0, cut_top - y) if y < cut_top else 0
            if x >= 32 - cut:
                r[48 + x] = '.'
            elif x == 31 - cut and y < cut_top:
                r[48 + x] = dk
            else:
                hip = 9 + (y * 22) // 47
                if abs(x - hip) <= 1 and y >= 3:
                    r[48 + x] = dk
                else:
                    r[48 + x] = tile_px(x, y, shade=(x > hip))
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 고품질 초록/청록 기와 모임지붕 ({line})'}


# ---------------------------------------------------------------------------
# 3. extra.gable_dormer / extra.gable_dormer.green (2x2 = 32x32 — 낱장 기와+따뜻한 반목조+꽃상자)
# ---------------------------------------------------------------------------
def _make_gable_dormer(line, green=False):
    if green:
        if line == 'A':
            rf_h, rf_l, rf_m, rf_d = 'v6', 'v4', 'v2', 'v0'
            wl_l, wl_m, wl_d = 'p3', 'p1', 't1'
            tm_l, tm_m, tm_d = 't4', 't3', 't1'
            gl_h, gl_m = 'p4', 's1'
        elif line == 'B':
            rf_h, rf_l, rf_m, rf_d = 'v5', 'v2', 'v0', 's0'
            wl_l, wl_m, wl_d = 'a5', 'a3', 'a1'
            tm_l, tm_m, tm_d = 'i2', 'i1', 'i0'
            gl_h, gl_m = 'p4', 's0'
        else:
            rf_h, rf_l, rf_m, rf_d = 'v5', 'v3', 'v1', 'g0'
            wl_l, wl_m, wl_d = 'w5', 'w3', 'w1'
            tm_l, tm_m, tm_d = 'w4', 'w2', 'w0'
            gl_h, gl_m = 'p3', 's1'
    else:
        if line == 'A':
            rf_h, rf_l, rf_m, rf_d = 'r4', 'r3', 'r2', 'r0'
            wl_l, wl_m, wl_d = 'p3', 'p1', 't1'
            tm_l, tm_m, tm_d = 't5', 't3', 't1'
            gl_h, gl_m = 'p4', 's1'
        elif line == 'B':
            rf_h, rf_l, rf_m, rf_d = 's3', 's3', 's2', 's0'
            wl_l, wl_m, wl_d = 'a5', 'a3', 'a1'
            tm_l, tm_m, tm_d = 'i3', 'i1', 'i0'
            gl_h, gl_m = 'p4', 's0'
        else:
            rf_h, rf_l, rf_m, rf_d = 'g6', 'g5', 'g3', 'g0'
            wl_l, wl_m, wl_d = 'w5', 'w3', 'w1'
            tm_l, tm_m, tm_d = 'w4', 'w2', 'w0'
            gl_h, gl_m = 'p3', 's1'

    rows = []
    for y in range(32):
        r = ['.'] * 32
        # 상단(y=1..14): 낱장 기와 결이 살아있는 삼각 지붕(top=[0,1])
        if 1 <= y <= 14:
            if line == 'B':
                half = min(13, 2 + (y - 1) * 11 // 13)
            elif line == 'C':
                half = min(14, 4 + (y - 1) * 10 // 13)
            else:
                half = min(14, 2 + (y - 1) * 12 // 13)
            x0, x1 = 16 - half, 16 + half
            for x in range(x0, x1):
                # 4px 기와 낱장 결
                tx = (x + (2 if (y // 3) % 2 else 0)) % 4
                ty = y % 3
                if x == x0:
                    r[x] = rf_h if y < 13 else rf_m
                elif x == x1 - 1:
                    r[x] = rf_d
                elif x in (15, 16):
                    r[x] = rf_h if x == 15 else rf_l
                elif x < 15:
                    if ty == 2 or tx == 3:
                        r[x] = rf_m
                    elif ty == 0 and tx == 0:
                        r[x] = rf_h
                    else:
                        r[x] = rf_l
                else:
                    if ty == 2 or tx == 0:
                        r[x] = rf_d
                    else:
                        r[x] = rf_m
        elif y == 15:
            # 처마 굵은 앞 턱 + 아래 그림자(F 관문 대비 확보)
            for x in range(2, 30):
                r[x] = rf_d
        elif 16 <= y <= 29:
            # 하단: 처마 그늘 + 따뜻한 크림 반목조 벽 + 창턱 꽃상자 + 오른쪽 2px 지붕 그림자
            for x in range(4, 29):
                if x == 28:
                    # 오른쪽 벽 옆 지붕 면에 떨어지는 1px 그림자
                    if y >= 17:
                        r[x] = rf_d
                    continue
                if x == 4:
                    r[x] = tm_l if y < 27 else tm_d
                elif x == 27 or y == 29:
                    r[x] = tm_d
                elif y == 16:
                    r[x] = tm_d
                elif y == 17:
                    r[x] = wl_m if (x not in (4, 27)) else tm_d
                elif y == 28:
                    r[x] = tm_m if x < 18 else tm_d
                elif line == 'A' and (19 <= y <= 26 and 10 <= x <= 21):
                    # 2칸 아치풍 목조 다락창 + 하단 꽃상자
                    if y == 26:
                        r[x] = tm_m if x < 16 else tm_d
                    elif y == 25 and 11 <= x <= 20:
                        r[x] = 'r4' if x in (13, 18) else 'v3'
                    elif x in (10, 21, 15, 16) or y == 19:
                        r[x] = tm_d
                    elif (x, y) in ((11, 20), (12, 20), (17, 20)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m
                elif line == 'B' and (18 <= y <= 26 and 11 <= x <= 20):
                    # 고딕 아치 다락창
                    if y == 18 and x in (11, 12, 19, 20):
                        r[x] = wl_l if x < 16 else wl_m
                    elif x in (11, 20) or y == 26:
                        r[x] = tm_d
                    elif x in (15, 16) or y == 22:
                        r[x] = tm_m
                    elif (x, y) in ((13, 20), (17, 20)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m
                elif line == 'C' and (19 <= y <= 26 and 9 <= x <= 22):
                    # 넓은 통나무 가로창 + 나무 창턱
                    if y == 26:
                        r[x] = tm_l if x < 16 else tm_d
                    elif x in (9, 15, 16, 22) or y == 19:
                        r[x] = tm_d
                    elif (x, y) in ((10, 20), (17, 20)):
                        r[x] = gl_h
                    else:
                        r[x] = gl_m
                else:
                    # 좌/우 반목조 대각선 보 + 고운 점묘
                    if line == 'A' and x in (7, 24):
                        r[x] = tm_m if x < 16 else tm_d
                    else:
                        r[x] = wl_l if (x < 17 and (x + y) % 5 != 0) else wl_m
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 고품질 큰 삼각 도머 ({"green " if green else ""}{line})'}


# ---------------------------------------------------------------------------
# 4. extra.porch_roof (2x1 = 32x16 — 연속 배치 시 매끄럽게 이어지는 3/4 경사 현관/층간 덧지붕!)
# ---------------------------------------------------------------------------
def _make_extra_porch_roof(line):
    if line == 'A':
        # FSM 3·4번식 따뜻한 나무 널 덧지붕 (노치 제거, 32px 전폭 균일 경사)
        hi, lit, mid, sh, dk = 'g6', 'g5', 'g4', 'g2', 'g0'
        beam_l, beam_d = 't4', 't1'
    elif line == 'B':
        # RM2000 1번식 청석 슬레이트 띠지붕
        hi, lit, mid, sh, dk = 's3', 's2', 's2', 's1', 's0'
        beam_l, beam_d = 'a4', 'a0'
    else:
        # 통나무/너와 현관 덧지붕
        hi, lit, mid, sh, dk = 'w6', 'w5', 'w4', 'w2', 'w0'
        beam_l, beam_d = 'w4', 'w0'

    rows = []
    for y in range(16):
        r = ['.'] * 32
        if y == 0:
            pass  # 위 귀퉁이 투명(Q)
        elif y == 1:
            # 상단 벽 접합부 밝은 모서리(끊김 없이 전폭)
            for x in range(1, 31):
                r[x] = hi if x < 26 else lit
        elif 2 <= y <= 10:
            # 3/4 경사 널/기와 줄(노치 없이 매끄러운 연속 패턴!)
            step = 4 if line == 'A' else (6 if line == 'B' else 5)
            for x in range(0, 32):
                tx = x % step
                if tx == step - 1:
                    r[x] = sh if y < 8 else dk
                elif y <= 4:
                    r[x] = hi if (tx == 0) else lit
                elif y <= 7:
                    r[x] = lit if (tx == 0) else mid
                else:
                    r[x] = mid if (tx == 0) else sh
        elif y == 11:
            # 앞 처마 물받이 턱(어둡게 — CONTRAST 확보)
            for x in range(0, 32):
                r[x] = dk
        elif y == 12:
            # 처마 밑 보 그림자(연속)
            for x in range(1, 31):
                r[x] = beam_d if (x % 4 != 1) else sh
        elif y in (13, 14):
            # 양끝 + 중앙 나무 까치발 받침
            for x in (2, 3, 15, 16, 28, 29):
                r[x] = beam_l if (x in (2, 15) and y == 13) else beam_d
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 연속 경사 현관·층간 덧지붕 ({line})'}


# ---------------------------------------------------------------------------
# 5. extra.terrace (3x1 = 48x16 — 유기적 옥상 화단 + 난간, 도장 느낌 제거!)
# ---------------------------------------------------------------------------
def _make_extra_terrace(line):
    if line == 'A':
        rail_l, rail_m, rail_d = 't5', 't3', 't1'
        pot_l, pot_m, pot_d = 'r3', 'r2', 'r0'
        leaf_h, leaf_l, leaf_d = 'v6', 'v4', 'v0'
        fl = ('r4', 'r3', 'p4', 'r4')
    elif line == 'B':
        rail_l, rail_m, rail_d = 'a6', 'a4', 'a1'
        pot_l, pot_m, pot_d = 'k5', 'k3', 'k0'
        leaf_h, leaf_l, leaf_d = 'v5', 'v3', 'v0'
        fl = ('s3', 'p4', 'r4', 's3')
    else:
        rail_l, rail_m, rail_d = 'w6', 'w4', 'w1'
        pot_l, pot_m, pot_d = 'g5', 'g3', 'g0'
        leaf_h, leaf_l, leaf_d = 'v6', 'v4', 'v0'
        fl = ('r4', 'r3', 'w6', 'r4')

    # 서로 다른 폭·높이의 화단(도장 반복 제거!)
    beds = (
        [(4, 13, 1), (17, 29, 2), (33, 43, 1)] if line == 'A'
        else ([(5, 16, 2), (20, 28, 1), (32, 43, 2)] if line == 'B'
              else [(4, 15, 1), (18, 31, 2), (35, 44, 1)])
    )

    rows = []
    for y in range(16):
        r = ['.'] * 48
        # 유기적인 잎·2px 꽃송이 덩어리(y=1..6 — 1px 잡티 N 최소화)
        if 1 <= y <= 6:
            for bi, (x0, x1, tall) in enumerate(beds):
                top_y = 1 if tall == 2 else 2
                if y < top_y:
                    continue
                for x in range(x0, x1):
                    if y == top_y and (x == x0 or x == x1 - 1 or (x - x0) % 4 == 3):
                        continue
                    dx = x - x0
                    if (y == top_y + 1 and dx in (2, 3, 7, 8)) or (y == top_y + 2 and dx in (5, 6)):
                        r[x] = fl[(bi + dx // 2) % len(fl)]
                    elif y <= top_y + 1:
                        r[x] = leaf_h if x < (x0 + x1) // 2 + 1 else leaf_l
                    elif y <= 4:
                        r[x] = leaf_l if x < x1 - 2 else leaf_d
                    else:
                        r[x] = leaf_d if (dx % 4 >= 2) else leaf_l
        # 나무/석조 화분 상자 + 뒤편 난간 손잡이(y=7..10)
        if 7 <= y <= 10:
            for x in range(2, 46):
                if y == 8:
                    r[x] = rail_l if x < 34 else rail_m
                elif y == 9:
                    r[x] = rail_m if x < 30 else rail_d
            for x0, x1, _ in beds:
                for x in range(x0 + 1, x1 - 1):
                    if y == 7:
                        r[x] = pot_l if x < (x0 + x1) // 2 else pot_m
                    elif y <= 9:
                        r[x] = pot_m if (x != x1 - 2) else pot_d
                    else:
                        r[x] = pot_d
        # 앞 난간 살대(y=11..13, 2px 폭)
        if 11 <= y <= 13:
            for x in range(2, 46):
                if x in (2, 3, 44, 45) or (x % 6 in (2, 3)):
                    r[x] = rail_l if x < 24 else rail_d
                elif y == 12 and line == 'B':
                    r[x] = rail_m if x < 28 else rail_d
        if y == 14:
            for x in range(2, 46):
                r[x] = rail_d
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 유기적 옥상 화단·테라스 ({line})'}



# ---------------------------------------------------------------------------
# 6. wall.stone (5x2 = 80x32 — 버들항·FSM급 불규칙 막돌 + 깊은 아치 문 + 꽃상자 창)
# ---------------------------------------------------------------------------
def _make_wall_stone(line):
    if line == 'A':
        # 따뜻한 버들항 막돌(ashlar + stone + cobble + plaster 하이라이트)
        st = ('k0', 'k1', 'k2', 'k3', 'k4', 'p2')
        mt = 'k0'
        sh = 't1'
        dr_d, dr_m, dr_l, dr_h = 't1', 't3', 't5', 't6'
        ir_d, ir_l = 'i0', 'i2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        fl_g, fl_a, fl_b = 'v3', 'r3', 'r4'
    elif line == 'B':
        # 정교한 밝은 마름돌 석재(청석 관청/길드)
        st = ('a0', 'a1', 'a2', 'a3', 'a4', 'a6')
        mt = 'a0'
        sh = 'i0'
        dr_d, dr_m, dr_l, dr_h = 't1', 't2', 't4', 't5'
        ir_d, ir_l = 'i0', 'i3'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        fl_g, fl_a, fl_b = 'v2', 's3', 'p4'
    else:
        # 소박한 거친 들돌(촌락 기초/대장간 — 먹 w0 대신 w1 사용)
        st = ('c0', 'c1', 'c2', 'c3', 'c4', 'k4')
        mt = 'c0'
        sh = 'w1'
        dr_d, dr_m, dr_l, dr_h = 'w1', 'w2', 'w4', 'w6'
        ir_d, ir_l = 'i0', 'i2'
        gl_d, gl_m, gl_h = 's0', 's1', 'p3'
        fl_g, fl_a, fl_b = 'v4', 'r4', 'w6'

    # 불규칙 막돌 줄 패턴(16px 주기 타일링 유지하면서 크기 3~7px 다양하게 섞음 — 도장 네모돌 제거!)
    # 각 행: (y0, y1, [(x_start, x_end, tone_idx), ...])
    courses_A = [
        (3, 8,   [(0, 5, 3), (5, 11, 4), (11, 16, 2)]),
        (8, 13,  [(0, 3, 2), (3, 10, 5), (10, 14, 3), (14, 16, 2)]),
        (13, 19, [(0, 6, 4), (6, 10, 2), (10, 16, 3)]),
        (19, 24, [(0, 4, 3), (4, 9, 4), (9, 15, 2), (15, 16, 3)]),
        (24, 29, [(0, 7, 2), (7, 12, 4), (12, 16, 3)]),
    ]
    courses_B = [
        (3, 7,   [(0, 8, 4), (8, 16, 3)]),
        (7, 12,  [(0, 4, 3), (4, 12, 5), (12, 16, 3)]),
        (12, 17, [(0, 7, 4), (7, 16, 3)]),
        (17, 22, [(0, 5, 3), (5, 13, 4), (13, 16, 3)]),
        (22, 29, [(0, 8, 3), (8, 16, 2)]),
    ]
    courses_C = [
        (3, 9,   [(0, 5, 3), (5, 11, 2), (11, 16, 3)]),
        (9, 14,  [(0, 4, 3), (4, 11, 4), (11, 16, 3)]),
        (14, 20, [(0, 6, 3), (6, 12, 4), (12, 16, 3)]),
        (20, 25, [(0, 5, 3), (5, 10, 2), (10, 16, 3)]),
        (25, 29, [(0, 8, 3), (8, 16, 3)]),
    ]
    courses = courses_A if line == 'A' else (courses_B if line == 'B' else courses_C)

    def stone_bg(lx, y):
        if y == 0:
            return sh
        if y == 1:
            return mt
        if y == 2:
            # 처마 아래 3px 부드러운 드리운 그림자(AO)
            return st[1] if lx % 5 != 0 else mt
        if y >= 29:
            # 묵직한 바닥 기초 주춧돌(y=29..31)
            if y == 31:
                return mt
            if y == 29:
                return st[2] if lx % 8 != 4 else mt
            return st[1] if lx % 8 != 4 else mt
        for y0, y1, blocks in courses:
            if y0 <= y < y1:
                for x0, x1, tid in blocks:
                    if x0 <= lx < x1:
                        # 가로 줄눈(y==y1-1) & 세로 줄눈(lx==x1-1, 단 x1==16 은 x=0 과 맞닿아 경계 이음 유지)
                        if y == y1 - 1:
                            return mt
                        if lx == x1 - 1 and x1 < 16:
                            return mt
                        if lx == 0 and x0 == 0 and (y0 in (3, 13, 24)):
                            return st[1]
                        # 윗변 빛 받는 베벨(1px 밝게)
                        if y == y0:
                            return st[min(5, tid + 1)]
                        # 아랫변 살짝 어둡게
                        if y == y1 - 2 and lx > x0 + 1:
                            return st[max(1, tid - 1)]
                        return st[tid]
        return st[2]

    def cell_px(pidx, lx, y):
        # l(0) / r(4): 엇갈린 코너 마름돌(quoin) + 안쪽 막돌
        if pidx == 0:
            if y >= 2 and y <= 28:
                qrow = (y - 2) // 5
                qw = 6 if qrow % 2 == 0 else 4
                if lx < qw:
                    if y == 2 or (y - 2) % 5 == 4 or lx == qw - 1:
                        return mt
                    if lx == 0:
                        return st[1]
                    return st[5] if (y - 2) % 5 == 0 else st[4]
            return stone_bg(lx, y)
        if pidx == 4:
            if y >= 2 and y <= 28:
                qrow = (y - 2) // 5
                qw = 6 if qrow % 2 == 0 else 4
                if lx >= 16 - qw:
                    if y == 2 or (y - 2) % 5 == 4 or lx == 16 - qw:
                        return mt
                    if lx == 15:
                        return mt
                    return st[4] if (y - 2) % 5 == 0 else st[3]
            return stone_bg(lx, y)

        # w(2): 깊은 아치 돌창틀 + 반사광 유리 + 돌출 꽃상자
        if pidx == 2:
            # 아치형 돌 테두리(lx=2..13, y=5..22)
            if 5 <= y <= 22 and 2 <= lx <= 13:
                # 윗 아치 귀퉁이 둥글게
                if y == 5 and lx in (2, 3, 12, 13):
                    return stone_bg(lx, y)
                if y == 6 and lx in (2, 13):
                    return stone_bg(lx, y)
                # 바깥 돌 아치 틀
                is_frame = (
                    (y == 5 and 4 <= lx <= 11)
                    or (y == 6 and lx in (3, 4, 11, 12))
                    or (y == 7 and lx in (2, 3, 12, 13))
                    or (8 <= y <= 19 and lx in (2, 3, 12, 13))
                )
                if is_frame:
                    if lx in (7, 8) and y == 5:
                        return st[5]  # 아치 쐐기돌
                    return st[4] if lx <= 7 else st[2]
                # 창턱 + 꽃상자(y=20..22)
                if y == 20:
                    if 3 <= lx <= 12:
                        return fl_a if lx in (5, 10) else (fl_b if lx in (6, 9) else fl_g)
                    return st[4] if lx == 2 else st[1]
                if y == 21:
                    return dr_l if lx <= 7 else dr_m
                if y == 22:
                    return dr_d
                # 안쪽 깊은 창틀 그림자 + 유리 반사광 + 창살
                if y == 6 or (y == 7 and lx in (4, 11)) or lx == 4:
                    return mt  # 깊은 리세스 그림자
                if lx in (7, 8) or y == 13:
                    return dr_d
                if (lx, y) in ((5, 9), (6, 9), (5, 10), (9, 9), (10, 9), (6, 15), (10, 15)):
                    return gl_h
                return gl_m if y >= 13 else gl_d
            return stone_bg(lx, y)

        # d(3): 버들항·FSM급 묵직한 아치 석조 문 + 깊은 리세스 음영 + 쇠 경첩 + 돌 문턱!
        if pidx == 3:
            if y >= 5 and 1 <= lx <= 14:
                # 윗 아치 윤곽
                if y == 5 and lx in (1, 2, 13, 14):
                    return stone_bg(lx, y)
                if y == 6 and lx in (1, 14):
                    return stone_bg(lx, y)
                # 굵은 돌 아치 프레임(2px 폭)
                in_outer = (
                    (y == 5 and 3 <= lx <= 12)
                    or (y == 6 and 2 <= lx <= 13)
                    or (y >= 7 and 1 <= lx <= 14)
                )
                in_door = (
                    (y == 7 and 5 <= lx <= 10)
                    or (y == 8 and 4 <= lx <= 11)
                    or (9 <= y <= 28 and 3 <= lx <= 12)
                )
                # 돌 문턱 계단(y=29..31)
                if y >= 29:
                    if y == 29 and 2 <= lx <= 13:
                        return st[5] if lx <= 8 else st[3]
                    if y == 30 and 2 <= lx <= 13:
                        return st[3] if lx <= 8 else st[1]
                    return mt
                if in_door:
                    # 문틀 안쪽 1px 깊은 어둠(문짝이 벽 안으로 들어간 입체감!)
                    if (y == 7) or (y == 8 and lx in (4, 11)) or lx == 3:
                        return dr_d
                    if lx == 12:
                        return ir_d
                    # 쇠 띠 경첩 2줄(y=13, 23) + 징 광택
                    if y in (13, 23) and 4 <= lx <= 11:
                        return ir_l if lx in (5, 8, 10) else ir_d
                    # 황동 링 손잡이(오른쪽)
                    if (lx, y) in ((10, 18), (10, 19)):
                        return fl_b
                    # 나무 널빤지 세로 결(3px 폭 판자 3장)
                    if lx in (6, 9):
                        return dr_d
                    if lx in (4, 7, 10) and y > 9:
                        return dr_h if (y % 4 == 0) else dr_l
                    return dr_l if lx <= 7 else dr_m
                if in_outer:
                    if y == 5 and lx in (7, 8):
                        return st[5]  # 중앙 쐐기돌
                    if (y - 6) % 4 == 0:
                        return mt
                    return st[4] if lx <= 7 else st[2]
            return stone_bg(lx, y)

        # m(1): 순수 불규칙 막돌 벽
        return stone_bg(lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r10 버들항·FSM급 불규칙 막돌+아치문+꽃상자 ({line})'}


# ---------------------------------------------------------------------------
# 7. wall.timber (5x2 = 80x32 — 고운 회벽 점묘 + 나뭇결 보 + 열린 나무 덧문 창 + 아치 목조 문)
# ---------------------------------------------------------------------------
def _make_wall_timber(line):
    if line == 'A':
        pl_h, pl_l, pl_m, pl_s = 'p4', 'p3', 'p2', 'p0'
        tm_h, tm_l, tm_m, tm_d = 't6', 't4', 't3', 't1'
        sh_l, sh_d = 't5', 't2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        fl_g, fl_a, fl_b = 'v4', 'r3', 'r4'
        base_l, base_d = 'k3', 'k0'
    elif line == 'B':
        # B: 석회 회벽 + 어두운 목조/철제 반목조 + 청회색 덧문
        pl_h, pl_l, pl_m, pl_s = 'p4', 'a6', 'a5', 'a3'
        tm_h, tm_l, tm_m, tm_d = 't5', 't3', 't2', 't1'
        sh_l, sh_d = 's2', 's0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        fl_g, fl_a, fl_b = 'v3', 's3', 'p4'
        base_l, base_d = 'a4', 'a0'
    else:
        # C: 따뜻한 통나무 벽(FSM 3번 나무 판자벽 스타일!)
        pl_h, pl_l, pl_m, pl_s = 'w6', 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'w5', 'w3', 'w2', 'w0'
        sh_l, sh_d = 'g5', 'g1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'
        fl_g, fl_a, fl_b = 'v5', 'r4', 'w6'
        base_l, base_d = 'k3', 'k0'

    def plaster_bg(lx, y):
        if y == 0:
            return tm_d
        if y == 1:
            return tm_m if line == 'C' else pl_s
        if y == 2:
            return pl_s
        if y == 3:
            return pl_m
        if y >= 30:
            return base_d if y == 31 else (base_l if lx % 5 != 0 else base_d)
        if y == 29:
            return tm_d
        if line == 'C':
            # 통나무 가로 널빤지 결(4px 주기 + 빛받는 윗결)
            yy = (y - 3) % 4
            if yy == 3:
                return tm_d
            if yy == 0:
                return pl_h if (lx // 3) % 2 == 0 else pl_l
            return pl_l if yy == 1 else pl_m
        # A/B: 고운 회벽 점묘(2px 패치 — 1px 잡티 N 경고 방지)
        patch = ((lx // 2) * 7 + (y // 2) * 11) % 13
        if patch == 0 and y > 5:
            return pl_m
        if patch == 1 and y > 18:
            return pl_s
        return pl_l

    def cell_px(pidx, lx, y):
        # 공통 가로 목조 보(y=15,16) + 기둥 경계(lx=0,15)
        if y in (15, 16) and pidx != 3:
            return tm_l if y == 15 else tm_d
        if pidx == 0 and lx in (0, 1):
            return tm_l if (lx == 1 and y % 5 != 0) else tm_d
        if pidx == 4 and lx in (14, 15):
            return tm_d if lx == 15 else tm_m
        if lx == 0 and pidx in (1, 2, 3, 4):
            return tm_m if y % 6 != 0 else tm_d
        if lx == 15 and pidx in (0, 1, 2, 3):
            return tm_m if (pidx == 1 and y % 6 != 0) else tm_d

        # l(0) / r(4): 대각선 목조 가새(줄 B 는 고딕 다이아 격자로 A 와 구조 차별화)
        if pidx in (0, 4) and 17 <= y <= 28:
            if line == 'B':
                d1 = (y - 17) + 2
                d2 = 13 - (y - 17)
                if lx in (d1, d2):
                    return tm_m
            else:
                d = (y - 17) + 3 if pidx == 0 else 13 - (y - 17)
                if lx in (d, d + 1):
                    return tm_l if lx == d else tm_d
        if pidx == 1 and 17 <= y <= 28:
            if line == 'B':
                # B: 아래층 X자 격자 보 + 위층 아치 띠
                d1 = (y - 17) + 2
                d2 = 13 - (y - 17)
                if lx in (d1, d2):
                    return tm_m
            elif lx in (7, 8):
                return tm_l if lx == 7 else tm_d
        if pidx == 1 and line == 'B' and 4 <= y <= 14:
            if y in (8, 9) and 3 <= lx <= 12:
                return tm_m
            if lx in (4, 11):
                return tm_l

        # w(2): FSM 스타일 양옆 열린 나무 덧문 + 반사광 격자창 + 꽃상자!
        if pidx == 2 and 5 <= y <= 23 and 1 <= lx <= 14:
            if line == 'B':
                # B: 높은 고딕 석조 테두리 아치 창(A 의 사각 덧문 창과 뚜렷이 다른 실루엣)
                if 4 <= y <= 21 and 3 <= lx <= 12:
                    if y == 4 and lx in (3, 4, 11, 12):
                        return plaster_bg(lx, y)
                    if y == 5 and lx in (3, 12):
                        return plaster_bg(lx, y)
                    if (y == 4 and 5 <= lx <= 10) or (y == 5 and lx in (4, 11)) or lx in (3, 12) or y == 21:
                        return base_l if lx <= 7 else base_d
                    if lx in (7, 8) or y in (11, 16):
                        return tm_m
                    if (lx, y) in ((5, 7), (6, 7), (5, 13), (9, 13)):
                        return gl_h
                    return gl_m if y >= 12 else gl_d
                return plaster_bg(lx, y)
            # 양옆 열린 나무 덧문(lx=1..3, 12..14, y=6..19)
            if 6 <= y <= 19 and (1 <= lx <= 3 or 12 <= lx <= 14):
                if lx in (1, 14) or y in (6, 19):
                    return tm_d
                return sh_l if (y % 3 != 0) else sh_d
            # 창 위 굵은 나무 상인방(y=5)
            if y == 5 and 3 <= lx <= 12:
                return tm_l if lx < 10 else tm_d
            # 창틀 + 4분할 유리(lx=4..11, y=6..19)
            if 6 <= y <= 19 and 4 <= lx <= 11:
                if lx in (4, 11) or y in (6, 19):
                    return tm_d
                if lx in (7, 8) or y == 12:
                    return tm_m
                if (lx, y) in ((5, 8), (6, 8), (5, 9), (9, 8), (6, 14), (10, 14)):
                    return gl_h
                return gl_m if y >= 13 else gl_d
            # 창 아래 돌출 꽃상자(y=20..23, lx=3..12)
            if y == 20 and 3 <= lx <= 12:
                return fl_a if lx in (5, 10) else (fl_b if lx in (6, 9) else fl_g)
            if y == 21 and 3 <= lx <= 12:
                return tm_h if lx <= 7 else tm_m
            if y == 22 and 3 <= lx <= 12:
                return tm_m if lx <= 7 else tm_d
            if y == 23 and 4 <= lx <= 11:
                return tm_d

        # d(3): 굵은 목조 아치 포털 문 + 깊은 문틀 + 쇠 경첩 + 돌 문턱!
        if pidx == 3 and y >= 5 and 1 <= lx <= 14:
            if y >= 29:
                if y == 29 and 2 <= lx <= 13:
                    return base_l if lx <= 8 else base_d
                return base_d
            # 상단 포털 상인방(y=5..6)
            if y in (5, 6):
                return tm_h if (y == 5 and lx < 11) else tm_d
            # 양옆 굵은 문설주(lx=1..2, 13..14)
            if lx in (1, 2, 13, 14):
                return tm_l if lx in (1, 13) else tm_d
            # 문짝(lx=3..12, y=7..28)
            if y == 7 or lx == 3:
                return tm_d  # 깊은 리세스 음영
            if lx == 12:
                return 'i0'
            if y in (13, 23):
                return 'i2' if lx in (5, 8, 10) else 'i0'
            if (lx, y) in ((10, 18), (10, 19)):
                return fl_b
            if lx in (6, 9):
                return tm_d
            return tm_h if (lx in (4, 7, 10) and y % 4 == 0) else (tm_l if lx <= 7 else tm_m)

        return plaster_bg(lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r10 버들항·FSM급 반목조+덧문꽃상자+목조아치문 ({line})'}


# ---------------------------------------------------------------------------
# 8. band.trim (3x1 = 48x16 — 거대 16px 회색 띠 제거 → 슬림 들보 + 까치발 + 상하 자연 연결!)
# ---------------------------------------------------------------------------
def _make_band_trim(line):
    if line == 'A':
        top_l, top_m = 'p3', 'p2'
        bm_h, bm_l, bm_m, bm_d = 't6', 't4', 't3', 't1'
        st_l, st_d = 'k3', 'k0'
    elif line == 'B':
        top_l, top_m = 'a5', 'a4'
        bm_h, bm_l, bm_m, bm_d = 'k5', 'k4', 'k2', 'k0'
        st_l, st_d = 'a3', 'a0'
    else:
        top_l, top_m = 'w5', 'w4'
        bm_h, bm_l, bm_m, bm_d = 'w6', 'w4', 'w2', 'w0'
        st_l, st_d = 'w2', 'w0'

    rows = []
    for y in range(16):
        r = []
        for pidx in range(3):
            for lx in range(16):
                if line == 'B':
                    # B: 석조 치형 몰딩(dentil frieze) — y=0 은 2층 바닥과 매끄러운 어두운 이음
                    if y == 0:
                        ch = bm_m if lx % 4 != 2 else bm_d
                    elif y == 1:
                        ch = bm_h if lx % 4 != 2 else bm_l
                    elif y <= 4:
                        ch = bm_l if (lx % 4 != 2) else bm_d
                    elif y == 5:
                        ch = bm_d
                    elif 6 <= y <= 10:
                        if lx in (2, 3, 6, 7, 10, 11, 14, 15) and y <= 9:
                            ch = bm_h if (lx % 4 == 2 and y == 6) else bm_l
                        else:
                            ch = st_d
                    elif y <= 13:
                        ch = bm_m if y == 11 else st_l
                    else:
                        ch = st_d
                elif line == 'C':
                    # C: 이중 통나무 장선 머리(돌출 둥근 통나무 끝단)
                    if y <= 3:
                        ch = top_l if y < 3 else bm_d
                    elif 4 <= y <= 7:
                        ch = bm_h if y == 4 else (bm_l if y <= 6 else bm_d)
                    elif 8 <= y <= 13:
                        in_log = (3 <= lx <= 6) or (11 <= lx <= 14)
                        if in_log:
                            if y in (8, 13) or lx in (3, 6, 11, 14):
                                ch = bm_d
                            else:
                                ch = bm_h if y == 9 else bm_l
                        else:
                            ch = st_d if y <= 10 else st_l
                    else:
                        ch = st_d
                else:
                    # A: 상단 2층 목조 밑보(y=0 — 위 벽 바닥과 이음 A5 매끄럽게) + 얇은 회벽 스커트 + 슬림 들보 + 까치발
                    if y == 0:
                        ch = bm_m if lx % 4 != 0 else bm_d
                    elif y <= 2:
                        if (pidx == 0 and lx == 0) or (pidx == 2 and lx == 15):
                            ch = bm_d
                        elif lx in (0, 15):
                            ch = bm_m
                        else:
                            ch = top_l if y == 1 else top_m
                    elif y == 3:
                        ch = bm_d
                    elif y == 4:
                        ch = bm_h if (lx % 8 != 4) else bm_l
                    elif y <= 6:
                        ch = bm_l if (lx % 8 != 4) else bm_m
                    elif y == 7:
                        ch = bm_m
                    elif y == 8:
                        ch = bm_d
                    elif 9 <= y <= 12:
                        if lx in (2, 3, 4, 10, 11, 12):
                            ch = bm_l if (lx in (2, 10) and y <= 10) else (bm_m if y <= 11 else bm_d)
                        else:
                            ch = st_d if y <= 10 else st_l
                    else:
                        ch = st_d if (y == 15 or lx % 8 == 4) else st_l
                r.append(ch)
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 슬림 들보·까치발 층 띠 ({line})'}


# ---------------------------------------------------------------------------
# 9. roof.hip / roof.hip.low / roof.hip.tall (버들항급 엇갈린 둥근 낱장 기와 + 빛받는 모임 사선!)
# ---------------------------------------------------------------------------
def _make_hip_roof(line, rows_h):
    H = rows_h * 16
    if line == 'A':
        hi, lit, mid, sh, dk, edge = 'r4', 'r3', 'r2', 'r1', 'r0', 'r0'
    elif line == 'B':
        hi, lit, mid, sh, dk, edge = 's3', 's2', 's1', 's0', 'i0', 'i0'
    else:
        hi, lit, mid, sh, dk, edge = 'g6', 'g5', 'g4', 'g2', 'g1', 'g0'

    cut_top = min(H - 16, 14 if rows_h == 2 else (18 if rows_h == 3 else 22))
    lower_y = H - 16

    def tile_px(gx, y, shade=False):
        if y <= 1:
            return hi if ((gx + 1) % 4 != 0) else lit
        if y == 2:
            return lit if ((gx + 1) % 4 != 0) else mid
        if y == 3:
            return sh
        if y >= H - 3:
            return edge if y == H - 1 else (dk if gx % 4 != 2 else edge)

        lower = y >= lower_y
        step_y = 5 if line != 'C' else 6
        row_i = (y - 4) // step_y
        yy = (y - 4) % step_y
        if line == 'A':
            # 버들항식 엇갈린 테라코타 둥근 기와(x=0/15 모두 타일 몸통 — S 가로 이음 0)
            tx = (gx + 1 + (2 if row_i % 2 else 0)) % 4
            var = ((gx // 4) + row_i * 3) % 3
            is_gap = (yy == step_y - 1) or (tx == 3 and yy >= 1)
            is_hi = (yy == 0 and tx == 1 and var == 0)
            if shade:
                return edge if (lower and is_gap) else (dk if (is_gap or lower) else sh)
            if lower:
                return dk if is_gap else (mid if (yy <= 1 and tx in (0, 1)) else sh)
            if is_gap:
                return sh
            if is_hi:
                return hi
            return lit if (tx in (0, 1) and (yy <= 2 or var != 2)) else mid
        if line == 'B':
            # 청석 8px 엇갈린 슬레이트 판(x=0/15 경계 안전)
            tx8 = (gx + 2 + (4 if row_i % 2 else 0)) % 8
            is_gap = (yy == step_y - 1) or (tx8 == 4)
            is_hi = (yy == 0 and tx8 in (1, 2))
            if shade:
                return edge if (is_gap or lower) else sh
            if lower:
                return dk if is_gap else (mid if is_hi else sh)
            return sh if is_gap else (hi if is_hi else (lit if yy <= 2 else mid))
        # C: 너와 나무 판자 지붕(줄마다 어긋난 나뭇결)
        tx4 = (gx + (2 if row_i % 2 else 0)) % 4
        is_gap = (yy == step_y - 1) or (tx4 == 3 and yy >= 2)
        if shade:
            return dk if (is_gap or lower) else sh
        if lower:
            return dk if is_gap else (mid if (yy == 0 and tx4 == 1) else sh)
        return sh if is_gap else (hi if (yy == 0 and tx4 == 1) else (lit if tx4 in (0, 1) else mid))

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
                    r[x] = tile_px(x, y, shade=False)
        for x in range(16):
            r[32 + x] = tile_px(x, y, shade=False)
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
                    r[48 + x] = tile_px(x, y, shade=(x > hip))
        rows.append(r)
    return _grid_tokens(rows), {'note': f'style-r10 버들항급 모임지붕 {rows_h}행 ({line})'}


# ---------------------------------------------------------------------------
# 10. wall.shop (5x2 = 80x32 — 깊은 포털 상점 문 + 진열 쇼윈도 + 회벽 점묘·목재 허리벽)
# ---------------------------------------------------------------------------
def _make_wall_shop(line):
    if line == 'A':
        pl_l, pl_m, pl_s = 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 't6', 't4', 't3', 't1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        good_a, good_b, good_c = 'r4', 'r3', 'g5'
        st_l, st_d = 'k3', 'k0'
    elif line == 'B':
        pl_l, pl_m, pl_s = 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'k5', 'k4', 'k2', 'k0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        good_a, good_b, good_c = 's3', 'k5', 'i3'
        st_l, st_d = 'a4', 'a0'
    else:
        pl_l, pl_m, pl_s = 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'w6', 'w4', 'w2', 'w1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'
        good_a, good_b, good_c = 'g6', 'r4', 'v5'
        st_l, st_d = 'k3', 'k0'

    def bg_px(lx, y):
        if y == 0:
            return tm_d
        if y == 1:
            return tm_m if line == 'C' else pl_s
        if y == 2:
            return pl_s
        if y == 3:
            return pl_m
        if line == 'C':
            yy = (y - 3) % 4
            if yy == 3:
                return tm_d
            return pl_l if yy in (0, 1) else pl_m
        if line == 'B':
            row_i = y // 5
            bx = (lx + 3 * (row_i % 2)) % 8
            if y % 5 == 4 or bx == 7:
                return st_d
            return pl_l if (y % 5 == 0 or bx == 0) else pl_m
        # A: 2px 유기적 회벽 점묘(wall.timber 와 동일 질감)
        patch = ((lx // 2) * 7 + (y // 2) * 11) % 13
        if patch == 0 and y > 5:
            return pl_m
        if patch == 1 and y > 16:
            return pl_s
        return pl_l

    def cell_px(pidx, lx, y):
        if y == 0:
            return tm_d
        if y >= 30:
            if pidx == 3 and 2 <= lx <= 13:
                return st_l if y == 30 else st_d
            return st_d if y == 31 else (st_l if lx % 4 != 0 else st_d)
        # 조각 가로 경계 통일(J 이음 안전)
        if lx in (0, 15):
            if pidx == 0 and lx == 0:
                return tm_d
            if pidx == 4 and lx == 15:
                return tm_d
            return tm_m if y % 5 != 0 else tm_d

        # l(0), r(4): 굵은 코너 기둥 + 대각 가새 + 하단 목재 허리벽(wainscotting)
        if pidx in (0, 4):
            if (pidx == 0 and lx == 1) or (pidx == 4 and lx == 14):
                return tm_l if (pidx == 0 and y % 4 != 0) else tm_m
            if y in (4, 15, 22):
                return tm_l if y == 22 else tm_d
            if y > 22:
                if y == 23:
                    return tm_d
                if y == 29:
                    return tm_d
                if lx % 4 == 0:
                    return tm_d
                return tm_l if lx % 4 == 1 else tm_m
            if 5 <= y <= 14:
                if line == 'B':
                    if lx in (5, 10) or y == 9:
                        return tm_m
                else:
                    d = (y - 5) + 3 if pidx == 0 else 12 - (y - 5)
                    if lx in (d, d + 1):
                        return tm_l if lx == d else tm_d
            return bg_px(lx, y)

        # d(3): 깊은 포털 상점 문 — 상단 격자 채광 트랜섬 + 목조 문설주 + 패널 문짝 + 쇠 경첩·황동 손잡이 + 돌 문턱!
        if pidx == 3:
            if y == 29:
                return st_l if 2 <= lx <= 13 else tm_d
            if y in (3, 4):
                return tm_h if (y == 3 and lx < 12) else tm_d
            if lx in (1, 2, 13, 14):
                return tm_l if lx in (1, 13) else tm_d
            # 상단 채광 트랜섬(y=5..8, lx=3..12)
            if 5 <= y <= 8 and 3 <= lx <= 12:
                if lx in (3, 12) or y == 5:
                    return tm_d
                if lx in (6, 9):
                    return tm_m
                if (lx, y) in ((4, 6), (5, 6), (7, 6), (10, 6)):
                    return gl_h
                return gl_m if y >= 7 else gl_d
            # 트랜섬 밑 굵은 문 상인방(y=9..10)
            if y in (9, 10) and 2 <= lx <= 13:
                return tm_h if (y == 9 and lx < 11) else tm_d
            # 문짝(y=11..28, lx=3..12)
            if 11 <= y <= 28 and 3 <= lx <= 12:
                if y == 11 or lx == 3:
                    return tm_d  # 깊은 안쪽 그림자
                if lx == 12:
                    return 'i0'
                # 문 상부 4분할 작은 유리창(y=13..18, lx=5..10)
                if 13 <= y <= 18 and 5 <= lx <= 10:
                    if lx in (5, 10) or y in (13, 18):
                        return tm_d
                    if lx == 7 or y == 15:
                        return tm_m
                    if (lx, y) in ((6, 14), (8, 14)):
                        return gl_h
                    return gl_m if y >= 16 else gl_d
                # 하부 목재 패널 + 쇠 띠 경첩 + 황동 손잡이
                if y in (20, 26):
                    return 'i2' if lx in (5, 8, 10) else 'i0'
                if (lx, y) in ((10, 22), (10, 23)):
                    return good_a
                if lx in (6, 9):
                    return tm_d
                return tm_h if (lx in (4, 7, 10) and y % 4 == 0) else (tm_l if lx <= 7 else tm_m)
            return bg_px(lx, y)

        # w(2), m(1): 넓은 쇼윈도 진열창 + 따뜻한 실내 진열 상품 + 목재 선반 + 하단 나무 허리벽
        if pidx in (1, 2):
            if y in (3, 4):
                return tm_h if (y == 3 and lx < 12) else tm_d
            if y in (21, 22):
                return tm_h if y == 21 else tm_d
            if y > 22:
                if y == 29:
                    return tm_d
                if lx in (1, 14):
                    return tm_d
                if y == 23:
                    return tm_m
                if lx % 4 == 0:
                    return tm_d
                return tm_l if lx % 4 == 1 else tm_m
            if 5 <= y <= 20 and 1 <= lx <= 14:
                if lx in (1, 14) or y in (5, 20):
                    return tm_d
                if line == 'B':
                    # B: 석조 아치 진열창(상단 귀퉁이 돌 아치)
                    if y == 6 and lx in (2, 13):
                        return tm_l if lx == 2 else tm_d
                    if lx in (7, 8) or y == 13:
                        return tm_m
                else:
                    if lx in (6, 9) or y == 12:
                        return tm_m
                # 실내 진열 선반(y=19) + 상품 실루엣(y=16..18)
                if y == 19:
                    return tm_l if lx <= 8 else tm_m
                if pidx == 2 and 16 <= y <= 18 and lx in (3, 4, 7, 8, 11, 12):
                    if y == 16 and lx in (3, 7, 11):
                        return good_a
                    return good_b if lx in (3, 4, 11, 12) else good_c
                if pidx == 1 and 16 <= y <= 18 and lx in (4, 5, 10, 11):
                    return good_a if y == 16 else good_c
                # 유리 반사광
                if (lx, y) in ((3, 7), (4, 7), (3, 8), (10, 7), (4, 14), (11, 14)):
                    return gl_h
                return gl_m if y >= 13 else gl_d
            return bg_px(lx, y)

        return bg_px(lx, y)

    rows = [[cell_px(pidx, lx, y) for pidx in range(5) for lx in range(16)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r10 깊은 포털 상점 문 + 쇼윈도 벽 ({line})'}


# ---------------------------------------------------------------------------
# 11. 박공·외쪽 지붕 공통 버들항급 세로 사면 기와 셰이더(tileable y/xy 무이음 + A12 좌명/우암 보장)
# ---------------------------------------------------------------------------
def _gf_pal(line):
    if line == 'A':
        return ('r4', 'r3', 'r2', 'r1', 'r0', 'r0')
    if line == 'B':
        return ('s3', 's2', 's1', 's0', 'i0', 'i0')
    return ('g6', 'g5', 'g4', 'g2', 'g1', 'g0')


def _gf_tile_px(line, x, y, shade=False):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)
    # 가로(x)·세로(y) 모두 x=15|0(xx=1|2) 및 y=15|0 경계가 안쪽 타일 줄눈과 같은 부드러운 1단계 전이 → S 이음 0!
    col = (x + 2) // 4
    xx = (x + 2) % 4
    yy = (y + 2 * (col % 2)) % 4
    if line == 'A':
        is_gap = (yy == 3) or (xx == 3)
        is_hi = (yy == 1 and xx == 0 and (col % 2 == 0))
        if shade:
            return dk if is_gap else (mid if (yy == 1 and xx == 0 and col % 2 == 0) else sh)
        if is_gap:
            return mid
        if is_hi:
            return hi
        return lit if (yy <= 2 and xx <= 2) else mid
    if line == 'B':
        # 청석 8px 엇갈린 슬레이트 판(가로 x=0/15, 세로 y=0/15 모두 몸통 → S 이음 0!)
        row_i = (y + 1) // 4
        yy4 = (y + 1) % 4
        xx8 = (x + 2 + 4 * (row_i % 2)) % 8
        is_gap = (yy4 == 3) or (xx8 == 7)
        is_hi = (yy4 == 1 and xx8 in (1, 2))
        if shade:
            return dk if is_gap else sh
        if is_gap:
            return mid
        return hi if is_hi else lit
    # C: 너와 나무 판자(가로 x=15(xx=1)|x=0(xx=2) 모두 몸통, 좌 밝은 g5/g4, 우 어두운 g2/g1)
    is_gap = (yy == 3) or (xx == 3)
    if shade:
        return dk if is_gap else (mid if (yy == 1 and xx == 0) else sh)
    if is_gap:
        return sh
    return hi if (yy == 1 and xx == 0) else (lit if xx <= 2 else mid)


def _gf_ridge_body(line, x, y, c):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)
    if x < c:
        return _gf_tile_px(line, x, y, shade=False)
    if x == c:
        return hi if ((y + 1) % 4 != 3) else lit
    if x == c + 1:
        return lit if ((y + 1) % 4 != 3) else mid
    if x == c + 2:
        return dk
    return _gf_tile_px(line, x, y, shade=True)


# ---------------------------------------------------------------------------
# 12. roof.gf.slope (7x1 = 112x16: l, ml, k, k2, mr, r)
# ---------------------------------------------------------------------------
def _make_roof_gf_slope(line):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)

    def px(x, y):
        if x < 16:
            return dk if x == 0 else (sh if x == 1 else _gf_tile_px(line, x, y, False))
        if x < 32:
            return _gf_tile_px(line, x, y, False)
        if x < 48:
            return _gf_ridge_body(line, x, y, 39)
        if x < 80:
            return _gf_ridge_body(line, x, y, 63)
        if x < 96:
            return _gf_tile_px(line, x, y, True)
        return dk if x >= 110 else _gf_tile_px(line, x, y, True)

    rows = [[px(x, y) for x in range(112)] for y in range(16)]
    return _grid_tokens(rows), {'note': f'style-r10 버들항급 박공 사면 띠 ({line})'}


# ---------------------------------------------------------------------------
# 13. roof.gf.back (7x2 = 112x32: b4[0:64,0:32], v3[64:112,0:16])
# ---------------------------------------------------------------------------
def _make_roof_gf_back(line):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)
    edge_v3 = [23, 21, 20, 18, 17, 15, 14, 12, 11, 9, 8, 6, 5, 3, 2, 0]

    def b4(x, y):
        lo, hi_x = 31 - y, 32 + y
        if x < lo or x > hi_x:
            return '.'
        if x == lo or x == hi_x:
            return dk
        if x == lo + 1:
            return hi if y < 28 else lit
        if x == hi_x - 1:
            return sh if x > 33 else _gf_ridge_body(line, x, y, 31)
        return _gf_ridge_body(line, x, y, 31)

    def v3(x, y):
        if y >= 16:
            return '.'
        lo, hi_x = edge_v3[y], 47 - edge_v3[y]
        if x < lo or x > hi_x:
            return '.'
        plo = edge_v3[y - 1] - 1 if y else lo
        if x <= max(lo, plo) or x >= min(hi_x, 47 - edge_v3[y - 1] + 1 if y else hi_x):
            return dk
        if x == 0 or x >= 46:
            return dk
        if x == 1:
            return sh
        return _gf_ridge_body(line, x, y, 23)

    rows = [[b4(x, y) if x < 64 else v3(x - 64, y) for x in range(112)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r10 버들항급 박공 뒤끝·골 ({line})'}


# ---------------------------------------------------------------------------
# 14. roof.lean.side (7x1 = 112x16: lb2, hi, m, lo, lf2)
# ---------------------------------------------------------------------------
def _make_roof_lean_side(line):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)
    if line == 'A':
        pl_l, pl_m, tm_l, tm_d = 'p3', 'p1', 't4', 't1'
    elif line == 'B':
        pl_l, pl_m, tm_l, tm_d = 'a5', 'a3', 'a2', 'a0'
    else:
        pl_l, pl_m, tm_l, tm_d = 'w5', 'w3', 'w4', 'w1'

    def lb2(x, y):
        t = x // 3
        if y < t:
            return '.'
        if y == t or x in (0, 31):
            return dk
        if y == t + 1:
            return lit
        return _gf_tile_px(line, x, y, shade=True)

    def lf2(x, y):
        e = 2 + x // 3
        if y < e:
            return dk if x in (0, 31) else _gf_tile_px(line, x, y, shade=True)
        if y == e:
            return dk
        if y == e + 1 or y == 15:
            return tm_d
        if x >= 30:
            return tm_d
        if x in (0, 15, 16, 28, 29):
            return tm_l if x in (0, 15, 28) else tm_d
        if line == 'C':
            return tm_d if y % 3 == 0 else (pl_l if y % 3 == 1 else pl_m)
        if line == 'B':
            return tm_d if (y % 4 == 0 or (x + 2 * (y // 4)) % 6 == 0) else pl_l
        patch = ((x // 2) * 5 + (y // 2) * 7) % 9
        return pl_m if (y == e + 2 or y == 14 or patch == 0) else pl_l

    def px(x, y):
        if x < 32:
            return lb2(x, y)
        if x < 48:
            return dk if x == 32 else _gf_tile_px(line, x, y, shade=True)
        if x < 64:
            return _gf_tile_px(line, x, y, shade=True)
        if x < 80:
            return dk if x == 79 else (sh if x == 78 else _gf_tile_px(line, x, y, shade=True))
        return lf2(x - 80, y)

    rows = [[px(x, y) for x in range(112)] for y in range(16)]
    return _grid_tokens(rows), {'note': f'style-r10 버들항급 옆 외쪽 헛간 지붕 ({line})'}


# ---------------------------------------------------------------------------
# 15. gable.front (7x2 = 112x32: g3[0:48,0:16], g4[48:112,0:32])
# ---------------------------------------------------------------------------
def _make_gable_front(line):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)
    if line == 'A':
        pl_l, pl_m, pl_s = 'p3', 'p2', 'p1'
        tm_h, tm_l, tm_m, tm_d = 't6', 't4', 't3', 't1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
        fl_g, fl_a = 'v3', 'r4'
    elif line == 'B':
        pl_l, pl_m, pl_s = 'a5', 'a4', 'a2'
        tm_h, tm_l, tm_m, tm_d = 'k5', 'k4', 'k2', 'k0'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
        fl_g, fl_a = 'a3', 's3'
    else:
        pl_l, pl_m, pl_s = 'w5', 'w4', 'w2'
        tm_h, tm_l, tm_m, tm_d = 'w6', 'w4', 'w2', 'w1'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'
        fl_g, fl_a = 'v5', 'r4'

    g3_el = [25, 24, 22, 21, 19, 18, 16, 15, 13, 12, 10, 9, 7, 6, 4, 2]

    def gable_px(x, y, w, el, beam_y, is_g4):
        er = w - 1 - el
        # 빗변 바깥: 왼쪽 밝은 사면 · 오른쪽 어두운 사면
        if x < el - 2:
            return dk if x == 0 else (sh if x == 1 else _gf_tile_px(line, x, y, False))
        if x > er + 2:
            return dk if x >= w - 2 else _gf_tile_px(line, x, y, True)
        # 2px 바지보드(왼쪽 빛받는 하이라이트 + 어두운 테두리)
        if x == el - 2:
            return hi if line == 'A' else lit
        if x == er + 2:
            return dk
        if x in (el - 1, er + 1):
            return tm_d

        # 하단 벽 들보 이음(맨 아래 2행)
        if y == beam_y:
            return tm_h if (x % 6 != 0) else tm_l
        if y > beam_y:
            return tm_d

        c = w // 2
        # 박공 벽면 내부 질감
        if line == 'A':
            # A: 반목조 튜더 박공 — 마룻대공 + 깃보 + 대각 버팀대 + 회벽 점묘 + g4 격자 다락창·꽃상자
            if is_g4 and 9 <= y <= 20 and 27 <= x <= 36:
                if y == 9 and 28 <= x <= 35:
                    return tm_l if x < 33 else tm_d
                if 10 <= y <= 18 and 28 <= x <= 35:
                    if x in (28, 35) or y in (10, 18):
                        return tm_d
                    if x in (31, 32) or y == 14:
                        return tm_m
                    if (x, y) in ((29, 11), (30, 11), (33, 11), (29, 15)):
                        return gl_h
                    return gl_m if y >= 15 else gl_d
                if y == 19 and 27 <= x <= 36:
                    return fl_a if x in (29, 34) else fl_g
                if y == 20 and 27 <= x <= 36:
                    return tm_m if x <= 32 else tm_d
            # 깃보(collar) + 마룻대공(king post) + V 버팀대
            collar_y = 21 if is_g4 else 9
            if y == collar_y:
                return tm_l
            if y == collar_y + 1:
                return tm_d
            if x in (c - 1, c) and ((not is_g4 and y >= 5) or (is_g4 and y >= 21)):
                return tm_l if x == c - 1 else tm_d
            if is_g4 and 22 <= y <= 29:
                off = y - 22
                if x in (c - 4 - off, c - 3 - off, c + 2 + off, c + 3 + off):
                    return tm_m
            if x in (el, el + 1):
                return pl_s
            if x == er:
                return pl_m
            patch = ((x // 2) * 7 + (y // 2) * 11) % 13
            return pl_m if (patch == 0 or y == beam_y - 1) else pl_l
        if line == 'B':
            # B: 마름돌 석조 박공 + 뾰족 고딕 다락창
            if is_g4 and 9 <= y <= 22 and 28 <= x <= 35:
                half = {9: 0, 10: 1, 11: 2}.get(y, 3)
                if abs(x - 31.5) <= half + 1:
                    if y == 22 or y == 9 or abs(x - 31.5) >= half:
                        return tm_h if x <= 31 else tm_d
                    if (x, y) in ((30, 13), (31, 13), (30, 17)):
                        return gl_h
                    return gl_m if y >= 16 else gl_d
            if x in (el, er):
                return tm_h if x == el else tm_d
            row_i = y // 5
            bx = (x + 3 * (row_i % 2)) % 8
            if y % 5 == 4 or bx == 7:
                return tm_d
            return pl_l if (y % 5 == 0 or bx == 0) else pl_m
        # C: 세로 나무 판자(board-and-batten) 박공 + 둥근 다락창
        if is_g4 and 10 <= y <= 19 and 28 <= x <= 35:
            if x in (28, 35) or y in (10, 19):
                return tm_d
            if x in (31, 32) or y == 14:
                return tm_m
            if (x, y) in ((29, 11), (30, 11), (29, 16)):
                return gl_h
            return gl_m if y >= 15 else gl_d
        if x % 4 == 0:
            return tm_d
        return pl_l if x % 4 == 1 else pl_m

    def px(x, y):
        if x < 48:
            if y >= 16:
                return '.'
            return gable_px(x, y, 48, g3_el[y], 14, False)
        return gable_px(x - 48, y, 64, 33 - y, 30, True)

    rows = [[px(x, y) for x in range(112)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r10 버들항·FSM급 반목조/석조/통나무 앞 박공 ({line})'}


# ---------------------------------------------------------------------------
# 16. gable.step (10x2 = 160x32: g5[0:80,0:32], b5[80:160,0:32])
# ---------------------------------------------------------------------------
def _make_gable_step(line):
    hi, lit, mid, sh, dk, edge = _gf_pal(line)
    if line == 'A':
        st_h, st_l, st_m, st_d = 'k5', 'k4', 'k2', 'k0'
        wa_l, wa_m = 'p2', 'k3'
        gl_d, gl_m, gl_h = 's0', 's2', 'p4'
    elif line == 'B':
        st_h, st_l, st_m, st_d = 'a6', 'a5', 'a3', 'a0'
        wa_l, wa_m = 'k4', 'a4'
        gl_d, gl_m, gl_h = 's0', 's2', 's3'
    else:
        st_h, st_l, st_m, st_d = 'k4', 'k3', 'k1', 'k0'
        wa_l, wa_m = 'w4', 'k2'
        gl_d, gl_m, gl_h = 's0', 's2', 'p3'

    top = [0, 6, 12, 18, 24]
    el = [34, 26, 18, 9, 0]

    def level(x):
        for k in range(5):
            if el[k] <= x <= 79 - el[k]:
                return k
        return 4

    def slope_bg(x, y):
        if x == 0:
            return dk
        if x == 1:
            return sh
        if x >= 78:
            return dk
        return _gf_ridge_body(line, x, y, 39)

    # 불규칙 막돌 코스(wall.stone 과 어울리는 자연 석재)
    stone_rows = [
        (0, 5, [0, 6, 13, 19, 25, 32, 39, 45, 52, 59, 65, 72, 80]),
        (5, 6, [0, 4, 11, 17, 24, 30, 36, 43, 50, 56, 63, 70, 80]),
        (11, 5, [0, 7, 14, 20, 27, 34, 41, 47, 54, 61, 68, 74, 80]),
        (16, 6, [0, 5, 11, 18, 25, 31, 38, 44, 51, 58, 64, 71, 80]),
        (22, 5, [0, 6, 13, 21, 27, 33, 40, 47, 53, 60, 67, 73, 80]),
        (27, 5, [0, 5, 12, 18, 24, 31, 38, 45, 52, 59, 66, 73, 80]),
    ]

    def fieldstone(x, y):
        for ci, (y0, h, cuts) in enumerate(stone_rows):
            if y0 <= y < y0 + h:
                rr = y - y0
                if rr == h - 1:
                    return st_d
                for idx in range(len(cuts) - 1):
                    if cuts[idx] <= x < cuts[idx + 1]:
                        if x == cuts[idx]:
                            return st_d
                        v = (idx * 5 + ci * 3) % 4
                        if rr == 0:
                            return st_h if v != 3 else st_l
                        if v == 0:
                            return wa_l
                        if v == 1:
                            return st_l
                        return wa_m if v == 2 else st_m
        return st_m

    def g5(x, y):
        k = level(x)
        t = top[k]
        if y < t:
            return slope_bg(x, y)
        if line == 'C':
            # C: 통나무·세로 널 계단 박공(A 의 막돌과 완전히 다른 목조 구조 — R 통과)
            if y in (t, t + 1):
                return 'w6' if y == t else 'w4'
            if y == t + 2:
                return 'w1'
            if y == 30:
                return 'w5'
            if y == 31:
                return 'w1'
            # 중앙 사각 덧문 다락창(y=10..21, x=34..45)
            if 10 <= y <= 21 and 34 <= x <= 45:
                if y == 10 or y == 21 or x in (34, 45):
                    return 'w1'
                if x in (35, 36, 43, 44):
                    return 'g5' if y % 3 != 0 else 'g1'
                if x in (37, 42):
                    return 'w1'
                if x in (39, 40) or y == 15:
                    return 'w3'
                if (x, y) in ((38, 12), (41, 12)):
                    return gl_h
                return gl_m if y >= 16 else gl_d
            # 가로 목조 보(y=23, 24) + 세로 널빤지
            if y in (23, 24):
                return 'w5' if y == 23 else 'w1'
            if x in (el[k], 79 - el[k]):
                return 'w5' if x == el[k] else 'w1'
            if x % 4 == 0:
                return 'w1'
            return 'w5' if x % 4 == 1 else 'w4'
        if y == t:
            return st_h  # 갓돌 밝은 윗면
        if y == t + 1:
            return st_l if x < 44 else st_m
        if y == t + 2:
            return st_d
        if y == 30:
            return st_l if x % 6 != 0 else st_m
        if y == 31:
            return st_d
        # 중앙 아치 다락창 + 키스톤 + 창턱(y=9..22, x=35..44)
        if 9 <= y <= 22 and 35 <= x <= 44:
            if y == 22:
                return st_h if x <= 40 else st_m
            half = {9: 1, 10: 2, 11: 3}.get(y, 3)
            lo, hi_x = 39 - half, 40 + half
            if lo - 1 <= x <= hi_x + 1:
                if x in (lo - 1, hi_x + 1) or y == 9:
                    return st_h if (x == lo - 1 or (y == 9 and x in (39, 40))) else st_d
                if x in (lo, hi_x):
                    return st_d
                if x in (39, 40) and y >= 12:
                    return st_m if y == 16 else (gl_h if (x == 39 and y in (13, 14)) else gl_m)
                if (x, y) in ((37, 13), (38, 13), (38, 14), (41, 13)):
                    return gl_h
                return gl_m if y >= 16 else gl_d
        if x == el[k]:
            return st_h
        if x == 79 - el[k]:
            return st_d
        return fieldstone(x, y)

    def b5(x, y):
        k = level(x)
        t = top[k]
        if y < t:
            return '.'
        if y == t:
            return st_h
        if y == t + 1:
            return st_l if x < 44 else st_m
        if y in (t + 2, t + 3):
            if x == el[k]:
                return st_h
            if x == 79 - el[k]:
                return st_d
            return st_m if y == t + 2 else st_d
        if y == t + 4:
            return dk
        return slope_bg(x, y)

    rows = [[g5(x, y) if x < 80 else b5(x - 80, y) for x in range(160)] for y in range(32)]
    return _grid_tokens(rows), {'note': f'style-r10 불규칙 석조 계단 박공 + 버들항 지붕 ({line})'}


def _bind(fn, *args):
    def _f():
        return fn(*args)
    _f.__name__ = f'{fn.__name__}_{"_".join(str(a) for a in args)}'
    return _f


CANDIDATES = {
    # 옛 style-r5/r9 핵심 베이스 + 상점·박공·외쪽 지붕까지 style-r10 에서 전면 리메이크(override)!
    'wall.stone': {ln: _bind(_make_wall_stone, ln) for ln in ('A', 'B', 'C')},
    'wall.timber': {ln: _bind(_make_wall_timber, ln) for ln in ('A', 'B', 'C')},
    'wall.shop': {ln: _bind(_make_wall_shop, ln) for ln in ('A', 'B', 'C')},
    'band.trim': {ln: _bind(_make_band_trim, ln) for ln in ('A', 'B', 'C')},
    'roof.hip': {ln: _bind(_make_hip_roof, ln, 3) for ln in ('A', 'B', 'C')},
    'roof.hip.low': {ln: _bind(_make_hip_roof, ln, 2) for ln in ('A', 'B', 'C')},
    'roof.hip.tall': {ln: _bind(_make_hip_roof, ln, 4) for ln in ('A', 'B', 'C')},
    'roof.gf.slope': {ln: _bind(_make_roof_gf_slope, ln) for ln in ('A', 'B', 'C')},
    'roof.gf.back': {ln: _bind(_make_roof_gf_back, ln) for ln in ('A', 'B', 'C')},
    'roof.lean.side': {ln: _bind(_make_roof_lean_side, ln) for ln in ('A', 'B', 'C')},
    'gable.front': {ln: _bind(_make_gable_front, ln) for ln in ('A', 'B', 'C')},
    'gable.step': {ln: _bind(_make_gable_step, ln) for ln in ('A', 'B', 'C')},
    # style-r10 신규 쯔꾸르 지붕·처마 부품 6종
    'roof.flat': {ln: _bind(_make_roof_flat, ln) for ln in ('A', 'B', 'C')},
    'roof.hip.green': {ln: _bind(_make_roof_hip_green, ln) for ln in ('A', 'B', 'C')},
    'extra.gable_dormer': {ln: _bind(_make_gable_dormer, ln, False) for ln in ('A', 'B', 'C')},
    'extra.gable_dormer.green': {ln: _bind(_make_gable_dormer, ln, True) for ln in ('A', 'B', 'C')},
    'extra.porch_roof': {ln: _bind(_make_extra_porch_roof, ln) for ln in ('A', 'B', 'C')},
    'extra.terrace': {ln: _bind(_make_extra_terrace, ln) for ln in ('A', 'B', 'C')},
}
