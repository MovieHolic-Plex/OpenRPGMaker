# 편집기 구독자·캔버스 성능 — 2026-09-28

작업 위치: `/home/main/z-project/rpg-zzu-e03b-perf-editor-subs`, 브랜치 `codex/perf-editor-subs`.
기준선 `f9bbb5067`. 이전 워크트리가 삭제된 뒤 코드를 다시 작성하고, 변경마다 커밋했다.
아래 수치는 **새 워크트리에서 다시 측정한 값**이다. 이전 실행의 수치를 복사하지 않았다.

## 변경과 범위

- 참조 검증: 에디터 표면끼리 Project 객체 + lineage/generation별 결과 공유. 순수 검증기는 변경하지 않았다.
- 패널: 작성 진행 기록은 통지마다 저장, 화면 갱신만 rAF로 병합. 혼합 범위·팔레트 요청·teardown을 처리하고 store 오류 로깅 정책을 보존한다.
- 연결: maps 구성·순서·id, events 배열, mapConnections, startMapId를 캐시 입력으로 사용한다. 이벤트 명령 순회도 배열별로 공유한다. 이름·현재 맵 선택은 별도로 확인하여 DOM 재사용 여부를 결정한다.
- 감사: 마지막 편집 뒤 250ms에 검사. 닫힌 패널·폐기된 패널·포인터 대기 중 예약의 수명을 처리한다.
- 캔버스: skip 계획은 깨우지 않고, 실제 변경은 한 프레임만 요청한다. 입력·카메라의 연속 렌더 정책은 유지한다.
- 직접 도구/도구 묶음: 한 맵의 타일만 바뀐 경우 기존 부분 갱신 경로에 renderCells를 전달한다. 네 층·그림자·스택과 오토타일 이웃을 처리한다.
- 감독자 소유의 changeset 커밋/직렬화, store.replace 내부, eventDraftVault, src/ai, aiChatPanel은 수정하지 않았다. applyChangesetToStore는 import 및 직접 도구/묶음의 replace 옵션만 수정했다.

## 실측

| 대상 | 입력·단위 | 이전 | 이후 |
|---|---|---:|---:|
| 참조 검증 공유 | 20맵·이벤트 2,000건, 동일 리비전 100회 평균 ms/호출(첫 계산 포함) | 5.338 | 0.196 |
| 패널 구독 | 이벤트 2,000건, project 통지 200회, 최종 갱신 포함 ms/통지 | 14.162 | 0.051 |
| 패널 DOM | 같은 200회 통지, 생성 노드 총수 | 4,400 | 22 |
| 연결 그래프 | 20맵·이벤트 2,000건, events 참조 유지한 타일 변경 200회 평균 ms/통지 | 0.889 | 0.021 |
| 연결 패널 Chromium | 같은 200회 통지, ms/통지 | 0.946 | 0.023 |
| 연결 패널 Chromium DOM | 생성 노드 총수 | 18,800 | 0 |
| 규칙 감사 | 200개 진단, 100ms 간격 20회 편집 + 250ms 대기, 검사 횟수 | 7 | 1 |
| 규칙 감사 DOM | 같은 입력, 생성 노드 총수 | 7,014 | 1,002 |
| 캔버스 무관한 변경 | 유휴 상태 DB 통지 뒤 16ms 간격 30프레임에서 실제 렌더 횟수 | 30 | 0 |
| 캔버스 단발 변경 | 유휴 상태 현재 맵 셀 통지, 같은 관측 창의 렌더 횟수 | 30 | 1 |
| 직접 도구 타일 갱신 | 100×100 맵 한 칸, 10회 평균 ms (이후는 diff 포함) | 25.341 | 13.286 |
| 직접 도구 타일 객체 | 같은 변경, 갱신 객체 수 | 10,000 | 9 |

공유 머신의 일회 측정이므로 절대 시간과 배율은 부하에 따라 달라진다. 노드·객체·프레임 수는 결정적 작업량이다.

- 패널 측정은 실제 renderEditor와 store 통지를 사용하고, 기존 rightDragPanelRebuilds 테스트의 Phaser/AI/팔레트 mock을 재사용했다. store 저장·commit 비용은 측정 범위에서 제외했다.
- 연결 브라우저 측정은 실제 leftLinksPane/mapLinkStats/DOM 헬퍼/CSS를 Chromium에 로드했다. store·선택 브리지만 fixture로 대체했다. 전후 HTML 동일, 이름 변경 반영, 맵 선택 aria-current 갱신, 타일 변경 후 동일 DOM 노드 보존을 검증했다. 전체 편집기 E2E 증거는 아니다.
- 규칙 감사는 검사 함수가 반환하는 200개 진단을 고정하여 호출 횟수와 실제 패널 DOM 생성량을 측정했다. 개별 규칙 알고리즘의 처리 시간은 측정하지 않았다.
- 렌더 게이트는 기준선/수정본의 실제 store 콜백과 redrawForStoreChange를 실행하고, 가짜 시계·텍스처 로더·그리기 대역을 사용했다.
- 타일 렌더는 기존 editSceneRender의 Phaser mock 하네스다. 도구 커밋의 기존 타일셋 구조 공유를 반영한 비교 입력을 사용했다. 실제 GPU FPS나 AI 전체 적용 지연을 뜻하지 않는다.

