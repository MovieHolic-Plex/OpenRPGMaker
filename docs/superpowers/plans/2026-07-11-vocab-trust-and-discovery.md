# Vocab 신뢰 시드·발견성·커버리지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI가 타일을 못 까는 3중 마찰(승인 시드 0개 · 죽은 보류-시공 댄스 지시 · 그룹 id 발견 경로 부재)을 제거하고 잔디 채우기 커버리지를 추가한다.

**Architecture:** (1단계) 번들 하네스 그룹(`source:"bundled-default"`)을 승인 동급으로 신뢰하고, soft-allow 전환 때 죽은 pendingBuilds(보류 시공 융합) 기계와 그것을 지시하는 프롬프트 문구를 제거한다. (2단계) `tile_query ask:"vocab"` + 시스템 프롬프트 어휘 다이제스트 + missing 시 후보 제시로 그룹 id 발견 루프를 1턴으로 줄인다. (3단계) 잔디 autotile 그룹을 신설한다.

**Tech Stack:** vanilla TS, vitest (`npx vitest run <파일> --configLoader runner`), 도구 카탈로그 재생성 `node scripts/generateToolCatalog.mjs`.

## Global Constraints

- 브랜치: `feat/vocab-trust-and-discovery` (main에서 분기). 커밋 메시지는 한국어 관례(`feat(vocab): …`) + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- vitest는 반드시 `--configLoader runner` 플래그로 실행.
- `test/aiLlmClient.test.ts` 실패는 `.env.local` 환경 요인이므로 무시(회귀 아님).
- 도구 description을 바꾼 태스크는 마지막에 `node scripts/generateToolCatalog.mjs`로 `docs/tool-catalog.md` 재생성까지가 완료 조건.
- 지키는 불변식: ① AI 추정 이름의 신규 그룹은 여전히 사용자 수락 필요(origin:"user" 마킹은 기존 3경로만) ② layerHome 계약 유지 ③ fill_region의 autotile_3x3/animated_terrain 게이트 유지(단색 plain-fill 금지 유지).
- **돌바닥 그룹은 이번에 만들지 않는다** — 이 칩셋의 돌바닥 타일(342/343)은 통행 불가(함정용, `tileSemanticsCombinedTown.ts:28`)라 던전 통로로 깔면 게임이 깨진다. 통행성 정책 결정이 필요한 후속 과제로 ledger에 기록.

---

### Task 1: 번들 하네스 그룹 승인 시드 (1단계-A)

**Files:**
- Modify: `src/project/tileVocabulary.ts:47-53` (판정 predicate), `:63-73` (approvedVocabulary), `:88-103` (unapprovedVocabulary)
- Modify: `test/vocabSoftConfirm.test.ts` (bundled=미승인 가정 반전)
- Test: `test/tileVocabularyV3.test.ts`

**Interfaces:**
- Produces: `isTrustedGroupSource(group: TileGroupMetadata): boolean` — origin==="user" 또는 source==="bundled-default"면 true. Task 4·6이 사용하는 `approvedVocabulary()`의 그룹 목록이 번들 그룹을 포함하게 됨.
- 낱개 타일 판정(`isApprovedTile`)은 **바꾸지 않는다** — 번들 신뢰는 큐레이션된 "그룹"에만 적용(낱개 타일 라벨은 반자동 생성이라 zero-trust 유지).

- [ ] **Step 1: 실패하는 테스트 추가** — `test/tileVocabularyV3.test.ts`에 추가:

```ts
describe("번들 하네스 그룹 승인 시드 (2026-07-11)", () => {
  it("source:bundled-default 그룹은 origin 없이도 승인으로 판정된다", () => {
    const tileset = makeTileset(); // 파일 기존 헬퍼 사용. 없으면 emptyProject().tilesets 기본 타일셋 사용
    tileset.tileGroups = [{
      id: "g-bundled", name: "번들 벽", role: "wall", defaultLayer: "lower",
      tileIds: [1, 2, 3], description: "", placementRules: "", source: "bundled-default",
    } as TileGroupMetadata];
    expect(isApprovedGroup(tileset, "g-bundled")).toBe(true);
    const access = resolveVocabForBuild(tileset, { groupId: "g-bundled" });
    expect(access.status).toBe("approved");
  });
  it("AI가 만든 그룹(origin/source 없음 또는 origin:ai)은 여전히 soft다", () => {
    const tileset = makeTileset();
    tileset.tileGroups = [{
      id: "g-ai", name: "AI 추정 벽", role: "wall", defaultLayer: "lower",
      tileIds: [1], description: "", placementRules: "", origin: "ai",
    } as TileGroupMetadata];
    expect(isApprovedGroup(tileset, "g-ai")).toBe(false);
    expect(resolveVocabForBuild(tileset, { groupId: "g-ai" }).status).toBe("soft");
  });
  it("unapprovedVocabulary는 번들 그룹을 미승인 목록에서 제외한다", () => {
    const tileset = makeTileset();
    tileset.tileGroups = [
      { id: "g-b", name: "번들", role: "prop", defaultLayer: "lower", tileIds: [1], description: "", placementRules: "", source: "bundled-default" } as TileGroupMetadata,
      { id: "g-a", name: "AI", role: "prop", defaultLayer: "lower", tileIds: [2], description: "", placementRules: "", origin: "ai" } as TileGroupMetadata,
    ];
    const summary = unapprovedVocabulary(tileset);
    expect(summary.groups.map((g) => g.id)).toEqual(["g-a"]);
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run test/tileVocabularyV3.test.ts --configLoader runner` → 신규 3케이스 FAIL.

