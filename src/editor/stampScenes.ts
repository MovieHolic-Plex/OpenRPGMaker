// editor/stampScenes.ts
// 바로 깔기의 장면 구성기 메뉴와 실행 단계 — 「마을/번화가/상점가/던전/오피스 로비」처럼 장소 한 장을 말하면
// 모델은 이 메뉴에서 장면·스타일·가게·실내 구성만 고르고(compose_scene), 코드는 이미 있는 구성기 도구를 그대로 부른다.
//
// 왜 (2026-10-18 사용자 「바로깔기는 그냥 AI 한테 시키는 게 아니라 룰베이스드인 거야? 방법이 잘못된 거 아니냐」):
// R3 의 바로 깔기는 선택 칸마다 fill_region·place_house·place_object 를 늘어놓아 보도 바다·H 자 길·빈 던전 방이 나왔다.
// 도로망·블록·대지·여러 칸 건물 키트·방 배치를 짜는 구성기(compose_modern_city_street·compose_jp_city_street·
// author_beodeul_town·author_dungeon·build_hand_interior_room …)는 이미 있었다 — 바로 깔기가 그것을 부르지 않았을 뿐이다.
// 장면 목록의 정본은 THEME_SCENES(테마 장면 카탈로그)다. 여기서는 바로 깔기용으로 거르고 실내·강변 변형만 더한다.
import type { StampSceneOption, StampStep } from "@/ai/stampPlanner";
import { HAND_INTERIOR_SPECS, roomSpecOf } from "@/editor/handInterior/builder";
import { LayoutError, layoutCandidates, type LayoutCandidate } from "@/editor/handInterior/layout";
import { roomPrograms } from "@/editor/handInterior/templates";
import { THEME_SCENES } from "@/editor/tools/themeScenes";
import { getTool } from "@/editor/tools/toolRegistry";
import { planJpCityStreet } from "@/project/jpCityStreetComposer";
import { flavorAvailable } from "@/project/jpShitamachiStreet";
import { MODERN_CITY_STREET_MIN } from "@/project/modernCityStreetComposer";
import type { GameMap, Project } from "@/project/types";

const INTERIOR_SCENE_ID = "interior";
const JP_RIVERSIDE_STYLE = "riverside";
const JP_STREET_MIN = { w: 40, h: 28 } as const;
/** compose_modern_city_street 의 shops 가 알아듣는 낱말(modernCityTools SHOP_WORDS 와 같은 뜻). */
const MODERN_SHOP_WORDS: readonly string[] = ["편의점", "카페", "은행", "병원", "사무실", "호텔", "백화점", "아파트", "주택", "창고", "이자카야", "빵집", "우체국", "경찰서", "소방서", "주차 건물"];

type ToolSchemaProps = Record<string, { readonly items?: { readonly enum?: readonly (string | number)[] } } | undefined>;

/** 바로 깔기가 이 맵에서 부를 수 있는 장면 — 칩셋이 맞고, 도구가 지금 맵(mapId)에 짓는 것만. */
export function stampSceneMenu(project: Project, map: GameMap): StampSceneOption[] {
  const menu: StampSceneOption[] = [];
  for (const scene of THEME_SCENES) {
    if (scene.tilesetId !== map.tilesetId) continue;
    const props = getTool(scene.tool)?.parameters.properties as ToolSchemaProps | undefined;
    if (!props?.mapId) continue;
    const styles = scene.id === "jp_city"
      ? [...(scene.styles ?? []).filter((s) => (s !== "shitamachi" && s !== "shotengai") || flavorAvailable(project.tilesets[map.tilesetId], s)), JP_RIVERSIDE_STYLE]
      : scene.styles;
    const schemaShops = props.shops?.items?.enum?.filter((value): value is string => typeof value === "string");
    const shops = scene.id === "modern_city" ? MODERN_SHOP_WORDS : schemaShops;
    menu.push({
      id: scene.id,
      label: scene.label,
      about: scene.id === "jp_city" ? `${scene.about} · riverside = 강·제방·강변 산책로가 있는 거리` : scene.about,
      ...(styles?.length ? { styles } : {}),
      ...(shops?.length ? { shops } : {}),
    });
  }
  const tileset = project.tilesets[map.tilesetId];
  if (tileset && roomSpecOf(tileset)) {
    const programs = Object.values(roomPrograms(map.tilesetId)).flatMap((list) => list.map((entry) => entry.map));
    if (programs.length > 0) {
      menu.push({
        id: INTERIOR_SCENE_ID,
        label: "실내 한 층",
        about: "여러 방 실내(로비·사무실·백화점·마트·병원·역·영화관·식당·박물관…) — 방 배치·칸막이·문·출구·가구를 통째로",
        programs: [...new Set(programs)],
      });
    }
  }
  return menu;
}

/** 강이 드는 jp_city 거리 씨앗 — 구성기는 씨앗으로 강 띠를 고르므로(2줄 지도 40%) 순수 계획을 돌려 강이 나오는 첫 씨앗을 쓴다. */
function riversideJpSeed(mapId: string, width: number, height: number, from: number): number | null {
  for (let k = 0; k < 200; k++) {
    const seed = (from + k) % 10_000;
    const plan = planJpCityStreet({ mapId, width, height, seed, style: "shopping" });
    if (plan.steps.some((step) => JSON.stringify(step.args).includes("jp-river-wall"))) return seed;
  }
  return null;
}

