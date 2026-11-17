// 버들항 정령 숲 기물(beodeul_spirit): 굽힌 시트 · 칸표가 서로 맞고, 기물마다 오너 면제가 걸린 화소 해시를 갖고, 깎아지른 지형이 지을 때만 beodeul_city 에 이식된다.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import catalog from "@/assets/beodeulSpiritCatalog.json";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults";
import { ensureBeodeulSpirit } from "@/project/defaults/beodeulSpirit";
import type { Project } from "@/project/types";

describe("beodeul_spirit pack", () => {
  it("the sheet, the catalog and the owner-waiver batch agree", () => {
    expect(BUNDLED_REFERENCE_CHIPSET_ASSETS.find((a) => a.textureKey === "tex_beodeul_spirit")?.path).toBe("assets/beodeul-spirit/chipset.png");
    expect(existsSync(resolve("public/assets/beodeul-spirit/chipset.png"))).toBe(true);
    expect(bundledChipsetFrameCount("tex_beodeul_spirit")).toBe(catalog.count);
    expect(catalog.roles).toHaveLength(catalog.count);
    const waiver = JSON.parse(readFileSync(resolve("harness-data/object-gate/waivers/fable-spiritforest-2026-11-16.json"), "utf8")) as { items: { pixelSha256: string }[] };
    const waived = new Set(waiver.items.map((i) => i.pixelSha256));
    expect(catalog.items).toHaveLength(12);
    for (const it of catalog.items) {
      expect(waived.has(it.sha256), it.id).toBe(true);
      for (const n of it.rows.flat()) expect(n).toBeLessThan(catalog.count);
      // standing objects block only their trunk / stem cells; walk-over flowers block nothing
      if (it.layer === 3) expect(it.block.length, it.id).toBeGreaterThan(0);
      else expect(it.block, it.id).toEqual([]);
    }
    expect(catalog.items.filter((it) => it.id.startsWith("tree-big-"))).toHaveLength(4);
  });

  it("grafts onto beodeul_city once: crowns above the hero, trunks shut, shadows walkable", () => {
    const p = createBlankProject() as Project, ts = p.tilesets.beodeul_city!;
    expect(ts.structureKits!.some((k) => k.id.startsWith("bd-sp-"))).toBe(false);
    expect(ensureBeodeulSpirit(ts)).toBe(true);
    const count = ts.count;
    expect(ensureBeodeulSpirit(ts)).toBe(false);
    expect(ts.count).toBe(count);
    const kit = ts.structureKits!.find((k) => k.id === "bd-sp-tree-big-a")!;
    const it = catalog.items.find((i) => i.id === "tree-big-a")!;
    const cell = (x: number, y: number) => kit.rows[y]!.upperTiles![x]!;
    for (const [x, y] of it.block) { const t = cell(x!, y!); expect(ts.priority[t]).toBe("lower"); expect(ts.passability[t]).toEqual({ up: false, down: false, left: false, right: false }); }
    for (const [x, y] of it.under) { const t = cell(x!, y!); expect(ts.priority[t]).toBe("lower"); expect(ts.passability[t]!.up).toBe(true); }
    expect(ts.priority[cell(2, 1)]).toBe("upper");
  });
});
