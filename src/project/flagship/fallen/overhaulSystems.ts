/**
 * 『폴른 스타』 공격적 개편 · 시스템 관통 층 (1막 ↔ 2막).
 *
 * 1. 전용 효과음 표(system.seCues): UI · 전투 · 마법 · 필드 · 지형 발소리 풀 매핑.
 * 2. 「이리스의 일지」(storyJournal): 하늘탑 4층에서만 몰아 쓰던 일지를 1막 추락지·빵집·지하·2막 감방·새벽샘·서리나루까지 실시간 기록으로 확장.
 * 3. 「동료 유대」(partyBonds): 엘레나·이리스·새라 3인 전원 등록 + 1막 숲 사당 쉼터 대화 추가 + 이리스 유대 연계기 연결.
 * 4. 2막 재료 드롭·상위 조합(craftRecipes)·장비 강화(itemUpgrades) + 서리 가도 행상 베른 공방 메뉴.
 * 5. 챕터 표시(system.chapter) + 강하게 다시 하기(system.newGamePlus).
 */
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { normalizeChapterSettings, normalizeNewGamePlusSettings } from "@/project/newGamePlus";
import { normalizePartyBonds } from "@/project/partyBonds";
import { normalizeSeCues } from "@/project/seCues";
import type { Command, Condition, GameMap, Project } from "@/project/types";
import { SW_FROST_ARRIVE, SW_HARMA } from "./frostford";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Rec = Record<string, unknown>;

export const VAR_FS_BOND_IRIS = "var_fs_bond_iris";
export const VAR_FS_CHAPTER = "var_fs_chapter";
export const SW_FS_SHRINE_BOND = "sw_fs_shrine_bond_talked";

export const FS2_MAT_ASH = "item_fs2_ash_core";
export const FS2_MAT_FROST = "item_fs2_frost_crystal";
export const FS2_MAT_CIRCUIT = "item_fs2_star_circuit";

function ensureSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
}

function ensureVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) project.variables.push({ id, name });
}

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as unknown as Command);
const narrate = (body: string, extra: Rec = {}): Command => ({ kind: "text", body, ...extra } as unknown as Command);
const setVar = (variableId: string, value: number): Command => ({ kind: "setVariable", variableId, op: "=", value } as unknown as Command);
const addVar = (variableId: string, value: number): Command => ({ kind: "setVariable", variableId, op: "+=", value } as unknown as Command);
const setSw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value } as unknown as Command);
const sw = (switchId: string, value = true): Condition => ({ kind: "switch", switchId, value } as Condition);
const fork = (condition: unknown, then: Command[], otherwise: Command[] = []): Command =>
  ({ kind: "fork", condition, then, else: otherwise } as unknown as Command);

function journalWrite(lineId: string, writer: string, date: string, text: string, extra: Rec = {}): Command {
  return {
    kind: "m2Command",
    commandId: "m2-227-journal-line",
    fields: { action: "write", lineId, writer, date, text, ...extra },
  } as unknown as Command;
}

