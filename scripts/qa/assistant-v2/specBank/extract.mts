// 명세 은행 — 뽑기(모델 없음): 저장된 조수 판(session/turns/NNN.json)에서 모델이 보낸 도구 호출을 차례대로 뽑아 게임 하나당 명세 파일 하나로 줄인다.
//   bun scripts/qa/assistant-v2/specBank/extract.mts <판 폴더> [--id <이름>] [--out <폴더>] [--head <커밋>]
// 남기는 것: 사용자 글 · 실행기에 간 글(task) · 호출 이름·인자·그때의 성공 여부·결과 요약 160자 · 모델이 멈춘 자리 · 장소 소금 · 그때 id 의 이름표 · 저장본 요약.
// 버리는 것: 모델의 글·결과 본문·그림·지시문·토큰 수·상태 줄(재생이 다시 만든다), 끝 기록이 없는 호출(중단된 것 — 수를 dropped 에 적는다).
// 읽기 호출은 버리지 않고 read 표시만 한다 — 읽기가 뒤 쓰기의 관문을 여는 도구가 있다(참고문서·윤문 스킬·load_tools). 문서: openwiki/assistant-v2.md 「명세 은행」.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { readProjectSqlite } from "../../../content/read-project-sqlite.mts";
import { composePiTask } from "../../../../src/ai/piAgent/executionRoute.ts";
import { priorRequestsNote } from "../../../../src/ai/v2/prompt/priorRequests.ts";
import { eventIdsIn, eventTokens, isRead, itemKey, mapIdsIn, referenceOf, type Spec, type SpecCall, type SpecTurn } from "./spec.mts";

type Turn = {
  step: string; kind: string; input: string; outcome?: string;
  toolArgs?: { name: string; args: unknown }[];
  toolCalls?: { name: string; ok?: boolean; summary?: string; modelText?: string }[];
  timeline?: [number, string, string][];
  v2Final?: { complete: boolean; summary: string }[];
  maps?: { id: string; name: string }[];
  requests?: { model?: string; provider?: string; assistantVersion?: string }[];
};
type AnyProject = { maps: Record<string, { id: string; name?: string; events?: { id: string; name?: string; x: number; y: number }[] }>; assistantTodo?: { items?: { id: string; content: string; source?: string }[]; memory?: { places?: { places?: { spec?: { name?: string; salt?: number } }[] } } } };

const POLISH_TOOLS = new Set(["read_assistant_skill", "read_story_script", "rewrite_dialogue", "lint_dialogue", "list_dialogue", "get_story_outline"]);
/** 은행 파일에 들어가면 안 되는 것 — 열쇠·토큰 꼴, 이 기계의 절대 경로. */
const SECRET = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|\/home\/[a-z0-9_-]+\/|"(?:api[_-]?key|token|password|secret|authorization)"\s*:)/iu;

const readJson = <T,>(file: string): T => JSON.parse(file.endsWith(".gz") ? zlib.gunzipSync(fs.readFileSync(file)).toString("utf8") : fs.readFileSync(file, "utf8")) as T;

