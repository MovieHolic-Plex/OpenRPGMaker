import type { Project } from "@/project/types";
import { WORLD_REF_KINDS } from "@/project/world/types";
import type { WorldRef } from "@/project/world/types";
import { clearChildren, el } from "@/util/dom";
import {
  type WorldEditDraft,
  REF_KIND_LABELS,
  isWorldRefKind,
  jumpToWorldRefTarget,
  option,
  refDisplayLabel,
  refOptions,
} from "./worldManager";

export function renderRefJumps(refs: readonly WorldRef[], project: Project): HTMLElement {
  if (refs.length === 0) return el("section", { class: "world-ref-jumps empty", text: "연결된 게임 항목 없음" });
  return el("section", {
    class: "world-ref-jumps",
    children: [
      el("strong", { text: "연결된 게임 항목" }),
      el("div", {
        class: "world-chip-row",
        children: refs.map((ref) =>
          el("button", {
            class: "world-ref-chip",
            text: refDisplayLabel(ref, project),
            attrs: { type: "button" },
            dataset: { testid: `world-ref-jump-${ref.kind}-${ref.id}`, refKind: ref.kind, refId: ref.id },
            on: { click: () => jumpToWorldRefTarget(ref, project) },
          })
        ),
      }),
    ],
  });
}

export function renderRefEditor(draft: WorldEditDraft, project: Project, syncDraft: () => void, refresh: () => void): HTMLElement {
  const kindSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-ref-kind" } }) as HTMLSelectElement;
  for (const kind of WORLD_REF_KINDS) kindSelect.append(option(kind, REF_KIND_LABELS[kind], kind === "map"));
  kindSelect.value = "map";
  const idSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-ref-id" } }) as HTMLSelectElement;
  const populateIds = (): void => {
    clearChildren(idSelect);
    const kind = isWorldRefKind(kindSelect.value) ? kindSelect.value : "map";
    const options = refOptions(project, kind);
    for (const item of options) idSelect.append(option(item.id, item.label, false));
    if (options.length === 0) idSelect.append(option("", "선택할 항목 없음", true));
    idSelect.value = options[0]?.id ?? "";
  };
  kindSelect.addEventListener("change", populateIds);
  populateIds();

  return el("section", {
    class: "world-edit-section",
    children: [
      el("h4", { text: "연결" }),
      el("div", {
        class: "world-edit-list",
        children: draft.refs.length > 0
          ? draft.refs.map((ref, index) =>
            el("div", {
              class: "world-edit-row",
              children: [
                el("span", { text: refDisplayLabel(ref, project) }),
                el("button", {
                  class: "btn small",
                  text: "제거",
                  attrs: { type: "button" },
                  dataset: { testid: `world-ref-remove-${index}` },
                  on: {
                    click: () => {
                      syncDraft();
                      draft.refs.splice(index, 1);
                      refresh();
                    },
                  },
                }),
              ],
            })
          )
          : [el("p", { class: "world-muted", text: "연결이 없습니다." })],
      }),
      el("div", {
        class: "world-edit-add-row",
        children: [
          kindSelect,
          idSelect,
          el("button", {
            class: "btn small",
            text: "연결 추가",
            attrs: { type: "button" },
            dataset: { testid: "world-ref-add" },
            on: {
              click: () => {
                syncDraft();
                if (!isWorldRefKind(kindSelect.value) || !idSelect.value) return;
                const next = { kind: kindSelect.value, id: idSelect.value };
                if (!draft.refs.some((ref) => ref.kind === next.kind && ref.id === next.id)) draft.refs.push(next);
                refresh();
              },
            },
          }),
        ],
      }),
    ],
  });
}
