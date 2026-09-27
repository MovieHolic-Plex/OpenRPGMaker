import { applyBattleDefeat } from "@/player/playSceneDefeat";
import { appendBattleReport } from "@/project/battleReports";
import type { BattleResult, BattleRuntime } from "@/battle/runtime";
import { BattleAdmissionError } from "@/project/battleAdmission";
import { createBattleRuntime } from "@/battle/runtime";
import type { StepResult } from "@/player/interpreter";
import { exitBattleAudio, enterBattleAudio } from "@/player/battleAudio";
import type { BattleAudioSession } from "@/player/battleAudio";
import { stopAudioChannel } from "@/player/audio";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { createSkinBattleTransition, type BattleTransition } from "@/player/battleTransition";
import { computeOnFieldAnchors, hideOnFieldSprites, instantBattleTransition, type OnFieldScene } from "@/player/battleOnField";
import { mapTileSize } from "@/project/tileGeometry";
import { resolveSkinId, getBattleSkin } from "@/battle/skins/registry";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { maybeAutosave } from "@/player/autosave";
import { applyBattleTimerWrites } from "@/player/playSceneTimers";
import { dialogueHost, dialogueUi } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { markBattleEntry } from "@/app/perfMetrics";
import { giveMonster } from "@/project/monsterCollection";
import { nextSessionRandom } from "@/project/session";
import type { MonsterInstance, PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

export type ResolvedMonsterBattleParty = {
  readonly requested: boolean;
  readonly monsterPartyMode: boolean;
  readonly partyMonsters: readonly MonsterInstance[];
};

/** One compatibility gate and one concrete party for every battle bridge consumer. */
export function resolveMonsterBattleParty(project: Project, session: PlaySession): ResolvedMonsterBattleParty {
  const requested = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true;
  const partyMonsters = requested
    ? session.monsterParty.flatMap((instanceId) => {
        const instance = session.monsterInstances[instanceId];
        return instance ? [instance] : [];
      })
    : [];
  return { requested, monsterPartyMode: partyMonsters.length > 0, partyMonsters };
}

export function showBattleScene(scene: PlaySceneContext, troopId: string): void {
  scene.showRuntimeOverlay("battle-scene", troopId || "battle");
}

/**
 * 필드 캔버스의 다음 프레임을 dataURL 로 찍는다. WebGL 은 프레임이 끝나면 버퍼가 비므로(preserveDrawingBuffer 없음)
 * 캔버스를 직접 읽지 않고 Phaser renderer.snapshot 을 쓴다. 실패하거나 250ms 안에 오지 않으면 undefined(트룹 배경으로 폴백).
 */
function captureFieldSnapshot(game: unknown): Promise<string | undefined> {
  const renderer = game && typeof game === "object" ? Reflect.get(game, "renderer") : undefined;
  const snapshot = renderer && typeof renderer === "object" ? Reflect.get(renderer, "snapshot") : undefined;
  if (typeof snapshot !== "function") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), 250);
    try {
      snapshot.call(renderer, (image: unknown) => {
        window.clearTimeout(timer);
        resolve(image instanceof HTMLImageElement && image.src ? image.src : undefined);
      }, "image/jpeg", 0.85);
    } catch {
      window.clearTimeout(timer);
      resolve(undefined);
    }
  });
}

type BattleHostScene = Pick<PlaySceneContext, "session" | "tileY" | "battleAbortController" | "showGameOverScreen">
  & Parameters<typeof dialogueHost>[0]
  & Partial<Pick<PlaySceneContext, "events" | "runtimeTimers">>
  & { readonly map: Pick<PlaySceneContext["map"], "height" | "tileSize"> };

