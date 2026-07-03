import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDbConnectionStatus, resetDbConnectionHealthForTests } from "@/editor/panels/dbConnectionSettings";
import type { DbPersistenceStatus } from "@/project/persistenceStatus";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("renderDbConnectionStatus", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
    resetDbConnectionHealthForTests();
  });

  afterEach(() => {
    resetDbConnectionHealthForTests();
    restoreDom();
  });

  it("labels saved database settings as a live health check", () => {
    const status: DbPersistenceStatus = {
      kind: "ready",
      projectId: "rpg-zzu-house-template-gallery",
      source: "custom",
      url: "http://dbserver:8100",
    };

    const button = renderWithFakeDom(() => renderDbConnectionStatus(status, () => undefined));

    expect(button.textContent).toBe("DB: 확인 중");
    expect(button.className).toContain("checking");
    expect(button.attrs.title).toContain("실제 연결 상태를 확인");
  });

  it("keeps missing settings visibly separate from a failed ping", () => {
    const status: DbPersistenceStatus = {
      kind: "not-configured",
      missing: ["url", "anonKey"],
      projectId: "rpg-zzu-house-template-gallery",
      source: "custom",
    };

    const button = renderWithFakeDom(() => renderDbConnectionStatus(status, () => undefined));

    expect(button.textContent).toBe("DB: 설정 필요");
    expect(button.className).toContain("not-configured");
  });
});
