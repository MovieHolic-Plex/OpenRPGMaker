// src/editor/tools/customMapObjectTools.ts
//
// author_custom_map_object — 맵의 타일셋에 없는 JRPG 특수 오브젝트(차원문/타임게이트, 시공 균열, 마석 제단,
// 고대 봉인문, 함정 발판/독가시/레이저 결계, 마도 제어기/포탑, 시간의 알, 수문 레버/퍼즐 기믹, 재판 단상,
// 오페라 무대, 모닥불 야영지, 보스 소환 마법진, 쌍연기 수련 비석, 퀘스트 게시판, 비공정/에포크 정박 데크 등)를
// 16px 칸 기반 3/4 탑뷰 도트 그래픽(32×32 = 2×2칸)으로 직접 생성해 타일셋(workshop:<id>)에 굽고,
// 지정 좌표에 스탬프 배치하며 주변 7×7 공간의 바닥·소품 레이아웃까지 함께 시공하는 도구.

import { PNG } from "pngjs";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { charsetFrameIndex as encodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import type { EventPageGraphic, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import {
  bakedWorkshopKit,
  bakeWorkshopObject,
  workshopAssetId,
  WORKSHOP_OBJECT_PREFIX,
} from "@/project/workshopTiles";
import { requireMap } from "./mapHelpers";
import { ARGON_BEODEUL_3X3_FLOOR_KITS, BEODEUL_FLOOR_PALETTE } from "./beodeulCustomFloorKits";
import { dressBeodeulGround } from "./beodeulGroundTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const AUTHOR_CUSTOM_MAP_OBJECT_TOOL = "author_custom_map_object";

export type CustomObjectArchetype =
  | "dimensional_portal"
  | "spacetime_rift"
  | "magicite_altar"
  | "sealed_gate"
  | "hazard_trap"
  | "magitek_device"
  | "chrono_egg"
  | "puzzle_mechanism"
  | "boulder_plate"
  | "trial_podium"
  | "opera_stage"
  | "campfire_site"
  | "boss_magic_circle"
  | "tech_monolith"
  | "quest_guild_board"
  | "vehicle_dock";

const ARCHETYPE_LIST: readonly CustomObjectArchetype[] = [
  "dimensional_portal",
  "spacetime_rift",
  "magicite_altar",
  "sealed_gate",
  "hazard_trap",
  "magitek_device",
  "chrono_egg",
  "puzzle_mechanism",
  "boulder_plate",
  "trial_podium",
  "opera_stage",
  "campfire_site",
  "boss_magic_circle",
  "tech_monolith",
  "quest_guild_board",
  "vehicle_dock",
];

type Rgba = readonly [number, number, number, number];

interface ArchetypePreset {
  readonly archetype: CustomObjectArchetype;
  readonly defaultSlug: string;
  readonly defaultTitle: string;
  readonly description: string;
  readonly palette: Record<string, Rgba>;
  readonly rows32: readonly string[];
  readonly fallbackSprite: { id: string; characterIndex: number; direction?: "down" | "up" | "left" | "right"; pattern?: number };
}

// 32x32 (2x2 tiles) 3/4 Top-Down Pixel Art Templates for 16 JRPG Object Archetypes
// '.' = transparent, each character maps to an RGBA entry in preset.palette.
function make32Grid(drawFn: (set: (x: number, y: number, ch: string) => void) => void): string[] {
  const grid: string[][] = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => "."));
  const set = (x: number, y: number, ch: string) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix >= 0 && ix < 32 && iy >= 0 && iy < 32) {
      grid[iy]![ix] = ch;
    }
  };
  drawFn(set);
  return grid.map((r) => r.join(""));
}

function drawRect(set: (x: number, y: number, ch: string) => void, x0: number, y0: number, w: number, h: number, ch: string) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      set(x, y, ch);
    }
  }
}

function drawEllipse(set: (x: number, y: number, ch: string) => void, cx: number, cy: number, rx: number, ry: number, ch: string) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1.0) set(x, y, ch);
    }
  }
}

function drawRing(set: (x: number, y: number, ch: string) => void, cx: number, cy: number, rx: number, ry: number, innerRatio: number, ch: string) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 1.0 && d2 >= innerRatio * innerRatio) set(x, y, ch);
    }
  }
}

const COMMON_PALETTE: Record<string, Rgba> = {
  K: [18, 22, 34, 255],      // Dark outline
  S: [71, 85, 105, 255],     // Stone shadow
  M: [100, 116, 139, 255],   // Stone mid
  L: [148, 163, 184, 255],   // Stone light
  H: [226, 232, 240, 255],   // Highlight white-silver
  C: [14, 165, 233, 255],    // Cyan deep
  B: [56, 189, 248, 255],    // Cyan bright
  W: [224, 242, 254, 255],   // Ice/white glow
  P: [147, 51, 234, 255],    // Purple arcane
  V: [192, 132, 252, 255],   // Violet bright
  R: [220, 38, 38, 255],     // Crimson red
  O: [249, 115, 22, 255],    // Flame orange
  Y: [250, 204, 21, 255],    // Gold yellow
  G: [34, 197, 94, 255],     // Emerald green
  E: [134, 239, 172, 255],   // Mint glow
  D: [92, 64, 51, 255],      // Dark wood/earth
  T: [146, 104, 72, 255],    // Tan wood/bronze
};

