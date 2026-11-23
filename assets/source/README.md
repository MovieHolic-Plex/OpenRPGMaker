# assets/source — 앱에 싣지 않는 작업 원본

`public/` 은 vite 가 `dist/` 로 통째로 복사하고, `dist/**` 는 데스크톱 패키지(app.asar)와 웹 배포에 그대로 들어간다.
그래서 게임·편집기가 읽지 않는 작업 원본(고해상도 마스터, 백업)은 여기 둔다. 2026-11-23 app-size 레인에서 옮겼다.

| 폴더 | 무엇 | 누가 읽나 |
|---|---|---|
| `shared-faceset/` | 공용 표정 76종의 1254×1254 원본 시트(178MB) | `scripts/prepare-shared-faceset.mjs` 만. 런타임은 `public/assets/shared/faceset/<stem>-expressions/` 의 48px 낱장을 쓴다 |
| `welcome-backup/` | 환영 화면 슬라이드의 옛 판 백업 | `test/codexImageWorker.node.test.mjs` 의 JPEG 고정물 하나 |

새 원본을 `public/` 에 두기 전에 런타임 코드(`src/`·`electron/`)가 그 경로를 만드는지 먼저 확인한다.
