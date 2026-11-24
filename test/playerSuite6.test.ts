import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { audioIndicatorText, showAudioIndicator } from "@/player/resourceDisplay";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { createPresentationLedger } from "@/player/battlePresentation";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import { createBattleSequencer, type DamageFeedback } from "@/player/battleSequencer";
import { actorCommandDirectorState } from "@/player/battleDirectorDom";
import itemFixture from "./fixtures/projects/item-runtime-qa-v3.json";
import { BATTLE_LOGICAL_HEIGHT, BATTLE_LOGICAL_WIDTH, calculateBattleStageScale } from "../src/player/battleStageScale";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { simulateBattle } from "@/battle/simulate";
import { commandPanel } from "@/player/battleCommandDom";
import type { ActorParameterKey, Command, Project } from "@/project/types";
import { installFakeDom, type FakeElement } from "./fakeDom";
import { installPlaySceneTestHooks, type RuntimeDebugHook } from "@/player/playSceneTestHooks";
import { applyCharacterLift, characterHopLiftPx, clampHopDurationMs, clampHopLiftPx, clearCharacterLift, DEFAULT_FALL_HEIGHT_PX, DEFAULT_JUMP_DURATION_MS, DEFAULT_JUMP_PEAK_PX, fallHop, fallLiftPx, hopAirScale, hopBaseScaleOf, hopLandingSquashScale, hopOriginY, hopPerspectiveScale, hopSpeedRatio, hopStretchScale, applyHopScale, FALL_PERSPECTIVE_MAX, HOP_PERSPECTIVE_MAX, jumpArcLiftPx, jumpHop, MAX_HOP_LIFT_PX, MIN_HOP_DURATION_MS } from "@/player/characterHop";
import { DEFAULT_LANDING_SE, landingImpactPlan, MIN_IMPACT_LIFT_PX } from "@/player/characterLanding";
import { shadowAlphaForLift, shadowScaleForLift } from "@/player/characterShadow";
import { TILE_SIZE } from "@/assets/bundled";
import { CLOUD_SHADOW_BLOB_COUNT, CLOUD_SHADOW_BREATH, CLOUD_SHADOW_LOBE_CORE_FRACTION, CLOUD_SHADOW_SPEED_JITTER, cloudShadowBreath, CLOUD_SHADOW_SILHOUETTE_COUNT, cloudShadowSilhouette, CLOUD_SHADOW_DEFAULTS, CLOUD_SHADOW_OPACITY_RANGE, CLOUD_SHADOW_SCALE_RANGE, CLOUD_SHADOW_SPEED_RANGE, cloudShadowAnchors, cloudShadowBlobs, cloudShadowDrift, cloudShadowPeriod, normalizeCloudShadowParams, type CloudShadowBlob, type CloudShadowParams } from "@/player/cloudShadows";
import { openStatePixels } from "@/player/playSceneFieldFx";
import { CONTAINER_STYLES } from "@/project/containerFx";
import { startSession } from "@/project/session";
import { paginateDialogueSegments, type DialoguePage } from "@/player/dialoguePagination";
import { parseDialogueText } from "@/player/dialogue";
import { DIALOGUE_EMOTIONS, dialoguePresentationCssVars, dialoguePresentationProfile, dialogueScaledCharDelayMs, dialogueSpeakerInsetPx, normalizeDialogueEmotion } from "@/player/dialoguePresentation";
import { ESCAPE_GRACE_AFTER_MOVE_MS, ESCAPE_GRACE_CAP_MS, ESCAPE_GRACE_MS, escapeGraceActive, startEscapeGrace, tickEscapeGrace } from "@/player/chaseSpawnGrace";
import { event, fixture, pos, ticks } from "./fixtures/npcChasePathfinding";
import { renderEventLayer, renderTiles } from "@/player/playSceneMapRuntime";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { legacyRenderEvents } from "./eventLayerLegacyOracle";
import { renderSceneWith, mockSprite } from "./runtimeEventPageFixtures";
import { beginFurniturePush } from "@/player/furniturePushAnimation";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { showSceneEmote, syncSceneEmotes, describeSceneEmotes } from "@/player/playSceneEmotes";
import { dialogueSceneHooks } from "@/player/playSceneDialogueHooks";
import type { PlaySceneContext, AutonomousMover } from "@/player/playSceneTypes";
import { isolateTimers } from "./mergedTeardown";

// 「지금 흐르는 곡」 배너가 공용 음원 id(cc0-bgm-rtp-emo-002)를 플레이어에게 그대로 보이던 결함(폴른 스타 QA V049·D024, 2026-11-08).
describe("audioIndicatorText", () => {
  isolateTimers();
  function withProfiles(
    profiles: readonly { assetId: string; name: string }[],
    uploaded: readonly { id: string; name: string }[] = [],
  ) {
    const project = createBlankProject();
    for (const asset of uploaded) {
      project.assets.uploaded[asset.id] = { id: asset.id, name: asset.name, kind: "music", meta: {} };
    }
    project.resourceProfiles = [
      ...project.resourceProfiles.filter((profile) => !profiles.some((entry) => entry.assetId === profile.assetId)),
      ...profiles.map((profile) => ({ kind: "music" as const, assetId: profile.assetId, name: profile.name })),
    ];
    store.replace(project);
  }
  describe("audio indicator text", () => {
    it("hides a bundled catalog id that has no display name", () => {
      withProfiles([]);
      expect(audioIndicatorText("cc0-bgm-rtp-emo-002")).toBeUndefined();
      expect(audioIndicatorText("easyrpg-music-town1")).toBeUndefined();
    });

    it("uses the authored display name when there is one", () => {
      withProfiles([{ assetId: "cc0-bgm-rtp-emo-002", name: "돌아오는 방" }]);
      expect(audioIndicatorText("cc0-bgm-rtp-emo-002")).toBe("돌아오는 방");
    });

    it("falls back to the uploaded asset's name when no profile names the track", () => {
      withProfiles([], [{ id: "mx_audio_town", name: "파도마을" }]);
      expect(audioIndicatorText("mx_audio_town")).toBe("파도마을");
    });

    it("prefers the profile name over the uploaded asset's name", () => {
      withProfiles([{ assetId: "mx_audio_town", name: "마을 주제곡" }], [{ id: "mx_audio_town", name: "파도마을" }]);
      expect(audioIndicatorText("mx_audio_town")).toBe("마을 주제곡");
    });

    it("never shows a raw resource id: unnamed, id-named or empty ids show nothing", () => {
      withProfiles([], [{ id: "mx_audio_gym", name: "mx_audio_gym" }, { id: "bgm_blank", name: "  " }]);
      expect(audioIndicatorText("mx_audio_gym")).toBeUndefined();
      expect(audioIndicatorText("bgm_blank")).toBeUndefined();
      expect(audioIndicatorText("bgm_1")).toBeUndefined();
      expect(audioIndicatorText("  ")).toBeUndefined();
    });

    it("clears a stale banner instead of leaving the previous track's name", () => {
      withProfiles([]);
      const calls: string[] = [];
      const scene = {
        showRuntimeOverlay: (id: string, text: string) => calls.push(`show ${id} ${text}`),
        clearRuntimeOverlay: (id: string) => calls.push(`clear ${id}`),
      };
      withProfiles([{ assetId: "bgm_1", name: "첫 곡" }]);
      showAudioIndicator(scene, { resourceId: "bgm_1", loop: true });
      showAudioIndicator(scene, { resourceId: "bgm_1", loop: true, channel: "bgs" });
      showAudioIndicator(scene, { resourceId: "bgm_1", loop: false });
      showAudioIndicator(scene, { resourceId: "cc0-bgm-rtp-emo-002", loop: true });
      expect(calls).toEqual(["show audio-indicator 첫 곡", "clear audio-indicator"]);
    });
  });
});

describe("battlePresentationDeferDefeat", () => {
  isolateTimers();
  // 포켓몬 스킨은 HP 바가 다 줄어든 뒤에 쓰러진다 — 막타 순간 원장이 defeated 를 세우면 쓰러짐 연출과
  // 적 HP 행 숨김이 바가 줄기도 전에 돌았다(2026-10-02 적대적 리뷰). deferDefeat 는 쓰러짐 표시만 미룬다.

  function ledger() {
    const runtime = createBattleRuntime({ project: deserialize(JSON.stringify(strictFixture)), troopId: "troop_strict_training", canEscape: false, canLose: true, rng: () => 0.5 });
    const before = runtime.snapshot();
    const enemy = before.enemies[0];
    return { presentation: createPresentationLedger(before), enemyId: enemy.id, hp: enemy.hp };
  }
  describe("presentation ledger deferDefeat", () => {
    it("막타 뒤 쓰러짐 표시는 풀어 줄 때까지 미뤄지고, HP 는 바로 0 이다", () => {
      const { presentation, enemyId, hp } = ledger();
      presentation.applyFeedback({ targetId: enemyId, amount: hp + 50, critical: false, healing: false });
      expect(presentation.vitalsFor(enemyId)?.defeated).toBe(true);
      const release = presentation.deferDefeat(enemyId);
      expect(presentation.vitalsFor(enemyId)).toMatchObject({ hp: 0, defeated: false });
      // 미루는 동안 한 번 더 맞아도 쓰러짐은 서지 않는다.
      presentation.applyFeedback({ targetId: enemyId, amount: 3, critical: false, healing: false });
      expect(presentation.vitalsFor(enemyId)?.defeated).toBe(false);
      release();
      expect(presentation.vitalsFor(enemyId)?.defeated).toBe(true);
      release();
      expect(presentation.vitalsFor(enemyId)?.defeated).toBe(true);
    });

    it("살아 있는 대상에는 아무것도 하지 않고, 미루는 중 회복하면 풀어도 서지 않는다", () => {
      const { presentation, enemyId, hp } = ledger();
      presentation.deferDefeat(enemyId)();
      expect(presentation.vitalsFor(enemyId)?.defeated).toBe(false);
      presentation.applyFeedback({ targetId: enemyId, amount: hp, critical: false, healing: false });
      const release = presentation.deferDefeat(enemyId);
      presentation.applyFeedback({ targetId: enemyId, amount: 5, critical: false, healing: true });
      release();
      expect(presentation.vitalsFor(enemyId)).toMatchObject({ hp: 5, defeated: false });
    });
  });
});

