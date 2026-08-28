# 데이터베이스 '구조물' 편집기 · export/import 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데이터베이스 '구조물' 탭을 읽기 전용 진열대에서, 사람이 래스터·부위·AI 메타를 직접 편집하고 파일로 주고받을 수 있는 어휘집으로 바꾼다.

**Architecture:** 865줄 단일 파일 `structureKitDbTab.ts` 를 조립기로 축소하고, 로직을 DOM 없는 순수 모듈 두 개(`structureKitRasterModel.ts`, `structureKitFile.ts`)로 뽑는다. 편집은 DB 모달 위에 뜨는 전용 다이얼로그가 담당하며(인스펙터 열이 352px 고정이라 9×8 킷이 들어가지 않음), 저장은 이 모달의 기존 규약대로 `store.update()` 즉시 반영 + 모달 취소 시 세션 롤백이다.

**Tech Stack:** TypeScript · Vite · vitest(environment: node + 손수 만든 `FakeElement`) · Playwright(e2e) · 2D Canvas(`kitRender.ts`)

**Spec:** `docs/superpowers/specs/2026-08-28-db-structures-editor-design.md`

## Global Constraints

- **테스트 실행:** `node scripts/run-vitest.mjs run --configLoader bundle test/<파일>.test.ts`
- **타입 검사:** `npx tsc --noEmit -p tsconfig.app.json`
- **e2e:** `npx playwright test test/e2e/<파일>.spec.ts`
- **유닛 테스트 환경은 `environment: "node"`** — `test/fakeDom.ts` 의 `FakeElement` 를 쓴다. 그 안에서 `getContext()` 는 `null`, `getBoundingClientRect()` 는 **전부 0** 을 반환한다. 캔버스에 그려진 것은 유닛 테스트로 검증할 수 없다.
- **칸 계산 함수는 `rect`·`scale` 을 인자로 받아야 한다.** 내부에서 `event.clientX - rect.left` 를 읽으면 fakeDom 에서 항상 (0,0) 이 나와 테스트가 무의미해진다.
- **DOM 생성은 `el()` 헬퍼**(`@/util/dom`)를 쓴다. props: `class` · `text` · `html` · `value` · `attrs` · `dataset` · `on` · `children`.
- **다이얼로그 셸은 `openDialog(testid, title, content, actions)`**(`@/editor/panels/databaseEnemyRecordSupport:63`). 내부에서 `registerModal`/`unregisterModal` 을 부르고, 액션 버튼을 누르면 **무조건 닫힌다**.
- **토스트는 `toast(message, kind)`**(`@/util/toast`), `kind` 는 `"ok" | "info" | "error"`.
- **id 발급은 `randomUuid()`**(`@/util/id`). 킷 id 형식은 `kit_${randomUuid()}`.
- **`TILE.EMPTY === -1`**, `TILE.GRASS === 240` (`@/project/defaults/constants`). `TILE_SIZE === 16` (`@/assets/bundled` → `resourceSlicing.ts:33`).
- **저장은 `store.update((project) => { ... })`** 로 드래프트를 직접 변형한다. 별도 커밋/저장 버튼을 만들지 않는다 — DB 모달이 `createDatabaseModalDirtySession` 으로 세션 롤백을 이미 담당한다.
- **`origin` 은 어떤 자동 경로도 `"user"` 로 만들지 않는다** (제로 부트스트랩, `types/base.ts:126`). 사람이 명시 수락할 때만 `"user"`.
- **커밋 메시지는 한국어 현재형 서술**, 마지막 줄에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `src/project/types/base.ts` | 수정 | `StructureKitAiMeta` 타입, `learnedFrom` 에 `"db-authored"` 추가 |
| `src/editor/panels/structureKitDbTab.ts` | 축소 | 조립만 — 레일·표·인스펙터 배치. 865줄 → 목표 400줄 이하 |
| `src/editor/panels/structureKitInspector.ts` | 신규 | 읽기 인스펙터 + 액션 버튼 |
| `src/editor/panels/structureKitEditorDialog.ts` | 신규 | 편집기 다이얼로그 셸 (모양 탭 / AI 메타 탭) |
| `src/editor/panels/structureKitImportDialog.ts` | 신규 | 가져오기 확인창 |
| `src/editor/harnessSuggestion/structureKitRasterModel.ts` | 신규 | **DOM 없음** — 칸 계산·페인트·크기조절·부위 CRUD·굽기·복제 |
| `src/editor/harnessSuggestion/structureKitFile.ts` | 신규 | **DOM 없음** — 파일 포맷·직렬화·검증·가져오기 계획 |
| `src/editor/harnessSuggestion/structureKitActions.ts` | 확장 | store 접점 — 신규·복제·래스터 저장·부위 저장·AI 메타 저장 |
| `src/editor/tools/structureKitTools.ts` | 수정 | `repeatability` 반영, 응답에 `ai` 포함 |
| `src/ai/contextBuilder.ts` | 수정 | 설명·배치규칙·반복 여부 출력 |
| `src/util/downloadBlob.ts` | 신규 | `menu.ts` 의 다운로드 3-버그 회피 패턴 공용화 |
| `src/styles/editor/harness-suggestion.css` | 수정 | 편집기 다이얼로그·체크박스 열 스타일 |

**테스트 파일**

| 파일 | 상태 |
|---|---|
| `test/structureKitDbTab.test.ts` | 수정 (기존 426줄) |
| `test/structureKitRasterModel.test.ts` | 신규 |
| `test/structureKitFile.test.ts` | 신규 |
| `test/structureKitEditorDialog.test.ts` | 신규 |
| `test/structureKitTools.test.ts` | 수정 (기존 191줄) |
| `test/e2e/db-structure-editor.spec.ts` | 신규 |

---

# 1단계 — 진실 회복

다른 단계에 의존하지 않는다. 이 단계만으로 출하 가치가 있다.

## Task 1: 편집 잠금 축 교체 + 거짓 UI 제거

지금 인스펙터는 `learnedFrom === "builtin-parametric"` 으로 편집을 잠근다. 잠금의 진짜 이유는 "어떻게 만들어졌나" 가 아니라 **"프로젝트 데이터에 있나"** 다. 이대로 두면 5단계에서 내장 집을 내보낸 파일을 가져왔을 때, 프로젝트 데이터인데 이름 변경도 삭제도 안 되는 유령 킷이 생긴다.

함께, 사실이 아닌 UI 두 개를 없앤다.

**Files:**
- Modify: `src/editor/panels/structureKitDbTab.ts:326-333` (호출부), `:581-588` (시그니처), `:748-808` (안내문·액션 줄)
- Test: `test/structureKitDbTab.test.ts:96-141`, `:212-233`

**Interfaces:**
- Consumes: `albumEntries()` 가 각 행에 붙여주는 `entry.source: "builtin" | "interior" | "user"` (`structureKitDbSources.ts:46`)
- Produces: `renderInspector(tileset, kit, editable: boolean, host, rerender)` — Task 8 이 이 시그니처 그대로 `structureKitInspector.ts` 로 옮긴다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitDbTab.test.ts` 의 기존 테스트 두 개를 고치고 새 테스트 하나를 더한다.

먼저 96행 테스트의 이름과 `지금 저장` 단언을 뒤집는다:

```ts
  it("renders inspector with name, parts list with instance numbers, 문에서 입구 추정, 팔레트에서 쓰기, 삭제", () => {
```

그리고 같은 테스트 안의 이 세 줄을

```ts
    const saveNowBtn = host.querySelector("[data-testid='structure-kit-save-now']");
    expect(saveNowBtn).not.toBeNull();
    expect(saveNowBtn?.textContent).toContain("지금 저장");
```

이렇게 바꾼다:

```ts
    // 아무것도 저장하지 않던 가짜 버튼 — 제거됐는지 못을 박는다.
    expect(host.querySelector("[data-testid='structure-kit-save-now']")).toBeNull();
    expect(inspector?.textContent).not.toContain("지금 저장");

    // 이 파일에는 pointer 핸들러가 없다 — 드래그를 약속하지 않는다.
    expect(inspector?.textContent).not.toContain("드래그하면");
    // 워프 칸 안내는 사실이므로 남는다.
    expect(inspector?.textContent).toContain("워프 칸");
```

다음으로 `describe("structureKitDbTab 내장 파라메트릭 킷 노출")` 블록 끝(233행 `});` 직전)에 새 테스트를 추가한다:

```ts
  it("가져온 builtin-parametric 킷도 프로젝트 데이터면 편집 가능하다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    // 내장 집을 내보낸 파일을 가져온 상황 — learnedFrom 은 남아 있지만 프로젝트 데이터다.
    registerStructureKit(DEFAULT_TILESET_ID, {
      ...createTestSectionKit("kit_imported", "가져온 통나무집"),
      learnedFrom: "builtin-parametric",
    });

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    const row = host.querySelector("[data-testid='structure-kit-db-kit_imported']");
    expect(row).not.toBeNull();
    row!.click();

    expect(host.querySelector("[data-testid='structure-kit-db-delete-kit_imported']")).not.toBeNull();
    const nameInput = host.querySelector("[data-testid='structure-kit-db-name-kit_imported']");
    expect(nameInput).not.toBeNull();
    expect(nameInput!.getAttribute("disabled")).toBeNull();
    expect(host.querySelector("[data-testid='structure-kit-builtin-hint']")).toBeNull();
  });
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: FAIL — `structure-kit-save-now` 가 아직 존재하고, `kit_imported` 의 삭제 버튼이 `null` 이며, `structure-kit-builtin-hint` 가 남아 있다.

- [ ] **Step 3: 호출부에서 편집 가능 여부를 계산해 넘긴다**

`src/editor/panels/structureKitDbTab.ts:326-333` 을 이렇게 바꾼다:

```ts
  // 3. 인스펙터 (오른쪽 열)
  if (selectedObject && activeTileset) {
    workspace.append(renderObjectInspector(activeTileset, selectedObject));
  } else if (selectedKit && activeTileset) {
    // 편집 잠금의 축은 "어떻게 만들어졌나"(learnedFrom)가 아니라 "프로젝트 데이터에 있나"(source)다.
    // learnedFrom 으로 판정하면 내장 킷을 내보낸 파일을 가져왔을 때 영구히 잠긴 유령 킷이 생긴다.
    const editable = selectedEntry?.source === "user";
    workspace.append(renderInspector(activeTileset, selectedKit, editable, host, rerender));
  }
```

- [ ] **Step 4: 인스펙터 시그니처를 바꾸고 `isBuiltin` 을 걷어낸다**

`:581-588` 을 이렇게 바꾼다:

```ts
function renderInspector(
  tileset: TilesetDef,
  kit: StructureKitDef,
  editable: boolean,
  host: HTMLElement,
  rerender: () => void
): HTMLElement {
  const size = structureKitSize(kit);
```

그리고 이 파일 안의 `isBuiltin` 참조 3곳을 `!editable` 로 바꾼다:

- `:606` `attrs: isBuiltin ? { type: "text", disabled: "" } : { type: "text" },` → `attrs: editable ? { type: "text" } : { type: "text", disabled: "" },`
- `:608` `on: isBuiltin ? undefined : { ... }` → `on: editable ? { ... } : undefined`
- `:759` `...(isBuiltin ? [] : [ /* 삭제 버튼 */ ])` → `...(editable ? [ /* 삭제 버튼 */ ] : [])`
- `:810-818` 의 `if (isBuiltin) { inspector.append(el("p", { ... testid: "structure-kit-builtin-hint" ... })) }` → `if (!editable) { ... }` 로 바꾸되, 문구를 사실에 맞게 고친다:

```ts
  if (!editable) {
    inspector.append(
      el("p", {
        class: "structure-kit-quiet",
        dataset: { testid: "structure-kit-builtin-hint" },
        text: "이 목록은 코드로 관리됩니다 — 편집하려면 [내 구조물로 복제]를 쓰세요.",
      })
    );
  }
```

- [ ] **Step 5: 거짓 안내문에서 거짓만 걷어낸다**

`:748-753` 의 안내문에서 드래그 약속만 지운다. 워프 칸 설명은 사실이므로 남긴다:

```ts
  inspector.append(
    el("p", {
      class: "structure-kit-quiet",
      text: "흰 점이 워프 칸입니다.",
    })
  );
```

- [ ] **Step 6: 가짜 [지금 저장] 버튼을 지운다**

`:779-790` 의 이 블록을 통째로 삭제한다:

```ts
      el("button", {
        class: "btn primary",
        attrs: { type: "button" },
        text: "지금 저장",
        dataset: { testid: "structure-kit-save-now" },
        on: {
          click: () => {
            toast("구조물이 저장되었습니다.", "ok");
            rerender();
          },
        },
      }),
```

이 버튼은 `toast()` 만 부르고 아무것도 저장하지 않았다. DB 모달은 이미 모든 편집을 `store.update()` 로 즉시 반영하므로, 이 버튼은 *"안 누르면 안 저장되나?"* 하는 없는 불안만 만들었다.

- [ ] **Step 7: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: PASS (16 tests)

- [ ] **Step 8: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 이 파일 관련 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add src/editor/panels/structureKitDbTab.ts test/structureKitDbTab.test.ts
git commit -m "$(cat <<'EOF'
fix(database): 구조물 편집 잠금을 계보가 아니라 소유로 판정한다

learnedFrom === "builtin-parametric" 으로 잠그면, 내장 집을 내보낸 파일을
가져왔을 때 프로젝트 데이터인데도 이름 변경·삭제가 영구히 막힌 킷이 생긴다.
잠금의 진짜 축은 앨범 엔트리의 source === "user" 다.

함께 사실이 아닌 UI 두 개를 없앤다.
- "이 래스터를 드래그하면 부위가 붙습니다" — 이 파일에 pointer 핸들러가 0개다.
- [지금 저장] — toast만 부르고 아무것도 저장하지 않았다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 실내 오브젝트에 [팔레트에서 쓰기] 부여

실내 오브젝트 인스펙터에는 지금 액션이 **하나도 없다**. 우회 경로조차 없어 사용자가 그 모양을 맵에 놓을 방법이 없다. `object.cells` 는 이미 `PaletteStampCell` 과 같은 모양(`{dx, dy, layer, tile}`)이라 변환이 거의 공짜다.

**Files:**
- Modify: `src/editor/panels/structureKitDbTab.ts:494-531` (`renderObjectInspector`)
- Test: `test/structureKitDbTab.test.ts`

