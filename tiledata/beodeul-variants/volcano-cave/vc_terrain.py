# 화산 동굴 지형: 칸 격자(열림/용암/다리/바닥 종류) + 픽셀 렌더(천장·벽면·바닥·용암 4프레임·폭포).
import os, sys, math
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '_common-4'))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import c4
from c4 import ST, WD, RD, SR, rgb, noise, hashgrid, pick, _spk, painter
import vc_pieces as V
BR = V.BR

W, H = 56, 44
cy_, cx_ = np.mgrid[0:H, 0:W]
_N = {}
def _n(seed):
    if seed not in _N: _N[seed] = noise(H, W, 3.0, seed)
    return _N[seed]
def ell(cx, cy, rx, ry, seed):
    return (((cx_ - cx) / rx) ** 2 + ((cy_ - cy) / ry) ** 2) < (0.85 + 0.35 * _n(seed))
def rct(x0, y0, x1, y1):
    m = np.zeros((H, W), bool); m[y0:y1 + 1, x0:x1 + 1] = True; return m

# ---- 종류: 0 바위 1 바닥 2 용암 3 다리 4 대장간 판석 5 재 6 흑요석
def build_grid():
    op = np.zeros((H, W), bool)
    op |= ell(12, 37, 9, 5, 1)                 # A 입구 동굴
    op |= rct(10, 39, 13, 43)                  # 출구
    op |= rct(8, 22, 12, 33)                   # AB 통로
    op |= ell(16, 27, 8, 4.5, 2)               # E 호수 동굴
    op |= ell(14, 15, 10, 6.2, 3)              # B 대장간 터
    op |= rct(9, 19, 12, 23)
    op |= rct(23, 12, 29, 16)                  # BC 통로
    op |= ell(37, 14, 11, 6.5, 4)              # C 폭포 동굴
    op |= ell(38, 24.5, 14, 3.5, 5)            # 협곡
    op |= rct(29, 27, 41, 30)
    op |= ell(38, 35, 14, 6.5, 6)              # D 재 벌판
    op |= rct(20, 34, 25, 40)                  # 남쪽 넓은 길
    lava = np.zeros((H, W), bool)
    lava |= ell(41, 10.5, 4.5, 2.7, 7)         # 폭포 웅덩이
    lava[8:12, 39:44] = True
    # 강 (폴리라인 + 폭 2~3)
    pts = [(41, 13), (44, 16), (45, 20), (43, 24), (38, 26), (30, 26), (24, 26), (20, 28)]
    rad = [1.1, 1.4, 1.4, 1.5, 1.6, 1.5, 1.5, 1.4]
    for (x0, y0, r0), (x1, y1, r1) in zip([(a, b, r) for (a, b), r in zip(pts, rad)][:-1], [(a, b, r) for (a, b), r in zip(pts, rad)][1:]):
        for t in np.linspace(0, 1, 40):
            cx = x0 + (x1 - x0) * t; cy = y0 + (y1 - y0) * t; r = r0 + (r1 - r0) * t
            lava |= ((cx_ + .5 - cx - .5) ** 2 + (cy_ + .5 - cy - .5) ** 2) < r * r
    lava |= ell(19, 26, 3.5, 3.2, 8)           # 호수
    op |= lava
    # 바위 섬 (넓은 벌판의 빈칸을 덩어리로 끊는다)
    ISL = [(31, 11, 2.4, 1.8), (41, 19, 2.6, 1.8), (30, 17, 1.9, 1.7), (46, 12, 1.8, 1.7),
           (30, 35, 2.6, 1.8), (46, 32, 2.4, 1.8), (47, 38, 2.2, 1.7), (33, 40, 2.2, 1.6),
           (17, 33, 2.4, 1.8), (5, 36, 1.9, 1.7), (16, 40, 1.9, 1.6), (33, 32, 1.7, 1.6),
           (36, 18, 2.6, 1.9), (24, 19, 2.0, 1.7), (40, 30, 1.8, 1.6), (25, 30, 2.2, 1.8), (21, 30, 1.8, 1.6),
           (10, 34, 1.9, 1.7), (44, 14, 1.8, 1.7), (36, 22, 1.7, 1.4), (50, 35, 1.8, 1.7), (43, 39, 1.9, 1.6)]
    for i, (cx, cy, rx, ry) in enumerate(ISL):
        op &= ~(ell(cx, cy, rx, ry, 40 + i) & ~lava)
    op[:3, :] = False; op[:, :2] = False; op[:, W - 2:] = False; op[H - 1, :] = op[H - 1, :]
    lava &= op
    # 걸어서 닿지 못하는 웅덩이 옆 주머니는 바위로 메운다 (다리 3칸 폭 포함)
    wk = op & ~lava; wk[23:30, 33:36] = True
    lab0, _n0 = ndi.label(wk)
    op &= (lab0 == lab0[H - 1, 11]) | lava
    # 얇은 바위 고치기
    for _ in range(12):
        ch = False
        for y in range(3, H):
            for x in range(2, W - 2):
                if op[y, x] and y - 1 >= 3 and not op[y - 1, x]:
                    need = [not op[y - k, x] if y - k >= 0 else True for k in (1, 2, 3)]
                    if not all(need):
                        op[y - 1, x] = True; ch = True
        if not ch: break
    # 고립 조각 제거 (입구에서 이어지지 않는 열린 칸)
    lab, n = ndi.label(op)
    keep = lab == lab[H - 1, 11]
    op &= keep; lava &= op
    solid = ~op
    face = np.zeros((H, W), bool)
    for y in range(H - 1):
        for x in range(W):
            if solid[y, x]:
                if op[y + 1, x]: face[y, x] = True
                elif solid[y + 1, x] and y + 2 < H and op[y + 2, x]: face[y, x] = True
    kind = np.ones((H, W), int); kind[solid] = 0; kind[lava] = 2
    kind[(kind == 1) & ell(14, 15, 8, 5, 21)] = 4
    kind[(kind == 1) & ell(38, 35, 15.5, 6.8, 22) & (cy_ >= 29)] = 5
    kind[(kind == 1) & ell(41, 37, 4.6, 3.2, 23) & (cy_ >= 29)] = 6
    return op, lava, solid, face, kind

