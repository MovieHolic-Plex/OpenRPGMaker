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

- 집 26채: 1층 23채 + 2층 이상 총 3채. 현재 등록 후보는 1·2층 외형이다.
- 큰집 2채 이하, 모든 집 최대 15×15. 일반 집은 10×10 이하. 통나무 벽 제외.
- tight는 옆집 사이 한 칸, 앞쪽 두 칸을 예약하고 네 주택군의 가까운 후보를 선호한다.
  전체 지붕·현관 앞과 실제 도로·호수 예약은 침범하지 않는다.
- 기준 맵 76×76. compact 지형은 우하단 비대칭 호수(면적 3.5~8%, 가로세로비 ≥1.8),
  숲과 243 계열 풀밭, 장터와 연결된 호숫가 쉼터를 사용한다. 이 모드의 자연 배치는 전용
  compact 시공기 규칙이므로 기존 일반 마을의 물 지름·숲 띠 방향 슬라이더를 노출하지 않는다.
- 그래픽 12종은 그대로 두고 오브젝트 개정에 외형 층수만 추가했다. 기존 30종·옛 맵은 보존한다.
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
