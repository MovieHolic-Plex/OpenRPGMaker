# 다중 타일 캐릭터 발자국 — 1차 구현 계획 (스펙 단계 1–5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 맵 이벤트가 2x2·3x3 발자국을 갖고, 확대된 스프라이트로 그려지며, 그 발자국 전체가 통행·대화 판정에 실제로 쓰이게 한다.

**Architecture:** 발밑 앵커 발자국 프리미티브를 새로 만들고(1x1 에서 기존 좌표와 항등), 이벤트 히트테스트를 점 질의에서 사각 질의로 승격하되 기존 시그니처는 얇은 래퍼로 남겨 호출부 30여 곳을 건드리지 않는다. 지형 통행은 이동 방향의 선행 모서리만 검사해 1x1 에서 기존 `canMove` 1회 호출로 환원시킨다.

**Tech Stack:** TypeScript, vitest, Phaser (렌더는 구조적 인터페이스로 추상화돼 있어 테스트에서 mock 가능)

**Spec:** `docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md`

## Global Constraints

- **1x1 항등성은 절대 조건이다.** `footprint` 를 생략하면 `UNIT_FOOTPRINT`(1x1)이고, 그때 모든 새 함수가 기존 함수와 동일한 값을 내야 한다. 기존 테스트가 하나라도 깨지면 그건 구현 실수지 의도된 변화가 아니다.
- **앵커는 발밑이다.** `(x, y)` 는 발자국 **하단 행**의 칸이며, 짝수 폭은 **왼쪽 치우침**이다. `spatialPlacements.ts` 의 `SpatialFootprint`(좌상단 앵커)와 절대 섞지 말 것.
- **`spatialPlacements.ts` / `spatialOccupancy.ts` 는 이 계획에서 수정하지 않는다.**
- **축 상한 8.** `CHARACTER_FOOTPRINT_AXIS_MAX = 8`. 면적 상한 상수는 두지 않는다(축 8이면 최대 면적 64가 이미 파생된다).
- **주석·테스트명은 한국어.** 기존 파일(`test/collision.test.ts`, `src/project/collision.ts`)의 관례를 따른다.
- **테스트 실행:** `node scripts/run-vitest.mjs run --configLoader bundle <파일경로>` (단일 파일 약 9초)
- **타입 검사:** `npm run typecheck:app`
- 이 계획은 스펙 단계 1–5 만 다룬다. 에디터 UI·플레이어 발자국·워프 배선·NPC 자율이동 발자국은 2차 계획이다.

---

### Task 1: 발자국 프리미티브

발밑 앵커 발자국의 타입과 순수 함수. 다른 모든 태스크가 여기에 의존한다.

**Files:**
- Modify: `src/project/types/base.ts` (파일 끝, `SCHEMA_VERSION` 선언 직전에 추가)
- Create: `src/project/footprint.ts`
- Test: `test/characterFootprint.test.ts`

**Interfaces:**
- Consumes: 없음 (최초 태스크)
- Produces:
  - `CharacterFootprint { readonly width: number; readonly height: number }` — `@/project/types`
  - `FootprintRect { readonly left, right, top, bottom: number }` — 네 값 모두 **포함(inclusive)** — `@/project/types`
  - `UNIT_FOOTPRINT: CharacterFootprint` — `@/project/footprint`
  - `CHARACTER_FOOTPRINT_AXIS_MAX: 8`, `CHARACTER_SCALE_MIN: 0.25`, `CHARACTER_SCALE_MAX: 8` — `@/project/footprint`
  - `footprintBounds(x: number, y: number, fp: CharacterFootprint): FootprintRect`
  - `pointRect(x: number, y: number): FootprintRect`
  - `rectsOverlap(a: FootprintRect, b: FootprintRect): boolean`
  - `footprintContains(x: number, y: number, fp: CharacterFootprint, px: number, py: number): boolean`
  - `footprintCells(x: number, y: number, fp: CharacterFootprint): { readonly x: number; readonly y: number }[]`
  - `normalizeCharacterFootprint(value: unknown): CharacterFootprint`
  - `normalizeCharacterScale(value: unknown): number`

- [ ] **Step 1: 타입을 `types/base.ts` 에 추가한다**

`src/project/types/base.ts` 의 `export const SCHEMA_VERSION = 4 as const;` 바로 위에 붙인다.

```ts
/**
 * 다중 타일 캐릭터의 충돌 발자국(타일 단위).
 * 앵커는 **발밑** — (x,y) 가 발자국 하단 행의 칸이고, 짝수 폭은 왼쪽으로 치우친다.
 *
 * ⚠ project/spatialPlacements.ts 의 SpatialFootprint 와 다른 타입이다.
 * 저쪽은 (x,y) 가 좌상단이고 우·하로 전개한다. 섞으면 좌표가 어긋난다.
 */
export interface CharacterFootprint {
  readonly width: number;
  readonly height: number;
}

/** 타일 좌표 사각형. 네 값 모두 포함(inclusive). */
export interface FootprintRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
```

`types/base.ts` 는 다른 모듈을 import 하지 않는다. 이 배치를 유지해야 `types/events.ts` → `footprint.ts` → `types` 순환이 생기지 않는다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`test/characterFootprint.test.ts` 를 새로 만든다.

```ts
// test/characterFootprint.test.ts
// 발밑 앵커 발자국 프리미티브 단위 테스트.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §1.

import { describe, expect, it } from "vitest";
import {
  CHARACTER_FOOTPRINT_AXIS_MAX,
  UNIT_FOOTPRINT,
  footprintBounds,
  footprintCells,
  footprintContains,
  normalizeCharacterFootprint,
  normalizeCharacterScale,
  pointRect,
  rectsOverlap,
} from "@/project/footprint";

describe("1x1 항등성 — 이 설계의 안전줄", () => {
  it("1x1 bounds 는 그 칸 자신이다", () => {
    expect(footprintBounds(5, 7, UNIT_FOOTPRINT)).toEqual({ left: 5, right: 5, top: 7, bottom: 7 });
  });

  it("1x1 bounds 는 pointRect 와 같다", () => {
    for (let x = -3; x <= 3; x += 1) {
      for (let y = -3; y <= 3; y += 1) {
        expect(footprintBounds(x, y, UNIT_FOOTPRINT)).toEqual(pointRect(x, y));
      }
    }
  });

  it("1x1 contains 는 그 칸에서만 참이다", () => {
    expect(footprintContains(5, 7, UNIT_FOOTPRINT, 5, 7)).toBe(true);
    expect(footprintContains(5, 7, UNIT_FOOTPRINT, 4, 7)).toBe(false);
    expect(footprintContains(5, 7, UNIT_FOOTPRINT, 5, 6)).toBe(false);
  });

  it("1x1 cells 는 한 칸이다", () => {
    expect(footprintCells(5, 7, UNIT_FOOTPRINT)).toEqual([{ x: 5, y: 7 }]);
  });
});

describe("footprintBounds — 발밑 앵커", () => {
  it("2x2 는 오른쪽·위로 자라고 앵커가 좌하단이다", () => {
    expect(footprintBounds(5, 7, { width: 2, height: 2 })).toEqual({ left: 5, right: 6, top: 6, bottom: 7 });
  });

  it("3x3 은 앵커가 하단 중앙이다", () => {
    expect(footprintBounds(5, 7, { width: 3, height: 3 })).toEqual({ left: 4, right: 6, top: 5, bottom: 7 });
  });

  it("짝수 폭은 왼쪽으로 치우친다 — 앵커 왼쪽 칸 수가 오른쪽보다 적다", () => {
    const b = footprintBounds(5, 7, { width: 4, height: 1 });
    expect(b.left).toBe(4);
    expect(b.right).toBe(7);
    expect(5 - b.left).toBeLessThan(b.right - 5);
  });

  it("하단 행은 언제나 y 다", () => {
    for (const height of [1, 2, 3, 5, 8]) {
      expect(footprintBounds(5, 7, { width: 1, height }).bottom).toBe(7);
    }
  });
});

describe("rectsOverlap — AABB", () => {
  it("맞닿기만 해도 겹침이다(포함 경계)", () => {
    expect(rectsOverlap(pointRect(1, 1), pointRect(1, 1))).toBe(true);
  });

  it("한 칸 떨어지면 겹치지 않는다", () => {
    expect(rectsOverlap(pointRect(1, 1), pointRect(2, 1))).toBe(false);
    expect(rectsOverlap(pointRect(1, 1), pointRect(1, 2))).toBe(false);
  });

  it("2x2 발자국은 자기 네 칸 전부와 겹친다", () => {
    const fp = { width: 2, height: 2 };
    const bounds = footprintBounds(5, 7, fp);
    for (const cell of footprintCells(5, 7, fp)) {
      expect(rectsOverlap(bounds, pointRect(cell.x, cell.y))).toBe(true);
    }
    expect(footprintCells(5, 7, fp)).toHaveLength(4);
  });

  it("교차하는 큰 사각끼리도 겹침을 잡는다", () => {
    expect(rectsOverlap({ left: 0, right: 5, top: 0, bottom: 1 }, { left: 2, right: 3, top: -4, bottom: 9 })).toBe(true);
  });
});

describe("normalizeCharacterFootprint — 직렬화 방어", () => {
  it("잘못된 값은 1x1 로 떨어진다", () => {
    expect(normalizeCharacterFootprint(undefined)).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint(null)).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint("2x2")).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({})).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({ width: 0, height: -3 })).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({ width: 1.5, height: 2.5 })).toEqual(UNIT_FOOTPRINT);
    expect(normalizeCharacterFootprint({ width: Number.NaN, height: 2 })).toEqual({ width: 1, height: 2 });
  });

  it("축 상한으로 클램프한다", () => {
    expect(normalizeCharacterFootprint({ width: 99, height: 99 })).toEqual({
      width: CHARACTER_FOOTPRINT_AXIS_MAX,
      height: CHARACTER_FOOTPRINT_AXIS_MAX,
    });
  });

  it("정상 값은 그대로 통과한다", () => {
    expect(normalizeCharacterFootprint({ width: 3, height: 2 })).toEqual({ width: 3, height: 2 });
  });
});

describe("normalizeCharacterScale", () => {
  it("생략·비정상은 1 이다", () => {
    expect(normalizeCharacterScale(undefined)).toBe(1);
    expect(normalizeCharacterScale("2")).toBe(1);
    expect(normalizeCharacterScale(Number.NaN)).toBe(1);
    expect(normalizeCharacterScale(0)).toBe(1);
    expect(normalizeCharacterScale(-2)).toBe(1);
  });

  it("범위 안 값은 그대로, 밖은 클램프한다", () => {
    expect(normalizeCharacterScale(2)).toBe(2);
    expect(normalizeCharacterScale(1.5)).toBe(1.5);
    expect(normalizeCharacterScale(99)).toBe(8);
    expect(normalizeCharacterScale(0.01)).toBe(0.25);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/characterFootprint.test.ts`

