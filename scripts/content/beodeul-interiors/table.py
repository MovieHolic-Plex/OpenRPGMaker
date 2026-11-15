"""버들항 실내 — 표(벽·바닥·테두리·가구·탁상 물건·바깥 기물 재사용). prepare.py 와 bake.py 가 읽는다.
새 항목은 각 목록의 **끝에** 더한다(칸 번호가 순서로 정해진다).

가구 줄: (id, 원본, 종류, 폭, 발밑 줄 수, 갈래, 이름, 방 태그, 관문 종류, 선택)
  원본 = raw/<이름>.png 또는 (이름, x, y, w, h) 로 한 장에서 잘라 낸 조각.
  종류 floor(바닥에 선 것) · wall(북벽 앞에 선 것) · hang(벽면에 건 것 — 발밑 0, rows 줄) · flat(밟는 무늬).
  선택: rows(hang 줄 수) · oy(hang 위 여백) · use · pair · stairs · halo(불빛 번짐) · noshadow · remap · desc
"""
CATS = dict(tavern="주점", home="살림집", shop="가게", kitchen="부엌", store="창고", smith="대장간", bake="빵집", office="회관·사무실", church="예배당",
            farm="농가·마구간", mill="방앗간", fisher="어부 집", guard="경비실", manor="저택", light="불빛", rug="깔개", stairs="계단", craft="일터")

# id 는 손 도트 실내 v5 가 이미 쓰는 낱말을 빌린다(plaster·rubble·log·dplank·plank·flag·default·rock …) — 방 짓기 도구의 바닥·벽면·천장 enum 과 v5 견본의 재질 이름이 그대로 통한다(모델이 읽는 글이 늘지 않는다).
# ── 벽면(48×32 한 칸 폭 3열) · 바닥 · 테두리 ────────────────────────────────────────────
WALLS = [  # (id, raw, 이름, 맞는 바깥 양식)
    ("plaster", "wall-ht", "목골 회벽 + 판자 징두리", ["halftimber"]),
    ("rubble", "wall-rs", "막돌 벽 + 참나무 들보", ["halftimber"]),
    ("log", "wall-log", "통나무 벽", ["log"]),
    ("stablew", "wall-plank", "세로 널벽", ["log", "tarshed"]),
    ("stone", "wall-cream", "크림 돌벽 + 회색 굽도리", ["harbourstone", "whitecube"]),
    ("grey", "wall-ashlar", "다듬은 회색 돌벽", ["violetslate"]),
    ("slumw", "wall-brick", "붉은 벽돌 벽", ["violetslate"]),
    ("hobbitw", "wall-daub", "흙벽(욋가지)", ["roundhut", "turf"]),
]
# remap: (색 줄, {옛 단: 새 단}) 또는 (옛 줄, 새 줄, {옛 단: 새 단}) — 색 줄 안에서만 옮긴다.  vary: 널 한 장마다 한 단 어둡게(널 줄 표)
FLOORS = [  # (id, raw, 이름, 선택)
    ("dplank", "floor-oak", "넓은 참나무 널", dict(remap=[("plank", {5: 4, 4: 3, 3: 2, 2: 1, 1: 0})], vary=[(0, 7), (8, 15), (16, 23), (24, 31)], period=(8, 4))),
    ("plank", "floor-pine", "밝은 가게 널", dict(remap=[("board", "cream", {5: 4, 4: 3, 3: 2, 2: 1, 1: 0, 0: 0})], vary=[(0, 5), (6, 12), (13, 18), (19, 25), (26, 31)], period=(8, 4))),
    ("flag", "floor-flag", "판석", dict(remap=[("stone", "buff", {7: 5, 6: 5, 5: 4, 4: 3, 3: 2, 2: 1, 1: 1, 0: 0})])),   # 보랏빛 줄눈을 빼고 회갈색 돌 줄로 — 참나무 널 곁에서 뜨지 않게(감독 2026-11-15)
    ("ovenf", "floor-brick", "벽돌 바닥(헤링본)", {}),
    ("earth", "floor-earth", "다진 흙 + 짚", {}),
    ("parquet", "floor-parquet", "쪽마루", dict(remap=[("board", {3: 2, 2: 1, 0: 0})])),
    ("grey", "floor-slab", "회색 큰 판석", {}),
]
EDGES = [("default", "edge", "참나무 벽 윗면"), ("rock", "edge-stone", "막돌 벽 윗면"), ("gold", "edge-cream", "크림 돌 벽 윗면")]
# 바깥 집 양식 → 견본의 «집 벽» 두 가지(plaster = 그 집의 벽, rubble = 그 집의 돌 아래층·불 방)를 그 양식에서 무엇으로 세우나.
# 통나무·널집·흙집의 불 방과 돌 창고는 막돌 그대로(나무 벽 곁에 불을 두지 않는다). 양식 태그가 없는 원본 버들항 집은 목골(바꾸지 않는다).
STYLE_WALLS = dict(halftimber=dict(plaster="plaster", rubble="rubble"), log=dict(plaster="log", rubble="rubble"), tarshed=dict(plaster="stablew", rubble="rubble"),
                   harbourstone=dict(plaster="stone", rubble="stone"), whitecube=dict(plaster="stone", rubble="stone"), violetslate=dict(plaster="grey", rubble="grey"),
                   roundhut=dict(plaster="hobbitw", rubble="rubble"), turf=dict(plaster="hobbitw", rubble="rubble"))
