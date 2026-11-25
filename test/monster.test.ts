import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createProjectStartSeed } from "@/editor/projectStartSeed";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset, applyMonsterIntentStart, needsMonsterKitStart } from "@/project/genrePresets";
import { genreLockHidesTool, genreLockReport, genreLockPromptNote, activeGenreLock } from "@/project/genreLock";
import { deserialize, serialize } from "@/project/io";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { charsetFamilyOf } from "@/project/charsetFamily";
import type { Project, Command } from "@/project/types";
import { handleShopTransaction, EMERALD_SHOP_OPEN_PURSE } from "@/player/playSceneShop";
import { MONSTER_CENTER_MAX_PARTY, DEFAULT_MONSTER_CENTER_AUDIO, monsterCenterCommands } from "@/project/monsterCenterRecipe";
import { changeItem, startSession } from "@/project/session";
import { store } from "@/project/store";
import { evalActorQueryCondition, type ActorQuerySession } from "@/project/conditionActorQueries";
import type { ItemRecord } from "@/project/types/database";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { isolateTimers } from "./mergedTeardown";

// 몬스터 수집 장르 잠금 기본값(2026-10-16) — 연애(#2664)처럼 몬스터 수집으로 시작한 새 프로젝트는 잠금이 기본이다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterLockDefault", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  const MONSTER_TILESETS = ["monster_overworld", "monster_wild", "monster_rooms", "monster_gyms", "monster_dungeon", "monster_coast", "monster_climate"];
  describe("몬스터 수집 잠금 기본값", () => {
    it("몬스터 수집 시작 장르(AI 시작)는 잠금이 켜진 채 태어나고 저장·재로드 뒤에도 남는다", async () => {
      const seed = await createProjectStartSeed("monster-collect", "별빛 몬스터", "ai");
      expect(seed.system.genreLock).toMatchObject({ preset: "monster-collect", mode: "enforce" });
      expect(genreLockReport(seed).violations).toHaveLength(0);
      expect(deserialize(serialize(seed)).system.genreLock).toEqual(seed.system.genreLock);
    });

    it("몬스터 시작 예제는 버들항 마을 위에 서지만 그 맵은 위반이 아니라 「잠금 이전부터 있던 맵」이다", async () => {
      const seed = await createProjectStartSeed("monster-collect", "풀숲", "example");
      expect(seed.system.genreLock?.preset).toBe("monster-collect");
      const report = genreLockReport(seed);
      expect(report.violations).toHaveLength(0);
      expect(report.preexisting.length).toBeGreaterThan(0);
    });

    it("다른 장르로 시작한 프로젝트에는 잠금이 없다", async () => {
      const seed = await createProjectStartSeed("adventure-jrpg", "모험", "ai");
      expect(seed.system.genreLock).toBeUndefined();
      expect(serialize(seed)).not.toContain("genreLock");
    });

    it("몬스터 수집 의도(채팅 한 줄)는 손대지 않은 빈 프로젝트를 몬스터 키트로 열고 잠근다", () => {
      const project = createBlankProject();
      expect(needsMonsterKitStart(project)).toBe(true);
      expect(applyMonsterIntentStart(project)).toEqual({ opened: true, locked: true });
      expect(project.maps[project.startMapId]!.tilesetId).toBe("monster_overworld");
      expect(project.system.genreLock).toMatchObject({ preset: "monster-collect", mode: "enforce" });
      // 시작 맵이 「이전부터 있던 맵」으로 잡히지 않는다 — 키트로 옮긴 뒤에 잠갔다.
      expect(genreLockReport(project).preexisting).toHaveLength(0);
      // 두 번째는 할 일이 없다.
      expect(applyMonsterIntentStart(project)).toEqual({ opened: false, locked: false });
    });

    it("이미 게임이 있는 프로젝트(맵 여럿·다른 계열 맵)는 몬스터 의도가 와도 잠그지 않는다", () => {
      const authored = createBlankProject();
      authored.maps.map_blank_start!.events.push({ id: "ev1", name: "주민", x: 1, y: 1, pages: [] } as never);
      expect(applyMonsterIntentStart(authored)).toEqual({ opened: false, locked: false });
      expect(authored.system.genreLock).toBeUndefined();
      expect(authored.maps.map_blank_start!.tilesetId).not.toBe("monster_overworld");
    });

    it("다른 장르를 고른 새 프로젝트는 키트만 열고 잠그지 않으며, 이미 있는 잠금은 바꾸지 않는다", () => {
      const jrpg = createBlankProject();
      applyGenrePreset(jrpg, "adventure-jrpg");
      expect(applyMonsterIntentStart(jrpg)).toEqual({ opened: true, locked: false });
      expect(jrpg.system.genreLock).toBeUndefined();
    });

    it("사용자가 푼 몬스터 프로젝트는 몬스터 의도 문장이 와도 되살아나지 않는다", () => {
      const project = createBlankProject();
      applyGenrePreset(project, "monster-collect");
      const ctx: ToolContext = { project, assistantRun: true, monsterTurn: true };
      expect(runTool(ctx, "configure_monster_system", { enabled: false }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genreLock).toBeUndefined();
      expect(applyMonsterIntentStart(ctx.project)).toEqual({ opened: false, locked: false });
      expect(ctx.project.system.genreLock).toBeUndefined();
    });
  });
  describe("몬스터 수집 의도 분류", () => {
    it.each(["몬스터 수집 게임 만들어 줘", "포켓몬 같은 게임 만들어", "대회형 포획 없는 몬스터 배틀 게임 만들어 줘"])("전체 게임 제작 경로도 monsterKit 신호를 낸다: %s", async (text) => {
      const project = createBlankProject();
      const out = await classifyPlainPiTurn({
        project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, autonomy: resolveAutonomy("balanced"),
        declarer: () => { throw new Error("전용 경로는 의도 선언을 부르지 않는다"); }, piTeam: false,
      });
      expect(out.monsterKit).toBe(true);
    });
  });
  describe("몬스터 잠금 중에도 몬스터 게임 제작 도구는 막히지 않는다", () => {
    const lockedCtx = (): ToolContext => {
      const project = createBlankProject();
      applyGenrePreset(project, "monster-collect");
      return { project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true };
    };

    it("몬스터 도구 이름은 하나도 숨겨지지 않는다", () => {
      const { project } = lockedCtx();
      const names = ["build_monster_game", "build_monster_tournament", "build_monster_expedition", "configure_monster_system", "configure_monster_style", "configure_monster_campaign",
        "define_monster_species", "define_monster_families", "rename_monster_species", "give_starter_monsters", "place_trainer", "place_field_obstacle", "set_type_chart", "set_encounter_table",
        "set_shop_stock", "upsert_skill", "upsert_state", "upsert_item", "author_dungeon", "build_hand_interior_room", "create_map", "create_transfer_pair"];
      for (const name of names) expect(genreLockHidesTool(project, name), name).toBe(false);
    });

    it("몬스터 칩셋 7종 맵·동굴(throw 없이)은 만들어진다", () => {
      const ctx = lockedCtx();
      for (const tilesetId of MONSTER_TILESETS) {
        const result = runTool(ctx, "create_map", { name: `m_${tilesetId}`, width: 24, height: 18, tilesetId }, { dryRun: false });
        expect(result.ok, `${tilesetId}: ${result.summary}`).toBe(true);
      }
      expect(runTool(ctx, "author_dungeon", { type: "cave", size: "small", name: "동굴" }, { dryRun: false }).ok).toBe(true);
    });
  });
  describe("조수 안내", () => {
    it("몬스터 잠금 안내에 새 전투 기능과 HM 필드 기술이 설정되는 곳이 있다", () => {
      const project = createBlankProject();
      applyGenrePreset(project, "monster-collect");
      const note = genreLockPromptNote(project)!;
      for (const key of ["statStageEffects", "gen1MajorStatus", "weather", "species.ability", "heldEffect", "captureProfile.condition", "place_field_obstacle"]) expect(note).toContain(key);
      expect(buildSystemPrompt(project)).toContain("place_field_obstacle");
    });

    it("잠금이 없으면 안내 줄도 없다(프롬프트 불변)", () => {
      expect(genreLockPromptNote(createBlankProject())).toBeNull();
    });
  });
});

