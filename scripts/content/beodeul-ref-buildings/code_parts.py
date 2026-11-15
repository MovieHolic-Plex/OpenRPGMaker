#!/usr/bin/env python3
"""코드로 만드는 부품(모델 호출 없음) + 부품 출처 표(parts.json).   python3 scripts/content/beodeul-ref-buildings/code_parts.py
 · tile / tile-l / tile-r: 원본 버들항 붉은 기와 지붕의 되풀이 단위(앞면 4×4 · 왼 물매 8×4 · 오른 물매 4×4) — 집 양식 조립기의 code_parts.py 와 같은 코드.
 · stone / fstone / buff: 원본 여관 아래층 막돌의 짜임(4px 단, 낱돌 4~7px, 모서리 둥글고 줄눈이 만나는 곳은 가장 짙은 단)을 색 줄 셋으로(보랏빛 줄눈 막돌 · 회색 냇돌 · 회갈색 항구 막돌).
 · mauve: Fable 널판 판(boards)을 자줏빛 색 줄의 같은 단으로만 옮김(모양 그대로).
어느 판이 Fable 그림이고 어느 판이 코드인지: tiledata/beodeul-ref-buildings/parts.json (이 스크립트가 쓴다). HALFTIMBER 는 집 양식 일꾼(가지 agent/beodeul-house-styles)이 그린 목골 부품을 복사한 것."""
import json, random
import numpy as np
from PIL import Image
import rb as L
HALFTIMBER = ('balcony', 'beam', 'boards', 'cellar', 'chimney', 'clutter', 'door-shop', 'door', 'dormer', 'eave', 'plaster', 'ridge', 'shingle', 'sign-shop', 'sign', 'smoke', 'stair',
              'win-attic', 'win-box', 'win-plain', 'win-shop', 'win-shutter')
def save(name, grid, ramps, ramp):
    cs = [L.hx(c) for c in ramps[ramp]]; h, w = len(grid), len(grid[0]); a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w): a[y, x, :3] = cs[grid[y][x]]; a[y, x, 3] = 255
    Image.fromarray(a, "RGBA").save(L.STORE / "parts" / f"{name}.png")
def tiles(ramps):
    D, M, Lt, Hh = 1, 3, 5, 6
    unit = dict(tile=[[Lt, M, D, M], [Lt, M, D, Lt], [Lt, D, D, Lt], [M, M, M, D]],
                **{'tile-l': [[D, M, M, D, D, D, D, D], [D, M, Lt, Lt, Hh, Hh, Hh, Hh], [Lt, M, M, Lt, Lt, Lt, Hh, Hh], [D, D, Lt, Lt, Lt, Lt, Lt, Lt]],
                   'tile-r': [[D, M, D, D], [D, M, M, M], [Lt, M, Lt, Lt], [Lt, D, M, Lt]]})
    for name, u in unit.items():
        save(name, [[u[y % 4][x % len(u[0])] for x in range(48)] for y in range(48)], ramps, 'tile')
