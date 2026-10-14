// 해적 군도 낱말 라우팅·도구 탐침 — 테스트 러너 없이 vite-node 로 돌린다.
import { describesPiratePlace, pirateIslesTargetFor } from "@/ai/pirateIslesPolicy";
import { createBlankProject } from "@/project/defaults/blankProject";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
const cases: [string, boolean][] = [
  ["해적 항구 마을 만들어줘", true], ["열대 섬 해변 마을", true], ["난파선과 보물 동굴 섬", true], ["야자수 해변 마을", true], ["카리브 해적 요새", true],
  ["항구 마을 만들어줘", false], ["로마풍 항구 도시", false], ["버들항 포구", false], ["등대가 있는 바닷가 마을", false], ["일본 상가 거리", false],
];
let bad = 0;
for (const [t, want] of cases) { const got = describesPiratePlace(t); if (got !== want) bad++; console.log(got === want ? "ok " : "BAD", want, t); }
const p = createBlankProject() as any;
console.log("has pirate_isles tileset:", !!p.tilesets.pirate_isles, "refs:", p.tilesets.pirate_isles?.referenceDocuments?.length);
console.log("target:", JSON.stringify(pirateIslesTargetFor(p, { mode: "create", space: "outdoor", source: "llm" } as any, "해적 항구 마을 만들어줘", null, false)));
const tool = TOOL_REGISTRY.find((t) => t.name === "compose_pirate_isles_map");
console.log("tool registered:", !!tool);
// 빈 맵 하나 만들어 도구 실행
const id = "pi_test";
p.maps[id] = { id, name: "해적 항구", width: 56, height: 40, tilesetId: "pirate_isles", tileSize: 16, lowerTiles: new Array(56 * 40).fill(1), upperTiles: new Array(56 * 40).fill(-1), events: [] };
const r = tool!.run(p, { mapId: id, kind: "harbor", seed: 4 } as any) as any;
console.log(r.summary.slice(0, 400));
process.exit(bad ? 1 : 0);
