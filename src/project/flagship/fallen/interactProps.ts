// 폴른 스타 — 수납 뒤지기 연출·집주인 반응을 엔진 패턴(project/containerSearchPattern.ts)으로 얹는 마지막 단계.
//
// 수납을 짓는 곳(townLife.ts 집 안·거리, townQuests.ts 꾸지람)과 따로 둔다: 그쪽이 수납을 줄이거나 옮겨도
// 이 단계는 「지금 맵에 있는 수납 이벤트」(id ev_fs_box_… 또는 이름 「수납 · …」)만 찾아 고친다. 여러 번 불러도 같다.
//  - 종류(상자·궤짝·통·자루·서랍)는 이름표로 고른다 → 여는 소리·흔들림·파편·뒤진 흔적.
//  - 집주인 시야 분기(eventSeesPlayer)가 있으면: 보면 돌아보고 「!」, 시끄러운 수납은 벽 너머에서 들으면 「?」.
//  - 「옆방 기척」 대사는 집주인이 지금 실제로 있는 방 이름으로 고른다(예전엔 「부엌 쪽에서」 로 고정이었다).
// 문 여는 연출은 엔진 기본(문 칸에서 떠나는 이동)이라 여기서 할 일이 없다.
//
// 수납 줄이기(사용자 2026-10-24 「상자가 너무 많다」): 방마다 살림 이치로 하나면 된다.
//  - 보상·잔 일(페이지가 덧붙은) 수납은 그대로 둔다. 「살펴보기」 한 줄뿐인 살림 수납(townLife)만 줄인다.
//  - 방에 보상·잔 일 수납이 있으면 살림 수납은 모두 뺀다. 없으면 여닫는 것(궤짝·상자·가방·서랍·옷장·찬장·화장대·협탁) 하나만 남긴다.
//    방(로케이션)이 없는 맵(거리)은 살림 수납을 남기지 않는다. 그림은 가구로 그대로 둔다 — 이벤트만 뺀다.
//  - 남은 수납은 모두 「여는」 연출(뚜껑 소리·반짝임, 흔들림·파편 없음)로 연다. 통·자루를 흔들어 뒤지는 연출은 쓰지 않는다.
import { containerFxId, type ContainerStyle } from "@/project/containerFx";
import { applyContainerSearchPattern, roomAwareCommands } from "@/project/containerSearchPattern";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";

const ROOM_NAMES: Readonly<Record<string, string>> = {
  kitchen: "부엌", living: "거실", bedroom: "침실", master_bedroom: "안방", dressing: "옷방", tailor_work: "재봉실",
  library: "서재", study: "공부방", museum_relics: "유물 진열실", bakery_shop: "가게", bakery_oven: "화덕방", pantry: "식료품 창고",
  cellar: "지하 창고", dining: "식당", tavern: "주점", corridor: "복도", inn_room: "객실", shop: "가게", workshop: "작업장",
  forge: "대장간", storage: "창고", store: "가게", herb: "약초방", apothecary: "약방",
};

function roomName(location: { id: string; name?: string }): string | null {
  const key = String(location.name ?? location.id).trim();
  return ROOM_NAMES[key] ?? (/[가-힣]/.test(key) ? key : null);
}

const narrate = (body: string): Command => ({ kind: "text", body, context: "narration", position: "bottom" } as Command);
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);

function isContainer(event: GameEvent): boolean {
  return String(event.id).startsWith("ev_fs_box_") || String(event.name ?? "").startsWith("수납 · ");
}

type Fork = Command & { condition?: { kind?: string; eventId?: string; range?: number; sameRoom?: boolean; requireFacing?: boolean }; then?: Command[]; else?: Command[] };

function walk(commands: readonly Command[] | undefined, visit: (command: Fork) => void): void {
  for (const command of commands ?? []) {
    visit(command as Fork);
    if (command.kind === "fork") { walk((command as Fork).then, visit); walk((command as Fork).else, visit); }
  }
}

/** 수납을 지켜보는 집주인 — 「본다」 분기의 이벤트 id. */
function ownerOf(event: GameEvent): string | undefined {
  let owner: string | undefined;
  for (const page of event.pages ?? []) walk(page.commands as Command[], (c) => {
    const cond = c.condition;
    if (!owner && c.kind === "fork" && cond?.kind === "eventSeesPlayer" && cond.sameRoom !== false && cond.requireFacing !== false && (cond.range ?? 5) > 0) owner = cond.eventId;
  });
  return owner;
}

function shortName(map: GameMap, eventId: string): string {
  const name = String(map.events.find((e) => e.id === eventId)?.name ?? "").trim();
  return name.split(/\s+/).pop() || "집주인";
}

function josaGa(word: string): string {
  const ch = word.charCodeAt(word.length - 1);
  return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 !== 0 ? "이" : "가";
}

