// 팀 런타임의 배정 계약. 하위 에이전트는 가짜 실행기로 갈음하고(LLM 은 결정적으로 만들 수 없다)
// 팀장 툴을 직접 호출해 런타임의 락·예산·병합·안전망을 검증한다.
import { describe, expect, it } from "vitest";
import { PI_AGENT_DEFAULT_TIMEOUT_MS, slimCheckpointProject, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "@/ai/piAgent/protocol";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { PiTeamSpec } from "@/ai/piAgent/teamSpec";
import { commitChangeset, runTool } from "@/editor/tools";
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

describe("프리셋 첫 생성의 실제 팀원 턴 상한", () => {
  it.each([[300, 120], [5, 5]])("팀 공통 예산이 팀원 상한 %i를 덮어쓰지 않는다", async (memberLimit, expected) => {
    const seen: number[] = [];
    const req = { ...request(seeded()), task: "장르 프리셋: 작은 첫 구간", team: {
      ...TEAM, workBudget: 600, reviewAfterWork: false,
      members: [{ ...TEAM.members[0]!, maxTurns: memberLimit }],
    } };
    await runPiTeam(req, { runAgent: async (child, options) => {
      if (options.extraTools?.some(t => t.name === "assign_map_agent")) {
        await callTool(options.extraTools, "assign_map_agent", { mapId: "map_a", task: "첫 상호작용" });
        await callTool(options.extraTools, "wait_agents", {});
        await callTool(options.extraTools, "finish", { report: "끝" });
      } else seen.push(child.maxTurns!);
      return doneWith(child.project);
    } });
    expect(seen).toEqual([expected]);
  });
});

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

  // 깨질 것(2026-09-23): wait_agents 가 10초마다 돌아와 팀장이 대기만으로 턴을 쌓았다(10분 시공 ≈ 60턴).
  // 이제 먼저 끝난 배정 하나에 돌아오고, 끝날 때까지는 시간으로 돌아오지 않는다.
  it("wait_agents 는 먼저 끝난 배정에 돌아오고 나머지는 계속 돈다", async () => {
    const reasons: string[] = [];
    let releaseB = (): void => {};
    const gateB = new Promise<void>(resolve => { releaseB = resolve; });
    const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }): Promise<PiAgentDoneEvent> => {
      const extra = opts.extraTools ?? [];
      if (extra.some(tool => tool.name === "assign_map_agent")) {
        await callTool(extra, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
        await callTool(extra, "assign_map_agent", { mapId: "map_b", task: "집", member: "builder" });
        const first = await callTool(extra, "wait_agents", {});
        reasons.push(String(first.reason));
        const states = (first.agents as { agentId: string; state: string }[]).map(agent => agent.state).sort();
        expect(states).toEqual(["실행 중", "완료"]);
        releaseB();
        const second = await callTool(extra, "wait_agents", {});
        reasons.push(String(second.reason));
        await callTool(extra, "finish", { report: "끝" });
        return doneWith(req.project);
      }
      if (req.mapIds[0] === "map_b") await gateB;
      return doneWith(built(req.project, req.mapIds[0]!, `${req.mapIds[0]} 지음`), [`maps.${req.mapIds[0]}`]);
    };
    await runPiTeam(request(seeded()), { runAgent: runAgent as RunPiTeamOptions["runAgent"] });
    expect(reasons).toEqual(["agent_finished", "completed"]);
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

describe("팀 런타임 — 묶음이 만든 정의", () => {
  // 실측(2026-09-14, `/pi team` · 빈 맵 · "던전을 만들어줘", 활동 로그 project oprn-fcfe8b2c2b):
  // 시공 팀원이 place_battle_blocker 로 «클리어 스위치»를 만들고 그 맵 이벤트가 그걸 가리키는데,
  // 병합이 맵만 옮기고 스위치 정의를 버려 병합본이 자기 이벤트의 참조를 잃었다. 커밋 게이트가
  // serialize 왕복에서 그걸 잡아 런 전체가 "적용 실패(commit-rejected): 직렬화 왕복 실패:
  // setSwitch: switchId가 존재하지 않습니다: sw_ev_battle_<uuid>_clear" 로 거부됐다.
  it("시공 팀원이 만든 스위치가 팀 병합을 지나 커밋 게이트를 통과한다", async () => {
    const project = seeded();
    let clearSwitchId = "";
    const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }): Promise<PiAgentDoneEvent> => {
      const extra = opts.extraTools ?? [];
      if (extra.some((tool) => tool.name === "assign_map_agent")) {
        await callTool(extra, "assign_map_agent", { mapId: "map_a", task: "던전", member: "builder" });
        await callTool(extra, "wait_agents", {});
        await callTool(extra, "finish", { report: "끝" });
        return doneWith(req.project);
      }
      // 시공 팀원은 자기 사본에서 진짜 툴을 돌린다 — 정의가 그 사본의 프로젝트에 실제로 생긴다.
      const ctx = { project: structuredClone(req.project) as Project };
      const mapId = req.mapIds[0]!;
      const blocked = runTool(ctx, "place_battle_blocker", { mapId, x: 4, y: 4, troopId: ctx.project.database.troops[0]!.id });
      expect(blocked.ok).toBe(true);
      clearSwitchId = (blocked.data as { clearSwitchId: string }).clearSwitchId;
      return doneWith(ctx.project, [`maps.${mapId}`]);
    };

    const done = await runPiTeam(request(project), { runAgent: runAgent as RunPiTeamOptions["runAgent"] });
    expect(clearSwitchId).not.toBe("");
    // 정의를 잃으면 게이트가 serialize 왕복에서 잡고 런 전체를 거부한다(부분 적용이 없다) —
    // 실패 메시지가 곧 사용자가 본 증상이라 그대로 실어 두면 회귀 원인이 한 줄로 보인다.
    const gate = commitChangeset(done.project, project);
    expect(gate.ok, gate.ok ? "" : gate.blocking.map((issue) => issue.message).join(" | ")).toBe(true);
    expect(done.project.switches.some((entry) => entry.id === clearSwitchId)).toBe(true);
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
      initialToolNames: ["find_tools", "set_party"],
      roleModels: { deep: { provider: "openai-codex", model: "deep-model", thinkingLevel: "medium" } },
    }, { apiKey: "brain-only-token", providerApiKeys: keys, runAgent: async (req, opts) => {
      calls.push(req);
      expect(req.initialToolNames).toBeUndefined(); // Assigned roles must not inherit the parent shortlist.
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

describe("팀 런타임 — 실행 상한", () => {
  // 사용자 요청(2026-09-15): 요청 상한 600초 → 3000초. 상한은 규약 상수 하나가 말하고 런타임이 그 값을 쓴다.
  it("기본 실행 상한은 3000초다", () => {
    expect(PI_AGENT_DEFAULT_TIMEOUT_MS).toBe(3000 * 1000);
  });

  // 깨질 것: 규약(protocol.ts)은 「팀은 하위 에이전트마다 같은 값이 걸린다」 고 말하는데, child() 가 timeoutMs 를
  // 빠뜨리면 시공·검수는 런타임 기본값으로 돌아 사용자가 올린 상한이 팀장에게만 적용된다.
  it("timeoutMs 가 팀장·시공·검수 하위 에이전트에 그대로 실린다", async () => {
    const seen: (number | undefined)[] = [];
    const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[]; timeoutMs?: number }): Promise<PiAgentDoneEvent> => {
      seen.push(opts.timeoutMs);
      const extra = opts.extraTools ?? [];
      if (extra.some((tool) => tool.name === "assign_map_agent")) {
        await callTool(extra, "assign_map_agent", { mapId: "map_a", task: "집", member: "builder" });
        await callTool(extra, "wait_agents", {});
        await callTool(extra, "review_map", { mapId: "map_a" });
        await callTool(extra, "finish", { report: "끝" });
        return doneWith(req.project);
      }
      const report = extra.find((tool) => tool.name === "report_review");
      if (report) {
        await report.execute("call", { ok: true, findings: [] });
        return doneWith(req.project);
      }
      const mapId = req.mapIds[0]!;
      return doneWith(built(req.project, mapId, `지어짐:${mapId}`), [`maps.${mapId}`]);
    };

    await runPiTeam(request(seeded()), { runAgent: runAgent as RunPiTeamOptions["runAgent"], timeoutMs: 1234 });
    // 팀장 → 시공 → 검수 순으로 셋이 돌았고, 셋 다 같은 상한을 받았다.
    expect(seen).toEqual([1234, 1234, 1234]);
  });
});

describe("팀 런타임 — 현재 맵", () => {
  // 깨질 것: 요청의 currentMapId 가 팀장 프롬프트에 안 실리면 브라우저가 현재 맵을 보내도 팀장은 모른다.
  it("요청의 currentMapId 가 팀장 시스템 프롬프트의 기본 대상으로 실린다", async () => {
    let orchestratorPrompt = "";
    const runAgent = async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }): Promise<PiAgentDoneEvent> => {
      if ((opts.extraTools ?? []).some((tool) => tool.name === "assign_map_agent")) orchestratorPrompt = (req.systemPrompt ?? []).join("\n");
      return doneWith(req.project);
    };
    await runPiTeam({ ...request(seeded()), currentMapId: "map_b" }, { runAgent: runAgent as RunPiTeamOptions["runAgent"] });
    expect(orchestratorPrompt).toMatch(/보고 있는 맵[^\n]*\n- map_b "B" 10×10/);
  });
});

it("외부·실내 담당이 직접 출입구를 협의하고 팀장은 대기 중 질문에 답한다", async () => {
  const events: PiAgentEvent[] = [];
  let releaseOutside!: () => void;
  const assigned = new Promise<void>(resolve => { releaseOutside = resolve; });
  const result = await runPiTeam(request(seeded()), {
    onEvent: event => events.push(event),
    runAgent: async (req, opts) => {
      const tools = opts.extraTools ?? [];
      if (tools.some(t => t.name === "assign_map_agent")) {
        await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "외부" });
        await callTool(tools, "assign_map_agent", { mapId: "map_b", task: "실내" });
        releaseOutside();
        const pending = await callTool(tools, "wait_agents", {});
        expect(pending.reason).toBe("messages");
        const inbox = await callTool(tools, "read_team_messages", {});
        const question = (inbox.messages as { id: string; from: string }[])[0]!;
        await callTool(tools, "send_team_message", { to: question.from, kind: "reply", replyTo: question.id, body: "문 위치 유지" });
        for (let i = 0; i < 4; i++) {
          const waited = await callTool(tools, "wait_agents", {});
          if (waited.unreadMessages) await callTool(tools, "read_team_messages", {});
          if ((waited.agents as { state: string }[]).every(a => a.state !== "실행 중")) break;
        }
        await callTool(tools, "finish", { report: "출입구 협의 완료" });
        return doneWith(req.project);
      }
      if (req.mapIds[0] === "map_a") {
        await assigned;
        await callTool(tools, "send_team_message", { to: "orchestrator-1", kind: "question", body: "외부 문 유지?" });
        const chief = await callTool(tools, "wait_team_messages", {});
        const response = (chief.messages as { id: string; body: string }[])[0]!;
        expect(response.body).toBe("문 위치 유지");
        await callTool(tools, "acknowledge_team_message", { messageId: response.id });
        await callTool(tools, "send_team_message", { to: "builder-2", kind: "question", body: "실내 진입 좌표?" });
        const inside = await callTool(tools, "wait_team_messages", {});
        const door = (inside.messages as { id: string; body: string }[])[0]!;
        expect(door.body).toBe("map_b (8,12)");
        await callTool(tools, "acknowledge_team_message", { messageId: door.id });
        return doneWith(built(req.project, "map_a", door.body), ["maps.map_a"]);
      }
      const received = await callTool(tools, "wait_team_messages", {});
      const message = (received.messages as { id: string; from: string }[])[0]!;
      await callTool(tools, "send_team_message", { to: message.from, kind: "reply", replyTo: message.id, body: "map_b (8,12)" });
      return doneWith(built(req.project, "map_b", "실내 완료"), ["maps.map_b"]);
    },
  });
  expect(result.project.maps.map_a?.name).toBe("map_b (8,12)");
  expect(result.project.maps.map_b?.name).toBe("실내 완료");
  expect(events.some(e => e.type === "agent_event" && e.event.type === "assistant" && e.event.text.includes("builder-1 → builder-2"))).toBe(true);
  expect(events.find(e => e.type === "team_report")).toMatchObject({ text: "출입구 협의 완료" });
});

