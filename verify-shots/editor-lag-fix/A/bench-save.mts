// 호스트 저장 경로 벤치: 저장소 핸들러를 프로세스 안에서 돌려 «한 칸 칠하기» 맵 패치를 N 번 보낸다.
//   bun build verify-shots/editor-lag-fix/A/bench-save.mts --target=node --outfile /tmp/lag-a/bench.mjs
//   node /tmp/lag-a/bench.mjs <projectDir 사본> <N> <출력 접두사>
// 원본 프로젝트가 아니라 사본만 넘길 것. 결과: 저장별 ms, 최종 문서의 펼친 글 sha·정본 JSON sha, 맵 미러 요약.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { createProjectSessionRegistry } from "../../../electron/main/sessions";
import { createStoreHandlers } from "../../../electron/main/dispatch";
import { OPRN_CHANNELS } from "../../../electron/shared/channels";
import { canonicalJsonString } from "../../../src/project/persistence/core/canonicalJson";

const [projectDir, nText, outPrefix] = process.argv.slice(2);
if (!projectDir || !nText || !outPrefix) throw new Error("usage: bench.mjs <projectDir> <N> <outPrefix>");
const N = Number(nText);
const KEY = "bench";
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const sessions = createProjectSessionRegistry();
const handlers = createStoreHandlers(sessions);
const call = (channel: string, payload?: unknown) => handlers[channel]!(KEY, payload) as Promise<any>;

const t0 = performance.now();
await call(OPRN_CHANNELS.projectOpen, { projectDir });
console.log(`open ${(performance.now() - t0).toFixed(0)}ms`);
const session = sessions.require(KEY);
const store = session.store;
const info = store.info();
console.log(`rev ${info.revision} sha ${info.sha256?.slice(0, 12)}`);

const mapId = "map_blank_start";
const other = "map_oga_cave_lake_20260921";
const doc = store.hostDocument() as { maps: Record<string, any> };
let current: any = JSON.parse(JSON.stringify(doc.maps[mapId]));
let currentOther: any = JSON.parse(JSON.stringify(doc.maps[other]));
const times: number[] = [];
const responses: string[] = [];
let baseSha = info.sha256!;
for (let i = 0; i < N; i += 1) {
  // 매번 같은 결정적 변경: 한 칸을 바꾼다. 3 번에 한 번은 다른 맵도 함께 바꾼다.
  const tiles = current.lowerTiles.slice();
  tiles[(i * 37) % tiles.length] = 300 + (i % 7);
  current = { ...current, lowerTiles: tiles };
  const set: Record<string, unknown> = { [mapId]: current };
  if (i % 3 === 2) {
    const t = currentOther.lowerTiles.slice();
    t[(i * 11) % t.length] = 60 + (i % 5);
    currentOther = { ...currentOther, lowerTiles: t };
    set[other] = currentOther;
  }
  const payload = { projectDir, baseSha, patch: { maps: { set } }, changedMapIds: Object.keys(set) };
  const s = performance.now();
  const result = await call(OPRN_CHANNELS.projectSaveMapPatch, payload);
  const ms = performance.now() - s;
  times.push(ms);
  if (result.kind !== "saved") throw new Error(`save ${i}: ${JSON.stringify(result).slice(0, 200)}`);
  responses.push(`${result.kind} rev=${result.revision} sha=${result.sha256.slice(0, 12)} serialized=${result.serialized === undefined ? "no" : `${result.serialized.length}B`}`);
  baseSha = result.sha256;
}
times.forEach((ms, i) => console.log(`save ${i}: ${ms.toFixed(0)}ms  ${responses[i]}`));
const sorted = [...times].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)]!;
console.log(`median ${median.toFixed(0)}ms  mean ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)}ms  min ${sorted[0]!.toFixed(0)} max ${sorted[sorted.length - 1]!.toFixed(0)}`);

// 등가 검사용 지문 — 저장 뒤 같은 대상을 다시 읽는다.
const exported = store.exportSerialized()!;
const finalInfo = store.info();
const fingerprint = {
  revision: finalInfo.revision,
  infoSha: finalInfo.sha256,
  exportedTextSha: sha(exported),
  canonicalSha: sha(canonicalJsonString(JSON.parse(exported))),
  exportedLength: exported.length,
};
session.store.close();
const db = new DatabaseSync(join(projectDir, "project.sqlite"), { readOnly: true });
const mirrors = db.prepare("select map_id, sha256, length(map_json) as len from maps order by map_id").all() as any[];
const mirrorSha = sha(mirrors.map((m) => `${m.map_id}:${m.sha256}:${m.len}`).join("\n"));
const rowCounts = {
  blobs: (db.prepare("select count(*) c from tileset_blobs").get() as any).c,
  maps: mirrors.length,
};
db.close();
const summary = { N, timesMs: times.map((t) => Math.round(t)), median: Math.round(median), fingerprint, mirrorSha, rowCounts };
writeFileSync(`${outPrefix}.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(fingerprint), mirrorSha.slice(0, 12), JSON.stringify(rowCounts));
process.exit(0);
