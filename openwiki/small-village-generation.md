# 소규모 마을 정본 (2026-09-13)

마을 전체는 지형·길·시설을 포함하는 **정주지 지역(RegionDesign)** 이다. 집 외형은 오브젝트,
실내·마당은 공간, 연결된 시설은 장소다. 특정 예시 맵을 복사하는 것을 생성 규칙의 정본으로 삼지 않는다.

## 저장과 재사용

- `VillageLayoutPresetRecord.design.objectVillage`에 저장된 오브젝트 후보, `composition: compact`,
  정확한 `multiStoreyCount`, `clustering: tight | balanced`, 기준 `previewSize`를 저장한다.
- `ObjectDesign.exteriorStories?: 1 | 2 | 3 | 4`는 저작한 **외형** 층수다. 실내가 있다는 뜻은 아니다.
  미지정인 예전 오브젝트는 그대로 로드한다. 층수 제한을 쓰는 후보는 전부 명시되어야 하며 높이로 추측하지 않는다.
- 외형 정책이 fixed면 후보·2층 이상 합계를, 배치 정책이 fixed면 compact·밀집 방식을 강제한다.
  다른 인자는 시공 전 거부한다. 큰집도 2층 이상 합계에 포함된다. 층수 할당 시 수용량 부족을 best-effort로 숨기지 않는다.
- 편집기 **지역 → 정주지 설계서**의 집 항목에서 후보·합계·밀집 방식·기준 크기를 수정한다.
  오브젝트 속성에서 외형 층수를 수정한다. 프리셋 복제는 이 선택 필드도 보존한다.
- 실제 미리보기, `author_village({target,presetId,countPolicy:'exact',seed})`, 정주지 지역 컴파일이
  같은 `resolveVillageDesignInput`과 `buildVillageDomain`을 소비한다. 기준 크기는 미리보기와
  크기 생략 신규 맵에만 적용한다. 기존 영역이나 명시한 맵 크기는 바꾸지 않는다.
- 실제 맵의 `villageDesignSource`는 당시 **설계서 전체 사본·개정·시드·결정값**을 보존한다.
  저장 오브젝트의 ID·개정·층수·실제 raster도 `resolvedSettings.exteriors`에 기록한다.
  설계서를 수정해도 기존 맵은 자동 갱신하지 않는다. 명시적 재시공은 현재 설계서를 읽는다.
- `RegionDesign.settlement`는 이 presetId와 시드를 참조한다. 지역 라이브러리의 재사용 가능한
  설계와 실제 occurrence/owned map은 구분한다. 재시공은 기존 digest를 검증한 뒤 컴파일러 자신의
  root binding만 초안에서 잠깐 해제하며 다른 소유물이나 수작업 변경은 보호한다.

## 이번 사용자 저작 기준

`rpg-zzu-house-template-gallery`의 `small-village-dense`는 **소규모 마을** 전용이다.
기본 설계서로 지정하지 않는다. 중규모 마을·도시에 이 수치를 일반화하지 않는다.

- 집 26채: 1층 23채 + 2층 이상 총 3채. 오브젝트 설계서는 1~4층을 허용하며 3·4층도 이 합계에 포함된다.
- 큰집 2채 이하, 모든 집 최대 15×15. 일반 집은 10×10 이하. 통나무 벽 제외.
- tight는 옆집 사이 한 칸, 앞쪽 두 칸을 예약하고 네 주택군의 가까운 후보를 선호한다.
  전체 지붕·현관 앞과 실제 도로·호수 예약은 침범하지 않는다.
- 기준 맵 76×76. compact 지형은 우하단 비대칭 호수(면적 3.5~8%, 가로세로비 ≥1.8),
  숲과 243 계열 풀밭, 장터와 연결된 호숫가 쉼터를 사용한다. 이 모드의 자연 배치는 전용
  compact 시공기 규칙이므로 기존 일반 마을의 물 지름·숲 띠 방향 슬라이더를 노출하지 않는다.
