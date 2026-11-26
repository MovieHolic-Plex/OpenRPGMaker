// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { modalStackDepthForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";

describe("customSelectEscapeLayer", () => {
  isolateTimers();
  /**
   * 왜 이 테스트가 있는가 (실측): modalStack 은 keydown 을 document 캡처 단계에서 잡아
   * stopPropagation 한다(src/editor/ui/modalStack.ts). 캡처는 document -> root 순으로 흐르므로
   * 열린 드롭다운을 층으로 등록하지 않으면 Esc 가 customSelect 의 핸들러에 도달하기 전에 모달
   * 전체를 닫는다 — 드롭다운과 모달이 한 번에 사라진다. 이것이 "한 층에 Esc 하나" 라는
   * modalStack 의 존재 이유를 깨는 상태였다.
   *
   * 기존 test/aiSettingsModalLayout.test.ts 는 깊이가 1인 것만 단정하고 드롭다운을 열어놓고
   * Esc 를 누르는 경로를 전혀 실행하지 않았다 — 그래서 이 결함이 통과했다.
   */

  function buildModalWithSelect(): { modal: HTMLElement; trigger: HTMLButtonElement; closed: string[] } {
    const closed: string[] = [];
    const modal = document.createElement("div");
    modal.setAttribute("role", "dialog");
    const select = document.createElement("select");
    select.setAttribute("aria-label", "추론 강도");
    for (const value of ["낮음", "보통", "높음"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
    modal.append(select);
    document.body.append(modal);
    registerModal(modal, () => {
      closed.push("modal");
      modal.remove();
    });
    installEventEditorCustomSelects(modal);
    const trigger = modal.querySelector<HTMLButtonElement>(".event-custom-select-trigger");
    if (!trigger) throw new Error("트리거가 만들어지지 않았다");
    return { modal, trigger, closed };
  }
  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  }
  describe("커스텀 셀렉트 Esc 층 소유", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      resetModalStackForTest();
    });

    it("드롭다운을 열면 modalStack 최상위 층이 팝오버다", () => {
      const { trigger } = buildModalWithSelect();
      expect(modalStackDepthForTest()).toBe(1);
      trigger.click();
      expect(modalStackDepthForTest()).toBe(2);
    });

    it("Esc 한 번은 드롭다운만 닫고 모달은 남긴다", () => {
      const { modal, trigger, closed } = buildModalWithSelect();
      trigger.click();
      expect(document.querySelector(".event-custom-select-popover")).not.toBeNull();

      pressEscape();

      expect(document.querySelector(".event-custom-select-popover")).toBeNull();
      expect(closed).toEqual([]);
      expect(modal.isConnected).toBe(true);
      expect(modalStackDepthForTest()).toBe(1);
    });

    it("드롭다운이 닫힌 뒤의 Esc 는 모달을 닫는다", () => {
      const { modal, trigger, closed } = buildModalWithSelect();
      trigger.click();
      pressEscape();
      pressEscape();

      expect(closed).toEqual(["modal"]);
      expect(modal.isConnected).toBe(false);
    });

    it("옵션을 골라 닫아도 층이 남지 않는다", () => {
      const { trigger } = buildModalWithSelect();
      trigger.click();
      const option = document.querySelector<HTMLButtonElement>(".event-custom-select-option");
      if (!option) throw new Error("옵션이 없다");
      option.click();
      expect(modalStackDepthForTest()).toBe(1);
    });
  });
});

describe("eventEditorCustomSelect", () => {
  isolateTimers();
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
});

describe("eventValidationSelectFocus", () => {
  isolateTimers();
  it("hands focused native control ownership to its newly enhanced trigger", async () => {
    // Given: validation focuses a select before the host's insertion observer enhances it.
    const root = document.createElement("div");
    document.body.append(root);
    const controller = installEventEditorCustomSelects(root);
    try {
      const select = document.createElement("select");
      select.dataset.testid = "validation-select";
      const option = document.createElement("option");
      option.value = "one"; option.textContent = "one";
      select.append(option);
      const enhanced = new Promise<void>((resolve, reject) => {
        const observer = new MutationObserver(() => {
          if (!root.querySelector("[data-custom-select-for]")) return;
          clearTimeout(timeout); observer.disconnect(); resolve();
        });
        const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Missing select enhancement")); }, 2000);
        observer.observe(root, { childList: true, subtree: true });
      });
      // When: insertion and immediate field navigation happen in one action.
      root.append(select);
      select.focus();
      await enhanced;
      // Then: reparenting has not stranded focus on the hidden native control/body.
      expect(document.activeElement).toBe(root.querySelector("[data-custom-select-for]"));
    } finally { controller.dispose(); root.remove(); }
  });
});
