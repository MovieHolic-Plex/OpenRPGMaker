import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevShowcaseProjectForLocation } from "@/project/devShowcaseProjects";

describe("local dev project URL overrides", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets supabaseRecovered load the Supabase canonical project instead of a generated showcase", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?supabaseRecovered=1&townCityShowcase=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    expect(project).toBeNull();
  });

  it("does not let generated showcase URLs replace the canonical Supabase default by themselves", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?townCityShowcase=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    expect(project).toBeNull();
  });

  it("keeps generated showcase URLs available behind the explicit devProject flag", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?devProject=1&townCityShowcase=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    expect(project?.maps[project.startMapId]?.width).toBe(100);
  });

  it("creates a playable shop showcase behind the explicit devProject flag", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?devProject=1&shopShowcase=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();
    const commands = Object.values(project?.maps ?? {}).flatMap((map) =>
      map.events.flatMap((event) => [...(event.commands ?? []), ...(event.pages ?? []).flatMap((page) => page.commands)])
    );

    expect(project?.meta.title).toBe("상점 데모");
    expect(commands).toContainEqual(
      expect.objectContaining({
        kind: "shop",
        itemIds: expect.arrayContaining(["item_potion", "item_ether", "item_antidote"]),
        allowSell: true,
        quantityMode: "single",
        shopType: "normal",
        messageType: "welcome",
        branchOnTransaction: false,
        transactionBranch: [],
      })
    );
  });
});
