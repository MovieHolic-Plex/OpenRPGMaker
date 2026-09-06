import type { Project } from "@/project/types";
import { equipmentSlotLabel } from "@/project/equipmentSlots";
import type { ShopGoods } from "@/player/playSceneShopGoods";
import type { ShopEquipmentPreview, ShopEquipmentEffect } from "@/player/shopEquipmentPreview";
import { el } from "@/util/dom";
import { keyHints } from "@/player/playSceneShopParts";
import { SHOP_FOCUS_GROUP_KEY_LABEL, SHOP_DETAIL_SCROLL_KEY_LABEL, CANCEL_KEY_LABEL } from "@/player/keyBindings";

const STAT_LABELS = { attack: "공격", defense: "방어", mind: "정신", agility: "민첩" } as const;
const REASONS = {
  notEquipment: "장비가 아닌 물건은 장착 비교를 제공하지 않습니다.",
  unsupportedItemEquipment: "아이템 자료의 무기는 장비 교체 규칙이 없어 비교할 수 없습니다.",
  missingEquipment: "장비 자료를 찾을 수 없습니다.", noActor: "비교할 파티원이 없습니다.",
  missingActor: "파티원 자료를 찾을 수 없습니다.", invalidSlot: "맞는 장착 부위가 없습니다.",
  notEquippable: "이 동료의 직업 또는 장비 권한으로는 장착할 수 없습니다.",
  fixedEquipment: "장비가 고정되어 교체할 수 없습니다.", cursedEquipment: "저주받은 장비를 해제할 수 없습니다.",
  insufficientInventory: "교체에 필요한 장비가 부족합니다.",
} as const;
const EFFECT_LABELS = {
  doubleAttack: "연속 공격", attackAll: "전체 공격", attackElementIds: "공격 속성",
  elementalDefenseIds: "속성 방어", stateDefenseIds: "상태 방어", accuracy: "명중률",
  criticalRate: "치명타율", stateResistanceChance: "상태 저항 확률", stateDefenseMode: "상태 방어 방식",
} as const;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
const equipmentName = (project: Project, id: string | undefined) =>
  id ? project.database.equipment.find(record => record.id === id)?.name ?? id : "없음";

/** Shared truthful selected-actor summary; detail adds the complete equipment/effect ledger. */
export function shopComparisonSummary(project: Project, preview: ShopEquipmentPreview, detail = false): HTMLElement {
  const wrap = el("section", { class: "runtime-shop-comparison-summary",
    dataset: { previewKind: preview.kind, ...(preview.kind === "ready" ? { sameEquipment: String(preview.sameEquipment) } : {}) } });
  if (preview.kind === "unavailable") {
    wrap.append(el("p", { text: REASONS[preview.reason], dataset: { testid: detail ? "shop-preview-reason" : "shop-summary-reason", reason: preview.reason } }));
    return wrap;
  }
  const actor = preview.targets.find(target => target.actorId === preview.actorId);
  const slot = actor?.slots.find(slot => slot.id === preview.slot);
  wrap.append(el("h3", { class: "runtime-shop-comparison-heading", text: `${actor?.name ?? preview.actorId} · ${slot?.label ?? equipmentSlotLabel(project, preview.slot)}` }));
  wrap.append(el("p", { class: "runtime-shop-replacement", dataset: { testid: detail ? "shop-replacement" : "shop-summary-replacement", slot: preview.slot, equipmentId: preview.currentEquipment[preview.slot] ?? "" },
    text: `현재 장비: ${equipmentName(project, preview.currentEquipment[preview.slot])}` }));
  if (preview.kind === "blocked") wrap.append(el("p", { class: "runtime-shop-preview-reason", text: REASONS[preview.reason],
    dataset: { testid: detail ? "shop-preview-reason" : "shop-summary-reason", reason: preview.reason }, attrs: { role: "status" } }));
  const stats = el("div", { class: "runtime-shop-statgrid runtime-shop-comparison-stats" });
  for (const stat of preview.stats) {
    const next = "next" in stat ? stat.next : undefined;
    const delta = "delta" in stat ? stat.delta : undefined;
    stats.append(el("div", { class: `runtime-shop-stat${delta === undefined || delta === 0 ? " is-same" : delta > 0 ? " is-up" : " is-down"}`,
      dataset: { testid: `${detail ? "shop-stat" : "shop-summary-stat"}-${stat.key}`, current: String(stat.current),
        ...(next === undefined ? {} : { next: String(next), delta: String(delta) }) },
      children: [el("span", { class: "runtime-shop-stat-key", text: STAT_LABELS[stat.key] }),
        el("span", { class: "runtime-shop-stat-value", text: next === undefined ? String(stat.current) : `${stat.current} → ${next}` }),
        ...(delta === undefined ? [] : [el("span", { class: "runtime-shop-stat-delta", text: signed(delta), attrs: { "data-delta-label": "" } })])],
    }));
  }
  wrap.append(stats);
  if (preview.kind !== "ready") return wrap;
  if (preview.sameEquipment) wrap.append(el("p", { class: "runtime-shop-same-equipment", text: "같은 장비 · 변화 없음" }));
  if (!detail) return wrap;
  const displaced = el("section", { class: "runtime-shop-displaced", dataset: { testid: "shop-displaced" }, children: [el("h3", { text: "해제되는 장비" })] });
  for (const entry of preview.displaced) displaced.append(el("div", { text: `${equipmentName(project, entry.id)} ×${entry.count}`,
    dataset: { equipmentId: entry.id, count: String(entry.count) } }));
  if (!preview.displaced.length) displaced.append(el("p", { text: "없음" }));
  wrap.append(displaced);
  for (const [kind, label] of [["gained", "얻는 효과"], ["lost", "잃는 효과"]] as const) {
    const section = el("section", { class: `runtime-shop-effects runtime-shop-effects-${kind}`, dataset: { testid: `shop-effects-${kind}` }, children: [el("h3", { text: label })] });
    for (const effect of preview.effects[kind]) {
      const name = effectName(project, effect);
      section.append(el("div", { text: `${EFFECT_LABELS[effect.key]}${name ? ` · ${name}` : ""}`,
        dataset: { effectKey: effect.key, ...("id" in effect ? { effectId: effect.id, effectName: name } : {}) } }));
    }
    if (!preview.effects[kind].length) section.append(el("p", { text: "없음" }));
    wrap.append(section);
  }
  const changed = el("section", { class: "runtime-shop-effects runtime-shop-effects-changed", dataset: { testid: "shop-effects-changed" }, children: [el("h3", { text: "바뀌는 효과" })] });
  for (const effect of preview.effects.changed) {
    const value = (v: string | number | undefined) => v === "resist" ? "저항" : v === "inflict" ? "부여" : v === undefined ? "없음" : String(v);
    changed.append(el("div", { text: `${EFFECT_LABELS[effect.key]} · ${value(effect.current)} → ${value(effect.next)}${"delta" in effect ? ` (${signed(effect.delta)})` : ""}`,
      dataset: { effectKey: effect.key, current: String(effect.current), next: String(effect.next) } }));
  }
  if (!preview.effects.changed.length) changed.append(el("p", { text: "없음" }));
  wrap.append(changed);
  return wrap;
}
function effectName(project: Project, effect: ShopEquipmentEffect): string {
  if (!("id" in effect)) return "";
  return (effect.key === "stateDefenseIds" ? project.database.states : project.database.elements)
    ?.find(record => record.id === effect.id)?.name ?? effect.id;
}

