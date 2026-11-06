# 코딩 에이전트의 열린 프로젝트 직접 편집 · 라이브 반영 (2026-11-06)

코딩 에이전트(Claude Code·omp·Codex 등)가 **사람이 편집기로 열어 둔 프로젝트**를 바깥에서 고치면, 편집기가 새로고침 없이
1초 안팎에 그 변경을 다시 그린다. 사람의 실행 취소 기록과 저장 안 된 편집은 버리지 않는다.

## 쓰기 경로 (하나뿐)

에이전트는 `project.sqlite` 를 직접 열지 않는다. 편집기와 같은 호스트 디스패처(`/__oprn/bridge`)로 저장한다 —
검증·기준 sha 비교·미디어 분리가 편집기 저장과 같다(`electron/main/dispatch.ts` `createStoreHandlers`).

```bash
# 편집기를 연 호스트 주소(oprn-serve·npm start·데스크톱 팀 호스트)
node scripts/oprn-agent-edit.mjs --host http://127.0.0.1:9840/ status
node scripts/oprn-agent-edit.mjs --host http://127.0.0.1:9840/ get --out /tmp/p.json
node scripts/oprn-agent-edit.mjs --host http://127.0.0.1:9840/ tool paint_tiles '{"mapId":"…", …}'
node scripts/oprn-agent-edit.mjs --host http://127.0.0.1:9840/ put /tmp/p.json
node scripts/oprn-agent-edit.mjs --list-tools
```

- `tool` 은 편집기 조수와 같은 실행기(`runToolDefinition`)로 도구를 돌리고, 성공한 쓰기만 `oprn:project.save`(기준 sha)로 저장한다.
  그 사이 누가 저장했으면 충돌로 거절되고 다시 받아 최대 3번 재시도한다.
- `put` 은 `get` 으로 받은 문서를 고쳐 통째로 저장한다. 받은 뒤 누가 저장했으면 `conflict` 로 거절된다(exit 2).
- 접속 코드를 켠 공유 호스트는 아직 지원하지 않는다(핸드셰이크가 401).

## 반영 경로

1. 호스트 `GET /__oprn/events?token=<브리지 토큰>[&hostProject=<id>]` (SSE, `electron/serve/projectEvents.ts`). 구독자가 있는
   프로젝트 폴더만 250ms 마다 저장 행 메타(리비전)를 읽고, 바뀌면 `event: revision` 을 민다. 누가 썼는지는 묻지 않는다.
2. 브라우저 브리지 `window.oprn.project.onChanged` (`electron/browser/bridge.ts`) 가 구독하고, 연결이 닫히면 토큰을 새로 받아 다시 연다.
3. `src/editor/teamSession.ts` 가 알림을 받으면 3초 폴링을 기다리지 않고 바로 `team.status` → `store.refreshFromHost()`.
   자기 저장이 만든 리비전(`isOwnSavedHostRevision`)은 건너뛴다. 3초 폴링은 그대로 남아 SSE 가 끊겨도 늦게라도 반영된다.

## 충돌 규칙

`store.refreshFromHost()` (`src/project/store.ts`):

| 편집기 상태 | 결과 |
|---|---|
| 저장 안 된 편집 없음 | 받은 저장본을 그대로 쓴다 |
| 저장 안 된 편집이 **다른** 맵·DB 레코드에 있음 | 3자 병합(기준본·지금 문서·받은 저장본, `teamMerge.ts`)으로 둘 다 남는다. 사람 편집은 dirty 로 남아 다음 자동저장이 새 기준 위에 보낸다 |
| **같은** 맵(또는 DB 레코드)을 둘 다 고침 | 그 항목만 사람의 저장 안 된 편집이 이긴다. 나머지 바깥 변경은 들어온다. 덮인 항목 이름을 알림(「같은 곳(…)은 저장 안 된 내 편집을 남겼습니다」)으로 보이고, 다음 자동저장이 호스트의 그 항목을 사람 판으로 덮는다 |
| 저장이 날아가는 중 | 반영을 미루고 저장이 끝나면 다시 본다 |

어느 경우에도 사람의 저장 안 된 편집을 조용히 버리지 않는다. 에이전트 쪽 손실은 같은 항목 충돌에서만 생기고 알림으로 드러난다.
에이전트가 같은 맵을 계속 고쳐야 하면 사람이 그 맵에서 손을 뗀(저장된) 뒤 고치게 한다.

## 실행 취소

예전에는 바깥 변경을 받으면 `projectSwitch` 로 실행 취소 기록을 통째로 버렸다. 이제 `change.external.patch`(받기 전 기준본 → 받은
저장본의 차이)를 실어 보내고, `src/editor/mapEditHistory.ts` `rebaseHistoryOntoExternalChange` 가 각 스냅숏에 그 차이를 얹는다.

- 프로젝트 스냅숏: 차이를 그대로 얹는다 → Ctrl+Z 는 사람 편집만 되돌리고 바깥 작업은 남는다.
- 맵 스냅숏: 바깥이 그 맵을 바꿨으면 스냅숏을 바깥 판으로 둔다(그 맵의 이전 사람 편집은 바깥 판이 덮었다). 바깥이 지운 맵의 기록은 버린다.
- 같은 항목 충돌로 사람 판이 이긴 맵은 차이에서 뺀다.

시험: `test/storeExternalChange.test.ts`.
