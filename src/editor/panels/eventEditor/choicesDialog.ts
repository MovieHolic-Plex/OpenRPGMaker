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

export function openChoicesDialog(
  initial: ChoicesCommand,
  onApply: (command: ChoicesCommand) => void
): void {
  openEventSubdialog({
    title: "Show Choices",
    testId: "event-command-choices-dialog",
    width: "wide",
    render: (body, close) => {
      const form = dialogForm("event-command-choices-form");
      const cancelName = nextGroupName("choices-cancel");
      const prompt = document.createElement("input");
      prompt.type = "text";
      prompt.value = initial.prompt ?? "";
      prompt.dataset.testid = "choices-prompt";
      const optionInputs = [0, 1, 2, 3].map((index) => {
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
          options: options.length ? options : [{ text: "Yes", branch: [] }, { text: "No", branch: [] }],
          cancelBehavior: radioValue<ChoiceCancelBehavior>(cancelRadios, "choice2"),
          cancelBranch: initial.cancelBranch ?? [],
        });
        close();
      });

      form.append(
        el("div", {
          class: "event-command-choices-grid",
          children: [
            fieldset("Choices", [
              labelledControl("Prompt", prompt),
              ...optionInputs.map((input, index) => labelledControl(`Choice ${index + 1}`, input)),
            ]),
            fieldset("When Cancel", [
              labelledControl("Disallow", cancelRadios[0]),
              labelledControl("Choice 1", cancelRadios[1]),
              labelledControl("Choice 2", cancelRadios[2]),
              labelledControl("Choice 3", cancelRadios[3]),
              labelledControl("Choice 4", cancelRadios[4]),
              labelledControl("Branch", cancelRadios[5]),
            ]),
          ],
        }),
        actionRow("choices-ok", close)
      );
      body.append(form);
    },
  });
}
