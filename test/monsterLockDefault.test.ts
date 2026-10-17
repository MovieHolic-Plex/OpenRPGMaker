// 몬스터 수집 장르 잠금 기본값(2026-10-16) — 연애(#2664)처럼 몬스터 수집으로 시작한 새 프로젝트는 잠금이 기본이다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createProjectStartSeed } from "@/editor/projectStartSeed";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset, applyMonsterIntentStart, needsMonsterKitStart } from "@/project/genrePresets";
import { genreLockHidesTool, genreLockReport, genreLockPromptNote } from "@/project/genreLock";
import { deserialize, serialize } from "@/project/io";

beforeEach(() => resetMapEditHistory());

const MONSTER_TILESETS = ["monster_overworld", "monster_wild", "monster_rooms", "monster_gyms", "monster_dungeon", "monster_coast", "monster_climate"];

describe("몬스터 수집 잠금 기본값", () => {
  it("몬스터 수집 시작 장르(AI 시작)는 잠금이 켜진 채 태어나고 저장·재로드 뒤에도 남는다", async () => {
    const seed = await createProjectStartSeed("monster-collect", "별빛 몬스터", "ai");
    expect(seed.system.genreLock).toMatchObject({ preset: "monster-collect", mode: "enforce" });
    expect(genreLockReport(seed).violations).toHaveLength(0);
    expect(deserialize(serialize(seed)).system.genreLock).toEqual(seed.system.genreLock);
  });

  it("몬스터 시작 예제는 버들항 마을 위에 서지만 그 맵은 위반이 아니라 「잠금 이전부터 있던 맵」이다", async () => {
    const seed = await createProjectStartSeed("monster-collect", "풀숲", "example");
    expect(seed.system.genreLock?.preset).toBe("monster-collect");
    const report = genreLockReport(seed);
    expect(report.violations).toHaveLength(0);
    expect(report.preexisting.length).toBeGreaterThan(0);
  });

  it("다른 장르로 시작한 프로젝트에는 잠금이 없다", async () => {
    const seed = await createProjectStartSeed("adventure-jrpg", "모험", "ai");
    expect(seed.system.genreLock).toBeUndefined();
    expect(serialize(seed)).not.toContain("genreLock");
  });

  it("몬스터 수집 의도(채팅 한 줄)는 손대지 않은 빈 프로젝트를 몬스터 키트로 열고 잠근다", () => {
    const project = createBlankProject();
    expect(needsMonsterKitStart(project)).toBe(true);
    expect(applyMonsterIntentStart(project)).toEqual({ opened: true, locked: true });
    expect(project.maps[project.startMapId]!.tilesetId).toBe("monster_overworld");
    expect(project.system.genreLock).toMatchObject({ preset: "monster-collect", mode: "enforce" });
    // 시작 맵이 「이전부터 있던 맵」으로 잡히지 않는다 — 키트로 옮긴 뒤에 잠갔다.
    expect(genreLockReport(project).preexisting).toHaveLength(0);
    // 두 번째는 할 일이 없다.
    expect(applyMonsterIntentStart(project)).toEqual({ opened: false, locked: false });
  });

  it("이미 게임이 있는 프로젝트(맵 여럿·다른 계열 맵)는 몬스터 의도가 와도 잠그지 않는다", () => {
    const authored = createBlankProject();
    authored.maps.map_blank_start!.events.push({ id: "ev1", name: "주민", x: 1, y: 1, pages: [] } as never);
    expect(applyMonsterIntentStart(authored)).toEqual({ opened: false, locked: false });
    expect(authored.system.genreLock).toBeUndefined();
    expect(authored.maps.map_blank_start!.tilesetId).not.toBe("monster_overworld");
  });

  it("다른 장르를 고른 새 프로젝트는 키트만 열고 잠그지 않으며, 이미 있는 잠금은 바꾸지 않는다", () => {
    const jrpg = createBlankProject();
    applyGenrePreset(jrpg, "adventure-jrpg");
    expect(applyMonsterIntentStart(jrpg)).toEqual({ opened: true, locked: false });
    expect(jrpg.system.genreLock).toBeUndefined();
  });

  it("사용자가 푼 몬스터 프로젝트는 몬스터 의도 문장이 와도 되살아나지 않는다", () => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    const ctx: ToolContext = { project, assistantRun: true, monsterTurn: true };
    expect(runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.system.genreLock).toBeUndefined();
    expect(applyMonsterIntentStart(ctx.project)).toEqual({ opened: false, locked: false });
    expect(ctx.project.system.genreLock).toBeUndefined();
  });
});

describe("몬스터 수집 의도 분류", () => {
  it.each(["몬스터 수집 게임 만들어 줘", "포켓몬 같은 게임 만들어", "대회형 포획 없는 몬스터 배틀 게임 만들어 줘"])("전체 게임 제작 경로도 monsterKit 신호를 낸다: %s", async (text) => {
    const project = createBlankProject();
    const out = await classifyPlainPiTurn({
      project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, autonomy: resolveAutonomy("balanced"),
      declarer: () => { throw new Error("전용 경로는 의도 선언을 부르지 않는다"); }, piTeam: false,
    });
    expect(out.monsterKit).toBe(true);
  });
});

describe("몬스터 잠금 중에도 몬스터 게임 제작 도구는 막히지 않는다", () => {
  const lockedCtx = (): ToolContext => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    return { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true };
  };

  it("몬스터 도구 이름은 하나도 숨겨지지 않는다", () => {
    const { project } = lockedCtx();
    const names = ["build_monster_game", "build_monster_tournament", "build_monster_expedition", "configure_monster_system", "configure_monster_style", "configure_monster_campaign",
      "define_monster_species", "define_monster_families", "rename_monster_species", "give_starter_monsters", "place_trainer", "place_field_obstacle", "set_type_chart", "set_encounter_table",
      "set_shop_stock", "upsert_skill", "upsert_state", "upsert_item", "author_dungeon", "build_hand_interior_room", "create_map", "create_transfer_pair"];
    for (const name of names) expect(genreLockHidesTool(project, name), name).toBe(false);
  });

  it("몬스터 칩셋 7종 맵·동굴(throw 없이)은 만들어진다", () => {
    const ctx = lockedCtx();
    for (const tilesetId of MONSTER_TILESETS) {
      const result = runTool(ctx, "create_map", { name: `m_${tilesetId}`, width: 24, height: 18, tilesetId }, { dryRun: false });
      expect(result.ok, `${tilesetId}: ${result.summary}`).toBe(true);
    }
    expect(runTool(ctx, "author_dungeon", { type: "cave", size: "small", name: "동굴" }, { dryRun: false }).ok).toBe(true);
  });
});

describe("조수 안내", () => {
  it("몬스터 잠금 안내에 새 전투 기능과 HM 필드 기술이 설정되는 곳이 있다", () => {
    const project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    const note = genreLockPromptNote(project)!;
    for (const key of ["statStageEffects", "gen1MajorStatus", "weather", "species.ability", "heldEffect", "captureProfile.condition", "place_field_obstacle"]) expect(note).toContain(key);
    expect(buildSystemPrompt(project)).toContain("place_field_obstacle");
  });

  it("잠금이 없으면 안내 줄도 없다(프롬프트 불변)", () => {
    expect(genreLockPromptNote(createBlankProject())).toBeNull();
  });
});
