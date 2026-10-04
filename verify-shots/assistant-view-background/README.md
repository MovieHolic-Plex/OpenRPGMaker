# 조수 화면 유지와 백그라운드 적용 — 2026-10-04

실제 편집기와 도구·적용 경로를 사용한 브라우저 재현에서 7개 확인 항목이 통과했다.
결과는 `report.json`, 실행기는 `scripts/qa/assistant-view-background.mjs`다.

```bash
npm run dev:worktree
BASE=http://127.0.0.1:9911 node scripts/qa/assistant-view-background.mjs
```

- 임시 프로젝트: `test/fixtures/projects/event-pages-v3.json`. 공용 카탈로그와 타일 참고문서는
  빈 QA 응답으로 고정한다. 모델 전송은 대본 NDJSON이며 실제 모델 호출은 없다.
- `create_map`과 `paint_tiles`는 실제 도구 실행기에서 실행한다. 약 1.88MB 프로젝트를
  실제 체크포인트 적용과 gzip 응답 경로로 보낸다. 두 응답 모두 성공이고 실제 스토어에
  새 맵과 타일 값 1이 남아 있다.
- `document.visibilityState=hidden`, `hasFocus=false`와 함께 rAF 및 0/50ms 타이머를 정지시킨다.
  두 체크포인트가 모두 반영되어 응답을 받은 뒤에도 완료 이벤트는 아직 보내지 않은 상태다.
- 복귀 후 현재 맵 `map_page`, scrollX -322, scrollY -388.5, zoom 2가 동일하다.
  자동 카메라 요청은 0개다. 완료 이벤트 뒤 진행 표시는 제거되고 페이지 예외는 없다.
- 위치 안내 권한이 없는 도구 호출은 현재 맵을 유지한다. 권한을 준 읽기 전용 Pi 요청에서
  중첩 `agent_event`로 두 위치 도구 결과를 보내면 첫 위치 `qa_visible_scene`으로만 이동한다.
  실제 카메라 요청은 1개다. 이 권한은 모델 분류를 대신해 실행기 입력에 직접 준다.

화면 확인:

1. `01-request.png`: 모델 출력 전에 요청 표시.
2. `02-first-map.png`: 새 맵을 적용해도 기존 맵 유지.
3. `03-background-applied.png`: 두 적용 응답을 받은 후에도 기존 맵 유지.
4. `04-explicit-location.png`: 위치 안내 요청이 실제 새 맵을 연 결과와 수동 「변경된 곳 보기」 버튼.

이 결과는 정본 SQLite 저장·라이브 모델의 한국어 의도 분류·Electron 실제 최소화의 검증이 아니다.
앱 종료, 브라우저 freeze/discard, 기기 절전 뒤 실행은 범위 밖이다.
회귀 테스트는 추가했지만 세션의 AGENTS 지침에 따라 Vitest·gates·전체 typecheck는 실행하지 않았다.
별도로 변경된 TypeScript 34개 파일의 문법 변환과 번역 JSON 3개의 파싱을 확인했다.
