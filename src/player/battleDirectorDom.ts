import type { ActorCommand, BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionResultSnapshot } from "@/battle/types";
import { withJosa } from "@/util/josa";
import { activeActor } from "@/battle/battlePredict";
import { store } from "@/project/store";

export type BattleDirectorStep = "intro" | "command" | "target" | "acting" | "impact" | "result";

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
      openingLine ?? (actor ? `${withJosa(actor.name, "은/는")} 무엇을 할까?` : "게이지가 차는 중입니다."),
    ],
    activeActorRecordId: actor?.recordId,
  };
}

/** 인카운트 인트로 배너 — "야생의 ○○이(가) 나타났다!" */
export function introDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const names = snapshot.enemies.filter((enemy) => !enemy.defeated).map((enemy) => enemy.name);
  const label = names.length > 1 ? `${names.slice(0, -1).join(", ")}, ${names[names.length - 1]}` : names[0] ?? "적";
  return {
    step: "intro",
    lines: [`${withJosa(label, "이/가")} 나타났다!`],
    activeActorRecordId: snapshot.activeActorId,
  };
}

/** 행동 로그 엔트리 하나를 이름이 드러나는 메시지로 변환(다중 적 턴 개별 연출용). */
export function enemyActionDirectorState(entry: BattleActionResultSnapshot, snapshot: BattleSnapshot): BattleDirectorState {
  const user = snapshot.enemies.find((enemy) => enemy.recordId === entry.userRecordId)
    ?? snapshot.actors.find((actor) => actor.recordId === entry.userRecordId);
  const target = snapshot.actors.find((actor) => actor.id === entry.targetId)
    ?? snapshot.enemies.find((enemy) => enemy.id === entry.targetId);
  const userName = user?.name ?? "적";
  const action = entry.skillName
    ? `${withJosa(userName, "이/가")} ${withJosa(entry.skillName, "을/를")} 사용했다!`
    : `${userName}의 공격!`;
  const impact = !entry.hit
    ? "공격이 빗나갔다!"
    : entry.amount > 0
      ? `${withJosa(target?.name ?? "대상", "이(가)")} ${entry.amount} 피해를 입었다!${entry.critical ? " 급소다!" : ""}`
      : "효과가 충분하지 않았다.";
  return {
    step: "acting",
    lines: [action, impact],
    activeActorRecordId: undefined,
    targetId: entry.targetId,
  };
}

export function chargingDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const readyActor = snapshot.actors
    .filter((actor) => !actor.defeated)
    .sort((left, right) => right.gauge - left.gauge)[0];
  return {
    step: "acting",
    lines: [
      "행동 게이지가 차는 중입니다.",
      readyActor ? `${readyActor.name}의 턴이 가까워지고 있다.` : "전황이 전개되고 있습니다.",
    ],
    activeActorRecordId: undefined,
  };
}

