import { findByTestId, type FakeElement } from "./fakeDom";

/** Observe the real panel's busy -> idle transition, not a fixed number of tasks. */
export async function sendAiTurn(panel: FakeElement): Promise<void> {
  const abort = findByTestId(panel, "ai-abort");
  const send = findByTestId(panel, "ai-send");
  if (!abort || !send) throw new Error("AI turn controls are missing");
  const descriptor = Object.getOwnPropertyDescriptor(abort, "hidden");
  let hidden = abort.hidden;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // FakeElement.hidden is a data property. Preserve its behavior while subscribing
  // before the click; the initially hidden button is not a completed turn.
  const ended = new Promise<void>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("AI turn did not become idle within 10s")), 10_000);
    Object.defineProperty(abort, "hidden", {
      configurable: true,
      get: () => hidden,
      set: (value: boolean) => {
        hidden = value;
        if (!value) started = true;
        else if (started) resolve();
      },
    });
  });
  try {
    send.click();
    await ended;
  } finally {
    clearTimeout(timer);
    Object.defineProperty(abort, "hidden", { ...descriptor, value: hidden });
  }
}