/** 실내 후보 중 몇 번째를 쓸지 — 방 짜임(방마다 바깥틀 3×3 칸 중 어디)이 다른 후보끼리 묶어 씨앗으로 고른다. */
const LAYOUT_POOL = 12;
function distinctLayoutVariant(project: Project, map: GameMap, program: string, layoutSeed: number, pick: number): number {
  const spec = roomSpecOf(project.tilesets[map.tilesetId]) ?? HAND_INTERIOR_SPECS[map.tilesetId];
  if (!spec || !program) return 0;
  let candidates: readonly LayoutCandidate[];
  try { candidates = layoutCandidates(map.tilesetId, { program, seed: layoutSeed }, spec, LAYOUT_POOL); }
  catch (error) { if (error instanceof LayoutError) return 0; throw error; }
  // 점수 순 후보는 칸막이를 한두 칸 옮긴 같은 짜임이 이어진다(2026-10-18 R4: 씨앗 세 개가 같은 2+1 칸막이 사무실) —
  // 짜임마다 가장 좋은 후보만 남기고 그중에서 고른다. 도구는 같은 {program, seed} 로 같은 목록을 만드니 번호가 맞는다.
  const firstOfShape = new Map<string, number>();
  candidates.forEach((c, index) => {
    const shape = c.rooms.map((room) => `${room.id}@${Math.min(2, Math.floor((3 * (room.x0 + room.x1)) / (2 * c.width)))}${Math.min(2, Math.floor((3 * (room.y0 + room.y1)) / (2 * c.height)))}`).sort().join("|");
    if (!firstOfShape.has(shape)) firstOfShape.set(shape, index);
  });
  const distinct = [...firstOfShape.values()];
  return distinct[Math.abs(pick) % distinct.length] ?? 0;
}

/**
 * compose_scene 단계 → 실제 구성기 호출 단계(필요하면 resize_map 이 먼저). 모두 `call` 에 등록 도구 이름을 단다.
 * 장면을 못 쓰는 이유가 코드에서 바로 보이면(칩셋 불일치·강 씨앗 없음) dropped 로 돌려준다.
 */
export function expandSceneStep(step: StampStep, project: Project, variation: number): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[] } {
  const mapId = String(step.args.mapId ?? "");
  const map = project.maps[mapId];
  const sceneId = String(step.args.scene ?? "");
  if (!map) return { steps: [], dropped: [`${step.label}: 맵이 없습니다`] };
  // 씨앗은 부를 때마다 바뀐다 — 같은 문장을 다시 깔아도 도로망·강 굽이·건물 순서·외관·소품 밀도·방 배치가 다른 장이 나온다
  // (2026-10-18 사용자 「프리셋을 만들면 똑같은 맵만 주구장창」). 사용자가 씨앗을 직접 말한 경우만 모델 값을 쓴다.
  const seed = typeof step.args.seed === "number" ? step.args.seed : Math.abs(Math.trunc(variation)) % 10_000;
  const style = typeof step.args.style === "string" ? step.args.style : undefined;
  const shops = Array.isArray(step.args.shops) ? step.args.shops : undefined;
  const sceneStep = (call: string, args: Record<string, unknown>, label = step.label): StampStep => ({ tool: "compose_scene", call, label, args });

  if (sceneId === INTERIOR_SCENE_ID) {
    const program = typeof step.args.program === "string" ? step.args.program : "";
    const layout = { program, seed: seed + 1, variant: distinctLayoutVariant(project, map, program, seed + 1, seed) };
    return {
      steps: [sceneStep("build_hand_interior_room", { mapId, tileset: map.tilesetId, replace: true, name: map.name, layout })],
      dropped: [],
    };
  }
  const scene = THEME_SCENES.find((entry) => entry.id === sceneId);
  if (!scene || scene.tilesetId !== map.tilesetId) return { steps: [], dropped: [`${step.label}: 장면 ${sceneId} 은 이 맵 칩셋(${map.tilesetId})의 구성기가 아닙니다`] };
  const props = (getTool(scene.tool)?.parameters.properties ?? {}) as ToolSchemaProps;
  const out: StampStep[] = [];
  // 거리 구성기는 최소 크기 밑의 맵을 거절한다 — 맵을 그 크기까지 넓힌 뒤 짠다(마을·던전 구성기는 스스로 넓힌다).
  const min = scene.id === "modern_city" ? MODERN_CITY_STREET_MIN : scene.id === "jp_city" ? JP_STREET_MIN : undefined;
  let width = map.width, height = map.height;
  if (min && (width < min.w || height < min.h)) {
    width = Math.max(width, min.w);
    height = Math.max(height, min.h);
    out.push(sceneStep("resize_map", { mapId, width, height }, `맵을 ${width}×${height} 로 넓힘`));
  }
  const args: Record<string, unknown> = { mapId, seed };
  let label = step.label;
  if (scene.id === "jp_city" && style === JP_RIVERSIDE_STYLE) {
    const riverSeed = riversideJpSeed(mapId, width, height, seed);
    if (riverSeed === null) return { steps: [], dropped: [`${step.label}: ${width}×${height} 맵에서 강이 드는 거리 배치를 찾지 못했습니다`] };
    args.seed = riverSeed;
    args.style = "shopping";
    label = `${step.label} — 강·제방·강변 산책로`;
  } else if (scene.styleParam && style) {
    args[scene.styleParam] = style;
  }
  if (props.replace) args.replace = true;
  if (props.shops && shops?.length) args.shops = shops;
  Object.assign(args, scene.extraArgs?.({ width, height }) ?? {});
  out.push(sceneStep(scene.tool, args, label));
  return { steps: out, dropped: [] };
}
