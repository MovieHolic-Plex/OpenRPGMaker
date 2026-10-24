// 조수 v2 콘텐츠 동사(add_people / add_event / draw_object / place_object) 증명 스크립트 — 모델 없이, 동사를 직접 부른다.
// 실행: bun scripts/qa/assistant-v2/content.mts [outDir]   (기본 qa-runs/content-r2)
// 시작 상태는 v1/v2 비교 사례(harness-data/space-craft/seed.json cmp-npc·cmp-cutscene·cmp-draw-object)와 같다:
//   마을 = 빈 프로젝트에 author_beodeul_town(houseCount 4, river, seed 11), 선술집 = build_hand_interior_room layout [tavern, kitchen].
// 비평가는 흉내(major 0, 받은 그림 수만 센다) — 연출 비평 틀이 실제로 몇 장 그려져 가는지·결과에 어떻게 실리는지를 본다.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { getTool } from "../../../src/editor/tools/toolRegistry.ts";
import { createV2Tools, V2Session } from "../../../src/ai/v2/verbs.ts";
import { resolveWhere, findMap } from "../../../src/ai/v2/people.ts";
import { PEOPLE_CARD } from "../../../src/ai/v2/people.ts";
import { EVENT_CARD } from "../../../src/ai/v2/events.ts";
import { DRAW_OBJECT_CARD } from "../../../src/ai/v2/drawObject.ts";
import type { PiAssistantV2Env } from "../../../src/ai/v2/env.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const OUT = process.argv[2] ?? "qa-runs/content-r2";
fs.mkdirSync(OUT, { recursive: true });
console.log("card lengths", PEOPLE_CARD.length, EVENT_CARD.length, DRAW_OBJECT_CARD.length);

/** 맵 구역을 1배로(그 순간 ctx.project). */
function cropPng(project: ToolContext["project"], mapId: string, x: number, y: number, w: number, h: number): Buffer {
  const map = project.maps[mapId]!;
  const full = PNG.sync.read(renderMapPng(project, map, 1).png);
  const ts = project.tilesets[map.tilesetId]?.tileSize ?? 16;
  const out = new PNG({ width: w * ts, height: h * ts });
  PNG.bitblt(full, out, x * ts, y * ts, Math.min(w * ts, full.width - x * ts), Math.min(h * ts, full.height - y * ts), 0, 0);
  return PNG.sync.write(out);
}

/** 1배 그림 위에 칸 사각형 테두리(검수용 표시). */
function outlineCells(png: Buffer, rects: { x: number; y: number; w: number; h: number; rgb: [number, number, number] }[], ts = 16): Buffer {
  const img = PNG.sync.read(png);
  for (const r of rects) {
    const x0 = r.x * ts, y0 = r.y * ts, x1 = (r.x + r.w) * ts - 1, y1 = (r.y + r.h) * ts - 1;
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) set(x, y);
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) set(x, y);
    function set(x: number, y: number): void {
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
      const i = (y * img.width + x) * 4;
      img.data[i] = r.rgb[0]; img.data[i + 1] = r.rgb[1]; img.data[i + 2] = r.rgb[2]; img.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(img);
}

function stubCritic(messages: readonly unknown[]): Promise<string> {
  let images = 0;
  for (const m of messages) for (const part of ((m as { content?: unknown[] }).content ?? [])) if ((part as { type?: string }).type === "image_url") images++;
  return Promise.resolve(JSON.stringify({ imagesSeen: images, axes: { request: 7, staging: 7, polish: 7, composition: 7, view: 7, doors: 7 }, score: 7, majors: [] }));
}

/** 동사가 부른 렌더 전부(컷신 장면 틀 포함) — 틀을 모두 파일로 남긴다. */
let renders: Buffer[] = [];
function dumpRenders(tag: string): void {
  renders.forEach((png, i) => fs.writeFileSync(path.join(OUT, `${tag}-frame${i + 1}.png`), png));
  console.log(`${tag}: render ${renders.length}장 저장`);
  renders = [];
}

