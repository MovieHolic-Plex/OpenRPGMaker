// 조수 v2 방 쓰임 — 구역(zone)의 «무엇을 위한 방인가»를 방 종류·꾸밈 한 벌·쓰임에 안 맞는 소품으로 옮긴다.
//
// 왜(2026-10-25 판정 J42·J31·J64): 모든 방이 같은 거실 한 벌(붉은 안락의자 짝·둥근 양탄자·화분·찻상)로 채워졌다.
//  - 지하 예배당 제단 뒤에 안락의자와 화분, 장난감 가게 홀에 안락의자 줄·침대·벽난로(가게가 여관처럼 읽혔다),
//  - 「entrance」(가게 홀)·「study」(교실)처럼 집 방 종류로 들어온 구역이 그 방의 견본 가구와 거실 한 벌을 받았다,
//  - 현대 학교(modern_city)는 방 다섯이 living·bedroom 으로 풀려 소파·냉장고·침대가 깔렸다.
// 그래서: ① 구역의 쓰임 낱말(이름·목적)이 방 종류보다 먼저 방 종류를 정하고, ② 빈 바닥을 메우는 한 벌은 그 쓰임의 한 벌이며
// (모르는 쓰임에 거실 한 벌을 주지 않는다), ③ 지은 뒤 쓰임에 안 맞는 소품을 셈해 끝맺음 관문에 올린다.
// 순수 함수 — 빌더·검사·테스트가 같이 읽는다.
import type { GameMap, Project } from "@/project/types";

/** 쓰임 하나: 낱말 → 칩셋별 방 종류 후보 · 메우기 한 벌 · 이 방에 있으면 어색한 소품(이름표 낱말). */
export interface RoomPurpose {
  readonly id: string;
  readonly ko: string;
  /** 구역 이름·kind·purpose·장소 이름에서 이 쓰임을 알아보는 낱말. */
  readonly words: RegExp;
  /** 칩셋 id → 견본이 있는 방 종류(앞이 먼저). 칩셋에 하나도 없으면 원래 kind 를 쓴다. */
  readonly kinds: Readonly<Record<string, readonly string[]>>;
  /** 빈 바닥 덩이를 메울 한 벌(가운데 칸 기준 상대 좌표, 손 도트 v5 부품 id). 없으면 메우지 않는다(거실 한 벌을 주지 않는다). */
  readonly sets?: readonly (readonly { readonly id: string; readonly x: number; readonly y: number }[])[];
  /** 이 쓰임의 방에 있으면 «다른 방 가구»로 읽히는 소품 — 칸 이름표(라벨)에서 찾는 낱말. */
  readonly offProps: RegExp;
  /**
   * 빌린 견본의 가구를 이 쓰임의 가구로 바꾸는 표(부품 id 정규식 → 같은 크기·종류의 부품 id 차례).
   * 장난감 가게는 재봉 가게 견본을 빌리는데 옷감 선반·마네킹이 그대로 남아 옷 가게로 읽혔다(2026-10-25 J31).
   */
  readonly swaps?: readonly (readonly [RegExp, readonly string[]])[];
}

const HOME_PROPS = /안락의자|소파|침대|이불|냉장고|화장대|찻상|벽난로|욕조|세면대|armchair|sofa|\bbed\b|fridge|bathtub/iu;