**Interfaces:**
- Consumes: `InteriorObjectDef.cells: readonly {dx, dy, layer, tile}[]`, `editorState.set({ activePaletteStamp, tool })`
- Produces: `paletteStampFromInteriorObject(object): PaletteStamp` — Task 7 의 `bakeToSection` 이 같은 `cells` 를 읽는다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitDbTab.test.ts` 의 실내 오브젝트 describe 블록에 추가한다. 파일 상단 import 에 `INTERIOR_ROOM_TILESET_ID` 가 이미 있다.

```ts
  it("실내 오브젝트 인스펙터에 [팔레트에서 쓰기]가 있다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    // 실내 칩셋 앨범으로 이동
    host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`)!.click();

    const first = INTERIOR_OBJECT_CATALOG[0]!;
    const row = host.querySelector(`[data-testid='structure-kit-object-${first.id}']`);
    expect(row).not.toBeNull();
    row!.click();

    const useBtn = host.querySelector(`[data-testid='structure-kit-object-use-${first.id}']`);
    expect(useBtn).not.toBeNull();
    expect(useBtn!.textContent).toContain("팔레트에서 쓰기");
  });
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: FAIL — `structure-kit-object-use-*` 가 `null`

- [ ] **Step 3: 셀 → 스탬프 변환을 더한다**

`src/editor/harnessSuggestion/structureKitModel.ts` 끝에 추가한다:

```ts
/** 실내 오브젝트 셀 목록 → 팔레트 스탬프. 킷과 달리 오브젝트는 rows 가 없고 cells 가 정본이다. */
export function paletteStampFromCells(input: {
  readonly cells: readonly PaletteStampCell[];
  readonly width: number;
  readonly height: number;
  readonly kitId: string;
}): PaletteStamp {
  const firstTile = input.cells[0]?.tile ?? 0;
  return {
    cells: input.cells.map((cell) => ({ ...cell })),
    height: Math.max(1, input.height),
    width: Math.max(1, input.width),
    kitId: input.kitId,
    source: { endTile: firstTile, startTile: firstTile },
  };
}
```

- [ ] **Step 4: 인스펙터에 버튼을 붙인다**

`structureKitDbTab.ts` 의 `renderObjectInspector` 에서, 마지막 안내문 `el("p", { ... structure-kit-object-hint ... })` **앞에** 액션 줄을 끼운다:

```ts
      el("div", {
        class: "structure-kit-actions",
        children: [
          el("button", {
            class: "btn",
            attrs: { type: "button" },
            text: "팔레트에서 쓰기",
            dataset: { testid: `structure-kit-object-use-${object.id}` },
            on: {
              click: () => {
                editorState.set({
                  activePaletteStamp: paletteStampFromCells({
                    cells: object.cells.map((cell) => ({ ...cell })),
                    width: object.width,
                    height: object.height,
                    kitId: object.id,
                  }),
                  tool: "paint",
                });
                toast(`'${object.label}'을 브러시로 선택했습니다`, "ok");
              },
            },
          }),
        ],
      }),
```

`paletteStampFromCells` 를 import 목록의 `paletteStampFromKit` 옆에 더한다.

- [ ] **Step 5: 안내문을 사실에 맞게 고친다**

같은 함수의 `structure-kit-object-hint` 문구를 바꾼다. 지금 문구는 "이름 변경이나 삭제는 할 수 없습니다" 로 끝나 막다른 길처럼 읽힌다:

```ts
      el("p", {
        class: "structure-kit-quiet",
        dataset: { testid: "structure-kit-object-hint" },
        text: "실내 오브젝트는 코드로 관리되는 카탈로그입니다 — 고치려면 [내 구조물로 복제]를 쓰세요.",
      }),
```

(복제 버튼은 Task 11 에서 붙는다. 그전까지 이 문구는 앞서갈 수 있으므로, Task 11 을 같은 브랜치에서 마치기 전에는 이 문구 변경을 커밋하지 않아도 된다 — 하지만 계획대로 순서대로 진행하면 문제없다.)

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: PASS (17 tests)

- [ ] **Step 7: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/editor/panels/structureKitDbTab.ts src/editor/harnessSuggestion/structureKitModel.ts test/structureKitDbTab.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 실내 오브젝트를 브러시로 집을 수 있게 한다

실내 오브젝트 인스펙터에는 액션이 하나도 없어, 카탈로그의 모양을 맵에 놓을
길이 우회로조차 없었다. cells 가 이미 PaletteStampCell 과 같은 모양이라
변환 한 겹으로 [팔레트에서 쓰기]를 연다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# 2단계 — 순수 계층

DOM 없이 로직을 먼저 고정한다. `environment: "node"` 라 여기가 유닛 테스트로 지킬 수 있는 전부이며, 위험의 대부분이 여기 있다.

## Task 3: 타입 확장 — `db-authored` 와 `StructureKitAiMeta`

**Files:**
- Modify: `src/project/types/base.ts:236` (`StructureKitLearnedFrom`), `:254-292` (킷 정의 두 개)
- Test: `test/structureKitRasterModel.test.ts` (신규, Task 4 에서 본격 사용)

**Interfaces:**
- Produces:
  - `type StructureKitLearnedFrom = "user-paint" | "builtin-parametric" | "db-authored"`
  - `interface StructureKitAiMeta { description: string; placementRules: string; tags?: string[]; role?: TileGroupRole; repeatability?: "repeat" | "fixed"; origin?: "user" | "ai"; confidence?: "high" | "medium" | "low" }`
  - `SectionStructureKitDef.ai?: StructureKitAiMeta` · `HouseStructureKitDef.ai?: StructureKitAiMeta`

- [ ] **Step 1: `learnedFrom` 유니언에 값을 더한다**

`src/project/types/base.ts:236` 을 바꾼다:

```ts
// 스탬프 출처 유니언(2026-07-20, 스탬프 3부작 선행과제): 붓질 학습 외에 내장 파라메트릭 킷.
// db-authored(2026-08-28): 데이터베이스 '구조물' 탭에서 직접 만들거나 복제·가져온 킷.
// 이 값은 계보 표시 전용이다 — 편집 잠금은 앨범 엔트리의 source 로 판정한다(structureKitDbTab).
export type StructureKitLearnedFrom = "user-paint" | "builtin-parametric" | "db-authored";
```

- [ ] **Step 2: AI 메타 타입을 더한다**

`StructureKitPart` 정의 바로 뒤(`:252` 다음)에 넣는다:

```ts
/**
 * 구조물의 AI 어휘 메타데이터(2026-08-28).
 * 필드명은 TileGroupMetadata / TileAiMetadata 와 의도적으로 같다 — AI 가 이미 그 단어들을 읽고 있다.
 * 구조물은 사람이 모양을 만들어 이름 붙이면 AI 가 그 이름으로 골라 시공하는 어휘이므로,
 * "이게 뭔지"와 "어디에 놓는지"가 없으면 AI 는 이름만 보고 추측할 수밖에 없다.
 */
export interface StructureKitAiMeta {
  /** 이게 무엇인지. TileGroupMetadata.description 과 같은 이름. */
  description: string;
  /** 어디에 어떻게 놓는지. TileGroupMetadata.placementRules 와 같은 이름. */
  placementRules: string;
  /** 검색·매칭용. TileAiMetadata.tags 와 같은 이름. */
  tags?: string[];
  /** 분류. TileGroupRole enum 재사용. */
  role?: TileGroupRole;
  /**
   * 가로로 이어 찍어도 되는지. stamp_structure_kit 의 repeat 기본값이 3 이라,
   * 이 값이 없으면 우물·간판 같은 완결 구조물도 3개 이어 찍힌다.
   * TileAiMetadata 는 4값이지만 "center" 는 구조물에 뜻이 없어 2값으로 줄인다.
   * undefined 는 현재 동작(kind === "section" → 반복) 유지 — 하위 호환.
   */
  repeatability?: "repeat" | "fixed";
  /**
   * v3 승인 보캐뷸러리 규약(원칙 0 Zero-Trust Perception).
   * 사용자 명시 수락으로 커밋될 때만 "user" 다 — 어떤 자동 경로도 이 값을 "user" 로 만들지 않는다.
   */
  origin?: "user" | "ai";
  confidence?: "high" | "medium" | "low";
}
```

`TileGroupRole` 은 같은 파일 `:77` 에 이미 있으므로 import 가 필요 없다.

- [ ] **Step 3: 두 킷 정의에 optional 필드를 단다**

`SectionStructureKitDef` 의 `learnedFrom` 줄 앞과 `HouseStructureKitDef` 의 같은 자리에 각각 넣는다:

```ts
  /** AI 어휘 메타데이터. 없으면 AI 는 이름과 크기만 본다. */
  ai?: StructureKitAiMeta;
```

- [ ] **Step 4: 타입 검사로 기존 코드가 깨지지 않는지 확인한다**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음. 유니언에 값을 더하는 것과 optional 필드 추가는 기존 코드를 깨지 않는다. 단 `structureKitDbTab.ts:625` 의 `sourceLabel` 이 삼항이라 `db-authored` 를 "내장 파라메트릭" 으로 표시하게 되므로 다음 스텝에서 고친다.

- [ ] **Step 5: 계보 표시를 세 값 모두 다루게 고친다**

`src/editor/panels/structureKitDbTab.ts:625` 의 삼항을 함수로 바꾼다. `partKindName` 옆에 추가한다:

```ts
/** 계보 표시 — 편집 잠금과 무관한 순수 표시값. */
function learnedFromLabel(learnedFrom: StructureKitLearnedFrom): string {
  switch (learnedFrom) {
    case "user-paint":
      return "붓질에서 학습";
    case "builtin-parametric":
      return "내장 파라메트릭";
    case "db-authored":
      return "데이터베이스에서 작성";
  }
}
```

그리고 `:625` 를 `const sourceLabel = learnedFromLabel(kit.learnedFrom);` 로 바꾼다. import 에 `StructureKitLearnedFrom` 타입을 더한다.

- [ ] **Step 6: 테스트와 타입 검사**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts && npx tsc --noEmit -p tsconfig.app.json`

Expected: PASS, 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add src/project/types/base.ts src/editor/panels/structureKitDbTab.ts
git commit -m "$(cat <<'EOF'
feat(types): 구조물에 AI 어휘 메타데이터와 db-authored 계보를 연다

타일 그룹에는 description·placementRules·role·origin 이 있고 upsert_tile_group
이라는 AI 도구까지 있는데 구조물에는 하나도 없었다. AI 는 이름만 보고
"있는 그대로 깔" 수밖에 없었다. 필드명은 TileGroupMetadata/TileAiMetadata 와
같게 두어 AI 가 이미 읽는 단어를 재사용한다.

learnedFrom 은 잠금에서 손을 뗀 뒤 계보 표시 전용이 됐으므로,
DB 에서 작성·복제·가져온 킷을 "붓질에서 학습"이라 거짓 표기하지 않도록
db-authored 를 더한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `structureKitRasterModel` — 칸 계산과 페인트

**Files:**
- Create: `src/editor/harnessSuggestion/structureKitRasterModel.ts`
- Test: `test/structureKitRasterModel.test.ts`

**Interfaces:**
- Consumes: `SectionStructureKitDef`, `TILE.EMPTY`
- Produces:
  - `cellAtPoint(rect: {left:number;top:number}, scale: number, clientX: number, clientY: number, size: {width:number;height:number}): {cx:number;cy:number} | null`
  - `paintCell(kit: SectionStructureKitDef, cx: number, cy: number, layer: "lower"|"upper", tile: number): SectionStructureKitDef`
  - `tileAt(kit: SectionStructureKitDef, cx: number, cy: number, layer: "lower"|"upper"): number`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitRasterModel.test.ts` 를 만든다:

```ts
import { describe, expect, it } from "vitest";
import { cellAtPoint, paintCell, tileAt } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { TILE } from "@/project/defaults/constants";
import type { SectionStructureKitDef } from "@/project/types";

function kit3x3(): SectionStructureKitDef {
  return {
    id: "kit_test",
    kind: "section",
    name: "테스트",
    width: 3,
    height: 3,
    rows: [
      { tiles: [240, 240, 240] },
      { tiles: [240, 116, 240] },
      { tiles: [240, 240, 240] },
    ],
    learnedFrom: "db-authored",
  };
}

describe("cellAtPoint", () => {
  // rect·scale 을 인자로 받는다 — fakeDom 의 getBoundingClientRect() 는 전부 0 이라
  // 함수 내부에서 DOM 을 읽으면 유닛 테스트가 무의미해진다.
  const rect = { left: 100, top: 50 };
  const size = { width: 3, height: 3 };

  it("좌상단 칸을 집는다", () => {
    // scale 3 → 칸 하나가 48px
    expect(cellAtPoint(rect, 3, 100, 50, size)).toEqual({ cx: 0, cy: 0 });
    expect(cellAtPoint(rect, 3, 147, 97, size)).toEqual({ cx: 0, cy: 0 });
  });

  it("가운데 칸을 집는다", () => {
    expect(cellAtPoint(rect, 3, 148, 98, size)).toEqual({ cx: 1, cy: 1 });
  });

  it("경계 밖은 null 을 준다", () => {
    expect(cellAtPoint(rect, 3, 99, 50, size)).toBeNull();
    expect(cellAtPoint(rect, 3, 100, 49, size)).toBeNull();
    expect(cellAtPoint(rect, 3, 244, 50, size)).toBeNull();  // cx 3 = 범위 밖
    expect(cellAtPoint(rect, 3, 100, 194, size)).toBeNull(); // cy 3 = 범위 밖
  });

  it("scale 1 에서도 맞는다", () => {
    expect(cellAtPoint(rect, 1, 116, 66, size)).toEqual({ cx: 1, cy: 1 });
  });
});

describe("paintCell", () => {
  it("하층 타일을 바꾼다", () => {
    const next = paintCell(kit3x3(), 0, 0, "lower", 421);
    expect(tileAt(next, 0, 0, "lower")).toBe(421);
    expect(tileAt(next, 1, 1, "lower")).toBe(116);
  });

  it("원본을 변형하지 않는다", () => {
    const original = kit3x3();
    paintCell(original, 0, 0, "lower", 421);
    expect(tileAt(original, 0, 0, "lower")).toBe(240);
  });

  it("upperTiles 가 없던 행에 상층을 칠하면 배열이 생긴다", () => {
    const next = paintCell(kit3x3(), 2, 0, "upper", 208);
    expect(tileAt(next, 2, 0, "upper")).toBe(208);
    expect(tileAt(next, 0, 0, "upper")).toBe(TILE.EMPTY);
    expect(next.rows[0]!.upperTiles).toHaveLength(3);
  });

  it("경계 밖 좌표는 킷을 그대로 돌려준다", () => {
    const original = kit3x3();
    expect(paintCell(original, 3, 0, "lower", 421)).toBe(original);
    expect(paintCell(original, -1, 0, "lower", 421)).toBe(original);
    expect(paintCell(original, 0, 3, "lower", 421)).toBe(original);
  });

  it("지우개는 EMPTY 를 칠하는 것과 같다", () => {
    const next = paintCell(kit3x3(), 1, 1, "lower", TILE.EMPTY);
    expect(tileAt(next, 1, 1, "lower")).toBe(TILE.EMPTY);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: FAIL — 모듈을 찾을 수 없음

- [ ] **Step 3: 최소 구현을 쓴다**

`src/editor/harnessSuggestion/structureKitRasterModel.ts` 를 만든다:

```ts
// harnessSuggestion/structureKitRasterModel.ts
// 구조물 래스터 편집의 순수 변환 계층 — DOM·store 의존 없음(유닛 테스트 대상).
//
// 왜 rect·scale 을 인자로 받는가:
//   유닛 테스트 환경이 environment:"node" + 손수 만든 FakeElement 라
//   getBoundingClientRect() 가 전부 0 을 돌려준다. 함수 안에서 DOM 을 읽으면
//   테스트에서 항상 (0,0) 이 나와 검증이 무의미해진다. 호출부가 읽어서 넘긴다.

import { TILE_SIZE } from "@/assets/bundled";
import { TILE } from "@/project/defaults/constants";
import type { SectionStructureKitDef, StructureKitRow } from "@/project/types";

export type KitLayer = "lower" | "upper";

/** 화면 좌표 → 칸 좌표. 킷 경계 밖이면 null. */
export function cellAtPoint(
  rect: { readonly left: number; readonly top: number },
  scale: number,
  clientX: number,
  clientY: number,
  size: { readonly width: number; readonly height: number },
): { readonly cx: number; readonly cy: number } | null {
  const cellPx = TILE_SIZE * Math.max(1, scale);
  const cx = Math.floor((clientX - rect.left) / cellPx);
  const cy = Math.floor((clientY - rect.top) / cellPx);
  if (cx < 0 || cy < 0 || cx >= size.width || cy >= size.height) return null;
  return { cx, cy };
}

/** 한 칸의 타일 번호. 없으면 EMPTY. */
export function tileAt(
  kit: SectionStructureKitDef,
  cx: number,
  cy: number,
  layer: KitLayer,
): number {
  const row = kit.rows[cy];
  if (!row) return TILE.EMPTY;
  return (layer === "upper" ? row.upperTiles?.[cx] : row.tiles[cx]) ?? TILE.EMPTY;
}

/** 한 칸을 칠한 새 킷. 경계 밖이면 원본을 그대로 돌려준다(참조 동일). */
export function paintCell(
  kit: SectionStructureKitDef,
  cx: number,
  cy: number,
  layer: KitLayer,
  tile: number,
): SectionStructureKitDef {
  if (cx < 0 || cy < 0 || cx >= kit.width || cy >= kit.height) return kit;
  const rows = kit.rows.map((row, index) => {
    if (index !== cy) return row;
    return writeCell(row, kit.width, cx, layer, tile);
  });
  return { ...kit, rows };
}

function writeCell(row: StructureKitRow, width: number, cx: number, layer: KitLayer, tile: number): StructureKitRow {
  if (layer === "lower") {
    const tiles = [...row.tiles];
    tiles[cx] = tile;
    return { ...row, tiles };
  }
  // 상층 배열은 내용이 있을 때만 기록하는 직렬화 규약이라, 없던 행에는 여기서 만든다.
  const upperTiles = row.upperTiles ? [...row.upperTiles] : new Array<number>(width).fill(TILE.EMPTY);
  upperTiles[cx] = tile;
  return { ...row, upperTiles };
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitRasterModel.ts test/structureKitRasterModel.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 래스터의 칸 계산과 페인트를 순수 함수로 연다

유닛 테스트 환경이 node + FakeElement 라 getBoundingClientRect() 가 전부 0 이다.
칸 계산이 내부에서 DOM 을 읽으면 테스트가 항상 (0,0) 을 보게 되므로,
rect·scale 을 인자로 받는 형태로 경계를 긋는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `resizeKit` — 크기 조절과 부위 손실 보고

크기를 줄이면 경계 밖 부위가 생긴다. 조용히 사라지게 두지 않고 **몇 개가 잘리고 몇 개가 지워졌는지 반환**해 호출부가 보고하게 한다.

**Files:**
- Modify: `src/editor/harnessSuggestion/structureKitRasterModel.ts`
- Test: `test/structureKitRasterModel.test.ts`

**Interfaces:**
- Produces: `resizeKit(kit: SectionStructureKitDef, width: number, height: number): { kit: SectionStructureKitDef; clamped: number; dropped: number }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitRasterModel.test.ts` 에 추가한다. import 에 `resizeKit` 을 더한다.

```ts
describe("resizeKit", () => {
  function kitWithParts(): SectionStructureKitDef {
    return {
      ...kit3x3(),
      parts: [
        { id: "p_inside", kind: "anchor", dx: 0, dy: 0, w: 1, h: 1 },
        { id: "p_straddle", kind: "window", dx: 1, dy: 1, w: 2, h: 2 },
        { id: "p_outside", kind: "sign", dx: 2, dy: 2, w: 1, h: 1 },
      ],
    };
  }

  it("늘리면 새 칸이 EMPTY 로 채워진다", () => {
    const result = resizeKit(kit3x3(), 5, 4);
    expect(result.kit.width).toBe(5);
    expect(result.kit.height).toBe(4);
    expect(result.kit.rows).toHaveLength(4);
    expect(result.kit.rows[0]!.tiles).toHaveLength(5);
    expect(tileAt(result.kit, 4, 0, "lower")).toBe(TILE.EMPTY);
    expect(tileAt(result.kit, 0, 3, "lower")).toBe(TILE.EMPTY);
    // 기존 내용은 남는다
    expect(tileAt(result.kit, 1, 1, "lower")).toBe(116);
    expect(result.clamped).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it("줄이면 잘린 칸이 사라진다", () => {
    const result = resizeKit(kit3x3(), 2, 2);
    expect(result.kit.width).toBe(2);
    expect(result.kit.rows).toHaveLength(2);
    expect(result.kit.rows[0]!.tiles).toHaveLength(2);
    expect(tileAt(result.kit, 1, 1, "lower")).toBe(116);
  });

  it("줄일 때 경계에 걸친 부위는 클램프하고 완전히 밖인 부위는 지운다", () => {
    const result = resizeKit(kitWithParts(), 2, 2);
    const ids = (result.kit.parts ?? []).map((part) => part.id);
    expect(ids).toContain("p_inside");
    expect(ids).toContain("p_straddle");
    expect(ids).not.toContain("p_outside");

    const straddle = result.kit.parts!.find((part) => part.id === "p_straddle")!;
    expect(straddle.dx).toBe(1);
    expect(straddle.dy).toBe(1);
    expect(straddle.w).toBe(1); // 1+2=3 → 2 로 클램프
    expect(straddle.h).toBe(1);

    expect(result.clamped).toBe(1);
    expect(result.dropped).toBe(1);
  });

  it("1칸 미만으로는 줄지 않는다", () => {
    const result = resizeKit(kit3x3(), 0, -2);
    expect(result.kit.width).toBe(1);
    expect(result.kit.height).toBe(1);
  });

  it("크기가 그대로면 킷을 그대로 돌려준다", () => {
    const original = kit3x3();
    const result = resizeKit(original, 3, 3);
    expect(result.kit).toBe(original);
    expect(result.clamped).toBe(0);
    expect(result.dropped).toBe(0);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: FAIL — `resizeKit is not a function`

- [ ] **Step 3: 구현을 더한다**

`structureKitRasterModel.ts` 에 추가한다. import 에 `StructureKitPart` 를 더한다.

```ts
export interface ResizeResult {
  readonly kit: SectionStructureKitDef;
  /** 경계에 걸쳐 크기가 줄어든 부위 수. */
  readonly clamped: number;
  /** 경계 밖으로 완전히 나가 삭제된 부위 수. */
  readonly dropped: number;
}

/**
 * 킷 크기 조절. 늘린 칸은 EMPTY, 줄이며 잘린 칸은 버린다.
 * 부위는 조용히 사라지지 않는다 — 클램프·삭제 개수를 돌려주어 호출부가 사용자에게 보고한다.
 */
export function resizeKit(kit: SectionStructureKitDef, width: number, height: number): ResizeResult {
  const nextWidth = Math.max(1, Math.floor(width));
  const nextHeight = Math.max(1, Math.floor(height));
  if (nextWidth === kit.width && nextHeight === kit.height) {
    return { kit, clamped: 0, dropped: 0 };
  }

  const rows: StructureKitRow[] = [];
  for (let y = 0; y < nextHeight; y += 1) {
    const source = kit.rows[y];
    const tiles = new Array<number>(nextWidth).fill(TILE.EMPTY);
    let upperTiles: number[] | undefined;
    for (let x = 0; x < nextWidth; x += 1) {
      tiles[x] = source?.tiles[x] ?? TILE.EMPTY;
      const upper = source?.upperTiles?.[x] ?? TILE.EMPTY;
      if (upper !== TILE.EMPTY) {
        upperTiles ??= new Array<number>(nextWidth).fill(TILE.EMPTY);
        upperTiles[x] = upper;
      }
    }
    rows.push(upperTiles ? { tiles, upperTiles } : { tiles });
  }

  let clamped = 0;
  let dropped = 0;
  const parts: StructureKitPart[] = [];
  for (const part of kit.parts ?? []) {
    if (part.dx >= nextWidth || part.dy >= nextHeight) {
      dropped += 1;
      continue;
    }
    const w = Math.min(part.w, nextWidth - part.dx);
    const h = Math.min(part.h, nextHeight - part.dy);
    if (w !== part.w || h !== part.h) clamped += 1;
    parts.push({ ...part, w, h });
  }

  return {
    kit: { ...kit, width: nextWidth, height: nextHeight, rows, parts },
    clamped,
    dropped,
  };
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: PASS (14 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitRasterModel.ts test/structureKitRasterModel.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 크기 조절이 부위 손실을 숨기지 않게 한다

크기를 줄이면 경계 밖 부위가 생긴다. 조용히 지우면 사용자는 입구가 사라진 걸
나중에야 안다. resizeKit 이 클램프·삭제 개수를 돌려주어 호출부가 보고하게 한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 부위 CRUD

**Files:**
- Modify: `src/editor/harnessSuggestion/structureKitRasterModel.ts`
- Test: `test/structureKitRasterModel.test.ts`

**Interfaces:**
- Produces:
  - `addPart(kit, rect: {dx:number;dy:number;w:number;h:number}, kind: StructureKitPartKind, id: string): SectionStructureKitDef`
  - `updatePart(kit, partId: string, patch: Partial<Pick<StructureKitPart, "kind"|"dx"|"dy"|"w"|"h"|"note">>): SectionStructureKitDef`
  - `removePart(kit, partId: string): SectionStructureKitDef`
  - `normalizeDragRect(a: {cx:number;cy:number}, b: {cx:number;cy:number}): {dx:number;dy:number;w:number;h:number}`

`addPart` 가 `id` 를 인자로 받는 이유: `randomUuid()` 를 안에서 부르면 순수 함수가 아니게 되고 테스트가 결과를 단언할 수 없다. 호출부가 발급한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

import 에 `addPart, updatePart, removePart, normalizeDragRect` 를 더하고 추가한다:

```ts
describe("normalizeDragRect", () => {
  it("어느 방향으로 끌어도 좌상단·크기로 정규화한다", () => {
    expect(normalizeDragRect({ cx: 2, cy: 3 }, { cx: 0, cy: 1 }))
      .toEqual({ dx: 0, dy: 1, w: 3, h: 3 });
  });

  it("한 칸 클릭은 1×1 이다", () => {
    expect(normalizeDragRect({ cx: 1, cy: 1 }, { cx: 1, cy: 1 }))
      .toEqual({ dx: 1, dy: 1, w: 1, h: 1 });
  });
});

describe("부위 CRUD", () => {
  it("부위를 더한다", () => {
    const next = addPart(kit3x3(), { dx: 1, dy: 0, w: 1, h: 3 }, "entrance", "p_new");
    expect(next.parts).toHaveLength(1);
    expect(next.parts![0]).toEqual({ id: "p_new", kind: "entrance", dx: 1, dy: 0, w: 1, h: 3 });
  });

  it("킷 경계를 넘는 부위는 클램프해서 더한다", () => {
    const next = addPart(kit3x3(), { dx: 2, dy: 2, w: 5, h: 5 }, "sign", "p_big");
    expect(next.parts![0]!.w).toBe(1);
    expect(next.parts![0]!.h).toBe(1);
  });

  it("부위를 고친다", () => {
    const withPart = addPart(kit3x3(), { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1");
    const next = updatePart(withPart, "p1", { kind: "window", note: "남쪽 창" });
    expect(next.parts![0]!.kind).toBe("window");
    expect(next.parts![0]!.note).toBe("남쪽 창");
    expect(next.parts![0]!.dx).toBe(0);
  });

  it("없는 부위를 고치면 킷을 그대로 돌려준다", () => {
    const withPart = addPart(kit3x3(), { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1");
    expect(updatePart(withPart, "nope", { kind: "sign" })).toBe(withPart);
  });

  it("부위를 지운다", () => {
    const withParts = addPart(
      addPart(kit3x3(), { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1"),
      { dx: 2, dy: 2, w: 1, h: 1 }, "sign", "p2",
    );
    const next = removePart(withParts, "p1");
    expect(next.parts).toHaveLength(1);
    expect(next.parts![0]!.id).toBe("p2");
  });

  it("원본을 변형하지 않는다", () => {
    const original = kit3x3();
    addPart(original, { dx: 0, dy: 0, w: 1, h: 1 }, "anchor", "p1");
    expect(original.parts).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: FAIL — 함수 없음

- [ ] **Step 3: 구현을 더한다**

import 에 `StructureKitPartKind` 를 더하고 추가한다:

```ts
export interface PartRect {
  readonly dx: number;
  readonly dy: number;
  readonly w: number;
  readonly h: number;
}

/** 드래그 두 점(어느 방향이든) → 좌상단 + 크기. */
export function normalizeDragRect(
  a: { readonly cx: number; readonly cy: number },
  b: { readonly cx: number; readonly cy: number },
): PartRect {
  const dx = Math.min(a.cx, b.cx);
  const dy = Math.min(a.cy, b.cy);
  return { dx, dy, w: Math.abs(a.cx - b.cx) + 1, h: Math.abs(a.cy - b.cy) + 1 };
}

/** 부위 추가. id 는 호출부가 발급한다 — 순수 함수를 지키기 위해 randomUuid 를 안에서 부르지 않는다. */
export function addPart(
  kit: SectionStructureKitDef,
  rect: PartRect,
  kind: StructureKitPartKind,
  id: string,
): SectionStructureKitDef {
  const dx = clamp(rect.dx, 0, kit.width - 1);
  const dy = clamp(rect.dy, 0, kit.height - 1);
  const part: StructureKitPart = {
    id,
    kind,
    dx,
    dy,
    w: clamp(rect.w, 1, kit.width - dx),
    h: clamp(rect.h, 1, kit.height - dy),
  };
  return { ...kit, parts: [...(kit.parts ?? []), part] };
}

export function updatePart(
  kit: SectionStructureKitDef,
  partId: string,
  patch: Partial<Pick<StructureKitPart, "kind" | "dx" | "dy" | "w" | "h" | "note">>,
): SectionStructureKitDef {
  const parts = kit.parts ?? [];
  if (!parts.some((part) => part.id === partId)) return kit;
  return {
    ...kit,
    parts: parts.map((part) => (part.id === partId ? { ...part, ...patch } : part)),
  };
}

export function removePart(kit: SectionStructureKitDef, partId: string): SectionStructureKitDef {
  const parts = kit.parts ?? [];
  if (!parts.some((part) => part.id === partId)) return kit;
  return { ...kit, parts: parts.filter((part) => part.id !== partId) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: PASS (22 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitRasterModel.ts test/structureKitRasterModel.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 부위를 더하고 고치고 지우는 순수 함수를 연다

부위는 stamp_structure_kit 이 절대좌표로 변환해 AI 에게 돌려주는 값이라,
사람이 워프·간판 자리를 지정할 수 있어야 AI 가 그 자리에 이벤트를 심는다.
지금까지는 삭제와 "문에서 입구 추정" 휴리스틱뿐이었다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 굽기(bake)와 복제

무엇을 복제하든 결과는 언제나 `SectionStructureKitDef` 다. 파라메트릭 조절은 원래 구조물 탭의 일이 아니라 `build_house_kit` 의 일이고, `list_structure_kits` 는 section 킷에만 `rows` 를 넘기므로 굽기는 오히려 **AI 가독성을 높인다**.

**Files:**
- Modify: `src/editor/harnessSuggestion/structureKitRasterModel.ts`
- Test: `test/structureKitRasterModel.test.ts`

**Interfaces:**
- Consumes: `structureKitUnitCells(kit)` (`structureKitModel.ts:141`), `structureKitSize(kit)` (`:93`), `InteriorObjectDef`
- Produces:
  - `bakeCellsToRows(cells, width, height): StructureKitRow[]`
  - `bakeStructureKit(kit: StructureKitDef, id: string, name: string): SectionStructureKitDef`
  - `bakeInteriorObject(object: InteriorObjectDef, id: string, name: string): SectionStructureKitDef`
  - `copyName(baseName: string, existingNames: readonly string[]): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { bakeCellsToRows, bakeInteriorObject, bakeStructureKit, copyName } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { BUILTIN_HOUSE_STRUCTURE_KITS } from "@/editor/harnessSuggestion/builtinHouseStructureKits";

describe("bakeCellsToRows", () => {
  it("셀 목록을 행렬로 편다", () => {
    const rows = bakeCellsToRows(
      [
        { dx: 0, dy: 0, layer: "lower", tile: 240 },
        { dx: 1, dy: 0, layer: "upper", tile: 208 },
        { dx: 1, dy: 1, layer: "lower", tile: 116 },
      ],
      2,
      2,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.tiles).toEqual([240, TILE.EMPTY]);
    expect(rows[0]!.upperTiles).toEqual([TILE.EMPTY, 208]);
    // 상층이 빈 행은 upperTiles 를 기록하지 않는다 — 기존 직렬화 규약과 같다.
    expect(rows[1]!.tiles).toEqual([TILE.EMPTY, 116]);
    expect(rows[1]!.upperTiles).toBeUndefined();
  });
});

describe("bakeStructureKit", () => {
  it("집 킷을 section 으로 굳힌다", () => {
    const house = BUILTIN_HOUSE_STRUCTURE_KITS[0]!;
    const baked = bakeStructureKit(house, "kit_baked", "통나무집 사본");
    expect(baked.kind).toBe("section");
    expect(baked.id).toBe("kit_baked");
    expect(baked.name).toBe("통나무집 사본");
    expect(baked.learnedFrom).toBe("db-authored");
    expect(baked.width).toBeGreaterThan(0);
    expect(baked.rows).toHaveLength(baked.height);
    expect(baked.rows[0]!.tiles).toHaveLength(baked.width);
    // 실제 타일이 하나라도 들어 있어야 한다 — 빈 껍데기를 구우면 의미가 없다.
    const painted = baked.rows.some((row) => row.tiles.some((tile) => tile !== TILE.EMPTY));
    expect(painted).toBe(true);
  });

  it("section 킷은 부위까지 그대로 복사한다", () => {
    const source = { ...kit3x3(), parts: [{ id: "p1", kind: "entrance" as const, dx: 1, dy: 1, w: 1, h: 2 }] };
    const baked = bakeStructureKit(source, "kit_copy", "우물 사본");
    expect(baked.parts).toHaveLength(1);
    expect(baked.parts![0]!.id).toBe("p1");
    expect(baked.rows).toEqual(source.rows);
  });
});

describe("bakeInteriorObject", () => {
  it("실내 오브젝트를 section 으로 굳히고 role·snap·themes 는 버린다", () => {
    const object = INTERIOR_OBJECT_CATALOG[0]!;
    const baked = bakeInteriorObject(object, "kit_bed", "침대 사본");
    expect(baked.kind).toBe("section");
    expect(baked.width).toBe(object.width);
    expect(baked.height).toBe(object.height);
    expect(baked.learnedFrom).toBe("db-authored");
    expect(baked.parts ?? []).toHaveLength(0);
    expect(Object.keys(baked)).not.toContain("role");
    expect(Object.keys(baked)).not.toContain("themes");
    expect(Object.keys(baked)).not.toContain("snap");
  });
});

describe("copyName", () => {
  it("사본 이름을 만든다", () => {
    expect(copyName("우물", [])).toBe("우물 사본");
  });

  it("이미 사본이 있으면 번호를 올린다", () => {
    expect(copyName("우물", ["우물", "우물 사본"])).toBe("우물 사본 2");
    expect(copyName("우물", ["우물 사본", "우물 사본 2"])).toBe("우물 사본 3");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: FAIL — 함수 없음

- [ ] **Step 3: 구현을 더한다**

```ts
import { structureKitSize, structureKitUnitCells } from "@/editor/harnessSuggestion/structureKitModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import type { PaletteStampCell } from "@/editor/tilePaletteStamp";
import type { StructureKitDef } from "@/project/types";

/** 셀 목록 → 행렬. 상층 배열은 내용이 있는 행에만 기록(기존 직렬화 규약과 같다). */
export function bakeCellsToRows(
  cells: readonly PaletteStampCell[],
  width: number,
  height: number,
): StructureKitRow[] {
  const lower: number[][] = [];
  const upper: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    lower.push(new Array<number>(width).fill(TILE.EMPTY));
    upper.push(new Array<number>(width).fill(TILE.EMPTY));
  }
  for (const cell of cells) {
    if (cell.dx < 0 || cell.dy < 0 || cell.dx >= width || cell.dy >= height) continue;
    (cell.layer === "upper" ? upper : lower)[cell.dy]![cell.dx] = cell.tile;
  }
  return lower.map((tiles, y) => {
    const upperRow = upper[y]!;
    return upperRow.some((tile) => tile !== TILE.EMPTY) ? { tiles, upperTiles: upperRow } : { tiles };
  });
}

/**
 * 무엇을 복제하든 결과는 section 이다.
 * 집 킷의 파라미터성은 여기서 잃지만, 파라메트릭 시공은 원래 build_house_kit 의 일이고
 * list_structure_kits 는 section 킷에만 rows 를 넘기므로 굽기가 오히려 AI 가독성을 높인다.
 */
export function bakeStructureKit(kit: StructureKitDef, id: string, name: string): SectionStructureKitDef {
  const size = structureKitSize(kit);
  const rows = kit.kind === "section"
    ? kit.rows.map((row) => ({ tiles: [...row.tiles], ...(row.upperTiles ? { upperTiles: [...row.upperTiles] } : {}) }))
    : bakeCellsToRows(structureKitUnitCells(kit), size.width, size.height);
  return {
    id,
    kind: "section",
    name,
    width: size.width,
    height: size.height,
    rows,
    ...(kit.parts && kit.parts.length > 0 ? { parts: kit.parts.map((part) => ({ ...part })) } : {}),
    ...(kit.ai ? { ai: { ...kit.ai, tags: kit.ai.tags ? [...kit.ai.tags] : undefined } } : {}),
    learnedFrom: "db-authored",
  };
}

/**
 * 실내 오브젝트 → section. role·snap·themes 는 버린다.
 * 그 메타는 실내 방 생성 파이프라인의 문법이고, 사본은 그 문법에 등록되지 않는다.
 */
export function bakeInteriorObject(object: InteriorObjectDef, id: string, name: string): SectionStructureKitDef {
  return {
    id,
    kind: "section",
    name,
    width: Math.max(1, object.width),
    height: Math.max(1, object.height),
    rows: bakeCellsToRows(
      object.cells.map((cell) => ({ dx: cell.dx, dy: cell.dy, layer: cell.layer, tile: cell.tile })),
      Math.max(1, object.width),
      Math.max(1, object.height),
    ),
    learnedFrom: "db-authored",
  };
}

/** '우물' → '우물 사본' → '우물 사본 2' … 이미 쓰는 이름을 피한다. */
export function copyName(baseName: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  const first = `${baseName} 사본`;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${first} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${first} ${Date.now()}`;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitRasterModel.test.ts`

Expected: PASS (29 tests)

- [ ] **Step 5: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitRasterModel.ts test/structureKitRasterModel.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 어떤 원본이든 편집 가능한 section 으로 굽는다

내장 집과 실내 오브젝트는 코드 상수라 편집의 출발점이 될 수 없었다.
복제 시 section 으로 굳히면 원본 카탈로그는 불변인 채 사본만 편집 대상이 된다.

굽기는 손실이 아니다. list_structure_kits 는 section 킷에 rows 를 통째로 주고
house 킷에는 {houseKitId, wings} 만 주므로, AI 는 굽기 전 집 킷의 모양을 볼 수 없다.

실내 오브젝트의 role·snap·themes 는 버린다 — 실내 방 생성 파이프라인의 문법이고
사본은 그 문법에 등록되지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# 3단계 — 편집기 다이얼로그

## Task 8: 인스펙터를 별도 파일로 분리

`structureKitDbTab.ts` 는 865줄이고 렌더와 비즈니스 로직이 섞여 있다. 3단계에서 여기에 편집기 진입점이 더 붙으므로, 먼저 인스펙터를 떼어 조립기를 얇게 만든다. **동작 변화 없는 순수 이동**이다.

**Files:**
- Create: `src/editor/panels/structureKitInspector.ts`
- Modify: `src/editor/panels/structureKitDbTab.ts` (해당 함수 제거 + import 추가)
- Test: `test/structureKitDbTab.test.ts` (수정 없음 — 통과가 곧 이동 성공의 증거)

**Interfaces:**
- Produces (`structureKitInspector.ts` 에서 export):
  - `renderInspector(tileset: TilesetDef, kit: StructureKitDef, editable: boolean, host: HTMLElement, rerender: () => void): HTMLElement`
  - `renderObjectInspector(tileset: TilesetDef, object: InteriorObjectDef): HTMLElement`
  - `partKindName(kind: StructureKitPartKind): string` — 표의 `renderPartBadges` 가 쓴다
  - `interiorObjectCanvas(tileset: TilesetDef, object: InteriorObjectDef, scale: number): HTMLCanvasElement` — 표의 `renderObjectRow` 가 쓴다
  - `setInspectorSelectedPartId(id: string | null): void` / `inspectorSelectedPartId(): string | null` — `session.selectedPartId` 를 대신하는 접근자
- Consumes: Task 1 이 확정한 `renderInspector(..., editable, ...)` 시그니처

- [ ] **Step 1: 기준선을 잡는다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: PASS (17 tests). 이 숫자가 이동 후에도 같아야 한다.

- [ ] **Step 2: 새 파일을 만들고 함수를 그대로 옮긴다**

`src/editor/panels/structureKitInspector.ts` 를 만들고, `structureKitDbTab.ts` 에서 아래 함수들을 **본문 변경 없이** 잘라 붙인다:

| 함수 | 원본 위치 | 변경 |
|---|---|---|
| `interiorObjectCanvas` | `:483-492` | `export` 를 붙인다 |
| `renderObjectInspector` | `:494-531` (Task 2 의 액션 줄 포함) | `export` 를 붙인다 |
| `objectFact` | `:533-541` | 그대로 (파일 내부용) |
| `partKindName` | `:568-579` | `export` 를 붙인다 |
| `learnedFromLabel` | Task 3 에서 추가한 것 | 그대로 |
| `renderInspector` | `:581-821` | `export` 를 붙인다 |
| `saveKitParts` | `:823-835` | 그대로 |
| `autoEstimateEntranceParts` | `:837-864` | 그대로 |

파일 머리는 이렇게 쓴다:

```ts
// panels/structureKitInspector.ts
// 데이터베이스 '구조물' 탭의 오른쪽 열 — 읽기 요약과 액션.
// structureKitDbTab.ts 가 865줄까지 자라 렌더와 비즈니스 로직이 뒤엉켰기에 떼어냈다.
// 편집(래스터·부위·AI 메타)은 여기가 아니라 structureKitEditorDialog.ts 가 담당한다 —
// 인스펙터 열은 352px 고정이라 9×8 킷(scale 3 → 432px)이 들어가지 않는다.
//
// 표(structureKitDbTab)가 partKindName·interiorObjectCanvas 를 함께 쓰므로 여기서 내보낸다.
// 의존 방향은 탭 → 인스펙터 한 방향이다(순환 없음).

import { editorState } from "@/editor/editorState";
import { deleteStructureKit, renameStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromCells, paletteStampFromKit, structureKitSize } from "@/editor/harnessSuggestion/structureKitModel";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import {
  INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
  interiorObjectLayerLabel,
  interiorObjectRoleLabel,
  interiorObjectSnapLabel,
  interiorObjectThemeLabels,
} from "@/editor/panels/structureKitDbSources";
import { store } from "@/project/store";
import type {
  StructureKitDef,
  StructureKitLearnedFrom,
  StructureKitPart,
  StructureKitPartKind,
  TilesetDef,
} from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

/** 인스펙터가 강조 중인 부위. 탭 세션이 아니라 여기서 들고 있는다. */
let selectedPartId: string | null = null;

export function inspectorSelectedPartId(): string | null {
  return selectedPartId;
}

export function setInspectorSelectedPartId(id: string | null): void {
  selectedPartId = id;
}
```

- [ ] **Step 3: 옮긴 본문에서 `session.selectedPartId` 참조를 접근자로 바꾼다**

`renderInspector` 안의 두 곳:

```ts
    const isSelected = part.id === selectedPartId;
```

```ts
      on: {
        click: () => {
          selectedPartId = part.id;
          refresh(host, rerender);
        },
      },
```

`refresh` 는 탭이 갖고 있으므로, 인스펙터는 자신을 다시 그릴 방법이 필요하다. `renderInspector` 의 마지막 인자 `rerender` 와 별개로 **탭의 `refresh` 를 넘겨받는다.** `renderInspector` 시그니처를 이렇게 확장한다:

```ts
export function renderInspector(
  tileset: TilesetDef,
  kit: StructureKitDef,
  editable: boolean,
  refresh: () => void,
  rerender: () => void
): HTMLElement {
```

본문의 `refresh(host, rerender)` 호출을 전부 `refresh()` 로, `rerender(); refresh(host, rerender);` 는 `rerender(); refresh();` 로 바꾼다. `host` 인자는 더 이상 필요 없다.

- [ ] **Step 4: 탭에서 잘라낸 자리를 import 로 메운다**

`structureKitDbTab.ts` 의 import 블록에 더한다:

```ts
import {
  interiorObjectCanvas,
  partKindName,
  renderInspector,
  renderObjectInspector,
  setInspectorSelectedPartId,
} from "@/editor/panels/structureKitInspector";
```

그리고 호출부(Task 1 에서 고친 `:326-333`)를 새 시그니처에 맞춘다:

```ts
  if (selectedObject && activeTileset) {
    workspace.append(renderObjectInspector(activeTileset, selectedObject));
  } else if (selectedKit && activeTileset) {
    const editable = selectedEntry?.source === "user";
    workspace.append(
      renderInspector(activeTileset, selectedKit, editable, () => refresh(host, rerender), rerender)
    );
  }
```

`session.selectedPartId` 를 지우는 자리(레일 클릭·행 클릭·원본 칩 클릭 등 6곳)는 `setInspectorSelectedPartId(null)` 로 바꾸고, `ActiveSessionState` 에서 `selectedPartId` 필드와 `resetStructureKitsTabSession` 의 해당 줄을 지운다. 대신 리셋에 `setInspectorSelectedPartId(null)` 을 넣는다.

이제 `structureKitDbTab.ts` 에 남지 않아야 하는 것: `renderInspector`, `renderObjectInspector`, `objectFact`, `partKindName`, `learnedFromLabel`, `interiorObjectCanvas`, `saveKitParts`, `autoEstimateEntranceParts`, `session.selectedPartId`.

- [ ] **Step 5: 테스트를 돌려 같은 결과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: PASS (17 tests) — Step 1 과 같은 숫자

- [ ] **Step 6: 타입 검사와 줄 수 확인**

Run: `npx tsc --noEmit -p tsconfig.app.json && wc -l src/editor/panels/structureKitDbTab.ts src/editor/panels/structureKitInspector.ts`

Expected: 오류 없음. `structureKitDbTab.ts` 가 500줄 아래로 내려온다.

- [ ] **Step 7: 커밋**

```bash
git add src/editor/panels/structureKitDbTab.ts src/editor/panels/structureKitInspector.ts
git commit -m "$(cat <<'EOF'
refactor(database): 구조물 인스펙터를 조립기에서 떼어낸다

structureKitDbTab.ts 가 865줄까지 자라 레일·표·인스펙터 렌더와
부위 저장·입구 추정 로직이 한 파일에 뒤엉켜 있었다. 3단계에서 편집기 진입점이
더 붙기 전에 인스펙터를 분리해 조립기를 얇게 만든다. 동작 변화 없는 이동이다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 편집기 다이얼로그 셸과 래스터 페인트

**Files:**
- Create: `src/editor/panels/structureKitEditorDialog.ts`
- Create: `test/structureKitEditorDialog.test.ts`
- Modify: `src/editor/harnessSuggestion/structureKitActions.ts` (킷 통째 저장 접점)
- Modify: `src/styles/editor/harness-suggestion.css`

**Interfaces:**
- Consumes: `cellAtPoint`, `paintCell`, `tileAt` (Task 4) · `openDialog` (`databaseEnemyRecordSupport:63`) · `tilesetTileBackgroundStyle` (`tilesetImage.ts:74`) · `renderTileCellsToCanvas` (`kitRender.ts`)
- Produces:
  - `openStructureKitEditor(tilesetId: TilesetId, kitId: string, onClosed: () => void): void`
  - `replaceStructureKit(tilesetId: TilesetId, kit: SectionStructureKitDef): void` (actions)

- [ ] **Step 1: 킷 통째 저장 접점을 먼저 더한다 (테스트 포함)**

`test/structureKitRasterModel.test.ts` 가 아니라 새 파일 `test/structureKitEditorDialog.test.ts` 에 쓴다:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerStructureKit, replaceStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import { store } from "@/project/store";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { SectionStructureKitDef } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  store.update((project) => {
    for (const tileset of Object.values(project.tilesets)) {
      delete tileset.structureKits;
    }
  });
});

function seedKit(): SectionStructureKitDef {
  const kit: SectionStructureKitDef = {
    id: "kit_edit",
    kind: "section",
    name: "우물",
    width: 3,
    height: 3,
    rows: [
      { tiles: [240, 240, 240] },
      { tiles: [240, 116, 240] },
      { tiles: [240, 240, 240] },
    ],
    learnedFrom: "db-authored",
  };
  registerStructureKit(DEFAULT_TILESET_ID, kit);
  return kit;
}

describe("replaceStructureKit", () => {
  it("같은 id 의 킷을 통째로 갈아끼운다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, {
      ...seedKit(),
      name: "고친 우물",
      rows: [{ tiles: [421, 421, 421] }, { tiles: [421, 116, 421] }, { tiles: [421, 421, 421] }],
    });

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit");
    expect(stored).toBeDefined();
    expect(stored!.name).toBe("고친 우물");
    expect((stored as SectionStructureKitDef).rows[0]!.tiles).toEqual([421, 421, 421]);
  });

  it("없는 id 면 아무것도 하지 않는다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, { ...seedKit(), id: "kit_nope", name: "유령" });
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    expect(kits.map((kit) => kit.id)).not.toContain("kit_nope");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: FAIL — `replaceStructureKit` 이 없다

- [ ] **Step 3: 저장 접점을 구현한다**

`src/editor/harnessSuggestion/structureKitActions.ts` 에 추가한다:

```ts
/** DB 편집기: 킷을 통째로 갈아끼운다. 없는 id 면 아무것도 하지 않는다(유령 킷 생성 방지). */
export function replaceStructureKit(tilesetId: TilesetId, kit: StructureKitDef): void {
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset?.structureKits) return;
    if (!tileset.structureKits.some((candidate) => candidate.id === kit.id)) return;
    tileset.structureKits = tileset.structureKits.map((candidate) =>
      candidate.id === kit.id ? structuredClone(kit) : candidate,
    );
  });
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: PASS (2 tests)

- [ ] **Step 5: 다이얼로그의 실패 테스트를 쓴다**

같은 파일에 추가한다. import 에 `openStructureKitEditor` 를 더한다.

```ts
describe("openStructureKitEditor", () => {
  it("다이얼로그를 열고 래스터·팔레트·크기 입력을 그린다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const dialog = document.querySelector("[data-testid='structure-kit-editor']");
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-canvas']")).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-palette']")).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-width']")).not.toBeNull();
    expect(dialog!.querySelector("[data-testid='structure-kit-editor-height']")).not.toBeNull();
  });

  it("캔버스에 pointerdown 핸들러가 실제로 붙어 있다", () => {
    // 인스펙터가 "드래그하면 부위가 붙습니다"라고 거짓으로 약속하던 그 동작을,
    // 약속한 자리가 아니라 실제로 되는 자리에 만들었는지 못을 박는다.
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']");
    expect(canvas).not.toBeNull();
    expect((canvas as unknown as FakeElement).hasListener("pointerdown")).toBe(true);
  });

  it("팔레트에서 타일을 고르고 칸을 누르면 store 에 반영된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const swatch = document.querySelector("[data-testid='structure-kit-editor-tile-421']");
    expect(swatch).not.toBeNull();
    (swatch as unknown as FakeElement).click();

    // fakeDom 의 getBoundingClientRect() 는 전부 0 이라 (0,0) 칸이 눌린다.
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']")!;
    (canvas as unknown as FakeElement).dispatchEvent(
      Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }),
    );

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.rows[0]!.tiles[0]).toBe(421);
  });
});
```

`FakeElement` 에 `hasListener` 가 없으므로 `test/fakeDom.ts` 에 더한다 (`addEventListener` 바로 아래):

```ts
  /** 테스트 편의: 이 요소에 해당 종류의 리스너가 붙었는지. */
  hasListener(type: string): boolean {
    return (this.listeners[type]?.length ?? 0) > 0;
  }
```

- [ ] **Step 6: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: FAIL — `openStructureKitEditor` 가 없다

- [ ] **Step 7: 다이얼로그를 구현한다**

`src/editor/panels/structureKitEditorDialog.ts` 를 만든다:

```ts
// panels/structureKitEditorDialog.ts
// 구조물 편집기 — DB 모달 위에 뜨는 전용 다이얼로그.
//
// 왜 인스펙터가 아니라 다이얼로그인가:
//   인스펙터 열은 harness-suggestion.css:297 에서 width:352px 고정이고, 패딩을 빼면 324px 다.
//   내장 집 9×8 을 scale 3 으로 그리면 432px 라 들어가지 않는다. 타일 팔레트를 둘 자리는 더 없다.
//
// 저장 버튼이 없는 이유:
//   모든 편집은 store.update() 로 즉시 반영되고, DB 모달을 취소하면
//   createDatabaseModalDirtySession 이 세션 전체를 롤백한다. 이 모달의 기존 규약이다.
//   (같은 이유로 아무것도 저장하지 않던 인스펙터의 [지금 저장] 버튼을 없앴다.)
//
// 타일 팔레트로 renderTilePalette() 를 쓰지 않는 이유:
//   그 함수는 editorState 의 전역 브러시를 바꾼다 — 구조물 편집 중 타일을 고르면
//   맵 붓까지 같이 바뀐다. 순수 헬퍼 tilesetTileBackgroundStyle 로 격자를 직접 그린다.

import { TILE_SIZE } from "@/assets/bundled";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { replaceStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import {
  cellAtPoint,
  paintCell,
  type KitLayer,
} from "@/editor/harnessSuggestion/structureKitRasterModel";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { SectionStructureKitDef, TilesetDef, TilesetId } from "@/project/types";
import { el } from "@/util/dom";

/** 캔버스 영역이 감당하는 최대 폭(px). 다이얼로그 본문 폭에서 팔레트 열을 뺀 값. */
const CANVAS_VIEWPORT_PX = 520;

type EditorTool = "paint" | "erase" | "part";

interface EditorSession {
  tilesetId: TilesetId;
  kitId: string;
  tool: EditorTool;
  layer: KitLayer;
  tile: number;
}

export function openStructureKitEditor(tilesetId: TilesetId, kitId: string, onClosed: () => void): void {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const kit = findKit(tilesetId, kitId);
  if (!tileset || !kit) return;

  const session: EditorSession = {
    tilesetId,
    kitId,
    tool: "paint",
    layer: "lower",
    tile: TILE.GRASS,
  };

  const canvasWrap = el("div", {
    class: "structure-kit-editor-canvas-wrap",
    dataset: { testid: "structure-kit-editor-canvas" },
  });
  const paletteWrap = el("div", {
    class: "structure-kit-editor-palette",
    dataset: { testid: "structure-kit-editor-palette" },
  });
  const sizeWrap = el("div", { class: "structure-kit-editor-size" });

  const redraw = (): void => {
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) return;
    drawCanvas(canvasWrap, tileset, current, session);
    drawPalette(paletteWrap, tileset, session, redraw);
    drawSize(sizeWrap, current, redraw, session);
  };

  canvasWrap.addEventListener("pointerdown", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) return;
    // rect·scale 은 여기서 읽어 순수 함수에 넘긴다 — 함수 안에서 DOM 을 읽으면
    // fakeDom(getBoundingClientRect 전부 0)에서 테스트가 무의미해진다.
    const rect = canvasWrap.getBoundingClientRect();
    const scale = canvasScale(current.width);
    const cell = cellAtPoint(rect, scale, pointer.clientX, pointer.clientY, current);
    if (!cell) return;
    const tile = session.tool === "erase" ? TILE.EMPTY : session.tile;
    replaceStructureKit(session.tilesetId, paintCell(current, cell.cx, cell.cy, session.layer, tile));
    redraw();
  });

  redraw();

  openDialog(
    "structure-kit-editor",
    `${kit.name ?? "구조물"} 편집`,
    [
      el("div", {
        class: "structure-kit-editor-grid",
        children: [
          el("div", { class: "structure-kit-editor-left", children: [canvasWrap, sizeWrap] }),
          el("div", { class: "structure-kit-editor-right", children: [toolRow(session, redraw), paletteWrap] }),
        ],
      }),
    ],
    [{ label: "닫기", testid: "structure-kit-editor-close", action: onClosed }],
  );
}

/** 폭에 맞춘 배율. 9×8 킷은 scale 3(432px)이 나온다. */
export function canvasScale(widthTiles: number): number {
  const raw = Math.floor(CANVAS_VIEWPORT_PX / (Math.max(1, widthTiles) * TILE_SIZE));
  return Math.min(4, Math.max(1, raw));
}

function findKit(tilesetId: TilesetId, kitId: string): SectionStructureKitDef | undefined {
  const kit = store.getCurrent().tilesets[tilesetId]?.structureKits?.find((candidate) => candidate.id === kitId);
  return kit?.kind === "section" ? kit : undefined;
}

function drawCanvas(
  host: HTMLElement,
  tileset: TilesetDef,
  kit: SectionStructureKitDef,
  session: EditorSession,
): void {
  const scale = canvasScale(kit.width);
  const cells = [];
  for (let y = 0; y < kit.height; y += 1) {
    for (let x = 0; x < kit.width; x += 1) {
      const lower = kit.rows[y]?.tiles[x] ?? TILE.EMPTY;
      const upper = kit.rows[y]?.upperTiles?.[x] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) cells.push({ dx: x, dy: y, layer: "lower" as const, tile: lower });
      if (upper !== TILE.EMPTY) cells.push({ dx: x, dy: y, layer: "upper" as const, tile: upper });
    }
  }
  const canvas = renderTileCellsToCanvas({
    tileset,
    widthTiles: kit.width,
    heightTiles: kit.height,
    cells,
    scale,
    backgroundTile: null,
  });
  canvas.className = `structure-kit-editor-canvas layer-${session.layer}`;
  host.replaceChildren(canvas);
}

function drawPalette(
  host: HTMLElement,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const swatches = [];
  for (let tile = 0; tile < tileset.count; tile += 1) {
    swatches.push(
      el("button", {
        class: `structure-kit-editor-swatch${tile === session.tile ? " active" : ""}`,
        attrs: { type: "button", style: tilesetTileBackgroundStyle(tileset, tile, 20), title: String(tile) },
        dataset: { testid: `structure-kit-editor-tile-${tile}` },
        on: {
          click: () => {
            session.tile = tile;
            session.tool = "paint";
            redraw();
          },
        },
      }),
    );
  }
  host.replaceChildren(...swatches);
}

function toolRow(session: EditorSession, redraw: () => void): HTMLElement {
  const button = (label: string, testid: string, active: boolean, onClick: () => void): HTMLElement =>
    el("button", {
      class: `btn small${active ? " primary" : ""}`,
      attrs: { type: "button" },
      text: label,
      dataset: { testid },
      on: { click: () => { onClick(); redraw(); } },
    });

  return el("div", {
    class: "structure-kit-editor-tools",
    children: [
      button("칠하기", "structure-kit-editor-tool-paint", session.tool === "paint", () => { session.tool = "paint"; }),
      button("지우기", "structure-kit-editor-tool-erase", session.tool === "erase", () => { session.tool = "erase"; }),
      button("하층", "structure-kit-editor-layer-lower", session.layer === "lower", () => { session.layer = "lower"; }),
      button("상층", "structure-kit-editor-layer-upper", session.layer === "upper", () => { session.layer = "upper"; }),
    ],
  });
}

function drawSize(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  redraw: () => void,
  session: EditorSession,
): void {
  // Task 10 이 이 자리에 실제 크기 조절을 채운다. 지금은 읽기 표시만 둔다.
  host.replaceChildren(
    el("span", { dataset: { testid: "structure-kit-editor-width" }, text: `폭 ${kit.width}` }),
    el("span", { dataset: { testid: "structure-kit-editor-height" }, text: `높이 ${kit.height}` }),
  );
  void redraw;
  void session;
}
```

- [ ] **Step 8: CSS 를 더한다**

`src/styles/editor/harness-suggestion.css` 끝에 추가한다:

```css
/* 구조물 편집기 다이얼로그 — 왼쪽 캔버스 + 오른쪽 도구·팔레트. */
.structure-kit-editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 16px;
  align-items: start;
}

.structure-kit-editor-canvas-wrap {
  position: relative;
  display: inline-block;
  background: #101318;
  border-radius: 8px;
  cursor: crosshair;
  touch-action: none;
}

.structure-kit-editor-canvas {
  display: block;
  image-rendering: pixelated;
}

.structure-kit-editor-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.structure-kit-editor-palette {
  display: grid;
  grid-template-columns: repeat(10, 20px);
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
  background: var(--bg-sunken, rgba(42, 37, 33, 0.06));
  border-radius: 6px;
}

.structure-kit-editor-swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 2px;
  background-repeat: no-repeat;
  cursor: pointer;
  image-rendering: pixelated;
}

.structure-kit-editor-swatch.active {
  border-color: var(--accent, #3B82F6);
  box-shadow: 0 0 0 1px var(--accent, #3B82F6);
}

.structure-kit-editor-size {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
}
```

- [ ] **Step 9: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: PASS (5 tests)

- [ ] **Step 10: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 11: 커밋**

```bash
git add src/editor/panels/structureKitEditorDialog.ts src/editor/harnessSuggestion/structureKitActions.ts src/styles/editor/harness-suggestion.css test/structureKitEditorDialog.test.ts test/fakeDom.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 래스터를 직접 칠할 수 있는 편집기를 연다

인스펙터 열은 352px 고정이라 9×8 킷(scale 3 → 432px)이 들어가지 않는다.
DB 모달 위 전용 다이얼로그로 캔버스와 타일 팔레트를 편다.

renderTilePalette() 를 재사용하지 않는다 — 그 함수는 editorState 의 전역 브러시를
바꿔서 구조물 편집 중 타일을 고르면 맵 붓까지 같이 바뀐다.

저장 버튼은 두지 않는다. 편집은 store.update() 로 즉시 반영되고 모달 취소가
세션을 롤백한다 — 방금 없앤 가짜 [지금 저장] 과 같은 오해를 새로 만들지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 크기 조절과 부위 드래그

**Files:**
- Modify: `src/editor/panels/structureKitEditorDialog.ts`
- Modify: `src/styles/editor/harness-suggestion.css`
- Test: `test/structureKitEditorDialog.test.ts`

**Interfaces:**
- Consumes: `resizeKit` (Task 5) · `addPart`, `removePart`, `updatePart`, `normalizeDragRect` (Task 6) · `randomUuid` (`@/util/id`)
- Produces: 없음(다이얼로그 내부 완결)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitEditorDialog.test.ts` 에 추가한다:

```ts
describe("편집기 크기 조절", () => {
  it("폭을 늘리면 store 의 킷이 넓어진다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const widthInput = document.querySelector("[data-testid='structure-kit-editor-width']") as unknown as FakeElement;
    expect(widthInput).not.toBeNull();
    (widthInput as unknown as HTMLInputElement).value = "5";
    widthInput.dispatchEvent(new Event("change"));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.width).toBe(5);
    expect(stored.rows[0]!.tiles).toHaveLength(5);
  });

  it("줄여서 부위가 잘리면 개수를 보고한다", () => {
    seedKit();
    replaceStructureKit(DEFAULT_TILESET_ID, {
      ...(store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
        .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef),
      parts: [{ id: "p_far", kind: "sign", dx: 2, dy: 2, w: 1, h: 1 }],
    });
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    const widthInput = document.querySelector("[data-testid='structure-kit-editor-width']") as unknown as FakeElement;
    (widthInput as unknown as HTMLInputElement).value = "1";
    widthInput.dispatchEvent(new Event("change"));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.width).toBe(1);
    expect(stored.parts ?? []).toHaveLength(0);
  });
});

describe("편집기 부위 편집", () => {
  it("부위 도구로 캔버스를 누르고 떼면 부위가 생긴다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();

    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts ?? []).toHaveLength(1);
    expect(stored.parts![0]!.kind).toBe("entrance");
    expect(stored.parts![0]!.dx).toBe(0);
    expect(stored.parts![0]!.dy).toBe(0);
  });

  it("부위 목록에서 종류를 바꾸고 지울 수 있다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});

    (document.querySelector("[data-testid='structure-kit-editor-tool-part']") as unknown as FakeElement).click();
    const canvas = document.querySelector("[data-testid='structure-kit-editor-canvas']") as unknown as FakeElement;
    canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 1, clientY: 1, button: 0 }));
    canvas.dispatchEvent(Object.assign(new Event("pointerup"), { clientX: 1, clientY: 1, button: 0 }));

    const partId = (store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef).parts![0]!.id;

    const kindSelect = document.querySelector(`[data-testid='structure-kit-editor-part-kind-${partId}']`) as unknown as FakeElement;
    expect(kindSelect).not.toBeNull();
    (kindSelect as unknown as HTMLSelectElement).value = "window";
    kindSelect.dispatchEvent(new Event("change"));

    let stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts![0]!.kind).toBe("window");

    (document.querySelector(`[data-testid='structure-kit-editor-part-delete-${partId}']`) as unknown as FakeElement).click();

    stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.parts ?? []).toHaveLength(0);
  });
});
```

`replaceStructureKit` 을 이 파일 import 에 이미 넣었으므로 추가 import 는 필요 없다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: FAIL — `structure-kit-editor-tool-part` 가 없고, width 가 `<span>` 이라 `change` 가 아무 일도 하지 않는다

- [ ] **Step 3: 부위 도구를 도구 줄에 더한다**

`toolRow` 의 children 배열 끝에 추가한다:

```ts
      button("부위 그리기", "structure-kit-editor-tool-part", session.tool === "part", () => { session.tool = "part"; }),
```

- [ ] **Step 4: `drawSize` 를 진짜 입력으로 바꾼다**

`drawSize` 를 통째로 교체한다:

```ts
function drawSize(host: HTMLElement, kit: SectionStructureKitDef, redraw: () => void, session: EditorSession): void {
  const field = (
    label: string,
    testid: string,
    value: number,
    apply: (next: number) => { width: number; height: number },
  ): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-size-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "number", min: "1", max: "64" },
          value: String(value),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLInputElement)) return;
              const current = findKit(session.tilesetId, session.kitId);
              if (!current) return;
              const next = apply(Number(target.value));
              const result = resizeKit(current, next.width, next.height);
              replaceStructureKit(session.tilesetId, result.kit);
              if (result.clamped > 0 || result.dropped > 0) {
                // 조용히 지우지 않는다 — 사용자가 입구가 사라진 걸 나중에야 알게 하면 안 된다.
                const parts = [
                  result.clamped > 0 ? `부위 ${result.clamped}개 잘림` : "",
                  result.dropped > 0 ? `${result.dropped}개 삭제` : "",
                ].filter(Boolean);
                toast(parts.join(", "), "info");
              }
              redraw();
            },
          },
        }),
      ],
    });

  host.replaceChildren(
    field("폭", "structure-kit-editor-width", kit.width, (value) => ({ width: value, height: kit.height })),
    field("높이", "structure-kit-editor-height", kit.height, (value) => ({ width: kit.width, height: value })),
  );
}
```

import 에 `resizeKit` 과 `toast` 를 더한다.

- [ ] **Step 5: 캔버스 포인터 처리에 부위 드래그를 더한다**

`canvasWrap.addEventListener("pointerdown", ...)` 를 교체하고 `pointerup` 을 더한다:

```ts
  let dragStart: { readonly cx: number; readonly cy: number } | null = null;

  const cellFromEvent = (event: PointerEvent, kit: SectionStructureKitDef) =>
    cellAtPoint(canvasWrap.getBoundingClientRect(), canvasScale(kit.width), event.clientX, event.clientY, kit);

  canvasWrap.addEventListener("pointerdown", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) return;
    const cell = cellFromEvent(pointer, current);
    if (!cell) return;

    if (session.tool === "part") {
      dragStart = cell;
      return;
    }
    const tile = session.tool === "erase" ? TILE.EMPTY : session.tile;
    replaceStructureKit(session.tilesetId, paintCell(current, cell.cx, cell.cy, session.layer, tile));
    redraw();
  });

  canvasWrap.addEventListener("pointerup", (event) => {
    if (session.tool !== "part" || !dragStart) return;
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) {
      dragStart = null;
      return;
    }
    const end = cellFromEvent(event as PointerEvent, current) ?? dragStart;
    // 새 부위의 기본 종류는 입구다 — 워프를 놓을 자리를 지정하는 것이 가장 잦은 용도다.
    replaceStructureKit(
      session.tilesetId,
      addPart(current, normalizeDragRect(dragStart, end), "entrance", `pt_${randomUuid()}`),
    );
    dragStart = null;
    redraw();
  });
