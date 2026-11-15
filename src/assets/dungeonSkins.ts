// 던전 겉가죽(skin) — 버들항 게임의 던전을 버들항 수준의 새 그림으로 입힌다(2026-11-15 오너: 「던전도 해야하고」).
//
// 옛 던전 그림(tiledata/beodeul-dungeon/{gap,theme,theme2,cave})은 2026-10 의 코드 손 도트라 버들항 마을 옆에서 옛 칩셋으로 읽혔다:
// 평평한 한 색 바닥 · 칸 하나가 되풀이되는 벽 · 방울 무늬 벽 너머 · 게임마다 같은 모습.
// 겉가죽은 주제(동굴·유적 …)마다 Fable 5.2 로 새로 그린 조각을 scripts/content/beodeul-dungeons/bake.py 가 칸으로 잘라 구운 표다:
//   바닥 = 64px 판 여러 장을 덩이마다 섞음 · 벽 앞면 = 64px 조각 셋을 벽 줄 따라 섞음(3칸 높이 + 입술) · 벽 너머 = 어두운 윗면이 멀어질수록 어두워짐 ·
//   동·서·남은 옆면 없이 «윗면 테» · 물가 = 둑이 있는 못 그림을 16칸으로 · 기물 = 옛 킷 자리에 같은 발자국의 새 그림.
// 시공기(dungeonKit/beodeul/compose.ts)는 배치·벽·천장·물 마스크를 그대로 두고 칸 그림만 이 표로 바꾼다 — 걷는 칸·막힌 칸은 달라지지 않는다.
// 고르기: 게임 겉모습의 dungeon 갈래(project/tilesetLook.ts)가 겉모습 이름 하나를 정하고, 주제마다 그 이름 순번의 벽 색 줄을 쓴다 — 한 게임은 한 모습, 게임끼리는 다르다.
// 겉모습이 없는 게임(옛 게임·열쇠 없는 편집)과 아직 겉가죽이 없는 주제는 옛 그림 그대로다.
import table from "./beodeulDungeonSkins.json";
import type { TilesetLook } from "@/project/types";

export interface DungeonSkinLook {
  readonly id: string;
  readonly ko: string;
  /** 바닥 판마다 4×4 칸(줄 우선). */
  readonly floor: readonly (readonly number[])[];
  /** 벽 앞면: [조각][열 0..3][줄 0(위)..2(아래)]. */
  readonly face: readonly (readonly (readonly number[])[])[];
  /** 벽 윗변 입술(앞면 바로 위 천장 칸에 얹는 2층 덧칸): [조각][열]. */
  readonly lip: readonly (readonly number[])[];
  /** 벽 너머 윗면: [밝기 0 가까움 · 1 · 2 깊은 곳][판][칸]. */
  readonly top: readonly (readonly (readonly number[])[])[];
  /** 윗면 판을 덩이 줄마다 반 덩이 어긋나게 깐다(테두리가 한 색인 판만). */
  readonly stagger?: boolean;
  /** 윗면 테(옆면 없음): N 바닥이 북쪽 · E 바닥이 동쪽 · W 서쪽 · EW 양쪽 다(한 칸 두께 벽) · Ef/Wf 벽 앞면이 곁 · NE/NW 둘 다 · cE/cW 대각에만. 값은 위상 넷. */
  readonly rim: Readonly<Record<string, readonly number[]>>;
  /** 물 몸통: 4칸(2×2) 또는 16칸(4×4 판). */
  readonly water?: readonly number[];
  readonly shore?: readonly number[];
  readonly shoreIn?: readonly number[];
  /** 바닥 판을 고르는 몫(판 순서대로, 합 1) — 없으면 고르게. */
  readonly floorWeights?: readonly number[];
  /** 층 사이 계단 킷: up 벽 앞면 두 칸(올라감) · down 바닥 한 칸(내려감). */
  readonly stairs?: { readonly up: string; readonly down: string };
  /** 물 위 다리 한 칸(걷는 방향 동서 · 남북). */
  readonly bridge?: { readonly ew: number; readonly ns: number };
  /** 한 칸 폭 물줄기: v 세로(위 끝·가운데 둘·아래 끝) · h 가로(왼 끝·가운데 둘·오른 끝) · dot 한 칸 웅덩이. */
  readonly narrow?: { readonly v: readonly number[]; readonly h: readonly number[]; readonly dot: number;
    /** 굽이·세 갈래·네 갈래 칸: 열쇠 = 물인 이웃(북 1 · 동 2 · 남 4 · 서 8). 그린 물줄기 그물이 있는 주제만. */
    readonly net?: Readonly<Record<string, number>> };
  /** 안쪽 모서리 둘이 한 칸에 드는 자리: 열쇠 = 뭍인 대각(북서 1 · 북동 2 · 남서 4 · 남동 8). */
  readonly shoreIn2?: Readonly<Record<string, number>>;
}

