import { describe, expect, it } from "vitest";
import {
  BenchmarkContractError,
  parseBenchmarkAnswer,
  type BenchmarkAnswer,
  type BenchmarkTaskKind,
} from "@/benchmark/contract";

function rejection(raw: string, kind: BenchmarkTaskKind): BenchmarkContractError {
  try {
    parseBenchmarkAnswer(raw, kind);
  } catch (error) {
    if (error instanceof BenchmarkContractError) return error;
    throw error;
  }
  throw new Error(`expected BenchmarkContractError for kind=${kind} raw=${JSON.stringify(raw)}`);
}

describe("benchmark answer contract", () => {
  describe("happy parse for each kind", () => {
    it("parses a detection answer", () => {
      const answer = parseBenchmarkAnswer('{"tileIds":[306,426]}', "detection");
      expect(answer).toEqual({ tileIds: [306, 426] });
    });

    it("parses a detection answer with a single id and an empty list", () => {
      expect(parseBenchmarkAnswer('{"tileIds":[306]}', "detection")).toEqual({ tileIds: [306] });
      expect(parseBenchmarkAnswer('{"tileIds":[]}', "detection")).toEqual({ tileIds: [] });
    });

    it("parses a construction answer with lower/upper grids and -1 empty cells", () => {
      const answer = parseBenchmarkAnswer(
        '{"lower":[[306,306,306],[306,-1,306]],"upper":[[374,374,374],[-1,374,-1]]}',
        "construction",
      );
      expect(answer).toEqual({
        lower: [[306, 306, 306], [306, -1, 306]],
        upper: [[374, 374, 374], [-1, 374, -1]],
      });
    });

    it("parses an autotileGrid answer", () => {
      const answer = parseBenchmarkAnswer('{"grid":[[360,360,360],[360,-1,360]]}', "autotileGrid");
      expect(answer).toEqual({ grid: [[360, 360, 360], [360, -1, 360]] });
    });

    it("parses an autotileCount answer", () => {
      const answer = parseBenchmarkAnswer(
        '{"count":11,"types":["dirt road","sand","cobblestone"]}',
        "autotileCount",
      );
      expect(answer).toEqual({ count: 11, types: ["dirt road", "sand", "cobblestone"] });
    });
  });

  describe("structured fail-closed rejections", () => {
    it("rejects an out-of-range detection id 480 naming tileIds", () => {
      const error = rejection('{"tileIds":[306,480]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("id-out-of-range");
      expect(error.message).toContain("480");
    });

    it("rejects an out-of-range detection id 999 naming tileIds", () => {
      const error = rejection('{"tileIds":[999]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("id-out-of-range");
      expect(error.message).toContain("999");
    });

    it("rejects a negative detection id", () => {
      const error = rejection('{"tileIds":[-1]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("id-out-of-range");
    });

    it("rejects a duplicate detection id [306,306] naming tileIds", () => {
      const error = rejection('{"tileIds":[306,306]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("duplicate-id");
      expect(error.message).toContain("tileIds");
      expect(error.message).toContain("306");
    });

    it("rejects detection ids that are not strictly ascending", () => {
      const error = rejection('{"tileIds":[426,306]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("not-ascending");
    });

    it("rejects a non-integer string id \"306\" naming the violation", () => {
      const error = rejection('{"tileIds":["306"]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("non-integer-id");
      expect(error.message).toContain("non-integer");
    });

    it("rejects a float id 306.5 naming the violation", () => {
      const error = rejection('{"tileIds":[306.5]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("non-integer-id");
      expect(error.message).toContain("non-integer");
    });

    it("rejects a non-rectangular construction grid", () => {
      const error = rejection('{"lower":[[306,306],[306]],"upper":[[374,374],[374,374]]}', "construction");
      expect(error.field).toBe("lower");
      expect(error.violation).toBe("non-rectangular");
    });

    it("rejects construction lower/upper with different shapes", () => {
      const error = rejection('{"lower":[[306,306],[306,306]],"upper":[[374,374,374],[374,374,374]]}', "construction");
      expect(error.violation).toBe("non-rectangular");
      expect(error.message).toContain("lower");
      expect(error.message).toContain("upper");
    });

    it("rejects a non-integer construction grid cell", () => {
      const error = rejection('{"lower":[[306,"306"]],"upper":[[374,374]]}', "construction");
      expect(error.field).toBe("lower");
      expect(error.violation).toBe("non-integer-id");
    });

    it("rejects an out-of-range construction grid id 480", () => {
      const error = rejection('{"lower":[[306,480]],"upper":[[374,374]]}', "construction");
      expect(error.field).toBe("lower");
      expect(error.violation).toBe("id-out-of-range");
    });

    it("rejects an empty construction grid", () => {
      const error = rejection('{"lower":[],"upper":[]}', "construction");
      expect(error.violation).toBe("empty-grid");
    });

    it("rejects a non-rectangular autotileGrid", () => {
      const error = rejection('{"grid":[[360,360],[360]]}', "autotileGrid");
      expect(error.field).toBe("grid");
      expect(error.violation).toBe("non-rectangular");
    });

    it("rejects an out-of-range autotileGrid id 999", () => {
      const error = rejection('{"grid":[[360,999]]}', "autotileGrid");
      expect(error.field).toBe("grid");
      expect(error.violation).toBe("id-out-of-range");
    });

    it("rejects a non-integer autotileCount count", () => {
      const error = rejection('{"count":"11","types":[]}', "autotileCount");
      expect(error.field).toBe("count");
      expect(error.violation).toBe("count-invalid");
    });

    it("rejects a float autotileCount count", () => {
      const error = rejection('{"count":11.5,"types":[]}', "autotileCount");
      expect(error.field).toBe("count");
      expect(error.violation).toBe("count-invalid");
    });

    it("rejects non-string autotileCount types", () => {
      const error = rejection('{"count":11,"types":[42]}', "autotileCount");
      expect(error.field).toBe("types");
      expect(error.violation).toBe("wrong-type");
    });
  });

  describe("markdown fence / balanced-JSON extraction", () => {
    it("parses ```json-fenced text", () => {
      const answer = parseBenchmarkAnswer('```json\n{"tileIds":[306,426]}\n```', "detection");
      expect(answer).toEqual({ tileIds: [306, 426] });
    });

    it("parses a fence without a language tag", () => {
      const answer = parseBenchmarkAnswer('```\n{"tileIds":[306]}\n```', "detection");
      expect(answer).toEqual({ tileIds: [306] });
    });

    it("parses a balanced JSON object embedded in prose", () => {
      const answer = parseBenchmarkAnswer(
        'Here are the wall tiles: {"tileIds":[306,426]}. Hope that helps.',
        "detection",
      );
      expect(answer).toEqual({ tileIds: [306, 426] });
    });

    it("rejects prose-only text with a structured error", () => {
      const error = rejection("I see walls everywhere but I cannot output JSON.", "detection");
      expect(error.violation).toBe("not-json");
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  describe("whole-answer rejection (never a partial parse)", () => {
    it("rejects the whole detection answer when one id is invalid", () => {
      // 306 is valid on its own; 999 poisons the entire answer.
      const error = rejection('{"tileIds":[306,999]}', "detection");
      expect(error.violation).toBe("id-out-of-range");
    });

    it("rejects the whole construction answer when upper is invalid", () => {
      const error = rejection('{"lower":[[306,306]],"upper":[[374,999]]}', "construction");
      expect(error.field).toBe("upper");
      expect(error.violation).toBe("id-out-of-range");
    });

    it("rejects a top-level value that is not an object", () => {
      const error = rejection("[306,426]", "detection");
      expect(error.violation).toBe("not-object");
    });

    it("rejects malformed JSON", () => {
      const error = rejection('{"tileIds":[306,}', "detection");
      expect(error.violation).toBe("invalid-json");
    });

    it("rejects a missing tileIds field", () => {
      const error = rejection('{"ids":[306]}', "detection");
      expect(error.field).toBe("tileIds");
      expect(error.violation).toBe("wrong-type");
    });
  });

  describe("returned shape", () => {
    it("produces answers assignable to BenchmarkAnswer", () => {
      const detection: BenchmarkAnswer = parseBenchmarkAnswer('{"tileIds":[306]}', "detection");
      const construction: BenchmarkAnswer = parseBenchmarkAnswer(
        '{"lower":[[306]],"upper":[[374]]}',
        "construction",
      );
      const grid: BenchmarkAnswer = parseBenchmarkAnswer('{"grid":[[360]]}', "autotileGrid");
      const count: BenchmarkAnswer = parseBenchmarkAnswer('{"count":11,"types":["sand"]}', "autotileCount");
      expect(detection).toEqual({ tileIds: [306] });
      expect(construction).toEqual({ lower: [[306]], upper: [[374]] });
      expect(grid).toEqual({ grid: [[360]] });
      expect(count).toEqual({ count: 11, types: ["sand"] });
    });
  });
});
