import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project } from "@/project/types";
import type { CinematicStillResult } from "@/editor/openingImageGeneration";
import type { ToolContext } from "@/editor/tools/types";
import { facelessFitCharacters, facelessNewAppearances, makeCharacters, misfitCharacters, drawFaces } from "../scripts/lib/piCharacterMaking";
import { pointPairedFacesAtAppearance } from "@/editor/characterAppearanceGeneration";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const VILLAGER_WOMAN = "charset:tex_easyrpg_charset_people1:5";
const DWARF_SMITH = "charset:tex_oprn_charset_refmap_doll190:4";

function villager(ctx: ToolContext, id: string, name: string, selectionId: string, face?: Record<string, unknown>) {
  const result = runTool(ctx, "make_villager", { mapId: ctx.project.startMapId, id, name, home: { x: 2 + ctx.project.maps[ctx.project.startMapId]!.events.length * 2, y: 3 }, graphic: { selectionId }, dialogue: [{ text: "어서 오세요." }], ...(face ? { face } : {}) }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  return result;
}

function faces(project: Project, eventId: string): Extract<Command, { kind: "changeFace" }>[] {
  const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === eventId)!;
  return (event.pages ?? []).flatMap((page) => page.commands).filter((command): command is Extract<Command, { kind: "changeFace" }> => command.kind === "changeFace");
}

const drew = (resourceId: string): CinematicStillResult => ({ ok: true, resourceId, name: "얼굴", prompt: "p", dataUrl: PNG_1PX });

