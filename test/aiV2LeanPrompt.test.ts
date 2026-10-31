import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { buildV2SystemPrompt, PLACE_SPEC_INDEX, placeSpecCards, placeSpecKindOf } from "@/ai/v2/prompt";
import { INTERIOR_CARD } from "@/ai/v2/builders/interior";
import { createV2Tools, V2Session } from "@/ai/v2/verbs";

const task = "이제 이 서재에 방탈출 규칙을 넣어 줘. 자물쇠에 4자리 비밀번호를 넣어.";
afterEach(() => { delete process.env.OPRN_V2_LEAN_PROMPT; });

describe("v2 lean prompt — place specs on demand", () => {
  it("keeps place-building cards out of the system prompt and lists them in one index line", () => {
    const project = createBlankProject();
    const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
    expect(sys).toContain(PLACE_SPEC_INDEX);
    expect(sys).not.toContain(INTERIOR_CARD);
    expect(sys).not.toContain("[Interior catalog");
  });
  it("OPRN_V2_LEAN_PROMPT=0 restores the full cards", () => {
    process.env.OPRN_V2_LEAN_PROMPT = "0";
    const project = createBlankProject();
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
  it("the first build call of a kind in a conversation returns its spec instead of building, then builds", async () => {
    const project = createBlankProject();
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
