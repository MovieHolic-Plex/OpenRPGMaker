// 액션 RPG 데모 프로젝트 빌더 — 필드에서 바로 싸우는 실시간 전투를 실증한다.
//
// 액션 전투 활성 조건은 둘 다 필요하다(project/actionCombat.ts isActionCombatMap):
//   system.actionCombat.enabled === true  AND  map.actionCombat === true
//
// 사용:
//   npx tsx scripts/build-action-demo.mts            # 로컬 검증만(파일로 덤프)
//   npx tsx scripts/build-action-demo.mts --push     # Supabase 저장 + 재로드 검증
import { writeFileSync } from "node:fs";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { isSolidChipsetTile } from "@/project/defaults/chipsetMapping";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { sha256HexText } from "@/util/sha256";
import type {
  Command,
  EventPage,
  EventPageCondition,
  EventPageGraphic,
  FieldSpawnDef,
  GameEvent,
  Project,
} from "@/project/types";

// 필드 스폰 그래픽. 명시하지 않으면 fieldSpawns.ts 의 defaultFieldSpawnGraphic 이
// enemy.monsterResourceId(= generated-enemy-slime-01 등)를 uploaded 스프라이트로 가리키는데,
// 그건 전투 배틀러 이미지 id 라 project.assets.uploaded 에 없다. 결국
// resolveEventSpriteTexture 가 null 을 반환해 마을 사람 캐릭셋으로 폴백된다.
// 번들 몬스터 캐릭셋을 직접 지정해 필드에서 몬스터로 보이게 한다.
function charsetGraphic(textureKey: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: textureKey },
    direction: "down",
    // pattern 은 시트 전체 프레임 인덱스다(캐릭터 슬롯 + 방향행 + 걷기열).
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

// charsetSemantics.ts 기준: monster1#0 = 슬라임, monster3#0 = 박쥐형 날짐승.
const GFX_SLIME = charsetGraphic("tex_easyrpg_charset_monster1", 0);
const GFX_BAT = charsetGraphic("tex_easyrpg_charset_monster3", 0);

// 이벤트 그래픽도 같은 규칙. object2#3 = 받침대(안내판 대용), object1#6 = 보물 상자,
// people3#5 = 보라 갑옷 기사(문지기).
const GFX_SIGN = charsetGraphic("tex_easyrpg_charset_object2", 3);
const GFX_CHEST = charsetGraphic("tex_easyrpg_charset_object1", 6);
const GFX_GUARD = charsetGraphic("tex_easyrpg_charset_people3", 5);

const CLEARED_SWITCH = "sw_action_room_cleared";

