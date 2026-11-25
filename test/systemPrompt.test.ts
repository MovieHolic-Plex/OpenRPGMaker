import { describe, expect, it, beforeEach } from "vitest";
import { GAME_PRESET_IDS, normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { deserialize, serialize } from "@/project/io";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } from "@/editor/welcomeGenrePresets";
import { projectInterviewQuestions } from "@/editor/projectInterviewQuestions";
import { parseAdditionalInterviewAnswers } from "@/ai/projectInterviewAnswers";
import { buildPiAgentSystemPrompt, FOUR_LAYER_REFERENCE_MARKER } from "@/ai/piAgent/systemPrompt";
import { interviewBrief } from "./helpers/gameDesignBrief";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset, applyMonsterIntentStart } from "@/project/genrePresets";
import { enableGenreLock, genreLockAllowsCharset, genreMarkerNote } from "@/project/genreLock";
import { genreLockCharsetViolations, remapCharsetsToPreset } from "@/project/genreLockCharsets";
import type { Project } from "@/project/types";
import { genreLockAllowsVisual } from "@/project/genreLockVisuals";
import { backdropFamilyOf, battlerFamilyOf, faceFamilyOf, trainerArtFamilyOf } from "@/project/visualFamily";
import { mentionedToolSchemas } from "@/ai/planToolExposure";
import { setLayerTileAt } from "@/project/mapLayers";
import { isolateTimers } from "./mergedTeardown";

describe("gameDesignBrief", () => {
  isolateTimers();
  describe("confirmed new-project game brief", () => {
    it("round-trips authored answers, raw text, recommendation provenance and pending handoff without changing monster mechanics", () => {
      const seed = createNewProjectSeed("monster-collect");
      seed.gameDesignBrief = interviewBrief();
      seed.gameDesignBrief.generationPending = true;
      seed.gameDesignBrief.answers.detail.source = "recommended";
      seed.gameDesignBrief.summary = "포획할 때마다 주민의 기억이 사라지는 10분 공포 수집 게임";
      const loaded = deserialize(serialize(seed));
      expect(loaded.gameDesignBrief).toEqual(seed.gameDesignBrief);
      expect(loaded.system.monsterCollection).toBe(true);
      expect(loaded.system.battleModel).toBe("gen1");
      expect(loaded.worldCanon).toBeUndefined();
      expect(buildPiAgentSystemPrompt(loaded, [], false).join("\n")).toContain(seed.gameDesignBrief.summary);
    });

    it("leaves old projects unauthored and rejects incomplete or invalid authored decisions", () => {
      expect(deserialize(serialize(createNewProjectSeed(null))).gameDesignBrief).toBeUndefined();
      const brief = interviewBrief();
      expect(() => normalizeGameDesignBrief({ ...brief, answers: {} })).toThrow();
      expect(() => normalizeGameDesignBrief({ ...brief, presetId: "invented" })).toThrow();
      expect(() => normalizeGameDesignBrief({ ...brief, summary: "" })).toThrow();
      expect(() => normalizeGameDesignBrief({ ...brief, generationPending: "yes" })).toThrow();
    });

    it("each preset owns five distinct questions and user experience changes the consequential follow-up", () => {
      const firstQuestions = GAME_PRESET_IDS.map(id => projectInterviewQuestions(id, {}));
      expect(firstQuestions.every(questions => questions.length === 5)).toBe(true);
      expect(new Set(firstQuestions.map(q => q[0]!.title)).size).toBe(8);
      expect(projectInterviewQuestions("monster-collect", interviewBrief().answers)[3]!.title).toContain("공포");
      const gallery = interviewBrief("horror-gallery");
      gallery.answers.experience.text = "동행자를 믿을 수 없는 불안";
      expect(projectInterviewQuestions("horror-gallery", gallery.answers)[3]!.title).toContain("동료를 의심");
    });

    it("generation uses the confirmed revision, without the old sunny tone or arbitrary content quota", () => {
      const brief = interviewBrief();
      brief.summary = "공포 수집 게임. 첫 포획과 마을 조사까지만.";
      const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("monster-collect")!, brief);
      expect(prompt).toContain(brief.summary);
      expect(prompt).toContain("수집 시스템을 유지");
      expect(prompt).not.toContain("최소 2개");
      expect(prompt).not.toContain("스타터 몬스터와 간단한 풀숲");
      expect(() => buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("farm-life")!, brief)).toThrow();
    });

    it("only explicitly quoted, unanswered slots can skip another question", () => {
      const original = "공포지만 점프스케어는 없이. 마을 사건을 조사하고 첫 포획까지만.";
      expect(parseAdditionalInterviewAnswers(JSON.stringify({
        experience: "공포", progression: "마을 사건을 조사", scope: "첫 포획까지만", detail: "매 포획마다 동료가 사라짐",
      }), original, ["progression", "scope", "detail"])).toEqual({ progression: "마을 사건을 조사", scope: "첫 포획까지만" });
    });
  });
});