function makeEnv(ctx: ToolContext, task: string, log: string[]): PiAssistantV2Env {
  return {
    ctx, request: { task, provider: "local-cli:claude", mapIds: [], project: ctx.project } as never,
    emit: (e) => log.push(`event ${e.type} ${(e as { summary?: string }).summary ?? ""}`),
    record: (r) => log.push(`record ${r.name} ok=${r.result.ok} — ${String(r.result.summary).slice(0, 200)}`),
    sideChat: stubCritic,
    render: async (mapId, x, y, w, h) => {
      const png = cropPng(ctx.project, mapId, x, y, w, h);
      renders.push(png);
      return `data:image/png;base64,${png.toString("base64")}`;
    },
    checkpoint: async (label) => { log.push(`checkpoint ${label}`); },
  };
}

async function call(tools: ReturnType<typeof createV2Tools>, name: string, args: unknown, tag: string): Promise<Record<string, unknown>> {
  const tool = tools.find((t) => t.name === name)!;
  const t0 = Date.now();
  const res = await tool.execute(`${tag}`, args);
  const textPart = res.content.find((c) => c.type === "text") as { text: string };
  const parsed = JSON.parse(textPart.text) as Record<string, unknown>;
  let n = 0;
  for (const c of res.content) if (c.type === "image") fs.writeFileSync(path.join(OUT, `${tag}-img${++n}.png`), Buffer.from((c as { data: string }).data, "base64"));
  console.log(`\n-- ${name} (${tag}) ${Date.now() - t0}ms images=${n}`);
  console.log(JSON.stringify(parsed, null, 1).slice(0, 2600));
  return parsed;
}

function village(): ToolContext {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const r = getTool("author_beodeul_town")!.run(ctx.project, { mapId: project.startMapId, name: "버들 마을", houseCount: 4, theme: "river", seed: 11 }) as { ok?: boolean; summary: string };
  console.log("village:", String(r.summary).slice(0, 120), "start", ctx.project.startPos);
  return ctx;
}

function tavern(): ToolContext {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const r = getTool("build_hand_interior_room")!.run(ctx.project, { mapId: project.startMapId, name: "선술집", layout: { rooms: [{ kind: "tavern" }, { kind: "kitchen" }] } }) as { summary: string };
  console.log("tavern:", String(r.summary).slice(0, 120), "start", ctx.project.startPos);
  return ctx;
}

function fullPng(ctx: ToolContext, file: string, rects: Parameters<typeof outlineCells>[1] = []): void {
  const map = ctx.project.maps[ctx.project.startMapId]!;
  const png = renderMapPng(ctx.project, map, 1).png;
  fs.writeFileSync(path.join(OUT, file), rects.length ? outlineCells(png, rects) : png);
  console.log("png", path.join(OUT, file));
}

const only = process.argv.slice(3);
const want = (s: string) => !only.length || only.includes(s);

// ── 1. 문지기(cmp-npc) ──
if (want("npc")) {
  const ctx = village();
  const log: string[] = [];
  const session = new V2Session();
  const tools = createV2Tools(makeEnv(ctx, "이 마을 입구에 문지기 NPC 하나 세워 줘. 처음 말을 걸면 '해가 지면 성문을 닫는다네'라고 경고하고, 두 번째부터는 '조심해서 다녀오게'라고만 말하게 해 줘.", log), session);
  await call(tools, "add_people", { people: [{ role: "문지기", where: "마을 입구", looks: "경비병", firstTalk: ["해가 지면 성문을 닫는다네."], laterTalk: ["조심해서 다녀오게."] }] }, "npc");
  const map = ctx.project.maps[ctx.project.startMapId]!;
  for (const e of map.events) console.log("event", e.id, e.name, e.x, e.y, JSON.stringify(e.pages?.map((p) => ({ g: p.graphic, face: (p.commands ?? []).find((c) => c.kind === "changeFace") }))).slice(0, 400));
  const guard = map.events.find((e) => e.name === "문지기")!;
  fullPng(ctx, "npc-guard-map.png");
  fs.writeFileSync(path.join(OUT, "npc-guard-zoom.png"), cropPng(ctx.project, map.id, Math.max(0, guard.x - 6), Math.max(0, guard.y - 5), 13, 10));
}

