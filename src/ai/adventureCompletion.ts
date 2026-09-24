import type { Command, GameMap, Project } from "@/project/types";
import { canMove, tileAt, tilePassability } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { startStateOf } from "@/project/session";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { worldCanonHasContent } from "@/project/world/canon";

/** Declared by the intent model, never inferred from incidental NPC/building words. */
export interface AdventureRequirements {
  village: boolean;
  dungeon: boolean;
  party: boolean;
  battle: boolean;
  /** Full-project authoring lanes. Optional for recovered/legacy declarations. */
  world?: boolean;
  characters?: boolean;
  appearance?: boolean;
}

/** Tools promised by the declared contract must be callable before the first write. */
export function adventureToolNames(required: AdventureRequirements | undefined): string[] {
  if (!required) return [];
  // A full RPG starts with its authored identity, not only maps and encounters.
  // Keep these in the preflight set so the first writer round can actually create
  // the protagonist's appearance/loadout and record the world/character canon.
  return ["get_project_summary", "get_database_records", "read_project_wiki", "find_events", "list_resources", "generate_image_asset", "recommend_bgm", "show_map_region", "upsert_event", "upsert_actor", "upsert_character_profile", "set_world_canon", "upsert_item", "upsert_equipment", "set_session_start",
    ...(required.world || required.village || required.dungeon ? ["plan_world", "build_world"] : []),
    ...(required.village ? ["author_house"] : []),
    ...(required.dungeon ? ["list_dungeon_room_themes", "run_dungeon_room_pipeline", "create_transfer_pair", "place_chest"] : []),
    ...(required.party ? ["set_party"] : []),
    ...(required.battle ? ["upsert_enemy", "upsert_troop", "set_encounter_table"] : []),
  ];
}

export const ADVENTURE_AUTHORING_GUIDE = `요청한 모험의 완료 조건은 실제 플레이 연결이다. 먼저 기존 프로젝트 위키·세계관·인물·맵·DB를 조회한다.
첫 쓰기 순서는 세계관(set_world_canon 또는 read_project_wiki로 확인한 설정) → 핵심 인물(upsert_character_profile) → 주인공 액터(upsert_actor: appearanceId, faceResourceId, characterResourceId/characterIndex, battleCharacterResourceId, initialEquipment) → set_party로 시작 파티 → set_session_start로 시작 소지금·아이템 → 나머지 DB·맵·이벤트다. 리소스 ID는 list_resources로 실제 목록을 조회해 고르고, 장비는 upsert_equipment로 만든 뒤 주인공 initialEquipment.weapon에 연결한다. 외형·인물·장비를 생략한 채 맵만 먼저 만드는 것은 완성된 RPG가 아니다.
마을은 author_village/author_house 등으로 건물과 길을 실제 시공한다. 잔디+흙길+사람은 마을 완성이 아니다.
던전 탐험을 요청했다면 list_dungeon_room_themes 조회 후 run_dungeon_room_pipeline({mapId,name,theme:"stone",hazard:true})로 별도 동굴을 먼저 시공한다. 잔디 맵에 주택 벽 한 줄을 두는 것은 동굴이 아니다. 기존 맵의 무단 교체는 금지한다. 생성 결과의 통행 칸을 조회한 뒤 보물·적을 배치하고 create_transfer_pair로 왕복 연결하고 입구의 동굴/문/계단 외형을 조회해 사용한다. 사람 그림을 관문으로 쓰지 않는다.
기본 전투 적은 조회한 트룹을 set_encounter_table 또는 battleProcessing으로 도달 가능한 탐험 맵에 연결한다. 보스 적은 upsert_enemy에 role:"boss"를 주어 시작 파티 기준 위협 하한을 맞춘다. 기획에 등대가 있으면 author_village에 landmark:"lighthouse"를 주어 외관을 세우고 돌려준 입구 좌표로 등대 맵과 잇는다. 등대 꼭대기 방은 run_dungeon_room_pipeline landmark:"beacon".
파티 모험은 조회한 actors를 set_party({scope:"start",actorIds})로 시작 파티에 넣거나 changeParty 합류 이벤트를 만든다. add_companion의 시각 추종과 전투 파티는 다르다.
선택지는 분기 안에 결과가 있어야 한다: place_npc는 choices:[{text,commands:[...]}], 네이티브 choices 명령은 options:[{text,branch:[...]}]. 합류(changeParty)·보스전(battleProcessing, 승리 분기에 setSwitch)·엔딩을 분기에 넣고 run_scene_test의 {kind:"choose",index}로 결과(partyIncludes·switchOn·endingReached)를 확인한다.
기획에 엔딩이 있으면 define_ending으로 정의하고 마지막 사건(보스 승리 후 대화 등)의 commands 끝에 {kind:"triggerEnding",endingId}를 넣는다. 페이지 조건으로 쓴 스위치는 어떤 분기의 setSwitch가 반드시 켜야 한다.
아이템과 장비 모두 조회한 iconResourceId를 지정한다. 착용 무기는 upsert_equipment로 만들며 items의 legacy type:weapon은 쓰지 않는다.
재시도는 find_events로 기존 ID를 읽고 upsert_event로 갱신한다. place_npc를 되풀이해 동명이인을 늘리지 않는다.
건물을 먼저 시공하고 NPC·상자는 나중에 배치한다. 기존 이벤트 위 시공 후에는 find_events로 겹침을 확인하고 upsert_event로 통행 가능한 자리로 옮긴다.
마지막 저작 후 모든 관련 맵 전체를 show_map_region(최대 24×24이므로 큰 맵은 분할 조회)으로 직접 보고, 입구·동선·외형과 중복을 확인한다. lint 무오류는 장르 완성이 아니다. 정식 퀘스트/보스는 요청 없으면 불필요하다.`;