- 소형집 12종 + 수정된 번호 집 30종 + 초기 연구 집 11종, 정주지 박공 참고 4종까지 총 57종을 재사용 카탈로그로 연결한다.
  이 예시의 후보는 그중 10×10 이하 일반 집 24종과 정주지 앞박공·쌍박공 큰집 2종, 총 26종이다.
  다른 큰집·고층집은 카탈로그에 유지하고 설계서에서 후보를 교체해 사용할 수 있다.
  번호 집의 통나무 벽과 15×15 초과 외형을 수정하고 초기 현관집도 회벽으로 교체했다.
  초기 3·4층 확장 연구 4종은 크기 제한을 넘으므로 후보 밖에 보존한다. 번호 집 갤러리 3개와
  명시적으로 재시공한 소규모 마을 외의 기존 맵은 당시의 동결된 래스터를 유지한다.
- 새 지역 `small-village:region:dense`, 예시 배치 `small-village:example:20260913`.
  실제 맵 `spatial-geography:30:small-village:example:20260913`.

## 검증과 재현

`test/smallVillageDesign.test.ts`: 서로 다른 시드, 23/3 구성, 프리셋 미리보기, IO 보존,
고정값 충돌 원자성, 미지정 층수 거부, 큰집 합산, 지역 컴파일·동일 재시공·수작업 보호.
기존 `villageCompactComposition`의 quota 없는 호출은 이전 정책을 유지한다.

`npx tsx scripts/publish-small-village.mts`는 필수 DB를 읽고 실제 도구를 호출해 예시를 검증한다.
`--apply`만 원격 CAS 저장 및 재로드한다. 이미 저장된 예시에는 덮어쓰기 대신 오류를 낸다.
`output/evidence/small-village`의 프로젝트 JSON은 검증 입력이며 정본은 원격 프로젝트 행이다.
증거는 `.omo/evidence/small-village/`에 둔다. 도구 호출 검증이며 LLM 제공자 실행 증거는 아니다.

## 기존 집 카탈로그 개정

`npx tsx scripts/revise-village-house-catalog.mts`는 먼저 원격 정본을 읽은 뒤 기존 번호·kit ID·object ID를
유지해 집 30종을 재등록한다. 개정된 외형은 15×15 이하이며 실제 roof flood-fill·문 접근·금지 타일·
서로 다른 geometry를 검사한다. 초기 연구 15종에는 외형 층수 메타데이터를 보충한다.
후보에는 크기 기준에 맞는 초기 11종만 넣는다. 장소·실내 공간과 과거 고층 연구 샘플은 보존한다.

설계서 후보·허용 층수를 개정하고 `compileSpatialOccurrence`로 기존 정주지 예시를
명시적으로 재시공한다. 이 경로는 소유 digest를 검증한다. 일반 AI 쓰기 runner는 완성된 집의
래스터 교체를 별도로 금지하므로 `edit_spatial_occurrence(refresh)`로 이 예시를 바꾸면
`protected-house-write`를 반환한다. 이 저작 스크립트는 사용자가 요청한 직접 수정 경로이며
그 보호 정책을 완화하지 않는다. 저장된 후보는 AI의 신규 `author_village`에서 그대로 사용한다. 기존 occurrence에 `preview_spatial_build`를 호출하면 ID 중복으로 실패하므로 신규 생성과
혼동하지 않는다. 건물 외형 26채의 원본 셀 일치·출입구 도달·23/3 구성·다른 맵 보존을 확인하고,
`--apply`에서만 CAS 저장과 전체 정규화 재로드 비교를 수행한다. 증거는 `output/evidence/house-revision`.

`test/revisedHouseVillage.test.ts`는 기존 세 카탈로그와 정주지 참고 57종을 함께 등록한 뒤 3층·4층 큰집을 지정해도
총 2층 이상이 정확히 3채이고 23채가 단층인지 실제 마을 시공을 통해 확인한다.

정주지 참고는 사용자가 제시한 43×45 이미지와 `rpg-zzu-region-reference-walled-settlement-v1`의
`map_reference_gabled_houses_20260913` 래스터를 대조했다. 프로젝트 표시명은 「사진 참고 · 박공 마을」이나
사용자는 「정주지」로 지칭했다. `settlementReferenceHouses.mts`는 그 네 집의 지붕 윤곽을 전사하고
통나무 벽을 석벽/회벽으로 바꾸며 주변 소품을 제거한다. 현관은 lower 116/146 + 접근 앵커로 정규화한다.
오브젝트 모드의 허용 외형 층수만 4층까지 확장하며 기존 절차형 집 생성은 1~3층을 유지한다.

## 마을 생활 공간 장식 (2026-09-13)

