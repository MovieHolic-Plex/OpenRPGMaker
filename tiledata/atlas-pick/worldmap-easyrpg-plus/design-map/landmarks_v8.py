"""월드맵 설계 데모 8단계 — 랜드마크 재작도: 천공섬 · 거목 · 사막 신전 · 폐허 도시.

원본 EasyRPG World.png(CC BY 4.0)을 8배로 재어 본 문법을 따른다(원본 픽셀을 베끼지 않고, 원본 색만 쓴다).
 · 큰 나무(원본 18,10 2x2칸): 테두리 선이 따로 없다. 수관 윗·왼쪽 가장자리는 어두운 초록(13522e/218238) 자체가 테이고,
   아래·오른쪽만 1d2c33/000000 로 닫힌다. 속은 7ac83c/40a837 밝은 덩이 사이로 218238/13522e 가 알갱이처럼 박히고,
   덩이 줄의 아래끝이 어두운 가로띠가 되어 층이 읽힌다. 줄기는 411e05·63310b·6d3b15·9a5435, 뿌리가 옆으로 벌어진다.
 · 숲 칸(원본 0,12): 덩이 하나가 지름 6~7px, 가운데 7ac83c, 아래쪽에 1d2c33 점.
 · 절벽(원본 21,4~7): 291010/411e05 어두운 바탕 위에 8c5a21/a77b4b 밝은 돌 덩이(폭 3~6, 높이 2~3)가
   엇갈린 줄로 박힌다. 덩이마다 윗줄 65442a·아랫줄 4f2e21 테. 매끈한 띠나 물결 줄무늬는 없다.
 · 성(원본 20,10): 1px 111618 테, 빛은 왼쪽 위, 6단 명암 + 체크 디더.
3/4 계약: 모든 구조는 윗면 T + 앞면 F, 빛은 왼쪽 위, 그림자는 오른쪽 아래.
좌표는 전부 손으로 적었고 생성 이미지·트레이싱은 없다.
"""
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from landmarks_v6 import C, KEY, H, hx, STONE, CRYS, WATER  # noqa: E402
import landmarks_v7 as L7  # noqa: E402
import ext2_castle as EC  # noqa: E402
from wm_ext2_lib import is_key, crop  # noqa: E402

# ── 원본 World.png 에 있는 색만 ──────────────────────────────────────────────────────────
TREE = [hx(c) for c in ('1d2c33', '13522e', '218238', '40a837', '7ac83c')]          # 0 테 · 1..4 어둠→밝음
BLACK = hx('000000')
TRUNK = [hx(c) for c in ('000000', '411e05', '63310b', '6d3b15', '9a5435')]
GRS = [hx(c) for c in ('3c8f4b', '419d39', '5ba644')]                                 # 풀 바탕 3색
CLIFF = [hx(c) for c in ('291010', '411e05', '4f2e21', '65442a', '8c5a21', 'a77b4b', 'b48858')]   # 0..6
S = STONE   # 0 2a2833 · 1 363540 · 2 493f59 · 3 515567 · 4 66648b · 5 78739c · 6 9a95bd
OL = hx('111618')
PALE, PALE2 = hx('aac3b5'), hx('8ca9a3')
MOSS, MOSS2 = hx('77693c'), hx('675144')
# 사막 돌: 원본 절벽·흙 칸과 신전 아이콘(22,12)의 색만
SANDST = [hx(c) for c in ('4f2e21', '65442a', '987046', 'a77b4b', 'b48858', 'beab7f', 'd8cbac', 'e1d7c1')]   # 0..7


def _orig():
    from wm_ext2_lib import ORIG
    return ORIG


def tree_stamp():
    """원본 숲 칸(0,12) 가운데 나무 한 그루를 풀색을 빼고 오려 쓴다(원본 픽셀 재사용, CC BY 4.0)."""
    a = _orig()[192 + 4:192 + 15, 1:13].copy()
    grass = np.zeros(a.shape[:2], bool)
    for g in GRS:
        grass |= (a == g).all(-1)
    a[grass] = KEY
    return a


def blit(c, a, x, y):
    L7.blit(c, a, x, y)


