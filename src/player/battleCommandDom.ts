import type {
  ActorCommand,
  BattleBattlerSnapshot,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { commandPromptState, type BattleDirectorState } from "@/player/battleDirectorDom";
import { store } from "@/project/store";
import type { ItemId, SkillId } from "@/project/types";
import {
  activeActor,
  enemyWeaknesses,
  escapeSuccessChance,
  predictAttackDamage,
  predictSkillDamageFor,
  primaryAttackSkill,
} from "@/battle/battlePredict";

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
  panel.append(activeActorCard(snapshot));

  if (snapshot.phase === "targetSelect") {
    panel.append(targetPrompt(snapshot));
    panel.append(commandGrid(snapshot, options, true));
    panel.append(targetSelectionMenu(snapshot, options));
    panel.append(keyPrompts());
    return panel;
  }
  if (snapshot.phase !== "actorCommand") return panel;

  panel.append(commandGrid(snapshot, options, false));
  panel.append(commandHelp(snapshot));
  return panel;
}

// 커맨드 도움말: 가짜 안내 대신 현재 대상 적의 실제 속성 약점을 알려준다.
function commandHelp(snapshot: BattleSnapshot): HTMLElement {
  const help = document.createElement("div");
  help.className = "battle-command-help";
  help.dataset.testid = "battle-command-help";
  const project = store.getCurrent();
  const enemy = snapshot.enemies.find((entry) => entry.id === snapshot.targetSelection?.selectedEnemyId)
    ?? snapshot.enemies.find((entry) => !entry.defeated);
  const weaknesses = enemy ? enemyWeaknesses(project, enemy.recordId) : [];
  if (weaknesses.length > 0) {
    help.textContent = `${weaknesses.map((weakness) => weakness.name).join(", ")} 속성 약점 적 발견`;
  } else if (enemy) {
    help.textContent = "통상 공격으로 대응 가능한 적";
  } else {
    help.textContent = "대상을 선택하십시오";
  }
  return help;
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
    menu.append(...itemSubmenu(options));
    return menu;
  }

  const project = store.getCurrent();
  const focusEnemy = snapshot.enemies.find((enemy) => enemy.id === snapshot.targetSelection?.selectedEnemyId)
    ?? snapshot.enemies.find((enemy) => !enemy.defeated);
  const firstItem = battleItems()[0];

  menu.append(commandButton("공격", "actor-command-attack", "sword", attackDetail(project, actor, focusEnemy), () => {
    options.beginTargetCommand({ kind: "attack" });
  }, targetMode));
  menu.append(commandButton("스킬", "actor-command-skill", "fire", skillDetail(project, actor, focusEnemy), () => {
    const skills = usableSkills(actor);
    if (skills.length === 1) {
      options.beginTargetCommand({ kind: "skill", skillId: skills[0] });
      return;
    }
    options.setSubmenu("skill");
    options.render();
  }));
  menu.append(commandButton("방어", "actor-command-defend", "shield", "받는 피해 절반", () => {
    if (!targetMode) options.runActorCommand({ kind: "defend" });
  }, targetMode));
  if (firstItem) {
    menu.append(commandButton("회복 아이템", "actor-command-recover", "cross", itemDetail(project, firstItem.itemId), () => {
      if (!targetMode && firstItem) options.beginTargetCommand({ kind: "item", itemId: firstItem.itemId });
    }, targetMode));
  }
  menu.append(commandButton("아이템", "actor-command-item", "bag", `보유 ${battleItems().length}종`, () => {
    if (targetMode || battleItems().length === 0) return;
    options.setSubmenu("item");
    options.render();
  }, targetMode));
  menu.append(commandButton("도주", "actor-command-escape", "boot", escapeDetail(project, snapshot), () => {
    if (!targetMode) options.runActorCommand({ kind: "escape" });
  }, targetMode));
  return menu;
}