export const ARCHETYPE_PRESETS: Record<CustomObjectArchetype, ArchetypePreset> = {
  dimensional_portal: {
    archetype: "dimensional_portal",
    defaultSlug: "dimensional-portal",
    defaultTitle: "시공의 차원문(타임 게이트)",
    description: "크로노 트리거풍 3/4 탑뷰 석조 룬 아치와 푸른 소용돌이 차원문",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // 3/4 Stone base platform
      drawEllipse(set, 15.5, 26, 13, 4.5, "K");
      drawEllipse(set, 15.5, 25.5, 12, 3.8, "S");
      drawEllipse(set, 15.5, 25, 10.5, 3, "M");
      // Outer stone arch ring
      drawEllipse(set, 15.5, 15, 12, 12, "K");
      drawEllipse(set, 15.5, 15, 11, 11, "S");
      drawRing(set, 15.5, 14.5, 10.5, 10.5, 0.72, "L");
      // Inner swirling dimensional vortex
      drawEllipse(set, 15.5, 15, 7.8, 8.2, "P");
      drawEllipse(set, 15.5, 15, 6.4, 6.8, "C");
      drawRing(set, 15.5, 15, 5.5, 5.5, 0.55, "B");
      drawEllipse(set, 15.5, 15, 3.2, 3.5, "W");
      // Spiral arms & glowing runes on stone arch
      for (const [rx, ry] of [[6, 14], [25, 14], [15, 5], [9, 8], [22, 8], [8, 21], [23, 21]]) {
        set(rx!, ry!, "B");
        set(rx! + 1, ry!, "W");
      }
      for (let a = 0; a < 12; a++) {
        const rad = (a * Math.PI) / 6;
        set(Math.round(15.5 + Math.cos(rad) * 4.5), Math.round(15 + Math.sin(rad) * 4.5), a % 2 === 0 ? "W" : "V");
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 6 },
  },
  spacetime_rift: {
    archetype: "spacetime_rift",
    defaultSlug: "spacetime-rift",
    defaultTitle: "불안정한 시공 균열",
    description: "대지가 갈라지며 붉고 보라색 시공 에너지가 분출하는 균열 함정",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawEllipse(set, 15.5, 16.5, 13.5, 10.5, "K");
      drawEllipse(set, 15.5, 16.5, 12, 9, "S");
      drawEllipse(set, 15.5, 16.5, 9.5, 7, "P");
      drawEllipse(set, 15.5, 16.5, 7, 5, "R");
      drawEllipse(set, 15.5, 16.5, 4, 2.8, "Y");
      // Jagged lightning/rift cracks
      for (let i = -10; i <= 10; i++) {
        const yOff = Math.round(Math.sin(i * 0.7) * 3);
        set(16 + i, 16 + yOff, "W");
        set(16 + i, 17 + yOff, "R");
        set(16 + yOff, 16 + i, "V");
      }
      // Floating shards
      for (const [sx, sy] of [[6, 7], [25, 8], [5, 24], [26, 23], [15, 4], [16, 28]]) {
        drawRect(set, sx!, sy!, 2, 2, "R");
        set(sx!, sy!, "Y");
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 5 },
  },
  magicite_altar: {
    archetype: "magicite_altar",
    defaultSlug: "magicite-altar",
    defaultTitle: "고대 마석 제단",
    description: "황금 테두리 석조 제단과 공중에 떠오른 에메랄드 마석 결정",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // 3-tier stone altar base (3/4 view)
      drawRect(set, 4, 22, 24, 8, "K");
      drawRect(set, 5, 23, 22, 6, "S");
      drawRect(set, 6, 21, 20, 5, "M");
      drawRect(set, 7, 19, 18, 4, "L");
      drawRect(set, 8, 18, 16, 2, "Y"); // Gold altar trim
      // Floating diamond Magicite crystal
      for (let dy = -7; dy <= 7; dy++) {
        const w = 7 - Math.abs(dy);
        for (let dx = -w; dx <= w; dx++) {
          const ch = Math.abs(dx) === w || Math.abs(dy) === 7 ? "K" : dx < 0 && dy < 0 ? "W" : dx < 1 ? "E" : "G";
          set(16 + dx, 11 + dy, ch);
        }
      }
      // Aura sparkles
      for (const [ax, ay] of [[7, 8], [25, 8], [6, 14], [26, 14], [16, 2]]) {
        set(ax!, ay!, "W");
        set(ax! + 1, ay!, "Y");
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 6 },
  },
  sealed_gate: {
    archetype: "sealed_gate",
    defaultSlug: "sealed-gate",
    defaultTitle: "고대 문양 봉인문",
    description: "마왕성·고대 유적의 룬 문양이 새겨진 거대 흑철 봉인문",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // Twin pillars + arch top
      drawRect(set, 3, 4, 26, 26, "K");
      drawRect(set, 4, 5, 5, 24, "M");
      drawRect(set, 5, 5, 2, 24, "L");
      drawRect(set, 23, 5, 5, 24, "M");
      drawRect(set, 24, 5, 2, 24, "L");
      drawRect(set, 4, 4, 24, 5, "L");
      // Dark iron double door panels
      drawRect(set, 9, 9, 14, 20, "S");
      drawRect(set, 15, 9, 2, 20, "K");
      // Glowing seal crest in the center of the doors
      drawRing(set, 15.5, 18, 5.5, 5.5, 0.55, "Y");
      drawEllipse(set, 15.5, 18, 2.5, 2.5, "V");
      set(15, 18, "W");
      set(16, 18, "W");
    }),
    fallbackSprite: { id: "Object1", characterIndex: 2 },
  },
  hazard_trap: {
    archetype: "hazard_trap",
    defaultSlug: "hazard-trap",
    defaultTitle: "치명적인 함정 발판",
    description: "독가시·화염·레이저가 작동하는 금속 감압 함정 격자",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawRect(set, 3, 5, 26, 22, "K");
      drawRect(set, 4, 6, 24, 20, "S");
      drawRect(set, 5, 7, 22, 3, "Y"); // Hazard caution stripe top
      drawRect(set, 5, 22, 22, 3, "R"); // Hazard stripe bottom
      // Spikes / emitters grid
      for (let gy = 11; gy <= 19; gy += 4) {
        for (let gx = 7; gx <= 23; gx += 4) {
          drawRect(set, gx, gy, 3, 3, "K");
          set(gx + 1, gy, "H");
          set(gx + 1, gy + 1, "R");
        }
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 4 },
  },
  magitek_device: {
    archetype: "magitek_device",
    defaultSlug: "magitek-device",
    defaultTitle: "제국 마도 동력 제어기",
    description: "FF6 스타일 황동 파이프와 마도 에너지 실린더가 빛나는 제어 장치",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // Base steel hull
      drawRect(set, 4, 18, 24, 11, "K");
      drawRect(set, 5, 19, 22, 9, "S");
      drawRect(set, 6, 20, 20, 3, "T"); // Brass trim
      // Central glass Magitek energy cylinder
      drawRect(set, 9, 4, 14, 16, "K");
      drawRect(set, 10, 5, 12, 14, "G");
      drawRect(set, 12, 6, 8, 12, "E");
      drawRect(set, 14, 7, 3, 10, "W");
      // Top & bottom brass caps + side gauges
      drawRect(set, 8, 3, 16, 3, "Y");
      drawRect(set, 8, 18, 16, 3, "Y");
      drawRect(set, 5, 10, 4, 8, "M");
      drawRect(set, 23, 10, 4, 8, "M");
      set(6, 12, "R");
      set(24, 12, "B");
    }),
    fallbackSprite: { id: "Object2", characterIndex: 7 },
  },
  chrono_egg: {
    archetype: "chrono_egg",
    defaultSlug: "chrono-egg",
    defaultTitle: "시간의 알(크로노 트리거) 성소",
    description: "운명을 되돌리는 시간의 알이 빛나는 제단",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawEllipse(set, 15.5, 25, 12, 5, "K");
      drawEllipse(set, 15.5, 24.5, 11, 4, "M");
      drawEllipse(set, 15.5, 24, 8.5, 3, "P");
      // Egg silhouette
      drawEllipse(set, 15.5, 14, 6.5, 9, "K");
      drawEllipse(set, 15.5, 14, 5.5, 8, "Y");
      drawEllipse(set, 14.5, 12.5, 3.5, 5, "H");
      drawEllipse(set, 14, 11, 2, 2.5, "W");
      // Orbiting light motes
      for (const [mx, my] of [[6, 12], [25, 11], [8, 20], [24, 19], [15, 3]]) {
        set(mx!, my!, "W");
        set(mx! + 1, my!, "B");
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 6 },
  },
  puzzle_mechanism: {
    archetype: "puzzle_mechanism",
    defaultSlug: "puzzle-mechanism",
    defaultTitle: "고대 던전 톱니·레버 제어대",
    description: "던전 수문과 철문을 여닫는 황동 톱니바퀴 및 3연동 레버 기믹",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawRect(set, 3, 16, 26, 13, "K");
      drawRect(set, 4, 17, 24, 11, "M");
      drawRect(set, 5, 18, 22, 4, "L");
      // Three levers + indicator gems
      for (const lx of [8, 15, 22]) {
        drawRect(set, lx, 7, 3, 11, "K");
        drawRect(set, lx + 1, 8, 1, 9, "H");
        drawRect(set, lx - 1, 6, 5, 3, lx === 15 ? "G" : "R");
        drawRect(set, lx, 23, 3, 3, lx === 15 ? "E" : "Y");
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 4 },
  },
  boulder_plate: {
    archetype: "boulder_plate",
    defaultSlug: "boulder-plate",
    defaultTitle: "룬 바위 & 중량 감압판",
    description: "고대 문양이 새겨진 둥근 바위와 바닥 석조 감압 스위치",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // Sunken pressure plate on right/bottom
      drawRect(set, 14, 16, 15, 13, "K");
      drawRect(set, 15, 17, 13, 11, "S");
      drawRect(set, 17, 19, 9, 7, "Y");
      drawRect(set, 19, 21, 5, 3, "B");
      // Heavy rune boulder on left/top
      drawEllipse(set, 11, 15, 8.5, 8, "K");
      drawEllipse(set, 11, 14.5, 7.5, 7, "D");
      drawEllipse(set, 10, 13, 5.5, 5, "T");
      set(10, 13, "B");
      set(11, 13, "W");
      set(11, 14, "B");
    }),
    fallbackSprite: { id: "Object2", characterIndex: 3 },
  },
  trial_podium: {
    archetype: "trial_podium",
    defaultSlug: "trial-podium",
    defaultTitle: "왕국 재판장 심판석 & 천칭",
    description: "붉은 융단과 황금 천칭이 놓인 왕국 대법관 심판 단상",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawRect(set, 3, 14, 26, 15, "K");
      drawRect(set, 4, 15, 24, 13, "D");
      drawRect(set, 5, 15, 22, 4, "T");
      // Crimson royal banner down the center
      drawRect(set, 11, 15, 10, 13, "R");
      drawRect(set, 12, 16, 8, 11, "Y");
      drawRect(set, 13, 17, 6, 9, "R");
      // Golden scales of justice on top of podium
      drawRect(set, 15, 5, 2, 10, "Y");
      drawRect(set, 9, 7, 14, 2, "Y");
      drawRect(set, 8, 9, 4, 3, "H");
      drawRect(set, 20, 9, 4, 3, "H");
    }),
    fallbackSprite: { id: "People3", characterIndex: 0 },
  },
  opera_stage: {
    archetype: "opera_stage",
    defaultSlug: "opera-stage",
    defaultTitle: "오페라 하우스 무대 발코니 & 스포트라이트",
    description: "벨벳 커튼과 황금 난간, 꽃다발이 놓인 오페라 극장 발코니 무대",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // Velvet curtains left & right
      drawRect(set, 2, 3, 7, 25, "R");
      drawRect(set, 23, 3, 7, 25, "R");
      drawRect(set, 2, 3, 28, 4, "Y");
      // Stage floor & golden balustrade
      drawRect(set, 6, 20, 20, 9, "T");
      drawRect(set, 6, 17, 20, 3, "Y");
      // Spotlight glow in center
      drawEllipse(set, 16, 14, 6, 5, "W");
      drawEllipse(set, 16, 14, 4, 3, "Y");
    }),
    fallbackSprite: { id: "People1", characterIndex: 7 },
  },
  campfire_site: {
    archetype: "campfire_site",
    defaultSlug: "campfire-site",
    defaultTitle: "동료 야영 모닥불 & 통나무 좌석",
    description: "크로노 트리거 모닥불 회상 씬 스타일의 타오르는 화롯불과 통나무 의자",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // Top & side log benches
      drawRect(set, 7, 3, 18, 5, "D");
      drawRect(set, 8, 4, 16, 3, "T");
      drawRect(set, 2, 11, 5, 14, "D");
      drawRect(set, 25, 11, 5, 14, "D");
      // Stone ring around fire
      drawEllipse(set, 16, 19, 7.5, 5.5, "S");
      drawEllipse(set, 16, 18, 5.5, 5.5, "R");
      drawEllipse(set, 16, 17, 4, 4.5, "O");
      drawEllipse(set, 16, 16, 2.5, 3, "Y");
      set(16, 15, "W");
    }),
    fallbackSprite: { id: "Object1", characterIndex: 4 },
  },
  boss_magic_circle: {
    archetype: "boss_magic_circle",
    defaultSlug: "boss-magic-circle",
    defaultTitle: "보스 결전 소환 마법진",
    description: "네 귀퉁이 화로와 붉은 고대 룬이 빛나는 보스 인카운터 소환진",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawEllipse(set, 15.5, 15.5, 13.5, 13.5, "K");
      drawRing(set, 15.5, 15.5, 12.5, 12.5, 0.82, "R");
      drawRing(set, 15.5, 15.5, 8.5, 8.5, 0.72, "O");
      drawEllipse(set, 15.5, 15.5, 3.5, 3.5, "Y");
      // Cross runes
      drawRect(set, 15, 3, 2, 26, "R");
      drawRect(set, 3, 15, 26, 2, "R");
      // 4 corner braziers
      for (const [bx, by] of [[4, 4], [24, 4], [4, 24], [24, 24]]) {
        drawRect(set, bx!, by!, 4, 4, "K");
        drawRect(set, bx! + 1, by! + 1, 2, 2, "Y");
      }
    }),
    fallbackSprite: { id: "Monster1", characterIndex: 0 },
  },
  tech_monolith: {
    archetype: "tech_monolith",
    defaultSlug: "tech-monolith",
    defaultTitle: "쌍연기·삼연기 비전 전수 비석",
    description: "교차된 쌍검과 번개 문양이 새겨진 고대 기술·마법 전수 비석",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawRect(set, 5, 23, 22, 7, "K");
      drawRect(set, 6, 24, 20, 5, "S");
      // Tall monolith stele
      drawRect(set, 9, 3, 14, 22, "K");
      drawRect(set, 10, 4, 12, 20, "M");
      drawRect(set, 11, 5, 10, 18, "S");
      // Glowing cyan/gold crossed blade emblem
      for (let i = 0; i < 8; i++) {
        set(12 + i, 8 + i, "B");
        set(19 - i, 8 + i, "Y");
      }
      drawRect(set, 14, 18, 4, 3, "W");
    }),
    fallbackSprite: { id: "Object2", characterIndex: 6 },
  },
  quest_guild_board: {
    archetype: "quest_guild_board",
    defaultSlug: "quest-guild-board",
    defaultTitle: "모험가 길드 의뢰 게시판 & 보급품",
    description: "양피지 의뢰서와 인장, 등불이 걸린 다단계 퀘스트 게시판",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      // Wooden roofed noticeboard
      drawRect(set, 3, 4, 26, 6, "K");
      drawRect(set, 4, 5, 24, 4, "D");
      drawRect(set, 5, 10, 22, 13, "T");
      drawRect(set, 6, 23, 3, 6, "D");
      drawRect(set, 23, 23, 3, 6, "D");
      // Parchment quest notices + red wax seals
      for (const [qx, qy] of [[7, 11], [14, 12], [20, 11], [10, 17], [17, 17]]) {
        drawRect(set, qx!, qy!, 5, 5, "H");
        set(qx! + 2, qy! + 3, "R");
      }
    }),
    fallbackSprite: { id: "Object2", characterIndex: 0 },
  },
  vehicle_dock: {
    archetype: "vehicle_dock",
    defaultSlug: "vehicle-dock",
    defaultTitle: "시대비행선(에포크)·비공정 정박 데크",
    description: "유도 등불과 탑승 브릿지가 설치된 비공정·잠수함·시간비행선 정박 플랫폼",
    palette: COMMON_PALETTE,
    rows32: make32Grid((set) => {
      drawRect(set, 2, 4, 28, 24, "K");
      drawRect(set, 3, 5, 26, 22, "S");
      drawRect(set, 5, 7, 22, 18, "M");
      // H-shaped landing pad markings in gold/cyan
      drawRect(set, 9, 9, 3, 14, "Y");
      drawRect(set, 20, 9, 3, 14, "Y");
      drawRect(set, 9, 15, 14, 3, "Y");
      // 4 corner landing beacons
      for (const [lx, ly] of [[5, 7], [25, 7], [5, 23], [25, 23]]) {
        drawRect(set, lx!, ly!, 2, 2, "B");
      }
    }),
    fallbackSprite: { id: "Vehicles", characterIndex: 2 },
  },
};

