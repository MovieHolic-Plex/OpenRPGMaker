/** Follow live output only while the reader stays at the end of this log. */
export interface ConversationScroll {
  readonly notice: HTMLButtonElement;
  following(): boolean;
  changed(): void;
  latest(): void;
  dispose(): void;
}

const controllers = new WeakMap<HTMLElement, ConversationScroll>();

export function conversationScroll(log: HTMLElement): ConversationScroll {
  const existing = controllers.get(log);
  if (existing) return existing;
  const atBottom = () => log.scrollHeight - log.clientHeight - log.scrollTop <= 24;
  let follow = atBottom();
  let frame: number | undefined;
  let lastAutomaticTop = log.scrollTop;
  let disposed = false;
  const notice = document.createElement("button");
  notice.type = "button";
  notice.className = "ai-new-replies";
  notice.dataset.testid = "ai-new-replies";
  notice.textContent = "새 응답 보기";
  notice.hidden = true;
  const scroll = () => {
    if (disposed || !follow) return;
    log.scrollTop = log.scrollHeight;
    lastAutomaticTop = log.scrollTop;
    if (!notice.hidden) notice.hidden = true;
  };
  /**
   * DOM 이 바뀌었음을 알리는 관찰자용: 프레임 시작에서 한 번만 맨 아래로 맞춘다.
   * 왜(2026-10-15 실측, 조수 스트림 24초): 관찰자 콜백이 변경 직후 동기로 `scrollHeight` 를 읽어 매번 강제 레이아웃(174번, 합 1.0s, 최대 79ms)이었다.
   * 프레임 시작(rAF)에서 읽으면 그 프레임의 레이아웃에 묻히고, 같은 프레임 안의 변경은 한 번으로 모인다. 그려지기 전에 맞춰지므로 눈에 보이는 차이는 없다.
   */
  const schedule = () => {
    if (disposed) return;
    if (!follow) { if (notice.hidden) notice.hidden = false; return; }
    if (typeof requestAnimationFrame !== "function") { scroll(); return; }
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => { frame = undefined; scroll(); });
  };
  const changed = () => {
    if (disposed) return;
    if (!follow) { if (notice.hidden) notice.hidden = false; return; }
    // Synchronous appends and streaming text use the same policy. A later image
    // resize also follows, without turning the reader's earlier position into a jump.
    scroll();
    if (frame !== undefined || typeof requestAnimationFrame !== "function") return;
    frame = requestAnimationFrame(() => { frame = undefined; scroll(); });
  };
  const stopFollowing = () => {
    follow = false;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
  const onWheel = (event: WheelEvent) => { if (event.deltaY < 0) stopFollowing(); };
  const onKey = (event: KeyboardEvent) => {
    if (["ArrowUp", "PageUp", "Home"].includes(event.key)) stopFollowing();
  };
  const onScroll = () => {
    if (frame !== undefined && Math.abs(log.scrollTop - lastAutomaticTop) < 1) return;
    follow = atBottom();
    if (follow) notice.hidden = true;
    else stopFollowing();
  };
  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(schedule);
  observer?.observe(log, { childList: true, subtree: true, characterData: true });
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { if (follow) schedule(); });
  const observeChildren = () => {
    resize?.disconnect();
    resize?.observe(log);
    for (const child of log.children) resize?.observe(child);
  };
  const children = typeof MutationObserver === "undefined" ? null : new MutationObserver(observeChildren);
  children?.observe(log, { childList: true });
  observeChildren();
  log.addEventListener("scroll", onScroll);
  log.addEventListener("wheel", onWheel, { passive: true });
  log.addEventListener("keydown", onKey);
  log.addEventListener("touchstart", stopFollowing, { passive: true });
  const controller: ConversationScroll = {
    notice, following: () => follow,
    changed,
    latest() { follow = true; scroll(); changed(); },
    dispose() {
      disposed = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer?.disconnect(); children?.disconnect(); resize?.disconnect();
      log.removeEventListener("scroll", onScroll);
      log.removeEventListener("wheel", onWheel);
      log.removeEventListener("keydown", onKey);
      log.removeEventListener("touchstart", stopFollowing);
      notice.remove(); controllers.delete(log);
    },
  };
  notice.addEventListener("click", () => controller.latest());
  controllers.set(log, controller);
  return controller;
}

export function followConversationLog(log: HTMLElement): void {
  conversationScroll(log).changed();
}
