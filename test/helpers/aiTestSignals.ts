import { setTimeout, clearTimeout } from "node:timers";
import type { ImageGenerationQueue, ImageQueueSnapshot } from "@/ai/imageGenerationQueue";

/** Register before triggering work. The timer is a failure deadline, never a delay. */
export function signal<T = void>(label = "AI test signal") {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  const timer = setTimeout(() => reject(new Error(`${label} was not delivered`)), 10_000);
  return { promise: promise.finally(() => clearTimeout(timer)), resolve };
}

export function queueTransition(queue: ImageGenerationQueue, predicate: (snapshot: ImageQueueSnapshot) => boolean): Promise<void> {
  const done = signal();
  const off = queue.subscribe((snapshot) => {
    if (predicate(snapshot)) { off(); done.resolve(); }
  });
  return done.promise.finally(off);
}

export function mountField(render: () => HTMLElement): HTMLElement {
  const field = render();
  document.body.append(field);
  return field;
}

export function fieldByTestId<T extends HTMLElement = HTMLInputElement>(root: HTMLElement, testId: string): T | null {
  return root.querySelector<T>(`[data-testid="${testId}"]`);
}
