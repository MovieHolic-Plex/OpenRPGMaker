// src/editor/workshop/workshopItemForm.ts
/**
 * 「물건·가구」 새로 만들기 폼 — 무엇을 · 설명 · 크기 · 놓는 방식 · 후보 수. 저장하면 이 프로젝트의 물건 목록에 들어가고
 * 바로 후보를 그리기 시작한다. 분류·쓰임·닮은 기물·솟는 px 같은 내부 칸은 2026-10-21 에 화면에서 뺐다(정해진 기본값).
 */
import type { ItemDefinition } from "@/harnesses/_core/workshop/types";
import { newItemKey } from "@/harnesses/interior-props/editor/items";
import { MAX_TILES_H, MAX_TILES_W } from "@/harnesses/map-objects/editor/items";
import { el } from "@/util/dom";
import { currentDrawTarget, mapObjectPalette } from "./mapObjectTarget";
import { runAction } from "./workshopRoundView";
import type { WorkshopSession } from "./workshopSession";
import { generatorStage } from "./workshopArt";
import { WORKSHOP_GENERATORS } from "./generators";

/** 놓는 방식 — 칩셋에 구울 때 통행·층을 정한다(project/workshopTiles.ts HAND_KINDS 와 같은 넷). */
const PLACE_LABELS: Readonly<Record<string, string>> = {
  floor: "바닥에 세우는 물건",
  wall: "벽 앞에 두는 물건",
  hang: "벽에 거는 것",
  flat: "바닥 무늬(밟고 지나감)",
};
/** 발밑 칸 위로 솟는 높이 기본값(px). 세우는 물건은 한 칸만큼 위로 보이고, 거는 것·무늬는 칸 안에 들어간다. */
const DEFAULT_RISE: Readonly<Record<string, number>> = { floor: 16, wall: 16, hang: 0, flat: 0 };

