import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listDatabaseResourceOptionsForTest } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("database resource picker catalog", () => {
  it("lists icon and monster candidates from bundled assets", () => {
    const project = createBlankProject();
    const icons = listDatabaseResourceOptionsForTest("icon", project);
    const monsters = listDatabaseResourceOptionsForTest("monster", project);
    const titles = listDatabaseResourceOptionsForTest("title", project);

    expect(icons.some((entry) => entry.id.startsWith("cc0-jetrel-"))).toBe(true);
    expect(monsters.some((entry) => entry.id.includes("enemy") || entry.id.includes("monster"))).toBe(true);
    expect(titles.length).toBeGreaterThan(0);
  });

  it("lists facesets and charsets for actor sheet picking", () => {
    const project = createBlankProject();
    const faces = listDatabaseResourceOptionsForTest("faceset", project);
    const charsets = listDatabaseResourceOptionsForTest("charset", project);
    expect(faces.some((entry) => entry.id.includes("faceset"))).toBe(true);
    expect(charsets.some((entry) => entry.id.includes("charset"))).toBe(true);
  });
});