describe("battleRecoveryResourceDisplay", () => {
  isolateTimers();
  // 회복 아이템이 **어느 자원을** 움직였는지가 표시 계층까지 보존되는지 고정한다.
  // 회귀 실측(2026-09-15, 출하 플레이어): 마력약(MP+30/HP+0) 사용 시 파티 카드 HP 가
  // 250→280 으로 올다가 다음 커맨드 국면에 250 으로 되돌아갔고 메시지는 "30 피해!" 였다.

  const ACTOR = "actor_hero";
  const ETHER = "item_ether";
  const POTION = "item_potion";
  type Project = ReturnType<typeof deserialize>;
  function battleProject(): Project {
    const project = deserialize(JSON.stringify(itemFixture));
    project.system.battleModel = "rm2k3";
    project.system.battleUiStyle = "retro2003";
    return project;
  }
  function startBattle(project: Project) {
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
      rng: () => 0.5,
      party: {
        partyActorIds: [ACTOR],
        levels: { [ACTOR]: 1 },
        experience: { [ACTOR]: 0 },
        vitals: { [ACTOR]: { hp: 50, mp: 10 } },
        stateIds: { [ACTOR]: [] },
      },
      sessionState: {
        switches: {},
        variables: {},
        inventory: { [ETHER]: 3, [POTION]: 3 },
      },
    });
    for (let i = 0; i < 40; i += 1) {
      runtime.tick(1_000);
      if (runtime.snapshot().phase === "actorCommand") break;
    }
    return runtime;
  }
  /** 아이템을 한 번 쓰고 타임라인 엔트리·시퀀서 피드백·원장·감독 대사를 한 번에 모은다. */
  function useItem(project: Project, itemId: string) {
    const runtime = startBattle(project);
    const command = { kind: "item" as const, itemId, targetEnemyId: "", targetActorId: ACTOR };
    const before = runtime.snapshot();
    runtime.performActorCommand(command);
    const after = runtime.snapshot();
    const entry = after.timeline.slice(before.timeline.length).at(-1);

    const feedbacks: Array<DamageFeedback | undefined> = [];
    const lines: string[] = [];
    const queue: Array<() => void> = [];
    const ledger = createPresentationLedger(before);
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => lines.push(...state.lines),
        onSyncView: () => {},
        onDamageFeedback: (feedback) => {
          feedbacks.push(feedback);
          if (feedback) ledger.applyFeedback(feedback);
        },
        onResultStage: () => {},
        onSequenceBusy: () => {},
      },
      (callback) => {
        queue.push(callback);
        return queue.length;
      },
      () => {},
    );
    sequencer.runAfterActorCommand(command, before, after);
    for (let i = 0; i < 60 && queue.length; i += 1) queue.shift()?.();
    sequencer.cancel();

    const director = actorCommandDirectorState(command, before, after);
    return {
      entry,
      directorLines: director.lines,
      feedback: feedbacks.find((f) => f && f.healing),
      ledgers: ledger.vitalsFor(ACTOR),
      engine: after.actors.find((actor) => actor.recordId === ACTOR),
      startLedgers: before.actors.find((actor) => actor.recordId === ACTOR),
    };
  }
  describe("battle recovery resource contract", () => {
    it("MP-only recovery never touches displayed HP", () => {
      const result = useItem(battleProject(), ETHER);

      expect(result.entry?.kind).toBe("healing");
      expect(result.entry?.resource).toBe("mp");
      expect(result.entry?.amount).toBe(30);
      expect(result.feedback?.resource).toBe("mp");
      expect(result.ledgers?.hp).toBe(result.engine?.hp);
      expect(result.ledgers?.hp).toBe(50);
    });

    it("HP recovery credits the healed amount to displayed HP", () => {
      const result = useItem(battleProject(), POTION);

      expect(result.entry?.resource).toBe("hp");
      expect(result.entry?.amount).toBe(50);
      expect(result.feedback?.resource).toBe("hp");
      expect(result.ledgers?.hp).toBe(100);
      expect(result.ledgers?.hp).toBe(result.engine?.hp);
    });

    it("a mixed HP+MP item reports only the HP gain, not their sum", () => {
      const project = battleProject();
      const potion = project.database.items.find((item) => item.id === POTION);
      if (!potion) throw new Error("fixture item missing");
      potion.hpRecovery = { flat: 10, percentMax: 0 };
      potion.mpRecovery = { flat: 20, percentMax: 0 };

      const result = useItem(project, POTION);

      expect(result.entry?.resource).toBe("hp");
      expect(result.entry?.amount).toBe(10);
      expect(result.ledgers?.hp).toBe(60);
    });

    it("a healing item's message says recovery, not damage", () => {
      const potion = useItem(battleProject(), POTION);
      const line = potion.directorLines.join(" ");
      expect(line).toMatch(/회복했다/);
      expect(line).not.toMatch(/피해!/);

      const ether = useItem(battleProject(), ETHER);
      const etherLine = ether.directorLines.join(" ");
      expect(etherLine).toMatch(/회복했다/);
      expect(etherLine).toMatch(/MP를 30/);
      expect(etherLine).not.toMatch(/피해!/);
    });
  });
});

describe("battleStageScale", () => {
  isolateTimers();
  describe("calculateBattleStageScale", () => {
    it.each([
      [640, 480, 1], [1280, 960, 2], [320, 240, 0.5],
      [640, 360, 0.75], [426, 240, 0.5], [256, 192, 0.4], [1000, 750, 1.5625],
    ])("fits %s×%s without shrinking to a half-step or cropping", (width, height, expected) => {
      const scale = calculateBattleStageScale(width, height);
      expect(scale).toBeCloseTo(expected);
      const drawnWidth = scale * BATTLE_LOGICAL_WIDTH;
      const drawnHeight = scale * BATTLE_LOGICAL_HEIGHT;
      expect(drawnWidth).toBeLessThanOrEqual(width);
      expect(drawnHeight).toBeLessThanOrEqual(height);
      expect(Math.min(width - drawnWidth, height - drawnHeight)).toBeCloseTo(0);
    });

    it.each([0, -10, NaN, Infinity])("uses a safe scale for invalid dimensions %s", value => {
      expect(calculateBattleStageScale(value, 480)).toBe(1);
      expect(calculateBattleStageScale(640, value)).toBe(1);
    });
  });
});

describe("battleStrictRuntime", () => {
  isolateTimers();
  function strictProject(): Project {
    return deserialize(JSON.stringify(strictFixture));
  }
  function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`missing actor: ${actorId}`);
    actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
  }
  function setStrictBattleStats(project: Project): void {
    setActorParam(project, "actor_warrior", "agility", 10);
    setActorParam(project, "actor_warrior", "attack", 8);
    setActorParam(project, "actor_mage", "agility", 30);
    setActorParam(project, "actor_mage", "attack", 6);
    setActorParam(project, "actor_mage", "mind", 24);
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
    if (!enemy) throw new Error("missing enemy_training_slime");
    enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility: 20 };
  }
  function installStrictBattleEventPage(project: Project, commands: readonly Command[]): void {
    const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
    if (!troop) throw new Error("missing troop_strict_training");
    troop.battleEventPages = [{
      id: "page_strict_flow",
      name: "엄격 흐름",
      span: "battle",
      runOnce: true,
      conditions: [{ kind: "turn", start: 1, interval: 0 }],
      commands: [...commands],
    }];
  }
  function soloWarriorRuntime(project: Project) {
    return createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
      rng: () => 0,
    });
  }
  function commandPanelTexts(root: FakeElement): string[] {
    return root.querySelectorAll("button").map((button) => button.textContent);
  }
  describe("battle strict runtime and class commands", () => {
    it("renders class battle commands in authored order and falls back to default commands", () => {
      const project = strictProject();
      expect(battleCommandsForActor(project, "actor_warrior").map((command) => command.name)).toEqual(["공격", "방어", "도주"]);

      const mageClass = project.database.classes.find((record) => record.id === "class_mage");
      if (!mageClass) throw new Error("missing mage class");
      mageClass.battleCommands = [];
      expect(battleCommandsForActor(project, "actor_mage").map((command) => command.kind)).toEqual(["attack", "skill", "item", "defend", "escape"]);

      const cleanup = installFakeDom();
      try {
        store.replace(project);
        const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: true, canLose: true, battleFlow: "strict" });
        runtime.performActorCommand({ kind: "defend" });
        const root = commandPanel(runtime.snapshot(), {
          runtime,
          submenu: null,
          setSubmenu: () => undefined,
          setDirectorState: () => undefined,
          render: () => undefined,
          runActorCommand: () => undefined,
          beginTargetCommand: () => undefined,
          confirmTargetSelection: () => undefined,
        }) as unknown as FakeElement;
        expect(commandPanelTexts(root)).toEqual(["Attack", "Skill", "Item1종", "방어", "도주"]);
      } finally {
        cleanup();
      }
    });

    it("filters skill submenu by class command skill group", () => {
      const project = strictProject();
      const cleanup = installFakeDom();
      try {
        store.replace(project);
        const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: true, canLose: true, battleFlow: "strict" });
        runtime.performActorCommand({ kind: "defend" });
        const magic = battleCommandsForActor(project, "actor_mage").find((command) => command.id === "cmd_magic");
        if (!magic) throw new Error("missing magic command");
        const root = commandPanel(runtime.snapshot(), {
          runtime,
          submenu: { kind: "skill", command: magic },
          setSubmenu: () => undefined,
          setDirectorState: () => undefined,
          render: () => undefined,
          runActorCommand: () => undefined,
          beginTargetCommand: () => undefined,
          confirmTargetSelection: () => undefined,
        }) as unknown as FakeElement;
        expect(root.textContent).toContain("화염");
        expect(root.textContent).not.toContain("집중");
      } finally {
        cleanup();
      }
    });

    it("collects all actor commands, then resolves strict rounds by speed", () => {
      const project = strictProject();
      setStrictBattleStats(project);
      const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0 });

      expect(runtime.snapshot().phase).toBe("actorCommand");
      expect(runtime.snapshot().activeActorId).toBe("actor_warrior");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().activeActorId).toBe("actor_mage");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      const firstRound = runtime.snapshot().roundLogs[0];
      expect(firstRound?.actions.map((action) => action.userRecordId)).toEqual(["actor_mage", "enemy_training_slime", "actor_warrior"]);
    });

    it("uses actor-first and index-order tie breaks without RNG", () => {
      const project = strictProject();
      setActorParam(project, "actor_warrior", "agility", 20);
      const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
      if (!enemy) throw new Error("missing enemy_training_slime");
      enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility: 20 };

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
        rng: () => 0.99,
      });
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId)).toEqual(["actor_warrior", "enemy_training_slime"]);
    });

    it("advances state duration once per strict round", () => {
      const project = strictProject();
      project.database.states.push({
        id: "state_round_marker",
        name: "라운드 표식",
        restriction: "없음",
        removalCondition: "전투 종료 후 유지",
        recoverNaturallyFromTurn: 2,
        recoverNaturallyChance: 100,
      });
      const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
      if (!enemy) throw new Error("missing enemy_training_slime");
      enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1 };

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        party: {
          levels: { actor_warrior: 1 },
          experience: {},
          partyActorIds: ["actor_warrior"],
          stateIds: { actor_warrior: ["state_round_marker"] },
        },
        rng: () => 0,
      });
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().roundLogs[0]?.actors[0]?.stateIds).toContain("state_round_marker");
      expect(runtime.snapshot().actors[0]?.stateIds).not.toContain("state_round_marker");
    });

    it("keeps gauge mode as the default battle flow", () => {
      const project = strictProject();
      const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
      if (troop) troop.battleFlow = "gauge";
      const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: true, canLose: true });

      expect(runtime.snapshot().battleFlow).toBe("gauge");
      expect(runtime.snapshot().phase).toBe("charging");
      runtime.tick(1_000);
      expect(runtime.snapshot().phase).toBe("actorCommand");
    });

    it("suspends a strict round at the authored wait until acknowledgement", () => {
      const project = strictProject();
      setStrictBattleStats(project);
      setActorParam(project, "actor_warrior", "agility", 99);
      installStrictBattleEventPage(project, [{ kind: "wait", ms: 500 }]);
      const runtime = soloWarriorRuntime(project);

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      const snapshot = runtime.snapshot();
      const request = snapshot.eventPause;
      expect(request).toMatchObject({ kind: "wait", ms: 500 });
      if (!request) throw new Error("missing authored wait");
      expect(snapshot.roundLogs).toHaveLength(0);
      runtime.tick(10_000);
      expect(runtime.snapshot()).toEqual(snapshot);
      expect(runtime.resumeEventPause(request.id, { kind: "wait" })).toBe(true);
      expect(runtime.snapshot().roundLogs).toHaveLength(1);
      expect(runtime.snapshot().eventPause).toBeUndefined();
      expect(snapshot.eventLogs.filter((log) => log.kind === "unsupported")).toEqual([]);
    });

    it("grants an m2-108 extra action inside the same strict round", () => {
      const project = strictProject();
      setStrictBattleStats(project);
      setActorParam(project, "actor_warrior", "agility", 99);
      installStrictBattleEventPage(project, [
        { kind: "m2Command", commandId: "m2-108-action-times", fields: { target: "actor_warrior", value: 1 } } as unknown as Command,
      ]);
      const runtime = soloWarriorRuntime(project);

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      const firstRound = runtime.snapshot().roundLogs[0];
      // Extra action resolves in the same round, ordered by the round's speed ordering
      // (agility 99 actor before the agility 20 slime).
      expect(firstRound?.actions.map((action) => action.userRecordId))
        .toEqual(["actor_warrior", "actor_warrior", "enemy_training_slime"]);
      expect(firstRound?.actions.map((action) => action.order)).toEqual([1, 2, 3]);
      expect(runtime.snapshot().eventLogs.filter((log) => log.kind === "unsupported")).toEqual([]);
    });

    it("simulateBattle replays a three-round strict script with round logs", () => {
      const project = strictProject();
      setStrictBattleStats(project);

      const result = simulateBattle({
        project,
        troopId: "troop_strict_training",
        heroLevel: 1,
        battleFlow: "strict",
        seed: 7,
        n: 1,
        maxSteps: 6,
        strictScript: [
          [
            { actorId: "actor_warrior", command: "attack", target: "enemy-1" },
            { actorId: "actor_mage", command: "skill", skillId: "skill_fire", target: "enemy-1" },
          ],
          [
            { actorId: "actor_warrior", command: "guard" },
            { actorId: "actor_mage", command: "skill", skillId: "skill_fire", target: "enemy-1" },
          ],
          [
            { actorId: "actor_warrior", command: "attack", target: "enemy-1" },
            { actorId: "actor_mage", command: "attack", target: "enemy-1" },
          ],
        ],
      });

      expect(result.battleFlow).toBe("strict");
      expect(result.roundLogs).toHaveLength(3);
      expect(result.roundLogs[0]?.actions.map((action) => action.userRecordId)).toEqual(["actor_mage", "enemy_training_slime", "actor_warrior"]);
      expect(result.roundLogs[1]?.actions.map((action) => action.commandKind)).toEqual(["skill", "enemyAttack", "defend"]);
      expect(result.roundLogs[2]?.actions.map((action) => action.userRecordId)).toEqual(["actor_mage", "enemy_training_slime", "actor_warrior"]);
    });
  });
});