```

import 에 `addPart`, `normalizeDragRect`, `randomUuid` 를 더한다.

- [ ] **Step 6: 부위 목록 패널을 더한다**

`openStructureKitEditor` 안에 `partsWrap` 을 만들고 `redraw` 에서 갱신한다:

```ts
  const partsWrap = el("div", {
    class: "structure-kit-editor-parts",
    dataset: { testid: "structure-kit-editor-parts" },
  });
```

`redraw` 본문 끝에 `drawParts(partsWrap, current, session, redraw);` 를 더하고, `structure-kit-editor-right` 의 children 끝에 `partsWrap` 을 붙인다.

그리고 파일 끝에 추가한다:

```ts
const PART_KIND_OPTIONS: readonly { readonly value: StructureKitPartKind; readonly label: string }[] = [
  { value: "entrance", label: "입구" },
  { value: "window", label: "창문" },
  { value: "sign", label: "간판" },
  { value: "anchor", label: "자리" },
];

function drawParts(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const parts = kit.parts ?? [];
  const rows: HTMLElement[] = [
    el("div", { class: "structure-kit-editor-parts-title", text: `부위 (${parts.length})` }),
  ];

  if (parts.length === 0) {
    rows.push(
      el("p", {
        class: "structure-kit-quiet",
        text: "[부위 그리기]로 캔버스를 끌면 입구·창문 자리가 생깁니다.",
      }),
    );
  }

  parts.forEach((part, index) => {
    const select = el("select", {
      dataset: { testid: `structure-kit-editor-part-kind-${part.id}` },
      children: PART_KIND_OPTIONS.map((option) =>
        el("option", {
          attrs: part.kind === option.value ? { value: option.value, selected: "" } : { value: option.value },
          text: option.label,
        }),
      ),
      on: {
        change: (event: Event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLSelectElement)) return;
          const current = findKit(session.tilesetId, session.kitId);
          if (!current) return;
          replaceStructureKit(
            session.tilesetId,
            updatePart(current, part.id, { kind: target.value as StructureKitPartKind }),
          );
          redraw();
        },
      },
    });

    rows.push(
      el("div", {
        class: "structure-kit-editor-part-row",
        children: [
          el("span", { class: "structure-kit-editor-part-index", text: String(index + 1) }),
          select,
          el("span", {
            class: "structure-kit-editor-part-range",
            text: `(${part.dx},${part.dy}) ${part.w}×${part.h}`,
          }),
          el("button", {
            class: "btn small ghost",
            attrs: { type: "button" },
            text: "삭제",
            dataset: { testid: `structure-kit-editor-part-delete-${part.id}` },
            on: {
              click: () => {
                const current = findKit(session.tilesetId, session.kitId);
                if (!current) return;
                replaceStructureKit(session.tilesetId, removePart(current, part.id));
                redraw();
              },
            },
          }),
        ],
      }),
    );
  });

  host.replaceChildren(...rows);
}
```

import 에 `removePart`, `updatePart`, `StructureKitPartKind` 를 더한다.

- [ ] **Step 7: CSS 를 더한다**

`harness-suggestion.css` 에 추가한다:

```css
.structure-kit-editor-size-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.structure-kit-editor-size-field input {
  width: 56px;
}

