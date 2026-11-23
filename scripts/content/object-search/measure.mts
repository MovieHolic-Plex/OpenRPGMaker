// 기물 찾기 측정 — 요청 40개(requests.json)로 조수의 기물 검색(list_spatial_designs kind:object)을 잰다.
//   결정적: 요청 문장 그대로(raw)와 장소 낱말(place)로 실제 도구를 불러 P@10·recall@40.
//   LLM(OS_MODE=llm): 모델이 도구 설명을 보고 검색 호출 5개를 정하고, 결과에서 10개를 고른다 → 엄격 정밀도·recall.
// 정답: 기물 이름이 요청의 개념 정규식에 맞고 허용 칩셋에 있으면 맞음. recall 분모 = 카탈로그에 실재하는 개념.
// 실행: OS_OUT=/tmp/x.json npx vite-node --script scripts/content/object-search/measure.mts
//       OS_MODE=llm OS_KEY_FILE=~/.config/oc-fastlane/key ... (키는 파일에서만 읽고 출력하지 않는다)
//       OS_MODE=llm OS_RELAY_DIR=<dir> OS_MODEL_LABEL=sonnet-5.5 ... (바깥 실행기가 <dir>/*.req.json 에 답한다)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { SPATIAL_TOOLS } from "@/editor/tools/spatialTools";
import { sharedObjects } from "@/editor/tools/sharedDesignCatalog";
import data from "./requests.json" with { type: "json" };

type Req = { id: string; request: string; genre: string; place: string; tilesets: string[]; concepts: Record<string, string> };
type Row = { id: string; name: string; tilesetId: string; width?: number; height?: number; tags?: string[]; family?: string };

// OS_REQUESTS: 다른 요청 묶음(예: 사전을 만든 사람이 보지 않고 따로 쓴 숨김 요청)으로 같은 측정을 돈다.
const requests = (process.env.OS_REQUESTS ? JSON.parse(readFileSync(process.env.OS_REQUESTS, "utf8")) as { requests: Req[] } : data as { requests: Req[] }).requests;
const project = createBlankProject();
const tool = SPATIAL_TOOLS.find(entry => entry.name === "list_spatial_designs")!;
const properties = Object.keys((tool.parameters as { properties?: Record<string, unknown> }).properties ?? {});
const allObjects = sharedObjects(project) as Row[];

type Kit = { place: string; suggested?: { id: string; name: string }[]; slots: { role: string; label: string; pick: string; items: { word: string; rows: Row[] }[] }[] };
function search(args: Record<string, unknown>): { rows: Row[]; total: number; summary: string; sceneKit?: Kit } {
  const result = tool.run(project, { kind: "object", limit: 40, ...args }) as { summary: string; data: { shared: { rows: Row[]; total: number; sceneKit?: Kit } } };
  return { rows: result.data.shared.rows, total: result.data.shared.total, summary: result.summary, sceneKit: result.data.shared.sceneKit };
}

function conceptOf(req: Req, row: Pick<Row, "name" | "tilesetId">): string | undefined {
  if (!req.tilesets.includes(row.tilesetId)) return undefined;
  return Object.entries(req.concepts).find(([, pattern]) => new RegExp(pattern, "u").test(row.name))?.[0];
}

const existing = new Map(requests.map(req => [req.id, new Set(allObjects.flatMap(row => conceptOf(req, row) ?? []))]));

function score(req: Req, picked: readonly Row[], k: number) {
  const exist = existing.get(req.id)!;
  const top = picked.slice(0, k);
  const hits = new Set(top.flatMap(row => conceptOf(req, row) ?? []));
  return {
    precision: top.length ? top.filter(row => conceptOf(req, row)).length / k : 0,
    recall: exist.size ? [...hits].filter(c => exist.has(c)).length / exist.size : 0,
    recallMatched: exist.size ? matchedConcepts(req, top, exist) / exist.size : 0,
    hit: [...hits], exist: [...exist],
  };
}

/**
 * recall 은 한 기물을 처음 맞는 개념 하나로만 센다(「버스 정류장 표지판」은 표지가 아니라 쉘터로 센다). recallMatched 는 고른 기물과
 * 개념을 일대일 최대 짝짓기로 센다 — 한 기물은 개념 하나에만 쓰이지만, 여러 개념에 맞으면 비어 있는 쪽으로 간다. 두 숫자를 함께 낸다.
 */