describe("cameraDebugTeardown", () => {
  isolateTimers();
  // 도그푸딩 2026-09-24 (추리 레인): 런타임 QA 증거 런이 엔딩 → 타이틀 복귀 시점에
  // cameraDebug 의 "Cannot read properties of undefined (reading 'centerX')" TypeError 로
  // 런 전체(SUMMARY 미작성)가 죽었다. Phaser CameraManager.shutdown() 은 SHUTDOWN 에서
  // main 을 undefined 로 비우는데 훅 제거는 그 뒤에 돌도록 등록돼 있어 그 틈에
  // __oprnCamera() 를 부르면 죽는다. 훅 계약은 "카메라가 없으면 null" — 실제 소비자
  // (runtimeQaRun 의 canvasView/readShadowGeometry)는 이미 null 을 받는 쪽으로 쓴다.

  type HookWindow = Window & { __oprnCamera?: () => unknown };
  const previousWindow = globalThis.window;
  afterEach(() => {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  });
  function install(sceneExtra: Record<string, unknown>): void {
    const testWindow = { location: { search: "" } } as HookWindow;
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
    const session = { currentMapId: "map_town", x: 1, y: 1, switches: {}, variables: {}, inventory: {}, gold: 0, flags: {}, timers: {} };
    const scene = { events: { once: vi.fn() }, getMapId: () => session.currentMapId, tileX: 1, tileY: 1, ...sceneExtra };
    installPlaySceneTestHooks(
      scene as never,
      { injectActionEdge: vi.fn(), injectAttackEdge: vi.fn(), injectSkillEdge: vi.fn(), injectDirection: vi.fn() } as never,
      () => session as never,
      vi.fn(),
    );
  }
  describe("cameraDebug — 씬 종료 틈의 관측 계약", () => {
    it("카메라가 이미 비워진 Scene SHUTDOWN 틈에도 __oprnCamera() 는 던지지 않고 null 을 준다", () => {
      install({ cameras: { main: undefined } });
      expect(() => window.__oprnCamera?.()).not.toThrow();
      expect(window.__oprnCamera?.()).toBeNull();
    });

    it("카메라 매니저 자체가 아직 없어도 TypeError 대신 null 을 준다", () => {
      install({});
      expect(window.__oprnCamera?.()).toBeNull();
    });

    it("카메라가 살아 있으면 수치를 그대로 돌려준다", () => {
      const main = { centerX: 1, centerY: 2, height: 3, scrollX: 4, scrollY: 5, width: 6, zoom: 7 };
      install({ cameras: { main } });
      expect(window.__oprnCamera?.()).toEqual({
        centerX: 1, centerY: 2, height: 3, scrollX: 4, scrollY: 5, width: 6, zoom: 7,
      });
    });
  });
});

describe("characterHop", () => {
  isolateTimers();
  describe("character hop curves", () => {
    it("점프 아크는 양 끝이 접지이고 중간이 최고점이다", () => {
      expect(jumpArcLiftPx(0, 12)).toBe(0);
      expect(jumpArcLiftPx(1, 12)).toBe(0);
      expect(jumpArcLiftPx(0.5, 12)).toBe(12);
      // 대칭성: 상승 구간과 하강 구간의 같은 거리에서 높이가 같다.
      expect(jumpArcLiftPx(0.25, 12)).toBeCloseTo(jumpArcLiftPx(0.75, 12), 6);
      // 단조 상승 → 단조 하강.
      expect(jumpArcLiftPx(0.3, 12)).toBeGreaterThan(jumpArcLiftPx(0.1, 12));
      expect(jumpArcLiftPx(0.9, 12)).toBeLessThan(jumpArcLiftPx(0.7, 12));
    });

    it("낙하는 시작 높이에서 접지까지 가속하며 내려온다", () => {
      expect(fallLiftPx(0, 128)).toBe(128);
      expect(fallLiftPx(1, 128)).toBe(0);
      // 등가속이라 전반부보다 후반부에서 더 많이 떨어진다.
      const firstHalf = fallLiftPx(0, 128) - fallLiftPx(0.5, 128);
      const secondHalf = fallLiftPx(0.5, 128) - fallLiftPx(1, 128);
      expect(secondHalf).toBeGreaterThan(firstHalf);
    });

    it("낙하는 헤드스타트로 시작 속도를 갖는다 — 위에서 머무는 구간이 없다", () => {
      // 초속 0 이던 1-p² 는 앞 절반에 25% 만 내려와 화면 위에서 어물거렸다.
      const firstHalfRatio = (fallLiftPx(0, 128) - fallLiftPx(0.5, 128)) / 128;
      expect(firstHalfRatio).toBeGreaterThan(0.35);
      // 첫 프레임부터 눈에 보이게 움직인다(60fps 기준 620ms 의 한 프레임 ≈ p 0.027).
      expect(fallLiftPx(0.027, 128)).toBeLessThan(126);
      // 그래도 단조 하강이고 가속이 유지된다.
      expect(fallLiftPx(0.75, 128)).toBeLessThan(fallLiftPx(0.5, 128));
      expect(hopSpeedRatio(fallHop({}), 1)).toBeGreaterThan(hopSpeedRatio(fallHop({}), 0));
    });

    it("진행도와 값을 범위 밖으로 줘도 안전하다", () => {
      expect(jumpArcLiftPx(-1, 12)).toBe(0);
      expect(jumpArcLiftPx(2, 12)).toBe(0);
      expect(fallLiftPx(Number.NaN, 128)).toBe(128);
      expect(clampHopLiftPx(-5)).toBe(0);
      expect(clampHopLiftPx(Number.POSITIVE_INFINITY)).toBe(0);
      expect(clampHopLiftPx(MAX_HOP_LIFT_PX * 10)).toBe(MAX_HOP_LIFT_PX);
      expect(clampHopDurationMs(0)).toBe(MIN_HOP_DURATION_MS);
      expect(clampHopDurationMs(Number.NaN)).toBe(DEFAULT_JUMP_DURATION_MS);
    });

    it("저작 명령의 빈 옵션은 기본값이 되고, 낙하만 임팩트가 켜진다", () => {
      const jump = jumpHop({});
      expect(jump).toMatchObject({ kind: "jump", liftPx: DEFAULT_JUMP_PEAK_PX, impact: false });
      const fall = fallHop({});
      expect(fall).toMatchObject({ kind: "fall", liftPx: DEFAULT_FALL_HEIGHT_PX, impact: true });
      expect(jumpHop({ heightPx: 40, durationMs: 10, se: "se_x" })).toMatchObject({
        liftPx: 40,
        durationMs: MIN_HOP_DURATION_MS,
        se: "se_x",
      });
      expect(characterHopLiftPx(fall, 0)).toBe(DEFAULT_FALL_HEIGHT_PX);
      expect(characterHopLiftPx(jump, 0)).toBe(0);
    });
  });
  describe("origin lift channel", () => {
    it("리프트를 원점 Y 로 환산할 때 스케일로 나눈다", () => {
      // 기본(32px, 배율 1): 16px 을 띄우면 원점이 절반 더 늘어난다.
      expect(hopOriginY(16, 32, 1)).toBe(1.5);
      // 배율 2 인 큰 보스도 화면상 16px 만 뜬다 — 원점 증가분이 절반이다.
      expect(hopOriginY(16, 32, 2)).toBe(1.25);
      expect(hopOriginY(0, 32, 1)).toBe(1);
      expect(hopOriginY(16, 0, 1)).toBe(1);
    });

    it("스프라이트가 높이를 안 주면 캐릭셋 32px 로 계산한다", () => {
      const calls: Array<readonly [number, number]> = [];
      const sprite = {
        setOrigin(x: number, y: number) {
          calls.push([x, y]);
        },
      };
      applyCharacterLift(sprite, 16);
      clearCharacterLift(sprite);
      expect(calls).toEqual([
        [0.5, 1.5],
        [0.5, 1],
      ]);
    });

    it("스프라이트가 없어도 조용히 넘어간다", () => {
      expect(() => applyCharacterLift(undefined, 16)).not.toThrow();
      expect(() => clearCharacterLift(undefined)).not.toThrow();
    });
  });
  describe("landing impact plan", () => {
    it("임팩트가 없는 점프는 계획을 만들지 않는다", () => {
      expect(landingImpactPlan(jumpHop({}))).toBeNull();
    });

    it("저작 효과음만 있으면 흔들림 없이 소리만 낸다", () => {
      const plan = landingImpactPlan(jumpHop({ se: "se_hop" }));
      expect(plan).toMatchObject({ shakeMs: 0, dust: false, se: "se_hop" });
    });

    it("한 칸 이하 높이에서는 임팩트를 내지 않는다", () => {
      expect(landingImpactPlan(fallHop({ heightPx: MIN_IMPACT_LIFT_PX }))).toBeNull();
    });

    it("높이가 커지면 흔들림이 세지고 기본 효과음이 붙는다", () => {
      const low = landingImpactPlan(fallHop({ heightPx: 24 }));
      const high = landingImpactPlan(fallHop({}));
      expect(low?.se).toBe(DEFAULT_LANDING_SE);
      expect(high?.shakeMs).toBeGreaterThan(low?.shakeMs ?? 0);
      expect(high?.shakeRatio).toBeGreaterThan(low?.shakeRatio ?? 0);
      expect(high?.dust).toBe(true);
    });

    it("높이가 커지면 먼지 구름도 커진다 — 흔들림·소리와 같은 세기를 쓴다", () => {
      const low = landingImpactPlan(fallHop({ heightPx: TILE_SIZE + 2 }));
      const high = landingImpactPlan(fallHop({}));
      // 하한 바로 위(18px)는 기존 크기에서 거의 안 움직이고, 포화(4 칸) 이상은 뚜렷하게 크다.
      expect(low?.dustEndScale).toBeGreaterThanOrEqual(1.6);
      expect(low?.dustEndScale).toBeLessThan(1.7);
      expect(low?.dustRingEndScale).toBeGreaterThanOrEqual(2.6);
      expect(low?.dustRingEndScale).toBeLessThan(2.75);
      expect(high?.dustEndScale).toBeCloseTo(2.6, 6);
      expect(high?.dustRingEndScale).toBeCloseTo(4.4, 6);
      // 링은 항상 코어보다 넓다 — 두 겹이 구분돼야 터지는 타이밍이 보인다.
      expect(high?.dustRingEndScale).toBeGreaterThan(high?.dustEndScale ?? 0);
      // 4 칸에서 포화하므로 8 칸과 12 칸은 같다.
      expect(landingImpactPlan(fallHop({ heightPx: TILE_SIZE * 12 }))?.dustEndScale).toBeCloseTo(2.6, 6);
    });

    it("모션 축소 환경에서는 흔들림·먼지를 버리고 소리만 남긴다", () => {
      const plan = landingImpactPlan(fallHop({}), { reducedMotion: true });
      expect(plan).toMatchObject({ shakeMs: 0, shakeRatio: 0, dust: false, se: DEFAULT_LANDING_SE });
      // 먼지를 안 낼 때 크기는 0 이다 — 호출부가 실수로 스프라이트를 만들지 않게.
      expect(plan?.dustEndScale).toBe(0);
      expect(plan?.dustRingEndScale).toBe(0);
    });
  });
  describe("airborne shadow curve", () => {
    it("높이가 커지면 그림자가 작고 옅어진다", () => {
      expect(shadowScaleForLift(0)).toBeGreaterThan(shadowScaleForLift(16));
      expect(shadowScaleForLift(16)).toBeGreaterThan(shadowScaleForLift(32));
      expect(shadowAlphaForLift(0)).toBeGreaterThan(shadowAlphaForLift(32));
      // 포화 후에는 더 줄지 않는다(아주 높은 낙하에서 그림자가 사라지지 않는다).
      expect(shadowScaleForLift(999)).toBe(shadowScaleForLift(32));
      expect(shadowAlphaForLift(999)).toBeGreaterThan(0);
    });

    it("기준 높이를 주면 그 높이 전 구간에서 그림자가 자란다", () => {
      // 회귀: 기준이 없으면 128px 낙하의 중반(64px)이 이미 포화라 "다가온다" 를 못 준다.
      expect(shadowScaleForLift(64)).toBe(shadowScaleForLift(128));
      // 기준을 주면 중반이 최소·최대 사이에 있다.
      const mid = shadowScaleForLift(64, 128);
      expect(mid).toBeGreaterThan(shadowScaleForLift(128, 128));
      expect(mid).toBeLessThan(shadowScaleForLift(0, 128));
      expect(shadowAlphaForLift(64, 128)).toBeGreaterThan(shadowAlphaForLift(128, 128));
      // 기준이 기본 페이드 범위보다 작으면(제자리 홉) 기존 곡선과 값이 같다.
      expect(shadowScaleForLift(8, 12)).toBe(shadowScaleForLift(8));
    });
  });
  describe("hop squash and stretch", () => {
    it("빠를 때 세로로 늘고, 착지에서 납작해진다", () => {
      const fall = fallHop({});
      const start = hopStretchScale(fall, 0);
      const impact = hopStretchScale(fall, 1);
      expect(start.y).toBeGreaterThan(1);
      expect(impact.y).toBeGreaterThan(start.y);
      // 세로로 늘린 만큼 가로는 줄어든다 — 부피가 유지되는 것처럼 보이게.
      expect(impact.x).toBeLessThan(1);

      const squash = hopLandingSquashScale(fall);
      expect(squash.y).toBeLessThan(1);
      expect(squash.x).toBeGreaterThan(1);
    });

    it("점프는 이·착지에서 늘고 최고점에서 중립이다", () => {
      const jump = jumpHop({ heightPx: 48 });
      expect(hopSpeedRatio(jump, 0.5)).toBe(0);
      expect(hopStretchScale(jump, 0.5)).toEqual({ x: 1, y: 1 });
      expect(hopStretchScale(jump, 0).y).toBeGreaterThan(1);
      expect(hopStretchScale(jump, 1).y).toBeGreaterThan(1);
    });

    it("낮은 홉은 거의 늘어나지 않는다", () => {
      // 기본 제자리 홉(12px)은 3 칸 게이트의 1/4 이라 과장되지 않는다.
      const small = hopStretchScale(jumpHop({}), 0);
      expect(small.y).toBeGreaterThan(1);
      expect(small.y).toBeLessThan(1.06);
      expect(hopLandingSquashScale(jumpHop({ heightPx: 0 }))).toEqual({ x: 1, y: 1 });
    });

    it("스케일은 기준 배율에 곱해서 얹는다 — 저작 배율이 살아남는다", () => {
      const calls: Array<readonly [number, number]> = [];
      const sprite = {
        scaleX: 2,
        scaleY: 2,
        setOrigin: () => undefined,
        setScale(x: number, y: number) {
          calls.push([x, y]);
        },
      };
      const base = hopBaseScaleOf(sprite);
      expect(base).toEqual({ x: 2, y: 2 });
      applyHopScale(sprite, base, { x: 0.9, y: 1.2 });
      expect(calls.at(-1)).toEqual([1.8, 2.4]);
      // setScale 이 없는 목 스프라이트에서는 조용히 빠진다(리프트만 남는다).
      expect(() => applyHopScale({ setOrigin: () => undefined }, base, { x: 1, y: 1 })).not.toThrow();
    });
  });
  describe("hop perspective scale", () => {
    it("높을 때 크고, 접지에서 정확히 1 로 닫힌다", () => {
      // 기본 낙하 높이(8 칸) = 낙하 게이트 상한이라 시작 배율이 정확히 ×3 이다.
      const fall = fallHop({ heightPx: DEFAULT_FALL_HEIGHT_PX });
      expect(hopPerspectiveScale(fall, DEFAULT_FALL_HEIGHT_PX)).toEqual({
        x: 1 + FALL_PERSPECTIVE_MAX,
        y: 1 + FALL_PERSPECTIVE_MAX,
      });
      expect(hopPerspectiveScale(fall, 0)).toEqual({ x: 1, y: 1 });
      // 정규화 리프트에 선형 — 절반 높이면 증가분도 절반이다.
      const half = hopPerspectiveScale(fall, DEFAULT_FALL_HEIGHT_PX / 2);
      expect(half.y).toBeCloseTo(1 + FALL_PERSPECTIVE_MAX / 2, 6);
      // 원근은 등방 확대다 — 스트레치처럼 가로를 줄이지 않는다.
      expect(half.x).toBe(half.y);
    });

    it("낮게 저작한 낙하는 그만큼 비례해 덜 받는다 — 2 칸 낙하가 ×3 으로 부풀지 않는다", () => {
      const shallow = fallHop({ heightPx: TILE_SIZE * 2 });
      // 8 칸 게이트의 1/4 이라 시작 배율은 1 + 2×0.25 = 1.5 다.
      expect(hopPerspectiveScale(shallow, TILE_SIZE * 2).y).toBeCloseTo(1 + FALL_PERSPECTIVE_MAX * 0.25, 6);
    });

    it("점프는 낙하보다 훨씬 약한 원근을 받는다 — 뛸 때마다 화면이 줌하지 않게", () => {
      // 같은 4 칸 높이라도 점프는 점프 상수(0.35/4 칸), 낙하는 낙하 상수(2/8 칸) 를 쓴다.
      const height = TILE_SIZE * 4;
      expect(hopPerspectiveScale(jumpHop({ heightPx: height }), height).y).toBeCloseTo(1 + HOP_PERSPECTIVE_MAX, 6);
      expect(hopPerspectiveScale(fallHop({ heightPx: height }), height).y).toBeCloseTo(
        1 + FALL_PERSPECTIVE_MAX * 0.5,
        6
      );
    });

    it("리프트가 범위를 벗어나도 배율은 1..1+MAX 안에 머문다", () => {
      const fall = fallHop({ heightPx: DEFAULT_FALL_HEIGHT_PX });
      expect(hopPerspectiveScale(fall, -10)).toEqual({ x: 1, y: 1 });
      expect(hopPerspectiveScale(fall, 999).y).toBeCloseTo(1 + FALL_PERSPECTIVE_MAX, 6);
      // 높이 0 인 홉은 0 으로 나누지 않고 중립을 낸다.
      expect(hopPerspectiveScale(fallHop({ heightPx: 0 }), 0)).toEqual({ x: 1, y: 1 });
    });

    it("낮은 홉은 원근을 거의 안 받는다 — 제자리 점프가 줌처럼 보이지 않게", () => {
      // 기본 제자리 홉(12px)은 4 칸 게이트의 3/16 이라 최고점에서도 7% 밑이다.
      const jump = jumpHop({});
      const apex = hopPerspectiveScale(jump, DEFAULT_JUMP_PEAK_PX);
      expect(apex.y).toBeGreaterThan(1);
      expect(apex.y).toBeLessThan(1.07);
    });

    it("체공 배율은 스트레치 × 원근이고, 낙하 동안 단조 감소한다", () => {
      const fall = fallHop({ heightPx: 64 });
      const start = hopAirScale(fall, 0);
      expect(start.y).toBeCloseTo(hopStretchScale(fall, 0).y * hopPerspectiveScale(fall, 64).y, 6);
      // 원근이 가로를 밀어 올려서, 시작 프레임은 스트레치만 있을 때와 달리 가로도 1 보다 크다.
      expect(hopStretchScale(fall, 0).x).toBeLessThan(1);
      expect(start.x).toBeGreaterThan(1);
      // 떨어지는 동안 계속 작아진다 — "가까이 있던 것이 멀어진다" 가 아니라 원근이 풀리는 것.
      const samples = [0, 0.25, 0.5, 0.75, 1].map((p) => hopAirScale(fall, p).y);
      for (let index = 1; index < samples.length; index += 1) {
        expect(samples[index]).toBeLessThan(samples[index - 1]);
      }
      // 접지 프레임은 스트레치만 남는다(원근 1) — 착지 스쿼시가 접지 크기에서 시작한다.
      expect(hopAirScale(fall, 1)).toEqual(hopStretchScale(fall, 1));
    });
  });
});

