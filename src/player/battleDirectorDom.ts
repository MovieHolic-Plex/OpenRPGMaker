import type { ActorCommand, BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { activeActor } from "@/battle/battlePredict";
import { store } from "@/project/store";

export type BattleDirectorStep = "command" | "target" | "acting" | "impact" | "result";

export interface BattleDirectorState {
  readonly step: BattleDirectorStep;
  readonly lines: readonly string[];
  readonly activeActorRecordId?: string;
  readonly targetId?: string;
}

export function initialBattleDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  return commandPromptState(snapshot, "전투가 시작되었습니다.");
}

export function commandPromptState(snapshot: BattleSnapshot, openingLine?: string): BattleDirectorState {
  const actor = activeActor(snapshot);
  return {
    step: "command",
    lines: [
      openingLine ?? "명령을 선택하십시오.",
      actor ? `${actor.name}: 행동을 선택하십시오.` : "게이지가 차는 중입니다.",
    ],
    activeActorRecordId: actor?.recordId,
  };
}

export function actorCommandDirectorState(
  command: ActorCommand,
  before: BattleSnapshot,
  after: BattleSnapshot
): BattleDirectorState {
  const actor = activeActor(before);
  const target = commandTarget(command, before, after);
  const impact = enemyHpDelta(target?.id, before, after);
  // 런타임이 기록한 직전 행동 결과(hit/miss/critical)로 빗맞음/크리 표시.
  const result = after.lastActionResult;
  const lines = [
    commandLine(command, actor),
    impactLine(command, target, impact, result),
  ];
  return {
    step: impact > 0 ? "impact" : "acting",
    lines,
    activeActorRecordId: actor?.recordId,
    targetId: target?.id,
  };
}

// 행동 결과 메시지. miss/critical/heal/0피해를 실제 결과에 기반해 표시.
function impactLine(
  command: ActorCommand,
  target: BattleBattlerSnapshot | undefined,
  impact: number,
  result: BattleSnapshot["lastActionResult"]
): string {
  if (command.kind === "defend") return "받는 피해를 줄일 준비를 마쳤다.";
  if (command.kind === "escape") return "전장에서 벗어나려 한다.";
  if (result && !result.hit) return "공격이 빗나갔다!";
  if (result && result.critical && impact > 0) return `급소에 맞았다! ${target?.name ?? "적"}에게 ${impact} 피해!`;
  if (impact > 0) return `${target?.name ?? "적"}에게 ${impact} 피해!`;
  // 회복/서포트이거나 데미지 0
  return "효과가 충분하지 않았다.";
}

export function targetSelectDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const actor = activeActor(snapshot);
  const selectedEnemy = snapshot.enemies.find((enemy) => enemy.id === snapshot.targetSelection?.selectedEnemyId)
    ?? snapshot.enemies.find((enemy) => snapshot.targetSelection?.targetEnemyIds.includes(enemy.id));
  return {
    step: "target",
    lines: [
      actor ? `${actor.name}: 대상을 선택하십시오.` : "대상을 선택하십시오.",
      selectedEnemy ? `${selectedEnemy.name}을 겨냥하고 있습니다.` : "선택 가능한 적이 없습니다.",
    ],
    activeActorRecordId: actor?.recordId,
    targetId: selectedEnemy?.id,
  };
}

export function resultDirectorState(snapshot: BattleSnapshot, previous: BattleDirectorState): BattleDirectorState {
  if (!snapshot.result) return previous;
  return {
    step: "result",
    lines: [resultLine(snapshot.result), rewardsLine(snapshot)],
    activeActorRecordId: previous.activeActorRecordId,
    targetId: previous.targetId,
  };
}

export function battleMessageWindow(state: BattleDirectorState): HTMLElement {
  const windowNode = document.createElement("div");
  windowNode.className = "battle-message-window";
  windowNode.dataset.testid = "battle-message-window";
  windowNode.dataset.battleDirectorStep = state.step;

  const cursor = document.createElement("span");
  cursor.className = "battle-message-cursor";
  cursor.textContent = ">";
  windowNode.append(cursor);

  const lines = document.createElement("div");
  lines.className = "battle-message-lines";
  for (const line of state.lines) {
    const row = document.createElement("div");
    row.className = "battle-message-line";
    row.textContent = line;
    lines.append(row);
  }
  windowNode.append(lines);
  return windowNode;
}

