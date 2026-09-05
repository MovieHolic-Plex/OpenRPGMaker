# 집 문 발판과 귀환 계약 조사

입력은 감독자 워크트리의 `output/evidence/jrpg-fix/remote-rerun1.json`의 `current_json`이다. 원격 DB와 입력 데이터는 변경하지 않았다.

## 경고 해석

- `map_blank_start`의 `(15,5)`·`(3,5)` 문 본체는 벽 타일 위의 below 그래픽 이벤트다. 앞 `(15,6)`·`(3,6)`의 투명 playerTouch 발판이 실제 진입점이다. 본체가 있는 벽을 통행 가능 타일로 바꿀 필요가 없다.
- 귀환 좌표는 발판과 같다. `transferTo`는 도착 후 auto 이벤트만 실행한다. `fireTouchTriggers`는 실제 걸음 완료 경로에만 있어 귀환 착지만으로 즉시 재전이하지 않는다. 실제 transferTo를 호출한 회귀 테스트로 이 계약을 검증했다.
- `place_door`는 벽에 문 타일을 놓는 시각 저작 도구다. 기존 집의 이벤트 스프라이트 문을 수리하기 위해 다시 적용하면 그림이 겹칠 수 있다.
- `create_transfer_pair`는 새 무작위 ID의 출입구를 생성하며 점유된 기존 출입구를 옆으로 피한다. 기존 집의 문 이벤트를 수정하는 도구가 아니다. 현재 두 집의 문·귀환을 이 도구로 재생성할 필요가 없다.

## 확인한 결함과 수정

문 본체에는 열림 SE·setEventGraphicPattern·wait·transfer가 있었지만, 실제로 밟는 발판에는 transfer 한 줄만 있어 열림 연출을 건너뛰었다.

`createHouseDoorStepEvent`에 선택적 `doorEventId`를 추가하고 `author_house`의 houseKitDomain, 저수준 houseKit, 마을 실내 배선이 이를 전달하게 했다. 발판은 `callMapEvent`로 문 본체의 활성 페이지를 실행한다. 본체의 ID·그래픽·명령은 유지되고, 사용자가 나중에 본체 페이지를 바꿔도 그대로 실행된다. doorEventId 없는 기존 독립 발판 API는 기존 직접 전이를 유지한다.

## 저장된 기존 문을 보존하는 저작 제안

현재 문/발판을 다시 조회한 뒤 발판 페이지가 단일 transfer이고 그 목적지가 본체의 transfer와 같을 때만, 해당 명령을 `{ kind: "callMapEvent", eventId: "<기존 문 본체 ID>" }`로 바꾼다. 본체·발판·페이지 ID, 그림, 좌표, 실내 맵, 실내 출구, 귀환 좌표는 유지한다. 사용자 추가 명령이 있는 발판은 전량 교체하지 않는다.

조사 스냅샷의 대상은 `ev_house_door_1_map_blank_start_1_step` → `ev_house_door_1_map_blank_start_1`, `ev_house_door_1_map_blank_start_2_step` → `ev_house_door_1_map_blank_start_2`다. 감독자가 새 AI 실행을 시작했으므로 원격 수정 시 현재 ID와 명령을 재조회한다.

## 검증

- `npm run typecheck:app`: exit 0.
- `npm test -- test/houseDoorOpen.test.ts test/transferGateOccupied.test.ts test/callMapEvent.test.ts test/constructionContracts.test.ts`: 4파일 33 tests 통과.
- 실제 author_house 생성물 → 발판 → callMapEvent → 소리/프레임/전이와 이후 본체 편집 반영, 본체 불변을 검증했다.
- 실제 transferTo가 playerTouch 발판에 착지한 뒤 runEvent를 호출하지 않는지 검증했다.
- 브라우저 전체 플레이 여정과 통합 gates는 감독자가 수행한다.
