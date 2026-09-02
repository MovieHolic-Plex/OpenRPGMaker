/** @vitest-environment happy-dom */
// Phaser 는 <script> 로 한 번만 붙인다. 첫 로드가 거절된 Promise 를 모듈이 붙잡고 있으면
// 복구 패널의 「다시 시도」가 영원히 같은 거부를 되풀이한다. 실패 시 손잡이를 비우는 것이 계약이다.
// happy-dom 은 append 한 <script> 를 실제로 받으러 가서 우리 가짜 error 와 경합하므로
// append 는 기록만 하고 DOM 에는 넣지 않는다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetPhaserRuntimeForTest, ensurePhaser } from "@/app/phaserRuntime";

function fakePhaser(): typeof import("phaser") {
  return { AUTO: 1 } as unknown as typeof import("phaser");
}

function interceptScripts(): HTMLScriptElement[] {
  const scripts: HTMLScriptElement[] = [];
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const element = createElement(tag);
    if (tag === "script") scripts.push(element as HTMLScriptElement);
    return element;
  });
  vi.spyOn(document.head, "append").mockImplementation((node) => node);
  return scripts;
}

beforeEach(() => {
  _resetPhaserRuntimeForTest();
  delete window.Phaser;
});

afterEach(() => {
  _resetPhaserRuntimeForTest();
  delete window.Phaser;
  vi.restoreAllMocks();
});

describe("ensurePhaser", () => {
  it("retries after a failed script load instead of reusing the rejected promise", async () => {
    const scripts = interceptScripts();

    const first = ensurePhaser();
    expect(scripts).toHaveLength(1);
    scripts[0]!.onerror?.(new Event("error"));
    await vi.waitFor(() => expect(scripts).toHaveLength(2));
    scripts[1]!.onerror?.(new Event("error"));
    await expect(first).rejects.toThrow(/Failed to load/);

    const second = ensurePhaser();
    expect(scripts).toHaveLength(3);
    window.Phaser = fakePhaser();
    scripts[2]!.onload?.(new Event("load"));
    await expect(second).resolves.toBe(window.Phaser);
  });

  it("auto-retries a transient script failure before giving up", async () => {
    const scripts = interceptScripts();

    const pending = ensurePhaser();
    expect(scripts).toHaveLength(1);
    scripts[0]!.onerror?.(new Event("error"));
    await vi.waitFor(() => expect(scripts.length).toBeGreaterThanOrEqual(2));
    window.Phaser = fakePhaser();
    scripts[scripts.length - 1]!.onload?.(new Event("load"));
    await expect(pending).resolves.toBe(window.Phaser);
  });
});
