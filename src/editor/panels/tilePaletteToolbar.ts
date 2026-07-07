import { editorState } from "@/editor/editorState";
import type { Tool } from "@/editor/editorState";
import { copySelection, pasteClipboard } from "@/editor/mapClipboard";
import { el } from "@/util/dom";

type PaletteIcon =
  | "pencil"
  | "bucket"
  | "dropper"
  | "hand"
  | "select"
  | "collision"
  | "event"
  | "eraser"
  | "copy"
  | "paste";

const TOOLS: { readonly id: Tool; readonly label: string; readonly hint: string; readonly icon: PaletteIcon }[] = [
  { id: "paint", label: "연필", hint: "선택한 타일을 칠합니다", icon: "pencil" },
  { id: "fill", label: "채우기", hint: "연결된 영역을 채웁니다", icon: "bucket" },
  { id: "eyedropper", label: "스포이트", hint: "현재 맵 레이어에서 타일을 집습니다", icon: "dropper" },
  { id: "pan", label: "이동", hint: "드래그로 맵 화면을 움직입니다. Space를 누른 동안에도 이동합니다", icon: "hand" },
  { id: "select", label: "선택", hint: "복사/붙여넣기할 맵 칸을 선택합니다", icon: "select" },
  { id: "collision", label: "통행", hint: "통행 가능 여부를 전환합니다", icon: "collision" },
  { id: "event", label: "이벤트", hint: "맵 이벤트를 배치하거나 선택합니다", icon: "event" },
  { id: "erase", label: "지우개", hint: "현재 레이어를 지웁니다", icon: "eraser" },
];

export function makeTilePaletteToolSection(currentMapId: () => string): HTMLElement {
  const state = editorState.get();
  const toolSection = el("div", { class: "panel-section" });
  toolSection.append(el("h3", { text: "도구" }));
  const toolGrid = el("div", { class: "tool-grid", dataset: { testid: "tool-grid" } });
  for (const t of TOOLS) {
    toolGrid.append(
      el("button", {
        class: "btn" + (state.tool === t.id ? " active" : ""),
        attrs: { title: t.hint, "aria-label": t.label, "aria-pressed": String(state.tool === t.id) },
        children: [
          el("span", { class: `rm-tool-icon rm-tool-icon-${t.icon}`, attrs: { "aria-hidden": "true" } }),
        ],
        dataset: { testid: `tool-${t.id}` },
        on: { click: () => editorState.set(t.id === "paint" ? { tool: t.id, paintShape: "pen" } : { tool: t.id }) },
      })
    );
  }
  toolSection.append(toolGrid);
  toolSection.append(makeEditCommandRow(currentMapId));
  return toolSection;
}

function makeEditCommandRow(currentMapId: () => string): HTMLElement {
  const row = el("div", { class: "tool-command-row" });
  const commands = [
    { id: "copy", label: "복사", title: "선택 영역 복사", icon: "copy", action: () => copySelection(currentMapId()) },
    {
      id: "paste",
      label: "붙여넣기",
      title: "선택 위치에 붙여넣기",
      icon: "paste",
      action: () => {
        const state = editorState.get();
        const target = state.selection ?? { x: 0, y: 0 };
        return pasteClipboard(currentMapId(), target.x, target.y);
      },
    },
  ];
  for (const command of commands) {
    row.append(
      el("button", {
        class: "btn icon-btn",
        attrs: { title: command.title, "aria-label": command.label },
        children: [
          el("span", { class: `rm-tool-icon rm-tool-icon-${command.icon}`, attrs: { "aria-hidden": "true" } }),
        ],
        dataset: { testid: `${command.id}-button` },
        on: { click: () => void command.action() },
      })
    );
  }
  return row;
}