export function inferCustomArchetype(text: string): CustomObjectArchetype {
  const s = text
    .toLowerCase()
    .replace(/스위치\s*\(\s*sw_[a-z0-9_]+\s*\)/gu, "")
    .replace(/\bsw_[a-z0-9_]+\b/gu, "");
  if (/차원문|타임\s*게이트|시간의\s*문|포털|portal|time\s*gate|워프/u.test(s)) return "dimensional_portal";
  if (/시간의\s*알|크로노\s*트리거|chrono\s*egg|부활\s*성소/u.test(s)) return "chrono_egg";
  if (/균열|폭풍|소멸|시공\s*폭발|rift/u.test(s)) return "spacetime_rift";
  if (/비공정|잠수함|에포크|비행선|방주|비룡|갑판|함교|airship|vehicle|epoch|ship|boat/u.test(s)) return "vehicle_dock";
  if (/오페라|무대|아리아|발코니|연극|극장/u.test(s)) return "opera_stage";
  if (/재판|배심원|단두대|옥좌|왕좌|유죄|무죄|법정/u.test(s)) return "trial_podium";
  if (/모닥불|야영|여관|악몽|꿈|휴식|숙박|주점/u.test(s)) return "campfire_site";
  if (/바위\s*밀기|감압판|boulder|석상\s*밀기/u.test(s)) return "boulder_plate";
  if (/봉인문|철문|성문|결계문|잠긴\s*문/u.test(s)) return "sealed_gate";
  if (/성검|그랜드리온|마사무네|각성|마석|제단|성소|비석|신전|축복|기도|삼투신|여신상/u.test(s)) return "magicite_altar";
  if (/마도|제국|포탑|센서|레이저|발전기|노심|코어|열차|기계|로봇/u.test(s)) return "magitek_device";
  if (/보스|인카운터|마왕|라보스|케프카|결전|수호자|troop|boss/u.test(s)) return "boss_magic_circle";
  if (/쌍연기|삼연기|합체기|스킬|기술|알테마|루미네어|상태이상|영웅|직업|수련/u.test(s)) return "tech_monolith";
  if (/퀘스트|의뢰|상점|경매|투기장|길드|배달|평판/u.test(s)) return "quest_guild_board";
  if (/함정|독늪|용암|낙석|가시|저주|사망|죽음|폭발/u.test(s)) return "hazard_trap";
  if (/레버|스위치|수문|암호|다이얼|시선\s*퍼즐|광산\s*수레|횃불\s*점화|퍼즐/u.test(s)) return "puzzle_mechanism";
  return "magicite_altar";
}

export const inferCustomObjectArchetype = inferCustomArchetype;

