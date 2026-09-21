/** Contract-only player fixtures. Never shipped as demo content or written to LegacyDb. */
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage } from "@/project/types";

export function mapCommandRepairsProject() {
  const project = createBlankProject();
  project.meta.title = "Event command repairs";
  if (project.system.titleScreen) {
    project.system.titleScreen = { ...project.system.titleScreen, title: project.meta.title };
  }
  project.system.defaultBgmResourceId = "";
  project.startPos = { x: 3, y: 6 };
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Repair fixture has no start map");
  map.lowerTiles.fill(240);
  map.upperTiles.fill(-1);
  map.encounterRate = 0;
  project.switches.push({ id: "repair_done", name: "Repair complete" });
  const page = (id: string, commands: Command[], extra: Partial<EventPage> = {}): EventPage => ({
    id, name: id, conditions: [], graphic: {}, priority: "below",
    trigger: { kind: "action" }, movement: { type: "fixed", speed: 3, frequency: 3 },
    commands, ...extra,
  });
  const npc = (id: string, x: number, direction: "left" | "right") => ({
    id, x, y: 7, trigger: { kind: "action" as const }, commands: [],
    pages: [page(id, [], {
      priority: "same", overlapForbidden: true,
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" }, direction },
    })],
  });
  const commands: Command[] = [
    { kind: "text", body: "REPAIR START" },
    { kind: "m2Command", commandId: "m2-040-set-event-location",
      fields: { target: "repair_a", mapId: map.id, x: 8, y: 7 } },
    { kind: "text", body: "LOCATION COMPLETE" },
    { kind: "m2Command", commandId: "m2-041-swap-event-location",
      fields: { eventA: "repair_a", eventB: "repair_b" } },
    { kind: "text", body: "SWAP COMPLETE" },
    { kind: "m2Command", commandId: "m2-027-change-system-bgm",
      fields: { resourceId: "cc0-music-field-loop", volume: 63 } },
    { kind: "m2Command", commandId: "m2-028-change-system-se",
      fields: { resourceId: "cc0-sound-ui-confirm", volume: 63 } },
    { kind: "m2Command", commandId: "m2-050-set-weather-effects",
      fields: { value: "snow", intensity: 0.7, transitionMs: 0 } },
    { kind: "text", body: "FIELDS COMPLETE" },
    { kind: "setSwitch", switchId: "repair_done", value: true },
  ];
  map.events = [
    { id: "repair_owner", x: 0, y: 0, trigger: { kind: "action" }, commands: [],
      pages: [page("repair_owner", commands, {
        trigger: { kind: "auto" },
        conditions: [{ kind: "switch", switchId: "repair_done", value: false }],
      })] },
    npc("repair_a", 5, "right"),
    npc("repair_b", 10, "left"),
  ];
  return project;
}
