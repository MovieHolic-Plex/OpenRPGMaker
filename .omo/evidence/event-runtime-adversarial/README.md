# Headed browser play and adversarial review — 2026-09-05

[상세 리뷰](../../../docs/reviews/2026-09-05-event-runtime-adversarial.md). 실제 Chromium 창을 Xvfb 가상 화면에서 실행했다. 모든 게임 입력은 키보드이며 디버그 훅은 관찰에만 사용했다.

- 최신 Supabase 프로젝트 읽기: `remote-load.json`. 프로젝트 `rpg-zzu-cheolsu-memory-20260905-df12`, 기존 저장본과 SHA-256 동일. 이번 작업은 원격 콘텐츠를 변경하지 않았다.
- 회상 17개 대사·귀환·재조사·이동: `cheolsu-report.json`, `cheolsu-SUMMARY.md`.
- 카메라/반응형 화면: 1280×720, 640×480의 288표본에서 경계 이탈 없음. 100ms 이하 표본 간 카메라 이동 최대 논리 7px. 직접 확인한 PNG: `cheolsu-12-dialogue.png`, `cheolsu-16-dialogue.png`, `cheolsu-sweep-1280x720.png`, `cheolsu-sweep-640x480.png`.
- 메뉴·로드·영상·조건·장애물 우회 계약: `commands-report.json`, `commands-SUMMARY.md`, 직접 확인한 `commands-01-path.png` ~ `commands-06-loaded.png`. 앱 오류/경고 0, GPU ReadPixels 성능 경고 4개는 보존했다.
- 반례 6개 모두 통과: `boundary-report.json`, `*-after.png`. 재지정 도중 잘못된 칸에 도착하던 수정 전 브라우저 증거: `retarget-before-report.json`, `retarget-before-failure.png`.
- 수정 전 프레임 테스트 5개 실패: `retarget-before.log`, `npc-before.log`, `queued-before.log`. 최종 관련 11파일 / 227개 통과: `focused-final.log`.
- 영상은 로컬 videos 폴더에 보존하고 PR에는 지정 PNG와 관찰 JSON만 추적한다.

재현:

```sh
npx tsx scripts/prepare-event-runtime-qa.mts
xvfb-run -a env RUNTIME_QA_HEADED=1 node scripts/qa-event-runtime.mjs
xvfb-run -a env RUNTIME_QA_HEADED=1 node scripts/qa-event-runtime-adversarial.mjs
# 원격 로드한 프로젝트 JSON 경로를 지정한다.
xvfb-run -a env RUNTIME_QA_HEADED=1 RUNTIME_QA_VISUAL_SWEEP=1 node scripts/qa-cheolsu-keyboard.mjs <remote-project.json> final-visual
```

전체 게이트는 통과로 보고하지 않는다. `ed47e1d0` 소스의 실행 로그는 app 타입 오류 0, Vitest 12,973 통과 / 170 실패, CSS 통과, 표면 검사 실패를 기록했다. 추적 기준선 밖 실패 17파일은 모두 이전 base 대조에서 확인한 파일에 포함됐다(`gate-comparison.json`). 도구 세션 종료는 143이므로 전체 프로세스의 정상 종료 증거로 쓰지 않는다.

그 뒤 최신 main을 합친 `a624f926`에서 app 타입 검사 **exit 0**와 관련 11파일 / 227개 **exit 0**를 직접 다시 확인했다. 메뉴·로드·영상 및 「철수의 기억」 전체 플레이와 두 화면 크기의 시각 검사도 통과했다. 전체 스위트는 main 통합 후 재실행하지 않았다. `full-gates.log`, `typecheck-final.log`, `focused-final.log`가 각각의 근거다.
