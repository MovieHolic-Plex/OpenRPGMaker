// 잠금 누수 감사(2026-10-16) #2·#12 — 라우팅이 몬스터 의도를 놓친 자유 경로에서 몬스터 전용 도구가 처음 성공하면 잠금도 같이 걸린다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { activeGenreLock } from "@/project/genreLock";
import type { Project } from "@/project/types";

beforeEach(() => resetMapEditHistory());

// 몬스터 자산 역방향 잠금(2026-10-17): 몬스터 도구·자산은 몬스터 프로젝트이거나 몬스터 요청 턴에서만 풀린다 — 이 시험은 몬스터 요청 턴이다.
const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun, monsterTurn: true });
const starters = (project: Project) => ({
  speciesIds: project.database.monsterSpecies!.slice(0, 3).map((species) => species.id),
  actorEvent: { mapId: project.startMapId, x: 5, y: 5, name: "박사" },
});
const heroChipFamily = (project: Project) => {
  const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
  return charsetFamilyOf(project, hero.characterResourceId ?? "easyrpg-charset-actor1");
};

describe("몬스터 전용 도구의 첫 성공이 잠금을 건다(빈 시작 맵뿐인 새 프로젝트)", () => {
  it("give_starter_monsters 만 불러도 몬스터 키트 + 장르 잠금 + 표지가 같이 걸리고 주인공이 허용 칩이 된다", () => {
    const ctx = ctxOf(createBlankProject());
    expect(ctx.project.system.genreLock).toBeUndefined();
    const result = runTool(ctx, "give_starter_monsters", starters(ctx.project), { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.system.genre).toBe("monster-collect");
    expect(activeGenreLock(ctx.project)?.lock.preset).toBe("monster-collect");
    expect(ctx.project.maps[ctx.project.startMapId]!.tilesetId).toBe("monster_overworld");
    expect(heroChipFamily(ctx.project)).toBe("scarloxy-people");
  });

  it("그 뒤 place_npc 기본 그림은 허용 칩이고 RTP 칩 직접 지정은 거부된다", () => {
    const ctx = ctxOf(createBlankProject());
    expect(runTool(ctx, "give_starter_monsters", starters(ctx.project), { dryRun: false }).ok).toBe(true);
    const placed = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "마을 사람", x: 8, y: 6 }, { dryRun: false });
    expect(placed.ok, placed.summary).toBe(true);
    const npc = ctx.project.maps[ctx.project.startMapId]!.events.find((event) => event.name === "마을 사람")!;
    expect(charsetFamilyOf(ctx.project, npc.pages![0]!.graphic!.sprite!.id)).not.toBe("rtp-people");
    const rtp = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "RTP", x: 9, y: 6, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 1 } }, { dryRun: false });
    expect(rtp.ok).toBe(false);
  });

  it("도구가 실패하면 잠금도 걸리지 않는다(처음 성공할 때만)", () => {
    const ctx = ctxOf(createBlankProject());
    const failed = runTool(ctx, "place_trainer", { mapId: ctx.project.startMapId, x: 6, y: 6, name: "트레이너", team: [{ speciesId: "nonexistent", level: 5 }] }, { dryRun: false });
    expect(failed.ok).toBe(false);
    expect(ctx.project.system.genreLock).toBeUndefined();
    expect(ctx.project.system.genre).toBeUndefined();
  });

  it("맵에 이벤트가 이미 있는 기존 프로젝트는 소급 잠금 없이 표지만 남긴다", () => {
    const project = createBlankProject();
    // 최소 이벤트에도 trigger·commands 가 있어야 한다 — #2939 후처리 점검이 event.trigger.kind 를 읽는다.
    project.maps[project.startMapId]!.events.push({ id: "ev_old", name: "주민", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [] } as never);
    const ctx = ctxOf(project);
    expect(runTool(ctx, "give_starter_monsters", starters(project), { dryRun: false }).ok).toBe(true);
    expect(ctx.project.system.genre).toBe("monster-collect");
    expect(ctx.project.system.genreLock).toBeUndefined();
    expect(ctx.project.maps[ctx.project.startMapId]!.tilesetId).not.toBe("monster_overworld");
  });

  it("조수가 아닌 경로(콘텐츠 스크립트·손 편집)는 키트·잠금을 켜지 않는다", () => {
    const ctx = ctxOf(createBlankProject(), false);
    expect(runTool(ctx, "give_starter_monsters", starters(ctx.project), { dryRun: false }).ok).toBe(true);
    expect(ctx.project.system.genreLock).toBeUndefined();
  });

  it("사용자가 잠금을 푼 몬스터 프로젝트(표지만 있음)는 다시 잠그지 않는다", () => {
    const project = createBlankProject();
    project.system.genre = "monster-collect";
    const ctx = ctxOf(project);
    expect(runTool(ctx, "give_starter_monsters", starters(project), { dryRun: false }).ok).toBe(true);
    expect(ctx.project.system.genreLock).toBeUndefined();
  });
});

describe("place_npc graphic 표기 견고성(#12)", () => {
  it("resourceId 로 적어도 도구 예외 없이 textureKey 와 같게 풀린다", () => {
    const ctx = ctxOf(createBlankProject());
    const result = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "청년", x: 6, y: 6, graphic: { resourceId: "easyrpg-charset-people3", characterIndex: 1 } }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[ctx.project.startMapId]!.events.some((event) => event.name === "청년")).toBe(true);
  });
  it("칩 id 가 문자열이 아니면 인자 오류로 알린다(TypeError 가 아니다)", () => {
    const ctx = ctxOf(createBlankProject());
    const result = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "청년", x: 6, y: 6, graphic: { characterIndex: 1 } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).not.toContain("trim");
  });
});
