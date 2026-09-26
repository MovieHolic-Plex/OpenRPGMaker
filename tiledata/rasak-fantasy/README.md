# Rasak's Fantasy Tileset — 비공식 지원 (그림 없음)

- 팩: Rasak's Fantasy Tileset — https://rasak.itch.io/rasaks-fantasy (작가 Rasak)
- 라이선스 요지: 사용·수정 가능(크레딧 필수), **원본·수정본 그림의 재배포 금지**, 링크는 허용.
- 그래서 이 폴더와 `scripts/content/rasak/` 에는 **설정과 스크립트만** 있다. 팩 PNG 나 그로부터
  만든 아틀라스·렌더·맵 캡처는 저장소에 절대 넣지 않는다. 작업물은 `~/third-party-assets/rasak/` 에 둔다.
- 게임에 쓸 때 크레딧: `Tileset: Rasak's Fantasy Tileset by Rasak (https://rasak.itch.io/rasaks-fantasy)`

## 파일

| 파일 | 내용 |
|---|---|
| `bundles.json` | 팩 정보, 시트별 sha256(팩 버전 확인용), MZ 슬롯(A1~E + 추가 시트 + 특수 건물 그림) 묶음 5개: `rasak_field` · `rasak_swamp` · `rasak_cave` · `rasak_town` · `rasak_interior` |
| `substitutions.json` | 제작자 프리뷰(2022 스크린샷) 이후 다시 그려진 그림 자리에 현재 시트의 같은 물체를 통째로 놓는 수동 대체 |
| `names.json` | 묶음별 이름표(글만): 자동타일 kind(이름·역할·층·통행·대표 번호·모양별 칸 번호)·물체(이름·칸 배열·층·통행)·그림자 비트. 번호는 굽기 아틀라스(96칸 폭) 기준 |
| `mz-autotile-masks.json` | OPRN 이웃 마스크 → MZ 모양 표(바닥 256·벽 16·폭포 4), 관찰된 연결 규칙, 프리뷰 검증 수치 |

## 파이프라인 (사용자가 직접 받은 팩 기준)

