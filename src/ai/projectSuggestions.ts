import { collectMapInspection } from "@/project/mapInspection";
import { isPassable } from "@/project/collision";
import type { Command, GameEvent, Project } from "@/project/types";

export interface ProjectSuggestion {
  id: string;
  fingerprint: string;
  title: string;
  evidence: string;
  request: string;
  mapId: string;
  x?: number;
  y?: number;
}

/**
 * 후보를 만드는 **모든** 규칙이 지키는 계약.
 *
 * 1. 사실만 말한다 — 「판매 목록이 비어 있어요」는 사실이고 「그건 틀렸어요」는 단정이다.
 *    의도적으로 비워 둔 값(판매 전용 상점, 조용한 맵)은 결함이 아니다.
 * 2. **고칠 수 있는 것만** 낸다. 근거가 프로젝트 안에 없으면(예: 상점에 넣을 물건이 DB에
 *    없음) 제안하지 않는다 — 누를 수 없는 카드는 소음이다.
 * 3. 후보가 없으면 빈 배열이다. 억지로 채우지 않는다.
 *
 * 왜 규칙이 늘었나 (2026-09-20 실측): 이전 판은 빈 상점 판매목록·없는 이동 목적지·빈 적
 * 그룹 **셋만** 봤고, 실제 프로젝트 30개(111맵·114이벤트 포함) 전부에서 후보 0건이었다.
 * 그래서 사이드바는 항상 「새로 제안할 내용이 없어요」로 끝나고 AI 호출조차 일어나지 않았다.
 * 셋은 모두 「작성자가 이미 만든 것의 연결이 빠졌다」만 잡는다 — 처음 만드는 중인 프로젝트는
 * 어느 것에도 걸리지 않는다. 그래서 **저작 여정에서 실제로 막히는 지점**을 함께 본다.
 *
 * 비용 계약: 이 함수는 패널이 1.5초마다 부르는 경로에 있다. 그래서 전체 projectLint
 * (111맵 실측 약 1초)를 쓰지 않고 **현재 맵 한 장**만 보는 collectMapInspection(실측 2ms)
 * 과 이미 있는 인덱스를 쓴다. 30개 프로젝트 실측 8ms.
 */

/** 상점 판매 목록이 비어 있는가 — 판매 전용·서비스 상점은 의도적일 수 있으므로 사실만 본다. */
function shopHasNoStock(command: Record<string, unknown>): boolean {
  return command.kind === "shop"
    && Array.isArray(command.itemIds) && command.itemIds.length === 0
    && !(Array.isArray(command.stock) && command.stock.length)
    && !(Array.isArray(command.cartLines) && command.cartLines.length)
    && !command.shopServiceKind;
}

/** 이벤트가 실제로 실행하는 커맨드 — 페이지가 있으면 페이지가 정본이고 루트는 죽은 값이다. */
function eventCommandsOf(event: GameEvent): Command[] {
  if (event.pages?.length) return event.pages.flatMap((page) => (page.commands ?? []) as Command[]);
  return (event.commands ?? []) as Command[];
}

/**
 * 이 맵으로 **들어오는** transfer 중 착지 칸이 통행 불가인 것.
 *
 * 왜 잡는가: 실제 프로젝트 30개 중 5개에서 14~15건씩 나왔다(실내 16맵 계열). 플레이어가
 * 문을 열면 벽 속에 서서 못 움직인다 — 저작자가 좌표를 잘못 찍었다는 사실이고, 고칠
 * 대상(좌표)이 프로젝트 안에 있다.
 */
function impassableLandings(
  project: Project,
  mapId: string,
): Array<{ event: GameEvent; command: Record<string, unknown> }> {
  const map = project.maps[mapId];
  if (!map) return [];
  const out: Array<{ event: GameEvent; command: Record<string, unknown> }> = [];
  for (const source of Object.values(project.maps)) {
    for (const event of source.events) {
      const visit = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) { for (const entry of value) visit(entry); return; }
        const record = value as Record<string, unknown>;
        if (record.kind === "transfer" && record.mapId === mapId
          && typeof record.x === "number" && typeof record.y === "number"
          && record.x >= 0 && record.y >= 0 && record.x < map.width && record.y < map.height
          && !isPassable(project, map, record.x, record.y)) {
          out.push({ event, command: record });
        }
        for (const child of Object.values(record)) visit(child);
      };
      visit(eventCommandsOf(event));
    }
  }
  return out;
}

