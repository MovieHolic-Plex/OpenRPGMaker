#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka ground tiles
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""jp-inaka 바닥(16×16) 단일 칸 그룹. (R5 에서 inaka_art_props.py 에서 떼어 냄)"""
from __future__ import annotations

import collections
from typing import Callable, Final

from inaka_art_houses import Cv, H, J, K  # noqa: E402


# ═══════════════════════════ 바닥(16×16, 이음매 없는 16 주기) ═══════════════════════════
def _chip(name):
    from lib_blocks.ground_autotile import chip
    return chip(name)


def _put(c, a):
    for y in range(16):
        for x in range(16):
            r, g, b = (int(v) for v in a[y, x, :3])
            c.P(x, y, (r << 16) | (g << 8) | b)


def Hw(x, y, s):
    """16 주기로 감기는 칸 해시(이음매가 생기지 않게)."""
    return H(x % 16, y % 16, s)


def _cluster(c, mat, levels, seed, cell=2):
    """2px 덩이 단위 3단 클러스터 바탕(노이즈 점 대신)."""
    for y in range(16):
        for x in range(16):
            h = Hw(x // cell + (y // cell) * 3, y // cell, seed)
            t = levels[0] if h < 0.55 else levels[1] if h < 0.85 else levels[2]
            c.P(x, y, J(mat, t))


def _meadow(c):
    """여름 풀밭: jp_city 잔디 칩 그대로(±1단 톤 변화만, 밝은 꽃 점 없음 - 넓게 깔아도 점 격자가 생기지 않는다)."""
    _put(c, _chip('lawn'))


def _gravel_road(c):
    """시골 흙자갈길: 다진 흙 2px 덩이 + 한 단 밝은 자갈(눈에 띄는 흰 점 없이)."""
    _cluster(c, 'aged_cedar', (3, 3, 4), 51)
    for (x, y) in ((2, 3), (9, 1), (13, 7), (5, 10), (11, 13), (7, 6)):
        c.P(x, y, J('aged_cedar', 4)); c.P((x + 1) % 16, (y + 1) % 16, J('aged_cedar', 2))


def _aze_path(c):
    """논두렁·마당 흙: 산길 흙(rg trail) 톤 클러스터 + 한 단 차이 풀 기운(점 무늬 없음)."""
    _cluster(c, 'aged_cedar', (3, 2, 2), 23)
    for (x, y) in ((3, 4), (12, 11)):
        c.P(x, y, J('moss', 2)); c.P(x + 1, y, J('moss', 2))


def _soft_base(c, mat, lv, seed):
    """jp_city 잔디 칩처럼 1px 단위로 고르게 흩은 한 단 차이 결(덩이·사선 줄·점 격자 없음)."""
    for y in range(16):
        for x in range(16):
            h = Hw(x, y, seed)
            c.P(x, y, J(mat, lv + 1 if h > 0.86 else lv - 1 if h < 0.05 else lv))


def _rice_rows(c, mat, lv, seed, tip=None):
    """벼 포기 줄: 4px 간격 4줄 × 4포기(줄마다 2px 엇갈림 + 1px 흔들림). 잎은 바탕보다 한 단 밝게, 밑동은 두 단 어둡게.
    한 칸에 16포기가 고르게 깔려 점 격자가 아닌 결(texture)로 읽힌다."""
    for j, y in enumerate((1, 5, 9, 13)):
        for i in range(4):
            x = (i * 4 + (j % 2) * 2 + (1 if Hw(i, j, seed) > 0.6 else 0)) % 16
            c.P(x, y, J(mat, lv + 1) if tip is None or Hw(i, j, seed + 1) < 0.5 else tip)
            c.P((x - 1) % 16, (y + 1) % 16, J(mat, lv + 1)); c.P(x, (y + 1) % 16, J(mat, lv)); c.P((x + 1) % 16, (y + 1) % 16, J(mat, lv + 1))
            c.P(x, (y + 2) % 16, J(mat, lv - 2))                   # 밑동 그늘 두 단(1배에서도 포기 줄이 남게)
    for y in (3, 7, 11, 15):                                       # 포기 줄 사이 고랑: 한 단 어두운 가로 결(1배에서 줄무늬로 읽힌다)
        for x in range(16):
            if Hw(x, y, seed + 3) < 0.7:
                c.P(x, y, J(mat, lv - 1))


def _paddy_water(c):
    """모내기 물논: 하늘 비친 잔잔한 물 + 줄지어 심은 어린 모. 모 끝은 이끼 4단·잎은 대 4단(물 2단보다 두 단 밝게) + 물에 진 1px 그늘이라
    1배에서도 모 줄이 점선으로 읽힌다."""
    _soft_base(c, 'onsen_mineral_teal', 2, 3)
    for j, y in enumerate((1, 5, 9, 13)):
        for i in range(4):
            x = (i * 4 + (j % 2) * 2 + (1 if Hw(i, j, 5) > 0.6 else 0)) % 16
            c.P(x, y, J('moss', 4)); c.P((x - 1) % 16, (y + 1) % 16, J('pine_bamboo', 4)); c.P((x + 1) % 16, (y + 1) % 16, J('pine_bamboo', 3))
            c.P(x, (y + 1) % 16, J('pine_bamboo', 3)); c.P((x + 1) % 16, (y + 2) % 16, J('onsen_mineral_teal', 0))
    for y in (3, 7, 11, 15):                                       # 모 줄 사이 물에 비친 하늘: 한 단 밝은 가로 결(1배에서 줄무늬로 읽힌다)
        for x in range(16):
            if Hw(x, y, 9) < 0.55:
                c.P(x, y, J('onsen_mineral_teal', 3))


def _paddy_summer(c):
    """여름 푸른 논: 빽빽한 벼(moss) 결 - 바탕 2단, 잎 3단, 드문 4단 잎끝, 밑동 0단."""
    _soft_base(c, 'moss', 2, 7)
    _rice_rows(c, 'moss', 2, 7, tip=J('moss', 4))


def _paddy_golden(c):
    """가을 황금 논: 고개 숙인 이삭 결 - 볏짚 2단 바탕, 3단 이삭, 드문 4단 빛, 밑동 0단."""
    _soft_base(c, 'tatami_straw', 2, 9)
    _rice_rows(c, 'tatami_straw', 2, 9, tip=J('tatami_straw', 4))


def _paddy_bank(fn, edge_mat, edge_lv):
    """논 북쪽 가장자리 칸: 논두렁(산길 흙) 앞면이 논으로 떨어지는 3/4 둑 + 둑 그늘 + 물가 빛 한 줄. 논 면 맨 윗줄에 한 줄 깔아
    흙과 논이 칼로 자른 사각 경계로 맞닿지 않게 한다(아래 줄은 같은 논 칸과 이음매 없이 이어진다)."""
    def draw(c):
        fn(c)
        for x in range(16):
            c.P(x, 0, J('aged_cedar', 3 if Hw(x, 0, 41) > 0.3 else 2))          # 둑 윗면 끝(빛)
            c.P(x, 1, J('aged_cedar', 1 if Hw(x, 1, 42) > 0.25 else 2))         # 둑 앞면
            c.P(x, 2, J('aged_cedar', 0) if Hw(x, 2, 43) < 0.55 else J(edge_mat, max(0, edge_lv - 2)))   # 둑 발치가 물·흙에 진 그늘(들쭉날쭉)
            c.P(x, 3, J(edge_mat, max(0, edge_lv - 1)) if Hw(x, 3, 44) < 0.6 else J(edge_mat, min(4, edge_lv + 1)) if x % 5 == 2 else J(edge_mat, edge_lv))
        for x in (3, 10):                                             # 둑에 난 풀포기
            c.P(x, 0, J('pine_bamboo', 3)); c.P(x + 1, 0, J('pine_bamboo', 4)); c.P(x, 1, J('pine_bamboo', 2))
    return draw


def _canal_water(c):
    """농수로 물: jp_city 수로 물 칩(water_tex) 그대로."""
    from autotiles_ground import water_tex
    _put(c, water_tex())


def _canal_wall(c):
    """농수로 석축 윗면 연석(5px) + 젖은 돌 정면 + 물선."""
    for x in range(16):
        c.P(x, 0, J('paving_stone', 4))
        for y in (1, 2, 3): c.P(x, y, J('paving_stone', 3 if x % 8 != 7 else 2))
        c.P(x, 4, J('paving_stone', 1))
    for y in range(5, 13):
        for x in range(16):
            row = (y - 5) // 4; sx = (x + row * 4) % 8; sy = (y - 5) % 4
            t = 0 if (sx == 7 or sy == 3) else 3 if (sx == 0 or sy == 0) else 2
            if y >= 10 and t == 2 and Hw(x, y, 3) < 0.4: c.P(x, y, J('moss', 2)); continue
            c.P(x, y, J('wet_cobble', t))
    c.HL(0, 13, 16, J('canal_indigo', 1)); c.HL(0, 14, 16, J('canal_indigo', 2)); c.HL(0, 15, 16, J('canal_indigo', 2))
    c.P(4, 14, J('vending_cool_white', 4)); c.P(11, 15, J('onsen_mineral_teal', 3))


def _river_shallow(c):
    """얕은 개울: jp_city 연못·수로 물 칩(water_tex) 그대로 - 연못(연못) 오토타일 물과 이음매 없이 이어진다."""
    from autotiles_ground import water_tex
    _put(c, water_tex())


def _furrow(c):
    """채소밭 이랑: 짙은 흙 + 3/4 양배추·무 포기(왼쪽 위 밝음, 오른쪽 아래 흙에 진 그늘)."""
    for y in range(16):
        for x in range(16):
            ridge = (y % 8) in (5, 6)
            h = Hw(x // 2, y // 2, 13)
            c.P(x, y, K('soil', 0 if ridge else (1 if h < 0.75 else 2)))
    for (x, y, col) in ((3, 1, 'midori'), (11, 1, 'midori'), (7, 9, 'midori'), (15, 9, 'midori')):
        c.P((x + 1) % 16, y + 3, K('soil', -2)); c.P((x + 2) % 16, y + 3, K('soil', -2))   # 그늘
        for dy, dx, t in ((0, 0, 2), (0, 1, 1), (1, -1, 1), (1, 0, 2), (1, 1, 0), (2, 0, 0), (2, 1, -1), (1, 2, -1), (2, -1, 0)):
            c.P((x + dx) % 16, y + dy, K(col, t))


GROUND: Final[collections.OrderedDict[str, tuple[Callable[[Cv], None], str]]] = collections.OrderedDict((
    ('gnd/inaka-paddy-water', (_paddy_water, 'solidfloor')),
    ('gnd/inaka-paddy-summer', (_paddy_summer, 'solidfloor')),
    ('gnd/inaka-paddy-golden', (_paddy_golden, 'solidfloor')),
    ('gnd/inaka-aze-path', (_aze_path, 'floor')),
    ('gnd/inaka-canal-water', (_canal_water, 'solidfloor')),
    ('gnd/inaka-canal-wall', (_canal_wall, 'solidfloor')),
    ('gnd/inaka-gravel-road', (_gravel_road, 'floor')),
    ('gnd/inaka-river-shallow', (_river_shallow, 'solidfloor')),
    ('gnd/inaka-meadow-wildflower', (_meadow, 'floor')),
    ('gnd/inaka-vegetable-furrow', (_furrow, 'solidfloor')),
    ('gnd/inaka-paddy-water-bank', (_paddy_bank(_paddy_water, 'onsen_mineral_teal', 2), 'solidfloor')),
    ('gnd/inaka-paddy-summer-bank', (_paddy_bank(_paddy_summer, 'moss', 2), 'solidfloor')),
    ('gnd/inaka-paddy-golden-bank', (_paddy_bank(_paddy_golden, 'tatami_straw', 2), 'solidfloor')),
))

GROUND_GROUPS: Final[tuple[tuple[str, str, list[str], str], ...]] = (
    ('jp:inaka-paddy-water', 'inaka-paddy-water', ['gnd/inaka-paddy-water'], '논(모내기 물논) - 하늘이 비친 물에 엇갈려 심은 어린 모 포기. 걸을 수 없으며 사방에 논두렁(inaka-aze-path)을 두른다.'),
    ('jp:inaka-paddy-summer', 'inaka-paddy-summer', ['gnd/inaka-paddy-summer'], '논(푸른 여름 벼) - 짙은 물 위에 빽빽한 벼 포기. 걸을 수 없다.'),
    ('jp:inaka-paddy-golden', 'inaka-paddy-golden', ['gnd/inaka-paddy-golden'], '논(황금 가을 벼) - 마른 논흙 위 고개 숙인 이삭 포기. 볏단 걸이(inaka-rice-rack-hasagi)와 짝지어 쓴다.'),
    ('jp:inaka-aze-path', 'inaka-aze-path', ['gnd/inaka-aze-path'], '논두렁·시골 흙마당 - 다진 흙에 듬성 풀포기. 걸을 수 있는 바닥.'),
    ('jp:inaka-canal-water', 'inaka-canal-water', ['gnd/inaka-canal-water'], '농수로 물(用水路) - jp_city 수로 물결 그대로.'),
    ('jp:inaka-canal-wall', 'inaka-canal-wall', ['gnd/inaka-canal-wall'], '농수로 석축 - 3/4 윗면 연석과 젖은 돌 정면·물선. 수로 북쪽 가장자리에 한 줄.'),
    ('jp:inaka-gravel-road', 'inaka-gravel-road', ['gnd/inaka-gravel-road'], '시골 흙자갈길 - 다진 흙 덩이와 빛 받은 자갈. 걸을 수 있는 주 도로.'),
    ('jp:inaka-river-shallow', 'inaka-river-shallow', ['gnd/inaka-river-shallow'], '시골 맑은 개울 - 강자갈이 비치는 얕은 물. 징검다리·붉은 철교 아래에 깐다.'),
    ('jp:inaka-meadow-wildflower', 'inaka-meadow-wildflower', ['gnd/inaka-meadow-wildflower'], '여름 풀밭 - jp_city 잔디 칩에 토끼풀 꽃. 기본 대지 바닥.'),
    ('jp:inaka-vegetable-furrow', 'inaka-vegetable-furrow', ['gnd/inaka-vegetable-furrow'], '채소밭 이랑 - 짙은 흙 이랑과 양배추 포기. 걸을 수 없다.'),
    ('jp:inaka-paddy-water-bank', 'inaka-paddy-water-bank', ['gnd/inaka-paddy-water-bank'], '물논 북쪽 둑 가장자리 - 논두렁 앞면이 물로 떨어지는 3/4 둑과 그늘. 물논 맨 윗줄에 한 줄 깐다.'),
    ('jp:inaka-paddy-summer-bank', 'inaka-paddy-summer-bank', ['gnd/inaka-paddy-summer-bank'], '여름 논 북쪽 둑 가장자리 - 논두렁 앞면과 둑 그늘. 여름 논 맨 윗줄에 한 줄 깐다.'),
    ('jp:inaka-paddy-golden-bank', 'inaka-paddy-golden-bank', ['gnd/inaka-paddy-golden-bank'], '황금 논 북쪽 둑 가장자리 - 논두렁 앞면과 둑 그늘. 황금 논 맨 윗줄에 한 줄 깐다.'),
)
