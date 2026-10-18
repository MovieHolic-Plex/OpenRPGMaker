// build_scene_setting — 이벤트·컷씬·함정 요청이 말한 «무대»(화산·용암 다리·독늪·유적·성소)를 버들항(beodeul_city) 맵에
// 한 번에 짓는다. 새 그림을 그리지 않는다: 버들항 키트(화산 동굴 다리·화로, 신전 폐허 모자이크·열주, 늪 등불)에 더해
// 선사 묶음(화산재·굳은 용암·용암·진흙·늪 물의 꼭짓점 가장자리 칸, 현무암 기둥·화산 언덕)과 고딕 묶음(고목·석상·이끼 바위)을 이식한다.
//
// 2026-10-15 JRPG 파일럿 실측: 조수는 이벤트 도구만 쓰고 지형을 짓지 않았다. 도구를 보이게 해도(42회 stamp_object) 어떤 키트가
// 무엇이 되는지 몰라 구석에 소품만 얹었다. 이 도구가 «장면 낱말 → 키트 조합» 을 코드로 고정한다.
// 2026-10-18 4건 FAIL: 화산에 마을 집과 초록 풀밭, 독늪에 신전 대리석 판석, 성검이 모자이크 중심에서 한 칸 비켜 섰다.
// 이제 무대는 이벤트 둘레 한 화면(25×19)을 그 장소의 바닥으로 통째로 바꾸고, 바깥 테두리까지 벽·바위·고목으로 닫는다.

import type { GameMap, Project } from "@/project/types";
import { protectedPassageCells } from "./v3/constructionTools";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "@/project/defaults/beodeulNature";
import { translateTiles } from "@/project/objectStamp";
import { canMove } from "@/project/collision";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import { SCENE_STAGE_TAG } from "./sceneStageGuard";
import { ScenePainter, distToPolyline, hash01, paintLevels, smoothNoise, type ArtSource, type Cell } from "./sceneTerrain";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const BUILD_SCENE_SETTING_TOOL = "build_scene_setting";

export const SCENE_THEMES = ["lava_bridge", "volcano", "poison_swamp", "ruins_shrine"] as const;
export type SceneTheme = (typeof SCENE_THEMES)[number];

const VOLCANO = "bd-pick-volcano-cave-";
const RUINS = "bd-pick-temple-ruins-";
const SWAMP = "bd-pick-swamp-stilt-";

type Rect = { x: number; y: number; w: number; h: number };
type Walk = { readonly dir: "up" | "down" | "right"; readonly steps: number };

/** 생존(무사 통과) 분기가 걸어갈 길 — 이벤트 칸에서 dir 로 steps 칸. 제자리에 서 있기만 하면 «무사 통과» 가 안 보인다(2026-10-17 jrpg_003 45점). */
const WALKS: Partial<Record<SceneTheme, Walk>> = {
  lava_bridge: { dir: "up", steps: 4 },
  volcano: { dir: "right", steps: 3 },
  poison_swamp: { dir: "right", steps: 4 },
};

/** 비워 두는 동선(이벤트 칸 기준) — 다리·둑길·참배로. 기물을 얹지 않고 조수의 덧찍기도 막는다. */
const CORRIDORS: Record<SceneTheme, readonly Rect[]> = {
  lava_bridge: [{ x: -1, y: -7, w: 3, h: 15 }],
  volcano: [{ x: -16, y: -1, w: 20, h: 3 }],
  poison_swamp: [{ x: -8, y: 0, w: 22, h: 1 }],
  ruins_shrine: [{ x: -1, y: 4, w: 5, h: 8 }],
};

const STEP = { up: [0, -1], down: [0, 1], right: [1, 0] } as const;

/** 무대 한 장을 짓는 동안 함께 쓰는 것. */
interface Stage {
  readonly p: ScenePainter;
  readonly x: number;
  readonly y: number;
  readonly area: Rect;
  /** 걸을 수 있어야 하는 칸(이벤트·시작·걷기 길·맵 이동 칸). 몸체(용암·늪)가 덮지 않는다. */
  readonly dry: (cx: number, cy: number) => boolean;
  readonly built: string[];
}

/** 칸 (cx,cy) 의 네 꼭짓점 중 하나라도 dry 칸에 닿는지 — 꼭짓점 단을 걸을 수 있는 단으로 누른다. */
function touchesDry(s: Stage, vx: number, vy: number): boolean {
  return s.dry(vx, vy) || s.dry(vx - 1, vy) || s.dry(vx, vy - 1) || s.dry(vx - 1, vy - 1);
}

/** 동굴 바위 벽(윗줄·아랫줄) 한 띠 — 맵 끝에 닿지 않은 끝은 서·동 끝 칸으로 닫는다. */
function rockWall(s: Stage, row: number, x0: number, x1: number): void {
  const { p } = s;
  for (let cx = x0; cx <= x1; cx++) {
    const end = cx === x0 && x0 > 0 ? "-l" : cx === x1 && x1 < p.map.width - 1 ? "-r" : "";
    p.ground(cx, row, p.tile("ph", `ph:ph-wall-rock-u${end}`));
    p.ground(cx, row + 1, p.tile("ph", `ph:ph-wall-rock-d${end}`));
  }
}

/** 몸체(용암·늪) 가장자리에 맞닿은 걸을 수 있는 칸 — 갈대·용암 첨탑을 물가에 세울 자리. */
function shoreCells(s: Stage, level: number[], wet: number, from: Rect): Cell[] {
  const { area, p } = s;
  const at = (cx: number, cy: number) => level[(cy - area.y) * area.w + (cx - area.x)] ?? -1;
  const out: Cell[] = [];
  for (let cy = from.y; cy < from.y + from.h; cy++) for (let cx = from.x; cx < from.x + from.w; cx++) {
    if (!p.inside(cx, cy) || at(cx, cy) >= wet || p.blocked(cx, cy)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(cx + dx!, cy + dy!) >= wet - 0.5)) out.push({ x: cx, y: cy });
  }
  return out;
}

