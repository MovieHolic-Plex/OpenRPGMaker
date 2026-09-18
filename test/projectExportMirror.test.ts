import { describe, expect, it, vi } from "vitest";
import { ProjectExportMirror } from "@/editor/projectExportMirror";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";

vi.mock("@/project/eventDrafts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/project/eventDrafts")>();
  return { ...actual, projectWithoutEventDrafts: vi.fn(actual.projectWithoutEventDrafts) };
});

describe("project export mirror", () => {
  it("keeps editor/history current without reprojecting unchanged project content", () => {
    const mirror = new ProjectExportMirror();
    const project = createBlankProject();
    const version = { lineage: 1, generation: 1 };
    mirror.serialize(project, version, { currentMapId: "a" }, { canUndo: false });
    const calls = vi.mocked(projectWithoutEventDrafts).mock.calls.length;
    const next = JSON.parse(mirror.serialize(project, version, { currentMapId: "b" }, { canUndo: true }));
    expect(vi.mocked(projectWithoutEventDrafts).mock.calls.length).toBe(calls);
    expect(next.editor).toEqual({ currentMapId: "b" });
    expect(next.history).toEqual({ canUndo: true });
    expect(next.project).toEqual(JSON.parse(JSON.stringify(projectWithoutEventDrafts(project))));
  });

  it("invalidates on mutation, project replacement, lineage change and teardown", () => {
    const mirror = new ProjectExportMirror();
    const project = createBlankProject();
    const render = (lineage: number, generation: number) => JSON.parse(mirror.serialize(project, { lineage, generation }, {}, {}));
    render(1, 1);
    const calls = vi.mocked(projectWithoutEventDrafts).mock.calls.length;
    project.meta.title = "edited";
    expect(render(1, 2).project.meta.title).toBe("edited");
    render(2, 2);
    mirror.clear();
    render(2, 2);
    mirror.serialize(structuredClone(project), { lineage: 2, generation: 2 }, {}, {});
    expect(vi.mocked(projectWithoutEventDrafts).mock.calls.length).toBe(calls + 4);
  });
});