export function renderItemForm(session: WorkshopSession, onSaved: (key: string) => void, onCancel: () => void, initial?: { readonly title: string; readonly description: string }): HTMLElement {
  // 맵 물건(map-objects)은 지금 맵의 칩셋에 그려 넣는다 — 칸 상한이 다르다
  const mapObjects = session.harnessId === "map-objects";
  const target = mapObjects ? currentDrawTarget() : null;
  const items = session.items();
  const field = (labelText: string, control: HTMLElement) => el("label", { children: [labelText, control] });
  const title = el("input", { attrs: { required: "", placeholder: mapObjects ? "예: 돌 이정표" : "예: 약초 말리는 선반" }, dataset: { testid: "workshop-form-title" } }) as HTMLInputElement;
  const description = el("textarea", {
    attrs: { placeholder: mapObjects ? "어떻게 생겼는지 적어 주세요. 예: 이끼 낀 돌 이정표, 위에 작은 등불." : "어떻게 생겼는지 적어 주세요. 예: 나무 선반 3단, 말린 약초 다발이 걸려 있다." },
    dataset: { testid: "workshop-form-description" },
  }) as HTMLTextAreaElement;
  const maxW = mapObjects ? MAX_TILES_W : 3, maxH = mapObjects ? MAX_TILES_H : 2;
  const tilesW = el("input", { value: 1, attrs: { type: "number", min: "1", max: String(maxW) } }) as HTMLInputElement;
  const tilesH = el("input", { value: 1, attrs: { type: "number", min: "1", max: String(maxH) } }) as HTMLInputElement;
  const kind = el("select", { children: Object.entries(PLACE_LABELS).map(([value, text]) => el("option", { value, text })) }) as HTMLSelectElement;
  const count = el("select", {
    dataset: { testid: "workshop-form-count" },
    children: Array.from({ length: session.runner.candidates }, (_, i) => i + 1).map((n) => el("option", { value: n, text: `${n}장`, attrs: n === session.runner.candidates ? { selected: "" } : {} })),
  }) as HTMLSelectElement;
  const error = el("p", { class: "workshop-blocked" });
  if (initial) {
    title.value = initial.title;
    description.value = initial.description;
  }

  async function save(): Promise<void> {
    if (!title.value.trim() || !description.value.trim()) {
      error.textContent = "무엇인지와 어떻게 생겼는지는 꼭 적어 주세요.";
      return;
    }
    if (target && target.harnessId !== "map-objects") {
      error.textContent = target.harnessId === null ? target.reason : "이 맵은 손 도트 실내라 「실내 가구」에 그려요.";
      return;
    }
    const base: ItemDefinition = {
      key: newItemKey(title.value, new Set(items.map((item) => item.key))),
      title: title.value.trim(),
      description: description.value.trim(),
      tilesW: Math.max(1, Math.min(maxW, Number(tilesW.value) || 1)),
      tilesH: Math.max(1, Math.min(maxH, Number(tilesH.value) || 1)),
      rise: DEFAULT_RISE[kind.value] ?? 16,
      kind: kind.value,
      category: target ? target.name : "새 물건",
      use: [],
      refs: [],
    };
    let def = base;
    if (target) {
      error.textContent = "지금 맵 칩셋에서 색을 뽑는 중…";
      const palette = await mapObjectPalette(session.env, target.tilesetId, base.title, base.description);
      if (!palette.length) {
        error.textContent = "칩셋 그림을 읽지 못했어요. 맵 칩셋이 다 불러와졌는지 확인하고 다시 눌러 주세요.";
        return;
      }
      def = { ...base, tilesetId: target.tilesetId, palette };
    }
    await session.store.putItemDef(session.projectKey, def);
    await session.reload();
    // 저장하고 바로 작업 줄에 세운다 — 「만들기」 한 번으로 후보가 나온다(자리가 나면 곧 시작, 동시에 여러 개가 돈다).
    const item = session.items().find((candidate) => candidate.key === def.key);
    if (item) {
      const { workshopQueue } = await import("./queue/workshopQueue");
      await workshopQueue().enqueueObject({ harnessId: session.harnessId, itemKey: item.key, title: item.title, count: Number(count.value), source: "workshop" });
    }
    await session.reload();
    onSaved(def.key);
  }

  const destination = mapObjects
    ? (target?.harnessId === "map-objects" ? `지금 맵 칩셋 「${target.name}」의 색과 그림 느낌으로 그려서 그 칩셋에 넣어요.` : target?.harnessId === null ? target.reason : "이 맵은 손 도트 실내라 「실내 가구」에 그려요.")
    : "실내 맵에서 쓰는 손 도트 실내 칩셋에 넣어요.";

  return el("form", {
    class: "workshop-form", dataset: { testid: "workshop-item-form" },
    on: { submit: (event) => { event.preventDefault(); runAction(save, (message) => { error.textContent = `만들지 못했어요: ${message}`; }); } },
    children: [
      // 머리 무대 — 이 생성기가 그린 물건들(왼쪽 카드와 같은 그림)
      ...WORKSHOP_GENERATORS.filter((g) => g.id === "object-gen").map((g) => generatorStage(g, "hero")),
      el("h3", { text: "무엇을 그릴까요?" }),
      el("p", { class: target && target.harnessId !== "map-objects" ? "workshop-blocked" : "workshop-item-meta", dataset: { testid: "workshop-form-target" }, text: destination }),
      field("무엇", title),
      field("어떻게 생겼나요", description),
      el("div", { class: "workshop-form-row", children: [field("가로 칸", tilesW), field("세로 칸", tilesH), field("놓는 방식", kind), field("후보", count)] }),
      error,
      el("div", {
        class: "workshop-form-actions",
        children: [
          el("button", { class: "workshop-primary", text: "후보 그리기", attrs: { type: "submit" }, dataset: { testid: "workshop-item-save" } }),
          el("button", { text: "취소", attrs: { type: "button" }, on: { click: onCancel } }),
        ],
      }),
      el("p", { class: "workshop-item-meta", text: "AI가 후보를 그리고 다른 AI가 한 번 더 살펴봐요. 마지막에는 직접 보고 한 장을 골라요." }),
    ],
  });
}