Expected: FAIL — `Failed to resolve import "@/project/footprint"`

- [ ] **Step 4: 구현한다**

`src/project/footprint.ts` 를 새로 만든다.

```ts
// project/footprint.ts
// 다중 타일 캐릭터의 발자국 프리미티브 — 발밑 앵커, 순수 함수.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §1.
//
// ⚠ project/spatialPlacements.ts 의 SpatialFootprint 와 혼동하지 말 것.
// 저쪽은 (x,y) 가 좌상단이고 우·하로 전개한다(농장 건물·집 장식).
// 이쪽은 (x,y) 가 발밑 칸이라 위·양옆으로 자란다(캐릭터).
// 이름이 다른 이유가 이것이므로 두 규약을 섞지 말 것.

import type { CharacterFootprint, FootprintRect } from "./types";

export const UNIT_FOOTPRINT: CharacterFootprint = { width: 1, height: 1 };

/**
 * 축 상한. spatialPlacements 의 16보다 보수적이다 — 그 크기의 "캐릭터"가
 * 걸어다니면 경로탐색이 사실상 항상 실패한다. 건물은 안 움직이므로 상한이 다르다.
 * 면적 상한 상수는 두지 않는다: 축 8이면 최대 면적 64가 이미 여기서 파생된다.
 */
export const CHARACTER_FOOTPRINT_AXIS_MAX = 8;

export const CHARACTER_SCALE_MIN = 0.25;
export const CHARACTER_SCALE_MAX = 8;

/** 발밑 앵커 (x,y) 와 크기로 발자국 사각을 만든다. 네 값 모두 포함(inclusive). */
export function footprintBounds(x: number, y: number, fp: CharacterFootprint): FootprintRect {
  const left = x - Math.floor((fp.width - 1) / 2);
  return {
    left,
    right: left + fp.width - 1,
    top: y - (fp.height - 1),
    bottom: y,
  };
}

/** 한 칸을 사각으로. 점 질의를 사각 질의에 위임할 때 쓴다. */
export function pointRect(x: number, y: number): FootprintRect {
  return { left: x, right: x, top: y, bottom: y };
}

/** AABB 겹침. 3x3 대 3x3 도 81셀이 아니라 4비교로 끝난다. */
export function rectsOverlap(a: FootprintRect, b: FootprintRect): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

export function footprintContains(
  x: number,
  y: number,
  fp: CharacterFootprint,
  px: number,
  py: number
): boolean {
  return rectsOverlap(footprintBounds(x, y, fp), pointRect(px, py));
}

/** 발자국이 덮는 모든 칸. 판정에는 rectsOverlap 을 쓰고, 이건 순회가 필요할 때만. */
export function footprintCells(
  x: number,
  y: number,
  fp: CharacterFootprint
): { readonly x: number; readonly y: number }[] {
  const rect = footprintBounds(x, y, fp);
  const cells: { x: number; y: number }[] = [];
  for (let cy = rect.top; cy <= rect.bottom; cy += 1) {
    for (let cx = rect.left; cx <= rect.right; cx += 1) cells.push({ x: cx, y: cy });
  }
  return cells;
}

export function normalizeCharacterFootprint(value: unknown): CharacterFootprint {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return UNIT_FOOTPRINT;
  const raw = value as { width?: unknown; height?: unknown };
  return { width: clampAxis(raw.width), height: clampAxis(raw.height) };
}

export function normalizeCharacterScale(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return Math.max(CHARACTER_SCALE_MIN, Math.min(CHARACTER_SCALE_MAX, value));
}

function clampAxis(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return 1;
  return Math.max(1, Math.min(CHARACTER_FOOTPRINT_AXIS_MAX, value));
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/characterFootprint.test.ts`

Expected: PASS (전부)

- [ ] **Step 6: 타입 검사**

Run: `npm run typecheck:app`

Expected: 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add src/project/types/base.ts src/project/footprint.ts test/characterFootprint.test.ts
git commit -m "feat(footprint): 발밑 앵커 발자국 프리미티브를 추가한다

다중 타일 캐릭터의 좌표 계약이다. (x,y) 를 발자국 하단 행의 칸으로 보고
짝수 폭은 왼쪽으로 치우친다. 그래서 1x1 일 때 footprintBounds 가 기존
좌표와 정확히 일치하고, 이 성질을 테스트가 고정한다 — 앞으로 붙는 모든
발자국 코드가 기존 동작을 안 바꾼다는 근거가 여기다.

타입은 types/base.ts 에 뒀다. footprint.ts 에 두면 EventPage.footprint 가
참조할 때 types/events.ts → footprint.ts → types 순환이 생긴다. PassFlag 가
base.ts 에 있고 함수가 collision.ts 에 있는 기존 배치와 같다.

spatialPlacements.ts 의 SpatialFootprint 는 재사용하지 않았다. 형태는 같지만
(x,y) 가 좌상단이라 앵커 규약이 정반대다. 섞이면 좌표가 조용히 어긋나므로
이름과 파일을 갈라 두고 주석으로 경계를 박았다.

면적 상한 상수는 두지 않았다. 축 상한이 8이면 최대 면적 64가 이미 파생되므로
별도 상수는 절대 발동하지 않는 죽은 검사가 된다."
```

---

### Task 2: 발자국 지형 통행 판정

`canMoveFootprint` — 이동 방향의 선행 모서리만 검사한다.

**Files:**
- Modify: `src/project/collision.ts` (파일 끝에 추가)
- Test: `test/collisionFootprint.test.ts`

**Interfaces:**
- Consumes: `footprintBounds`, `UNIT_FOOTPRINT` (`@/project/footprint`), `CharacterFootprint` (`@/project/types`)
- Produces: `canMoveFootprint(project: Project, map: GameMap, fromX: number, fromY: number, fp: CharacterFootprint, toX: number, toY: number): boolean` — `@/project/collision`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/collisionFootprint.test.ts` 를 새로 만든다.

`createBlankMap` 은 `lowerTiles` 를 `TILE.GRASS`(통행 가능), `upperTiles` 를 `TILE.EMPTY`(-1) 로 채운다. 벽은 `map.lowerTiles[y * map.width + x] = TILE.WALL` 로 심는다.

```ts
// test/collisionFootprint.test.ts
// 발자국 지형 통행 판정 — 선행 모서리만 검사한다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3.

import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { canMove, canMoveFootprint } from "@/project/collision";
import { UNIT_FOOTPRINT } from "@/project/footprint";
import type { GameMap, Project } from "@/project/types";

const WIDE = 20;
const TALL = 15;

function scene(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("발자국 시험장", WIDE, TALL, project.maps[project.startMapId].tilesetId);
  project.maps[map.id] = map;
  return { project, map };
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
}

describe("canMoveFootprint(1x1) 은 canMove 와 완전히 같다", () => {
  it("벽이 흩어진 맵에서 모든 칸 · 4방향이 일치한다", () => {
    const { project, map } = scene();
    for (const [x, y] of [[3, 3], [4, 7], [10, 2], [11, 11], [17, 8]]) setLower(map, x, y, TILE.WALL);
    for (const [x, y] of [[6, 6], [12, 4]]) setLower(map, x, y, TILE.WATER);

    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let compared = 0;
    for (let y = 0; y < TALL; y += 1) {
      for (let x = 0; x < WIDE; x += 1) {
        for (const [dx, dy] of deltas) {
          const expected = canMove(project, map, x, y, x + dx, y + dy);
          const actual = canMoveFootprint(project, map, x, y, UNIT_FOOTPRINT, x + dx, y + dy);
          expect(actual, `(${x},${y}) → (${x + dx},${y + dy})`).toBe(expected);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(WIDE * TALL * 4);
  });
});

describe("선행 모서리 검사", () => {
  it("3x3 은 1x1 이 안 닿는 벽에 막힌다", () => {
    const { project, map } = scene();
    // (5,5) 에 선 3x3 의 발자국은 x 4..6, y 3..5.
    // 오른쪽 한 칸 이동의 선행 모서리는 x=6 열(y 3..5)이고 목적 칸은 x=7 열이다.
    setLower(map, 7, 3, TILE.WALL);

    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 5)).toBe(true);
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 6, 5)).toBe(false);
  });

  it("선행 모서리가 아닌 칸의 벽은 이동을 막지 않는다", () => {
    const { project, map } = scene();
    // 왼쪽으로 갈 때 x=7 열(오른쪽 끝 바깥)은 선행 모서리가 아니다.
    setLower(map, 7, 3, TILE.WALL);
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 4, 5)).toBe(true);
  });

  it("세로 이동은 위·아래 행이 선행 모서리다", () => {
    const { project, map } = scene();
    // (5,5) 3x3 → 위로: 선행 모서리는 top 행 y=3, 목적은 y=2.
    setLower(map, 4, 2, TILE.WALL);
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 5, 4)).toBe(false);
    // 아래로: 선행 모서리는 bottom 행 y=5, 목적은 y=6. 위쪽 벽은 무관하다.
    expect(canMoveFootprint(project, map, 5, 5, { width: 3, height: 3 }, 5, 6)).toBe(true);
  });
});

describe("좁은 통로", () => {
  it("3칸 높이는 2칸 통로에 못 들어가고 1칸 높이는 들어간다", () => {
    const { project, map } = scene();
    // y=3 과 y=6 을 x=8..14 구간에서 막아 y=4,5 두 칸짜리 통로를 만든다.
    for (let x = 8; x <= 14; x += 1) {
      setLower(map, x, 3, TILE.WALL);
      setLower(map, x, 6, TILE.WALL);
    }
    // 3x3 이 (6,5) 에 서 있다 — 발자국 x 5..7, y 3..5 는 전부 통로 밖이라 유효한 출발이다.
    expect(canMoveFootprint(project, map, 6, 5, { width: 3, height: 3 }, 7, 5)).toBe(false);
    // 1x1 은 통로로 들어간다.
    expect(canMoveFootprint(project, map, 7, 5, UNIT_FOOTPRINT, 8, 5)).toBe(true);
  });
});

describe("경계 조건", () => {
  it("같은 칸으로의 이동은 false 다", () => {
    const { project, map } = scene();
    expect(canMoveFootprint(project, map, 5, 5, { width: 2, height: 2 }, 5, 5)).toBe(false);
  });

  it("발자국이 맵 밖으로 나가면 막힌다", () => {
    const { project, map } = scene();
    // (0,5) 에 선 3x3 의 left 는 -1 이라 왼쪽 이동은 경계를 벗어난다.
    expect(canMoveFootprint(project, map, 0, 5, { width: 3, height: 3 }, -1, 5)).toBe(false);
  });

  it("대각은 H·V 중 한 경로만 열려도 통과한다", () => {
    const { project, map } = scene();
    setLower(map, 6, 5, TILE.WALL); // 가로 먼저 가는 경로를 막는다
    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 6)).toBe(true);
    setLower(map, 5, 6, TILE.WALL); // 세로 먼저 가는 경로도 막는다
    expect(canMoveFootprint(project, map, 5, 5, UNIT_FOOTPRINT, 6, 6)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/collisionFootprint.test.ts`

