import type {
  ActorCommand,
  BattleBattlerSnapshot,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { commandPromptState, type BattleDirectorState } from "@/player/battleDirectorDom";
import { disambiguatedBattlerName, hpBarState } from "@/player/battleFieldDom";
import type { BattlePresentationLedger } from "@/player/battlePresentation";
import { store } from "@/project/store";
import type { ItemId, SkillId } from "@/project/types";
import { resolveTerms, type ResolvedTerms } from "@/project/terms";
import { activeActor } from "@/battle/battlePredict";
import { battleCommandsForActor, type RuntimeBattleCommand } from "@/battle/battleCommands";
import { battleSkillMpCost, battleSkillUseFailure, battleSkillUseFailureLabel } from "@/battle/battleSkillUse";
import { targetScopeForCommand } from "@/battle/battleTargetResolver";
import { BATTLE_KEY_PROMPT } from "@/player/keyBindings";
import { mountBattleCommandCss } from "@/project/battleCommandCss";

export type BattleCommandSubmenu =
  | { readonly kind: "skill"; readonly command: RuntimeBattleCommand }
  | { readonly kind: "pokemonFight" }
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
  mountBattleCommandCss(panel, store.getCurrent().system.battleCommandCss ?? "");
  const terms = resolveTerms(store.getCurrent());
  // 누구의 차례인지 — 스킨이 `attr(data-actor-name)` 으로 카드 위 턴 칩을 그린다(rm2000).
  // 4인 파티에서 파티 카드의 강조 행만으로는 명령 카드와 시선이 멀어 "지금 누가 고르는지" 가
  // 한눈에 안 들어왔다. 데이터 속성이라 다른 스킨·테스트에는 영향이 없다.
  const activeActor = snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId);
  if (activeActor) panel.dataset.actorName = activeActor.name;

  if (snapshot.phase === "targetSelect") {
    panel.setAttribute("aria-label", terms.target);
    // 적 대상 선택도 하단 패널에 대상 메뉴를 유지한다. 예전에는 패널을 통째로 비워
    // ("field" 표시) 하단 밴드가 빈 화면이 됐고, 어느 적이 선택됐는지 읽을 곳이 없었다.
    panel.dataset.targetPresentation = "menu";
    panel.append(targetPrompt(snapshot, terms));
    const targetMenu = targetSelectionMenu(snapshot, options, terms);
    targetMenu.append(targetCancelButton(options, terms));
    attachScrollCue(targetMenu);
    panel.append(targetMenu);
    panel.append(keyPrompts());
    return panel;
  }
  if (snapshot.phase !== "actorCommand") return panel;

  if (snapshot.battleFlow === "strict") panel.append(strictFlowStatus(snapshot));
  const menu = commandGrid(snapshot, options, false);
  // 뒤로/취소는 메뉴의 마지막 항목이다. 패널의 형제로 두면 패널 그리드에 암시적 행이
  // 생기고 그 행이 남은 높이를 전부 가져가 메뉴 행(1fr)이 0px 로 굶는다(실측:
  // panelRows "0px 13.5px 106.5px", 메뉴 clientHeight 0). 그래서 메뉴 안에 넣는다.
  if (options.submenu && !(options.submenu.kind === "switch" && snapshot.forcedSwitchActorId)) {
    menu.append(submenuBackButton(options, terms));
  }
  attachScrollCue(menu);
  panel.append(menu);
  panel.append(keyPrompts());
  return panel;
}

/**
 * 스크롤 가능한 커맨드 메뉴(4행 스크롤포트) 아래에 항목이 더 있으면 "▾" 신호를 띄운다.
 * sticky + bottom:0 이라 잘린 동안은 뷰포트 하단에 떠 있다가, 끝까지 스크롤하면 마지막
 * 행 자리에 도킹된다. 도주/교체가 카드 밖에 잘려 존재 자체가 안 보이던 문제
 * (실플레이 11판 적대 리뷰)를 막는다. 스크롤이 없는 스킨에서는 hidden 처리된다.
 */
