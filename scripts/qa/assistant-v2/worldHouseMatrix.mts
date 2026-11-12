// 세계 열 × «작은 마을과 촌장 집» — 모델 없이 빌더 경로가 끝나는가(바깥 마을 → 집 안 → 문 잇기 → 걸어 들어갔다 나오기).
// 왜(2026-11-12): Haiku 판에서 전국·에도 프로젝트의 «촌장 집» 이 «실내 종류 없음» 으로 거절되고 턴이 질문으로 끝났다 — 세계마다 같은 일이 되는지 표로 본다.
// 모델이 하는 일은 make_place 두 번(마을 · 집 안)뿐이라, 그 두 호출을 그대로 부르고 결과를 엔진 통행으로 걷는다.
//   bun scripts/qa/assistant-v2/worldHouseMatrix.mts [--repo <다른 체크아웃>] [--trials 3] [--out <폴더>] [--only sengoku_edo,sf_station]
//   --repo: 그 체크아웃의 코드로 돈다(전/후 비교 — 같은 스크립트, 다른 코드). --out: 표(matrix.md)와 맵 그림(1배 PNG)을 쓴다.
import fs from "node:fs";
import path from "node:path";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const repo = path.resolve(arg("repo") ?? path.join(import.meta.dirname, "../../.."));
const trials = Number(arg("trials") ?? 3);
const out = arg("out");
const only = arg("only")?.split(",");

const { createBlankProject } = await import(`${repo}/src/project/defaults.ts`);
const { createV2Tools } = await import(`${repo}/src/ai/v2/tools/verbs.ts`);
const { withTodoLoop } = await import(`${repo}/src/ai/v2/loop/todoTools.ts`);
const { V2Session } = await import(`${repo}/src/ai/v2/turn/session.ts`);
const { WORLDS } = await import(`${repo}/src/ai/v2/place/world.ts`);
const { VILLAGE_POOL, pickVillageChipset } = await import(`${repo}/src/ai/villageChipsetPool.ts`);
const { walkGame } = await import(`${repo}/src/ai/v2/story/makeGame.ts`);
const { transfersOut } = await import(`${repo}/src/ai/v2/judge/todoCheckFacts.ts`);
const { renderMapPng } = out ? await import(`${repo}/scripts/qa-game/render.mts`) : { renderMapPng: undefined as any };

type Kind = { id: string; indoor?: true; danger?: true; compose?: { size: readonly [number, number] } };
type World = { id: string; tilesetId: string; ko: string; composer?: unknown; kinds: readonly Kind[] };

/** 판마다 같은 씨앗 — make_place 가 Math.random 으로 salt 를 뽑는다. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const TASK = "작은 마을과 촌장 집을 만들어 줘.";
/** 낱말 없는 마을 요청의 칩셋은 프로젝트 열쇠 해시가 정한다(villageChipsetPool) — 그 칩셋(없으면 버들항)이 뽑히는 열쇠를 찾는다. */
function keyFor(tilesetId: string | undefined, trial: number): string {
  const blank = createBlankProject();
  for (let n = 0; n < 4000; n++) {
    const key = `house-matrix-${trial}-${n}`;
    const pick = pickVillageChipset(blank, key, TASK);
    if ((pick?.entry.tilesetId ?? undefined) === tilesetId) return key;
  }
  throw new Error(`no project key lands on ${tilesetId ?? "beodeul"}`);
}

function turn(task: string, projectKey: string) {
  const project = createBlankProject();
  const ctx: any = { project, currentMapId: project.startMapId, assistantRun: true };
  const env: any = { ctx, request: { task, projectKey, provider: "local-cli:claude", mapIds: [], project }, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {}, preferToolNextTurn: () => {}, clearToolPreference: () => {} };
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown): Promise<string> => tools.find((t: any) => t.name === name)!.execute(`c-${name}`, args).then((r: any) => r.content.filter((c: any) => c.type === "text").map((c: any) => c.text ?? "").join("\n"), (e: Error) => `THROW ${e.message}`);
  return { ctx, call };
}

interface Row { world: string; trial: number; village: string; house: string; linked: string; walk: string; ok: boolean; note: string; model?: boolean }
const rows: Row[] = [];
const realRandom = Math.random;
const VILLAGE = "새벽 마을", HOUSE = "촌장 집";

