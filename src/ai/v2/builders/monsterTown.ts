// 조수 v2 몬스터 수집(포켓몬류) 첫 마을 빌더 — v1 build_monster_game 을 그대로 부른다.
//
// 몬스터 칩셋(monster_overworld 계열)으로 마을을 짓는 결정론 도구는 build_monster_game 하나뿐이다(빈 프로젝트 전용).
// 그 생성기의 시작 마을이 요청 문법 그대로다: 주인공 집(2층 내 방)·박사 연구소·회복 센터·도구점, 북쪽 1번길(키큰 풀숲·야생 조우·트레이너).
// 생성기는 첫 마을만 따로 짓지 못해 뒤 캠페인(체육관 gymCount, 기본 1 = 맵 19개)도 같이 생긴다 — 보고에 그대로 적는다.
// 이 빌더가 더 하는 일: 맵 이름을 요청 낱말로(「주인공의 집」「몬스터 센터」), 생성기의 기본 주민 넷을 뺀다(마을 사람은 add_people 로 —
// 요청한 수만큼만 서게). 칩셋은 생성기가 장르 잠금을 걸어 몬스터 계열로 고정된다.
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

export const MONSTER_TOWN_CARD =
  "Monster-collecting (Pokémon-like) town: make_place {type:'village', style:'monster', name:town name, theme?:'meadow'|'desert'|'snow'|'coast'|'volcano', hints?:{title:game title (invent one if the project title is still «새 프로젝트» or a test name), region:region name, professor:professor name, firstRoute:first route name, gymCount:number of gyms (default 1), townSize:small|medium|large, streets:cross|ladder (two cross streets)|loop (ring road)|jog (bent main road), pond:true|false — set these only when the request named size, streets or a pond. Otherwise leave them empty (empty = a different town each run, filled = always the same town)}}. " +
  "Works only in an empty project — the monster game generator builds the first town (hero's house, own room upstairs, professor's lab, monster center, item shop), Route 1 to the north (tall grass, wild encounters, trainers) and a short campaign after it in one go, and locks the chipset to the monster family. " +
  "The generator's default residents are left out, so place townspeople with add_people (mapId = town map), as many as requested (where: 광장 square · 입구 entrance · 가운데 center…). Rebuilding or fixing (edit_place) is not possible.";

const MONSTER_STYLE = /monster|몬스터|포켓|pokemon|pokémon/iu;
const THEMES = ["desert", "snow", "coast", "volcano"] as const;
const THEME_WORDS: readonly (readonly [RegExp, (typeof THEMES)[number]])[] = [
  [/desert|사막|오아시스/iu, "desert"], [/snow|눈|설원|겨울/iu, "snow"], [/coast|harbou?r|sea|바닷|해안|항구|포구|섬/iu, "coast"], [/volcan|화산|용암/iu, "volcano"],
];
/** 생성기의 기본 주민(안내원·주민·떠도는 주민) — 요청한 마을 사람만 서게 뺀다. 표지판·오프닝·문은 그대로. */
const DEFAULT_RESIDENT = /_(guide|local|ambient_resident_\d+)$/u;

/** 문 이벤트가 가는 맵 — 조건 분기·선택지 안의 이동까지(1번길 문은 동료를 받은 뒤에만 열리는 분기 안에 있다). */
function transferTargets(map: GameMap): { event: GameEvent; mapId: string }[] {
  const out: { event: GameEvent; mapId: string }[] = [];
  const walk = (event: GameEvent, node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) walk(event, n); return; }
    if (!node || typeof node !== "object") return;
    const t = node as { kind?: string; mapId?: string };
    if (t.kind === "transfer" && typeof t.mapId === "string") { if (!out.some((o) => o.event === event && o.mapId === t.mapId)) out.push({ event, mapId: t.mapId }); return; }
    for (const v of Object.values(node)) walk(event, v);
  };
  for (const event of map.events ?? []) walk(event, event.pages ?? []);
  return out;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 40) : undefined;
}

