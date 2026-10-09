import { newCommand } from "@/editor/eventActions";
import { INN_NOT_ENOUGH_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { CommandEditContext } from "./types";
export { shopBody } from "./commandBodyShop";

type InnCommand = Extract<Command, { kind: "inn" }>;

export function innBody(context: CommandEditContext, command: InnCommand): HTMLElement {
  let draft: InnCommand = {
    kind: "inn",
    price: normalizeInnPrice(command.price),
    note: command.note,
    question: command.question,
    recoverMp: command.recoverMp,
    advanceToMorning: command.advanceToMorning,
    restDurationMs: command.restDurationMs,
    wakeDurationMs: command.wakeDurationMs,
    branchOnNotEnoughGold: command.branchOnNotEnoughGold,
    notEnoughBranch: command.notEnoughBranch,
  };

  const wrap = el("div", {
    class: "commerce-command-body commerce-command-body-inline inn-command-body cream-command-form",
    dataset: { testid: "inn-command-body" },
  });

  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.step = "1";
  price.value = String(draft.price);
  price.title = "여관 요금";
  price.dataset.testid = "inn-price-input";
  price.className = "commerce-command-input";

  const note = document.createElement("input");
  note.type = "text";
  note.value = draft.note ?? "";
  note.placeholder = "어서 오세요. 편히 쉬어가시겠어요?";
  note.title = "인사말";
  note.dataset.testid = "inn-note-input";
  note.className = "commerce-command-input";

  const question = document.createElement("input");
  question.type = "text";
  question.value = draft.question ?? "";
  question.placeholder = "요금 기반 기본 질문";
  question.title = "숙박 질문";
  question.dataset.testid = "inn-question-input";
  question.className = "commerce-command-input";

  const restDuration = document.createElement("input");
  restDuration.type = "number";
  restDuration.min = "0";
  restDuration.step = "50";
  restDuration.value = String(draft.restDurationMs ?? 500);
  restDuration.title = "암전 연출";
  restDuration.dataset.testid = "inn-rest-duration-input";
  restDuration.className = "commerce-command-input";

  const wakeDuration = document.createElement("input");
  wakeDuration.type = "number";
  wakeDuration.min = "0";
  wakeDuration.step = "50";
  wakeDuration.value = String(draft.wakeDurationMs ?? 750);
  wakeDuration.title = "기상 메시지";
  wakeDuration.dataset.testid = "inn-wake-duration-input";
  wakeDuration.className = "commerce-command-input";

  const priceHint = el("span", {
    class: "commerce-command-hint",
    dataset: { testid: "inn-price-hint" },
    text: innPriceHint(draft),
  });

  const previewNote = el("div", {
    class: "inn-command-dialog-note",
    dataset: { testid: "inn-dialog-note" },
    text: innNoteText(draft),
  });
  const previewQuestion = el("div", {
    class: "inn-command-dialog-question",
    dataset: { testid: "inn-dialog-question" },
    text: innQuestionText(draft),
  });

  const commit = (next: InnCommand) => {
    draft = {
      kind: "inn",
      price: normalizeInnPrice(next.price),
      note: cleanOptionalText(next.note),
      question: cleanOptionalText(next.question),
      recoverMp: next.recoverMp === false ? false : undefined,
      advanceToMorning: next.advanceToMorning === true ? true : undefined,
      restDurationMs: normalizeDuration(next.restDurationMs, 500),
      wakeDurationMs: normalizeDuration(next.wakeDurationMs, 750),
      branchOnNotEnoughGold: next.branchOnNotEnoughGold === true ? true : undefined,
      notEnoughBranch: next.branchOnNotEnoughGold ? next.notEnoughBranch ?? [] : next.notEnoughBranch,
    };
    price.value = typeof draft.price === "number" ? String(draft.price) : "";
    note.value = draft.note ?? "";
    question.value = draft.question ?? "";
    restDuration.value = String(draft.restDurationMs ?? 500);
    wakeDuration.value = String(draft.wakeDurationMs ?? 750);
    priceHint.textContent = innPriceHint(draft);
    previewNote.textContent = innNoteText(draft);
    previewQuestion.textContent = innQuestionText(draft);
    syncPresetActive();
    branchControls.classList.toggle("is-hidden", !draft.branchOnNotEnoughGold);
    context.actions.replaceCommand(context.path, draft);
  };

  const onPriceInput = () => commit({ ...draft, price: Number.parseInt(price.value, 10) || 0 });
  price.addEventListener("change", onPriceInput);
  price.addEventListener("input", onPriceInput);
  note.addEventListener("change", () => commit({ ...draft, note: note.value }));
  note.addEventListener("input", () => commit({ ...draft, note: note.value }));
  question.addEventListener("change", () => commit({ ...draft, question: question.value }));
  question.addEventListener("input", () => commit({ ...draft, question: question.value }));
  restDuration.addEventListener("change", () =>
    commit({ ...draft, restDurationMs: Number.parseInt(restDuration.value, 10) || 0 })
  );
  wakeDuration.addEventListener("change", () =>
    commit({ ...draft, wakeDurationMs: Number.parseInt(wakeDuration.value, 10) || 0 })
  );

  const presets = el("div", {
    class: "inn-command-presets",
    dataset: { testid: "inn-price-presets" },
  });
  const presetButtons: HTMLButtonElement[] = [];
  for (const preset of INN_PRICE_PRESETS) {
    const button = el("button", {
      class: "btn small inn-command-preset",
      text: preset.label,
      attrs: { type: "button", title: preset.title },
      dataset: { testid: `inn-price-preset-${preset.price}`, innPrice: String(preset.price) },
      on: {
        click: () => commit({ ...draft, price: preset.price }),
      },
    }) as HTMLButtonElement;
    presetButtons.push(button);
    presets.append(button);
  }
  const syncPresetActive = () => {
    for (const button of presetButtons) {
      button.classList.toggle("active", Number(button.dataset.innPrice) === draft.price);
    }
  };
  syncPresetActive();

  const recoverMp = document.createElement("input");
  recoverMp.type = "checkbox";
  recoverMp.checked = draft.recoverMp !== false;
  recoverMp.dataset.testid = "inn-recover-mp";
  recoverMp.addEventListener("change", () => commit({ ...draft, recoverMp: recoverMp.checked ? undefined : false }));

  const advanceMorning = document.createElement("input");
  advanceMorning.type = "checkbox";
  advanceMorning.checked = draft.advanceToMorning === true;
  advanceMorning.dataset.testid = "inn-advance-morning";
  advanceMorning.addEventListener("change", () =>
    commit({ ...draft, advanceToMorning: advanceMorning.checked ? true : undefined })
  );

  const branchNotEnough = document.createElement("input");
  branchNotEnough.type = "checkbox";
  branchNotEnough.checked = draft.branchOnNotEnoughGold === true;
  branchNotEnough.dataset.testid = "inn-branch-not-enough";
  branchNotEnough.addEventListener("change", () =>
    commit({
      ...draft,
      branchOnNotEnoughGold: branchNotEnough.checked ? true : undefined,
      notEnoughBranch: branchNotEnough.checked ? draft.notEnoughBranch ?? [] : draft.notEnoughBranch,
    })
  );

  const dialogMock = el("div", {
    class: "inn-command-dialog-mock",
    dataset: { testid: "inn-dialog-mock" },
    children: [
      el("div", { class: "inn-command-dialog-title", text: "여관" }),
      previewNote,
      previewQuestion,
      el("div", {
        class: "inn-command-dialog-actions",
        children: [
          el("span", { class: "inn-command-dialog-choice selected", text: "숙박" }),
          el("span", { class: "inn-command-dialog-choice", text: "거절" }),
        ],
      }),
    ],
  });

  const branchControls = innNotEnoughBranchControls(context, draft);

  wrap.append(
    el("div", {
      class: "inn-command-card",
      children: [
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "여관 요금" }),
            price,
            priceHint,
          ],
        }),
        presets,
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "인사말" }),
            note,
          ],
        }),
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "질문" }),
            question,
          ],
        }),
        el("div", {
          class: "inn-command-options",
          dataset: { testid: "inn-options" },
          children: [
            el("label", {
              class: "commerce-command-option",
              children: [recoverMp, el("span", { text: "MP도 회복" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [advanceMorning, el("span", { text: "아침으로 시간 이동" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [branchNotEnough, el("span", { text: "골드 부족 시 분기" })],
            }),
          ],
        }),
        el("div", {
          class: "inn-command-timing",
          dataset: { testid: "inn-timing" },
          children: [
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "암전" }),
                restDuration,
              ],
            }),
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "기상" }),
                wakeDuration,
              ],
            }),
          ],
        }),
        el("p", {
          class: "commerce-command-hint",
          text: "숙박 시 골드 차감 후 파티를 회복합니다. 부족 분기는 메인 목록에 펼쳐집니다.",
        }),
      ],
    }),
    dialogMock,
    branchControls
  );
  return wrap;
}

