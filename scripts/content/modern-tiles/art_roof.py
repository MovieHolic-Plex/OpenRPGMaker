"""modern_city 평지붕 다시 칠하기 — 코드 손 도트. 2026-10-20 사용자 승인 시안(ground/src/draw.py roof_field·roof_canvas)을
건물 키트 259개에 자동으로 적용하도록 옮겼다.

  reroof(kit_img, stem, ramp_name) → (새 그림, 정보) 또는 (None, 이유)

지붕 찾기: town_lib.find_roof 와 같은 규칙 — 지붕 램프 5색(기본 갈회 · teal · navy · brick · sage · lgray)의 가장 큰 연결 성분 사각형이
지붕 안쪽이다. 그 바깥 테(흰 두겁·윤곽)까지 넓혀 «지붕 상자»를 잡고, 상자 안을 시안 지붕(파라펫 두겁 윗면·북쪽 안쪽 면·
남쪽 그늘 2줄·서쪽 그늘·재료 결)으로 다시 칠한다.
옥상 설비(계단실·물탱크·실외기·헬리패드·간판·화단)는 그대로 둔다: 지붕 안에서 램프 밖 색인 화소 = 설비, 설비 둘레의 어두운 램프색 =
설비 그림자(새 재료 위에 같은 단계만큼 어둡게 다시 얹는다). 설비가 테 위로 솟은 화소도 남긴다.

재료는 결정적이다: lgray=자갈, teal·navy=방수 시트 이음, sage·brick=도장 콘크리트, 기본 갈회 = 건물 이름 해시로 자갈/도장/시트.
결은 키트 칸 격자(16px)에 맞춰 칸 좌표로 고른다 — 같은 재료·램프의 지붕 바탕 칸이 여러 건물에서 같은 그림이 되어 시트 칸이 덜 는다.
"""
import os
import random
import sys
import zlib

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import town_lib as TL  # noqa: E402

T = 16
# 파라펫(난간벽) 콘크리트 램프 — 시안 그대로
P = [(40, 42, 48), (84, 88, 96), (122, 127, 134), (160, 166, 170), (196, 202, 203), (226, 231, 230), (244, 246, 245)]
# 파라펫 안쪽 면 슬레이트(r4) — 밝음 → 어둠. 지붕 바탕(갈회 104,96,94)보다 살짝 밝은 중간 단 두 줄 + 그늘 단.
SL = [(150, 156, 166), (128, 134, 145), (110, 116, 127), (92, 98, 109)]
RAMPS5 = dict(base=TL.ROOF_BASE, **TL.ROOF_VARIANTS)


def ramp7(r5):
    """town_lib 5단 램프 → 7단(양 끝 한 단씩 늘림). 가운데(3) = 지붕 바탕색(5단의 2)."""
    d = tuple(max(0, int(round(c * 0.74))) for c in r5[0])
    l = tuple(min(255, int(round(r5[4][i] + (r5[4][i] - r5[3][i]) * 1.2))) for i in range(3))
    return [d, *r5, l]


RAMPS7 = {k: ramp7(v) for k, v in RAMPS5.items()}
MAT_BY_RAMP = {'lgray': 'gravel', 'teal': 'membrane', 'navy': 'membrane', 'sage': 'coated', 'brick': 'coated'}
MAT_KO = {'gravel': '자갈', 'membrane': '방수 시트 이음', 'coated': '도장 콘크리트'}


def material_for(stem, ramp_name):
    if ramp_name in MAT_BY_RAMP:
        return MAT_BY_RAMP[ramp_name]
    return ('gravel', 'coated', 'membrane')[zlib.crc32(stem.encode()) % 3]


def jitter_points(seed, cell=4, prob=0.7):
    r = random.Random(seed)
    pts = []
    for cy in range(0, T, cell):
        for cx in range(0, T, cell):
            if r.random() < prob:
                pts.append((cx + r.randrange(cell), cy + r.randrange(cell), r.random()))
    return pts


def _put(t, x, y, c):
    t[y % T][x % T] = c


