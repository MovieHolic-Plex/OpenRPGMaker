// 팀 초기 생성의 맵 사이 연결 계약. 담당에게 주는 이음새 목록과 finish 전 병합본 검사.
import { describe, expect, it } from "vitest";
import { describeMapSeams, inspectWorldSeams } from "@/ai/piAgent/worldSeams";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function world(): Project {
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

describe("월드 이음새", () => {
  // 깨질 것: 담당이 자기 맵의 출입구·도착 칸을 모르면 소품이나 벽으로 덮는다 — 한쪽만 아는 정보다.
  it("맵 담당에게 그 맵의 출입구와 다른 맵에서 오는 도착 칸을 알려 준다", () => {
    const project = world();
    const town = describeMapSeams(project, "map_town").join("\n");
    expect(town).toMatch(/출입구 \(19,8\) → map_field「들판」/);
    expect(town).toMatch(/도착 칸 \(\d+,\d+\) ← map_field「들판」/);
    expect(describeMapSeams(createBlankProject(), createBlankProject().startMapId)).toEqual([]);
  });

  it("연결이 온전하면 이슈가 없고, 계약이 없는 프로젝트는 검사하지 않는다", () => {
    expect(inspectWorldSeams(world()).issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(inspectWorldSeams(createBlankProject())).toEqual({ nodes: 0, edges: 0, issues: [] });
  });

  // 깨질 것: 담당이 출입구 이벤트를 지우면 lintWorldGraph 는 warning 만 내고, 플레이어는 들판에 못 간다.
  it("출입구가 사라져 시작 맵에서 닿지 않는 계획 맵은 error 다", () => {
    const project = world();
    project.maps.map_town!.events = project.maps.map_town!.events.filter((event) => !event.id.startsWith("ev_world_gate"));
    const errors = inspectWorldSeams(project).issues.filter((issue) => issue.severity === "error");
    expect(errors).toEqual([expect.objectContaining({ code: "world-node-unreachable", mapId: "map_field" })]);
  });
});
