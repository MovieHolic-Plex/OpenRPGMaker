import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { MIN_BLUEPRINT_PLACES, MIN_BLUEPRINT_STEPS, thinBlueprintReason } from "@/ai/v2/story/blueprint";
import { oneProjectGame } from "@/ai/v2/request/readers";
import type { Project } from "@/project/types";

const WHOLE = "닌자가 성에 잠입하는 게임";
const step = (id: string, place: string, event: string) => ({ id, place, event, action: "살핀다", gives: `${id} 단서`, feeling: "긴장" });
// 단계 종류를 섞는다(사람 둘·싸움·번호 자물쇠) — 전부 «살펴본다» 인 초안은 종류 검사(stepMixProblems)가 한 번 돌려보낸다.
const KINDS = [{ kind: "talk", who: "문지기 겐" }, { kind: "find" }, { kind: "battle", who: "그림자 무사" }, { kind: "puzzle" }, { kind: "talk", who: "하녀 유키" }, { kind: "find" }] as const;
const args = (places: string[], count: number, kinded = true) => ({
  genre: "잠입 액션",
  playerGoal: "비밀 문서를 훔쳐 탈출한다",
  steps: Array.from({ length: count }, (_, i) => ({ ...step(`s${i + 1}`, places[i % places.length]!, `이벤트${i + 1}`), ...(kinded ? KINDS[i % KINDS.length] : {}) })),
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

// 2026-11-16(오너 「벽을 기본값으로」): 얇은 초안·종류가 안 섞인 초안을 돌려보내지 않는다 — 건 뒤 알림으로 적는다(거절은 게임이 깨질 때만).
describe("write_blueprint thin first draft", () => {
  it("hangs a one-place three-step first blueprint and says so as a notice, not a rejection", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    const res = summaryOf(await write(project, session, args(["그림자 성"], 3)));
    expect(project.gameBlueprint?.steps.length).toBe(3);
    expect(res).toContain("Notice — saved as written, nothing is rejected");
    expect(res).toContain("3 step(s) over 1 place(s)");
    // 크기를 안 적은 첫 청사진은 첫 판 MVP 다(2026-11-23) — 알림은 MVP 크기(장소 2곳·단계 3)를 말한다.
    expect(project.gameBlueprint?.scale).toBe("mvp");
    expect(res).toContain("first playable version (mvp)");
  });
  it("gives no notice for a six-step three-place first blueprint", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    const res = summaryOf(await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6)));
    expect(project.gameBlueprint?.steps.length).toBe(6);
    expect(res).not.toContain("Notice — saved as written");
  });
  it("hangs a six-step draft whose steps are all examine and names the missing kinds in the notice", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    const flat = args(["성 앞", "지하 통로", "천수각"], 6, false);
    const res = summaryOf(await write(project, session, flat));
    expect(project.gameBlueprint?.steps.length).toBe(6);
    expect(res).toContain("named");
    expect(res).toContain("no battle step");
    expect(res).toContain("3 find steps in a row");
  });
  it("a model-written scale:small and battles:false take the size and fight lines out of the notice", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    const small = { ...args(["역 앞 상점가", "라멘집"], 4, false), scale: "small", battles: false };
    const res = summaryOf(await write(project, session, small, "짧은 이야기 게임을 만들어 줘. 전투는 없어도 돼."));
    // #4948: 새 게임의 첫 청사진은 모델이 scale:"small" 을 적어도 첫 판 MVP 로 둔다(엔딩 없음). MVP 기준(장소 2·단계 3 이상)을 넘으니
    // 크기 줄은 여전히 빠지고, battles:false 는 싸움 줄을 뺀다.
    expect(project.gameBlueprint?.scale).toBe("mvp");
    expect(project.gameBlueprint?.battles).toBe(false);
    expect(res).not.toContain("step(s) over");
    expect(res).not.toContain("no battle step");
  });
  it("gives no notice on a rewrite of an existing blueprint", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6));
    const res = summaryOf(await write(project, session, args(["성 앞"], 3)));
    expect(project.gameBlueprint?.steps.length).toBe(3);
    expect(res).not.toContain("Notice — saved as written");
  });
  it("gives no notice when only the request sentence says escape room", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    const res = summaryOf(await write(project, session, args(["작은 방"], 3), "밀실 탈출 게임 만들어 줘"));
    expect(project.gameBlueprint?.steps.length).toBe(3);
    expect(res).not.toContain("Notice — saved as written");
  });
  it("does not reject a locked-room escape game", async () => {
    const project = createBlankProject() as Project; const session = new V2Session();
    await write(project, session, args(["작은 방"], 3), "방탈출 게임 만들어 줘");
    expect(project.gameBlueprint?.steps.length).toBe(3);
    expect(oneProjectGame(project, "방탈출 게임 만들어 줘")).toBe(true);
  });
});