/**
 * DB 물건·적 그룹이 프로젝트 어디에서도 참조되지 않는가.
 *
 * 왜 유용한가: 기본 DB 는 물건 228개·적 그룹 7개를 들고 시작한다. 실제 프로젝트 30개 중
 * 14개(물건)·16개(적)가 **전부 미사용**이었고, 그 상태에서는 상점을 열어도 살 것이 없다.
 * 반대로 하나라도 쓰이면 침묵한다 — 「안 쓰는 물건이 몇 개 있다」는 정리 제안이지 결함이 아니다.
 */
function referencedIds(project: Project): { items: Set<string>; troops: Set<string> } {
  const items = new Set<string>();
  const troops = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const entry of value) visit(entry); return; }
    const record = value as Record<string, unknown>;
    if (typeof record.itemId === "string") items.add(record.itemId);
    if (typeof record.troopId === "string") troops.add(record.troopId);
    if (Array.isArray(record.itemIds)) for (const id of record.itemIds) if (typeof id === "string") items.add(id);
    if (Array.isArray(record.troopIds)) for (const id of record.troopIds) if (typeof id === "string") troops.add(id);
    for (const child of Object.values(record)) visit(child);
  };
  // 맵 **전체**를 본다 — 적 그룹은 이벤트뿐 아니라 맵 레벨(troopIds·encounterTable·fieldSpawns)
  // 에서도 참조된다. 이벤트만 보면 그렇게 쓰는 프로젝트를 「어디에서도 안 쓴다」고 오판한다.
  for (const map of Object.values(project.maps)) visit(map);
  // 적 그룹은 드랍으로 물건을 참조한다 — 함께 보지 않으면 드랍 전용 물건을 미사용으로 오판한다.
  visit(project.database.troops);
  visit(project.commonEvents);
  // 제작법은 system 에 산다 — database 로 읽으면 타입 오류다(2026-09-20 실측).
  for (const recipe of project.system.craftRecipes ?? []) visit(recipe);
  return { items, troops };
}

