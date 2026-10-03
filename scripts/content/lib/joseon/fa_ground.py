"""사냥터(성문 밖 필드·동굴) 지형 칸 — 조선 팔레트 91색 잠금, 코드 도트.

묶음 이름은 fld_/cav_ 접두어, 코드 모듈은 fa_ 접두어(다른 작업자와 파일이 겹치지 않게).
마스크 규칙은 기존 road16 과 같다: N=1 E=2 S=4 W=8, 이어지지 않는 변에 가장자리를 그린다.
  fld_trail32   짐승길(풀밭 위 밟혀 다져진 흙길) mask16 × 2변형            idx = 16*v + mask
  fld_tall32    키 큰 풀·억새 덩이 mask16 × 2변형(0 풀, 1 억새)
  fld_forest32  숲 바닥(낙엽·솔잎) mask16 × 2변형
  fld_bog94     늪·웅덩이 blob47 × 2변형(water47 을 칙칙한 청록으로 다시 칠하고 개구리밥을 얹음)   idx = index47 + 47*v
  fld_rock64    바위산 윗면 mask16 × 4변형(S 변은 앞면이 받는다)
  fld_face16    바위산 앞면(벽) 2줄 × 서·동 끝 4종 × 2변형    idx = v*8 + 줄(0 위·1 아래)*4 + (W이어짐?1:0) + (E이어짐?2:0)
  cav_floor     동굴 바닥 평면 6종
  cav_lit       동굴 입구 쪽 햇빛 든 바닥 평면 4종
  cav_ceil32    동굴 천장(벽 윗면) mask16 × 2변형 — 이어지지 않는 변에 밝은 테두리
  cav_face16    동굴 벽면 2줄(fld_face16 과 같은 인덱스, 어두운 암석)
  cav_pool94    동굴 못 blob47 × 2변형(뭍을 돌로)

모든 색은 tk.RGB 램프에서만 나온다.
"""
import math
from tk import *
import ground as G
import water_blob as WB

N, E, S_, W = G.N, G.E, G.S, G.W
GR = RGB['leaf']; ST = RGB['stone']; EA = RGB['earth']; PI = RGB['pine']
STR = RGB['straw']; PE = RGB['persimmon']; WA = RGB['water']; PL = RGB['plaster']; GI = RGB['giwa']; DG = RGB['dgreen']


def _jit(t, ph, amp, base=0.6):
    """16 화소 주기 가장자리 굼실거림(이웃 칸과 이어진다): 0..amp+base 정수."""
    tp = 2 * math.pi / 16
    v = 0.6 * math.sin(tp * (t + 0.5) + ph) + 0.4 * math.sin(2 * tp * (t + 0.5) + ph * 1.7 + 1.1)
    return int(round(base + amp * (0.5 + 0.5 * v)))


def depth(mask, x, y, ph=0.0, amp=2.0, base=0.6, rnd_corner=3):
    """열린 변마다 경계까지의 깊이(0 이면 안). 변마다 위상이 다르다(같은 모양 반복 방지)."""
    d = 0
    if not mask & N: d = max(d, _jit(x, ph, amp, base) + 1 - y)
    if not mask & S_: d = max(d, _jit(x, ph + 2.0, amp, base) + 1 - (T - 1 - y))
    if not mask & W: d = max(d, _jit(y, ph + 4.0, amp, base) + 1 - x)
    if not mask & E: d = max(d, _jit(y, ph + 1.0, amp, base) + 1 - (T - 1 - x))
    for (a, b, cx, cy) in ((N, W, x, y), (N, E, T - 1 - x, y), (S_, W, x, T - 1 - y), (S_, E, T - 1 - x, T - 1 - y)):
        if not mask & a and not mask & b and cx + cy < rnd_corner + 1:
            d = max(d, rnd_corner - cx - cy)
    return d


def _grass_px(x, y, s=0):
    q = rnd(x, y, 100 + s)
    c = GR[4]
    if q < 0.20: c = GR[3]
    elif q > 0.90: c = GR[5]
    return c


