import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultFreezeGuard } from "@/ai/pageFreezeGuard";

/** 실제 Web Locks 계약을 흉내낸다: 콜백이 끝날 때까지 락을 쥔다. */
function fakeLocks() {
  const held = new Set<string>();
  const seen: string[] = [];
  return {
    held,
    seen,
    api: {
      request: async (name: string, callback: () => Promise<unknown>): Promise<void> => {
        held.add(name);
        seen.push(name);
        try {
          await callback();
        } finally {
          held.delete(name);
        }
      },
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("defaultFreezeGuard", () => {
  it("가드가 살아 있는 동안 Web Lock 을 쥐고 있다", async () => {
    const locks = fakeLocks();
    vi.stubGlobal("navigator", { locks: locks.api });

    const release = await defaultFreezeGuard();

    expect(locks.held.size).toBe(1);
    release();
    await flush();
    expect(locks.held.size).toBe(0);
  });

  it("release 를 여러 번 불러도 터지지 않고 한 번만 놓는다", async () => {
    const locks = fakeLocks();
    vi.stubGlobal("navigator", { locks: locks.api });

    const release = await defaultFreezeGuard();
    release();
    release();
    await flush();

    expect(locks.held.size).toBe(0);
    expect(locks.seen).toHaveLength(1);
  });

  it("동시에 두 턴이 돌아도 서로를 막지 않는다", async () => {
    const locks = fakeLocks();
    vi.stubGlobal("navigator", { locks: locks.api });

    // 같은 이름이면 두 번째 request 가 첫 번째 해제까지 대기해 턴이 멈춘다.
    const first = await defaultFreezeGuard();
    const second = await defaultFreezeGuard();

    expect(locks.held.size).toBe(2);
    expect(new Set(locks.seen).size).toBe(2);
    first();
    second();
    await flush();
    expect(locks.held.size).toBe(0);
  });

  it("Web Locks 가 없는 환경(Node·구 브라우저)에서는 조용히 통과한다", async () => {
    vi.stubGlobal("navigator", undefined);

    const release = await defaultFreezeGuard();

    expect(() => release()).not.toThrow();
  });

  it("락 획득이 실패해도 턴을 깨지 않는다", async () => {
    vi.stubGlobal("navigator", {
      locks: { request: () => Promise.reject(new Error("lock denied")) },
    });

    const release = await defaultFreezeGuard();

    expect(() => release()).not.toThrow();
  });

  it("락을 잡는 데 오래 걸려도 턴 시작을 막지 않는다", async () => {
    // 획득을 영원히 지연시키는 구현. 가드는 keep-alive 일 뿐이라 턴을 볼모로 잡으면 안 된다.
    vi.stubGlobal("navigator", { locks: { request: () => new Promise<void>(() => {}) } });

    const release = await Promise.race([
      defaultFreezeGuard(),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
    ]);

    expect(release).not.toBe("timeout");
  });
});
