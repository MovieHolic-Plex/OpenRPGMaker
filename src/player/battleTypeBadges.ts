import type { BattleBattlerSnapshot } from "@/battle/runtime";
import { store } from "@/project/store";

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
    badge.textContent = label.slice(0, 1);
    badge.title = label;
    badge.setAttribute("aria-label", `${label} 타입`);
    badges.append(badge);
  }
  return badges.childElementCount ? badges : null;
}
