import { afterEach, describe, expect, it, vi } from "vitest";
import { emitRuntimeJuice, runtimeJuiceLog } from "@/player/runtimeJuice";

describe("emitRuntimeJuice", () => {
  afterEach(() => {
    const host = globalThis as typeof globalThis & {
      window?: Window & { __rpgzzuRuntimeJuice?: { log: unknown[] } };
      Audio?: unknown;
    };
    if (host.window?.__rpgzzuRuntimeJuice) host.window.__rpgzzuRuntimeJuice.log = [];
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
    window?: Window & { __rpgzzuRuntimeJuice?: { log: unknown[] }; __rpgzzuJuiceLog?: unknown };
    Audio?: unknown;
  };
  host.Audio = FakeAudio;
  host.window = host.window ?? ({} as Window & { __rpgzzuRuntimeJuice?: { log: unknown[] } });
  (host.window as { __rpgzzuRuntimeJuice?: { log: unknown[] } }).__rpgzzuRuntimeJuice = { log: [] };
}
