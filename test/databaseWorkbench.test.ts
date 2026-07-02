import { describe, expect, it } from "vitest";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";

describe("Database RM2K3 workbench context", () => {
  it("keeps the footer actions stable", () => {
    expect(DATABASE_FOOTER_ACTION_TEST_IDS).toEqual({
      apply: "database-footer-apply",
      cancel: "database-footer-cancel",
      ok: "database-footer-ok",
    });
  });
});
