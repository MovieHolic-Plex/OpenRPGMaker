// 명세 은행 — 재기(모델 없음): 재생한 게임 하나(<폴더>/project.json · replay.json)를 이미 있는 탐침들로 재서 <폴더>/metrics.json 을 쓴다.
//   bun scripts/qa/assistant-v2/specBank/measureGame.mts <게임 결과 폴더> [--no-autoplay]
// 탐침은 새로 쓰지 않는다 — exitProbe(출구·길) · storyCoherenceProbe(잠김 글·목표·적·배경·걷는 길) · objectiveArrowProbe(화살표)를 그대로 부르고 그 출력의 수를 읽는다.
// 빌더 쪽 purposeProbe.mts(건물·들어감·사람·길 몫)가 들어오면 같은 식으로 읽는다(지금은 자리만 있다). 탐침이 없는 것만 제품 함수를 직접 부른다:
// 게임 검사·청사진 걷기·출하 차단(finishReplay.mts 와 같은 함수) · 건물 입구(place/entrances.ts) · 필드 HUD(project/fieldHud.ts).
// 재는 것은 항상 지금 작업 폴더의 자다 — 옛 커밋으로 재생한 게임도 같은 자로 잰다. 수치는 그림을 보지 않은 것이다(화면 미검증). 문서: openwiki/assistant-v2.md 「명세 은행」.
import fs from "node:fs";
import path from "node:path";
import { runGameCheck } from "../../../../src/qa/gameCheck/index.ts";
import { walkBlueprint } from "../../../../src/ai/v2/story/blueprint.ts";
import { shipBlockers } from "../../../../src/ai/v2/judge/shipChecks.ts";
import { buildingEntrances } from "../../../../src/ai/v2/place/entrances.ts";
import { effectiveFieldHud, hudOnScreen, projectHudUse, unusedHudGauges } from "../../../../src/project/fieldHud.ts";
import type { GameMap, Project } from "../../../../src/project/types.ts";
import type { Value } from "./metrics.mts";