// 통상 공격의 예측 피해(대상 적 기준). 대상이 없으면 보류 표시.
function attackDetail(project: ReturnType<typeof store.getCurrent>, actor: BattleBattlerSnapshot | undefined, enemy: BattleBattlerSnapshot | undefined): string {
  if (!actor || !enemy) return "대상을 선택";
  const damage = predictAttackDamage(project, actor, enemy);
  return `예상 ${Math.max(0, damage)} 피해`;
}

// 주 공격 스킬의 예측 피해(대상 적 기준). 약점이면 표시.
function skillDetail(project: ReturnType<typeof store.getCurrent>, actor: BattleBattlerSnapshot | undefined, enemy: BattleBattlerSnapshot | undefined): string {
  if (!actor) return "스킬 선택";
  const skills = usableSkills(actor);
  if (skills.length === 0) return "사용 가능 스킬 없음";
  const skill = primaryAttackSkill(project, actor);
  if (!skill || !enemy) return `${skills.length}개 스킬 보유`;
  const predicted = predictSkillDamageFor(project, actor, skill, enemy);
  const prefix = predicted.weak ? "약점 " : predicted.resistant ? "내성 " : "";
  return `${prefix}예상 ${Math.max(0, predicted.amount)} 피해`;
}

// 회복 아이템의 예상 회복량.
function itemDetail(project: ReturnType<typeof store.getCurrent>, itemId: ItemId): string {
  const item = project.database.items.find((record) => record.id === itemId);
  if (!item?.skillId) return "아이템 사용";
  const skill = project.database.skills.find((record) => record.id === item.skillId);
  if (!skill) return "아이템 사용";
  if (skill.effect.kind === "healing") return `HP ${skill.power} 회복`;
  return item.name;
}

// 도주 성공 확률(0~1 → 퍼센트).
function escapeDetail(project: ReturnType<typeof store.getCurrent>, snapshot: BattleSnapshot): string {
  const chance = escapeSuccessChance(project, snapshot);
  if (chance <= 0) return "도주 불가";
  return `성공률 ${Math.round(chance * 100)}%`;
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

function battleItems(): { itemId: ItemId; name: string; count: number }[] {
  const project = store.getCurrent();
  const inventory = project.session.inventory;
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
  const enemy = snapshot.enemies.find((entry) => entry.id === snapshot.targetSelection?.selectedEnemyId)
    ?? snapshot.enemies.find((entry) => !entry.defeated);
  for (const skillId of usableSkills(actor)) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    const detail = skill && actor && enemy
      ? skillDetailFor(project, actor, skill, enemy)
      : skill && actor ? mpDetail(project, skillId) : "스킬 사용";
    nodes.push(commandButton(skill?.name ?? skillId, `actor-skill-${skillId}`, "fire", detail, () => {
      options.beginTargetCommand({ kind: "skill", skillId });
    }));
  }
  nodes.push(submenuBackButton(options));
  return nodes;
}