Expected: FAIL — `canMoveFootprint is not exported` / `is not a function`

- [ ] **Step 3: 구현한다**

`src/project/collision.ts` 파일 끝에 추가한다. 상단 import 에 다음을 더한다:

```ts
import { footprintBounds } from "./footprint";
import type { CharacterFootprint } from "./types";
```

(`./types` 는 이미 import 중이므로 `CharacterFootprint` 를 기존 import 목록에 끼워 넣는다.)

```ts
/**
 * 발자국 전체가 통과 가능한가. 이동 방향의 **선행 모서리**만 검사한다 —
 * 3x3 이 오른쪽으로 갈 때 새로 밟는 건 오른쪽 열 3칸뿐이고 9칸 전부가 아니다.
 *
 * 1x1 이면 정확히 canMove 1회 호출로 환원된다(= 기존 동작 동일).
 * canMove 와 같이 **인접 한 칸 이동**을 전제한다.
 */
export function canMoveFootprint(
  project: Project,
  map: GameMap,
  fromX: number,
  fromY: number,
  fp: CharacterFootprint,
  toX: number,
  toY: number
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return false;
  if (dx !== 0 && dy !== 0) {
    // 기존 대각 관례(playSceneMovement.ts / playSceneAutonomousMapActions.ts):
    // H·V 로 분해해 둘 중 한 경로가 열려 있으면 통과한다.
    const horizontalFirst =
      canMoveFootprint(project, map, fromX, fromY, fp, fromX + dx, fromY) &&
      canMoveFootprint(project, map, fromX + dx, fromY, fp, toX, toY);
    if (horizontalFirst) return true;
    return (
      canMoveFootprint(project, map, fromX, fromY, fp, fromX, fromY + dy) &&
      canMoveFootprint(project, map, fromX, fromY + dy, fp, toX, toY)
    );
  }
  for (const cell of leadingEdgeCells(fromX, fromY, fp, dx, dy)) {
    if (!canMove(project, map, cell.x, cell.y, cell.x + dx, cell.y + dy)) return false;
  }
  return true;
}

/** 이동 방향에서 새로 칸을 밟게 되는 발자국 모서리 셀들. */
function leadingEdgeCells(
  x: number,
  y: number,
  fp: CharacterFootprint,
  dx: number,
  dy: number
): { x: number; y: number }[] {
  const rect = footprintBounds(x, y, fp);
  const cells: { x: number; y: number }[] = [];
  if (dx !== 0) {
    const column = dx > 0 ? rect.right : rect.left;
    for (let cy = rect.top; cy <= rect.bottom; cy += 1) cells.push({ x: column, y: cy });
    return cells;
  }
  const row = dy > 0 ? rect.bottom : rect.top;
  for (let cx = rect.left; cx <= rect.right; cx += 1) cells.push({ x: cx, y: row });
  return cells;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/collisionFootprint.test.ts`

Expected: PASS (전부)

- [ ] **Step 5: 기존 충돌 테스트가 안 깨졌는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/collision.test.ts`

Expected: PASS 19개 — 이 태스크는 기존 함수를 건드리지 않았으므로 하나도 바뀌면 안 된다.

- [ ] **Step 6: 커밋**

```bash
git add src/project/collision.ts test/collisionFootprint.test.ts
git commit -m "feat(collision): 발자국 전체의 통행 판정을 선행 모서리로 좁힌다

canMoveFootprint 는 이동 방향에서 새로 밟는 모서리 셀만 본다. 3x3 이
오른쪽으로 가면 오른쪽 열 3칸이지 9칸이 아니다. 각 셀은 기존 canMove 를
그대로 호출하므로 방향별 통과 비트 규약이 한 곳에만 남는다.

1x1 이면 선행 모서리가 정확히 한 칸이라 canMove 1회 호출로 환원된다.
테스트가 20x15 전 칸 x 4방향 1200 조합에서 두 함수 결과가 같은지 전수
비교해 이 환원을 고정한다.

대각은 기존 관례(H·V 분해 후 하나만 열려도 통과)를 그대로 재귀로 표현했다.
분해 후 호출은 전부 직교라 재귀가 끝난다."
```

---

### Task 3: 이벤트 데이터 모델

`EventPage.footprint` / `EventPageGraphic.scale` 를 추가하고 런타임 뷰가 해석하게 한다.

**Files:**
- Modify: `src/project/types/events.ts:413` (`EventPageGraphic`), `:467` (`EventPage`)
- Modify: `src/project/runtimeEventState.ts:30` (`RuntimeEventView`), `:75` (`runtimeEventView`)
- Test: `test/runtimeEventFootprint.test.ts`

**Interfaces:**
- Consumes: `normalizeCharacterFootprint`, `normalizeCharacterScale`, `UNIT_FOOTPRINT` (`@/project/footprint`)
- Produces:
  - `EventPage.footprint?: CharacterFootprint`
  - `EventPageGraphic.scale?: number`
  - `RuntimeEventView.footprint: CharacterFootprint` (항상 존재, 기본 1x1)
  - `RuntimeEventView.scale: number` (항상 존재, 기본 1)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/runtimeEventFootprint.test.ts` 를 새로 만든다. `test/runtimeEventState.test.ts` 의 헬퍼 관례를 따른다.

```ts
// test/runtimeEventFootprint.test.ts
// 이벤트 발자국의 런타임 해석 — 페이지에서 읽어 RuntimeEventView 로 노출한다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §2.

import { describe, expect, it } from "vitest";
import { UNIT_FOOTPRINT } from "@/project/footprint";
import { initialRuntimeEventPositions, runtimeEventView } from "@/project/runtimeEventState";
import type { EventPage, GameEvent } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "page1",
    name: "page1",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...overrides,
  };
}

function event(pages: EventPage[]): GameEvent {
  return { id: "ev1", x: 5, y: 7, trigger: { kind: "action" }, commands: [], pages };
}

function session(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map_runtime",
    x: 0,
    y: 0,
  };
}

function viewOf(pages: EventPage[]) {
  const target = event(pages);
  return runtimeEventView(target, session(), initialRuntimeEventPositions([target]));
}

describe("RuntimeEventView.footprint", () => {
  it("발자국이 없는 페이지는 1x1 이다", () => {
    expect(viewOf([page()]).footprint).toEqual(UNIT_FOOTPRINT);
  });

  it("페이지가 지정한 발자국을 노출한다", () => {
    expect(viewOf([page({ footprint: { width: 2, height: 2 } })]).footprint).toEqual({ width: 2, height: 2 });
  });

  it("쓰레기 값은 1x1 로 정규화된다", () => {
    const broken = page({ footprint: { width: 0, height: 999 } as never });
    expect(viewOf([broken]).footprint).toEqual({ width: 1, height: 8 });
  });

  it("페이지가 아예 없는 레거시 이벤트도 1x1 이다", () => {
    const legacy: GameEvent = { id: "ev0", x: 1, y: 1, trigger: { kind: "action" }, commands: [] };
    const view = runtimeEventView(legacy, session(), initialRuntimeEventPositions([legacy]));
    expect(view.footprint).toEqual(UNIT_FOOTPRINT);
  });
});

describe("RuntimeEventView.scale", () => {
  it("배율이 없으면 1 이다", () => {
    expect(viewOf([page()]).scale).toBe(1);
  });

  it("그래픽 배율을 노출한다", () => {
    expect(viewOf([page({ graphic: { scale: 2 } })]).scale).toBe(2);
  });

  it("배율과 발자국은 독립이다 — 한쪽만 줘도 다른 쪽은 기본값이다", () => {
    const view = viewOf([page({ graphic: { scale: 3 } })]);
    expect(view.scale).toBe(3);
    expect(view.footprint).toEqual(UNIT_FOOTPRINT);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts`

Expected: FAIL — `footprint` 가 `EventPage` 타입에 없어 타입 오류, 그리고 `view.footprint` 가 `undefined`

- [ ] **Step 3: 타입을 추가한다**

`src/project/types/events.ts` 의 `EventPageGraphic`(413행):

```ts
export interface EventPageGraphic {
  sprite?: AssetRef;
  direction?: Dir;
  pattern?: number;
  transparent?: boolean;
  /**
   * 스프라이트 렌더 배율. 충돌 발자국과 **독립**이다 —
   * "그림은 3배인데 발자국은 2x2" 같은 연출을 허용한다. 생략 시 1.
   */
  scale?: number;
}
```

`EventPage`(467행)에 필드를 더한다. 상단 import 목록에 `CharacterFootprint` 를 추가한다(`./base` 에서).

```ts
export interface EventPage {
  id: string;
  name: string;
  conditions: EventPageCondition[];
  graphic: EventPageGraphic;
  trigger: Trigger;
  priority: EventPriority;
  overlapForbidden?: boolean;
  animationType?: EventAnimationType;
  /**
   * 충돌 발자국(타일). (x,y) 는 발자국 **하단 행**의 칸이고 짝수 폭은 왼쪽 치우침.
   * 생략 시 1x1 — 기존 이벤트는 좌표가 그대로다.
   * 페이지 단위인 이유: 알 → 드래곤처럼 페이지 전환으로 크기가 바뀌는 연출을 허용한다.
   */
  footprint?: CharacterFootprint;
  movement: EventPageMovement;
  commands: Command[];
}
```

- [ ] **Step 4: 런타임 뷰가 해석하게 한다**

`src/project/runtimeEventState.ts` 상단 import 에 추가:

```ts
import { normalizeCharacterFootprint, normalizeCharacterScale } from "@/project/footprint";
```

그리고 `CharacterFootprint` 를 기존 `@/project/types` 타입 import 목록에 추가한다.

`RuntimeEventView` 인터페이스(30행)에 두 필드를 더한다:

