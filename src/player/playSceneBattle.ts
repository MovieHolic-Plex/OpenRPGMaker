import type { BattleResult } from "@/battle/runtime";
import { createBattleRuntime } from "@/battle/runtime";
import type { StepResult } from "@/player/interpreter";
import { exitBattleAudio, enterBattleAudio } from "@/player/battleAudio";
import { playAudioCommand, stopAudioCommand } from "@/player/audio";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { createSkinBattleTransition } from "@/player/battleTransition";
import { resolveSkinId, getBattleSkin } from "@/battle/skins/registry";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { maybeAutosave } from "@/player/autosave";
import { dialogueHost } from "@/player/playSceneDom";
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

export function playBattle(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "battleProcessing" }>,
  startedAt: number,
  isCurrent: () => boolean = () => true
): Promise<BattleResult> {
  const host = dialogueHost(scene);
  if (!host) return Promise.resolve("defeat");
  if (!isCurrent()) return Promise.resolve("escape");
  const project = store.getCurrent();
  const session = scene.session, mapId = scene.map?.id;
  let closed = false;
  const current = () => !closed && scene.session === session && scene.map?.id === mapId && isCurrent();
  // canonical/legacy 선택자를 한 번만 해석하고 같은 파티를 모든 전투 소비자에게 넘긴다.
  const { requested: usePartyMonsters, partyMonsters, monsterPartyMode } = resolveMonsterBattleParty(project, session);
  // 나설 몬스터가 없으면(스타터 지급 전) 전투를 건너뛴다 — 파티 0으로 즉시 패배하는 사고 방지.
  if (usePartyMonsters && !monsterPartyMode) {
    return Promise.resolve("escape");
  }
  const savedAudio = enterBattleAudio(project, session);
  const runtime = createBattleRuntime({
    project,
    troopId: step.troopId,
    canEscape: step.canEscape && session.m2Runtime?.access?.escape !== false,
    canLose: step.canLose,
    battleFlow: step.battleFlow,
    party: {
      levels: session.actorLevels,
      experience: session.actorExperience,
      names: session.actorNames,
      faceResourceIds: session.actorFaceResourceIds,
      vitals: session.actorVitals,
      paramBonuses: session.actorParamBonuses,
      equipment: session.actorEquipment,
      skillIds: session.actorSkillIds,
      skillPp: session.actorSkillPp,
      classOverrides: session.classOverrides,
      growthProgress: session.growthProgress,
      stateIds: session.actorStateIds,
      partyActorIds: session.partyActorIds,
      monsterParty: monsterPartyMode ? partyMonsters : undefined,
      battleCommands: session.actorBattleCommands,
    },
    // battleProcessing 스텝을 만든 맵 이벤트. 트룹 배틀 이벤트의 selfSwitch 소유 이벤트가 된다.
    // 랜덤 인카운터/필드 스폰(playSceneMovement/playSceneFieldSpawns) 스텝에는 없어 undefined 유지.
    ownerEventId: step.ownerEventId,
    sessionState: {
      switches: session.switches,
      variables: session.variables,
      inventory: session.inventory,
      selfSwitches: session.selfSwitches,
      battleResult: session.battleResult,
      roguelikeRun: session.roguelikeRun,
      itemUseCharges: session.itemUseCharges,
      gold: session.gold,
      partyActorIds: session.partyActorIds,
      actorSkillIds: session.actorSkillIds,
      actorExperience: session.actorExperience,
      actorLevels: session.actorLevels,
      actorBattleCommands: session.actorBattleCommands,
      // Step 3d: 전투 이벤트 changeEquipment/promoteActor 의 기준 상태(오버레이 시드).
      actorEquipment: session.actorEquipment,
      classOverrides: session.classOverrides,
      growthProgress: session.growthProgress,
      timers: session.timers,
      gameTime: session.gameTime,
      npcActivities: session.npcActivities,
      friendship: session.friendship,
      relationships: session.relationships,
    },
    partyMonsters: monsterPartyMode ? partyMonsters : undefined,
    // Terrain at the player's tile feeds battle backdrop when troop has no preview.
    captureLocation: { mapId: session.currentMapId, x: session.x, y: session.y },
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
  return new Promise<BattleResult>((resolve, reject) => {
    let battleScene: BattleDomController | undefined;
    let resultChosen = false, finished = false;
    let exitTransition: ReturnType<typeof createSkinBattleTransition> | undefined;
    const entrySkin = getBattleSkin(resolveSkinId(project.system.battleUiStyle));
    const entryTransition = createSkinBattleTransition(host, entrySkin.transition);
    const cleanup = () => {
      scene.events?.off('shutdown', cancel); scene.events?.off('destroy', cancel); scene.events?.off('update', checkOwner);
      battleScene?.destroy(); battleScene = undefined;
      entryTransition.destroy(); exitTransition?.destroy();
    };
    const finish = (result: BattleResult) => {
      if (finished) return;
      finished = true; cleanup(); resolve(result);
    };
    const cancel = () => { closed = true; finish('escape'); };
    const checkOwner = () => { if (!current()) cancel(); };
    const fail = (error: unknown) => { if (!finished) { finished = true; cleanup(); reject(error); } };
    scene.events?.once('shutdown', cancel); scene.events?.once('destroy', cancel); scene.events?.on('update', checkOwner);
    void entryTransition.cover().then(() => {
      if (finished) return;
      if (!current()) { cancel(); return; }
      battleScene = mountBattleScene({
        host, runtime,
        onResult: (result, snapshot) => {
          if (finished || resultChosen) return;
          if (!current()) { cancel(); return; }
          resultChosen = true;
          const transition = createSkinBattleTransition(host, entrySkin.transition);
          exitTransition = transition;
          void transition.exit().then(async () => {
            if (finished) return;
            if (!current()) { cancel(); return; }
            exitBattleAudio(project, session, savedAudio);
            applyBattleRewardsToSession(session,
              { result, canLose: snapshot.canLose, rewards: snapshot.rewards, actors: [...snapshot.actors, ...snapshot.reserveActors], eventState: snapshot.eventState, participatingActorIds: snapshot.participatingActorIds, monsterPartyMode }, project);
            if (result === 'victory') maybeAutosave(project, session, 'battleVictory');
            battleScene?.destroy(); battleScene = undefined;
            await transition.reveal();
            finish(current() ? result : 'escape');
          }).catch(fail);
        },
      });
      markBattleEntry(startedAt);
      void entryTransition.reveal().catch(fail);
    }).catch(fail);
  });
}