// 장르 잠금 — 캐릭터 칩 잠금 + 장르 표지(2026-10-16).
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
// 같은 시나리오를 실제 SQLite 저장·재로드까지 돌린 헤드리스 증거: scripts/qa/monster-lock-charset-evidence.mts (26/26).
describe("genreLockCharsets", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  const RTP_YOUTH = { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 };
  const hero = (project: Project) => project.database.actors.find((actor) => actor.id === "actor_hero")!;
  function lockedProject(): Project {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    return project;
  }
  const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun });
  const placeNpc = (ctx: ToolContext, name: string, x: number, extra: Record<string, unknown> = {}) =>
    runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name, x, y: 5, ...extra }, { dryRun: false });
  describe("charset 계열 분류", () => {
    it("번들 시트를 계열로 가른다", () => {
      expect(charsetFamilyOf(undefined, "easyrpg-charset-people1")).toBe("rtp-people");
      expect(charsetFamilyOf(undefined, "tex_easyrpg_charset_actor3")).toBe("rtp-people");
      expect(charsetFamilyOf(undefined, "tex_scarloxy_charset_people1")).toBe("scarloxy-people");
      expect(charsetFamilyOf(undefined, "easyrpg-charset-monster5")).toBe("oprn-creature");
      expect(charsetFamilyOf(undefined, "tex_oprn_charset_harness_monster2")).toBe("oprn-creature");
      expect(charsetFamilyOf(undefined, "easyrpg-charset-monster2")).toBe("rtp-creature");
      expect(charsetFamilyOf(undefined, "tex_easyrpg_charset_object1")).toBe("object");
      expect(charsetFamilyOf(undefined, "tex_oprn_charset_wizarding3")).toBe("wizarding");
      expect(charsetFamilyOf(undefined, "tex_oprn_charset_heroes1")).toBe("heroes");
      expect(charsetFamilyOf(undefined, "shared_charset_actor_abc")).toBe("shared-actor");
    });
  });
  describe("몬스터 잠금의 캐릭터 칩", () => {
    it("몬스터 프리셋은 손대지 않은 기본 주인공을 트레이너 칩으로 바꾸고 저장·재로드 뒤에도 남는다", () => {
      const project = lockedProject();
      expect(hero(project).characterResourceId).toBe("scarloxy-charset-people1");
      expect(hero(project).characterIndex).toBe(0);
      expect(project.system.genre).toBe("monster-collect");
      expect(project.system.genreLock!.allowedCharsetFamilies).toContain("scarloxy-people");
      expect(project.system.genreLock!.allowedCharsetFamilies).not.toContain("rtp-people");
      const reloaded = deserialize(serialize(project));
      expect(reloaded.system.genreLock).toEqual(project.system.genreLock);
      expect(hero(reloaded).characterResourceId).toBe("scarloxy-charset-people1");
    });

    it("저작자가 이미 바꾼 주인공은 잠금을 켜도 바뀌지 않는다", () => {
      const project = createBlankProject();
      hero(project).characterResourceId = "easyrpg-charset-actor3";
      hero(project).characterIndex = 4;
      enableGenreLock(project, "monster-collect");
      expect(hero(project).characterResourceId).toBe("easyrpg-charset-actor3");
      expect(hero(project).characterIndex).toBe(4);
    });

    it("그림을 생략한 place_npc·일반 질의는 허용 사람 칩(Scarloxy)만 고른다", () => {
      const ctx = ctxOf(lockedProject());
      for (const [name, x, extra] of [["길손", 4, {}], ["주민", 6, { graphic: { query: "villager" } }], ["마을 사람", 8, { graphic: { query: "주민" } }]] as const) {
        expect(placeNpc(ctx, name, x, extra).ok, name).toBe(true);
        const graphic = ctx.project.maps[ctx.project.startMapId]!.events.at(-1)!.pages[0]!.graphic;
        expect(charsetFamilyOf(ctx.project, graphic.sprite!.id), name).toBe("scarloxy-people");
      }
    });

    it("허용 밖 칩은 거부되고 가장 가까운 허용 칩이 안내되며 맵은 그대로다", () => {
      const ctx = ctxOf(lockedProject());
      const before = ctx.project.maps[ctx.project.startMapId]!.events.length;
      const result = placeNpc(ctx, "판타지 청년", 4, { graphic: RTP_YOUTH });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("genre-lock");
      expect(result.issues?.[0]?.message).toContain("tex_scarloxy_charset_people1");
      expect(ctx.project.maps[ctx.project.startMapId]!.events).toHaveLength(before);
    });

    it("허용 칩에 없는 외형 검색은 다른 그림으로 대체하지 않고 거부한다", () => {
      const ctx = ctxOf(lockedProject());
      // 허용 칩(ScarloxyPeople 5~13, #2806 등)에 할머니가 생겼다 — 허용 칩에 여전히 없는 외형(공주)으로 본다.
      const result = placeNpc(ctx, "공주", 4, { graphic: { query: "공주" } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("장르 잠금");
    });

    it("배우의 걷기 그림을 허용 밖으로 바꾸는 것도 거부한다", () => {
      const ctx = ctxOf(lockedProject());
      const result = runTool(ctx, "upsert_actor", { actor: { id: "actor_rival", name: "라이벌", classId: "class_hero", characterResourceId: "easyrpg-charset-actor3", characterIndex: 1 } }, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("genre-lock");
    });

    it("기물·몬스터 칩은 허용한다", () => {
      const project = lockedProject();
      expect(genreLockAllowsCharset(project, "tex_easyrpg_charset_object1")).toBe(true);
      expect(genreLockAllowsCharset(project, "easyrpg-charset-monster4")).toBe(true);
      expect(genreLockAllowsCharset(project, "tex_easyrpg_charset_people1")).toBe(false);
      expect(genreLockAllowsCharset(project, "tex_oprn_charset_wizarding1")).toBe(false);
      expect(genreLockAllowsCharset(project, "tex_oprn_charset_heroes1")).toBe(false);
    });

    it("사용자 손 편집 경로(assistantRun 아님)와 잠금 해제 뒤에는 막지 않는다", () => {
      const hand = ctxOf(lockedProject(), false);
      expect(placeNpc(hand, "사용자 청년", 4, { graphic: RTP_YOUTH }).ok).toBe(true);
      const ctx = ctxOf(lockedProject());
      expect(runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genreLock).toBeUndefined();
      expect(placeNpc(ctx, "해제 뒤 청년", 4, { graphic: RTP_YOUTH }).ok).toBe(true);
    });

    it("이미 그려진 그림은 위반으로 세지 않는다(새로 생기거나 바뀐 것만)", () => {
      const project = createBlankProject();
      const hand = ctxOf(project, false);
      expect(placeNpc(hand, "원래 있던 청년", 4, { graphic: RTP_YOUTH }).ok).toBe(true);
      const before = hand.project;
      enableGenreLock(before, "monster-collect");
      expect(genreLockCharsetViolations(before, before)).toEqual([]);
      const ctx = ctxOf(before);
      expect(runTool(ctx, "set_map_properties", { mapId: before.startMapId, name: "이름만 바꿈" }, { dryRun: false }).ok).toBe(true);
    });

    it("캐릭터 잠금이 생기기 전에 켠 잠금도 표를 따르고, 다시 켜면 저장본에 복사된다", () => {
      const project = createBlankProject();
      enableGenreLock(project, "monster-collect");
      const { allowedCharsetFamilies: _drop, ...legacyLock } = project.system.genreLock!;
      project.system.genreLock = legacyLock;
      const ctx = ctxOf(project);
      expect(placeNpc(ctx, "청년", 4, { graphic: RTP_YOUTH }).ok).toBe(false);
      expect(enableGenreLock(ctx.project, "monster-collect")).toBe(true);
      expect(ctx.project.system.genreLock!.allowedCharsetFamilies).toBeDefined();
    });

    // #2731 부터 연애 잠금도 캐릭터 칩을 잠근다(현대 연애 인물 칩·기물·올린 칩만) — RTP 판타지 사람 칩은 조수 경로에서 거부된다.
    it("연애 잠금은 현대 인물 칩만 허용한다", () => {
      const project = createBlankProject();
      enableGenreLock(project, "romance");
      expect(project.system.genreLock!.allowedCharsetFamilies).toEqual(["modern", "object", "uploaded"]);
      const result = placeNpc(ctxOf(project), "청년", 4, { graphic: RTP_YOUTH });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("장르 잠금");
    });
  });
  describe("몬스터 장르 표지(system.genre)", () => {
    function noKitProject(): Project {
      const project = createBlankProject();
      for (const id of Object.keys(project.tilesets)) if (id.includes("monster_")) delete project.tilesets[id];
      return project;
    }

    it("잠금이 못 걸리는 프로젝트도 몬스터 전용 도구가 성공하면 표지만 남기고 잠그지 않는다", () => {
      // 역방향 잠금(#2812): 몬스터 게임이 아닌 프로젝트에서는 몬스터 수집 요청 턴(monsterTurn)에만 몬스터 도구가 풀린다.
      const ctx: ToolContext = { ...ctxOf(noKitProject()), monsterTurn: true };
      expect(runTool(ctx, "configure_monster_system", { enabled: true }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genre).toBe("monster-collect");
      expect(ctx.project.system.genreLock).toBeUndefined();
      expect(placeNpc(ctx, "청년", 4, { graphic: RTP_YOUTH }).ok).toBe(true);   // 표지만 있으면 막지 않는다
    });

    it("표지만 있는 프로젝트의 조수 프롬프트에 매 턴 표지 안내가 실린다", () => {
      const project = noKitProject();
      project.system.genre = "monster-collect";
      expect(genreMarkerNote(project)).toContain("[장르 표지");
      expect(buildPiAgentSystemPrompt(project, [project.startMapId], false, { spatialWork: false }).join("\n")).toContain("[장르 표지");
      expect(buildSystemPrompt(project)).toContain("[장르 표지");
    });

    it("다른 장르가 이미 선언된 프로젝트는 덮어쓰지 않고, 장르가 없으면 안내 줄도 없다", () => {
      const farm = createBlankProject();
      applyGenrePreset(farm, "farm-life");
      // 역방향 잠금(#2812): 몬스터 게임이 아닌 프로젝트에서는 몬스터 수집 요청 턴에만 configure_monster_system 이 돈다 — 표지 규칙은 그 턴에서 본다.
      const ctx: ToolContext = { ...ctxOf(farm), monsterTurn: true };
      expect(runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genre).toBe("farm-life");
      expect(genreMarkerNote(createBlankProject())).toBeNull();
    });

    it("끄기 호출은 표지를 남기지 않고, 해제 뒤에도 프리셋 표지는 남는다", () => {
      const blank: ToolContext = { ...ctxOf(createBlankProject()), monsterTurn: true };   // 역방향 잠금(#2812) — 위와 같다
      expect(runTool(blank, "configure_monster_system", { enabled: false }, { dryRun: false }).ok).toBe(true);
      expect(blank.project.system.genre).toBeUndefined();
      const ctx = ctxOf(lockedProject());
      runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false });
      expect(ctx.project.system.genre).toBe("monster-collect");
    });

    it("몬스터 의도 시작은 잠금과 함께 표지를 남긴다", () => {
      const project = createBlankProject();
      expect(applyMonsterIntentStart(project)).toEqual({ opened: true, locked: true });
      expect(project.system.genre).toBe("monster-collect");
      expect(hero(project).characterResourceId).toBe("scarloxy-charset-people1");
    });
  });
  describe("생성한 캠페인 맞추기", () => {
    it("허용 밖 사람 칩을 같은 인물은 같은 칩으로, 관장은 보스 칩으로 바꾼다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const make = (id: string, characterIndex: number) => ({ id, name: id, x: 1, y: 1, pages: [{ id: `${id}_p`, name: "p", conditions: [], graphic: { sprite: { type: "bundled" as const, id: "tex_easyrpg_charset_people1" }, direction: "down" as const, pattern: 25 + (characterIndex % 4) * 3 + Math.floor(characterIndex / 4) * 48 + 1 }, commands: [] }] }) as never;
      map.events.push(make("a_resident", 2), make("b_resident", 2), make("grove_gym_leader", 2));
      const result = remapCharsetsToPreset(project, "monster-collect");
      expect(result.pagesChanged).toBe(3);
      const chips = map.events.map((event) => {
        const graphic = event.pages[0]!.graphic;
        return `${graphic.sprite!.id}#${decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex}`;
      });
      expect(chips[0]).toBe(chips[1]);                                  // 같은 원래 칩 → 같은 새 칩
      expect(chips.every((chip) => chip.startsWith("tex_scarloxy_charset_people") || chip.startsWith("tex_oprn_charset_scarloxy_people"))).toBe(true);   // 원본 People1~2 와 그 변형 ScarloxyPeople
      expect(chips[2]).not.toBe(chips[0]);                              // 관장 → 보스 칩
      // #2731 부터 연애 잠금도 캐릭터 칩을 잠근다 — 몬스터 칩(Scarloxy)은 연애 허용 밖이라 세 장 모두 현대 인물 칩으로 다시 맞춘다.
      expect(remapCharsetsToPreset(project, "romance").pagesChanged).toBe(3);
    });
    it("Scarloxy 변형 사람 칩(ScarloxyPeople)은 몬스터 수집 잠금이 허용하고 RTP 사람 칩은 여전히 거부한다", () => {
      expect(charsetFamilyOf(undefined, "tex_oprn_charset_scarloxy_people1")).toBe("scarloxy-people");
      expect(charsetFamilyOf(undefined, "oprn-charset-scarloxy-people3")).toBe("scarloxy-people");
      const ctx = ctxOf(lockedProject());
      const nurse = placeNpc(ctx, "간호사", 4, { graphic: { textureKey: "tex_oprn_charset_scarloxy_people1", characterIndex: 3 } });
      expect(nurse.ok).toBe(true);
      const denied = placeNpc(ctx, "판타지 청년", 6, { graphic: RTP_YOUTH });
      expect(denied.ok).toBe(false);
      expect(denied.issues?.[0]?.code).toBe("genre-lock");
    });
    it("Scarloxy 변형 사람 칩 2차(ScarloxyPeople5~10)도 같은 계열이라 허용되고 RTP 사람 칩은 계속 거부된다", () => {
      for (const n of [5, 8, 10]) expect(charsetFamilyOf(undefined, `tex_oprn_charset_scarloxy_people${n}`)).toBe("scarloxy-people");
      expect(charsetFamilyOf(undefined, "oprn-charset-scarloxy-people10")).toBe("scarloxy-people");
      const ctx = ctxOf(lockedProject());
      const clerk = placeNpc(ctx, "점원", 5, { graphic: { textureKey: "tex_oprn_charset_scarloxy_people5", characterIndex: 0 } });
      expect(clerk.ok).toBe(true);
      const boss = placeNpc(ctx, "드래곤 도장 보스", 7, { graphic: { textureKey: "tex_oprn_charset_scarloxy_people8", characterIndex: 1 } });
      expect(boss.ok).toBe(true);
      const denied = placeNpc(ctx, "판타지 청년", 9, { graphic: RTP_YOUTH });
      expect(denied.ok).toBe(false);
    });
    it("사용자가 뺀 ScarloxyPeople8#3·5#6 칸은 비워 둔 채 의미표·카탈로그에 노출되지 않고 다른 칸 번호는 그대로다", async () => {
      const { SCARLOXY_PEOPLE_CHARSET_SEMANTICS } = await import("@/assets/scarloxyPeopleCharsets");
      const sheet8 = SCARLOXY_PEOPLE_CHARSET_SEMANTICS.filter((entry) => entry.textureKey === "tex_oprn_charset_scarloxy_people8").map((entry) => entry.characterIndex);
      expect(sheet8).toEqual([0, 1, 2, 4, 5, 6, 7]);
      const sheet5 = SCARLOXY_PEOPLE_CHARSET_SEMANTICS.filter((entry) => entry.textureKey === "tex_oprn_charset_scarloxy_people5").map((entry) => entry.characterIndex);
      expect(sheet5).toEqual([0, 1, 2, 3, 4, 5, 7]);
      expect(SCARLOXY_PEOPLE_CHARSET_SEMANTICS.some((entry) => entry.tags?.some((tag) => tag === "scarloxy-student-gakuran" || tag === "scarloxy-captain"))).toBe(false);
      // 1~10 시트 68칸 + 갤러리 4 합성 22칸(시트 11~13) + 아스트라 캐스트 시트 14 의 4칸(#3225)
      expect(SCARLOXY_PEOPLE_CHARSET_SEMANTICS).toHaveLength(94);
    });
  });
});

