// test/parity/goldenProject.ts
// Canonical parity project: the blank project's full database (actors/classes/skills/items/
// equipment/enemies/troops/states/battleAnimations/monsterSpecies) + an authored crop + authored
// map events. Used by goldenProjectParity.test.ts to play one project end-to-end headlessly.
import { defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { store } from "@/project/store";
import type { Command, CropRecord, GameEvent, Project, TitleScreenSettings } from "@/project/types";
import { editorProject } from "./parityRig";

export const GOLDEN_SWITCH = "sw_golden";
export const GOLDEN_SWITCH_EVENT = { x: 2, y: 3 };
export const GOLDEN_TRANSFER_EVENT = { x: 4, y: 3 };
export const GOLDEN_TRANSFER_DEST = { x: 15, y: 12 };

/** 타이틀 연출 확장 필드(배경 레이어/파티클/intro) — 라운드트립 보존 검증용 저작값. */
export const GOLDEN_TITLE_EFFECTS: Required<
  Pick<TitleScreenSettings, "backgroundLayers" | "particles" | "intro">
> = {
  backgroundLayers: [
    { resourceId: "easyrpg-title-title1", scrollXPerSec: 16, opacity: 0.6 },
    { resourceId: "oprn-title-field", scrollYPerSec: -8, parallax: 0.5 },
  ],
  particles: { preset: "snow", density: 60 },
  intro: { logo: "riseIn", menu: "slideUp", delayMs: 200, staggerMs: 80 },
};

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
      // 타이틀 연출 확장 필드 — 골든 라운드트립이 backgroundLayers/particles/intro 를 보존해야 한다.
      project.system.titleScreen = {
        ...(project.system.titleScreen ?? defaultTitleScreenSettings()),
        backgroundLayers: GOLDEN_TITLE_EFFECTS.backgroundLayers.map((layer) => ({ ...layer })),
        particles: { ...GOLDEN_TITLE_EFFECTS.particles },
        intro: { ...GOLDEN_TITLE_EFFECTS.intro },
      };
      const map = project.maps[project.startMapId];
      map.events.push(actionEvent("ev_golden_switch", GOLDEN_SWITCH_EVENT.x, GOLDEN_SWITCH_EVENT.y, [{ kind: "setSwitch", switchId: GOLDEN_SWITCH, value: true }]));
      map.events.push(actionEvent("ev_golden_transfer", GOLDEN_TRANSFER_EVENT.x, GOLDEN_TRANSFER_EVENT.y, [{ kind: "transfer", mapId: project.startMapId, x: GOLDEN_TRANSFER_DEST.x, y: GOLDEN_TRANSFER_DEST.y }]));
    });
  });
}
