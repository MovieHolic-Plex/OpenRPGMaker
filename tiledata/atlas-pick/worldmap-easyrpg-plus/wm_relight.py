"""덩어리(산/숲) 재조명. 원본 화소 구조는 두고, 명도만 규칙으로 다시 정한다.
- 원본 명도를 뭉개 높이장으로 보고, 좌상 광원 엠보스로 밝은 면/어두운 면을 벌린다.
- 다시 6~8 단 램프로 양자화(도트 유지, 디더 제거).
- 눈: 봉우리 A 의 꼭대기(기하 규칙)에만."""
import numpy as np
from scipy import ndimage


def luma(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def smooth_masked(v, m, sigma):
    num = ndimage.gaussian_filter(np.where(m, v, 0.0), sigma)
    den = ndimage.gaussian_filter(m.astype(float), sigma)
    return np.where(m, num / np.maximum(den, 1e-6), 0.0)


def ramp_lookup(ramp, t):
    """t in [0,1] -> ramp 색(양자화). ramp: (n,3)"""
    n = len(ramp)
    idx = np.clip(np.floor(t * n).astype(int), 0, n - 1)
    return np.array(ramp, np.uint8)[idx]


def relight(canvas, mass_mask, outline_mask, ramp, sigma=0.9, k_light=1.15, lo=None, hi=None, gamma=1.0):
    H, W, _ = canvas.shape
    L = luma(canvas.astype(float))
    m = mass_mask & ~outline_mask
    Ls = smooth_masked(L, m, sigma)
    # 엠보스: 오른쪽 아래가 더 밝으면 빛을 받는 면
    P = np.pad(Ls, 1, mode='edge')
    emb = P[2:, 2:] - P[:-2, :-2]
    Lm = Ls + k_light * emb
    a = np.percentile(Lm[m], 2) if lo is None else lo
    b = np.percentile(Lm[m], 98) if hi is None else hi
    t = np.clip((Lm - a) / max(b - a, 1e-6), 0, 1) ** gamma
    out = canvas.copy()
    out[m] = ramp_lookup(ramp, t)[m]
    return out, Ls, t
