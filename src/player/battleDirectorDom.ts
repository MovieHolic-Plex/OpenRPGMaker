import type { ActorCommand, BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import type { BattleActionResultSnapshot } from "@/battle/types";
import { withJosa } from "@/util/josa";
import { activeActor } from "@/battle/battlePredict";
import { expForRewardActor } from "@/battle/rewardPolicy";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import { CONTINUE_KEY_PROMPT } from "@/player/keyBindings";
import { disambiguatedBattlerName } from "@/player/battleCommandDom";

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

/** 인카운트 인트로 배너 — 몬스터 트룹이면 "야생의 ○○이(가) 나타났다!" */
export function introDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const living = snapshot.enemies.filter((enemy) => !enemy.defeated);
  const names = living.map((enemy) => enemy.name);
  const label = names.length > 1 ? `${names.slice(0, -1).join(", ")}, ${names[names.length - 1]}` : names[0] ?? "적";
  // 전원이 몬스터 종(speciesId)인 트룹에만 "야생의"를 붙인다 — 인간형/보스 트룹까지
  // 야생으로 부르지 않게. 파일 서두 주석이 약속해 온 포켓몬식 인트로 문구다.
  const wild = living.length > 0 && living.every((enemy) => enemy.speciesId);
  return {
    step: "intro",
    lines: [`${wild ? "야생의 " : ""}${withJosa(label, "이/가")} 나타났다!`],
    activeActorRecordId: snapshot.activeActorId,
  };
}

/** 파티 몬스터를 내보내는 인트로 둘째 비트. 아군 선두가 파티 몬스터여야 생긴다 —
 *  트레이너(종족 없는 아군)만 있는 전투에서는 만들지 않는다. */
