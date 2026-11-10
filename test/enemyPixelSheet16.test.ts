/** @vitest-environment happy-dom */
// 16칸(4×4) 적 도트 시트: 칸 자리·빠진 칸 대체(pixelEnemyFrame), 스토어 형식 검사(grid·missingCells·칸 채움),
// 넣기(id 바꾸기·크기), 런타임 칸 선택(공격 중간·시전·막기·빈사·등장)과 3×3 시트가 예전 그대로인지.
import { createHash } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { storeMonsterSheetCellProblems, storeMonsterSheetSizeProblems, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { applyPackToProject } from "@/assetStore/pack";
import { pngSize } from "@/assetStore/sniff";
import {
  PIXEL_ENEMY_FRAME, monsterBattleCells, pixelEnemyBackgroundPosition, pixelEnemyFrame, pixelEnemyHasCell, projectPixelEnemySheet, type PixelEnemySheet,
} from "@/assets/pixelEnemySheets";
import { retroMonster16Cell, retroMonsterSkillCellKind } from "@/battle/retroSkillTimeline";
import { createBattleRuntime } from "@/battle/runtime";
import { battleField } from "@/player/battleFieldDom";
import { retroActionMotion, retroBattleIntro, retroDamage, retroPixelEnemyCell, retroTimelineEntry } from "@/player/battleRetroMotion";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

const sheet16 = (missingCells: number[] = []): Pick<PixelEnemySheet, "grid" | "missingCells" | "skillCell"> => ({ grid: "4x4", missingCells, skillCell: true });

describe("16-cell frame map", () => {
  it("places cells by row-major index on a 4-wide grid and keeps 3×3 sheets exactly as before", () => {
    const full = sheet16();
    expect(pixelEnemyFrame(full, "idle_a")).toEqual({ col: 0, row: 0 });
    expect(pixelEnemyFrame(full, "windup")).toEqual({ col: 3, row: 0 });
    expect(pixelEnemyFrame(full, "move")).toEqual({ col: 0, row: 1 });
    expect(pixelEnemyFrame(full, "dead")).toEqual({ col: 0, row: 2 });
    expect(pixelEnemyFrame(full, "attack_mid")).toEqual({ col: 1, row: 2 });
    expect(pixelEnemyFrame(full, "cast_charge")).toEqual({ col: 2, row: 2 });
    expect(pixelEnemyFrame(full, "cast_release")).toEqual({ col: 3, row: 2 });
    expect(pixelEnemyFrame(full, "guard")).toEqual({ col: 0, row: 3 });
    expect(pixelEnemyFrame(full, "weak")).toEqual({ col: 1, row: 3 });
    expect(pixelEnemyFrame(full, "intro")).toEqual({ col: 2, row: 3 });
    // skillCell: skill → recover 칸(6), recover → move 칸(4) — 3×3 과 같은 규칙, 자리만 4열.
    expect(pixelEnemyFrame(full, "skill")).toEqual({ col: 2, row: 1 });
    expect(pixelEnemyFrame(full, "recover")).toEqual({ col: 0, row: 1 });
    expect(pixelEnemyBackgroundPosition(full, "intro")).toBe("66.667% 100%");
    // 3×3: 예전 표 그대로, 배경 위치는 50% 단위.
    for (const [name, at] of Object.entries(PIXEL_ENEMY_FRAME)) {
      if (name === "recover") continue;
      expect(pixelEnemyFrame({ skillCell: true }, name as keyof typeof PIXEL_ENEMY_FRAME)).toEqual(at);
    }
    expect(pixelEnemyBackgroundPosition(undefined, "attack")).toBe("100% 50%");
    expect(pixelEnemyFrame({ skillCell: true }, "skill")).toEqual(PIXEL_ENEMY_FRAME.recover);
  });

  it("keeps every 3x3 and 4x4 background position byte-identical to the pre-5x4 formula", () => {
    // 기대값은 예전 식(한 변 n 이면 칸당 100/(n-1)%, 소수 셋째 자리 반올림)으로 미리 계산해 박아 둔 문자열이다.
    const three = { idle_a: "0% 0%", idle_b: "50% 0%", idle_c: "100% 0%", windup: "0% 50%", move: "50% 50%", attack: "100% 50%", recover: "0% 100%", hit: "50% 100%", dead: "100% 100%", skill: "100% 50%" } as const;
    for (const [cell, position] of Object.entries(three)) {
      expect(pixelEnemyBackgroundPosition({ grid: "3x3" }, cell as keyof typeof three)).toBe(position);
      expect(pixelEnemyBackgroundPosition(undefined, cell as keyof typeof three)).toBe(position);
    }
    const four = {
      idle_a: "0% 0%", idle_b: "33.333% 0%", idle_c: "66.667% 0%", windup: "100% 0%", move: "0% 33.333%", attack: "33.333% 33.333%", recover: "66.667% 33.333%", hit: "100% 33.333%", dead: "0% 66.667%",
      attack_mid: "33.333% 66.667%", cast_charge: "66.667% 66.667%", cast_release: "100% 66.667%", guard: "0% 100%", weak: "33.333% 100%", intro: "66.667% 100%",
    } as const;
    for (const [cell, position] of Object.entries(four)) expect(pixelEnemyBackgroundPosition({ grid: "4x4" }, cell as keyof typeof four)).toBe(position);
    // 4x4 에는 5x4 전용 칸이 없다 — 예전처럼 기본 칸으로 물린다.
    expect(pixelEnemyHasCell({ grid: "4x4" }, "stunned")).toBe(false);
    expect(pixelEnemyBackgroundPosition({ grid: "4x4" }, "move_b")).toBe(four.move);
  });

  it("places 5x4 cells 15..19 on a 5-wide grid and falls back for missing ones", () => {
    const full: Pick<PixelEnemySheet, "grid" | "missingCells"> = { grid: "5x4", missingCells: [] };
    expect(pixelEnemyBackgroundPosition(full, "intro")).toBe("100% 66.667%");
    expect(pixelEnemyBackgroundPosition(full, "move_b")).toBe("0% 100%");
    expect(pixelEnemyBackgroundPosition(full, "hit_b")).toBe("25% 100%");
    expect(pixelEnemyBackgroundPosition(full, "attack_b")).toBe("50% 100%");
    expect(pixelEnemyBackgroundPosition(full, "stunned")).toBe("75% 100%");
    expect(pixelEnemyBackgroundPosition(full, "enrage")).toBe("100% 100%");
    expect(pixelEnemyBackgroundPosition(full, "weak")).toBe("75% 66.667%");
    expect(pixelEnemyBackgroundPosition(full, "idle_b")).toBe("25% 0%");
    // 빠진 칸은 move_b → move, hit_b → hit, attack_b → attack 으로 물린다.
    const missing: Pick<PixelEnemySheet, "grid" | "missingCells"> = { grid: "5x4", missingCells: [15, 16, 17] };
    expect(pixelEnemyBackgroundPosition(missing, "attack_b")).toBe(pixelEnemyBackgroundPosition(missing, "attack"));
    expect(pixelEnemyBackgroundPosition(missing, "attack_b")).toBe("0% 33.333%");
    expect(pixelEnemyBackgroundPosition(missing, "move_b")).toBe(pixelEnemyBackgroundPosition(missing, "move"));
    expect(pixelEnemyBackgroundPosition(missing, "hit_b")).toBe(pixelEnemyBackgroundPosition(missing, "hit"));
    expect(pixelEnemyHasCell(missing, "hit_b")).toBe(false);
    expect(pixelEnemyHasCell(missing, "enrage")).toBe(true);
  });

  it("falls back for missing cells: attack_mid → attack, cast_charge → windup, cast_release → attack, guard/weak/intro → idle_a", () => {
    const none = sheet16([9, 10, 11, 12, 13, 14]);
    expect(pixelEnemyFrame(none, "attack_mid")).toEqual(pixelEnemyFrame(none, "attack"));
    expect(pixelEnemyFrame(none, "cast_charge")).toEqual(pixelEnemyFrame(none, "windup"));
    expect(pixelEnemyFrame(none, "cast_release")).toEqual(pixelEnemyFrame(none, "attack"));
    for (const cell of ["guard", "weak", "intro"] as const) {
      expect(pixelEnemyFrame(none, cell)).toEqual({ col: 0, row: 0 });
      expect(pixelEnemyHasCell(none, cell)).toBe(false);
    }
    // 3×3 시트는 확장 칸이 하나도 없다.
    expect(pixelEnemyHasCell({}, "guard")).toBe(false);
    expect(pixelEnemyFrame({}, "cast_release")).toEqual(PIXEL_ENEMY_FRAME.attack);
    expect(pixelEnemyHasCell(sheet16([12]), "weak")).toBe(true);
  });

  it("routes monster skills: physical keeps 9-cell names, magic casts, self defense guards", () => {
    const raises = (stateId: string) => stateId === "state_defense_up";
    expect(retroMonsterSkillCellKind({ scope: "enemy", effect: { kind: "damage", statistic: "attack", affects: "hp" } }, raises)).toBe("physical");
    expect(retroMonsterSkillCellKind({ scope: "allEnemies", effect: { kind: "damage", statistic: "mind", affects: "hp" } }, raises)).toBe("cast");
    expect(retroMonsterSkillCellKind({ scope: "self", effect: { kind: "support" }, stateEffects: [{ stateId: "state_defense_up", chance: 100, operation: "add" }] }, raises)).toBe("guard");
    expect(retroMonsterSkillCellKind({ scope: "self", effect: { kind: "support" }, stateEffects: [{ stateId: "state_attack_up", chance: 100, operation: "add" }] }, raises)).toBe("cast");
    expect(retroMonster16Cell("windup", "cast")).toBe("cast_charge");
    expect(retroMonster16Cell("skill", "cast")).toBe("cast_release");
    expect(retroMonster16Cell("move", "cast")).toBe("move");
    expect(retroMonster16Cell("skill", "guard")).toBe("guard");
    expect(retroMonster16Cell("windup", "physical")).toBe("windup");
  });
});

// ── 스토어 형식 ───────────────────────────────────────────────────────────────────────

/** 가짜 PNG(크기 머리만). 칸 채움 검사는 decode 콜백으로 따로 준다. */
function pngHeader(width: number, height: number, salt = 0): Uint8Array {
  const bytes = new Uint8Array(33 + salt);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function pack(patch: Record<string, unknown> = {}, sheetSize = 256, frames = 16, portraitSize = 64, sheetHeight = sheetSize): { manifest: StorePackManifest; blobs: Map<string, Uint8Array>; sheetSha: string } {
  const portrait = pngHeader(portraitSize, portraitSize, 1);
  const sheet = pngHeader(sheetSize, sheetHeight, 2);
  const blobs = new Map([[sha(portrait), portrait], [sha(sheet), sheet]]);
  const manifest: StorePackManifest = {
    schema: "oprn-store-pack/1", title: "Slimes", summary: "", description: "", tags: [], kind: "battler", license: "OPRN-GAME", aiGenerated: true, credits: "AI",
    content: {
      assets: {
        slime: {
          id: "slime", name: "Slime", kind: "monster", blob: sha(portrait), mime: "image/png",
          meta: { width: 64, height: 64, pixelEnemySheet: { sheetResourceId: "slime-sheet", cell: 64, motion: "hop", idleFrameMs: 200, grid: "4x4", ...patch } as never },
        },
        "slime-sheet": { id: "slime-sheet", name: "Slime sheet", kind: "picture", blob: sha(sheet), mime: "image/png", meta: { width: sheetSize, height: sheetHeight, frameWidth: 64, frameHeight: 64, frames } },
      },
      tilesets: {},
    },
    previews: [sha(portrait)],
    blobs: [...blobs].map(([key, bytes]) => ({ sha256: key, mime: "image/png" as const, bytes: bytes.byteLength })),
  };
  return { manifest, blobs, sheetSha: sha(sheet) };
}

/** 칸 번호 목록만 채운 RGBA 4×4 시트(cell 4px — 칸 검사는 크기를 manifest cell 로 본다). */
function rgbaSheet(cell: number, filled: readonly number[]): { width: number; height: number; data: Uint8Array } {
  const width = cell * 4;
  const data = new Uint8Array(width * width * 4);
  for (const index of filled) {
    const x = (index % 4) * cell + Math.floor(cell / 2);
    const y = Math.floor(index / 4) * cell + Math.floor(cell / 2);
    data[(y * width + x) * 4 + 3] = 255;
  }
  return { width, height: width, data };
}
const range = (n: number) => Array.from({ length: n }, (_, index) => index);

/** 열·행 수가 다른 시트(5x4)용 RGBA 시트. */
function rgbaGrid(cell: number, cols: number, rows: number, filled: readonly number[]): { width: number; height: number; data: Uint8Array } {
  const width = cell * cols;
  const height = cell * rows;
  const data = new Uint8Array(width * height * 4);
  for (const index of filled) {
    const x = (index % cols) * cell + Math.floor(cell / 2);
    const y = Math.floor(index / cols) * cell + Math.floor(cell / 2);
    data[(y * width + x) * 4 + 3] = 255;
  }
  return { width, height, data };
}

describe("store format for 16-cell sheets", () => {
  it("accepts grid 4x4 with missingCells 9..14 and rejects bad grid / missingCells / frames", () => {
    expect(validateManifest(pack().manifest).ok).toBe(true);
    expect(validateManifest(pack({ missingCells: [9, 12] }).manifest).ok).toBe(true);
    const errors = (patch: Record<string, unknown>, frames = 16) => {
      const result = validateManifest(pack(patch, 256, frames).manifest);
      return result.ok ? "" : result.errors.join("\n");
    };
    expect(errors({ grid: "5x5" })).toContain("grid");
    expect(errors({ missingCells: [3] })).toContain("missingCells");
    expect(errors({ missingCells: [15] })).toContain("missingCells");
    expect(errors({ missingCells: [9, 9] })).toContain("missingCells");
    expect(errors({ missingCells: "9" })).toContain("missingCells");
    expect(errors({ grid: undefined, missingCells: [9] }, 9)).toContain("4x4");
    expect(errors({}, 9)).toContain("frames");
    // 3×3 판(grid 생략)은 frames 9 그대로 통과.
    expect(validateManifest(pack({ grid: undefined }, 192, 9).manifest).ok).toBe(true);
  });

  it("checks sheet size 4cell×4cell for grid 4x4 at install", () => {
    const ok = pack();
    expect(storeMonsterSheetSizeProblems(ok.manifest, (key) => pngSize(ok.blobs.get(key)!))).toEqual([]);
    const small = pack({}, 192);
    expect(storeMonsterSheetSizeProblems(small.manifest, (key) => pngSize(small.blobs.get(key)!)).join()).toContain("256×256");
    const empty = { tilesets: {}, assets: { uploaded: {} }, database: {}, resourceProfiles: [] } as unknown as Project;
    const context = { slug: "oprn-slimes", version: 1, author: "OPRN", storeUrl: "https://s", itemUrl: "https://s/i", blob: (key: string) => small.blobs.get(key)! };
    expect(() => applyPackToProject(empty, small.manifest, context)).toThrow("256×256");
  });

  it.each([[128, "3x3"], [192, "4x4"], [256, "3x3"], [256, "4x4"]] as const)("accepts big cell %s (%s) with a cell×cell portrait and n·cell sheet", (cell, grid) => {
    const side = grid === "4x4" ? 4 : 3;
    const big = pack({ cell, ...(grid === "3x3" ? { grid: undefined } : {}) }, cell * side, side * side, cell);
    expect(validateManifest(big.manifest).ok).toBe(true);
    expect(storeMonsterSheetSizeProblems(big.manifest, (key) => pngSize(big.blobs.get(key)!))).toEqual([]);
  });

  it("requires cells 0..8 and unlisted 9..14 drawn, listed missing cells and cell 15 fully transparent", () => {
    const { manifest, sheetSha } = pack({ cell: 4 } as never);
    manifest.content.assets["slime-sheet"]!.meta = { width: 16, height: 16, frameWidth: 4, frameHeight: 4, frames: 16 };
    const check = (filled: readonly number[], missing?: number[]) => {
      const sheet = manifest.content.assets.slime!.meta.pixelEnemySheet!;
      sheet.missingCells = missing;
      return storeMonsterSheetCellProblems(manifest, (key) => (key === sheetSha ? rgbaSheet(4, filled) : null));
    };
    expect(check(range(15))).toEqual([]);
    expect(check(range(16)).join()).toContain("15번");
    expect(check(range(15).filter((index) => index !== 12)).join()).toContain("12번 칸이 비어");
    expect(check(range(15).filter((index) => index !== 12), [12])).toEqual([]);
    expect(check(range(15), [12]).join()).toContain("12번 칸은 missingCells");
    expect(check(range(15).filter((index) => index !== 4)).join()).toContain("4번 칸이 비어");
    // 3×3 시트·풀 수 없는 그림은 건너뛴다.
    expect(storeMonsterSheetCellProblems(manifest, () => null)).toEqual([]);
  });

  it("accepts a 5x4 pack (320x256 sheet, 20 frames) and rejects a wrong size, wrong frames or out-of-range missingCells", () => {
    const ok = pack({ grid: "5x4" }, 320, 20, 64, 256);
    expect(validateManifest(ok.manifest).ok).toBe(true);
    expect(validateManifest(pack({ grid: "5x4", missingCells: [9, 15, 19] }, 320, 20, 64, 256).manifest).ok).toBe(true);
    expect(storeMonsterSheetSizeProblems(ok.manifest, (key) => pngSize(ok.blobs.get(key)!))).toEqual([]);
    const square = pack({ grid: "5x4" }, 256, 20, 64, 256);
    expect(storeMonsterSheetSizeProblems(square.manifest, (key) => pngSize(square.blobs.get(key)!)).join()).toContain("320×256");
    const errors = (patch: Record<string, unknown>, frames: number) => {
      const result = validateManifest(pack(patch, 320, frames, 64, 256).manifest);
      return result.ok ? "" : result.errors.join("\n");
    };
    expect(errors({ grid: "5x4" }, 16)).toContain("frames");
    expect(errors({ grid: "5x4", missingCells: [20] }, 20)).toContain("missingCells");
    expect(errors({ grid: "5x4", missingCells: [8] }, 20)).toContain("missingCells");
    // 4x4 에서 15 를 missingCells 로 적는 것은 예전처럼 거절된다.
    expect(errors({ grid: "4x4", missingCells: [15] }, 16)).toContain("missingCells");
  });

  it("checks 5x4 cell fill: all 20 drawn unless listed missing, no reserved cell", () => {
    const { manifest, sheetSha } = pack({ grid: "5x4", cell: 4 } as never, 20, 20, 4, 16);
    const check = (filled: readonly number[], missing?: number[]) => {
      manifest.content.assets.slime!.meta.pixelEnemySheet!.missingCells = missing;
      return storeMonsterSheetCellProblems(manifest, (key) => (key === sheetSha ? rgbaGrid(4, 5, 4, filled) : null));
    };
    expect(check(range(20))).toEqual([]);
    expect(check(range(20).filter((index) => index !== 17)).join()).toContain("17번 칸이 비어");
    expect(check(range(20).filter((index) => index !== 17), [17])).toEqual([]);
    expect(check(range(20), [17]).join()).toContain("17번 칸은 missingCells");
    expect(check(range(20).filter((index) => index !== 2)).join()).toContain("2번 칸이 비어");
  });

  it("rewrites the sheet id at install and the runtime reads grid + missingCells", () => {
    const { manifest, blobs } = pack({ missingCells: [12, 13] });
    const project = createBlankProject();
    applyPackToProject(project, manifest, { slug: "oprn-slimes", version: 1, author: "OPRN", storeUrl: "https://s", itemUrl: "https://s/i", blob: (key) => blobs.get(key)! });
    const id = "store_oprn_slimes__slime";
    expect(project.assets.uploaded[id]?.meta.pixelEnemySheet).toMatchObject({ sheetResourceId: "store_oprn_slimes__slime-sheet", grid: "4x4", missingCells: [12, 13] });
    const runtime = projectPixelEnemySheet(id, project);
    expect(runtime).toMatchObject({ grid: "4x4", missingCells: [12, 13], motion: "hop" });
    expect(monsterBattleCells(project, id)).toBe(16);
    expect(monsterBattleCells(project, "generated-enemy-slime-01")).toBe(9);
  });
});

// ── 런타임 칸 선택 ───────────────────────────────────────────────────────────────────

const ONE_PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const VARIANTS: Readonly<Record<string, number[]>> = { full: [], noMid: [9], noGuardWeakIntro: [12, 13, 14] };
const VARIANTS_20: Readonly<Record<string, number[]>> = { full: [], noStunEnrage: [18, 19], noHitB: [16] };

/** 16칸 시트 세 벌(빠진 칸만 다르다)을 실은 프로젝트를 한 번만 만든다 — 부하가 큰 기계에서 시험마다 직렬화하면 15초를 넘긴다. */
beforeAll(() => {
  const project = createBlankProject();
  project.system.battleUiStyle = "retro2003";
  project.system.battleModel = "rm2k3";
  for (const [variant, missingCells] of Object.entries(VARIANTS)) {
    project.assets.uploaded[`golem16-${variant}`] = {
      id: `golem16-${variant}`, name: "Golem 16", kind: "monster", dataUrl: ONE_PX,
      meta: { width: 64, height: 64, pixelEnemySheet: { sheetResourceId: `golem16-${variant}-sheet`, cell: 64, motion: "stomp", idleFrameMs: 300, skillCell: true, grid: "4x4", missingCells } },
    };
    project.assets.uploaded[`golem16-${variant}-sheet`] = { id: `golem16-${variant}-sheet`, name: "Golem 16 sheet", kind: "picture", dataUrl: ONE_PX, meta: { width: 256, height: 256, frameWidth: 64, frameHeight: 64, frames: 16 } };
  }
  for (const [variant, missingCells] of Object.entries(VARIANTS_20)) {
    project.assets.uploaded[`golem20-${variant}`] = {
      id: `golem20-${variant}`, name: "Golem 20", kind: "monster", dataUrl: ONE_PX,
      meta: { width: 64, height: 64, pixelEnemySheet: { sheetResourceId: `golem20-${variant}-sheet`, cell: 64, motion: "stomp", idleFrameMs: 300, skillCell: true, grid: "5x4", missingCells } },
    };
    project.assets.uploaded[`golem20-${variant}-sheet`] = { id: `golem20-${variant}-sheet`, name: "Golem 20 sheet", kind: "picture", dataUrl: ONE_PX, meta: { width: 320, height: 256, frameWidth: 64, frameHeight: 64, frames: 20 } };
  }
  store.replace(deserialize(serialize(project)));
}, 180_000);

/** 골렘 적이 16칸 프로젝트 시트(variant)를 쓰게 한 전투 필드. */
function field16(variant: keyof typeof VARIANTS = "full", prefix: "golem16" | "golem20" = "golem16"): { field: HTMLElement; golem: HTMLElement; image: HTMLElement; runtime: ReturnType<typeof createBattleRuntime> } {
  document.body.replaceChildren();
  const golemRecord = store.getCurrent().database.enemies.find((entry) => entry.id === "enemy_stone_golem")!;
  golemRecord.monsterResourceId = `${prefix}-${variant}`;
  const runtime = createBattleRuntime({ project: store.getCurrent(), troopId: "troop_golem_guard", canEscape: true, canLose: false, rng: () => 0 });
  const field = battleField(runtime.snapshot());
  document.body.append(field);
  const golem = field.querySelector<HTMLElement>('[data-record-id="enemy_stone_golem"]')!;
  return { field, golem, image: golem.querySelector<HTMLElement>(".battle-enemy-image")!, runtime };
}

// happy-dom 의 Web Animation 은 cancel 때 finished 를 거절해 처리되지 않은 오류를 남긴다. 칸 선택만 보므로 이동 애니메이션은 끈다.
const nativeAnimate = HTMLElement.prototype.animate;
beforeEach(() => {
  vi.useFakeTimers();
  (HTMLElement.prototype as { animate?: unknown }).animate = undefined;
});
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
  HTMLElement.prototype.animate = nativeAnimate;
});

