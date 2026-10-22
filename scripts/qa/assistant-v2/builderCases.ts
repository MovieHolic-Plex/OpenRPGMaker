// 조수 v2 빌더 증명 사례 — 빌더마다 몇 개씩. before = 시작 상태를 만드는 v1 도구 호출(선택).
import type { PlaceSpec } from "../../../src/ai/v2/types.ts";
export interface BuilderCase { readonly id: string; readonly spec: PlaceSpec; readonly startTileset?: string; readonly before?: readonly { tool: string; args: Record<string, unknown> }[] }
export const BUILDER_CASES: BuilderCase[] = [
  { id: "int-tavern", spec: { type: "interior", name: "선술집", zones: [{ kind: "tavern", purpose: "손님 홀", anchors: ["바 카운터", "벽난로", "올라가는 계단"] }, { kind: "kitchen", purpose: "주방" }], floors: 2 } },
  { id: "int-observatory", spec: { type: "interior", name: "천문대", size: "large", zones: [{ kind: "observatory", purpose: "관측실", anchors: ["큰 망원경", "별자리 원판", "책장"] }] } },
  { id: "int-cosy", spec: { type: "interior", name: "아늑한 선술집", zones: [{ kind: "tavern" }, { kind: "kitchen" }], hints: { dressing: 1 } } },
  { id: "village-river-small", spec: { type: "village", name: "버들여울", size: "small", theme: "river", features: ["river", "plaza"] } },
  { id: "village-coast", spec: { type: "village", name: "갈매기 포구", size: "medium", theme: "coast", features: ["harbour"] } },
  { id: "village-snow-walls", spec: { type: "village", name: "서리마을", size: "medium", theme: "snow", features: ["walls", "conifer"] } },
  { id: "village-swamp-scatter", spec: { type: "village", name: "갈대 늪마을", size: "small", theme: "swamp", features: ["scatter"] } },
  { id: "dungeon-tower-boss", spec: { type: "dungeon", name: "회색 탑", size: "medium", floors: 3, theme: "castle", features: ["tower", "boss", "chests", "enemies"] } },
  { id: "cave-lair-chest", spec: { type: "cave", name: "고블린 굴", size: "small", features: ["goblin lair", "chests", "enemies"] } },
  { id: "dungeon-flooded-catacomb", spec: { type: "dungeon", name: "수몰 지하묘지", size: "small", floors: 2, theme: "catacomb", features: ["flooded", "boss", "enemies", "lever"] } },
  { id: "cave-ice-refusal", spec: { type: "cave", name: "얼음 동굴", size: "small", theme: "ice cave", features: ["enemies"] } },
];
