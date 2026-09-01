# 역할 능력 어댑터 (A-1 · A-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타일 역할 이름 비교(`role === "wall"` 등)를 코드에서 전부 없애고, 단일 조회 함수 `roleCapabilities()`로 대체한다. 사용자에게 보이는 동작은 하나도 바뀌지 않는다.

**Architecture:** 스펙의 A안(어댑터 우선)이다. A-1에서 조회 함수를 도입하되 내부는 기존 상수 표를 그대로 재현해 동작 변화 0을 증명하고, A-2에서 분기를 하나씩 조회 함수로 옮긴다. `role: string` 개방·마이그레이션·DB UI는 이 계획에 없다(A-3, 별도 계획).

**Tech Stack:** TypeScript, vitest (`npm test`), `tsc --noEmit` (`npm run typecheck`)

> `package.json:89` 은 `"vitest": "3.2.4"` 로 고정돼 있으나 **설치된 실체는 4.1.10** 이다
> (`npx vitest --version` → `vitest/4.1.10 linux-x64 node-v24.11.1`). 계획 초안이 적은
> 3.2.4 는 매니페스트 값을 그대로 베낀 것이었다. 실행 중 4.x 로 인한 문제는 없었다.

**Spec:** `docs/superpowers/specs/2026-09-01-tileset-owned-role-registry-design.md`

---

## 실행 결과 (2026-09-01) — 이 계획은 이제 역사다

**A-1 · A-2 전체 실행 완료.** 커밋 `34e5815b` ~ `a81116d8`.

| Task | 결과 |
|---|---|
| 1 (A-1 조회 함수) | 완료. 다만 `PaletteSlotRole` 전용 5종에 유추로 적었던 샘플 능력 2칸을 **뺐다** — 출처 함수의 인자 타입이 `TileGroupRole` 이라 그 5종은 도달조차 못 한다(`b2908ebc`) |
| 2 · 3 (`groupSampleBuilder` 5분기) | 완료 |
| 4 (`expectedPassage`) | 완료. 브리프의 특성화 테스트 2개가 **공허했다**(경고 0건) — 구현자가 위반을 직접 구성해 5개로 넓혔다 |
| 5 · 6 · 7 (`requiresPatternGrammar`·`autotile`·`terrainTag`) | 완료 |
| 8 (`themeCapabilityRoles`) | 완료. `AiPreviewThemeCapability` 는 7종이 아니라 **8종**이었고 `decorProp` 은 표에 넣지 않고 폴백으로 흘린다 |
| 9 (`layerHome` 컬럼 제거) | **Step 3 취소 — 컬럼 유지.** 가설이 틀렸다. 아래 참조 |
| 10 (`furniture` 필터 태그화) | **취소 — 무변경.** 아래 참조 |
| 11 (A-2 게이트) | 완료. 허용 목록 11 파일 / 22 줄 |
| 12 (문서 갱신) | 이 커밋 |

### Task 9 — 삭제 취소, 그리고 A-3 의 방향을 바꾼 발견

`BUILD_PALETTE_GROUP_CLAIMS` 의 `layerHome` 컬럼이 역할과 중복이라는 가설은 **틀렸다.**
`role: "prop"` 4 항목이 서로 다른 3 개 값(`door`=lower, `window`=upper, `tree`=perCell,
`prop`=upper)을 갖는다. 역할을 키로 하는 어떤 조회도 재현할 수 없다.

더 중요한 것은 이 값이 **이미 3단 해석 사슬의 1 순위**라는 사실이다 —
`vocabLayerHomeFor()`(`src/editor/tools/v3/rmTypeExpander.ts:59-64`) 가
`group.layerHome → group.defaultLayer → 타일 유도 → profile.layerHomeByRole[role]` 순으로
푼다. 그리고 그 답이 `place_door`/`place_window`/`build_roof`/`lay_path`/`place_props` 가
`lowerTiles` 냐 `upperTiles` 냐를 결정한다.

즉 **스펙 ②의 "2단 해석"은 빈 땅이 아니다.** A-3 은 병행 사슬을 새로 짓지 말고 기존
사슬의 마지막 단만 `roleCapabilities()` 로 교체해야 한다. 스펙 ② 절에 "⚠️ A-3 제약"
소절로 못 박았다.

### Task 10 — 취소 (측정 결과 죽은 코드가 될 것이었다)

`entry.role === "furniture"` 를 태그 검사로 바꾸려 했으나, `role: "furniture"` 인
시맨틱 항목 **57 개 중 `furniture` 태그를 가진 것도 `가구` 태그를 가진 것도 0 개**였다.
실내 시맨틱은 태그에 **라벨을 앞에 붙이고**(`tileSemanticsCombinedTown.ts:23`) 나머지
태그도 `table`/`shelf`/`cabinet` 처럼 품목 단위라 상위 태그가 없다.

