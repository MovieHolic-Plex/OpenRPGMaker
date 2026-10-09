# 한 화면(20×15) 빈 바닥 비율: 낭떠러지가 아니고, 물체·덩이·길이 덮지 않은 맨 바탕 칸.
import make_airship_dock as M
import numpy as np
cov = np.zeros((M.H, M.W), bool)
for (n, cx, cyb, dx, dy, fl) in M.OBJ:
    im = M.I[n]
    if cyb is None: px, py = dx, dy
    else: px, py = cx * 16 + dx, (cyb + 1) * 16 - im.height + dy
    a = np.array(im)[..., 3] > 0
    for j in range(im.height // 16):
        for i in range(im.width // 16):
            if a[j*16:(j+1)*16, i*16:(i+1)*16].mean() > .08:
                x, y = (px // 16) + i, (py // 16) + j
                if 0 <= x < M.W and 0 <= y < M.H: cov[y, x] = True
for name in ('autotile-coal-dust', 'autotile-plank-puddle', 'autotile-iron-railing'):
    for (x, y) in M.auto[name]: cov[y, x] = True
empty = np.zeros_like(cov)
for y in range(M.H):
    for x in range(M.W):
        empty[y, x] = (not M.abyss[y][x]) and (not cov[y, x]) and M.ground[y][x] in ('ground-highland-grass', 'ground-cliff-rock', 'ground-cinder-yard')
worst = []
for y0 in range(0, M.H - 14, 5):
    for x0 in range(0, M.W - 19, 5):
        sub = empty[y0:y0+15, x0:x0+20]; land = sum(1 for y in range(y0, y0+15) for x in range(x0, x0+20) if not M.abyss[y][x])
        worst.append((sub.sum() / max(1, land), x0, y0))
worst.sort(reverse=True)
print('worst screens', [(round(a, 2), x, y) for a, x, y in worst[:6]])
