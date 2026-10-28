// 조수 v2 조선(바람의나라풍) 장소 빌더 — 「조선·한양·사극·고려」 요청의 마을·실내·사냥터·동굴을 joseon_baram 번들 장소로 짓는다.
//
// 2026-10-28 스위트 조립 장부: 「조선 시대 한양에서 누명을 벗는 사극」 요청에 모델이 make_place({type:"village", style:"joseon"}) 를
// 불렀는데 마을 빌더가 style 을 안 보고 버들항(유럽식 목조 집) 마을을 지었다. 주막·포도청도 판타지 실내 v5 였다.
// 조선 칩셋으로 한 장을 짓는 결정론 경로는 등록 장소(import_region_reference — 마을 20호·실내 방 6·궁 내부 4·사냥터·동굴)뿐이라
// 이 빌더는 낱말로 그 장소 하나를 고르고 가져온다. 모델은 칸·좌표를 쓰지 않는다. 고르지 못하는 것은 missingArt 로 알린다.
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

export const JOSEON_TILESET_ID = "joseon_baram";

/** 조선 문화권 낱말 — 요청 원문·명세에 있으면 이 빌더가 맡는다. 무협(중국)·센고쿠(일본)는 아니다. */
export const JOSEON_WORDS = /joseon|조선|한양|사극|고려|삼국\s*시대|한옥|양반|저잣거리|포도청|포졸|관아|동헌|사또|주막|암행어사|바람의\s*나라/iu;

type Pick = { readonly id: string; readonly label: string };
const VILLAGE: Pick = { id: "joseon-v20-64x56", label: "조선 마을 20호" };
const FIELD: Pick = { id: "joseon-field-96x96", label: "조선 사냥터" };
const CAVE: Pick = { id: "joseon-cave-48x48", label: "조선 동굴" };
const HOUSE: Pick = { id: "joseon-in-house-15x15", label: "조선 민가 실내" };
/** 실내 낱말 → 등록 방. 앞이 우선 — 이름 낱말이 방 종류보다 먼저다. */
const ROOMS: readonly (readonly [RegExp, Pick])[] = [
  [/주막|객주|주점|술집|여관|inn|tavern/iu, { id: "joseon-in-inn-22x16", label: "조선 주막 실내" }],
  [/포도청|관아|동헌|관청|감영|의금부|형조|office|court/iu, { id: "joseon-in-office-17x15", label: "조선 관아 실내" }],
  [/대장간|대장장이|smith|forge/iu, { id: "joseon-in-smith-12x10", label: "조선 대장간 실내" }],
  [/약방|의원|한의|약재|pharmacy|clinic/iu, { id: "joseon-in-pharmacy-12x10", label: "조선 약방 실내" }],
  [/서당|서원|글방|향교|school/iu, { id: "joseon-in-school-16x14", label: "조선 서당 실내" }],
  [/어좌|편전|정전|대전|어전|throne/iu, { id: "joseon-in-throne-24x24", label: "조선 궁 어좌전" }],
  [/침전|bedchamber/iu, { id: "joseon-in-bedchamber-16x14", label: "조선 궁 침전" }],
  [/회랑|복도|corridor/iu, { id: "joseon-in-corridor-34x10", label: "조선 궁 회랑" }],
  [/서고|장서|library/iu, { id: "joseon-in-library-20x12", label: "조선 궁 서고" }],
  [/민가|초가|집|방|house|home|living|bedroom/iu, HOUSE],
];
const MARKET = /저잣거리|장터|시장|저자|market|plaza|광장/iu;

const textOf = (spec: PlaceSpec): string => [spec.name, spec.theme, ...(spec.features ?? []), ...(spec.zones ?? []).map((z) => `${z.kind} ${z.purpose ?? ""} ${(z.anchors ?? []).join(" ")}`)].join(" ");

/** 명세 → 가져올 등록 장소. 이름만 먼저 보고, 없으면 테마·방 종류까지. */
export function joseonPlaceFor(spec: PlaceSpec): Pick {
  if (spec.type === "cave" || spec.type === "dungeon") return /사냥|들판|숲|field|hunt/iu.test(textOf(spec)) ? FIELD : CAVE;
  if (spec.type === "village" || spec.type === "street") return /사냥|들판|field|hunt/iu.test(spec.name) ? FIELD : VILLAGE;
  for (const text of [spec.name, textOf(spec)]) {
    const hit = ROOMS.find(([re]) => re.test(text));
    if (hit) return hit[1];
  }
  return HOUSE;
}

