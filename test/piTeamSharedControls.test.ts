import { describe, expect, it } from "vitest";
import { defaultTeamSpec, enabledMembers, normalizeTeamSpec } from "@/ai/piAgent/teamSpec";
import { createBlankProject } from "@/project/defaults";
import type { PiAgentDoneEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { runPiTeam, type RunPiTeamOptions } from "../scripts/lib/piTeamRuntime";

const stats = { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 };
function request(reviewAfterWork: boolean): PiAgentRequest {
  return { mode: "team", provider: "test", task: "최종 결과 확인", project: createBlankProject(), mapIds: [],
    team: { ...defaultTeamSpec(), workBudget: 600, reviewAfterWork } };
}
function done(req: PiAgentRequest): PiAgentDoneEvent { return { type: "done", project: req.project, stats, changedKeys: [] }; }

describe("shared team controls", () => {
  it("normalizes shared settings and applies budget without deleting reviewer configuration", () => {
    const saved = normalizeTeamSpec({ ...defaultTeamSpec(), workBudget: 600, reviewAfterWork: false });
    expect(enabledMembers(saved, "builder")[0]!.maxTurns).toBe(600);
    expect(enabledMembers(saved, "reviewer")).toEqual([]);
    expect(saved.members.find(m => m.kind === "reviewer")!.enabled).toBe(true);
    expect(enabledMembers({ ...saved, reviewAfterWork: true }, "reviewer")[0]!.maxTurns).toBe(600);
  });
  it("runs a final read-only review even when the orchestrator omits review tools", async () => {
    const seen: PiAgentRequest[] = [];
    const runAgent: NonNullable<RunPiTeamOptions["runAgent"]> = async (req, options) => {
      seen.push(req);
      if (req.readOnly) {
        expect(options?.readOnlyTools).toBe(true);
        expect(req.maxTurns).toBe(600);
        const report = options!.extraTools!.find(tool => tool.name === "report_task")!;
        await report.execute("review", { report: "최종 사본 확인 완료" });
      }
      return done(req);
    };
    await runPiTeam(request(true), { runAgent });
    expect(seen).toHaveLength(2);
    expect(seen[1]!.readOnly).toBe(true);
  });
  it("does not run a reviewer when review is off", async () => {
    const seen: PiAgentRequest[] = [];
    await runPiTeam(request(false), { runAgent: async req => { seen.push(req); return done(req); } });
    expect(seen).toHaveLength(1);
  });
  it("does not silently finish without a reviewer or a final review report", async () => {
    const req = request(true);
    await expect(runPiTeam({ ...req, team: { ...req.team!, members: req.team!.members.filter(m => m.kind !== "reviewer") } },
      { runAgent: async r => done(r) })).rejects.toThrow("검토 담당");
    await expect(runPiTeam(req, { runAgent: async r => done(r) })).rejects.toThrow("완료 후 검토를 끝내지 못했습니다");
  });
});
