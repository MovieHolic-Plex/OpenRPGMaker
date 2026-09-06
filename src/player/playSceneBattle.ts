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
  startedAt: number
): Promise<BattleResult> {
  const host = dialogueHost(scene);
  if (!host) return Promise.resolve("defeat");
  const project = store.getCurrent();
  // canonical/legacy 선택자를 한 번만 해석하고 같은 파티를 모든 전투 소비자에게 넘긴다.
  const { requested: usePartyMonsters, partyMonsters, monsterPartyMode } = resolveMonsterBattleParty(project, scene.session);
  // 나설 몬스터가 없으면(스타터 지급 전) 전투를 건너뛴다 — 파티 0으로 즉시 패배하는 사고 방지.
  if (usePartyMonsters && !monsterPartyMode) {
    return Promise.resolve("escape");
  }
  const savedAudio = enterBattleAudio(project, scene.session);
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
    },
    partyMonsters: monsterPartyMode ? partyMonsters : undefined,
    // Terrain at the player's tile feeds battle backdrop when troop has no preview.
    captureLocation: { mapId: scene.session.currentMapId, x: scene.session.x, y: scene.session.y },
    onMonsterCaptured: (capture) => {
      giveMonster(project, scene.session, {
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
    rng: () => nextSessionRandom(scene.session, "battle"),
    playAudio: (resourceId, loop) => {
      playAudioCommand({ resourceId, loop }, project);
      scene.session.audio.bgm = { resourceId, loop };
    },
    stopAudio: () => {
      stopAudioCommand();
      scene.session.audio.bgm = undefined;
    },
  });
  return new Promise<BattleResult>((resolve) => {
    let battleScene: BattleDomController | undefined;
    let settled = false;
    const entrySkin = getBattleSkin(resolveSkinId(store.getCurrent().system.battleUiStyle));
    const entryTransition = createSkinBattleTransition(host, entrySkin.transition);
    void entryTransition.cover().then(() => {
      if (settled) return;
      battleScene = mountBattleScene({
        host,
        runtime,
        onResult: (result, snapshot) => {
          if (settled) return;
          settled = true;
          const exitTransition = createSkinBattleTransition(host, entrySkin.transition);
          void exitTransition.exit().then(() => {
            exitBattleAudio(project, scene.session, savedAudio);
            applyBattleRewardsToSession(
              scene.session,
              { result, canLose: snapshot.canLose, rewards: snapshot.rewards, actors: [...snapshot.actors, ...snapshot.reserveActors], eventState: snapshot.eventState, participatingActorIds: snapshot.participatingActorIds, monsterPartyMode },
              project
            );
            // 오토세이브 훅(PlayScene 경로 전용): 승리 보상이 세션에 반영된 직후.
            // sceneTestRunner/walkthroughRunner 는 applyBattleRewardsToSession 을 직접 부르므로
            // 헤드리스 테스트가 localStorage 를 오염시키지 않는다.
            if (result === "victory") maybeAutosave(project, scene.session, "battleVictory");
            battleScene?.destroy();
            void exitTransition.reveal().then(() => resolve(result));
          });
        },
      });
      markBattleEntry(startedAt);
      void entryTransition.reveal();
    });
  });
}