```sh
# 0. 팩을 받아 풀기 (RAR5 — 7z 는 못 푼다, unrar 또는 node-unrar-js)
#    ~/third-party-assets/rasak/extracted/Fantasy/Tileset/...
# 1. 묶음마다 OPRN 아틀라스(96칸 폭) 굽기: MZ 자동타일 전 모양·A1 애니 프레임·그림자 15종
python3 scripts/content/rasak/bake_atlas.py --source ~/third-party-assets/rasak/extracted/Fantasy/Tileset \
  --bundle rasak_field --out ~/third-party-assets/rasak/baked
# 2. 제작자 프리뷰를 칸 단위로 역재구성 (MZ 스택 그대로)
python3 scripts/content/rasak/reconstruct_preview.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --preview ~/third-party-assets/rasak/previews/p01.png --id rasak_preview_p01 --name "Rasak 재현 · 일본 정원" \
  --out ~/third-party-assets/rasak/maps --substitutions tiledata/rasak-fantasy/substitutions.json
# 3. OPRN 은 칸당 lower 1장 + upper 1장만 그린다(타일 스택은 은퇴, mapOverlayTiles.ts).
#    여러 겹인 칸을 합성 타일로 접는다. 애니 물 위 합성은 프레임마다 합성해 strip 으로 등록.
python3 scripts/content/rasak/fold_layers.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --maps ~/third-party-assets/rasak/maps
# 4. 두 층 렌더로 독립 검증
python3 scripts/content/rasak/verify_folded.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --map ~/third-party-assets/rasak/maps/rasak_preview_p01.folded.map.json \
  --preview ~/third-party-assets/rasak/previews/p01.png --phase 0,0
# 5. 로컬 전용 연구 프로젝트(SQLite)로 저장 → oprn-serve 로 열기
node scripts/content/rasak/publish-study-project.mjs --baked ~/third-party-assets/rasak/baked \
  --maps ~/third-party-assets/rasak/maps --project-dir ~/third-party-assets/rasak/study-project
node scripts/oprn-serve.mjs --project-dir ~/third-party-assets/rasak/study-project --port 9837
# 3'. (합성 대신) 스택을 1·2층·그림자·3·4층에 그대로 싣기 — 칸에 다 안 들어가는 스택만 그 무리를 합성으로 되돌린다.
#     *.layers.map.json + atlas.layers.png 를 만들고, publish 에 --layers 를 주면 그것을 싣는다.
python3 scripts/content/rasak/stack_to_layers.py --baked ~/third-party-assets/rasak/baked/rasak_field \
  --maps ~/third-party-assets/rasak/maps
node scripts/content/rasak/publish-study-project.mjs --layers --baked ~/third-party-assets/rasak/baked \
  --maps ~/third-party-assets/rasak/maps --project-dir ~/third-party-assets/rasak/study-project-layers
# 6. 조수 지식 묶음: 칸 이름표(tileMeta)·재료 묶음(tileGroups)·자동타일 그룹(autotileGroups, 8이웃 variantMap + 연결 규칙)·
#    용도별 참고문서(field_garden·field_cliff·swamp·cave_ice·cave_lava — MD + 층 분해·완성 예제·바닥 견본·물체 도감·정상/오류 그림)
#    그림이 든 결과는 저장소 밖(/tmp/mzai)에만 쓴다. 저장 전에 프로젝트 폴더를 cp -a 로 백업하고 fuser 로 DB 를 연 프로세스가 없는지 본다.
bun build scripts/content/rasak/apply-assistant-pack.mts --target=node --outfile /tmp/mzai/apply.mjs
node /tmp/mzai/apply.mjs dump --project ~/third-party-assets/rasak/study-project-layers --out /tmp/mzai/pack/original-tilesets.json
python3 scripts/content/rasak/build_assistant_pack.py --assets ~/third-party-assets/rasak \
  --original /tmp/mzai/pack/original-tilesets.json --out /tmp/mzai/pack --preview-dir /tmp/mzai/pack-preview
node /tmp/mzai/apply.mjs verify --project ~/third-party-assets/rasak/study-project-layers --pack /tmp/mzai/pack/pack.json  # 실제 엔진 재현율
node /tmp/mzai/apply.mjs apply  --project ~/third-party-assets/rasak/study-project-layers --pack /tmp/mzai/pack/pack.json  # 저장 → 다시 열어 왕복 확인
# 7. Pi 시험용 JSON(그림 인라인): trial.json(지식 포함) · trial-nodocs.json(참고문서·묶음·자동타일 그룹 없음, 원래 이름표) + 빈 30×20 시험 맵 3장
node /tmp/mzai/apply.mjs export --project ~/third-party-assets/rasak/study-project-layers --original /tmp/mzai/pack/original-tilesets.json --out-dir /tmp/mzai
```

## 조수 지식 묶음 (2026-09-25)

- 용도(작업 단위) 5개, 용도마다 MD ≤5쪽(각 문서 6000자 이하 = 한 페이지)·그림 ≤8장. 첫 문서 첫 줄 `layer-model: mz4`.
- 자동타일 연결 규칙은 분류별 후보(같은 종류만 / 물끼리 / 땅→벽·윗면·A5·1층 물체 / 윗면끼리 / 벽→A4)를 프리뷰에 대 보고 가장 잘 맞는 것을
  `connectTileIds` 로 싣는다. 실제 엔진(`autotileEngine.ts`) 재현율(테두리 칸 제외, p27b 옛 암반 제외, 장식=2층으로 옮긴 프리뷰):
  1층 75.7%(같은 종류만 49.5%) · 2층 81.7%. 남은 차이는 제작자가 모양을 고정해 칠한 칸과, 엔진이 방향을 가리지 않는 벽 규칙.