def roof_field(mat, R, ramp_name, var, cx, cy):
    """재료 칸 16×16 (시안 roof_field 와 같은 결). var: None · 'stain' · 'patch'. 바탕 결은 (재료, 램프, 칸 좌표 4갈래)로 정한다."""
    t = [[R[3]] * T for _ in range(T)]
    k4 = (cx * 3 + cy * 5) % 4
    seed = zlib.crc32(repr((mat, ramp_name, k4)).encode()) & 0xffff
    r = random.Random(seed)
    mid = tuple((a + b) // 2 for a, b in zip(R[2], R[3]))
    if mat == 'gravel':
        for x, y, k in jitter_points(seed, cell=4, prob=0.95):
            if k < 0.55:
                _put(t, x, y, R[4]); _put(t, x, y + 1, R[2])
            elif k < 0.8:
                _put(t, x, y, R[4]); _put(t, x + 1, y, R[4]); _put(t, x + 1, y + 1, R[2]); _put(t, x, y + 1, R[2])
            elif k < 0.93:
                _put(t, x, y, R[2])
            else:
                _put(t, x, y, R[5]); _put(t, x, y + 1, R[2])
    elif mat == 'membrane':
        for y in range(T):
            t[y][5] = R[4]; t[y][6] = R[2]
        if (cx * 5 + cy * 3) % 3 == 0:
            hy = 4 + (cx * 7 + cy * 3) % 8
            for x in range(7, T):
                t[hy][x] = R[4]; t[hy + 1][x] = mid
        for x, y, k in jitter_points(seed, cell=4, prob=0.4):
            if t[y % T][x % T] == R[3]:
                _put(t, x, y, R[4] if k < 0.5 else mid)
    else:
        for y in range(T):
            if (y + cy * 5) % 6 == 0:
                for x in range(T):
                    if r.random() < 0.6:
                        t[y][x] = R[4]
        for x, y, k in jitter_points(seed, cell=4, prob=0.5):
            _put(t, x, y, R[2] if k < 0.6 else R[5])
    if var == 'stain':
        for y in range(T):
            for x in range(T):
                d = ((x - 8) ** 2) / 30 + ((y - 9) ** 2) / 14
                if d < 0.55:
                    t[y][x] = R[1] if t[y][x] in (R[2], R[1]) else R[2]
                elif d < 1.0:
                    t[y][x] = R[2] if t[y][x] != R[5] else R[3]
                elif d < 1.2 and (x + y) % 2 == 0:
                    t[y][x] = R[5]
    if var == 'patch':
        x0, y0, x1, y1 = 2, 3, 11, 10
        for y in range(y0, y1):
            for x in range(x0, x1):
                t[y][x] = R[4] if (x - x0) % 4 else R[3]
        for x in range(x0, x1):
            t[y0][x] = R[5]; t[y1][x] = R[1]
        for y in range(y0, y1 + 1):
            t[y][x0] = R[5]; t[y][x1] = R[1]
    return t


def cell_variant(mat, stem, cx, cy):
    h = zlib.crc32(repr((stem, cx, cy)).encode()) % 100
    if h < 7:
        return 'stain'
    if mat == 'membrane' and h < 11:
        return 'patch'
    return None


def _darken(c, k, R):
    if c in R:
        return R[max(0, R.index(c) - k)]
    f = 0.82 if k == 1 else 0.68 if k == 2 else 0.56
    return tuple(int(v * f) for v in c[:3])


def find_roof(arr, r5):
    a = arr[:, :, 3] > 0
    m = np.zeros(a.shape, bool)
    for c in r5:
        m |= (arr[:, :, :3] == np.array(c, np.uint8)).all(-1) & a
    lab, n = ndimage.label(m)
    if n == 0:
        return None
    sizes = ndimage.sum(m, lab, range(1, n + 1)); k = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(lab == k)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    area = (x1 - x0) * (y1 - y0)
    if area < 900 or (y1 - y0) < 20 or sizes.max() < .3 * area:
        return None
    return (x0, y0, x1, y1)


def detect_ramp(arr):
    """이 키트의 지붕 램프 이름 — 램프 5색 화소가 가장 많은 것(같으면 None)."""
    best, bn = None, 0
    flat = arr[arr[:, :, 3] > 0][:, :3]
    if not len(flat):
        return None
    keys = flat[:, 0].astype(np.int64) * 65536 + flat[:, 1].astype(np.int64) * 256 + flat[:, 2]
    for name, r5 in RAMPS5.items():
        ks = np.array([c[0] * 65536 + c[1] * 256 + c[2] for c in r5])
        n = int(np.isin(keys, ks).sum())
        if n > bn:
            best, bn = name, n
    return best if bn >= 300 else None


def _mix(a, b):
    return tuple((x + y) // 2 for x, y in zip(a, b))


# 옥상 설비 r3 — 옛 설비는 남색 거의 검정 윤곽(9,17,37)이라 지붕 위에 떠 보였다. 윤곽을 지붕·파라펫과 같은 계열의 어두운 슬레이트로,
# 회색 설비 덩이는 윗면 3px 를 밝게(위 테 다음 줄 가장 밝게) + 윗면/앞면 경계 한 줄, 지붕에는 오른쪽 아래로 2px 드리운 그림자.
EQ_OUTLINE = (54, 60, 72)                                   # 어두운 슬레이트(r4: 40,46,56 은 1배에서 남색 검정처럼 읽혀 한 단 올림)
EQ_GREYS = {(103, 106, 119), (117, 120, 134), (132, 135, 148), (148, 150, 161), (161, 163, 172), (175, 177, 184), (188, 189, 195),
            (193, 207, 204), (228, 233, 232), (241, 243, 243), (161, 178, 174), (115, 144, 138)}
EQ_TOP = ((214, 216, 220), (198, 200, 206), (188, 189, 195))
EQ_EDGE = (132, 135, 148)


def _is_navy(c):
    r, g, b = c
    return max(r, g, b) < 48 and b >= r + 12


def restyle_equipment(out, E, R, rect, top_y):
    rx0, ry0, rx1, ry1 = rect
    H, W = E.shape
    navy = np.zeros_like(E)
    for y, x in zip(*np.nonzero(E)):
        if _is_navy(tuple(int(v) for v in out[y, x, :3])):
            navy[y, x] = True
    out[navy, 0], out[navy, 1], out[navy, 2] = EQ_OUTLINE
    lab, n = ndimage.label(E)
    roofm = np.zeros_like(E)
    roofm[max(ry0, top_y):ry1 - 3, rx0 + 3:rx1 - 3] = True
    for i in range(1, n + 1):
        M = lab == i
        ys, xs = np.nonzero(M)
        cols = [tuple(int(v) for v in out[y, x, :3]) for y, x in zip(ys, xs)]
        grey = sum(1 for c in cols if c in EQ_GREYS or c == EQ_OUTLINE) / max(1, len(cols))
        if grey < 0.7 or len(ys) < 12:
            continue
        for x in range(xs.min(), xs.max() + 1):     # 열마다 맨 위 윤곽 다음 3px = 윗면, 그다음 1px = 윗면 모서리
            col = np.nonzero(M[:, x])[0]
            if not len(col):
                continue
            y0 = col.min()
            if tuple(int(v) for v in out[y0, x, :3]) != EQ_OUTLINE:
                continue
            k = 0
            for y in range(y0 + 1, min(H, y0 + 5)):
                if not M[y, x]:
                    break
                c = tuple(int(v) for v in out[y, x, :3])
                if c == EQ_OUTLINE:
                    break
                if c in EQ_GREYS:
                    out[y, x, :3] = EQ_TOP[k] if k < 3 else EQ_EDGE
                k += 1
        sh = np.zeros_like(M)                        # 드리운 그림자(빛 왼쪽 위 → 오른쪽 아래 2px)
        for dx, dy in ((1, 1), (2, 2), (1, 2), (2, 1), (0, 2)):
            sh[dy:, dx:] |= M[:H - dy, :W - dx]
        sh &= ~E & roofm
        for y, x in zip(*np.nonzero(sh)):
            out[y, x, :3] = _darken(tuple(int(v) for v in out[y, x, :3]), 2, R)


def _mode(vals):
    vals = [tuple(v) for v in vals]
    return max(set(vals), key=vals.count) if vals else None


def reroof(img, stem, ramp_name=None):
    """건물 키트 그림 → (새 그림, info) / (None, 이유). info: box(지붕 상자 x0,y0,x1,y1 포함 끝), eave(지붕 아래 첫 벽 줄 y), mat, ramp."""
    arr = np.array(img.convert('RGBA'))
    opq0 = arr[:, :, 3] > 0
    ys0 = np.nonzero(opq0.any(1))[0]
    top0 = int(ys0.min()) if len(ys0) else 0
    ramp_name = ramp_name or detect_ramp(arr[: top0 + int((arr.shape[0] - top0) * 0.55)])
    if ramp_name is None:
        return None, '지붕 램프 색이 없다(박공·특수 지붕)'
    r5 = RAMPS5[ramp_name]; R = RAMPS7[ramp_name]
    rect = find_roof(arr, r5)
    if rect is None:
        return None, '평지붕 사각형을 못 찾았다'
    rx0, ry0, rx1, ry1 = rect   # 끝 제외
    if ry1 - ry0 > 0.8 * (arr.shape[0] - top0):
        return None, '램프 사각형이 건물 대부분이다(벽면 색과 이어짐)'
    if ry0 - top0 > 24:
        return None, f'램프 사각형이 건물 위쪽이 아니다(y={ry0}) — 벽면 색으로 본다'
    H, W = arr.shape[:2]
    opq = arr[:, :, 3] > 0

    def row_cov(y):
        return opq[y, rx0:rx1].mean()

    def col_cov(x):
        return opq[ry0:ry1, x].mean()
    by0 = ry0
    while by0 - 1 >= 0 and row_cov(by0 - 1) >= 0.6 and ry0 - (by0 - 1) <= 8:
        by0 -= 1
    lum = arr[:, :, :3].astype(int).sum(-1)
    by1 = ry1 - 1
    y = ry1
    while y < H and y - ry1 < 9:
        dark = ((lum[y, rx0:rx1] < 120) & opq[y, rx0:rx1]).mean()
        by1 = y
        if dark >= 0.7:
            break
        y += 1
    bx0 = rx0
    while bx0 - 1 >= 0 and col_cov(bx0 - 1) >= 0.6 and rx0 - (bx0 - 1) <= 6:
        bx0 -= 1
    bx1 = rx1 - 1
    while bx1 + 1 < W and col_cov(bx1 + 1) >= 0.6 and (bx1 + 1) - (rx1 - 1) <= 6:
        bx1 += 1
    w, h = bx1 - bx0 + 1, by1 - by0 + 1
    if h < 24 or w < 24:
        return None, f'지붕 상자가 작다 {w}x{h}'
    rset = {tuple(c) for c in r5}
    # 테(사각 바깥) 기대색
    rowexp = {yy: _mode(arr[yy, rx0:rx1, :3]) for yy in list(range(by0, ry0)) + list(range(ry1, by1 + 1))}
    colexp = {xx: _mode(arr[ry0:ry1, xx, :3]) for xx in list(range(bx0, rx0)) + list(range(rx1, bx1 + 1))}
    E = np.zeros((H, W), bool)       # 설비
    for yy in range(by0, by1 + 1):
        for xx in range(bx0, bx1 + 1):
            if not opq[yy, xx]:
                continue
            c = tuple(arr[yy, xx, :3])
            inR = rx0 <= xx < rx1 and ry0 <= yy < ry1
            if inR:
                E[yy, xx] = c not in rset
            else:
                exp = {rowexp.get(yy), colexp.get(xx)} - {None}
                E[yy, xx] = c not in exp and c not in rset and lum[yy, xx] >= 60
    # 지붕 안쪽 테두리 3px 안의 램프 밖 직선(구운 난간 잔선)은 설비가 아니다: 가장자리 띠의 E 는 이웃 설비 덩이와 이어질 때만
    lab, n = ndimage.label(E)
    keep = np.zeros_like(E)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(ys) < 3:
            continue
        inner = ((ys >= ry0 + 3) & (ys < ry1 - 3) & (xs >= rx0 + 3) & (xs < rx1 - 3)).any()
        if inner:
            keep[lab == i] = True
    E = keep
    near = ndimage.binary_dilation(E, iterations=5)
    near1 = ndimage.binary_dilation(E, iterations=1)
    Rset_idx = {tuple(c): i for i, c in enumerate(r5)}
    # 새 지붕 상자
    mat = material_for(stem, ramp_name)
    out = arr.copy()
    cv = {}
    for yy in range(by0, by1 + 1):
        for xx in range(bx0, bx1 + 1):
            cx, cy = xx // T, yy // T
            key = (cx, cy)
            if key not in cv:
                cv[key] = roof_field(mat, R, ramp_name, cell_variant(mat, stem, cx, cy), cx, cy)
            out[yy, xx, :3] = cv[key][yy % T][xx % T]
            out[yy, xx, 3] = 255

    def setc(x, y, c):
        out[y, x, :3] = c; out[y, x, 3] = 255

    def get(x, y):
        return tuple(int(v) for v in out[y, x, :3])
    # 파라펫 r4(감독 VQA r2 2026-10-20) — 북쪽 파라펫: 윤곽 1 + 밝은 두겁 2 + 안쪽 면 «중간 슬레이트 두 줄»(SL[1]·SL[2], 16px 마다
    # 옅은 패널 이음) + 지붕 위 접촉 그늘 2줄. r3 의 P1·P0 안쪽 면은 1배에서 검은 틈(슬롯)처럼 읽혀 버렸다. 모든 키트가 같은 단을 쓴다.
    # 서쪽 안쪽 면 1px SL[3](그늘) + 지붕 그늘 2열, 동쪽 안쪽 면 1px P4(빛).
    NF = 5   # 북쪽 파라펫 줄 수(윤곽·두겁 2·안쪽 면 2)
    for xx in range(bx0, bx1 + 1):
        setc(xx, by0 + NF, _darken(get(xx, by0 + NF), 2, R)); setc(xx, by0 + NF + 1, _darken(get(xx, by0 + NF + 1), 1, R))
    for yy in range(by0 + NF, by1 - 5):
        setc(bx0 + 4, yy, _darken(get(bx0 + 4, yy), 2, R)); setc(bx0 + 5, yy, _darken(get(bx0 + 5, yy), 1, R))
    for xx in range(bx0, bx1 + 1):
        setc(xx, by1 - 5, R[1])
        for k, c in enumerate((P[0], P[6], P[5], SL[1], SL[2])):
            setc(xx, by0 + k, c)
        if xx % T == 8 and bx0 + 4 < xx < bx1 - 4:        # 안쪽 면 패널 이음(한 단만 어둡게)
            setc(xx, by0 + 3, SL[2]); setc(xx, by0 + 4, SL[3])
        for k, c in enumerate((P[6], P[5], P[3], P[2], P[0])):
            setc(xx, by1 - 4 + k, c)
    for xx in range(bx0, bx1 + 1):
        if xx % T == 8 and bx0 + 4 < xx < bx1 - 4:
            for yy in (by0 + 1, by0 + 2, by1 - 4, by1 - 3):
                setc(xx, yy, P[4])
    for yy in range(by0 + 1, by1):
        setc(bx0, yy, P[0]); setc(bx1, yy, P[0])
        if by0 + 3 <= yy <= by1 - 5:
            setc(bx0 + 1, yy, P[5]); setc(bx0 + 2, yy, P[4]); setc(bx1 - 1, yy, P[4]); setc(bx1 - 2, yy, P[5])
        if by0 + NF <= yy <= by1 - 6:
            setc(bx0 + 3, yy, SL[3]); setc(bx1 - 3, yy, P[4])
    for yy in range(by0 + 3, by0 + NF):                   # 서·동 두겁 안쪽 모서리: 안쪽 면과 만나는 곳
        setc(bx0 + 3, yy, SL[2]); setc(bx1 - 3, yy, SL[1])
    setc(bx0 + 1, by0 + 1, P[6]); setc(bx0 + 1, by0 + 2, P[5])
    for yy in (by1 - 2, by1 - 1):
        setc(bx0 + 1, yy, P[4]); setc(bx1 - 1, yy, P[1])
    # 설비 그림자(옛 램프의 어두운 단 → 새 재료를 같은 단계만큼 어둡게), 설비에 붙은 램프 밝은 단은 설비로 둔다
    for yy in range(ry0 + 3, ry1 - 3):
        for xx in range(rx0 + 3, rx1 - 3):
            if E[yy, xx] or not opq[yy, xx]:
                continue
            c = tuple(arr[yy, xx, :3])
            i = Rset_idx.get(c)
            if i is None:
                continue
            if i < 2 and near[yy, xx]:
                setc(xx, yy, _darken(get(xx, yy), 2 - i, R))
            elif i > 2 and near1[yy, xx]:
                setc(xx, yy, R[i + 1] if i + 1 < len(R) else R[-1])
    out[E] = arr[E]
    restyle_equipment(out, E, R, (rx0, ry0, rx1, ry1), by0 + NF + 1)
    info = dict(box=[int(bx0), int(by0), int(bx1), int(by1)], rect=[int(v) for v in rect], eave=int(by1 + 1), mat=mat, ramp=ramp_name, equipment_px=int(E.sum()))
    return Image.fromarray(out, 'RGBA'), info


def eave_and_seam(img, eave_y, seam=(66, 60, 58)):
    """처마 그늘(지붕 아래 벽 2줄: 첫 줄 0.70, 둘째 줄 체크 0.84)과 밑변 이음선(맨 아래 화소 줄 = 기초와 벽 사이 이음)."""
    a = np.array(img.convert('RGBA')).astype(float)
    H, W = a.shape[:2]
    op = a[:, :, 3] > 0
    for k, f in ((0, 0.70), (1, 0.84)):
        y = eave_y + k
        if y >= H or y < 1:
            continue
        for x in range(2, W - 2):
            if op[y, x] and op[y, x - 1] and op[y, x + 1] and op[max(0, y - 1), x]:
                if k == 1 and (x + y) % 2:
                    continue
                a[y, x, :3] *= f
    yb = H - 1
    for x in range(W):
        if op[yb, x]:
            a[yb, x, :3] = seam
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
