"""나무·공간감 지표. 통과선은 버들항(calibrate_space.py 가 잰 space_calibration.json)에서 온다.

tree_metrics(a)   : 나무 한 그루(RGBA 배열)의 잎 결·덩이감·크기.
map_windows(rgb, cell, win, lawn) : 지도 그림을 win×win 칸 창으로 훑어 잔디 맨바닥 비율 등을 잰다.
"""
import numpy as np


def luma(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def tree_metrics(a):
    """잎 결: 이웃 화소 밝기 차의 평균(texture), 서로 다른 색 수(colors), 불투명 화소 수(px),
    윗왼쪽 밝기 우세(lit: 위쪽 절반 평균 − 아래쪽 절반 평균, 수관 영역만), 줄기 폭 대비 수관 폭(crown_ratio)."""
    op = a[:, :, 3] == 255
    n = int(op.sum())
    if n < 200:
        return None
    L = luma(a[:, :, :3].astype(float)) / 255.0
    h, w = op.shape
    both_x = op[:, 1:] & op[:, :-1]
    both_y = op[1:, :] & op[:-1, :]
    dx = np.abs(L[:, 1:] - L[:, :-1])[both_x]
    dy = np.abs(L[1:, :] - L[:-1, :])[both_y]
    texture = float(np.concatenate([dx, dy]).mean())
    colors = len({tuple(p) for p in a[op][:, :3]})
    rows = np.nonzero(op.any(axis=1))[0]
    top, bot = rows.min(), rows.max()
    widths = op.sum(axis=1)
    crown_w = int(widths[top:top + max(4, (bot - top) // 2)].max())
    base_rows = widths[max(top, bot - 6):bot + 1]
    trunk_w = int(np.median(widths[bot - (bot - top) // 5 - 6: bot - (bot - top) // 5])) if bot - top > 20 else crown_w
    mid = (top + bot) / 2
    ys = np.arange(h)[:, None].repeat(w, 1)
    up, dn = op & (ys < mid), op & (ys >= mid)
    lit = float(L[up].mean() - L[dn].mean()) if up.any() and dn.any() else 0.0
    return {'texture': texture, 'colors': colors, 'px': n, 'lit': lit, 'crown_ratio': crown_w / max(1, trunk_w),
            'w': int(op.any(axis=0).sum()), 'h': int(bot - top + 1)}


def lawn_mask(rgb):
    """잔디색: 팔레트 leaf 램프의 잔디 톤(3~6)과 정확히 같은 화소. (바람의나라 올리브 팔레트는 색 대역이 아니라 램프 색 집합으로 판정)"""
    import json, os
    pal = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'palette.json')))
    tones = [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in pal['ramps']['leaf'][3:7]]
    m = np.zeros(rgb.shape[:2], bool)
    for t in tones:
        m |= (rgb[:, :, 0] == t[0]) & (rgb[:, :, 1] == t[1]) & (rgb[:, :, 2] == t[2])
    return m


def lawn_cells(rgb, cell, lawn=None):
    """cell×cell 칸의 90% 이상이 잔디색이면 True(= 아무것도 안 얹힌 맨 잔디)."""
    m = lawn_mask(rgb)
    H, W = rgb.shape[0] // cell, rgb.shape[1] // cell
    G = m[:H * cell, :W * cell].reshape(H, cell, W, cell).mean(axis=(1, 3)) >= 0.9
    return G


def lawn_colors(rgb, k=8):
    return None


def window_stats(G, win_w=20, win_h=15, stride=5):
    """창마다 잔디 맨바닥 비율. 반환: 비율 리스트."""
    H, W = G.shape
    out = []
    for y in range(0, max(1, H - win_h + 1), stride):
        for x in range(0, max(1, W - win_w + 1), stride):
            out.append(float(G[y:y + win_h, x:x + win_w].mean()))
    return out
