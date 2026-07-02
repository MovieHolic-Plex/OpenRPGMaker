import type { ItemRecord } from "@/project/types";
import type { StatusMenuFunctionSceneOptions } from "@/player/playerStatusMenuFunctionTypes";
import { actorFaceTile, actionButton, classicScene, classicWindow, descriptionStrip, entryIcon } from "@/player/playerStatusMenuClassicDom";
import { actorLevel, actorVitals, partyActors, slotStatus } from "@/player/playerStatusMenuFunctionData";
import { el } from "@/util/dom";

export function renderItemScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const items = options.project.database.items.filter((item) => (options.session.inventory[item.id] ?? 0) > 0);
  const selected = items[0];
  if (options.targetItemId) return renderItemTargetScene(options);
  return classicScene({ commandId: "items", title: "아이템", testId: "status-menu-classic-items", className: "status-menu-classic-items-scene", children: [
    selected ? itemDescriptionStrip(selected) : descriptionStrip("가지고 있는 아이템이 없습니다."),
    el("div", { class: "status-menu-classic-item-layout", children: [
      classicWindow("status-menu-item-list-panel", [
        itemListHeader(),
        el("div", {
          class: "status-menu-classic-item-grid",
          dataset: { testid: "status-menu-classic-item-grid" },
          children: items.slice(0, 6).map((item, index) => itemButton(options, item, index === 0)),
        }),
      ], "status-menu-item-list-panel"),
      classicWindow("status-menu-item-detail-panel", selected ? itemDetail(options, selected) : [
        el("div", { class: "status-menu-classic-empty-selection", text: " " }),
      ], "status-menu-item-detail-panel"),
    ] }),
  ] });
}

function itemDescriptionStrip(item: ItemRecord): HTMLElement {
  return classicWindow("status-menu-classic-description-strip status-menu-item-description", [
    el("span", { class: "status-menu-item-description-primary", text: item.description }),
    el("span", { class: "status-menu-item-description-meta", text: `${itemEffect(item)}  ${itemPerformance(item)}` }),
  ], "status-menu-classic-description");
}

export function renderSaveScene(options: StatusMenuFunctionSceneOptions, kind: "save" | "load"): HTMLElement {
  const prompt = kind === "save" ? "Save to which file? / 저장할 파일을 선택하세요" : "Load which file? / 불러올 파일을 선택하세요";
  return classicScene({ commandId: kind, title: kind === "save" ? "저장" : "로드", testId: `status-menu-classic-${kind}`, className: "status-menu-classic-save-scene", children: [
    classicWindow("status-menu-classic-save-prompt", [el("span", { text: prompt })], "status-menu-classic-save-prompt"),
    el("div", {
      class: "status-menu-classic-save-slots",
      children: options.slots.map((slot) => actionButton({
        testId: kind === "save" ? `save-slot-${slot.slot}` : `load-slot-${slot.slot}`,
        className: "status-menu-classic-save-slot",
        children: [
          el("div", { class: "status-menu-classic-save-copy", children: [
            el("span", { class: "status-menu-classic-slot-marker", text: `File ${slot.slot}`, dataset: { testid: `status-menu-classic-${kind}-slot-${slot.slot}` } }),
            el("span", { class: "status-menu-classic-save-file", text: `${slot.slot}번 슬롯` }),
            el("span", { class: "status-menu-classic-save-summary", text: saveSlotSummary(options, slotStatus(slot)) }),
          ] }),
          partyFaces(options),
        ],
        onClick: () => kind === "save" ? options.actions.onSaveSlot(slot.slot) : options.actions.onLoadSlot(slot.slot),
        disabled: kind === "load" && slot.kind !== "present",
      })),
    }),
  ] });
}

function renderItemTargetScene(options: StatusMenuFunctionSceneOptions): HTMLElement {
  const item = options.project.database.items.find((record) => record.id === options.targetItemId);
  return classicScene({ commandId: "items", title: "아이템", testId: "status-menu-classic-items", className: "status-menu-classic-items-scene", children: [
    descriptionStrip(item ? `${item.name}: ${item.description}` : "대상을 선택하세요"),
    classicWindow("status-menu-classic-actor-targets", partyActors(options.project, options.session).map((actor) => actionButton({
      testId: `status-menu-item-target-${actor.id}`,
      className: "status-menu-classic-actor-row",
      children: [actorFaceTile(options.project, actor), el("span", { text: actor.name }), el("span", { text: actorVitals(options.session, actor.id) })],
      onClick: () => item ? options.actions.onUseItem(item.id, actor.id) : undefined,
    })), "status-menu-classic-actor-targets"),
  ] });
}

