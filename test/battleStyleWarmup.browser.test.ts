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

      // 계약은 "준비가 그림을 실제로 받았고, 마운트가 그걸 다시 받지 않는가" 다. 응답 이벤트 개수로
      // 재면 개발 서버의 조건부 재검증(304)까지 세어 오탐이 난다(2026-10-27 실측: 304 는 정상).
      const warmDecoded = sum(current.phases.warm, "decoded");
      expect(warmDecoded).toBeGreaterThan(0);
      expect(sum(current.phases.mount, "decoded")).toBe(0);
      expect(sum(current.phases.mount, "bytes")).toBeLessThan(Math.max(4_096, warmDecoded * 0.1));
      expect([...urls(current.phases.warm), ...urls(current.phases.mount)].sort()).toEqual(urls(cold.phases.mount));
    } finally {
      rmSync(output, { force: true });
    }
  }, 550_000);
});
