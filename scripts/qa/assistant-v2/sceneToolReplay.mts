// 씬 벤치 판 재구성(모델 없음): 저장본이 남지 않은 씬 판을, 시작 저장본(bases/<장르>/project) 위에 그 판 세션이 기록한
// 도구 호출(session/turns/NNN.json 의 toolArgs, 부른 순서)을 지금 코드로 다시 불러 만든다. 끝맺음은 돌지 않는다 —
// 나온 프로젝트 JSON 을 finishReplay --snapshot 에 넣어 끝맺음 전/후를 본다.
//   bun scripts/qa/assistant-v2/sceneToolReplay.mts <씬 판 디렉터리> --base <bases/fantasy/project> --out <파일.json>
// 새로 생기는 맵·이벤트 id(무작위 uuid)는 기록 속 id(뒤 호출 인자·요약에 나온 것)로 바꿔 뒤 호출이 같은 대상을 가리키게 한다.
// 마을 make_place 는 기록 요약의 「seed N」·크기가 나오는 salt 를 찾아(무작위 salt 를 고정해 지어 본다) 같은 마을을 짓는다 — 판이 돈 커밋의 코드로 돌려야 기록과 같다.
// 왜(2026-10-30): 씬 벤치 sc-1030a 는 판 저장본(project.sqlite)을 지워 finishReplay 를 바로 돌릴 수 없었다.
import fs from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { createBuildRun } from "../../../src/ai/v2/buildRun.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const dir = argv[0]!;
const base = opt("--base")!;
const outFile = opt("--out")!;
const turnsDir = path.join(dir, "session", "turns");
const turns = fs.readdirSync(turnsDir).filter((f) => /^\d+\.json$/u.test(f)).sort();
const project0 = readProjectSqlite(base) as Project;
const ctx = { project: structuredClone(project0), currentMapId: project0.startMapId, assistantRun: true };
const log: string[] = [];
const ID = /\b(?:map|ev)_[a-z_]*?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu;
const prefixOf = (id: string) => id.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u, "");
const allIds = (p: Project) => new Set(JSON.stringify(p).match(ID) ?? []);

/** 기록 요약 속 마을 씨앗·크기(「이름: … (42×42, seed 69487)」). 같은 make_place 를 여러 번 불렀으면 순서대로. */
function recordedSeed(turn: { toolArgs?: unknown[]; toolCalls?: { name: string; summary?: string }[] }, call: object): { name: string; seed: number; size: string } | undefined {
  const calls = (turn.toolCalls ?? []).filter((c) => c.name === "make_place");
  const nth = (turn.toolArgs ?? []).filter((c) => (c as { name?: string }).name === "make_place").indexOf(call);
  const m = /^([^:]+):.*\((\d+×\d+), seed (\d+)\)/u.exec(String(calls[nth]?.summary ?? ""));
  return m ? { name: m[1]!.trim(), seed: Number(m[3]), size: m[2]! } : undefined;
}

for (const t of turns) {
  const turn = JSON.parse(fs.readFileSync(path.join(turnsDir, t), "utf8")) as { input?: string; toolArgs?: { name: string; args: Record<string, unknown> }[]; toolCalls?: { name: string; summary?: string }[] };
  const task = String(turn.input ?? "");
  // 기록 속 id(처음 나온 순서) — 시작 저장본에 없는 것만.
  const baseIds = allIds(ctx.project);
  const recorded: string[] = [];
  for (const m of JSON.stringify([turn.toolArgs, turn.toolCalls, (turn as { answer?: string }).answer]).match(ID) ?? []) if (!baseIds.has(m) && !recorded.includes(m)) recorded.push(m);
  const assigned = new Set<string>();
  const env = {
    ctx, request: { task, provider: "replay", mapIds: [], project: ctx.project } as never,
    emit: () => {}, record: () => {},
    sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: { composition: 7, view: 8, doors: 8 }, score: 7, majors: [] }),
    render: async () => "data:image/png;base64,",
    checkpoint: async () => {},
  } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = createV2Tools(env, session);
  const run = createBuildRun(ctx as never);
  let i = 0;
  for (const call of turn.toolArgs ?? []) {
    const before = allIds(ctx.project);
    const tool = tools.find((x) => x.name === call.name);
    let ok = "?";
    let summary = "";
    try {
      if (tool && call.name === "make_place" && recordedSeed(turn, call)) {
        // 마을 씨앗은 make_place 의 무작위 salt 에서 나온다 — 기록 속 씨앗·크기가 나올 salt 를 찾아 같은 마을을 짓는다.
        const want = recordedSeed(turn, call)!;
        const snap = ctx.project;
        const nh = [...want.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
        const cands: number[] = [];
        for (let k = 0; k < 10; k++) for (let j = 0; j < 5; j++) { const s = ((((want.seed - j * 7919 - nh) % 100000) + 200000) % 100000) + k * 100000; if (s < 1_000_000) cands.push(s); }
        for (let k = 0; k < 10; k++) cands.push(want.seed + k * 100000);
        const realRandom = Math.random;
        let hit = false;
        for (const salt of [...new Set(cands)]) {
          ctx.project = snap;
          let first = true;
          Math.random = () => { if (first) { first = false; return (salt + 0.5) / 1_000_000; } return realRandom(); };
          let res;
          try { res = await tool.execute(`r${++i}`, call.args); } finally { Math.random = realRandom; }
          const text = (res.content.find((c) => c.type === "text") as { text?: string } | undefined)?.text ?? "";
          let sum = text; try { sum = String((JSON.parse(text) as { summary?: string }).summary ?? text); } catch { /* 글 */ }
          if (sum.includes(`seed ${want.seed})`) && sum.includes(want.size)) { ok = "true"; summary = `salt ${salt} — ${sum.slice(0, 180)}`; hit = true; break; }
        }
        if (!hit) { ok = "salt?"; summary = `기록 씨앗 ${want.seed}·${want.size} 를 내는 salt 를 못 찾음 — 마지막 시도 그대로`; }
      } else if (tool) {
        const res = await tool.execute(`r${++i}`, call.args);
        const text = (res.content.find((c) => c.type === "text") as { text?: string } | undefined)?.text ?? "";
        try { const j = JSON.parse(text) as { ok?: boolean; summary?: string; error?: string }; ok = String(j.ok ?? !j.error); summary = String(j.summary ?? j.error ?? text).slice(0, 200); } catch { summary = text.slice(0, 200); }
      } else {
        const res = run.call(call.name, call.args);
        ok = String(res.ok); summary = String(res.summary ?? "").slice(0, 200);
      }
    } catch (e) { ok = "throw"; summary = (e as Error).message.slice(0, 200); }
    // 새로 생긴 무작위 id → 기록 속 같은 머리말의 아직 안 쓴 id.
    const fresh = [...allIds(ctx.project)].filter((id) => !before.has(id));
    let json = JSON.stringify(ctx.project);
    let renamed = 0;
    for (const id of fresh) {
      const target = recorded.find((r) => !assigned.has(r) && prefixOf(r) === prefixOf(id) && !before.has(r));
      if (!target) continue;
      assigned.add(target);
      json = json.split(id).join(target);
      renamed += 1;
    }
    if (renamed) ctx.project = JSON.parse(json) as Project;
    log.push(`${t} ${call.name} ok=${ok}${renamed ? ` id→기록 ${renamed}` : ""} — ${summary}`);
  }
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(ctx.project));
console.log(log.join("\n"));