export const ROOM_PURPOSES: readonly RoomPurpose[] = [
  {
    id: "chapel", ko: "예배당", words: /예배당|성당|교회|기도실|성소|제단|chapel|church|cathedral|shrine ?hall|sanctuary/iu,
    kinds: { atlas_biome_interior: ["chapel", "vestry"], modern_city: ["shrine-haiden"], jp_city: ["hall"] },
    sets: [
      [{ id: "pew", x: 0, y: 0 }, { id: "pew", x: 0, y: 2 }],
      [{ id: "votive stand", x: 0, y: 0 }, { id: "candelabra", x: 2, y: 0 }],
      [{ id: "pew", x: 0, y: 0 }, { id: "holy water font", x: 3, y: 0 }],
    ],
    offProps: /안락의자|소파|침대|찻상|화분|둥근 양탄자|모피 깔개|벽난로|식탁|술통|armchair|sofa|\bbed\b|potted|round rug|fur rug/iu,
  },
  {
    id: "toyshop", ko: "장난감 가게", words: /장난감|인형 가게|완구|오르골 가게|태엽|toy ?shop|toys?\b/iu,
    kinds: { atlas_biome_interior: ["tailor_shop", "bakery_shop", "pharmacy_shop"], modern_city: ["st-floor", "hy-floor"], jp_city: ["bookstore", "florist"] },
    swaps: [
      [/^(fabric bolt rack|cabinet:bolt.*|cabinet:bread.*|bread shelf.*|cabinet:potion.*|cabinet:vial.*|cabinet:jar.*|apothecary drawers)$/u, ["cabinet:toy", "clock", "cabinet:toy"]],
      [/^(mannequin|proofing rack|display potion)$/u, ["rocking horse", "music box", "toy box", "old doll"]],
      [/^(shelf:potion.*|shelf:bolt.*|hang:herb)$/u, ["shelf:toy", "wall clock"]],
    ],
    sets: [
      [{ id: "display 2x1", x: 0, y: 0 }, { id: "rocking horse", x: 3, y: 0 }],
      [{ id: "display 1x1", x: 0, y: 0 }, { id: "music box", x: 1, y: 0 }, { id: "display 1x1", x: 2, y: 0 }],
      [{ id: "display 2x1", x: 0, y: 0 }, { id: "crate", x: 3, y: 0 }],
    ],
    offProps: HOME_PROPS,
  },
  {
    id: "shop", ko: "가게", words: /가게|상점|매장|잡화|가판|판매|진열|계산대|shop|store(?!\s*room)|boutique|market/iu,
    kinds: { atlas_biome_interior: ["tailor_shop", "bakery_shop", "pharmacy_shop", "weapon_shop"], modern_city: ["st-floor", "hy-floor", "konbini"], jp_city: ["konbini", "bookstore"] },
    sets: [
      [{ id: "display 2x1", x: 0, y: 0 }, { id: "crate", x: 3, y: 0 }],
      [{ id: "display 1x1", x: 0, y: 0 }, { id: "barrel", x: 2, y: 0 }, { id: "display 1x1", x: 3, y: 0 }],
    ],
    offProps: HOME_PROPS,
  },
  {
    id: "weaponshop", ko: "무기점", words: /무기점|무기 ?가게|무구|갑옷 가게|armou?ry shop|weapon ?shop|smith shop/iu,
    kinds: { atlas_biome_interior: ["weapon_shop", "armory"] },
    sets: [[{ id: "armor stand", x: 0, y: 0 }, { id: "weapon barrel", x: 2, y: 0 }], [{ id: "armor stand", x: 0, y: 0 }, { id: "armor stand", x: 2, y: 0 }]],
    offProps: /안락의자|소파|침대|찻상|화분|둥근 양탄자|armchair|sofa|\bbed\b|potted|round rug/iu,
  },
  {
    id: "workshop", ko: "공방", words: /공방|작업실|작업장|수리|태엽 ?공|workshop|atelier|work ?room/iu,
    kinds: { atlas_biome_interior: ["workshop", "tailor_work", "forge", "alchemy"], modern_city: ["fc-line", "ld-press"], jp_city: ["sciencelab"] },
    sets: [
      [{ id: "work 2x1", x: 0, y: 0 }, { id: "stool", x: 0, y: 1 }, { id: "crate", x: 3, y: 0 }],
      [{ id: "work 2x1", x: 0, y: 0 }, { id: "chest", x: 3, y: 0 }],
      [{ id: "crate", x: 0, y: 0 }, { id: "barrel", x: 1, y: 0 }, { id: "sack", x: 2, y: 0 }],
    ],
    offProps: /안락의자|소파|침대|찻상|둥근 양탄자|모피 깔개|armchair|sofa|\bbed\b|round rug|fur rug/iu,
  },
  {
    id: "classroom", ko: "교실", words: /교실|강의실|수업|학급|자습|classroom|lecture|class ?room/iu,
    kinds: { modern_city: ["school-class", "school-class-2", "hs-class-a", "ms-class-w", "el-class-a"], modern_campus: ["classroom", "lecture"], jp_city: ["classroom"], atlas_biome_interior: ["study", "library"] },
    sets: [[{ id: "desk 1x1", x: 0, y: 0 }, { id: "chair N", x: 0, y: 1 }, { id: "desk 1x1", x: 2, y: 0 }, { id: "chair N", x: 2, y: 1 }]],
    offProps: HOME_PROPS,
  },
  {
    id: "school", ko: "학교", words: /학교|교무실|교장실|음악실|과학실|복도.*학교|학교.*복도|school|principal|staff ?room|music ?room/iu,
    kinds: {
      modern_city: ["school-corridor", "school-staffroom", "school-infirmary", "school-genkan", "school-class", "school-stairwell", "band-room", "sci-lab"],
      modern_campus: ["corridor", "staffroom", "infirmary", "classroom", "club"], jp_city: ["staffroom", "musicroom", "infirmary", "classroom", "corridor"],
    },
    offProps: HOME_PROPS,
  },
  {
    id: "hospital", ko: "병원", words: /병원|병동|병실|진료|진찰|응급|간호|보건실|양호실|hospital|ward|clinic|surgery|infirmary/iu,
    kinds: { modern_city: ["hosp-ward-west", "hosp-nurse-core", "hosp-er", "cl-exam-a", "cl-waiting", "waiting_room", "school-infirmary"], jp_city: ["hosp-ward", "hosp-exam", "hosp-lobby", "hosp-corridor", "infirmary"], modern_campus: ["infirmary"] },
    offProps: /안락의자|냉장고|찻상|벽난로|armchair|fridge/iu,
  },
  {
    id: "library", ko: "서고", words: /서고|도서관|도서실|서재|library|study/iu,
    kinds: { atlas_biome_interior: ["library", "study"], modern_city: ["library-hall", "library-study"], jp_city: ["library"], modern_campus: ["library"] },
    sets: [
      [{ id: "desk 2x1", x: 0, y: 1 }, { id: "chair N", x: 0, y: 2 }],
      [{ id: "globe", x: 0, y: 0 }, { id: "book pile", x: 1, y: 0 }, { id: "candelabra", x: 2, y: 0 }],
    ],
    offProps: /침대|냉장고|욕조|\bbed\b|fridge|bathtub/iu,
  },
];

