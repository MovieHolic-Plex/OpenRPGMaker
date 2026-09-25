# Piece catalogue of the atlas biome sheets: per biome the drawn pieces (lib/atlas_art.py) with their cell roles, a
# Korean name, a category (tree, plant, rock, crystal, water, cliff, landmark, decal) and the placement rule the AI
# reference documents quote. NEIGHBOUR_PIECES are the border-zone twins: drawn the same way, the base row baked onto
# the neighbour biome's lawn (role b) so the zone never shows this sheet's lawn under a trunk.
import atlas_art as A
from atlas_pixel import C

def piece(pid, name, w, h, roles, paint, cat, rule):
    assert len(roles) == h and all(len(r) == w for r in roles), pid
    return dict(id=pid, name=name, w=w, h=h, roles=roles, paint=paint, cat=cat, rule=rule)

TREE_RULE = "나무 덩이: 윗줄(수관 C)은 위층·통과, 몸통(T)은 위층·통행 불가, 맨 아랫줄(B)은 아래층+땅 받침·통행 불가. 빈 땅(240)에만, 길·문·계단 끝·다리 끝에서 2칸 밖. 두세 그루를 어깨를 맞대 한 덩이로(일렬 금지)."
SMALL_RULE = "작은 덤불·바위·수정(S): 위층·통행 불가. 3~5칸 덩이(L자로 시작, 한 줄 셋 이상 금지)로만 두고 흩뿌리지 않는다. 나무 덩이 발치·절벽 밑·물가에 붙인다."
UNDER_RULE = "섬 밑동: 하늘섬 남쪽 가장자리(땅 칸 바로 밑이 하늘(물) 칸인 곳) 밑 하늘 칸에 위층으로 한 칸씩 붙여 가로로 잇는다. 가장자리 가운데는 깊게(1×2), 양 끝 두세 칸은 얕게(1×1). 다리·나루 밑에는 두지 않는다. 통행 불가."
DECAL_RULE = "밟을 수 있는 장식(W): 위층·통과. 2×2 핵 + 한두 칸의 덩이로. 낱개로 흩뿌리지 않는다."
WATER_RULE = "물 위 장식(O): 물 칸 위에만, 위층·통행 불가(물이라 원래 못 지나간다). 물가에서 1~3칸 안쪽에 2~4개씩 무리로."
VINE_RULE = "절벽 덩굴(V): 절벽 몸통 칸 위층에만(윗단 가장자리·계단·폭포 칸 제외), 세로 2칸 한 벌. 한 절벽에 두세 벌까지, 붙여서 커튼처럼 늘어세우지 않는다."