/** 마른 칸에 1×1 잔돌·뼈·덤불을 해시로 드문드문 흩는다(밀도 density, 줄 세우지 않는다). */
function scatter(s: Stage, items: readonly (readonly [ArtSource, string])[], density: number, seed: number): void {
  const { p, area } = s;
  for (let cy = area.y; cy < area.y + area.h; cy++) for (let cx = area.x; cx < area.x + area.w; cx++) {
    if (hash01(cx, cy, seed) >= density) continue;
    const [src, id] = items[Math.floor(hash01(cx, cy, seed + 1) * items.length)]!;
    p.kit(src, id, cx, cy);
  }
}

/**
 * 화산 분화구(volcano): 서쪽은 마을 외곽 경계(돌 초소·장작 헛간·나무 울타리·돌담·가로등·이정표·상자·부서진 돌길)이고, 동쪽으로 갈수록
 * 길과 울타리가 끊기며 화산재 분화구·칼데라 용암 못·두 줄기 용암 강으로 이어진다. 화면 안(x-12..x-5)에도 외곽 초소·울타리·돌담·가로등·
 * 이정표가 들어와 정지 화면에서도 «마을 외곽에서 화산 분화구로 접어드는 경계» 가 한눈에 읽힌다.
 */
function buildVolcano(s: Stage): { lavaTile: number } {
  const { p, x, y, area } = s;
  const north: [number, number][] = [[x - 2, area.y - 1], [x - 1.5, y - 7], [x, y - 5.5], [x + 2.5, y - 4.5], [x + 6, y - 3]];
  const south: [number, number][] = [[x - 5, area.y + area.h + 1], [x - 4, y + 4.5], [x - 1.5, y + 3.8], [x + 1.5, y + 4.2], [x + 6, y + 2.5]];
  const level = paintLevels(p, area, ["dirt", "ash", "crust", "lava"], (vx, vy) => {
    const wobble = (smoothNoise(vx, vy, 41, 2) - 0.5) * 0.6;
    if (touchesDry(s, vx, vy)) return 1;
    // 서쪽(vx < x - 6)은 마을 외곽 화산재·다진 흙 경계라 용암이 침범하지 않는다.
    if (vx < x - 6) return smoothNoise(vx, vy, 7, 4) < 0.25 ? 0 : 1;
    const lake = ((vx - (x + 7.6)) / 3.4) ** 2 + ((vy - (y - 0.5)) / 6.2) ** 2;
    if (lake < 1 + wobble) return 3;
    if (distToPolyline(vx, vy, north) < 1.15 + wobble || distToPolyline(vx, vy, south) < 1.05 + wobble) return 3;
    const n = smoothNoise(vx, vy, 7, 4);
    return n > 0.7 ? 2 : n < 0.18 ? 0 : 1;
  }, { ash: "ash-b", dirt: "dirt-b" });
  // 서쪽 마을 외곽 돌길: 사각 띠가 되지 않게 가운데 줄(y)을 따라 이어지다 동쪽 화산재 앞에서 드문드문 끊긴다.
  for (let cx = area.x; cx <= x - 5; cx++) {
    if (cx <= x - 7 || hash01(cx, y, 83) < 0.65) {
      p.ground(cx, y, p.tile("gm", `gm:floor:gm-fl-flag-${(cx + y) % 2 ? "a" : "b"}`));
    }
    for (const dy of [-1, 1]) {
      if (cx <= x - 9 && hash01(cx, y + dy, 89) < 0.55) {
        p.ground(cx, y + dy, p.tile("gm", `gm:floor:gm-fl-flag-${(cx + y + dy) % 2 ? "a" : "b"}`));
      }
    }
  }
  s.built.push("마을 외곽 돌길·화산재 분화구 바닥·칼데라 용암 못·용암 강 2줄");
  if (area.y === 0 && y >= 9) {
    rockWall(s, 0, area.x, area.x + area.w - 1);
    s.built.push("북쪽 현무암 절벽");
  }
  // 마을 외곽 건축물·울타리·경계 소품(x-15..x-6): 초록 풀·덩굴이 없는 돌·나무 외곽 구조물만 쓴다.
  const outskirts: [ArtSource, string, number, number][] = [
    ["bd", "bd-pick-mining-valley-s2", x - 15, y - 8],
    ["bd", "bd-pick-mountain-pass-guard-post", x - 10, y - 7],
    ["bd", "bd-out-woodshed", x - 15, y + 3],
    ["bd", "bd-pick-mining-valley-kiln", x - 10, y + 3],
    ["bd", "bd-out-fence-run", x - 14, y - 2],
    ["bd", "bd-out-fence-run", x - 14, y + 2],
    ["bd", "bd-pick-mountain-pass-wall-seg", x - 8, y - 2],
    ["bd", "bd-pick-mountain-pass-wall-seg", x - 8, y + 2],
    ["bd", "bd-out-signpost", x - 6, y - 2],
    ["bd", "bd-prop-lamp_crook", x - 9, y - 4],
    ["bd", "bd-prop-lamp_crook", x - 9, y + 2],
    ["bd", "bd-pick-mining-valley-crates", x - 12, y - 4],
    ["bd", "bd-out-woodpile", x - 12, y + 4],
  ];
  for (const [src, id, px, py] of outskirts) p.kitNear(src, id, Math.round(px), Math.round(py), 1);
  const shore = shoreCells(s, level, 3, area);
  const spots: [ArtSource, string, number, number][] = [
    ["ph", "ph-basalt-columns", x - 4, y - 8],
    ["ph", "ph-basalt-columns", x + 2, y - 9],
    ["ph", "ph-dead-tree", x - 5, y - 4],
    ["bd", `${VOLCANO}altar`, x - 2, y - 9],
    ["bd", `${VOLCANO}spike-wide`, x - 4, y + 4],
    ["bd", `${VOLCANO}spike-tall`, x + 1, y + 2],
    ["bd", `${VOLCANO}brazier`, x - 4, y - 3],
    ["bd", `${VOLCANO}brazier`, x - 4, y + 2],
    ["ph", "ph-vent", x, y - 2],
    ["ph", "ph-vent", x + 2, y + 2],
    ["bd", `${VOLCANO}steam-vent`, x - 1, y + 2],
    ["bd", `${VOLCANO}bones`, x + 1, y - 2],
    ["bd", `${VOLCANO}fire-crystal`, x - 2, y - 2],
    ["ph", "ph-skull-pole", x - 5, y + 2],
  ];
  for (const [src, id, px, py] of spots) p.kitNear(src, id, Math.round(px), Math.round(py), 2);
  scatter(s, [["ph", "ph-rock-s"], ["ph", "ph-bone-pile"], ["ph", "ph-rock-s"], ["bd", `${VOLCANO}ember-a`]], 0.05, 61);
  for (const c of shore.filter((c) => c.x >= x - 5 && hash01(c.x, c.y, 13) < 0.16)) {
    p.kit("ph", hash01(c.x, c.y, 14) < 0.5 ? "ph-lava-spire" : "ph-obsidian", c.x, c.y - (hash01(c.x, c.y, 14) < 0.5 ? 1 : 0));
  }
  return { lavaTile: p.tile("ph", "ph:ph-lava") };
}

