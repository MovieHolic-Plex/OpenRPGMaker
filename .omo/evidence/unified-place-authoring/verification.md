# 장소 통합 검증 (2026-09-14)

이 변경은 편집기/엔진 코드와 최소 계약 테스트다. 실제 사용자 LegacyDb 프로젝트를
새로 저작하거나 수정하지 않았다. 브라우저의 blankProject와 런타임 JSON은 테스트 전용이다.

- `scripts/capture-new-place.mjs`: exit 0. 생성/취소/적용, 실내·실외·건물,
  실내를 건물로 묶기, 방/2층 추가, 1440px/1024px, 브라우저 오류 없음.
- `room-expanded-building.png`: 원래 실내를 첫 방으로 재사용한 건물에 2층 추가.
  포함된 장소 단일 개수, 층 변경/구성에서 빼기/원본 열기, 출입 연결 표면 확인.
- `building-floor2-1024.png`: 1024px에서 방 추가·층 추가·층 선택 확인.
- `npm run qa:runtime -- --scenario unified-place-floors`: exit 0, 5비트 통과, 오류 0.
  실제 출하 플레이어에서 그린 1층 → 새 2층 → 1층 왕복.
  리포트: `verify-shots/runtime-qa/unified-place-floors/SUMMARY.md`.
- 세부 계약 테스트와 구현 범위: `openwiki/unified-place-authoring.md`.
- 앱 타입 검사: 최종 보완 후에도 exit 0.

## 전체 게이트와 후속 판정

`npm run gates` 전체 실행은 exit 1: 21,929건 중 통과 21,903 / 실패 11 / 보류 15.
타입 검사·CSS budget/graph·브라우저 1파일·surface 10축은 모두 exit 0.
전체 실행 당시 변경된 테스트 19파일 190개 assertion에는 실패가 없었다.

실패 4파일을 각각 대조했다:
- `locationDrawGuard.test.ts` 1건: 저장된 기준선의 기존 실패.
- `sharedDemoStore.test.ts` 6건: 기준선 이후 추가 파일. 별도 재실행 7건 모두 통과(exit 0).
- `spatialLegacyPathIdentity.test.ts` 3건: 공개 참조가 여전히 space라고 기대하던 테스트.
  place로 갱신했다. ID·경로 충돌·원본 불변 검증은 유지하며 재실행 6건 통과(exit 0).
  전체 게이트 자동 재실행은 수정 전 파일을 읽었으므로 그 실패가 전체 보고서에 남는다.
- `aiAssistantSession.test.ts` 1건: main `d1b9c74e8`에서 단독/전체 64건 통과,
  변경본에서 해당 사례 실패를 재현했다. 확대된 스키마가 요청 예산을 줄여 최신 검수
  이미지를 먼저 제거한 것이 원인이었다. 오래된 대화를 먼저 줄이도록 수정한 뒤
  해당 사례와 메시지 예산 10건이 통과했다. 최신 이미지도 예산에 못 들어가면 제거한다.

전체 게이트가 초록이었다고 보고하지 않는다. 보완 후 `messageBudget`, `contextBuilder`,
`assistantOriginalContext`, `aiAssistantSession`, `spatialLegacyPathIdentity`를 함께 재실행해
5파일 92건 통과(exit 0)를 확인했다. AI 세션의 실제 이미지 전달·재검수 경로를 포함한다.
최종 앱 타입 검사도 exit 0. 전체 게이트는 보완 후 다시 전량 실행하지 않았으며,
확인된 새 실패는 위 후속 검사에서 모두 해소됐다.