- [ ] **Step 3: 구현** — `src/project/tileVocabulary.ts`의 47-53행을 다음으로 교체:

```ts
// 번들 하네스 그룹은 사람이 큐레이션한 재료라 zero-trust가 막으려는 "AI 추정 이름"이
// 아니다. origin:"user"(명시 합의)와 동급으로 신뢰한다(2026-07-11 승인 시드).
// 낱개 타일(tileMeta)에는 적용하지 않는다 — 라벨이 반자동 생성이라 목업 확인 유지.
export function isTrustedGroupSource(group: TileGroupMetadata): boolean {
  return group.origin === "user" || group.source === "bundled-default";
}

export function isApprovedTile(tileset: TilesetDef, tileId: number): boolean {
  return tileset.tileMeta?.[tileId]?.origin === "user";
}

export function isApprovedGroup(tileset: TilesetDef, groupId: string): boolean {
  const group = findGroup(tileset, groupId);
  return group ? isTrustedGroupSource(group) : false;
}
```

그리고 65행 `approvedVocabulary`의 필터를 `.filter((group) => isTrustedGroupSource(group))`로, 90행 `unapprovedVocabulary`의 필터를 `.filter((group) => !isTrustedGroupSource(group))`로 교체. 파일 헤더 주석(4-10행)에 규약 한 줄 추가: `// - 그룹 한정 예외: source === "bundled-default"(큐레이션 번들)는 origin:"user"와 동급 신뢰(2026-07-11).`

- [ ] **Step 4: 기존 테스트 정합** — `npx vitest run test/vocabSoftConfirm.test.ts test/constructionToolsV3.test.ts test/tileVocabularyV3.test.ts test/tileBuildFusion.test.ts --configLoader runner`. 규칙: `source:"bundled-default"` 그룹이 "미승인/soft/목업 확인"이라고 단언하는 케이스는 전부 승인/approved 기대로 반전한다(예: `test/vocabSoftConfirm.test.ts:33`의 `isApprovedGroup(...) === false` → `true`, soft-confirm 경고 존재 단언 → 부재 단언). soft 동작 자체를 검증하는 케이스는 픽스처 그룹의 `source`를 제거하거나 `origin:"ai"`로 바꿔 soft 경로를 유지시킨다 — 케이스의 의도(승인 시드 검증 vs soft 흐름 검증)에 따라 선택.

- [ ] **Step 5: 통과 확인 후 커밋**

```bash
git add src/project/tileVocabulary.ts test/tileVocabularyV3.test.ts test/vocabSoftConfirm.test.ts test/constructionToolsV3.test.ts test/tileBuildFusion.test.ts
git commit -m "feat(vocab): 번들 하네스 그룹 승인 시드 — source:bundled-default를 origin:user 동급 신뢰"
```

---

### Task 2: 죽은 보류-시공(pendingBuilds) 기계 제거 (1단계-B)

**배경:** 보류 시공 기록 조건은 `issue.code === "unapproved-vocabulary"`(assistantSession.ts:662)인데 이 코드를 던지는 `assertApprovedOrFail`(tileVocabulary.ts:243-254)은 프로덕션 호출이 0건이다(soft-allow 전환으로 도달 불가). 기계 전체와 레거시 API를 제거한다.