export function sendOutDirectorState(snapshot: BattleSnapshot): BattleDirectorState | undefined {
  const lead = snapshot.actors.find((actor) => !actor.defeated && actor.monsterInstanceId);
  if (!lead) return undefined;
  return {
    step: "intro",
    lines: [`가라, ${lead.name}!`],
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
  // 적의 기본 공격은 내부적으로 "공격" 스킬로 굴러가지만, "○○가 공격을 사용했다!"는
  // 아군의 "주인공의 공격!"과 문체가 어긋난다 — 기본 공격은 같은 문형으로 맞춘다.
  const action = entry.skillName && entry.skillName !== "공격"
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
  const impact = battlerHpDelta(target?.id, before, after);
  // 이 명령의 결과는 타임라인 델타에서 찾는다. after.lastActionResult 는 strict 플로우에서
  // 라운드의 "마지막" 액션(대개 적의 반격)이라, 그걸 쓰면 아군 공격 메시지의 숫자가
  // 팝업(타임라인 amount)과 어긋난다(실측: 팝업 -28 / 메시지 20 피해).
  const commandEntry = after.timeline.slice(before.timeline.length).find((entry) =>
    entry.userRecordId === actor?.recordId
    && entry.targetId === target?.id
    && (entry.kind === "damage" || entry.kind === "miss" || entry.kind === "healing" || entry.kind === "action"));
  const result = commandEntry
    ? {
      userRecordId: commandEntry.userRecordId ?? actor?.recordId ?? "",
      targetId: commandEntry.targetId ?? target?.id ?? "",
      hit: commandEntry.kind !== "miss" && commandEntry.hit !== false,
      amount: commandEntry.amount ?? 0,
      critical: Boolean(commandEntry.critical),
      skillName: commandEntry.skillName,
    }
    : after.lastActionResult;
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
  // 메시지 숫자는 HP 차분이 아니라 실제 롤(lastActionResult.amount)을 쓴다 —
  // 팝업(entry.amount)과 같은 소스라 항상 일치하고, 잔여 HP 클램프에 가려지지 않는다.
  const rolled = result && result.hit && result.targetId === target?.id && result.amount > 0
    ? result.amount
    : impact;
  const targetName = target
    ? disambiguatedBattlerName(target, after.enemies.some((enemy) => enemy.id === target.id) ? after.enemies : after.actors)
    : "적";
  if (result && result.critical && rolled > 0) return `급소에 맞았다! ${targetName}에게 ${rolled} 피해!`;
  if (rolled > 0) return `${targetName}에게 ${rolled} 피해!`;
  if (impact < 0) return `${withJosa(target?.name ?? "대상", "이(가)")} ${Math.abs(impact)} 회복했다!`;
  // 서포트이거나 데미지 0
  return "효과가 충분하지 않았다.";
}

export function targetSelectDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const actor = activeActor(snapshot);
  const selectedId = snapshot.targetSelection?.selectedTargetId ?? snapshot.targetSelection?.targetIds[0];
  const selected = snapshot.targetSelection?.side === "actor"
    ? snapshot.actors.find((entry) => entry.id === selectedId || entry.recordId === selectedId)
    : snapshot.enemies.find((entry) => entry.id === selectedId);
  const terms = resolveTerms(store.getCurrent());
  const targetCount = snapshot.targetSelection?.targetIds.length ?? 0;
  const lines = snapshot.targetSelection?.side === "actor"
    ? [
      actor ? `${actor.name}: 대상을 선택하십시오.` : "대상을 선택하십시오.",
      selected ? `${withJosa(selected.name, "을/를")} 겨냥하고 있습니다.` : "선택 가능한 대상이 없습니다.",
    ]
    : [
      // 키 조작 힌트는 커맨드 패널 하단의 키 프롬프트가 이미 보여준다 — 메시지 창에
      // "Z/Enter · X/Esc"만 대사처럼 떠 있던 결함(적대 리뷰 3차). 여기는 상황 서술만.
      selected
        ? `${withJosa(selected.name, "을/를")} 노린다${targetCount > 1 ? ` — ← →로 ${terms.target} 변경` : ""}`
        : `${withJosa(terms.target, "을/를")} 고르는 중…`,
    ];
  return {
    step: "target",
    lines,
    activeActorRecordId: actor?.recordId,
    targetId: selected?.id,
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
  if (previous.step === "result" || snapshot.eventChoice) return previous;
  const log = [...snapshot.eventLogs].reverse().find((entry) => entry.kind === "message");
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
  windowNode.setAttribute("role", "status");
  windowNode.setAttribute("aria-live", "polite");
  windowNode.setAttribute("aria-atomic", "true");
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
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "assertive");
  panel.setAttribute("aria-atomic", "true");
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
  // 행 노드는 결과당 한 번만 만든다. 매 동기화마다 replaceChildren 으로 다시 만들면
  // battle-reward-reveal(opacity 0→1, delay) 애니메이션이 매번 0초로 리셋돼 행이
  // 반투명에 갇히거나(경험치) 아예 안 보였다(골드 — 적대 리뷰 3차 실측).
  const rows = rewardRows(snapshot);
  const rowsKey = `${snapshot.result}:${rows.map((row) => `${row.kind}=${row.value}`).join("|")}`;
  if (cards.dataset.rowsKey !== rowsKey) {
    cards.dataset.rowsKey = rowsKey;
    cards.replaceChildren();
    for (const [index, row] of rows.entries()) {
      const item = document.createElement("div");
      item.className = "battle-result-reward-card battle-result-reward-row";
      item.dataset.revealIndex = String(index);
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
      if (row.kind === "exp") {
        const bar = document.createElement("div");
        bar.className = "battle-result-exp-bar";
        bar.dataset.testid = "battle-result-exp-bar";
        const fill = document.createElement("div");
        fill.className = "battle-result-exp-fill";
        bar.append(fill);
        item.append(bar);
      }
      cards.append(item);
    }
  }
  for (const item of cards.querySelectorAll<HTMLElement>(".battle-result-reward-row")) {
    // hidden(display:none) 대신 자리를 예약한 채 공개한다 — 예전에는 "승리+확인"만 있는
    // 작은 패널이 떴다가 행이 하나씩 끼어들며 패널이 커지고 확인 버튼이 아래로 밀려났다
    // (감독 지적 2: 승리 UI 널뛰기). 패널은 처음부터 최종 크기다.
    const revealed = Number(item.dataset.revealIndex) < revealStage;
    item.dataset.revealed = revealed ? "true" : "false";
    const fill = item.querySelector<HTMLElement>(".battle-result-exp-fill");
    if (!fill) continue;
    const bar = fill.parentElement as HTMLElement;
    // 실제 경험치 진행률로 채운다. 예전에는 항상 0→100% 채우는 장식이라
    // 14 EXP 를 얻어도 게이지가 꽉 찼다(적대 리뷰 §17).
    const progress = expGaugeProgress(snapshot);
    if (!progress) {
      fill.style.width = "0%";
      continue;
    }
    bar.dataset.expLevelUp = progress.levelUp ? "true" : "false";
    if (revealed && panel.dataset.expAnimated !== "true") {
      // 행이 처음 공개될 때 한 번만 이전 진행률 → 새 진행률로 차오른다.
      panel.dataset.expAnimated = "true";
      fill.style.width = `${progress.fromPct}%`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fill.style.width = `${progress.toPct}%`;
      }));
    } else if (panel.dataset.expAnimated !== "true") {
      fill.style.width = `${progress.fromPct}%`;
    } else {
      // 같은 값 재설정은 transition 을 건드리지 않는다.
      fill.style.width = `${progress.toPct}%`;
    }
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
    // 게임 플레이 런타임은 키보드 전용(감독 결정) — "클릭" 안내는 없는 조작을 가리킨다.
    prompt.textContent = CONTINUE_KEY_PROMPT;
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
  root.dataset.battleFlow = snapshot.battleFlow;
  // 결과 클래스는 연출(비트)이 전부 끝나고 디렉터가 result 단계에 진입했을 때만 붙인다.
  // snapshot.result 만 보면 막타 액션이 재생되는 도중에 전투 UI 가 통째로 숨는다(적대 리뷰 §2).
  root.classList.toggle("battle-has-result", Boolean(snapshot.result) && state.step === "result");
  markByDataset(root, "recordId", state.activeActorRecordId, "battle-acting");
  markByDataset(root, "testid", state.targetId, "battle-targeted");
}