for (const world of WORLDS as readonly World[]) {
  if (only && !only.includes(world.id)) continue;
  const pool = (VILLAGE_POOL as readonly { tilesetId: string; v2Style: string }[]).find((e) => e.tilesetId === world.tilesetId);
  const outdoor = world.kinds.find((k) => !k.indoor && !k.danger);
  // 바깥 마을: 칩셋 풀에 있는 세계는 낱말 없는 요청이 가는 길 그대로(화풍을 적지 않는다 — 프로젝트 열쇠가 그 칩셋을 뽑는다),
  // 그 밖의 구성기 세계는 그 세계의 첫 안전한 바깥 종류(world:<세계>:<종류> — 요청이 그 세계를 말했을 때 모델이 고르는 값), 버들항은 종전 마을 빌더.
  const pooled = !!pool?.v2Style;
  const style = !pooled && world.composer && outdoor ? `world:${world.id}:${outdoor.id}` : undefined;
  for (let trial = 1; trial <= trials; trial++) {
    Math.random = seeded(trial * 7919 + world.id.length * 131 + world.id.charCodeAt(0));
    const row: Row = { world: world.id, trial, village: "-", house: "-", linked: "-", walk: "-", ok: false, note: "" };
    rows.push(row);
    try {
      const t = turn(TASK, keyFor(pooled ? world.tilesetId : undefined, trial));
      await t.call("todo", { op: "init", list: [{ phase: "p", items: [
        { content: "마을 만들기", id: "v", check: { kind: "place", name: VILLAGE, placeKind: "village", fresh: true } },
        { content: "촌장 집 만들기", id: "h", check: { kind: "place", name: HOUSE, placeKind: "interior", fresh: true } },
      ] }] });
      const a = await t.call("make_place", { spec: { type: "village", name: VILLAGE, size: "small", ...(style ? { style } : {}) } });
      const maps = () => Object.values<any>(t.ctx.project.maps);
      let v = maps().find((m) => m.name === VILLAGE);
      // 버들항 마을은 코드가 땅을 만들고 모델이 그림을 보고 자리를 고른다(설계) — 모델 없이는 여기서 멈춘다. 실패가 아니라 «모델 차례» 로 적는다.
      if (!v && /"notFailure":true/u.test(a)) { row.village = "waits for the model (it picks the village sites on the terrain picture)"; row.model = true; continue; }
      if (!v) { row.village = "not built"; row.note = a.replace(/\s+/gu, " ").slice(0, 220); continue; }
      row.village = `${style ?? (pooled ? "village pool" : "village builder")} ${v.width}×${v.height} ${v.tilesetId}`;
      if (v.tilesetId !== world.tilesetId) { row.note = `village came out on ${v.tilesetId}`; continue; }
      const b = await t.call("make_place", { spec: { type: "interior", name: HOUSE } });
      const h = maps().find((m) => m.name === HOUSE);
      v = maps().find((m) => m.name === VILLAGE)!;   // 쓰기 도구는 프로젝트를 새 객체로 바꾼다 — 문이 달린 뒤의 마을을 다시 읽는다
      if (!h) { row.house = "not built"; row.note = b.replace(/\s+/gu, " ").slice(0, 260); continue; }
      const kind = /built as the «([^»]+)» kind/u.exec(b)?.[1];
      row.house = `${kind ? `«${kind}» ` : ""}${h.width}×${h.height} ${h.tilesetId}`;
      const into = transfersOut(v).find((x: any) => x.to.mapId === h.id), back = transfersOut(h).find((x: any) => x.to.mapId === v.id);
      row.linked = into && back ? `door (${into.ev.x},${into.ev.y}) → (${into.to.x},${into.to.y}) · exit (${back.ev.x},${back.ev.y}) → (${back.to.x},${back.to.y})` : `${into ? "in only" : back ? "back only" : "no"}`;
      const walked = walkGame(t.ctx.project, [v.id, h.id]);
      const started = t.ctx.project.startMapId === v.id;
      row.walk = !started ? `start is not on the village (${t.ctx.project.startMapId})` : walked.unreached.length ? "room not reached on foot" : walked.noWayBack.length ? "no way back out" : "in and back";
      row.ok = !!into && !!back && row.walk === "in and back";
      if (!row.ok) row.note = b.replace(/\s+/gu, " ").slice(0, 260);
      if (out && trial === 1 && renderMapPng) {
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, `${world.id}-village.png`), renderMapPng(t.ctx.project, t.ctx.project.maps[v.id]).png);
        fs.writeFileSync(path.join(out, `${world.id}-house.png`), renderMapPng(t.ctx.project, t.ctx.project.maps[h.id]).png);
      }
    } catch (e) { row.note = `THROW ${String((e as Error).message ?? e).slice(0, 220)}`; }
  }
}
Math.random = realRandom;

const lines = ["| world | completes | village | house | link | walk | note |", "|---|---|---|---|---|---|---|"];
for (const world of WORLDS as readonly World[]) {
  const mine = rows.filter((r) => r.world === world.id);
  if (!mine.length) continue;
  const pass = mine.filter((r) => r.ok).length;
  const show = mine.find((r) => !r.ok) ?? mine[0]!;
  lines.push(`| ${world.id} | ${mine.every((r) => r.model) ? "model step" : `${pass}/${mine.length}`} | ${show.village} | ${show.house} | ${show.linked} | ${show.walk} | ${show.note.replace(/\|/gu, "/")} |`);
}
const total = rows.filter((r) => r.ok).length;
const worldsRun = (WORLDS as readonly World[]).filter((w) => rows.some((r) => r.world === w.id));
const byModel = worldsRun.filter((w) => rows.filter((r) => r.world === w.id).every((r) => r.model));
lines.push("", `worlds that complete without a model on every trial: ${worldsRun.filter((w) => rows.filter((r) => r.world === w.id).every((r) => r.ok)).length}/${worldsRun.length - byModel.length}`
  + ` · trials ${total}/${rows.filter((r) => !r.model).length}${byModel.length ? ` · designed by the model, not counted: ${byModel.map((w) => w.id).join(", ")}` : ""}`);
console.log(lines.join("\n"));
if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "matrix.md"), lines.join("\n") + "\n"); fs.writeFileSync(path.join(out, "rows.json"), JSON.stringify(rows, null, 1)); }
process.exit(0);
