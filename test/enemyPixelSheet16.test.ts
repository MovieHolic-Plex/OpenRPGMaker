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

function pack(patch: Record<string, unknown> = {}, sheetSize = 256, frames = 16): { manifest: StorePackManifest; blobs: Map<string, Uint8Array>; sheetSha: string } {
  const portrait = pngHeader(64, 64, 1);
  const sheet = pngHeader(sheetSize, sheetSize, 2);
  const blobs = new Map([[sha(portrait), portrait], [sha(sheet), sheet]]);
  const manifest: StorePackManifest = {
    schema: "oprn-store-pack/1", title: "Slimes", summary: "", description: "", tags: [], kind: "battler", license: "OPRN-GAME", aiGenerated: true, credits: "AI",
    content: {
      assets: {
        slime: {
          id: "slime", name: "Slime", kind: "monster", blob: sha(portrait), mime: "image/png",
          meta: { width: 64, height: 64, pixelEnemySheet: { sheetResourceId: "slime-sheet", cell: 64, motion: "hop", idleFrameMs: 200, grid: "4x4", ...patch } as never },
        },
        "slime-sheet": { id: "slime-sheet", name: "Slime sheet", kind: "picture", blob: sha(sheet), mime: "image/png", meta: { width: sheetSize, height: sheetSize, frameWidth: 64, frameHeight: 64, frames } },
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
  store.replace(deserialize(serialize(project)));
}, 180_000);

/** 골렘 적이 16칸 프로젝트 시트(variant)를 쓰게 한 전투 필드. */
function field16(variant: keyof typeof VARIANTS = "full"): { field: HTMLElement; golem: HTMLElement; image: HTMLElement; runtime: ReturnType<typeof createBattleRuntime> } {
  document.body.replaceChildren();
  const golemRecord = store.getCurrent().database.enemies.find((entry) => entry.id === "enemy_stone_golem")!;
  golemRecord.monsterResourceId = `golem16-${variant}`;
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
});