# ================================================================ 짐승길
def trail(mask, v=0):
    """풀밭을 가로지르는 흙 짐승길: 다져진 흙(황토 4~5) 한가운데, 가장자리는 닳아 풀이 먹어 들어오고 풀잎이 흙 위로 삐져나온다.
    수레바퀴 자국 없음(짐승·사람 발자국만), 잔 돌 몇 개."""
    c = Cv(T, T)
    P = (0.7, 2.2, 0.2)
    for y in range(T):
        for x in range(T):
            d = depth(mask, x, y, *P)
            q = rnd(x, y, 210 + v)
            if d <= 0:
                col = EA[4]
                if q < 0.20: col = EA[3]
                elif q > 0.90: col = EA[5]
            elif d == 1:
                col = EA[3] if q > 0.45 else EA[2]
            elif d == 2:
                col = GR[2] if q > 0.35 else EA[3]
            else:
                col = _grass_px(x, y)
            c.put(x, y, col)
    for k in range(5):                                                 # 가장자리 풀잎(흙 쪽으로 삐져나온 세로 2px)
        x, y = hsh(k, mask, 31 + v) % 16, hsh(mask, k, 37 + v) % 15
        if depth(mask, x, y, *P) == 0 and any(depth(mask, x + dx, y + dy, *P) > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < T and 0 <= y + dy < T):
            c.put(x, y, GR[5]); c.put(x, y + 1, GR[3])
    for k in range(2):                                                 # 발굽 자국 2×1
        x, y = 3 + hsh(k, mask, 41 + v) % 9, 3 + hsh(mask, k, 43 + v) % 9
        if depth(mask, x, y, *P) == 0 and depth(mask, x + 1, y, *P) == 0:
            c.put(x, y, EA[2]); c.put(x + 1, y, EA[2])
    x, y = 2 + hsh(mask, v, 47) % 11, 2 + hsh(v, mask, 53) % 11
    if depth(mask, x, y, *P) == 0 and depth(mask, x + 1, y, *P) == 0:
        c.put(x, y, ST[5]); c.put(x + 1, y, ST[4])
    return c


# ================================================================ 키 큰 풀 · 억새
def tall(mask, v=0):
    """키 큰 풀 덩이. v0: 짙은 초록 바탕에 가늘고 긴 풀잎 무리. v1: 억새 — 연한 짚빛 이삭이 섞인다.
    가장자리는 들쭉날쭉하고 맨 풀 쪽으로 풀잎 끝이 삐져나온다."""
    c = Cv(T, T)
    P = (2.2, 2.6, 0.0)
    for y in range(T):
        for x in range(T):
            d = depth(mask, x, y, *P)
            if d > 0:
                c.put(x, y, _grass_px(x, y)); continue
            q = rnd(x, y, 230 + v)
            col = GR[3] if q > 0.25 else GR[2]
            if rnd(x, y, 3) < 0.15: col = GR[4]
            c.put(x, y, col)
    for k in range(10):
        bx, by = hsh(k, v, 61) % 15, 7 + hsh(v, k, 67) % 9
        if depth(mask, bx, by, *P) > 0:
            continue
        h = 4 + hsh(bx, by, 71) % 4
        lean = (hsh(bx, by, 73) % 3) - 1
        for kk in range(h):
            yy, xx = by - kk, bx + (lean if kk >= h - 2 else 0)
            if 0 <= xx < T - 1 and 0 <= yy < T and depth(mask, xx, yy, *P) == 0:
                tip = kk >= h - 2
                c.put(xx, yy, GR[6] if tip else GR[5]); c.put(xx + 1, yy, GR[4] if tip else GR[3])
    if v == 1:                                                         # 억새 이삭
        for (bx, by) in [(3, 11), (8, 8), (12, 12), (6, 14)]:
            if depth(mask, bx, by, *P) > 0:
                continue
            for kk in range(5):
                yy = by - kk
                if yy < 0: break
                c.put(bx, yy, PL[5] if kk >= 3 else GR[4]); c.put(bx + 1, yy, PL[4] if kk >= 3 else GR[3])
            if by - 5 >= 0:
                c.put(bx - 1, by - 4, PL[5]); c.put(bx + 2, by - 3, PL[3])
    for k in range(6):                                                 # 풀잎 사이 어두운 틈
        x, y = hsh(k, mask, 83 + v) % 15, hsh(mask, k, 89 + v) % 15
        if depth(mask, x, y, *P) == 0:
            c.put(x, y, GR[1]); c.put(x + 1, y, GR[2])
    return c


