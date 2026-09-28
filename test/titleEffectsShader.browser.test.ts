import { beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, rmSync } from "node:fs";

describe("title effects software WebGL differential", () => {
  let result: any;
  beforeAll(async () => {
    const output = process.env.TITLE_EFFECT_TEST_OUTPUT ?? `/tmp/shader-vitest-${process.pid}.json`;
    try {
      await promisify(execFile)("npx", ["tsx", "--tsconfig", "tsconfig.app.json", "scripts/bench/title-effects.mts"], {
        cwd: process.cwd(), env: { ...process.env, TITLE_EFFECT_BENCH_OUTPUT: output },
        timeout: 500_000, maxBuffer: 2 * 1024 * 1024,
      }).catch(error => {
        // Report the actual assertion below when the standalone verifier rejects a frame.
        if (error.code !== 1 || !existsSync(output)) throw error;
      });
      result = JSON.parse(readFileSync(output, "utf8"));
    } finally {
      if (!process.env.TITLE_EFFECT_TEST_OUTPUT) rmSync(output, { force: true });
    }
  }, 550_000);

  it("stops lost animation loops and resumes after restoration", () => {
      expect(result.animationRecovery).toEqual({quiet:true,resumed:true});
  });
  it("stops even before the image has loaded", () => {
      expect(result.stoppedBeforeLoad).toBe(true);
  });
  it("rebuilds color, depth and particle passes after context loss", () => {
      expect(result.recovery).toEqual({prevented:true,lostState:"lost",restoredMax:0,depth:"loaded"});
  });
  it("halves known software renderer resolution", () => {
      expect(result.softwareSize).toEqual({width:160,height:120});
  });
  it("preserves full-quality pixels and existing lifecycle contracts", () => {
      expect(result.errors).toEqual([]);
      expect(result.comparisons).toHaveLength(24);
      for (const comparison of result.comparisons) {
        expect(comparison.max).toBeLessThanOrEqual(1);
        // Real GL calls, not a source-string check: initial frame + live redraw.
        // Reverting production to the frozen implementation makes particle === 0.
        expect(comparison.draws).toEqual({ particle: 2, color: 2 });
      }
      expect(result.resize).toEqual({ width: 257, height: 193, animated: "false" });
      expect(result.detached).toBe(true);
      expect(result.reduced.titleEffectsRenderer).toBe("webgl");
      expect(result.reduced.titleEffectsAnimated).toBe("false");
  });
});
