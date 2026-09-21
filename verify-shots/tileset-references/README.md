# 타일셋 참고문서 구현 확인

- UI: 실제 데이터베이스의 타일 → 참고문서에서 파생 Slates의 공유 자료를 표시.
  `database-reference-overview.png`, `database-reference-docs.png`.
  캡처는 원격에서 재로드한 프로젝트를 사용하는 임시 브라우저 QA 세션이다.
- 편집: 용도 생성·이름 변경, MD 편집, MD+PNG 가져오기, 상대 경로 이미지 표시,
  HTML 실행 방지, 직렬화 왕복, 용도 삭제 후 원본 보존. `editing-observation.json`.
- AI: 실제 Pi 어댑터 및 제공자 payload 경계에 Responses/Chat/Anthropic/Gemini 형식을 전달.
  미열람·같은 응답의 읽기·제공자 실패·이미지 없는 전달·잘린 본문 차단,
  완전한 전달 후 허용, 문서 수정 후 증거 무효. `contract-observation.json`.
  실제 유료 모델 호출 또는 새 마을 생성은 하지 않았다.
- Bun Pi 런타임 import, 변경 TS 17파일 문법 변환, git diff 공백 확인 성공.
  gates/vitest/전체 typecheck 미실행.
- LegacyDb `rpg-zzu-slates32-38e6`: SHA `552f3909e08b3b83b29ddf87babc26c5ebc375e4f75b71ee1b276e17ad3a4db3`.
  원본과 타일셋 mirror 재로드 일치. 기존 13개 맵 보존. `persistence.json`.
- 로컬 `output/slates32-project`: revision 11, project id `c8c53479-8d1a-42da-96ee-e493598ef498`.
  저장 후 SQLite export의 tilesets 전체가 원격 재로드와 동일함을 확인.
- 원본 `slates_32`에 4용도 / 14 MD / 109 이미지, 파생 타일셋 7개는 원본을 공유.
  `migration.json`. 외부 에이전트용 MD·PNG 추출도 확인(`output/tileset-references/exported`).

DB raw JSON과 자격 증명은 이 디렉토리에 저장하지 않는다.

## 2026-09-21 UI 정리

- 타일 전용 목록 → AI 참고문서(기본 탭) → 용도 → MD/이미지 → 독립 읽기 영역.
- 1440px / 1024px: 타일 작업대 clientWidth와 scrollWidth가 각각 1193 / 777로 같음.
  읽기 영역 폭 779 / 437px. `database-reference-1440.png`, `database-reference-1024.png`.
- `database-reference-images.png`: 이미지 목록과 큰 미리보기. 이미지 확대 대화상자 열기/닫기 확인.
- `tiles-rules.png`, `tiles-compose.png`, `tiles-knowledge.png`, `tiles-settings.png`: 유지한 편집 탭.
- 첫 방문 참고문서 기본 선택, 구형 JSON/생성 감사 UI 부재, 브라우저 pageerror 0 확인.
- 새 UI에서 MD 편집·파일 가져오기·임시 용도 삭제 후 원본 보존 확인.
- 이번 변경은 에디터 UI만 수정했다. QA에서 저작한 임시 자료는 삭제했고 원격 프로젝트에는 쓰지 않았다.
- 수정 UI 모듈 9개 TypeScript 문법 변환: 진단 0. unit/gates/전체 typecheck 미실행.
