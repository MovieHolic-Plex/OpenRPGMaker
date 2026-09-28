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
import { menuSkinFor } from "@/player/menuSkins/registry";
import { partyWalker } from "@/player/partyWalker";
import { rewardActorIds } from "@/battle/rewardPolicy";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

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
      openingLine ?? (actor ? `${withJosa(actor.name, "은/는")}${store.getCurrent().system.battleUiStyle === "pokemon" ? "\n" : " "}무엇을 할까?` : "게이지가 차는 중입니다."),
    ],
    activeActorRecordId: actor?.recordId,
  };
}

/** 트레이너 팀은 도전 소개, 그 밖의 몬스터 트룹은 야생 인카운트 소개. */
export function introDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const troop = store.getCurrent().database.troops.find((entry) => entry.id === snapshot.troopId);
  if (troop?.trainerBattle === true) {
    return {
      step: "intro",
      lines: [`${withJosa(troop.name, "이/가")} 승부를 걸어왔다!`],
      activeActorRecordId: snapshot.activeActorId,
    };
  }
  const living = snapshot.enemies.filter((enemy) => !enemy.defeated);
  // 같은 이름은 묶어 「초원 슬라임 ×3, 숲 박쥐 ×3」 — 이름을 여섯 번 나열하면 첫 문장이
  // 소음이 되고 창 폭(560px)을 넘겨 생략됐다(2026-09-14 실측).
  const counts = new Map<string, number>();
  for (const enemy of living) counts.set(enemy.name, (counts.get(enemy.name) ?? 0) + 1);
  const names = [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name));
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
export function enemyActionDirectorState(entry: BattleActionResultSnapshot, snapshot: BattleSnapshot, effect?: { readonly resource: "hp" | "mp"; readonly healing: boolean }): BattleDirectorState {
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
  const targetName = target
    ? disambiguatedBattlerName(target, snapshot.enemies.some((enemy) => enemy.id === target.id) ? snapshot.enemies : snapshot.actors)
    : "대상";
  const impact = !entry.hit
    ? "공격이 빗나갔다!"
    : entry.amount > 0
      ? effect?.resource === "mp"
        ? `${targetName}의 MP가 ${entry.amount} ${effect.healing ? "회복" : "감소"}했다!`
        : `${withJosa(targetName, "이(가)")} ${entry.amount} 피해를 입었다!${entry.critical ? " 급소다!" : ""}`
      : "효과가 충분하지 않았다.";
  return {
    step: "acting",
    lines: [action, impact],
    activeActorRecordId: undefined,
    targetId: entry.targetId,
  };
}