function commands(map: GameMap): Array<{ event: GameMap["events"][number]; command: Command }> {
  const out: Array<{ event: GameMap["events"][number]; command: Command }> = [];
  for (const event of map.events) {
    const walk = (list: readonly Command[]) => {
      for (const command of list) {
        out.push({ event, command });
        for (const branch of eventCommandBranches(command)) walk(branch.commands);
      }
    };
    // Pages are authoritative; obsolete root commands cannot prove playability.
    if (event.pages?.length) for (const page of event.pages) walk(page.commands);
    else walk(event.commands);
  }
  return out;
}

function reachableCells(project: Project, map: GameMap, x: number, y: number): Set<string> {
  const seen = new Set<string>();
  const queue = [{ x, y }];
  const blocked = new Set(map.events.filter(e => e.pages?.some(p => p.priority === "same")).map(e => `${e.x},${e.y}`));
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return seen;
  seen.add(`${x},${y}`);
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = point.x + dx, ny = point.y + dy, key = `${nx},${ny}`;
      if (seen.has(key) || blocked.has(key) || !canMove(project, map, point.x, point.y, nx, ny)) continue;
      seen.add(key); queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

function accessible(cells: Set<string>, event: GameMap["events"][number]): boolean {
  if (cells.has(`${event.x},${event.y}`)) return true;
  if (!event.pages?.some(p => p.trigger.kind === "action")) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells.has(`${event.x + dx},${event.y + dy}`));
}

