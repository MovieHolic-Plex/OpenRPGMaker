// planSchedule(주간 일정표) 명령의 실플레이어 UI.
// 480×270 정수배 계약 안에 슬롯 칩 줄 + 활동 카드 목록 + 확정/되돌리기 줄을 담는다.
// 카드 선택은 기존 커서 메뉴(attachCursorMenu)를 쓰고, 고를 때마다 내용을 다시 그려 커서를 다시 붙인다.
import type { StepResult } from "@/player/interpreter";
import type { SchedulePlanActivity } from "@/player/interpreter/schedule";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { el } from "@/util/dom";

type PlanScheduleStep = Extract<StepResult, { kind: "planSchedule" }>;

const TITLE_ID = "runtime-schedule-title";

/** 확정한 활동 id 목록(슬롯 순서). 오버레이를 붙일 곳이 없으면 이전 계획 그대로. */
export async function playPlanSchedule(scene: PlaySceneContext, step: PlanScheduleStep): Promise<string[]> {
  const view = step.view;
  const host = dialogueHost(scene);
  if (!host) return [...view.initial];
  const byId = new Map(view.activities.map((activity) => [activity.id, activity]));
  const slotCount = view.slots.length;
  const picks: string[] = view.initial.filter((id) => byId.has(id)).slice(0, slotCount);

  return new Promise((resolve) => {
    const overlay = document.createElement("section");
    overlay.className = "runtime-overlay runtime-schedule-overlay";
    overlay.dataset.testid = "plan-schedule-scene";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", TITLE_ID);
    overlay.tabIndex = -1;
    const layer = host.closest(".play-viewport") ?? host;
    layer.querySelector("[data-testid='plan-schedule-scene']")?.remove();
    layer.append(overlay);
    overlay.focus({ preventScroll: true });

    const announcement = el("div", {
      class: "dialogue-choice-announcement",
      dataset: { testid: "plan-schedule-announcement" },
      attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
    });
    let detachCursor: (() => void) | null = null;
    let finished = false;

    // Backspace 는 커서 메뉴의 취소 키가 아니므로 직접 듣는다(Esc/X 는 취소 버튼으로 간다).
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Backspace" || event.repeat) return;
      event.preventDefault();
      undoLast();
    };
    window.addEventListener("keydown", onKeyDown, true);

    function usedInPlan(id: string): number {
      let count = 0;
      for (const pick of picks) if (pick === id) count += 1;
      return count;
    }

    function cardState(activity: SchedulePlanActivity): { exhausted: boolean; left?: number } {
      if (activity.remaining === undefined) return { exhausted: false };
      const left = Math.max(0, activity.remaining - usedInPlan(activity.id));
      return { exhausted: left <= 0, left };
    }

    function pick(id: string): void {
      const activity = byId.get(id);
      if (!activity || finished || picks.length >= slotCount) return;
      if (cardState(activity).exhausted) return;
      picks.push(id);
      announcement.textContent = `${activity.label}. ${picks.length}/${slotCount}`;
      render();
    }

    function undoLast(): void {
      if (finished || picks.length === 0) return;
      const removed = picks.pop();
      announcement.textContent = `${byId.get(removed ?? "")?.label ?? ""} 취소. ${picks.length}/${slotCount}`;
      render();
    }

    /** 칸이 다 찼거나, 더 고를 수 있는 활동이 없으면(전부 소진) 지금 계획으로 확정할 수 있다. */
    function canFinish(): boolean {
      if (picks.length >= slotCount) return true;
      return view.activities.every((activity) => cardState(activity).exhausted);
    }

    function confirm(): void {
      if (finished || !canFinish()) return;
      finished = true;
      detachCursor?.();
      detachCursor = null;
      window.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      resolve([...picks]);
    }

    function render(): void {
      detachCursor?.();
      detachCursor = null;
      const full = picks.length >= slotCount;
      const chips = view.slots.map((label, index) => {
        const pickedId = picks[index];
        const chip = el("div", {
          class: "runtime-schedule-slot",
          dataset: { testid: `plan-schedule-slot-${index}` },
          children: [
            el("span", { class: "runtime-schedule-slot-label", text: label }),
            el("span", { class: "runtime-schedule-slot-pick", text: pickedId ? byId.get(pickedId)?.label ?? pickedId : "—" }),
          ],
        });
        if (pickedId) chip.classList.add("filled");
        else if (index === picks.length) chip.classList.add("current");
        return chip;
      });

      const cards = view.activities.map((activity) => {
        const state = cardState(activity);
        const disabled = state.exhausted || full;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "runtime-schedule-card";
        button.dataset.testid = `plan-schedule-activity-${activity.id}`;
        if (state.exhausted) {
          button.classList.add("exhausted");
          button.setAttribute("aria-disabled", "true");
        } else if (full) {
          button.setAttribute("aria-disabled", "true");
        }
        button.setAttribute("aria-label", [activity.label, activity.description, activity.hint].filter(Boolean).join(". "));
        const body = el("span", {
          class: "runtime-schedule-card-body",
          children: [
            el("span", { class: "runtime-schedule-card-name", text: activity.label }),
            el("span", { class: "runtime-schedule-card-desc", text: activity.description }),
            ...(activity.hint ? [el("span", { class: "runtime-schedule-card-hint", text: activity.hint })] : []),
          ],
        });
        button.append(scheduleIcon(activity), body);
        if (state.left !== undefined) {
          button.append(el("span", { class: "runtime-schedule-card-uses", text: `남은 ${state.left}` }));
        }
        button.addEventListener("click", () => {
          if (!disabled) pick(activity.id);
        });
        return { button, disabled };
      });

      const confirmButton = el("button", {
        class: "runtime-schedule-confirm",
        text: "확정",
        attrs: { type: "button" },
        dataset: { testid: "plan-schedule-confirm" },
        on: { click: () => confirm() },
      }) as HTMLButtonElement;
      const undoButton = el("button", {
        class: "runtime-schedule-undo",
        text: "되돌리기",
        attrs: { type: "button" },
        dataset: { testid: "plan-schedule-undo" },
        on: { click: () => undoLast() },
      }) as HTMLButtonElement;
      const finishable = canFinish();
      if (!finishable) {
        confirmButton.hidden = true;
        confirmButton.setAttribute("aria-hidden", "true");
      }
      if (picks.length === 0) {
        undoButton.setAttribute("aria-disabled", "true");
        undoButton.classList.add("exhausted");
      }

      const window_ = el("div", {
        class: "runtime-schedule-window",
        children: [
          el("div", { class: "runtime-schedule-title", text: view.title, attrs: { id: TITLE_ID } }),
          el("div", { class: "runtime-schedule-slots", dataset: { testid: "plan-schedule-slots" }, attrs: { role: "list", "aria-label": "일정 칸" }, children: chips }),
          el("div", {
            class: "runtime-schedule-list",
            dataset: { testid: "plan-schedule-list" },
            attrs: { role: "group", "aria-label": "활동" },
            children: cards.map((card) => card.button),
          }),
          el("div", { class: "runtime-schedule-actions", children: [undoButton, confirmButton] }),
          announcement,
        ],
      });
      overlay.replaceChildren(window_);

      const selectable = cards.filter((card) => !card.disabled).map((card) => card.button);
      const items: HTMLElement[] = finishable
        ? [confirmButton, ...selectable, ...(picks.length > 0 ? [undoButton] : [])]
        : [...selectable, ...(picks.length > 0 ? [undoButton] : [])];
      if (items.length === 0) items.push(confirmButton);
      detachCursor = attachCursorMenu(overlay, {
        items,
        // Esc/X: 마지막 선택을 지운다. 선택이 없으면 아무 일도 없다(일정표는 닫을 수 없다).
        cancelEl: undoButton,
        initialIndex: 0,
        columns: 1,
        freshDom: true,
        onSelect: (index) => {
          const label = items[index]?.getAttribute("aria-label") ?? items[index]?.textContent ?? "";
          if (label && announcement.textContent !== label) announcement.textContent = label;
        },
      });
    }

    render();
  });
}

function scheduleIcon(activity: SchedulePlanActivity): HTMLElement {
  const icon = el("span", { class: "runtime-schedule-card-icon" });
  const project = store.getCurrent();
  if (activity.icon?.kind === "item") {
    const itemId = activity.icon.itemId;
    const item = project.database.items.find((entry) => entry.id === itemId);
    const resourceId = item?.iconResourceId ?? item?.imageResourceId;
    const url = resourceId ? resolveAssetResourceUrl(resourceId) : undefined;
    if (url) {
      icon.style.backgroundImage = `url("${url}")`;
      return icon;
    }
  }
  icon.classList.add("runtime-schedule-card-icon-fallback");
  icon.textContent = activity.label.trim().slice(0, 1) || "?";
  return icon;
}
