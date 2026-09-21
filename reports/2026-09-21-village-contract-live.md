# 단일 마을 계약 — 실제 조수 실행

요청: 집 4채와 주민 3명이 사는 작은 마을. 집을 잇는 길·나무·작은 광장, 주민별 서로 다른 대사.

- 실제 에디터 plain chat → 의도 선언 → `villageContract` → Gemini 3.7 Flash worker.
- 모델 응답/도구 실행을 mock하지 않았다. `author_village` 1회, 2턴, worker 9.294초, 도구 오류 0.
  의도 해석·브라우저 부팅·저장 시간은 이 9.294초에 포함하지 않는다.
- 집 4채, 주민 3명(각 2줄 대사), 연결 내부 4개. 재조회 문서의 실제 시작점 (23,16)에서
  집 문앞 4/4 타일 통행 가능. 런타임 플레이 QA를 실행한 것은 아니다.
- LegacyDb `rpg_zzu.projects` 전용 행 `village-contract-live-20260921-414a`에 실제 업서트,
  재조회 전체 JSON 정규화 비교 및 SHA 필드 일치. 공유 사용자의 원래 프로젝트는 수정하지 않았다.
- 현재 웹 QA 세션은 메모리 저장소이므로 편집기 자동 저장 경고가 남는다. 원격 저장은
  `scripts/qa/village-contract-live.mjs`가 별도로 수행했다. ‘에디터 저장 성공’으로 포장하지 않는다.

## 실행 증거

- `/home/main/village-contract-live/run-0.ndjson`: 실제 worker 이벤트(최종 실행).
- `report.json`, `render-proof.json`: 요청/모델/저장 검증 및 재로드 문서 통행/주민 대사.
- `editor-after.png`: 실제 실행 직후 에디터 스크린샷.
- `village-full.png`, `interior.png`: 재조회한 문서를 에디터 타일·이벤트 렌더러로 출력.
- `/home/main/village-contract-result.html`: 모든 이미지 base64 포함, 외부 이미지 의존 없음.

재실행은 워크트리 Vite 서버 9839를 띄운 뒤 `node scripts/qa/village-contract-live.mjs`,
`node scripts/qa/village-contract-capture.mjs`. 이 스크립트는 위 전용 행에 저장한다.

## 검증과 한계

Bun 계약/실제 Agent 루프 6건과 Vitest facade/intent-note 50건 통과.
앱 타입 검사는 upstream `src/ai/activityVisual.ts`의 `record possibly undefined` 10건 때문에
실패했다. 해당 파일은 이번 변경에서 수정하지 않았다.

첫 라이브 시공에서 예전 빈 맵 중앙 좌표 복원이 플레이어를 고립시키는 결함을 발견했다.
이 경우 빌더의 검증된 시작점을 유지하도록 고쳤고 같은 형태의 회귀 테스트를 추가했다.
마지막 실행은 이를 포함한 코드로 새 빈 맵에서 다시 시공했다.

이 계약은 단일 마을 요청에 적용한다. 복합 모험·NPC 보상·기능 검증 및 명시 `/pi`의 기존
오케스트레이션까지 전환한 것은 아니다. 미감 점수 루프는 단일 계약의 완료 조건에서 빠졌지만,
결과의 규칙적인 길/광장·집 배치에 대한 미적 품질 개선은 별도 문제로 남는다.