// 장르 잠금 — 얼굴·전투 그림(faceset·몬스터 전투 그림·트레이너·전투 배경) 잠금(2026-10-16).
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
// 같은 시나리오를 실제 SQLite 저장·재로드까지 돌린 헤드리스 증거: scripts/qa/monster-lock-visuals-evidence.mts (35/35).
describe("genreLockVisuals", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  function lockedProject(): Project {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    return project;
  }
  const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun });
  const run = (ctx: ToolContext, name: string, args: Record<string, unknown>) => runTool(ctx, name, args, { dryRun: false });
  const message = (result: { issues?: readonly { message: string }[]; summary: string }) => result.issues?.[0]?.message ?? result.summary;
  const warnings = (result: { diff?: { warnings?: readonly string[] } }) => JSON.stringify(result.diff?.warnings ?? []);
  describe("얼굴·전투 그림 계열 분류", () => {
    it("얼굴을 계열로 가른다", () => {
      expect(faceFamilyOf(undefined, "easyrpg-faceset-actor1-02")).toBe("fantasy-people-face");
      expect(faceFamilyOf(undefined, "easyrpg-faceset-monster-00")).toBe("fantasy-creature-face");
      expect(faceFamilyOf(undefined, "easyrpg-faceset-people2-09")).toBe("fantasy-creature-face");
      expect(faceFamilyOf(undefined, "generated-faceset-missing-scarloxy-03")).toBe("scarloxy-face");
      expect(faceFamilyOf(undefined, "generated-faceset-missing-monster-01")).toBe("oprn-creature-face");
      expect(faceFamilyOf(undefined, "shared-people1-boy-expressions-bust-base")).toBe("fantasy-people-face");
    });

    it("전투 그림·트레이너·배경을 계열로 가른다", () => {
      expect(battlerFamilyOf(undefined, "scarloxy-monster-finiette")).toBe("scarloxy-monster");
      expect(battlerFamilyOf(undefined, "harness-monster-sparkit-front")).toBe("harness-monster");
      expect(battlerFamilyOf(undefined, "generated-enemy-slime-01")).toBe("generic-enemy");
      expect(trainerArtFamilyOf(undefined, "girl", new Set(["girl"]))).toBe("oprn-trainer");
      expect(trainerArtFamilyOf(undefined, "ninja", new Set(["girl"]))).toBe("unknown");
      expect(backdropFamilyOf(undefined, "emerald:forest")).toBe("emerald-terrain");
      expect(backdropFamilyOf(undefined, "battle-scenery-forest")).toBe("oprn-scenery");
      expect(backdropFamilyOf(undefined, "easyrpg-backdrop-forest1")).toBe("rtp-backdrop");
    });
  });
  describe("잠금 표와 저장", () => {
    it("켤 때 허용 얼굴·전투 그림 계열이 프로젝트로 복사되고 직렬화 왕복을 지난다", () => {
      const project = lockedProject();
      const lock = project.system.genreLock!;
      expect(lock.allowedFaceFamilies).toContain("scarloxy-face");
      expect(lock.allowedFaceFamilies).not.toContain("fantasy-people-face");
      expect(lock.allowedBattleFamilies).toContain("battler:harness-monster");
      expect(lock.allowedBattleFamilies).not.toContain("battler:generic-enemy");
      const back = deserialize(serialize(project));
      expect(back.system.genreLock?.allowedFaceFamilies).toEqual(lock.allowedFaceFamilies);
      expect(back.system.genreLock?.allowedBattleFamilies).toEqual(lock.allowedBattleFamilies);
    });

    it("허용 판정", () => {
      const project = lockedProject();
      expect(genreLockAllowsVisual(project, "face", "generated-faceset-missing-scarloxy-00")).toBe(true);
      expect(genreLockAllowsVisual(project, "face", "easyrpg-faceset-actor1-02")).toBe(false);
      expect(genreLockAllowsVisual(project, "battler", "generated-enemy-slime-01")).toBe(false);
      expect(genreLockAllowsVisual(project, "battler", "harness-monster-sparkit-front")).toBe(true);
      expect(genreLockAllowsVisual(project, "backdrop", "easyrpg-backdrop-forest1")).toBe(false);
    });

    it("연애 프리셋과 잠금 없는 프로젝트는 그대로다", () => {
      const romance = createBlankProject();
      enableGenreLock(romance, "romance");
      expect(romance.system.genreLock?.allowedFaceFamilies).toBeUndefined();
      expect(romance.system.genreLock?.allowedBattleFamilies).toBeUndefined();
      const plain = createBlankProject();
      expect(genreLockAllowsVisual(plain, "battler", "generated-enemy-slime-01")).toBe(true);
    });

    it("필드가 없는 옛 잠금은 표를 따른다", () => {
      const project = lockedProject();
      delete project.system.genreLock!.allowedFaceFamilies;
      delete project.system.genreLock!.allowedBattleFamilies;
      expect(genreLockAllowsVisual(project, "battler", "generated-enemy-slime-01")).toBe(false);
      expect(genreLockAllowsVisual(project, "face", "generated-faceset-missing-scarloxy-02")).toBe(true);
    });
  });
  describe("조수 경로 강제", () => {
    it("허용 밖 얼굴(배우)은 거부하고 대안을 알린다", () => {
      const ctx = ctxOf(lockedProject());
      const result = run(ctx, "upsert_actor", { actor: { id: "actor_rival", name: "라이벌", classId: "class_hero", faceResourceId: "easyrpg-faceset-actor2-03" } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("genre-lock");
      expect(message(result)).toContain("generated-faceset-missing-scarloxy-");
    });

    it("허용 밖 적 그림은 가까운 허용 그림이 있으면 거부한다", () => {
      const ctx = ctxOf(lockedProject());
      const result = run(ctx, "upsert_enemy", { enemy: { id: "enemy_slime_x", name: "초록 슬라임", monsterResourceId: "generated-enemy-slime-01" } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("genre-lock");
      expect(message(result)).toContain("가장 가까운 허용 그림");
    });

    it("허용 그림이 아예 없으면 거부하지 않고 비운 채 「생성 대기」를 남긴다", () => {
      const ctx = ctxOf(lockedProject());
      const result = run(ctx, "upsert_enemy", { enemy: { id: "enemy_skeleton_x", name: "해골 궁수" } });
      expect(result.ok).toBe(true);
      expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_skeleton_x")?.monsterResourceId).toBeUndefined();
      expect(warnings(result)).toContain("생성 대기");
    });

    it("번들에 없는 트레이너 그림 id 는 지어내지 않고 비운다, 확실한 이름은 번들 역할로 채운다", () => {
      const ctx = ctxOf(lockedProject());
      run(ctx, "upsert_enemy", { enemy: { id: "enemy_sparkit_x", name: "스파킷", monsterResourceId: "harness-monster-sparkit-front" } });
      const ninja = run(ctx, "upsert_troop", { troop: { id: "troop_ninja_x", name: "닌자", enemyIds: ["enemy_sparkit_x"], trainerBattle: true, uncapturable: true, trainerSprite: { front: "mystery_ninja" } } });
      expect(ninja.ok).toBe(true);
      expect(ctx.project.database.troops.find((troop) => troop.id === "troop_ninja_x")?.trainerSprite).toBeUndefined();
      expect(warnings(ninja)).toContain("생성 대기");
      run(ctx, "upsert_troop", { troop: { id: "troop_girl_x", name: "소녀 트레이너", enemyIds: ["enemy_sparkit_x"], trainerBattle: true, uncapturable: true } });
      expect(ctx.project.database.troops.find((troop) => troop.id === "troop_girl_x")?.trainerSprite?.front).toBe("girl");
    });

    it("지형의 RTP 전투 배경은 거부된다", () => {
      const ctx = ctxOf(lockedProject());
      const result = run(ctx, "upsert_database_utility", { collection: "terrains", record: { id: "terrain_rtp_x", name: "판타지 지형", damage: 0, encounterRatePercent: 5, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false }, battleBackgroundResourceId: "easyrpg-backdrop-forest1" } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("genre-lock");
    });

    it("사용자 손 편집은 막지 않는다", () => {
      const ctx = ctxOf(lockedProject(), false);
      const result = run(ctx, "upsert_enemy", { enemy: { id: "enemy_hand_x", name: "손 편집", monsterResourceId: "generated-enemy-slime-01" } });
      expect(result.ok).toBe(true);
    });

    it("해제하면 다시 쓸 수 있다", () => {
      const ctx = ctxOf(lockedProject());
      run(ctx, "configure_monster_system", { enabled: false });
      const result = run(ctx, "upsert_enemy", { enemy: { id: "enemy_after_x", name: "해제 뒤", monsterResourceId: "generated-enemy-slime-01" } });
      expect(result.ok).toBe(true);
    });

    it("조수 list_resources 는 허용 그림만, 손 경로는 전부 보인다", () => {
      const project = lockedProject();
      const ids = (ctx: ToolContext) => ((run(ctx, "list_resources", { kind: "faceset", query: "*", limit: 50 }).data as { matches?: { id: string }[] })?.matches ?? []).map((match) => match.id);
      expect(ids(ctxOf(project)).some((id) => faceFamilyOf(project, id) === "fantasy-people-face")).toBe(false);
      expect(ids(ctxOf(project, false)).some((id) => faceFamilyOf(project, id) === "fantasy-people-face")).toBe(true);
    });
  });
});

// 추리 도그푸딩 7회차: 회상 프리셋이 컷신만 찍어 저택을 fill_region 으로 흉내 냈다.
describe("mysteryAuthoringPrompt", () => {
  isolateTimers();
  function names(text: string): string[] {
    return (mentionedToolSchemas(text) as { function: { name: string } }[]).map((tool) => tool.function.name);
  }
  describe("추리 기획 지시", () => {
    it("회상 프리셋이어도 추리 요약이면 실내 시공과 사건 도구를 계획 1순위로 노출한다", () => {
      const brief = interviewBrief("story-cutscene");
      brief.summary += "\n추가 요청: 추리 게임. 독살된 주인의 용의자를 지목한다.";
      const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("story-cutscene")!, brief);
      expect(prompt).toContain("추리 저작 요령");
      expect(prompt.indexOf("추리 저작 요령")).toBeGreaterThan(prompt.indexOf("script_cutscene"));
      expect(prompt).toContain("build_hand_interior_room");
      expect(prompt).toContain("author_mystery_case");
      expect(prompt).toContain("지금은 run_scene_test 를 호출하지 마라");
      const exposed = names(prompt);
      expect(exposed).toEqual(expect.arrayContaining(["list_hand_interior_parts", "build_hand_interior_room", "author_mystery_case", "check_mystery_case"]));
    });

    it("추리 낱말이 없는 회상 기획에는 사건 도구를 심지 않는다", () => {
      const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("story-cutscene")!, interviewBrief("story-cutscene"));
      expect(prompt).not.toContain("추리 저작 요령");
      expect(prompt).not.toContain("author_mystery_case");
    });

    it("시스템 프롬프트는 추리 기획일 때만 실내를 먼저 짓게 한다", () => {
      const mystery = createBlankProject();
      const brief = interviewBrief("story-cutscene");
      brief.summary += "\n추리. 용의자 지목.";
      mystery.gameDesignBrief = brief;
      expect(buildPiAgentSystemPrompt(mystery, [], false).join("\n")).toContain("build_hand_interior_room(plan, 새 mapId)");
      const story = createBlankProject();
      story.gameDesignBrief = interviewBrief("story-cutscene");
      expect(buildPiAgentSystemPrompt(story, [], false).join("\n")).not.toContain("author_mystery_case");
    });
  });
});

// 네 층 타일셋이면 Pi 시스템 프롬프트에 한 줄 — 계획 docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 5.
// 옛 프로젝트(선택 층 없음·표지 없음)의 프롬프트는 그 줄이 생기기 전과 글자까지 같아야 한다.
describe("piAgentSystemPromptFourLayer", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  const isFourLayerLine = (line: string): boolean => line.includes("MZ 네 층");
  function withMarkerReference(project: Project, markdown: string): Project {
    const tilesetId = project.maps[MAP_ID]!.tilesetId;
    const tileset = project.tilesets[tilesetId]!;
    delete tileset.referenceSourceTilesetId;
    tileset.referenceDocuments = [{
      id: "swamp", name: "늪지", description: "늪지 조립", images: [],
      documents: [{ id: "rules", name: "규칙", markdown }],
    }];
    return project;
  }
  describe("Pi 시스템 프롬프트 — 네 층 타일셋 줄", () => {
    it("옛 프로젝트에는 줄이 없고, 네 층 맵이 생긴 프롬프트에서 그 한 줄만 빼면 글자까지 같다", () => {
      const old = createBlankProject();
      const oldLines = buildPiAgentSystemPrompt(old, [MAP_ID]);
      expect(oldLines.some(isFourLayerLine)).toBe(false);
      expect(oldLines.join("\n")).not.toContain("stamp_layer_block");

      const layered = createBlankProject();
      const map = layered.maps[MAP_ID]!;
      setLayerTileAt(map, 2, 0, 10);
      const lines = buildPiAgentSystemPrompt(layered, [MAP_ID]);
      const added = lines.filter(isFourLayerLine);
      expect(added).toHaveLength(1);
      expect(added[0]).toContain("stamp_layer_block");
      expect(added[0]).toContain(map.tilesetId);
      expect(lines.filter((line) => !isFourLayerLine(line)).join("\n")).toBe(oldLines.join("\n"));
    });

    it("같은 타일셋을 쓰는 다른 맵에 선택 층이 있어도 줄이 붙는다", () => {
      const project = createBlankProject();
      const start = project.maps[MAP_ID]!;
      const other = { ...structuredClone(start), id: "map_other" as typeof start.id, name: "다른 맵" };
      other.shadowBits = new Array<number>(other.width * other.height).fill(0);
      other.shadowBits[3] = 1;
      project.maps[other.id] = other;
      expect(buildPiAgentSystemPrompt(project, [MAP_ID]).filter(isFourLayerLine)).toHaveLength(1);
    });

    it("참고문서 용도 첫 문서가 layer-model: mz4 로 시작하면 빈 맵이어도 줄이 붙는다", () => {
      const project = withMarkerReference(createBlankProject(), `${FOUR_LAYER_REFERENCE_MARKER}\n# 늪지 규칙\n...`);
      expect(buildPiAgentSystemPrompt(project, [MAP_ID]).filter(isFourLayerLine)).toHaveLength(1);
    });

    it("표지가 첫 줄이 아니거나 범위가 프로젝트 전체면 붙지 않는다", () => {
      const notFirst = withMarkerReference(createBlankProject(), `# 늪지\n${FOUR_LAYER_REFERENCE_MARKER}\n`);
      expect(buildPiAgentSystemPrompt(notFirst, [MAP_ID]).some(isFourLayerLine)).toBe(false);
      const marked = withMarkerReference(createBlankProject(), `${FOUR_LAYER_REFERENCE_MARKER}\n`);
      expect(buildPiAgentSystemPrompt(marked, []).some(isFourLayerLine)).toBe(false);
    });
  });
});

