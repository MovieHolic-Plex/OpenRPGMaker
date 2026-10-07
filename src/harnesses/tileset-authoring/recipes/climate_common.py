"""기후 시트(monster-climate) 공용 도우미 — 바닥 바꿔 끼우기 · 덩이 질감 · 2톤 가장자리 오토타일 · 물 오토타일 · 돌 고리.

본 시트의 야외 함수(outdoor2·forest·monster_overworld)는 바탕 풀을 `mo._GRASS0` 에서 읽는다. 기후 바닥(눈·모래·재) 위에 같은 화풍의
턱·바위를 찍으려면 그 표를 잠깐 기후 바닥으로 바꿔 끼우고 부른 뒤 되돌린다(`ground_as`). 공유 파일은 고치지 않는다.
"""
from __future__ import annotations

import math
import sys
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402

SHADOW = (0, 0, 0, 64)


def tex_table(im) -> dict[tuple[int, int], tuple]:
    return {(x, y): im.getpixel((x, y)) for y in range(T) for x in range(T)}


@contextmanager
def ground_as(table: dict, grass_ramp=None, P=None):
    """mo._GRASS0(바탕 풀 표)를 table 로 잠시 바꾼다. grass_ramp 를 주면 P["grass"] 도 같이 바꾼다(턱 밑 그늘·풀 자락 색)."""
    import monster_overworld as mo
    keep = dict(mo._GRASS0)
    keep_g = P["grass"] if P is not None else None
    mo._GRASS0.clear(); mo._GRASS0.update(table)
    if P is not None and grass_ramp is not None:
        P["grass"] = grass_ramp
    try:
        yield
    finally:
        mo._GRASS0.clear(); mo._GRASS0.update(keep)
        if P is not None and keep_g is not None:
            P["grass"] = keep_g


def base_from(table) -> "px.Image.Image":
    im = px.new()
    for (x, y), c in table.items():
        im.putpixel((x, y), c)
    return im


def quiet(name: str, base, lights: list, darks: list | None = None):
    """조용한 바닥: 바탕 + 밝은 두 톤 덩이(px.clumps). darks 는 아주 드물게만(덩이 0~2)."""
    acc = list(lights) + list(darks or [])
    return px.clumps(name, base, acc)


def at(inside, m: int, x: int, y: int) -> bool:
    """칸 밖 좌표까지 안/밖 판정: 칸 밖은 이웃 비트(대각은 두 변이 이어졌을 때만)."""
    if 0 <= x < T and 0 <= y < T:
        return inside[y][x]
    sx = -1 if x < 0 else 1 if x >= T else 0
    sy = -1 if y < 0 else 1 if y >= T else 0
    cx, cy = min(T - 1, max(0, x)), min(T - 1, max(0, y))
    if sx == 0 or sy == 0:
        bit = {(0, -1): N, (1, 0): E, (0, 1): S, (-1, 0): W}[(sx, sy)]
        # 이웃 칸이 같은 재료여도 그 칸의 가장자리는 이 칸 변의 모양을 이어 간다(맞닿은 행·열을 연장) —
        # 「이웃 = 통째로 안」으로 보면 칸 경계마다 테 색이 혹처럼 튀어나온다(적대 검수 1차 6·7번).
        return bool(m & bit) and inside[cy][cx]
    diag, both = {(1, -1): (NE, N | E), (-1, -1): (NW, N | W), (1, 1): (SE, S | E), (-1, 1): (SW, S | W)}[(sx, sy)]
    return bool(m & diag) and (m & both) == both and inside[cy][cx]


def edge_dist(inside, m: int, x: int, y: int, want: bool, r: int = 3) -> int:
    """(x,y) 에서 상태가 want 인 가장 가까운 점까지의 체비쇼프 거리(1..r), 없으면 r+1."""
    for d in range(1, r + 1):
        for dy in range(-d, d + 1):
            for dx in range(-d, d + 1):
                if max(abs(dx), abs(dy)) != d:
                    continue
                if at(inside, m, x + dx, y + dy) == want:
                    return d
    return r + 1


