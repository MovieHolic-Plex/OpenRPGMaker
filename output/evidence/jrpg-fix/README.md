# JRPG 수정 후 검증 증거

`REPORT.html` 또는 `REPORT.md`를 먼저 읽는다. 원래 불합격 보고서는 같은 워크스페이스의
`../jrpg-adversarial-review/REPORT.html`에 그대로 보관되어 있다.

- 정본 콘텐츠: LegacyDb 프로젝트 `oprn-399e312698`.
- `review/`: 실제 AI 도구 감사 기록, 변경 전후 비교, 최종 DB·이벤트 설정, 원격 저장 증명, 게이트 비교.
- `screens/`: 실제 편집기 DB 20개 화면, 전체 맵 4개, AI 실행 및 출하 플레이어 화면.
- 전체 프로젝트 JSON과 인증정보는 커밋하지 않는다. 런타임 QA는 원격 저장 후 다시 읽은 프로젝트 사본으로 실행했다.

## 보고서 재생성

저장된 증거만 읽는 명령:

```bash
python output/evidence/jrpg-fix/build-report.py
```

## 편집기와 연결한 재현

기록 스크립트는 이 작업의 편집기 `http://127.0.0.1:19861`, Chromium CDP `19862`,
프로젝트 `oprn-399e312698`을 사용한다. 다른 포트를 쓰면 해당 URL을 맞춘다.
환경값은 기존 `scripts/lib/legacyDb-database-ops.mjs`로 읽으며 로그에 키를 출력하지 않는다.
HTTP 전달 코드는 실제 서버 응답을 Node fetch로 받아 브라우저에 전달한다. 응답을 합성하지 않는다.

`run-next.mjs`는 현재 편집기의 실제 store 모듈 URL을 찾아 같은 singleton을 캡처하고,
원문을 실제 AI 입력창에서 전송한다. 이 명령과 `maintain-final-*.mjs`는 원격 프로젝트를 수정한다.
최신 원문 실행의 감사표는 `review/ai-tool-audit.json`, 별도 무대 보완 실행은
`review/stage-authoring-audits.json`, 마지막 직접 보정은 `review/maintenance-tools.json`에 있다.

store가 캡처된 같은 브라우저에서 저장·재조회·재로드 및 런타임 검증:

```bash
JRPG_RUN=reproduced node output/evidence/jrpg-fix/prove-persistence.mjs
JRPG_RUN=reproduced node output/evidence/jrpg-fix/runtime-journey.mjs output/evidence/jrpg-fix/reproduced/project.json
```

런타임 스크립트는 전용 `startPlayerQaServer`/`runRuntimeQa`와 `player.html`의 내보내기 store를 쓴다.
보행은 실제 충돌 판정과 스프라이트 위치를 읽어 방향 입력을 보내며, 전투·상점·저장·로드는 키보드로 조작한다.
난수 seed만 고정한다. 전체 여정에서 텔레포트·재화 지급·클리어 스위치 강제 변경은 사용하지 않는다.

검증기의 초기 실패 기록은 로컬에 별도 보존되어 있다. 이동·전이·전투 전환·대사 타이핑의 완료를
관측하도록 고친 마지막 전체 여정만 통과 근거로 사용한다.

원격 정본을 읽기 전용으로 다시 확인하려면 로컬 `final/project.json`을 준비한 뒤 실행한다:

```bash
node node_modules/vite-node/vite-node.mjs --script output/evidence/jrpg-fix/recheck-remote.mts
```

이 비교는 출하 로드·직렬화 정규화를 적용하므로, 재로드 과정에서 생기는 빈 상점 분기의
기본값과 실제 저작 콘텐츠 변경을 구분한다. 결과는 `review/remote-recheck.json`에 저장된다.
