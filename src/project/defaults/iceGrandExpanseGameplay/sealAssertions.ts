import { isPassable } from "@/project/collision";
import { IceGrandExpanseGameplayError } from "@/project/defaults/iceGrandExpanseGameplay/gameplayError";
import { reachableIceGrandExpanseCells, targetIceGrandExpanseReached } from "@/project/defaults/iceGrandExpanseGameplay/sealReachability";
import { ICE_GRAND_EXPANSE_GATE, ICE_GRAND_EXPANSE_SEAL_SWITCHES } from "@/project/defaults/iceGrandExpanseGameplay/sealSpecs";
import type { IceGrandExpansePoint } from "@/project/defaults/iceGrandExpanseMap";
import { ICE_GRAND_EXPANSE_BOSS } from "@/project/defaults/iceGrandExpansePlan";
import type { PlaySession } from "@/project/session";
import type { GameMap, Project } from "@/project/types";

export function assertIceGrandExpanseSummitAccess(project: Project, map: GameMap, session: PlaySession): void {
  const reachable = reachableIceGrandExpanseCells(project, map, session);
  if (targetIceGrandExpanseReached(reachable, map, ICE_GRAND_EXPANSE_BOSS)) return;
  const gateOpen = session.switches[ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate] === true;
  throw new IceGrandExpanseGameplayError(
    gateOpen ? "ROUTE_UNREACHABLE" : "GATE_CLOSED", ICE_GRAND_EXPANSE_GATE.x, ICE_GRAND_EXPANSE_GATE.y,
    gateOpen ? "BOSS_APPROACH_UNREACHABLE" : "BOTH_SEALS_REQUIRED",
  );
}

export function assertIceGrandExpanseContactAllowed(project: Project, map: GameMap, point: IceGrandExpansePoint): void {
  const safe = (map.safeZones ?? []).some((zone) => point.x >= zone.x && point.y >= zone.y && point.x < zone.x + zone.w && point.y < zone.y + zone.h);
  if (safe) throw new IceGrandExpanseGameplayError("CONTACT_BLOCKED", point.x, point.y, "SAFE_ZONE");
  if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !isPassable(project, map, point.x, point.y)) {
    throw new IceGrandExpanseGameplayError("CONTACT_BLOCKED", point.x, point.y, "IMPASSABLE_CONTACT_POINT");
  }
}
