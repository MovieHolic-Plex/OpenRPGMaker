import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevShowcaseProjectForLocation } from "@/editor/devShowcaseProjects";

describe("local dev project URL overrides", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets projectRecovered load the LegacyDb canonical project instead of a generated showcase", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "127.0.0.1",
        search: "?projectRecovered=1&townCityShowcase=1",
      },
    });

    const project = createDevShowcaseProjectForLocation();

    expect(project).toBeNull();
  });

  it("does not let generated showcase URLs replace the canonical LegacyDb default by themselves", () => {
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
});
