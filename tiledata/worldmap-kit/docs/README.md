# 월드맵 키트

월드맵 설계 데모 v9 가 한 장짜리(지형 + 팔레트 + 아이콘 + 여정이 한 파이프라인에 섞인 것)였던 것을 **세계관마다 갈아끼울 수 있게** 4층으로 갈랐다.
같은 지형 위에서 팔레트(분위기)·아이콘 세트(세계관)·여정 템플릿(이야기)을 따로 고른다.

```mermaid
flowchart LR
  T["① 지형·경계 (공용)<br/>96x72 대륙 둘·내해·섬줄기<br/>장벽 4(산벽·바다·사구·하늘)"] --> B
  P["② 팔레트 (분위기)<br/>palettes/*.json<br/>지형 색 표만 교체"] --> B
  I["③ 아이콘 세트 (세계관)<br/>iconsets/*/manifest.json + sheet.png<br/>17 역할 × 정해진 칸 수"] --> B
  J["④ 여정 템플릿<br/>journeys/*.json<br/>역할 id + 좌표 + 막 + 열쇠/장벽"] --> B
  B["kit/build_world.py"] --> O["out/<세트>-<팔레트>.png<br/>+ world.json"]
  J --> C["kit/check_journey.py<br/>도달성 검사"]
```

| 층 | 바꾸는 것 | 안 바꾸는 것 | 어디 |
|---|---|---|---|
| ① 지형(공용) | — (모든 조합이 공유) | 땅·물·산·길·절벽 모양, 장벽 | `kit/lib/` |
| ② 팔레트 | 지형 픽셀의 색(role 별 램프·빛) | 모양, 아이콘(틴트 0.25 만큼만 빛) | `palettes/` |
| ③ 아이콘 세트 | 장소 그림(역할별 변형) | 칸 수(역할이 정한다) | `iconsets/<id>/` |
| ④ 여정 템플릿 | 어느 역할을 어디에 두고 어느 막에 넣을지, 열쇠·장벽 | 아이콘 그림 | `journeys/` |

## 폴더 규약

```
tiledata/worldmap-kit/
  ATTRIBUTION.md              출처·라이선스(CC BY 4.0, EasyRPG RTP World 파생)
  kit/
    roles.json                17 역할(id·칸 수) + fantasy 레거시 아이콘 매핑
    build_world.py            빌더
    check_journey.py          여정 도달성 검사
    selftest.py               자체 검사(화소 동일·보고 동일·입력 오류)
    lib/                      지형 파이프라인 사본(v9-final3) + kit_common/kit_world/kit_palette
    assets/world-plus.png     지형 도트 시트(EasyRPG World 수정본)
    ref/                      selftest 기준(design-1x-final3.png·map-v9-final3.json·journey-check-final3.txt)
    tools/                    한 번 돌린 변환 기록(fantasy 자산·문서 표 생성)
  iconsets/fantasy/           manifest.json + sheet.png   ← 다른 세트는 같은 이름 규약으로 옆에 둔다
  palettes/                   original ruin dusk winter ashfall regional
  journeys/fantasy-5act.json
  docs/                       이 문서 · role-mapping.md · palette-schema.md
  out/                        fantasy-<팔레트>.png ×6 · world.json · build-report.json · journey-check.txt
```

## ① 역할 표 (17개, `kit/roles.json`)

아이콘 세트는 이 17개 역할을 **이 칸 수대로** 채운다. 지형은 장소 발자국(칸 수)에 맞춰 만들어지므로 칸 수가 다르면 땅이 어긋난다 — 빌더가 시작할 때 거절한다.

| id | 칸 | id | 칸 | id | 칸 |
|---|---|---|---|---|---|
| `capital` | 6x6 | `large_town` | 3x3 | `ruin` | 2x2 |
| `fort_city` | 4x4 | `village` | 2x2 | `ruin_city` | 4x3 |
| `harbor_city` | 5x4 | `camp` | 2x2 | `shrine` | 3x3 |
| `castle` | 3x3 | `tower_small` | 1x2 | `landmark_nature` | 3x3 |
| `circle` | 2x2 | `tower_great` | 2x4 | `volcano` | 2x2 |
| `floating` | 5x4 | `cave` | 2x2 | | |

fantasy 의 38 아이콘이 어느 역할에 들어갔는지, 칸 수가 안 맞는 것(`castle_dark_grand` 5x5 하나)은 `role-mapping.md`. 역할 `floating` 은 정확히 한 장소(천공섬)여야 하고, 아이콘 밑에 바다 그림자가 진다.

## ② 아이콘 세트 `iconsets/<id>/manifest.json`