/** Command 목록 트리를 순회하며 각 페이지(경로)마다 특정 스위치를 켜는 setSwitch 직후에 명령을 1회 끼워 넣는다. */
function injectAfterSetSwitch(map: GameMap | undefined, switchId: string, insert: Command[], markerId: string): boolean {
  if (!map) return false;
  let anyInjected = false;
  const hasMarker = (list: Command[]): boolean => {
    for (const raw of list) {
      const cmd = raw as unknown as Rec;
      if (cmd?.kind === "m2Command" && (cmd.fields as Rec | undefined)?.lineId === markerId) return true;
      for (const key of ["then", "else", "cancelBranch", "commands"]) {
        if (Array.isArray(cmd?.[key]) && hasMarker(cmd[key] as Command[])) return true;
      }
      if (Array.isArray(cmd?.options)) {
        for (const opt of cmd.options as { branch?: Command[] }[]) {
          if (Array.isArray(opt.branch) && hasMarker(opt.branch)) return true;
        }
      }
    }
    return false;
  };
  const walkTree = (root: Command[]): void => {
    if (hasMarker(root)) return;
    let pageInjected = false;
    const walk = (list: Command[]): void => {
      for (let i = 0; i < list.length; i += 1) {
        const cmd = list[i] as unknown as Rec;
        if (cmd?.kind === "setSwitch" && cmd.switchId === switchId && cmd.value !== false && !pageInjected) {
          const cloned = insert.map((c) => JSON.parse(JSON.stringify(c)) as Command);
          list.splice(i + 1, 0, ...cloned);
          pageInjected = true;
          anyInjected = true;
          i += cloned.length;
          continue;
        }
        for (const key of ["then", "else", "cancelBranch", "commands"]) {
          if (Array.isArray(cmd?.[key])) walk(cmd[key] as Command[]);
        }
        if (Array.isArray(cmd?.options)) {
          for (const opt of cmd.options as { branch?: Command[] }[]) {
            if (Array.isArray(opt.branch)) walk(opt.branch);
          }
        }
      }
    };
    walk(root);
  };
  for (const event of map.events) {
    for (const page of event.pages ?? []) walkTree(page.commands as Command[]);
    if (Array.isArray(event.commands)) walkTree(event.commands as Command[]);
  }
  return anyInjected;
}

function applySeCues(project: Project): void {
  const cues = normalizeSeCues({
    // UI
    cursor: "easyrpg-sound-cursor1",
    confirm: "easyrpg-sound-decision1",
    cancel: "easyrpg-sound-cancel1",
    buzzer: "easyrpg-sound-buzzer1",
    menuOpen: "easyrpg-sound-cursor2",
    equip: "cc0-se-orp-battle-sword-unsheathe",
    save: "easyrpg-sound-chime2",
    load: "easyrpg-sound-chime1",
    shop: "cc0-se-orp-inventory-coin",
    useItem: "easyrpg-sound-item1",
    itemGet: "easyrpg-sound-item2",
    levelUp: "easyrpg-sound-recovery7",
    notify: "cc0-se-osx-bell-01",
    // Battle
    battleStart: "easyrpg-sound-combat1",
    attack: "easyrpg-sound-attack1",
    "attack-blunt": "easyrpg-sound-blow2",
    "attack-pierce": "easyrpg-sound-attack2",
    "attack-claw": "easyrpg-sound-damage2",
    damage: "cc0-se-osx-hit-01",
    actorDamage: "cc0-se-osx-hit-02",
    critical: "easyrpg-sound-blow4",
    miss: "easyrpg-sound-evade1",
    heal: "easyrpg-sound-recovery5",
    defend: "easyrpg-sound-barrier",
    faint: "easyrpg-sound-collapse1",
    bossCollapse: "easyrpg-sound-collapse2",
    escape: "easyrpg-sound-escape",
    cast: "cc0-se-orp-battle-magic1",
    // Magic
    "magic-fire": "cc0-se-ors-spell-fire-01",
    "magic-ice": "easyrpg-sound-ice5",
    "magic-thunder": "easyrpg-sound-flash3",
    "magic-wind": "easyrpg-sound-wind8",
    "magic-earth": "easyrpg-sound-earth6",
    "magic-water": "cc0-se-osx-splash-01",
    "magic-holy": "easyrpg-sound-holy2",
    "magic-dark": "easyrpg-sound-darkness3",
    buff: "easyrpg-sound-buff",
    debuff: "easyrpg-sound-debuff",
    poison: "easyrpg-sound-poison",
    sleep: "easyrpg-sound-sleep",
    paralyze: "easyrpg-sound-glare",
    reflect: "easyrpg-sound-barrier1",
    absorb: "easyrpg-sound-absorb1",
    revive: "easyrpg-sound-raise2",
    // Field & Footsteps
    door: "cc0-se-osx-door-open",
    doorClose: "cc0-se-osx-door-close-01",
    chest: "cc0-se-osx-wooded-box-open",
    key: "cc0-se-osx-key-open-01",
    switch: "cc0-se-osx-switch-01",
    water: "cc0-se-osx-splash-01",
    explosion: "cc0-se-osx-explosion",
    teleport: "easyrpg-sound-teleport2",
    "footstep-stone": "cc0-se-ors-item-stone-01",
    "footstep-wood": "cc0-se-ors-item-wood-01",
    "footstep-water": "cc0-se-osx-splash-02",
  });
  if (cues) project.system.seCues = cues;
}

