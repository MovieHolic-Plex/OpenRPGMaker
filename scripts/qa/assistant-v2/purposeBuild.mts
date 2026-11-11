// 목적표 전/후 짓기(모델 없음): 청사진 하나를 실제 동사(write_blueprint → build_places → build_blueprint_path → 끝맺음 길 단계)로 지어
// project.json 과 맵 PNG(1배)를 남긴다. 재기는 purposeProbe.mts 가 project.json 에서 한다 — 같은 청사진을 main 과 이 브랜치에서 지어 나란히 본다.
//   bun scripts/qa/assistant-v2/purposeBuild.mts <outDir> --from <project.json>     그 저장본의 청사진(장소·단계)을 그대로 다시 짓는다
//   bun scripts/qa/assistant-v2/purposeBuild.mts <outDir> --world <세계 id> [--talk]  그 세계의 종류를 차례로 쓰는 모델 없는 청사진(--talk: 사람 단계를 더 넣는다)
// SEED=<n> 을 주면 Math.random 을 고정한다(전/후가 같은 씨앗에서 시작하게).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs.ts";
import { V2Session } from "../../../src/ai/v2/turn/session.ts";
import { WORLDS, worldById } from "../../../src/ai/v2/place/world.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

if (process.env.SEED) {
  let s = Number(process.env.SEED) >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const argv = process.argv.slice(2);
const out = argv[0] ?? "qa-runs/v2scratch/purpose";
const flag = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const REQUEST: Record<string, string> = {
  beodeul: "버들항에서 벌어지는 판타지 RPG 게임 하나 만들어 줘.", snow_north: "북방 설원에서 벌어지는 게임 하나 만들어 줘.", desert_east: "사막 오아시스에서 벌어지는 게임 하나 만들어 줘.",
  pirate_isles: "해적 게임 하나 만들어 줘.", sky_island: "하늘섬 모험 게임 하나 만들어 줘.", steampunk_city: "스팀펑크 게임 하나 만들어 줘.", prehistoric: "공룡이 나오는 원시 부족 게임 하나 만들어 줘.",
  sengoku_edo: "사무라이 게임 하나 만들어 줘.", sf_station: "우주 정거장 SF 게임 하나 만들어 줘.", wasteland: "좀비 아포칼립스 게임 하나 만들어 줘.",
};

type Bp = { title: string; genre: string; playerGoal: string; places: { name: string; kind: string; from?: string }[]; steps: Record<string, unknown>[]; ending: unknown; setting?: string };

/** 모델 없는 청사진 — 바깥 종류를 차례로, 실내 종류 둘. --talk 면 앞 장소들에 사람 단계를 둘씩. */
function probeBlueprint(worldId: string, talk: boolean): { bp: Bp; text: Record<string, unknown>[] } {
  const world = worldById(worldId)!;
  const outdoor = world.kinds.filter((k) => !k.indoor), indoor = world.kinds.filter((k) => k.indoor);
  const kinds = [...outdoor.slice(0, 6), ...indoor.slice(0, 2)];
  const places = kinds.map((k) => ({ name: k.ko, kind: k.id }));
  const PEOPLE = ["촌장 하르", "약초꾼 리나", "떠돌이 상인 미라", "문지기 도윤", "노인 세바", "아이 누리"];
  const steps: Record<string, unknown>[] = [], text: Record<string, unknown>[] = [];
  let n = 0;
  const add = (st: Record<string, unknown>, t?: Record<string, unknown>) => { n += 1; steps.push({ id: `s${n}`, ...st, ...(n > 1 ? { needs: steps.at(-1)!.gives } : {}), gives: `단서 ${n}`, feeling: "궁금함" }); if (t) text.push({ id: `s${n}`, ...t }); };
  // 단계 종류를 섞는다(사람·조사·고르기·번호 자물쇠) — 위험한 곳(★)은 싸움. --talk 면 앞 세 장소에 사람을 하나씩 더.
  const calm = ["talk", "find", "choice", "puzzle", "talk", "find"] as const;
  let c = 0;
  places.slice(0, 6).forEach((p, i) => {
    const kind = kinds[i]!;
    if (kind.danger) { add({ kind: "battle", who: `${p.name}의 그림자`, place: p.name, event: `${p.name}의 그림자`, action: "싸워 이긴다" }, { lines: ["여기부터는 못 지나간다."], winLines: ["…지나가라."] }); return; }
    const what = calm[c++ % calm.length]!, who = PEOPLE[i % PEOPLE.length]!;
    if (what === "talk") add({ kind: "talk", who, place: p.name, event: who, action: `${who}에게 말을 건다` }, { lines: ["어서 오게. 요즘 밤마다 이상한 소리가 들린다네."] });
    else if (what === "choice") add({ kind: "choice", who, place: p.name, event: who, action: `${who}의 부탁을 듣는다` }, { lines: ["부탁이 있어요."], choices: [{ text: "돕는다", lines: ["고마워요."], later: "도운 일이 마지막 길을 밝혔다." }, { text: "거절한다", lines: ["그렇군요."], later: "거절한 일이 마음에 남았다." }] });
    else if (what === "puzzle") add({ kind: "puzzle", place: p.name, event: `${p.name}의 번호 자물쇠`, action: "번호를 맞힌다" });
    else add({ kind: "find", place: p.name, event: `${p.name}의 단서`, action: "살펴본다" });
    if (talk && i < 3) { const second = PEOPLE[(i + 3) % PEOPLE.length]!; add({ kind: "talk", who: second, place: p.name, event: second, action: `${second}에게 말을 건다` }, { lines: ["조심해서 다니게."] }); }
  });
  return { bp: { title: `${world.ko} 목적표 시험`, genre: "모험", playerGoal: "단서를 따라 마지막 장소까지 가자.", places, steps, ending: { name: "끝", how: "마지막 단서를 찾았다.", feeling: "안도" } }, text };
}

async function build(name: string, worldId: string, bp: Bp, text: Record<string, unknown>[]): Promise<void> {
  const task = REQUEST[worldId] ?? "게임 하나 만들어 줘.";
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const session = new V2Session();
  const env: PiAssistantV2Env = {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","purpose-${name}"]` } as never,
    emit: (e: unknown) => { const ev = e as { name?: string; summary?: string }; if (ev.name === "v2.program-gap") console.log(`   ${ev.name}: ${String(ev.summary).slice(0, 300)}`); }, record: () => {},
    sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
    render: async () => "", checkpoint: async () => {},
  } as never;
  const tools = createV2Tools(env, session);
  const call = async (tool: string, args: unknown): Promise<Record<string, unknown>> => {
    const t = tools.find((x) => x.name === tool);
    if (!t) return { ok: false, summary: `no tool ${tool}` };
    const res = await t.execute(`c-${tool}`, args);
    const body = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "{}";
    try { return JSON.parse(body) as Record<string, unknown>; } catch { return { ok: false, summary: body.slice(0, 300) }; }
  };
  const wrote = await call("write_blueprint", { title: bp.title, genre: bp.genre, playerGoal: bp.playerGoal, places: bp.places, steps: bp.steps, ending: bp.ending });
  const built = await call("build_places", {});
  const pathRes = await call("build_blueprint_path", text.length ? { steps: text } : {});
  const lanes = session.clearLanes ? await session.clearLanes() : [];
  const p = ctx.project;
  for (const line of session.missingArt) console.log(`   ${line.slice(0, 300)}`);
  console.log(`== ${name} (${worldId}) blueprint=${wrote.ok} build_places=${built.ok} path=${pathRes.ok} maps ${Object.keys(p.maps).length} lanes ${lanes.length}`);
  if (!wrote.ok) console.log(`   blueprint: ${String(wrote.summary).slice(0, 500)}`);
  if (!built.ok) console.log(`   build_places: ${String(built.summary).slice(0, 700)}`);
  if (!pathRes.ok) console.log(`   path: ${String(pathRes.summary).slice(0, 500)}`);
  for (const line of (built.links as string[] | undefined) ?? []) console.log(`   · ${line.slice(0, 240)}`);
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const map of Object.values(p.maps)) fs.writeFileSync(path.join(dir, `${map.name}.png`), renderMapPng(p, map).png);
  fs.writeFileSync(path.join(dir, "project.json"), JSON.stringify(p));
}

const from = flag("--from"), worldId = flag("--world");
if (from) {
  const saved = JSON.parse(fs.readFileSync(from, "utf8")) as { gameBlueprint: Bp & { steps: (Record<string, unknown> & { id: string; text?: Record<string, unknown> })[] } };
  const bp = saved.gameBlueprint;
  const text = bp.steps.map((st) => ({ id: st.id, ...(st.text ?? { lines: ["……"], ...(st.kind === "battle" ? { winLines: ["……"] } : {}), ...(st.kind === "choice" ? { choices: [{ text: "그렇게 한다", lines: ["……"] }, { text: "다르게 한다", lines: ["……"] }] } : {}) }) }));
  const steps = bp.steps.map(({ text: _text, ...rest }) => rest);
  await build(flag("--name") ?? path.basename(path.dirname(from)), bp.setting ?? WORLDS[0]!.id, { ...bp, steps }, text);
} else if (worldId) {
  const { bp, text } = probeBlueprint(worldId, argv.includes("--talk"));
  await build(flag("--name") ?? `${worldId}${argv.includes("--talk") ? "-talk" : ""}`, worldId, bp, text);
} else console.log("usage: purposeBuild.mts <outDir> --from <project.json> | --world <id> [--talk]");