export function battleResultPanel(snapshot: BattleSnapshot): HTMLElement | undefined {
  if (!snapshot.result) return undefined;
  const panel = document.createElement("div");
  panel.className = "battle-result-panel";
  panel.dataset.testid = "battle-result-panel";
  panel.dataset.battleResult = snapshot.result;

  const crest = document.createElement("div");
  crest.className = "battle-result-crest";
  crest.setAttribute("aria-hidden", "true");

  const title = document.createElement("div");
  title.className = "battle-result-title";
  title.textContent = resultLine(snapshot.result);

  const cards = document.createElement("div");
  cards.className = "battle-result-cards battle-result-rewards";
  cards.dataset.testid = "battle-result-cards";
  for (const row of rewardRows(snapshot)) {
    const item = document.createElement("div");
    item.className = "battle-result-reward-card battle-result-reward-row";
    const icon = document.createElement("span");
    icon.className = `battle-result-reward-icon battle-result-reward-icon-${row.kind}`;
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "battle-result-reward-label";
    label.textContent = row.label;
    const value = document.createElement("strong");
    value.className = "battle-result-reward-value";
    value.textContent = row.value;
    item.append(label, icon, value);
    cards.append(item);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "battle-result-confirm";
  button.textContent = "확인";

  const progress = document.createElement("div");
  progress.className = "battle-result-progress";
  progress.dataset.testid = "battle-result-progress";
  progress.append(partyStatusBlock(snapshot), nextObjectiveBlock(snapshot));

  const prompt = document.createElement("div");
  prompt.className = "battle-result-next-prompt";
  prompt.textContent = "클릭하여 계속";

  panel.append(crest, title, cards, button, progress, prompt);
  return panel;
}

// 파티 생존 상황 블록. 가짜 "월드 상태" 대신 실제 전투 후 파티 상태를 표시.
function partyStatusBlock(snapshot: BattleSnapshot): HTMLElement {
  const block = document.createElement("section");
  block.className = "battle-result-world-state";
  const icon = document.createElement("span");
  icon.className = "battle-result-progress-icon battle-result-progress-icon-world";
  icon.setAttribute("aria-hidden", "true");
  const body = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "파티 상태";
  const alive = snapshot.actors.filter((actor) => !actor.defeated).length;
  const total = snapshot.actors.length;
  const text = document.createElement("span");
  text.textContent = `생존 ${alive}/${total}`;
  const bar = document.createElement("span");
  bar.className = "battle-result-progress-bar";
  bar.style.setProperty("--battle-result-ratio", `${total > 0 ? Math.round((alive / total) * 100) : 0}%`);
  body.append(title, text, bar);
  block.append(icon, body);
  return block;
}

// 다음 안내 블록. 결과(victory/defeat/escape)에 따른 실제 안내만 표시. 가짜 퀘스트 없음.
function nextObjectiveBlock(snapshot: BattleSnapshot): HTMLElement {
  const block = document.createElement("section");
  block.className = "battle-result-next-objective";
  block.dataset.testid = "battle-result-next-objective";
  const icon = document.createElement("span");
  icon.className = "battle-result-progress-icon battle-result-progress-icon-next";
  icon.setAttribute("aria-hidden", "true");
  const body = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "다음";
  const text = document.createElement("span");
  text.textContent = nextObjectiveText(snapshot);
  body.append(title, text);
  block.append(icon, body);
  return block;
}

function nextObjectiveText(snapshot: BattleSnapshot): string {
  switch (snapshot.result) {
    case "victory":
      return "전리품을 확보했다";
    case "defeat":
      return "파티를 재정비하자";
    case "escape":
      return "안전하게 이탈했다";
    default:
      return "전투를 계속한다";
  }
}

export function applyBattleDirectorState(
  root: HTMLElement,
  state: BattleDirectorState,
  snapshot: BattleSnapshot
): void {
  root.dataset.battleDirectorStep = state.step;
  root.dataset.battlePhase = snapshot.phase;
  root.classList.toggle("battle-has-result", Boolean(snapshot.result));
  markByDataset(root, "recordId", state.activeActorRecordId, "battle-acting");
  markByDataset(root, "testid", state.targetId, "battle-targeted");
}

function commandTarget(
  command: ActorCommand,
  before: BattleSnapshot,
  after: BattleSnapshot
): BattleBattlerSnapshot | undefined {
  switch (command.kind) {
    case "attack":
    case "skill":
    case "item":
      return after.enemies.find((enemy) => enemy.id === command.targetEnemyId)
        ?? before.enemies.find((enemy) => enemy.id === command.targetEnemyId);
    case "defend":
    case "escape":
      return undefined;
  }
}

function commandLine(command: ActorCommand, actor: BattleBattlerSnapshot | undefined): string {
  const actorName = actor?.name ?? "아군";
  switch (command.kind) {
    case "attack":
      return `${actorName}의 공격!`;
    case "skill":
      return `${actorName}이 ${skillName(command.skillId)}을 사용했다!`;
    case "item":
      return `${actorName}이 ${itemName(command.itemId)}을 사용했다!`;
    case "defend":
      return `${actorName}이 방어 태세를 취했다.`;
    case "escape":
      return `${actorName}이 후퇴를 시도했다.`;
  }
}

function enemyHpDelta(enemyId: string | undefined, before: BattleSnapshot, after: BattleSnapshot): number {
  if (!enemyId) return 0;
  const beforeEnemy = before.enemies.find((enemy) => enemy.id === enemyId);
  const afterEnemy = after.enemies.find((enemy) => enemy.id === enemyId);
  if (!beforeEnemy || !afterEnemy) return 0;
  return Math.max(0, beforeEnemy.hp - afterEnemy.hp);
}

function resultLine(result: BattleSnapshot["result"]): string {
  switch (result) {
    case "victory":
      return "승리";
    case "defeat":
      return "패배했습니다";
    case "escape":
      return "무사히 후퇴했다";
    case undefined:
      return "";
  }
}

function rewardsLine(snapshot: BattleSnapshot): string {
  if (snapshot.result !== "victory") return "전투가 종료되었습니다.";
  const itemCount = snapshot.rewards.items.length;
  return `경험치 ${snapshot.rewards.exp} / 골드 ${snapshot.rewards.gold} / 아이템 ${itemCount}`;
}

function rewardRows(snapshot: BattleSnapshot): readonly { readonly kind: string; readonly label: string; readonly value: string }[] {
  if (snapshot.result !== "victory") return [{ kind: "result", label: "결과", value: "전투 종료" }];
  const rows: { kind: string; label: string; value: string }[] = [
    { kind: "exp", label: "경험치", value: `+${snapshot.rewards.exp}` },
    { kind: "gold", label: "골드", value: `+${snapshot.rewards.gold}` },
  ];
  // 획득한 아이템이 있으면 실제 이름으로, 없으면 행을 추가하지 않는다(거짓 표시 금지).
  for (const itemId of snapshot.rewards.items) {
    rows.push({ kind: "item", label: "아이템", value: itemName(itemId) });
  }
  return rows;
}

function skillName(skillId: string): string {
  return store.getCurrent().database.skills.find((skill) => skill.id === skillId)?.name ?? skillId;
}

function itemName(itemId: string): string {
  return store.getCurrent().database.items.find((item) => item.id === itemId)?.name ?? itemId;
}

function markByDataset(root: HTMLElement, key: string, value: string | undefined, className: string): void {
  if (!value) return;
  const nodes = root.querySelectorAll<HTMLElement>(`[data-${kebabCase(key)}]`);
  for (const node of nodes) {
    if (node.dataset[key] === value) node.classList.add(className);
  }
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