function matchedConcepts(req: Req, picked: readonly Row[], exist: ReadonlySet<string>): number {
  const options = picked.map(row => req.tilesets.includes(row.tilesetId)
    ? Object.entries(req.concepts).filter(([concept, pattern]) => exist.has(concept) && new RegExp(pattern, "u").test(row.name)).map(([concept]) => concept) : []);
  const owner = new Map<string, number>();
  const assign = (index: number, seen: Set<string>): boolean => {
    for (const concept of options[index]!) {
      if (seen.has(concept)) continue;
      seen.add(concept);
      const held = owner.get(concept);
      if (held === undefined || assign(held, seen)) { owner.set(concept, index); return true; }
    }
    return false;
  };
  options.forEach((_, index) => assign(index, new Set()));
  return owner.size;
}

const mean = (values: number[]) => Math.round((values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)) * 1000) / 1000;

function deterministic() {
  const out: Record<string, unknown> = {};
  const agg: Record<string, { p10: number[]; r40: number[] }> = { raw: { p10: [], r40: [] }, place: { p10: [], r40: [] } };
  for (const req of requests) {
    const row: Record<string, unknown> = {};
    for (const [variant, query] of [["raw", req.request], ["place", req.place]] as const) {
      const { rows, total, summary } = search({ query });
      const p10 = score(req, rows, 10).precision;
      const r40 = score(req, rows, 40);
      agg[variant]!.p10.push(p10); agg[variant]!.r40.push(r40.recall);
      row[variant] = { query, total, summary, p10, recall40: r40.recall, hit: r40.hit, exist: r40.exist, top10: rows.slice(0, 10).map(r => r.name) };
    }
    out[req.id] = row;
  }
  return { perRequest: out, summary: Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, { p10: mean(v.p10), recall40: mean(v.r40) }])) };
}

const KEY = process.env.OS_KEY_FILE ? readFileSync(process.env.OS_KEY_FILE.replace(/^~/, process.env.HOME ?? ""), "utf8").trim() : "";
// OS_RELAY_DIR: 요청을 <dir>/<id>.req.json 으로 쓰고 <id>.ans 를 기다린다 — 바깥 실행기가 다른 모델 경로(예: Sonnet 5.5 서브에이전트)로 답한다.
const RELAY = process.env.OS_RELAY_DIR;
let relaySeq = 0;
async function relayChat(system: string, user: string): Promise<string> {
  const id = `${process.pid}-${(relaySeq += 1)}`;
  writeFileSync(`${RELAY}/${id}.req.json`, JSON.stringify({ system, user }));
  for (;;) {
    if (existsSync(`${RELAY}/${id}.ans`)) return readFileSync(`${RELAY}/${id}.ans`, "utf8");
    await new Promise(r => setTimeout(r, 1000));
  }
}

async function chat(system: string, user: string): Promise<string> {
  if (RELAY) return relayChat(system, user);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch("https://oc.hyeon.space/v1/chat/completions", {
        method: "POST", signal: AbortSignal.timeout(120_000),
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-v4.1-flash-free-1m", temperature: 0, max_tokens: 2000, response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (response.status === 429 || response.status >= 500) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { choices: { message: { content: string } }[] };
      return body.choices[0]!.message.content;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error("retries exhausted");
}

const parseJson = (text: string) => {
  // 첫 완결 JSON 객체만 읽는다 — 모델이 JSON 뒤에 설명을 덧붙여도 실패하지 않게.
  const start = text.indexOf("{");
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i >= 0 && i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === "\"") inString = false; continue; }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}" && (depth -= 1) === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error(`no JSON object in: ${text.slice(0, 120)}`);
};