/**
 * 용암 다리(lava_bridge): 동서로 맵을 가르는 용암 협곡을 바위 다리가 남북으로 건넌다. 북쪽·남쪽 양 기슭의 좌우 모서리까지
 * 마도 유적 폐허 벽·부러진 기둥·현무암 기둥·가고일 석상·화로·흑요석·증기 구멍을 배치해 빈 구석이 없게 한다.
 */
function buildLavaBridge(s: Stage): { lavaTile: number } {
  const { p, x, y, area } = s;
  paintLevels(p, area, ["dirt", "ash", "crust", "lava"], (vx, vy) => {
    if (Math.abs(vx - x - 0.5) <= 2 && (vy <= y - 3 || vy >= y + 3)) return 1;
    if (touchesDry(s, vx, vy) && Math.abs(vx - x - 0.5) > 2) return 1;
    const centre = y + 0.2 + Math.sin((vx - x) * 0.45) * 0.4;
    const half = 1.85 + (smoothNoise(vx, vy, 17, 2.5) - 0.5) * 0.55;
    if (Math.abs(vy - centre) < half) return 3;
    return Math.abs(vy - centre) < half + 0.7 && smoothNoise(vx, vy, 9, 3.5) > 0.65 ? 2 : 1;
  }, { ash: "ash-b" });
  s.built.push("화산재 기슭·용암 협곡");
  if (area.y === 0 && y >= 6) {
    rockWall(s, 0, area.x, area.x + area.w - 1);
    s.built.push("북쪽 현무암 벽");
  }
  for (let cy = y + 4; cy < area.y + area.h; cy++) for (let cx = x - 1; cx <= x + 1; cx++) p.ground(cx, cy, p.tile("gm", `gm:floor:gm-fl-flag-${(cx + cy) % 2 ? "a" : "b"}`));
  for (let cx = x - 2; cx <= x + 2; cx++) if (p.inside(cx, y - 4)) p.ground(cx, y - 4, p.tile("gm", `gm:floor:gm-fl-flag-${(cx + y) % 2 ? "a" : "b"}`));
  p.kit("bd", `${VOLCANO}bridge`, x - 1, y - 3, { floor: true });
  const north = y - 5;
  p.mirrorX("gm", "gm-statue-gargoyle", x - 2, north, x);
  p.mirrorX("bd", `${VOLCANO}brazier`, x - 3, north, x);
  p.mirrorX("gm", "gm-statue-gargoyle", x - 2, y + 4, x);
  p.mirrorX("bd", `${VOLCANO}brazier`, x - 3, y + 5, x);
  // 다리 중심(x)이 맵 한가운데가 아니어도(예: x=12, width=20) 좌우 기슭 끝까지 꽉 차도록 개별 kitNear 로 양쪽 기슭을 모두 채운다.
  const bankProps: [ArtSource, string, number, number][] = [
    // 북쪽 서편 기슭 (x-11 .. x-4)
    ["bd", `${RUINS}ruined-wall-2`, x - 11, north],
    ["ph", "ph-basalt-columns", x - 8, north - 1],
    ["bd", `${VOLCANO}pillar-broken-a`, x - 5, north],
    ["bd", `${VOLCANO}brazier`, x - 9, north],
    ["bd", `${VOLCANO}fire-crystal`, x - 6, north + 1],
    ["ph", "ph-obsidian", x - 10, north + 1],
    // 북쪽 동편 기슭 (x+4 .. x+7)
    ["ph", "ph-basalt-columns", x + 4, north - 1],
    ["bd", `${VOLCANO}pillar-broken-b`, x + 6, north],
    ["bd", `${VOLCANO}fire-crystal`, x + 5, north + 1],
    // 남쪽 서편 기슭 (x-11 .. x-4)
    ["bd", `${RUINS}ruined-wall-2`, x - 11, y + 4],
    ["ph", "ph-basalt-columns", x - 8, y + 4],
    ["bd", `${VOLCANO}spike-wide`, x - 6, y + 5],
    ["ph", "ph-rock-l", x - 11, y + 6],
    ["bd", `${VOLCANO}pillar-fallen`, x - 8, y + 7],
    ["bd", `${VOLCANO}brazier`, x - 9, y + 5],
    ["bd", `${VOLCANO}steam-vent`, x - 4, y + 4],
    ["bd", `${VOLCANO}fire-crystal`, x - 5, y + 7],
    ["ph", "ph-obsidian", x - 4, y + 7],
    // 남쪽 동편 기슭 (x+4 .. x+7)
    ["ph", "ph-basalt-columns", x + 4, y + 4],
    ["bd", `${RUINS}ruined-wall-2`, x + 6, y + 4],
    ["bd", `${VOLCANO}spike-wide`, x + 4, y + 6],
    ["bd", `${VOLCANO}brazier`, x + 6, y + 6],
    ["ph", "ph-vent", x + 4, y + 4],
    ["bd", `${VOLCANO}pillar-broken-a`, x + 7, y + 6],
  ];
  for (const [src, id, px, py] of bankProps) p.kitNear(src, id, Math.round(px), Math.round(py), 2, { overBlocked: true });
  scatter(s, [["ph", "ph-rock-s"], ["bd", `${RUINS}rubble-temple`], ["bd", `${VOLCANO}ember-a`], ["ph", "ph-bone-pile"]], 0.07, 73);
  return { lavaTile: p.tile("ph", "ph:ph-lava") };
}

