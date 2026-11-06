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

### 데워 둔 호스트(여러 번 부를 때)

`oprn-agent-edit.mjs` 는 부를 때마다 헤드리스 번들을 새로 짓는다(도구 한 번 15~150 초). 에이전트가 도구를 수십 번 부르면
`scripts/oprn-agent-host.mjs serve` 를 한 번 띄워 두고 짧은 동사로 부른다 — 번들·문서를 데워 두어 도구 한 번이 2~5 초다
(2026-11-06 agent-direct-edit Phase 2 실측, 데우기 22~35 초 한 번). 쓰기 경로는 위와 같다(브리지 `project.save` + 기준 sha, 충돌이면 다시 받아 3번).

```bash
node scripts/oprn-agent-host.mjs serve --host http://127.0.0.1:9840/ --port 9850 &   # 127.0.0.1 만 듣는다
node scripts/oprn-agent-host.mjs tools 마을               # 낱말로 도구 찾기
node scripts/oprn-agent-host.mjs schema place_npc
node scripts/oprn-agent-host.mjs tool paint_tiles @args.json --map map_town
node scripts/oprn-agent-host.mjs get /tmp/p.json && node scripts/oprn-agent-host.mjs put /tmp/p.json
```

### MCP 로 줄 때 — 도구 목록을 통째로 주지 않는다

편집기 도구는 526개, 스키마가 1.24M 자(약 41만 토큰)다. 통째로 MCP `tools/list` 에 실으면 Claude Code 가 첫 차례에
「Autocompact is thrashing」으로 죽는다(실측: 도구 3번 부르고 끝, 지은 것 없음). 한 줄 설명 + 위 단계 스키마로 줄여도 약 9만 토큰이다.
`scripts/oprn-agent-mcp.mjs` 는 데워 둔 호스트에 붙어 스키마가 작은 자주 쓰는 도구 25개만 MCP 도구로 바로 주고(약 1.2만 토큰),
나머지는 `oprn_tools`(찾기) · `oprn_schema`(전체 스키마) · `oprn_call`(이름으로 부르기)로 닿는다. 결과는 3만 자에서 자른다.

```bash
claude --mcp-config '{"mcpServers":{"oprn":{"command":"node","args":["scripts/oprn-agent-mcp.mjs","--port","9850"]}}}'
```

실측(Opus 5.5, 같은 과제): MCP 도구를 줘도 에이전트는 쓰기 대부분을 셸 동사로 했다(MCP 11번 대 Bash 49번 — 확인·검사 도구만 MCP 로).
`scripts/oprn-mcp-server.mjs` 는 파일 하나를 여는 다른 MCP 다(열린 편집기와 함께 쓰지 않는다).

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