// ── 2. 시작 컷신(cmp-cutscene) + 다시 부르기(바꾸기) ──
if (want("cutscene")) {
  const ctx = village();
  const log: string[] = [];
  const session = new V2Session();
  const task = "게임을 시작하면 주인공이 마을 길로 걸어 나오고, 촌장이 다가와서 '드디어 왔구나, 기다리고 있었네' 하고 말하는 짧은 컷신을 넣어 줘.";
  const tools = createV2Tools(makeEnv(ctx, task, log), session);
  const beats = [
    { do: "walk", who: "주인공", to: "마을 길" },
    { do: "appear", who: "촌장", where: "광장", looks: "노인" },
    { do: "walk", who: "촌장", to: "주인공" },
    { do: "say", who: "촌장", text: "드디어 왔구나, 기다리고 있었네." },
  ];
  renders = [];
  await call(tools, "add_event", { event: { kind: "cutscene", when: "game-start", beats } }, "cut1");
  dumpRenders("cut1");
  // 다시 부르기 — 앞 컷신·촌장을 바꿔야 한다(겹쳐 쌓이면 안 된다).
  const beats2 = [
    { do: "walk", who: "주인공", to: "길" },
    { do: "appear", who: "촌장", looks: "노인", talk: ["마을을 둘러보게나. 궁금한 건 언제든 묻고."] },
    { do: "walk", who: "촌장", to: "주인공" },
    { do: "say", who: "촌장", text: "드디어 왔구나, 기다리고 있었네." },
    { do: "say", who: "주인공", text: "안녕하세요, 촌장님." },
  ];
  const r2 = await call(tools, "add_event", { event: { kind: "cutscene", when: "game-start", beats: beats2 } }, "cut2");
  dumpRenders("cut2");
  const map = ctx.project.maps[ctx.project.startMapId]!;
  const cutsceneHosts = map.events.filter((e) => (e.pages ?? []).some((p) => p.name === "컷신"));
  const chiefs = map.events.filter((e) => e.name === "촌장");
  console.log(`\nreplace check: cutscene hosts=${cutsceneHosts.length} chiefs=${chiefs.length} (both must be 1)`);
  for (const e of map.events) console.log("event", e.id, e.name, e.x, e.y, (e.pages ?? []).map((p) => `${p.name}:${(p.commands ?? []).map((c) => c.kind).join(",")}`).join(" | ").slice(0, 300));
  const host = cutsceneHosts[0]!;
  const page = host.pages!.find((p) => p.name === "컷신")!;
  console.log("cutscene commands:", JSON.stringify(page.commands).slice(0, 2400));
  console.log("ok", r2.ok);
  fullPng(ctx, "cutscene-map.png");
}

// ── 3. 선술집 자리 낱말 + 없는 물건(cmp-draw-object) ──
if (want("tavern")) {
  const ctx = tavern();
  const map = findMap(ctx.project, ctx.project.startMapId)!;
  const words = ["홀 한쪽", "바 옆", "카운터 앞", "북쪽 벽", "구석", "창가", "입구", "홀 가운데", "부엌 화덕 옆"];
  const rects: Parameters<typeof outlineCells>[1] = [];
  const palette: [number, number, number][] = [[255, 60, 60], [60, 220, 255], [255, 220, 40], [120, 255, 120], [255, 120, 255], [255, 160, 60], [255, 255, 255], [160, 120, 255], [40, 160, 255]];
  words.forEach((w, i) => {
    const r = resolveWhere(ctx.project, map, w);
    console.log(`where '${w}' → (${r.cell.x},${r.cell.y}) how=${r.how ?? "-"} face=${r.face ?? "-"} note=${r.note ?? "-"}`);
    rects.push({ x: r.cell.x, y: r.cell.y, w: 1, h: 1, rgb: palette[i]! });
  });
  fullPng(ctx, "tavern-where-words.png", rects);

  const log: string[] = [];
  const session = new V2Session();
  const task = "이 선술집에 놓을 '놋쇠 태엽 지구본'(태엽 장치가 달린 커다란 지구본) 기물이 칩셋에 없으면 새로 그려서 홀 한쪽에 놓아 줘.";
  const tools = createV2Tools(makeEnv(ctx, task, log), session);
  // 첫 부름은 칩셋의 보통 지구본 때문에 거절된다(요청과 다른 물건) — 모델이 하듯 notThese 로 다시 부른다.
  const first = await call(tools, "draw_object", { object: { what: "놋쇠 태엽 지구본", description: "놋쇠 받침 위에 태엽 장치가 달린 커다란 지구본", where: "홀 한쪽" } }, "draw0");
  console.log("first refused:", first.ok === false);
  const dr = await call(tools, "draw_object", { object: { what: "놋쇠 태엽 지구본", description: "놋쇠 받침 위에 태엽 장치가 달린 커다란 지구본", where: "홀 한쪽", notThese: ["hand-interior:globe", "globe"] } }, "draw");
  const card = (log.find((l) => l.startsWith("record draw_object")) ?? "");
  console.log(card);
  const m = /놓을 자리 \((\d+),(\d+)\)/u.exec(String(dr.summary));
  const size = /(\d)×(\d)칸 — 발밑 (\d)줄/u.exec(String(dr.summary));
  if (m && size) {
    const bx = Number(m[1]), by = Number(m[2]), w = Number(size[1]), h = Number(size[2]), foot = Number(size[3]);
    fullPng(ctx, "tavern-globe-spot.png", [{ x: bx, y: by - h + 1, w, h, rgb: [255, 220, 40] }, { x: bx, y: by - foot + 1, w, h: foot, rgb: [255, 60, 60] }]);
  }
  // 그림이 끝났다고 치고(공방 칸 대신 칩셋의 보통 지구본 id 로) where·at 없이 place_object — draw_object 가 정한 자리에 가야 한다.
  await call(tools, "place_object", { mapId: ctx.project.startMapId, objectId: "hand-interior:globe" }, "place");
  fullPng(ctx, "tavern-globe-placed.png");
  // 바 옆에 바텐더, 홀 한쪽에 손님 — 사람 자리 낱말.
  await call(tools, "add_people", { people: [
    { role: "바텐더", where: "바 뒤", firstTalk: ["뭘로 드릴까?"] },
    { role: "손님", where: "창가", looks: "아저씨", firstTalk: ["이 집 맥주가 최고지."] },
  ] }, "tavern-npc");
  fullPng(ctx, "tavern-npcs.png");
}

