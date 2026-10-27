import type { Command, GameMap, Project } from "@/project/types";
import { canMove, cellPassability, inBounds } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { startStateOf } from "@/project/session";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { worldCanonHasContent } from "@/project/world/canon";
import { gameStructureProblems } from "./gameStructureGuard";

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
  // 오프닝 애니메틱 도구 30개는 여기 싣지 않는다(2026-10-27): 첫 요청이 97개로 불어 상한 80을 넘었다. 오프닝은 맨 끝 단계라
  // 입구 둘(plan_opening·get_animatic_capabilities)만 보이고 나머지는 find_tools 로 찾는다. 새 게임 한 줄 요청의 Pi 경로는
  // plainTurn 이 OPENING_ANIMATIC_AUTHORING_TOOLS 를 따로 얹는다(requestsFullGameOpeningProduction).
  return ["get_project_summary", "get_database_records", "read_project_wiki", "find_events", "list_resources", "generate_image_asset", "recommend_bgm", "get_soundtrack", "generate_original_bgm", "generate_original_se", "set_map_properties", "set_title_screen", "show_map_region", "upsert_event", "upsert_actor", "upsert_character_profile", "set_world_canon", "upsert_item", "upsert_equipment", "set_session_start", "plan_opening", "get_animatic_capabilities",
    ...(required.world || required.village || required.dungeon ? ["plan_world", "build_world"] : []),
    ...(required.village ? ["author_beodeul_town", "inspect_terrain", "place_terrain_house"] : []),
    // EasyRPG 던전 생성기는 폐기(retiredEasyRpgTilesets.ts). 던전은 author_dungeon(칩셋 어댑터), 어댑터가 못 짓는 장소는 등록 장소 가져오기.
    ...(required.dungeon ? ["author_dungeon", "list_spatial_designs", "import_region_reference", "create_transfer_pair", "place_chest"] : []),
    ...(required.party ? ["set_party"] : []),
    ...(required.battle ? ["upsert_enemy", "upsert_troop", "set_encounter_table"] : []),
  ];
}

