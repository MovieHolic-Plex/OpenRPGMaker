import type {
  ActorCommand,
  BattleBattlerSnapshot,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { commandPromptState, type BattleDirectorState } from "@/player/battleDirectorDom";
import { hpBarState } from "@/player/battleFieldDom";
import { store } from "@/project/store";
import type { ItemId, SkillId } from "@/project/types";
import { resolveTerms, type ResolvedTerms } from "@/project/terms";
import { activeActor } from "@/battle/battlePredict";
import { battleCommandsForActor, type RuntimeBattleCommand } from "@/battle/battleCommands";
import { battleSkillMpCost, battleSkillUseFailure, battleSkillUseFailureLabel } from "@/battle/battleSkillUse";
import { targetScopeForCommand } from "@/battle/battleTargetResolver";

export type BattleCommandSubmenu =
  | { readonly kind: "skill"; readonly command: RuntimeBattleCommand }
  | { readonly kind: "item" }
  | { readonly kind: "capture" }
  | { readonly kind: "switch" }
  | null;

export interface BattleCommandPanelOptions {
  readonly runtime: BattleRuntime;
  readonly submenu: BattleCommandSubmenu;
  setSubmenu(submenu: BattleCommandSubmenu): void;
  setDirectorState(state: BattleDirectorState): void;
  render(): void;
  runActorCommand(command: ActorCommand): void;
  beginTargetCommand(command: TargetedActorCommand): void;
  confirmTargetSelection(targetId: string): void;
  cancelTargetSelection?(): void;
}

export function commandPanel(snapshot: BattleSnapshot, options: BattleCommandPanelOptions): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "battle-command-panel";
  const terms = resolveTerms(store.getCurrent());

  if (snapshot.phase === "targetSelect") {
    panel.append(targetPrompt(snapshot, terms));
    panel.append(targetSelectionMenu(snapshot, options, terms));
    panel.append(keyPrompts());
    return panel;
  }
  if (snapshot.phase !== "actorCommand") return panel;

  if (snapshot.battleFlow === "strict") panel.append(strictFlowStatus(snapshot));
  panel.append(commandGrid(snapshot, options, false));
  panel.append(keyPrompts());
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
  const terms = resolveTerms(store.getCurrent());

  if (options.submenu?.kind === "skill") {
    menu.append(...skillSubmenu(snapshot, options, terms));
    return menu;
  }
  if (options.submenu?.kind === "item") {
    menu.append(...itemSubmenu(snapshot, options, terms));
    return menu;
  }
  if (options.submenu?.kind === "capture") {
    menu.append(...captureSubmenu(snapshot, options, terms));
    return menu;
  }
  if (options.submenu?.kind === "switch") {
    menu.append(...switchSubmenu(snapshot, options, terms));
    return menu;
  }

  const project = store.getCurrent();
  const overrideCommandIds = actor?.recordId
    ? snapshot.eventState.actorBattleCommands?.[actor.recordId]
    : undefined;
  for (const command of battleCommandsForActor(project, actor?.recordId, {
    classId: actor?.classId,
    includeSwitch: snapshot.reserveActors.length > 0,
    forceSwitchOnly: Boolean(snapshot.forcedSwitchActorId),
    overrideCommandIds,
  })) {
    menu.append(commandControl(snapshot, options, command, actor, targetMode));
  }
  return menu;
}

