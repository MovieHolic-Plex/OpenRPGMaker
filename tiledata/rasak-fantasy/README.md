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
- 이미 있는 연구 프로젝트는 `apply --atlas-dir <baked>` 로 아틀라스 그림·칸 수를 갈아 끼운다(칸 수가 늘어난 경우만; `build_assistant_pack.py` 는 덤프가 짧으면 새 칸을 기본값으로 채운다).

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
