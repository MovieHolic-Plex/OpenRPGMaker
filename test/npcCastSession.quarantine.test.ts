// 세션 훅 — 툴 라운드가 대사 없는 NPC 를 남기면 캐스트 라이터(lite 모델)가 한 장의 시트로 채운다.
//
// 왜 세션인가: 툴은 순수·동기라 LLM 을 부를 수 없다. 대사는 라운드 단위로 한꺼번에 써야 주민끼리 서로를
// 언급할 수 있고(한 명씩 쓰면 옆집 이름을 모른다), 세계관 다이제스트도 한 번만 실으면 된다.
// 실패하면 대체 문구를 넣지 않는다 — 모델에게 place_npc {id, dialogue} 로 채우라고 재킥한다.
import { describe, expect, it } from "vitest";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import type { Command, GameEvent } from "@/project/types";

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", liteModel: "stub-model", apiKey: "sk", maxToolCalls: 8, maxTokens: 512, agentMode: "chat" as const };
const MAP_ID = "map_blank_start";

async function load() {
  const [assistantSession, defaults] = await Promise.all([import("@/ai/assistantSession"), import("@/project/defaults")]);
  return { AssistantSession: assistantSession.AssistantSession, createBlankProject: defaults.createBlankProject };
}

function toolCall(name: string, args: unknown, id = `c_${name}`): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function final(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

function isCastWriterRequest(req: ChatRequest): boolean {
  return req.response_format?.type === "json_object" && String(req.messages[0]?.content ?? "").includes("캐스트");
}

function textBodies(event: GameEvent): string[] {
  return (event.pages ?? []).flatMap((page) => page.commands.filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text").map((command) => command.body));
}

const NPC_ARGS = [
  { mapId: MAP_ID, x: 3, y: 3, name: "주민 1", pages: [{}], id: "ev_cast_a" },
  { mapId: MAP_ID, x: 6, y: 3, name: "주민 2", pages: [{}], id: "ev_cast_b" },
  { mapId: MAP_ID, x: 9, y: 3, name: "주민 3", pages: [{}], id: "ev_cast_c" },
];

const SPEC = {
  mapId: MAP_ID,
  title: "강가 어촌 주민 배치",
  assets: [
    { id: "npc_a", kind: "npc", x: 3, y: 3, w: 1, h: 1, overExisting: "keep" },
    { id: "npc_b", kind: "npc", x: 6, y: 3, w: 1, h: 1, overExisting: "keep" },
    { id: "npc_c", kind: "npc", x: 9, y: 3, w: 1, h: 1, overExisting: "keep" },
  ],
  buildOrder: ["npc"],
  density: "normal",
  layoutStyle: "straight",
  pathWidth: 1,
};

const CAST_SHEET = {
  residents: [
    { eventId: "ev_cast_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_cast_b"], pages: [{ pageId: "ev_cast_a_p0", lines: ["다래 아주머니 가게에 오늘 잡은 은어를 넘겼어요.", "강물지기단이 상류를 막은 뒤로 물고기가 줄었지요."] }] },
    { eventId: "ev_cast_b", name: "다래", role: "잡화점 주인", summary: "장터를 지키는 상인", knows: ["ev_cast_a", "ev_cast_c"], pages: [{ pageId: "ev_cast_b_p0", lines: ["은호가 가져온 은어가 오늘의 특산이에요.", "무영 영감은 강물지기단 얘기만 나오면 입을 닫아요."] }] },
    { eventId: "ev_cast_c", name: "무영", role: "은퇴한 뱃사공", summary: "강물지기단과 얽힌 과거가 있다", knows: ["ev_cast_b"], pages: [{ pageId: "ev_cast_c_p0", lines: ["다래 가게 앞 벤치가 내 자리지."] }] },
  ],
};

function projectWithWorld(createBlankProject: () => import("@/project/types").Project) {
  const project = createBlankProject();
  project.world = {
    entities: [{ id: "w_faction_river", type: "faction", name: "강물지기단", summary: "상류를 다스리는 길드", origin: "user" }],
    relations: [],
  };
  return project;
}

describe("캐스트 라이터 세션 훅", () => {
  it("대사 없는 NPC 3명이 놓인 라운드 뒤 캐스트 시트가 적용되고 세계관에 주민이 등록된다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = projectWithWorld(createBlankProject);
    const mainScript = [
      toolCall("set_build_spec", SPEC, "c0"),
      toolCall("place_npc", NPC_ARGS[0], "c1"),
      toolCall("place_npc", NPC_ARGS[1], "c2"),
      toolCall("place_npc", NPC_ARGS[2], "c3"),
      final("주민 세 명을 배치했습니다."),
    ];
    let castRequests = 0;
    let castPrompt = "";
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      if (isCastWriterRequest(req)) {
        castRequests += 1;
        castPrompt = req.messages.map((message) => String(message.content)).join("\n");
        return final(JSON.stringify(CAST_SHEET));
      }
      const next = mainScript.shift();
      if (!next) throw new Error("scripted chat exhausted");
      return next;
    };
    const session = new AssistantSession(project, { config: CONFIG, chat });

    const result = await session.sendUserMessage("강가 어촌 마을에 주민 세 명을 놓아줘", () => {});

    expect(castRequests).toBe(1);
    expect(castPrompt).toContain("강물지기단");
    expect(castPrompt).toContain("ev_cast_a_p0");
    const events = session.getProposedProject().maps[MAP_ID]!.events;
    const names = ["ev_cast_a", "ev_cast_b", "ev_cast_c"].map((id) => events.find((event) => event.id === id)!.pages![0]!.name);
    expect(names).toEqual(["은호", "다래", "무영"]);
    const lines = ["ev_cast_a", "ev_cast_b", "ev_cast_c"].map((id) => textBodies(events.find((event) => event.id === id)!));
    expect(lines.every((bodies) => bodies.length >= 1)).toBe(true);
    expect(lines.filter((bodies) => bodies.some((body) => names.some((name) => body.includes(name)))).length).toBeGreaterThanOrEqual(2);
    expect(lines.flat().some((body) => body.includes("강물지기단"))).toBe(true);
    const world = session.getProposedProject().world!;
    expect(world.entities.filter((entity) => entity.type === "character")).toHaveLength(3);
    expect(world.relations.some((relation) => relation.kind === "knows")).toBe(true);
    const castProposal = result.proposedCalls.find((call) => call.name === "author_npc_cast");
    expect(castProposal).toBeTruthy();
    expect(castProposal!.result.diff?.eventsModified).toBe(3);
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && String(entry.text).includes("npc-cast:applied"))).toBe(true);
  }, 30000);

  it("시트가 두 번 연속 깨지면 대체 문구 없이 모델에게 대사를 직접 쓰라고 재킥한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = projectWithWorld(createBlankProject);
    const mainScript = [
      toolCall("set_build_spec", SPEC, "c0"),
      toolCall("place_npc", NPC_ARGS[0], "c1"),
      toolCall("place_npc", NPC_ARGS[1], "c2"),
      final("주민을 배치했습니다."),
      final("확인했습니다."),
    ];
    let castRequests = 0;
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      if (isCastWriterRequest(req)) {
        castRequests += 1;
        return final("{\"residents\": \"nope\"");
      }
      const next = mainScript.shift();
      if (!next) throw new Error("scripted chat exhausted");
      return next;
    };
    const session = new AssistantSession(project, { config: CONFIG, chat });

    await session.sendUserMessage("강가 어촌 마을에 주민 둘을 놓아줘", () => {});

    expect(castRequests).toBe(2);
    const audit = session.getAuditEntries();
    expect(audit.some((entry) => entry.kind === "status" && String(entry.text).includes("npc-cast:failed"))).toBe(true);
    const rekick = audit
      .filter((entry): entry is Extract<typeof entry, { kind: "status" }> => entry.kind === "status")
      .find((entry) => entry.text.includes("오케스트레이션 주입") && entry.text.includes("대사 없는 NPC"));
    expect(rekick).toBeTruthy();
    expect(rekick!.text).toContain("ev_cast_a");
    const events = session.getProposedProject().maps[MAP_ID]!.events;
    for (const id of ["ev_cast_a", "ev_cast_b"]) expect(textBodies(events.find((event) => event.id === id)!)).toEqual([]);
  }, 30000);
});
