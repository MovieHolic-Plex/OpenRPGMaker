# MZ식 4층 — PR ① 데이터 칸 + 그리기 + 통행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 맵에 선택 칸 `lowerOverlayTiles`(2층)·`upperOverlayTiles`(4층)·`shadowBits`(그림자)를 더하고, 저장·복사·크기 바꾸기·밀기에서 잃지 않으며, 에디터·게임·미리보기가 1→2→그림자→3→4 순서로 그리고, 통행을 4층 규칙으로 판정한다. 칠하기 UI 는 바꾸지 않는다.

**Architecture:** 층 번호 ↔ 칸 이름 대응은 새 모듈 `src/project/mapLayers.ts` 한 곳에 둔다. 모든 소비자는 이 헬퍼로 읽고 쓴다. 기존 `lowerTiles`/`upperTiles` 는 1층/3층으로 그대로 쓰므로 옛 맵은 변환 없이 같은 결과를 낸다. 렌더러의 "lower 묶음"(1·2·그림자)과 "upper 묶음"(3·4)은 기존 `lower`/`upper` 증분 갱신 키를 그대로 쓴다.

**Tech Stack:** TypeScript, Phaser 3(에디터·게임), Canvas 2D(미리보기), vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md` (§2 데이터, §3 순서, §4 통행, §8 변경 범위, §9 PR ①)

## Global Constraints

- 새 칸은 **선택(optional)** 이다. 없으면 모두 빈칸(-1 / 그림자 0). 모든 칸이 비면 저장 전에 칸을 뺀다(`compactMapLayers`).
- 길이는 항상 `width * height`. 타일 빈칸은 `-1`, 그림자는 `0..15`(bit0 왼위 · bit1 오른위 · bit2 왼아래 · bit3 오른아래).
- 옛 맵(새 칸 없음)은 화면·통행·깊이가 **바이트 단위로** 이전과 같아야 한다.
- 2·4층 타일은 **원래 모양 그대로** 그린다 — 지형 쿼터 합성·호수 자동타일·받침(backing) 경로를 타지 않는다(자동 이음은 PR ②).
- 깊이 오프셋: 2층 `+0.01`, 그림자 `+0.02`(lower 컨테이너 안), 4층 `+0.01`(3층 규칙 값 위에). 설계 문서의 `+0.25` 는 `+0.01` 로 고친다(× 가구가 같은 줄 캐릭터 앞으로 튀지 않게).
- 옛 쌓기(`lowerTileStacks`/`upperTileStacks`)는 건드리지 않는다(삭제는 PR ③).
- 워크트리 hard rule: vitest·gates·전체 typecheck 는 **사용자가 그 메시지에서 시킬 때만** 돌린다. 각 Task 의 "Run" 단계는 허락이 있을 때만 실행하고, 없으면 "미실행" 으로 보고한다.
- 커밋·푸시는 사용자가 시킬 때만. 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `mapLayers.ts` 층 헬퍼

**Files:**
- Create: `src/project/mapLayers.ts`
- Modify: `src/project/types/project.ts:50-53` (GameMap 에 새 칸 3개)
- Test: `test/mapLayers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TileLayerNo = 1 | 2 | 3 | 4;
  export const TILE_LAYER_NOS: readonly TileLayerNo[];            // [1,2,3,4]
  export type TileLayerGroup = "lower" | "upper";
  export function layerGroup(layer: TileLayerNo): TileLayerGroup;  // 1,2→lower · 3,4→upper
  export function layerTileAt(map: GameMap, layer: TileLayerNo, index: number): number;          // 없는 칸 -1
  export function setLayerTileAt(map: GameMap, layer: TileLayerNo, index: number, tile: number): void;
  export function shadowAt(map: GameMap, index: number): number;                                   // 없는 칸 0
  export function setShadowAt(map: GameMap, index: number, bits: number): void;
  export function cellLayerTiles(map: GameMap, index: number): readonly [number, number, number, number]; // 1→4
  export function hasExtraLayers(map: GameMap): boolean;
  export function compactMapLayers(map: GameMap): void;
  export function cloneExtraLayers(map: GameMap): Pick<GameMap, "lowerOverlayTiles" | "upperOverlayTiles" | "shadowBits">;
  export function remapExtraLayers(map: GameMap, width: number, height: number, sourceIndex: (targetIndex: number) => number): void;
  export const EXTRA_LAYER_KEYS: readonly ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits"];
  ```

- [ ] **Step 1: GameMap 타입에 칸 추가**

`src/project/types/project.ts` 의 `upperTiles: number[];` 다음 줄(기존 `lowerTileStacks` 위)에:

```ts
  /** 2층(바닥 장식). 선택 — 없으면 빈칸. 길이 width*height, -1 = 빈칸. `src/project/mapLayers.ts` 로만 읽고 쓴다. */
  lowerOverlayTiles?: number[];
  /** 4층(물체 하나 더). 선택 — 없으면 빈칸. */
  upperOverlayTiles?: number[];
  /** 그림자 비트 0..15(bit0 왼위·bit1 오른위·bit2 왼아래·bit3 오른아래, MZ 와 같음). 선택 — 없으면 0. */
  shadowBits?: number[];
```

- [ ] **Step 2: 실패하는 테스트 작성** — `test/mapLayers.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  cellLayerTiles, cloneExtraLayers, compactMapLayers, hasExtraLayers, layerGroup,
  layerTileAt, remapExtraLayers, setLayerTileAt, setShadowAt, shadowAt,
} from "@/project/mapLayers";
import type { GameMap } from "@/project/types";

function blankMap(): GameMap {
  const project = createBlankProject();
  return structuredClone(project.maps[project.startMapId]);
}