```ts
export interface RuntimeEventView {
  readonly event: GameEvent;
  readonly page: EventPage | undefined;
  readonly pageId: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly trigger: Trigger;
  readonly priority: EventPriority;
  readonly overlapForbidden: boolean;
  /** 충돌 발자국. 생략된 페이지는 1x1 로 정규화돼 언제나 존재한다. */
  readonly footprint: CharacterFootprint;
  /** 스프라이트 렌더 배율. 생략 시 1. 발자국과 독립. */
  readonly scale: number;
  readonly transparent: boolean;
  readonly animationType: EventAnimationType;
  readonly movement: EventPageMovement;
  readonly sprite: AssetRef | undefined;
  readonly direction: Dir | undefined;
  readonly runtimeDirection: Dir | undefined;
}
```

`runtimeEventView()`(75행)의 반환 객체에서 `overlapForbidden` 줄 바로 아래에 두 줄을 넣는다:

```ts
    overlapForbidden: page?.overlapForbidden ?? true,
    footprint: normalizeCharacterFootprint(page?.footprint),
    scale: normalizeCharacterScale(page?.graphic.scale),
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts`

Expected: PASS (전부)

- [ ] **Step 6: 기존 런타임 이벤트 테스트가 안 깨졌는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventState.test.ts test/runtimeEventPageGraphics.test.ts test/runtimeEventPageMovement.test.ts test/runtimeEventTouchPlayerCollision.test.ts`

Expected: PASS 전부 — 새 필드는 전부 optional 이고 기본값이 기존 동작과 같다.

- [ ] **Step 7: 타입 검사**

Run: `npm run typecheck:app`

Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/project/types/events.ts src/project/runtimeEventState.ts test/runtimeEventFootprint.test.ts
git commit -m "feat(event): 페이지에 발자국과 렌더 배율을 싣는다

EventPage.footprint 와 EventPageGraphic.scale 을 더하고 RuntimeEventView 가
정규화해 노출한다. 둘 다 optional 이고 기본값이 1x1 / 1배라 기존 이벤트의
런타임 해석 결과가 바뀌지 않는다.

발자국을 GameEvent 루트가 아니라 페이지에 둔 이유: RM 관례상 페이지마다
그래픽이 바뀐다. 알에서 드래곤이 되는 연출을 하려면 크기도 같이 바뀌어야
한다. 페이지 없는 레거시 이벤트는 1x1 로 떨어진다.

배율과 발자국은 독립 필드다. 그림은 3배인데 발자국은 2x2 같은 조합이
의도적으로 가능하다 — 큰 생물의 머리가 발자국 위로 삐져나오는 게
RM 계열의 정상 외형이다."
```

---

### Task 4: 사각 질의 승격

이벤트 히트테스트를 점 비교에서 발자국 사각 겹침으로 바꾼다. 기존 시그니처는 래퍼로 남긴다.

**Files:**
- Modify: `src/project/runtimeEventState.ts:186-246`
- Modify: `src/player/playSceneAutonomousMapActions.ts:64-79`
- Test: `test/runtimeEventFootprint.test.ts` (Task 3 에서 만든 파일에 describe 블록 추가)

점 비교 지점은 **5개**다 — `runtimeEventState.ts` 안에 4개(`findRuntimeEventAt` 197행, `findRuntimeEventAtInMap` 210행, `findBlockingRuntimeEventAt` 223행, `findBlockingRuntimeEventAtInMap` 235행), 그리고 `playSceneAutonomousMapActions.ts:73` 의 사설 `.some()` 루프 1개.

배열 형태 2개(`findRuntimeEventAt`, `findBlockingRuntimeEventAt`)는 `map` 을 안 받아 `runtimeEventViewsForMap` 을 못 쓴다. 사각 질의 원본에 위임할 수 없으므로 자기 `.find` 조건만 바꾼다. `eventBlocksPlayerAt`(238행)은 자체 비교 없이 위임만 하므로 수정 대상이 아니다.

**Interfaces:**
- Consumes: `RuntimeEventView.footprint` (Task 3), `footprintBounds`, `pointRect`, `rectsOverlap`, `footprintContains` (`@/project/footprint`), `FootprintRect` (`@/project/types`)
- Produces:
  - `findEventOverlappingRect(project: Pick<Project, "maps">, map: GameMap, session: PlaySessionLike, positions: RuntimeEventPositions, rect: FootprintRect, triggerKind: Trigger["kind"] | readonly Trigger["kind"][]): RuntimeEventView | undefined` — `triggerKind` 는 **필수**다
  - `findBlockingEventOverlappingRect(project: Pick<Project, "maps">, map: GameMap, session: PlaySessionLike, positions: RuntimeEventPositions, rect: FootprintRect): RuntimeEventView | undefined`
  - 기존 5개 함수는 시그니처가 그대로다: `findRuntimeEventAt`, `findRuntimeEventAtInMap`, `findBlockingRuntimeEventAt`, `findBlockingRuntimeEventAtInMap`, `eventBlocksPlayerAt`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/runtimeEventFootprint.test.ts` 끝에 붙인다. 상단 import 를 다음으로 확장한다:

```ts
import { UNIT_FOOTPRINT, pointRect } from "@/project/footprint";
import {
  findBlockingEventOverlappingRect,
  findBlockingRuntimeEventAt,
  findBlockingRuntimeEventAtInMap,
  findEventOverlappingRect,
  findRuntimeEventAt,
  findRuntimeEventAtInMap,
  initialRuntimeEventPositions,
  runtimeEventView,
} from "@/project/runtimeEventState";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
```

추가할 블록:

```ts
function mapWithEvent(target: GameEvent): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("발자국 맵", 20, 15, project.maps[project.startMapId].tilesetId);
  map.events = [target];
  project.maps[map.id] = map;
  return { project, map };
}

function bigEvent(footprint: { width: number; height: number }): GameEvent {
  return {
    id: "ev_big",
    x: 5,
    y: 7,
    trigger: { kind: "action" },
    commands: [],
    pages: [page({ footprint, priority: "same", overlapForbidden: true })],
  };
}

describe("사각 질의 승격 — 2x2 이벤트", () => {
  // (5,7) 에 선 2x2 의 발자국은 (5,6) (6,6) (5,7) (6,7).
  const OCCUPIED = [[5, 6], [6, 6], [5, 7], [6, 7]] as const;
  const FREE = [[4, 7], [7, 7], [5, 5], [5, 8]] as const;

  it("발자국 네 칸 어디에서 조사해도 같은 이벤트를 찾는다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (const [x, y] of OCCUPIED) {
      const found = findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action");
      expect(found?.event.id, `(${x},${y})`).toBe("ev_big");
    }
  });

  it("발자국 밖에서는 찾지 못한다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (const [x, y] of FREE) {
      expect(findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action"), `(${x},${y})`).toBeUndefined();
    }
  });

  it("발자국 네 칸 전부가 통행을 막는다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (const [x, y] of OCCUPIED) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `(${x},${y})`).toBeDefined();
    }
    for (const [x, y] of FREE) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `(${x},${y})`).toBeUndefined();
    }
  });
});

describe("사각 질의 원본", () => {
  it("겹치는 사각으로 질의하면 찾는다 — 커진 플레이어 경로", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    // 이벤트 발자국은 x 5..6 / y 6..7. 아래 사각은 x 6..8 / y 7..9 라 (6,7) 에서 겹친다.
    const overlapping = { left: 6, right: 8, top: 7, bottom: 9 };
    expect(findEventOverlappingRect(project, map, session(), positions, overlapping, "action")?.event.id).toBe("ev_big");
    expect(findBlockingEventOverlappingRect(project, map, session(), positions, overlapping)?.event.id).toBe("ev_big");
  });

  it("닿지 않는 사각은 못 찾는다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    const apart = { left: 7, right: 9, top: 8, bottom: 10 };
    expect(findEventOverlappingRect(project, map, session(), positions, apart, "action")).toBeUndefined();
  });

  it("점 질의는 1x1 사각 질의와 같은 답을 준다", () => {
    const target = bigEvent({ width: 3, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (let y = 4; y <= 10; y += 1) {
      for (let x = 2; x <= 9; x += 1) {
        const viaPoint = findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action");
        const viaRect = findEventOverlappingRect(project, map, session(), positions, pointRect(x, y), "action");
        expect(viaRect?.event.id, `(${x},${y})`).toBe(viaPoint?.event.id);
      }
    }
  });
});

describe("배열 형태 finder 도 발자국을 본다", () => {
  it("findRuntimeEventAt / findBlockingRuntimeEventAt 이 2x2 네 칸에서 잡힌다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const positions = initialRuntimeEventPositions([target]);
    for (const [x, y] of [[5, 6], [6, 6], [5, 7], [6, 7]]) {
      expect(findRuntimeEventAt([target], session(), positions, x, y, "action")?.event.id, `조사 (${x},${y})`).toBe("ev_big");
      expect(findBlockingRuntimeEventAt([target], session(), positions, x, y), `막힘 (${x},${y})`).toBeDefined();
    }
    for (const [x, y] of [[4, 7], [7, 7], [5, 5], [5, 8]]) {
      expect(findRuntimeEventAt([target], session(), positions, x, y, "action"), `조사 (${x},${y})`).toBeUndefined();
      expect(findBlockingRuntimeEventAt([target], session(), positions, x, y), `막힘 (${x},${y})`).toBeUndefined();
    }
  });
});