function attachScrollCue(menu: HTMLElement): void {
  const cue = document.createElement("div");
  cue.className = "battle-command-scroll-cue";
  cue.setAttribute("aria-hidden", "true");
  cue.dataset.testid = "battle-command-scroll-cue";
  cue.textContent = "▾";
  cue.hidden = true;
  menu.append(cue);
  const syncCue = (): void => {
    if (!menu.isConnected) return;
    cue.hidden = menu.scrollHeight - menu.clientHeight <= 1;
  };
  // 패널은 detached 상태로 만들어져 같은 태스크에서 DOM 에 붙는다 — 마이크로태스크면
  // 붙은 뒤 레이아웃을 읽을 수 있다. rAF 는 fake-timer 환경에서 타이머 누수로 잡힌다.
  queueMicrotask(syncCue);
  // 끝까지 스크롤되면(키보드 커서 이동이 scrollIntoView 를 부른다) 신호를 거둔다.
  menu.addEventListener("scroll", syncCue);
}

export function enemyListPanel(snapshot: BattleSnapshot): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "battle-enemy-list-panel";
  panel.append(enemyNameList(snapshot.enemies));
  return panel;
}

/** 표준 커맨드 종류는 클래스에 적힌 이름 대신 프로젝트 용어를 쓴다.
 *  예전에는 attack/skill/item 만 용어를 타고 defend/escape/capture 는 `command.name` 이라
 *  영어 용어 + 한글 방어/도주가 한 메뉴에 섞였다(실측: Attack / Skill / Item / 방어 / 도주). */
