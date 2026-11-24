// 변주 카드가 지시문에 실리는 길 — v2 지시문 · v1 단일 지시문 · 팀장 지시문. 몬스터 수집·장르 프리셋(v1 단일)·작은 일은 지시문이 그대로다(diff 0).
// 문장은 못박지 않는다 — 표지(«[이 게임의 변주]») 유무·같은 열쇠의 같은 글·카드가 정한 세계만 본다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { WELCOME_GENRE_PRESETS, buildWelcomeFreeTextPrompt, buildWelcomeGenrePresetPrompt } from "@/editor/welcomeGenrePresets";
import { NEW_PROJECT_CHOICES } from "@/editor/newProjectChoices";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { gameVariation, worldForRequest } from "@/ai/v2/request/world";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { PI_TEAM_ROLES } from "@/ai/piAgent/team";
import { VARIATION_MARK } from "@/ai/variation/card";

const keyOf = (i: number) => JSON.stringify(["project", `variation-prompt-${i}`]);
const marks = (text: string) => text.split("\n").filter((line) => line.includes(VARIATION_MARK)).length;
const story = NEW_PROJECT_CHOICES.find((c) => c.id === "story-cutscene")!;
const POSTER = buildWelcomeFreeTextPrompt("회상 스토리", { label: story.label, tone: story.tone });
const FREE = buildWelcomeFreeTextPrompt("회상 형 게임 만들어 줘");
const monsterChoice = NEW_PROJECT_CHOICES.find((c) => c.id === "monster-collect")!;
const MONSTER = buildWelcomeFreeTextPrompt("몬스터를 잡아 모으는 게임 만들어 줘", { label: monsterChoice.label, tone: monsterChoice.tone });

describe("v2 system prompt", () => {
  it("a first whole-game turn carries exactly one variation card, the same for the same key", () => {
    for (const task of [POSTER, FREE]) {
      const project = createBlankProject();
      const a = buildV2SystemPrompt(project, project.startMapId, task, undefined, keyOf(1)).join("\n");
      expect(marks(a)).toBe(1);
      expect(buildV2SystemPrompt(project, project.startMapId, task, undefined, keyOf(1)).join("\n")).toBe(a);
      expect(buildV2SystemPrompt(project, project.startMapId, task, undefined, keyOf(2)).join("\n")).not.toBe(a);
    }
  });

  it("no key, a small job, a blueprint already written, or a monster-collect game: no card", () => {
    const project = createBlankProject();
    expect(marks(buildV2SystemPrompt(project, project.startMapId, FREE, undefined, undefined).join("\n"))).toBe(0);
    expect(marks(buildV2SystemPrompt(project, project.startMapId, "촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘", undefined, keyOf(1)).join("\n"))).toBe(0);
    const monster = createNewProjectSeed("monster-collect");
    expect(marks(buildV2SystemPrompt(monster, monster.startMapId, MONSTER, undefined, keyOf(1)).join("\n"))).toBe(0);
  });

  it("a recall story is no longer 'no world' for every key: the card's first place decides the world, and the card agrees with it", () => {
    const seed = createNewProjectSeed("story-cutscene");
    let withWorld = 0;
    for (let i = 0; i < 60; i++) {
      const world = worldForRequest(seed, keyOf(i), POSTER);
      const { variation } = gameVariation(seed, keyOf(i), POSTER);
      expect(variation).toBeDefined();
      if (world) {
        withWorld++;
        expect(variation!.world).toBe(world.id);
        expect(variation!.places.every((p) => p.build.via === "world" && p.build.world === world.id)).toBe(true);
      } else {
        expect(variation!.places.length).toBeGreaterThan(0);
        expect(variation!.places.every((p) => p.build.via !== "world")).toBe(true);
      }
    }
    expect(withWorld).toBeGreaterThan(5);
    expect(withWorld).toBeLessThan(60);
  });

  it("a mystery or a touching story is not 'no world and no place' for every key", () => {
    const project = createBlankProject();
    for (const text of ["추리 게임 만들어 줘", "감동적인 이야기 게임 만들어 줘"]) {
      const task = buildWelcomeFreeTextPrompt(text);
      const bare = Array.from({ length: 40 }, (_, i) => gameVariation(project, keyOf(i), task)).filter((r) => !r.world && !r.variation?.places.length);
      expect(bare.length, text).toBe(0);
    }
  });

  it("the world the user names or the key pool picks wins: the card then draws no places", () => {
    const project = createBlankProject();
    const named = buildWelcomeFreeTextPrompt("사막 오아시스가 나오는 판타지 RPG 게임 만들어 줘");
    const { variation, world } = gameVariation(project, keyOf(1), named);
    expect(world).toBeUndefined();
    expect(variation?.places ?? []).toEqual([]);
  });
});