describe("monsterSpeciesEvolutionOrder", () => {
  isolateTimers();
  describe("define_monster_species evolution order", () => {
    it("tells the model to define the evolved form first", () => {
      const project = createNewProjectSeed(newProjectChoiceById("monster-collect")!.packId, "진화 순서");
      const base = project.database.monsterSpecies![0]!;
      const result = runTool({ project }, "define_monster_species", { species: { id: base.id, name: base.name, evolutions: [{ toSpeciesId: "species_not_yet", requires: { level: 8 } }] } });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("먼저 define_monster_species 로 정의");
    }, 60_000);
  });
});

// 잠금 누수 감사(2026-10-16) #2·#12 — 라우팅이 몬스터 의도를 놓친 자유 경로에서 몬스터 전용 도구가 처음 성공하면 잠금도 같이 걸린다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterToolFirstLock", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  // 몬스터 자산 역방향 잠금(2026-10-17): 몬스터 도구·자산은 몬스터 프로젝트이거나 몬스터 요청 턴에서만 풀린다 — 이 시험은 몬스터 요청 턴이다.
  const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun, monsterTurn: true });
  const starters = (project: Project) => ({
    speciesIds: project.database.monsterSpecies!.slice(0, 3).map((species) => species.id),
    actorEvent: { mapId: project.startMapId, x: 5, y: 5, name: "박사" },
  });
  const heroChipFamily = (project: Project) => {
    const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
    return charsetFamilyOf(project, hero.characterResourceId ?? "easyrpg-charset-actor1");
  };
  describe("몬스터 전용 도구의 첫 성공이 잠금을 건다(빈 시작 맵뿐인 새 프로젝트)", () => {
    it("give_starter_monsters 만 불러도 몬스터 키트 + 장르 잠금 + 표지가 같이 걸리고 주인공이 허용 칩이 된다", () => {
      const ctx = ctxOf(createBlankProject());
      expect(ctx.project.system.genreLock).toBeUndefined();
      const result = runTool(ctx, "give_starter_monsters", starters(ctx.project), { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.genre).toBe("monster-collect");
      expect(activeGenreLock(ctx.project)?.lock.preset).toBe("monster-collect");
      expect(ctx.project.maps[ctx.project.startMapId]!.tilesetId).toBe("monster_overworld");
      expect(heroChipFamily(ctx.project)).toBe("scarloxy-people");
    });

    it("그 뒤 place_npc 기본 그림은 허용 칩이고 RTP 칩 직접 지정은 거부된다", () => {
      const ctx = ctxOf(createBlankProject());
      expect(runTool(ctx, "give_starter_monsters", starters(ctx.project), { dryRun: false }).ok).toBe(true);
      const placed = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "마을 사람", x: 8, y: 6 }, { dryRun: false });
      expect(placed.ok, placed.summary).toBe(true);
      const npc = ctx.project.maps[ctx.project.startMapId]!.events.find((event) => event.name === "마을 사람")!;
      expect(charsetFamilyOf(ctx.project, npc.pages![0]!.graphic!.sprite!.id)).not.toBe("rtp-people");
      const rtp = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "RTP", x: 9, y: 6, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 1 } }, { dryRun: false });
      expect(rtp.ok).toBe(false);
    });

    it("도구가 실패하면 잠금도 걸리지 않는다(처음 성공할 때만)", () => {
      const ctx = ctxOf(createBlankProject());
      const failed = runTool(ctx, "place_trainer", { mapId: ctx.project.startMapId, x: 6, y: 6, name: "트레이너", team: [{ speciesId: "nonexistent", level: 5 }] }, { dryRun: false });
      expect(failed.ok).toBe(false);
      expect(ctx.project.system.genreLock).toBeUndefined();
      expect(ctx.project.system.genre).toBeUndefined();
    });

    it("맵에 이벤트가 이미 있는 기존 프로젝트는 소급 잠금 없이 표지만 남긴다", () => {
      const project = createBlankProject();
      // 최소 이벤트에도 trigger·commands 가 있어야 한다 — #2939 후처리 점검이 event.trigger.kind 를 읽는다.
      project.maps[project.startMapId]!.events.push({ id: "ev_old", name: "주민", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [] } as never);
      const ctx = ctxOf(project);
      expect(runTool(ctx, "give_starter_monsters", starters(project), { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genre).toBe("monster-collect");
      expect(ctx.project.system.genreLock).toBeUndefined();
      expect(ctx.project.maps[ctx.project.startMapId]!.tilesetId).not.toBe("monster_overworld");
    });

    it("조수가 아닌 경로(콘텐츠 스크립트·손 편집)는 키트·잠금을 켜지 않는다", () => {
      const ctx = ctxOf(createBlankProject(), false);
      expect(runTool(ctx, "give_starter_monsters", starters(ctx.project), { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genreLock).toBeUndefined();
    });

    it("사용자가 잠금을 푼 몬스터 프로젝트(표지만 있음)는 다시 잠그지 않는다", () => {
      const project = createBlankProject();
      project.system.genre = "monster-collect";
      const ctx = ctxOf(project);
      expect(runTool(ctx, "give_starter_monsters", starters(project), { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.genreLock).toBeUndefined();
    });
  });
  describe("place_npc graphic 표기 견고성(#12)", () => {
    it("resourceId 로 적어도 도구 예외 없이 textureKey 와 같게 풀린다", () => {
      const ctx = ctxOf(createBlankProject());
      const result = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "청년", x: 6, y: 6, graphic: { resourceId: "easyrpg-charset-people3", characterIndex: 1 } }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[ctx.project.startMapId]!.events.some((event) => event.name === "청년")).toBe(true);
    });
    it("칩 id 가 문자열이 아니면 인자 오류로 알린다(TypeError 가 아니다)", () => {
      const ctx = ctxOf(createBlankProject());
      // characterIndex 만 단 지정은 빈 지정으로 걷혀 투명 NPC 가 되므로(e0558bdafc compactGraphicSpec) 실제 비문자열 칩 id 로 시험한다.
      const args = { mapId: ctx.project.startMapId, name: "청년", x: 6, y: 6, graphic: { textureKey: 123, characterIndex: 1 } };
      const result = runTool(ctx, "place_npc", args as never, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result.issues)).not.toContain("trim");
    });
  });
});

