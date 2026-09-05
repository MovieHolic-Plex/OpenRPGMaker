// ai/yieldToUi.ts
// 동기 도구 실행 사이에 이벤트 루프를 한 번 양보한다.
//
// AssistantSession 은 tool_started → runTool → tool_call 을 한 동기 무더기로 낸다.
// 그 사이 await 가 없으면 라이브 행·고스트가 한 프레임도 그려지지 않고, 맵 페인트가
// 멈춘다(실측: Chromium 존재 폴링 0/17). 표시 400ms 체류는 전환만 미룰 뿐 실행은
// 그대로 메인 스레드를 잡는다. 여기서 한 프레임을 내준다.
//
// 포커스가 있는 보이는 탭: requestAnimationFrame 한 틱. Node/테스트: 즉시 resolve.
//
// 숨거나 포커스를 잃은 탭: MessageChannel 태스크로 양보한다. rAF 는 멈추고 setTimeout 도
// 백그라운드 제한을 받으므로 50ms 타이머 폴백만으로는 도구마다 오래 멈출 수 있다.
// 프레임을 기다리다가 숨겨진 경우도 전환한다. 탭 자체의 freeze/discard 는 별개다.

export type YieldToUi = () => Promise<void>;

export const YIELD_TO_UI_FALLBACK_MS = 50;

export function defaultYieldToUi(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();

  return new Promise((resolve) => {
    const doc = typeof document !== "undefined" ? document : undefined;
    const win = doc?.defaultView;
    const isBackground = (): boolean => doc?.visibilityState === "hidden" || doc?.hasFocus?.() === false;
    let settled = false;
    let frame: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: MessageChannel | undefined;

    const clearPaintWait = (): void => {
      if (frame !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
      frame = undefined;
      timer = undefined;
    };
    const closeChannel = (): void => {
      channel?.port1.close();
      channel?.port2.close();
      channel = undefined;
    };
    const stopWatching = (): void => {
      doc?.removeEventListener?.("visibilitychange", onBackgroundChange);
      win?.removeEventListener("blur", onBackgroundChange);
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearPaintWait();
      stopWatching();
      closeChannel();
      resolve();
    };
    const yieldInBackground = (): void => {
      clearPaintWait();
      stopWatching();
      // Promise.resolve 만으로는 입력·중단 이벤트가 실행될 태스크 경계를 내주지 않는다.
      try {
        channel = new MessageChannel();
        channel.port1.onmessage = finish;
        channel.port2.postMessage(null);
      } catch {
        closeChannel();
        // MessageChannel 미지원 환경에서도 동기 루프가 되지 않게 한다.
        timer = setTimeout(finish, 0);
      }
    };
    const onBackgroundChange = (): void => {
      if (!settled && isBackground()) yieldInBackground();
    };

    if (isBackground()) {
      yieldInBackground();
      return;
    }
    doc?.addEventListener?.("visibilitychange", onBackgroundChange);
    win?.addEventListener("blur", onBackgroundChange);
    // visible 이지만 렌더가 멈추거나 rAF 호출이 실패하는 환경의 안전망.
    timer = setTimeout(finish, YIELD_TO_UI_FALLBACK_MS);
    try {
      frame = requestAnimationFrame(finish);
    } catch {
      // 위 타이머가 완료한다.
    }
  });
}