def _jit(seed=1, jitter=2.0):
    Hp, Wp = H * 16, W * 16
    dx = ((noise(Hp, Wp, 7, seed + 90) - .5) * 2 * jitter + (noise(Hp, Wp, 2.5, seed + 91) - .5) * 2).round().astype(int)
    dy = ((noise(Hp, Wp, 7, seed + 92) - .5) * 2 * jitter + (noise(Hp, Wp, 2.5, seed + 93) - .5) * 2).round().astype(int)
    return dx, dy

@painter('ash')
def _ash(X, Y, seed):
    Hh, Ww = X.shape
    n = noise(Hh, Ww, 8, seed) * 0.5 + noise(Hh, Ww, 3, seed + 1) * 0.5
    im = pick([ST[3], BR[1], ST[3], ST[4]], n).astype(np.int32)
    im[_spk((Hh, Ww), seed + 2, 0.05)] = ST[4]; im[_spk((Hh, Ww), seed + 3, 0.035)] = ST[1]
    im[_spk((Hh, Ww), seed + 4, 0.012)] = ST[5]
    return im

@painter('obsidian')
def _obs(X, Y, seed):
    Hh, Ww = X.shape
    n = noise(Hh, Ww, 6, seed) * 0.5 + noise(Hh, Ww, 2.4, seed + 1) * 0.5
    im = pick([ST[0], ST[1], ST[1], ST[2]], n).astype(np.int32)
    sheen = (((X + Y) % 29) < 2) & (noise(Hh, Ww, 5, seed + 5) > .5)
    im[sheen] = ST[3]
    im[_spk((Hh, Ww), seed + 6, 0.008)] = ST[5]
    return im

BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

def lava_frame(t, lavamask, seed=31):
    Hp, Wp = H * 16, W * 16
    F = noise(Hp, Wp, 7, seed) * 0.55 + noise(Hp, Wp, 3, seed + 1) * 0.45
    lo, hi = np.percentile(F, 4), np.percentile(F, 96)
    F = np.clip((F - lo) / (hi - lo), 0, 1)
    ph = noise(Hp, Wp, 14, seed + 2) * 2 * math.pi
    th = 2 * math.pi * t / 4.0 + ph
    Y, X = np.mgrid[0:Hp, 0:Wp]
    sx = (X + np.round(3 * np.cos(th)).astype(int)) % Wp
    sy = (Y + np.round(3 * np.sin(th)).astype(int)) % Hp
    v = F[sy, sx]
    hs = hashgrid(Hp, Wp, seed + 3)[sy, sx]
    out = np.zeros((Hp, Wp, 3), np.int32)
    out[:] = RD[2]
    out[v >= .30] = RD[3]; out[v >= .48] = RD[4]; out[v >= .66] = RD[5]; out[v >= .86] = RD[6]
    con = (np.abs(v - .66) < .028) | (np.abs(v - .34) < .02)
    out[con & (v >= .5)] = RD[6]
    out[con & (v < .5)] = RD[2]
    out[(v > .9)] = SR[5]
    out[(hs < .004) & (v > .5)] = SR[6]
    # 둑: 가장자리에서 식은 껍질
    d = ndi.distance_transform_edt(lavamask)
    crust = d < 1.6
    out[crust] = np.array(RD[1])
    out[(d >= 1.6) & (d < 3.2) & ((hs < .55))] = np.array(RD[2])
    out[(d >= 3.2) & (d < 4.6) & (v < .5)] = np.array(RD[2])
    return out