function themeOf(spec: PlaceSpec): (typeof THEMES)[number] | undefined {
  const t = `${spec.theme ?? ""} ${(spec.features ?? []).join(" ")}`;
  if ((THEMES as readonly string[]).includes(spec.theme ?? "")) return spec.theme as (typeof THEMES)[number];
  return THEME_WORDS.find(([re]) => re.test(t))?.[1];
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const calls = run.calls;
  const first = calls.length;
  const fail = (summary: string, warnings: string[] = []): PlaceBuildResult => ({ ok: false, mapIds: previous?.result.mapIds ?? [], summary, warnings, missingArt: [], calls: calls.slice(first) });
  if (previous) return fail("몬스터 마을은 생성기가 빈 프로젝트에서 한 번에 짓는다 — 같은 자리 다시 짓기·고치기는 못 한다. 사람은 add_people, 남은 문제는 보고에 적는다.");

  const hints = spec.hints ?? {};
  const gymCount = typeof hints.gymCount === "number" && Number.isInteger(hints.gymCount) ? Math.max(0, Math.min(8, hints.gymCount)) : 1;
  const names = {
    startTown: str(spec.name),
    ...(str(hints.professor) ? { professor: str(hints.professor) } : {}),
    // 첫 길 이름 기본값이 원래 마을 이름(「1번길 · 별싹 들판」)이라 마을 이름만 바꾸면 표지판이 어긋난다.
    ...(str(hints.firstRoute) ? { firstRoute: str(hints.firstRoute) } : str(spec.name) ? { firstRoute: `1번길 · ${str(spec.name)!.replace(/\s*마을$/u, "")} 들판` } : {}),
    ...(str(hints.region) ? { region: str(hints.region) } : {}),
  };
  const theme = themeOf(spec);
  const title = str(hints.title);
  // 시작 마을 짜임(풀밭 마을만): 모델이 고른 크기·길·연못 + 요청마다 다른 씨앗 — 늘 같은 마을 판이었다(2026-10-24 다양성 검수).
  const startLayout = {
    seed: typeof hints.seed === "number" ? Math.max(0, Math.floor(hints.seed)) : (spec.salt ?? Math.floor(Math.random() * 90000)) % 90000,
    ...(["small", "medium", "large"].includes(String(hints.townSize)) ? { size: hints.townSize } : spec.size ? { size: spec.size } : {}),
    ...(["cross", "ladder", "loop", "jog"].includes(String(hints.streets)) ? { streets: hints.streets } : {}),
    ...(typeof hints.pond === "boolean" ? { pond: hints.pond } : /pond|연못|호수|lake/iu.test(`${(spec.features ?? []).join(" ")}`) ? { pond: true } : {}),
  };
  const res = run.call("build_monster_game", { mode: "create", gymCount, names, startLayout, ...(title ? { title } : {}), ...(theme ? { startTheme: theme } : {}) });
  if (!res.ok) {
    const why = String(res.summary ?? "");
    return fail(`몬스터 마을 짓기 실패: ${why.slice(0, 300)}${/보존|authored/u.test(why) ? " — 생성기는 손대지 않은 빈 프로젝트에서만 짓는다(이미 맵이 있다)." : ""}`);
  }
  const project: Project = run.ctx.project;
  const townId = project.startMapId;
  const town = project.maps[townId];
  if (!town) return fail("몬스터 마을 생성 뒤 시작 맵을 찾지 못했다.");
  const townName = town.name;
  const warnings: string[] = [];

  // 첫 마을 묶음: 마을 문이 가는 실내(+ 그 실내의 2층)와 북쪽 길(바깥 맵 중 가장 위쪽 문).
  const doors = transferTargets(town).filter((t) => project.maps[t.mapId]);
  const isInterior = (id: string) => id.startsWith(`${townId}_`) || /rooms/u.test(project.maps[id]?.tilesetId ?? "") || /_lab$/u.test(id);
  const outdoor = doors.filter((d) => !isInterior(d.mapId)).sort((a, b) => a.event.y - b.event.y);
  const routeId = outdoor[0]?.mapId;
  if (routeId && outdoor[0]!.event.y > town.height / 3) warnings.push(`첫 길(${project.maps[routeId]?.name})의 문이 마을 북쪽이 아니다(${outdoor[0]!.event.x},${outdoor[0]!.event.y}).`);
  const rooms = [...new Set(doors.filter((d) => isInterior(d.mapId) && !/school/u.test(d.mapId)).map((d) => d.mapId))];
  const upstairs = [...new Set(rooms.flatMap((id) => transferTargets(project.maps[id]!).map((t) => t.mapId)).filter((id) => id !== townId && project.maps[id] && !rooms.includes(id)))];
  const roleOf = (id: string) => /_lab$/u.test(id) ? "lab" : /_center$/u.test(id) ? "center" : /_house$/u.test(id) ? "house" : /_mart$/u.test(id) ? "mart" : "other";
  const order = { lab: 0, center: 1, house: 2, mart: 3, other: 4 } as const;
  rooms.sort((a, b) => order[roleOf(a)] - order[roleOf(b)]);

  // 이름을 요청 낱말로: 주민의 집 → 주인공의 집, 회복 센터 → 몬스터 센터.
  for (const id of [...rooms, ...upstairs]) {
    const m = project.maps[id]!;
    const next = m.name.replace(/주민의 집/u, "주인공의 집").replace(/회복 센터/u, "몬스터 센터");
    if (next !== m.name) run.call("set_map_properties", { mapId: id, name: next });
  }
  // 기본 주민을 뺀다 — 마을 사람은 add_people 로 요청한 수만큼.
  const residents = (run.ctx.project.maps[townId]?.events ?? []).filter((e) => DEFAULT_RESIDENT.test(e.id)).map((e) => e.id);
  for (const eventId of residents) run.call("remove_event", { mapId: townId, eventId });

  const after = run.ctx.project;
  const label = (id: string) => after.maps[id]?.name ?? id;
  const roles = rooms.map((id) => `${({ lab: "박사 연구소", center: "몬스터 센터", house: "주인공 집", mart: "도구점", other: "건물" } as const)[roleOf(id)]}=${label(id)}`);
  const missing = (["lab", "center", "house"] as const).filter((r) => !rooms.some((id) => roleOf(id) === r));
  if (missing.length) warnings.push(`생성된 첫 마을에 ${missing.join("·")} 문이 없다.`);
  const total = Object.keys(after.maps).length;
  const mapIds = [townId, ...(routeId ? [routeId] : []), ...rooms, ...upstairs];
  warnings.push(`생성기가 첫 마을만 따로 짓지 못해 뒤 캠페인(체육관 ${gymCount}·맵 모두 ${total}개)도 함께 지었다 — 보고에 적는다.`);
  if (residents.length) warnings.push(`생성기의 기본 주민 ${residents.length}명을 뺐다 — 마을 사람은 add_people(mapId=${townId})로 둔다.`);
  return {
    ok: true,
    mapIds,
    entrance: { mapId: townId, x: after.startPos.x, y: after.startPos.y },
    summary: `몬스터 마을 「${townName}」(${town.width}×${town.height}) — ${roles.join(", ")}${routeId ? `, 북쪽 길 ${label(routeId)}(풀숲·야생 조우)` : ""}`,
    warnings,
    missingArt: [],
    calls: calls.slice(first),
  };
}

export const MONSTER_TOWN_BUILDER: PlaceBuilder = {
  id: "monster-town",
  accepts: (spec) => spec.type === "village" && MONSTER_STYLE.test(`${spec.style ?? ""} ${spec.theme ?? ""}`),
  prepare: () => prepareTool("build_monster_game", { mode: "create" }),
  build,
};
