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

      // 계약: **준비가 데운 그림을 마운트가 다시 받지 않는다.** 준비는 명령 패널처럼 콜백이 필요한
      // 영역을 일부러 넣지 않으므로(모듈 주석), 마운트가 새 그림을 더 받는 것은 정상이다.
      // 그래서 전체 바이트 상한이 아니라 "warm 이 받은 URL" 만 골라 마운트 재전송을 잰다.
      expect(sum(current.phases.warm, "decoded")).toBeGreaterThan(0);
      const warmedUrls = new Set(urls(current.phases.warm));
      const refetched = current.phases.mount.filter((entry: any) => warmedUrls.has(entry.url));
      const refetchedBytes = refetched.reduce((total: number, entry: any) => total + (entry.bytes ?? 0), 0);
      expect(refetchedBytes).toBeLessThan(4_096);

      // 준비 ∪ 마운트가 다루는 그림 집합은 준비 없이 마운트만 한 경우와 같아야 한다.
      expect([...urls(current.phases.warm), ...urls(current.phases.mount)].sort()).toEqual(urls(cold.phases.mount));
    } finally {
      rmSync(output, { force: true });
    }
  }, 550_000);
});
