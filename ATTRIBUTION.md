# Attribution

그림·소리 같은 에셋의 출처는 `public/assets/ATTRIBUTION.md` 에 있다. 이 문서는 에셋이 아닌 제3자 글·코드를 적는다.

## general-good-writing — 코드 연규(code-yeongyu)

- 원본: https://github.com/code-yeongyu/general-good-writing (커밋 `eeb868e`)
- 저작자: 코드 연규(code-yeongyu)
- 쓰는 곳: OPRN 에디터의 공식 윤문 스킬.
  - 규칙 문서: `assistant-skills/dialogue-polish/references/`(한국어 `ko/`, 영어 `en/`, 원본 문장 그대로). 게임 글 적용 지침은 OPRN 이 쓴 `assistant-skills/dialogue-polish/SKILL.md`.
  - 린터(polish-lint 정규식 규칙): `src/vendor/general-good-writing/`. 판정 모델(Jev) 클라이언트는 빼고 로컬 규칙만 실었다. 수정 내역은 그 폴더의 `README.md`.
  - 편집기 조수 도구 `lint_dialogue`, 코딩 에이전트 명령 `node scripts/content/lint-game-text.mts`.
- 라이선스: 원본 저장소에는 라이선스 파일이 없다. 저작자가 크레딧 표기를 조건으로 OPRN 에서 쓰는 것을 허락했다(2026-10-30, 사용자를 통해 확인). 이 절과 에디터 「설정 → 정보」의 크레딧이 그 표기다.
