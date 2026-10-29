import { store } from "@/project/store";
import { vnExtrasLanguage } from "@/project/vnExtras";
import { vnUiText } from "@/player/vnExtrasStrings";

/**
 * 첫 조작 순간·목표가 바뀔 때 화면 가운데에 잠깐 뜨는 「현재 목표」 카드.
 *
 * 목표 줄(zone-feedback-objective)은 이미 있었지만 구석의 작은 창이고 몇 초 뒤 가라앉는다. 판정자 셋이 같은 말을 했다
 * (2026-10-29 vm3 「현재 목표는 메뉴를 열어야만 보임」, vm4 terra/mystery 「처음 시작 시 목표 안내가 거의 없음」,
 * vm5 flash/escape 「도입 연출 뒤 안내가 한 줄뿐」) — 첫 화면 캡처에는 오른쪽 위 한 줄과 아무 조작 안내도 없었다.
 *
 * - 세션의 첫 조작 가능 순간: 목표(있으면) + 조작 안내 한 줄, FIRST_MS 동안.
 * - 그 뒤 목표 글이 바뀌면: 「새 목표」 카드, CHANGE_MS 동안(대사·메뉴 중에 바뀌면 다시 조작할 수 있을 때).
 * - 아무 키·클릭이나 닫는다. 키는 삼키지 않는다 — 카드가 떠 있어도 이동·조사는 그대로 된다.
 * - 같은 세션 안에서는 장면을 다시 만들어도(맵 이동) 첫 카드를 되풀이하지 않는다(세션 키 WeakMap).
 */
const FIRST_MS = 2800;
const CHANGE_MS = 1800;

type CardMemory = { introDone: boolean; lastObjective: string | null };
const memory = new WeakMap<object, CardMemory>();

export type ObjectiveCard = {
  readonly element: HTMLElement;
  hideAtMs: number;
  detach: (() => void) | null;
};

export function createObjectiveCard(): ObjectiveCard {
  const element = document.createElement("section");
  element.className = "objective-card";
  element.dataset.testid = "objective-card";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.hidden = true;
  return { element, hideAtMs: 0, detach: null };
}

export function destroyObjectiveCard(card: ObjectiveCard | null | undefined): void {
  if (!card) return;
  card.detach?.(); card.detach = null;
  card.element.remove();
}

/**
 * 매 프레임. `controllable` = 대사·메뉴·전투가 없고 이벤트도 안 도는 필드 조작 상태.
 * 카드는 조작할 수 없게 되면 바로 숨는다(대사창 위에 겹치지 않게).
 */
export function syncObjectiveCard(
  card: ObjectiveCard,
  host: HTMLElement,
  session: object,
  objective: string | null,
  controllable: boolean,
  nowMs: number,
): void {
  let state = memory.get(session);
  if (!state) { state = { introDone: false, lastObjective: null }; memory.set(session, state); }
  if (!controllable) {
    if (!card.element.hidden) hide(card);
    return;
  }
  if (!state.introDone) {
    state.introDone = true;
    state.lastObjective = objective;
    show(card, host, objective ? cardText("onboard.objective") : null, objective, cardText("onboard.controls"), FIRST_MS, nowMs, "intro");
    return;
  }
  if (objective !== state.lastObjective) {
    state.lastObjective = objective;
    // 첫 카드가 떠 있는 동안 목표가 막 정해지면(병렬 이벤트가 한 프레임 늦게) 조작 안내를 지우지 말고 첫 카드에 합친다.
    if (objective && !card.element.hidden && card.element.dataset.kind === "intro") {
      show(card, host, cardText("onboard.objective"), objective, cardText("onboard.controls"), FIRST_MS, nowMs, "intro");
      return;
    }
    if (objective) { show(card, host, cardText("onboard.newObjective"), objective, null, CHANGE_MS, nowMs, "change"); return; }
  }
  if (!card.element.hidden && nowMs >= card.hideAtMs) hide(card);
}

function cardText(key: "onboard.objective" | "onboard.newObjective" | "onboard.controls"): string {
  return vnUiText(vnExtrasLanguage(store.getCurrent()), key);
}

function show(card: ObjectiveCard, host: HTMLElement, label: string | null, objective: string | null, controls: string | null,
  durationMs: number, nowMs: number, kind: "intro" | "change"): void {
  const { element } = card;
  element.replaceChildren();
  const line = (className: string, text: string): void => {
    const node = document.createElement(className === "objective-card-text" ? "p" : "span");
    node.className = className; node.textContent = text; element.append(node);
  };
  if (label) line("objective-card-label", label);
  if (objective) line("objective-card-text", objective);
  if (controls) line("objective-card-controls", controls);
  if (!element.childElementCount) return;
  element.dataset.kind = kind;
  element.hidden = false;
  // 글이 바뀔 때마다 등장 애니메이션을 다시 건다.
  element.style.animation = "none"; void element.offsetWidth; element.style.animation = "";
  if (element.parentElement !== host) host.append(element);
  card.hideAtMs = nowMs + durationMs;
  if (!card.detach) {
    const close = (event: Event): void => { if (!(event instanceof KeyboardEvent && event.repeat)) hide(card); };
    // 캡처로 듣되 막지 않는다 — 그 키는 원래대로 이동·조사·메뉴로 간다.
    window.addEventListener("keydown", close, true);
    window.addEventListener("pointerdown", close, true);
    card.detach = () => { window.removeEventListener("keydown", close, true); window.removeEventListener("pointerdown", close, true); };
  }
}

function hide(card: ObjectiveCard): void {
  card.element.hidden = true;
  card.detach?.(); card.detach = null;
}