it("전체 범위를 읽는 설계 작업은 직렬 배정하고 보고서로 공통 텍스트를 적용한다", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started = 0;
  const project = seeded();
  const result = await runPiTeam(request(project), {
    runAgent: async (req, opts) => {
      const tools = opts.extraTools ?? [];
      if (tools.some(t => t.name === "assign_task_agent")) {
        await callTool(tools, "assign_task_agent", { task: "용어집", mode: "read" });
        await expect(callTool(tools, "assign_task_agent", { task: "UI 번역안", mode: "read", member: "reviewer" })).rejects.toThrow(/같은 맵/);
        expect(started).toBe(1);
        await expect(callTool(tools, "finish", { report: "끝" })).rejects.toThrow(/아직 실행/);
        release();
        await callTool(tools, "wait_agents", {});
        await callTool(tools, "assign_task_agent", { task: "UI 번역안", mode: "read", member: "reviewer" });
        const reports = await callTool(tools, "wait_agents", {});
        expect((reports.agents as { summary: string }[]).map(a => a.summary)).toEqual(["용어집: 여관=Inn", "UI 번역안: 여관=Inn"]);
        await callTool(tools, "assign_task_agent", { task: "제목 번역 적용: Inn", mode: "project" });
        await callTool(tools, "wait_agents", {});
        await callTool(tools, "finish", { report: "제목 번역 완료" });
        return doneWith(req.project);
      }
      if (req.readOnly) {
        expect(opts.readOnlyTools).toBe(true);
        started++;
        await gate;
        await callTool(tools, "report_task", { report: `${req.task}: 여관=Inn` });
        return doneWith(req.project);
      }
      expect(opts.readOnlyTools).toBe(false);
      const updated = structuredClone(req.project);
      updated.meta.title = "Inn";
      await callTool(tools, "report_task", { report: "제목을 Inn으로 적용" });
      // Deliberately no declared changedKeys: the runtime derives actual changes.
      return doneWith(updated);
    },
  });
  expect(result.project.meta.title).toBe("Inn");
  expect(result.project.maps).toEqual(project.maps);
  expect(result.changedKeys).toContain("meta");
});