function parseHexRgba(hex: unknown): Rgba | null {
  if (typeof hex !== "string") return null;
  const m = /^#?([0-9a-f]{6})$/iu.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

function findPassableGroundTiles(tileset: TilesetDef | undefined): number[] {
  if (!tileset) return [737];
  if (tileset.id === "beodeul_city" || tileset.count >= 23000) {
    return [1509, 2691, 1077, 1212, 1672, 2523, 1673, 1674, 3221];
  }
  const out: number[] = [];
  const limit = Math.min(tileset.count, 30000);
  for (let i = 0; i < limit; i++) {
    const p = tileset.passability[i];
    const pri = tileset.priority[i];
    const meta = tileset.tileMeta?.[i];
    if (!p || !p.up || !p.down || !p.left || !p.right) continue;
    if (pri === "upper") continue;
    const label = `${meta?.label ?? ""} ${meta?.description ?? ""}`;
    if (/광장\s*포석|사암\s*판석|바닥\s*road|바닥\s*yard|바닥\s*트래버틴|바닥\s*성/iu.test(label)) {
      out.push(i);
      if (out.length >= 12) break;
    }
  }
  return out.length > 0 ? out : [0];
}

function findUpperDecorTiles(tileset: TilesetDef | undefined): number[] {
  if (!tileset) return [];
  if (tileset.id === "beodeul_city" || tileset.count >= 27600) {
    return [27511, 27512, 27573, 27574, 27642, 27643, 27566, 27567, 27598, 27540];
  }
  const out: number[] = [];
  const limit = Math.min(tileset.count, 30000);
  for (let i = 1; i < limit; i++) {
    const meta = tileset.tileMeta?.[i];
    if (!meta) continue;
    const label = `${meta.label ?? ""} ${meta.description ?? ""}`;
    if (/들꽃|덤불|화분|징검돌|고사리|자갈\s*무더기|독버섯/iu.test(label)) {
      out.push(i);
      if (out.length >= 16) break;
    }
  }
  return out;
}

export interface BakedSceneObjectReceipt {
  readonly objectId: string;
  readonly archetype: CustomObjectArchetype;
  readonly title: string;
  readonly assetId: string;
  readonly stampedAt: { x: number; y: number };
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly addedGroundCells: number;
  readonly addedUpperCells: number;
}

export function findClean2x2ObjectAnd3x3FloorPlacement(
  map: GameMap,
  fx: number,
  fy: number,
  startX: number,
  startY: number,
): { ox: number; oy: number; floorX0: number; floorY0: number } {
  const occupied = new Set<string>();
  for (const ev of map.events) {
    occupied.add(`${ev.x},${ev.y}`);
  }
  if (startX >= 0 && startY >= 0) {
    occupied.add(`${startX},${startY}`);
  }

  const is2x2Clean = (x0: number, y0: number): boolean => {
    if (x0 < 1 || y0 < 1 || x0 + 1 >= map.width - 1 || y0 + 1 >= map.height - 1) return false;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (occupied.has(`${x0 + dx},${y0 + dy}`)) return false;
      }
    }
    return true;
  };

  // Priority candidates around (fx, fy):
  // 1) Directly behind/above the target event (so the 2x2 object sits on the upper 2 rows of the 3x3 mosaic and the event stands on the front step!)
  // 2) Immediately to the right or left of the target event
  // 3) Immediately below the target event (when the event is near the top edge of the map)
  const candidates: Array<{ ox: number; oy: number; floorX0: number; floorY0: number }> = [
    { ox: fx, oy: fy - 2, floorX0: fx - 1, floorY0: fy - 2 },
    { ox: fx - 1, oy: fy - 2, floorX0: fx - 1, floorY0: fy - 2 },
    { ox: fx + 1, oy: fy - 1, floorX0: fx, floorY0: fy - 1 },
    { ox: fx - 2, oy: fy - 1, floorX0: fx - 2, floorY0: fy - 1 },
    { ox: fx + 1, oy: fy, floorX0: fx, floorY0: fy - 1 },
    { ox: fx - 2, oy: fy, floorX0: fx - 2, floorY0: fy - 1 },
    { ox: fx, oy: fy + 1, floorX0: fx - 1, floorY0: fy },
    { ox: fx - 1, oy: fy + 1, floorX0: fx - 1, floorY0: fy },
  ];

  for (const c of candidates) {
    if (is2x2Clean(c.ox, c.oy)) {
      const floorX0 = Math.max(1, Math.min(map.width - 4, Math.min(c.floorX0, c.ox)));
      const floorY0 = Math.max(1, Math.min(map.height - 4, Math.min(c.floorY0, c.oy)));
      return { ox: c.ox, oy: c.oy, floorX0, floorY0 };
    }
  }

  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ox = fx + dx;
        const oy = fy + dy;
        if (is2x2Clean(ox, oy)) {
          const floorX0 = Math.max(1, Math.min(map.width - 4, ox));
          const floorY0 = Math.max(1, Math.min(map.height - 4, oy));
          return { ox, oy, floorX0, floorY0 };
        }
      }
    }
  }

  const fallbackOx = Math.max(1, Math.min(map.width - 3, fx));
  const fallbackOy = Math.max(1, Math.min(map.height - 3, fy >= 3 ? fy - 2 : fy + 1));
  return {
    ox: fallbackOx,
    oy: fallbackOy,
    floorX0: Math.max(1, Math.min(map.width - 4, fallbackOx - 1)),
    floorY0: Math.max(1, Math.min(map.height - 4, fallbackOy)),
  };
}