// 데모 목표를 알려주고 보상을 주는 이벤트 3종.
// 지금까지 sw_action_room_cleared 를 켜는 쪽(spawn_boss_room)만 있고 읽는 쪽이 없어서,
// 보스방을 비워도 아무 일이 일어나지 않았다. (b)·(c) 가 그 스위치를 소비한다.
function buildDemoEvents(): GameEvent[] {
  return [
    // (a) 안내 표지판 — 시작 지점(10,8) 바로 옆.
    demoEvent("ev_action_sign", 11, 8, [
      demoPage("ev_action_sign_page", "안내판", GFX_SIGN, [], [
        say("안내판", "액션 훈련장. 여기서는 필드에서 바로 싸운다."),
        say("안내판", "이동: 방향키 / 공격: Z 또는 Space / 스킬: X"),
        say("안내판", "왼쪽 풀숲에는 슬라임, 오른쪽 돌바닥에는 박쥐가 나온다. 먼저 연습해라."),
        say("안내판", "준비되면 아래 방으로 내려가 안의 적을 모두 처치해라."),
      ]),
    ]),
    // (b) 보스방 문지기 — 입구(10,9) 바로 위. 스위치 상태로 페이지가 갈린다.
    demoEvent("ev_action_gatekeeper", 9, 8, [
      // 페이지 순서상 뒤쪽이 우선이므로 클리어 전 대사를 먼저 둔다.
      demoPage("ev_action_gatekeeper_before", "문지기(클리어 전)", GFX_GUARD, [], [
        say("문지기", "아래 방에서 뭔가 움직이는 소리가 난다."),
        say("문지기", "들어가면 도망칠 곳이 없다. 체력을 채우고 가라."),
      ]),
      demoPage(
        "ev_action_gatekeeper_after",
        "문지기(클리어 후)",
        GFX_GUARD,
        [{ kind: "switch", switchId: CLEARED_SWITCH, value: true }],
        [
          say("문지기", "방을 비웠군. 소리가 멎었다."),
          say("문지기", "안에 상자가 하나 남아 있다. 챙겨가라."),
        ]
      ),
    ]),
    // (c) 보상 상자 — 보스방 안(10,11). 클리어 전에는 아무것도 없는 페이지(투명).
    demoEvent("ev_action_reward", 10, 11, [
      demoPage("ev_action_reward_hidden", "보상 상자(숨김)", { transparent: true }, [], []),
      demoPage(
        "ev_action_reward_open",
        "보상 상자",
        GFX_CHEST,
        [{ kind: "switch", switchId: CLEARED_SWITCH, value: true }],
        [
          narrate("상자를 열었다."),
          { kind: "changeGold", op: "+=", amount: 300 },
          { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 3 },
          { kind: "changeItem", itemId: "item_elixir", op: "+=", amount: 1 },
          narrate("300 골드, 고급 물약 3개, 엘릭서 1개를 얻었다."),
          // 셀프스위치로 중복 수령을 막는다 — 이 페이지는 A 가 켜지면 더 이상 선택되지 않는다.
          { kind: "setSelfSwitch", key: "A", value: true },
        ],
        // 이미 받았으면(A=ON) 이 페이지를 건너뛰고 아래 '빈 상자' 페이지로 떨어진다.
        [{ kind: "selfSwitch", key: "A", value: false }]
      ),
      demoPage(
        "ev_action_reward_empty",
        "빈 상자",
        GFX_CHEST,
        [
          { kind: "switch", switchId: CLEARED_SWITCH, value: true },
          { kind: "selfSwitch", key: "A", value: true },
        ],
        [narrate("이미 비어 있다.")]
      ),
    ]),
  ];
}

function say(speaker: string, body: string): Command {
  return { kind: "text", speaker, body };
}

// 화자 없는 내레이션. speaker: "" 를 넘기면 이름표 자리만 빈 채로 남는다.
function narrate(body: string): Command {
  return { kind: "text", body };
}

function demoEvent(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages };
}