it("프로젝트 제작과 맵 쓰기를 양방향으로 잠그고 직렬 결과를 보존한다", async () => {
  let releaseMap!: () => void;
  let releaseProject!: () => void;
  const mapGate = new Promise<void>(resolve => { releaseMap = resolve; });
  const projectGate = new Promise<void>(resolve => { releaseProject = resolve; });
  const result = await runPiTeam(request(seeded()), {
    runAgent: async (req, opts) => {
      const tools = opts.extraTools ?? [];
      if (tools.some(t => t.name === "assign_task_agent")) {
        await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "구역 시공" });
        await expect(callTool(tools, "assign_task_agent", { task: "공통 정의", mode: "project" })).rejects.toThrow(/진행 중인 쓰기/);
        releaseMap();
        await callTool(tools, "wait_agents", {});
        await callTool(tools, "assign_task_agent", { task: "공통 정의", mode: "project" });
        await expect(callTool(tools, "assign_map_agent", { mapId: "map_b", task: "맵 수정" })).rejects.toThrow(/공통 데이터 제작 중/);
        await expect(callTool(tools, "assign_task_agent", { task: "겹친 수정", mode: "project" })).rejects.toThrow(/진행 중인 쓰기/);
        releaseProject();
        await callTool(tools, "wait_agents", {});
        return doneWith(req.project);
      }
      if (tools.some(t => t.name === "report_task")) {
        await projectGate;
        expect(req.project.maps.map_a?.name).toBe("시공 완료");
        const updated = structuredClone(req.project);
        updated.meta.title = "공통 정의 완료";
        await callTool(tools, "report_task", { report: "정의 완료" });
        return doneWith(updated);
      }
      await mapGate;
      return doneWith(built(req.project, "map_a", "시공 완료"), ["maps.map_a"]);
    },
  });
  expect(result.project.maps.map_a?.name).toBe("시공 완료");
  expect(result.project.meta.title).toBe("공통 정의 완료");
});

