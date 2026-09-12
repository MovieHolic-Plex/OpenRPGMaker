# 마을 설계서 (2026-09-05)

검토한 `output/village-direction/index.html` 방향성의 첫 구현. 프리셋의 외형·배치·자연 설정을 한곳에서 저작하고 **시공 코드에서** 고정/범위를 집행한다.

## 데이터와 호환성

- `VillageLayoutPresetRecord.design`은 옵트인이다. 기존 저장본은 이 키가 없어 **명시 인자 > 프리셋 > 기본값** 동작을 유지한다.
- 새 UI 생성은 `asVillageDesign`으로 설계서를 만든다. 기존 프리셋은 「마을 설계서로 전환」을 눌러야 바뀐다. 로드·AI 호출·탭 열기만으로 생성하지 않는다.
- `design.version=1`, `revision`은 편집 시 증가한다. 외형·배치·자연·주민·실내 정책은 fixed/free, 집 수는 fixed/range/free. 층수 허용 목록, 실내 연결, 물 종류·방향·크기와 숲 밀도·방향·깊이를 저장한다.
- `project.defaultVillagePresetId`는 지정/해제 가능하다. 첫 설계서 생성은 기본값으로 지정한다. ID 변경·삭제 시 기본 참조도 따라간다.
- `shape.ts`가 설계서 형식·범위와 기본 참조를 검사한다. 기존 v4 JSON에 선택 필드 추가이므로 schema version 변경이나 SQL migration은 없다.

## 단일 시공 계약

2026-09-12: 실제 시공과 미리보기는 **집 → 길 → 나무 → 호수·마당·맵 꾸미기** 순서를
공유한다. 자연 위치는 계획에서 예약하고, 실제 물은 마지막에 칠한다.
자세한 단계·보호 계약은 `large-village-generation.md`의 최신 시공 순서를 따른다.

`editor/tools/village/designContract.ts`가 선택·충돌·형태 호환성·자연 해석을 맡는다.

1. `author_village`는 파싱·맵 생성 전에 설계서를 읽는다. 생략된 집 수는 설계서에서 채운다. 설계서가 없으면 집 수는 여전히 필수다. 기본 설계서가 활성화된 상태에서 없는 ID를 지정하면 코드 기본값으로 폴백하지 않고 중단한다.
2. 고정값과 다른 인자·범위 밖 집 수는 `village-design-conflict`로 거부한다. 설계서를 몰래 변경하거나 다른 툴로 우회하지 않는다.
3. `buildVillageDomain`도 같은 계약을 적용한다. 집별 kitId·허용 형태·형태 자체의 고정 재료·층수를 모두 검사한다. 후보가 없으면 `village-design-templates`다.
4. 고정 자연 설정은 테마 추론보다 앞선다. 공유 `system.worldGen`을 변경하지 않고 설계서의 물/숲 설정을 합성해 기존 지형 패스로 넘긴다. 「숲 구역 없음」은 숲 밴드가 없다는 뜻이며 별도 테두리 나무까지 지우지 않는다.
5. 집 수가 요청에 미달하면 `village-design-capacity`로 실패한다. 기존 범위·통행·필수 지형 QA는 유지한다.
6. 맵의 `villageDesignSource`는 당시 설계서 사본·시드·집 수·확정된 재료/형태/자연 규칙이다. 기존 대상 맵의 범위 검사에서 이 출처는 layoutPlan과 같이 변경 가능하다. 설계서 수정은 기존 맵을 자동 변경하지 않는다.

`ai/villageDesignContext.ts`는 예산 밖에 기본 설계서와 고정값 요약을 넣는다. **집행은 프롬프트에 의존하지 않는다.** 기존 「항상 forestDensity를 넣어라」보다 설계서의 생략 지침이 우선한다.

## 편집 화면과 미리보기

- `databaseVillageView.ts`가 레코드·되돌리기·store 저장을 소유한다. `villageDesignPanel.ts`는 분위기/집/길/자연/실내/주민 탭, 실제 시공 미리보기, 정책 요약을 배치한다.
- 그림은 기존 `createHousePreview`/`createMoodPreview`다. 형태 견본에도 마을 재료를 반영하되 기하에 종속된 고정 재료는 보존한다. 생성형 콘셉트 그림을 실제 결과로 쓰지 않는다.
- `buildPresetPreview`는 프로젝트 복제본에서 같은 `buildVillageDomain`을 실행한다. 기존 프리셋은 실내/NPC 생략을 유지하고, 설계서는 실내·주민 정책도 동일하게 적용한다. 원본에 맵이 생기지 않는다.
- 전경은 버튼으로 생성한다. 설정 변경 후 이전 결과는 폐기한다. 경고는 요약과 접힌 상세로 보여준다.
- 요청문 상자에는 설계서 ID가 포함된다. 실제 지도에 적용할 위치·크기는 AI 대화에서 요청한다.