- 예제 창에는 합성 칸이 없어야 하고(스크립트가 막는다), p27b 둘레 암반은 엔진 모양으로 바꿔 싣는다.

## 마을·실내 묶음 (2026-09-25)

- 묶음 `rasak_town`(A1 도시 물 · A2 도시 땅 · A3 City1 지붕 16종+벽 16종 · A4 도시 벽 · A5 도시 · B 마을 · C 건물 · D 구조물 · E 시장 · 추가 울타리·정원·농장·작물·여름 나무)과
  `rasak_interior`(A2 실내 바닥·양탄자·탁자형 · A4 집 천장+벽 · A5 집 · B 집 · C 거실 · D 주점 · E 창고 · 추가 대장간·재봉·왕실).
  이름표: town kind 139 · 물체 796, interior kind 104 · 물체 1003, 이름 없는 조각 0. 층은 명세 플래그(`L1` 바닥재 · `L2` 깔개 · `L4` 탁상 소품·굴뚝)로 정한다.
- 이 두 묶음은 **제작자 타일 프리뷰가 없다**(p24 는 손그림 세계 지도). p21·p22·p26 실내는 있지만 조명 덧칠 + 이 묶음에 없는
  시트(성 돌벽·특수 건물)를 써서 `reconstruct_preview.py` 로 되살리면 칸이 엉뚱하게 채워진다(2026-09-25 시도: p21 완전 일치 35%, p26 0.1%).
  그래서 구성(방 수·가구 세트·벽 리듬)만 본보기로 삼는다. 그래서 `compose_examples.py` 가
  MZ 기본 규칙(같은 kind 끼리 잇기, 맵 가장자리 = 이어짐)으로 조립한 예제 맵 4장(`ex_village`·`ex_city`·`ex_house_room`·`ex_tavern`)을
  `maps/rasak_preview_ex_*.layers.map.json` 으로 써서 프리뷰 자리에 넣는다. 예제 명세는 `compose_examples_specs.py`(kind 번호·물체 id).
  실제 엔진으로 예제의 자동타일을 다시 잡으면 100% 같다(`apply-assistant-pack verify`).
- 참고문서 용도 4개 추가: `town_village`·`town_city`(A3 지붕+벽 집 짓기 조리법, 도시 큰길·좌판 조립) · `interior_house`·`interior_tavern`
  (A4 천장 테두리 → 벽면 두 줄 → A2 바닥, 벽걸이·키 큰 가구·탁상 소품 4층 규칙, 실내는 네모 방이 정상, 오류 그림 ⑤벽면 빠뜨림 ⑥벽걸이를 바닥 줄에).
- **예제 품질 기준(적대적 시각 QA 2026-09-25)**: 첫 예제는 빈 바닥 46~60%·도시 좌우 대칭 4.8배·방 하나 상자였고 조수가 그대로 따라 했다.
  다시 조립한 예제는 `check_examples.py` 를 넘는다 — 빈 바닥 %(3×3 이웃에 2·3층 없는 바닥)·가장 큰 빈 정사각형·좌우 대칭 배수(우연 = 1)·실내 허공 %,
  기준은 제작자 재구성 맵(p01·p02·p28·p27a)에서 잰 값. 숫자는 속일 수 있다(1칸 덤불 무더기로 통과한 숲이 죽은 숲처럼 보였다) — 그림을 반드시 본다.
  조립기(`Canvas.obj`)는 같은 층 덮어쓰기·지붕/벽 위 바닥 물체·벽면 밖 벽걸이·밑 없는 4층·바닥 아닌 2층 장식·맵 밖 잘림을 막는다.
- MZ 자동타일은 **맵 밖 = 이어짐**이다. 팩의 autotileGroups 는 `edgeConnects: true` 를 싣고 엔진(`autotileNeighborMask`)이 이를 따른다 —
  없으면 조수가 깐 벽·천장·풀밭이 맵 둘레마다 가는 테두리 선을 그린다.
