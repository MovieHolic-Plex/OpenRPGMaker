import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTroopRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

// fix(db): troops는 공용 nameField(onRename→updateRecordRowLabel) 경로 밖에 있어(자체
// textField 사용) 이름을 타이핑해도 좌측 레코드 리스트 라벨이 갱신되지 않았다
// (qa-troops-report.md m5). 리스트 행을 다른 파일이 만드는 실제 구조와 동일한
// data-testid="db-record-row-<id>" + ".db-list-name"으로 흉내내 검증한다.
describe("database troop record view — list row name sync", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("updates the left-side list row label while typing in the name field, without a full rerender", () => {
    const troop = store.getCurrent().database.troops[0];
    if (!troop) throw new Error("missing default troop");

    const row = document.createElement("button");
    row.dataset.testid = `db-record-row-${troop.id}`;
    const nameNode = document.createElement("span");
    nameNode.className = "db-list-name";
    nameNode.textContent = troop.name;
    row.append(nameNode);
    document.body.append(row);

    const form = document.createElement("section");
    let rerenderCalls = 0;
    renderTroopRecordForm(form, troop, () => {
      rerenderCalls += 1;
    });

    const nameInput = form.querySelector("[data-testid='db-field-name']") as (HTMLInputElement & { dispatchEvent: (event: Event) => boolean }) | null;
    if (!nameInput) throw new Error("missing name field");
    nameInput.value = "새 부대이름";
    nameInput.dispatchEvent(new Event("input"));

    expect(nameNode.textContent).toBe("새 부대이름");
    expect(store.getCurrent().database.troops.find((entry) => entry.id === troop.id)?.name).toBe("새 부대이름");
    // typing must not trigger a full rerender (that would drop focus mid-keystroke)
    expect(rerenderCalls).toBe(0);
  });
});