원자료: `subs-before.json`, `subs-after.json`, `panel-before.json`, `panel-after.json`, `browser.json`, `render.json`, `wake.json`.
화면: `links-before.png`, `links-after.png` (540×960, 실제 Chromium).
임시 측정 테스트 및 기준선 사본은 실행 뒤 삭제했으며 커밋하지 않았다.

## 테스트

전체 스위트와 gates는 실행하지 않았다. 관련 10파일 **66건 통과, 0건 실패**.

```bash
node scripts/run-vitest.mjs test/editSceneStoreRender.test.ts test/editRenderGate.test.ts --maxWorkers=1
```

2파일 11건 통과, exit 0. 이전 워크트리에서 실패했던 새 렌더 테스트 2건은 window.addEventListener/removeEventListener 대역을 보완하여 모두 통과했다.

```bash
node scripts/run-vitest.mjs test/mapLinkStats.test.ts test/editorProjectReferenceIssues.test.ts test/incrementalMapApply.test.ts test/ruleAuditPanel.test.ts test/editSceneRender.test.ts test/applyChangesetToStore.test.ts test/leftActivityBar.test.ts test/rightDragPanelRebuilds.test.ts --maxWorkers=2
```

8파일 55건 통과, exit 0. 기존 패널 테스트의 오래된 renderTilePalette mock을 현재 refreshTilePalette 계약으로 갱신했다.

측정 테스트 실행 명령(모두 종료 코드 0):

```bash
PERF_BASELINE=1 npx vitest run test/perfEditorSubs.measure.test.ts test/perfEditorPanel.measure.test.ts -t 'PERF_' --silent=false --maxWorkers=1
npx vitest run test/perfEditorSubs.measure.test.ts test/perfEditorPanel.measure.test.ts test/perfEditorBrowser.measure.test.ts test/perfEditorRender.measure.test.ts test/perfEditorWake.measure.test.ts -t 'PERF_' --silent=false --maxWorkers=1
```

각각 2건 통과/3건 의도적 제외, 5건 통과/25건 의도적 제외. 제외 건은 재사용한 기존 하네스의 비측정 테스트다.

타입 검사 명령:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.app.json
```

오류 0건, exit 0. 기본 힙 한도로 실패했던 이전 작업의 경험을 반영하여 처음부터 8GB 힙을 사용했다.

## 남은 제한

- 전역 count 규칙 및 좌표 없는 위반의 기존 보고 결과를 유지하기 위해 감사의 mapIds 제한/결과 부분 병합은 적용하지 않았다. 한 번의 전역 검사 비용은 남는다.
- replace는 단일 맵 renderCells만 받는다. 여러 맵·이벤트·메타데이터·맵 추가/삭제·2,048셀 초과는 기존 전체 통지를 유지한다.
- 그래프 캐시는 불변 events/mapConnections 참조에 의존한다. 내용이 같아도 배열을 깊이 복제하는 경로는 캐시가 무효화된다.
- 단일 도구의 부분 렌더 판정에도 구조 비교 비용이 남는다. 전체 커밋·직렬화·eventDraftVault 비용은 감독자 작업 범위다.

## 변경 파일

실행 코드 9개:

- `src/editor/projectReferenceIssues.ts`
- `src/editor/panels/editor.ts`
- `src/editor/panels/leftProgressPane.ts`
- `src/project/mapLinkStats.ts`
- `src/editor/panels/leftLinksPane.ts`
- `src/editor/panels/ruleAuditPanel.ts`
- `src/editor/EditScene.ts`
- `src/editor/incrementalMapApply.ts`
- `src/editor/tools/applyChangesetToStore.ts`

테스트 7개:

- `test/editorProjectReferenceIssues.test.ts`
- `test/mapLinkStats.test.ts`
- `test/ruleAuditPanel.test.ts`
- `test/editSceneStoreRender.test.ts`
- `test/incrementalMapApply.test.ts`
- `test/applyChangesetToStore.test.ts`
- `test/rightDragPanelRebuilds.test.ts`

문서·증거: `openwiki/editor-observability.md`, 이 SUMMARY 및 위 원자료 JSON 7개, PNG 2개.
