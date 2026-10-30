// author_mystery_case verdict.mode "chapter" 증거 — 지목 뒤 엔딩 없이 결과 스위치가 켜지고 게임이 이어지는가.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/mystery-verdict-chapter-proof.mts [출력.json]
// 저장소는 임시 폴더 — 사용자 프로젝트가 아니다.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initLocalProjectStore } from "../../electron/local-store/store";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { Command, GameEvent, Project } from "@/project/types";
import { checkMystery } from "@/qa/gameCheck/mystery";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";

function stage(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  for (let x = 0; x < map.width; x += 1) map.lowerTiles[x] = TILE.WALL;
  for (let y = 1; y < map.height; y += 1) map.lowerTiles[y * map.width] = TILE.WALL;
  return project;
}

function spec(mapId: string, verdict?: Record<string, unknown>): Record<string, unknown> {
  return {
    caseId: "well", title: "우물가 익사 사건", victim: { name: "김 서방" }, culprit: "butler",
    suspects: [
      { id: "butler", name: "머슴 돌쇠", at: { mapId, x: 3, y: 3 }, alibi: ["밤새 외양간에 있었습지요."], motive: ["품삯을 떼였습니다."],
        lie: { claim: "두레박엔 손도 안 댔습니다.", contradictedBy: "rope", truth: ["…줄을 끊은 건 저입니다."] } },
      { id: "elena", name: "주모 순덕", at: { mapId, x: 7, y: 3 }, alibi: ["주막에서 술상을 봤지요."], motive: ["외상값이 밀렸지요."],
        testimony: ["밤중에 돌쇠가 낫을 들고 우물 쪽으로 갔어요."] },
      { id: "leo", name: "포수 막동", at: { mapId, x: 12, y: 3 }, alibi: ["산에 있었소."], motive: ["땅 문제로 다퉜소."],
        lie: { claim: "밤새 산에 있었소.", contradictedBy: "ledger", truth: ["사실은 주막에서 투전을 했소."] } },
    ],
    clues: [
      { id: "rope", name: "끊긴 두레박줄", at: { mapId, x: 3, y: 10 }, description: "칼로 벤 자국이 있다. 돌쇠의 낫 날과 폭이 같다.", implicates: ["butler"], obtainedBy: "examine" },
      { id: "receipt", name: "주막 술상 장부", at: { mapId, x: 8, y: 12 }, description: "그 시각 순덕이 손님 셋을 받은 기록.", excludes: ["elena"], obtainedBy: "examine" },
      { id: "ledger", name: "투전 빚 문서", at: { mapId, x: 15, y: 11 }, description: "막동이 밤새 주막에서 투전한 기록.", obtainedBy: "examine" },
      { id: "sickle", name: "낫 증언", description: "순덕: 밤중에 돌쇠가 낫을 들고 우물로 갔다.", implicates: ["butler"], obtainedBy: "testimony", givenBy: "elena" },
    ],
    accuser: { name: "이방", at: { mapId, x: 10, y: 5 } },
    endings: { solved: { name: "사건 해결", lines: ["돌쇠를 옥에 가두겠소."] }, wrong: { name: "오판", lines: ["엉뚱한 이를 잡았구려…"] } },
    ...(verdict ? { verdict } : {}),
  };
}

const project = stage();
const ctx = { project, assistantRun: false };
const onSolved: Command[] = [{ kind: "text", body: "이방: 이제 밤의 일을 보러 가시지요." } as Command];
const authored = runTool(ctx, "author_mystery_case", spec(project.startMapId, { mode: "chapter", onSolved, after: ["그 일은 이미 매듭지었소."] }), { dryRun: false });
if (!authored.ok) throw new Error(`author 실패: ${authored.summary} ${JSON.stringify(authored.issues)}`);
const data = authored.data as { verdict: { solvedSwitchId: string; wrongSwitchId: string }; verificationScene: { mapId: string; start: { x: number; y: number }; steps: SceneStep[] }; endings?: unknown };
const { solvedSwitchId, wrongSwitchId } = data.verdict;

// ① 동봉 검증 시나리오(정답 지목 → 결과 스위치) 그대로
const solvedRun = runSceneTest(ctx.project, data.verificationScene);
// ② 정답 지목 뒤 다시 말 걸기 → 판정 뒤 페이지, 게임 계속
const accuser = Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => e.name === "이방") as GameEvent;
const W: SceneStep = { kind: "wait", ticks: 600 };
const again = runSceneTest(ctx.project, { ...data.verificationScene, steps: [...data.verificationScene.steps,
  { kind: "set", x: accuser.x, y: accuser.y + 1, facing: "up" }, { kind: "interact", eventId: accuser.id }, W] });
