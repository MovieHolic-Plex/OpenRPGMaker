import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createV2Tools, mapViewArtProblems, V2Session } from "@/ai/v2/verbs";
import type { Project } from "@/project/types";

// 오너 2026-11-09: 타이틀·엔딩 그림이 게임 속 맵 화면(map-view)이면, 그림 생성이 가능한 실행은 generate_art 를 먼저 시도해야 한다.
// 시도가 오류/불가로 기록되면 그 실패가 증거라 맵 화면을 받아 준다. 이 시험은 그 «기록이 문을 연다» 와 동사가 실제로 그림을 거는 것을 단언한다.
const WHOLE = "마을 하나 만들어줘. 거기서 시작하는 모험 게임으로";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

function mapViewGame(): Project {
  const p = createBlankProject() as Project;
  p.meta.title = "새벽의 약속";
  p.system.titleScreen = { ...p.system.titleScreen!, title: "새벽의 약속", backgroundResourceId: `map-view:${p.startMapId}` };
  p.gameBlueprint = { request: WHOLE, title: "새벽의 약속", premise: "마을 모험", playerGoal: "등불을 밝힌다", steps: [],
    ending: { name: "새벽", how: "불을 밝힌다", feeling: "희망" } } as never;
  p.endings = [{ id: "e1", name: "새벽의 약속", conditions: [], priority: 0, presentation: { finalTitle: "새벽", backgroundResourceId: `map-view:${p.startMapId}` }, epilogue: [] } as never];
  return p;
}

describe("map-view title/ending needs a generation attempt first", () => {
  it("blocks a map-view title and ending when generation is available and nothing was tried", () => {
    const out = mapViewArtProblems(mapViewGame(), new V2Session(), true, WHOLE);
    expect(out.length).toBe(2);
    expect(out.join("\n")).toContain("art-generation");
  });
  it("does not block when generation is not available in the run", () => {
    expect(mapViewArtProblems(mapViewGame(), new V2Session(), false, WHOLE)).toEqual([]);
  });
  it("a recorded failure opens the gate; a recorded success on a still-map-view picture does not", () => {
    const failed = new V2Session();
    failed.artAttempts.set("title", { status: "failed", error: "provider 503", failures: 2 });
    failed.artAttempts.set("ending", { status: "unavailable" });
    expect(mapViewArtProblems(mapViewGame(), failed, true, WHOLE)).toEqual([]);
    const ok = new V2Session();
    ok.artAttempts.set("title", { status: "ok" });
    expect(mapViewArtProblems(mapViewGame(), ok, true, WHOLE).length).toBeGreaterThan(0);
  });
  it("one transient failure does not open the gate; it takes two failures on the same target", () => {
    const once = new V2Session();
    once.artAttempts.set("title", { status: "failed", error: "provider 503", failures: 1 });
    expect(mapViewArtProblems(mapViewGame(), once, true, WHOLE).some((t) => t.includes("타이틀"))).toBe(true);
  });
  it("ignores requests that are not building a whole game", () => {
    const p = mapViewGame(); p.gameBlueprint = undefined;
    expect(mapViewArtProblems(p, new V2Session(), true, "이 마을에 우물을 놓아 줘")).toEqual([]);
  });
});

describe("generate_art verb", () => {
  const envFor = (project: Project, generateImage?: unknown) => ({
    ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task: WHOLE, provider: "local-cli:claude", mapIds: [], project },
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, ...(generateImage ? { generateImage } : {}),
  }) as never;
  it("records a failure and keeps the picture when the generator throws", async () => {
    const project = mapViewGame(); const session = new V2Session();
    const env = envFor(project, async () => { throw new Error("provider 503"); });
    const verb = createV2Tools(env, session).find((t) => t.name === "generate_art")!;
    const res = await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
    expect(JSON.parse((res.content[0] as { text: string }).text).ok).toBe(false);
    expect(session.artAttempts.get("title")).toMatchObject({ status: "failed", failures: 1 });
  });
  it("a later failure never erases an earlier success, and one throw records 1/2 only", async () => {
    const project = mapViewGame(); const session = new V2Session();
    let calls = 0;
    const env = envFor(project, async () => { calls += 1; if (calls === 1) return { dataUrl: PNG, mimeType: "image/png", model: "m", provider: "p" }; throw new Error("provider 503"); });
    const verb = createV2Tools(env, session).find((t) => t.name === "generate_art")!;
    await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
    await verb.execute("b", { target: "title", prompt: "다른 장면으로 다시 그린 산골 마을의 저녁 풍경" } as never, undefined as never);
    expect(session.artAttempts.get("title")).toMatchObject({ status: "ok" });
  });
  it("records 'unavailable' when the run has no generator", async () => {
    const project = mapViewGame(); const session = new V2Session();
    const verb = createV2Tools(envFor(project), session).find((t) => t.name === "generate_art")!;
    await verb.execute("a", { target: "ending", prompt: "새벽 마을에 등불이 모두 켜지는 장면" } as never, undefined as never);
    expect(session.artAttempts.get("ending")).toMatchObject({ status: "unavailable" });
  });
  it("registers the generated picture and hangs it on the title", async () => {
    const project = mapViewGame(); const session = new V2Session();
    const env = envFor(project, async () => ({ dataUrl: PNG, mimeType: "image/png", model: "m", provider: "p" })) as { ctx: { project: Project } };
    const verb = createV2Tools(env as never, session).find((t) => t.name === "generate_art")!;
    const res = await verb.execute("a", { target: "title", prompt: "산골 마을에 등불이 켜지는 밤, 붉은 목도리의 여행자" } as never, undefined as never);
    expect(JSON.parse((res.content[0] as { text: string }).text).ok).toBe(true);
    const bg = env.ctx.project.system.titleScreen?.backgroundResourceId;
    expect(bg).toMatch(/^gen-title-/);
    expect(JSON.stringify(env.ctx.project.assets ?? env.ctx.project)).toContain(bg!);
    expect(session.artAttempts.get("title")).toMatchObject({ status: "ok" });
    expect(mapViewArtProblems(env.ctx.project, session, true, WHOLE).filter((t) => t.includes("타이틀"))).toEqual([]);
  });
});