**Files:**
- Modify: `src/ai/assistantSession.ts` — `PendingBuild` 인터페이스(:63), `ProposedCall.pendingBuilds`(:82), `V3_PRIMITIVE_VOCAB_FIELDS`(:116, 다른 사용처 grep 후 미사용이면 제거), `turnPendingBuilds`(:411), `recordPendingBuildIfUnapproved`(:658-671)와 그 호출부, `finalizeProposals`(:675-683)를 `return [...proposedByKey.values()];` 한 줄로 단순화, `pendingBuildLabel` 헬퍼 제거
- Modify: `src/editor/panels/aiProposalFusion.ts` — `SelectedPendingBuild`/`collectPendingBuilds`/`rebindPendingBuildArgs`/`PendingBuildOutcome`/`runPendingBuilds` 제거. **유지:** `collectVocabSoftConfirms`, `markSoftVocabApprovalsOnProject`. `proposalAcceptButtonLabel`은 `(selectedCount, total)` 시그니처로 단순화(hasPendingBuild 분기 제거 — 두 분기 문자열이 동일했음)
- Modify: `src/editor/panels/aiProposalCard.ts:36-42(import), :252-269(융합 실행), :457(hasPending)` — 융합 경로 제거, 수락 시 `markSoftVocabApprovalsOnProject` + 기존 적용 흐름만 남김
- Modify: `src/editor/panels/aiChatPanel.ts:124-129(import)` 및 대응 융합 소비부 — 동일 수술
- Modify: `src/project/tileVocabulary.ts:242-280` — `assertApprovedOrFail`/`unapprovedMessage`/`proposeExampleForGroup`/`proposeExampleForTile` 제거, 미사용이 되면 `ToolError` import 제거
- Modify: `src/ai/buildSpec.ts:66` — assertApprovedOrFail 언급 주석을 "시공 프리미티브는 resolveVocabForBuild soft-allow"로 정정
- Delete: `test/tileBuildFusion.test.ts` (융합 기계 전용 테스트)
- Test: `test/aiProposalSoftConfirm.test.ts` (신규)

**Interfaces:**
- Consumes: Task 1의 승인 시드(번들 그룹은 이제 softConfirm 자체가 안 붙음)
- Produces: `ProposedCall`에서 `pendingBuilds` 필드 소멸 — 이후 태스크는 이 필드를 참조하면 안 됨

- [ ] **Step 1: 사용처 전수 조사** — `grep -rn "pendingBuilds\|PendingBuild\|assertApprovedOrFail\|unapproved-vocabulary\|V3_PRIMITIVE_VOCAB_FIELDS" src/ test/` 로 위 목록 외 사용처가 없는지 확인. 있으면 그 파일도 이 태스크에서 함께 정리.

- [ ] **Step 2: 회귀 방지 테스트 신설** — `test/aiProposalSoftConfirm.test.ts`:

```ts
// 융합 기계 제거 후에도 soft-confirm 수락 훅이 동작하는지 고정한다.
import { describe, expect, it } from "vitest";
import { collectVocabSoftConfirms, markSoftVocabApprovalsOnProject } from "@/editor/panels/aiProposalFusion";
import { emptyProject } from "@/editor/tools/emptyProject";

describe("soft-confirm 수락 (pendingBuilds 제거 후)", () => {
  it("proposedCalls의 vocabSoftConfirm을 수집해 origin:user로 마킹한다", () => {
    const project = emptyProject();
    const tilesetId = Object.keys(project.tilesets)[0];
    const tileset = project.tilesets[tilesetId];
    tileset.tileGroups = [...(tileset.tileGroups ?? []), {
      id: "g-soft", name: "soft 재료", role: "prop", defaultLayer: "lower",
      tileIds: [5], description: "", placementRules: "", origin: "ai",
    } as never];
    const calls = [{
      name: "place_props", args: {},
      result: { ok: true, summary: "", data: { vocabSoftConfirm: {
        kind: "group", groupId: "g-soft", tileIds: [5], name: "soft 재료", role: "prop", layerHome: "lower", tilesetId,
      } } },
    }] as never;
    expect(collectVocabSoftConfirms(calls).length).toBe(1);
    const marked = markSoftVocabApprovalsOnProject(project, calls);
    expect(marked).toBe(1);
    expect(project.tilesets[tilesetId].tileGroups?.find((g) => g.id === "g-soft")?.origin).toBe("user");
  });
});
```

- [ ] **Step 3: 기계 제거 구현** — 위 Files 목록 순서대로 수술. aiProposalCard/aiChatPanel의 융합 블록은 "수락 → `markSoftVocabApprovalsOnProject` → 기존 커밋 흐름"만 남기고, `fusionOutcomes` 관련 렌더링·상태를 제거한다. 주변 코드의 스타일(주석 밀도, 네이밍)을 따른다.

- [ ] **Step 4: 타입/테스트 확인** — `npx tsc --noEmit -p tsconfig.app.json` 통과 + `npx vitest run test/aiProposalSoftConfirm.test.ts test/assistantSession*.test.ts --configLoader runner` (assistantSession 테스트 파일명은 glob으로 확인) 통과. tileBuildFusion.test.ts 삭제 반영.

- [ ] **Step 5: 커밋**

```bash
git add -A src/ai/assistantSession.ts src/editor/panels/aiProposalFusion.ts src/editor/panels/aiProposalCard.ts src/editor/panels/aiChatPanel.ts src/project/tileVocabulary.ts src/ai/buildSpec.ts test/
git commit -m "refactor(vocab): 도달 불가 보류-시공(pendingBuilds) 기계·assertApprovedOrFail 제거"
```

---

### Task 3: 프롬프트·도구 설명을 soft-allow 현실로 정합 (1단계-C)

