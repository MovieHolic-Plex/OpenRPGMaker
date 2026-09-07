// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { preparePublication } from "@/project/publication";

// Observe the actual exported boot -> renderer contract; save/DOM behavior is exercised in Chrome separately.
const { rendered } = vi.hoisted(() => ({ rendered: vi.fn() }));
vi.mock("@/player/player", () => ({ renderPlayer: rendered }));
vi.mock("@/player/audio", () => ({ stopAllAudio: vi.fn() }));
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));

afterEach(() => {
  vi.unstubAllGlobals(); rendered.mockReset(); localStorage.clear();
  Reflect.deleteProperty(window, "__OPENRPG_BOOT__");
  document.body.replaceChildren(); history.replaceState(null, "", "/");
});

it.each([
  { pathname: "/play/listing-a/releases/" + "a".repeat(64) + "/player.html", embedded: false, scope: "listing-a" },
  { pathname: "/play/listing-b/player.html", embedded: true, scope: "listing-b" },
  { pathname: "/renamed-standalone.html", embedded: true, scope: undefined },
])("boots $pathname with listing authority, without migrating another listing's legacy bytes", async ({ pathname, embedded, scope }) => {
  vi.resetModules(); history.replaceState(null, "", pathname);
  document.body.innerHTML = '<div id="app"></div>';
  const project = createBlankProject(); project.meta.publication = preparePublication("a".repeat(64));
  const raw = serialize(project);
  Reflect.set(window, "__OPENRPG_BOOT__", { saveNamespace: "uploader-copied-host", qaInstrumentation: false });
  localStorage.setItem("rpg-zzu:save-slot:1", "victim-original-bytes");
  if (embedded) {
    const node = document.createElement("script"); node.type = "application/json";
    node.id = "oprn-standalone-project"; node.textContent = raw; document.body.append(node);
  }
  const fetch = vi.fn().mockResolvedValue(new Response(raw)); vi.stubGlobal("fetch", fetch);
  const ready = new Promise<void>(resolve => rendered.mockImplementation(() => resolve()));
  await import("@/player/exportEntry"); await ready;
  expect(rendered.mock.calls[0]?.[1].saveIsolationScope).toBe(scope);
  expect(fetch).toHaveBeenCalledTimes(embedded ? 0 : 1);
  if (scope) {
    expect(localStorage.getItem("rpg-zzu:save-slot:1")).toBe("victim-original-bytes");
    expect(localStorage.getItem("oprn:save-slot:1")).toBeNull();
    expect(localStorage.getItem("oprn:storage-migrated")).toBeNull();
  } else {
    expect(localStorage.getItem("oprn:save-slot:1")).toBe("victim-original-bytes");
  }
});