function demoPage(
  id: string,
  name: string,
  graphic: EventPageGraphic,
  conditions: EventPageCondition[],
  commands: Command[],
  extraConditions: EventPageCondition[] = []
): EventPage {
  return {
    id,
    name,
    conditions: [...conditions, ...extraConditions],
    graphic,
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    animationType: "normal",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

const PROJECT_ID = "rpg-zzu-action-demo";
const TITLE = "액션 RPG 데모";

// 타일 인덱스는 chipsetMapping 의 의미 그룹에서 골랐다. 통행성은 눈으로 믿지 말고
// 빌드 끝의 "[local] 통행성 검증" 이 실제로 확인한다 — 342 를 바닥으로 깔았다가
// 방 전체가 못 들어가는 방이 된 적이 있다.
const T = {
  grass: 240,      // 풀밭 (통행 가능)
  tallGrass: 243,  // 키큰 풀 — 슬라임 마당 표식
  road: 421,       // 흙길 중심 — 구역을 잇는 통로
  stone: 129,      // 돌 바닥 — 박쥐 구역
  // 342 는 통행 불가였다. 그 탓에 보스방 전체가 못 들어가는 방이 되고, 방 안의 보상
  // 상자도 도달 자체가 불가능했다(실측: 입구 (10,9) 에서 아래로 한 칸도 못 감).
  // COBBLE_TILE.BODY(190) 은 통행 가능하고 자갈 무늬라 흙길과도 구분된다.
  bossFloor: 190,  // 자갈 바닥(통행 가능)
  wall: 366,       // 어두운 벽 (통행 불가)
  water: 120,      // 호수 물 (통행 불가)
} as const;

/** 20x15 아레나를 실제 지형으로 저작한다 — 균일 잔디로는 데모가 성립하지 않는다. */
function paintArena(map: { width: number; height: number; lowerTiles: number[] }): void {
  const { width, height, lowerTiles } = map;
  const set = (x: number, y: number, tile: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    lowerTiles[y * width + x] = tile;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, tile: number): void => {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) set(x, y, tile);
  };

  // 바닥 전체를 풀밭으로 깔고 시작.
  fill(0, 0, width - 1, height - 1, T.grass);

  // 바깥 테두리는 벽 — 플레이어가 맵 밖으로 나가지 못하게 가둔다.
  fill(0, 0, width - 1, 0, T.wall);
  fill(0, height - 1, width - 1, height - 1, T.wall);
  fill(0, 0, 0, height - 1, T.wall);
  fill(width - 1, 0, width - 1, height - 1, T.wall);

  // 좌측 구역: 슬라임 마당 — 키큰 풀로 표시(스폰 영역 2,2~8,6 과 일치).
  fill(2, 2, 8, 6, T.tallGrass);
  // 우측 구역: 박쥐 소굴 — 돌 바닥(스폰 영역 11,2~17,6 과 일치).
  fill(11, 2, 17, 6, T.stone);
  // 두 구역 사이 벽 — 세로로 갈라 구역감을 준다(중앙 y=4 만 통로로 열어둠).
  fill(9, 1, 9, 6, T.wall);
  set(9, 4, T.road);

  // 가로 통로: 위쪽 두 구역과 아래 보스방을 잇는 흙길.
  fill(1, 7, width - 2, 8, T.road);

  // 보스방: 아래쪽 방. 벽으로 둘러싸고 위쪽 중앙을 입구로 남긴다.
  fill(5, 9, 14, 9, T.wall);
  fill(5, 9, 5, 13, T.wall);
  fill(14, 9, 14, 13, T.wall);
  fill(5, 13, 14, 13, T.wall);
  fill(6, 10, 13, 12, T.bossFloor);
  // 입구를 한 칸으로 두면 적 한 마리가 서 있는 것만으로 방에 들어갈 수 없다
  // (실측: 슬라임이 (10,9)를 막아 상자까지 도달 불가). 세 칸으로 넓힌다.
  fill(9, 9, 11, 9, T.road);

  // 물웅덩이 두 곳 — 통행 불가 장애물로 회피 플레이가 생긴다.
  fill(2, 10, 3, 12, T.water);
  fill(16, 10, 17, 12, T.water);
}

export function buildActionDemoProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("시작 맵이 없습니다.");

  map.name = "액션 훈련장";
  // 맵 단위 옵트인 — 이 플래그가 없으면 접촉이 턴제 전투로 라우팅된다.
  map.actionCombat = true;

  paintArena(map);

  // 필드 스폰 3종. area 는 맵(20x15) 안쪽으로 잡아 경계 밖 배치를 피한다.
  const spawns: FieldSpawnDef[] = [
    {
      // 입문용: 느리게 추격하는 슬라임. 계속 리스폰되어 스윙 연습이 가능하다.
      id: "spawn_slime_yard",
      troopId: "troop_slime",
      graphic: GFX_SLIME,
      area: { x: 2, y: 2, w: 7, h: 5 },
      maxAlive: 3,
      respawnSec: 6,
      chase: true,
    },
    {
      // 중급: 빠른 박쥐 무리. 회피/무적시간 체감용.
      id: "spawn_bat_flock",
      troopId: "troop_bat_swarm",
      graphic: GFX_BAT,
      area: { x: 11, y: 2, w: 7, h: 5 },
      maxAlive: 2,
      respawnSec: 9,
      chase: true,
    },
    {
      // 클리어 목표: 처치가 세이브에 남아 다시 안 나온다(persistKill). 전멸 시 스위치 ON.
      id: "spawn_boss_room",
      troopId: "troop_slime_pair",
      graphic: GFX_SLIME,
      // y:9 는 벽/입구 줄이라 보스가 문간에 스폰해 입구를 막았다. 방 안(10~12)으로 한정한다.
      area: { x: 6, y: 10, w: 8, h: 3 },
      maxAlive: 2,
      respawnSec: 0,
      chase: true,
      persistKill: true,
      onKillSwitchId: "sw_action_room_cleared",
    },
  ];
  map.fieldSpawns = spawns;

  project.switches.push({ id: "sw_action_room_cleared", name: "액션 방 클리어" });

  map.events = buildDemoEvents();

  // 시스템 패키지 — 하트 HUD + 적 HP 바 상시 표시로 피드백을 강하게.
  project.system.actionCombat = {
    enabled: true,
    playerIframesMs: 800,
    swingCooldownMs: 300,
    swingDamageBonus: 5,
    hud: { hearts: true, enemyHpBars: "always" },
  };

  // 근접 무기 프로필 — 사거리 1칸, 빠른 스윙.
  const sword = project.database.equipment.find((entry) => entry.id === "equip_sword");
  if (sword) sword.actionWeapon = { swingRange: 1, swingCooldownMs: 300, swingDamageBonus: 5 };

  // 원거리 스킬 — 투사체. 액션 전투에서 거리 유지 플레이가 가능해진다.
  const bolt = project.database.skills.find((entry) => entry.id === "skill_arcane_bolt");
  if (bolt) bolt.actionSkill = { kind: "projectile", damage: 12, range: 8, speedTilesPerSec: 9 };

  // 적 액션 프로필 — 접촉 데미지·어그로·이동 주기·근접 공격 타이밍.
  const enemyTuning: Record<string, { contactDamage: number; aggroRange: number; moveIntervalMs: number; windupMs: number; damage: number }> = {
    enemy_slime: { contactDamage: 4, aggroRange: 6, moveIntervalMs: 520, windupMs: 600, damage: 6 },
    enemy_meadow_slime: { contactDamage: 5, aggroRange: 6, moveIntervalMs: 480, windupMs: 550, damage: 7 },
    enemy_cave_bat: { contactDamage: 6, aggroRange: 8, moveIntervalMs: 260, windupMs: 350, damage: 8 },
  };
  for (const enemy of project.database.enemies) {
    const tuning = enemyTuning[enemy.id];
    if (!tuning) continue;
    enemy.actionProfile = {
      contactDamage: tuning.contactDamage,
      aggroRange: tuning.aggroRange,
      moveIntervalMs: tuning.moveIntervalMs,
      knockbackResist: 0.2,
      attack: { kind: "melee", windupMs: tuning.windupMs, recoverMs: 400, damage: tuning.damage, range: 1, cooldownMs: 1200 },
    };
  }

  // 주인공이 검을 들고 시작해야 스윙 프로필이 적용된다.
  const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
  if (hero) hero.initialEquipment = { ...hero.initialEquipment, weapon: "equip_sword" };

  // 타이틀 화면은 meta.title 이 아니라 system.titleScreen.title 을 읽는다 — 둘 다 맞춰야
  // 플레이 시 "새 프로젝트" 가 뜨지 않는다.
  project.meta.title = TITLE;
  project.system.titleScreen = { ...project.system.titleScreen, title: TITLE };
  return project;
}

