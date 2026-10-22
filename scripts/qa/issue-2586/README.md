# #2586 재현 스크립트

전투 런타임 검토 요청(#2586)의 항목별 재현. 테스트 스위트가 아니라 한 번 돌려 눈으로 보는 탐침이다. 저장소 루트에서 실행한다.

| 항목 | 명령 |
|---|---|
| 1 전투 오디오 연결부 | `node scripts/qa/issue-2586/audio-bridge-probe.mjs` |
| 2 전술 전투 중 시계 | `node scripts/qa/issue-2586/time-pause-probe.mjs [playSceneTime.ts 경로]` |
| 3 전술 전투 종료 정리 | `PROBE_STORE_STUB=1 node --no-warnings --loader ./scripts/qa/issue-2586/probe-loader.mjs scripts/qa/issue-2586/tactics-teardown-probe.ts` |
| 4 스냅샷 호출 시점 | `node --no-warnings --loader ./scripts/qa/issue-2586/probe-loader.mjs scripts/qa/issue-2586/snapshot-probe.ts` |
| 5 플레이어 번들 참고문서 | `node scripts/qa/issue-2586/measure-player.mjs $PWD strip /tmp/out-strip` (`nostrip` = 제거 플러그인 끔) |
| 6 런타임 스모크 | `node scripts/runtime-qa.mjs --scenario smoke --netns` |