/** 「옆방 기척」 분기(벽 무관 가까움)의 첫 대사를 집주인이 지금 있는 방 이름으로 고른다. */
function roomAwareCue(event: GameEvent, map: GameMap, ownerId: string, name: string): boolean {
  let changed = false;
  for (const page of event.pages ?? []) walk(page.commands as Command[], (c) => {
    const cond = c.condition;
    if (c.kind !== "fork" || cond?.kind !== "eventSeesPlayer" || cond.eventId !== ownerId || cond.sameRoom !== false) return;
    const first = c.then?.[0];
    if (!first || first.kind !== "text") return; // 이미 방 이름 분기로 바뀌었으면(fork) 그대로 둔다.
    const cue = roomAwareCommands(ownerId, map.locations, (location) => {
      const room = roomName(location as { id: string; name?: string });
      return room ? [narrate(`${room} 쪽에서 ${name}${josaGa(name)} 움직이는 소리가 난다.`)] : null;
    }, [narrate(`${name} 발소리가 가까이서 들린다.`)]);
    c.then = [...cue, ...(c.then ?? []).slice(1)];
    changed = true;
  });
  return changed;
}

/** 살림 한 줄뿐인 수납(townLife 의 「살펴보기」 한 페이지) — 보상도 잔 일도 없다. */
function isFlavorOnly(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  if (!String(event.id).startsWith("ev_fs_box_") || pages.length !== 1 || pages[0]!.name !== "살펴보기") return false;
  return !/"kind":"change(Item|Gold)"/.test(JSON.stringify(pages[0]!.commands ?? []));
}

const OPENABLE = /궤짝|상자|가방|서랍|옷장|찬장|화장대|협탁/;

function roomOf(map: GameMap, event: GameEvent): string | null {
  const room = (map.locations ?? []).find((l) => event.x >= l.x && event.x < l.x + l.w && event.y >= l.y && event.y < l.y + l.h);
  return room ? room.id : null;
}

/** 방마다 수납 하나 — 살림 수납만 뺀다(위 머리말). 뺀 수를 돌려준다. */
function trimContainers(map: GameMap): number {
  const boxes = map.events.filter(isContainer);
  const drop = new Set<string>();
  const rooms = new Map<string | null, GameEvent[]>();
  for (const box of boxes) { const key = roomOf(map, box); rooms.set(key, [...(rooms.get(key) ?? []), box]); }
  for (const [room, list] of rooms) {
    const flavor = list.filter(isFlavorOnly);
    const keepOne = room !== null && flavor.length === list.length
      ? flavor.filter((e) => OPENABLE.test(String(e.name))).sort((a, b) => Number(/궤짝|가방/.test(String(b.name))) - Number(/궤짝|가방/.test(String(a.name))) || a.y - b.y || a.x - b.x)[0]
      : undefined;
    for (const e of flavor) if (e !== keepOne) drop.add(e.id);
  }
  if (drop.size) map.events = map.events.filter((e) => !drop.has(e.id));
  return drop.size;
}

/** 이미 다른 종류의 여는 연출이 붙어 있으면 「여는」 연출로 갈아 끼운다(두 번 불러도 같다). */
function retargetFx(event: GameEvent, style: ContainerStyle): void {
  const fx = containerFxId(style);
  for (const page of event.pages ?? []) {
    const interaction = (page as { interaction?: { kind?: string; style?: string } }).interaction;
    if (interaction?.kind === "container") interaction.style = style;
    for (const command of (page.commands ?? []) as Array<Command & { animationId?: string }>) {
      if (command.kind === "showAnimation" && String(command.animationId ?? "").startsWith("fx:container:")) command.animationId = fx;
    }
  }
}

/** 뒤지는 칸의 버들항 「나무 상자」(못 박힌 짐 상자)는 뚜껑 달린 「선원 궤짝」 그림으로 — 여는 것으로 읽히게(같은 번들 칸). */
const NAILED_CRATE = 26606, LIDDED_CHEST = 27120;
function lidOnBox(map: GameMap, event: GameEvent): void {
  const i = event.y * map.width + event.x;
  if (map.upperTiles[i] === NAILED_CRATE) map.upperTiles[i] = LIDDED_CHEST;
}

export type FallenInteractPropsResult = { containers: number; watched: number; cues: number; trimmed: number };

export function applyFallenInteractiveProps(project: Project): FallenInteractPropsResult {
  const result: FallenInteractPropsResult = { containers: 0, watched: 0, cues: 0, trimmed: 0 };
  for (const map of Object.values(project.maps)) {
    result.trimmed += trimContainers(map);
    for (const event of map.events) {
      if (!isContainer(event)) continue;
      // 통·자루·상자를 흔들어 뒤지지 않는다 — 남은 수납은 모두 뚜껑을 여는 연출(흔들림·파편 없음).
      const style: ContainerStyle = "chest";
      retargetFx(event, style);
      lidOnBox(map, event);
      const ownerId = ownerOf(event);
      const name = ownerId ? shortName(map, ownerId) : "";
      if (ownerId && roomAwareCue(event, map, ownerId, name)) result.cues++;
      applyContainerSearchPattern(event, {
        style,
        ...(ownerId ? { ownerId, heardLines: [say(name, "…방금 무슨 소리지?")] } : {}),
      });
      result.containers++;
      if (ownerId) result.watched++;
    }
  }
  return result;
}