it.each(["mutation", "missing-report"])("읽기 작업의 잘못된 반환(%s)은 적용하지 않고 실패로 보고한다", async failure => {
  const project = seeded();
  const result = await runPiTeam(request(project), {
    runAgent: async (req, opts) => {
      const tools = opts.extraTools ?? [];
      if (tools.some(t => t.name === "assign_task_agent")) {
        await callTool(tools, "assign_task_agent", { task: "검사", mode: "read" });
        const report = await callTool(tools, "wait_agents", {});
        expect((report.agents as { state: string }[])[0]?.state).toBe("실패");
        const finish = await callTool(tools, "finish", { report: "검사 결과" });
        expect(finish.ok).toBe(true);
        return doneWith(req.project);
      }
      if (failure === "mutation") await callTool(tools, "report_task", { report: "검사 완료" });
      return doneWith(built(req.project, "map_a", "허용되지 않은 변경"));
    },
  });
  expect(result.project).toEqual(project);
});

it.each([{ readOnly: true }, { mapIds: ["map_a"], scopeStrict: true }])("프로젝트 배정은 원래 요청 권한을 넓히지 않는다: %j", async scope => {
  await runPiTeam({ ...request(seeded()), ...scope }, {
    runAgent: async (req, opts) => {
      await expect(callTool(opts.extraTools ?? [], "assign_task_agent", { task: "전체 수정", mode: "project" })).rejects.toThrow();
      return doneWith(req.project);
    },
  });
});

