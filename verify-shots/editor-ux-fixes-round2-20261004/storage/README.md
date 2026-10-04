# 저장 준비·여러 단계 되돌리기 — 수정 비교

Native Chromium, 같은 편집기와 store에서 기준 커밋 `7ce9a7655510e82360efe154bc888a0754e06d04`의 모듈과 수정 모듈을 호출했다. 전체 이전 빌드와의 비교가 아니다. 1440×900, reduced motion, 합성 fixture, CPU throttling 없음. 실제 호스트·SQLite 저장, 모델 호출은 없다. 다른 세션의 CPU/GC 부하는 통제하지 못했다.

| 조건 | 이전 | 수정 | 측정 |
| --- | ---: | ---: | --- |
| 512×512 맵 diff, first 변경 | 121.3ms | 0.1ms | 각 3회 중앙값 |
| 512×512 맵 diff, last 변경 | 112.3ms | 6.4ms | 각 3회 중앙값 |
| 512×512 맵 diff, metadata 변경 | 115.6ms | 0.1ms | 각 3회 중앙값 |
| 1맵, 10단계 undo 점프 | 877.5ms | 1045.3ms | 각 1회; 구독자·정규화 포함 |
| 12맵, 10단계 undo 점프 | 1545.7ms | 436.2ms | 각 1회; 구독자·정규화 포함 |

1맵 점프의 수정 관측은 느려졌으므로 이 조건의 개선률은 주장하지 않는다. 코드에서 제거된 중간 프로젝트 복제와 12맵 관측을 구분한다. 패치 준비의 정상 12ms 예산에서는 대부분 양보 없이 끝났으며, 별도 0ms 예산 계약에서 맵 내부 양보와 제출 중 다음 store 편집의 분리를 확인했다. custom serializer와 키 열거 자체는 동기 작업이다.

검증: Diff key order/omissions/nonfinite/exotic compatibility and sync/sliced wire parity; 10-step undo/redo preserves cells: before,1maps; 10-step undo/redo preserves cells: after,1maps; 10-step undo/redo preserves cells: before,12maps; 10-step undo/redo preserves cells: after,12maps; Wire preparation yields inside a map and preserves newer COW edit; Mixed project/map/tileset history restoration order; Vault repeated save and public clone isolation. Uncaught page error 0개. 반복 보관함 저장(10초안×1,000명령, 3회)은 structuredClone/JSON.stringify 추가 호출 0개이며 공개 사본 수정은 보관 값에 반영되지 않는다.

원시 수치와 수정 소스 SHA-256: [measurements.json](measurements.json). `performance.now` 함수 구간에는 양보 대기/GC가 포함될 수 있고 호스트 왕복은 포함되지 않는다.

재현: 워크트리 서버를 `npm run dev:worktree`로 켠 후 `BASE=http://127.0.0.1:9911 OUT=/tmp/ux2-storage node scripts/qa/editor-ux-storage-capture.mjs`. `CONTRACT_ONLY=1`은 성능 반복을 생략한다. 기준 모듈은 git에서 읽어 `.vite-cache/ux2-baseline/`에 준비한다.

회귀 계약 파일을 추가했지만 AGENTS 실행 제한에 따라 Vitest/gates/typecheck는 실행하지 않았다. 한 번의 재측정은 모듈을 수정한 dev 서버에서 history assertion에 실패했고 이어진 재시도는 부팅 timeout이었다. 서버를 재시작한 이 기록에서는 모든 계약을 통과했다. 최종 통합 후 동일 계약을 다시 확인한다.