/**
 * 독늪(poison_swamp): 진흙·이끼 땅에 여러 갈래로 갈라진 검은 늪(북쪽 큰 늪, 이벤트 줄을 가로지르는 물길, 남동쪽 웅덩이). 이벤트 줄은
 * 낡은 널판 둑길로 늪을 건너고, 들머리·날머리에 늪 등불. 북쪽 맵 끝은 이끼 낀 마도 유적 벽, 늪가에 고목·버드나무 고사목·
 * 갈대·이끼 통나무·부러진 기둥·버섯·뼈. 생존 분기는 둑길을 따라 4칸 건너간다.
 */
function buildPoisonSwamp(s: Stage): void {
  const { p, x, y, area } = s;
  const lobes: [number, number, number, number][] = [
    [x + 4, y - 6, 3, 2.2], [x + 8.5, y - 4.2, 2.2, 1.7], [x + 11, y - 8, 2.6, 2], [x - 1.5, y - 7.5, 2, 1.5],
    [x + 3, y - 2.5, 1.5, 2], [x + 3.4, y + 0.5, 2, 1.5], [x + 9.5, y + 2.6, 2.8, 1.6], [x - 4, y - 3, 1.5, 1.1],
  ];
  const level = paintLevels(p, area, ["dirt", "mud", "swamp"], (vx, vy) => {
    const onWalk = Math.abs(vy - y - 0.5) <= 0.5;
    if ((touchesDry(s, vx, vy) || onWalk) && !(onWalk && vx > x + 1 && vx < x + 6)) return 1;
    const wobble = (smoothNoise(vx, vy, 23, 2) - 0.5) * 0.5;
    if (lobes.some(([cx, cy, rx, ry]) => ((vx - cx) / rx) ** 2 + ((vy - cy) / ry) ** 2 < 1 + wobble)) return 2;
    return smoothNoise(vx, vy, 29, 4) > 0.78 ? 0 : 1;
  }, { mud: "mud-b" });
  s.built.push("진흙 땅·갈래진 독늪");
  // 널판 둑길: 이벤트 줄이 늪(가장자리 포함)을 지나는 칸에 판자를 2층(하단 덧그림)으로 얹는다 - 밑의 늪물이 판자 틈으로 보이고,
  // 판자 칸 통행(O)이 물(X)을 덮어 건널 수 있다.
  for (let cx = area.x; cx < area.x + area.w; cx++) {
    if ((level[(y - area.y) * area.w + (cx - area.x)] ?? 0) > 1) setLayerTileAt(p.map, 2, p.idx(cx, y), p.tile("ph", "ph:ph-bridge-h"));
  }
  s.built.push("널판 둑길");
  if (area.y === 0 && y >= 8) {
    for (const [wx, src, kit] of [[x - 6, "ph", "ph-rock-mossy"], [x - 1, "gm", "gm-rock-moss"], [x + 9, "ph", "ph-rock-mossy"], [x + 13, "gm", "gm-dead-tree-s"]] as const) p.kitNear(src, kit, wx, 0, 1, { overBlocked: true });
    for (const cx of [x - 3, x + 7, x + 12]) p.kitNear("bd", `${RUINS}column-temple-broken`, cx, 0, 1, { overBlocked: true });
    s.built.push("이끼 낀 마도 유적 벽");
  }
  p.kit("bd", `${SWAMP}lantern`, x - 2, y - 3);
  p.kit("bd", `${SWAMP}lantern`, x - 2, y + 1);
  p.kit("bd", `${SWAMP}lantern`, x + 6, y - 3);
  p.kit("bd", `${SWAMP}lantern`, x + 6, y + 1);
  const spots: [string, string, number, number][] = [
    ["gm", "gm-willow-dead", x - 6, y - 8], ["gm", "gm-dead-tree-crows", x + 6, y - 11], ["bd", `${SWAMP}snag`, x + 13, y - 3],
    ["gm", "gm-dead-tree", x - 6, y - 3], ["bd", `${SWAMP}mangrove`, x + 1, y - 11], ["gm", "gm-dead-tree-s", x + 11, y - 1],
    ["gm", "gm-fallen-log", x - 5, y + 2], ["bd", `${SWAMP}moss-log`, x + 2, y + 3], ["gm", "gm-rock-moss", x + 12, y + 1],
    ["ph", "ph-rock-mossy", x - 3, y - 6], ["bd", `${RUINS}column-temple-broken`, x + 1, y - 3], ["bd", `${RUINS}fallen-column-temple`, x - 4, y - 1],
    ["gm", "gm-bones", x + 1, y + 1], ["gm", "gm-mushrooms", x - 1, y - 2], ["gm", "gm-mushrooms", x + 7, y + 2], ["gm", "gm-thornbush", x - 6, y + 1],
    ["gm", "gm-bramble", x + 9, y - 1], ["gm", "gm-tomb-broken", x + 5, y + 2],
    // 가라앉는 마도 유적: 무너진 성문·낮은 벽 조각·선 기둥이 늪가 마른 땅에 남아 «유적 속 늪» 임을 보인다.
    ["bd", "bd-pick-deep-forest-path-ruin-gate", x - 5, y - 11], ["bd", `${RUINS}ruined-wall-2`, x + 9, y - 3],
    ["bd", `${RUINS}ruined-wall-2`, x - 4, y + 2], ["bd", `${RUINS}column-temple`, x + 12, y - 6], ["bd", `${RUINS}column-temple`, x - 1, y + 2],
    ["bd", `${RUINS}rubble-temple`, x + 10, y - 1], ["bd", `${RUINS}rubble-temple`, x - 3, y - 4],
  ];
  for (const [src, id, px, py] of spots) p.kitNear(src as ArtSource, id, px, py, 3);
  for (const c of shoreCells(s, level, 2, area).filter((c) => hash01(c.x, c.y, 19) < 0.2)) p.kit(hash01(c.x, c.y, 20) < 0.6 ? "gm" : "ph", hash01(c.x, c.y, 20) < 0.6 ? "gm-reeds-dead" : "ph-reeds", c.x, c.y);
  scatter(s, [["gm", "gm-mushrooms"], ["ph", "ph-fern-s"], ["gm", "gm-bush-dead"], ["ph", "ph-rock-s"], ["gm", "gm-stump"]], 0.06, 67);
}