it("live team checkpoints merge owned maps before another agent's final result", async () => {
  const project = seeded();
  const publications: Project[] = [];
  const req = { ...request(project), applyMode: "default" as const };
  const result = await runPiTeam(req, {
    onCheckpoint: async checkpoint => { publications.push(structuredClone(checkpoint.project)); return checkpoint.project; },
    runAgent: async (child, options) => {
      if (options.extraTools?.some(t => t.name === "assign_map_agent")) {
        await callTool(options.extraTools, "assign_map_agent", { mapId: "map_a", task: "A", member: "builder" });
        await callTool(options.extraTools, "assign_map_agent", { mapId: "map_b", task: "B", member: "builder" });
        await callTool(options.extraTools, "wait_agents", {});
        return doneWith(child.project);
      }
      const id = child.mapIds[0]!;
      const next = built(child.project, id, `live:${id}`);
      await options.onCheckpoint!({ project: next, label: id, toolName: "set_map_properties" });
      return doneWith(next, [`maps.${id}`]);
    },
  });
  expect(publications).toHaveLength(2);
  expect(publications.at(-1)!.maps.map_a!.name).toBe("live:map_a");
  expect(publications.at(-1)!.maps.map_b!.name).toBe("live:map_b");
  expect(result.project.maps.map_a!.name).toBe("live:map_a");
  expect(result.project.maps.map_b!.name).toBe("live:map_b");
});

// 2026-09-27 프리셋 팀 첫 생성 실측: 프로젝트 공통 작업 팀원의 체크포인트는 안 바뀐 타일셋·DB 를 비워서 온다.
// 팀 런타임이 그걸 그대로 작업 사본으로 삼아, 뒤에 배정된 시공 팀원이 「project.database.actors 가 undefined」로 막혔다.
it.each([
  ["project", { task: "DB·시스템", mode: "project", member: "builder" }, "assign_task_agent"],
  ["map", { mapId: "map_a", task: "A", member: "builder" }, "assign_map_agent"],
] as const)("slim %s checkpoints keep tilesets and database in the working copy", async (_kind, args, toolName) => {
  const project = seeded();
  const published: Project[] = [];
  const later: Project[] = [];
  const result = await runPiTeam({ ...request(project), applyMode: "default" }, {
    onCheckpoint: async checkpoint => {
      published.push(checkpoint.project);
      // 브라우저 ACK 도 같은 키를 비운 채 돌아온다(client.ts).
      return slimCheckpointProject(checkpoint.project, checkpoint.unchangedKeys ?? []);
    },
    runAgent: async (child, options) => {
      if (options.extraTools?.some(t => t.name === toolName)) {
        await callTool(options.extraTools, toolName, args);
        await callTool(options.extraTools, "wait_agents", {});
        await callTool(options.extraTools, "assign_map_agent", { mapId: "map_b", task: "B", member: "decorator" });
        await callTool(options.extraTools, "wait_agents", {});
        return doneWith(child.project);
      }
      if (child.mapIds[0] === "map_b") { later.push(child.project); return doneWith(child.project); }
      const next = built(child.project, "map_a", "live:map_a");
      const unchangedKeys = ["tilesets", "database"] as const;
      await options.onCheckpoint!({ project: slimCheckpointProject(next, unchangedKeys), label: "a", toolName: "set_map_properties", unchangedKeys: [...unchangedKeys] });
      return doneWith(next, ["maps.map_a"]);
    },
  });
  // 브라우저로는 여전히 비워서 보낸다 — 줄 하나에 타일셋 이미지 수십 MB 를 싣지 않는다.
  expect(published).toHaveLength(1);
  expect(Object.keys(published[0]!.tilesets)).toHaveLength(0);
  expect(later).toHaveLength(1);
  expect(later[0]!.database.actors).toEqual(project.database.actors);
  expect(Object.keys(later[0]!.tilesets)).toEqual(Object.keys(project.tilesets));
  expect(result.project.maps.map_a!.name).toBe("live:map_a");
  expect(result.project.database.actors).toEqual(project.database.actors);
});



