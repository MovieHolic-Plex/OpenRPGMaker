# main 통합 후 32px 브라우저 확인

검사 대상: `23db0270b` (main `ff2f41a1c` 통합 후).

- 변경된 src TypeScript 45개를 esbuild로 문법 파싱. 전체 typecheck/테스트 스위트 아님.
- 실제 에디터: source frame 32×32, tile 2 cutX=64, 실제 포인터로 (5,4)에 tile 2 칠하기 확인. page errors 0.
- 전용 player.html: 시작 발좌표 (80,96), 오른쪽 이동 후 (112,96), 막힌 칸에서 그대로 유지.
- action 이벤트 32→16 전이: (40,48), 이어 16→32 전이: (464,352). page errors 0.
- 관측 JSON의 프레임·칠한 ID·좌표·오류를 별도로 assert하여 확인했다.
- 최초 cold editor 로드는 준비 훅 대기 시간이 초과됐다. 새 브라우저 재실행에서 정상 로드·위 동작을 확인했다.
- 전체 gates/vitest/typecheck는 세션 규칙에 따라 실행하지 않았다.
- 기존 Slates v3 원격 저장·재로드/통행 근거는 `docs/experiments/slates-astra-v3/RESULT.md`.
