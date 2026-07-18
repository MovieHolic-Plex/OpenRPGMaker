import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  databasePicker,
  switchVariablePicker,
  variablePicker,
} from "@/editor/panels/eventEditor/switchVariablePicker";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("shared switch/variable picker", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("databasePicker keeps legacy search + select + modal button testids", () => {
    const onChange = vi.fn();
    const body = renderWithFakeDom(() => databasePicker("switch", "", onChange, "event-command-switch-target"));
    expect(findByTestId(body, "event-command-switch-target")).not.toBeNull();
    expect(findByTestId(body, "event-switch-inline-filter")).not.toBeNull();
    expect(findByTestId(body, "event-switch-picker-open")).not.toBeNull();
  });

  it("filters select options by search text", () => {
    const project = store.getCurrent();
    const first = project.switches[0];
    if (!first) throw new Error("missing switch");
    first.name = "문 열림";
    store.replace(project);

    const body = renderWithFakeDom(() =>
      switchVariablePicker({
        kind: "switch",
        selectedId: first.id,
        onChange: vi.fn(),
        testId: "shared-switch",
      }).root
    );
    const filter = findByTestId(body, "event-switch-inline-filter") as FakeElement | null;
    expect(filter).not.toBeNull();
    if (filter) {
      filter.value = "zzzz-nope";
      filter.dispatchEvent(new Event("input"));
    }
    const select = body.querySelector("select") as FakeElement | null;
    const options = select ? Array.from(select.querySelectorAll("option")) : [];
    const named = options.filter((option) => (option as FakeElement).value === first.id);
    expect(named[0]?.hidden).toBe(true);
  });

  it("variablePicker exposes select testid when requested", () => {
    const onChange = vi.fn();
    const body = renderWithFakeDom(() =>
      variablePicker({
        selectedId: "",
        onChange,
        selectTestId: "shared-var-select",
        pickerTestId: "shared-var-picker",
        showFilter: false,
      }).root
    );
    expect(findByTestId(body, "shared-var-select")).not.toBeNull();
    expect(findByTestId(body, "shared-var-picker")).not.toBeNull();
    expect(findByTestId(body, "event-variable-inline-filter")).toBeNull();
  });
});
