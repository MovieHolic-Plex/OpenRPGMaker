// 개념 카드 예제 검사 — 카드의 예제 호출 순서를 새 프로젝트(브라우저 「새 프로젝트」와 같은 씨앗)에서 그대로 돌리고,
// 새로 생긴 맵을 그림으로 남기고 검사한다. 빌드 작업자가 이 결과가 ok 일 때까지 고친다.
//
//   bun src/harnesses/super-harness/node/example.mts --card <card.json> --out <폴더>
//
// 검사: 모든 호출 성공 · 예제마다 새 맵 1장 이상 · 장치 그림(보물상자·함정·세이브 수정…)이 있는 칸 곁에 이벤트 ·
// 카드에 이벤트로 적은 재료가 실제 이벤트로 존재.
import fs from "node:fs";
import path from "node:path";
import { buildBrowserSeed, type QaBrief } from "../../../../scripts/qa-game/lib/seed.ts";
import { runTool } from "../../../editor/tools/index.ts";
import { exampleMapIds } from "../../../editor/tools/conceptExampleTool.ts";
import type { ConceptCard } from "../../../ai/conceptCards.ts";
import { eventCounts, gimmicksWithoutEvents, renderAnnotated, spaceStats } from "./lib.mts";

type Worldview = { id: string; ko: string; native: string[] };
const seedFile = new URL("../../../../harness-data/super-harness/seed.json", import.meta.url);
const seedData = JSON.parse(fs.readFileSync(seedFile, "utf8")) as { worldviews?: Worldview[]; borrowStructure?: { tilesets: string[] } };
const WORLDVIEWS = new Map((seedData.worldviews ?? []).map((w) => [w.id, w]));
const BORROW = new Set(seedData.borrowStructure?.tilesets ?? []);
const INTERIOR = new Set(["atlas_biome_interior"]);

/** build_hand_interior_room 호출이 놓는 기물 id — 세계관 검사용. */
function placedPieces(calls: readonly { name: string; args: Record<string, unknown> }[], mapId: string): string[] {
  const out: string[] = [];
  for (const call of calls) {
    if (call.name !== "build_hand_interior_room" || (call.args.mapId && call.args.mapId !== mapId)) continue;
    for (const key of ["objects", "goods", "lines", "daises"]) for (const it of (call.args[key] as { id?: string }[] | undefined) ?? []) if (it?.id) out.push(it.id);
    for (const it of (call.args.tables as { style?: string }[] | undefined) ?? []) if (it?.style) out.push(`table:${it.style}`);
  }
  return [...new Set(out)];
}

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const cardFile = arg("card"), out = arg("out");
if (!cardFile || !out) { console.error("사용법: --card <card.json> --out <폴더>"); process.exit(2); }
const briefFile = arg("brief") ?? "scripts/qa-game/briefs/ember-mine-jrpg.json";
const card = JSON.parse(fs.readFileSync(cardFile, "utf8")) as ConceptCard;
const brief = JSON.parse(fs.readFileSync(briefFile, "utf8")) as QaBrief;
fs.mkdirSync(out, { recursive: true });