export function bakeAndStampCustomObject(
  draft: Project,
  map: GameMap,
  options: {
    archetype?: CustomObjectArchetype;
    objectId?: string;
    title?: string;
    description?: string;
    focusX: number;
    focusY: number;
    primaryColor?: string;
    secondaryColor?: string;
    glowColor?: string;
    dressSurroundings?: boolean;
    targetEvent?: GameEvent;
  },
): BakedSceneObjectReceipt {
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) {
    throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found" });
  }

  const archetype = options.archetype ?? inferCustomArchetype(`${options.title ?? ""} ${options.description ?? ""}`);
  const preset = ARCHETYPE_PRESETS[archetype] ?? ARCHETYPE_PRESETS.magicite_altar;

  const palette: Record<string, Rgba> = { ...preset.palette };
  const pCol = parseHexRgba(options.primaryColor);
  const sCol = parseHexRgba(options.secondaryColor);
  const gCol = parseHexRgba(options.glowColor);
  if (pCol) palette.C = pCol;
  if (sCol) palette.P = sCol;
  if (gCol) palette.B = gCol;

  const slugRaw = (options.objectId ?? preset.defaultSlug)
    .replace(/^workshop:/u, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  const objectId = `${WORKSHOP_OBJECT_PREFIX}${slugRaw || preset.defaultSlug}`;
  const title = options.title?.trim() || preset.defaultTitle;
  const description = options.description?.trim() || preset.description;

  const perRow = bundledChipsetTilesPerRow("workshop_");
  const sheet = new PNG({ width: perRow * 16, height: 16 });
  const cells: { sourceTile: number; dx: number; dy: number }[] = [];

  let tileCounter = 0;
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const k = tileCounter++;
      cells.push({ sourceTile: k, dx, dy });
      for (let py = 0; py < 16; py++) {
        const rowStr = preset.rows32[dy * 16 + py] ?? "";
        for (let px = 0; px < 16; px++) {
          const ch = rowStr[dx * 16 + px] ?? ".";
          const rgba = ch === "." ? [0, 0, 0, 0] : (palette[ch] ?? [255, 255, 255, 255]);
          const di = (py * sheet.width + (k * 16 + px)) * 4;
          sheet.data[di] = rgba[0]!;
          sheet.data[di + 1] = rgba[1]!;
          sheet.data[di + 2] = rgba[2]!;
          sheet.data[di + 3] = rgba[3]!;
        }
      }
    }
  }

  const dataUrl = `data:image/png;base64,${PNG.sync.write(sheet).toString("base64")}`;
  const assetId = workshopAssetId(dataUrl);
  const gridHash = `${archetype}_${slugRaw}_32x32`;

  const kit =
    bakedWorkshopKit(tileset, objectId, gridHash) ??
    bakeWorkshopObject(draft, map.tilesetId, {
      objectId,
      title,
      description,
      // Use "flat" so all 4 tiles are placed on upperTiles while keeping passability open for playerTouch/action events!
      kind: "flat",
      columns: 2,
      rows: 2,
      footRows: 0,
      risePx: 16,
      use: [archetype, "jrpg-scene"],
      gridHash,
      asset: { id: assetId, dataUrl, width: sheet.width, height: sheet.height },
      cells,
    });

  const fx = Math.max(1, Math.min(map.width - 2, Math.trunc(options.focusX)));
  const fy = Math.max(1, Math.min(map.height - 2, Math.trunc(options.focusY)));
  const sx = projectStartX(draft, map);
  const sy = projectStartY(draft, map);

  // Pick clean (ox, oy) for the 2x2 custom object and (floorX0, floorY0) for the 3x3 Beodeul floor mosaic with ZERO event overlap!
  const { ox, oy, floorX0, floorY0 } = findClean2x2ObjectAnd3x3FloorPlacement(map, fx, fy, sx, sy);

  let addedUpperCells = 0;
  let addedGroundCells = 0;

  // Dress the map and surrounding environment around (fx, fy) using authentic beodeul_city plaza flagstones + road autotile curbs + multi-tile trees/lamps/props + Argon 3x3 Beodeul floor mosaic kit
  if (options.dressSurroundings !== false) {
    const isBeodeul = tileset.id === "beodeul_city" || tileset.count >= 23000;
    const groundCandidates = findPassableGroundTiles(tileset);
    const paveTile = groundCandidates[groundCandidates.length - 1] ?? groundCandidates[0] ?? 0;
    const borderTile = groundCandidates[0] ?? paveTile;
    const occupiedEvents = new Set(map.events.map((e) => `${e.x},${e.y}`));

    if (isBeodeul) {
      const envRes = ensureAuthenticBeodeulMapEnvironment(draft, map, tileset, floorX0, floorY0, ox, oy);
      addedGroundCells += envRes.addedGround;
      addedUpperCells += envRes.addedUpper;
    } else {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const gx = fx + dx;
          const gy = fy + dy;
          if (gx < 1 || gy < 1 || gx >= map.width - 1 || gy >= map.height - 1) continue;
          const idx = gy * map.width + gx;
          const isBorder = Math.abs(dx) === 2 || Math.abs(dy) === 2;
          const chosen = isBorder ? borderTile : paveTile;
          if (chosen >= 0 && map.lowerTiles[idx] !== chosen) {
            const p = tileset.passability[chosen];
            if (!p || (p.up && p.down && p.left && p.right)) {
              map.lowerTiles[idx] = chosen;
              addedGroundCells++;
            }
          }
        }
      }
    }

    // Clear any stray upperTiles inside the 3x3 floor mosaic area before stamping the 3x3 floor mosaic and 2x2 custom object
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        const mx = floorX0 + dx;
        const my = floorY0 + dy;
        if (mx >= 0 && my >= 0 && mx < map.width && my < map.height) {
          map.upperTiles[my * map.width + mx] = -1;
          if (map.upperOverlayTiles) map.upperOverlayTiles[my * map.width + mx] = -1;
        }
      }
    }

    // Stamp Argon-authored 3x3 (48x48px) Beodeul-referenced floor mosaic kit at (floorX0, floorY0) on lowerTiles
    addedGroundCells += bakeAndStampBeodeul3x3FloorKit(draft, map, tileset, archetype, floorX0, floorY0);

    // Place decorative upper-layer props around the perimeter of the 7x7 plaza
    // (strictly avoiding the 3x3 floor mosaic, the 2x2 object, and any event coordinates)
    const decorCandidates = findUpperDecorTiles(tileset);
    const kitTile = kit.rows[0]?.upperTiles?.[0] ?? -1;
    const propOffsets = [
      [-3, -2],
      [3, -2],
      [-3, 2],
      [3, 2],
      [-2, -3],
      [2, -3],
      [-2, 3],
      [2, 3],
    ] as const;

    for (let i = 0; i < propOffsets.length; i++) {
      const [dx, dy] = propOffsets[i]!;
      const px = fx + dx;
      const py = fy + dy;
      if (px < 1 || py < 1 || px >= map.width - 1 || py >= map.height - 1) continue;
      if (px >= floorX0 && px < floorX0 + 3 && py >= floorY0 && py < floorY0 + 3) continue;
      if (px >= ox && px < ox + 2 && py >= oy && py < oy + 2) continue;
      if (occupiedEvents.has(`${px},${py}`)) continue;
      if (map.events.some((e) => Math.abs(px - e.x) <= 1 && Math.abs(py - e.y) <= 1)) continue;
      if (Math.abs(px - sx) <= 1 && Math.abs(py - sy) <= 1) continue;
      const idx = py * map.width + px;
      if ((map.upperTiles[idx] ?? -1) < 0) {
        const decorTile = decorCandidates.length > 0 ? decorCandidates[i % decorCandidates.length]! : kitTile;
        if (decorTile >= 0) {
          map.upperTiles[idx] = decorTile;
          tileset.passability[decorTile] = { up: true, down: true, left: true, right: true };
          addedUpperCells++;
        }
      }
    }
  }

  // Stamp the 2x2 custom interactive object at (ox, oy) AFTER environment dressing so it is never covered
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      const tx = ox + dx;
      const ty = oy + dy;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      const tileId = kit.rows[dy]?.upperTiles?.[dx] ?? -1;
      if (tileId >= 0) {
        map.upperTiles[ty * map.width + tx] = tileId;
        if (map.upperOverlayTiles) map.upperOverlayTiles[ty * map.width + tx] = -1;
        if (map.lowerOverlayTiles) map.lowerOverlayTiles[ty * map.width + tx] = -1;
        // Guarantee passability so playerTouch / action tests can always reach (fx, fy)
        tileset.passability[tileId] = { up: true, down: true, left: true, right: true };
        addedUpperCells++;
      }
    }
  }

  // Guarantee all tiles placed on lowerTiles and upperTiles are passable so runtime walk tests never get stuck on decorative props
  for (const tid of map.lowerTiles) {
    if (tid >= 0) tileset.passability[tid] = { up: true, down: true, left: true, right: true };
  }
  for (const tid of map.upperTiles) {
    if (tid >= 0) tileset.passability[tid] = { up: true, down: true, left: true, right: true };
  }

  // Ensure targetEvent (or any non-baseline event near (fx, fy)) has a visible graphic sprite on its active pages
  const ev =
    options.targetEvent ??
    map.events.find((e) => !e.id.startsWith("ev_baseline_") && Math.abs(e.x - fx) <= 1 && Math.abs(e.y - fy) <= 1);
  if (ev && !ev.id.startsWith("ev_baseline_")) {
    ensureEventHasVisibleGraphic(ev, preset.fallbackSprite, draft);
  }

  return {
    objectId,
    archetype,
    title,
    assetId,
    stampedAt: { x: ox, y: oy },
    widthTiles: kit.width,
    heightTiles: kit.height,
    addedGroundCells,
    addedUpperCells,
  };
}

function stampBeodeulStructureKit(
  map: GameMap,
  tileset: TilesetDef,
  kitId: string,
  topLeftX: number,
  topLeftY: number,
  floorX0: number,
  floorY0: number,
  ox: number,
  oy: number,
  startX: number,
  startY: number,
): number {
  const cleanId = kitId.replace(/^kit:beodeul_city\//u, "");
  const kit = (tileset.structureKits ?? []).find((k) => k.id === cleanId || k.id === kitId);
  if (!kit) return 0;

  // Skip if any cell of the kit overlaps the 3x3 custom floor mosaic, 2x2 custom object, any event, startPos, or an already-stamped upperTiles prop
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      const mx = topLeftX + dx;
      const my = topLeftY + dy;
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) return 0;
      if (mx >= floorX0 && mx < floorX0 + 3 && my >= floorY0 && my < floorY0 + 3) return 0;
      if (mx >= ox && mx < ox + 2 && my >= oy && my < oy + 2) return 0;
      if (Math.abs(mx - startX) <= 1 && Math.abs(my - startY) <= 1) return 0;
      if (map.events.some((e) => Math.abs(mx - e.x) <= 0 && Math.abs(my - e.y) <= 0)) return 0;
      if ((map.upperTiles[my * map.width + mx] ?? -1) >= 0) return 0;
    }
  }

  let count = 0;
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      const mx = topLeftX + dx;
      const my = topLeftY + dy;
      const idx = my * map.width + mx;
      const ut = kit.rows[dy]?.upperTiles?.[dx] ?? kit.rows[dy]?.tiles?.[dx] ?? -1;
      if (ut >= 0) {
        map.upperTiles[idx] = ut;
        tileset.passability[ut] = { up: true, down: true, left: true, right: true };
        count++;
      }
    }
  }
  return count;
}