## 현재 경계

- 시설별 프로그램·주민 역할 편성 UI를 새로 만들지는 않았다. 기존 집별 실내 연결과 주민 수를 설계서에 묶고, 공용 시설 개념 꾸러미·캐스트 라이터를 유지한다.
- 레이어별 구형 세션(`start/advance/run_village_session`, `run_village_pipeline`)은 자연을 따로 시공한다. 기본 설계서가 활성화되면 변이 전에 `village-design-use-author`로 중단하고 `author_village`를 안내한다. 설계서 없는 프로젝트는 기존 동작을 유지한다.
- 기본 설계서 해제는 마을 탭의 같은 버튼에서 가능하다. 에이전트가 고정 계약을 회피하려고 해제해서는 안 된다.

## 기존 맵 재시공의 새 집 터 (2026-09-06)

완성된 집은 재시공 때도 그대로 보존하며 요청한 집 수는 이번 호출의 새 집 수다.
`buildHouses`는 기존 집·사람 스탬프와 겹치지 않는 후보를 고른 뒤, **스탬프 성공·문 좌표
확인 후, 봉인 전에** 새 footprint(용마루 행·날개 사이 빈 칸 포함)에 남은 하위 길 타일만
잔디로 바꾼다. 스탬프가 실패한 후보의 길은 건드리지 않는다.
키트가 그리지 않는 투명 지붕 캡 아래에 이전 길이 남아 완성 값으로 봉인되던 결함을
막는다. 기존 집의 길 값·스택·메타데이터는 바꾸지 않으며, 감사에서 길 침범을 숨기거나
`fullMap`으로 보호를 우회하지 않는다. 문 무결성·도달성·외부 길 성분 게이트는 그대로다.

`test/villageDesignRebuild.test.ts`는 실제 `author_village`/runner로 revision 2 수락,
기존 4채와 새 4채의 봉인 값 및 저장·재로드 보존, 실제 외부 단절/기존 집 훼손의 원자적
거부를 검사한다. 잘못된 날개 폭으로 실제 스탬프가 실패한 후보는 롤백 없이 맵 전체가
그대로임도 검사한다. 원래 `villageDesign.test.ts`의 기존 맵 재시공 기대값은 변경하지 않았다.

## 검증

`test/villageDesign.test.ts`: 레거시 호환·기본 선택·고정 충돌·범위·공유 규칙 불변·실제 재료/물/숲·기존 맵 재시공·예산 절단·저장/재로드·시공/미리보기 타일 동일성·구형 세션 무변이 중단.

관련 회귀: `databaseVillageView.test.ts`, `villageAuthoringData.test.ts`, `villagePresetPreview.test.ts`, `villageBuilder.test.ts`. 브라우저 증거: `output/evidence/village-design/` (실제 편집기 1586/1280/1024px). 테스트 프로젝트는 최소 계약 fixture이며 원격 게임 콘텐츠 저작이 아니다.

## 집 외형 연구 — 연결된 지붕 (2026-09-12)

사용자가 기존 집 형태는 참고만 하고 벽·지붕 재료로 새로운 외형을 만들도록 요청했다.
첫 시안의 독립 사각 지붕 중첩은 "동떨어진 집"으로 보여 반려됐다. 이번 연구에서는
196·197·226·227·256·257 칩을 제외한다. 이 제한은 새 연구 집의 재료 계약이며 기존 맵을
일괄 변경하는 규칙이 아니다.

- `scripts/lib/houseStudyDesigns.mts`: 단층형은 부피 명세를 먼저 합쳐 지붕 전체 윤곽을
  계산한다. 맞닿은 내부에 별채의 완결된 용마루·처마를 다시 그리지 않는다. 후속 교정에서
  **08번 발코니 저택을 제외**하여 11채가 됐다. 검토 번호는 08만 비워 두고 유지한다.
  **11·12번은 별도의 `upperStorey` 구성**으로 위층 외벽을 지붕 사이에 드러낸다.
  위층 옆 지붕면은 하층 처마로 이어지며, 단층의 열 합집합으로 위층 벽까지 지붕으로
  바꾸면 안 된다. 참고는 원격 「고양이」(`oprn-343607fd0e`)의 `map_blank_start`,
  `(25,20)`부터 13×12칸인 아래쪽 2층 집이다. 참고 프로젝트는 읽기만 한다.
- `scripts/build-house-study-gallery.mts`: 설정된 프로젝트를 먼저 load하고 새 전시 맵과
  section 구조물을 추가한다. `--apply`는 동시 편집 검사, 백업, 앱의 Supabase 저장,
  재로드 후 기존 맵·시작점 보존과 새 맵·구조물의 일치를 확인한다. 각 집의 실제 타일에서
  지붕 연결 성분 1개, 제외 칩 0개, 출입구 앞 빈 땅을 검사한다.
