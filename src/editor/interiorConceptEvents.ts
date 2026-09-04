/**
 * 개념 꾸러미 칩 집행 — 놓인 물건 자리에 이벤트를 단다.
 *
 * 칩은 표 라벨이 아니라 동작이다(2026-09-02 리드 판정: 「칩이 뭔가를 해야 한다」).
 *  - transfer → action 이벤트 + `transfer`. 대상이 없으면 같은 맵 정문으로 두고 미연결로 보고한다.
 *  - sleep    → action 이벤트 + `inn`(숙박 요금·HP/MP 회복). 여관의 본업.
 *  - loot     → selfSwitch A 로 한 번만 금화. 뒤지는 소리·동전 소리가 보상에 앞서고(lootFeedback), 이후 「비어 있다」.
 *  - event    → 조사 문장 하나.
 *  - block/pass 는 타일셋 통행표와 걷기 BFS 가 이미 집행한다(카탈로그 가구는 solid, 계단·러그는 passable).
 *
 * 한 물건에 칩이 여럿이면 transfer > sleep > loot > event 순으로 하나만 단다.
 * 앵커는 물건 최하단 행 중앙 — 플레이어가 남쪽에서 마주 보거나(가구) 올라서서(계단) 조사한다.
 */
import type { ConceptPlacement } from "@/editor/interiorConceptCompose";
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import { lootGrantCommands, lootRummageCommands } from "@/editor/lootFeedback";
import type { Command, EventPage, EventPageCondition, GameEvent, GameMap } from "@/project/types";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";

export type ConceptTransferTarget = { readonly mapId: string; readonly x: number; readonly y: number };

export type ConceptEventOptions = {
  /** 정문 — transfer 대상이 없을 때의 임시 착지. */
  readonly door: { readonly x: number; readonly y: number };
  /** 숙박 요금. 기본 20G. */
  readonly innPrice?: number;
  /** 계단·문 연결 대상. 없으면 같은 맵 정문(미연결). */
  readonly transferTarget?: ConceptTransferTarget | null;
  /** 조사 문장에 넣는 시설명(「여관 카운터다」). 없으면 「시설」. */
  readonly facilityLabel?: string;
};

export type ConceptConnection = {
  readonly thingId: string;
  readonly label: string;
  readonly roomId: string;
  readonly x: number;
  readonly y: number;
  readonly linked: boolean;
};

export type ConceptEventResult = {
  readonly events: readonly GameEvent[];
  readonly connections: readonly ConceptConnection[];
  readonly warnings: readonly string[];
};

const DEFAULT_INN_PRICE = 20;

type Behavior = "transfer" | "sleep" | "loot" | "event";

function behaviorFor(chips: readonly string[]): Behavior | null {
  if (chips.includes("transfer")) return "transfer";
  if (chips.includes("sleep")) return "sleep";
  if (chips.includes("loot")) return "loot";
  if (chips.includes("event")) return "event";
  return null;
}

/** 조사 문장 — 물건 id 별 한 줄. 시설명이 들어가는 줄은 함수다. 없는 id 는 라벨로 만든다. */
const FLAVOR: Readonly<Record<string, string | ((facility: string) => string)>> = {
  counter: (facility) => `${facility} 카운터다. 주인은 잠시 자리를 비웠다.`,
  clock: "괘종시계가 느리게 흔들린다.",
  piano: "피아노다. 건반에 먼지가 앉았다.",
  window: "창밖으로 길이 보인다.",
  picture: "풍경화다. 먼 산이 그려져 있다.",
  armor: "갑옷 전시대. 누군가의 가보 같다.",
  bust: "흉상. 표정이 근엄하다.",
  mirror: "거울. 여행에 지친 얼굴이 비친다.",
  table_long: "긴 탁자. 술잔 자국이 남아 있다.",
  table_chairs: "탁자와 의자. 방금 누가 앉았던 것 같다.",
  display: "진열대. 약병과 작은 검이 놓여 있다.",
  cabinet: "캐비닛. 잘 개어진 이불이 들어 있다.",
  plant: "화분. 잎이 싱싱하다.",
  stairs: "위층으로 오르는 계단이다.",
  bookshelf: "책장. 여행기와 지도가 꽂혀 있다.",
  bed_h: "침대. 잘 정돈되어 있다.",
  bed_v: "침대. 잘 정돈되어 있다.",
  stove: "화덕. 아직 온기가 남아 있다.",
  hearth: "벽난로. 장작이 타닥거린다.",
  cauldron: "가마솥. 무언가 끓고 있다.",
  barrel: "술통. 두드리면 둔탁한 소리가 난다.",
  crate: "나무 상자. 못이 단단히 박혀 있다.",
  jars: "항아리. 소금과 곡물이 담겨 있다.",
  box: "잡화 상자. 자잘한 도구가 들어 있다.",
  grain: "곡물 자루. 거친 삼베 냄새.",
  bucket: "물통. 물이 반쯤 차 있다.",
  kettle: "주전자. 김이 오른다.",
  stool: "스툴. 다리 하나가 짧다.",
  sword_rack: "검 거치대. 손잡이가 닳아 있다.",
  crystal: "수정구. 안개가 천천히 돈다.",
  religious: (facility) => `${facility}의 성상이다. 잠시 고개를 숙인다.`,
  fruit_shelf: "과일 선반. 사과 향이 난다.",
  shelf_jars: "항아리 선반. 절임 냄새가 난다.",
  tavern_sign: "간판. 오늘의 술이 적혀 있다.",
  ladder: "사다리. 위 다락으로 이어진다.",
  rug: "카펫. 발밑이 부드럽다.",
  rug_red: "붉은 카펫. 귀한 손님을 맞는 길이다.",
  rug_mat: "짚 돗자리. 바삭한 소리가 난다.",
};