PIECES = {
    "jungle": [
        piece("giant-tree-1", "거대 우림 나무 · 판뿌리", 5, 6, ["CCCCC", "CCCCC", "CCCCC", "CCCCC", "CCTCC", "BBBBB"], lambda: A.giant_tree(5, 6, 1), "tree", TREE_RULE + " 맵에 서너 그루, 숲 가장자리·빈터 한가운데의 주인공 나무로."),
        piece("giant-tree-2", "거대 우림 나무 · 덩굴", 4, 6, ["CCCC", "CCCC", "CCCC", "CCCC", "CTTC", "BBBB"], lambda: A.giant_tree(4, 6, 2, leaf="jungle2"), "tree", TREE_RULE),
        piece("jungle-tree", "우림 나무", 3, 4, ["CCC", "CCC", "CTC", "BBB"], lambda: A.broad_tree(3, 4, 3, "jungle2", "jungle"), "tree", TREE_RULE),
        piece("fern-1", "우림 덤불", 1, 1, ["S"], lambda: A.bush(21, "jungle2", 6, (3.6, 5.0)), "plant", SMALL_RULE),
        piece("fern-2", "양치 덤불 · 밝은 잎", 1, 1, ["S"], lambda: A.fern(2, "jungle2"), "plant", SMALL_RULE),
        piece("broadleaf", "큰 잎 파초", 2, 2, ["CC", "BB"], lambda: A.broadleaf_plant(1), "plant", TREE_RULE),
        piece("orchid", "난초 꽃무리", 1, 1, ["W"], lambda: A.flowers(1, ("e84a8a", "ffd06a", "f070c0")), "decal", DECAL_RULE),
        piece("vine-1", "절벽 덩굴", 1, 2, ["V", "V"], lambda: A.vine_curtain(1), "cliff", VINE_RULE),
        piece("vine-2", "절벽 덩굴 · 꽃", 1, 2, ["V", "V"], lambda: A.vine_curtain(2, "jungle2"), "cliff", VINE_RULE),
        piece("vine-arch", "덩굴 아치", 3, 3, ["CCC", "T.T", "B.B"], lambda: A.vine_arch(1), "landmark", "덩굴 아치: 길이 지나가는 자리에 가운데 칸이 길 위에 오도록 세운다(가운데 기둥 사이는 지나갈 수 있다). 맵에 하나."),
        piece("idol", "이끼 낀 옛 석상", 2, 3, ["CC", "TT", "BB"], lambda: A.idol(1), "landmark", "옛 석상: 빈터·길 끝의 표지물로 맵에 하나. 둘레 한 칸 비움."),
    ],
    "swamp": [
        piece("mangrove-1", "맹그로브", 3, 4, ["CCC", "CCC", "CTC", "BBB"], lambda: A.mangrove(3, 4, 1), "tree", TREE_RULE + " 물가 1~3칸 안에 무리로."),
        piece("mangrove-2", "큰 맹그로브", 4, 4, ["CCCC", "CCCC", "CTTC", "BBBB"], lambda: A.mangrove(4, 4, 2), "tree", TREE_RULE + " 물가 1~3칸 안에 무리로."),
        piece("snag", "마른 고사목", 1, 2, ["C", "B"], lambda: A.dead_tree(1, 2, 5, "mangrove"), "tree", TREE_RULE),
        piece("reeds-1", "부들 갈대", 1, 1, ["S"], lambda: A.reeds(1), "plant", SMALL_RULE + " 물가 한 칸 안에."),
        piece("reeds-2", "갈대", 1, 1, ["S"], lambda: A.reeds(2, False), "plant", SMALL_RULE + " 물가 한 칸 안에."),
        piece("lily-1", "수련 · 꽃", 1, 1, ["O"], lambda: A.lily(1), "water", WATER_RULE),
        piece("lily-2", "수련 잎", 1, 1, ["O"], lambda: A.lily(2, False), "water", WATER_RULE),
        piece("marsh-flower", "늪 꽃", 1, 1, ["W"], lambda: A.flowers(3, ("f4f0a0", "c8a0e8")), "decal", DECAL_RULE),
        piece("bog-log", "이끼 낀 쓰러진 통나무", 2, 1, ["SS"], lambda: A.log(2, 4, snow=False, moss=C("5e7034")), "plant", SMALL_RULE),
        piece("swamp-bush", "늪 덤불", 1, 1, ["S"], lambda: A.bush(6, "swamp"), "plant", SMALL_RULE),
    ],
    "mushroom": [
        piece("mushroom-red", "거대 붉은 버섯", 3, 4, ["CCC", "CCC", "CTC", "CBC"], lambda: A.giant_mushroom(3, 4, 1, "red"), "tree", TREE_RULE),
        piece("mushroom-blue", "거대 푸른 버섯", 4, 5, ["CCCC", "CCCC", "CTTC", "CTTC", "CBBC"], lambda: A.giant_mushroom(4, 5, 2, "blue"), "tree", TREE_RULE),
        piece("mushroom-purple", "보랏빛 버섯", 2, 3, ["CC", "CC", "BB"], lambda: A.giant_mushroom(2, 3, 3, "purple"), "tree", TREE_RULE),
        piece("mushroom-gold", "금빛 버섯", 2, 3, ["CC", "CC", "BB"], lambda: A.giant_mushroom(2, 3, 4, "gold"), "tree", TREE_RULE),
        piece("shrooms-1", "작은 버섯 무리", 1, 1, ["S"], lambda: A.small_mushrooms(1), "plant", SMALL_RULE),
        piece("shrooms-2", "작은 버섯 무리 · 푸른", 1, 1, ["S"], lambda: A.small_mushrooms(2, ("blue", "purple")), "plant", SMALL_RULE),
        piece("glow-caps", "빛 버섯", 1, 1, ["W"], lambda: A.glow_caps(1), "decal", DECAL_RULE),
        piece("glow-caps-2", "빛 버섯 · 보라", 1, 1, ["W"], lambda: A.glow_caps(2, "d8a0ff"), "decal", DECAL_RULE),
        piece("fairy-ring", "요정 고리", 3, 3, ["WWW", "WWW", "WWW"], lambda: A.fairy_ring(1), "landmark", "요정 고리: 빈터에 하나, 가운데는 비어 있다(지나갈 수 있다). 길 위에는 두지 않는다."),
    ],
    "crystal": [
        piece("crystal-violet", "보랏빛 수정", 1, 1, ["S"], lambda: A.crystals(1, 1, 1, "violet", 3, 0.9, False), "crystal", SMALL_RULE),
        piece("crystal-cyan", "푸른 수정", 1, 1, ["S"], lambda: A.crystals(1, 1, 2, "cyan", 2, 0.9, False), "crystal", SMALL_RULE),
        piece("crystal-pink", "분홍 수정", 1, 1, ["S"], lambda: A.crystals(1, 1, 6, "pink", 3, 0.85, False), "crystal", SMALL_RULE),
        piece("crystal-clear", "맑은 수정", 1, 1, ["S"], lambda: A.crystals(1, 1, 7, "clear", 2, 0.9, False), "crystal", SMALL_RULE),
        piece("cluster-pink", "분홍 수정 무리", 2, 2, ["CC", "BB"], lambda: A.crystals(2, 2, 3, "pink", 3), "crystal", TREE_RULE),
        piece("cluster-cyan", "푸른 수정 무리", 2, 2, ["CC", "BB"], lambda: A.crystals(2, 2, 8, "cyan", 4), "crystal", TREE_RULE),
        piece("spire-violet", "보랏빛 수정 첨탑", 2, 3, ["CC", "CC", "BB"], lambda: A.crystals(2, 3, 4, "violet", 3), "crystal", TREE_RULE),
        piece("giant-cyan", "거대 푸른 수정", 3, 4, ["CCC", "CCC", "CTC", "BBB"], lambda: A.crystals(3, 4, 5, "cyan", 5), "crystal", TREE_RULE + " 맵에 한두 개, 빈터의 주인공으로."),
        piece("shards", "수정 조각", 1, 1, ["W"], lambda: A.shards(1), "decal", DECAL_RULE),
        piece("shards-cyan", "수정 조각 · 푸른", 1, 1, ["W"], lambda: A.shards(2, "cyan"), "decal", DECAL_RULE),
        piece("pale-rock", "창백한 바위", 1, 1, ["S"], lambda: A.boulder(1, 1, 5, "grey"), "rock", SMALL_RULE),
    ],
    "badlands": [
        piece("red-boulder-1", "붉은 바위", 1, 1, ["S"], lambda: A.boulder(1, 1, 1, "red"), "rock", SMALL_RULE),
        piece("red-boulder-2", "붉은 바위 · 납작", 1, 1, ["S"], lambda: A.boulder(1, 1, 2, "red", scale=0.85), "rock", SMALL_RULE),
        piece("red-rock", "붉은 큰 바위", 2, 2, ["TT", "BB"], lambda: A.boulder(2, 2, 3, "red"), "rock", TREE_RULE),
        piece("rock-pile", "붉은 바위 무더기", 3, 2, ["TTT", "BBB"], lambda: A.rock_pile(3, 2, 5, "red"), "rock", TREE_RULE.replace("나무 덩이", "바위 무더기") + " 절벽 발치·길 굽이에."),
        piece("rock-pile-2", "붉은 바위 무더기 · 작게", 2, 2, ["TT", "BB"], lambda: A.rock_pile(2, 2, 9, "red"), "rock", TREE_RULE.replace("나무 덩이", "바위 무더기") + " 절벽 발치·길 굽이에."),
        piece("sagebrush-1", "쑥 덤불", 1, 1, ["S"], lambda: A.sagebrush(1, "acacia"), "plant", SMALL_RULE),
        piece("sagebrush-2", "마른 쑥 덤불", 1, 1, ["S"], lambda: A.sagebrush(2, "tundra"), "plant", SMALL_RULE),
    ],
    "savanna": [
        piece("acacia-1", "우산 아카시아", 5, 4, ["CCCCC", "CCCCC", "CCTCC", "CCBCC"], lambda: A.acacia(5, 4, 1), "tree", TREE_RULE + " 넓은 풀밭에 한두 그루씩 드문드문(사바나는 숲이 없다)."),
        piece("acacia-2", "작은 아카시아", 4, 3, ["CCCC", "CCCC", "CBBC"], lambda: A.acacia(4, 3, 2), "tree", TREE_RULE),
        piece("baobab", "바오밥 나무", 3, 5, ["CCC", "CTC", "TTT", "TTT", "BBB"], lambda: A.baobab(3, 5, 1), "tree", TREE_RULE + " 맵에 하나둘, 표지가 되는 큰 나무."),
        piece("termite", "흰개미 둔덕", 1, 2, ["C", "B"], lambda: A.termite_mound(1), "rock", SMALL_RULE),
        piece("dry-bush-1", "마른 덤불", 1, 1, ["S"], lambda: A.bush(3, "savanna"), "plant", SMALL_RULE),
        piece("dry-bush-2", "가시 덤불", 1, 1, ["S"], lambda: A.sagebrush(4, "acacia"), "plant", SMALL_RULE),
        piece("kopje", "코피 바위", 2, 2, ["TT", "BB"], lambda: A.boulder(2, 2, 3, "sand"), "rock", TREE_RULE),
    ],
    "taiga": [
        piece("spruce-1", "눈 얹힌 가문비", 2, 4, ["CC", "CC", "CC", "BB"], lambda: A.spruce(2, 4, 1), "tree", TREE_RULE + " 두세 그루씩 빽빽하게."),
        piece("spruce-2", "큰 가문비", 3, 5, ["CCC", "CCC", "CCC", "TTT", "BBB"], lambda: A.spruce(3, 5, 2), "tree", TREE_RULE),
        piece("spruce-3", "어린 가문비", 2, 3, ["CC", "CC", "BB"], lambda: A.spruce(2, 3, 3), "tree", TREE_RULE),
        piece("snow-log", "눈 쌓인 통나무", 3, 1, ["SSS"], lambda: A.log(3, 1), "plant", SMALL_RULE),
        piece("stump", "눈 덮인 그루터기", 1, 1, ["S"], lambda: A.stump(1), "plant", SMALL_RULE),
        piece("snow-rock", "눈 얹힌 바위", 1, 1, ["S"], lambda: A.boulder(1, 1, 6, "grey", top=[C("ffffff"), C("dfe9f1")]), "rock", SMALL_RULE),
        piece("taiga-bush", "침엽 덤불", 1, 1, ["S"], lambda: A.bush(7, "spruce"), "plant", SMALL_RULE),
    ],
    "tundra": [
        piece("lichen-rock-1", "이끼 바위", 1, 1, ["S"], lambda: A.boulder(1, 1, 4, "lichen", top=[C("b8b04a"), C("8a8a3a")]), "rock", SMALL_RULE),
        piece("lichen-rock-2", "이끼 바위 · 둥근", 1, 1, ["S"], lambda: A.boulder(1, 1, 9, "lichen", top=[C("d0884a")]), "rock", SMALL_RULE),
        piece("cairn", "돌무더기 이정표", 1, 2, ["C", "B"], lambda: A.cairn(1), "landmark", "돌무더기 이정표: 길가 갈림길에 하나. 둘레 한 칸 비움."),
        piece("dwarf-shrub-1", "난쟁이 관목", 1, 1, ["S"], lambda: A.bush(1, "tundra"), "plant", SMALL_RULE),
        piece("dwarf-shrub-2", "붉은 관목", 1, 1, ["S"], lambda: A.bush(2, "tundra", 5, (2.6, 3.6)), "plant", SMALL_RULE),
        piece("frost-rock", "서리 바위", 2, 2, ["TT", "BB"], lambda: A.boulder(2, 2, 8, "lichen", top=[C("ffffff"), C("dfe9f1")]), "rock", TREE_RULE),
    ],
    "blight": [
        piece("thorns-1", "검은 가시덤불", 1, 1, ["S"], lambda: A.thorns(1), "plant", SMALL_RULE),
        piece("thorns-2", "검은 가시덤불 · 넓은", 2, 1, ["SS"], lambda: A.thorns(2, 2), "plant", SMALL_RULE),
        piece("obelisk", "마왕의 흑요석 탑", 1, 3, ["C", "T", "B"], lambda: A.obelisk(1), "landmark", "마왕의 흑요석 탑: 오염의 중심에 하나(맵에 한두 개). 독 웅덩이·오염 맥 곁. 둘레 한 칸 비움."),
        piece("miasma-vent", "독기 분출구", 1, 2, ["C", "B"], lambda: A.vent(1), "rock", "독기 분출구: 독 웅덩이 곁 2~3칸에 하나. 길·집에서 두 칸 밖."),
        piece("blood-crystal", "핏빛 수정", 1, 1, ["S"], lambda: A.crystals(1, 1, 3, "blood", 3, 0.9, False), "crystal", SMALL_RULE),
        piece("rot-shrooms", "썩은 버섯", 1, 1, ["S"], lambda: A.small_mushrooms(9, ("purple",)), "plant", SMALL_RULE),
        piece("dark-rock", "검은 바위", 1, 1, ["S"], lambda: A.boulder(1, 1, 3, "dark"), "rock", SMALL_RULE),
    ],
    "skyisle": [
        piece("cloud-1", "작은 구름", 2, 1, ["OO"], lambda: A.cloud(2, 1, 2), "water", WATER_RULE.replace("물 위", "하늘(물 칸) 위").replace("물가", "섬 가장자리")),
        piece("cloud-2", "뭉게구름", 3, 2, ["OOO", "OOO"], lambda: A.cloud(3, 2, 1), "water", WATER_RULE.replace("물 위", "하늘(물 칸) 위").replace("물가", "섬 가장자리")),
        piece("cloud-3", "긴 구름", 4, 2, ["OOOO", "OOOO"], lambda: A.cloud(4, 2, 3), "water", WATER_RULE.replace("물 위", "하늘(물 칸) 위").replace("물가", "섬 가장자리")),
        piece("float-rock-1", "떠 있는 바위", 1, 1, ["O"], lambda: A.float_rock(1, 1, 2), "water", WATER_RULE.replace("물 위", "하늘(물 칸) 위")),
        piece("float-rock-2", "떠 있는 작은 섬", 2, 2, ["OO", "OO"], lambda: A.float_rock(2, 2, 1), "water", WATER_RULE.replace("물 위", "하늘(물 칸) 위")),
        piece("underside-deep-1", "섬 밑동 (깊게)", 1, 2, ["O", "O"], lambda: A.underside(2, 3), "water", UNDER_RULE),
        piece("underside-deep-2", "섬 밑동 (깊게, 다른 모양)", 1, 2, ["O", "O"], lambda: A.underside(2, 8), "water", UNDER_RULE),
        piece("underside-1", "섬 밑동 (얕게)", 1, 1, ["O"], lambda: A.underside(1, 4), "water", UNDER_RULE),
        piece("underside-2", "섬 밑동 (얕게, 다른 모양)", 1, 1, ["O"], lambda: A.underside(1, 11), "water", UNDER_RULE),
        piece("wind-crystal", "바람 수정 기둥", 1, 2, ["C", "B"], lambda: A.wind_crystal(1), "landmark", "바람 수정 기둥: 섬 끝·다리 어귀에 하나. 둘레 한 칸 비움."),
        piece("sky-bush", "하늘섬 덤불", 1, 1, ["S"], lambda: A.bush(5, "sky"), "plant", SMALL_RULE),
        piece("wind-flower", "바람꽃", 1, 1, ["W"], lambda: A.flowers(5, ("ffffff", "a8c8ff", "ffe070")), "decal", DECAL_RULE),
    ],
    "tropical": [
        piece("palm-1", "야자수", 3, 4, ["CCC", "CCC", "CTC", "CBC"], lambda: A.palm(3, 4, 1), "tree", TREE_RULE + " 모래밭·해안에 두세 그루씩."),
        piece("palm-2", "기운 야자수", 2, 4, ["CC", "CC", "TT", "BB"], lambda: A.palm(2, 4, 2, -1), "tree", TREE_RULE + " 모래밭·해안에 두세 그루씩."),
        piece("hibiscus", "히비스커스 덤불", 1, 1, ["S"], lambda: A.hibiscus(1), "plant", SMALL_RULE),
        piece("tropic-bush", "열대 덤불", 1, 1, ["S"], lambda: A.bush(8, "tropical"), "plant", SMALL_RULE),
        piece("coral-1", "분홍 산호", 1, 1, ["O"], lambda: A.coral(1), "water", WATER_RULE),
        piece("coral-2", "주황 산호", 1, 1, ["O"], lambda: A.coral(3, ("ff9a4a", "ffd06a")), "water", WATER_RULE),
        piece("coral-3", "보라 산호", 1, 1, ["O"], lambda: A.coral(5, ("c46ae0", "e8a0ff")), "water", WATER_RULE),
        piece("reef", "산호초", 2, 2, ["OO", "OO"], lambda: A.coral(2, ("c46ae0", "ffb04a", "ff6a8a"), True), "water", WATER_RULE),
        piece("shell", "조개껍데기", 1, 1, ["W"], lambda: A.shell(1), "decal", DECAL_RULE + " 모래 위에만."),
        piece("starfish", "불가사리", 1, 1, ["W"], lambda: A.starfish(1), "decal", DECAL_RULE + " 모래 위에만."),
        piece("driftwood", "떠밀려 온 나무", 2, 1, ["SS"], lambda: A.driftwood(1), "plant", SMALL_RULE + " 모래사장에."),
        piece("beach-rock", "해변 바위", 1, 1, ["S"], lambda: A.boulder(1, 1, 7, "sand"), "rock", SMALL_RULE),
    ],
}

