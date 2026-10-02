// src/editor/workshop/workshopItemForm.ts
/** 새 기물 정의 폼. 저장하면 이 프로젝트의 기물 목록에 들어가고 바로 후보를 뽑을 수 있다. */
import type { ItemDefinition } from "@/harnesses/_core/workshop/types";
import { KIND_LABELS, newItemKey } from "@/harnesses/interior-props/editor/items";
import { el } from "@/util/dom";
import type { WorkshopSession } from "./workshopSession";

export function renderItemForm(session: WorkshopSession, onSaved: (key: string) => void, onCancel: () => void): HTMLElement {
  const items = session.items();
  const categories = [...new Set(items.map((item) => item.category))].sort();
  const field = (labelText: string, control: HTMLElement) => el("label", { children: [labelText, control] });
  const title = el("input", { attrs: { required: "", placeholder: "예: 약초 말리는 선반" } }) as HTMLInputElement;
  const description = el("textarea", { attrs: { placeholder: "그림 명세 — 무엇이 어디에 몇 개, 재료·색. 예: 나무 선반 3단, 말린 약초 다발이 걸려 있다." } }) as HTMLTextAreaElement;
  const tilesW = el("input", { value: 1, attrs: { type: "number", min: "1", max: "3" } }) as HTMLInputElement;
  const tilesH = el("input", { value: 1, attrs: { type: "number", min: "1", max: "2" } }) as HTMLInputElement;
  const rise = el("input", { value: 16, attrs: { type: "number", min: "0", max: "32", step: "1" } }) as HTMLInputElement;
  const kind = el("select", { children: Object.entries(KIND_LABELS).map(([value, text]) => el("option", { value, text })) }) as HTMLSelectElement;
  const category = el("input", { attrs: { list: "workshop-categories", placeholder: "분류(예: 약방)" } }) as HTMLInputElement;
  const use = el("input", { attrs: { placeholder: "쓰임(쉼표로) — 예: search" } }) as HTMLInputElement;
  const refs = el("select", {
    attrs: { multiple: "", size: "6", "aria-label": "닮은 기존 기물" },
    children: items.filter((item) => !item.isNew).map((item) => el("option", { value: item.key, text: `${item.title} · ${item.category}` })),
  }) as HTMLSelectElement;
  const error = el("p", { class: "workshop-blocked" });

  async function save(): Promise<void> {
    if (!title.value.trim() || !description.value.trim()) {
      error.textContent = "이름과 설명은 꼭 적어 주세요.";
      return;
    }
    const def: ItemDefinition = {
      key: newItemKey(title.value, new Set(items.map((item) => item.key))),
      title: title.value.trim(),
      description: description.value.trim(),
      tilesW: Math.max(1, Math.min(3, Number(tilesW.value) || 1)),
      tilesH: Math.max(1, Math.min(2, Number(tilesH.value) || 1)),
      rise: Math.max(0, Math.min(32, Number(rise.value) || 0)),
      kind: kind.value,
      category: category.value.trim() || "새 기물",
      use: use.value.split(",").map((s) => s.trim()).filter(Boolean),
      refs: [...refs.selectedOptions].map((option) => option.value).slice(0, 3),
    };
    await session.store.putItemDef(session.projectKey, def);
    await session.reload();
    onSaved(def.key);
  }

  return el("form", {
    class: "workshop-form", dataset: { testid: "workshop-item-form" },
    on: { submit: (event) => { event.preventDefault(); void save(); } },
    children: [
      el("h3", { text: "새 기물 정의" }),
      field("이름", title),
      field("설명(그림 명세)", description),
      el("div", { class: "workshop-form-row", children: [field("가로 칸", tilesW), field("세로 칸(발밑)", tilesH), field("위로 솟는 px", rise)] }),
      field("종류", kind),
      field("분류", category),
      el("datalist", { attrs: { id: "workshop-categories" }, children: categories.map((c) => el("option", { value: c })) }),
      field("쓰임", use),
      field("닮은 기존 기물(최대 3개, Ctrl/⌘ 로 여러 개)", refs),
      error,
      el("div", {
        class: "workshop-form-actions",
        children: [
          el("button", { text: "저장", attrs: { type: "submit" }, dataset: { testid: "workshop-item-save" } }),
          el("button", { text: "취소", attrs: { type: "button" }, on: { click: onCancel } }),
        ],
      }),
    ],
  });
}