function applyCrossActJournal(project: Project): void {
  // 4인 필체를 모두 등록해 1막부터 일지가 살아 움직이게 한다.
  const prev = project.meta.oprnStoryJournal;
  project.meta.oprnStoryJournal = {
    version: 1,
    title: prev?.title ?? "이리스의 일지",
    writers: [
      { id: "iris", name: "이리스" },
      { id: "kael", name: "카엘" },
      { id: "elena", name: "엘레나" },
      { id: "sarah", name: "새라" },
    ],
  };

  // 1막 추락지 — 이리스 깨어남
  injectAfterSetSwitch(
    project.maps.fs_forest,
    "sw_fs_iris_joined",
    [journalWrite("fs2_first", "kael", "별 떨어진 밤", "북쪽 숲에서 은빛 알이 열렸다. 「잘 지내」라는 말에 안에 있던 아이가 대답했다.")],
    "fs2_first",
  );
  // 1막 토마 빵집 — 납작빵 의뢰 완료
  injectAfterSetSwitch(
    project.maps.fs_bakery_home,
    "sw_fs_q_bread_done",
    [journalWrite("fs2_bread", "kael", "이튿날", "이리스가 처음으로 빵을 먹었다. 따뜻해서 좋다고 했다.", { learnActorId: "actor_fs_iris", learnSkillId: "skill_gunner_shot" })],
    "fs2_bread",
  );
  // 1막 지하 4층 — 단말 대답
  injectAfterSetSwitch(
    project.maps.fs_vault_b4,
    "sw_fs_b4_lift_open",
    [journalWrite("fs2_star", "kael", "지하의 밤", "별 이름을 셋 알려 줬다. 이리스는 맨 끝 별이 제일 좋다고 했다.", { learnActorId: "actor_fs_iris", learnSkillId: "skill_gunner_snipe" })],
    "fs2_star",
  );
  // 2막 감방 — 빵 속 열쇠로 탈출
  injectAfterSetSwitch(
    project.maps.fs2_cell,
    "sw_fs2_cell_open",
    [journalWrite("fs2_cell_escape", "elena", "통금의 밤", "토마 아저씨가 빵에 열쇠를 구워 넣었다. 다들 겁이 많아도 손부터 먼저 내민다.")],
    "fs2_cell_escape",
  );
  // 2막 새벽샘 — 세린의 정착 확인서 발견
  injectAfterSetSwitch(
    project.maps.fs2_dawnwell,
    "sw_fs2_serin_form",
    [journalWrite("fs2_dawnwell", "kael", "재의 마을", "세린의 확인서 밑에 아이 글씨로 「엄마 문 열어」라고 적혀 있었다. 발렌의 글씨였다.")],
    "fs2_dawnwell",
  );
  // 2막 서리나루 — 하르마에게 세린 이야기를 들음
  injectAfterSetSwitch(
    project.maps.fs2_frostford,
    SW_HARMA,
    [journalWrite("fs2_frostford", "sarah", "서리나루", "발렌 님이 해마다 얼음 위에 등을 띄운다는 걸 오늘 알았다. 세린의 아들이었다.")],
    "fs2_frostford",
  );
}

