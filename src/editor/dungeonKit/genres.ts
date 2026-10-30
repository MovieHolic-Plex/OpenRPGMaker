// 장르 프리셋(2026-10-15) — 「던전」이 장르마다 다른 물건이라는 것을 코드로 적는다.
//   pokemon : 짧은 던전(방 2~4, 야생 조우 구역, 시선이 있는 트레이너, 선택 보스, 되돌아오는 지름길). 무거운 보물 방·잠긴 문 없음.
//   rpg     : 긴 던전(방 여럿, 보스, 보물 방, 잠긴 문+열쇠, 필드 적).
// 프리셋은 두 가지를 정한다: (1) 배치 인자(방 수·크기·보물 방 유무) (2) 채우기 계획(plan) — 어느 방에 무엇을 둘지의 좌표. 이벤트·적은 이 계획을 보고
// 조수가 기존 도구(set_encounter_table·place_field_enemy·place_battle_blocker·…)로 놓는다. 계획은 결정론이고 시공 결과의 spots·앵커에서만 뽑는다.
import type { Project } from "@/project/types";
import type { DungeonCompose, DungeonSize, DungeonSpec, DungeonType } from "./types";

export type DungeonGenre = "pokemon" | "rpg";
export const DUNGEON_GENRES: readonly DungeonGenre[] = ["pokemon", "rpg"];

export interface GenrePreset {
  readonly id: DungeonGenre;
  readonly label: string;
  readonly blurb: string;
  /** 종류를 말하지 않았을 때 어댑터별 기본 종류. */
  readonly defaultType: { readonly monster: DungeonType; readonly beodeul: DungeonType };
  /** 배치 인자를 덮어쓴다(사용자가 size·rooms 를 직접 줬으면 그쪽이 이긴다). */
  layout(type: DungeonType, spec: DungeonSpec): DungeonSpec;
}

export const GENRE_PRESETS: Readonly<Record<DungeonGenre, GenrePreset>> = {
  pokemon: {
    id: "pokemon", label: "포켓몬풍(몬스터 수집) 짧은 던전",
    blurb: "방 2~4개짜리 짧은 던전: 입구 → 야생 조우 방 1~2개 → (선택) 보스 방. 야생은 걸을 때 확률로 나오는 조우 구역, 트레이너는 시선(직선 3~4칸)으로 말을 건다. 깊은 방의 구멍 사다리는 입구로 돌아오는 지름길.",
    defaultType: { monster: "cave", beodeul: "cave" },
    layout(type, spec) {
      // 불규칙 동굴 문법: 방(입구 제외) 3개, 보물 방 없음. 사각 방 문법(신전 등)은 size small. 미궁은 격자 크기를 줄인다.
      const next: { -readonly [K in keyof DungeonSpec]: DungeonSpec[K] } = { ...spec };
      if (!spec.size && !spec.width && !spec.height) next.size = "small";
      if (GRAMMAR_BLOB.has(type)) { next.roomCount ??= 3; next.vault ??= false; }
      return next;
    },
  },
  rpg: {
    id: "rpg", label: "일반 RPG 긴 던전",
    blurb: "방 여럿(6~9)의 긴 던전(medium 이상): 입구 → 갈래 방들 → 보물 방 → 보스. 보물 방 앞 통로에 잠긴 문(열쇠를 다른 방에서 얻는다), 필드 적이 돌아다니고 상자는 곁방에 있다.",
    defaultType: { monster: "cave", beodeul: "catacomb" },
    layout(_type, spec) {
      const next: { -readonly [K in keyof DungeonSpec]: DungeonSpec[K] } = { ...spec };
      if (!spec.size && !spec.width && !spec.height && !spec.rooms?.length) next.size = "medium" satisfies DungeonSize;
      return next;
    },
  },
};

const GRAMMAR_BLOB: ReadonlySet<DungeonType> = new Set(["cave", "volcano", "ice"]);

/** 프로젝트 장르 → 던전 장르. 몬스터 수집만 pokemon, 나머지는 rpg. */
export function genreOfProject(project: Pick<Project, "system">): DungeonGenre {
  return project.system?.genre === "monster-collect" ? "pokemon" : "rpg";
}

// ---------------------------------------------------------------- 채우기 계획