function commandControl(
  snapshot: BattleSnapshot,
  options: BattleCommandPanelOptions,
  command: RuntimeBattleCommand,
  actor: BattleBattlerSnapshot | undefined,
  targetMode: boolean
): HTMLElement {
  const terms = resolveTerms(store.getCurrent());
  const normalizedName = command.name.trim().toLowerCase();
  const label = command.kind === "attack"
    ? terms.attack
    : command.kind === "skill" && normalizedName === "skill"
      ? terms.skill
      : command.kind === "item" && normalizedName === "item"
        ? terms.item
        : command.name;
  switch (command.kind) {
    case "attack":
      return commandButton(label, commandTestId(command), "sword", "", () => {
        options.beginTargetCommand({ kind: "attack" });
      }, targetMode);
    case "skill": {
      const skillIds = listedSkillIds(actor, command);
      const project = store.getCurrent();
      const usable = skillIds.filter((skillId) => actor && !battleSkillUseFailure(project, actor, skillId));
      const onlySkill = skillIds.length === 1 ? project.database.skills.find((skill) => skill.id === skillIds[0]) : undefined;
      const failure = onlySkill && actor ? battleSkillUseFailure(project, actor, onlySkill.id) : undefined;
      const reason = failure && actor ? battleSkillUseFailureLabel(failure, onlySkill, actor) : skillIds.length === 0 ? "사용 가능한 스킬이 없습니다." : undefined;
      return commandButton(label, commandTestId(command), "fire", reason ?? "", () => {
        if (targetMode || skillIds.length === 0) return;
        if ((skillIds.length === 1 || command.skillId) && usable.length === 1) {
          options.beginTargetCommand({ kind: "skill", skillId: usable[0] });
          return;
        }
        options.setSubmenu({ kind: "skill", command });
        options.render();
      }, targetMode || skillIds.length === 0 || Boolean(failure), reason);
    }
    case "item": {
      const items = battleItems(snapshot);
      const itemBtn = commandButton(label, commandTestId(command), "bag", items.length > 0 ? `${items.length}종` : "없음", () => {
        if (targetMode || items.length === 0) return;
        options.setSubmenu({ kind: "item" });
        options.render();
      }, items.length === 0);
      return itemBtn;
    }
    case "capture": {
      const items = captureItems(snapshot);
      return commandButton(command.name, commandTestId(command), "target", items.length > 0 ? `${items.length}종` : "없음", () => {
        if (targetMode || items.length === 0) return;
        options.setSubmenu({ kind: "capture" });
        options.render();
      }, targetMode || items.length === 0);
    }
    case "defend":
      return commandButton(command.name, commandTestId(command), "shield", "", () => {
        if (!targetMode) options.runActorCommand({ kind: "defend" });
      }, targetMode);
    case "escape":
      return commandButton(command.name, commandTestId(command), "boot", "", () => {
        if (!targetMode) options.runActorCommand({ kind: "escape" });
      }, targetMode || !snapshot.canEscape);
    case "switch": {
      const candidates = switchCandidates(snapshot);
      return commandButton(command.name, commandTestId(command), "switch", candidates.length > 0 ? `${candidates.length}명` : "없음", () => {
        if (targetMode || candidates.length === 0) return;
        options.setSubmenu({ kind: "switch" });
        options.render();
      }, targetMode || candidates.length === 0);
    }
  }
}

function commandTestId(command: RuntimeBattleCommand): string {
  switch (command.kind) {
    case "attack":
      return "actor-command-attack";
    case "item":
      return "actor-command-item";
    case "capture":
      return "actor-command-capture";
    case "defend":
      return "actor-command-defend";
    case "escape":
      return "actor-command-escape";
    case "skill":
      return command.skillId ? `actor-command-skill-${command.skillId}` : command.id === "cmd_skill" ? "actor-command-skill" : `actor-command-${command.id}`;
    case "switch":
      return "actor-command-switch";
  }
}

function enemyNameList(enemies: readonly BattleBattlerSnapshot[]): HTMLElement {
  const list = document.createElement("div");
  list.className = "battle-enemy-list";
  for (const enemy of enemies) {
    list.append(enemyListRow(enemy));
  }
  return list;
}

export function syncEnemyListPanel(panel: HTMLElement, enemies: readonly BattleBattlerSnapshot[]): void {
  const list = panel.querySelector<HTMLElement>(".battle-enemy-list");
  if (!list) return;
  for (const enemy of enemies) {
    let row = list.querySelector<HTMLElement>(`.battle-enemy-list-row[data-enemy-id="${enemy.id}"]`);
    if (!row) {
      list.append(enemyListRow(enemy));
      row = list.querySelector<HTMLElement>(`.battle-enemy-list-row[data-enemy-id="${enemy.id}"]`);
    }
    if (!row) continue;
    const hp = row.querySelector<HTMLElement>(".battle-enemy-list-hp");
    if (hp) hp.textContent = `HP ${enemy.hp}/${enemy.maxHp}`;
    const bar = row.querySelector<HTMLElement>(".battle-enemy-list-bar");
    if (bar) {
      const pct = Math.max(0, Math.min(100, Math.round(enemy.hp / Math.max(1, enemy.maxHp) * 100)));
      bar.style.setProperty("--battle-stat", `${pct}%`);
      bar.dataset.hpState = hpBarState(pct);
    }
    row.classList.toggle("defeated", enemy.defeated);
  }
}