describe("16-cell runtime cells", { timeout: 90_000 }, () => {
  it("marks the node 4x4 and positions cells on the 400% grid", () => {
    const { golem, image } = field16();
    expect(golem.dataset.pixelGrid).toBe("4x4");
    expect(golem.dataset.pixelEnemy).toBe("stomp");
    retroDamage(golem, { targetId: golem.dataset.testid ?? "", amount: 5, critical: false, healing: false }, false);
    expect(image.dataset.pixelCell).toBe("hit");
    // hit = 7 → 열 3·행 1.
    expect(image.style.backgroundPosition).toBe("100% 33.333%");
  });

  it("guards while defending: a brief guard cell before the hit, and the guard cell at rest", () => {
    const { golem, image } = field16();
    golem.dataset.battlerDefending = "true";
    expect(retroPixelEnemyCell(golem)).toBe("guard");
    retroDamage(golem, { targetId: golem.dataset.testid ?? "", amount: 5, critical: false, healing: false }, false);
    expect(image.dataset.pixelCell).toBe("guard");
    vi.advanceTimersByTime(170);
    expect(image.dataset.pixelCell).toBe("hit");
  });

  it("weak replaces the idle loop at HP ≤ 25%, and missing guard/weak/intro cells simply do nothing", () => {
    const full = field16();
    full.golem.dataset.battlerWeak = "true";
    expect(retroPixelEnemyCell(full.golem)).toBe("idle");
    expect(full.golem.dataset.pixelWeak).toBe("true");
    const missing = field16("noGuardWeakIntro");
    missing.golem.dataset.battlerWeak = "true";
    missing.golem.dataset.battlerDefending = "true";
    expect(retroPixelEnemyCell(missing.golem)).toBe("idle");
    expect(missing.golem.dataset.pixelWeak).toBeUndefined();
    retroDamage(missing.golem, { targetId: missing.golem.dataset.testid ?? "", amount: 5, critical: false, healing: false }, false);
    expect(missing.image.dataset.pixelCell).toBe("hit");
    retroBattleIntro(missing.field);
    vi.advanceTimersByTime(200);
    expect(missing.image.dataset.pixelCell).toBe("hit");
  });

  it("plays intro once at battle start, staggered, then returns to idle", () => {
    const { field, golem, image } = field16();
    retroBattleIntro(field);
    expect(image.dataset.pixelCell).toBe("idle");
    vi.advanceTimersByTime(130);
    expect(retroPixelEnemyCell(golem)).toBe("intro");
    expect(image.style.backgroundPosition).toBe("66.667% 100%");
    vi.advanceTimersByTime(600);
    expect(image.dataset.pixelCell).toBe("idle");
  });

  it("rest cell priority on a 5x4 sheet: guard > stunned > weak > enrage > idle, and 4x4 / missing cells ignore stunned and enrage", () => {
    const full = field16("full", "golem20");
    expect(full.golem.dataset.pixelGrid).toBe("5x4");
    const node = full.golem;
    node.dataset.battlerEnraged = "true";
    expect(retroPixelEnemyCell(node)).toBe("idle");
    expect(node.dataset.pixelEnrage).toBe("true");
    expect(node.dataset.pixelWeak).toBeUndefined();
    node.dataset.battlerWeak = "true";
    expect(retroPixelEnemyCell(node)).toBe("idle");
    expect(node.dataset.pixelWeak).toBe("true");
    expect(node.dataset.pixelEnrage).toBeUndefined();
    node.dataset.battlerRestricted = "true";
    expect(retroPixelEnemyCell(node)).toBe("stunned");
    expect(node.dataset.pixelWeak).toBeUndefined();
    expect(node.dataset.pixelEnrage).toBeUndefined();
    node.dataset.battlerDefending = "true";
    expect(retroPixelEnemyCell(node)).toBe("guard");
    const bare = field16("noStunEnrage", "golem20");
    bare.golem.dataset.battlerRestricted = "true";
    bare.golem.dataset.battlerEnraged = "true";
    expect(retroPixelEnemyCell(bare.golem)).toBe("idle");
    expect(bare.golem.dataset.pixelEnrage).toBeUndefined();
    const sixteen = field16("full");
    sixteen.golem.dataset.battlerRestricted = "true";
    sixteen.golem.dataset.battlerEnraged = "true";
    expect(retroPixelEnemyCell(sixteen.golem)).toBe("idle");
    expect(sixteen.golem.dataset.pixelEnrage).toBeUndefined();
  });

  it("alternates hit and hit_b on consecutive non-lethal hits of a 5x4 sheet; without hit_b it keeps hit", () => {
    const feedback = (golem: HTMLElement) => ({ targetId: golem.dataset.testid ?? "", amount: 5, critical: false, healing: false });
    const full = field16("full", "golem20");
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      retroDamage(full.golem, feedback(full.golem), false);
      seen.push(full.image.dataset.pixelCell ?? "");
    }
    expect(seen).toEqual(["hit", "hit_b", "hit"]);
    retroDamage(full.golem, feedback(full.golem), false);
    // hit_b = 칸 16 = 열 1·행 3 (5열 격자).
    expect(full.image.dataset.pixelCell).toBe("hit_b");
    expect(full.image.style.backgroundPosition).toBe("25% 100%");
    const bare = field16("noHitB", "golem20");
    for (let i = 0; i < 2; i += 1) {
      retroDamage(bare.golem, feedback(bare.golem), false);
      expect(bare.image.dataset.pixelCell).toBe("hit");
    }
  });

  it("normal attack shows windup → attack_mid → attack; without attack_mid it goes windup → attack", () => {
    for (const variant of ["full", "noMid"] as const) {
      const { field, golem, image, runtime } = field16(variant);
      const entry = { sequence: 1, kind: "action", side: "enemy", userId: golem.dataset.testid, userRecordId: "enemy_stone_golem", commandKind: "enemyAttack", targetId: "nobody" } as never;
      retroTimelineEntry(field, entry);
      retroActionMotion(field, { kind: "approach", userId: golem.dataset.testid!, durationMs: 1000 } as never, runtime.snapshot());
      const seen = new Set<string>([image.dataset.pixelCell ?? ""]);
      for (let t = 0; t < 1000; t += 25) { vi.advanceTimersByTime(25); seen.add(golem.dataset.retroPixelCell ?? ""); }
      retroActionMotion(field, { kind: "impact", userId: golem.dataset.testid!, durationMs: 200 } as never, runtime.snapshot());
      seen.add(golem.dataset.retroPixelCell ?? "");
      expect(seen.has("windup")).toBe(true);
      expect(seen.has("attack")).toBe(true);
      expect(seen.has("attack_mid")).toBe(variant === "full");
    }
  });

  it("keeps the attack cell readable (~200ms total) into the recover beat without changing beat lengths", () => {
    // impact 길이는 hit-stop(0 = 빗나감·무피해, 110 = 통상, 209 = 급소)이라 공격 칸이 번쩍 지나갔다. 모자란 만큼 recover 앞머리가 공격 칸을 이어 간다.
    for (const [impactMs, expectedHold] of [[0, 200], [110, 90], [209, 0]] as const) {
      const { field, golem, runtime } = field16("full", "golem20");
      const entry = { sequence: 1, kind: "action", side: "enemy", userId: golem.dataset.testid, userRecordId: "enemy_stone_golem", commandKind: "enemyAttack", targetId: "nobody" } as never;
      retroTimelineEntry(field, entry);
      const beat = (kind: "approach" | "impact" | "recover", durationMs: number) => retroActionMotion(field, { kind, userId: golem.dataset.testid!, durationMs } as never, runtime.snapshot());
      beat("approach", 300);
      vi.advanceTimersByTime(300);
      beat("impact", impactMs);
      expect(golem.dataset.retroPixelCell).toBe("attack");
      vi.advanceTimersByTime(impactMs);
      beat("recover", 500);
      // 공격 칸은 recover 의 첫 순간에도 그대로 보이고, expectedHold ms 뒤에 복귀 칸으로 넘어간다.
      expect(golem.dataset.retroPixelCell).toBe(expectedHold > 0 ? "attack" : "recover");
      if (expectedHold > 0) {
        vi.advanceTimersByTime(expectedHold - 1);
        expect(golem.dataset.retroPixelCell).toBe("attack");
        vi.advanceTimersByTime(2);
        expect(golem.dataset.retroPixelCell).toBe("recover");
      }
    }
  });

  it("does not hold the attack cell under reduced motion", () => {
    const { field, golem, runtime } = field16("full", "golem20");
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })) as never;
    try {
      retroTimelineEntry(field, { sequence: 1, kind: "action", side: "enemy", userId: golem.dataset.testid, userRecordId: "enemy_stone_golem", commandKind: "enemyAttack", targetId: "nobody" } as never);
      for (const [kind, durationMs] of [["approach", 300], ["impact", 0], ["recover", 500]] as const) {
        retroActionMotion(field, { kind, userId: golem.dataset.testid!, durationMs } as never, runtime.snapshot());
      }
      expect(golem.dataset.retroPixelCell).toBe("recover");
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});
