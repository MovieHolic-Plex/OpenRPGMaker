"""어두운 성(원본 20-21,10-11)을 모듈로 잘라 키운 3x3 / 5x5."""
from wm_ext2_lib import *

X, Y = 320, 160


def tower(side, extra, wide=0):
    """원형 탑 몸통. side 'L'/'R'. 링 띠(8행)를 extra 번 더 끼운다."""
    x0 = X if side == 'L' else X + 23
    t = crop(x0, 161, x0 + 9, 190)          # 29행
    for _ in range(extra):
        t = vstretch(t, 10, 18, 1)
    if wide:
        t = hstretch(t, 4, 5, wide)          # 가운데 열을 반복해 통통하게
    return t


def fat_tower(extra):
    """원본 둥근 탑(20,12-13) 14x31. 몸통 띠(y205..212)를 늘려 키운다."""
    t = crop(320, 192, 336, 223)[:, 1:15]      # 14열
    for _ in range(extra):
        t = vstretch(t, 13, 21, 1)
    return t


def wall_module():
    """벽 조각 x9..22, y166..187 (22행). 흉벽 3행 + 벽돌."""
    return crop(X + 9, 166, X + 23, 188)


def wall_hstretch(w, n):
    """흉벽 주기(4열)를 n번 더 끼운다."""
    for _ in range(n):
        w = hstretch(w, 2, 6, 1)
    return w


def keep_wall(extra):
    """성채 벽: 원본 벽 22행 + (주기 8행 띠 3..11) 를 extra 번 더."""
    w = wall_module()
    for _ in range(extra):
        w = vstretch(w, 3, 11, 1)
    return w


def low_wall(width_cols):
    """낮은 벽: 흉벽~첫 띠(0..10) + 바닥(17..21)."""
    w = wall_module()
    w = np.concatenate([w[0:11], w[17:22]], axis=0)
    return w[:, :width_cols]