describe("mapLayers", () => {
  it("1층·3층은 기존 lowerTiles·upperTiles 다", () => {
    const map = blankMap();
    setLayerTileAt(map, 1, 0, 7);
    setLayerTileAt(map, 3, 0, 9);
    expect(map.lowerTiles[0]).toBe(7);
    expect(map.upperTiles[0]).toBe(9);
    expect(hasExtraLayers(map)).toBe(false);
  });

  it("2층·4층·그림자는 쓸 때만 생기고 나머지는 빈칸", () => {
    const map = blankMap();
    expect(layerTileAt(map, 2, 3)).toBe(-1);
    expect(shadowAt(map, 3)).toBe(0);
    setLayerTileAt(map, 2, 3, 11);
    setLayerTileAt(map, 4, 5, 12);
    setShadowAt(map, 6, 0b0101);
    expect(map.lowerOverlayTiles?.length).toBe(map.width * map.height);
    expect(layerTileAt(map, 2, 3)).toBe(11);
    expect(layerTileAt(map, 2, 4)).toBe(-1);
    expect(layerTileAt(map, 4, 5)).toBe(12);
    expect(shadowAt(map, 6)).toBe(5);
    expect(cellLayerTiles(map, 3)).toEqual([map.lowerTiles[3], 11, map.upperTiles[3], -1]);
  });

  it("빈칸을 쓰면 칸을 만들지 않는다", () => {
    const map = blankMap();
    setLayerTileAt(map, 2, 0, -1);
    setShadowAt(map, 0, 0);
    expect(map.lowerOverlayTiles).toBeUndefined();
    expect(map.shadowBits).toBeUndefined();
  });

  it("그림자 비트는 0..15 로 자른다", () => {
    const map = blankMap();
    setShadowAt(map, 0, 0xff);
    expect(shadowAt(map, 0)).toBe(15);
  });

  it("compact 는 모두 빈 칸을 지운다", () => {
    const map = blankMap();
    setLayerTileAt(map, 2, 0, 5);
    setLayerTileAt(map, 2, 0, -1);
    setShadowAt(map, 1, 3);
    setShadowAt(map, 1, 0);
    compactMapLayers(map);
    expect("lowerOverlayTiles" in map).toBe(false);
    expect("shadowBits" in map).toBe(false);
  });

  it("clone 은 배열을 복사한다(별칭 없음)", () => {
    const map = blankMap();
    setLayerTileAt(map, 4, 0, 5);
    const copy = cloneExtraLayers(map);
    copy.upperOverlayTiles![0] = 99;
    expect(layerTileAt(map, 4, 0)).toBe(5);
    expect(cloneExtraLayers(blankMap())).toEqual({});
  });

  it("remap 은 새 크기로 옮기고 밖은 비운다", () => {
    const map = blankMap();
    const oldW = map.width;
    setLayerTileAt(map, 2, 1 * oldW + 1, 8);   // (1,1)
    setShadowAt(map, 0, 2);                    // (0,0)
    // 2×2 로 줄이면서 (1,1) → (0,0), 나머지는 원본 없음
    remapExtraLayers(map, 2, 2, (t) => (t === 0 ? 1 * oldW + 1 : -1));
    expect(map.lowerOverlayTiles).toEqual([8, -1, -1, -1]);
    expect(map.shadowBits).toBeUndefined();     // (0,0) 로 온 원본에는 그림자가 없어 모두 0 → 칸 제거
  });

  it("layerGroup", () => {
    expect([1, 2, 3, 4].map((n) => layerGroup(n as 1 | 2 | 3 | 4))).toEqual(["lower", "lower", "upper", "upper"]);
  });
});
```

- [ ] **Step 3: Run (허락 시)** `node scripts/run-vitest.mjs run test/mapLayers.test.ts --configLoader bundle` — Expected: FAIL "Cannot find module '@/project/mapLayers'".

- [ ] **Step 4: 구현** — `src/project/mapLayers.ts`

```ts
import type { GameMap } from "@/project/types";

/**
 * 맵 칸의 층(MZ식 4층 + 그림자). 설계: docs/superpowers/specs/2026-09-24-mz-four-layer-design.md
 *
 * 1층 = lowerTiles, 2층 = lowerOverlayTiles, 3층 = upperTiles, 4층 = upperOverlayTiles.
 * 2·4층과 그림자는 선택 칸이라 옛 맵에는 없다 — 없으면 빈칸이다.
 * 층 번호와 칸 이름의 대응은 이 파일에만 둔다.
 */
export type TileLayerNo = 1 | 2 | 3 | 4;
export const TILE_LAYER_NOS: readonly TileLayerNo[] = [1, 2, 3, 4];
export type TileLayerGroup = "lower" | "upper";
export const EXTRA_LAYER_KEYS = ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits"] as const;
type ExtraLayerKey = (typeof EXTRA_LAYER_KEYS)[number];

export function layerGroup(layer: TileLayerNo): TileLayerGroup {
  return layer <= 2 ? "lower" : "upper";
}

function overlayKey(layer: 2 | 4): "lowerOverlayTiles" | "upperOverlayTiles" {
  return layer === 2 ? "lowerOverlayTiles" : "upperOverlayTiles";
}

export function layerTileAt(map: GameMap, layer: TileLayerNo, index: number): number {
  if (layer === 1) return map.lowerTiles[index] ?? -1;
  if (layer === 3) return map.upperTiles[index] ?? -1;
  return map[overlayKey(layer)]?.[index] ?? -1;
}

export function setLayerTileAt(map: GameMap, layer: TileLayerNo, index: number, tile: number): void {
  if (index < 0 || index >= map.width * map.height) return;
  if (layer === 1) { map.lowerTiles[index] = tile; return; }
  if (layer === 3) { map.upperTiles[index] = tile; return; }
  const key = overlayKey(layer);
  const tiles = map[key];
  if (!tiles) {
    if (tile < 0) return;
    map[key] = new Array<number>(map.width * map.height).fill(-1);
  }
  map[key]![index] = tile < 0 ? -1 : tile;
}

export function shadowAt(map: GameMap, index: number): number {
  return map.shadowBits?.[index] ?? 0;
}

export function setShadowAt(map: GameMap, index: number, bits: number): void {
  if (index < 0 || index >= map.width * map.height) return;
  const value = bits & 0b1111;
  if (!map.shadowBits) {
    if (value === 0) return;
    map.shadowBits = new Array<number>(map.width * map.height).fill(0);
  }
  map.shadowBits[index] = value;
}

export function cellLayerTiles(map: GameMap, index: number): readonly [number, number, number, number] {
  return [layerTileAt(map, 1, index), layerTileAt(map, 2, index), layerTileAt(map, 3, index), layerTileAt(map, 4, index)];
}

export function hasExtraLayers(map: GameMap): boolean {
  return EXTRA_LAYER_KEYS.some((key) => map[key] !== undefined);
}

function isEmptyExtra(key: ExtraLayerKey, values: readonly number[]): boolean {
  const empty = key === "shadowBits" ? 0 : -1;
  return values.every((value) => value === empty);
}

/** 모두 빈 선택 칸을 지운다. 저장 전·크기 변경 뒤에 부른다. */
export function compactMapLayers(map: GameMap): void {
  for (const key of EXTRA_LAYER_KEYS) {
    const values = map[key];
    if (values && isEmptyExtra(key, values)) delete map[key];
  }
}

/** 선택 칸의 깊은 복사. 없는 칸은 결과에도 없다(스프레드로 붙이면 옛 맵 모양이 그대로다). */
export function cloneExtraLayers(map: GameMap): Pick<GameMap, ExtraLayerKey> {
  const out: Pick<GameMap, ExtraLayerKey> = {};
  for (const key of EXTRA_LAYER_KEYS) {
    const values = map[key];
    if (values) out[key] = values.slice();
  }
  return out;
}

/**
 * 크기 바꾸기·밀기용. 새 격자(width×height)의 각 칸에 원본 칸 번호(sourceIndex)를 받아 옮긴다.
 * sourceIndex 가 -1 이면 빈칸. 결과가 모두 비면 칸을 지운다. map.width/height 는 호출자가 바꾼다.
 */