def fall_frame(t, fallpx, ys):
    """폭포: 세로 줄무늬가 프레임마다 4픽셀 내려온다."""
    Hp, Wp = H * 16, W * 16
    Y, X = np.mgrid[0:Hp, 0:Wp]
    col = (X // 2)
    ph = (hashgrid(1, Wp // 2 + 2, 55)[0][col % (Wp // 2 + 2)] * 16).astype(int)
    per = 16
    q = (Y - 4 * t + ph) % per
    out = np.zeros((Hp, Wp, 3), np.int32); out[:] = RD[3]
    out[q < 9] = RD[4]; out[q < 5] = RD[5]; out[q < 2] = SR[5]
    out[(q == 0) & (hashgrid(Hp, Wp, 56) < .5)] = SR[6]
    return out

def render_base(t=0, seed=1):
    op, lava, solid, face, kind = build_grid()
    Hp, Wp = H * 16, W * 16
    Y, X = np.mgrid[0:Hp, 0:Wp]
    dx, dy = _jit(seed, 2.0)
    kf = kind.copy(); kf[kf == 0] = 1; kf[kf == 3] = 1
    names = {1: 'basalt', 2: 'basalt', 4: 'flag', 5: 'ash', 6: 'obsidian'}
    floor, fin = c4.paint_ground(kf, names, seed, 2.0)
    sxx = np.clip(X + dx, 0, Wp - 1) // 16; syy = np.clip(Y + dy, 0, Hp - 1) // 16
    solid_j = solid[syy, sxx]; face_j = face[syy, sxx]
    ceil_j = solid_j & ~face_j
    openpx = ~solid_j
    # 용암 마스크 (경계가 삐뚤게); 벽에 붙은 칸은 통째로 (폭포 밑)
    lava_c = np.repeat(np.repeat(lava, 16, 0), 16, 1)
    lavapx = ((fin == 2) & openpx & lava_c) | (lava_c & np.repeat(np.repeat(np.roll(solid, 1, 0), 16, 0), 16, 1))
    lavapx &= openpx | np.repeat(np.repeat(np.roll(solid, 1, 0), 16, 0), 16, 1)
    lavapx = lavapx & ~ceil_j
    img = floor.copy().astype(np.int32)
    fl4 = (fin == 4) & openpx
    img[fl4] = (img[fl4] * np.array([.50, .44, .42])).astype(np.int32)
    # 벽면
    fyv = noise(Hp // 4, Wp, 5, 61); fyv = np.repeat(fyv, 4, 0)[:Hp]
    fn = fyv * .6 + noise(Hp, Wp, 3, 62) * .4
    fimg = pick([BR[0], BR[1], BR[1], BR[2], BR[1]], fn).astype(np.int32)
    hs = hashgrid(Hp, Wp, 63)
    stra = (Y % 16 == 0) & (hs > .25); fimg[stra] = BR[0]
    stra2 = (Y % 16 == 1) & (hs > .55); fimg[stra2] = BR[2]
    fimg[(hs < .02)] = BR[0]; fimg[(hs > .985)] = BR[3]
    ftop = face_j & ~np.roll(face_j, 1, 0); fimg[ftop] = BR[3]
    ftop2 = face_j & np.roll(ftop, 1, 0); fimg[ftop2 & (hs < .7)] = BR[2]
    fbot = face_j & ~np.roll(face_j, -1, 0); fimg[fbot] = BR[0]
    fbot2 = face_j & np.roll(fbot, 1, 0); fimg[fbot2 & (hs < .5)] = BR[0]
    fdark = (fimg.astype(float) * np.where(ftop | ftop2, 1.0, .72)[..., None])
    fimg = fdark.astype(np.int32) if fimg.ndim == 3 else fimg
    img[face_j] = fimg[face_j]
    # 천장
    cn = noise(Hp, Wp, 5, 64) * .5 + noise(Hp, Wp, 2, 65) * .5
    cimg = pick([ST[0], ST[0], ST[1], ST[0]], cn).astype(np.int32)
    d = ndi.distance_transform_edt(ceil_j)
    cimg[(d < 4.5)] = ST[1]
    cimg[(d < 3.3) & (hs > .12)] = ST[2]
    cimg[(d < 2.0)] = ST[3]
    cimg[(d < 1.2)] = ST[4] if False else ST[3]
    # 벽면 위로 이어지는 천장 테두리는 조금 밝게 (윗면)
    img[ceil_j] = cimg[ceil_j]
    # 3/4 윗면: 벽면 바로 위 5행은 밝은 바위 윗면(T)으로 — 벽면(F)보다 한 단 밝고 매끈, 맨 윗줄은 뒤로 물러나는 그림자선
    ftop_c = face_j & ~np.roll(face_j, 1, 0)
    ledge = np.zeros((Hp, Wp), bool)
    for k in range(1, 6): ledge |= np.roll(ftop_c, -k, 0)
    ledge &= ceil_j
    lt = pick([BR[3], BR[3], BR[4], BR[3], BR[2]], noise(Hp, Wp, 3, 66)).astype(np.int32)
    lt[np.roll(ftop_c, -5, 0)] = BR[1]
    lt[np.roll(ftop_c, -1, 0) & (hs < .75)] = BR[4]
    img[ledge] = lt[ledge]
    # 벽 발밑 그림자
    fb = face_j & ~np.roll(face_j, -1, 0)
    sh = ndi.binary_dilation(fb, structure=np.array([[0], [1], [1], [1], [1]]), iterations=1, origin=(-2, 0)) if False else None
    below = np.zeros((Hp, Wp), bool)
    for k in (1, 2, 3, 4):
        below |= np.roll(fb, k, 0)
    below &= openpx & ~lavapx
    img[below] = (img[below] * .55).astype(np.int32)
    # 용암
    lf = lava_frame(t, lavapx)
    img[lavapx] = lf[lavapx]
    # 폭포
    fall = np.zeros((H, W), bool)
    for y in range(H - 2):
        for x in range(W):
            if face[y, x]:
                yy = y + 1
                while yy < H and face[yy, x]: yy += 1
                if yy < H and lava[yy, x] and ((39 <= x <= 43 and y < 12) or (17 <= x <= 25 and 20 <= y < 25)): fall[y, x] = True
    fallpx = np.repeat(np.repeat(fall, 16, 0), 16, 1)
    # 폭포 좌우 가장자리를 삐뚤게, 위는 균열 그림자
    fx0 = np.array([0] * Wp)
    if fallpx.any():
        ff = fall_frame(t, fallpx, None)
        colsd = (hashgrid(1, Hp, 57)[0] * 3).astype(int)[:, None]      # 행마다 0..2
        colsd2 = (hashgrid(1, Hp, 58)[0] * 3).astype(int)[:, None]
        Xc = X
        # 셀 안 폭 줄이기: 좌우 끝 셀의 3픽셀을 깎는다
        lfe = np.roll(fallpx, 1, 1); rfe = np.roll(fallpx, -1, 1)
        left_edge = fallpx & ~lfe; right_edge = fallpx & ~rfe
        fm = fallpx.copy()
        for k in range(0, 4):
            fm &= ~(np.roll(left_edge, k, 1) & (k < 2 + colsd[:, 0][:, None] * np.ones((1, Wp), int)))
            fm &= ~(np.roll(right_edge, -k, 1) & (k < 2 + colsd2[:, 0][:, None] * np.ones((1, Wp), int)))
        ftopf = fallpx & ~np.roll(fallpx, 1, 0)
        img[fm] = ff[fm]
        # 위쪽 균열: 어두운 그림자 8px
        for k in range(0, 8):
            r = np.roll(ftopf, k, 0) & fm
            img[r] = (img[r] * (0.35 + k * .07)).astype(np.int32)
        # 밑: 튀는 불씨 
        fbotf = fallpx & ~np.roll(fallpx, -1, 0)
        for k in range(0, 4):
            r = np.roll(fbotf, -k, 0) & fm & (hs < .22 - k * .04)
            img[r] = SR[6]
    # 온기 (체커 디더)
    dl = ndi.distance_transform_edt(~lavapx)
    glow = np.zeros((Hp, Wp), float)
    glow = np.where(dl < 5, .48, np.where(dl < 9, .30, np.where(dl < 14, .14, 0.0)))
    bay = np.tile(BAY, (Hp // 4 + 1, Wp // 4 + 1))[:Hp, :Wp]
    gm = (glow > bay * .5 + .02) & ~lavapx & ~ceil_j & ~fallpx
    tint = np.array(RD[3], float)
    img[gm] = (img[gm] * (1 - .24) + tint * .24).astype(np.int32)
    meta = dict(op=op, lava=lava, solid=solid, face=face, kind=kind, lavapx=lavapx, fall=fall, ceil=ceil_j, facepx=face_j)
    return np.clip(img, 0, 255).astype(np.uint8), meta

if __name__ == '__main__':
    im, m = render_base(0)
    out = os.path.join(HERE0, '..', '_out-4', 'vc_terrain.png')
    Image.fromarray(im).save(out)
    print(im.shape, 'open', m['op'].sum(), 'lava', m['lava'].sum(), 'fall', m['fall'].sum())
