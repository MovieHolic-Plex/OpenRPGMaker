import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createV2Tools, V2Session } from "@/ai/v2/verbs";
import { MIN_BLUEPRINT_PLACES, MIN_BLUEPRINT_STEPS, thinBlueprintReason } from "@/ai/v2/blueprint";
import { oneProjectGame } from "@/ai/v2/shipChecks";
import type { Project } from "@/project/types";

const WHOLE = "닌자가 성에 잠입하는 게임";
const step = (id: string, place: string, event: string) => ({ id, place, event, action: "살핀다", gives: `${id} 단서`, feeling: "긴장" });
const args = (places: string[], count: number) => ({
  playerGoal: "비밀 문서를 훔쳐 탈출한다",
  steps: Array.from({ length: count }, (_, i) => step(`s${i + 1}`, places[i % places.length]!, `이벤트${i + 1}`)),
  ending: { name: "탈출", how: "문서를 들고 성을 나선다", feeling: "안도" },
});
const envFor = (project: Project, task = WHOLE) => ({
  ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
  emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
}) as never;
const write = (project: Project, session: V2Session, params: unknown, task = WHOLE) =>
  createV2Tools(envFor(project, task), session).find((t) => t.name === "write_blueprint")!.execute("a", params as never, undefined as never);
const summaryOf = (res: unknown): string => JSON.stringify(res);

describe("thinBlueprintReason", () => {
  it("flags one place or fewer than six steps and passes six steps over two places", () => {
    const thin = { ...createBlankProject().gameBlueprint, steps: args(["그림자 성"], 3).steps } as never;
    expect(thinBlueprintReason(thin)).toContain("그림자 성");
    const twoPlacesThreeSteps = { steps: args(["성 앞", "지하"], 3).steps } as never;
    expect(thinBlueprintReason(twoPlacesThreeSteps)).toBeTruthy();
    const ok = { steps: args(["성 앞", "지하", "천수각"], MIN_BLUEPRINT_STEPS).steps } as never;
    expect(thinBlueprintReason(ok)).toBeUndefined();
    expect(MIN_BLUEPRINT_PLACES).toBe(2);
  });
});

describe("write_blueprint thin first draft", () => {
  it("rejects a one-place three-step first blueprint once and does not hang it", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    const res = await write(project, session, args(["그림자 성"], 3));
    expect(summaryOf(res)).toContain("걸지 않았다");
    expect(project.gameBlueprint).toBeUndefined();
    expect(session.blueprintThinRejects).toBe(1);
  });
  it("hangs the same draft on the second call so the model is never stuck", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    await write(project, session, args(["그림자 성"], 3));
    await write(project, session, args(["그림자 성"], 3));
    expect(project.gameBlueprint?.steps.length).toBe(3);
    expect(session.blueprintThinRejects).toBe(1);
  });
  it("hangs a six-step three-place first blueprint on the first call", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6));
    expect(project.gameBlueprint?.steps.length).toBe(6);
    expect(session.blueprintThinRejects).toBe(0);
  });
  it("does not reject a rewrite of an existing blueprint", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6));
    session.blueprintThinRejects = 0;
    await write(project, session, args(["성 앞"], 3));
    expect(project.gameBlueprint?.steps.length).toBe(3);
  });
  it("does not reject a locked-room escape game", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    await write(project, session, args(["작은 방"], 3), "방탈출 게임 만들어 줘");
    expect(project.gameBlueprint?.steps.length).toBe(3);
    expect(oneProjectGame(project, "방탈출 게임 만들어 줘")).toBe(true);
  });
});