export function chargingDirectorState(snapshot: BattleSnapshot): BattleDirectorState {
  const peers = snapshot.actors.some((actor) => actor.id === snapshot.nextReadyBattlerId)
    ? snapshot.actors : snapshot.enemies;
  const ready = peers.find((battler) => battler.id === snapshot.nextReadyBattlerId);
  return {
    step: "acting",
    lines: [
      "행동 게이지가 차는 중입니다.",
      ready ? `${disambiguatedBattlerName(ready, peers)}의 턴이 가까워지고 있다.` : "전황이 전개되고 있습니다.",
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
  // 회복 여부와 자원은 타임라인 엔트리가 들고 있다. 부호나 HP 차이로 다시 추론하면
  // 양수 회복량이 "피해" 로, MP 회복이 HP 회복으로 둔갑한다(실측: 마력약 +30 팝업에
  // "주인공에게 30 피해!").
  const effect = commandEntry
    ? { healing: commandEntry.kind === "healing" || (commandEntry.amount ?? 0) < 0, resource: commandEntry.resource ?? "hp" as const }
    : undefined;
  const lines = [
    commandLine(command, actor, before),
    impactLine(command, target, impact, result, after, effect),
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
  after: BattleSnapshot,
  effect?: { readonly healing: boolean; readonly resource: "hp" | "mp" },
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
  if (effect?.healing) {
    const healed = rolled > 0 ? rolled : Math.abs(impact);
    if (healed > 0) {
      const amountText = effect.resource === "mp" ? `MP를 ${healed}` : `${healed}`;
      return `${withJosa(target?.name ?? "대상", "이(가)")} ${amountText} 회복했다!`;
    }
  }
  if (effect?.resource === "mp" && !effect.healing && rolled > 0) return `${targetName}의 MP가 ${rolled} 감소했다!`;
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
  // 이름은 순번까지(disambiguatedBattlerName) — 동명 적 셋에서 ←→ 를 눌러도 문장이 한 글자도
  // 안 바뀌던 결함(2026-09-14 실측). 두 갈래(아군/적)는 같은 어조·같은 정보량으로 둔다.
  const peers = snapshot.targetSelection?.side === "actor" ? snapshot.actors : snapshot.enemies;
  const selectedName = selected ? disambiguatedBattlerName(selected, peers) : undefined;
  const lines = snapshot.targetSelection?.side === "actor"
    ? [
      actor ? `${actor.name}: ${withJosa(terms.target, "을/를")} 고른다.` : `${withJosa(terms.target, "을/를")} 고른다.`,
      selectedName ? `${withJosa(selectedName, "을/를")} 노린다.` : "선택 가능한 대상이 없다.",
    ]
    : [
      // 키 조작 힌트는 커맨드 패널 하단의 키 프롬프트가 이미 보여준다 — 메시지 창에
      // "Z/Enter · X/Esc"만 대사처럼 떠 있던 결함(적대 리뷰 3차). 여기는 상황 서술만.
      selectedName
        ? `${withJosa(selectedName, "을/를")} 노린다${targetCount > 1 ? ` (← → ${terms.target} 변경)` : ""}`
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

// Event logs are diagnostics, not narration. Authored text is presented by the
// sequential eventPause/dialogue host and must not linger over command prompts.

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

const REWARD_COUNT_UP_MS = 520;

/**
 * 경험치·골드 수치(「+17」)를 0 에서 최종값까지 센다. 끝나면 원래 글자로 되돌려
 * 놓으므로 최종 textContent 는 세지 않은 경우와 같다. 감소 모션·rAF 없음이면 세지 않는다.
 */
function countUpRewardValue(value: HTMLElement): void {
  const finalText = value.textContent ?? "";
  const match = /^(\D*)(\d[\d,]*)(.*)$/su.exec(finalText);
  if (!match) return;
  const target = Number(match[2].replace(/,/gu, ""));
  if (!Number.isFinite(target) || target < 2) return;
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
  if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const token = String((Number(value.dataset.countToken ?? "0") || 0) + 1);
  value.dataset.countToken = token;
  value.dataset.counting = "true";
  const started = performance.now();
  const step = (now: number): void => {
    if (value.dataset.countToken !== token || !value.isConnected) return;
    const t = Math.min(1, (now - started) / REWARD_COUNT_UP_MS);
    if (t >= 1) {
      value.textContent = finalText;
      delete value.dataset.counting;
      return;
    }
    const eased = 1 - (1 - t) ** 3;
    value.textContent = `${match[1]}${Math.round(target * eased).toLocaleString("en-US")}${match[3]}`;
    window.requestAnimationFrame(step);
  };
  value.textContent = `${match[1]}0${match[3]}`;
  window.requestAnimationFrame(step);
}

/** 결과 패널을 그린 플레이 세션 — 도트 창(파티 수치)이 걷기 그림과 보상 대상 판정에 쓴다. 에디터 전투 테스트는 없다. */
export type BattleResultContext = { readonly project: Project; readonly session: PlaySession };
const resultContexts = new WeakMap<HTMLElement, BattleResultContext>();

export function battleResultPanel(snapshot: BattleSnapshot, revealStage = 0, context?: BattleResultContext): HTMLElement | undefined {
  if (!snapshot.result) return undefined;
  const panel = document.createElement("div");
  panel.className = "battle-result-panel";
  panel.dataset.testid = "battle-result-panel";
  panel.dataset.battleResult = snapshot.result;
  if (context) resultContexts.set(panel, context);
  // 제목만 라이브(polite). 카드 컨테이너까지 atomic 으로 읽으면 스테이지마다 패널 전체가
  // 행 수만큼 재낭독됐다(최대 12회).
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
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
  const nextTitle = resultLine(snapshot.result);
  if (title.textContent !== nextTitle) title.textContent = nextTitle;

  let cards = panel.querySelector<HTMLElement>(".battle-result-cards");
  if (!cards) {
    cards = document.createElement("div");
    cards.className = "battle-result-cards battle-result-rewards";
    cards.dataset.testid = "battle-result-cards";
    cards.setAttribute("aria-live", "off");
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
    const wasRevealed = item.dataset.revealed === "true";
    item.dataset.revealed = revealed ? "true" : "false";
    if (revealed && !wasRevealed) {
      const value = item.querySelector<HTMLElement>(".battle-result-reward-value");
      // 모두 공개(확인키 건너뛰기)는 revealStage 가 행 수보다 크다 — 그때는 세지 않고 최종값을 바로 보인다.
      const counted = item.querySelector(".battle-result-reward-icon-exp, .battle-result-reward-icon-gold");
      if (value && counted && revealStage <= cards.children.length) countUpRewardValue(value);
    }
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
  syncPixelResultParty(panel, snapshot, revealStage);
}

/**
 * 도트 창 결과(기본 메뉴 스킨 pixel, 포켓몬 전투 제외) — 상점·ESC 메뉴와 같은 창 체계.
 *
 * 첫 화면은 세 창뿐이다: 머리 창(승리 · EXP · 돈 · 전리품 이름) / 파티 창(걷는 그림 · Lv 전후 · EXP 막대 ·
 * LEVEL UP 또는 다음 Lv까지) / 전리품 창(소지금 · 아이템 보유 「현재 → 받은 뒤」). 능력치 24칸을 한 화면에
 * 늘어놓던 레벨 업 창은 없앴다 — 확인키를 누르면 오른 사람만 한 명씩 창으로 띄운다
 * (advanceBattleResultLevelUps). 기존 보상 행은 전리품 창 안에 그대로 남는다 — 공개 단계·세기·
 * 「첫 확인키 = 전부 공개」 계약이 그 행을 본다. 경험치·레벨 업 행은 파티 창과 레벨 업 창이 대신 말하므로 숨긴다.
 */
function syncPixelResultParty(panel: HTMLElement, snapshot: BattleSnapshot, revealStage: number): void {
  const project = store.getCurrent();
  if (snapshot.result !== "victory" || !menuSkinFor(project).partyStats || project.system.battleUiStyle === "pokemon") return;
  const context = resultContexts.get(panel);
  const actors = snapshot.actors.filter((actor) => !actor.monsterInstanceId && project.database.actors.some((record) => record.id === actor.recordId));
  if (actors.length === 0) return;
  panel.classList.add("battle-result-pixel");
  let party = panel.querySelector<HTMLElement>(".battle-result-party");
  if (!party) {
    party = el("section", { class: "battle-result-party", attrs: { "aria-label": "파티 경험치" }, dataset: { testid: "battle-result-party" } });
    const rewarded = new Set(rewardActorIds(project, actors.map((actor) => actor.recordId), snapshot.participatingActorIds));
    for (const actor of actors) party.append(resultPartyCard(project, context, snapshot, actor, rewarded.has(actor.recordId)));
    const levelUps = (snapshot.rewards.levelUps ?? []).flatMap((entry) => {
      const actor = actors.find((candidate) => candidate.recordId === entry.actorId);
      return actor ? [{ actor, entry }] : [];
    });
    const head = resultHead(project, snapshot);
    // 제목은 공용 경로가 만든 노드를 머리 창 안으로 옮긴다 — 공용 동기화는 querySelector 로 찾으므로 그대로 갱신된다.
    const title = panel.querySelector<HTMLElement>(".battle-result-title");
    if (title) head.prepend(title);
    panel.append(head, party);
    if (levelUps.length > 0) {
      panel.append(el("div", {
        class: "battle-result-levelup-modal",
        dataset: { testid: "battle-result-levelups", open: "false", index: "-1" },
        children: levelUps.map(({ actor, entry }, index) => resultLevelUpWindow(project, context, actor, entry, index, levelUps.length)),
      }));
      const prompt = panel.querySelector<HTMLElement>(".battle-result-next-prompt");
      if (prompt) prompt.textContent = `레벨 업 ${levelUps.length}명 · ${CONTINUE_KEY_PROMPT}`;
    }
  }
  syncPixelLoot(panel, snapshot);
  // 첫 보상 행이 공개되는 순간 막대가 이전 → 이후로 찬다. 모두 공개(확인키)면 바로 최종값.
  const revealed = revealStage > 0;
  party.dataset.revealed = revealed ? "true" : "false";
  for (const fill of party.querySelectorAll<HTMLElement>(".battle-result-party-fill")) {
    const target = revealed ? fill.dataset.toPct : fill.dataset.fromPct;
    if (fill.dataset.shownPct === target) continue;
    fill.dataset.shownPct = target ?? "0";
    requestAnimationFrame(() => { fill.style.width = `${target ?? 0}%`; });
  }
}

/**
 * 도트 결과의 다음 레벨 업 창을 연다. 열었으면 true(확인키를 소비), 더 없으면 false(결과를 닫는다).
 * 마지막 창에서 false 를 돌려도 창은 닫지 않는다 — 닫히는 전환 동안 첫 화면이 한 프레임 비치지 않게.
 */
export function advanceBattleResultLevelUps(panel: HTMLElement): boolean {
  const modal = panel.querySelector<HTMLElement>(".battle-result-levelup-modal");
  if (!modal) return false;
  const windows = [...modal.querySelectorAll<HTMLElement>(".battle-result-levelup")];
  const next = Number(modal.dataset.index ?? "-1") + 1;
  if (next >= windows.length) return false;
  modal.dataset.index = String(next);
  modal.dataset.open = "true";
  windows.forEach((windowNode, index) => { windowNode.dataset.active = index === next ? "true" : "false"; });
  return true;
}

function lootCounts(snapshot: BattleSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const itemId of snapshot.rewards.items) counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  return counts;
}

/** 머리 창 — 승리 제목 · EXP · 돈 · 전리품 이름을 한 줄에. */
function resultHead(project: Project, snapshot: BattleSnapshot): HTMLElement {
  const loot = [...lootCounts(snapshot)].map(([itemId, count]) => `${itemName(itemId)} ×${count}`).join(" · ");
  return el("div", {
    class: "battle-result-summary",
    dataset: { testid: "battle-result-summary" },
    children: [
      el("span", { class: "battle-result-summary-item", children: ["EXP ", el("span", { class: "battle-result-summary-value", text: `+${snapshot.rewards.exp.toLocaleString("ko-KR")}` })] }),
      el("span", { class: "battle-result-summary-gold", text: `+${snapshot.rewards.gold.toLocaleString("ko-KR")} ${resolveTerms(project).gold}` }),
      ...(loot ? [el("span", { class: "battle-result-summary-loot", text: loot })] : []),
    ],
  });
}

/**
 * 전리품 창 — 기존 보상 행에 「현재 → 받은 뒤」 를 붙인다. 소지금은 전투 시작 때 사본(eventState.gold),
 * 아이템은 그 사본의 보유 수에 이번 드롭 수를 더한다. 행은 공용 경로가 결과마다 한 번만 만들므로
 * 이미 붙인 행은 건너뛴다.
 */
function syncPixelLoot(panel: HTMLElement, snapshot: BattleSnapshot): void {
  const cards = panel.querySelector<HTMLElement>(".battle-result-cards");
  if (!cards) return;
  const gold = snapshot.eventState.gold ?? 0;
  const counts = [...lootCounts(snapshot)];
  let itemIndex = 0;
  for (const row of cards.querySelectorAll<HTMLElement>(".battle-result-reward-row")) {
    const kind = /battle-result-reward-icon-(\w+)/u.exec(row.querySelector<HTMLElement>(".battle-result-reward-icon")?.className ?? "")?.[1] ?? "";
    row.dataset.rewardKind = kind;
    const entry = kind === "item" ? counts[itemIndex++] : undefined;
    if (row.querySelector(".battle-result-reward-owned")) continue;
    let owned: string | undefined;
    if (kind === "gold") owned = `소지금 ${gold.toLocaleString("ko-KR")} → ${(gold + snapshot.rewards.gold).toLocaleString("ko-KR")}`;
    if (entry) {
      const before = snapshot.eventState.inventory[entry[0]] ?? 0;
      owned = `보유 ${before} → ${before + entry[1]}`;
    }
    if (owned) row.append(el("span", { class: "battle-result-reward-owned", text: owned }));
  }
}

function resultPartyCard(project: Project, context: BattleResultContext | undefined, snapshot: BattleSnapshot, actor: BattleBattlerSnapshot, rewarded: boolean): HTMLElement {
  const record = project.database.actors.find((entry) => entry.id === actor.recordId)!;
  const normalized = normalizeActorRecord(record);
  const levelUp = snapshot.rewards.levelUps?.find((entry) => entry.actorId === actor.recordId);
  const fromLevel = snapshot.eventState.actorLevels?.[actor.recordId] ?? actor.level ?? 1;
  const toLevel = levelUp?.toLevel ?? fromLevel;
  const before = snapshot.eventState.actorExperience?.[actor.recordId] ?? totalExpForLevel(normalized.expCurve, fromLevel);
  const gained = rewarded ? expForRewardActor(snapshot.rewards.exp, fromLevel, snapshot.rewards.enemyLevel, project.system.rewardPolicy) : 0;
  const after = before + gained;
  const base = totalExpForLevel(normalized.expCurve, toLevel);
  const next = totalExpForLevel(normalized.expCurve, toLevel + 1);
  const span = next > base ? next - base : 0;
  const pct = (value: number) => (span ? Math.max(0, Math.min(100, ((value - base) / span) * 100)) : 100);
  // 레벨이 올랐으면 새 구간의 0 에서, 아니면 이전 진행률에서 찬다.
  const fromPct = levelUp ? 0 : pct(before);
  const toPct = pct(after);
  const maxed = toLevel >= normalized.maxLevel || !span;
  const walker = context ? partyWalker(project, context.session, actor.recordId, actor.name, { className: "battle-result-walker" }) : null;
  return el("article", {
    class: `battle-result-party-card${levelUp ? " is-levelup" : ""}${actor.hp <= 0 ? " is-down" : ""}`,
    dataset: { testid: `battle-result-party-${actor.recordId}` },
    children: [
      walker ?? el("span", { class: "battle-result-walker is-missing", text: actor.name.slice(0, 1) }),
      el("span", { class: "battle-result-party-name", text: actor.name }),
      el("span", {
        class: "battle-result-party-level",
        children: [`Lv ${fromLevel}`, ...(levelUp ? [el("span", { class: "battle-result-party-arrow", text: " → " }), el("span", { class: "battle-result-party-to", text: String(toLevel) })] : [])],
      }),
      el("span", { class: "battle-result-party-badge", text: levelUp ? "LEVEL UP" : "", attrs: { "aria-hidden": levelUp ? "false" : "true" } }),
      el("span", {
        class: "battle-result-party-track",
        children: [el("span", { class: "battle-result-party-fill", attrs: { style: `width:${fromPct}%` }, dataset: { fromPct: String(fromPct), toPct: String(toPct), shownPct: String(fromPct) } })],
      }),
      el("span", { class: "battle-result-party-exp", text: rewarded ? `EXP +${gained.toLocaleString("ko-KR")}` : "EXP 없음" }),
      el("span", { class: "battle-result-party-next", text: maxed ? "최대 레벨" : `다음 Lv까지 ${Math.max(0, next - after).toLocaleString("ko-KR")}` }),
    ],
  });
}

/** 레벨 업 창 한 장 — 한 사람의 Lv 전후 · 능력치 6개 「현재 → 오른 뒤 ▲」 · 새 스킬. */
function resultLevelUpWindow(
  project: Project,
  context: BattleResultContext | undefined,
  actor: BattleBattlerSnapshot,
  entry: NonNullable<BattleSnapshot["rewards"]["levelUps"]>[number],
  index: number,
  total: number,
): HTMLElement {
  const stats = actor.effectiveStats;
  const terms = resolveTerms(project);
  const rows: readonly (readonly [string, number | undefined, number])[] = [
    [`최대 ${terms.hp}`, actor.maxHp, entry.maxHpGain],
    [`최대 ${terms.mp}`, actor.maxMp, entry.maxMpGain],
    ["공격력", stats?.attack, entry.attackGain],
    ["방어력", stats?.defense, entry.defenseGain],
    ["정신력", stats?.mind, entry.mindGain],
    ["민첩성", stats?.agility, entry.agilityGain],
  ];
  const skills = entry.learnedSkillIds.flatMap((skillId) => {
    const skill = project.database.skills.find((record) => record.id === skillId);
    return skill ? [skill] : [];
  });
  const walker = context ? partyWalker(project, context.session, actor.recordId, actor.name, { className: "battle-result-walker" }) : null;
  return el("article", {
    class: "battle-result-levelup",
    attrs: { "aria-label": `${entry.actorName} 레벨 업` },
    dataset: { testid: `battle-result-levelup-${entry.actorId}`, active: "false" },
    children: [
      el("div", {
        class: "battle-result-levelup-head",
        children: [
          walker ?? el("span", { class: "battle-result-walker is-missing", text: actor.name.slice(0, 1) }),
          el("div", {
            class: "battle-result-levelup-title",
            children: [
              el("span", { class: "battle-result-levelup-name", text: entry.actorName }),
              el("span", {
                class: "battle-result-levelup-level",
                children: [`Lv ${entry.fromLevel}`, el("span", { class: "battle-result-party-arrow", text: " → " }), el("span", { class: "battle-result-party-to", text: String(entry.toLevel) }), el("span", { class: "battle-result-party-badge", text: "LEVEL UP" })],
              }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "battle-result-levelup-stats",
        children: rows.map(([label, current, gain]) => el("div", {
          class: `battle-result-levelup-row${gain > 0 ? " up" : ""}`,
          children: [
            el("span", { class: "battle-result-levelup-label", text: label }),
            el("span", {
              class: "battle-result-levelup-value",
              children: current === undefined
                ? [`+${gain}`]
                : [String(current), el("span", { class: "battle-result-party-arrow", text: " → " }), el("span", { class: "battle-result-levelup-next", text: String(current + gain) })],
            }),
            el("span", { class: "battle-result-levelup-delta", text: gain > 0 ? `▲${gain}` : "" }),
          ],
        })),
      }),
      ...(skills.length
        ? [el("div", {
            class: "battle-result-levelup-skills",
            children: [
              el("span", { class: "battle-result-levelup-label", text: "새 스킬" }),
              ...skills.map((skill) => el("span", {
                class: "battle-result-levelup-skill",
                children: [skill.name, ...(skill.mpCost.flat > 0 ? [el("span", { class: "battle-result-levelup-mp", text: ` MP ${skill.mpCost.flat}` })] : [])],
              })),
            ],
          })]
        : []),
      el("span", { class: "battle-result-levelup-page", text: index + 1 < total ? `${index + 1}/${total} ▼` : `${index + 1}/${total} ▼ 닫기` }),
    ],
  });
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
  // 이전 단계의 표식을 먼저 걷는다 — 걷지 않으면 대상 선택 때 붙은 battle-targeted 가 임팩트까지
  // 남아 "피격 순간" 플래시(oprn-target-flash)가 조준 순간에 한 번 돌고 끝났다(2026-09-14 실측).
  for (const node of root.querySelectorAll<HTMLElement>(".battle-acting")) {
    if (node.dataset.recordId !== state.activeActorRecordId) node.classList.remove("battle-acting");
  }
  for (const node of root.querySelectorAll<HTMLElement>(".battle-targeted")) {
    if (node.dataset.testid !== state.targetId || state.step !== "impact") node.classList.remove("battle-targeted");
  }
  markByDataset(root, "recordId", state.activeActorRecordId, "battle-acting");
  if (state.step === "impact") markByDataset(root, "testid", state.targetId, "battle-targeted");
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

function commandLine(command: ActorCommand, actor: BattleBattlerSnapshot | undefined, before?: BattleSnapshot): string {
  const actorName = actor?.name ?? "아군";
  const subject = withJosa(actorName, "이/가");
  switch (command.kind) {
    case "attack":
      return `${actorName}의 공격!`;
    case "skill": {
      // 연계기는 참가자 전원의 이름을 부른다(시전자 먼저).
      const combo = store.getCurrent().database.skills.find((skill) => skill.id === command.skillId)?.comboActorIds;
      if (combo && combo.length >= 2 && actor) {
        const names = [actor.name, ...combo.filter((id) => id !== actor.recordId)
          .map((id) => before?.actors.find((entry) => entry.recordId === id)?.name ?? id)];
        return `${names.join("·")}의 연계기 — ${skillName(command.skillId)}!`;
      }
      return `${subject} ${withJosa(skillName(command.skillId), "을/를")} 사용했다!`;
    }
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

/**
 * 결과 패널의 **제목**이자 디렉터 대사의 첫 줄.
 *
 * 세 갈래가 문체가 제각각이었다 — `승리`(명사), `패배했습니다`(합쇼체), `무사히 후퇴했다`(해라체).
 * 같은 슬롯에서 갈라지면 감독이 문체를 고를 수 없다. 이 슬롯은 `.battle-result-title` 에
 * 그대로 찍히는 **제목**이므로 셋 다 명사로 맞춘다(문장은 바로 아래 `rewardsLine` 이 맡는다).
 * 전투 로그(`battleSequencer`)는 일부러 해라체다 — 저기는 건드리지 않는다.
 */
function resultLine(result: BattleSnapshot["result"]): string {
  switch (result) {
    case "victory":
      return "승리";
    case "defeat":
      return "패배";
    case "escape":
      return "후퇴";
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
  // 같은 아이템은 한 행에 ×n — 드롭 6개가 「아이템」 라벨 6줄·같은 아이콘 6개로 늘어나
  // 공개 시간(450ms/행)과 패널 높이를 함께 키웠다(2026-09-14 실측).
  const itemCounts = new Map<string, number>();
  for (const itemId of snapshot.rewards.items) itemCounts.set(itemId, (itemCounts.get(itemId) ?? 0) + 1);
  for (const [itemId, count] of itemCounts) {
    rows.push({ kind: "item", label: itemName(itemId), value: count > 1 ? `×${count}` : "획득" });
  }
  // 레벨업이 발생한 액터별로 "레벨 업!" 행을 추가.
  for (const levelUp of snapshot.rewards.levelUps ?? []) {
    rows.push({ kind: "levelup", label: `${levelUp.actorName} 레벨 업!`, value: `Lv.${levelUp.fromLevel}→${levelUp.toLevel}` });
  }
  // 기술 포인트 — 저작된 TP 가 있는 전투에서만 행이 생긴다. 배운 기술은 배우별로 한 행.
  if (snapshot.rewards.tp) rows.push({ kind: "tp", label: "기술 포인트", value: `+${snapshot.rewards.tp}` });
  for (const tech of snapshot.rewards.techLearned ?? []) {
    for (const skillId of tech.skillIds) rows.push({ kind: "skill", label: `${tech.actorName} 기술 습득`, value: skillName(skillId) });
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