export function remapExtraLayers(map: GameMap, width: number, height: number, sourceIndex: (targetIndex: number) => number): void {
  for (const key of EXTRA_LAYER_KEYS) {
    const source = map[key];
    if (!source) continue;
    const empty = key === "shadowBits" ? 0 : -1;
    const next = new Array<number>(width * height).fill(empty);
    for (let target = 0; target < next.length; target += 1) {
      const from = sourceIndex(target);
      if (from >= 0) next[target] = source[from] ?? empty;
    }
    if (isEmptyExtra(key, next)) delete map[key];
    else map[key] = next;
  }
}
```

- [ ] **Step 5: Run (허락 시)** 같은 명령 — Expected: PASS 8개.

- [ ] **Step 6: Commit (사용자가 시킬 때)**
```bash
git add src/project/mapLayers.ts src/project/types/project.ts test/mapLayers.test.ts
git commit -m "feat(map): 2층·4층·그림자 선택 칸과 층 헬퍼"
```

---

### Task 2: 저장·검증·복사 경로에서 새 칸을 잃지 않기

**Files:**
- Modify: `src/project/store.ts:853-859` (`updateMapTiles` 초안 복사)
- Modify: `src/project/io/shapeEventFields.ts:40-42` (길이 검증)
- Modify: `src/util/structuralJson.ts:9` (`TILE_PAYLOAD_KEYS`)
- Modify: `src/project/changeLedger.ts:51-54, 308-315` (라벨·요약)
- Test: `test/mapLayersPersistence.test.ts`

**Interfaces:**
- Consumes: `cloneExtraLayers`, `setLayerTileAt`, `setShadowAt`, `layerTileAt`, `shadowAt` (Task 1)

- [ ] **Step 1: 실패하는 테스트** — `test/mapLayersPersistence.test.ts`

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import { validateProjectShape } from "@/project/io/shapeEventFields";

beforeEach(() => store.replace(createBlankProject()));

describe("새 층 칸 — 저장 경로", () => {
  it("updateMapTiles 는 2층·4층·그림자를 복사해 보존하고 이전 상태와 공유하지 않는다", () => {
    const id = store.getCurrent().startMapId;
    store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 5); setLayerTileAt(m, 4, 1, 6); setShadowAt(m, 2, 3); });
    const before = store.getCurrent().maps[id];
    store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 9); });
    const after = store.getCurrent().maps[id];
    expect(layerTileAt(before, 2, 0)).toBe(5);
    expect(layerTileAt(after, 2, 0)).toBe(9);
    expect(layerTileAt(after, 4, 1)).toBe(6);
    expect(shadowAt(after, 2)).toBe(3);
  });

  it("검증은 길이가 틀린 새 칸을 거부하고 맞는 칸은 통과시킨다", () => {
    const project = structuredClone(store.getCurrent());
    const map = project.maps[project.startMapId];
    map.lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
    map.shadowBits = new Array(map.width * map.height).fill(0);
    expect(() => validateProjectShape(project)).not.toThrow();
    map.upperOverlayTiles = [1, 2, 3];
    expect(() => validateProjectShape(project)).toThrow(/upperOverlayTiles 길이 불일치/);
  });
});
```

> 구현 전 확인: `shapeEventFields.ts` 에서 맵 루프를 부르는 공개 함수 이름을 `grep -n "^export function" src/project/io/shapeEventFields.ts` 로 찾아 `validateProjectShape` 를 그 이름으로 바꾼다.

- [ ] **Step 2: Run (허락 시)** `node scripts/run-vitest.mjs run test/mapLayersPersistence.test.ts --configLoader bundle` — Expected: 첫 테스트 FAIL(`before` 가 9 로 바뀜 — 배열 공유), 둘째 FAIL(길이 검증 없음).

- [ ] **Step 3: store 초안 복사** — `src/project/store.ts` `updateMapTiles` 의 `draftMap` 에 한 줄:

```ts
    const draftMap: GameMap = {
      ...currentMap,
      lowerTiles: currentMap.lowerTiles.slice(),
      upperTiles: currentMap.upperTiles.slice(),
      ...cloneExtraLayers(currentMap),
      ...(currentMap.lowerTileStacks ? { lowerTileStacks: cloneTileStacks(currentMap.lowerTileStacks) } : {}),
      ...(currentMap.upperTileStacks ? { upperTileStacks: cloneTileStacks(currentMap.upperTileStacks) } : {}),
    };
```
import 추가: `import { cloneExtraLayers } from "@/project/mapLayers";`

같은 파일에서 맵을 칸 이름으로 골라 복사하는 곳을 더 찾는다: `grep -n "lowerTiles: .*slice()" src/project/store.ts src/project/*.ts src/editor/*.ts`. 나오는 곳마다 `...cloneExtraLayers(원본)` 을 같은 모양으로 붙인다.

- [ ] **Step 4: 길이 검증** — `shapeEventFields.ts` 의 `upperTiles` 검증 다음 줄에:

```ts
    for (const key of ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits"] as const) {
      if (map[key] !== undefined) assert(requireArray(`map ${id}.${key}`, map[key]).length === expected, `map ${id}: ${key} 길이 불일치.`);
    }
```

- [ ] **Step 5: 지문·원장** — `structuralJson.ts`:

```ts
const TILE_PAYLOAD_KEYS = new Set(["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles", "shadowBits", "lowerTileStacks", "upperTileStacks"]);
```

`changeLedger.ts` 라벨 표에 `lowerOverlayTiles: "2층 타일", upperOverlayTiles: "4층 타일", shadowBits: "그림자",` 를 더하고, 요약의 조건을

```ts
        if (key === "lowerTiles" || key === "upperTiles" || key === "lowerOverlayTiles" || key === "upperOverlayTiles" || key === "shadowBits") {
```
로 넓힌다. `countTileCells` 는 한쪽이 `undefined` 여도 동작하는지 확인하고(아니면 `?? []` 로 넘긴다).

- [ ] **Step 6: Run (허락 시)** — Expected: PASS 2개.

- [ ] **Step 7: Commit (사용자가 시킬 때)** `git commit -m "fix(map): 저장·검증·원장이 2층·4층·그림자를 보존"`

---

### Task 3: 통행 — 위에서부터 ★ 건너뛰기

**Files:**
- Modify: `src/project/collision.ts:20-47, 83-86, 112-113` (`tileAt`, `tilePassability`, 새 `layeredPassability`, `canMove`·`isPassable` 사용처)
- Test: `test/collisionLayers.test.ts`

**Interfaces:**
- Consumes: `cellLayerTiles` (Task 1)
- Produces: `export function layeredPassability(tileset: TilesetDef, tiles: readonly number[]): PassFlag` — `tiles` 는 1층부터 위로. `tileAt(map,x,y)` 반환에 `layers: readonly [n,n,n,n]` 추가(기존 `lower`/`upper` 는 유지).

- [ ] **Step 1: 실패하는 테스트** — `test/collisionLayers.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable, layeredPassability, tilePassability } from "@/project/collision";
import { setLayerTileAt } from "@/project/mapLayers";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";

function setup() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  const tileset = project.tilesets[map.tilesetId];
  const find = (mark: "o" | "x" | "star") => {
    for (let t = 0; t < tileset.count; t++) if (passageMarkForTile(tileset, t) === mark) return t;
    throw new Error(`no ${mark} tile`);
  };
  return { project, map, tileset, O: find("o"), X: find("x"), STAR: find("star") };
}

describe("layeredPassability", () => {
  it("두 층이면 기존 tilePassability 와 같다", () => {
    const { tileset, O, X, STAR } = setup();
    for (const lower of [O, X]) for (const upper of [-1, O, X, STAR]) {
      expect(layeredPassability(tileset, [lower, -1, upper, -1])).toEqual(tilePassability(tileset, lower, upper));
    }
  });
  it("맨 위의 ★ 아닌 타일이 정한다 — 4층 X 는 3층 O 를 막는다", () => {
    const { tileset, O, X } = setup();
    expect(layeredPassability(tileset, [O, -1, O, X]).up).toBe(false);
  });
  it("★ 는 건너뛴다 — 4층 ★ 아래 2층 X 가 정한다", () => {
    const { tileset, O, X, STAR } = setup();
    expect(layeredPassability(tileset, [O, X, -1, STAR]).up).toBe(false);
  });
  it("2층 O 는 1층 X 위에서 통행을 연다(MZ 와 같음)", () => {
    const { tileset, O, X } = setup();
    expect(layeredPassability(tileset, [X, O, -1, -1]).up).toBe(true);
  });
  it("1층이 비면 막힘", () => {
    const { tileset, O } = setup();
    expect(layeredPassability(tileset as TilesetDef, [-1, O, -1, -1])).toEqual({ up: false, down: false, left: false, right: false });
  });
  it("isPassable 이 4층을 본다", () => {
    const { project, map, O, X } = setup();
    setLayerTileAt(map, 1, 0, O);
    expect(isPassable(project, map, 0, 0)).toBe(true);
    setLayerTileAt(map, 4, 0, X);
    expect(isPassable(project, map, 0, 0)).toBe(false);
  });
});
```

