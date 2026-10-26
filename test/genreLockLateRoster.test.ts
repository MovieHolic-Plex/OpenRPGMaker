// 잠금 누수 감사(2026-10-16) #3·#4·#6·#9·#10 — 늦은 잠금의 보고·기본 명단 정리·동료/파티 명령·전투 그림·옛 sprite·없는 외형 id.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createProjectStartSeed } from "@/editor/projectStartSeed";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { genreLockCharsetOutsiders, genreLockReport } from "@/project/genreLock";
import { enableGenreLockSettled, settleCharsetsOnLock } from "@/project/genreLockCharsets";
import { battlerSourceChip, collectCharsetUses } from "@/project/genreLockCharsetUses";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";

beforeEach(() => resetMapEditHistory());

const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun });
// 역방향 잠금(#2812): 몬스터 게임이 아닌 프로젝트에서 조수가 configure_monster_system 을 부르려면 몬스터 수집 요청 턴(monsterTurn)이어야 한다.
const monsterRequestCtxOf = (project: Project): ToolContext => ({ ...ctxOf(project), monsterTurn: true });
const ALLOWED = new Set(["scarloxy-people", "oprn-creature", "rtp-creature", "object", "uploaded", "other"]);
const hero = (project: Project) => project.database.actors.find((actor) => actor.id === "actor_hero")!;
const placeNpc = (ctx: ToolContext, name: string, x: number, extra: Record<string, unknown> = {}) =>
  runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name, x, y: 6, ...extra }, { dryRun: false });
const npcFamily = (project: Project, name: string) => {
  const event = project.maps[project.startMapId]!.events.find((entry) => entry.name === name)!;
  return charsetFamilyOf(project, event.pages![0]!.graphic!.sprite!.id);
};

describe("#4 기본 명단 배우 — 잠금을 켜면 손대지 않은 배우는 허용 칩이 된다", () => {
  it("프리셋으로 잠근 프로젝트에서 기본 명단 배우의 걷기 칩 계열이 전부 허용 계열이다", () => {
    const project = createBlankProject();
    expect(project.database.actors.some((actor) => !ALLOWED.has(charsetFamilyOf(project, actor.characterResourceId ?? "")))).toBe(true);
    applyGenrePreset(project, "monster-collect");
    const outside = project.database.actors.filter((actor) => actor.characterResourceId && !ALLOWED.has(charsetFamilyOf(project, actor.characterResourceId)));
    expect(outside.map((actor) => actor.id)).toEqual([]);
  });

  it("얼굴·전투 그림도 허용 밖이 남지 않는다(얼굴은 새 칩의 짝, 전투 그림은 비움)", () => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    for (const actor of project.database.actors) {
      const chip = actor.battleCharacterResourceId ? battlerSourceChip(actor.battleCharacterResourceId) : undefined;
      if (chip) expect(ALLOWED.has(charsetFamilyOf(project, chip.resourceId)), `${actor.id} ${actor.battleCharacterResourceId}`).toBe(true);
    }
    expect(hero(project).battleCharacterResourceId).toBeUndefined();
  });

  it("저작자가 칩을 바꾼 배우는 건드리지 않는다", () => {
    const project = createBlankProject();
    const mage = project.database.actors.find((actor) => actor.id === "actor_mage")!;
    mage.characterResourceId = "easyrpg-charset-actor3";
    mage.characterIndex = 6;
    enableGenreLockSettled(project, "monster-collect");
    expect(mage.characterResourceId).toBe("easyrpg-charset-actor3");
    expect(mage.characterIndex).toBe(6);
  });

  it("같은 원래 칩은 같은 새 칩으로 가고 한 칩에 몰리지 않는다", () => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    const used = new Map<string, number>();
    for (const actor of project.database.actors) {
      if (actor.id === "actor_hero" || charsetFamilyOf(project, actor.characterResourceId ?? "") !== "scarloxy-people") continue;
      const key = `${actor.characterResourceId}#${actor.characterIndex ?? 0}`;
      used.set(key, (used.get(key) ?? 0) + 1);
    }
    expect(used.size).toBeGreaterThan(3);
  });
});

