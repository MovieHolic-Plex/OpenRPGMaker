// 추격자 맵에 은신처 소급 적용 — 조수 끝맺음(src/ai/v2/verbs.ts clearLanes)과 같은 함수(ensureChaserHidingSpots)를 저장된 게임 폴더에 돌린다.
//
//   npx tsx scripts/content/apply-chaser-hiding.mts <project 폴더> [--dry]
//
// 추격자가 있는데 은신처가 0곳인 맵마다 맵에 있는 옷장·사물함·침대·커튼 1~2곳(순찰 길에서 2~8칸)에 interaction hiding 이벤트를 건다.
// 저장(saveProject) 뒤 같은 폴더를 다시 열어 은신 이벤트가 있는지 확인하고 출력한다. --dry 면 고르기만 하고 쓰지 않는다.
import { resolve } from "node:path";
import { openLocalProjectStore } from "../../electron/local-store/store";
import { chaserEvents, ensureChaserHidingSpots, mapHidingEvents } from "../../src/project/chaserHiding";

const dir = process.argv[2];
if (!dir) throw new Error("usage: apply-chaser-hiding.mts <project 폴더> [--dry]");
const dry = process.argv.includes("--dry");
const projectDir = resolve(dir);
const store = await openLocalProjectStore({ projectDir });
const report: unknown[] = [];
try {
  const snapshot = store.loadSnapshot();
  if (!snapshot) throw new Error(`${projectDir}: 저장된 프로젝트가 없다`);
  const project = structuredClone(snapshot.project);
  let changed = false;
  for (const map of Object.values(project.maps)) {
    if (!chaserEvents(map).length) continue;
    const result = ensureChaserHidingSpots(project, map);
    report.push({ mapId: map.id, map: map.name, placed: result.placed, note: result.note, alreadyHad: mapHidingEvents(map).length - result.placed.length });
    if (result.placed.length) changed = true;
  }
  if (changed && !dry) {
    const saved = await store.saveProject(project);
    report.push({ saved });
  }
} finally {
  store.close();
}
if (!dry) {
  const reopened = await openLocalProjectStore({ projectDir });
  try {
    const project = reopened.loadSnapshot()?.project;
    report.push({ reload: Object.values(project?.maps ?? {}).filter((m) => chaserEvents(m).length).map((m) => ({ mapId: m.id, hiding: mapHidingEvents(m).map((e) => ({ id: e.id, x: e.x, y: e.y, name: (e as { name?: string }).name })) })) });
  } finally {
    reopened.close();
  }
}
console.log(JSON.stringify(report, null, 1));
