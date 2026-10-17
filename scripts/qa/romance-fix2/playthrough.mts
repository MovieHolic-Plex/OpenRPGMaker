// 다인 연애 한 판을 헤드리스로 끝까지 — 인물 하나(또는 아무도 안 만남)에 집중해 기한 엔딩까지 가는지 본다.
//   bun scripts/qa/romance-fix2/playthrough.mts <project.json> <characterId|none>[,<characterId>...] [maxDays]
// 하루 칸(socialLoop.slotsPerDay)마다: 지금 시간대에 그 인물이 서 있는 자리(일정)를 찾아 옆에 서서 대화한다. 칸이 다하면 잠으로 넘어간다.
// qa:game check 의 자동 플레이는 맵 이벤트의 triggerEnding 만 목표로 삼아서, onDayEnd 공통 이벤트가 부르는 기한 엔딩은 걸어 보지 않는다 — 이 프로브가 그 빈 곳을 메운다.
import { readFileSync } from "node:fs";
import { deserialize } from "../../../src/project/io.ts";
import { runSceneTest, type SceneStep } from "../../../src/testing/sceneTestRunner.ts";
import { isTalkFriendshipEnabled } from "../../../src/project/friendship.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { resolveSocialLoop } from "../../../src/project/socialLoop.ts";
import type { Project, PlaySession } from "../../../src/project/types.ts";

const [file, who = "none", maxDaysArg] = process.argv.slice(2) as [string, string?, string?];
const project = deserialize(readFileSync(file, "utf8")) as Project;
const targets = who === "none" ? [] : who.split(",");
const loop = resolveSocialLoop(project);
const slots = loop?.slotsPerDay ?? 3;
const maxDays = Number(maxDaysArg ?? 8);
const PHASES = ["morning", "day", "evening", "night"] as const;
type Npc = { mapId: string; id: string; name: string; characterId: string; x: number; y: number; schedule: { when: { timePhase?: string }; at: { mapId: string; x: number; y: number } }[] };
const npcs: Npc[] = [];
for (const [mapId, map] of Object.entries(project.maps)) for (const e of map.events) {
  if (!isTalkFriendshipEnabled(e) || !e.characterId) continue;
  npcs.push({ mapId, id: e.id, name: e.name, characterId: e.characterId, x: e.x, y: e.y, schedule: (e.schedule ?? []) as Npc["schedule"] });
}
const placeOf = (npc: Npc, phase: string) => npc.schedule.find((s) => s.when.timePhase === phase)?.at ?? { mapId: npc.mapId, x: npc.x, y: npc.y };
const standBeside = (mapId: string, x: number, y: number) => {
  const map = project.maps[mapId]!;
  for (const [dx, dy, face] of [[0, 1, "up"], [0, -1, "down"], [-1, 0, "right"], [1, 0, "left"]] as const) {
    const sx = x + dx, sy = y + dy;
    if (sx < 0 || sy < 0 || sx >= map.width || sy >= map.height) continue;
    if (isPassable(project, map, sx, sy) && canMove(project, map, sx, sy, x, y)) return { x: sx, y: sy, face };
  }
  return undefined;
};
let session: PlaySession | undefined;
const log: string[] = [];
let ending: string | undefined;
let day = 0;
const run = (steps: SceneStep[]) => {
  const res = runSceneTest(project, { mapId: project.startMapId, start: project.startPos, steps }, undefined, session ? { initialSession: session } : {});
  session = res.session;
  return res;
};
// 시작 상태를 한 번 만든다(빈 단계).
run([]);
outer: for (day = 1; day <= maxDays; day += 1) {
  const startDay = (session as unknown as { gameTime?: { day: number } }).gameTime?.day ?? 0;
  for (let slot = 0; slot < slots; slot += 1) {
    const phase = session?.gameTime ? (session as unknown as { gameTime: { phase?: string } }).gameTime.phase : undefined;
    const npc = targets.length ? npcs.find((n) => n.characterId === targets[(day + slot) % targets.length]) : undefined;
    if (!npc) break; // 아무도 안 만난다 — 잠으로
    const phaseName = phase ?? PHASES[Math.min(slot, 2)]!;
    const at = placeOf(npc, phaseName);
    const stand = standBeside(at.mapId, at.x, at.y);
    if (!stand) { log.push(`day ${day} slot ${slot}: ${npc.name} 옆에 설 칸이 없다 (${at.mapId} ${at.x},${at.y})`); break; }
    const res = run([{ kind: "set", mapId: at.mapId, x: stand.x, y: stand.y, facing: stand.face }, { kind: "interact", eventId: npc.id }]);
    const f = res.finalState.friendship[npc.characterId];
    log.push(`day ${day} slot ${slot} [${phaseName}] ${npc.name} @${at.x},${at.y} → ok=${res.ok} 호감=${f}${res.failureReason ? ` (${res.failureReason})` : ""}`);
    if (res.finalState.endingsReached.length) { ending = res.finalState.endingsReached.join(","); break outer; }
    if (!res.ok) break outer;
  }
  // 칸을 다 쓰면 forceSleep 으로 이미 하루가 넘어갔다 — 그때는 더 넘기지 않는다(이중 계산하면 기한이 절반으로 보인다).
  const gameDay = () => (session as unknown as { gameTime?: { day: number } }).gameTime?.day ?? 0;
  const rolled = gameDay() > startDay;
  const res = rolled ? run([]) : run([{ kind: "advanceDays", days: 1 }]);
  const f = res.finalState;
  log.push(`day ${day} 끝${rolled ? "(칸 소진 잠)" : "(하룻밤 넘김)"} → 경과일 ${f.variables.var_days_elapsed ?? "?"} 게임일 ${gameDay()} 호감 ${JSON.stringify(f.friendship)} 엔딩 ${f.endingsReached.join(",") || "-"}${res.failureReason ? ` 실패 ${res.failureReason}` : ""}`);
  if (f.endingsReached.length) { ending = f.endingsReached.join(","); break; }
  if (!res.ok) break;
}
console.log(log.join("\n"));
console.log(JSON.stringify({ who, days: day, ending: ending ?? null }));
