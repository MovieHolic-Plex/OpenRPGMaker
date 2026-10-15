// 연애 하루 루프 증거 — 모델 없이 헤드리스 도구 경로(runTool)와 장면 러너(runSceneTest)로 돈다.
//   bun scripts/qa/romance-fix/loop.mts <baseline.json> <outDir> [--legacy]
// --legacy 는 socialLoop 를 켜지 않는다(기존 동작 = 하루 한 번, 시계 불변).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { runTool } from "../../../src/editor/tools/index.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { runSceneTest } from "../../../src/testing/sceneTestRunner.ts";
import type { Project } from "../../../src/project/types.ts";
const [baselineFile, outDir] = process.argv.slice(2) as [string, string];
const legacy = process.argv.includes("--legacy");
mkdirSync(outDir, { recursive: true });
const log: Record<string, unknown> = {};
const project = deserialize(readFileSync(baselineFile, "utf8")) as Project;
const ctx = { project, assistantRun: true } as { project: Project; assistantRun: boolean };
const call = (name: string, args: Record<string, unknown>) => runTool(ctx as never, name, args);

let r = call("configure_time_system", { enabled: true, forceSleep: !legacy }); assert.ok(r.ok, JSON.stringify(r));
if (!legacy) ctx.project.system.socialLoop = { slotsPerDay: 3, dailyFriendshipCap: 20 };

const startMap = ctx.project.maps[ctx.project.startMapId]!;
const mapId = startMap.id;
const base = { x: Math.floor(startMap.width / 2) - 6, y: Math.floor(startMap.height / 2) };

// 1. place_npc: 선언 밖 키는 조수 실행에서 거부된다.
r = call("place_npc", { mapId, x: base.x, y: base.y, name: "하린", characterId: "char_harin", friendshipUnlock: 5, pages: [{ lines: ["안녕."] }] });
log.unknownKey = { ok: r.ok, message: r.ok ? null : r.issues?.[0]?.message?.slice(0, 160) };
assert.equal(r.ok, false);
const ids: string[] = []; const spots: { x: number; y: number }[] = [];
for (const [i, nm] of ["하린", "도윤", "서아"].entries()) {
  r = call("place_npc", { mapId, x: base.x + i * 4, y: base.y, name: nm, characterId: `char_${i}`, talkFriendship: true, pages: [{ lines: [`${nm}: 안녕.`] }] });
  assert.ok(r.ok, JSON.stringify(r));
  const data = (r as { data: { eventId: string; x: number; y: number } }).data;
  ids.push(data.eventId); spots.push({ x: data.x, y: data.y });
}
log.npcs = ids.map((id, i) => ({ id, ...spots[i], talkFriendship: ctx.project.maps[mapId]!.events.find(e => e.id === id)?.talkFriendship }));

// 2. 엔딩 + 기한 엔딩 한 줄 도구.
for (const [id, name] of [["ending_good", "좋은 결말"], ["ending_normal", "평범한 결말"], ["ending_bad", "쓸쓸한 결말"]] as const) {
  r = call("define_ending", { id, name, conditions: [], epilogue: [{ kind: "say", speaker: "나", text: `${name}.` }] }); assert.ok(r.ok, JSON.stringify(r));
}
r = call("define_ending", { id: "ending_cond", name: "호감 조건 엔딩", conditions: [{ kind: "friendshipAtLeast", npcKey: "char_0", value: 30 }] });
log.defineFriendshipEnding = r.ok ? "ok" : r.issues?.[0]?.message; assert.ok(r.ok, JSON.stringify(r));
r = call("set_deadline_ending", { days: 3, characterId: "char_0", tiers: [{ endingId: "ending_good", friendshipAtLeast: 30 }, { endingId: "ending_normal", friendshipAtLeast: 10 }, { endingId: "ending_bad" }] });
log.deadline = r.ok ? { summary: r.summary, warnings: (r as { warnings?: string[] }).warnings } : r.issues;
assert.ok(r.ok, JSON.stringify(r));
r = call("set_deadline_ending", { days: 3, tiers: [{ endingId: "ending_good" }, { endingId: "ending_bad" }] });
log.deadlineBadTiers = r.ok ? "ok?!" : r.issues?.[0]?.message?.slice(0, 140); assert.equal(r.ok, false);

writeFileSync(`${outDir}/project.json`, serialize(ctx.project));

// 3. 장면: 하루 4번 대화(3칸) → 다음 날 → 3일째 끝에 결말.
const stand = (i: number) => ({ kind: "set" as const, mapId, x: spots[i]!.x, y: spots[i]!.y + 1, facing: "up" as const });
const talk = (i: number) => [stand(i), { kind: "interact" as const, eventId: ids[i]! }];
const steps = legacy ? [
  ...talk(0), { kind: "expect", friendshipAtLeast: { char_0: 10 } },
  ...talk(0), // 기존 동작: 같은 사람은 하루 한 번
  ...talk(1), ...talk(2),
  { kind: "advanceDays", days: 1 },
  ...talk(0),
  { kind: "advanceDays", days: 1 },
  { kind: "advanceDays", days: 1 },
] : [
  // 1일째: 같은 사람 세 번 — 둘째에서 상한 20, 셋째는 호감 0 이지만 칸은 쓰고, 칸을 다 쓰면 하루가 저문다.
  ...talk(0), ...talk(0), ...talk(0),
  // 2일째: 세 사람에게 한 번씩.
  ...talk(1), ...talk(2), ...talk(0),
  // 3일째는 말없이 보낸다 → 3일째 하루가 끝날 때 기한 엔딩.
  { kind: "advanceDays", days: 1 },
];
const result = runSceneTest(ctx.project, { mapId, start: { x: spots[0]!.x, y: spots[0]!.y + 1 }, steps: steps as never });
log.scene = { ok: result.ok, stepsRun: result.stepsRun, totalSteps: result.totalSteps, failureReason: result.failureReason, failedStepIndex: result.failedStepIndex };
const fin = result.finalState as unknown as Record<string, unknown>;
log.final = { friendship: (fin as { friendship?: unknown }).friendship, endingsReached: (fin as { endingsReached?: unknown }).endingsReached, gameTime: (fin as { gameTime?: unknown }).gameTime, variables: (fin as { variables?: unknown }).variables };
log.keys = Object.keys(fin).slice(0, 60);
log.transcript = ((result as unknown as { log?: string[] }).log ?? []).filter((l) => /talk|gift|onDayEnd|ending|advance/i.test(l)).slice(0, 60);
writeFileSync(`${outDir}/loop-log.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
