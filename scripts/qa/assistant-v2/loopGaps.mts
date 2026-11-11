// 워커 이벤트 루프가 한 번에 얼마나 막히는가(모델 없음): 저장된 게임의 청사진을 실제 동사로 다시 지으며 250ms 타이머가 늦게 돌아온 구간을 잰다.
// 왜(2026-11-11): 장소 짓기·출구 마감이 31~74초 루프를 막아 실행 스트림의 heartbeat 가 못 나갔고, 편집기의 30초 침묵 감시가 턴마다 네 번 스트림을 끊었다.
// 고친 것(src/ai/v2/shared/yieldLoop.ts)이 다시 뭉치지 않는지, 새 단계가 30초를 넘지 않는지 이걸로 잰다. 시험 러너가 아니다 — 출력만 한다.
//   bun scripts/qa/assistant-v2/loopGaps.mts <project.json | 세션의 live.json> [seed]
//   출력: [gap] N.Ns  <막히기 전 동사> → <돌아온 때 동사> · 맵마다 해시 · 끝줄 RESULT(max gap · ≥30s 수 · ≥10s 수 · 단계 기록 해시).
//   전/후 대조: 두 커밋에서 같은 입력·씨앗으로 돌려 MAP·DB 줄과 stampsha 가 같아야 한다(청사진의 updatedAt 만 벽시계라 다르다).
//   TASK=<요청 글>(기본 «모험 게임 하나 만들어 줘.»), DUMP=<파일> 이면 맵·DB·청사진을 JSON 으로 남긴다. 기계 부하에 따라 초는 달라진다 — 같은 때 나란히 돌려 비교한다.
import fs from "node:fs";
import { createHash } from "node:crypto";
const [from, seed = "1"] = process.argv.slice(2);
if (!from) { console.log("usage: loopGaps.mts <project.json> [seed]"); process.exit(1); }
{ let s = Number(seed) >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 같은 입력이면 같은 출력이 나오게 시각·번호를 고정한다(전/후 sha 대조용). 간격 재기는 진짜 시계로.
const realNow = Date.now.bind(Date);
{ let tick = 1_800_000_000_000; Date.now = () => (tick += 7); let n = 0;
  (crypto as any).randomUUID = () => { n += 1; const h = n.toString(16).padStart(12, "0"); return `00000000-0000-4000-8000-${h}`; }; }
const { createBlankProject } = await import("../../../src/project/defaults/blankProject.ts");
const { createV2Tools } = await import("../../../src/ai/v2/tools/verbs.ts");
const { V2Session } = await import("../../../src/ai/v2/turn/session.ts");
const { runFinishAutoBuild } = await import("../../../src/ai/v2/finish/index.ts");
let phase = "setup", last = realNow(), lastPhase = phase; const gaps: number[] = [];
const timer = setInterval(() => { const now = realNow(), gap = now - last - 250; if (gap >= 2000) { gaps.push(gap); console.log(`[gap] ${(gap / 1000).toFixed(1)}s  ${lastPhase} → ${phase}`); } last = now; lastPhase = phase; }, 250);
const saved = JSON.parse(fs.readFileSync(from, "utf8"));
const bp = saved.gameBlueprint;
const text = bp.steps.map((st: any) => ({ id: st.id, ...(st.text ?? { lines: ["……"], ...(st.kind === "battle" ? { winLines: ["……"] } : {}), ...(st.kind === "choice" ? { choices: [{ text: "그렇게 한다", lines: ["……"] }, { text: "다르게 한다", lines: ["……"] }] } : {}) }) }));
const steps = bp.steps.map(({ text: _t, ...rest }: any) => rest);
// 요청 글은 «게임 하나» 여야 끝맺음의 조립·출하 단계까지 돈다. TASK=<글> 로 바꾼다.
const task = process.env.TASK ?? "모험 게임 하나 만들어 줘.";
const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
const session = new V2Session();
const stamps: string[] = [];
const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","loopgaps"]` },
  emit: (e: any) => { if (String(e.name).startsWith("v2.")) stamps.push(`${e.name}:${e.ok}:${String(e.summary ?? "").slice(0, 80)}`); }, record: () => {},
  sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "",
  checkpoint: async (name: string) => { stamps.push(`checkpoint:${name}`); await new Promise((r) => setTimeout(r, 0)); } } as any;
const tools = createV2Tools(env, session);
const call = async (tool: string, args: unknown) => { phase = tool; const t0 = realNow(); const t = tools.find((x: any) => x.name === tool);
  if (!t) throw new Error(`no tool ${tool}`);
  const res = await t.execute(`c-${tool}`, args);
  const body = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}"; let ok: unknown; try { ok = JSON.parse(body).ok; } catch { ok = body.slice(0, 80); }
  console.log(`== ${tool} ok=${ok} ${((realNow() - t0) / 1000).toFixed(1)}s`); await new Promise((r) => setTimeout(r, 300)); };
await call("write_blueprint", { title: bp.title, genre: bp.genre, playerGoal: bp.playerGoal, places: bp.places, steps, ending: bp.ending, ...(bp.setting ? { setting: bp.setting } : {}) });
await call("build_places", {});
await call("build_blueprint_path", text.length ? { steps: text } : {});
phase = "finish(autoBuild)"; { const t0 = realNow(); await runFinishAutoBuild(env, session); console.log(`== finish ${((realNow() - t0) / 1000).toFixed(1)}s`); }
await new Promise((r) => setTimeout(r, 600)); clearInterval(timer);
const p = env.ctx.project;
const sha = createHash("sha256").update(JSON.stringify({ maps: p.maps, database: p.database, gameBlueprint: p.gameBlueprint, startMapId: p.startMapId })).digest("hex").slice(0, 16);
console.log(`RESULT maps ${Object.keys(p.maps).length} · max gap ${(Math.max(0, ...gaps) / 1000).toFixed(1)}s · ≥30s ${gaps.filter((g) => g >= 30000).length} · ≥10s ${gaps.filter((g) => g >= 10000).length} · gaps ${gaps.length} · stamps ${stamps.length} · sha ${sha} · stampsha ${createHash("sha256").update(stamps.join("\n")).digest("hex").slice(0, 12)}`);
const h = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 10);
for (const m of Object.values(p.maps) as any[]) console.log(`MAP ${m.name} ${m.width}x${m.height} id=${h(m.id)} tiles=${h([m.layers, m.tiles, m.terrain, m.relief])} events=${h(m.events)} n=${(m.events ?? []).length} all=${h(m)}`);
console.log(`DB ${h(p.database)} BP ${h(p.gameBlueprint)} start ${p.startMapId.slice(0, 12)}`);
fs.writeFileSync(process.env.OUT ?? "/dev/null", stamps.join("\n"));
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify({ maps: p.maps, database: p.database, gameBlueprint: p.gameBlueprint, startMapId: p.startMapId }));
process.exit(0);
