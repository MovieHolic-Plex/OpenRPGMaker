import type { Command, GameEvent } from "@/project/types";

export const ICE_GRAND_EXPANSE_REGION_EVENTS = [
  { id: "ev_ice_expanse_region_south", x: 64, y: 119, label: "?⑥そ ?먯젙 湲곗?" },
  { id: "ev_ice_expanse_region_twin", x: 64, y: 106, label: "?띿븘 ?μ꽑" },
  { id: "ev_ice_expanse_region_gate", x: 64, y: 92, label: "以묒븰 鍮숇Ц" },
  { id: "ev_ice_expanse_region_west", x: 40, y: 82, label: "?쒖そ ?섏젙 愿묐㎘" },
  { id: "ev_ice_expanse_region_lake", x: 64, y: 71, label: "嫄곗슱 鍮숉샇" },
  { id: "ev_ice_expanse_region_east", x: 88, y: 82, label: "?숈そ 鍮숈젅踰?" },
  { id: "ev_ice_expanse_region_crown", x: 64, y: 50, label: "?뺢? 援쎌엲湲?" },
  { id: "ev_ice_expanse_region_altar", x: 64, y: 21, label: "鍮숇！ ?쒕떒" },
] as const;

function banner(message: string): Command {
  return { kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "banner", message, durationMs: 1800 } };
}

export function buildIceGrandExpanseRegionEvents(): GameEvent[] {
  return ICE_GRAND_EXPANSE_REGION_EVENTS.map((spec) => ({
    id: spec.id, x: spec.x, y: spec.y, trigger: { kind: "playerTouch" }, commands: [], pages: [{
      id: `${spec.id}_enter`, name: `${spec.label} 쨌 吏꾩엯`, conditions: [], graphic: { transparent: true },
      trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [banner(spec.label)],
    }],
  }));
}
