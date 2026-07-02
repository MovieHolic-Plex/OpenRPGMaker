import type {
  Command,
  MessageWindowFormat,
  MessageWindowPosition,
} from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { renderFacesetPreview } from "./facesetPreview";
import {
  actionRow,
  checkboxControl,
  clampFaceIndex,
  dialogForm,
  FACESET_FACE_COUNT,
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
    title: "문장 표시 설정",
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
        fieldset("윈도우 표시 형식", [
          labelledControl("일반", normal),
          labelledControl("투명", transparent),
        ]),
        fieldset("윈도우 위치", [
          labelledControl("상단", top),
          labelledControl("중앙", center),
          labelledControl("하단", bottom),
        ]),
        fieldset("옵션", [
          labelledControl("플레이어를 가리지 않음", prevent),
          labelledControl("대기 중 다른 이벤트 이동 허용", allowMovement),
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
    title: "얼굴 그래픽 변경",
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
      faceIndex.max = String(FACESET_FACE_COUNT);
      faceIndex.value = String(initial.faceIndex + 1);
      faceIndex.dataset.testid = "faceset-index";
      const left = radioControl(positionName, "left", initial.position === "left", "faceset-position-left");
      const right = radioControl(positionName, "right", initial.position === "right", "faceset-position-right");
      const flip = checkboxControl(initial.flipHorizontally, "faceset-flip-horizontal");
      const preview = el("div", {
        class: "event-command-faceset-preview",
        dataset: { testid: "faceset-preview" },
      });
      const selectedPosition = (): "left" | "right" => radioValue<"left" | "right">([left, right], "left");
      const refreshPreview = () => {
        clearChildren(preview);
        preview.append(
          renderFacesetPreview({
            resourceId: resource.value.trim(),
            faceIndex: clampFaceIndex(faceIndex.value),
            position: selectedPosition(),
            flipHorizontally: flip.checked,
          })
        );
      };

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onApply({
          kind: "changeFace",
          resourceId: resource.value.trim(),
          faceIndex: clampFaceIndex(faceIndex.value),
          position: selectedPosition(),
          flipHorizontally: flip.checked,
        });
        close();
      });
      resource.addEventListener("input", refreshPreview);
      faceIndex.addEventListener("input", refreshPreview);
      left.addEventListener("change", refreshPreview);
      right.addEventListener("change", refreshPreview);
      flip.addEventListener("change", refreshPreview);
      refreshPreview();

      form.append(
        el("div", {
          class: "event-command-faceset-grid",
          children: [
            fieldset("얼굴 그래픽", [
              preview,
              labelledControl("리소스", resource),
              labelledControl("얼굴", faceIndex),
              el("button", {
                class: "event-command-text-action",
                text: "설정",
                attrs: { type: "button" },
                dataset: { testid: "faceset-set" },
                on: { click: () => resource.focus() },
              }),
              el("button", {
                class: "event-command-text-action",
                text: "해제",
                attrs: { type: "button" },
                dataset: { testid: "faceset-remove" },
                on: { click: () => { resource.value = ""; refreshPreview(); } },
              }),
            ]),
            el("div", {
              class: "event-command-faceset-side",
              children: [
                fieldset("표시 위치", [
                  labelledControl("왼쪽", left),
                  labelledControl("오른쪽", right),
                ]),
                fieldset("옵션", [labelledControl("좌우 반전", flip)]),
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