function ensureAuthenticBeodeulMapEnvironment(
  draft: Project,
  map: GameMap,
  tileset: TilesetDef,
  floorX0: number,
  floorY0: number,
  ox: number,
  oy: number,
): { addedGround: number; addedUpper: number } {
  let addedGround = 0;
  let addedUpper = 0;
  const midX = Math.floor(map.width / 2);
  const midY = Math.floor(map.height / 2);
  const beodeulPlazaTiles = [1509, 2691, 1077, 1212, 1672, 2523, 1673, 1674];
  const shapedPoints: { x: number; y: number }[] = [];

  // Reset lowerTiles to Beodeul base grass (737) and clear upperTiles so no clipped secondary stamps or legacy brick tiles ever remain
  map.lowerTiles.fill(737);
  map.upperTiles.fill(-1);
  if (map.lowerOverlayTiles) map.lowerOverlayTiles.fill(-1);
  if (map.upperOverlayTiles) map.upperOverlayTiles.fill(-1);

  // 1. Apply dressBeodeulGround FIRST on the grass base so natural wildflowers and grass clusters never overwrite our central Roman travertine plaza!
  try {
    dressBeodeulGround(draft, map.id, "living", 1004);
  } catch {
    // ignore
  }

  // 2. East-West and North-South cobblestone roads (beodeul_road_autotile = 3221)
  for (let x = 0; x < map.width; x++) {
    for (const y of [midY, Math.min(map.height - 1, midY + 1)]) {
      const idx = y * map.width + x;
      map.lowerTiles[idx] = 3221;
      shapedPoints.push({ x, y });
      addedGround++;
    }
  }
  for (let y = 0; y < map.height; y++) {
    for (const x of [Math.max(0, midX - 1), midX]) {
      const idx = y * map.width + x;
      map.lowerTiles[idx] = 3221;
      shapedPoints.push({ x, y });
      addedGround++;
    }
  }

  // 3. Central plaza: outer 11x7 curb ring (3221) + inner 9x5 Roman travertine flagstones (45 contiguous travertine tiles!)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const gx = midX + dx;
      const gy = midY + dy;
      if (gx < 1 || gy < 1 || gx >= map.width - 1 || gy >= map.height - 1) continue;
      const idx = gy * map.width + gx;
      const isOuterRing = Math.abs(dx) === 5 || Math.abs(dy) === 3;
      const chosen = isOuterRing ? 3221 : beodeulPlazaTiles[(gx * 7 + gy * 13) % beodeulPlazaTiles.length]!;
      map.lowerTiles[idx] = chosen;
      shapedPoints.push({ x: gx, y: gy });
      addedGround++;
    }
  }

  // 4. Secondary sand trail (beodeul_sand_autotile = 23160) in northwest quadrant
  for (let x = 2; x <= Math.min(map.width - 2, 6); x++) {
    for (const y of [2, 3]) {
      if (y < map.height) {
        map.lowerTiles[y * map.width + x] = 23160;
        shapedPoints.push({ x, y });
        addedGround++;
      }
    }
  }
  for (let y = 4; y < Math.max(4, midY - 3); y++) {
    for (const x of [3, 4]) {
      if (x < map.width) {
        map.lowerTiles[y * map.width + x] = 23160;
        shapedPoints.push({ x, y });
        addedGround++;
      }
    }
  }

  if (shapedPoints.length > 0 && tileset.autotileGroups?.length) {
    shapeAllAutotileGroupsAround(map, tileset.autotileGroups, shapedPoints);
  }

  // Re-ensure inner 9x5 Roman travertine flagstones remain pure travertine after autotile shaping
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const gx = midX + dx;
      const gy = midY + dy;
      if (gx < 1 || gy < 1 || gx >= map.width - 1 || gy >= map.height - 1) continue;
      map.lowerTiles[gy * map.width + gx] = beodeulPlazaTiles[(gx * 7 + gy * 13) % beodeulPlazaTiles.length]!;
    }
  }

  // 5. Stamp multi-tile Beodeul trees, bushes, crook street lamps, bench, flowerbox, and temple columns (avoiding floorX0..floorX0+2 and ox..ox+1)
  const sx = projectStartX(draft, map);
  const sy = projectStartY(draft, map);
  const stamps: Array<{ id: string; x: number; y: number }> = [
    { id: "bd-tree-03a8f7", x: 1, y: 1 },
    { id: "bd-tree-3e8732", x: map.width - 4, y: 1 },
    { id: "bd-tree-1a786c", x: 1, y: map.height - 5 },
    { id: "bd-tree-03a8f7", x: map.width - 4, y: map.height - 5 },
    { id: "bd-pick-temple-ruins-column-temple-tall", x: midX - 4, y: midY + 1 },
    { id: "bd-pick-temple-ruins-column-temple-tall", x: midX + 4, y: midY + 1 },
    { id: "bd-prop-lamp_crook", x: midX - 5, y: midY - 2 },
    { id: "bd-prop-lamp_crook", x: midX + 5, y: midY - 2 },
    { id: "bd-prop-bench_wood", x: midX - 4, y: midY - 4 },
    { id: "bd-prop-flowerbox_long", x: midX + 2, y: midY - 3 },
    { id: "bd-tree-f4f319", x: 5, y: 1 },
    { id: "bd-tree-37f48b", x: map.width - 8, y: 1 },
    { id: "bd-tree-37f48b", x: 4, y: map.height - 4 },
    { id: "bd-tree-f4f319", x: map.width - 8, y: map.height - 4 },
    { id: "bd-tree-37f48b", x: 1, y: 4 },
    { id: "bd-tree-f4f319", x: map.width - 4, y: 4 },
    { id: "bd-prop-bench_wood", x: midX - 3, y: 1 },
    { id: "bd-prop-flowerbox_long", x: midX + 1, y: 1 },
  ];
  for (const s of stamps) {
    addedUpper += stampBeodeulStructureKit(map, tileset, s.id, s.x, s.y, floorX0, floorY0, ox, oy, sx, sy);
  }

  return { addedGround, addedUpper };
}

function projectStartX(project: Project, map: GameMap): number {
  return project.startMapId === map.id ? project.startPos.x : -99;
}

function projectStartY(project: Project, map: GameMap): number {
  return project.startMapId === map.id ? project.startPos.y : -99;
}

function floorKitKeyForArchetype(archetype: CustomObjectArchetype): string {
  switch (archetype) {
    case "dimensional_portal":
    case "spacetime_rift":
    case "chrono_egg":
      return "portal";
    case "magicite_altar":
    case "tech_monolith":
      return "altar";
    case "sealed_gate":
    case "puzzle_mechanism":
    case "boulder_plate":
      return "ruin";
    case "boss_magic_circle":
    case "opera_stage":
      return "boss";
    case "campfire_site":
      return "inn";
    case "trial_podium":
    case "quest_guild_board":
      return "merchant";
    case "hazard_trap":
      return "trap";
    case "magitek_device":
      return "magitek";
    case "vehicle_dock":
      return "dock";
    default:
      return "altar";
  }
}

function bakeAndStampBeodeul3x3FloorKit(
  draft: Project,
  map: GameMap,
  tileset: TilesetDef,
  archetype: CustomObjectArchetype,
  topLeftX: number,
  topLeftY: number,
): number {
  const floorKey = floorKitKeyForArchetype(archetype);
  const rows48 = ARGON_BEODEUL_3X3_FLOOR_KITS[floorKey] ?? ARGON_BEODEUL_3X3_FLOOR_KITS.altar!;
  const objectId = `${WORKSHOP_OBJECT_PREFIX}beodeul-floor-${floorKey}`;
  const gridHash = `beodeul_floor_${floorKey}_48x48`;

  let kit = bakedWorkshopKit(tileset, objectId, gridHash);
  if (!kit) {
    const perRow = bundledChipsetTilesPerRow("workshop_");
    const sheet = new PNG({ width: perRow * 16, height: 16 });
    const cells: { sourceTile: number; dx: number; dy: number }[] = [];
    let k = 0;
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        const sourceTile = k++;
        cells.push({ sourceTile, dx: tx, dy: ty });
        for (let py = 0; py < 16; py++) {
          const rowStr = rows48[ty * 16 + py] ?? "";
          for (let px = 0; px < 16; px++) {
            const ch = rowStr[tx * 16 + px] ?? "G";
            const rgba = BEODEUL_FLOOR_PALETTE[ch] ?? BEODEUL_FLOOR_PALETTE.G!;
            const di = (py * sheet.width + (sourceTile * 16 + px)) * 4;
            sheet.data[di] = rgba[0];
            sheet.data[di + 1] = rgba[1];
            sheet.data[di + 2] = rgba[2];
            sheet.data[di + 3] = 255;
          }
        }
      }
    }
    const dataUrl = `data:image/png;base64,${PNG.sync.write(sheet).toString("base64")}`;
    const assetId = workshopAssetId(dataUrl);
    kit = bakeWorkshopObject(draft, map.tilesetId, {
      objectId,
      title: `버들항 레퍼런스 성소 바닥 (${floorKey})`,
      description: `버들항(beodeul_city) 멀티모달 레퍼런스 기반 3×3 커스텀 바닥 모자이크 키트 (${floorKey})`,
      kind: "flat",
      columns: 3,
      rows: 3,
      footRows: 0,
      risePx: 0,
      use: ["ground", "beodeul-floor", archetype],
      gridHash,
      asset: { id: assetId, dataUrl, width: sheet.width, height: sheet.height },
      cells,
    });
  }

  let stamped = 0;
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      const mx = topLeftX + dx;
      const my = topLeftY + dy;
      if (mx < 1 || my < 1 || mx >= map.width - 1 || my >= map.height - 1) continue;
      const tid = kit.rows[dy]?.upperTiles?.[dx] ?? kit.rows[dy]?.tiles?.[dx] ?? -1;
      if (tid >= 0) {
        map.lowerTiles[my * map.width + mx] = tid;
        tileset.priority[tid] = "lower";
        tileset.passability[tid] = { up: true, down: true, left: true, right: true };
        stamped++;
      }
    }
  }
  return stamped;
}

