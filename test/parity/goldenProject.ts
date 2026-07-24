// test/parity/goldenProject.ts
// Canonical parity project: the blank project's full database (actors/classes/skills/items/
// equipment/enemies/troops/states/battleAnimations/monsterSpecies) + an authored crop + authored
// map events. Used by goldenProjectParity.test.ts to play one project end-to-end headlessly.
import { store } from "@/project/store";
import type { Command, CropRecord, GameEvent, Project } from "@/project/types";
import { editorProject } from "./parityRig";

export const GOLDEN_SWITCH = "sw_golden";
export const GOLDEN_SWITCH_EVENT = { x: 2, y: 3 };
export const GOLDEN_TRANSFER_EVENT = { x: 4, y: 3 };
export const GOLDEN_TRANSFER_DEST = { x: 15, y: 12 };

function actionEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "golden",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      },
    ],
  } as GameEvent;
}

export function createGoldenParityProject(): Project {
  return editorProject(() => {
    store.update((project) => {
      const crop: CropRecord = {
        id: "crop_parity",
        name: "parity crop",
        seedItemId: "item_potion",
        harvestItemId: "item_potion",
        harvestCount: 2,
        stages: [{ days: 1 }, { days: 1 }],
        seasons: ["spring", "summer", "fall", "winter"] as CropRecord["seasons"],
      };
      project.database.crops = [...(project.database.crops ?? []), crop];
      project.switches.push({ id: GOLDEN_SWITCH, name: "golden" });
      const map = project.maps[project.startMapId];
      map.events.push(actionEvent("ev_golden_switch", GOLDEN_SWITCH_EVENT.x, GOLDEN_SWITCH_EVENT.y, [{ kind: "setSwitch", switchId: GOLDEN_SWITCH, value: true }]));
      map.events.push(actionEvent("ev_golden_transfer", GOLDEN_TRANSFER_EVENT.x, GOLDEN_TRANSFER_EVENT.y, [{ kind: "transfer", mapId: project.startMapId, x: GOLDEN_TRANSFER_DEST.x, y: GOLDEN_TRANSFER_DEST.y }]));
    });
  });
}
