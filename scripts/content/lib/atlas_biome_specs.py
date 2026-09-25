# Biome specs for tiledata/atlas-biomes: the repaint ramps (lib/atlas_recolor.py), tall-grass ramp, leafless-tree
# palette and which extra blocks each sheet carries (ice copies, leafless trees, the biome's own art from 3030).
# Colours are (r, g, b); ramps are [(t, colour)] from dark to light.

def C(s): return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

BIOMES = {
    "jungle": dict(
        name="정글 · 열대우림", tag="정글",
        ground=dict(bright=[(0, C("3f8a2e")), (1, C("73b83e"))], shadow=[(0, C("1c4a22")), (1, C("3a7a30"))]),
        foliage=[(0, C("0b2a18")), (0.35, C("16502a")), (0.7, C("2f8a36")), (1, C("8fd24a"))],
        water=[(0, C("1c4a44")), (0.6, C("2f7a66")), (1, C("6fb89a"))],
        earth=[(0, C("2a1a10")), (0.6, C("5e3a22")), (1, C("8a5a34"))],
        grass=[(0, (20, 60, 26)), (.25, (30, 88, 34)), (.5, (48, 124, 40)), (.7, (78, 160, 50)), (.85, (126, 196, 70)), (1, (190, 230, 110))],
    ),
    "swamp": dict(
        name="늪 · 맹그로브 습지", tag="늪",
        ground=dict(bright=[(0, C("6f7a3e")), (1, C("98a058"))], shadow=[(0, C("3a4226")), (1, C("5e6838"))]),
        foliage=[(0, C("1c2412")), (0.4, C("3a4a22")), (0.75, C("5e7034")), (1, C("a2aa62"))],
        water=[(0, C("2a3424")), (0.6, C("465a3a")), (1, C("7e9468"))],
        earth=[(0, C("241c12")), (0.6, C("4a3a26")), (1, C("6e5a3e"))],
        grass=[(0, (40, 46, 24)), (.25, (62, 70, 34)), (.5, (90, 100, 48)), (.7, (118, 128, 62)), (.85, (152, 158, 90)), (1, (196, 198, 140))],
    ),
    "mushroom": dict(
        name="버섯 숲 · 푸른 이끼 골짜기", tag="버섯 숲",
        ground=dict(bright=[(0, C("4f5f8e")), (1, C("7f93be"))], shadow=[(0, C("2a3060")), (1, C("46508a"))]),
        foliage=[(0, C("1a1238")), (0.35, C("3a2468")), (0.7, C("6a44a0")), (1, C("c89ae0"))],
        water=[(0, C("144a66")), (0.6, C("2a8aa0")), (1, C("8ae8e0"))],
        earth=[(0, C("1e1a2e")), (0.6, C("3e3656")), (1, C("62587e"))],
        grass=[(0, (30, 30, 70)), (.25, (44, 50, 100)), (.5, (66, 78, 136)), (.7, (98, 116, 170)), (.85, (140, 160, 206)), (1, (196, 214, 240))],
    ),
    "crystal": dict(
        name="수정 평원 · 빛나는 돌밭", tag="수정 평원",
        ground=dict(bright=[(0, C("8e8aa6")), (1, C("c4c0da"))], shadow=[(0, C("55526e")), (1, C("7c7898"))]),
        foliage=[(0, C("1e2440")), (0.4, C("3e5078")), (0.75, C("7890c0")), (1, C("d0e0f8"))],
        water=[(0, C("1a5a86")), (0.6, C("38a8d0")), (1, C("b0f4ff"))],
        earth=[(0, C("2a2838")), (0.6, C("565274")), (1, C("8a86a8"))],
        grass=[(0, (50, 50, 80)), (.25, (76, 78, 110)), (.5, (110, 112, 146)), (.7, (146, 148, 180)), (.85, (186, 188, 214)), (1, (230, 232, 246))],
    ),
    "badlands": dict(
        name="황무지 · 붉은 협곡", tag="황무지",
        ground=dict(bright=[(0, C("b0603a")), (1, C("dc9464"))], shadow=[(0, C("6e3420")), (1, C("a45a36"))]),
        foliage=[(0, C("2a2414")), (0.4, C("4e4a2c")), (0.75, C("7e7a4a")), (1, C("b4ae7a"))],
        water=[(0, C("4a2a1a")), (0.6, C("7a4a2e")), (1, C("b88a64"))],
        earth=[(0, C("3a140a")), (0.5, C("8a3a1e")), (1, C("d27a48"))], strata=True,
        roof=[(0, C("46221a")), (1, C("c86a44"))],
        grass=[(0, (70, 40, 22)), (.25, (104, 62, 32)), (.5, (140, 88, 46)), (.7, (176, 120, 66)), (.85, (206, 156, 96)), (1, (232, 200, 146))],
        bare=dict(o='2a140c', d='4a2616', m='6e3e24', l='96603a', h='bc8a5c'),
    ),
    "savanna": dict(
        name="사바나 · 금빛 초원", tag="사바나",
        ground=dict(bright=[(0, C("b89a4a")), (1, C("e0c67a"))], shadow=[(0, C("7a6230")), (1, C("a88a46"))]),
        foliage=[(0, C("1e2a10")), (0.4, C("3e5222")), (0.75, C("6e8a34")), (1, C("b8c46a"))],
        water=[(0, C("2a4a4a")), (0.6, C("3e7a74")), (1, C("8abcaa"))],
        earth=[(0, C("3a2410")), (0.6, C("7a5028")), (1, C("b27c44"))],
        roof=[(0, C("4a3018")), (1, C("c89a58"))],
        grass=[(0, (84, 66, 26)), (.25, (120, 96, 38)), (.5, (160, 132, 54)), (.7, (196, 168, 76)), (.85, (222, 198, 110)), (1, (244, 226, 160))],
    ),
    "taiga": dict(
        name="타이가 · 눈 덮인 침엽수림", tag="타이가",
        ground=dict(bright=[(0, C("4e6a5a")), (1, C("7a9884"))], shadow=[(0, C("26382e")), (1, C("44584a"))]),
        foliage=[(0, C("0a1c1c")), (0.4, C("163a36")), (0.75, C("2e6256")), (1, C("88b4a2"))],
        water=[(0, C("1a2e4a")), (0.6, C("2e4e72")), (1, C("7e9ec0"))],
        earth=[(0, C("1e1a18")), (0.6, C("463a32")), (1, C("6e6052"))],
        roof=[(0, C("5a6a7a")), (1, C("e6eef6"))],
        grass=[(0, (22, 46, 40)), (.25, (36, 66, 56)), (.5, (58, 94, 78)), (.7, (90, 126, 104)), (.85, (150, 180, 164)), (1, (226, 238, 236))],
        snowCaps=True, ice=True,
    ),
    "tundra": dict(
        name="툰드라 · 이끼 언 들", tag="툰드라",
        ground=dict(bright=[(0, C("8e8a6a")), (1, C("bcb898"))], shadow=[(0, C("56563e")), (1, C("7e7c5c"))]),
        foliage=[(0, C("121c18")), (0.4, C("26362c")), (0.75, C("465a46")), (1, C("8a9a7e"))],
        water=[(0, C("2a3a4e")), (0.6, C("4a647e")), (1, C("a0b8cc"))],
        earth=[(0, C("24221e")), (0.6, C("4e4a42")), (1, C("7e786a"))],
        roof=[(0, C("5a6a7a")), (1, C("e6eef6"))],
        grass=[(0, (60, 56, 36)), (.25, (86, 80, 52)), (.5, (118, 110, 72)), (.7, (150, 142, 96)), (.85, (184, 176, 132)), (1, (224, 220, 190))],
        ice=True, bare="snow",
    ),
    "blight": dict(
        name="오염된 땅 · 어둠의 숲", tag="오염된 땅",
        ground=dict(bright=[(0, C("4e3e5a")), (1, C("76627e"))], shadow=[(0, C("261c30")), (1, C("3e3048"))]),
        foliage=[(0, C("0e0814")), (0.4, C("2a1632")), (0.75, C("4e2e5a")), (1, C("8e6a9e"))],
        water=[(0, C("3a0e4e")), (0.6, C("7a2a9a")), (1, C("e08af0"))],
        earth=[(0, C("140e18")), (0.6, C("32263a")), (1, C("56465e"))],
        roof=[(0, C("1e1624")), (1, C("5e4a66"))],
        grass=[(0, (26, 16, 34)), (.25, (42, 28, 52)), (.5, (64, 44, 76)), (.7, (90, 64, 104)), (.85, (124, 96, 136)), (1, (176, 150, 186))],
        bare=dict(o='0a060c', d='1c1222', m='2e2236', l='44364e', h='5e4e6a', e='b04ae0', e2='e8a0ff'), bareGlow=True,
    ),
    "skyisle": dict(
        name="하늘섬 · 구름 위 떠 있는 섬", tag="하늘섬",
        ground=dict(bright=[(0, C("5eaa4a")), (1, C("9edc6e"))], shadow=[(0, C("2e6a38")), (1, C("4c9444"))]),
        foliage=[(0, C("0e3226")), (0.35, C("1e6a3e")), (0.7, C("46a84e")), (1, C("b2ea7a"))],
        water=[(0, C("8ab8e8")), (0.5, C("aad0f4")), (0.85, C("d8ecfc")), (1, C("ffffff"))],
        waterFoam=[(0, C("e8f4ff")), (1, C("ffffff"))],
        earth=[(0, C("2a2018")), (0.6, C("5a4a38")), (1, C("8a7a60"))],
        grass=[(0, (26, 70, 44)), (.25, (40, 104, 58)), (.5, (66, 146, 72)), (.7, (102, 186, 90)), (.85, (152, 218, 118)), (1, (212, 244, 170))],
    ),
    "tropical": dict(
        name="열대 섬 · 산호 해안", tag="열대 섬",
        ground=dict(bright=[(0, C("58b03e")), (1, C("98dc5e"))], shadow=[(0, C("2a6e2c")), (1, C("4a963c"))]),
        foliage=[(0, C("0c3a1c")), (0.35, C("16702e")), (0.7, C("38b048")), (1, C("b6f07a"))],
        water=[(0, C("0e6a8a")), (0.55, C("1ea8b8")), (1, C("8ef0e0"))],
        waterFoam=[(0, C("d8fcf4")), (1, C("ffffff"))],
        earth=[(0, C("3a2a18")), (0.6, C("7a5a34")), (1, C("b08a56"))],
        grass=[(0, (20, 76, 34)), (.25, (32, 110, 44)), (.5, (58, 150, 56)), (.7, (94, 188, 70)), (.85, (150, 220, 100)), (1, (214, 246, 160))],
    ),
}

# Neighbour ground for the border fields: which biome's ground each sheet can paint in its border zone.
NEIGHBOUR = {"jungle": "swamp", "taiga": "tundra", "savanna": "badlands", "tropical": "jungle", "blight": "forest",
             "mushroom": "crystal", "swamp": "blight", "tundra": "crystal"}
# The pristine forest ground (for 「오염이 번지는 숲 가장자리」): the original sheet unchanged.
FOREST = dict(name="숲", tag="숲")
