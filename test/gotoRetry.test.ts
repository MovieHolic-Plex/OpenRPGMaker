import { describe, expect, it, vi } from "vitest";
import {
  TRANSIENT_NAVIGATION_NET_ERRORS,
  gotoWithRetry,
  isTransientNavigationError,
} from "../scripts/lib/goto-retry.mjs";

/** Playwright 가 실제로 던지는 형태의 네비게이션 에러를 흉내낸다. */
function navError(code: string): Error {
  return new Error(`page.goto: net::${code} at http://127.0.0.1:9173/\nCall log:\n  - navigating to "/"`);
}

/** page.goto 만 흉내내는 최소 스텁. 호출 인자를 기록한다. */
function stubPage(behaviors: Array<Error | { ok: boolean }>) {
  const calls: Array<{ url: string; options: unknown }> = [];
  let index = 0;
  return {
    calls,
    goto: vi.fn(async (url: string, options?: unknown) => {
      calls.push({ url, options });
      const behavior = behaviors[Math.min(index, behaviors.length - 1)];
      index += 1;
      if (behavior instanceof Error) throw behavior;
      return behavior;
    }),
  };
}

describe("isTransientNavigationError", () => {
  it("recognizes the network-change abort that VPN/Wi-Fi/docker churn produces", () => {
    expect(isTransientNavigationError(navError("ERR_NETWORK_CHANGED"))).toBe(true);
  });

  it("recognizes the other network-stack aborts of the same family", () => {
    for (const code of TRANSIENT_NAVIGATION_NET_ERRORS) {
      expect(isTransientNavigationError(navError(code))).toBe(true);
    }
  });

  it("does not treat a refused connection as transient (dev server is simply down)", () => {
    expect(isTransientNavigationError(navError("ERR_CONNECTION_REFUSED"))).toBe(false);
  });

  it("does not treat a navigation timeout as transient", () => {
    expect(isTransientNavigationError(new Error("page.goto: Timeout 30000ms exceeded."))).toBe(false);
  });

  it("does not treat non-errors as transient", () => {
    expect(isTransientNavigationError(undefined)).toBe(false);
    expect(isTransientNavigationError("ERR_NETWORK_CHANGED")).toBe(false);
  });
});

describe("gotoWithRetry", () => {
  it("returns the response without retrying when the first navigation succeeds", async () => {
    const page = stubPage([{ ok: true }]);
    const sleep = vi.fn(async () => {});

    const response = await gotoWithRetry(page, "/?freshProject=1", { sleep });

    expect(response).toEqual({ ok: true });
    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries a network-change abort and returns the later success", async () => {
    const page = stubPage([navError("ERR_NETWORK_CHANGED"), { ok: true }]);
    const sleep = vi.fn(async () => {});

    const response = await gotoWithRetry(page, "/", { sleep, delayMs: 40 });

    expect(response).toEqual({ ok: true });
    expect(page.goto).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(40);
  });

  it("rethrows a non-transient failure immediately instead of burning attempts", async () => {
    const page = stubPage([navError("ERR_CONNECTION_REFUSED")]);
    const sleep = vi.fn(async () => {});

    await expect(gotoWithRetry(page, "/", { sleep })).rejects.toThrow("ERR_CONNECTION_REFUSED");
    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("gives up after the attempt budget and rethrows the last transient error", async () => {
    const page = stubPage([navError("ERR_NETWORK_CHANGED")]);
    const sleep = vi.fn(async () => {});

    await expect(gotoWithRetry(page, "/", { attempts: 3, sleep })).rejects.toThrow("ERR_NETWORK_CHANGED");
    expect(page.goto).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("forwards goto options and keeps the retry knobs out of them", async () => {
    const page = stubPage([{ ok: true }]);

    await gotoWithRetry(page, "/?blankProject=1", {
      waitUntil: "domcontentloaded",
      timeout: 12_000,
      attempts: 2,
      delayMs: 10,
      sleep: async () => {},
      onRetry: () => {},
    });

    expect(page.calls[0]).toEqual({
      url: "/?blankProject=1",
      options: { waitUntil: "domcontentloaded", timeout: 12_000 },
    });
  });

  it("reports each retry so a capture script can log why it re-navigated", async () => {
    const page = stubPage([navError("ERR_NETWORK_CHANGED"), navError("ERR_NETWORK_CHANGED"), { ok: true }]);
    const seen: Array<{ attempt: number; message: string }> = [];

    await gotoWithRetry(page, "/", {
      attempts: 3,
      sleep: async () => {},
      onRetry: (error: unknown, attempt: number) => {
        seen.push({ attempt, message: error instanceof Error ? error.message.split("\n")[0] : "" });
      },
    });

    expect(seen.map((entry) => entry.attempt)).toEqual([1, 2]);
    expect(seen[0].message).toContain("net::ERR_NETWORK_CHANGED");
  });
});
