import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTerrainTab } from "@/editor/panels/databaseUtilityRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("terrain tab copy and pickers", () => {
  it("drops RM2003 path copy and keeps backdrop/footstep field testids with pickers", () => {
    const host = document.createElement("div") as unknown as FakeElement;
    renderTerrainTab(host as unknown as HTMLElement);
    const form = findByTestId(host, "db-detail-form");
    if (!form) throw new Error("missing terrain form");

    expect(form.textContent).not.toContain("RM2003");
    expect(form.textContent).not.toContain("database.terrains");
    expect(findByTestId(form, "db-field-terrain-backdrop-0")).not.toBeNull();
    expect(findByTestId(form, "db-field-terrain-footstep-0")).not.toBeNull();
    expect(findByTestId(form, "db-field-terrain-backdrop-0-set")).not.toBeNull();
    expect(findByTestId(form, "db-field-terrain-footstep-0-set")).not.toBeNull();
    expect(form.querySelector(".db-resource-picker-inline-name")).not.toBeNull();
    expect(findByTestId(form, "db-field-terrain-backdrop-0")?.className).toContain("db-authoring-id");
  });
});