const INN_PRICE_PRESETS = [
  { price: 0, label: "무료", title: "0G · 무료 숙박" },
  { price: 10, label: "10G", title: "저렴한 여관" },
  { price: 20, label: "20G", title: "기본 요금" },
  { price: 50, label: "50G", title: "고급 여관" },
  { price: 100, label: "100G", title: "최고급 숙소" },
] as const;

function innNotEnoughBranchControls(context: CommandEditContext, command: InnCommand): HTMLElement {
  const branchSel = commandKindSelect("text");
  const add = el("button", {
    class: "btn shop-processing-branch-add",
    text: "추가",
    dataset: { testid: "inn-add-not-enough-branch-command" },
    attrs: { type: "button" },
    on: {
      click: () => {
        const next = newCommand(selectedOptionValue(branchSel, COMMAND_KIND_OPTIONS, "text"));
        context.actions.addCommand([...context.path, INN_NOT_ENOUGH_BRANCH_INDEX], next);
      },
    },
  });
  const hiddenClass = command.branchOnNotEnoughGold ? "" : " is-hidden";
  return el("div", {
    class: `shop-processing-branch-controls inn-not-enough-branch-controls${hiddenClass}`,
    dataset: { testid: "inn-not-enough-branch-controls" },
    children: [
      el("div", {
        class: "shop-processing-branch-head",
        children: [
          el("span", { class: "shop-processing-branch-title", text: "골드 부족 분기" }),
          el("span", {
            class: "commerce-command-hint",
            text: "돈이 부족할 때 실행",
          }),
        ],
      }),
      el("div", {
        class: "shop-processing-branch-row",
        children: [branchSel, add],
      }),
    ],
  });
}