// --- 실행부 ---------------------------------------------------------------

const project = buildActionDemoProject();

// 로컬 검증: 직렬화 → 역직렬화(스키마·참조 검증 포함)가 통과해야 저장 가치가 있다.
const json = serialize(project);
const reloaded = deserialize(json);
const reloadedMap = reloaded.maps[reloaded.startMapId];
console.log("[local] 역직렬화 통과");

// 통행성 검증 — 342(솔리드)를 보스방 바닥으로 깔아 방 전체가 못 들어가는 방이 됐던 적이 있다.
// 시작 지점과 각 스폰/이벤트 칸이 실제로 걸어 들어갈 수 있는지 빌드 때 확인한다.
if (reloadedMap) {
  const tileAt = (x: number, y: number): number => reloadedMap.lowerTiles[y * reloadedMap.width + x] ?? -1;
  const blocked: string[] = [];
  const check = (label: string, x: number, y: number): void => {
    if (isSolidChipsetTile(tileAt(x, y))) blocked.push(`${label}(${x},${y}) 타일 ${tileAt(x, y)}`);
  };
  check("시작 지점", reloaded.startX, reloaded.startY);
  for (const spawn of reloadedMap.fieldSpawns ?? []) {
    // 스폰 영역에 걸어 들어갈 수 있는 칸이 하나라도 있어야 한다.
    let walkable = 0;
    for (let y = spawn.area.y; y < spawn.area.y + spawn.area.h; y += 1) {
      for (let x = spawn.area.x; x < spawn.area.x + spawn.area.w; x += 1) {
        if (!isSolidChipsetTile(tileAt(x, y))) walkable += 1;
      }
    }
    console.log(`[local] 스폰 ${spawn.id} 통행 가능 칸 = ${walkable}`);
    if (walkable === 0) blocked.push(`스폰 ${spawn.id} 영역 전체가 통행 불가`);
  }
  for (const event of reloadedMap.events) {
    // 이벤트 자체 칸은 막혀 있어도 되지만(상자/표지판), 인접한 칸 중 하나는 걸어갈 수 있어야 조사할 수 있다.
    const neighbours = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
    const reachable = neighbours.some(([dx, dy]) => !isSolidChipsetTile(tileAt(event.x + dx, event.y + dy)));
    if (!reachable) blocked.push(`이벤트 ${event.id}(${event.x},${event.y}) 에 접근할 칸이 없다`);
  }
  if (blocked.length > 0) {
    console.error("[local] 통행성 검증 실패:\n  - " + blocked.join("\n  - "));
    process.exit(1);
  }
  console.log("[local] 통행성 검증 통과");
}
console.log("[local] actionCombat.enabled =", reloaded.system.actionCombat?.enabled);
console.log("[local] map.actionCombat     =", reloadedMap?.actionCombat);
console.log("[local] fieldSpawns          =", reloadedMap?.fieldSpawns?.length ?? 0, "종");
console.log("[local] 적 actionProfile 보유 =", reloaded.database.enemies.filter((e) => e.actionProfile).length, "종");
console.log("[local] JSON 크기            =", json.length, "자");