`VillageDesign.objectVillage.decorations`는 `{spaceId, zone, maxCount}` 목록이다. zone은
`house | commons | market | shore | road`, maxCount는 1~32이며 공간 ID 중복은 거부한다.
옛 설계서에서 생략하면 기존 결과를 유지한다. 「길과 배치 → 마을 생활 공간」에서 저장된
공간 이름과 구역을 확인하고 반복 한도를 수정한다. 현재 설계서는 20개 공간을 참조한다.

`spaceDecoration.ts`는 집 → 길 → 숲·물·풀밭 시공이 끝난 뒤 같은 타일셋의 실외 공간을
부착한다. 부착용 공간은 직사각형 ground 영역, wall:none, 고정·단일 수량 오브젝트 슬롯과 접근 포트를 가진다.
칩 덮어쓰기와 같은 레이어의 중복 오브젝트 셀은 거부한다.
별도 공간으로 시공할 때는 공간 컴파일러가 바닥을 만들지만, 마을에 부착할 때는 기존 지형을
유지하고 오브젝트 래스터만 겹친다. 이 한정된 부착 계약에 맞지 않는 설계는 시공 전에 거부한다.

- 집은 유형을 순환하며 한 묶음씩 붙인다. 좁은 집에는 2칸 폭 문간 구성을 대안으로 쓴다.
- 공용 시설은 광장 밖 가까운 빈터, 가판 적재·천막은 장터 안, 물가 구성은 실제 물 인접,
  길가 소품은 도로 인접으로 제한한다. 같은 구역 묶음은 간격을 둔다.
- 완성된 집, 현관, 사유 접근로, 이벤트, 타일 스택과 도로·장터 십자 통로를 보호한다.
  각 후보는 원자적으로 시도하고, 기존 통행 가능 칸에서 소품 자체의 면적을 뺀 모든 칸과
  새 포트가 여전히 연결되는지 검사한다. 실패 시 래스터를 되돌리고 다음 자리를 찾는다.
- `water-overlay` 태그의 shore 공간만 하위 통행 바닥으로 물을 덮을 수 있다. 실제 물을
  포함해야 하며, 잔교의 모든 칸이 육지 포트에서 걸어서 도달 가능해야 한다.
- 공간 전체 정의·오브젝트 개정·실제 래스터·좌표는 `villageDesignSource.resolvedSettings.spaceDecorations`
  에 동결한다. 배치된 공간은 레이아웃 영역에 공간/구역/집 연결 태그와 접근 위치도 남긴다.
- 빈 자리 부족은 일부 선택 장식의 생략이지 집 수 축소가 아니다. 모든 집을 동일 장식으로
  강제하지 않는다. `maxCount`는 최대치이며 최소 배치 보장은 아니다.

`scripts/lib/villageDecorationCatalog.mts`는 실측한 Combined Town 원자를 오브젝트 16종과
공간 20종으로 등록한다. 통나무 벽, 금지 지붕 칩, 땅 위 벽 간판은 쓰지 않는다.
우물은 382(상위), 짧은 울타리는 439·379·409, 천막은 447~449/477~479,
잔교는 통행 방향이 있는 228·229를 사용한다. 기존 outdoorObjectCatalog의 342 우물 설명은
이 칩셋 실측 그림과 맞지 않아 이번 카탈로그에 그대로 가져오지 않았다.

`npx tsx scripts/decorate-small-village.mts --apply`는 원격 연결 확인 → 카탈로그 등록 →
설계서 개정 → 소유 digest 검증 재시공 → CAS 저장 → 재로드를 수행한다.
집 26채의 위치·외형·23/3 구성, 다른 맵과 출입 동선을 검사하고, 공간 갤러리 맵
`map_village_decoration_catalog`도 저장한다. AI의 신규 `author_village`와 미리보기는 같은
장식 시공기를 호출한다. 이것은 도구 경로 검증이며 LLM 제공자 대화 실행 증거가 아니다.

검증: `villageSpaceDecoration.test.ts`의 IO/원자성/연결성, `revisedHouseVillage.test.ts`의
실제 AI 도구 마을 생성, 원격 에디터의 공간 반복 한도와 미리보기, 출하 플레이어의
장터·집·호숫가·우물·잔교 끝·천막 접근을 확인한다.
`verify-village-decoration-spaces.mts`는 저장된 20종 전부를 일반 `preview_spatial_build`로
단독 컴파일한다. 실외의 벽 없음 값은 빈 문자열이 아니라 `none`이다.
