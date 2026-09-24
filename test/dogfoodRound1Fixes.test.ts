// 2026-09-24 장르 도그푸딩 1라운드 보고서에서 소스로 확인한 도구·자동 플레이 결함의 회귀 고정.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";
import { canonicalizeCommandFieldAlias } from "@/project/eventCommands/commandFieldAliases";
import { createBlankProject } from "@/project/defaults";
import { checkProgression } from "@/qa/gameCheck/progression";
import { numberInputAnswer } from "@/testing/numberInputAnswer";
import type { Command, Project } from "@/project/types";

function startMap(project: Project) {
  return project.maps[project.startMapId]!;
}

describe("wait 시간 별칭 (꿈 세계)", () => {
  it.each([
    [{ kind: "wait", durationMs: 600 }, 600],
    [{ kind: "wait", seconds: 1.5 }, 1500],
    [{ kind: "wait", frames: 60 }, 1000],
  ])("%j → ms %i", (raw, ms) => {
    const command = { ...raw } as Record<string, unknown>;
    expect(canonicalizeCommandFieldAlias(command)).toContain("ms");
    expect(command).toEqual({ kind: "wait", ms });
  });

  it("ms 가 이미 있으면 건드리지 않는다", () => {
    const command = { kind: "wait", ms: 200, durationMs: 900 };
    expect(canonicalizeCommandFieldAlias(command)).toBeUndefined();
    expect(command.ms).toBe(200);
  });
});

describe("자동 플레이 숫자 입력 (추격 호러 금고)", () => {
  it("변수를 상수와 비교하는 저작 조건에서 정답을 고른다", () => {
    const project = createBlankProject();
    const variableId = project.variables[0]!.id;
    const commands: Command[] = [
      { kind: "inputNumber", variableId, digits: 4 } as Command,
      { kind: "fork", condition: { kind: "variable", variableId, op: "==", value: 7419 }, then: [], else: [] } as unknown as Command,
    ];
    startMap(project).events.push({ id: "ev_safe", name: "금고", x: 1, y: 1, pages: [{ trigger: "action", commands }] } as never);
    expect(numberInputAnswer(project, variableId)).toBe(7419);
    expect(numberInputAnswer(project, "var_unused")).toBe(0);
  });
});

describe("rename_variable 표시 이름 (연애)", () => {
  it("name 만 주면 id 는 두고 표시 이름을 바꾼다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const id = context.project.variables[0]!.id;
    const result = runTool(context, "rename_variable", { variableId: id, name: "나래 호감" });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.variables[0]).toMatchObject({ id, name: "나래 호감" });
  });

  it("이름 없는 빈 칸의 id 만 바꾸면 새 id 를 표시 이름으로도 쓴다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const id = context.project.variables[0]!.id;
    context.project.variables[0]!.name = "";
    const result = runTool(context, "rename_variable", { fromId: id, to: "나래호감" });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.variables.find((entry) => entry.id === "나래호감")?.name).toBe("나래호감");
  });
});

describe("엔딩별 호출 검사 (연애 배드 엔딩)", () => {
  it("이름으로만 부르는 게임에서 아무도 부르지 않는 엔딩을 경고한다", () => {
    const project = createBlankProject();
    project.endings = [
      { id: "ending_narae", name: "나래 엔딩", conditions: [] },
      { id: "ending_bad", name: "배드 엔딩", conditions: [] },
    ] as never;
    startMap(project).events.push({
      id: "ev_end", name: "끝", x: 1, y: 1,
      pages: [{ trigger: "action", commands: [{ kind: "triggerEnding", endingId: "ending_narae" }] }],
    } as never);
    const findings = checkProgression(project).filter((finding) => finding.code === "ending-uninvoked");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("배드 엔딩");
  });
});

describe("script_cutscene moveActor 대상 이름 (회상 스토리)", () => {
  it("같은 맵의 이벤트 이름을 이벤트 id 로 바꿔 실제 이동 명령을 만든다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const map = startMap(context.project);
    const placed = runTool(context, "upsert_event", {
      mapId: map.id,
      event: { id: "ev_npc_opaque", name: "노을", x: 3, y: 3, pages: [{ trigger: "action", commands: [{ kind: "text", body: "…" }] }] },
    });
    expect(placed.ok, placed.summary).toBe(true);
    const result = runTool(context, "script_cutscene", {
      mapId: map.id,
      beats: [
        { kind: "say", speaker: "노을", text: "가자." },
        { kind: "moveActor", target: "노을", moves: [{ kind: "turn", dir: "left" }] },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    const cutscene = context.project.maps[map.id]!.events.find((event) => event.id !== "ev_npc_opaque" && JSON.stringify(event).includes("moveEvent"));
    expect(JSON.stringify(cutscene)).toMatch(/"kind":"moveEvent"[^}]*"ev_npc_opaque"|"ev_npc_opaque"[^}]*"kind":"moveEvent"/);
    expect(JSON.stringify(result)).toContain("이벤트 id 'ev_npc_opaque'");
  });
});