// 스킬 한 개의 예측 피해(대상 적) + MP 소비.
function skillDetailFor(
  project: ReturnType<typeof store.getCurrent>,
  actor: BattleBattlerSnapshot,
  skill: { id: SkillId; name: string; power: number; effect: { kind: string }; elementId?: string },
  enemy: BattleBattlerSnapshot
): string {
  const mp = mpDetail(project, skill.id);
  const fullSkill = project.database.skills.find((record) => record.id === skill.id);
  if (!fullSkill) return mp;
  if (fullSkill.effect.kind === "healing") return `HP ${fullSkill.power} 회복 ${mp}`;
  if (fullSkill.effect.kind === "support" || fullSkill.effect.kind === "switch") return `보조 ${mp}`;
  const predicted = predictSkillDamageFor(project, actor, fullSkill, enemy);
  const prefix = predicted.weak ? "약점 " : predicted.resistant ? "내성 " : "";
  return `${prefix}${Math.max(0, predicted.amount)} 피해 ${mp}`;
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

function itemSubmenu(options: BattleCommandPanelOptions): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = "아이템";
  const nodes: HTMLElement[] = [header];
  for (const item of battleItems()) {
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

function activeActorCard(snapshot: BattleSnapshot): HTMLElement {
  const actor = activeActor(snapshot) ?? snapshot.actors[0];
  const card = document.createElement("section");
  card.className = "battle-active-actor-card";
  card.dataset.testid = "battle-active-actor-card";
  if (!actor) {
    card.textContent = "행동 대기";
    return card;
  }
  const name = document.createElement("h3");
  const project = store.getCurrent();
  const actorRecord = project.database.actors.find((record) => record.id === actor.recordId);
  name.textContent = actorRecord?.nickname ? `${actor.name} ${actorRecord.nickname}` : actor.name;
  const portrait = document.createElement("div");
  portrait.className = "battle-actor-portrait";
  const portraitResource = actorPortraitResource(actor.recordId);
  if (portraitResource) {
    portrait.dataset.portraitKind = portraitResource.kind;
    portrait.style.backgroundImage = `url("${portraitResource.url}")`;
    portrait.style.backgroundPosition = portraitResource.kind === "singleFace" ? "50% 18%" : "0 0";
    portrait.style.backgroundRepeat = "no-repeat";
    portrait.style.backgroundSize = portraitResource.kind === "singleFace" ? "cover" : "400% 400%";
  }
  const stats = document.createElement("div");
  stats.className = "battle-actor-card-stats";
  stats.append(
    statLine("HP", actor.hp, actor.maxHp, "hp"),
    statLine("MP", actor.mp, actor.maxMp, "mp"),
    statLine("TP", Math.round(actor.gauge), 100, "tp")
  );
  const desc = document.createElement("p");
  desc.className = "battle-actor-card-desc";
  const className = project.database.classes?.find((record) => record.id === actorRecord?.classId)?.name;
  desc.textContent = className ? `클래스: ${className}` : `스킬 ${usableSkills(actor).length}개 보유`;
  card.append(name, portrait, stats, desc);
  return card;
}

type ActorPortraitResource = {
  readonly url: string;
  readonly kind: "singleFace" | "faceSheet";
};

function actorPortraitResource(actorId: string): ActorPortraitResource | null {
  const project = store.getCurrent();
  const actor = project.database.actors.find((record) => record.id === actorId);
  const generatedFaceUrl = resolveAssetResourceUrl(generatedFaceResourceId(actor?.battleCharacterResourceId), { project });
  if (generatedFaceUrl) return { url: generatedFaceUrl, kind: "faceSheet" };
  const faceSheetUrl = resolveAssetResourceUrl(actor?.faceResourceId, { project });
  if (faceSheetUrl) return { url: faceSheetUrl, kind: "faceSheet" };
  const battleSpriteUrl = resolveAssetResourceUrl(actor?.battleCharacterResourceId, { project });
  return battleSpriteUrl ? { url: battleSpriteUrl, kind: "singleFace" } : null;
}

function generatedFaceResourceId(battleCharacterResourceId: string | undefined): string | undefined {
  switch (battleCharacterResourceId) {
    case "generated-actor-hero-01-battle":
      return "generated-actor-hero-01-face";
    case "generated-actor-hero-02-battle":
      return "generated-actor-hero-02-face";
    default:
      return undefined;
  }
}

function statLine(labelText: string, value: number, max: number, kind: "hp" | "mp" | "tp"): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-actor-card-stat";
  const label = document.createElement("span");
  label.textContent = labelText;
  const amount = document.createElement("span");
  amount.textContent = `${value}/${max}`;
  const bar = document.createElement("span");
  bar.className = `battle-stat-bar battle-stat-bar-${kind}`;
  bar.style.setProperty("--battle-stat", `${Math.max(0, Math.min(100, Math.round(value / Math.max(1, max) * 100)))}%`);
  row.append(label, amount, bar);
  return row;
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
  const small = document.createElement("small");
  small.textContent = detail;
  text.append(title, small);
  button.append(iconNode, text);
  button.addEventListener("click", onClick);
  return button;
}