describe("cloudShadows", () => {
  isolateTimers();
  const VIEW = { x: 0, y: 0, width: 960, height: 720 };
  function params(overrides: Partial<CloudShadowParams> = {}): CloudShadowParams {
    return { ...normalizeCloudShadowParams({ enabled: true }), ...overrides };
  }
  function mod(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
  }
  function positionKey(x: number, y: number): string {
    return `${Math.round(x * 100) / 100}|${Math.round(y * 100) / 100}`;
  }
  describe("normalizeCloudShadowParams", () => {
    it("설정이 없으면 기본값 + 꺼짐", () => {
      expect(normalizeCloudShadowParams(undefined)).toEqual({ enabled: false, ...CLOUD_SHADOW_DEFAULTS });
    });

    it("enabled 만 있으면 나머지는 기본값", () => {
      expect(normalizeCloudShadowParams({ enabled: true })).toEqual({ enabled: true, ...CLOUD_SHADOW_DEFAULTS });
    });

    it("범위 밖 수치는 범위로 접는다", () => {
      const wild = normalizeCloudShadowParams({
        enabled: true,
        opacity: 5,
        speed: -20,
        angleDeg: 400,
        scale: 99,
      });
      expect(wild.opacity).toBe(CLOUD_SHADOW_OPACITY_RANGE.max);
      expect(wild.speed).toBe(CLOUD_SHADOW_SPEED_RANGE.min);
      expect(wild.angleDeg).toBe(40);
      expect(wild.scale).toBe(CLOUD_SHADOW_SCALE_RANGE.max);

      const floor = normalizeCloudShadowParams({ enabled: true, opacity: -3, speed: 900, scale: 0 });
      expect(floor.opacity).toBe(CLOUD_SHADOW_OPACITY_RANGE.min);
      expect(floor.speed).toBe(CLOUD_SHADOW_SPEED_RANGE.max);
      expect(floor.scale).toBe(CLOUD_SHADOW_SCALE_RANGE.min);
    });

    it("각도는 360도로 접고 NaN/무한대는 기본값으로 되돌린다", () => {
      expect(normalizeCloudShadowParams({ enabled: true, angleDeg: -90 }).angleDeg).toBe(270);
      expect(normalizeCloudShadowParams({ enabled: true, angleDeg: Number.NaN }).angleDeg).toBe(CLOUD_SHADOW_DEFAULTS.angleDeg);
      expect(normalizeCloudShadowParams({ enabled: true, speed: Number.POSITIVE_INFINITY }).speed).toBe(CLOUD_SHADOW_SPEED_RANGE.max);
    });
  });
  describe("cloudShadowDrift", () => {
    it("꺼져 있으면 흐르지 않는다", () => {
      expect(cloudShadowDrift(normalizeCloudShadowParams(undefined), 5000)).toEqual({ dx: 0, dy: 0 });
    });

    it("방향 0도 = 오른쪽, 90도 = 아래, 속도는 px/초", () => {
      expect(cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 1000)).toEqual({ dx: 40, dy: 0 });
      const down = cloudShadowDrift(params({ speed: 40, angleDeg: 90 }), 1000);
      expect(down.dx).toBeCloseTo(0, 6);
      expect(down.dy).toBeCloseTo(40, 6);
      const left = cloudShadowDrift(params({ speed: 30, angleDeg: 180 }), 1000);
      expect(left.dx).toBeCloseTo(-30, 6);
      expect(left.dy).toBeCloseTo(0, 6);
    });

    it("경과 시간에 비례한다", () => {
      const half = cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 500);
      const full = cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 1000);
      expect(half.dx).toBeCloseTo(full.dx / 2, 6);
      expect(cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 0)).toEqual({ dx: 0, dy: 0 });
    });
  });
  describe("cloudShadowPeriod", () => {
    it("화면을 덮고, 크기 배율에 비례한다", () => {
      const base = cloudShadowPeriod(VIEW, 1);
      expect(base).toBeGreaterThanOrEqual(VIEW.width);
      expect(cloudShadowPeriod(VIEW, 2)).toBe(base * 2);
      expect(cloudShadowPeriod(VIEW, 0.5)).toBe(Math.round(base * 0.5));
    });
  });
  describe("cloudShadowBlobs", () => {
    it("꺼져 있거나 진하기가 0이면 덩어리가 없다", () => {
      expect(cloudShadowBlobs(normalizeCloudShadowParams(undefined), 0, VIEW)).toEqual([]);
      expect(cloudShadowBlobs(params({ opacity: 0 }), 0, VIEW)).toEqual([]);
    });

    it("화면을 덮는 덩어리를 만들고 전부 화면과 겹친다", () => {
      const blobs = cloudShadowBlobs(params(), 0, VIEW);
      // 배치(12개) 중 일부는 화면 밖이라 보이는 덩어리는 그보다 적다 — 0이 아닌 «덮임» 이 계약이다.
      expect(blobs.length).toBeGreaterThanOrEqual(4);
      for (const blob of blobs) {
        expect(blob.x + blob.radius).toBeGreaterThanOrEqual(VIEW.x);
        expect(blob.x - blob.radius).toBeLessThanOrEqual(VIEW.x + VIEW.width);
        expect(blob.y + blob.radius).toBeGreaterThanOrEqual(VIEW.y);
        expect(blob.y - blob.radius).toBeLessThanOrEqual(VIEW.y + VIEW.height);
      }
    });

    it("덩어리 모양·알파는 계약 범위 안이다", () => {
      const setting = params({ opacity: 0.4 });
      for (const blob of cloudShadowBlobs(setting, 0, VIEW)) {
        expect(blob.radius).toBeGreaterThan(0);
        expect(blob.alpha).toBeGreaterThan(0);
        expect(blob.alpha).toBeLessThanOrEqual(setting.opacity);
        expect(blob.squash).toBeGreaterThan(0);
        expect(blob.squash).toBeLessThanOrEqual(1);
        expect(blob.rotationDeg).toBeGreaterThanOrEqual(0);
        expect(blob.rotationDeg).toBeLessThan(360);
      }
    });

    it("같은 입력은 언제나 같은 그림자를 만든다", () => {
      const first = JSON.stringify(cloudShadowBlobs(params({ scale: 1.5 }), 4321, VIEW, 11));
      const second = JSON.stringify(cloudShadowBlobs(params({ scale: 1.5 }), 4321, VIEW, 11));
      expect(second).toBe(first);
    });

    it("시드가 다르면 배치가 다르다", () => {
      const a = JSON.stringify(cloudShadowBlobs(params(), 0, VIEW, 1));
      const b = JSON.stringify(cloudShadowBlobs(params(), 0, VIEW, 2));
      expect(a).not.toBe(b);
    });

    it("1초 뒤 모든 구름 위상이 설정한 방향으로, 배율 범위 안의 거리만큼 이동한다(주기 접힘 포함)", () => {
      const setting = params({ speed: 40, angleDeg: 90, scale: 1 });
      const period = cloudShadowPeriod(VIEW, setting.scale);
      const drift = cloudShadowDrift(setting, 1000);
      const before = cloudShadowAnchors(setting, 0, period, 7);
      const after = cloudShadowAnchors(setting, 1000, period, 7);

      expect(before).toHaveLength(CLOUD_SHADOW_BLOB_COUNT);
      expect(after).toHaveLength(before.length);
      for (let index = 0; index < before.length; index += 1) {
        // 덩어리마다 배율이 다르므로 «정확히 같은 거리» 가 아니다. 방향은 같고, 거리는 범위 안이면 된다.
        const movedX = mod(after[index]!.x - before[index]!.x, period);
        const movedY = mod(after[index]!.y - before[index]!.y, period);
        const factor = movedY / drift.dy;
        expect(factor).toBeGreaterThanOrEqual(CLOUD_SHADOW_SPEED_JITTER.min - 1e-6);
        expect(factor).toBeLessThanOrEqual(CLOUD_SHADOW_SPEED_JITTER.max + 1e-6);
        expect(movedX).toBeCloseTo(mod(drift.dx * factor, period), 3);
      }
    });

    it("보이는 덩어리는 전부 위상 위에 있다", () => {
      const setting = params({ speed: 40, angleDeg: 90, scale: 1 });
      const period = cloudShadowPeriod(VIEW, setting.scale);
      const phases = new Set(cloudShadowAnchors(setting, 1000, period, 7).map((anchor) => positionKey(anchor.x, anchor.y)));
      const blobs = cloudShadowBlobs(setting, 1000, VIEW, 7);
      expect(blobs.length).toBeGreaterThan(0);
      for (const blob of blobs) {
        expect(phases.has(positionKey(mod(blob.x, period), mod(blob.y, period)))).toBe(true);
      }
    });

    it("속도 0이면 1초 뒤에도 제자리다", () => {
      const setting = params({ speed: 0 });
      const period = cloudShadowPeriod(VIEW, setting.scale);
      expect(cloudShadowAnchors(setting, 1000, period, 3)).toEqual(cloudShadowAnchors(setting, 0, period, 3));
    });

    it("카메라가 움직여도 그림자는 땅에 붙어 있다 — 월드 위상이 카메라와 무관하다", () => {
      const setting = params({ speed: 24, angleDeg: 28, scale: 1 });
      const span = { x: 0, y: 0, width: 2200, height: 2200 };
      const period = cloudShadowPeriod(span, setting.scale);
      const origin = cloudShadowBlobs(setting, 0, span, 5);
      // 카메라를 정확히 한 주기(가로 1·세로 3) 옮기면 «같은 구름» 이 보여야 한다.
      const shifted = cloudShadowBlobs(setting, 0, { ...span, x: period, y: period * 3 }, 5);
      const unwrap = new Set(shifted.map((blob) => positionKey(blob.x - period, blob.y - period * 3)));
      expect(origin.length).toBeGreaterThan(0);
      expect(shifted.length).toBe(origin.length);
      expect(unwrap).toEqual(new Set(origin.map((blob) => positionKey(blob.x, blob.y))));
    });

    it("크기 배율을 키우면 덩어리가 커진다", () => {
      const small = cloudShadowBlobs(params({ scale: 0.5 }), 0, VIEW, 9);
      const large = cloudShadowBlobs(params({ scale: 2.5 }), 0, VIEW, 9);
      const maxRadius = (blobs: readonly CloudShadowBlob[]): number => Math.max(...blobs.map((blob) => blob.radius));
      expect(maxRadius(large)).toBeGreaterThan(maxRadius(small));
    });

    it("덩어리마다 그릴 실루엣 변주를 들고 다닌다", () => {
      const blobs = cloudShadowBlobs(params(), 0, VIEW, 11);
      expect(blobs.length).toBeGreaterThan(0);
      for (const blob of blobs) {
        expect(Number.isInteger(blob.variant)).toBe(true);
        expect(blob.variant).toBeGreaterThanOrEqual(0);
        expect(blob.variant).toBeLessThan(CLOUD_SHADOW_SILHOUETTE_COUNT);
      }
    });
  });
  describe("덩어리별 속도 변주와 크기 호흡", () => {
    it("같은 순간에 덩어리마다 다른 거리를 간다 — 판 하나로 끌리지 않는다", () => {
      const setting = params({ speed: 60, angleDeg: 0, scale: 1 });
      const period = cloudShadowPeriod(VIEW, setting.scale);
      const start = cloudShadowAnchors(setting, 0, period, 4);
      const later = cloudShadowAnchors(setting, 1000, period, 4);
      const travelled = start.map((anchor, index) => mod(later[index]!.x - anchor.x, period));
      expect(new Set(travelled.map((value) => Math.round(value))).size).toBeGreaterThan(1);
    });

    it("배율의 중앙값은 1 — 설정한 속도가 그대로 지켜진다", () => {
      const setting = params({ speed: 50, angleDeg: 0, scale: 1 });
      const period = cloudShadowPeriod(VIEW, setting.scale);
      const start = cloudShadowAnchors(setting, 0, period, 4);
      const later = cloudShadowAnchors(setting, 1000, period, 4);
      const travelled = start
        .map((anchor, index) => mod(later[index]!.x - anchor.x, period))
        .sort((a, b) => a - b);
      const median = travelled[Math.floor(travelled.length / 2)]!;
      expect(median).toBeGreaterThanOrEqual(50 * CLOUD_SHADOW_SPEED_JITTER.min);
      expect(median).toBeLessThanOrEqual(50 * CLOUD_SHADOW_SPEED_JITTER.max);
      expect(Math.abs(median - 50)).toBeLessThan(50 * 0.05);
    });

    it("호흡은 설정한 폭 안에서만 움직이고 한 주기 뒤 제자리로 돌아온다", () => {
      for (const phase of [0, 0.25, 0.5, 0.9]) {
        for (const elapsed of [0, 3000, 12_345, 60_000]) {
          const value = cloudShadowBreath(phase, elapsed);
          expect(value).toBeGreaterThanOrEqual(1 - CLOUD_SHADOW_BREATH.amount - 1e-3);
          expect(value).toBeLessThanOrEqual(1 + CLOUD_SHADOW_BREATH.amount + 1e-3);
        }
        expect(cloudShadowBreath(phase, CLOUD_SHADOW_BREATH.periodMs * 2)).toBeCloseTo(cloudShadowBreath(phase, 1), 2);
      }
    });

    it("시간이 흘러가면 덩어리 크기가 바뀐다 — 모양이 얼어있지 않다", () => {
      const setting = params({ speed: 0, scale: 1 });
      const start = cloudShadowBlobs(setting, 0, VIEW, 6).map((blob) => blob.radius);
      const later = cloudShadowBlobs(setting, CLOUD_SHADOW_BREATH.periodMs / 4, VIEW, 6).map((blob) => blob.radius);
      expect(start.length).toBe(later.length);
      expect(start.some((radius, index) => Math.abs(radius - later[index]!) > 0.5)).toBe(true);
    });
  });
  describe("cloudShadowSilhouette", () => {
    it("변주마다 로브 여러 개의 합집합이다 — 원 하나가 아니다", () => {
      for (let variant = 0; variant < CLOUD_SHADOW_SILHOUETTE_COUNT; variant += 1) {
        const lobes = cloudShadowSilhouette(variant);
        expect(lobes.length).toBeGreaterThanOrEqual(6);
        const offCenter = lobes.filter((lobe) => Math.hypot(lobe.cx - 0.5, lobe.cy - 0.5) > 0.08);
        expect(offCenter.length).toBeGreaterThanOrEqual(4);
      }
    });

    it("모든 로브가 텍스처 상자 안에 들어간다 — 가장자리가 잘리면 직선이 보인다", () => {
      for (let variant = 0; variant < CLOUD_SHADOW_SILHOUETTE_COUNT; variant += 1) {
        for (const lobe of cloudShadowSilhouette(variant)) {
          expect(lobe.radius).toBeGreaterThan(0);
          expect(lobe.cx - lobe.radius).toBeGreaterThanOrEqual(0);
          expect(lobe.cx + lobe.radius).toBeLessThanOrEqual(1);
          expect(lobe.cy - lobe.radius).toBeGreaterThanOrEqual(0);
          expect(lobe.cy + lobe.radius).toBeLessThanOrEqual(1);
        }
      }
    });

    it("같은 변주는 항상 같고, 다른 변주는 다른 모양이다", () => {
      expect(cloudShadowSilhouette(2)).toEqual(cloudShadowSilhouette(2));
      expect(cloudShadowSilhouette(0)).not.toEqual(cloudShadowSilhouette(1));
    });

    it("코어가 평평한 구간이 있다 — 가장자리가 전부 반그림자면 경계가 안 읽힌다", () => {
      expect(CLOUD_SHADOW_LOBE_CORE_FRACTION).toBeGreaterThan(0.4);
      expect(CLOUD_SHADOW_LOBE_CORE_FRACTION).toBeLessThan(0.9);
    });
  });
});

