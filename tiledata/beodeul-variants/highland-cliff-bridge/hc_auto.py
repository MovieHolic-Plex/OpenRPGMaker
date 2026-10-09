# 고원 절벽과 하늘 다리 — 땅 덩이 오토타일(16변형, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸 0).
# 가장자리는 ek_wave5.edges(모든 변형이 같은 씨앗 → 이웃 칸 윤곽이 이어진다), 속 결은 16 주기라 어떤 칸끼리 붙어도 이음새가 없다.
#   autotile-dirt-path   맨땅 길(누런 흙 + 자갈 + 풀이 먹어 든 들쭉날쭉한 끝, 둑 없음) — 걷기
#   autotile-dry-grass   마른 고원 풀 덩이(누런 올리브 풀이 디더로 번진다 — 얼룩진 고원 풀) — 걷기
#   autotile-crop-rows   밭 이랑(가로 이랑 + 채소 잎 줄, 가장자리 흙 두둑) — 막힘
#   (절벽 쪽 둘은 hc_cliff: autotile-cliff-lip 고원 끝 흙 턱 · autotile-sky-rim 하늘 가장자리)
import numpy as np
from PIL import Image
from hc_base import *
from hc_base import _hash, _cell
import hc_ground as HG

X, Y = X16, Y16


def path_cell(n, seed=301):
    """맨땅 길: 속 = 밟아 다진 누런 흙(hc_ground.dirt_rgb), 가장자리 2px = 흙이 엷어지며 풀 잎이 비집고 든다(잎 끝 빛), 바깥 1px 풀 그늘."""
    m, mN, mS = edges(n, inset=2.6, jag=1.7, rad=7.0, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    d = HG.dirt_rgb(X, Y)
    inside = m >= 0
    rgb = np.where(inside[..., None], d, rgb); al |= inside
    edge = inside & (m < 1.6)
    rgb = np.where((edge & (hash2(X, Y, seed + 1) > .45))[..., None], MICHIa[3], rgb)
    blade = inside & (m < 2.2) & (hash2(X, Y, seed + 2) > .78)                       # 길 안으로 든 풀 잎
    rgb = np.where(blade[..., None], GRa[4], rgb)
    tip = np.roll(blade, -1, 0) & inside & ~blade
    rgb = np.where(tip[..., None], GRa[5], rgb)
    out = (m < 0) & (m >= -1.1) & (hash2(X, Y, seed + 3) > .4)                       # 길 둘레 풀 그늘
    rgb = np.where(out[..., None], GRa[3], rgb); al |= out
    return _cell(rgb, al)


def autotile_path(): return sheet_from_cells([path_cell(n) for n in range(16)])


def dry_cell(n, seed=313):
    """마른 고원 풀 덩이: 속 = 칩셋 들풀 결을 누런 올리브로(디더 얼룩), 가장자리 3px 는 화소마다 성겨지며 초록 풀에 섞인다. 올리브 풀 포기 1~2."""
    m, mN, mS = edges(n, inset=2.2, jag=3.0, rad=7.5, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    T = HG._gtex()
    base = np.where((hash2(X // 2, Y // 2, seed + 1) > .7)[..., None], T['drylawn'][Y, X], T['dry'][Y, X])
    base = np.where((hash2(X, Y, seed + 6) > .82)[..., None], NURENa[6], base)                  # 볕에 바랜 풀끝
    keep = (m >= 0) & ((m > 3) | (hash2(X, Y, seed + 2) < (m + .6) / 3.6))
    rgb = np.where(keep[..., None], base, rgb); al |= keep
    if n == 15 or _hash(n, 0, seed) > .3:
        ox = 3 + int(_hash(n, 1, seed) * 10); oy = 6 + int(_hash(n, 2, seed) * 8)
        if m[oy, ox] > 3: HG.tuft(rgb, al, ox, oy, _hash(n, 3, seed) > .5, NURENa, mask=m > 1)
    return _cell(rgb, al)


def autotile_dry(): return sheet_from_cells([dry_cell(n) for n in range(16)])


def crop_cell(n, seed=327):
    """밭 이랑: 4px 주기 가로 이랑(윗면 흙 michi 4·5 빛 + 고랑 michi 2) 위에 채소 잎 포기(잎 3x2, 빛 위·그늘 밑)가 이랑마다 엇갈려.
    가장자리 = 흙 두둑(michi 3, 바깥 1px 짙게) 과 풀 그늘. 남쪽 가장자리는 두둑 앞면이 1px 더 보인다(3/4)."""
    m, mN, mS = edges(n, inset=1.2, jag=1.2, rad=4.5, seed=seed)
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), bool)
    inside = m >= 0
    ly = Y % 4
    t = np.where(ly == 0, 5, np.where(ly == 1, 4, np.where(ly == 2, 3, 2)))
    t = np.where(hash2(X, Y, seed + 1) > .9, t + 1, t)
    rgb = np.where(inside[..., None], MICHIa[np.clip(t, 1, 6)], rgb); al |= inside
    for row in range(4):
        for i in range(5):
            px_ = (int(i * 3.2) + (row % 2) * 2 + int(_hash(i, row, seed + 2) * 2)) % 16; py_ = row * 4
            for (dx, dy, k) in ((0, 0, 5), (1, 0, 6), (2, 0, 5), (0, 1, 4), (1, 1, 4), (2, 1, 3), (1, -1, 6)):
                x_, y_ = (px_ + dx) % 16, (py_ + dy) % 16
                if inside[y_, x_] and m[y_, x_] > 1.6: rgb[y_, x_] = LEAFa[k]
    bank = inside & (m < 1.6)
    rgb = np.where(bank[..., None], np.where((m < .6)[..., None], MICHIa[2], MICHIa[4]), rgb)
    sface = (mS >= -1.2) & (mS < 0) & (m >= -1.2)
    rgb = np.where(sface[..., None], MICHIa[1], rgb); al |= sface
    return _cell(rgb, al)


def autotile_crop(): return sheet_from_cells([crop_cell(n) for n in range(16)])
