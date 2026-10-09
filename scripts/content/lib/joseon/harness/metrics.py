"""조각 한 장(RGBA 배열)의 화풍 지표. 통과선은 버들항 객체 분포에서 잰다(calibrate.py)."""
import numpy as np


def luma(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def metrics(a):
    """a: (h, w, 4) uint8. 불투명(255) 화소만 본체로 본다."""
    op = a[:, :, 3] == 255
    n = int(op.sum())
    if n < 64:
        return None
    L = luma(a[:, :, :3].astype(float)) / 255.0
    h, w = op.shape
    pad = np.pad(op, 1)
    up, dn, lf, rt = pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]
    # 1) 가장자리/안쪽 밝기비: 실루엣 가장자리 화소와 한 칸 안쪽 화소의 밝기 비(inset 외곽선이면 0.5~0.9, 검은 링이면 0.3 이하)
    edge = op & ~(up & dn & lf & rt)
    ratios = []
    ys, xs = np.nonzero(edge)
    for y, x in zip(ys, xs):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            Y, X = y + dy, x + dx
            if 0 <= Y < h and 0 <= X < w and not op[Y, X] and a[Y, X, 3] == 0:
                # 바깥 방향의 반대쪽(안쪽) 화소
                iy, ix = y - dy, x - dx
                if 0 <= iy < h and 0 <= ix < w and op[iy, ix] and L[iy, ix] > 0.02:
                    ratios.append(L[y, x] / L[iy, ix])
                break
    edge_ratio = float(np.median(ratios)) if ratios else 1.0
    # 2) 빛: 왼쪽 반이 오른쪽 반보다 밝은 정도(왼쪽 위 빛). 불투명 화소의 평균 밝기 차 / 평균
    cx = np.nonzero(op.any(axis=0))[0]
    mid = (cx.min() + cx.max() + 1) / 2.0
    xs_all = np.arange(w)[None, :].repeat(h, 0)
    lm, rm = op & (xs_all < mid), op & (xs_all >= mid)
    light_lr = float((L[lm].mean() - L[rm].mean()) / max(L[op].mean(), 1e-3)) if lm.any() and rm.any() else 0.0
    # 3) 1px 가는 줄: 가로·세로 모두 이웃이 없는(폭 1) 화소 비율
    thin = op & (~(lf | rt) | ~(up | dn))
    thin_ratio = float(thin.sum() / n)
    # 4) 결(grain): 16×16 칸당 서로 다른 색 수의 평균(불투명 화소 90% 이상인 칸만)
    cols = []
    for ty in range(0, h - 15, 16):
        for tx in range(0, w - 15, 16):
            blk = a[ty:ty + 16, tx:tx + 16]
            if (blk[:, :, 3] == 255).mean() >= 0.9:
                cols.append(len({tuple(p) for p in blk[:, :, :3].reshape(-1, 3)}))
    grain = float(np.mean(cols)) if cols else None
    # 5) 좌우 대칭도: 실루엣 마스크를 뒤집어 겹쳤을 때 어긋난 비율
    x0, x1 = cx.min(), cx.max() + 1
    sub = op[:, x0:x1]
    asym = float((sub ^ sub[:, ::-1]).sum() / max(sub.sum(), 1))
    # 6) 그림자: 반투명 화소의 무게중심이 본체 무게중심보다 아래·오른쪽인가(없으면 None)
    sh = (a[:, :, 3] > 0) & (a[:, :, 3] < 255)
    shadow_dy = shadow_dx = None
    if sh.sum() >= 8:
        sy, sx = np.nonzero(sh); by, bx = np.nonzero(op)
        shadow_dy, shadow_dx = float(sy.mean() - by.mean()), float(sx.mean() - bx.mean())
    return {'edge_ratio': edge_ratio, 'light_lr': light_lr, 'thin_ratio': thin_ratio, 'grain': grain,
            'asym': asym, 'shadow_dy': shadow_dy, 'shadow_dx': shadow_dx, 'opaque_px': n}