> `isPassable` 의 실제 인자 순서는 `collision.ts:103` 부근을 보고 맞춘다.

- [ ] **Step 2: Run (허락 시)** `node scripts/run-vitest.mjs run test/collisionLayers.test.ts test/collision.test.ts --configLoader bundle` — Expected: 새 파일 FAIL(`layeredPassability` 없음), 기존 `collision.test.ts` PASS.

- [ ] **Step 3: 구현** — `collision.ts`

```ts
import { cellLayerTiles } from "./mapLayers";

export function tileAt(map: GameMap, x: number, y: number): {
  lower: number;
  upper: number;
  layers: readonly [number, number, number, number];
} {
  if (!inBounds(map, x, y)) return { lower: -1, upper: -1, layers: [-1, -1, -1, -1] };
  const i = y * map.width + x;
  const layers = cellLayerTiles(map, i);
  return {
    lower: topTileInStack(map, "lower", i) ?? layers[0],
    upper: topTileInStack(map, "upper", i) ?? layers[2],
    layers,
  };
}

const BLOCKED: PassFlag = { up: false, down: false, left: false, right: false };

/**
 * 칸의 통행(MZ 규칙). tiles 는 1층부터 위로. 맨 위부터 내려가며 빈칸과 ★ 를 건너뛰고,
 * 처음 만난 타일의 통행이 칸을 정한다. 1층은 ★ 여도 바닥이므로 그 자체로 정한다.
 * 1층이 비었거나 통행 정보가 없으면 막힘. 두 층([1층,-1,3층,-1])이면 tilePassability 와 같다.
 */
export function layeredPassability(tileset: TilesetDef, tiles: readonly number[]): PassFlag {
  const base = tiles[0] ?? -1;
  const basePass = base >= 0 && base < tileset.passability.length ? tileset.passability[base] : null;
  if (!basePass) return BLOCKED;
  for (let layer = tiles.length - 1; layer >= 1; layer -= 1) {
    const tile = tiles[layer] ?? -1;
    if (tile < 0 || tile >= tileset.passability.length) continue;
    if (passageMarkForTile(tileset, tile) === "star") continue;
    const pass = tileset.passability[tile];
    if (pass) return pass;
  }
  return basePass;
}

export function tilePassability(tileset: TilesetDef, lower: number, upper: number): PassFlag {
  return layeredPassability(tileset, [lower, -1, upper, -1]);
}
```

`canMove`(83-86행)와 `isPassable`(112-113행)의 `tilePassability(tileset, t.lower, t.upper)` 를 `layeredPassability(tileset, withStackTops(t))` 로 바꾼다. 옛 스택 top 이 있으면 1·3층 값을 대신하도록 같은 파일에:

```ts
function withStackTops(t: ReturnType<typeof tileAt>): readonly number[] {
  return [t.lower, t.layers[1], t.upper, t.layers[3]];
}
```
`isPassableLanding`·`canMoveFootprint`·`canMoveRect` 안의 같은 호출도 모두 바꾼다(`grep -n "tilePassability(" src/project/collision.ts`).

- [ ] **Step 4: `tilePassabilityComponents.ts:227-228`** — `map.lowerTiles`/`map.upperTiles` 를 칸 단위로 읽는 곳을 `layeredPassability(tileset, cellLayerTiles(map, i))` 로 바꾼다(스택 top 처리가 있으면 `withStackTops` 와 같은 식으로 유지).

- [ ] **Step 5: Run (허락 시)** 같은 명령 + `test/tilePassabilityComponents.test.ts` — Expected: 모두 PASS.

- [ ] **Step 6: Commit (사용자가 시킬 때)** `git commit -m "feat(collision): 4층 통행 — 위에서부터 ★ 건너뛰기"`

---

### Task 4: 크기 바꾸기 · 밀기 · 복사/붙여넣기/영역 지우기

**Files:**
- Modify: `src/editor/actions.ts:210-250` (`resizeMap`)
- Modify: `src/editor/mapShiftActions.ts:20-30` (`applyMapShift`)
- Modify: `src/editor/editorState.ts:43-54` (`TileClipboardLayer`·`TileClipboard`)
- Modify: `src/editor/mapClipboard.ts:40-70, 126-157, 160-185`
- Test: `test/mapLayersEditing.test.ts`

**Interfaces:**
- Consumes: `remapExtraLayers`, `layerTileAt`, `setLayerTileAt`, `shadowAt`, `setShadowAt` (Task 1)
- Produces: `TileClipboardLayer.overlay?: number[]`, `TileClipboard.shadow?: number[]`

- [ ] **Step 1: 실패하는 테스트** — `test/mapLayersEditing.test.ts`

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resizeMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { store } from "@/project/store";

const id = () => store.getCurrent().startMapId;
const map = () => store.getCurrent().maps[id()];
const at = (x: number, y: number) => y * map().width + x;

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, tool: "select", layer: "lower", selection: null, clipboard: null });
  store.updateMapTiles(id(), (m) => {
    setLayerTileAt(m, 2, 1 * m.width + 1, 5);
    setLayerTileAt(m, 4, 1 * m.width + 1, 6);
    setShadowAt(m, 1 * m.width + 1, 9);
  });
});

describe("새 층 — 편집 동작", () => {
  it("크기 바꾸기는 남는 칸의 2·4층·그림자를 지킨다", () => {
    resizeMap(id(), 4, 4);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(5);
    expect(layerTileAt(map(), 4, at(1, 1))).toBe(6);
    expect(shadowAt(map(), at(1, 1))).toBe(9);
    expect(map().lowerOverlayTiles?.length).toBe(16);
  });
  it("밀기는 새 칸도 함께 민다", () => {
    expect(shiftMapContent(id(), { dx: 1, dy: 0 })).toBe(true);
    expect(layerTileAt(map(), 2, at(2, 1))).toBe(5);
    expect(shadowAt(map(), at(2, 1))).toBe(9);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(-1);
  });
  it("복사·붙여넣기는 2·4층·그림자를 옮긴다", () => {
    selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 1, height: 1 });
    expect(copySelection(id())).toBe(true);
    expect(pasteClipboard(id(), 5, 5)).toBe(true);
    expect(layerTileAt(map(), 2, at(5, 5))).toBe(5);
    expect(layerTileAt(map(), 4, at(5, 5))).toBe(6);
    expect(shadowAt(map(), at(5, 5))).toBe(9);
  });
  it("영역 지우기는 새 칸도 비운다", () => {
    selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 1, height: 1 });
    expect(clearSelectionRegion(id())).toBe(true);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(-1);
    expect(shadowAt(map(), at(1, 1))).toBe(0);
  });
});
```

> `MapShiftOffset` 의 실제 필드명은 `mapShiftActions.ts` 맨 위 타입을 보고 맞춘다.

- [ ] **Step 2: Run (허락 시)** `node scripts/run-vitest.mjs run test/mapLayersEditing.test.ts test/mapClipboardBothLayers.test.ts --configLoader bundle` — Expected: 새 파일 4개 FAIL, 기존 PASS.

- [ ] **Step 3: resize** — `resizeMap` 에서 `m.width = width;` **앞**에:

```ts
    remapExtraLayers(m, width, height, (target) => {
      const tx = target % width;
      const ty = Math.floor(target / width);
      return tx < minW && ty < minH ? ty * oldW + tx : -1;
    });
