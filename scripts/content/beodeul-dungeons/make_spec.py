#!/usr/bin/env python3
"""버들항 던전 겉가죽 정의(tiledata/beodeul-dungeon/fable/spec.json)를 쓴다 — 주제·겉모습·기물 표의 정본은 이 파일이다.

  python3 scripts/content/beodeul-dungeons/make_spec.py

표를 고친 뒤 이 스크립트 → bake.py 순서로 돌린다. 칸 번호는 표 순서로 정해진다(주제는 끝에 더한다).
기물 O(id, 그림, 칸 폭, 칸 높이, 놓는 법, 이름, 영어, swap=[옛 킷 …]):
  놓는 법 object = 서 있는 기물(아랫줄 막힘, 윗줄은 사람 위) · decal = 밟고 지나가는 바닥 그림 · mount = 벽 앞면에 붙는 것(위쪽 맞춤).
  swap = 시공기의 옛 꾸밈이 그 킷을 놓으려 할 때 이 그림으로 갈아 끼운다(같은 폭; 더 높으면 아랫줄 맞춤, 벽걸이는 벽 안에서).
덧놓기 E(id, 자리, 바닥 100칸마다 개수, max, once=): 자리 open 방 안쪽 · edge 벽가 · wall 북쪽 벽 앞면 · decal 바닥 그림 · run 방 한가운데 세로 줄(융단).
  once = 그 층에 하나뿐인 볼거리(큰 수정·권양기·분수 …) — 가장 넓은 방부터 자리를 찾는다.
주제의 borrow = 다른 주제에서 빌린 조각(윗면·테·물가)의 색 줄을 이 주제 것으로, inherit = 그 주제의 기물 표를 물려받는다(소굴 = 동굴 + 소굴 기물).
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "tiledata/beodeul-dungeon/fable/spec.json"
SW, CC, CV, TP, MV, VC = (lambda i: f"bd-pick-aqueduct-sewer-{i}"), (lambda i: f"bd-pick-castle-catacombs-{i}"), (lambda i: f"bd-pick-sea-cave-{i}"), (lambda i: f"bd-pick-temple-ruins-{i}"), (lambda i: f"bd-pick-mining-valley-{i}"), (lambda i: f"bd-pick-volcano-cave-{i}")
TK = lambda i: f"bd-pick-dungeon-theme-{i}"


def O(id, src, w, h, cls, ko, en, swap=(), words=(), **kw):
    return dict(id=id, src=src, w=w, h=h, cls=cls, ko=ko, en=en, swap=list(swap), words=list(words), **kw)


def E(id, cls, per, max=9, **kw):
    return dict(id=id, cls=cls, per=per, max=max, **kw)


GLOWS = [
    dict(id="torch", ko="횃불 빛", colour="#ffb45a", w=5, h=7, cx=40, cy=38, r1=22, r2=40, a1=0.34, a2=0.13, torch=True, dx=-2, dy=-2),
    dict(id="fire", ko="화로 빛", colour="#ffb45a", w=5, h=5, cx=40, cy=40, r1=15, r2=28, a1=0.30, a2=0.12, dx=-2, dy=-2),
    dict(id="ember", ko="작은 불빛", colour="#ffb45a", w=3, h=3, cx=24, cy=24, r1=10, r2=19, a1=0.26, a2=0.10, dx=-1, dy=-1),
    dict(id="crystal", ko="수정 빛", colour="#9fb8ff", w=4, h=4, cx=32, cy=38, r1=16, r2=29, a1=0.31, a2=0.11, dx=-1, dy=-1),
    dict(id="torch-wisp", ko="푸른 횃불 빛", colour="#9cc6ff", w=5, h=7, cx=40, cy=38, r1=22, r2=40, a1=0.30, a2=0.12, torch=True, dx=-2, dy=-2),
    dict(id="fire-wisp", ko="푸른 화로 빛", colour="#9cc6ff", w=5, h=5, cx=40, cy=40, r1=15, r2=28, a1=0.27, a2=0.11, dx=-2, dy=-2),
    dict(id="ember-wisp", ko="푸른 작은 불빛", colour="#9cc6ff", w=3, h=3, cx=24, cy=24, r1=10, r2=19, a1=0.24, a2=0.10, dx=-1, dy=-1),
    dict(id="green", ko="초록 등 빛", colour="#8fe36a", w=5, h=5, cx=40, cy=40, r1=14, r2=27, a1=0.26, a2=0.11, dx=-2, dy=-2),
    dict(id="spore", ko="버섯 빛", colour="#9fe8e0", w=3, h=3, cx=24, cy=26, r1=9, r2=17, a1=0.22, a2=0.09, dx=-1, dy=-1),
]

SHARED = dict(
    objects=[
        O("torch-wall", "cv-torch", 1, 2, "mount", "벽 횃불", "wall torch", [SW("torch-wall")], ["횃불", "torch"]),
        O("brazier", "ru-brazier", 1, 2, "object", "청동 화로", "bronze brazier", [SW("brazier")], ["화로", "brazier"]),
        O("bones", "sh-bones", 1, 1, "decal", "뼈", "bones", [SW("bones")], ["뼈", "bones"]),
        O("skulls", "sh-skulls", 1, 1, "object", "해골 더미", "skulls", [SW("skulls")], ["해골", "skulls"]),
        O("crate", "sh-crate", 1, 1, "object", "나무 궤짝", "crate", [SW("crate")], ["궤짝", "crate"]),
        O("barrel", "sh-barrel", 1, 1, "object", "나무 통", "barrel", [SW("barrel"), MV("barrel")], ["통", "barrel"]),
        O("candles", "sh-candles", 1, 1, "object", "촛불", "candles", [SW("candles")], ["촛불", "candles"]),
        O("rubble", "sh-rubble", 1, 1, "decal", "돌 부스러기", "stone chips", [SW("rubble"), CC("rubble")], ["부스러기", "rubble"]),
        O("bucket", "sh-bucket", 1, 1, "object", "나무 양동이", "bucket", [SW("bucket")], ["양동이", "bucket"]),
        O("crate-stack", "sh-cratestack", 1, 2, "object", "쌓인 궤짝", "stacked crates", [SW("crate-stack")], ["궤짝", "crates"]),
        O("chains", "sh-chains", 1, 1, "mount", "벽 사슬", "wall chains", [SW("chains")], ["사슬", "chains"]),
        O("sack-pile", "sh-sacks", 2, 2, "object", "자루 더미", "sack pile", ["bd-pick-walled-market-sack-pile"], ["자루", "sacks"]),
        O("campfire", "sh-campfire", 1, 1, "object", "모닥불", "campfire", ["bd-pick-deep-forest-path-campfire"], ["모닥불", "campfire"]),
        O("bone-heap", "cv-bones", 2, 2, "object", "뼈 무더기", "bone heap", [SW("bone-heap")], ["뼈", "bones"]),
    ],
    glowOf={"torch-wall": "torch", "brazier": "fire", "candles": "ember", "campfire": "ember"},
    # 빛 색도 겉모습을 따른다: 셋째 겉모습(dusk)의 게임은 불이 푸른 혼불이다 — 같은 화소에 fire 줄만 wisp 줄로, 빛 띠는 찬 색으로.
    light={"dusk": dict(suffix="wisp", ko="푸른 불", remap={"fire": "wisp"}, glow={"torch": "torch-wisp", "fire": "fire-wisp", "ember": "ember-wisp"})},
)

CAVE = dict(
    id="cave", ko="동굴", types=["cave"],
    floor=["cv-bed-a", "cv-bed-b", "cv-bed-c", "cv-bed-d", "cv-bed-e"], faces=["cv-face-a2", "cv-face-b", "cv-face-c"], top=["cv-top"], topRamps=["dark"],
    rimS="cv-edge-s", rimW="cv-edge-w", sliver="slab:4", faceGap="crag:1", shore="cv-shore", shoreIn="cv-shore-in",
    looks=[dict(id="umber", ko="갈색 바위"), dict(id="slate", ko="푸른 바위", remap={"crag": "cragb"}), dict(id="moss", ko="이끼빛 바위", remap={"crag": "cragc"})],
    objects=[
        O("cave-mushroom", "cv-mushroom", 1, 1, "object", "빛 버섯", "glowing mushrooms", [CV("glow-mushroom")], ["버섯", "mushroom"]),
        O("cave-moss", "cv-moss", 1, 1, "decal", "빛 이끼", "glowing moss", [CV("glow-moss-floor")], ["이끼", "moss"]),
        O("cave-stalagmite-a", "cv-spike-a", 1, 2, "object", "석순", "stalagmite", [CV("stalagmite-1"), "bd-pick-dungeon-cave-broken-pillar"], ["석순", "stalagmite"]),
        O("cave-stalagmite-b", "cv-spike-b", 1, 2, "object", "석순 한 쌍", "stalagmite pair", [CV("stalagmite-1"), "bd-pick-dungeon-cave-broken-pillar"], ["석순", "stalagmite"]),
        O("cave-stalactites", "cv-stalactites", 1, 2, "mount", "종유석", "stalactites", [TK("stalactites")], ["종유석", "stalactites"]),
        O("cave-vines", "cv-vines", 1, 2, "mount", "늘어진 뿌리", "hanging roots", [CV("vines-2")], ["뿌리", "roots"]),
        O("cave-pebbles", "cv-pebbles", 1, 1, "decal", "조약돌", "pebbles", [CV("rubble-cave")], ["조약돌", "pebbles"]),
        O("cave-stalagmite-big", "cv-stalag-big", 2, 3, "object", "큰 석순", "big stalagmite", [CV("rock-pillar-2")], ["석순", "stalagmite"], remap={"rock": "crag"}),
        O("cave-stalagmite-group", "cv-stalag-set", 2, 2, "object", "석순 무리", "stalagmite group", [CV("rock-pillar-2")], ["석순", "stalagmite"], remap={"rock": "crag"}),
        O("cave-boulders", "cv-rocks", 2, 2, "object", "낙석", "fallen boulders", [CV("rock-pillar-2")], ["바위", "boulders"], remap={"rock": "crag"}),
        O("cave-crystal", "cv-crystal", 2, 2, "object", "수정 무리", "crystal cluster", [], ["수정", "crystal"]),
        O("cave-spring", "cv-fall", 1, 3, "mount", "벽 샘", "wall spring", [], ["샘", "spring"], crop=[0, 8, 16, 56]),
        O("cave-hollow", "cv-hollow", 3, 2, "decal", "웅덩이 자국", "hollow with a puddle", [], ["웅덩이", "puddle"]),
        O("cave-earth", "cv-earth", 3, 2, "decal", "흙과 자갈", "earth and gravel", [], ["흙", "gravel"]),
    ],
    extras=[E("cave-crystal", "open", 0.5, 1), E("cave-stalagmite-big", "open", 0.5, 2), E("cave-hollow", "decal", 0.5, 1), E("cave-earth", "decal", 0.8, 2), E("cave-spring", "wall", 0.4, 1)],
    glowOf={"cave-crystal": "crystal", "cave-mushroom": "spore"},
)

RUIN = dict(
    id="ruin", ko="유적", types=["temple"],
    floor=["ru-floor"], faces=["ru-wall-a", "ru-wall-b", "ru-wall-c"], top=["ru-top-b", "ru-top-c"], topRamps=["leaf"],
    rimS="ru-rim-s", rimW="ru-rim-w", sliver="lime:2", faceGap="buff:1",
    looks=[dict(id="buff", ko="잿빛 마름돌"), dict(id="sand", ko="사암", remap={"buff": "buffw"}), dict(id="rose", ko="붉은 돌", remap={"buff": "buffc"})],
    objects=[
        O("ruin-column", "ru-pillar", 1, 3, "object", "돌기둥", "stone column", [TP("column-temple"), CC("column-cata")], ["기둥", "column"]),
        O("ruin-column-stump", "ru-stump", 1, 2, "object", "부러진 기둥", "broken column", [TP("column-temple-broken"), SW("column-sewer-broken")], ["기둥", "column"]),
        O("ruin-vines", "ru-vines", 1, 3, "mount", "늘어진 덩굴", "hanging ivy", [TP("vines-2")], ["덩굴", "ivy"]),
        O("ruin-niche-urn", "ru-niche-urn", 1, 2, "mount", "벽감 항아리", "niche with an urn", [CC("niche-urn")], ["벽감", "niche"]),
        O("ruin-altar", "ru-altar", 2, 2, "object", "돌 제단", "stone altar", [CC("altar-stone")], ["제단", "altar"]),
        O("ruin-chips", "ru-chips", 1, 1, "decal", "돌 조각", "stone fragments", [TP("rubble-temple"), SW("rubble"), CC("rubble")], ["부스러기", "rubble"]),
        O("ruin-statue", "ru-statue", 2, 3, "object", "수호 석상", "guardian statue", [TK("statue-head")], ["석상", "statue"]),
        O("ruin-rubble-heap", "ru-rubble", 2, 2, "object", "무너진 돌 더미", "fallen blocks", [TK("rubble-heap")], ["돌 더미", "rubble"]),
        O("ruin-mosaic", "ru-mosaic", 3, 3, "decal", "바닥 모자이크", "floor mosaic", [TP("mosaic-medallion-7x7"), TP("mosaic-medallion-5x5")], ["모자이크", "mosaic"]),
        O("ruin-column-tall", "ru-column", 2, 4, "object", "큰 돌기둥", "tall column", [], ["기둥", "column"]),
        O("ruin-column-fallen", "ru-broken", 3, 2, "object", "쓰러진 기둥", "fallen column", [], ["기둥", "column"]),
        O("ruin-pool", "ru-pool", 4, 3, "object", "돌 테 못", "kerbed pool", [], ["못", "pool"], block=[[x, y] for y in range(3) for x in range(4)]),
        O("ruin-door-sealed", "ru-door", 2, 3, "mount", "봉인된 돌문", "sealed stone door", [], ["돌문", "door"], crop=[0, 8, 32, 56]),
        O("ruin-ivy-curtain", "ru-ivy", 2, 3, "mount", "덩굴 발", "ivy curtain", [], ["덩굴", "ivy"]),
        O("ruin-leaves", "ru-leaves", 2, 1, "decal", "낙엽", "fallen leaves", [], ["낙엽", "leaves"]),
    ],
    extras=[E("ruin-column-tall", "open", 0.7, 4), E("ruin-pool", "open", 0.3, 1), E("ruin-column-fallen", "open", 0.35, 1), E("ruin-statue", "edge", 0.35, 2),
            E("ruin-ivy-curtain", "wall", 0.5, 2), E("ruin-door-sealed", "wall", 0.25, 1), E("ruin-leaves", "decal", 1.0, 3)],
)

# ---------- 나머지 주제(2026-11-15 오너 「다양하게 만드는 게 중요」): 벽 짜임·바닥 재료·테·물·빛·기물이 주제마다 다르다 ----------
NAT = dict(top=["cv-top"], topRamps=["dark"], rimS="cv-edge-s", rimW="cv-edge-w", rimPhases=2)           # 자연 굴: 동굴의 어두운 윗면·바위 테를 제 색 줄로
BUILT = dict(top=["cv-top"], topRamps=["dark"], rimS="mb-rim-s", rimW="mb-rim-w", rimPhases=2)           # 지은 곳: 갓돌 테
WATER = dict(shore="cv-shore", shoreIn="cv-shore-in")

ICE = dict(
    id="ice", ko="얼음굴", types=["ice"], **NAT, **WATER, water="cv-water2", bridge="plank",
    floor=["ic-floor-a", "ic-floor-b", "ic-floor-c"], faces=["ic-face-a", "ic-face-b", "ic-face-c"],
    borrow={"crag": "frost", "slab": "snow", "dark": "darki", "water": "crystal"}, sliver="snow:4", faceGap="frost:1",
    looks=[dict(id="blue", ko="푸른 얼음"), dict(id="glacier", ko="옥빛 얼음", remap={"frost": "frostb"}), dict(id="dusk", ko="보랏빛 얼음", remap={"frost": "frostc"})],
    objects=[
        O("ice-crystal", "ic-crystal", 1, 2, "object", "얼음 수정", "ice crystal", [TK("ice-crystal")], ["수정", "crystal"]),
        O("ice-rock", "ic-rock", 2, 2, "object", "눈 덮인 바위", "snowy boulder", ["bd-pick-snowfield-rock"], ["바위", "boulder"]),
        O("ice-drift", "ic-drift", 1, 1, "decal", "눈 더미", "snow drift", [TK("snow-drift"), TK("snow-drift-2")], ["눈", "snow"]),
        O("ice-icicles", "ic-icicles", 1, 2, "mount", "고드름", "icicles", [TK("icicles")], ["고드름", "icicles"]),
        O("ice-mound", "ic-mound", 1, 1, "object", "얼음 조각 더미", "ice rubble", ["bd-pick-snowfield-mound"], ["얼음", "ice"]),
        O("ice-frozen-warrior", "ic-frozen", 1, 2, "object", "얼어붙은 전사", "frozen warrior", [TK("frozen-warrior")], ["전사", "warrior"]),
        O("ice-pillar", "ic-pillar", 2, 3, "object", "얼음 기둥", "ice pillar", [], ["기둥", "pillar"]),
        O("ice-great-crystal", "ic-great", 3, 3, "object", "큰 얼음 수정", "great ice crystal", [], ["수정", "crystal"]),
    ],
    extras=[E("ice-great-crystal", "open", 1, 1, once=True), E("ice-pillar", "open", 0.6, 2)],
    glowOf={"ice-crystal": "spore", "ice-great-crystal": "crystal"},
)
VOLCANO = dict(
    id="volcano", ko="화산", types=["volcano"], **NAT, **WATER, water="cv-water2", lava=True, bridge="stone",
    floor=["vo-floor-a", "vo-floor-b", "vo-floor-c"], faces=["vo-face-a", "vo-face-b", "vo-face-c"],
    borrow={"crag": "basalt", "slab": "basalt", "dark": "darkv", "water": "lava", "keep": "basalt"}, sliver="basalt:4", faceGap="basalt:1",
    looks=[dict(id="black", ko="검은 현무암"), dict(id="rust", ko="붉은 현무암", remap={"basalt": "basaltb"}), dict(id="ash", ko="잿빛 현무암", remap={"basalt": "basaltc"})],
    objects=[
        O("volcano-embers", "vo-embers", 1, 1, "decal", "불씨", "embers", [VC("ember-a")], ["불씨", "embers"]),
        O("volcano-vent", "vo-vent", 1, 1, "object", "김 구멍", "steam vent", [VC("steam-vent")], ["김", "vent"]),
        O("volcano-fire-crystal", "vo-firecrystal", 1, 1, "object", "불 수정", "fire crystal", [VC("fire-crystal")], ["수정", "crystal"]),
        O("volcano-spike", "vo-spike", 1, 1, "object", "흑요석 가시", "obsidian spike", [VC("spike-small")], ["가시", "spike"]),
        O("volcano-spike-tall", "vo-spike-tall", 1, 2, "object", "큰 흑요석 가시", "tall obsidian spike", [VC("spike-tall"), VC("stalagmite")], ["가시", "spike"]),
        O("volcano-columns", "vo-columns", 2, 2, "object", "현무암 기둥 무리", "basalt columns", [VC("spike-wide")], ["기둥", "columns"]),
        O("volcano-lavafall", "vo-lavafall", 1, 3, "mount", "용암 줄기", "lava fall", [], ["용암", "lava"]),
        O("volcano-altar", "vo-altar", 3, 2, "object", "흑요석 제단", "obsidian altar", [], ["제단", "altar"]),
    ],
    extras=[E("volcano-altar", "open", 1, 1, once=True), E("volcano-lavafall", "wall", 0.5, 2), E("volcano-columns", "edge", 0.5, 2)],
    glowOf={"volcano-fire-crystal": "ember", "volcano-embers": "ember", "volcano-altar": "fire", "volcano-lavafall": "fire"},
)
MINE = dict(
    id="mine", ko="광산", types=["mine"], **NAT, bridge="plank",
    floor=["mn-floor-a", "mn-floor-b", "mn-floor-c"], faces=["mn-face-a", "mn-face-b", "mn-face-c"],
    borrow={"crag": "earth", "slab": "earth", "dark": "darkv"}, sliver="earth:4", faceGap="earth:1",
    looks=[dict(id="brown", ko="갈색 흙바위"), dict(id="grey", ko="잿빛 바위", remap={"earth": "earthb"}), dict(id="clay", ko="붉은 흙바위", remap={"earth": "earthc"})],
    objects=[
        O("mine-ore", "mn-ore", 2, 2, "object", "광석 더미", "ore heap", [MV("ore")], ["광석", "ore"], block=[[0, 1], [1, 1]]),
        O("mine-rocks", "mn-rocks", 2, 2, "object", "버럭 더미", "waste rock", [MV("slagrock")], ["버럭", "rock"], block=[[0, 1], [1, 1]]),
        O("mine-timber-frame", "mn-timber-frame", 3, 2, "mount", "갱목 틀", "timber frame", [TK("timber-frame")], ["갱목", "timber"]),
        O("mine-lamp", "mn-lamp", 2, 3, "object", "등불 기둥", "lamp post", [MV("lamp")], ["등불", "lamp"], block=[[0, 2]]),
        O("mine-ore-vein-gold", "mn-ore-vein", 2, 2, "mount", "금 광맥", "gold vein", [TK("ore-vein-gold")], ["광맥", "vein"]),
        O("mine-ore-vein-iron", "mn-ore-vein-iron", 2, 2, "mount", "철 광맥", "iron vein", [TK("ore-vein-iron")], ["광맥", "vein"]),
        O("mine-minecart", "mn-minecart", 2, 2, "object", "광차", "mine cart", [TK("minecart")], ["광차", "cart"]),
        O("mine-post", "mn-post", 1, 2, "object", "갱목 기둥", "timber prop", [TK("timber-post")], ["갱목", "prop"]),
        O("mine-tools", "mn-tools", 1, 1, "object", "곡괭이와 투구", "pickaxe and helmet", [], ["곡괭이", "pickaxe"]),
        O("mine-hoist", "mn-hoist", 3, 3, "object", "권양기", "mine hoist", [], ["권양기", "hoist"], block=[[0, 2], [1, 2], [2, 2], [0, 1], [2, 1]]),
    ],
    extras=[E("mine-hoist", "open", 1, 1, once=True), E("mine-minecart", "edge", 0.4, 1), E("mine-tools", "edge", 0.6, 2)],
    glowOf={"mine-lamp": "fire"},
)
CRYPT = dict(
    id="crypt", ko="지하묘", types=["catacomb", "labyrinth"], **BUILT, bridge="stone",
    floor=["cr-floor-a", "cr-floor-b", "cr-floor-c"], faces=["cr-wall-a", "cr-wall-b", "cr-wall-c"],
    borrow={"keep": "tomb"}, sliver="tomb:3", faceGap="tomb:1",
    looks=[dict(id="cold", ko="푸른 잿빛 돌"), dict(id="mould", ko="이끼 낀 돌", remap={"tomb": "tombb"}), dict(id="umber", ko="갈색 돌", remap={"tomb": "tombc"})],
    objects=[
        O("crypt-column", "cr-column", 1, 3, "object", "지하묘 기둥", "crypt pillar", [CC("column-cata")], ["기둥", "pillar"]),
        O("crypt-sarcophagus", "cr-sarcophagus", 2, 2, "object", "석관", "sarcophagus", [TK("sarcophagus-ew"), TK("sarcophagus-ew-open")], ["석관", "sarcophagus"], block=[[0, 1], [1, 1]]),
        O("crypt-sarcophagus-ns", "cr-sarcophagus-ns", 1, 2, "object", "세로 석관", "sarcophagus", [TK("sarcophagus-ns")], ["석관", "sarcophagus"], block=[[0, 0], [0, 1]]),
        O("crypt-sarcophagus-open", "cr-sarcophagus-open", 1, 2, "object", "열린 석관", "opened sarcophagus", [TK("sarcophagus-ns-open")], ["석관", "sarcophagus"], block=[[0, 0], [0, 1]]),
        O("crypt-banner", "cr-banner", 1, 2, "mount", "장례 깃발", "funeral banner", [SW("banner-cult")], ["깃발", "banner"]),
        O("crypt-ossuary", "cr-ossuary", 3, 2, "mount", "해골 벽", "ossuary wall", [TK("ossuary-2h"), TK("ossuary-3h")], ["해골", "ossuary"]),
        O("crypt-niche-skull", "cr-niche-skull", 1, 2, "mount", "해골 벽감", "skull niche", [CC("niche-skull"), CC("niche-urn"), CC("niche-shroud")], ["벽감", "niche"]),
        O("crypt-candelabra", "cr-candelabra", 1, 2, "object", "쇠 촛대", "iron candelabra", [TK("iron-candelabra")], ["촛대", "candelabra"]),
        O("crypt-altar", "cr-altar", 2, 2, "object", "장례 제단", "funeral altar", [CC("altar-stone")], ["제단", "altar"]),
        O("crypt-tomb-slab", "cr-tomb-slab", 2, 2, "decal", "묘석 바닥", "grave slab", [TK("tomb-slab")], ["묘석", "slab"]),
        O("crypt-angel", "cr-angel", 2, 3, "object", "슬퍼하는 천사상", "mourning angel", [TK("statue-head")], ["천사상", "angel"]),
    ],
    extras=[E("crypt-angel", "open", 1, 1, once=True), E("crypt-tomb-slab", "decal", 0.5, 1), E("crypt-ossuary", "wall", 0.3, 1)],
    glowOf={"crypt-candelabra": "ember", "crypt-niche-skull": "ember"},
)
SEWER = dict(
    id="sewer", ko="하수도", types=["sewer"], **BUILT, **WATER, water="sw-water", bridge="stone",
    floor=["sw-floor-a", "sw-floor-b", "sw-floor-c"], faces=["sw-wall-a", "sw-wall-b", "sw-wall-c"],
    borrow={"keep": "brickd", "dark": "darku", "slab": "buff", "crag": "brickd", "water": "sludge"}, sliver="buff:3", faceGap="brickd:1",
    looks=[dict(id="red", ko="붉은 벽돌"), dict(id="ochre", ko="누런 벽돌", remap={"brickd": "brickb"}), dict(id="slate", ko="잿빛 벽돌", remap={"brickd": "brickc"})],
    objects=[
        O("sewer-grate", "sw-grate", 1, 1, "decal", "배수 창살", "drain grate", [SW("grate-floor")], ["창살", "grate"]),
        O("sewer-pier", "sw-pier", 1, 3, "object", "벽돌 기둥", "brick pier", [SW("column-sewer"), CC("column-cata")], ["기둥", "pier"]),
        O("sewer-valve", "sw-valve", 1, 2, "object", "밸브 관", "valve pipe", [SW("valve-wheel")], ["밸브", "valve"]),
        O("sewer-outfall", "sw-outfall", 2, 2, "mount", "물 쏟는 아치", "outfall arch", [SW("arch-water")], ["아치", "outfall"]),
        O("sewer-bars", "sw-bars", 2, 2, "mount", "창살 굴", "barred tunnel", [SW("arch-bars")], ["창살", "bars"]),
        O("sewer-wall-lamp", "sw-wall-lamp", 1, 2, "mount", "초록 벽등", "green wall lamp", [SW("torch-wall")], ["벽등", "lamp"]),
        O("sewer-slime", "sw-slime", 1, 1, "decal", "점액", "slime", [], ["점액", "slime"]),
        O("sewer-cistern", "sw-cistern", 3, 3, "object", "큰 물통", "cistern", [], ["물통", "cistern"], block=[[x, y] for y in (1, 2) for x in range(3)]),
    ],
    extras=[E("sewer-cistern", "open", 1, 1, once=True), E("sewer-slime", "decal", 1.2, 3)],
    glowOf={"sewer-wall-lamp": "green"},
)
TOWER = dict(
    id="tower", ko="마법탑", types=["tower"], **BUILT,
    floor=["tw-floor-a", "tw-floor-b", "tw-floor-c"], faces=["tw-wall-a", "tw-wall-b", "tw-wall-c"],
    borrow={"keep": "arcane"}, sliver="lime:4", faceGap="arcane:1",
    looks=[dict(id="violet", ko="보랏빛 마름돌"), dict(id="azure", ko="쪽빛 마름돌", remap={"arcane": "arcaneb"}), dict(id="wine", ko="자줏빛 마름돌", remap={"arcane": "arcanec"})],
    objects=[
        O("tower-bookshelf", "tw-bookshelf", 2, 2, "object", "책장", "bookshelf", [TK("bookshelf")], ["책장", "bookshelf"]),
        O("tower-bookshelf-tall", "tw-bookshelf-tall", 2, 3, "object", "높은 책장", "tall bookshelf", [TK("bookshelf-tall")], ["책장", "bookshelf"]),
        O("tower-pedestal", "tw-pedestal", 1, 2, "object", "수정 받침", "crystal pedestal", [TK("crystal-pedestal")], ["수정", "crystal"]),
        O("tower-candelabra", "tw-candelabra", 1, 2, "object", "놋 촛대", "brass candelabra", [TK("candelabra")], ["촛대", "candelabra"]),
        O("tower-lectern", "tw-lectern", 1, 2, "object", "독서대", "lectern", [TK("lectern")], ["독서대", "lectern"]),
        O("tower-rug", "tw-rug", 2, 2, "decal", "별 깔개", "star rug", ["bd-pick-desert-oasis-rug"], ["깔개", "rug"]),
        O("tower-globe", "tw-globe", 1, 2, "object", "천구의", "celestial globe", ["bd-pick-wizard-tower-globe"], ["천구의", "globe"]),
        O("tower-circle", "tw-circle", 3, 3, "decal", "마법진", "magic circle", [], ["마법진", "circle"]),
        O("tower-orrery", "tw-orrery", 2, 3, "object", "혼천의", "orrery", [], ["혼천의", "orrery"]),
    ],
    extras=[E("tower-circle", "decal", 1, 1, once=True), E("tower-orrery", "open", 0.4, 1), E("tower-globe", "edge", 0.4, 1)],
    glowOf={"tower-pedestal": "spore", "tower-candelabra": "ember", "tower-circle": "crystal"},
)
CASTLE = dict(
    id="castle", ko="성", types=["castle"], **BUILT,
    floor=["ca-floor-a", "ca-floor-b", "ca-floor-c"], faces=["ca-wall-a", "ca-wall-b", "ca-wall-c"],
    borrow={}, sliver="keep:3", faceGap="keep:1",
    looks=[dict(id="grey", ko="잿빛 성돌"), dict(id="tan", ko="누런 성돌", remap={"keep": "keepb"}), dict(id="slate", ko="푸른 성돌", remap={"keep": "keepc"})],
    objects=[
        O("castle-column", "ca-column", 1, 3, "object", "성 기둥", "castle pier", [CC("column-cata")], ["기둥", "pier"]),
        O("castle-banner", "ca-banner", 1, 2, "mount", "붉은 깃발", "royal banner", [TK("royal-banner"), SW("banner-cult")], ["깃발", "banner"]),
        O("castle-armor", "ca-armor", 1, 2, "object", "갑옷", "suit of armour", [TK("armor-stand")], ["갑옷", "armour"]),
        O("castle-throne", "ca-throne", 1, 2, "object", "옥좌", "throne", [TK("throne")], ["옥좌", "throne"]),
        O("castle-weapon-rack", "ca-weapon-rack", 2, 2, "object", "무기 걸이", "weapon rack", [], ["무기", "weapons"]),
        O("castle-carpet", "ca-carpet", 2, 2, "decal", "붉은 융단", "red carpet", [], ["융단", "carpet"]),
    ],
    extras=[E("castle-carpet", "run", 1, 1, once=True), E("castle-weapon-rack", "edge", 0.4, 2), E("castle-armor", "edge", 0.5, 2)],
)
PYRAMID = dict(
    id="pyramid", ko="피라미드", types=["pyramid"], **BUILT,
    floor=["py-floor-a", "py-floor-b", "py-floor-c"], faces=["py-wall-a", "py-wall-b", "py-wall-c"],
    borrow={"keep": "sandst", "dark": "darkv"}, sliver="sandst:3", faceGap="sandst:1",
    looks=[dict(id="gold", ko="금빛 사암"), dict(id="rose", ko="붉은 사암", remap={"sandst": "sandstb"}), dict(id="pale", ko="흰 석회암", remap={"sandst": "sandstc"})],
    objects=[
        O("pyramid-column", "py-column", 1, 3, "object", "갈대 기둥", "papyrus column", [TP("column-temple")], ["기둥", "column"]),
        O("pyramid-sarcophagus", "py-sarcophagus", 1, 2, "object", "선 관", "upright sarcophagus", [TK("pharaoh-sarcophagus")], ["관", "sarcophagus"]),
        O("pyramid-jars", "py-jars", 2, 2, "object", "단지 넷", "canopic jars", ["bd-pick-desert-oasis-jars"], ["단지", "jars"], block=[[0, 1], [1, 1]]),
        O("pyramid-obelisk", "py-obelisk", 1, 3, "object", "오벨리스크", "obelisk", [TK("obelisk")], ["오벨리스크", "obelisk"]),
        O("pyramid-sand", "py-sand", 1, 1, "decal", "모래 더미", "sand drift", [TK("sand-drift"), TK("sand-drift-2")], ["모래", "sand"]),
        O("pyramid-gold", "py-gold", 2, 1, "object", "금 더미", "gold pile", [TK("gold-pile")], ["금", "gold"]),
        O("pyramid-scarab", "py-scarab", 1, 2, "object", "풍뎅이 상", "scarab statue", [TK("scarab-statue")], ["풍뎅이", "scarab"]),
        O("pyramid-jackal", "py-jackal", 1, 2, "object", "자칼 상", "jackal statue", [TK("jackal-statue")], ["자칼", "jackal"]),
        O("pyramid-sphinx", "py-sphinx", 3, 2, "object", "스핑크스", "sphinx", [], ["스핑크스", "sphinx"]),
    ],
    extras=[E("pyramid-sphinx", "open", 1, 1, once=True), E("pyramid-jackal", "edge", 0.5, 2), E("pyramid-sand", "decal", 1.0, 3)],
)
SUNKEN = dict(
    id="sunken", ko="가라앉은 신전", types=["temple+flooded"], **BUILT, **WATER, water="cv-water2", inherit="ruin", bridge="stone",
    floor=["su-floor-a", "su-floor-b", "su-floor-c"], faces=["su-wall-a", "su-wall-b", "su-wall-c"],
    borrow={"keep": "marble", "dark": "darku", "slab": "marble", "crag": "marble", "water": "teal"}, sliver="marble:4", faceGap="marble:1",
    looks=[dict(id="sea", ko="옥빛 대리석"), dict(id="coral", ko="산호빛 대리석", remap={"marble": "marbleb"}), dict(id="deep", ko="쪽빛 대리석", remap={"marble": "marblec"})],
    objects=[
        O("sunken-column", "su-column", 1, 3, "object", "따개비 낀 기둥", "sea-worn column", [TP("column-temple"), CC("column-cata")], ["기둥", "column"]),
        O("sunken-coral", "su-coral", 1, 1, "object", "산호", "coral", [SW("skulls")], ["산호", "coral"]),
        O("sunken-shell", "su-shell", 1, 1, "object", "빛나는 조개", "glowing shell", [SW("candles")], ["조개", "shell"]),
        O("sunken-weed", "su-weed", 1, 1, "decal", "바닷말", "sea weed", [TP("rubble-temple"), SW("bones"), TK("overgrown")], ["바닷말", "weed"]),
        O("sunken-amphora", "su-amphora", 1, 1, "object", "쓰러진 항아리", "amphora", [SW("crate"), SW("barrel")], ["항아리", "amphora"]),
        O("sunken-trident", "su-trident", 1, 2, "object", "청동 삼지창", "trident", [TP("column-temple-broken")], ["삼지창", "trident"]),
        O("sunken-statue", "su-statue", 2, 3, "object", "바다에 삭은 석상", "sea-worn statue", [TK("statue-head")], ["석상", "statue"]),
        O("sunken-fountain", "su-fountain", 3, 3, "object", "조개 분수", "shell fountain", [], ["분수", "fountain"], block=[[x, y] for y in (1, 2) for x in range(3)]),
    ],
    extras=[E("sunken-fountain", "open", 1, 1, once=True), E("sunken-coral", "edge", 0.8, 3), E("sunken-trident", "edge", 0.3, 1)],
    glowOf={"sunken-shell": "spore"},
)
HIDEOUT = dict(
    id="hideout", ko="도적 소굴", types=["cave+lair"], inherit="cave",
    **{k: CAVE[k] for k in ("floor", "faces", "top", "topRamps", "rimS", "rimW", "sliver", "faceGap", "shore", "shoreIn")}, water="cv-water2", bridge="plank",
    looks=CAVE["looks"],
    objects=[
        O("hideout-tent", "hd-tent", 3, 2, "object", "가죽 천막", "hide tent", ["bd-dg-goblin-tent"], ["천막", "tent"], block=[[x, y] for y in (0, 1) for x in range(3)]),
        O("hideout-hide-rack", "hd-hide-rack", 2, 2, "object", "가죽 걸이", "hide rack", ["bd-pick-deep-forest-path-hide-rack"], ["가죽", "hide"]),
        O("hideout-loot", "hd-loot", 1, 1, "object", "노획물", "loot", ["bd-dg-goblin-loot"], ["노획물", "loot"]),
        O("hideout-bones", "hd-bones", 1, 1, "decal", "먹다 남은 뼈", "gnawed bones", ["bd-dg-goblin-bones"], ["뼈", "bones"]),
        O("hideout-campfire", "hd-campfire", 1, 1, "object", "솥 건 모닥불", "cooking fire", ["bd-dg-goblin-campfire"], ["모닥불", "fire"]),
        O("hideout-weapon-rack", "hd-weapon-rack", 2, 2, "object", "무기 걸이", "weapon rack", [], ["무기", "weapons"]),
        O("hideout-table", "hd-table", 2, 2, "object", "지도 탁자", "map table", [], ["탁자", "table"]),
        O("hideout-cage", "hd-cage", 2, 2, "object", "쇠 우리", "iron cage", [], ["우리", "cage"]),
        O("hideout-platform", "hd-platform", 3, 2, "decal", "널 마루", "plank platform", [], ["마루", "platform"]),
        O("hideout-banner", "hd-banner", 1, 2, "mount", "붉은 누더기 깃발", "ragged flag", ["bd-pick-walled-market-banner-red"], ["깃발", "flag"]),
        O("hideout-chief-seat", "hd-chief-seat", 2, 3, "object", "두목 자리", "chief's seat", [], ["자리", "seat"]),
    ],
    extras=[E("hideout-chief-seat", "edge", 1, 1, once=True), E("hideout-platform", "decal", 0.6, 2), E("hideout-table", "open", 0.4, 1), E("hideout-cage", "edge", 0.3, 1), E("hideout-weapon-rack", "edge", 0.4, 1)],
    glowOf={"hideout-campfire": "ember", "hideout-table": "ember"},
)
CAVE.update(water="cv-water2", bridge="plank")
RUIN.update(stagger=True, deepFull=True, rimPhases=2)   # 수풀 윗면: 덩이 줄을 어긋나게, 깊은 곳도 온 판으로(32px 되풀이가 수풀 격자로 보였다)

# 계단: 지은 곳은 문목 계단·네모 계단 구멍, 굴은 거친 구멍 — 벽 색 줄(올라감)·바닥 색 줄(내려감)로 옮겨 굽는다
def _stairs(kind, up=None, down=None): return dict(up=f"st-up-{kind}", down=f"st-down-{kind}", upRemap={("keep" if kind == "built" else "crag"): up} if up else {}, downRemap={("keep" if kind == "built" else "slab"): down} if down else {})
for _th, _st in ((CAVE, _stairs("rock")), (HIDEOUT, _stairs("rock")), (RUIN, _stairs("built", "buff", "lime")), (ICE, _stairs("rock", "frost", "snow")), (VOLCANO, _stairs("rock", "basalt", "basalt")), (MINE, _stairs("rock", "earth", "earth")),
                 (CRYPT, _stairs("built", "tomb", "tomb")), (SEWER, _stairs("built", "brickd", "buff")), (TOWER, _stairs("built", "arcane", "lime")), (CASTLE, _stairs("built")), (PYRAMID, _stairs("built", "sandst", "sandst")), (SUNKEN, _stairs("built", "marble", "marble"))):
    _th["stairs"] = _st
# 바닥 판 셋(a·b·c)은 조용한 판(c)을 절반 — 눈에 띄는 무늬(빙판·묘석·모래 더미)가 격자로 늘어서지 않게
for _th in (ICE, VOLCANO, MINE, CRYPT, SEWER, TOWER, CASTLE, PYRAMID, SUNKEN): _th["floorWeights"] = [0.27, 0.23, 0.5]

THEMES = [CAVE, RUIN, ICE, VOLCANO, MINE, CRYPT, SEWER, TOWER, CASTLE, PYRAMID, SUNKEN, HIDEOUT]
# 겉모습 둘째 색·벽 너머 어둠의 물든 색은 그린 색 줄에서 코드로 끌어낸다(OKLCH 색상·채도만 — 화소 모양은 그대로). 정본 색 줄은 ramps.json 의 ramps, 끌어낸 것은 derived 에 적힌다.
DERIVED = dict(
    frostb=("frost", 185, 1.15, 0.0), basaltb=("basalt", 30, 2.2, 0.015), earthb=("earth", 250, 0.35, 0.0), tombb=("tomb", 150, 1.6, 0.01), brickb=("brickd", 85, 0.9, 0.03),
    arcaneb=("arcane", 245, 1.1, 0.0), keepb=("keep", 75, 2.4, 0.01), sandstb=("sandst", 35, 1.15, -0.01), marbleb=("marble", 40, 1.0, 0.0),
    cragc=("crag", 140, 0.7, 0.0), buffc=("buff", 30, 1.3, -0.01), frostc=("frost", 290, 1.0, 0.0), basaltc=("basalt", 290, 1.4, 0.02), earthc=("earth", 35, 1.35, 0.0), tombc=("tomb", 65, 1.8, 0.01),
    brickc=("brickd", 250, 0.45, 0.0), arcanec=("arcane", 5, 1.0, 0.0), keepc=("keep", 250, 2.6, 0.0), sandstc=("sandst", 90, 0.4, 0.035), marblec=("marble", 240, 1.2, -0.01),
    wisp=("fire", 240, 0.75, 0.03),
    darki=("dark", 255, 2.2, 0.0), darkv=("dark", 40, 2.2, 0.0), darku=("dark", 195, 2.2, 0.0),
)


def _derive(ramps):
    import math
    lin = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    unlin = lambda v: 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
    def to_lab(h):
        r, g, b = (lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))
        l, m, s = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3), (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3), (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
        return 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    def to_hex(L, a, b):
        l, m, s = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
        rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
        return "#" + "".join(f"{max(0, min(255, round(unlin(max(0.0, min(1.0, v))) * 255))):02x}" for v in rgb)
    out = {}
    for name, (src, hue, cm, dl) in DERIVED.items():
        row = []
        for h in ramps[src]:
            L, a, b = to_lab(h); c = max(math.hypot(a, b) * cm, 0.012 * cm); t = math.radians(hue)
            row.append(to_hex(max(0.0, min(1.0, L + dl)), c * math.cos(t), c * math.sin(t)))
        assert len(set(row)) == len(row), (name, row)
        out[name] = row
    return out


# 그리는 중(개발)에는 조각이 아직 없는 주제를 건너뛴다 — DGN_DEV=1 일 때만. 정식 굽기는 모든 조각이 있어야 한다.
import os
def _pieces(th): return [*([th["stairs"]["up"], th["stairs"]["down"]] if th.get("stairs") else []), *([f"br-{th['bridge']}-{d}" for d in ("ew", "ns")] if th.get("bridge") else []), *th["floor"], *th["faces"], *th["top"], th["rimS"], th["rimW"], *([th["shore"], th["shoreIn"]] if th.get("shore") else []), *([th["water"]] if th.get("water") else []), *[o["src"] for o in th["objects"]]]
_missing = {th["id"]: [p for p in _pieces(th) if not (ROOT / "tiledata/beodeul-dungeon/fable/pieces" / f"{p}.png").exists()] for th in THEMES}
if any(_missing.values()):
    if not os.environ.get("DGN_DEV"): raise SystemExit(f"조각이 없다: { {k: v for k, v in _missing.items() if v} }")
    print("건너뜀(조각 없음):", {k: len(v) for k, v in _missing.items() if v})
    THEMES = [th for th in THEMES if not _missing[th["id"]] and not _missing.get(th.get("inherit"), [])]

RAMPS_PATH = ROOT / "tiledata/beodeul-dungeon/fable/ramps.json"
_r = json.loads(RAMPS_PATH.read_text(encoding="utf-8"))
_base = {k: v for k, v in _r["ramps"].items() if k not in _r.get("derived", {}) and k not in DERIVED}
_d = _derive(_base)
_r["ramps"] = {**_base, **_d}; _r["derived"] = {k: dict(source=v[0], hue=v[1], chroma=v[2], lightness=v[3]) for k, v in DERIVED.items()}
RAMPS_PATH.write_text(json.dumps(_r, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
TERRAIN = {p for th in THEMES for p in [*([th["stairs"]["up"], th["stairs"]["down"]] if th.get("stairs") else []), *([f"br-{th['bridge']}-{d}" for d in ("ew", "ns")] if th.get("bridge") else []), *th["floor"], *th["faces"], *th["top"], th["rimS"], th["rimW"], *([th["shore"], th["shoreIn"]] if th.get("shore") else []), *([th["water"]] if th.get("water") else [])]}
# 관문 종류(면제는 화소 해시와 종류에 묶인다): 지형 조각 terrain · 바닥 그림 flat · 벽걸이 wall_mounted · 서 있는 기물 other
KINDS = {p: "terrain" for p in sorted(TERRAIN)}
for _grp in [SHARED, *THEMES]:
    for _o in _grp["objects"]: KINDS.setdefault(_o["src"], {"decal": "flat", "mount": "wall_mounted"}.get(_o["cls"], "other"))
(ROOT / "tiledata/beodeul-dungeon/fable/waive-manifest.json").write_text(json.dumps(dict(items=[dict(png=f"tiledata/beodeul-dungeon/fable/pieces/{p}.png", kind=k, label=f"beodeul_dungeons/{p}", chipset="beodeul_city") for p, k in sorted(KINDS.items())]), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
SPEC = dict(
    _doc="scripts/content/beodeul-dungeons/make_spec.py 가 쓴다 — 손으로 고치지 않는다.",
    license="CC0-1.0 (own work, drawn by Claude Fable 5.2 medium one-shot for this project)",
    waiver="fable-dungeons-beodeul-2026-11-15",
    lookNames={"ember": {"label": "던전 첫째 색"}, "frost": {"label": "던전 둘째 색"}, "dusk": {"label": "던전 셋째 색"}},
    kinds=KINDS,
    glows=GLOWS, shared=SHARED, themes=THEMES,
)
OUT.write_text(json.dumps(SPEC, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print("themes", [t["id"] for t in THEMES], "objects", len(SHARED["objects"]) + sum(len(t["objects"]) for t in THEMES))
