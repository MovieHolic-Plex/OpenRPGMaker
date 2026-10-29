#!/usr/bin/env python3
"""『전생한 마왕, 편의점 알바 시작하다』 엔딩 그림 셋 — 데모의 편의점 맵(현대 도시 타일)을 그대로 그리고 걷기 칩 배우를 얹는다.

새 도트를 그리지 않는다: 맵 타일·현대 걷기 칩(Modern1~3)·EasyRPG 칩(Actor1·Monster2)만 합성하고 빛(곱하기)을 입힌다.
힘 엔딩은 같은 타일로 진열대 셋을 바닥으로 덮고 택배 상자 조각을 흩뜨린 뒤 그을음 빛을 곱한다.

    python3 scripts/content/maou-konbini/render_endings.py <demo.project.json> public/assets/generated/title
→ maou-konbini-end-best.png · -end-ok.png · -end-power.png · -battle-night.png(사람 없는 밤 전투 배경) (960×540, 3배)
"""
import os
import sys

from PIL import Image, ImageChops

sys.path.insert(0, os.path.dirname(__file__))
from render_title import chip, render_map  # noqa: E402

import json  # noqa: E402

MODERN1 = "assets/generated/charsets/Modern1.png"
MODERN2 = "assets/generated/charsets/Modern2.png"
MODERN3 = "assets/generated/charsets/Modern3.png"
ACTOR1 = "assets/easyrpg/charset/Actor1.png"
MONSTER2 = "assets/easyrpg/charset/Monster2.png"

# 화면 = 20×11.25칸(320×180) → 3배 960×540. 계산대(12,12)가 가운데 아래쪽에 오게.
VIEW = (2, 4)


def grade(img, top, bottom, mix):
    grad = Image.new("RGBA", img.size)
    px = grad.load()
    for y in range(img.height):
        t = y / max(1, img.height - 1)
        c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for x in range(img.width):
            px[x, y] = c
    return Image.blend(img, ImageChops.multiply(img, grad), mix)


def glow(img, cx, cy, radius, color, strength):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px = layer.load()
    for y in range(max(0, cy - radius), min(img.height, cy + radius)):
        for x in range(max(0, cx - radius), min(img.width, cx + radius)):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / radius
            if d < 1:
                px[x, y] = color + (int(255 * strength * (1 - d) ** 2),)
    return Image.alpha_composite(img, layer)


def scene(proj, cast, edit=None):
    m = proj["maps"]["map_mk_konbini"]
    if edit:
        m = json.loads(json.dumps(m))
        edit(m)
        proj = {**proj, "maps": {**proj["maps"], "map_mk_konbini": m}}
    full, T = render_map(proj, "map_mk_konbini")
    x0, y0 = VIEW[0] * T, VIEW[1] * T
    view = full.crop((x0, y0, x0 + 320, y0 + 180))
    for path, idx, d, (cx, cy), *rest in cast:
        c = chip(path, idx, d, rest[0] if rest else 1)
        fx, fy = cx * T + 8 - x0, (cy + 1) * T - y0
        view.alpha_composite(c, (fx - c.width // 2, fy - c.height))
    return view


def wreck(m):
    """힘 엔딩 — 진열대 셋을 바닥으로 덮고, 택배 상자 조각을 바닥에 흩뜨린다(모두 같은 칩셋의 타일)."""
    W = m["width"]
    floor = lambda x, y: 10228 if (y % 2 == 0) else (10232 if x % 2 else 10236)
    for (x1, y1, x2, y2) in [(2, 4, 3, 5), (4, 5, 6, 6), (9, 8, 11, 9)]:
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                i = y * W + x
                m["lowerTiles"][i] = floor(x, y)
                for layer in ("lowerOverlayTiles", "upperTiles", "upperOverlayTiles"):
                    if m.get(layer):
                        m[layer][i] = -1
    for (x, y, t) in [(5, 9, 10687), (7, 12, 10686), (9, 13, 10687), (14, 8, 10687), (3, 11, 10686), (16, 13, 10687)]:
        m["upperTiles"][y * W + x] = t


def main():
    proj = json.load(open(sys.argv[1]))
    proj = proj.get("project", proj)
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)

    best = scene(proj, [
        (MODERN2, 3, "down", (12, 11)),   # 마오 — 계산대 안
        (MODERN2, 5, "left", (14, 10)),   # 히나
        (MODERN1, 1, "down", (10, 11)),   # 새 알바 레온
        (MODERN3, 1, "up", (12, 13)),     # 다나카 씨
        (MODERN3, 7, "down", (16, 10)),   # 점장
    ])
    best = grade(best, (255, 236, 200), (255, 214, 170), 0.45)
    best = glow(best, 160, 120, 120, (255, 236, 180), 0.25)

    ok = scene(proj, [
        (MODERN2, 3, "down", (12, 11)),
        (MODERN1, 1, "left", (13, 11)),
        (MODERN2, 5, "left", (15, 10)),
    ])
    ok = grade(ok, (210, 226, 255), (255, 232, 200), 0.4)

    power = scene(proj, [
        (MONSTER2, 7, "down", (12, 10)),  # 마왕 제르바스(본모습)
        (ACTOR1, 0, "up", (11, 14)),      # 용사 레온
        (MODERN2, 5, "down", (15, 9)),    # 히나
        (MODERN3, 4, "up", (9, 14)),      # 리리
    ], edit=wreck)
    power = grade(power, (120, 60, 140), (60, 30, 70), 0.85)
    power = glow(power, 172, 92, 90, (255, 90, 60), 0.35)

    # 밤 편의점 전투 배경(사람 없음) — 전투가 필드 사진을 못 찍었을 때의 적 그룹 배경. 낮 풀밭이 나오던 자리(처음 하는 사람 검수 4).
    battle = scene(proj, [])
    battle = grade(battle, (150, 160, 230), (110, 120, 200), 0.6)
    battle = glow(battle, 190, 130, 110, (255, 246, 210), 0.18)

    for name, img in (("end-best", best), ("end-ok", ok), ("end-power", power), ("battle-night", battle)):
        big = img.resize((img.width * 3, img.height * 3), Image.NEAREST).convert("RGB")
        path = os.path.join(out, f"maou-konbini-{name}.png")
        big.save(path, optimize=True)
        print("wrote", path, big.size)


if __name__ == "__main__":
    main()