describe("v1 single system prompt", () => {
  it("a first whole-game request with a key carries the card; the same text without the option is unchanged", () => {
    const project = createBlankProject();
    const without = buildPiAgentSystemPrompt(project, [project.startMapId], true, { request: FREE }).join("\n");
    const withCard = buildPiAgentSystemPrompt(project, [project.startMapId], true, { request: FREE, variation: { projectKey: keyOf(1), request: FREE } }).join("\n");
    expect(marks(without)).toBe(0);
    expect(marks(withCard)).toBe(1);
    expect(buildPiAgentSystemPrompt(project, [project.startMapId], true, { request: FREE }).join("\n")).toBe(without);
    const first = gameVariation(project, keyOf(1), FREE, { v1: true }).variation!.places[0]!;
    expect(withCard).toContain(`«${first.ko}»`);
  });

  it("monster-collect, a genre preset first build, a small job and a missing key keep the prompt byte for byte", () => {
    const monster = createNewProjectSeed("monster-collect");
    const jrpg = createNewProjectSeed("adventure-jrpg");
    const preset = buildWelcomeGenrePresetPrompt(WELCOME_GENRE_PRESETS.find((p) => p.id === "adventure-jrpg")!);
    const blank = createBlankProject();
    const cases: [typeof monster, string, string | undefined][] = [
      [monster, MONSTER, keyOf(1)], [jrpg, preset, keyOf(1)], [blank, "촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘", keyOf(1)], [blank, FREE, undefined],
    ];
    for (const [project, request, key] of cases) {
      const a = buildPiAgentSystemPrompt(project, [project.startMapId], true, { request }).join("\n");
      const b = buildPiAgentSystemPrompt(project, [project.startMapId], true, { request, ...(key ? { variation: { projectKey: key, request } } : {}) }).join("\n");
      expect(b).toBe(a);
    }
  });
});

describe("team orchestrator prompt", () => {
  const orchestrate = (project: ReturnType<typeof createBlankProject>, task: string, key?: string) =>
    PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], task, undefined, project.startMapId, key);

  it("carries the card before the user instruction, for free text and for a genre preset first build", () => {
    const blank = createBlankProject();
    const free = orchestrate(blank, FREE, keyOf(1));
    const at = free.findIndex((line) => line.includes(VARIATION_MARK));
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(free.findIndex((line) => line.startsWith("사용자 지시:")));
    const jrpg = createNewProjectSeed("adventure-jrpg");
    const preset = buildWelcomeGenrePresetPrompt(WELCOME_GENRE_PRESETS.find((p) => p.id === "adventure-jrpg")!);
    expect(orchestrate(jrpg, preset, keyOf(1)).filter((line) => line.includes(VARIATION_MARK)).length).toBe(1);
  });

  it("has no card without a key, for a small job, or for a monster-collect game", () => {
    const blank = createBlankProject();
    expect(orchestrate(blank, FREE, undefined).some((line) => line.includes(VARIATION_MARK))).toBe(false);
    expect(orchestrate(blank, "촌장 대사를 좀 더 무뚝뚝하게 바꿔 줘", keyOf(1)).some((line) => line.includes(VARIATION_MARK))).toBe(false);
    const monster = createNewProjectSeed("monster-collect");
    expect(orchestrate(monster, MONSTER, keyOf(1)).some((line) => line.includes(VARIATION_MARK))).toBe(false);
  });
});
