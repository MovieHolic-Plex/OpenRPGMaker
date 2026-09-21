# AI 작업 표시 수준과 조수·팀 큰 창

기본은 간단히 보기(주요 단계 최대 네 줄)이며 생략, 자세히 보기, 매우 자세히 보기를 선택할 수 있다.
큰 창은 현재 조수와 오른쪽 팀의 실제 DOM을 함께 옮기므로 입력·실행·검토 결정을 복제하지 않는다.

후속 UI 보정: 표시 수준 드롭다운을 항상 보이는 네 버튼으로 교체했다. 확대 진입점도
레일의 아이콘 단독 버튼에서 작업 표시 바로 위의 `크게 보기` 글자 버튼으로 옮겼다.
31/31 브라우저 항목(exit 0, 오류 0)과 앱 빌드(exit 0, 44.33초)를 재확인했다.
`01-brief.png`와 `06-wide.png`는 버튼 방식과 큰 창의 실제 최신 화면이다.

## 확인 결과

- `node scripts/qa/ai-activity-levels.mjs`: **29/29, exit 0**, 브라우저 오류 0.
- `npm run build:app`: **exit 0**, 40.15초. 기존 큰 청크/순환 청크 및 CSS 파서 경고는 남는다.
- `bun build scripts/lib/piAgentRuntime.ts --target=bun --packages=external --outfile=/tmp/oprn-ai-activity-worker-681a.js`: **exit 0**, 872모듈.
- `git diff --check`: 통과.
- Vitest, 전체 typecheck, gates는 세션 규칙에 따라 실행하지 않았다. 신규 단위 계약은 작성만 했다.

브라우저는 격리된 devProject에서 외부 모델/원격 저장을 모킹한 결정적 스트림을 재생한다.
실제 모델 품질이나 운영 LegacyDb 저장을 검증한 결과가 아니다.
220개 읽기 도구, 실패 후 재시도, 구조화 입력·출력, 인증 필드 가림, 기록 내보내기,
검토 버튼 유지, 팀원 표시 동기화, 새로고침 뒤 최종 상태 복원, 영역 작업 중지와 후속 레인 오류를 확인했다.
큰 창은 1440px/1024px에서 대화와 팀 상세의 비중첩 배치, 초안·검색 유지, Escape·초점 복귀를 확인했다.

로컬 증거: `output/evidence/ai-activity-levels/report.json`, `01-brief.png`부터
`07-wide-compact.png`, `execution.json`, `before-reload.json`, `restored.json`.
개발 서버 HMR 뒤에는 timestamp가 다른 모듈 인스턴스가 생길 수 있어 서버를 다시 시작한 후 최종 확인했다.

## 보존 범위

실행 기록은 표시 수준과 별개로 최대 2,000행/약 2백만 문자를 보존한다. 기기 보관은
7일/20실행/약 10MB이며 생략과 잘림을 명시한다. 비공개 thinking·프로젝트 사본은 제외한다.
도구 실행 종료, 초안 검토, 실제 적용, 저장 응답은 별도 사실로 기록한다.
로그 수준은 실행 권한이나 답변 예산을 변경하지 않는다.