```

- [ ] **Step 4: shift** — `applyMapShift` 의 `replaceShiftedStacks(map, spec);` 다음 줄에:

```ts
  remapExtraLayers(map, spec.width, spec.height, (target) => {
    const x = (target % spec.width) - spec.dx;
    const y = Math.floor(target / spec.width) - spec.dy;
    return isInside(x, y, spec) ? y * spec.width + x : -1;
  });
```

- [ ] **Step 5: 클립보드 타입** — `editorState.ts`:

```ts
export interface TileClipboardLayer {
  tiles: number[];
  stacks: number[][];
  /** 2층(lower 묶음) 또는 4층(upper 묶음). 없으면 빈칸. */
  overlay?: number[];
}

export interface TileClipboard {
  width: number;
  height: number;
  lower: TileClipboardLayer;
  upper: TileClipboardLayer;
  /** 그림자 비트. 없으면 0. */
  shadow?: number[];
}
```

- [ ] **Step 6: 복사** — `copySelection` 루프에서:

```ts
  const lower = { tiles: [] as number[], stacks: [] as number[][], overlay: [] as number[] };
  const upper = { tiles: [] as number[], stacks: [] as number[][], overlay: [] as number[] };
  const shadow: number[] = [];
  for (let y = 0; y < selection.height; y++) {
    for (let x = 0; x < selection.width; x++) {
      const index = (selection.y + y) * map.width + selection.x + x;
      lower.tiles.push(map.lowerTiles[index]);
      lower.stacks.push([...tileStackAt(map, "lower", index)]);
      lower.overlay.push(layerTileAt(map, 2, index));
      upper.tiles.push(map.upperTiles[index]);
      upper.stacks.push([...tileStackAt(map, "upper", index)]);
      upper.overlay.push(layerTileAt(map, 4, index));
      shadow.push(shadowAt(map, index));
    }
  }
  editorState.set({ clipboard: { width: selection.width, height: selection.height, lower, upper, shadow } });
```

- [ ] **Step 7: 붙여넣기** — `pasteClipboard` 의 `for (const layer of CLIPBOARD_LAYERS)` 루프 다음에:

```ts
        setLayerTileAt(targetMap, 2, targetIndex, clipboard.lower.overlay?.[sourceIndex] ?? -1);
        setLayerTileAt(targetMap, 4, targetIndex, clipboard.upper.overlay?.[sourceIndex] ?? -1);
        setShadowAt(targetMap, targetIndex, clipboard.shadow?.[sourceIndex] ?? 0);
```

- [ ] **Step 8: 영역 지우기** — `clearSelectionRegion` 의 `replaceTileStack(targetMap, "upper", idx, []);` 다음에:

```ts
        setLayerTileAt(targetMap, 2, idx, -1);
        setLayerTileAt(targetMap, 4, idx, -1);
        setShadowAt(targetMap, idx, 0);
```

- [ ] **Step 9: Run (허락 시)** — Expected: PASS.

- [ ] **Step 10: Commit (사용자가 시킬 때)** `git commit -m "feat(editor): 크기·밀기·복사·지우기가 2층·4층·그림자를 다룬다"`

---

### Task 5: 게임 화면 — 2층·그림자·4층 그리기

**Files:**
- Modify: `src/player/playSceneMapRuntime.ts:211-219` (셀 루프), `:236` (`tilesHash`), `:319-329` (`applyTileDepth`), `:343-360` (`placeMapTileImage`), `:367-375` (빈칸 덮개), `:423-455` (`renderTile`)
- Modify: `src/player/characterDepth.ts` (오프셋 상수)
- Test: 기존 게임 렌더 테스트 옆에 `test/playSceneExtraLayers.test.ts` (가짜 scene 은 `grep -rln "renderTiles" test` 로 찾은 기존 테스트의 가짜 scene 을 그대로 가져온다)

**Interfaces:**
- Consumes: `layerTileAt`, `shadowAt` (Task 1)
- Produces: `export const OVERLAY_LAYER_DEPTH_OFFSET = 0.01; export const SHADOW_LAYER_DEPTH_OFFSET = 0.02;` (characterDepth.ts)

- [ ] **Step 1: 실패하는 테스트** — `test/playSceneExtraLayers.test.ts` (가짜 scene 모양은 `test/playSceneTileCulling.test.ts:147-187` 과 같다)

```ts
import { describe, expect, it } from "vitest";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { createBlankProject } from "@/project/defaults";
import { setLayerTileAt, setShadowAt } from "@/project/mapLayers";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { passageMarkForTile } from "@/project/tilesetPassage";

type Made = { kind: "image" | "rect"; x: number; y: number; frame?: string; depth?: number; w?: number; alpha?: number };

function sceneFor(map: ReturnType<typeof createBlankProject>["maps"][string], project: ReturnType<typeof createBlankProject>) {
  const made: Made[] = [];
  const obj = (m: Made) => {
    made.push(m);
    const o = { ...m, visible: true, setOrigin: () => o, setDepth: (d: number) => { m.depth = d; return o; }, play: () => o, setVisible: () => o, destroy: () => undefined };
    return o;
  };
  const scene = {
    map, session: startSession(project), eventPositions: {},
    tileLayer: { removeAll: () => undefined, add: () => undefined },
    upperTileLayer: { removeAll: () => undefined, add: () => undefined },
    eventSprites: new Map(),
    runtimeDom: { clearEventMarkers: () => undefined, upsertEventMarker: () => undefined, syncMissingResourceError: () => undefined },
    missingResources: new Set<string>(),
    add: {
      image: (x: number, y: number, _t: string, frame: string) => obj({ kind: "image", x, y, frame }),
      sprite: (x: number, y: number, _t: string, frame: string) => obj({ kind: "image", x, y, frame }),
      rectangle: (x: number, y: number, w: number, _h: number, _c: number, alpha: number) => obj({ kind: "rect", x, y, w, alpha }),
    },
    runEvent: async () => undefined, syncRuntimeState: () => undefined,
  };
  return { scene, made };
}