type Pt = { x: number; y: number };
export interface PopulationPlan {
  readonly genre: DungeonGenre;
  /** 야생 조우 구역(방 id) — map.locations 로 이름표가 붙고, encounterTable 의 locationId 조건으로 쓴다. */
  readonly wildZones: { room: string; note: string }[];
  /** 시선 있는 트레이너·필드 적 자리: place_field_enemy({x,y,behavior,sightRange}) 에 그대로 넣는다. */
  readonly enemies: { room: string; x: number; y: number; face: "up" | "down" | "left" | "right"; behavior: "stationary" | "patrol" | "chase"; sightRange: number; note: string }[];
  /** 상자 자리(곁방·보물 방). */
  readonly chests: { room: string; x: number; y: number }[];
  /** 보스 자리: 보스 방 안쪽 spot. optional=true 면 만들지 말지는 사용자 말에 따른다. */
  readonly boss: { room: string; x: number; y: number; optional: boolean } | null;
  /** 잠긴 문(rpg): 문 칸 + 열쇠를 둘 방. */
  readonly lockedGate: { x: number; y: number; to: string; keyRoom: string; keySpot: Pt | null } | null;
  /** 지름길(pokemon): 깊은 방의 구멍/사다리 칸에서 입구 앞 칸으로 돌아오는 이동. */
  readonly shortcut: { from: Pt; to: Pt; note: string } | null;
  readonly notes: string[];
}

const DIRS = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;

/** (x,y)에서 네 방향 중 걸을 수 있는 칸이 가장 길게 이어지는 방향(시선). */
function bestSight(passable: (x: number, y: number) => boolean, x: number, y: number, max: number): { face: "up" | "down" | "left" | "right"; run: number } {
  let best: { face: "up" | "down" | "left" | "right"; run: number } = { face: "down", run: 0 };
  for (const [face, dx, dy] of DIRS) {
    let run = 0;
    while (run < max && passable(x + dx * (run + 1), y + dy * (run + 1))) run += 1;
    if (run > best.run) best = { face, run };
  }
  return best;
}

/**
 * 장르별 채우기 계획. composed 의 방·spots·앵커·액체만 본다(맵을 읽지 않는다).
 * 걸을 수 있는 칸은 composed.picture(`.`·`=`·`i`) 로 판정한다.
 */
