import { runtimeSupportBadge, type CommandRuntimeSupport } from "@/editor/eventCommands/runtimeSupport";
import { el } from "@/util/dom";

export function renderRuntimeSupportBadge(support: CommandRuntimeSupport, testId: string): HTMLElement | null {
  const badge = runtimeSupportBadge(support);
  if (!badge) return null;
  return el("span", {
    class: `command-runtime-badge ${badge.support}`,
    text: badge.icon,
    attrs: {
      title: badge.tooltip,
      "aria-label": badge.label,
    },
    dataset: { testid: testId, runtimeSupport: badge.support },
  });
}
