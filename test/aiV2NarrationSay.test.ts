import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBuildRun } from "@/ai/v2/buildRun";
import { buildEvent } from "@/ai/v2/events";
import type { Project } from "@/project/types";

// 2026-10-25 장난감 가게 A/B: who 없는 say 비트가 「who.trim」 으로 add_event 를 죽였다. 이제 내레이션이다.
describe("v2 add_event say without who", () => {
  it("compiles to a narration line instead of crashing", () => {
    const project = createBlankProject() as Project;
    const run = createBuildRun({ project, currentMapId: project.startMapId });
    const result = buildEvent(run, { when: "game-start", kind: "cutscene", mapId: project.startMapId!, beats: [
      { do: "fade", dir: "in" },
      { do: "say", text: "폐업을 하루 앞둔 낡은 장난감 가게." } as never,
      { do: "walk", to: "광장" } as never,
    ] } as never);
    expect(result.summary ?? "").not.toContain("who.trim");
    const commands = JSON.stringify(Object.values(run.ctx.project.maps).flatMap((m) => m.events ?? []));
    expect(commands).toContain("폐업을 하루 앞둔 낡은 장난감 가게.");
    expect(commands).toContain("narration");
    expect((result.warnings ?? []).some((w) => w.includes("walk: who"))).toBe(true);
  });
});
