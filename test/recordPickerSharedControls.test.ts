import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  actorPicker,
  searchableRecordBrowser,
} from "@/editor/panels/eventEditor/recordPicker";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("shared record picker controls", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("actorPicker wires faceset subtitle and selected actor", () => {
    const project = store.getCurrent();
    const actorId = project.database.actors[0]?.id ?? "";
    const root = renderWithFakeDom(() =>
      actorPicker({ project, selectedId: actorId, testid: "shared-actor-select" }).root
    );
    expect(findByTestId(root, "shared-actor-select")?.value).toBe(actorId);
    expect(findByTestId(root, "shared-actor-select-card")?.textContent).toBeTruthy();
  });

  it("searchableRecordBrowser filters and selects by card", () => {
    const project = store.getCurrent();
    const weapons = project.database.equipment.filter((entry) => entry.slot === "weapon");
    const first = weapons[0];
    if (!first) throw new Error("missing weapon");

    let selected = first.id;
    const body = renderWithFakeDom(() => {
      const browser = searchableRecordBrowser({
        records: weapons,
        selectedId: first.id,
        testidPrefix: "shared-equip",
        selectTestId: "shared-equip-select",
        label: "장비",
        searchPlaceholder: "검색",
        emptySelectionLabel: "해제",
        noneCardLabel: "해제",
        noneCardMeta: "비우기",
        allowNone: true,
        subtitleOf: (record) => record.slot,
        onChange: (id) => {
          selected = id;
        },
      });
      return browser.root;
    });

    expect(findByTestId(body, "shared-equip-browser")).not.toBeNull();
    expect(findByTestId(body, "shared-equip-select")?.value).toBe(first.id);
    expect(findByTestId(body, `shared-equip-card-${first.id}`)).not.toBeNull();

    const search = findByTestId(body, "shared-equip-search") as FakeElement | null;
    if (search) {
      search.value = "zzzz-nope";
      search.dispatchEvent(new Event("input"));
    }
    expect(findByTestId(body, `shared-equip-card-${first.id}`)).toBeNull();

    if (search) {
      search.value = "";
      search.dispatchEvent(new Event("input"));
    }
    (findByTestId(body, "shared-equip-card-unequip") as FakeElement | null)?.dispatchEvent(new Event("click"));
    expect(selected).toBe("");
  });
});
