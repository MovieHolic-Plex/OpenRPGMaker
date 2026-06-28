import type { BattleBattlerSnapshot, BattleResult, BattleRuntime, BattleSnapshot } from "@/battle/runtime";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import type { BattleAnimationPlayback } from "@/player/battleAnimationDom";
import { mountBattleAnimationPlayback } from "@/player/battleAnimationDom";
import { battleField, battlePartyStatus } from "@/player/battleFieldDom";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { store } from "@/project/store";
import type { ItemId, SkillId } from "@/project/types";

export interface BattleDomOptions {
  readonly host: HTMLElement;
  readonly runtime: BattleRuntime;
  readonly onResult: (result: BattleResult, snapshot: BattleSnapshot) => void;
}

export interface BattleDomController {
  readonly root: HTMLElement;
  destroy(): void;
}

const ANIMATION_HOLD_MS = 1_000;

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
  let activeAnimation: BattleAnimationPlayback | undefined;

  function render(): void {
    const snapshot = options.runtime.snapshot();
    activeAnimation?.destroy();
    activeAnimation = undefined;
    root.replaceChildren();
    root.append(battleField(snapshot), commandPanel(snapshot), battlePartyStatus(snapshot));
    activeAnimation = mountBattleAnimationPlayback(snapshot);
    if (activeAnimation) {
      root.append(activeAnimation.element);
    }
    const result = snapshot.result;
    if (result && !resultSent) {
      resultSent = true;
      window.setTimeout(() => {
        options.onResult(result, snapshot);
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
    advanceBattleRuntime(options.runtime);
    submenu = null;
    render();
  }

  function commandPanel(snapshot: BattleSnapshot): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "battle-command-panel";
    panel.append(enemyNameList(snapshot.enemies));
    // 전투 종료/적 턴이면 명령 패널을 비운다.
    if (snapshot.phase !== "actorCommand") return panel;

    const target = firstAliveEnemy(snapshot);
    const actor = activeActor(snapshot);
    const menu = document.createElement("div");
    menu.className = "battle-command-menu";

    if (submenu === "skill") {
      menu.append(...skillSubmenu(actor, target));
      panel.append(menu);
      return panel;
    }
    if (submenu === "item") {
      menu.append(...itemSubmenu(target));
      panel.append(menu);
      return panel;
    }

    // 주 명령: 공격 / 스킬 / 아이템 / 방어 / 도주 (RM2K3 전투 명령).
    menu.append(commandButton("공격", "actor-command-attack", () => {
      if (!target) return;
      runActorCommand(() => options.runtime.performActorCommand({ kind: "attack", targetEnemyId: target.id }));
    }));
    menu.append(commandButton("스킬", "actor-command-skill", () => {
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
    menu.append(commandButton("아이템", "actor-command-item", () => {
      if (battleItems().length === 0) return;
      submenu = "item";
      render();
    }));
    menu.append(commandButton("방어", "actor-command-defend", () => {
      runActorCommand(() => options.runtime.performActorCommand({ kind: "defend" }));
    }));
    menu.append(commandButton("도주", "actor-command-escape", () => {
      runActorCommand(() => options.runtime.performActorCommand({ kind: "escape" }));
    }));
    panel.append(menu);
    return panel;
  }

  function enemyNameList(enemies: readonly BattleBattlerSnapshot[]): HTMLElement {
    const list = document.createElement("div");
    list.className = "battle-enemy-list";
    for (const enemy of enemies) {
      const row = document.createElement("div");
      row.className = "battle-enemy-list-row";
      row.dataset.enemyId = enemy.id;
      row.textContent = enemy.name;
      if (enemy.defeated) row.classList.add("defeated");
      list.append(row);
    }
    return list;
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
      activeAnimation?.destroy();
      root.remove();
    },
  };
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
