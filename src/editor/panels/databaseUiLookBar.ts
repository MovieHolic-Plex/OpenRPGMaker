/**
 * 「게임 UI 한 벌(uiLook)」 콤팩트 바 — 기본은 1줄 슬림(추천·현재 칩 + 드롭다운)으로 보여 주고,
 * 필요할 때만 13종 전체 칩을 펼친다. 모든 칩은 DOM 에 유지해 기존 testid 계약을 보존한다.
 */
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { UI_LOOKS, applyUiLook, pickUiLook, uiLookById } from "@/project/uiLook";
import { el } from "@/util/dom";

let lastAppliedNote = "";
let lastAppliedProject: Project | null = null;
let uiLookExpanded = false;

function applyLookChoice(lookId: string, onApplied: () => void): void {
  const look = uiLookById(lookId);
  if (!look) return;
  let changed: string[] = [];
  recordProjectSnapshot(`UI 한 벌 적용: ${look.label}`);
  store.update((draft) => {
    if (draft.system.fieldHud?.menuStyle && draft.system.fieldHud.menuStyle !== "project") {
      draft.system.fieldHud.menuStyle = "project";
    }
    changed = applyUiLook(draft, look.id, { force: true });
  }, { scope: "system", label: `UI 한 벌 적용: ${look.label}` });
  lastAppliedProject = store.getCurrent();
  lastAppliedNote = changed.length > 0
    ? `「${look.label}」 적용 — ${changed.join(" · ")}`
    : `이미 「${look.label}」 적용됨`;
  onApplied();
}

/** 1줄 슬림 바 + 접이식 13종 프리셋 그리드. */
export function renderUiLookPresetCard(
  project: Project,
  onApplied: () => void,
  options: { readonly compact?: boolean } = {},
): HTMLElement {
  const currentId = project.system.uiLook;
  const currentLook = uiLookById(currentId);
  const recommended = pickUiLook(project, project.meta.title || "project").look;
  const note = lastAppliedProject === project ? lastAppliedNote : "";

  const select = el("select", {
    class: "db-ui-look-select",
    attrs: { "aria-label": "게임 UI 한 벌 선택" },
    dataset: { testid: "db-ui-look-select" },
    children: [
      el("option", { text: `직접 고르기 (추천: ${recommended.label})`, attrs: { value: "" } }),
      ...UI_LOOKS.map((look) =>
        el("option", {
          text: `${look.label}${look.id === recommended.id ? " · 추천" : ""}`,
          attrs: { value: look.id },
        }),
      ),
    ],
  }) as HTMLSelectElement;
  select.value = currentId ?? "";
  select.addEventListener("change", () => {
    if (select.value) applyLookChoice(select.value, onApplied);
  });

  const grid = el("div", {
    class: `db-ui-look-grid${options.compact ? " is-compact" : ""}`,
    attrs: { role: "group", "aria-label": "게임 UI 한 벌 프리셋" },
    dataset: { testid: "db-ui-look-grid" },
    children: UI_LOOKS.map((look) => {
      const active = look.id === currentId;
      const isRec = look.id === recommended.id;
      return el("button", {
        class: `db-ui-look-chip${active ? " is-active" : ""}${isRec ? " is-recommended" : ""}`,
        attrs: {
          type: "button",
          "aria-pressed": String(active),
          title: `대사창: ${look.dialogue} · 메뉴: ${look.menu} · 전투: ${look.battle} · HUD: ${look.hud.panel}/${look.hud.font}`,
        },
        dataset: { testid: `db-ui-look-chip-${look.id}`, lookId: look.id },
        on: { click: () => applyLookChoice(look.id, onApplied) },
        children: [
          el("strong", { text: look.label }),
          el("small", { text: active ? "✓ 적용됨" : isRec ? "추천" : `${look.dialogue} · ${look.menu}` }),
        ],
      });
    }),
  });
  grid.hidden = !uiLookExpanded;

  const toggleBtn = el("button", {
    class: "btn small db-ui-look-toggle",
    text: uiLookExpanded ? "접기" : "13종 보기",
    attrs: { type: "button", "aria-expanded": String(uiLookExpanded) },
    dataset: { testid: "db-ui-look-toggle" },
    on: {
      click: () => {
        uiLookExpanded = !uiLookExpanded;
        grid.hidden = !uiLookExpanded;
        toggleBtn.textContent = uiLookExpanded ? "접기" : "13종 보기";
        toggleBtn.setAttribute("aria-expanded", String(uiLookExpanded));
      },
    },
  });

  const quickRecBtn = el("button", {
    class: `btn small db-ui-look-quick${currentId === recommended.id ? " is-active" : ""}`,
    text: currentId === recommended.id ? `✓ ${recommended.label}` : `추천 적용: ${recommended.label}`,
    attrs: { type: "button" },
    dataset: { testid: "db-ui-look-apply-recommended" },
    on: { click: () => applyLookChoice(recommended.id, onApplied) },
  });

  const statusLine = el("span", {
    class: "db-ui-look-status",
    attrs: { role: "status" },
    dataset: { testid: "db-ui-look-status" },
    text: note || (currentLook ? `적용 중: ${currentLook.label}` : "대사·메뉴·전투·HUD 일괄 테마"),
  });

  return el("section", {
    class: "db-ui-look-bar",
    dataset: { testid: "db-ui-look-card" },
    children: [
      el("div", {
        class: "db-ui-look-bar-row",
        children: [
          el("strong", { class: "db-ui-look-bar-title", text: "UI 한 벌" }),
          select,
          quickRecBtn,
          toggleBtn,
          statusLine,
        ],
      }),
      grid,
    ],
  });
}
