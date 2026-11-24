import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { ProjectFormatError } from "@/project/io/errors";
import { compactWorldCanon, EMPTY_WORLD_CANON, resolveWorldCanon, WORLD_CANON_TONES } from "@/project/world/canon";
import { normalizeWorldCanon } from "@/project/world/canonNormalize";
import { runTool, type ToolContext } from "@/editor/tools";
import { isolateTimers } from "./mergedTeardown";

describe("worldCanon", () => {
  isolateTimers();
  describe("worldCanon", () => {
    it("migrates legacy secret status into independent visibility", () => {
      expect(normalizeWorldCanon({ name: "해안", status: "secret" })).toEqual({
        name: "해안", visibility: "secret",
      });
    });

    it("round-trips a confirmed secret without losing either axis", () => {
      const project = createBlankProject();
      project.worldCanon = normalizeWorldCanon({ name: "해안", status: "canon", visibility: "secret" });
      expect(deserialize(serialize(project)).worldCanon).toEqual({
        name: "해안", status: "canon", visibility: "secret",
      });
    });

    it("resolves a missing canon to empty defaults", () => {
      const resolved = resolveWorldCanon(undefined);
      expect(resolved).toEqual(EMPTY_WORLD_CANON);
      expect(compactWorldCanon(resolved)).toBeUndefined();
    });

    it("omits a fully empty object so old saves stay sparse", () => {
      expect(normalizeWorldCanon({})).toBeUndefined();
    });

    it("keeps authored name, premise, body, tones, and absences", () => {
      const canon = normalizeWorldCanon({
        name: " 서녘 공화국 ",
        premise: "마법은 피의 대가다.",
        tones: ["grim", "political", "grim", "nope"],
        absences: [" 총 ", "", "엘프", "총"],
        body: "왕위는 비어 있다.",
        extra: "drop",
      });
      expect(canon).toEqual({
        name: "서녘 공화국",
        premise: "마법은 피의 대가다.",
        tones: ["grim", "political"],
        absences: ["총", "엘프"],
        body: "왕위는 비어 있다.",
      });
    });

    it("round-trips through serialize/deserialize on a real project", () => {
      const project = createBlankProject();
      project.worldCanon = {
        name: "안개 해안",
        tones: ["gothic"],
        absences: ["총"],
        status: "canon",
        laws: { power: { present: true, note: "피의 대가" } },
      };
      const loaded = deserialize(serialize(project));
      expect(loaded.worldCanon).toEqual({
        name: "안개 해안",
        tones: ["gothic"],
        absences: ["총"],
        status: "canon",
        laws: { power: { present: true, note: "피의 대가" } },
      });
    });

    it("rejects a non-object canon at the project boundary", () => {
      expect(() => normalizeWorldCanon("서녘")).toThrow(ProjectFormatError);
    });

    it("exposes a closed tone list the editor can chip", () => {
      expect(WORLD_CANON_TONES).toContain("grim");
      expect(WORLD_CANON_TONES).toContain("slice");
    });
  });
});

describe("worldCanonTool", () => {
  isolateTimers();
  describe("set_world_canon", () => {
    it("stores the world backbone and preserves omitted fields on a later patch", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const first = runTool(ctx, "set_world_canon", {
        canon: {
          name: "아르카디아",
          premise: "왕국의 봉인이 무너지고 변방의 주인공이 움직인다.",
          era: "봉건 중세",
          tones: ["mythic", "grim"],
          laws: { power: { present: true, note: "혈통과 계약이 함께 작동한다" } },
        },
      });
      expect(first.ok, first.summary).toBe(true);
      const second = runTool(ctx, "set_world_canon", { canon: { techCeiling: "화약 이전" } });
      expect(second.ok, second.summary).toBe(true);
      expect(ctx.project.worldCanon).toMatchObject({ name: "아르카디아", era: "봉건 중세", techCeiling: "화약 이전" });
      expect(ctx.project.worldCanon?.laws?.power?.present).toBe(true);
    });
  });
});
