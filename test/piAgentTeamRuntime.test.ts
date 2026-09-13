// 팀 런타임의 배정 계약. 하위 에이전트는 가짜 실행기로 갈음하고(LLM 은 결정적으로 만들 수 없다)
// 팀장 툴을 직접 호출해 런타임의 락·예산·병합·안전망을 검증한다.
import { describe, expect, it } from "vitest";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { PiTeamSpec } from "@/ai/piAgent/teamSpec";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { runPiTeam, type RunPiTeamOptions } from "../scripts/lib/piTeamRuntime";

function seeded(): Project {
  const ctx = { project: createBlankProject() };
  runTool(ctx, "create_map", { id: "map_a", name: "A", width: 10, height: 10 });
  runTool(ctx, "create_map", { id: "map_b", name: "B", width: 10, height: 10 });
  return ctx.project;
}

const TEAM: PiTeamSpec = {
  version: 1,
  orchestratorNotes: "",
  members: [
    { id: "builder", label: "시공", kind: "builder", summary: "짓는다", prompt: "짓는다", toolDomains: [], maxTurns: 5, enabled: true },
    { id: "decorator", label: "장식", kind: "builder", summary: "꾸민다", prompt: "꾸민다", toolDomains: [], maxTurns: 5, enabled: true },
    { id: "reviewer", label: "검수", kind: "reviewer", summary: "본다", prompt: "본다", toolDomains: [], maxTurns: 5, enabled: true },
  ],
};

function request(project: Project): PiAgentRequest {
  return { mode: "team", provider: "test", task: "마을을 지어라", mapIds: [], project, team: TEAM };
}

const NO_STATS = { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 };

function doneWith(project: Project, changedKeys: readonly string[] = []): PiAgentDoneEvent {
  return { type: "done", project, stats: NO_STATS, changedKeys };
}

/** 이름으로 팀장 툴을 집어 호출하고 JSON 결과를 돌려준다. */
async function callTool(tools: readonly PiToolShape[], name: string, params: unknown): Promise<Record<string, unknown>> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`팀장 툴 '${name}' 이 없다. 있는 것: ${tools.map((t) => t.name).join(", ")}`);
  const result = await tool.execute("call", params);
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

/** 맵 이름을 바꿔 "이 팀원이 이 맵에서 일했다"는 흔적을 남기는 시공 결과. */
function built(project: Project, mapId: string, mark: string): Project {
  const next = structuredClone(project) as Project;
  next.maps[mapId] = { ...next.maps[mapId]!, name: mark };
  return next;
}

interface Harness {
  readonly options: RunPiTeamOptions;
  /** 팀장이 반환한 뒤에야 시공 에이전트가 끝난다 — 배정이 진행 중인 창을 결정적으로 만든다. */
  releaseBuilders(): void;
}

/** 팀장 역할만 시나리오로 바꾸고 나머지는 표준 가짜로 채운다. */
function harness(
  orchestrate: (tools: readonly PiToolShape[]) => Promise<void>,
  options: { readonly gateBuilders?: boolean; readonly reviewVerdict?: { ok: boolean; findings: string[] }; readonly onEvent?: (event: PiAgentEvent) => void } = {},
): Harness {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }): Promise<PiAgentDoneEvent> => {
    const extra = opts.extraTools ?? [];
    if (extra.some((tool) => tool.name === "assign_map_agent")) {
      await orchestrate(extra);
      release();
      return doneWith(req.project);
    }
    const report = extra.find((tool) => tool.name === "report_review");
    if (report) {
      const verdict = options.reviewVerdict ?? { ok: true, findings: [] };
      await report.execute("call", verdict);
      return doneWith(req.project);
    }
    if (options.gateBuilders) await gate;
    const mapId = req.mapIds[0]!;
    const marked = built(req.project, mapId, `지어짐:${mapId}`);
    return doneWith(marked, [`maps.${mapId}`]);
  };
  return {
    options: { runAgent: runAgent as RunPiTeamOptions["runAgent"], ...(options.onEvent ? { onEvent: options.onEvent } : {}) },
    releaseBuilders: () => release(),
  };
}

describe("팀 런타임 — 맵 in-flight 락", () => {
  // 깨질 것: 락이 없으면 같은 턴의 두 배정이 같은 사본에서 출발해 나중 결과가 앞 결과를 통째로
  // 덮는다. 팀장 프롬프트의 문장 하나가 아니라 툴 계약이 막아야 한다.
  it("진행 중인 맵에 두 번째 배정을 내면 툴이 거절하고 앞 배정이 살아남는다", async () => {
    const errors: string[] = [];
    const project = seeded();
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "꽃", member: "decorator" })
        .catch((error: Error) => { errors.push(error.message); return {}; });
    }, { gateBuilders: true });

    const done = await runPiTeam(request(project), test.options);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("map_a");
    expect(done.project.maps.map_a!.name).toBe("지어짐:map_a");
  });

  // 깨질 것: 락을 맵이 아니라 전역으로 걸면 서로 다른 맵의 병렬성이 사라진다.
  it("다른 맵 두 배정은 함께 돌고 각자 자기 맵만 병합된다", async () => {
    const project = seeded();
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      await callTool(tools, "assign_map_agent", { mapId: "map_b", task: "집", member: "builder" });
      await callTool(tools, "wait_agents", {});
      await callTool(tools, "finish", { report: "끝" });
    });

    const done = await runPiTeam(request(project), test.options);
    expect(done.project.maps.map_a!.name).toBe("지어짐:map_a");
    expect(done.project.maps.map_b!.name).toBe("지어짐:map_b");
  });

  // 깨질 것: 시공이 도는 중에 검수를 붙이면 반쯤 지어진 맵을 읽고 엉뚱한 지적을 낸다.
  it("진행 중인 맵은 검수도 거절한다", async () => {
    const errors: string[] = [];
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      await callTool(tools, "review_map", { mapId: "map_a" }).catch((error: Error) => { errors.push(error.message); return {}; });
    }, { gateBuilders: true });

    await runPiTeam(request(seeded()), test.options);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("map_a");
  });
});

