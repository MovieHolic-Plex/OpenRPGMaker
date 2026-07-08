import { newCommand } from "@/editor/eventActions";
import { el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderAdvancedCommandBody } from "./commandBodyAdvanced";
import { renderCoreCommandBody } from "./commandBodyCore";
import { renderM2CommandBody } from "./commandBodyM2";
import { commandSummary } from "./commandSummary";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

export function renderCommandBody(context: CommandEditContext, cmd: Command): HTMLElement {
  const wrap = el("div", {});
  // 종류 잠금(기존 명령 편집)에서는 kind select 를 렌더하지 않는다 — 분기 유실 방지.
  if (!context.lockKind) {
    const kindSel = commandKindSelect(cmd.kind);
    kindSel.dataset.commandKindSelect = "true";
    kindSel.addEventListener("change", () => {
      context.actions.replaceCommand(
        context.path,
        newCommand(selectedOptionValue(kindSel, COMMAND_KIND_OPTIONS, cmd.kind))
      );
    });
    wrap.append(kindSel);
  }
  wrap.append(
    el("div", {
      class: "event-command-edit-summary",
      text: commandSummary(cmd),
      dataset: { testid: "event-command-edit-summary" },
    })
  );

  const body =
    renderCoreCommandBody(context, cmd) ??
    renderAdvancedCommandBody(context, cmd) ??
    renderM2CommandBody(context, cmd) ??
    terminalFallbackBody(cmd);
  if (body) wrap.append(body);
  return wrap;
}

function terminalFallbackBody(cmd: Command): HTMLElement | undefined {
  switch (cmd.kind) {
    case "stopAudio":
      return terminalHint("stop-audio-editor", "설정 없음. 현재 재생 중인 오디오를 정지합니다.");
    case "cutsceneControl":
      return terminalHint("cutscene-control-editor", "컷신 동안 플레이어 이동과 메뉴를 잠그거나 해제합니다.");
    case "gameOver":
      return terminalHint("game-over-editor", "설정 없음. 게임 오버 화면을 엽니다.");
    case "returnToTitle":
      return terminalHint("return-to-title-editor", "설정 없음. 타이틀 화면으로 돌아갑니다.");
    default:
      return undefined;
  }
}

function terminalHint(testId: string, text: string): HTMLElement {
  return el("span", {
    class: "terminal-command-editor empty-hint",
    text,
    dataset: { testid: testId },
  });
}
