# 공용 칩셋 빈칸 목록 (2026-10-08 조사)

## 0. 기준과 주의

- **칩셋·장소·도구 기준은 `origin/main` 75d7df7e8c 다.** 이 워크트리(HEAD b8936e936a)는 origin/main 보다 129커밋 뒤처져 있고
  저작권 정리 PR #2335(a27efa58bd)가 **들어 있지 않다.** 그래서 워크트리 디스크에는 지워진 숲마을·기후·Tibo·EasyRPG 칩셋과
  장소 224개(`public/assets/region-references/*.oprn.json`)가 아직 남아 있다. 지금 실제로 배송되는 것은 origin/main 쪽이다.
  읽은 방법: `git archive origin/main` 으로 푼 임시 사본(조사 뒤 지움). 경로는 모두 origin/main 기준이다.
- **시험 증거(qa-runs)는 전부 정리 이전 코드에서 돌았다.** codeCommit 44b532e6·a82f3599·fd772f3b·b8936e93 모두 a27efa58bd 의 자손이 아니다.
  그때는 `forest_harmony_snow`·`atlas_biome_dungeon` 이 아직 있어서 거부 사유가 「폐기」였다. 지금은 칩셋 자체가 없다. 즉 아래 던전·필드 빈칸은 **시험 당시보다 지금이 더 크다.**
- 「빈칸」은 두 종류로 나눈다: **그림 없음**(칩셋·부품이 없다) / **못 닿음**(있는데 조수가 못 찾거나, 찍어도 안 보인다).
- 무림·중국 무협과 jp_city 상점 실내(편의점 진열대·계산대·냉장고)는 이미 계획·진행 중이라 웨이브 제안에서 뺐다(표 B 에는 위치만 적었다).

---

## 표 A — 배송 칩셋 (origin/main)

장소 수 = `src/project/*PlaceReferences.ts`(장소 탭·`list_spatial_designs` 의 place 행). 키트 수 = `src/assets/<칩셋>Tileset.json` 의 `structureKits`.