function applyCrossActBonds(project: Project): void {
  ensureVariable(project, VAR_FS_BOND_IRIS, "유대: 이리스");
  ensureSwitch(project, SW_FS_SHRINE_BOND, "1막 사당 쉼터: 동료와 속마음을 나눴다");

  const existing = project.system.partyBonds?.members ?? [];
  const hasElena = existing.some((m) => m.actorId === "actor_fs_elena");
  const hasSarah = existing.some((m) => m.actorId === "actor_fs2_sarah");
  const members = [
    ...(hasElena ? existing.filter((m) => m.actorId === "actor_fs_elena") : [{ actorId: "actor_fs_elena", variableId: "var_fs2_bond_elena" }]),
    { actorId: "actor_fs_iris", variableId: VAR_FS_BOND_IRIS },
    ...(hasSarah ? existing.filter((m) => m.actorId === "actor_fs2_sarah") : [{ actorId: "actor_fs2_sarah", variableId: "var_fs2_bond_sarah" }]),
  ];
  const normalized = normalizePartyBonds({ max: 5, members });
  if (normalized) project.system.partyBonds = normalized;

  // 1막 별지기 사당 쉼터(ev_fs_forest_shrine_rest)에 동료와 짧게 이야기하는 유대 선택지를 얹는다(1회).
  const shrine = project.maps.fs_forest_shrine;
  const restEv = shrine?.events.find((e) => e.id === "ev_fs_forest_shrine_rest");
  const restPage = restEv?.pages?.[0];
  if (restPage) {
    const bondBlock: Command = fork(sw(SW_FS_SHRINE_BOND, false), [
      narrate("제단 앞 불씨가 은은하다. 숨을 돌리는 사이, 누구와 이야기를 나눌까?"),
      {
        kind: "choices",
        options: [
          {
            text: "엘레나와 별 이야기를 나눈다",
            branch: [
              say("엘레나", "옛 별지기들이 여기까지 물을 끌어다 별을 비췄대.\n우린 그냥 겁먹고 문만 잠그고 있었는데."),
              say("카엘", "이제 우리가 다시 열면 되지. 같이."),
              say("엘레나", "…말은 쉽게 하네. 그래도 네가 옆에 있으니까 좀 든든하다."),
              addVar("var_fs2_bond_elena", 1),
              setSw(SW_FS_SHRINE_BOND),
              narrate("엘레나와 한결 가까워졌다.", { context: "system" }),
            ],
          },
          {
            text: "이리스와 숲 소리를 듣는다",
            branch: [
              fork(sw("sw_fs_iris_joined"), [
                say("이리스", "카엘, 나뭇잎 스치는 소리… 파도 소리랑 닮았어요.\n기억은 안 나는데 이상하게 포근해요."),
                say("카엘", "집에 돌아가기 전까지 좋은 소리 많이 들려 줄게."),
                say("이리스", "응. 잊어버려도 괜찮게, 꼭 적어 둘게요."),
                addVar(VAR_FS_BOND_IRIS, 1),
                setSw(SW_FS_SHRINE_BOND),
                narrate("이리스와 한결 가까워졌다.", { context: "system" }),
              ], [
                say("엘레나", "아직 그 아이를 못 만났잖아. 얼른 북쪽 추락지부터 가 보자."),
              ]),
            ],
          },
          { text: "그냥 조용히 쉰다", branch: [] },
        ],
        cancelBehavior: "choice3",
      } as unknown as Command,
    ]);
    restPage.commands = [...restPage.commands, bondBlock];
  }

  // 하늘탑 4층에서 이리스가 일지를 되찾을 때 유대 +2
  injectAfterSetSwitch(
    project.maps.fs2_sky_tower_f4,
    "sw_fs2_iris_be_well",
    [addVar(VAR_FS_BOND_IRIS, 2)],
    "__bond_iris_tower__",
  );
}