function enemyListRow(enemy: BattleBattlerSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-enemy-list-row";
  row.dataset.enemyId = enemy.id;
  const name = document.createElement("span");
  name.className = "battle-enemy-list-name";
  name.textContent = enemy.name;
  if (enemy.level) {
    const lv = document.createElement("span");
    lv.className = "battle-enemy-list-level";
    lv.textContent = `Lv.${enemy.level}`;
    name.append(lv);
  }
  const hp = document.createElement("span");
  hp.className = "battle-enemy-list-hp";
  hp.dataset.testid = `battle-enemy-list-hp-${enemy.id}`;
  hp.textContent = `HP ${enemy.hp}/${enemy.maxHp}`;
  // 포켓몬 스킨에선 숫자 대신 이 바만 노출된다(CSS로 전환).
  const pct = Math.max(0, Math.min(100, Math.round(enemy.hp / Math.max(1, enemy.maxHp) * 100)));
  const bar = document.createElement("span");
  bar.className = "battle-enemy-list-bar battle-stat-bar battle-stat-bar-hp";
  bar.style.setProperty("--battle-stat", `${pct}%`);
  bar.dataset.hpState = hpBarState(pct);
  row.append(name, hp, bar);
  if (enemy.defeated) row.classList.add("defeated");
  return row;
}

function listedSkillIds(actor: BattleBattlerSnapshot | undefined, command?: RuntimeBattleCommand): SkillId[] {
  if (!actor) return command?.skillId ? [command.skillId] : [];
  if (command?.skillId) return [command.skillId];
  const project = store.getCurrent();
  return actor.skillIds.filter((id) => {
    const skill = project.database.skills.find((record) => record.id === id);
    if (!skill) return true;
    if (command?.skillSubsetName) return skill.type === command.skillSubsetName;
    return true;
  });
}

// 전투 아이템 목록은 전투 런타임의 이벤트 상태(현재 플레이 세션에서 시드됨)를 기준으로 한다.
// project.session은 에디터 시작 상태라 플레이 중 획득/소모가 반영되지 않는다.
function battleItems(snapshot: BattleSnapshot): { itemId: ItemId; name: string; count: number }[] {
  const project = store.getCurrent();
  const inventory = snapshot.eventState.inventory;
  return project.database.items
    .filter((item) => (inventory[item.id] ?? 0) > 0 && isBattleUsableItem(item))
    .map((item) => ({ itemId: item.id, name: item.name, count: inventory[item.id] ?? 0 }));
}

function isBattleUsableItem(item: {
  readonly occasion: string;
  readonly occasionBattle: boolean;
  readonly captureProfile?: unknown;
  readonly skillId?: string;
  readonly activateSkillId?: string;
  readonly type: string;
  readonly hpRecovery: { flat: number; percentMax: number };
  readonly mpRecovery: { flat: number; percentMax: number };
  readonly healStateIds: readonly string[];
  readonly stateEffects: readonly unknown[];
}): boolean {
  if (item.captureProfile) return false;
  if (item.occasion === "never" || item.occasion === "field") return false;
  if (item.occasionBattle === false && item.occasion !== "battle" && item.occasion !== "always") return false;
  if (item.type === "book") return false;
  return Boolean(
    item.skillId ||
      item.activateSkillId ||
      item.hpRecovery.flat > 0 ||
      item.hpRecovery.percentMax > 0 ||
      item.mpRecovery.flat > 0 ||
      item.mpRecovery.percentMax > 0 ||
      item.healStateIds.length > 0 ||
      item.stateEffects.length > 0
  );
}

function captureItems(snapshot: BattleSnapshot): { itemId: ItemId; name: string; count: number; multiplier: number }[] {
  const project = store.getCurrent();
  const inventory = snapshot.eventState.inventory;
  return project.database.items
    .filter((item) => item.captureProfile && (inventory[item.id] ?? 0) > 0)
    .map((item) => ({ itemId: item.id, name: item.name, count: inventory[item.id] ?? 0, multiplier: item.captureProfile?.multiplier ?? 1 }));
}

function skillSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = options.submenu?.kind === "skill" ? options.submenu.command.name : terms.skill;
  const nodes: HTMLElement[] = [header];
  const actor = activeActor(snapshot);
  const project = store.getCurrent();
  const command = options.submenu?.kind === "skill" ? options.submenu.command : undefined;
  for (const skillId of listedSkillIds(actor, command)) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    const failure = actor ? battleSkillUseFailure(project, actor, skillId) : "notLearned";
    const reason = failure && actor ? battleSkillUseFailureLabel(failure, skill, actor) : failure ? "사용자가 없습니다." : undefined;
    const detail = skill && actor ? skillDetailFor(project, skill, terms, actor) : reason ?? terms.skill;
    nodes.push(commandButton(skill?.name ?? skillId, `actor-skill-${skillId}`, "fire", reason ? `${detail} · ${reason}` : detail, () => {
      options.beginTargetCommand({ kind: "skill", skillId });
    }, Boolean(reason), reason));
  }
  nodes.push(submenuBackButton(options, terms));
  return nodes;
}

function skillDetailFor(
  project: ReturnType<typeof store.getCurrent>,
  skill: { id: SkillId; power: number; scope: "self" | "ally" | "allAllies" | "enemy" | "allEnemies"; effect: { kind: string }; stateEffects?: readonly { stateId: string; operation: string }[] },
  terms: ResolvedTerms,
  actor: BattleBattlerSnapshot,
): string {
  const fullSkill = project.database.skills.find((record) => record.id === skill.id);
  if (!fullSkill) return terms.skill;
  const mp = `${terms.mp} ${battleSkillMpCost(fullSkill, actor.maxMp)}`;
  const scope = scopeLabel(fullSkill.scope);
  const states = (fullSkill.stateEffects ?? []).map((effect) => {
    const name = project.database.states.find((state) => state.id === effect.stateId)?.name ?? effect.stateId;
    return `${name} ${effect.operation === "remove" ? "해제" : "부여"}`;
  }).join(", ");
  const effect = fullSkill.effect.kind === "healing"
    ? `${terms.hp} ${fullSkill.power} 회복`
    : fullSkill.effect.kind === "support" || fullSkill.effect.kind === "switch"
      ? "보조"
      : fullSkill.power > 0 ? `위력 ${fullSkill.power}` : "공격";
  return [mp, scope, effect, states].filter(Boolean).join(" · ");
}

function scopeLabel(scope: "self" | "ally" | "allAllies" | "enemy" | "allEnemies"): string {
  switch (scope) {
    case "self": return "자신";
    case "ally": return "아군 1명";
    case "allAllies": return "아군 전체";
    case "enemy": return "적 1명";
    case "allEnemies": return "적 전체";
  }
}

function itemSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = terms.item;
  const nodes: HTMLElement[] = [header];
  const project = store.getCurrent();
  for (const item of battleItems(snapshot)) {
    const record = project.database.items.find((entry) => entry.id === item.itemId);
    const scope = record ? targetScopeForCommand(project, { kind: "item", itemId: record.id }) : "self";
    const states = record?.stateEffects.map((effect) => project.database.states.find((state) => state.id === effect.stateId)?.name ?? effect.stateId).join(", ");
    const detail = [scopeLabel(scope), states].filter(Boolean).join(" · ");
    nodes.push(commandButton(`${item.name} x${item.count}`, `actor-item-${item.itemId}`, "bag", detail || `${terms.item} 사용`, () => {
      options.beginTargetCommand({ kind: "item", itemId: item.itemId });
    }));
  }
  nodes.push(submenuBackButton(options, terms));
  return nodes;
}

function captureSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = terms.capture;
  const nodes: HTMLElement[] = [header];
  for (const item of captureItems(snapshot)) {
    const detail = item.multiplier === 1 ? terms.capture : `x${item.multiplier}`;
    nodes.push(commandButton(`${item.name} x${item.count}`, `actor-capture-${item.itemId}`, "target", detail, () => {
      options.beginTargetCommand({ kind: "capture", captureItemId: item.itemId });
    }));
  }
  nodes.push(submenuBackButton(options, terms));
  return nodes;
}

function switchSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = snapshot.forcedSwitchActorId ? "교체 필요" : "교체";
  const nodes: HTMLElement[] = [header];
  for (const actor of switchCandidates(snapshot)) {
    nodes.push(commandButton(actor.name, `actor-switch-${actor.recordId}`, "switch", `${terms.hp} ${actor.hp}/${actor.maxHp}`, () => {
      options.runActorCommand({ kind: "switch", targetActorId: actor.recordId });
    }));
  }
  if (!snapshot.forcedSwitchActorId) nodes.push(submenuBackButton(options, terms));
  return nodes;
}

