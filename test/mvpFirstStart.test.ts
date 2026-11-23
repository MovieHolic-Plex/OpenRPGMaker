// 새 게임 첫 생성 = 작은 MVP(2026-11-23 오너 «처음엔 맵 3~5개 MVP 만, 키우는 것은 요청 시»).
// 몬스터 캠페인 첫 판(mvpTrim.ts), v2 청사진 기본 크기(scale:"mvp"), 다음 단계 칩 글 모양(nextSteps.ts)을 본다.
import { beforeAll, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { mapsNeed, mvpGame, smallGame } from "@/ai/v2/judge/blueprintScale";
import { mvpNextSteps, nextStepsBlock, splitNextSteps, NEXT_STEPS_HEADING } from "@/ai/nextSteps";
import type { Project } from "@/project/types";

function transfers(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) { for (const item of node) transfers(item, out); return out; }
  if (!node || typeof node !== "object") return out;
  const cmd = node as { kind?: string; mapId?: unknown };
  if (cmd.kind === "transfer" && typeof cmd.mapId === "string") out.push(cmd.mapId);
  for (const value of Object.values(node)) transfers(value, out);
  return out;
}

describe("monster campaign first version (scale mvp)", () => {
  const { project } = createMonsterExpedition({ scale: "mvp" });
  it("keeps exactly town, lab, route 1, next town and its gym", () => {
    expect(Object.keys(project.maps).sort()).toEqual(["mx_map_grove", "mx_map_grove_gym", "mx_map_home", "mx_map_lab", "mx_map_meadow"]);
  });
  it("leaves no door or fallback pointing at a removed map", () => {
    const missing = Object.values(project.maps).flatMap((map) => transfers(map.events)).filter((id) => !project.maps[id]);
    expect(missing).toEqual([]);
    expect(project.maps[project.system.gameOver?.recoveryFallback?.mapId ?? project.startMapId]).toBeDefined();
  });
  it("ends the game when the gym leader is beaten", () => {
    const leader = project.maps.mx_map_grove_gym!.events.find((e) => e.id.endsWith("_leader"))!;
    expect(JSON.stringify(leader.pages)).toContain("\"triggerEnding\"");
  });
  it("puts healing and a shop in front of the removed buildings", () => {
    const people = Object.values(project.maps).flatMap((m) => m.events.map((e) => e.name));
    expect(people).toContain("회복 도우미");
    expect(people).toContain("도구 상인");
  });
});

describe("build_monster_game default size", () => {
  let mvp: Project;
  beforeAll(async () => {
    const blank = createBlankProject();
    const ctx = { project: blank, currentMapId: blank.startMapId };
    const built = await runToolAsync(ctx as never, "build_monster_game", { mode: "create" });
    expect(built.ok).toBe(true);
    mvp = ctx.project;
  }, 60_000);
  it("builds the 5-map first version when no size is given", () => {
    expect(Object.keys(mvp.maps)).toHaveLength(5);
  });
  it("still builds the asked campaign when gymCount is given", async () => {
    const blank = createBlankProject();
    const ctx = { project: blank, currentMapId: blank.startMapId };
    const built = await runToolAsync(ctx as never, "build_monster_game", { mode: "create", gymCount: 1 });
    expect(built.ok).toBe(true);
    expect(Object.keys(ctx.project.maps).length).toBeGreaterThan(5);
  }, 60_000);
});

const blueprintArgs = (extra: Record<string, unknown> = {}) => ({
  title: "숲의 종소리", genre: "모험",
  playerGoal: "숲 너머 동굴의 마물을 물리친다",
  steps: [
    { id: "s1", kind: "talk", place: "마을", event: "촌장", who: "촌장", action: "이야기를 듣는다", gives: "의뢰", feeling: "결심" },
    { id: "s2", kind: "find", place: "숲길", event: "부서진 표지판", action: "살핀다", gives: "동굴 위치", feeling: "긴장" },
    { id: "s3", kind: "battle", place: "동굴", event: "마물", who: "마물", action: "싸운다", gives: "평화", feeling: "안도" },
  ],
  ending: { name: "돌아온 종소리", how: "마물을 쓰러뜨린다", feeling: "안도" },
  ...extra,
});
const writeBlueprint = (project: Project, params: unknown) => createV2Tools({
  ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task: "닌자가 성에 잠입하는 게임", provider: "local-cli:claude", mapIds: [], project },
  emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
} as never, new V2Session()).find((t) => t.name === "write_blueprint")!.execute("a", params as never, undefined as never);

describe("v2 blueprint size", () => {
  it("a first blueprint without scale is the first playable version", async () => {
    const project = createBlankProject() as Project;
    await writeBlueprint(project, blueprintArgs());
    expect(project.gameBlueprint?.scale).toBe("mvp");
    expect(smallGame(project)).toBe(true);
    expect(mvpGame(project)).toBe(true);
    expect(mapsNeed(project, 6)).toBe(3);
  });
  it("keeps scale full when the model writes it", async () => {
    const project = createBlankProject() as Project;
    await writeBlueprint(project, blueprintArgs({ scale: "full" }));
    expect(project.gameBlueprint?.scale).toBe("full");
    expect(smallGame(project)).toBe(false);
    expect(mapsNeed(project, 6)).toBe(6);
  });
});

describe("next step chips text", () => {
  it("round-trips the block the final report appends", () => {
    const steps = mvpNextSteps(createBlankProject());
    expect(steps[0]).toBe("다음 지역 만들어 줘");
    const split = splitNextSteps(`완료했습니다.\n\n${nextStepsBlock(steps)}`);
    expect(split.body).toBe("완료했습니다.");
    expect(split.steps).toEqual(steps);
  });
  it("leaves an answer alone when the heading is not followed by list lines only", () => {
    const text = `${NEXT_STEPS_HEADING}\n그냥 문장`;
    expect(splitNextSteps(text)).toEqual({ body: text, steps: [] });
  });
});
