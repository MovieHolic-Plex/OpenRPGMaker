import type { BattleResult } from "@/battle/runtime";
import { createBattleRuntime } from "@/battle/runtime";
import type { StepResult } from "@/player/interpreter";
import { exitBattleAudio, enterBattleAudio } from "@/player/battleAudio";
import { mountBattleScene } from "@/player/battleDom";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { dialogueHost } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import { markBattleEntry } from "@/app/perfMetrics";
import { giveMonster } from "@/project/monsterCollection";
import { nextSessionRandom } from "@/project/session";

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
  const savedAudio = enterBattleAudio(project, scene.session);
  // 몬스터 전투 모드(옵션 A): system.monsterBattleParty 가 켜져 있고 세션 몬스터 파티가
  // 비어있지 않으면 영웅 대신 몬스터 파티로 전투한다. 아니면 기존 영웅 경로.
  const monsterParty = project.system.monsterBattleParty === true
    ? (scene.session.monsterParty ?? []).flatMap((instanceId) => {
        const instance = scene.session.monsterInstances?.[instanceId];
        return instance ? [instance] : [];
      })
    : [];
  const monsterPartyMode = monsterParty.length > 0;
  const runtime = createBattleRuntime({
    project,
    troopId: step.troopId,
    canEscape: step.canEscape,
    canLose: step.canLose,
    battleFlow: step.battleFlow,
    party: {
      levels: scene.session.actorLevels,
      experience: scene.session.actorExperience,
      names: scene.session.actorNames,
      vitals: scene.session.actorVitals,
      paramBonuses: scene.session.actorParamBonuses,
      equipment: scene.session.actorEquipment,
      skillIds: scene.session.actorSkillIds,
      classOverrides: scene.session.classOverrides,
      stateIds: scene.session.actorStateIds,
      partyActorIds: scene.session.partyActorIds,
      monsterParty: monsterPartyMode ? monsterParty : undefined,
    },
    sessionState: {
      switches: scene.session.switches,
      variables: scene.session.variables,
      inventory: scene.session.inventory,
      gold: scene.session.gold,
      partyActorIds: scene.session.partyActorIds,
      actorSkillIds: scene.session.actorSkillIds,
      actorExperience: scene.session.actorExperience,
      actorLevels: scene.session.actorLevels,
      gameTime: scene.session.gameTime,
    },
    // Terrain at the player's tile feeds battle backdrop when troop has no preview.
    captureLocation: { mapId: scene.session.currentMapId, x: scene.session.x, y: scene.session.y },
    onMonsterCaptured: (capture) => {
      giveMonster(project, scene.session, {
        speciesId: capture.speciesId,
        level: capture.level,
        caughtAt: capture.caughtAt,
        ivs: capture.ivs,
      });
    },
    rng: () => nextSessionRandom(scene.session, "battle"),
  });
  return new Promise<BattleResult>((resolve) => {
    const battleScene = mountBattleScene({
      host,
      runtime,
      onResult: (result, snapshot) => {
        exitBattleAudio(project, scene.session, savedAudio);
        applyBattleRewardsToSession(
          scene.session,
          { result, rewards: snapshot.rewards, actors: [...snapshot.actors, ...snapshot.reserveActors], eventState: snapshot.eventState, participatingActorIds: snapshot.participatingActorIds, monsterPartyMode },
          project
        );
        battleScene.destroy();
        resolve(result);
      },
    });
    markBattleEntry(startedAt);
  });
}