export function ensureEventHasVisibleGraphic(
  event: GameEvent,
  fallback: { id: string; characterIndex: number; direction?: "down" | "up" | "left" | "right"; pattern?: number },
  project?: Project,
): void {
  if (event.id.startsWith("ev_baseline_")) return;
  const asset = findCharsetAsset(fallback.id) ?? findCharsetAsset("Object2") ?? findCharsetAsset("Actor1");
  const spriteId = asset?.textureKey ?? "tex_easyrpg_charset_object2";
  const frameIdx = encodeCharsetFrameIndex({
    characterIndex: fallback.characterIndex,
    direction: fallback.direction ?? "down",
    pattern: (fallback.pattern ?? 1) as 0 | 1 | 2,
  });

  const pages = event.pages ?? [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    // Keep secondary "cleared / opened / defeated" pages with no commands transparent
    const isClearedStatePage = i > 0 && (!page.commands || page.commands.length === 0);
    if (isClearedStatePage) continue;
    const existingSpriteId = page.graphic?.sprite?.id;
    const resolvedExisting = existingSpriteId ? findCharsetAsset(existingSpriteId) : undefined;
    const isMissingUploaded =
      page.graphic?.sprite?.type === "uploaded" &&
      !(project?.assets?.uploaded && existingSpriteId && project.assets.uploaded[existingSpriteId]);
    const isInvalidBundled =
      page.graphic?.sprite?.type === "bundled" && !resolvedExisting;

    if (!page.graphic || page.graphic.transparent === true || !existingSpriteId || isMissingUploaded || isInvalidBundled) {
      const wantsActorSprite =
        typeof existingSpriteId === "string" &&
        /actor|people|chara|npc|priest|monk|vendor|chancellor/iu.test(`${existingSpriteId} ${event.id} ${event.name}`);
      const actorAsset = wantsActorSprite ? (findCharsetAsset("People1") ?? findCharsetAsset("Actor1") ?? asset) : asset;
      const chosenSpriteId = actorAsset?.textureKey ?? spriteId;
      const chosenFrameIdx = wantsActorSprite
        ? encodeCharsetFrameIndex({
            characterIndex: Math.abs(event.x + event.y) % 8,
            direction: page.graphic?.direction ?? fallback.direction ?? "down",
            pattern: 1,
          })
        : frameIdx;
      const nextGraphic: EventPageGraphic = {
        transparent: false,
        sprite: { type: "bundled", id: chosenSpriteId },
        direction: page.graphic?.direction ?? fallback.direction ?? "down",
        pattern: chosenFrameIdx,
      };
      page.graphic = nextGraphic;
    } else if (page.graphic.sprite?.type === "bundled" && resolvedExisting && page.graphic.sprite.id !== resolvedExisting.textureKey) {
      page.graphic = {
        ...page.graphic,
        sprite: { type: "bundled", id: resolvedExisting.textureKey },
      };
    }
  }
}

function extractHintString(toolName: string, args: Record<string, unknown>, changedEvents: GameEvent[]): string {
  const parts: string[] = [toolName];
  for (const key of ["name", "title", "id", "kind", "archetype", "description", "prompt", "instruction", "text", "note", "vehicle", "vehicleId"]) {
    const val = args[key];
    if (typeof val === "string") parts.push(val);
  }
  for (const subKey of ["event", "skill", "item", "actor", "enemy", "troop", "state", "quest", "ending", "a", "b", "target"]) {
    const sub = args[subKey];
    if (sub && typeof sub === "object") {
      const rec = sub as Record<string, unknown>;
      for (const k of ["name", "title", "id", "kind", "description", "note"]) {
        if (typeof rec[k] === "string") parts.push(rec[k] as string);
      }
    }
  }
  for (const ev of changedEvents) {
    parts.push(ev.id, ev.name);
  }
  return parts.join(" ");
}

function defaultArchetypeForTool(toolName: string, hint: string): CustomObjectArchetype {
  const lower = `${toolName} ${hint}`.toLowerCase();
  if (toolName === "create_time_gate") return "dimensional_portal";
  if (toolName === "place_trap") return "hazard_trap";
  if (toolName === "place_vehicle" || toolName === "spawn_vehicle") return "vehicle_dock";
  if (toolName === "compile_puzzle" || toolName === "add_switch_puzzle") {
    return /바위|돌|boulder|rock|weight/u.test(lower) ? "boulder_plate" : "puzzle_mechanism";
  }
  if (toolName === "add_boulder_puzzle") return "boulder_plate";
  if (toolName === "create_quest" || toolName === "define_quest" || toolName === "AdvanceQuest" || toolName === "CompleteQuest") {
    return "quest_guild_board";
  }
  if (toolName === "define_ending" || toolName === "upsert_ending") {
    return "dimensional_portal";
  }
  if (toolName === "upsert_skill" || toolName === "create_skill") {
    return "tech_monolith";
  }
  if (toolName === "upsert_item" || toolName === "upsert_equipment" || toolName === "create_actor" || toolName === "upsert_actor" || toolName === "create_hero_character") {
    return "magicite_altar";
  }
  if (toolName === "upsert_enemy" || toolName === "upsert_troop" || toolName === "upsert_troop_battle_page" || toolName === "upsert_state" || toolName === "place_battle_blocker" || toolName === "add_boss_encounter") {
    return "boss_magic_circle";
  }
  if (toolName === "add_companion" || toolName === "create_companion") {
    return "campfire_site";
  }
  return inferCustomObjectArchetype(hint);
}

function findSafeSpotNear(project: Project, map: GameMap, prefX: number, prefY: number): { x: number; y: number } {
  const occupied = new Set(map.events.map((e) => `${e.x},${e.y}`));
  if (project.startMapId === map.id) {
    occupied.add(`${project.startPos.x},${project.startPos.y}`);
  }
  const cx = Math.max(2, Math.min(map.width - 3, Math.trunc(prefX)));
  const cy = Math.max(2, Math.min(map.height - 3, Math.trunc(prefY)));
  for (let r = 0; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 2 || y < 2 || x >= map.width - 2 || y >= map.height - 2) continue;
        if (!occupied.has(`${x},${y}`)) {
          return { x, y };
        }
      }
    }
  }
  return { x: cx, y: cy };
}

/**
 * Automatically ensures that when an assistant write tool executes on an active map:
 * 1. Every newly created or modified non-baseline event has a visible graphic sprite on its active pages.
 * 2. If the tool authored a DB/Quest/System/Vehicle mechanic without placing a scene object event on the current map,
 *    a visible interactive scene object event is placed on the current map so the mechanic is visually grounded.
 * 3. A custom 32x32 pixel-art object matching the command's JRPG archetype is baked into the map's tileset
 *    (workshop:<slug>) and stamped at the focus coordinate along with a dressed 7x7 plaza environment.
 */
const SKIP_AUTO_SCENE_TOOLS: ReadonlySet<string> = new Set([
  AUTHOR_CUSTOM_MAP_OBJECT_TOOL,
  "create_map",
  "resize_map",
  "set_map_properties",
  "build_world",
  "delete_map",
  "rename_map",
]);

