# 시간의 틈 오토타일(16변형, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8)과 바닥·앞면 표본.
#  - autotile-riftstone : 허공 위 떠 있는 돌 판석(가장자리 둥글게, 북쪽 빛 모서리, 남쪽 두께 띠). 지도와 같은 섬 그리기로 굽는다.
#  - autotile-starbridge: 허공 위 별빛 다리(반투명 빛 판 + 양쪽 빛 난간 + 남쪽 두께선). 별이 비친다.
#  - autotile-lightspill: 돌 위에 번진 빛(디더 알파, 이웃 없는 쪽은 들쭉날쭉 옅어진다).
import numpy as np
from tr_base import *
from tr_base import _hash
import tr_isle as I
import tr_void as V


def riftstone_sheet(seed=4):
    # 2026-10-08 전수 감사 보정 — 공용 깊이장 3x3 창 마스크로 바꾼 새 판(tr_fix_riftstone.riftstone_sheet). 다시 내보내도 옛 네모 판으로 돌아가지 않게.
    from tr_fix_riftstone import riftstone_sheet as _new
    return _new(seed)


def starbridge_cell(m, seed=3):
    N, E, S, W_ = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    a = np.zeros((16, 16, 4), np.uint8); G = GSTAR
    on = np.zeros((16, 16), bool)
    on[4:12, 4:12] = True
    if E: on[4:12, 12:16] = True
    if W_: on[4:12, 0:4] = True
    if N: on[0:4, 4:12] = True
    if S: on[12:16, 4:12] = True
    horiz = (E or W_) and not (N or S)
    for y in range(16):
        for x in range(16):
            if not on[y, x]: continue
            up = y > 0 and on[y - 1, x]; dn = y < 15 and on[y + 1, x]; lf = x > 0 and on[y, x - 1]; rt = x < 15 and on[y, x + 1]
            if (y == 0 and N) : up = True
            if (y == 15 and S): dn = True
            if (x == 0 and W_): lf = True
            if (x == 15 and E): rt = True
            k, al = 3, 150
            # 판 무늬: 지나는 방향에 가로로 4px 마다 밝은 줄
            if horiz or not (N or S): k = 4 if x % 4 == 0 else 3
            else: k = 4 if y % 4 == 0 else 3
            if _hash(x, y, seed) > .93: k, al = 6, 230
            if not up: k, al = 6, 255                              # 북쪽 난간(빛)
            elif not lf: k, al = 5, 240                            # 서쪽 난간
            elif not rt: k, al = 4, 230                            # 동쪽 난간
            if not dn: k, al = 1, 230                              # 남쪽 두께선(3/4 앞 가장자리)
            elif y < 15 and not (on[y + 2, x] if y + 2 < 16 else (S or True)) and False: pass
            a[y, x, :3] = G[k]; a[y, x, 3] = al
            if not dn and y + 1 < 16: a[y + 1, x, :3] = G[0]; a[y + 1, x, 3] = 120   # 밑 그늘
    return Image.fromarray(a, 'RGBA')


def starbridge_sheet():
    return sheet_from_cells([starbridge_cell(m) for m in range(16)])


def lightspill_cell(m, G=None, seed=21):
    # 2026-10-08 전수 감사 보정 — 공용 깊이장 윤곽 + 구멍 없는 빛 막 위 디더 점무늬로 바꾼 새 판(tr_fix_lightspill.lightspill_cell).
    from tr_fix_lightspill import lightspill_cell as _new
    return _new(m, G)


def lightspill_sheet(color='blue'):
    return sheet_from_cells([lightspill_cell(m, GLOW[color]) for m in range(16)])


# ---------------------------------------------------------------- 바닥 표본(48x48, 3x3 이음새 없음)
def ground_riftstone(seed=5):
    """떠 있는 돌 판석 윗면 표본: 버들항 광장 판석(roman.tex_flag, 주기 96 의 앞 48 이 아니라 48 주기로 접힌 칸)을 허공 빛에 식힌 것."""
    im = blank(48, 48); px = im.load()
    for y in range(48):
        for x in range(48):
            # tex_flag 는 가로 주기 96, 세로 주기 70 이라 48 로 접히지 않는다 → 같은 판석 규칙을 48 주기로 다시 짠다
            c = _flag48(x, y, seed)
            px[x, y] = c + (255,)
    return im


def _flag48(X, Y, seed):
    rh = (13, 12, 11, 12); acc = 0
    yy = Y % 48
    for i, h in enumerate(rh):
        if yy < acc + h: row = i; ly = yy - acc; hh = h; break
        acc += h
    off = int(_hash(row, 0, seed) * 48)
    xs = (X + off) % 48; edges = [0]; k = 0
    while edges[-1] < 48:
        edges.append(edges[-1] + 14 + int(_hash(row, k, seed + 1) * 9)); k += 1
    edges[-1] = 48
    if edges[-2] > 40: edges.pop(-2)
    for i in range(len(edges) - 1):
        if edges[i] <= xs < edges[i + 1]: col = i; lx = xs - edges[i]; w = edges[i + 1] - edges[i]; break
    if ly == hh - 1 or lx == w - 1: c = ST[3]
    else:
        h_ = _hash(col, row, seed + 2); c = mix(ST[4], ST[5], 0.12 + 0.3 * h_)
        if ly == 0 or lx == 0: c = mix(c, ST[5], 0.35)
        if _hash(X % 48, Y % 48, seed + 3) < 0.035: c = mix(c, ST[5], 0.5)
        if vnoise(X % 48, Y % 48, 6, seed + 31, per=8) > .76: c = mix(c, ST[3], .2)
    return mix(c, (126, 136, 176), .07)


def face_rift_sample():
    """떠 있는 돌 앞면·뿌리 표본(3x3칸): 위 한 줄 = 판석 윗면 끝 + 두께 띠, 그 아래 앞면 몸통과 가늘어지는 바위 뿌리(허공 바탕)."""
    W, H = 48, 48
    bg = V.void_image(W, H, seed=19, per=True, nebula=False)
    mk = np.zeros((H, W), bool); mk[0:14, :] = True
    isl = I.Island(mk, 'path', body=6, root=26, seed=8, taper='bbox')
    im, _ = I.render_islands(W, H, [isl])
    bg.alpha_composite(im)
    return bg
