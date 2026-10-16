// Scarloxy 변형 사람 칩(ScarloxyPeople1~3, charsetFamily `scarloxy-people`)이 몬스터 수집 장르 잠금 아래에서 조수 경로(place_npc, assistantRun)로 놓이고,
// SQLite 정본(project.sqlite)에 저장·재로드된 뒤에도 같은 그림·같은 해석 가능 url 로 읽히는지, 허용 밖 RTP 사람 칩은 여전히 거부되는지 본다.
// 새 프로젝트(createBlankProject + monster-collect 프리셋)와 이 칩이 생기기 전에 저장된 잠금(허용 목록 사본이 같은 `scarloxy-people`)을 각각 임시 폴더에 저장한다.
// 정본·LegacyDb 를 건드리지 않는다(임시 폴더만).
//
//   npx vite-node --script scripts/qa/runtime/scarloxy-people-chips-persist.mts --dir /tmp/spc-persist
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { initLocalProjectStore } from "../../../electron/local-store/store";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { applyGenrePreset } from "@/project/genrePresets";
import { genreLockAllowsCharset } from "@/project/genreLock";
import type { Project } from "@/project/types";

const dirArg = process.argv.indexOf("--dir");
const root = dirArg >= 0 ? process.argv[dirArg + 1]! : "/tmp/spc-persist";
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const WANT = ["경찰관", "연구원", "간호사", "낚시꾼", "라이벌", "신관"] as const;
const report: Record<string, unknown>[] = [];
const cases: Array<[string, () => Project]> = [
  ["new-project", () => { const p = createBlankProject(); applyGenrePreset(p, "monster-collect"); return p; }],
  ["old-lock-project", () => {
    const p = createBlankProject();
    applyGenrePreset(p, "monster-collect");
    p.system.genreLock = { ...p.system.genreLock!, allowedCharsetFamilies: ["scarloxy-people", "oprn-creature", "rtp-creature", "object", "uploaded", "other"] };   // 옛 저장본이 가진 허용 목록 사본 그대로
    return p;
  }],
];
for (const [label, make] of cases) {
  const project = make();
  let ctx = { project, currentMapId: project.startMapId, assistantRun: true as const };
  const mapId = project.startMapId;
  const placed: Record<string, unknown>[] = [];
  WANT.forEach((name, i) => {
    // 조수가 쓰는 검색(list_npc_graphics 의 질의 함수)으로 칸을 찾아 place_npc 에 그대로 넘긴다.
    const hit = queryNpcGraphics(name, 1)[0]?.entry;
    if (!hit || charsetFamilyOf(undefined, hit.textureKey) !== "scarloxy-people" || !hit.textureKey.startsWith("tex_oprn_charset_scarloxy_people")) throw new Error(`${label}: '${name}' 검색이 ScarloxyPeople 칸을 못 찾음: ${hit?.textureKey} ${hit?.label}`);
    if (!genreLockAllowsCharset(ctx.project, hit.textureKey)) throw new Error(`${label}: 잠금이 ${hit.textureKey} 를 허용하지 않는다`);
    const result = runTool(ctx, "place_npc", {
      mapId, id: `ev_spc_${i}`, name, x: 2 + i, y: 2, movement: "fixed",
      graphic: { textureKey: hit.textureKey, characterIndex: hit.characterIndex },
      pages: [{ lines: [name] }],
    }, { dryRun: false });
    if (!result.ok) throw new Error(`${label} place_npc 실패: ${result.summary}`);
    ctx = { ...ctx, project: (result as { project?: Project }).project ?? ctx.project };
    placed.push({ name, textureKey: hit.textureKey, characterIndex: hit.characterIndex });
  });
  const rejected = runTool(ctx, "place_npc", { mapId, id: "ev_rtp", name: "판타지 청년", x: 9, y: 2, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
  if (rejected.ok) throw new Error(`${label}: 잠금이 RTP 사람 칩을 거부하지 않았다`);
  const dir = join(root, label);
  const first = await initLocalProjectStore({ projectDir: dir });
  const saved = await first.saveProject(ctx.project);
  if (saved.kind !== "saved") throw new Error(`${label}: 저장이 수락되지 않음 ${saved.kind}`);
  const second = await initLocalProjectStore({ projectDir: dir });
  const snapshot = second.loadSnapshot();
  if (!snapshot) throw new Error(`${label}: 재로드 스냅샷 없음`);
  const events = snapshot.project.maps[mapId]!.events.filter((e) => e.id.startsWith("ev_spc_"));
  const rows = events.map((e) => {
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    const url = resolveAssetResourceUrl(g?.sprite?.id, { project: snapshot.project });
    return { id: e.id, sprite: g?.sprite?.id, pattern: g?.pattern, url };
  });
  if (rows.length !== WANT.length || rows.some((r) => !r.sprite?.startsWith("tex_oprn_charset_scarloxy_people") || !r.url?.startsWith("/assets/generated/charsets/ScarloxyPeople"))) {
    throw new Error(`${label}: 재로드 뒤 그림이 다르다 ${JSON.stringify(rows)}`);
  }
  report.push({ label, projectDir: dir, projectId: second.projectId, saved: saved.kind, sha256: snapshot.sha256, revision: snapshot.revision, placed, rtpRejected: !rejected.ok, reloaded: rows });
}
console.log(JSON.stringify(report, null, 1));