# Border-zone twins: pieces of the neighbour biome drawn on this sheet (base row baked onto the neighbour lawn).
NEIGHBOUR_PIECES = {
    "swamp": [("mangrove-1", "swamp"), ("reeds-1", "swamp"), ("swamp-bush", "swamp"), ("snag", "swamp")],
    "tundra": [("lichen-rock-1", "tundra"), ("cairn", "tundra"), ("dwarf-shrub-1", "tundra"), ("dwarf-shrub-2", "tundra")],
    "badlands": [("red-boulder-1", "badlands"), ("red-rock", "badlands"), ("sagebrush-1", "badlands"),
                 ("dead-tree", None)],
    "jungle": [("jungle-tree", "jungle"), ("fern-1", "jungle"), ("fern-2", "jungle"), ("broadleaf", "jungle")],
    "forest": [("oak", None), ("forest-bush", None), ("forest-flowers", None)],
    "crystal": [("crystal-violet", "crystal"), ("crystal-cyan", "crystal"), ("spire-violet", "crystal"), ("cluster-pink", "crystal")],
    "blight": [("thorns-1", "blight"), ("blood-crystal", "blight"), ("blight-tree", None)],
}
EXTRA_NEIGHBOUR = {
    "dead-tree": piece("dead-tree", "붉은 땅 고목", 3, 4, ["CCC", "CCC", "CTC", "BBB"], lambda: A.dead_tree(3, 4, 1, "acacia"), "tree", TREE_RULE),
    "oak": piece("oak", "푸른 숲 참나무", 3, 4, ["CCC", "CCC", "CTC", "BBB"], lambda: A.broad_tree(3, 4, 11, "forest", "jungle"), "tree", TREE_RULE),
    "forest-bush": piece("forest-bush", "푸른 덤불", 1, 1, ["S"], lambda: A.bush(12, "forest"), "plant", SMALL_RULE),
    "forest-flowers": piece("forest-flowers", "들꽃", 1, 1, ["W"], lambda: A.flowers(12, ("ffffff", "ffe070", "f080a0")), "decal", DECAL_RULE),
    "blight-tree": piece("blight-tree", "오염된 고목", 3, 4, ["CCC", "CCC", "CTC", "BBB"], lambda: A.dead_tree(3, 4, 2, "blight", C("c060ff")), "tree", TREE_RULE),
}

def neighbour_pieces(nb):
    out = []
    for pid, biome in NEIGHBOUR_PIECES.get(nb, []):
        src = EXTRA_NEIGHBOUR[pid] if biome is None else next(p for p in PIECES[biome] if p["id"] == pid)
        roles = [r.replace("B", "b") for r in src["roles"]]
        out.append(dict(src, id="nb-" + pid, roles=roles, neighbour=nb))
    return out