**배경:** 도구 설명들이 폐기된 "propose → 같은 턴 시공 실패 → 승인 카드에 보류 묶임" 댄스를 지시한다. 모델이 이를 따르면 제안만 하고 타일 0칸.

**Files:**
- Modify: `src/editor/tools/v3/vocabularyTools.ts:193(description), :259(summary)`
- Modify: `src/editor/tools/tileQueryTool.ts:76-78(unapproved summary), :24(도구 description의 unapproved 설명)`
- Modify: `src/ai/skills.ts:378`
- Modify: `src/editor/tools/v3/constructionTools.ts` — build_roof(:330)·place_door(:405)·place_window(:425)·lay_path(:460)·fill_region(:610) description의 "승인된" 표현, fill_region `tileVocabId` 파라미터 설명(:625), `assertFillRegionGroup` 메시지(:601-604)
- Regenerate: `docs/tool-catalog.md`
- Test: `test/toolCatalog.test.ts`가 있으면 재생성 후 통과 확인(카탈로그-코드 동기 검증)

**Interfaces:**
- Consumes: Task 1(번들=승인), Task 2(보류 묶임 소멸)
- Produces: 없음(문구만)

- [ ] **Step 1: vocabularyTools 문구 교체**

`:193` description을 다음으로:

```
"신규 재료(어휘에 없는 타일 조합)를 승인 어휘로 편입하자고 사용자에게 제안한다(v3). items마다 kind=group(9분할 벽·기둥·오토타일 등 패턴 단위, groupId=기존 그룹 또는 tileIds=신규)/kind=tile(낱개 소품, tileIds). 기존 그룹 재제안은 groupId만 보내라(tileIds 불필요). name/role/patternKind/layerHome은 너의 추정이며 카드에서 사용자가 교정 후 수락한다. **이미 존재하는 그룹/타일로 시공할 때는 이 툴이 필요 없다 — build_wall 등 프리미티브를 바로 호출하면 미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의된다.** 이 툴은 '어휘에 아직 없는 새 재료'를 정의할 때만 쓴다."
```

`:259` summary를 다음으로:

```ts
summary: `타일 어휘 ${cards.length}건 제안(${names}).${failureSummary} 사용자가 카드에서 수락하면 어휘가 등록됩니다. 이미 존재하는 재료의 시공은 이 제안과 무관하게 build_wall/fill_region 등을 바로 호출하세요(미합의 재료도 맵 목업 후 확인).`,
```

- [ ] **Step 2: tileQueryTool 문구 교체** — `:76-78` summary를:

```ts
summary:
  `미승인 어휘: 그룹 ${summary.groupCount}개, 타일 ${summary.tileCount}개 — 존재하는 그룹은 승인 여부와 무관하게 ` +
  "시공 프리미티브(build_wall 등)를 바로 호출할 수 있습니다(미합의는 맵 목업 확인). 새 재료 정의가 필요할 때만 propose_tile_vocabulary를 쓰세요.",
```

도구 description(:24)의 `unapproved` 항 설명도 "미승인 어휘 요약 — 배치 전 propose_tile_vocabulary 대상 확인"에서 "미승인 어휘 요약(신규 재료 정의가 필요한지 확인용 — 존재하는 재료 시공에는 불필요)"로 교체.

- [ ] **Step 3: skills·constructionTools 문구 교체** — `skills.ts:378`의 "길 어휘가 미승인이면 propose_tile_vocabulary로 먼저 합의하세요." → "존재하는 길 어휘는 바로 쓸 수 있습니다(미합의는 목업 확인). 어휘에 없는 새 길 재료가 필요할 때만 propose_tile_vocabulary."  constructionTools 5곳의 "승인된 X 어휘"를 "X 어휘"로 바꾸고 각 설명 끝에 "(미합의 재료도 맵에 그려지고 사용자 목업 확인으로 합의)"를 1회 삽입. `assertFillRegionGroup` 메시지의 "승인된 autotile_3x3/…"에서 "승인된 " 제거.

- [ ] **Step 4: 카탈로그 재생성 + 확인** — `node scripts/generateToolCatalog.mjs` 실행 후 `git diff docs/tool-catalog.md`로 위 문구만 바뀌었는지 확인. 관련 테스트: `npx vitest run test/toolCatalog* test/regionIntentExposure.test.ts --configLoader runner` (regionIntentExposure는 가이드 문구가 도구 노출에 영향 주는지 검증하므로 반드시 실행).

- [ ] **Step 5: 커밋**

```bash
git add src/editor/tools/v3/vocabularyTools.ts src/editor/tools/tileQueryTool.ts src/ai/skills.ts src/editor/tools/v3/constructionTools.ts docs/tool-catalog.md
git commit -m "docs(vocab): 폐기된 보류-시공 댄스 지시 제거 — soft-allow 현실로 프롬프트 정합"
```

