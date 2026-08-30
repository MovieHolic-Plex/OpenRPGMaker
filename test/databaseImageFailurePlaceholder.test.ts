import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("Database image failure placeholders", () => {
  it("renders an unresolved shared thumbnail as a labeled non-zero placeholder", () => {
    const project = createBlankProject();
    const item = {
      ...project.database.items[0],
      name: "없는 회복약",
      iconResourceId: "missing-database-image-resource",
      imageResourceId: undefined,
    };
    const thumbnail = recordListThumbnail("items", item, project);

    expect(thumbnail).toBeInstanceOf(FakeElement);
    if (!(thumbnail instanceof FakeElement)) throw new Error("expected Database thumbnail element");

    expect(thumbnail.classList.contains("db-image-load-failed")).toBe(true);
    expect(thumbnail.classList.contains("db-image-placeholder")).toBe(true);
    expect(thumbnail.getAttribute("aria-label")).toContain("없는 회복약");
    expect(Number.parseFloat(thumbnail.style.minWidth)).toBeGreaterThan(0);
    expect(Number.parseFloat(thumbnail.style.minHeight)).toBeGreaterThan(0);
  });
});
