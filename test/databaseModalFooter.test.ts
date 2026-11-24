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

  // 도움말·되돌리기(Ctrl+Z)는 머리줄 ⋯ 안으로 옮겼다(impl-database PR-D) — 발 줄에는 저장 결정만 남는다.
  it("keeps dismissal in the header, rare actions behind the header ⋯, and only saving in the footer", () => {
    openDatabaseModal("actors");

    const labels = footerButtons().map((button) => button.textContent);
    expect(labels).toEqual(["지금 저장"]);
    const menu = document.querySelector<HTMLElement>("[data-testid='database-modal-more-menu']");
    expect(menu?.hidden).toBe(true);
    document.querySelector<HTMLElement>("[data-testid='database-modal-more']")?.click();
    expect(menu?.hidden).toBe(false);
    expect(["database-dock-toggle", "database-modal-maximize", "database-footer-help", "database-footer-undo"]
      .every((testid) => menu?.querySelector(`[data-testid='${testid}']`))).toBe(true);
    // 메뉴 밖(본문)을 누르면 닫힌다 — 열린 채로 남아 오른쪽 칸을 가리던 결함.
    document.querySelector<HTMLElement>(".database-modal-body")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu?.hidden).toBe(true);
    expect(document.querySelector("[data-testid='database-footer-cancel']")).toBeNull();

    const applyButton = document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.apply}']`);
    expect(applyButton?.textContent).toBe("지금 저장");
  });

  it("closes and keeps store edits from the header X", () => {
    openDatabaseModal("actors");
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

    document.querySelector<HTMLElement>("[data-testid='database-modal-close']")?.click();

    expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
    expect(store.getCurrent().database.actors.find((actor) => actor.id === actorId)?.name).toBe("Dirty Actor");
  });

  // 1255da55cc: 레코드 편집은 자동 저장이 이어받으므로 Escape 도 X·「닫기」처럼 바로 닫고 편집을 남긴다.
  // 닫기를 붙잡는 것은 스토어 밖의 설정집 카드 초안뿐이다.
  it("Escape closes like 닫기 and keeps store edits without a restore prompt", () => {
    openDatabaseModal("actors");
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

    document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));

    expect(document.querySelector("[data-testid='database-dirty-prompt']")).toBeNull();
    expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
    expect(store.getCurrent().database.actors.find((actor) => actor.id === actorId)?.name).toBe("Dirty Actor");
  });
});