def rubble(name, ramps, ramp, W=48, H=32, seed=7):
    rnd = random.Random(seed); g = [[2] * W for _ in range(H)]       # 줄눈(2단)으로 채우고 낱돌을 놓는다
    cuts = []
    for c in range(H // 4):
        while True:   # 이 단의 낱돌 폭(줄눈 한 열 포함): 4~7, 합 48, 윗단 줄눈과 겹치지 않게
            ws = []
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
                g[y0][x] = 2 if (edge and n > 2) or low else (7 if (i == 1 and rnd.random() < 0.4) else top)
                g[y0 + 1][x] = top if (i == 0 or (low and not edge)) else body
                g[y0 + 2][x] = 3 if i == n - 1 or not tall else body
                if not tall and i < n - 1: g[y0 + 2][x] = body if rnd.random() < 0.55 else 3
                g[(y0 + 3) % H][x] = (3 if tall and not edge else 2)
            xj = (x0 + n) % W
            for r in range(3): g[y0 + r][xj] = 2
            g[(y0 + 3) % H][xj] = 0
            if rnd.random() < 0.5: g[(y0 + 3) % H][(xj - 1) % W] = 0
            if rnd.random() < 0.35: g[y0][xj] = 0
            if rnd.random() < 0.25: g[(y0 + 3) % H][(xj + 1) % W] = 1
    save(name, g, ramps, ramp)
def recolour(name, src, ramps, frm, to):
    a = np.array(Image.open(L.STORE / "parts" / f"{src}.png").convert("RGBA")); out = a.copy(); dst = ramps[to]
    for i, c in enumerate(ramps[frm]): out[(a[:, :, :3] == L.hx(c)).all(2) & (a[:, :, 3] > 0), :3] = L.hx(dst[min(i, len(dst) - 1)])
    Image.fromarray(out, "RGBA").save(L.STORE / "parts" / f"{name}.png")
def main():
    R = L.ramps_of(); made = {}
    tiles(R); made.update({n: "코드 — 원본 버들항 붉은 기와 지붕의 되풀이 단위" for n in ("tile", "tile-l", "tile-r")})
    rubble('stone', R, 'stone', seed=7); made['stone'] = "코드 — 원본 여관 막돌의 짜임(보랏빛 줄눈)"
    rubble('fstone', R, 'fstone', seed=11); made['fstone'] = "코드 — 원본 여관 막돌의 짜임을 회색 냇돌 색 줄로"
    rubble('buff', R, 'buff', seed=5); made['buff'] = "코드 — 원본 여관 막돌의 짜임을 회갈색 항구 막돌 색 줄로"
    if (L.STORE / "parts" / "boards.png").exists(): recolour('mauve', 'boards', R, 'board', 'mauve'); made['mauve'] = "코드 — Fable 널판 판(boards)을 자줏빛 색 줄의 같은 단으로 옮김"
    if (L.STORE / "parts" / "chimney.png").exists(): recolour('chimney-grey', 'chimney', R, 'stone', 'fstone'); made['chimney-grey'] = "코드 — 목골 굴뚝(Fable)을 회색 냇돌 색 줄의 같은 단으로 옮김"
    if (L.STORE / "parts" / "crenel.png").exists(): recolour('crenel-stone', 'crenel', R, 'grey', 'stone'); made['crenel-stone'] = "코드 — 흉벽(Fable)을 보랏빛 줄눈 막돌 색 줄의 같은 단으로 옮김"
    if (L.STORE / "parts" / "slit.png").exists(): recolour('slit-stone', 'slit', R, 'grey', 'stone'); made['slit-stone'] = "코드 — 뾰족 살창(Fable)의 돌 테를 막돌 색 줄의 같은 단으로 옮김"
    g = [(0, 0, 3, 3, 3, 0, 0), (0, 3, 4, 4, 4, 3, 0), (3, 4, 5, 6, 5, 4, 3), (3, 4, 6, 6, 6, 4, 3), (3, 4, 5, 6, 5, 4, 3), (0, 3, 4, 4, 4, 3, 0), (0, 0, 3, 3, 3, 0, 0)]      # 등불 빛: 0 빈 화소, 3·4 주황·노랑, 5·6 밝은 속
    cs = {3: R['accent'][3], 4: R['accent'][4], 5: R['frame'][2], 6: R['frame'][3]}; a = np.zeros((7, 7, 4), np.uint8)
    for y in range(7):
        for x in range(7):
            if g[y][x]: a[y, x, :3] = L.hx(cs[g[y][x]]); a[y, x, 3] = 255
    Image.fromarray(a, "RGBA").save(L.STORE / "parts" / "lamp.png"); made['lamp'] = "코드 — 술청 등불의 빛(7×7)"
    note = {}
    if (L.STORE / "parts" / "archgate.png").exists():   # 아치 밑은 사람이 지나가는 칸이다 — 기둥 사이(16~31열)에 그려진 계단을 지운다(되풀이해도 같다)
        a = np.array(Image.open(L.STORE / "parts" / "archgate.png").convert("RGBA")); n = int((a[28:, 16:32, 3] > 0).sum()); a[28:, 16:32] = 0
        if n: Image.fromarray(a, "RGBA").save(L.STORE / "parts" / "archgate.png")
        note['archgate'] = "Fable 5.2 medium 그림 (기둥 사이에 그려진 계단만 코드로 지움 — 그 칸은 사람이 지나간다)"

    if (L.STORE / "parts" / "slate.png").exists():      # 슬레이트 판의 밝은 회색 낱장(지시문의 «바랜 낱장»)이 지붕에서 얼룩으로 읽혀 보랏빛 가장 밝은 단으로 옮긴다(되풀이해도 같다)
        a = np.array(Image.open(L.STORE / "parts" / "slate.png").convert("RGBA")); grey = {L.hx(c) for r in ('grey', 'fstone', 'iron') for c in R[r]}; n = 0
        for y in range(a.shape[0]):
            for x in range(a.shape[1]):
                if tuple(a[y, x, :3]) in grey: a[y, x, :3] = L.hx(R['slate'][6]); n += 1
        if n: Image.fromarray(a, "RGBA").save(L.STORE / "parts" / "slate.png")
        note['slate'] = "Fable 5.2 medium 그림 (회색으로 그려진 바랜 낱장 69화소만 코드로 보랏빛 가장 밝은 단으로 옮김)"
    table = {}
    for p in sorted((L.STORE / "parts").glob("*.png")):
        table[p.stem] = made.get(p.stem) or note.get(p.stem) or ("Fable 5.2 medium 그림 — 집 양식 일꾼의 목골 부품을 복사" if p.stem in HALFTIMBER else "Fable 5.2 medium 그림")
    (L.STORE / "parts.json").write_text(json.dumps(table, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("Fable", sum(1 for v in table.values() if v.startswith("Fable")), "· 코드", sum(1 for v in table.values() if v.startswith("코드")))
if __name__ == "__main__": main()
