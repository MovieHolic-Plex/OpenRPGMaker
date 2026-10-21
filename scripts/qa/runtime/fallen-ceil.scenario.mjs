// 폴른 스타 실내 천장 점검: 실내 맵 셋(천문대·네 화로의 방·지하)의 천장 구역을 1배로 찍는다.
//  CEIL_MODE=full  맵 전체가 한 화면에 들어오게 RES_VIEW/RES_VP 를 크게 준다(예: 864x1088) — 맵당 한 장.
//  CEIL_MODE=480   기본 화면(480x270)으로 맵마다 여러 자리.
// 픽스처 RES_FIXTURE.
import audit from "./fallen-audit.scenario.mjs";
const keep = new Set(["title", "boot", "proclamation"]);
const tp = (id, mapId, x, y) => ({ id, note: id, ops: [{ kind: "teleport", mapId, x, y }, { kind: "hold", dir: null, ms: 1200 }], shot: true });
const full = [
  tp("ceil-observatory", "fs_observatory", 17, 17),
  tp("ceil-vault-gate", "fs_vault_gate", 16, 9),
  tp("ceil-vault", "fs_vault", 30, 57),
];
const spots = [
  tp("obs-lower", "fs_observatory", 17, 17),
  tp("obs-upper", "fs_observatory", 15, 9),
  tp("gate-top", "fs_vault_gate", 16, 8),
  tp("gate-bottom", "fs_vault_gate", 16, 15),
  tp("vault-north", "fs_vault", 33, 6),
  tp("vault-lantern", "fs_vault", 25, 20),
  tp("vault-west", "fs_vault", 8, 42),
  tp("vault-hall", "fs_vault", 26, 40),
  tp("vault-east", "fs_vault", 45, 42),
  tp("vault-south", "fs_vault", 30, 60),
];
export default { ...audit, id: "fallen-ceil", beats: [
  ...audit.beats.filter((b) => keep.has(b.id)),
  ...(process.env.CEIL_MODE === "480" ? spots : full),
] };
