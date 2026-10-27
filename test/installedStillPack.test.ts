import { afterEach, describe, expect, it, vi } from "vitest";
import { isOpeningStillAvailable, setInstalledStillPackFiles } from "@/assets/installedStillPack";
import { listOpeningStillMoods, unsuitableOpeningStillMessage } from "@/assets/openingStillMoods";
import { rejectUnavailablePackStills } from "@/editor/tools/stillPackGuard";
import { createBlankProject } from "@/project/defaults/blankProject";

afterEach(() => { setInstalledStillPackFiles(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("opening still pack availability", () => {
  it("hides and rejects pack stills that are not installed", () => {
    setInstalledStillPackFiles([]);
    expect(isOpeningStillAvailable("oprn-pack-still-sky-01")).toBe(false);
    expect(isOpeningStillAvailable("oprn-still-harbor")).toBe(true);
    expect(listOpeningStillMoods().some((mood) => mood.id.startsWith("oprn-pack-still-"))).toBe(false);
    expect(unsuitableOpeningStillMessage("oprn-pack-still-sky-01", "bg")).toContain("stills:install");
  });

  it("offers installed pack stills", () => {
    setInstalledStillPackFiles(["sky-01.jpg"]);
    expect(isOpeningStillAvailable("oprn-pack-still-sky-01")).toBe(true);
    expect(isOpeningStillAvailable("oprn-pack-still-sky-02")).toBe(false);
    expect(listOpeningStillMoods().map((mood) => mood.id)).toContain("oprn-pack-still-sky-01");
  });

  it("treats a configured CDN as available", () => {
    setInstalledStillPackFiles([]);
    vi.stubEnv("VITE_STILL_CDN_BASE", "https://cdn.example.test");
    expect(isOpeningStillAvailable("oprn-pack-still-sky-01")).toBe(true);
  });

  it("rejects only newly added unavailable references", () => {
    setInstalledStillPackFiles([]);
    const before = createBlankProject();
    const draft = structuredClone(before);
    draft.endings = [{ id: "e", name: "e", presentation: { backgroundResourceId: "oprn-pack-still-winter-02" } } as never];
    expect(() => rejectUnavailablePackStills(before, draft)).toThrow(/stills:install/);
    expect(() => rejectUnavailablePackStills(draft, structuredClone(draft))).not.toThrow();
  });
});
