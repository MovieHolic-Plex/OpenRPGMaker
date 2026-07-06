import type {
  ActorCommand,
  BattleBattlerSnapshot,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { commandPromptState, type BattleDirectorState } from "@/player/battleDirectorDom";
import { store } from "@/project/store";
import type { ItemId, SkillId } from "@/project/types";
import { activeActor } from "@/battle/battlePredict";

export type BattleCommandSubmenu = "skill" | "item" | null;

export interface BattleCommandPanelOptions {
  readonly runtime: BattleRuntime;
  readonly submenu: BattleCommandSubmenu;
  setSubmenu(submenu: BattleCommandSubmenu): void;
  setDirectorState(state: BattleDirectorState): void;
  render(): void;
  runActorCommand(command: ActorCommand): void;
  beginTargetCommand(command: TargetedActorCommand): void;
  confirmTargetSelection(enemyId: string): void;
}

export function commandPanel(snapshot: BattleSnapshot, options: BattleCommandPanelOptions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "battle-command-panel";

  if (snapshot.phase === "targetSelect") {
    panel.append(targetPrompt(snapshot));
    panel.append(targetSelectionMenu(snapshot, options));
    panel.append(keyPrompts());
    return panel;
  }
  if (snapshot.phase !== "actorCommand") return panel;

  panel.append(commandGrid(snapshot, options, false));
  return panel;
}

export function enemyListPanel(snapshot: BattleSnapshot): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "battle-enemy-list-panel";
  panel.append(enemyNameList(snapshot.enemies));
  return panel;
}

function commandGrid(snapshot: BattleSnapshot, options: BattleCommandPanelOptions, targetMode: boolean): HTMLElement {
  const actor = activeActor(snapshot);
  const menu = document.createElement("div");
  menu.className = "battle-command-menu";
  menu.dataset.testid = "battle-command-grid";

  if (options.submenu === "skill") {
    menu.append(...skillSubmenu(snapshot, options));
    return menu;
  }
  if (options.submenu === "item") {
    menu.append(...itemSubmenu(snapshot, options));
    return menu;
  }

  menu.append(commandButton("공격", "actor-command-attack", "sword", "", () => {
    options.beginTargetCommand({ kind: "attack" });
  }, targetMode));
  menu.append(commandButton("스킬", "actor-command-skill", "fire", actor ? `${usableSkills(actor).length}개` : "", () => {
    const skills = usableSkills(actor);
    if (skills.length === 1) {
      options.beginTargetCommand({ kind: "skill", skillId: skills[0] });
      return;
    }
    options.setSubmenu("skill");
    options.render();
  }));
  const items = battleItems(snapshot);
  menu.append(commandButton("아이템", "actor-command-item", "bag", items.length > 0 ? `${items.length}종` : "없음", () => {
    if (targetMode || battleItems(snapshot).length === 0) return;
    options.setSubmenu("item");
    options.render();
  }, targetMode));
  menu.append(commandButton("방어", "actor-command-defend", "shield", "", () => {
    if (!targetMode) options.runActorCommand({ kind: "defend" });
  }, targetMode));
  menu.append(commandButton("도주", "actor-command-escape", "boot", "", () => {
    if (!targetMode) options.runActorCommand({ kind: "escape" });
  }, targetMode));
  return menu;
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

function usableSkills(actor: BattleBattlerSnapshot | undefined): SkillId[] {
  if (!actor) return [];
  const skills = store.getCurrent().database.skills;
  return actor.skillIds.filter((id) => skills.some((skill) => skill.id === id));
}

// 전투 아이템 목록은 전투 런타임의 이벤트 상태(현재 플레이 세션에서 시드됨)를 기준으로 한다.
// project.session은 에디터 시작 상태라 플레이 중 획득/소모가 반영되지 않는다.
function battleItems(snapshot: BattleSnapshot): { itemId: ItemId; name: string; count: number }[] {
  const project = store.getCurrent();
  const inventory = snapshot.eventState.inventory;
  return project.database.items
    .filter((item) => item.skillId && (inventory[item.id] ?? 0) > 0)
    .map((item) => ({ itemId: item.id, name: item.name, count: inventory[item.id] ?? 0 }));
}

function skillSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = "스킬";
  const nodes: HTMLElement[] = [header];
  const actor = activeActor(snapshot);
  const project = store.getCurrent();
  for (const skillId of usableSkills(actor)) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    const detail = skill ? skillDetailFor(project, skill) : "스킬";
    nodes.push(commandButton(skill?.name ?? skillId, `actor-skill-${skillId}`, "fire", detail, () => {
      options.beginTargetCommand({ kind: "skill", skillId });
    }));
  }
  nodes.push(submenuBackButton(options));
  return nodes;
}