---

### Task 4: missing 실패에 유사 그룹 후보 제시 (2단계-A)

**Files:**
- Modify: `src/project/tileVocabulary.ts` (suggestVocabGroups 신설)
- Modify: `src/editor/tools/v3/constructionTools.ts:103-114` (requireBuildGroup missing 분기)
- Test: `test/tileVocabularyV3.test.ts`, `test/constructionToolsV3.test.ts`

**Interfaces:**
- Produces: `suggestVocabGroups(tileset: TilesetDef, query: string, limit?: number): { id: string; name: string; role: string }[]` — Task 5·6은 사용하지 않음(독립).

- [ ] **Step 1: 실패하는 테스트** — `test/tileVocabularyV3.test.ts`에:

```ts
describe("suggestVocabGroups", () => {
  it("'돌벽' 질의에 석벽 계열 그룹을 후보로 돌려준다", () => {
    const project = emptyProject();
    const tileset = Object.values(project.tilesets)[0];
    const ids = suggestVocabGroups(tileset, "돌벽").map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.includes("timber-stone-wall") || id.includes("castle-wall"))).toBe(true);
  });
  it("id 부분 문자열로도 찾는다", () => {
    const project = emptyProject();
    const tileset = Object.values(project.tilesets)[0];
    const ids = suggestVocabGroups(tileset, "stone-wall").map((s) => s.id);
    expect(ids.some((id) => id.includes("timber-stone-wall"))).toBe(true);
  });
});
```

(전제: `emptyProject()`의 기본 타일셋에 하네스 그룹이 설치돼 있음 — 아니면 `ensure` 계열 헬퍼(`src/editor/regionTask/runRegionTask.ts`가 쓰는 것과 동일)를 테스트 셋업에서 호출. 기존 테스트 파일의 픽스처 관례를 따른다.)

- [ ] **Step 2: 실패 확인** — 위 테스트 FAIL.

- [ ] **Step 3: 구현** — `tileVocabulary.ts`에 추가:

```ts
// 한국어 재료어 → 그룹 검색어 확장(발견성). 정확 일치 실패 시 후보 제시에만 쓴다 — 자동 대체 금지.
const VOCAB_QUERY_SYNONYMS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/돌벽|석벽|돌담/, ["stone", "wall", "castle"]],
  [/벽/, ["wall"]],
  [/길|도로/, ["path", "road", "dirt", "sand"]],
  [/물|호수|연못|강/, ["water", "lake"]],
  [/나무|수목/, ["tree", "conifer", "broadleaf"]],
  [/울타리|담장/, ["fence"]],
  [/지붕/, ["roof"]],
  [/문/, ["door"]],
  [/잔디|풀/, ["grass"]],
];

export function suggestVocabGroups(
  tileset: TilesetDef,
  query: string,
  limit = 3
): { id: string; name: string; role: string }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const terms = new Set<string>([needle]);
  for (const [pattern, expansions] of VOCAB_QUERY_SYNONYMS) {
    if (pattern.test(needle)) expansions.forEach((term) => terms.add(term));
  }
  const scored = (tileset.tileGroups ?? []).map((group) => {
    const haystacks = [group.id, group.name, group.description ?? "", group.role].map((s) => s.toLowerCase());
    let score = 0;
    for (const term of terms) {
      if (haystacks[0].includes(term)) score += 3; // id 일치가 가장 신뢰도 높음
      if (haystacks[1].includes(term)) score += 2;
      if (haystacks[2].includes(term)) score += 1;
      if (haystacks[3].includes(term)) score += 1;
    }
    return { group, score };
  }).filter((entry) => entry.score > 0);
  scored.sort((a, b) => b.score - a.score || a.group.id.localeCompare(b.group.id));
  return scored.slice(0, Math.max(0, limit)).map(({ group }) => ({ id: group.id, name: group.name, role: group.role }));
}
```

- [ ] **Step 4: requireBuildGroup 연결** — `constructionTools.ts:106-108` missing 분기를:

```ts
if (access.status === "missing") {
  const suggestions = suggestVocabGroups(tileset, String(vocabId));
  const hint = suggestions.length > 0
    ? ` 비슷한 그룹: ${suggestions.map((s) => `${s.id}(${s.name}/${s.role})`).join(", ")} — 이 중 하나로 다시 호출하세요.`
    : " tile_query ask:\"vocab\"으로 전체 그룹 id를 조회하세요.";
  throw new ToolError(`${access.message}${hint} — 다시 보낼 형식 예시: ${JSON.stringify(example)}`, { code: "group-not-found" });
}
```

(import에 `suggestVocabGroups` 추가.) `test/constructionToolsV3.test.ts`에 케이스 추가: `build_wall`을 `wallVocabId:"돌벽"`으로 호출하면 에러 메시지에 "비슷한 그룹"과 실존 그룹 id가 포함된다.

