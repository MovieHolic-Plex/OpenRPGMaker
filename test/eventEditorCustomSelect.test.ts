/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";

const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

function option(value: string, label: string): HTMLOptionElement {
  const entry = document.createElement("option");
  entry.value = value;
  entry.textContent = label;
  return entry;
}

function install(select: HTMLSelectElement): HTMLElement {
  const host = document.createElement("div");
  host.append(select);
  document.body.append(host);
  const controller = installEventEditorCustomSelects(host);
  disposers.push(controller.dispose);
  return host;
}

describe("event editor custom select", () => {
  it("uses a custom listbox while preserving native select change events", () => {
    const select = document.createElement("select");
    select.dataset.testid = "event-page-trigger-select";
    select.append(option("action", "액션 버튼"), option("touch", "플레이어 접촉"));
    select.value = "action";
    let changes = 0;
    select.addEventListener("change", () => { changes += 1; });

    const host = install(select);
    const trigger = host.querySelector<HTMLButtonElement>(".event-custom-select-trigger");
    expect(trigger?.textContent).toContain("액션 버튼");
    expect(trigger?.dataset.customSelectFor).toBe("event-page-trigger-select");

    trigger?.click();
    const rows = host.querySelectorAll<HTMLButtonElement>(".event-custom-select-option");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute("aria-selected")).toBe("true");

    rows[1]?.click();
    expect(select.value).toBe("touch");
    expect(changes).toBe(1);
    expect(trigger?.textContent).toContain("플레이어 접촉");
    expect(host.querySelector(".event-custom-select-popover")).toBeNull();
  });

  it("stays synchronized when automation changes the native select", () => {
    const select = document.createElement("select");
    select.append(option("a", "첫 번째"), option("b", "두 번째"));
    select.value = "a";
    const host = install(select);

    select.value = "b";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(host.querySelector(".event-custom-select-value")?.textContent).toBe("두 번째");
  });

  it("does not replace selects that already have a richer custom control", () => {
    const select = document.createElement("select");
    select.className = "rich-native-select";
    select.append(option("a", "A"));
    const host = install(select);

    expect(host.querySelector(".event-custom-select-trigger")).toBeNull();
    expect(select.parentElement).toBe(host);
  });

  it("upgrades selects added by a subdialog rerender", async () => {
    const host = install(document.createElement("select"));
    const dynamic = document.createElement("select");
    dynamic.append(option("one", "새 옵션"));
    host.append(dynamic);

    await Promise.resolve();

    expect(dynamic.classList.contains("event-custom-select-native")).toBe(true);
    expect(dynamic.parentElement?.querySelector(".event-custom-select-trigger")?.textContent).toContain("새 옵션");
  });

  it("adds search for long option lists and filters the visible rows", () => {
    const select = document.createElement("select");
    for (let index = 1; index <= 10; index += 1) select.append(option(String(index), `옵션 ${index}`));
    const host = install(select);

    host.querySelector<HTMLButtonElement>(".event-custom-select-trigger")?.click();
    const search = host.querySelector<HTMLInputElement>(".event-custom-select-search");
    expect(search).not.toBeNull();
    search!.value = "옵션 10";
    search!.dispatchEvent(new Event("input", { bubbles: true }));

    const visible = Array.from(host.querySelectorAll<HTMLButtonElement>(".event-custom-select-option"))
      .filter((row) => !row.hidden);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.textContent).toContain("옵션 10");
  });
});