# 벽면 → 테두리
WALL_EDGE = dict(plaster="default", log="default", stablew="default", hobbitw="default", rubble="rock", grey="rock", slumw="rock", stone="gold")

def sheet(name, cell, w=1, rows=1): return (name, cell * 16, 0, w * 16, rows * 16)

OBJECTS = [
    # ── 주점·여관 홀 ──
    ("bar counter", "bar", "floor", 4, 1, "tavern", "바 카운터(널판 앞면·놋쇠 발걸이)", ["주점", "여관", "바"], "low_furniture", dict(use=["counter"], pair=["bar stool", "ale kegs rack"])),
    ("bar plank", "bar-plank", "floor", 3, 1, "tavern", "통 위 널 바", ["주점", "여관", "바"], "low_furniture", dict(use=["counter"], pair=["bar stool"])),
    ("ale kegs rack", "kegrack", "wall", 2, 1, "tavern", "술통 선반(꼭지 달린 통 넷)", ["주점", "술 창고"], "frame", dict(remap=[("glass", "timber", {0: 0, 1: 1, 2: 1})])),
    ("ale tun", "tun", "wall", 2, 1, "tavern", "큰 술통(받침 위)", ["주점", "양조장", "술 창고"], "round_body", {}),
    ("bottle shelf", "shelf-bottles", "hang", 2, 0, "tavern", "병·잔 선반", ["주점", "부엌"], "wall_mounted", dict(oy=1)),
    ("great fireplace", "fireplace", "wall", 3, 1, "tavern", "큰 돌 벽난로", ["주점", "여관", "저택", "거실"], "structure", dict(use=["light"], pair=["hearth glow", "firewood"], desc="벽난로")),
    ("brick fireplace", "fireplace-brick", "wall", 3, 1, "tavern", "벽돌 아치 벽난로", ["주점", "여관", "거실"], "structure", dict(use=["light"], pair=["hearth glow", "firewood"], desc="벽난로")),
    ("long table", "table-long", "floor", 3, 2, "tavern", "차린 긴 식탁", ["주점", "식당"], "low_furniture", dict(pair=["bench"])),
    ("round table", "table-round", "floor", 2, 1, "tavern", "둥근 탁자(카드·촛불)", ["주점", "거실"], "low_furniture", dict(pair=["chair", "stool"])),
    ("bench", "bench", "floor", 3, 1, "tavern", "긴 널 걸상", ["주점", "식당", "대기실"], "seat", dict(use=["sit"])),
    ("stool", "stool", "floor", 1, 1, "tavern", "세 발 걸상", ["주점", "부엌", "일터"], "seat", dict(use=["sit"])),
    ("chair", "chair", "floor", 1, 1, "home", "등받이 의자(앞 보기)", ["거실", "침실", "주점"], "seat", dict(use=["sit"])),
    ("chair back", "chair-n", "floor", 1, 1, "home", "등받이 의자(뒤 보기 — 탁자 남쪽에)", ["거실", "주점"], "seat", dict(use=["sit"], facing="N")),
    ("antlers", "antlers", "hang", 2, 0, "tavern", "사슴뿔 장식", ["주점", "사냥꾼 집"], "wall_mounted", dict(oy=1)),
    ("target board", ("trophy", 0, 0, 16, 16), "hang", 1, 0, "tavern", "과녁판", ["주점"], "wall_mounted", {}),
    ("tally slate", ("trophy", 16, 0, 16, 16), "hang", 1, 0, "tavern", "외상 석판", ["주점", "가게"], "wall_mounted", {}),
    ("key board", ("trophy", 32, 0, 16, 16), "hang", 1, 0, "tavern", "객실 열쇠 걸이판", ["여관"], "wall_mounted", {}),
    # ── 살림집 ──
    ("cooking hearth", "hearth", "wall", 2, 1, "home", "살림집 화덕(솥 걸이)", ["거실", "부엌", "농가"], "structure", dict(use=["light"], pair=["hearth glow"], desc="벽난로 화덕")),
    ("quilt bed", "bed", "floor", 2, 2, "home", "조각 이불 침대", ["침실", "거실"], "low_furniture", dict(use=["sleep"], pair=["nightstand", "chest"])),
    ("green bed", "bed-green", "floor", 2, 2, "home", "초록 담요 침대", ["침실", "농가"], "low_furniture", dict(use=["sleep"], pair=["nightstand", "chest"])),
    ("inn bed", "inn-bed", "floor", 2, 2, "home", "객실 침대(붉은 담요)", ["객실", "침실"], "low_furniture", dict(use=["sleep"], pair=["nightstand"])),
    ("cradle", "cradle", "floor", 1, 1, "home", "요람", ["침실", "거실"], "low_furniture", {}),
    ("dresser", "cupboard", "wall", 2, 1, "home", "접시 찬장", ["거실", "부엌"], "frame", dict(use=["search"])),
    ("laid table", "table-small", "floor", 2, 1, "home", "차린 작은 식탁", ["거실", "부엌"], "low_furniture", dict(pair=["chair", "chair back"])),
    ("plain table", "table-plain", "floor", 2, 1, "home", "빈 참나무 탁자", ["거실", "경비실", "일터"], "low_furniture", dict(pair=["chair"], surface=1)),
    ("chest", "chest", "floor", 2, 1, "home", "쇠띠 궤", ["침실", "거실", "창고"], "container", dict(use=["open"])),
    ("rocking chair", "rocking", "floor", 1, 1, "home", "흔들의자", ["거실"], "seat", dict(use=["sit"])),
    ("spinning wheel", "spinwheel", "floor", 2, 1, "home", "물레와 양털 바구니", ["거실", "직조"], "frame", {}),
    ("settle", "settle", "floor", 2, 1, "home", "등받이 높은 장의자", ["거실", "대기실", "주점"], "seat", dict(use=["sit"])),
    ("wardrobe", "wardrobe", "wall", 2, 1, "home", "옷장", ["침실", "객실"], "box", dict(use=["search"])),
    ("washstand", "washstand", "floor", 1, 1, "home", "세숫대야 받침", ["침실", "객실"], "low_furniture", {}),
    ("bookcase", "bookcase", "wall", 2, 1, "home", "책장", ["서재", "사무실", "거실", "저택"], "frame", dict(use=["read"])),
    ("nightstand", "nightstand", "floor", 1, 1, "home", "협탁과 촛불", ["침실", "객실"], "low_furniture", dict(use=["light"])),
    ("writing desk", "desk", "floor", 2, 1, "home", "작은 책상", ["객실", "서재", "침실"], "low_furniture", dict(pair=["chair back"])),
    ("window", "window", "hang", 1, 0, "home", "창", ["거실", "침실", "주점", "가게"], "wall_mounted", dict(rows=2, oy=4, pair=["window light"])),
    ("curtain window", ("wall-small", 0, 0, 16, 32), "hang", 1, 0, "home", "커튼 단 창", ["침실", "객실", "거실"], "wall_mounted", dict(rows=2, oy=3, pair=["window light"])),
    ("mirror", ("wall-small", 16, 0, 16, 32), "hang", 1, 0, "home", "둥근 거울", ["침실", "객실"], "wall_mounted", dict(rows=2, oy=3)),
    ("coat pegs", ("wall-small", 32, 0, 16, 32), "hang", 1, 0, "home", "옷걸이 못(망토·모자)", ["거실", "객실", "주점"], "wall_mounted", dict(rows=2, oy=3)),
    ("jar shelf", ("wall-small", 48, 0, 16, 32), "hang", 1, 0, "home", "단지 선반과 약초", ["부엌", "거실"], "wall_mounted", dict(rows=2, oy=3)),
    ("tapestry", "tapestry", "hang", 1, 0, "home", "벽걸이 천", ["거실", "침실", "저택"], "wall_mounted", dict(rows=2, oy=3)),
    # ── 가게 ──
    ("goods shelf", "shopshelf", "wall", 3, 1, "shop", "잡화 진열 선반", ["잡화점", "가게"], "frame", {}),
    ("shop counter", "shop-counter", "floor", 3, 1, "shop", "판매대(저울·장부·돈통)", ["잡화점", "가게", "무기점"], "low_furniture", dict(use=["counter"])),
    ("peg rail goods", "hang-goods", "hang", 3, 0, "shop", "걸어 둔 물건(밧줄·등·냄비)", ["잡화점", "가게"], "wall_mounted", dict(oy=1)),
    ("produce bins", "bins", "floor", 2, 1, "shop", "사과·감자·양파 궤", ["잡화점", "가게", "창고"], "container", {}),
    ("sack pile", "sacks", "floor", 2, 1, "shop", "자루 더미", ["잡화점", "창고", "방앗간", "빵집"], "container", {}),
    ("display table", "display-table", "floor", 2, 1, "shop", "물건 늘어놓은 진열 탁자", ["잡화점", "가게"], "low_furniture", {}),
    ("weapon rack", "weapon-rack", "wall", 2, 1, "shop", "무기 걸이(검·도끼·창)", ["무기점", "대장간", "경비실", "무기고"], "frame", {}),
    ("armor stand", "armor-stand", "floor", 1, 1, "shop", "갑옷 걸이", ["무기점", "경비실", "저택"], "figure", {}),
    ("herb rail", "herb-rack", "hang", 3, 0, "shop", "말리는 약초 줄", ["약방", "부엌"], "wall_mounted", dict(oy=1)),
    # ── 부엌 ──
    ("kitchen range", "range", "wall", 3, 1, "kitchen", "부엌 큰 화덕(꼬치·솥)", ["부엌"], "structure", dict(use=["light"], pair=["hearth glow"])),
    ("work table", "worktable", "floor", 2, 1, "kitchen", "조리대(도마·채소)", ["부엌"], "low_furniture", {}),
    ("pot rail", "pot-rack", "hang", 3, 0, "kitchen", "걸어 둔 냄비·햄·마늘", ["부엌"], "wall_mounted", dict(oy=1)),
    ("stone sink", "sink", "floor", 2, 1, "kitchen", "돌 개수대와 접시", ["부엌"], "low_furniture", {}),
    # ── 창고·지하 ──
    ("crate stack", "crates", "floor", 2, 1, "store", "상자 더미", ["창고", "지하"], "box", {}),
    ("wine rack", "wine-rack", "wall", 2, 1, "store", "포도주 선반", ["지하", "술 창고", "창고"], "frame", {}),
    ("pantry shelf", "jar-shelf", "wall", 2, 1, "store", "식료 선반(단지·치즈)", ["창고", "부엌", "식료"], "frame", {}),
    ("ladder", "ladder", "wall", 1, 1, "store", "사다리", ["창고", "헛간", "방앗간"], "frame", {}),
    # ── 대장간 ──
    ("forge", "forge", "wall", 3, 1, "smith", "대장간 화덕과 풀무", ["대장간"], "structure", dict(use=["light"], pair=["hearth glow", "anvil"])),
    ("anvil", "anvil", "floor", 1, 1, "smith", "모루", ["대장간"], "other", {}),
    ("tool rail", "tool-rack", "hang", 3, 0, "smith", "연장 걸이", ["대장간", "일터"], "wall_mounted", dict(oy=1)),
    ("workbench", "workbench", "floor", 2, 1, "smith", "작업대(바이스)", ["대장간", "일터"], "low_furniture", {}),
    # ── 빵집 ──
    ("bread oven", "oven", "wall", 3, 1, "bake", "빵 화덕", ["빵집"], "structure", dict(use=["light"], pair=["hearth glow"])),
    ("bread shelf", "bread-shelf", "wall", 2, 1, "bake", "빵 선반", ["빵집"], "frame", {}),
    ("kneading table", "knead-table", "floor", 2, 1, "bake", "반죽대", ["빵집", "부엌"], "low_furniture", {}),
    ("bakery counter", "bakery-counter", "floor", 3, 1, "bake", "빵집 판매대", ["빵집"], "low_furniture", dict(use=["counter"])),
    # ── 회관·사무실 ──
    ("clerk desk", "clerk-desk", "floor", 3, 1, "office", "서기 책상(장부·종)", ["사무실", "회관", "세관", "교실"], "low_furniture", dict(use=["counter"], pair=["high chair"])),
    ("scroll shelf", "scroll-shelf", "wall", 2, 1, "office", "문서 선반(두루마리)", ["사무실", "회관", "서재"], "frame", dict(use=["read"])),
    ("high chair", "high-chair", "floor", 1, 1, "office", "등받이 높은 의자", ["사무실", "저택", "식당"], "seat", dict(use=["sit"])),
    ("strongbox", "strongbox", "floor", 2, 1, "office", "금고 궤와 돈주머니", ["사무실", "보물", "세관"], "container", dict(use=["open"])),
    ("notice board", ("wall-office", 0, 0, 24, 32), "hang", 2, 0, "office", "게시판", ["사무실", "회관", "주점"], "wall_mounted", dict(rows=2, oy=2, use=["read"])),
    ("wall map", ("wall-office", 24, 0, 24, 32), "hang", 2, 0, "office", "벽 지도", ["사무실", "서재", "등대"], "wall_mounted", dict(rows=2, oy=2)),
    ("banner", ("wall-office", 48, 0, 16, 32), "hang", 1, 0, "office", "깃발", ["회관", "저택", "경비실"], "wall_mounted", dict(rows=2, oy=2)),
    # ── 예배당 ──
    ("altar", "altar", "floor", 3, 1, "church", "제단", ["예배당"], "low_furniture", {}),
    ("pew", "pew", "floor", 2, 1, "church", "예배당 장의자(뒤 보기)", ["예배당"], "seat", dict(use=["sit"], facing="N")),
    ("candelabrum", "candle-stand", "floor", 1, 1, "church", "큰 촛대", ["예배당", "저택"], "column", dict(use=["light"], halo=1)),
    ("lectern", "lectern", "floor", 1, 1, "church", "독경대", ["예배당", "교실"], "low_furniture", dict(use=["read"])),
    ("stained window", ("wall-chapel", 0, 0, 18, 32), "hang", 1, 0, "church", "색유리 창", ["예배당"], "wall_mounted", dict(rows=2, cx=1, pair=["window light"])),
    ("statue niche", ("wall-chapel", 19, 0, 16, 32), "hang", 1, 0, "church", "성상 벽감", ["예배당"], "wall_mounted", dict(rows=2)),
    ("offering box", ("wall-chapel", 35, 0, 13, 32), "hang", 1, 0, "church", "헌금함", ["예배당"], "wall_mounted", dict(rows=2)),
    # ── 그 밖 ──
    ("millstones", "millstones", "floor", 3, 2, "mill", "맷돌과 깔때기", ["방앗간"], "structure", {}),
    ("stable stall", "stall", "wall", 2, 1, "farm", "마구간 칸(여물 시렁·구유)", ["마구간", "헛간"], "frame", {}),
    ("net rail", "net-rack", "hang", 3, 0, "fisher", "그물·말린 생선 걸이", ["어부 집", "배 창고"], "wall_mounted", dict(oy=1)),
    ("cot", "cot", "floor", 2, 1, "guard", "낮은 침상", ["경비실", "감옥", "등대", "객실"], "low_furniture", dict(use=["sleep"])),
    ("spear stand", "spear-stand", "floor", 1, 1, "guard", "창 세움과 방패", ["경비실", "무기고"], "frame", {}),
    ("dining table", "dining-table", "floor", 4, 1, "manor", "저택 긴 식탁(은 촛대)", ["저택", "식당"], "low_furniture", dict(pair=["high chair"])),
    ("canopy bed", "canopy-bed", "floor", 2, 2, "manor", "캐노피 침대", ["저택", "침실"], "low_furniture", dict(use=["sleep"])),
    ("portrait", ("wall-manor", 0, 0, 17, 32), "hang", 1, 0, "manor", "초상화", ["저택", "사무실"], "wall_mounted", dict(rows=2, cx=1)),
    ("crossed swords", ("wall-manor", 17, 0, 17, 32), "hang", 1, 0, "manor", "방패와 엇건 검", ["저택", "경비실", "주점"], "wall_mounted", dict(rows=2, cx=1)),
    ("wall clock", ("wall-manor", 35, 0, 13, 32), "hang", 1, 0, "manor", "벽시계", ["저택", "사무실", "거실"], "wall_mounted", dict(rows=2)),
    # ── 불빛 ──
    ("sconce", "sconce", "hang", 2, 0, "light", "벽 촛대", ["주점", "거실", "복도"], "wall_mounted", dict(rows=2, oy=4, halo=1, use=["light"])),
    ("wall lantern", ("lamps", 0, 0, 16, 32), "hang", 2, 0, "light", "벽 등", ["가게", "창고", "마구간"], "wall_mounted", dict(rows=2, oy=2, halo=1, use=["light"])),
    ("oil lamp", ("lamps", 16, 0, 16, 32), "hang", 2, 0, "light", "놋쇠 반사판 등잔", ["사무실", "가게", "침실"], "wall_mounted", dict(rows=2, oy=2, halo=1, use=["light"])),
    ("floor candle", ("lamps", 32, 0, 16, 32), "floor", 1, 1, "light", "바닥 촛대", ["침실", "창고", "예배당"], "column", dict(use=["light"], halo=1)),
    # ── 깔개·계단 ──
    ("rush mat", "rushmat", "flat", 3, 2, "rug", "골풀 돗자리", ["거실", "농가"], "flat", dict(use=["walk"])),
    ("door mat", "doormat", "flat", 1, 1, "rug", "발깔개", ["문 앞"], "flat", dict(use=["walk"])),
    ("red rug", "rug-red", "flat", 3, 2, "rug", "붉은 양탄자", ["저택", "사무실", "객실", "거실"], "flat", dict(use=["walk"])),
    ("round rug", "rug-blue", "flat", 2, 2, "rug", "둥근 누비 깔개", ["침실", "거실"], "flat", dict(use=["walk"])),
    ("aisle runner", ("runner", 0, 0, 16, 16), "flat", 1, 1, "rug", "붉은 통로 깔개(이어 깐다)", ["예배당", "저택"], "flat", dict(use=["walk"])),
    ("stairs up", "stairs-up", "wall", 2, 1, "stairs", "올라가는 나무 계단", ["여관", "집", "창고"], "structure", dict(stairs="up", use=["travel"], noshadow=1)),
    ("cellar hatch", "hatch", "flat", 1, 1, "stairs", "내려가는 지하 문(사다리)", ["창고", "부엌", "주점"], "flat", dict(stairs="down", use=["travel"])),
]
# 코드로 만드는 빛 무늬(밟는 무늬, 반투명) — prepare.py 가 그린다
GLOWS = [
    ("hearth glow", "glow-hearth", 3, 2, "불 앞 바닥 불빛(벽난로·화덕 바로 앞 줄에 깐다)"),
    ("window light", "glow-window", 1, 2, "창으로 든 햇빛(창 아래 첫 바닥 줄부터)"),
    ("lamp glow", "glow-lamp", 2, 1, "등잔 아래 바닥 불빛"),
]
# 탁상 물건 (id, (원본 장, 칸), 이름)
GOODS = [
    ("tankards", ("goods-tavern", 0), "맥주잔 둘"), ("roast", ("goods-tavern", 1), "고기 접시"), ("bread cheese", ("goods-tavern", 2), "빵과 치즈"), ("jug", ("goods-tavern", 3), "단지와 잔"),
    ("table candle", ("goods-tavern", 4), "탁자 촛불"), ("apple bowl", ("goods-tavern", 5), "사과 그릇"),
    ("scale", ("goods-shop", 0), "천칭"), ("ledger", ("goods-shop", 1), "장부와 깃펜"), ("cashbox", ("goods-shop", 2), "돈통"), ("sweet jar", ("goods-shop", 3), "사탕 병"),
    ("mortar", ("goods-shop", 4), "막자사발과 약병"), ("table lamp", ("goods-shop", 5), "탁상 등잔"),
]
# 이미 구워진 바깥 기물(bd-obj-*) — 칸을 새로 굽지 않고 그 칸 번호를 실내 가구로 등록한다. (실내 id, 킷 꼬리, 갈래, 방 태그)
EXISTING = [
    ("barrel", "barrel-closed", "store", ["창고", "주점", "지하"]), ("keg", "keg-cradle", "tavern", ["주점", "지하"]), ("grain sack", "crate-sack", "store", ["창고", "방앗간"]),
    ("crate", "crate-closed", "store", ["창고", "가게"]), ("firewood", "wood-faggots", "home", ["거실", "주점", "부엌"]), ("chopping block", "wood-block", "home", ["농가", "헛간"]),
    ("potion shelf", "potion-shelf", "shop", ["약방", "가게"]), ("cheese shelf", "cheese-shelf", "store", ["식료", "가게", "낙농"]), ("candle rack", "candle-rack", "shop", ["가게", "일터"]),
    ("cloth shelf", "cloth-bolts", "shop", ["가게", "직조", "옷가게"]), ("rope coil", "rope-coil", "store", ["창고", "어부 집", "가게"]), ("hamper", "hamper", "home", ["침실", "창고"]),
    ("demijohns", "demijohns", "store", ["지하", "가게", "주점"]), ("broom and pail", "broom-bucket", "home", ["거실", "부엌", "주점"]), ("laundry basket", "laundry-basket", "home", ["거실", "침실"]),
    ("barrel stack", "barrel-pyramid", "store", ["창고", "지하", "주점"]), ("pot shelf", "pot-shelves", "craft", ["도공", "가게"]), ("butter churn", "milk-churn", "kitchen", ["부엌", "농가"]),
    ("shield rack", "shield-rack", "guard", ["경비실", "무기점"]), ("bottle crates", "bottle-crates", "store", ["지하", "주점", "양조장"]), ("grain measures", "grain-measures", "mill", ["방앗간", "가게"]),
    ("loom", "loom", "craft", ["직조", "거실"]), ("cauldron", "cauldron-hearth", "kitchen", ["부엌", "약방"]), ("standing scale", "scales", "shop", ["가게", "세관"]),
    ("map table", "map-table", "office", ["사무실", "등대", "서재"]), ("book chest", "book-chest", "office", ["서재", "교실"]), ("feast table", "feast-table", "manor", ["식당", "주점", "저택"]),
    ("cushion bench", "bench-trestle", "home", ["대기실", "거실"]), ("milking stool", "milking-stool", "farm", ["마구간", "농가"]), ("hay bale", "hay-bale", "farm", ["마구간", "헛간"]),
    ("hay manger", "hay-manger", "farm", ["마구간"]), ("feed trough", "feed-trough", "farm", ["마구간", "헛간"]), ("saddle rail", "saddle-rail", "farm", ["마구간"]),
    ("grindstone", "grindstone", "smith", ["대장간"]), ("quench trough", "quench-trough", "smith", ["대장간"]), ("iron bars", "bar-iron", "smith", ["대장간"]), ("coal bin", "coal-bin", "smith", ["대장간"]),
    ("horseshoe board", "horseshoe-rack", "smith", ["대장간", "마구간"]), ("mash tun", "mash-tun", "craft", ["양조장"]), ("brew kettle", "brew-kettle", "craft", ["양조장"]),
    ("bottling bench", "bottling-bench", "craft", ["양조장", "지하"]), ("dye vats", "dye-vats", "craft", ["직조", "염색"]), ("potters wheel", "potters-wheel", "craft", ["도공"]),
    ("alembic", "alembic", "craft", ["약방", "양조장"]), ("grain hopper", "grain-hopper", "mill", ["방앗간"]), ("sieves", "sieve-trestle", "mill", ["방앗간"]), ("sack hoist", "sack-hoist", "mill", ["방앗간", "창고"]),
    ("fish creels", "fish-creels", "fisher", ["어부 집"]), ("gutting table", "gutting-table", "fisher", ["어부 집"]), ("oars", "oar-rack", "fisher", ["어부 집", "배 창고"]),
    ("fishing rod", "fishing-rod", "fisher", ["어부 집"]), ("salt tub", "salt-tub", "fisher", ["어부 집", "부엌"]), ("brazier", "brazier-bowl", "guard", ["경비실", "예배당"]),
    ("water basin", "holy-basin", "church", ["예배당"]), ("lavabo", "lavabo", "church", ["예배당"]), ("offering table", "altar-wood", "church", ["예배당"]),
    ("slant desk", "scriptorium-desk", "office", ["교실", "서재", "사무실"]), ("customs desk", "customs-desk", "office", ["세관", "사무실"]), ("cart wheel", "cart-wheel", "farm", ["헛간", "마구간"]),
    ("hen nest", "hen-nest", "farm", ["헛간", "농가"]), ("armour chest", "armour-chest", "guard", ["경비실", "무기점"]), ("arrow barrel", "arrow-barrel", "guard", ["경비실", "무기점"]),
    ("bow rack", "bow-rack", "guard", ["경비실", "무기점"]), ("basket stack", "baskets-stack", "store", ["창고", "가게"]), ("egg baskets", "egg-baskets", "kitchen", ["부엌", "가게"]),
    ("fruit baskets", "fruit-baskets", "shop", ["가게", "부엌"]), ("herb baskets", "herb-baskets", "shop", ["약방", "부엌"]), ("honey shelf", "honey-shelf", "shop", ["가게", "식료"]),
    ("dipper shelf", "dipper-shelf", "kitchen", ["부엌"]), ("flour bin", "flour-trough", "bake", ["빵집", "방앗간"]), ("hand quern", "hand-quern", "kitchen", ["부엌", "농가"]),
    ("cheese press", "cheese-press", "craft", ["낙농", "부엌"]), ("carding bench", "carding-bench", "craft", ["직조"]), ("cobbler bench", "cobbler-bench", "craft", ["가게", "일터"]),
    ("instruments", "music-stand", "tavern", ["주점"]), ("printing press", "print-press", "craft", ["서재", "일터"]), ("kneeler", "prie-dieu", "church", ["예배당", "침실"]),
    ("record stand", "record-stand", "office", ["사무실", "예배당"]), ("luggage", "luggage", "home", ["객실", "여관"]), ("bedroll", "bedroll", "guard", ["경비실", "헛간"]),
    ("water tub", "barrel-tub", "kitchen", ["부엌", "마구간"]), ("apple bins", "apple-bins", "store", ["창고", "가게"]), ("salt sacks", "salt-bags", "store", ["창고", "어부 집"]),
    ("amphora rack", "pile-amphorae", "store", ["지하", "창고"]), ("clay pots", "fired-pots", "store", ["창고", "도공", "가게"]), ("lecture board", "chalk-board", "office", ["교실"]),
    ("bucket stack", "bucket-stack", "store", ["창고", "마구간"]), ("hand lantern", "lantern-ground", "light", ["창고", "지하"]), ("hop sacks", "hop-sacks", "craft", ["양조장"]),
]
