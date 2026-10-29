# general-good-writing polish-lint (vendored subset)

- 원본: https://github.com/code-yeongyu/general-good-writing , 커밋 `eeb868e` (`scripts/src/`)
- 저작자: 코드 연규(code-yeongyu)
- 라이선스: 원본 저장소에 라이선스 파일이 없다(2026-10-29 확인). 저작자의 사용 허락을 받는 중이다. origin(OpenRPGMaker)은 공개 저장소라, 허락 전에는 이 폴더를 푸시·머지하지 않는다.
- 크레딧: 저장소 루트 `ATTRIBUTION.md`, 에디터 「설정 → 정보」.

## 무엇을 가져왔나

`src/` 아래 파일은 원본 `scripts/src/` 의 같은 경로 파일이다. 로컬 규칙 경로(`report/scan.ts` 를 판정 모델 없이 부르는 길)가
import 하는 32개만 가져왔다. 가져온 파일은 아래 하나를 빼고 원본과 바이트까지 같다.

- `src/jev/client.ts` — **수정본.** 원본은 TypeSafe Jev 판정 서버 클라이언트(`node:crypto`, 키 파일 읽기, 네트워크)다.
  OPRN 은 판정 모델을 쓰지 않으므로 오류 클래스(`JevError`·`JevBackendError`)·타입·`Usage` 만 남겼다. 파일 머리 주석에 지운 것을 적었다.

가져오지 않은 것: CLI(`polish-lint.ts`, `src/cli`), `sdk.ts`(키 파일·클라이언트를 끌어온다), 키 관리(`keys.ts`·`secret.ts`),
Jev 실행·리플레이(`jev/evaluate*.ts`·`jev/replay.ts`), diff·inject·triage, 테스트.

## OPRN 파일

- `local.ts` — OPRN 이 쓴 진입점. 원본 `sdk.ts` 의 `lint(text, { jev: false })` 와 같은 길(`scan` → 보고서)을 키·네트워크 없이 부른다.

## 경계

- 편집기 조수 도구 `lint_dialogue`(`src/editor/tools/dialogueLintTool.ts`)가 `prepare` 에서 **동적 import** 로만 불러온다.
  편집기 첫 번들에 들어가지 않고, 내보낸 게임(플레이어·단일 HTML)에는 들어가지 않는다(`openwiki/licensing.md` 「코드 경계」).
- 원본을 갱신할 때는 같은 32개 파일을 다시 복사하고 `client.ts` 만 같은 방식으로 깎는다. 규칙 문서는 `assistant-skills/dialogue-polish/references/` 를 함께 갱신한다.