- [ ] **Step 5: 통과 확인 + 커밋**

```bash
git add src/project/tileVocabulary.ts src/editor/tools/v3/constructionTools.ts test/tileVocabularyV3.test.ts test/constructionToolsV3.test.ts
git commit -m "feat(vocab): missing 어휘 실패에 유사 그룹 후보 제시 — 추측 루프를 1턴으로"
```

---

### Task 5: `tile_query ask:"vocab"` — 전체 그룹 카탈로그 조회 (2단계-B)

**Files:**
- Modify: `src/editor/tools/tileQueryTool.ts` (ask enum·description·분기)
- Test: `test/tileQueryTool.test.ts` (없으면 신설; 있으면 기존 파일에 추가 — `ls test/ | grep -i query`로 확인)
- Regenerate: `docs/tool-catalog.md`

**Interfaces:**
- Consumes: Task 1의 `approvedVocabulary()` (번들 포함)
- Produces: `ask:"vocab"` 응답 `data: { tilesetId, groups: {id,name,role,patternKind?,layerHome}[], looseTiles: {tileId,label,layerHome}[] }`

- [ ] **Step 1: 실패하는 테스트**

```ts
describe("tile_query ask:vocab", () => {
  it("승인 어휘 전체 그룹 목록을 role과 함께 돌려준다", () => {
    const project = emptyProject();
    const result = runTool({ project }, "tile_query", { ask: "vocab" }, { dryRun: true });
    expect(result.ok).toBe(true);
    const data = result.data as { groups: { id: string; role: string }[] };
    expect(data.groups.length).toBeGreaterThan(10); // 하네스 23종이 승인 시드로 잡힘
    expect(data.groups.some((g) => g.role === "wall")).toBe(true);
    expect(result.summary).toContain("wall");
  });
});
```

- [ ] **Step 2: 실패 확인** — "알 수 없는 tile_query ask" 실패.

- [ ] **Step 3: 구현** — `tileQueryTool.ts`의 unapproved 분기 앞에 추가:

```ts
if (ask === "vocab") {
  const tilesetId = typeof args.tilesetId === "string" && args.tilesetId ? args.tilesetId : DEFAULT_TILESET_ID;
  const tileset = draft.tilesets[tilesetId];
  if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: DEFAULT_TILESET_ID });
  const vocab = approvedVocabulary(tileset);
  const byRole = new Map<string, number>();
  for (const group of vocab.groups) byRole.set(group.role, (byRole.get(group.role) ?? 0) + 1);
  const roleSummary = [...byRole.entries()].map(([role, count]) => `${role} ${count}`).join(", ");
  return {
    summary: `사용 가능 어휘 그룹 ${vocab.groups.length}개(${roleSummary}) + 낱개 타일 ${vocab.tiles.length}개. 그룹 id를 wallVocabId/pathVocabId/tileVocabId/propVocabId에 그대로 넣어 시공 프리미티브를 호출하세요.`,
    data: {
      tilesetId,
      groups: vocab.groups.map((g) => ({ id: g.id, name: g.name, role: g.role, layerHome: g.layerHome, ...(g.patternKind ? { patternKind: g.patternKind } : {}) })),
      looseTiles: vocab.tiles.map((t) => ({ tileId: t.tileId, label: t.label, layerHome: t.layerHome })),
    },
  };
}
```

ask enum(parameters)과 description에 `vocab`를 추가: "vocab(사용 가능 어휘 그룹 전체 — 시공 id를 모를 때 여기부터)". `approvedVocabulary` import 추가. `unapprovedVocabulary`의 상위 10개 잘림 이슈는 ask:"vocab"이 전체를 주므로 별도 수정 불필요.

- [ ] **Step 4: 통과 확인 + 카탈로그 재생성** — 테스트 PASS + `node scripts/generateToolCatalog.mjs`.

- [ ] **Step 5: 커밋**

```bash
git add src/editor/tools/tileQueryTool.ts test/ docs/tool-catalog.md
git commit -m "feat(vocab): tile_query ask:vocab — 시공 가능 그룹 id 전체 조회"
```

---

### Task 6: 시스템 프롬프트 어휘 다이제스트에 그룹 id 주입 (2단계-C)

**Files:**
- Modify: `src/ai/contextBuilder.ts:144-168` (`tileVocabularySection`)
- Test: `test/contextBuilder.test.ts` (없으면 `ls test/ | grep -i context`로 실제 파일명 확인 후 그 파일에 추가)

**Interfaces:**
- Consumes: Task 1의 `approvedVocabulary()`
- Produces: 없음(프롬프트 문자열)

- [ ] **Step 1: 실패하는 테스트**

```ts
it("어휘 다이제스트에 role별 시공 그룹 id가 들어간다", () => {
  const project = emptyProject();
  const context = buildContext(project, { mapId: startMapId(project) }); // 파일의 기존 호출 관례를 따른다
  expect(context).toContain("harness-combined-town-plaster-wall-9slice");
  expect(context).toMatch(/wall:/);
});
```