const problems: string[] = [];
const examples: unknown[] = [];
if (!card.id || !card.title || !Array.isArray(card.aliases) || card.aliases.length === 0) problems.push("카드에 id·title·aliases 가 있어야 한다");
if (!Array.isArray(card.variants) || card.variants.length === 0) problems.push("변형이 하나도 없다");
if (card.needsArt) problems.push("needsArt — 이 세계관 재료가 없어 그림을 주문했다(gaps.json). 그림이 들어오면 다시 짓는다");
for (const variant of card.variants ?? []) {
  if (!variant.examples?.length) problems.push(`변형 ${variant.id}: 예제가 없다`);
  const world = variant.worldviewId ? WORLDVIEWS.get(variant.worldviewId) : undefined;
  if (!world) problems.push(`변형 ${variant.id}: worldviewId 가 없거나 모르는 값(${variant.worldviewId ?? "없음"}) — ${[...WORLDVIEWS.keys()].join("·")} 중 하나`);
  for (const example of variant.examples ?? []) {
    const seed = buildBrowserSeed(brief).project;
    delete (seed as { gameDesignBrief?: unknown }).gameDesignBrief;
    const ctx = { project: seed } as { project: typeof seed };
    const before = new Set(Object.keys(seed.maps));
    const external = exampleMapIds(example.calls ?? []).filter((id) => before.has(id));
    for (const id of external) problems.push(`${variant.id}/${example.id}: 예제가 기존 맵 ${id} 를 가리킨다 — 예제는 자기가 만드는 맵만 쓴다(기존 맵과 잇기는 조수가 한다)`);
    const calls: { name: string; ok: boolean; summary: string }[] = [];
    for (const call of example.calls ?? []) {
      let ok = false, summary = "";
      try {
        const result = runTool(ctx as never, call.name, call.args as never);
        ok = result.ok; summary = String(result.summary).slice(0, 400);
      } catch (error) { summary = `예외: ${(error as Error).message}`; }
      calls.push({ name: call.name, ok, summary });
      if (!ok) problems.push(`${variant.id}/${example.id}: ${call.name} 실패 — ${summary.slice(0, 200)}`);
    }
    const maps = Object.values(ctx.project.maps).filter((map) => !before.has(map.id));
    if (maps.length === 0) problems.push(`${variant.id}/${example.id}: 새 맵이 생기지 않았다`);
    const mapReports = maps.map((map) => {
      const file = path.join(out, `${variant.id}--${example.id}--${map.id}.png`);
      renderAnnotated(ctx.project, map, file);
      const gimmicks = gimmicksWithoutEvents(map);
      const at = `${variant.id}/${example.id} ${map.id}`;
      for (const g of gimmicks) problems.push(`${at}: (${g.x},${g.y}) 「${g.what}」 그림만 있고 이벤트가 없다`);
      // 격언 1 — 빈 공간이 많으면 너무 넓은 것이다.
      const space = spaceStats(ctx.project, map);
      const outdoor = !INTERIOR.has(map.tilesetId);
      const lonelyMax = outdoor ? 35 : 30, squareMax = outdoor ? 8 : 6;
      if (space.lonelyShare > lonelyMax) problems.push(`${at}: 빈 공간이 많다 — 외딴 바닥 ${space.lonelyShare}% (기준 ≤${lonelyMax}%). 소품으로 메우지 말고 맵·방을 줄여라`);
      if (space.emptySquare > squareMax) problems.push(`${at}: (${space.emptySquareAt?.x},${space.emptySquareAt?.y}) 에 빈 정사각형 ${space.emptySquare}×${space.emptySquare} (기준 ≤${squareMax}) — 그 방이 너무 넓다`);
      // 격언 2 — ㅁ자 하나뿐인 방 금지.
      if (space.floor >= 80 && space.reflexCorners <= 2 && space.rectangularity >= 0.9)
        problems.push(`${at}: 평면이 직사각형 하나(ㅁ자, 오목 모서리 ${space.reflexCorners}·꽉 찬 정도 ${space.rectangularity}) — ㄱ·ㄷ·T 평면, 벽감, 칸막이 곁방, 기둥 열로 나눠라`);
      if (variant.layout === "dungeon" && space.loops < 1) problems.push(`${at}: 던전·미궁인데 고리가 없다 — 되돌아가기만 하는 나무형. 순환 1개 이상(잠긴 길과 열쇠 길, 돌아오는 지름길)`);
      // 격언 3 — 세계관의 재료로만.
      if (world) {
        const native = world.native.includes(map.tilesetId);
        if (!native && !BORROW.has(map.tilesetId)) problems.push(`${at}: 칩셋 ${map.tilesetId} 는 「${world.ko}」 것이 아니다 — 쓸 수 있는 것: ${world.native.join("·") || "없음(needsArt 로 그림 주문)"}`);
        if (!native && BORROW.has(map.tilesetId)) {
          const pieces = placedPieces(example.calls ?? [], map.id);
          if (pieces.length) problems.push(`${at}: 「${world.ko}」 맵에 다른 세계관 기물 ${pieces.length}종(${pieces.slice(0, 8).join(", ")}${pieces.length > 8 ? " …" : ""}) — 구조(바닥·벽)만 빌릴 수 있다. 기물은 gaps.json 에 그림으로 주문하고 needsArt:true`);
        }
      }
      return { mapId: map.id, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId, png: path.basename(file), events: eventCounts(map), gimmicksWithoutEvents: gimmicks, space };
    });
    const wantEvents = (variant.include ?? []).filter((m) => m.as === "event").length;
    const gotEvents = mapReports.reduce((sum, m) => sum + Object.values(m.events).reduce((a, b) => a + b, 0), 0);
    if (wantEvents > 0 && gotEvents === 0) problems.push(`${variant.id}/${example.id}: 이벤트 재료가 ${wantEvents}종인데 예제 맵에 이벤트가 0개다`);
    examples.push({ variant: variant.id, example: example.id, title: example.title, calls, maps: mapReports });
  }
}
const report = { ok: problems.length === 0, problems, examples, checkedAt: new Date().toISOString() };
fs.writeFileSync(path.join(out, "check.json"), JSON.stringify(report, null, 2));
console.log(report.ok ? "ok" : `문제 ${problems.length}건\n- ${problems.slice(0, 30).join("\n- ")}`);
process.exit(report.ok ? 0 : 1);
