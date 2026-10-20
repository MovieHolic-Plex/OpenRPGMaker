// 아스트라 호라이즌 생성본을 새 SQLite 프로젝트 폴더에 저장하고 다시 열어 같은지 확인한다(프로젝트 정본 저장 규칙의 근거).
//   node scripts/qa/astra-horizon/save-reload.mjs <project.json> <new-project-dir> <evidence-dir>
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { withTsModule } from "../../ontology-ts-loader.mjs";
const [input, projectDir, out] = process.argv.slice(2);
if (!input || !projectDir || !out) throw Error("Usage: save-reload.mjs <project.json> <new-project-dir> <evidence-dir>");
if (fs.existsSync(path.join(projectDir, "project.sqlite"))) throw Error("새 폴더가 필요하다");
const text = fs.readFileSync(input, "utf8");
const submitted = JSON.parse(text);
// 저장소는 불러올 때 정규화한다(무리 enemyIds 를 members 에서, 적 skillIds 를 actions 에서 다시 만들고, 오프닝 이미지 장면을 animatic 으로 되돌린다) —
// 출하 플레이어도 같은 정규화를 거친다. 그래서 (1) 다시 연 것을 한 번 더 저장·재로드해 바뀌지 않는지(멱등), (2) 첫 10분 손질 표식이 남았는지 본다.
const markers = (p) => ({
  nurseSprite: Boolean(p.maps.mx_map_home_center?.events.some((e) => e.id === "mx_map_home_center_nurse_sprite")),
  firstWild: p.maps.mx_map_meadow?.events.filter((e) => e.id.startsWith("mx_map_meadow_first_wild_")).length ?? 0,
  rivalGone: Boolean(p.maps.mx_map_lab?.events.find((e) => e.id === "mx_map_lab_rival")?.pages?.some((pg) => pg.id.endsWith("_gone"))),
  sprigletPsychicLevel: p.database.monsterSpecies.find((s) => s.id === "mx_species_spriglet")?.skillsByLevel?.find((s) => s.skillId === "mx_skill_psychic_1")?.level,
  potionGift: JSON.stringify(p.maps.mx_map_lab?.events ?? []).includes('"itemId":"item_potion"'),
});
async function saveReload(api, dir, serialized) {
  let store = await api.initLocalProjectStore({ projectDir: dir });
  try {
    const saved = await store.saveSerialized(serialized, store.loadSnapshot()?.sha256 ?? null);
    if (saved.kind !== "saved") throw Error(`저장 거절: ${saved.kind}`);
  } finally { store.close(); }
  store = await api.openLocalProjectStore({ projectDir: dir });
  try {
    const snapshot = store.loadSnapshot();
    if (!snapshot) throw Error("다시 열기 실패");
    return { projectId: store.info().projectId, revision: snapshot.revision, sha256: snapshot.sha256, project: JSON.parse(JSON.stringify(snapshot.project)) };
  } finally { store.close(); }
}
await withTsModule("electron/local-store/store.ts", "astra-save.mjs", async (api) => {
  const first = await saveReload(api, projectDir, text);
  const second = await saveReload(api, `${projectDir}-again`, JSON.stringify(first.project));
  const idempotent = isDeepStrictEqual(first.project, second.project);
  const before = markers(submitted), after = markers(first.project);
  const proof = { projectId: first.projectId, projectDir: path.resolve(projectDir), revision: first.revision, sha256: first.sha256, title: first.project.meta?.title, maps: Object.keys(first.project.maps).length, idempotent, markersBefore: before, markersAfterReload: after };
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "storage-proof.json"), JSON.stringify(proof, null, 2));
  console.log(proof);
  if (!idempotent || !isDeepStrictEqual(before, after)) throw Error("재로드 확인 실패");
});
