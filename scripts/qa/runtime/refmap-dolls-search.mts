// REFMAP 변형 인물 칩(RefmapDoll<n>)을 조수가 찾는지 본다 — 모델 없이, 조수가 쓰는 질의 함수(list_npc_graphics 와 같은 queryNpcGraphics)와 실제 도구(runTool list_npc_graphics·place_npc)로.
// 판타지 새 프로젝트(장르 잠금 없음)에서 말로 찾은 1등이 RefmapDoll 칸인지, 그 칸의 그림 url 이 풀리고 파일이 있는지, place_npc 가 받는지 출력한다. 정본은 건드리지 않는다.
//
//   npx vite-node --script scripts/qa/runtime/refmap-dolls-search.mts [--json out.json]
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { REFMAP_DOLL_CHARSET_ASSETS } from "@/assets/refmapDollCharsets";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const QUERIES = [
  "빨간 머리 여자 기사", "늙은 상인", "메이드", "수염 난 노인", "귀족 아가씨", "수녀", "마법사", "어린 소녀",
  "갑옷 입은 병사", "금발 모험가", "초록 두건", "red hair female knight", "old merchant", "maid",
] as const;
const isDoll = (key: string) => key.startsWith("tex_oprn_charset_refmap_doll");

const rows = QUERIES.map((q) => {
  const hits = queryNpcGraphics(q, 10);
  return {
    query: q,
    dollsInTop10: hits.filter((h) => isDoll(h.entry.textureKey)).length,
    top: hits.slice(0, 3).map((h) => `${h.entry.textureKey.replace("tex_oprn_charset_", "")}#${h.entry.characterIndex} ${h.entry.label} — ${h.entry.appearance ?? ""}`.slice(0, 120)),
  };
});
for (const r of rows) console.log(`${r.query}: RefmapDoll ${r.dollsInTop10}/10\n  ${r.top.join("\n  ")}`);

// 실제 도구: list_npc_graphics 가 RefmapDoll 칸을 돌려주고, 그 칸을 place_npc 가 받는지.
const project: Project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId, assistantRun: true as const };
const listed = runTool(ctx, "list_npc_graphics", { query: "메이드", limit: 20 }, { dryRun: true });
const pick = queryNpcGraphics("메이드", 50).find((h) => isDoll(h.entry.textureKey))?.entry;
if (!pick) throw new Error("「메이드」 로 RefmapDoll 칸을 못 찾음");
const placed = runTool(ctx, "place_npc", {
  mapId: project.startMapId, id: "ev_refmap_maid", name: "메이드", x: 3, y: 3, movement: "fixed",
  graphic: { textureKey: pick.textureKey, characterIndex: pick.characterIndex }, pages: [{ lines: ["어서 오세요."] }],
}, { dryRun: false });
const url = resolveAssetResourceUrl(pick.textureKey, {});
const file = url ? join(process.cwd(), "public", url.replace(/^\//u, "")) : "";
const summary = {
  sheets: REFMAP_DOLL_CHARSET_ASSETS.length,
  listNpcGraphicsOk: listed.ok, listNpcGraphicsMentionsDoll: JSON.stringify(listed).includes("refmap_doll"),
  pick: `${pick.textureKey}#${pick.characterIndex} ${pick.label}`, placeNpcOk: placed.ok, placeNpcSummary: placed.summary,
  url, fileExists: !!file && existsSync(file),
  queriesWithDollFirst: rows.filter((r) => r.top[0]?.startsWith("refmap_doll")).length, queries: rows.length,
};
console.log(JSON.stringify(summary, null, 1));
const out = process.argv.indexOf("--json");
if (out >= 0) writeFileSync(process.argv[out + 1]!, JSON.stringify({ summary, rows }, null, 1));
if (!summary.placeNpcOk || !summary.fileExists) process.exit(1);
