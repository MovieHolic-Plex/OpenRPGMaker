"""조선 실내 구조 키트: 바닥·천장 오토타일·벽면·창·문·기둥·들보·계단·단.

방은 평면(inb_room.py)에서 유도한다 — 벽을 손으로 그리지 않는다.
  * 막힌 칸('#') 바로 아래 두 줄 = 벽면(못 걸음), 막힌 칸 중 방에 닿은 칸 = 천장 띠(처마 서까래 끝), 나머지는 어둠.
  * 천장은 8방향 블롭 47종 지형(in_ceil47, 막힘). 바닥은 재질마다 평면 변형 4종 + 벽 밑 그늘 변형.
  * 벽면은 1×2 칸 조각(가로로 이어 쓴다): 재질 5종(회벽·목재·황토·돌·창호) × 끝(m 가운데·l 왼끝·r 오른끝·lr 양끝).
조각 크기를 바꿔 다시 조립할 수 있다(궁 내부가 이 키트 위에 올라간다): 벽면은 폭 제한이 없고, 기둥·들보·단은 칸 단위다.
"""
from inb_tk import *
import water_blob as WB

# ----------------------------------------------------------------------------------------------------- 바닥
FLOORS = ('ondol', 'maru', 'dirt', 'stone')


def _floor(kind, v):
    cv = Cv(T, T)
    if kind == 'ondol':      # 온돌 장판: 기름먹인 한지 장판, 16px 한 장씩 이음
        e = ER
        for y in range(T):
            for x in range(T):
                q = rnd(x, y, 310 + v)
                c = e[5]
                if q < 0.05: c = e[4]
                elif q > 0.975: c = e[6]
                cv.put(x, y, c)
        for k in range(2):                                           # 가로로 긴 결 두 가닥
            x0, y0 = hsh(k, v, 11) % 10, 2 + hsh(v, k, 13) % 12
            for i in range(4):
                cv.put(x0 + i, y0, e[6] if (k + v) % 2 else e[4])
        if v in (1, 3): cv.hl(0, T, T - 1, e[4])                       # 장판 이음(아래)
        if v in (2, 3): cv.vl(T - 1, 0, T, e[4])                       # 장판 이음(오른쪽)
    elif kind == 'maru':     # 마루: 4px 널, 줄마다 끝 이음이 어긋남
        w = WD
        for y in range(T):
            row = y // 4
            for x in range(T):
                q = rnd(x // 3, y, 330 + v)
                ry = y % 4
                c = w[4] if ry == 0 else w[3]
                if ry == 3: c = w[2]
                elif q < 0.12: c = w[2] if ry else w[3]
                elif q > 0.92 and ry < 3: c = w[4]
                cv.put(x, y, c)
            jx = (hsh(row, v, 5) % 12) + 2
            for ry in range(3):
                cv.put(jx, row * 4 + ry, w[2])
    elif kind == 'dirt':     # 흙바닥: 다진 황토
        e = ER
        for y in range(T):
            for x in range(T):
                q = rnd(x // 2, y // 2, 350 + v)
                c = e[3]
                if q < 0.14: c = e[2]
                elif q > 0.95: c = e[4]
                cv.put(x, y, c)
        for k in range(2):
            x0, y0 = hsh(k, v, 21) % 12, hsh(v, k, 23) % 13
            cv.put(x0, y0, e[4]); cv.put(x0 + 1, y0, e[4]); cv.put(x0 + 1, y0 + 1, e[2]); cv.put(x0 + 2, y0 + 1, e[2])
    elif kind == 'stone':    # 돌바닥: 막돌 판, 5/6/5px 줄이 어긋남
        s = ST
        rows = [(0, 5), (5, 11), (11, 16)]
        for ri, (y0, y1) in enumerate(rows):
            off = (hsh(ri, v, 3) % 6) + 2
            for y in range(y0, y1):
                for x in range(T):
                    q = rnd(x, y, 370 + v)
                    c = s[4] if q > 0.07 else s[3]
                    if y == y0: c = s[5] if q > 0.35 else s[4]
                    if y == y1 - 1: c = s[3]
                    cv.put(x, y, c)
            for jx in (off, off + 8):
                cv.vl(jx % T, y0, y1, s[3])
    return cv


def _shade(t, mode):
    """바닥 칸의 벽 밑 그늘: n=위 3줄(0.72/0.84/0.93), w=왼쪽 5줄(서쪽 벽 덩어리 그림자), nw=둘 다."""
    o = Cv(T, T)
    o.a = t.a.copy()
    # 옹이·못 자국처럼 드물고 어두운 점은 그늘 띠 안에서 떠 보인다(「문 밑 막대기」) — 그늘 띠 안에선 이웃 색으로 덮는다
    cols = {}
    for y in range(T):
        for x in range(T):
            cols[tuple(o.a[y, x, :3])] = cols.get(tuple(o.a[y, x, :3]), 0) + 1
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    med = sorted(lum(tuple(o.a[y, x, :3])) for y in range(T) for x in range(T))[T * T // 2]
    src = o.a.copy()
    for y in range(T):
        for x in range(T):
            inband = ('n' in mode and y < 3) or ('w' in mode and x < 5)
            c = tuple(src[y, x, :3])
            if inband and cols[c] < 8 and lum(c) < med:
                nb = {}
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if (dy or dx) and 0 <= yy < T and 0 <= xx < T:
                            k = tuple(src[yy, xx, :3])
                            if cols[k] >= 8:
                                nb[k] = nb.get(k, 0) + 1
                if nb:
                    best = max(nb, key=nb.get)
                    o.a[y, x, :3] = best
    if 'n' in mode:                                     # 위 그늘 띠(0~2줄) 안의 널 이음새 끝 막대는 그늘 속에서 떠 보인다 → 줄의 바탕색으로 덮는다
        darkest = min(cols, key=lambda c: lum(c))
        for y in range(3):
            row = [tuple(o.a[y, x, :3]) for x in range(T)]
            rest = [c for c in row if c != darkest]
            if rest and len(rest) < T:
                base = max(set(rest), key=rest.count)
                for x in range(T):
                    if row[x] == darkest:
                        o.a[y, x, :3] = base
    fy = {0: 0.72, 1: 0.84, 2: 0.93}
    fx = {0: 0.80, 1: 0.86, 2: 0.91, 3: 0.95, 4: 0.98}
    for y in range(T):
        for x in range(T):
            f = 1.0
            if 'n' in mode and y in fy: f = min(f, fy[y])
            if 'w' in mode and x in fx: f = min(f, fx[x])
            if f < 1.0:
                n = 2 if f < 0.78 else 1
                o.put(x, y, step(tuple(o.a[y, x, :3]), n))
    return o


def floor_sets():
    """{이름: [Cv...]} 평면 바닥 묶음. in_<재질> 4변형, in_<재질>_sh = [위, 왼쪽, 위+왼쪽]."""
    out = {}
    for k in FLOORS:
        base = [_floor(k, v) for v in range(4)]
        out['in_b_' + k] = base
        out['in_b_%s_sh' % k] = [_shade(base[0], 'n'), _shade(base[1], 'w'), _shade(base[2], 'nw')]
    return out


# ----------------------------------------------------------------------------------------------------- 천장 오토타일(블롭 47)
def _ceil(mask, v=0):
    """mask: 이웃이 천장(막힘)인 방향 비트. 열린 쪽(방과 닿는 쪽)에 처마 서까래 띠 3px.
    바깥 → 안: 어두운 선 · 밝은 띠 2px(8px 마디로 끊김). 속은 2톤 어둠 바둑."""
    cv = Cv(T, T)
    g = GI
    wd = WD
    N_, E_, S_, W_ = (bool(mask & b) for b in (WB.N, WB.E, WB.S, WB.W))
    c_ne = bool(mask & WB.NE); c_se = bool(mask & WB.SE); c_sw = bool(mask & WB.SW); c_nw = bool(mask & WB.NW)
    for y in range(T):
        for x in range(T):
            base = g[0] if ((x // 2 + y // 2) % 2 == 0) else g[1]
            d = 99
            along = 0
            if not N_ and y < d: d, along = y, x
            if not S_ and (T - 1 - y) < d: d, along = T - 1 - y, x
            if not W_ and x < d: d, along = x, y
            if not E_ and (T - 1 - x) < d: d, along = T - 1 - x, y
            # 오목 모서리(두 변은 천장인데 대각선 이웃은 방): 3×3 점
            for open_, (cx, cy) in ((not c_ne and N_ and E_, (T - 1, 0)), (not c_se and S_ and E_, (T - 1, T - 1)),
                                    (not c_sw and S_ and W_, (0, T - 1)), (not c_nw and N_ and W_, (0, 0))):
                if open_:
                    dd = max(abs(x - cx), abs(y - cy))
                    if dd < d: d, along = dd, x + y
            if d == 0:
                c = wd[1]
            elif d == 1:
                c = g[6] if (along % 8) < 6 else g[4]
            elif d == 2:
                c = g[5] if (along % 8) < 6 else g[3]
            else:
                c = base
            cv.put(x, y, c)
    return cv


def ceil47():
    return [_ceil(m) for m in WB.ALL47]


# ----------------------------------------------------------------------------------------------------- 벽면 1×2
KINDS = ('hoe', 'mok', 'heuk', 'dol', 'changho')
ENDS = ('m', 'l', 'r', 'lr')


def _beam(cv, x0, x1, ramp=WD):
    """벽 위쪽 창방(보): 5줄. 천장 띠 바로 밑."""
    cv.hl(x0, x1, 0, ramp[1]); cv.hl(x0, x1, 1, ramp[4]); cv.hl(x0, x1, 2, ramp[5])
    cv.hl(x0, x1, 3, ramp[3]); cv.hl(x0, x1, 4, ramp[1])


def _base(cv, y0, ramp=WD):
    """벽 아래 걸레받이(머름)."""
    cv.hl(0, T, y0, ramp[5]); cv.hl(0, T, y0 + 1, ramp[4]); cv.hl(0, T, y0 + 2, ramp[4])
    cv.hl(0, T, y0 + 3, ramp[3]); cv.hl(0, T, y0 + 4, ramp[2]); cv.hl(0, T, y0 + 5, ramp[1])


def _posts(cv, ends, ramp=WD):
    if 'l' in ends:
        cv.vl(0, 0, 32, ramp[1]); cv.vl(1, 0, 32, ramp[5]); cv.vl(2, 0, 32, ramp[4])
    if 'r' in ends:
        cv.vl(13, 0, 32, ramp[5]); cv.vl(14, 0, 32, ramp[3]); cv.vl(15, 0, 32, ramp[1])


def wall_face(kind, ends='m', seed=0):
    cv = Cv(T, 2 * T)
    if kind == 'hoe':                               # 회벽(흰 회칠)
        for y in range(5, 26):
            for x in range(T):
                q = rnd(x, y, 410 + seed)
                tone = 5 if y < 17 else 4
                c = PL[tone]
                if q < 0.10: c = PL[tone - 1]
                elif q > 0.95: c = PL[min(6, tone + 1)]
                cv.put(x, y, c)
        _beam(cv, 0, T); _base(cv, 26)
    elif kind == 'mok':                             # 목재벽(세로 널)
        for y in range(5, 26):
            for x in range(T):
                b = (x // 4 + seed) % 3
                col = (WD[4], WD[3], WD[4])[b]
                ph = x % 4
                if ph == 3: col = WD[2]
                elif ph == 0 and y % 7 == 0: col = WD[3]
                if rnd(x, y, 420 + seed) < 0.08: col = WD[2] if ph != 3 else WD[1]
                if y >= 17 and ph != 3: col = WD[3] if col == WD[4] else WD[2]       # 아랫부분 한 단 어둡게
                cv.put(x, y, col)
        _beam(cv, 0, T); _base(cv, 26, WD)
    elif kind == 'heuk':                            # 황토벽(거친 흙 미장)
        for y in range(5, 26):
            for x in range(T):
                q = rnd(x, y, 430 + seed)
                tone = 4 if y < 17 else 3
                c = ER[tone]
                if q < 0.14: c = ER[tone - 1]
                elif q > 0.93: c = ER[tone + 1]
                cv.put(x, y, c)
        for k in range(2):                           # 미장 결: 짧은 가로 흙손 자국
            x0, y0 = hsh(k, seed, 31) % 10, 7 + (hsh(seed, k, 33) % 15)
            cv.hl(x0, x0 + 5, y0, ER[5])
        _beam(cv, 0, T); _base(cv, 26, ST)
    elif kind == 'dol':                             # 돌벽(막돌 쌓기)
        for y in range(5, 26):
            for x in range(T):
                cv.put(x, y, ST[4] if rnd(x, y, 440 + seed) > 0.2 else ST[3])
        for ri, y0 in enumerate((5, 12, 19)):
            cv.hl(0, T, y0, ST[5])
            cv.hl(0, T, y0 + 6, ST[2])
            off = 3 + ri * 5
            for jx in (off % T, (off + 8) % T):
                cv.vl(jx, y0 + 1, min(26, y0 + 7), ST[2])
        cv.hl(0, T, 0, ST[1]); cv.hl(0, T, 1, ST[5]); cv.hl(0, T, 2, ST[4]); cv.hl(0, T, 3, ST[3]); cv.hl(0, T, 4, ST[2])
        _base(cv, 26, ST)
    elif kind == 'changho':                         # 창호벽: 한지 문살 면
        for y in range(5, 28):
            for x in range(T):
                q = rnd(x, y, 450 + seed)
                c = PL[6] if q > 0.9 else (PL[5] if q > 0.14 else PL[4])
                cv.put(x, y, c)
        for x in (3, 7, 11):
            cv.vl(x, 7, 26, WD[4])
        for y in (10, 15, 20):
            cv.hl(1, 15, y, WD[4])
        r_(cv, 0, 5, 16, 2, WD[4]); cv.hl(0, T, 6, WD[3])
        r_(cv, 0, 26, 16, 2, WD[4])
        cv.vl(0, 5, 28, WD[4]); cv.vl(1, 5, 28, WD[3]); cv.vl(14, 5, 28, WD[3]); cv.vl(15, 5, 28, WD[2])
        _beam(cv, 0, T); _base(cv, 27, WD)
        cv.hl(0, T, 27, WD[5])
    _posts(cv, ends, WD if kind != 'dol' else ST)
    if kind == 'dol':                                # 돌벽 끝: 모서리 큰 돌
        pass
    return cv


# ---- 창
def _win_frame(cv, x0, y0, x1, y1, round_=False):
    """한지 창: 바깥 틀 wood, 안은 한지 + 정자살."""
    w, h = x1 - x0, y1 - y0
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, 460)
            cv.put(x, y, PL[6] if q > 0.88 else PL[5])
    mx, my = (x0 + x1) // 2, (y0 + y1) // 2
    cv.vl(mx, y0 + 1, y1 - 1, WD[4]); cv.hl(x0 + 1, x1 - 1, my, WD[4])
    rim(cv, x0, y0, x1, y1, WD[3])
    cv.hl(x0, x1, y0, WD[5]); cv.vl(x0, y0, y1, WD[4])
    cv.hl(x0 - 1, x1 + 1, y1, WD[2]); cv.hl(x0 - 1, x1 + 1, y1 + 1, WD[1])      # 창턱
    cv.hl(x0 - 1, x1 + 1, y1 - 0 - 0, WD[3])


def win_face(base_kind, shape='sq', seed=0):
    cv = wall_face(base_kind, 'm', seed)
    if shape == 'sq':
        x0, x1, y0, y1 = 3, 13, 7, 19
        _win_frame(cv, x0, y0, x1, y1)
        # 창틀 그늘: 오른쪽·아래
        cv.vl(x1, y0 + 1, y1, WD[2])
    elif shape == 'round':
        cx, cy, R = 8, 13, 6.2
        for y in range(5, 22):
            for x in range(T):
                d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
                if d <= R - 1.4:
                    cv.put(x, y, PL[6] if rnd(x, y, 470) > 0.86 else PL[5])
                elif d <= R:
                    cv.put(x, y, WD[5] if (x < cx and y < cy) else (WD[3] if (x > cx and y > cy) else WD[4]))
                elif d <= R + 1.0:
                    cv.put(x, y, WD[1])
        cv.vl(8, 8, 19, WD[4]); cv.hl(3, 14, 13, WD[4])
        cv.hl(2, 14, 20, WD[2]); cv.hl(3, 13, 21, WD[1])
    elif shape == 'shutter':                       # 판자 들창(밖으로 들어 올림): 어두운 창구 + 위로 들린 널
        cv.rect(3, 9, 13, 18, GI[1]); cv.rect(4, 10, 12, 17, GI[0])
        rim(cv, 3, 9, 13, 18, WD[2])
        cv.hl(2, 14, 6, WD[5]); cv.hl(2, 14, 7, WD[4]); cv.hl(2, 14, 8, WD[2])      # 들어 올린 널(위쪽에 걸려 있음)
        cv.hl(3, 13, 18, WD[3]); cv.hl(2, 14, 19, WD[1])
    return cv


# ---- 문(방 안 미닫이 · 판자문)
def door_slide(side, open_=False):
    """쌍미닫이 한 쪽(2칸 폭의 왼쪽 'l' / 오른쪽 'r'). 닫힘 = 문살 한지 두 짝, 열림 = 문짝이 옆으로 밀려 어두운 안쪽이 보임."""
    cv = Cv(T, 2 * T)
    _beam(cv, 0, T)
    cv.hl(0, T, 5, WD[5]); cv.hl(0, T, 6, WD[4])                      # 문 윗틀
    inner = (1, 15) if side == 'l' else (0, 14)
    for y in range(7, 26):
        for x in range(T):
            q = rnd(x, y, 480)
            cv.put(x, y, PL[6] if q > 0.9 else (PL[5] if q > 0.15 else PL[4]))
    # 문살
    for x in (4, 8, 12):
        cv.vl(x, 7, 26, WD[4])
    for y in (11, 16, 21):
        cv.hl(0, T, y, WD[4])
    # 틀: 바깥 기둥 쪽 3px, 가운데 맞닿는 쪽 2px
    if side == 'l':
        cv.vl(0, 5, 28, WD[1]); cv.vl(1, 5, 28, WD[5]); cv.vl(2, 5, 28, WD[4])
        cv.vl(14, 5, 28, WD[3]); cv.vl(15, 5, 28, WD[2])
    else:
        cv.vl(0, 5, 28, WD[5]); cv.vl(1, 5, 28, WD[3])
        cv.vl(13, 5, 28, WD[5]); cv.vl(14, 5, 28, WD[3]); cv.vl(15, 5, 28, WD[1])
    cv.hl(0, T, 26, WD[4]); cv.hl(0, T, 27, WD[3])
    hx = 12 if side == 'l' else 3                                       # 손잡이(검은 철) 가운데 쪽
    cv.rect(hx, 15, hx + 2, 19, GI[2]); cv.vl(hx, 15, 19, GI[4])
    # 문턱
    cv.hl(0, T, 28, WD[5]); cv.hl(0, T, 29, WD[4]); cv.hl(0, T, 30, WD[2]); cv.hl(0, T, 31, WD[1])
    if open_:
        # 열림: 문짝 하나가 바깥쪽으로 밀려 반만 보이고 나머지는 어두운 방
        x0, x1 = (8, 15) if side == 'l' else (1, 8)
        for y in range(7, 28):
            for x in range(x0, x1):
                cv.put(x, y, GI[0] if ((x + y) % 2 == 0) else GI[1])
        edge = x0 if side == 'l' else x1 - 1
        cv.vl(edge, 6, 28, WD[1])
        cv.hl(x0, x1, 7, GI[2]); cv.hl(x0, x1, 27, WD[1])
        cv.vl(14 if side == 'l' else 1, 6, 28, WD[5])
    return cv


def door_plank(open_=False):
    """판자문(부엌·광·대장간): 1칸 폭, 철띠 두 줄 + 고리쇠. 열림 = 어두운 문간."""
    cv = Cv(T, 2 * T)
    _beam(cv, 0, T)
    cv.vl(0, 5, 32, WD[1]); cv.vl(1, 5, 32, WD[5]); cv.vl(2, 5, 32, WD[4])
    cv.vl(13, 5, 32, WD[5]); cv.vl(14, 5, 32, WD[3]); cv.vl(15, 5, 32, WD[1])
    cv.hl(3, 13, 5, WD[2]); cv.hl(3, 13, 6, WD[4])
    if not open_:
        for y in range(7, 31):
            for x in range(3, 13):
                ph = (x - 3) % 3
                c = WD[4] if ph == 0 else (WD[3] if ph == 1 else WD[2])
                if rnd(x, y, 490) < 0.07: c = WD[2]
                cv.put(x, y, c)
        for y in (10, 24):
            cv.hl(3, 13, y, GI[2]); cv.hl(3, 13, y + 1, GI[4]); cv.hl(3, 13, y + 2, GI[1])
        cv.rect(10, 17, 12, 20, GI[3]); cv.put(10, 17, GI[5])               # 고리쇠
    else:
        for y in range(7, 31):
            for x in range(3, 13):
                cv.put(x, y, GI[0] if ((x + y) % 2 == 0) else GI[1])
        cv.rect(3, 7, 4, 31, WD[3])                                          # 젖혀진 문짝 가장자리
        cv.hl(3, 13, 7, GI[2])
    cv.hl(0, T, 30, WD[2]); cv.hl(0, T, 31, WD[1])
    return cv


# ----------------------------------------------------------------------------------------------------- 기둥·들보
def pillar(rows, red=False):
    """기둥 1×rows: 주춧돌 + 둥근 기둥 몸 + 두공 머리. 아래 칸만 걷기 막힘(전부 X)."""
    H = rows * T
    cv = Cv(T, H)
    sh = RD if red else WD
    body = (sh[5], sh[4], sh[3]) if not red else (sh[5], sh[4], sh[2])
    x0, x1 = 4, 12
    for y in range(8, H - 6):
        for x in range(x0, x1):
            f = (x - x0) / (x1 - x0 - 1)
            c = sh[6 if red else 5] if f < 0.2 else (sh[5] if f < 0.45 else (sh[4] if f < 0.75 else sh[2 if red else 3]))
            if f > 0.9: c = sh[1]
            cv.put(x, y, c)
    for x in range(2, 14):                                           # 주두(기둥 머리)
        cv.put(x, 3, WD[5] if x < 7 else WD[3]); cv.put(x, 4, WD[4] if x < 8 else WD[2])
    cv.hl(3, 13, 5, WD[3]); cv.hl(3, 13, 6, WD[2]); cv.hl(3, 13, 7, WD[1])
    for x in range(2, 14):
        cv.put(x, 2, WD[6] if x < 6 else WD[4])
    for y in range(H - 6, H):                                         # 주춧돌
        w = 3 + (y - (H - 6)) // 2 if y < H - 3 else 1
        for x in range(2 + (0), 14):
            c = ST[5] if (x < 6 and y < H - 3) else (ST[4] if x < 11 else ST[3])
            if y == H - 1: c = ST[2]
            cv.put(x, y, c)
    cv.hl(2, 14, H - 6, ST[6]); cv.hl(2, 14, H - 1, ST[1])
    B.outline(cv)
    return cv


def beam(kind='m', red=False):
    """들보(대들보·창방) 한 칸: 가로 8px 보. l/r 은 끝에서 기둥 쪽으로 물림."""
    cv = Cv(T, T)
    sh = RD if red else WD
    x0 = 3 if kind == 'l' else 0
    x1 = 13 if kind == 'r' else T
    for y in range(3, 11):
        t = {3: 6, 4: 5, 5: 5, 6: 4, 7: 4, 8: 3, 9: 2, 10: 1}[y]
        for x in range(x0, x1):
            c = sh[t]
            if red and t == 6: c = sh[6]
            cv.put(x, y, c)
    if not red:
        grain(cv, x0, 4, x1, 9, WD, 3, 71, 0.12)
    for y in range(11, 13):                                           # 보 밑 그늘(반투명)
        for x in range(x0, x1):
            cv.put(x, y, SHADOW, 90 - (y - 11) * 40)
    if kind in ('l', 'r'):
        B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 계단·단
def _stair_rails(cv, w, h, x0=0):
    for y in range(h):
        cv.put(x0, y, WD[1]); cv.put(x0 + 1, y, WD[5]); cv.put(x0 + 2, y, WD[3])
        cv.put(x0 + w - 3, y, WD[5]); cv.put(x0 + w - 2, y, WD[3]); cv.put(x0 + w - 1, y, WD[1])


def stair_up(cols=3, ladder=False):
    """위로 오르는 계단(북벽 쪽): 벽면 두 줄 + 바닥 한 줄 = cols×3. 위는 어두운 다락 입구, 디딤판은 밝고 챌판은 어둡다."""
    W_, H_ = cols * T, 3 * T
    cv = Cv(W_, H_)
    for y in range(0, 8):                                             # 다락 입구(어둠)
        for x in range(W_):
            cv.put(x, y, GI[0] if ((x // 2 + y // 2) % 2 == 0) else GI[1])
    cv.hl(0, W_, 0, WD[1]); cv.hl(3, W_ - 3, 7, WD[2])
    if not ladder:
        n = (H_ - 8) // 5
        for i in range(n):
            y0 = 8 + i * 5
            tread = (WD[6], WD[5]) if i % 2 == 0 else (WD[5], WD[4])
            for x in range(3, W_ - 3):
                cv.put(x, y0, tread[0]); cv.put(x, y0 + 1, tread[1])
                for k, tcol in ((2, WD[3]), (3, WD[2]), (4, WD[2])):
                    cv.put(x, y0 + k, tcol if rnd(x, y0 + k, 60) > 0.15 else WD[1])
            cv.hl(3, W_ - 3, y0 + 4, WD[1])
        _stair_rails(cv, W_, H_)
    else:                                                              # 사다리: 두 짝 기둥 + 가로 디딤
        for y in range(8, H_):
            for x in (4, 5, W_ - 6, W_ - 5):
                cv.put(x, y, WD[5] if x in (4, W_ - 6) else WD[3])
            cv.put(3, y, WD[1]); cv.put(6, y, WD[2]) if False else None
        for y in range(11, H_ - 2, 7):
            cv.hl(4, W_ - 4, y, WD[6]); cv.hl(4, W_ - 4, y + 1, WD[4]); cv.hl(4, W_ - 4, y + 2, WD[2])
    cv.hl(0, W_, H_ - 1, WD[1])
    B.outline(cv)
    return cv


def stair_down():
    """내려가는 계단(바닥 구멍) 1칸: 어두운 사각 구멍 + 아래로 향한 돌 계단."""
    cv = Cv(T, T)
    r_(cv, 1, 1, 14, 14, GI[0])
    for i in range(4):
        y0 = 3 + i * 3
        tone = (ST[5], ST[4], ST[3], ST[2])[i]
        cv.hl(3 + i, 13 - i, y0, tone); cv.hl(3 + i, 13 - i, y0 + 1, ST[2] if i < 3 else ST[1])
    rim(cv, 1, 1, 15, 15, WD[3])
    cv.hl(1, 15, 1, WD[5]); cv.vl(1, 1, 15, WD[4]); cv.hl(1, 15, 14, WD[1]); cv.vl(14, 1, 15, WD[2])
    return cv


def stair_dais(cols=3):
    """단(대청·동헌) 앞 돌계단: cols×1, 아래로 두 단. 디딤은 밝은 석재."""
    W_ = cols * T
    cv = Cv(W_, T)
    for t in range(2):
        y0 = 1 + t * 7
        for x in range(1 + t * 0, W_ - 1):
            for yy in range(y0, y0 + 7):
                f = yy - y0
                c = ST[6] if f == 0 else (ST[5] if f == 1 else (ST[4] if f < 5 else ST[3]))
                if rnd(x, yy, 90 + t) < 0.10 and f > 1: c = ST[3]
                cv.put(x, yy, c)
        cv.hl(1, W_ - 1, y0 + 6, ST[2])
    cv.vl(0, 1, T, ST[2]); cv.vl(W_ - 1, 1, T, ST[1])
    B.outline(cv)
    return cv


def dais_front(kind='m', mat='wood'):
    """단(높은 마루) 앞면 1칸: 윗면 가장자리 + 앞면. 바닥보다 한 단 높아 보인다. kind l/m/r. mat wood|stone."""
    cv = Cv(T, T)
    ramp = WD if mat == 'wood' else ST
    top = (ramp[6], ramp[5]) if mat == 'wood' else (ST[5], ST[4])
    # 위 3줄은 단 윗면 안쪽 끝(바닥 밝기), 아래 13줄은 앞면
    for y in range(T):
        for x in range(T):
            if y < 3:
                c = top[0] if y == 2 else top[1]
            elif y < 14:
                f = x / 15.0
                c = ramp[4] if f < 0.4 else ramp[3]
                if y == 3: c = ramp[5]
                if mat == 'wood' and (x % 4 == 3): c = ramp[2]
                if mat == 'stone' and y in (8, ) : c = ramp[3]
            else:
                c = ramp[1] if y == 15 else ramp[2]
            cv.put(x, y, c)
    if 'l' in kind: cv.vl(0, 0, T, ramp[1])
    if 'r' in kind: cv.vl(T - 1, 0, T, ramp[1])
    for y in range(14, 16):                                          # 밑 그늘은 바닥 위로 번지게 불투명으로
        pass
    return cv


# ----------------------------------------------------------------------------------------------------- 입구·장식
def exit_mat():
    """출입구 칸(남쪽 벽 틈): 나무 문지방 + 바깥 빛이 드는 댓돌. 걸어 나가는 칸."""
    cv = Cv(T, T)
    for y in range(T):
        for x in range(T):
            if y < 7:                                              # 바깥 빛 한 줄 + 댓돌
                c = ST[5] if y > 1 else PL[5]
                if y in (3, 4): c = ST[4]
                if rnd(x, y, 510) < 0.1: c = ST[4]
                cv.put(x, y, c)
            elif y < 12:                                           # 문지방 목재(위에서 본 윗면)
                c = WD[6] if y == 7 else (WD[5] if y < 10 else WD[4])
                cv.put(x, y, c)
            else:
                c = WD[3] if y < 15 else WD[2]
                cv.put(x, y, c)
    cv.vl(0, 0, T, WD[1]); cv.vl(15, 0, T, WD[1])
    cv.hl(0, T, 12, WD[2])
    return cv


def objects():
    d = {}
    for k in KINDS:
        for e in ENDS:
            d['in_b_wall_%s_%s' % (k, e)] = wall_face(k, e, seed=KINDS.index(k) * 3)
    d['in_b_win_hoe'] = win_face('hoe', 'sq')
    d['in_b_win_round'] = win_face('hoe', 'round')
    d['in_b_win_mok'] = win_face('mok', 'shutter')
    d['in_b_win_heuk'] = win_face('heuk', 'shutter')
    for s in ('l', 'r'):
        d['in_b_door_slide_%s' % s] = door_slide(s)
        d['in_b_door_slide_open_%s' % s] = door_slide(s, True)
    d['in_b_door_plank'] = door_plank()
    d['in_b_door_open'] = door_plank(True)
    for red in (False, True):
        for rows in (2, 3):
            d['in_b_pillar%s_%d' % ('_red' if red else '', rows)] = pillar(rows, red)
        for k in ('m', 'l', 'r'):
            d['in_b_beam%s_%s' % ('_red' if red else '', k)] = beam(k, red)
    d['in_b_stair_up_3'] = stair_up(3)
    d['in_b_stair_up_2'] = stair_up(2)
    d['in_b_ladder_loft'] = stair_up(1, ladder=True)
    d['in_b_stair_down'] = stair_down()
    d['in_b_stair_dais_3'] = stair_dais(3)
    d['in_b_stair_dais_2'] = stair_dais(2)
    for k in ('m', 'l', 'r', 'lr'):
        d['in_b_dais_wood_%s' % k] = dais_front(k, 'wood')
        d['in_b_dais_stone_%s' % k] = dais_front(k, 'stone')
    d['in_b_exit_mat'] = exit_mat()
    return d


def terrain():
    t = {}
    t.update(floor_sets())
    t['in_b_ceil47'] = ceil47()
    return t