// ── 4. 몬스터 수집 첫 마을(cmp-monster-town): make_place(style monster) → add_people 셋 ──
if (want("monster")) {
  const project = createBlankProject();
  project.maps[project.startMapId]!.tilesetId = "monster_overworld";
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const log: string[] = [];
  const session = new V2Session();
  const task = "포켓몬 같은 몬스터 수집 게임의 첫 마을 만들어 줘. 주인공 집, 박사 연구소, 몬스터 센터가 있고, 마을 사람 NPC 셋이 각자 한마디씩 해 줘. 북쪽으로 풀숲 길이 이어지게.";
  const tools = createV2Tools(makeEnv(ctx, task, log), session);
  renders = [];
  const made = await call(tools, "make_place", { spec: { type: "village", style: "monster", name: "새싹 마을" } }, "mon-place");
  dumpRenders("mon-place");
  const townId = ctx.project.startMapId;
  ctx.currentMapId = townId;
  await call(tools, "add_people", { mapId: townId, people: [
    { role: "마을 아주머니", where: "광장", looks: "아줌마", firstTalk: ["연구소 박사님이 오늘 너를 기다리고 계시더라."] },
    { role: "소년", where: "입구", looks: "소년", firstTalk: ["북쪽 풀숲엔 야생 몬스터가 숨어 있어! 혼자 들어가면 위험해."] },
    { role: "할아버지", where: "가운데", looks: "노인", firstTalk: ["몬스터 센터에 들르면 동료들이 금세 기운을 차린단다."] },
  ] }, "mon-people");
  const town = ctx.project.maps[townId]!;
  const { roadCellSet } = await import("../../../src/ai/v2/people.ts");
  const roadSet = roadCellSet(ctx.project, town);
  console.log("road cells", roadSet.size, "people on road:", town.events.filter((e) => /npc|person|people/i.test(e.id) && roadSet.has(e.y * town.width + e.x)).map((e) => `${e.name}(${e.x},${e.y})`).join(", ") || "none");
  for (const e of town.events) console.log("town event", e.id, e.name ?? "", `(${e.x},${e.y})`, e.pages?.[0]?.graphic?.sprite?.id ?? "", (e.pages?.[0]?.commands ?? []).filter((c) => c.kind === "text").map((c) => (c as { body: string }).body).join(" / ").slice(0, 60));
  for (const id of (made.mapIds as string[] | undefined) ?? []) {
    const m = ctx.project.maps[id]!;
    fs.writeFileSync(path.join(OUT, `mon-${id}.png`), renderMapPng(ctx.project, m, 1).png);
    console.log("png", `mon-${id}.png`, m.name, `${m.width}×${m.height}`);
  }
  console.log("genre", ctx.project.system.genre, "lock", ctx.project.system.genreLock?.preset, "maps", Object.keys(ctx.project.maps).length);
  console.log("prompt cards:", (await import("../../../src/ai/v2/prompt.ts")).conditionalCards(ctx.project, townId, task).map((c) => c.slice(0, 30)));
}

