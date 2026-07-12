import { store } from "@/project/store";
import type { Command, MapId, MapTreeNode, Project, TransferDirection, TransferFade } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { openEventSubdialog } from "./subdialog";
import { drawTransferFallback, drawTransferMapPreview } from "./transferMapPreview";

type TransferCommand = Extract<Command, { kind: "transfer" }> & { direction?: TransferDirection; fade?: TransferFade };

type TransferDraft = {
  mapId: MapId;
  x: number;
  y: number;
  direction: TransferDirection;
  fade: TransferFade;
  zoom: number;
};

type TransferPickerRequest = {
  readonly command: TransferCommand;
  readonly onApply: (command: TransferCommand) => void;
};

const DIRECTION_OPTIONS: readonly { value: TransferDirection; label: string }[] = [
  { value: "retain", label: "유지" },
  { value: "up", label: "위" },
  { value: "right", label: "오른쪽" },
  { value: "down", label: "아래" },
  { value: "left", label: "왼쪽" },
];

const FADE_OPTIONS: readonly { value: TransferFade; label: string }[] = [
  { value: "black", label: "검정" },
  { value: "white", label: "흰색" },
  { value: "none", label: "없음" },
];

export function transferDirectionLabel(value: TransferDirection | undefined): string {
  return DIRECTION_OPTIONS.find((option) => option.value === (value ?? "retain"))?.label ?? "유지";
}

export function transferFadeLabel(value: TransferFade | undefined): string {
  return FADE_OPTIONS.find((option) => option.value === (value ?? "black"))?.label ?? "검정";
}

export function openTransferPlayerDialog(request: TransferPickerRequest): void {
  openEventSubdialog({
    title: "장소 이동",
    testId: "event-transfer-player-dialog",
    width: "wide",
    render: (body, close) => renderTransferPicker(body, request, close),
  });
}

function renderTransferPicker(body: HTMLElement, request: TransferPickerRequest, close: () => void): void {
  const project = store.getCurrent();
  const firstMapId = Object.keys(project.maps)[0] ?? "";
  const initialMapId = project.maps[request.command.mapId] ? request.command.mapId : firstMapId;
  const draft: TransferDraft = {
    mapId: initialMapId,
    x: request.command.x,
    y: request.command.y,
    direction: request.command.direction ?? "retain",
    fade: request.command.fade ?? "black",
    zoom: 1,
  };

  const tree = el("div", { class: "transfer-player-tree", dataset: { testid: "transfer-player-map-tree" } });
  const preview = el("div", { class: "transfer-player-preview" });
  const canvas = el("canvas", { dataset: { testid: "transfer-player-map-preview" } }) as HTMLCanvasElement;
  const status = el("div", { class: "transfer-player-status", dataset: { testid: "transfer-player-target" } });
  const zoomControls = el("div", { class: "transfer-player-zoom" });
  const directionGroup = directionControls(draft, () => rerenderFooter());
  const fadeGroup = fadeControls(draft, () => rerenderFooter());
  let previewRenderVersion = 0;

  const previewFitDisplay = () => {
    // Leave a small inset so the scaled canvas does not clip against the frame border.
    const inset = 4;
    return {
      maxWidth: Math.max(1, preview.clientWidth - inset),
      maxHeight: Math.max(1, preview.clientHeight - inset),
    };
  };

  const rerenderAll = () => {
    previewRenderVersion += 1;
    const renderVersion = previewRenderVersion;
    renderTree(tree, project, draft, rerenderAll);
    const fitDisplay = previewFitDisplay();
    drawTransferMapPreview({
      canvas,
      project,
      mapId: draft.mapId,
      selection: draft,
      fitDisplay,
      isCurrent: () => renderVersion === previewRenderVersion,
    }).catch(() => {
      if (renderVersion === previewRenderVersion) {
        drawTransferFallback({
          canvas,
          map: project.maps[draft.mapId],
          selection: draft,
          fitDisplay,
        });
      }
    });
    rerenderFooter();
  };
  const rerenderFooter = () => {
    status.textContent = targetLabel(project, draft);
    for (const button of zoomControls.querySelectorAll("button")) {
      button.classList.toggle("active", button.textContent === zoomLabel(draft.zoom));
    }
  };

  canvas.addEventListener("click", (event) => {
    const map = project.maps[draft.mapId];
    if (!map) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    draft.x = clamp(Math.floor((event.clientX - rect.left) * scaleX / map.tileSize), 0, map.width - 1);
    draft.y = clamp(Math.floor((event.clientY - rect.top) * scaleY / map.tileSize), 0, map.height - 1);
    rerenderAll();
  });

  for (const zoom of [1, 0.5, 0.25]) {
    zoomControls.append(el("button", {
      class: "transfer-player-zoom-button" + (zoom === draft.zoom ? " active" : ""),
      text: zoomLabel(zoom),
      attrs: { type: "button" },
      on: { click: () => {
        draft.zoom = zoom;
        rerenderAll();
      } },
    }));
  }

  preview.append(canvas);
  body.append(
    el("div", { class: "transfer-player-dialog", children: [
      tree,
      preview,
      el("div", { class: "transfer-player-controls", children: [
        el("fieldset", { class: "transfer-player-direction", children: [
          el("legend", { text: "방향" }),
          directionGroup,
        ] }),
        el("fieldset", { class: "transfer-player-direction", children: [
          el("legend", { text: "페이드" }),
          fadeGroup,
        ] }),
      ] }),
      el("div", { class: "transfer-player-footer", children: [
        status,
        zoomControls,
        el("button", {
          class: "transfer-player-button",
          text: "확인",
          dataset: { testid: "transfer-player-ok" },
          attrs: { type: "button" },
          on: { click: () => {
            request.onApply({ kind: "transfer", mapId: draft.mapId, x: draft.x, y: draft.y, direction: draft.direction, fade: draft.fade });
            close();
          } },
        }),
        el("button", {
          class: "transfer-player-button",
          text: "취소",
          dataset: { testid: "transfer-player-cancel" },
          attrs: { type: "button" },
          on: { click: close },
        }),
      ] }),
    ] })
  );
  // Layout must settle so preview.clientWidth/Height are non-zero before fit-to-box scale.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => rerenderAll());
  });
}

