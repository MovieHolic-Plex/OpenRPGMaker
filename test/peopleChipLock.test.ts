// 사람 칩 계열 잠금(2026-10-29) — 첫 사람 칩이 계열을 정하고, 그 뒤로 조수는 그 계열 사람 칩만 쓴다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 가 돌린다). 같은 시나리오를 runTool 로 돌린 헤드리스 확인은 작성 세션에서 했다.
import { beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { deserialize, serialize } from "@/project/io";
import { peopleChipLockAllows, peopleChipPromptNote } from "@/project/peopleChipLock";
import type { Project } from "@/project/types";

beforeEach(() => resetMapEditHistory());

const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun });
const npc = (ctx: ToolContext, x: number, name: string, graphic?: Record<string, unknown>) =>
  runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, x, y: 3, name, ...(graphic ? { graphic } : {}), pages: [{ lines: ["안녕"] }] }, { dryRun: false });
const REFMAP = { textureKey: "oprn-charset-refmap-doll1", characterIndex: 0 };
const RTP = { textureKey: "easyrpg-charset-people1", characterIndex: 2 };

describe("사람 칩 계열 잠금", () => {
  it("첫 사람 칩이 계열을 정하고 다른 계열 사람 칩은 거부한다", () => {
    const ctx = ctxOf(createBlankProject());
    expect(npc(ctx, 3, "여관 주인", REFMAP).ok).toBe(true);
    expect(ctx.project.system.peopleChipLock).toEqual({ family: "refmap-doll", by: "auto" });
    const rejected = npc(ctx, 5, "상인", RTP);
    expect(rejected.ok).toBe(false);
    expect(rejected.summary).toContain("사람 칩 잠금");
    expect(ctx.project.maps[ctx.project.startMapId]!.events.map((event) => event.name)).not.toContain("상인");
  });

  it("잠근 뒤 검색어·기본 주민도 잠금 계열 사람 칩으로 골라진다", () => {
    const ctx = ctxOf(createBlankProject());
    npc(ctx, 3, "여관 주인", REFMAP);
    expect(npc(ctx, 5, "늙은 상인", { query: "old merchant" }).ok).toBe(true);
    expect(npc(ctx, 7, "마을 사람").ok).toBe(true);
    for (const event of ctx.project.maps[ctx.project.startMapId]!.events) {
      const id = (event.pages[0]!.graphic as { sprite?: { id?: string } }).sprite?.id ?? "";
      expect(charsetFamilyOf(ctx.project, id)).toBe("refmap-doll");
    }
  });

  it("주인공 걷기 칩도 잠금 계열만 받는다", () => {
    const ctx = ctxOf(createBlankProject());
    npc(ctx, 3, "여관 주인", REFMAP);
    expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "oprn-charset-heroes1", characterIndex: 0 } }, { dryRun: false }).ok).toBe(false);
    expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "oprn-charset-refmap-doll5", characterIndex: 1 } }, { dryRun: false }).ok).toBe(true);
  });

  it("몬스터·동물 칩은 잠그지 않는다", () => {
    const ctx = ctxOf(createBlankProject());
    npc(ctx, 3, "여관 주인", REFMAP);
    expect(npc(ctx, 5, "슬라임", { query: "슬라임" }).ok).toBe(true);
    expect(peopleChipLockAllows(ctx.project, "easyrpg-charset-monster1")).toBe(true);
    expect(peopleChipLockAllows(ctx.project, "easyrpg-charset-people1")).toBe(false);
  });

  it("손 편집은 막지 않고 잠금도 걸지 않는다", () => {
    const ctx = ctxOf(createBlankProject(), false);
    expect(npc(ctx, 3, "여관 주인", REFMAP).ok).toBe(true);
    expect(ctx.project.system.peopleChipLock).toBeUndefined();
  });

  it("장르 잠금이 캐릭터 칩을 맡으면 쉰다", () => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    expect(peopleChipPromptNote(project)).toBeNull();
    expect(peopleChipLockAllows(project, "easyrpg-charset-people1")).toBe(true);
  });

  it("저장·재로드에 남고 프롬프트에 잠금 계열이 실린다", () => {
    const ctx = ctxOf(createBlankProject());
    npc(ctx, 3, "여관 주인", REFMAP);
    const again = deserialize(serialize(ctx.project));
    expect(again.system.peopleChipLock).toEqual({ family: "refmap-doll", by: "auto" });
    expect(buildSystemPrompt(again)).toContain("[사람 칩 잠금 — REFMAP 변형 인물 칩]");
    expect(buildSystemPrompt(createBlankProject())).toContain("처음 새로 놓는 사람 칩");
  });
});
