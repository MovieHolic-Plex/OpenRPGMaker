"""desert_east 건물 부품 화법 — 평지붕(난간 테 + 윗면 슬래브), 벽면(흙벽돌·사암·회칠), 아치 문(사람 크기 12~14×24px), 창, 들보 끝, 돔·양파 돔, 차양.

규칙(3/4 탑뷰): 지붕 윗면은 2칸 이상(32px+) 보이고 밝다. 뒤 가장자리는 어두운 선, 앞 난간 테는 가장 밝은 줄. 앞 벽면은 2칸(32px)이고 지붕보다 한두 단 어둡다.
빛은 왼쪽 위: 왼쪽 모서리 기둥 한 줄 밝게, 오른쪽 끝 어둡게. 바닥 접지 선은 같은 재질 최암 단.
"""
import math
from px import C, rnd, h32, NT, MI

# 재질별 (바탕 벽 단, 지붕 단) — 램프 길이가 7 이면 단을 그대로, 6 이면 하나 낮춘다
WALL = dict(adobe=3, stone=3, plaster=3, sand=3)
ROOF = dict(adobe=5, stone=5, plaster=4, sand=5)


def top(mat): return NT[MI[mat]] - 1


def wall_tex(c, x, y, w, h, mat, kind=None, s=1):
    """벽면 결. adobe: 진흙 미장 + 드문 흙벽돌 줄눈 드러남 · stone: 사암 마름돌 쌓기 · plaster: 회칠(얼룩·빗물 자국)."""
    kind = kind or mat
    base = WALL.get(mat, 3)
    T = top(mat)
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            t = base
            if kind == 'stone':
                row = Y // 5; ly = Y % 5
                xs = X + (5 if row % 2 else 0); col = xs // 10; lx = xs % 10
                if ly == 4 or lx == 9: t = base - 2
                else:
                    v = h32(col, row, s) % 5
                    t = base + (1 if v == 0 else -1 if v == 4 else 0)
                    if ly == 0 and lx < 8: t += 1
                    if rnd(X, Y, s + 3) < 0.06: t -= 1
            elif kind == 'adobe':
                r = rnd(X, Y, s)
                if r < 0.07: t = base - 1
                elif r > 0.95: t = base + 1
                # 미장이 떨어져 흙벽돌이 드러난 자리(덩이)
                cx, cy = X // 9, Y // 7
                if rnd(cx, cy, s + 5) < 0.18:
                    lx, ly = X % 9, Y % 7
                    if 1 <= lx <= 7 and 1 <= ly <= 5:
                        if ly in (3,) or lx in (4,) and ly < 3 or lx == 1 and ly > 3: t = base - 2
                        elif ly in (1, 4): t = base + 1
            else:   # plaster
                r = rnd(X, Y, s)
                if r < 0.04: t = base - 1
                elif r > 0.97: t = base + 1
                if rnd(X, Y // 6, s + 9) < 0.02: t = base - 1
            c.P(X, Y, mat, max(0, min(T, t)))


def flat_roof(c, x, y, w, h, mat, s=1, jars=(), hatch=None, rug=None):
    """평지붕: 난간 테(뒤·좌·우·앞) + 안쪽 슬래브(다진 진흙/회칠). x,y,w,h = 지붕 칸 영역(화소). 앞 난간 테는 h-3..h-1 줄."""
    T = top(mat); rb = ROOF[mat] if T >= 6 else ROOF[mat] - 1
    # 슬래브
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            t = rb
            # 큰 덩이 얼룩(미장 덧바름 자리) — 넓은 슬래브가 한 색으로 보이지 않게
            q = rnd(X // 3, Y // 2, s + 40) * 0.6 + rnd((X + 1) // 4, (Y + 1) // 3, s + 41) * 0.4
            if q < 0.12: t = rb - 1
            elif q > 0.93 and rb + 1 <= T: t = rb + 1
            r = rnd(X, Y, s + 21)
            if r < 0.06: t = rb - 1
            elif r > 0.96: t = rb + 1
            if (X * 3 + Y * 5) % 23 == 0 and rnd(X, Y, s) < 0.5: t = rb - 1      # 미장 갈라짐 점
            c.P(X, Y, mat, min(T, t))
    # 안쪽 그늘(뒤 난간 밑·왼 난간 옆)
    c.HL(x + 3, y + 4, w - 6, mat, rb - 1); c.HL(x + 3, y + 5, w - 6, mat, rb - 1) if h > 24 else None
    c.VL(x + 4, y + 4, h - 7, mat, rb - 1)
    # 뒤 난간: 바깥 선 · 테 윗면 · 안쪽 면
    c.HL(x, y, w, mat, 1); c.HL(x, y + 1, w, mat, T); c.HL(x, y + 2, w, mat, T - 1); c.HL(x + 3, y + 3, w - 6, mat, rb - 2)
    # 좌 난간
    c.VL(x, y, h, mat, 1); c.VL(x + 1, y + 1, h - 1, mat, T); c.VL(x + 2, y + 1, h - 1, mat, T - 1); c.VL(x + 3, y + 3, h - 6, mat, rb - 2)
    # 우 난간(안쪽 면은 서향 — 빛을 받는다)
    c.VL(x + w - 1, y, h, mat, 1); c.VL(x + w - 2, y + 1, h - 1, mat, T - 1); c.VL(x + w - 3, y + 1, h - 1, mat, T - 2); c.VL(x + w - 4, y + 3, h - 6, mat, rb)
    # 앞 난간 테(가장 밝은 줄)
    c.HL(x + 1, y + h - 3, w - 2, mat, T - 1); c.HL(x + 1, y + h - 2, w - 2, mat, T); c.HL(x + 1, y + h - 1, w - 2, mat, T - 1)
    c.HL(x + 3, y + h - 4, w - 6, mat, rb + 1 if rb + 1 <= T else T)
    c.P(x + 1, y + 1, mat, T); c.P(x + w - 2, y + 1, mat, T - 1)
    # 물받이 홈통(앞 난간에서 튀어나온 나무 관) — 벽에 그림자
    for k, sx in enumerate(range(x + 10, x + w - 8, 26)):
        c.R(sx, y + h - 2, 2, 4, 'wood', 3); c.HL(sx, y + h - 2, 2, 'wood', 5); c.HL(sx, y + h + 1, 2, 'wood', 1)
        c.P(sx + 2, y + h + 1, mat, 1); c.P(sx + 2, y + h + 2, mat, 1); c.P(sx, y + h + 2, mat, 1); c.P(sx + 1, y + h + 2, mat, 1)
    for (jx, jy) in jars: roof_jar(c, x + jx, y + jy)
    if hatch: roof_hatch(c, x + hatch[0], y + hatch[1], mat)
    if rug: roof_rug(c, x + rug[0], y + rug[1], rug[2], rug[3], rug[4] if len(rug) > 4 else 'red')


def roof_jar(c, x, y):
    """지붕 위 물 항아리(윗면 아가리 보임) 5×6."""
    c.R(x + 1, y + 1, 4, 5, 'adobe', 4); c.VL(x, y + 2, 3, 'adobe', 3); c.VL(x + 5, y + 2, 3, 'adobe', 2)
    c.HL(x + 1, y + 1, 4, 'adobe', 5); c.HL(x + 2, y + 1, 2, 'adobe', 1)          # 아가리(안쪽 어둡게)
    c.HL(x + 1, y, 4, 'adobe', 6)
    c.VL(x + 4, y + 2, 4, 'adobe', 3); c.P(x + 1, y + 3, 'adobe', 6)
    c.HL(x + 1, y + 6, 4, 'adobe', 1)


def roof_hatch(c, x, y, mat):
    """지붕 출입구 + 사다리 끝 6×5."""
    c.R(x, y, 7, 5, mat, 1); c.R(x + 1, y + 1, 5, 3, 'void', 1)
    c.VL(x + 2, y, 5, 'wood', 4); c.VL(x + 5, y, 5, 'wood', 3)
    for k in (1, 3): c.HL(x + 2, y + k, 4, 'wood', 2)
    c.P(x + 2, y - 1, 'wood', 5); c.P(x + 5, y - 1, 'wood', 4)


def roof_rug(c, x, y, w, h, col='red'):
    """지붕에 말리는 깔개(위에서 본 판)."""
    c.R(x, y, w, h, col, 3)
    c.HL(x, y, w, col, 4); c.HL(x, y + h - 1, w, col, 1)
    c.R(x + 2, y + 2, w - 4, h - 4, 'saffron' if col != 'saffron' else 'red', 3)
    c.R(x + 3, y + 3, w - 6, h - 6, col, 2)
    for i in range(0, w, 2): c.P(x + i, y + h, 'plaster', 4)      # 술


def beams(c, x, y, w, step=6, off=3):
    """들보 끝(흙집 벽 윗단에 튀어나온 나무): 2×2 끝 + 밑 그늘."""
    for bx in range(x + off, x + w - 2, step):
        c.P(bx, y, 'dwood', 3); c.P(bx + 1, y, 'dwood', 2); c.P(bx, y + 1, 'dwood', 2); c.P(bx + 1, y + 1, 'dwood', 1)
        g = c.get(bx, y + 2)
        if g: c.P(bx, y + 2, g[0], max(0, g[1] - 1)); c.P(bx + 1, y + 2, g[0], max(0, g[1] - 1))


def wall(c, x, y, w, h, mat, s=1, kind=None, plinth=True, cornerL=True, cornerR=True):
    """앞 벽면 + 위 덮개 그늘 + 아래 기단 + 모서리 명암."""
    wall_tex(c, x, y, w, h, mat, kind, s)
    T = top(mat)
    c.HL(x, y, w, mat, WALL[mat] - 1); c.HL(x, y + 1, w, mat, WALL[mat] - 2)        # 난간 밑 그늘
    if plinth:
        c.HL(x, y + h - 4, w, mat, WALL[mat] + 1)
        c.R(x, y + h - 3, w, 2, mat, WALL[mat] - 1); c.HL(x, y + h - 1, w, mat, 1)
    if cornerL: c.VL(x, y, h, mat, 1); c.VL(x + 1, y + 2, h - 3, mat, min(T, WALL[mat] + 1))
    if cornerR: c.VL(x + w - 1, y, h, mat, 0); c.VL(x + w - 2, y + 2, h - 3, mat, WALL[mat] - 1)


def arch_mask(w, h, r=None):
    """폭 w, 높이 h 의 반원 아치 개구부(아래가 열린). (i,j) 집합."""
    r = r if r is not None else w / 2
    out = set()
    for j in range(h):
        for i in range(w):
            if j >= r: out.add((i, j)); continue
            dx = i + 0.5 - w / 2; dy = r - (j + 0.5)
            if dx * dx + dy * dy <= r * r: out.add((i, j))
    return out


def door(c, x, y, w=12, h=24, style='wood', frame=('plaster', 5), s=0, open_=False):
    """아치 문. x,y = 개구부 왼쪽 위(아치 꼭대기 줄). 기본 12×24(사람 16×24 기준). style: wood·turq·open(어두운 통로)·curtain."""
    m = arch_mask(w, h)
    fm, ft = frame
    # 틀(돌 홍예): 개구부 둘레 1~2화소
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-1, -1), (1, -1), (-2, 0), (2, 0), (0, -2)):
            if (i + dx, j + dy) not in m:
                X, Y = x + i + dx, y + j + dy
                if Y < y + h:
                    lit = dx < 0 or dy < 0
                    c.P(X, Y, fm, ft if lit and dx <= 0 else ft - 1)
    # 홍예 쐐기돌 줄눈
    for k in range(-2, w + 2, 3):
        X = x + k;
    for (i, j) in m:
        X, Y = x + i, y + j
        if style == 'open':
            t = 0 if j > 3 else 1
            c.P(X, Y, 'void', t)
        elif style == 'curtain':
            col = 'red' if s % 2 == 0 else 'indigo'
            t = 3 if (i % 4) in (0, 1) else 2
            if i < 2: t = 1
            c.P(X, Y, col, t)
        else:
            mat = 'turq' if style == 'turq' else 'dwood'
            base = 2 if mat == 'turq' else 3
            t = base
            if i % 4 == 3: t = base - 1                         # 판자 홈
            if i == 0: t = base - 1
            if i == w - 1: t = base - 2
            if j < 2 and (i, j - 1) not in m: t = base - 2       # 아치 밑 그늘
            c.P(X, Y, mat, max(0, t))
    if style in ('wood', 'turq'):
        # 쇠 띠·징·고리
        for yy in (y + h // 2 - 2, y + h - 6):
            for i in range(w):
                if (i, yy - y) in m: c.P(x + i, yy, 'rock', 2 if style == 'wood' else 1)
            for i in range(1, w, 3):
                if (i, yy - y) in m: c.P(x + i, yy, 'gold', 4)
        c.VL(x + w // 2, y + 3, h - 3, 'dwood', 1) if style == 'wood' else c.VL(x + w // 2, y + 3, h - 3, 'turq', 0)
        c.P(x + w // 2 - 2, y + h // 2 + 2, 'gold', 5); c.P(x + w // 2 + 1, y + h // 2 + 2, 'gold', 4)
    # 문턱(밝은 윗면 한 줄)
    c.HL(x - 1, y + h - 1, w + 2, fm, ft)


def window(c, x, y, w=6, h=8, style='lattice', frame=('plaster', 5)):
    """작은 아치 창. style: lattice(나무 격자 마슈라비야) · shutter(청록 덧문 열림) · dark(어두운 구멍)."""
    m = arch_mask(w, h)
    fm, ft = frame
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1)):
            if (i + dx, j + dy) not in m: c.P(x + i + dx, y + j + dy, fm, ft if dx <= 0 else ft - 1)
    for (i, j) in m:
        t = 0 if j < h // 2 else 1
        c.P(x + i, y + j, 'void', t)
        if style == 'lattice' and ((i + j) % 2 == 0): c.P(x + i, y + j, 'dwood', 3 if j < h // 2 else 2)
    if style == 'shutter':
        for side, xx in ((0, x - 3), (1, x + w + 1)):
            c.R(xx, y + 2, 2, h - 2, 'turq', 3 if side == 0 else 2)
            c.VL(xx + (1 if side == 0 else 0), y + 2, h - 2, 'turq', 1)
            c.HL(xx, y + 2, 2, 'turq', 4)
    # 창턱
    c.HL(x - 1, y + h, w + 2, fm, ft); c.HL(x - 1, y + h + 1, w + 2, fm, ft - 3)


def dome(c, cx, by, r, mat='turq', ry=None, drum=3, drum_mat='plaster', finial=True, ribs=True):
    """반구 돔(위에서 비스듬히 본 반원 + 아래 북 drum). cx = 가운데, by = 북 밑줄 y. r = 반지름."""
    ry = ry or r
    T = top(mat)
    # 북(원통 앞면)
    if drum:
        for j in range(drum):
            for i in range(-r, r + 1):
                t = (top(drum_mat) - 2) if i < 0 else (top(drum_mat) - 3)
                if i == -r: t = top(drum_mat) - 1
                if i == r: t = 1
                if j == drum - 1: t = 1
                c.P(cx + i, by - drum + 1 + j, drum_mat, t)
        c.HL(cx - r, by - drum, 2 * r + 1, drum_mat, top(drum_mat))
    base = by - drum
    for j in range(ry + 1):
        for i in range(-r, r + 1):
            dx = (i + 0.5) / (r + 0.5); dy = (ry - j - 0.5) / (ry + 0.5)
            d = dx * dx + dy * dy
            if d > 1: continue
            Y = base - ry + j
            # 빛(왼쪽 위): 법선 성분
            nz = math.sqrt(max(0, 1 - d))
            lum = (-dx * 0.55 + dy * 0.45 + nz * 0.75)
            t = 1 + int(lum * (T - 1) + 0.35)
            if ribs and mat == 'turq':
                # 타일 비늘 무늬: 세로 갈비 + 가로 띠
                if (i + r) % 4 == 0 and abs(dx) < 0.9: t -= 1
                if (j % 4 == 2) and rnd(i, j, 3) < 0.5: t -= 1
            if d > 0.86: t = min(t, 2) if dx > -0.2 else min(t, 3)
            c.P(cx + i, Y, mat, max(0, min(T, t)))
    # 하이라이트 점
    c.P(cx - r // 2, base - int(ry * 0.65), mat, T); c.P(cx - r // 2 + 1, base - int(ry * 0.65), mat, T - 1)
    if finial:
        c.VL(cx, base - ry - 3, 3, 'gold', 3); c.P(cx, base - ry - 4, 'gold', 5); c.P(cx - 1, base - ry - 2, 'gold', 2)


def onion(c, cx, by, r, h, mat='turq', drum=4, drum_mat='plaster', finial=True):
    """양파 돔: 아래 북 + 불룩한 몸 + 뾰족한 끝. h = 돔 몸 높이(북 제외)."""
    T = top(mat)
    if drum:
        dr = r - 1
        for j in range(drum):
            for i in range(-dr, dr + 1):
                t = top(drum_mat) - 2 if i < 0 else top(drum_mat) - 3
                if i == -dr: t = top(drum_mat) - 1
                if i == dr: t = 1
                c.P(cx + i, by - drum + 1 + j, drum_mat, t)
        c.HL(cx - dr, by - drum + 1, 2 * dr + 1, drum_mat, top(drum_mat))
        # 아치 창 줄
        for i in range(-dr + 2, dr - 1, 3): c.VL(cx + i, by - drum + 2, max(1, drum - 2), 'void', 1)
    base = by - drum
    for j in range(h):
        u = j / max(1, h - 1)              # 0 = 끝, 1 = 밑
        # 폭 곡선: 끝 뾰족 → 0.62 지점 최대 → 밑에서 조금 좁아짐
        if u < 0.62: wv = r * 1.05 * math.sin(u / 0.62 * math.pi / 2) ** 1.6
        else: wv = r * (1.05 - 0.35 * ((u - 0.62) / 0.38) ** 2)
        Y = base - h + 1 + j
        for i in range(-int(wv + 0.5), int(wv + 0.5) + 1):
            dx = i / max(1.0, wv + 0.5)
            lum = -dx * 0.6 + (1 - u) * 0.25 + math.sqrt(max(0, 1 - dx * dx)) * 0.7
            t = 1 + int(lum * (T - 1) + 0.3)
            if abs(dx) > 0.82: t = min(t, 2 if dx > 0 else 3)
            if mat in ('turq', 'gold') and (i + 20) % 3 == 0 and abs(dx) < 0.85 and 0.15 < u: t -= 1
            c.P(cx + i, Y, mat, max(0, min(T, t)))
    c.P(cx - max(1, r // 3), base - int(h * 0.45), mat, T)
    if finial:
        c.VL(cx, base - h - 3, 4, 'gold', 3); c.P(cx, base - h - 4, 'gold', 5); c.P(cx - 1, base - h - 1, 'gold', 4); c.P(cx + 1, base - h - 1, 'gold', 2)


def awning(c, x, y, w, depth=6, front=4, col='red', col2='plaster'):
    """줄무늬 차양: 윗면(비스듬히 보이는 천, 세로 줄) depth 줄 + 앞 늘어뜨린 술 front 줄(물결 끝) + 밑 그늘은 호출자가."""
    for j in range(depth):
        for i in range(w):
            stripe = (i // 3) % 2 == 0
            m, t = (col, 3) if stripe else (col2, top(col2) - 1)
            if j == 0: t -= 1
            if j == depth - 1: t += 1
            if i == 0 or i == w - 1: t -= 1
            c.P(x + i, y + j, m, max(0, min(top(m), t)))
    for j in range(front):
        for i in range(w):
            stripe = (i // 3) % 2 == 0
            m, t = (col, 2) if stripe else (col2, top(col2) - 2)
            if j == front - 1 and (i % 3 == 1): continue          # 물결 끝
            c.P(x + i, y + depth + j, m, t)
    c.HL(x, y - 1, w, 'wood', 2)


def pointed_mask(w, h, rise=None):
    """뾰족 아치(두 원호) 개구부."""
    rise = rise if rise is not None else int(w * 0.75)
    out = set()
    R_ = w * 0.85
    for j in range(h):
        for i in range(w):
            if j >= rise: out.add((i, j)); continue
            yy = rise - (j + 0.5)
            # 왼쪽 호 중심 (w - R_, rise), 오른쪽 호 중심 (R_, rise)
            xl = (i + 0.5) - (w - R_); xr = (i + 0.5) - R_
            if xl * xl + yy * yy <= R_ * R_ and xr * xr + yy * yy <= R_ * R_: out.add((i, j))
    return out


def fill_mask(c, x, y, m, fn):
    for (i, j) in m:
        r = fn(i, j)
        if r: c.P(x + i, y + j, *r)


def mask_border(m, i, j):
    return any((i + dx, j + dy) not in m for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))


def tile_band(c, x, y, w, h, s=0, base='turq', alt='lapis'):
    """기하 타일 띠(글자 없음): 마름모 + 십자 반복."""
    for j in range(h):
        for i in range(w):
            X, Y = i, j
            d = (abs((X % 6) - 2.5) + abs((Y % 6) - 2.5))
            if d < 1.6: m, t = 'gold', 4
            elif d < 3.1: m, t = base, 3
            else: m, t = alt, 2
            if j == 0: t = min(top(m), t + 1)
            if j == h - 1: t = max(0, t - 1)
            c.P(x + i, y + j, m, t)


def pishtaq(c, x, y, w, h, door_w=14, mat='stone', door_style='wood', s=0, open_=False, no_door=False):
    """큰 아치 문루(이완): 윗면 4줄 + 청록 타일 테 + 안쪽 뾰족 아치 움푹(그늘) + 바닥 문 24px."""
    T = top(mat)
    c.R(x, y, w, 4, mat, T); c.HL(x, y, w, mat, 1); c.HL(x, y + 3, w, mat, T - 1); c.R(x + 1, y + 1, w - 2, 2, mat, T - 1)
    wall_tex(c, x, y + 4, w, h - 4, mat, 'stone' if mat == 'stone' else None, s)
    c.VL(x, y, h, mat, 1); c.VL(x + 1, y + 4, h - 4, mat, T - 1); c.VL(x + w - 1, y, h, mat, 0); c.VL(x + w - 2, y + 4, h - 4, mat, 2)
    # 타일 테
    bx, by, bw, bh = x + 3, y + 6, w - 6, h - 6
    tile_band(c, bx, by, bw, 3, s)
    for j in range(by + 3, y + h - 1):
        for i in (0, 1, 2):
            c.P(bx + i, j, 'turq', 3 if i == 1 else 2); c.P(bx + bw - 1 - i, j, 'turq', 2 if i == 1 else 1)
    # 안쪽 뾰족 아치 움푹(위쪽 그늘 → 아래 밝아짐)
    iw = bw - 8; ix = bx + 4; iy = by + 5; ih = y + h - iy
    m = pointed_mask(iw, ih, rise=int(iw * 0.7))
    def rec(i, j):
        t = 2 if j < ih * 0.35 else 3
        if i < 2: t -= 1
        if mask_border(m, i, j): return ('plaster' if mat != 'plaster' else 'stone', 4)
        # 무카르나스: 위쪽에 작은 아치 비늘 두 줄(밝은 테 + 어두운 속)
        if j < ih * 0.26:
            row = j // 4; lx = (i + (2 if row % 2 else 0)) % 4; ly = j % 4
            if ly == 0 or (ly == 1 and lx in (0, 3)): return (mat, 5 if mat != 'plaster' else 4)
            if lx in (1, 2) and ly >= 1: return (mat, t - 1)
        return (mat, t)
    fill_mask(c, ix, iy, m, rec)
    if no_door: return
    dx = x + (w - door_w) // 2
    door(c, dx, y + h - 24, door_w, 24, style='open' if open_ else door_style, frame=('gold', 3), s=s)