- `scripts/capture-house-study-gallery.mjs --reloaded`: 저장 후 다시 읽은 데이터로
  `editor/mapTileDraw`를 실행한다. 두 장의 비교 이미지와 독립 HTML을
  `output/evidence/house-studies/`에 만든다.
- 원격 프로젝트 `rpg-zzu-house-template-gallery`, 맵 `map_house_studies_20260912`.
  기존 호수 마을과 공원은 보존한다. 이 외형 연구를 저장한 시점에는 canonical 공간 설계가 비활성이었다.
  section 11종은 저장하고 제외한 08번 section은 삭제한다. 이 연구를 내장 AI의 새 자동 생성 기능이 완성된 증거로
  주장하지 않는다. 이 프로젝트에서 나머지 9종의 행렬과 배치 타일은 이전 저장값과 같음을
  검증한다. 이미 활성화된 프로젝트에서 실행할 때만 canonical object도 등록한다.

### 3·4층 확장 (2026-09-12)

11·12번을 기준으로 `scripts/lib/houseHeightStudies.mts`가 각 3층·4층 외형을 만든다.
최초의 열 합집합 확장은 좌우 지붕을 한 장처럼 만들어 사용자 적대적 리뷰에서 반려됐다.
현재는 `stackedCore`로 **아래 지붕을 뒤에 그리고 위층 몸체로 가리는 순서**를 보존한다.
추가 층마다 좌우 각각 2칸을 넓혀 두 방향의 경사면과 처마 모서리를 남긴다. 위층으로
올라간 옛 현관은 제거하고 현관은 지상층에만 둔다. 채택된 2층 section은 그대로다.

`scripts/lib/houseHeightDepthReview.mts`는 계획 대신 실제 외벽 타일 행을 찾아 추가 층의
좌우 경사 폭과 처마 마감을 검사한다. `scripts/review-house-height-depth.mts`의 이전
저장 결과 4채는 실패, 수정 4채는 통과, 모서리를 지운 음성 대조 4건은 실패해야 한다.
근거는 `output/evidence/house-heights/REVIEW.md`와 `depth-review.json`이다.

- `scripts/build-house-height-gallery.mts --apply`: 기존 2층 2채와 새 3·4층 4채를
  별도 맵 `map_house_heights_20260912`(「집 층수 연구 · 2층에서 4층까지」)에 저장한다.
  기존 2층 section 동일성, 모든 층의 외벽 보존, 지붕 연결, 제외 칩 0개, 문 앞 빈 땅을
  검사한다. Supabase 저장 후 다시 load하여 새 맵·section 일치와 기존 맵·시작점을 확인한다.
- `scripts/capture-house-height-gallery.mjs --reloaded`: 실제 에디터 타일 렌더로
  같은 배율·지면 기준의 2/3/4층 비교 PNG와 독립 HTML을 `output/evidence/house-heights/`에 쓴다.
- 이 층수는 외장 연구의 보이는 층이다. 실내 맵·계단·층간 이동 이벤트를 추가한 것은 아니다.

### 오브젝트·공간·장소 등록 (2026-09-12 후속)

현재 `rpg-zzu-house-template-gallery`는 정식 raw/CAS 경로로 활성화됐으며,
외형 15종을 canonical 오브젝트로, 이를 마당에 배치한 실외 공간 15종과 기본 실내 공간
4종을 공간으로, 마당·실내·문·계단을 묶은 주택 15종을 장소로 저장했다.
건물 외형의 빈 바탕을 마당이 제공하므로, 주택 장소의 `exterior` 필드는 중복 지정하지 않는다.
실제 이동은 공간의 이름 있는 포트를 잇는 명시적 왕복 연결이다.

- `scripts/lib/houseSpatialCatalog.mts`: 이미 가져온 오브젝트는 가져오기 영수증/그림 참조로
  찾아 같은 ID를 유지한다. 없는 외형만 검수된 타일 레시피로 추가한다. 기존 값이 다른 외형은
  덮어쓰지 않고 중단한다. 반복 등록은 같은 정의의 revision을 올리지 않는다.
- `scripts/register-house-spatial-catalog.mts --apply`: 원격 최신본을 읽고 15종 모두 등록된
  AI get/preview/apply 도구로 생성 가능함을 검사한다. 공간 설계 활성화는 정식 raw 원본
  캡처를 사용하며 저장은 읽은 SHA 권한으로 한다. 기존 맵·타일셋 데이터는 보존한다.
  갈색 3층/회색 4층 예시에는 마당 2개와 실내 7개, 총 9개 맵이 실제로 저장된다.
