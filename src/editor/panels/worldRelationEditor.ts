import type { ProjectWorld } from "@/project/world/types";
import { WORLD_RELATION_KINDS } from "@/project/world/types";
import { el } from "@/util/dom";
import {
  type WorldEditDraft,
  RELATION_KIND_LABELS,
  isWorldRelationKind,
  option,
} from "./worldManager";

export function renderRelationEditor(draft: WorldEditDraft, world: ProjectWorld, syncDraft: () => void, refresh: () => void): HTMLElement {
  const targetSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-relation-target" } }) as HTMLSelectElement;
  const targets = world.entities.filter((entity) => entity.id !== draft.id);
  for (const entity of targets) targetSelect.append(option(entity.id, entity.name || entity.id, false));
  if (targets.length === 0) targetSelect.append(option("", "대상 없음", true));
  targetSelect.value = targets[0]?.id ?? "";
  const kindSelect = el("select", { class: "world-edit-input", dataset: { testid: "world-relation-kind" } }) as HTMLSelectElement;
  for (const kind of WORLD_RELATION_KINDS) kindSelect.append(option(kind, RELATION_KIND_LABELS[kind], kind === "knows"));
  kindSelect.value = "knows";
  const noteInput = el("input", {
    class: "world-edit-input",
    attrs: { type: "text", placeholder: "메모" },
    dataset: { testid: "world-relation-note" },
  }) as HTMLInputElement;
  const related = draft.relations
    .map((relation, index) => ({ relation, index }))
    .filter(({ relation }) => relation.a === draft.id || relation.b === draft.id);

  return el("section", {
    class: "world-edit-section",
    children: [
      el("h4", { text: "관계" }),
      el("div", {
        class: "world-edit-list",
        children: related.length > 0
          ? related.map(({ relation, index }) => {
            const otherId = relation.a === draft.id ? relation.b : relation.a;
            const other = world.entities.find((entity) => entity.id === otherId);
            return el("div", {
              class: "world-edit-row",
              children: [
                el("span", { text: `${RELATION_KIND_LABELS[relation.kind]} · ${other?.name ?? otherId}` }),
                el("button", {
                  class: "btn small",
                  text: "제거",
                  attrs: { type: "button" },
                  dataset: { testid: `world-relation-remove-${index}` },
                  on: {
                    click: () => {
                      syncDraft();
                      draft.relations.splice(index, 1);
                      refresh();
                    },
                  },
                }),
              ],
            });
          })
          : [el("p", { class: "world-muted", text: "관계가 없습니다." })],
      }),
      el("div", {
        class: "world-edit-add-row",
        children: [
          kindSelect,
          targetSelect,
          noteInput,
          el("button", {
            class: "btn small",
            text: "관계 추가",
            attrs: { type: "button" },
            dataset: { testid: "world-relation-add" },
            on: {
              click: () => {
                syncDraft();
                if (!targetSelect.value || !isWorldRelationKind(kindSelect.value)) return;
                draft.relations.push({
                  a: draft.id,
                  b: targetSelect.value,
                  kind: kindSelect.value,
                  ...(noteInput.value.trim() ? { note: noteInput.value.trim() } : {}),
                });
                refresh();
              },
            },
          }),
        ],
      }),
    ],
  });
}