function commandTarget(
  command: ActorCommand,
  before: BattleSnapshot,
  after: BattleSnapshot
): BattleBattlerSnapshot | undefined {
  switch (command.kind) {
    case "skill":
    case "item": {
      const targetId = command.targetActorId ?? command.targetEnemyId;
      return after.actors.find((actor) => actor.id === targetId || actor.recordId === targetId)
        ?? before.actors.find((actor) => actor.id === targetId || actor.recordId === targetId)
        ?? after.enemies.find((enemy) => enemy.id === targetId)
        ?? before.enemies.find((enemy) => enemy.id === targetId);
    }
    case "attack":
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
    case "trainerBattle":
      return "트레이너가 곁에 있을 때는 포획할 수 없다.";
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

/**
 * 결과 화면 EXP 게이지 — 선두 액터의 실제 경험치 진행률(현재 레벨 구간 내 %).
 * 획득 경험치는 런타임의 레벨업 미리보기와 동일한 보정(expForRewardActor)을 쓴다.
 */
function expGaugeProgress(snapshot: BattleSnapshot): { fromPct: number; toPct: number; levelUp: boolean } | undefined {
  const lead = snapshot.actors[0];
  if (!lead || snapshot.result !== "victory") return undefined;
  const project = store.getCurrent();
  const record = project.database.actors.find((entry) => entry.id === lead.recordId);
  if (!record) return undefined;
  const actor = normalizeActorRecord(record);
  const level = snapshot.eventState.actorLevels?.[lead.recordId] ?? lead.level ?? 1;
  const base = totalExpForLevel(actor.expCurve, level);
  const next = totalExpForLevel(actor.expCurve, level + 1);
  if (!(next > base)) return undefined;
  const current = snapshot.eventState.actorExperience?.[lead.recordId] ?? base;
  const gained = expForRewardActor(snapshot.rewards.exp, level, snapshot.rewards.enemyLevel, project.system.rewardPolicy);
  const clampPct = (value: number): number => Math.max(0, Math.min(100, value * 100));
  const fromPct = clampPct((current - base) / (next - base));
  const after = current + gained;
  const levelUp = after >= next;
  const toPct = levelUp ? 100 : clampPct((after - base) / (next - base));
  return { fromPct, toPct, levelUp };
}

function battlerHpDelta(targetId: string | undefined, before: BattleSnapshot, after: BattleSnapshot): number {
  if (!targetId) return 0;
  const beforeTarget = before.enemies.find((entry) => entry.id === targetId)
    ?? before.actors.find((entry) => entry.id === targetId || entry.recordId === targetId);
  const afterTarget = after.enemies.find((entry) => entry.id === targetId)
    ?? after.actors.find((entry) => entry.id === targetId || entry.recordId === targetId);
  if (!beforeTarget || !afterTarget) return 0;
  return beforeTarget.hp - afterTarget.hp;
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
  // 액터·몬스터 양쪽 레벨업을 한 줄에 합친다(몬스터 전투는 액터 쪽이 항상 비어 있다).
  const names = [
    ...(snapshot.rewards.levelUps ?? []).map((entry) => `${entry.actorName} Lv.${entry.toLevel}`),
    ...(snapshot.rewards.monsterLevelUps ?? []).map((entry) => `${entry.name} Lv.${entry.toLevel}`),
  ];
  if (names.length === 0) return base;
  return `${base} · 레벨 업! ${names.join(", ")}`;
}

export function battleResultRewardRowCount(snapshot: BattleSnapshot): number {
  return rewardRows(snapshot).length;
}

function rewardRows(snapshot: BattleSnapshot): readonly { readonly kind: string; readonly label: string; readonly value: string }[] {
  // 패배/도주에는 보상이 없다 — "결과: 전투 종료" 자리표시 행은 정보가 없고
  // 저대비 남색 띠로만 보였다(적대 리뷰 3차). 제목+확인 버튼만 남긴다.
  if (snapshot.result !== "victory") return [];
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
  // 파티 몬스터가 싸운 전투(battleParty: "monsters")는 위 액터 루프가 항상 비어서
  // 성장 피드백이 하나도 없었다 — 몬스터 레벨업/습득 기술 행을 같은 형식으로 추가한다.
  for (const levelUp of snapshot.rewards.monsterLevelUps ?? []) {
    rows.push({ kind: "levelup", label: `${levelUp.name} 레벨 업!`, value: `Lv.${levelUp.fromLevel}→${levelUp.toLevel}` });
    for (const skillId of levelUp.learnedSkillIds) {
      rows.push({ kind: "skill", label: `${levelUp.name} 기술 습득`, value: skillName(skillId) });
    }
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
