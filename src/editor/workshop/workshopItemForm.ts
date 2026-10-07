// src/editor/workshop/workshopItemForm.ts
/** 새 기물 정의 폼. 저장하면 이 프로젝트의 기물 목록에 들어가고 바로 후보를 뽑을 수 있다. */
import type { ItemDefinition } from "@/harnesses/_core/workshop/types";
import { KIND_LABELS, newItemKey } from "@/harnesses/interior-props/editor/items";
import { MAP_KIND_LABELS, MAX_RISE, MAX_TILES_H, MAX_TILES_W } from "@/harnesses/map-objects/editor/items";
import { el } from "@/util/dom";
import { currentDrawTarget, mapObjectPalette } from "./mapObjectTarget";
import { runAction } from "./workshopRoundView";
import type { WorkshopSession } from "./workshopSession";

export function renderItemForm(session: WorkshopSession, onSaved: (key: string) => void, onCancel: () => void, initial?: { readonly title: string; readonly description: string }): HTMLElement {
  // 맵 기물(map-objects)은 지금 맵의 칩셋에 그려 넣는다 — 칸 상한·종류 이름이 다르고, 분류·닮은 기물 칸이 없다
  const mapObjects = session.harnessId === "map-objects";
  const target = mapObjects ? currentDrawTarget() : null;
  const items = session.items();
  const categories = [...new Set(items.map((item) => item.category))].sort();
  const field = (labelText: string, control: HTMLElement) => el("label", { children: [labelText, control] });
  const title = el("input", { attrs: { required: "", placeholder: mapObjects ? "예: 돌 이정표" : "예: 약초 말리는 선반" } }) as HTMLInputElement;
  const description = el("textarea", { attrs: { placeholder: mapObjects ? "그림 명세 — 무엇이 어디에 몇 개, 재료·색. 예: 이끼 낀 돌 이정표, 위에 작은 등불." : "그림 명세 — 무엇이 어디에 몇 개, 재료·색. 예: 나무 선반 3단, 말린 약초 다발이 걸려 있다." } }) as HTMLTextAreaElement;
  const maxW = mapObjects ? MAX_TILES_W : 3, maxH = mapObjects ? MAX_TILES_H : 2, maxRise = mapObjects ? MAX_RISE : 32;
  const tilesW = el("input", { value: 1, attrs: { type: "number", min: "1", max: String(maxW) } }) as HTMLInputElement;
  const tilesH = el("input", { value: 1, attrs: { type: "number", min: "1", max: String(maxH) } }) as HTMLInputElement;
  const rise = el("input", { value: 16, attrs: { type: "number", min: "0", max: String(maxRise), step: "1" } }) as HTMLInputElement;
  const kind = el("select", { children: Object.entries(mapObjects ? MAP_KIND_LABELS : KIND_LABELS).map(([value, text]) => el("option", { value, text })) }) as HTMLSelectElement;
  const category = el("input", { attrs: { list: "workshop-categories", placeholder: "분류(예: 약방)" } }) as HTMLInputElement;
  const use = el("input", { attrs: { placeholder: "쓰임(쉼표로) — 예: search" } }) as HTMLInputElement;
  const refs = el("select", {
    attrs: { multiple: "", size: "6", "aria-label": "닮은 기존 기물" },
    children: items.filter((item) => !item.isNew).map((item) => el("option", { value: item.key, text: `${item.title} · ${item.category}` })),
  }) as HTMLSelectElement;
  const error = el("p", { class: "workshop-blocked" });
  if (initial) {
    title.value = initial.title;
    description.value = initial.description;
  }

  async function save(): Promise<void> {
    if (!title.value.trim() || !description.value.trim()) {
      error.textContent = "이름과 설명은 꼭 적어 주세요.";
      return;
    }
    if (target && target.harnessId !== "map-objects") {
      error.textContent = target.harnessId === null ? target.reason : "이 맵은 손 도트 실내라 「실내 기물」 공방에서 그려요.";
      return;
    }
    const base: ItemDefinition = {
      key: newItemKey(title.value, new Set(items.map((item) => item.key))),
      title: title.value.trim(),
      description: description.value.trim(),
      tilesW: Math.max(1, Math.min(maxW, Number(tilesW.value) || 1)),
      tilesH: Math.max(1, Math.min(maxH, Number(tilesH.value) || 1)),
      rise: Math.max(0, Math.min(maxRise, Number(rise.value) || 0)),
      kind: kind.value,
      category: target ? target.name : category.value.trim() || "새 기물",
      use: use.value.split(",").map((s) => s.trim()).filter(Boolean),
      refs: target ? [] : [...refs.selectedOptions].map((option) => option.value).slice(0, 3),
    };
    let def = base;
    if (target) {
      error.textContent = "칩셋에서 색을 뽑는 중…";
      const palette = await mapObjectPalette(session.env, target.tilesetId, base.title, base.description);
      if (!palette.length) {
        error.textContent = "칩셋 그림을 읽지 못했어요. 맵 칩셋이 다 불러와졌는지 확인하고 다시 저장해 주세요.";
        return;
      }
      def = { ...base, tilesetId: target.tilesetId, palette };
    }
    await session.store.putItemDef(session.projectKey, def);
    await session.reload();
    onSaved(def.key);
  }

  return el("form", {
    class: "workshop-form", dataset: { testid: "workshop-item-form" },
    on: { submit: (event) => { event.preventDefault(); runAction(save, (message) => { error.textContent = `저장하지 못했습니다: ${message}`; }); } },
    children: [
      el("h3", { text: "새 기물 정의" }),
      ...(target ? [el("p", {
        class: target.harnessId === "map-objects" ? "workshop-item-meta" : "workshop-blocked", dataset: { testid: "workshop-form-target" },
        text: target.harnessId === "map-objects" ? `지금 맵 칩셋 「${target.name}」의 색과 화풍으로 그려서 그 칩셋에 넣어요.` : target.harnessId === null ? target.reason : "이 맵은 손 도트 실내라 「실내 기물」 공방에서 그려요.",
      })] : []),
      field("이름", title),
      field("설명(그림 명세)", description),
      el("div", { class: "workshop-form-row", children: [field("가로 칸", tilesW), field("세로 칸(발밑)", tilesH), field("위로 솟는 px", rise)] }),
      field("종류", kind),
      ...(target ? [] : [field("분류", category), el("datalist", { attrs: { id: "workshop-categories" }, children: categories.map((c) => el("option", { value: c })) })]),
      field("쓰임", use),
      ...(target ? [] : [field("닮은 기존 기물(최대 3개, Ctrl/⌘ 로 여러 개)", refs)]),
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
