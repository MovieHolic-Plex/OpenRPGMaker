import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { runSceneTest } from "@/testing/sceneTestRunner";

// 추리 도그푸딩 gen: 진엔딩 에필로그 끝에 {kind:"ending", endingId:"ending_true"} 가 있어 에필로그가
// 검은 화면에서 끝없이 반복됐다(엔딩 화면에 영영 닿지 못함).
const EPILOGUE = [
  { kind: "say", speaker: "모로 박사", text: "……내가 무슨 짓을." },
  { kind: "ending", endingId: "ending_true" },
];

function withEnding(project: Project): void {
  project.maps[project.startMapId].events.push({
    id: "ev_end", name: "끝", x: 11, y: 8, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p", conditions: [], trigger: { kind: "action" }, priority: "same", graphic: {}, commands: [{ kind: "triggerEnding", endingId: "ending_true" }] }],
  } as never);
}

describe("엔딩 에필로그 안의 ending beat", () => {
  it("define_ending 은 ending beat 를 빼고 경고한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "define_ending", { id: "ending_true", name: "진실", conditions: [], epilogue: EPILOGUE });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.endings?.find((e) => e.id === "ending_true")?.epilogue?.map((beat) => (beat as { kind: string }).kind)).toEqual(["say"]);
    expect(JSON.stringify(result)).toContain("무한 반복");
  });

  it("옛 저장본의 ending beat 가 있어도 런타임은 에필로그를 한 번만 돌고 엔딩에 닿는다", () => {
    const project = createBlankProject();
    project.endings = [{ id: "ending_true", name: "진실", conditions: [], priority: 0, epilogue: EPILOGUE }];
    withEnding(project);
    const steps = [{ kind: "face", dir: "right" }, { kind: "interact", eventId: "ev_end" }, ...Array.from({ length: 6 }, () => ({ kind: "wait", ticks: 200 })), { kind: "expect", endingReached: "ending_true" }];
    const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 10, y: 8 }, steps } as never);
    expect(result.ok, `${result.failureReason} ${result.log.slice(-8).join(" | ")}`).toBe(true);
    const spoken = result.log.filter((line) => line.includes("내가 무슨 짓을")).length;
    expect(spoken).toBeLessThanOrEqual(1);
  });
});
