// 다인 연애 캠퍼스 일상 시험 입력(헤드리스 도구 경로) — 인물 3명·시간대별 위치·요일별 만남 풀.
//   bun scripts/qa/romance-fix2/multi-fixture.mts <연애 기본값이 깔린 캠퍼스 project.json> <outDir>
// 출력: <outDir>/project.json(시험 프로젝트), <outDir>/proof.json(런타임 QA 가 읽는 좌표·경로), <outDir>/tools.json(도구 결과 요약).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { applyRomanceDefaults } from "../../../src/project/romancePreset.ts";
import type { Project } from "../../../src/project/types.ts";
const [file, outDir] = process.argv.slice(2) as [string, string];
mkdirSync(outDir, { recursive: true });
const project = deserialize(readFileSync(file, "utf8")) as Project;
// 옛 단일 호감 게이지 HUD 가 깔린 입력이면 지우고 현재 기본값(호감 목록)을 다시 깐다. 이미 목록이면 그대로(멱등).
if (!process.env.KEEP_OLD_HUD && project.system.fieldHud?.widgets?.some(w => w.id === "affection" && w.kind === "gauge")) delete (project.system as { fieldHud?: unknown }).fieldHud;
const reapplied = applyRomanceDefaults(project);
const ctx = { project, assistantRun: true } as { project: Project; assistantRun: boolean };
const log: Record<string, unknown> = { reappliedDefaults: reapplied };
const mapId = project.startMapId;
const map0 = project.maps[mapId]!;
const dirs = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;
const key = (x: number, y: number) => y * map0.width + x;
// 시작에서 걸어 닿는 칸(BFS)
const reach = new Map<number, { from: number; dir: string }>();
const q = [key(project.startPos.x, project.startPos.y)];
reach.set(q[0]!, { from: -1, dir: "" });
for (let h = 0; h < q.length; h++) {
  const c = q[h]!; const cx = c % map0.width, cy = Math.floor(c / map0.width);
  for (const [d, dx, dy] of dirs) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= map0.width || y >= map0.height || reach.has(key(x, y))) continue;
    if (!isPassable(project, map0, x, y) || !canMove(project, map0, cx, cy, x, y)) continue;
    reach.set(key(x, y), { from: c, dir: d }); q.push(key(x, y));
  }
}
const nearestReach = (tx: number, ty: number, avoid: { x: number; y: number }[] = []) => {
  let best: { x: number; y: number; d: number } | undefined;
  for (const k of reach.keys()) {
    const x = k % map0.width, y = Math.floor(k / map0.width);
    if (avoid.some(a => Math.abs(a.x - x) + Math.abs(a.y - y) < 3)) continue;
    const d = Math.abs(x - tx) + Math.abs(y - ty);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best!;
};
const loc = (name: string) => map0.locations!.find(l => l.name.startsWith(name))!;
const front = (l: { x: number; y: number; w: number; h: number }) => ({ x: l.x + Math.floor(l.w / 2), y: l.y + l.h + 1 });
const used: { x: number; y: number }[] = [project.startPos];
const spot = (name: string) => { const f = front(loc(name)); const s = nearestReach(f.x, f.y, used); used.push(s); return s; };
// 장소(시간대 위치)
const S = {
  lecture: spot("강의동"), dept: spot("학과동"), lab: spot("연구동"), hall: spot("대강의동"), dorm: spot("기숙사"),
  plaza: nearestReach(Math.floor(map0.width / 2), Math.floor(map0.height / 2) + 2, used),
};
used.push(S.plaza);
log.spots = S;
const people = [
  { id: "char_yuna", name: "한유나", home: S.lecture,
    sched: [["morning", S.lecture, "수업 전 강의동 앞"], ["day", S.plaza, "광장 벤치"], ["evening", S.dorm, "기숙사 앞 산책"]] as const },
  { id: "char_seoyeon", name: "윤서연", home: S.hall,
    sched: [["morning", S.hall, "대강의동 앞 독서"], ["day", S.lab, "연구동 앞"], ["evening", S.plaza, "광장 분수"]] as const },
  { id: "char_minji", name: "강민지", home: S.dorm,
    sched: [["morning", S.dorm, "기숙사 앞 조깅"], ["day", S.dept, "학과동 동아리"], ["evening", S.lecture, "강의동 앞"]] as const },
];
const WEEK = { weekdays: [1, 3, 5], weekend: [0, 6], tuethu: [2, 4] };
const placed: Record<string, { eventId: string; x: number; y: number }> = {};
for (const p of people) {
  const r: any = runTool(ctx as never, "place_npc", {
    mapId, x: p.home.x, y: p.home.y, name: p.name, movement: "fixed", characterId: p.id, talkFriendship: true,
    pages: [
      { lines: [`${p.name}: 안녕하세요, 오늘도 캠퍼스에서 보네요.`] },
      { conditions: [{ kind: "weekday", weekdays: WEEK.weekdays }], lines: [`${p.name}: 오늘은 수업이 많은 날이에요. 같이 들을래요?`] },
      { conditions: [{ kind: "weekday", weekdays: WEEK.tuethu }], lines: [`${p.name}: 오늘은 동아리 모임이 있어요. 구경 올래요?`] },
      { conditions: [{ kind: "weekday", weekdays: WEEK.weekend }], lines: [`${p.name}: 주말에는 캠퍼스가 조용해서 좋아요.`] },
      { conditions: [{ kind: "friendshipAtLeast", npcKey: p.id, value: 20 }], lines: [`${p.name}: 요즘 자주 만나서 좋아요. 사실 할 말이 있어요.`] },
    ],
  });
  log[`place_${p.id}`] = r.ok ? "ok" : (r.summary ?? JSON.stringify(r).slice(0, 300));
  const ev = ctx.project.maps[mapId]!.events.find(e => e.characterId === p.id);
  if (ev) placed[p.id] = { eventId: ev.id, x: ev.x, y: ev.y };
}
// 시간표
for (const p of people) {
  const ev = placed[p.id]; if (!ev) continue;
  const r: any = runTool(ctx as never, "set_npc_schedule", {
    mapId, eventId: ev.eventId,
    schedule: p.sched.map(([phase, at, activity]) => ({ when: { timePhase: phase }, at: { mapId, x: at.x, y: at.y }, facing: "down", activity })),
  });
  log[`schedule_${p.id}`] = r.ok ? (r.warnings ?? "ok") : (r.summary ?? JSON.stringify(r).slice(0, 300));
}
// 기한 엔딩(인물별 — 한 인물 기준 도구가 다인 결말을 지을 수 있는지)
for (const [id, name] of [["end_yuna", "유나와 함께"], ["end_seoyeon", "서연과 함께"], ["end_minji", "민지와 함께"], ["end_alone", "혼자 남은 봄"]] as const) {
  const r: any = runTool(ctx as never, "define_ending", { id, name, conditions: [], epilogue: [{ kind: "say", speaker: "나", text: `${name}.` }] });
  log[`ending_${id}`] = r.ok ? "ok" : r.summary;
}
const dl: any = runTool(ctx as never, "set_deadline_ending", { days: 3, tiers: [
  { endingId: "end_yuna", characterId: "char_yuna", friendshipAtLeast: 40 }, { endingId: "end_seoyeon", characterId: "char_seoyeon", friendshipAtLeast: 40 },
  { endingId: "end_minji", characterId: "char_minji", friendshipAtLeast: 40 }, { endingId: "end_alone" } ] });
log.deadlineMultiPerson = dl.ok ? (dl.summary ?? "ok") : (dl.summary ?? JSON.stringify(dl).slice(0, 400));
// BFS 경로
const adjTo = (tx: number, ty: number) => dirs.map(([d, dx, dy]) => ({ d, x: tx - dx, y: ty - dy })).filter(a => reach.has(key(a.x, a.y)) && !(a.x === tx && a.y === ty))[0]!;
const route = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const prev = new Map<number, { from: number; dir: string }>(); const qq = [key(from.x, from.y)]; prev.set(qq[0]!, { from: -1, dir: "" });
  for (let h = 0; h < qq.length; h++) {
    const c = qq[h]!; const cx = c % map0.width, cy = Math.floor(c / map0.width);
    if (cx === to.x && cy === to.y) break;
    for (const [d, dx, dy] of dirs) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= map0.width || y >= map0.height || prev.has(key(x, y))) continue;
      if (!isPassable(project, map0, x, y) || !canMove(project, map0, cx, cy, x, y)) continue;
      prev.set(key(x, y), { from: c, dir: d }); qq.push(key(x, y));
    }
  }
  const moves: { kind: "move"; dir: string }[] = [];
  for (let c = key(to.x, to.y); prev.get(c)?.from !== undefined && prev.get(c)!.from >= 0; c = prev.get(c)!.from) moves.unshift({ kind: "move", dir: prev.get(c)!.dir });
  return moves;
};
const faceFrom = (a: { x: number; y: number }, t: { x: number; y: number }) => (a.x < t.x ? "right" : a.x > t.x ? "left" : a.y < t.y ? "down" : "up");
const start = project.startPos;
const yunaMorning = adjTo(S.lecture.x, S.lecture.y);
const steps = [
  { who: "char_yuna", at: S.lecture, adj: yunaMorning },
  { who: "char_minji", at: S.dept, adj: adjTo(S.dept.x, S.dept.y) },
  { who: "char_seoyeon", at: S.plaza, adj: adjTo(S.plaza.x, S.plaza.y) },
  { who: "char_yuna", at: S.lecture, adj: yunaMorning }, // 이튿날 아침(화요일) 다시 유나
];
let cur = start; const proofSteps: unknown[] = [];
for (const s of steps) {
  const at = s.adj; const r = route(cur, at);
  proofSteps.push({ ...s, eventId: placed[s.who]?.eventId, moves: r, face: faceFrom(at, s.at), arrive: at }); cur = at;
}
writeFileSync(`${outDir}/project.json`, serialize(ctx.project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ mapId, start, spots: S, placed, steps: proofSteps }, null, 1));
writeFileSync(`${outDir}/tools.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log, null, 1));
