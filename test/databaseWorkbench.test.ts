import { describe, expect, it } from "vitest";
import {
  DATABASE_FOOTER_ACTION_TEST_IDS,
  databaseWorkbenchStatusText,
} from "@/editor/panels/databaseWorkbench";

describe("Database RM2K3 workbench context", () => {
  it("summarizes the active tab, stable record id, and footer actions", () => {
    const status = databaseWorkbenchStatusText({
      tabLabel: "주인공",
      tabId: "actors",
      recordName: "Hero",
      recordId: "actor_hero",
      selectedIndex: 1,
      totalCount: 3,
    });

    expect(status).toContain("주인공");
    expect(status).toContain("actors");
    expect(status).toContain("actor_hero");
    expect(status).toContain("1 / 3");
    expect(DATABASE_FOOTER_ACTION_TEST_IDS).toEqual({
      apply: "database-footer-apply",
      cancel: "database-footer-cancel",
      ok: "database-footer-ok",
    });
  });
});
