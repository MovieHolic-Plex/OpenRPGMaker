import { expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { collectEditorProjectReferenceIssues } from "@/editor/projectReferenceIssues";
import { collectProjectReferenceIssues } from "@/project/io/references";
const version = vi.hoisted(() => ({ lineage: 1, generation: 1 }));
vi.mock("@/project/store", () => ({ store: { getVersionToken: () => version } }));
vi.mock("@/project/io/references", () => ({ collectProjectReferenceIssues: vi.fn(() => ["broken reference"]) }));
it("shares diagnostics between surfaces and invalidates edits, reloads and project replacements", () => {
  const project = {} as Project;
  const first = collectEditorProjectReferenceIssues(project);
  expect(collectEditorProjectReferenceIssues(project)).toBe(first);
  expect(collectProjectReferenceIssues).toHaveBeenCalledTimes(1);
  version.generation++;
  expect(collectEditorProjectReferenceIssues(project)).toEqual(["broken reference"]);
  version.lineage++;
  collectEditorProjectReferenceIssues(project);
  collectEditorProjectReferenceIssues({} as Project);
  expect(collectProjectReferenceIssues).toHaveBeenCalledTimes(4);
});
