import { describe, expect, it, vi } from "vitest";
import { applyWelcomeGenreSystemPresetPlan } from "@/editor/welcomeGenreSystemPresetAction";
import { welcomeGenreSystemPresetPlanById } from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";

describe("confirmed welcome blank-project system preset boundary", () => {
  it("passes a detached preset result only to the verified remote switch path", async () => {
    const openProject = createBlankProject();
    openProject.meta.title = "keep-open-project";
    const before = structuredClone(openProject);
    const adoptProject = vi.fn(async () => undefined);
    const focusStartMap = vi.fn();
    const plan = welcomeGenreSystemPresetPlanById("partner-raise");

    const result = await applyWelcomeGenreSystemPresetPlan(plan, {
      adoptProject,
      focusStartMap,
    });

    expect(openProject).toEqual(before);
    expect(adoptProject).toHaveBeenCalledOnce();
    expect(adoptProject).toHaveBeenCalledWith(result.project, { title: plan.title });
    expect(result.project).not.toBe(openProject);
    expect(result.receipt.kind).toBe("blank-project-system-preset");
    expect(result.receipt.authoredContentSeeded).toBe(false);
    expect(focusStartMap).toHaveBeenCalledOnce();
  });

  it("does not focus or report success when the remote switch fails", async () => {
    const focusStartMap = vi.fn();
    await expect(applyWelcomeGenreSystemPresetPlan(
      welcomeGenreSystemPresetPlanById("farm-life"),
      {
        adoptProject: vi.fn(async () => { throw new Error("reload failed"); }),
        focusStartMap,
      },
    )).rejects.toThrow("reload failed");
    expect(focusStartMap).not.toHaveBeenCalled();
  });
});
