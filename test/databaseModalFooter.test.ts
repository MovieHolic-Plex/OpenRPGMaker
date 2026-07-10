import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  document.querySelector("[data-testid='database-modal']")?.remove();
  restoreDom?.();
  restoreDom = undefined;
});

function footerButtons(): HTMLElement[] {
  // 레코드 목록 바닥의 "최대 개수" 버튼도 같은 클래스를 재사용하므로, 모달 footer 노드 자체에서
  // 검색해 (fakeDom 셀렉터 엔진은 콤비네이터를 지원하지 않으므로) 스코프를 좁힌다.
  const footer = document.querySelector<HTMLElement>(".database-modal-footer");
  if (!footer) throw new Error("Expected database modal footer");
  return Array.from(footer.querySelectorAll<HTMLElement>(".database-footer-button"));
}

describe("database modal footer — honest auto-save UI", () => {
  it("states that edits auto-save and does not mention the nonexistent OK button", () => {
    openDatabaseModal("actors");

    const status = document.querySelector<HTMLElement>("[data-testid='db-footer-status']");
    expect(status?.textContent).toContain("자동 저장");
    expect(status?.textContent).not.toContain("OK");
  });

  it("only offers 닫기/지금 저장/도움말 in the footer — no duplicate 취소 button", () => {
    openDatabaseModal("actors");

    const labels = footerButtons().map((button) => button.textContent);
    expect(labels).toEqual(["닫기", "지금 저장", "도움말"]);
    expect(document.querySelector("[data-testid='database-footer-cancel']")).toBeNull();

    const applyButton = document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.apply}']`);
    expect(applyButton?.textContent).toBe("지금 저장");
  });

  it("shows a discard-to-open-state option (not a bare 'save' warning) when closing with dirty edits", () => {
    openDatabaseModal("actors");
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

    document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.ok}']`)?.click();

    const prompt = document.querySelector<HTMLElement>("[data-testid='database-dirty-prompt']");
    expect(prompt?.textContent).toContain("이 세션에서 바뀐 내용이 있습니다");

    const discardButton = document.querySelector<HTMLElement>("[data-testid='database-dirty-discard']");
    expect(discardButton?.textContent).toBe("열 때 상태로 되돌리고 닫기");
  });
});
