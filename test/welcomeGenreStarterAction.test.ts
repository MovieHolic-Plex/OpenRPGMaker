import { describe, expect, it, vi } from "vitest";
import { applyWelcomeGenreStarterPlan } from "@/editor/welcomeGenreStarterAction";
import { welcomeGenreStarterPlanById } from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";

describe("confirmed welcome genre starter production boundary", () => {
  it("passes a detached recipe result to the new-project persistence path", async () => {
    const openProject = createBlankProject();
    openProject.meta.title = "keep-open-project";
    const before = structuredClone(openProject);
    const loadNewProject = vi.fn(async () => undefined);
    const focusStartMap = vi.fn();
    const plan = welcomeGenreStarterPlanById("partner-raise");

    const result = await applyWelcomeGenreStarterPlan(plan, { loadNewProject, focusStartMap });

    expect(openProject).toEqual(before);
    expect(loadNewProject).toHaveBeenCalledOnce();
    expect(loadNewProject).toHaveBeenCalledWith(result.project, { title: plan.title });
    expect(result.project).not.toBe(openProject);
    expect(result.receipt.adapterId).toBe(plan.adapterId);
    expect(result.receipt.authoredContentSeeded).toBe(false);
    expect(focusStartMap).toHaveBeenCalledOnce();
  });
});