# ── 덩이 수관 ───────────────────────────────────────────────────────────────────────────
def canopy(c, lumps, seed=1, top_y=None, bot_y=None, lx=None, rx=None, dark_bias=0.0):
    """lumps: 뒤(위)→앞(아래) 순서 (cx, cy, r). 덩이 안은 왼쪽 위가 밝고, 덩이 아래끝이 어두운 띠가 된다.
    전체도 아래로 갈수록 어둡다(원본 큰 나무처럼 아랫줄은 13522e/1d2c33)."""
    mk_all = np.zeros((c.h, c.w), bool)
    for (cx, cy, r) in lumps:
        mk_all |= c.ell(cx, cy, r, int(round(r * .82)))
    ys, xs = np.nonzero(mk_all)
    ty, by = (ys.min(), ys.max()) if top_y is None else (top_y, bot_y)
    x0, x1 = (xs.min(), xs.max()) if lx is None else (lx, rx)
    idx = np.full((c.h, c.w), -1, int)
    for k, (cx, cy, r) in enumerate(lumps):
        ry = int(round(r * .82))
        m = c.ell(cx, cy, r, ry)
        # 덩이 모양을 조금 울퉁불퉁하게: 가장자리 1px 을 해시로 깎는다
        edge = m & ~c.ell(cx, cy, r - 1, max(ry - 1, 1))
        m &= ~(edge & (H(c.X, c.Y, seed + k * 7) > .72))
        d = np.sqrt(((c.X - (cx - r * .38)) / (r * 1.25)) ** 2 + ((c.Y - (cy - ry * .5)) / (ry * 1.25)) ** 2)
        gy = (c.Y - ty) / max(by - ty, 1)
        gx = (c.X - x0) / max(x1 - x0, 1)
        v = 1.08 - .78 * d - .46 * gy - .22 * gx - dark_bias
        v += (H(c.X, c.Y, seed + 31) - .5) * .30 + (H(c.X // 2, c.Y // 2, seed + 32) - .5) * .16
        q = np.where(v > .66, 4, np.where(v > .40, 3, np.where(v > .18, 2, 1)))
        # 덩이 아랫가장자리: 어두운 띠(다음 덩이와의 틈)
        below = m & ~np.roll(m, -1, 0)
        below2 = m & ~np.roll(m, -2, 0) & ~below
        q = np.where(below, 1, np.where(below2, np.minimum(q, 2), q))
        # 덩이 오른쪽 아래 테: 한 단 어둡게(체크 디더로 반만)
        dc = np.sqrt(((c.X - cx) / float(r)) ** 2 + ((c.Y - cy) / float(ry)) ** 2)
        lr = m & (dc > .62) & ((c.X - cx) * .6 + (c.Y - cy) > 0)
        q = np.where(lr & ((((c.X + c.Y) & 1) == 0) | (dc > .85)), np.minimum(q, 2), q)
        rb = below & (c.X > cx) & (H(c.X, c.Y, seed + 5) > .45)
        q = np.where(rb, 0, q)
        idx[m] = q[m]
    pal = np.array(TREE, np.uint8)
    sel = idx >= 0
    c.px[sel] = pal[idx[sel]]
    c.m |= sel
    return mk_all & sel


def canopy_edges(c, mk):
    """원본 큰 나무 테: 위·왼쪽 가장자리는 어두운 초록(수관 안쪽 픽셀), 아래·오른쪽은 1d2c33/000000 바깥 테."""
    up = mk & ~np.roll(mk, 1, 0)
    lf = mk & ~np.roll(mk, 1, 1)
    top_edge = (up | lf)
    c.px[top_edge & (H(c.X, c.Y, 41) > .5)] = TREE[1]
    c.px[top_edge & (H(c.X, c.Y, 41) <= .5)] = TREE[2]
    dn = ~mk & np.roll(mk, 1, 0)
    rt = ~mk & np.roll(mk, 1, 1)
    out = (dn | rt) & ~c.m
    c.px[out & (H(c.X, c.Y, 43) > .45)] = BLACK
    c.px[out & (H(c.X, c.Y, 43) <= .45)] = TREE[0]
    c.m |= out


def shadow_dither(c, mk, col, dense=None):
    """바닥 그림자: dense 안쪽은 꽉, 바깥은 체크 디더."""
    chk = ((c.X + c.Y) & 1) == 0
    sel = mk & ~c.m & (chk | (dense if dense is not None else False))
    c.px[sel] = col
    c.m |= sel


# ── 절벽 돌 덩이 결(원본 절벽 문법) ─────────────────────────────────────────────────────────
def rock_lumps(c, mk, P, seed=1, lit=None, period=(7, 5), dens=.82):
    """mk 영역을 어두운 바탕(P0/P1) + 밝은 돌 덩이(P4/P5, 윗테 P3, 아랫테 P2)로 채운다.
    lit: 0~1 밝기(왼쪽 위=1). 밝기가 낮으면 덩이가 작고 어둡다. P 는 7단(0 가장 어두움)."""
    if lit is None:
        lit = np.full((c.h, c.w), .6)
    pal = np.array(P, np.uint8)
    base = np.where(H(c.X, c.Y, seed) < .40 + .25 * lit, 1, 0)
    idx = base.copy()
    px_, py_ = period
    ys, xs = np.nonzero(mk)
    if not len(ys):
        return
    for row in range(ys.min() // py_ - 1, ys.max() // py_ + 2):
        off = (row * 3 + int(H(row, 0, seed + 3) * 3)) % px_
        for col in range(xs.min() // px_ - 1, xs.max() // px_ + 2):
            if H(col, row, seed + 5) > dens:
                continue
            x = col * px_ + off + int(H(col, row, seed + 7) * 3) - 1
            y = row * py_ + int(H(col, row, seed + 9) * 2)
            if not (0 <= x < c.w and 0 <= y < c.h) or not mk[y, x]:
                continue
            L = lit[y, x]
            w = 2 + int(H(col, row, seed + 11) * 3) + (1 if L > .6 else 0)
            hh = 2 if H(col, row, seed + 13) < .6 else 3
            for yy in range(y, y + hh + 1):
                for xx in range(x - 1, x + w + 1):
                    if not (0 <= xx < c.w and 0 <= yy < c.h) or not mk[yy, xx]:
                        continue
                    if yy == y:                                  # 윗테
                        k = 3 if x <= xx < x + w else -1
                    elif yy == y + hh:                           # 아랫테(그늘)
                        k = 2 if x - 1 <= xx < x + w else -1
                    else:
                        if xx == x - 1:
                            k = 3
                        elif xx >= x + w:
                            k = 2
                        else:
                            u = (xx - x) / max(w - 1, 1)
                            k = 5 if (u < .45 and yy == y + 1 and L > .45) else 4
                            if L < .3:
                                k -= 1
                            if L > .8 and u < .3 and yy == y + 1:
                                k = 6
                    if k >= 0:
                        idx[yy, xx] = k
    sel = mk
    c.px[sel] = pal[idx[sel]]
    c.m |= sel


# ────────────────────────────────────────────────────────────────────────────────────────
def giant_tree():
    c = C(3, 3)
    # 바닥 그림자(오른쪽 아래로): 줄기 밑 짙은 초록 + 바깥 체크
    sh = c.ell(29, 44, 17, 3) | c.poly([(24, 41), (46, 41), (47, 45), (26, 46)])
    dense = c.ell(28, 44, 9, 2)
    # 줄기 + 뿌리
    tr = c.poly([(19, 30), (29, 30), (30, 38), (33, 43), (36, 45), (12, 45), (15, 43), (18, 38)])
    roots = c.poly([(12, 45), (7, 46), (6, 47), (13, 47), (17, 45)]) | c.poly([(31, 44), (38, 46), (41, 47), (34, 47), (30, 46)]) \
        | c.poly([(22, 44), (21, 47), (25, 47), (25, 44)])
    body = tr | roots
    u = (c.X - 12) / 22.0
    v = .95 - .95 * u + (H(c.X, c.Y // 3, 7) - .5) * .25
    q = np.where(v > .66, 4, np.where(v > .42, 3, np.where(v > .2, 2, 1)))
    # 세로 나무결(홈) — 줄마다 엇갈려 끊긴다
    for x, y0, y1 in ((17, 32, 41), (21, 31, 38), (26, 33, 43), (29, 36, 44), (15, 42, 46)):
        for y in range(y0, y1):
            if H(x, y, 3) > .18:
                q[y, x] = max(q[y, x] - 2, 1)
    pal = np.array(TRUNK, np.uint8)
    c.px[body] = pal[q[body]]
    c.m |= body
    # 뿌리 아랫줄 그늘
    bot = body & ~np.roll(body, -1, 0)
    c.px[bot] = TRUNK[1]
    # 줄기 속 구멍 문(아치) + 문턱
    door = c.poly([(23, 38), (26, 38), (26, 43), (23, 43)]) | c.ell(24, 38, 1, 2)
    c.put(door, BLACK)
    for (x, y) in ((21, 36), (22, 35), (23, 34), (24, 34), (25, 34)):
        c.dot(x, y, TRUNK[4])
    c.dot(26, 35, TRUNK[3]); c.dot(27, 36, TRUNK[2])
    for x in range(21, 28):
        c.dot(x, 44, TRUNK[4] if x < 24 else TRUNK[3])
    # 수관: 네 줄 덩이, 뒤(위)→앞(아래)
    lumps = [(18, 7, 7), (28, 5, 8), (38, 9, 6),
             (9, 14, 6), (20, 13, 8), (31, 12, 8), (41, 16, 5),
             (6, 22, 4), (15, 20, 8), (26, 20, 8), (37, 21, 7), (43, 23, 3),
             (11, 27, 6), (21, 28, 7), (32, 28, 7), (41, 27, 4)]
    mk = canopy(c, lumps, seed=11)
    canopy_edges(c, mk)
    # 수관 아래로 늘어진 잎 몇 가닥(줄기 앞)
    for (x, y) in ((17, 33), (18, 34), (30, 33), (12, 32)):
        c.dot(x, y, TREE[1])
    shadow_dither(c, sh, TREE[1], dense)
    return c.px


# ────────────────────────────────────────────────────────────────────────────────────────
def desert_temple():
    """계단식 신전(지구라트) 3/4: 층마다 윗면 T(밝은 판, 뒤쪽 한 줄은 윗층이 드리운 그늘) +
    앞면 F(벽돌 결, 왼쪽 밝음 → 오른쪽 어두움) + 가운데 앞 계단. 꼭대기 사당은 판 지붕 윗면 + 앞면 + 문.
    그림자는 오른쪽 아래 모래 위에 체크로."""
    c = C(3, 3)
    P = SANDST            # 0 4f2e21 · 1 65442a · 2 987046 · 3 a77b4b · 4 b48858 · 5 beab7f · 6 d8cbac · 7 e1d7c1
    # 층: (x0, x1, 윗면 y0, 앞면 y0, 앞면 y1). 윗층 앞면 밑줄 = 아래층 윗면 뒷줄 바로 위.
    tiers = [(2, 44, 32, 37, 44), (8, 38, 23, 28, 31), (14, 32, 14, 19, 22)]
    for i, (x0, x1, ty, fy0, fy1) in enumerate(tiers):
        w = x1 - x0
        for y in range(ty, fy0):                                          # 윗면 T
            for x in range(x0, x1 + 1):
                u = (x - x0) / w
                k = 6 if u < .62 else 5
                if .55 <= u < .62 and (x + y) & 1:
                    k = 5
                if y == ty and i < 2:
                    k = 3                                                 # 윗층 앞면이 드리운 그늘
                elif y == ty + 1 and i < 2 and (x + y) & 1:
                    k = min(k, 5)
                if y == fy0 - 1:
                    k = 7 if u < .5 else 6                                # 빛 받는 앞 모서리
                if H(x, y, 60 + i) > .95:
                    k -= 1
                c.dot(x, y, P[k])
        for y in range(fy0, fy1 + 1):                                     # 앞면 F
            row = (y - fy0) // 3
            for x in range(x0, x1 + 1):
                u = (x - x0) / w
                k = 4 if u < .22 else (3 if u < .72 else 2)
                if .22 <= u < .3 and (x + y) & 1:
                    k = 4
                if .72 <= u < .8 and (x + y) & 1:
                    k = 3
                if u >= .88:
                    k = 2 if (x + y) & 1 else 1
                if x >= x1 - 1:
                    k = 1
                if (y - fy0) % 3 == 2:
                    k -= 1                                                # 가로 줄눈
                elif (x + row * 5 + i * 3) % 9 == 0:
                    k -= 1                                                # 세로 줄눈(줄마다 엇갈림)
                elif H(x, y, 40 + i) > .93:
                    k += 1
                if y == fy0:
                    k = 2 if u < .72 else 1                               # 처마 밑 그늘
                c.dot(x, y, P[max(k, 0)])
        if i > 0:                                                         # 앞면 상형 띠
            for x in range(x0 + 3, x1 - 2, 4):
                if abs(x - 23) > 5:
                    c.dot(x, fy0 + 2, P[1]); c.dot(x + 1, fy0 + 2, P[1]); c.dot(x, fy0 + 1, P[5])
    # 앞 계단: 윗면 디딤(밝음) · 챌판(어두움) 교대, 양옆 난간(윗면 한 줄 + 앞면)
    cx = 23
    for (ty, fy0, fy1, hw) in ((14, 19, 22, 2), (23, 28, 31, 3), (32, 37, 44, 4)):
        for y in range(fy0, fy1 + 1):
            tread = (y - fy0) % 2 == 0
            for x in range(cx - hw, cx + hw + 1):
                if tread:
                    c.dot(x, y, P[6] if x <= cx else P[5])
                else:
                    c.dot(x, y, P[1] if x <= cx else P[0])
        for y in range(fy0 - 1, fy1 + 1):
            c.dot(cx - hw - 1, y, P[7] if y < fy0 else P[4])
            c.dot(cx + hw + 1, y, P[5] if y < fy0 else P[1])
    # 꼭대기 사당: 판 지붕 윗면(4줄) + 처마 앞면(2줄) + 벽 앞면 + 기둥 둘 + 문
    for y in range(3, 7):
        for x in range(15, 32):
            u = (x - 15) / 16
            k = 6 if u < .6 else 5
            if y == 3:
                k = 5
            if y == 6:
                k = 7 if u < .5 else 6
            c.dot(x, y, P[k])
    for x in range(14, 33):
        c.dot(x, 7, P[3] if x < 27 else P[2])
        c.dot(x, 8, P[1])
    for y in range(9, 14):
        for x in range(16, 31):
            u = (x - 16) / 14
            k = 3 if u < .7 else 2
            if y == 9:
                k = 1
            c.dot(x, y, P[k])
    for x0 in (16, 28):
        for y in range(9, 14):
            c.dot(x0, y, P[6]); c.dot(x0 + 1, y, P[4]); c.dot(x0 + 2, y, P[1])
    c.put(c.rect(21, 10, 25, 13), OL)
    c.dot(22, 9, OL); c.dot(23, 9, OL); c.dot(24, 9, OL)
    c.dot(20, 10, P[5]); c.dot(21, 9, P[5]); c.dot(25, 9, P[3]); c.dot(26, 10, P[2])
    for x in range(21, 26):                                               # 지붕 위 제단
        c.dot(x, 1, P[7] if x < 24 else P[6]); c.dot(x, 2, P[3] if x < 24 else P[1])
    # 양옆 오벨리스크: 꼭지 윗면 두 면 + 앞면(왼쪽 밝음)
    for x0 in (0, 43):
        for y in range(22, 42):
            c.dot(x0, y, P[5]); c.dot(x0 + 1, y, P[4]); c.dot(x0 + 2, y, P[3]); c.dot(x0 + 3, y, P[1])
            if (y - 22) % 5 == 4:
                c.dot(x0 + 1, y, P[2]); c.dot(x0 + 2, y, P[1])
        c.dot(x0 + 1, 19, P[7]); c.dot(x0 + 2, 19, P[5])
        for x, k in ((x0, 7), (x0 + 1, 7), (x0 + 2, 5), (x0 + 3, 4)):
            c.dot(x, 20, P[k])
        for x, k in ((x0, 6), (x0 + 1, 6), (x0 + 2, 4), (x0 + 3, 2)):
            c.dot(x, 21, P[k])
        for x in range(x0 - 1, x0 + 5):
            c.dot(x, 42, P[6] if x < x0 + 2 else P[4]); c.dot(x, 43, P[2] if x < x0 + 2 else P[1])
    c.outline()
    ol = (c.px == np.array((17, 22, 24), np.uint8)).all(-1)
    c.px[ol] = OL
    # 그림자: 오른쪽 옆 + 아래
    sh = c.poly([(45, 29), (47, 29), (47, 47), (6, 47), (6, 46), (45, 46)])
    dense = c.poly([(45, 34), (46, 34), (46, 47), (12, 47), (12, 46), (45, 46)])
    shadow_dither(c, sh, P[3], dense)
    return c.px


# ────────────────────────────────────────────────────────────────────────────────────────
def sky_island():
    """떠 있는 섬: 윗면 풀밭(원본 숲 칸 나무, 작은 사당, 샘) + 앞 절벽면(절벽 돌 덩이 결) +
    아래로 좁아지는 바위 밑동(지층 턱 · 매달린 뿌리 · 뾰족한 바위 끝). 빛은 왼쪽 위."""
    c = C(5, 4)
    W = c.w
    # 윗면 윤곽: 손으로 적은 들쭉날쭉한 타원
    top_pts = [(6, 17), (9, 12), (16, 9), (26, 7), (38, 6), (50, 7), (61, 9), (69, 11), (75, 15), (76, 19), (72, 22),
               (62, 24), (50, 25), (36, 25), (22, 24), (12, 23), (7, 21)]
    top = c.poly(top_pts)
    # 앞 절벽면: 윗면 앞 가장자리 아래로 7~9px, 그 아래 밑동(층층이 좁아짐)
    under_pts = [(6, 18), (7, 23), (9, 28), (14, 31), (18, 36), (24, 38), (27, 44), (32, 47), (35, 54), (38, 60), (40, 62),
                 (42, 57), (45, 51), (49, 47), (52, 49), (54, 44), (58, 40), (62, 38), (66, 33), (70, 30), (73, 26), (76, 20)]
    under = c.poly(under_pts) | c.poly([(6, 18), (76, 18), (76, 20), (73, 26), (7, 23)])
    rock = under & ~top
    # 밝기: 왼쪽 위 밝음, 오른쪽·아래 어두움. 밑동은 아래로 갈수록 급히 어둡다.
    lit = np.clip(.95 - .55 * (c.X - 6) / 70.0 - .75 * np.clip((c.Y - 24) / 36.0, 0, 1), 0, 1)
    rock_lumps(c, rock, CLIFF, seed=17, lit=lit, period=(6, 4), dens=.86)
    # 지층 턱: 밑동을 가로지르는 층 경계(들쭉날쭉, 길이·높이 제각각) — 윗줄 밝은 턱, 아랫줄 그늘
    ledges = [(9, 28, 20), (14, 31, 13), (27, 32, 14), (44, 30, 17), (60, 29, 10), (19, 36, 12), (33, 38, 16), (52, 36, 9),
              (26, 43, 9), (39, 44, 8), (48, 42, 6), (31, 50, 7), (43, 50, 5), (36, 56, 4)]
    for (x0, y0, n) in ledges:
        for k in range(n):
            x = x0 + k
            y = y0 + (1 if H(x, y0, 5) > .8 else 0)
            if rock[y, x] and rock[y + 1, x] if y + 1 < c.h else False:
                u = lit[y, x]
                c.dot(x, y, CLIFF[5] if u > .55 else (CLIFF[4] if u > .3 else CLIFF[3]))
                c.dot(x, y + 1, CLIFF[1] if u > .3 else CLIFF[0])
    # 윗면 앞 가장자리 바로 밑: 풀 뿌리 그늘 한 줄 + 흙 턱
    for x in range(6, 77):
        ys, = np.nonzero(top[:, x])
        if not len(ys):
            continue
        y = ys.max() + 1
        if y < c.h and rock[y, x]:
            c.dot(x, y, CLIFF[1])
            if y + 1 < c.h and rock[y + 1, x] and H(x, 1, 9) > .5:
                c.dot(x, y + 1, CLIFF[4] if lit[y, x] > .5 else CLIFF[3])
    # 매달린 뿌리: 절벽 윗단에서 아래로 늘어진 가는 줄(411e05) + 끝 잎(13522e)
    for (x, y0, n) in ((12, 24, 7), (19, 25, 9), (31, 26, 6), (47, 26, 11), (56, 25, 7), (66, 24, 8), (70, 23, 5), (37, 26, 4)):
        x_ = x
        for k in range(n):
            if k and H(x, k, 3) > .7:
                x_ += 1 if H(x, k, 4) > .5 else -1
            if 0 <= y0 + k < c.h and (rock[y0 + k, x_] or k < n - 2):
                c.dot(x_, y0 + k, TRUNK[1] if k < n - 1 else TREE[1])
        c.dot(x_ + 1, y0 + n - 1, TREE[2])
    # 뾰족한 바위 끝 두 개 더(밑동 아래 매달린 돌)
    for (x0, y0, w, hh) in ((24, 42, 4, 7), (52, 45, 3, 6), (60, 38, 3, 5)):
        tip = c.poly([(x0, y0), (x0 + w, y0), (x0 + w // 2, y0 + hh)])
        u = lit
        c.put(tip & (c.X <= x0 + w // 2 - 1), CLIFF[3])
        c.put(tip & (c.X > x0 + w // 2 - 1), CLIFF[1])
        c.dot(x0 + 1, y0 + 1, CLIFF[4])
    # 윗면: 풀 3색 알갱이(원본 풀 칸 결), 왼쪽 위가 밝다. 가장자리 1px 짙은 풀(1d5728 없음 → 3c8f4b)
    t = .55 - .35 * (c.X - 40) / 36.0 - .45 * (c.Y - 15) / 10.0 + (H(c.X, c.Y, 23) - .5) * .7
    gidx = np.where(t > .72, 2, np.where(t > .2, 1, 0))
    pal = np.array(GRS, np.uint8)
    c.px[top] = pal[gidx[top]]
    c.m |= top
    rim = top & ~(np.roll(top, 1, 0) & np.roll(top, -1, 0) & np.roll(top, 1, 1) & np.roll(top, -1, 1))
    c.px[rim] = GRS[0]
    frontrim = top & ~np.roll(top, -1, 0)
    c.px[frontrim & (H(c.X, c.Y, 29) > .4)] = TREE[1]
    # 샘(윗면에 파인 물): 뒤쪽 벽 어두움 + 물
    pond = c.ell(55, 17, 5, 2)
    c.put(pond, WATER[2])
    c.put(pond & (c.Y <= 15), WATER[1])
    c.dot(53, 17, WATER[4]); c.dot(54, 17, WATER[3]); c.dot(57, 18, WATER[3])
    rimp = c.ell(55, 17, 6, 3) & ~pond
    c.put(rimp & (c.Y < 17), CLIFF[1])
    c.put(rimp & (c.Y >= 17), GRS[2])
    # 샘에서 흘러 앞 가장자리로 떨어지는 폭포
    for y in range(18, 24):
        c.dot(60, y, WATER[3]); c.dot(61, y, WATER[2])
    for y in range(24, 43):
        x = 61 + (y - 24) // 7
        if rock[y, x] or y < 30:
            c.dot(x, y, WATER[4] if (y // 2) % 2 else WATER[3]); c.dot(x + 1, y, WATER[2])
    for (x, y) in ((61, 43), (63, 44), (60, 45), (62, 47), (64, 49), (61, 50)):
        c.dot(x, y, WATER[4] if y < 47 else WATER[3])
    # 사당: 윗면(판) + 앞면(돌, 원본 성 색) + 문 + 기둥
    for y in range(8, 11):
        for x in range(32, 44):
            c.dot(x, y, PALE if x < 39 else PALE2)
    for x in range(31, 45):
        c.dot(x, 11, S[5] if x < 39 else S[3])
    for y in range(12, 18):
        for x in range(32, 44):
            u = (x - 32) / 11
            k = 5 if u < .25 else (4 if u < .7 else 3)
            if ((x + y) & 1) and .2 < u < .3:
                k = 4
            if y == 12:
                k = 2
            c.dot(x, y, S[k])
    c.put(c.rect(36, 14, 39, 17), OL)
    c.dot(36, 13, S[6]); c.dot(37, 13, S[6]); c.dot(38, 13, S[5]); c.dot(39, 13, S[4])
    for x in range(33, 44, 2):
        c.dot(x, 17, S[2])
    # 나무: 원본 숲 칸 나무 그대로(같은 결)
    ts = tree_stamp()
    for (x, y) in ((7, 9), (14, 5), (20, 7), (64, 7), (47, 3), (14, 12)):
        blit(c, ts, x, y)
    c.outline()
    return c.px


# ────────────────────────────────────────────────────────────────────────────────────────
def _block(c, x, y, w, h, top=2):
    """무너진 돌덩이: 윗면(밝음) top 행 + 앞면(어두움) h 행, 오른쪽 끝 한 단 어둡게."""
    for yy in range(y, y + top):
        for xx in range(x, x + w):
            c.dot(xx, yy, S[6] if xx < x + w - 1 else S[5])
    for yy in range(y + top, y + top + h):
        for xx in range(x, x + w):
            k = 4 if xx < x + w * .5 else 3
            if xx == x + w - 1:
                k = 2
            if yy == y + top:
                k -= 1
            c.dot(xx, yy, S[k])


def _hollow_top(c, x0, x1, y):
    """부러진 탑 윗면: 바깥 테(밝음) 안에 속이 빈 어두운 구멍."""
    for x in range(x0, x1 + 1):
        c.dot(x, y, S[6] if x < (x0 + x1) // 2 else S[5])
        c.dot(x, y + 2, S[5] if x < (x0 + x1) // 2 else S[4])
    for x in range(x0 + 2, x1 - 1):
        c.dot(x, y + 1, OL)
    c.dot(x0, y + 1, S[6]); c.dot(x0 + 1, y + 1, S[5]); c.dot(x1, y + 1, S[4]); c.dot(x1 - 1, y + 1, S[4])


def _rubble(c, x0, y0, w, h, seed=1):
    """무너진 돌무더기: 둥근 더미 안에 밝은 돌 덩이(윗면) + 그늘(아래·오른쪽). 윤곽은 뒤에서 일괄."""
    mk = c.ell(x0 + w // 2, y0 + h, w // 2, h)
    mk &= (c.Y <= y0 + h) & ~c.m
    lit = np.clip(.9 - .6 * (c.X - x0) / max(w, 1) - .4 * (c.Y - y0) / max(h, 1), 0, 1)
    rock_lumps(c, mk, [S[1], S[2], S[3], S[4], S[5], S[6], PALE], seed=seed, lit=lit, period=(3, 2), dens=.98)


def _roofless(c, x0, y0, w, d, fh, br0, brw):
    """지붕 없는 집(3/4): 벽 윗면 테(1px, 밝음)로 둘린 네모 안에 어두운 바닥이 보이고, 앞벽은 앞면 fh 행.
    앞벽 br0..br0+brw 는 무너져 낮고, 그 앞에 돌무더기. d = 안쪽 바닥 깊이(행)."""
    # 안쪽 바닥(그늘진 흙바닥 + 잔해)
    for y in range(y0 + 1, y0 + d + 1):
        for x in range(x0 + 1, x0 + w - 1):
            k = 1 if (y == y0 + 1 or x == x0 + 1) else (2 if (x + y) & 1 else 1)
            c.dot(x, y, S[k])
    c.dot(x0 + 3, y0 + d - 1, S[4]); c.dot(x0 + 4, y0 + d - 1, S[3]); c.dot(x0 + w - 4, y0 + 2, S[3])
    # 뒤벽·옆벽 윗면 테
    for x in range(x0, x0 + w):
        c.dot(x, y0, S[5] if x < x0 + w - 3 else S[4])
    for y in range(y0, y0 + d + 1):
        c.dot(x0, y, S[6]); c.dot(x0 + w - 1, y, S[4])
    # 앞벽: 윗면 테 + 앞면(원본 성 벽 결). 무너진 칸은 2행 낮고 윗면이 들쭉날쭉
    for x in range(x0, x0 + w):
        br = br0 <= x - x0 < br0 + brw
        drop = (2 + (1 if (x - x0 - br0) in (1, 2) else 0)) if br else 0
        ty = y0 + d + 1 + drop
        c.dot(x, ty, S[6] if x < x0 + w - 3 else S[5])
        for y in range(ty + 1, y0 + d + 1 + fh + 1):
            u = (x - x0) / max(w - 1, 1)
            k = 5 if u < .2 else (4 if u < .6 else 3)
            if .6 <= u < .7 and (x + y) & 1:
                k = 4
            if x == x0 + w - 1:
                k = 2
            if (y - (y0 + d + 2)) % 3 == 2:
                k -= 1
            if y == ty + 1:
                k -= 1
            c.dot(x, y, S[max(k, 1)])
    # 창 구멍 하나(무너지지 않은 쪽)
    wx = x0 + (w - 3 if br0 < w // 2 else 2)
    c.dot(wx, y0 + d + 3, OL); c.dot(wx, y0 + d + 4, OL)


def ruined_city():
    """무너진 도시(3/4): 바닥은 지도 바닥이 그대로 비치게 비워 둔다.
    뒤 성벽은 두 군데가 크게 무너져 돌무더기만 남고, 왼쪽 큰 탑은 반쯤 부러져 속이 빈 윗면, 오른쪽 탑은 사선으로 잘렸다.
    가운데 집 셋은 지붕이 없어 벽 윗면 테와 어두운 안바닥이 보이고, 앞벽이 군데군데 낮게 무너졌다.
    앞쪽 낮은 성벽은 두 동강, 그 사이·광장에 무너진 돌덩이(윗면+앞면)와 잔해가 흩어진다. 그림자는 오른쪽 아래."""
    c = C(4, 3)
    kw = EC.wall_hstretch(EC.keep_wall(0), 2)               # 22행 × 22열
    # 뒤 성벽 조각 셋(사이가 무너진 틈)
    a = L7.cut(kw[:, :10], [9, 9, 9, 9, 12, 12, 12, 16, 16, 18], cracks=[(4, 13, 5)], seed=3)
    blit(c, a, 16, 30 - a.shape[0])
    b = L7.cut(kw[:, 4:15], [17, 15, 15, 11, 11, 11, 11, 13, 13, 13, 17], cracks=[(6, 14, 4)], seed=5)
    blit(c, b, 34, 30 - b.shape[0])
    # 왼쪽 큰 탑: 반쯤 부러져 속이 빈 윗면
    t1 = L7.cut(EC.fat_tower(0), [11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 13, 13, 14, 14], cracks=[(3, 16, 6), (10, 18, 5)], seed=2)
    blit(c, t1, 1, 38 - 31)
    _hollow_top(c, 1, 14, 18)
    for (x, y) in ((13, 20), (14, 21)):
        c.dot(x, y, S[3])
    # 오른쪽 가는 탑: 사선으로 잘림
    t2 = L7.cut(EC.tower('R', 0), [9, 8, 7, 6, 6, 7, 9, 11, 12], cracks=[(4, 13, 7)], seed=6)
    blit(c, t2, 53, 38 - t2.shape[0])
    # 지붕 없는 집 둘
    _roofless(c, 17, 31, 10, 3, 5, 3, 4)
    _roofless(c, 38, 32, 11, 3, 4, 6, 4)
    # 성벽 틈에 흘러내린 돌무더기(작게)
    _rubble(c, 25, 25, 9, 4, seed=41)
    _rubble(c, 44, 25, 8, 4, seed=43)
    # 앞 낮은 성벽 두 동강
    a = L7.cut(EC.low_wall(12), [4, 4, 4, 5, 5, 6, 8, 9, 10, 11, 12, 13], seed=8)
    blit(c, a, 0, 47 - a.shape[0])
    g = L7.cut(EC.low_wall(12), [12, 11, 10, 8, 6, 5, 5, 5, 5, 6, 7, 9], seed=11)
    blit(c, g, 50, 47 - g.shape[0])
    _rubble(c, 12, 43, 5, 3, seed=47)
    _rubble(c, 45, 43, 5, 3, seed=49)
    # 무너진 돌덩이(윗면+앞면)
    for (x, y, w, h) in ((29, 40, 4, 2), (23, 44, 3, 1), (36, 44, 3, 1), (33, 37, 3, 1), (51, 37, 3, 1)):
        _block(c, x, y, w, h, top=1 if w <= 3 else 2)
    # 이끼
    for x in range(0, 64):
        for y in range(10, 48):
            if c.m[y, x] and H(x, y, 21) > .975:
                c.dot(x, y, MOSS if H(x, y, 22) > .5 else MOSS2)
    c.outline()
    ol = (c.px == np.array((17, 22, 24), np.uint8)).all(-1)
    c.px[ol] = OL
    # 그림자(오른쪽 아래): 구조물 마스크를 오른쪽 아래로 민 모양, 체크
    sm = np.zeros_like(c.m)
    for dx, dy in ((1, 1), (2, 1), (2, 2), (3, 2)):
        sm |= np.roll(np.roll(c.m, dy, 0), dx, 1)
    below_all = np.zeros_like(c.m)                          # 아래쪽에 구조물이 더 없는 곳(앞 땅)만
    for k in range(1, 8):
        below_all |= np.roll(c.m, -k, 0)
    shadow_dither(c, sm & ~below_all & (c.Y > 24), S[0])
    return c.px


def _v7(name):
    return next(f for n, f, *_ in L7.LANDMARKS if n == name)


LANDMARKS = [
    ('sky_island', sky_island, 5, 4, '천공섬 — 떠 있는 대륙'),
    ('giant_tower', _v7('giant_tower'), 2, 4, '거대한 탑'),
    ('ruined_city', ruined_city, 4, 3, '폐허 도시'),
    ('giant_tree', giant_tree, 3, 3, '거목'),
    ('crater_lake', _v7('crater_lake'), 3, 3, '분화구 호수'),
    ('desert_temple', desert_temple, 3, 3, '사막 신전'),
    ('stone_circle', _v7('stone_circle'), 2, 2, '고대 돌원'),
]
