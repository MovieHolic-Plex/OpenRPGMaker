import { el } from "@/util/dom";
import type { Command, ShopEconomyConfig, ShopHaggleConfig, ShopRestockPolicy } from "@/project/types";
import type { CommandEditContext } from "./types";

type ShopCommand = Extract<Command, { kind: "shop" }>;

export function shopEconomyCard(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const latest = (): ShopCommand => {
    const current = context.getCurrentCommand?.();
    return current?.kind === "shop" ? current : command;
  };
  const patchEconomy = (patch: ShopEconomyConfig): void => {
    const current = latest();
    context.actions.replaceCommand(context.path, {
      ...current,
      economy: { ...current.economy, ...patch },
    });
  };
  const economy = command.economy;
  const haggle = economy?.haggle;
  const body = el("div", {
    class: "shop-economy-card",
    dataset: { testid: "shop-economy-card" },
    children: [
      toggleRow("동가 가격", "shop-economy-dynamic", economy?.dynamicPricing === true, (on) => {
        patchEconomy({ dynamicPricing: on ? true : undefined });
      }),
      toggleRow("흥정 허용", "shop-economy-haggle", economy?.haggleEnabled === true, (on) => {
        patchEconomy({ haggleEnabled: on ? true : undefined });
      }),
      toggleRow("마감 세일", "shop-economy-closing", economy?.closingSaleEnabled === true, (on) => {
        patchEconomy({ closingSaleEnabled: on ? true : undefined });
      }),
      toggleRow("가게 주인", "shop-economy-shopkeeper", economy?.shopkeeperEnabled === true, (on) => {
        patchEconomy({ shopkeeperEnabled: on ? true : undefined });
      }),
      restockSelect(command.restockPolicy, (policy) => {
        context.actions.replaceCommand(context.path, { ...latest(), restockPolicy: policy });
      }),
      numberRow("인내", "shop-haggle-patience", haggle?.patience, 1, 5, (value) => {
        patchHaggle(latest(), context, { patience: value });
      }),
      numberRow("모욕선", "shop-haggle-insult", haggle?.insultRatio, 0.4, 0.9, (value) => {
        patchHaggle(latest(), context, { insultRatio: value });
      }),
      numberRow("최대할인", "shop-haggle-discount", haggle?.maxDiscount, 0, 0.4, (value) => {
        patchHaggle(latest(), context, { maxDiscount: value });
      }),
    ],
  });
  return body;
}

function patchHaggle(current: ShopCommand, context: CommandEditContext, patch: ShopHaggleConfig): void {
  context.actions.replaceCommand(context.path, {
    ...current,
    economy: { ...current.economy, haggleEnabled: true, haggle: { ...current.economy?.haggle, ...patch } },
  });
}

function toggleRow(
  label: string,
  testid: string,
  on: boolean,
  change: (next: boolean) => void,
): HTMLElement {
  const input = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid },
  }) as HTMLInputElement;
  input.checked = on;
  input.addEventListener("change", () => change(input.checked));
  return el("label", { class: "shop-advanced-row", children: [el("span", { class: "shop-advanced-label", text: label }), input] });
}

function numberRow(
  label: string,
  testid: string,
  value: number | undefined,
  min: number,
  max: number,
  change: (next: number | undefined) => void,
): HTMLElement {
  const input = el("input", {
    class: "commerce-command-input",
    attrs: { type: "number", min: String(min), max: String(max), step: "0.01" },
    dataset: { testid },
  }) as HTMLInputElement;
  input.value = value === undefined ? "" : String(value);
  input.addEventListener("change", () => {
    const parsed = Number(input.value);
    change(input.value.trim() !== "" && Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : undefined);
  });
  return el("label", { class: "shop-advanced-row", children: [el("span", { class: "shop-advanced-label", text: label }), input] });
}

function restockSelect(
  value: ShopRestockPolicy | undefined,
  change: (next: ShopRestockPolicy | undefined) => void,
): HTMLElement {
  const select = el("select", {
    class: "commerce-command-input",
    dataset: { testid: "shop-economy-restock" },
    children: [
      el("option", { text: "없음", attrs: { value: "" } }),
      el("option", { text: "매일", attrs: { value: "daily" } }),
      el("option", { text: "매주", attrs: { value: "weekly" } }),
      el("option", { text: "요청 시", attrs: { value: "onDemand" } }),
    ],
  }) as HTMLSelectElement;
  select.value = value ?? "";
  select.addEventListener("change", () => {
    change((select.value || undefined) as ShopRestockPolicy | undefined);
  });
  return el("label", { class: "shop-advanced-row", children: [el("span", { class: "shop-advanced-label", text: "재입고" }), select] });
}