.structure-kit-editor-parts {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.structure-kit-editor-parts-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1, #2A2521);
}

.structure-kit-editor-part-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.structure-kit-editor-part-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent, #3B82F6);
  color: #fff;
  font-size: 11px;
  flex: none;
}

.structure-kit-editor-part-range {
  color: var(--text-3, #6B6259);
  margin-left: auto;
}
```

- [ ] **Step 8: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: PASS (9 tests)

- [ ] **Step 9: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 10: 커밋**

```bash
git add src/editor/panels/structureKitEditorDialog.ts src/styles/editor/harness-suggestion.css test/structureKitEditorDialog.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 크기 조절과 부위 드래그를 연다

인스펙터가 "드래그하면 부위가 붙습니다"라고 거짓으로 약속하던 동작을,
약속한 자리가 아니라 실제로 되는 자리에 만든다.

부위는 stamp_structure_kit 이 절대좌표로 변환해 AI 에게 돌려주는 값이라,
사람이 워프 자리를 지정할 수 있어야 AI 가 그 자리에 이벤트를 심는다.

크기를 줄여 부위가 잘리면 몇 개가 잘리고 지워졌는지 토스트로 보고한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 신규 · 복제 진입점

**Files:**
- Modify: `src/editor/harnessSuggestion/structureKitActions.ts`
- Modify: `src/editor/panels/structureKitInspector.ts`
- Modify: `src/editor/panels/structureKitDbTab.ts` (도구줄)
- Test: `test/structureKitDbTab.test.ts`

**Interfaces:**
- Consumes: `bakeStructureKit`, `bakeInteriorObject`, `copyName` (Task 7) · `openStructureKitEditor` (Task 9)
- Produces:
  - `createBlankStructureKit(tilesetId: TilesetId): SectionStructureKitDef`
  - `duplicateIntoTileset(tilesetId: TilesetId, source: StructureKitDef | InteriorObjectDef): SectionStructureKitDef`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitDbTab.test.ts` 에 새 describe 를 더한다. import 에 `INTERIOR_ROOM_TILESET_ID` 와 `INTERIOR_OBJECT_CATALOG` 는 이미 있다.

```ts
describe("structureKitDbTab 신규·복제", () => {
  it("도구줄에 [+ 새 구조물]과 힌트칩 제거가 반영된다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    expect(host.querySelector("[data-testid='structure-kit-new']")).not.toBeNull();
    // 힌트칩의 문구는 빈 상태 안내에 이미 똑같이 있어 중복이었다.
    expect(host.querySelector(".structure-kit-hint-chip")).toBeNull();
  });

  it("내장 킷 인스펙터의 [내 구조물로 복제]가 section 사본을 만든다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});
    host.querySelector("[data-testid='structure-kit-db-kit_house_blue-stone']")!.click();

    const dup = host.querySelector("[data-testid='structure-kit-duplicate-kit_house_blue-stone']");
    expect(dup).not.toBeNull();
    dup!.click();

    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    expect(kits[0]!.kind).toBe("section");
    expect(kits[0]!.learnedFrom).toBe("db-authored");
    expect(kits[0]!.name).toContain("사본");
  });

  it("실내 오브젝트 인스펙터에도 복제가 있다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${INTERIOR_ROOM_TILESET_ID}']`)!.click();

    const first = INTERIOR_OBJECT_CATALOG[0]!;
    host.querySelector(`[data-testid='structure-kit-object-${first.id}']`)!.click();

    const dup = host.querySelector(`[data-testid='structure-kit-duplicate-${first.id}']`);
    expect(dup).not.toBeNull();
    dup!.click();

    const kits = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    expect(kits[0]!.kind).toBe("section");
    expect(kits[0]!.width).toBe(first.width);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: FAIL — `structure-kit-new` · `structure-kit-duplicate-*` 가 없다

- [ ] **Step 3: store 접점 두 개를 더한다**

`src/editor/harnessSuggestion/structureKitActions.ts` 에 추가한다:

```ts
/** DB 편집기: 빈 3×3 킷을 만들어 등록하고 돌려준다. */
export function createBlankStructureKit(tilesetId: TilesetId): SectionStructureKitDef {
  const kit: SectionStructureKitDef = {
    id: `kit_${randomUuid()}`,
    kind: "section",
    name: "새 구조물",
    width: 3,
    height: 3,
    rows: [
      { tiles: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY] },
      { tiles: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY] },
      { tiles: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY] },
    ],
    learnedFrom: "db-authored",
    createdAt: new Date().toISOString(),
  };
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  });
  return kit;
}

/**
 * DB 편집기: 어떤 원본이든 section 사본으로 굳혀 이 타일셋에 등록한다.
 * registerStructureKit 의 서명 중복 차단을 쓰지 않는다 — 복제는 "같은 모양을 하나 더" 가 의도다.
 */
export function duplicateIntoTileset(
  tilesetId: TilesetId,
  source: StructureKitDef | InteriorObjectDef,
): SectionStructureKitDef {
  const existingNames = (store.getCurrent().tilesets[tilesetId]?.structureKits ?? [])
    .map((kit) => kit.name ?? "구조물");
  const id = `kit_${randomUuid()}`;
  const kit = "cells" in source
    ? bakeInteriorObject(source, id, copyName(source.label, existingNames))
    : bakeStructureKit(source, id, copyName(source.name ?? "구조물", existingNames));
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  });
  return kit;
}
```

import 에 `bakeInteriorObject`, `bakeStructureKit`, `copyName`(rasterModel), `InteriorObjectDef`, `SectionStructureKitDef`, `TILE` 를 더한다.

- [ ] **Step 4: 인스펙터에 복제·편집 버튼을 붙인다**

`structureKitInspector.ts` 의 `renderInspector` 액션 배열을, 편집 가능 여부에 따라 이렇게 구성한다. 기존 `삭제`/`팔레트에서 쓰기` 항목은 유지하고 앞에 두 개를 더한다:

```ts
  const actions = el("div", {
    class: "structure-kit-actions",
    children: [
      ...(editable
        ? [
            el("button", {
              class: "btn primary",
              attrs: { type: "button" },
              text: "편집",
              dataset: { testid: `structure-kit-edit-${kit.id}` },
              on: {
                click: () => {
                  openStructureKitEditor(tileset.id, kit.id, () => {
                    rerender();
                    refresh();
                  });
                },
              },
            }),
          ]
        : []),
      el("button", {
        class: editable ? "btn" : "btn primary",
        attrs: { type: "button" },
        text: editable ? "복제" : "내 구조물로 복제",
        dataset: { testid: `structure-kit-duplicate-${kit.id}` },
        on: {
          click: () => {
            const copy = duplicateIntoTileset(tileset.id, kit);
            toast(`'${copy.name}' 을 만들었습니다`, "ok");
            rerender();
            refresh();
          },
        },
      }),
      ...(editable
        ? [
            el("button", {
              class: "btn ghost structure-kit-delete",
              attrs: { type: "button" },
              text: "삭제",
              dataset: { testid: `structure-kit-db-delete-${kit.id}` },
              on: {
                click: () => {
                  deleteStructureKit(tileset.id, kit.id);
                  toast(`'${kit.name ?? "구조물"}' 삭제`, "info");
                  setInspectorSelectedPartId(null);
                  rerender();
                  refresh();
                },
              },
            }),
          ]
        : []),
      el("button", {
        class: "btn",
        attrs: { type: "button" },
        text: "팔레트에서 쓰기",
        dataset: { testid: `structure-kit-db-use-${kit.id}` },
        on: {
          click: () => {
            editorState.set({ activePaletteStamp: paletteStampFromKit(kit), tool: "paint" });
            toast(`'${kit.name ?? "구조물"}'을 브러시로 선택했습니다`, "ok");
          },
        },
      }),
    ],
  });
```

기존 삭제 버튼이 하던 `session.selectedKitId = null` 은 탭 세션이라 인스펙터에서 손댈 수 없다. 삭제 후 `refresh()` 가 실행되면 탭이 선택 유효성을 다시 검사해 첫 행으로 되돌리므로 그대로 두면 된다(`structureKitDbTab.ts:87-92`).

`renderObjectInspector` 의 액션 줄에도 복제를 더한다. 실내 오브젝트 사본은 카탈로그 문법을 잃으므로 그 사실을 함께 알린다:

```ts
          el("button", {
            class: "btn primary",
            attrs: { type: "button" },
            text: "내 구조물로 복제",
            dataset: { testid: `structure-kit-duplicate-${object.id}` },
            on: {
              click: () => {
                const copy = duplicateIntoTileset(tileset.id, object);
                toast(`'${copy.name}' — 사본은 그림만 가져옵니다. AI 실내 방 채우기는 원본 카탈로그만 씁니다.`, "info");
              },
            },
          }),
```

`renderObjectInspector` 는 지금 `rerender`/`refresh` 를 받지 않으므로 시그니처를 `renderObjectInspector(tileset, object, refresh, rerender)` 로 늘리고, 복제 뒤 `rerender(); refresh();` 를 부른다. 탭의 호출부도 맞춘다.

import 에 `duplicateIntoTileset`, `openStructureKitEditor` 를 더한다.

- [ ] **Step 5: 도구줄에서 힌트칩을 버튼으로 바꾼다**

`structureKitDbTab.ts` 의 `tools` 정의에서 `structure-kit-hint-chip` 블록을 지우고 버튼을 넣는다:

```ts
      el("button", {
        class: "btn small primary",
        attrs: { type: "button" },
        text: "+ 새 구조물",
        dataset: { testid: "structure-kit-new" },
        on: {
          click: () => {
            if (!session.tilesetId) return;
            const kit = createBlankStructureKit(session.tilesetId);
            session.selectedKitId = kit.id;
            session.selectedObjectId = null;
            rerender();
            refresh(host, rerender);
            openStructureKitEditor(session.tilesetId, kit.id, () => {
              rerender();
              refresh(host, rerender);
            });
          },
        },
      }),
```

import 에 `createBlankStructureKit`, `openStructureKitEditor` 를 더한다.

- [ ] **Step 6: 행 더블클릭으로 편집기를 연다**

표의 킷 행(`el("tr", ...)`)의 `on` 에 더한다. 읽기 전용 행에서는 열지 않는다:

```ts
          dblclick: () => {
            if (entry.source !== "user") return;
            openStructureKitEditor(activeTileset!.id, kit.id, () => {
              rerender();
              refresh(host, rerender);
            });
          },
```

- [ ] **Step 7: `+ 새 구조물` 에 시작점 선택을 붙인다**

빈 3×3 만으로는 집 한 채를 손으로 다 그려야 한다. 이미 있는 집 킷 전개를 재사용해 시작점을 하나 더 준다. 집 킷은 `combined_town` 문법이므로 **그 앨범에서만** 이 갈래를 노출한다.

`structureKitActions.ts` 에 추가한다:

```ts
/**
 * 집 킷 한 채를 전개해 굳힌 새 구조물.
 * 파라메트릭 시공은 build_house_kit 의 일이고, 여기서는 그 결과를 편집 시작점으로만 빌린다.
 */
export function createStructureKitFromHouse(
  tilesetId: TilesetId,
  houseKitId: string,
  size: { readonly width: number; readonly height: number },
): SectionStructureKitDef {
  const existingNames = (store.getCurrent().tilesets[tilesetId]?.structureKits ?? [])
    .map((kit) => kit.name ?? "구조물");
  const source: HouseStructureKitDef = {
    id: `kit_seed_${randomUuid()}`,
    kind: "house",
    name: HOUSE_KITS[houseKitId as keyof typeof HOUSE_KITS]?.name ?? "집",
    houseKitId,
    wings: [{ x: 0, y: 0, w: Math.max(3, size.width), h: Math.max(5, size.height) }],
    chimney: true,
    learnedFrom: "builtin-parametric",
  };
  const kit = bakeStructureKit(source, `kit_${randomUuid()}`, copyName(source.name ?? "집", existingNames));
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), structuredClone(kit)];
  });
  return kit;
}
```

import 에 `HOUSE_KITS`(`@/editor/houseKit`)와 `HouseStructureKitDef` 를 더한다.

도구줄의 `+ 새 구조물` 클릭 핸들러를, 앨범이 `DEFAULT_TILESET_ID` 일 때만 갈래를 묻도록 바꾼다:

```ts
          click: () => {
            const tilesetId = session.tilesetId;
            if (!tilesetId) return;
            const openEditorFor = (kitId: string): void => {
              session.selectedKitId = kitId;
              session.selectedObjectId = null;
              rerender();
              refresh(host, rerender);
              openStructureKitEditor(tilesetId, kitId, () => {
                rerender();
                refresh(host, rerender);
              });
            };
            if (tilesetId !== DEFAULT_TILESET_ID) {
              openEditorFor(createBlankStructureKit(tilesetId).id);
              return;
            }
            openNewStructureKitDialog(tilesetId, openEditorFor);
          },
```

`openNewStructureKitDialog` 는 `structureKitEditorDialog.ts` 에 둔다:

```ts
/** 시작점 선택 — 빈 칸이냐, 집 한 채냐. 집 갈래는 combined_town 앨범에서만 열린다. */
export function openNewStructureKitDialog(tilesetId: TilesetId, onCreated: (kitId: string) => void): void {
  let houseKitId = PUBLIC_HOUSE_KIT_IDS[0]!;
  let width = 9;
  let height = 8;

  const kitSelect = el("select", {
    dataset: { testid: "structure-kit-new-house-kit" },
    children: PUBLIC_HOUSE_KIT_IDS.map((id) =>
      el("option", { attrs: { value: id }, text: HOUSE_KITS[id]?.name ?? id }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (target instanceof HTMLSelectElement) houseKitId = target.value;
      },
    },
  });

  const numberField = (label: string, testid: string, value: number, apply: (next: number) => void): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-size-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "number", min: "3", max: "32" },
          value: String(value),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (target instanceof HTMLInputElement) apply(Number(target.value));
            },
          },
        }),
      ],
    });

  openDialog(
    "structure-kit-new",
    "새 구조물",
    [
      el("p", { class: "structure-kit-quiet", text: "빈 칸에서 시작하거나, 집 한 채를 놓고 고쳐 나갈 수 있습니다." }),
      el("div", {
        class: "structure-kit-new-house",
        children: [kitSelect, numberField("폭", "structure-kit-new-width", width, (n) => { width = n; }),
          numberField("높이", "structure-kit-new-height", height, (n) => { height = n; })],
      }),
    ],
    [
      {
        label: "빈 3×3 으로 시작",
        testid: "structure-kit-new-blank",
        action: () => onCreated(createBlankStructureKit(tilesetId).id),
      },
      {
        label: "이 집으로 시작",
        testid: "structure-kit-new-house-confirm",
        action: () => onCreated(createStructureKitFromHouse(tilesetId, houseKitId, { width, height }).id),
      },
      { label: "취소", testid: "structure-kit-new-cancel" },
    ],
  );
}
```

import 은 **두 곳에서 온다** — 이름이 비슷한 상수가 여러 파일에 있으니 정확히 맞춘다:

```ts
import { HOUSE_KITS } from "@/editor/houseKit";                    // Record<HouseKitId, HouseKit> — .name 을 읽는다
import { PUBLIC_HOUSE_KIT_IDS } from "@/editor/tools/houseKitDomain";
import { createBlankStructureKit, createStructureKitFromHouse } from "@/editor/harnessSuggestion/structureKitActions";
```

`@/editor/tools/village/constants` 에도 `HOUSE_KITS` 라는 이름이 있지만 그것은 `readonly HouseKitId[]` 배열로 다른 것이다. `@/editor/houseKit` 쪽을 써야 `.name` 이 있다.

테스트를 Step 1 의 describe 에 더한다:

```ts
  it("combined_town 앨범에서 [+ 새 구조물]은 시작점을 묻는다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`)!.click();
    host.querySelector("[data-testid='structure-kit-new']")!.click();

    expect(document.querySelector("[data-testid='structure-kit-new']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-new-blank']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-new-house-confirm']")).not.toBeNull();
  });

  it("[이 집으로 시작]이 section 킷을 만든다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});
    host.querySelector(`[data-testid='structure-kit-tileset-${DEFAULT_TILESET_ID}']`)!.click();
    host.querySelector("[data-testid='structure-kit-new']")!.click();
    (document.querySelector("[data-testid='structure-kit-new-house-confirm']") as unknown as FakeElement).click();

    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits ?? [];
    expect(kits).toHaveLength(1);
    expect(kits[0]!.kind).toBe("section");
    expect(kits[0]!.learnedFrom).toBe("db-authored");
    // 빈 껍데기가 아니라 실제 타일이 들어 있어야 한다.
    const painted = (kits[0] as SectionStructureKitDef).rows.some((row) => row.tiles.some((tile) => tile !== -1));
    expect(painted).toBe(true);
  });
