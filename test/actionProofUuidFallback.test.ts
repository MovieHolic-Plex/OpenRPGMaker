/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runActionCombatTest } from "@/editor/actionCombatRuntimeProbe";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function insecureActionProject() {
  const project = createBlankProject();
  project.system.actionCombat = { enabled: true };
  project.maps[project.startMapId]!.actionCombat = true;
  return project;
}

describe("action proof run identity on insecure origins", () => {
  it("issues a run id without crypto.randomUUID (plain HTTP has no secure context)", async () => {
    const api = globalThis.crypto;
    const shim = Object.create(null);
    Object.assign(shim, api);
    vi.stubGlobal("crypto", shim as Crypto);
    expect("randomUUID" in (globalThis.crypto as object)).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no-player", { status: 404 })));
    const project = insecureActionProject();
    const receipt = await runActionCombatTest(project, { mapId: project.startMapId });
    expect(receipt.status).toBe("unverified");
  });
});