/** 구역 낱말에서 쓰임 하나(앞이 먼저 — 장난감 가게가 가게보다, 무기점이 가게보다 앞). */
const ORDER = ["chapel", "toyshop", "weaponshop", "workshop", "hospital", "classroom", "school", "library", "shop"];
export function purposeOf(text: string): RoomPurpose | undefined {
  for (const id of ORDER) { const p = ROOM_PURPOSES.find((q) => q.id === id)!; if (p.words.test(text)) return p; }
  return undefined;
}

/** 이 쓰임에 이 칩셋 견본이 있는 방 종류(앞이 먼저). */
export function purposeKind(purpose: RoomPurpose, tilesetId: string, available: ReadonlySet<string>): string | undefined {
  return (purpose.kinds[tilesetId] ?? []).find((k) => available.has(k));
}

/** 방 종류 낱말 자체가 이 쓰임인가(chapel·weapon_shop…). 그러면 구역 kind 를 그대로 둔다. */
export function kindServesPurpose(kind: string, purpose: RoomPurpose, tilesetId: string): boolean {
  return (purpose.kinds[tilesetId] ?? []).includes(kind);
}

type Cell = { readonly x: number; readonly y: number };
interface RoomLoc { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }

function labelOf(project: Project, map: GameMap, tile: number | undefined): string {
  if (typeof tile !== "number" || tile < 0) return "";
  const meta = (project.tilesets[map.tilesetId]?.tileMeta as unknown as ({ label?: string } | undefined)[] | undefined)?.[tile];
  return meta?.label ?? "";
}

/** 맵의 방 기록(손 도트 layout 방)과 그 쓰임 — 방 이름(kind)과 맵 이름에서. */
export function roomPurposes(map: GameMap): { room: RoomLoc; purpose: RoomPurpose }[] {
  const locs = ((map.locations ?? []) as unknown as (RoomLoc & { tags?: string[] })[]).filter((l) => (l.tags ?? []).includes("hand-layout-room"));
  const single = locs.length === 1;
  const out: { room: RoomLoc; purpose: RoomPurpose }[] = [];
  for (const room of locs) {
    // 방 하나짜리 맵은 맵 이름이 그 방의 쓰임이다(「태엽 장난감 가게」의 entrance 방). 여러 방이면 방 이름만 본다(가게 맵의 침실은 침실).
    const purpose = purposeOf(room.name.replace(/_/gu, " ")) ?? (single ? purposeOf(map.name ?? "") : undefined);
    if (purpose) out.push({ room, purpose });
  }
  return out;
}

/** 쓰임에 안 맞는 소품 — 방마다 그 쓰임의 offProps 이름표가 붙은 덮개 칸 덩이(가구 한 점 = 이름 하나로 센다). */
export function offPurposeProps(project: Project, map: GameMap): { room: string; purpose: string; props: { label: string; at: Cell }[] }[] {
  const out: { room: string; purpose: string; props: { label: string; at: Cell }[] }[] = [];
  const upper = map.upperTiles as readonly number[] | undefined;
  const overlay = map.lowerOverlayTiles as readonly number[] | undefined;
  for (const { room, purpose } of roomPurposes(map)) {
    const seen = new Set<string>();
    const props: { label: string; at: Cell }[] = [];
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      const i = y * map.width + x;
      for (const t of [upper?.[i], overlay?.[i]]) {
        const label = labelOf(project, map, t);
        if (!label || !purpose.offProps.test(label)) continue;
        const name = label.replace(/\s*\([^)]*\)\s*$/u, "").replace(/\s+\d+,\d+$/u, "").trim();
        // 같은 이름의 가구가 붙어 있으면(2×2 양탄자의 네 칸) 한 점으로 센다.
        const key = `${name}@${Math.floor(x / 3)},${Math.floor(y / 3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        props.push({ label: name, at: { x, y } });
      }
    }
    if (props.length) out.push({ room: room.name, purpose: purpose.ko, props });
  }
  return out;
}

/** 빌린 견본 가구 하나를 이 쓰임 가구로(없으면 그대로). n 은 같은 줄 안에서 돌려 쓰는 차례. 바꿀 부품이 부품 사전에 없으면 건너뛴다. */
export function purposeSwap(purpose: RoomPurpose, id: string, n: number, has: (id: string) => boolean): string | undefined {
  for (const [re, to] of purpose.swaps ?? []) {
    if (!re.test(id)) continue;
    const ok = to.filter(has);
    return ok.length ? ok[n % ok.length] : undefined;
  }
  return undefined;
}
