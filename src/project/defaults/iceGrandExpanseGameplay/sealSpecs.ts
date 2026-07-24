import { ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH } from "@/project/defaults/iceGrandExpanseCheckpoints";

export const ICE_GRAND_EXPANSE_SEAL_SWITCHES = {
  west: "sw_ice_expanse_seal_west",
  east: "sw_ice_expanse_seal_east",
  gate: "sw_ice_expanse_gate_open",
} as const;

export const ICE_GRAND_EXPANSE_SEALS = [
  { id: "ev_ice_expanse_seal_west", x: 28, y: 63, side: "west", otherSide: "east", label: "서쪽 서리 인장" },
  { id: "ev_ice_expanse_seal_east", x: 100, y: 62, side: "east", otherSide: "west", label: "동쪽 서리 인장" },
] as const;

export const ICE_GRAND_EXPANSE_GATE = { id: "ev_ice_expanse_central_gate", x: 64, y: 47 } as const;

export const ICE_GRAND_EXPANSE_SHORTCUT_EVENTS = [
  { id: "ev_ice_expanse_lake_shortcut_west", x: 45, y: 60, to: { x: 79, y: 60 }, unlockSwitchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate },
  { id: "ev_ice_expanse_lake_shortcut_east", x: 79, y: 60, to: { x: 45, y: 60 }, unlockSwitchId: ICE_GRAND_EXPANSE_SEAL_SWITCHES.gate },
  { id: "ev_ice_expanse_crown_shortcut_south", x: 60, y: 38, to: { x: 76, y: 37 }, unlockSwitchId: ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH },
  { id: "ev_ice_expanse_crown_shortcut_north", x: 76, y: 37, to: { x: 60, y: 38 }, unlockSwitchId: ICE_GRAND_EXPANSE_SUMMIT_CHECKPOINT_SWITCH },
] as const;
