// 길망 행렬의 사례 — 바깥 장소를 짓는 길(빌더·도구)마다 한 줄. 씨앗은 roadMatrix.mts 가 사례마다 돌린다.
//  - 버들항 마을: 자리 자동(모델 자리 없음) + 모델이 실제로 보낸 자리(harness-data/…/road-matrix/recorded.json — 지형 씨앗만 바꾼다).
//  - 숲·들판 길(author_forest_route): 기본 틀 + 모델이 실제로 보낸 설계.
//  - 세계 구성기: 세계마다 바깥 종류 전부(place/world.ts WORLDS).
import fs from "node:fs";
import { WORLDS, worldPlaceSpec } from "../../../src/ai/v2/place/world.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";

export type RoadCase =
  | { readonly id: string; readonly group: string; readonly kind: "place"; readonly spec: PlaceSpec; readonly startTileset?: string; /** 지형 씨앗을 hints.terrainSeed 로도 준다(모델 자리 마을). */ readonly terrainSeed?: true }
  | { readonly id: string; readonly group: string; readonly kind: "tool"; readonly tool: string; readonly args: Record<string, unknown> };

interface Recorded { villages: { from: string; model: string; spec: PlaceSpec }[]; routes: { from: string; model: string; args: Record<string, unknown> }[] }
const recorded = JSON.parse(fs.readFileSync(new URL("../../../harness-data/assistant-capability/road-matrix/recorded.json", import.meta.url), "utf8")) as Recorded;
const short = (from: string) => from.replace(/^lay-/u, "").replace(/-[0-9a-f]{10}\//u, "/");

const village = (id: string, spec: Omit<PlaceSpec, "type" | "name">): RoadCase => ({ id, group: "버들항 마을 · 자리 자동", kind: "place", spec: { type: "village", name: id, ...spec } });
const route = (id: string, args: Record<string, unknown>): RoadCase => ({ id, group: "숲·들판 길 · 기본 틀", kind: "tool", tool: "author_forest_route", args: { side: "east", count: 1, ...args } });

export const ROAD_CASES: RoadCase[] = [
  village("village-river", { theme: "river", size: "small" }),
  village("village-river-medium", { theme: "river", size: "medium", features: ["plaza"] }),
  village("village-coast", { theme: "coast", size: "small" }),
  village("village-coast-harbour", { theme: "coast", size: "medium", features: ["harbour"] }),
  village("village-swamp", { theme: "swamp", size: "small" }),
  village("village-snow-walls", { theme: "snow", size: "medium", features: ["walls", "conifer"] }),
  village("village-terraces", { theme: "river", size: "medium", hints: { landform: "terraces", tiers: 2 }, features: ["hill", "언덕"] }),
  ...recorded.villages.map((v, i): RoadCase => ({ id: `village-model-${i + 1}`, group: `버들항 마을 · 모델 자리(${v.model})`, kind: "place", spec: { ...v.spec, name: `${v.spec.name} [${short(v.from)}]` }, terrainSeed: true })),
  route("route-forest", { terrain: "forest" }),
  route("route-field", { terrain: "field" }),
  route("route-edge", { terrain: "edge" }),
  route("route-forest-3", { terrain: "forest", count: 3 }),
  ...recorded.routes.map((r, i): RoadCase => ({ id: `route-model-${i + 1}`, group: `숲·들판 길 · 모델 설계(${r.model})`, kind: "tool", tool: "author_forest_route", args: r.args })),
  ...WORLDS.filter((w) => w.composer).flatMap((w) => w.kinds.filter((k) => !k.indoor).map((k): RoadCase => ({ id: `${w.id}-${k.id}`, group: `${w.ko}(${w.id}) 구성기`, kind: "place", spec: worldPlaceSpec(w, k, `${w.ko} ${k.ko}`) }))),
  { id: "jp-street-shops", group: "일본 거리(jp_city)", kind: "place", spec: { type: "street", name: "상점가 골목", style: "jp-modern", features: ["shops", "vending machine", "houses"] } },
  { id: "jp-street-park", group: "일본 거리(jp_city)", kind: "place", spec: { type: "street", name: "공원 옆 주택가", style: "jp-modern", size: "medium", features: ["houses", "park", "crosswalk", "bus stop"] } },
  { id: "jp-street-station", group: "일본 거리(jp_city)", kind: "place", spec: { type: "street", name: "역전 거리", style: "jp-modern", features: ["station", "konbini"] } },
  { id: "monster-town", group: "몬스터 마을(monster_overworld)", kind: "place", startTileset: "monster_overworld", spec: { type: "village", style: "monster", name: "새싹 마을", features: ["player house", "lab", "monster center", "grass route north"] } },
];
