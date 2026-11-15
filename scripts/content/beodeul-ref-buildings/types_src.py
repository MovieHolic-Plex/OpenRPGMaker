#!/usr/bin/env python3
"""참고 건물 유형 목록의 정본 → tiledata/beodeul-ref-buildings/types.json.   python3 scripts/content/beodeul-ref-buildings/types_src.py
한 줄 = (이름, 한국어, 영어, 폭, 높이, 문 칸 dx 또는 None, 급, 갈래, 터, 맞는 집 양식, 마을 종류 id…, 참고 번호, 윤곽, 낱말…, 실내). 문 칸은 늘 맨 아랫줄 (dx, 높이-1).
passage: 사람이 지나가는 칸(문루·성문·아치) — 그 칸들은 막히지 않는다. 새 유형은 끝에만 더한다(칸 번호 덧붙이기 전용)."""
import json, pathlib
STORE = pathlib.Path(__file__).resolve().parents[3] / "tiledata/beodeul-ref-buildings"
FARMK = ["orchard-hamlet", "ranch", "dairy", "bee-hamlet", "shepherd-fold", "vineyard", "herbalist"]
WALLK = ["garrison-town", "market-town", "border-post"]
PORTK = ["harbour-town", "canal-town", "shipwrights", "ferry-landing"]
MARK = ["market-village", "market-town", "festival"]
# 킷 그림에 들어 있는 발치 것(included) · 따로 놓으면 어울리는 이미 있는 버들항 기물 id(props — 이 킷이 놓지 않는다, 빌더가 곁에 놓는다)
INCL = {"dormerhall-a": ["큰 독 셋·통·상자", "덩굴장미"], "dormerhall-b": ["큰 독 셋·통·상자"], "deckfarm-b": ["큰 독 셋·통"], "tealfarm-a": ["사과 상자"], "plankfarm-b": ["장작 더미"], "barn-a": ["통"], "barn-b": ["통"],
        "stable-a": ["건초 더미·쇠스랑·말"], "stable-b": ["건초 더미·말", "돼지 우리와 여물통"], "storeshed-a": ["큰 독 셋·통·상자"], "tavern-a": ["술청 판매대·통·걸상", "걸이 간판"], "tavern-b": ["술청 판매대·통", "걸이 간판"],
        "cellarhouse-a": ["통"], "markethall-a": ["판매대·곡식 자루·저울"], "warehouse-b": ["통"], "warehouse-c": ["통"], "cranehouse-a": ["통·상자·자루"], "customs-a": ["통·상자"], "crane-a": ["매달린 상자"], "crane-b": ["통"],
        "galleryhouse-a": ["쌓은 상자와 독"], "brickstore-a": ["큰 독"], "guildhall-b": ["걸이 간판"]}
FARMP = ["bd-obj-hay-bale", "bd-obj-hay-rack", "bd-obj-wood-faggots", "bd-obj-wood-block", "bd-obj-laundry-horse", "bd-obj-cart-hay", "bd-obj-barrel-tub"]
TOWNP = ["bd-obj-bench-trestle", "bd-obj-barrel-pyramid", "bd-obj-crate-closed", "bd-obj-planter-tiered", "bd-obj-cart-barrels", "bd-obj-crate-sack"]
PORTP = ["bd-obj-rope-coil", "bd-obj-anchor-small", "bd-obj-fish-creels", "bd-obj-net-floats", "bd-obj-crate-closed", "bd-obj-barrel-closed", "bd-obj-sack-hoist"]
CASTP = ["bd-obj-banner-arch", "bd-obj-bench-stone", "bd-obj-planter-bench", "bd-obj-crate-closed", "bd-obj-barrel-amphora"]
PROPS = {}
def _props():
    for x in TYPES: PROPS[x["name"]] = []