- 모든 Rasak 묶음 타일셋은 `family: "rasak-fantasy"` 로 발행한다 — 조수의 칩셋 계열 규칙(같은 계열끼리는 말없이 오간다)이 이걸 본다.
- 순서: `bake_atlas.py --bundle rasak_town|rasak_interior` → 이름 명세(`knowledge/work/new/spec_*.py`, 로컬) → `knowledge/work/build.py` →
  `compose_examples.py` → `check_examples.py` → `publish-study-project.mjs --layers`(새 폴더) → `apply dump` → `build_assistant_pack.py` →
  `apply verify|apply [--example-maps <maps>]|export`.
  새 묶음은 합성 칸이 없으므로 `manifest.layers.json`·`atlas.layers.png` 는 `manifest.json`·`atlas.png` 사본이다.

## 특수 건물 43채 (2026-09-25)

- `Special_Buildings/*.png` 는 타일 시트가 아니라 **건물 한 채가 통째로 그려진 그림**(해변 오두막·여관·대장간·상점·교회·항구·바이킹·사냥 야영)이다.
  `bundles.json` 의 `rasak_town.buildingSheets` 로 묶고, `bake_atlas.py` 가 그림마다 `S<n>` 구역으로 굽는다 — 오른쪽·위에 투명을 덧대 48 배수로 맞추고
  (밑변이 칸 경계에 붙게), 완전히 투명한 칸은 아틀라스에 넣지 않으며, 구역의 `grid`([y][x] → 아틀라스 번호, -1 = 빈 칸)를 manifest 에 적는다.
  새 구역은 기존 구역 뒤·그림자 앞에 붙으므로 **앞 칸 번호는 그대로**다(마을 아틀라스 9600 → 13824칸, 4608×6912px).
- 건물 이름표(로컬 `knowledge/work/new/special_buildings.json`): 한국어 이름·쓰임·설정·문 칸·본체 범위(mass)·걸을 수 있는 데크·마당 여부·입구(entry: 문·정면·데크·계단·사다리·판매대·작업장).
  43채 중 문 그림이 있는 것은 19채뿐이다 — 나머지는 데크·사다리·판매대가 입구이고, 8채(뒷면·옆면·교회 옆면·사냥 야영 등)는 입구 없는 **배경 건물**이다.
  통행: 본체는 막힘, 본체 기둥마다 맨 윗칸 ★, 입구·데크 칸은 통과, 마당은 불투명 50% 넘으면 막힘(낮은 울타리는 통과로 잡힐 수 있다).
- 팩은 건물마다 `structureKits` 항목 `sb_<건물>`(3층 `upperTiles`, 입구 = `parts[kind:entrance]`)을 싣는다. 조수는 칸 배열을 옮겨 적지 않고
  `stamp_object({objectId:"kit:rasak_town/sb_<건물>", mapId, x, y})` 한 번으로 찍는다. 참고문서 용도 `town_buildings`(쓰는 법 · 완성 예제 실행 순서 · 목록) +
  그림(예제 1 + 설정별 목록 6). `town_village`·`town_city` 조리법 첫머리에 「완성 건물이 먼저」.
- 예제 `ex_town_buildings`(40×28, `compose_examples_specs.py`) — 여관·상점·대장간·창고를 큰길 양쪽에, 길은 입구 바로 아래 칸에서 끝. `check_examples` 빈 바닥 21% · 빈 정사각형 4 · 대칭 1.2.
- `town_village` 의 기준 맵을 `ex_town_buildings` 로 바꿨다 — 조수는 조리법 문장(「완성 건물이 먼저」)보다 **예제**를 따른다(시험 E: 문서만 → 조립 집, E2: 예제 교체 → 완성 건물 넷).
  예제 배열에서 건물 킷 칸은 -1 로 비우고 「비운 자리 = stamp_object kit:… 원점」 줄로 알린다(배열로 건물을 조각내 옮기지 않게). 물체 사전의 건물 줄도 칸 배열 대신 킷 호출이다.
