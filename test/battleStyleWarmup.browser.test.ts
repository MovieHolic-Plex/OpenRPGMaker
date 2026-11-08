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

      // 계약은 "준비가 그림을 실제로 받았고, 마운트가 그 본문을 다시 받지 않는가" 다.
      // 응답 이벤트 개수로 재면 개발 서버의 조건부 재검증(304)까지 세어 오탐이 난다.
      // 디코드 바이트로 재면 304 응답이 캐시 본문 크기를 보고할 수 있어 역시 오탐이 난다.
      // 실제로 선을 넘는 바이트는 **전송 바이트**뿐이므로 그걸로 판정한다(2026-10-27 실측).
      // Stage images only. The mount also requests the battle's effect sheets on purpose, after the stage art is in
      // (whenBattleStageReady extraUrls, src/player/battleReadiness.ts) — the warm step never fetches them, so they are
      // not a re-download. The set comes from the product's own battleAnimationSheetUrls, read by the bench with the
      // mount's snapshot and project, so this exclusion follows the product instead of a URL list.
      expect(Array.isArray(current.effectSheetUrls)).toBe(true);
      const effectSheets = new Set<string>(current.effectSheetUrls);
      const stageMount = current.phases.mount.filter((entry: any) => !effectSheets.has(entry.url));
      const warmBytes = sum(current.phases.warm, "bytes");
      const mountBytes = sum(stageMount, "bytes");
      expect(sum(current.phases.warm, "decoded")).toBeGreaterThan(0);
      // The bench's rows are not printed by this test, so a failure only showed two numbers. Name what the
      // mount phase downloaded (and what warm requested) so the gap can be traced from the CI log alone.
      const top = (entries: any[]): string => [...entries].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 12)
        .map((entry) => `${entry.bytes ?? 0}B ${String(entry.url).replace(/^https?:\/\/[^/]+/, "")}`).join("; ");
      expect(mountBytes, `mount re-downloaded stage images: ${top(stageMount)} | warm requested (${warmBytes}B): ${top(current.phases.warm)}`)
        .toBeLessThan(Math.max(4_096, warmBytes * 0.1));
      expect([...urls(current.phases.warm), ...urls(current.phases.mount)].sort()).toEqual(urls(cold.phases.mount));
    } finally {
      rmSync(output, { force: true });
    }
  }, 550_000);
});
