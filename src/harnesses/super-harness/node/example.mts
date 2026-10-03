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
import type { ConceptCard } from "../../../ai/conceptCards.ts";
import { eventCounts, gimmicksWithoutEvents, renderAnnotated } from "./lib.mts";

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
for (const variant of card.variants ?? []) {
  if (!variant.examples?.length) problems.push(`변형 ${variant.id}: 예제가 없다`);
  for (const example of variant.examples ?? []) {
    const seed = buildBrowserSeed(brief).project;
    delete (seed as { gameDesignBrief?: unknown }).gameDesignBrief;
    const ctx = { project: seed } as { project: typeof seed };
    const before = new Set(Object.keys(seed.maps));
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
      for (const g of gimmicks) problems.push(`${variant.id}/${example.id}: (${g.x},${g.y}) 「${g.what}」 그림만 있고 이벤트가 없다`);
      return { mapId: map.id, name: map.name, width: map.width, height: map.height, tilesetId: map.tilesetId, png: path.basename(file), events: eventCounts(map), gimmicksWithoutEvents: gimmicks };
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