function itemButton(options: StatusMenuFunctionSceneOptions, item: ItemRecord, selected: boolean): HTMLElement {
  const count = options.session.inventory[item.id] ?? 0;
  const activate = item.scope === "ally" || item.scope === "allAllies"
    ? () => options.actions.onSelectItemTarget(item.id)
    : () => options.actions.onUseItem(item.id);
  return actionButton({ testId: `status-menu-item-${item.id}`, className: `status-menu-classic-item${selected ? " selected" : ""}`, children: [
    entryIcon(options.project, item.iconResourceId ?? item.imageResourceId, item.name),
    el("span", { class: "status-menu-classic-item-name", text: item.name }),
    el("span", { class: "status-menu-classic-item-count", text: `${count}개` }),
    el("span", { class: "status-menu-entry-effect", text: itemShortEffect(item), dataset: { testid: "status-menu-entry-effect" } }),
    el("span", { class: "status-menu-entry-performance", text: itemPerformance(item), dataset: { testid: "status-menu-entry-performance" } }),
  ], onClick: activate });
}

function itemListHeader(): HTMLElement {
  return el("div", { class: "status-menu-item-list-header", children: [
    el("span", { class: "status-menu-item-list-title", text: "아이템" }),
    el("div", { class: "status-menu-item-filters", children: [
      el("span", { class: "status-menu-item-filter selected", text: "전체", dataset: { testid: "status-menu-item-filter-all" } }),
      el("span", { class: "status-menu-item-filter", text: "소모품" }),
      el("span", { class: "status-menu-item-filter", text: "중요" }),
    ] }),
  ] });
}

function itemDetail(options: StatusMenuFunctionSceneOptions, item: ItemRecord): readonly HTMLElement[] {
  return [
    el("div", { class: "status-menu-item-detail-title", text: "선택한 아이템" }),
    el("div", { class: "status-menu-item-detail-hero", children: [
      entryIcon(options.project, item.iconResourceId ?? item.imageResourceId, item.name),
      el("div", { class: "status-menu-item-detail-heading", children: [
        el("span", { class: "status-menu-item-detail-name", text: item.name, dataset: { testid: "status-menu-item-detail-name" } }),
        el("span", { class: "status-menu-item-detail-type", text: itemTypeLabel(item.type) }),
      ] }),
    ] }),
    el("div", { class: "status-menu-item-detail-separator" }),
    detailLine("효과", item.description),
    detailLine("", itemShortEffect(item)),
    detailLine("대상", itemScopeLabel(item.scope), "status-menu-item-detail-target"),
    detailLine("가격", `${item.price} G`, undefined, "gold"),
    detailLine("소비", item.consumable ? "소비 아이템" : "비소비 아이템"),
    el("div", { class: "status-menu-item-detail-separator" }),
    el("div", { class: "status-menu-item-target-title", text: "대상 선택" }),
    el("div", {
      class: "status-menu-item-target-preview",
      dataset: { testid: "status-menu-item-target-preview" },
      children: partyActors(options.project, options.session).map((actor, index) => targetRow({ options, item, actor, selected: index === 0 })),
    }),
  ];
}

function detailLine(label: string, value: string, testId?: string, tone = ""): HTMLElement {
  return el("div", {
    class: `status-menu-item-detail-line ${tone}`.trim(),
    dataset: testId ? { testid: testId } : undefined,
    children: [
      el("span", { class: "status-menu-item-detail-label", text: label }),
      el("span", { class: "status-menu-item-detail-copy", text: value || " " }),
    ],
  });
}