- [ ] **Step 2: 실패 확인.**

- [ ] **Step 3: 구현** — `tileVocabularySection` 프리셋 루프 뒤에 추가:

```ts
const vocab = approvedVocabulary(tileset);
if (vocab.groups.length > 0) {
  const byRole = new Map<string, string[]>();
  for (const group of vocab.groups) {
    const bucket = byRole.get(group.role) ?? [];
    bucket.push(`${group.id}(${group.name})`);
    byRole.set(group.role, bucket);
  }
  for (const [role, entries] of byRole) lines.push(`- ${role}: ${entries.join(", ")}`);
}
```

그리고 섹션 머리 지시문(기존 "## 타일 어휘 다이제스트" 아래 안내문)에 한 문장 추가: "아래 그룹 id를 build_wall/lay_path/fill_region/place_props의 *VocabId 인자에 그대로 사용한다(추측 금지, 모르면 tile_query ask:\"vocab\")." `trimDigestLines(lines, 700)` 예산은 유지하되, 그룹 라인이 잘리는지 테스트에서 확인하고 잘리면 900으로 상향(커밋 메시지에 사유 명기).

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
git add src/ai/contextBuilder.ts test/
git commit -m "feat(vocab): 시스템 프롬프트 어휘 다이제스트에 role별 시공 그룹 id 주입"
```

---

### Task 7: 잔디 autotile 그룹 신설 (3단계)

**배경:** fill_region은 autotile_3x3/animated_terrain만 허용하는데 기본 타일셋의 자격 지형은 흙길·모래·호수물 3종뿐 — 코퍼스 1번 명령 "이 영역을 잔디로 채워줘"가 불가능했다. 잔디는 균질 지형이라 9파트 전부 잔디 변형 타일로 채우면 기존 전개기(autotile_3x3)가 그대로 동작한다. **돌바닥은 이번에 만들지 않는다**(Global Constraints 참조).

**Files:**
- Modify: `src/project/tilesetHarness/combinedTownGroups.ts` (grass 그룹 추가 — dirt-road 그룹 뒤)
- Test: `test/constructionToolsV3.test.ts`

**Interfaces:**
- Produces: 그룹 id `harness-combined-town-grass-autotile` — fill_region/paint 계열이 소비.

- [ ] **Step 1: 실패하는 테스트** — `test/constructionToolsV3.test.ts`에:

```ts
describe("잔디 채우기 (grass-autotile)", () => {
  it("fill_region이 잔디 그룹으로 사각형을 채운다", () => {
    const project = emptyProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "fill_region", {
      mapId, rect: { x: 2, y: 2, w: 4, h: 3 }, tileVocabId: "harness-combined-town-grass-autotile",
    }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect(result.warnings ?? []).not.toContain(expect.stringContaining("목업 확인 대기")); // 번들 시드라 soft 아님
  });
});
```

- [ ] **Step 2: 실패 확인** — "타일 그룹을 찾을 수 없습니다" FAIL.

- [ ] **Step 3: 구현** — `combinedTownGroups.ts`의 dirt-road 그룹 항목 뒤에 추가(파일 상단 import에 `TILE`은 이미 있음):

```ts
{
  id: `${COMBINED_TOWN_HARNESS_PREFIX}grass-autotile`,
  name: "잔디",
  role: "terrain",
  defaultLayer: "lower",
  tileIds: [TILE.GRASS, 270, 271, 272, 273, 300, 301, 302, 330, 331, 332, 333],
  description: "기본 잔디 지형입니다. 영역을 잔디로 채우거나 원상 복구할 때 사용합니다.",
  placementRules: "하위 레이어 면 채우기 전용. 균질 지형이라 이웃 연결 성형이 필요 없습니다.",
  confidence: "high",
  source: "bundled-default",
  passage: "passable",
  repeatability: "auto",
  patternGrammar: {
    axis: "both",
    kind: "autotile_3x3",
    minHeight: 1,
    minWidth: 1,
    parts: [
      { role: "topLeft", tileIds: [TILE.GRASS] },
      { role: "top", tileIds: [TILE.GRASS] },
      { role: "topRight", tileIds: [TILE.GRASS] },
      { role: "left", tileIds: [TILE.GRASS] },
      { role: "center", tileIds: [TILE.GRASS, 270, 271, 272, 273] },
      { role: "right", tileIds: [TILE.GRASS] },
      { role: "bottomLeft", tileIds: [TILE.GRASS] },
      { role: "bottom", tileIds: [TILE.GRASS] },
      { role: "bottomRight", tileIds: [TILE.GRASS] },
    ],
    preserveCaps: true,
    repeat: "center",
  },
},
```

주의: 270-273 등 변형 타일 id는 `tileSemanticsCombinedTown.ts:38`의 잔디 라벨 목록과 일치해야 한다. 구현 전 해당 행을 열어 재확인하고, 렌더 검증이 가능하면 `render_group_sample`/`show_tiles` 헤드리스 경로로 타일 외형이 잔디인지 확인한다(불가능하면 semantics 라벨 근거로 충분).

- [ ] **Step 4: 통과 확인 + 그룹 수 갱신** — 테스트 PASS. `test/vocabSoftConfirm.test.ts`·`test/tileQueryTool` 계열에 그룹 개수를 하드코딩한 단언이 있으면 +1 반영.

- [ ] **Step 5: 커밋**

```bash
git add src/project/tilesetHarness/combinedTownGroups.ts test/
git commit -m "feat(vocab): 잔디 autotile 그룹 — '잔디로 채워줘' 커버리지(돌바닥은 통행성 이슈로 보류)"
```

---

### Task 8: 종합 검증 — 시나리오 테스트 + 전체 스위트

**Files:**
- Test: `test/vocabScenarios.test.ts` (신규)
- Modify: `.superpowers/sdd/progress.md` (돌바닥 보류 사유·후속 과제 기록)

- [ ] **Step 1: 시나리오 테스트 작성** — 진단서의 실패 시나리오 3종을 고정:

```ts
// vocab 개편(2026-07-11)의 사용자 시나리오 고정 테스트.
// ① 돌벽: 없는 id → 후보 제시(추측 루프 종결) ② 잔디: fill 즉시 성공
// ③ 번들 벽: soft-confirm 없이 즉시 시공(승인 시드)
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { emptyProject } from "@/editor/tools/emptyProject";