describe("containerOpenState", () => {
  isolateTimers();
  const SIZE = 16;
  const W = SIZE * 3, H = SIZE * 2;
  /** 가운데 열 아래 칸에 12×10 불투명 물건(위 줄 밝고 아래 줄 어두운 나무)을 그린 캔버스. */
  function objectCanvas(): Uint8ClampedArray {
    const src = new Uint8ClampedArray(W * H * 4);
    for (let y = SIZE + 5; y < SIZE + 15; y++) for (let x = SIZE + 2; x < SIZE + 14; x++) {
      const i = (y * W + x) * 4;
      const light = y < SIZE + 8;
      src[i] = light ? 200 : 140; src[i + 1] = light ? 140 : 90; src[i + 2] = light ? 80 : 50; src[i + 3] = 255;
    }
    return src;
  }
  function changed(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) + Math.abs(a[i + 3]! - b[i + 3]!) > 60) n++;
    }
    return n;
  }
  describe("수납 열린 모습 — 물건 그림 자체가 바뀐다(오너: 최소 3픽셀)", () => {
    it("옷장은 합성하지 않고 예전 문짝 덧그림·흔적을 쓴다(블라인드 판정 3회 NO)", () => {
      expect(openStatePixels(objectCanvas(), W, H, SIZE, "wardrobe", 1)).toBeNull();
    });

    it.each(CONTAINER_STYLES.filter((style) => style !== "wardrobe"))("%s: 다 열린 모습은 물건 화소가 6개 이상 바뀐다", (style) => {
      const src = objectCanvas();
      const out = openStatePixels(src, W, H, SIZE, style, 1);
      expect(out).not.toBeNull();
      expect(changed(src, out!)).toBeGreaterThanOrEqual(6);
    });

    it("물건 화소가 없는 칸은 열린 모습을 만들지 않는다(예전 흔적 그림으로 대체)", () => {
      expect(openStatePixels(new Uint8ClampedArray(W * H * 4), W, H, SIZE, "crate", 1)).toBeNull();
    });
  });
});