```

테스트 파일 import 에 `SectionStructureKitDef` 타입을 더한다(`store` 와 `DEFAULT_TILESET_ID` 는 이미 있다).

- [ ] **Step 8: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts test/structureKitEditorDialog.test.ts`

Expected: PASS (22 + 9 tests)

- [ ] **Step 9: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 10: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitActions.ts src/editor/panels/structureKitInspector.ts src/editor/panels/structureKitDbTab.ts test/structureKitDbTab.test.ts
git commit -m "$(cat <<'EOF'
feat(database): DB 안에서 구조물을 새로 만들고 복제한다

구조물을 만드는 길이 "맵에서 영역 선택 → 구조물로 저장" 하나뿐이었다.
내장 건물과 실내 오브젝트는 코드 상수라 편집의 출발점이 될 수도 없었다.

어느 행이든 복제하면 section 사본이 내 구조물로 들어와 편집 대상이 되고,
원본 카탈로그는 불변으로 남는다. 실내 오브젝트 사본은 role·snap·themes 를
잃으므로 복제 시 그 사실을 알린다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# 4단계 — AI 메타

**5단계보다 먼저여야 한다.** 파일 포맷이 `ai` 필드를 담으므로, 타입이 먼저 굳지 않으면 포맷 v1 을 내보낸 직후 v2 로 올려야 한다.

## Task 12: `repeatability` 를 시공 동작에 반영

`structureKitTools.ts:236` 에서 `repeat` 기본값이 3 이고, `structureKitModel.ts:158` 은 `kind === "section"` 이면 무조건 반복 가능이라고 답한다. 내가 저장한 구조물은 전부 `section` 이므로 **우물·간판·동상도 가로로 3개 이어 찍힌다.**

**Files:**
- Modify: `src/editor/harnessSuggestion/structureKitModel.ts:157-160`
- Test: `test/structureKitTools.test.ts`

**Interfaces:**
- Produces: `structureKitRepeatable(kit)` 가 `kit.ai?.repeatability` 를 우선한다 (시그니처 불변)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitTools.test.ts` 에 추가한다. 이 파일은 `store` 를 쓰지 않고 `createEmptyToolProject` + `runTool({ project }, name, args)` 로 자체 프로젝트를 만든다 — 그 관행을 그대로 따른다.

```ts
// 폭 2, 높이 1 짜리 최소 킷 — repeat 동작만 본다.
function projectWithRepeatKit(ai: StructureKitDef["ai"]): { project: Project; mapId: string } {
  const project = createEmptyToolProject("반복 테스트");
  const context = { project };
  runTool(context, "create_map", { name: "반복맵", width: 20, height: 15 });
  const mapId = Object.keys(context.project.maps)[0]!;
  const tilesetId = context.project.maps[mapId]!.tilesetId;
  context.project.tilesets[tilesetId]!.structureKits = [{
    id: "kit_repeat_test",
    kind: "section",
    name: "반복 킷",
    width: 2,
    height: 1,
    rows: [{ tiles: [421, 421] }],
    learnedFrom: "db-authored",
    ...(ai ? { ai } : {}),
  }];
  return { project: context.project, mapId };
}

