# ☰ 「사용 로그 내려받기」 브라우저 증거 (2026-09-09)

실제 앱(vite dev, `127.0.0.1:9443`)에서 받은 것이다. 링버퍼(`localStorage["oprn:ai-activity-logs"]`)에
대화 1건 + 영역 작업 실패 1건을 심고 컴포저 ☰ 의 `ai-command-menu-usage-log` 를 눌렀다.

| 파일 | 무엇 |
| --- | --- |
| `menu-open.png` | ☰ 에 「사용 로그 내려받기」가 로컬 진단 보고서와 전체 기록 사이에 보인다 |
| `toast.png` | 누른 뒤 "사용 로그 4건을 txt 로 저장했습니다" — 건수를 말하는 토스트 |
| `empty-log-toast.png` | 기록을 지우고 다시 누르면 파일을 만들지 않고 "아직 저장된 조수 사용 기록이 없습니다" |
| `downloaded-ai-usage-log.txt` | 브라우저가 실제로 저장한 파일 원본 (`ai-usage-log-2026-09-08T21-29-56-296Z.txt`) |

측정된 것:

- 파일 이름 `ai-usage-log-2026-09-08T21-29-56-296Z.txt`, MIME `text/plain;charset=utf-8`, `URL.createObjectURL` 1회.
- 빈 로그일 때 `URL.createObjectURL` 0회 — 빈 파일을 떨어뜨리지 않는다.
- 받은 txt 에 여러 줄 지시가 줄 그대로("마을 광장에" / "분수를 놓아줘") 남고, 자원 줄
  (`3.2초 · LLM 2회 · 도구 1회 · 토큰 1200/340`)과 실패 기록의 `오류:`·`사유:` 가 모두 들어 있다.
- 받은 txt 의 기록이 3건인 것은 정상이다: 화면 조작(ui 채널)도 같은 링버퍼에 쌓이므로
  ☰ 를 여는 것만으로 한 건이 늘어난다. 그래서 e2e 단정에서 건수·순번은 못 박지 않는다.

러너(`test/e2e/_ai-usage-log-download.spec.ts`)는 이 작업 트리에서 뜨지 않는다 —
`@playwright/test` 가 설치되어 있지 않다(`node_modules` 가 비어 있고 도구는 전역 설치를 쓴다).
그래서 위 증거는 Playwright MCP 브라우저로 받았고, 러너 파일은 같은 순서를 담아 두었다.
