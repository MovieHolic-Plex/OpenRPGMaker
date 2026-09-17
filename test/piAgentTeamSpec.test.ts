import { beforeEach, describe, expect, it } from "vitest";
import { defaultTeamSpec, describeTeamMembers, enabledMembers, memberSystemPrompt, normalizeTeamSpec, slugifyMemberId } from "@/ai/piAgent/teamSpec";
import { __resetTeamSpecCache, loadTeamSpec, resetTeamSpec, saveTeamSpec, TEAM_SPEC_STORAGE_KEY } from "@/ai/piAgent/teamSpecStore";
import { PI_TEAM_ROLES } from "@/ai/piAgent/team";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { createBlankProject } from "@/project/defaults";

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}

describe("팀 명세", () => {
  it("기본 팀은 시공·장식(꺼짐)·검수", () => {
    const spec = defaultTeamSpec();
    expect(spec.members.map((m) => [m.id, m.kind, m.enabled])).toEqual([["builder", "builder", true], ["decorator", "builder", false], ["reviewer", "reviewer", true]]);
    expect(enabledMembers(spec, "builder").map((m) => m.id)).toEqual(["builder"]);
  });
  it("깨진 항목은 버리고 id 는 고쳐 준다", () => {
    const spec = normalizeTeamSpec({ members: [
      { id: "BAD ID", label: "정원사", kind: "builder", prompt: "나무", toolDomains: ["tile", "nope"], maxTurns: "12" },
      { id: "reviewer", label: "검수", kind: "reviewer" },
      { id: "reviewer", label: "검수2", kind: "reviewer" },
      { label: "" },
      "garbage",
    ] });
    expect(spec.members.map((m) => m.id)).toEqual(["member", "reviewer", "reviewer-2"]);
    expect(spec.members[0]!.toolDomains).toEqual(["tile"]);
    expect(spec.members[0]!.maxTurns).toBe(12);
    expect(spec.members[1]!.maxTurns).toBe(50);
    expect(normalizeTeamSpec({ members: [] }).members.length).toBe(3);
    expect(normalizeTeamSpec(null).members.length).toBe(3);
  });
  it("slug 는 충돌을 피한다", () => {
    expect(slugifyMemberId("Garden Keeper", new Set())).toBe("garden-keeper");
    expect(slugifyMemberId("garden", new Set(["garden", "garden-2"]))).toBe("garden-3");
    expect(slugifyMemberId("정원사", new Set())).toBe("member");
  });
  it("팀장 프롬프트가 팀원 소개와 지침을 담고, 팀원 프롬프트는 범위 + 역할이다", () => {
    const spec = normalizeTeamSpec({ orchestratorNotes: "장식은 마지막에", members: [
      { id: "builder", label: "시공", kind: "builder", prompt: "짓는다", summary: "구조물" },
      { id: "gardener", label: "정원사", kind: "builder", prompt: "나무를 심는다", summary: "식생" },
      { id: "qa", label: "품질", kind: "reviewer", prompt: "확인" },
    ] });
    const lines = describeTeamMembers(spec).join("\n");
    expect(lines).toMatch(/builder「시공」 — 구조물/); expect(lines).toMatch(/gardener「정원사」 — 식생/); expect(lines).toMatch(/qa「품질」/);
    const project = createBlankProject();
    const orch = PI_TEAM_ROLES.orchestrator.systemPrompt(project, [], "x", spec).join("\n");
    expect(orch).toMatch(/gardener「정원사」/); expect(orch).toMatch(/장식은 마지막에/);
    const builder = memberSystemPrompt(spec.members[1]!, project, []).join("\n");
    expect(builder).toMatch(/「정원사」에이전트다\. 나무를 심는다/); expect(builder).toMatch(/작업 범위는 프로젝트 전체/);
    const reviewer = memberSystemPrompt(spec.members[2]!, project, []).join("\n");
    expect(reviewer).toMatch(/읽기 도구만/); expect(reviewer).toMatch(/report_review/);
  });
  it("보드 행은 팀원 이름과 id 를 받는다", () => {
    let state = createTeamBoardState("team", "x");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "M", task: "t", memberId: "gardener", label: "정원사" });
    expect(state.agents[0]!.roleLabel).toBe("정원사"); expect(state.agents[0]!.memberId).toBe("gardener");
  });
});

describe("팀 명세 저장소", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    __resetTeamSpecCache();
  });
  it("저장·로드·초기화가 왕복한다", () => {
    expect(loadTeamSpec().members.length).toBe(3);
    const saved = saveTeamSpec({ ...loadTeamSpec(), members: [{ id: "solo", label: "혼자", kind: "builder", summary: "", prompt: "p", toolDomains: [], maxTurns: 5, enabled: true }] });
    expect(saved.members.map((m) => m.id)).toEqual(["solo"]);
    __resetTeamSpecCache();
    expect(loadTeamSpec().members.map((m) => m.id)).toEqual(["solo"]);
    expect(JSON.parse(localStorage.getItem(TEAM_SPEC_STORAGE_KEY)!).members[0].id).toBe("solo");
    expect(resetTeamSpec().members.length).toBe(3);
    expect(localStorage.getItem(TEAM_SPEC_STORAGE_KEY)).toBeNull();
  });
});
