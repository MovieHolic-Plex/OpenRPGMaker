# 에디터 「공방」 — 하네스를 에디터 안에서 돌린다

- 들어오는 길: 왼쪽 활동 막대 렌치 「공방」(`src/editor/panels/leftWorkshopPane.ts`) → 큰 화면(`src/editor/workshop/workshopWorkspace.ts`, body 오버레이).
- 어떤 하네스가 보이나: `workshopHarnesses(genre)` — 매니페스트 `entrypoints.editorUi` 가 true 이고 `workshop` 로더가 있고 장르가 맞는 것. 에디터는 하네스 폴더를 직접 import 하지 않는다.
- 실행기: `src/harnesses/_core/workshop/engine.ts`. 한 장 = 그리기 → 깨지면 고치기 ≤2 → 자기 점검 1 → 독립 검수(vision) → `runner.gate` → 불통과면 다시(시도 ≤3). 3번 다 불통과여도 사람이 볼 수 있게 「검수 불통과」로 남긴다. 동시 기본 3(1~6, `oprn:workshop-concurrency`), 429 면 하나 줄이고 기다린다, 401·403 이면 멈추고 AI 설정으로 안내.
- 모델: 표면 `workshop-draw`(감독 티어, 16384 토큰) · `workshop-review`(vision 역할, 4096). `src/ai/assistantEndpoint.ts` 표 한 줄씩. 사용자 자기 계정·조수와 같은 엔드포인트.
- 답 형식: 팔레트 키 격자 JSON `{"legend":{"a":"wood:6"},"rows":[…],"note","topRows"}`(`grid.ts`). pxg 아님.
- 저장: 이 기기 IndexedDB `oprn-workshop`(`store.ts`), 범위 키 = `conversationScopeKey`. 그림은 저장하지 않고 격자만. 문서·내보내기와 무관. 칩셋에 굽기는 2단계.
- 새 하네스 입주: 하네스 폴더에 `editor/runner.ts`(`WorkshopRunner`) + 매니페스트에 `workshop: () => import("./editor/runner").then(…)` + `editorUi: true`. 공용 화면은 지금 실내 기물 문구가 들어 있다(제목·버리기 이유) — 둘째 하네스가 들어올 때 실행기 쪽으로 옮긴다.
- QA: `BASE=http://127.0.0.1:<포트> node scripts/qa/workshop-capture.mjs` — dev 빌드의 `window.__oprnWorkshopChat` 가짜 채팅으로 모델 없이 찍는다. 결과 `verify-shots/workshop/`. 이 기기에서는 크로미움이 `net::ERR_NETWORK_CHANGED` 로 백지가 될 수 있다 — dev 서버와 스크립트를 `unshare -rn` 안에서 `ip link set lo up` 한 뒤 함께 띄운다(콜드 부팅 60~70초).
- 설계·계획: `docs/superpowers/specs/2026-10-02-workshop-editor-design.md`, `docs/superpowers/plans/2026-10-02-workshop-editor.md`.