describe("게임 화면 — 2층·그림자·4층", () => {
  it("깊이: 2층 = y*2+0.01, 그림자 = y*2+0.02, 4층 = 3층 값+0.01", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const tileset = project.tilesets[map.tilesetId];
    const o = [...Array(tileset.count).keys()].filter((t) => passageMarkForTile(tileset, t) === "o");
    const [A, B, C] = [o[1], o[2], o[3]];
    map.upperTiles.fill(-1);
    const y = 2, i = y * map.width + 1;
    setLayerTileAt(map, 2, i, A);
    setLayerTileAt(map, 3, i, B);
    setLayerTileAt(map, 4, i, C);
    setShadowAt(map, i, 0b0001);
    store.replace(project);
    const { scene, made } = sceneFor(map, project);
    renderTiles(scene as never);
    const at = (frame: string) => made.filter((m) => m.frame === frame && m.y === y * map.tileSize);
    expect(at(`tile_${A}`).at(-1)?.depth).toBeCloseTo(y * 2 + 0.01);
    expect(at(`tile_${C}`).at(-1)!.depth!).toBeCloseTo(at(`tile_${B}`).at(-1)!.depth! + 0.01);
    const shade = made.filter((m) => m.kind === "rect" && m.alpha === 0.5);
    expect(shade).toHaveLength(1);
    expect(shade[0]).toMatchObject({ x: 1 * map.tileSize, y: y * map.tileSize, w: map.tileSize / 2 });
    expect(shade[0].depth).toBeCloseTo(y * 2 + 0.02);
  });

  it("2층만 바뀌어도 다시 그린다(tilesHash)", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    store.replace(project);
    const { scene, made } = sceneFor(map, project);
    renderTiles(scene as never);
    const first = made.length;
    setLayerTileAt(map, 2, 0, 1);
    renderTiles(scene as never);
    expect(made.length).toBeGreaterThan(first * 2 - 1);
  });
});
```
> `map.tileSize` 대신 렌더러가 쓰는 `mapTileSize(map)` 가 다르면 그 값으로 맞춘다. 기본 타일셋에 ○ 타일이 4개 미만이면 `o` 를 만들 때 `passability` 를 직접 바꾼 사본 타일셋을 쓴다.

- [ ] **Step 2: Run (허락 시)** — Expected: FAIL.

- [ ] **Step 3: 오프셋 상수** — `characterDepth.ts` 에:

```ts
/** 같은 묶음 안에서 위 층을 조금 위로(설계 §3). 가구 × 가 같은 줄 캐릭터 앞으로 튀지 않게 아주 작게 둔다. */
export const OVERLAY_LAYER_DEPTH_OFFSET = 0.01;
/** 그림자는 2층 위, 3층 밑(lower 컨테이너 안). */
export const SHADOW_LAYER_DEPTH_OFFSET = 0.02;
```

- [ ] **Step 4: 깊이에 오프셋** — `applyTileDepth` 와 `placeMapTileImage` 에 `depthOffset = 0` 인자를 끝에 더하고 `image.setDepth(y * 2 + depthOffset)` / `image.setDepth(mapUpperTileDepth(tileset, tile, y, tileSize) + depthOffset)` 로 바꾼다.

- [ ] **Step 5: 원래 모양 그리기 경로** — `renderTile` 끝부분(애니메이션/이미지 생성)을 함수로 빼서 2·4층이 쓴다:

```ts
function renderRawTile<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  tileset: TilesetDef,
  x: number,
  y: number,
  tile: number,
  layer: "lower" | "upper",
  depthOffset: number,
): void {
  if (tile < 0) return;
  const textureKey = scene.resolveTilesetTexture?.(tileset) ?? tilesetTextureKey(tileset);
  const baseAnimationKey = tilesetAnimationKeyForTile(tileset, tile);
  const animationKey = baseAnimationKey ? chipsetAnimationKey(textureKey, baseAnimationKey) : null;
  const size = mapTileSize(scene.map);
  const image = animationKey
    ? scene.add.sprite(x * size, y * size, textureKey, `tile_${tile}`).play(animationKey)
    : scene.add.image(x * size, y * size, textureKey, `tile_${tile}`);
  placeMapTileImage(scene, image, tileset, tile, x, y, layer, depthOffset);
}
```
`renderTile` 의 마지막 세 줄은 `renderRawTile(scene, tileset, x, y, tile, layer, 0)` 호출로 바꾼다.

- [ ] **Step 6: 그림자** —

```ts
function renderShadow<TImage extends RenderedTileImage, TSprite extends RenderedEventSprite>(
  scene: RenderTilesSceneContext<TImage, TSprite>,
  x: number,
  y: number,
  bits: number,
): void {
  if (bits === 0 || typeof scene.add.rectangle !== "function") return;
  const size = mapTileSize(scene.map);
  const half = size / 2;
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (!(bits & (1 << quarter))) continue;
    const rect = scene.add.rectangle(x * size + (quarter % 2) * half, y * size + Math.floor(quarter / 2) * half, half, half, 0x000000, 0.5);
    rect.setOrigin(0, 0);
    rect.setDepth(y * 2 + SHADOW_LAYER_DEPTH_OFFSET);
    scene.tileLayer.add(rect);
    trackCullableTile(rootYSortHost(scene), rect, x, y);
  }
}
```

- [ ] **Step 7: 셀 루프** — `renderTiles` 의 칸 루프를:

```ts
      renderEmptyCellCover(scene, x, y, index);
      renderTile(scene, tileset, x, y, map.lowerTiles[index], "lower");
      for (const tile of tileStackAt(map, "lower", index)) renderTile(scene, tileset, x, y, tile, "lower");
      renderRawTile(scene, tileset, x, y, layerTileAt(map, 2, index), "lower", OVERLAY_LAYER_DEPTH_OFFSET);
      renderShadow(scene, x, y, shadowAt(map, index));
      renderTile(scene, tileset, x, y, map.upperTiles[index], "upper");
      for (const tile of tileStackAt(map, "upper", index)) renderTile(scene, tileset, x, y, tile, "upper");
      renderRawTile(scene, tileset, x, y, layerTileAt(map, 4, index), "upper", OVERLAY_LAYER_DEPTH_OFFSET);
```

- [ ] **Step 8: 재생성 해시** — `tilesHash: hashTiles(map.width, map.height, map.lowerTiles, map.upperTiles, map.lowerOverlayTiles ?? [], map.upperOverlayTiles ?? [], map.shadowBits ?? [])`. `hashTiles` 가 가변 인자로 배열마다 길이를 섞는지 확인한다(빈 배열과 "없음" 이 같게 취급돼도 무방).

- [ ] **Step 9: 빈칸 덮개** — `renderEmptyCellCover` 는 1층만 본다(2층만 있는 칸도 바탕은 가린다). 바꾸지 않는다.

- [ ] **Step 10: Run (허락 시)** 새 테스트 + `grep -rln "renderTiles\|playSceneMapRuntime" test` 로 찾은 기존 테스트 — Expected: PASS.

- [ ] **Step 11: Commit (사용자가 시킬 때)** `git commit -m "feat(player): 2층·그림자·4층을 그린다"`

---

### Task 6: 에디터 화면 — 같은 순서로 그리기

**Files:**
- Modify: `src/editor/editSceneRender.ts:284-330` (`renderTileCellLayer`)
- Test: `test/editSceneRender.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: `layerTileAt`, `shadowAt` (Task 1)

- [ ] **Step 1: 실패하는 테스트** — `editSceneRender.test.ts` 의 기존 가짜 scene 도우미로:

```ts
function renderOneCell(extra: { overlay?: number; upperOverlay?: number; shadow?: number }, layer: Layer = "lower") {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 1;
  map.height = 1;
  map.lowerTiles = [1];
  map.upperTiles = [3];
  if (extra.overlay !== undefined) map.lowerOverlayTiles = [extra.overlay];
  if (extra.upperOverlay !== undefined) map.upperOverlayTiles = [extra.upperOverlay];
  if (extra.shadow !== undefined) map.shadowBits = [extra.shadow];
  map.events = [];
  store.replace(project);
  editorState.set({ currentMapId: map.id, layer, selectedEventId: null, selection: null, tool: "select" });
  const lower: MockObject[] = [];
  const upper: MockObject[] = [];
  renderEditScene({ scene: mockScene(), tileLayer: mockContainer(lower), upperTileLayer: mockContainer(upper), overlayLayer: mockContainer(), gridGraphics: mockGridGraphics(), mapId: map.id });
  return { lower, upper };
}

describe("새 층 — 에디터 그리기", () => {
  it("2층·그림자는 아래 묶음 끝에, 4층은 위 묶음 끝에 붙는다", () => {
    const base = renderOneCell({});
    const withExtra = renderOneCell({ overlay: 2, upperOverlay: 4, shadow: 0b1001 });
    expect(withExtra.lower.length).toBe(base.lower.length + 1 + 2);
    expect(withExtra.upper.length).toBe(base.upper.length + 1);
    const shades = withExtra.lower.slice(-2);
    expect(shades.every((o) => o.kind === "rectangle" && o.fillColor === 0x000000 && o.alpha === 0.5)).toBe(true);
    expect(shades.map((o) => [o.x, o.y])).toEqual([[0, 0], [8, 8]]);   // bit0 왼위, bit3 오른아래 (16px 칸)
    expect(["image", "sprite"]).toContain(withExtra.upper.at(-1)?.kind);   // 4층 타일이 위 묶음 마지막
  });

  it("위층 편집 중이면 2층·그림자도 1층처럼 흐리다", () => {
    const { lower } = renderOneCell({ overlay: 2, shadow: 0b0001 }, "upper");
    const overlay = lower.at(-2)!;
    const shade = lower.at(-1)!;
    expect(overlay.alpha).toBe(0.58);
    expect(shade.alpha).toBeCloseTo(0.5 * 0.58);
  });
});
```
> 칸 크기가 16px 이 아니면(기본 타일셋 tileSize) 기대 좌표를 `tileSize/2` 로 바꾼다. 1층 타일 1 이 지형 합성으로 여러 객체가 되면 기준(`base`)과의 차이만 보는 첫 단언은 그대로 성립한다.

- [ ] **Step 2: Run (허락 시)** `node scripts/run-vitest.mjs run test/editSceneRender.test.ts --configLoader bundle` — Expected: 새 케이스 FAIL.

- [ ] **Step 3: 구현** — `renderTileCellLayer` 의 lower 가지에서 스택 루프 다음에:

```ts
    const overlay = layerTileAt(map, 2, i);
    if (overlay >= 0) {
      const overlayTile = createChipsetTileObject(context.scene, map, tileset, x, y, overlay);
      overlayTile.setAlpha(lowerAlpha);
      if (activeLayer === "upper") tintIfPossible(overlayTile, 0xc8d9bf);
      addTileObject(context, objects, overlayTile, 1, "lower", x, y);
    }
    const bits = shadowAt(map, i);
    if (bits !== 0) {
      for (const shade of createShadowQuarters(context.scene, x, y, tileSize, bits)) {
        shade.setAlpha(0.5 * lowerAlpha);
        addTileObject(context, objects, shade, 2, "lower", x, y);
      }
    }
```
upper 가지의 스택 루프 다음에:

```ts
    const overlay = layerTileAt(map, 4, i);
    if (overlay >= 0) {
      const overlayTile = createChipsetTileObject(context.scene, map, tileset, x, y, overlay);
      if (dimUpper) tintIfPossible(overlayTile, 0xc8d9bf);
      addTileObject(context, objects, overlayTile, 21, "upper", x, y);
    }
```
같은 파일 아래쪽 `createEmptyTile` 옆에:

```ts
/** 그림자 조각(칸의 ¼)마다 검정 사각형 하나. 알파는 호출자가 정한다. */
function createShadowQuarters(scene: Phaser.Scene, x: number, y: number, tileSize: number, bits: number): Phaser.GameObjects.Rectangle[] {
  const half = tileSize / 2;
  const out: Phaser.GameObjects.Rectangle[] = [];
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (!(bits & (1 << quarter))) continue;
    const rect = scene.add.rectangle(x * tileSize + (quarter % 2) * half, y * tileSize + Math.floor(quarter / 2) * half, half, half, 0x000000);
    rect.setOrigin(0, 0);
    out.push(rect);
  }
  return out;
}
```
> `createChipsetTileObject` 가 1층 전용 지형 합성을 하는지 확인한다. 한다면 2·4층은 합성 없이 원래 모양을 만드는 함수(같은 파일에 이미 있는 raw 생성 경로)를 쓴다.

- [ ] **Step 4: Run (허락 시)** — Expected: PASS(기존 케이스 포함).

- [ ] **Step 5: Commit (사용자가 시킬 때)** `git commit -m "feat(editor): 에디터가 2층·그림자·4층을 그린다"`

---

### Task 7: 미리보기·썸네일

**Files:**
- Modify: `src/editor/mapTileDraw.ts:40-62` (스크린샷·장소 썸네일)
- Modify: `src/editor/panels/eventEditor/transferMapPreview.ts:45-55, 120-127`
- Modify: `src/editor/panels/tilesetAiTempMapImage.ts:15-22, 45-52`
- Modify: `src/editor/panels/mapThumbnail.ts:100-106` (썸네일 캐시 해시)
- Test: `test/mapTileDrawLayers.test.ts`

**Interfaces:**
- Consumes: `layerTileAt`, `shadowAt` (Task 1)
- Produces: `export function drawShadowQuarters(context: CanvasRenderingContext2D, x: number, y: number, size: number, bits: number): void` (mapTileDraw.ts, 다른 미리보기가 import)

```ts
import { describe, expect, it } from "vitest";
import { drawMapTileLayers, type TilesetCanvasImage } from "@/editor/mapTileDraw";
import { createBlankProject } from "@/project/defaults";
import type { TilesetDef } from "@/project/types";

// 지형 합성·받침이 없는 최소 커스텀 타일셋(4열 16px).
function plainTileset(): TilesetDef {
  const count = 16;
  const pass = { up: true, down: true, left: true, right: true };
  return {
    id: "plain", name: "plain", kind: "custom", image: { type: "uploaded", id: "plain_img" },
    tileSize: 16, tilesPerRow: 4, count,
    passability: Array.from({ length: count }, () => ({ ...pass })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
  } as TilesetDef;
}

it("그리는 순서는 1층 → 2층 → 그림자 → 3층 → 4층", () => {
  const project = createBlankProject();
  const map = { ...project.maps[project.startMapId], width: 1, height: 1, lowerTiles: [1], upperTiles: [3],
    lowerOverlayTiles: [2], upperOverlayTiles: [5], shadowBits: [0b0001], tilesetId: "plain" };
  const calls: string[] = [];
  const context = {
    drawImage: (...args: number[]) => calls.push(`img ${args[1]},${args[2]}`),   // 9인자: sx, sy 로 타일 식별
    fillRect: (x: number, y: number, w: number) => calls.push(`shade ${x},${y},${w}`),
    save: () => undefined, restore: () => undefined, fillStyle: "", imageSmoothingEnabled: false,
  } as unknown as CanvasRenderingContext2D;
  drawMapTileLayers(context, {} as TilesetCanvasImage, map, plainTileset(), 1);
  expect(calls).toEqual(["img 16,0", "img 32,0", "shade 0,0,8", "img 48,0", "img 16,16"]);
});
```
> `drawRawTile` 이 9인자 `drawImage` 가 아니면 기록 인덱스를 실제 호출에 맞춘다. `TilesetDef` 필수 칸이 더 있으면 `createBlankProject()` 의 타일셋을 복사해 `kind`·`tileSize`·`tilesPerRow`·`count` 만 바꾼다.