function fadeControls(draft: TransferDraft, onChange: () => void): HTMLElement {
  const group = el("div", { class: "transfer-player-direction-options" });
  const name = `transfer-fade-${Date.now()}`;
  for (const option of FADE_OPTIONS) {
    const input = el("input", {
      attrs: { type: "radio", name, value: option.value },
      dataset: { testid: `transfer-player-fade-${option.value}` },
    }) as HTMLInputElement;
    input.checked = draft.fade === option.value;
    input.addEventListener("change", () => {
      if (input.checked) draft.fade = option.value;
      onChange();
    });
    group.append(el("label", { children: [input, el("span", { text: option.label })] }));
  }
  return group;
}

function directionControls(draft: TransferDraft, onChange: () => void): HTMLElement {
  const group = el("div", { class: "transfer-player-direction-options" });
  const name = `transfer-direction-${Date.now()}`;
  for (const option of DIRECTION_OPTIONS) {
    const input = el("input", {
      attrs: { type: "radio", name, value: option.value },
      dataset: { testid: `transfer-player-direction-${option.value}` },
    }) as HTMLInputElement;
    input.checked = draft.direction === option.value;
    input.addEventListener("change", () => {
      if (input.checked) draft.direction = option.value;
      onChange();
    });
    group.append(el("label", { children: [input, el("span", { text: option.label })] }));
  }
  return group;
}

function renderTree(host: HTMLElement, project: Project, draft: TransferDraft, rerender: () => void): void {
  clearChildren(host);
  host.append(el("div", { class: "transfer-player-project", text: project.meta.title || "Untitled" }));
  const root = el("div", { class: "transfer-player-map-list" });
  appendTreeNode(root, project, project.mapTree, draft, rerender);
  host.append(root);
}

function appendTreeNode(host: HTMLElement, project: Project, node: MapTreeNode, draft: TransferDraft, rerender: () => void): void {
  const map = project.maps[node.mapId];
  if (map) {
    host.append(el("button", {
      class: "transfer-player-map-row" + (node.mapId === draft.mapId ? " selected" : ""),
      text: map.name || node.mapId,
      attrs: { type: "button" },
      dataset: { testid: `transfer-player-map-${node.mapId}` },
      on: { click: () => {
        draft.mapId = node.mapId;
        draft.x = clamp(draft.x, 0, map.width - 1);
        draft.y = clamp(draft.y, 0, map.height - 1);
        rerender();
      } },
    }));
  }
  for (const child of node.children) appendTreeNode(host, project, child, draft, rerender);
}

function targetLabel(project: Project, draft: TransferDraft): string {
  const ids = Object.keys(project.maps);
  const index = Math.max(0, ids.indexOf(draft.mapId)) + 1;
  const map = project.maps[draft.mapId];
  return `${String(index).padStart(4, "0")}:${map?.name ?? draft.mapId} (${pad3(draft.x)}.${pad3(draft.y)})`;
}

function pad3(value: number): string {
  return String(value).padStart(3, "0");
}

function zoomLabel(zoom: number): string {
  return zoom === 1 ? "1/1" : zoom === 0.5 ? "1/2" : "1/4";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
