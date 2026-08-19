import { el } from "@/util/dom";
import { proposalAcceptButtonLabel } from "./aiProposalFusion";

const COMMAND_PREFIX = "@>" as const;
const REJECT_LABEL = "취소" as const;

export type ProposalPinModel = {
  readonly summary: string;
  readonly selectedCount: number;
  readonly total: number;
};

export type ProposalPinActions = {
  readonly onAccept: () => void;
  readonly onReject: () => void;
};

export function createProposalPin(model: ProposalPinModel, actions: ProposalPinActions): HTMLElement {
  return el("div", {
    class: "ai-command-row ai-proposal-pin",
    dataset: { testid: "ai-proposal-pin" },
    children: [
      el("span", {
        class: "ai-command-prefix",
        text: COMMAND_PREFIX,
        attrs: { "aria-hidden": "true" },
      }),
      el("div", {
        class: "ai-command-row-body",
        children: [
          el("span", { class: "ai-proposal-pin-summary", text: model.summary }),
          el("div", {
            class: "ai-proposal-pin-actions",
            children: [
              el("button", {
                class: "ai-assistant-action ai-proposal-accept",
                text: proposalAcceptButtonLabel(model.selectedCount, model.total),
                attrs: { type: "button" },
                dataset: { testid: "ai-proposal-pin-accept" },
                on: { click: () => actions.onAccept() },
              }),
              el("button", {
                class: "ai-assistant-action ai-proposal-reject",
                text: REJECT_LABEL,
                attrs: { type: "button" },
                dataset: { testid: "ai-proposal-reject" },
                on: { click: () => actions.onReject() },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function replaceProposalPin(
  host: HTMLElement,
  model: ProposalPinModel,
  actions: ProposalPinActions,
): HTMLElement {
  clearProposalPin(host);
  const pin = createProposalPin(model, actions);
  host.append(pin);
  return pin;
}

export function clearProposalPin(host: HTMLElement): void {
  host.querySelector("[data-testid=ai-proposal-pin]")?.remove();
}

export function refreshProposalPinAccept(host: HTMLElement, selectedCount: number, total: number): void {
  const accept = host.querySelector("[data-testid=ai-proposal-pin-accept]");
  if (!(accept instanceof HTMLButtonElement)) return;
  accept.disabled = selectedCount === 0;
  accept.textContent = proposalAcceptButtonLabel(selectedCount, total);
}
