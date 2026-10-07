"""몬스터 수집 야외 후보로 깐 작은 루트 한 장(맵 데이터가 아니라 그림)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402

MW, MH = 30, 20
TOWN_W, TOWN_H = 40, 26


def build_layers(sh):
    low = [["grass0"] * MW for _ in range(MH)]
    up: list[list[str | None]] = [[None] * MW for _ in range(MH)]
    kind = [[""] * MW for _ in range(MH)]
    r = px.rng("demo-m")
    for y in range(MH):
        for x in range(MW):
            low[y][x] = r.choice(["grass0", "grass0", "grass1", "grass2", "grass3"])

    def setk(x, y, k):
        if 0 <= x < MW and 0 <= y < MH:
            kind[y][x] = k

    for y in range(MH):
        for x in (12, 13):
            setk(x, y, "sand")
    for x in range(12, MW):
        for y in (14, 15):
            setk(x, y, "sand")
    for y in range(3, 9):
        for x in range(2, 10):
            setk(x, y, "rock")
    for y in range(2, 9):
        for x in range(18, 28):
            if ((x - 22.5) / 5.0) ** 2 + ((y - 5.0) / 3.6) ** 2 <= 1.0:
                setk(x, y, "water")
    for y in range(13, 19):
        for x in range(1, 8):
            low[y][x] = "tall0" if (x + y) % 3 else "tall1"
    for x in range(16, 27):
        low[11][x] = "ledge_s_l" if x == 16 else "ledge_s_r" if x == 26 else "ledge_s_mid"

    def auto(kname, prefix):
        for y in range(MH):
            for x in range(MW):
                if kind[y][x] != kname:
                    continue
                m = 0
                for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0), (NE, 1, -1), (SE, 1, 1), (SW, -1, 1), (NW, -1, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < MW and 0 <= ny < MH) or kind[ny][nx] == kname:
                        m |= bit
                low[y][x] = f"{prefix}{px.canon(m)}"

    auto("sand", "sand_at")
    auto("rock", "rock_at")
    auto("water", "water_at")

    fence = [[False] * MW for _ in range(MH)]
    for x in range(15, 24):
        fence[17][x] = True
    for y in range(17, 20):
        fence[y][15] = True
    for y in range(MH):
        for x in range(MW):
            if fence[y][x]:
                m = 0
                for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < MW and 0 <= ny < MH and fence[ny][nx]:
                        m |= bit
                up[y][x] = f"fence_at{m}"

    def tree(x, y, name):
        for dy in range(3):
            for dx in range(2):
                if 0 <= x + dx < MW and 0 <= y + dy < MH:
                    up[y + dy][x + dx] = f"{name}.{dx}.{dy}"

    for x in range(0, MW, 2):
        pass
    for x in range(14, MW - 1, 3):
        tree(x, 0, ["tree_a", "pine_a", "tree_b"][(x // 3) % 3])
    for y in range(9, MH - 2, 3):
        tree(MW - 2, y, ["pine_a", "tree_b", "tree_a"][(y // 3) % 3])
    tree(0, 9, "tree_a")
    up[12][14] = "sign"
    return low, up


def render(sh, scale: int = 3):
    low, up = build_layers(sh)
    sheet = sh.image()

    def cell(name):
        i = sh.ids[name]
        sx, sy = (i % sh.cols) * T, (i // sh.cols) * T
        return sheet.crop((sx, sy, sx + T, sy + T))

    img = px.new(MW * T, MH * T)
    for y in range(MH):
        for x in range(MW):
            img.alpha_composite(cell(low[y][x]), (x * T, y * T))
    for y in range(MH):
        for x in range(MW):
            if up[y][x]:
                img.alpha_composite(cell(up[y][x]), (x * T, y * T))
    return img.resize((MW * T * scale, MH * T * scale), 0)


def build_town(sh):
    """마을 한 장: 집 다섯 채, 큰길, 연못, 울타리, 키큰 풀 루트 입구, 점프 턱, 나무 테두리."""
    W_, H_ = TOWN_W, TOWN_H
    low = [["grass0"] * W_ for _ in range(H_)]
    up: list[list[str | None]] = [[None] * W_ for _ in range(H_)]
    kind = [[""] * W_ for _ in range(H_)]
    r = px.rng("town")
    for y in range(H_):
        for x in range(W_):
            low[y][x] = r.choice(["grass0", "grass0", "grass1", "grass2", "grass3"])

    def setk(x, y, k):
        if 0 <= x < W_ and 0 <= y < H_:
            kind[y][x] = k

    for x in range(0, W_):                       # 큰길(가로)
        for y in (15, 16):
            setk(x, y, "sand")
    for y in range(12, H_):                      # 남쪽 샛길(루트로)
        for x in (19, 20):
            setk(x, y, "sand")
    for x in (13, 21, 30, 31, 5, 6):              # 건물 앞 짧은 길(센터·마트 문은 1칸, 둘째 칸)
        for y in range(12, 15):
            setk(x, y, "sand")
    for y in range(1, 3):                        # (연못 자리는 체육관에 양보)
        for x in range(30, 31):
            if False:
                setk(x, y, "water")
    for y in range(19, 25):                       # 고원(바위 고리)
        for x in range(24, 36):
            setk(x, y, "rock")
    for y in range(20, 25):                       # 키큰 풀 (루트 입구)
        for x in range(10, 17):
            low[y][x] = "tall0" if (x + y) % 3 else "tall1"
    for x in range(22, 29):                       # 점프 턱
        low[18][x] = "ledge_s_l" if x == 22 else "ledge_s_r" if x == 28 else "ledge_s_mid"

    def auto(kname, prefix):
        for y in range(H_):
            for x in range(W_):
                if kind[y][x] != kname:
                    continue
                m = 0
                for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0), (NE, 1, -1), (SE, 1, 1), (SW, -1, 1), (NW, -1, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < W_ and 0 <= ny < H_) or kind[ny][nx] == kname:
                        m |= bit
                low[y][x] = f"{prefix}{px.canon(m)}"

    auto("sand", "sand_at"); auto("rock", "rock_at"); auto("water", "water_at")

    def put(name, x0, y0, w, h):
        for ry in range(h):
            for cx in range(w):
                up[y0 + ry][x0 + cx] = f"{name}.{cx}.{ry}"

    put("center", 12, 8, 4, 4)       # 포켓몬센터 (큰길 북쪽) — 4×4(통합 I4 W1)
    put("mart", 20, 8, 4, 4)         # 마트
    put("gym_leaf", 27, 3, 7, 7)     # 체육관
    put("gable_a", 2, 3, 7, 7)       # 박공 집
    put("house_d", 3, 18, 4, 4)
    fence = [[False] * W_ for _ in range(H_)]
    for x in range(3, 8):
        fence[23][x] = True
    for y in range(H_):
        for x in range(W_):
            if fence[y][x]:
                m = 0
                for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W_ and 0 <= ny < H_ and fence[ny][nx]:
                        m |= bit
                up[y][x] = f"fence_at{m}"
    up[15 + 8][9] = "sign"

    def tree(x, y, name):
        for dy in range(3):
            for dx in range(2):
                if 0 <= x + dx < W_ and 0 <= y + dy < H_ and up[y + dy][x + dx] is None:
                    up[y + dy][x + dx] = f"{name}.{dx}.{dy}"

    kinds = ["tree_a", "tree_b", "pine_a"]
    for i, x in enumerate(range(0, W_, 2)):
        tree(x, 0, kinds[i % 3])
    for i, y in enumerate(range(3, H_ - 2, 3)):
        tree(0, y, kinds[(i + 1) % 3]); tree(W_ - 2, y, kinds[i % 3])
    tree(36, 12, "tree_a"); tree(34, 20, "pine_a")
    return low, up


def render_town(sh, scale: int = 2):
    low, up = build_town(sh)
    sheet = sh.image()

    def cell(name):
        i = sh.ids[name]
        sx, sy = (i % sh.cols) * T, (i // sh.cols) * T
        return sheet.crop((sx, sy, sx + T, sy + T))

    img = px.new(TOWN_W * T, TOWN_H * T)
    for y in range(TOWN_H):
        for x in range(TOWN_W):
            img.alpha_composite(cell(low[y][x]), (x * T, y * T))
    for y in range(TOWN_H):
        for x in range(TOWN_W):
            if up[y][x]:
                img.alpha_composite(cell(up[y][x]), (x * T, y * T))
    return img.resize((TOWN_W * T * scale, TOWN_H * T * scale), 0)