function switchCandidates(snapshot: BattleSnapshot): BattleBattlerSnapshot[] {
  const candidateIds = new Set(snapshot.switchCandidateActorIds);
  return snapshot.reserveActors.filter((actor) => candidateIds.has(actor.recordId) && !actor.defeated);
}

function submenuBackButton(options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement {
  return commandButton(terms.back, "actor-command-back", "back", "이전 메뉴", () => {
    options.setSubmenu(null);
    options.render();
  });
}

function targetSelectionMenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "battle-command-menu battle-target-menu";
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = terms.target;
  menu.append(header);
  const targetIds = snapshot.targetSelection?.targetIds ?? [];
  for (const targetId of targetIds) {
    const target = snapshot.targetSelection?.side === "actor"
      ? snapshot.actors.find((entry) => entry.id === targetId || entry.recordId === targetId)
      : snapshot.enemies.find((entry) => entry.id === targetId);
    if (!target) continue;
    const button = commandButton(target.name, `battle-target-${target.id}`, "target", `${terms.hp} ${target.hp}/${target.maxHp}`, () => {
      options.confirmTargetSelection(target.id);
    });
    button.dataset.battleTargetable = "true";
    button.dataset.battleTargetId = target.id;
    button.dataset.battleTargetSide = snapshot.targetSelection?.side ?? "enemy";
    const selected = snapshot.targetSelection?.selectedTargetId === target.id;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    if (selected) button.classList.add("battle-target-selected");
    menu.append(button);
  }
  menu.append(commandButton("취소", "battle-target-cancel", "back", "", () => {
    if (options.cancelTargetSelection) {
      options.cancelTargetSelection();
      return;
    }
    options.runtime.cancelTargetSelection();
    options.setDirectorState(commandPromptState(options.runtime.snapshot()));
    options.render();
  }));
  return menu;
}

function targetPrompt(snapshot: BattleSnapshot, terms: ResolvedTerms): HTMLElement {
  const prompt = document.createElement("div");
  prompt.className = "battle-target-prompt";
  prompt.dataset.testid = "battle-target-prompt";
  const actor = activeActor(snapshot);
  const selectedId = snapshot.targetSelection?.selectedTargetId ?? snapshot.targetSelection?.targetIds[0];
  const selected = snapshot.targetSelection?.side === "actor"
    ? snapshot.actors.find((entry) => entry.id === selectedId || entry.recordId === selectedId)
    : snapshot.enemies.find((entry) => entry.id === selectedId);
  prompt.textContent = selected
    ? `${terms.target}: ${selected.name}`
    : actor
      ? `${actor.name}: ${terms.target}을 선택`
      : `${terms.target} 선택`;
  return prompt;
}


function strictFlowStatus(snapshot: BattleSnapshot): HTMLElement {
  const status = document.createElement("div");
  status.className = "battle-flow-status battle-flow-status-strict";
  status.dataset.testid = "battle-strict-flow-status";
  const total = snapshot.strictPendingActorIds.length + snapshot.strictQueuedActorIds.length;
  status.textContent = `ROUND ${Math.max(1, snapshot.strictRound)} · 명령 ${snapshot.strictQueuedActorIds.length + 1}/${Math.max(1, total)}`;
  return status;
}

function keyPrompts(): HTMLElement {
  const prompt = document.createElement("div");
  prompt.className = "battle-key-prompts";
  prompt.textContent = "방향키 선택 · Enter/Z 확인 · Esc/X/C 취소";
  return prompt;
}

function commandButton(
  label: string,
  testId: string,
  icon: string,
  detail: string,
  onClick: () => void,
  inert = false,
  disabledReason?: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "battle-command";
  button.dataset.testid = testId;
  button.dataset.commandIcon = icon;
  if (inert) {
    button.dataset.previewOnly = "true";
    button.disabled = true;
    const reason = disabledReason || detail || "현재 사용할 수 없습니다.";
    button.title = reason;
    button.setAttribute("aria-label", `${label}: ${reason}`);
  }
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
  if (!inert) button.addEventListener("click", onClick);
  return button;
}
