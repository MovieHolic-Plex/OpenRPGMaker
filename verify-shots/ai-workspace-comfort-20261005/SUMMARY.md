# AI 작업 창 · 로그 추출 화면 증거

## 결과

실제 편집기 UI 확인 **32/32 통과**, 브라우저 코드 오류 0건.
실행: `node scripts/qa/ai-workspace-comfort.mjs` (개발 서버: `npm run dev:worktree`, 9861).

- 처음 방문의 접힘, 단일 작업 창, 조수/대화 탭, 입력칸 1개, 기존 입력 DOM·커서·초안 유지.
- 조수별 초안, 같은 실행의 문구 갱신 중 선택 유지, 전송 대기 이유, 지금/결과/다음 표시.
- 지도 위 창 펼침/접힘에서 지도 폭 고정; 1024px·700px 화면 안에 표시.
- 맵 보기와 큰 창의 맵 보기: 지도 선택 후 창 접기. 프로젝트 identity 유지, 편집 checkout 없음.
- 실제 Clipboard API 복사, 실제 TXT/JSON 다운로드, 전체·선택 조수·보관 실행 범위.
- 다른 프로젝트의 보관 로그 제외, 인증 필드 정제, 201개 행 보존, 원본 생략 수 표시.
- 복사 권한 거부를 따로 재현하여 수동 복사 내용이 상태 갱신 중 유지됨을 확인.
- 큰 창 왕복에서 같은 입력 노드·초안 유지, 마지막 탭·접힘 값 저장.

## 증거 범위와 제한

실제 편집기에 **UI 확인용 제어된 팀 영수증**을 재생했다. 새 모델 호출, 자연어 저작 수행,
게임 콘텐츠 변경·플레이·SQLite 정본 저장 검수의 근거가 아니다. 보관 기록은 실제 기기 IndexedDB,
복사·다운로드는 실제 브라우저 기능을 사용한다. 선택한 프로젝트·맵·trace ID는 `report.json`에 있다.
개발용 디스크 로그 미러 두 엔드포인트만 촬영 도구에서 분리했다.

새로고침 확인은 개발 환경의 반복된 `ERR_NETWORK_CHANGED`로 제외했다. 저장된 탭/접힘 값을
확인했으며, 새로고침 후 화면 복원 통과로 보고하지 않는다. gates·Vitest·전체 typecheck는
AGENTS의 이번 세션 실행 제한에 따라 돌리지 않았다. 최신 main 통합은 생성된 wiki INDEX 충돌만
재생성하여 해결했으며 AI 작업 창 소스에는 main 충돌이 없었다.

## 파일

- `report.json`: 32개 확인의 판정 및 프로젝트·맵·실행 ID.
- `01-conversation.png`, `02-selected-assistant.png`: 대화와 조수 작업 창.
- `03-map-focus.png`, `07-final-map.png`: 지도 보기와 접힘.
- `04-log-export.png`: 로그 범위 선택·복사·다운로드.
- `05-wide.png`: 기존 큰 창 왕복.
- `06-width-1024.png`, `06-width-700.png`: 좁은 화면.
- `selected-member.txt`, `selected-member.json`, `whole-run.json`, `archived-run.json`: UI가 실제 내려받은 파일.
- `ai-workspace-comfort.mp4`: 25.32초 실제 화면 조작 녹화 (로컬 산출물).

PNG 캡처 전에 뷰포트 폭을 1px 바꾼 뒤 돌려 완전한 브라우저 repaint를 요청했다.
영상은 실제 조작 구간을 잘라 H.264/yuv420p MP4로 변환했으며 장면을 합성하지 않았다.
