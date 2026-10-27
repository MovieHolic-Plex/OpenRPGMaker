import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, rmSync } from "node:fs";

describe("battle style preparation in the exported player", () => {
  it("keeps the host width offscreen and reuses prepared image requests on mount", async () => {
    const output = `/tmp/battle-warmup-${process.pid}.json`;
    try {
      await promisify(execFile)("npx", ["tsx", "--tsconfig", "tsconfig.app.json", "scripts/bench/battle-warmup.mts"], {
        env: { ...process.env, BATTLE_WARMUP_ROUNDS: "1", BATTLE_WARMUP_VARIANTS: "current,cold", BATTLE_WARMUP_OUTPUT: output },
        timeout: 500_000, maxBuffer: 2 * 1024 * 1024,
      });
      const rows = JSON.parse(readFileSync(output, "utf8"));
      const current = rows.find((r: any) => r.variant === "current");
      const cold = rows.find((r: any) => r.variant === "cold");
      const sum = (entries: any[], key: "bytes" | "decoded"): number =>
        entries.reduce((total, entry) => total + (entry[key] ?? 0), 0);
      const urls = (entries: any[]): string[] => entries.map((entry) => entry.url).sort();

      expect(current.warm.width).toBe(640);
      expect(current.warm.images).toBeGreaterThan(0);
      expect(current.warm.backgrounds).toBeGreaterThan(0);

      const warmBytes = sum(current.phases.warm, "bytes");
      const mountBytes = sum(current.phases.mount, "bytes");
      expect(sum(current.phases.warm, "decoded")).toBeGreaterThan(0);
      expect(mountBytes).toBeLessThan(Math.max(4_096, warmBytes * 0.1));
      expect([...urls(current.phases.warm), ...urls(current.phases.mount)].sort()).toEqual(urls(cold.phases.mount));
    } finally {
      rmSync(output, { force: true });
    }
  }, 550_000);
});