describe("#4 동료·파티 명령이 가리키는 배우의 칩도 검사한다", () => {
  const talker = (id: string, project: Project, commands: unknown[]) => ({
    mapId: project.startMapId,
    event: { id, name: id, x: project.startPos.x + 2, y: project.startPos.y, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p1", graphic: { sprite: { type: "bundled", id: "tex_scarloxy_charset_people1" }, pattern: 25, direction: "down" }, trigger: { kind: "action" }, commands }] },
  });

  it("기본 명단 마도사를 동료로 부르면 허용 칩 그대로 통과한다(잠금 때 이미 바뀌었다)", async () => {
    const project = await createProjectStartSeed("monster-collect", "시험", "ai");
    const ctx = ctxOf(project);
    const result = runTool(ctx, "upsert_event", talker("follow_ok", project, [{ kind: "addFollower", actorId: "actor_mage" }, { kind: "changeParty", actorId: "actor_scout", action: "add" }]), { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
  });

  it("허용 밖 칩을 가진 저작 배우를 동료·파티로 부르는 새 명령은 거부된다 — 메시지가 배우를 짚는다", async () => {
    const project = await createProjectStartSeed("monster-collect", "시험", "ai");
    project.database.actors.push({ ...hero(project), id: "actor_authored", name: "저작 배우", characterResourceId: "easyrpg-charset-actor3", characterIndex: 1 });
    const ctx = ctxOf(project);
    for (const command of [{ kind: "addFollower", actorId: "actor_authored" }, { kind: "changeParty", actorId: "actor_authored", action: "add" }]) {
      const result = runTool(ctx, "upsert_event", talker(`follow_bad_${command.kind}`, project, [command]), { dryRun: false });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("genre-lock");
      expect(result.issues?.[0]?.message).toContain("actor_authored");
    }
  });

  it("collectCharsetUses 가 명령의 actorId 를 배우 칩으로 푼다", () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events.push({ id: "ev1", name: "x", x: 1, y: 1, pages: [{ id: "p", commands: [{ kind: "addFollower", actorId: "actor_mage" }] }] } as never);
    const uses = [...collectCharsetUses(project)].filter(([path]) => path.includes("follow:actor_mage"));
    expect(uses).toHaveLength(1);
    expect(uses[0]![1].viaActor).toBe("actor_mage");
    expect(uses[0]![1].resourceId).toBe(project.database.actors.find((actor) => actor.id === "actor_mage")!.characterResourceId);
  });
});

describe("#3 늦은 잠금 — 잠금 이전의 칩을 보고하고(막지 않고) 조수 경로의 작은 새 프로젝트만 바꾼다", () => {
  it("빈 프로젝트에 NPC 를 놓은 뒤 configure_monster_system 으로 잠그면 NPC 가 허용 칩으로 바뀐다", () => {
    const ctx = monsterRequestCtxOf(createBlankProject());
    expect(placeNpc(ctx, "마을 사람", 8).ok).toBe(true);
    expect(npcFamily(ctx.project, "마을 사람")).toBe("rtp-people");
    expect(runTool(ctx, "configure_monster_system", { enabled: true }, { dryRun: false }).ok).toBe(true);
    expect(npcFamily(ctx.project, "마을 사람")).toBe("scarloxy-people");
    expect(genreLockReport(ctx.project).charsetPreexisting).toHaveLength(0);
  });

  it("맵이 둘인 저작 프로젝트는 소급해 바꾸지 않고 「잠금 이전부터 있던 칩」으로 보고한다", () => {
    const ctx = monsterRequestCtxOf(createBlankProject());
    const tileset = ctx.project.maps[ctx.project.startMapId]!.tilesetId;
    expect(runTool(ctx, "create_map", { name: "두번째", width: 20, height: 14, tilesetId: tileset }, { dryRun: false }).ok).toBe(true);
    expect(placeNpc(ctx, "마을 사람", 8).ok).toBe(true);
    expect(runTool(ctx, "configure_monster_system", { enabled: true }, { dryRun: false }).ok).toBe(true);
    expect(npcFamily(ctx.project, "마을 사람")).toBe("rtp-people");
    const report = genreLockReport(ctx.project);
    expect(report.charsetPreexisting.length).toBeGreaterThanOrEqual(1);
    expect(report.charsetViolations).toHaveLength(0);
    const check = runTool(ctx, "check_genre_lock", {}, { dryRun: false });
    expect(check.summary).toContain("잠금 이전부터 있던 허용 밖");
    expect(JSON.stringify(check.data)).toContain("마을 사람");
    expect(buildSystemPrompt(ctx.project)).toContain("허용 밖 캐릭터 칩");
  });

  it("손 편집 토글(remapEvents:false)은 이벤트 그림을 바꾸지 않고 보고만 한다", () => {
    const project = createBlankProject();
    const ctx = ctxOf(project, false);
    expect(placeNpc(ctx, "마을 사람", 8).ok).toBe(true);
    expect(enableGenreLockSettled(ctx.project, "monster-collect", "enforce", { remapEvents: false })).toBe(true);
    expect(npcFamily(ctx.project, "마을 사람")).toBe("rtp-people");
    expect(genreLockReport(ctx.project).charsetPreexisting).toHaveLength(1);
  });

  it("잠금 이후에 손 편집으로 생긴 허용 밖 칩은 「잠금 이후」로 센다", () => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    const ctx = ctxOf(project, false);
    expect(placeNpc(ctx, "손편집 NPC", 8, { graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 1 } }).ok).toBe(true);
    // 쓰기 도구는 커밋한 새 프로젝트를 ctx.project 에 둔다 — 넘긴 원본 객체가 아니라 그것을 본다.
    const report = genreLockReport(ctx.project);
    expect(report.charsetViolations.map((chip) => chip.where).join("|")).toContain("손편집 NPC");
    expect(report.charsetPreexisting).toHaveLength(0);
  });

  it("grandfatheredCharsetPaths 는 저장·재로드 뒤에도 남고, 칩 잠금 없는 연애 잠금에는 생기지 않는다", () => {
    const ctx = ctxOf(createBlankProject(), false);
    const tileset = ctx.project.maps[ctx.project.startMapId]!.tilesetId;
    runTool(ctx, "create_map", { name: "두번째", width: 20, height: 14, tilesetId: tileset }, { dryRun: false });
    placeNpc(ctx, "마을 사람", 8);
    enableGenreLockSettled(ctx.project, "monster-collect", "enforce", { remapEvents: false });
    const lock = ctx.project.system.genreLock!;
    expect(lock.grandfatheredCharsetPaths?.length).toBeGreaterThan(0);
    expect(deserialize(serialize(ctx.project)).system.genreLock).toEqual(lock);
    const romance = createBlankProject();
    enableGenreLockSettled(romance, "romance");
    expect(romance.system.genreLock?.grandfatheredCharsetPaths).toBeUndefined();
    expect(settleCharsetsOnLock(romance)).toEqual({ rosterActorsRemapped: 0, pagesRemapped: 0, remaining: 0 });
  });
});