function targetRow(row: {
  readonly options: StatusMenuFunctionSceneOptions;
  readonly item: ItemRecord;
  readonly actor: ReturnType<typeof partyActors>[number];
  readonly selected: boolean;
}): HTMLElement {
  const { options, item, actor, selected } = row;
  const vitals = options.session.actorVitals[actor.id];
  return actionButton({
    testId: `status-menu-item-target-row-${actor.id}`,
    className: `status-menu-item-target-row${selected ? " selected" : ""}`,
    children: [
      actorFaceTile(options.project, actor, "thumb"),
      el("div", { class: "status-menu-item-target-name", children: [
        el("span", { text: actor.name }),
        el("span", { text: `Lv ${actorLevel(options.session, actor)}` }),
      ] }),
      el("div", { class: "status-menu-item-target-vitals", children: [
        meter("HP", vitals?.hp ?? 0, vitals?.maxHp ?? 0),
        meter("MP", vitals?.mp ?? 0, vitals?.maxMp ?? 0),
      ] }),
    ],
    onClick: item.scope === "ally" || item.scope === "allAllies" ? () => options.actions.onUseItem(item.id, actor.id) : undefined,
  });
}

function meter(label: "HP" | "MP", current: number, max: number): HTMLElement {
  const percent = max > 0 ? Math.max(0, Math.min(100, Math.round(current / max * 100))) : 0;
  return el("div", { class: `status-menu-item-meter ${label.toLowerCase()}`, children: [
    el("span", { class: "status-menu-item-bar-label", text: label }),
    el("span", { class: "status-menu-item-bar-value", text: `${current} / ${max}` }),
    el("span", { class: "status-menu-item-bar-track", children: [
      el("span", { class: "status-menu-item-bar-fill", attrs: { style: `--value:${percent}%` } }),
    ] }),
  ] });
}

function partyFaces(options: StatusMenuFunctionSceneOptions): HTMLElement {
  return el("div", {
    class: "status-menu-classic-save-party-faces",
    dataset: { testid: "status-menu-classic-save-party-faces" },
    children: partyActors(options.project, options.session).slice(0, 4).map((actor) => actorFaceTile(options.project, actor, "thumb")),
  });
}

function saveSlotSummary(options: StatusMenuFunctionSceneOptions, status: string): string {
  const leadActor = partyActors(options.project, options.session)[0];
  if (!leadActor) return status;
  const vitals = options.session.actorVitals[leadActor.id];
  return vitals ? `${leadActor.name}  L ${options.session.actorLevels[leadActor.id] ?? leadActor.initialLevel}  H ${vitals.hp}` : leadActor.name;
}

function itemEffect(item: ItemRecord): string {
  const hp = recovery(item.hpRecovery.flat, item.hpRecovery.percentMax, "HP");
  const mp = recovery(item.mpRecovery.flat, item.mpRecovery.percentMax, "MP");
  const states = item.healStateIds.length || item.stateEffects.length ? " / 상태" : "";
  return `효과 ${hp} ${mp}${states}`;
}

function itemShortEffect(item: ItemRecord): string {
  if (item.healStateIds.length || item.stateEffects.some((effect) => effect.operation === "remove")) return "상태 이상 회복";
  if (item.hpRecovery.flat || item.hpRecovery.percentMax) return `${recovery(item.hpRecovery.flat, item.hpRecovery.percentMax, "HP")} 회복`;
  if (item.mpRecovery.flat || item.mpRecovery.percentMax) return `${recovery(item.mpRecovery.flat, item.mpRecovery.percentMax, "MP")} 회복`;
  if (item.occasion === "field") return "마을로 이동";
  return item.type === "normalGoods" ? "중요 아이템" : "사용 아이템";
}

function itemPerformance(item: ItemRecord): string {
  return `가격 ${item.price}G / ${item.consumable ? "소비" : "비소비"}`;
}

function itemScopeLabel(scope: ItemRecord["scope"]): string {
  switch (scope) {
    case "ally": return "아군 1명";
    case "allAllies": return "아군 전체";
    case "enemy": return "적 1명";
    case "none": return "대상 없음";
    default: return assertNever(scope);
  }
}

function itemTypeLabel(type: ItemRecord["type"]): string {
  switch (type) {
    case "medicine": return "아이템";
    case "normalGoods": return "중요";
    case "book": return "교본";
    case "seed": return "성장";
    case "special": return "특수";
    case "switch": return "스위치";
    case "weapon":
    case "shield":
    case "body":
    case "head":
    case "accessory":
      return "장비";
    default: return assertNever(type);
  }
}

function recovery(flat: number, percent: number, label: string): string {
  if (flat === 0 && percent === 0) return `${label} 0`;
  return `${label} ${flat >= 0 ? "+" : ""}${flat}${percent ? ` +${percent}%` : ""}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled item menu value: ${String(value)}`);
}