export const ADVENTURE_AUTHORING_GUIDE = `요청한 모험의 완료 조건은 실제 플레이 연결이다. 먼저 기존 프로젝트 위키·세계관·인물·맵·DB를 조회한다.
첫 쓰기 순서는 세계관(set_world_canon 또는 read_project_wiki로 확인한 설정) → 핵심 인물(upsert_character_profile) → 주인공 액터(upsert_actor: appearanceId, faceResourceId, characterResourceId/characterIndex, battleCharacterResourceId, initialEquipment) → set_party로 시작 파티 → set_session_start로 시작 소지금·아이템 → 나머지 DB·맵·이벤트다. 리소스 ID는 list_resources로 실제 목록을 조회해 고르고, 장비는 upsert_equipment로 만든 뒤 주인공 initialEquipment.weapon에 연결한다. 외형·인물·장비를 생략한 채 맵만 먼저 만드는 것은 완성된 RPG가 아니다.
음악·효과음도 저작한다. get_soundtrack으로 기존 배치를 읽고 맵 생성의 자동 BGM을 임시 선택으로 취급한다. 장소/서사 변화에 맞는 원곡 OST나 변주를 generate_original_bgm(score.loop:true)으로 작곡해 set_map_properties.bgm에 연결한다. 타이틀 키 이동/확정/취소는 generate_original_se의 짧고 조용한 서로 다른 소리를 set_title_screen.sounds에 연결한다. 사용자 원곡 요청은 후보 검색 없이 직접 작곡해도 된다. 기존 작곡 모티브의 의도적 재사용과 무관한 맵에 같은 기본 곡을 반복하는 것을 구분한다.
마을은 author_beodeul_town(집은 place_terrain_house)으로 건물과 길을 실제 시공한다. 잔디+흙길+사람은 마을 완성이 아니다.
던전 탐험을 요청했다면 author_dungeon({type?,genre?})으로 별도 던전 맵을 먼저 짓는다(칩셋 어댑터가 종류를 못 지으면 거절하며 가까운 종류를 권한다 — 그때는 권한 종류로 다시 부르거나 list_spatial_designs({kind:"place"})의 등록 장소를 import_region_reference({id,name})로 가져온다. EasyRPG 던전 생성기는 폐기됐다). 잔디 맵에 주택 벽 한 줄을 두는 것은 동굴이 아니다. 기존 맵의 무단 교체는 금지한다. 생성 결과의 통행 칸을 조회한 뒤 보물·적을 배치하고 create_transfer_pair로 왕복 연결하고 입구의 동굴/문/계단 외형을 조회해 사용한다. 사람 그림을 관문으로 쓰지 않는다.
기본 전투 적은 조회한 트룹을 set_encounter_table 또는 battleProcessing으로 도달 가능한 탐험 맵에 연결한다. 보스 적은 upsert_enemy에 role:"boss"를 주어 시작 파티 기준 위협 하한을 맞춘다. 기획에 등대가 있으면 등대 꼭대기 방을 build_hand_interior_room 으로 짓고 create_transfer_pair 로 마을과 잇는다.
파티 모험은 조회한 actors를 set_party({scope:"start",actorIds})로 시작 파티에 넣거나 changeParty 합류 이벤트를 만든다. add_companion의 시각 추종과 전투 파티는 다르다.
선택지는 분기 안에 결과가 있어야 한다: place_npc는 choices:[{text,commands:[...]}], 네이티브 choices 명령은 options:[{text,branch:[...]}]. 합류(changeParty)·보스전(battleProcessing, 승리 분기에 setSwitch)·엔딩을 분기에 넣고 run_scene_test의 {kind:"choose",index}로 결과(partyIncludes·switchOn·endingReached)를 확인한다.
기획에 엔딩이 있으면 define_ending으로 정의하고 마지막 사건(보스 승리 후 대화 등)의 commands 끝에 {kind:"triggerEnding",endingId}를 넣는다. 페이지 조건으로 쓴 스위치는 어떤 분기의 setSwitch가 반드시 켜야 한다.
아이템과 장비 모두 조회한 iconResourceId를 지정한다. 착용 무기는 upsert_equipment로 만들며 items의 legacy type:weapon은 쓰지 않는다.
JRPG(크로노 트리거·FF6·클래식 판타지)의 주인공·동료 걷기 칩은 list_resources({kind:"charset",query:"heroes"}) 로 CT·FF6풍 영웅 칩 Heroes1(8종, textureKey tex_oprn_charset_heroes1)을 먼저 보고 어울리는 칸을 characterResourceId:"oprn-charset-heroes1"+characterIndex 로 지정한다 — RTP Actor 는 어울리는 칸이 없을 때만 쓴다(Heroes1 에는 짝 얼굴이 없으니 얼굴은 list_resources faceset 에서 따로 고른다).
재시도는 find_events로 기존 ID를 읽고 upsert_event로 갱신한다. place_npc를 되풀이해 동명이인을 늘리지 않는다.
건물을 먼저 시공하고 NPC·상자는 나중에 배치한다. 기존 이벤트 위 시공 후에는 find_events로 겹침을 확인하고 upsert_event로 통행 가능한 자리로 옮긴다.
시대·평행세계처럼 같은 지리를 여러 벌 쓰는 게임은 맵을 따로 새로 칠하지 않는다 — derive_map_variant({sourceMapId, variants:[{id,era:"past"|"future"|"ruin"…,tileOverrides?}], gates?})로 한 번에 파생(이벤트 참조 자동 보정)하고 — 변형마다 시대 겉모습(조명 색조·안개·건물 철거·폐허/야영 조각)이 자동으로 걸리니 era 에 과거·미래·붕괴 낱말을 넣고, 결과 뒤 show_map_region 으로 현재 맵과 눈으로 구별되는지 확인하며 부족하면 tileOverrides 로 더 바꾼다, 시대 사이 문은 create_time_gate(effect, 잠그려면 unlockWhen+lockedMessage), 과거의 행동이 미래의 땅을 바꾸면 tile_change_effect, 세이브 포인트는 place_savepoint(mode:both). 전투 비교는 simulate_battle({useSkills:true}).
타이틀과 새로하기 오프닝도 #2852 레이어드 도트 애니메틱 **6샷**으로 함께 완성한다(외부 이미지 생성 도구 generate_title_art·generate_opening_image 는 호출하지 말고 list_opening_media 의 번들 스틸 oprn-still-kingdom-day, oprn-still-dark-citadel, oprn-still-snow-village, oprn-still-desert-ruin, oprn-still-farm-golden, oprn-still-forest-path, oprn-still-harbor 등(oprn-pack-still-* 는 목록에 보일 때만)에서 한 장면이 화면을 꽉 채우는 6장을 골라 쓴다 — 분할 화면·게임 UI가 박힌 참고 스틸(suitableForOpening:false, 예 oprn-still-hero-dawn)은 타이틀·오프닝 배경으로 거절된다): set_title_screen(title, backgroundResourceId:"oprn-still-...", openingPreset) 으로 작품 고유 타이틀을 구성하고, plan_opening(bible 포함, 6샷) → 6샷(shot_1..shot_6) 각각 create_opening_animatic_shot(shotId, durationMs:6500, width:384, height:216, background:"oprn-still-...") → set_opening_pixel_grid(384,216) → place_opening_background(6샷 모두 서로 다른 oprn-still-* 또는 oprn-pack-still-* 배경) → place_opening_charset_actor(charsetResourceId:"oprn-charset-heroes1", characterIndex:0..7, x:72, y:136, toX:200 등 보폭 걷기 포함) → upsert_opening_light_fx(kind:"shaft"|"glow") + animate_opening_camera(keys:{x,y,zoom}) → set_opening_caption(레터박스 자막, 전 샷 #fff0dc 통일) → set_opening(enabled:true, skippable:true, scenes:6개 animatic shotId 연결) → review_opening 순서로 저작한다. 글자만 있는 내레이션 카드나 정지 그림(kind:"image") 슬라이드, 또는 6샷 미만의 애니메틱으로 끝내지 않는다.
완료 직전 구조 점검(가드가 같은 것을 막는다): ① set_start_position 으로 시작 맵을 지은 게임의 첫 맵에 맞춘다(빈 시드 맵에서 시작하면 안 된다) ② 저작한 모든 맵이 시작 맵에서 문으로 닿는다(create_transfer_pair/create_time_gate) ③ define_ending 과 그것을 부르는 {kind:"triggerEnding"} 이벤트가 있다 ④ 새로하기 오프닝이 #2852 레이어드 도트 애니메틱 **6샷**(kind:"animatic" + pixelGrid 384×216 + 배경·캐릭터 칩 배우·광원/카메라·자막)으로 저장돼 있다.
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
      problems.push("시작 마을에 건물/벽/지붕 구조가 없습니다. author_beodeul_town 으로 실제 마을을 시공하세요.");
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
      const pass = tileset && inBounds(map, event.x, event.y) ? cellPassability(tileset, map, event.y * map.width + event.x) : null;
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
  // 시작 맵·맵 도달성·엔딩 호출 — 도구 한 번으로 풀리는 구조 결함이라 메시지가 다음 도구와 인자를 이름으로 준다(gameStructureGuard.ts).
  for (const problem of gameStructureProblems(project)) if (!problems.includes(problem)) problems.push(problem);
  return problems;
}
