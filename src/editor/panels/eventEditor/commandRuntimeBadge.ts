import type { CommandRuntimeSupportDescriptor } from "@/project/eventCommands/runtimeSupport";
import { el } from "@/util/dom";

export function renderRuntimeSupportBadge(badge: CommandRuntimeSupportDescriptor, testId: string): HTMLElement | null {
  if (badge.support === "runtime-full") return null;
  return el("span", {
    class: `command-runtime-badge ${badge.support}`,
    text: badge.icon,
    attrs: {
      title: badge.tooltip,
      "aria-label": badge.label,
    },
    dataset: {
      testid: testId,
      runtimeSupport: badge.support,
      runtimeReason: badge.reasonCode,
      ...(badge.alternative ? {
        runtimeAlternative: badge.alternative.kind,
        runtimeAlternativeLoop: String(badge.alternative.loop),
      } : {}),
    },
  });
}
