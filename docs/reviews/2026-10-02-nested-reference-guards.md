# DB / 이벤트 연결 경계 적대 리뷰

## 수정

- 공통 이벤트를 전투 승리·패배·도주, 상점 실패, 승급·진화 성공/실패 분기에서만 호출하면 삭제 가드가 이를 놓쳤다. `databaseReferences.ts`는 분기 정본인 `eventCommandBranches`로 재귀 순회한다.
- 리소스를 전투 결과 또는 상점 실패 분기에서만 쓰면 삭제 가드가 이를 놓쳤다. `databaseCommandReferences.ts`의 리소스 순회도 같은 정본을 쓴다. 선택/반복/증거 제시 등 기존 분기도 유지한다.
- 변수 지정 전투의 `troopVariableId`가 삭제/미사용 판정에서 빠졌다. 로드 검증기는 이 참조를 필수 검사하므로 변수 가드에 포함한다.
- `test/databaseNestedReferenceGuards.test.ts`: 중첩 분기별 양성/음성 참조 및 변수/스위치 구분 회귀 소스 추가. 사용자 테스트 실행 지시가 없어 실행하지 않았다.

## 별도 후속: 적용 전 초안 원본 참조 (P1)

`commandsReferenceLocations` 및 공통 이벤트/리소스/스위치 스캐너는 화면의 working event만 보고 `event.draft.original`을 보지 않는다.
재현: 저장된 이벤트가 레코드 X를 유일하게 참조 → 이벤트 편집 창에서 그 명령을 삭제하되 적용하지 않음 → DB에서 X 삭제 → 초안 취소 또는 자동저장.
`projectWithoutEventDrafts`는 편집 중인 이벤트의 original을 정본으로 내보내므로 삭제한 X 참조가 다시 생긴다.
수정 방향: working body와 취소/저장 가능한 edit original 모두 참조 검사에 포함한다. remote-delete 충돌의 original은 저장 투영에서 제외된다는 계약도 함께 고려한다.
이번 분기 순회 수정과는 별도이며 미해결로 남긴다.
