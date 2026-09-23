import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import type { CommandEditContext } from "./types";

export function gameOverCommandBody(context: CommandEditContext, cmd: Extract<Command, { kind: "gameOver" | "killPlayer" }>): HTMLElement {
  const system = store.getCurrent().system;
  const select = el("select", { dataset: { testid: "event-command-game-over-id" } });
  const defaultName = system.gameOvers?.find(row => row.id === system.defaultGameOverId)?.name ?? "공통 게임 오버";
  select.append(el("option", { attrs: { value: "" }, text: `프로젝트 기본값 · ${defaultName}` }));
  for (const row of system.gameOvers ?? []) select.append(el("option", { attrs: { value: row.id }, text: row.name }));
  if (cmd.gameOverId && !system.gameOvers?.some(row => row.id === cmd.gameOverId)) select.append(el("option", { attrs: { value: cmd.gameOverId }, text: `없는 게임 오버 · ${cmd.gameOverId}` }));
  select.value = cmd.gameOverId ?? "";
  // Keep both controls' edits if the host does not immediately rebuild this form.
  let current = cmd;
  select.addEventListener("change", () => {
    const { gameOverId: _old, ...rest } = current;
    current = { ...rest, ...(select.value ? { gameOverId: select.value } : {}) };
    context.actions.replaceCommand(context.path, current);
  });
  const children: HTMLElement[] = [el("label", { class: "inline-field", children: [el("span", { text: "실행할 게임 오버" }), select] })];
  if (cmd.kind === "killPlayer") {
    const input = el("input", { attrs: { type: "text" }, value: cmd.message ?? "", dataset: { testid: "event-command-kill-player-message" } });
    input.addEventListener("change", () => {
      if (current.kind !== "killPlayer") return;
      const { message: _old, ...rest } = current;
      current = { ...rest, ...(input.value.trim() ? { message: input.value.trim() } : {}) };
      context.actions.replaceCommand(context.path, current);
    });
    children.push(el("label", { class: "inline-field", children: [el("span", { text: "패배 메시지 덮어쓰기" }), input] }));
  }
  children.push(el("p", { class: "empty-hint", text: "데이터베이스 → 시스템 → 게임 오버에서 연출과 결과를 만듭니다. 조건 분기마다 다른 항목을 선택하면 멀티 게임 오버가 됩니다. 실행 후 현재 이벤트는 종료됩니다." }));
  return el("div", { class: "terminal-command-editor game-over-command-editor", dataset: { testid: cmd.kind === "gameOver" ? "game-over-editor" : "kill-player-editor" }, children });
}
