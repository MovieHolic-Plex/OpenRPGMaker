# 일기 이벤트 그래픽 누락 재현·수정 (2026-10-04)

## 재현과 원인

실제 편집기의 `ai-input`/`ai-send`로 다음 요청을 보냈다.

> 현재 맵에 그림이 보이는 일기 이벤트 하나를 깔아줘. 조사하면 짧은 일기 내용 한 줄이 나오게 해줘. 일기·노트·책에 맞는 기존 그림을 찾아 지정하고 이벤트 이름은 일기로 해줘.

조수 Gemini 3.8 Flash는 검색을 반복한 뒤 5분 37초에 작업을 마쳤다. 실행 ID는
`b41b07d0-1958-4228-883c-ada1a63b62f4`. 같은 실행의 HTTP 요청이 두 번 관측됐으며
독립 실행 두 개를 시작한 것은 아니다. `wire-summary.json`의 마지막 `upsert_event`는
성공했고, 뒤의 `get_event`와 `done`도 기록됐다.

실제 결과는 `ev_diary`, 이름 `일기`, `(10,7)`, action 트리거, 대화 한 줄이다.
그림은 `cc0-jetrel-notebook`, pattern 0, direction down이다.
캐릭터 시트를 찾는 기존 이벤트 편집기 미리보기는 이 공용 아이템 그림을
`data-unsupported=true`로 처리했다. 맵의 리소스 조회는 같은 그림을 지원한다.

## 정본과 재로드

- 프로젝트 ID: `76ba2342-fc13-4ab2-b815-cb9ecd3891f1`
- 별도 확인용 SQLite 정본: `/home/main/.codex/worktrees/e35b/rpg-zzu/output/qa/event-diary/project/project.sqlite`
- 확인 호스트: `http://127.0.0.1:18436`
- 실제 조수 저장 결과: revision 3. 원본 프로젝트나 LegacyDb에는 쓰지 않았다.
- `reload.json`: 편집기에서 열기 → 저장하고 닫기 → 같은 호스트 새로고침 → 같은 이벤트 다시 열기.
  project ID, 페이지 그래픽, 대화 명령 보존과 실제 미리보기 표시를 확인한다.
  최종 확인은 revision 6 → 8, `passed: true`, 추가 AI 실행 0건, 브라우저 오류 0건이다.
  앞선 확인 중 호스트가 종료되어 저장된 동일 SQLite로 호스트를 재시작했다.

시작 전에 SQLite `ai_conversations`와 브라우저 `oprn-ai-records`를 조회했다.
새 확인용 프로젝트에는 기존 기록이 없었다. 요청 원문은 `report.json`에도 보존했다.

## 화면 근거

- [실제 조수 결과](assistant.png)
- [저장된 일기의 맵 표시](diary-map.png)
- [이벤트 편집기의 일기 그림](diary-event-editor.png)
- [재로드 후 이벤트 편집기](diary-reloaded.png)
- [형식별 수정 전·후](formats-before-after.png)

형식 비교는 기존 소스 blob `f7e0357ffb36a2137e1ece9264fa935bdd1898e6`과 수정된
실제 렌더러를 같은 브라우저에서 실행한 결과다. 노트 아이콘, 일반 업로드 시트의 아래 행,
프로젝트 일반 시트 참조, 캐릭터 시트 참조, 기존 캐릭터 5종을 검사했다.
캐릭터 이미지의 실제 로드, 일반 시트 프레임 좌표, 범위 밖 프레임 거부,
일반 그림에 걷기 애니메이션을 적용하지 않는 동작과 아이템 발자국 미리보기 배율을 확인했다.
색 사각형 시트는 형식 확인용 메모리 fixture이며 프로젝트 콘텐츠가 아니다.

## 검증과 재실행

- `npm run build:fast`: exit 0. 기존 Rollup/CSS 경고가 있다.
- `node scripts/qa/event-graphic-preview.mjs`: exit 0.
- `node scripts/qa/event-diary-reload.mjs`: exit 0. 결과는 `reload.json`.
- `git diff --check`, 세 브라우저 드라이버 `node --check`: 완료.
- Vitest, 전체 typecheck, gates는 AGENTS의 세션 실행 제한에 따라 실행하지 않았다.

형식 비교는 `npm run dev:worktree`로 띄운 개발 서버를 사용한다.
포트가 다르면 `DIARY_PREVIEW_URL=http://127.0.0.1:<port>`를 지정한다.
드라이버가 비교 소스와 HTML을 `output/qa/event-diary/`에 직접 준비한다.

실제 조수 실행은 빈 정본을 `node scripts/oprn-store.mjs init output/qa/event-diary/project`로
준비한 뒤, 빌드된 이 체크아웃의 렌더러와 브라우저 브리지를 사용해
`node scripts/oprn-serve.mjs --project-dir output/qa/event-diary/project --port 18436 --dist dist --bridge <browser-bridge.js>`로
호스트를 연다. `event-diary-graphic.mjs`가 실제 모델을 호출하며, `event-diary-reload.mjs`는
추가 모델 호출 없이 이미 저장된 일기를 검증한다. 새 실험에는 별도 프로젝트 폴더를 사용한다.
