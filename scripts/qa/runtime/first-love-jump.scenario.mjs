// 『첫사랑』 단계 점프 탐침 — FL_JUMP="단계,맵,x,y" 로 바로 가서 자동 장면을 돌리며 인물 방향을 줄마다 적는다.
import base from "./first-love.scenario.mjs";
const [stage, mapId, x, y] = (process.env.FL_JUMP ?? "4,fl_rooftop,3,22").split(",");
const head = base.beats.slice(0, base.beats.findIndex((b) => b.id === "platform") + 1);
const dump = (n) => ({ kind: "evalToFile", out: `/tmp/fl/jump-${n}.json`, fn: "() => { const s = window.__oprnHooksScene; const box = document.querySelector(\"[data-testid='dialogue-box']\"); return { text: box?.textContent?.slice(0, 60) ?? null, hero: [s.tileX, s.tileY, s.facing], pos: s.eventPositions, loc: s.session?.eventLocations }; }" });
const steps = [];
for (let i = 0; i < 14; i++) steps.push({ id: `l${i}`, note: `줄 ${i}`, ops: [dump(i), { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 900 }], shot: i % 3 === 0 });
export default {
  ...base,
  beats: [
    ...head,
    { id: "jump", note: "점프", ops: [
      { kind: "evalToFile", out: "/tmp/fl/jump-pre.json", fn: `() => { window.__oprnDebug.setVariable('var_fl_stage', ${Number(stage)}); return true; }` },
      { kind: "teleport", mapId, x: Number(x), y: Number(y) },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    ...steps,
  ],
};
