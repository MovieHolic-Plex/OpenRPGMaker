import { store } from "@/project/store";
import { vnExtrasLanguage } from "@/project/vnExtras";
import { vnUiText } from "@/player/vnExtrasStrings";

/**
 * 첫 조작 순간·목표가 바뀔 때 화면 위쪽 끝에 잠깐 뜨는 알림 띠(이름은 옛 「목표 카드」 그대로다).
 *
 * 목표 줄(zone-feedback-objective)은 구석의 작은 줄이라 판정자 셋이 「안내 없음」으로 읽었다(2026-10-29 vm3·vm4·vm5) — 그래서 바뀌는 순간에는
 * 한 번 또렷이 알린다. 처음에는 화면 가운데 카드였는데 320×240 화면의 5분의 1 을 덮어 방이 안 보였다(2026-11-13 오너 «HUD 가 개판»).
 * 지금은 목표 줄이 앉는 오른쪽 위 모서리에서 한두 줄짜리 띠로 뜨고, 닫히면 그 자리에 목표 줄이 남는다. 어떤 게임에서도 가운데를 덮지 않는다.
 *
 * - 세션의 첫 조작 가능 순간: 목표(있으면, 한 줄) + 조작 안내 한 줄, FIRST_MS 동안.
 * - 그 뒤 목표 글이 바뀌면: 「새 목표」 + 글(두 줄까지), CHANGE_MS 동안(대사·메뉴 중에 바뀌면 다시 조작할 수 있을 때).
 * - 아무 키·클릭이나 닫는다. 키는 삼키지 않는다 — 띠가 떠 있어도 이동·조사는 그대로 된다.
 * - 같은 세션 안에서는 장면을 다시 만들어도(맵 이동) 첫 띠를 되풀이하지 않는다(세션 키 WeakMap).
 */
const FIRST_MS = 2800;
const CHANGE_MS = 2200;

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
    show(card, host, objective ? cardText("onboard.objective") : null, objective, controlsText(host), FIRST_MS, nowMs, "intro");
    return;
  }
  if (objective !== state.lastObjective) {
    state.lastObjective = objective;
    // 첫 카드가 떠 있는 동안 목표가 막 정해지면(병렬 이벤트가 한 프레임 늦게) 조작 안내를 지우지 말고 첫 카드에 합친다.
    if (objective && !card.element.hidden && card.element.dataset.kind === "intro") {
      show(card, host, cardText("onboard.objective"), objective, controlsText(host), FIRST_MS, nowMs, "intro");
      return;
    }
    if (objective) { show(card, host, cardText("onboard.newObjective"), objective, null, CHANGE_MS, nowMs, "change"); return; }
  }
  if (!card.element.hidden && nowMs >= card.hideAtMs) hide(card);
}

/** 터치 플레이 화면(playSurface 가 data-touch-ui 를 단다)에서는 키보드 글쇠 대신 화면 조작 단추 이름을 쓴다(fs-vqa-fix-all, 390 실측). */
function controlsText(host: HTMLElement): string {
  const touch = host.closest<HTMLElement>(".play-viewport")?.dataset.touchUi === "true";
  return cardText(touch ? "onboard.controlsTouch" : "onboard.controls");
}

function cardText(key: "onboard.objective" | "onboard.newObjective" | "onboard.controls" | "onboard.controlsTouch"): string {
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
