import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import customCatalog from "@/pixelfx/custom/catalog.json";
import { PIXEL_FX_CUSTOM } from "@/pixelfx/custom";
import { isKnownPixelFxEffect } from "@/pixelfx/catalog";
import { loadPixelFxModule } from "@/pixelfx/modules";
import { pixelFxEffectTiming } from "@/battle/animationTiming";
import { FALLEN_SKILL_FX } from "@/project/flagship/fallen/pixelfx";
import { isolateTimers } from "./mergedTeardown";

// catalog.json 은 scripts/vendor/sync-pixelfx.mjs 가 효과 모듈의 meta 로 만드는 파생 파일이다. 동기화가 act(0.3.0 연기 박자)를
// 빠뜨리면 효과 코드는 멀쩡한데 편집기 고르기 창·list_pixel_fx 만 조용히 낡는다 — 그 어긋남을 여기서 잡는다.
describe("pixelFxCatalogAct", () => {
  isolateTimers();
  const PIXELFX_DIR = join(import.meta.dirname, "..", "src", "vendor", "pixelfx");
  const FX_DIR = join(PIXELFX_DIR, "fx");
  interface CatalogAct {
    readonly windup: number;
    readonly recovery: number;
    readonly onBody: boolean;
    readonly hits: number;
    readonly targets: number;
  }
  interface CatalogEntry {
    readonly id: string;
    readonly category: string;
    readonly size: readonly number[];
    readonly duration: number;
    readonly loop: boolean;
    readonly actor: number;
    readonly back: number;
    readonly act?: CatalogAct;
  }
  interface CatalogEffectModule {
    readonly meta: { readonly size?: readonly number[]; readonly duration?: number; readonly loop?: boolean; readonly actor?: number };
    readonly act?: { readonly poses?: readonly (readonly [number, unknown, string?])[]; readonly hits?: readonly unknown[]; readonly targets?: readonly unknown[]; readonly target?: unknown; readonly onBody?: boolean };
  }
  const catalog = JSON.parse(readFileSync(join(PIXELFX_DIR, "catalog.json"), "utf8")) as { categories: { id: string }[]; effects: CatalogEntry[] };
  /** 카탈로그가 세는 효과 파일 수(\`_\` 로 시작하는 분류 공용 헬퍼는 효과가 아니다). */
  function effectFiles(): string[] {
    const out: string[] = [];
    for (const category of readdirSync(FX_DIR, { withFileTypes: true })) {
      if (!category.isDirectory()) continue;
      for (const file of readdirSync(join(FX_DIR, category.name))) {
        if (file.endsWith(".js") && !file.startsWith("_")) out.push(`${category.name}/${file.slice(0, -3)}`);
      }
    }
    return out;
  }
  /** sync 스크립트와 같은 규칙으로 act 타이밍을 다시 센다(정본은 core/act.js \`actTiming\`). */
  function actTimingOf(mod: CatalogEffectModule): CatalogAct | null {
    const a = mod.act;
    if (!a) return null;
    const keys = a.poses ?? [];
    const from = Math.min(0, keys[0]?.[0] ?? 0);
    const last = keys.length ? keys[keys.length - 1]![0] : 0;
    const D = mod.meta.duration ?? 1;
    return {
      windup: +Math.max(0, -from).toFixed(3),
      recovery: mod.meta.loop ? 0 : +Math.max(0, last - D).toFixed(3),
      onBody: !!a.onBody,
      hits: (a.hits ?? []).length,
      targets: (a.targets ?? (a.target ? [a.target] : [])).length,
    };
  }
  describe("pixelfx catalog.json ↔ vendor modules", () => {
    it("lists every effect file exactly once", () => {
      const files = effectFiles().sort();
      const ids = catalog.effects.map((entry) => entry.id).sort();
      expect(ids).toEqual(files);
    });

    it("carries the act timing of every effect that has one, and none for the others", async () => {
      const mismatched: string[] = [];
      for (const entry of catalog.effects) {
        const [category, name] = entry.id.split("/") as [string, string];
        const mod = (await import(join(FX_DIR, category, `${name}.js`))) as CatalogEffectModule;
        const expected = actTimingOf(mod);
        if (!expected) {
          if (entry.act) mismatched.push(`${entry.id}: catalog has act, module has none`);
          continue;
        }
        if (!entry.act) {
          mismatched.push(`${entry.id}: module has act, catalog has none`);
          continue;
        }
        for (const key of ["windup", "recovery", "onBody", "hits", "targets"] as const) {
          if (entry.act[key] !== expected[key]) mismatched.push(`${entry.id}.${key}: ${String(entry.act[key])} ≠ ${String(expected[key])}`);
        }
      }
      expect(mismatched).toEqual([]);
    });

    it("ships the 0.3.0 moves category with whole acted attacks", () => {
      expect(catalog.categories.map((category) => category.id)).toContain("moves");
      const moves = catalog.effects.filter((entry) => entry.category === "moves");
      expect(moves).toHaveLength(12);
      for (const move of moves) {
        expect(move.act, `${move.id} must carry act so a host can time its own character`).toBeDefined();
        expect(move.act!.windup).toBeGreaterThanOrEqual(0);
        expect(move.act!.targets).toBeGreaterThan(0);
        expect(move.act!.hits).toBeGreaterThan(0);
      }
    });

    it("keeps the render contract fields the wrapper reads (size, duration, loop, actor, back)", () => {
      const broken: string[] = [];
      for (const entry of catalog.effects) {
        if (!Array.isArray(entry.size) || entry.size.length !== 2) broken.push(`${entry.id}.size`);
        if (!(entry.duration > 0)) broken.push(`${entry.id}.duration`);
        if (typeof entry.loop !== "boolean") broken.push(`${entry.id}.loop`);
        if (entry.actor !== 0 && entry.actor !== 1) broken.push(`${entry.id}.actor`);
        if (entry.back !== 0 && entry.back !== 1) broken.push(`${entry.id}.back`);
      }
      expect(broken).toEqual([]);
    });
  });
});