export async function playBattle(
  scene: BattleHostScene,
  step: Extract<StepResult, { kind: "battleProcessing" }>,
  startedAt: number,
  isCurrent: () => boolean = () => true
): Promise<BattleResult | null> {
  const signal = scene.battleAbortController?.signal;
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  const host = dialogueHost(scene);
  if (!host) return Promise.reject(new Error("Battle dialogue host missing"));
  const session = scene.session, map = scene.map;
  let settled = false, shutdown = false;
  const owns = (): boolean => !shutdown && !signal?.aborted && scene.session === session && scene.map === map && isCurrent();
  const current = (): boolean => !settled && owns();
  const project = store.getCurrent();
  // canonical/legacy 선택자를 한 번만 해석하고 같은 파티를 모든 전투 소비자에게 넘긴다.
  const { requested: usePartyMonsters, partyMonsters, monsterPartyMode } = resolveMonsterBattleParty(project, scene.session);
  // Missing starters are an admission failure, never a forced defeat or invented escape.
  if (usePartyMonsters && !monsterPartyMode) {
    throw new BattleAdmissionError("BATTLE_MONSTER_PARTY_EMPTY", "전투를 시작할 수 없습니다. 파티에 몬스터가 없습니다. 스타터를 받거나 보관함에서 몬스터를 파티에 넣은 뒤 다시 시도하세요.");
  }
  const savedAudio: BattleAudioSession = { fieldBgmResourceId: session.audio.bgm?.resourceId };
  let initializedRuntime: BattleRuntime | undefined;
  try {
    // 진입 헬퍼가 돌려주는 **완전한** 필드 트랙(저작 볼륨 포함)을 쓴다. resourceId 만 들고
    // 있으면 복귀 시 exitBattleAudio 의 폴백이 gain 을 안 실어, 저작 volume 0(음소거)·저음량이
    // 전투를 한 번 거치는 사이에 기본 믹서 볼륨으로 돌아온다(2026-09-15 실측).
    Object.assign(savedAudio, enterBattleAudio(project, session));
    const runtime = createBattleRuntime({
      project,
      troopId: step.troopId,
      canEscape: step.canEscape && scene.session.m2Runtime?.access?.escape !== false,
      canLose: step.canLose,
      battleFlow: step.battleFlow,
      formation: step.formation,
      party: {
        levels: scene.session.actorLevels,
        experience: scene.session.actorExperience,
        names: scene.session.actorNames,
        faceResourceIds: scene.session.actorFaceResourceIds,
        vitals: scene.session.actorVitals,
        paramBonuses: scene.session.actorParamBonuses,
        equipment: scene.session.actorEquipment,
        skillIds: scene.session.actorSkillIds,
        skillPp: scene.session.actorSkillPp,
        classOverrides: scene.session.classOverrides,
        growthProgress: scene.session.growthProgress,
        promotionLineage: scene.session.promotionLineage,
        rows: scene.session.actorRows,
        stateIds: scene.session.actorStateIds,
        partyActorIds: scene.session.partyActorIds,
        monsterParty: monsterPartyMode ? partyMonsters : undefined,
        battleCommands: scene.session.actorBattleCommands,
      },
      // battleProcessing 스텝을 만든 맵 이벤트. 트룹 배틀 이벤트의 selfSwitch 소유 이벤트가 된다.
      // 랜덤 인카운터/필드 스폰(playSceneMovement/playSceneFieldSpawns) 스텝에는 없어 undefined 유지.
      ownerEventId: step.ownerEventId,
      sessionState: {
        messageWindowSettings: session.messageWindowSettings,
        switches: scene.session.switches,
        variables: scene.session.variables,
        inventory: scene.session.inventory,
        selfSwitches: scene.session.selfSwitches,
        battleResult: scene.session.battleResult,
        roguelikeRun: scene.session.roguelikeRun,
        itemUseCharges: scene.session.itemUseCharges,
        gold: scene.session.gold,
        monsterInstances: scene.session.monsterInstances,
        monsterParty: scene.session.monsterParty,
        monsterBox: scene.session.monsterBox,
        partyActorIds: scene.session.partyActorIds,
        actorSkillIds: scene.session.actorSkillIds,
        actorExperience: scene.session.actorExperience,
        actorTechPoints: scene.session.actorTechPoints,
        actorLevels: scene.session.actorLevels,
        actorBattleCommands: scene.session.actorBattleCommands,
        // Step 3d: 전투 이벤트 changeEquipment/promoteActor 의 기준 상태(오버레이 시드).
        actorEquipment: scene.session.actorEquipment,
        classOverrides: scene.session.classOverrides,
        growthProgress: scene.session.growthProgress,
        promotionLineage: scene.session.promotionLineage,
        timers: scene.session.timers,
        gameTime: scene.session.gameTime,
        npcActivities: scene.session.npcActivities,
        friendship: scene.session.friendship,
        relationships: scene.session.relationships,
        // insideLocation 조건의 판정 기준 — 전투 개시 시점의 필드 위치.
        currentMapId: scene.session.currentMapId,
        x: scene.session.x,
        y: scene.session.y,
      },
      partyMonsters: monsterPartyMode ? partyMonsters : undefined,
      // Terrain at the player's tile feeds battle backdrop when troop has no preview.
      captureLocation: { mapId: scene.session.currentMapId, x: scene.session.x, y: scene.session.y },
      onMonsterCaptured: (capture) => {
        if (!current()) return;
        giveMonster(project, session, {
          speciesId: capture.speciesId,
          level: capture.level,
          caughtAt: capture.caughtAt,
          ivs: capture.ivs,
          currentHp: capture.currentHp,
          stateIds: capture.stateIds,
          stateTurns: capture.stateTurns,
          skillIds: capture.skillIds,
          skillPp: capture.skillPp,
        });
      },
      rng: () => current() ? nextSessionRandom(session, "battle") : 0.5,
      playAudio: (resourceId, loop) => {
        if (!current()) return;
        playAudioCommand({ resourceId, loop }, project);
        session.audio.bgm = { resourceId, loop };
      },
      stopAudio: () => {
        if (!current()) return;
        stopAudioCommand();
        session.audio.bgm = undefined;
      },
    });
    initializedRuntime = runtime;
    return await new Promise<BattleResult | null>((resolve, reject) => {
      let battleScene: BattleDomController | undefined;
      let exitTransition: BattleTransition | undefined;
      let exiting = false;
      let closingDom = false;
      const entrySkin = getBattleSkin(resolveSkinId(project.system.battleUiStyle));
      // 필드 캔버스: 진입 때 빨려 들어가고 복귀 때 내려앉는다(battleTransition.setFieldMotion).
      const gameCanvas: unknown = Reflect.get(scene.game, "canvas");
      const fieldCanvas = gameCanvas instanceof HTMLElement ? gameCanvas : undefined;
      // 필드 배경(system.battleBackdrop === "field"): 지금 보이는 필드(주인공 주변)를 전투 배경으로 찍고 제자리 페이드로 들어간다.
      // 필드 위 전투(system.battlePresentation === "onField", battleOnField.ts): 전환 없이, 배틀러는 필드 스프라이트
      // 자리에 선다. 앵커를 스프라이트를 숨기기 **전에** 재고, 숨긴 뒤 스냅샷을 찍어 한 캐릭터가 두 번 보이지 않게 한다.
      const onFieldAnchors = project.system.battlePresentation === "onField"
        ? computeOnFieldAnchors(scene as unknown as OnFieldScene, fieldCanvas, step.ownerEventId, mapTileSize(scene.map))
        : undefined;
      const restoreOnFieldSprites = onFieldAnchors ? hideOnFieldSprites(scene as unknown as OnFieldScene, step.ownerEventId) : () => {};
      const fieldBackdrop = project.system.battleBackdrop === "field" || onFieldAnchors !== undefined;
      const fieldSnapshot = fieldBackdrop ? captureFieldSnapshot(scene.game) : Promise.resolve(undefined);
      const newTransition = (): BattleTransition => onFieldAnchors
        ? instantBattleTransition()
        : createSkinBattleTransition(host, entrySkin.transition, undefined, fieldCanvas, fieldBackdrop);
      const entryTransition = newTransition();
      const cleanup = (): void => {
        signal?.removeEventListener("abort", abort);
        scene.events?.off("shutdown", onShutdown);
        scene.events?.off("destroy", onShutdown);
        scene.events?.off("update", checkOwner);
        runtime.cancel();
        entryTransition.destroy();
        exitTransition?.destroy();
        battleScene?.destroy();
        battleScene = undefined;
        restoreOnFieldSprites();
      };
      const onShutdown = (): void => { shutdown = true; abort(); };
      const checkOwner = (): void => { if (!current()) abort(); };
      const abort = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        // A session load/shutdown owns its new audio. Only a live host removal
        // without session cancellation restores this battle's field audio.
        if (owns()) exitBattleAudio(project, session, savedAudio);
        resolve(null);
      };
      const fail = (error: unknown): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      signal?.addEventListener("abort", abort, { once: true });
      scene.events?.once("shutdown", onShutdown);
      scene.events?.once("destroy", onShutdown);
      scene.events?.on("update", checkOwner);
      void fieldSnapshot.then(async (fieldBackdropUrl) => { await entryTransition.cover(); return fieldBackdropUrl; }).then((fieldBackdropUrl) => {
        if (!current()) { abort(); return; }
        battleScene = mountBattleScene({
          host, runtime,
          fieldBackdropUrl,
          onField: onFieldAnchors,
          audioContext: { project, session },
          showEventText: (request, inputSignal) => {
            if (!current()) { abort(); return Promise.reject(new DOMException("Battle cancelled", "AbortError")); }
            const dialogue = dialogueUi(scene);
            if (!dialogue) return Promise.reject(new Error("Battle text input host missing"));
            const eventState = runtime.snapshot().eventState;
            return dialogue.showText({
              ...request, signal: inputSignal, playerTileY: scene.tileY, mapHeight: scene.map.height,
              textContext: { project, session: { variables: eventState.variables, gold: eventState.gold, actorNames: session.actorNames } },
            });
          },
          showEventChoices: (request, inputSignal) => {
            if (!current()) { abort(); return Promise.reject(new DOMException("Battle cancelled", "AbortError")); }
            const dialogue = dialogueUi(scene);
            if (!dialogue) return Promise.reject(new Error("Battle choice input host missing"));
            const eventState = runtime.snapshot().eventState;
            return dialogue.showChoices({
              prompt: request.prompt, options: request.options.map(option => ({ ...option })),
              cancelBehavior: request.cancelBehavior, signal: inputSignal,
              settings: request.settings, playerTileY: scene.tileY, mapHeight: scene.map.height,
              textContext: { project, session: { variables: eventState.variables, gold: eventState.gold, actorNames: session.actorNames } },
            });
          },
          onDestroy: () => { if (!closingDom) abort(); },
          onError: fail,
          onResult: (result, snapshot) => {
            if (!current()) { abort(); return; }
            if (exiting) return;
            exiting = true;
            try {
              const transition = newTransition();
              exitTransition = transition;
              void transition.exit().then(async () => {
                if (!current()) { abort(); return; }
                closingDom = true;
                battleScene?.destroy();
                battleScene = undefined;
                // 패배로 게임이 끝나는 길(canLose=false)은 커버를 걷지 않고 넘긴다. 걷으면 살아 있는
                // 밝은 필드에 파티가 서 있는 장면이 300ms 드러난 뒤 게임오버 상자가 무전환으로 튀었다
                // (2026-09-14 실측). 커버는 게임오버 화면이 그 아래에 마운트된 뒤 스스로 페이드아웃한다 —
                // cleanup 이 오버레이를 즉시 지우지 않도록 소유권을 놓는다.
                const authoredGameOver = result === "defeat" ? snapshot.eventState.gameOverRequest : undefined;
                const terminalDefeat = result === "defeat" && (!snapshot.canLose || !!authoredGameOver);
                if (terminalDefeat) {
                  exitTransition = undefined;
                  void transition.reveal();
                } else {
                  await transition.reveal();
                }
                if (!current()) { abort(); return; }
                // Commit once, after all cancellable presentation has completed.
                if (terminalDefeat) {
                  // 게임 오버가 이어지므로 필드국을 되돌리지 않는다 — 살아 있는 파티가 없는 화면
                  // 아래에서 탐험 BGM 이 다시 돌면 "죽었는데 마을 음악"이 된다. 세션 기록만 필드곡으로
                  // 되돌려 두고 재생은 하지 않는다(재시도·저장 해석이 같은 값을 본다).
                  stopAudioChannel("bgm");
                  session.audio.bgm = savedAudio.fieldBgm ? { ...savedAudio.fieldBgm } : undefined;
                } else {
                  exitBattleAudio(project, session, savedAudio);
                }
                applyBattleRewardsToSession(session,
                  { result, canLose: snapshot.canLose, rewards: snapshot.rewards, actors: [...snapshot.actors, ...snapshot.reserveActors], eventState: snapshot.eventState, participatingActorIds: snapshot.participatingActorIds, monsterPartyMode }, project);
                if (!terminalDefeat && scene.runtimeTimers) {
                  applyBattleTimerWrites({ session, runtimeTimers: scene.runtimeTimers }, snapshot.eventState);
                }
                appendBattleReport(session, project, snapshot, result);
                if (result === "victory") maybeAutosave(project, session, "battleVictory");
                settled = true;
                cleanup();
                if (authoredGameOver) {
                  session.battleResult = result;
                  applyBattleDefeat(scene, authoredGameOver.message, authoredGameOver.gameOverId);
                  // The selected terminal flow owns continuation, including canLose battles.
                  resolve(null);
                } else resolve(result);
              }).catch(fail);
            } catch (error) {
              fail(error);
            }
          },
        });
        markBattleEntry(startedAt);
        return entryTransition.reveal();
      }).catch(fail);
    });
  } catch (error) {
    if (owns()) exitBattleAudio(project, session, savedAudio);
    throw error;
  } finally {
    initializedRuntime?.cancel();
  }
}
