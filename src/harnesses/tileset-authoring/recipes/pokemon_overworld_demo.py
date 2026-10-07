"""후보 시트로 작은 길(루트) 한 장을 깔아 본다 — 오토타일 이음새·조립 가능 여부를 눈으로 보는 용도.
맵 데이터가 아니라 그림이다. 이웃 판정은 편집기 오토타일과 같은 4방향 비트(N=1 E=2 S=4 W=8), 맵 밖은 이어진 것으로 본다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402

MW, MH = 30, 20


def build_layers(sh):
    ids = sh.ids
    low = [["grass0"] * MW for _ in range(MH)]
    up: list[list[str | None]] = [[None] * MW for _ in range(MH)]
    kind = [[""] * MW for _ in range(MH)]  # 오토타일 판정용 재료

    r = px.rng("demo")
    for y in range(MH):
        for x in range(MW):
            roll = r.random()
            low[y][x] = ("grass1" if roll < 0.18 else "grass2" if roll < 0.24 else "flower_w" if roll < 0.28 else
                         "flower_r" if roll < 0.31 else "flower_y" if roll < 0.34 else "grass0")

    def setk(x, y, k):
        if 0 <= x < MW and 0 <= y < MH:
            kind[y][x] = k

    # 흙길: 집 앞에서 아래로, 동쪽 갈래
    for y in range(7, MH):
        for x in (8, 9):
            setk(x, y, "dirt")
    for x in range(8, MW):
        for y in (15, 16):
            setk(x, y, "dirt")
    # 연못 (오른쪽 위)
    for y in range(3, 9):
        for x in range(19, 27):
            if ((x - 22.5) / 4.6) ** 2 + ((y - 5.5) / 3.4) ** 2 <= 1.0:
                setk(x, y, "water")
    # 모랫길 (연못 아래 작은 길)
    for x in range(20, 26):
        setk(x, 10, "sand")
    # 키큰 풀 (왼쪽 아래)
    for y in range(13, 19):
        for x in range(1, 7):
            low[y][x] = "tall0" if (x + y) % 3 else "tall1"
    # 턱 (가운데 가로줄)
    for x in range(13, 25):
        low[12][x] = "ledge_s_l" if x == 13 else "ledge_s_r" if x == 24 else "ledge_s_mid"
    # 옆 턱 시험: 동쪽/서쪽으로 뛰어내리는 세로 턱 두 줄
    for y in range(14, 18):
        low[y][18] = "ledge_e"
        low[y][22] = "ledge_w"

    def auto(kname, prefix, member):
        for y in range(MH):
            for x in range(MW):
                if kind[y][x] != kname:
                    continue
                m = 0
                for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0), (NE, 1, -1), (SE, 1, 1), (SW, -1, 1), (NW, -1, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < MW and 0 <= ny < MH) or member(kind[ny][nx]):
                        m |= bit
                low[y][x] = f"{prefix}{px.canon(m)}"

    auto("dirt", "dirt_at", lambda k: k in ("dirt",))
    auto("sand", "sand_at", lambda k: k in ("sand", "dirt"))
    auto("water", "water_at", lambda k: k == "water")

    # 울타리 (집 마당)
    fence = [[False] * MW for _ in range(MH)]
    for x in range(3, 15):
        fence[9][x] = True
    for y in range(7, 10):
        fence[y][3] = True
        fence[y][14] = True
    for x in (8, 9):
        fence[9][x] = False
    for y in range(MH):
        for x in range(MW):
            if fence[y][x]:
                m = 0
                for bit, dx, dy in ((N, 0, -1), (E, 1, 0), (S, 0, 1), (W, -1, 0)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < MW and 0 <= ny < MH and fence[ny][nx]:
                        m |= bit
                up[y][x] = f"fence_at{m}"

    # 집: 지붕 3줄 + 벽 2줄, x 5..11
    for color, x0, y0 in (("roof_red", 5, 2), ("roof_blue", 12, 3)):
        w = 6 if color == "roof_red" else 4
        for ry, row in enumerate(("ridge", "body", "eave")):
            for dx in range(w):
                part = "l" if dx == 0 else "r" if dx == w - 1 else "m"
                up[y0 + ry][x0 + dx] = f"{color}.{row}.{part}"
        for dx in range(w):
            part = "l" if dx == 0 else "r" if dx == w - 1 else "m"
            up[y0 + 3][x0 + dx] = "wall_u.window" if 0 < dx < w - 1 and dx % 2 == 1 else f"wall_u.{part}"
            up[y0 + 4][x0 + dx] = f"wall_b.{part}"
    up[5][8], up[6][8] = "door.top", "door.bot"
    up[5][8] = "door.top"

    # 나무 테두리 (위쪽·왼쪽·오른쪽)
    def tree(x, y, name):
        for part, (dx, dy) in {"tl": (0, 0), "tr": (1, 0), "bl": (0, 1), "br": (1, 1)}.items():
            if 0 <= x + dx < MW and 0 <= y + dy < MH:
                up[y + dy][x + dx] = f"{name}.{part}"

    for x in range(0, MW, 2):
        tree(x, 0, "tree_a" if (x // 2) % 3 else "tree_b")
    for y in range(2, MH, 2):
        tree(0, y, "pine_a" if (y // 2) % 2 else "tree_a")
        tree(MW - 2, y, "pine_a" if (y // 2) % 2 == 0 else "tree_b")
    up[11][11] = "bush"
    up[11][16] = "rock"
    up[8][4] = "sign"
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
    return img.resize((MW * T * scale, MH * T * scale), 0)  # NEAREST