```json
{
  "id": "fantasy",                       // 폴더 이름과 같아야 한다
  "name": "판타지 (기본)",
  "tile": 16,                            // 16 만 지원
  "key": [255, 103, 139],                // 투명 키색
  "shadow_key": [254, 103, 139],         // 선택. 이 화소 밑의 지형을 어둡게(바닥 그림자). 지금은 이 값만 지원
  "sheet": "sheet.png",                  // RGB 시트. 칸 좌표 (col,row) × 16px
  "extra_colors": ["1a2b3c", "..."],     // 원본 EasyRPG World 칩셋 팔레트에 없는 색(출처 점검용, 빌더는 읽지 않는다)
  "icons": [
    { "role": "village", "name": "village_wood", "cells": [2, 2], "col": 17, "row": 0, "desc": "촌락 — 목조 집 세 채" }
  ],
  "pins": { "강가 마을": "windmill_farm" },   // 선택. 장소 id → 아이콘 이름 고정(없는 장소는 해시로 고른다)
  "license": "CC BY 4.0 — ..."
}
```

- 아이콘은 역할마다 **여럿**이어도 된다(변형). 장소에는 `pins[장소 id]` 가 있으면 그것, 없으면 **역할의 칸 수가 맞는 변형 중 `crc32(장소 id) % 변형 수`** 로 고른다(같은 입력이면 항상 같다, 실행마다 안 변한다).
- `pins` 는 세계관 세트가 장소별 손 배정을 고정하고 싶을 때만 쓴다. fantasy 는 원래 한 장짜리의 배정을 그대로 고정했다(그래서 화소 동일).
- 아이콘 안: 키색 = 투명, 그림자 키 = 밑 지형 어둡게(눈 같은 밝은 바닥에서는 가장자리를 디더로 줄여 사각 판이 안 튄다), 나머지는 그림.
- 아이콘 이름·좌표가 겹치거나 시트 밖이면 거절한다.

## ③ 팔레트 `palettes/<id>.json`

`palette-schema.md`. 요점: 지형 그림의 색마다 role(어느 칸 종류에서 나왔나)을 자동으로 정하고, 팔레트는 role 별 램프·빛만 적는다. 지형 종류마다 램프를 따로 두면 명암 3단 이상이 유지된다.

## ④ 여정 템플릿 `journeys/<id>.json` (`worldmap-journey/1`)

```text
id, name, desc, terrain                 terrain = 어느 공용 지형 위인가 (지금은 shared-v9 하나)
acts[]        { id, name, means, color }              막 5개(막 k 의 수단 = means)
means{}       pass|ship|skiff|air → { name, source(수단을 얻는 장소 id), barrier, act }
barriers[]    { id, name, means, gate, desc }          장벽 4종: mount_wall(통행증)·sea(범선)·dune_sea(사막선)·sky(비공정). gate = 그 장벽을 여는 문/출발 장소
start         { place, cell:[x,y] }                    시작 칸(강가 마을 한가운데)
final         최종 장소 id (천공섬)
places[]      { id, role, x, y, ground, kind, act, function, story, note, seq }
                role   역할 id (아이콘 id 는 쓰지 않는다)
                x, y   발자국 왼쪽 위 칸(칸 수는 역할이 정한다)
                ground 발자국 밑 바닥(terrain_v4 상수 이름: GRASS SNOW SAND …, null = 그대로)
                act    처음 닿는 막(0~4) — 도달성 검사가 지도 BFS 와 대조한다
                function 시작|거점|관문|장벽 해제 열쇠|위기|보상|선택 탐험|최종    seq 줄거리 순서(검사 보고의 정렬용)
roads[]       { id, from, to, via }                    장소(또는 지형의 경사로) 사이 길. 배열 순서가 길 계획 순서다
terrain_nodes { ramps[] }                              roads 끝점으로 쓸 수 있는 공용 지형의 경사로 4개
main_line[] { place, event } · leg_stage[] · entries{ship,skiff} · checks{must_not_walk, opening_must_see, opening_far} · crisis[]
```

**지형에 묶인 것(주의)**: `places[].id` 중 `내해 항구`·`고갯길 요새`·`사막 신전`·`사막 폐허`·`설원 마을` 과 roads 의 끝점, `start.cell`, 천공섬 좌표는 공용 지형 코드(경사로·사구 후처리·관문·항구)가 **이름과 좌표로 직접 참조**한다.
다른 이야기를 올리려면 같은 지형 위에서 `role`·`act`·`story`·`function`·수단 배치를 바꾸는 것이 안전하고, 표시 이름을 바꾸려면 새 필드를 두고 id 는 그대로 둬야 한다. 지형 자체를 바꾸는 것은 이 키트의 범위 밖이다(`kit/lib/terrain_*`).

