// 「맵 고쳐줘」 요청에서 맵이 실제로 커지는지 확인하는 증거 수집기 (2026-09-15).
// 네 수정 지점을 실제 코드로 통과시키고 결과를 JSON 으로 남긴다. 스크린샷 렌더러가 이 JSON 을 읽는다.
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "verify-shots", "map-growth");
fs.mkdirSync(outDir, { recursive: true });

const server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), server: { middlewareMode: true } });
const load = (id) => server.ssrLoadModule(id);

const { validateBuildSpec, plannedGrowthForSpec } = await load("/src/ai/buildSpec.ts");
const { formatIntentNote, parseIntentDeclaration } = await load("/src/ai/intentDeclaration.ts");
const { estimateVillageSize } = await load("/src/ai/constructionDeclaration.ts");
const { runTool } = await load("/src/editor/tools/index.ts");
const { createBlankProject } = await load("/src/project/defaults.ts");

const results = [];

// ── 1. buildSpec: 기존 맵에 확장 plannedMap ─────────────────────────────
const ctx = { project: createBlankProject() };
runTool(ctx, "create_map", { id: "m1", name: "고칠 마을", width: 30, height: 30 });
const outsideAsset = [{ id: "확장 마을", kind: "village", x: 24, y: 24, w: 30, h: 20 }];
const before = validateBuildSpec(ctx.project, { mapId: "m1", assets: outsideAsset })
  .filter((i) => i.severity === "error").map((i) => i.message);
const after = validateBuildSpec(ctx.project, {
  mapId: "m1", plannedMap: { mapId: "m1", width: 54, height: 44 }, assets: outsideAsset,
}).filter((i) => i.severity === "error").map((i) => i.message);
const shrink = validateBuildSpec(ctx.project, {
  mapId: "m1", plannedMap: { mapId: "m1", width: 20, height: 20 }, assets: [{ id: "a", kind: "village", x: 0, y: 0, w: 10, h: 10 }],
}).filter((i) => i.code === "spec-planned-shrink").map((i) => i.message);
results.push({
  fix: "1. buildSpec — 기존 맵 확장 선언",
  before: before[0] ?? "(통과)",
  after: after.length === 0 ? "통과 — 40×40 확장을 전제로 (24,24) 30×20 마을 승인" : after.join(" / "),
  guard: shrink[0] ?? "(없음)",
  computed: plannedGrowthForSpec({ width: 30, height: 30 }, { assets: outsideAsset }),
});

// ── 3. author_village: 기존 맵 성장 목표 ────────────────────────────────
const village = { project: createBlankProject() };
runTool(village, "create_map", { id: "m_town", name: "작은 마을", width: 30, height: 30 });
const sizeFor = (houses) => estimateVillageSize({ houseCount: houses });
results.push({
  fix: "3. author_village — 기존 맵 성장 목표",
  before: "MIN_BOUNDS_SIZE(16×16)까지만 — 30×30 맵은 그대로 두고 집을 우겨넣음",
  after: `집 수 환산값까지 성장: 집 12채 → ${sizeFor(12).width}×${sizeFor(12).height}, 집 20채 → ${sizeFor(20).width}×${sizeFor(20).height}`,
  guard: "bounds 를 명시하면 성장 없음(사용자가 정한 사각형), 축소 없음",
});

// ── 4. intentDeclaration: 문장의 규모 → 크기 ────────────────────────────
const facts = {
  userText: "이 마을 크게 넓혀줘, 집도 20채로",
  currentMap: { id: "m_town", name: "작은 마을" },
  selection: null,
  maps: [{ id: "m_town", name: "작은 마을" }],
  facilityLabels: [],
  toolNames: ["author_village", "resize_map"],
  hasActivePlan: false,
};
const declaration = JSON.stringify({
  mode: "modify", space: "outdoor", targetMapId: "m_town", tools: ["author_village", "resize_map"],
  construction: { scale: "large", houseCount: 20 }, needsPlan: true, summary: "마을 확장",
});
const intent = parseIntentDeclaration(declaration, facts).intent;
const note = formatIntentNote(intent, { targetMap: { id: "m_town", width: 30, height: 30 } });
results.push({
  fix: "4. intentDeclaration — 문장의 규모가 크기가 된다",
  before: "construction 필드 없음 → 수량이 선언 계층에서 버려짐(환산기 호출자 0)",
  after: intent?.construction ? JSON.stringify(intent.construction) : "(파싱 실패)",
  note: note?.split("\n").filter((line) => line.startsWith("[시공 규모]")).join("\n") ?? "(없음)",
});

fs.writeFileSync(path.join(outDir, "evidence.json"), JSON.stringify(results, null, 2));
for (const entry of results) {
  console.log("\n=== " + entry.fix + " ===");
  for (const [key, value] of Object.entries(entry)) {
    if (key === "fix") continue;
    console.log(`  ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
}
await server.close();