/** 바닥 표본 키트를 칸마다 되풀이해 하단 층에 깐다(원점 ox,oy 기준 무늬 주기). keep 이 있으면 그 칸만. */
function tileKit(s: Stage, kitId: string, rect: Rect, keep: (cx: number, cy: number) => boolean = () => true): void {
  const kit = s.p.kitDef("bd", kitId);
  if (!kit) return;
  for (let cy = Math.max(0, rect.y); cy < Math.min(s.p.map.height, rect.y + rect.h); cy++) {
    for (let cx = Math.max(0, rect.x); cx < Math.min(s.p.map.width, rect.x + rect.w); cx++) {
      const t = kit.rows[(((cy - s.y) % kit.height) + kit.height) % kit.height]?.tiles[(((cx - s.x) % kit.width) + kit.width) % kit.width] ?? -1;
      if (t >= 0 && keep(cx, cy)) s.p.ground(cx, cy, t);
    }
  }
}

/**
 * 성소(ruins_shrine): 성검 바위(이벤트 칸 오른쪽 x+1)를 정확히 한가운데 둔 7×7 모자이크 단, 그 둘레 석회암 안뜰, 바깥은 이끼·풀이
 * 덮은 폐허 땅. 북쪽 맵 끝에 소신전과 수호 석상·무너진 신전 벽, 안뜰 양옆으로 열주, 남쪽은 큰 계단 참배로와 화로 한 쌍.
 * 나무는 화분(돌 화단)에만 심는다.
 */
