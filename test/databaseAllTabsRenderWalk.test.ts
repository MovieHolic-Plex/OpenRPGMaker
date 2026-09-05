import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab, TAB_GROUPS } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("database all-tabs render walk", () => {
  it("every registered tab renders a non-empty body without throwing", () => {
    const all = ["overview", ...TAB_GROUPS.flatMap((g) => g.tabs)];
    expect(all.length).toBeGreaterThan(30);
    const failures: string[] = [];
    for (const tab of all) {
      try {
        setDatabaseActiveTab(tab as never);
        const root = document.createElement("div") as unknown as FakeElement;
        renderDatabasePanel(root as unknown as HTMLElement);
        const body = root.querySelector(".db-body");
        if (!body || body.childNodes.length === 0) failures.push(`${tab}: empty body`);
      } catch (e) {
        failures.push(`${tab}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
