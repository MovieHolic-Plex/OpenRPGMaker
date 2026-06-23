import type { BattleBattlerSnapshot, BattleResult, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { store } from "@/project/store";
import type { ItemId, SkillId } from "@/project/types";

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
  // 스킬/아이템 서브메뉴 상태. null 이면 주 명령 패널.
  let submenu: "skill" | "item" | null = null;

  function render(): void {
    const snapshot = options.runtime.snapshot();
    root.replaceChildren();
    root.append(battleField(snapshot), commandPanel(snapshot));
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

  function firstAliveEnemy(snapshot: BattleSnapshot): BattleBattlerSnapshot | undefined {
    return snapshot.enemies.find((enemy) => !enemy.defeated);
  }

  function activeActor(snapshot: BattleSnapshot): BattleBattlerSnapshot | undefined {
    return snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId);
  }

  function runActorCommand(factory: () => void): void {
    factory();
    submenu = null;
    render();
  }

  function commandPanel(snapshot: BattleSnapshot): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "battle-command-panel";
    // 전투 종료/적 턴이면 명령 패널을 비운다.
    if (snapshot.phase !== "actorCommand") return panel;

    const target = firstAliveEnemy(snapshot);
    const actor = activeActor(snapshot);

    if (submenu === "skill") {
      panel.append(...skillSubmenu(actor, target));
      return panel;
    }
    if (submenu === "item") {
      panel.append(...itemSubmenu(target));
      return panel;
    }

    // 주 명령: 공격 / 스킬 / 아이템 / 방어 / 도주 (RM2K3 전투 명령).
    panel.append(commandButton("공격", "actor-command-attack", () => {
      if (!target) return;
      runActorCommand(() => options.runtime.performActorCommand({ kind: "attack", targetEnemyId: target.id }));
    }));
    panel.append(commandButton("스킬", "actor-command-skill", () => {
      // 스킬이 하나뿐이면 곧바로 시전(E2E 단일 클릭 호환). 여러 개면 서브메뉴를 연다.
      const skills = usableSkills(actor);
      if (skills.length === 1 && target) {
        runActorCommand(() =>
          options.runtime.performActorCommand({ kind: "skill", skillId: skills[0], targetEnemyId: target.id })
        );
        return;
      }
      submenu = "skill";
      render();
    }));
    panel.append(commandButton("아이템", "actor-command-item", () => {
      if (battleItems().length === 0) return;
      submenu = "item";
      render();
    }));
    panel.append(commandButton("방어", "actor-command-defend", () => {
      runActorCommand(() => options.runtime.performActorCommand({ kind: "defend" }));
    }));
    panel.append(commandButton("도주", "actor-command-escape", () => {
      runActorCommand(() => options.runtime.performActorCommand({ kind: "escape" }));
    }));
    return panel;
  }

  /** 액터가 사용 가능한 스킬 id 목록(DB 존재 + MP 는 여기서 단순히 스킵). */
  function usableSkills(actor: BattleBattlerSnapshot | undefined): SkillId[] {
    if (!actor) return [];
    const skills = store.getCurrent().database.skills;
    return actor.skillIds.filter((id) => skills.some((skill) => skill.id === id));
  }

  /** 전투에서 사용 가능한 아이템(스킬이 연결된 소비성). */
  function battleItems(): { itemId: ItemId; name: string; count: number }[] {
    const project = store.getCurrent();
    const inventory = project.session.inventory;
    return project.database.items
      .filter((item) => item.skillId && (inventory[item.id] ?? 0) > 0)
      .map((item) => ({ itemId: item.id, name: item.name, count: inventory[item.id] ?? 0 }));
  }

  function skillSubmenu(actor: BattleBattlerSnapshot | undefined, target: BattleBattlerSnapshot | undefined): HTMLElement[] {
    const header = document.createElement("div");
    header.className = "battle-submenu-header";
    header.textContent = "스킬";
    const nodes: HTMLElement[] = [header];
    for (const skillId of usableSkills(actor)) {
      const skill = store.getCurrent().database.skills.find((record) => record.id === skillId);
      nodes.push(
        commandButton(skill?.name ?? skillId, `actor-skill-${skillId}`, () => {
          if (!target) return;
          runActorCommand(() =>
            options.runtime.performActorCommand({ kind: "skill", skillId, targetEnemyId: target.id })
          );
        })
      );
    }
    nodes.push(submenuBackButton());
    return nodes;
  }

  function itemSubmenu(target: BattleBattlerSnapshot | undefined): HTMLElement[] {
    const header = document.createElement("div");
    header.className = "battle-submenu-header";
    header.textContent = "아이템";
    const nodes: HTMLElement[] = [header];
    for (const item of battleItems()) {
      nodes.push(
        commandButton(`${item.name} ×${item.count}`, `actor-item-${item.itemId}`, () => {
          if (!target) return;
          runActorCommand(() =>
            options.runtime.performActorCommand({ kind: "item", itemId: item.itemId, targetEnemyId: target.id })
          );
        })
      );
    }
    nodes.push(submenuBackButton());
    return nodes;
  }

  function submenuBackButton(): HTMLElement {
    return commandButton("← 뒤로", "actor-command-back", () => {
      submenu = null;
      render();
    });
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
  enemyNode.append(document.createTextNode(`${enemy.name} ${enemy.hp}/${enemy.maxHp}`));
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
    // RM2K3 사이드뷰: 주인공 전투 캐릭터 스프라이트를 렌더링한다.
    node.dataset.battleCharsetResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) {
      const image = document.createElement("img");
      image.className = "battle-actor-image";
      image.alt = `${actor.name} 전투 캐릭터`;
      image.src = url;
      node.append(image);
    }
  }
  const label = document.createElement("span");
  label.className = "battle-actor-label";
  label.textContent = `${actor.name} ${actor.hp}/${actor.maxHp}`;
  node.append(label);
  if (actor.defeated) node.classList.add("defeated");
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
