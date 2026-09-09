import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevShowcaseProjectForLocation } from "@/editor/devShowcaseProjects";
import fixture from "@/project/defaults/fixtures/dew-village-demo.json";

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

  it("creates a true blank project for the blankProject URL", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?blankProject=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    if (!project) throw new Error("expected fresh blank project");
    expect(project?.meta.title).toBe("새 프로젝트");
    expect(Object.keys(project.maps)).toHaveLength(1);
    expect(project.maps[project.startMapId]?.events).toHaveLength(0);
  });

  it("keeps the legacy freshProject URL on the sample adventure (32+ e2e specs rely on it)", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?freshProject=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    if (!project) throw new Error("expected sample adventure project");
    expect(project.meta.title).toBe(fixture.meta.title);
    expect(Object.keys(project.maps).sort()).toEqual(Object.keys(fixture.maps).sort());
    expect(project.startMapId).toBe(fixture.startMapId);
  });

  it("keeps the sample adventure behind an explicit example URL flag", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?freshProject=1&defaultAdventure=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    if (!project) throw new Error("expected sample adventure project");
    expect(project.meta.title).toBe(fixture.meta.title);
    expect(Object.keys(project.maps).sort()).toEqual(Object.keys(fixture.maps).sort());
    expect(project.startMapId).toBe(fixture.startMapId);
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