def t(name, ko, en, w, h, door, tier, cat, setting, style, kinds, ref, shape, words, interior=None, passage=None, doorw=1):
    return dict(name=name, id=f"bd-bld-ref-{name}", ko=ko, en=en, w=w, h=h, door=None if door is None else [door, h - 1], **({"doorw": doorw} if doorw > 1 else {}), **({"passage": passage} if passage else {}),
                included=INCL.get(name, []), props=PROPS.get(name, []), tier=tier, cat=cat, setting=setting, style=style,
                kinds=kinds, ref=ref, shape=shape, words=words, interior=interior)
TYPES = [
 t("plankfarm-a", "2층 널판 농장집", "two-storey plank farmhouse", 7, 8, 1, "medium", "farm", "rural", "log", FARMK, "ref1-1", "높은 처마 채 + 낮은 처마 왼채, 너와 지붕에 풀빛 처마 띠", ["널판 농장집", "이층 농장집", "plank farmhouse"], "farmhouse"),
 t("plankfarm-b", "장작 달개 널판 농장집", "plank farmhouse with a woodshed lean-to", 8, 7, 5, "medium", "farm", "rural", "log", FARMK, "ref1-1", "처마 채 + 왼쪽 낮은 장작 달개", ["장작 달개 농장집", "woodshed farmhouse"], "farmhouse"),
 t("deckfarm-a", "데크 농장집", "farmhouse on a railed deck", 9, 7, 2, "medium", "farm", "rural", "log", FARMK, "ref1-3", "처마 채 + 난간 두른 나무 데크와 디딤 계단", ["데크 농장집", "마루 농장집", "deck farmhouse"], "farmhouse"),
 t("deckfarm-b", "데크 긴 농장집", "long farmhouse on a railed deck", 11, 7, 7, "large", "farm", "rural", "log", FARMK, "ref1-3", "긴 처마 채 + 데크, 켠 널 더미", ["긴 데크 농장집", "long deck farmhouse"], "farmhouse"),
 t("tealfarm-a", "청록 너와 큰 농장집", "big teal-roofed farmhouse", 11, 9, 7, "large", "farm", "rural", "log", FARMK, "ref1-2", "처마 긴 채 + 앞 박공 날개, 청록 너와, 자줏빛 널판 벽, 데크", ["청록 지붕 농장집", "지주 집", "teal-roofed farmhouse"], "manor"),
 t("dormerhall-a", "지붕창 긴 본채", "long farm hall with dormers", 13, 8, 6, "large", "farm", "rural", "log", FARMK, "ref2-1", "긴 처마 채 + 지붕창 둘 + 가운데 돌 박공 현관 채, 큰 독과 통", ["농장 본채", "지붕창 본채", "farm hall"], "farmhouse", doorw=2),
 t("dormerhall-b", "지붕창 본채", "farm hall with a dormer", 9, 7, 2, "medium", "farm", "rural", "log", FARMK, "ref2-1", "처마 채 + 지붕창 하나 + 왼쪽 돌 박공 현관 채", ["작은 농장 본채", "small farm hall"], "farmhouse"),
 t("barn-a", "큰 곳간", "great barn", 9, 9, 1, "large", "farm", "rural", "log", ["ranch", "dairy", "shepherd-fold", "orchard-hamlet", "mill-hamlet", "market-village"], "ref3-5", "높은 박공 채(두 짝 큰 문) + 처마 날개채(살창)", ["큰 곳간", "곡식 곳간", "great barn", "granary barn"], "barn", doorw=2),
 t("barn-b", "박공 헛간", "gable barn", 6, 8, 2, "medium", "farm", "rural", "log", ["ranch", "dairy", "shepherd-fold", "orchard-hamlet", "mill-hamlet"], "ref3-2 · ref3-5", "박공 채 하나, 두 짝 큰 문과 다락 문", ["박공 헛간", "건초 헛간", "gable barn", "hay barn"], "barn", doorw=2),
 t("stable-a", "트인 마구간", "open stable", 8, 6, 6, "medium", "farm", "town", "halftimber", ["waystation", "ranch", "market-town", "garrison-town", "border-post"], "ref4-8", "처마 채, 아래가 트인 건초·말 칸", ["트인 마구간", "말 마구간", "open stable", "horse stable"], "stable"),
 t("stable-b", "외양간과 우리", "cowshed with a pen", 10, 6, 1, "large", "farm", "rural", "log", ["ranch", "dairy", "shepherd-fold"], "ref4-8 · ref2-1(파생)", "낮은 긴 처마 채 + 트인 칸 + 울 두른 우리", ["외양간", "가축 우리", "cowshed", "cattle pen"], "stable"),
 t("rootcellar-a", "축대 저장굴", "root cellar in a stone bank", 3, 3, 1, "small", "farm", "rural", "any", ["vineyard", "brewers", "orchard-hamlet", "herbalist", "potters"], "ref1-4", "돌 축대 조각에 아치 굴 문", ["저장굴", "뿌리 채소 굴", "root cellar"], "cellar"),
 t("rootcellar-b", "쌍 저장굴", "twin root cellar", 5, 3, 1, "small", "farm", "rural", "any", ["vineyard", "brewers", "orchard-hamlet", "herbalist", "potters"], "ref1-4 · ref4-2", "돌 축대에 아치 문 둘", ["쌍 저장굴", "술 저장굴", "twin cellar", "wine cellar"], "cellar"),
 t("storeshed-a", "독·통 저장 헛간", "store shed with jars and barrels", 6, 6, 1, "medium", "farm", "rural", "log", ["vineyard", "brewers", "potters", "bee-hamlet"], "ref2-1 · ref3-1", "처마 채 + 트인 달개 밑 큰 독과 통", ["저장 헛간", "독 헛간", "store shed"], "storehouse"),
 t("tavern-a", "누마루 주막", "tavern on posts", 9, 9, 1, "large", "town", "town", "halftimber", ["waystation", "market-village", "market-town", "festival", "brewers"], "ref4-1", "좁고 높은 박공 채 + 기둥 위 마루 채(아래는 트인 술청)", ["누마루 주막", "술청", "open tavern", "tavern on posts"], "tavern"),
 t("tavern-b", "누마루 차 주막", "tea house on posts", 8, 7, 6, "medium", "town", "town", "halftimber", ["waystation", "market-village", "market-town", "festival", "hot-spring"], "ref4-1", "처마 채 + 왼쪽 트인 아래층, 붉은 기와", ["누마루 차 주막", "차 주막", "tea house"], "tavern"),
 t("cellarhouse-a", "지하문 상가 창고", "merchant store with cellar arches", 10, 9, 7, "large", "town", "town", "halftimber", ["market-town", "guild-town", "brewers"], "ref4-2", "처마 본채 + 박공 날개, 아치 지하문 둘, 바깥 계단과 발코니", ["상가 창고", "지하 창고 상가", "merchant store", "cellar store"], "storehouse"),
 t("guildhall-a", "격자창 조합 회관", "guild hall with a lattice window band", 8, 7, 1, "large", "town", "town", "halftimber", ["guild-town", "market-town", "weavers", "scholar-town"], "ref4-9", "큰 처마 채, 위층 격자창 띠, 1층 아치 살창", ["조합 회관", "길드 회관", "guild hall"], "hall"),
 t("guildhall-b", "큰 조합 회관", "great guild hall", 11, 8, 5, "xlarge", "town", "town", "halftimber", ["guild-town", "market-town", "scholar-town"], "ref4-9 · ref4-12", "큰 처마 채 + 쌍 지붕창, 붉은 기와", ["큰 조합 회관", "상인 회관", "great guild hall", "merchants hall"], "hall"),
 t("longhouse-a", "두 층 긴 채", "two-storey long workshop", 8, 7, 6, "medium", "work", "town", "halftimber", ["weavers", "guild-town", "monastery"], "ref4-10", "처마 채, 목골 두 층 격자창", ["직조소", "긴 작업채", "weaving house", "long workshop"], "workshop"),
 t("lockup-a", "창살 낮은 창고", "lock-up store with barred windows", 9, 7, 7, "medium", "town", "town", "halftimber", ["garrison-town", "border-post", "market-town"], "ref4-7", "처마 긴 채 + 뒤 박공, 1층 창살 낮은 창", ["옥사", "창살 창고", "lock-up", "gaol"], "jail"),
 t("wallstore-a", "성벽 창고", "store room in the town wall", 6, 4, 2, "small", "town", "castle", "halftimber", ["garrison-town", "market-town"], "ref4-6", "성벽 면 조각에 아치 문과 살창", ["성벽 창고", "성벽 방", "wall store"], "storehouse"),
 t("stall-blue", "쪽빛 차양 노점", "market stall with a blue awning", 3, 3, None, "small", "town", "town", "any", MARK, "ref4-5", "천 차양 + 판매대(옹기)", ["쪽빛 차양 노점", "옹기 노점", "blue awning stall"]),
 t("stall-green", "초록 차양 노점", "market stall with a green awning", 3, 3, None, "small", "town", "town", "any", MARK, "ref4-5", "천 차양 + 판매대(채소)", ["초록 차양 노점", "채소 노점", "green awning stall"]),
 t("stall-striped", "줄무늬 차양 생선 좌판", "fish stall with a striped awning", 3, 3, None, "small", "harbour", "harbour", "harbourstone", ["harbour-town", "fishing-cove", "canal-town"], "ref5-10", "줄무늬 차양 + 생선 상자", ["줄무늬 차양 좌판", "부두 생선 좌판", "striped awning stall"]),
 t("stall-cloth", "연두 차양 좌판", "fruit stall with a lime awning", 3, 3, None, "small", "harbour", "harbour", "harbourstone", ["harbour-town", "canal-town", "festival"], "ref5-10", "연두 차양 + 과일", ["연두 차양 좌판", "과일 좌판", "fruit stall"]),
 t("markethall-a", "장터 지붕", "open market hall", 8, 6, None, "large", "town", "town", "halftimber", MARK, "ref4-5 · ref4-1", "기둥만 선 트인 처마 채, 밑에 판매대", ["장터 지붕", "장옥", "market hall", "market roof"]),
 t("warehouse-a", "쌍박공 부두 창고", "twin-gable quay warehouse", 7, 9, 1, "large", "harbour", "harbour", "harbourstone", PORTK + ["saltern"], "ref5-1", "좁고 높은 박공 둘, 도르래 들보", ["쌍박공 창고", "부두 창고", "twin warehouse", "quay warehouse"], "warehouse"),
 t("warehouse-b", "박공 부두 창고", "gable quay warehouse", 4, 9, 1, "medium", "harbour", "harbour", "harbourstone", PORTK + ["saltern"], "ref5-1", "좁고 높은 박공 하나, 짐 올리는 문", ["좁은 부두 창고", "narrow warehouse"], "warehouse"),
 t("warehouse-c", "긴 부두 창고", "long quay warehouse", 9, 7, 2, "large", "harbour", "harbour", "harbourstone", PORTK, "ref5-5", "처마 채 + 박공, 아치 문 둘", ["긴 부두 창고", "long warehouse"], "warehouse"),
 t("cranehouse-a", "기중기 집", "crane house on stilts", 4, 10, 1, "medium", "harbour", "harbour", "harbourstone", PORTK, "ref5-3", "기둥 틀 위 좁고 높은 박공 채", ["기중기 집", "다락 창고", "crane house"], "warehouse"),
 t("crane-a", "큰 부두 기중기", "great quay crane", 3, 4, None, "small", "harbour", "harbour", "any", PORTK, "ref5-7", "받침 틀 + 팔 + 도르래", ["큰 부두 기중기", "great quay crane"]),
 t("crane-b", "짐 다는 틀", "hoist frame", 3, 4, None, "small", "harbour", "harbour", "any", PORTK + ["quarry"], "ref5-8", "기둥 둘 + 가로대 + 받침 단", ["짐 다는 틀", "달아 올리는 틀", "hoist frame"]),
 t("customs-a", "세관", "customs house", 8, 9, 5, "large", "harbour", "harbour", "harbourstone", ["harbour-town", "canal-town", "border-post", "ferry-landing"], "ref5-4", "처마 채 + 높은 박공, 높은 격자창 셋, 뾰족 아치 문", ["세관", "항구 조합", "customs house"], "office"),
 t("harbouroffice-a", "큰 아치 창 관리소", "harbour office with a great arched window", 8, 7, 5, "medium", "harbour", "harbour", "harbourstone", ["harbour-town", "canal-town", "lighthouse-cape"], "ref5-2", "처마 채 + 박공 날개, 큰 반원 아치 창", ["항구 관리소", "항만 사무소", "harbour office"], "office"),
 t("archgate-a", "뾰족 아치 문", "pointed arch gateway", 3, 4, 1, "small", "harbour", "castle", "harbourstone", ["harbour-town", "canal-town", "scholar-town", "monastery"], "ref5-9", "홀로 선 돌 뾰족 아치(밑으로 지나간다)", ["뾰족 아치 문", "돌 아치 문", "pointed arch gate"], None, [[1, 2], [1, 3]]),
 t("tower-a", "성벽 모퉁이 탑", "corner tower of the town wall", 4, 7, None, "medium", "castle", "castle", "violetslate", WALLK, "ref6-1", "네모 돌 탑 + 뾰족지붕, 긴 깃발", ["모퉁이 탑", "뾰족지붕 탑", "corner tower"]),
 t("tower-b", "벽돌 망루", "brick watch tower", 4, 8, 1, "medium", "castle", "castle", "violetslate", WALLK, "ref6-1 · ref6-6", "벽돌 탑 + 뾰족지붕, 문", ["벽돌 망루", "brick watch tower"], "tower"),
 t("tower-c", "문지기 탑", "gatekeeper's turret", 3, 6, 1, "small", "castle", "castle", "violetslate", WALLK, "ref6-2", "작은 탑 + 보라 문", ["문지기 탑", "gatekeeper turret"], "tower"),
 t("wallgate-a", "성읍 문", "town wall gate", 5, 5, 2, "medium", "castle", "castle", "violetslate", WALLK, "ref6-3", "성벽 조각 + 트인 문, 깃발 줄", ["성읍 문", "성벽 문", "town wall gate"], None, [[2, 2], [2, 3], [2, 4]]),
 t("gatehall-a", "문루 회관", "gatehouse hall", 14, 8, 6, "xlarge", "castle", "castle", "violetslate", WALLK + ["guild-town"], "ref6-4", "긴 처마 채 + 박공 날개 둘, 밑으로 길이 지난다", ["문루 회관", "길 위 회관", "gatehouse hall"], None, [[6, 5], [7, 5], [6, 6], [7, 6], [6, 7], [7, 7]]),
 t("guardhouse-a", "탑 달린 관리소", "guardhouse with a tower", 8, 8, 2, "large", "castle", "castle", "violetslate", WALLK, "ref6-5 · ref6-1", "회랑 채 + 모서리 탑(뾰족지붕)", ["탑 달린 관리소", "수비대 관리소", "guardhouse"], "office"),
 t("galleryhouse-a", "기둥 회랑 채", "gallery house on posts", 6, 7, 1, "medium", "castle", "castle", "violetslate", ["garrison-town", "guild-town", "scholar-town"], "ref6-5", "큰 지붕 채 + 기둥 위 회랑, 밑 트임", ["회랑 채", "기둥 회랑 집", "gallery house"], "office"),
 t("brickstore-a", "벽돌 창고", "brick storehouse", 7, 7, 1, "medium", "castle", "castle", "violetslate", ["garrison-town", "guild-town", "scholar-town", "brewers"], "ref6-6", "처마 채 + 높은 박공, 회랑, 독", ["벽돌 창고", "brick storehouse"], "storehouse"),
 # ── 초대형(2026-11-16): 이야기가 청하는 성·대성당·수도원·큰 세관의 바깥 — 실내 크기 단 초대형 구성의 집. 시트의 둘째 토막(block="big", 60,800~)에 굽는다 ──
 t("keep-a", "성 본채", "castle keep", 16, 11, 7, "xlarge", "castle", "castle", "violetslate", WALLK + ["guild-town"], "새로 지음(성읍 조각의 부품)", "긴 처마 본채 + 가운데 박공 문루 채(두 칸 폭 아치 성문) + 양끝 뾰족지붕 탑", ["성", "성 본채", "castle keep", "keep"], "keep", doorw=2),
 t("cathedral-a", "마을 대성당", "village cathedral", 13, 12, 6, "xlarge", "town", "town", "halftimber", MARK + ["shrine-hamlet", "garrison-town"], "새로 지음(읍 건물의 부품)", "높은 박공 본당 + 왼쪽 종탑(뾰족지붕) + 오른쪽 낮은 측랑", ["대성당", "성당", "cathedral", "minster"], "cathedral"),
 t("abbey-a", "수도원", "abbey", 15, 10, 12, "xlarge", "town", "rural", "halftimber", ["monastery", "scholar-town", "herbalist", "vineyard"], "새로 지음(읍 건물의 부품)", "긴 처마 채(아래층 둥근 아치 창 넷) + 왼쪽 높은 박공 예배당 + 오른쪽 박공 서고", ["수도원", "수도원 서고", "abbey", "monastery"], "abbey"),
 t("customs-b", "큰 세관", "great customs house", 15, 10, 11, "xlarge", "harbour", "harbour", "harbourstone", PORTK + ["border-post"], "새로 지음(항구 건물의 부품)", "긴 처마 채(큰 아치 창 둘) + 오른쪽 높은 박공 홀(높은 격자창 넷)", ["큰 세관", "세관 청사", "great customs house"], "customs"),
]
# 실내: 손 도트 실내 칩셋(atlas_biome_interior)의 build_hand_interior_room 이 받는 이름 — program(방 구성 이름) 또는 rooms(방 종류 목록). 2026-11-15 에 roomPrograms·roomTemplates 로 확인했다.
INTERIOR = dict(farmhouse=dict(rooms=["living", "kitchen", "bedroom"]), manor=dict(program="manor_1f"), barn=dict(rooms=["stable", "storeroom"]), stable=dict(program="stable"), cellar=dict(rooms=["cellar"]),
                storehouse=dict(rooms=["storeroom"]), warehouse=dict(rooms=["storeroom", "storeroom"]), tavern=dict(program="tavern"), hall=dict(rooms=["great_hall", "study"]), workshop=dict(rooms=["workshop", "storeroom"]),
                jail=dict(rooms=["guard_room", "jail"]), office=dict(rooms=["study", "waiting_room"]), tower=dict(program="tower"),
                keep=dict(rooms=["great_hall"]), cathedral=dict(rooms=["chapel"]), abbey=dict(rooms=["library"]), customs=dict(rooms=["waiting_room", "storeroom"]))
BIG = ("keep-a", "cathedral-a", "abbey-a", "customs-b")
for x in TYPES: x["interiorUse"] = x.pop("interior"); x["interior"] = INTERIOR.get(x["interiorUse"]) if x["interiorUse"] else None
for x in TYPES:
    if x["name"] in BIG: x["block"] = "big"
for x in TYPES: x["props"] = dict(farm=FARMP, work=TOWNP, town=TOWNP, harbour=PORTP, castle=CASTP)[x["cat"]]
if __name__ == "__main__":
    assert len({x["name"] for x in TYPES}) == len(TYPES)
    (STORE / "types.json").write_text(json.dumps(dict(_doc="버들항 참고 건물 유형 — scripts/content/beodeul-ref-buildings/types_src.py 가 쓴다(손으로 고치지 않는다). 오너의 참고 그림 여섯 장에 서 있는 건물 유형을 버들항 손으로 새로 그린 것(참고 그림은 저장소에 없다, 베끼지 않았다).",
                                                    waiver="fable-refbuildings-beodeul-2026-11-15", types=TYPES), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(len(TYPES), "types", sum(x["w"] * x["h"] for x in TYPES), "cells")