/** 다른 문화권이 이름에 박힌 명세는 조선으로 바꾸지 않는다. */
const OTHER_CULTURE = /wizard|마법\s*학교|hogwart|sengoku|edo|에도|센고쿠|jp-modern|일본|japan|kr-modern|modern|현대|monster|몬스터|포켓|murim|무협|무림|강호/iu;

/** make_place 가 원문 요청을 보고 명세에 조선 표시를 붙인다 — 모델이 style 을 fantasy 로 두어도(포도청) 조선 칩셋으로 간다. */
export function localizeJoseonSpec<T extends PlaceSpec>(spec: T, task: string): T {
  const style = spec.style ?? "";
  if (/joseon/iu.test(style)) return spec;
  if (OTHER_CULTURE.test(style)) return spec;
  if (!JOSEON_WORDS.test(`${spec.name} ${style} ${spec.theme ?? ""}`) && !JOSEON_WORDS.test(task)) return spec;
  return { ...spec, style: "joseon" };
}

const JP_MODERN_WORDS = /일본|도쿄|東京|오사카|교토|요코하마|시부야|신주쿠|아키하바라|japan|tokyo|osaka|kyoto/iu;
const JP_PERIOD = /센고쿠|에도|전국\s*시대|사무라이|닌자|sengoku|edo|samurai/iu;

/** 문화권 표시 한곳: 조선 → style joseon, 일본 현대 요청의 마을 → jp-modern(버들항 유럽 마을로 새지 않게). */
export function localizeCultureSpec<T extends PlaceSpec>(spec: T, task: string): T {
  const joseon = localizeJoseonSpec(spec, task);
  if (joseon !== spec || spec.type !== "village") return joseon;
  const style = spec.style ?? "";
  if (OTHER_CULTURE.test(style) || /joseon/iu.test(style)) return spec;
  const own = `${spec.name} ${style} ${spec.theme ?? ""}`;
  if (JP_PERIOD.test(own) || JP_PERIOD.test(task)) return spec;
  return JP_MODERN_WORDS.test(own) || JP_MODERN_WORDS.test(task) ? { ...spec, style: style ? `${style} jp-modern` : "jp-modern" } : spec;
}

/** 들어오는 칸: 지도 아래 가운데에서 가장 가까운 걸을 수 있는 칸(실내는 출입문 안쪽, 마을은 남쪽 길). */
function entranceOf(project: Project, map: GameMap): { x: number; y: number } {
  let best: { x: number; y: number; d: number } | undefined;
  const cx = Math.floor(map.width / 2);
  for (let y = map.height - 1; y >= 0; y--) {
    for (let x = 0; x < map.width; x++) {
      if (!isPassable(project, map, x, y)) continue;
      const d = (map.height - 1 - y) * 3 + Math.abs(x - cx);
      if (!best || d < best.d) best = { x, y, d };
    }
    if (best && map.height - 1 - y > 4) break;
  }
  return best ? { x: best.x, y: best.y } : { x: cx, y: Math.floor(map.height / 2) };
}