const dir = process.argv[2];
if (!dir) { console.error("measureGame <게임 결과 폴더> [--no-autoplay]"); process.exit(2); }
const autoplay = !process.argv.includes("--no-autoplay");
const HERE = import.meta.dir, PROBES = path.resolve(HERE, "..");
const projectFile = path.join(dir, "project.json");
const project = JSON.parse(fs.readFileSync(projectFile, "utf8")) as Project;
const replay = fs.existsSync(path.join(dir, "replay.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "replay.json"), "utf8")) as {
  id: string; kind?: string; request?: string; calls: { total: number; played: number; sameOutcome: number; writes: number; writesSame: number; needsOutside: string[]; unresolvedIds: string[] };
  turns: { verdictNow?: { complete: boolean; summary: string }; verdictWas?: { complete: boolean }; missingArt?: string[]; gateItems?: string[]; forced: number; error?: string }[];
  trust?: { maps: { saved: number; sameTiles: number; named: number }; events: { saved: number; matched: number; samePlace: number; sameContent: number } };
} : undefined;

const values: Record<string, Value> = {};
const lines: Record<string, string[]> = {};
const probeErrors: string[] = [];

/** 탐침 하나를 따로 띄워 출력 글을 받는다(탐침들은 명령줄 스크립트다). */
function probe(script: string, args: string[]): string {
  const file = path.join(PROBES, script);
  if (!fs.existsSync(file)) return "";
  const run = Bun.spawnSync(["bun", file, ...args], { cwd: path.resolve(HERE, "../../../.."), stdout: "pipe", stderr: "pipe" });
  if (run.exitCode !== 0) probeErrors.push(`${script}: exit ${run.exitCode} ${run.stderr.toString().slice(-200)}`);
  return run.stdout.toString();
}
const num = (text: string, re: RegExp): number => Number(re.exec(text)?.[1] ?? 0);

// ── 기계 판정과 남은 문제 ─────────────────────────────────────────────────────────────────────────────────────
if (replay) {
  const last = replay.turns.at(-1);
  values.complete = [last?.verdictNow?.complete ? 1 : 0, 1];
  const todo = /할 일 (\d+)\/(\d+) 끝/u.exec(last?.verdictNow?.summary ?? "");
  if (todo) values.todoDone = [Number(todo[1]), Number(todo[2])];
  values.todoBlocked = num(last?.verdictNow?.summary ?? "", /막힘 (\d+)/u);
  // 끝맺음 관문(함수 검사)이 턴마다 할 일로 덧붙인 문제 — 빌더가 지은 것에 남은 흠의 수다.
  const gate = replay.turns.flatMap((t) => t.gateItems ?? []);
  values.gateProblems = gate.length;
  lines.gateProblems = gate;
  values.replayPlayed = [replay.calls.played, replay.calls.total];
  values.replaySame = [replay.calls.sameOutcome, replay.calls.played];
  const gaps = [...new Set(replay.turns.flatMap((t) => t.missingArt ?? []))];
  values.artGaps = gaps.filter((g) => g.startsWith("[art-gap]")).length;
  values.missingArt = gaps.length;
  lines.artGaps = gaps;
}
const task = replay?.request ?? project.gameBlueprint?.request ?? "게임 하나 만들어 줘.";
try {
  const check = runGameCheck(project, autoplay ? { autoPlayBudgetMs: 30_000 } : { skipAutoPlay: true });
  const blockers = check.findings.filter((f) => f.severity === "blocker");
  values.gameBlockers = blockers.length;
  lines.gameBlockers = blockers.map((f) => `[${f.code}] ${f.message.slice(0, 200)}`);
  const run = check.autoPlay?.runs?.[0];
  if (autoplay && run) { values.autoplayEnding = [run.ok && run.endingReached ? 1 : 0, 1]; if (!run.ok) lines.autoplay = [`${run.failure?.goal ?? ""}: ${run.failure?.detail.slice(0, 240) ?? ""}`]; }
} catch (error) { probeErrors.push(`runGameCheck: ${(error as Error).message.slice(0, 200)}`); }
try { const bp = walkBlueprint(project).blockers; values.blueprintBlockers = bp.length; lines.blueprintBlockers = bp.map((b) => `${b.id}`); } catch (error) { probeErrors.push(`walkBlueprint: ${(error as Error).message.slice(0, 200)}`); }
try { const ship = shipBlockers(project, task); values.shipBlockers = ship.length; lines.shipBlockers = ship.map((b) => `${b.id}`); } catch (error) { probeErrors.push(`shipBlockers: ${(error as Error).message.slice(0, 200)}`); }

// ── 출구·길 (exitProbe) ───────────────────────────────────────────────────────────────────────────────────────
{
  const out = path.join(dir, "exits.json");
  probe("exitProbe.mts", [projectFile, "--json", out]);
  if (fs.existsSync(out)) {
    const t = (JSON.parse(fs.readFileSync(out, "utf8")) as { total: Record<string, number>; rows: { map: string; exitsAt: string[] }[] });
    values.exitsOnRoad = [t.total.onRoad!, t.total.exits! - t.total.roadless!];
    values.exitsRoadless = t.total.roadless!;
    values.exitsFullWidth = [t.total.fullWidth!, t.total.edgeExits!];
    values.arriveRoad = [t.total.arriveRoad!, t.total.arrivals!];
    values.arriveInside = [t.total.arriveInside!, t.total.arrivals!];
    values.arriveFacing = [t.total.arriveFacing!, t.total.arrivals!];
    lines.exits = t.rows.flatMap((r) => r.exitsAt.map((e) => `${r.map} ${e}`));
  }
}

// ── 건물 입구·잠김 한 줄 (place/entrances.ts) ─────────────────────────────────────────────────────────────────
{
  const hasTransfer = (e: { pages?: { commands?: unknown }[] }): boolean => JSON.stringify((e.pages ?? []).map((p) => p.commands ?? [])).includes('"kind":"transfer"');
  let entrances = 0, enterable = 0, silent = 0, locked = 0, lockedRight = 0;
  for (const map of Object.values(project.maps) as GameMap[]) {
    let ents: ReturnType<typeof buildingEntrances> = [];
    try { ents = buildingEntrances(project, map); } catch { ents = []; }
    const events = map.events ?? [];
    entrances += ents.length;
    for (const d of ents) {
      const at = events.filter((e) => e.x === d.x && (e.y === d.y || e.y === d.front.y));
      if (at.some((e) => hasTransfer(e))) enterable += 1;
      if (!events.some((e) => Math.abs(e.x - d.x) <= 1 && e.y >= d.y && e.y <= d.y + 1)) silent += 1;
    }
    for (const e of events.filter((x) => x.id.startsWith("ev_locked_door_"))) {
      locked += 1;
      if (ents.some((d) => d.x === e.x && d.y === e.y)) lockedRight += 1; else (lines.lockedWrong ??= []).push(`${map.name} (${e.x},${e.y})`);
    }
  }
  values.entrancesEnterable = [enterable, entrances];
  values.entrancesSilent = [silent, entrances];
  values.lockedOnEntrance = [lockedRight, locked];
  values.lockedOffEntrance = locked - lockedRight;
}
// 빌더 쪽 목적 탐침(건물·들어감·문 앞 사람·길 몫)이 들어오면 여기서 읽는다.
{
  const out = path.join(dir, "purpose.json");
  if (fs.existsSync(path.join(PROBES, "purposeProbe.mts"))) probe("purposeProbe.mts", [`game=${projectFile}`, "--json", out]);
  if (fs.existsSync(out)) {
    const t = (JSON.parse(fs.readFileSync(out, "utf8")) as { runs: Record<string, { total: Record<string, number> }> }).runs.game?.total;
    if (t) { values.purposeRoleBuildings = [t.role ?? 0, t.buildings ?? 0]; values.purposePeople = t.people ?? 0; values.purposeRoute = [t.route ?? 0, t.walkable ?? 0]; }
  }
}

// ── 이야기와 맵이 맞나 (storyCoherenceProbe) ──────────────────────────────────────────────────────────────────
{
  const out = probe("storyCoherenceProbe.mts", ["facts", projectFile]).trim().split("\n");
  let c: Record<string, number> = {};
  try { c = JSON.parse(out.at(-1) ?? "{}") as Record<string, number>; } catch { probeErrors.push("storyCoherenceProbe facts: 마지막 줄이 JSON 이 아니다"); }
  const g = (k: string) => c[k] ?? 0;
  values.gateWrongPrereq = [g("G wrong-prerequisite"), g("G gates")];
  values.objectiveTextTail = [g("O text≠tail target"), g("O objectives")];
  values.sideQuestObjective = g("O side-quest objective");
  values.foeStaysAfterWin = [g("F stays after win"), g("F step foes")];
  values.foeFieldBattleSprite = [g("F field≠battle sprite"), g("F step foes")];
  values.offThemeBackdrop = [g("T forest backdrop off-theme"), g("T battle maps")];
  values.craftingLoot = g("T loot is crafting material");
  values.levelAfterBattles = g("X level after all battles");
  lines.story = out.slice(0, -1).filter((l) => /^[GOFTX] /u.test(l)).map((l) => l.slice(0, 240));
  const pace = probe("storyCoherenceProbe.mts", ["pacing", projectFile]).split("\n").find((l) => l.startsWith("합계:")) ?? "";
  const steps = num(pace, /단계 (\d+)/u), walkable = num(pace, /걷는 칸 (\d+)/u), touched = num(pace, /밟는 칸 (\d+)/u);
  if (walkable) { values.routeShare = [touched, walkable]; values.walkablePerStop = [walkable, Math.max(1, steps)]; values.stepsOnPath = steps; }
}

// ── 목표 화살표 (objectiveArrowProbe) ─────────────────────────────────────────────────────────────────────────
{
  const out = probe("objectiveArrowProbe.mts", ["after", projectFile]);
  const facts = out.split("\n").find((l) => /^== after: 자리/u.test(l)) ?? "";
  const walk = out.split("\n").find((l) => /^== after 눌러 걷기/u.test(l)) ?? "";
  if (facts) {
    const spots = num(facts, /자리 (\d+)/u);
    values.arrowFirstStepWrong = [num(facts, /A 첫 걸음 불일치 (\d+)/u), spots];
    values.arrowIntoWall = [num(facts, /B 벽을 본다 (\d+)/u), spots];
    values.arrowAcrossBlocked = [num(facts, /C 막힌 칸 가로지름 (\d+)/u), spots];
    values.arrowWalkUnreached = [num(walk, /못 닿음 (\d+)/u), num(walk, /출발 (\d+)곳/u)];
  }
}

// ── 필드 HUD (project/fieldHud.ts) ────────────────────────────────────────────────────────────────────────────
try {
  const hud = effectiveFieldHud(project);
  if (hud) {
    const unused = unusedHudGauges(hud, projectHudUse(project));
    values.hudUnusedGauges = unused.length;
    lines.hud = [`theme ${hud.theme} · 필드에 뜨는 것: ${hudOnScreen(hud).join(", ") || "(없음)"}${unused.length ? ` · 안 쓰는 게이지: ${unused.map((w) => w.source).join(", ")}` : ""}`];
  } else lines.hud = ["HUD 설정 없음"];
} catch (error) { probeErrors.push(`fieldHud: ${(error as Error).message.slice(0, 200)}`); }

values.maps = Object.keys(project.maps).length;
values.events = Object.values(project.maps).reduce((n, m) => n + (m.events ?? []).length, 0);
if (replay?.trust) { values.trustMapTiles = [replay.trust.maps.sameTiles, replay.trust.maps.saved]; values.trustEvents = [replay.trust.events.matched, replay.trust.events.saved]; values.trustEventContent = [replay.trust.events.sameContent, replay.trust.events.saved]; }
fs.writeFileSync(path.join(dir, "metrics.json"), JSON.stringify({ id: replay?.id ?? path.basename(dir), kind: replay?.kind ?? "game", values, lines, probeErrors }, null, 1));
console.log(`${replay?.id ?? path.basename(dir)}: ${Object.keys(values).length}칸${probeErrors.length ? ` · 탐침 오류 ${probeErrors.length}: ${probeErrors.join(" | ").slice(0, 300)}` : ""}`);
process.exit(0);
