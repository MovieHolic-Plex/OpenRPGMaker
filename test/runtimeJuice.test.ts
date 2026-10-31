import { afterEach, describe, expect, it, vi } from "vitest";
import { emitRuntimeJuice, runtimeJuiceLog } from "@/player/runtimeJuice";

describe("emitRuntimeJuice", () => {
  afterEach(() => {
    const host = globalThis as typeof globalThis & {
      window?: Window & { __oprnRuntimeJuice?: { log: unknown[] } };
      Audio?: unknown;
    };
    if (host.window?.__oprnRuntimeJuice) host.window.__oprnRuntimeJuice.log = [];
    Reflect.deleteProperty(host, "Audio");
    vi.restoreAllMocks();
  });

  it("returns resolved entry and logs override soundResourceId", () => {
    installJuiceGlobals();
    const entry = emitRuntimeJuice({
      event: "title-select",
      soundResourceId: "easyrpg-sound-cursor2",
    });
    expect(entry.soundResourceId).toBe("easyrpg-sound-cursor2");
    expect(entry.event).toBe("title-select");
    expect(entry.motionClass).toBe("juice-title-select");
    expect(runtimeJuiceLog().at(-1)?.soundResourceId).toBe("easyrpg-sound-cursor2");
  });

  it("title cursor/confirm follow the project SE cue table when the title has no own sound", () => {
    installJuiceGlobals();
    const project = { meta: {}, system: { seCues: { cursor: "store-cursor-a", confirm: "store-confirm-a" } } } as never;
    expect(emitRuntimeJuice({ event: "title-select", project }).soundResourceId).toBe("store-cursor-a");
    expect(emitRuntimeJuice({ event: "title-confirm", project }).soundResourceId).toBe("store-confirm-a");
    // 타이틀 전용 소리(titleScreen.sounds → soundResourceId)를 저작했으면 그쪽이 이긴다.
    expect(emitRuntimeJuice({ event: "title-select", project, soundResourceId: "title-own-cursor" }).soundResourceId).toBe("title-own-cursor");
  });

  it("keeps default sound when override is omitted", () => {
    installJuiceGlobals();
    const entry = emitRuntimeJuice({ event: "title-enter" });
    expect(entry.soundResourceId).toBe("easyrpg-sound-decision2");
    expect(runtimeJuiceLog().at(-1)?.soundResourceId).toBe("easyrpg-sound-decision2");
  });
});

function installJuiceGlobals(): void {
  class FakeAudio {
    volume = 1;
    play = () => Promise.resolve();
  }
  const host = globalThis as typeof globalThis & {
    window?: Window & { __oprnRuntimeJuice?: { log: unknown[] }; __oprnJuiceLog?: unknown };
    Audio?: unknown;
  };
  host.Audio = FakeAudio;
  host.window = host.window ?? ({} as Window & { __oprnRuntimeJuice?: { log: unknown[] } });
  (host.window as { __oprnRuntimeJuice?: { log: unknown[] } }).__oprnRuntimeJuice = { log: [] };
}