export function extractSpec(runDir: string, options: { id?: string; head?: string } = {}): { spec: Spec; notes: string[] } {
  const run = path.resolve(runDir);
  const notes: string[] = [];
  const turnsDir = path.join(run, "session", "turns");
  const turnFiles = fs.existsSync(turnsDir) ? fs.readdirSync(turnsDir).filter((f) => /^\d+\.json$/u.test(f)).sort() : [];
  if (!turnFiles.length) throw new Error(`${run}: session/turns 에 턴 기록이 없다`);
  const turns = turnFiles.map((f) => readJson<Turn>(path.join(turnsDir, f)));

  // 그때 코드의 커밋·모델 — 게임 판은 RUN.txt, 맵 깔기 판은 묶음 summary.json.
  const runTxt = fs.existsSync(path.join(run, "RUN.txt")) ? fs.readFileSync(path.join(run, "RUN.txt"), "utf8") : "";
  const summaryFile = path.join(run, "..", "..", "summary.json");
  const summary = fs.existsSync(summaryFile) ? readJson<{ editorHead?: string; git?: { sha?: string; mainBase?: string }; startedAt?: string }>(summaryFile) : undefined;
  const head = options.head ?? /head=([0-9a-f]+)/u.exec(runTxt)?.[1] ?? summary?.editorHead ?? "";
  const version = /ver=(v\d)/u.exec(runTxt)?.[1] ?? turns[0]?.requests?.[0]?.assistantVersion ?? "";
  if (version && version !== "v2") throw new Error(`${run}: 조수 ${version} 판이다 — 은행은 v2 판만 담는다`);
  const fixture = fs.existsSync(path.join(run, "fixture.json")) ? readJson<{ projectId?: string }>(path.join(run, "fixture.json")) : undefined;
  const state = fs.existsSync(path.join(run, "session", "state.json")) ? readJson<{ projectId?: string }>(path.join(run, "session", "state.json")) : undefined;
  const projectId = fixture?.projectId ?? state?.projectId ?? "";

  // 저장본들 — 턴 앞 스냅숏(있으면)과 마지막 저장본. 요약·소금·id 이름표의 재료다.
  const projects: { label: string; project: AnyProject }[] = [];
  const snapDir = path.join(run, "session", "snapshots");
  for (const f of fs.existsSync(snapDir) ? fs.readdirSync(snapDir).filter((x) => /^\d+-before\.json$/u.test(x)).sort() : []) {
    const raw = readJson<AnyProject & { project?: AnyProject }>(path.join(snapDir, f));
    projects.push({ label: `before-${f.slice(0, 3)}`, project: raw.project ?? raw });
  }
  let finalProject: AnyProject | undefined;
  try {
    if (fs.existsSync(path.join(run, "project", "project.sqlite"))) finalProject = readProjectSqlite(path.join(run, "project")) as unknown as AnyProject;
    else if (fs.existsSync(path.join(run, "after.json.gz"))) { const raw = readJson<AnyProject & { project?: AnyProject }>(path.join(run, "after.json.gz")); finalProject = raw.project ?? raw; }
  } catch (error) { notes.push(`마지막 저장본을 못 읽음: ${(error as Error).message.slice(0, 160)}`); }
  if (finalProject) projects.push({ label: "final", project: finalProject });
  const title = (projects[0]?.project as { meta?: { title?: string } } | undefined)?.meta?.title ?? `fable-${path.basename(run)}`;

  const dropped: Record<string, number> = {};
  const drop = (why: string) => { dropped[why] = (dropped[why] ?? 0) + 1; };
  const specTurns: SpecTurn[] = [];
  /** 턴·호출마다 그때 모델이 받은 결과 글(은행에는 넣지 않는다 — 도중에 생겼다 사라진 id 를 찾을 때만 쓴다). */
  const resultTexts: string[][] = [];
  const priorUser: { kind: "user"; text: string }[] = [];
  for (const turn of turns) {
    if (turn.kind !== "txt") { if (turn.kind !== "stop") drop(`${turn.kind} 턴(글이 아닌 입력)`); continue; }
    const input = turn.input.trim();
    const task = composePiTask(input, priorRequestsNote(priorUser as never, input));
    priorUser.push({ kind: "user", text: input });
    // 인자(시작 차례)와 결과(끝 차례)는 이름별 k번째끼리 맞춘다 — 병렬 호출은 끝 차례가 시작 차례와 다르다.
    const ends = new Map<string, { ok?: boolean; summary?: string }[]>();
    for (const c of turn.toolCalls ?? []) { const q = ends.get(c.name) ?? []; q.push(c); ends.set(c.name, q); }
    // 모델이 멈춘 자리: 시간표가 있으면 재주입(v2.loop.continue)이 낀 자리, 없으면 할 일이 «열림 없음»으로 끝난 todo 뒤(모델은 거기서 보고하고 멈춘다).
    const stopAfter = new Set<number>();
    if (turn.timeline?.length) {
      let started = 0;
      for (const [, type, name] of turn.timeline) { if (type === "tool_start") started += 1; else if (type === "execution_status" && name === "v2.loop.continue" && started > 0) stopAfter.add(started - 1); }
    }
    const calls: SpecCall[] = [];
    const texts: string[] = [];
    resultTexts.push(texts);
    for (const [i, a] of (turn.toolArgs ?? []).entries()) {
      const end = ends.get(a.name)?.shift() as { ok?: boolean; summary?: string; modelText?: string } | undefined;
      if (!end) { drop("끝 기록이 없는 호출(중단)"); continue; }
      texts.push(`${end.modelText ?? ""} ${end.summary ?? ""}`);
      const summary = String(end.summary ?? "").replace(/\s+/gu, " ").slice(0, 160);
      const call: SpecCall = { n: a.name, a: a.args ?? {}, ok: end.ok !== false, ...(summary ? { s: summary } : {}), ...(isRead(a.name) ? { read: 1 as const } : {}) };
      if (stopAfter.has(i) || (!turn.timeline?.length && a.name === "todo" && /No open items\.?\s*$/u.test(summary))) call.stop = 1;
      calls.push(call);
    }
    // 완성 뒤 대사 윤문 차례 — 턴 끝의 윤문 도구만 이어진 꼬리(dialogue-polish 스킬 읽기로 시작).
    let polishFrom: number | undefined;
    for (let i = calls.length - 1; i >= 0 && POLISH_TOOLS.has(calls[i]!.n); i -= 1) if (calls[i]!.n === "read_assistant_skill" && (calls[i]!.a as { id?: string }).id === "dialogue-polish") polishFrom = i;
    const verdict = turn.v2Final?.at(-1);
    specTurns.push({ input, task, calls, ...(polishFrom !== undefined ? { polishFrom } : {}), ...(verdict ? { verdict: { complete: verdict.complete, summary: verdict.summary.slice(0, 200) } } : {}) });
  }

  // 턴이 끝났을 때의 할 일 목록에서 함수·판정자가 덧붙인 항목(모델이 적지 않은 것)의 글 — 그 턴 뒤 저장본(다음 턴 앞 스냅숏, 마지막 턴은 마지막 저장본).
  for (const [i, turn] of specTurns.entries()) {
    const after = projects.find((p) => p.label === `before-${String(i + 2).padStart(3, "0")}`) ?? (i === specTurns.length - 1 ? projects.find((p) => p.label === "final") : undefined);
    const added = (after?.project.assistantTodo?.items ?? []).filter((item) => item.source && item.source !== "model");
    if (added.length) turn.items = Object.fromEntries(added.map((item) => [item.id, itemKey(item.content)]));
  }

  // 장소 소금 — 저장본의 장소 설계 기억(assistantTodo.memory.places). 뒤 저장본이 앞을 덮는다(다시 지은 장소는 마지막 소금).
  const salts: Record<string, number> = {};
  for (const { project } of projects) for (const place of project.assistantTodo?.memory?.places?.places ?? []) if (place.spec?.name && typeof place.spec.salt === "number") salts[place.spec.name] = place.spec.salt;

  // 그때 id 의 이름표 — 맵 id → 이름들, 호출 인자에 나온 이벤트 id → 어느 맵의 무슨 이벤트.
  const maps: Record<string, string[]> = {};
  const addMap = (id: string, name: string | undefined) => { if (!name) return; const list = (maps[id] ??= []); if (!list.includes(name)) list.push(name); };
  for (const turn of turns) for (const m of turn.maps ?? []) addMap(m.id, m.name);
  for (const { project } of projects) for (const m of Object.values(project.maps)) addMap(m.id, m.name);
  const argText = JSON.stringify(specTurns.map((t) => t.calls.map((c) => c.a)));
  for (const id of mapIdsIn(argText)) if (!maps[id]) {
    // 결과 글의 «이름» … mapId=<id> 꼴에서 찾는다(중간에 생겼다 사라진 맵).
    for (const turn of turns) for (const c of turn.toolCalls ?? []) { const m = new RegExp(`«([^»]+)»[^«]{0,80}mapId=${id}`, "u").exec(`${c.summary ?? ""} ${c.modelText ?? ""}`); if (m) addMap(id, m[1]); }
    if (!maps[id]) { maps[id] = []; drop("이름을 모르는 맵 id(인자에만 나옴)"); }
  }
  const events: Spec["events"] = {};
  for (const id of eventIdsIn(argText)) {
    for (const { project } of [...projects].reverse()) {
      const hit = Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => ({ m, e }))).find(({ e }) => e.id === id);
      if (hit) { events[id] = { map: hit.m.id, name: hit.e.name ?? "", x: hit.e.x, y: hit.e.y }; break; }
    }
    if (events[id]) continue;
    // 저장본에 없다 — 그 판 도중에 생겼다 지워졌다. 처음 나온 결과 글에서의 차례로 적는다.
    search: for (const [t, texts] of resultTexts.entries()) for (const [i, text] of texts.entries()) {
      const k = eventTokens(text).indexOf(id);
      if (k >= 0) { events[id] = { at: [t, i, k] }; break search; }
    }
    if (!events[id]) drop("어디서 왔는지 모르는 이벤트 id(인자에만 나옴)");
  }

  const afterTurn: Spec["reference"]["afterTurn"] = {};
  for (const { label, project } of projects) { const m = /^before-(\d+)$/u.exec(label); if (m && Number(m[1]) > 1) afterTurn[String(Number(m[1]) - 1)] = referenceOf(project); }
  const first = turns.find((t) => t.kind === "txt");
  const spec: Spec = {
    version: 1,
    // 맵 깔기 판은 묶음 이름(커밋 꼬리를 뗀 것) + 과제 이름 — 묶음이 달라도 과제 이름이 같다.
    id: options.id ?? (summary ? `${path.basename(path.resolve(run, "../..")).replace(/-[0-9a-f]{8,}$/u, "")}-${path.basename(run)}` : path.basename(run)),
    kind: summary ? "place" : "game",
    source: { run: path.relative(path.join(run, summary ? "../../.." : ".."), run), head, model: first?.requests?.[0]?.model ?? "", provider: first?.requests?.[0]?.provider ?? "", ...(/started=(\S+)/u.exec(runTxt)?.[1] ? { startedAt: /started=(\S+)/u.exec(runTxt)![1]! } : summary?.startedAt ? { startedAt: summary.startedAt } : {}), ...(summary?.git?.mainBase ? { note: `main ${summary.git.mainBase} 기준` } : {}) },
    request: first?.input.trim() ?? "",
    projectKey: projectId ? JSON.stringify(["project", projectId]) : "",
    title,
    turns: specTurns,
    salts, maps, events,
    reference: { afterTurn, ...(finalProject ? { final: referenceOf(finalProject) } : {}) },
    dropped,
  };
  const leak = SECRET.exec(JSON.stringify(spec));
  if (leak) throw new Error(`${run}: 명세에 열쇠·절대 경로로 보이는 글이 있다(«${leak[0].slice(0, 24)}…») — 은행에 넣지 않는다. 그 인자를 확인할 것`);
  return { spec, notes };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
  const out = flag("--out") ?? "harness-data/assistant-capability/spec-bank";
  const dirs = argv.filter((a, i) => !a.startsWith("--") && !["--out", "--id", "--head"].includes(argv[i - 1] ?? ""));
  fs.mkdirSync(out, { recursive: true });
  for (const dir of dirs) {
    try {
      const { spec, notes } = extractSpec(dir, { ...(flag("--id") && dirs.length === 1 ? { id: flag("--id")! } : {}), ...(flag("--head") ? { head: flag("--head")! } : {}) });
      const file = path.join(out, `${spec.id}.json`);
      fs.writeFileSync(file, `${JSON.stringify(spec)}\n`);
      const calls = spec.turns.reduce((n, t) => n + t.calls.length, 0);
      console.log(`${file}: 턴 ${spec.turns.length} · 호출 ${calls}(읽기 ${spec.turns.reduce((n, t) => n + t.calls.filter((c) => c.read).length, 0)}) · 소금 ${Object.keys(spec.salts).length} · 맵 id ${Object.keys(spec.maps).length} · 이벤트 id ${Object.keys(spec.events).length} · ${Math.round(fs.statSync(file).size / 1024)}KB${Object.keys(spec.dropped).length ? ` · 버림 ${JSON.stringify(spec.dropped)}` : ""}${notes.length ? ` · ${notes.join(" / ")}` : ""}`);
    } catch (error) { console.log(`${dir}: 건너뜀 — ${(error as Error).message}`); }
  }
}
