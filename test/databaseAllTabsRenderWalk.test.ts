import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab, TAB_GROUPS, type DatabaseTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { DATABASE_PRIMARY_SENTINELS } from "./databasePrimarySentinels";
import { installFakeDom } from "./fakeDom";

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
    const all: DatabaseTab[] = ["overview", ...TAB_GROUPS.flatMap((g) => g.tabs)];
    expect(all.length).toBeGreaterThanOrEqual(34);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(Object.keys(DATABASE_PRIMARY_SENTINELS)));
    const failures: string[] = [];
    for (const tab of all) {
      try {
        setDatabaseActiveTab(tab);
        const root = document.createElement("div");
        renderDatabasePanel(root);
        const body = root.querySelector(".db-body");
        if (!body || body.childNodes.length === 0) failures.push(`${tab}: empty body`);
        if (!body?.querySelector(DATABASE_PRIMARY_SENTINELS[tab])) failures.push(`${tab}: missing destination sentinel ${DATABASE_PRIMARY_SENTINELS[tab]}`);
      } catch (e) {
        failures.push(`${tab}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