export function renderShopComparison(options: {
  readonly project: Project; readonly goods: ShopGoods; readonly preview: ShopEquipmentPreview;
  readonly onActor: (id: string) => void; readonly onSlot: (id: string) => void; readonly onClose: () => void;
  readonly signal: AbortSignal;
}): HTMLElement {
  const { project, goods, preview, signal } = options;
  const shell = el("section", { class: "runtime-shop-shell runtime-shop-comparison", dataset: { testid: "shop-comparison", previewKind: preview.kind,
    ...(preview.kind === "unavailable" ? {} : { actorId: preview.actorId, slot: preview.slot }),
    ...(preview.kind === "ready" ? { sameEquipment: String(preview.sameEquipment) } : {}) }, attrs: { "aria-label": "장비 교체 비교" } });
  // Structural containment only. The styling pass owns visual tokens and responsive composition.
  shell.style.display = "flex"; shell.style.flexDirection = "column"; shell.style.minHeight = "0";
  shell.style.flex = "1"; shell.style.overflow = "hidden";
  const scroll = el("div", { class: "runtime-shop-detail-scroll", dataset: { testid: "shop-detail-scroll" }, attrs: { tabindex: "0", role: "region", "aria-label": "장비 비교 상세" } });
  scroll.style.overflow = "auto"; scroll.style.minHeight = "0"; scroll.style.flex = "1";
  scroll.append(el("h2", { text: goods.name }), el("p", { text: goods.description }), el("p", { text: "장착 시의 비교입니다. 구매해도 자동 장착하지 않습니다." }));
  const choices = (kind: "actor" | "slot", entries: readonly { readonly id: string; readonly name: string }[], selected: string | undefined, onPick: (id: string) => void) => {
    const group = el("div", { class: `runtime-shop-${kind}-choices`, attrs: { role: "group", "aria-label": kind === "actor" ? "비교 동료" : "교체 부위" } });
    for (const entry of entries) {
      const button = el("button", { class: kind === "actor" ? "runtime-shop-actor" : "runtime-shop-slot-choice", text: entry.name,
        dataset: { testid: `shop-${kind}-${entry.id}` }, attrs: { type: "button", "aria-pressed": String(entry.id === selected) } });
      const pick = () => { if (entry.id !== selected) onPick(entry.id); };
      button.addEventListener("focus", pick, { signal });
      button.addEventListener("click", pick, { signal });
      group.append(button);
    }
    return group;
  };
  if (preview.kind !== "unavailable") {
    scroll.append(choices("actor", preview.targets.map(target => ({ id: target.actorId, name: target.name })), preview.actorId, options.onActor));
    const target = preview.targets.find(target => target.actorId === preview.actorId);
    scroll.append(choices("slot", target?.slots.map(slot => ({ id: slot.id, name: slot.label })) ?? [], preview.slot, options.onSlot));
  }
  scroll.append(shopComparisonSummary(project, preview, true));
  const close = el("button", { class: "runtime-shop-cancel runtime-shop-detail-close", text: "비교 닫기", dataset: { testid: "shop-detail-close" }, attrs: { type: "button" } });
  close.style.flexShrink = "0";
  close.addEventListener("click", options.onClose, { signal });
  shell.append(scroll, close, keyHints([[SHOP_FOCUS_GROUP_KEY_LABEL, "영역 이동"], [SHOP_DETAIL_SCROLL_KEY_LABEL, "상세 스크롤"], [CANCEL_KEY_LABEL, "목록으로"]]));
  return shell;
}
