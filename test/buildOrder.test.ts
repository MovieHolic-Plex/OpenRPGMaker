import { describe, expect, it } from "vitest";
import { orderedAssets, validateBuildSpec, type BuildSpec } from "@/ai/buildSpec";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function projectWithMap() {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 });
  expect(created.ok, created.summary).toBe(true);
  return ctx.project;
}

describe("orderedAssets", () => {
  it("buildOrder에 적힌 kind 순서대로 에셋을 앞에 둔다", () => {
    const spec: BuildSpec = {
      mapId: "m1",
      buildOrder: ["road", "house"],
      assets: [
        { id: "h1", kind: "house", x: 6, y: 2, w: 3, h: 3 },
        { id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 },
        { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
      ],
    };

    expect(orderedAssets(spec).map((asset) => asset.id)).toEqual(["r1", "h1", "p1"]);
  });

  it("같은 kind 안에서는 입력 순서를 유지한다", () => {
    const spec: BuildSpec = {
      mapId: "m1",
      buildOrder: ["house"],
      assets: [
        { id: "h1", kind: "house", x: 2, y: 2, w: 3, h: 3 },
        { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
        { id: "h2", kind: "house", x: 6, y: 2, w: 3, h: 3 },
      ],
    };

    expect(orderedAssets(spec).map((asset) => asset.id)).toEqual(["h1", "h2", "p1"]);
  });

  it("buildOrder가 없으면 같은 내용과 순서의 얕은 복사본을 반환한다", () => {
    const spec: BuildSpec = {
      mapId: "m1",
      assets: [
        { id: "h1", kind: "house", x: 2, y: 2, w: 3, h: 3 },
        { id: "r1", kind: "road", x: 6, y: 2, w: 3, h: 1 },
      ],
    };

    const ordered = orderedAssets(spec);
    expect(ordered).toEqual(spec.assets);
    expect(ordered).not.toBe(spec.assets);
  });
});

describe("validateBuildSpec buildOrder", () => {
  it("buildOrder가 문자열 배열이 아니면 error", () => {
    const project = projectWithMap();
    const issues = validateBuildSpec(project, {
      mapId: "m1",
      buildOrder: "road",
      assets: [{ id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 }],
    });

    expect(issues).toContainEqual({ severity: "error", message: "buildOrder는 문자열 배열이어야 합니다." });
  });

  it("buildOrder에 없는 kind가 있으면 warning만 낸다", () => {
    const project = projectWithMap();
    const issues = validateBuildSpec(project, {
      mapId: "m1",
      buildOrder: ["road", "castle"],
      assets: [{ id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 }],
    });

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(issues).toContainEqual({ severity: "warning", message: "buildOrder의 'castle'에 해당하는 에셋이 없습니다" });
  });

  it("비어 있지 않은 buildOrder가 asset kind를 빠뜨리면 마지막 배치 warning을 낸다", () => {
    const project = projectWithMap();
    const issues = validateBuildSpec(project, {
      mapId: "m1",
      buildOrder: ["road"],
      assets: [
        { id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 },
        { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
      ],
    });

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(issues).toContainEqual({ severity: "warning", message: "에셋 'p1'(prop)가 buildOrder에 없어 마지막에 배치됩니다" });
  });

  it("유효한 spec과 buildOrder는 error가 없다", () => {
    const project = projectWithMap();
    const spec: BuildSpec = {
      mapId: "m1",
      buildOrder: ["road", "house", "prop"],
      assets: [
        { id: "r1", kind: "road", x: 2, y: 2, w: 3, h: 1 },
        { id: "h1", kind: "house", x: 6, y: 2, w: 3, h: 3 },
        { id: "p1", kind: "prop", x: 12, y: 2, w: 1, h: 1 },
      ],
    };

    expect(validateBuildSpec(project, spec).filter((issue) => issue.severity === "error")).toEqual([]);
  });
});