function normalizeInnPrice(price: InnCommand["price"]): InnCommand["price"] {
  if (typeof price === "number") return Math.max(0, Math.min(999999, Math.trunc(price)) || 0);
  if (price && typeof price === "object" && (price as { kind?: string }).kind === "var") return price;
  return 0;
}

function innPriceHint(command: Pick<InnCommand, "price" | "recoverMp">): string {
  const recover = command.recoverMp === false ? "HP만 회복" : "파티 전원 회복";
  const priceLabel = typeof command.price === "number" ? command.price.toLocaleString("ko-KR") : `변수 ${(command.price as { id: string }).id}`;
  if (typeof command.price === "number" && command.price <= 0) return `0G면 무료 숙박 · ${recover}`;
  if (typeof command.price !== "number") return `숙박 시 ${priceLabel} G 차감 · ${recover} · 변수 요금`;
  return `숙박 시 ${priceLabel}G 차감 · ${recover}`;
}

function innNoteText(command: Pick<InnCommand, "note">): string {
  return command.note?.trim() || "어서 오세요. 편히 쉬어가시겠어요?";
}

function innQuestionText(command: Pick<InnCommand, "price" | "question">): string {
  if (command.question?.trim()) return command.question.trim();
  if (typeof command.price !== "number") return `하룻밤 묵는 데 변수 ${(command.price as { id: string }).id} G 입니다. 묵으시겠습니까?`;
  if (command.price <= 0) return "하룻밤 묵으시겠습니까? (무료)";
  return `하룻밤 묵는 데 ${command.price.toLocaleString("ko-KR")} G 입니다. 묵으시겠습니까?`;
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDuration(value: number | undefined, fallback: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const next = Math.max(0, Math.min(10_000, Math.trunc(value)));
  return next === fallback ? undefined : next;
}

