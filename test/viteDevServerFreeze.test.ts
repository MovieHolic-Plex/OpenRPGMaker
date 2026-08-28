import { afterEach, describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

/* 병렬 에이전트가 `src/` 를 건드리면 HMR 이 브라우저 QA 중인 페이지를 리로드시켜
 * 편집기 부팅이 깨진다(openwiki/testing.md). E2E 실행 동안에는 dev 서버를 얼려서
 * 그 경로 자체를 없앤다. 여기서 고정하는 건 "얼렸는지"가 아니라 "평소엔 안 얼린다"까지다 —
 * 개발 중 HMR 을 잃으면 그게 더 큰 손해라서. */

type ConfigFactory = (env: { mode: string; command: "serve" | "build" }) => {
  server?: { hmr?: unknown; watch?: unknown };
};

const factory = viteConfig as unknown as ConfigFactory;

function resolveServerOptions(freeze: string | undefined) {
  const previous = process.env.E2E_FREEZE_DEV_SERVER;
  if (freeze === undefined) delete process.env.E2E_FREEZE_DEV_SERVER;
  else process.env.E2E_FREEZE_DEV_SERVER = freeze;
  try {
    return factory({ mode: "development", command: "serve" }).server ?? {};
  } finally {
    if (previous === undefined) delete process.env.E2E_FREEZE_DEV_SERVER;
    else process.env.E2E_FREEZE_DEV_SERVER = previous;
  }
}

afterEach(() => {
  delete process.env.E2E_FREEZE_DEV_SERVER;
});

describe("dev server freeze for browser QA", () => {
  it("keeps HMR and the file watcher on for ordinary development", () => {
    const server = resolveServerOptions(undefined);
    expect(server.hmr).toBeUndefined();
    expect(server.watch).toMatchObject({ ignored: expect.any(Array) });
  });

  it("turns HMR off when the e2e runner owns the server", () => {
    const server = resolveServerOptions("1");
    expect(server.hmr).toBe(false);
  });

  it("stops watching files entirely so a concurrent src edit cannot reload the page", () => {
    const server = resolveServerOptions("1");
    expect(server.watch).toBeNull();
  });

  it("ignores any value other than an explicit 1", () => {
    const server = resolveServerOptions("0");
    expect(server.hmr).toBeUndefined();
    expect(server.watch).toMatchObject({ ignored: expect.any(Array) });
  });
});
