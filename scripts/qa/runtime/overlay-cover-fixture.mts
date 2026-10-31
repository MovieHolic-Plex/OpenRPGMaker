// overlay-cover 시나리오용 픽스처(2026-10-31 폴른 스타 2막 첫 플레이 B6·B12·B13) — 실물 도구로 굽는다:
//   npx vite-node --script scripts/qa/runtime/overlay-cover-fixture.mts --out /tmp/overlay-cover.json
// 시작 맵 자동 실행: 건너뛸 수 있는 컷신 → 대사 → 전투(1라운드에 전투 대사 두 줄) → 대사 → 저장 메뉴.
// 볼 것: 전투 대사 창이 파티 상태 창을 덮는가, 「Esc 두 번: 컷신 건너뛰기」가 전투 머리·저장 메뉴 명령 목록을 덮는가.
import { readFileSync, writeFileSync } from "node:fs";
import { getTool } from "@/editor/tools/toolRegistry";
import { deserialize, serializePretty } from "@/project/io";
import type { Command } from "@/project/types";

const outIdx = process.argv.indexOf("--out");
const out = outIdx >= 0 ? process.argv[outIdx + 1] : null;
if (!out) throw new Error("사용법: vite-node --script scripts/qa/runtime/overlay-cover-fixture.mts --out <경로.json>");
const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
const troopId = "troop_slime_pair";
const run = (name: string, args: Record<string, unknown>) => { const tool = getTool(name); if (!tool) throw new Error(`${name} 도구 없음`); return tool.run(project, args); };
run("upsert_troop_battle_page", { troopId, page: {
  id: "qa_open", name: "QA 시작 대사", span: "battle", conditions: [{ kind: "onRound", round: 1 }],
  commands: [{ kind: "text", speaker: "세라", body: "개들아, 물지는 마라. 넘어뜨리기만." }, { kind: "text", speaker: "엘레나", body: "개부터 떼어 내자!\n세라 씨는 창을 길게 쓴다." }],
} });
const map = project.maps[project.startMapId]!;
const cmds = [
  { kind: "cutsceneControl", mode: "begin", skippable: true },
  { kind: "text", body: "컷신이 시작된다." },
  { kind: "battleProcessing", troopId, canEscape: false, canLose: true },
  { kind: "text", body: "전투가 끝났다. 저장 화면을 연다." },
  { kind: "openSaveMenu" },
  { kind: "cutsceneControl", mode: "end" },
] as unknown as Command[];
map.events.push({
  id: "ev_overlay_cover_qa", x: 0, y: 0, trigger: { kind: "auto" }, commands: [],
  pages: [{ id: "ev_overlay_cover_qa_p", name: "1", conditions: [], graphic: { transparent: true }, trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: cmds }],
} as unknown as (typeof map.events)[number]);
const text = serializePretty(project);
deserialize(text);   // 플레이어가 여는 것과 같은 검사 — 깨진 픽스처를 브라우저까지 들고 가지 않는다.
writeFileSync(out, text);
console.log("wrote", out);