export function battleCommandKindLabel(command: RuntimeBattleCommand, terms: ResolvedTerms): string {
  const normalizedName = command.name.trim().toLowerCase();
  switch (command.kind) {
    case "attack":
      return terms.attack;
    case "skill":
      return command.id === "cmd_skill"
        || normalizedName === "skill"
        || normalizedName === "스킬"
        || normalizedName === "기술"
        ? terms.skill
        : command.name;
    case "item":
      return command.id === "cmd_item"
        || normalizedName === "item"
        || normalizedName === "아이템"
        ? terms.item
        : command.name;
    case "defend":
      return terms.defend;
    case "escape":
      return terms.escape;
    case "capture":
      return terms.capture;
    default:
      return command.name;
  }
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
  if (options.submenu?.kind === "pokemonFight") {
    menu.append(...pokemonFightSubmenu(snapshot, options));
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
  if (isPokemonMonsterActor(project, actor) && !snapshot.forcedSwitchActorId) {
    menu.append(...pokemonRootCommands(snapshot, options, targetMode));
    return menu;
  }
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

function isPokemonMonsterActor(
  project: ReturnType<typeof store.getCurrent>,
  actor: BattleBattlerSnapshot | undefined,
): actor is BattleBattlerSnapshot & { readonly monsterInstanceId: string } {
  return project.system.battleUiStyle === "pokemon" && Boolean(actor?.monsterInstanceId);
}

function pokemonRootCommands(
  snapshot: BattleSnapshot,
  options: BattleCommandPanelOptions,
  targetMode: boolean,
): HTMLElement[] {
  const switches = switchCandidates(snapshot);
  const items = battleItems(snapshot);
  const balls = captureItems(snapshot);
  return [
    commandButton("Fight", "actor-command-fight", "fire", "", () => {
      if (targetMode) return;
      options.setSubmenu({ kind: "pokemonFight" });
      options.render();
    }, targetMode),
    commandButton("PKMN", "actor-command-pkmn", "switch", switches.length > 0 ? `${switches.length}명` : "없음", () => {
      if (targetMode || switches.length === 0) return;
      options.setSubmenu({ kind: "switch" });
      options.render();
    }, targetMode || switches.length === 0),
    commandButton("Item", "actor-command-item", "bag", items.length + balls.length > 0 ? `${items.length + balls.length}종` : "없음", () => {
      if (targetMode || items.length + balls.length === 0) return;
      options.setSubmenu({ kind: "item" });
      options.render();
    }, targetMode || items.length + balls.length === 0),
    commandButton("Run", "actor-command-run", "boot", "", () => {
      if (!targetMode) options.runActorCommand({ kind: "escape" });
    }, targetMode || !snapshot.canEscape),
  ];
}

function commandControl(
  snapshot: BattleSnapshot,
  options: BattleCommandPanelOptions,
  command: RuntimeBattleCommand,
  actor: BattleBattlerSnapshot | undefined,
  targetMode: boolean
): HTMLElement {
  const terms = resolveTerms(store.getCurrent());
  const label = battleCommandKindLabel(command, terms);
  switch (command.kind) {
    case "attack": {
      // gen1 모델에서 사용 가능한 기술이 남아 있으면 통상 공격은 런타임이 거부한다
      // (Struggle 폴백 전용). 예전에는 버튼이 살아 있어 대상까지 고른 뒤 조용히
      // 무시됐다 — pokemon 스킨의 Fight 와 같은 의미로 비활성 + 사유를 표시한다.
      const project = store.getCurrent();
      const gen1Blocked = project.system.battleModel === "gen1"
        && actor != null
        && actor.skillIds.some((skillId) => !battleSkillUseFailure(project, actor, skillId));
      return commandButton(label, commandTestId(command), "sword", "", () => {
        if (!targetMode) options.beginTargetCommand({ kind: "attack" });
      }, targetMode || gen1Blocked,
        gen1Blocked ? "사용 가능한 기술이 있어 통상 공격을 쓸 수 없습니다." : undefined);
    }
    case "skill": {
      const skillIds = listedSkillIds(actor, command);
      const project = store.getCurrent();
      const usable = skillIds.filter((skillId) => actor && !battleSkillUseFailure(project, actor, skillId));
      const onlySkill = skillIds.length === 1 ? project.database.skills.find((skill) => skill.id === skillIds[0]) : undefined;
      const failure = onlySkill && actor ? battleSkillUseFailure(project, actor, onlySkill.id) : undefined;
      const reason = failure && actor ? battleSkillUseFailureLabel(failure, onlySkill, actor) : skillIds.length === 0 ? "사용 가능한 스킬이 없습니다." : undefined;
      return commandButton(label, commandTestId(command), "fire", skillIds.length === 0 ? "없음" : "", () => {
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
      return commandButton(label, commandTestId(command), "target", items.length > 0 ? `${items.length}종` : "없음", () => {
        if (targetMode || items.length === 0) return;
        options.setSubmenu({ kind: "capture" });
        options.render();
      }, targetMode || items.length === 0);
    }
    case "defend":
      return commandButton(label, commandTestId(command), "shield", "", () => {
        if (!targetMode) options.runActorCommand({ kind: "defend" });
      }, targetMode);
    case "escape":
      return commandButton(label, commandTestId(command), "boot", "", () => {
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
    list.append(enemyListRow(enemy, enemies));
  }
  return list;
}

export function syncEnemyListPanel(
  panel: HTMLElement,
  enemies: readonly BattleBattlerSnapshot[],
  ledger?: BattlePresentationLedger,
): void {
  const list = panel.querySelector<HTMLElement>(".battle-enemy-list");
  if (!list) return;
  for (const enemy of enemies) {
    let row = list.querySelector<HTMLElement>(`.battle-enemy-list-row[data-enemy-id="${enemy.id}"]`);
    if (!row) {
      list.append(enemyListRow(enemy, enemies));
      row = list.querySelector<HTMLElement>(`.battle-enemy-list-row[data-enemy-id="${enemy.id}"]`);
    }
    if (!row) continue;
    syncEnemyListName(row, enemy, enemies);
    const vitals = ledger?.vitalsFor(enemy.id);
    const shownHp = vitals ? vitals.hp : enemy.hp;
    const shownDefeated = vitals ? vitals.defeated : enemy.defeated;
    const hp = row.querySelector<HTMLElement>(".battle-enemy-list-hp");
    if (hp) hp.textContent = `HP ${shownHp}/${enemy.maxHp}`;
    const bar = row.querySelector<HTMLElement>(".battle-enemy-list-bar");
    if (bar) {
      const pct = Math.max(0, Math.min(100, Math.round(shownHp / Math.max(1, enemy.maxHp) * 100)));
      bar.style.setProperty("--battle-stat", `${pct}%`);
      bar.dataset.hpState = hpBarState(pct);
    }
    row.classList.toggle("defeated", shownDefeated);
  }
}

function enemyListRow(
  enemy: BattleBattlerSnapshot,
  enemies: readonly BattleBattlerSnapshot[],
): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-enemy-list-row";
  row.dataset.enemyId = enemy.id;
  const name = document.createElement("span");
  name.className = "battle-enemy-list-name";
  row.append(name);
  syncEnemyListName(row, enemy, enemies);
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
  row.append(hp, bar);
  if (enemy.defeated) row.classList.add("defeated");
  return row;
}

function syncEnemyListName(
  row: HTMLElement,
  enemy: BattleBattlerSnapshot,
  enemies: readonly BattleBattlerSnapshot[],
): void {
  const name = row.querySelector<HTMLElement>(".battle-enemy-list-name");
  if (!name) return;
  name.replaceChildren(document.createTextNode(disambiguatedBattlerName(enemy, enemies)));
  if (!enemy.level) return;
  const level = document.createElement("span");
  level.className = "battle-enemy-list-level";
  level.textContent = `Lv.${enemy.level}`;
  name.append(level);
}

// 동명 구분은 필드 이름표도 써야 해서 battleFieldDom(하위 계층)으로 내렸다.
// 여기서 다시 내보내 기존 소비자(battleDirectorDom·battleSequencer)의 경로를 유지한다.
export { disambiguatedBattlerName };

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
  // 메인 커맨드 버튼과 같은 용어 해석을 쓴다 — 버튼은 "스킬"인데 헤더만 "기술"로
  // 갈리던 명칭 불일치(적대 리뷰 §기타)의 수정 지점. 커스텀 서브셋 커맨드만 고유 이름 유지.
  const submenuCommand = options.submenu?.kind === "skill" ? options.submenu.command : undefined;
  const normalizedName = submenuCommand?.name.trim().toLowerCase();
  const isGenericSkillCommand = submenuCommand
    && (submenuCommand.id === "cmd_skill" || normalizedName === "skill" || normalizedName === "스킬" || normalizedName === "기술");
  header.textContent = submenuCommand && !isGenericSkillCommand ? submenuCommand.name : terms.skill;
  const nodes: HTMLElement[] = [header];
  const actor = activeActor(snapshot);
  const project = store.getCurrent();
  const command = options.submenu?.kind === "skill" ? options.submenu.command : undefined;
  for (const skillId of listedSkillIds(actor, command)) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    const failure = actor ? battleSkillUseFailure(project, actor, skillId) : "notLearned";
    const reason = failure && actor ? battleSkillUseFailureLabel(failure, skill, actor) : failure ? "사용자가 없습니다." : undefined;
    const detail = skill && actor ? skillMpDetail(project, skill, terms, actor) : "";
    const hint = skill && actor ? skillDetailFor(project, skill, terms, actor) : reason ?? terms.skill;
    const button = commandButton(skill?.name ?? skillId, `actor-skill-${skillId}`, "fire", detail, () => {
      options.beginTargetCommand({ kind: "skill", skillId });
    }, Boolean(reason), reason, hint);
    appendSkillTypeBadge(button, project, skill?.elementId);
    nodes.push(button);
  }
  return nodes;
}

function pokemonFightSubmenu(snapshot: BattleSnapshot, options: BattleCommandPanelOptions): HTMLElement[] {
  const header = document.createElement("div");
  header.className = "battle-submenu-header";
  header.textContent = "Fight";
  const nodes: HTMLElement[] = [header];
  const actor = activeActor(snapshot);
  const project = store.getCurrent();
  const moves = listedSkillIds(actor).slice(0, 4);
  const hasUsableMove = actor !== undefined
    && moves.some((skillId) => battleSkillUseFailure(project, actor, skillId) === undefined);
  if (!hasUsableMove) {
    nodes.push(commandButton("Struggle", "actor-command-struggle", "fire", "PP --", () => {
      options.beginTargetCommand({ kind: "attack" });
    }));
    return nodes;
  }
  for (const skillId of moves) {
    const skill = project.database.skills.find((record) => record.id === skillId);
    const useFailure = actor ? battleSkillUseFailure(project, actor, skillId) : "notLearned";
    const pp = skill?.maxPp === undefined
      ? undefined
      : Math.max(0, Math.min(skill.maxPp, Math.trunc(actor?.skillPp?.[skillId] ?? skill.maxPp)));
    const ppFailure = pp === 0 ? "PP가 없습니다." : undefined;
    const reason = ppFailure ?? (useFailure && actor
      ? battleSkillUseFailureLabel(useFailure, skill, actor)
      : useFailure ? "사용자가 없습니다." : undefined);
    const detail = skill?.maxPp === undefined ? "" : `PP ${pp}/${skill.maxPp}`;
    const button = commandButton(skill?.name ?? skillId, `actor-skill-${skillId}`, "fire", detail, () => {
      options.beginTargetCommand({ kind: "skill", skillId });
    }, Boolean(reason), reason);
    appendSkillTypeBadge(button, project, skill?.elementId);
    nodes.push(button);
  }
  return nodes;
}

/** 기술 타입(속성) 배지. elementId 가 없는 기술에는 아무것도 붙이지 않는다 — 무속성
 *  기술까지 "타입" 을 지어내면 상성 표시가 거짓이 된다. 표시 이름은 elements 레코드에서
 *  읽고(데모는 한글 타입명을 저작한다), 레코드가 없으면 id 를 그대로 보여준다. */
function appendSkillTypeBadge(
  button: HTMLButtonElement,
  project: ReturnType<typeof store.getCurrent>,
  elementId: string | undefined,
): void {
  if (!elementId) return;
  const label = (project.database.elements ?? []).find((record) => record.id === elementId)?.name ?? elementId;
  const badge = document.createElement("em");
  badge.className = "battle-command-tag";
  badge.dataset.skillType = elementId;
  badge.textContent = label;
  // 제목(strong) 다음, 상세(small) 앞. 상세 문장 안에 섞으면 배지로 읽히지 않는다.
  button.querySelector(".battle-command-text")?.querySelector("strong")?.after(badge);
}

function skillMpDetail(
  project: ReturnType<typeof store.getCurrent>,
  skill: { id: SkillId },
  terms: ResolvedTerms,
  actor: BattleBattlerSnapshot,
): string {
  const fullSkill = project.database.skills.find((record) => record.id === skill.id);
  if (!fullSkill) return "";
  return `${terms.mp} ${battleSkillMpCost(fullSkill, actor.maxMp)}`;
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
    const hint = [scopeLabel(scope), states].filter(Boolean).join(" · ");
    nodes.push(commandButton(`${item.name} x${item.count}`, `actor-item-${item.itemId}`, "bag", "", () => {
      options.beginTargetCommand({ kind: "item", itemId: item.itemId });
    }, false, undefined, hint || `${terms.item} 사용`));
  }
  if (isPokemonMonsterActor(project, activeActor(snapshot))) {
    for (const item of captureItems(snapshot)) {
      const detail = item.multiplier === 1 ? terms.capture : `x${item.multiplier}`;
      nodes.push(commandButton(`${item.name} x${item.count}`, `actor-capture-${item.itemId}`, "target", detail, () => {
        options.beginTargetCommand({ kind: "capture", captureItemId: item.itemId });
      }));
    }
  }
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
  return nodes;
}

function switchCandidates(snapshot: BattleSnapshot): BattleBattlerSnapshot[] {
  const candidateIds = new Set(snapshot.switchCandidateActorIds);
  return snapshot.reserveActors.filter((actor) => candidateIds.has(actor.recordId) && !actor.defeated);
}

function submenuBackButton(options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLElement {
  return commandButton(terms.back, "actor-command-back", "back", "", () => {
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
    const peers = snapshot.targetSelection?.side === "actor" ? snapshot.actors : snapshot.enemies;
    const button = commandButton(disambiguatedBattlerName(target, peers), `battle-target-${target.id}`, "target", `${terms.hp} ${target.hp}/${target.maxHp}`, () => {
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
  return menu;
}

function targetCancelButton(options: BattleCommandPanelOptions, terms: ResolvedTerms): HTMLButtonElement {
  return commandButton(terms.back, "battle-target-cancel", "back", "", () => {
    if (options.cancelTargetSelection) {
      options.cancelTargetSelection();
      return;
    }
    options.runtime.cancelTargetSelection();
    options.setDirectorState(commandPromptState(options.runtime.snapshot()));
    options.render();
  });
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
  const peers = snapshot.targetSelection?.side === "actor" ? snapshot.actors : snapshot.enemies;
  prompt.textContent = selected
    ? `${terms.target}: ${disambiguatedBattlerName(selected, peers)}`
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
  status.textContent = `명령 ${snapshot.strictQueuedActorIds.length + 1}/${Math.max(1, total)}`;
  return status;
}

function keyPrompts(): HTMLElement {
  const prompt = document.createElement("div");
  prompt.className = "battle-key-prompts";
  prompt.textContent = BATTLE_KEY_PROMPT;
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
  hint?: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "battle-command";
  button.dataset.testid = testId;
  button.dataset.commandIcon = icon;
  if (inert) {
    button.dataset.previewOnly = "true";
    button.disabled = true;
    const reason = disabledReason || hint || detail || "현재 사용할 수 없습니다.";
    button.setAttribute("aria-label", `${label}: ${reason}`);
  } else if (hint) {
    button.setAttribute("aria-label", `${label}: ${hint}`);
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