describe("repeatability — 한 채 완결 구조물이 3개씩 찍히지 않는다", () => {
  it("fixed 인 킷은 repeat 를 줘도 1회만 찍는다", () => {
    // 우물·간판처럼 한 채로 완결인 구조물. repeat 기본값 3 때문에 3개가 찍히던 문제.
    const { project, mapId } = projectWithRepeatKit({
      description: "돌 우물",
      placementRules: "광장 중앙",
      repeatability: "fixed",
    });
    const context = { project };

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_repeat_test",
      origin: { x: 0, y: 0 },
      repeat: 5,
    });
    expect(result.ok).toBe(true);

    const map = context.project.maps[mapId]!;
    expect(map.lowerTiles[0]).toBe(421);
    expect(map.lowerTiles[1]).toBe(421);
    // 폭 2 킷이 1회만 찍혔다면 x=2 는 원래 타일 그대로다.
    expect(map.lowerTiles[2]).not.toBe(421);
  });

  it("repeat 인 킷은 repeat 를 그대로 따른다", () => {
    const { project, mapId } = projectWithRepeatKit({
      description: "나무 울타리",
      placementRules: "마당 둘레",
      repeatability: "repeat",
    });
    const context = { project };

    runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_repeat_test", origin: { x: 0, y: 0 }, repeat: 3,
    });
    expect(context.project.maps[mapId]!.lowerTiles[4]).toBe(421);
  });

  it("ai 가 없으면 기존 동작(section 은 반복)을 유지한다", () => {
    const { project, mapId } = projectWithRepeatKit(undefined);
    const context = { project };

    runTool(context, "stamp_structure_kit", {
      mapId, kitId: "kit_repeat_test", origin: { x: 0, y: 0 }, repeat: 3,
    });
    expect(context.project.maps[mapId]!.lowerTiles[4]).toBe(421);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitTools.test.ts`

Expected: FAIL — 첫 번째 테스트에서 `map.lowerTiles[2]` 가 421 이다 (우물이 3개 찍혔다)

- [ ] **Step 3: 판정에 `ai.repeatability` 를 우선시킨다**

`src/editor/harnessSuggestion/structureKitModel.ts:157-160` 을 바꾼다:

```ts
/**
 * 반복(가로 이어 찍기) 가능 여부.
 * ai.repeatability 가 있으면 그것이 정본 — 사람이 "한 채 완결"이라 표시한 우물·간판을
 * stamp_structure_kit 의 repeat 기본값 3 이 3개로 늘리는 것을 막는다.
 * 없으면 기존 동작(section 은 반복, house 는 한 채) 유지 — 하위 호환.
 */
export function structureKitRepeatable(kit: StructureKitDef): boolean {
  if (kit.ai?.repeatability === "fixed") return false;
  if (kit.ai?.repeatability === "repeat") return true;
  return kit.kind === "section";
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitTools.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitModel.ts test/structureKitTools.test.ts
git commit -m "$(cat <<'EOF'
fix(database): 한 채로 완결인 구조물이 3개씩 찍히지 않게 한다

stamp_structure_kit 의 repeat 기본값은 3 이고, structureKitRepeatable 은
kind === "section" 이면 무조건 반복 가능이라 답했다. 내가 저장한 구조물은
전부 section 이므로 우물·간판·동상도 가로로 3개 이어 찍혔다.

ai.repeatability 가 있으면 그것을 정본으로 삼고, 없으면 기존 동작을 유지한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: AI 가 받는 것에 설명·배치규칙을 싣는다

**Files:**
- Modify: `src/editor/tools/structureKitTools.ts:44-77` (`list_structure_kits` 응답)
- Modify: `src/ai/contextBuilder.ts:310-330` (`structureKitSection`)
- Test: `test/structureKitTools.test.ts`

**Interfaces:**
- Consumes: `StructureKitAiMeta` (Task 3), `structureKitRepeatable` (Task 12)
- Produces: `list_structure_kits` 응답 엔트리에 `ai?: StructureKitAiMeta`, `repeatable: boolean` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

이 파일은 `buildSystemPrompt` 를 이미 import 하고 있다(`test/structureKitTools.test.ts:3`).

```ts
// 설명·배치규칙까지 갖춘 우물 킷 — AI 가 "언제 쓸지" 판단할 근거를 전부 가진 상태.
function projectWithDescribedKit(): { project: Project; mapId: string } {
  const project = createEmptyToolProject("설명 테스트");
  const context = { project };
  runTool(context, "create_map", { name: "설명맵", width: 20, height: 15 });
  const mapId = Object.keys(context.project.maps)[0]!;
  const tilesetId = context.project.maps[mapId]!.tilesetId;
  context.project.tilesets[tilesetId]!.structureKits = [{
    id: "kit_well",
    kind: "section",
    name: "우물",
    width: 3,
    height: 3,
    rows: [{ tiles: [421, 421, 421] }, { tiles: [421, 421, 421] }, { tiles: [421, 421, 421] }],
    learnedFrom: "db-authored",
    ai: {
      description: "돌담을 두른 두레우물.",
      placementRules: "마을 광장 중앙. 물가·숲 금지.",
      tags: ["우물", "물"],
      role: "prop",
      repeatability: "fixed",
      origin: "user",
    },
  }];
  return { project: context.project, mapId };
}

describe("AI 가 받는 구조물 정보", () => {
  it("list_structure_kits 가 설명·배치규칙·반복여부를 넘긴다", () => {
    const { project, mapId } = projectWithDescribedKit();

    const result = runTool({ project }, "list_structure_kits", { mapId });
    expect(result.ok).toBe(true);

    const data = result.data as {
      kits: { kitId: string; ai?: { description: string; placementRules: string }; repeatable: boolean }[];
    };
    const entry = data.kits.find((kit) => kit.kitId === "kit_well")!;
    expect(entry.ai?.description).toBe("돌담을 두른 두레우물.");
    expect(entry.ai?.placementRules).toContain("물가·숲 금지");
    expect(entry.repeatable).toBe(false);
  });

  it("설명이 없는 킷은 ai 없이 그대로 실린다", () => {
    const { project, mapId } = projectWithKit(); // 기존 픽스처 — WALL_KIT 은 ai 가 없다
    const data = runTool({ project }, "list_structure_kits", { mapId }).data as {
      kits: { kitId: string; ai?: unknown; repeatable: boolean }[];
    };
    const wall = data.kits.find((kit) => kit.kitId === "kit_wall_test")!;
    expect(wall.ai).toBeUndefined();
    expect(wall.repeatable).toBe(true); // section 기본값 유지
  });

  it("시스템 프롬프트가 설명과 배치규칙을 싣는다", () => {
    const { project, mapId } = projectWithDescribedKit();
    const prompt = buildSystemPrompt(project, { currentMapId: mapId });

    expect(prompt).toContain("돌담을 두른 두레우물.");
    expect(prompt).toContain("마을 광장 중앙");
    expect(prompt).toContain("한 채 완결");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitTools.test.ts`

Expected: FAIL — `entry.ai` 가 `undefined`

- [ ] **Step 3: 도구 응답을 넓힌다**

`src/editor/tools/structureKitTools.ts` 의 `entries` 타입에 두 필드를 더한다:

```ts
      learnedFrom: string;
      /** 사람이 가르친 어휘 메타 — AI 가 "언제 쓸지"를 판단하는 유일한 근거. */
      ai?: StructureKitAiMeta;
      /** 가로로 이어 찍어도 되는지. false 면 repeat 인자가 무시된다. */
      repeatable: boolean;
```

그리고 `entries.push({...})` 에 더한다:

```ts
          learnedFrom: kit.learnedFrom,
          repeatable: structureKitRepeatable(kit),
          ...(kit.ai ? { ai: { ...kit.ai, ...(kit.ai.tags ? { tags: [...kit.ai.tags] } : {}) } } : {}),
```

`summary` 문자열도 반복 여부를 드러내게 고친다:

```ts
        : `구조 킷 ${entries.length}개: ${entries.map((entry) => `${entry.name}(${entry.kitId}, ${entry.width}x${entry.height}, ${entry.repeatable ? "반복" : "한 채 완결"})`).join(", ")}`,
```

import 에 `structureKitRepeatable` 과 `StructureKitAiMeta` 를 더한다.

- [ ] **Step 4: 프롬프트 컨텍스트를 넓힌다**

`src/ai/contextBuilder.ts` 의 `structureKitSection` 안 `lines.push(...)` 를 여러 줄 출력으로 바꾼다:

```ts
      const repeatable = structureKitRepeatable(kit);
      lines.push(
        `- ${kit.name ?? "구조물"} (${kit.id}, ${size.width}x${size.height}`
        + `${kit.ai?.role ? `, ${kit.ai.role}` : ""}, ${repeatable ? "반복 가능" : "한 채 완결"})`,
      );
      if (kit.ai?.description) lines.push(`  설명: ${kit.ai.description}`);
      if (kit.ai?.placementRules) lines.push(`  배치: ${kit.ai.placementRules}`);
```

import 에 `structureKitRepeatable` 을 더한다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitTools.test.ts`

Expected: PASS

- [ ] **Step 6: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add src/editor/tools/structureKitTools.ts src/ai/contextBuilder.ts test/structureKitTools.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): 구조물의 설명과 배치 규칙을 AI 에게 넘긴다

타일 그룹은 "[그룹 통나무벽/wall] — 규칙: 2단 벽 타일 위에 가로로 반복 배치"
로 넘어가는데 구조물은 "우물 (kit_a3f2, 3x3 단면, user-paint)" 뿐이었다.
AI 는 언제 쓸지를 이름만 보고 추측할 수밖에 없었다.

반복 여부도 함께 실어, AI 가 repeat 를 생략해도 한 채 완결 구조물임을 안다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: 편집기의 AI 메타 탭 — 초안과 승인

**Files:**
- Modify: `src/editor/panels/structureKitEditorDialog.ts`
- Modify: `src/styles/editor/harness-suggestion.css`
- Test: `test/structureKitEditorDialog.test.ts`

**Interfaces:**
- Consumes: `replaceStructureKit` (Task 9), `StructureKitAiMeta` (Task 3)
- Produces:
  - `buildAiMetaDraftPrompt(kit: SectionStructureKitDef, tileset: TilesetDef, existingNames: readonly string[]): string` — 순수 함수, 유닛 테스트 대상
  - `parseAiMetaDraft(text: string): StructureKitAiMeta | null` — 순수 함수

초안 요청 자체(LLM 호출)는 기존 `ai/llmClient.ts` 경로를 쓰되, **프롬프트 조립과 응답 파싱은 순수 함수로 뽑아** 유닛 테스트한다. `environment: "node"` 에서 네트워크를 타지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
describe("AI 메타 초안", () => {
  it("프롬프트에 타일 행렬과 타일 라벨과 기존 이름이 들어간다", () => {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const kit = seedKit();
    const prompt = buildAiMetaDraftPrompt(kit, tileset, ["울타리", "다리"]);

    expect(prompt).toContain("3×3");
    expect(prompt).toContain("116");        // 문 타일 번호
    expect(prompt).toContain("울타리");      // 이름 중복 회피용
    // 모델이 타일 번호를 추측하지 않도록 사람이 읽는 라벨을 함께 준다.
    expect(prompt).toMatch(/문|출입/);
  });

  it("응답 JSON 을 메타로 파싱한다", () => {
    const meta = parseAiMetaDraft(JSON.stringify({
      description: "돌 우물",
      placementRules: "광장 중앙",
      tags: ["우물"],
      role: "prop",
      repeatability: "fixed",
    }));
    expect(meta).not.toBeNull();
    expect(meta!.description).toBe("돌 우물");
    expect(meta!.repeatability).toBe("fixed");
    // 초안은 절대 user 가 아니다 — 사람이 수락해야 user 가 된다(제로 부트스트랩).
    expect(meta!.origin).toBe("ai");
  });

  it("깨진 응답은 null 을 준다", () => {
    expect(parseAiMetaDraft("이건 JSON 이 아닙니다")).toBeNull();
    expect(parseAiMetaDraft(JSON.stringify({ nope: 1 }))).toBeNull();
  });

  it("모르는 role·repeatability 는 버린다", () => {
    const meta = parseAiMetaDraft(JSON.stringify({
      description: "x", placementRules: "y", role: "spaceship", repeatability: "sometimes",
    }));
    expect(meta!.role).toBeUndefined();
    expect(meta!.repeatability).toBeUndefined();
  });
});

describe("AI 메타 탭", () => {
  it("탭을 열면 폼이 나오고 초안은 자동 저장되지 않는다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    expect(document.querySelector("[data-testid='structure-kit-editor-ai-description']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor-ai-placement']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor-ai-draft']")).not.toBeNull();
    expect(document.querySelector("[data-testid='structure-kit-editor-ai-accept']")).not.toBeNull();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai).toBeUndefined();
  });

  it("수락하면 폼 값이 저장되고 origin 이 user 가 된다", () => {
    seedKit();
    openStructureKitEditor(DEFAULT_TILESET_ID, "kit_edit", () => {});
    (document.querySelector("[data-testid='structure-kit-editor-tab-ai']") as unknown as FakeElement).click();

    const description = document.querySelector("[data-testid='structure-kit-editor-ai-description']") as unknown as HTMLTextAreaElement;
    description.value = "돌담을 두른 두레우물";
    (description as unknown as FakeElement).dispatchEvent(new Event("change"));

    (document.querySelector("[data-testid='structure-kit-editor-ai-accept']") as unknown as FakeElement).click();

    const stored = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!
      .find((kit) => kit.id === "kit_edit") as SectionStructureKitDef;
    expect(stored.ai?.description).toBe("돌담을 두른 두레우물");
    expect(stored.ai?.origin).toBe("user");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: FAIL — 함수와 테스트 id 가 없다

- [ ] **Step 3: 순수 함수 두 개를 구현한다**

`structureKitEditorDialog.ts` 에 추가한다:

```ts
const AI_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];

/**
 * 초안 프롬프트. 모델에 넘기는 것은 이것뿐이다 —
 * 크기·타일 행렬·각 타일의 사람 읽는 라벨·기존 이름 목록.
 * 라벨을 함께 주는 이유: 모델이 타일 번호의 의미를 추측하지 않게 한다.
 */
export function buildAiMetaDraftPrompt(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  existingNames: readonly string[],
): string {
  const used = new Set<number>();
  for (const row of kit.rows) {
    for (const tile of row.tiles) if (tile !== TILE.EMPTY) used.add(tile);
    for (const tile of row.upperTiles ?? []) if (tile !== TILE.EMPTY) used.add(tile);
  }
  const legend = [...used]
    .sort((a, b) => a - b)
    .map((tile) => {
      const described = describeChipsetTile(tile);
      return `  ${tile} = ${described.label}${described.aiLabel ? ` (${described.aiLabel})` : ""}`;
    })
    .join("\n");

  const matrix = kit.rows
    .map((row) => row.tiles.map((tile) => (tile === TILE.EMPTY ? "." : String(tile))).join(" "))
    .join("\n");

  return [
    `타일셋: ${tileset.name}`,
    `구조물 이름: ${kit.name ?? "구조물"}`,
    `크기: ${kit.width}×${kit.height}`,
    "",
    "타일 행렬(하층):",
    matrix,
    "",
    "타일 뜻:",
    legend,
    "",
    `이미 쓰는 이름(중복 피할 것): ${existingNames.join(", ") || "없음"}`,
    "",
    "이 구조물의 description(무엇인지), placementRules(어디에 어떻게 놓는지),",
    `tags(검색어 배열), role(${AI_ROLES.join("|")}), repeatability(repeat|fixed)를`,
    "JSON 한 덩어리로만 답하라. repeatability 는 가로로 이어 찍어도 되면 repeat, 한 채로 완결이면 fixed.",
  ].join("\n");
}

/** 초안 응답 → 메타. origin 은 언제나 "ai" 다 — 사람이 수락해야 "user" 가 된다. */
export function parseAiMetaDraft(text: string): StructureKitAiMeta | null {
  let parsed: unknown;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  if (!description && !placementRules) return null;

  const role = AI_ROLES.find((candidate) => candidate === record.role);
  const repeatability = record.repeatability === "repeat" || record.repeatability === "fixed"
    ? record.repeatability
    : undefined;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  return {
    description,
    placementRules,
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(role ? { role } : {}),
    ...(repeatability ? { repeatability } : {}),
    origin: "ai",
  };
}
```

import 에 `describeChipsetTile`(`@/project/defaults/chipsetMapping`), `StructureKitAiMeta`, `TileGroupRole` 을 더한다.

- [ ] **Step 4: 탭 전환과 AI 메타 폼을 더한다**

`EditorSession` 에 `tab: "shape" | "ai"` 와 `draft: StructureKitAiMeta | null` 을 더하고, 다이얼로그 오른쪽 열 위에 탭 버튼 두 개를 둔다. `redraw` 에서 `session.tab` 에 따라 `structure-kit-editor-right` 의 내용을 갈아끼운다.

AI 메타 폼의 핵심 부분:

```ts
function drawAiTab(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const current = session.draft ?? kit.ai ?? { description: "", placementRules: "", origin: "ai" as const };
  const pendingApproval = current.origin !== "user";

  const area = (label: string, testid: string, value: string, apply: (next: string) => void): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-ai-field",
      children: [
        el("span", { text: label }),
        el("textarea", {
          value,
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLTextAreaElement)) return;
              apply(target.value);
            },
          },
        }),
      ],
    });

  const draft: StructureKitAiMeta = { ...current };
  session.draft = draft;

  host.replaceChildren(
    el("div", {
      class: "structure-kit-editor-ai-head",
      children: [
        el("button", {
          class: "btn small",
          attrs: { type: "button" },
          text: "✨ AI 초안 받기",
          dataset: { testid: "structure-kit-editor-ai-draft" },
          on: { click: () => { void requestAiMetaDraft(kit, tileset, session, redraw); } },
        }),
        ...(pendingApproval
          ? [el("span", { class: "structure-kit-editor-ai-badge", text: "미승인" })]
          : []),
      ],
    }),
    area("설명", "structure-kit-editor-ai-description", draft.description, (next) => { draft.description = next; }),
    area("배치 규칙", "structure-kit-editor-ai-placement", draft.placementRules, (next) => { draft.placementRules = next; }),
    el("button", {
      class: "btn primary",
      attrs: { type: "button" },
      text: "초안 수락 — 내가 보증",
      dataset: { testid: "structure-kit-editor-ai-accept" },
      on: {
        click: () => {
          const target = findKit(session.tilesetId, session.kitId);
          if (!target) return;
          // 제로 부트스트랩: 여기가 origin 을 "user" 로 만드는 유일한 지점이다.
          replaceStructureKit(session.tilesetId, { ...target, ai: { ...draft, origin: "user" } });
          session.draft = null;
          toast("AI 메타를 승인했습니다", "ok");
          redraw();
        },
      },
    }),
  );
}
```

그리고 초안 요청을 구현한다. **어떤 경로에서도 `store.update()` 를 부르지 않는다** — 초안은 폼에만 산다:

```ts
async function requestAiMetaDraft(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): Promise<void> {
  const existingNames = (store.getCurrent().tilesets[session.tilesetId]?.structureKits ?? [])
    .filter((candidate) => candidate.id !== kit.id)
    .map((candidate) => candidate.name ?? "구조물");

  toast("AI 초안을 요청하는 중...", "info");
  try {
    const result = await chatCompletion(loadAiConfig(), {
      messages: [
        {
          role: "system",
          content:
            "너는 2D 타일 RPG 편집기의 구조물 어휘 사서다."
            + " 주어진 타일 행렬을 보고 이 구조물이 무엇이고 어디에 놓아야 하는지 기술한다."
            + " JSON 한 덩어리로만 답하고 다른 말은 붙이지 않는다.",
        },
        { role: "user", content: buildAiMetaDraftPrompt(kit, tileset, existingNames) },
      ],
    });
    const text = typeof result.message.content === "string"
      ? result.message.content
      : (result.message.content ?? [])
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("");
    const draft = parseAiMetaDraft(text);
    if (!draft) {
      // 폼을 비우지 않는다 — 사람이 쓰던 내용을 모델 실패로 날리지 않는다.
      toast("초안을 읽지 못했습니다. 직접 적어 주세요.", "error");
      return;
    }
    session.draft = draft;
    redraw();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`초안 요청 실패: ${message}`, "error");
  }
}
```

import 에 `chatCompletion`, `loadAiConfig`(`@/ai/llmClient`), `store` 를 더한다.

- [ ] **Step 5: CSS 를 더한다**

```css
.structure-kit-editor-ai-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 12px;
}

.structure-kit-editor-ai-field textarea {
  min-height: 56px;
  resize: vertical;
  font: inherit;
}

.structure-kit-editor-ai-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.structure-kit-editor-ai-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--warn-bg, rgba(217, 119, 6, 0.14));
  color: var(--warn-text, #B45309);
}
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: PASS (15 tests)

- [ ] **Step 7: 타입 검사**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/editor/panels/structureKitEditorDialog.ts src/styles/editor/harness-suggestion.css test/structureKitEditorDialog.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 AI 메타를 초안 받고 사람이 승인하게 한다

전부 손으로 쓰게 하면 대부분 빈 칸으로 남고, AI 는 지금처럼 이름만 보게 된다.
rows 와 타일 라벨을 프롬프트에 실어 초안을 받되, 초안은 폼에만 살고
store 에는 닿지 않는다.

origin 을 "user" 로 만드는 지점은 [초안 수락] 하나뿐이다 —
v3 승인 보캐뷸러리의 제로 부트스트랩 원칙(types/base.ts:126)을 따른다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# 5단계 — 파일 입출력

## Task 15: 다운로드 헬퍼 추출

`menu.ts` 의 다운로드 코드에는 과거 결함 3가지가 주석으로 박혀 있고, 같은 패턴이 그 파일 안에 **두 번 중복**돼 있다. 이번이 세 번째 사용처다.

**Files:**
- Create: `src/util/downloadBlob.ts`
- Modify: `src/editor/panels/menu.ts:763-785` (`exportProjectPackage`), `:787-805` (`doExportWebGame`)
- Test: `test/downloadBlob.test.ts`

**Interfaces:**
- Produces: `downloadBlob(blob: Blob, fileName: string): void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/downloadBlob.test.ts` 를 만든다:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/util/downloadBlob";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  vi.useFakeTimers();
  (globalThis as { URL?: unknown }).URL = {
    createObjectURL: () => "blob:fake",
    revokeObjectURL: vi.fn(),
  };
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom?.();
  restoreDom = undefined;
});

describe("downloadBlob", () => {
  it("anchor 를 DOM 에 붙였다가 뗀다", () => {
    // 과거 결함 ②: anchor 를 DOM 에 붙이지 않고 click() 하면 일부 환경에서 다운로드가 시작되지 않는다.
    const appended: string[] = [];
    const body = document.body as unknown as FakeElement;
    const originalAppend = body.append.bind(body);
    body.append = (...children: FakeElement[]) => {
      for (const child of children) appended.push(child.tagName.toLowerCase());
      originalAppend(...(children as never[]));
    };

    downloadBlob(new Blob(["x"]), "우물.rpgzzu-kit.json");
    expect(appended).toContain("a");
    expect(body.querySelector("a")).toBeNull(); // click 후 제거됐다
  });

  it("revokeObjectURL 을 즉시 부르지 않는다", () => {
    // 과거 결함 ③: click() 직후 동기 revoke 하면 브라우저가 fetch 를 시작하기 전에 URL 이 무효화된다.
    const revoke = (globalThis as { URL: { revokeObjectURL: ReturnType<typeof vi.fn> } }).URL.revokeObjectURL;
    downloadBlob(new Blob(["x"]), "a.json");
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/downloadBlob.test.ts`

Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 헬퍼를 구현한다**

`src/util/downloadBlob.ts`:

```ts
// util/downloadBlob.ts
// 브라우저 다운로드 트리거. menu.ts 의 exportProjectPackage/doExportWebGame 에 두 번 중복돼 있던
// 패턴을 뽑았다. 그 코드에 주석으로 박힌 과거 결함 두 가지를 여기서 한 번만 지킨다:
//   ② anchor 를 DOM 에 붙이지 않고 click() → 일부 환경에서 다운로드가 시작되지 않음
//   ③ click() 직후 동기 revokeObjectURL → 브라우저가 fetch 를 시작하기 전에 URL 무효화
// (① store.flush() reject 로 함수 전체 중단은 호출부의 책임이라 여기 없다.)

const REVOKE_DELAY_MS = 10_000;

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
```

- [ ] **Step 4: `menu.ts` 의 두 사용처를 이관한다**

`exportProjectPackage` 의 다섯 줄

```ts
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = projectPackageFileName(project);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
```

을 `downloadBlob(blob, projectPackageFileName(project));` 로 바꾼다. `doExportWebGame` 도 같은 방식으로 `downloadBlob(result.blob, webExportFileName(project));` 로 바꾼다. import 를 더한다.

- [ ] **Step 5: 테스트와 타입 검사**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/downloadBlob.test.ts && npx tsc --noEmit -p tsconfig.app.json`

Expected: PASS (2 tests), 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/util/downloadBlob.ts src/editor/panels/menu.ts test/downloadBlob.test.ts
git commit -m "$(cat <<'EOF'
refactor(util): 다운로드 트리거를 한 곳으로 모은다

menu.ts 에 같은 패턴이 두 번 중복돼 있고, 그 코드에 과거 결함 세 가지가
주석으로 박혀 있다. 구조물 내보내기가 세 번째 사용처가 되므로,
anchor 를 DOM 에 붙이는 것과 revoke 를 미루는 것을 한 곳에서만 지킨다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: 파일 포맷 — 직렬화와 파싱

**Files:**
- Create: `src/editor/harnessSuggestion/structureKitFile.ts`
- Create: `test/structureKitFile.test.ts`

**Interfaces:**
- Consumes: `bakeStructureKit` (Task 7), `ProjectFormatError` 와 같은 모양의 오류 타입
- Produces:
  - `class StructureKitFileError extends Error`
  - `const STRUCTURE_KIT_FILE_FORMAT = "rpgzzu-structure-kits"`, `const STRUCTURE_KIT_FILE_VERSION = 1`
  - `serializeStructureKitFile(tileset: TilesetDef, kits: readonly StructureKitDef[], exportedAt: string): string`
  - `parseStructureKitFile(text: string): { file: StructureKitFile; diagnostics: KitDiagnostic[] }`
  - `interface KitDiagnostic { index: number; name: string; reason: string }`
  - `structureKitFileName(tilesetName: string, kits: readonly StructureKitDef[]): string`

`exportedAt` 을 인자로 받는 이유: `new Date()` 를 안에서 부르면 순수 함수가 아니게 되어 직렬화 결과를 단언할 수 없다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/structureKitFile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseStructureKitFile,
  serializeStructureKitFile,
  structureKitFileName,
  StructureKitFileError,
  STRUCTURE_KIT_FILE_VERSION,
} from "@/editor/harnessSuggestion/structureKitFile";
import { store } from "@/project/store";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { SectionStructureKitDef } from "@/project/types";

const AT = "2026-08-28T09:12:00.000Z";

function tileset() {
  return store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
}

function well(): SectionStructureKitDef {
  return {
    id: "kit_well",
    kind: "section",
    name: "우물",
    width: 2,
    height: 2,
    rows: [{ tiles: [421, 421] }, { tiles: [421, 116], upperTiles: [-1, 208] }],
    parts: [{ id: "p1", kind: "entrance", dx: 1, dy: 1, w: 1, h: 1 }],
    learnedFrom: "db-authored",
    ai: { description: "돌 우물", placementRules: "광장 중앙", repeatability: "fixed", origin: "user" },
  };
}

describe("serializeStructureKitFile", () => {
  it("판별자·버전·타일셋·킷을 담는다", () => {
    const json = JSON.parse(serializeStructureKitFile(tileset(), [well()], AT));
    expect(json.format).toBe("rpgzzu-structure-kits");
    expect(json.version).toBe(STRUCTURE_KIT_FILE_VERSION);
    expect(json.exportedAt).toBe(AT);
    expect(json.tileset.id).toBe(DEFAULT_TILESET_ID);
    expect(json.tileset.name).toBe(tileset().name);
    expect(json.kits).toHaveLength(1);
    expect(json.kits[0].name).toBe("우물");
    expect(json.kits[0].parts[0].kind).toBe("entrance");
    expect(json.kits[0].ai.description).toBe("돌 우물");
  });

  it("낱개든 묶음이든 kits 는 항상 배열이다", () => {
    const one = JSON.parse(serializeStructureKitFile(tileset(), [well()], AT));
    const many = JSON.parse(serializeStructureKitFile(tileset(), [well(), { ...well(), id: "k2", name: "다리" }], AT));
    expect(Array.isArray(one.kits)).toBe(true);
    expect(one.kits).toHaveLength(1);
    expect(many.kits).toHaveLength(2);
  });

  it("집 킷은 굳혀서 담는다 — 파일에 들어가는 순간 사진이 된다", () => {
    const house = {
      id: "kit_house",
      kind: "house" as const,
      name: "통나무집",
      houseKitId: "log",
      wings: [{ x: 0, y: 0, w: 5, h: 5 }],
      learnedFrom: "builtin-parametric" as const,
    };
    const json = JSON.parse(serializeStructureKitFile(tileset(), [house], AT));
    expect(json.kits[0].kind).toBe("section");
    expect(Array.isArray(json.kits[0].rows)).toBe(true);
    expect(json.kits[0].houseKitId).toBeUndefined();
  });
});

describe("parseStructureKitFile", () => {
  it("왕복한다", () => {
    const { file, diagnostics } = parseStructureKitFile(serializeStructureKitFile(tileset(), [well()], AT));
    expect(diagnostics).toHaveLength(0);
    expect(file.tileset.id).toBe(DEFAULT_TILESET_ID);
    expect(file.kits[0]!.name).toBe("우물");
    expect(file.kits[0]!.rows[1]!.upperTiles).toEqual([-1, 208]);
  });

  it("JSON 이 아니면 던진다", () => {
    expect(() => parseStructureKitFile("이건 JSON 이 아님")).toThrow(StructureKitFileError);
  });

  it("판별자가 없으면 던진다 — 프로젝트 파일을 잘못 고른 경우", () => {
    expect(() => parseStructureKitFile(JSON.stringify({ version: 1, kits: [] }))).toThrow(StructureKitFileError);
  });

  it("더 새 버전이면 던지고 이유를 말한다", () => {
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION + 1,
      tileset: { id: "x", name: "x" },
      kits: [],
    });
    expect(() => parseStructureKitFile(text)).toThrow(/더 새 버전/);
  });

  it("킷 12개 중 3개가 깨져도 나머지 9개는 살아남는다", () => {
    const good = well();
    const kits: unknown[] = [];
    for (let i = 0; i < 12; i += 1) {
      if (i === 2) kits.push({ ...good, id: `k${i}`, rows: [] });                       // rows.length ≠ height
      else if (i === 5) kits.push({ ...good, id: `k${i}`, width: 0 });                  // 폭이 0
      else if (i === 9) kits.push({ ...good, id: `k${i}`, rows: [{ tiles: [421] }, { tiles: [421, 421] }] }); // 행 길이 불일치
      else kits.push({ ...good, id: `k${i}` });
    }
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      exportedAt: AT,
      tileset: { id: DEFAULT_TILESET_ID, name: "합본 마을" },
      kits,
    });

    const { file, diagnostics } = parseStructureKitFile(text);
    expect(file.kits).toHaveLength(9);
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.map((d) => d.index).sort((a, b) => a - b)).toEqual([2, 5, 9]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.reason.length).toBeGreaterThan(0);
    }
  });

  it("section 이 아닌 킷은 거른다", () => {
    const text = JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      tileset: { id: DEFAULT_TILESET_ID, name: "합본 마을" },
      kits: [{ id: "h", kind: "house", name: "집", houseKitId: "log", wings: [], learnedFrom: "user-paint" }],
    });
    const { file, diagnostics } = parseStructureKitFile(text);
    expect(file.kits).toHaveLength(0);
    expect(diagnostics).toHaveLength(1);
  });
});

