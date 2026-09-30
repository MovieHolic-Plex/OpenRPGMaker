// list_hand_interior_parts 를 모델 없이 직접 불러 샘플 질의 결과를 덤프한다(전후 비교용).
//   bun scripts/qa/hand-interior-parts-probe.mts [--out verify-shots/hand-interior-parts/after.json]
import fs from "node:fs";
import path from "node:path";
import { LIST_HAND_INTERIOR_PARTS_TOOL } from "../../src/editor/tools/handInteriorTools.ts";
import { createBlankProject } from "../../src/project/defaults.ts";

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const out = arg("out", "verify-shots/hand-interior-parts/after.json")!;
const project = createBlankProject();
const cases: Record<string, unknown>[] = [
  { query: "여관 벽" }, { query: "부엌" }, { query: "침실 바닥" }, { query: "빵집" }, { query: "bed" }, { room: "bakery" }, { room: "여관 객실" },
];
const results = cases.map((args) => {
  try {
    const r = LIST_HAND_INTERIOR_PARTS_TOOL.run(project as never, args as never) as { summary: string; data?: unknown };
    const json = JSON.stringify(r.data ?? null);
    return { args, summary: r.summary, bytes: Buffer.byteLength(json), data: r.data };
  } catch (error) { return { args, error: String(error) }; }
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(results, null, 1));
for (const r of results) console.log(JSON.stringify(r.args), "→", "error" in r ? r.error : `${r.summary} (${r.bytes}B)`);
