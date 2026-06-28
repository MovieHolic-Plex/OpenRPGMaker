import type {
  Command,
  MessageWindowFormat,
  MessageWindowPosition,
} from "@/project/types";
import { el } from "@/util/dom";
import {
  actionRow,
  checkboxControl,
  clampFaceIndex,
  dialogForm,
  fieldset,
  labelledControl,
  nextGroupName,
  radioControl,
  radioValue,
} from "./messageDialogControls";
import { openEventSubdialog } from "./subdialog";
export { openChoicesDialog } from "./choicesDialog";

type DisplayTextSettingsCommand = Extract<Command, { kind: "displayTextSettings" }>;
type ChangeFaceCommand = Extract<Command, { kind: "changeFace" }>;

const DEFAULT_FACE_RESOURCE_ID = "easyrpg-faceset-actor1";

export function openDisplayOptionsDialog(
  initial: DisplayTextSettingsCommand,
  onApply: (command: DisplayTextSettingsCommand) => void
): void {
  openEventSubdialog({
    title: "Display Text Options",
    testId: "event-command-display-options-dialog",
    width: "wide",
    render: (body, close) => {
      const form = dialogForm("event-command-display-options-form");
      const formatName = nextGroupName("message-format");
      const positionName = nextGroupName("message-position");
      const normal = radioControl(formatName, "normal", initial.format === "normal", "display-options-format-normal");
      const transparent = radioControl(
        formatName,
        "transparent",
        initial.format === "transparent",
        "display-options-format-transparent"
      );
      const top = radioControl(positionName, "top", initial.position === "top", "display-options-position-top");
      const center = radioControl(
        positionName,
        "center",
        initial.position === "center",
        "display-options-position-middle"
      );
      const bottom = radioControl(
        positionName,
        "bottom",
        initial.position === "bottom",
        "display-options-position-bottom"
      );
      const prevent = checkboxControl(
        initial.preventObscuringPlayer,
        "display-options-prevent-obscuring"
      );
      const allowMovement = checkboxControl(
        initial.allowEventMovementDuringWait,
        "display-options-allow-movement"
      );

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onApply({
          kind: "displayTextSettings",
          format: radioValue<MessageWindowFormat>([normal, transparent], "normal"),
          position: radioValue<MessageWindowPosition>([top, center, bottom], "bottom"),
          preventObscuringPlayer: prevent.checked,
          allowEventMovementDuringWait: allowMovement.checked,
        });
        close();
      });

      form.append(
        fieldset("Windowskin Opacity", [
          labelledControl("Normal", normal),
          labelledControl("Transparent", transparent),
        ]),
        fieldset("Window Position", [
          labelledControl("Top", top),
          labelledControl("Middle", center),
          labelledControl("Bottom", bottom),
        ]),
        fieldset("Options", [
          labelledControl("Prevent the window from obscuring the player", prevent),
          labelledControl("Allow other events to move", allowMovement),
        ]),
        actionRow("display-options-ok", close)
      );
      body.append(form);
    },
  });
}

export function openFacesetDialog(
  initial: ChangeFaceCommand,
  onApply: (command: ChangeFaceCommand) => void
): void {
  openEventSubdialog({
    title: "Change Faceset",
    testId: "event-command-faceset-dialog",
    width: "wide",
    render: (body, close) => {
      const form = dialogForm("event-command-faceset-form");
      const positionName = nextGroupName("faceset-position");
      const resource = document.createElement("input");
      resource.type = "text";
      resource.placeholder = DEFAULT_FACE_RESOURCE_ID;
      resource.value = initial.resourceId;
      resource.dataset.testid = "faceset-resource-id";
      const faceIndex = document.createElement("input");
      faceIndex.type = "number";
      faceIndex.min = "1";
      faceIndex.max = "16";
      faceIndex.value = String(initial.faceIndex + 1);
      faceIndex.dataset.testid = "faceset-index";
      const left = radioControl(positionName, "left", initial.position === "left", "faceset-position-left");
      const right = radioControl(positionName, "right", initial.position === "right", "faceset-position-right");
      const flip = checkboxControl(initial.flipHorizontally, "faceset-flip-horizontal");
      const preview = el("div", {
        class: "event-command-faceset-preview",
        dataset: { testid: "faceset-preview" },
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onApply({
          kind: "changeFace",
          resourceId: resource.value.trim(),
          faceIndex: clampFaceIndex(faceIndex.value),
          position: radioValue<"left" | "right">([left, right], "left"),
          flipHorizontally: flip.checked,
        });
        close();
      });

      form.append(
        el("div", {
          class: "event-command-faceset-grid",
          children: [
            fieldset("Faceset", [
              preview,
              labelledControl("Resource", resource),
              labelledControl("Face", faceIndex),
              el("button", {
                class: "event-command-text-action",
                text: "Set",
                attrs: { type: "button" },
                dataset: { testid: "faceset-set" },
                on: { click: () => resource.focus() },
              }),
              el("button", {
                class: "event-command-text-action",
                text: "Remove",
                attrs: { type: "button" },
                dataset: { testid: "faceset-remove" },
                on: { click: () => { resource.value = ""; } },
              }),
            ]),
            el("div", {
              class: "event-command-faceset-side",
              children: [
                fieldset("Display Position", [
                  labelledControl("Left", left),
                  labelledControl("Right", right),
                ]),
                fieldset("Options", [labelledControl("Flip Horizontally", flip)]),
              ],
            }),
          ],
        }),
        actionRow("faceset-ok", close)
      );
      body.append(form);
    },
  });
}
