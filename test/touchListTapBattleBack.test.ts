/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { installTouchListTap } from "@/player/touchListTap";

// 2026-11-10 fs-combo-cancel: 390px 터치에서 전투 「뒤로」를 한 번 탭하면 커서만 옮겨 취소가 안 됐다(6/6).
function battleMenu(): { root: HTMLElement; skill: HTMLButtonElement; back: HTMLButtonElement; clicks: string[] } {
  const root = document.createElement("div");
  const menu = document.createElement("div");
  menu.className = "battle-command-menu";
  const clicks: string[] = [];
  const row = (id: string, icon: string): HTMLButtonElement => {
    const button = document.createElement("button");
    button.className = "battle-command";
    button.dataset.testid = id;
    button.dataset.commandIcon = icon;
    button.addEventListener("click", () => clicks.push(id));
    menu.append(button);
    return button;
  };
  const skill = row("actor-skill-a", "fire");
  skill.setAttribute("aria-current", "true");
  row("actor-skill-b", "fire");
  const back = row("actor-command-back", "back");
  root.append(menu);
  document.body.append(root);
  return { root, skill, back, clicks };
}

function tap(target: Element): void {
  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

describe("전투 메뉴 터치 — 뒤로는 한 번 탭", () => {
  it("커서가 없는 「뒤로」 줄을 한 번 탭하면 바로 실행된다", () => {
    const { root, back, clicks } = battleMenu();
    dispose = installTouchListTap(root);
    tap(back);
    expect(clicks).toEqual(["actor-command-back"]);
  });

  it("커서가 없는 기술 줄은 첫 탭에 실행하지 않는다", () => {
    const { root, clicks } = battleMenu();
    dispose = installTouchListTap(root);
    tap(root.querySelector("[data-testid='actor-skill-b']")!);
    expect(clicks).toEqual([]);
  });
});