export function directorStateAfterTurn(snapshot: BattleSnapshot, previous: BattleDirectorState): BattleDirectorState {
  if (snapshot.result) return resultDirectorState(snapshot, previous);
  if (snapshot.phase === "actorCommand") return commandPromptState(snapshot);
  if (snapshot.phase === "charging") return chargingDirectorState(snapshot);
  return previous;
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
    impactLine(command, target, impact, result, after),
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
  result: BattleSnapshot["lastActionResult"],
  after: BattleSnapshot
): string {
  if (command.kind === "defend") return "받는 피해를 줄일 준비를 마쳤다.";
  if (command.kind === "escape") return after.result === "escape" ? "무사히 도망쳤다!" : "그러나 도망칠 수 없었다!";
  if (command.kind === "switch") return "전열을 교체했다.";
  if (command.kind === "capture") return captureImpactLine(after.lastCaptureResult, target);
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
      selectedEnemy ? `${withJosa(selectedEnemy.name, "을/를")} 겨냥하고 있습니다.` : "선택 가능한 적이 없습니다.",
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

export function battleEventDirectorState(snapshot: BattleSnapshot, previous: BattleDirectorState): BattleDirectorState {
  const log = [...snapshot.eventLogs].reverse().find((entry) => entry.kind === "message" || entry.kind === "choices");
  if (!log?.detail) return previous;
  return {
    ...previous,
    step: "acting",
    lines: [log.detail],
  };
}

export function battleMessageWindow(state: BattleDirectorState): HTMLElement {
  const windowNode = document.createElement("div");
  windowNode.className = "battle-message-window";
  windowNode.dataset.testid = "battle-message-window";
  syncBattleMessageWindow(windowNode, state);
  return windowNode;
}

export function syncBattleMessageWindow(windowNode: HTMLElement, state: BattleDirectorState): void {
  windowNode.dataset.battleDirectorStep = state.step;
  let cursor = windowNode.querySelector<HTMLElement>(".battle-message-cursor");
  if (!cursor) {
    cursor = document.createElement("span");
    cursor.className = "battle-message-cursor";
    cursor.textContent = ">";
    windowNode.prepend(cursor);
  }
  let lines = windowNode.querySelector<HTMLElement>(".battle-message-lines");
  if (!lines) {
    lines = document.createElement("div");
    lines.className = "battle-message-lines";
    windowNode.append(lines);
  }
  lines.replaceChildren();
  for (const line of state.lines) {
    const row = document.createElement("div");
    row.className = "battle-message-line";
    row.textContent = line;
    lines.append(row);
  }
}

export function battleResultPanel(snapshot: BattleSnapshot, revealStage = 0): HTMLElement | undefined {
  if (!snapshot.result) return undefined;
  const panel = document.createElement("div");
  panel.className = "battle-result-panel";
  panel.dataset.testid = "battle-result-panel";
  panel.dataset.battleResult = snapshot.result;
  syncBattleResultPanel(panel, snapshot, revealStage);
  return panel;
}

export function syncBattleResultPanel(panel: HTMLElement, snapshot: BattleSnapshot, revealStage: number): void {
  panel.dataset.battleResult = snapshot.result ?? "";
  panel.dataset.resultRevealStage = String(revealStage);
  let crest = panel.querySelector(".battle-result-crest");
  if (!crest) {
    crest = document.createElement("div");
    crest.className = "battle-result-crest";
    crest.setAttribute("aria-hidden", "true");
    panel.prepend(crest);
  }
  let title = panel.querySelector<HTMLElement>(".battle-result-title");
  if (!title) {
    title = document.createElement("div");
    title.className = "battle-result-title";
    panel.append(title);
  }
  title.textContent = resultLine(snapshot.result);

  let cards = panel.querySelector<HTMLElement>(".battle-result-cards");
  if (!cards) {
    cards = document.createElement("div");
    cards.className = "battle-result-cards battle-result-rewards";
    cards.dataset.testid = "battle-result-cards";
    panel.append(cards);
  }
  cards.replaceChildren();
  for (const [index, row] of rewardRows(snapshot).entries()) {
    const item = document.createElement("div");
    item.className = "battle-result-reward-card battle-result-reward-row";
    item.dataset.revealIndex = String(index);
    item.hidden = index >= revealStage;
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

  // crest/title/cards 는 위에서 없을 때만 만들어 이미 append 했다. 여기서 다시 append 하면
  // 재동기화(revealStage 진행) 때마다 그 3개가 확인 버튼/계속 프롬프트 뒤로 밀려나, 화면
  // 순서가 "확인 → 승리" 로 뒤집힌다(실측: children = confirm, prompt, crest, title, cards).
  // 그래서 재배치는 하지 않는다.
  if (!panel.querySelector(".battle-result-confirm")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "battle-result-confirm";
    button.dataset.testid = "battle-result-confirm";
    button.textContent = "확인";
    panel.append(button);
  }
  if (!panel.querySelector(".battle-result-next-prompt")) {
    const prompt = document.createElement("div");
    prompt.className = "battle-result-next-prompt";
    prompt.textContent = "Z / 클릭 으로 계속";
    panel.append(prompt);
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
    case "capture":
      return after.enemies.find((enemy) => enemy.id === command.targetEnemyId)
        ?? before.enemies.find((enemy) => enemy.id === command.targetEnemyId);
    case "defend":
    case "escape":
    case "switch":
      return undefined;
  }
}

function commandLine(command: ActorCommand, actor: BattleBattlerSnapshot | undefined): string {
  const actorName = actor?.name ?? "아군";
  const subject = withJosa(actorName, "이/가");
  switch (command.kind) {
    case "attack":
      return `${actorName}의 공격!`;
    case "skill":
      return `${subject} ${withJosa(skillName(command.skillId), "을/를")} 사용했다!`;
    case "item":
      return `${subject} ${withJosa(itemName(command.itemId), "을/를")} 사용했다!`;
    case "capture":
      return `${subject} ${withJosa(itemName(command.captureItemId), "을/를")} 던졌다!`;
    case "defend":
      return `${subject} 방어 태세를 취했다.`;
    case "escape":
      return `${subject} 도망치려 한다…`;
    case "switch":
      return `${subject} 교체를 지시했다.`;
  }
}

function captureImpactLine(result: BattleSnapshot["lastCaptureResult"], target: BattleBattlerSnapshot | undefined): string {
  if (!result) return "포획을 시도했다.";
  if (result.success) return `신난다! ${withJosa(target?.name ?? "몬스터", "을/를")} 잡았다!`;
  switch (result.blockedReason) {
    case "uncapturable":
      return "이 전투에서는 포획할 수 없다.";
    case "missingItem":
      return "포획 아이템이 없다.";
    case "missingSpecies":
      return "포획 대상 species가 정의되지 않았다.";
    case "missingTarget":
      return "포획할 대상이 없다.";
    case undefined:
      return "아앗, 아깝다! 몬스터가 구슬에서 빠져나왔다!";
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
  const base = `경험치 ${snapshot.rewards.exp} / 골드 ${snapshot.rewards.gold} / 아이템 ${itemCount}`;
  const levelUps = snapshot.rewards.levelUps ?? [];
  if (levelUps.length === 0) return base;
  const names = levelUps.map((entry) => `${entry.actorName} Lv.${entry.toLevel}`).join(", ");
  return `${base} · 레벨 업! ${names}`;
}

export function battleResultRewardRowCount(snapshot: BattleSnapshot): number {
  return rewardRows(snapshot).length;
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
  // 레벨업이 발생한 액터별로 "레벨 업!" 행을 추가.
  for (const levelUp of snapshot.rewards.levelUps ?? []) {
    rows.push({ kind: "levelup", label: `${levelUp.actorName} 레벨 업!`, value: `Lv.${levelUp.fromLevel}→${levelUp.toLevel}` });
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
