import { describe, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

interface H { readonly kitId: string; readonly templateId: string; readonly stories: number }

function build(seed: number, houses: number, size: number): readonly H[] {
  const context: ToolContext = { project: createEmptyToolProject(`v${seed}`) };
  const result = runTool(context, "build_village", { seed, houses, width: size, height: size });
  if (!result.ok) throw new Error(`fail seed=${seed}: ${result.summary}`);
  return (result.data as { houses: readonly H[] }).houses;
}

describe("tmp house variety probe", () => {
  it("dumps template/kit distribution", () => {
    for (const [houses, size] of [[8, 50], [16, 70], [24, 100], [32, 120]] as const) {
      const lines: string[] = [];
      for (const seed of [1, 2, 3, 7, 42]) {
        let hs: readonly H[];
        try { hs = build(seed, houses, size); } catch (e) { lines.push(`seed ${seed}: ERR ${String(e).slice(0, 120)}`); continue; }
        const t = new Map<string, number>();
        const k = new Map<string, number>();
        for (const h of hs) {
          t.set(h.templateId, (t.get(h.templateId) ?? 0) + 1);
          k.set(h.kitId, (k.get(h.kitId) ?? 0) + 1);
        }
        const topT = [...t.entries()].sort((a, b) => b[1] - a[1]);
        lines.push(
          `seed ${String(seed).padStart(2)}: built ${hs.length}/${houses} | shapes ${t.size} | kits ${k.size}`
          + ` | top ${topT.slice(0, 4).map(([id, n]) => `${id}×${n}`).join(", ")}`
          + ` | stories ${[...new Set(hs.map((h) => h.stories))].sort().join("/")}`,
        );
      }
      console.log(`\n=== houses=${houses} map=${size}x${size} ===\n${lines.join("\n")}`);
    }
  }, 600_000);
});