/** 덧놓는 기물. cls: open 방 안쪽 · edge 벽가 · wall 북쪽 벽 앞면 · decal 바닥 그림 · run 방 한가운데 세로 줄(융단). once = 그 층에 하나뿐인 볼거리(가장 넓은 방부터). */
export interface DungeonSkinExtra { readonly kit: string; readonly cls: "open" | "edge" | "wall" | "decal" | "run"; readonly per: number; readonly max?: number; readonly rooms?: readonly string[]; readonly once?: boolean }

export interface DungeonSkinTheme {
  readonly id: string;
  readonly ko: string;
  /** 이 주제가 맡는 던전 종류. «cave+lair» 처럼 깃발이 붙은 것은 그 깃발(lair 소굴 · flooded 물에 잠김)이 켜진 층만 — 깃발 붙은 주제가 먼저다. */
  readonly types: readonly string[];
  /** 흐르는 것이 용암인 주제(화산) — 물 칸 그림이 용암 그림이다. */
  readonly lava?: boolean;
  /** 얕은 물을 걸어 건너는 주제(물에 잠긴 신전): 물가 덧칸이 ★ 이고 그 밑 1층은 물 몸통이다 — 물 칸의 통행은 물 깊이(terrainDesign.waterDepth)가 정한다. */
  readonly wade?: boolean;
  readonly looks: readonly DungeonSkinLook[];
  /** 옛 킷 id → 그 자리에 놓을 새 킷들(여럿이면 자리 해시로 하나). 새 킷이 더 높으면 아랫줄을 맞춘다. */
  readonly swap: Readonly<Record<string, readonly string[]>>;
  /** 옛 꾸밈 뒤에 덧놓는 큰 기물·바닥 그림: per = 바닥 100칸마다 몇 개. */
  readonly extras: readonly DungeonSkinExtra[];
  /** 빛을 내는 킷 → 빛 띠 이름(table.glow). */
  readonly glowOf: Readonly<Record<string, string>>;
}

export interface DungeonGlow { readonly w: number; readonly h: number; readonly rows: readonly (readonly number[])[]; readonly dx: number; readonly dy: number }

interface SkinTable { readonly tilesetId: string; readonly base: number; readonly end: number; readonly looks: Readonly<Record<string, { readonly label: string }>>; readonly themes: readonly DungeonSkinTheme[]; readonly glow: Readonly<Record<string, DungeonGlow>>; readonly light?: Readonly<Record<string, Readonly<Record<string, string>>>> }
const TABLE = table as unknown as SkinTable;

/** 게임 겉모습의 dungeon 갈래 선택지(이름 → 사람이 읽는 이름). 그 타일셋에 겉가죽이 없으면 빈 표. */
export function dungeonSkinLooks(tilesetId: string): Readonly<Record<string, { readonly label: string }>> {
  return tilesetId === TABLE.tilesetId && TABLE.themes.length ? TABLE.looks : {};
}

export interface DungeonSkin { readonly theme: DungeonSkinTheme; readonly look: DungeonSkinLook; readonly glow: Readonly<Record<string, DungeonGlow>>;
  /** 이 게임의 빛 색: 불을 내는 공용 기물(횃불·화로·촛불·모닥불) → 그 색 불 킷. 없으면 주황 불 그대로. */
  readonly light: Readonly<Record<string, string>>;
  /** 겉모습 이름의 순번 — 같은 자리의 여러 대안 기물 중 무엇을 먼저 쓸지 게임마다 다르게 하는 소금. */
  readonly pick: number }

/**
 * 이 게임의 그 던전 종류가 입을 겉가죽. 게임 겉모습에 dungeon 갈래가 없거나(옛 게임), 그 종류의 주제가 아직 구워지지 않았거나,
 * 타일셋 사본에 그 칸이 없으면(번들 꼬리가 아직 안 붙은 옛 사본) undefined — 옛 그림으로 짓는다.
 */
export function dungeonSkinFor(tileset: { readonly id: string; readonly count?: number }, type: string, look: TilesetLook | undefined, flags: readonly string[] = []): DungeonSkin | undefined {
  if (tileset.id !== TABLE.tilesetId || !look?.dungeon) return undefined;
  if ((tileset.count ?? 0) < TABLE.end) return undefined;
  const names = Object.keys(TABLE.looks), at = names.indexOf(look.dungeon);
  const theme = TABLE.themes.find((t) => flags.some((f) => t.types.includes(`${type}+${f}`))) ?? TABLE.themes.find((t) => t.types.includes(type));
  if (at < 0 || !theme || !theme.looks.length) return undefined;
  return { theme, look: theme.looks[at % theme.looks.length]!, glow: TABLE.glow, light: TABLE.light?.[look.dungeon] ?? {}, pick: at };
}

/** 빛 띠(이름 → 칸 줄과 기물 왼쪽 위에서의 어긋남). */
export function dungeonGlow(name: string): DungeonGlow | undefined {
  return TABLE.glow[name];
}