| 타일셋 | 계열 | 테마 | 덮는 공간 | 장소 / 키트 / 참고문서 용도 | 조수가 닿나? (경로) |
|---|---|---|---|---|---|
| `beodeul_city` (+ `beodeul_forms`·`_reviewed`·`_architecture`·`_ground`·`_door`·`_warm_trees`) | oprn-atlas | 로마풍 항구 도시 (판타지·중세) | 야외 마을·도시(강가·포구·사막·설원·늪·city), 필드 조각(해안 절벽·산길·깊은 숲·밀밭), 던전 조각(바다 동굴·카타콤·하수도·신전 폐허·화산 동굴·광산 골짜기), 랜드마크(곶 등대·난파선·마법사의 탑) | **장소 0** / 키트 725 (`bd-pick-*` 410여 개) / 용도 12 + 시설 1 (`beodeulCityReferences.json`, `beodeulFacilitiesReferences.json`) | **닿음.** 새 야외 기본 칩셋(`src/ai/piAgent/systemPrompt.ts:55`), `author_beodeul_town`, `stamp_object(kit:beodeul_city/bd-pick-…)`, `author_wild_route`. 단 오토타일 묶음은 3개뿐(길 포석·강 물·모랫길) — 던전 바닥·벽은 2×2/3×3 키트 찍기로만 된다. |
| `atlas_biome_interior` | oprn-atlas | 손 도트 실내 v5 (중세 판타지) | 실내 건물 25종 템플릿(빵집·약국·생선가게·정육점·대장간·예배당·학자의 집·재단사·선술집·저택 2층·호빗 굴·여관·드워프 홀·엘프 궁정·연회장·알현실·마법사의 탑·성 지하 감옥·광산·마도 기관실·오페라 극장·카지노·마구간·탄광 마을 집·뒷골목 선술집), 방 종류 48, 벽 19·바닥 27 (`handInteriorSpec.json`) | 장소 0 (예제 26맵은 참고문서) / 기물 527 | **닿음.** `HAND_INTERIOR_POLICY_LINE`(`src/ai/handInteriorPolicy.ts:2`) → `build_hand_interior_room` 기본 칩셋(`src/editor/tools/handInteriorTools.ts`). 네모 방만 짓는다. |
| `shared_hand_interior_harness` (공용 DB `oprn-hand-interior-harness`, 번들 아님) | oprn-atlas | 슈퍼하네싱 공용 기물 951종(사용자 선택 819) — 무림 32·현대 집 36·현대 가게 17·SF 우주선 14·현대 사무실 13·현대 학교 12·현대 병원 10 등 | 실내 기물만(벽·바닥 없음) | 키트 951 (QA 픽스처 `qa-runs/harnesses/space-craft/20261008-gpt/shared-content.sqlite` 기준, 호스트마다 다를 수 있음) | **절반만 닿음.** `list_spatial_designs` 로 찾아 `stamp_object` 로만 찍는다. `build_hand_interior_room`·`list_hand_interior_parts` 에는 못 넘긴다(그 팩 참고문서 `hand-interior-v5-order` 원문). jp_city·beodeul_city 맵에 찍은 결과가 **화면에 안 보였다**(표 C #2). |
| `joseon_baram` | oprn-joseon | 조선·바람의나라풍 | 마을 20호, 국내성(96×96·200×208), 사냥터, 동굴, 실내 10(민가·주막·대장간·약방·서당·관아·어좌전·회랑·침전·서고) | **장소 15** / 키트 542 / 용도 6 | **거의 못 닿음.** 시스템 지시문에 조선 줄 0개(`systemPrompt.ts` grep 0). 빌더 없음, `build_hand_interior_room` 미지원(역할표 roomKit 없음 — roomKit 은 atlasBiomeInterior·jpCity·wizardingWorld 셋뿐). 장소 검색 「조선」「서당」「주막」으로만 나온다. 기본 버들항 맵에서 쓰려면 `ask_tileset_change` 승인 필요. 시험 기록 전체에서 joseon 사용 0회. |
| `jp_city` | oprn-jp | 현대 일본(상가·주택·역·신사·小学校) | 거리·상가·주택가·노면전차·지하철 입구·신사·초등학교 **외관**, 일본 집 실내(현관·화실·LDK·부엌·욕실·화장실·침실·아이방·원룸) | **장소 6** / 키트 537 / 용도 11 / 실내 가구 97 | **닿음.** `jpCityPromptLines`(`src/ai/jpCityPolicy.ts:103`, 포인터 줄은 항상), `build_jp_city_building`, `build_hand_interior_room({tileset:"jp_city"})`, `set_map_transit`. 상점 실내는 다른 브랜치에서 진행 중. |
| `modern_city` | oprn-modern | 현대 도시·도쿄풍 (modern-chipset 하네스) | 거리·건물 259·차량 191·소품 117·지하 주차장 | **장소 1** / 키트 577 / 용도 8 | **약함.** 지시문 줄 없음, 빌더 없음, 실내 없음. 장소 1곳 import 와 키트 찍기뿐. 월드맵 테마 `modern-town`·`modern-sf` 만 이 칩셋을 가리킨다(`src/editor/tools/worldTerrainTools.ts:217`). |
| `wizarding_world` | oprn-wizard | 마법 학교·해리포터풍 | 성채 대연회장·복도·기숙사(휴게실·침실)·마법약 교실·도서관·병동·온실·부엉이 탑·시계탑·퀴디치·보트 창고·마차 승차장·우체국·지팡이 가게·과자 가게 지하 | **장소 18** / 키트 636 / 용도 17 | **닿음(도구로).** `build_wizarding_space`, `build_hand_interior_room({tileset:"wizarding_world"})`. 시스템 지시문 줄은 없다. |
| `monster_*` 7장 (overworld·wild·coast·climate·dungeon·gyms·rooms) + `emerald` 키트 | oprn-monster / oprn-monster-emerald | 포켓몬풍 | 72맵 캠페인 전부(체육관·연구소·던전 포함) | (조사 안 함) | **닿음.** `build_monster_game`. 단 `monster_dungeon` 은 계열·화풍이 달라 모험 JRPG 던전에 못 쓴다. |
| `atlas_vehicles` | (family 필드 없음 — 화풍 판정, 확인 안 함) | 배·비공정·마차·축제·처형대 | 겹쳐 놓는 탈것·장면 조각 | 참고문서 있음 | 확인 안 함 |
| `worldmap_selected`·`worldmap_authoring`·`atlas_cartography` | worldmap-kit | 월드맵 | 월드맵 | — | **닿음.** 월드맵 지형 도구(`worldTerrainTools.ts`). |
| Scarloxy 3장(초원 마을·사막/설원·실내) | (화풍 scarloxy) | 제3자 팩(사용자가 남김) | 마을·야외·실내 | — | **사실상 못 닿음.** `generate_map` 만 쓰는데 그 도구는 조수에게 숨겨졌다(`src/editor/tools/toolRegistry.ts:183`). |

**배송 장소 합계: 46곳**(조선 15·마법 학교 18·jp_city 6·modern_city 1 — `git ls-tree origin/main public/assets/region-references/` 92파일).
**사라진 것:** 숲마을·기후·던전(`oprn_dungeon_*`, `atlas_biome_dungeon`)·Tibo 실내·성채·배 칩셋과 그 위 장소 178곳 전부. `REGION_REFERENCES = []`, `REVIEWED_PLACE_INDEX = []` (`src/project/regionReferences.ts`, `src/project/defaults/spatial/reviewedPlaceIndex.ts`). `src/assets/sharedObjectCatalog.json` 의 objects 도 0개다.

---

## 표 B — 장르 프리셋별 필요 공간과 빈칸

프리셋 출처: 첫 화면 장르 8종 `src/editor/newProjectChoices.ts` + 저작 요령 `src/editor/welcomeGenrePresets.ts`, 인터뷰 장르 4종 `src/project/gameAuthoringPresets/*.md`, 플레이 작성 프리셋 96종 `src/project/authoringPresets*.ts`.

| 프리셋 | 필요한 공간·물건 (출처 문구) | 덮는 것 | 빈칸 |
|---|---|---|---|
| 모험 JRPG `adventure-jrpg` | 「시작 마을과 던전 입구」, 「던전 층마다 set_encounter_table」 | 마을 = beodeul_city. 던전 = beodeul 던전 키트 찍기 또는 `build_hand_interior_room` 의 mine/rock 벽 네모 방 | **칩셋 통째로 없음 (던전·동굴).** 던전 전용 생성 칩셋·빌더 없음. 시험: 등대 JRPG 3판·시간의 문 2판(표 C #1) |
| 몬스터 수집 `monster-collect` | 72맵·체육관·연구소·리그 | monster 키트 7장 | 없음 (조사 범위 안에서) |
| 파트너 육성 `partner-raise` | 톤 문구에 특정 공간 없음 | monster 키트·버들항 | 판단 불가 |
| 회상 스토리 `story-cutscene` / 인터뷰 「관계·연애」 | 시험 「바닷바람 기숙사의 봄」: 기숙사 방·해송고 학교·항구 거리·축제 광장. 메모리 노트(PR #2339): 대학 캠퍼스 | 학교·기숙사를 **로마풍 beodeul_city 바깥 칩셋**에 지었다 | **부품 없음 + 못 닿음.** 현대 학교 실내·기숙사·캠퍼스 없음. jp_city 는 小学校 외관과 일본 집만. 현대 시작 칩셋 고르기 경로 없음 |
| 갤러리 호러 `horror-gallery` | 「미술관·회랑」, 「그림·조각상·진열장」(`welcomeGenrePresets.ts` HORROR_GALLERY_AUTHORING_GUIDE) | 손 도트 실내: 그림 1·석상 3·진열장(가게용) | **부품 없음.** 미술관 건물 템플릿·전시 벽 액자 여러 종·조각 받침·차단봉 없음 |
| 학교 호러 `school-horror` | 「야간 학교 회랑」, 숨기·도주 | jp_city 小学校 외관만, 교실 실내 없음. 마법 학교 교실은 판타지 | **부품 없음.** 현대 학교 실내(교실·복도·계단·화장실·사물함) |
| 저택 호러 (첫 화면 미니) / 추리 `mystery` | 「저택·서재·거실·주방」, 옷장 은신 | 손 도트 실내 저택(1·2층) | 판타지 저택은 있음. 현대 저택·현대 추리(사무소·경찰서 실내)는 없음 — 공용 DB 에 「경찰서 책상」 1개뿐 |
| 농장 생활 `farm-life` + 생활·경제 프리셋 4종(crop-shipping·maker-processing·tool-upgrade-work·season-forage) | 「밭/도구」, 출하 상자, 가공 설비 | 작물 성장 스프라이트(`src/assets/farmingSprites.ts`), 손 도트 실내 마구간·「농기구 걸이」 | **부품 없음.** 경작지 오토타일 없음. 농사 런타임은 `FARMLAND_TILE = {BODY:187,…}`(`src/project/defaults/chipsetMapping.ts:108`)을 맵 칩셋에 그대로 그린다 — 지워진 EasyRPG 480칸 시트 번호라 버들항에서는 다른 그림을 가리킬 것으로 **추정**(실제 화면 확인 안 함) |
| 2D 액션 RPG `action-rpg` | 「작은 전투 공간」 | 아무 칩셋 | 없음 |
| 현대 초능력 JRPG (첫 화면 미니) | 「현대 마을」 | jp_city·modern_city(도쿄풍) | **못 닿음.** 지시문·시작 칩셋 경로 없음. 한국·서양 현대 거리는 그림도 없음 |
| 무림·무협 (space-craft 무림 과제) | 객잔·원탁·수련장·목인장·무기 걸이 | — | 계획됨(Phase 2, `openwiki/chipset-roadmap.md`) — 여기서 제외 |
| 편의점 (space-craft modern-store) | 계산대·진열대·음료 냉장고 | — | 진행 중(jp_city 상점 실내) — 여기서 제외 |
| 플레이 작성 「던전 진행」 8종 | 무너지는 연구소·저수지 수위·독 늪·승강기·세 제단·탑 샘 | beodeul 던전 키트, 손 도트 실내 마도 기관실 | **던전 칩셋 없음**(#1). 연구소·발전기 같은 근미래 시설 없음(#9) |
| 「반복·도전」 8종 | 투기장 웨이브·도전 탑·폐광 반복 던전·유적 제단 | 손 도트 실내 광산 | **투기장 없음**(#8), 던전 #1 |
| 「탐험·장치」 8종 | 지하 수로·유적 발판·산길 탑·숲 샛길·순환 숲 | beodeul 하수도·신전 폐허·깊은 숲 키트 | 숲 필드에 키큰 풀 없음(#6). 순환 숲·샛길은 키트로 가능 |
| 「시대·인과」 8종 | 번성한 성 ↔ 미래 폐허, 과거 다리·성문 | beodeul 왕성·폐허 키트 | 같은 장소의 「폐허판」 세트는 없음(키트 섞기로 대체). 낮음 |
| 「세계·사건」 8종 | 해방 항구·폐역 복구·배편·축제 광장·화산 분화 | beodeul 항구·화산, atlas_vehicles 배 | 배 실내·갑판 없음(#7), 폐역(역 건물) 판타지판 없음 |
| 「전투 구성」·「성장」 | 수련장, 폐허의 기사 | 아무 칩셋 | 없음 |

---

## 표 C — 구체적 빈칸 (맞은 장르·시험 수 순)

「맞음」 = 표 B 의 프리셋 행 수 + 시험 판 수. 증거 경로는 이 워크트리 기준(qa-runs 는 gitignore, 커밋 안 됨).

| # | 빈칸 | 종류 | 맞음 | 증거 |
|---|---|---|---|---|
| 1 | **던전·동굴 전용 생성 칩셋**(불규칙 동굴 벽·바닥 오토타일, 물·용암·얼음 물가, 계단·함정·문, 층 연결) + 빌더 | 칩셋 통째로 없음 | 모험 JRPG, 던전 진행 8, 반복·도전(탑·폐광), 탐험(수로·유적) / 시험 5판 | `qa-runs/genre-20261007/gemini-lighthouse-jrpg/tools.jsonl` — `create_map` 이 `forest_harmony_snow`·`atlas_biome_dungeon` 으로 2번 `retired-easyrpg-tileset` 거부. `genre-20261007/gemini-time-gate-chrono/tools.jsonl` — 숲길 던전 `forest_harmony` 3번 거부, 결국 beodeul_city 위에 지음. `genre-20261007/gpt-time-gate-chrono/check.txt` — `brief-no-dungeon`. `genre-20261008/*-lighthouse-jrpg/project.json` — 얼어붙은 해안 동굴을 beodeul_city(24×20)·atlas_biome_interior(18×14 네모 방)로 대체. 지금 origin/main 에는 그 칩셋들이 아예 없고, 조수 안내는 여전히 「던전·숲·들판은 등록 장소를 import」(`src/editor/tools/toolRegistry.ts:183`)인데 해당 장소는 0곳. |
| 2 | **공용 DB 손 도트 기물(951종)이 맵에 안 보임 / 빌더에 못 넘김** | 못 닿음 (그림은 있음) | 무림·현대 가게·현대 학교·병원·사무실·SF 기물 전부가 여기 걸림 / 시험 4판 | `qa-runs/harnesses/space-craft/20261007-gpt/murim-dojo-r1/trace.json` — `wooden dummy` 9개·무기대 찍기 성공 보고 뒤 조수가 「등록된 목인장 그림이 실제 화면에 표시되지 않습니다」로 `ask_missing_tiles`. `20261007-gpt/modern-store-r1` — 공용 킷 `drink fridge`·`store shelf`·`register counter` 12번 찍기 성공, 판정자 둘 다 「방 안에 아무런 가구가 없다」(judge.json, 1.7/1.3점). `20261008-gpt/{fantasy-inn,murim-dojo}-r1/trace.json` — `read_tileset_reference(shared_hand_interior_harness)` 가 「fetch() URL is invalid」. 원인은 확정 못 함(이식 그림=공용 DB 업로드 아틀라스 로드 실패 의심). |
| 3 | **현대 학교 실내**(교실·복도·계단·화장실·사물함·교무실) + **기숙사 방** + 대학 캠퍼스 외관 | 부품 없음 | 학교 호러, 연애·회상 / 시험 1판(+메모리 노트) | `qa-runs/genre-20261007/gemini-harbor-romance/project.json` — 「해송고 학교」「기숙사 방」이 beodeul_city. jp_city 실내 방 종류에 교실 없음(`jpInteriorSpec.json` rooms). 공용 DB 에는 「학생 책상·칠판·교탁·사물함」 기물만 있음(#2 로 막힘). 메모리 `romance-preset-first-build.md`: 대학 캠퍼스 그림 없음. |
| 4 | **농장**: 경작지 오토타일, 밭 울타리·출하 상자·가공 설비, 헛간·외양간 실내 | 부품 없음 (+ 런타임 칸 번호가 지워진 시트를 가리킴) | 농장 생활, 생활·경제 4 / 시험 0 | `src/project/defaults/chipsetMapping.ts:108`(FARMLAND_TILE 187…), `src/player/playSceneFarming.ts:40-43,108-118`. beodeul 키트에 「밭」 20개는 포도밭 이랑·사막 물길 밭뿐, 「작물·경작·farm」 0. 장소 검색 「농장」 0건(장소 이름·키트 이름·태그를 `matchesQuery` 와 같은 부분 문자열 규칙으로 대조한 재현). |
| 5 | **미술관·박물관 실내**(전시 벽 액자 여러 크기, 조각 받침, 유리 진열장, 차단봉, 회랑) | 부품 없음 | 갤러리 호러, 낚시·박물관 기증 / 시험 0 | 손 도트 실내 기물 「그림」 1·「석상」 3(`handInteriorSpec.json`), 건물 템플릿에 미술관 없음. 검색 「미술관」「갤러리」「박물관」 번들 0건(장소 이름·키트 이름·태그를 `matchesQuery` 와 같은 부분 문자열 규칙으로 대조한 재현). |
| 6 | **야외 필드: 키큰 풀·풀숲**(버들항), 숲 길 가장자리 | 부품 없음 | 모험(필드), 탐험(숲 샛길·순환 숲), 몬스터 수집을 버들항에서 할 때 / 시험 0 | `src/editor/tools/wildRouteBeodeul.ts:5-6,26` — 「버들항 시트에는 키큰 풀 오토타일이 없어서… 짙은 잎 무늬 풀(11628)로 깐다. 제대로 된 키큰 풀은 시트에 손 도트로 더해야 한다」. 숲마을 필드 장소 7곳은 정리로 삭제. |
| 7 | **배 실내·갑판**(선실·선창·갑판·돛대) | 부품 없음 | 세계·사건(배편), 해적·항구 모험 / 시험 0 | 정리 전 `interior-ship-cabin`·`interior-ship-hold`(easyrpg_chipset_ship) 삭제. 손 도트 실내 기물에 「선실」 태그 10개는 있으나 배 건물 템플릿·선체 벽 없음. atlas_vehicles 는 바깥 모습만. |
| 8 | **투기장·콜로세움**(로마풍 버들항에 맞는 경기장·관중석·대기실) | 부품 없음 | 반복·도전(투기장 웨이브), 첫 전투 수련장 / 시험 0 | 검색 「투기장」 번들·공용 DB 0건. 정리 전 `dungeon-arena-floor`·`interior-arena-waiting-room` 삭제. |
| 9 | **근미래·SF 시설**(연구소 벽·바닥·문, 발전기·승강기, 우주선 실내) | 칩셋 통째로 없음 | 던전 진행(무너지는 연구소·승강기), 시대·인과(미래 폐허) / 시험 0 | 손 도트 실내 「마도 기관실」은 스팀펑크. 공용 DB 「SF 우주선」 14개는 기물만(#2). `worldTerrainTools.ts:218` 의 `modern-sf` 테마는 도쿄 거리 칩셋을 가리킬 뿐. |
| 10 | **현대 비일본 마을·항구**(한국·서양 교외, 현대 항구) + 현대 시작 칩셋 고르기 | 못 닿음 + 일부 그림 없음 | 연애·회상, 현대 초능력 JRPG / 시험 1판 | `genre-20261007/gemini-harbor-romance/project.json` — 「항구 거리」「축제 광장」이 beodeul_city. jp_city·modern_city 는 시스템 지시문 경로가 없고 새 프로젝트 기본이 beodeul 이라 계열 관문(`TILESET_FAMILY_POLICY_LINE`)에 막힌다. 한국·서양 현대 거리 그림은 어느 칩셋에도 없음. |
| 11 | **조선·마법 학교·도쿄 칩셋 길 내기** | 못 닿음 | 사극·한국 전통, 마법 학교, 현대 도시 / 시험 4판(무림 과제에서 조선 0회) | `src/ai/piAgent/systemPrompt.ts` 에 joseon·wizarding·modern_city 언급 0. 조선은 빌더·roomKit 없음. 무림 과제 4판 trace 에 joseon 0회(`grep -l joseon qa-runs/...` 0). Phase 0 W0-1 로 진행 중이라 웨이브에서는 제외. |
| 12 | 묘지(야외)·현대 사무실/경찰서 실내 | 부품 없음 | 호러·추리 / 시험 0 | beodeul 「무덤」 2개(사막). 공용 DB 「현대 사무실」 13개는 기물만(#2). 낮은 우선순위. |
| 13 | 창턱(벽면) 화분, 작업대 위 도구 같은 벽면·탁상 소품 | 부품 일부 | 방 / 시험 3판 | `space-craft/20261007-{gemini,gpt}/room-bedroom-r1/judge.json` 「창가의 화분」 없음(화분이 바닥 한가운데). 손 도트 실내 `plant` 는 「창가 구석」 바닥 기물. 대장간 판정 「작업대 위 도구·금속 재료 부족」(`20261007-gpt/fantasy-smithy-r1/judge.json`). 장난감 상자(`toy box`)는 이미 있으므로 아이 방 「장난감 없음」 지적은 배치 문제다. |

판단 못 한 것: 몬스터 키트 7장의 세부 빈칸(조사 안 함), Scarloxy 3장의 조수 노출 여부(`generate_map` 숨김 외 경로), atlas_vehicles 계열, 농장 경작지가 실제로 어떤 그림으로 보이는지(화면 확인 안 함).

---

## 제안 웨이브 (무림·jp_city 상점 실내 제외)

동시 작업자 최대 2(로드맵 원칙). 그림은 칩셋마다 전용 하네스 → 사람이 고름 → 번들·참고문서 배선 → 조수 시험.

- **W-A (그림 없음, 길 고치기) — 공용 DB 기물이 실제로 보이게.** #2. 찍은 기물이 jp_city·beodeul 맵에서 보이는지, `shared_hand_interior_harness` 참고문서가 읽히는지, `build_hand_interior_room` 이 공용 기물 id 를 받을 수 있는지. 이것만 풀려도 #3·#9·#12 의 「기물」 쪽 빈칸 상당수가 메워진다. 그림 제작 전에 먼저 한다.
- **W-B — 던전·동굴 칩셋 (oprn-atlas 계열 화풍).** #1. 동굴 벽·바닥 오토타일, 물·용암·얼음 물가, 계단·함정·문, 그리고 불규칙 동굴을 짓는 빌더(또는 `build_hand_interior_room` 의 비네모 확장). 버들항 던전 키트(바다 동굴·카타콤·하수도·화산 동굴)를 재료 원본으로 쓴다. 끝나면 `retiredEasyRpgTilesets` 의 「대체 칩셋 없음」 안내와 toolRegistry 의 「등록 장소를 import」 안내를 새 경로로 바꾼다.
- **W-C — 필드·농장 땅.** #6·#4. 버들항 시트에 키큰 풀·풀숲 오토타일, 경작지 오토타일(그리고 농사 런타임의 FARMLAND_TILE 을 칩셋별 역할표로 바꾸기), 밭 울타리·출하 상자·헛간 실내.
- **W-D — 현대 실내 확장 (jp_city 계열).** #3·#5·#12. 학교 실내(교실·복도·계단·화장실·사물함·교무실), 기숙사 방, 미술관·박물관 전시실, 사무실·경찰서. jp_city 상점 실내 작업과 같은 하네스·같은 roomKit 경로를 탄다.
- **W-E — 판타지 특수 공간 (버들항·손 도트 실내).** #7·#8·#13. 배 실내·갑판, 투기장·관중석·대기실, 벽면·탁상 소품(창턱 화분·작업대 도구).
- **W-F (Phase 4 후보, 사용자 선택) — 새 계열.** #9·#10. 근미래·SF 시설 칩셋, 한국·서양 현대 마을·항구. 현대 시작 칩셋 고르기 경로는 Phase 0 의 길 내기와 같이 처리한다.