describe("팀 초기 생성 — 맵 사이 연결 계약", () => {
  /** 마을(시작 맵)과 들판을 build_world 로 잇는 뼈대. 새 프로젝트 마법사의 팀 실행이 첫 project 작업으로 만든다. */
  function skeleton(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "build_world", {
      plan: {
        nodes: [
          { mapId: "map_town", role: "town", label: "마을", width: 20, height: 16 },
          { mapId: "map_field", role: "field", label: "들판", width: 20, height: 16 },
        ],
        edges: [{ from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_field", entry: { side: "west" } } }],
      },
    });
    if (!result.ok) throw new Error(result.summary);
    ctx.project.startMapId = "map_town";
    return ctx.project;
  }

  // 깨질 것: 이음새는 한쪽 담당만 안다. 담당 프롬프트에 없으면 들판 담당은 마을에서 오는 도착 칸을 모른다.
  it("맵 담당 프롬프트에 그 맵의 출입구·도착 칸이 실린다", async () => {
    const prompts = new Map<string, string>();
    await runPiTeam(request(skeleton()), {
      runAgent: (async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }) => {
        const tools = opts.extraTools ?? [];
        if (tools.some((tool) => tool.name === "assign_map_agent")) {
          await callTool(tools, "assign_map_agent", { mapId: "map_field", task: "들판" });
          await callTool(tools, "wait_agents", {});
          await callTool(tools, "finish", { report: "끝" });
          return doneWith(req.project);
        }
        prompts.set(req.mapIds[0]!, (req.systemPrompt ?? []).join("\n"));
        return doneWith(req.project);
      }) as RunPiTeamOptions["runAgent"],
    });
    expect(prompts.get("map_field")).toMatch(/연결 계약/);
    expect(prompts.get("map_field")).toMatch(/← map_town「마을」 에서 온다/);
  });

  // 깨질 것: 담당이 출입구를 지워도 각자의 검수는 자기 맵만 본다. finish 가 병합본으로 한 번 거절해야
  // 팀장이 고칠 기회를 얻는다. 같은 오류로 다시 부르면 보고에 남기고 끝낸다(영원히 못 끝나지 않게).
  it("finish 는 끊긴 연결을 한 번 거절하고, 같은 오류로 다시 부르면 보고에 남긴다", async () => {
    const events: PiAgentEvent[] = [];
    const errors: string[] = [];
    await runPiTeam(request(skeleton()), {
      onEvent: (event) => events.push(event),
      runAgent: (async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }) => {
        const tools = opts.extraTools ?? [];
        if (tools.some((tool) => tool.name === "assign_map_agent")) {
          await callTool(tools, "assign_map_agent", { mapId: "map_town", task: "마을" });
          await callTool(tools, "wait_agents", {});
          await callTool(tools, "finish", { report: "끝" }).catch((error: Error) => { errors.push(error.message); return {}; });
          await callTool(tools, "finish", { report: "끝" });
          return doneWith(req.project);
        }
        const next = structuredClone(req.project) as Project;
        next.maps.map_town!.events = next.maps.map_town!.events.filter((event) => !event.id.startsWith("ev_world_gate"));
        return doneWith(next, ["maps.map_town"]);
      }) as RunPiTeamOptions["runAgent"],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/맵 사이 연결 오류 1건/);
    expect(errors[0]).toMatch(/map_field/);
    const report = events.find((event) => event.type === "team_report");
    expect(report).toMatchObject({ text: expect.stringMatching(/남은 맵 연결 오류 1건/) });
  });

  it("연결이 온전하면 finish 가 바로 받는다", async () => {
    const errors: string[] = [];
    await runPiTeam(request(skeleton()), {
      runAgent: (async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }) => {
        const tools = opts.extraTools ?? [];
        if (tools.some((tool) => tool.name === "assign_map_agent")) {
          await callTool(tools, "assign_map_agent", { mapId: "map_town", task: "마을" });
          await callTool(tools, "assign_map_agent", { mapId: "map_field", task: "들판" });
          await callTool(tools, "wait_agents", {});
          await callTool(tools, "finish", { report: "끝" }).catch((error: Error) => { errors.push(error.message); return {}; });
          return doneWith(req.project);
        }
        return doneWith(built(req.project, req.mapIds[0]!, `지음:${req.mapIds[0]}`), [`maps.${req.mapIds[0]}`]);
      }) as RunPiTeamOptions["runAgent"],
    });
    expect(errors).toEqual([]);
  });

  // 깨질 것(2026-09-28 재현): 시작 맵은 트리 루트라 그 묶음이 곧 모든 맵이다. 시작 맵 담당이 늦게 끝나면
  // 그 사이 병합된 들판 담당의 결과를 출발 사본으로 덮었고, 충돌 보고도 없었다.
  it("트리 루트 담당이 끝나야 그 묶음의 자식 맵을 재배정한다", async () => {
    const project = seeded();
    const root = project.mapTree.mapId;
    let releaseRoot = (): void => {};
    const gate = new Promise<void>((resolve) => { releaseRoot = resolve; });
    const conflicts: string[][] = [];
    const done = await runPiTeam(request(project), {
      onEvent: (event) => { if (event.type === "agent_done") conflicts.push([...event.conflicts]); },
      runAgent: (async (req: PiAgentRequest, opts: { extraTools?: readonly PiToolShape[] }) => {
        const tools = opts.extraTools ?? [];
        if (tools.some((tool) => tool.name === "assign_map_agent")) {
          await callTool(tools, "assign_map_agent", { mapId: root, task: "시작 마을" });
          await expect(callTool(tools, "assign_map_agent", { mapId: "map_a", task: "들판" })).rejects.toThrow(/같은 맵/);
          releaseRoot();
          await callTool(tools, "wait_agents", {});
          await callTool(tools, "assign_map_agent", { mapId: "map_a", task: "들판" });
          await callTool(tools, "wait_agents", {});
          await callTool(tools, "finish", { report: "끝" });
          return doneWith(req.project);
        }
        const id = req.mapIds[0]!;
        if (id === root) await gate;
        return doneWith(built(req.project, id, `지음:${id}`), [`maps.${id}`]);
      }) as RunPiTeamOptions["runAgent"],
    });
    expect(done.project.maps[root]!.name).toBe(`지음:${root}`);
    expect(done.project.maps.map_a!.name).toBe("지음:map_a");
    expect(conflicts.flat()).toEqual([]);
  });
});


describe("팀 마을 완료 상태", () => {
  it("팀원 완료 정보를 최종 병합본에서 재검사해 done에도 미완료를 남긴다", async () => {
    const project = seeded();
    const events: PiAgentEvent[] = [];
    const runAgent: NonNullable<RunPiTeamOptions["runAgent"]> = async (req, opts) => {
      const extra = opts.extraTools ?? [];
      if (extra.some(tool => tool.name === "assign_map_agent")) {
        await callTool(extra, "assign_map_agent", { mapId: "map_a", task: "마을", member: "builder" });
        await callTool(extra, "wait_agents", {});
        return doneWith(req.project);
      }
      const next = built(req.project, "map_a", "아직 집이 없는 마을");
      return { ...doneWith(next, ["maps.map_a"]), villageCompletion: { mapIds: ["map_a"], issues: [] } };
    };
    const done = await runPiTeam(request(project), { runAgent, onEvent: event => events.push(event) });
    expect(done.villageCompletion?.mapIds).toEqual(["map_a"]);
    expect(done.villageCompletion?.issues.join("\n")).toContain("문 앞 좌표가 0개");
    expect(events.some(event => event.type === "agent_done" && event.agentId.startsWith("orchestrator-") && !event.ok)).toBe(true);
  });
});