function skillDetailFor(
  project: ReturnType<typeof store.getCurrent>,
  skill: { id: SkillId; power: number; effect: { kind: string } }
): string {
  const mp = mpDetail(project, skill.id);
  const fullSkill = project.database.skills.find((record) => record.id === skill.id);
  if (!fullSkill) return mp;
  if (fullSkill.effect.kind === "healing") return `HP ${fullSkill.power} 회복 ${mp}`;
  if (fullSkill.effect.kind === "support" || fullSkill.effect.kind === "switch") return `보조 ${mp}`;
  return mp || "공격";
}

// MP 소비 표기. flat + percentMax.
function mpDetail(project: ReturnType<typeof store.getCurrent>, skillId: SkillId): string {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill?.mpCost) return "";
  const flat = skill.mpCost.flat ?? 0;
  const pct = skill.mpCost.percentMax ?? 0;
  if (flat === 0 && pct === 0) return "";
  return `MP ${flat}${pct > 0 ? `+${pct}%` : ""}`;
}

function itemSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = "아이템";
  const nodes: HTMLElement[] = [header];
  for (const item of battleItems(snapshot)) {
    nodes.push(commandButton(`${item.name} x${item.count}`, `actor-item-${item.itemId}`, "bag", "아이템 사용", () => {
      options.beginTargetCommand({ kind: "item", itemId: item.itemId });
    }));
  }
  nodes.push(submenuBackButton(options));
  return nodes;
}

function submenuBackButton(options: BattleCommandPanelOptions): HTMLElement {
  return commandButton("뒤로", "actor-command-back", "back", "이전 메뉴", () => {
    options.setSubmenu(null);
    options.render();
  });
}

function targetSelectionMenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "battle-command-menu battle-target-menu";
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = "대상";
  menu.append(header);
  const targetEnemyIds = snapshot.targetSelection?.targetEnemyIds ?? [];
  for (const enemyId of targetEnemyIds) {
    const enemy = snapshot.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) continue;
    const button = commandButton(enemy.name, `battle-target-${enemy.id}`, "target", "선택", () => {
      options.confirmTargetSelection(enemy.id);
    });
    button.dataset.battleTargetable = "true";
    if (snapshot.targetSelection?.selectedEnemyId === enemy.id) {
      button.classList.add("battle-target-selected");
    }
    menu.append(button);
  }
  menu.append(commandButton("취소", "battle-target-cancel", "back", "대상 선택 취소", () => {
    options.runtime.cancelTargetSelection();
    options.setDirectorState(commandPromptState(options.runtime.snapshot()));
    options.render();
  }));
  return menu;
}

function targetPrompt(snapshot: BattleSnapshot): HTMLElement {
  const prompt = document.createElement("div");
  prompt.className = "battle-target-prompt";
  prompt.dataset.testid = "battle-target-prompt";
  const actor = activeActor(snapshot);
  const selectedEnemy = snapshot.enemies.find((enemy) => enemy.id === snapshot.targetSelection?.selectedEnemyId)
    ?? snapshot.enemies.find((enemy) => snapshot.targetSelection?.targetEnemyIds.includes(enemy.id));
  prompt.textContent = selectedEnemy
    ? `대상: ${selectedEnemy.name}`
    : actor
      ? `${actor.name}: 대상을 선택`
      : "대상 선택";
  return prompt;
}

function keyPrompts(): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-key-prompts";
  row.dataset.testid = "battle-key-prompts";
  for (const [key, label] of [["Z", "확정"], ["X", "대상 변경"], ["C", "취소"]] as const) {
    const item = document.createElement("span");
    const keycap = document.createElement("kbd");
    keycap.textContent = key;
    item.append(keycap, document.createTextNode(` ${label}`));
    row.append(item);
  }
  return row;
}

function commandButton(
  label: string,
  testId: string,
  icon: string,
  detail: string,
  onClick: () => void,
  inert = false
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "battle-command";
  button.dataset.testid = testId;
  button.dataset.commandIcon = icon;
  if (inert) button.dataset.previewOnly = "true";
  const iconNode = document.createElement("span");
  iconNode.className = `battle-command-icon battle-command-icon-${icon}`;
  iconNode.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "battle-command-text";
  const title = document.createElement("strong");
  title.textContent = label;
  text.append(title);
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    text.append(small);
  }
  button.append(iconNode, text);
  button.addEventListener("click", onClick);
  return button;
}