if (!process.argv.includes("--push")) {
  writeFileSync("tmp/action-demo.json", json, "utf8");
  console.log("[local] tmp/action-demo.json 에 덤프했습니다. 저장하려면 --push 를 붙이세요.");
  process.exit(0);
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("[error] SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 필요합니다.");
  process.exit(2);
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  // 에디터와 동일 계약: 쓰기는 Content-Profile, 읽기는 Accept-Profile 로 rpg_zzu 스키마를 지정한다.
  "Content-Profile": "rpg_zzu",
  Prefer: "resolution=merge-duplicates,return=representation",
};

// 행 모양은 supabaseProjectSync.ts 의 upsert 페이로드와 동일하게 맞춘다.
// current_sha256 · terrain_template_count 는 DB NOT NULL 이라 반드시 채워야 한다.
const terrainTemplateCount = Object.values(project.tilesets).reduce((sum, tileset) => {
  const templates = (tileset as { terrainTemplates?: unknown }).terrainTemplates;
  return sum + (Array.isArray(templates) ? templates.length : 0);
}, 0);

const row = {
  project_id: PROJECT_ID,
  title: TITLE,
  schema_version: project.version,
  current_json: JSON.parse(json),
  current_sha256: await sha256HexText(json),
  map_count: Object.keys(project.maps).length,
  tileset_count: Object.keys(project.tilesets).length,
  terrain_template_count: terrainTemplateCount,
};

