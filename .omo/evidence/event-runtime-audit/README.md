# Event runtime execution fixes — 2026-09-05

검토: [상세 보고서](../../../docs/reviews/2026-09-05-event-runtime-audit.md).

- 관련 회귀 9파일 / 139개 통과: `final-focused.log`.
- 출하 플레이어 실제 키보드 검증: `player-SUMMARY.md`, `player-report.json`.
- 확인한 화면: `01-path.png`, `02-menu.png`, `03-load.png`, `04-movie.png`, `05-finished.png`, `06-loaded.png`.
- `Wait Until`의 병렬 생산자가 스위치를 켠 후에만 진행. 지형 조회 9, 이벤트 조회 1.
- NPC 장애물 (5,6)을 피한 관찰 좌표: (3,6) → (4,6) → (4,7) → (5,7) → (6,7) → (7,7) → (7,6).
- 메뉴와 불러오기 패널은 닫기 전 다음 명령 차단. 동영상은 실제 `playing` / `ended` DOM 이벤트 확인.
- 준비한 저장 슬롯을 선택해 (3,9)로 로드한 뒤 오른쪽 키로 (4,9) 이동. 이전 이벤트 대사는 재개되지 않음.
- Chromium GPU ReadPixels 성능 경고 4건은 `player-report.json`에 그대로 기록. 앱 오류/경고 0.
- 「철수의 기억」: 최종 코드로 17개 대사·현재 귀환·재조사·이동 통과 (`cheolsu-SUMMARY.md`, `cheolsu-report.json`). 지정 PNG 두 장도 확인.
- 원격 프로젝트 `rpg-zzu-cheolsu-memory-20260905-df12`: 기존 콘텐츠 수정분 Supabase 저장 후 재로드 대조 성공 (`cheolsu-persistence.json`). 후속 엔진 수정은 콘텐츠를 다시 덮어쓰지 않음.

재현:

```sh
npx tsx scripts/prepare-event-runtime-qa.mts # ffmpeg 필요; 테스트 픽스처만 생성
node scripts/qa-event-runtime.mjs
node scripts/qa-cheolsu-memory.mjs # 원격 재로드 프로젝트 JSON이 준비된 작업 환경
```

WebM 영상은 로컬 검증 폴더에 보존했다(각 report.json의 video 경로). PNG/관찰 JSON을 PR 근거로 추적한다.

전체 저장소 게이트는 `full-gates.log`와 최종 비교 기록을 참조한다.