// ── 5. 두 선택 대화 장면(cmp-romance-scene): 시작 상태는 fixture 와 같은 길(옥상 짓기 + 확정 기획 씨앗) → add_scene ──
async function romanceStart(withBrief: boolean): Promise<ToolContext> {
  const seed = JSON.parse(fs.readFileSync("harness-data/space-craft/seed.json", "utf8")) as { cases: { id: string; startTileset: string; startBuild?: { tool: string; args: Record<string, unknown> }[]; startBrief?: unknown }[] };
  const c = seed.cases.find((x) => x.id === "cmp-romance-scene")!;
  let project = createBlankProject();
  project.maps[project.startMapId]!.tilesetId = c.startTileset;
  for (const step of c.startBuild ?? []) getTool(step.tool)!.run(project, step.args);
  if (withBrief && c.startBrief) {
    const { normalizeGameDesignBrief } = await import("../../../src/project/gameDesignBrief.ts");
    const { eligibleAuthoringHarnessFor } = await import("../../../src/harnesses/_core/authoringRegistry.ts");
    project.gameDesignBrief = normalizeGameDesignBrief(c.startBrief);
    project = eligibleAuthoringHarnessFor(project)!.seed(project)!;
  }
  return { project, currentMapId: project.startMapId, assistantRun: true };
}
for (const variant of ["romance", "romance-free"] as const) {
  if (!want(variant)) continue;
  const ctx = await romanceStart(variant === "romance");
  const log: string[] = [];
  const session = new V2Session();
  const task = "학교 옥상에서 주인공과 소꿉친구 하린이 처음으로 속마음을 이야기하는 짧은 대화 장면 만들어 줘. 선택지 두 개로 하린의 반응이 달라지게.";
  const tools = createV2Tools(makeEnv(ctx, task, log), session);
  console.log("prompt cards:", (await import("../../../src/ai/v2/prompt.ts")).conditionalCards(ctx.project, ctx.currentMapId, task).map((c) => c.slice(0, 30)));
  const r = await call(tools, "add_scene", { scene: {
    partner: "하린", role: "소꿉친구", looks: "여학생", where: "난간 쪽",
    opening: ["여기 바람 시원하지? 너한테 꼭 하고 싶은 말이 있어서 불렀어.", "어릴 때부터 늘 옆에 있었는데… 요즘 너를 보면 자꾸 마음이 이상해져."],
    choices: [
      { label: "속마음을 털어놓는다", reaction: "…정말? 나만 그런 줄 알았어. 그 말, 오래 기다렸던 것 같아.", revisit: "아까 그 말, 계속 생각나서 수업에 집중이 안 돼." },
      { label: "웃으며 얼버무린다", reaction: "아, 그렇구나… 응, 괜찮아. 우리 사이가 어색해지는 건 싫으니까.", revisit: "아까 일은 잊어 줘. 우린 소꿉친구니까, 그치?" },
    ],
    closing: "오늘 옥상에서 이야기해 줘서 고마워, 하린아.",
  } }, variant);
  const map = ctx.project.maps[(r.mapIds as string[] | undefined)?.[0] ?? ctx.project.startMapId]!;
  for (const e of map.events) for (const [i, p] of (e.pages ?? []).entries()) console.log("page", e.id, e.name, `(${e.x},${e.y})`, i, p.id, p.graphic?.sprite?.id, JSON.stringify(p.commands).slice(0, 700));
  const { startStateOf } = await import("../../../src/project/session.ts");
  const lead = ctx.project.database.actors.find((a) => a.id === startStateOf(ctx.project).partyActorIds[0]);
  console.log("hero chip:", lead?.id, lead?.characterResourceId, lead?.characterIndex, lead?.faceResourceId, "warnings:", JSON.stringify(r.warnings ?? []).slice(0, 400));
  fullPng(ctx, `${variant}-map.png`);
  fs.writeFileSync(path.join(OUT, `${variant}-project.json`), JSON.stringify(ctx.project));
}
