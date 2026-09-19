import type { BattleBattlerSnapshot } from "@/battle/runtime";
import { store } from "@/project/store";

// Small, code-native pixel silhouettes; accessible names remain Korean.
const TYPE_SILHOUETTES: Record<string, string> = {
  grass: "M2 20h4V10h2V4h2v15h2V8h2V2h2v16h2V6h2v16H2z",
  poison: "M9 2h6v2h3v6h-3v3H9v-3H6V4h3zM9 15h6v3h4v2h3v3H2v-3h3v-2h4z",
  bug: "M7 2h2v3h6V2h2v4h2v3h2v12h-3v-9h-2v10H8V12H6v9H3V9h2V6h2zM10 7v3h4V7z",
};

/** Only authored types: the skin must not invent gender, status, or a second type. */
export function battleTypeBadges(battler: BattleBattlerSnapshot): HTMLElement | null {
  const project = store.getCurrent();
  if (project.system.battleUiStyle !== "pokemon") return null;
  const speciesId = battler.speciesId
    ?? project.database.enemies.find((enemy) => enemy.id === battler.recordId)?.speciesId;
  const types = project.database.monsterSpecies?.find((species) => species.id === speciesId)?.types;
  if (!types?.length) return null;
  const badges = document.createElement("span");
  badges.className = "battle-type-badges";
  for (const type of types.slice(0, 2)) {
    const label = project.database.elements?.find((element) => element.id === type)?.name;
    if (!label) continue;
    const badge = document.createElement("span");
    badge.className = "battle-type-badge";
    badge.dataset.elementType = type;
    const silhouette = TYPE_SILHOUETTES[type];
    if (silhouette) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("shape-rendering", "crispEdges");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", silhouette);
      path.setAttribute("fill", "currentColor");
      path.setAttribute("fill-rule", "evenodd");
      svg.append(path);
      badge.append(svg);
    } else {
      badge.textContent = label.slice(0, 1);
    }
    badge.title = label;
    badge.setAttribute("aria-label", `${label} 타입`);
    badges.append(badge);
  }
  return badges.childElementCount ? badges : null;
}
