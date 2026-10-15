import type { ProjectWorld } from "@/project/world/types";
import { WORLD_RELATION_KINDS } from "@/project/world/types";
import { el } from "@/util/dom";
import { relationTargetLabels, resolveRelationTarget } from "./worldRelationTarget";
import {
  type WorldEditDraft,
  ENTITY_TYPE_LABELS,
  RELATION_KIND_LABELS,
  isWorldRelationKind,
  option,
} from "./worldManager";

export function renderRelationEditor(draft: WorldEditDraft, world: ProjectWorld, syncDraft: () => void, refresh: () => void): HTMLElement {
  // 연결할 문서는 이름을 쳐서 고른다(자동 완성). 저장되는 값은 기존과 같은 문서 id 다.
  const targets = world.entities.filter((entity) => entity.id !== draft.id);
  const labels = relationTargetLabels(targets);
  const listId = `world-relation-targets-${draft.id || "new"}`;
  const targetList = el("datalist", { attrs: { id: listId } });
  for (const entity of targets) {
    const choice = el("option", { attrs: { value: labels.get(entity.id) ?? entity.id } });
    choice.textContent = ENTITY_TYPE_LABELS[entity.type] ?? entity.type;
    targetList.append(choice);
  }
  const targetInput = el("input", {
    class: "world-edit-input",
    attrs: {
      type: "text", list: listId, autocomplete: "off",
      placeholder: targets.length ? "연결할 문서 이름" : "대상 없음",
      "aria-label": "연결할 문서",
      ...(targets.length ? {} : { disabled: "" }),
    },
    dataset: { testid: "world-relation-target" },
  }) as HTMLInputElement;
  const relationError = el("p", { class: "world-edit-error", attrs: { role: "alert" }, dataset: { testid: "world-relation-error" } });
  relationError.hidden = true;
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
          targetInput,
          targetList,
          noteInput,
          el("button", {
            class: "btn small",
            text: "관계 추가",
            attrs: { type: "button" },
            dataset: { testid: "world-relation-add" },
            on: {
              click: () => {
                syncDraft();
                if (!isWorldRelationKind(kindSelect.value)) return;
                const resolved = resolveRelationTarget(targetInput.value, targets, labels);
                if (resolved.kind !== "found") {
                  relationError.textContent = resolved.kind === "ambiguous"
                    ? "이름이 맞는 문서가 여러 개입니다. 목록에서 고르세요."
                    : "연결할 문서를 이름으로 찾지 못했습니다. 목록에서 고르세요.";
                  relationError.hidden = false;
                  return;
                }
                relationError.hidden = true;
                draft.relations.push({
                  a: draft.id,
                  b: resolved.id,
                  kind: kindSelect.value,
                  ...(noteInput.value.trim() ? { note: noteInput.value.trim() } : {}),
                });
                refresh();
              },
            },
          }),
        ],
      }),
      relationError,
    ],
  });
}