describe("vocab 시나리오", () => {
  it("① 돌벽 추측 id는 실패하되 실존 후보를 알려준다", () => {
    const project = emptyProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "build_wall", {
      mapId, rect: { x: 4, y: 4, w: 5, h: 4 }, wallVocabId: "stone-wall",
    }, { dryRun: true });
    expect(result.ok).toBe(false);
    expect(result.message ?? JSON.stringify(result)).toContain("비슷한 그룹");
  });
  it("② 잔디 채우기가 한 번에 성공한다", () => {
    const project = emptyProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "fill_region", {
      mapId, rect: { x: 2, y: 2, w: 3, h: 3 }, tileVocabId: "harness-combined-town-grass-autotile",
    }, { dryRun: false });
    expect(result.ok).toBe(true);
  });
  it("③ 번들 벽 시공에 soft-confirm 경고가 없다", () => {
    const project = emptyProject();
    const mapId = Object.keys(project.maps)[0];
    const result = runTool({ project }, "build_wall", {
      mapId, rect: { x: 4, y: 4, w: 5, h: 5 }, wallVocabId: "harness-combined-town-plaster-wall-9slice",
    }, { dryRun: false });
    expect(result.ok).toBe(true);
    expect((result.warnings ?? []).join("\n")).not.toContain("목업 확인 대기");
  });
});
```

(runTool 반환의 실패 메시지 필드명은 `src/editor/tools/types.ts`의 ToolResult 정의를 열어 확인 후 맞춘다 — `message`가 아니면 해당 필드로.)

- [ ] **Step 2: 전체 스위트** — `npx vitest run --configLoader runner 2>&1 | tee /tmp/vocab-full-suite.log` (백그라운드, tail로 자르지 말 것). 실패 목록에서 `.env.local` 기인(aiLlmClient)만 허용. 그 외 실패는 전부 이번 브랜치 변경과의 인과를 확인해 수정.

- [ ] **Step 3: 카탈로그 최종 재생성** — `node scripts/generateToolCatalog.mjs` 후 diff 없음 확인(있으면 커밋 누락).

- [ ] **Step 4: ledger 기록 + 커밋**

```bash
git add test/vocabScenarios.test.ts .superpowers/sdd/progress.md
git commit -m "test(vocab): 시나리오 고정 — 돌벽 후보 제시·잔디 fill·번들 즉시 시공"
```

---

## Self-Review 결과

- **커버리지:** 진단 4원인 ↔ Task 1(원인1), Task 2·3(원인3), Task 4·5·6(원인2), Task 7(원인4 일부 — 돌바닥은 통행성 근거로 명시 보류). ✔
- **타입 일관성:** `isTrustedGroupSource`(T1)를 T4·T5·T6이 `approvedVocabulary` 경유로만 소비. `suggestVocabGroups` 시그니처 T4 정의 = T4 소비. ✔
- **알려진 리스크:** T2의 aiChatPanel/aiProposalCard 수술은 주변 상태와 얽혀 있어 리뷰어가 융합 잔재(참조·렌더 상태)를 중점 확인해야 함. T7 변형 타일 id는 구현 전 semantics 재확인 단계 포함. ✔