- [ ] **Step 2: Run (허락 시)** — Expected: FAIL.

- [ ] **Step 3: 구현** — `mapTileDraw.ts`

```ts
export function drawShadowQuarters(context: CanvasRenderingContext2D, x: number, y: number, size: number, bits: number): void {
  if (bits === 0) return;
  const half = size / 2;
  context.save();
  context.fillStyle = "rgba(0,0,0,0.5)";
  for (let quarter = 0; quarter < 4; quarter += 1) {
    if (bits & (1 << quarter)) context.fillRect(x * size + (quarter % 2) * half, y * size + Math.floor(quarter / 2) * half, half, half);
  }
  context.restore();
}
```
`drawMapTileLayer` 를 다음처럼 바꾼다(지형 합성 분기 `tiles === map.lowerTiles && …` 는 1층 전용으로 그대로):

```ts
export function drawMapTileLayer(
  context: CanvasRenderingContext2D, image: TilesetCanvasImage, map: GameMap,
  tileset: TilesetDef, layer: "lower" | "upper", scale: number,
): void {
  drawLayer(context, image, map, tileset, layer === "lower" ? map.lowerTiles : map.upperTiles, scale);
  drawStackLayer(context, image, map, tileset, layer, scale);
  const size = tileset.tileSize * scale;
  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    const overlay = layerTileAt(map, layer === "lower" ? 2 : 4, index);
    if (overlay >= 0) drawRawTile(context, image, tileset, overlay, x, y, scale);
  }
  if (layer !== "lower" || !map.shadowBits) return;
  for (let index = 0; index < map.width * map.height; index += 1) {
    drawShadowQuarters(context, index % map.width, Math.floor(index / map.width), size, shadowAt(map, index));
  }
}
```
(`drawRawTile` 의 칸 크기 계산이 `tileset.tileSize * scale` 가 아니면 같은 식을 쓴다.)
`transferMapPreview.ts`·`tilesetAiTempMapImage.ts` 는 스택 루프(`for (const tile of tileStackAt(...))`) 바로 다음 줄에 같은 두 호출(lower: 2층 + 그림자, upper: 4층)을 넣는다.
`mapThumbnail.ts` 해시에 `for (const tile of map.lowerOverlayTiles ?? []) mix(tile); for (const tile of map.upperOverlayTiles ?? []) mix(tile); for (const bits of map.shadowBits ?? []) mix(bits);` 를 더한다.

- [ ] **Step 4: Run (허락 시)** — Expected: PASS.

- [ ] **Step 5: Commit (사용자가 시킬 때)** `git commit -m "feat(editor): 미리보기·썸네일이 새 층을 그린다"`

---

### Task 8: Rasak 4층 시연 (저장소 밖 데이터, 저장소 안 스크립트)

PR ① 의 끝 확인: 합성 없이 4층 + 그림자로 싣은 Rasak 재현 맵이 에디터·게임에서 원본과 같게 보이는지.

**Files:**
- Create: `scripts/content/rasak/stack_to_layers.py` — `reconstruct_preview.py` 의 스택(`[A바닥, A장식, 그림자, B~E…]`)을 1·2층 / 그림자 / 3·4층으로 나눈다. 규칙: 1층 = 스택 첫 A, 2층 = 두 번째 A, 그림자 = 그림자 타일의 `bits`, 3층 = 첫 B~E/X, 4층 = 둘째 B~E/X. 다섯 장 이상이면 넘친 칸 목록을 출력하고 그 칸만 fold 합성으로 되돌린다.
- Modify: `scripts/content/rasak/publish-study-project.mjs` — `--layers` 옵션이면 `*.layers.map.json` 을 싣는다(새 칸 그대로).

- [ ] **Step 1:** 스크립트 작성 후 `python3 scripts/content/rasak/stack_to_layers.py --baked ~/third-party-assets/rasak/baked/rasak_swamp --maps ~/third-party-assets/rasak/maps` → 넘친 칸 수 출력(늪 612칸 중 5장 칸 1개였다).
- [ ] **Step 2:** `node scripts/content/rasak/publish-study-project.mjs --layers --baked … --maps … --project-dir ~/third-party-assets/rasak/study-project-layers` (빌드는 `npm run build:fast && npm run build:electron` 먼저).
- [ ] **Step 3:** `node scripts/oprn-serve.mjs --project-dir ~/third-party-assets/rasak/study-project-layers --port 9838` 을 Playwright 로 찍어 기존 fold 캡처(`/tmp/rasak/editor-*.png`)와 픽셀 비교 — 차이는 위층 물들임·격자선뿐이어야 한다.
- [ ] **Step 4:** 결과를 `~/claude-viz/mz-four-layer-pr1-check.html` 에 올리고 주소를 보고한다. 끝나면 9838 서버를 PID 로 끈다(`pkill -f` 금지 — 자기 셸을 죽인다).

---

### Task 9: 설계 문서 동기화

- [ ] `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md` §3 의 `+0.25`·`tileY*2+1.5`·`tileY*2+0.5` 를 Global Constraints 의 `+0.01`/`+0.02` 로 고친다.
- [ ] §12 위험의 "1번 PR 에서 먼저 `clearCell` 로 막는다" 를 "PR ① 에는 사람이 2·4층을 칠하는 길이 없어 새 칸은 가져오기로만 생긴다 — 생성기 정리는 PR ② 의 칠하기와 함께" 로 고친다.
- [ ] §7 조수 그림(`toolImageRenderer.ts`, `mapVisualEvidence.ts`)은 PR ④ 소관임을 §9 에 명시한다(PR ① 범위 밖).

---

## Self-Review

- **Spec 대응:** §2 데이터 → Task 1·2. §3 순서·깊이 → Task 5·6·7 (+ Task 9 로 숫자 정정). §4 통행 → Task 3. §8 "조용히 잃는 곳" 네 항목(store·shape·structuralJson/ledger·resize/shift/clipboard) → Task 2·4. §8 "그리는 곳" 중 조수 그림 두 파일은 PR ④ 로 넘김(Task 9 에 기록). §8 "비교·조수 경로"(ghost preview·agentFocus·mapDelta·regionTask) 는 PR ① 에서 새 칸을 쓰는 길이 가져오기뿐이라 PR ④ 로 — spec §9 에 반영 필요(Task 9 에 추가).
- **이름 일관성:** `layerTileAt`/`setLayerTileAt`/`shadowAt`/`setShadowAt`/`cellLayerTiles`/`cloneExtraLayers`/`remapExtraLayers`/`compactMapLayers`/`layeredPassability`/`OVERLAY_LAYER_DEPTH_OFFSET`/`SHADOW_LAYER_DEPTH_OFFSET`/`drawShadowQuarters` — Task 간 동일.
- **남은 확인(구현 첫 단계에서):** `shapeEventFields.ts` 공개 함수명, `isPassable` 인자 순서, `MapShiftOffset` 필드명, `createChipsetTileObject` 의 합성 여부, 게임 렌더 테스트의 가짜 scene 위치.