function buildRuinsShrine(s: Stage): Cell {
  const { p, x, y, area } = s;
  const ax = x + 1;
  // 바깥: 풀 덮인 폐허 땅. 안뜰: 석회암 판석(가장자리를 잡음으로 깎아 풀이 파고든다).
  tileKit(s, `${RUINS}floor-grass`, area);
  const court = { x: ax - 6, y: y - 5, w: 13, h: 10 };
  tileKit(s, `${RUINS}floor-trav`, court, (cx, cy) => {
    const ex = Math.min(cx - court.x, court.x + court.w - 1 - cx), ey = Math.min(cy - court.y, court.y + court.h - 1 - cy);
    return Math.min(ex, ey) >= (smoothNoise(cx, cy, 53, 1.5) > 0.6 ? 1 : 0);
  });
  tileKit(s, `${RUINS}floor-ruin`, { x: ax - 2, y: y + 4, w: 5, h: area.y + area.h - y - 4 });
  s.built.push("폐허 풀밭·석회암 안뜰·참배로 판석");
  p.kit("bd", `${RUINS}mosaic-medallion-7x7`, ax - 3, y - 3, { floor: true });
  p.kit("bd", "bd-mpart-stairs", ax - 2, y + 4, { floor: true });
  if (area.y === 0 && y >= 7) {
    p.kit("bd", `${RUINS}roof-hip-shrine`, ax - 1, 0);
    p.mirrorX("bd", "bd-prop-statue_sage", ax - 4, 0, ax);
    p.mirrorX("bd", `${RUINS}face-temple-2h`, ax - 8, 0, ax);
    p.mirrorX("bd", `${RUINS}column-temple-tall`, ax - 5, 0, ax);
    s.built.push("소신전·수호 석상·신전 벽");
  }
  for (const dy of [-3, 0, 3]) p.mirrorX("bd", dy === 0 ? `${RUINS}column-temple-broken` : `${RUINS}column-temple`, ax - 5, y + dy - 1, ax);
  p.mirrorX("bd", `${VOLCANO}brazier`, ax - 3, y + 4, ax);
  p.mirrorX("bd", "bd-prop-tree_planter", ax - 7, y - 3, ax);
  p.mirrorX("bd", "bd-prop-tree_planter", ax - 7, y + 2, ax);
  const rubble: [string, number, number][] = [
    [`${RUINS}fallen-column-temple`, ax - 9, y + 6], [`${RUINS}ruined-wall-2`, ax + 6, y + 5], [`${RUINS}rubble-temple`, ax - 6, y + 6],
    [`${RUINS}rubble-temple`, ax + 8, y - 1], [`${RUINS}column-temple-broken`, ax + 8, y + 4], [`${RUINS}rubble-temple`, ax - 10, y],
    [`${RUINS}cypress-ruin`, ax - 10, y - 5], [`${RUINS}cypress-ruin`, ax - 12, y + 1], [`${RUINS}column-temple-broken`, ax - 11, y - 2],
  ];
  for (const [id, px, py] of rubble) p.kitNear("bd", id, px, py, 2);
  p.kitNear("gm", "gm-rock-moss", ax - 11, y + 5, 2);
  p.kitNear("gm", "gm-rock-moss", ax + 9, y + 2, 2);
  // 안뜰 밖 풀밭에만 덤불·고사리·잔돌(판석 위에 나무·덤불을 세우지 않는다).
  const onGrass = (cx: number, cy: number) => cx < court.x || cx >= court.x + court.w || cy < court.y || cy >= court.y + court.h;
  for (let cy = area.y; cy < area.y + area.h; cy++) for (let cx = area.x; cx < area.x + area.w; cx++) {
    if (!onGrass(cx, cy) || Math.abs(cx - ax) <= 2 || hash01(cx, cy, 71) >= 0.08) continue;
    p.kit("ph", (["ph-bush", "ph-fern-s", "ph-rock-s", "ph-mushrooms"] as const)[Math.floor(hash01(cx, cy, 72) * 4)]!, cx, cy);
  }
  return { x: ax, y };
}

/**
 * 다리 칸(x-1..x+1, 용암 띠 y-2..y+1)이 «무너진» 모습. 다리 그림은 상단(upper) 층이고 그 밑 하단은 이미 용암이라,
 * 하단만 바꾸면 화면이 그대로다(2026-10-16 18차: 심판이 «다리가 온전하다» 로 감점). 상단 칸을 용암 타일로 덮어 틈을 낸다.
 */
function bridgeCollapse(map: GameMap, x: number, y: number, lavaTile: number) {
  const cells: { x: number; y: number; layer: "upper"; tile: number }[] = [];
  for (const cy of [y - 2, y - 1, y, y + 1]) for (const cx of [x - 1, x, x + 1]) {
    if (cx >= 0 && cx < map.width && cy >= 0 && cy < map.height) cells.push({ x: cx, y: cy, layer: "upper", tile: lavaTile });
  }
  return { cells };
}