describe("팀 런타임 — 시작/확인 분리", () => {
  // 깨질 것: assign 이 완료까지 await 하면 팀장은 중간을 볼 수 없고, 헤매는 팀원을 끝날 때까지 모른다.
  it("assign 은 즉시 돌아오고 check_agents 가 진행 중 배정을 알려준다", async () => {
    let snapshot: Record<string, unknown> = {};
    const test = harness(async (tools) => {
      const started = await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      expect(started.state).toBe("실행 중");
      expect(started.agentId).toBe("builder-1");
      snapshot = await callTool(tools, "check_agents", {});
    }, { gateBuilders: true });

    await runPiTeam(request(seeded()), test.options);
    const agents = snapshot.agents as { agentId: string; mapId: string; member: string; state: string }[];
    expect(agents).toEqual([expect.objectContaining({ agentId: "builder-1", mapId: "map_a", member: "builder", state: "실행 중" })]);
  });

  // 깨질 것: wait 가 결과를 안 돌려주면 팀장이 무엇이 바뀌었는지 모른 채 검수를 붙인다.
  it("wait_agents 는 끝난 배정의 결과를 돌려준다", async () => {
    let waited: Record<string, unknown> = {};
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      waited = await callTool(tools, "wait_agents", {});
    });

    await runPiTeam(request(seeded()), test.options);
    const agents = waited.agents as { agentId: string; state: string; changedKeys: string[] }[];
    expect(agents).toEqual([expect.objectContaining({ agentId: "builder-1", state: "완료", changedKeys: ["maps.map_a"] })]);
  });

  // 깨질 것: finish 가 진행 중 배정을 못 본 채 끝나면 팀장 보고가 아직 없는 결과를 말한다.
  it("finish 는 진행 중인 배정이 있으면 거절한다", async () => {
    const errors: string[] = [];
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      await callTool(tools, "finish", { report: "끝" }).catch((error: Error) => { errors.push(error.message); return {}; });
    }, { gateBuilders: true });

    await runPiTeam(request(seeded()), test.options);
    expect(errors).toHaveLength(1);
  });

  // 깨질 것: 팀장이 턴 상한에 걸려 wait 없이 끝나면 진행 중이던 시공 결과가 통째로 사라진다.
  it("팀장이 기다리지 않고 끝나도 진행 중인 배정을 거두어 병합한다", async () => {
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
    }, { gateBuilders: true });

    const done = await runPiTeam(request(seeded()), test.options);
    expect(done.project.maps.map_a!.name).toBe("지어짐:map_a");
    expect(done.changedKeys).toContain("maps.map_a");
  });
});

describe("팀 런타임 — 업무/수정 분류", () => {
  // 깨질 것: 배정 예산 하나로 세면 시공·장식 두 업무만으로 예산이 줄어 검수 지적을 못 고친다.
  // 그리고 수정 배정이 원인 검수를 가리키지 않으면 보드가 두 행을 잇지 못한다.
  it("검수 지적 뒤의 배정만 수정으로 분류되고 spawn 이 검수 행을 가리킨다", async () => {
    const events: PiAgentEvent[] = [];
    const test = harness(async (tools) => {
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
      await callTool(tools, "wait_agents", {});
      await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "꽃", member: "decorator" });
      await callTool(tools, "wait_agents", {});
      await callTool(tools, "review_map", { mapId: "map_a" });
      const fix = await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "길 잇기", member: "builder" });
      expect(fix.phase).toBe("fix");
      await callTool(tools, "wait_agents", {});
      await callTool(tools, "finish", { report: "끝" });
    }, { reviewVerdict: { ok: false, findings: ["길 끊김 (3,4)"] }, onEvent: (event) => events.push(event) });

    await runPiTeam(request(seeded()), test.options);
    const spawns = events.filter((event): event is Extract<PiAgentEvent, { type: "agent_spawn" }> => event.type === "agent_spawn");
    expect(spawns.filter((spawn) => spawn.role === "builder").map((spawn) => [spawn.agentId, spawn.fixOf ?? null])).toEqual([
      ["builder-1", null], ["builder-2", null], ["builder-3", "reviewer-1"],
    ]);
  });
});

describe("team model roles", () => {
  it("uses Ultrabrain for orchestration and Deep for builders with provider-specific credentials", async () => {
    const project = seeded();
    const calls: PiAgentRequest[] = [];
    const keys = { "google-antigravity": "brain-test-key", "openai-codex": "deep-test-key" };
    await runPiTeam({ ...request(project), provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "high",
      roleModels: { deep: { provider: "openai-codex", model: "deep-model", thinkingLevel: "medium" } },
    }, { apiKey: "brain-only-token", providerApiKeys: keys, runAgent: async (req, opts) => {
      calls.push(req);
      expect(opts.providerApiKeys).toEqual(keys);
      expect(opts.apiKey).toBe(req.provider === "google-antigravity" ? "brain-only-token" : undefined);
      const tools = opts.extraTools ?? [];
      if (tools.some(tool => tool.name === "assign_map_agent")) {
        await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
        await callTool(tools, "wait_agents", {});
        await callTool(tools, "finish", { report: "끝" });
      }
      return doneWith(req.project);
    } });
    expect(calls[0]).toMatchObject({ provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "high" });
    expect(calls[1]).toMatchObject({ provider: "openai-codex", model: "deep-model", thinkingLevel: "medium" });
  });
});