// 몬스터 마을 ④ 상점·센터 — 에메랄드풍 상점 열린 지갑 + 센터 회복 레시피 + place_monster_center.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterTownShopCenter", () => {
  isolateTimers();
  const previous = store.getCurrent();
  beforeEach(() => resetMapEditHistory());
  afterEach(() => store.replaceProject(previous));
  const scene = (session: ReturnType<typeof startSession>) => ({ session, syncRuntimeState: () => {} }) as unknown as PlaySceneContext;
  const potion = (price: number): ItemRecord => ({ id: "item_potion", name: "회복약", price, description: "t", type: "medicine", scope: "ally", occasion: "always", consumable: true, stateEffects: [], consumptionLimit: "noLimit", usableActorIds: [], usableClassIds: [], healStateIds: [], hpRecovery: { flat: 50, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 }, onlyUsableInMenu: false, onlyEffectiveOnDeadActors: false, usageMessage: "normal", occasionField: true, occasionBattle: true, seedParameterBonuses: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, spirit: 0, agility: 0 }, equipmentProfile: { equipable: false } }) as ItemRecord;
  describe("에메랄드풍 상점 열린 지갑", () => {
    it("열린 지갑은 사실상 무한이라 소지품 여러 개를 한 번에 팔 수 있다(기본 100G 지갑이면 막혔을 수량)", () => {
      expect(EMERALD_SHOP_OPEN_PURSE).toBeGreaterThanOrEqual(1_000_000);
      const project = createBlankProject();
      const item = potion(300);
      project.database.items = [...project.database.items.filter((entry) => entry.id !== item.id), item];
      store.replaceProject(project);
      const session = startSession(project);
      changeItem(session, item.id, "+=", 9);
      const startGold = session.gold;
      const blockedByDefaultPurse = handleShopTransaction(scene(session), item, "sell", 9, 100);
      expect(blockedByDefaultPurse.ok).toBe(false);
      const open = handleShopTransaction(scene(session), item, "sell", 9, EMERALD_SHOP_OPEN_PURSE);
      expect(open.ok).toBe(true);
      expect(session.inventory[item.id] ?? 0).toBe(0);
      expect(session.gold).toBeGreaterThan(startGold);
    });
  });
  const flat = (commands: readonly Command[]): Command[] => commands.flatMap((command): Command[] => {
    const nested: Command[] = [];
    if (command.kind === "fork") nested.push(...flat(command.then ?? []), ...flat(command.else ?? []));
    if (command.kind === "choices") for (const option of command.options) nested.push(...flat(option.branch ?? []));
    return [command, ...nested];
  });
  describe("센터 회복 레시피", () => {
    it("맡길까요 예/아니오 → 맡김 → 볼 줄 → 회복 ME → 번쩍임 3번 → 전원 회복 → 센터 기록 순서다", () => {
      const commands = monsterCenterCommands({ greeting: null, checkpointLabel: "별빛 회복 센터", machineCells: [{ x: 5, y: 3 }, { x: 6, y: 3 }] });
      const choice = commands.find((command) => command.kind === "choices");
      expect(choice?.kind).toBe("choices");
      if (choice?.kind !== "choices") return;
      expect(choice.options).toHaveLength(2);
      const ritual = flat(choice.options[0]!.branch ?? []);
      const order = ritual.map((command) => command.kind);
      expect(order.indexOf("playAudio")).toBeGreaterThan(-1);
      const me = ritual.findIndex((command) => command.kind === "playAudio" && command.channel === "me");
      const recover = order.indexOf("recoverAll");
      const save = order.indexOf("checkpointSave");
      expect(me).toBeGreaterThan(-1);
      expect(recover).toBeGreaterThan(me);
      expect(save).toBeGreaterThan(recover);
      expect(ritual.filter((command) => command.kind === "m2Command" && JSON.stringify(command.fields).includes("flash"))).toHaveLength(3);
      // 볼은 파티 칸 수(최대 6)만큼 partySize 분기로 줄지어 놓인다.
      expect(ritual.filter((command) => command.kind === "fork" && command.condition?.kind === "partySize").length).toBeGreaterThanOrEqual(MONSTER_CENTER_MAX_PARTY);
      // 거절 분기에는 회복이 없다.
      expect(flat(choice.options[1]!.branch ?? []).some((command) => command.kind === "recoverAll")).toBe(false);
    });

    it("checkpointLabel 이 없으면 센터 기록을 넣지 않고, 번들 효과음 id 만 쓴다", () => {
      const all = flat(monsterCenterCommands({ greeting: null }));
      expect(all.some((command) => command.kind === "checkpointSave")).toBe(false);
      for (const command of all) if (command.kind === "playAudio") expect(command.resourceId).toMatch(/^(easyrpg-sound-|cc0-se-)/);
      expect(DEFAULT_MONSTER_CENTER_AUDIO.me).toMatch(/^easyrpg-sound-/);
    });

    it("partySize 조건은 몬스터 파티가 있으면 몬스터 수를, 없으면 파티 배우 수를 센다", () => {
      const base = { partyActorIds: ["actor_a"], actorVitals: {} } as unknown as ActorQuerySession;
      const withMonsters = { ...base, monsterParty: ["a", "b", "c"] } as ActorQuerySession;
      const cond = (value: number) => ({ kind: "partySize", op: ">=", value }) as never;
      expect(evalActorQueryCondition(withMonsters, cond(3))).toBe(true);
      expect(evalActorQueryCondition(withMonsters, cond(4))).toBe(false);
      expect(evalActorQueryCondition(base, cond(1))).toBe(true);
      expect(evalActorQueryCondition(base, cond(2))).toBe(false);
    });
  });
  describe("place_monster_center 도구", () => {
    const ctx = (draft: Project): ToolContext => ({ project: draft } as unknown as ToolContext);

    it("간호사 이벤트에 레시피 명령을 넣고 몬스터 수집 잠금에서도 보인다", async () => {
      expect(genreLockHidesTool({ preset: "monster-collect", mode: "enforce" } as never, "place_monster_center")).toBe(false);
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      // runTool 은 성공하면 context.project 를 새 사본으로 바꾼다 — 원본이 아니라 그 사본을 읽는다.
      const context = ctx(project);
      const result = await runTool(context, "place_monster_center", { mapId, x: 3, y: 3, checkpointLabel: "시험 센터", machineCells: [{ x: 2, y: 2 }] });
      expect(result.ok).toBe(true);
      const events = context.project.maps[mapId]!.events.filter((event) => JSON.stringify(event.pages).includes("recoverAll"));
      expect(events).toHaveLength(1);
      expect(JSON.stringify(events[0]!.pages)).toContain("checkpointSave");
    });

    it("모르는 칸·맵 밖 machineCells 는 조용히 버리지 않고 거절한다", async () => {
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const unknown = await runTool(ctx(project), "place_monster_center", { mapId, x: 3, y: 3, heal: true });
      expect(unknown.ok).toBe(false);
      const outside = await runTool(ctx(project), "place_monster_center", { mapId, x: 3, y: 3, machineCells: [{ x: 9999, y: 1 }] });
      expect(outside.ok).toBe(false);
    });
  });
});