describe("debugTeleportUsesTransfer", () => {
  isolateTimers();
  // 도그푸딩 2026-09-23: __oprnDebug.teleport 로 다른 맵에 가면 화면이 검게 남고 행동이 안 먹었다.
  // 세션만 쓰고 loadMap 만 불러 주인공 스프라이트·카메라가 옛 맵 좌표에 남았기 때문이다.
  // 이제 다른 맵 순간이동은 실제 문과 같은 transferTo 경로를 탄다.
  type HookWindow = Window & { __oprnDebug?: RuntimeDebugHook };
  const previousWindow = globalThis.window;
  afterEach(() => {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  });
  function install() {
    const testWindow = { location: { search: "" } } as HookWindow;
    Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
    const session = { currentMapId: "map_town", x: 1, y: 1, switches: {}, variables: {}, inventory: {}, gold: 0, flags: {}, timers: {} };
    const transferTo = vi.fn((request: { mapId: string; x: number; y: number }) => {
      session.currentMapId = request.mapId;
      session.x = request.x;
      session.y = request.y;
      return Promise.resolve();
    });
    const loadMap = vi.fn();
    const scene = { events: { once: vi.fn() }, getMapId: () => session.currentMapId, transferTo, loadMap, tileX: 1, tileY: 1 };
    const sync = vi.fn();
    installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => session as never, sync);
    return { debug: testWindow.__oprnDebug!, session, scene, transferTo, loadMap, sync };
  }
  describe("__oprnDebug.teleport", () => {
    it("routes a cross-map teleport through the real transfer path without a fade", () => {
      const { debug, session, transferTo, loadMap, sync } = install();
      debug.teleport("map_cave", 4, 7);
      expect(transferTo).toHaveBeenCalledTimes(1);
      expect(transferTo).toHaveBeenCalledWith({ mapId: "map_cave", x: 4, y: 7, fade: "none", direction: "retain" });
      // 화면 쪽 갱신(loadMap·스프라이트·카메라)은 transferTo 몫 — 훅이 따로 loadMap 을 부르지 않는다.
      expect(loadMap).not.toHaveBeenCalled();
      expect(session.currentMapId).toBe("map_cave");
      expect(sync).toHaveBeenCalled();
    });

    it("moves the player sprite and recenters the camera on a same-map teleport without reloading", () => {
      const testWindow = { location: { search: "" } } as HookWindow;
      Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: testWindow });
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      const session = startSession(project);
      const positions: Array<[number, number]> = [];
      const scene = {
        events: { once: vi.fn() },
        getMapId: () => session.currentMapId,
        map,
        session,
        transferTo: vi.fn(),
        loadMap: vi.fn(),
        tileX: session.x,
        tileY: session.y,
        moving: true,
        player: { setPosition: (x: number, y: number) => positions.push([x, y]), setDepth: vi.fn(), y: 0 },
        followerSprites: new Map(),
        centerCamera: vi.fn(),
      };
      installPlaySceneTestHooks(scene as never, { injectActionEdge: vi.fn() } as never, () => session as never, vi.fn());
      testWindow.__oprnDebug!.teleport(map.id, 3, 2);
      expect(scene.transferTo).not.toHaveBeenCalled();
      expect(scene.loadMap).not.toHaveBeenCalled();
      expect([scene.tileX, scene.tileY, session.x, session.y]).toEqual([3, 2, 3, 2]);
      expect(positions).toHaveLength(1);
      expect(scene.centerCamera).toHaveBeenCalledTimes(1);
      expect(scene.moving).toBe(false);
    });

    it("keeps same-map teleport as an in-place move", () => {
      const { debug, session, scene, transferTo } = install();
      debug.teleport("map_town", 5, 6);
      expect(transferTo).not.toHaveBeenCalled();
      expect([session.x, session.y, scene.tileX, scene.tileY]).toEqual([5, 6, 5, 6]);
    });
  });
});

describe("dialoguePageOverflowWidth", () => {
  isolateTimers();
  // jrpg-real-1 J07: 상수로 계산한 본문 폭(282)이 실제 안쪽 폭(280)보다 넓어, 280px 에서 40자 줄이 DOM 에서 한 번 더 접혔다.
  // 해법은 dialogue.ts 가 실제 폭(좁은 쪽)으로 다시 나누는 것이다 — 여기서는 폭이 줄면 줄 수가 늘어 페이지가 갈라지는 계약만 고정한다.
  describe("dialogue pagination width contract (J07)", () => {
    const line = "왕 에드가르. 제국의 마도 병기에 맞설 신형 오토클레이브 기갑검의 시험을 겸해 동행하겠소.";
    const measure = (text: string): number => Array.from(text).reduce((sum, char) => sum + (char === " " ? 3 : 7), 0);

    it("a narrower body width never yields more lines per page than maxLines", () => {
      for (const maxWidth of [282, 280, 276, 272]) {
        const pages = paginateDialogueSegments([{ text: line, colorIndex: 0 }], { maxWidth, measure, maxLines: 3 });
        for (const page of pages) expect(page.lines.length).toBeLessThanOrEqual(3);
      }
    });

    it("narrowing the width can only add lines", () => {
      const count = (maxWidth: number): number => paginateDialogueSegments([{ text: line, colorIndex: 0 }], { maxWidth, measure, maxLines: 3 }).reduce((n, page) => n + page.lines.length, 0);
      expect(count(240)).toBeGreaterThanOrEqual(count(282));
    });
  });
});

describe("dialoguePagination", () => {
  isolateTimers();
  const measureChars = (text: string): number => Array.from(text).length;
  function plainPageText(page: DialoguePage): string {
    return page.segments.map((segment) => segment.text).join("");
  }
  function plainLineTexts(page: DialoguePage): string[] {
    return page.lines.map((line) => line.segments.map((segment) => segment.text).join(""));
  }
  describe("dialogue pagination", () => {
    it("respects literal newlines without confusing actor-name text codes", () => {
      const project = createBlankProject();
      project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
      const segments = parseDialogueText("첫 줄\n둘째 줄 \\n[1]", {
        session: { variables: {}, actorNames: { hero: "Renamed" } },
        project,
      });

      const pages = paginateDialogueSegments(segments, { maxWidth: 100, measure: measureChars });

      expect(pages).toHaveLength(1);
      expect(plainLineTexts(pages[0]!)).toEqual(["첫 줄", "둘째 줄 Renamed"]);
      expect(plainPageText(pages[0]!)).toBe("첫 줄\n둘째 줄 Renamed");
    });

    it("preserves non-printing controls as zero-width playback events", () => {
      const source = String.raw`A\s[3]\c[2]B\$\!\.\|\>\<\^\_C`;
      const segments = parseDialogueText(source);
      const pages = paginateDialogueSegments(segments, { maxWidth: 2, maxLines: 1, measure: measureChars });
      const pageSegments = pages.flatMap((page) => page.segments);

      expect(segments.map((segment) => segment.text).join("")).toBe("AB C");
      expect(segments.map((segment) => segment.text).join("")).not.toContain("\\");
      expect(pageSegments.flatMap((segment) => segment.controlsBefore ?? [])).toEqual([
        { kind: "speed", value: 3 },
        { kind: "gold" },
        { kind: "pause" },
        { kind: "wait", ms: 250 },
        { kind: "wait", ms: 1000 },
        { kind: "fastOn" },
        { kind: "fastOff" },
        { kind: "autoClose" },
        { kind: "halfSpace" },
      ]);
      expect(plainPageText(pages[0]!)).toBe("AB");
      expect(plainPageText(pages[1]!)).toBe("C");
    });

    it("fills four wrapped body lines before starting the next page", () => {
      const pages = paginateDialogueSegments([
        { text: "가나다라마바사아자차카타파하거너", colorIndex: 0 },
      ], { maxWidth: 4, measure: measureChars });

      expect(pages).toHaveLength(1);
      expect(plainLineTexts(pages[0]!)).toEqual(["가나다라", "마바사아", "자차카타", "파하거너"]);
    });

    it("prefers English word boundaries when wrapping", () => {
      const pages = paginateDialogueSegments([
        { text: "hello world next", colorIndex: 0 },
      ], { maxWidth: 11, measure: measureChars });

      expect(plainLineTexts(pages[0]!)).toEqual(["hello world", "next"]);
    });

    it("splits text beyond four wrapped lines into following pages", () => {
      const pages = paginateDialogueSegments([
        { text: "가나다라마바사아자차카타파하거너더", colorIndex: 0 },
      ], { maxWidth: 4, measure: measureChars });

      expect(pages).toHaveLength(2);
      expect(plainLineTexts(pages[0]!)).toEqual(["가나다라", "마바사아", "자차카타", "파하거너"]);
      expect(plainLineTexts(pages[1]!)).toEqual(["더"]);
    });

    it("preserves color-code segment boundaries across automatic wraps", () => {
      const pages = paginateDialogueSegments(
        parseDialogueText("A\\c[2]BC\\c[0]D"),
        { maxWidth: 2, measure: measureChars }
      );

      expect(pages).toHaveLength(1);
      expect(pages[0]?.lines[0]?.segments).toEqual([
        { text: "A", colorIndex: 0 },
        { text: "B", colorIndex: 2 },
      ]);
      expect(pages[0]?.lines[1]?.segments).toEqual([
        { text: "C", colorIndex: 2 },
        { text: "D", colorIndex: 0 },
      ]);
    });

    it("counts author-authored empty lines as body lines", () => {
      const pages = paginateDialogueSegments([
        { text: "A\n\nB", colorIndex: 0 },
      ], { maxWidth: 100, measure: measureChars });

      expect(plainLineTexts(pages[0]!)).toEqual(["A", "", "B"]);
      expect(plainPageText(pages[0]!)).toBe("A\n\nB");
    });

    it("does not turn a consumed trailing wrap space into an authored empty line", () => {
      const pages = paginateDialogueSegments([
        { text: "abcd ", colorIndex: 0 },
      ], { maxWidth: 4, measure: measureChars });

      expect(plainLineTexts(pages[0]!)).toEqual(["abcd"]);
    });

    it("keeps closing punctuation with the last character instead of a line of its own", () => {
      const pages = paginateDialogueSegments([
        { text: "가나다라.", colorIndex: 0 },
      ], { maxWidth: 4, measure: measureChars });

      expect(plainLineTexts(pages[0]!)).toEqual(["가나다", "라."]);
    });

    it("keeps a run of periods and an exclamation with the preceding character", () => {
      const period = paginateDialogueSegments([
        { text: "가나다...", colorIndex: 0 },
      ], { maxWidth: 4, measure: measureChars });
      const bang = paginateDialogueSegments([
        { text: "가나다라!", colorIndex: 0 },
      ], { maxWidth: 4, measure: measureChars });

      expect(plainLineTexts(period[0]!)).toEqual(["가나", "다..."]);
      expect(plainLineTexts(bang[0]!)).toEqual(["가나다", "라!"]);
    });

    it("does not end a wrapped line on an opening quote", () => {
      const pages = paginateDialogueSegments([
        { text: "가나「다라", colorIndex: 0 },
      ], { maxWidth: 3, measure: measureChars });

      expect(plainLineTexts(pages[0]!)).toEqual(["가나", "「다라"]);
    });

    it("still wraps spaced text at the space when the next word keeps its period", () => {
      const pages = paginateDialogueSegments([
        { text: "hello world.", colorIndex: 0 },
      ], { maxWidth: 11, measure: measureChars });

      expect(plainLineTexts(pages[0]!)).toEqual(["hello", "world."]);
    });

    it("falls back to character measurement when the injected measure fails", () => {
      const pages = paginateDialogueSegments([
        { text: "abcdef", colorIndex: 0 },
      ], {
        maxWidth: 3,
        measure: () => {
          throw new Error("no layout");
        },
        fallbackCharWidth: 1,
      });

      expect(plainLineTexts(pages[0]!)).toEqual(["abc", "def"]);
    });
  });
});

