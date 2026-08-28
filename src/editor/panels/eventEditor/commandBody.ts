import { newCommand } from "@/editor/eventActions";
import { el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderAdvancedCommandBody } from "./commandBodyAdvanced";
import { renderCoreCommandBody } from "./commandBodyCore";
import { renderM2CommandBody } from "./commandBodyM2";
import { renderSchemaCommandBody } from "./schemaCommandBody";
import { COMMAND_KIND_OPTIONS, commandKindLabel } from "./options";
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
      class: "cream-command-form-head",
      text: commandKindLabel(cmd.kind),
      dataset: { testid: "event-command-edit-summary" },
    })
  );

  const body =
    // 스키마 등재 명령이 먼저다. 미등재 명령은 그대로 기존 체인으로 떨어진다.
    renderSchemaCommandBody(context, cmd) ??
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
    case "checkpointSave":
      return terminalHint("checkpoint-save-editor", "현재 런타임 세션을 세션 한정 체크포인트로 저장합니다.");
    case "killPlayer":
      return terminalHint("kill-player-editor", "파티를 전멸시키고 게임 오버 화면을 엽니다.");
    case "triggerEnding":
      return terminalHint("trigger-ending-editor", "지정 엔딩 또는 조건을 만족하는 최우선 엔딩을 실행합니다.");
    case "addFollower":
      return terminalHint("add-follower-editor", "동료를 세션에 추가합니다. actorId 또는 graphic을 사용합니다.");
    case "removeFollower":
      return terminalHint("remove-follower-editor", "동료를 이름으로 제거하거나 all=true로 모두 제거합니다.");
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
