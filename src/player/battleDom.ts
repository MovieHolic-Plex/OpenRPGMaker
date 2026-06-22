import type { BattleBattlerSnapshot, BattleResult, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { store } from "@/project/store";

export interface BattleDomOptions {
  readonly host: HTMLElement;
  readonly runtime: BattleRuntime;
  readonly onResult: (result: BattleResult) => void;
}

export interface BattleDomController {
  readonly root: HTMLElement;
  destroy(): void;
}

const ANIMATION_HOLD_MS = 180;

export function mountBattleScene(options: BattleDomOptions): BattleDomController {
  options.host.querySelector("[data-testid='battle-scene']")?.remove();
  const root = document.createElement("section");
  root.className = "battle-scene";
  root.dataset.testid = "battle-scene";
  applyBattleSystemGraphic(root);
  options.host.append(root);

  let resultSent = false;

  function render(): void {
    const snapshot = options.runtime.snapshot();
    root.replaceChildren();
    root.append(battleField(snapshot), commandPanel());
    if (snapshot.lastAnimation) {
      const animation = document.createElement("div");
      animation.className = "battle-animation";
      animation.dataset.testid = "battle-animation";
      animation.textContent = snapshot.lastAnimation.animationId;
      root.append(animation);
    }
    const result = snapshot.result;
    if (result && !resultSent) {
      resultSent = true;
      window.setTimeout(() => {
        options.onResult(result);
      }, ANIMATION_HOLD_MS);
    }
  }

  function commandPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "battle-command-panel";
    const snapshot = options.runtime.snapshot();
    const target = snapshot.enemies.find((enemy) => !enemy.defeated);
    const actor = snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId);
    panel.append(commandButton("공격", "actor-command-attack", () => {
      if (!target) return;
      options.runtime.performActorCommand({ kind: "attack", targetEnemyId: target.id });
      render();
    }));
    panel.append(commandButton("스킬", "actor-command-skill", () => {
      const skillId = actor?.skillIds[0];
      if (!target || !skillId) return;
      options.runtime.performActorCommand({ kind: "skill", skillId, targetEnemyId: target.id });
      render();
    }));
    return panel;
  }

  render();

  return {
    root,
    destroy(): void {
      root.remove();
    },
  };
}

function battleField(snapshot: BattleSnapshot): HTMLElement {
  const field = document.createElement("div");
  field.className = "battle-field";
  field.append(battleBackdrop(), battleTitle(snapshot.troopId), enemyGroup(snapshot.enemies), partyGroup(snapshot.actors));
  return field;
}

function battleBackdrop(): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "battle-backdrop";
  backdrop.dataset.testid = "battle-backdrop";
  const resourceId = store.getCurrent().system.battleSystemResourceId;
  if (resourceId) {
    backdrop.dataset.backdropResourceId = resourceId;
    backdrop.textContent = `전투 배경 ${resourceId}`;
  } else {
    backdrop.textContent = "전투 배경";
  }
  return backdrop;
}

function battleTitle(troopId: string): HTMLElement {
  const title = document.createElement("div");
  title.className = "battle-title";
  title.textContent = troopId;
  return title;
}

function enemyGroup(enemies: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-enemy-group";
  for (const enemy of enemies) {
    group.append(enemyButton(enemy));
  }
  return group;
}

function enemyButton(enemy: BattleBattlerSnapshot): HTMLButtonElement {
  const enemyNode = document.createElement("button");
  enemyNode.type = "button";
  enemyNode.className = "battle-enemy";
  enemyNode.dataset.testid = enemy.id;
  enemyNode.dataset.recordId = enemy.recordId;
  const resourceId = monsterResourceId(enemy.recordId);
  if (resourceId) {
    enemyNode.dataset.monsterResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) {
      const image = document.createElement("img");
      image.className = "battle-enemy-image";
      image.alt = `${enemy.name} 몬스터`;
      image.src = url;
      enemyNode.append(image);
    }
  }
  enemyNode.append(document.createTextNode(resourceId ? `${enemy.name} ${enemy.hp}/${enemy.maxHp} 몬스터 ${resourceId}` : `${enemy.name} ${enemy.hp}/${enemy.maxHp}`));
  enemyNode.disabled = enemy.defeated;
  return enemyNode;
}

function partyGroup(actors: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-party";
  group.dataset.testid = "battle-party";
  for (const actor of actors) {
    group.append(actorNode(actor));
  }
  return group;
}

function actorNode(actor: BattleBattlerSnapshot): HTMLElement {
  const node = document.createElement("div");
  node.className = "battle-actor";
  node.dataset.testid = `battle-actor-${actor.recordId}`;
  node.dataset.recordId = actor.recordId;
  const resourceId = battleCharsetResourceId(actor.recordId);
  if (resourceId) {
    node.dataset.battleCharsetResourceId = resourceId;
  }
  node.textContent = resourceId
    ? `${actor.name} ${actor.hp}/${actor.maxHp} 전투 캐릭터 ${resourceId}`
    : `${actor.name} ${actor.hp}/${actor.maxHp}`;
  return node;
}

function battleCharsetResourceId(recordId: string): string | undefined {
  return store.getCurrent().database.actors.find((actor) => actor.id === recordId)?.battleCharacterResourceId;
}

function monsterResourceId(recordId: string): string | undefined {
  return store.getCurrent().database.enemies.find((enemy) => enemy.id === recordId)?.monsterResourceId;
}

function commandButton(label: string, testId: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "battle-command";
  button.dataset.testid = testId;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
