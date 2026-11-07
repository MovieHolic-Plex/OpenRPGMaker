// catalog.json 은 scripts/vendor/sync-pixelfx.mjs 가 효과 모듈의 meta 로 만드는 파생 파일이다. 동기화가 act(0.3.0 연기 박자)를
// 빠뜨리면 효과 코드는 멀쩡한데 편집기 고르기 창·list_pixel_fx 만 조용히 낡는다 — 그 어긋남을 여기서 잡는다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