# ================================================================ 숲 바닥(낙엽)
def forest(mask, v=0):
    """숲 바닥: 솔잎·잎 그늘 바탕(어두운 초록 갈색)에 마른 낙엽(황토·적갈색 2×1 조각)과 마른 가지. 가장자리는 풀로 번진다."""
    c = Cv(T, T)
    P = (4.1, 2.4, 0.0)
    for y in range(T):
        for x in range(T):
            d = depth(mask, x, y, *P)
            if d > 0:
                c.put(x, y, GR[2] if (d == 1 and rnd(x, y, 5) > 0.35) else _grass_px(x, y)); continue
            q = rnd(x, y, 250 + v)
            q2 = rnd(x // 2, y // 2, 255 + v)
            col = GR[2] if q2 > 0.35 else PI[3]
            if q < 0.10: col = PI[2]
            if q > 0.92: col = GR[3]
            c.put(x, y, col)
    for k in range(5):
        x, y = hsh(k, mask, 91 + v) % 14, hsh(mask, k, 97 + v) % 15
        if depth(mask, x, y, *P) == 0 and depth(mask, x + 1, y, *P) == 0:
            a, b = ((EA[4], EA[3]), (EA[5], EA[4]), (EA[3], EA[2]))[hsh(k, v, 101) % 3]
            c.put(x, y, a); c.put(x + 1, y, b)
    for k in range(2):
        x, y = 2 + hsh(k, mask, 103 + v) % 10, 2 + hsh(mask, k, 107 + v) % 11
        if all(depth(mask, x + i, y + i // 2, *P) == 0 for i in range(4)):
            for i in range(4):
                c.put(x + i, y + i // 2, RGB['wood'][2 if i < 2 else 1])
    return c


# ================================================================ 늪 · 동굴 못(물 47종 다시 칠하기)
def _remap(tile, table):
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            px = tuple(int(q) for q in tile.a[y, x, :3])
            c.put(x, y, table.get(px, px))
    return c


def bog47_set(variants=2):
    """water47(청록 물 + 흙 둑)을 칙칙한 늪 물로: 밝은 하늘색 물결을 어두운 청록으로 낮추고 가끔 개구리밥(잎 2×1)을 얹는다.
    같은 색 대응을 47×변형 전부에 적용하므로 이웃 칸과의 이음은 water47 그대로다."""
    amap = {tuple(WA[4]): tuple(DG[4]), tuple(WA[5]): tuple(DG[5]), tuple(WA[6]): tuple(DG[5]),
            tuple(WA[3]): tuple(DG[3]), tuple(WA[2]): tuple(DG[2]), tuple(WA[1]): tuple(DG[1])}
    deep = {tuple(DG[i]) for i in (1, 2, 3, 4)}
    out = []
    for v in range(variants):
        for m in WB.ALL47:
            c = _remap(WB.water47(m, v), amap)
            for k in range(2):
                x, y = 1 + hsh(k, m + 7 * v, 113) % 12, 1 + hsh(m + 7 * v, k, 127) % 14
                if all(tuple(int(q) for q in c.a[y, x + i, :3]) in deep for i in range(2)):
                    c.put(x, y, GR[4]); c.put(x + 1, y, GR[3])
            out.append(c)
    return out


def cave_pool47(variants=2):
    """water47 의 풀·흙 둑을 돌 둑으로 바꾼 동굴 못(바닥 물)."""
    cmap = {}
    for i, j in ((2, 2), (3, 2), (4, 3), (5, 3), (6, 4)): cmap[tuple(GR[i])] = tuple(ST[j])
    for i, j in ((1, 1), (2, 2), (3, 3), (4, 3), (5, 4), (6, 4)): cmap[tuple(EA[i])] = tuple(ST[j])
    cmap[tuple(ST[5])] = tuple(ST[4]); cmap[tuple(ST[6])] = tuple(ST[5])
    return [_remap(WB.water47(m, v), cmap) for v in range(variants) for m in WB.ALL47]


# ================================================================ 바위산 윗면·앞면 (필드: 밝은 회색, 동굴: 어두운 암석)
def voro(x, y, nx, ny, v, ay=1.0, seed=0, jit=2.4):
    """16 화소 주기(이웃 칸과 이어진다)로 접히는 보로노이 조각 무늬. (가장 가까운 조각의 해시, 이음 여부, 조각 중심 기준 상대 좌표)."""
    best = (1e9, None); second = 1e9; sec_id = None
    cw, ch = 16.0 / nx, 16.0 / ny
    for i in range(nx):
        for j in range(ny):
            h1 = hsh(i, j, 700 + v * 13 + seed) / 65535.0; h2 = hsh(j, i, 800 + v * 17 + seed) / 65535.0
            sx = (i + 0.5) * cw + (h1 - 0.5) * 2 * jit
            sy = (j + 0.5) * ch + (h2 - 0.5) * 2 * jit
            for ox in (-16, 0, 16):
                for oy in (-16, 0, 16):
                    dx, dy = x + 0.5 - (sx + ox), (y + 0.5 - (sy + oy)) * ay
                    d = dx * dx + dy * dy
                    if d < best[0]:
                        second = best[0]; sec_id = best[1]; best = (d, (i, j, sx + ox, sy + oy))
                    elif d < second:
                        second = d; sec_id = (i, j, sx + ox, sy + oy)
    d1, (i, j, sx, sy) = best
    seam = (second ** 0.5 - d1 ** 0.5) < 1.05
    return hsh(i, j, 900 + v + seed), seam, (x + 0.5 - sx), (y + 0.5 - sy), (hsh(sec_id[0], sec_id[1], 900 + v + seed) if sec_id else 0)


def _top_px(x, y, v, cave):
    """윗면 암석: 6~8px 조각 무늬(한 조각은 한 톤 + 왼쪽 위가 한 단 밝음) + 어두운 이음 + 드문 반점. 화소 얼룩 잡음을 쓰지 않는다."""
    hh, seam, rx, ry, h2 = voro(x, y, 2, 2, v)
    tone = 4 - (hh % 3 == 0)                                                   # 3~4
    lit = -(rx * 0.12 + ry * 0.16)
    if not cave:
        t = tone + (1 if lit > 0.8 else (-1 if lit < -0.9 else 0))
        col = ST[max(2, min(5, t))]
        if seam and (hh % 3 == 0) != (h2 % 3 == 0): col = ST[2]                 # 톤이 다른 조각 사이에만 어두운 이음
    else:
        t = (tone - 3) + (1 if lit > 0.45 else 0)
        col = ST[max(1, min(3, 1 + t))] if t >= 0 else ST[1]
        if seam: col = GI[0]
    return col


def mass(mask, v=0, cave=False):
    """바위산 윗면(고원). 열린 변(이어지지 않는 변)에 윤곽: 바깥 1px 어두운 선 + 안쪽 1px 한 단 어두운 띠, 북쪽은 안쪽 띠를 밝게(뒷모서리).
    동·서 변에도 턱(옆면)을 그리지 않는다 — 윤곽만. 남쪽 변은 앞면 타일이 받으므로 보통 이어져 있다."""
    c = Cv(T, T)
    P = (1.3, 1.4, 0.0, 3)
    for y in range(T):
        for x in range(T):
            d = depth(mask, x, y, *P)
            if d > 0:
                if not cave:
                    col = GR[2] if d == 1 else _grass_px(x, y)
                else:
                    col = ST[1] if d == 1 else _top_px(x, y, v, cave)
                c.put(x, y, col); continue
            col = _top_px(x, y, v, cave)
            near = []
            for bit, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S_, (0, 1)), (W, (-1, 0))):
                if mask & bit: continue
                for k in range(1, 4):
                    X, Y = x + dx * k, y + dy * k
                    if not (0 <= X < T and 0 <= Y < T) or depth(mask, X, Y, *P) > 0:
                        near.append((bit, k)); break
            if near:
                bit, k = min(near, key=lambda t: t[1])
                if not cave:
                    if k == 1: col = ST[1]
                    elif k == 2: col = ST[5] if bit == N else ST[3]
                else:
                    if k == 1: col = ST[3]
                    elif k == 2: col = ST[2] if bit != N else ST[3]
            c.put(x, y, col)
    return c


def face_tile(row, we, v=0, cave=False):
    """바위산 앞면(남쪽 벽) 한 칸. row 0 = 윗줄(윗면 모서리 하이라이트 + 그늘 띠), row 1 = 아랫줄(발치: 풀·부스러기·땅 그늘).
    we = (W이어짐?1:0)|(E이어짐?2:0): 이어지지 않는 서·동 끝에는 윤곽만(턱 없음). 세로 균열 + 가로 층리."""
    c = Cv(T, T)
    base = (ST[3], ST[2], ST[1]) if not cave else (ST[3], ST[2], ST[1])
    hi = ST[5] if not cave else ST[4]
    # 세로 능선(바위 기둥) 무늬: 균열 3~4줄로 칸을 나누고, 능선마다 왼쪽이 밝고 오른쪽이 어둡다. 가로로는 짧은 턱(밝은 3~5px + 아래 어두운 1px).
    layouts = [(5, 11, 99), (3, 9, 99), (6, 12, 99), (4, 10, 99), (7, 12, 99), (2, 8, 99)]
    cr = layouts[(v * 2 + row) % len(layouts)]
    pal = (ST[5], ST[4], ST[3], ST[2]) if not cave else (ST[3], ST[2], ST[2], ST[1])
    crev = ST[1] if not cave else ST[0]
    for y in range(T):
        jog = [(1 if hsh(i, (y + row * 16) // 4, 21 + v) % 3 == 0 else 0) for i in range(3)]
        bounds = [-1] + [cr[i] + jog[i] for i in range(2)] + [T]
        for r in range(3):
            x0, x1 = bounds[r] + 1, bounds[r + 1]
            for x in range(max(0, x0), min(T, x1)):
                u = (x - x0) / max(1.0, x1 - x0 - 1)
                k = 0 if u < 0.18 else (1 if u < 0.55 else (2 if u < 0.85 else 3))
                if rnd(x, y, 410 + v + row * 3) > 0.95: k = min(3, k + 1) if k < 3 else k - 1
                c.put(x, y, pal[k])
        for i in range(2):
            c.put(cr[i] + jog[i], y, crev)
    for ri in range(3):                                       # 짧은 턱
        ly = 3 + hsh(ri, v * 2 + row, 31) % 10
        lx = max(0, (cr[ri - 1] + 1) if ri > 0 else 0)
        for x in range(lx, min(T, lx + 4)):
            if c.a[ly, x, 3] and tuple(c.a[ly, x, :3]) != tuple(crev):
                c.put(x, ly, pal[0]); 
                if ly + 1 < T: c.put(x, ly + 1, pal[3])
    if row == 0:
        for x in range(T):
            c.put(x, 0, ST[6] if not cave else ST[4]); c.put(x, 1, ST[5] if not cave else ST[3])
            c.put(x, 2, base[1] if rnd(x, 2, 7) > 0.3 else base[2])
    else:
        for x in range(T):
            j = _jit(x, 2.7, 1.6, 0.0)
            for y in range(T - 1 - j, T):
                if not cave:
                    c.put(x, y, GR[2] if (y == T - 1 - j and rnd(x, y, 9) > 0.4) else (GR[3] if rnd(x, y, 11) > 0.35 else GR[2]))
                else:
                    c.put(x, y, ST[1] if y == T - 1 else ST[2])
            for y in range(T - 4 - j, T - 1 - j):
                if rnd(x, y, 13) < 0.5:
                    c.put(x, y, base[2])
        if not cave:
            for k in range(2):
                x = 2 + hsh(k, v, 149) % 11
                c.put(x, T - 5, ST[5]); c.put(x + 1, T - 5, ST[4]); c.put(x, T - 4, ST[3]); c.put(x + 1, T - 4, ST[3])
    for side in (0, 1):                                                  # 서·동 끝 윤곽(턱 없음), 윗줄 위 모서리는 둥글게(바깥은 풀)
        if we & (1 if side == 0 else 2):
            continue
        for y in range(T):
            off = (3, 2, 1)[y] if (row == 0 and y < 3) else 0
            for i in range(off):
                c.put(i if side == 0 else T - 1 - i, y, (GR[3] if rnd(i, y, 17) > 0.3 else GR[2]) if not cave else ST[1])
            c.put(off if side == 0 else T - 1 - off, y, ST[1])
            c.put(off + 1 if side == 0 else T - 2 - off, y, ST[2] if not cave else ST[1])
    return c


def face_set(v_count=2, cave=False):
    return [face_tile(row, we, v, cave) for v in range(v_count) for row in range(2) for we in range(4)]


def mass_set(v_count=2, cave=False):
    return [mass(m, v, cave) for v in range(v_count) for m in range(16)]


# ================================================================ 동굴 바닥·입구 햇빛
def cave_floor(v):
    """동굴 바닥: 칙칙한 갈회색 흙(석질 2~3 + 황토 2), 잔돌·금. 평면 6종(이음 없음)."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 500 + v)
            q2 = rnd(x // 2, y // 2, 510 + v)
            col = ST[2] if q2 > 0.25 else EA[2]
            if q < 0.16: col = ST[1] if q2 > 0.5 else EA[1]
            elif q > 0.9: col = ST[3]
            c.put(x, y, col)
    for k in range(2 + v % 3):
        x, y = 2 + hsh(k, v, 151) % 11, 2 + hsh(v, k, 157) % 12
        c.put(x, y, ST[4]); c.put(x + 1, y, ST[3]); c.put(x, y + 1, ST[2]); c.put(x + 1, y + 1, ST[2])
    if v % 3 == 2:
        x, y = 3 + (v * 3) % 8, 4 + (v * 5) % 7
        for i in range(4):
            c.put(x + i, y + (i // 2), ST[0])
    return c


def cave_lit(v):
    """동굴 입구 바닥: 햇빛이 든 밝은 흙(황토 3~5)에 풀이 드문드문. 평면 4종."""
    c = Cv(T, T)
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 520 + v)
            col = EA[4]
            if q < 0.20: col = EA[3]
            elif q > 0.88: col = EA[5]
            c.put(x, y, col)
    for k in range(2):
        x, y = 1 + hsh(k, v, 163) % 13, 2 + hsh(v, k, 167) % 12
        c.put(x, y, GR[5]); c.put(x, y + 1, GR[3])
    return c


# ================================================================ 카탈로그 묶음
def terrain_tiles():
    return {
        'fld_trail32': [trail(m, v) for v in range(2) for m in range(16)],
        'fld_tall32': [tall(m, v) for v in range(2) for m in range(16)],
        'fld_forest32': [forest(m, v) for v in range(2) for m in range(16)],
        'fld_bog94': bog47_set(2),
        'fld_rock64': mass_set(4, False),
        'fld_face16': face_set(2, False),
        'cav_floor': [cave_floor(v) for v in range(6)],
        'cav_lit': [cave_lit(v) for v in range(4)],
        'cav_ceil32': mass_set(2, True),
        'cav_face16': face_set(2, True),
        'cav_pool94': cave_pool47(2),
    }