// 우리가 저작한 pixelfx 효과(src/pixelfx/custom)는 vendor 동기화 밖이라 세 곳이 손으로 이어진다:
// 정적 import 표(custom/index.ts) · 파생 catalog.json(build-pixelfx-custom-catalog.mjs) · 그 효과를 쓰는 게임 데이터.
// 하나라도 어긋나면 전투에서 효과가 조용히 빠진다(loader 가 undefined) — 그 어긋남을 여기서 잡는다.
describe("pixelFxCustomEffects", () => {
  isolateTimers();
  const CUSTOM_DIR = join(import.meta.dirname, "..", "src", "pixelfx", "custom");
  function customFiles(): string[] {
    const out: string[] = [];
    for (const category of readdirSync(CUSTOM_DIR, { withFileTypes: true })) {
      if (!category.isDirectory()) continue;
      for (const file of readdirSync(join(CUSTOM_DIR, category.name))) if (file.endsWith(".js") && !file.startsWith("_")) out.push(`${category.name}/${file.slice(0, -3)}`);
    }
    return out.sort();
  }
  describe("custom pixelfx effects", () => {
    it("lists every custom effect file in both the import table and the derived catalog", () => {
      expect(PIXEL_FX_CUSTOM.map((e) => e.id).sort()).toEqual(customFiles());
      expect(customCatalog.effects.map((e) => e.id).sort()).toEqual(customFiles());
    });

    it("loads each custom effect through the runtime loader with the catalog's meta", async () => {
      for (const entry of customCatalog.effects) {
        const mod = await loadPixelFxModule(entry.id);
        expect(mod, entry.id).toBeDefined();
        expect(mod!.meta.duration).toBe(entry.duration);
        expect([...mod!.meta.size]).toEqual(entry.size);
        expect(pixelFxEffectTiming(entry.id)).toEqual({ durationMs: Math.round(entry.duration * 1000), loop: entry.loop });
      }
    });

    it("gives every Fallen Star skill an effect the catalog knows", () => {
      const unknown = FALLEN_SKILL_FX.filter((e) => !isKnownPixelFxEffect(e.spec.effectId)).map((e) => `${e.skill} → ${e.spec.effectId}`);
      expect(unknown).toEqual([]);
    });
  });
});
