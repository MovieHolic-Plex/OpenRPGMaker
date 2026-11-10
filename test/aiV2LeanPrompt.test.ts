import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { buildV2SystemPrompt, PLACE_SPEC_INDEX, placeSpecCards, placeSpecKindOf } from "@/ai/v2/prompt";
import { editOnlyRequest } from "@/ai/v2/request/readers";
import { exposeV2Tools } from "@/ai/v2/toolExposure";
import { INTERIOR_CARD } from "@/ai/v2/builders/interior";
import { createV2Tools } from "@/ai/v2/verbs";
import { V2Session } from "@/ai/v2/turn/session";

const task = "이제 이 서재에 방탈출 규칙을 넣어 줘. 자물쇠에 4자리 비밀번호를 넣어.";
afterEach(() => { delete process.env.OPRN_V2_LEAN_PROMPT; });
/** 이미 지은 게임(이벤트가 있는 맵) — 빈 프로젝트는 첫 장소를 짓는 요청으로 본다. */
function builtProject() {
  const project = createBlankProject();
  (project.maps[project.startMapId]!.events as unknown[]).push({ id: "ev_desk", name: "책상", x: 1, y: 1, pages: [] });
  return project;
}

describe("v2 lean prompt — place specs on demand", () => {
  it("keeps place-building cards out of the system prompt and lists them in one index line", () => {
    const project = builtProject();
    const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
    expect(sys).toContain(PLACE_SPEC_INDEX);
    expect(sys).not.toContain(INTERIOR_CARD);
    expect(sys).not.toContain("[Interior catalog");
  });
  it("place-building and whole-game requests keep the full cards; so does a bare description on an empty project", () => {
    const built = builtProject();
    expect(editOnlyRequest(built, task)).toBe(true);
    expect(editOnlyRequest(built, "마을에 대장간 하나 추가해 줘")).toBe(false);
    expect(editOnlyRequest(built, "새 맵에 동굴을 만들어 줘")).toBe(false);
    expect(editOnlyRequest(built, "방탈출 게임 하나 만들어 줘")).toBe(false);
    // 빈 프로젝트라도 시킨 일이 분명한 작은 요청은 작은 일이다(2026-11-11 B3). 묘사뿐인 글은 첫 장소를 짓는 시작으로 본다.
    expect(editOnlyRequest(createBlankProject(), task)).toBe(true);
    expect(editOnlyRequest(createBlankProject(), "폐업 직전 태엽 장난감 가게")).toBe(false);
    const sys = buildV2SystemPrompt(built, built.startMapId, "마을에 대장간 하나 추가해 줘").join("\n");
    expect(sys).toContain(INTERIOR_CARD);
    expect(sys).not.toContain(PLACE_SPEC_INDEX);
  });
  it("OPRN_V2_LEAN_PROMPT=0 restores the full cards", () => {
    process.env.OPRN_V2_LEAN_PROMPT = "0";
    const project = builtProject();
    const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
    expect(sys).toContain(INTERIOR_CARD);
    expect(sys).not.toContain(PLACE_SPEC_INDEX);
  });
  it("maps place types to spec kinds and gives the interior card with its chipset catalog", () => {
    expect(placeSpecKindOf("cave")).toBe("dungeon");
    expect(placeSpecKindOf("house")).toBe("street");
    expect(placeSpecKindOf(undefined)).toBeUndefined();
    const project = createBlankProject();
    const cards = placeSpecCards("interior", project, project.startMapId, task);
    expect(cards[0]).toBe(INTERIOR_CARD);
    expect(cards[1]).toContain("[Interior catalog");
  });
  it("edit-only requests load place-building verbs on demand", () => {
    const project = builtProject();
    const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
      emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, lazyToolsVia: "call_tool" } as never;
    const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
    const listed = exposure.tools.map((t) => t.name);
    expect(listed).not.toContain("make_place");
    expect(listed).not.toContain("edit_place");
    expect(listed).toContain("add_people");
    expect(listed).toContain("load_tools");
    expect(exposure.lazy.has("make_place")).toBe(true);
    expect(exposure.offered).toContain("edit_place");
  });
  it("the first build call of a kind in a conversation returns its spec instead of building, then builds", async () => {
    const project = builtProject();
    let epoch = 0;
    const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
      emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => epoch } as never;
    const tools = createV2Tools(env, new V2Session());
    const addPeople = tools.find((t) => t.name === "add_people")!;
    const first = await addPeople.execute("a", { people: [{ role: "guard" }] } as never, undefined as never);
    const head = JSON.parse((first.content[0] as { text: string }).text);
    expect(head).toMatchObject({ ok: false, notFailure: true });
    expect((first.content[1] as { text: string }).text).toContain("People spec");
    const second = await addPeople.execute("b", { people: [{ role: "guard" }] } as never, undefined as never);
    expect(JSON.parse((second.content[0] as { text: string }).text).notFailure).toBeUndefined();
    epoch = 1; // conversation was cleared → the spec is given again
    const third = await addPeople.execute("c", { people: [{ role: "guard" }] } as never, undefined as never);
    expect(JSON.parse((third.content[0] as { text: string }).text)).toMatchObject({ notFailure: true });
  });
});