def core(W, H, textra, kextra, lowextra=0, tw=4):
    """W 폭 H 높이의 성: 양옆 탑 + 낮은 벽 + 가운데 성채(문)."""
    a = blank(W, H)
    tl, tr = tower('L', textra, tw), tower('R', textra, tw)
    th = tl.shape[0]
    tww = tl.shape[1]
    ty = H - th - 1
    keep = keep_wall(kextra)
    kh = keep.shape[0]
    low = wall_module()
    for _ in range(lowextra):
        low = vstretch(low, 3, 11, 1)
    low = np.concatenate([low[0:11 + 8 * lowextra], low[17 + 8 * lowextra:22 + 8 * lowextra]], axis=0)
    lh = low.shape[0]
    bottom = H - 3
    seg = np.concatenate([low[:, 0:4], low[:, 10:14]], axis=1)
    # 낮은 벽이 탑~성채 사이를 채우게 폭 조정 (lw 열)
    side = W // 2 - 7 - tww
    seg = seg[:, :]
    while seg.shape[1] < side:
        seg = hstretch(seg, 2, 6, 1)
    seg = seg[:, :side]
    paste(a, seg, tww, bottom - lh)
    paste(a, seg, W - tww - side, bottom - lh)
    paste(a, keep, W // 2 - 7, bottom - kh)
    paste(a, tl, 0, ty)
    paste(a, tr, W - tww, ty)
    return a


def castle3():
    return core(48, 48, 2, 2, 1)


def front_wall(width, extra=1):
    """앞 성벽(2판): 무늬 없는 벽돌 3행(모듈 5..7)만 세로로 늘리고, 가로는 문 위쪽 행과 문 줄을 따로 늘려
    문이 가운데에 오게 한다. 문은 한 번만 나온다(v1 은 하이라이트 띠 반복 + 문 조각 찢김)."""
    w = vstretch(wall_module(), 5, 8, extra)
    cut = 18 + 3 * extra                       # 문이 시작하는 행
    top, bot = w[:cut], w[cut:]
    n = (width - 14) // 4
    a, b = n // 2, n - n // 2
    top = hstretch(top, 6, 10, b)
    top = hstretch(top, 2, 6, a)
    # 3라운드: 넓고 밋밋한 벽면을 깨는 화살 구멍 — 111618 2x3 + 받침 8ca9a3 2x1, 8칸 간격(탑 창과 같은 두 색)
    y0 = 6
    for cx in range(7, top.shape[1] - 8, 8):
        for dy in range(3):
            top[y0 + dy, cx:cx + 2] = (0x11, 0x16, 0x18)
        top[y0 + 3, cx:cx + 2] = (0x8c, 0xa9, 0xa3)
    fill = bot[:, 10:14]
    left = np.concatenate([bot[:, 0:5]] + [fill] * a, axis=1)
    right = np.concatenate([fill] * b + [bot[:, 10:14]], axis=1)
    bot = np.concatenate([left, bot[:, 5:10], right], axis=1)
    return np.concatenate([top, bot], axis=0)


def castle5():
    W, H = 80, 80
    a = blank(W, H)
    inner = core(48, 60, 3, 3)
    paste(a, inner, 16, 2)
    fw = front_wall(62, 1)
    fh = fw.shape[0]
    bottom = H - 3
    paste(a, fw, 9, bottom - fh)
    tl, tr = tower('L', 3), tower('R', 3)
    th = tl.shape[0]
    paste(a, tl, 0, H - th - 1)
    paste(a, tr, W - 9, H - th - 1)
    return a


def core2(W, H, textra, kextra, lowextra=0):
    """뚱뚱한 둥근 탑 두 개 + 가운데 성채."""
    a = blank(W, H)
    tl = fat_tower(textra)
    tr = tl
    th, tww = tl.shape[:2]
    ty = H - th - 1
    keep = keep_wall(kextra)
    kh = keep.shape[0]
    low = wall_module()
    for _ in range(lowextra):
        low = vstretch(low, 3, 11, 1)
    low = np.concatenate([low[0:11 + 8 * lowextra], low[17 + 8 * lowextra:22 + 8 * lowextra]], axis=0)
    lh = low.shape[0]
    bottom = H - 3
    side = W // 2 - 7 - tww
    seg = np.concatenate([low[:, 0:4], low[:, 10:14]], axis=1)
    while seg.shape[1] < side:
        seg = hstretch(seg, 2, 6, 1)
    seg = seg[:, :side]
    paste(a, seg, tww, bottom - lh)
    paste(a, seg, W - tww - side, bottom - lh)
    paste(a, keep, W // 2 - 7, bottom - kh)
    paste(a, tl, 0, ty)
    paste(a, tr, W - tww, ty)
    return a


def keep_w(kextra, hextra=1):
    """성채 벽: 세로 kextra 띠, 가로로는 흉벽 주기(4열)를 hextra 번 더(문은 가운데 유지)."""
    w = keep_wall(kextra)
    for i in range(hextra):
        w = hstretch(w, 2, 6, 1) if i % 2 == 0 else hstretch(w, 10, 14, 1)
    return w


OLD_FLAT = (0x11, 0x16, 0x18)


def keep_plain(k, hextra=1, slits=True):
    """성채 몸체(2판): 원본 벽 22행에서 무늬 없는 벽돌 3행(모듈 행 5..7)만 k번 늘린다.
    v1 은 하이라이트 띠(3..11)를 반복해 「슬래브 쌓기」로 보였다. 창(화살 구멍)은 손으로 찍는다:
    111618 2x4 + 받침 8ca9a3 2x1 (원본 탑 창과 같은 두 색). 문 자리(아래 5행)는 피한다."""
    w = vstretch(wall_module(), 5, 8, k)
    for i in range(hextra):
        w = hstretch(w, 2, 6, 1) if i % 2 == 0 else hstretch(w, 10, 14, 1)
    if slits:
        h, wd = w.shape[:2]
        top, bot = 7, h - 8                       # 슬릿을 둘 수 있는 행 범위
        tiers = [top] if bot - top < 9 else [top, top + (bot - top - 4) // 2 + 1] if bot - top < 16 else [top, top + 7, top + 14]
        for ty in tiers:
            if ty + 5 > bot:
                continue
            for cx in (wd // 4 - 1, wd // 2 - 1, (3 * wd) // 4 - 1):
                for dy in range(4):
                    for dx in range(2):
                        w[ty + dy, cx + dx] = (0x11, 0x16, 0x18)
                for dx in range(2):
                    w[ty + 4, cx + dx] = (0x8c, 0xa9, 0xa3)
    return w


def core3(W, H, textra, kextra, hextra=1, plain=True):
    """뚱뚱한 둥근 탑 둘 + 가로로 넓힌 성채(사이 틈 없음)."""
    a = blank(W, H)
    t = fat_tower(textra)
    th, tw = t.shape[:2]
    keep = keep_plain(round(kextra * 8 / 3), hextra) if plain else keep_w(kextra, hextra)
    kh, kw = keep.shape[:2]
    total = 2 * tw + kw
    x0 = (W - total) // 2
    bottom = H - 3
    ty = H - th - 1
    paste(a, keep, x0 + tw, bottom - kh)
    paste(a, t, x0, ty)
    paste(a, t, x0 + tw + kw, ty)
    return a


def castle3_final():
    return core3(48, 48, 2, 2, 1)


def castle5_final(itx=2, ik=2, ftx=1, fk=1, ih=54):
    """80x80: 안쪽 성(core3) 앞에 문 달린 성벽 + 모서리 뚱뚱한 탑 둘."""
    W, H = 80, 80
    a = blank(W, H)
    inner = core3(48, ih, itx, ik, 1)
    paste(a, inner, 16, 0)
    ft = fat_tower(ftx)
    th, tw = ft.shape[:2]
    fw = front_wall(54, fk)
    fh = fw.shape[0]
    bottom = H - 3
    paste(a, fw, (W - fw.shape[1]) // 2, bottom - fh)
    paste(a, ft, 0, H - th - 1)
    paste(a, ft, W - tw, H - th - 1)
    return a