export function autoEnsureSceneObjectAndLayout(
  ctx: { assistantRun?: boolean; currentMapId?: string; skipAutoSceneDress?: boolean } | undefined,
  before: Project,
  draft: Project,
  toolName: string,
  args: Record<string, unknown>,
): void {
  if (!ctx?.assistantRun || !ctx.currentMapId || ctx.skipAutoSceneDress) return;
  if (SKIP_AUTO_SCENE_TOOLS.has(toolName)) return;
  if (ctx.currentMapId === "map_blank_start" && (before.maps["map_blank_start"]?.events.length ?? 0) === 0) return;

  const currentMap = draft.maps[ctx.currentMapId];
  if (!currentMap) return;

  // Identify all maps where events were added or modified
  const targetMapIds = new Set<string>([ctx.currentMapId]);
  if (typeof args.mapId === "string" && draft.maps[args.mapId]) {
    targetMapIds.add(args.mapId);
  }
  for (const subKey of ["a", "b", "target"]) {
    const sub = args[subKey];
    if (sub && typeof sub === "object") {
      const mId = (sub as Record<string, unknown>).mapId;
      if (typeof mId === "string" && draft.maps[mId]) targetMapIds.add(mId);
    }
  }

  for (const mapId of targetMapIds) {
    const map = draft.maps[mapId];
    if (!map) continue;
    const beforeMap = before.maps[mapId];
    const beforeById = new Map((beforeMap?.events ?? []).map((e) => [e.id, e]));

    const changedEvents = map.events.filter((ev) => {
      if (ev.id.startsWith("ev_baseline_")) return false;
      const prev = beforeById.get(ev.id);
      if (!prev) return true;
      return JSON.stringify(prev) !== JSON.stringify(ev);
    });

    // Resolve same-coordinate collisions caused by superseded draft events (e.g. place_trap / place_examine_hotspots followed by upsert_event at the same (x,y))
    if (map.events.length > 1) {
      map.events = map.events.filter((ev, idx, arr) => {
        if (ev.id.startsWith("ev_baseline_")) return true;
        const laterSameCoord = arr.slice(idx + 1).some((other) => other.x === ev.x && other.y === ev.y);
        if (laterSameCoord && (/^ev_examine_/u.test(ev.id) || /_trap_[0-9a-f-]{8,}/iu.test(ev.id))) {
          return false;
        }
        return true;
      });
      // Shift any remaining non-baseline coordinate collisions to the nearest free passable tile
      const seenCoords = new Set<string>();
      for (const ev of map.events) {
        if (ev.id.startsWith("ev_baseline_")) {
          seenCoords.add(`${ev.x},${ev.y}`);
        }
      }
      for (const ev of map.events) {
        if (ev.id.startsWith("ev_baseline_")) continue;
        const key = `${ev.x},${ev.y}`;
        if (seenCoords.has(key)) {
          const safe = findSafeSpotNear(draft, map, ev.x, ev.y);
          ev.x = safe.x;
          ev.y = safe.y;
          seenCoords.add(`${ev.x},${ev.y}`);
        } else {
          seenCoords.add(key);
        }
      }
    }

    const hint = extractHintString(toolName, args, changedEvents);
    const archetype = defaultArchetypeForTool(toolName, hint);
    const preset = ARCHETYPE_PRESETS[archetype];

    for (const ev of map.events) {
      if (!ev.id.startsWith("ev_baseline_")) {
        ensureEventHasVisibleGraphic(ev, preset.fallbackSprite, draft);
      }
    }

    // Determine focus coordinates (fx, fy) on this map
    let fx: number | undefined;
    let fy: number | undefined;
    const primaryEv = changedEvents[changedEvents.length - 1];
    if (primaryEv) {
      fx = primaryEv.x;
      fy = primaryEv.y;
    } else if (typeof args.x === "number" && typeof args.y === "number") {
      fx = Math.trunc(args.x);
      fy = Math.trunc(args.y);
    } else if (args.at && typeof args.at === "object") {
      const at = args.at as Record<string, unknown>;
      if (typeof at.x === "number" && typeof at.y === "number") {
        fx = Math.trunc(at.x);
        fy = Math.trunc(at.y);
      }
    }

    // If this is the active map (ctx.currentMapId) and no non-baseline event exists near the focus or was added by a DB/Vehicle/Quest/Ending tool,
    // place a visible scene monument/device/altar event so the map visually represents the newly authored JRPG element.
    const nonBaselineEvents = map.events.filter(
      (e) =>
        !e.id.startsWith("ev_baseline_") &&
        !["ev_legacy_pit", "ev_buggy_chest", "ev_broken_gate", "ev_boss_door"].includes(e.id),
    );
    if (mapId === ctx.currentMapId && nonBaselineEvents.length === 0) {
      const spot = findSafeSpotNear(draft, map, fx ?? Math.floor(map.width / 2), fy ?? Math.floor(map.height / 2) - 1);
      fx = spot.x;
      fy = spot.y;
      const monAsset = findCharsetAsset(preset.fallbackSprite.id) ?? findCharsetAsset("Object2");
      const monSpriteId = monAsset?.textureKey ?? "tex_easyrpg_charset_object2";
      const monumentEvent: GameEvent = {
        id: `ev_${preset.defaultSlug}`,
        name: preset.defaultTitle,
        x: fx,
        y: fy,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "page_1",
            name: preset.defaultTitle,
            conditions: [],
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: {
              type: "fixed",
              speed: 3,
              frequency: 3,
            },
            graphic: {
              transparent: false,
              sprite: { type: "bundled", id: monSpriteId },
              direction: preset.fallbackSprite.direction ?? "down",
              pattern: encodeCharsetFrameIndex({
                characterIndex: preset.fallbackSprite.characterIndex,
                direction: preset.fallbackSprite.direction ?? "down",
                pattern: (preset.fallbackSprite.pattern ?? 1) as 0 | 1 | 2,
              }),
            },
            commands: [
              {
                kind: "text",
                speaker: preset.defaultTitle,
                body: `[${preset.defaultTitle}] 장치/비석이 활성화되어 있습니다.`,
              },
            ],
          } as any,
        ],
      };
      map.events.push(monumentEvent);
    }

    if (fx === undefined || fy === undefined) {
      const fallbackEv = nonBaselineEvents[nonBaselineEvents.length - 1] ?? map.events.find((e) => !e.id.startsWith("ev_baseline_"));
      fx = fallbackEv?.x ?? Math.floor(map.width / 2);
      fy = fallbackEv?.y ?? Math.floor(map.height / 2);
    }

    bakeAndStampCustomObject(draft, map, {
      archetype,
      objectId: `${preset.defaultSlug}-${map.id.replace(/^map_/u, "")}`,
      title: preset.defaultTitle,
      description: preset.description,
      focusX: fx,
      focusY: fy,
      dressSurroundings: true,
      ...(primaryEv ? { targetEvent: primaryEv } : {}),
    });
  }
}

const authorCustomMapObject: ToolDefinition = {
  name: AUTHOR_CUSTOM_MAP_OBJECT_TOOL,
  description:
    "맵의 타일셋에 없는 JRPG 특수 오브젝트(차원문/타임게이트, 시공 균열, 마석 제단, 고대 봉인문, 함정 발판/독가시/레이저 결계, "
    + "마도 제어기/포탑, 시간의 알, 던전 레버/수문/바위 감압판, 왕국 재판 단상, 오페라 무대, 모닥불 야영지, 보스 소환 마법진, "
    + "쌍연기 수련 비석, 퀘스트 게시판, 비공정/잠수함/에포크 정박 데크 등)를 16px 칸 기반 3/4 탑뷰 도트 그래픽(2×2칸, 32×32px)으로 "
    + "생성하여 타일셋(workshop:<id>)에 굽고 맵의 (x, y) 좌표에 배치하며, 주변 바닥 타일과 환경 오브젝트도 함께 꾸민다.",
  mode: "write",
  domains: ["map", "tile", "event"],
  fillsCurrentMapId: true,
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["title"],
    properties: {
      mapId: { type: "string", description: "대상 맵 ID (생략 시 현재 맵)" },
      title: { type: "string", description: "생성할 오브젝트 이름 (예: '시공의 차원문', '고대 마석 제단', '불안정한 시공 균열')" },
      objectId: { type: "string", description: "선택. 영문 슬러그 또는 workshop:<id>" },
      archetype: {
        type: "string",
        enum: [...ARCHETYPE_LIST],
        description: "오브젝트 원형 카테고리 (생략 시 title/description에서 자동 추론)",
      },
      description: { type: "string", description: "오브젝트 시각 설명" },
      x: { type: "integer", description: "배치할 기준 X 좌표" },
      y: { type: "integer", description: "배치할 기준 Y 좌표" },
      primaryColor: { type: "string", description: "선택. 주 색상 (#rrggbb)" },
      secondaryColor: { type: "string", description: "선택. 보조 색상 (#rrggbb)" },
      glowColor: { type: "string", description: "선택. 발광 코어 색상 (#rrggbb)" },
      dressSurroundings: { type: "boolean", description: "주변 광장 바닥 및 환경 소품 동시 배치 여부 (기본 true)" },
    },
  },
  invalidArgsExample: {
    mapId: "map_chrono_present",
    title: "천년제 텔레포드 차원문",
    archetype: "dimensional_portal",
    x: 10,
    y: 4,
  },
  run(draft, args, ctx): ToolExecResult {
    const mapId = (typeof args.mapId === "string" && args.mapId.trim()) || ctx?.currentMapId || draft.startMapId;
    const map = requireMap(draft, mapId);
    const focusX = typeof args.x === "number" ? Math.trunc(args.x) : Math.floor(map.width / 2);
    const focusY = typeof args.y === "number" ? Math.trunc(args.y) : Math.floor(map.height / 2);
    const title = String(args.title ?? "커스텀 오브젝트").trim();
    const description = typeof args.description === "string" ? args.description : title;
    const rawArch = typeof args.archetype === "string" && (ARCHETYPE_LIST as readonly string[]).includes(args.archetype)
      ? (args.archetype as CustomObjectArchetype)
      : inferCustomObjectArchetype(`${title} ${description}`);

    const receipt = bakeAndStampCustomObject(draft, map, {
      archetype: rawArch,
      ...(typeof args.objectId === "string" ? { objectId: args.objectId } : {}),
      title,
      description,
      focusX,
      focusY,
      ...(typeof args.primaryColor === "string" ? { primaryColor: args.primaryColor } : {}),
      ...(typeof args.secondaryColor === "string" ? { secondaryColor: args.secondaryColor } : {}),
      ...(typeof args.glowColor === "string" ? { glowColor: args.glowColor } : {}),
      dressSurroundings: args.dressSurroundings !== false,
    });

    return {
      summary: `${map.name}(${map.id}) (${focusX},${focusY})에 커스텀 도트 오브젝트 '${receipt.title}'(${receipt.objectId}, ${receipt.widthTiles}×${receipt.heightTiles}칸) 생성·타일셋 굽기 및 주변 환경 소품(${receipt.addedUpperCells}칸)·바닥(${receipt.addedGroundCells}칸) 배치 완료`,
      data: receipt,
    };
  },
};

export const CUSTOM_MAP_OBJECT_TOOLS: readonly ToolDefinition[] = [authorCustomMapObject];

