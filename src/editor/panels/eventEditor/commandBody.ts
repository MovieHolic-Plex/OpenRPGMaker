import { newCommand } from "@/editor/eventActions";
import { el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderAdvancedCommandBody } from "./commandBodyAdvanced";
import { renderCoreCommandBody } from "./commandBodyCore";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

export function renderCommandBody(context: CommandEditContext, cmd: Command): HTMLElement {
  const wrap = el("div", {});
  const kindSel = commandKindSelect(cmd.kind);
  kindSel.addEventListener("change", () => {
    context.actions.replaceCommand(
      context.path,
      newCommand(selectedOptionValue(kindSel, COMMAND_KIND_OPTIONS, cmd.kind))
    );
  });
  wrap.append(kindSel);

  const body = renderCoreCommandBody(context, cmd) ?? renderAdvancedCommandBody(context, cmd);
  if (body) wrap.append(body);
  return wrap;
}
