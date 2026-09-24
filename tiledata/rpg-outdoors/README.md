# 야외 장소

마을·성소·이야기 장면·필드·80×64 대계곡·월드맵 24곳. 숲마을 부품(절벽·계단·폭포·다리·흙길·숲 윤곽·나무 도장·소품·항구 부품 #1439)으로 짰다.
지형과 배치만 있다. 이벤트·NPC·이동은 없고, 출구마다 어디와 맞닿는지(`meets`)만 적었다.

| 장소 | id | 타일셋 | 크기 | 분류 |
|---|---|---|---|---|
| 잿빛 고개 국경 관문 | outdoor-border-fortress | forest_harmony(이식 포함) | 50×40 | 마을 |
| 왕도 은빛 성곽 | outdoor-royal-capital | forest_harmony(이식 포함) | 74×78 | 마을 |
| 갈매기 어촌 | outdoor-fishing-village | forest_harmony(이식 포함) | 46×38 | 마을 |
| 안개늪 마을 | outdoor-swamp-village | forest_harmony(이식 포함) | 44×36 | 마을 |
| 무너진 옛 도읍 | outdoor-ruined-city | forest_harmony(이식 포함) | 48×40 | 마을 |
| 쇠망치 광산 마을 | outdoor-dwarf-mine | forest_harmony(이식 포함) | 44×44 | 마을 |
| 요정 샘 신성한 숲 | outdoor-fairy-spring | forest_harmony(이식 포함) | 36×30 | 성소 |
| 까마귀 묘지 언덕 | outdoor-graveyard-hill | forest_harmony(이식 포함) | 40×34 | 성소 |
| 봉인된 옛 제단 | outdoor-sealed-altar | forest_harmony(이식 포함) | 34×30 | 성소 |
| 첫걸음 벼랑 전망대 | outdoor-opening-overlook | forest_harmony(이식 포함) | 40×30 | 장면 |
| 별빛 축제 광장 | outdoor-festival-plaza | forest_harmony(이식 포함) | 40×32 | 장면 |
| 노을빛 엔딩 들판 | outdoor-ending-meadow | forest_harmony(이식 포함) | 40×30 | 장면 |
| 구름재 산길 협곡 | outdoor-mountain-pass | forest_harmony(이식 포함) | 44×56 | 필드 |
| 검은물 늪지 필드 | outdoor-swamp-field | forest_harmony(이식 포함) | 56×40 | 필드 |
| 세폭포 대계곡 | outdoor-great-valley | forest_harmony(이식 포함) | 80×64 | 필드 |
| 모래바람 오아시스 도시 | outdoor-desert-oasis-city | forest_harmony_desert | 48×40 | 사막 마을 |
| 금빛 모래언덕 | outdoor-desert-dunes | forest_harmony_desert | 56×40 | 사막 필드 |
| 야자 해변 해안 절벽 | outdoor-beach-cliffs | forest_harmony_desert | 56×36 | 사막 필드 |
| 서리성 설원 요새 | outdoor-snow-fortress | forest_harmony_snow | 60×50 | 설원 마을 |
| 푸른 빙하 설원 | outdoor-snow-glacier | forest_harmony_snow | 56×40 | 설원 필드 |
| 불꽃산 화산 지대 | outdoor-volcano-zone | forest_harmony_volcano | 56×40 | 화산 필드 |
| 바람초원 유목민 천막촌 | outdoor-nomad-camp | forest_harmony_autumn | 40×32 | 가을 마을 |
| 잿빛 들 옛 전쟁터 | outdoor-old-battlefield | forest_harmony_autumn | 48×36 | 가을 필드 |
| 은빛 왕국 대륙 전도 | outdoor-world-map | oprn_world_keyed(월드 칩셋 분홍 키 사본) | 72×56 | 월드맵 |

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(출구·절벽·집·소품과 주인·깔개·잎 없는 나무 자리 `bareTreeSpots`)과 맵 24장 |
| `validation.json` | 입구에서 출구·문 앞·계단 끝까지 런타임 `canMove`로 닿는지, 쓴 씨앗 |
| `images/` | 앱 렌더러로 그린 그림(칸당 16px) |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedFieldRouteReferences.json`의 `field-routes-*-v5`(설원·화산·사막 `-v6`)·`rpg-outdoors-world-v1` 분류와 같은 본문) |

재생성 순서(렌더·캡처는 dev 서버 `npm run dev:worktree`가 떠 있어야 한다):

```bash
node scripts/content/author-rpg-outdoors.mjs              # OUTDOOR_ONLY=<id,id> 로 일부만
DEV_URL=http://127.0.0.1:<port> node scripts/content/render-rpg-outdoors.mjs
node scripts/content/prepare-field-routes-references.mjs  # 마을 사이 필드와 한 분류에 문서가 들어간다
node scripts/content/save-field-routes.mjs                # 같은 정본 프로젝트에 필드와 야외 장소를 함께 저장
node scripts/content/prepare-field-routes-regions.mjs output/evidence/field-routes/reloaded.json
BASE=http://127.0.0.1:<port> node scripts/qa/capture-rpg-outdoors.mjs
```

- 채우기(`lib/outdoor-kit.mjs` 의 `fill`, 기후별 재료는 `lib/rpg-outdoor-fill.mjs`): 풀·꽃·덤불·바위는 L자 셋 이상 덩이로만 두고 한 줄 셋 이상으로 늘어놓지 않는다. 짙은 수풀(`builtin_undergrowth` 9·11·39~41·69~71·99~101)과 검은 덤불 986~988·1016~1018·1046~1048 은 쓰지 않는다(24장 모두 0칸). 주인(집·광장·물가) 없는 소품은 저작기가 지운다.
- 키큰 풀은 `arrangeTallGrass`(E 숲가·F 트인 곳·G 집길 곁)로만 깐다. 사막·설원·화산·가을 땅에는 깔지 않는다.
- 사막·화산 맵(오아시스·모래언덕·해변·화산)에는 잎 달린 나무(도장 960~1123·수관 덩이)를 두지 않는다. 채우기가 1×2 자리를 남겨 두면 `OutdoorMap.bareGroves` 가 그 자리를 후보로 [잎 없는 나무](../climate-villages/README.md) 덩이(2880~3029, `lib/bare-trees.mjs` `arrangeBareGroves`)를 세운다. 한 덩이는 큰·중간 나무 한 그루와 곁나무, 밑동 옆 바위·마른 덤불로 되어 있다. 덩이 사이는 가장자리 8칸·안쪽 13칸이다. 채우기는 바위·선인장 무리를 두지 않고 느슨한 `fillGate`(8칸·66%)에서 멈추고, 남은 빈칸은 `OutdoorMap.climateGround`(`lib/climate-terrain.mjs`, 2026-09-25)가 **땅으로** 메운다. 화산은 식은 용암 판·용암 균열·작은 용암 웅덩이(분기공·유황)·현무암 기둥 한 무리이고, 봉우리는 맵에 서너 쌍까지 둔다. 사막은 사구 벌판(사구 3~6개, 바닥은 모래 물결)·모래 물결·갈라진 땅·메사·외딴 뼈 한 곳·선인장 무리 두세 곳이다. 길·포장·문 앞·집 한 칸 둘레에는 깔지 않고, 통행 불가 조각이 문·출구·소품으로 가는 길을 끊으면 되돌린다. 덩이 밑동 바위는 열에 셋 정도(`groveRockChance`)만 둔다. 풀은 쓰지 않는다. 결과는 `catalog.json` 의 `ground`(조각 수·칸 수)에 있다. 결과는 `catalog.json` 의 `bareGroves`(덩이 수·나무 수·같은 줄 최대 그루 `fenceRow` ≤3)에 있다.
- 빈칸 검사 기준: 마을 한 덩이 ≤4칸·한 화면 ≤40%, 필드 ≤5·≤50%, 월드맵 ≤7·≤70%(저작 목표는 62%).
- 월드맵은 `lib/rpg-outdoor-world.mjs`. EasyRPG 월드 칩셋의 아이콘 바탕은 불투명 분홍(#ff678b)이라 `transparentColor` 를 준 사본 `oprn_world_keyed` 에 그린다.
- 갈매기 어촌의 부두 소품은 #1439 항구 부품(나룻배·계류 말뚝·밧줄 뭉치·닻·부두 술통·부두 상자·열린 물통, `lib/village-harbor.mjs` 의 HARBOR_SLOTS)을 `lib/harbor-kit.mjs` 로 부른다.
