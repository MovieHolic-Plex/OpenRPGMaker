// modern_city 라우팅 연기 시험 — plainTurn 의 첫 승자 사슬(시대 테마 → jp_city → 고딕 → 해적 → 하늘섬 → 캠퍼스 → modern_city → 버들항)을 그대로 따라 누가 잡는지 본다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/modern-city-int/qa/routing.mts
import { createBlankProject } from "@/project/defaults";
import { sengokuTargetFor } from "@/ai/sengokuEdoPolicy";
import { steampunkTargetFor } from "@/ai/steampunkCityPolicy";
import { sfStationTargetFor } from "@/ai/sfStationPolicy";
import { prehistoricTargetFor } from "@/ai/prehistoricPolicy";
import { jpCityTargetFor } from "@/ai/jpCityPolicy";
import { gothicTargetFor } from "@/ai/gothicPolicy";
import { pirateIslesTargetFor } from "@/ai/pirateIslesPolicy";
import { skyIslandTargetFor } from "@/ai/skyIslandPolicy";
import { campusTargetFor } from "@/ai/campusPolicy";
import { modernCityTargetFor, formatModernCityNote, modernCityPromptLines } from "@/ai/modernCityPolicy";
import { buildPiIntentNote } from "@/ai/piAgent/executionRoute";
const p = createBlankProject();
const start = p.startMapId!;
const mc = { ...structuredClone(p.maps[start]!), id: "mc-street", name: "mc", tilesetId: "modern_city" };
p.maps["mc-street"] = mc as never;
const fresh = createBlankProject();
const cases: [string, string, "interior" | "outdoor" | "unclear", string, string][] = [
  ["도쿄풍 현대 도시 거리 만들어줘", start, "outdoor", "jpCity", "새 프로젝트 버들항 맵 — 현대 도시 낱말은 jp_city"],
  ["도쿄풍 현대 도시 거리 만들어줘", "mc-street", "outdoor", "modernCity", "modern_city 맵을 보고 있으면 그 맵"],
  ["편의점 내부 만들어줘", "mc-street", "interior", "modernCity", "modern_city 거리에서 실내 → konbini"],
  ["사무실 만들어줘", "mc-street", "interior", "modernCity", "modern_city 거리에서 사무실"],
  ["병원 병실 지어줘", "mc-street", "unclear", "modernCity", "공간 불분명 + 실내 낱말"],
  ["학교 교실 만들어줘", "mc-street", "interior", "campus|none", "학교는 캠퍼스 몫 — modern_city 가 잡지 않는다"],
  ["우주 정거장 만들어줘", "mc-street", "outdoor", "sfStation|none", "SF 는 sf_station 몫"],
  ["modern_city 칩셋으로 거리 만들어줘", start, "outdoor", "modernCity", "칩셋 이름"],
  ["사무실 만들어줘", "fresh:" + start, "interior", "none", "modern_city 맵 없는 프로젝트의 일반 실내는 잡지 않는다"],
  ["사무실 만들어줘", start, "interior", "modernCity", "modern_city 맵만 쓰는 프로젝트(jp_city 맵 없음)의 실내"],
  ["일본 상가 거리 만들어줘", "mc-street", "outdoor", "jpCity", "일본 낱말은 jp_city 가 이긴다"],
];
let bad = 0;
for (const [text, mapIdRaw, space, want, why] of cases) {
  const isFresh = mapIdRaw.startsWith("fresh:"); const mapId = mapIdRaw.replace(/^fresh:/, ""); const P = isFresh ? fresh : p;
  const intent = { source: "llm", mode: "create", space } as never;
  const lived = false;
  const sengoku = sengokuTargetFor(P, intent, text, mapId, lived), steampunk = sengoku ? null : steampunkTargetFor(P, intent, text, mapId, lived);
  const sfStation = sengoku || steampunk ? null : sfStationTargetFor(P, intent, text, mapId, lived);
  const prehistoric = sengoku || steampunk || sfStation ? null : prehistoricTargetFor(P, intent, text, mapId, lived);
  const era = sengoku || steampunk || sfStation || prehistoric;
  const jpCity = era ? null : jpCityTargetFor(P, intent, text, mapId, lived);
  const gothic = era || jpCity ? null : gothicTargetFor(P, intent, text, mapId, lived);
  const pirate = era || jpCity || gothic ? null : pirateIslesTargetFor(P, intent, text, mapId, lived);
  const sky = era || jpCity || gothic || pirate ? null : skyIslandTargetFor(P, intent, text, mapId, lived);
  const campus = era || jpCity || gothic || pirate || sky ? null : campusTargetFor(P, intent, text, mapId, lived);
  const modernCity = era || jpCity || gothic || pirate || sky || campus ? null : modernCityTargetFor(P, intent, text, mapId, lived);
  const who = sengoku ? "sengoku" : steampunk ? "steampunk" : sfStation ? "sfStation" : prehistoric ? "prehistoric" : jpCity ? "jpCity" : gothic ? "gothic" : pirate ? "pirate" : sky ? "sky" : campus ? "campus" : modernCity ? "modernCity" : "none";
  const ok = want.split("|").includes(who);
  if (!ok) bad++;
  console.log(`${ok ? "OK  " : "FAIL"} «${text}» @${mapId} ${space} → ${who}${modernCity ? " " + JSON.stringify(modernCity) : ""}  (${why})`);
}
const note = buildPiIntentNote({ project: p, modernCity: { indoor: true, program: "konbini", fromMapId: "mc-street" }, requestText: "편의점 내부", intent: { source: "llm", mode: "create", space: "interior" } as never, targetMap: null, selection: null } as never);
console.log("note has modern_city:", /tileset:"modern_city"/.test(note ?? ""), "| prompt lines (mc map scope):", modernCityPromptLines(p, ["mc-street"]).length, "(fresh scope):", modernCityPromptLines(p, [start]).length);
console.log(formatModernCityNote({}, null).slice(0, 160));
process.exitCode = bad;
