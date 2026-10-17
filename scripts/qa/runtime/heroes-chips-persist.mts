// Heroes1 칩이 SQLite 정본(project.sqlite)에 저장되고 재로드 뒤에도 같은 그림·같은 해석 가능 id 로 읽히는지 본다.
// 새 프로젝트(createBlankProject)와 옛 프로젝트(editor-authored-demo-v3, 칩이 번들에 없던 시절의 문서)를 임시 폴더에 각각 저장한다.
// 정본·LegacyDb 를 건드리지 않는다(임시 폴더만).
//
//   npx vite-node --script scripts/qa/runtime/heroes-chips-persist.mts --dir /tmp/heroes-persist
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { initLocalProjectStore } from "../../../electron/local-store/store";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";

const dirArg = process.argv.indexOf("--dir");
const root = dirArg >= 0 ? process.argv[dirArg + 1]! : "/tmp/heroes-persist";
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const WANT = ["양서 기사", "노장군", "무대 가수"] as const;
const report: Record<string, unknown>[] = [];
const cases: Array<[string, () => Project]> = [
  ["new-project", () => createBlankProject()],
  ["existing-project", () => deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"))],
];
for (const [label, make] of cases) {
  const project = make();
  const ctx = { project };
  const mapId = project.startMapId;
  const placed: Record<string, unknown>[] = [];
  WANT.forEach((name, i) => {
    // 조수가 쓰는 검색(list_npc_graphics 의 질의 함수)으로 칸을 찾아 place_npc 에 그대로 넘긴다.
    const hit = queryNpcGraphics(name, 1)[0]?.entry;
    if (!hit || !hit.textureKey.includes("heroes")) throw new Error(`${label}: '${name}' 검색이 Heroes 칸을 못 찾음: ${hit?.label}`);
    const result = runTool(ctx, "place_npc", {
      mapId, id: `ev_heroes_${i}`, name, x: 2 + i, y: 2, movement: "fixed",
      graphic: { textureKey: hit.textureKey, characterIndex: hit.characterIndex },
      pages: [{ lines: [name] }],
    });
    if (!result.ok) throw new Error(`${label} place_npc 실패: ${result.summary}`);
    placed.push({ name, textureKey: hit.textureKey, characterIndex: hit.characterIndex });
  });
  const dir = join(root, label);
  const first = await initLocalProjectStore({ projectDir: dir });
  const saved = await first.saveProject(ctx.project); // runTool 은 ctx.project 를 새 객체로 바꾼다 — 도구가 쓴 쪽을 저장한다
  if (saved.kind !== "saved") throw new Error(`${label}: 저장이 수락되지 않음 ${saved.kind}`);
  const second = await initLocalProjectStore({ projectDir: dir }); // 별도 핸들로 다시 연다
  const snapshot = second.loadSnapshot();
  if (!snapshot) throw new Error(`${label}: 재로드 스냅샷 없음`);
  const events = snapshot.project.maps[mapId]!.events.filter((e) => e.id.startsWith("ev_heroes_"));
  const rows = events.map((e) => {
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    const url = resolveAssetResourceUrl(g?.sprite?.id, { project: snapshot.project });
    return { id: e.id, sprite: g?.sprite?.id, pattern: g?.pattern, url };
  });
  if (rows.length !== WANT.length || rows.some((r) => r.sprite !== "tex_oprn_charset_heroes1" || r.url !== "/assets/generated/charsets/Heroes1.png")) {
    throw new Error(`${label}: 재로드 뒤 그림이 다르다 ${JSON.stringify(rows)}`);
  }
  report.push({ label, projectDir: dir, projectId: second.projectId, saved: saved.kind, sha256: snapshot.sha256, revision: snapshot.revision, placed, reloaded: rows });
}
console.log(JSON.stringify(report, null, 1));
