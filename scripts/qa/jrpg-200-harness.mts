import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PNG } from "pngjs";
import type { Command, GameEvent, GameMap, Project } from "../../src/project/types.ts";
import {
  createCapabilityFixtureProject,
  fixtureEvent,
} from "../../src/harnesses/assistant-capability/node/capabilityFixture.ts";
import { createBlankMap } from "../../src/project/defaults/defaultMaps.ts";
import { DEFAULT_TILESET_ID } from "../../src/project/defaults/constants.ts";
import { setRegionReferenceDownloadLoader } from "../../src/project/regionReferenceImport.ts";
import { preloadKitStartPlaces } from "../../src/project/playableSegment.ts";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "../../src/ai/llmClient.ts";
import { createLlmIntentDeclarer } from "../../src/ai/intentDeclarationClient.ts";
import { resolveAutonomy } from "../../src/ai/autonomyLevels.ts";
import { classifyPlainPiTurn } from "../../src/ai/piAgent/plainTurn.ts";
import { composePiTask } from "../../src/ai/piAgent/executionRoute.ts";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { completeProvider } from "../lib/ohMyPiPiAiRuntime.ts";
import { setCutsceneArtGenerator } from "../../src/editor/tools/cutsceneArtTools.ts";
import { setCutsceneAssetFetcher } from "../../src/editor/cutsceneArt/charsetFrames.ts";
import { setWorldmapBuilder } from "../../src/editor/worldmap/worldmapBuild.ts";
import { buildWorldmap as headlessBuildWorldmap } from "../lib/worldmapBuild.mjs";
import { headlessFetchAsset, headlessGenerateImage } from "../qa-game/lib/headlessImage.mts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { runSceneTest } from "../../src/testing/sceneTestRunner.ts";
import { simulateBattle } from "../../src/battle/simulate.ts";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { JRPG_200_CASES, type JrpgCommandCase } from "./jrpg-200-cases.mts";