## 빌더 `kit/build_world.py`

```bash
python3 kit/build_world.py --iconset fantasy --palette all --journey fantasy-5act --out tiledata/worldmap-kit/out --cache /tmp/wmk-cache
#   --palette original | winter,dusk | all    --tint-icons 0.4    --no-check    --cache <dir>
```

1. 세트·템플릿·팔레트를 읽고 **검사**한다: 템플릿의 모든 역할을 세트가 칸 수대로 채우는가(모자란 것 전부), pins 가 맞는가, 팔레트 키가 맞는가. 틀리면 `입력 오류:` 로 **무엇이 모자란지 적고 종료 코드 2**.
2. 공용 지형을 아이콘 없이 끝까지 그린다(약 100초, 한 번). `--cache` 는 지형과 색→role 표를 저장한다 — 키는 템플릿 + 역할 표 + 지형 코드라서 **아이콘 그림이 달라도(칸 수가 같으면) 같은 캐시를 쓴다**.
3. 팔레트마다: 지형 색 교체 → 아이콘 붙이기(`--tint-icons` 만큼 팔레트 빛; 기본 0.25, 팔레트의 `icon_tint` 가 있으면 그 값) → `<out>/<세트>-<팔레트>.png`.
4. `world.json` : 지형 배열(ground/object/height_level/ramp/face)·길·다리·장소(역할·아이콘·좌표·막)·팔레트 id·사용한 아이콘·이미지 파일. `build-report.json` : 지표. `journey-check.txt` : 도달성 보고.

## 여정 검사 `kit/check_journey.py`

```bash
python3 kit/check_journey.py --journey fantasy-5act --iconset fantasy          # 템플릿대로 지형을 만들어(약 2초) 검사
python3 kit/check_journey.py --journey fantasy-5act --map out/world.json       # 출력한 world.json 의 지형으로 검사
```
통행 판정은 지도 칸 위에서: 걷기(산·절벽·강·협곡·바다·사구 막힘, 다리·경사로·발자국 열림) · 관문(통행증) · 배(항구에서 타고 높이 0 해안에서 내림) · 사막선(+사구) · 비공정(천공섬 발판).
막별 도달 영역을 BFS 로 구해 `places[].act` 와 대조하고, 수단을 얻는 장소의 순서, 장벽 두께, 시작 화면, 줄거리 선, 길이 장벽을 가로지르지 않는지를 본다. 종료 코드 0 통과 / 1 불일치 / 2 입력 오류.

## 자체 검사 `kit/selftest.py`

fantasy + original + fantasy-5act 가 v9-final3 의 `design-1x-final3.png` 와 **화소 단위로 같은지**, `world.json` 의 지형이 `map-v9-final3.json` 과 같은지, `world.json` 으로 돌린 도달성 보고가 `journey-check-final3.txt` 와 글자 단위로 같은지,
pins 없이 해시로 고른 결과가 결정적인지, 입력 오류(역할 없음·칸 수 틀림·pins 틀림·없는 팔레트·없는 여정)가 명확한 메시지와 종료 코드 2 로 거절되는지를 확인한다.

## 새 세계관 아이콘 세트를 추가하는 절차

1. `iconsets/<새 id>/` 를 만든다(폴더 이름 = manifest 의 id).
2. 역할 **17개를 칸 수대로** 채운 `sheet.png`(RGB, 16px 격자, 키색 배경)를 그린다. 역할마다 변형을 여럿 넣어도 된다. 다른 세계관이면 `village` 한 역할에 변형이 가장 많이 필요하다(기후·문화별).
   `roles.json` 의 `legacy_fantasy` 와 `role-mapping.md` 가 칸 수와 예(어떤 그림이 어느 역할)를 보여 준다. 키색 `(255,103,139)` 은 투명, `(254,103,139)` 은 밑 지형을 어둡게 하는 그림자.
3. `manifest.json` 을 위 스키마로 쓴다(`role`·`name`·`cells`·`col`·`row`·`desc`).
4. 검사: `python3 kit/check_journey.py --journey fantasy-5act --iconset <새 id>` — 역할이 비면 무엇이 비었는지 다 나온다. 폴더를 저장소에 넣기 전에는 `--iconset /임시/경로/<id>`(실제 폴더 경로)로 시험할 수 있다.
5. 빌드: `python3 kit/build_world.py --iconset <새 id> --palette all --journey fantasy-5act --out /tmp/x --cache /tmp/wmk-cache` 후 **PNG 를 직접 열어** 아이콘이 팔레트에서 묻히지 않는지, 장소 발자국 둘레에 사각 패치가 안 보이는지 본다.
6. 출처를 `ATTRIBUTION.md` 에 더한다(EasyRPG World 칩셋의 팔레트·결을 따른 손 도트면 CC BY 4.0 파생물). 생성 이미지·트레이싱은 쓰지 않는다.