def blob_tile(m: int, params: tuple, inner, outer, rim_in=None, rim_out=None):
    """오토타일 한 칸. params=(이름, 깊이, 반지름, 흔들림) → px.inside_mask.
    inner(x,y)/outer(x,y) 는 안·밖 바탕, rim_in(x,y,d)/rim_out(x,y,d) 는 경계에서 d 칸(1~3) 떨어진 점의 색(None 이면 바탕)."""
    inside = px.inside_mask(m, *params)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inside[y][x]:
                c = inner(x, y)
                if rim_in:
                    d = edge_dist(inside, m, x, y, False)
                    if d <= 3:
                        c = rim_in(x, y, d) or c
            else:
                c = outer(x, y)
                if rim_out:
                    d = edge_dist(inside, m, x, y, True)
                    if d <= 3:
                        c = rim_out(x, y, d) or c
            im.putpixel((x, y), c)
    return im


def masks(params: tuple) -> dict:
    return {m: px.inside_mask(m, *params) for m in px.ALL47}


# ---- 돌(보로노이 덩이) ---------------------------------------------------------------------
_STONE_SEEDS = px.torus_seeds("climate-stones", 6)


def stone_px(ramp, x: int, y: int, cap=None):
    """둥근 돌 덩이 점(본 시트 rock_px 문법): 경계 진하게, 왼쪽 위 밝게. cap 을 주면 돌 윗머리에 그 색(눈 모자)을 얹는다."""
    d1, d2, idx, (vx, vy) = px.voronoi(_STONE_SEEDS, x + 0.5, y + 0.5)
    if d2 - d1 < 1.1:
        return ramp[0]
    light = vx + vy
    if cap is not None and vy < -1.6 and d2 - d1 > 1.6:
        return cap
    if -5.0 < light < -2.6 and abs(vx - vy) < 2.2:
        return ramp[3]
    if light < -1.2:
        return ramp[2]
    if light > 2.2:
        return ramp[0]
    return ramp[1]


# ---- 물 -------------------------------------------------------------------------------------
_WSEEDS = px.torus_seeds("climate-water", 5)


def net_water(ramp, x: int, y: int, f: int):
    """그물 물결(본 시트 water_px 문법) — ramp=[바탕, 바탕2, 결, 밝은 선]. f 프레임마다 씨앗이 돈다."""
    seeds = [((sx + 1.4 * math.cos(math.pi / 2 * f + i * 1.3)) % T, (sy + 1.4 * math.sin(math.pi / 2 * f + i * 1.3)) % T) for i, (sx, sy) in enumerate(_WSEEDS)]
    d1, d2, _, _ = px.voronoi(seeds, x + 0.5, y + 0.5)
    b = d2 - d1
    if b < 0.95:
        return ramp[3]
    if b < 1.7 and (x * 7 + y * 3) % 5 < 2:
        return ramp[2]
    return ramp[1] if (x + y * 2) % 11 == 0 else ramp[0]


def lobes(shape):
    return lambda x, y: any((x - cx) ** 2 + (y - cy) ** 2 <= r * r for cx, cy, r in shape)


def shade_lobes(im, shape, ramp, ol=None, shadow=True, light_bias=0.0):
    """덩이 소품(투명 바탕): 외곽선(아래·오른쪽 최암, 위·왼쪽 한 단 어둠) + 왼쪽 위 하이라이트 + 밑 그림자. ramp 는 5톤."""
    inside = lobes(shape)
    if shadow:                                                         # 본 시트 가구 규칙: 오른쪽 2px·아래 3px 반투명 그림자
        for y in range(T):
            for x in range(T):
                if x > T - 2 or y > T - 2 or (x, y) == (T - 2, T - 2):     # 칸 끝 1px 은 비우고 귀는 둥글린다(칸 경계에서 곧게 잘린 네모 귀가 보였다, L8 K1)
                    continue
                if not inside(x, y) and inside(x - 2, y - 3) and im.getpixel((x, y))[3] == 0:
                    im.putpixel((x, y), SHADOW)
    for y in range(T):
        for x in range(T):
            if not inside(x, y):
                continue
            cx, cy, r = min(shape, key=lambda l: (x - l[0]) ** 2 + (y - l[1]) ** 2 - l[2] ** 2)
            edge = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            light = -((x - cx) + (y - cy)) / r + light_bias
            if edge[1] or edge[2]:
                c = ol or ramp[0]
            elif edge[0] or edge[3]:
                c = ramp[1]
            else:
                c = ramp[4] if light > 0.8 else ramp[3] if light > 0.2 else ramp[2] if light > -0.5 else ramp[1]
            im.putpixel((x, y), c)
    return im
