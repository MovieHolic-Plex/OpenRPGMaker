// 장르 잠금 — 얼굴·전투 그림(faceset·몬스터 전투 그림·트레이너·전투 배경) 잠금(2026-10-16).
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
// 같은 시나리오를 실제 SQLite 저장·재로드까지 돌린 헤드리스 증거: scripts/qa/monster-lock-visuals-evidence.mts (35/35).
import { beforeEach, describe, expect, it } from "vitest";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import { enableGenreLock, genreLockPromptNote } from "@/project/genreLock";
import { genreLockAllowsVisual } from "@/project/genreLockVisuals";
import { deserialize, serialize } from "@/project/io";
import { backdropFamilyOf, battlerFamilyOf, faceFamilyOf, trainerArtFamilyOf } from "@/project/visualFamily";
import type { Project } from "@/project/types";

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

describe("프롬프트", () => {
  it("잠금 덩어리와 조수 프롬프트에 얼굴·전투 그림 줄이 실린다", () => {
    const project = lockedProject();
    expect(genreLockPromptNote(project)).toContain("전투 그림");
    const prompt = buildPiAgentSystemPrompt(project, [project.startMapId], false, { spatialWork: false }).join("\n");
    expect(prompt).toContain("얼굴·흉상·전투 그림(몬스터·트레이너·전투 배경·전투 화면)도 이 장르 계열만");
  });
});