/** 지을 자리: 다시 짓기는 그 맵, 명세 mapId 는 그 id(없으면 새 맵 id 로), 아니면 빈 지금 맵·빈 시작 맵을 같은 id 로 다시 쓴다. */
function target(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): { reuse?: string; newId?: string; refuse?: string } {
  const project = run.ctx.project;
  const own = previous?.result.mapIds[0] ?? spec.mapId;
  if (own) {
    const map = project.maps[own];
    if (!map) return { newId: own };
    if (isBlankMap(map) || (previous && map.events.length === 0)) return { reuse: own };
    if (previous) return { refuse: `${map.name} 에 이미 이벤트·사람 ${map.events.length}개가 있어 다시 짓지 않는다 — 다시 지으면 다 지워진다. 남은 문제는 add_people·move_event·stamp_object 로 고치거나 보고에 적는다.` };
    return {};
  }
  for (const id of [spec.hints?.newMap === true ? undefined : run.ctx.currentMapId, project.startMapId]) {
    const map = id ? project.maps[id] : undefined;
    if (map && isBlankMap(map)) return { reuse: map.id };
  }
  return {};
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const warnings: string[] = [];
  const pick = joseonPlaceFor(spec);
  const where = target(run, spec, previous);
  if (where.refuse) return { ok: false, mapIds: previous?.result.mapIds ?? [], summary: where.refuse, warnings, missingArt: [], calls: [], state: previous?.result.state };
  const reuse = where.reuse;
  // 빈 시작 맵(다른 칩셋)을 같은 id 로 다시 쓴다 — 시작 위치·맵 트리가 그대로 이어진다. 맵이 하나뿐이면 지울 수 없어 임시 맵을 둔다.
  let reuseId: string | undefined;
  let spare: string | undefined;
  if (reuse) {
    const tmp = run.call("create_map", { name: "임시", width: 3, height: 3, tilesetId: run.ctx.project.maps[reuse]!.tilesetId });
    spare = tmp.ok ? (tmp.data as { mapId?: string } | undefined)?.mapId : undefined;
    const removed = run.call("remove_map", { mapId: reuse });
    if (removed.ok) reuseId = reuse;
    else warnings.push(`빈 맵 ${reuse} 를 비우지 못해 새 맵에 지었다(${String(removed.summary ?? "").slice(0, 120)})`);
  }
  const res = run.call("import_region_reference", { id: pick.id, name: spec.name, ...(reuseId ?? where.newId ? { newMapId: reuseId ?? where.newId } : {}) });
  if (spare && run.ctx.project.maps[spare]) run.call("remove_map", { mapId: spare });
  const mapId = (res.data as { mapId?: string } | undefined)?.mapId;
  if (!res.ok || !mapId || !run.ctx.project.maps[mapId]) {
    return { ok: false, mapIds: [], summary: `조선 장소 「${pick.label}」 가져오기 실패: ${String(res.summary ?? "").slice(0, 300)}`, warnings, missingArt: [], calls: run.calls.slice(first) };
  }
  if (reuseId && reuseId === run.ctx.project.startMapId) {
    const map = run.ctx.project.maps[mapId]!;
    const ent = entranceOf(run.ctx.project, map);
    run.call("set_start_position", { mapId, x: ent.x, y: ent.y });
  }
  const missingArt: string[] = [];
  if ((spec.type === "village" || spec.type === "street") && MARKET.test(textOf(spec))) {
    const market = run.call("dress_joseon_market", { mapId });
    if (!market.ok) warnings.push(`장터 좌판을 앉히지 못했다: ${String(market.summary ?? "").slice(0, 160)}`);
  }
  if (spec.type === "interior" && (spec.zones?.length ?? 0) > 1) warnings.push(`조선 실내는 등록 방 한 장(${pick.label})으로 짓는다 — 방 ${spec.zones!.length}개 구성은 따르지 못했다. 다른 방이 필요하면 make_place 를 방마다 부른다.`);
  const anchors = (spec.zones ?? []).flatMap((z) => z.anchors ?? []);
  if (anchors.length) warnings.push(`주인공 물건(${anchors.join("·")})은 등록 방의 가구 그대로다 — 하나하나 놓지 않았다.`);
  const project = run.ctx.project;
  const map = project.maps[mapId]!;
  const entrance = project.startMapId === mapId && project.startPos ? { mapId, x: project.startPos.x, y: project.startPos.y } : { mapId, ...entranceOf(project, map) };
  return {
    ok: true,
    mapIds: [mapId],
    entrance,
    summary: `${spec.name}: 조선 칩셋(joseon_baram) 등록 장소 「${pick.label}」 (${map.width}×${map.height})`,
    warnings,
    missingArt,
    calls: run.calls.slice(first),
    state: { referenceId: pick.id },
  };
}

export const JOSEON_BUILDER: PlaceBuilder = {
  id: "joseon",
  accepts: (spec) => /joseon/iu.test(spec.style ?? ""),
  prepare: (spec) => prepareTool("import_region_reference", { id: joseonPlaceFor(spec).id }),
  build,
};

export const JOSEON_CARD = "[조선 style:joseon] 조선·한양·사극·고려 배경은 style 에 joseon 을 넣는다(버들항 유럽 마을·판타지 실내로 짓지 않는다). " +
  "village/street=조선 마을 20호(초가·기와집·논·다리, 이름·테마에 저잣거리·장터면 좌판을 앉힌다) · interior=등록 방 한 장: 주막·관아(포도청·동헌)·대장간·약방·서당·민가·궁 어좌전·침전·회랑·서고(이름 낱말로 고른다, 방은 하나씩) · cave=조선 동굴 · 이름에 사냥터·들판이면 사냥터.";