- `stamp_object` 는 입구 부위가 있는 킷을 찍으면 요약·data 에 **입구 맵 좌표와 길 끝 칸**을 돌려준다(E2 에서 길이 지붕으로 가던 것이 E3 에서 입구로 간다).
- 이미 있는 연구 프로젝트는 `apply --atlas-dir <baked>` 로 아틀라스 그림·칸 수를 갈아 끼운다(칸 수가 늘어난 경우만; `build_assistant_pack.py` 는 덤프가 짧으면 새 칸을 기본값으로 채운다).

## 상점·성 실내 예제 3개 (2026-09-25)

- 실내 묶음에 이미 들어 있던 대장간(`smith_*` 163)·재봉(`tailor_*` 106)·왕실(`royal_*` 107) 물체로 예제 셋과 참고문서 용도 셋을 만들었다.
  `interior_smithy`(ex_smithy 26×17 — 불 작업장/무기 가게/창고) · `interior_tailor`(ex_tailor 22×16 — 가게/작업실/탈의실) · `interior_castle`(ex_castle 34×24 — 알현실/서재/침실/근위대/식당, 제작자 p21 구성).
  `check_examples` 빈 바닥 3·10·12% · 빈 정사각형 3·4·3 · 대칭 1.1·1.6·1.0.
- 성·대장간 작업장 벽은 **A5 평면 벽면**(돌 벽돌 3104, 아치 돌벽 3124)이다 — 이 팩 A4 벽에는 회색 돌벽이 없다. 성은 벽면 3줄이라 3×3 아치 창이 들어간다(`castle_interior`, 가로 문 `door_h3`).
  조립기(`compose_examples.py` `ground`)·검사기(`check_examples.py`)·오류 그림 ②⑤(`build_assistant_pack.py`)가 A5 막힌 벽면 그룹을 벽으로, 검은 빈칸을 천장으로 본다.
  사전 대표 번호(석판 3088 = 흰 벽돌 무늬, 막돌 3120)가 성에 맞지 않아 성 조리법(`room_notes`)에 실제 번호(석판 3091·아치 3124·벽돌 3104)를 적었다.
- 「벽 속 화덕」(`smith_furnace_wall_*`, 이름에 「벽돌 포함」·「벽 아랫줄에 놓음」)은 벽면 칸에 박는 물체라 조립 검사에서 벽 위 허용.

## 던전·성곽 묶음 (2026-09-26)

- 새 묶음 둘: `rasak_dungeon` "Rasak · 던전·지하묘지"(A1·A2·A4·A5 던전 + Dungeon·Crypt·Crypt2·SpiderRuin·Horror·Chaos·Temple 안) ·
  `rasak_castle` "Rasak · 성곽·폐허"(마을 A1·A5 + 자연 A2 + 성 A4 + Castle·Fort·Ruins·Ruins2·Battlefield·Old_World 1·2·여름 나무). A-슬롯이 묶음당 하나라 둘로 나눴다.
- 이름표: 던전 물체 730 · kind 121, 성곽 물체 371 · kind 107, 자동 분할 넓은 이름 0. 기존 다섯 묶음 이름표는 그대로다.
  Ruins·Ruins2 는 이름표 서브에이전트 둘이 그림을 못 받아(빈 첨부) 감독자가 직접 붙였다.
- 조립 예제: `ex_dungeon`(32×22 — 묘실·감옥·의식실·창고·입구 홀·옆 굴, 빈 바닥 5% · 빈 정사각형 2 · 대칭 1.9) ·
  `ex_castle_court`(36×26 — 흉벽 성벽·지붕 색 다른 성탑 둘·해자와 도개교·안뜰 돌길·나무 요새·폐허, 19% · 5 · 1.1).
  조립기는 성벽 부품 시트(`castle_*` — 흉벽·성문·탑)를 건물 부품처럼 성벽 윗면·벽면 위에 허용한다. `forest(edge=…)` 로 묶음마다 가장자리 덤불을 고른다.
