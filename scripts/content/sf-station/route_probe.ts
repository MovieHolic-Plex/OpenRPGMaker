// SF 낱말 라우팅 탐침 — 테스트 러너 없이 vite-node 로 돌린다.
import { describesSfPlace, sfStationTargetFor } from "@/ai/sfStationPolicy";
import { createBlankProject } from "@/project/defaults/blankProject";
const cases: [string, boolean][] = [
  ["우주 정거장 로비와 거주구 만들어줘", true], ["사이버펑크 네온 거리", true], ["달 기지 연구소", true],
  ["SF 연구 기지 실험실", true], ["cyberpunk alley", true], ["화성 기지 착륙장", true],
  ["일본 상가 거리 만들어줘", false], ["학교 과학실", false], ["버들항 마을", false], ["네온사인 가게 하나", false],
];
let bad = 0;
for (const [t, want] of cases) { const got = describesSfPlace(t); if (got !== want) bad++; console.log(got === want ? "ok " : "BAD", want, t); }
const p = createBlankProject() as any;
console.log("has sf_station tileset:", !!p.tilesets.sf_station);
const target = sfStationTargetFor(p, { mode: "create", space: "outdoor", source: "llm" } as any, "사이버펑크 네온 거리", null, false);
console.log("target:", JSON.stringify(target));
process.exit(bad ? 1 : 0);