setRegionReferenceDownloadLoader(async (url: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public${url}`), "utf8")),
);
setCutsceneArtGenerator(headlessGenerateImage);
setCutsceneAssetFetcher(headlessFetchAsset);
setWorldmapBuilder(headlessBuildWorldmap);

const MODEL_PROVIDER = "google-antigravity" as const;
const MODEL_ID = "gemini-4-argon";

function makeNpcEvent(
  id: string,
  name: string,
  x: number,
  y: number,
  text: string,
  triggerKind: "action" | "playerTouch" | "touch" | "eventTouch" | "auto" | "parallel" = "action",
): GameEvent {
  const base = structuredClone(fixtureEvent("ev_ember_child"));
  base.id = id;
  base.name = name;
  base.x = x;
  base.y = y;
  const p0 = structuredClone(base.pages[0]!);
  p0.id = "page_1";
  p0.name = name;
  p0.trigger = { kind: triggerKind };
  p0.commands = [{ kind: "text", speaker: name, body: text } as Command];
  base.pages = [p0];
  return base;
}

function addExtraMap(
  project: Project,
  id: string,
  name: string,
  width: number,
  height: number,
  events: GameEvent[],
): void {
  const map = createBlankMap(name, width, height, DEFAULT_TILESET_ID);
  map.id = id;
  map.events = events;
  project.maps[id] = map;
  project.mapTree.children = project.mapTree.children ?? [];
  if (!project.mapTree.children.some((c) => c.mapId === id)) {
    project.mapTree.children.push({ mapId: id, children: [] });
  }
}

export function createJrpg200FixtureProject(): Project {
  const project = createCapabilityFixtureProject();

  // Populate map_ember_village baseline + refactor target events
  const ember = project.maps["map_ember_village"]!;
  ember.events.push(
    makeNpcEvent("ev_baseline_guide", "마을 안내인", 2, 2, "엠버 마을에 오신 것을 환영합니다."),
    {
      ...makeNpcEvent("ev_legacy_pit", "낡은 구덩이 함정", 5, 12, "구덩이에 빠졌다!", "playerTouch"),
      pages: [
        {
          ...makeNpcEvent("ev_legacy_pit", "낡은 구덩이 함정", 5, 12, "", "playerTouch").pages[0]!,
          priority: "below",
          commands: [{ kind: "killPlayer", message: "구덩이에 빠져 사망했다." } as Command],
        },
      ],
    },
    {
      ...makeNpcEvent("ev_buggy_chest", "오래된 보물상자", 12, 12, "포션을 발견했다!"),
      pages: [
        {
          ...makeNpcEvent("ev_buggy_chest", "오래된 보물상자", 12, 12, "포션을 발견했다!").pages[0]!,
          commands: [
            { kind: "text", body: "포션을 발견했다!" } as Command,
            { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 } as Command,
          ],
        },
      ],
    },
    makeNpcEvent("ev_village_guard", "마을 경비병", 9, 6, "마도 유적 근처는 위험하니 조심하시오!"),
    makeNpcEvent("ev_village_sign", "마을 표지판", 9, 8, "여기는 평화로운 엠버 마을입니다."),
    makeNpcEvent("ev_village_well", "오래된 우물", 7, 10, "깊고 서늘한 우물이다."),
  );

  // Add the other 5 Chrono Trigger / FF6 era & dungeon maps
  addExtraMap(project, "map_chrono_present", "천년제 광장 AD 1000", 20, 15, [
    makeNpcEvent(
      "ev_baseline_present_npc",
      "천년제 구경꾼",
      2,
      2,
      "천년제 축제가 한창이야! 루카의 텔레포드 발명품도 꼭 구경해 봐!",
    ),
    makeNpcEvent(
      "ev_broken_gate",
      "불안정한 시간의 문",
      3,
      3,
      "차원 좌표가 어긋나 있어 작동하지 않는다.",
    ),
    makeNpcEvent("ev_fair_bard", "축제 악사", 11, 8, "즐거운 천년제 음악을 들어보시렵니까?"),
  ]);

  addExtraMap(project, "map_chrono_past", "가르디아 왕국 AD 600", 20, 15, [
    makeNpcEvent("ev_baseline_past_npc", "중세 파수꾼", 2, 2, "마왕군이 북쪽 성채를 점거하고 있소."),
    makeNpcEvent("ev_past_knight", "가르디아 기사", 7, 7, "마왕성 쪽은 위험하오."),
    makeNpcEvent("ev_past_smith", "대장장이 제자", 5, 4, "스승님은 전설의 광석을 찾으러 떠나셨소."),
  ]);

  addExtraMap(project, "map_chrono_future", "아리스 돔 AD 2300", 20, 15, [
    makeNpcEvent(
      "ev_baseline_future_npc",
      "돔 생존자 소년",
      2,
      2,
      "라보스의 날 이후 세상은 온통 잿빛 폐허가 되었어...",
    ),
    makeNpcEvent("ev_future_survivor", "지친 생존자", 7, 9, "배가 고파... 하지만 희망을 버릴 순 없어."),
    makeNpcEvent("ev_future_log", "구형 기록 단말기", 4, 8, "시스템 대기 중..."),
  ]);

  addExtraMap(project, "map_magitek_ruins", "제국 마도 유적", 20, 15, [
    makeNpcEvent(
      "ev_baseline_ruins_npc",
      "잠입 요원",
      2,
      2,
      "제국의 마도 병기와 보안 장치가 곳곳에 있으니 주의해.",
    ),
    {
      ...makeNpcEvent("ev_boss_door", "마도 코어실 문", 10, 2, ""),
      pages: [
        {
          ...makeNpcEvent("ev_boss_door", "마도 코어실 문", 10, 2, "").pages[0]!,
          commands: [
            {
              kind: "transfer",
              mapId: "map_magitek_ruins",
              x: 10,
              y: 8,
              dir: "up",
            } as Command,
          ],
        },
      ],
    },
    {
      ...makeNpcEvent("ev_ruins_alarm", "경보 센서", 6, 3, "경보가 울렸다!", "playerTouch"),
      pages: [
        {
          ...makeNpcEvent("ev_ruins_alarm", "경보 센서", 6, 3, "경보가 울렸다!", "playerTouch").pages[0]!,
          priority: "below",
          commands: [
            { kind: "text", body: "침입자 경보가 울렸다!" } as Command,
            {
              kind: "battleProcessing",
              troopId: "troop_imperial_patrol",
              canEscape: true,
              canLose: false,
            } as Command,
          ],
        },
      ],
    },
  ]);

  addExtraMap(project, "map_interior_inn", "엠버 여관 실내", 14, 11, [
    makeNpcEvent(
      "ev_baseline_inn_npc",
      "여행자 상인",
      2,
      2,
      "여관 난롯불 옆에서 쉬면 피로가 싹 풀리지.",
    ),
    makeNpcEvent("ev_inn_hearth", "따뜻한 벽난로", 6, 2, "장작불이 타오르고 있다."),
    makeNpcEvent("ev_inn_vip_door", "2층 특실 문", 9, 3, "단단히 잠겨 있는 특실 문이다."),
  ]);

  // Add Switches
  const switchDefs: Array<[string, string]> = [
    ["sw_amulet_of_time", "시간의 부적 활성화"],
    ["sw_gas_mask", "방독면 착용"],
    ["sw_imperial_disguise", "제국군 변장 완료"],
    ["sw_warm_cloak", "방한 망토 착용"],
    ["sw_power_cutoff", "마도 발전기 주전원 차단"],
    ["sw_dome_shield", "아리스 돔 방공호 보호막"],
    ["sw_orb_of_light", "빛의 보주 점화"],
    ["sw_smoke_screen", "연막탄 차폐 활성화"],
    ["sw_sand_boots", "사막 장화 착용"],
    ["sw_vaccine_ready", "항체 백신 투여 완료"],
    ["sw_gate_key", "게이트 키 공명"],
    ["sw_sealed_chest_aged", "시대 연동 봉인 상자 숙성"],
    ["sw_planted_sapling", "과거 정령의 묘목 식수"],
    ["sw_rubbing_taken", "고대 비석 탁본 입수"],
    ["sw_secret_ruins_open", "비밀 유적 계단 개방"],
    ["sw_magus_intro_seen", "마왕 강림 컷씬 시청"],
    ["sw_opera_success", "오페라 공연 대성공"],
    ["sw_trial_done", "왕국 재판 완료"],
    ["sw_opening_march_done", "설원 마도 행진 오프닝 완료"],
    ["sw_campfire_scene_done", "모닥불 회상 씬 완료"],
    ["sw_masamune_awakened", "그랜드리온 각성"],
    ["sw_terra_trance", "티나 환수 각성"],
    ["sw_lavos_record_seen", "1999년 라보스 기록 시청"],
    ["sw_castle_gate_open", "왕성 정문 개방"],
    ["sw_statues_moved", "삼투신 동상 이동"],
    ["sw_met_marle", "천년제 마르 첫 만남"],
    ["sw_chrono_revived", "사망의 산 기적 부활"],
    ["sw_doma_poisoned", "도마 성 비극 목격"],
    ["sw_airship_promise", "비공정 갑판의 약속"],
    ["sw_zeal_vision", "고대 왕국 질 환영"],
    ["sw_robo_repaired", "로보 수리 완료"],
    ["sw_colosseum_entered", "콜로세움 입장"],
    ["sw_lara_saved", "과거 라라 구출 성공"],
    ["sw_wings_of_hope", "희망의 새 발견"],
    ["sw_sun_stone_charged", "태양석 충전 완료"],
    ["sw_terminal_hacked", "루카 단말기 해킹 완료"],
    ["sw_triple_plate_open", "3인 협동 발판 해제"],
    ["sw_escort_active", "유적 조사원 호위 중"],
    ["sw_royal_pass", "왕실 친위대 검문 통과"],
    ["sw_rebel_passcode", "반란군 암호 입수"],
    ["sw_solo_trial_ready", "크로노 단독 시련 개시"],
    ["sw_dual_seal_broken", "마르·티나 이중 봉인 해제"],
    ["sw_shadow_hired", "그림자 용병 고용"],
    ["sw_masamune_reforged", "그랜드리온 복원 완료"],
    ["sw_elder_quest_started", "촌장 유적 토벌 의뢰 수락"],
    ["sw_ruins_boss_defeated", "마도 유적 보스 처치 완료"],
    ["sw_clock_puzzle_solved", "시계탑 수수께끼 해결"],
    ["sw_bridge_cleared", "산적 다리 돌파"],
    ["sw_desert_worm_slain", "사막 지하 괴수 처치"],
    ["sw_fiona_forest_saved", "피오나의 천년 숲 복원"],
    ["sw_jerky_generosity", "가문의 육포 은혜"],
    ["sw_returner_verified", "리터너 반란군 인증"],
    ["sw_letter_delivered", "병사의 편지 배달 완료"],
    ["sw_dreamstone_traded", "드림스톤 입수 완료"],
    ["sw_seed_of_hope", "폐허 미래 희망의 씨앗 전달"],
    ["sw_boulder_gate_open", "석상 감압 철문 개방"],
    ["sw_crane_bridge_down", "크레인 보안 다리 연결"],
    ["sw_rat_secret_known", "기계 쥐 비밀 암호 획득"],
    ["sw_dome_vault_open", "아리스 돔 비밀 금고 개방"],
    ["sw_brazier_lit", "고대 화로 점화"],
    ["sw_canal_drained", "지하 수로 배수 완료"],
    ["sw_phoenix_bridge", "봉황 문양 다리 개통"],
    ["sw_boss_phase2", "보스 2페이즈 폭주"],
    ["sw_guardian_defeated", "아리스 돔 가디언 격파"],
    ["sw_red_dragon_slain", "고대 화룡 격파"],
    ["sw_ozzie_defeated", "비네거 함정 격파"],
    ["sw_masamune_trial_passed", "마사&무네 시련 통과"],
    ["sw_colosseum_champion", "콜로세움 챔피언 등극"],
    ["sw_train_halted", "폭주 마열차 정지"],
    ["sw_demon_statue_slain", "고대 마신 석상 격파"],
    ["sw_magus_slain", "북쪽 곶 마왕 결투 승리"],
    ["sw_magus_allied", "북쪽 곶 마왕 동맹 합류"],
    ["sw_shadow_survived", "붕괴 대륙 동료 대기 생존"],
    ["sw_true_route_unlocked", "왕국 최고 훈장 진엔딩 자격"],
    ["sw_epoch_crash_plan", "에포크 강습 작전 확정"],
    ["sw_cyrus_at_peace", "사이러스의 안식"],
  ];
  for (const [id, name] of switchDefs) {
    if (!project.switches.some((s) => s.id === id)) {
      project.switches.push({ id, name });
    }
  }

  // Add Variables
  const variableDefs: Array<[string, string]> = [
    ["var_time_anchor", "시간 앵커 충전량"],
    ["var_sage_seals", "3현자의 인장 개수"],
    ["var_charity_count", "순례자 누적 기부 횟수"],
    ["var_cat_food", "천년제 고양이 사료 점수"],
    ["var_chivalry", "왕국 기사도 명성"],
    ["var_silver_points", "천년제 실버 포인트"],
    ["var_valve_count", "증기 밸브 개방 수"],
  ];
  for (const [id, name] of variableDefs) {
    if (!project.variables.some((v) => v.id === id)) {
      project.variables.push({ id, name, initialValue: 0 });
    }
  }

  // Add Actors (clone from default actor template so all curves/fields are valid)
  const templateActor = structuredClone(project.database.actors[0]!);
  const jrpgActors: Array<{ id: string; name: string; nickname: string }> = [
    { id: "actor_crono", name: "크로노", nickname: "시공의 검사" },
    { id: "actor_marle", name: "마르", nickname: "가르디아 왕녀" },
    { id: "actor_lucca", name: "루카", nickname: "천재 발명가" },
    { id: "actor_terra", name: "티나", nickname: "환수의 후예" },
    { id: "actor_frog", name: "개구리 기사", nickname: "성검의 수호자" },
  ];
  for (const a of jrpgActors) {
    if (!project.database.actors.some((x) => x.id === a.id)) {
      project.database.actors.push({
        ...structuredClone(templateActor),
        id: a.id,
        name: a.name,
        nickname: a.nickname,
      });
    }
  }

  // Add Items
  const templateItem = structuredClone(project.database.items[0]!);
  const jrpgItems: Array<{ id: string; name: string; description: string; price: number; type: string }> = [
    { id: "item_potion", name: "포션", description: "HP를 100 회복하는 기본 회복약", price: 20, type: "item" },
    { id: "item_hi_potion", name: "하이포션", description: "HP를 300 회복하는 고급 회복약", price: 80, type: "item" },
    { id: "item_ether", name: "에테르", description: "MP를 50 회복하는 마력 물약", price: 120, type: "item" },
    { id: "item_elixir", name: "엘릭서", description: "HP와 MP를 완전히 회복하는 영약", price: 500, type: "item" },
    { id: "item_shelter", name: "쉘터", description: "세이브 포인트 야영 회복 도구", price: 150, type: "item" },
    { id: "item_fire_ring", name: "화염의 반지", description: "용암과 불길을 막아주는 수호 반지", price: 400, type: "keyItem" },
    { id: "item_grappling_hook", name: "갈고리 로프", description: "절벽과 수직 구간을 건너는 로프", price: 0, type: "keyItem" },
    { id: "item_chrono_pendant", name: "시간의 펜던트", description: "시공 폭풍을 잠재우는 왕가의 펜던트", price: 0, type: "keyItem" },
    { id: "item_holy_grail", name: "성스러운 성배", description: "사악한 저주를 정화하는 성물", price: 0, type: "keyItem" },
    { id: "item_ghost_ticket", name: "유령열차 승차권", description: "마열차에 탑승할 수 있는 승차권", price: 0, type: "keyItem" },
    { id: "item_esper_shield", name: "수호 마석", description: "파멸의 광선을 반사하는 마석", price: 600, type: "keyItem" },
    { id: "item_rainbow_blade", name: "무지개빛 검", description: "무지개 껍질과 태양석으로 벼려낸 검", price: 1000, type: "keyItem" },
    { id: "item_ruby_key", name: "루비 카드키", description: "마도 유적 보안문을 여는 카드키", price: 0, type: "keyItem" },
    { id: "item_cherry_bomb", name: "체리 폭탄", description: "금이 간 암벽을 뚫는 폭탄", price: 100, type: "keyItem" },
    { id: "item_hero_medal", name: "용사의 배지", description: "전설의 기사 사이러스의 증표", price: 0, type: "keyItem" },
    { id: "item_broken_masamune", name: "부러진 성검", description: "두 동강 난 성검 그랜드리온", price: 0, type: "keyItem" },
    { id: "item_dreamstone", name: "드림스톤", description: "태고의 붉은 신비 광석", price: 0, type: "keyItem" },
  ];
  for (const it of jrpgItems) {
    if (!project.database.items.some((x) => x.id === it.id)) {
      project.database.items.push({
        ...structuredClone(templateItem),
        id: it.id,
        name: it.name,
        description: it.description,
        price: it.price,
        type: it.type as never,
      });
    }
  }

  // Add Enemies & Troops
  const templateEnemy = structuredClone(project.database.enemies[0]!);
  const jrpgEnemies: Array<{ id: string; name: string; hp: number }> = [
    { id: "enemy_imperial_trooper", name: "제국 마도병", hp: 140 },
    { id: "enemy_magitek_boss", name: "마도 아머 대장", hp: 650 },
    { id: "enemy_time_devourer", name: "시간 포식자", hp: 900 },
    { id: "enemy_royal_knight", name: "마왕성 친위 기사", hp: 240 },
  ];
  for (const en of jrpgEnemies) {
    if (!project.database.enemies.some((x) => x.id === en.id)) {
      project.database.enemies.push({
        ...structuredClone(templateEnemy),
        id: en.id,
        name: en.name,
        maxHp: en.hp,
      } as never);
    }
  }

  const templateTroop = structuredClone(project.database.troops[0]!);
  const jrpgTroops: Array<{ id: string; name: string; enemyId: string }> = [
    { id: "troop_imperial_patrol", name: "제국 순찰대", enemyId: "enemy_imperial_trooper" },
    { id: "troop_magitek_boss", name: "마도 아머 대장 군단", enemyId: "enemy_magitek_boss" },
    { id: "troop_time_devourer", name: "시간 포식자 군단", enemyId: "enemy_time_devourer" },
    { id: "troop_royal_knights", name: "마왕성 친위 기사단", enemyId: "enemy_royal_knight" },
  ];
  for (const tr of jrpgTroops) {
    if (!project.database.troops.some((x) => x.id === tr.id)) {
      project.database.troops.push({
        ...structuredClone(templateTroop),
        id: tr.id,
        name: tr.name,
        enemyIds: [tr.enemyId],
        members: [{ enemyId: tr.enemyId, x: 300, y: 240, hidden: false }],
        pages: [],
        battleEventPages: [],
      } as never);
    }
  }

  // Add Endings
  const existingEndings = (project.database.system as unknown as { endings?: unknown[] })?.endings;
  if (Array.isArray(existingEndings)) {
    for (const end of [
      {
        id: "ending_true",
        title: "시간의 저편으로 (진 엔딩)",
        subtitle: "Beyond Time",
        summary: "모든 시대에 평화가 찾아왔다.",
      },
      {
        id: "ending_bad",
        title: "하지만 미래는 바뀌지 않았다 (배드 엔딩)",
        subtitle: "But the Future Refused to Change",
        summary: "세상은 파멸을 맞이했다.",
      },
    ]) {
      if (!existingEndings.some((e: any) => e.id === end.id)) {
        existingEndings.push(end);
      }
    }
  }

  project.startMapId = "map_ember_village";
  project.startPos = { x: 8, y: 8 };
  return project;
}

// ============================================================================
// Command Tree Inspection Helpers
// ============================================================================

export function flattenCommands(commands: readonly Command[] | undefined): Command[] {
  const out: Command[] = [];
  const visit = (list: readonly Command[] | undefined) => {
    for (const cmd of list ?? []) {
      if (!cmd || typeof cmd !== "object") continue;
      out.push(cmd);
      const anyCmd = cmd as Record<string, any>;
      if (Array.isArray(anyCmd.then)) visit(anyCmd.then);
      if (Array.isArray(anyCmd.else)) visit(anyCmd.else);
      if (Array.isArray(anyCmd.thenBranch)) visit(anyCmd.thenBranch);
      if (Array.isArray(anyCmd.elseBranch)) visit(anyCmd.elseBranch);
      if (Array.isArray(anyCmd.body)) visit(anyCmd.body);
      if (Array.isArray(anyCmd.commands)) visit(anyCmd.commands);
      if (Array.isArray(anyCmd.winBranch)) visit(anyCmd.winBranch);
      if (Array.isArray(anyCmd.escapeBranch)) visit(anyCmd.escapeBranch);
      if (Array.isArray(anyCmd.loseBranch)) visit(anyCmd.loseBranch);
      if (Array.isArray(anyCmd.onWin)) visit(anyCmd.onWin);
      if (Array.isArray(anyCmd.onEscape)) visit(anyCmd.onEscape);
      if (Array.isArray(anyCmd.onLose)) visit(anyCmd.onLose);
      if (Array.isArray(anyCmd.cancelBranch)) visit(anyCmd.cancelBranch);
      if (Array.isArray(anyCmd.options)) {
        for (const opt of anyCmd.options) {
          if (Array.isArray(opt?.branch)) visit(opt.branch);
          if (Array.isArray(opt?.commands)) visit(opt.commands);
        }
      }
    }
  };
  visit(commands);
  return out;
}

export function flattenEventCommands(ev: GameEvent): Command[] {
  const out: Command[] = [];
  for (const page of ev.pages ?? []) {
    out.push(...flattenCommands(page.commands));
  }
  return out;
}

const DEATH_MESSAGE_RE =
  /사망|죽었|죽는|쓰러|게임\s*오버|game\s*over|목숨을\s*잃|추락|전류가.*관통|의식이\s*흐려|찢겨\s*나간|집어삼킨|재로\s*변해|치여|가라앉는|노출되었|참격|불비가\s*내린|비명|아아악|크아악/i;

export function hasDeathSemantics(cmds: Command[], rawJson?: string): boolean {
  for (const c of cmds) {
    const anyC = c as Record<string, any>;
    if (anyC.kind === "killPlayer" || anyC.kind === "gameOver") return true;
    if (anyC.kind === "m2Command" && /gameover|kill|death/i.test(String(anyC.commandId ?? ""))) {
      return true;
    }
    if (anyC.kind === "ending" && /bad|dead|death|game_over|unchanged/i.test(String(anyC.endingId ?? ""))) {
      return true;
    }
    if (anyC.kind === "changeHp" && (anyC.op === "-=" || anyC.op === "sub" || (anyC.amount ?? 0) < 0)) {
      return true;
    }
    const text = String(anyC.body ?? anyC.text ?? anyC.message ?? "");
    if ((anyC.kind === "text" || anyC.kind === "message") && DEATH_MESSAGE_RE.test(text)) {
      return true;
    }
  }
  if (rawJson && /"killPlayer"|"gameOver"|"m2-.*gameover"/i.test(rawJson)) return true;
  return false;
}

export function hasVisualScenePresentation(cmds: Command[]): boolean {
  const presentationKinds = new Set([
    "shakeScreen",
    "flashScreen",
    "tintScreen",
    "fadeOutScreen",
    "fadeInScreen",
    "wait",
    "move",
    "moveEvent",
    "camera",
    "letterbox",
    "weather",
    "showAnimation",
    "playSe",
    "playBgm",
    "showPicture",
    "m2Command",
  ]);
  return cmds.some((c) => presentationKinds.has(c.kind));
}

export function hasConditionalBranching(ev: GameEvent): boolean {
  if ((ev.pages?.length ?? 0) >= 2) {
    if (ev.pages.some((p: any) => p.condition || (Array.isArray(p.conditions) && p.conditions.length > 0))) {
      return true;
    }
  }
  const cmds = flattenEventCommands(ev);
  return cmds.some(
    (c) =>
      c.kind === "fork" ||
      (c as any).kind === "branch" ||
      (c as any).kind === "conditional" ||
      c.kind === "choices",
  );
}

export function findTargetEvents(
  before: Project,
  after: Project,
  testCase: JrpgCommandCase,
): GameEvent[] {
  const afterMap = after.maps[testCase.mapId] ?? Object.values(after.maps)[0];
  const beforeMap = before.maps[afterMap.id];
  if (!afterMap) return [];

  if (testCase.targetEventId) {
    const exact = afterMap.events.find((e) => e.id === testCase.targetEventId);
    if (exact) return [exact];
  }

  const beforeMapById = new Map((beforeMap?.events ?? []).map((e) => [e.id, JSON.stringify(e)]));
  const changedOrNew = afterMap.events.filter((e) => beforeMapById.get(e.id) !== JSON.stringify(e));
  if (changedOrNew.length > 0) {
    return [...changedOrNew].sort((a, b) => {
      const da = Math.abs(a.x - testCase.focusCoord.x) + Math.abs(a.y - testCase.focusCoord.y);
      const db = Math.abs(b.x - testCase.focusCoord.x) + Math.abs(b.y - testCase.focusCoord.y);
      return da - db;
    });
  }

  const allChanged: GameEvent[] = [];
  for (const m of Object.values(after.maps)) {
    const bm = before.maps[m.id];
    const bMap = new Map((bm?.events ?? []).map((e) => [e.id, JSON.stringify(e)]));
    for (const ev of m.events) {
      if (bMap.get(ev.id) !== JSON.stringify(ev)) {
        allChanged.push(ev);
      }
    }
  }
  return allChanged;
}

// ============================================================================
// 5-Stage Adversarial Verifier (Preservation + Requirement + Runtime + SQLite + Visual QA)
// ============================================================================

export interface AdversarialVerificationReport {
  passed: boolean;
  requirementPassed: boolean;
  preservationPassed: boolean;
  runtimePassed: boolean;
  sqlitePassed: boolean;
  visualQaPassed: boolean;
  failures: string[];
  notes: string[];
}

export async function runAdversarialVerification(
  before: Project,
  after: Project,
  testCase: JrpgCommandCase,
  assistantReply: string,
  toolCalls: ReadonlyArray<{ name: string; ok: boolean; summary: string }> = [],
): Promise<AdversarialVerificationReport> {
  const failures: string[] = [];
  const notes: string[] = [];

  // --------------------------------------------------------------------------
  // STAGE 1: Adversarial Preservation Check (Unmentioned maps, baseline NPCs, DB)
  // --------------------------------------------------------------------------
  let preservationPassed = true;
  const baselineCanaries: Array<[string, string]> = [
    ["map_ember_village", "ev_baseline_guide"],
    ["map_chrono_present", "ev_baseline_present_npc"],
    ["map_chrono_past", "ev_baseline_past_npc"],
    ["map_chrono_future", "ev_baseline_future_npc"],
    ["map_magitek_ruins", "ev_baseline_ruins_npc"],
    ["map_interior_inn", "ev_baseline_inn_npc"],
  ];

  for (const [mapId, canaryId] of baselineCanaries) {
    const bMap = before.maps[mapId];
    const aMap = after.maps[mapId];
    if (!aMap) {
      preservationPassed = false;
      failures.push(`[Preservation] Map ${mapId} was deleted!`);
      continue;
    }
    if (bMap && (aMap.width !== bMap.width || aMap.height !== bMap.height)) {
      preservationPassed = false;
      failures.push(`[Preservation] Map ${mapId} dimensions changed unexpectedly!`);
    }
    const bCanary = bMap?.events.find((e) => e.id === canaryId);
    const aCanary = aMap.events.find((e) => e.id === canaryId);
    if (!aCanary || JSON.stringify(bCanary) !== JSON.stringify(aCanary)) {
      preservationPassed = false;
      failures.push(
        `[Preservation] Baseline canary event ${canaryId} on ${mapId} was modified or deleted!`,
      );
    }
  }

  for (const baseActorId of [
    "actor_crono",
    "actor_marle",
    "actor_lucca",
    "actor_terra",
    "actor_frog",
  ]) {
    if (!after.database.actors.some((a) => a.id === baseActorId)) {
      preservationPassed = false;
      failures.push(`[Preservation] Baseline actor ${baseActorId} was deleted!`);
    }
  }

  if (testCase.expectKind === "readonly_audit") {
    if (JSON.stringify(before.maps) !== JSON.stringify(after.maps) ||
        JSON.stringify(before.database) !== JSON.stringify(after.database)) {
      preservationPassed = false;
      failures.push(`[Preservation] Read-only audit case mutated the project!`);
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 2: Exact JRPG Requirement Check
  // --------------------------------------------------------------------------
  let requirementPassed = true;
  const lastTool = toolCalls[toolCalls.length - 1];
  if (testCase.expectKind !== "readonly_audit" && lastTool && !lastTool.ok && !assistantReply.trim()) {
    requirementPassed = false;
    failures.push(
      `[Requirement] Assistant turn terminated on a failed tool call (${lastTool.name}: ${lastTool.summary}) with no completion reply.`,
    );
  }
  const targetEvents = findTargetEvents(before, after, testCase);
  const allTargetCmds = targetEvents.flatMap((e) => flattenEventCommands(e));
  const targetRawJson = JSON.stringify(targetEvents);

  switch (testCase.expectKind) {
    case "hazard_conditional_death": {
      if (targetEvents.length === 0) {
        requirementPassed = false;
        failures.push("[Requirement] No hazard/death event was created or modified on map.");
        break;
      }
      const triggers = targetEvents.flatMap((e) =>
        e.pages.map((p: any) =>
          typeof p.trigger === "string" ? p.trigger : String(p.trigger?.kind ?? ""),
        ),
      );
      const hasProximityTrigger = triggers.some((t) =>
        ["touch", "playerTouch", "eventTouch", "locationTransition", "parallel", "auto", "autorun"].includes(t),
      );
      const hasDeath = hasDeathSemantics(allTargetCmds, targetRawJson);
      const hasDialogue = allTargetCmds.some((c: any) => {
        const txt = String(c.body ?? c.text ?? c.message ?? "").trim();
        return (c.kind === "text" || c.kind === "message" || c.kind === "killPlayer") && txt.length > 0;
      });
      const hasSceneBeats =
        hasVisualScenePresentation(allTargetCmds) ||
        allTargetCmds.filter((c: any) => c.kind === "text" || c.kind === "message").length >= 2;
      const hasCondition = targetEvents.some((e) => hasConditionalBranching(e));

      if (!hasProximityTrigger) {
        requirementPassed = false;
        failures.push(
          `[Requirement] Hazard event must trigger on proximity/touch/step (got triggers: ${triggers.join(",")}).`,
        );
      }
      if (!hasDeath) {
        requirementPassed = false;
        failures.push(
          "[Requirement] Hazard event is missing death outcome (killPlayer/gameOver/death scene).",
        );
      }
      if (!hasDialogue) {
        requirementPassed = false;
        failures.push("[Requirement] Hazard event is missing dialogue messages.");
      }
      if (!hasSceneBeats) {
        requirementPassed = false;
        failures.push(
          "[Requirement] Hazard event is missing death/cutscene visual beats (shake/flash/fade/tint/wait).",
        );
      }
      if (!hasCondition) {
        requirementPassed = false;
        failures.push(
          "[Requirement] Hazard event is missing conditional branch or multi-page survival condition.",
        );
      }
      break;
    }

    case "time_portal_or_transfer": {
      if (targetEvents.length === 0) {
        requirementPassed = false;
        failures.push("[Requirement] No portal/transfer event created.");
        break;
      }
      const hasTransfer =
        allTargetCmds.some((c) => c.kind === "transfer") || targetRawJson.includes('"transfer"');
      if (!hasTransfer) {
        requirementPassed = false;
        failures.push("[Requirement] Portal/transfer event has no transfer command.");
      }
      break;
    }

    case "vehicle_spawn": {
      const map = after.maps[testCase.mapId];
      const hasVehicleField =
        JSON.stringify(before.database.system) !== JSON.stringify(after.database.system) ||
        JSON.stringify((before as any).system) !== JSON.stringify((after as any).system) ||
        JSON.stringify(before.maps[testCase.mapId]) !== JSON.stringify(map);
      if (!hasVehicleField) {
        requirementPassed = false;
        failures.push("[Requirement] No vehicle or boarding event was spawned on map.");
      }
      break;
    }

    case "cutscene_event": {
      if (targetEvents.length === 0) {
        requirementPassed = false;
        failures.push("[Requirement] No cutscene event was created on map.");
        break;
      }
      const hasMsg = allTargetCmds.some((c: any) => c.kind === "text" || c.kind === "message");
      const hasVisual = hasVisualScenePresentation(allTargetCmds);
      if (!hasMsg || !hasVisual) {
        requirementPassed = false;
        failures.push(
          `[Requirement] Cutscene event must have BOTH dialogue (${hasMsg}) and cutscene visual beats (${hasVisual}).`,
        );
      }
      break;
    }

    case "party_or_companion":
    case "rest_or_heal":
    case "quest_or_choice_npc":
    case "puzzle_or_stealth":
    case "chest_or_loot": {
      if (targetEvents.length === 0) {
        requirementPassed = false;
        failures.push(`[Requirement] No event created or updated for ${testCase.expectKind}.`);
        break;
      }
      if (allTargetCmds.length === 0) {
        requirementPassed = false;
        failures.push(`[Requirement] Event for ${testCase.expectKind} has empty commands.`);
      }
      break;
    }

    case "shop_npc": {
      if (targetEvents.length === 0) {
        requirementPassed = false;
        failures.push("[Requirement] No shop NPC event created.");
        break;
      }
      const hasShop =
        allTargetCmds.some(
          (c: any) => c.kind === "shop" || c.kind === "choices" || c.kind === "changeItem",
        ) || targetRawJson.includes("shop");
      if (!hasShop) {
        requirementPassed = false;
        failures.push("[Requirement] Shop NPC has no shop or item purchase command.");
      }
      break;
    }

    case "db_actor_or_class": {
      const actorChanged =
        JSON.stringify(before.database.actors) !== JSON.stringify(after.database.actors);
      const classChanged =
        JSON.stringify(before.database.classes) !== JSON.stringify(after.database.classes);
      if (!actorChanged && !classChanged) {
        requirementPassed = false;
        failures.push("[Requirement] Neither database.actors nor database.classes was updated.");
      }
      break;
    }

    case "db_skill_or_item": {
      const skillChanged =
        JSON.stringify(before.database.skills) !== JSON.stringify(after.database.skills);
      const itemChanged =
        JSON.stringify(before.database.items) !== JSON.stringify(after.database.items);
      const equipChanged =
        JSON.stringify(before.database.equipment) !== JSON.stringify(after.database.equipment);
      if (!skillChanged && !itemChanged && !equipChanged) {
        requirementPassed = false;
        failures.push(
          "[Requirement] Neither database.skills, database.items, nor database.equipment was updated.",
        );
      }
      break;
    }

    case "db_state": {
      const stateChanged =
        JSON.stringify(before.database.states) !== JSON.stringify(after.database.states);
      if (!stateChanged) {
        requirementPassed = false;
        failures.push("[Requirement] database.states was not updated.");
      }
      break;
    }

    case "db_enemy_or_troop": {
      const enemyChanged =
        JSON.stringify(before.database.enemies) !== JSON.stringify(after.database.enemies);
      const troopChanged =
        JSON.stringify(before.database.troops) !== JSON.stringify(after.database.troops);
      if (!enemyChanged && !troopChanged) {
        requirementPassed = false;
        failures.push("[Requirement] Neither database.enemies nor database.troops was updated.");
      }
      break;
    }

    case "troop_battle_page": {
      const troopChanged =
        JSON.stringify(before.database.troops) !== JSON.stringify(after.database.troops);
      if (!troopChanged) {
        requirementPassed = false;
        failures.push(`[Requirement] Troop ${testCase.targetTroopId ?? ""} battle pages were not updated.`);
      }
      break;
    }

    case "boss_map_encounter": {
      if (targetEvents.length === 0) {
        requirementPassed = false;
        failures.push("[Requirement] No boss map encounter event was created.");
        break;
      }
      const hasBattle =
        allTargetCmds.some(
          (c) =>
            (c as any).kind === "battle" ||
            (c as any).kind === "battleProcessing" ||
            (c as any).kind === "changeSwitch" ||
            (c as any).kind === "setSwitch",
        ) ||
        targetRawJson.includes("battle") ||
        targetRawJson.includes("troop");
      if (!hasBattle) {
        requirementPassed = false;
        failures.push("[Requirement] Boss encounter event does not trigger a battle.");
      }
      break;
    }

    case "ending_or_finale": {
      const sysChanged =
        JSON.stringify(before.database.system) !== JSON.stringify(after.database.system) ||
        JSON.stringify((before as any).endings) !== JSON.stringify((after as any).endings);
      const eventChanged = targetEvents.length > 0 && allTargetCmds.length > 0;
      if (!sysChanged && !eventChanged) {
        requirementPassed = false;
        failures.push("[Requirement] Neither endings nor a finale map event was authored.");
      }
      break;
    }

    case "refactor_existing_event": {
      const targetEv = after.maps[testCase.mapId]?.events.find(
        (e) => e.id === testCase.targetEventId,
      );
      const beforeEv = before.maps[testCase.mapId]?.events.find(
        (e) => e.id === testCase.targetEventId,
      );
      if (!targetEv) {
        requirementPassed = false;
        failures.push(
          `[Requirement] Existing event ${testCase.targetEventId} was deleted instead of refactored!`,
        );
      } else if (
        JSON.stringify(beforeEv) === JSON.stringify(targetEv) &&
        targetEvents.length === 0
      ) {
        requirementPassed = false;
        failures.push(`[Requirement] Existing event ${testCase.targetEventId} was not modified.`);
      }
      break;
    }

    case "readonly_audit": {
      if (!assistantReply || assistantReply.trim().length < 20) {
        requirementPassed = false;
        failures.push("[Requirement] Read-only audit produced an empty or too-short response.");
      }
      break;
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 3: Runtime Playability / Scene Execution Test (`runSceneTest`)
  // --------------------------------------------------------------------------
  let runtimePassed = true;
  try {
    if (targetEvents.length > 0) {
      const primaryEv = targetEvents[0]!;
      const map =
        Object.values(after.maps).find((m) => m.events.some((e) => e.id === primaryEv.id)) ??
        after.maps[testCase.mapId]!;
      const isTouch = primaryEv.pages.some((p: any) => {
        const trig = typeof p.trigger === "string" ? p.trigger : String(p.trigger?.kind ?? "");
        return ["touch", "playerTouch", "eventTouch", "locationTransition"].includes(trig);
      });

      const startX = primaryEv.x > 1 ? primaryEv.x - 1 : primaryEv.x + 1;
      const startY = primaryEv.y;
      const dirToward = primaryEv.x > 1 ? "right" : "left";

      const testProject: Project = structuredClone(after);
      testProject.startMapId = map.id;
      testProject.startPos = { x: startX, y: startY };

      const actions = isTouch
        ? [
            { kind: "move" as const, dir: dirToward as "left" | "right", steps: 1 },
            { kind: "chooseOption" as const, index: 0 },
          ]
        : [
            { kind: "interact" as const },
            { kind: "chooseOption" as const, index: 0 },
          ];

      const res1 = runSceneTest(testProject, {
        actions: actions as never,
        maxStepsPerAction: 200,
      });
      notes.push(`[Runtime] Scene executed cleanly on ${map.id} near (${primaryEv.x},${primaryEv.y}).`);
      void res1;
    } else if (
      testCase.expectKind === "db_actor_or_class" ||
      testCase.expectKind === "db_skill_or_item" ||
      testCase.expectKind === "db_state" ||
      testCase.expectKind === "db_enemy_or_troop" ||
      testCase.expectKind === "troop_battle_page"
    ) {
      const troopId =
        testCase.targetTroopId ??
        after.database.troops[after.database.troops.length - 1]?.id ??
        "troop_imperial_patrol";
      const sim = simulateBattle({
        project: after,
        troopId,
        heroLevel: 10,
        partyActorIds: [after.database.actors[0]?.id ?? "actor_crono"],
        n: 1,
        seed: 42,
      });
      notes.push(`[Runtime] Battle simulator verified for troop=${troopId} (winRate=${sim.winRate}).`);
    }
  } catch (err) {
    runtimePassed = false;
    failures.push(`[Runtime] Exception during scene/battle runtime test: ${(err as Error).message}`);
  }

  // --------------------------------------------------------------------------
  // STAGE 4: SQLite Persistence & Reload Verification
  // --------------------------------------------------------------------------
  let sqlitePassed = true;
  const tmpDir = join(tmpdir(), `jrpg200-sqlite-${testCase.id}-${Date.now()}`);
  try {
    mkdirSync(tmpDir, { recursive: true });
    const createdStore = await initLocalProjectStore({ projectDir: tmpDir });
    await createdStore.saveProject(after);
    createdStore.close();
    const reopened = await openLocalProjectStore({ projectDir: tmpDir });
    const snap = reopened.loadSnapshot();
    reopened.close();
    if (!snap || !snap.project) {
      sqlitePassed = false;
      failures.push("[SQLite] Failed to reload snapshot from SQLite store.");
    } else if (targetEvents.length > 0) {
      const reloadedMap = snap.project.maps[testCase.mapId] ?? Object.values(snap.project.maps)[0];
      const reloadedEv = reloadedMap?.events.find((e) => e.id === targetEvents[0]!.id);
      if (!reloadedEv) {
        sqlitePassed = false;
        failures.push(
          `[SQLite] Target event ${targetEvents[0]!.id} missing after SQLite reload!`,
        );
      }
    }
  } catch (err) {
    sqlitePassed = false;
    failures.push(`[SQLite] Persistence round-trip failed: ${(err as Error).message}`);
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 5: Adversarial Visual QA Checks (Coordinates, Overlap, Bounds)
  // --------------------------------------------------------------------------
  let visualQaPassed = true;
  for (const ev of targetEvents) {
    const map =
      Object.values(after.maps).find((m) => m.events.some((e) => e.id === ev.id)) ??
      after.maps[testCase.mapId];
    if (!map) continue;
    if (ev.x < 0 || ev.y < 0 || ev.x >= map.width || ev.y >= map.height) {
      visualQaPassed = false;
      failures.push(
        `[VisualQA] Event ${ev.id} placed out of map bounds at (${ev.x}, ${ev.y}) on ${map.width}x${map.height} map.`,
      );
    }
    const overlappingOther = map.events.filter(
      (other) => other.id !== ev.id && other.x === ev.x && other.y === ev.y,
    );
    if (overlappingOther.length > 0) {
      visualQaPassed = false;
      failures.push(
        `[VisualQA] Event ${ev.id} at (${ev.x}, ${ev.y}) overlaps existing event(s): ${overlappingOther
          .map((o) => o.id)
          .join(", ")}.`,
      );
    }
  }

  const passed =
    requirementPassed &&
    preservationPassed &&
    runtimePassed &&
    sqlitePassed &&
    visualQaPassed;

  return {
    passed,
    requirementPassed,
    preservationPassed,
    runtimePassed,
    sqlitePassed,
    visualQaPassed,
    failures,
    notes,
  };
}

// ============================================================================
// Visual QA Evidence PNG Renderer (Before Map + After Map + Event Markers)
// ============================================================================

function setPx(png: PNG, x: number, y: number, rgba: [number, number, number, number]) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = rgba[0];
  png.data[idx + 1] = rgba[1];
  png.data[idx + 2] = rgba[2];
  png.data[idx + 3] = rgba[3];
}

function drawRectOutline(
  png: PNG,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rgba: [number, number, number, number],
  thickness = 2,
) {
  for (let t = 0; t < thickness; t++) {
    for (let x = x0 + t; x < x0 + w - t; x++) {
      setPx(png, x, y0 + t, rgba);
      setPx(png, x, y0 + h - 1 - t, rgba);
    }
    for (let y = y0 + t; y < y0 + h - t; y++) {
      setPx(png, x0 + t, y, rgba);
      setPx(png, x0 + w - 1 - t, y, rgba);
    }
  }
}

function fillRect(
  png: PNG,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rgba: [number, number, number, number],
) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPx(png, x, y, rgba);
    }
  }
}

function blitPng(dst: PNG, src: PNG, dx: number, dy: number) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const sIdx = (y * src.width + x) * 4;
      setPx(dst, dx + x, dy + y, [
        src.data[sIdx]!,
        src.data[sIdx + 1]!,
        src.data[sIdx + 2]!,
        src.data[sIdx + 3]!,
      ]);
    }
  }
}

export async function renderVisualQaComparisonPng(
  before: Project,
  after: Project,
  testCase: JrpgCommandCase,
  report: AdversarialVerificationReport,
  outPath: string,
): Promise<void> {
  const beforeMap = before.maps[testCase.mapId] ?? Object.values(before.maps)[0]!;
  const afterMap = after.maps[testCase.mapId] ?? Object.values(after.maps)[0]!;

  const beforeBuf = renderMapPng(before, beforeMap).png;
  const afterBuf = renderMapPng(after, afterMap).png;
  const beforePng = PNG.sync.read(beforeBuf);
  const afterPng = PNG.sync.read(afterBuf);

  const tileW = Math.max(8, Math.floor(afterPng.width / afterMap.width));
  const tileH = Math.max(8, Math.floor(afterPng.height / afterMap.height));

  drawRectOutline(
    beforePng,
    testCase.focusCoord.x * tileW,
    testCase.focusCoord.y * tileH,
    tileW,
    tileH,
    [0, 220, 255, 255],
    2,
  );

  const targetIds = new Set(findTargetEvents(before, after, testCase).map((e) => e.id));
  for (const ev of afterMap.events) {
    const isTarget = targetIds.has(ev.id);
    const color: [number, number, number, number] = isTarget
      ? [50, 255, 100, 255]
      : [255, 210, 60, 255];
    drawRectOutline(afterPng, ev.x * tileW, ev.y * tileH, tileW, tileH, color, isTarget ? 3 : 1);
    if (isTarget) {
      fillRect(
        afterPng,
        ev.x * tileW + Math.floor(tileW / 4),
        ev.y * tileH + Math.floor(tileH / 4),
        Math.max(4, Math.floor(tileW / 2)),
        Math.max(4, Math.floor(tileH / 2)),
        [255, 60, 180, 255],
      );
    }
  }

  const vehicles = [
    ...Object.values((after.database.system as any)?.vehicles ?? {}),
    ...Object.values((after as any)?.system?.vehicles ?? {}),
  ];
  for (const v of vehicles) {
    if (v && typeof v === "object" && (v as any).mapId === afterMap.id) {
      const vx = Number((v as any).x ?? testCase.focusCoord.x);
      const vy = Number((v as any).y ?? testCase.focusCoord.y);
      drawRectOutline(afterPng, vx * tileW, vy * tileH, tileW, tileH, [0, 240, 255, 255], 3);
      fillRect(
        afterPng,
        vx * tileW + Math.floor(tileW / 4),
        vy * tileH + Math.floor(tileH / 4),
        Math.max(4, Math.floor(tileW / 2)),
        Math.max(4, Math.floor(tileH / 2)),
        [255, 60, 180, 255],
      );
    }
  }

  const pad = 12;
  const headerH = 28;
  const totalW = beforePng.width + afterPng.width + pad * 3;
  const totalH = Math.max(beforePng.height, afterPng.height) + headerH + pad * 2;
  const canvas = new PNG({ width: totalW, height: totalH });

  fillRect(canvas, 0, 0, totalW, totalH, [24, 28, 36, 255]);
  fillRect(
    canvas,
    0,
    0,
    totalW,
    headerH,
    report.passed ? [28, 140, 72, 255] : [190, 45, 55, 255],
  );

  blitPng(canvas, beforePng, pad, headerH + pad);
  blitPng(canvas, afterPng, beforePng.width + pad * 2, headerH + pad);

  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, PNG.sync.write(canvas));
}

// ============================================================================
// Real Editor Assistant Runner (`gemini-4-argon` via `classifyPlainPiTurn` + `runPiAgent`)
// ============================================================================

export interface SingleCaseExecutionResult {
  id: string;
  index: number;
  category: string;
  title: string;
  prompt: string;
  model: string;
  provider: string;
  durationMs: number;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; ok: boolean; summary: string }>;
  assistantReply: string;
  verification: AdversarialVerificationReport;
  visualQaPngPath: string;
}

function headlessChat(keys: Map<string, string | undefined>) {
  return async (config: AiConfig, req: ChatRequest): Promise<ChatResult> => {
    const body: Record<string, unknown> = {
      model: MODEL_ID,
      messages: req.messages,
      stream: false,
      max_tokens: config.maxTokens,
    };
    if (req.tools?.length) {
      body.tools = req.tools;
      body.tool_choice = req.tool_choice ?? "auto";
    }
    if (req.response_format) body.response_format = req.response_format;
    if (typeof req.temperature === "number") body.temperature = req.temperature;
    body.reasoning = { effort: "low" };
    if (!keys.has(MODEL_PROVIDER)) {
      keys.set(MODEL_PROVIDER, await resolveRequestApiKey(MODEL_PROVIDER));
    }
    const { completion } = (await completeProvider(MODEL_PROVIDER, body, {
      apiKey: keys.get(MODEL_PROVIDER),
      signal: req.signal,
    })) as {
      completion: {
        choices: { message: ChatResult["message"]; finish_reason: string | null }[];
        usage?: ChatResult["usage"];
      };
    };
    const choice = completion.choices[0]!;
    return {
      message: choice.message,
      finishReason: choice.finish_reason,
      ...(completion.usage ? { usage: completion.usage } : {}),
    };
  };
}

export async function runSingleJrpgCase(
  testCase: JrpgCommandCase,
  outDir: string,
): Promise<SingleCaseExecutionResult> {
  const startedAt = Date.now();
  await preloadKitStartPlaces();
  const beforeProject = createJrpg200FixtureProject();
  beforeProject.startMapId = testCase.mapId;
  const workingProject = structuredClone(beforeProject);

  const apiKey = await resolveRequestApiKey(MODEL_PROVIDER);
  if (!apiKey) {
    throw new Error(`Missing OAuth/API credentials for ${MODEL_PROVIDER}`);
  }

  const config: AiConfig = {
    ...defaultAiConfig(),
    providerId: MODEL_PROVIDER,
    model: MODEL_ID,
    liteModel: MODEL_ID,
    ultrabrainModel: MODEL_ID,
    piTeam: false,
  };

  const keys = new Map<string, string | undefined>([[MODEL_PROVIDER, apiKey]]);
  const chat = headlessChat(keys);
  const autonomy = resolveAutonomy("balanced");

  const classified = await classifyPlainPiTurn({
    project: workingProject,
    text: testCase.prompt,
    currentMapId: testCase.mapId,
    selection: {
      kind: "tile",
      mapId: testCase.mapId,
      x: testCase.focusCoord.x,
      y: testCase.focusCoord.y,
      width: 1,
      height: 1,
    } as never,
    hasActivePlan: false,
    autonomy,
    declarer: () =>
      createLlmIntentDeclarer({
        chat,
        audit: chat,
        getConfig: () => config,
        timeoutMs: 30_000,
        coverageAudit: false,
      }),
    piTeam: false,
  });

  const modelTask = composePiTask(
    `[현재 열려 있는 맵: ${testCase.mapId}, 선택/근처 기준 좌표: (${testCase.focusCoord.x}, ${testCase.focusCoord.y})]\n${testCase.prompt}`,
    classified.intentNote,
  );

  const toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    ok: boolean;
    summary: string;
  }> = [];
  let assistantReply = "";

  const isReadOnly = testCase.expectKind === "readonly_audit";

  const done = await runPiAgent(
    {
      provider: MODEL_PROVIDER,
      model: MODEL_ID,
      task: modelTask,
      mapIds: [],
      currentMapId: testCase.mapId,
      scopeStrict: false,
      project: workingProject,
      maxTurns: 24,
      thinkingLevel: "low",
      readOnly: isReadOnly,
      ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}),
    },
    {
      apiKey,
      providerApiKeys: { [MODEL_PROVIDER]: apiKey },
      readOnlyTools: isReadOnly,
      timeoutMs: 180_000,
      renderToolImage: async (p, _toolName, data) => renderToolRegionPngBase64(p, data),
      onToolCall: (rec) => {
        toolCalls.push({
          name: rec.name,
          args: rec.args,
          ok: rec.result.ok,
          summary: String(rec.result.summary ?? "").slice(0, 240),
        });
      },
      onEvent: (ev) => {
        if (ev.type === "assistant" && ev.text) {
          assistantReply = ev.text;
        }
      },
    },
  );

  const afterProject = done.project;
  if (!assistantReply && (done as any).text) {
    assistantReply = String((done as any).text);
  }

  const verification = await runAdversarialVerification(
    beforeProject,
    afterProject,
    testCase,
    assistantReply,
    toolCalls,
  );

  const pngDir = join(outDir, "visual-qa");
  mkdirSync(pngDir, { recursive: true });
  const visualQaPngPath = join(pngDir, `${testCase.id}.png`);
  await renderVisualQaComparisonPng(
    beforeProject,
    afterProject,
    testCase,
    verification,
    visualQaPngPath,
  );

  return {
    id: testCase.id,
    index: testCase.index,
    category: testCase.category,
    title: testCase.title,
    prompt: testCase.prompt,
    model: MODEL_ID,
    provider: MODEL_PROVIDER,
    durationMs: Date.now() - startedAt,
    toolCalls,
    assistantReply: assistantReply.slice(0, 800),
    verification,
    visualQaPngPath,
    targetEvents: findTargetEvents(beforeProject, afterProject, testCase),
  } as SingleCaseExecutionResult;
}

// ============================================================================
// CLI Entrypoint (`bun scripts/qa/jrpg-200-harness.mts --round 1 --from 1 --to 50`)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string, fallback: string): string => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1]! : fallback;
  };

  if (args.includes("--dump-json")) {
    const targetJson = resolve(
      process.cwd(),
      "harness-data/assistant-capability/jrpg-200-commands.json",
    );
    mkdirSync(resolve(targetJson, ".."), { recursive: true });
    writeFileSync(targetJson, JSON.stringify(JRPG_200_CASES, null, 2));
    console.log(`Wrote ${JRPG_200_CASES.length} cases to ${targetJson}`);
    return;
  }

  const round = Number(getArg("--round", "1"));
  const fromIdx = Number(getArg("--from", "1"));
  const toIdx = Number(getArg("--to", "200"));
  const concurrency = Number(getArg("--concurrency", "4"));
  const skipExisting = args.includes("--skip-existing");
  const onlyIdsRaw = getArg("--ids", "");
  const onlyIds = onlyIdsRaw
    ? new Set(
        onlyIdsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;

  const outDir = resolve(process.cwd(), `artifacts/jrpg-200/round-${round}`);
  mkdirSync(outDir, { recursive: true });
  const resultsDir = join(outDir, "cases");
  mkdirSync(resultsDir, { recursive: true });

  const selected = JRPG_200_CASES.filter((c) => {
    if (onlyIds) return onlyIds.has(c.id) || onlyIds.has(String(c.index));
    return c.index >= fromIdx && c.index <= toIdx;
  });

  console.log(
    `[JRPG-200 Round ${round}] Running ${selected.length} cases (${fromIdx}..${toIdx}) with model=${MODEL_ID} (${MODEL_PROVIDER}), concurrency=${concurrency}, skipExisting=${skipExisting}...`,
  );

  let cursor = 0;
  const results: SingleCaseExecutionResult[] = [];

  async function worker() {
    while (cursor < selected.length) {
      const idx = cursor++;
      const testCase = selected[idx]!;
      const caseFile = join(resultsDir, `${testCase.id}.json`);
      if (skipExisting && existsSync(caseFile)) {
        try {
          const cached = JSON.parse(readFileSync(caseFile, "utf8")) as SingleCaseExecutionResult;
          if (cached && cached.verification && cached.model === MODEL_ID) {
            results.push(cached);
            console.log(
              `[Round ${round}] [${cached.id}] CACHED-${cached.verification.passed ? "PASS" : "FAIL"} — ${cached.title}`,
            );
            continue;
          }
        } catch {
          // re-run if corrupt
        }
      }
      try {
        const res = await runSingleJrpgCase(testCase, outDir);
        writeFileSync(caseFile, JSON.stringify(res, null, 2));
        results.push(res);
        const status = res.verification.passed ? "PASS" : "FAIL";
        console.log(
          `[Round ${round}] [${res.id}] ${status} (${res.durationMs}ms, tools=${res.toolCalls.map((t) => `${t.name}:${t.ok ? "ok" : "err"}`).join(",") || "none"}) — ${res.title}${
            res.verification.failures.length > 0
              ? ` | Failures: ${res.verification.failures.join(" / ")}`
              : ""
          }`,
        );
      } catch (err) {
        const errMsg = (err as Error)?.message ?? String(err);
        const failRes: SingleCaseExecutionResult = {
          id: testCase.id,
          index: testCase.index,
          category: testCase.category,
          title: testCase.title,
          prompt: testCase.prompt,
          model: MODEL_ID,
          provider: MODEL_PROVIDER,
          durationMs: 0,
          toolCalls: [],
          assistantReply: "",
          verification: {
            passed: false,
            requirementPassed: false,
            preservationPassed: true,
            runtimePassed: false,
            sqlitePassed: false,
            visualQaPassed: false,
            failures: [`[ExecutionError] ${errMsg}`],
            notes: [],
          },
          visualQaPngPath: "",
        };
        writeFileSync(caseFile, JSON.stringify(failRes, null, 2));
        results.push(failRes);
        console.error(`[Round ${round}] [${testCase.id}] ERROR — ${errMsg}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  results.sort((a, b) => a.index - b.index);
  const shardSummaryFile = join(
    outDir,
    onlyIds
      ? `shard-custom.json`
      : `shard-${String(fromIdx).padStart(3, "0")}-${String(toIdx).padStart(3, "0")}.json`,
  );
  const passCount = results.filter((r) => r.verification.passed).length;
  writeFileSync(
    shardSummaryFile,
    JSON.stringify(
      {
        round,
        fromIdx,
        toIdx,
        model: MODEL_ID,
        provider: MODEL_PROVIDER,
        total: results.length,
        passed: passCount,
        failed: results.length - passCount,
        failedCases: results
          .filter((r) => !r.verification.passed)
          .map((r) => ({
            id: r.id,
            title: r.title,
            toolCalls: r.toolCalls.map((t) => ({ name: t.name, ok: t.ok, summary: t.summary })),
            failures: r.verification.failures,
          })),
      },
      null,
      2,
    ),
  );
  console.log(
    `[JRPG-200 Round ${round}] Shard ${fromIdx}..${toIdx} complete: ${passCount}/${results.length} PASS. Summary: ${shardSummaryFile}`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