- 참고문서 용도 둘: `dungeon_crypt`(9문서·그림 8) · `castle_court`(8문서·그림 8, 레시피 `castle` = 성벽 짓는 순서 6단계).
- 연구 프로젝트에 새 묶음 넣기: `apply-assistant-pack.mts add --baked <굽기>` 가 bundles.json 에만 있는 묶음을 타일셋·자산으로 더하고 다시 열어 확인한다
  (굽기 → 타일셋 변환은 `study-tileset.mjs`, `publish-study-project.mjs` 와 같이 쓴다). `apply --example-maps` 는 없는 예제 맵을 새로 단다.
- 헤드리스 시험 G1(빈 30×20, 문서 있음): 던전 — 방 나눔·석관·쇠창살·제단, 빈 바닥 9% · 정사각형 2 · 대칭 1.7 통과(벽 없는 그림자 7칸 알림).
  성곽 — 성벽·흉벽·성탑·해자·요새·폐허 모두 있음, 빈 바닥 32% 로 기준 30% 넘음(남쪽 풀밭 빔). 비교 그림 http://mdc-server:18301/rasak-dungeon-castle.html

## 엘프·설원·항구 묶음 (2026-09-26)

- 새 묶음 셋: `rasak_forestfolk` "엘프 숲 마을"(엘프 A3 + 집 4색 + 거대 나무 14장 + 사냥꾼 야영지·바깥 사원) ·
  `rasak_snow` "설원·바이킹 마을"(설원 A1·A2·A5 + 바이킹 A3 + 바이킹·눈 덮인 바이킹·야만족·바이킹 실내·역참) ·
  `rasak_port` "항구·배"(배 A2 + 선체 좌우·붉은·낡은 + 돛·검은 돛 + 배 장식 + 해변). 마을 A1·A3·A5·자연 A2 는 이미 붙인 이름을 그대로 쓴다.
- 이름표: 엘프 물체 723 · 설원 426 · 항구 470, 넓은 이름 0. 선체·돛·색 변형은 칸 투명도가 같아 한 장에서 옮겼다.
  이름표 서브에이전트 여럿이 그림을 빈 첨부로 받았다 — 배 장식·해변은 감독자가 확대 그림을 보고 다시 붙였고, 나머지는 검수 그림을 눈으로 확인했다.
- 조립 예제: `ex_elf_village`(36×26, 빈 바닥 11% · 정사각형 4 · 대칭 1.9) · `ex_snow_village`(22% · 5 · 1.1) · `ex_port`(28% · 4 · 1.3).
  거대 엘프 나무는 시트 왼쪽 세로줄이 한 그루(수관·윗줄기·껍질 머리·밑동)라 상대 위치 그대로 쌓는다. 배 한 척은 선체 시트 두 장을 **시트 배치 그대로** 잇는다(`sheet_block`).
  조립기 추가: `try_obj`(빈 바닥에만 찍기) · 이름에 「벽 장식」 있는 물체는 벽 위 허용 · `elftree_`·`sails_` 4층 면제.
- 참고문서 용도 셋: `elf_village` · `snow_village` · `port_harbor`(각 그림 8).
- **적대적 시각 QA(원 해상도 사분면)에서 예제 셋이 엉망이었다** — 지표는 통과했지만: 배가 선체 조각을 따로 찍어 두 척이 붙은 것처럼 보였고, 거대 나무가 조각으로 끊겼고,
  빈 바닥 수치를 맞추려 1칸 소품을 흩뿌렸고, 집에 문이 없었다. 고친 뒤(선체·나무는 시트 범위 통째, 문·창·문 앞 길, 흩뿌림 12%) 조수 시험 H2 는 셋 다 통과
  (엘프 25% · 설원 23% · 항구 26%)하고 배·나무가 한 덩이로 나왔다. 남은 결함(맵 가장자리 잘림·벽 붙은 나무·천막 겹침·잘린 줄기 토막)은 조리법 7번 「공통 금지」로 적었고 다음 시험에서 확인한다.
  비교 http://mdc-server:18301/rasak-forest-snow-port.html
