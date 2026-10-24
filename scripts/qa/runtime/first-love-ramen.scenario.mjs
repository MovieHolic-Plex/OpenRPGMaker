// 『첫사랑』 탕비실 지후 말 걸기 재현 — 수요일 단계로 바로 옮겨 지후에게 말을 건다(r5: Z 를 눌러도 대화가 안 열림).
import base from "./first-love.scenario.mjs";
import fs from "node:fs";
const project = JSON.parse(fs.readFileSync(process.env.FL_FIXTURE ?? ".omo/runtime-qa/first-love/game.json", "utf8"));
const ev = project.maps.fl_office_pm.events.find((e) => e.id === "ev_fl_w_jihu_pantry");
const desk = project.maps.fl_office_pm.events.find((e) => e.id === "ev_fl_w_desk"); desk.y += 1;
const head = base.beats.slice(0, base.beats.findIndex((b) => b.id === "platform") + 1);
const DIALOG = "!!document.querySelector(\"[data-testid='dialogue-box']\")";
export default {
  ...base,
  beats: [
    ...head,
    { id: "jump", note: "수요일 탕비실로", ops: [
      { kind: "evalToFile", out: "/tmp/fl/ramen-pre.json", fn: "() => { window.__oprnDebug.setVariable('var_fl_stage', 8); window.__oprnDebug.setVariable('var_fl_jihu', 5); return true; }" },
      { kind: "teleport", mapId: "fl_office_pm", x: desk.x, y: desk.y },
      { kind: "hold", dir: null, ms: 1500 },
      // 수요일 장면을 실제로 돈다(선택은 첫 번째), 지후가 탕비실로 걸어가 단계 9 가 될 때까지.
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='dialogue-box']\") && !document.querySelector(\"[data-testid='runtime-choices']\") && (window.__oprnDebug.readState().variables.var_fl_stage ?? 0) >= 9", maxPresses: 120, settleMs: 450 },
      { kind: "evalToFile", out: "/tmp/fl/ramen-mid.json", fn: "() => window.__oprnDebug.readState()" },
      { kind: "teleport", mapId: "fl_office_pm", x: ev.x, y: ev.y - 1 },
      { kind: "hold", dir: null, ms: 900 },
      { kind: "face", dir: "down" },
      { kind: "hold", dir: null, ms: 600 },
    ], shot: true },
    { id: "talk", note: "Z", ops: [
      { kind: "evalToFile", out: "/tmp/fl/ramen-scene.json", fn: "() => { const s = window.__oprnHooksScene; return { running: s.running, last: s.lastActionTargetKey, tile: [s.tileX, s.tileY], facing: s.facing, pos: Object.fromEntries(Object.entries(s.eventPositions ?? {}).filter(([k]) => k.includes('jihu'))) }; }" },
      { kind: "action" }, { kind: "hold", dir: null, ms: 900 },
      { kind: "evalToFile", out: "/tmp/fl/ramen-scene2.json", fn: "() => { const s = window.__oprnHooksScene; return { running: s.running, last: s.lastActionTargetKey }; }" },
      { kind: "evalToFile", out: "/tmp/fl/ramen-state.json", fn: `() => ({ dialog: ${DIALOG}, s: window.__oprnDebug.readState() })` },
    ], shot: true },
  ],
};
