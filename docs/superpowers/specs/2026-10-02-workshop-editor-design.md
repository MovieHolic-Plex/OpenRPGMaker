# 에디터 「공방」 — 하네스를 에디터 안에서 돌린다 (1단계 설계)

2026-10-02. 사용자 결정: 모든 하네스 공용 화면, 사용자 자기 AI 계정으로 에디터에서 실행, 결과는 그 프로젝트에만,
들어오는 길은 왼쪽 활동 막대 「공방」, 첫 입주 하네스는 손 도트 실내 기물(interior-props).
칩셋 번호는 「열 때 자동으로 밀어 맞춤」(2단계).

## 단계

| 단계 | 내용 | 이 문서 |
|---|---|---|
| 1 | 「공방」 화면 + 에디터 안 작업 실행기(그리기 → 검사 → 자기 점검 → 검수 → 다시 그리기) + 실내 기물 실행기 + 후보·고른 것 저장 | **여기** |
| 2 | 고른 기물을 프로젝트 실내 칩셋에 굽기(번호 자동 이주) + 조수 기물 사전(`hand_interior_parts`)에 합치기 + 방 안 미리보기 | 다음 문서 |
| 3 | modern3·월드맵 아이콘·조선·캐릭터 칩·몬스터를 같은 화면에 하나씩 | 하네스마다 |

1단계가 끝나면 사용자는 에디터에서 기물을 고르거나 새로 정의하고, 후보 5장을 받아 고를 수 있다. 맵에 쓰는 것은 2단계부터.

## 지금 있는 것 (2026-10-02 origin/main 실측)

- 왼쪽 활동 막대: `src/editor/panels/aiSidebarWorkspace.ts` 의 `PANES` 배열에 하드코딩. 판은 좁은 왼쪽 칸뿐이고,
  큰 화면은 `tilesetAiWorkspaceModal.ts` 처럼 `document.body` 위에 덮는 오버레이로 띄운다.
- 모델 호출: `src/ai/llmClient.ts` `chatCompletion(config, req)` — `image_url` 부품과 `response_format: json_object` 를 받는다.
  표면별 모델은 `src/ai/assistantEndpoint.ts` `resolveSurfaceAiConfig(surface)`, 역할(vision·deep·ultrabrain)은 `src/ai/modelRoles.ts`.
  그림 + JSON 답의 선례: `src/editor/panels/tilesetAiClient.ts` `requestTilesetMapping`.
- 동시 실행 상한: 채팅에는 없다. `src/ai/imageGenerationQueue.ts` 가 FIFO·동시 1~4 큐 골격.
- 파일 저장: `projectRepository().assets.put(bytes, {mime, extension, kind})` → sha 참조(Electron·호스트만, 메모리 저장소는 안 됨).
  `pruneUnused(referenced)` 는 목록에 없는 자산을 지우므로 후보 sha 를 참조 목록에 넣어야 한다. 내보내기 제외 표시는 없다.
- 하네스 레지스트리: `src/harnesses/_core/{manifest,registry}.ts`. 에디터에서 읽는 코드는 아직 없다. 규칙: 에디터 코어는 레지스트리로만 찾는다,
  `node/` 밖 코드만 브라우저가 쓴다, `entrypoints` 는 정직하게.