describe("dialoguePresentation", () => {
  isolateTimers();
  describe("normalizeDialogueEmotion", () => {
    it("빈 값과 모르는 값을 neutral 로 떨어뜨린다", () => {
      expect(normalizeDialogueEmotion(undefined)).toBe("neutral");
      expect(normalizeDialogueEmotion("")).toBe("neutral");
      expect(normalizeDialogueEmotion("   ")).toBe("neutral");
      // 저장된 프로젝트나 AI 가 만든 값이 표에 없는 문자열일 수 있다.
      expect(normalizeDialogueEmotion("furious")).toBe("neutral");
    });

    it("앞뒤 공백은 털고 표에 있는 값은 그대로 쓴다", () => {
      expect(normalizeDialogueEmotion("  happy ")).toBe("happy");
      for (const emotion of DIALOGUE_EMOTIONS) {
        expect(normalizeDialogueEmotion(emotion)).toBe(emotion);
      }
    });
  });
  describe("dialoguePresentationProfile", () => {
    it("감정 5종 전부에 프로파일이 있다", () => {
      for (const emotion of DIALOGUE_EMOTIONS) {
        const profile = dialoguePresentationProfile(emotion);
        expect(profile.emotion).toBe(emotion);
        expect(profile.motion).toBe(true);
        expect(profile.enterMs).toBeGreaterThan(0);
        expect(profile.exitMs).toBeGreaterThan(0);
      }
    });

    it("감정마다 읽히는 성격이 다르다", () => {
      // 슬픔은 느리게 읽히고 분노·놀람은 빠르게 읽힌다.
      expect(dialoguePresentationProfile("sad").charDelayScale).toBeGreaterThan(1);
      expect(dialoguePresentationProfile("angry").charDelayScale).toBeLessThan(1);
      expect(dialoguePresentationProfile("surprised").charDelayScale).toBeLessThan(1);
      expect(dialoguePresentationProfile("neutral").charDelayScale).toBe(1);

      // 흔들림은 분노만, 플래시는 놀람만.
      expect(dialoguePresentationProfile("angry").shake).toBe(true);
      expect(dialoguePresentationProfile("surprised").flash).toBe(true);
      for (const emotion of ["neutral", "happy", "sad"] as const) {
        expect(dialoguePresentationProfile(emotion).shake).toBe(false);
        expect(dialoguePresentationProfile(emotion).flash).toBe(false);
      }
    });

    it("reducedMotion 은 움직임만 끄고 의미 신호는 남긴다", () => {
      for (const emotion of DIALOGUE_EMOTIONS) {
        const full = dialoguePresentationProfile(emotion);
        const reduced = dialoguePresentationProfile(emotion, { reducedMotion: true });

        expect(reduced.motion).toBe(false);
        expect(reduced.shake).toBe(false);
        expect(reduced.flash).toBe(false);
        expect(reduced.charReveal).toBe(false);
        expect(reduced.nameplateDelayMs).toBe(0);

        // 스크림과 읽는 속도는 움직임이 아니라 분위기·가독성 신호라 유지한다.
        expect(reduced.scrimOpacity).toBe(full.scrimOpacity);
        expect(reduced.charDelayScale).toBe(full.charDelayScale);

        // 0 으로 만들면 창이 툭 나타나 오히려 거칠다 — 짧은 페이드는 남긴다.
        expect(reduced.enterMs).toBeGreaterThan(0);
        expect(reduced.enterMs).toBeLessThan(full.enterMs);
      }
    });
  });
  describe("dialoguePresentationCssVars", () => {
    it("프로파일의 모든 지속시간이 CSS 변수로 빠짐없이 나간다", () => {
      // battleTransition 은 지속시간을 TS 와 CSS 양쪽에 손으로 적어 두었다가
      // close 가 260 vs 190 으로 어긋났다. 이 검사가 같은 드리프트를 막는다.
      for (const emotion of DIALOGUE_EMOTIONS) {
        for (const reducedMotion of [false, true]) {
          const profile = dialoguePresentationProfile(emotion, { reducedMotion });
          const vars = dialoguePresentationCssVars(profile);
          const emitted = Object.values(vars);
          for (const ms of [
            profile.enterMs,
            profile.exitMs,
            profile.nameplateDelayMs,
            profile.portraitMs,
            profile.scrimMs,
          ]) {
            expect(emitted).toContain(`${ms}ms`);
          }
          expect(vars["--dialogue-scrim-opacity"]).toBe(String(profile.scrimOpacity));
        }
      }
    });

    it("변수 이름은 모두 --dialogue- 로 시작한다", () => {
      const vars = dialoguePresentationCssVars(dialoguePresentationProfile("neutral"));
      for (const name of Object.keys(vars)) expect(name.startsWith("--dialogue-")).toBe(true);
    });
  });
  describe("dialogueScaledCharDelayMs", () => {
    it("기본 지연에 프로파일 배율을 적용한다", () => {
      expect(dialogueScaledCharDelayMs(24, dialoguePresentationProfile("neutral"))).toBe(24);
      expect(dialogueScaledCharDelayMs(24, dialoguePresentationProfile("sad"))).toBe(32);
      expect(dialogueScaledCharDelayMs(24, dialoguePresentationProfile("angry"))).toBe(19);
    });

    it("즉시 표시(0)는 0 으로 남기고 그 밖에는 1ms 를 남긴다", () => {
      // \> 즉시 표시는 지연 0 으로 들어온다 — 배율이 이걸 되살리면 안 된다.
      expect(dialogueScaledCharDelayMs(0, dialoguePresentationProfile("sad"))).toBe(0);
      expect(dialogueScaledCharDelayMs(1, dialoguePresentationProfile("angry"))).toBe(1);
    });
  });
  describe("dialogueSpeakerInsetPx", () => {
    it("이름표가 파고든 깊이를 여백으로 돌려준다", () => {
      // 실측 2026-08-30: 높이 19px, top -9px → 아래 변이 10px 지점.
      // 그때 CSS 기본값은 8px 이어서 본문 첫 줄이 2px 덮여 있었다.
      expect(dialogueSpeakerInsetPx(-9, 19, 8)).toBe(10);
    });

    it("기존 여백보다 좁히지 않는다", () => {
      // 이름표가 창 위로 완전히 빠져 있어도(겹침 0) 원래 숨 쉬던 자리는 남긴다 —
      // 좁히면 줄 수가 이유 없이 늘었다 줄었다 한다.
      expect(dialogueSpeakerInsetPx(-24, 19, 8)).toBe(8);
      expect(dialogueSpeakerInsetPx(-19, 19, 8)).toBe(8);
    });

    it("소수 높이는 위로 올린다", () => {
      // 내림하면 1px 이 남아 다시 덮인다.
      expect(dialogueSpeakerInsetPx(-9, 19.4, 8)).toBe(11);
    });

    it("글꼴이 커지면 따라 내려간다", () => {
      expect(dialogueSpeakerInsetPx(-9, 34, 8)).toBe(25);
    });

    it("레이아웃이 없으면 CSS 기본값을 쓰라고 undefined 를 준다", () => {
      // jsdom 은 offsetHeight 가 0 이다. 여기서 0 을 심으면 이름표가 본문을 통째로 덮는다.
      expect(dialogueSpeakerInsetPx(-9, 0, 8)).toBeUndefined();
      expect(dialogueSpeakerInsetPx(Number.NaN, 19, 8)).toBeUndefined();
    });
  });
});

// 도주 유예(@/player/chaseSpawnGrace): 전투에서 도망친 직후에는 추격자가 서 있고 이벤트 쪽 접촉 전투가 열리지 않는다.
// 2026-11-14 폴른 스타 QA — 숲 어귀에서 도망치자 0.8초 뒤 한 걸음도 떼지 않았는데 곁의 다른 무리가 새 전투를 열었다.
describe("escapeGrace", () => {
  isolateTimers();
  const getCurrent = store.getCurrent;
  afterEach(() => { store.getCurrent = getCurrent; });
  const here = { mapId: "m", x: 5, y: 2 };
  describe("도주 유예 시간 규칙", () => {
    it("도망친 칸에 서 있는 동안에는 유예가 이어지고, 상한이 지나면 끝난다", () => {
      const session = {};
      startEscapeGrace(session, here);
      let spent = 0;
      while (spent + 500 < ESCAPE_GRACE_CAP_MS) {
        spent += 500;
        expect(tickEscapeGrace(session, 500, here)).toBe(true);
      }
      expect(escapeGraceActive(session, "m")).toBe(true);
      expect(tickEscapeGrace(session, 600, here)).toBe(false);
      expect(escapeGraceActive(session, "m")).toBe(false);
    });

    it("걸음을 뗀 뒤에는 남은 시간만큼만 이어진다 — 곧바로 뗐으면 처음 준 시간, 오래 서 있다 뗐으면 최소 보장 시간", () => {
      const quick = {};
      startEscapeGrace(quick, here);
      const away = { mapId: "m", x: 5, y: 4 };
      expect(tickEscapeGrace(quick, ESCAPE_GRACE_MS - 100, away)).toBe(true);
      expect(tickEscapeGrace(quick, 200, away)).toBe(false);

      const slow = {};
      startEscapeGrace(slow, here);
      expect(tickEscapeGrace(slow, ESCAPE_GRACE_MS + 1000, here)).toBe(true);
      expect(tickEscapeGrace(slow, ESCAPE_GRACE_AFTER_MOVE_MS - 100, away)).toBe(true);
      expect(tickEscapeGrace(slow, 200, away)).toBe(false);
    });

    it("대사·전투 중(0ms)에는 줄지 않고, 다른 맵으로 나가면 끝난다", () => {
      const session = {};
      startEscapeGrace(session, here);
      for (let i = 0; i < 1000; i++) expect(tickEscapeGrace(session, 0, { mapId: "m", x: 9, y: 9 })).toBe(true);
      expect(escapeGraceActive(session, "other")).toBe(false);
      expect(tickEscapeGrace(session, 16, { mapId: "other", x: 5, y: 2 })).toBe(false);
      expect(escapeGraceActive(session, "m")).toBe(false);
    });

    it("도망치지 않았으면 유예가 없다", () => {
      const session = {};
      expect(tickEscapeGrace(session, 16, here)).toBe(false);
      expect(escapeGraceActive(session, "m")).toBe(false);
    });
  });
  describe("도주 유예 중 추격자", () => {
    it("유예가 없으면 추격자가 다가와 접촉 이벤트를 연다(기준)", () => {
      const f = fixture(7, 5, [event("a", 1, 2)], 5, 2);
      ticks(f.scene);
      expect(f.scene.touches).toBeGreaterThan(0);
    });

    it("도망친 직후에는 추격자가 제자리에 서고 접촉 이벤트가 열리지 않는다 — 주인공이 서 있기만 해도", () => {
      const f = fixture(7, 5, [event("a", 1, 2)], 5, 2);
      startEscapeGrace(f.scene.session, here);
      // 80ms × 60 = 4.8초: 처음 준 시간(2.5초)을 넘겨도 서 있는 동안은 이어진다.
      ticks(f.scene, 60);
      expect(pos(f.scene)).toMatchObject({ x: 1, y: 2 });
      expect(f.scene.touches).toBe(0);
    });

    it("바로 곁에 붙어 선 추격자도 유예 중에는 접촉 이벤트를 열지 않고, 유예가 끝나면 다시 연다", () => {
      const f = fixture(7, 5, [event("a", 4, 2)], 5, 2);
      startEscapeGrace(f.scene.session, here);
      ticks(f.scene, 60);
      expect(f.scene.touches).toBe(0);
      // 상한(8초)을 넘기면 저작한 대로 돌아간다.
      ticks(f.scene, 80);
      expect(f.scene.touches).toBeGreaterThan(0);
    });

    it("걸어서 벗어난 뒤 유예가 끝나면 추격자가 다시 쫓아와 닿는다", () => {
      const f = fixture(7, 5, [event("a", 1, 2)], 5, 2);
      startEscapeGrace(f.scene.session, here);
      ticks(f.scene, 10);
      f.scene.tileX = 6; f.scene.session.x = 6;
      // 걸음을 뗀 뒤 남은 유예(2.5초 − 0.8초 = 1.7초) 안에서는 아직 서 있다.
      ticks(f.scene, 15);
      expect(pos(f.scene)).toMatchObject({ x: 1, y: 2 });
      expect(f.scene.touches).toBe(0);
      ticks(f.scene, 120);
      expect(f.scene.touches).toBeGreaterThan(0);
    });
  });
});