// 저장 금지 맵의 저장 메뉴 이벤트 — 2026-09-24 꿈 세계 도그푸딩: 일기장이 있는 방까지 저장 금지라 저장할 곳이 없었다.
describe("saveMenuOnLockedMap", () => {
  isolateTimers();
  const diary = { id: "ev_diary", name: "일기장", x: 3, y: 3, trigger: { kind: "action" }, pages: [{ conditions: [], graphic: { transparent: true }, commands: [{ kind: "openSaveMenu" }] }] };
  describe("저장 금지 + 저장 메뉴", () => {
    it("저장 금지 맵에 저장 메뉴 이벤트를 두면 경고한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(runTool(ctx, "set_map_properties", { mapId, flags: { disableSave: true } }).ok).toBe(true);
      const result = runTool(ctx, "upsert_event", { mapId, event: diary });
      expect(result.ok, result.summary).toBe(true);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("저장 금지 맵");
    });

    it("저장 메뉴 이벤트가 있는 맵에 저장 금지를 켜면 경고한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(runTool(ctx, "upsert_event", { mapId, event: diary }).ok).toBe(true);
      const result = runTool(ctx, "set_map_properties", { mapId, flags: { disableSave: true } });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result.diff?.warnings ?? result)).toContain("저장할 수 없게 됩니다");
    });
  });
  describe("장르 기믹 안내(꿈 세계)", () => {
    it("기획에 반복 맵·외형 변화가 있을 때만 도구 경로를 한 줄씩 붙인다", () => {
      const project = createBlankProject();
      const plain = buildPiAgentSystemPrompt(project, []).join("\n");
      expect(plain).not.toContain("loop:");
      (project as { gameDesignBrief?: unknown }).gameDesignBrief = { version: 1, presetId: "story-cutscene", summary: "가장자리가 반대편으로 이어지는 숲, 효과를 얻으면 외형이 바뀐다", answers: {} };
      const dream = buildPiAgentSystemPrompt(project, []).join("\n");
      expect(dream).toContain("set_map_properties loop");
      expect(dream).toContain("m2-024-change-actor-graphic");
      expect(dream).toContain("place_props");
      expect(dream).toContain("place_examine_hotspots");
      expect(dream).toContain("forest_harmony 계열");
      (project as { gameDesignBrief?: unknown }).gameDesignBrief = { version: 1, presetId: "story-cutscene", summary: "볼을 꼬집어 깨어난다", answers: {} };
      expect(buildPiAgentSystemPrompt(project, []).join("\n")).toContain("type:\"switch\"");
    });
  });
});
