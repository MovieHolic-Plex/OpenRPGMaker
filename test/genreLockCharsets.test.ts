// 장르 잠금 — 캐릭터 칩 잠금 + 장르 표지(2026-10-16).
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
// 같은 시나리오를 실제 SQLite 저장·재로드까지 돌린 헤드리스 증거: scripts/qa/monster-lock-charset-evidence.mts (26/26).
import { beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset, applyMonsterIntentStart } from "@/project/genrePresets";
import { enableGenreLock, genreLockAllowsCharset, genreLockPromptNote, genreMarkerNote } from "@/project/genreLock";
import { genreLockCharsetViolations, remapCharsetsToPreset } from "@/project/genreLockCharsets";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";

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
    expect(charsetFamilyOf(undefined, "tex_oprn_charset_monster_trainer1")).toBe("monster-trainer");
    expect(charsetFamilyOf(undefined, "oprn-charset-monster-trainer2")).toBe("monster-trainer");
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
      expect(["scarloxy-people", "monster-trainer"], name).toContain(charsetFamilyOf(ctx.project, graphic.sprite!.id));
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
    const result = placeNpc(ctx, "할머니", 4, { graphic: { query: "할머니" } });
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

  it("몬스터 트레이너 칩(monster-trainer 계열)은 허용하고, 계열이 더해지기 전에 저장된 잠금도 허용으로 합친다", () => {
    const project = lockedProject();
    expect(genreLockAllowsCharset(project, "tex_oprn_charset_monster_trainer1")).toBe(true);
    expect(project.system.genreLock!.allowedCharsetFamilies).toContain("monster-trainer");
    // 계열을 더하기 전에 켠 잠금: 저장본에는 monster-trainer 가 없다.
    const old = lockedProject();
    old.system.genreLock = { ...old.system.genreLock!, allowedCharsetFamilies: ["scarloxy-people", "oprn-creature", "rtp-creature", "object", "uploaded", "other"] };
    expect(genreLockAllowsCharset(old, "tex_oprn_charset_monster_trainer1")).toBe(true);
    expect(genreLockAllowsCharset(old, "tex_easyrpg_charset_people1")).toBe(false);
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

  it("연애 잠금은 캐릭터를 건드리지 않는다", () => {
    const project = createBlankProject();
    enableGenreLock(project, "romance");
    expect(project.system.genreLock!.allowedCharsetFamilies).toBeUndefined();
    expect(serialize(project)).not.toContain("allowedCharsetFamilies");
    expect(placeNpc(ctxOf(project), "청년", 4, { graphic: RTP_YOUTH }).ok).toBe(true);
  });

  it("잠금 안내에 캐릭터 그림 규칙이 있다(공간 시공·비공간 모두)", () => {
    const project = lockedProject();
    const line = "캐릭터 그림(플레이어·NPC·트레이너 걷기 그림)도 이 장르 칩만 쓴다";
    expect(genreLockPromptNote(project)).toContain(line);
    expect(buildPiAgentSystemPrompt(project, [project.startMapId], false, { spatialWork: true }).join("\n")).toContain(line);
    expect(buildPiAgentSystemPrompt(project, [project.startMapId], false, { spatialWork: false }).join("\n")).toContain(line);
    expect(buildSystemPrompt(project)).toContain(line);
  });
});

describe("몬스터 장르 표지(system.genre)", () => {
  function noKitProject(): Project {
    const project = createBlankProject();
    for (const id of Object.keys(project.tilesets)) if (id.includes("monster_")) delete project.tilesets[id];
    return project;
  }

  it("잠금이 못 걸리는 프로젝트도 몬스터 전용 도구가 성공하면 표지만 남기고 잠그지 않는다", () => {
    const ctx = ctxOf(noKitProject());
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
    const ctx = ctxOf(farm);
    expect(runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.system.genre).toBe("farm-life");
    expect(genreMarkerNote(createBlankProject())).toBeNull();
  });

  it("끄기 호출은 표지를 남기지 않고, 해제 뒤에도 프리셋 표지는 남는다", () => {
    const blank = ctxOf(createBlankProject());
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
    expect(chips.every((chip) => chip.startsWith("tex_scarloxy_charset_people"))).toBe(true);
    expect(chips[2]).not.toBe(chips[0]);                              // 관장 → 보스 칩
    expect(remapCharsetsToPreset(project, "romance").pagesChanged).toBe(0);   // 캐릭터를 안 잠그는 장르는 바꾸지 않는다
  });
});
