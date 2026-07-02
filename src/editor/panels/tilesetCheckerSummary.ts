import { summarizeTilesetGenerationReadiness } from "@/project/tilesetSemanticChecker";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function renderTilesetCheckerSummary(tileset: TilesetDef): HTMLElement {
  const summary = summarizeTilesetGenerationReadiness(tileset);
  return el("fieldset", {
    class: "rm2k3-db-fieldset rm2k3-tileset-checker",
    dataset: { testid: "tileset-generation-checker" },
    children: [
      el("legend", { text: "Checker" }),
      el("div", {
        class: `tileset-checker-status ${summary.ready ? "ready" : "missing"}`,
        text: summary.ready ? "Ready for city/house/road/water/decor" : "Missing semantic roles",
      }),
      el("div", {
        class: "tileset-checker-list",
        children: summary.checks.map((check) =>
          el("div", {
            class: `tileset-checker-row ${check.ready ? "ready" : "missing"}`,
            dataset: { testid: `tileset-generation-check-${check.id}` },
            children: [
              el("strong", { text: check.label }),
              el("span", {
                text: check.ready
                  ? `OK: ${check.coveredRoles.join(", ")}`
                  : `Needs: ${check.missingRoleSlots.join(", ")}`,
              }),
            ],
          })
        ),
      }),
      ...(summary.invalidGroups.length > 0
        ? [el("div", { class: "tileset-checker-note", text: `${summary.invalidGroups.length} invalid group(s) ignored` })]
        : []),
    ],
  });
}