/** Structural lower bound; does not pretend to prove conditions, visual quality or fun. */
export function adventureCompletionProblems(project: Project, required: AdventureRequirements | undefined): string[] {
  if (!required) return [];
  const start = project.maps[project.startMapId];
  if (!start) return ["시작 맵이 없습니다."];
  const problems: string[] = [];
  if (required.world && !worldCanonHasContent(project.worldCanon) && !(project.world?.entities?.length)) {
    problems.push("세계관 정본이 없습니다. set_world_canon으로 시대·전제·톤·세계 법칙을 먼저 기록하세요.");
  }
  const hasCharacterDocuments = Object.keys(project.characters ?? {}).length > 0
    || (project.world?.entities ?? []).some(entity => entity.type === "character");
  if (required.characters && !hasCharacterDocuments) {
    problems.push("핵심 인물 설정이 없습니다. upsert_character_profile로 주인공·동료·핵심 NPC의 인물 프로필을 기록하세요.");
  }
  if (required.appearance) {
    const startActorIds = startStateOf(project).partyActorIds;
    const missingAppearance = project.database.actors.filter(actor => {
      if (!startActorIds.includes(actor.id)) return false;
      const shared = actor.appearanceId
        ? project.database.characterAppearances?.find(appearance => appearance.id === actor.appearanceId)
        : undefined;
      const hasFace = Boolean(actor.faceResourceId || shared?.face?.resourceId);
      const hasCharacter = Boolean(actor.characterResourceId || shared?.charset?.resourceId);
      return !hasFace || !hasCharacter;
    });
    if (missingAppearance.length > 0) problems.push(`시작 파티 외형이 비어 있습니다: ${missingAppearance.map(actor => actor.name).join(", ")}. list_resources 후 upsert_actor로 외형 ID 또는 얼굴·캐릭터 칩을 지정하세요.`);
  }
  if (required.village) {
    const tileset = project.tilesets[start.tilesetId];
    const structural = new Set((tileset?.tileGroups ?? []).filter(g => roleCapabilities(tileset, g.role).structure).flatMap(g => g.tileIds));
    if (![...start.lowerTiles, ...start.upperTiles].some(t => structural.has(t))) {
      problems.push("시작 마을에 건물/벽/지붕 구조가 없습니다. author_house/author_village로 실제 마을을 시공하세요.");
    }
  }
  const visited = new Set<string>();
  const pending = [{ mapId: start.id, ...project.startPos }];
  let battle = false;
  const explored = new Set<string>();
  const returnEdges = new Map<string, Set<string>>();
  const party = new Set(startStateOf(project).partyActorIds);
  const actorIds = new Set(project.database.actors.map(a => a.id));
  const troops = new Set(project.database.troops.filter(t => t.enemyIds.length > 0 && t.enemyIds.every(id => project.database.enemies.some(e => e.id === id))).map(t => t.id));
  for (let i = 0; i < pending.length; i++) {
    const point = pending[i], key = `${point.mapId}:${point.x},${point.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const map = project.maps[point.mapId];
    if (!map) continue;
    const cells = reachableCells(project, map, point.x, point.y);
    if (!cells.size) continue;
    if ((map.encounterRate ?? 0) > 0 && ((map.encounterTable ?? []).some(e => e.weight > 0 && troops.has(e.troopId)) || (!map.encounterTable?.length && map.troopIds?.some(id => troops.has(id))))) battle = true;
    if (map.fieldSpawns?.some(s => troops.has(s.troopId) && [...cells].some(key => { const [x,y] = key.split(',').map(Number); return x >= s.area.x && y >= s.area.y && x < s.area.x+s.area.w && y < s.area.y+s.area.h; }))) battle = true;
    for (const event of map.events) {
      const hasInteraction = commands(map).some(entry => entry.event === event && ["text", "changeItem", "changeGold", "changeParty", "battleProcessing"].includes(entry.command.kind));
      if (!hasInteraction) continue;
      const tileset = project.tilesets[map.tilesetId];
      const tile = tileAt(map, event.x, event.y);
      const pass = tileset && tilePassability(tileset, tile.lower, tile.upper);
      const occupiesFloor = event.pages?.some(page => page.graphic.sprite && !page.graphic.transparent);
      if (!accessible(cells, event) || (occupiesFloor && (!pass || !Object.values(pass).some(Boolean)))) {
        const issue = `맵 ${map.id} 이벤트 ${event.id}가 막힌 타일 위이거나 접근 불가입니다. 건물/벽 겹침을 확인하고 통행 가능한 자리로 옮기세요.`;
        if (!problems.includes(issue)) problems.push(issue);
      }
    }
    for (const { event, command } of commands(map)) {
      if (!accessible(cells, event)) continue;
      if (command.kind === "transfer" && project.maps[command.mapId]) {
        pending.push({ mapId: command.mapId, x: command.x, y: command.y });
        const edges = returnEdges.get(map.id) ?? new Set<string>();
        edges.add(command.mapId); returnEdges.set(map.id, edges);
      }
      if (command.kind === "changeGold" || command.kind === "changeItem" || command.kind === "battleProcessing") explored.add(map.id);
      if (command.kind === "battleProcessing" && troops.has(command.troopId)) battle = true;
      if (command.kind === "changeParty" && command.action === "add" && actorIds.has(command.actorId)) party.add(command.actorId);
    }
  }
  if (required.dungeon && ![...visited].some(key => !key.startsWith(`${start.id}:`))) problems.push("시작 마을에서 도달할 수 있는 탐험 맵 전이가 없습니다. 던전을 저작하고 create_transfer_pair로 연결하세요. 안내문은 입구가 아닙니다.");
  if (required.dungeon && [...visited].some(key => !key.startsWith(`${start.id}:`))) {
    const canReturn = new Set([start.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [from, targets] of returnEdges) if (!canReturn.has(from) && [...targets].some(to => canReturn.has(to))) { canReturn.add(from); changed = true; }
    }
    if (![...explored].some(id => id !== start.id && canReturn.has(id))) problems.push("던전의 도달 가능한 보물/전투 이벤트와 시작 마을 복귀 경로를 확인할 수 없습니다. 탐험 대상을 배치하고 create_transfer_pair로 왕복 연결하세요.");
  }
  if (required.battle && !battle) problems.push("도달 가능한 전투가 없습니다. 조회한 트룹을 조우표/필드 스폰/battleProcessing에 연결하세요. DB 시드만으로 전투는 시작되지 않습니다.");
  if (required.party && [...party].filter(id => actorIds.has(id)).length < 2) problems.push("전투 파티가 1명뿐이고 도달 가능한 changeParty 합류도 없습니다. 배우 ID 조회 후 시작 파티 또는 합류 이벤트를 저작하세요.");
  return problems;
}