describe("#6·#9·#10 전투 그림·옛 sprite·외형 id", () => {
  const lockedCtx = async () => ctxOf(await createProjectStartSeed("monster-collect", "시험", "ai"));

  it("battleCharacterResourceId 를 RTP 걷기 칩 전투 시트로 지정하면 거부된다", async () => {
    const ctx = await lockedCtx();
    const result = runTool(ctx, "upsert_actor", { actor: { id: "actor_b", name: "배틀", classId: "class_hero", characterResourceId: "scarloxy-charset-people1", characterIndex: 2, battleCharacterResourceId: "charset-battler-actor3-1" } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("전투 그림");
  });

  it("battlerSourceChip 은 걷기 칩 전투 시트와 파티 도트 시트를 원본 칩으로 푼다", () => {
    expect(battlerSourceChip("charset-battler-actor1-0")).toEqual({ resourceId: "easyrpg-charset-actor1", characterIndex: 0 });
    expect(battlerSourceChip("charset-battler-actor3-0-samurai")).toEqual({ resourceId: "easyrpg-charset-actor3", characterIndex: 0 });
    expect(battlerSourceChip("party-pixel-animal-0")).toEqual({ resourceId: "easyrpg-charset-animal", characterIndex: 0 });
    expect(battlerSourceChip("charset-battler-silver-swordswoman")).toBeUndefined();
  });

  it("이벤트 레벨 옛 sprite 필드의 RTP 칩도 거부된다", async () => {
    const ctx = await lockedCtx();
    const sp = ctx.project.startPos;
    const result = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "leak_legacy", name: "옛필드", x: sp.x + 8, y: sp.y, trigger: { kind: "action" }, sprite: { type: "bundled", id: "easyrpg-charset-actor3" }, commands: [{ kind: "text", body: "옛 sprite" }] } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("genre-lock");
  });

  it("외형 DB 에 없는 appearanceId 를 페이지 그림에 넣는 patch 는 거부된다", async () => {
    const ctx = await lockedCtx();
    expect(placeNpc(ctx, "주민", 6).ok).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]!.events.find((entry) => entry.name === "주민")!;
    const result = runTool(ctx, "patch_event_page", { mapId: ctx.project.startMapId, eventId: event.id, set: { graphic: { appearanceId: "no_such_look" } } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("appearanceId");
  });

  it("허용 밖 칩을 가진 외형 프리셋을 가리키는 appearanceId 도 거부된다", async () => {
    const ctx = await lockedCtx();
    ctx.project.database.characterAppearances = [...(ctx.project.database.characterAppearances ?? []), { id: "look_rtp", name: "RTP 외형", description: "", charset: { resourceId: "easyrpg-charset-actor3", characterIndex: 1 } }];
    expect(placeNpc(ctx, "주민", 6).ok).toBe(true);
    const event = ctx.project.maps[ctx.project.startMapId]!.events.find((entry) => entry.name === "주민")!;
    const result = runTool(ctx, "patch_event_page", { mapId: ctx.project.startMapId, eventId: event.id, set: { graphic: { appearanceId: "look_rtp" } } }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("genre-lock");
  });

  it("보고에 세는 칩: 시작 배우가 아닌 기본 명단은 세지 않는다", () => {
    const project = createBlankProject();
    enableGenreLockSettled(project, "monster-collect", "enforce", { remapEvents: false });
    expect(genreLockCharsetOutsiders(project)).toHaveLength(0);
  });
});

describe("기본 명단·페이지 이식은 한 칩으로 몰리지 않는다(#8 준비)", () => {
  it("서로 다른 RTP 사람 칩 6개를 잠그면 허용 칩 인물이 3가지 이상으로 나뉜다", () => {
    const project = createBlankProject();
    // 역방향 잠금(#2812): 몬스터 게임이 아닌 프로젝트에서 잠금을 켜는 configure_monster_system 은 몬스터 수집 요청 턴이어야 돈다.
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true } as ToolContext;
    const chips = [["tex_easyrpg_charset_people1", 1], ["tex_easyrpg_charset_people5", 1], ["tex_easyrpg_charset_people2", 3], ["tex_easyrpg_charset_actor1", 0], ["tex_easyrpg_charset_people3", 2], ["tex_easyrpg_charset_people1", 6]] as const;
    chips.forEach(([textureKey, characterIndex], i) => runTool(ctx, "place_npc", { mapId: project.startMapId, name: `인물${i}`, x: 4 + i, y: 6, graphic: { textureKey, characterIndex } }, { dryRun: false }));
    runTool(ctx, "configure_monster_system", { enabled: true }, { dryRun: false });
    // 쓰기 도구는 커밋한 새 프로젝트를 ctx.project 에 둔다.
    const patterns = new Set(ctx.project.maps[project.startMapId]!.events.map((event) => (event.pages![0]!.graphic as { pattern?: number }).pattern));
    expect(patterns.size).toBeGreaterThanOrEqual(3);
  });
});
