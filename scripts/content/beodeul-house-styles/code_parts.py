"""코드로 만드는 재질 판(모델 호출 없음) — 원본 버들항 그림의 무늬를 그대로 따른다.
 · tile / tile-l / tile-r: 원본 붉은 기와 지붕의 되풀이 단위(앞면 4×4 · 왼 물매 8×4 · 오른 물매 4×4, bd-house-inn · bd-house-h110_0 에서 잰 것).
 · stone: 원본 여관 아래층 막돌의 짜임(4px 단, 낱돌 4~7px, 모서리 둥글고 줄눈은 보랏빛, 줄눈이 만나는 곳은 짙은 남보라) — Fable 판이 두 번 다 원본보다 크고 반듯했다.
usage: python hs_code.py <style>"""
import random, sys, os
import numpy as np
from PIL import Image
import hs as L
def save(style, name, grid, ramps, ramp):
    cs = [L.hx(c) for c in ramps[ramp]]; h, w = len(grid), len(grid[0]); a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w): a[y, x, :3] = cs[grid[y][x]]; a[y, x, 3] = 255
    Image.fromarray(a, "RGBA").save(L.STORE / style / "parts" / f"{name}.png")
def tiles(style, ramps):
    D, M, Lt, Hh = 1, 3, 5, 6
    unit = dict(tile=[[Lt, M, D, M], [Lt, M, D, Lt], [Lt, D, D, Lt], [M, M, M, D]],
                **{'tile-l': [[D, M, M, D, D, D, D, D], [D, M, Lt, Lt, Hh, Hh, Hh, Hh], [Lt, M, M, Lt, Lt, Lt, Hh, Hh], [D, D, Lt, Lt, Lt, Lt, Lt, Lt]],
                   'tile-r': [[D, M, D, D], [D, M, M, M], [Lt, M, Lt, Lt], [Lt, D, M, Lt]]})
    for name, u in unit.items():
        save(style, name, [[u[y % 4][x % len(u[0])] for x in range(48)] for y in range(48)], ramps, 'tile')
def rubble(style, ramps, W=48, H=32, seed=7):
    rnd = random.Random(seed); g = [[2] * W for _ in range(H)]       # 줄눈(stone:2)으로 채우고 낱돌을 놓는다
    cuts = []
    for c in range(H // 4):
        while True:   # 이 단의 낱돌 폭(줄눈 한 열 포함): 4~7, 합 48, 윗단 줄눈과 겹치지 않게
            ws = []; 
            while sum(ws) < W: ws.append(rnd.choice([4, 5, 5, 6, 6, 7]))
            if sum(ws) != W: continue
            off = rnd.randrange(0, 4); xs = []; x = off
            for w_ in ws: xs.append((x % W, w_)); x += w_
            ends = {(x0 + w_ - 1) % W for x0, w_ in xs}
            if not cuts or not (ends & cuts[-1]) and all(ws[i] != ws[i + 1] for i in range(len(ws) - 1)): break
        cuts.append(ends); y0 = c * 4
        for x0, w_ in xs:
            body = rnd.choice([4, 5, 5, 4, 5, 3]); top = 6 if body >= 4 else 4; n = w_ - 1; tall = rnd.random() < 0.3; low = rnd.random() < 0.18
            for i in range(n):
                x = (x0 + i) % W; edge = i in (0, n - 1)
                g[y0][x] = 2 if (edge and n > 2) or low else (7 if (i == 1 and rnd.random() < 0.4) else top)      # 윗줄: 모서리는 줄눈(둥근 돌)
                g[y0 + 1][x] = top if (i == 0 or (low and not edge)) else body
                g[y0 + 2][x] = 3 if i == n - 1 or not tall else body
                if not tall and i < n - 1: g[y0 + 2][x] = body if rnd.random() < 0.55 else 3
                g[(y0 + 3) % H][x] = (3 if tall and not edge else 2)
            xj = (x0 + n) % W                                                                                         # 세로 줄눈
            for r in range(3): g[y0 + r][xj] = 2
            g[(y0 + 3) % H][xj] = 0; 
            if rnd.random() < 0.5: g[(y0 + 3) % H][(xj - 1) % W] = 0
            if rnd.random() < 0.35: g[y0][xj] = 0
            if rnd.random() < 0.25: g[(y0 + 3) % H][(xj + 1) % W] = 1
    save(style, 'stone', g, ramps, 'stone')
if __name__ == '__main__':
    st = sys.argv[1]; R = L.ramps_of(st)
    if 'tile' in R: tiles(st, R)
    rubble(st, R)