계획대로 `|| tags.includes("furniture") || tags.includes("가구")` 를 붙였다면 두 항이
57 항목 전부에서 **영구히 false** 인 죽은 코드가 되고, `furniture` → `prop` 병합 후에는
벤치마크가 조용히 빈 집합을 본다. 계획의 Step 3 에 있던 탈출구("태그가 없으면 A-3 으로
넘긴다")를 따라 무변경으로 종료했다. 가구 태그를 **심는 것**이 A-3 의 선행 작업이며
스펙 ①에 기록했다.

### 검증 방법 정정 — revert 아니라 변이

이 계획과 파생 브리프는 "소스 편집을 되돌려 테스트가 실패하는지 확인하라"고 지시했다.
**순수 리팩터에서 성립할 수 없는 요구다.** 동작 변화가 0 이면 올바른 특성화 테스트는 구
코드와 신 코드 양쪽에서 통과하는 게 정상이고, 되돌려서 실패했다면 그것은 동작을 바꿨다는
뜻이다. 이 계획의 다른 제약("이관 전에 통과해야 한다. 실패하면 테스트가 틀린 것")과 정면
모순이었다.

실제로 쓴 방법은 **변이 테스트**다 — 이관본을 일부러 망가뜨리고(분기 교환, `undefined`
경로 삭제, 메시지 공백 1개 삭제) 테스트가 red 로 가는지 확인한 뒤 되돌린다. 아래 각
Task 의 "Expected: PASS" 단계는 이 방법으로 읽어야 한다.

## Global Constraints

- **동작 변화 0.** A-1·A-2 전체에서 사용자에게 보이는 결과가 바뀌면 실패다. 값이 바뀌어야 할 것 같으면 멈추고 보고한다.
- **`role` 타입은 아직 열지 않는다.** `TileGroupRole` / `PaletteSlotRole` enum은 이 계획 끝까지 그대로 남는다. 조회 함수의 인자 타입만 `string`을 받는다.
- **분기당 커밋 1개.** 한 커밋에 두 분기를 섞지 않는다. 회귀 원인 특정이 목적이다.
- **테스트는 `test/` 에 평평하게 둔다** — 기존 1,322개 파일과 같은 규약. 파일명은 `test/<주제>.test.ts`.
- **`turnGuide.ts:60` 은 이관 대상이 아니다.** 스펙 "제외: `turnGuide.ts:60`" 절 참조 — 행동 게이트가 아니라 프롬프트 예시 휴리스틱이다. 건드리지 않는다.
- **dev 서버 포트를 쓰는 명령은 없다.** 이 계획은 단위 테스트만 쓴다.
- **판정은 기준선 대비.** 공유 머신이라 실패 수는 무의미하다. 각 태스크 전후로 같은 명령을 돌려 **실패 집합의 차집합**을 본다.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/project/tileRoles.ts` | `RoleCapabilities` 타입 + `roleCapabilities()` 조회 함수 + A-1 레거시 재현 표 | 신규 |
| `test/tileRoleCapabilities.test.ts` | A-1 전수 동등성 (13종 × 8능력) | 신규 |
| `src/ai/groupSampleBuilder.ts` | 분기 5개 이관 (`:54` `:59` `:60` `:174` `:199`) | 수정 |
| `src/editor/lint/tilesetPaletteLint.ts` | 분기 1개 이관 (`:104-115`) | 수정 |
| `src/project/aiPreviewContracts.ts` | 분기 1개 이관 (`:431`) | 수정 |
| `src/project/tileVocabulary.ts` | 분기 1개 이관 (`:257`) | 수정 |
| `src/project/tilesetHarness/combinedTown.ts` | 분기 1개 이관 (`:348`) | 수정 |
| `src/editor/tools/v3/grammarProfiles.ts` | `themeCapabilityRoles` 표 추가 | 수정 |
| `src/project/aiPreviewThemeGrammar.ts` | 역인덱스를 프로파일 표로 이관 (`:110-115`) | 수정 |
| `src/editor/panels/buildPaletteCore.ts` | ~~중복 `layerHome` 컬럼 제거 (`:92-101`)~~ | **무변경** — 중복이 아니었다 (Task 9) |
| `src/benchmark/interior/groundTruth.ts` | ~~`role === "furniture"` 필터를 태그 기반으로~~ | **무변경** — 태그가 없었다 (Task 10) |
| `test/roleNameComparisonGate.test.ts` | A-2 완료 게이트 (허용 11 파일 / 22 줄) | 신규 |
| `test/buildPaletteClaimLayerHome.test.ts` | 클레임 `layerHome` 이 역할과 갈리는 4건 고정 | 신규 |

## 계획 작성 중 발견한 스펙 수정 2건

Task 1과 Task 8이 각각 이 수정을 반영하고, Task 12에서 스펙 문서를 갱신한다.

**① `layerHome`은 하나가 아니라 둘이다.** 스펙은 능력 7개에 `layerHome` 하나를 뒀는데, 코드에는 같은 이름의 서로 다른 두 질문이 있고 **답이 다르다**.

```
grammarProfiles.ts:45      prop: "perCell"                 ← 어휘 홈 (재료가 어느 레이어에 사는가)
groupSampleBuilder.ts:174  role === "prop" → "upper"       ← 샘플 렌더 레이어 (미리보기를 어디 그리는가)
```

하나로 합치면 동작이 바뀐다. `layerHome`과 `sampleLayer`로 가른다. **능력 7개 → 8개.**

**② `aiPreviewThemeGrammar.ts:110-115`는 `RoleCapabilities`가 아니다.** `AiPreviewThemeCapability`(→ 역할 목록)의 **역인덱스**다. 역할별 능력이 아니라 프로파일의 별도 표(`themeCapabilityRoles`)로 둔다.

> **실행 정정:** `AiPreviewThemeCapability` 는 위에 적은 7종이 아니라 **8종**이다
> (`src/project/aiPreviewContracts.ts:24-32`) — `decorProp` 이 빠져 있었다. 그리고
> `decorProp` 은 표에 **넣지 않는다.** 원본에도 `decorProp` 명시 분기가 없어 catch-all
> `["prop","fence","roof"]` 로 떨어졌기 때문이다. 따라서 Task 8 Step 6 의
> `?? ["prop", "fence", "roof"]` 는 방어 코드가 아니라 **`decorProp` 의 유일한 정답
> 경로**이며 지우면 동작이 바뀐다.

---

### Task 1: `roleCapabilities()` 조회 함수와 전수 동등성 (A-1)

**Files:**
- Create: `src/project/tileRoles.ts`
- Test: `test/tileRoleCapabilities.test.ts`

**Interfaces:**
- Consumes: `TilesetDef` (`@/project/types`)
- Produces:
  - `RoleCapabilities` — 8필드 인터페이스
  - `roleCapabilities(tileset: TilesetDef, roleId: string): RoleCapabilities`
  - `LEGACY_ROLE_CAPABILITIES: Record<string, RoleCapabilities>` (A-3에서 프로파일로 이사할 임시 표)

이 태스크의 유일한 합격 기준은 **"아무것도 안 바뀌었다"** 다. 표의 값은 창작이 아니라 기존 코드에서 그대로 베낀 것이어야 한다.

- [ ] **Step 1: 실패하는 전수 테스트를 쓴다**

`test/tileRoleCapabilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { RM_TYPE_GRAMMAR_PROFILE } from "@/editor/tools/v3/grammarProfiles";
import { LEGACY_ROLE_CAPABILITIES, roleCapabilities } from "@/project/tileRoles";

/** 구 어휘 13종 = TileGroupRole 8 + PaletteSlotRole 8 − 공유 3(wall/water/roof). */
const LEGACY_ROLE_IDS = [
  "building", "castle", "fence", "roof", "terrain", "water", "wall", "prop",
  "ground", "path", "decor", "boundary", "furniture",
] as const;

describe("roleCapabilities — A-1 동등성", () => {
  it("구 어휘 13종 전부에 대해 능력을 돌려준다", () => {
    const tileset = defaultTileset();
    for (const roleId of LEGACY_ROLE_IDS) {
      const caps = roleCapabilities(tileset, roleId);
      expect(caps, `역할 ${roleId}`).toBeDefined();
      expect(caps.layerHome, `역할 ${roleId} 의 layerHome`).toMatch(/^(lower|upper|perCell)$/);
    }
  });

  it("layerHome 은 RM_TYPE 프로파일의 layerHomeByRole 과 일치한다", () => {
    const tileset = defaultTileset();
    for (const [roleId, expected] of Object.entries(RM_TYPE_GRAMMAR_PROFILE.layerHomeByRole)) {
      expect(roleCapabilities(tileset, roleId).layerHome, `역할 ${roleId}`).toBe(expected);
    }
  });

  it("sampleLayer 는 layerHome 과 별개이며 prop 에서 갈린다", () => {
    // groupSampleBuilder.targetLayer 는 prop 을 upper 로 강제하지만
    // 어휘 홈(layerHomeByRole)은 perCell 이다. 둘을 합치면 동작이 바뀐다.
    const tileset = defaultTileset();
    expect(roleCapabilities(tileset, "prop").layerHome).toBe("perCell");
    expect(roleCapabilities(tileset, "prop").sampleLayer).toBe("upper");
  });

  it("모르는 역할에는 결정론적 폴백을 준다", () => {
    const tileset = defaultTileset();
    const caps = roleCapabilities(tileset, "존재하지-않는-역할");
    expect(caps.layerHome).toBe("lower");
    expect(caps.sampleAs).toBeUndefined();
    expect(caps.autotile).toBe(false);
  });

  it("13종 × 8능력 표에 빠진 칸이 없다", () => {
    const keys = [
      "layerHome", "sampleLayer", "sampleAs", "expectedPassage",
      "requiresPatternGrammar", "autotile", "terrainTag", "needsBackdrop",
    ] as const;
    for (const roleId of LEGACY_ROLE_IDS) {
      const caps = LEGACY_ROLE_CAPABILITIES[roleId];
      expect(caps, `역할 ${roleId} 가 표에 없다`).toBeDefined();
      for (const key of keys) {
        expect(key in caps!, `역할 ${roleId} 의 ${key} 칸이 비었다`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- test/tileRoleCapabilities.test.ts`
Expected: FAIL — `Cannot find module '@/project/tileRoles'`

- [ ] **Step 3: 조회 함수를 만든다**

`src/project/tileRoles.ts`:

```ts
// project/tileRoles.ts
// 역할 능력 조회 (A-1). 15개 분기에 흩어진 role 이름 비교를 한 함수로 모은다.
//
// A-1 규약: 이 표의 값은 창작이 아니라 기존 코드에서 베낀 것이다. 각 필드에
// 출처 주석이 붙어 있고, 값을 "더 맞게" 고치는 것은 A-1 범위가 아니다 —
// 동작 변화 0 이 이 단계의 유일한 합격 기준이다.
//
// A-3 에서 이 표는 GrammarProfile.roles 로 이사하고 타일셋 오버라이드가 붙는다.

import type { TilesetDef } from "./types";

export interface RoleCapabilities {
  /** 어휘 홈 — 재료가 어느 레이어에 사는가. 출처: grammarProfiles.layerHomeByRole */
  layerHome: "lower" | "upper" | "perCell";
  /**
   * 그룹 샘플 미리보기를 그릴 레이어. layerHome 과 **다른 질문**이며 prop 에서 답이 갈린다
   * (layerHome=perCell, sampleLayer=upper). 출처: groupSampleBuilder.targetLayer:174
   * undefined = 역할로 결정하지 않고 tileset.priority 를 따른다.
   */
  sampleLayer?: "lower" | "upper";
  /** 문법이 없을 때의 샘플 모양. 출처: groupSampleBuilder.buildBaseGroupSample:54,59,60 */
  sampleAs?: "nineSlice" | "verticalPair" | "roof";
  /** 통행 일관성 린트의 기대값. undefined = 검사하지 않음. 출처: tilesetPaletteLint:104-115 */
  expectedPassage?: "passable" | "solid";
  /** 패턴 문법 필수 여부. 출처: aiPreviewContracts.needsPatternGrammar:431 */
  requiresPatternGrammar: boolean;
  /** 문법 없이도 오토타일로 취급. 출처: tileVocabulary.isAutotileGroup:257 */
  autotile: boolean;
  /** 지형 태그 강제. undefined = 폴백 유지. 출처: combinedTown.terrainTagForGroup:348 */
  terrainTag?: "water";
  /** 샘플 배경에 잔디를 깔아야 하는가. 출처: groupSampleBuilder.backdropTile:199 */
  needsBackdrop: boolean;
}

const BASE: RoleCapabilities = {
  layerHome: "lower",
  requiresPatternGrammar: false,
  autotile: false,
  needsBackdrop: false,
};

/**
 * 구 어휘 13종의 능력 표. TileGroupRole 8 + PaletteSlotRole 8 − 공유 3.
 * 두 enum 이 한 표에 섞여 있는 것은 의도적이다 — A-3 에서 통합될 예정이고,
 * 그때까지 호출자는 어느 enum 에서 온 값인지 신경 쓰지 않아도 된다.
 */
export const LEGACY_ROLE_CAPABILITIES: Record<string, RoleCapabilities> = {
  // ── TileGroupRole ──────────────────────────────────────────────
  terrain: { ...BASE, layerHome: "lower", requiresPatternGrammar: true },
  water: { ...BASE, layerHome: "lower", requiresPatternGrammar: true, autotile: true, terrainTag: "water" },
  wall: { ...BASE, layerHome: "lower", sampleAs: "nineSlice", expectedPassage: "solid", requiresPatternGrammar: true },
  building: { ...BASE, layerHome: "lower" },
  castle: { ...BASE, layerHome: "lower" },
  fence: { ...BASE, layerHome: "upper" },
  roof: { ...BASE, layerHome: "perCell", sampleAs: "roof" },
  prop: { ...BASE, layerHome: "perCell", sampleLayer: "upper", sampleAs: "verticalPair", needsBackdrop: true },

  // ── PaletteSlotRole 전용 (낱개 타일·팔레트 슬롯) ────────────────
  // 이 5종은 grammarProfiles.layerHomeByRole 에 없다 — layerHome 은 가장
  // 가까운 그룹 역할에서 베낀다(ground→terrain, boundary→fence, decor→prop).
  ground: { ...BASE, layerHome: "lower" },
  path: { ...BASE, layerHome: "lower", expectedPassage: "passable" },
  decor: { ...BASE, layerHome: "perCell", sampleLayer: "upper", needsBackdrop: true },
  boundary: { ...BASE, layerHome: "upper" },
  furniture: { ...BASE, layerHome: "perCell", sampleLayer: "upper", needsBackdrop: true },
};

/**
 * 역할의 능력을 돌려준다. 모르는 역할에는 BASE 폴백을 준다 —
 * 조용한 폴백을 택한 이유는 getGrammarProfile(grammarProfiles.ts:82)이 알 수 없는
 * 프로파일 id 에 대해 이미 같은 규약(조용히 기본값)을 쓰기 때문이다.
 *
 * tileset 인자는 A-1 에서 쓰이지 않는다. A-3 에서 tileset.roleOverrides 를
 * 읽으므로 시그니처를 미리 확정해 두어 호출자를 두 번 고치지 않는다.
 */
export function roleCapabilities(_tileset: TilesetDef, roleId: string): RoleCapabilities {
  return LEGACY_ROLE_CAPABILITIES[roleId] ?? BASE;
}
```

> **실행 정정 2건 (커밋 `b2908ebc`) — 위 블록은 초안이고 최종형은 `src/project/tileRoles.ts` 다.**
>
> 1. `decor`·`furniture` 의 `sampleLayer: "upper"` / `needsBackdrop: true` 를 **뺐다.**
>    이 값들의 출처인 `groupSampleBuilder` 의 `targetLayer`/`backdropTile` 은 인자 타입이
>    `TileGroupRole` 이라 `PaletteSlotRole` 전용 5종은 **애초에 도달하지 못한다.** 즉 현행
>    동작에서 이들의 답은 "없음"이고, 유추한 값을 적어 두면 A-3 에서 역할이 열리는 순간
>    없던 잔디 배경이 생긴다 — 동작 변화 0 위반. `layerHome` 만 가까운 그룹 역할에서
>    베끼는 면책이 적용된다.
> 2. 반환 타입을 `Readonly<RoleCapabilities>` 로 바꿨다. 표 항목(또는 `BASE` 싱글턴)의
>    **참조**를 그대로 넘기므로, 10개 호출부 중 한 곳이 필드를 대입하면 프로세스 전역이
>    오염된다.
>
> 또한 위 인터페이스의 `sampleAs` 에서 `"single"` 을 뺐다 — 스펙 ① 은 4값으로 적었으나
> 실제 분기는 `nineSlice`/`verticalPair`/`roof` 3값만 만든다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- test/tileRoleCapabilities.test.ts`
Expected: PASS (5 tests)

`layerHome` 일치 테스트가 실패하면 표를 고치는 게 아니라 **`grammarProfiles.ts:57-65`을 다시 베껴야 한다.** 프로파일이 정본이다.

- [ ] **Step 5: 타입 검사**

Run: `npm run typecheck`
Expected: 신규 에러 0

- [ ] **Step 6: 커밋**

```bash
git add src/project/tileRoles.ts test/tileRoleCapabilities.test.ts
git commit -m "refactor(tile): 역할 능력 조회 함수를 도입한다 (A-1)

15개 분기에 흩어진 role 이름 비교를 roleCapabilities() 한 곳으로 모을
준비다. 이 커밋은 함수와 표만 추가하고 호출자를 바꾸지 않는다 — 동작
변화 0.

표의 값은 기존 코드에서 베꼈고 필드마다 출처 주석을 달았다. layerHome 은
grammarProfiles.layerHomeByRole 이 정본이며 테스트가 일치를 강제한다.

계획 작성 중 발견: layerHome 과 sampleLayer 는 같은 이름의 다른 질문이고
prop 에서 답이 갈린다(perCell vs upper). 합치면 동작이 바뀌므로 별도
필드로 뒀다."
```

---

### Task 2: `groupSampleBuilder` — `sampleAs` 3분기 이관

**Files:**
- Modify: `src/ai/groupSampleBuilder.ts:51-62`
- Test: `test/groupSampleRoleCapability.test.ts`

**Interfaces:**
- Consumes: `roleCapabilities()`, `RoleCapabilities` (Task 1)
- Produces: 없음 (내부 리팩터)

- [ ] **Step 1: 현재 동작을 고정하는 특성화 테스트를 쓴다**

이 분기들을 덮는 테스트가 없다. 먼저 현재 동작을 못 박는다.

`test/groupSampleRoleCapability.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { defaultTileset } from "@/project/defaults/defaultAssets";

describe("buildGroupSample — 역할별 샘플 모양 (특성화)", () => {
  it("wall 은 문법이 없어도 나인슬라이스 크기로 나온다", () => {
    const sample = buildGroupSample(defaultTileset(), {
      role: "wall",
      tileIds: [15, 16, 17, 45, 46, 47, 75, 76, 77],
    });
    expect(sample.width).toBe(3);
    expect(sample.height).toBe(3);
  });

  it("문법 없는 prop 은 정확히 2타일일 때만 세로 쌍이다", () => {
    const tileset = defaultTileset();
    const pair = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292] });
    expect(pair.width).toBe(1);
    expect(pair.height).toBe(2);

    // 3개 이상은 세로로 묶지 않는다 (소품 가방 방어, groupSampleBuilder.ts:58 주석)
    const bag = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292, 289] });
    expect(bag.height).not.toBe(3);
  });

  it("roof 는 전용 샘플 경로를 탄다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "roof", tileIds: [404, 405] });
    expect(sample.width).toBeGreaterThan(0);
    expect(sample.height).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 특성화 테스트가 지금 통과하는지 확인한다**

Run: `npm test -- test/groupSampleRoleCapability.test.ts`
Expected: PASS — **이관 전에 통과해야 한다.** 실패하면 테스트가 현재 동작을 잘못 기술한 것이니 테스트를 고친다.

- [ ] **Step 3: 분기를 조회 함수로 바꾼다**

`src/ai/groupSampleBuilder.ts:51-62` 를 이렇게 바꾼다:

```ts
function buildBaseGroupSample(tileset: TilesetDef, input: GroupSampleInput): GroupSample {
  const grammar = input.patternGrammar;
  const caps = roleCapabilities(tileset, input.role);
  if (grammar?.kind === "repeatable_block") return repeatableBlockSample(tileset, input);
  if (grammar?.kind === "nine_slice_expandable" || caps.sampleAs === "nineSlice") return nineSliceSample(tileset, input);
  if (grammar?.kind === "vertical_expandable") return verticalSample(tileset, input);
  if (grammar?.kind === "horizontal_expandable") return horizontalSample(tileset, input);
  if (grammar?.kind === "autotile_3x3") return autotileSample(tileset, input);
  // 문법 없는 prop 은 정확히 2타일(침엽수 등)일 때만 세로 쌍. 벤치·소품 가방(3+)은 세로로 묶지 않는다.
  if (!grammar && caps.sampleAs === "verticalPair" && input.tileIds.length === 2) return verticalSample(tileset, input);
  if (caps.sampleAs === "roof") return roofSample(tileset, input);
  return fallbackSample(tileset, input);
}
```

임포트를 추가한다:

```ts
import { roleCapabilities } from "@/project/tileRoles";
```

- [ ] **Step 4: 테스트가 여전히 통과하는지 확인한다**

Run: `npm test -- test/groupSampleRoleCapability.test.ts test/tileRoleCapabilities.test.ts`
Expected: PASS 전부

- [ ] **Step 5: 이 파일을 쓰는 기존 테스트가 안 깨졌는지 확인한다**

Run: `npm test -- test/aiPreview test/groupSample test/tileVocab`
Expected: 이관 전과 같은 실패 집합 (신규 실패 0)

- [ ] **Step 6: 커밋**

```bash
git add src/ai/groupSampleBuilder.ts test/groupSampleRoleCapability.test.ts
git commit -m "refactor(tile): 샘플 모양 3분기를 sampleAs 능력으로 옮긴다 (A-2)

groupSampleBuilder.ts:54,59,60 의 role === wall/prop/roof 비교를
caps.sampleAs 로 바꾼다. 덮는 테스트가 없어 특성화 테스트를 먼저 썼다.

prop 의 '정확히 2타일일 때만 세로 쌍' 조건은 그대로 남긴다 — 이건 역할이
아니라 타일 개수 조건이다."
```

---

### Task 3: `groupSampleBuilder` — `sampleLayer` · `needsBackdrop` 2분기 이관

**Files:**
- Modify: `src/ai/groupSampleBuilder.ts:170-176`, `:198-202`
- Test: `test/groupSampleRoleCapability.test.ts` (Task 2 파일에 추가)

**Interfaces:**
- Consumes: `roleCapabilities()` (Task 1)
- Produces: 없음

`targetLayer` 의 타일별 우선 규칙(`isTreeCanopyTileId` / `isTreeTrunkTileId`)은 **role 보다 먼저 판정되며 그대로 남는다.** 역할로 접히지 않는 타일 단위 사실이다.

- [ ] **Step 1: 특성화 테스트를 추가한다**

`test/groupSampleRoleCapability.test.ts` 에 describe 블록을 하나 더 붙인다:

```ts
describe("buildGroupSample — 레이어·배경 (특성화)", () => {
  it("prop 타일은 상위 레이어에 놓인다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
    const placedUpper = sample.upper.some((tile) => tile === 289);
    expect(placedUpper).toBe(true);
  });

  it("prop 샘플은 배경에 잔디가 깔린다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
    // backdropTile 이 defaultGrassTile 을 깔면 lower 에 잔디가 있다.
    expect(sample.lower.some((tile) => tile >= 0)).toBe(true);
  });

  it("terrain 샘플은 배경을 깔지 않는다", () => {
    const sample = buildGroupSample(defaultTileset(), { role: "terrain", tileIds: [303] });
    expect(sample.upper.every((tile) => tile < 0)).toBe(true);
  });
});
```

- [ ] **Step 2: 지금 통과하는지 확인한다**

Run: `npm test -- test/groupSampleRoleCapability.test.ts`
Expected: PASS

- [ ] **Step 3: 두 분기를 바꾼다**

`targetLayer`(`:170-176`):

```ts
function targetLayer(tileset: TilesetDef, role: TileGroupRole, tile: number): Layer {
  // 숲: 수관 upper + 밑동 lower — 같은 칸에 겹쳐야 숲이 된다.
  // 이 두 줄은 타일 단위 사실이라 역할 능력으로 접히지 않는다.
  if (isTreeCanopyTileId(tile)) return "upper";
  if (isTreeTrunkTileId(tile)) return "lower";
  const sampleLayer = roleCapabilities(tileset, role).sampleLayer;
  if (sampleLayer) return sampleLayer;
  return tileset.priority[tile] === "upper" ? "upper" : "lower";
}
```

`backdropTile`(`:198-202`):

```ts
function backdropTile(tileset: TilesetDef, input: GroupSampleInput): number {
  const needsBackdrop = roleCapabilities(tileset, input.role).needsBackdrop;
  return needsBackdrop || input.tileIds.some((tile) => targetLayer(tileset, input.role, validTile(tileset, tile)) === "upper")
    ? defaultGrassTile(tileset)
    : EMPTY_TILE;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- test/groupSampleRoleCapability.test.ts test/tileRoleCapabilities.test.ts`
Expected: PASS 전부

- [ ] **Step 5: 회귀 확인**

Run: `npm test -- test/aiPreview test/groupSample`
Expected: 신규 실패 0

- [ ] **Step 6: 커밋**

```bash
git add src/ai/groupSampleBuilder.ts test/groupSampleRoleCapability.test.ts
git commit -m "refactor(tile): 샘플 레이어와 배경 분기를 능력으로 옮긴다 (A-2)

groupSampleBuilder.ts:174 의 role === prop → upper 를 caps.sampleLayer 로,
:199 의 role === prop 을 caps.needsBackdrop 으로 바꾼다.

sampleLayer 를 layerHome 과 따로 둔 이유가 여기서 드러난다 — 어휘 홈은
perCell 인데 샘플 렌더는 upper 다. 합치면 동작이 바뀐다.

수관/밑동 타일 판정은 role 보다 먼저 오며 그대로 남긴다. 타일 단위
사실이라 역할로 접히지 않는다."
```

---

### Task 4: `tilesetPaletteLint` — `expectedPassage` 이관

**Files:**
- Modify: `src/editor/lint/tilesetPaletteLint.ts:98-126`
- Test: `test/tilesetPaletteLintPassage.test.ts`

**Interfaces:**
- Consumes: `roleCapabilities()` (Task 1)
- Produces: 없음

`expectedPassage` 가 `undefined` 인 역할은 검사를 건너뛴다 — 현재 `path`/`wall` 만 검사하는 동작과 같다.

- [ ] **Step 1: 특성화 테스트를 쓴다**

진입점은 `lintTilesetPalettes(project: Project)`(`tilesetPaletteLint.ts:35`)다. 맵·타일셋을 따로 받지 않고 프로젝트 전체를 받는다. 기존 사용례는 `test/tilesetPaletteT1a.test.ts:193`.

```ts
import { describe, expect, it } from "vitest";
import { lintTilesetPalettes } from "@/editor/lint/tilesetPaletteLint";
import { createBlankProject } from "@/project/defaults/defaultProject";

function passageIssues(project: ReturnType<typeof createBlankProject>) {
  return lintTilesetPalettes(project).filter((issue) => issue.code === "tileset-palette-passage");
}

describe("tilesetPaletteLint — 통행 일관성 (특성화)", () => {
  it("통행 경고는 path·wall 역할만 언급한다", () => {
    for (const issue of passageIssues(createBlankProject())) {
      expect(issue.message).toMatch(/(path|wall) 역할/);
    }
  });

  it("통행 경고는 severity warning 이다", () => {
    for (const issue of passageIssues(createBlankProject())) {
      expect(issue.severity).toBe("warning");
    }
  });
});
```

- [ ] **Step 1b: 위 두 테스트가 공허하지 않은지 확인하고, 공허하면 위반을 만든다**

`createBlankProject()` 가 통행 위반을 하나도 만들지 않으면 위 테스트는 빈 배열을 돌며 무조건 통과한다 — 이관 회귀를 못 잡는다. 확인한다:

```bash
npm test -- test/tilesetPaletteLintPassage.test.ts --reporter=verbose
```

경고가 0건이면 **위반을 직접 만드는 테스트를 추가한다.** 먼저 통행 차단 판정과 `PassFlag` 모양을 읽는다 — 추측하지 말 것:

```bash
grep -n "isBlockedPassage" -A6 src/editor/lint/tilesetPaletteLint.ts
grep -n "PassFlag" -A8 src/project/types/base.ts
```

읽은 모양에 맞춰 이런 테스트를 추가한다:

```ts
it("path 역할 타일이 통행 불가면 경고한다", () => {
  const project = createBlankProject();
  const map = Object.values(project.maps)[0]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const tile = map.lowerTiles[0]!;

  // 낱개 타일 메타의 role 이 primaryTileRole 의 1순위다 (tilesetPalette.ts:149).
  tileset.tileMeta ??= [];
  tileset.tileMeta[tile] = { label: "시험용 길", description: "", role: "path", origin: "user" };
  // isBlockedPassage 가 참이 되는 값으로 채운다 — 위에서 읽은 모양 그대로.
  tileset.passability[tile] = /* 차단 PassFlag */;

  const issues = passageIssues(project);
  expect(issues.some((i) => i.message.includes("path 역할"))).toBe(true);
});
```

`tileMeta` 항목의 필수 필드가 더 있으면 `TileAiMetadata`(`base.ts:62`)를 보고 맞춘다.

- [ ] **Step 2: 지금 통과하는지 확인**

Run: `npm test -- test/tilesetPaletteLintPassage.test.ts`
Expected: PASS

- [ ] **Step 3: 분기를 바꾼다**

`checkPassageConsistency`(`:98-126`):

```ts
function checkPassageConsistency(map: GameMap, tileset: TilesetDef, issues: LintIssue[]): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = visibleTile(map, x, y);
      if (tile < 0 || tile >= tileset.count) continue;
      const role = primaryTileRole(tileset, tile);
      if (role === null) continue;
      const expected = roleCapabilities(tileset, role).expectedPassage;
      if (expected === undefined) continue;
      const blocked = isBlockedPassage(tileset.passability[tile]);
      const violated = expected === "passable" ? blocked : !blocked;
      if (!violated) continue;
      issues.push({
        severity: "warning",
        code: "tileset-palette-passage",
        mapId: map.id,
        x,
        y,
        message: expected === "passable"
          ? `통행 일관성: ${role} 역할 타일 ${tile}이 통행 불가입니다 (${map.name} ${x},${y})`
          : `통행 일관성: ${role} 역할 타일 ${tile}이 통행 가능입니다 (${map.name} ${x},${y})`,
      });
    }
  }
}
```

메시지 문자열이 기존과 **글자 단위로 같아야 한다.** 기존은 `path 역할 타일 N이 통행 불가입니다`, `wall 역할 타일 N이 통행 가능입니다` 였고, `${role}` 로 바꾸면 같은 문장이 나온다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- test/tilesetPaletteLintPassage.test.ts`
Expected: PASS

- [ ] **Step 5: 린트 관련 기존 테스트 회귀 확인**

Run: `npm test -- test/lint test/tilesetPalette`
Expected: 신규 실패 0

- [ ] **Step 6: 커밋**

```bash
git add src/editor/lint/tilesetPaletteLint.ts test/tilesetPaletteLintPassage.test.ts
git commit -m "refactor(tile): 통행 일관성 검사를 expectedPassage 능력으로 옮긴다 (A-2)

tilesetPaletteLint.ts:104-115 의 role === path/wall 비교를 caps
.expectedPassage 로 바꾼다. undefined 면 검사를 건너뛰므로 현재의 '두 역할만
검사' 동작이 그대로 유지된다.

경고 문장은 글자 단위로 같다 — role 을 문자열 보간으로 넣어 기존 메시지를
재현했다."
```

---

### Task 5: `aiPreviewContracts` — `requiresPatternGrammar` 이관

**Files:**
- Modify: `src/project/aiPreviewContracts.ts:431-433`
- Test: `test/aiPreviewPatternGrammarRequirement.test.ts`

**Interfaces:**
- Consumes: `roleCapabilities()` (Task 1)
- Produces: 없음

이 함수는 `TilesetDef` 를 받지 않는다. 조회 함수가 타일셋을 요구하므로 호출자에서 넘겨야 한다. 호출 지점을 먼저 확인한다.

- [ ] **Step 1: 호출 지점을 확인한다**

Run: `grep -n "needsPatternGrammar" src/project/aiPreviewContracts.ts`

`needsPatternGrammar(group)` 를 부르는 곳이 `TilesetDef` 를 갖고 있는지 본다. 없으면 시그니처에 추가하고 호출자를 따라 올라간다.

- [ ] **Step 2: 특성화 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

describe("패턴 문법 필수 역할 (특성화)", () => {
  it("terrain·water·wall 만 패턴 문법을 요구한다", () => {
    const tileset = defaultTileset();
    const required = ["terrain", "water", "wall"];
    const notRequired = ["building", "castle", "fence", "roof", "prop"];
    for (const role of required) {
      expect(roleCapabilities(tileset, role).requiresPatternGrammar, role).toBe(true);
    }
    for (const role of notRequired) {
      expect(roleCapabilities(tileset, role).requiresPatternGrammar, role).toBe(false);
    }
  });
});
```

- [ ] **Step 3: 지금 통과하는지 확인**

Run: `npm test -- test/aiPreviewPatternGrammarRequirement.test.ts`
Expected: PASS (Task 1 의 표가 이미 이 값을 갖고 있다)

- [ ] **Step 4: 분기를 바꾼다**

```ts
function needsPatternGrammar(tileset: TilesetDef, group: TileGroupMetadata): boolean {
  return roleCapabilities(tileset, group.role).requiresPatternGrammar;
}
```

Step 1 에서 확인한 호출자에 `tileset` 인자를 넘긴다.

- [ ] **Step 5: 통과 + 회귀 확인**

Run: `npm test -- test/aiPreview && npm run typecheck`
Expected: 신규 실패 0, 타입 에러 0

- [ ] **Step 6: 커밋**

```bash
git add src/project/aiPreviewContracts.ts test/aiPreviewPatternGrammarRequirement.test.ts
git commit -m "refactor(tile): 패턴 문법 필수 판정을 능력으로 옮긴다 (A-2)

aiPreviewContracts.ts:431 의 terrain/water/wall 3중 비교를 caps
.requiresPatternGrammar 로 바꾼다. 조회 함수가 타일셋을 요구하므로
needsPatternGrammar 시그니처에 tileset 을 추가했다."
```

---

### Task 6: `tileVocabulary` — `autotile` 이관

**Files:**
- Modify: `src/project/tileVocabulary.ts:257-259`
- Test: `test/tileVocabAutotileCapability.test.ts`

**Interfaces:**
- Consumes: `roleCapabilities()` (Task 1)
- Produces: 없음

`isAutotileGroup` 은 같은 파일 안의 private 함수다. `TilesetDef` 접근이 되는지 호출자를 확인한다.

- [ ] **Step 1: 호출 지점 확인**

Run: `grep -n "isAutotileGroup" src/project/tileVocabulary.ts`

- [ ] **Step 2: 특성화 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

describe("오토타일 역할 (특성화)", () => {
  it("water 만 문법 없이도 오토타일로 취급된다", () => {
    const tileset = defaultTileset();
    expect(roleCapabilities(tileset, "water").autotile).toBe(true);
    for (const role of ["terrain", "wall", "roof", "prop", "fence", "building", "castle"]) {
      expect(roleCapabilities(tileset, role).autotile, role).toBe(false);
    }
  });
});
```

- [ ] **Step 3: 지금 통과하는지 확인**

Run: `npm test -- test/tileVocabAutotileCapability.test.ts`
Expected: PASS

- [ ] **Step 4: 분기를 바꾼다**

```ts
function isAutotileGroup(tileset: TilesetDef, group: TileGroupMetadata): boolean {
  const kind = group.patternGrammar?.kind;
  if (kind === "autotile_3x3" || kind === "animated_terrain") return true;
  return roleCapabilities(tileset, group.role).autotile;
}
```

Step 1 에서 찾은 호출자에 `tileset` 을 넘긴다.

- [ ] **Step 5: 통과 + 회귀 확인**

Run: `npm test -- test/tileVocab test/materialPolicy && npm run typecheck`
Expected: 신규 실패 0

- [ ] **Step 6: 커밋**

```bash
git add src/project/tileVocabulary.ts test/tileVocabAutotileCapability.test.ts
git commit -m "refactor(tile): 오토타일 판정을 autotile 능력으로 옮긴다 (A-2)

tileVocabulary.ts:257 의 role === water 를 caps.autotile 로 바꾼다.
patternGrammar.kind 우선 판정은 그대로 남긴다 — 문법이 명시되면 역할보다
문법이 이긴다."
```

---

### Task 7: `combinedTown` — `terrainTag` 이관

**Files:**
- Modify: `src/project/tilesetHarness/combinedTown.ts:348-352`
- Test: `test/combinedTownTerrainTag.test.ts`

**Interfaces:**
- Consumes: `roleCapabilities()` (Task 1)
- Produces: 없음

`group.id.includes("dirt-road")` 조건은 **id 기반이라 역할로 접히지 않는다.** 그대로 남긴다.

- [ ] **Step 1: 특성화 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { COMBINED_TOWN_HARNESS_GROUPS } from "@/project/tilesetHarness/combinedTownGroups";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

describe("combinedTown terrainTag (특성화)", () => {
  it("water 역할 그룹만 water 태그를 요구한다", () => {
    const tileset = defaultTileset();
    for (const group of COMBINED_TOWN_HARNESS_GROUPS) {
      const wantsWater = roleCapabilities(tileset, group.role).terrainTag === "water";
      expect(wantsWater, `그룹 ${group.id}`).toBe(group.role === "water");
    }
  });

  it("흙길 그룹은 role 이 terrain 이라 태그를 id 로 판정한다", () => {
    const road = COMBINED_TOWN_HARNESS_GROUPS.find((g) => g.id.includes("dirt-road"));
    expect(road).toBeDefined();
    expect(road!.role).toBe("terrain");
  });
});
```

- [ ] **Step 2: 지금 통과하는지 확인**

Run: `npm test -- test/combinedTownTerrainTag.test.ts`
Expected: PASS

- [ ] **Step 3: 분기를 바꾼다**

```ts
function terrainTagForGroup(tileset: TilesetDef, group: CombinedTownHarnessGroup, fallback: number): number {
  if (roleCapabilities(tileset, group.role).terrainTag === "water") return TERRAIN_TAG.WATER;
  // id 기반 조건 — 역할로 접히지 않는다. 흙길 그룹의 role 은 terrain 이다.
  if (group.id.includes("dirt-road")) return TERRAIN_TAG.NORMAL;
  return fallback;
}
```

호출자에 `tileset` 을 넘긴다. 같은 파일 안이며 `tileset` 이 이미 스코프에 있을 것이다 — `grep -n "terrainTagForGroup" src/project/tilesetHarness/combinedTown.ts` 로 확인한다.

- [ ] **Step 4: 통과 + 회귀 확인**

Run: `npm test -- test/combinedTown test/tilesetHarness && npm run typecheck`
Expected: 신규 실패 0

- [ ] **Step 5: 커밋**

```bash
git add src/project/tilesetHarness/combinedTown.ts test/combinedTownTerrainTag.test.ts
git commit -m "refactor(tile): 지형 태그 부여를 terrainTag 능력으로 옮긴다 (A-2)

combinedTown.ts:348 의 role === water 를 caps.terrainTag 로 바꾼다.
dirt-road id 조건은 남긴다 — 흙길 그룹의 role 은 terrain 이라 역할로
접히지 않고, 이건 그룹 id 기반 사실이다."
```

---

### Task 8: `aiPreviewThemeGrammar` — `themeCapabilityRoles` 표로 이관

**Files:**
- Modify: `src/editor/tools/v3/grammarProfiles.ts`
- Modify: `src/project/aiPreviewThemeGrammar.ts:110-115`
- Test: `test/themeCapabilityRoles.test.ts`

**Interfaces:**
- Consumes: `GrammarProfile`, `tilesetGrammarProfile()` (`grammarProfiles.ts:86`)
- Produces: `GrammarProfile.themeCapabilityRoles: Readonly<Record<AiPreviewThemeCapability, readonly string[]>>`

이 분기는 `RoleCapabilities` 로 표현하지 않는다. `capability → role[]` 역인덱스이며 역할별 속성이 아니다. 프로파일의 별도 표로 둔다.

- [ ] **Step 1: `AiPreviewThemeCapability` 의 정확한 값 목록을 확인한다**

Run: `grep -rn "AiPreviewThemeCapability" src/project/ | head -5`

7종(`walkableFloor` `solidBoundary` `wallFace` `roomTrim` `buildingShell` `doorOrEntrance` `waterOrHazard`)으로 알고 있으나 **추측하지 말고 정의를 읽어 맞춘다.**

> **실측: 8종이었다.** `decorProp` 이 추가로 있다(`aiPreviewContracts.ts:24-32`). 아래
> Step 4 의 표는 7종만 담고 `decorProp` 은 Step 6 의 폴백으로 흘리는 것이 맞다 — 원본에도
> `decorProp` 분기가 없었으므로 그것이 동작 변화 0 이다.

- [ ] **Step 2: 특성화 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { RM_TYPE_GRAMMAR_PROFILE } from "@/editor/tools/v3/grammarProfiles";

describe("themeCapabilityRoles (특성화)", () => {
  it("기존 groupsForCapability 매핑을 그대로 재현한다", () => {
    const table = RM_TYPE_GRAMMAR_PROFILE.themeCapabilityRoles;
    expect(table.walkableFloor).toEqual(["terrain"]);
    expect(table.solidBoundary).toEqual(["wall"]);
    expect(table.wallFace).toEqual(["wall"]);
    expect(table.roomTrim).toEqual(["building", "prop"]);
    expect(table.buildingShell).toEqual(["building", "prop"]);
    expect(table.doorOrEntrance).toEqual(["building", "prop"]);
    expect(table.waterOrHazard).toEqual(["water"]);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npm test -- test/themeCapabilityRoles.test.ts`
Expected: FAIL — `themeCapabilityRoles` 가 없다

- [ ] **Step 4: 프로파일에 표를 추가한다**

`grammarProfiles.ts` 의 `GrammarProfile` 인터페이스에 필드를 추가한다:

```ts
  /**
   * 테마 적격성 능력 → 그 능력을 만족하는 역할 목록. capability → role[] 역인덱스이며
   * RoleCapabilities(역할별 속성)와는 방향이 반대다. 출처: aiPreviewThemeGrammar:110-115
   */
  readonly themeCapabilityRoles: Readonly<Record<string, readonly string[]>>;
```

`RM_TYPE_GRAMMAR_PROFILE` 과 `MODERN_EXTERIORS_GRAMMAR_PROFILE` 양쪽에 같은 표를 넣는다 (현재 코드는 프로파일과 무관하게 한 매핑만 쓰므로 두 프로파일이 같은 값을 갖는 것이 동작 변화 0 이다):

```ts
  themeCapabilityRoles: {
    walkableFloor: ["terrain"],
    solidBoundary: ["wall"],
    wallFace: ["wall"],
    roomTrim: ["building", "prop"],
    buildingShell: ["building", "prop"],
    doorOrEntrance: ["building", "prop"],
    waterOrHazard: ["water"],
  },
```

- [ ] **Step 5: 통과 확인**

Run: `npm test -- test/themeCapabilityRoles.test.ts`
Expected: PASS

- [ ] **Step 6: 소비처를 표 기반으로 바꾼다**

`aiPreviewThemeGrammar.ts:110-115`:

```ts
function groupsForCapability(
  tileset: TilesetDef,
  evidence: AiPreviewThemeEligibilityEvidence,
  capability: AiPreviewThemeCapability,
): readonly TileGroupMetadata[] {
  const table = tilesetGrammarProfile(tileset).themeCapabilityRoles;
  // 표에 없는 능력은 기존 폴백(prop/fence/roof)을 그대로 쓴다.
  const roles = table[capability] ?? ["prop", "fence", "roof"];
  return evidence.semanticGroups.filter((group) => roles.includes(group.role));
}
```

`tileset` 인자를 호출자에서 넘긴다. 호출자가 타일셋을 못 갖고 있으면 `getGrammarProfile(undefined)` 로 기본 프로파일을 쓰는 오버로드를 만들지 말고, **호출자를 따라 올라가 타일셋을 전달한다** — 조용한 기본값은 A-3 에서 오버라이드가 붙을 때 버그가 된다.

- [ ] **Step 7: 통과 + 회귀 확인**

Run: `npm test -- test/aiPreview test/themeCapabilityRoles.test.ts && npm run typecheck`
Expected: 신규 실패 0

- [ ] **Step 8: 커밋**

```bash
git add src/editor/tools/v3/grammarProfiles.ts src/project/aiPreviewThemeGrammar.ts test/themeCapabilityRoles.test.ts
git commit -m "refactor(tile): 테마 능력별 역할 매핑을 프로파일 표로 옮긴다 (A-2)

aiPreviewThemeGrammar.ts:110-115 의 5중 role 필터를 GrammarProfile
.themeCapabilityRoles 로 옮긴다.

이건 RoleCapabilities 로 표현하지 않았다 — capability → role[] 역인덱스라
역할별 속성이 아니다. 방향이 반대인 것을 같은 그릇에 담으면 A-3 에서
타일셋 오버라이드를 붙일 때 의미가 꼬인다.

두 프로파일에 같은 값을 넣었다. 현재 코드가 프로파일과 무관하게 한 매핑만
쓰므로 이게 동작 변화 0 이다."
```

---

### Task 9: `buildPaletteCore` — 중복 `layerHome` 컬럼 제거 — **Step 3 취소 (컬럼 유지)**

> **실행 결과:** Step 1·2 만 수행했다. Step 2 가 **FAIL** — 8 항목 중 4 건이 역할 기본값과
> 어긋나고 `role: "prop"` 이 3 개 값을 갖는다. 계획의 Step 2 지시("FAIL 이면 여기서 멈추고
> 보고한다")대로 삭제를 취소했다. 불일치를 고정하는 테스트만 남겼다(`2fe4bbcc`).
>
> 이 실패가 A-3 의 방향을 바꿨다 — 위 "실행 결과 § Task 9" 와 스펙 ② 의 "⚠️ A-3 제약" 참조.
> 아래 Step 3~5 는 **실행하지 않았다.** 기록으로만 남긴다.

**Files:**
- Modify: `src/editor/panels/buildPaletteCore.ts:85-101`
- Test: `test/buildPaletteClaimLayerHome.test.ts`

**Interfaces:**
- Consumes: `roleCapabilities()` (Task 1)
- Produces: 없음

`BUILD_PALETTE_GROUP_CLAIMS` 는 분기가 아니라 **선언 표**다. `role` 과 `layerHome` 을 짝지어 갖고 있어 역할 능력과 중복된다. 단 값이 항상 일치하지는 않는다 — 먼저 확인하고, **불일치하면 컬럼을 지우지 말고 보고한다.**

- [ ] **Step 1: 표의 layerHome 이 역할 능력과 일치하는지 검사하는 테스트를 쓴다**

```ts
import { describe, expect, it } from "vitest";
import { BUILD_PALETTE_GROUP_CLAIMS } from "@/editor/panels/buildPaletteCore";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

describe("건축 팔레트 클레임의 layerHome", () => {
  it("역할 능력의 layerHome 과 어긋나는 항목을 드러낸다", () => {
    const tileset = defaultTileset();
    const mismatches: string[] = [];
    for (const [key, claim] of Object.entries(BUILD_PALETTE_GROUP_CLAIMS)) {
      const fromRole = roleCapabilities(tileset, claim.role).layerHome;
      if (fromRole !== claim.layerHome) {
        mismatches.push(`${key}: 표=${claim.layerHome} 역할(${claim.role})=${fromRole}`);
      }
    }
    // 불일치 목록을 그대로 드러낸다. 0 이 아니면 컬럼을 지울 수 없다.
    expect(mismatches).toEqual([]);
  });
});
```

`BUILD_PALETTE_GROUP_CLAIMS` 가 export 되어 있지 않으면 테스트용으로 export 한다.

- [ ] **Step 2: 테스트를 돌려 불일치를 확인한다**

Run: `npm test -- test/buildPaletteClaimLayerHome.test.ts`

**FAIL 이면 이 태스크를 여기서 멈추고 보고한다.** 불일치 목록이 곧 "표와 역할이 다른 답을 내는 지점"이며, 어느 쪽이 맞는지는 A-1 의 "동작 변화 0" 원칙으로 판단할 수 없다(둘 다 현재 동작이다). Task 3 의 `sampleLayer` 처럼 능력을 하나 더 갈라야 할 수도 있다.

**PASS 이면** Step 3 으로 간다.

- [ ] **Step 3: 컬럼을 지우고 역할에서 유도한다**

`BuildPaletteGroupClaim` 에서 `layerHome` 을 뺀다:

```ts
interface BuildPaletteGroupClaim {
  readonly name: string;
  readonly role: TileGroupRole;
  readonly patternKind?: NonNullable<NonNullable<TileGroupMetadata["patternGrammar"]>["kind"]>;
}

const BUILD_PALETTE_GROUP_CLAIMS: Record<BuildPaletteGroupRole, BuildPaletteGroupClaim> = {
  wall: { name: "흰 집 벽", role: "wall", patternKind: "nine_slice_expandable" },
  door: { name: "문", role: "prop", patternKind: "vertical_expandable" },
  window: { name: "창문", role: "prop" },
  roof: { name: "직선 지붕", role: "roof", patternKind: "horizontal_expandable" },
  path: { name: "흙길", role: "terrain", patternKind: "autotile_3x3" },
  water: { name: "물", role: "water" },
  tree: { name: "침엽수", role: "prop", patternKind: "vertical_expandable" },
  prop: { name: "꽃", role: "prop" },
};
```

`claim.layerHome` 을 읽던 곳을 `roleCapabilities(tileset, claim.role).layerHome` 으로 바꾼다. 읽는 지점을 먼저 찾는다:

Run: `grep -n "layerHome" src/editor/panels/buildPaletteCore.ts`

- [ ] **Step 4: 통과 + 회귀 확인**

Run: `npm test -- test/buildPalette && npm run typecheck`
Expected: 신규 실패 0

- [ ] **Step 5: 커밋**

```bash
git add src/editor/panels/buildPaletteCore.ts test/buildPaletteClaimLayerHome.test.ts
git commit -m "refactor(tile): 건축 팔레트 클레임의 중복 layerHome 을 없앤다 (A-2)

BUILD_PALETTE_GROUP_CLAIMS 는 분기가 아니라 선언 표였고 role 과 layerHome
을 같이 들고 있어 역할 능력과 중복이었다. 테스트로 두 값이 전 항목에서
일치함을 먼저 확인한 뒤 컬럼을 지웠다.

일치 검사 테스트는 남겨둔다 — A-3 에서 타일셋 오버라이드가 붙으면 이
표가 다시 어긋날 수 있다."
```

---

### Task 10: `benchmark/interior/groundTruth` — `furniture` 필터를 태그 기반으로 — **취소 (무변경, A-3 이월)**

> **취소 사유 (측정):** `role: "furniture"` 인 시맨틱 항목 57 개 중
> `tags.includes("furniture")` = **0**, `tags.includes("가구")` = **0**. 실내 시맨틱은 태그에
> 라벨을 앞에 붙이고(`tileSemanticsCombinedTown.ts:23`) 나머지 태그도 `table`/`shelf`/
> `cabinet` 처럼 품목 단위라 가구를 묶는 상위 태그가 존재하지 않는다.
>
> Step 3 의 `|| tags.includes("furniture") || tags.includes("가구")` 를 넣었다면 두 항이
> 57 항목 전부에서 **영구히 false** 인 죽은 코드가 되고, `furniture` → `prop` 병합 후에는
> `furnitureSolid` 정답지가 **조용히 빈 집합**을 본다(예외도 실패도 없이 지표만 무의미해진다).
> Step 3 에 적어 둔 탈출구("태그가 없으면 `role === "furniture"` 를 남기고 A-3 으로 넘긴다")
> 를 따라 무변경으로 종료했다.
>
> **A-3 로 넘긴 실제 작업:** `furniture` → `prop` 병합 **전에** 가구 식별 수단을 먼저
> 만들어야 한다 — (a) 57 항목에 공통 태그 부여, (b) 품목 태그 화이트리스트, (c) 정답지를
> 태그 축에서 떼어내기. 스펙 ① 의 "병합의 필수 선행 단계" 에 기록했다.

**Files:**
- Modify: `src/benchmark/interior/groundTruth.ts:213,216`
- Test: 기존 벤치마크 테스트로 검증 (신규 테스트 없음)

**Interfaces:**
- Consumes: 없음 (시맨틱 테이블 직접 조회)
- Produces: 없음

스펙 ①의 `furniture` → `prop` 병합에 따라 이 필터가 A-3 에서 깨진다. **지금은 병합 전이므로 값은 그대로 두고**, 필터가 역할 대신 태그를 보게 바꿔 A-3 에서 손댈 필요가 없게 한다.

- [ ] **Step 1: 현재 필터가 무엇을 뽑는지 기록한다**

Run: `npm test -- test/benchmark 2>&1 | tail -30`

먼저 기존 벤치마크 테스트가 지금 통과하는지 본다. 실패하고 있으면 **이 태스크를 건너뛰고 보고한다** — 이미 깨진 것 위에서 리팩터하면 판정이 불가능하다.

- [ ] **Step 2: 시맨틱 테이블에 `furniture` 역할 항목이 태그를 갖고 있는지 확인한다**

Run: `grep -n '"furniture"' src/project/defaults/tileSemanticsInterior.ts | head -5`

`entries(indexes, label, role, passage, tags)` 형태이며 `tags` 에 `label` 이 자동 포함된다(`tileSemanticsCombinedTown.ts:23`). 태그로 거를 수 있는지 확인한다.

- [ ] **Step 3: 필터를 태그 기반으로 바꾼다**

`groundTruth.ts:213,216` 의 `entry.role === "furniture"` 를 태그 검사로 바꾼다:

```ts
/** 가구 판정 — A-3 에서 role furniture 가 prop 으로 병합되므로 태그를 본다. */
function isFurnitureEntry(entry: { role: string; tags: readonly string[] }): boolean {
  return entry.role === "furniture" || entry.tags.includes("furniture") || entry.tags.includes("가구");
}
```

Step 2 에서 확인한 실제 태그 값에 맞춘다. **태그가 없으면** `role === "furniture"` 를 남기고 이 태스크를 A-3 으로 넘긴다 — 없는 태그로 거르면 벤치마크가 조용히 빈 집합을 본다.

- [ ] **Step 4: 벤치마크가 Step 1 과 같은 결과인지 확인**

Run: `npm test -- test/benchmark`
Expected: Step 1 과 같은 실패 집합

- [ ] **Step 5: 커밋**

```bash
git add src/benchmark/interior/groundTruth.ts
git commit -m "refactor(bench): 가구 판정을 역할 대신 태그로 본다 (A-2)

A-3 에서 role furniture 가 prop 으로 병합되면 이 필터가 빈 집합을 보게
된다. 병합 전에 태그 기반으로 바꿔 A-3 에서 손댈 곳을 줄인다.

role === furniture 도 or 조건으로 남겨 병합 전후 양쪽에서 동작한다."
```

---

### Task 11: A-2 완료 게이트 — 잔여 역할 비교 0 검증

**Files:**
- Create: `test/roleNameComparisonGate.test.ts`

**Interfaces:**
- Consumes: 없음 (소스 텍스트 검사)
- Produces: 없음

A-2 의 목표는 "role 이름 비교가 코드에서 사라진다"였다. 그것을 테스트로 못 박아 A-3 이후에도 되돌아가지 않게 한다.

> **실행 정정 3건:**
> 1. 아래 정규식 `/\.role\s*===\s*["'][a-z]+["']/` 는 선행 점을 강제해 **맨 지역변수**
>    (`role === "path"`)를 놓친다. `\brole` 로 바꿨고, `\brole` 이 `paletteRole` 을 물지
>    않음을 10 케이스로 직접 검증했다.
> 2. `fs.globSync` 는 이 환경에서 쓸 수 없어 `readdirSync` 재귀 순회로 바꿨다(`a81116d8`).
> 3. 허용 목록은 5곳이 아니라 **11 파일 / 22 줄**이다. 파일별 **줄 수까지** 못 박아
>    새 비교가 들어와도 잡히고, 이관이 진행돼 비교가 사라지면 "허용 항목이 죽었다"고
>    알려 목록이 함께 낡지 않는다. 그 중 2건(`paletteLayerForTile` 중복,
>    `themePacks` 의 `terrainTag = 0`)은 A-3 후보로 표시했다 — 스펙 ⑦ 의 표 참조.

- [ ] **Step 1: 게이트 테스트를 쓴다**

```ts
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A-2 완료 게이트 — role 이름 문자열 비교가 남아 있으면 실패한다.
 *
 * 허용 목록은 "역할로 접히지 않는다"고 판정해 의도적으로 남긴 곳이다.
 * 새 항목을 추가할 때는 왜 접히지 않는지 한 줄로 적는다.
 */
const ALLOWED = new Map<string, string>([
  // 프롬프트 예시 휴리스틱 — 행동 게이트가 아니다 (스펙 "제외: turnGuide.ts:60")
  ["src/ai/turnGuide.ts", "형식 예시 이름 고르기 휴리스틱"],
  // 능력 표 자체 — 여기가 role 이름의 정본이다
  ["src/project/tileRoles.ts", "능력 표 정의"],
  // 프로파일 표 — layerHomeByRole / themeCapabilityRoles 의 키
  ["src/editor/tools/v3/grammarProfiles.ts", "프로파일 표의 키"],
  // 시드 그룹 선언 — 각 그룹이 자기 역할을 선언한다 (비교가 아니다)
  ["src/project/tilesetHarness/combinedTownGroups.ts", "그룹 역할 선언"],
  // A-3 병합 전까지 or 조건으로 남김 (Task 10)
  ["src/benchmark/interior/groundTruth.ts", "furniture 병합 전 호환"],
]);

const ROLE_COMPARISON = /\.role\s*===\s*["'][a-z]+["']/;

function sourceFiles(): string[] {
  return globSync("src/**/*.ts", { cwd: process.cwd() }).filter((f) => !f.endsWith(".d.ts"));
}

describe("A-2 게이트 — role 이름 비교 잔여", () => {
  it("허용 목록 밖에서 role 이름을 직접 비교하지 않는다", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      if (ALLOWED.has(file)) continue;
      const text = readFileSync(join(process.cwd(), file), "utf8");
      for (const [lineNo, line] of text.split("\n").entries()) {
        if (ROLE_COMPARISON.test(line)) offenders.push(`${file}:${lineNo + 1}  ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

`fs.globSync` 는 이 환경(Node v24.11.1)에 있음을 확인했다. 저장소에 glob 계열 의존성은 없으므로 내장 API 를 쓴다.

- [ ] **Step 2: 게이트를 돌려 잔여를 확인한다**

Run: `npm test -- test/roleNameComparisonGate.test.ts`

FAIL 이면 목록에 나온 파일이 **Task 2~10 에서 놓친 분기**다. 허용 목록에 넣어 숨기지 말고 이관한다. 정말 접히지 않는 것이면 이유를 적어 허용 목록에 넣는다.

- [ ] **Step 3: 전체 테스트로 기준선과 비교한다**

```bash
npm test 2>&1 | tail -40
```

기준선 워크트리(`/home/main/z-project/rpg-zzu`, main)에서 같은 명령을 돌려 **실패 집합의 차집합**을 본다. 신규 실패가 0 이어야 A-2 완료다.

- [ ] **Step 4: 커밋**

```bash
git add test/roleNameComparisonGate.test.ts
git commit -m "test(tile): role 이름 비교 잔여를 0 으로 못 박는다 (A-2 게이트)

A-2 의 목표가 지켜졌는지 테스트로 강제한다. 허용 목록은 '역할로 접히지
않는다'고 판정해 의도적으로 남긴 11 파일 / 22 줄이며 각각 이유가 적혀 있다.

이 게이트가 있으면 A-3 에서 role 을 string 으로 열 때 새 이름 비교가
슬쩍 들어오는 것을 막을 수 있다."
```

---

### Task 12: 스펙 문서를 계획 발견사항으로 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-tileset-owned-role-registry-design.md`

**Interfaces:** 없음 (문서)

계획 작성 중 스펙과 어긋나는 사실 2건이 나왔다. 스펙이 정본이므로 갱신한다.

> **실행 시점에는 2건이 아니라 8건이었다.** 아래 Step 1·1b·2 외에 A-1·A-2 실행이 다음을
> 추가로 드러냈고 스펙·계획 양쪽에 반영했다.
>
> | 발견 | 반영 위치 |
> |---|---|
> | `AiPreviewThemeCapability` 8종 (`decorProp` 누락) + 폴백이 본체 | 스펙 ② "themeCapabilityRoles" |
> | **스펙 ② 의 2단 해석에 선례가 있다** (`vocabLayerHomeFor` 3단 사슬) | 스펙 ② "⚠️ A-3 제약" |
> | Task 9 삭제 취소 — `role: "prop"` 이 3개 값 | 스펙 ② "⚠️ A-3 제약" |
> | Task 10 취소 — 가구 태그가 0개, 심어야 한다 | 스펙 ① "병합의 필수 선행 단계" |
> | 게이트 잔여 22줄 중 A-3 후보 2건 (`paletteLayerForTile` 중복, `terrainTag = 0`) | 스펙 ⑦ "A-2 완료 게이트" |
> | `requiresPatternGrammar`·`autotile`·`needsBackdrop` 은 필수 필드 | 스펙 ① 인터페이스 |
> | 검증은 revert 가 아니라 변이 | 스펙 ⑦ / 이 계획 "실행 결과" |
> | vitest 실체는 4.1.10 (매니페스트는 3.2.4) | 이 계획 Tech Stack |

- [ ] **Step 1: 능력 개수를 7 → 8 로 고치고 `sampleLayer` 를 추가한다**

① 절의 능력 표에 행을 추가한다:

```markdown
| `sampleLayer` | `lower\|upper` (선택) | `groupSampleBuilder.ts:174` |
```

그리고 `layerHome` 행 아래에 설명을 붙인다:

```markdown
`layerHome` 과 `sampleLayer` 는 이름이 비슷하지만 다른 질문이며 **답이 다르다.**
`grammarProfiles.ts:45` 는 `prop: "perCell"`(어휘 홈)이고 `groupSampleBuilder.ts:174`
는 `role === "prop" → "upper"`(샘플 렌더 레이어)다. 하나로 합치면 동작이 바뀐다.
```

`능력 7개` 를 언급하는 모든 곳을 `8개` 로, `13종 × 능력 7개 = 91칸` 을 `13종 × 능력 8개 = 104칸` 으로 고친다.

Run: `grep -n "7개\|91칸" docs/superpowers/specs/2026-09-01-tileset-owned-role-registry-design.md`

- [ ] **Step 1b: `terrainTag` 타입을 `number` → `"water"` 로 고친다**

스펙 ① 은 `terrainTag?: number` 라고 썼으나 계획은 `terrainTag?: "water"` 를 쓴다. 능력이 답하는 질문은 "이 역할의 태그 숫자가 몇인가"가 아니라 "이 역할이 물 태그를 원하는가"이며, 숫자(`TERRAIN_TAG.WATER`)는 소비처인 `combinedTown.terrainTagForGroup` 이 아는 값이다. 능력 표가 태그 상수를 알면 하네스 구현이 스키마로 새어 나온다.

스펙의 해당 행을 이렇게 고친다:

```markdown
| `terrainTag` | `"water"` (선택) | `combinedTown.ts:348` |
```

- [ ] **Step 2: `aiPreviewThemeGrammar` 를 `RoleCapabilities` 밖으로 명시한다**

② 절(프로파일/오버라이드)의 스키마 변경 블록에 필드를 추가한다:

```ts
  /** 테마 적격성 능력 → 역할 목록. capability → role[] 역인덱스라 RoleCapabilities 와 방향이 반대다. */
  readonly themeCapabilityRoles: Readonly<Record<string, readonly string[]>>;
```

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/specs/2026-09-01-tileset-owned-role-registry-design.md
git commit -m "docs(spec): 계획 작성에서 드러난 능력 2건을 반영한다

layerHome 이 하나가 아니라 둘이었다 — 어휘 홈(perCell)과 샘플 렌더
레이어(upper)가 prop 에서 갈린다. 합치면 A-1 의 동작 변화 0 이 깨지므로
sampleLayer 로 가른다. 능력 7개 → 8개.

aiPreviewThemeGrammar 의 5중 필터는 capability → role[] 역인덱스라
RoleCapabilities 가 아니다. GrammarProfile.themeCapabilityRoles 로 둔다."
```

---

## A-3 는 이 계획에 없다

`role: string` 개방·어휘 통합 마이그레이션·`materialSets`·DB 탭 3개·AI 제안 경로는 **별도 계획**이다.

의도적인 분리다. 스펙이 A안을 택한 이유가 "16개 분기 중 몇 개는 지금 의미가 불분명하고, 하나씩 옮기면 드러난다"였고, 계획 작성 단계에서 이미 두 건이 드러났다(`layerHome` 분열, 테마 역인덱스). A-2 를 실제로 수행하면 더 나올 것이고, 그 결과를 보고 A-3 계획을 쓰는 것이 A안의 요지다.

A-3 계획을 쓰기 위한 선행 조건:
- ~~Task 11 게이트가 green (role 이름 비교 잔여 0)~~ → **충족.** 잔여 0 이 아니라 허용
  목록 11 파일 / 22 줄로 고정되었고 각 줄에 이유가 붙었다. "잔여 0" 은 애초에 달성 불가능한
  목표였다 — 선언 표의 키와 역할로 그룹을 고르는 질의는 비교가 아니지만 정규식에는 걸린다.
- ~~Task 12 로 스펙이 실제 능력 목록과 일치~~ → **충족** (이 커밋)
- ~~Task 9 Step 2 의 불일치 목록이 비어 있거나, 비어 있지 않은 이유가 문서화됨~~ →
  **비어 있지 않았고, 이유가 문서화되었다.** 4 건 불일치. 스펙 ② "⚠️ A-3 제약"

**A-3 이 계획 첫 줄에서 읽어야 할 것 — 우선순위 순:**

1. **스펙 ② "⚠️ A-3 제약"** — 2단 해석을 새로 짓지 마라. `vocabLayerHomeFor` 의 3단 사슬과
   화해해야 한다. A-2 실행의 가장 무거운 발견이다.
2. **스펙 ① "병합의 필수 선행 단계"** — `furniture` → `prop` 치환 전에 가구 태그를 심어야
   한다. 순서를 뒤집으면 벤치마크가 조용히 죽는다.
3. **스펙 ⑦ 게이트 표** — A-3 이 손봐야 하는 잔여 2건. 특히 `paletteLayerForTile` 은 이
   저장소의 **네 번째** layerHome 계열 의미이며 두 파일에 중복돼 있다.
4. **스펙 ② "themeCapabilityRoles"** — `?? ["prop","fence","roof"]` 폴백은 지우면 안 된다.
   `decorProp` 의 유일한 경로다.
