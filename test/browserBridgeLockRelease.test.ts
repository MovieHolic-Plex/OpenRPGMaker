/** @vitest-environment happy-dom */
// 브라우저 브리지는 페이지마다 새 탭 ID 를 만든다. 새로고침한 페이지가 자기 이전 임대(90초)를
// 「호스트님이 편집 중입니다」로 보지 않도록, 떠나는 페이지는 쥔 잠금을 keepalive 로 놓아야 한다.
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Sent = { body: { channel: string; payload: { resource: string; release?: boolean } }; keepalive?: boolean; session: string };

let sent: Sent[] = [];

beforeEach(() => {
  sent = [];
  vi.resetModules();
  (window as unknown as { __OPRN_BRIDGE__: unknown }).__OPRN_BRIDGE__ = { endpoint: "/__oprn/bridge", token: "t" };
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ body, keepalive: init.keepalive, session: (init.headers as Record<string, string>)["x-oprn-session"] });
    const kind = body.payload?.release ? "released" : body.payload?.resource === "map:taken" ? "locked" : "held";
    return new Response(JSON.stringify({ kind, expiresAt: Date.now() + 90_000 }), { status: 200 });
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

type Bridge = { team: { lock(input: { resource: string; release?: boolean }): Promise<{ kind: string }> } };
const bridge = () => (window as unknown as { oprn: Bridge }).oprn;

it("pagehide 때 이 탭이 쥔 잠금만 같은 탭 ID 로 keepalive 해제한다", async () => {
  await import("../electron/browser/bridge");
  await bridge().team.lock({ resource: "map:1" });
  await bridge().team.lock({ resource: "map:2" });
  await bridge().team.lock({ resource: "map:2", release: true });
  await bridge().team.lock({ resource: "map:taken" });
  const session = sent[0]!.session;
  sent = [];

  window.dispatchEvent(new Event("pagehide"));
  await Promise.resolve();

  expect(sent.map(s => s.body.payload)).toEqual([{ resource: "map:1", release: true }]);
  expect(sent[0]).toMatchObject({ keepalive: true, session });
});

it("잠금을 쥐지 않았으면 pagehide 에 아무것도 보내지 않는다", async () => {
  await import("../electron/browser/bridge");
  window.dispatchEvent(new Event("pagehide"));
  await Promise.resolve();
  expect(sent).toEqual([]);
});