// ③ 오답 지목: 정답 시나리오의 마지막 choose 를 다른 이름으로 바꾼다
const steps = structuredClone(data.verificationScene.steps);
const chooseAt = steps.map((s) => s.kind).lastIndexOf("choose");
const solvedIndex = (steps[chooseAt] as { index: number }).index;
(steps[chooseAt] as { index: number }).index = solvedIndex === 0 ? 1 : 0;
const wrongRun = runSceneTest(ctx.project, { ...data.verificationScene, steps: [...steps.slice(0, -1), W] });
// ④ 거부: 같은 스위치·onSolved 에 triggerEnding
const p2 = stage();
const sameSwitch = runTool({ project: p2, assistantRun: false }, "author_mystery_case", spec(p2.startMapId, { mode: "chapter", solvedSwitchId: "sw_x", wrongSwitchId: "sw_x" }), { dryRun: false });
const endingInside = runTool({ project: p2, assistantRun: false }, "author_mystery_case", spec(p2.startMapId, { mode: "chapter", onSolved: [{ kind: "triggerEnding", endingId: "x" }] }), { dryRun: false });
// ⑤ 기본(ending) 모드는 그대로 엔딩
const ctx3 = { project: stage(), assistantRun: false };
const endingMode = runTool(ctx3, "author_mystery_case", spec(ctx3.project.startMapId), { dryRun: false });
const endingScene = (endingMode.data as { verificationScene: { mapId: string; start: { x: number; y: number }; steps: SceneStep[] } }).verificationScene;
const endingRun = runSceneTest(ctx3.project, endingScene);

// ⑥ SQLite 저장 → 다시 열기 → 다시 연 프로젝트로 ①
const dir = mkdtempSync(join(tmpdir(), "oprn-verdict-proof-"));
const first = await initLocalProjectStore({ projectDir: dir });
const saved = await first.saveProject(ctx.project);
const second = await initLocalProjectStore({ projectDir: dir });
const reloaded = second.loadSnapshot()!.project;
const reloadedRun = runSceneTest(reloaded, data.verificationScene);
const findings = checkMystery(reloaded, "조선 추리 사건");
rmSync(dir, { recursive: true, force: true });

const out = {
  solvedSwitchId, wrongSwitchId, endingsInData: data.endings ?? null,
  switchesDeclared: ctx.project.switches.filter((s) => s.id === solvedSwitchId || s.id === wrongSwitchId).map((s) => `${s.id}:${s.name}`),
  endingsDefined: (ctx.project.database as { endings?: unknown[] }).endings?.length ?? 0,
  solved: { ok: solvedRun.ok, failure: solvedRun.failureReason ?? null, solvedOn: solvedRun.finalState.switchesOn.includes(solvedSwitchId), wrongOn: solvedRun.finalState.switchesOn.includes(wrongSwitchId), endings: solvedRun.finalState.endingsReached, onSolvedSaid: JSON.stringify(solvedRun.finalState.messages).includes("밤의 일") },
  afterVerdict: { ok: again.ok, failure: again.failureReason ?? null, saidAfter: JSON.stringify(again.finalState.messages).includes("이미 매듭"), endings: again.finalState.endingsReached },
  wrong: { ok: wrongRun.ok, failure: wrongRun.failureReason ?? null, wrongOn: wrongRun.finalState.switchesOn.includes(wrongSwitchId), solvedOn: wrongRun.finalState.switchesOn.includes(solvedSwitchId), endings: wrongRun.finalState.endingsReached },
  rejected: { sameSwitch: !sameSwitch.ok && /mystery-verdict/u.test(JSON.stringify(sameSwitch.issues ?? sameSwitch.summary)), endingInside: !endingInside.ok && /mystery-verdict/u.test(JSON.stringify(endingInside.issues ?? endingInside.summary)) },
  endingModeUnchanged: { authored: endingMode.ok, summary: endingMode.ok ? "" : endingMode.summary.slice(0, 300), ok: endingRun.ok, failure: endingRun.failureReason ?? null, step: endingRun.failedStepIndex ?? null, endings: endingRun.finalState.endingsReached },
  storage: { kind: saved.kind, projectId: second.projectId, reloadedSceneOk: reloadedRun.ok && reloadedRun.finalState.switchesOn.includes(solvedSwitchId) },
  gameCheckFindings: findings.map((f) => f.code),
};
const allOk = out.solved.ok && out.solved.solvedOn && !out.solved.wrongOn && out.solved.endings.length === 0 && out.solved.onSolvedSaid
  && out.afterVerdict.ok && out.afterVerdict.saidAfter && out.wrong.wrongOn && !out.wrong.solvedOn && out.wrong.endings.length === 0
  && out.rejected.sameSwitch && out.rejected.endingInside && out.endingModeUnchanged.ok && out.endingModeUnchanged.endings.length === 1
  && out.storage.kind === "saved" && out.storage.reloadedSceneOk && !out.gameCheckFindings.includes("mystery-ending-unconditioned") && out.switchesDeclared.length === 2;
const result = { allOk, ...out };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
process.exit(allOk ? 0 : 1);