describe("structureKitFileName", () => {
  it("낱개는 구조물 이름을 쓴다", () => {
    expect(structureKitFileName("합본 마을", [well()])).toBe("우물.rpgzzu-kit.json");
  });

  it("묶음은 타일셋 이름과 개수를 쓴다", () => {
    expect(structureKitFileName("합본 마을", [well(), { ...well(), id: "k2" }]))
      .toBe("합본 마을-구조물-2개.rpgzzu-kit.json");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitFile.test.ts`

Expected: FAIL — 모듈이 없다

- [ ] **Step 3: 구현한다**

`src/editor/harnessSuggestion/structureKitFile.ts`:

```ts
// harnessSuggestion/structureKitFile.ts
// 구조물 파일 포맷 — DOM·store 의존 없음(유닛 테스트 대상).
//
// 규칙 하나: 파일에 들어가는 순간 사진이 된다.
//   집 킷은 내보낼 때 전개해서 rows 로 담는다. 포맷이 한 종류라 파서·검증이 하나이고,
//   받는 쪽에서 항상 편집 가능하며 AI 가 항상 모양을 읽을 수 있다.
//   받는 프로젝트에 그 houseKitId 가 있는지 걱정할 필요도 없다.

import { bakeStructureKit } from "@/editor/harnessSuggestion/structureKitRasterModel";
import type { SectionStructureKitDef, StructureKitDef, StructureKitAiMeta, TilesetDef } from "@/project/types";

export class StructureKitFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureKitFileError";
  }
}

/** 프로젝트 파일과 구분하는 판별자. 확장자만으로는 잘못 고른 파일을 못 거른다. */
export const STRUCTURE_KIT_FILE_FORMAT = "rpgzzu-structure-kits";
export const STRUCTURE_KIT_FILE_VERSION = 1;

export interface StructureKitFile {
  readonly format: typeof STRUCTURE_KIT_FILE_FORMAT;
  readonly version: number;
  readonly exportedAt?: string;
  readonly tileset: { readonly id: string; readonly name: string };
  readonly kits: readonly SectionStructureKitDef[];
}

/** 킷 하나가 걸러진 이유. 파일 하나가 통째로 죽지 않게 킷 단위로 격리한다. */
export interface KitDiagnostic {
  readonly index: number;
  readonly name: string;
  readonly reason: string;
}

/** exportedAt 을 인자로 받는다 — new Date() 를 안에서 부르면 결과를 단언할 수 없다. */
export function serializeStructureKitFile(
  tileset: TilesetDef,
  kits: readonly StructureKitDef[],
  exportedAt: string,
): string {
  const baked = kits.map((kit) => bakeStructureKit(kit, kit.id, kit.name ?? "구조물"));
  const file: StructureKitFile = {
    format: STRUCTURE_KIT_FILE_FORMAT,
    version: STRUCTURE_KIT_FILE_VERSION,
    exportedAt,
    tileset: { id: tileset.id, name: tileset.name },
    kits: baked,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseStructureKitFile(text: string): {
  readonly file: StructureKitFile;
  readonly diagnostics: readonly KitDiagnostic[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StructureKitFileError("JSON 으로 읽을 수 없는 파일입니다.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new StructureKitFileError("구조물 파일 형식이 아닙니다.");
  }
  const record = parsed as Record<string, unknown>;
  if (record.format !== STRUCTURE_KIT_FILE_FORMAT) {
    throw new StructureKitFileError("구조물 파일이 아닙니다. 프로젝트 파일을 고르셨는지 확인해 주세요.");
  }
  const version = typeof record.version === "number" ? record.version : 0;
  if (version > STRUCTURE_KIT_FILE_VERSION) {
    throw new StructureKitFileError("이 파일은 더 새 버전의 편집기에서 만들어졌습니다.");
  }
  const tilesetRecord = record.tileset as Record<string, unknown> | undefined;
  if (typeof tilesetRecord?.id !== "string") {
    throw new StructureKitFileError("파일에 타일셋 정보가 없습니다.");
  }
  if (!Array.isArray(record.kits)) {
    throw new StructureKitFileError("파일에 구조물 목록이 없습니다.");
  }

  const kits: SectionStructureKitDef[] = [];
  const diagnostics: KitDiagnostic[] = [];
  record.kits.forEach((raw, index) => {
    const result = readKit(raw, index);
    if ("reason" in result) diagnostics.push(result);
    else kits.push(result);
  });

  return {
    file: {
      format: STRUCTURE_KIT_FILE_FORMAT,
      version,
      ...(typeof record.exportedAt === "string" ? { exportedAt: record.exportedAt } : {}),
      tileset: {
        id: tilesetRecord.id,
        name: typeof tilesetRecord.name === "string" ? tilesetRecord.name : tilesetRecord.id,
      },
      kits,
    },
    diagnostics,
  };
}

function readKit(raw: unknown, index: number): SectionStructureKitDef | KitDiagnostic {
  const fail = (reason: string, name = "이름 없음"): KitDiagnostic => ({ index, name, reason });
  if (typeof raw !== "object" || raw === null) return fail("구조물 형식이 아닙니다");
  const record = raw as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : "이름 없음";

  if (record.kind !== "section") return fail("타일 행렬이 없는 구조물입니다", name);

  const width = Math.floor(Number(record.width));
  const height = Math.floor(Number(record.height));
  if (!Number.isFinite(width) || width < 1) return fail("폭이 올바르지 않습니다", name);
  if (!Number.isFinite(height) || height < 1) return fail("높이가 올바르지 않습니다", name);
  if (!Array.isArray(record.rows) || record.rows.length !== height) {
    return fail(`행 수가 높이와 다릅니다 (${Array.isArray(record.rows) ? record.rows.length : 0} ≠ ${height})`, name);
  }

  const rows = [];
  for (const rawRow of record.rows) {
    if (typeof rawRow !== "object" || rawRow === null) return fail("행 형식이 올바르지 않습니다", name);
    const rowRecord = rawRow as Record<string, unknown>;
    if (!isIntArray(rowRecord.tiles, width)) return fail(`행 길이가 폭과 다릅니다 (폭 ${width})`, name);
    const upperTiles = rowRecord.upperTiles;
    if (upperTiles !== undefined && !isIntArray(upperTiles, width)) {
      return fail("상층 행 길이가 폭과 다릅니다", name);
    }
    rows.push(
      upperTiles === undefined
        ? { tiles: [...(rowRecord.tiles as number[])] }
        : { tiles: [...(rowRecord.tiles as number[])], upperTiles: [...(upperTiles as number[])] },
    );
  }

  return {
    id: typeof record.id === "string" && record.id ? record.id : `kit_imported_${index}`,
    kind: "section",
    name,
    width,
    height,
    rows,
    ...(Array.isArray(record.parts) ? { parts: readParts(record.parts) } : {}),
    // 파일에 적힌 origin 을 그대로 보존한다 — 가져오기 체크는 "이 파일을 받겠다" 이지
    // "이 설명을 내가 보증한다" 가 아니다(제로 부트스트랩).
    ...(readAiMeta(record.ai) ? { ai: readAiMeta(record.ai)! } : {}),
    learnedFrom: "db-authored",
    ...(typeof record.createdAt === "string" ? { createdAt: record.createdAt } : {}),
  };
}

function isIntArray(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length && value.every((item) => Number.isInteger(item));
}

function readParts(raw: readonly unknown[]): SectionStructureKitDef["parts"] {
  const kinds = new Set(["entrance", "window", "sign", "anchor"]);
  const parts = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.kind !== "string" || !kinds.has(record.kind)) continue;
    if (![record.dx, record.dy, record.w, record.h].every((n) => Number.isInteger(n))) continue;
    parts.push({
      id: typeof record.id === "string" && record.id ? record.id : `pt_imported_${parts.length}`,
      kind: record.kind as "entrance" | "window" | "sign" | "anchor",
      dx: record.dx as number,
      dy: record.dy as number,
      w: record.w as number,
      h: record.h as number,
      ...(typeof record.note === "string" ? { note: record.note } : {}),
    });
  }
  return parts;
}

function readAiMeta(raw: unknown): StructureKitAiMeta | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  if (!description && !placementRules) return undefined;
  return {
    description,
    placementRules,
    ...(Array.isArray(record.tags)
      ? { tags: record.tags.filter((tag): tag is string => typeof tag === "string") }
      : {}),
    ...(typeof record.role === "string" ? { role: record.role as StructureKitAiMeta["role"] } : {}),
    ...(record.repeatability === "repeat" || record.repeatability === "fixed"
      ? { repeatability: record.repeatability }
      : {}),
    ...(record.origin === "user" || record.origin === "ai" ? { origin: record.origin } : {}),
    ...(record.confidence === "high" || record.confidence === "medium" || record.confidence === "low"
      ? { confidence: record.confidence }
      : {}),
  };
}

/** 낱개는 구조물 이름, 묶음은 타일셋 이름과 개수. 이중 확장자라 브라우저는 JSON 으로 연다. */
export function structureKitFileName(tilesetName: string, kits: readonly StructureKitDef[]): string {
  if (kits.length === 1) return `${kits[0]!.name ?? "구조물"}.rpgzzu-kit.json`;
  return `${tilesetName}-구조물-${kits.length}개.rpgzzu-kit.json`;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitFile.test.ts`

Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitFile.ts test/structureKitFile.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물 파일 포맷을 연다

한 포맷으로 낱개와 묶음을 모두 담는다 — kits 는 항상 배열이라 파서가 하나다.
집 킷은 내보낼 때 굳혀서 담는다: 받는 쪽에서 항상 편집 가능하고 AI 가 모양을
읽을 수 있으며, 받는 프로젝트에 그 houseKitId 가 있는지 걱정할 필요가 없다.

킷 검증은 킷 단위로 격리한다 — 12개 중 1개가 깨졌다고 12개가 다 죽지 않는다.
파일에 적힌 origin 은 그대로 보존한다(제로 부트스트랩).

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: `planImport` — 충돌과 칩셋 경계를 미리 판정

**Files:**
- Modify: `src/editor/harnessSuggestion/structureKitFile.ts`
- Test: `test/structureKitFile.test.ts`

**Interfaces:**
- Consumes: `structureKitSignature` (`structureKitModel.ts:178`)
- Produces:
  - `interface ImportCandidate { kit: SectionStructureKitDef; duplicate: boolean; nameConflict: boolean; resolvedName: string; defaultChecked: boolean }`
  - `interface ImportPlan { tilesetMismatch: boolean; fileTilesetId: string; fileTilesetName: string; candidates: ImportCandidate[]; diagnostics: readonly KitDiagnostic[] }`
  - `planImport(file: StructureKitFile, targetTileset: TilesetDef, existingKits: readonly StructureKitDef[], diagnostics: readonly KitDiagnostic[]): ImportPlan`

`planImport` 가 모든 판정을 미리 끝내므로 확인창은 계획을 그리기만 한다 — 대화상자 없이 충돌 정책 전부를 테스트할 수 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
describe("planImport", () => {
  function fileWith(kits: SectionStructureKitDef[], tilesetId = DEFAULT_TILESET_ID) {
    return parseStructureKitFile(JSON.stringify({
      format: "rpgzzu-structure-kits",
      version: STRUCTURE_KIT_FILE_VERSION,
      tileset: { id: tilesetId, name: "합본 마을" },
      kits,
    }));
  }

  it("같은 칩셋이면 경고가 없다", () => {
    const { file, diagnostics } = fileWith([well()]);
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.tilesetMismatch).toBe(false);
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0]!.defaultChecked).toBe(true);
  });

  it("다른 칩셋이면 경고 플래그가 선다", () => {
    const { file, diagnostics } = fileWith([well()], "easyrpg_chipset_dungeon");
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.tilesetMismatch).toBe(true);
    expect(plan.fileTilesetName).toBe("합본 마을");
  });

  it("같은 모양이 이미 있으면 기본 체크를 푼다", () => {
    const existing = well();
    const { file, diagnostics } = fileWith([{ ...well(), id: "other_id", name: "다른 이름" }]);
    const plan = planImport(file, tileset(), [existing], diagnostics);
    expect(plan.candidates[0]!.duplicate).toBe(true);
    expect(plan.candidates[0]!.defaultChecked).toBe(false);
  });

  it("이름이 겹치고 모양이 다르면 개명한다", () => {
    const existing = { ...well(), id: "existing", rows: [{ tiles: [1, 1] }, { tiles: [1, 1] }] };
    const { file, diagnostics } = fileWith([well()]);
    const plan = planImport(file, tileset(), [existing], diagnostics);
    expect(plan.candidates[0]!.duplicate).toBe(false);
    expect(plan.candidates[0]!.nameConflict).toBe(true);
    expect(plan.candidates[0]!.resolvedName).toBe("우물 (2)");
  });

  it("파일 안에서 이름이 겹쳐도 서로 어긋나게 개명한다", () => {
    const a = well();
    const b = { ...well(), id: "k2", rows: [{ tiles: [9, 9] }, { tiles: [9, 9] }] };
    const { file, diagnostics } = fileWith([a, b]);
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.candidates.map((c) => c.resolvedName)).toEqual(["우물", "우물 (2)"]);
  });

  it("진단을 그대로 들고 간다", () => {
    const { file, diagnostics } = fileWith([{ ...well(), rows: [] } as unknown as SectionStructureKitDef]);
    const plan = planImport(file, tileset(), [], diagnostics);
    expect(plan.candidates).toHaveLength(0);
    expect(plan.diagnostics).toHaveLength(1);
  });
});
```

import 에 `planImport` 를 더한다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitFile.test.ts`

Expected: FAIL — `planImport` 이 없다

- [ ] **Step 3: 구현한다**

`structureKitFile.ts` 에 추가한다:

```ts
import { structureKitSignature } from "@/editor/harnessSuggestion/structureKitModel";

export interface ImportCandidate {
  readonly kit: SectionStructureKitDef;
  /** 같은 모양이 이미 앨범에 있다. */
  readonly duplicate: boolean;
  /** 같은 이름의 다른 모양이 이미 있다. */
  readonly nameConflict: boolean;
  /** 충돌을 푼 최종 이름. */
  readonly resolvedName: string;
  readonly defaultChecked: boolean;
}

export interface ImportPlan {
  /** 파일의 칩셋이 지금 앨범과 다르다 — 타일 번호의 뜻이 달라 그림이 깨진다. */
  readonly tilesetMismatch: boolean;
  readonly fileTilesetId: string;
  readonly fileTilesetName: string;
  readonly candidates: readonly ImportCandidate[];
  readonly diagnostics: readonly KitDiagnostic[];
}

/**
 * 가져오기 판정을 전부 미리 끝낸다 — 확인창은 이 계획을 그리기만 한다.
 * 대화상자 없이 충돌 정책 전부를 유닛 테스트할 수 있게 하려는 경계다.
 */
export function planImport(
  file: StructureKitFile,
  targetTileset: TilesetDef,
  existingKits: readonly StructureKitDef[],
  diagnostics: readonly KitDiagnostic[],
): ImportPlan {
  const existingSignatures = new Set(existingKits.map((kit) => structureKitSignature(kit)));
  const takenNames = new Set(existingKits.map((kit) => kit.name ?? "구조물"));

  const candidates: ImportCandidate[] = [];
  for (const kit of file.kits) {
    const duplicate = existingSignatures.has(structureKitSignature(kit));
    const baseName = kit.name ?? "구조물";
    const nameConflict = takenNames.has(baseName);
    const resolvedName = nameConflict ? uniqueName(baseName, takenNames) : baseName;
    takenNames.add(resolvedName);
    candidates.push({
      kit,
      duplicate,
      nameConflict,
      resolvedName,
      // 같은 모양은 기본 해제 — 같은 파일을 두 번 가져와도 사본이 쌓이지 않는다.
      defaultChecked: !duplicate,
    });
  }

  return {
    tilesetMismatch: file.tileset.id !== targetTileset.id,
    fileTilesetId: file.tileset.id,
    fileTilesetName: file.tileset.name,
    candidates,
    diagnostics,
  };
}

/** AI 가 kitName 부분 일치로 킷을 지목하므로, 같은 이름 둘은 조회를 불안정하게 만든다. */
function uniqueName(baseName: string, taken: ReadonlySet<string>): string {
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${baseName} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${baseName} (${taken.size + 1})`;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitFile.test.ts`

Expected: PASS (17 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/editor/harnessSuggestion/structureKitFile.ts test/structureKitFile.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 가져오기 충돌 판정을 계획 객체로 뽑는다

칩셋 경계·서명 중복·이름 충돌을 planImport 가 미리 끝내면, 확인창은 계획을
그리기만 하면 되고 충돌 정책 전부를 대화상자 없이 유닛 테스트할 수 있다.

같은 모양은 기본 체크를 풀어 같은 파일을 두 번 가져와도 사본이 쌓이지 않게 하고,
같은 이름의 다른 모양은 개명한다 — AI 가 kitName 부분 일치로 킷을 지목하므로
같은 이름 둘은 조회를 불안정하게 만든다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: 내보내기 UI — 체크박스 열과 버튼

**Files:**
- Modify: `src/editor/panels/structureKitDbTab.ts` (표 헤더·행·푸터·도구줄)
- Modify: `src/editor/panels/structureKitInspector.ts` (낱개 내보내기 버튼)
- Modify: `src/styles/editor/harness-suggestion.css`
- Test: `test/structureKitDbTab.test.ts`

**Interfaces:**
- Consumes: `serializeStructureKitFile`, `structureKitFileName` (Task 16), `downloadBlob` (Task 15)
- Produces: 없음(UI 완결)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
describe("structureKitDbTab 내보내기", () => {
  it("내 구조물 행에만 체크박스가 있다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_mine", "내 우물"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    expect(host.querySelector("[data-testid='structure-kit-check-kit_mine']")).not.toBeNull();
    // 내장 킷 행에는 없다 — 내보낼 수 있는 것이 내 구조물뿐이다.
    expect(host.querySelector("[data-testid='structure-kit-check-kit_house_blue-stone']")).toBeNull();
  });

  it("체크하면 푸터가 선택 개수와 내보내기로 바뀐다", () => {
    const current = store.getCurrent();
    const mapId = Object.keys(current.maps)[0]!;
    editorState.set({ currentMapId: mapId });
    registerStructureKit(DEFAULT_TILESET_ID, createTestSectionKit("kit_mine", "내 우물"));

    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});

    const exportBtn = host.querySelector("[data-testid='structure-kit-export']");
    expect(exportBtn).not.toBeNull();
    expect(exportBtn!.textContent).toContain("앨범 내보내기");

    host.querySelector("[data-testid='structure-kit-check-kit_mine']")!.click();

    expect(host.textContent).toContain("1개 선택됨");
    expect(host.querySelector("[data-testid='structure-kit-export']")!.textContent).toContain("선택 내보내기");
  });

  it("가져오기 버튼이 도구줄에 있다", () => {
    const host = new FakeElement("div");
    renderStructureKitsTab(host, () => {});
    expect(host.querySelector("[data-testid='structure-kit-import']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts`

Expected: FAIL — 체크박스와 버튼이 없다

- [ ] **Step 3: 세션에 선택 집합을 더한다**

`ActiveSessionState` 에 `checkedKitIds: Set<string>` 을 더하고 `resetStructureKitsTabSession` 에서 비운다. 타일셋을 바꿀 때도 비운다 — 앨범이 바뀌면 선택은 뜻을 잃는다.

- [ ] **Step 4: 표에 체크박스 열을 더한다**

`thead` 의 `tr` children 맨 앞에 넣는다:

```ts
              el("th", { class: "structure-kit-check-col", attrs: { style: "width: 28px;" } }),
```

킷 행(`tbody` 의 `el("tr", ...)`) children 맨 앞에 넣는다. `source === "user"` 인 행에만 실제 체크박스를 둔다:

```ts
          el("td", {
            class: "structure-kit-check-col",
            children: entry.source === "user"
              ? [
                  el("input", {
                    attrs: session.checkedKitIds.has(kit.id)
                      ? { type: "checkbox", checked: "" }
                      : { type: "checkbox" },
                    dataset: { testid: `structure-kit-check-${kit.id}` },
                    on: {
                      click: (event: Event) => {
                        // 행 클릭(인스펙터 선택)과 겹치지 않게 한다.
                        event.stopPropagation();
                        if (session.checkedKitIds.has(kit.id)) session.checkedKitIds.delete(kit.id);
                        else session.checkedKitIds.add(kit.id);
                        refresh(host, rerender);
                      },
                    },
                  }),
                ]
              : [],
          }),
```

오브젝트 행(`renderObjectRow`)에도 같은 위치에 빈 `<td class="structure-kit-check-col">` 을 넣어 열이 어긋나지 않게 한다.

- [ ] **Step 5: 푸터를 선택 상태에 반응시킨다**

`footer` 를 이렇게 바꾼다:

```ts
    const checkedCount = visibleEntries.filter(
      (entry) => entry.kind === "kit" && session.checkedKitIds.has(entry.kit.id),
    ).length;
    const footer = el("div", {
      class: "structure-kit-footer",
      children: [
        el("span", { text: checkedCount > 0 ? `${checkedCount}개 선택됨` : `${visibleEntries.length}개` }),
      ],
    });
```

- [ ] **Step 6: 도구줄에 내보내기·가져오기 버튼을 더한다**

Task 11 에서 만든 `+ 새 구조물` 옆에 넣는다:

```ts
      el("button", {
        class: "btn small",
        attrs: { type: "button" },
        text: "가져오기",
        dataset: { testid: "structure-kit-import" },
        on: { click: () => { if (session.tilesetId) pickAndImportStructureKits(session.tilesetId, () => { rerender(); refresh(host, rerender); }); } },
      }),
      el("button", {
        class: "btn small",
        attrs: { type: "button" },
        text: session.checkedKitIds.size > 0 ? "선택 내보내기" : "앨범 내보내기",
        dataset: { testid: "structure-kit-export" },
        on: {
          click: () => {
            if (!activeTileset) return;
            const own = activeTileset.structureKits ?? [];
            const targets = session.checkedKitIds.size > 0
              ? own.filter((kit) => session.checkedKitIds.has(kit.id))
              : own;
            if (targets.length === 0) {
              toast("내보낼 구조물이 없습니다. 먼저 [+ 새 구조물]이나 [복제]로 만들어 주세요.", "info");
              return;
            }
            const text = serializeStructureKitFile(activeTileset, targets, new Date().toISOString());
            downloadBlob(new Blob([text], { type: "application/json" }), structureKitFileName(activeTileset.name, targets));
            toast(`구조물 ${targets.length}개를 내보냈습니다`, "ok");
          },
        },
      }),
```

`pickAndImportStructureKits` 는 Task 19 에서 만든다. 이 태스크에서는 import 만 걸고, Task 19 전까지는 컴파일을 위해 임시로 두지 말고 **Task 19 를 이어서 진행한다.**

- [ ] **Step 7: 인스펙터에 낱개 내보내기 버튼을 더한다**

`renderInspector` 의 액션 배열, `복제` 뒤(편집 가능한 경우에만)에 넣는다:

```ts
            el("button", {
              class: "btn",
              attrs: { type: "button" },
              text: "내보내기",
              dataset: { testid: `structure-kit-export-${kit.id}` },
              on: {
                click: () => {
                  const text = serializeStructureKitFile(tileset, [kit], new Date().toISOString());
                  downloadBlob(
                    new Blob([text], { type: "application/json" }),
                    structureKitFileName(tileset.name, [kit]),
                  );
                  toast(`'${kit.name ?? "구조물"}'을 내보냈습니다`, "ok");
                },
              },
            }),
```

- [ ] **Step 8: CSS 를 더한다**

```css
.structure-kit-check-col {
  width: 28px;
  text-align: center;
  padding-right: 0;
}

.structure-kit-check-col input {
  cursor: pointer;
  margin: 0;
}
```

- [ ] **Step 9: Task 19 를 먼저 마친 뒤 테스트를 돌린다**

`pickAndImportStructureKits` 가 아직 없어 타입 검사가 실패한다. Task 19 를 이어서 구현한 뒤 함께 검증하고 커밋한다.

---

## Task 19: 가져오기 다이얼로그

**Files:**
- Create: `src/editor/panels/structureKitImportDialog.ts`
- Modify: `src/editor/harnessSuggestion/structureKitActions.ts`
- Modify: `src/styles/editor/harness-suggestion.css`
- Test: `test/structureKitFile.test.ts` (계획은 이미 검증됨), `test/structureKitDbTab.test.ts`

**Interfaces:**
- Consumes: `parseStructureKitFile`, `planImport`, `StructureKitFileError` (Task 16·17)
- Produces:
  - `pickAndImportStructureKits(tilesetId: TilesetId, onDone: () => void): void`
  - `openStructureKitImportDialog(tilesetId: TilesetId, plan: ImportPlan, onDone: () => void): void`
  - `importStructureKits(tilesetId: TilesetId, entries: readonly { kit: SectionStructureKitDef; name: string }[]): number` (actions)

- [ ] **Step 1: 저장 접점의 실패 테스트를 쓴다**

`test/structureKitEditorDialog.test.ts` 에 추가한다:

```ts
describe("importStructureKits", () => {
  it("새 id 를 발급해 넣고 개수를 돌려준다", () => {
    seedKit(); // kit_edit 이 이미 있다
    const added = importStructureKits(DEFAULT_TILESET_ID, [
      { kit: { ...seedKit(), id: "kit_edit" }, name: "우물 (2)" },
    ]);
    expect(added).toBe(1);

    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    expect(kits).toHaveLength(2);
    const imported = kits.find((kit) => kit.name === "우물 (2)")!;
    expect(imported.id).not.toBe("kit_edit");
    expect(imported.id.startsWith("kit_")).toBe(true);
  });

  it("가져온 킷은 편집 가능한 계보를 갖는다", () => {
    const added = importStructureKits(DEFAULT_TILESET_ID, [
      { kit: { ...seedKit(), id: "x", learnedFrom: "builtin-parametric" }, name: "가져온 집" },
    ]);
    expect(added).toBe(1);
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    expect(kits[0]!.learnedFrom).toBe("db-authored");
  });

  it("origin 을 자동으로 user 로 올리지 않는다", () => {
    // 제로 부트스트랩: 가져오기 체크는 "이 파일을 받겠다" 이지 "이 설명을 내가 보증한다" 가 아니다.
    importStructureKits(DEFAULT_TILESET_ID, [
      {
        kit: { ...seedKit(), id: "y", ai: { description: "남이 쓴 설명", placementRules: "남이 쓴 규칙", origin: "ai" } },
        name: "남의 우물",
      },
    ]);
    const kits = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.structureKits!;
    expect(kits[0]!.ai?.origin).toBe("ai");
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitEditorDialog.test.ts`

Expected: FAIL — `importStructureKits` 이 없다

- [ ] **Step 3: 저장 접점을 구현한다**

`structureKitActions.ts` 에 추가한다:

```ts
/**
 * 가져오기 커밋. id 는 새로 발급하고(원본 id 는 사람이 외우는 값이 아니다),
 * learnedFrom 은 db-authored 로 굳힌다 — builtin-parametric 을 그대로 두면
 * 프로젝트 데이터인데 편집이 잠긴 유령 킷이 생긴다.
 * ai.origin 은 손대지 않는다 — 자동 경로가 "user" 를 만들지 않는 제로 부트스트랩 규약.
 */
export function importStructureKits(
  tilesetId: TilesetId,
  entries: readonly { readonly kit: SectionStructureKitDef; readonly name: string }[],
): number {
  if (entries.length === 0) return 0;
  const prepared = entries.map((entry) => ({
    ...entry.kit,
    id: `kit_${randomUuid()}`,
    name: entry.name,
    learnedFrom: "db-authored" as const,
  }));
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    tileset.structureKits = [...(tileset.structureKits ?? []), ...prepared.map((kit) => structuredClone(kit))];
  });
  return prepared.length;
}
```

- [ ] **Step 4: 파일 선택과 다이얼로그를 구현한다**

`src/editor/panels/structureKitImportDialog.ts`:

```ts
// panels/structureKitImportDialog.ts
// 구조물 가져오기 — 3단 게이트의 마지막 두 단을 사람에게 보여준다.
//   ① 파일 검증 실패 → 창을 열지 않고 토스트 (parseStructureKitFile 이 던진다)
//   ② 킷 검증 실패 → 그 킷만 회색으로 이유와 함께 남는다 (planImport.diagnostics)
//   ③ 칩셋 불일치 → 경고 배너 + [그래도 가져오기]
// 판정은 전부 planImport 가 끝냈다 — 여기는 계획을 그리기만 한다.

import { importStructureKits } from "@/editor/harnessSuggestion/structureKitActions";
import {
  parseStructureKitFile,
  planImport,
  StructureKitFileError,
  type ImportPlan,
} from "@/editor/harnessSuggestion/structureKitFile";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { store } from "@/project/store";
import type { TilesetId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export function pickAndImportStructureKits(tilesetId: TilesetId, onDone: () => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const tileset = store.getCurrent().tilesets[tilesetId];
      if (!tileset) return;
      try {
        const { file: parsed, diagnostics } = parseStructureKitFile(String(reader.result));
        const plan = planImport(parsed, tileset, tileset.structureKits ?? [], diagnostics);
        openStructureKitImportDialog(tilesetId, plan, onDone);
      } catch (error) {
        const message = error instanceof StructureKitFileError ? error.message : "가져오기 실패";
        toast(message, "error");
      }
    };
    reader.onerror = () => toast("파일 읽기 실패", "error");
    reader.readAsText(file);
  });
  input.click();
}

export function openStructureKitImportDialog(tilesetId: TilesetId, plan: ImportPlan, onDone: () => void): void {
  const checked = new Set(
    plan.candidates.filter((candidate) => candidate.defaultChecked).map((candidate) => candidate.kit.id),
  );

  const content: HTMLElement[] = [];

  if (plan.tilesetMismatch) {
    const targetName = store.getCurrent().tilesets[tilesetId]?.name ?? tilesetId;
    content.push(
      el("div", {
        class: "structure-kit-import-warn",
        dataset: { testid: "structure-kit-import-mismatch" },
        children: [
          el("strong", { text: "다른 칩셋의 구조물입니다" }),
          el("p", {
            text: `파일: ${plan.fileTilesetName} · 지금 앨범: ${targetName}`
              + " — 구조물은 타일 번호 배열이라 칩셋이 다르면 그림이 깨집니다.",
          }),
        ],
      }),
    );
  }

  const list = el("div", { class: "structure-kit-import-list", dataset: { testid: "structure-kit-import-list" } });
  for (const candidate of plan.candidates) {
    const badges: HTMLElement[] = [];
    if (candidate.duplicate) badges.push(el("span", { class: "structure-kit-part-badge gray", text: "이미 있음" }));
    if (candidate.nameConflict) badges.push(el("span", { class: "structure-kit-part-badge teal", text: "이름 중복" }));

    list.append(
      el("label", {
        class: "structure-kit-import-row",
        children: [
          el("input", {
            attrs: checked.has(candidate.kit.id) ? { type: "checkbox", checked: "" } : { type: "checkbox" },
            dataset: { testid: `structure-kit-import-check-${candidate.kit.id}` },
            on: {
              click: () => {
                if (checked.has(candidate.kit.id)) checked.delete(candidate.kit.id);
                else checked.add(candidate.kit.id);
              },
            },
          }),
          el("span", { class: "structure-kit-import-name", text: candidate.resolvedName }),
          el("span", { class: "structure-kit-import-size", text: `${candidate.kit.width}×${candidate.kit.height}` }),
          ...badges,
        ],
      }),
    );
  }

  for (const diagnostic of plan.diagnostics) {
    list.append(
      el("div", {
        class: "structure-kit-import-row broken",
        dataset: { testid: `structure-kit-import-broken-${diagnostic.index}` },
        children: [
          el("span", { class: "structure-kit-import-name", text: diagnostic.name }),
          el("span", { class: "structure-kit-import-reason", text: diagnostic.reason }),
        ],
      }),
    );
  }

  if (plan.candidates.length === 0 && plan.diagnostics.length === 0) {
    list.append(el("p", { class: "structure-kit-quiet", text: "파일에 가져올 구조물이 없습니다." }));
  }

  content.push(
    el("div", {
      class: "structure-kit-import-head",
      text: `${plan.candidates.length}개의 구조물을 찾았습니다`
        + (plan.diagnostics.length > 0 ? ` · ${plan.diagnostics.length}개는 읽을 수 없습니다` : ""),
    }),
    list,
  );

  openDialog(
    "structure-kit-import",
    plan.tilesetMismatch ? "가져오기 — 칩셋 확인" : "구조물 가져오기",
    content,
    [
      {
        label: plan.tilesetMismatch ? "그래도 가져오기" : "가져오기",
        testid: "structure-kit-import-confirm",
        action: () => {
          const entries = plan.candidates
            .filter((candidate) => checked.has(candidate.kit.id))
            .map((candidate) => ({ kit: candidate.kit, name: candidate.resolvedName }));
          const added = importStructureKits(tilesetId, entries);
          toast(added > 0 ? `구조물 ${added}개를 가져왔습니다` : "가져온 구조물이 없습니다", added > 0 ? "ok" : "info");
          onDone();
        },
      },
      { label: "취소", testid: "structure-kit-import-cancel" },
    ],
  );
}
```

- [ ] **Step 5: CSS 를 더한다**

```css
.structure-kit-import-warn {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--warn-bg, rgba(217, 119, 6, 0.12));
  color: var(--warn-text, #B45309);
  margin-bottom: 10px;
  font-size: 12px;
}

.structure-kit-import-head {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.structure-kit-import-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.structure-kit-import-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 12px;
}

.structure-kit-import-row.broken {
  opacity: 0.55;
}

.structure-kit-import-size {
  color: var(--text-3, #6B6259);
}

.structure-kit-import-reason {
  color: var(--danger-text, #B91C1C);
  margin-left: auto;
}
```

- [ ] **Step 6: Task 18 의 import 를 연결한다**

`structureKitDbTab.ts` 에 `import { pickAndImportStructureKits } from "@/editor/panels/structureKitImportDialog";` 를 더한다. `serializeStructureKitFile`·`structureKitFileName`·`downloadBlob` import 도 함께 건다. 인스펙터에도 같은 세 개를 건다.

- [ ] **Step 7: 전체 테스트와 타입 검사**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/structureKitDbTab.test.ts test/structureKitEditorDialog.test.ts test/structureKitFile.test.ts test/structureKitRasterModel.test.ts test/structureKitTools.test.ts test/downloadBlob.test.ts && npx tsc --noEmit -p tsconfig.app.json`

Expected: 전부 PASS, 오류 없음

- [ ] **Step 8: 커밋 (Task 18 과 함께)**

```bash
git add src/editor/panels/structureKitDbTab.ts src/editor/panels/structureKitInspector.ts src/editor/panels/structureKitImportDialog.ts src/editor/harnessSuggestion/structureKitActions.ts src/styles/editor/harness-suggestion.css test/structureKitDbTab.test.ts test/structureKitEditorDialog.test.ts
git commit -m "$(cat <<'EOF'
feat(database): 구조물을 파일로 주고받는다

내보내기 대상은 내 구조물뿐이다 — 내장 건물과 실내 오브젝트는 모든 프로젝트에
코드 상수로 이미 있어 주고받을 이유가 없다. 읽기 전용 행을 고르면 내보내기 자리에
[내 구조물로 복제]가 있어 자연스럽게 유도된다.

가져오기는 3단 게이트다. 파일 검증 실패는 창을 열지 않고, 킷 검증 실패는 그 킷만
이유와 함께 회색으로 남으며, 칩셋 불일치는 경고 배너 뒤에 [그래도 가져오기]를 둔다.

가져온 킷의 learnedFrom 은 db-authored 로 굳힌다 — builtin-parametric 을 그대로
두면 프로젝트 데이터인데 편집이 잠긴 유령 킷이 생긴다. ai.origin 은 손대지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: e2e — 실제 브라우저에서의 왕복

유닛 테스트는 캔버스에 그려진 것을 볼 수 없고 화면 좌표가 전부 0 이다. 실제 클릭·다운로드·파일 선택은 여기서만 증명된다.

**Files:**
- Create: `test/e2e/db-structure-editor.spec.ts`

**Interfaces:**
- Consumes: 앞선 모든 태스크의 `data-testid`

- [ ] **Step 1: e2e 를 쓴다**

진입 경로는 기존 DB e2e 들이 쓰는 것과 같다 — `/?freshProject=1` → `toolbar-database` → `database-modal` → `db-tab-structure-kits` (`test/e2e/_db-modern-overhaul-spot.spec.ts:20-35`, `database.ts:81`).

```ts
import { expect, test, type Page } from "@playwright/test";

// 유닛 테스트(environment:"node" + FakeElement)는 캔버스를 그리지 않고
// getBoundingClientRect 가 전부 0 이라, 실제 클릭 좌표 → 칸 매핑과
// 다운로드·파일 선택 왕복은 브라우저에서만 증명된다.

async function openStructureTab(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  const dbButton = page.getByTestId("toolbar-database");
  await expect(dbButton).toBeVisible({ timeout: 15_000 });
  await dbButton.click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("db-tab-structure-kits").click({ force: true });
  await expect(page.getByTestId("structure-kit-heading")).toBeVisible();
}

/** 빈 3×3 으로 새 구조물을 만들고 편집기를 연 상태로 둔다. */
async function newBlankKit(page: Page): Promise<void> {
  await page.getByTestId("structure-kit-new").click();
  // combined_town 앨범이면 시작점 선택 창이 먼저 뜬다.
  const blank = page.getByTestId("structure-kit-new-blank");
  if (await blank.count() > 0) await blank.click();
  await expect(page.getByTestId("structure-kit-editor")).toBeVisible();
}

test.describe("데이터베이스 구조물 편집기", () => {
  test("새 구조물을 만들고 타일을 칠한다", async ({ page }) => {
    await openStructureTab(page);
    await newBlankKit(page);

    const canvas = page.getByTestId("structure-kit-editor-canvas");
    await expect(canvas).toBeVisible();

    await page.getByTestId("structure-kit-editor-tile-240").click();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await page.getByTestId("structure-kit-editor-close").click();
    await expect(page.getByTestId("structure-kit-editor")).toHaveCount(0);
    await expect(page.getByText("새 구조물")).toBeVisible();
  });

  test("부위를 드래그로 그리면 목록에 뜬다", async ({ page }) => {
    await openStructureTab(page);
    await newBlankKit(page);

    await page.getByTestId("structure-kit-editor-tool-part").click();
    const box = (await page.getByTestId("structure-kit-editor-canvas").boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8);
    await page.mouse.up();

    await expect(page.getByTestId("structure-kit-editor-parts")).toContainText("부위 (1)");
  });

  test("내보낸 파일을 다시 가져오면 '이미 있음'으로 걸러진다", async ({ page }, testInfo) => {
    await openStructureTab(page);
    await newBlankKit(page);
    await page.getByTestId("structure-kit-editor-tile-240").click();
    const box = (await page.getByTestId("structure-kit-editor-canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByTestId("structure-kit-editor-close").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("structure-kit-export").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(".rpgzzu-kit.json");

    const savedPath = testInfo.outputPath("kits.rpgzzu-kit.json");
    await download.saveAs(savedPath);

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByTestId("structure-kit-import").click();
    const chooser = await chooserPromise;
    await chooser.setFiles(savedPath);

    // 서명이 같으므로 중복으로 표시되고 기본 체크가 풀려 있어야 한다 —
    // 같은 파일을 두 번 가져와도 사본이 쌓이지 않는다.
    await expect(page.getByTestId("structure-kit-import-list")).toContainText("이미 있음");
    await page.getByTestId("structure-kit-import-cancel").click();
  });
});
```

- [ ] **Step 2: e2e 를 돌린다**

Run: `npx playwright test test/e2e/db-structure-editor.spec.ts`

Expected: 3 passed

- [ ] **Step 3: 전체 유닛 테스트 회귀 확인**

Run: `node scripts/run-vitest.mjs run --configLoader bundle`

Expected: 기존 스위트가 이 작업 전과 같은 수로 통과한다. 실패가 있으면 이 계획이 건드린 파일과 관련된 것인지 확인하고 고친다.

- [ ] **Step 4: 빌드 확인**

Run: `npx tsc --noEmit -p tsconfig.app.json`

Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add test/e2e/db-structure-editor.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): 구조물 편집기의 클릭·부위 드래그·파일 왕복을 증명한다

유닛 테스트는 environment:"node" + FakeElement 라 캔버스를 그리지 않고
getBoundingClientRect 가 전부 0 이다. 실제 클릭 좌표 → 칸 매핑과
다운로드·파일 선택 왕복은 브라우저에서만 증명된다.

내보낸 파일을 같은 앨범에 다시 가져오면 서명이 같아 "이미 있음"으로 뜨는지까지
확인해, 같은 파일을 두 번 가져와도 사본이 쌓이지 않음을 못 박는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```