function applyAct2CraftingAndUpgrades(project: Project, exec: Exec): void {
  const db = project.database;
  const addItem = (item: Parameters<typeof normalizeItemRecord>[0]) => {
    if (!db.items.some((r) => r.id === item.id)) db.items.push(normalizeItemRecord(item));
  };

  addItem({
    id: FS2_MAT_ASH, name: "잿불 핵", type: "normalGoods", occasion: "never", consumable: false, price: 35,
    iconResourceId: "cc0-jetrel-gem-ruby", imageResourceId: "cc0-jetrel-gem-ruby",
    description: "재의 들판 마물에게서 얻은 뜨거운 잿불 덩어리.\n가방 「조합」이나 행상 베른의 공방에서 약·장비 강화에 쓴다.",
  });
  addItem({
    id: FS2_MAT_FROST, name: "서리 결정", type: "normalGoods", occasion: "never", consumable: false, price: 45,
    iconResourceId: "cc0-jetrel-gem-sapphire", imageResourceId: "cc0-jetrel-gem-sapphire",
    description: "눈보라 속 짐승들이 품고 있던 차가운 얼음 결정.\n서리 병·회복약 조합과 창 강화 재료로 쓴다.",
  });
  addItem({
    id: FS2_MAT_CIRCUIT, name: "고대 회로", type: "normalGoods", occasion: "never", consumable: false, price: 60,
    iconResourceId: "cc0-jetrel-gear", imageResourceId: "cc0-jetrel-gear",
    description: "하늘탑 파수 기계에서 떨어진 빛나는 옛 부품.\n마력약·만능약 조합과 지팡이 강화에 쓴다.",
  });

  // 2막 적 드롭에 재료 추가
  const dropFor = (enemyId: string): string | undefined => {
    if (enemyId.includes("_ash_") || enemyId.includes("starved_dog")) return FS2_MAT_ASH;
    if (enemyId.includes("_frost_") || enemyId.includes("yeti")) return FS2_MAT_FROST;
    if (enemyId.includes("tower_") || enemyId.includes("crystal_spider") || enemyId.includes("circuit_snake") || enemyId.includes("light_moth")) return FS2_MAT_CIRCUIT;
    return undefined;
  };
  for (const enemy of db.enemies) {
    const mat = dropFor(enemy.id);
    if (!mat) continue;
    const drops = enemy.rewards.drops ?? [];
    if (!drops.some((d) => d.itemId === mat)) {
      enemy.rewards.drops = [...drops, { itemId: mat, ratePercent: 45, quantity: 1, condition: { kind: "always" } }];
    }
  }

  // 2막 조합 레시피 4종
  const act2Recipes = [
    { id: "fs2_craft_hi_potion", name: "상급 회복약", ingredients: [{ itemId: FS2_MAT_ASH, count: 1 }, { itemId: FS2_MAT_FROST, count: 1 }], outputItemId: "item_hi_potion", outputCount: 2, goldCost: 30 },
    { id: "fs2_craft_frost_vial", name: "서리 병", ingredients: [{ itemId: FS2_MAT_FROST, count: 2 }], outputItemId: "item_gen2_frost_vial", outputCount: 2, goldCost: 20 },
    { id: "fs2_craft_ether", name: "마력약", ingredients: [{ itemId: FS2_MAT_CIRCUIT, count: 1 }, { itemId: FS2_MAT_ASH, count: 1 }], outputItemId: "item_ether", outputCount: 2, goldCost: 35 },
    { id: "fs2_craft_panacea", name: "만능약", ingredients: [{ itemId: FS2_MAT_FROST, count: 1 }, { itemId: FS2_MAT_CIRCUIT, count: 1 }], outputItemId: "item_panacea", outputCount: 2, goldCost: 30 },
  ];
  const existing = project.system.craftRecipes ?? [];
  project.system.craftRecipes = [
    ...existing.filter((r) => !act2Recipes.some((a) => a.id === r.id)),
    ...act2Recipes,
  ];

  // 장비 강화 규칙 3종 (엔진 itemUpgrades)
  const equipIds = new Set(db.equipment.map((e) => e.id));
  const upgrades: { id: string; fromItemId: string; toItemId: string; goldCost: number; ingredients: { itemId: string; count: number }[] }[] = [
    { id: "fs2_upg_star_sword", fromItemId: "equip_gen_sword_steel", toItemId: "equip_fs_sword_star", goldCost: 240, ingredients: [{ itemId: FS2_MAT_ASH, count: 2 }] },
    { id: "fs2_upg_star_spear", fromItemId: "equip_gen_spear_iron", toItemId: "equip_fs_spear_star", goldCost: 260, ingredients: [{ itemId: FS2_MAT_FROST, count: 2 }] },
    { id: "fs2_upg_crystal_staff", fromItemId: "equip_gen_wand_spark", toItemId: "equip_gen_staff_crystal", goldCost: 220, ingredients: [{ itemId: FS2_MAT_CIRCUIT, count: 2 }] },
  ];
  for (const u of upgrades) {
    if (equipIds.has(u.fromItemId) && equipIds.has(u.toItemId)) {
      exec(project, "upsert_item_upgrade", { upgrade: { ...u, target: "equipment" } });
    }
  }

  // 서리 가도 행상 베른(ev_fs2_snow_merchant)에 상점 + 조합 공방 선택지 연결
  const snowMap = project.maps.map_snow_north_1;
  const bern = snowMap?.events.find((e) => e.id === "ev_fs2_snow_merchant");
  const allRecipeIds = (project.system.craftRecipes ?? []).map((r) => r.id);
  if (bern?.pages) {
    for (const p of bern.pages) {
      const shopIdx = p.commands.findIndex((c) => c.kind === "shop");
      if (shopIdx < 0) continue;
      const shopCmd = p.commands[shopIdx]!;
      const menuChoice: Command = {
        kind: "choices",
        options: [
          { text: "물건을 산다", branch: [shopCmd] },
          { text: "재료를 조합한다", branch: [{ kind: "openCraftShop", recipeIds: allRecipeIds, title: "베른의 노천 공방", speaker: "떠돌이 행상 베른" } as Command] },
          { text: "다음에 들를게요", branch: [] },
        ],
        cancelBehavior: "choice3",
      } as unknown as Command;
      p.commands.splice(shopIdx, 1, menuChoice);
    }
  }
}

