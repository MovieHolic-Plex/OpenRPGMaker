// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { renderRecordTab, resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

// 휴대 폭 목록/편집 한 화면씩(db-390-trim PR2) — CSS 가 읽는 data-phone-pane 값의 계약.
function render(collection: "states" | "troops"): HTMLElement {
  const host = document.createElement("div");
  document.body.replaceChildren(host);
  renderRecordTab(host, collection, () => render(collection));
  return host;
}

function pane(host: HTMLElement): string | undefined {
  return host.querySelector<HTMLElement>(".db-record-workspace")?.dataset.phonePane;
}

describe("자료집 휴대 폭 목록/편집", () => {
  beforeEach(() => {
    store.replace(createBlankProject(), { preserveEventDrafts: false });
    resetDatabaseRecordViewSession();
    const host = render("states");
    if (pane(host) === "detail") host.querySelector<HTMLElement>('[data-testid="db-phone-back"]')?.click();
  });

  it("처음엔 목록, 행을 누르면 편집, 「목록」을 누르면 다시 목록이다", () => {
    const host = render("states");
    expect(pane(host)).toBe("list");
    host.querySelector<HTMLElement>(".db-list-row")!.click();
    expect(pane(host)).toBe("detail");
    const back = host.querySelector<HTMLElement>('[data-testid="db-phone-back"]')!;
    expect(back.textContent).toContain("목록");
    back.click();
    expect(pane(host)).toBe("list");
  });

  it("편집 화면은 같은 탭을 다시 그려도 유지되고, 다른 탭은 목록부터 시작한다", () => {
    let host = render("states");
    host.querySelector<HTMLElement>(".db-list-row")!.click();
    host = render("states");
    expect(pane(host)).toBe("detail");
    expect(pane(render("troops"))).toBe("list");
  });
});
