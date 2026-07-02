import type { ChoiceCancelBehavior, Command } from "@/project/types";
import { el } from "@/util/dom";
import {
  actionRow,
  dialogForm,
  fieldset,
  labelledControl,
  nextGroupName,
  radioControl,
  radioValue,
} from "./messageDialogControls";
import { openEventSubdialog } from "./subdialog";

type ChoicesCommand = Extract<Command, { kind: "choices" }>;
const MAX_CHOICE_OPTIONS = 5;
const CHOICE_OPTION_INDEXES = [0, 1, 2, 3, 4] as const;

export function openChoicesDialog(
  initial: ChoicesCommand,
  onApply: (command: ChoicesCommand) => void
): void {
  openEventSubdialog({
    title: "선택지 표시",
    testId: "event-command-choices-dialog",
    width: "wide",
    render: (body, close) => {
      const form = dialogForm("event-command-choices-form");
      const cancelName = nextGroupName("choices-cancel");
      const prompt = document.createElement("input");
      prompt.type = "text";
      prompt.value = initial.prompt ?? "";
      prompt.dataset.testid = "choices-prompt";
      const optionInputs = CHOICE_OPTION_INDEXES.map((index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = initial.options[index]?.text ?? "";
        input.dataset.testid = `choices-option-${index + 1}`;
        return input;
      });
      const cancelRadios = [
        radioControl(cancelName, "disallow", initial.cancelBehavior === "disallow", "choices-cancel-disallow"),
        radioControl(cancelName, "choice1", initial.cancelBehavior === "choice1", "choices-cancel-choice-1"),
        radioControl(cancelName, "choice2", (initial.cancelBehavior ?? "choice2") === "choice2", "choices-cancel-choice-2"),
        radioControl(cancelName, "choice3", initial.cancelBehavior === "choice3", "choices-cancel-choice-3"),
        radioControl(cancelName, "choice4", initial.cancelBehavior === "choice4", "choices-cancel-choice-4"),
        radioControl(cancelName, "choice5", initial.cancelBehavior === "choice5", "choices-cancel-choice-5"),
        radioControl(cancelName, "branch", initial.cancelBehavior === "branch", "choices-cancel-branch"),
      ];

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const options = optionInputs
          .map((input, index) => ({
            text: input.value.trim(),
            branch: initial.options[index]?.branch ?? [],
          }))
          .filter((option) => option.text.length > 0);
        onApply({
          kind: "choices",
          prompt: prompt.value.trim() || undefined,
          options: options.length ? options : [{ text: "예", branch: [] }, { text: "아니오", branch: [] }],
          cancelBehavior: radioValue<ChoiceCancelBehavior>(cancelRadios, "choice2"),
          cancelBranch: initial.cancelBranch ?? [],
        });
        close();
      });

      form.append(
        el("div", {
          class: "event-command-choices-grid",
          children: [
            fieldset("선택지", [
              labelledControl("질문", prompt),
              ...optionInputs.map((input, index) => labelledControl(`선택지 ${index + 1}`, input)),
            ]),
            fieldset("취소할 때", [
              labelledControl("취소 금지", cancelRadios[0]),
              labelledControl("선택지 1", cancelRadios[1]),
              labelledControl("선택지 2", cancelRadios[2]),
              labelledControl("선택지 3", cancelRadios[3]),
              labelledControl("선택지 4", cancelRadios[4]),
              labelledControl("선택지 5", cancelRadios[5]),
              labelledControl("취소 분기", cancelRadios[MAX_CHOICE_OPTIONS + 1]),
            ]),
          ],
        }),
        actionRow("choices-ok", close)
      );
      body.append(form);
    },
  });
}