describe("eventLayerReuse", () => {
  isolateTimers();
  let restore: () => void;
  let previous: ReturnType<typeof store.getCurrent>;
  beforeEach(() => { previous = store.getCurrent(); restore = installFakeDom({ animationFrames: 'manual' }); });
  afterEach(() => { store.replaceProject(previous); restore(); });
  function fixture(count = 1) {
    const base = renderSceneWith({ graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_people1' } } });
    const template = base.map.events[0];
    template.pages![0].movement = { type: 'living', speed: 3, frequency: 3, living: { destinations: [{ mapId: base.map.id, x: 20, y: 20 }], repeat: true } };
    base.map.events = Array.from({ length: count }, (_, i) => ({ ...structuredClone(template), id: `npc${i}`, x: i % 25, y: Math.floor(i / 25) }));
    const counts = { created: 0, destroyed: 0 };
    const scene = Object.assign(base, {
      autonomousNPCs: new Map<string, AutonomousMover>(),
      eventGraphicPatternOverrides: new Map<string, number>(),
      characterShadows: new Map(),
      tweens: { getTweens: () => [] as { targets: object[] }[] },
    });
    scene.add.sprite = (x, y, texture, frame) => {
      counts.created++;
      const sprite = Object.assign(mockSprite(x, y, texture), {
        active: true, visible: true, width: 24, height: 32, scaleX: 1, scaleY: 1,
        originX: 0.5, originY: 1, displayHeight: 32,
        setOrigin(x: number, y: number) { this.origin = [x, y]; this.originX = x; this.originY = y; },
        setScrollFactor() {},
        blendMode: 0, isTinted: false, flipX: false, flipY: false, rotation: 0,
        setScale(value: number) { this.scaleX = this.scaleY = value; },
        destroy() { this.active = false; counts.destroyed++; },
      });
      sprite.setFrame(frame ?? 0);
      return sprite;
    };
    return { scene, counts };
  }
  function state(scene: ReturnType<typeof fixture>['scene']) {
    return [...scene.eventSprites].map(([id, s]) => ({ id, x: s.x, y: s.y, texture: s.texture.key,
      frame: s.frame, depth: s.depth, visible: (s as typeof s & { visible: boolean }).visible, alpha: s.alpha, origin: s.origin,
      scaleX: (s as typeof s & { scaleX: number }).scaleX, scaleY: (s as typeof s & { scaleY: number }).scaleY }));
  }
  function equivalent(scene: ReturnType<typeof fixture>['scene']) {
    const expected = { ...scene, eventSprites: new Map(), characterShadows: new Map(), missingResources: new Set<string>() };
    legacyRenderEvents(expected);
    expect(state(scene)).toEqual(state(expected));
    expect(scene.missingResources).toEqual(expected.missingResources);
  }
  describe('event layer reuse', () => {
    it('retains 500 NPC objects across renderTiles surface refreshes', () => {
      const { scene, counts } = fixture(500);
      renderTiles(scene);
      const old = new Map(scene.eventSprites);
      const created = counts.created;
      renderTiles(scene);
      expect(counts.created).toBe(created);
      expect(counts.destroyed).toBe(0);
      for (const [id, sprite] of old) expect(scene.eventSprites.get(id)).toBe(sprite);
      equivalent(scene);
    });
    it('updates fractional movement, direction and frames without replacing sprites', () => {
      const { scene } = fixture();
      renderEventLayer(scene);
      const old = scene.eventSprites.get('npc0');
      scene.eventPositions.npc0 = { x: 4, y: 3, direction: 'left' };
      scene.autonomousNPCs.set('npc0', { moveDurationMs: 400,
        activeMove: { fromX: 3, fromY: 2, toX: 4, toY: 3, elapsedMs: 75, durationMs: 300 } } as AutonomousMover);
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).toBe(old);
      expect(old).toMatchObject({ x: characterSpriteX(3.25), y: characterSpriteY(2.25) });
      equivalent(scene);
    });
    it('replaces only changed graphics, keeps pattern overrides, and removes absent graphics', () => {
      const { scene } = fixture(3);
      renderEventLayer(scene);
      const old = new Map(scene.eventSprites);
      scene.eventGraphicPatternOverrides.set('npc0', 7);
      scene.map.events[1].pages![0].graphic.scale = 2;
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).not.toBe(old.get('npc0'));
      expect(scene.eventSprites.get('npc1')).not.toBe(old.get('npc1'));
      expect(scene.eventSprites.get('npc2')).toBe(old.get('npc2'));
      expect(scene.eventSprites.get('npc0')?.frame).toBe(7);
      equivalent(scene);
      const current = scene.eventSprites.get('npc0');
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).toBe(current);
      scene.map.events[0].pages![0].graphic.sprite = undefined;
      scene.session.erasedEventIds = ['npc1'];
      renderEventLayer(scene);
      expect([...scene.eventSprites.keys()]).toEqual(['npc2']);
      equivalent(scene);
    });
    it.each(['alpha', 'visible', 'blendMode', 'isTinted', 'flipX', 'rotation', 'tween', 'chain'])(
      'keeps old fresh-object semantics for transient %s and captured callbacks', key => {
        const { scene } = fixture(); renderEventLayer(scene);
        const old = scene.eventSprites.get('npc0')!;
        if (key === 'chain') scene.tweens.getTweens = () => [{ data: [{ targets: [old] }] }, { targets: null, data: null }] as never;
        else if (key === 'tween') scene.tweens.getTweens = () => [{ targets: [old] }];
        else Object.assign(old, { [key]: key === 'visible' ? false : key === 'alpha' ? 0.2 : 1 });
        renderEventLayer(scene);
        expect(scene.eventSprites.get('npc0')).not.toBe(old);
        equivalent(scene);
      });
    it('reuses shadows, hides them at the old refresh boundary, and cleans erased owners', () => {
      const { scene } = fixture(2); renderEventLayer(scene);
      const shadow = { visible: true, destroyed: false,
        setVisible(value: boolean) { this.visible = value; }, destroy() { this.destroyed = true; } };
      scene.characterShadows.set('npc0', shadow);
      renderEventLayer(scene);
      expect(scene.characterShadows.get('npc0')).toBe(shadow);
      expect(shadow).toMatchObject({ visible: false, destroyed: false });
      scene.eventSprites.get('npc0')!.destroy();
      scene.eventSprites.delete('npc0'); // erase command owns the sprite, refresh owns stale shadows
      scene.session.erasedEventIds = ['npc0'];
      renderEventLayer(scene);
      expect(shadow.destroyed).toBe(true);
      expect(scene.characterShadows.has('npc0')).toBe(false);
    });
    it('matches the frozen legacy path across in-place graphic and footprint edits', () => {
      const { scene } = fixture(20); renderEventLayer(scene);
      for (let step = 0; step < 40; step++) {
        const event = scene.map.events[step % 20];
        const graphic = event.pages![0].graphic;
        event.pages![0].footprint = { width: step % 3 + 1, height: 2 };
        scene.map.tileSize = step % 2 ? 32 : 16;
        graphic.scaleMode = step % 2 ? 'auto' : 'manual';
        graphic.pattern = step % 12;
        graphic.scale = 0.5 + step % 3;
        event.pages![0].priority = ['same', 'above', 'below'][step % 3] as 'same';
        scene.eventPositions[event.id] = { x: step / 3, y: step / 7, direction: ['up', 'left', 'down', 'right'][step % 4] as 'up' };
        renderEventLayer(scene); equivalent(scene);
      }
    });
    it('keeps furniture push coordinates and a previously opened dialogue anchor live', () => {
      const { scene } = fixture();
      Object.assign(scene, { cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1 } } });
      renderEventLayer(scene);
      const original = scene.eventSprites.get('npc0');
      const hooks = dialogueSceneHooks(scene as unknown as PlaySceneContext, { currentEventId: 'npc0' });
      const view = runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)[0];
      beginFurniturePush(scene as unknown as PlaySceneContext, view, 1, 0);
      scene.eventPositions.npc0 = { x: 9, y: 9, direction: 'up' };
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).toBe(original);
      expect(hooks.anchor()?.x).toBe(characterSpriteX(view.x));
      // The push pool is keyed by scene identity, so a spread oracle scene would miss it.
      const actual = state(scene);
      legacyRenderEvents(scene);
      expect(state(scene)).toEqual(actual);
    });
    it('preserves equal-depth order against other root objects after an event is replaced', () => {
      const { scene } = fixture(3);
      const children = { list: [] as unknown[], queueDepthSort() {} };
      Object.assign(scene, { children });
      const add = scene.add.sprite;
      scene.add.sprite = (...args) => {
        const sprite = add(...args);
        children.list.push(sprite);
        const destroy = sprite.destroy;
        sprite.destroy = () => { destroy.call(sprite); children.list.splice(children.list.indexOf(sprite), 1); };
        return sprite;
      };
      renderEventLayer(scene);
      const decoration = {};
      children.list.push(decoration);
      scene.map.events.reverse();
      scene.map.events[1].pages![0].graphic.pattern = 4;
      renderEventLayer(scene);
      expect(children.list).toEqual([decoration, ...scene.eventSprites.values()]);
      expect([...scene.eventSprites.keys()]).toEqual(['npc2', 'npc1', 'npc0']);
    });
    it('invalidates texture resolution, static art fitting, and transparent pages', () => {
      const { scene } = fixture(2);
      renderEventLayer(scene);
      const graphic = scene.map.events[0].pages![0].graphic;
      const previous = scene.eventSprites.get('npc0');
      graphic.sprite = { type: 'bundled', id: 'unknown_resource' };
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).not.toBe(previous);
      expect(scene.missingResources.has('unknown_resource')).toBe(true);
      equivalent(scene);
      store.getCurrent().assets.uploaded.unknown_resource = { kind: 'monster' } as never;
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')?.frame).toBe('__BASE');
      expect(scene.missingResources.size).toBe(0);
      equivalent(scene);
      graphic.transparent = true;
      renderEventLayer(scene);
      equivalent(scene);
    });

    it('keeps emote objects through refresh and removes them when their host disappears', () => {
      const { scene, counts } = fixture();
      Object.assign(scene, { textures: { exists: () => true }, time: { delayedCall: () => ({ remove() {} }) } });
      Object.assign(scene.tweens, { add() {}, killTweensOf() {} });
      const host = scene as unknown as PlaySceneContext;
      renderEventLayer(scene);
      showSceneEmote(host, 'npc0', 'heart');
      const created = counts.created;
      scene.eventPositions.npc0 = { x: 6, y: 8, direction: 'down' };
      renderEventLayer(scene);
      syncSceneEmotes(host);
      expect(counts.created).toBe(created);
      expect(describeSceneEmotes(host)[0]).toMatchObject({ x: characterSpriteX(6), y: characterSpriteY(8) - 36 });
      scene.session.erasedEventIds = ['npc0'];
      renderEventLayer(scene);
      syncSceneEmotes(host);
      expect(describeSceneEmotes(host)).toEqual([]);
    });
    it('replaces sprites when a texture manager replaces a resource under the same key', () => {
      const { scene } = fixture();
      let texture = {};
      Object.assign(scene, { textures: { get: () => texture } });
      renderEventLayer(scene);
      const old = scene.eventSprites.get('npc0');
      texture = {};
      renderEventLayer(scene);
      expect(scene.eventSprites.get('npc0')).not.toBe(old);
      equivalent(scene);
    });

  });
});