/** Facts only: suggestions never assert that an intentionally empty field is a defect. */
export function inspectProjectSuggestions(project: Project, mapId: string): ProjectSuggestion[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const result: ProjectSuggestion[] = [];
  const add = (id: string, title: string, evidence: string, request: string, facts: unknown, point?: { x: number; y: number }) => {
    result.push({ id, title, evidence, request: "「" + map.name + "」맵에서 " + request + " 다른 내용은 유지해줘.", mapId,
      fingerprint: JSON.stringify([map.name, facts]), ...point });
  };
  // Traverse nested conditional/choice commands as data, without interpreting or executing them.
  let visited = 0;
  for (const event of map.events) {
    const visit = (value: unknown, path: string): void => {
      if (++visited > 10000 || !value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach((v, i) => visit(v, path + "." + i)); return; }
      const c = value as Record<string, unknown>;
      const who = event.name || "이벤트";
      if (shopHasNoStock(c) && project.database.items.length) {
        add("shop:" + event.id + path, "상점에 판매할 물건을 연결할까요?",
          who + "의 판매 목록이 비어 있고, DB에 물건 " + project.database.items.length + "개가 있어요. 판매 전용이 아닌 상점이라면 그대로 둬도 돼요.",
          "이벤트 「" + who + "」(" + event.id + ")의 빈 판매 목록에 넣을 물건을 DB에서 골라 제안해줘.",
          [event, project.database.items.map(i => [i.id, i.name])], { x: event.x, y: event.y });
      }
      if (c.kind === "transfer" && typeof c.mapId === "string" && !project.maps[c.mapId]) {
        add("transfer:" + event.id + path, "이동할 맵을 다시 연결할까요?",
          who + "가 가리키는 목적지 맵이 현재 프로젝트에 없어요.",
          "이벤트 「" + who + "」(" + event.id + ")의 없는 이동 목적지를 확인하고 연결할 맵을 제안해줘.",
          [event, Object.keys(project.maps)], { x: event.x, y: event.y });
      }
      for (const [key, child] of Object.entries(c)) if (child && typeof child === "object") visit(child, path + "." + key);
    };
    visit(event.pages?.length ? event.pages : event.commands, "");
  }
  if ((map.encounterRate ?? 0) > 0 && !map.troopIds?.length && !map.encounterTable?.length && project.database.troops.length) {
    add("encounters", "걸을 때 만날 적을 골라볼까요?",
      "이 맵은 적 만나기가 켜져 있지만 목록이 비어 있어요. DB에 적 그룹 " + project.database.troops.length + "개가 있어요.",
      "맵 분위기에 맞는 적 그룹을 DB에서 골라 적 만나기 목록에 넣을 구성을 제안해줘.",
      [map.encounterRate, project.database.troops.map(t => [t.id, t.name])]);
  }
  // ── 저작 여정 규칙 (2026-09-20). 위 셋은 「만든 것의 연결이 빠졌다」만 잡으므로, 처음
  //    만드는 중인 맵에서도 할 말이 있도록 아래를 더한다. 전부 현재 맵 한 장만 본다.
  const inspection = collectMapInspection(project, mapId);
  const links = inspection?.links;
  if (links && links.playLinkCount === 0 && map.events.length > 0) {
    add("no-exit", "이 맵으로 드나드는 길을 만들까요?",
      "들어오거나 나가는 이동이 하나도 없어서 지금은 시작 맵에서 걸어서 올 수 없어요.",
      "들어오고 나가는 이동(문·계단)을 만들고, 시작 맵에서 걸어서 닿는지 확인해줘.",
      [links.playLinkCount, map.events.map(e => [e.id, e.name])]);
  }
  if (map.events.length === 0) {
    add("no-events", "이 맵에 무엇을 놓을까요?",
      map.width + "×" + map.height + " 맵에 이벤트가 아직 하나도 없어요.",
      "맵 분위기에 맞는 장소·등장인물·문을 자연스럽게 배치해줘.",
      [map.width, map.height]);
  } else if (map.events.every((event) => eventCommandsOf(event).length === 0)) {
    add("empty-events", "이벤트에 동작을 넣을까요?",
      "이벤트 " + map.events.length + "개가 놓여 있지만 아직 아무 동작도 하지 않아요.",
      "놓여 있는 이벤트들이 말을 걸거나 이동시키도록 동작을 채워줘.",
      [map.events.map(e => e.id)]);
  }
  const landings = impassableLandings(project, mapId);
  if (landings.length > 0) {
    const first = landings[0]!;
    const x = Number(first.command.x);
    const y = Number(first.command.y);
    add("landing-impassable", "막힌 곳으로 들어오는 문을 고칠까요?",
      "이 맵으로 들어오는 문 " + landings.length + "개가 통행 불가 칸(" + x + ", " + y + ")에 착지해요. 걸어서 빠져나올 수 없어요.",
      "들어오는 문 " + landings.length + "개의 착지 좌표를 통행 가능한 칸으로 옮겨줘.",
      [landings.map(entry => [entry.event.id, entry.command.x, entry.command.y])], { x, y });
  }
  const referenced = referencedIds(project);
  const items = project.database.items;
  if (items.length > 0 && items.every((item) => !referenced.items.has(item.id))) {
    add("items-unused", "DB 물건을 하나라도 쓰게 할까요?",
      "DB에 물건 " + items.length + "개가 있지만 프로젝트 어디에서도 쓰이지 않아요. 상점을 열어도 살 것이 없어요.",
      "맵 분위기에 맞는 물건 몇 개를 골라 상점 판매 목록이나 보물상자 보상으로 연결해줘.",
      [items.map(i => i.id)]);
  }
  const troops = project.database.troops;
  if (troops.length > 0 && troops.every((troop) => !referenced.troops.has(troop.id))) {
    add("troops-unused", "DB 적 그룹을 하나라도 쓰게 할까요?",
      "DB에 적 그룹 " + troops.length + "개가 있지만 어느 맵에서도 만날 수 없어요.",
      "맵 분위기에 맞는 적 그룹을 골라 적 만나기 목록에 넣어줘.",
      [troops.map(t => t.id)]);
  }
  return result.slice(0, 12);
}

/** Model selects grounded candidates; unrecognized/free-form claims are never rendered. */
export function selectProjectSuggestions(text: string, candidates: readonly ProjectSuggestion[]): ProjectSuggestion[] {
  try {
    const ids: unknown = JSON.parse(text.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, ""));
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids)].flatMap(id => candidates.filter(c => c.id === id)).slice(0, 3);
  } catch { return []; }
}
