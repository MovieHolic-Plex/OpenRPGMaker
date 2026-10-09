# 얼음 동굴 지형 렌더: 열린 칸 격자(op)에서 벽 앞면·천장·바닥을 칸 정렬로 칠한다(타일로 그대로 굽힐 수 있다).
from wl import *
from scipy import ndimage as ndi
import ice_terrain as IT

def face_mask(op):
    """앞면 칸 = 닫힌 칸 중 바로 아래가 열린 칸이거나(1행), 아래가 앞면 1행이고 그 아래가 열린 칸(2행)."""
    H, W = op.shape; solid = ~op
    f1 = np.zeros((H, W), bool); f2 = np.zeros((H, W), bool)
    f1[:-1] = solid[:-1] & op[1:]
    f2[:-2] = solid[:-2] & f1[1:-1] & ~op[:-2] & solid[1:-1] if False else False
    f2[:-2] = solid[:-2] & solid[1:-1] & op[2:]
    return f1 | f2, f1, f2

def thicken(op, minthick=3):
    """열린 칸 바로 위의 닫힌 줄이 3칸 미만이면(앞면 2 + 천장 1 미만) 그 닫힌 칸을 열어 합친다."""
    op = op.copy(); H, W = op.shape
    for _ in range(20):
        ch = False
        for y in range(1, H):
            for x in range(W):
                if op[y, x] and not op[y - 1, x]:
                    run = 0
                    yy = y - 1
                    while yy >= 0 and not op[yy, x]: run += 1; yy -= 1
                    if yy >= 0 and run < minthick:
                        op[yy + 1:y, x] = True; ch = True
                    elif yy < 0 and run < minthick:
                        op[0:y, x] = True; ch = True
        if not ch: break
    return op

def render_cells(op, kinds, seed=1, wrap_x=False):
    """op: bool(H,W) 열림. kinds: int(H,W) 바닥 종류 0 얼음 1 금간 얼음 2 눈. 반환 (RGB uint8, meta)."""
    H, W = op.shape; Hp, Wp = H * 16, W * 16
    Y, X = np.mgrid[0:Hp, 0:Wp]
    solid = ~op
    face, f1, f2 = face_mask(op)
    ceil = solid & ~face
    big = lambda a: np.repeat(np.repeat(a, 16, 0), 16, 1)
    openp = big(op); facep = big(face); ceilp = big(ceil)
    # 앞면 높이(칸 수)와 줄 안 위치
    run_len = np.zeros((H, W), int); run_top = np.zeros((H, W), int)
    for x in range(W):
        y = 0
        while y < H:
            if face[y, x]:
                y0 = y
                while y < H and face[y, x]: y += 1
                for yy in range(y0, y): run_len[yy, x] = y - y0; run_top[yy, x] = y0
            else: y += 1
    Hf = big(run_len) * 16; fy = Y - big(run_top) * 16
    out = np.zeros((Hp, Wp, 3), np.uint8)
    # 바닥
    ice1 = IT.paint_ice(X, Y, seed=1 + seed)
    ice2 = IT.paint_ice(X, Y, seed=2 + seed, cracks=True)
    snow = IT.paint_snow(X, Y, seed=3 + seed)
    kp = big(kinds)
    floor = np.where((kp == 1)[..., None], ice2, np.where((kp == 2)[..., None], snow, ice1))
    out = np.where(openp[..., None], floor, out)
    # 앞면: 얼음/암벽을 칸 덩이 잡음으로 섞는다
    fi = IT.paint_face_ice(X, Y, fy, seed=11, Hf=np.maximum(Hf, 16))
    fr = IT.paint_face_rock(X, Y, fy, seed=13, Hf=np.maximum(Hf, 16))
    mixn = tnoise(Wp, Hp, 64, seed + 40)
    use_ice = (mixn > 0.46) & ((X // 16 + (Y // 16) * 0) >= 0)
    facecol = np.where(use_ice[..., None], fi, fr)
    out = np.where(facep[..., None], facecol, out)
    # 천장 + 윗면 턱(앞면 위 6화소는 벽 윗면이라 한 단 밝다) + 가장자리 테
    ce = IT.paint_ceiling(X, Y, seed=17 + seed)
    out = np.where(ceilp[..., None], ce, out)
    non = ~ceilp
    if wrap_x:
        padded = np.pad(ceilp, ((0, 0), (Wp, Wp)), mode='wrap')
        dist = ndi.distance_transform_edt(padded)[:, Wp:2 * Wp]
    else:
        dist = ndi.distance_transform_edt(ceilp)
    # 앞면 윗선 바로 위(벽 윗면)만 따로: 위쪽 이웃이 앞면이 아닌 곳은 제외 — 앞면 칸 바로 위 6화소
    ftop = facep & ~np.roll(facep, 1, 0)
    ledge = np.zeros_like(ceilp)
    for k in range(1, 7): ledge |= np.roll(ftop, -k, 0)
    ledge &= ceilp
    P_ = P('cavestone')
    ct = np.full((Hp, Wp), 1, int)
    ct = np.where(dist < 8, 2, ct); ct = np.where(dist < 5.5, 2, ct); ct = np.where(dist < 3.2, 3, ct); ct = np.where(dist < 1.6, 4, ct)
    ct = ct + (IT.hash2(X, Y, 91) > 0.82) * 0 - (IT.hash2(X, Y, 92) > 0.9) * 1
    ledge_t = np.where(IT.hash2(X, Y, 93) > 0.7, 4, 3)
    ledge_t = np.where(np.roll(ftop, -6, 0) | np.roll(ftop, -5, 0), 2, ledge_t)
    ledge_t = np.where(np.roll(ftop, -1, 0), 5, ledge_t)
    ct = np.where(ledge, ledge_t, ct)
    ct = np.clip(ct, 0, 6)
    ce2 = P_[ct]
    out = np.where(ceilp[..., None] & (dist < 8), ce2, out)
    out = np.where((ceilp & ledge)[..., None], ce2, out)
    # 서리 점(천장 가장자리)
    fr_pt = ceilp & (dist < 6) & (IT.hash2(X, Y, 94) > 0.985)
    out = np.where(fr_pt[..., None], P('frost')[5], out)
    # 벽 발밑 그림자: 앞면 바로 아래 4줄을 어둡게
    fb = facep & ~np.roll(facep, -1, 0)
    below = np.zeros_like(openp)
    for k in (1, 2, 3, 4): below |= np.roll(fb, k, 0)
    below &= openp
    out = np.where(below[..., None], (out.astype(float) * np.array([0.72, 0.76, 0.9])).astype(np.uint8), out)
    return out, dict(face=face, ceil=ceil, f1=f1, f2=f2, run_len=run_len, run_top=run_top)

def cell_overlay(sheet, mask, join=None):
    """mask: bool(H,W). 오토타일 시트(64x64)로 각 칸의 이웃 비트를 계산해 겹침 그림을 만든다."""
    H, W = mask.shape
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0))
    def on(x, y):
        return 0 <= x < W and 0 <= y < H and (mask[y, x] or (join is not None and join[y, x]))
    for y in range(H):
        for x in range(W):
            if not mask[y, x]: continue
            n = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            im.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (x * 16, y * 16))
    return im
