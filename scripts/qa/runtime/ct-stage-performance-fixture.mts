// ct-stage-performance 시나리오 픽스처 — 무대 공연 컷신(author_stage_performance)을 편집기 도구(runTool)로만 저작한다 (2026-10-15, FF6급 감사 #31).
//   node node_modules/vite-node/dist/cli.mjs --script scripts/qa/runtime/ct-stage-performance-fixture.mts > project.json
// 시작 맵에 시작하자마자(auto·once) 도는 공연: 막 올림 → 배경색 → 조명 → 가사 두 줄(코너 자막) → 합창 두 명(겹침) → 조명 끔 → 막 닫기.
// 엔진 계약 픽스처이며 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
project.meta.title = "CT stage performance contract";
delete project.system.opening;
const ctx = { project };
const startMapId = project.startMapId;

const result = runTool(ctx, "author_stage_performance", {
  mapId: startMapId, trigger: "auto", once: true, x: 10, y: 8,
  acts: [
    { act: "backdrop", tint: "60,24,10,0.3", durationMs: 400 },
    { act: "spotlight", performer: "player", durationMs: 400 },
    { act: "lyric", lines: [{ text: "오 나의 운명이여", ms: 2400 }, { text: "별빛 아래 맹세하리", ms: 2400 }] },
    { act: "chorus", voices: [{ speaker: "합창 A", text: "맹세하리" }, { speaker: "합창 B", text: "영원히" }], staggerMs: 500, holdMs: 1800 },
    { act: "spotlight", performer: "player", on: false, durationMs: 300 },
    { act: "curtain", state: "close", durationMs: 800 },
  ],
});
if (!result.ok) { console.error(`author_stage_performance: ${result.summary}`); process.exit(1); }
const bad = runTool(ctx, "author_stage_performance", { mapId: startMapId, acts: [{ act: "lyric", text: "x", volume: 3 }] });
if (bad.ok) { console.error("unknown act key `volume` must be rejected"); process.exit(1); }
const bad2 = runTool(ctx, "author_stage_performance", { mapId: startMapId, acts: [{ act: "chorus", voices: [{ speaker: "a", text: "1" }, { speaker: "b", text: "2" }, { speaker: "c", text: "3" }, { speaker: "d", text: "4" }] }] });
if (bad2.ok) { console.error("4-voice chorus must be rejected"); process.exit(1); }
const reloaded = deserialize(serialize(ctx.project));
const events = reloaded.maps[startMapId]!.events.filter((event) => (event.pages ?? []).some((page) => page.name === "컷신"));
if (events.length !== 1) { console.error(`expected one cutscene event, got ${events.length}`); process.exit(1); }
process.stdout.write(serialize(ctx.project));