describe("1x1 이벤트는 승격 후에도 한 칸만 차지한다", () => {
  it("자기 칸에서만 잡히고 이웃 칸에서는 안 잡힌다", () => {
    const target: GameEvent = {
      id: "ev_small",
      x: 5,
      y: 7,
      trigger: { kind: "action" },
      commands: [],
      pages: [page({ priority: "same", overlapForbidden: true })],
    };
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    expect(findRuntimeEventAtInMap(project, map, session(), positions, 5, 7, "action")?.event.id).toBe("ev_small");
    for (const [x, y] of [[4, 7], [6, 7], [5, 6], [5, 8]]) {
      expect(findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action"), `(${x},${y})`).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts`

Expected: FAIL — `findEventOverlappingRect` 미export, 그리고 2x2 관련 단언이 발자국 한 칸에서만 통과

- [ ] **Step 3: `runtimeEventState.ts` 의 히트테스트 4개를 승격한다**

상단 import 에 추가:

```ts
import { footprintBounds, pointRect, rectsOverlap } from "@/project/footprint";
```

그리고 `FootprintRect` 를 `@/project/types` 타입 import 목록에 추가한다.

**186–246행** 구간을 다음으로 교체한다(`findRuntimeEventAt` 부터다 — 200행부터 자르면 배열 형태 하나가 점 비교인 채로 남는다).

```ts
/** 뷰의 발자국 사각. 1x1 이면 그 칸 자신이다. */
function viewRect(view: RuntimeEventView): FootprintRect {
  return footprintBounds(view.x, view.y, view.footprint);
}

/**
 * 사각과 겹치는 이벤트를 찾는다 — 이 파일의 히트테스트 원본.
 * 점 질의(findRuntimeEventAtInMap 등)는 전부 여기에 1x1 사각으로 위임한다.
 */
export function findEventOverlappingRect(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  rect: FootprintRect,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  return runtimeEventViewsForMap(project, map, session, positions)
    .find((event) => rectsOverlap(viewRect(event), rect) && matchesTrigger(event.trigger.kind, triggerKind));
}

/**
 * 이벤트 배열 형태. map 을 안 받아 runtimeEventViewsForMap 을 못 쓰므로
 * 사각 질의 원본에 위임하지 못하고 자기 .find 조건만 발자국으로 바꾼다.
 */
export function findRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  const rect = pointRect(x, y);
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => rectsOverlap(viewRect(event), rect) && matchesTrigger(event.trigger.kind, triggerKind));
}

/** 사각과 겹치면서 통행을 막는 이벤트. */
export function findBlockingEventOverlappingRect(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  rect: FootprintRect
): RuntimeEventView | undefined {
  return runtimeEventViewsForMap(project, map, session, positions)
    .find((event) => rectsOverlap(viewRect(event), rect) && event.priority === "same" && event.overlapForbidden);
}

export function findRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  triggerKind: Trigger["kind"] | readonly Trigger["kind"][]
): RuntimeEventView | undefined {
  return findEventOverlappingRect(project, map, session, positions, pointRect(x, y), triggerKind);
}

export function findBlockingRuntimeEventAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  const rect = pointRect(x, y);
  return events
    .filter((event) => !(session.erasedEventIds ?? []).includes(event.id))
    .map((event) => runtimeEventView(event, session, positions))
    .find((event) => rectsOverlap(viewRect(event), rect) && event.priority === "same" && event.overlapForbidden);
}

export function findBlockingRuntimeEventAtInMap(
  project: Pick<Project, "maps">,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return findBlockingEventOverlappingRect(project, map, session, positions, pointRect(x, y));
}

export function eventBlocksPlayerAt(
  events: readonly GameEvent[],
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number
): boolean {
  return findBlockingRuntimeEventAt(events, session, positions, x, y) !== undefined;
}
```

`matchesTrigger` 는 파일 하단에 그대로 있으므로 건드리지 않는다.

- [ ] **Step 4: NPC 자율이동의 사설 루프를 고친다**

`src/player/playSceneAutonomousMapActions.ts` 의 `isCharacterBlockedTile`(64행). 이건 `runtimeEventState` 의 공개 함수가 아니라 별도 `.some()` 루프라 래퍼가 안 먹는다 — 직접 고친다.

상단 import 에 추가:

```ts
import { footprintContains } from "@/project/footprint";
```

64–79행을 교체한다:

```ts
function isCharacterBlockedTile(request: NpcMoveCollision, x: number, y: number): boolean {
  if (isPlayerOccupyingTile(request.scene, x, y)) return true;
  return runtimeEventViewsForMap(
    request.project,
    request.scene.map,
    request.scene.session,
    request.scene.eventPositions
  ).some(
    (view) =>
      footprintContains(view.x, view.y, view.footprint, x, y) &&
      view.event.id !== request.eventId &&
      view.priority === "same" &&
      view.overlapForbidden
  );
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts`

Expected: PASS (전부)

- [ ] **Step 6: 기존 스위트가 안 깨졌는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventState.test.ts test/runtimeEventTouchPlayerCollision.test.ts test/collision.test.ts test/collisionFootprint.test.ts`

Expected: PASS 전부. 이 구간이 이 계획에서 회귀 위험이 가장 큰 지점이다 — 여기서 깨지면 발자국 기본값이 1x1 로 안 떨어지고 있다는 뜻이다.

- [ ] **Step 7: 전체 스위트로 회귀를 확인한다**

Run: `npm test 2>&1 | tail -30`

Expected: 이 브랜치의 기준선과 **실패 집합이 같아야 한다**. 이 저장소는 공유 머신이라 실패 개수만으로 판정하지 말고, 새로 생긴 실패 파일이 있는지 이름으로 비교한다. 새 실패가 있으면 그것만 고친다.

- [ ] **Step 8: 커밋**

```bash
git add src/project/runtimeEventState.ts src/player/playSceneAutonomousMapActions.ts test/runtimeEventFootprint.test.ts
git commit -m "feat(runtime): 이벤트 히트테스트를 점 비교에서 발자국 사각 겹침으로 올린다

x===x && y===y 로는 커진 주체를 표현할 수 없다. 질문이 '점이 이벤트 안인가'
에서 '내 사각이 이벤트 사각과 겹치는가' 로 바뀌기 때문이다.

점 비교 지점은 다섯 곳이었다. 맵 형태 둘(findRuntimeEventAtInMap,
findBlockingRuntimeEventAtInMap)은 findEventOverlappingRect /
findBlockingEventOverlappingRect 를 원본으로 두고 pointRect 로 위임하는 래퍼가
됐다. 덕분에 호출부 30여 곳을 건드리지 않았다.

나머지 셋은 위임이 안 돼 직접 고쳤다. 배열 형태 둘(findRuntimeEventAt,
findBlockingRuntimeEventAt)은 map 을 안 받아 runtimeEventViewsForMap 을 못
쓴다. isCharacterBlockedTile 은 runtimeEventState 의 공개 함수가 아니라
playSceneAutonomousMapActions 안의 사설 .some() 루프다.

1x1 발자국의 사각은 그 칸 자신이므로 기존 이벤트의 판정 결과는 그대로다.
테스트가 점 질의와 1x1 사각 질의를 56개 좌표에서 전수 비교해 이를 고정한다."
```

---

### Task 5: 워프 착지 해소 (순수 함수)

`resolveFootprintLanding` 을 만든다. **이 태스크에서는 배선하지 않는다** — 순수 함수와 테스트만 만들고, 실제 transfer 경로 연결은 2차 계획이다.

**Files:**
- Create: `src/project/footprintLanding.ts`
- Test: `test/footprintLanding.test.ts`

**Interfaces:**
- Consumes: `footprintCells`, `UNIT_FOOTPRINT` (`@/project/footprint`), `inBounds`, `isPassable` (`@/project/collision`), `findBlockingEventOverlappingRect` (Task 4), `footprintBounds`
- Produces: `resolveFootprintLanding(project, map, session, positions, x, y, fp, maxRadius?): { readonly x: number; readonly y: number }` — `@/project/footprintLanding`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`test/footprintLanding.test.ts` 를 새로 만든다.

```ts
// test/footprintLanding.test.ts
// 워프 착지 해소 — 발자국이 안 맞으면 체비쇼프 나선으로 밀어낸다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3 워프 착지.

import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { UNIT_FOOTPRINT, footprintCells } from "@/project/footprint";
import { resolveFootprintLanding } from "@/project/footprintLanding";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function session(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map_runtime",
    x: 0,
    y: 0,
  };
}

function scene(events: GameEvent[] = []): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("착지 시험장", 20, 15, project.maps[project.startMapId].tilesetId);
  map.events = events;
  project.maps[map.id] = map;
  return { project, map };
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
}

function land(project: Project, map: GameMap, events: GameEvent[], x: number, y: number, fp: { width: number; height: number }, maxRadius?: number) {
  return resolveFootprintLanding(project, map, session(), initialRuntimeEventPositions(events), x, y, fp, maxRadius);
}

describe("1x1 은 검사 없이 그대로 착지한다", () => {
  it("통행 불가 칸으로도 워프한다 — 컷신 배치를 깨지 않기 위한 기존 동작 보존", () => {
    const { project, map } = scene();
    setLower(map, 5, 5, TILE.WALL);
    expect(isPassable(project, map, 5, 5)).toBe(false);
    expect(land(project, map, [], 5, 5, UNIT_FOOTPRINT)).toEqual({ x: 5, y: 5 });
  });

  it("맵 밖으로도 그대로 준다 — 판정 자체를 하지 않는다", () => {
    const { project, map } = scene();
    expect(land(project, map, [], -3, -3, UNIT_FOOTPRINT)).toEqual({ x: -3, y: -3 });
  });
});

describe("다중 타일 착지", () => {
  it("자리가 있으면 지정 좌표 그대로다", () => {
    const { project, map } = scene();
    expect(land(project, map, [], 8, 8, { width: 2, height: 2 })).toEqual({ x: 8, y: 8 });
  });

  it("벽에 걸리면 가까운 유효 칸으로 밀린다", () => {
    const { project, map } = scene();
    // (8,8) 2x2 의 발자국은 (8,7) (9,7) (8,8) (9,8). 그 중 하나를 막는다.
    setLower(map, 9, 7, TILE.WALL);
    const landed = land(project, map, [], 8, 8, { width: 2, height: 2 });
    expect(landed).not.toEqual({ x: 8, y: 8 });
    for (const cell of footprintCells(landed.x, landed.y, { width: 2, height: 2 })) {
      expect(isPassable(project, map, cell.x, cell.y), `(${cell.x},${cell.y})`).toBe(true);
    }
    expect(Math.max(Math.abs(landed.x - 8), Math.abs(landed.y - 8))).toBe(1);
  });

  it("맵 경계를 넘으면 안쪽으로 밀린다", () => {
    const { project, map } = scene();
    // (0,0) 3x3 의 발자국은 x -1..1 / y -2..0 이라 경계를 벗어난다.
    const landed = land(project, map, [], 0, 0, { width: 3, height: 3 });
    for (const cell of footprintCells(landed.x, landed.y, { width: 3, height: 3 })) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("차단 이벤트 위에는 착지하지 않는다", () => {
    const blocker: GameEvent = {
      id: "ev_block",
      x: 8,
      y: 8,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p1", name: "p1", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
      }],
    };
    const { project, map } = scene([blocker]);
    const landed = land(project, map, [blocker], 8, 8, { width: 2, height: 2 });
    expect(landed).not.toEqual({ x: 8, y: 8 });
  });

  it("반경 안에 자리가 없으면 지정 좌표로 폴백한다 — 게임을 죽이지 않는다", () => {
    const { project, map } = scene();
    // 넓게 벽으로 덮어 반경 2 안에 3x3 이 들어갈 자리를 없앤다.
    for (let y = 0; y < 15; y += 1) {
      for (let x = 0; x < 20; x += 1) setLower(map, x, y, TILE.WALL);
    }
    expect(land(project, map, [], 8, 8, { width: 3, height: 3 }, 2)).toEqual({ x: 8, y: 8 });
  });

  it("탐색은 결정적이다 — 같은 입력이면 같은 칸이 나온다", () => {
    const { project, map } = scene();
    setLower(map, 9, 7, TILE.WALL);
    const first = land(project, map, [], 8, 8, { width: 2, height: 2 });
    const second = land(project, map, [], 8, 8, { width: 2, height: 2 });
    expect(second).toEqual(first);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/footprintLanding.test.ts`

Expected: FAIL — `Failed to resolve import "@/project/footprintLanding"`

- [ ] **Step 3: 구현한다**

`src/project/footprintLanding.ts` 를 새로 만든다. `footprint.ts` 를 순수·무의존으로 유지하려고 별도 파일에 둔다(이 함수는 `collision` 과 `runtimeEventState` 를 둘 다 필요로 한다).

```ts
// project/footprintLanding.ts
// 워프 착지 해소 — 발자국이 안 맞는 목적지를 가까운 유효 칸으로 밀어낸다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3.
//
// footprint.ts 에 두지 않은 이유: 이 함수는 collision 과 runtimeEventState 를
// 둘 다 필요로 한다. footprint.ts 는 의존성 없는 순수 프리미티브로 남긴다.

import { inBounds, isPassable } from "./collision";
import { footprintBounds, footprintCells } from "./footprint";
import { findBlockingEventOverlappingRect, type RuntimeEventPositions } from "./runtimeEventState";
import type { CharacterFootprint, GameMap, Project } from "./types";
import type { PlaySessionLike } from "./sessionRuntimeTypes";

export type LandingPoint = { readonly x: number; readonly y: number };

/**
 * 발자국이 들어갈 착지 지점을 정한다.
 *
 * 1x1 은 **검사하지 않고 그대로 준다.** 기존 transfer 는 통행 불가 칸에도 강제
 * 착지하고(컷신 배치 등에 실제로 쓰인다) 여기에 검사를 걸면 기존 게임이 깨진다.
 *
 * 다중 타일은 지정 좌표를 먼저 보고, 안 맞으면 체비쇼프 거리 순으로 나선 탐색한다.
 * 반경 안에 자리가 없으면 지정 좌표를 그대로 준다 — 게임을 죽이지 않는다.
 */
export function resolveFootprintLanding(
  project: Project,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  footprint: CharacterFootprint,
  maxRadius = 8
): LandingPoint {
  if (footprint.width === 1 && footprint.height === 1) return { x, y };
  if (footprintFits(project, map, session, positions, x, y, footprint)) return { x, y };
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (const candidate of ringCells(x, y, radius)) {
      if (footprintFits(project, map, session, positions, candidate.x, candidate.y, footprint)) return candidate;
    }
  }
  return { x, y };
}

function footprintFits(
  project: Project,
  map: GameMap,
  session: PlaySessionLike,
  positions: RuntimeEventPositions,
  x: number,
  y: number,
  footprint: CharacterFootprint
): boolean {
  for (const cell of footprintCells(x, y, footprint)) {
    if (!inBounds(map, cell.x, cell.y)) return false;
    if (!isPassable(project, map, cell.x, cell.y)) return false;
  }
  const rect = footprintBounds(x, y, footprint);
  return findBlockingEventOverlappingRect(project, map, session, positions, rect) === undefined;
}

/**
 * 체비쇼프 거리가 정확히 radius 인 칸들. 순서가 결정적이어야 같은 입력에
 * 같은 착지점이 나온다 — 위 행(좌→우), 아래 행(좌→우), 왼쪽 열, 오른쪽 열.
 */
function ringCells(cx: number, cy: number, radius: number): LandingPoint[] {
  const cells: LandingPoint[] = [];
  for (let x = cx - radius; x <= cx + radius; x += 1) {
    cells.push({ x, y: cy - radius });
    cells.push({ x, y: cy + radius });
  }
  for (let y = cy - radius + 1; y <= cy + radius - 1; y += 1) {
    cells.push({ x: cx - radius, y });
    cells.push({ x: cx + radius, y });
  }
  return cells;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/footprintLanding.test.ts`

Expected: PASS (전부)

- [ ] **Step 5: 타입 검사**

Run: `npm run typecheck:app`

Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/project/footprintLanding.ts test/footprintLanding.test.ts
git commit -m "feat(footprint): 발자국이 안 맞는 워프 목적지를 가까운 칸으로 밀어낸다

3x3 보스를 벽 옆으로 워프시키면 발자국이 벽을 파고든다. 체비쇼프 거리 순
나선 탐색으로 첫 유효 칸을 찾는다. 링 순회 순서를 고정해 같은 입력이면 같은
칸이 나오게 했다 — 테스트가 이 결정성을 단언한다.

1x1 은 검사 자체를 하지 않고 지정 좌표를 그대로 준다. 기존 transfer 는
통행 불가 칸에도 강제 착지하고 그게 컷신 배치에 실제로 쓰인다. 여기에
검사를 걸면 기존 게임이 깨진다.

반경 안에 자리가 없으면 지정 좌표로 폴백한다. 워프를 실패시키는 것보다
겹친 채 착지하고 이동만 막히는 쪽이 낫다.

footprint.ts 가 아니라 별도 파일에 뒀다 — collision 과 runtimeEventState 를
둘 다 필요로 하는데 footprint.ts 는 의존성 없는 순수 프리미티브로 남긴다.

배선은 아직 안 했다. transfer 경로 연결은 2차 계획이다."
```

---

### Task 6: 렌더 — 배율과 발자국 중앙

이벤트 스프라이트를 발자국 가로 중앙에 놓고 배율을 적용한다. **여기부터 눈에 보인다.**

**Files:**
- Modify: `src/player/characterDepth.ts` (함수 1개 추가)
- Modify: `src/player/playSceneMapRuntime.ts:60-66` (`RenderedEventSprite`), `:344-350` (`renderEvents`)
- Modify: `test/runtimeEventState.test.ts` (`MockSprite` 에 `setScale` 추가)
- Test: `test/runtimeEventFootprint.test.ts` (렌더 describe 블록 추가)

**Interfaces:**
- Consumes: `footprintBounds` (`@/project/footprint`), `RuntimeEventView.footprint/scale` (Task 3)
- Produces: `footprintSpriteX(tileX: number, fp: CharacterFootprint): number` — `@/player/characterDepth`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

먼저 `test/runtimeEventFootprint.test.ts` 에 순수 좌표 테스트를 붙인다. 상단에 추가:

```ts
import { TILE_SIZE } from "@/assets/bundled";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
```

추가할 블록:

```ts
describe("footprintSpriteX — 발자국 가로 중앙", () => {
  it("1x1 은 기존 characterSpriteX 와 같다", () => {
    for (let x = 0; x <= 12; x += 1) {
      expect(footprintSpriteX(x, UNIT_FOOTPRINT)).toBe(characterSpriteX(x));
    }
  });

  it("홀수 폭도 기존과 같다 — 발밑 칸 중앙이 곧 발자국 중앙이다", () => {
    expect(footprintSpriteX(5, { width: 3, height: 3 })).toBe(characterSpriteX(5));
    expect(footprintSpriteX(5, { width: 5, height: 1 })).toBe(characterSpriteX(5));
  });

  it("짝수 폭은 두 칸 경계에 온다", () => {
    expect(footprintSpriteX(5, { width: 2, height: 2 })).toBe(6 * TILE_SIZE);
    expect(footprintSpriteX(5, { width: 4, height: 1 })).toBe(6 * TILE_SIZE);
  });

  it("Y 는 발자국 높이와 무관하게 발밑 칸 하단이다", () => {
    expect(characterSpriteY(7)).toBe(8 * TILE_SIZE);
  });
});
```

그리고 실제 렌더 경로 테스트를 붙인다. `renderEvents` 는 `graphic.sprite` 가 없으면 마커를 만들지 않고 `continue` 하므로(`playSceneMapRuntime.ts:332`) 번들 캐릭터셋을 반드시 붙여야 한다.

`test/runtimeEventFootprint.test.ts` 상단 import 를 더 확장한다:

```ts
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { renderTiles } from "@/player/playSceneMapRuntime";
```

`createBlankProject()` 의 시작 맵은 20x15 이므로 (5,7) 이 안전하게 들어간다. 이 테스트는 `store` 와 `startSession` 을 쓰므로 앞 블록들의 `mapWithEvent` 와 달리 **시작 맵을 그대로** 쓴다.

```ts
type CapturedSprite = {
  x: number;
  y: number;
  scale: number;
  setOrigin(originX: number, originY: number): void;
  setDepth(depth: number): void;
  play(key: string): CapturedSprite;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
  destroy(): void;
};

function renderSceneFor(target: GameEvent): {
  created: CapturedSprite[];
  scene: Parameters<typeof renderTiles>[0];
} {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [target];
  store.replace(project);

  const created: CapturedSprite[] = [];
  const scene: Parameters<typeof renderTiles>[0] = {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    tileLayer: { removeAll: () => undefined, add: () => undefined },
    eventSprites: new Map(),
    runtimeDom: {
      clearEventMarkers: () => undefined,
      upsertEventMarker: () => undefined,
      syncMissingResourceError: () => undefined,
    },
    missingResources: new Set<string>(),
    add: {
      image: () => ({ y: 0, setOrigin: () => undefined, setDepth: () => undefined }),
      sprite: (x: number, y: number) => {
        const sprite: CapturedSprite = {
          x,
          y,
          scale: 1,
          setOrigin: () => undefined,
          setDepth: () => undefined,
          play: () => sprite,
          setPosition: (px, py) => {
            sprite.x = px;
            sprite.y = py;
          },
          setFrame: () => undefined,
          setScale: (value) => {
            sprite.scale = value;
          },
          destroy: () => undefined,
        };
        created.push(sprite);
        return sprite;
      },
    },
    runEvent: async () => undefined,
    syncRuntimeState: () => undefined,
  };
  return { created, scene };
}

function golemEvent(footprint: { width: number; height: number }, scale: number): GameEvent {
  return {
    id: "ev_golem",
    x: 5,
    y: 7,
    trigger: { kind: "action" },
    commands: [],
    pages: [page({
      footprint,
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, scale },
      priority: "same",
      overlapForbidden: true,
    })],
  };
}

describe("renderEvents 는 발자국 중앙에 배율을 걸어 그린다", () => {
  it("2x2 배율 2 는 두 칸 경계에 배율 2 로 놓인다", () => {
    const { created, scene } = renderSceneFor(golemEvent({ width: 2, height: 2 }, 2));
    renderTiles(scene);

    expect(created).toHaveLength(1);
    expect(created[0].x).toBe(6 * TILE_SIZE);
    expect(created[0].y).toBe(8 * TILE_SIZE);
    expect(created[0].scale).toBe(2);
  });

  it("1x1 배율 1 은 기존 좌표와 배율 그대로다", () => {
    const { created, scene } = renderSceneFor(golemEvent({ width: 1, height: 1 }, 1));
    renderTiles(scene);

    expect(created).toHaveLength(1);
    expect(created[0].x).toBe(characterSpriteX(5));
    expect(created[0].y).toBe(characterSpriteY(7));
    expect(created[0].scale).toBe(1);
  });

  it("배율만 크고 발자국은 1x1 인 조합도 성립한다", () => {
    const { created, scene } = renderSceneFor(golemEvent({ width: 1, height: 1 }, 3));
    renderTiles(scene);

    expect(created[0].x).toBe(characterSpriteX(5));
    expect(created[0].scale).toBe(3);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts`

Expected: FAIL — `footprintSpriteX` 미export

- [ ] **Step 3: `footprintSpriteX` 를 구현한다**

`src/player/characterDepth.ts` 의 `characterSpriteY` 아래에 추가한다. 상단 import 에 다음을 더한다:

```ts
import { footprintBounds } from "@/project/footprint";
import type { CharacterFootprint } from "@/project/types";
```

```ts
/**
 * 발자국 가로 중앙의 월드 X. 스프라이트 원점이 (0.5, 1) 이라 이 값이 곧 중심선이다.
 * 1x1·홀수 폭이면 characterSpriteX 와 같고, 짝수 폭이면 두 칸 경계에 온다.
 *
 * Y 는 별도 함수가 필요 없다 — 발자국 하단은 언제나 y 이므로 characterSpriteY 가 그대로 맞는다.
 */
export function footprintSpriteX(tileX: number, footprint: CharacterFootprint): number {
  return (footprintBounds(tileX, 0, footprint).left + footprint.width / 2) * TILE_SIZE;
}
```

- [ ] **Step 4: `RenderedEventSprite` 에 `setScale` 을 추가한다**

`src/player/playSceneMapRuntime.ts` 의 60–66행:

```ts
interface RenderedEventSprite extends RenderedTileImage {
  readonly y: number;
  play(key: string): this;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
  destroy(): void;
}
```

- [ ] **Step 5: `renderEvents` 가 발자국·배율을 쓰게 한다**

같은 파일 상단 import 에 `footprintSpriteX` 를 추가한다(`characterSpriteX` 는 다른 곳에서 계속 쓰이면 남긴다).

344–351행을 교체한다:

```ts
    const marker = scene.add.sprite(
      footprintSpriteX(view.x, view.footprint),
      characterSpriteY(view.y),
      spriteTexture?.texture ?? DEFAULT_EASYRPG_CHARSET_ID,
      frame
    );
    placeCharacterSprite(marker, view.priority);
    marker.setScale(view.scale);
    scene.eventSprites.set(event.id, marker);
```

`placeCharacterSprite` 가 `setOrigin(0.5, 1)` 을 걸어 두므로 배율은 위·양옆으로 자란다. 깊이는 `sprite.y`(발자국 하단) 기준이라 손댈 필요가 없다.

- [ ] **Step 6: 기존 테스트의 mock 을 맞춘다**

`test/runtimeEventState.test.ts` 의 `MockSprite` 는 `RenderedEventSprite` 를 구조적으로 만족해야 한다. 인터페이스가 넓어졌으므로 안 고치면 타입 오류가 난다. 고칠 곳은 두 군데다.

타입 선언(파일 상단, `MockTileImage` 아래):

```ts
type MockSprite = MockTileImage & {
  play(key: string): MockSprite;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
  destroy(): void;
};
```

생성 함수 `mockSprite()` 의 객체 리터럴에 `setScale` 한 줄을 더한다. 이 mock 은 배율을 쓰지 않으므로 no-op 이면 충분하다:

```ts
function mockSprite(): MockSprite {
  let sprite: MockSprite;
  sprite = {
    y: 0,
    play: () => sprite,
    setOrigin: () => undefined,
    setDepth: () => undefined,
    setPosition: (_x, y) => {
      sprite.y = y;
    },
    setFrame: () => undefined,
    setScale: () => undefined,
    destroy: () => undefined,
  };
  return sprite;
}
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts test/runtimeEventState.test.ts`

Expected: PASS (전부)

- [ ] **Step 8: 타입 검사**

Run: `npm run typecheck:app`

Expected: 오류 없음. 오류가 나면 `RenderedEventSprite` 를 구현하는 다른 mock 이 더 있다는 뜻이다 — `grep -rn "setFrame" test/ src/` 로 찾아 같이 고친다.

- [ ] **Step 9: 커밋**

```bash
git add src/player/characterDepth.ts src/player/playSceneMapRuntime.ts test/runtimeEventState.test.ts test/runtimeEventFootprint.test.ts
git commit -m "feat(render): 이벤트 스프라이트를 발자국 중앙에 배율로 그린다

스프라이트 원점이 이미 (0.5, 1) 하단 중앙이라 배율만 걸면 위·양옆으로
자란다 — 원하는 방향 그대로다. 가로 위치만 발밑 칸 중앙에서 발자국 중앙으로
옮겼다. 1x1 과 홀수 폭은 계산 결과가 기존 characterSpriteX 와 같고 짝수 폭만
두 칸 경계로 간다.

Y 는 새 함수를 만들지 않았다. 발자국 하단은 언제나 y 라 기존 characterSpriteY
가 그대로 맞는다. 깊이 정렬도 sprite.y 기준이라 손대지 않았다.

setScale 을 부르려면 RenderedEventSprite 인터페이스를 넓혀야 했고, 그래서
이 인터페이스를 구현하는 테스트 mock 도 같이 고쳤다."
```

---

### Task 7: 골렘 데모 — 눈으로 확인한다

2x2 골렘을 실제로 배치해 렌더·통행·대화를 사람 눈과 스크린샷으로 확인한다.

**Files:**
- Test: `test/runtimeEventFootprint.test.ts` (통합 describe 블록 추가)
- 산출물: `verify-shots/` 아래 스크린샷 (커밋하지 않음, 보고용)

**Interfaces:**
- Consumes: Task 1–6 전부
- Produces: 없음 (검증 태스크)

- [ ] **Step 1: 통합 테스트를 쓴다**

`test/runtimeEventFootprint.test.ts` 끝에 붙인다. 발자국·통행·대화가 한 시나리오에서 같이 맞는지 본다.

```ts
describe("골렘 시나리오 — 2x2 가 길을 막고 어디서든 말이 걸린다", () => {
  it("발자국 네 칸이 통행을 막고 인접 네 방향에서 조사가 걸린다", () => {
    const golem: GameEvent = {
      id: "ev_golem",
      x: 5,
      y: 7,
      trigger: { kind: "action" },
      commands: [],
      pages: [page({
        footprint: { width: 2, height: 2 },
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, scale: 2 },
        priority: "same",
        overlapForbidden: true,
      })],
    };
    const { project, map } = mapWithEvent(golem);
    const positions = initialRuntimeEventPositions(map.events);

    // 발자국은 (5,6) (6,6) (5,7) (6,7).
    for (const [x, y] of [[5, 6], [6, 6], [5, 7], [6, 7]]) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `막힘 (${x},${y})`).toBeDefined();
    }

    // 발자국 바로 바깥에서 정면 조사 — 각 방향에서 인접 칸을 조사하면 골렘이 잡힌다.
    const probes = [
      [4, 7, 5, 7], // 왼쪽에서 오른쪽 보기
      [7, 6, 6, 6], // 오른쪽에서 왼쪽 보기
      [5, 5, 5, 6], // 위에서 아래 보기
      [6, 8, 6, 7], // 아래에서 위 보기
    ] as const;
    for (const [px, py, tx, ty] of probes) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, px, py), `서는 칸 (${px},${py})`).toBeUndefined();
      expect(findRuntimeEventAtInMap(project, map, session(), positions, tx, ty, "action")?.event.id, `조사 (${tx},${ty})`).toBe("ev_golem");
    }

    // 렌더 좌표: 2x2 라 두 칸 경계, 배율 2.
    const view = runtimeEventView(golem, session(), positions);
    expect(footprintSpriteX(view.x, view.footprint)).toBe(6 * TILE_SIZE);
    expect(view.scale).toBe(2);
  });
});
```

- [ ] **Step 2: 테스트를 돌린다**

Run: `node scripts/run-vitest.mjs run --configLoader bundle test/runtimeEventFootprint.test.ts`

Expected: PASS (전부)

- [ ] **Step 3: 전체 스위트로 회귀를 확인한다**

Run: `npm test 2>&1 | tail -40`

Expected: 이 브랜치 기준선과 **실패 파일 집합이 같다.** 공유 머신이라 실패 개수만으로 판정하지 않는다. 작업 시작 전 기준선을 안 찍어 뒀다면 지금 `git stash` 후 한 번 돌려 비교한다.

- [ ] **Step 4: 골렘을 심은 픽스처를 만든다**

에디터에 크기·배율 입력 UI 가 아직 없으므로(2차 계획), 런타임 QA 픽스처에 직접 심는다. `__oprnDebug` 는 세션 읽기 전용 훅이라 프로젝트를 못 고친다 — 픽스처 경로가 맞다.

`/tmp/inject-golem.mjs` 를 만든다(저장소에 커밋하지 않는 일회용 스크립트다).

```js
// 런타임 QA 픽스처에 2x2 배율 2 골렘을 심는다. 커밋하지 않는 일회용 스크립트.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "test/fixtures/projects/oprn-sample-v3.json";
const TARGET = "/tmp/golem-fixture.json";

const project = JSON.parse(readFileSync(SOURCE, "utf8"));
const map = project.maps[project.startMapId];
if (!map) throw new Error(`시작 맵을 못 찾았다: ${project.startMapId}`);

// 플레이어 시작 칸에서 오른쪽으로 3칸 — 화면에 바로 보이고 걸어가 부딪힐 수 있다.
const startX = project.session?.x ?? 5;
const startY = project.session?.y ?? 5;
const golemX = Math.min(startX + 3, map.width - 2);
const golemY = Math.min(Math.max(startY, 1), map.height - 1);

map.events = [
  ...map.events.filter((event) => event.id !== "ev_golem_demo"),
  {
    id: "ev_golem_demo",
    x: golemX,
    y: golemY,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "p1",
      name: "골렘",
      conditions: [],
      graphic: {
        sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" },
        direction: "down",
        pattern: 1,
        scale: 2,
      },
      footprint: { width: 2, height: 2 },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "그르릉..." }],
    }],
  },
];

writeFileSync(TARGET, JSON.stringify(project, null, 2));
console.log(`골렘을 (${golemX},${golemY}) 에 심었다 → ${TARGET}`);
console.log(`발자국: (${golemX},${golemY - 1}) (${golemX + 1},${golemY - 1}) (${golemX},${golemY}) (${golemX + 1},${golemY})`);
```

Run:
```bash
node /tmp/inject-golem.mjs
```

Expected: 골렘 좌표와 발자국 네 칸이 출력된다.

- [ ] **Step 5: 런타임 QA 로 스크린샷을 찍는다**

`scripts/runtime-qa.mjs` 는 `--project` 로 픽스처를 갈아끼운다. 에디터 크롬이 없는 실제 플레이어 표면이라 이 검증에 맞다.

```bash
node scripts/runtime-qa.mjs --scenario smoke --project /tmp/golem-fixture.json --out verify-shots/big-character-golem
```

`--headed` 를 붙이면 브라우저가 뜬 채로 돌아 직접 걸어볼 수 있다.

`verify-shots/big-character-golem/` 의 샷을 열어 확인할 것:

- 골렘이 **가로 두 칸에 걸쳐** 그려지는가 — 한 칸 중앙이 아니라 두 칸 **경계**에 중심선이 있어야 한다
- 스프라이트가 **위로 자라는가** — 아래로 밀려 발이 땅에 파묻히면 원점 처리가 틀린 것이다
- 24x32 를 2배로 늘린 48x64 라 뭉개져 보이는 건 **정상**이다 (스펙 후속 과제)

`--headed` 로 직접 걸어서 확인할 것:

- 발자국 **네 칸 전부**에서 통행이 막히는가
- **네 칸 어디에 접해서 조사해도** "그르릉..." 이 뜨는가

시나리오 비트가 골렘 좌표를 모르므로 게이트가 실패로 보고할 수 있다. 이 단계에서 보는 건 **샷의 그림**이지 게이트 통과가 아니다 — 시나리오를 골렘에 맞춰 고치는 건 이 계획 범위가 아니다.

- [ ] **Step 6: 커밋**

```bash
git add test/runtimeEventFootprint.test.ts
git commit -m "test(footprint): 2x2 골렘 시나리오로 발자국 전 경로를 한 번에 묶는다

프리미티브·통행·히트테스트·렌더 좌표를 따로따로 검증해 왔는데, 실제
저작물 한 개에서 넷이 같이 맞는지는 아직 아무도 안 봤다. Monster1 골렘을
2x2 배율 2 로 놓고 발자국 네 칸이 전부 막히는지, 네 방향 어디서 조사해도
같은 이벤트가 잡히는지, 렌더 X 가 두 칸 경계로 가는지를 한 테스트에서 묶었다.

브라우저 육안 확인도 같이 했다 — 골렘이 두 칸에 걸쳐 위로 자라고, 네 칸이
막히고, 네 방향에서 말이 걸린다."
```

---

## 완료 기준

이 계획이 끝나면 다음이 참이어야 한다.

1. `node scripts/run-vitest.mjs run --configLoader bundle test/characterFootprint.test.ts test/collisionFootprint.test.ts test/runtimeEventFootprint.test.ts test/footprintLanding.test.ts` 전부 통과
2. `npm test` 의 실패 집합이 작업 전 기준선과 동일
3. `npm run typecheck:app` 오류 없음
4. 브라우저에서 2x2 골렘이 두 칸을 차지하고, 막고, 네 방향에서 말이 걸린다
5. `footprint` / `scale` 없는 기존 프로젝트의 동작이 하나도 안 바뀐다

## 2차 계획으로 넘기는 것

- 이벤트 편집창의 크기·배율 입력 UI, 맵 위 발자국 외곽선, 겹침 경고 배지
- 플레이어 발자국 (`SystemRecords` 기본값 + 세션 필드 + 세이브 화이트리스트 3곳 + 왕복 테스트)
- `resolveFootprintLanding` 을 transfer 경로에 배선
- 필드 스폰 발자국
- NPC 자율이동·추격 경로탐색의 `canMoveFootprint` 전환
- 팔로워 배율 적용
- `sceneTestRunner.ts:511-522` (`findGiftTargetEvent`) 의 점 비교 승격 — 태스크 4 리뷰에서 발견됐다. 히트테스트 지점은 다섯 곳이 아니라 일곱 곳이었다. 시나리오 테스트 하네스의 선물 대상 지정이라 사용자 노출면이 없어 1차에서 뺐다. (같이 발견된 `playSceneZoneFeedback.ts` 의 `facingPrompt` 는 사용자 눈에 보이고 완료 기준 4를 깨뜨려 1차 태스크 4 에 포함시켰다.)
- 발자국이 겹칠 때의 우선순위 규칙 — 지금은 `.find` 의 배열 순서가 사실상의 규칙이다. 스펙 §3 은 겹쳐 놓는 것을 허용하는데 어느 쪽이 잡히는지는 정의돼 있지 않다. 다중 타일 저작 UI 가 생기면 즉시 노출된다.
- `handleAction` 의 `lastActionTargetKey` 가 이벤트 단위에서 타일 단위로 격하됐다 — 우선순위가 낮은 다중 타일 이벤트 하나가 제자리 회전만으로 다시 발동할 수 있다. 역시 다중 타일 저작이 가능해진 뒤에야 닿는다.
- **움직이는 이벤트 스프라이트의 발자국 중앙 정렬** — 태스크 6 리뷰에서 발견됐다. `footprintSpriteX` 는 `renderEvents` 의 최초 배치에만 걸려 있고, 스프라이트를 *다시* 놓는 경로는 전부 타일 중앙(`characterSpriteX`)으로 되돌린다: `playSceneAutonomous.ts` 의 `updateAutonomousNPCs`·`updateChaseNpc`·`updateActiveNpcMove`, `playSceneActionCombat.ts` 의 `applyKnockback`·`startWindup`·`stepDash`. 폭 2 이상 이벤트가 한 번이라도 움직이면 그 순간 좌표가 튄다. 같은 파일의 데미지 숫자·파티클·텔레그래프·스윙 아크는 타일 중앙이 맞으므로 일괄 치환은 오답이다. `canMoveFootprint` 전환과 같은 작업 묶음이다 — 두 곳 모두 "발자국을 아는 이동" 이라 따로 손대면 두 번 만진다.

### 위 항목들의 실제 범위 — 마감 리뷰에서 좁게 적혀 있음이 드러난 것

목록 자체는 유지하되, 각 항목이 건드려야 하는 자리가 위에 적힌 것보다 넓다. 다음 사람이 착수 규모를 잘못 잡지 않도록 적어 둔다.

- **"필드 스폰 발자국" 은 두 방향이다.** (a) 스폰이 자기 발자국을 갖는 것 — `fieldSpawnEvent`(`src/player/fieldSpawns.ts`)가 합성하는 페이지에 `footprint` 를 싣는 순간 `src/player/playSceneActionCombat.ts` 의 앵커 전용 히트테스트 **여섯 곳**이 동시에 틀린다: 접촉 피해, 플레이어 스윙 아크, 적끼리 점유, 적 스윙 아크 원점, 대시 명중·인접, 투사체 명중. 게다가 `ActionEnemyState`(`actionCombatTypes.ts`)에 footprint 필드가 없어 판정식 교체만으로 안 되고 데이터 모델 변경이 붙는다. 오늘은 합성 페이지에 `footprint` 가 없어 전부 1x1 이라 도달 불가다. (b) 스폰이 **남의** 발자국을 피하는 것 — `occupiedCells`(같은 파일)이 다른 이벤트를 앵커 한 칸으로만 점유 등록해서, 2x2 골렘 몸통 안에 몬스터가 솟는다. (a) 와 방향이 반대라 따로 적어야 한다.
- **앵커에 고정된 시각 표면이 스프라이트 말고도 있다** — `playSceneCamera.ts`, `playSceneLighting.ts`, `playSceneMapAnimations.ts`, `minimap.ts`. 그리고 `RuntimeEventSnapshot`(`runtimeDom.ts`)에 `footprint`/`scale` 이 없어서 `__oprnDebug` 소비자가 사각을 단정할 **수단 자체가 없다** — `scripts/qa/runtime/golem.scenario.mjs` 가 발자국 좌표를 주석에 손으로 적어야 했던 이유가 이것이다.
- **저작 시점 lint 가 틀린 조언을 낸다**(목록에 아예 없던 항목, 에디터 UI 와 성격이 다르다) — `src/project/lint/projectLint.ts` 는 앵커 칸의 통행성과 앵커의 4방 이웃만 봐서 통행 불가 타일을 걸친 2x2 가 무경고로 통과하고, 중복 검사 키가 `${event.x},${event.y}` 라 겹친 2x2 두 개를 중복으로 잡지 못한다. `worldGraph/lint.ts`, `aiPreviewGenerator.ts` 도 앵커까지만 도달한다.
- **테스트 하네스도 앵커 전용이다**(사용자 노출면 없음) — `sceneTestRunner.ts` 의 앵커 맨해튼 거리, `walkthroughRunner.ts` 의 정적 `map.events` 점 일치(footprint 를 볼 수조차 없다), `mapTravelReachability.ts` 의 전이 게이트 한 칸 색인.
- **에디터 클릭 히트테스트**("겹침 경고 배지" 항목에 사실상 딸려 있으나 명시돼 있지 않다) — `EditScene.ts` 외 약 25곳이 점 비교다. 2x2 의 비앵커 칸을 클릭하면 선택이 아니라 **그 위에 새 이벤트가 생긴다.** 내장 플레이어에서도 같은 문제가 있다: `runtimeDom.ts` 의 이벤트 마커가 앵커에 `TILE_SIZE` 1칸 고정이고 그 마커가 클릭 실행 히트박스다(`pointer-events: auto`).
- **QA 하네스에 이동 단정 수단이 없다** — `evaluateExpect`(`scripts/lib/runtimeQa.mjs`)가 x/y 를 스칼라 동등으로만 비교해서 대조군의 "움직였다" 를 표현할 수 없다. 그래서 A/B 배제가 자동이 아니라 사람이 매니페스트를 읽는 절차다. 부등 비교를 넣으면 닫히는데, 다른 시나리오가 공유하는 파일이라 1차에서 손대지 않았다.