async function llmOne(req: Req) {
  const stage1System = "You plan prop searches for an RPG map-building assistant. You can call the tool below up to 5 times. "
    + "Return JSON {\"calls\":[{...tool arguments without kind...}]} with exactly 5 calls. Only use the listed parameters.\n\n"
    + `Tool list_spatial_designs (kind is fixed to object): ${tool.description}\nParameters: ${properties.filter(p => p !== "kind").join(", ")}`;
  const stage1 = parseJson(await chat(stage1System, `Request: ${req.request}`)) as { calls?: Record<string, unknown>[] };
  const calls = (stage1.calls ?? []).slice(0, 5).map(call => Object.fromEntries(Object.entries(call).filter(([key]) => properties.includes(key) && key !== "kind" && key !== "limit" && key !== "offset")));
  const shown = new Map<string, Row>();
  const summaries: string[] = [];
  const errors: string[] = [];
  // 도구가 돌려준 장면 키트도 그대로 보여 준다(역할 칸·낱말마다 행). 같은 키트는 한 번만.
  const kitLines: string[] = [];
  const kitsShown = new Set<string>();
  for (const call of calls) {
    try {
      const { rows, summary, sceneKit } = search(call);
      summaries.push(summary);
      if (sceneKit && !kitsShown.has(sceneKit.place)) {
        kitsShown.add(sceneKit.place);
        kitLines.push(`Scene kit 「${sceneKit.place}」:`);
        if (sceneKit.suggested?.length) kitLines.push(`  suggested set (one per word, across roles): ${sceneKit.suggested.map(row => row.id).join(", ")}`);
        for (const slot of sceneKit.slots) {
          kitLines.push(`  [${slot.label} · pick ${slot.pick}]`);
          for (const item of slot.items) {
            kitLines.push(`    ${item.word}: ${item.rows.map(row => JSON.stringify({ id: row.id, name: row.name, tilesetId: row.tilesetId, size: `${row.width}x${row.height}` })).join(" ")}`);
            for (const row of item.rows) if (!shown.has(row.id)) shown.set(row.id, { ...row, tags: row.tags ?? [] });
          }
        }
      }
      for (const row of rows) if (!shown.has(row.id)) shown.set(row.id, row);
    } catch (error) { errors.push(`${JSON.stringify(call)}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  const listing = [...shown.values()].map(row => JSON.stringify({ id: row.id, name: row.name, tilesetId: row.tilesetId, size: `${row.width}x${row.height}`,
    ...(row.family ? { family: row.family } : {}), tags: (row.tags ?? []).slice(0, 8) })).join("\n");
  const stage2 = parseJson(await chat("You furnish an RPG map. From the search results, pick the 10 objects that best fit the request "
    + "(right place, right art style, things a player would expect there). Return JSON {\"picks\":[10 ids]} using ids exactly as listed.",
    `Request: ${req.request}\nSearch summaries:\n${summaries.join("\n")}\n${kitLines.length ? `${kitLines.join("\n")}\n` : ""}Results:\n${listing}`)) as { picks?: string[] };
  const picks = (stage2.picks ?? []).slice(0, 10).map(id => shown.get(id)).filter((row): row is Row => Boolean(row));
  const scored = score(req, picks, 10);
  return { id: req.id, calls, errors, rowsShown: shown.size, picks: picks.map(row => row.name), invalid: (stage2.picks ?? []).length - picks.length, ...scored };
}

async function llm() {
  const results: Awaited<ReturnType<typeof llmOne>>[] = [];
  const failed: { id: string; error: string }[] = [];
  const queue = [...requests];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let req = queue.shift(); req; req = queue.shift()) {
      try { results.push(await llmOne(req)); }
      catch (error) { failed.push({ id: req.id, error: error instanceof Error ? error.message : String(error) }); }
    }
  }));
  results.sort((a, b) => a.id.localeCompare(b.id));
  return { perRequest: results, failed, summary: { precision: mean(results.map(r => r.precision)), recall: mean(results.map(r => r.recall)), recallMatched: mean(results.map(r => r.recallMatched)), n: results.length, failed: failed.length } };
}

const mode = process.env.OS_MODE ?? "det";
const result = mode === "llm" ? await llm() : deterministic();
const out = { mode, model: process.env.OS_MODEL_LABEL ?? (RELAY ? "relay" : "deepseek-v4.1-flash-free-1m"), rowsSearched: allObjects.length, toolParameters: properties, ...result };
if (process.env.OS_OUT) writeFileSync(process.env.OS_OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ mode, rowsSearched: allObjects.length, summary: result.summary }));