- 실내 기물 하네스는 지금 파이썬(PR #1828, 미머지). 작업자는 Codex CLI 가 파일을 고치고 스크립트를 돌린다.

## 구성

```
[왼쪽 막대 「공방」 판] ──열기──▶ [공방 화면(오버레이)]
   하네스 목록(레지스트리,                ├ 기물 목록 · 새 기물 정의
   editorUi=true · 장르 맞음)             ├ 판(후보 N장) 카드 · 고르기/버리기/다시 뽑기
                                          └ 진행 줄(남은 장 · 예상 시간)
                 │
                 ▼
[작업 실행기 _core/workshop]  ── 하네스가 주는 「실행기」(브리프·답 해석·렌더·검사·검수 기준)
   큐(동시 N) · 시도 3번 · 취소 · 재개           └ interior-props/editor/ (1단계 유일 입주)
                 │
                 ▼
[저장] project.workshop(메타, 내보내기 제외) + 후보 PNG = assets.put sha (메모리 저장소면 dataURL)
```

### 1. 공방 판과 화면 (`src/editor/panels/leftWorkshopPane.ts`, `src/editor/workshop/`)
- `aiSidebarWorkspace.ts` `PANES` 에 `workshop` 한 줄, 아이콘 `wrench`, 라벨 「공방」.
- 판: 이 프로젝트 장르에 맞고 `entrypoints.editorUi` 가 true 인 하네스 목록 + 진행 중 판 수. 누르면 오버레이.
  모델 연결이 안 됐으면 「AI 설정에서 연결」 버튼만 보인다(`isAssistantEndpointReady`).
- 화면: 지금 `/harness`(web/index.html)의 고르기 화면을 옮긴다 — 왼쪽 기물 목록(고를 차례·그리는 중·끝남),
  카드(단품 맞춤 확대 · 꼭대기 N행 · 검수 · 다시 그린 횟수), 키보드(1~5·0·Enter·X·R·V·F·↑↓), 나란히 보기,
  고를 차례가 끝나면 다음 것이 되면 자동으로 여는 기다림 화면. 「방 안」 보기는 2단계.
- 새 기물 정의 폼: 이름 · 설명(그림 명세) · 칸 수(w×h) · 솟음(px) · 종류(바닥 기물·벽 앞·걸이·바닥 무늬) · 쓰임.
  닮은 기존 기물(refs)은 목록에서 고른다.

### 2. 작업 실행기 (`src/harnesses/_core/workshop/`)
하네스 하나가 주는 계약:
```ts
interface WorkshopRunner {
  items(ctx): WorkshopItem[];                       // 고를 수 있는 기물(기존 + 새 정의)
  directions(item): {letter, text}[];               // 후보 N장의 방향
  drawRequest(item, run, history): ChatRequest;     // 브리프 글 + 그림(기준·예시·지금 그림 8배)
  parseDraw(text): Grid | ParseError;               // 답 → 격자
  render(grid): PNG;                                // 격자 → 그림(1배·8배)
  hardCheck(item, grid): string[];                  // 깨짐(크기·팔레트·접지선…)
  reviewRequest(item, candPng, refs): ChatRequest;  // 검수자 글 + 그림
  parseVerdict(text): Verdict;                      // PASS/FAIL·codes·top_rows·reasons·fix
  gate(item, verdict): Verdict;                     // 하네스 규칙(꼭대기 ≥3행이면 통과 유지 등)
}
```
한 장의 흐름(지금 파이썬 하네스와 같다):
1. 그리기 호출 → 격자 해석. 해석 실패·깨짐이면 오류를 붙여 같은 대화로 최대 2번 고치게 한다.
2. 자기 점검 1번: 렌더한 8배 그림을 다시 보여 주고 「고칠 것이 있으면 고친 격자, 없으면 그대로」.
3. 검수 호출(다른 대화, vision 역할) → `gate` → FAIL 이면 이유·고칠 것을 들고 1로(시도 최대 3).
4. 끝. 사람만 고른다 — 실행기는 고르지 않는다.

- 모델: 그리기 = 새 표면 `workshop-draw`(Ultrabrain), 검수 = `workshop-review`(Vision 역할). AI 설정 한곳에서 바꾼다.
- 큐: `imageGenerationQueue` 골격을 채팅용으로 일반화해 동시 기본 3(설정 1~6). 취소·재시도.
  탭을 닫으면 돌던 장은 「대기」로 되돌아가 다음에 이어 간다.
- 답 형식: 모델에게 pxg 를 쓰게 하지 않는다. `{"legend": {"a": "wood:6", …}, "rows": ["..aab..", …], "note", "topRows"}`.
  색은 하네스 팔레트 램프 키만 쓴다. 지금 그림·기준 그림은 PNG 색을 팔레트 키로 되돌려 같은 형식으로 준다.

### 3. 실내 기물 실행기 (`src/harnesses/interior-props/`)
- `harness.ts`: 매니페스트 등록(`entrypoints.editorUi: true`, `cli: false` — 파이썬 `harness.py` 는 `npm run harness` 경로가 아니다, 조수 도구 false) + INDEX 재생성.
- `editor/`(브라우저 공용, `node/` 밖): 브리프 문장(지금 `brief.py`·`prompt.md`·`review.md` 의 시점 절·꼭대기 면 규칙·방향 5개),
  팔레트(v5 램프), 격자 렌더, 깨짐 검사(크기·팔레트 밖 색·접지선·실루엣 표시색), `gate`(바닥·벽 앞 가구 top_rows<3 → FRONT).
- 기물 사전: 기존 기물은 번들 `handInteriorSpec.json` + 시트(`interior-chipset.png`)에서 칸을 잘라 「지금 그림」으로 쓴다.
  새 기물은 사용자가 정의한다. 기준 그림(anchors) 고르기 = `brief.anchors` 규칙(걸이·바닥 무늬 제외, 위반 원본 제외).
- 예시 그림 9장(`examples/`)은 `public/assets/harnesses/interior-props/examples/` 로 옮겨 번들한다.

### 4. 저장 (`project.workshop`)
```ts
project.workshop = { version: 1, rounds: [{ id, harnessId, itemKey, itemDef?, created, note, base?,
  runs: [{ letter, direction, status, attempt, history, review, grid, png: AssetRef | dataUrl }] }],
  picks: { [itemKey]: { round, cand, at } }, feedback: [...] }
```
- 메타는 문서 안(작다), 후보 그림은 `assets.put`(16~48px PNG 라 한 장 1KB 안팎). 메모리 저장소면 dataURL.
- 웹·단독 내보내기에서 `workshop` 을 뺀다(`webExport.ts` 가 참고문서를 빼는 자리). 자산 정리 참조 목록에 후보 sha 를 넣는다.
- 정본 저장 규칙: 고른 것은 저장 후 다시 불러 확인한다(AGENTS 「프로젝트 정본 저장」).

## 오류·한계
- 연결 안 됨 / 401 → 판을 시작하지 않고 AI 설정으로 안내. 429 → 큐가 동시 수를 하나 줄이고 기다렸다 다시.
- 모델이 격자를 계속 못 내면 그 장은 「못 그림」(이유 표시), 다른 장은 계속.
- 품질: 에디터 사용자 모델(Gemini flash 등)은 이 서버의 gpt-6.1-sol 보다 약할 수 있다. 첫 시험에서 같은 기물 몇 개를
  두 경로로 뽑아 비교해 보고한다. 검수 통과는 보증이 아니다 — 화면에 그렇게 쓴다.
- 비용: 한 장에 호출 3~6번(그림 포함). 판을 열 때 「후보 5장 · 호출 약 20번」을 미리 보여 준다.

## 시험
- 단위: 격자 렌더·깨짐 검사, 답 해석(코드 펜스·여분 글), `gate`, 실행기 상태 기계(가짜 chatCompletion 으로 FAIL→다시 그리기→PASS, 취소, 재개),
  `project.workshop` 저장·불러오기·내보내기 제외.
- 화면: 모델 없이 로컬 응답(동반 서비스 모의, 메모리 「모델 없이 레인 실화면」 방식)으로 판·카드·고르기를 찍어 `verify-shots/workshop/` 에.
- 실측: 실제 계정으로 실내 기물 3개 × 5장을 뽑아 시간·호출 수·검수 결과와 화면을 보고한다.
- AGENTS 규칙대로 테스트·게이트 실행은 사용자가 시킬 때만.

## 순서·의존
- PR #1828(파이썬 실내 하네스·예시 그림)을 먼저 머지하거나, 이 브랜치가 그 위에서 시작한다.
- `src/harnesses/_core` 는 다른 스레드(몬스터·modern3·월드맵 아이콘)도 쓴다 — 매니페스트 형식은 덧붙이기만 한다.
