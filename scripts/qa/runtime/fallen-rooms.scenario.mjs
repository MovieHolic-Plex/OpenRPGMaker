// 폴른 스타 실내 방 전체 검수: 천문대·네 화로의 방·옛 별지기의 방을 기본 화면(480x270·1배)으로 자리마다 찍는다.
// 픽스처는 --project 로 준다(.omo/rooms/render.mts 가 쓰는 project.json).
import audit from "./fallen-audit.scenario.mjs";
const keep = new Set(["title", "boot", "proclamation"]);
const tp = (id, mapId, x, y) => ({ id, note: id, ops: [{ kind: "teleport", mapId, x, y }, { kind: "hold", dir: null, ms: 1400 }], shot: true });
const spots = (process.env.ROOM_SPOTS ? JSON.parse(process.env.ROOM_SPOTS) : [
  ["obs-hall", "fs_observatory", 17, 10],
  ["obs-archive", "fs_observatory", 6, 19],
  ["obs-foyer", "fs_observatory", 15, 18],
  ["obs-study", "fs_observatory", 25, 21],
  ["gate-top", "fs_vault_gate", 15, 4],
  ["gate-bottom", "fs_vault_gate", 15, 14],
  ["vault-sanctum", "fs_vault", 15, 10],
  ["vault-hall", "fs_vault", 15, 16],
  ["vault-west", "fs_vault", 11, 17],
  ["vault-east", "fs_vault", 26, 17],
  ["vault-south", "fs_vault", 15, 23],
]).map(([id, m, x, y]) => tp(id, m, x, y));
export default { ...audit, id: "fallen-rooms", beats: [...audit.beats.filter((b) => keep.has(b.id)), ...spots] };
