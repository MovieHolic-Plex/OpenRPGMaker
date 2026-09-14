import type { BattleResult, BattleRuntime } from "@/battle/runtime";
import { BattleAdmissionError } from "@/project/battleAdmission";
import { createBattleRuntime } from "@/battle/runtime";
import type { StepResult } from "@/player/interpreter";
import { exitBattleAudio, enterBattleAudio } from "@/player/battleAudio";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { createSkinBattleTransition, type BattleTransition } from "@/player/battleTransition";
import { resolveSkinId, getBattleSkin } from "@/battle/skins/registry";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { maybeAutosave } from "@/player/autosave";
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

type BattleHostScene = Pick<PlaySceneContext, "session" | "tileY" | "battleAbortController">
  & Parameters<typeof dialogueHost>[0]
  & Partial<Pick<PlaySceneContext, "events">>
  & { readonly map: Pick<PlaySceneContext["map"], "height"> };

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
  const savedAudio = { fieldBgmResourceId: session.audio.bgm?.resourceId };
  let initializedRuntime: BattleRuntime | undefined;
  try {
    enterBattleAudio(project, session);
    const runtime = createBattleRuntime({
      project,
      troopId: step.troopId,
      canEscape: step.canEscape && scene.session.m2Runtime?.access?.escape !== false,
      canLose: step.canLose,
      battleFlow: step.battleFlow,
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
        partyActorIds: scene.session.partyActorIds,
        actorSkillIds: scene.session.actorSkillIds,
        actorExperience: scene.session.actorExperience,
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
      const entryTransition = createSkinBattleTransition(host, entrySkin.transition);
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
      void Promise.resolve().then(() => entryTransition.cover()).then(() => {
        if (!current()) { abort(); return; }
        battleScene = mountBattleScene({
          host, runtime,
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
              const transition = createSkinBattleTransition(host, entrySkin.transition);
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
                const terminalDefeat = result === "defeat" && !snapshot.canLose;
                if (terminalDefeat) {
                  exitTransition = undefined;
                  void transition.reveal();
                } else {
                  await transition.reveal();
                }
                if (!current()) { abort(); return; }
                // Commit once, after all cancellable presentation has completed.
                exitBattleAudio(project, session, savedAudio);
                applyBattleRewardsToSession(session,
                  { result, canLose: snapshot.canLose, rewards: snapshot.rewards, actors: [...snapshot.actors, ...snapshot.reserveActors], eventState: snapshot.eventState, participatingActorIds: snapshot.participatingActorIds, monsterPartyMode }, project);
                if (result === "victory") maybeAutosave(project, session, "battleVictory");
                settled = true;
                cleanup();
                resolve(result);
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