- 검사기 `check_examples` 는 이제 A1 물을 빈 바닥으로 세지 않는다(넓은 바다·호수 맵이 늘 실패했다).
- 조리법 7번 「공통 금지」를 넣은 재시험 H3: 엘프 21%(정사각형 4) · 설원 21%(3) · 항구 3%(2) 모두 통과. 원 해상도에서 맵 가장자리 잘림·잘린 줄기 토막·천막 겹침이 사라졌다. 항구만 벽 없는 그림자 1칸.

## 계절 숲·도시2 묶음 (2026-09-26)

- 새 묶음 둘: `rasak_seasons` "계절 숲"(가을·겨울 나무, 가을·겨울·봄 숲바닥, 버섯 숲·겨울 버섯 숲, 거목 그루터기, 분홍 꿈 · A5 자연2) ·
  `rasak_town2` "정원 마을·판타지 도시·겨울 장터"(마을 A2 · 판타지 도시 A3 · 크리스마스 장터 · 가죽 공방·그림·빨래). 물체 955 · 405, 넓은 이름 0.
- 가을·봄 나무/숲바닥, 겨울 숲바닥, 겨울 버섯은 칸 투명도가 여름판·기본판과 같아(238/238 · 252/252 · 241/243) 번호를 옮겨 이름을 붙였다(`spec_o_trees_fall`·`floor_*` 파생).
  크리스마스 장터·가죽 공방은 이름표 서브에이전트가 빈 응답으로 멈춰 감독자가 원본을 보고 붙였다.
- 조립 예제: `ex_autumn_forest`(34×24, 빈 바닥 10%) · `ex_mushroom_forest`(32×22, 22%) · `ex_winter_market`(34×21, 23%).
  겨울 숲 예제는 이 묶음에 눈 바닥이 없어 뺐다 — 겨울 나무·겨울 버섯은 설원 묶음 바닥과 함께 쓴다(조리법에 적음).
- 참고문서 용도 셋: `forest_autumn` · `forest_mushroom` · `town_winter_market`. 연구 프로젝트 rev 17 → 18(add) → 19(apply), 다시 열어 12묶음 왕복 일치.
- 조수 시험 J1: 가을 숲 26% · 버섯 숲 28% · 겨울 장터 30%(한계선) 통과. 비교 http://mdc-server:18301/rasak-seasons-town2.html
- 서버 재부팅으로 `/tmp/mzai` 시험 도구가 지워졌다 — `~/third-party-assets/rasak/tools/`(run.sh·render_run.py·tasks.json·batch13.sh)에 사본을 둔다.

## 사막·정원·지하묘지·신전 묶음 (2026-09-26)

- 남은 미사용 시트 14장을 새 묶음 넷으로 덮었다: `rasak_desert` "사막 마을·서부 개척지"(물체 372) · `rasak_garden` "정원·꽃밭 마을"(369) ·
  `rasak_crypt` "해골 지하묘지"(A2·A4 Crypt · Chaos 시트, 389) · `rasak_temple` "신전·동양 실내"(Temple 안 두 장 · Japanese Inside, 303).
  `Bird Houses.png` 는 격자에 맞지 않아 뺐다.
- 서부 시트(Wild West) 윗부분은 완성 정면이 아니라 판벽·지붕·계단·차양 조각 모음이다 — 통째로 옮기면 뒤죽박죽이 된다(적대적 시각 QA). 집은 A3 로 짓고 시트에서는 이름 붙은 소품만 쓴다(참고문서에 경고).
- 조립 예제: `ex_garden_village`(34×22, 빈 바닥 18%) · `ex_desert_town`(34×22, 15%) · `ex_skull_crypt`(30×20, 8%) · `ex_temple_hall`(30×20, 22%).
  실내 두 예제는 처음에 방이 텅 비거나(없는 물체 id) 관·가구로 통로가 막혔다 — 문과 문을 잇는 통로 칸을 먼저 예약하고 방별 소품 풀로 채워 고쳤다.