function applyChaptersAndNewGamePlus(project: Project): void {
  ensureVariable(project, VAR_FS_CHAPTER, "진행 장(챕터)");

  const chapter = normalizeChapterSettings({
    variableId: VAR_FS_CHAPTER,
    labels: {
      "0": "제1막 · 왕도 아스텔",
      "1": "제1막 · 속삭이는 숲",
      "2": "제1막 · 천문대 지하",
      "3": "제2막 · 불 꺼진 왕도",
      "4": "제2막 · 재의 들판과 관문",
      "5": "제2막 · 서리나루",
      "6": "제2막 · 하늘탑 정상",
    },
  });
  if (chapter) project.system.chapter = chapter;

  const ngp = normalizeNewGamePlusSettings({
    enabled: true,
    label: "다시 별을 올려다본다",
    carry: ["levels", "skills", "equipment", "inventory", "gold"],
  });
  if (ngp) project.system.newGamePlus = ngp;

  // 주요 구간 진입/이벤트에 챕터 번호 갱신 주입
  injectAfterSetSwitch(project.maps.fs_forest, "sw_fs_iris_joined", [setVar(VAR_FS_CHAPTER, 1)], "__ch1__");
  injectAfterSetSwitch(project.maps.fs_vault, "sw_fs_vault_seal_open", [setVar(VAR_FS_CHAPTER, 2)], "__ch2__");
  injectAfterSetSwitch(project.maps.fs2_cell, "sw_fs2_act2_started", [setVar(VAR_FS_CHAPTER, 3)], "__ch3__");
  injectAfterSetSwitch(project.maps.fs2_dawnwell, "sw_fs2_serin_form", [setVar(VAR_FS_CHAPTER, 4)], "__ch4__");
  injectAfterSetSwitch(project.maps.fs2_frostford, SW_FROST_ARRIVE, [setVar(VAR_FS_CHAPTER, 5)], "__ch5__");
  injectAfterSetSwitch(project.maps.fs2_sky_tower_top, "sw_fs2_top_arrive", [setVar(VAR_FS_CHAPTER, 6)], "__ch6__");
}

export function applyFallenSystemsOverhaul(project: Project, exec: Exec): void {
  applySeCues(project);
  applyCrossActJournal(project);
  applyCrossActBonds(project);
  applyAct2CraftingAndUpgrades(project, exec);
  applyChaptersAndNewGamePlus(project);
}
