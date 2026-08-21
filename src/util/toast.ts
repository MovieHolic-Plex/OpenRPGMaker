// util/toast.ts
// 토스트 알림 스택. 성공/에러 메시지를 화면 하단에 잠깐 표시한다.
// 선택적 action 버튼(예: 삭제 직후 복구)을 붙일 수 있다.
//
// 왜 스택인가: 예전에는 모듈 전역 엘리먼트 **하나**를 재사용해서, 204개 호출 지점이 서로를
// 덮어썼다. 일괄 작업(붙여넣기 실패 + 잠금 + 범위 밖)에서 마지막 한 줄만 남아 **왜 실패했는지가
// 사라졌고**, 그중 error 가 95건이라 가장 필요한 정보가 가장 잘 지워졌다.
//
// 기존 계약은 그대로 지킨다 — `data-testid="toast"` 는 **항상 최신 토스트 하나**만 갖는다.
// (e2e 가 getByTestId("toast") 로 단일 요소를 기대하고, 만료 후 `not.toHaveClass(/show/)` 를 본다.)
// 그래서 최신 토스트는 만료돼도 DOM 에 남기고 `show` 만 뗀다. 밀려난 이전 토스트는 제거한다.

export type ToastKind = "info" | "ok" | "error";

export type ToastAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly testid?: string;
};

export type ToastOptions = {
  readonly kind?: ToastKind;
  readonly durationMs?: number;
  readonly action?: ToastAction;
};

/** 동시에 보여 줄 최대 개수. 넘치면 오래된 것부터 걷는다. */
const MAX_STACK = 4;

type ToastEntry = {
  readonly element: HTMLElement;
  timer: ReturnType<typeof setTimeout> | null;
};

let stackEl: HTMLElement | null = null;
let entries: ToastEntry[] = [];

function ensureStack(): HTMLElement {
  // fakeDom reinstall / body 교체 후 고아 노드를 붙잡지 않도록 현재 body 소속 여부를 확인한다.
  if (!stackEl || stackEl.parentNode !== document.body) {
    stackEl = document.createElement("div");
    stackEl.className = "toast-stack";
    stackEl.dataset.testid = "toast-stack";
    document.body.append(stackEl);
    entries = [];
  }
  return stackEl;
}

/** 최신 하나만 `toast` testid 를 갖는다 — 단일 요소를 기대하는 기존 계약. */
function retagEntries(): void {
  entries.forEach((entry, index) => {
    entry.element.dataset.testid = index === entries.length - 1 ? "toast" : "toast-item";
  });
}

function dropEntry(entry: ToastEntry): void {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  entry.element.remove();
  entries = entries.filter((candidate) => candidate !== entry);
  retagEntries();
}

function expireEntry(entry: ToastEntry): void {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  entry.element.classList.remove("show");
  // 최신 토스트는 남긴다 — 만료 후 `not.toHaveClass(/show/)` 를 보는 계약이 있다.
  if (entries[entries.length - 1] !== entry) dropEntry(entry);
}

function buildElement(message: string, kind: ToastKind, action: ToastAction | undefined, entry: ToastEntry): HTMLElement {
  const element = document.createElement("div");
  element.className = `toast ${kind} show${action ? " has-action" : ""}`;

  const messageEl = document.createElement("span");
  messageEl.className = "toast-message";
  messageEl.textContent = message;
  element.append(messageEl);

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.dataset.testid = action.testid ?? "toast-action";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      action.onClick();
      expireEntry(entry);
    });
    element.append(button);
  }
  return element;
}

export function toast(message: string, kindOrOptions: ToastKind | ToastOptions = "info"): void {
  // Node 단위 테스트(document 없음)에서는 조용히 무시 — 알림은 브라우저 전용.
  if (typeof document === "undefined" || !document.body) return;

  const options: ToastOptions = typeof kindOrOptions === "string" ? { kind: kindOrOptions } : kindOrOptions;
  const kind: ToastKind = options.kind ?? "info";
  const durationMs = options.durationMs ?? (kind === "error" ? 4000 : options.action ? 6000 : 2000);

  const stack = ensureStack();

  // 이미 사라진(만료된) 최신 토스트는 자리를 비켜준다 — 남겨두는 건 계약용이지 표시용이 아니다.
  const previous = entries[entries.length - 1];
  if (previous && !previous.element.classList.contains("show")) dropEntry(previous);

  const entry: ToastEntry = { element: null as unknown as HTMLElement, timer: null };
  const element = buildElement(message, kind, options.action, entry);
  Object.assign(entry, { element });

  stack.append(element);
  entries.push(entry);
  while (entries.length > MAX_STACK) dropEntry(entries[0]!);
  retagEntries();

  entry.timer = setTimeout(() => expireEntry(entry), durationMs);
}

/** 테스트 헬퍼: 스택을 비운다. */
export function resetToastsForTest(): void {
  for (const entry of [...entries]) dropEntry(entry);
  stackEl?.remove();
  stackEl = null;
  entries = [];
}