- `scripts/capture-house-spatial-catalog.mjs`: 원격 재로드 데이터의 실제 타일 렌더 증거.
  `npm run qa:runtime -- --scenario house-spatial-catalog --project output/evidence/house-spatial-catalog/reloaded-project.json`
  은 출하 플레이어에서 3층 문·계단을 오르고 내려 마당까지 돌아온다. 같은 명령의
  시나리오를 `house-spatial-catalog-4f`로 바꾸면 새 플레이 세션에서 4층 예제를 검사한다.
- 원격 서버에 저장 RPC가 없어 기존 `20260907000000_spatial_authoring_cas.sql`을 적용했다.
  적용 전 전역 canonical 프로젝트 0개, `pgcrypto`의 `extensions` 스키마, RLS·추가 FK·트리거
  부재를 확인했다. 기존 프로젝트 내용은 마이그레이션이 변경하지 않는다.
  현재 프로젝트의 저장·재로드 증거는 `.omo/evidence/house-spatial-catalog/supabase-proof.json`.
  앞 절의 전시 맵은 당시 저장 기록이며, 현재 등록 증거의 맵 ID는 이 영수증을 따른다.

마을 세션의 강가 추가 활엽수 배치도 물·집 마당 예약지를 뺀 영역에만 수행한다.
물보다 나무를 먼저 놓는 순서에서 이 보조 배치가 호수 예정지를 침범하던 경로를
`test/villageBuildStages.test.ts`의 강+호수 세션 사례로 검사한다.

### 새 집 외형 30종 — 독립 제작과 통합 (2026-09-12)

`scripts/lib/house30BatchA.mts`(01–10 단층), `house30BatchB.mts`(11–20 2층),
`house30BatchC.mts`(21–30 큰집·중정·2~4층)는 각각 다른 Astra xhigh 에이전트가
원시 벽·지붕 타일로 만든 외형 레시피다. 기존 15종을 교체하거나 색만 바꾼 목록이 아니다.
`House30Entry`의 `doors`는 문 아래칩 146 자체의 좌표이며 접근 앵커는 그 아래 `y+1`이다.
층수는 **보이는 외형**의 분류다. 이 작업은 실내 공간·층간 연결을 자동으로 추가하지 않는다.

- `scripts/lib/house30Authoring.mts`: 완성 타일에서 지붕/건물 연결, 금지 칩,
  문 앞에서 바깥까지 빈 경로, 색·벽 재료를 정규화한 중복 형상을 검사한다.
  숫자 검사는 시각 검토를 대신하지 않는다. 모든 키트·전시 맵을 먼저 조립한 다음
  등록된 `upsert_spatial_design`을 연속 호출한다. 도구 호출 사이에 직접 타일셋을 고치면
  `spatial-tampered-proposal`로 거부되므로 순서를 유지한다.
- 작업실 프로젝트는 `rpg-zzu-house-30-a-20260912`, `...-b-...`, `...-c-...`로 분리했다.
  각각 canonical insert-only 생성 후 저장·재로드를 확인했다. 원본
  `rpg-zzu-house-template-gallery`에는 감독자가 합친 30종만 직렬로 추가한다.
- `npx tsx scripts/publish-house30.mts --batch a --apply`: A 작업실에 10종 게시.
  B/C도 동일하다. `--batch all --apply`는 원본 프로젝트에 30종 게시한다.
  명시된 대상 외 저장을 거부하며, 로드 시 받은 CAS 권한으로 저장하고 전체 재로드 일치를
  검사한다. `--apply`를 빼면 미리보기만 만든다. 반복 실행은 동일 revision을 유지한다.
- 통합 전시 맵: `map_house_30_a_20260912`, `map_house_30_b_20260912`,
  `map_house_30_c_20260912`. 오브젝트 검색 태그는 `집 형태 30종 20260912`.
- `node scripts/capture-house30.mjs --batch all --base http://127.0.0.1:19841`:
  Supabase 재로드를 실제 `mapTileDraw`로 렌더한다. 번호별 PNG, 10종 비교판,
  30종 개요와 클릭 확대가 있는 독립 HTML을 만든다. `--preview`는 미리보기 입력이다.
- `npx tsx scripts/verify-house30-builds.mts`: 저장된 30개 오브젝트를 각각 독립 검증 맵에
  실제 `preview_spatial_build` → `apply_spatial_build`로 배치하고 완성 셀 일치를 확인한다.
  이 검증용 맵은 원격 콘텐츠가 아니며 원본을 저장하지 않는다.
- `test/house30Authoring.test.ts`: 실제 30종과 금지 칩·분리 지붕·막힌 중정 현관·색갈이
  중복의 음성 대조. 결과 영수증과 비교 이미지는 `.omo/evidence/house-30/`에 둔다.