export function planPopulation(genre: DungeonGenre, composed: DungeonCompose, seed = 7): PopulationPlan {
  const pic = composed.picture;
  const passable = (x: number, y: number) => { const c = pic[y]?.[x]; return c === "." || c === "=" || c === "i"; };
  const rooms = composed.rooms;
  const spotsOf = (id: string) => composed.spots[id] ?? [];
  const chestOf = (id: string) => composed.chestSpots?.[id] ?? [];
  const inner = rooms.filter((r) => r.kind !== "entrance" && r.kind !== "boss" && r.kind !== "vault");
  const bossId = composed.anchors.boss, vaultId = composed.anchors.treasure;
  const notes: string[] = [];
  const enemies: PopulationPlan["enemies"][number][] = [];
  const chests: PopulationPlan["chests"][number][] = [];
  let h = seed * 2654435761 >>> 0;
  const pick = <T,>(list: readonly T[]): T | undefined => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 3266489917) >>> 0; return list[h % Math.max(1, list.length)]; };

  const addEnemy = (room: string, behavior: "stationary" | "patrol" | "chase", sight: number, note: string, avoidFirst = 0) => {
    const spots = spotsOf(room).slice(avoidFirst);
    // 시선이 길게 트인 spot 우선.
    const scored = spots.map((s) => ({ s, ...bestSight(passable, s.x, s.y, sight) })).sort((a, b) => b.run - a.run);
    const top = scored.filter((c) => c.run >= Math.min(3, sight));
    const c = top.length ? top[0]! : pick(scored);
    if (!c || enemies.some((e) => e.x === c.s.x && e.y === c.s.y)) return;
    enemies.push({ room, x: c.s.x, y: c.s.y, face: c.face, behavior, sightRange: Math.max(2, Math.min(sight, c.run || sight)), note });
  };

  if (genre === "pokemon") {
    const zones = inner.length ? inner : rooms.filter((r) => r.kind !== "entrance");
    const wildZones = zones.map((r) => ({ room: r.id, note: `${r.id} 바닥 전체가 야생 조우 구역(걸을 때 확률)` }));
    // 트레이너: 입구에서 가장 가까운 안쪽 방 1명 + 보스 직전 방 1명(방이 3개 이상이면), 둘 다 시선 3~4칸의 제자리 보초.
    const byDepth = [...zones].sort((a, b) => a.depth - b.depth);
    if (byDepth[0]) addEnemy(byDepth[0].id, "stationary", 4, "길목 트레이너 — 시선에 들어오면 말을 건다");
    if (byDepth.length >= 2) addEnemy(byDepth[byDepth.length - 1]!.id, "stationary", 3, "깊은 곳 트레이너");
    for (const e of enemies) notes.push(`${e.room} (${e.x},${e.y}) ${e.face}쪽 시선 ${e.sightRange}칸: place_field_enemy({x,y,behavior:'stationary',sightRange:${e.sightRange}})`);
    const bossRoom = bossId ? rooms.find((r) => r.id === bossId) : null;
    const bossSpot = bossRoom ? spotsOf(bossRoom.id)[0] ?? null : null;
    const boss = bossRoom && bossSpot ? { room: bossRoom.id, x: bossSpot.x, y: bossSpot.y, optional: true } : null;
    // 지름길: 구멍 사다리(stairsDown)에서 입구 앞 칸으로.
    const shortcut = composed.stairsDown ? { from: { x: composed.stairsDown.x, y: composed.stairsDown.y }, to: composed.entrance, note: "깊은 방의 구멍 사다리 → 입구 앞 칸(한 번 간 길을 되돌아가지 않아도 된다)" } : null;
    return { genre, wildZones, enemies, chests, boss, lockedGate: null, shortcut, notes };
  }

  // rpg
  for (const r of inner) {
    const sp = spotsOf(r.id);
    if (!sp.length) continue;
    addEnemy(r.id, rooms.indexOf(r) % 2 === 0 ? "patrol" : "stationary", 4, "필드 적(보이는 적 — 닿으면 전투)");
    // 상자는 벽을 등진 자리(chestSpots)가 먼저 — 방 한가운데 트인 바닥의 상자는 떠 있어 보였다(2026-10-29 야외 VQA).
    // 벽을 등진 자리가 없는 방은 벽에 가장 가까운(둘레 5×5 에 벽·천장 칸이 가장 많고 물이 적은) 자리 — 방 가운데에서 먼 끝 자리보다 덜 떠 보인다.
    const wallish = (q: Pt) => { let n = 0; for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { const ch = pic[q.y + dy]?.[q.x + dx]; if (ch === "#" || ch === "W") n += 1; else if (ch === "~") n -= 2; } return n; };
    const byWall = [...sp].filter((q) => !enemies.some((e) => e.x === q.x && e.y === q.y)).sort((a, b) => wallish(b) - wallish(a));
    if (sp.length >= 3) { const c = chestOf(r.id).find((q) => !enemies.some((e) => e.x === q.x && e.y === q.y)) ?? byWall[0] ?? sp[sp.length - 1]!; if (!enemies.some((e) => e.x === c.x && e.y === c.y)) chests.push({ room: r.id, x: c.x, y: c.y }); }
  }
  if (vaultId) for (const s of [...chestOf(vaultId), ...spotsOf(vaultId)].slice(0, 2)) chests.push({ room: vaultId, x: s.x, y: s.y });
  const bossRoom = bossId ? rooms.find((r) => r.id === bossId) : null;
  const bossSpot = bossRoom ? spotsOf(bossRoom.id)[0] ?? null : null;
  const boss = bossRoom && bossSpot ? { room: bossRoom.id, x: bossSpot.x, y: bossSpot.y, optional: false } : null;
  // 열쇠: 입구에서 먼 곁방(보물 방·보스방 제외) 한 곳.
  const keyRoom = [...inner].sort((a, b) => b.depth - a.depth).find((r) => spotsOf(r.id).length > 0) ?? null;
  const gate = composed.anchors.gate;
  const lockedGate = gate && keyRoom ? { x: gate.x, y: gate.y, to: gate.to, keyRoom: keyRoom.id, keySpot: spotsOf(keyRoom.id).find((q) => !enemies.some((e) => e.x === q.x && e.y === q.y) && !chests.some((c) => c.x === q.x && c.y === q.y)) ?? null } : null;
  if (!lockedGate) notes.push("잠긴 문 자리가 없다(보물 방·보스방 통로가 없는 배치) — 문 없이 보스를 둔다.");
  for (const e of enemies) notes.push(`${e.room} (${e.x},${e.y}) ${e.behavior} 시선 ${e.sightRange}칸`);
  return { genre, wildZones: [], enemies, chests, boss, lockedGate, shortcut: null, notes };
}
