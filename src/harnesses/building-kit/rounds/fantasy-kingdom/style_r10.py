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


def _bind(fn, *args):
    def _f():
        return fn(*args)
    _f.__name__ = f'{fn.__name__}_{"_".join(str(a) for a in args)}'
    return _f


CANDIDATES = {
    'roof.hip.low': dict(R4.CANDIDATES['roof.hip.low']),
    'roof.hip.tall': dict(R3.CANDIDATES['roof.hip.tall']),
    'roof.flat': {ln: _bind(_make_roof_flat, ln) for ln in ('A', 'B', 'C')},
    'roof.hip.green': {ln: _bind(_make_roof_hip_green, ln) for ln in ('A', 'B', 'C')},
    'extra.gable_dormer': {ln: _bind(_make_gable_dormer, ln, False) for ln in ('A', 'B', 'C')},
    'extra.gable_dormer.green': {ln: _bind(_make_gable_dormer, ln, True) for ln in ('A', 'B', 'C')},
    'extra.porch_roof': {ln: _bind(_make_extra_porch_roof, ln) for ln in ('A', 'B', 'C')},
    'extra.terrace': {ln: _bind(_make_extra_terrace, ln) for ln in ('A', 'B', 'C')},
}