## 제품 번들 등록은 아직 하지 않았다 — 이유

이 키트는 **래스터 아이콘 + 렌더 파이프라인**이다. 지형은 파이썬이 칸마다 픽셀을 찍어 한 장의 PNG 로 만든다(바닥 28종 변형·3띠 바다·해안 거품·숲 가장자리·절벽 돌 결·사구 마루 후처리·늪 후처리 등이 칸 경계를 넘는 픽셀 연산).
반면 제품 쪽 `atlas_biome_world` 타일셋은 **EasyRPG 월드 시트의 타일 인덱스 + 사분면 오토타일 규칙**이다(맵 = 칸마다 타일 번호). 둘은 데이터 모델이 다르다. 등록하려면:

1. 지형 오토타일/경계 키트(바닥 종류별 몸통·가장자리·안쪽 모서리, 종류 쌍 경계, 3띠 수심, 절벽 면, 고원, 길·다리 방향)를 **시트로 구워** 타일 번호로 쓸 수 있게 해야 한다 — 지금은 칸 경계를 넘는 후처리가 많아 그대로는 칸으로 환원되지 않는다.
2. 아이콘 세트를 시트 칸에 올리고 장소 오브젝트로 배선해야 한다(`src/assets/bundled.ts`·`defaultAssets.ts`, 칸 수·시트 높이 계약).
3. 그 뒤에야 `AGENTS.md` 「새 타일·타일 학습은 공용에 추가한다」 절차(번들 JSON·타일셋 정의·`ensureBundledTilesets`·양쪽 프로젝트 검증)를 밟는다.

이 중 1번이 별도 작업이라 이번 범위에서 하지 않았고, `tiledata/` 의 출처 사본으로만 커밋한다.

## 다음 단계 제안

1. ~~다른 세계관 세트 둘~~ — **완료(2026-10-01).** `iconsets/desert-east`(사막·동양풍) · `iconsets/modern-sf`(현대·SF) 가 17 역할을 칸 수대로 채우고,
   `python3 kit/build_world.py --iconset <세트> --palette original --journey fantasy-5act --out <dir>` 가 둘 다 입력 검사·여정 검사를 통과한다.
   같은 지형·같은 여정에서 아이콘만 바뀐 비교 그림은 `docs/sets-desert-east-modern-sf.png`. 남은 것: 세트 둘을 6팔레트 전부로 돌린 비교(`--palette all`)는 아직 안 했다.
2. **여정 템플릿을 하나 더**(예: 3막 단순형) — 같은 지형에서 이야기만 바꿔 `check_journey` 가 막 구분을 다시 증명하는지 본다. 지형에 묶인 이름·좌표(위 주의)를 풀어 `role` 로 참조하는 쪽으로 지형 코드를 일반화하는 것이 다음 큰 일이다.
3. **팔레트를 지형 코드 쪽으로 내리기**: 지금은 렌더가 끝난 픽셀의 색을 role 로 거꾸로 센다(순도 0.845). 지형 모듈이 칸 종류별 색 표를 직접 읽게 바꾸면 role 경계가 칸 단위로 정확해지고 `regional` 같은 지역 팔레트가 쉬워진다.
4. **제품 등록 — 일부러 하지 않았다.** 제품 번들의 `atlas_biome_world` 는 **타일 번호 시트**(칸을 맵에 칠하는 방식)이고, 이 키트는 완성 그림에 래스터 아이콘을 붙이는 **렌더 파이프라인**이라 모양이 다르다.
   억지로 맞추려면 (a) 지형을 오토타일 시트로 바꾸거나 (b) 아이콘을 `stamp_tileset_object` 류 오브젝트 조각으로 등록해야 한다. 먼저 지형 오토타일 시트화의 범위를 재는 작은 시험(바닥 3종 + 바다)부터.

## 아이콘 세트의 현재 상태 (2026-10-02)
경사 투영 렌더러로 그린 아이콘(사막·동양풍 · 현대·SF 전부, 판타지의 화염 요새·폐허 일부)은 **옆면이 보이는 아이소메트릭 시점**이라 칩셋 규약(윗면 + 정면 벽)과 어긋난다.
세 세트 82장 전부를 월드맵 아이콘 하네스(`src/harnesses/worldmap-icons/`)에 올렸다. 사용자의 받기/버리기가 `harness-data/worldmap-icons/decisions.json` 에 모이기 전에는 어떤 아이콘도 「확정」이 아니다.