- 팩 빌드 수정: 정상/오류 쌍이 넷뿐인 실내 용도(벽걸이 ⑥ 없음)에서 빈 줄로 `side_by_side` 가 죽던 것을 막았다.
- 참고문서 용도 넷: `town_garden_village` · `town_desert_west` · `dungeon_skull_crypt` · `interior_temple_hall`. 연구 프로젝트 rev 19 → 20(add) → 21(apply), 다시 열어 16묶음 왕복 일치.
- 조수 시험 K1: 사막 23% · 정원 30%(한계선) 통과. 지하묘지 9%·신전 22% 는 **예제 창 넷을 통째로 찍은 결과**(신전 3층 600칸이 예제와 같음)라 인정하지 않았다 —
  두 용도 문서에 「예제 창 통째 금지」를 넣고 과제를 예제와 다른 방 구성으로 바꿔 K2 로 다시 쟀다.
- K2: 지하묘지 16% 통과(복사 1/76칸)·신전 대칭 2.7배 실패(다다미방 둘에 같은 한 벌). K3: 둘 다 가운데 복도 양옆에 같은 폭 방을 지어 대칭 2.5·3.5배 실패.
  문서에 「좌우 거울 금지」(양옆 방 폭·깊이·가구 줄을 어긋나게)와 「같은 종류 방은 가구를 다르게」·「융단은 문에서 제단까지」·「그림자는 벽 오른쪽만」을 넣었다.
- K4: 지하묘지 22%(대칭 1.5, 복사 4/101칸) · 신전 28%(대칭 1.8, 복사 0/77칸) 통과. 연구 프로젝트 rev 24. 비교 http://mdc-server:18301/rasak-desert-garden.html

## 프리뷰 재현 결과 (2026-09-24, 두 층 렌더 기준)

| 프리뷰 | 묶음 | 완전 일치 | ±32 이내 | 남은 차이 |
|---|---|---|---|---|
| p01 일본 정원 | field | 91.1% | 92.8% | 2022 이후 다시 그려진 꽃·캐릭터(이벤트) |
| p02 절벽과 폭포 | field | 84.4% | 89.2% | 옛 꽃·고사리·거미줄, 캐릭터. 폭포는 첫 프레임 |
| p28 늪 | swamp | 98.5% | 99.9% | — |
| p27a 얼음 동굴 | cave | 98.3% | 99.1% | — |
| p27b 용암 동굴 | cave | 80.8% | 99.4% | 천장 밝기 1~2 차(옛 A4_Cave) |

## 통행 휴리스틱 (타일별 플래그를 쓰기 전 임시)

A1(물)·A3·A4(벽) 막힘, A2·A5·그림자 통과, B~E·추가 시트는 칸의 불투명 비율이 50% 넘으면 막힘,
합성 칸은 구성 중 하나라도 막히면 막힘. 우선순위는 B~E·추가 시트·upper 합성이 upper.
4층 판(`--layers`)은 2층에 쓰인 통과 A 타일을 ★(우선순위 upper)로 둔다 — 통행은 위에서부터 ★ 를 건너뛰므로
그래야 막힌 1층(물·벽)이 칸을 정해 합성 판과 통행 격자가 같다(5맵 `canMove` 비교: 60칸 차이 → 0칸).

## 남은 일

- 사용자가 팩 시트를 올리면 파일명/sha256 으로 알아보고 위 묶음 구성·타일 설명을 조수에게 주는 프리셋.
  `applyCustomChipsetMinimalHarness` 가 upper 를 잘못 옮기므로 프리셋 타일셋은 거기서 빼야 한다
  (Rasak Modern 선례와 같은 함정).
- 통행·우선순위를 휴리스틱 대신 타일별로 확정.