function flavorFor(placement: ConceptPlacement, facility: string): string {
  const entry = FLAVOR[placement.objectId];
  if (typeof entry === "function") return entry(facility);
  return entry ?? `${placement.label}이다.`;
}

function lootGoldFor(placement: ConceptPlacement, ordinal: number): number {
  // 결정적 — 같은 나무면 같은 금액. 10·15·20…
  const seed = [...`${placement.thingId}:${ordinal}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return 10 + (seed % 5) * 5;
}

function cellsIntact(map: GameMap, placement: ConceptPlacement): boolean {
  return placement.cells.every((cell) => {
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) return false;
    const i = cell.y * map.width + cell.x;
    return (cell.layer === "upper" ? map.upperTiles[i] : map.lowerTiles[i]) === cell.tile;
  });
}

function page(id: string, name: string, commands: Command[], conditions: EventPageCondition[] = []): EventPage {
  return {
    id,
    name,
    conditions,
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

export function buildConceptEvents(
  map: GameMap,
  placements: readonly ConceptPlacement[],
  options: ConceptEventOptions,
): ConceptEventResult {
  const events: GameEvent[] = [];
  const connections: ConceptConnection[] = [];
  const warnings: string[] = [];
  const occupied = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
  const price = options.innPrice ?? DEFAULT_INN_PRICE;
  const facility = options.facilityLabel?.trim() || "시설";
  let ordinal = 0;

  for (const placement of placements) {
    const behavior = behaviorFor(placement.chips);
    if (!behavior) continue;
    if (!cellsIntact(map, placement)) {
      warnings.push(`concept: ${placement.label} 이 통행 확보 중 치워져 이벤트를 달지 않았다`);
      continue;
    }
    // 앵커가 막혔으면(정문 등) 같은 행의 다른 칸.
    const bottomRow = Math.max(...placement.cells.map((cell) => cell.y));
    const rowCells = placement.cells.filter((cell) => cell.y === bottomRow);
    const anchor = [placement.anchor, ...rowCells].find((cell) => !occupied.has(`${cell.x},${cell.y}`));
    if (!anchor) {
      warnings.push(`concept: ${placement.label} 자리에 이미 이벤트가 있어 칩을 달지 못했다`);
      continue;
    }
    ordinal += 1;
    const id = `ev_concept_${map.id}_${placement.thingId}_${ordinal}`;
    occupied.add(`${anchor.x},${anchor.y}`);
    const base: GameEvent = {
      id,
      x: anchor.x,
      y: anchor.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
    };
    switch (behavior) {
      case "transfer": {
        const target = options.transferTarget ?? { mapId: map.id, x: options.door.x, y: options.door.y };
        const linked = Boolean(options.transferTarget);
        base.pages = [
          page(`${id}_p`, placement.label, [
            { kind: "text", body: linked ? flavorFor(placement, facility) : `${flavorFor(placement, facility)} 아직 이어진 곳이 없어 정문으로 돌아간다.` },
            { kind: "transfer", mapId: target.mapId, x: target.x, y: target.y, fade: "black" },
          ]),
        ];
        connections.push({ thingId: placement.thingId, label: placement.label, roomId: placement.roomId, x: anchor.x, y: anchor.y, linked });
        if (!linked) warnings.push(`concept: ${placement.label} 의 맵 연결 대상이 없다 — create_transfer_pair 로 이어라 (${anchor.x},${anchor.y})`);
        break;
      }
      case "sleep": {
        base.pages = [
          page(`${id}_p`, placement.label, [
            {
              kind: "inn",
              price,
              note: `${placement.label}. 하루 묵으면 체력이 회복된다.`,
              question: `${price}G 에 하룻밤 묵겠습니까?`,
              recoverMp: true,
            },
          ]),
        ];
        break;
      }
      case "loot": {
        const gold = lootGoldFor(placement, ordinal);
        base.pages = [
          page(`${id}_p1`, placement.label, [
            ...lootRummageCommands(),
            ...lootGrantCommands({ gold }),
            { kind: "text", body: `${placement.label}을(를) 뒤졌다. ${gold}G 를 찾았다.` },
            { kind: "setSelfSwitch", key: "A", value: true },
          ], [{ kind: "selfSwitch", key: "A", value: false }]),
          page(`${id}_p2`, placement.label, [
            { kind: "text", body: `${placement.label}. 이미 비어 있다.` },
          ], [{ kind: "selfSwitch", key: "A", value: true }]),
        ];
        break;
      }
      case "event": {
        base.pages = [page(`${id}_p`, placement.label, [{ kind: "text", body: flavorFor(placement, facility) }])];
        break;
      }
    }
    events.push(base);
  }
  return { events, connections, warnings };
}

/** 이벤트를 맵에 붙인다(같은 자리 기존 이벤트는 건드리지 않는다). */
export function attachConceptEvents(
  map: GameMap,
  placements: readonly ConceptPlacement[],
  options: ConceptEventOptions,
): ConceptEventResult {
  const result = buildConceptEvents(map, placements, options);
  if (result.events.length > 0) map.events = [...(map.events ?? []), ...result.events];
  return result;
}

const UNLINKED_SUFFIX = " 아직 이어진 곳이 없어 정문으로 돌아간다.";

/**
 * 이 맵의 **미연결** 계단(transfer 대상이 자기 맵 정문)을 `target` 으로 잇는다. 이은 이벤트 수를 돌려준다.
 * 층이 둘 이상인 시설에서 placeConceptTool 이 위층 착지로 잇는 데 쓴다.
 */
export function linkConceptTransfers(
  map: GameMap,
  door: { readonly x: number; readonly y: number },
  target: ConceptTransferTarget,
): number {
  let linked = 0;
  for (const event of map.events ?? []) {
    if (!event.id.startsWith(`ev_concept_${map.id}_`)) continue;
    for (const holder of [event, ...(event.pages ?? [])]) {
      const commands = holder.commands as Command[];
      const index = commands.findIndex(
        (command) => command.kind === "transfer" && command.mapId === map.id && command.x === door.x && command.y === door.y,
      );
      if (index < 0) continue;
      commands[index] = { kind: "transfer", mapId: target.mapId, x: target.x, y: target.y, fade: "black" };
      for (let i = 0; i < commands.length; i += 1) {
        const command = commands[i]!;
        if (command.kind === "text" && textBodyOf(command).endsWith(UNLINKED_SUFFIX)) {
          commands[i] = { ...command, body: textBodyOf(command).slice(0, -UNLINKED_SUFFIX.length) };
        }
      }
      linked += 1;
    }
  }
  return linked;
}

/**
 * 위층 맵의 정문 이벤트(`ev_entrance_<mapId>`)를 「계단 내려가기」로 바꾼다 — 위층엔 밖으로 나가는 문이 없고,
 * 그 자리가 아래층에서 올라온 착지 바로 남쪽이다. 정문 이벤트가 없으면 false.
 */
export function convertEntranceToDescent(map: GameMap, target: ConceptTransferTarget, facilityLabel?: string): boolean {
  const event = (map.events ?? []).find((entry) => entry.id === `ev_entrance_${map.id}`);
  if (!event) return false;
  const facility = facilityLabel?.trim() || "시설";
  const commands: Command[] = [
    { kind: "text", body: `[계단] ${facility} 아래층으로 내려간다.` },
    { kind: "transfer", mapId: target.mapId, x: target.x, y: target.y, fade: "black" },
  ];
  event.commands = [];
  const first = event.pages?.[0];
  if (first) {
    first.name = "계단(아래)";
    first.commands = commands;
  } else {
    event.pages = [page(`${event.id}_page`, "계단(아래)", commands)];
  }
  return true;
}

/** 맵의 개념 이벤트 중 맵 연결(transfer) 지점. 툴 결과 data.connections 가 이것을 싣는다. */
export function listConceptConnections(map: GameMap): readonly { id: string; x: number; y: number; name: string; target: ConceptTransferTarget | null }[] {
  const out: { id: string; x: number; y: number; name: string; target: ConceptTransferTarget | null }[] = [];
  for (const event of map.events ?? []) {
    if (!event.id.startsWith(`ev_concept_${map.id}_`)) continue;
    const commands = [...event.commands, ...(event.pages ?? []).flatMap((entry) => entry.commands)];
    const transfer = commands.find((command) => command.kind === "transfer");
    if (!transfer || transfer.kind !== "transfer") continue;
    out.push({
      id: event.id,
      x: event.x,
      y: event.y,
      name: event.pages?.[0]?.name ?? event.id,
      target: { mapId: transfer.mapId, x: transfer.x, y: transfer.y },
    });
  }
  return out;
}

/** 방 상자 안에 물건 형상이 온전히 찍혀 있는가(어느 레이어든 그 타일이 있으면 그 칸은 맞는 것으로 본다). */
export function objectPresentInBox(
  map: GameMap,
  object: InteriorObjectDef,
  box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): boolean {
  const W = map.width;
  for (let oy = box.y - 2; oy < box.y + box.h; oy += 1) {
    for (let ox = box.x; ox <= box.x + box.w - object.width; ox += 1) {
      const hit = object.cells.every((cell) => {
        const x = ox + cell.dx;
        const y = oy + cell.dy;
        if (x < 0 || y < 0 || x >= W || y >= map.height) return false;
        const i = y * W + x;
        return map.lowerTiles[i] === cell.tile || map.upperTiles[i] === cell.tile;
      });
      if (hit) return true;
    }
  }
  return false;
}