describe("역할에 맞지 않는 칩으로 선 사람을 실행 끝에 만든다", () => {
  it("무기점 주인이 여관 앞치마 칩이면 판정에 걸리고, 대장장이 칩·역할 없는 이름은 걸리지 않는다", () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    const warned = villager(ctx, "ev_weapon", "무기점 주인 도르간", VILLAGER_WOMAN);
    villager(ctx, "ev_smith", "무기점 주인 브론", DWARF_SMITH);
    villager(ctx, "ev_mira", "미라", VILLAGER_WOMAN);
    expect(warned.diff.warnings.some((line) => line.includes("역할과 맞지 않는다"))).toBe(true);
    expect(misfitCharacters(ctx.project, base).map((m) => m.eventId)).toEqual(["ev_weapon"]);
  });

  it("얼굴을 등록한 뒤에만 외형에 넣고 대사 얼굴을 외형으로 돌린다 — 실패하면 원래 얼굴 명령이 그대로다", async () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    villager(ctx, "ev_weapon", "무기점 주인 도르간", VILLAGER_WOMAN, { textureKey: "tex_easyrpg_charset_people1", characterIndex: 5 });
    villager(ctx, "ev_armor", "방어구점 주인 벨몬트", VILLAGER_WOMAN, { textureKey: "tex_easyrpg_charset_people1", characterIndex: 5 });
    const before = faces(ctx.project, "ev_armor").map((command) => command.resourceId);
    const started: string[] = [];
    const outcomes = await makeCharacters(misfitCharacters(ctx.project, base), {
      ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), chipsLeft: 5,
      startChip: async (appearanceId) => { started.push(appearanceId); },
      drawFace: async (args) => (args.name as string).includes("벨몬트") ? { ok: false, code: "x", summary: "그림 계정 한도" } : drew("appearance-face_t1"),
    });
    expect(started).toHaveLength(2);
    const weapon = outcomes.find((o) => o.target.eventId === "ev_weapon")!;
    const armor = outcomes.find((o) => o.target.eventId === "ev_armor")!;
    const weaponApp = ctx.project.database.characterAppearances!.find((app) => app.id === weapon.appearanceId)!;
    expect(weaponApp.face?.resourceId).toBe("appearance-face_t1");
    expect(weaponApp.charset?.resourceId).toBe("tex_easyrpg_charset_people1");
    expect(ctx.project.assets.uploaded["appearance-face_t1"]?.kind).toBe("faceset");
    expect(faces(ctx.project, "ev_weapon").length).toBeGreaterThan(0);
    expect(faces(ctx.project, "ev_weapon").every((command) => command.appearanceId === weapon.appearanceId)).toBe(true);
    expect(armor.faceResourceId).toBeUndefined();
    expect(faces(ctx.project, "ev_armor").map((command) => command.resourceId)).toEqual(before);
    expect(faces(ctx.project, "ev_armor").some((command) => command.appearanceId)).toBe(false);
  });

  it("상한을 넘는 사람은 만들지 않고, 모델이 만든 얼굴 없는 외형도 얼굴을 그린다", async () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    villager(ctx, "ev_a", "무기점 주인 A", VILLAGER_WOMAN);
    villager(ctx, "ev_b", "꽃집 소녀 B", VILLAGER_WOMAN);
    const made = await makeCharacters(misfitCharacters(ctx.project, base), { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), chipsLeft: 1, drawFace: async () => drew("appearance-face_t2") });
    expect(made).toHaveLength(1);
    const chip = runTool(ctx, "generate_walk_chip", { name: "어부 할아버지", description: "old fisherman, straw hat", events: [{ mapId: ctx.project.startMapId, eventId: "ev_b" }] }, { dryRun: false });
    expect(chip.ok, chip.summary).toBe(true);
    const jobs = facelessNewAppearances(ctx.project, base, new Set(made.map((o) => o.appearanceId!)));
    expect(jobs.map((job) => job.target.name)).toEqual(["어부 할아버지"]);
    const [face] = await drawFaces(jobs, { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), drawFace: async () => drew("appearance-face_t3") });
    expect(face!.faceResourceId).toBe("appearance-face_t3");
  });

  it("외형으로 돌린 대사 얼굴은 같은 주민을 다시 갱신해도 남는다", async () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    villager(ctx, "ev_weapon", "무기점 주인 도르간", VILLAGER_WOMAN, { textureKey: "tex_easyrpg_charset_people1", characterIndex: 5 });
    const [made] = await makeCharacters(misfitCharacters(ctx.project, base), { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), chipsLeft: 5, drawFace: async () => drew("appearance-face_t4") });
    const again = runTool(ctx, "make_villager", { mapId: ctx.project.startMapId, id: "ev_weapon", name: "무기점 주인 도르간", home: { x: 2, y: 3 }, movement: "fixed" }, { dryRun: false });
    expect(again.ok, again.summary).toBe(true);
    expect(faces(ctx.project, "ev_weapon").some((command) => command.appearanceId === made!.appearanceId)).toBe(true);
  });

  it("고유 이름(게오르크)이라도 role 로 받은 역할로 판정한다", () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    const result = runTool(ctx, "make_villager", { mapId: ctx.project.startMapId, id: "ev_georg", name: "게오르크", role: "은퇴한 기사", home: { x: 4, y: 3 }, graphic: { selectionId: VILLAGER_WOMAN }, dialogue: [{ text: "검을 내려놓았네." }] }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const [misfit] = misfitCharacters(ctx.project, base);
    expect(misfit?.eventId).toBe("ev_georg");
    expect(misfit?.role.elder).toBe(true);
  });

  it("이번 실행 전에 있던 이벤트의 대사 얼굴은 외형으로 돌리지 않는다", async () => {
    const seed: ToolContext = { project: createBlankProject() };
    villager(seed, "ev_old", "도구점 주인 노장", VILLAGER_WOMAN, { textureKey: "tex_easyrpg_charset_people1", characterIndex: 5 });
    const base = structuredClone(seed.project);
    const ctx: ToolContext = { project: structuredClone(base) };
    const chip = runTool(ctx, "generate_walk_chip", { name: "노장", description: "old general-goods shopkeeper with a satchel", events: [{ mapId: ctx.project.startMapId, eventId: "ev_old" }] }, { dryRun: false });
    expect(chip.ok, chip.summary).toBe(true);
    const jobs = facelessNewAppearances(ctx.project, base, new Set());
    expect(jobs[0]!.events).toEqual([]);
    await drawFaces(jobs, { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), drawFace: async () => drew("appearance-face_t5") });
    expect(faces(ctx.project, "ev_old").some((command) => command.appearanceId)).toBe(false);
  });

  it("편집기가 인물 얼굴을 모르면(옛 판) 그린 그림을 얼굴로 쓰지 않는다", async () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    villager(ctx, "ev_weapon", "무기점 주인 도르간", VILLAGER_WOMAN);
    const [made] = await makeCharacters(misfitCharacters(ctx.project, base), { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), chipsLeft: 5, drawFace: async () => drew("opening-still_x") });
    expect(made!.faceResourceId).toBeUndefined();
    expect(ctx.project.assets.uploaded["opening-still_x"]).toBeUndefined();
  });

  it("v1 에서 얼굴을 적용하면 그 칩의 짝 얼굴 명령만 외형으로 돌린다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    villager(ctx, "ev_weapon", "무기점 주인 도르간", VILLAGER_WOMAN, { textureKey: "tex_easyrpg_charset_people1", characterIndex: 5 });
    const chip = runTool(ctx, "generate_walk_chip", { name: "도르간", description: "weapon-shop owner with a sword", events: [{ mapId: ctx.project.startMapId, eventId: "ev_weapon" }] }, { dryRun: false });
    expect(chip.ok, chip.summary).toBe(true);
    const appearanceId = ctx.project.database.characterAppearances!.find((app) => app.name === "도르간")!.id;
    expect(pointPairedFacesAtAppearance(ctx.project, appearanceId)).toBeGreaterThan(0);
    expect(faces(ctx.project, "ev_weapon").every((command) => command.appearanceId === appearanceId)).toBe(true);
  });

  it("칩은 맞는데 짝 얼굴이 없는 사람은 걷기 칩 없이 얼굴만 그린다", async () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    villager(ctx, "ev_bard", "떠돌이 음유시인", "charset:tex_oprn_charset_refmap_doll199:4");
    const targets = facelessFitCharacters(ctx.project, base);
    expect(targets.map((t) => t.eventId)).toEqual(["ev_bard"]);
    const started: string[] = [];
    const [made] = await makeCharacters(targets, { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), chipsLeft: 5, faceOnly: true, startChip: async (id) => { started.push(id); }, drawFace: async () => drew("appearance-face_t6") });
    expect(started).toEqual([]);
    expect(made!.faceResourceId).toBe("appearance-face_t6");
    expect(ctx.project.database.characterAppearances!.find((app) => app.id === made!.appearanceId)!.charset?.resourceId).toBe("tex_oprn_charset_refmap_doll199");
  });

  it("같은 칩을 입은 사람 여럿은 한 외형·한 얼굴을 나눠 쓴다", async () => {
    const base = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(base) };
    villager(ctx, "ev_bard1", "떠돌이 음유시인 A", "charset:tex_oprn_charset_refmap_doll199:4");
    villager(ctx, "ev_bard2", "떠돌이 음유시인 B", "charset:tex_oprn_charset_refmap_doll199:4");
    const targets = facelessFitCharacters(ctx.project, base);
    expect(targets).toHaveLength(1);
    let draws = 0;
    const [made] = await makeCharacters(targets, { ctx, runTool: (c, n, a) => runTool(c, n, a, { dryRun: false }), chipsLeft: 5, faceOnly: true, drawFace: async () => { draws += 1; return drew("appearance-face_t7"); } });
    expect(draws).toBe(1);
    const wearing = ctx.project.maps[ctx.project.startMapId]!.events.filter((event) => event.pages?.some((page) => page.graphic?.appearanceId === made!.appearanceId));
    expect(wearing.map((event) => event.id).sort()).toEqual(["ev_bard1", "ev_bard2"]);
  });
});
