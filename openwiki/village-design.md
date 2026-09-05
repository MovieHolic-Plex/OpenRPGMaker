# 마을 설계서 (2026-09-05)

검토한 `output/village-direction/index.html` 방향성의 첫 구현. 프리셋의 외형·배치·자연 설정을 한곳에서 저작하고 **시공 코드에서** 고정/범위를 집행한다.

## 데이터와 호환성

- `VillageLayoutPresetRecord.design`은 옵트인이다. 기존 저장본은 이 키가 없어 **명시 인자 > 프리셋 > 기본값** 동작을 유지한다.
- 새 UI 생성은 `asVillageDesign`으로 설계서를 만든다. 기존 프리셋은 「마을 설계서로 전환」을 눌러야 바뀐다. 로드·AI 호출·탭 열기만으로 생성하지 않는다.
- `design.version=1`, `revision`은 편집 시 증가한다. 외형·배치·자연·주민·실내 정책은 fixed/free, 집 수는 fixed/range/free. 층수 허용 목록, 실내 연결, 물 종류·방향·크기와 숲 밀도·방향·깊이를 저장한다.
- `project.defaultVillagePresetId`는 지정/해제 가능하다. 첫 설계서 생성은 기본값으로 지정한다. ID 변경·삭제 시 기본 참조도 따라간다.
- `shape.ts`가 설계서 형식·범위와 기본 참조를 검사한다. 기존 v4 JSON에 선택 필드 추가이므로 schema version 변경이나 SQL migration은 없다.

## 단일 시공 계약

`editor/tools/village/designContract.ts`가 선택·충돌·형태 호환성·자연 해석을 맡는다.

1. `author_village`는 파싱·맵 생성 전에 설계서를 읽는다. 생략된 집 수는 설계서에서 채운다. 설계서가 없으면 집 수는 여전히 필수다.
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

## 검증

`test/villageDesign.test.ts`: 레거시 호환·기본 선택·고정 충돌·범위·공유 규칙 불변·실제 재료/물/숲·기존 맵 재시공·예산 절단·저장/재로드·시공/미리보기 타일 동일성·구형 세션 무변이 중단.

관련 회귀: `databaseVillageView.test.ts`, `villageAuthoringData.test.ts`, `villagePresetPreview.test.ts`, `villageBuilder.test.ts`. 브라우저 증거: `output/evidence/village-design/` (실제 편집기 1586/1280/1024px). 테스트 프로젝트는 최소 계약 fixture이며 원격 게임 콘텐츠 저작이 아니다.