const upsert = await fetch(`${url}/rest/v1/projects?on_conflict=project_id`, {
  method: "POST",
  headers,
  body: JSON.stringify(row),
});
if (!upsert.ok) {
  console.error("[push] 실패", upsert.status, (await upsert.text()).slice(0, 400));
  process.exit(1);
}
console.log("[push] 업서트 성공:", PROJECT_ID);

// maps 테이블도 반드시 같이 쓴다. 로드 경로(loadProjectSnapshotFromSupabase)는
// current_json 을 읽은 뒤 maps.map_json 으로 맵 본문을 **덮어쓴다**(overlayMapsFromRows).
// projects 행만 갱신하면 낡은 maps 행이 새 맵을 가려서, 저장은 성공했는데
// 게임에는 옛 맵이 나오는 유령 상태가 된다.
const mapRows = await Promise.all(
  Object.values(project.maps).map(async (map) => ({
    project_id: PROJECT_ID,
    map_id: map.id,
    name: map.name,
    width: map.width,
    height: map.height,
    tileset_id: map.tilesetId,
    lower_sha256: await sha256HexText(JSON.stringify(map.lowerTiles)),
    upper_sha256: await sha256HexText(JSON.stringify(map.upperTiles)),
    lower_tile_count: map.lowerTiles.length,
    upper_tile_count: map.upperTiles.length,
    map_json: map,
  }))
);
const mapsUpsert = await fetch(`${url}/rest/v1/maps?on_conflict=project_id,map_id`, {
  method: "POST",
  headers,
  body: JSON.stringify(mapRows),
});
if (!mapsUpsert.ok) {
  console.error("[push] maps 실패", mapsUpsert.status, (await mapsUpsert.text()).slice(0, 400));
  process.exit(1);
}
console.log("[push] maps 업서트 성공:", mapRows.length, "행");

// 재로드 검증 — 저장했다는 응답이 아니라 실제로 다시 읽어서 확인한다.
const verify = await fetch(
  `${url}/rest/v1/projects?project_id=eq.${PROJECT_ID}&select=project_id,title,map_count,current_json`,
  { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Accept-Profile": "rpg_zzu" } }
);
const rows = (await verify.json()) as { project_id: string; title: string; map_count: number; current_json: unknown }[];
if (rows.length !== 1) {
  console.error("[verify] 재로드 실패 — 행 수:", rows.length);
  process.exit(1);
}
const roundTripped = deserialize(JSON.stringify(rows[0].current_json));
const verifyMap = roundTripped.maps[roundTripped.startMapId];
console.log("[verify] project_id       =", rows[0].project_id);
console.log("[verify] title            =", rows[0].title);
console.log("[verify] actionCombat     =", roundTripped.system.actionCombat?.enabled);
console.log("[verify] map.actionCombat =", verifyMap?.actionCombat);
console.log("[verify] fieldSpawns      =", verifyMap?.fieldSpawns?.length ?? 0, "종");
// maps 오버레이까지 포함해 검증한다 — 게임이 실제로 보는 맵 본문은 이쪽이다.
const verifyMaps = await fetch(
  `${url}/rest/v1/maps?project_id=eq.${PROJECT_ID}&map_id=eq.${roundTripped.startMapId}&select=map_json`,
  { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Accept-Profile": "rpg_zzu" } }
);
const mapJsonRows = (await verifyMaps.json()) as { map_json: { fieldSpawns?: { id: string; graphic?: unknown }[] } }[];
const overlaySpawns = mapJsonRows[0]?.map_json?.fieldSpawns ?? [];
console.log("[verify] maps 오버레이 fieldSpawns =", overlaySpawns.length, "종");
for (const spawn of overlaySpawns) {
  console.log("[verify]   ", spawn.id, "graphic =", JSON.stringify(spawn.graphic));
}
if (overlaySpawns.some((spawn) => spawn.graphic === undefined)) {
  console.error("[verify] maps 오버레이에 스폰 그래픽이 없다 — 런타임이 마을 사람으로 폴백한다.");
  process.exit(1);
}
console.log("[verify] 재로드 검증 통과");