/** 구역 가장자리까지 4칸 이하만 남으면 그 모서리는 맵 끝까지 잇는다 — 가는 옛 바닥 띠가 직선 경계로 남지 않게. */
function snapToMapEdge(map: GameMap, r: Rect): Rect {
  const m = 4;
  const x0 = r.x <= m ? 0 : r.x;
  const y0 = r.y <= m ? 0 : r.y;
  const x1 = map.width - (r.x + r.w) <= m ? map.width : r.x + r.w;
  const y1 = map.height - (r.y + r.h) <= m ? map.height : r.y + r.h;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function clampRect(map: GameMap, x: number, y: number, w: number, h: number): Rect {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(map.width, x + w);
  const y1 = Math.min(map.height, y + h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

export const SCENE_SETTING_TOOLS: readonly ToolDefinition[] = [
  {
    name: BUILD_SCENE_SETTING_TOOL,
    mode: "write",
    domains: ["map", "tile"],
    description:
      "이벤트·컷씬·함정이 놓일 «무대» 를 이벤트 좌표 둘레 한 화면(25×19, 맵 끝 4칸 안이면 끝까지)에 한 번에 짓는다(버들항 beodeul_city 맵 전용, 새 그림 없이 기존 키트·선사·고딕 묶음 그림). "
      + "theme: volcano(화산 분화구: 화산재 바닥·칼데라 용암 못·절벽 용암 폭포에서 굽이치는 용암 강·현무암 기둥·흑요석·증기 구멍·화로·석제단, 이벤트 줄은 순례길) · "
      + "lava_bridge(용암 협곡을 가로지르는 바위 다리, 이벤트 칸이 다리 위, 북쪽 현무암 벽·수호 석상, 남쪽 그을린 판석 참배로) · "
      + "poison_swamp(진흙 땅의 갈래진 독늪, 이벤트 줄은 늪을 건너는 널판 둑길, 고목·갈대·늪 등불·이끼 낀 유적 벽) · "
      + "ruins_shrine(고대 유적 성소: 성검 바위를 한가운데 둔 모자이크 단·석회암 안뜰·소신전·수호 석상·열주·큰 계단 참배로). "
      + "x,y 는 이벤트(트리거) 칸이고 x-1,y 는 플레이어가 걸어 들어오는 칸이다 — 이 두 칸은 막지 않는다. 그 구역 밖은 보존한다. "
      + "결과 data.survivalWalk.moves 는 생존(무사 통과) 분기에서 주인공이 위험 구역을 건너는 막히지 않은 걸음이다(moveActor target:'player'). "
      + "짓고 나서 show_map_region 으로 그림을 확인하고 이벤트를 만든다.",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id(생략 시 현재 맵)" },
        theme: { type: "string", enum: [...SCENE_THEMES] },
        x: { type: "integer", description: "이벤트(트리거) 칸 x" },
        y: { type: "integer", description: "이벤트(트리거) 칸 y" },
      },
      required: ["theme", "x", "y"],
      additionalProperties: false,
    },
    invalidArgsExample: { mapId: "map_id", theme: "volcano", x: 16, y: 11 },
    run(project: Project, args: Readonly<Record<string, unknown>>): ToolExecResult {
      const theme = args.theme as SceneTheme;
      if (!SCENE_THEMES.includes(theme)) throw new ToolError(`theme 은 ${SCENE_THEMES.join(" | ")} 중 하나여야 합니다`, { code: "bad-theme" });
      const mapId = String(args.mapId ?? "");
      const map = project.maps[mapId];
      if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found" });
      if (map.tilesetId !== "beodeul_city") {
        throw new ToolError(
          `build_scene_setting 은 버들항(beodeul_city) 맵 전용입니다 — 이 맵 칩셋은 ${map.tilesetId}. list_spatial_designs·stamp_object 로 이 칩셋의 오브젝트를 직접 찍으세요.`,
          { code: "tileset-not-supported" },
        );
      }
      const x = Number(args.x);
      const y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) {
        throw new ToolError(`좌표 (${args.x},${args.y}) 가 맵 ${map.width}×${map.height} 밖입니다`, { code: "out-of-map" });
      }

      // 다시 지으면 옛 무대의 보호 구역부터 걷는다 — 남겨 두면 이번 무대의 기물이 그 구역에 걸려 거절된다.
      map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes(SCENE_STAGE_TAG));
      const warnings: string[] = [];
      const built: string[] = [];
      const area = snapToMapEdge(map, clampRect(map, x - 12, y - 9, 25, 19));
      const p = new ScenePainter(project, map);
      const walkDef = WALKS[theme];
      const walk: Cell[] = walkDef
        ? Array.from({ length: walkDef.steps }, (_, i) => ({ x: x + STEP[walkDef.dir][0] * (i + 1), y: y + STEP[walkDef.dir][1] * (i + 1) }))
        : [];
      // 맵 이동 칸(transfer 도착·출구)은 몸체가 덮지 않고 기물도 서지 않는다.
      const passage = new Set([...protectedPassageCells(project, map).keys()].map((k) => { const [px, py] = k.split(",").map(Number); return py! * map.width + px!; }));
      const dryCells = new Set([y * map.width + x, y * map.width + x - 1, ...walk.map((c) => c.y * map.width + c.x), ...passage]);
      const corridors = CORRIDORS[theme].map((c) => clampRect(map, x + c.x, y + c.y, c.w, c.h));
      for (const i of dryCells) p.reserved.add(i);
      for (const r of corridors) for (let cy = r.y; cy < r.y + r.h; cy++) for (let cx = r.x; cx < r.x + r.w; cx++) p.reserved.add(cy * map.width + cx);
      const stage: Stage = { p, x, y, area, built, dry: (cx, cy) => p.inside(cx, cy) && dryCells.has(cy * map.width + cx) };

      let lavaTile: number | undefined;
      let sword: Cell | undefined;
      if (theme === "volcano") lavaTile = buildVolcano(stage).lavaTile;
      else if (theme === "lava_bridge") lavaTile = buildLavaBridge(stage).lavaTile;
      else if (theme === "poison_swamp") buildPoisonSwamp(stage);
      else sword = buildRuinsShrine(stage);
      void lavaTile;

      let swordTile: number | undefined;
      if (sword && sword.y >= 1 && sword.x < map.width) {
        // 성검 꽂힌 바위(1×2, 손 도트) — 모자이크 단 한가운데 칸. 위칸 = 칼자루·날(통행), 아래칸 = 바위(막힘).
        const target = project.tilesets[map.tilesetId]!;
        const nature = (project.tilesets[BEODEUL_NATURE_ID] ??= createBeodeulNatureTileset());
        if (nature.count < BEODEUL_NATURE.count) project.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset();
        const tr = translateTiles(project.tilesets[BEODEUL_NATURE_ID]!, target, new Set(BEODEUL_NATURE.swordStone));
        const [topTile, bottomTile] = BEODEUL_NATURE.swordStone.map((t) => tr.map.get(t)!);
        target.priority[topTile!] = "upper";
        target.passability[topTile!] = { up: true, down: true, left: true, right: true };
        target.priority[bottomTile!] = "lower";
        target.passability[bottomTile!] = { up: false, down: false, left: false, right: false };
        setLayerTileAt(map, 3, (sword.y - 1) * map.width + sword.x, topTile!);
        setLayerTileAt(map, 3, sword.y * map.width + sword.x, bottomTile!);
        swordTile = topTile;
        built.push("모자이크 한가운데 성검 꽂힌 바위");
      }
      built.push(`기물 ${p.stamped}점${p.dropped ? `(자리가 맞지 않아 뺀 기물 ${p.dropped}개)` : ""}`);

      // 무대 보호 구역 — 이벤트 칸 둘레 2칸과 동선(다리·둑길·참배로). 조수의 stamp_object·place_props 는 여기에 소품을 얹지 못한다
      // (sceneStageGuard). composed-layout 표식은 배치 품질 권고의 «빈 바닥 채우기» 를 끈다 — 그 권고가 비운 칸에 소품을 흩뿌리게 한다.
      const zones = [
        { name: "무대 초점", ...clampRect(map, x - 2, y - 2, 5, 5) },
        ...corridors.map((r) => ({ name: "무대 동선", ...r })),
      ];
      for (const z of zones) addMapLocation(map, { ...z, tags: [SCENE_STAGE_TAG, COMPOSED_LAYOUT_TAG], note: `build_scene_setting ${theme} 보호 구역 — 소품 금지` });

      const collapse = theme === "lava_bridge" && lavaTile !== undefined ? bridgeCollapse(map, x, y, lavaTile) : undefined;
      const blockedWalk = walk.filter((c, i) => !canMove(project, map, i === 0 ? x : walk[i - 1]!.x, i === 0 ? y : walk[i - 1]!.y, c.x, c.y));
      if (blockedWalk.length) warnings.push(`생존 걷기 길 막힘: ${blockedWalk.map((c) => `(${c.x},${c.y})`).join(" ")}`);
      const survivalWalk = walkDef && !blockedWalk.length
        ? { moves: walk.map(() => ({ kind: "move", dir: walkDef.dir })), cells: walk, end: walk[walk.length - 1]! }
        : undefined;
      // 성검을 뽑는 순간 바위 위칸(칼자루·날)을 그 칸 바닥 그림으로 덮는다 — 뽑았는데 칼이 바위에 그대로면 «뽑는 동작이 없다» 로
      // 감점(2026-10-18 jrpg_046 48점). 컷씬 changeTile 은 음수 타일을 0 으로 자르므로 «지우기» 대신 같은 바닥 칸을 쓴다.
      // raise 는 같은 칼 그림을 이벤트 칸(뽑는 인물이 선 칸) 바로 위에 찍는다 — 캐릭터 도트에 «검을 든 자세» 가 없어서,
      // 머리 위 칸에 칼이 솟아야 정지 화면에서 «치켜들었다» 가 읽힌다(2026-10-18 jrpg_046 48점 «치켜드는 동작 누락»).
      const swordPull = sword && swordTile !== undefined
        ? {
          cells: [{ x: sword.x, y: sword.y - 1, layer: "upper" as const, tile: layerTileAt(map, 1, (sword.y - 1) * map.width + sword.x) }],
          raise: { x, y: y - 1, layer: "upper" as const, tile: swordTile },
          stone: { x: sword.x, y: sword.y },
        }
        : undefined;
      return {
        summary: `무대 ${theme} → ${mapId} 이벤트 칸 (${x},${y}) 둘레 ${area.w}×${area.h}: ${built.join(" · ")}. 이제 show_map_region 으로 확인하고 (${x},${y}) 에 이벤트를 만든다 — 시작 칸 (${x - 1},${y}) 은 막혀 있지 않다. 바닥·기물은 이미 장소에 맞게 섰다 — 무대 초점·동선 ${zones.length}곳(scene-stage 로케이션)은 비워 둔 칸이라 stamp_object·place_props 가 거절하니, 소품을 더 흩뿌리지 않는다.${collapse ? ` 다리 붕괴 연출은 사망 분기에서 data.collapse.cells ${collapse.cells.length}칸에 changeTile{mapId,layer:"upper",x,y,tile} 을 적용한다(다리 그림이 상단 층이라 반드시 layer "upper" — 하단은 이미 용암이라 바꿔도 화면이 그대로다). 붕괴 직후 한 번 더 화면을 붉게 번쩍이면 틈이 눈에 띈다.` : ""}${survivalWalk ? ` 생존(무사 통과) 분기는 위험 색조(독=보라, 열풍·용암=붉은/푸른)·안개(weather fog)·위험 입자(smoke/fire, durationMs 4000, 서로 다른 2곳 이상)와 방어 효과(particles sparkle·magic target:"player" durationMs 4000)를 켠 상태에서 버팀 대사를 치고, 색조·안개를 끄지 않은 채로 moveActor{target:"player",moves:data.survivalWalk.moves,wait:true} 로 (${survivalWalk.end.x},${survivalWalk.end.y}) 까지 ${walk.length}칸 걸어 위험 구역을 먼저 건넌 뒤 마지막에 색조와 안개를 거둔다(걷기 전에 색조·안개를 먼저 끄거나 걷기와 동시에 끄면 통과 장면에 위험 효과가 사라져 감점된다).` : ""}${swordPull ? ` 성검을 뽑는 분기는 인물을 (${x},${y}) 에 고정(movement type:"fixed")해 바위 쪽(turn right)을 보게 하고 parallel[ flash white, shake, music se, particles sparkle(바위 칸) ] 와 함께 data.swordPull.cells 를 changeTile{mapId,layer:"upper",x,y,tile} 로 적용해 바위에서 칼을 없앤 뒤, 인물을 아래(turn down)로만 돌리고 data.swordPull.raise 를 같은 changeTile 로 찍어 머리 위 (${x},${y - 1}) 에 칼이 솟게 한다(주의: 인물에 move 나 jump 를 쓰면 2칸 앞으로 뛰어 성검 밑에서 이탈하므로 절대 쓰지 말고 turn 만 쓴다). 이어서 인물 위 sparkle + 금빛 tint + 황금빛 flash + 치켜드는 외침 대사로 맺는다.` : ""}`,
        data: { theme, mapId, focus: { x, y }, start: { x: x - 1, y }, ground: area, stamped: p.stamped, protectedZones: zones, ...(collapse ? { collapse } : {}), ...(survivalWalk ? { survivalWalk } : {}), ...(swordPull ? { swordPull } : {}) },
        ...(warnings.length ? { warnings } : {}),
      };
    },
  },
];
